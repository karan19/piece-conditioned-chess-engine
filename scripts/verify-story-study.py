#!/usr/bin/env python3
"""Check a manually reconstructed study, saving reproducible tablebase evidence.

Requires python-chess. This validates legal moves and exact outcomes; it does
not reconstruct board images or certify that narration matches a video.
Usage: python scripts/verify-story-study.py scripts/curated-studies/<id>.json
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request
import chess


def checked_san(board, san):
    move = board.parse_san(san)
    canonical = board.san(move)
    if san.endswith('#') and not canonical.endswith('#'):
        raise ValueError(f'False checkmate claim: {san} is {canonical} in {board.fen()}')
    return move, canonical


def tablebase_supported(board):
    return board.is_valid() and len(board.piece_map()) <= 7 and not board.castling_rights


def winning_move_proof(fen, san, successor):
    """A legal move to an exact opponent loss proves a win, without probing the root."""
    board = chess.Board(fen)
    if not board.is_valid() or board.is_game_over(claim_draw=True):
        raise ValueError('Invalid or already drawn witness root')
    move, canonical = checked_san(board, san)
    board.push(move)
    if not tablebase_supported(board) or successor['fen'] != board.fen() or successor['response']['category'] != 'loss':
        raise ValueError('Winning witness must reach a supported exact opponent loss')
    return dict(method='legal_winning_move', fen=fen, category_for_side_to_move='win',
                san=canonical, successor_fen=board.fen())



def finite_strategy_proof(fen, winner, policy, fetch, max_plies):
    """Check a finite strategy: choose one winning move, enumerate every defense.

    Leaves must be actual mate or an exact supported tablebase win for winner.
    No engine estimate, omitted defense, draw or depth cutoff proves a win.
    """
    board = fen.copy(stack=True) if isinstance(fen, chess.Board) else chess.Board(fen)
    if not board.is_valid():
        raise ValueError('Invalid finite-strategy board')
    if not board.is_checkmate() and board.is_game_over(claim_draw=True):
        raise ValueError('Drawn finite-strategy leaf cannot prove a win')
    category = 'win' if board.turn == winner else 'loss'
    if tablebase_supported(board):
        result = fetch(board.fen())
        if result['fen'] != board.fen() or result['response']['category'] != category:
            raise ValueError('Finite-strategy leaf must be an exact winner result')
        return result
    proof = dict(method='finite_strategy', fen=board.fen(), winner='white' if winner else 'black',
                 category_for_side_to_move=category)
    if board.is_checkmate():
        if board.turn == winner:
            raise ValueError('Claimed winner is checkmated')
        return dict(proof, rule='checkmate')
    if board.is_game_over(claim_draw=True):
        raise ValueError('Drawn finite-strategy leaf cannot prove a win')
    if max_plies <= 0:
        raise ValueError('Finite-strategy depth exhausted without proof')
    if board.turn == winner:
        san = policy.get(board.fen())
        if not san:
            raise ValueError('Missing finite-strategy move for ' + board.fen())
        move, canonical = checked_san(board, san)
        moves = [(canonical, move)]
        rule = 'winning_choice'
    else:
        moves = sorted((board.san(move), move) for move in board.legal_moves)
        rule = 'all_legal_defenses'
    children = {}
    for san, move in moves:
        child = board.copy(stack=True)
        child.push(move)
        children[san] = finite_strategy_proof(child, winner, policy, fetch, max_plies - 1)
    return dict(proof, rule=rule, children=children)


def non_losing_strategy_proof(fen, side, policy, fetch, max_plies):
    """Prove a floor of draw for one side, checking every opposing reply."""
    board = fen.copy(stack=True) if isinstance(fen, chess.Board) else chess.Board(fen)
    if not board.is_valid():
        raise ValueError('Invalid non-losing strategy board')
    if tablebase_supported(board):
        result = fetch(board.fen())
        allowed = ['draw', 'win' if board.turn == side else 'loss']
        if result['fen'] != board.fen() or result['response']['category'] not in allowed:
            raise ValueError('Non-losing leaf must be an exact supported non-loss')
        return result
    proof = dict(method='non_losing_strategy', fen=board.fen(),
                 side='white' if side else 'black')
    if board.is_stalemate():
        return dict(proof, rule='stalemate')
    if board.is_checkmate():
        if board.turn == side:
            raise ValueError('Non-losing side is checkmated')
        return dict(proof, rule='checkmate')
    # A claim belongs to the player whose turn it is. Never assume the opponent
    # will claim on the beneficiary's behalf. Save the complete legal history so
    # a reviewer can replay the repetition rather than infer it from one FEN.
    if board.is_fivefold_repetition() or (board.turn == side and board.can_claim_threefold_repetition()):
        claim_move = None
        if not board.is_repetition(3):
            for move in board.legal_moves:
                child = board.copy(stack=True)
                child.push(move)
                if child.is_repetition(3):
                    claim_move = move.uci()
                    break
            if claim_move is None:
                raise ValueError('Repetition claim lacks a legal declared move')
        return dict(proof, rule='fivefold_repetition' if board.is_fivefold_repetition() else 'threefold_claim',
                    history_root_fen=board.root().fen(),
                    history_uci=[move.uci() for move in board.move_stack], claim_move_uci=claim_move)
    # An optional opponent repetition claim does not terminate our strategy:
    # continue checking every reply until our side can claim or another exact
    # non-loss leaf is reached. Other draw mechanisms remain unsupported here.
    if board.is_game_over(claim_draw=True) and not board.can_claim_threefold_repetition():
        raise ValueError('Unsupported draw claim in non-losing strategy')
    if max_plies <= 0:
        raise ValueError('Non-losing strategy depth exhausted without proof')
    if board.turn == side:
        san = policy.get(board.fen())
        if not san:
            raise ValueError('Missing non-losing strategy move for ' + board.fen())
        move, canonical = checked_san(board, san)
        moves, rule = [(canonical, move)], 'safe_choice'
    else:
        moves = sorted((board.san(move), move) for move in board.legal_moves)
        rule = 'all_legal_replies'
    children = {}
    for san, move in moves:
        child = board.copy(stack=True)
        child.push(move)
        children[san] = non_losing_strategy_proof(child, side, policy, fetch, max_plies - 1)
    return dict(proof, rule=rule, children=children)


def finite_draw_proof(fen, policies, fetch, max_plies):
    """Exact draw requires independent non-loss strategies for BOTH sides.

    A single illustrated stalemate or one-sided drawing floor is insufficient.
    Each strategy enumerates every opposing legal reply until exact leaves.
    """
    return dict(method='finite_draw', fen=fen, category_for_side_to_move='draw',
                strategies={name: non_losing_strategy_proof(fen, side, policies[name], fetch, max_plies)
                            for name, side in [('white', chess.WHITE), ('black', chess.BLACK)]})


def evidence_category(value):
    return value['response']['category'] if 'response' in value else value['category_for_side_to_move']


def cached_tablebase_results(value):
    if isinstance(value, dict):
        if 'fen' in value and 'response' in value:
            yield value
        for child in value.values():
            yield from cached_tablebase_results(child)
    elif isinstance(value, list):
        for child in value:
            yield from cached_tablebase_results(child)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('study', type=Path)
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    study = json.loads(args.study.read_text())
    evidence_path = args.study.with_name(args.study.stem + '.evidence.json')
    previous = json.loads(evidence_path.read_text()) if evidence_path.exists() else {}
    cache = {v['fen']: v for v in cached_tablebase_results(previous)}
    positions = {}
    witnesses = {}
    unsupported = {}
    strategy = study.get('finiteStrategy')
    draw_strategy = study.get('finiteDraw')
    if strategy and draw_strategy:
        raise ValueError('Use one exact strategy type per study')
    if draw_strategy and (not isinstance(draw_strategy.get('max_plies'), int) or
                          not 0 < draw_strategy['max_plies'] <= 12 or
                          any(not isinstance(draw_strategy.get(side), dict) for side in ['white', 'black'])):
        raise ValueError('Invalid finite draw policies/depth')
    if strategy and (strategy.get('winner') not in ['white', 'black'] or
                     not isinstance(strategy.get('max_plies'), int) or not 0 < strategy['max_plies'] <= 12):
        raise ValueError('Invalid finite strategy winner/depth')

    def record(key, board):
        if tablebase_supported(board):
            positions[key] = board.fen()
        elif (strategy or draw_strategy) and board.is_valid():
            unsupported[key] = board.fen()
        else:
            raise ValueError('Invalid or unsupported board: ' + key)
    nodes = {n['id']: n for n in study['nodes']}
    for node in nodes.values():
        board = chess.Board(node['fen'])
        if tablebase_supported(board):
            positions['node:' + node['id']] = board.fen()
        elif node.get('winningMoveWitness'):
            if not board.is_valid():
                raise ValueError(f'Invalid witness board: {node["id"]}')
            move, san = checked_san(board, node['winningMoveWitness'])
            board.push(move)
            if not tablebase_supported(board):
                raise ValueError('Witness successor must fit tablebase coverage with no castling rights')
            witnesses[node['id']] = san
            positions['witness:' + node['id']] = board.fen()
        else:
            record('node:' + node['id'], board)
    for branch in study['branches']:
        board = chess.Board(nodes[branch['start']]['fen'])
        if 'expectedWhiteOutcomes' in branch and len(branch['expectedWhiteOutcomes']) != len(branch['san']):
            raise ValueError(f'Incomplete expected outcomes: {branch["id"]}')
        notes = branch.get('commentary')
        if notes is not None and (len(notes) != len(branch['san']) + 1 or any(len(n) < 15 for n in notes)):
            raise ValueError(f'Incomplete move commentary: {branch["id"]}')
        canonical = []
        for i, san in enumerate(branch['san'], 1):
            move, checked = checked_san(board, san)
            canonical.append(checked)
            board.push(move)
            record(f'step:{branch["id"]}:{i}', board)
        branch['san'] = canonical
        branch['end_fen'] = board.fen()
        record('branch:' + branch['id'], board)

    def fetch(fen):
        if not args.refresh and fen in cache:
            return cache[fen]
        url = 'https://tablebase.lichess.ovh/standard?fen=' + urllib.parse.quote_plus(fen)
        for attempt in range(4):
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'ChessLearningLab-study-verification/1.0'})
                with urllib.request.urlopen(request, timeout=40) as response:
                    data = json.load(response)
                if data.get('category') not in ['win', 'loss', 'draw', 'cursed-win', 'blessed-loss']:
                    raise ValueError('Missing tablebase category')
                result = dict(fen=fen, url=url, retrieved_at_utc=datetime.now(timezone.utc).isoformat(), response=data)
                cache[fen] = result
                return result
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)

    fens = sorted(set(positions.values()))
    with ThreadPoolExecutor(max_workers=2) as pool:
        checked = dict(zip(fens, pool.map(fetch, fens)))
    evidence = {key: checked[fen] for key, fen in positions.items()}
    finite_checked = {}
    for key, fen in unsupported.items():
        if fen not in finite_checked:
            finite_checked[fen] = (finite_draw_proof(fen, draw_strategy, fetch, draw_strategy['max_plies'])
                                   if draw_strategy else
                                   finite_strategy_proof(fen, strategy['winner'] == 'white',
                                                         strategy['moves'], fetch, strategy['max_plies']))
        evidence[key] = finite_checked[fen]
    for node_id, san in witnesses.items():
        proof = winning_move_proof(nodes[node_id]['fen'], san, evidence['witness:' + node_id])
        proof['successor_evidence_key'] = 'witness:' + node_id
        evidence['node:' + node_id] = proof
    root = chess.Board(nodes['start']['fen'])
    goal = study.get('practiceGoal', 'win')
    root_category = evidence_category(evidence['node:start'])
    if goal not in ['win', 'draw'] or root_category != goal:
        raise ValueError('Practice goal must match the exact root outcome for the side to move')
    for node in nodes.values():
        if node['id'] in witnesses or 'node:' + node['id'] in unsupported:
            node.pop('tablebase', None)
            value = evidence['node:' + node['id']]
            node['proof'] = ({k: value[k] for k in ['method', 'fen', 'winner', 'category_for_side_to_move', 'rule']}
                             if value.get('method') == 'finite_strategy' else
                             {k: value[k] for k in ['method', 'fen', 'category_for_side_to_move']}
                             if value.get('method') == 'finite_draw' else value)
        else:
            node['tablebase'] = dict(category_for_side_to_move=evidence['node:' + node['id']]['response']['category'])
    for branch in study['branches']:
        branch['outcome'] = evidence_category(evidence['branch:' + branch['id']])
        for i, expected in enumerate(branch.get('expectedWhiteOutcomes', []), 1):
            value = evidence[f'step:{branch["id"]}:{i}']
            board = chess.Board(value['fen'])
            category = evidence_category(value)
            white_outcome = category if board.turn == chess.WHITE or category == 'draw' else {'win': 'loss', 'loss': 'win'}.get(category, category)
            if white_outcome != expected:
                raise ValueError(f'{branch["id"]} step {i}: expected White {expected}, found {white_outcome}')
    study['verificationDate'] = datetime.now(timezone.utc).date().isoformat()
    # Write only after every legal replay, fetch and expected outcome check passes.
    evidence_path.write_text(json.dumps(evidence, indent=2) + '\n')
    args.study.write_text(json.dumps(study, indent=2, ensure_ascii=False) + '\n')
    print(f'{study["title"]}: {len(study["branches"])} branches; {len(fens)} direct tablebase positions and {len(finite_checked)} finite-strategy positions checked. Saved {evidence_path}')


if __name__ == '__main__':
    main()
