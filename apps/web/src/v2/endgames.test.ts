import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { chooseEndgameMove, decodeEndgameRecords, endgames, explainEndgameMove, endgameTypes, probeTablebase, puzzleHint, replayEndgame, tablebaseEligible, tablebaseLabel } from "./endgames";
import { gameResult } from "./fullGame";

const pawn = endgames.find(p => p.id === "draw-pawn")!;
describe("endgame practice", () => {
  it("ships legal positions and complete puzzle lines in every type/difficulty band", () => {
    expect(endgames).toHaveLength(155);
    expect(new Set(endgames.map(p => p.id)).size).toBe(155);
    for (const type of endgameTypes) {
      for (const difficulty of ["easy", "medium", "hard"]) expect(endgames.filter(p => p.type === type && p.difficulty === difficulty && p.goal === "win")).toHaveLength(10);
      expect(endgames.filter(p => p.type === type && p.goal === "draw")).toHaveLength(1);
    }
    for (const position of endgames) {
      const game = replayEndgame(position);
      expect(game.turn(), position.id).toBe(position.side);
      expect(game.isGameOver(), position.id).toBe(false);
      const types = new Set(game.board().flat().filter(p => p && !["k", "p"].includes(p.type)).map(p => p!.type));
      expect([...types], position.id).toEqual(position.type === "pawn" ? [] : [{ rook: "r", knight: "n", bishop: "b", queen: "q" }[position.type]]);
      if (position.sourceFen) {
        const source = new Chess(position.sourceFen); source.move(position.setup!);
        expect(source.fen(), position.id).toBe(position.fen);
      }
      expect(() => replayEndgame(position, position.solution), position.id).not.toThrow();
      if (position.goal === "draw") expect(position.verified?.category).toBe("draw");
    }
  });
  it("takes an exact legal tablebase reply without changing the current board", async () => {
    const game = new Chess(pawn.fen); const before = game.fen();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ category: "draw", moves: [{ uci: "e2d1" }] })));
    const chosen = await chooseEndgameMove(game, undefined, fetcher);
    expect(chosen.source).toBe("Tablebase");
    expect(chosen.move.san).toBe("Kd1");
    expect(game.fen()).toBe(before);
    expect(tablebaseLabel(game, chosen.table!)).toBe("Draw with optimal play.");
  });
  it("falls back to expert Stockfish when the tablebase cannot be reached", async () => {
    const game = new Chess(pawn.fen.replace("0 1", "1 1"));
    const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("tablebase.") ? new Response("unavailable", { status: 503 }) : new Response(JSON.stringify({ bestMove: "e2d1" }))));
    const chosen = await chooseEndgameMove(game, undefined, fetcher);
    expect(chosen.source).toBe("Stockfish"); expect(chosen.tableUnavailable).toBe(true);
    expect(JSON.parse(fetcher.mock.calls[1][1].body).difficulty).toBe("expert");
  });
  it("rejects illegal tablebase moves and stops stale requests instead of playing them", async () => {
    const game = new Chess(pawn.fen.replace("0 1", "2 1"));
    const bad = vi.fn().mockResolvedValue(new Response(JSON.stringify({ category: "win", moves: [{ uci: "e2e8" }] })));
    expect(await probeTablebase(game, undefined, bad)).toBeNull();
    const controller = new AbortController(); controller.abort();
    await expect(chooseEndgameMove(game, controller.signal, bad)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("only probes supported piece counts and describes fifty-move exceptions accurately", () => {
    expect(tablebaseEligible(new Chess())).toBe(false);
    expect(tablebaseEligible(new Chess(pawn.fen))).toBe(true);
    expect(tablebaseLabel(new Chess(pawn.fen), { category: "cursed-win", moves: [] })).toContain("fifty-move rule");
  });
  it("restores legal arbitrary play from the original FEN and drops corrupt sessions", () => {
    const game = new Chess(pawn.fen); const move = game.moves()[0]; game.move(move);
    const records = decodeEndgameRecords({ [pawn.id]: { moves: [move], last: 100 }, [endgames[0].id]: { moves: ["Ke9"], last: 101 }, unknown: { moves: [], last: 100 } });
    expect(Object.keys(records)).toEqual([pawn.id]);
    expect(replayEndgame(pawn, records[pawn.id].moves).fen()).toBe(game.fen());
    expect(replayEndgame(pawn, [move]).pgn()).toContain('[SetUp "1"]');
    expect(replayEndgame(pawn, [move]).pgn()).toContain('[FEN "');
  });
  it("offers a puzzle hint only while following its actual solution", () => {
    const position = endgames.find(p => p.goal === "win")!;
    expect(puzzleHint(position, [])?.san).toBe(position.solution[0]);
    const alternative = new Chess(position.fen).moves().find(san => san !== position.solution[0])!;
    expect(puzzleHint(position, [alternative])).toBeNull();
  });
  it("explains pawn locks, passed pawns, and drawing simplification from the actual board", () => {
    const hard = endgames.find(p => p.id === "00347")!;
    const before = replayEndgame(hard), after = replayEndgame(hard, ["h4"]);
    const why = explainEndgameMove(before, after, after.history({ verbose: true })[0]);
    expect(why).toContain("controls g3");
    expect(why).toContain("opposing pawn on h3");
    const passed = new Chess("3k4/8/4P3/5K2/8/8/8/8 w - - 0 1");
    const advanced = new Chess(passed.fen()); const move = advanced.move("e7");
    expect(explainEndgameMove(passed, advanced, move)).toContain("this is a passed pawn");
    const drawing = replayEndgame(pawn, ["Ke1", "e2"]);
    const drawn = replayEndgame(pawn, ["Ke1", "e2", "Kxe2"]);
    expect(explainEndgameMove(drawing, drawn, drawn.history({ verbose: true }).at(-1)!)).toContain("drawn result");
  });
  it("keeps repetition history from a custom starting FEN and ends at an actual result", () => {
    const position = { ...pawn, fen: "4k3/8/5n2/8/8/5N2/8/4K3 w - - 0 1" };
    const moves = ["Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6"];
    expect(gameResult(replayEndgame(position, moves))?.title).toContain("threefold repetition");
    expect(() => replayEndgame(position, [...moves, "Ng1"])).toThrow("already ended");
  });
});
