import { describe, expect, it } from "vitest";
import { difficultyOptions, getColorName, getOpponentColor } from "./gameSettings";

describe("game settings", () => {
  it("has the v1 difficulty choices", () => {
    expect(difficultyOptions.map((option) => option.id)).toEqual([
      "easy",
      "medium",
      "hard",
      "expert"
    ]);
  });

  it("labels colors", () => {
    expect(getColorName("w")).toBe("White");
    expect(getOpponentColor("w")).toBe("b");
  });
});
