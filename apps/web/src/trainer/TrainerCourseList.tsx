import { useMemo, useState } from "react";
import { ArrowLeft, Filter, Plus, Search, Upload } from "lucide-react";
import type { OpeningCourse } from "./trainerTypes";

export type CourseListFilters = { side: "all" | "w" | "b"; query: string };

export function TrainerCourseList({
  courses,
  trainerProgress,
  onBack,
  onOpenCourse,
  onCreateCourse,
  onImportFile,
  children
}: {
  courses: OpeningCourse[];
  trainerProgress: Record<string, Record<string, { discovered?: boolean }>>;
  onBack: () => void;
  onOpenCourse: (course: OpeningCourse) => void;
  onCreateCourse: () => void;
  onImportFile: (fileContent: string) => void;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"all" | "w" | "b">("all");
  const [showSideMenu, setShowSideMenu] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (side === "w" && c.side !== "w") return false;
      if (side === "b" && c.side !== "b") return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.full.some((l) => l.moves.join(" ").toLowerCase().includes(q))
      );
    });
  }, [courses, query, side]);

  return (
    <main className="app-shell compact-shell trainer-shell">
      <div className="trainer-header">
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <button className="text-button" type="button" onClick={onBack} style={{ marginBottom: 6, marginLeft: 0 }}>
              <ArrowLeft size={18} aria-hidden="true" />
              Home
            </button>
            <p className="eyebrow">Opening trainer</p>
            <h1>Learn your openings step by step</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary-button small" type="button" onClick={onCreateCourse}>
              <Plus size={16} aria-hidden="true" />
              Create course
            </button>
            <label className="primary-button small" style={{ cursor: "pointer", marginBottom: 0 }} htmlFor="import-course-input">
              <Upload size={16} aria-hidden="true" />
              Import
              <input
                id="import-course-input"
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => onImportFile(String(reader.result));
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="trainer-search-row">
        <div className="trainer-search-box">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by open name or move sequence (e.g. d4 d5 Bf4)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="trainer-filter" style={{ position: "relative" }}>
          <button className="icon-button" type="button" onClick={() => setShowSideMenu(!showSideMenu)}>
            <Filter size={16} aria-hidden="true" />
            Side: {side === "all" ? "All" : side === "w" ? "White" : "Black"}
          </button>
          {showSideMenu ? (
            <div className="trainer-filter-menu">
              {["all", "w", "b"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSide(s as "all" | "w" | "b"); setShowSideMenu(false); }}
                >
                  {s === "all" ? "All sides" : s === "w" ? "White" : "Black"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <section className="empty-saved-games shallow">
          <h2>No courses match</h2>
          <p>Try a different search query or clear the side filter.</p>
        </section>
      ) : (
        <section className="course-grid">
          {filtered.map((course) => {
            const linesInCourse = course.full.length;
            const discoveredCount = course.full.filter((l) => trainerProgress[course.id]?.[l.id]?.discovered).length;
            const pct = linesInCourse > 0 ? Math.round((discoveredCount / linesInCourse) * 100) : 0;
            return (
              <button className="course-card" key={course.id} type="button" onClick={() => onOpenCourse(course)}>
                <span className="course-color-badge" data-color={course.side}>
                  {course.side === "w" ? "White" : "Black"}
                </span>
                <strong>{course.name}</strong>
                <small>{course.tagline}</small>
                <div className="course-progress-bar"><span style={{ width: `${pct}%` }} /></div>
                <small style={{ marginTop: 4 }}>{discoveredCount}/{linesInCourse} discovered</small>
              </button>
            );
          })}
        </section>
      )}
      {children}
    </main>
  );
}
