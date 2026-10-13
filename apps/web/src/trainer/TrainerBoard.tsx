import { files, ranks, pieceGlyphs, type BoardPiece } from "../chessGame";
import type { Square } from "chess.js";

export type TrainerBoardProps = {
  pieces: BoardPiece[];
  flipped?: boolean;
  selectedSquare?: Square | null;
  legalDestinations?: Square[];
  onSquareClick?: (square: Square) => void;
  highlight?: { from?: Square; to?: Square };
  statusLabel?: string;
};

export function TrainerBoard({
  pieces,
  flipped = false,
  selectedSquare = null,
  legalDestinations = [],
  onSquareClick,
  highlight,
  statusLabel
}: TrainerBoardProps) {
  const piecesBySquare = new Map(pieces.map((p) => [p.square, p]));
  const legalSet = new Set(legalDestinations);
  const viewFiles = flipped ? [...files].reverse() : [...files];
  const viewRanks = flipped ? [...ranks].reverse() : [...ranks];

  return (
    <div className="board-frame piece-style-classic trainer-board-frame">
      {viewRanks.map((rank) =>
        viewFiles.map((file) => {
          const square = `${file}${rank}` as Square;
          const piece = piecesBySquare.get(square);
          const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
          const isSelected = selectedSquare === square;
          const isLegal = legalSet.has(square);
          const highlightMatch = !!highlight && (highlight.from === square || highlight.to === square);

          return (
            <button
              className={[
                "board-square",
                isLight ? "light-square" : "dark-square",
                isSelected ? "selected-square" : "",
                isLegal ? "legal-destination" : "",
                highlightMatch ? "trainer-highlight-square" : ""
              ].join(" ")}
              key={square}
              type="button"
              aria-label={piece ? `${square}, ${piece.color === "w" ? "white" : "black"} ${piece.type}` : `${square}, empty`}
              onClick={() => onSquareClick?.(square)}
            >
              <span className="square-coordinate">{square}</span>
              {piece ? <span className={`piece piece-${piece.color}`}>{pieceGlyphs[piece.color][piece.type]}</span> : null}
            </button>
          );
        })
      )}
      {statusLabel ? <div className="trainer-status-bar">{statusLabel}</div> : null}
    </div>
  );
}
