import { describe, expect, it } from "vitest";
import {
  cloneGameWithMove,
  createGame,
  describeCheckThreat,
  getCheckThreat,
  getGameStatus,
  getLegalDestinations,
  getMoveHistoryRows,
  isPromotionMove
} from "./chessGame";

describe("chess game helpers", () => {
  it("returns legal destinations for the starting knight", () => {
    const game = createGame();

    expect(getLegalDestinations(game, "g1").sort()).toEqual(["f3", "h3"]);
  });

  it("rejects illegal moves when cloning", () => {
    const game = createGame();

    expect(cloneGameWithMove(game, { from: "e2", to: "e5" })).toBeNull();
  });

  it("keeps move history grouped by full move number", () => {
    const game = createGame();
    game.move({ from: "e2", to: "e4" });
    game.move({ from: "e7", to: "e5" });
    game.move({ from: "g1", to: "f3" });

    expect(getMoveHistoryRows(game.history({ verbose: true }))).toEqual([
      { moveNumber: 1, white: "e4", black: "e5" },
      { moveNumber: 2, white: "Nf3" }
    ]);
  });

  it("detects checkmate", () => {
    const game = createGame();
    game.move("f3");
    game.move("e5");
    game.move("g4");
    game.move("Qh4#");

    expect(getGameStatus(game)).toMatchObject({
      label: "Checkmate",
      isGameOver: true
    });
  });

  it("describes the king and attacker during checkmate", () => {
    const game = createGame();
    game.move("f3");
    game.move("e5");
    game.move("g4");
    game.move("Qh4#");
    const threat = getCheckThreat(game);

    expect(threat).toMatchObject({
      checkedColor: "w",
      kingSquare: "e1",
      isCheckmate: true
    });
    expect(threat?.attackers).toEqual([
      {
        color: "b",
        square: "h4",
        type: "q"
      }
    ]);
    expect(threat ? describeCheckThreat(threat) : "").toContain("Black queen on h4");
  });

  it("detects promotion candidates", () => {
    const game = createGame("8/P7/8/8/8/8/8/4k2K w - - 0 1");

    expect(isPromotionMove(game, "a7", "a8")).toBe(true);
  });
});
