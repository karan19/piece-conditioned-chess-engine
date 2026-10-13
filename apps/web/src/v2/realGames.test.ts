import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import raw from "./data/real-games.json?raw";
import { openings, parseImportedPgn } from "./catalog";
import { branchContext, realGameReplies, openingBranch } from "./realGames";
import { decodeProgress, emptyProgress, recordKey, rememberStep, savedOpening } from "./progress";
import { exportGuidedGame, replayGame } from "./fullGame";
import { explainStep } from "./lessons";

const london = openings.find(line => line.family === "London System")!;
describe("real-game opening lessons", () => {
  it("uses actual sample counts and the full denominator rather than renormalizing visible replies", async () => {
    const game = new Chess(); game.move("d4");
    const position = await realGameReplies(game);
    expect(position.sample.games).toBe(116969);
    expect(position.key).toBe("d4");
    expect(position.total).toBeGreaterThan(10000);
    expect(position.replies[0].san).toBe("d5");
    expect(position.replies[0].percent).toBe(100 * position.replies[0].games / position.total);
    expect(position.replies.every((reply, i, replies) => !i || replies[i - 1].games >= reply.games)).toBe(true);
    expect(position.replies.reduce((n, reply) => n + reply.percent, 0)).toBeLessThanOrEqual(100);
    expect(position.sample.firstDate).toBe("2026.09.01");
  });
  it("validates every shipped sample position and move, including captures and castling", () => {
    const data = JSON.parse(raw) as { positions: Record<string, { n: number; m: [string, number, number, number][] }> };
    for (const [prefix, node] of Object.entries(data.positions)) {
      const game = new Chess();
      for (const san of prefix ? prefix.split(" ") : []) expect(game.move(san).san, prefix).toBe(san);
      expect(node.n, prefix).toBeGreaterThanOrEqual(20);
      expect(node.m.reduce((n, [, w, d, b]) => n + w + d + b, 0), prefix).toBeLessThanOrEqual(node.n);
      for (const [san, w, d, b] of node.m) {
        expect(w + d + b, prefix).toBeGreaterThanOrEqual(3);
        expect(new Chess(game.fen()).move(san).san, prefix).toBe(san);
      }
    }
  }, 60000);
  it("changes the opponent reply without retaining an incompatible future", () => {
    const branch = openingBranch(london, ["d4"], "d5");
    expect(branch.slice(0, 2)).toEqual(["d4", "d5"]);
    expect(branch[2]).toBe("Bf4");
    expect(branchContext(london, branch).family).toBe("London System");
    const gambit = openingBranch(london, ["d4"], "e5");
    expect(branchContext(london, gambit).name).toContain("Englund");
    expect(() => replayGame({ ...london, moves: branch })).not.toThrow();
    expect(explainStep({ ...london, moves: branch }, 1, "w")?.instruction).toContain("Your opponent plays d5");
    expect(() => openingBranch(london, ["d4"], "Ke4")).toThrow();
  });
  it("resumes and exports the chosen branch instead of the original variation", () => {
    const branch = openingBranch(london, ["d4"], "d5");
    let progress = rememberStep(emptyProgress(), london, "w", 2, 100, [], { bookMoves: branch, bookComplete: false });
    progress = decodeProgress(progress);
    const record = progress.records[recordKey(london, "w")];
    const effective = savedOpening(london, record);
    expect(record.bookMoves?.slice(0, 2)).toEqual(["d4", "d5"]);
    expect(record.lastPly).toBe(2);
    expect(replayGame(effective, [], 2).history()).toEqual(["d4", "d5"]);
    expect(exportGuidedGame(effective, [], 2)).toContain("1. d4 d5");
    expect(progress.records[recordKey(london, "b")]).toBeUndefined();
  });
  it("restores an engine result after a different opening branch and rejects a corrupt branch", () => {
    const original = parseImportedPgn("1. e4 c6", "Custom source");
    const branch = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"];
    let p = rememberStep(emptyProgress(), original, "w", 7, 100, ["Qxf7#"], { bookMoves: branch, bookComplete: true });
    p.custom = [original];
    p = decodeProgress(p);
    const record = p.records[recordKey(original, "w")];
    expect(record.result).toBe("Checkmate — White wins");
    expect(exportGuidedGame(savedOpening(original, record), record.continuation)).toContain('[Result "1-0"]');
    record.bookMoves = ["e4", "Ke4"];
    p = decodeProgress(p);
    expect(p.records[recordKey(original, "w")].bookMoves).toBeUndefined();
    expect(p.records[recordKey(original, "w")].continuation).toEqual([]);
  });
  it("returns no manufactured statistics for a sequence outside the sample", async () => {
    const game = new Chess();
    for (const san of ["a4", "h5", "Ra3", "Rh6", "Rg3", "Ra6"]) game.move(san);
    const position = await realGameReplies(game);
    expect(position.total).toBe(0);
    expect(position.replies).toEqual([]);
  });
});
