import { describe, expect, it } from "vitest";
import { families } from "./v2/catalog";
import { localToken, readGuidedRoute, readStudioRoute, routeNumber, routeSlug, studioFamilyPath, studioListPath } from "./routes";
const studio = (path: string) => readStudioRoute(new URL(`https://chess.example/opening-studio/${path}`));
describe("chess view routing", () => {
  it("distinguishes saved openings, family details, and lessons with reloadable URLs", () => {
    expect(studio("my-openings/?side=black")).toMatchObject({view:"learning", side:"b", learn:false});
    expect(studio("openings/london-system/learn/?line=3&from=my-openings&side=black")).toMatchObject({familySlug:"london-system", learn:true, line:3, view:"learning", side:"b"});
    expect(studioFamilyPath("London System", true)).toBe("/opening-studio/openings/london-system/learn/");
    expect(studioListPath("learning")).toBe("/opening-studio/my-openings/");
  });
  it("keeps library and variation searches distinct and preserves pagination", () => {
    expect(studio("openings/sicilian-defense/?q=sicilian&variation=dragon&page=2&line-page=3&filter=e4")).toMatchObject({search:"sicilian", lineSearch:"dragon", page:2, linePage:3, filter:"e4"});
  });
  it("reads old opening and endgame hash links for migration", () => {
    expect(studio("#family=London+System&side=b&q=Nf3")).toMatchObject({legacy:true, legacyFamily:"London System", side:"b", search:"", lineSearch:"Nf3"});
    expect(studio("#view=endgames&position=0008Q")).toMatchObject({legacy:true, view:"endgames", position:"0008Q"});
  });
  it("keeps endgame filters when a specific position is opened", () => {
    expect(studio("endgames/?difficulty=hard#details").difficulty).toBe("hard");
    expect(studio("endgames/0008Q/?type=rook&difficulty=hard&goal=win&page=2")).toMatchObject({view:"endgames", position:"0008Q", type:"rook", difficulty:"hard", goal:"win", page:2});
  });
  it("rejects unknown views and clamps invalid query values", () => {
    expect(studio("nowhere/").valid).toBe(false);
    expect(studio("openings/london-system/nope/").valid).toBe(false);
    expect(studio("endgames/?type=king&difficulty=impossible&page=-1")).toMatchObject({type:"all", difficulty:"all", page:1});
    for (const n of ["NaN", "Infinity", "1.5", "0", "100001", null]) expect(routeNumber(n)).toBe(1);
  });
  it("has distinct readable paths for every shipped opening family", () => {
    expect(new Set(families.map(f => routeSlug(f.name))).size).toBe(families.length);
    expect(routeSlug("Réti Opening")).toBe("reti-opening");
    expect(routeSlug("♟")).toBe("custom-opening");
    expect(localToken("custom:😀:e4")).not.toBe(localToken("custom:😁:e4"));
    expect(localToken("custom:my line")).toBe(localToken("custom:my line"));
    expect(localToken("custom:my line")).not.toBe(localToken("custom:other line"));
  });
  it("restores guided game, review, and setup identity from URLs", () => {
    const read = (path: string) => readGuidedRoute(new URL(`https://chess.example/guided-play/${path}`));
    expect(read("new-game/?side=black&difficulty=expert")).toMatchObject({screen:"new-game", playerColor:"b", difficulty:"expert"});
    expect(read("games/saved-game/?board=2d")).toMatchObject({screen:"game", gameId:"saved-game", board:"2d"});
    expect(read("journal/").screen).toBe("previous-games");
    expect(read("journal/saved-game/?event=moment")).toMatchObject({screen:"review-game", gameId:"saved-game", event:"moment"});
    expect(read("games/").screen).toBe("missing");
    expect(read("unknown/").screen).toBe("missing");
  });
});
