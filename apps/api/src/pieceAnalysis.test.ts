import { describe, expect, it, vi } from "vitest";
import { analyzeSelectedPiece } from "./pieceAnalysis.js";

vi.mock("./stockfishEngine.js", () => ({
  evaluatePosition: vi.fn(async ({ fen }: { fen: string }) => ({
    cp: fen.includes(" b ") ? -100 : 100,
    mate: null,
    depth: 10,
    bestMove: "a7a6"
  }))
}));

describe("analyzeSelectedPiece", () => {
  it("returns ranked candidate moves for only the selected square", async () => {
    const result = await analyzeSelectedPiece({
      fen: "8/8/8/8/8/8/4P3/4K2k w - - 0 1",
      selectedSquare: "e2",
      candidateCount: 4,
      replyCount: 2
    });

    expect(result.selectedPiece).toMatchObject({
      type: "p",
      color: "w",
      square: "e2"
    });
    expect(result.candidates.map((candidate) => candidate.move.from)).toEqual(["e2", "e2"]);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.opponentReplies).toHaveLength(2);
    expect(result.candidates[0]?.opponentReplies.every((reply) => reply.move.from !== "e2")).toBe(true);
  });

  it("adds deterministic evidence for candidate moves", async () => {
    const result = await analyzeSelectedPiece({
      fen: "7k/8/8/8/8/8/r7/R6K w - - 0 1",
      selectedSquare: "a1",
      candidateCount: 6,
      replyCount: 0
    });
    const capture = result.candidates.find((candidate) => candidate.move.san.startsWith("Rxa2"));

    expect(capture?.evidence).toMatchObject({
      capturedPiece: "r",
      materialDelta: 5
    });
    expect(capture?.move.piece).toBe("r");
    expect(capture?.evidence.summary).toContain("captures Black's rook");
    expect(capture?.opponentReplies).toHaveLength(0);
  });

  it("clamps requested candidate and reply counts", async () => {
    const result = await analyzeSelectedPiece({
      fen: "8/8/8/8/8/8/4P3/4K2k w - - 0 1",
      selectedSquare: "e2",
      candidateCount: 99,
      replyCount: 99
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.opponentReplies.length).toBeLessThanOrEqual(3);
  });

  it("supports zero candidate count for defensive callers", async () => {
    const result = await analyzeSelectedPiece({
      fen: "8/8/8/8/8/8/4P3/4K2k w - - 0 1",
      selectedSquare: "e2",
      candidateCount: -2
    });

    expect(result.candidates).toEqual([]);
  });

  it("rejects a selected opponent piece", async () => {
    await expect(
      analyzeSelectedPiece({
        fen: "8/8/8/8/8/8/4p3/4K2k w - - 0 1",
        selectedSquare: "e2"
      })
    ).rejects.toThrow("side to move");
  });
});
