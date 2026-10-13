import { describe, expect, it } from "vitest";
import { openings, parseImportedPgn } from "./catalog";
import { explainStep, openingPlan } from "./lessons";
const scandi = {
  ...parseImportedPgn(
    "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5",
    "Scandinavian Defense",
  ),
  family: "Scandinavian Defense",
};
describe("guided explanations", () => {
  it("explains Scandinavian pawn exchange, queen exposure, and developing with tempo", () => {
    expect(explainStep(scandi, 1, "b")?.why).toContain("attacks the e4 pawn");
    expect(explainStep(scandi, 3, "b")?.why).toContain("early queen exposure");
    const step = explainStep(scandi, 4, "w")!;
    expect(step.why).toContain("develops a knight and attacks the queen");
    expect(step.facts).toContain("Attacks the opponent's queen on d5.");
    expect(step.instruction).toContain("You play Nc3");
    expect(explainStep(scandi, 4, "b")?.instruction).toContain(
      "Your opponent plays Nc3",
    );
    expect(explainStep(scandi, 6, "w")).toBeNull();
  });
  it("explains castling and both pieces' purpose", () => {
    const o = parseImportedPgn(
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O",
      "My line",
    );
    expect(explainStep(o, 6, "w")?.why).toContain("king and rook");
  });
  it("provides board-grounded explanations and a side plan for every catalog line", () => {
    for (const o of openings) {
      const step = explainStep(o, o.moves.length - 1, "b")!;
      expect(step.why.length, o.name).toBeGreaterThan(30);
      expect(step.move.san).toBe(o.moves.at(-1));
      expect(step.facts.length).toBeGreaterThan(0);
      expect(openingPlan(o, "w").white.length).toBeGreaterThan(30);
    }
  }, 60000);
});
