import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { families, openings, gameAt, parseImportedPgn } from "./catalog";
describe("complete opening catalog", () => {
  it("covers all 500 ECO codes and retains every supplied named line", () => {
    expect(openings).toHaveLength(3865);
    expect(new Set(openings.map((o) => o.eco)).size).toBe(500);
    expect(new Set(openings.map((o) => o.id)).size).toBe(openings.length);
    expect(families.flatMap((f) => f.lines)).toHaveLength(openings.length);
    for (const name of [
      "London System",
      "Sicilian Defense",
      "Caro-Kann Defense",
      "French Defense",
      "Italian Game",
      "Ruy Lopez",
      "King's Indian Defense",
    ]) {
      expect(families.some((f) => f.name === name)).toBe(true);
    }
  });
  it("replays every line legally from the initial position", () => {
    for (const opening of openings) {
      const game = new Chess();
      for (const san of opening.moves) {
        expect(game.move(san).san, opening.name).toBe(san);
      }
      expect(gameAt(opening, opening.moves.length).fen()).toBe(game.fen());
    }
  }, 60000);
  it("accepts headers and castling in PGN, rejects illegal lines and custom starting positions", () => {
    const line = parseImportedPgn(
      '[Event "My Italian"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O *',
      "",
    );
    expect(line.name).toBe("My Italian");
    expect(line.moves.at(-1)).toBe("O-O");
    expect(() => parseImportedPgn("1. e4 e5 2. Ke4", "")).toThrow();
    expect(() => parseImportedPgn("", "")).toThrow();
    expect(() =>
      parseImportedPgn(
        '[SetUp "1"]\n[FEN "8/8/8/8/8/8/4k3/7K w - - 0 1"]\n\n1. Kh2 *',
        "",
      ),
    ).toThrow();
  });
});
