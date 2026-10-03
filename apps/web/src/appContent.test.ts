import { describe, expect, it } from "vitest";
import { homeActions, productHighlights } from "./appContent";

describe("home app content", () => {
  it("contains the two v1 entry points", () => {
    expect(homeActions.map((action) => action.label)).toEqual([
      "Start Game",
      "Learning Journal"
    ]);
  });

  it("lists product highlights", () => {
    expect(productHighlights).toContain("Piece-conditioned Stockfish analysis");
  });
});
