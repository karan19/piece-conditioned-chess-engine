import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { openings, parseImportedPgn } from "./catalog";
import {
  exportGuidedGame,
  gameResult,
  nextEngineMove,
  replayGame,
} from "./fullGame";
import {
  decodeProgress,
  emptyProgress,
  recordKey,
  rememberStep,
} from "./progress";
import { explainStep } from "./lessons";
const book = parseImportedPgn(
  "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6",
  "Mate demonstration",
);
describe("full guided games", () => {
  it("continues beyond the recorded opening to a real checkmate", async () => {
    const game = replayGame(book);
    expect(gameResult(game)).toBeNull();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ bestMove: "h5f7" }), { status: 200 }),
      );
    const move = await nextEngineMove(game, "w", undefined, fetcher);
    expect(move.san).toBe("Qxf7#");
    const complete = replayGame(book, [move.san]);
    expect(gameResult(complete)).toMatchObject({
      title: "Checkmate — White wins",
      result: "1-0",
    });
    const explanation = explainStep(
      { ...book, moves: [...book.moves, move.san] },
      6,
      "w",
    );
    expect(exportGuidedGame(book, [move.san])).toContain('[Result "1-0"]');
    expect(explanation?.facts).toContain("Delivers checkmate.");
    expect(explanation?.why).toContain("delivers checkmate");
    expect(
      explainStep({ ...book, moves: [...book.moves, move.san] }, 5, "w")?.why,
    ).toContain("allows Qxf7#");
    await expect(
      nextEngineMove(complete, "w", undefined, fetcher),
    ).rejects.toThrow("already has a result");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("chooses coach and opponent strengths using the actual side to move", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ bestMove: "h5f7" }), { status: 200 }),
      );
    await nextEngineMove(replayGame(book), "b", undefined, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).difficulty).toBe("medium");
  });
  it("detects stalemate, insufficient material and fifty-move draws instead of inventing checkmate", () => {
    expect(gameResult(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))?.title).toBe(
      "Draw — stalemate",
    );
    expect(gameResult(new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1"))?.title).toBe(
      "Draw — insufficient material",
    );
    expect(
      gameResult(new Chess("7k/8/8/8/8/8/R7/K7 w - - 100 60"))?.title,
    ).toBe("Draw — fifty-move rule");
  });
  it("preserves repetition history rather than rebuilding only the current FEN", () => {
    const opening = parseImportedPgn("1. Nf3 Nf6", "Repetition test");
    const game = replayGame(opening, [
      "Ng1",
      "Ng8",
      "Nf3",
      "Nf6",
      "Ng1",
      "Ng8",
    ]);
    expect(gameResult(game)?.title).toBe("Draw — threefold repetition");
  });
  it("persists and restores a full game beyond the old opening length", () => {
    const p = rememberStep(emptyProgress(), book, "w", 7, 100, ["Qxf7#"]);
    const restored = decodeProgress(JSON.parse(JSON.stringify(p)));
    const r = restored.records[recordKey(book, "w")];
    // Add the imported starting line to the backup so it can be fully validated.
    p.custom = [book];
    const checked = decodeProgress(JSON.parse(JSON.stringify(p)));
    expect(r.lastPly).toBe(7);
    expect(checked.records[recordKey(book, "w")].result).toBe(
      "Checkmate — White wins",
    );
    expect(
      replayGame(
        book,
        checked.records[recordKey(book, "w")].continuation,
      ).isCheckmate(),
    ).toBe(true);
  });
  it("does not mark an engine's unplayed mating suggestion as game completion", () => {
    let p = rememberStep(emptyProgress(), book, "w", 6, 100, ["Qxf7#"]);
    p.custom = [book];
    p = decodeProgress(p);
    expect(p.records[recordKey(book, "w")].result).toBeNull();
  });
  it("rejects illegal saved continuations and retains the original opening", () => {
    let p = rememberStep(emptyProgress(), book, "w", 6, 100);
    p.custom = [book];
    p.records[recordKey(book, "w")].continuation = ["Ke4"];
    p = decodeProgress(p);
    expect(p.records[recordKey(book, "w")].continuation).toEqual([]);
    expect(p.custom).toHaveLength(1);
    expect(() => replayGame(book, ["Qxf7#", "a6"])).toThrow("cannot continue");
  });
  it("handles API throttling and invalid responses without replacing the saved game", async () => {
    const game = replayGame(book);
    const before = game.fen();
    const busy = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", { status: 429, headers: { "Retry-After": "20" } }),
      );
    await expect(
      nextEngineMove(game, "w", undefined, busy),
    ).rejects.toMatchObject({ retryAfterMs: 20000 });
    const bad = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ bestMove: "e1e8" }), { status: 200 }),
      );
    await expect(nextEngineMove(game, "w", undefined, bad)).rejects.toThrow(
      "invalid move",
    );
    expect(game.fen()).toBe(before);
  });
  it("makes every catalog opening eligible for continued play without a fixed ply cutoff", () => {
    for (const opening of openings) {
      const game = replayGame(opening);
      if (!game.isGameOver())
        expect(game.moves().length, opening.name).toBeGreaterThan(0);
    }
  }, 60000);
});
