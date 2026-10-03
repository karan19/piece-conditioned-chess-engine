import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cpu,
  History,
  Play,
  Reply,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import type { Color, Square } from "chess.js";
import {
  getCallEngineState,
  getSelectedPieceSummary,
  pieceNames
} from "./callEngineRules";
import {
  cloneGameWithMove,
  createGame,
  describeCheckThreat,
  files,
  getBoardPieces,
  getCheckThreat,
  getGameStatus,
  getLegalDestinations,
  getMoveHistoryRows,
  isPromotionMove,
  type MoveRecord,
  pieceGlyphs,
  ranks,
  toMoveRecords
} from "./chessGame";
import {
  parseUciMove,
  requestBestMove,
  requestPieceAnalysis,
  type PieceAnalysisCandidate,
  type PieceAnalysisReply,
  type PieceAnalysisResponse
} from "./engineClient";
import {
  createGameId,
  createLearningEventId,
  formatSavedGameDate,
  loadSavedGames,
  upsertSavedGame,
  type LearningEvent,
  type SavedGame
} from "./gameStorage";
import {
  defaultGameSettings,
  difficultyOptions,
  getColorName,
  getOpponentColor,
  type GameSettings
} from "./gameSettings";
import { homeActions, productHighlights } from "./appContent";
import "./styles.css";

const actionIcons = {
  "start-game": Play,
  "previous-games": History
};

const Board3DView = lazy(() =>
  import("./Board3DView").then((module) => ({ default: module.Board3DView }))
);
const opponentMoveDelayMs = 1000;

