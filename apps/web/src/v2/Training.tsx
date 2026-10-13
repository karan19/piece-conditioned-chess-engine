import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  Lightbulb,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Square, PieceSymbol } from "chess.js";
import { gameAt, type Opening, type Side } from "./catalog";
import { Board, Piece } from "./Board";
export type Mode = "learn" | "practice" | "drill" | "time";
export const modeLabels: Record<Mode, string> = {
  learn: "Learn",
  practice: "Spaced review",
  drill: "Drill",
  time: "Time challenge",
};
let audioContext: AudioContext | undefined;
function playSound() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(420, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      220,
      audioContext.currentTime + 0.07,
    );
    gain.gain.setValueAtTime(0.04, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.09,
    );
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch {
    /* Audio is optional. */
  }
}
export function Training({
  opening,
  side,
  mode,
  index,
  total,
  onExit,
  onNext,
  onComplete,
}: {
  opening: Opening;
  side: Side;
  mode: Mode;
  index: number;
  total: number;
  onExit: () => void;
  onNext: () => void;
  onComplete: (clean: boolean, review: boolean) => void;
}) {
  const [ply, setPly] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [errors, setErrors] = useState(0);
  const [assists, setAssists] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [sound, setSound] = useState(false);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ kind: string; text: string }>({
    kind: "info",
    text:
      mode === "learn"
        ? "Follow the line. Your opponent replies automatically."
        : "Find each move from memory. Take your time.",
  });
  const deadline = useRef(Date.now() + 60000);
  const recorded = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const game = useMemo(() => gameAt(opening, ply), [opening, ply]);
  const finished = ply >= opening.moves.length;
  const expired = mode === "time" && seconds === 0 && !finished;
  const userTurn = game.turn() === side && !finished && !expired;
  const expected = useMemo(
    () =>
      !finished
        ? gameAt(opening, ply + 1)
            .history({ verbose: true })
            .at(-1)
        : undefined,
    [opening, ply, finished],
  );
  const last = game.history({ verbose: true }).at(-1);
  useEffect(() => {
    if (!finished && !expired && game.turn() !== side) {
      const timer = window.setTimeout(() => {
        if (sound) playSound();
        setPly((p) => p + 1);
        setSelected(null);
        setShowHint(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [ply, side, finished, expired, game, sound]);
  useEffect(() => {
    if (mode !== "time" || finished || expired) return;
    const timer = window.setInterval(
      () =>
        setSeconds(
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [mode, finished, expired, attempt]);
  useEffect(() => {
    if (finished && !recorded.current) {
      recorded.current = true;
      onComplete(errors === 0 && assists === 0, mode !== "learn");
    }
  }, [finished, errors, assists, mode, onComplete]);
  const restart = () => {
    deadline.current = Date.now() + 60000;
    recorded.current = false;
    setPly(0);
    setSelected(null);
    setShowHint(false);
    setErrors(0);
    setAssists(0);
    setSeconds(60);
    setPromotion(null);
    setAttempt((a) => a + 1);
    setFeedback({ kind: "info", text: "Fresh start. Find the next move." });
  };
  const submit = (from: Square, to: Square, promote?: PieceSymbol) => {
    if (!userTurn) return;
    const candidate = gameAt(opening, ply);
    let move;
    try {
      move = candidate.move({ from, to, promotion: promote });
    } catch {
      return;
    }
    if (move.san !== opening.moves[ply]) {
      setErrors((n) => n + 1);
      setSelected(null);
      setFeedback({
        kind: "error",
        text: `${move.san} is legal, but this line follows a different move. Try again${mode === "learn" ? `: ${opening.moves[ply]}.` : "."}`,
      });
      return;
    }
    if (sound) playSound();
    setPly((p) => p + 1);
    setSelected(null);
    setShowHint(false);
    setFeedback({
      kind: "success",
      text: `Correct. ${move.san}${game.isCheck() ? " gets you out of check." : " is the move in this line."}`,
    });
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
  const hint = () => {
    if (!showHint) {
      setAssists((n) => n + 1);
      setShowHint(true);
    }
  };
  const yourMoves = opening.moves.filter(
    (_, i) => i % 2 === (side === "w" ? 0 : 1),
  ).length;
  const doneMoves = opening.moves
    .slice(0, ply)
    .filter((_, i) => i % 2 === (side === "w" ? 0 : 1)).length;
  return (
    <div className="os-training">
      <div className="os-session-top">
        <button className="os-link" onClick={onExit}>
          <ArrowLeft size={17} /> Back to course
        </button>
        <span>
          {modeLabels[mode]} <span className="os-muted">/</span> Line{" "}
          {index + 1} of {total}
        </span>
        <button
          className="os-icon-button"
          aria-label={sound ? "Mute move sounds" : "Enable move sounds"}
          onClick={() => setSound((s) => !s)}
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>
      <div className="os-training-layout">
        <section className="os-board-zone">
          <div className="os-board-heading">
            <span className="os-label">
              YOU PLAY {side === "w" ? "WHITE" : "BLACK"}
            </span>
            <span>
              {mode === "time" ? (
                <>
                  <Timer size={16} /> {seconds}s
                </>
              ) : (
                <>
                  {doneMoves}/{yourMoves} moves
                </>
              )}
            </span>
          </div>
          <Board
            game={game}
            side={side}
            selected={selected}
            onSelect={choose}
            interactive={userTurn}
            hint={(showHint || mode === "learn") && userTurn ? expected : null}
            last={last}
          />
          {promotion && (
            <div
              className="os-promotion"
              role="dialog"
              aria-modal="true"
              aria-label="Choose promotion piece"
            >
              <span>Promote to</span>
              {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
                <button
                  className="os-icon-button"
                  key={type}
                  aria-label={`Promote to ${type === "q" ? "queen" : type === "r" ? "rook" : type === "b" ? "bishop" : "knight"}`}
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
          <div
            className={`os-feedback ${finished ? "success" : expired ? "error" : feedback.kind}`}
            role="status"
          >
            {finished ? (
              <>
                <Check size={19} /> Line complete.{" "}
                {errors || assists
                  ? "Keep practicing to build recall."
                  : "Nicely played."}
              </>
            ) : expired ? (
              <>
                <Timer size={19} /> Time is up. Restart to try again.
              </>
            ) : !userTurn ? (
              <>
                <span className="os-thinking" /> Opponent is replying…
              </>
            ) : (
              <>
                {feedback.kind === "success" ? (
                  <Check size={19} />
                ) : (
                  <Flag size={19} />
                )}{" "}
                {feedback.text}
              </>
            )}
          </div>
          <div className="os-board-tools">
            <button className="os-secondary" onClick={restart}>
              <RotateCcw size={16} /> Restart
            </button>
            <button
              className="os-secondary"
              onClick={hint}
              disabled={!userTurn || showHint}
            >
              <Lightbulb size={16} /> Hint
            </button>
            <button className="os-secondary" onClick={onNext}>
              <SkipForward size={16} />{" "}
              {index + 1 === total ? "Finish session" : "Skip line"}
            </button>
          </div>
        </section>
        <aside className="os-session-panel">
          <span className="os-eyebrow">
            {opening.eco} · {modeLabels[mode]}
          </span>
          <h1>{opening.family}</h1>
          <p className="os-session-variation">
            {opening.name.includes(":")
              ? opening.name.split(":").slice(1).join(":")
              : "Main position"}
          </p>
          <div className="os-progress-track">
            <div style={{ width: `${(ply / opening.moves.length) * 100}%` }} />
          </div>
          <p className="os-muted">
            {Math.round((ply / opening.moves.length) * 100)}% of this line
          </p>
          <div className="os-next-move">
            <span className="os-label">
              {finished
                ? "SESSION RESULT"
                : expired
                  ? "TRY AGAIN"
                  : userTurn
                    ? "YOUR NEXT MOVE"
                    : "OPPONENT'S TURN"}
            </span>
            <strong>
              {finished
                ? `${doneMoves} moves played`
                : expired
                  ? "Time ran out"
                  : userTurn && (mode === "learn" || showHint)
                    ? opening.moves[ply]
                    : userTurn
                      ? "What would you play?"
                      : "Watch the board"}
            </strong>
            <p>
              {finished
                ? mode === "learn"
                  ? "This line is now ready for spaced review."
                  : errors || assists
                    ? "This line stays due. Review it without hints to move up a box."
                    : "Your next review is scheduled automatically."
                : "Click a piece, then its destination. You can also drag a piece."}
            </p>
          </div>
          <div className="os-mini-stats">
            <div>
              <strong>{errors}</strong>
              <span>Mistakes</span>
            </div>
            <div>
              <strong>{assists}</strong>
              <span>Hints used</span>
            </div>
            <div>
              <strong>{errors === 0 && assists === 0 ? "✓" : "↻"}</strong>
              <span>Recall</span>
            </div>
          </div>
          {(mode === "learn" || finished) && (
            <div className="os-move-list">
              <span className="os-label">THE LINE</span>
              <p>
                {opening.moves.map((move, i) => (
                  <span
                    key={i}
                    className={i === ply ? "current" : i < ply ? "played" : ""}
                  >
                    {i % 2 === 0 ? <small>{i / 2 + 1}.</small> : null}
                    {move}{" "}
                  </span>
                ))}
              </p>
            </div>
          )}
          {finished && (
            <button className="os-primary wide" onClick={onNext}>
              {index + 1 === total ? "Finish session" : "Next line"}
              <ArrowRight size={18} />
            </button>
          )}
          <p className="os-training-note">
            Training the recorded opening line. Other legal moves may also be
            good chess moves.
          </p>
        </aside>
      </div>
    </div>
  );
}
