import type { Color, PieceSymbol, Square } from "chess.js";
import type { BoardPiece } from "./chessGame";

export type CallEngineState = {
  unlocked: boolean;
  available: boolean;
  reason: string;
};

export type SelectedPieceSummary = {
  piece: BoardPiece;
  legalMoveCount: number;
};

const unlockPly = 6;

export const pieceNames: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King"
};

export function getSelectedPieceSummary({
  selectedSquare,
  piecesBySquare,
  legalMoveCount
}: {
  selectedSquare: Square | null;
  piecesBySquare: Map<Square, BoardPiece>;
  legalMoveCount: number;
}): SelectedPieceSummary | null {
  if (!selectedSquare) {
    return null;
  }

  const piece = piecesBySquare.get(selectedSquare);

  if (!piece) {
    return null;
  }

  return {
    piece,
    legalMoveCount
  };
}

export function getCallEngineState({
  plyCount,
  isHumanTurn,
  selectedPiece,
  playerColor,
  consumedPly,
  engineIsThinking,
  gameIsOver
}: {
  plyCount: number;
  isHumanTurn: boolean;
  selectedPiece: SelectedPieceSummary | null;
  playerColor: Color;
  consumedPly: number | null;
  engineIsThinking: boolean;
  gameIsOver: boolean;
}): CallEngineState {
  if (gameIsOver) {
    return {
      unlocked: plyCount >= unlockPly,
      available: false,
      reason: "The game is over."
    };
  }

  if (plyCount < unlockPly) {
    const remaining = unlockPly - plyCount;

    return {
      unlocked: false,
      available: false,
      reason: `Call Engine unlocks after ${remaining} more ply.`
    };
  }

  if (!isHumanTurn) {
    return {
      unlocked: true,
      available: false,
      reason: "Call Engine is available only on your turn."
    };
  }

  if (engineIsThinking) {
    return {
      unlocked: true,
      available: false,
      reason: "Wait for the computer move to finish."
    };
  }

  if (!selectedPiece) {
    return {
      unlocked: true,
      available: false,
      reason: "Select one of your pieces to call the engine."
    };
  }

  if (selectedPiece.piece.color !== playerColor) {
    return {
      unlocked: true,
      available: false,
      reason: "Call Engine works only on your pieces."
    };
  }

  if (selectedPiece.legalMoveCount === 0) {
    return {
      unlocked: true,
      available: false,
      reason: "This piece has no legal moves in the current position."
    };
  }

  if (consumedPly === plyCount) {
    return {
      unlocked: true,
      available: false,
      reason: "Call Engine has already been used this turn."
    };
  }

  return {
    unlocked: true,
    available: true,
    reason: "Call Engine is ready for the selected piece."
  };
}
