import { Chess, type Move, type Square } from "chess.js";
import raw from "./data/endgames.json?raw";
import type { Side } from "./catalog";
import { movePurpose } from "./coaching";
import { nextEngineMove } from "./fullGame";

export type EndgameType = "pawn" | "rook" | "bishop" | "knight" | "queen";
export type EndgamePosition = {
  id: string; fen: string; sourceFen?: string; side: Side; type: EndgameType;
  difficulty: "easy" | "medium" | "hard"; rating: number | null;
  goal: "win" | "draw"; title: string; solution: string[]; themes: string[];
  source: "lichess-puzzle" | "tablebase-exercise"; sourceUrl: string; gameUrl?: string;
  setup?: string; verified?: { category: string; date: string };
};
export const endgames: EndgamePosition[] = (JSON.parse(raw) as { positions: EndgamePosition[] }).positions;
export const endgameTypes: EndgameType[] = ["pawn", "rook", "bishop", "knight", "queen"];
export const endgamePlans: Record<EndgameType, string> = {
  pawn: "Bring your king into the fight, count pawn races, and watch opposition and spare pawn moves. A king move can change who must give way; calculate before pushing a pawn that cannot move backward.",
  rook: "Keep the rook active, use checks to gain time, and coordinate it with the king and passed pawns. A passive rook can lose its defensive job; look for checking distance and opportunities to attack pawns from behind or the side.",
  bishop: "Track the colors of the bishops and promotion squares. Use your king to support the pawns and avoid blocking your bishop with your own pawn chain. Opposite-colored bishops can make defense possible even with less material.",
  knight: "Count the knight's jumps and watch forks of kings, pieces and pawns. Keep your king active and calculate pawn races carefully: a knight may struggle to catch a distant passed pawn.",
  queen: "Inspect checks and queen exchanges before every move. King safety and perpetual-check possibilities matter as much as material; do not exchange queens without evaluating the pawn ending that remains.",
};
export function replayEndgame(position: EndgamePosition, moves: string[] = []) {
  const game = new Chess(position.fen);
  for (const san of moves) {
    if (game.isGameOver()) throw new Error("This endgame already ended.");
    if (game.move(san).san !== san) throw new Error("Saved endgame contains a noncanonical move.");
  }
  return game;
}
export function tablebaseEligible(game: Chess) {
  return game.board().flat().filter(Boolean).length <= 7 && game.fen().split(" ")[2] === "-";
}
export type TablebasePosition = { category: string; moves: { uci: string; san: string }[] };
const tableCache = new Map<string, TablebasePosition>();
export async function probeTablebase(game: Chess, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<TablebasePosition | null> {
  if (!tablebaseEligible(game) || game.isGameOver()) return null;
  const fen = game.fen();
  if (tableCache.has(fen)) return tableCache.get(fen)!;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 10000);
  try {
    const response = await fetcher(`https://tablebase.lichess.ovh/standard?${new URLSearchParams({ fen })}`, { signal: controller.signal });
    if (!response.ok) throw new Error("Tablebase unavailable");
    const body = await response.json();
    if (!["win", "loss", "draw", "cursed-win", "blessed-loss"].includes(body.category) || !Array.isArray(body.moves)) return null;
    const moves = body.moves.flatMap((m: { uci?: unknown }) => {
      if (typeof m.uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci)) return [];
      try {
        const move = new Chess(fen).move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
        return [{ uci: m.uci, san: move.san }];
      } catch { return []; }
    });
    if (!moves.length) return null;
    const result = { category: body.category as string, moves };
    if (tableCache.size > 500) tableCache.clear();
    tableCache.set(fen, result);
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
export function tablebaseLabel(game: Chess, table: TablebasePosition) {
  if (table.category === "draw") return "Draw with optimal play.";
  if (table.category === "cursed-win" || table.category === "blessed-loss") return "The fifty-move rule makes this position drawable despite its result without that rule.";
  const winner = table.category === "win" ? game.turn() : game.turn() === "w" ? "b" : "w";
  return `${winner === "w" ? "White" : "Black"} can force a win with optimal play.`;
}
export async function chooseEndgameMove(game: Chess, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  let table: TablebasePosition | null = null;
  let tableUnavailable = false;
  try { table = await probeTablebase(game, signal, fetcher); }
  catch (error) { if (signal?.aborted) throw error; tableUnavailable = true; }
  if (table) {
    const move = new Chess(game.fen()).move(table.moves[0].san);
    return { move, source: "Tablebase" as const, table, tableUnavailable };
  }
  // Endgame defense uses expert strength independently of puzzle difficulty.
  const move = await nextEngineMove(game, game.turn(), signal, fetcher);
  return { move, source: "Stockfish" as const, table, tableUnavailable };
}
export function puzzleHint(position: EndgamePosition, moves: string[]): Move | null {
  if (!position.solution[moves.length] || !moves.every((san, i) => san === position.solution[i])) return null;
  return new Chess(replayEndgame(position, moves).fen()).move(position.solution[moves.length]);
}
export type EndgameRecords = Record<string, { moves: string[]; last: number }>;
const storageKey = "pcce-endgame-practice-v2";
export function decodeEndgameRecords(value: unknown): EndgameRecords {
  const records: EndgameRecords = {};
  if (!value || typeof value !== "object") return records;
  for (const [id, record] of Object.entries(value)) {
    const position = endgames.find(p => p.id === id);
    const r = record as { moves?: unknown; last?: unknown };
    if (!position || !r || !Array.isArray(r.moves) || r.moves.length > 10000 || !r.moves.every(m => typeof m === "string") || !Number.isFinite(r.last)) continue;
    try { replayEndgame(position, r.moves); records[id] = { moves: r.moves, last: Number(r.last) }; } catch { /* Retain other valid sessions. */ }
  }
  return records;
}
export function loadEndgameRecords() {
  try { return decodeEndgameRecords(JSON.parse(localStorage.getItem(storageKey) ?? "null")); } catch { return {}; }
}
export function saveEndgameRecords(records: EndgameRecords) {
  try { localStorage.setItem(storageKey, JSON.stringify(records)); return true; } catch { return false; }
}

export function explainEndgameMove(before: Chess, after: Chess, move: Move) {
  const notes = [movePurpose(before, after, move)];
  if (move.piece === "p" && !move.promotion) {
    const file = "abcdefgh".indexOf(move.to[0]);
    const rank = Number(move.to[1]);
    const direction = move.color === "w" ? 1 : -1;
    const attacks = [-1, 1].flatMap(offset => {
      const f = file + offset, r = rank + direction;
      return f >= 0 && f < 8 && r >= 1 && r <= 8 ? [`${"abcdefgh"[f]}${r}`] : [];
    });
    if (attacks.length) notes.push(`The pawn now controls ${attacks.join(" and ")}. Those squares matter when the opponent chooses a king route or a pawn advance.`);
    const forward = `${move.to[0]}${rank + direction}` as Square;
    const blocker = after.get(forward);
    if (blocker?.type === "p" && blocker.color !== move.color)
      notes.push(`The opposing pawn on ${forward} blocks a further straight advance, and the two pawns block each other. With fewer spare pawn moves on this file, king moves and opposition can become important; look for useful moves elsewhere rather than assuming this pawn can keep pushing.`);
    const enemyAhead = after.board().flat().some(p => p && p.type === "p" && p.color !== move.color && Math.abs("abcdefgh".indexOf(p.square[0]) - file) <= 1 && (Number(p.square[1]) - rank) * direction > 0);
    if (!enemyAhead) notes.push("No opposing pawn lies ahead on this file or either neighboring file: this is a passed pawn. Coordinate its advance with your king or pieces; enemy pieces can still stop it from promoting.");
  }
  if (move.piece === "k" && after.board().flat().every(p => !p || p.type === "k" || p.type === "p")) {
    const kings = after.board().flat().filter(p => p?.type === "k");
    const a = kings[0]!.square, b = kings[1]!.square;
    const f1 = "abcdefgh".indexOf(a[0]), f2 = "abcdefgh".indexOf(b[0]);
    const r1 = Number(a[1]), r2 = Number(b[1]);
    if ((f1 === f2 && Math.abs(r1 - r2) === 2) || (r1 === r2 && Math.abs(f1 - f2) === 2)) {
      const between = `${"abcdefgh"[(f1 + f2) / 2]}${(r1 + r2) / 2}` as Square;
      if (!after.get(between)) notes.push("The kings face each other across one empty square: direct opposition. The side to move must consider available pawn moves before deciding which king square to give up.");
    }
  }
  if (after.isInsufficientMaterial()) notes.push("The remaining material cannot deliver checkmate. This is a drawn result, so an exchange that reaches it can be useful when your objective is to defend.");
  return notes.join(" ");
}
