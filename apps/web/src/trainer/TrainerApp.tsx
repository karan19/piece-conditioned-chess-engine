import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  DollarSign,
  Droplet,
  Play,
  Plus,
  RotateCcw,
  Search,
  Swords,
  Target,
  Timer,
  Unlock,
  Upload
} from "lucide-react";
import { Chess, type Square } from "chess.js";
import { openingCourses } from "./openingData";
import type { CourseProgress, OpeningCourse, OpeningLine, TrainerMode } from "./trainerTypes";
import { isDueToday, makeEmptyLineProgress, maxBox } from "./srs";
import { loadTrainerProgress, saveTrainerProgress } from "./trainerStorage";
import {
  loadUserCourses,
  saveUserCourses
} from "./userCourseStorage";
import { cloneGameWithMove, createGame, getBoardPieces, getLegalDestinations, toMoveRecords, type BoardPiece } from "../chessGame";
import { requestEval } from "../engineClient";
import { TrainerBoard } from "./TrainerBoard";
import { TrainerCourseList } from "./TrainerCourseList";
import { CourseCreator } from "./CourseCreator";
import "../styles.css";

type ScreenState = "course-list" | "course-detail" | "train" | "creator";
type SessionKind = "learn" | "practice" | "drill" | "time" | "puzzles" | "arena";

const modePresets: Record<TrainerMode, { label: string; icon: typeof Play; hint: string; secondsPerMove: number; hintsOn: boolean }> = {
  learn: { label: "Learn", icon: Play, hint: "Guided discovery; auto-reply and hints available.", secondsPerMove: 0, hintsOn: true },
  practice: { label: "Practice", icon: Unlock, hint: "Review due discovered lines without hints.", secondsPerMove: 0, hintsOn: false },
  drill: { label: "Drill", icon: Droplet, hint: "Rapid-fire repeat on every line in the course.", secondsPerMove: 0, hintsOn: false },
  time: { label: "Time", icon: Timer, hint: "Answer fast; correct adds seconds, wrong costs you the line.", secondsPerMove: 8, hintsOn: false },
  puzzles: { label: "Puzzles", icon: Target, hint: "Random position from a random discovered line; play one move.", secondsPerMove: 20, hintsOn: false },
  arena: { label: "Arena", icon: Swords, hint: "Round-robin all lines with a running score.", secondsPerMove: 5, hintsOn: false }
};

function makeEmptyCourseProgress(): CourseProgress { return {}; }
function getLineProgress(progress: CourseProgress, line: OpeningLine) {
  return progress[line.id] ?? makeEmptyLineProgress();
}

