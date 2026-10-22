import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { families, gameAt } from "../v2/catalog";
import { endgames } from "../v2/endgames";
import { routeSlug } from "../routes";
export type Level = "beginner" | "intermediate" | "advanced";
export type Settings = { level: Level; seconds: number; side: Color };
export type Placement = { type: PieceSymbol; color: Color };
export type Pieces = Partial<Record<Square, Placement>>;
export type RecallPosition = { id: string; title: string; fen: string; pieces: Pieces; level: Level };
export const levels = [{ id: "beginner", label: "Small positions", detail: "3–6 pieces" }, { id: "intermediate", label: "More pieces", detail: "7–12 pieces" }, { id: "advanced", label: "Full positions", detail: "13+ pieces" }] as const;
export const times = [2, 5, 10, 20, 30];
export const defaults: Settings = { level: "beginner", seconds: 5, side: "w" };
export function piecesFromFen(fen: string): Pieces {
  const game = new Chess(fen);
  return Object.fromEntries(game.board().flatMap(row => row.flatMap(piece => piece ? [[piece.square, { type: piece.type, color: piece.color }]] : []))) as Pieces;
}
const seen = new Set<string>();
export const positions: RecallPosition[] = [
  ...endgames.map(p => ({ id: `endgame-${p.id}`, title: p.title, fen: p.fen })),
  ...families.map(f => ({ id: `opening-${routeSlug(f.name)}`, title: f.name, fen: gameAt(f.representative, Math.min(12, f.representative.moves.length)).fen() })),
].flatMap(p => {
  const key = p.fen.split(" ")[0];
  if (seen.has(key)) return [];
  seen.add(key);
  const pieces = piecesFromFen(p.fen), count = Object.keys(pieces).length;
  return [{ ...p, pieces, level: count <= 6 ? "beginner" : count <= 12 ? "intermediate" : "advanced" }];
});
export function settingsFromUrl(url: URL, saved: Settings = defaults): Settings {
  const p = url.searchParams;
  return { level: levels.some(l => l.id === p.get("level")) ? p.get("level") as Level : saved.level,
    seconds: times.includes(Number(p.get("seconds"))) ? Number(p.get("seconds")) : saved.seconds,
    side: p.get("side") === "black" ? "b" : p.get("side") === "white" ? "w" : saved.side };
}
export function queryFor(settings: Settings) { return new URLSearchParams({ level: settings.level, seconds: String(settings.seconds), side: settings.side === "w" ? "white" : "black" }); }
export function choosePosition(level: Level, exclude?: string, random = Math.random): RecallPosition {
  const choices = positions.filter(p => p.level === level && p.id !== exclude);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))];
}
export function scoreRecall(target: Pieces, placed: Pieces) {
  const squares = Array.from(new Set([...Object.keys(target), ...Object.keys(placed)])) as Square[];
  const correct = squares.filter(s => target[s] && placed[s] && target[s]!.type === placed[s]!.type && target[s]!.color === placed[s]!.color);
  const wrong = squares.filter(s => placed[s] && !correct.includes(s));
  const missing = squares.filter(s => target[s] && !correct.includes(s));
  const count = Object.keys(target).length, placedCount = Object.keys(placed).length;
  return { correct, wrong, missing, count, placedCount, percent: Math.round(100 * correct.length / Math.max(count, placedCount, 1)) };
}
export type Attempt = { id: string; positionId: string; percent: number; assisted: boolean; level: Level; seconds: number; at: number };
const recordKey = "pcce.board-recall.v1";
export function readRecords(): { settings: Settings; attempts: Attempt[] } {
  try {
    const value = JSON.parse(localStorage.getItem(recordKey) ?? "null");
    return { settings: settingsFromUrl(new URL(`https://chess.invalid/?${new URLSearchParams(value?.settings ?? {})}`)), attempts: Array.isArray(value?.attempts) ? value.attempts.filter((a: Attempt) => typeof a.id === "string" && Number.isFinite(a.percent) && a.percent >= 0 && a.percent <= 100).slice(0, 50) : [] };
  } catch { return { settings: defaults, attempts: [] }; }
}
export function saveRecords(settings: Settings, attempts: Attempt[]) {
  try { localStorage.setItem(recordKey, JSON.stringify({ settings: { ...settings, side: settings.side === "w" ? "white" : "black" }, attempts: attempts.slice(0, 50) })); return true; } catch { return false; }
}
export type Round = { phase: "ready" | "watch" | "rebuild" | "result"; deadline: number; pieces: Pieces; assisted: boolean; interrupted: boolean };
export function blankRound(assisted = false): Round { return { phase: "ready", deadline: 0, pieces: {}, assisted, interrupted: false }; }
export function loadRound(key: string, assisted = false): Round {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`pcce.recall.round:${key}`) ?? "null");
    if (!saved || !["ready", "watch", "rebuild", "result"].includes(saved.phase) || !Number.isFinite(saved.deadline) || !saved.pieces || Array.isArray(saved.pieces) || typeof saved.pieces !== "object") return blankRound(assisted);
    const pieces = Object.fromEntries(Object.entries(saved.pieces).filter(([square, p]) => /^[a-h][1-8]$/.test(square) && p && typeof p === "object" && ["w", "b"].includes((p as Placement).color) && ["p", "n", "b", "r", "q", "k"].includes((p as Placement).type))) as Pieces;
    return { phase: saved.phase === "watch" && saved.deadline <= Date.now() ? "rebuild" : saved.phase, deadline: saved.deadline, pieces, assisted: Boolean(saved.assisted) || assisted, interrupted: Boolean(saved.interrupted) };
  } catch { return blankRound(assisted); }
}
export function saveRound(key: string, round: Round) {
  try { sessionStorage.setItem(`pcce.recall.round:${key}`, JSON.stringify(round)); return true; } catch { return false; }
}
