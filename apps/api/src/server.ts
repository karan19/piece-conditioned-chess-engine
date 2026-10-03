import cors from "cors";
import express from "express";
import type { Square } from "chess.js";
import { isDifficulty } from "./difficulty.js";
import { getHealthStatus } from "./health.js";
import { analyzeSelectedPiece } from "./pieceAnalysis.js";
import { getBestMove } from "./stockfishEngine.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    }
  })
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json(getHealthStatus());
});

app.post("/engine/best-move", async (request, response) => {
  const { fen, difficulty } = request.body as {
    fen?: unknown;
    difficulty?: unknown;
  };

  if (typeof fen !== "string" || !isDifficulty(difficulty)) {
    response.status(400).json({
      error: "Expected body with fen string and difficulty."
    });
    return;
  }

  try {
    response.json(await getBestMove({ fen, difficulty }));
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Engine failed."
    });
  }
});

app.post("/analysis/piece", async (request, response) => {
  const { fen, selectedSquare, candidateCount, replyCount } = request.body as {
    fen?: unknown;
    selectedSquare?: unknown;
    candidateCount?: unknown;
    replyCount?: unknown;
  };

  if (
    typeof fen !== "string" ||
    typeof selectedSquare !== "string" ||
    !/^[a-h][1-8]$/.test(selectedSquare)
  ) {
    response.status(400).json({
      error: "Expected body with fen string and selectedSquare."
    });
    return;
  }

  try {
    response.json(
      await analyzeSelectedPiece({
        fen,
        selectedSquare: selectedSquare as Square,
        candidateCount: typeof candidateCount === "number" ? candidateCount : undefined,
        replyCount: typeof replyCount === "number" ? replyCount : undefined
      })
    );
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Piece analysis failed."
    });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
