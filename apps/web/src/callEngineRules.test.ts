import { describe, expect, it } from "vitest";
import { getCallEngineState } from "./callEngineRules";

const selectedPiece = {
  piece: {
    square: "e4",
    type: "p",
    color: "w"
  },
  legalMoveCount: 2
} as const;

describe("getCallEngineState", () => {
  it("locks before both sides complete three moves", () => {
    expect(
      getCallEngineState({
        plyCount: 5,
        isHumanTurn: true,
        selectedPiece,
        playerColor: "w",
        consumedPly: null,
        engineIsThinking: false,
        gameIsOver: false
      })
    ).toMatchObject({
      unlocked: false,
      available: false
    });
  });

  it("is available for a selected user piece after unlock", () => {
    expect(
      getCallEngineState({
        plyCount: 6,
        isHumanTurn: true,
        selectedPiece,
        playerColor: "w",
        consumedPly: null,
        engineIsThinking: false,
        gameIsOver: false
      })
    ).toMatchObject({
      unlocked: true,
      available: true
    });
  });

  it("blocks a second successful call on the same turn", () => {
    expect(
      getCallEngineState({
        plyCount: 8,
        isHumanTurn: true,
        selectedPiece,
        playerColor: "w",
        consumedPly: 8,
        engineIsThinking: false,
        gameIsOver: false
      }).reason
    ).toContain("already been used");
  });

  it("blocks pieces with no legal moves", () => {
    expect(
      getCallEngineState({
        plyCount: 6,
        isHumanTurn: true,
        selectedPiece: {
          ...selectedPiece,
          legalMoveCount: 0
        },
        playerColor: "w",
        consumedPly: null,
        engineIsThinking: false,
        gameIsOver: false
      }).reason
    ).toContain("no legal moves");
  });
});
