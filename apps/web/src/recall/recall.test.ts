import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { blankRound, choosePosition, defaults, loadRound, positions, queryFor, readRecords, saveRecords, saveRound, scoreRecall, settingsFromUrl, type Pieces } from "./recall";
function memoryStorage() { const data = new Map<string,string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }; }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Board Recall", () => {
  it("uses distinct legal positions with correctly sized difficulty bands", () => {
    const keys = positions.map(p => p.fen.split(" ")[0]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(positions.map(p => p.id)).size).toBe(positions.length);
    for (const level of ["beginner", "intermediate", "advanced"] as const) expect(positions.filter(p => p.level === level).length).toBeGreaterThan(1);
    for (const p of positions) {
      const game = new Chess(p.fen), count = game.board().flat().filter(Boolean).length;
      expect(Object.keys(p.pieces)).toHaveLength(count);
      expect(p.level).toBe(count <= 6 ? "beginner" : count <= 12 ? "intermediate" : "advanced");
    }
  });
  it("selects a new position in the requested band", () => {
    const first = choosePosition("beginner", undefined, () => 0);
    expect(choosePosition("beginner", first.id, () => 0).id).not.toBe(first.id);
    expect(choosePosition("advanced", undefined, () => .99).level).toBe("advanced");
  });
  it("scores exact piece and color matches and penalizes extra pieces", () => {
    const target: Pieces = { e2: { color:"w", type:"k" }, e3:{color:"b",type:"p"}, e4:{color:"b",type:"k"} };
    expect(scoreRecall(target,target)).toMatchObject({percent:100, count:3, placedCount:3, wrong:[], missing:[]});
    expect(scoreRecall(target,{})).toMatchObject({percent:0, correct:[], missing:["e2","e3","e4"]});
    const wrongColor = scoreRecall(target,{...target,e3:{color:"w",type:"p"}});
    expect(wrongColor.correct).toHaveLength(2); expect(wrongColor.wrong).toEqual(["e3"]); expect(wrongColor.percent).toBe(67);
    expect(scoreRecall(target,{...target,a1:{color:"w",type:"q"}}).percent).toBe(75);
    expect(scoreRecall(target,{...target,e3:{color:"b",type:"q"}}).correct).toHaveLength(2);
  });
  it("round-trips settings in the URL and rejects unsupported timer values", () => {
    const selected = {level:"advanced" as const,seconds:2,side:"b" as const};
    expect(settingsFromUrl(new URL(`https://chess.example/?${queryFor(selected)}`))).toEqual(selected);
    expect(settingsFromUrl(new URL('https://chess.example/?level=nope&seconds=-10'))).toEqual(defaults);
  });
  it("restores the original timer deadline and hides expired positions", () => {
    vi.stubGlobal("sessionStorage",memoryStorage()); vi.useFakeTimers(); vi.setSystemTime(1000);
    saveRound("round",{...blankRound(),phase:"watch",deadline:3000});
    vi.setSystemTime(2000); expect(loadRound("round")).toMatchObject({phase:"watch",deadline:3000});
    vi.setSystemTime(3000); expect(loadRound("round")).toMatchObject({phase:"rebuild",deadline:3000});
    expect(loadRound("round",true).assisted).toBe(true);
  });
  it("preserves reconstruction and assisted status across reloads", () => {
    vi.stubGlobal("sessionStorage",memoryStorage());
    const round = {...blankRound(true), phase:"result" as const, pieces:{e2:{color:"w" as const,type:"k" as const}}};
    saveRound("one",round); expect(loadRound("one")).toEqual(round); expect(loadRound("other").phase).toBe("ready");
    sessionStorage.setItem("pcce.recall.round:broken",'{"phase":"watch","deadline":5,"pieces":{"nope":{},"e2":{"color":"bad","type":"k"}}}');
    expect(loadRound("broken").pieces).toEqual({});
  });
  it("saves preferences and bounds local results while tolerating storage failures", () => {
    vi.stubGlobal("localStorage",memoryStorage());
    const attempts = Array.from({length:70},(_,i)=>({id:String(i),positionId:positions[0].id,percent:100,assisted:false,level:"beginner" as const,seconds:5,at:i}));
    saveRecords({...defaults,side:"b"},attempts); expect(readRecords().settings.side).toBe("b"); expect(readRecords().attempts).toHaveLength(50);
    vi.stubGlobal("localStorage",{getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("blocked");}});
    expect(readRecords()).toEqual({settings:defaults,attempts:[]}); expect(saveRecords(defaults,[])).toBe(false);
  });
});
