import type { MoveRecord } from "./chessGame";
import type { PieceAnalysisResponse } from "./engineClient";
import type { GameSettings } from "./gameSettings";

export type LearningEvent = {
  id: string;
  createdAt: string;
  baseFen: string;
  basePly: number;
  selectedPiece: PieceAnalysisResponse["selectedPiece"];
  analysis: PieceAnalysisResponse;
  previewedCandidateMoves: string[];
  previewedReplyMoves: string[];
  playedMove?: MoveRecord;
};

export type SavedGame = {
  id: string;
  createdAt: string;
  updatedAt: string;
  fen: string;
  history: MoveRecord[];
  settings: GameSettings;
  statusLabel: string;
  result: string;
  isGameOver: boolean;
  learningEvents: LearningEvent[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const savedGamesKey = "pcce.savedGames.v1";

function normalizeLearningEvents(value: unknown): LearningEvent[] {
  return Array.isArray(value) ? (value as LearningEvent[]) : [];
}

function normalizeSavedGame(game: SavedGame): SavedGame {
  return {
    ...game,
    learningEvents: normalizeLearningEvents(game.learningEvents)
  };
}

function readRawGames(storage: StorageLike): SavedGame[] {
  const rawValue = storage.getItem(savedGamesKey);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as SavedGame[];
    return Array.isArray(parsed) ? parsed.map((game) => normalizeSavedGame(game)) : [];
  } catch {
    return [];
  }
}

function writeRawGames(storage: StorageLike, games: SavedGame[]) {
  storage.setItem(savedGamesKey, JSON.stringify(games));
}

export function createGameId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `game-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createLearningEventId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `learning-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadSavedGames(storage: StorageLike = localStorage) {
  return readRawGames(storage).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getSavedGame(id: string, storage: StorageLike = localStorage) {
  return readRawGames(storage).find((game) => game.id === id) ?? null;
}

export function upsertSavedGame(game: SavedGame, storage: StorageLike = localStorage) {
  const games = readRawGames(storage);
  const normalizedGame = normalizeSavedGame(game);
  const existingIndex = games.findIndex((savedGame) => savedGame.id === normalizedGame.id);

  if (existingIndex >= 0) {
    games[existingIndex] = normalizedGame;
  } else {
    games.push(normalizedGame);
  }

  writeRawGames(storage, games);
  return normalizedGame;
}

export function countSavedGames(storage: StorageLike = localStorage) {
  return readRawGames(storage).length;
}

export function formatSavedGameDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
