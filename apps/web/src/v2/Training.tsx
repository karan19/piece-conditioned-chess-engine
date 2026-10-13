import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import type { PieceSymbol, Square } from "chess.js";
import { gameAt, type Opening, type Side } from "./catalog";
import { explainStep, openingPlan } from "./lessons";
import {
  EngineBusyError,
  nextEngineMove,
  gameResult,
  isEndgame,
  phasePlan,
  replayGame,
} from "./fullGame";
import { Board, Piece } from "./Board";
export function Training({
  opening,
  side,
  initialPly = 0,
  initialContinuation = [],
  continuations = [],
  onContinue,
  onExit,
  onStep,
}: {
  opening: Opening;
  side: Side;
  initialPly?: number;
  initialContinuation?: string[];
  continuations?: Opening[];
  onContinue: (opening: Opening) => void;
  onExit: () => void;
  onStep: (ply: number, continuation: string[]) => void;
}) {
  const [continuation, setContinuation] = useState(initialContinuation);
  const [ply, setPly] = useState(
    Math.min(initialPly, opening.moves.length + initialContinuation.length),
  );
  const [loading, setLoading] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const lesson = useMemo(
    () => ({ ...opening, moves: [...opening.moves, ...continuation] }),
    [opening, continuation],
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState("");
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const game = useMemo(
    () => replayGame(opening, continuation, ply),
    [opening, continuation, ply],
  );
  const next = useMemo(
    () => explainStep(lesson, ply, side),
    [lesson, ply, side],
  );
  const explained = useMemo(
    () => explainStep(lesson, Math.max(0, ply - 1), side),
    [lesson, ply, side],
  );
  const guide = openingPlan(opening, side);
  const result = gameResult(game);
  const finished = Boolean(result);
  const inContinuation = ply >= opening.moves.length;
  const needsMove = !finished && ply === lesson.moves.length;
  useEffect(() => {
    if (!needsMove) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setEngineError("");
    setRetryAt(null);
    const request = async () => {
      try {
        const move = await nextEngineMove(game, side, controller.signal);
        if (!active) return;
        const extended = [...continuation, move.san];
        setContinuation(extended);
        onStep(ply, extended);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setEngineError(
          error instanceof Error
            ? error.message
            : "The engine couldn't choose a move. Retry to continue.",
        );
        if (error instanceof EngineBusyError)
          setRetryAt(Date.now() + error.retryAfterMs);
      } finally {
        if (active) setLoading(false);
      }
    };
    void request();
    return () => {
      active = false;
      controller.abort();
    };
  }, [needsMove, game, side, retryVersion]);
  useEffect(() => {
    if (retryAt === null) return;
    const timer = window.setTimeout(
      () => setRetryVersion((v) => v + 1),
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);
  const userTurn = !finished && game.turn() === side;
  const last = game.history({ verbose: true }).at(-1);
  const go = (target: number) => {
    setPly(target);
    setSelected(null);
    setPromotion(null);
    setFeedback("");
    setLoading(false);
    setEngineError("");
    setRetryAt(null);
    onStep(target, continuation);
  };
  const submit = (from: Square, to: Square, promote?: PieceSymbol) => {
    if (!userTurn) return;
    const candidate = replayGame(opening, continuation, ply);
    let move;
    try {
      move = candidate.move({ from, to, promotion: promote });
    } catch {
      return;
    }
    if (ply < opening.moves.length && move.san !== opening.moves[ply]) {
      setSelected(null);
      setFeedback(
        `${move.san} is legal, but this walkthrough shows ${opening.moves[ply]}. Follow the highlighted move, or use the button to see it played.`,
      );
      return;
    }
    if (inContinuation && move.san !== lesson.moves[ply]) {
      const branch = [
        ...continuation.slice(0, ply - opening.moves.length),
        move.san,
      ];
      setContinuation(branch);
      setPly(ply + 1);
      setSelected(null);
      setFeedback("");
      onStep(ply + 1, branch);
    } else go(ply + 1);
  };
  const choose = (square: Square) => {
    if (!userTurn || promotion) return;
    const piece = game.get(square);
    if (piece?.color === side) {
      setSelected(selected === square ? null : square);
      return;
    }
    if (!selected) return;
    const options = game
      .moves({ square: selected, verbose: true })
      .filter((m) => m.to === square);
    if (!options.length) {
      setSelected(null);
      return;
    }
    if (options.some((m) => m.promotion))
      setPromotion({ from: selected, to: square });
    else submit(selected, square);
  };
  return (
    <div className="os-training">
      <div className="os-session-top">
        <button className="os-link" onClick={onExit}>
          <ArrowLeft size={17} /> Back to opening
        </button>
        <span>
          Guided walkthrough · You play {side === "w" ? "White" : "Black"}
        </span>
      </div>
      <div className="os-training-layout">
        <section className="os-board-zone">
          <div className="os-board-heading">
            <span className="os-label">
              {finished
                ? result!.title.toUpperCase()
                : `${game.turn() === "w" ? "WHITE" : "BLACK"} TO MOVE`}
            </span>
            <span>
              {inContinuation
                ? `Game: ${ply} plies · ${finished ? "Finished" : isEndgame(game) ? "Endgame" : "Guided continuation"}`
                : `${ply}/${opening.moves.length} opening plies`}
            </span>
          </div>
          <Board
            game={game}
            side={side}
            selected={selected}
            onSelect={choose}
            interactive={userTurn}
            hint={!finished ? next?.move : undefined}
            last={last}
          />
          {promotion && (
            <div
              className="os-promotion"
              role="dialog"
              aria-modal="true"
              aria-label="Choose promotion piece"
            >
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
                <button
                  key={type}
                  className="os-icon-button"
                  aria-label={`Promote to ${type}`}
                  onClick={() => {
                    submit(promotion.from, promotion.to, type);
                    setPromotion(null);
                  }}
                >
                  <Piece type={type} color={side} />
                </button>
              ))}
              <button className="os-link" onClick={() => setPromotion(null)}>
                Cancel
              </button>
            </div>
          )}
          <div className="os-feedback" role="status">
            {feedback ||
              (finished
                ? result!.detail
                : engineError ||
                  (needsMove
                    ? "The opening continues into a full game. Stockfish is choosing the next move…"
                    : next?.instruction))}
          </div>
          <div className="os-board-tools">
            <button
              className="os-secondary"
              onClick={() => go(0)}
              disabled={ply === 0}
            >
              <RotateCcw size={16} /> Start again
            </button>
            <button
              className="os-secondary"
              onClick={() => go(ply - 1)}
              disabled={ply === 0}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="os-primary"
              onClick={() => go(ply + 1)}
              disabled={finished || !next || loading}
            >
              <ChevronRight size={16} />{" "}
              {loading
                ? "Choosing next move…"
                : finished
                  ? "Game finished"
                  : userTurn
                    ? "Show my move"
                    : "Show opponent's move"}
            </button>
          </div>
          {engineError && (
            <div className="os-notice warning" role="status">
              {engineError}
              {retryAt ? (
                <span>Automatic retry is scheduled.</span>
              ) : (
                <button
                  className="os-secondary"
                  onClick={() => setRetryVersion((v) => v + 1)}
                >
                  Retry engine
                </button>
              )}
            </div>
          )}
          {inContinuation && !finished && (
            <div className="os-continuation-banner">
              <strong>The opening is the beginning.</strong>
              <p>
                Stockfish guides the game from here until checkmate or a draw.
                You can follow its move or play another legal move as your side.
              </p>
            </div>
          )}
          <section className="os-lesson-timeline">
            <span className="os-label">FOLLOW THE WHOLE SEQUENCE</span>
            <div>
              {lesson.moves.map((san, i) => (
                <button
                  key={i}
                  className={`${i === ply - 1 ? "active" : i < ply ? "seen" : ""} ${i >= opening.moves.length ? "engine-move" : ""}`}
                  onClick={() => go(i + 1)}
                  aria-label={`View move ${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "..."} ${san}`}
                >
                  <small>
                    {Math.floor(i / 2) + 1}
                    {i % 2 === 0 ? "." : "..."}
                  </small>{" "}
                  {san}
                </button>
              ))}
            </div>
          </section>
        </section>
        <aside className="os-session-panel">
          <span className="os-eyebrow">{opening.eco} · GUIDED LESSON</span>
          <h1>{opening.family}</h1>
          <p className="os-session-variation">
            {opening.name.includes(":")
              ? opening.name.split(":").slice(1).join(":")
              : "Main position"}
          </p>
          <div className="os-lesson-idea">
            <BookOpen size={19} />
            <p>
              {inContinuation
                ? "The recorded opening is complete. Stockfish now chooses continuations from this position, with guidance through the rest of the game."
                : guide.idea}
            </p>
          </div>
          {result && (
            <section className="os-game-result" role="status">
              <Check size={22} />
              <h2>{result.title}</h2>
              <p>{result.detail}</p>
              <strong>{result.result}</strong>
              <p>Your complete game stays saved in My openings.</p>
            </section>
          )}
          {explained && (
            <section className="os-why-panel" aria-live="polite">
              <span className="os-label">
                {ply === 0 ? "FIRST MOVE EXPLAINED" : "LAST MOVE EXPLAINED"}
              </span>
              <h2>{explained.label}</h2>
              <h3>Why this move?</h3>
              <p>{explained.why}</p>
              <h3>What changes on the board</h3>
              <ul>
                {explained.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}
          {next && !finished && (
            <section className="os-next-move">
              <span className="os-label">
                UP NEXT · {userTurn ? "YOUR MOVE" : "OPPONENT'S REPLY"}
              </span>
              <strong>{next.label}</strong>
              <p>{next.instruction}</p>
              {ply > 0 && (
                <details>
                  <summary>Why is this the next move?</summary>
                  <p>{next.why}</p>
                </details>
              )}
            </section>
          )}
          <section className="os-plan-panel">
            <span className="os-label">
              {finished
                ? "FINAL POSITION"
                : `YOUR PLAN AS ${side === "w" ? "WHITE" : "BLACK"}`}
            </span>
            <p>
              {finished
                ? "The game has ended. Replay the moves to review how this final position arose."
                : inContinuation
                  ? phasePlan(game, side)
                  : side === "w"
                    ? guide.white
                    : guide.black}
            </p>
          </section>
          {ply === opening.moves.length &&
            continuations.length > 0 &&
            !finished && (
              <section className="os-continuations">
                <h3>Or choose another recorded continuation</h3>
                {continuations.map((o) => (
                  <button
                    className="os-secondary wide"
                    key={o.id}
                    onClick={() => onContinue(o)}
                  >
                    {o.name.split(":").slice(1).join(":") || o.name}
                    <ArrowRight size={16} />
                  </button>
                ))}
              </section>
            )}
          {finished && (
            <button className="os-primary wide" onClick={onExit}>
              Choose another opening <ArrowRight size={17} />
            </button>
          )}
          <p className="os-training-note">
            Use the move list to revisit any step. Your opening stays in My
            openings until you remove it. Stockfish coaches your side at expert
            strength and plays the opponent at medium strength. Checkmate is
            possible, but a game can also end in a draw.
          </p>
        </aside>
      </div>
    </div>
  );
}
