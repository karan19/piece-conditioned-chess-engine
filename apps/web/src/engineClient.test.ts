import { describe, expect, it } from "vitest";
import { buildApiUrl, parseUciMove } from "./engineClient";

describe("parseUciMove", () => {
  it("parses ordinary moves", () => {
    expect(parseUciMove("e2e4")).toEqual({
      from: "e2",
      to: "e4",
      promotion: undefined
    });
  });

  it("parses promotion moves", () => {
    expect(parseUciMove("a7a8q")).toEqual({
      from: "a7",
      to: "a8",
      promotion: "q"
    });
  });
});

describe("buildApiUrl", () => {
  it("keeps local proxy paths unchanged when no API base URL is configured", () => {
    expect(buildApiUrl("/api/engine/best-move")).toBe("/api/engine/best-move");
  });
});
