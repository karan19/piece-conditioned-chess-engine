import type { ReactNode } from "react";
import type { Color } from "chess.js";
import "./board-theme.css";
/** Axes follow the displayed perspective without adding 64 repeated labels. */
export function BoardSurface({ side = "w", children }: { side?: Color; children: ReactNode }) {
  const files = side === "w" ? "abcdefgh" : "hgfedcba";
  const ranks = side === "w" ? "87654321" : "12345678";
  return <>
    <div className="chess-rank-axis" aria-hidden="true">{Array.from(ranks, rank => <span key={rank}>{rank}</span>)}</div>
    <div className="chess-grid">{children}</div>
    <div className="chess-file-axis" aria-hidden="true">{Array.from(files, file => <span key={file}>{file}</span>)}</div>
  </>;
}
