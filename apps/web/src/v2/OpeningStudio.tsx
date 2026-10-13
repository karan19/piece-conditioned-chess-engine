import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Flame,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
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
  completeLine,
  dueLines,
  loadProgress,
  recordKey,
  saveProgress,
  streak,
  type Progress,
} from "./progress";
import { Training, modeLabels, type Mode } from "./Training";

type View = "explore" | "repertoire" | "review" | "progress";
type Session = { lines: Opening[]; index: number; mode: Mode };
const navItems = [
  { id: "explore", label: "Explore openings", icon: Compass },
  { id: "repertoire", label: "My repertoire", icon: Bookmark },
  { id: "review", label: "Spaced review", icon: Clock3 },
  { id: "progress", label: "My progress", icon: TrendingUp },
] as const;
const sideName = (side: Side) => (side === "w" ? "White" : "Black");
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const canTrain = (o: Opening, side: Side) =>
  o.moves.length > (side === "w" ? 0 : 1);

function Card({
  family,
  side,
  saved,
  learned,
  onOpen,
  onSave,
}: {
  family: Family;
  side: Side;
  saved: boolean;
  learned: number;
  onOpen: () => void;
  onSave: () => void;
}) {
  const game = useMemo(
    () =>
      gameAt(
        family.representative,
        Math.min(family.representative.moves.length, 12),
      ),
    [family],
  );
  return (
    <article className="os-course-card">
      <button
        className="os-card-art"
        aria-label={`Explore ${family.name}`}
        onClick={onOpen}
      >
        <span className="os-card-code">{family.representative.eco}</span>
        <Board game={game} side={side} mini />
        <span className="os-card-side">{sideName(side)}</span>
      </button>
      <div className="os-card-copy">
        <div className="os-card-kind">
          <span>{family.category}</span>
          <button
            className={`os-bookmark ${saved ? "active" : ""}`}
            aria-label={`${saved ? "Remove" : "Save"} ${family.name} ${saved ? "from" : "to"} repertoire`}
            aria-pressed={saved}
            onClick={onSave}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
        <button className="os-card-title" onClick={onOpen}>
          {family.name}
        </button>
        <p>{description(family)}</p>
        <div className="os-card-bottom">
          <span>
            {family.lines.length.toLocaleString()}{" "}
            {family.lines.length === 1 ? "line" : "variations"}
            {learned > 0 ? ` · ${learned} learned` : ""}
          </span>
          <button aria-label={`Open ${family.name}`} onClick={onOpen}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function OpeningStudio() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [view, setView] = useState<View>("explore");
  const [side, setSide] = useState<Side>("w");
  const [family, setFamily] = useState<Family | null>(null);
  const [selectedLine, setSelectedLine] = useState<Opening | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [lineSearch, setLineSearch] = useState("");
  const [linePage, setLinePage] = useState(1);
  const [depth, setDepth] = useState("all");
  const [previewPly, setPreviewPly] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importPgn, setImportPgn] = useState("");
  const [importError, setImportError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const modalReturn = useRef<HTMLElement | null>(null);
  const customFamilies = useMemo<Family[]>(
    () =>
      progress.custom.map((o) => ({
        name: o.name,
        lines: [o],
        representative: o,
        category: "Your line",
      })),
    [progress.custom],
  );
  const allFamilies = useMemo(
    () => [...families, ...customFamilies],
    [customFamilies],
  );
  const allOpenings = useMemo(
    () => [...openings, ...progress.custom],
    [progress.custom],
  );
  useEffect(() => {
    setStorageError(!saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      const s = params.get("side") === "b" ? "b" : "w";
      setSide(s);
      const f = allFamilies.find((f) =>
        params.get("custom")
          ? f.representative.id === params.get("custom")
          : f.name === params.get("family"),
      );
      setFamily(f ?? null);
      setSelectedLine(f?.representative ?? null);
      setPreviewPly(0);
      setLineSearch(params.get("q") ?? "");
      setLinePage(1);
      setDepth("all");
      setSession(null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [allFamilies]);
  useEffect(() => {
    setPage(1);
  }, [search, filter, view, side]);
  useEffect(() => {
    setLinePage(1);
  }, [lineSearch, depth]);
  useEffect(() => {
    if (!importOpen) return;
    modalReturn.current = document.activeElement as HTMLElement;
    importRef.current?.focus();
    return () => modalReturn.current?.focus();
  }, [importOpen]);
  const navigate = (next: View) => {
    setView(next);
    setFamily(null);
    setSession(null);
    setSummary(null);
    setSearch("");
    setFilter("all");
    history.replaceState(
      null,
      "",
      location.pathname + location.search + "#side=" + side,
    );
    window.scrollTo(0, 0);
  };
  const openFamily = (f: Family) => {
    setSummary(null);
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
        ...(lineSearch ? { q: lineSearch } : {}),
      }).toString();
  };
  const toggleSave = (f: Family) => {
    const key = `${side}:${f.name}`;
    setProgress((p) => ({
      ...p,
      saved: p.saved.includes(key)
        ? p.saved.filter((x) => x !== key)
        : [...p.saved, key],
    }));
  };
  const due = dueLines(progress, allOpenings, side);
  const learned = allOpenings.filter((o) =>
    Boolean(progress.records[recordKey(o, side)]),
  );
  const reviews = Object.values(progress.records).reduce(
    (sum, r) => sum + r.attempts,
    0,
  );
  const selectedLines = useMemo(
    () =>
      family?.lines.filter(
        (o) =>
          (depth === "all" ||
            (depth === "quick" ? o.moves.length <= 12 : o.moves.length > 12)) &&
          normalize(`${o.name} ${o.eco} ${o.pgn}`).includes(
            normalize(lineSearch),
          ),
      ) ?? [],
    [family, lineSearch, depth],
  );
  const filtered = useMemo(
    () =>
      allFamilies
        .filter((f) => {
          if (
            view === "repertoire" &&
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
    [allFamilies, progress.saved, side, search, filter, view],
  );
  const start = (mode: Mode, lines: Opening[]) => {
    let pool = lines.filter((o) => canTrain(o, side));
    if (mode === "practice") pool = dueLines(progress, pool, side);
    if (mode === "learn")
      pool = [
        ...pool.filter((o) => !progress.records[recordKey(o, side)]),
        ...pool.filter((o) => progress.records[recordKey(o, side)]),
      ];
    if (mode === "drill" || mode === "time") pool = shuffle(pool);
    if (!pool.length) {
      setNotice(
        mode === "practice"
          ? "No lines are due here. Learn a line first, or use Drill to practice anytime."
          : "This position has no move for your side yet. Choose a longer variation to train it.",
      );
      return;
    }
    setSession({ mode, lines: pool.slice(0, 10), index: 0 });
    setSummary(null);
    setNotice("");
    window.scrollTo(0, 0);
  };
  const current = session?.lines[session.index];
  const onComplete = useCallback(
    (clean: boolean, review: boolean) => {
      if (current)
        setProgress((p) => completeLine(p, current, side, clean, review));
    },
    [current, side],
  );
  const next = () => {
    if (!session) return;
    if (session.index + 1 === session.lines.length) {
      setSummary(
        "Session finished. Your completed lines and review schedule are saved on this device.",
      );
      setSession(null);
    } else setSession({ ...session, index: session.index + 1 });
  };
  const exportProgress = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), side, progress },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opening-studio-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportLine = () => {
    if (!selectedLine) return;
    const blob = new Blob(
      [
        `[Event "Opening Studio"]\n[Opening "${selectedLine.name.replace(/["\\]/g, "")}"]\n[Result "*"]\n\n${selectedLine.pgn} *\n`,
      ],
      { type: "application/x-chess-pgn" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opening-line.pgn";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importLine = () => {
    try {
      const opening = parseImportedPgn(importPgn, importTitle);
      setProgress((p) => ({
        ...p,
        custom: [...p.custom.filter((o) => o.id !== opening.id), opening],
      }));
      setImportOpen(false);
      setImportError("");
      setImportTitle("");
      setImportPgn("");
      navigate("repertoire");
      setNotice("Your line was imported. Open it to train as either side.");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Couldn't read this PGN.",
      );
    }
  };
  const restoreBackup = async (file: File) => {
    try {
      if (file.size > 5000000)
        throw new Error("Choose a backup smaller than 5 MB.");
      const value = JSON.parse(await file.text());
      const p = value.progress;
      if (
        value.version !== 1 ||
        p?.version !== 1 ||
        !p.records ||
        typeof p.records !== "object" ||
        !Array.isArray(p.custom) ||
        !Array.isArray(p.saved) ||
        !p.activity
      )
        throw new Error("Choose an Opening Studio backup JSON file.");
      const custom = p.custom.map((o: Opening) =>
        parseImportedPgn(o.pgn, o.name),
      );
      const records: Progress["records"] = {};
      for (const [key, value] of Object.entries(p.records)) {
        const r = value as Progress["records"][string];
        if (
          !r ||
          ![r.attempts, r.box, r.due, r.learned, r.last].every(
            Number.isFinite,
          ) ||
          r.box < 0 ||
          r.box > 5
        )
          throw new Error("This backup contains invalid progress.");
        records[key] = r;
      }
      const activity: Record<string, number> = {};
      for (const [day, n] of Object.entries(p.activity)) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
          typeof n !== "number" ||
          !Number.isFinite(n) ||
          n < 0
        )
          throw new Error("This backup contains invalid activity.");
        activity[day] = n;
      }
      setProgress((old) => ({
        ...old,
        records: { ...old.records, ...records },
        custom: [
          ...old.custom,
          ...custom.filter(
            (o: Opening) => !old.custom.some((c) => c.id === o.id),
          ),
        ],
        saved: Array.from(
          new Set([
            ...old.saved,
            ...p.saved.filter((s: unknown) => typeof s === "string"),
          ]),
        ),
        activity: { ...old.activity, ...activity },
      }));
      setNotice("Backup restored. Existing lines and progress were retained.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Couldn't restore the backup.",
      );
    }
  };
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const linePages = Math.max(1, Math.ceil(selectedLines.length / 25));
  const currentLinePage = Math.min(linePage, linePages);
  const preview = selectedLine ? gameAt(selectedLine, previewPly) : null;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: progress.activity[d.toLocaleDateString("en-CA")] ?? 0,
    };
  });
  return (
    <div className="os-app">
      <aside className="os-sidebar">
        <a className="os-brand" href="/v2/">
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
        <span className="os-sidebar-caption">MAKE YOUR FIRST MOVES COUNT</span>
        <nav aria-label="Opening Studio navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "review" && due.length > 0 && (
                <span className="os-nav-count">{due.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="os-sidebar-card">
          <Sparkles size={21} />
          <h3>A little, every day.</h3>
          <p>Learn a line. Let it settle. Come back when it’s time.</p>
          <button
            onClick={() => {
              navigate("review");
            }}
          >
            {due.length
              ? `${due.length} lines ready to review`
              : "Find your rhythm"}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="os-sidebar-bottom">
          <a href="/" className="os-v1-link">
            <ArrowLeft size={16} /> Piece-conditioned engine
          </a>
          <span>OPENING STUDIO / V2</span>
        </div>
      </aside>
      <div className="os-main">
        <header className="os-topbar">
          <span className="os-breadcrumb">Your next move starts here</span>
          <div className="os-topbar-actions">
            <span className="os-streak">
              <Flame size={17} /> {streak(progress)} day streak
            </span>
            <span className="os-local-badge">
              <span /> Saved on this device
            </span>
          </div>
        </header>
        <main className="os-content">
          {storageError && (
            <div className="os-notice warning" role="alert">
              Your browser couldn't save progress. Export a backup before
              leaving this page.
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
          {summary && (
            <div className="os-notice success" role="status">
              <Check size={18} />
              {summary}
              <button
                aria-label="Dismiss session summary"
                onClick={() => setSummary(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {session && current ? (
            <Training
              key={`${current.id}:${session.index}:${session.mode}:${side}`}
              opening={current}
              side={side}
              mode={session.mode}
              index={session.index}
              total={session.lines.length}
              onExit={() => setSession(null)}
              onNext={next}
              onComplete={onComplete}
            />
          ) : family ? (
            <>
              <button
                className="os-link os-back"
                onClick={() => navigate(view)}
              >
                <ArrowLeft size={17} /> Back to{" "}
                {view === "repertoire" ? "my repertoire" : "openings"}
              </button>
              <div className="os-detail-heading">
                <div>
                  <span className="os-eyebrow">
                    {family.representative.eco} · {family.category}
                  </span>
                  <h1>{family.name}</h1>
                  <p>{description(family)}</p>
                </div>
                <button
                  className="os-secondary"
                  onClick={() => toggleSave(family)}
                >
                  <Bookmark
                    size={17}
                    fill={
                      progress.saved.includes(`${side}:${family.name}`)
                        ? "currentColor"
                        : "none"
                    }
                  />
                  {progress.saved.includes(`${side}:${family.name}`)
                    ? "In repertoire"
                    : "Save course"}
                </button>
              </div>
              <div className="os-detail-meta">
                <div
                  className="os-side-switch"
                  role="group"
                  aria-label="Choose training side"
                >
                  {(["w", "b"] as Side[]).map((s) => (
                    <button
                      className={side === s ? "active" : ""}
                      key={s}
                      aria-pressed={side === s}
                      onClick={() => chooseSide(s)}
                    >
                      <span className={`os-side-dot ${s}`} />
                      {sideName(s)}
                    </button>
                  ))}
                </div>
                <span>
                  <Layers3 size={16} />
                  {family.lines.length} named lines
                </span>
                <span>
                  <Check size={16} />
                  {
                    family.lines.filter(
                      (o) => progress.records[recordKey(o, side)],
                    ).length
                  }{" "}
                  learned as {sideName(side)}
                </span>
              </div>
              <div className="os-mode-grid">
                {(
                  [
                    {
                      mode: "learn",
                      icon: BookOpen,
                      description: "Follow the moves with guidance.",
                    },
                    {
                      mode: "practice",
                      icon: Clock3,
                      description: "Review learned lines when they're due.",
                    },
                    {
                      mode: "drill",
                      icon: Target,
                      description: "Recall random lines without prompts.",
                    },
                    {
                      mode: "time",
                      icon: TimerIcon,
                      description: "Complete each line in 60 seconds.",
                    },
                  ] as const
                ).map(({ mode, icon: Icon, description }) => (
                  <button
                    key={mode}
                    className={mode === "learn" ? "featured" : ""}
                    onClick={() => start(mode, selectedLines)}
                  >
                    <Icon size={21} />
                    <strong>{modeLabels[mode]}</strong>
                    <span>{description}</span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="os-detail-layout">
                <section className="os-lines-panel">
                  <div className="os-section-title">
                    <h2>Explore the variations</h2>
                    <span>{selectedLines.length} lines</span>
                  </div>
                  <label className="os-search compact">
                    <Search size={17} />
                    <input
                      placeholder="Search variations, ECO or moves…"
                      aria-label="Search variations"
                      value={lineSearch}
                      onChange={(e) => setLineSearch(e.target.value)}
                    />
                  </label>
                  <label className="os-depth">
                    Line length{" "}
                    <select
                      value={depth}
                      onChange={(e) => setDepth(e.target.value)}
                    >
                      <option value="all">All lengths</option>
                      <option value="quick">Quick lines · up to 6 moves</option>
                      <option value="deep">Longer lines · over 6 moves</option>
                    </select>
                  </label>
                  <div className="os-lines">
                    {selectedLines
                      .slice((currentLinePage - 1) * 25, currentLinePage * 25)
                      .map((o) => (
                        <button
                          key={o.id}
                          className={selectedLine?.id === o.id ? "active" : ""}
                          onClick={() => {
                            setSelectedLine(o);
                            setPreviewPly(0);
                          }}
                        >
                          <span className="os-line-icon">
                            {progress.records[recordKey(o, side)] ? (
                              <Check size={16} />
                            ) : (
                              <BookOpen size={16} />
                            )}
                          </span>
                          <span>
                            <strong>
                              {o.name.includes(":")
                                ? o.name.split(":").slice(1).join(":")
                                : "Main position"}
                            </strong>
                            <small>
                              {o.eco} · {Math.ceil(o.moves.length / 2)} moves
                              {progress.records[recordKey(o, side)]
                                ? ` · Box ${progress.records[recordKey(o, side)].box}`
                                : ""}
                            </small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                  </div>
                  {!selectedLines.length && (
                    <p className="os-empty-inline">
                      No variations match this search.
                    </p>
                  )}
                  <Pagination
                    page={currentLinePage}
                    pages={linePages}
                    onPage={setLinePage}
                  />
                </section>
                <section className="os-preview-panel">
                  {selectedLine && preview && (
                    <>
                      <div className="os-preview-heading">
                        <div>
                          <span className="os-label">LINE PREVIEW</span>
                          <h3>{selectedLine.name}</h3>
                        </div>
                        <button
                          className="os-icon-button"
                          onClick={exportLine}
                          aria-label="Export selected line as PGN"
                        >
                          <ArrowDownToLine size={18} />
                        </button>
                      </div>
                      <Board
                        game={preview}
                        side={side}
                        last={preview.history({ verbose: true }).at(-1)}
                      />
                      <div className="os-preview-controls">
                        <button
                          className="os-icon-button"
                          aria-label="Start of line"
                          disabled={previewPly === 0}
                          onClick={() => setPreviewPly(0)}
                        >
                          <RotateStart />
                        </button>
                        <button
                          className="os-icon-button"
                          aria-label="Previous move"
                          disabled={previewPly === 0}
                          onClick={() => setPreviewPly((p) => p - 1)}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span>
                          {previewPly}/{selectedLine.moves.length} plies
                        </span>
                        <button
                          className="os-icon-button"
                          aria-label="Next move"
                          disabled={previewPly === selectedLine.moves.length}
                          onClick={() => setPreviewPly((p) => p + 1)}
                        >
                          <ChevronRight size={20} />
                        </button>
                        <button
                          className="os-icon-button"
                          aria-label="End of line"
                          disabled={previewPly === selectedLine.moves.length}
                          onClick={() =>
                            setPreviewPly(selectedLine.moves.length)
                          }
                        >
                          <ArrowRight size={18} />
                        </button>
                      </div>
                      <p className="os-preview-pgn">{selectedLine.pgn}</p>
                      <button
                        className="os-primary wide"
                        onClick={() => start("learn", [selectedLine])}
                        disabled={!canTrain(selectedLine, side)}
                      >
                        Learn this line <ArrowRight size={18} />
                      </button>
                      {!canTrain(selectedLine, side) && (
                        <p className="os-muted">
                          This position is reached before Black moves. Choose a
                          longer variation to train as Black.
                        </p>
                      )}
                    </>
                  )}
                </section>
              </div>
            </>
          ) : view === "progress" ? (
            <>
              <PageHeading
                eyebrow="EVERY MOVE ADDS UP"
                title="Small steps. Stronger openings."
                description="Your practice history, one line at a time. Progress is private and saved in this browser."
              />
              <div className="os-stat-grid">
                <Stat
                  icon={BookOpen}
                  value={learned.length}
                  label={`Lines learned as ${sideName(side)}`}
                />
                <Stat
                  icon={Target}
                  value={reviews}
                  label="Lines completed · both sides"
                />
                <Stat
                  icon={Clock3}
                  value={due.length}
                  label={`Due for ${sideName(side)}`}
                />
                <Stat
                  icon={Flame}
                  value={streak(progress)}
                  label="Day streak"
                />
              </div>
              <div className="os-progress-layout">
                <section className="os-white-panel">
                  <h2>Your last seven days</h2>
                  <div className="os-activity-chart">
                    {week.map((day, i) => (
                      <div key={i}>
                        <span>{day.value}</span>
                        <div className="os-activity-column">
                          <div
                            style={{
                              height: `${Math.max(3, (day.value / Math.max(1, ...week.map((d) => d.value))) * 100)}%`,
                            }}
                          />
                        </div>
                        <small>{day.label}</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="os-white-panel">
                  <h2>A little less forgetting.</h2>
                  <p>
                    Guided learning makes a line ready for review. A correct,
                    unassisted review moves it into the next box: 1, 3, 7, 14,
                    then 30 days. A mistake or hint keeps it due for another
                    attempt.
                  </p>
                  <button
                    className="os-primary"
                    onClick={() => navigate("review")}
                  >
                    Go to review <ArrowRight size={17} />
                  </button>
                </section>
              </div>
              <div className="os-section-title">
                <h2>Keep your progress with you</h2>
              </div>
              <p className="os-muted">
                There’s no account or cloud sync. Export a backup to move your
                repertoire and progress to another browser.
              </p>
              <div className="os-inline-actions">
                <button className="os-secondary" onClick={exportProgress}>
                  <ArrowDownToLine size={17} /> Export backup
                </button>
                <label className="os-secondary os-file-button">
                  <Plus size={17} /> Restore backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void restoreBackup(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </>
          ) : view === "review" ? (
            <>
              <PageHeading
                eyebrow="MAKE IT SECOND NATURE"
                title="Come back. Remember more."
                description="Your learned lines return when they're due. Play them from memory to make the next review a little further away."
              />
              <div className="os-review-heading">
                <SideSwitch side={side} onSide={chooseSide} />
                <span>
                  {due.length} lines due · {learned.length} learned
                </span>
                {due.length > 0 && (
                  <button
                    className="os-primary"
                    onClick={() => start("practice", due)}
                  >
                    Review {Math.min(10, due.length)} lines{" "}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
              {due.length ? (
                <div className="os-review-list">
                  {due.slice(0, 50).map((o) => (
                    <button key={o.id} onClick={() => start("practice", [o])}>
                      <span className="os-review-icon">
                        <Clock3 size={22} />
                      </span>
                      <span>
                        <strong>{o.name}</strong>
                        <small>
                          {o.eco} · {Math.ceil(o.moves.length / 2)} moves · Box{" "}
                          {progress.records[recordKey(o, side)].box}
                        </small>
                      </span>
                      <span className="os-tag">Due now</span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                  {due.length > 50 && (
                    <p className="os-muted">
                      Showing the first 50 due lines. Complete a session to work
                      through the queue.
                    </p>
                  )}
                </div>
              ) : (
                <Empty
                  icon={Clock3}
                  title={
                    learned.length
                      ? "You're all caught up."
                      : "Your first review starts with a line."
                  }
                  description={
                    learned.length
                      ? "Your next reviews will appear here when they're due. Drill a course if you want more practice today."
                      : "Pick an opening and complete a guided line. It will be ready here for your first memory test."
                  }
                  action="Explore openings"
                  onAction={() => navigate("explore")}
                />
              )}
            </>
          ) : (
            <>
              <div className="os-hero">
                <div>
                  <span className="os-eyebrow">
                    {view === "repertoire"
                      ? "YOUR OWN PLAYBOOK"
                      : "THE OPENING LIBRARY"}
                  </span>
                  <h1>
                    {view === "repertoire" ? (
                      <>
                        Your openings.
                        <br />
                        <em>Your way.</em>
                      </>
                    ) : (
                      <>
                        A good game starts
                        <br />
                        with <em>a good opening.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {view === "repertoire"
                      ? "Keep your favorite courses together. Add your own lines, and build a repertoire you can actually remember."
                      : "Find your next opening. Understand the moves. Make them second nature, one line at a time."}
                    <br />
                  </p>
                  <div className="os-hero-chips">
                    <span>
                      <Layers3 size={15} /> {openings.length.toLocaleString()}{" "}
                      named lines
                    </span>
                    <span>
                      <Piece type="p" color="w" /> White & Black
                    </span>
                    <span>
                      <Clock3 size={15} /> Spaced repetition
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
                    A MOVE TODAY.
                    <br />
                    AN INSTINCT TOMORROW.
                  </span>
                  <span className="os-hero-plus">+</span>
                </div>
              </div>
              <div className="os-library-heading">
                <div>
                  <h2>
                    {view === "repertoire"
                      ? "My repertoire"
                      : "Find your opening"}
                  </h2>
                  <p>
                    {view === "repertoire"
                      ? "Saved courses are organized by the side you play."
                      : `${families.length} opening families. Explore every included line from either side.`}
                  </p>
                </div>
                <button
                  className="os-secondary"
                  onClick={() => {
                    setImportOpen(true);
                    setImportError("");
                  }}
                >
                  <Plus size={17} /> Import a PGN
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
              {filtered.length > 0 ? (
                <>
                  <div className="os-course-grid">
                    {filtered
                      .slice((currentPage - 1) * 12, currentPage * 12)
                      .map((f) => (
                        <Card
                          key={`${f.name}:${f.representative.id}`}
                          family={f}
                          side={side}
                          saved={progress.saved.includes(`${side}:${f.name}`)}
                          learned={
                            f.lines.filter(
                              (o) => progress.records[recordKey(o, side)],
                            ).length
                          }
                          onOpen={() => openFamily(f)}
                          onSave={() => toggleSave(f)}
                        />
                      ))}
                  </div>
                  <Pagination
                    page={currentPage}
                    pages={pages}
                    onPage={(p) => {
                      setPage(p);
                      document
                        .querySelector(".os-library-heading")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                </>
              ) : (
                <Empty
                  icon={view === "repertoire" ? Bookmark : Search}
                  title={
                    view === "repertoire" && !search
                      ? "Your repertoire starts here."
                      : "No openings found."
                  }
                  description={
                    view === "repertoire" && !search
                      ? "Bookmark a course from the library, or import a PGN to train your own lines."
                      : "Try an opening name, ECO code, or a move sequence like 1. e4 c5."
                  }
                  action="Explore all openings"
                  onAction={() => navigate("explore")}
                />
              )}
            </>
          )}
          {!session && (
            <footer className="os-footer">
              <span>
                Opening studio<span className="os-brand-dot">.</span>{" "}
                <span className="os-footer-divider">/</span> Learn your next
                move.
              </span>
              <a
                href="https://github.com/lichess-org/chess-openings"
                target="_blank"
                rel="noreferrer"
              >
                Opening catalog by Lichess · CC0 <ArrowRight size={13} />
              </a>
              <small>
                Complete catalog of the included database. Named positions and
                lines, not annotated grandmaster courses.
              </small>
            </footer>
          )}
        </main>
      </div>
      {importOpen && (
        <div
          className="os-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setImportOpen(false);
            if (e.key === "Tab") {
              const nodes = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,textarea",
                ),
              );
              const first = nodes[0],
                last = nodes.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
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
            <span className="os-eyebrow">YOUR OWN PLAYBOOK</span>
            <h2 id="import-title">Bring your own line.</h2>
            <p>
              Paste a main-line PGN from the standard starting position. You can
              train it as White or Black.
            </p>
            <label>
              Line name
              <input
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="My favorite Sicilian line"
                maxLength={160}
              />
            </label>
            <label>
              PGN
              <textarea
                ref={importRef}
                value={importPgn}
                onChange={(e) => setImportPgn(e.target.value)}
                placeholder="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6"
                rows={6}
              />
            </label>
            <label className="os-file-button os-link">
              Or load a .pgn file
              <input
                type="file"
                accept=".pgn,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1000000) {
                    setImportError("Choose a PGN smaller than 1 MB.");
                    return;
                  }
                  setImportPgn(await f.text());
                }}
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
              disabled={!importPgn.trim()}
            >
              Import & start learning <ArrowRight size={18} />
            </button>
            <small>
              Imports the main line of one game. Variations in parentheses are
              not separate lessons.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
function TimerIcon({ size = 20 }: { size?: number }) {
  return <Clock3 size={size} />;
}
function RotateStart() {
  return <ChevronLeft size={18} />;
}
function SideSwitch({
  side,
  onSide,
}: {
  side: Side;
  onSide: (side: Side) => void;
}) {
  return (
    <div
      className="os-side-switch"
      role="group"
      aria-label="Choose training side"
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
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="os-page-heading">
      <span className="os-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
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
        <ChevronLeft size={16} /> Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        className="os-secondary"
        disabled={page === pages}
        onClick={() => onPage(page + 1)}
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen;
  value: number;
  label: string;
}) {
  return (
    <div className="os-stat">
      <Icon size={21} />
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="os-empty">
      <Icon size={35} />
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="os-primary" onClick={onAction}>
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
