import { useState } from "react";
import "./moveChecklist.css";

const questions = [
  ["What changed? What do they threaten?", "Look at their last move: what does it attack, what did it stop defending, and which files or diagonals opened?"],
  ["Are my king and pieces safe?", "Scan both kings and loose pieces. Before moving a defender, check what it leaves behind."],
  ["Any checks, captures, or threats?", "Examine forcing moves for both sides. A check or capture is a candidate to investigate, not automatically a good move."],
  ["What’s their strongest reply?", "Picture your intended move, then switch sides. Look for their strongest check, capture, or threat. Don’t rely on cooperation."],
  ["Which piece can I improve?", "If nothing is urgent, give your least useful piece a better job. In the opening, prioritize the center, development, and king safety."],
  ["What’s my pawn plan?", "Look for useful pawn breaks, open files, and secure squares. Check what a pawn advance weakens before committing to it."],
  ["What position am I aiming for?", "Picture what remains after a trade. Does it help you attack, win an ending, promote a pawn, or hold a draw?"],
] as const;
const preferenceKey = "pcce-move-checklist";
type Preference = "compact" | "expanded" | "hidden";
function initialPreference(): Preference {
  try {
    const value = localStorage.getItem(preferenceKey);
    return value === "expanded" || value === "hidden" ? value : "compact";
  } catch { return "compact"; }
}

function Questions() {
  const [checked, setChecked] = useState<number[]>([]);
  return <div className="mc-questions">
    {questions.map(([question, explanation], index) => <div className="mc-question" key={question}>
      <label><input type="checkbox" checked={checked.includes(index)} onChange={event => setChecked(current => event.target.checked ? [...current, index] : current.filter(item => item !== index))} /><span><small>{index + 1}.</small> {question}</span></label>
      <details><summary>Why ask this?</summary><p>{explanation}</p></details>
    </div>)}
    <p className="mc-note">Optional reminders, not move analysis. Ticks reset when the position changes. Always check their best reply before committing.</p>
  </div>;
}

export function MoveChecklist({ positionKey }: { positionKey: string }) {
  const [preference, setPreference] = useState<Preference>(initialPreference);
  function choose(value: Preference) {
    setPreference(value);
    try { localStorage.setItem(preferenceKey, value); } catch { /* The checklist remains usable without storage. */ }
  }
  if (preference === "hidden") return <div className="move-checklist mc-hidden"><button type="button" onClick={() => choose("compact")}>Show move checklist</button></div>;
  return <section className="move-checklist" aria-label="Before you move checklist">
    <div className="mc-heading"><strong>Before you move</strong><button type="button" onClick={() => choose("hidden")} aria-label="Hide move checklist">Hide</button></div>
    <details open={preference === "expanded"} onToggle={event => {
      const expanded = event.currentTarget.open;
      if (expanded !== (preference === "expanded")) choose(expanded ? "expanded" : "compact");
    }}>
      <summary>7 questions to guide your move</summary>
      <Questions key={positionKey} />
    </details>
    {preference === "compact" && <p className="mc-memory">Change → safety → forcing moves → best reply → improve → pawn plan → destination.</p>}
  </section>;
}
