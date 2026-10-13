import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Droplet,
  Play,
  Target,
  Timer,
  Unlock,
  Swords
} from "lucide-react";
import type { Square } from "chess.js";
import { openingCourses } from "./openingData";
import type { CourseProgress, OpeningCourse, OpeningLine } from "./trainerTypes";
import { makeEmptyLineProgress } from "./srs";
import { loadTrainerProgress, saveTrainerProgress } from "./trainerStorage";
import { cloneGameWithMove, createGame, getBoardPieces, getLegalDestinations, toMoveRecords, type BoardPiece } from "../chessGame";
import { TrainerBoard } from "./TrainerBoard";
import "../styles.css";

const lockedModes = [
  { id: "drill", label: "Drill", icon: Droplet },
  { id: "time", label: "Time", icon: Timer },
  { id: "puzzles", label: "Puzzles", icon: Target },
  { id: "arena", label: "Arena", icon: Swords }
];

function emptyCourseProgress(): CourseProgress {
  return {};
}

function getLineProgress(progress: CourseProgress, line: OpeningLine) {
  return progress[line.id] ?? makeEmptyLineProgress();
}

export function TrainerApp({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<"course-list" | "course-detail" | "train">("course-list");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [trainerProgress, setTrainerProgress] = useState(() => loadTrainerProgress());
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [essentialsOnly, setEssentialsOnly] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "correct" | "wrong" | "line-complete" | "start"; message: string } | null>(null);

  const selectedCourse = useMemo(
    () => openingCourses.find((c) => c.id === selectedCourseId) ?? null,
    [selectedCourseId]
  );
  let courseProgress: CourseProgress = useMemo(
    () => (selectedCourseId ? trainerProgress[selectedCourseId] ?? {} : {}),
    [selectedCourseId, trainerProgress]
  );
  const activeLines = selectedCourse ? (essentialsOnly ? selectedCourse.essentials : selectedCourse.full) : [];

  const currentLine = activeLines[Math.min(currentLineIndex, Math.max(0, activeLines.length - 1))] ?? null;

  const [boardPieces, setBoardPieces] = useState<BoardPiece[]>([]);

  // Determine which move index the trainer auto-plays next.
  // If moves[idx] is the user's move (side matches), the user should play it.
  // Otherwise, the trainer plays it automatically.
  const firstMover = selectedCourse?.side ?? "w";
  const userIsWhite = firstMover === "w";
  const isUserTurn = (moveIndex: number) => {
    if (userIsWhite) return moveIndex % 2 === 0;
    return moveIndex % 2 === 1;
  };
  const shouldAutoPlay = !!currentLine && !!!(isUserTurn(currentMoveIndex));

  // Rebuild the game each time the current line or move index changes,
  // applying all moves so far.
  useEffect(() => {
    if (!currentLine) { setBoardPieces([]); return; }
    const game = createGame();
    for (let i = 0; i < currentMoveIndex; i++) {
      try { game.move(currentLine.moves[i]); } catch { break; }
    }
    setBoardPieces(getBoardPieces(game));
  }, [currentLine, currentMoveIndex]);

  // Auto-play the opponent's move when it's not the user's turn.
  useEffect(() => {
    if (!shouldAutoPlay || !currentLine) return;
    const nextSan = currentLine.moves[currentMoveIndex];
    if (!nextSan) {
      setFeedback({ kind: "line-complete", message: "Line complete!" });
      return;
    }
    setCurrentMoveIndex((i) => i + 1);
  }, [currentLine, currentMoveIndex, shouldAutoPlay]);

  useEffect(() => {
    saveTrainerProgress(trainerProgress);
  }, [trainerProgress]);

  useEffect(() => {
    setSelectedSquare(null);
    setShowHint(false);
    setFeedback({ kind: "start", message: "Play the next move for your side." });
  }, [currentLineIndex]);

  function discoverNextLine() {
    if (!selectedCourse) return;
    const lines = activeLines;
    const nextIdx = lines.findIndex((_, i) => !courseProgress[lines[i]?.id]?.discovered);
    if (nextIdx >= 0) {
      setCurrentLineIndex(nextIdx);
      setCurrentMoveIndex(0);
      setFeedback({ kind: "start", message: `New line: ${lines[nextIdx].name}` });
    } else {
      setFeedback({ kind: "line-complete", message: "All lines discovered. Switch to Practice." });
    }
  }

  function startCourse(course: OpeningCourse) {
    setSelectedCourseId(course.id);
    setScreen("course-detail");
    setCurrentLineIndex(0);
    setCurrentMoveIndex(0);
    setShowHint(false);
  }

  function startTraining() {
    if (!selectedCourse) return;
    setScreen("train");
    discoverNextLine();
  }

  function handleSquareClick(square: Square) {
    if (!currentLine || !selectedCourse) return;
    if (currentGame && selectedSquare) {
      const attempted = cloneGameWithMove(currentGame, { from: selectedSquare, to: square });
      if (attempted) { attemptUserMove({ from: selectedSquare, to: square }); return; }
    }
    const piece = pieces.find((p) => p.square === square);
    if (!piece) { setSelectedSquare(null); return; }
    const turnColor = currentMoveIndex % 2 === 0 ? "w" : "b";
    if (piece.color !== turnColor) return;
    setSelectedSquare(square);
  }

  function attemptUserMove(move: { from: Square; to: Square }) {
    if (!currentLine || !selectedCourse) return;
    const expected = currentLine.moves[currentMoveIndex];
    if (!expected) return;

    // Verify with a real game. We build the game up to currentMoveIndex and try to apply the move.
    const game = createGame();
    for (let i = 0; i < currentMoveIndex; i++) { try { game.move(currentLine.moves[i]); } catch { break; } }
    const candidate = cloneGameWithMove(game, move as { from: Square; to: Square });
    if (!candidate) { setSelectedSquare(null); return; }
    const records = toMoveRecords(candidate);
    const attemptedSan = records[records.length - 1]?.san ?? "?";
    const now = Date.now();
    const correct = attemptedSan === expected;

    const updatedCourseProgress: CourseProgress = { ...courseProgress };
    updatedCourseProgress[currentLine.id] = {
      ...makeEmptyLineProgress(),
      ...updatedCourseProgress[currentLine.id],
      discovered: true,
      box: correct ? Math.min(5, (updatedCourseProgress[currentLine.id]?.box ?? 1) + 1) : 1,
      lastSeenAt: new Date(now).toISOString(),
      bestStreak: correct ? (updatedCourseProgress[currentLine.id]?.bestStreak ?? 0) + 1 : 0
    };
    setTrainerProgress((prev) => ({ ...prev, [selectedCourseId ?? ""]: updatedCourseProgress }));

    if (correct) {
      setSelectedSquare(null);
      const nextIdx = currentMoveIndex + 1;
      if (nextIdx >= currentLine.moves.length) {
        setFeedback({ kind: "line-complete", message: "Line complete" });
        setTimeout(() => discoverNextLine(), 1800);
      } else {
        setCurrentMoveIndex(nextIdx);
        setFeedback({ kind: "correct", message: `Correct: ${expected}` });
      }
    } else {
      setSelectedSquare(null);
      setShowHint(true);
      setFeedback({ kind: "wrong", message: `Not quite. Try ${expected}.` });
    }
  }

  function skipToNextLine() {
    if (currentLineIndex < activeLines.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1);
      setCurrentMoveIndex(0);
      setSelectedSquare(null);
      setShowHint(false);
      setFeedback(null);
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
  const currentGame = useMemo(() => {
    if (!currentLine) return null;
    const game = createGame();
    for (let i = 0; i < currentMoveIndex; i++) {
      try { game.move(currentLine.moves[i]); } catch { break; }
    }
    return game;
  }, [currentLine, currentMoveIndex]);

  // ============ Screen: course-list ============
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

  // ============ Screen: course-detail ============
  if (screen === "course-detail" && selectedCourse) {
    const linesShown = essentialsOnly ? selectedCourse.essentials : selectedCourse.full;
    const discoveredCount = getDiscoveryCount(linesShown, trainerProgress[selectedCourse.id] ?? {});
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
          <button className="mode-pill primary" type="button" onClick={startTraining}>
            <Play size={18} aria-hidden="true" />
            <span>Learn</span>
            <small>{discoveredCount}/{linesShown.length}</small>
          </button>
          <button
            className={`mode-pill ${discoveredCount < 2 ? "locked" : ""}`}
            type="button"
            disabled={discoveredCount < 2}
            onClick={() => startTraining()}
          >
            <Unlock size={16} aria-hidden="true" />
            <span>Practice</span>
            <small>{Math.max(0, discoveredCount - 1)} ready</small>
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
          <button className="primary-button" type="button" onClick={startTraining} style={{ marginTop: 14 }}>
            <Play size={18} aria-hidden="true" />
            {discoveredCount > 0 ? "Continue training" : "Start learning"}
          </button>
        </section>
      </main>
    );
  }

  // ============ Screen: train ============
  if (!selectedCourse || !currentLine) {
    return <main className="app-shell compact-shell"><p>No course loaded.</p></main>;
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

      <section className="trainer-main">
        <div className="trainer-board-zone">
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
            <button className="icon-button" type="button" onClick={skipToNextLine}>
              <ArrowRight size={18} aria-hidden="true" />
              Skip line
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
            <button className="primary-button" type="button" onClick={discoverNextLine}>
              <Play size={18} aria-hidden="true" />
              Next line
            </button>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
