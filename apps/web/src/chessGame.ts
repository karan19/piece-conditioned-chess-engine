import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export type BoardPiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

export type GameStatus = {
  label: string;
  detail: string;
  isGameOver: boolean;
};

export type MoveRecord = {
  color: Color;
  san: string;
  from: Square;
  to: Square;
  promotion?: string;
};

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export const pieceGlyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚"
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚"
  }
};

export function createGame(fen?: string): Chess {
  return new Chess(fen);
}

export function getBoardPieces(game: Chess): BoardPiece[] {
  return game.board().flatMap((rank, rankIndex) =>
    rank.flatMap((piece, fileIndex) => {
      if (!piece) {
        return [];
      }

      return [
        {
          square: `${files[fileIndex]}${ranks[rankIndex]}` as Square,
          type: piece.type,
          color: piece.color
        }
      ];
    })
  );
}

export function getLegalDestinations(game: Chess, square: Square): Square[] {
  return game.moves({ square, verbose: true }).map((move) => move.to);
}

export function toMoveRecords(game: Chess): MoveRecord[] {
  return game.history({ verbose: true }).map((move) => ({
    color: move.color,
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion
  }));
}

export function getMoveHistoryRows(history: MoveRecord[]) {
  const rows: { moveNumber: number; white?: string; black?: string }[] = [];

  history.forEach((move, index) => {
    if (move.color === "w") {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: move.san
      });
      return;
    }

    const currentRow = rows[rows.length - 1];

    if (currentRow) {
      currentRow.black = move.san;
    } else {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        black: move.san
      });
    }
  });

  return rows;
}

export function getGameStatus(game: Chess): GameStatus {
  const turn = game.turn() === "w" ? "White" : "Black";

  if (game.isCheckmate()) {
    return {
      label: "Checkmate",
      detail: `${turn} is checkmated. ${turn === "White" ? "Black" : "White"} wins.`,
      isGameOver: true
    };
  }

  if (game.isStalemate()) {
    return {
      label: "Stalemate",
      detail: `${turn} has no legal moves. The game is drawn.`,
      isGameOver: true
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      label: "Draw",
      detail: "The position has repeated three times.",
      isGameOver: true
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      label: "Draw",
      detail: "Neither side has enough material to checkmate.",
      isGameOver: true
    };
  }

  if (game.isDraw()) {
    return {
      label: "Draw",
      detail: "The game is drawn.",
      isGameOver: true
    };
  }

  if (game.isCheck()) {
    return {
      label: "Check",
      detail: `${turn} to move is in check.`,
      isGameOver: false
    };
  }

  return {
    label: `${turn} to move`,
    detail: "Play your legal move when it is your turn.",
    isGameOver: false
  };
}

export function isPromotionMove(game: Chess, from: Square, to: Square): boolean {
  const piece = game.get(from);

  if (!piece || piece.type !== "p") {
    return false;
  }

  const destinationRank = Number(to[1]);
  return (
    (piece.color === "w" && destinationRank === 8) ||
    (piece.color === "b" && destinationRank === 1)
  );
}

export function cloneGameWithMove(
  game: Chess,
  move: { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" }
): Chess | null {
  const nextGame = new Chess(game.fen());

  try {
    nextGame.move(move);
    return nextGame;
  } catch {
    return null;
  }
}
