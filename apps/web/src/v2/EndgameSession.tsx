import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { ArrowLeft, Download, Lightbulb, RotateCcw, Undo2 } from "lucide-react";
import { Board, Piece } from "./Board";
import { MoveChecklist } from "../MoveChecklist";
import { positionGuidance } from "./coaching";
import { EngineBusyError, gameResult } from "./fullGame";
import { chooseEndgameMove, endgamePlans, explainEndgameMove, probeTablebase, puzzleHint, replayEndgame, tablebaseEligible, tablebaseLabel, type EndgamePosition, type TablebasePosition } from "./endgames";

export function EndgameSession({ position, initialMoves, onSave, onExit, backLabel = 'Back to endgames', plan, objectiveText }: {
  position: EndgamePosition; initialMoves: string[]; onSave: (moves: string[]) => void; onExit: () => void;
  backLabel?: string; plan?: string; objectiveText?: string;
}) {
  const [moves, setMoves] = useState(initialMoves);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [hint, setHint] = useState<{ move: Move; why: string; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [table, setTable] = useState<TablebasePosition | null>(null);
  const [tableStatus, setTableStatus] = useState("");
  const [source, setSource] = useState("");
  const hintController = useRef<AbortController | null>(null);
  const game = useMemo(() => replayEndgame(position, moves), [position, moves]);
  const result = gameResult(game);
  const yourTurn = !result && game.turn() === position.side;
  const last = game.history({ verbose: true }).at(-1);
  const lastWhy = useMemo(() => {
    if (!moves.length) return null;
    const before = replayEndgame(position, moves.slice(0, -1));
    return explainEndgameMove(before, game, last!);
  }, [game, position, moves]);
  const guidance = positionGuidance(game, position.side, plan ?? endgamePlans[position.type]);
  const watch = guidance.watch.filter(item => !item.includes("starting square") && !item.includes("back rank"))
    .map(item => item.replace("A recorded continuation is one route, not the only legal response.", "You can play any legal move in this position."));
  if (!watch.length) watch.push("Inspect the opponent’s checks, captures, and pawn advances. Coordinate your king and pieces before committing to a pawn race or an exchange.");
  const update = (next: string[]) => {
    hintController.current?.abort();
    setMoves(next); setSelected(null); setPromotion(null); setHint(null); setHintBusy(false); setError(""); setRetryAt(null); setBusy(false);
    onSave(next);
  };
  useEffect(() => {
    return () => { hintController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (result || !yourTurn || !tablebaseEligible(game)) { setTable(null); setTableStatus(""); return; }
    const controller = new AbortController();
    setTable(null); setTableStatus("Checking the exact tablebase result…");
    probeTablebase(game, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setTable(data); setTableStatus(data ? "" : "No exact tablebase result is available; Stockfish is used.");
    }).catch(() => { if (!controller.signal.aborted) setTableStatus("Tablebase is unavailable; Stockfish can continue the game."); });
    return () => controller.abort();
  }, [game]);
  useEffect(() => {
    if (yourTurn || result) return;
    const controller = new AbortController();
    setBusy(true); setError(""); setRetryAt(null);
    chooseEndgameMove(game, controller.signal).then(chosen => {
      if (controller.signal.aborted) return;
      setSource(chosen.source);
      if (chosen.tableUnavailable) setTableStatus("Tablebase is unavailable; this reply uses Stockfish.");
      const next = [...moves, chosen.move.san];
      setMoves(next); onSave(next);
    }).catch(e => {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Couldn't reach the engine. Retry from the saved position.");
      if (e instanceof EngineBusyError) setRetryAt(Date.now() + e.retryAfterMs);
    }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [game, yourTurn, retry]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(() => setRetry(v => v + 1), Math.max(0, retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
  const submit = (from: Square, to: Square, promote?: PieceSymbol) => {
    if (!yourTurn) return;
    try {
      const candidate = replayEndgame(position, moves);
      const move = candidate.move({ from, to, promotion: promote });
      update([...moves, move.san]);
    } catch { setSelected(null); }
  };
  const select = (square: Square) => {
    if (!yourTurn || promotion) return;
    if (game.get(square)?.color === position.side) { setSelected(square === selected ? null : square); return; }
    if (!selected) return;
    const legal = game.moves({ square: selected, verbose: true }).filter(m => m.to === square);
    if (legal.some(m => m.promotion)) setPromotion({ from: selected, to: square });
    else submit(selected, square);
  };
  const showHint = async () => {
    if (!yourTurn || hintBusy) return;
    if (hint) { setHint(null); return; }
    const controller = new AbortController(); hintController.current?.abort(); hintController.current = controller;
    setHintBusy(true); setError("");
    try {
      // Exact tablebases take priority; an intact puzzle line is a useful offline hint.
      let exact: TablebasePosition | null = null;
      try { exact = await probeTablebase(game, controller.signal); } catch { /* Try the puzzle or engine. */ }
      if (controller.signal.aborted) return;
      const puzzle = puzzleHint(position, moves);
      const chosen = exact ? { move: new Chess(game.fen()).move(exact.moves[0].san), source: "Tablebase" }
        : puzzle ? { move: puzzle, source: "Puzzle solution" } : await chooseEndgameMove(game, controller.signal);
      if (controller.signal.aborted) return;
      const after = replayEndgame(position, [...moves, chosen.move.san]);
      setHint({ move: chosen.move, source: chosen.source, why: explainEndgameMove(game, after, chosen.move) });
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Hint unavailable. You can still play."); }
    finally { if (!controller.signal.aborted) setHintBusy(false); }
  };
  const undo = () => update(moves.slice(0, Math.max(0, moves.length - (game.turn() === position.side ? 2 : 1))));
  const moveLabel = (index: number) => {
    const number = Number(position.fen.split(" ")[5]) + Math.floor((index + (position.side === "b" ? 1 : 0)) / 2);
    const color = index % 2 === 0 ? position.side : position.side === "w" ? "b" : "w";
    return `${number}${color === "w" ? "." : "..."}`;
  };
  const exportGame = () => {
    const output = replayEndgame(position, moves);
    output.header("Event", "Opening Studio endgame practice", "Result", result?.result ?? "*");
    const url = URL.createObjectURL(new Blob([output.pgn()], { type: "application/x-chess-pgn" }));
    const a = document.createElement("a"); a.href = url; a.download = `endgame-${position.id}.pgn`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="os-training">
    <div className="os-session-top"><button className="os-link" onClick={onExit}><ArrowLeft size={17} /> {backLabel}</button><span>You play {position.side === "w" ? "White" : "Black"}</span></div>
    <div className="os-training-layout">
      <section className="os-board-zone">
        <div className="os-board-heading"><span className="os-label">{result ? result.title : yourTurn ? "YOUR MOVE" : "OPPONENT THINKING"}</span><span>{moves.length} plies played</span></div>
        <Board game={game} side={position.side} selected={selected} onSelect={select} interactive={yourTurn} hint={hint?.move} last={last} />
        {promotion && <div className="os-promotion" role="dialog" aria-label="Choose promotion piece">{(["q", "r", "b", "n"] as PieceSymbol[]).map(type => <button key={type} className="os-icon-button" aria-label={`Promote to ${type}`} onClick={() => submit(promotion.from, promotion.to, type)}><Piece type={type} color={position.side} /></button>)}<button className="os-link" onClick={() => setPromotion(null)}>Cancel</button></div>}
        <div className="os-feedback" role="status">{result ? result.detail : busy ? "Choosing an opponent reply…" : yourTurn ? "Play any legal move. The opponent replies automatically." : error || "Waiting for an opponent reply."}</div>
        <MoveChecklist positionKey={game.fen()} />
        <div className="os-board-tools"><button className="os-secondary" onClick={showHint} disabled={!yourTurn || hintBusy}><Lightbulb size={16} /> {hintBusy ? "Choosing hint…" : hint ? "Hide hint" : "Show hint"}</button><button className="os-secondary" onClick={undo} disabled={!moves.length}><Undo2 size={16} /> Undo my move</button><button className="os-secondary" onClick={() => update([])} disabled={!moves.length}><RotateCcw size={16} /> Restart position</button><button className="os-secondary" onClick={exportGame}><Download size={16} /> Export PGN</button></div>
        {error && <div className="os-notice warning" role="alert"><p>{error}</p>{retryAt ? <p>Automatic retry is scheduled.</p> : <button className="os-secondary" onClick={() => yourTurn ? showHint() : setRetry(v => v + 1)}>Retry</button>}</div>}
        <section className="os-lesson-timeline"><span className="os-label">GAME MOVES</span><div>{moves.length ? moves.map((san, i) => <span className="os-endgame-ply" key={i}>{moveLabel(i)} {san}</span>) : <p>You start directly in the endgame.</p>}</div></section>
      </section>
      <aside className="os-session-panel os-learn-panel" aria-label="Endgame Learn panel">
        <div className="os-learn-heading"><strong>Endgame Practice</strong><span>{position.goal === "draw" ? "Hold the draw" : "Win this"}</span></div>
        <h1>{position.title}</h1><p className="os-session-variation">{position.type} ending · {position.difficulty} · {position.rating ? `Puzzle rating ${position.rating}` : "Unrated technical exercise"}</p>
        <section className="os-why-panel os-coach-card"><span className="os-label">YOUR OBJECTIVE</span><h2>{position.goal === "draw" ? "Hold the draw" : "Convert the advantage"}</h2><p>{objectiveText ?? (position.goal === "draw" ? "This starting position is tablebase-verified as drawn with optimal play. Defend it without letting the opponent force a win." : "Find the puzzle's tactical opportunity, then play the position out to a win. The puzzle rating measures the tactic, rather than the difficulty or length of the entire endgame.")}</p><h3>What to aim for</h3><p>{plan ?? endgamePlans[position.type]}</p><h3>Before you move</h3><ul>{watch.map(item => <li key={item}>{item}</li>)}</ul></section>
        {table && <div className="os-lesson-idea"><p><strong>Exact tablebase result:</strong> {tablebaseLabel(game, table)} This is an outcome with optimal play, not a reason to stop practicing.</p></div>}
        {tableStatus && <p className="os-training-note" role="status">{tableStatus}</p>}
        {hint && <section className="os-why-panel os-coach-card"><span className="os-label">OPTIONAL HINT · {hint.source}</span><h2>{hint.move.san}</h2><p>Move from {hint.move.from} to {hint.move.to}{hint.move.promotion ? ` and promote to ${hint.move.promotion}` : ""}.</p><p>{hint.why}</p></section>}
        {lastWhy && <section className="os-why-panel os-coach-card"><span className="os-label">LAST MOVE · {last?.san}</span><p>{lastWhy}</p></section>}
        {result && <section className="os-game-result" role="status"><h2>{result.title}</h2><strong>{result.result}</strong><p>{result.result === "1/2-1/2" ? position.goal === "draw" ? "You held the draw." : "The game was drawn. Restart to try converting the advantage again." : result.result === (position.side === "w" ? "1-0" : "0-1") ? "You won the endgame." : "The opponent won. Review the moves or restart the position."}</p></section>}
        <p className="os-training-note">Opponent: {source || "tablebase when available, otherwise expert Stockfish"}. Your position is saved in this browser. Hints never play your move for you.</p>
        <a className="os-link" href={position.sourceUrl} target="_blank" rel="noreferrer">{position.source === "lichess-puzzle" ? "Original Lichess puzzle" : "Verify starting position in the tablebase"}</a>
      </aside>
    </div>
  </div>;
}
