import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { evaluatePosition } from "./stockfishEngine.js";

export type MoveEvidence = {
  summary: string;
  facts: string[];
  capturedPiece: PieceSymbol | null;
  givesCheck: boolean;
  givesCheckmate: boolean;
  isPromotion: boolean;
  movedPieceAttacked: boolean;
  movedPieceDefended: boolean;
  materialDelta: number;
};

export type PieceAnalysisCandidate = {
  rank: number;
  move: {
    uci: string;
    san: string;
    piece: PieceSymbol;
    from: Square;
    to: Square;
    promotion?: string;
  };
  evaluation: {
    userCp: number | null;
    mate: number | null;
    depth: number | null;
  };
  evidence: MoveEvidence;
  opponentReplies: OpponentReply[];
};

export type OpponentReply = {
  rank: number;
  move: {
    uci: string;
    san: string;
    piece: PieceSymbol;
    from: Square;
    to: Square;
    promotion?: string;
  };
  evaluation: {
    userCp: number | null;
    mate: number | null;
    depth: number | null;
  };
  evidence: MoveEvidence;
};

export type PieceAnalysisResult = {
  selectedPiece: {
    type: string;
    color: Color;
    square: Square;
  };
  baseFen: string;
  candidateCount: number;
  candidates: PieceAnalysisCandidate[];
};

const defaultCandidateCount = 4;
const defaultReplyCount = 3;
const maxCandidateCount = 6;
const maxReplyCount = 3;
const maxReplySearchCount = 8;
const analysisMoveTimeMs = 900;
const replyMoveTimeMs = 450;
const pieceLabels: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};
const pieceValues: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};
const colorLabels: Record<Color, string> = {
  b: "Black",
  w: "White"
};

