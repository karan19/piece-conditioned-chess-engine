import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health.js";

describe("getHealthStatus", () => {
  it("returns the foundation health payload", () => {
    expect(getHealthStatus()).toEqual({
      status: "ok",
      service: "piece-conditioned-chess-api",
      milestone: "foundation"
    });
  });
});
