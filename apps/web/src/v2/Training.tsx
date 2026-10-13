import { useMemo, useState } from "react";
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
import { Board, Piece } from "./Board";
export function Training({
  opening,
  side,
  initialPly = 0,
  continuations = [],
  onContinue,
  onExit,
  onStep,
}: {
  opening: Opening;
  side: Side;
  initialPly?: number;
  continuations?: Opening[];
  onContinue: (opening: Opening) => void;
  onExit: () => void;
  onStep: (ply: number) => void;
}) {
  const [ply, setPly] = useState(Math.min(initialPly, opening.moves.length));
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState("");
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const game = useMemo(() => gameAt(opening, ply), [opening, ply]);
  const next = useMemo(
    () => explainStep(opening, ply, side),
    [opening, ply, side],
  );
  const explained = useMemo(
    () => explainStep(opening, Math.max(0, ply - 1), side),
    [opening, ply, side],
  );
  const guide = openingPlan(opening, side);
  const finished = ply === opening.moves.length;
  const userTurn = !finished && game.turn() === side;
  const last = game.history({ verbose: true }).at(-1);
  const go = (target: number) => {
    setPly(target);
    setSelected(null);
    setPromotion(null);
    setFeedback("");
    onStep(target);
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
      setSelected(null);
      setFeedback(
        `${move.san} is legal, but this walkthrough shows ${opening.moves[ply]}. Follow the highlighted move, or use the button to see it played.`,
      );
      return;
    }
    go(ply + 1);
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
                ? "END OF THIS LINE"
                : `${game.turn() === "w" ? "WHITE" : "BLACK"} TO MOVE`}
            </span>
            <span>
              {ply}/{opening.moves.length} plies
            </span>
          </div>
          <Board
            game={game}
            side={side}
            selected={selected}
            onSelect={choose}
            interactive={userTurn}
            hint={next?.move}
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
                ? "You've walked through this line. It stays in My openings until you remove it."
                : next?.instruction)}
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
              disabled={finished}
            >
              <ChevronRight size={16} />{" "}
              {userTurn ? "Show my move" : "Show opponent's move"}
            </button>
          </div>
          <section className="os-lesson-timeline">
            <span className="os-label">FOLLOW THE WHOLE SEQUENCE</span>
            <div>
              {opening.moves.map((san, i) => (
                <button
                  key={i}
                  className={i === ply - 1 ? "active" : i < ply ? "seen" : ""}
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
            <p>{guide.idea}</p>
          </div>
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
          {next && (
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
              YOUR PLAN AS {side === "w" ? "WHITE" : "BLACK"}
            </span>
            <p>{side === "w" ? guide.white : guide.black}</p>
          </section>
          {finished && continuations.length > 0 && (
            <section className="os-continuations">
              <h3>Where this line goes next</h3>
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
              Choose another variation <ArrowRight size={17} />
            </button>
          )}
          <p className="os-training-note">
            Use the move list to revisit any step. Your opening stays in My
            openings until you remove it.
          </p>
        </aside>
      </div>
    </div>
  );
}