function sameSAN(a: string, b: string) {
  const norm = (s: string) => s.replace(/0/g, "O").replace(/[+#!?]/g, "").trim();
  return norm(a) === norm(b);
}

function formatEval(cp: number | null, mate: number | null) {
  if (mate !== null) return `M${Math.abs(mate)}`;
  if (cp === null) return "0.0";
  return (cp / 100).toFixed(2);
}

function evalPercent(cp: number | null, mate: number | null) {
  // Convert centipawns / mate to a 0-100 bar where 50% is balanced.
  if (mate !== null) return mate > 0 ? 100 : 0;
  const value = cp ?? 0;
  const clamped = Math.max(-1000, Math.min(1000, value));
  return round((clamped + 1000) / 20);
}

function round(n: number) { return Math.max(0, Math.min(100, Math.round(n))); }

export function TrainerApp({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<ScreenState>("course-list");
  const [mode, setMode] = useState<TrainerMode>("learn");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [trainerProgress, setTrainerProgress] = useState(() => loadTrainerProgress());
  const [userCourses, setUserCourses] = useState(() => loadUserCourses());
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [essentialsOnly, setEssentialsOnly] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: string; message: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [misfires, setMisfires] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [arenaScore, setArenaScore] = useState(0);
  const [evalState, setEvalState] = useState<{ cp: number | null; mate: number | null; depth: number | null } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const evalAbortRef = useRef<AbortController | null>(null);

  const selectedCourse = useMemo(
    () => [...openingCourses, ...userCourses].find((c) => c.id === selectedCourseId) ?? null,
    [selectedCourseId, userCourses]
  );
  const courseProgress: CourseProgress = useMemo(
    () => (selectedCourseId ? trainerProgress[selectedCourseId] ?? {} : {}),
    [selectedCourseId, trainerProgress]
  );
  const activeLines: OpeningLine[] = useMemo(() => {
    if (!selectedCourse) return [];
    const source = essentialsOnly ? selectedCourse.essentials : selectedCourse.full;
    if (mode === "practice") return source.filter((l) => courseProgress[l.id]?.discovered);
    if (mode === "drill" || mode === "arena") return selectedCourse.full;
    if (mode === "puzzles") return source.filter((l) => courseProgress[l.id]?.discovered && l.moves.length >= 3);
    if (mode === "time") return source.filter((l) => courseProgress[l.id]?.discovered || l.moves.length >= 2);
    return source;
  }, [essentialsOnly, selectedCourse, mode, courseProgress]);

  const currentLine = activeLines[Math.min(currentLineIndex, Math.max(0, activeLines.length - 1))] ?? null;

  const [boardPieces, setBoardPieces] = useState<BoardPiece[]>([]);
  const firstMover = selectedCourse?.side ?? "w";
  const isUserTurn = useCallback((moveIndex: number) => firstMover === "w" ? moveIndex % 2 === 0 : moveIndex % 2 === 1, [firstMover]);
  const shouldAutoPlay = !!currentLine && !isUserTurn(currentMoveIndex);

  const puzzlePly = mode === "puzzles" && currentLine ? Math.max(1, Math.floor(Math.random() * Math.max(1, currentLine.moves.length - 1))) : null;
  const puzzleMoveIndex = mode === "puzzles" ? (currentLine ? puzzlePly ?? 0 : 0) : null;
  const puzzleGame = useMemo(() => {
    if (mode !== "puzzles" || !currentLine || puzzleMoveIndex === null) return null;
    const g = createGame();
    for (let i = 0; i < puzzleMoveIndex; i++) { try { g.move(currentLine.moves[i]); } catch { break; } }
    return g;
  }, [mode, currentLine, puzzleMoveIndex]);

  useEffect(() => {
    if (mode === "puzzles" && puzzleGame) {
      setBoardPieces(getBoardPieces(puzzleGame));
    } else if (currentLine) {
      const game = createGame();
      for (let i = 0; i < currentMoveIndex; i++) {
        try { game.move(currentLine.moves[i]); } catch { break; }
      }
      setBoardPieces(getBoardPieces(game));
    } else {
      setBoardPieces([]);
    }
  }, [mode, currentLine, currentMoveIndex, puzzleGame]);

  useEffect(() => {
    if (!shouldAutoPlay || !currentLine) return;
    // Guard against firing on complete line.
    if (currentMoveIndex >= currentLine.moves.length) return;
    setCurrentMoveIndex((i) => i + 1);
  }, [currentLine, currentMoveIndex, shouldAutoPlay]);

  useEffect(() => { saveTrainerProgress(trainerProgress); }, [trainerProgress]);
  useEffect(() => { saveUserCourses(userCourses); }, [userCourses]);

  useEffect(() => {
    setSelectedSquare(null);
    setShowHint(false);
    setFeedback({ kind: "start", message: mode === "puzzles" ? "Find the correct move from the shown position." : "Play the next move for your side." });
  }, [currentLineIndex, mode]);

  // Timer countdown for time mode / arena / puzzles
  useEffect(() => {
    if (mode !== "time" && mode !== "arena" && mode !== "puzzles") return;
    const totalSeconds = modePresets[mode].secondsPerMove * (mode === "time" || mode === "arena" ? 12 : 1);
    setSecondsLeft(totalSeconds);
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [mode, currentLineIndex]);

  // Eval bar: call Stockfish for the board's current position after each ply.
  useEffect(() => {
    const controller = new AbortController();
    evalAbortRef.current = controller;
    const fen = currentGame?.fen();
    if (!fen) return;
    const t = setTimeout(() => {
      requestEval(fen)
        .then((r) => { if (!controller.signal.aborted) setEvalState({ cp: r.cp, mate: r.mate, depth: r.depth }); })
        .catch(() => { /* evaluation errors don't break the trainer */ });
    }, 200);
    return () => { clearTimeout(t); controller.abort(); };
  }, [boardPieces]);

  const currentGame = useMemo(() => {
    if (puzzleGame) return puzzleGame;
    if (!currentLine) return null;
    const g = createGame();
    for (let i = 0; i < currentMoveIndex; i++) { try { g.move(currentLine.moves[i]); } catch { break; } }
    return g;
  }, [currentLine, currentMoveIndex, puzzleGame]);

  function findNextIdx() {
    if (!selectedCourse) return 0;
    if (mode === "practice") {
      const first = activeLines.findIndex((l) => isDueToday(getLineProgress(courseProgress, l)));
      return first >= 0 ? first : activeLines.length > 0 ? -1 : 0;
    }
    if (mode === "learn") {
      const first = activeLines.findIndex((l, i) => !courseProgress[l.id]?.discovered);
      return first >= 0 ? first : 0;
    }
    // Drill / time / arena: random line index, puzzles: random line
    if (activeLines.length === 0) return 0;
    const rand = Math.floor(Math.random() * activeLines.length);
    return rand;
  }

  function advanceToNextLine() {
    if (!selectedCourse) return;
    if (activeLines.length === 0) {
      setFeedback({ kind: "practice-over", message: "No more lines in this mode." });
      return;
    }
    const next = findNextIdx();
    if (next === -1) {
      setFeedback({ kind: "practice-over", message: "Practice done for today." });
      setCurrentLineIndex(-1);
      return;
    }
    if (next >= activeLines.length) {
      setCurrentLineIndex(0);
      setCurrentMoveIndex(0);
    } else {
      setCurrentLineIndex(next);
      setCurrentMoveIndex(0);
    }
    setSelectedSquare(null);
    setShowHint(false);
    setFeedback({ kind: "start", message: `${modePresets[mode].label}: ${activeLines[Math.min(next, activeLines.length - 1)]?.name}` });
  }

  function startCourse(course: OpeningCourse) {
    setSelectedCourseId(course.id);
    setScreen("course-detail");
    setMode("learn");
    setCurrentLineIndex(0);
    setCurrentMoveIndex(0);
    setShowHint(false);
    setStreak(0);
    setMisfires(0);
    setArenaScore(0);
  }

  function startTraining(nextMode: TrainerMode) {
    if (!selectedCourse) return;
    setMode(nextMode);
    setScreen("train");
    setStreak(0);
    setMisfires(0);
    setArenaScore(0);
    setCurrentLineIndex(0);
    setCurrentMoveIndex(0);
    setShowHint(false);
    setTimeout(() => advanceToNextLine(), 0);
  }

  function handleSquareClick(square: Square) {
    if (!currentLine || !selectedCourse || !currentGame) return;
    const piece = pieces.find((p) => p.square === square);

    if (selectedSquare) {
      attemptUserMove({ from: selectedSquare, to: square });
      return;
    }
    if (!piece) { setSelectedSquare(null); return; }
    if (piece.color === firstMover) setSelectedSquare(square);
  }

  function attemptUserMove(move: { from: Square; to: Square }) {
    if (!currentLine || !selectedCourse) return;
    const expected = currentLine.moves[currentMoveIndex];
    if (!expected) return;
    const game = buildGameUpTo(currentMoveIndex);
    const candidate = cloneGameWithMove(game, move as { from: Square; to: Square });
    if (!candidate) { setSelectedSquare(null); return; }
    const records = toMoveRecords(candidate);
    const attemptedSan = records[records.length - 1]?.san ?? "?";
    const now = Date.now();
    const correct = sameSAN(attemptedSan, expected);

    const existing = getLineProgress(courseProgress, currentLine);
    const updatedCourseProgress: CourseProgress = { ...courseProgress };
    if (mode === "learn") {
      updatedCourseProgress[currentLine.id] = {
        ...existing,
        discovered: true,
        box: correct ? Math.min(maxBox, existing.box + 1) : existing.box,
        lastSeenAt: new Date(now).toISOString(),
        bestStreak: correct ? existing.bestStreak + 1 : existing.bestStreak
      };
    } else {
      updatedCourseProgress[currentLine.id] = {
        ...existing,
        discovered: true,
        box: correct ? Math.min(maxBox, existing.box + 1) : 1,
        lastSeenAt: new Date(now).toISOString(),
        bestStreak: correct ? existing.bestStreak + 1 : 0
      };
    }
    setTrainerProgress((prev) => ({ ...prev, [selectedCourseId ?? ""]: updatedCourseProgress }));

    if (correct) {
      setSelectedSquare(null);
      setStreak((s) => s + 1);
      if (mode === "arena") setArenaScore((s) => s + 10);
      if (mode === "time") setSecondsLeft((s) => s + 4);
      const nextIdx = currentMoveIndex + 1;
      if (nextIdx >= currentLine.moves.length) {
        setFeedback({ kind: "line-complete", message: mode === "arena" ? `Line complete · arena score ${arenaScore + 10}` : "Line complete!" });
        setTimeout(() => advanceToNextLine(), mode === "arena" ? 2000 : 1800);
      } else {
        setCurrentMoveIndex(nextIdx);
        setFeedback({ kind: "correct", message: "Correct" });
      }
    } else {
      setSelectedSquare(null);
      setStreak(0);
      setMisfires((m) => m + 1);
      if (mode === "arena") setArenaScore((s) => Math.max(0, s - 5));
      if (mode === "learn" || modePresets[mode].hintsOn) setShowHint(true);
      setFeedback({ kind: "wrong", message: modePresets[mode].hintsOn || mode === "learn" ? `Not quite. Try ${expected}.` : "Wrong. Check the move history below." });
    }
  }

  function back() {
    if (screen === "train") setScreen("course-detail");
    else if (screen === "course-detail" || screen === "creator") setScreen("course-list");
    else onBack();
  }

  function handleSaveCourse(course: OpeningCourse) {
    setUserCourses((prev) => {
      const existing = prev.filter((c) => c.id !== course.id);
      return [...existing, course];
    });
    setScreen("course-list");
  }

  function handleImportFile(rawJson: string) {
    try {
      const parsed = JSON.parse(rawJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const valid: OpeningCourse[] = [];
      for (const c of arr) {
        if (
          typeof c.id !== "string" ||
          typeof c.name !== "string" ||
          !Array.isArray(c.full) ||
          typeof (c as { side?: unknown }).side !== "string"
        ) { continue; }
        // Validate that each line's SAN moves are playable
        const okLines: OpeningLine[] = [];
        for (const line of c.full as OpeningLine[]) {
          const g = new Chess();
          try {
            for (const san of line.moves) g.move(san);
            okLines.push(line);
          } catch { continue; }
        }
        if (okLines.length > 0) {
          valid.push({ ...c, full: okLines, essentials: (c.essentials ?? c.full) as OpeningLine[] } as OpeningCourse);
        }
      }
      if (valid.length === 0) {
        setImportError("No valid courses found in the file. Expected an OpeningCourse[] or a single OpeningCourse object.");
        return;
      }
      setUserCourses((prev) => {
        const existing = prev.filter((c) => !valid.some((v) => v.id === c.id));
        return [...existing, ...valid];
      });
      setImportError(null);
      setScreen("course-list");
    } catch {
      setImportError("Could not parse the imported file.");
    }
  }

  function exportAllCourses() {
    const all = [...openingCourses, ...userCourses];
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pcce-openings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildGameUpTo(index: number) {
    const game = createGame();
    if (!currentLine) return game;
    for (let i = 0; i < index; i++) {
      try { game.move(currentLine.moves[i]); } catch { break; }
    }
    return game;
  }

  const pieces = boardPieces;
  const discoveryKey = selectedCourseId ?? "";
  const courseData = [...openingCourses, ...userCourses].find((c) => c.id === discoveryKey);
  const linesShown = courseData ? (essentialsOnly ? courseData.essentials : courseData.full) : [];
  const discoveryCount = linesShown.filter((l) => courseProgress[l.id]?.discovered).length;
  const dueCount = linesShown.filter((l) => isDueToday(getLineProgress(courseProgress, l))).length;

  // ============ course-list ============
  if (screen === "course-list") {
    return (
      <TrainerCourseList
        courses={[...openingCourses, ...userCourses]}
        trainerProgress={trainerProgress}
        onBack={onBack}
        onOpenCourse={startCourse}
        onCreateCourse={() => setScreen("creator")}
        onImportFile={handleImportFile}
      >
        {importError ? <div className="creator-error">{importError}</div> : null}
        <button className="text-button" type="button" onClick={exportAllCourses} style={{ marginTop: 20 }}>
          <DollarSign size={16} aria-hidden="true" />
          Export all courses to JSON
        </button>
      </TrainerCourseList>
    );
  }

  // ============ creator ============
  if (screen === "creator") {
    return (
      <CourseCreator onBack={back} onSave={handleSaveCourse} />
    );
  }

  // ============ course-detail ============
  if (screen === "course-detail" && selectedCourse) {
    const availableModes: TrainerMode[] = ["learn", "practice", "drill", "time", "puzzles", "arena"];
    return (
      <main className="app-shell compact-shell trainer-shell">
        <button className="text-button" type="button" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <header className="course-detail-header">
          <h1>{selectedCourse.name}</h1>
          <p>{selectedCourse.description}</p>
          <p><em>By {selectedCourse.author}</em></p>
        </header>
        <section className="course-detail-modes">
          {availableModes.map((m) => {
            const preset = modePresets[m];
            const active = m === mode;
            const disabled = (m === "practice" || m === "puzzles" || m === "time") && discoveryCount < 1;
            const click = () => { setMode(m); setScreen("train"); setCurrentLineIndex(0); setCurrentMoveIndex(0); setTimeout(() => advanceToNextLine(), 0); };
            return m === "learn" ? (
              <button className="mode-pill primary" type="button" key={m} onClick={click}>
                <preset.icon size={18} aria-hidden="true" />
                <span>{preset.label}</span>
                <small>{discoveryCount}/{linesShown.length}</small>
              </button>
            ) : (
              <button className={`mode-pill ${active ? "primary" : ""} ${disabled ? "locked" : ""}`} key={m} type="button" disabled={disabled} onClick={click}>
                <preset.icon size={16} aria-hidden="true" />
                <span>{preset.label}</span>
                <small>
                  {m === "practice" ? `${dueCount} due` : preset.hint.split(";")[0]}
                </small>
              </button>
            );
          })}
        </section>
        <section className="course-detail-depth">
          <h3>How deep do you want to go?</h3>
          <div className="depth-options">
            <label className="depth-option">
              <input type="radio" checked={essentialsOnly} onChange={() => setEssentialsOnly(true)} />
              <span>Essentials</span>
              <small>{selectedCourse.essentials.length} lines</small>
            </label>
            <label className="depth-option">
              <input type="radio" checked={!essentialsOnly} onChange={() => setEssentialsOnly(false)} />
              <span>Full Mastery</span>
              <small>{selectedCourse.full.length} lines</small>
            </label>
          </div>
          <button className="primary-button" type="button" onClick={() => startTraining(mode)} style={{ marginTop: 14 }}>
            <Play size={18} aria-hidden="true" />
            {mode === "learn" ? (discoveryCount > 0 ? "Continue training" : "Start learning") : `Start ${modePresets[mode].label}`}
          </button>
        </section>
      </main>
    );
  }

  // ============ train ============
  if (!selectedCourse || !currentLine) {
    return (
      <main className="app-shell compact-shell trainer-shell">
        <button className="text-button" type="button" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <h1>{feedback?.message ?? "No more lines."}</h1>
        <button className="primary-button" type="button" onClick={back} style={{ marginTop: 16 }}>
          <RotateCcw size={16} aria-hidden="true" />
          Back
        </button>
      </main>
    );
  }

  const flipped = selectedCourse.side === "b";
  const nextMove = currentLine.moves[currentMoveIndex] ?? "";
  const isLineDone = currentMoveIndex >= currentLine.moves.length;

  return (
    <main className="trainer-layout">
      <header className="trainer-top-bar">
        <button className="text-button" type="button" onClick={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <div>
          <strong>{selectedCourse.name}</strong>
          <small> · {currentLine.name}</small>
        </div>
        <span className="trainer-progress-badge">
          <BookOpen size={16} aria-hidden="true" />
          {activeLines.filter((l) => courseProgress[l.id]?.discovered).length}/{activeLines.length}
        </span>
      </header>

      {mode !== "learn" ? (
        <div className="practice-stats">
          <span>Streak: <strong>{streak}</strong></span>
          <span>Misfires: <strong>{misfires}</strong></span>
          <span>Box: <strong>{currentLine ? getLineProgress(courseProgress, currentLine).box : "?"}</strong></span>
          {mode === "arena" ? <span>Score: <strong>{arenaScore}</strong></span> : null}
          {mode !== "practice" && mode !== "puzzles" ? <span>Time: <strong>{secondsLeft}s</strong></span> : null}
        </div>
      ) : null}

      <section className="trainer-main">
        <div className="trainer-board-zone">
          {evalState ? (
            <div className="eval-bar-strip">
              <span className="eval-bar-label">
                {formatEval(evalState.cp, evalState.mate)} · depth {evalState.depth ?? "?"}
              </span>
              <div className="eval-bar-track">
                <div
                  className="eval-bar-fill"
                  style={{
                    width: `${evalPercent(evalState.cp, evalState.mate)}%`
                  }}
                />
              </div>
            </div>
          ) : null}
          <TrainerBoard
            pieces={pieces}
            flipped={flipped}
            selectedSquare={selectedSquare}
            legalDestinations={selectedSquare ? getLegalDestinations(currentGame!, selectedSquare) : []}
            onSquareClick={handleSquareClick}
            statusLabel={feedback?.message ?? ""}
          />
          <div className="trainer-under-board">
            <button className="icon-button" type="button" onClick={() => setShowHint(!showHint)}>
              <ChevronDown size={18} aria-hidden="true" />
              Hint
            </button>
            <button className="icon-button" type="button" onClick={() => { setStreak(0); advanceToNextLine(); }}>
              <ArrowRight size={18} aria-hidden="true" />
              Skip
            </button>
            <button className="icon-button" type="button" onClick={() => { setCurrentMoveIndex(0); setSelectedSquare(null); setShowHint(false); setFeedback({ kind: "start", message: "Restarted." }); }}>
              <RotateCcw size={18} aria-hidden="true" />
              Restart
            </button>
          </div>
        </div>
        <aside className="trainer-side">
          {showHint ? (
            <div className="trainer-hint-panel">
              <strong>Hint</strong>
              <p>{currentLine.summary}</p>
              <p><code>Expected: {nextMove || "—"}</code></p>
            </div>
          ) : null}
          <div className="trainer-commentary">
            <strong>About this line</strong>
            <p>{currentLine.summary}</p>
          </div>
          <div className="trainer-moves-list">
            {currentLine.moves.slice(0, currentMoveIndex).map((san, i) => (
              <span className="trainer-move-chip" key={`${currentLine.id}-${i}`}>
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""} {san}
              </span>
            ))}
          </div>
          {isLineDone ? (
            <button className="primary-button" type="button" onClick={advanceToNextLine}>
              <Play size={18} aria-hidden="true" />
              Next line
            </button>
          ) : null}
        </aside>
      </section>
    </main>
  );

  const style_evalBarFill = "eval-bar-fill";
}

