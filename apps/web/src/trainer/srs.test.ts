import { describe, expect, it } from "vitest";
import { applySrsResult, isDueToday, makeEmptyLineProgress, maxBox } from "./srs";

describe("Leitner box SRS", () => {
  it("starts undiscovered", () => {
    const p = makeEmptyLineProgress();
    expect(p.discovered).toBe(false);
    expect(isDueToday(p)).toBe(false);
  });

  it("advances box for correct answers", () => {
    let p = makeEmptyLineProgress();
    p = applySrsResult(p, true);
    expect(p.box).toBe(2);
    expect(p.discovered).toBe(true);
  });

  it("drops to box 1 on a wrong answer", () => {
    let p = makeEmptyLineProgress();
    p = applySrsResult(p, true);
    p = applySrsResult(p, true);
    expect(p.box).toBe(3);
    p = applySrsResult(p, false);
    expect(p.box).toBe(1);
    expect(p.bestStreak).toBe(0);
  });

  it("caps box at max", () => {
    let p = makeEmptyLineProgress();
    for (let i = 0; i < 20; i++) {
      p = applySrsResult(p, true);
    }
    expect(p.box).toBe(maxBox);
  });
});
