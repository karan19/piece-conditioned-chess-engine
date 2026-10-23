import { ChessPiece } from "../ChessPiece";
import { BoardSurface } from "../BoardSurface";
import "./board.css";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import type { Side } from "./catalog";
import { getCheckThreat } from "../chessGame";
const labels: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  return <ChessPiece type={type} color={color} className="os-piece" />;
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
  const checkThreat = getCheckThreat(game);
  const attackers = new Set(checkThreat?.attackers.map((piece) => piece.square));
  return (
    <div
      className={`os-board chess-board ${mini ? "mini" : ""}`}
      role={mini ? "img" : "group"}
      aria-label={`${side === "w" ? "White" : "Black"} perspective chessboard${game.isCheck() ? ", check" : ""}`}
    >
      <BoardSurface side={side}>{ranks.flatMap((rank, row) =>
        Array.from(files).map((file, col) => {
          const square = `${file}${rank}` as Square;
          const piece = game.get(square);
          const mark = hint?.from === square || hint?.to === square;
          const className = `os-square ${(row + col) % 2 ? "dark" : "light"} ${selected === square ? "selected" : ""} ${mark ? "hint" : ""} ${checkThreat?.kingSquare === square ? "check-king" : ""} ${attackers.has(square) ? "check-attacker" : ""} ${last?.from === square || last?.to === square ? "last" : ""}`;
          const contents = (
            <>

              {piece && (
                <span
                  className={`piece-wrap os-classic-piece ${piece.color}`}
                  draggable={interactive && piece.color === side}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", square);
                    onSelect?.(square);
                  }}
                >
                  <ChessPiece type={piece.type} color={piece.color} />
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
      )}</BoardSurface>
    </div>
  );
}
