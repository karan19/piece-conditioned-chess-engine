import { afterEach, describe, expect, it, vi } from "vitest";
import { families, openings, parseImportedPgn } from "./catalog";
import {
  decodeProgress,
  emptyProgress,
  loadProgress,
  recordKey,
  rememberStep,
  removeFromLearning,
  saveProgress,
} from "./progress";
const line = openings.find((o) => o.moves.length > 2)!;
describe("self-paced learning", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("remembers position separately for each side without creating schedules", () => {
    const p = rememberStep(emptyProgress(), line, "w", 2, 100);
    expect(p.records[recordKey(line, "w")]).toEqual({
      lastPly: 2,
      completed: false,
      visits: 0,
      last: 100,
    });
    expect(p.records[recordKey(line, "b")]).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/due|box|activity/);
  });
  it("keeps an opening saved after completing or restarting it", () => {
    let p = emptyProgress();
    p.saved = [`w:${line.family}`];
    p = rememberStep(p, line, "w", line.moves.length, 100);
    expect(p.records[recordKey(line, "w")].completed).toBe(true);
    p = rememberStep(p, line, "w", 0, 101);
    expect(p.saved).toEqual([`w:${line.family}`]);
    expect(p.records[recordKey(line, "w")].completed).toBe(true);
    expect(p.records[recordKey(line, "w")].lastPly).toBe(0);
  });
  it("migrates existing records and bookmarks, discarding repetition data", () => {
    const p = decodeProgress({
      version: 1,
      records: {
        [recordKey(line, "w")]: {
          box: 4,
          due: 1000,
          attempts: 3,
          learned: 10,
          last: 20,
        },
      },
      saved: [`w:${line.family}`],
      custom: [],
      activity: { "2026-10-12": 3 },
    });
    expect(p.version).toBe(2);
    expect(p.saved).toEqual([`w:${line.family}`]);
    expect(p.records[recordKey(line, "w")].completed).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/box|due|activity/);
  });
  it("only deletes the selected side's saved course and checkpoints", () => {
    const family = families.find((f) => f.name === line.family)!;
    let p = rememberStep(
      rememberStep(emptyProgress(), line, "w", 1),
      line,
      "b",
      2,
    );
    p.saved = [`w:${family.name}`, `b:${family.name}`];
    p = removeFromLearning(p, family.name, family.lines, "w");
    expect(p.saved).toEqual([`b:${family.name}`]);
    expect(p.records[recordKey(line, "w")]).toBeUndefined();
    expect(p.records[recordKey(line, "b")].lastPly).toBe(2);
    expect(families.some((f) => f.name === family.name)).toBe(true);
  });
  it("deletes an imported opening and its checkpoints on both sides only on request", () => {
    const custom = parseImportedPgn("1. e4 d5 2. exd5 Qxd5", "My Scandinavian");
    let p = rememberStep(
      rememberStep(emptyProgress(), custom, "w", 2),
      custom,
      "b",
      3,
    );
    p.custom = [custom];
    p.saved = ["w:My Scandinavian", "b:My Scandinavian", "w:Italian Game"];
    p = removeFromLearning(p, custom.name, [custom], "w", true);
    expect(p.custom).toEqual([]);
    expect(Object.keys(p.records)).toHaveLength(0);
    expect(p.saved).toEqual(["w:Italian Game"]);
  });
  it("recovers from corrupt storage and reports a save failure", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "bad",
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(loadProgress()).toEqual(emptyProgress());
    expect(saveProgress(emptyProgress())).toBe(false);
  });
});
