export function routeSlug(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function routeNumber(value: string | null, fallback = 1) { const n = Number(value); return Number.isSafeInteger(n) && n >= 1 && n <= 100000 ? n : fallback; }
export function localToken(value: string) { let hash = 2166136261; for (const ch of value) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); }
export function readStudioRoute(url: URL) {
  const p = url.hash.includes("=") ? new URLSearchParams(url.hash.slice(1)) : url.searchParams;
  const path = url.pathname.replace(/\/+$/, "").slice("/opening-studio".length);
  const parts = path.split("/").filter(Boolean);
  const legacy = url.hash.includes("=");
  const endgames = parts[0] === "endgames" || p.get("view") === "endgames";
  const learning = parts[0] === "my-openings" || p.get("from") === "my-openings" || p.get("view") === "learning";
  const family = parts[0] === "openings" ? parts[1] : undefined;
  const known = !parts.length || (parts[0] === "my-openings" && parts.length === 1) || (endgames && parts.length <= 2) || (parts[0] === "openings" && parts.length >= 2 && parts.length <= 3 && (!parts[2] || parts[2] === "learn"));
  return { legacy, valid: known, view: endgames ? "endgames" as const : learning ? "learning" as const : "explore" as const,
    familySlug: family, legacyFamily: legacy ? p.get("family") : null, custom: p.get("custom"),
    learn: parts[2] === "learn", line: routeNumber(p.get("line")), hasLine: p.has("line"),
    side: p.get("side") === "black" || p.get("side") === "b" ? "b" as const : "w" as const,
    search: family ? p.get("q") ?? "" : legacy && p.get("family") ? "" : p.get("q") ?? "",
    lineSearch: p.get("variation") ?? (legacy && p.get("family") ? p.get("q") ?? "" : ""),
    filter: ["e4", "d4", "flank", "gambit"].includes(p.get("filter") ?? "") ? p.get("filter")! : "all",
    page: routeNumber(p.get("page")), linePage: routeNumber(p.get("line-page")), importOpen: p.get("import") === "1",
    position: endgames ? parts[1] ?? p.get("position") : null,
    type: ["pawn", "rook", "bishop", "knight", "queen"].includes(p.get("type") ?? "") ? p.get("type")! : "all",
    difficulty: ["easy", "medium", "hard"].includes(p.get("difficulty") ?? "") ? p.get("difficulty")! : "all",
    goal: ["win", "draw"].includes(p.get("goal") ?? "") ? p.get("goal")! : "all" };
}
export function studioListPath(view: "explore" | "learning" | "endgames") { return view === "explore" ? "/opening-studio/" : `/opening-studio/${view === "learning" ? "my-openings" : "endgames"}/`; }
export function studioFamilyPath(name: string, learn = false) { return `/opening-studio/openings/${routeSlug(name)}/${learn ? "learn/" : ""}`; }
export function readGuidedRoute(url: URL) {
  const parts = url.pathname.slice("/guided-play".length).split("/").filter(Boolean);
  const p = url.searchParams;
  const screen = !parts.length ? "home" : parts[0] === "new-game" && parts.length === 1 ? "new-game" : parts[0] === "games" && parts.length === 2 ? "game" : parts[0] === "journal" && parts.length === 1 ? "previous-games" : parts[0] === "journal" && parts.length === 2 ? "review-game" : "missing";
  return { screen, gameId: parts[1] ?? null, event: p.get("event"), board: p.get("board") === "2d" ? "2d" as const : "3d" as const,
    playerColor: p.get("side") === "black" ? "b" as const : "w" as const,
    difficulty: ["easy", "hard", "expert"].includes(p.get("difficulty") ?? "") ? p.get("difficulty")! as "easy" | "hard" | "expert" : "medium" as const };
}
