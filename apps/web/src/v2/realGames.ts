import { Chess } from "chess.js";
import { openings, type Opening } from "./catalog";

export type RealReply = {
  san: string;
  games: number;
  percent: number;
  white: number;
  draws: number;
  black: number;
};
export type GameSample = {
  source: string;
  games: number;
  firstDate: string;
  lastDate: string;
  filters: string;
  sampling: string;
  maxPlies: number;
  minimumGames: number;
};
type BookData = {
  metadata: GameSample;
  positions: Record<string, { n: number; m: [string, number, number, number][] }>;
};
export type RealGamePosition = {
  key: string;
  total: number;
  replies: RealReply[];
  sample: GameSample;
};
let book: Promise<BookData> | undefined;
function loadBook() {
  return book ??= import("./data/real-games.json?raw").then(module => JSON.parse(module.default) as BookData).catch(error => {
    book = undefined;
    throw error;
  });
}
/** Statistics are for this exact SAN history, not combined transpositions. */
export async function realGameReplies(game: Chess): Promise<RealGamePosition> {
  const data = await loadBook();
  const key = game.history().join(" ");
  const node = data.positions[key];
  return {
    key,
    total: node?.n ?? 0,
    sample: data.metadata,
    replies: (node?.m ?? []).flatMap(([san, white, draws, black]) => {
      try {
        // Validate every displayed move against this board, even for damaged data.
        if (new Chess(game.fen()).move(san).san !== san) return [];
        const games = white + draws + black;
        return [{ san, white, draws, black, games, percent: 100 * games / node!.n }];
      } catch { return []; }
    }),
  };
}
export function openingBranch(opening: Opening, prefix: string[], san: string): string[] {
  const game = new Chess();
  for (const move of prefix) game.move(move);
  const canonical = game.move(san).san;
  const played = [...prefix, canonical];
  const matches = openings.filter(line => played.every((move, i) => line.moves[i] === move));
  matches.sort((a, b) => {
    const same = (line: Opening) => line.family === opening.family || line.name.includes(opening.family);
    return Number(same(b)) - Number(same(a)) || a.moves.length - b.moves.length || a.name.localeCompare(b.name);
  });
  return matches[0]?.moves.slice() ?? played;
}

/** Keep the selected course identity, but teach a different opening if the opponent branches away. */
export function branchContext(opening: Opening, moves: string[]): Opening {
  const named = openings.filter(line => line.moves.length >= 2 && line.moves.every((san, i) => moves[i] === san));
  if (named.some(line => line.family === opening.family || line.name.includes(opening.family))) return opening;
  named.sort((a, b) => b.moves.length - a.moves.length || a.name.localeCompare(b.name));
  return named[0] ?? opening;
}