function getOpponent(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function toUciMove(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function clampCount(value: number | undefined, defaultValue: number, maxValue: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return defaultValue;
  }

  return Math.min(Math.max(Math.trunc(value), 0), maxValue);
}

function formatMaterialDelta(materialDelta: number) {
  if (materialDelta === 0) {
    return "material stays even on this move";
  }

  return materialDelta > 0
    ? `wins about ${materialDelta} point${materialDelta === 1 ? "" : "s"} of material`
    : `gives up about ${Math.abs(materialDelta)} point${materialDelta === -1 ? "" : "s"} of material`;
}

function describePiece(color: Color, piece: PieceSymbol) {
  return `${colorLabels[color]}'s ${pieceLabels[piece]}`;
}

function describeMoveSubject(move: Move) {
  return `${describePiece(move.color, move.piece)} from ${move.from} to ${move.to}`;
}

function buildMoveEvidence({
  after,
  move,
  perspectiveColor
}: {
  after: Chess;
  move: Move;
  perspectiveColor: Color;
}): MoveEvidence {
  const moverColor = move.color;
  const opponentColor = getOpponent(moverColor);
  const capturedPiece = move.captured ?? null;
  const givesCheckmate = after.isCheckmate();
  const givesCheck = after.isCheck();
  const movedPiece = after.get(move.to);
  const movedPieceAttacked = movedPiece ? after.isAttacked(move.to, opponentColor) : false;
  const movedPieceDefended = movedPiece ? after.isAttacked(move.to, moverColor) : false;
  const capturedValue = capturedPiece ? pieceValues[capturedPiece] : 0;
  const promotedValue = move.promotion ? pieceValues[move.promotion] - pieceValues.p : 0;
  const moverMaterialDelta = capturedValue + promotedValue;
  const materialDelta = moverColor === perspectiveColor ? moverMaterialDelta : -moverMaterialDelta;
  const facts: string[] = [];

  if (capturedPiece) {
    facts.push(`captures ${describePiece(opponentColor, capturedPiece)}`);
  }

  if (move.isPromotion()) {
    facts.push(`promotes to a ${pieceLabels[move.promotion ?? "q"]}`);
  }

  if (givesCheckmate) {
    facts.push("gives checkmate");
  } else if (givesCheck) {
    facts.push("gives check");
  }

  if (movedPieceAttacked) {
    facts.push(`${describePiece(moverColor, move.piece)} on ${move.to} can be captured`);
  } else {
    facts.push(`${describePiece(moverColor, move.piece)} on ${move.to} is not directly attacked`);
  }

  if (movedPieceDefended && move.piece !== "k") {
    facts.push(`${describePiece(moverColor, move.piece)} on ${move.to} is defended`);
  }

  facts.push(formatMaterialDelta(materialDelta));

  const summaryParts = [`${move.san}: ${describeMoveSubject(move)}`];

  if (capturedPiece) {
    summaryParts.push(`It captures ${describePiece(opponentColor, capturedPiece)} on ${move.to}`);
  }

  if (givesCheckmate) {
    summaryParts.push("It gives checkmate");
  } else if (givesCheck) {
    summaryParts.push("It gives check");
  }

  if (materialDelta !== 0) {
    summaryParts.push(`It ${formatMaterialDelta(materialDelta)}`);
  }

  summaryParts.push(
    movedPieceAttacked
      ? `${describePiece(moverColor, move.piece)} on ${move.to} is attacked in the resulting position`
      : `${describePiece(moverColor, move.piece)} on ${move.to} is not directly attacked in the resulting position`
  );

  return {
    summary: `${summaryParts.join(". ")}.`,
    facts,
    capturedPiece,
    givesCheck,
    givesCheckmate,
    isPromotion: move.isPromotion(),
    movedPieceAttacked,
    movedPieceDefended,
    materialDelta
  };
}

function scoreForRanking(candidate: PieceAnalysisCandidate) {
  if (candidate.evaluation.mate !== null) {
    return candidate.evaluation.mate > 0 ? 1_000_000 - candidate.evaluation.mate : -1_000_000 - candidate.evaluation.mate;
  }

  return candidate.evaluation.userCp ?? Number.NEGATIVE_INFINITY;
}

function scoreEvaluation({
  userCp,
  mate
}: {
  userCp: number | null;
  mate: number | null;
}) {
  if (mate !== null) {
    return mate > 0 ? 1_000_000 - mate : -1_000_000 - mate;
  }

  return userCp ?? Number.NEGATIVE_INFINITY;
}

function scoreReplyForSearch({
  after,
  move
}: {
  after: Chess;
  move: Move;
}) {
  let score = 0;

  if (after.isCheckmate()) {
    score += 10_000;
  } else if (after.isCheck()) {
    score += 2_000;
  }

  if (move.captured) {
    score += pieceValues[move.captured] * 100;
  }

  if (move.promotion) {
    score += pieceValues[move.promotion] * 80;
  }

  if (move.san.includes("+") || move.san.includes("#")) {
    score += 500;
  }

  return score;
}

function selectReplySearchMoves(candidateFen: string, replyMoves: Move[]) {
  return replyMoves
    .map((replyMove, index) => {
      const replyGame = new Chess(candidateFen);
      const appliedReplyMove = replyGame.move({
        from: replyMove.from,
        to: replyMove.to,
        promotion: replyMove.promotion
      });

      return {
        move: replyMove,
        score: scoreReplyForSearch({
          after: replyGame,
          move: appliedReplyMove
        }),
        index
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxReplySearchCount)
    .map((reply) => reply.move);
}

function normalizeEvaluation({
  evaluationCp,
  evaluationMate,
  sideToMove,
  userColor
}: {
  evaluationCp: number | null;
  evaluationMate: number | null;
  sideToMove: Color;
  userColor: Color;
}) {
  const multiplier = sideToMove === userColor ? 1 : -1;

  return {
    userCp: evaluationCp === null ? null : evaluationCp * multiplier,
    mate: evaluationMate === null ? null : evaluationMate * multiplier
  };
}

export async function analyzeSelectedPiece({
  fen,
  selectedSquare,
  candidateCount,
  replyCount
}: {
  fen: string;
  selectedSquare: Square;
  candidateCount?: number;
  replyCount?: number;
}): Promise<PieceAnalysisResult> {
  const game = new Chess(fen);
  const selectedPiece = game.get(selectedSquare);
  const safeCandidateCount = clampCount(candidateCount, defaultCandidateCount, maxCandidateCount);
  const safeReplyCount = clampCount(replyCount, defaultReplyCount, maxReplyCount);

  if (!selectedPiece) {
    throw new Error("No piece exists on the selected square.");
  }

  if (selectedPiece.color !== game.turn()) {
    throw new Error("Selected piece must belong to the side to move.");
  }

  const legalMoves = game.moves({
    square: selectedSquare,
    verbose: true
  });

  if (legalMoves.length === 0) {
    throw new Error("Selected piece has no legal moves.");
  }

  const candidates = await Promise.all(
    legalMoves.map(async (move) => {
      const candidateGame = new Chess(fen);
      const appliedMove = candidateGame.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion
      });
      const evidence = buildMoveEvidence({
        after: candidateGame,
        move: appliedMove,
        perspectiveColor: selectedPiece.color
      });

      const rawEvaluation = await evaluatePosition({
        fen: candidateGame.fen(),
        moveTimeMs: analysisMoveTimeMs
      });
      const normalizedEvaluation = normalizeEvaluation({
        evaluationCp: rawEvaluation.cp,
        evaluationMate: rawEvaluation.mate,
        sideToMove: candidateGame.turn(),
        userColor: selectedPiece.color
      });

      return {
        rank: 0,
        move: {
          uci: toUciMove(move),
          san: move.san,
          piece: move.piece,
          from: move.from,
          to: move.to,
          promotion: move.promotion
        },
        evaluation: {
          userCp: normalizedEvaluation.userCp,
          mate: normalizedEvaluation.mate,
          depth: rawEvaluation.depth
        },
        evidence,
        opponentReplies: []
      };
    })
  );

  const rankedCandidates = candidates
    .sort((a, b) => scoreForRanking(b) - scoreForRanking(a))
    .slice(0, safeCandidateCount)
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1
    }));

  const rankedCandidatesWithReplies = await Promise.all(
    rankedCandidates.map(async (candidate) => {
      if (safeReplyCount <= 0) {
        return {
          ...candidate,
          opponentReplies: []
        };
      }

      const candidateGame = new Chess(fen);
      candidateGame.move({
        from: candidate.move.from,
        to: candidate.move.to,
        promotion: candidate.move.promotion
      });

      const repliesToEvaluate = selectReplySearchMoves(
        candidateGame.fen(),
        candidateGame.moves({ verbose: true })
      );

      const replies = await Promise.all(
        repliesToEvaluate.map(async (replyMove) => {
          const replyGame = new Chess(candidateGame.fen());
          const appliedReplyMove = replyGame.move({
            from: replyMove.from,
            to: replyMove.to,
            promotion: replyMove.promotion
          });
          const evidence = buildMoveEvidence({
            after: replyGame,
            move: appliedReplyMove,
            perspectiveColor: selectedPiece.color
          });

          const rawEvaluation = await evaluatePosition({
            fen: replyGame.fen(),
            moveTimeMs: replyMoveTimeMs
          });
          const normalizedEvaluation = normalizeEvaluation({
            evaluationCp: rawEvaluation.cp,
            evaluationMate: rawEvaluation.mate,
            sideToMove: replyGame.turn(),
            userColor: selectedPiece.color
          });

          return {
            rank: 0,
            move: {
              uci: toUciMove(replyMove),
              san: replyMove.san,
              piece: replyMove.piece,
              from: replyMove.from,
              to: replyMove.to,
              promotion: replyMove.promotion
            },
            evaluation: {
              userCp: normalizedEvaluation.userCp,
              mate: normalizedEvaluation.mate,
              depth: rawEvaluation.depth
            },
            evidence
          };
        })
      );

      const opponentReplies = replies
        .sort((a, b) => scoreEvaluation(a.evaluation) - scoreEvaluation(b.evaluation))
        .slice(0, safeReplyCount)
        .map((reply, index) => ({
          ...reply,
          rank: index + 1
        }));

      return {
        ...candidate,
        opponentReplies
      };
    })
  );

  return {
    selectedPiece: {
      type: selectedPiece.type,
      color: selectedPiece.color,
      square: selectedSquare
    },
    baseFen: fen,
    candidateCount: rankedCandidatesWithReplies.length,
    candidates: rankedCandidatesWithReplies
  };
}
