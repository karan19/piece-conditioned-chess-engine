import { Chess } from "chess.js";
import a from "./data/a.tsv?raw";
import b from "./data/b.tsv?raw";
import c from "./data/c.tsv?raw";
import d from "./data/d.tsv?raw";
import e from "./data/e.tsv?raw";

export type Side = "w" | "b";
export type Opening = {
  id: string;
  eco: string;
  name: string;
  family: string;
  pgn: string;
  moves: string[];
};
export type Family = {
  name: string;
  lines: Opening[];
  representative: Opening;
  category: string;
};
export const datasetRevision = "a6189a30dc273ccb21fc2536a9a2fefd5592a67a";
export const openings: Opening[] = [a, b, c, d, e].flatMap((text) =>
  text
    .trim()
    .split("\n")
    .slice(1)
    .map((row) => {
      const [eco, name, pgn] = row.split("\t");
      return {
        id: `${eco}:${name}:${pgn}`,
        eco,
        name,
        family: name.split(":")[0],
        pgn,
        moves: pgn
          .replace(/\d+\.(\.\.)?/g, "")
          .trim()
          .split(/\s+/),
      };
    }),
);
const grouped = new Map<string, Opening[]>();
for (const opening of openings)
  grouped.set(opening.family, [
    ...(grouped.get(opening.family) ?? []),
    opening,
  ]);
export const families: Family[] = Array.from(grouped, ([name, lines]) => {
  lines.sort(
    (a, b) => a.moves.length - b.moves.length || a.name.localeCompare(b.name),
  );
  return {
    name,
    lines,
    representative: lines[0],
    category: /Gambit/i.test(name)
      ? "Gambit"
      : /Defense|Defence/i.test(name)
        ? "Defense"
        : /Attack/i.test(name)
          ? "Attack"
          : "Opening",
  };
}).sort((a, b) => a.name.localeCompare(b.name));
export const popularNames = [
  "Sicilian Defense",
  "Italian Game",
  "London System",
  "Queen's Pawn Game",
  "Caro-Kann Defense",
  "Ruy Lopez",
  "French Defense",
  "English Opening",
  "King's Indian Defense",
  "Scotch Game",
  "Vienna Game",
  "Queen's Gambit Declined",
  "Scandinavian Defense",
];
export const featured = popularNames
  .map((name) => families.find((f) => f.name === name))
  .filter((f): f is Family => Boolean(f));
export function gameAt(opening: Opening, ply: number) {
  const game = new Chess();
  for (const move of opening.moves.slice(0, ply)) game.move(move);
  return game;
}
export function parseImportedPgn(pgn: string, title: string): Opening {
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history();
  if (!moves.length)
    throw new Error("Add a PGN containing at least one legal move.");
  if (moves.length > 160)
    throw new Error(
      "Opening lines can contain up to 160 plies. Trim longer games before importing.",
    );
  const clean = new Chess();
  try {
    for (const move of moves) clean.move(move);
  } catch {
    throw new Error("Import a line starting from the standard chess position.");
  }
  const name =
    title.trim() ||
    game.getHeaders().Opening ||
    game.getHeaders().Event ||
    "My opening line";
  return {
    id: `custom:${name}:${moves.join(" ")}`,
    eco: "PGN",
    name,
    family: name,
    pgn: clean.pgn(),
    moves,
  };
}
export const familyNotes: Record<string, string> = {
  "Sicilian Defense":
    "Meet 1.e4 with an asymmetrical pawn structure. Explore the Najdorf, Dragon, Sveshnikov, and the many ways White can respond.",
  "Italian Game":
    "Develop naturally, aim your bishop at f7, and learn when to build the center or open it with d4.",
  "Queen's Pawn Game":
    "Start with 1.d4 and explore systems including the London and its related setups. Search the variations to find a specific system.",
  "Caro-Kann Defense":
    "Support a central ...d5 with ...c6. Discover the Advance, Exchange, and Classical pawn structures.",
  "Ruy Lopez":
    "Pressure the knight defending e5. Build an understanding of the central tension and the bishop's long-term role.",
  "French Defense":
    "Challenge e4 with ...e6 and ...d5. Learn the locked center, pawn breaks, and different approaches to developing Black's pieces.",
  "English Opening":
    "Begin with 1.c4, control d5, and explore flexible setups that often transpose into queen's pawn openings.",
  "King's Indian Defense":
    "Develop behind a kingside fianchetto, then challenge White's center with ...e5 or ...c5.",
};
export function description(family: Family) {
  return (
    familyNotes[family.name] ??
    `Explore ${family.lines.length.toLocaleString()} named ${family.lines.length === 1 ? "line" : "variations"} of the ${family.name}. Follow each move on the board, understand why each move is played.`
  );
}
