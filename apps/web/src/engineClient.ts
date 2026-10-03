import type { PieceSymbol } from "chess.js";
import type { Difficulty } from "./gameSettings";

export type BestMoveResponse = {
  bestMove: string;
  difficulty: Difficulty;
  moveTimeMs: number;
  skillLevel: number;
};

export type PieceAnalysisCandidate = {
  rank: number;
  move: {
    uci: string;
    san: string;
    piece?: PieceSymbol;
    from: string;
    to: string;
    promotion?: string;
  };
  evaluation: {
    userCp: number | null;
    mate: number | null;
    depth: number | null;
  };
  evidence?: MoveEvidence;
  opponentReplies: PieceAnalysisReply[];
};

export type MoveEvidence = {
  summary: string;
  facts: string[];
  capturedPiece: string | null;
  givesCheck: boolean;
  givesCheckmate: boolean;
  isPromotion: boolean;
  movedPieceAttacked: boolean;
  movedPieceDefended: boolean;
  materialDelta: number;
};

export type PieceAnalysisReply = {
  rank: number;
  move: {
    uci: string;
    san: string;
    piece?: PieceSymbol;
    from: string;
    to: string;
    promotion?: string;
  };
  evaluation: {
    userCp: number | null;
    mate: number | null;
    depth: number | null;
  };
  evidence?: MoveEvidence;
};

export type PieceAnalysisResponse = {
  selectedPiece: {
    type: string;
    color: "w" | "b";
    square: string;
  };
  baseFen: string;
  candidateCount: number;
  candidates: PieceAnalysisCandidate[];
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

export async function requestBestMove(fen: string, difficulty: Difficulty) {
  const response = await fetch(buildApiUrl("/api/engine/best-move"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fen,
      difficulty
    })
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Engine request failed.");
  }

  return (await response.json()) as BestMoveResponse;
}

export function parseUciMove(uci: string) {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);

  if (!match) {
    throw new Error(`Invalid UCI move: ${uci}`);
  }

  return {
    from: match[1],
    to: match[2],
    promotion: match[3]
  };
}

export async function requestPieceAnalysis({
  fen,
  selectedSquare,
  candidateCount = 4,
  replyCount = 3
}: {
  fen: string;
  selectedSquare: string;
  candidateCount?: number;
  replyCount?: number;
}) {
  const response = await fetch(buildApiUrl("/api/analysis/piece"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fen,
      selectedSquare,
      candidateCount,
      replyCount
    })
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Piece analysis failed.");
  }

  return (await response.json()) as PieceAnalysisResponse;
}
