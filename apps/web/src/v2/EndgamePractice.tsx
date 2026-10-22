import { MissingPage, navigateRoute, usePageNavigation, updateRouteQuery, useRouteLocation } from "../navigation";
import { readStudioRoute } from "../routes";
import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { ArrowRight, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { Board } from "./Board";
import { endgames, endgameTypes, loadEndgameRecords, replayEndgame, saveEndgameRecords, type EndgamePosition } from "./endgames";
import { gameResult } from "./fullGame";
import { EndgameSession } from "./EndgameSession";

export function EndgamePractice() {
  const [records, setRecords] = useState(loadEndgameRecords);
  const [storageError, setStorageError] = useState(false);
  const url = useRouteLocation();
  const route = readStudioRoute(url);
  const position = endgames.find(p => p.id === route.position) ?? null;
  const { type, difficulty, goal, page } = route;
  usePageNavigation(`${position?.title ?? "Endgame Practice"} · Chess Learning Lab`, url.pathname);
  const setType = (value: string) => updateRouteQuery({ type: value === "all" ? null : value, page: null });
  const setDifficulty = (value: string) => updateRouteQuery({ difficulty: value === "all" ? null : value, page: null });
  const setGoal = (value: string) => updateRouteQuery({ goal: value === "all" ? null : value, page: null });
  const setPage = (value: number) => updateRouteQuery({ page: value === 1 ? null : value });
  useEffect(() => { setStorageError(!saveEndgameRecords(records)); }, [records]);
  const open = (next: EndgamePosition) => navigateRoute(`/opening-studio/endgames/${encodeURIComponent(next.id)}/${url.search}`);
  const exit = () => navigateRoute(`/opening-studio/endgames/${url.search}`);
  const filtered = endgames.filter(p => (type === "all" || p.type === type) && (difficulty === "all" || p.difficulty === difficulty) && (goal === "all" || p.goal === goal));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  return <>
    {storageError && <div className="os-notice warning" role="alert">Your browser couldn't save this endgame. Export its PGN before leaving.</div>}
    {route.position && !position ? <MissingPage embedded title="Endgame not found" href="/opening-studio/endgames/" label="Browse endgames">Choose a position from the endgame library.</MissingPage> : position ? <EndgameSession key={position.id} position={position} initialMoves={records[position.id]?.moves ?? []} onSave={moves => setRecords(old => ({ ...old, [position.id]: { moves, last: Date.now() } }))} onExit={exit} /> : <>
      <section className="os-endgame-hero"><span className="os-eyebrow"><Flag size={17} /> SKIP STRAIGHT TO THE ENDGAME</span><h1>Make the last moves count.</h1><p>Start from a real position. Convert an advantage or hold a draw, with optional hints and an opponent that replies automatically.</p><div className="os-endgame-counts"><strong>150 real-game puzzles</strong><span>5 verified draw exercises</span><span>White and Black positions</span></div></section>
      <div className="os-endgame-filters" aria-label="Endgame filters">
        <label>Endgame type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All types</option>{endgameTypes.map(t => <option value={t} key={t}>{t[0].toUpperCase() + t.slice(1)} endings</option>)}</select></label>
        <label>Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        <label>Practice goal<select value={goal} onChange={e => setGoal(e.target.value)}><option value="all">All goals</option><option value="win">Win this</option><option value="draw">Hold the draw</option></select></label>
      </div>
      <p className="os-endgame-filter-note">Easy puzzles are below 1400, medium 1400–1999, and hard 2000+. Ratings describe the initial tactic. Unrated draw exercises use an editorial difficulty level. Seven-piece positions use exact tablebase play when available; other positions use expert Stockfish.</p>
      <div className="os-section-heading"><h2>{filtered.length} {filtered.length === 1 ? "position" : "positions"} to play</h2><span>YOUR PACE · OPTIONAL HINTS</span></div>
      <div className="os-endgame-grid">
        {filtered.slice((current - 1) * 12, current * 12).map(p => {
          const record = records[p.id];
          const result = record ? gameResult(replayEndgame(p, record.moves)) : null;
          return <article className="os-endgame-card" key={p.id}>
            <div className="os-endgame-preview"><Board game={new Chess(p.fen)} side={p.side} mini /></div>
            <div className="os-endgame-card-copy"><div className="os-endgame-tags"><span>{p.type}</span><span>{p.difficulty}</span><span>{p.goal === "draw" ? "Hold the draw" : "Win this"}</span></div><h3>{p.title}</h3><p>You play {p.side === "w" ? "White" : "Black"} · {p.rating ? `Puzzle rating ${p.rating}` : "Tablebase-verified draw"}</p>{result ? <p className="os-endgame-saved">{result.title} · replay or restart</p> : record?.moves.length ? <p className="os-endgame-saved">Saved game · {record.moves.length} plies played</p> : null}<button className="os-primary wide" onClick={() => open(p)}>{record?.moves.length ? "Resume position" : "Play this position"}<ArrowRight size={16} /></button></div>
          </article>;
        })}
      </div>
      {!filtered.length && <div className="os-empty"><h2>No positions match these filters.</h2><p>Try another endgame type, difficulty or goal.</p></div>}
      {pages > 1 && <div className="os-pagination"><button className="os-secondary" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {current} of {pages}</span><button className="os-secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Next <ChevronRight size={16} /></button></div>}
      <details className="os-endgame-data"><summary>Where these positions come from</summary><p>The 150 win exercises are a curated sample of the <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer">Lichess CC0 puzzle database</a>, with ten positions for each type and difficulty band. The board starts after the puzzle's opponent setup move. The five draw exercises were separately verified against the Lichess tablebase on October 13, 2026.</p><p>These positions are a starter library, not the entire database. Each lesson links to its source. Play any legal move; you can continue beyond the puzzle's short solution until the game reaches a result.</p></details>
    </>}
  </>;
}
