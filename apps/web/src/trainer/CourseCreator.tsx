import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Chess } from "chess.js";
import type { OpeningCourse, OpeningLine } from "./trainerTypes";

function validateLine(line: OpeningLine): string | null {
  if (!/^[\w-]+$/.test(line.id)) return `Line id "${line.id}" must be alnum or dashes.`;
  if (!line.name.trim()) return "Line name is required.";
  if (!line.moves.length) return "Add at least one move.";
  const game = new Chess();
  try {
    for (const san of line.moves) game.move(san);
  } catch {
    return `Moves contain an invalid SAN sequence. Failed after: ${line.moves.join(" ")}`;
  }
  return null;
}

export function CourseCreator({
  onBack,
  onSave
}: {
  onBack: () => void;
  onSave: (course: OpeningCourse) => void;
}) {
  const [meta, setMeta] = useState({
    name: "",
    tagline: "",
    description: "",
    side: "w" as "w" | "b"
  });
  const [lines, setLines] = useState<OpeningLine[]>([]);
  const [draft, setDraft] = useState({ id: "", name: "", moves: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => !!meta.name.trim() && lines.length > 0,
    [meta, lines]
  );

  function addLine() {
    setError(null);
    const parsedMoves = draft.moves.trim().split(/\s+/).filter(Boolean);
    const candidate: OpeningLine = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      moves: parsedMoves,
      summary: draft.summary.trim() || meta.tagline || ""
    };
    const problem = validateLine(candidate);
    if (problem) { setError(problem); return; }
    if (lines.some((l) => l.id === candidate.id)) { setError(`Id "${candidate.id}" already used.`); return; }
    setLines((prev) => [...prev, candidate]);
    setDraft({ id: "", name: "", moves: "", summary: "" });
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function saveCourse() {
    setError(null);
    if (!meta.name.trim()) { setError("Course name is required."); return; }
    if (lines.length === 0) { setError("Add at least one line."); return; }
    const id = `user-${meta.name.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
    onSave({
      id,
      name: meta.name.trim(),
      tagline: meta.tagline.trim() || `${lines.length} custom lines`,
      description: meta.description.trim() || meta.tagline.trim() || "",
      author: "You",
      side: meta.side,
      essentials: lines.slice(0, Math.min(lines.length, 10)),
      full: lines
    });
  }

  return (
    <main className="app-shell compact-shell trainer-shell">
      <button className="text-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>
      <div className="trainer-header">
        <div>
          <p className="eyebrow">Course creator</p>
          <h1>Build your own opening course</h1>
        </div>
        <button className="primary-button" type="button" onClick={saveCourse} disabled={!canSave}>
          <Save size={16} aria-hidden="true" />
          Save course
        </button>
      </div>

      <section className="creator-form-grid">
        <div>
          <label className="creator-label" htmlFor="course-name">Course name</label>
          <input id="course-name" className="creator-input" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g. My Colle Setup" />
          <label className="creator-label" htmlFor="course-tagline">Tagline</label>
          <input id="course-tagline" className="creator-input" value={meta.tagline} onChange={(e) => setMeta({ ...meta, tagline: e.target.value })} placeholder="One sentence about the course" />
          <label className="creator-label" htmlFor="course-desc">Description</label>
          <textarea id="course-desc" className="creator-input" rows={3} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Longer plan-based description" />
          <label className="creator-label">Side</label>
          <div className="creator-side-toggle">
            <button
              className={meta.side === "w" ? "side-toggle active" : "side-toggle"}
              onClick={() => setMeta({ ...meta, side: "w" })}
              type="button"
            >
              White
            </button>
            <button
              className={meta.side === "b" ? "side-toggle active" : "side-toggle"}
              onClick={() => setMeta({ ...meta, side: "b" })}
              type="button"
            >
              Black
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong>Lines ({lines.length})</strong>
            <small className="text-muted">SAN separated by spaces — e.g. <code>d4 d5 Bf4 Nf6 e3</code></small>
          </div>
          <div className="line-editor">
            <div className="line-editor-inputs">
              <input type="text" placeholder="Line id (slug)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
              <input type="text" placeholder="Line name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <input type="text" placeholder="Moves in SAN" value={draft.moves} onChange={(e) => setDraft({ ...draft, moves: e.target.value })} />
              <input type="text" placeholder="Short summary" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </div>
            <button className="primary-button small" type="button" onClick={addLine}>
              <Plus size={14} aria-hidden="true" />
              Add line
            </button>
          </div>
          {error ? <div className="creator-error">{error}</div> : null}

          {lines.length > 0 ? (
            <ol className="created-lines">
              {lines.map((line, idx) => (
                <li key={line.id + idx}>
                  <div>
                    <strong>{line.name}</strong>
                    <small>{line.moves.join(" ")}</small>
                    <p>{line.summary}</p>
                  </div>
                  <button type="button" className="icon-button danger" onClick={() => removeLine(line.id)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No lines yet. Add at least one line above.</p>
          )}
        </div>
      </section>
    </main>
  );
}
