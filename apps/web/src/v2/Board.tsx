import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import type { Side } from "./catalog";
const labels: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  const shapes: Record<PieceSymbol, React.ReactNode> = {
    p: (
      <>
        <circle cx="22" cy="13" r="5" />
        <path d="M18 19h8l2 12H16zM13 34h18v4H13z" />
      </>
    ),
    r: (
      <>
        <path d="M12 8h5v5h3V8h4v5h3V8h5v11H12zM16 20h12v12H16zM12 34h20v4H12z" />
      </>
    ),
    b: (
      <>
        <path d="M22 5c-3 5-8 9-8 15 0 5 16 5 16 0 0-6-5-10-8-15zM17 26h10l2 6H15zM12 34h20v4H12z" />
        <path
          d="m23 13-5 7"
          stroke={color === "w" ? "#213b33" : "#f5f1e7"}
          strokeWidth="2"
        />
      </>
    ),
    n: (
      <>
        <path d="m13 31 4-8-6-1 1-8 8-7 1-4 4 5c8 3 9 11 7 23zM11 34h23v4H11z" />
        <circle
          cx="19"
          cy="14"
          r="1.4"
          fill={color === "w" ? "#213b33" : "#f5f1e7"}
          stroke="none"
        />
        <path d="m12 19 7-2" fill="none" />
      </>
    ),
    q: (
      <>
        <path d="m10 14 6 5 6-10 6 10 6-5-5 17H15zM12 34h20v4H12z" />
        <circle cx="10" cy="11" r="2.4" />
        <circle cx="22" cy="6" r="2.4" />
        <circle cx="34" cy="11" r="2.4" />
      </>
    ),
    k: (
      <>
        <path d="M19 4h6v4h4v4h-4v5h-6v-5h-4V8h4zM22 18c-6-7-15-1-10 7l4 6h12l4-6c5-8-4-14-10-7zM12 34h20v4H12z" />
      </>
    ),
  };
  return (
    <svg
      className={`os-piece ${color}`}
      viewBox="0 0 44 44"
      aria-hidden="true"
      fill={color === "w" ? "#fcf8ec" : "#243c33"}
      stroke={color === "w" ? "#30493e" : "#eef0dc"}
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      {shapes[type]}
    </svg>
  );
}
export function Board({
  game,
  side,
  selected,
  onSelect,
  hint,
  last,
  interactive = false,
  mini = false,
}: {
  game: Chess;
  side: Side;
  selected?: Square | null;
  onSelect?: (square: Square) => void;
  hint?: { from: Square; to: Square } | null;
  last?: { from: Square; to: Square } | null;
  interactive?: boolean;
  mini?: boolean;
}) {
  const files = side === "w" ? "abcdefgh" : "hgfedcba";
  const ranks =
    side === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const legal =
    selected && interactive
      ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
      : [];
  return (
    <div
      className={`os-board ${mini ? "mini" : ""}`}
      role={mini ? "img" : "group"}
      aria-label={`${side === "w" ? "White" : "Black"} perspective chessboard${game.isCheck() ? ", check" : ""}`}
    >
      {ranks.flatMap((rank, row) =>
        Array.from(files).map((file, col) => {
          const square = `${file}${rank}` as Square;
          const piece = game.get(square);
          const mark = hint?.from === square || hint?.to === square;
          const className = `os-square ${(row + col) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${mark ? "hint" : ""} ${last?.from === square || last?.to === square ? "last" : ""}`;
          const contents = (
            <>
              {!mini && col === 0 && <span className="rank">{rank}</span>}
              {!mini && row === 7 && <span className="file">{file}</span>}
              {piece && (
                <span
                  className="piece-wrap"
                  draggable={interactive && piece.color === side}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", square);
                    onSelect?.(square);
                  }}
                >
                  <Piece type={piece.type} color={piece.color} />
                </span>
              )}
              {legal.includes(square) && (
                <span className={`legal-dot ${piece ? "capture" : ""}`} />
              )}
            </>
          );
          return mini ? (
            <div key={square} className={className}>
              {contents}
            </div>
          ) : (
            <button
              key={square}
              className={className}
              aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${labels[piece.type]}` : " empty"}${mark ? " hint" : ""}`}
              aria-pressed={selected === square}
              disabled={!interactive}
              onClick={() => onSelect?.(square)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onSelect?.(square);
              }}
            >
              {contents}
            </button>
          );
        }),
      )}
    </div>
  );
}
