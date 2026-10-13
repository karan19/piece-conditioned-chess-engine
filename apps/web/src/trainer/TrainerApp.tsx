import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Droplet,
  Play,
  RotateCcw,
  Target,
  Timer,
  Unlock,
  Swords
} from "lucide-react";
import type { Square } from "chess.js";
import { openingCourses } from "./openingData";
import type { CourseProgress, OpeningCourse, OpeningLine } from "./trainerTypes";
import { isDueToday, makeEmptyLineProgress } from "./srs";
import { loadTrainerProgress, saveTrainerProgress } from "./trainerStorage";
import {
  cloneGameWithMove,
  createGame,
  getBoardPieces,
  getLegalDestinations,
  toMoveRecords,
  type BoardPiece
} from "../chessGame";
import { TrainerBoard } from "./TrainerBoard";
import "../styles.css";

const lockedModes = [
  { id: "drill", label: "Drill", icon: Droplet },
  { id: "time", label: "Time", icon: Timer },
  { id: "puzzles", label: "Puzzles", icon: Target },
  { id: "arena", label: "Arena", icon: Swords }
];

type TrainerMode = "learn" | "practice";


function sameSAN(a: string, b: string) {
  const norm = (s: string) => s.replace(/0/g, "O").replace(/[+#!?]/g, "").trim();
  return norm(a) === norm(b);
}

function getLineProgress(progress: CourseProgress, line: OpeningLine) {
  return progress[line.id] ?? makeEmptyLineProgress();
}

export function TrainerApp({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<"course-list" | "course-detail" | "train">("course-list");
  const [mode, setMode] = useState<TrainerMode>("learn");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [trainerProgress, setTrainerProgress] = useState(() => loadTrainerProgress());
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [essentialsOnly, setEssentialsOnly] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "correct" | "wrong" | "line-complete" | "start" | "practice-over"; message: string } | null>(null);
  const [streakThisRun, setStreakThisRun] = useState(0);
  const [misfiresThisRun, setMisfiresThisRun] = useState(0);

  const selectedCourse = useMemo(() => openingCourses.find((c) => c.id === selectedCourseId) ?? null, [selectedCourseId]);
  const courseProgress: CourseProgress = useMemo(
    () => (selectedCourseId ? trainerProgress[selectedCourseId] ?? {} : {}),
    [selectedCourseId, trainerProgress]
  );

  const activeLines = useMemo(() => {
    if (!selectedCourse) return [];
    const source = essentialsOnly ? selectedCourse.essentials : selectedCourse.full;
    if (mode === "practice") {
      return source.filter((l) => courseProgress[l.id]?.discovered);
    }
    return source;
  }, [essentialsOnly, selectedCourse, mode, courseProgress]);

  const currentLine = activeLines[Math.min(currentLineIndex, Math.max(0, activeLines.length - 1))] ?? null;

  const [boardPieces, setBoardPieces] = useState<BoardPiece[]>([]);
  const firstMover = selectedCourse?.side ?? "w";
  const isUserTurn = useCallback((moveIndex: number) => {
    return firstMover === "w" ? moveIndex % 2 === 0 : moveIndex % 2 === 1;
  }, [firstMover]);
  const shouldAutoPlay = !!currentLine && !isUserTurn(currentMoveIndex);

  useEffect(() => {
    if (!currentLine) { setBoardPieces([]); return; }
    const game = createGame();
    for (let i = 0; i < currentMoveIndex; i++) {
      try { game.move(currentLine.moves[i]); } catch { break; }
    }
    setBoardPieces(getBoardPieces(game));
  }, [currentLine, currentMoveIndex]);

  // Auto-play the opponent's reply when not the user's turn.
  useEffect(() => {
    if (!shouldAutoPlay || !currentLine) return;
    setCurrentMoveIndex((i) => i + 1);
  }, [currentLine, currentMoveIndex, shouldAutoPlay]);

  useEffect(() => { saveTrainerProgress(trainerProgress); }, [trainerProgress]);

  useEffect(() => {
    setSelectedSquare(null);
    setShowHint(false);
    setFeedback({ kind: "start", message: mode === "practice" ? "Recall from memory. No hints by default." : "Play the next move for your side." });
  }, [currentLineIndex, mode]);

  function findNextUndiscovered() {
    const lines = activeLines;
    const nextIdx = lines.findIndex((l, i) => !courseProgress[l.id]?.discovered);
    return nextIdx >= 0 ? nextIdx : null;
  }

  function findNextDue() {
    // Practice mode: find the next due line, or null.
    const candidates: number[] = [];
    activeLines.forEach((line, i) => {
      if (isDueToday(getLineProgress(courseProgress, line))) candidates.push(i);
    });
    return candidates.length > 0 ? candidates[0] : null;
  }

  function advanceToNextLine() {
    if (!selectedCourse) return;
    if (mode === "learn") {
      const next = findNextUndiscovered();
      if (next === null) {
        setFeedback({ kind: "line-complete", message: "All lines discovered. Switch to Practice." });
        return;
      }
      setCurrentLineIndex(next);
      setCurrentMoveIndex(0);
      setFeedback({ kind: "start", message: `New line: ${activeLines[next]?.name ?? ""}` });
    } else {
      const next = findNextDue();
      if (next === null) {
        setFeedback({ kind: "practice-over", message: "Practice done for today. Come back or switch to Learn." });
        setCurrentLineIndex(-1);
        return;
      }
      setCurrentLineIndex(next);
      setCurrentMoveIndex(0);
      setFeedback({ kind: "start", message: `Practice: ${activeLines[next]?.name ?? ""}` });
    }
  }

  function startCourse(course: OpeningCourse) {
    setSelectedCourseId(course.id);
    setScreen("course-detail");
    setCurrentLineIndex(0);
    setCurrentMoveIndex(0);
    setShowHint(false);
    setStreakThisRun(0);
    setMisfiresThisRun(0);
    setMode("learn");
  }

  function startTraining(nextMode: TrainerMode) {
    if (!selectedCourse) return;
    setMode(nextMode);
    setScreen("train");
    setStreakThisRun(0);
    setMisfiresThisRun(0);
    setCurrentLineIndex(0);
    setCurrentMoveIndex(0);
    setShowHint(false);
    // Kick off advanceToNextLine on mount.
    setTimeout(() => { advanceToNextLine(); }, 0);
  }

  function handleSquareClick(square: Square) {
    if (!currentLine || !selectedCourse) return;
    if (currentMoveIndex === -1) return;

    const game = buildGameUpTo(currentMoveIndex);
    const piece = pieces.find((p) => p.square === square);
    if (selectedSquare) {
      const candidate = cloneGameWithMove(game, { from: selectedSquare, to: square });
      if (candidate) { attemptUserMove({ from: selectedSquare, to: square }); return; }
    }
    if (!piece) { setSelectedSquare(null); return; }
    if (piece.color === firstMover) { setSelectedSquare(square); return; }
  }

  function buildGameUpTo(index: number) {
    const game = createGame();
    if (!currentLine) return game;
    for (let i = 0; i < index; i++) {
      try { game.move(currentLine.moves[i]); } catch { break; }
    }
    return game;
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
        ...makeEmptyLineProgress(),
        ...existing,
        discovered: true,
        box: correct ? Math.min(5, existing.box + 1) : existing.box,
        lastSeenAt: new Date(now).toISOString(),
        bestStreak: correct ? existing.bestStreak + 1 : existing.bestStreak
      };
    } else {
      updatedCourseProgress[currentLine.id] = {
        ...existing,
        box: correct ? Math.min(5, existing.box + 1) : 1,
        lastSeenAt: new Date(now).toISOString(),
        bestStreak: correct ? existing.bestStreak + 1 : 0
      };
    }
    setTrainerProgress((prev) => ({ ...prev, [selectedCourseId ?? ""]: updatedCourseProgress }));

    if (correct) {
      setSelectedSquare(null);
      setStreakThisRun((s) => s + 1);
      const nextIdx = currentMoveIndex + 1;
      if (nextIdx >= currentLine.moves.length) {
        setFeedback({ kind: "line-complete", message: mode === "practice" ? `Line complete · +1 box · streak ${streakThisRun + 1}` : "Line complete!" });
        setTimeout(() => advanceToNextLine(), mode === "practice" ? 2200 : 1800);
      } else {
        setCurrentMoveIndex(nextIdx);
        setFeedback({ kind: "correct", message: "Correct" });
      }
    } else {
      setSelectedSquare(null);
      setStreakThisRun(0);
      setMisfiresThisRun((m) => m + 1);
      setShowHint(true);
      setFeedback({ kind: "wrong", message: `Not quite. Try ${expected}.` });
    }
  }

  function back() {
    if (screen === "train") setScreen("course-detail");
    else if (screen === "course-detail") setScreen("course-list");
    else onBack();
  }

  function getDiscoveryCount(list: OpeningLine[], progress: CourseProgress) {
    return list.filter((l) => progress[l.id]?.discovered).length;
  }

  const pieces = boardPieces;
  const currentGame = useMemo(() => buildGameUpTo(currentMoveIndex), [currentLine, currentMoveIndex]);

  // ============ course-list ============
  if (screen === "course-list") {
    return (
      <main className="app-shell compact-shell trainer-shell">
        <button className="text-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          Home
        </button>
        <div className="trainer-header">
          <div>
            <p className="eyebrow">Opening trainer</p>
            <h1>Learn your openings step by step</h1>
          </div>
          <span>{openingCourses.length} courses</span>
        </div>
        <section className="course-grid">
          {openingCourses.map((course) => {
            const linesInCourse = course.full.length;
            const discoveredCount = getDiscoveryCount(course.full, trainerProgress[course.id] ?? {});
            const pct = linesInCourse > 0 ? Math.round((discoveredCount / linesInCourse) * 100) : 0;
            return (
              <button className="course-card" key={course.id} type="button" onClick={() => startCourse(course)}>
                <span className="course-color-badge" data-color={course.side}>{course.side === "w" ? "White" : "Black"}</span>
                <strong>{course.name}</strong>
                <small>{course.tagline}</small>
                <div className="course-progress-bar"><span style={{ width: `${pct}%` }} /></div>
                <small style={{ marginTop: 4 }}>{discoveredCount}/{linesInCourse} discovered</small>
              </button>
            );
          })}
        </section>
      </main>
    );
  }

  // ============ course-detail ============
  if (screen === "course-detail" && selectedCourse) {
    const linesShown = essentialsOnly ? selectedCourse.essentials : selectedCourse.full;
    const discoveredCount = getDiscoveryCount(linesShown, trainerProgress[selectedCourse.id] ?? {});
    const dueCount = linesShown.filter((l) => isDueToday(getLineProgress(courseProgress, l))).length;
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
          <button className="mode-pill primary" type="button" onClick={() => startTraining("learn")}>
            <Play size={18} aria-hidden="true" />
            <span>Learn</span>
            <small>{discoveredCount}/{linesShown.length}</small>
          </button>
          <button
            className={`mode-pill ${discoveredCount < 1 ? "locked" : ""}`}
            type="button"
            disabled={discoveredCount < 1}
            onClick={() => startTraining("practice")}
          >
            <Unlock size={16} aria-hidden="true" />
            <span>Practice</span>
            <small>{dueCount} due</small>
          </button>
          {lockedModes.map((m) => (
            <div className="mode-pill locked" key={m.id}>
              <m.icon size={16} aria-hidden="true" />
              <span>{m.label}</span>
              <small>Locked</small>
            </div>
          ))}
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
            {mode === "learn" ? (discoveredCount > 0 ? "Continue training" : "Start learning") : "Start practice"}
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
        <h1>{feedback?.message ?? "Practice complete."}</h1>
        {feedback?.kind === "practice-over" ? (
          <div style={{ marginTop: 18 }}>
            <button className="primary-button" type="button" onClick={() => startTraining("learn")}>
              <Play size={18} aria-hidden="true" />
              Go back to Learning
            </button>
          </div>
        ) : null}
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
          {getDiscoveryCount(activeLines, trainerProgress[selectedCourse.id] ?? {})}/{activeLines.length}
        </span>
      </header>

      {mode === "practice" ? (
        <div className="practice-stats">
          <span>Streak: <strong>{streakThisRun}</strong></span>
          <span>Misfires: <strong>{misfiresThisRun}</strong></span>
          <span>Box: <strong>{currentLine ? getLineProgress(courseProgress, currentLine).box : "?"}</strong></span>
        </div>
      ) : null}

      <section className="trainer-main">
        <div className="trainer-board-zone">
          <TrainerBoard
            pieces={pieces}
            flipped={flipped}
            selectedSquare={selectedSquare}
            legalDestinations={selectedSquare ? getLegalDestinations(currentGame, selectedSquare) : []}
            onSquareClick={handleSquareClick}
            statusLabel={feedback?.message ?? ""}
          />
          <div className="trainer-under-board">
            <button className="icon-button" type="button" onClick={() => setShowHint(!showHint)}>
              <ChevronDown size={18} aria-hidden="true" />
              Hint
            </button>
            <button className="icon-button" type="button" onClick={skipLine}>
              <ArrowRight size={18} aria-hidden="true" />
              Skip
            </button>
            <button className="icon-button" type="button" onClick={restartLine}>
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

  function skipLine() {
    if (mode === "learn") {
      advanceToNextLine();
    } else {
      // In practice, skipping penalises; commit as "incorrect".
      if (currentLine) {
        setStreakThisRun(0);
        advanceToNextLine();
      }
    }
  }

  function restartLine() {
    setCurrentMoveIndex(0);
    setSelectedSquare(null);
    setShowHint(false);
    setFeedback({ kind: "start", message: "Line restarted." });
  }
}
