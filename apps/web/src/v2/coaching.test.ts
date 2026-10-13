import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { families, parseImportedPgn } from "./catalog";
import { explainStep } from "./lessons";
import { positionGuidance } from "./coaching";

describe("Learn coach", () => {
  it("teaches London's bishop purpose, counterplay and flexible development before the move", () => {
    const opening = parseImportedPgn("1. d4 d5 2. Bf4", "London System");
    const step = explainStep(opening, 2, "w")!;
    expect(step.instruction).toContain("from c1 to f4");
    expect(step.why).toContain("before e3");
    expect(step.why).toContain("controls e5");
    expect(step.why).toContain("queen to b6");
    expect(step.opponentPlan).toContain("pressure on d4 and b2");
    expect(step.watch.join(" ")).toContain("king");
  });
  it("explains the Caro-Kann central challenge and the different White responses", () => {
    const opening = parseImportedPgn("1. e4 c6 2. d4 d5 3. e5 Bf5", "Caro-Kann Defense");
    const step = explainStep(opening, 3, "b")!;
    expect(step.why).toContain("c6 pawn supports d5");
    expect(step.why).toContain("advance e5, exchange on d5");
    expect(step.opponentPlan).toContain("White occupies d4 and e4");
    expect(step.followUp).toContain("3. e5 → 3... Bf5");
  });
  it("detects the actual queen attack and shows White's plan when learning Black", () => {
    const opening = parseImportedPgn("1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5", "Scandinavian Defense");
    const step = explainStep(opening, 5, "b")!;
    expect(step.watch.join(" ")).toContain("queen on d5");
    expect(step.opponentPlan).toContain("knight on c3 attacks your queen on d5");
    expect(step.why).toContain("was attacked by knight on c3");
    expect(step.followUp).toBeNull();
  });
  it("distinguishes an actual recapture from a capture and identifies an open rook file", () => {
    const opening = parseImportedPgn("1. e4 d5 2. exd5 Qxd5", "Custom exchange");
    expect(explainStep(opening, 3, "b")?.why).toContain("recaptures on d5");
    expect(explainStep(opening, 2, "w")?.why).not.toContain("recaptures");
    const rook = parseImportedPgn("1. e4 e5 2. f4 exf4 3. Nf3 d5 4. exd5 Qxd5 5. Nc3 Qe6+ 6. Be2 Nc6 7. O-O Bd7 8. d4 O-O-O 9. Bxf4 Nf6 10. Re1", "Open e-file");
    expect(explainStep(rook, 18, "w")?.why).toContain("open e-file");
  });
  it("explains fianchetto purpose and its actual first blocker in any opening", () => {
    const london = parseImportedPgn("1. d4 Nf6 2. Nf3 g6 3. Bf4 Bg7", "London System");
    const step = explainStep(london, 5, "w")!;
    expect(step.why).toContain("fianchetto square on g7");
    expect(step.why).toContain("long h8–a1 diagonal");
    expect(step.why).toContain("Black's knight on f6");
    const queenside = parseImportedPgn("1. b3 d5 2. Bb2", "Custom flank opening");
    expect(explainStep(queenside, 2, "w")?.why).toContain("long h8–a1 diagonal");
    const blackQueenside = parseImportedPgn("1. a4 b6 2. a5 Bb7", "Custom flank opening");
    expect(explainStep(blackQueenside, 3, "b")?.why).toContain("long a8–h1 diagonal");
  });
  it("prioritizes check and gives no continuing opponent plan after mate", () => {
    const game = new Chess();
    for (const san of ["f3", "e5", "g4", "Qh4#"]) game.move(san);
    expect(positionGuidance(game, "w", "Develop").opponentPlan).toContain("no legal reply");
    const line = parseImportedPgn("1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#", "Mate example");
    const step = explainStep(line, 6, "w")!;
    expect(step.why).toContain("no legal king move");
    expect(step.followUp).toBeNull();
  });
  it("supplies concrete Learn guidance in both perspectives across every opening family", () => {
    for (const family of families) {
      const opening = family.lines.at(-1)!;
      for (const side of ["w", "b"] as const) {
        const step = explainStep(opening, opening.moves.length - 1, side)!;
        expect(step.instruction, opening.name).toContain(step.move.san);
        expect(step.why.length, opening.name).toBeGreaterThan(70);
        expect(step.opponentPlan.length, opening.name).toBeGreaterThan(40);
        expect(step.watch.length, opening.name).toBeGreaterThan(0);
        expect(step.watch.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
