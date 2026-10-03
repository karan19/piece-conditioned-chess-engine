import { describe, expect, it } from "vitest";
import { difficultyConfigs, isDifficulty } from "./difficulty.js";

describe("difficulty configs", () => {
  it("orders difficulty by increasing Stockfish strength", () => {
    expect(difficultyConfigs.easy.skillLevel).toBeLessThan(
      difficultyConfigs.medium.skillLevel
    );
    expect(difficultyConfigs.medium.skillLevel).toBeLessThan(
      difficultyConfigs.hard.skillLevel
    );
    expect(difficultyConfigs.hard.skillLevel).toBeLessThan(
      difficultyConfigs.expert.skillLevel
    );
  });

  it("validates known difficulty ids", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("expert")).toBe(true);
    expect(isDifficulty("beginner")).toBe(false);
  });
});
