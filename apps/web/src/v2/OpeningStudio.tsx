import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Layers3,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Board, Piece } from "./Board";
import {
  description,
  families,
  featured,
  gameAt,
  openings,
  parseImportedPgn,
  type Family,
  type Opening,
  type Side,
} from "./catalog";
import {
  decodeProgress,
  loadProgress,
  recordKey,
  rememberStep,
  savedOpening,
  removeFromLearning,
  saveProgress,
  type Progress,
} from "./progress";
import { openingPlan } from "./lessons";
import { exportGuidedGame } from "./fullGame";
import { Training } from "./Training";
const EndgamePractice = lazy(() => import("./EndgamePractice").then(module => ({ default: module.EndgamePractice })));
type View = "explore" | "learning" | "endgames";
function introductoryLine(f: Family) {
  if (f.name === "Scandinavian Defense")
    return (
      f.lines.find(
        (o) => o.name === "Scandinavian Defense: Classical Variation",
      ) ?? f.representative
    );
  return (
    f.lines.find(
      (o) =>
        /Main Line|Classical Variation/.test(o.name) &&
        o.moves.length >= 8 &&
        o.moves.length <= 20,
    ) ?? f.representative
  );
}
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const sideName = (s: Side) => (s === "w" ? "White" : "Black");
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function OpeningStudio() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [view, setView] = useState<View>("explore");
  const [side, setSide] = useState<Side>("w");
  const [family, setFamily] = useState<Family | null>(null);
  const [selected, setSelected] = useState<Opening | null>(null);
  const [session, setSession] = useState<Opening | null>(null);
  const [search, setSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [linePage, setLinePage] = useState(1);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pgn, setPgn] = useState("");
  const [importError, setImportError] = useState("");
  const allFamilies = useMemo<Family[]>(
    () => [
      ...families,
      ...progress.custom.map((o) => ({
        name: o.name,
        lines: [o],
        representative: o,
        category: "Your line",
      })),
    ],
    [progress.custom],
  );
  useEffect(() => {
    setStorageError(!saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      if (params.get("view") === "endgames") setView("endgames");
      else if (params.get("family")) setView("explore");
      setSide(params.get("side") === "b" ? "b" : "w");
      const f = allFamilies.find((f) =>
        params.get("custom")
          ? f.representative.id === params.get("custom")
          : f.name === params.get("family"),
      );
      setFamily(f ?? null);
      const query = params.get("q") ?? "";
      const candidates =
        f?.lines.filter((o) =>
          normalize(`${o.name} ${o.eco} ${o.pgn}`).includes(normalize(query)),
        ) ?? [];
      const chosen = f
        ? query
          ? (candidates[0] ?? introductoryLine(f))
          : introductoryLine(f)
        : null;
      setSelected(chosen);
      setLineSearch(query);
      setLinePage(
        Math.floor(
          Math.max(
            0,
            candidates.findIndex((o) => o.id === chosen?.id),
          ) / 25,
        ) + 1,
      );
      setSession(null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [allFamilies]);
  useEffect(() => {
    setPage(1);
  }, [search, filter, side, view]);

  const navigate = (next: View) => {
    setView(next);
    setFamily(null);
    setSession(null);
    setSearch("");
    setFilter("all");
    history.replaceState(null, "", location.pathname + "#" + new URLSearchParams({ side, ...(next === "endgames" ? { view: "endgames" } : {}) }));
    window.scrollTo(0, 0);
  };
  const openFamily = (f: Family) => {
    location.hash = new URLSearchParams({
      family: f.name,
      side,
      ...(f.category === "Your line" ? { custom: f.representative.id } : {}),
      ...(search ? { q: search } : {}),
    }).toString();
    window.scrollTo(0, 0);
  };
  const chooseSide = (s: Side) => {
    setSide(s);
    if (family)
      location.hash = new URLSearchParams({
        family: family.name,
        side: s,
        ...(family.category === "Your line"
          ? { custom: family.representative.id }
          : {}),
      }).toString();
    else history.replaceState(null, "", location.pathname + "#side=" + s);
  };
  const saved = (f: Family) => progress.saved.includes(`${side}:${f.name}`);
  const saveFamily = (f: Family) =>
    setProgress((p) => ({
      ...p,
      saved: Array.from(new Set([...p.saved, `${side}:${f.name}`])),
    }));
  const removeFamily = (f: Family) => {
    setProgress((p) =>
      removeFromLearning(p, f.name, f.lines, side, f.category === "Your line"),
    );
    setNotice(
      `${f.name} was removed from your learning list${f.category === "Your line" ? " and its imported line was deleted" : ". You can add it again from the library"}.`,
    );
    if (family?.representative.id === f.representative.id) navigate("learning");
  };
  const start = (o: Opening) => {
    if (family) saveFamily(family);
    setSession(o);
    setNotice("");
    window.scrollTo(0, 0);
  };
  const onStep = useCallback(
    (ply: number, continuation: string[], learning?: { bookMoves: string[]; bookComplete: boolean }) => {
      if (session)
        setProgress((p) =>
          rememberStep(p, session, side, ply, Date.now(), continuation, learning),
        );
    },
    [session, side],
  );
  const filtered = useMemo(
    () =>
      allFamilies
        .filter((f) => {
          if (
            view === "learning" &&
            !progress.saved.includes(`${side}:${f.name}`) &&
            f.category !== "Your line"
          )
            return false;
          const q = normalize(search);
          if (
            q &&
            !f.lines.some((o) =>
              normalize(`${o.name} ${o.eco} ${o.pgn}`).includes(q),
            )
          )
            return false;
          if (
            filter !== "all" &&
            !f.lines.some((o) =>
              filter === "e4"
                ? o.moves[0] === "e4"
                : filter === "d4"
                  ? o.moves[0] === "d4"
                  : filter === "flank"
                    ? !["e4", "d4"].includes(o.moves[0])
                    : /gambit/i.test(o.name),
            )
          )
            return false;
          return true;
        })
        .sort((a, b) => {
          const q = normalize(search);
          if (q) {
            const am = normalize(a.name).includes(q),
              bm = normalize(b.name).includes(q);
            if (am !== bm) return am ? -1 : 1;
          }
          const ai = featured.findIndex((f) => f.name === a.name),
            bi = featured.findIndex((f) => f.name === b.name);
          return (
            (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) ||
            a.name.localeCompare(b.name)
          );
        }),
    [allFamilies, progress.saved, view, side, search, filter],
  );
  const lines =
    family?.lines.filter((o) =>
      normalize(`${o.name} ${o.eco} ${o.pgn}`).includes(normalize(lineSearch)),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(filtered.length / 12)),
    currentPage = Math.min(page, pages);
  const linePages = Math.max(1, Math.ceil(lines.length / 25)),
    currentLinePage = Math.min(linePage, linePages);
  const importLine = () => {
    try {
      const o = parseImportedPgn(pgn, title);
      setProgress((p) => ({
        ...p,
        custom: [...p.custom.filter((c) => c.id !== o.id), o],
        saved: Array.from(new Set([...p.saved, `${side}:${o.family}`])),
      }));
      setImportOpen(false);
      setPgn("");
      setTitle("");
      setImportError("");
      navigate("learning");
      setNotice("Your line is ready for a guided walkthrough.");
    } catch (e) {
      setImportError(
        e instanceof Error ? e.message : "Couldn't read this PGN.",
      );
    }
  };
  const restore = async (file: File) => {
    try {
      if (file.size > 5000000)
        throw new Error("Choose a backup smaller than 5 MB.");
      const value = JSON.parse(await file.text());
      const backup = decodeProgress(value.progress ?? value);
      setProgress((old) => ({
        ...old,
        records: { ...backup.records, ...old.records },
        saved: Array.from(new Set([...old.saved, ...backup.saved])),
        custom: [
          ...old.custom,
          ...backup.custom.filter(
            (o) => !old.custom.some((c) => c.id === o.id),
          ),
        ],
      }));
      setNotice(
        "Backup restored. Openings and saved games were retained; old review schedules were discarded.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Couldn't restore this backup.",
      );
    }
  };
  const exportBackup = () =>
    download(
      JSON.stringify({ version: 3, progress }, null, 2),
      "opening-studio-backup.json",
      "application/json",
    );
  const guide = selected ? openingPlan(selected, side) : null;
  return (
    <div className="os-app">
      <aside className="os-sidebar">
        <a href="/opening-studio/" className="os-brand">
          <span className="os-brand-mark">
            <Piece type="n" color="w" />
          </span>
          <span>
            Opening
            <span className="os-brand-second">
              studio<span className="os-brand-dot">.</span>
            </span>
          </span>
        </a>
        <span className="os-sidebar-caption">UNDERSTAND YOUR FIRST MOVES</span>
        <nav aria-label="Opening Studio navigation">
          <button
            className={view === "explore" ? "active" : ""}
            onClick={() => navigate("explore")}
          >
            <Compass size={19} />
            Explore openings
          </button>
          <button
            className={view === "learning" ? "active" : ""}
            onClick={() => navigate("learning")}
          >
            <Bookmark size={19} />
            My openings
          </button>
          <button className={view === "endgames" ? "active" : ""} onClick={() => navigate("endgames")}><Flag size={19} /> Endgame Practice</button>
        </nav>
        <div className="os-sidebar-card">
          <BookOpen size={21} />
          <h3>Understand the why.</h3>
          <p>
            Your move. Their reply. The idea behind each step. Go at your own
            pace.
          </p>
          <button onClick={() => navigate("learning")}>
            Continue learning <ArrowRight size={15} />
          </button>
        </div>
        <div className="os-sidebar-bottom">
          <a href="/" className="os-v1-link">
            <ArrowLeft size={16} /> Chess homepage
          </a>
          <a href="/guided-play/" className="os-v1-link">Guided Play <ArrowRight size={16} /></a>
          <span>OPENING STUDIO</span>
        </div>
      </aside>
      <div className="os-main">
        <header className="os-topbar">
          <span className="os-breadcrumb">A guide, one move at a time</span>
          <span className="os-local-badge">
            <span /> {view === "endgames" ? "Endgames save as you play" : "Openings stay until you remove them"}
          </span>
        </header>
        <main className="os-content">
          {storageError && (
            <div className="os-notice warning" role="alert">
              Your browser couldn't save your place. Export a backup before
              leaving.
            </div>
          )}
          {notice && (
            <div className="os-notice" role="status">
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
                <X size={17} />
              </button>
            </div>
          )}
          {view === "endgames" ? <Suspense fallback={<p role="status">Loading endgame positions…</p>}><EndgamePractice /></Suspense> : session ? (
            <Training
              key={`${session.id}:${side}`}
              opening={session}
              side={side}
              initialPly={
                progress.records[recordKey(session, side)]?.lastPly ?? 0
              }
              initialContinuation={
                progress.records[recordKey(session, side)]?.continuation ?? []
              }
              initialBookMoves={progress.records[recordKey(session, side)]?.bookMoves}
              initialBookComplete={progress.records[recordKey(session, side)]?.bookComplete}
              continuations={(family?.lines ?? [])
                .filter(
                  (o) =>
                    o.moves.length > session.moves.length &&
                    session.moves.every((m, i) => o.moves[i] === m),
                )
                .slice(0, 4)}
              onContinue={(o) => {
                setProgress((p) =>
                  rememberStep(p, o, side, session.moves.length),
                );
                setSession(o);
              }}
              onExit={() => setSession(null)}
              onStep={onStep}
            />
          ) : family ? (
            <>
              <button
                className="os-link os-back"
                onClick={() => navigate(view)}
              >
                <ArrowLeft size={17} />
                Back to openings
              </button>
              <div className="os-detail-heading">
                <div>
                  <span className="os-eyebrow">
                    {family.representative.eco} · GUIDED OPENING
                  </span>
                  <h1>{family.name}</h1>
                  <p>{description(family)}</p>
                </div>
                <button
                  className="os-secondary"
                  onClick={() =>
                    saved(family) ? removeFamily(family) : saveFamily(family)
                  }
                >
                  {saved(family) ? (
                    <Trash2 size={16} />
                  ) : (
                    <Bookmark size={16} />
                  )}{" "}
                  {saved(family)
                    ? "Remove from My openings"
                    : "Keep in My openings"}
                </button>
              </div>
              <div className="os-detail-meta">
                <SideSwitch side={side} onSide={chooseSide} />
                <span>
                  <Layers3 size={16} />
                  {family.lines.length} named lines
                </span>
                <span>No quizzes. No schedules. Your pace.</span>
              </div>
              <div className="os-detail-layout">
                <section className="os-lines-panel">
                  <div className="os-section-title">
                    <h2>Choose a variation</h2>
                    <span>{lines.length} lines</span>
                  </div>
                  <label className="os-search compact">
                    <Search size={17} />
                    <input
                      aria-label="Search variations"
                      placeholder="Search variations, ECO or moves…"
                      value={lineSearch}
                      onChange={(e) => {
                        setLineSearch(e.target.value);
                        setLinePage(1);
                      }}
                    />
                  </label>
                  <div className="os-lines">
                    {lines
                      .slice((currentLinePage - 1) * 25, currentLinePage * 25)
                      .map((o) => (
                        <button
                          key={o.id}
                          className={selected?.id === o.id ? "active" : ""}
                          onClick={() => setSelected(o)}
                        >
                          <span className="os-line-icon">
                            <BookOpen size={16} />
                          </span>
                          <span>
                            <strong>
                              {o.name.includes(":")
                                ? o.name.split(":").slice(1).join(":")
                                : "Main position"}
                            </strong>
                            <small>
                              {o.eco} · {o.moves.length} opening plies · full
                              game continues
                              {progress.records[recordKey(o, side)]?.result
                                ? " · Game completed"
                                : ""}
                            </small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                  </div>
                  {!lines.length && (
                    <p className="os-empty-inline">No matching variations.</p>
                  )}
                  <Pagination
                    page={currentLinePage}
                    pages={linePages}
                    onPage={setLinePage}
                  />
                </section>
                <section className="os-preview-panel">
                  {selected && guide && (
                    <>
                      <div className="os-preview-heading">
                        <div>
                          <span className="os-label">UNDERSTAND THIS LINE</span>
                          <h3>{selected.name}</h3>
                        </div>
                        <button
                          className="os-icon-button"
                          aria-label="Export selected line as PGN"
                          onClick={() =>
                            download(
                              exportGuidedGame(
                                savedOpening(selected, progress.records[recordKey(selected, side)]),
                                progress.records[recordKey(selected, side)]
                                  ?.continuation ?? [],
                                progress.records[recordKey(selected, side)]
                                  ?.lastPly ?? selected.moves.length,
                              ),
                              "guided-game.pgn",
                              "application/x-chess-pgn",
                            )
                          }
                        >
                          <ArrowDownToLine size={18} />
                        </button>
                      </div>
                      <Board game={gameAt(selected, 0)} side={side} />
                      <div className="os-lesson-intro">
                        <h3>The opening idea</h3>
                        <p>{guide.idea}</p>
                        <h3>Your plan as {sideName(side)}</h3>
                        <p>{side === "w" ? guide.white : guide.black}</p>
                      </div>
                      <button
                        className="os-primary wide"
                        onClick={() => start(selected)}
                      >
                        {progress.records[recordKey(selected, side)]?.lastPly
                          ? "Continue guided game"
                          : "Start guided game"}
                        <ArrowRight size={18} />
                      </button>
                      <p className="os-training-note">
                        Explains your moves and the opponent's replies. The game
                        continues beyond the opening with Stockfish, until
                        checkmate or a draw. Nothing advances until you choose
                        to continue.
                      </p>
                    </>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <div className="os-hero">
                <div>
                  <span className="os-eyebrow">
                    {view === "learning"
                      ? "YOUR PERSONAL OPENING BOOK"
                      : "THE OPENING LIBRARY"}
                  </span>
                  <h1>
                    {view === "learning" ? (
                      <>
                        Your openings.
                        <br />
                        <em>At your own pace.</em>
                      </>
                    ) : (
                      <>
                        Learn what to play.
                        <br />
                        <em>Understand why.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {view === "learning"
                      ? "Keep an opening here for as long as you want. Walk through it again whenever you like, and remove it only when you're comfortable."
                      : "A move-by-move guide from your opening through the rest of the game, until checkmate or a draw."}
                  </p>
                  <div className="os-hero-chips">
                    <span>
                      <Layers3 size={15} />
                      {openings.length.toLocaleString()} named lines
                    </span>
                    <span>
                      <Piece type="p" color="w" />
                      White & Black
                    </span>
                    <span>
                      <BookOpen size={15} />
                      Move-by-move explanations
                    </span>
                  </div>
                </div>
                <div className="os-hero-art" aria-hidden="true">
                  <span className="os-hero-orbit one" />
                  <span className="os-hero-orbit two" />
                  <div className="os-hero-checker" />
                  <div className="os-hero-knight">
                    <Piece type="n" color="w" />
                  </div>
                  <span className="os-hero-art-caption">
                    YOUR MOVE.
                    <br />
                    THEIR REPLY. THE IDEA.
                  </span>
                </div>
              </div>
              <div className="os-library-heading">
                <div>
                  <h2>
                    {view === "learning" ? "My openings" : "Find your opening"}
                  </h2>
                  <p>
                    {view === "learning"
                      ? "Your learning list stays until you manually remove an opening."
                      : `${families.length} families. Explore each move from both sides.`}
                  </p>
                </div>
                <button
                  className="os-secondary"
                  onClick={() => {
                    setImportOpen(true);
                    setImportError("");
                  }}
                >
                  <Plus size={16} />
                  Import a PGN
                </button>
              </div>
              <div className="os-library-toolbar">
                <label className="os-search">
                  <Search size={19} />
                  <input
                    aria-label="Search openings"
                    placeholder="Search openings, variations, ECO or moves…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <SideSwitch side={side} onSide={chooseSide} />
              </div>
              <div className="os-filter-row">
                <div role="group" aria-label="Opening filters">
                  {[
                    { id: "all", label: "All openings" },
                    { id: "e4", label: "1. e4" },
                    { id: "d4", label: "1. d4" },
                    { id: "flank", label: "Flank openings" },
                    { id: "gambit", label: "Gambits" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={filter === f.id ? "active" : ""}
                      aria-pressed={filter === f.id}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span>{filtered.length} families</span>
              </div>
              {filtered.length ? (
                <>
                  <div className="os-course-grid">
                    {filtered
                      .slice((currentPage - 1) * 12, currentPage * 12)
                      .map((f) => (
                        <article
                          key={f.representative.id}
                          className="os-course-card"
                        >
                          <button
                            className="os-card-art"
                            aria-label={`Explore ${f.name}`}
                            onClick={() => openFamily(f)}
                          >
                            <span className="os-card-code">
                              {f.representative.eco}
                            </span>
                            <Board
                              game={gameAt(
                                f.representative,
                                Math.min(12, f.representative.moves.length),
                              )}
                              side={side}
                              mini
                            />
                            <span className="os-card-side">
                              {sideName(side)}
                            </span>
                          </button>
                          <div className="os-card-copy">
                            <div className="os-card-kind">
                              <span>{f.category}</span>
                              <button
                                className={`os-bookmark ${saved(f) ? "active" : ""}`}
                                aria-label={
                                  view === "learning"
                                    ? `Remove ${f.name} from My openings`
                                    : `Keep ${f.name} in My openings`
                                }
                                onClick={() =>
                                  view === "learning"
                                    ? removeFamily(f)
                                    : saveFamily(f)
                                }
                              >
                                {view === "learning" ? (
                                  <Trash2 size={17} />
                                ) : (
                                  <Bookmark
                                    size={17}
                                    fill={saved(f) ? "currentColor" : "none"}
                                  />
                                )}
                              </button>
                            </div>
                            <button
                              className="os-card-title"
                              onClick={() => openFamily(f)}
                            >
                              {f.name}
                            </button>
                            <p>{description(f)}</p>
                            <div className="os-card-bottom">
                              <span>
                                {f.lines.length}{" "}
                                {f.lines.length === 1 ? "line" : "variations"}
                              </span>
                              <button
                                aria-label={`Open ${f.name}`}
                                onClick={() => openFamily(f)}
                              >
                                <ArrowRight size={17} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                  <Pagination
                    page={currentPage}
                    pages={pages}
                    onPage={setPage}
                  />
                </>
              ) : (
                <div className="os-empty">
                  <BookOpen size={34} />
                  <h2>
                    {view === "learning"
                      ? "Choose an opening to keep here."
                      : "No openings found."}
                  </h2>
                  <p>
                    {view === "learning"
                      ? "Starting a walkthrough adds it to My openings. It will never be automatically removed."
                      : "Try a name, ECO code, or move sequence."}
                  </p>
                  <button
                    className="os-primary"
                    onClick={() => navigate("explore")}
                  >
                    Explore openings
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {view === "learning" && (
                <section className="os-backup-panel">
                  <h2>Keep a copy of your opening book</h2>
                  <p>
                    Your list and place in each walkthrough are saved in this
                    browser.
                  </p>
                  <div className="os-inline-actions">
                    <button className="os-secondary" onClick={exportBackup}>
                      <ArrowDownToLine size={16} />
                      Export backup
                    </button>
                    <label className="os-secondary os-file-button">
                      <Plus size={16} />
                      Restore backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void restore(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </section>
              )}
            </>
          )}
          {!session && view !== "endgames" && (
            <footer className="os-footer">
              <span>
                Opening studio<span className="os-brand-dot">.</span> /
                Understand your next move.
              </span>
              <a
                href="https://github.com/lichess-org/chess-openings"
                target="_blank"
                rel="noreferrer"
              >
                Opening catalog by Lichess · CC0
                <ArrowRight size={13} />
              </a>
              <small>
                Opening-specific ideas where available, plus explanations
                grounded in each board position. Named lines, not exhaustive
                annotated grandmaster courses.
              </small>
            </footer>
          )}
        </main>
      </div>
      {importOpen && (
        <div
          className="os-modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") setImportOpen(false);
            if (e.key === "Tab") {
              const nodes = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,textarea",
                ),
              );
              if (e.shiftKey && document.activeElement === nodes[0]) {
                e.preventDefault();
                nodes.at(-1)?.focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === nodes.at(-1)
              ) {
                e.preventDefault();
                nodes[0]?.focus();
              }
            }
          }}
        >
          <section
            className="os-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <button
              className="os-modal-close os-icon-button"
              aria-label="Close PGN import"
              onClick={() => setImportOpen(false)}
            >
              <X size={20} />
            </button>
            <span className="os-eyebrow">YOUR OWN OPENING BOOK</span>
            <h2 id="import-title">Bring your own line.</h2>
            <p>
              Paste a PGN from the standard starting position. The walkthrough
              explains the moves in its main line.
            </p>
            <label>
              Line name
              <input
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              PGN
              <textarea
                autoFocus
                rows={6}
                value={pgn}
                onChange={(e) => setPgn(e.target.value)}
                placeholder="1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5"
              />
            </label>
            {importError && (
              <p className="os-error" role="alert">
                {importError}
              </p>
            )}
            <button
              className="os-primary wide"
              onClick={importLine}
              disabled={!pgn.trim()}
            >
              Add guided line
              <ArrowRight size={17} />
            </button>
            <small>
              Imports one game's main line. Imported lines use board-based
              explanations, not authored annotations.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
function SideSwitch({
  side,
  onSide,
}: {
  side: Side;
  onSide: (s: Side) => void;
}) {
  return (
    <div
      className="os-side-switch"
      role="group"
      aria-label="Choose learning side"
    >
      {(["w", "b"] as Side[]).map((s) => (
        <button
          key={s}
          className={side === s ? "active" : ""}
          aria-pressed={side === s}
          onClick={() => onSide(s)}
        >
          <span className={`os-side-dot ${s}`} />
          {sideName(s)}
        </button>
      ))}
    </div>
  );
}
function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="os-pagination">
      <button
        className="os-secondary"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="os-secondary"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
