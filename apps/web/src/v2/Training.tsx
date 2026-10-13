import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import type { PieceSymbol, Square } from "chess.js";
import { gameAt, type Opening, type Side } from "./catalog";
import { branchContext, openingBranch, realGameReplies, type RealGamePosition } from "./realGames";
import { positionGuidance } from "./coaching";
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
  initialBookMoves,
  initialBookComplete = false,
  continuations = [],
  onContinue,
  onExit,
  onStep,
}: {
  opening: Opening;
  side: Side;
  initialPly?: number;
  initialContinuation?: string[];
  initialBookMoves?: string[];
  initialBookComplete?: boolean;
  continuations?: Opening[];
  onContinue: (opening: Opening) => void;
  onExit: () => void;
  onStep: (ply: number, continuation: string[], learning: { bookMoves: string[]; bookComplete: boolean }) => void;
}) {
  const [bookMoves, setBookMoves] = useState(initialBookMoves ?? opening.moves);
  const [bookComplete, setBookComplete] = useState(initialBookComplete || initialContinuation.length > 0);
  const bookOpening = useMemo(() => ({ ...opening, moves: bookMoves }), [opening, bookMoves]);
  const openingLimit = Math.max(20, opening.moves.length);
  const [samplePosition, setRealPosition] = useState<RealGamePosition | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const [sampleRetry, setSampleRetry] = useState(0);
  const [continuation, setContinuation] = useState(initialContinuation);
  const [ply, setPly] = useState(
    Math.min(initialPly, bookMoves.length + initialContinuation.length),
  );
  const [loading, setLoading] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const context = useMemo(() => branchContext(opening, bookMoves), [opening, bookMoves]);
  const lesson = useMemo(
    () => ({ ...context, id: opening.id, moves: [...bookMoves, ...continuation] }),
    [opening, context, bookMoves, continuation],
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const game = useMemo(
    () => replayGame(bookOpening, continuation, ply),
    [bookOpening, continuation, ply],
  );
  const next = useMemo(
    () => explainStep(lesson, ply, side),
    [lesson, ply, side],
  );
  const explained = useMemo(
    () => explainStep(lesson, Math.max(0, ply - 1), side),
    [lesson, ply, side],
  );
  const positionKey = game.history().join(" ");
  const realPosition = samplePosition?.key === positionKey ? samplePosition : null;
  const guide = openingPlan(context, side);
  const result = gameResult(game);
  const finished = Boolean(result);
  const inContinuation = bookComplete && ply >= bookMoves.length;
  const needsMove = !finished && ply === lesson.moves.length;
  const coaching = positionGuidance(game, side, inContinuation
    ? phasePlan(game, side === "w" ? "b" : "w")
    : side === "w" ? guide.black : guide.white);
  const persist = (target: number, moves = continuation, taught = bookMoves, complete = bookComplete) =>
    onStep(target, moves, { bookMoves: taught, bookComplete: complete });
  useEffect(() => {
    if (finished || inContinuation || ply >= 20) {
      setRealPosition(null);
      setSampleLoading(false);
      return;
    }
    let active = true;
    setRealPosition(null);
    setSampleError("");
    setSampleLoading(true);
    realGameReplies(game).then(position => {
      if (active) setRealPosition(position);
    }).catch(() => {
      if (active) setSampleError("Couldn’t load the real-game sample. You can follow the recorded line or continue with Stockfish.");
    }).finally(() => { if (active) setSampleLoading(false); });
    return () => { active = false; };
  }, [positionKey, finished, inContinuation, sampleRetry]);
  useEffect(() => {
    if (finished || bookComplete || !needsMove) return;
    if (ply >= openingLimit || sampleError || (realPosition && !sampleLoading && !realPosition.replies.length)) {
      setBookComplete(true);
      persist(ply, continuation, bookMoves, true);
    } else if (realPosition && !sampleLoading && realPosition.replies.length) {
      const extended = openingBranch(opening, bookMoves, realPosition.replies[0].san).slice(0, openingLimit);
      setBookMoves(extended);
      persist(ply, [], extended, false);
    }
  }, [bookComplete, needsMove, realPosition, sampleLoading, sampleError, ply]);
  useEffect(() => {
    if (!needsMove || !inContinuation) return;
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
        persist(ply, extended);
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
  }, [needsMove, inContinuation, game, side, retryVersion]);
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
    setShowHint(false);
    setSelected(null);
    setPromotion(null);
    setFeedback("");
    setLoading(false);
    setEngineError("");
    setRetryAt(null);
    persist(target);
  };
  const submit = (from: Square, to: Square, promote?: PieceSymbol) => {
    if (!userTurn || (!inContinuation && !next)) return;
    const candidate = replayGame(bookOpening, continuation, ply);
    let move;
    try {
      move = candidate.move({ from, to, promotion: promote });
    } catch {
      return;
    }
    if (ply < bookMoves.length && move.san !== bookMoves[ply]) {
      setSelected(null);
      setFeedback(
        `${move.san} is legal, but this walkthrough shows ${bookMoves[ply]}. Follow the highlighted move, or use the button to see it played.`,
      );
      return;
    }
    if (inContinuation && move.san !== lesson.moves[ply]) {
      const branch = [
        ...continuation.slice(0, ply - bookMoves.length),
        move.san,
      ];
      setContinuation(branch);
      setShowHint(false);
      setPly(ply + 1);
      setSelected(null);
      setFeedback("");
      persist(ply + 1, branch);
    } else go(ply + 1);
  };
  const studyReply = (san: string) => {
    const prefix = lesson.moves.slice(0, ply);
    const branch = openingBranch(opening, prefix, san).slice(0, openingLimit);
    setBookMoves(branch);
    setBookComplete(false);
    setContinuation([]);
    setPly(ply + 1);
    setSelected(null);
    setPromotion(null);
    setShowHint(false);
    setFeedback(`Studying ${san} from the real-game sample. The lesson now follows this branch.`);
    setEngineError("");
    setLoading(false);
    persist(ply + 1, [], branch, false);
  };
  const useEngine = () => {
    const prefix = lesson.moves.slice(0, ply);
    setBookMoves(prefix);
    setBookComplete(true);
    setContinuation([]);
    setSelected(null);
    setFeedback("");
    setEngineError("");
    setRetryAt(null);
    setLoading(false);
    persist(ply, [], prefix, true);
  };
  const resetVariation = () => {
    setBookMoves(opening.moves);
    setBookComplete(false);
    setContinuation([]);
    setPly(0);
    setSelected(null);
    setShowHint(false);
    setFeedback("");
    setPromotion(null);
    setEngineError("");
    setRetryAt(null);
    setLoading(false);
    persist(0, [], opening.moves, false);
  };
  const choose = (square: Square) => {
    if (!userTurn || promotion || (!inContinuation && !next)) return;
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
                : `${ply} opening ${ply === 1 ? "ply" : "plies"} · ${realPosition ? "Real-game replies" : "Recorded lesson"}`}
            </span>
          </div>
          <Board
            game={game}
            side={side}
            selected={selected}
            onSelect={choose}
            interactive={userTurn && (inContinuation || Boolean(next))}
            hint={!finished && showHint ? next?.move : undefined}
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
                    ? inContinuation ? "The opening continues into a full game. Stockfish is choosing the next move…" : "Looking up the next common continuation from real games…"
                    : next?.instruction))}
          </div>
          <div className="os-board-tools">
            <button
              className="os-secondary"
              aria-pressed={showHint}
              disabled={finished || !next}
              onClick={() => setShowHint(value => !value)}
            >
              <Lightbulb size={16} /> {showHint ? "Hide hint" : "Highlight move"}
            </button>
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
                  className={`${i === ply - 1 ? "active" : i < ply ? "seen" : ""} ${i >= bookMoves.length ? "engine-move" : ""}`}
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
        <aside className="os-session-panel os-learn-panel" aria-label="Learn coach">
          <div className="os-learn-heading"><BookOpen size={20} /><strong>Learn</strong><span>{userTurn ? "Your move" : finished ? "Game review" : "Opponent’s move"}</span></div>
          <span className="os-eyebrow">{opening.eco} · GUIDED LESSON</span>
          <h1>{opening.family}</h1>
          <p className="os-session-variation">
            {opening.name.includes(":")
              ? opening.name.split(":").slice(1).join(":")
              : "Main position"}
          </p>
          {context.family !== opening.family && <p className="os-branch-context">This reply leads to {context.name}. The plan below follows that position.</p>}
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
          {realPosition && realPosition.replies.length > 0 && !userTurn && !inContinuation && <button className="os-replies-jump" onClick={() => document.getElementById("os-real-replies")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}>
            Study common replies: {realPosition.replies.slice(0, 3).map(reply => `${reply.san} (${reply.percent.toFixed(0)}%)`).join(" · ")} <ArrowRight size={15} />
          </button>}
          {(next || explained) && (() => {
            const step = next && !finished ? next : explained!;
            return (
              <section className="os-why-panel os-coach-card" aria-live="polite" aria-atomic="true">
                <span className="os-label">{finished ? "FINAL MOVE" : next ? "MOVE TO PLAY" : "LAST MOVE · WAITING FOR CONTINUATION"}</span>
                <h2>{step.label}</h2>
                <p className="os-coach-instruction">{step.instruction}</p>
                <h3>Why this move?</h3>
                {step.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                {!finished && <>
                  <h3>What your opponent is trying to do</h3>
                  <p>{coaching.opponentPlan}</p>
                  <h3>Before you move, watch for</h3>
                  <ul>{coaching.watch.map(item => <li key={item}>{item}</li>)}</ul>
                  {step.followUp && <><h3>{inContinuation ? "Known game continuation" : "How this line develops"}</h3><p>{inContinuation ? step.followUp.replace("In this recorded line", "In the saved game continuation") : step.followUp.replace("In this recorded line", "In this lesson branch")}</p></>}
                </>}
                <details className="os-coach-details">
                  <summary>What this move changes on the board</summary>
                  <ul>{step.facts.map(f => <li key={f}>{f}</li>)}</ul>
                </details>
                <p className="os-coach-source">{inContinuation
                  ? "Stockfish suggestion · explanations describe board effects and possible plans, not the engine’s reasoning."
                  : "Opening lesson · original notes and position-based guidance. Real-game frequencies describe popularity, not move quality."}</p>
              </section>
            );
          })()}
          {ply > 0 && explained && next && !finished && (
            <details className="os-last-move">
              <summary>Review the last move: {explained.label}</summary>
              <p>{explained.why}</p>
            </details>
          )}
          {!inContinuation && !finished && ply < 20 && (
            <section id="os-real-replies" className="os-real-replies" aria-label="Real-game replies" aria-live="polite">
              <span className="os-label">{userTurn ? "COMMON MOVES FROM REAL GAMES" : "COMMON OPPONENT REPLIES"}</span>
              <h2>{game.turn() === "w" ? "White" : "Black"} responses here</h2>
              {sampleLoading && <p role="status">Loading the real-game sample…</p>}
              {sampleError && <><p>{sampleError}</p><button className="os-secondary" onClick={() => setSampleRetry(v => v + 1)}>Retry game data</button></>}
              {realPosition && <>
                <p>{realPosition.total ? `${realPosition.total.toLocaleString()} sampled games continued from this exact move sequence.` : "This move sequence has fewer than 20 games in our sample. Follow the recorded variation; Stockfish takes over when its book line ends."}</p>
                {realPosition.replies.map((reply, index) => {
                  const responseContext = branchContext(opening, openingBranch(opening, game.history(), reply.san));
                  const response = explainStep({ ...responseContext, moves: [...game.history(), reply.san] }, ply, side)!;
                  return <div className="os-real-reply" key={reply.san}>
                    <div className="os-reply-stat"><strong>{reply.san}</strong><span>{reply.percent.toFixed(1)}% · {reply.games.toLocaleString()} games</span>{index === 0 && <small>Most common in sample</small>}</div>
                    <details><summary>Why play {reply.san}?</summary>{response.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}<p><strong>Opponent’s plan:</strong> {response.opponentPlan}</p></details>
                    {!userTurn && <button className="os-secondary wide" onClick={() => studyReply(reply.san)}>Study {reply.san} <ArrowRight size={15} /></button>}
                  </div>;
                })}
                <details className="os-sample-source"><summary>About this real-game sample</summary><p>{realPosition.sample.games.toLocaleString()} rated human games · {realPosition.sample.firstDate} to {realPosition.sample.lastDate}. Both players rated 1000+; blitz, rapid and classical. A contiguous sample, not all games or a forecast of what you will face.</p><p>Up to six replies with at least three games are shown; percentages use all sampled continuations here. Popularity does not prove a move is best.</p><a href="https://database.lichess.org/" target="_blank" rel="noreferrer">Lichess open database · CC0</a></details>
              </>}
              {ply > 0 && <button className="os-link" onClick={useEngine}>Continue from here with Stockfish <ArrowRight size={15} /></button>}
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
          {ply === bookMoves.length &&
            bookMoves.join(" ") === opening.moves.join(" ") &&
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
          {bookMoves.join(" ") !== opening.moves.join(" ") && <button className="os-secondary wide" onClick={resetVariation}>Return to selected variation</button>}
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
