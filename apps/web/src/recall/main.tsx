import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Brain, Eye, ArrowRight, RotateCcw, Eraser, CheckCircle2 } from "lucide-react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { pieceGlyphs } from "../chessGame";
import { Board } from "../v2/Board";
import { Breadcrumbs, MissingPage, RouteLink, navigateRoute, updateRouteQuery, usePageNavigation, useRouteLocation } from "../navigation";
import { choosePosition, levels, loadRound, positions, queryFor, readRecords, saveRecords, saveRound, scoreRecall, settingsFromUrl, times, type Attempt, type Pieces, type Placement, type RecallPosition, type Settings } from "./recall";
import "./recall.css";
const names: Record<PieceSymbol, string> = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const describe = (piece?: Placement) => piece ? `${piece.color === "w" ? "White" : "Black"} ${names[piece.type]}` : "empty";
function nextRound(settings: Settings, exclude?: string, same?: RecallPosition) {
  const target = same ?? choosePosition(settings.level, exclude);
  const query = queryFor(settings); query.set("round", crypto.randomUUID());
  if (same) query.set("practice", "1");
  navigateRoute(`/board-recall/challenge/${target.id}/?${query}`);
}
function RecallApp() {
  const url = useRouteLocation();
  const [stored] = useState(readRecords);
  const [attempts, setAttempts] = useState(stored.attempts);
  const [storageError, setStorageError] = useState(false);
  const settings = settingsFromUrl(url, stored.settings);
  const parts = url.pathname.slice("/board-recall".length).split("/").filter(Boolean);
  const challenge = parts[0] === "challenge" && parts.length === 2;
  const target = challenge ? positions.find(p => p.id === parts[1]) : null;
  useEffect(() => { setStorageError(!saveRecords(settings, attempts)); }, [settings.level, settings.seconds, settings.side, attempts]);
  useEffect(() => {
    if (target && !url.searchParams.get("round")) updateRouteQuery({ round: crypto.randomUUID() }, true);
  }, [url.href, target?.id]);
  usePageNavigation(`${challenge ? "Memory challenge" : "Board Recall"} · Chess Learning Lab`, url.pathname);
  const complete = (attempt: Attempt) => setAttempts(old => [attempt, ...old.filter(a => a.id !== attempt.id)].slice(0, 50));
  return <div className="recall-app">
    <header className="recall-header"><a className="recall-brand" href="/"><span aria-hidden="true">♞</span>Chess Learning Lab</a><nav aria-label="Chess features"><a href="/guided-play/">Guided Play</a><a href="/opening-studio/">Opening Studio</a><RouteLink href="/board-recall/" aria-current="page">Board Recall</RouteLink></nav></header>
    <main className="recall-main">
      <Breadcrumbs items={[{ label: "Chess homepage", href: "/" }, { label: "Board Recall", ...(challenge ? { href: `/board-recall/?${queryFor(settings)}` } : {}) }, ...(challenge ? [{ label: "Memory challenge" }] : [])]} />
      {storageError && <p className="recall-notice" role="status">This browser couldn’t save your results. You can still play this round.</p>}
      {parts.length && !target ? <MissingPage embedded title="Challenge not found" href="/board-recall/" label="Choose a new challenge">Pick a position from the Board Recall library.</MissingPage> : target ? <RecallRound key={`${target.id}:${url.searchParams.get("round")}`} target={target} settings={{ ...settings, level: target.level }} roundId={url.searchParams.get("round") ?? target.id} practice={url.searchParams.get("practice") === "1"} onComplete={complete} /> : <>
        <section className="recall-intro"><span className="recall-kicker"><Brain size={16} /> SEE IT. HIDE IT. REBUILD IT.</span><h1>Keep the board<br />in your mind.</h1><p>A brief look. A blank board. How much can you remember?<br />Train at your own pace, from a handful of pieces to full positions.</p></section>
        <div className="recall-setup"><section className="recall-panel"><h2>Your challenge</h2><fieldset><legend>Position difficulty</legend><div className="recall-levels">{levels.map(level => <button type="button" key={level.id} aria-pressed={settings.level === level.id} onClick={() => updateRouteQuery({ level: level.id }, true)}><strong>{level.label}</strong><small>{level.detail}</small></button>)}</div></fieldset><fieldset><legend>Time to look</legend><div className="recall-times">{times.map(seconds => <button type="button" key={seconds} aria-pressed={settings.seconds === seconds} onClick={() => updateRouteQuery({ seconds }, true)}>{seconds}s</button>)}</div><p className="recall-muted">Start with more time; try the two-second challenge when you’re ready.</p></fieldset><fieldset><legend>Board perspective</legend><div className="recall-times">{(["w", "b"] as Color[]).map(side => <button type="button" key={side} aria-pressed={settings.side === side} onClick={() => updateRouteQuery({ side: side === "w" ? "white" : "black" }, true)}>{side === "w" ? "White" : "Black"}</button>)}</div></fieldset><button className="recall-primary" onClick={() => nextRound(settings)}>Start challenge <ArrowRight size={18} /></button><p className="recall-muted">{positions.filter(p => p.level === settings.level).length} distinct positions at this level. No engine or account needed.</p></section>
        <aside className="recall-panel recall-guide"><Eye size={27} /><h2>Three small steps.</h2><ol><li><strong>Look for patterns.</strong><p>Notice the kings, pawn chains, and groups of pieces rather than memorizing one square at a time.</p></li><li><strong>Rebuild the position.</strong><p>Choose a piece from the tray, then tap its square. You’re placing pieces, not playing moves.</p></li><li><strong>Compare and learn.</strong><p>See what you remembered, what moved in your mind, and what you missed. Extra pieces reduce your score.</p></li></ol><div className="recall-stats"><span><strong>{attempts.length}</strong> recent rounds</span><span><strong>{attempts.length ? `${attempts[0].percent}%` : "—"}</strong> last score</span></div>{attempts[0]?.assisted && <p className="recall-muted">Your last round used a peek or repeated the same position.</p>}</aside></div>
      </>}
      <footer className="recall-footer">Position memory practice · Boards from our opening and endgame libraries. Results stay in this browser.</footer>
    </main>
  </div>;
}
function RecallRound({ target, settings, roundId, practice, onComplete }: { target: RecallPosition; settings: Settings; roundId: string; practice: boolean; onComplete: (attempt: Attempt) => void }) {
  const key = `${target.id}:${roundId}`;
  const [round, setRound] = useState(() => loadRound(key, practice));
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((round.deadline - Date.now()) / 1000)));
  const [tool, setTool] = useState<Placement | null>({ color: "w", type: "k" });
  const [undo, setUndo] = useState<Pieces[]>([]);
  const [savingError, setSavingError] = useState(false);
  const summary = useMemo(() => scoreRecall(target.pieces, round.pieces), [target.pieces, round.pieces]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setSavingError(!saveRound(key, round)); }, [key, round]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [round.phase]);
  useEffect(() => {
    if (round.phase !== "watch") return;
    const hide = () => setRound(old => old.phase === "watch" ? { ...old, phase: "rebuild" } : old);
    const clock = setInterval(() => setRemaining(Math.max(0, Math.ceil((round.deadline - Date.now()) / 1000))), 100);
    const end = setTimeout(hide, Math.max(0, round.deadline - Date.now()));
    const visibility = () => { if (document.hidden) setRound(old => old.phase === "watch" ? { ...old, phase: "rebuild", interrupted: true } : old); };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(clock); clearTimeout(end); document.removeEventListener("visibilitychange", visibility); };
  }, [round.phase, round.deadline]);
  function reveal(peek = false) {
    const seconds = peek ? 3 : settings.seconds;
    setRemaining(seconds); setRound(old => ({ ...old, phase: "watch", deadline: Date.now() + seconds * 1000, assisted: old.assisted || peek }));
  }
  function place(square: Square) {
    if (round.phase !== "rebuild") return;
    setUndo(old => [...old.slice(-99), round.pieces]);
    const pieces = { ...round.pieces };
    if (tool) pieces[square] = tool; else delete pieces[square];
    setRound(old => ({ ...old, pieces }));
  }
  function check() {
    setRound(old => ({ ...old, phase: "result" }));
    onComplete({ id: roundId, positionId: target.id, percent: summary.percent, assisted: round.assisted, level: target.level, seconds: settings.seconds, at: Date.now() });
  }
  const game = useMemo(() => new Chess(target.fen), [target.fen]);
  return <>
    <div className="recall-round-heading"><div><span className="recall-kicker">{levels.find(l => l.id === target.level)?.label} · {settings.seconds} SECOND LOOK · {settings.side === "w" ? "WHITE" : "BLACK"} PERSPECTIVE</span><h1 ref={heading} tabIndex={-1}>{round.phase === "ready" ? "Ready for a quick look?" : round.phase === "watch" ? "Take in the position." : round.phase === "rebuild" ? "Rebuild what you saw." : "Here’s what you remembered."}</h1></div><RouteLink href={`/board-recall/?${queryFor(settings)}`}>Change challenge</RouteLink></div>
    {savingError && <p className="recall-notice" role="status">Your round couldn’t be saved. Refreshing may restart it.</p>}
    <div className="recall-layout"><section className="recall-board-zone">
      {round.phase === "ready" ? <div className="recall-curtain"><Brain size={56} /><h2>{Object.keys(target.pieces).length} pieces. {settings.seconds} seconds.</h2><p>The position appears only when you’re ready.</p><button className="recall-primary" onClick={() => reveal()}>Reveal position <Eye size={18} /></button></div> : round.phase === "watch" ? <><div className="recall-countdown"><span>Memorize the position</span><strong role="timer" aria-label={`${remaining} seconds remaining`}>{remaining}s</strong></div><Board game={game} side={settings.side} /><button className="recall-secondary" onClick={() => setRound(old => ({ ...old, phase: "rebuild" }))}>I’m ready — hide it</button></> : <><div className="recall-countdown"><span>{round.phase === "result" ? "Your reconstruction" : `Selected: ${tool ? describe(tool) : "eraser"}`}</span><span>{Object.keys(round.pieces).length} pieces placed</span></div><PlacementBoard pieces={round.pieces} side={settings.side} onPlace={place} interactive={round.phase === "rebuild"} score={round.phase === "result" ? summary : undefined} /></>}
      {round.phase === "rebuild" && <div className="recall-controls"><button className="recall-secondary" disabled={!undo.length} onClick={() => { setRound(old => ({ ...old, pieces: undo[undo.length - 1] })); setUndo(old => old.slice(0, -1)); }}>Undo placement</button><button className="recall-secondary" disabled={!Object.keys(round.pieces).length} onClick={() => { setUndo(old => [...old, round.pieces]); setRound(old => ({ ...old, pieces: {} })); }}>Clear board</button></div>}
    </section><aside className="recall-panel">
      {round.phase === "ready" || round.phase === "watch" ? <><Eye size={26} /><h2>Think in groups.</h2><p>Locate both kings first. Notice pawn shapes, then connect the other pieces to those landmarks.</p><p>When the board disappears, use the piece tray to reconstruct it. You can change any placement before checking.</p><p className="recall-muted">Leaving the tab during the timed look hides the position. Refreshing keeps the original deadline.</p></> : round.phase === "rebuild" ? <><h2>Your piece tray</h2><p>Choose a piece, then tap a square. Use the eraser to remove one.</p>{(["w", "b"] as Color[]).map(color => <div className="recall-tray" key={color} role="group" aria-label={`${color === "w" ? "White" : "Black"} pieces`}>{(["k", "q", "r", "b", "n", "p"] as PieceSymbol[]).map(type => <button key={type} aria-label={`Place ${describe({ type, color })}`} aria-pressed={tool?.type === type && tool.color === color} onClick={() => setTool({ type, color })}><span className={`recall-glyph ${color}`} aria-hidden="true">{pieceGlyphs[color][type]}</span></button>)}</div>)}<button className="recall-secondary" aria-pressed={!tool} onClick={() => setTool(null)}><Eraser size={17} /> Eraser</button><button className="recall-primary wide" onClick={check}>Check my position <CheckCircle2 size={18} /></button><button className="recall-secondary wide" onClick={() => reveal(true)}>Peek again for 3 seconds</button><p className="recall-muted">A peek marks this as an assisted round.</p>{round.interrupted && <p className="recall-notice">The position was hidden when you left the tab.</p>}</> : <><span className="recall-kicker">{round.assisted ? "ASSISTED PRACTICE" : "YOUR RESULT"}</span><div className="recall-score">{summary.percent}<span>%</span></div><h2>{summary.correct.length} of {summary.count} pieces correct</h2><p>{summary.wrong.length} incorrect placements · {summary.missing.length} pieces missing or different.</p><p className="recall-muted">Green: correct. Red: incorrect. Amber: a missing piece. Extra pieces reduce the score.</p><h3>Original position</h3><Board game={game} side={settings.side} mini /><p>{target.title}</p><details><summary>Review the differences</summary>{summary.missing.length || summary.wrong.length ? <ul className="recall-differences">{Array.from(new Set([...summary.missing, ...summary.wrong])).sort().map(square => <li key={square}><strong>{square}</strong>: expected {describe(target.pieces[square])}; you placed {describe(round.pieces[square])}.</li>)}</ul> : <p>Every piece is on the correct square.</p>}</details><button className="recall-primary wide" onClick={() => nextRound(settings, target.id)}>Next position <ArrowRight size={18} /></button><button className="recall-secondary wide" onClick={() => nextRound(settings, undefined, target)}><RotateCcw size={16} /> Practice this position again</button></>}
    </aside></div>
  </>;
}
function PlacementBoard({ pieces, side, onPlace, interactive, score }: { pieces: Pieces; side: Color; onPlace: (square: Square) => void; interactive: boolean; score?: ReturnType<typeof scoreRecall> }) {
  const [focus, setFocus] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const files = side === "w" ? "abcdefgh" : "hgfedcba", ranks = side === "w" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  return <div className="os-board recall-placement" role="group" aria-label={`${side === "w" ? "White" : "Black"} perspective reconstruction board`}>{ranks.flatMap((rank, row) => Array.from(files).map((file, col) => {
    const square = `${file}${rank}` as Square, index = row * 8 + col, piece = pieces[square];
    const mark = score?.correct.includes(square) ? "correct" : score?.wrong.includes(square) ? "wrong" : score?.missing.includes(square) ? "missing" : "";
    return <button type="button" key={square} ref={node => { refs.current[index] = node; }} className={`os-square ${(row + col) % 2 ? "dark" : "light"} ${mark}`} aria-label={`${square}: ${describe(piece)}${mark ? `, ${mark}` : ""}`} disabled={!interactive} tabIndex={index === focus ? 0 : -1} onFocus={() => setFocus(index)} onClick={() => onPlace(square)} onKeyDown={event => {
      const offset = ({ ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 } as Record<string,number>)[event.key];
      if (offset) { event.preventDefault(); const next = (index + offset + 64) % 64; setFocus(next); refs.current[next]?.focus(); }
    }}><span className="os-coordinate" aria-hidden="true">{square}</span>{piece && <span className={`os-classic-piece ${piece.color}`} aria-hidden="true">{pieceGlyphs[piece.color][piece.type]}</span>}</button>;
  }))}</div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><RecallApp /></StrictMode>);
