#!/usr/bin/env python3
"""Reject false mate notation before any remote outcome probes."""
import importlib.util
from pathlib import Path
import unittest

import chess

spec = importlib.util.spec_from_file_location('story_verifier', Path(__file__).with_name('verify-story-study.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class MateClaimTests(unittest.TestCase):
    def test_unprotected_rook_check_is_not_mate(self):
        board = chess.Board('8/8/6p1/6P1/7R/6K1/8/6k1 w - - 0 1')
        with self.assertRaisesRegex(ValueError, 'False checkmate claim'):
            verifier.checked_san(board, 'Rh1#')
        move, canonical = verifier.checked_san(board, 'Rh1+')
        self.assertEqual(canonical, 'Rh1+')
        board.push(move)
        self.assertIn('Kxh1', [board.san(m) for m in board.legal_moves])

    def test_rook_check_from_safe_distance_is_mate(self):
        board = chess.Board('8/8/6p1/6P1/4R3/6K1/8/7k w - - 0 1')
        move, canonical = verifier.checked_san(board, 'Re1#')
        self.assertEqual(canonical, 'Re1#')
        board.push(move)
        self.assertTrue(board.is_checkmate())


class WinningWitnessTests(unittest.TestCase):
    def test_castling_rights_are_preserved_until_the_legal_castle(self):
        fen = '3k4/8/8/8/8/8/1r6/R3K3 w Q - 0 1'
        board = chess.Board(fen)
        board.push_san('O-O-O+')
        evidence = dict(fen=board.fen(), response=dict(category='loss'))
        proof = verifier.winning_move_proof(fen, 'O-O-O+', evidence)
        self.assertEqual(proof['method'], 'legal_winning_move')
        self.assertIn(' Q ', proof['fen'])
        self.assertEqual(proof['successor_fen'].split()[2], '-')
        with self.assertRaises(chess.IllegalMoveError):
            verifier.winning_move_proof(fen.replace(' Q ', ' - '), 'O-O-O+', evidence)

    def test_a_draw_or_mismatched_successor_cannot_certify_a_win(self):
        fen = '3k4/8/8/8/8/8/1r6/R3K3 w Q - 0 1'
        board = chess.Board(fen)
        board.push_san('O-O-O+')
        for evidence in [dict(fen=board.fen(), response=dict(category='draw')),
                         dict(fen=fen, response=dict(category='loss'))]:
            with self.subTest(evidence=evidence), self.assertRaises(ValueError):
                verifier.winning_move_proof(fen, 'O-O-O+', evidence)



class FiniteStrategyTests(unittest.TestCase):
    def setUp(self):
        self.fen = '3k4/8/4K2p/p6r/P1R5/7P/8/8 w - - 0 1'
        board = chess.Board(self.fen)
        self.policy = {board.fen(): 'h4'}
        board.push_san('h4')
        self.defender = board
        self.answers = {'Ke8':'Rc8#', 'Rg5':'hxg5', 'Rf5':'Kxf5', 'Re5+':'Kxe5',
                        'Rd5':'Kxd5', 'Rc5':'Rxc5', 'Rb5':'axb5', 'Rxh4':'Rxh4'}
        for move in list(board.legal_moves):
            child = board.copy()
            child.push(move)
            self.policy[child.fen()] = self.answers[board.san(move)]

    def exact_white_win(self, fen):
        board = chess.Board(fen)
        self.assertLessEqual(len(board.piece_map()), 7)
        return dict(fen=fen, response=dict(category='win' if board.turn else 'loss'))

    def test_every_legal_defense_is_enumerated_and_mate_is_checked(self):
        proof = verifier.finite_strategy_proof(self.fen, chess.WHITE, self.policy, self.exact_white_win, 3)
        defenses = proof['children']['h4']
        self.assertEqual(defenses['rule'], 'all_legal_defenses')
        self.assertEqual(set(defenses['children']), set(self.answers))
        mate = defenses['children']['Ke8']['children']['Rc8#']
        self.assertEqual(mate['rule'], 'checkmate')
        self.assertTrue(chess.Board(mate['fen']).is_checkmate())
        self.assertNotIn('response', proof)
        self.assertEqual(len(list(verifier.cached_tablebase_results(proof))), 7)

    def test_draw_leaf_or_mismatched_leaf_cannot_be_hidden(self):
        for response in [lambda fen: dict(fen=fen, response=dict(category='draw')),
                         lambda fen: dict(fen=self.fen, response=dict(category='win'))]:
            with self.subTest(response=response), self.assertRaises(ValueError):
                verifier.finite_strategy_proof(self.fen, chess.WHITE, self.policy, response, 3)

    def test_repetition_history_and_fifty_move_claims_are_not_discarded(self):
        board = chess.Board('7k/pp6/PP6/8/8/7p/7P/K7 w - - 0 1')
        for san in ['Ka2','Kg8','Ka1','Kh8'] * 2:
            board.push_san(san)
        self.assertTrue(board.can_claim_threefold_repetition())
        with self.assertRaisesRegex(ValueError, 'Drawn finite-strategy'):
            verifier.finite_strategy_proof(board, chess.WHITE, {}, self.exact_white_win, 3)
        with self.assertRaisesRegex(ValueError, 'Drawn finite-strategy'):
            verifier.finite_strategy_proof(self.fen.replace('0 1', '100 1'), chess.WHITE,
                                           self.policy, self.exact_white_win, 3)

    def test_missing_check_response_and_depth_cutoff_are_not_proofs(self):
        incomplete = dict(self.policy)
        board = self.defender.copy()
        board.push_san('Re5+')
        incomplete.pop(board.fen())
        with self.assertRaisesRegex(ValueError, 'Missing finite-strategy move'):
            verifier.finite_strategy_proof(self.fen, chess.WHITE, incomplete, self.exact_white_win, 3)
        with self.assertRaisesRegex(ValueError, 'depth exhausted'):
            verifier.finite_strategy_proof(self.fen, chess.WHITE, self.policy, self.exact_white_win, 1)


class FiniteDrawTests(unittest.TestCase):
    def setUp(self):
        self.fen = '5q2/8/2p5/3p2pp/6pk/8/5pP1/7K w - - 0 1'
        self.policies = {'white': {self.fen: 'g3+'}, 'black': {}}
        for line in ['g3+ Kxg3', 'Kh2 Qf4+ Kh1 Qg3',
                     'Kh2 Qf4+ g3+ Qxg3+ Kh1 Qg1#']:
            board = chess.Board(self.fen)
            for san in line.split():
                if board.turn == chess.BLACK:
                    self.policies['black'][board.fen()] = san
                board.push_san(san)

    def no_fetch(self, fen):
        self.fail('All leaves here exceed seven pieces and terminate legally')

    def test_exact_draw_has_independent_complete_strategies_for_both_sides(self):
        proof = verifier.finite_draw_proof(self.fen, self.policies, self.no_fetch, 6)
        self.assertEqual(proof['category_for_side_to_move'], 'draw')
        white = proof['strategies']['white']['children']['g3+']
        self.assertEqual(set(white['children']), {'Kh3', 'Kxg3'})
        self.assertTrue(all(v['rule'] == 'stalemate' for v in white['children'].values()))
        self.assertEqual(set(proof['strategies']['black']['children']), {'Kh2', 'g3+'})

    def test_one_sided_draw_and_omitted_opponent_reply_are_not_exact_draw_proofs(self):
        incomplete = {'white': self.policies['white'], 'black': {}}
        with self.assertRaisesRegex(ValueError, 'Missing non-losing'):
            verifier.finite_draw_proof(self.fen, incomplete, self.no_fetch, 6)
        with self.assertRaisesRegex(ValueError, 'depth exhausted'):
            verifier.finite_draw_proof(self.fen, self.policies, self.no_fetch, 1)

    def test_checkmated_side_cannot_claim_non_loss(self):
        board = chess.Board(self.fen)
        for san in 'Kh2 Qf4+ g3+ Qxg3+ Kh1 Qg1#'.split():
            board.push_san(san)
        with self.assertRaisesRegex(ValueError, 'checkmated'):
            verifier.non_losing_strategy_proof(board, chess.WHITE, {}, self.no_fetch, 1)

    def test_supported_leaves_require_exact_non_loss_not_cursed_outcomes(self):
        fen = '8/8/8/8/8/4k3/8/4K3 w - - 0 1'
        for category in ['loss', 'cursed-win', 'blessed-loss']:
            with self.subTest(category=category), self.assertRaisesRegex(ValueError, 'exact supported non-loss'):
                verifier.non_losing_strategy_proof(fen, chess.WHITE, {},
                    lambda f: dict(fen=f, response=dict(category=category)), 1)
        result = verifier.finite_draw_proof(fen, {'white': {}, 'black': {}},
                    lambda f: dict(fen=f, response=dict(category='draw')), 1)
        self.assertEqual(result['category_for_side_to_move'], 'draw')


class RepetitionDrawTests(unittest.TestCase):
    def setUp(self):
        self.fen = '1K6/1R6/1kb5/1p6/1P1p4/3P2p1/6p1/6qr b - - 0 1'
        self.policies = {'white': {}, 'black': {self.fen: 'Bxb7'}}
        board = chess.Board(self.fen)
        for san in 'Ka6 Ra7+ Kb6 Rb7+ Ka6 Ra7+ Kb6 Rb7+'.split():
            if board.turn == chess.WHITE:
                self.policies['white'][board.fen()] = san
            board.push_san(san)
        self.repeated = board

    def no_fetch(self, fen):
        self.fail('All leaves exceed seven pieces')

    def test_actual_history_proves_claim_and_both_sides_non_loss(self):
        proof = verifier.finite_draw_proof(self.fen, self.policies, self.no_fetch, 8)
        current = proof['strategies']['white']
        for san in 'Ka6 Ra7+ Kb6 Rb7+ Ka6 Ra7+ Kb6'.split():
            current = current['children'][san]
        self.assertEqual(current['rule'], 'threefold_claim')
        board = chess.Board(current['history_root_fen'])
        for uci in current['history_uci']:
            move = chess.Move.from_uci(uci)
            self.assertIn(move, board.legal_moves)
            board.push(move)
        self.assertEqual(board.fen(), current['fen'])
        self.assertEqual(board.turn, chess.WHITE)
        self.assertTrue(board.can_claim_threefold_repetition())
        declared = chess.Move.from_uci(current['claim_move_uci'])
        self.assertIn(declared, board.legal_moves)
        board.push(declared)
        self.assertTrue(board.is_repetition(3))
        self.assertEqual(proof['strategies']['black']['children']['Bxb7']['rule'], 'stalemate')

    def test_fen_alone_and_insufficient_cycle_depth_are_not_repetition_proofs(self):
        with self.assertRaisesRegex(ValueError, 'Missing non-losing'):
            verifier.non_losing_strategy_proof(self.repeated.fen(), chess.WHITE, {}, self.no_fetch, 2)
        with self.assertRaisesRegex(ValueError, 'depth exhausted'):
            verifier.finite_draw_proof(self.fen, self.policies, self.no_fetch, 6)

    def test_opponent_optional_claim_does_not_prove_beneficiary_non_loss(self):
        self.assertEqual(self.repeated.turn, chess.BLACK)
        self.assertTrue(self.repeated.can_claim_threefold_repetition())
        with self.assertRaisesRegex(ValueError, 'depth exhausted'):
            verifier.non_losing_strategy_proof(self.repeated, chess.WHITE, {}, self.no_fetch, 0)
        own_claim = verifier.non_losing_strategy_proof(self.repeated, chess.BLACK, {}, self.no_fetch, 0)
        self.assertEqual(own_claim['rule'], 'threefold_claim')

    def test_automatic_fivefold_is_history_based_for_either_side(self):
        board = chess.Board(self.fen)
        for san in ['Ka6','Ra7+','Kb6','Rb7+'] * 4:
            board.push_san(san)
        self.assertTrue(board.is_fivefold_repetition())
        proof = verifier.non_losing_strategy_proof(board, chess.WHITE, {}, self.no_fetch, 0)
        self.assertEqual(proof['rule'], 'fivefold_repetition')
        self.assertEqual(len(proof['history_uci']), 16)


if __name__ == '__main__':
    unittest.main()
