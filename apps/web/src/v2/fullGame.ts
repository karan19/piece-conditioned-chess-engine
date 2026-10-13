import { Chess, type Move } from "chess.js";
import { type Opening, type Side } from "./catalog";
import { buildApiUrl, parseUciMove } from "../engineClient";
export type GameResult = {
  title: string;
  detail: string;
  result: "1-0" | "0-1" | "1/2-1/2";
};
export function replayGame(
  opening: Opening,
  continuation: string[] = [],
  ply = opening.moves.length + continuation.length,
): Chess {
  const game = new Chess();
  for (const san of [...opening.moves, ...continuation].slice(0, ply)) {
    if (game.isGameOver())
      throw new Error("A game cannot continue after its result.");
    const move = game.move(san);
    if (move.san !== san)
      throw new Error("Saved game contains a noncanonical move.");
  }
  return game;
}
export function gameResult(game: Chess): GameResult | null {
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    return {
      title: `Checkmate — ${winner} wins`,
      detail: "The king is in check and there is no legal escape.",
      result: game.turn() === "w" ? "0-1" : "1-0",
    };
  }
  if (game.isStalemate())
    return {
      title: "Draw — stalemate",
      detail:
        "The player to move has no legal move, but their king is not in check.",
      result: "1/2-1/2",
    };
  if (game.isInsufficientMaterial())
    return {
      title: "Draw — insufficient material",
      detail:
        "The remaining material cannot deliver checkmate under the game rules.",
      result: "1/2-1/2",
    };
  if (game.isThreefoldRepetition())
    return {
      title: "Draw — threefold repetition",
      detail:
        "The same position occurred three times. This guided game treats the available draw as its result.",
      result: "1/2-1/2",
    };
  if (game.isDrawByFiftyMoves())
    return {
      title: "Draw — fifty-move rule",
      detail:
        "Fifty moves by each side passed without a pawn move or capture. This guided game treats the available draw as its result.",
      result: "1/2-1/2",
    };
  return game.isDraw()
    ? {
        title: "Draw",
        detail: "This position is drawn under the game rules.",
        result: "1/2-1/2",
      }
    : null;
}
export function isEndgame(game: Chess) {
  const pieces = game
    .board()
    .flat()
    .filter((p) => p && p.type !== "p" && p.type !== "k");
  return (
    pieces.filter((p) => p?.type === "q").length === 0 || pieces.length <= 4
  );
}
export function phasePlan(game: Chess, side: Side) {
  if (game.isCheck())
    return game.turn() === side
      ? "Your king is in check. The next move must capture the checking piece, block the check, or move the king to a safe square."
      : "The opponent is in check. Look at the legal escapes and keep your pieces coordinated as the attack continues.";
  if (isEndgame(game))
    return "Coordinate the remaining pieces and king, support passed pawns, and watch promotion squares. Check the opponent's checks and captures before every move; stalemate can turn a winning position into a draw.";
  const queens = game
    .board()
    .flat()
    .some((p) => p?.type === "q");
  return queens
    ? "Coordinate your pieces around the current pawn structure, protect your king, and look for checks, captures, and threats. Follow the actual position rather than repeating the opening setup."
    : "Use active pieces and useful pawn breaks to improve the position. Watch for opportunities to win material or simplify into a favorable endgame.";
}
export class EngineBusyError extends Error {
  constructor(public retryAfterMs: number) {
    super(
      "The engine is busy. Your position is saved; we'll retry when it is available.",
    );
  }
}
export async function nextEngineMove(
  game: Chess,
  side: Side,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Move> {
  if (game.isGameOver()) throw new Error("This game already has a result.");
  const response = await fetcher(buildApiUrl("/api/engine/best-move"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fen: game.fen(),
      difficulty: game.turn() === side ? "expert" : "medium",
    }),
    signal,
  });
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After") ?? 10);
    throw new EngineBusyError(
      Number.isFinite(seconds) && seconds > 0
        ? Math.min(seconds * 1000, 300000)
        : 10000,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error ??
        "Couldn't reach the chess engine. Retry to continue from this saved position.",
    );
  }
  const body = await response.json();
  if (typeof body?.bestMove !== "string")
    throw new Error("The engine returned no move. Retry to continue.");
  const candidate = new Chess(game.fen());
  try {
    return candidate.move(parseUciMove(body.bestMove));
  } catch {
    throw new Error(
      "The engine returned an invalid move. Retry to continue from this position.",
    );
  }
}

export function exportGuidedGame(
  opening: Opening,
  continuation: string[] = [],
  ply = opening.moves.length + continuation.length,
) {
  const game = replayGame(opening, continuation, ply);
  game.header(
    "Event",
    "Opening Studio guided game",
    "Opening",
    opening.name,
    "Result",
    gameResult(game)?.result ?? "*",
  );
  return game.pgn();
}
