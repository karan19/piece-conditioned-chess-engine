import type { Color, PieceSymbol } from "chess.js";
import "./board-theme.css";
import wK from "./assets/chess-pieces/outlined/wK.svg";
import wQ from "./assets/chess-pieces/outlined/wQ.svg";
import wR from "./assets/chess-pieces/outlined/wR.svg";
import wB from "./assets/chess-pieces/outlined/wB.svg";
import wN from "./assets/chess-pieces/outlined/wN.svg";
import wP from "./assets/chess-pieces/outlined/wP.svg";
import bK from "./assets/chess-pieces/outlined/bK.svg";
import bQ from "./assets/chess-pieces/outlined/bQ.svg";
import bR from "./assets/chess-pieces/outlined/bR.svg";
import bB from "./assets/chess-pieces/outlined/bB.svg";
import bN from "./assets/chess-pieces/outlined/bN.svg";
import bP from "./assets/chess-pieces/outlined/bP.svg";
const images: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: wK, q: wQ, r: wR, b: wB, n: wN, p: wP },
  b: { k: bK, q: bQ, r: bR, b: bB, n: bN, p: bP },
};
/** Decorative artwork; the containing square/control supplies its accessible name. */
export function ChessPiece({ type, color, className = "" }: { type: PieceSymbol; color: Color; className?: string }) {
  return <img className={`chess-piece-image ${className}`} src={images[color][type]} alt="" aria-hidden="true" draggable={false} />;
}
