import { describe, expect, it } from "vitest";
import {
  countSavedGames,
  getSavedGame,
  loadSavedGames,
  upsertSavedGame,
  type SavedGame
} from "./gameStorage";

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

function createSavedGame(id: string, updatedAt: string): SavedGame {
  return {
    id,
    createdAt: updatedAt,
    updatedAt,
    fen: "start",
    history: [],
    settings: {
      playerColor: "w",
      difficulty: "medium"
    },
    statusLabel: "White to move",
    result: "Active",
    isGameOver: false,
    learningEvents: []
  };
}

describe("game storage", () => {
  it("upserts and reads saved games", () => {
    const storage = createMemoryStorage();

    upsertSavedGame(createSavedGame("a", "2026-10-02T20:00:00.000Z"), storage);

    expect(countSavedGames(storage)).toBe(1);
    expect(getSavedGame("a", storage)?.settings.difficulty).toBe("medium");
  });

  it("sorts by most recently updated", () => {
    const storage = createMemoryStorage();

    upsertSavedGame(createSavedGame("old", "2026-10-02T20:00:00.000Z"), storage);
    upsertSavedGame(createSavedGame("new", "2026-10-02T21:00:00.000Z"), storage);

    expect(loadSavedGames(storage).map((game) => game.id)).toEqual(["new", "old"]);
  });

  it("defaults old saved games to empty learning events", () => {
    const storage = createMemoryStorage();

    storage.setItem(
      "pcce.savedGames.v1",
      JSON.stringify([
        {
          id: "old-shape",
          createdAt: "2026-10-02T20:00:00.000Z",
          updatedAt: "2026-10-02T20:00:00.000Z",
          fen: "start",
          history: [],
          settings: {
            playerColor: "w",
            difficulty: "medium"
          },
          statusLabel: "White to move",
          result: "Active",
          isGameOver: false
        }
      ])
    );

    expect(getSavedGame("old-shape", storage)?.learningEvents).toEqual([]);
  });

  it("normalizes invalid learning event data", () => {
    const storage = createMemoryStorage();

    storage.setItem(
      "pcce.savedGames.v1",
      JSON.stringify([
        {
          ...createSavedGame("bad-events", "2026-10-02T20:00:00.000Z"),
          learningEvents: "not-an-array"
        }
      ])
    );

    expect(getSavedGame("bad-events", storage)?.learningEvents).toEqual([]);
  });
});
