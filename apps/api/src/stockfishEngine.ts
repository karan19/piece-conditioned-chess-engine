import { createRequire } from "node:module";
import { difficultyConfigs, type Difficulty } from "./difficulty.js";

type StockfishEngine = {
  listener?: (line: string) => void;
  sendCommand(command: string): void;
};

type InitStockfish = (enginePath?: string) => Promise<StockfishEngine>;

export type BestMoveRequest = {
  fen: string;
  difficulty: Difficulty;
};

export type BestMoveResult = {
  bestMove: string;
  difficulty: Difficulty;
  moveTimeMs: number;
  skillLevel: number;
};

export type EvaluationResult = {
  cp: number | null;
  mate: number | null;
  depth: number | null;
  bestMove: string;
};

const require = createRequire(import.meta.url);
const initStockfish = require("stockfish") as InitStockfish;

let enginePromise: Promise<StockfishEngine> | null = null;
let engineChain = Promise.resolve();

async function getEngine() {
  if (!enginePromise) {
    enginePromise = initStockfish("lite-single").then(async (engine) => {
      const lines: string[] = [];

      engine.listener = (line: string) => {
        lines.push(line);
      };

      function waitForLine(predicate: (line: string) => boolean, timeoutMs: number) {
        return new Promise<string>((resolve, reject) => {
          const startedAt = Date.now();

          function check() {
            const match = lines.find(predicate);

            if (match) {
              resolve(match);
              return;
            }

            if (Date.now() - startedAt > timeoutMs) {
              reject(new Error("Timed out waiting for Stockfish."));
              return;
            }

            setTimeout(check, 10);
          }

          check();
        });
      }

      engine.sendCommand("uci");
      await waitForLine((line) => line === "uciok", 5000);
      engine.sendCommand("isready");
      await waitForLine((line) => line === "readyok", 5000);
      return engine;
    });
  }

  return enginePromise;
}

function runExclusive<T>(task: () => Promise<T>) {
  const result = engineChain.then(task, task);
  engineChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function createLineWaiter(
  engine: StockfishEngine,
  predicate: (line: string) => boolean,
  timeoutMs: number
) {
  return new Promise<string>((resolve, reject) => {
    const previousListener = engine.listener;
    const startedAt = Date.now();
    let finished = false;

    const timeout = setInterval(() => {
      if (finished) {
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        finished = true;
        clearInterval(timeout);
        engine.listener = previousListener;
        reject(new Error("Timed out waiting for Stockfish."));
      }
    }, 25);

    engine.listener = (line: string) => {
      previousListener?.(line);

      if (finished || !predicate(line)) {
        return;
      }

      finished = true;
      clearInterval(timeout);
      engine.listener = previousListener;
      resolve(line);
    };
  });
}

function parseBestMove(line: string) {
  const match = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);

  if (!match) {
    throw new Error(`Could not parse Stockfish best move from: ${line}`);
  }

  return match[1];
}

function parseEvaluation(lines: string[], bestMoveLine: string): EvaluationResult {
  const scoredLines = lines.filter((line) => line.startsWith("info ") && line.includes(" score "));
  const latestScoreLine = scoredLines.at(-1);
  const cpMatch = latestScoreLine?.match(/\bscore cp (-?\d+)/);
  const mateMatch = latestScoreLine?.match(/\bscore mate (-?\d+)/);
  const depthMatch = latestScoreLine?.match(/\bdepth (\d+)/);

  return {
    cp: cpMatch ? Number(cpMatch[1]) : null,
    mate: mateMatch ? Number(mateMatch[1]) : null,
    depth: depthMatch ? Number(depthMatch[1]) : null,
    bestMove: parseBestMove(bestMoveLine)
  };
}

export async function getBestMove({
  fen,
  difficulty
}: BestMoveRequest): Promise<BestMoveResult> {
  return runExclusive(async () => {
    const engine = await getEngine();
    const config = difficultyConfigs[difficulty];

    engine.sendCommand("ucinewgame");
    engine.sendCommand(`setoption name Skill Level value ${config.skillLevel}`);
    const readyLine = createLineWaiter(engine, (line) => line === "readyok", 5000);
    engine.sendCommand("isready");
    await readyLine;

    engine.sendCommand(`position fen ${fen}`);
    const bestMoveLine = createLineWaiter(
      engine,
      (line) => line.startsWith("bestmove "),
      config.moveTimeMs + 5000
    );
    engine.sendCommand(`go movetime ${config.moveTimeMs}`);

    return {
      bestMove: parseBestMove(await bestMoveLine),
      difficulty,
      moveTimeMs: config.moveTimeMs,
      skillLevel: config.skillLevel
    };
  });
}

export async function evaluatePosition({
  fen,
  moveTimeMs
}: {
  fen: string;
  moveTimeMs: number;
}): Promise<EvaluationResult> {
  return runExclusive(async () => {
    const engine = await getEngine();
    const searchLines: string[] = [];

    engine.sendCommand("ucinewgame");
    engine.sendCommand("setoption name Skill Level value 20");
    const readyLine = createLineWaiter(engine, (line) => line === "readyok", 5000);
    engine.sendCommand("isready");
    await readyLine;

    engine.sendCommand(`position fen ${fen}`);

    const previousListener = engine.listener;
    engine.listener = (line: string) => {
      previousListener?.(line);
      searchLines.push(line);
    };

    try {
      const bestMoveLine = createLineWaiter(
        engine,
        (line) => line.startsWith("bestmove "),
        moveTimeMs + 5000
      );
      engine.sendCommand(`go movetime ${moveTimeMs}`);
      return parseEvaluation(searchLines, await bestMoveLine);
    } finally {
      engine.listener = previousListener;
    }
  });
}