function BoardView({
  game,
  selectedSquare,
  legalDestinationSet,
  checkThreat,
  isPreview,
  onSquareClick
}: {
  game: ReturnType<typeof createGame>;
  selectedSquare?: Square | null;
  legalDestinationSet?: Set<Square>;
  checkThreat?: ReturnType<typeof getCheckThreat>;
  isPreview?: boolean;
  onSquareClick?: (square: Square) => void;
}) {
  const boardPieces = getBoardPieces(game);
  const boardPiecesBySquare = new Map(boardPieces.map((piece) => [piece.square, piece]));
  const attackerSquares = new Set(checkThreat?.attackers.map((attacker) => attacker.square) ?? []);

  return (
    <div className="board-frame piece-style-classic" aria-label="Chessboard">
      {ranks.map((rank) =>
        files.map((file) => {
          const square = `${file}${rank}` as Square;
          const piece = boardPiecesBySquare.get(square);
          const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
          const isSelected = selectedSquare === square;
          const isLegalDestination = legalDestinationSet?.has(square) ?? false;
          const squareLabel = `${file}${rank}`;

          return (
            <button
              aria-label={
                piece
                  ? `${squareLabel}, ${piece.color === "w" ? "white" : "black"} ${piece.type}`
                  : `${squareLabel}, empty`
              }
              className={[
                "board-square",
                isLight ? "light-square" : "dark-square",
                isSelected ? "selected-square" : "",
                isLegalDestination ? "legal-destination" : "",
                checkThreat?.kingSquare === square ? "check-king-square" : "",
                attackerSquares.has(square) ? "check-attacker-square" : "",
                isPreview ? "preview-square" : ""
              ].join(" ")}
              key={square}
              type="button"
              onClick={() => onSquareClick?.(square)}
            >
              <span className="square-coordinate">{squareLabel}</span>
              {piece ? (
                <span className={`piece piece-${piece.color}`}>
                  {pieceGlyphs[piece.color][piece.type]}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function createLearningEventExportHref(gameRecord: SavedGame, event: LearningEvent) {
  return `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(
      {
        gameId: gameRecord.id,
        gameCreatedAt: gameRecord.createdAt,
        gameUpdatedAt: gameRecord.updatedAt,
        settings: gameRecord.settings,
        event
      },
      null,
      2
    )
  )}`;
}

export function App() {
  const [screen, setScreen] = useState<"home" | "new-game" | "game" | "previous-games" | "review-game">("home");
  const [fen, setFen] = useState(() => createGame().fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [history, setHistory] = useState<MoveRecord[]>([]);
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [draftSettings, setDraftSettings] = useState<GameSettings>(defaultGameSettings);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => loadSavedGames());
  const [reviewGameId, setReviewGameId] = useState<string | null>(null);
  const [reviewEventId, setReviewEventId] = useState<string | null>(null);
  const [reviewPreviewLine, setReviewPreviewLine] = useState<{
    fen: string;
    title: string;
    detail: string;
    candidateMove: string;
    replyMove?: string;
  } | null>(null);
  const [callEngineConsumedPly, setCallEngineConsumedPly] = useState<number | null>(null);
  const [callEngineResult, setCallEngineResult] = useState<PieceAnalysisResponse | null>(null);
  const [previewLine, setPreviewLine] = useState<{
    fen: string;
    title: string;
    detail: string;
    candidateMove: string;
    replyMove?: string;
  } | null>(null);
  const [callEngineAnalysisState, setCallEngineAnalysisState] = useState<{
    status: "idle" | "analyzing" | "error";
    message?: string;
  }>({
    status: "idle"
  });
  const [engineState, setEngineState] = useState<{
    status: "idle" | "thinking" | "error";
    message?: string;
  }>({
    status: "idle"
  });
  const [boardMode, setBoardMode] = useState<"3d" | "2d">("3d");
  const [engineRetryKey, setEngineRetryKey] = useState(0);
  const [promotionMove, setPromotionMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const fenRef = useRef(fen);
  const analysisRequestIdRef = useRef(0);

  const game = useMemo(() => createGame(fen), [fen]);
  const previewGame = useMemo(() => (previewLine ? createGame(previewLine.fen) : null), [previewLine]);
  const displayGame = previewGame ?? game;
  const isHumanTurn = game.turn() === settings.playerColor;
  const opponentColor = getOpponentColor(settings.playerColor);
  const pieces = useMemo(() => getBoardPieces(displayGame), [displayGame]);
  const piecesBySquare = useMemo(
    () => new Map(pieces.map((piece) => [piece.square, piece])),
    [pieces]
  );
  const legalDestinations = useMemo(
    () => (selectedSquare ? getLegalDestinations(game, selectedSquare) : []),
    [game, selectedSquare]
  );
  const legalDestinationSet = useMemo(
    () => new Set(legalDestinations),
    [legalDestinations]
  );
  const status = useMemo(() => getGameStatus(game), [game]);
  const checkThreat = useMemo(() => getCheckThreat(game), [game]);
  const historyRows = useMemo(() => getMoveHistoryRows(history), [history]);
  const reviewGame = useMemo(
    () => savedGames.find((gameRecord) => gameRecord.id === reviewGameId) ?? null,
    [reviewGameId, savedGames]
  );
  const reviewEvent = useMemo(
    () =>
      reviewGame?.learningEvents.find((event) => event.id === reviewEventId) ??
      reviewGame?.learningEvents[0] ??
      null,
    [reviewEventId, reviewGame]
  );
  const reviewDisplayGame = useMemo(() => {
    if (reviewPreviewLine) {
      return createGame(reviewPreviewLine.fen);
    }

    if (reviewEvent) {
      return createGame(reviewEvent.baseFen);
    }

    return createGame();
  }, [reviewEvent, reviewPreviewLine]);
  const selectedPieceSummary = useMemo(
    () =>
      getSelectedPieceSummary({
        selectedSquare,
        piecesBySquare,
        legalMoveCount: legalDestinations.length
      }),
    [legalDestinations.length, piecesBySquare, selectedSquare]
  );
  const callEngineState = useMemo(
    () =>
      getCallEngineState({
        plyCount: history.length,
        isHumanTurn,
        selectedPiece: selectedPieceSummary,
        playerColor: settings.playerColor,
        consumedPly: callEngineConsumedPly,
        engineIsThinking: engineState.status === "thinking",
        gameIsOver: status.isGameOver
      }),
    [
      callEngineConsumedPly,
      engineState.status,
      history.length,
      isHumanTurn,
      selectedPieceSummary,
      settings.playerColor,
      status.isGameOver
    ]
  );

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    if (screen !== "game" || !currentGameId || !createdAt) {
      return;
    }

    const now = new Date().toISOString();
    const savedGame = upsertSavedGame({
      id: currentGameId,
      createdAt,
      updatedAt: now,
      fen,
      history,
      learningEvents,
      settings,
      statusLabel: status.label,
      result: status.isGameOver ? status.label : "Active",
      isGameOver: status.isGameOver
    });

    setSavedGames((games) => {
      const otherGames = games.filter((gameRecord) => gameRecord.id !== savedGame.id);
      return [savedGame, ...otherGames].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [
    createdAt,
    currentGameId,
    fen,
    history,
    learningEvents,
    screen,
    settings,
    status.isGameOver,
    status.label
  ]);

  useEffect(() => {
    if (screen !== "game" || status.isGameOver || isHumanTurn || engineState.status === "thinking") {
      return;
    }

    const requestFen = fen;
    let wasCancelled = false;

    setSelectedSquare(null);
    setCallEngineResult(null);
    setCallEngineAnalysisState({ status: "idle" });
    setEngineState({
      status: "thinking",
      message: `${getColorName(opponentColor)} is thinking at ${difficultyOptions.find((option) => option.id === settings.difficulty)?.label ?? settings.difficulty} difficulty.`
    });

    const opponentMoveTimer = window.setTimeout(() => {
      if (wasCancelled || fenRef.current !== requestFen) {
        return;
      }

      requestBestMove(requestFen, settings.difficulty)
        .then((result) => {
          if (wasCancelled || fenRef.current !== requestFen) {
            return;
          }

          const parsedMove = parseUciMove(result.bestMove);
          const nextGame = cloneGameWithMove(createGame(requestFen), {
            from: parsedMove.from as Square,
            to: parsedMove.to as Square,
            promotion: parsedMove.promotion as "q" | "r" | "b" | "n" | undefined
          });

          if (!nextGame) {
            throw new Error(`Stockfish returned illegal move ${result.bestMove}.`);
          }

          const moveRecord = toMoveRecords(nextGame).at(-1);

          setFen(nextGame.fen());
          if (moveRecord) {
            setHistory((currentHistory) => [...currentHistory, moveRecord]);
          }
          setCallEngineResult(null);
          setCallEngineAnalysisState({ status: "idle" });
          setEngineState({ status: "idle" });
        })
        .catch((error) => {
          if (wasCancelled || fenRef.current !== requestFen) {
            return;
          }

          setEngineState({
            status: "error",
            message: error instanceof Error ? error.message : "Engine failed."
          });
        });
    }, opponentMoveDelayMs);

    return () => {
      wasCancelled = true;
      window.clearTimeout(opponentMoveTimer);
    };
  }, [
    engineRetryKey,
    fen,
    isHumanTurn,
    opponentColor,
    screen,
    settings.difficulty,
    status.isGameOver
  ]);

  function startNewGame(nextSettings: GameSettings) {
    const nextGame = createGame();
    const now = new Date().toISOString();

    setCurrentGameId(createGameId());
    setCreatedAt(now);
    setSettings(nextSettings);
    setFen(nextGame.fen());
    fenRef.current = nextGame.fen();
    setHistory([]);
    setLearningEvents([]);
    setSelectedSquare(null);
    setPromotionMove(null);
    setPreviewLine(null);
    setCallEngineConsumedPly(null);
    setCallEngineResult(null);
    setCallEngineAnalysisState({ status: "idle" });
    setEngineState({ status: "idle" });
    setEngineRetryKey(0);
    setScreen("game");
  }

  function openSavedGame(gameRecord: SavedGame) {
    setCurrentGameId(gameRecord.id);
    setCreatedAt(gameRecord.createdAt);
    setSettings(gameRecord.settings);
    setDraftSettings(gameRecord.settings);
    setFen(gameRecord.fen);
    fenRef.current = gameRecord.fen;
    setHistory(gameRecord.history);
    setLearningEvents(gameRecord.learningEvents ?? []);
    setSelectedSquare(null);
    setPromotionMove(null);
    setPreviewLine(null);
    setCallEngineConsumedPly(null);
    setCallEngineResult(null);
    setCallEngineAnalysisState({ status: "idle" });
    setEngineState({ status: "idle" });
    setEngineRetryKey((current) => current + 1);
    setScreen("game");
  }

  function commitMove(move: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }) {
    const nextGame = cloneGameWithMove(game, move);

    if (!nextGame) {
      return false;
    }

    const moveRecord = toMoveRecords(nextGame).at(-1);

    setFen(nextGame.fen());
    fenRef.current = nextGame.fen();
    if (moveRecord) {
      setHistory((currentHistory) => [...currentHistory, moveRecord]);
      setLearningEvents((currentEvents) =>
        currentEvents.map((event) =>
          event.basePly === history.length && !event.playedMove
            ? {
                ...event,
                playedMove: moveRecord
              }
            : event
        )
      );
    }
    setSelectedSquare(null);
    setPromotionMove(null);
    setPreviewLine(null);
    setCallEngineResult(null);
    setCallEngineAnalysisState({ status: "idle" });
    return true;
  }

  function handleSquareClick(square: Square) {
    if (
      previewLine ||
      status.isGameOver ||
      promotionMove ||
      !isHumanTurn ||
      engineState.status === "thinking" ||
      callEngineAnalysisState.status === "analyzing"
    ) {
      return;
    }

    const piece = piecesBySquare.get(square);

    if (!selectedSquare) {
      if (piece?.color === game.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    if (piece?.color === game.turn()) {
      setSelectedSquare(square);
      return;
    }

    if (!legalDestinationSet.has(square)) {
      return;
    }

    if (isPromotionMove(game, selectedSquare, square)) {
      setPromotionMove({ from: selectedSquare, to: square });
      return;
    }

    commitMove({ from: selectedSquare, to: square });
  }

  function resetGame() {
    const nextGame = createGame();
    setFen(nextGame.fen());
    fenRef.current = nextGame.fen();
    setHistory([]);
    setLearningEvents([]);
    setSelectedSquare(null);
    setPromotionMove(null);
    setPreviewLine(null);
    setCallEngineConsumedPly(null);
    setCallEngineResult(null);
    setCallEngineAnalysisState({ status: "idle" });
    setEngineState({ status: "idle" });
    setEngineRetryKey((current) => current + 1);
  }

  async function handleCallEngine() {
    if (!callEngineState.available || !selectedPieceSummary) {
      return;
    }

    const requestId = analysisRequestIdRef.current + 1;
    const requestFen = fen;
    analysisRequestIdRef.current = requestId;

    setCallEngineResult(null);
    setPreviewLine(null);
    setCallEngineAnalysisState({
      status: "analyzing",
      message: `Evaluating ${selectedPieceSummary.legalMoveCount} legal move${selectedPieceSummary.legalMoveCount === 1 ? "" : "s"} for the selected ${pieceNames[selectedPieceSummary.piece.type].toLowerCase()}, then checking the strongest opponent replies. This quality-first search can take 20-60 seconds in busy positions.`
    });

    try {
      const result = await requestPieceAnalysis({
        fen: requestFen,
        selectedSquare: selectedPieceSummary.piece.square
      });

      if (analysisRequestIdRef.current !== requestId || fenRef.current !== requestFen) {
        return;
      }

      setCallEngineConsumedPly(history.length);
      setCallEngineResult(result);
      setLearningEvents((currentEvents) => [
        {
          id: createLearningEventId(),
          createdAt: new Date().toISOString(),
          baseFen: requestFen,
          basePly: history.length,
          selectedPiece: result.selectedPiece,
          analysis: result,
          previewedCandidateMoves: [],
          previewedReplyMoves: []
        },
        ...currentEvents
      ]);
      setPreviewLine(null);
      setCallEngineAnalysisState({ status: "idle" });
    } catch (error) {
      if (analysisRequestIdRef.current !== requestId || fenRef.current !== requestFen) {
        return;
      }

      setCallEngineAnalysisState({
        status: "error",
        message: error instanceof Error ? error.message : "Piece analysis failed."
      });
    }
  }

  function cancelCallEngineAnalysis() {
    analysisRequestIdRef.current += 1;
    setCallEngineAnalysisState({ status: "idle" });
  }

  function previewCandidate(candidate: PieceAnalysisCandidate) {
    const candidateGame = cloneGameWithMove(game, {
      from: candidate.move.from as Square,
      to: candidate.move.to as Square,
      promotion: candidate.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!candidateGame) {
      return;
    }

    setSelectedSquare(null);
    setLearningEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.analysis.baseFen === fen && event.analysis.selectedPiece.square === candidate.move.from
          ? {
              ...event,
              previewedCandidateMoves: Array.from(
                new Set([...event.previewedCandidateMoves, candidate.move.uci])
              )
            }
          : event
      )
    );
    setPreviewLine({
      fen: candidateGame.fen(),
      title: `Preview: ${candidate.move.san}`,
      detail: candidate.evidence?.summary ?? `Showing ${candidate.move.san} on the board.`,
      candidateMove: candidate.move.uci
    });
  }

  function previewReply(candidate: PieceAnalysisCandidate, reply: PieceAnalysisReply) {
    const candidateGame = cloneGameWithMove(game, {
      from: candidate.move.from as Square,
      to: candidate.move.to as Square,
      promotion: candidate.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!candidateGame) {
      return;
    }

    const replyGame = cloneGameWithMove(candidateGame, {
      from: reply.move.from as Square,
      to: reply.move.to as Square,
      promotion: reply.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!replyGame) {
      return;
    }

    setSelectedSquare(null);
    setLearningEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.analysis.baseFen === fen && event.analysis.selectedPiece.square === candidate.move.from
          ? {
              ...event,
              previewedCandidateMoves: Array.from(
                new Set([...event.previewedCandidateMoves, candidate.move.uci])
              ),
              previewedReplyMoves: Array.from(
                new Set([...event.previewedReplyMoves, `${candidate.move.uci} ${reply.move.uci}`])
              )
            }
          : event
      )
    );
    setPreviewLine({
      fen: replyGame.fen(),
      title: `Preview: ${candidate.move.san} ${reply.move.san}`,
      detail: reply.evidence?.summary ?? `Showing ${candidate.move.san} followed by ${reply.move.san}.`,
      candidateMove: candidate.move.uci,
      replyMove: reply.move.uci
    });
  }

  function formatEvaluation(result: { evaluation: PieceAnalysisResponse["candidates"][number]["evaluation"] }) {
    if (result.evaluation.mate !== null) {
      return result.evaluation.mate > 0
        ? `Mate in ${result.evaluation.mate}`
        : `Mated in ${Math.abs(result.evaluation.mate)}`;
    }

    if (result.evaluation.userCp === null) {
      return "Eval unavailable";
    }

    const pawns = result.evaluation.userCp / 100;
    return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
  }

  function openPreviousGames() {
    setSavedGames(loadSavedGames());
    setScreen("previous-games");
  }

  function openReviewGame(gameRecord: SavedGame) {
    setReviewGameId(gameRecord.id);
    setReviewEventId(gameRecord.learningEvents[0]?.id ?? null);
    setReviewPreviewLine(null);
    setScreen("review-game");
  }

  function previewReviewCandidate(event: LearningEvent, candidate: PieceAnalysisCandidate) {
    const candidateGame = cloneGameWithMove(createGame(event.baseFen), {
      from: candidate.move.from as Square,
      to: candidate.move.to as Square,
      promotion: candidate.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!candidateGame) {
      return;
    }

    setReviewPreviewLine({
      fen: candidateGame.fen(),
      title: `Preview: ${candidate.move.san}`,
      detail: candidate.evidence?.summary ?? `Showing ${candidate.move.san} on the board.`,
      candidateMove: candidate.move.uci
    });
  }

  function previewReviewReply(
    event: LearningEvent,
    candidate: PieceAnalysisCandidate,
    reply: PieceAnalysisReply
  ) {
    const candidateGame = cloneGameWithMove(createGame(event.baseFen), {
      from: candidate.move.from as Square,
      to: candidate.move.to as Square,
      promotion: candidate.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!candidateGame) {
      return;
    }

    const replyGame = cloneGameWithMove(candidateGame, {
      from: reply.move.from as Square,
      to: reply.move.to as Square,
      promotion: reply.move.promotion as "q" | "r" | "b" | "n" | undefined
    });

    if (!replyGame) {
      return;
    }

    setReviewPreviewLine({
      fen: replyGame.fen(),
      title: `Preview: ${candidate.move.san} ${reply.move.san}`,
      detail: reply.evidence?.summary ?? `Showing ${candidate.move.san} followed by ${reply.move.san}.`,
      candidateMove: candidate.move.uci,
      replyMove: reply.move.uci
    });
  }

  if (screen === "new-game") {
    return (
      <main className="app-shell compact-shell">
        <button className="text-button" type="button" onClick={() => setScreen("home")}>
          <ArrowLeft size={18} aria-hidden="true" />
          Home
        </button>
        <section className="setup-panel" aria-labelledby="new-game-title">
          <div>
            <p className="eyebrow">Setup</p>
            <h1 id="new-game-title">New Game</h1>
            <p className="setup-copy">
              Choose your side and the Stockfish strength for the computer opponent.
            </p>
          </div>

          <fieldset className="option-group">
            <legend>Play as</legend>
            <div className="segmented-control">
              {(["w", "b"] as Color[]).map((color) => (
                <button
                  className={draftSettings.playerColor === color ? "active-option" : ""}
                  key={color}
                  type="button"
                  onClick={() =>
                    setDraftSettings((current) => ({
                      ...current,
                      playerColor: color
                    }))
                  }
                >
                  {getColorName(color)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="option-group">
            <legend>Difficulty</legend>
            <div className="difficulty-grid">
              {difficultyOptions.map((option) => (
                <button
                  className={
                    draftSettings.difficulty === option.id
                      ? "difficulty-option active-option"
                      : "difficulty-option"
                  }
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setDraftSettings((current) => ({
                      ...current,
                      difficulty: option.id
                    }))
                  }
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <button
            className="primary-button"
            type="button"
            onClick={() => startNewGame(draftSettings)}
          >
            <Play size={20} aria-hidden="true" />
            Start Game
          </button>
        </section>
      </main>
    );
  }

  if (screen === "game") {
    return (
      <main className="game-shell">
        <header className="game-header">
          <button className="text-button" type="button" onClick={() => setScreen("home")}>
            <ArrowLeft size={18} aria-hidden="true" />
            Home
          </button>
          <div>
            <p className="eyebrow">Play</p>
            <h1>Computer Game</h1>
          </div>
          <button className="icon-text-button" type="button" onClick={resetGame}>
            <RotateCcw size={18} aria-hidden="true" />
            Reset
          </button>
        </header>

        <section className="game-layout">
          <div className="board-zone">
            <div className="board-toolbar" aria-label="Board view">
              <button
                className={boardMode === "3d" ? "active-board-mode" : ""}
                type="button"
                onClick={() => setBoardMode("3d")}
              >
                3D
              </button>
              <button
                className={boardMode === "2d" ? "active-board-mode" : ""}
                type="button"
                onClick={() => setBoardMode("2d")}
              >
                2D
              </button>
            </div>
            {boardMode === "3d" ? (
              <Suspense fallback={<div className="board-3d-frame board-3d-loading">Loading 3D board</div>}>
                <Board3DView
                  game={displayGame}
                  selectedSquare={selectedSquare}
                  legalDestinationSet={legalDestinationSet}
                  checkThreat={previewLine ? null : checkThreat}
                  isPreview={Boolean(previewLine)}
                  onSquareClick={handleSquareClick}
                />
              </Suspense>
            ) : (
              <BoardView
                game={displayGame}
                selectedSquare={selectedSquare}
                legalDestinationSet={legalDestinationSet}
                checkThreat={previewLine ? null : checkThreat}
                isPreview={Boolean(previewLine)}
                onSquareClick={handleSquareClick}
              />
            )}
            {checkThreat && !previewLine ? (
              <div
                className={`check-alert ${checkThreat.isCheckmate ? "checkmate-alert" : ""}`}
                role="alert"
              >
                <strong>{checkThreat.isCheckmate ? "Checkmate" : "Check"}</strong>
                <span>{describeCheckThreat(checkThreat)}</span>
              </div>
            ) : null}
            <p className="board-help">
              {previewLine
                ? "Preview mode is read-only. Return to the game before making your move."
                : `You are playing ${getColorName(settings.playerColor)} against ${
                    difficultyOptions.find((option) => option.id === settings.difficulty)?.label
                  } Stockfish. Click a piece, then click a highlighted legal destination.`}
            </p>
            {previewLine ? (
              <div className="preview-banner">
                <span>
                  <strong>{previewLine.title}</strong>
                  <small>{previewLine.detail}</small>
                </span>
                <button className="retry-button" type="button" onClick={() => setPreviewLine(null)}>
                  <Reply size={16} aria-hidden="true" />
                  Back to Game
                </button>
              </div>
            ) : null}
          </div>

          <aside className="side-panel">
            <section className="status-panel">
              <p className="panel-label">Game status</p>
              <h2>
                {engineState.status === "thinking"
                  ? `${getColorName(opponentColor)} thinking`
                  : status.label}
              </h2>
              <p>{engineState.message ?? status.detail}</p>
              <dl className="game-facts">
                <div>
                  <dt>You</dt>
                  <dd>{getColorName(settings.playerColor)}</dd>
                </div>
                <div>
                  <dt>Opponent</dt>
                  <dd>
                    {
                      difficultyOptions.find((option) => option.id === settings.difficulty)
                        ?.label
                    }
                  </dd>
                </div>
              </dl>
              {engineState.status === "error" ? (
                <button
                  className="retry-button"
                  type="button"
                  onClick={() => {
                    setEngineState({ status: "idle" });
                    setEngineRetryKey((current) => current + 1);
                  }}
                >
                  Retry engine move
                </button>
              ) : null}
              {selectedSquare ? (
                <p className="selection-note">
                  Selected {selectedSquare}. {legalDestinations.length} legal move
                  {legalDestinations.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </section>

            <section className="call-engine-panel">
              <div className="panel-heading-row">
                <p className="panel-label">Call Engine</p>
                <span>{callEngineState.unlocked ? "Unlocked" : "Locked"}</span>
              </div>

              {selectedPieceSummary ? (
                <div className="selected-piece-card">
                  <span className={`selected-piece-glyph piece-${selectedPieceSummary.piece.color}`}>
                    {pieceGlyphs[selectedPieceSummary.piece.color][selectedPieceSummary.piece.type]}
                  </span>
                  <span>
                    <strong>
                      {getColorName(selectedPieceSummary.piece.color)}{" "}
                      {pieceNames[selectedPieceSummary.piece.type]} on{" "}
                      {selectedPieceSummary.piece.square}
                    </strong>
                    <small>
                      {selectedPieceSummary.legalMoveCount} legal move
                      {selectedPieceSummary.legalMoveCount === 1 ? "" : "s"}
                    </small>
                  </span>
                </div>
              ) : (
                <p className="empty-state">Select one of your pieces to inspect it.</p>
              )}

              <p className="call-engine-reason">{callEngineState.reason}</p>

              <button
                className="call-engine-button"
                type="button"
                disabled={!callEngineState.available || callEngineAnalysisState.status === "analyzing"}
                onClick={handleCallEngine}
              >
                <Cpu size={18} aria-hidden="true" />
                {callEngineAnalysisState.status === "analyzing" ? "Analyzing" : "Call Engine"}
              </button>

              {callEngineAnalysisState.status === "analyzing" ? (
                <div className="analysis-progress">
                  <strong>Analyzing selected piece</strong>
                  <p>{callEngineAnalysisState.message}</p>
                  <ol>
                    <li>Finding legal moves</li>
                    <li>Evaluating candidate positions</li>
                    <li>Checking opponent replies</li>
                    <li>Ranking from your perspective</li>
                  </ol>
                  <button className="retry-button" type="button" onClick={cancelCallEngineAnalysis}>
                    Cancel
                  </button>
                </div>
              ) : null}

              {callEngineAnalysisState.status === "error" ? (
                <div className="analysis-error">
                  <strong>Analysis failed</strong>
                  <p>{callEngineAnalysisState.message}</p>
                  <button
                    className="retry-button"
                    type="button"
                    disabled={!callEngineState.available}
                    onClick={handleCallEngine}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              {callEngineResult ? (
                <div className="call-engine-result">
                  <strong>
                    {pieceNames[callEngineResult.selectedPiece.type as keyof typeof pieceNames]} on{" "}
                    {callEngineResult.selectedPiece.square}
                  </strong>
                  <ol className="candidate-list">
                    {callEngineResult.candidates.map((candidate) => (
                      <li
                        className={previewLine?.candidateMove === candidate.move.uci && !previewLine.replyMove ? "active-preview-line" : ""}
                        key={candidate.move.uci}
                      >
                        <button
                          className="candidate-row candidate-preview-button"
                          type="button"
                          onClick={() => previewCandidate(candidate)}
                        >
                          <span>
                            <strong>
                              {candidate.rank}. {candidate.move.san}
                            </strong>
                            <small>
                              Depth {candidate.evaluation.depth ?? "?"} · {candidate.move.uci}
                            </small>
                          </span>
                          <span className="candidate-eval">{formatEvaluation(candidate)}</span>
                        </button>
                        {candidate.evidence ? (
                          <div className="move-explanation">
                            <p>{candidate.evidence.summary}</p>
                            <div className="evidence-chip-row">
                              {candidate.evidence.facts.slice(0, 3).map((fact) => (
                                <span key={`${candidate.move.uci}-${fact}`}>{fact}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {(candidate.opponentReplies ?? []).length > 0 ? (
                          <div className="reply-list">
                            <span>Opponent replies</span>
                            {(candidate.opponentReplies ?? []).map((reply) => (
                              <button
                                className={[
                                  "reply-row",
                                  previewLine?.candidateMove === candidate.move.uci &&
                                  previewLine.replyMove === reply.move.uci
                                    ? "active-preview-line"
                                    : ""
                                ].join(" ")}
                                key={`${candidate.move.uci}-${reply.move.uci}`}
                                type="button"
                                onClick={() => previewReply(candidate, reply)}
                              >
                                <span className="reply-main">
                                  <strong>
                                    {reply.rank}. {reply.move.san}
                                  </strong>
                                  {reply.evidence ? <small>{reply.evidence.summary}</small> : null}
                                </span>
                                <small>
                                  {formatEvaluation(reply)} · depth {reply.evaluation.depth ?? "?"}
                                </small>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>

            <section className="move-history-panel">
              <div className="panel-heading-row">
                <p className="panel-label">Move history</p>
                <span>{history.length} ply</span>
              </div>
              {historyRows.length > 0 ? (
                <ol className="move-list">
                  {historyRows.map((row) => (
                    <li key={row.moveNumber}>
                      <span className="move-number">{row.moveNumber}.</span>
                      <span className={row.white ? "move-pill white-move-pill" : "move-pill empty-move-pill"}>
                        {row.white ?? ""}
                      </span>
                      <span className={row.black ? "move-pill black-move-pill" : "move-pill empty-move-pill"}>
                        {row.black ?? ""}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-state">No moves yet.</p>
              )}
            </section>

            <section className="learning-events-panel">
              <div className="panel-heading-row">
                <p className="panel-label">Learning moments</p>
                <span>{learningEvents.length}</span>
              </div>
              {learningEvents.length > 0 ? (
                <ol className="learning-event-list">
                  {learningEvents.map((event) => (
                    <li key={event.id}>
                      <strong>
                        {pieceNames[event.selectedPiece.type as keyof typeof pieceNames]} on{" "}
                        {event.selectedPiece.square}
                      </strong>
                      <small>
                        Ply {event.basePly} · {event.analysis.candidates.length} candidate
                        {event.analysis.candidates.length === 1 ? "" : "s"} ·{" "}
                        {formatSavedGameDate(event.createdAt)}
                      </small>
                      <span>
                        Previewed {event.previewedCandidateMoves.length} candidate
                        {event.previewedCandidateMoves.length === 1 ? "" : "s"} and{" "}
                        {event.previewedReplyMoves.length} repl
                        {event.previewedReplyMoves.length === 1 ? "y" : "ies"}.
                      </span>
                      {event.playedMove ? <em>Played {event.playedMove.san}</em> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-state">Call Engine results will be saved here.</p>
              )}
            </section>
          </aside>
        </section>

        {promotionMove ? (
          <div className="promotion-backdrop" role="presentation">
            <div className="promotion-dialog" role="dialog" aria-modal="true">
              <p className="panel-label">Promote pawn</p>
              <h2>Choose a piece</h2>
              <div className="promotion-options">
                {(["q", "r", "b", "n"] as const).map((piece) => (
                  <button
                    key={piece}
                    type="button"
                    onClick={() =>
                      commitMove({
                        ...promotionMove,
                        promotion: piece
                      })
                    }
                  >
                    {pieceGlyphs[game.turn()][piece]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (screen === "previous-games") {
    return (
      <main className="app-shell compact-shell">
        <button className="text-button" type="button" onClick={() => setScreen("home")}>
          <ArrowLeft size={18} aria-hidden="true" />
          Home
        </button>
        <section className="saved-games-panel">
          <div className="saved-games-header">
            <div>
              <p className="eyebrow">Journal</p>
              <h1>Learning Journal</h1>
              <p>Saved locally in this browser.</p>
            </div>
            <span>{savedGames.length} saved</span>
          </div>

          {savedGames.length > 0 ? (
            <div className="saved-game-list">
              {savedGames.map((gameRecord) => {
                const difficulty = difficultyOptions.find(
                  (option) => option.id === gameRecord.settings.difficulty
                );

                return (
                  <div className="saved-game-row" key={gameRecord.id}>
                    <button
                      className="saved-game-card"
                      type="button"
                      onClick={() => openSavedGame(gameRecord)}
                    >
                      <span>
                        <strong>
                          {getColorName(gameRecord.settings.playerColor)} vs{" "}
                          {difficulty?.label ?? gameRecord.settings.difficulty}
                        </strong>
                        <small>{formatSavedGameDate(gameRecord.updatedAt)}</small>
                      </span>
                      <span>
                        <strong>{gameRecord.result}</strong>
                        <small>
                          {Math.ceil(gameRecord.history.length / 2)} move
                          {Math.ceil(gameRecord.history.length / 2) === 1 ? "" : "s"}
                        </small>
                      </span>
                      <span>
                        <strong>{gameRecord.learningEvents.length}</strong>
                        <small>
                          learning moment
                          {gameRecord.learningEvents.length === 1 ? "" : "s"}
                        </small>
                      </span>
                      <ArrowRight size={20} aria-hidden="true" />
                    </button>
                    <button
                      className="review-game-button"
                      type="button"
                      disabled={gameRecord.learningEvents.length === 0}
                      onClick={() => openReviewGame(gameRecord)}
                    >
                      <BookOpen size={18} aria-hidden="true" />
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-saved-games">
              <h2>No saved games yet</h2>
              <p>Start a game and make a move; it will appear here automatically.</p>
              <button className="primary-button" type="button" onClick={() => setScreen("new-game")}>
                <Play size={20} aria-hidden="true" />
                Start Game
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "review-game") {
    return (
      <main className="game-shell">
        <header className="game-header">
          <button className="text-button" type="button" onClick={openPreviousGames}>
            <ArrowLeft size={18} aria-hidden="true" />
            Learning Journal
          </button>
          <div>
            <p className="eyebrow">Review</p>
            <h1>Learning Journal</h1>
          </div>
          {reviewGame ? (
            <button className="icon-text-button" type="button" onClick={() => openSavedGame(reviewGame)}>
              <Play size={18} aria-hidden="true" />
              Open Game
            </button>
          ) : null}
        </header>

        {reviewGame && reviewEvent ? (
          <section className="review-layout">
            <div className="board-zone">
              <BoardView
                game={reviewDisplayGame}
                isPreview
              />
              <p className="board-help">
                Review mode is read-only. Choose a saved candidate or reply to replay that line from
                the original Call Engine position.
              </p>
              <div className="preview-banner">
                <span>
                  <strong>{reviewPreviewLine?.title ?? "Base position"}</strong>
                  <small>
                    {reviewPreviewLine?.detail ??
                      `${pieceNames[reviewEvent.selectedPiece.type as keyof typeof pieceNames]} on ${reviewEvent.selectedPiece.square}, saved at ply ${reviewEvent.basePly}.`}
                  </small>
                </span>
                {reviewPreviewLine ? (
                  <button
                    className="retry-button"
                    type="button"
                    onClick={() => setReviewPreviewLine(null)}
                  >
                    <Reply size={16} aria-hidden="true" />
                    Base Position
                  </button>
                ) : null}
              </div>
            </div>

            <aside className="side-panel">
              <section className="review-events-panel">
                <div className="panel-heading-row">
                  <p className="panel-label">Saved moments</p>
                  <span>{reviewGame.learningEvents.length}</span>
                </div>
                <div className="review-event-selector">
                  {reviewGame.learningEvents.map((event) => (
                    <button
                      className={event.id === reviewEvent.id ? "active-review-event" : ""}
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setReviewEventId(event.id);
                        setReviewPreviewLine(null);
                      }}
                    >
                      <strong>
                        {pieceNames[event.selectedPiece.type as keyof typeof pieceNames]} on{" "}
                        {event.selectedPiece.square}
                      </strong>
                      <small>
                        Ply {event.basePly} · {formatSavedGameDate(event.createdAt)}
                      </small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="review-events-panel">
                <div className="panel-heading-row">
                  <p className="panel-label">Moment detail</p>
                  <span>{reviewEvent.analysis.candidates.length} candidates</span>
                </div>
                <dl className="review-facts">
                  <div>
                    <dt>Selected</dt>
                    <dd>
                      {pieceNames[reviewEvent.selectedPiece.type as keyof typeof pieceNames]} on{" "}
                      {reviewEvent.selectedPiece.square}
                    </dd>
                  </div>
                  <div>
                    <dt>Played</dt>
                    <dd>{reviewEvent.playedMove?.san ?? "Not recorded yet"}</dd>
                  </div>
                  <div>
                    <dt>Previewed</dt>
                    <dd>
                      {reviewEvent.previewedCandidateMoves.length} candidate
                      {reviewEvent.previewedCandidateMoves.length === 1 ? "" : "s"},{" "}
                      {reviewEvent.previewedReplyMoves.length} repl
                      {reviewEvent.previewedReplyMoves.length === 1 ? "y" : "ies"}
                    </dd>
                  </div>
                </dl>
                <a
                  className="export-json-link"
                  download={`learning-event-${reviewEvent.id}.json`}
                  href={createLearningEventExportHref(reviewGame, reviewEvent)}
                >
                  Export JSON
                </a>
              </section>

              <section className="call-engine-result">
                <strong>Saved analysis</strong>
                <ol className="candidate-list">
                  {reviewEvent.analysis.candidates.map((candidate) => (
                    <li
                      className={
                        reviewPreviewLine?.candidateMove === candidate.move.uci &&
                        !reviewPreviewLine.replyMove
                          ? "active-preview-line"
                          : ""
                      }
                      key={candidate.move.uci}
                    >
                      <button
                        className="candidate-row candidate-preview-button"
                        type="button"
                        onClick={() => previewReviewCandidate(reviewEvent, candidate)}
                      >
                        <span>
                          <strong>
                            {candidate.rank}. {candidate.move.san}
                          </strong>
                          <small>
                            Depth {candidate.evaluation.depth ?? "?"} · {candidate.move.uci}
                          </small>
                        </span>
                        <span className="candidate-eval">{formatEvaluation(candidate)}</span>
                      </button>
                      {candidate.evidence ? (
                        <div className="move-explanation">
                          <p>{candidate.evidence.summary}</p>
                        </div>
                      ) : null}
                      {(candidate.opponentReplies ?? []).length > 0 ? (
                        <div className="reply-list">
                          <span>Opponent replies</span>
                          {(candidate.opponentReplies ?? []).map((reply) => (
                            <button
                              className={[
                                "reply-row",
                                reviewPreviewLine?.candidateMove === candidate.move.uci &&
                                reviewPreviewLine.replyMove === reply.move.uci
                                  ? "active-preview-line"
                                  : ""
                              ].join(" ")}
                              key={`${candidate.move.uci}-${reply.move.uci}`}
                              type="button"
                              onClick={() => previewReviewReply(reviewEvent, candidate, reply)}
                            >
                              <span className="reply-main">
                                <strong>
                                  {reply.rank}. {reply.move.san}
                                </strong>
                                {reply.evidence ? <small>{reply.evidence.summary}</small> : null}
                              </span>
                              <small>
                                {formatEvaluation(reply)} · depth {reply.evaluation.depth ?? "?"}
                              </small>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </section>
        ) : (
          <section className="placeholder-panel">
            <h1>No learning moments yet</h1>
            <p>Use Call Engine during a game to create reviewable learning moments.</p>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="intro-panel" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Chess learning lab</p>
          <h1 id="page-title">Piece-Conditioned Chess Engine</h1>
          <p className="intro-copy">
            A local-first chess learning app where the user chooses a piece,
            Stockfish evaluates the chess, and grounded explanations teach what
            changed.
          </p>
        </div>
      </section>

      <section className="action-grid" aria-label="Home actions">
        {homeActions.map((action) => {
          const Icon = actionIcons[action.id];

          return (
            <button
              className="home-action"
              key={action.id}
              type="button"
              onClick={() => (action.id === "start-game" ? setScreen("new-game") : openPreviousGames())}
            >
              <span className="action-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={2.2} />
              </span>
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </button>
          );
        })}
      </section>

      <section className="checkpoint-panel" aria-labelledby="checkpoint-title">
        <div className="checkpoint-heading">
          <ShieldCheck size={22} aria-hidden="true" />
          <h2 id="checkpoint-title">What It Does</h2>
        </div>
        <ul>
          {productHighlights.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
