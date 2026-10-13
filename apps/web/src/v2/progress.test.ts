import { afterEach, describe, expect, it, vi } from "vitest";
import { openings } from "./catalog";
import {
  completeLine,
  dueLines,
  emptyProgress,
  loadProgress,
  recordKey,
  saveProgress,
  streak,
} from "./progress";
const line = openings.find((o) => o.moves.length > 2)!;
const now = new Date(2026, 9, 12, 12).getTime();
describe("spaced repetition", () => {
  it("keeps guided learning due immediately and separates White and Black progress", () => {
    const p = completeLine(emptyProgress(), line, "w", true, false, now);
    expect(dueLines(p, [line], "w", now)).toEqual([line]);
    expect(dueLines(p, [line], "b", now)).toEqual([]);
    expect(p.records[recordKey(line, "w")].box).toBe(0);
  });
  it("schedules unassisted recall at 1, 3, 7, 14 and 30 days", () => {
    let p = completeLine(emptyProgress(), line, "b", true, false, now);
    for (const [i, days] of [1, 3, 7, 14, 30].entries()) {
      p = completeLine(p, line, "b", true, true, now);
      expect(p.records[recordKey(line, "b")].box).toBe(i + 1);
      expect(p.records[recordKey(line, "b")].due).toBe(now + days * 86400000);
      expect(dueLines(p, [line], "b", now)).toHaveLength(0);
    }
    p = completeLine(p, line, "b", true, true, now);
    expect(p.records[recordKey(line, "b")].box).toBe(5);
  });
  it("resets failed or assisted recall to due and does not advance review boxes during learning", () => {
    let p = completeLine(emptyProgress(), line, "w", true, true, now);
    p = completeLine(p, line, "w", true, false, now);
    expect(p.records[recordKey(line, "w")].box).toBe(1);
    p = completeLine(p, line, "w", false, true, now);
    expect(p.records[recordKey(line, "w")].box).toBe(0);
    expect(dueLines(p, [line], "w", now)).toHaveLength(1);
  });
  it("counts consecutive local calendar days, including yesterday before today's practice", () => {
    const p = emptyProgress();
    for (const offset of [1, 2, 3]) {
      const date = new Date(now);
      date.setDate(date.getDate() - offset);
      p.activity[date.toLocaleDateString("en-CA")] = 1;
    }
    expect(streak(p, new Date(now))).toBe(3);
    expect(streak(p, new Date(now + 2 * 86400000))).toBe(0);
  });
});

describe("browser persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("recovers from corrupt storage and ignores invalid imported lines", () => {
    vi.stubGlobal("localStorage", { getItem: () => "broken json" });
    expect(loadProgress()).toEqual(emptyProgress());
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          ...emptyProgress(),
          custom: [{ name: "Bad", pgn: "1. e4 e5 2. Ke4" }],
          activity: { bad: 2 },
          records: { bad: { box: Infinity } },
        }),
    });
    const p = loadProgress();
    expect(p.custom).toEqual([]);
    expect(p.activity).toEqual({});
    expect(p.records).toEqual({});
  });
  it("reports blocked storage instead of claiming progress was saved", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(saveProgress(emptyProgress())).toBe(false);
  });
});
