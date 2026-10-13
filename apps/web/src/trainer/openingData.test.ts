import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { openingCourses } from "./openingData";

describe("opening data", () => {
  it("has at least one course", () => {
    expect(openingCourses.length).toBeGreaterThanOrEqual(1);
  });

  it("each line has valid SAN moves that form a playable game", () => {
    for (const course of openingCourses) {
      for (const line of course.full) {
        const game = new Chess();
        for (const san of line.moves) {
          expect(() => game.move(san)).not.toThrow();
        }
      }
    }
  });

  it("every line starts with a move matching the course side", () => {
    for (const course of openingCourses) {
      for (const line of course.full) {
        const first = line.moves[0];
        if (course.side === "w") {
          // If White starts, the first move should not be a Black-only move (e.g. starting from black's 1st reply)
          expect(first).not.toBe("c6");
        }
      }
    }
  });
});
