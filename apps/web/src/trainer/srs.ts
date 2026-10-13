/**
 * Simple Leitner-box spaced repetition.
 * Box 1 = review soon, Box 5 = review in 20+ days.
 */

import type { LineProgress } from "./trainerTypes";

const intervalMsByBox: Record<number, number> = {
  1: 1 * 24 * 60 * 60 * 1000,       // 1 day
  2: 3 * 24 * 60 * 60 * 1000,       // 3 days
  3: 7 * 24 * 60 * 60 * 1000,       // 1 week
  4: 14 * 24 * 60 * 60 * 1000,      // 2 weeks
  5: 30 * 24 * 60 * 60 * 1000       // 1 month
};

export const maxBox = 5;

export function makeEmptyLineProgress(): LineProgress {
  return { discovered: false, bestStreak: 0, box: 1, lastSeenAt: null };
}

export function isDueToday(progress: LineProgress, now = Date.now()) {
  if (!progress.discovered) return false;
  if (!progress.lastSeenAt) return true;
  const interval = intervalMsByBox[progress.box] ?? intervalMsByBox[1];
  return now - new Date(progress.lastSeenAt).getTime() >= interval;
}

/** Correct: raise the box. Wrong: drop to box 1. */
export function applySrsResult(progress: LineProgress, correct: boolean, now = Date.now()): LineProgress {
  const box = correct ? Math.min(maxBox, progress.box + 1) : 1;
  return {
    ...progress,
    discovered: true,
    bestStreak: correct ? progress.bestStreak + 1 : 0,
    box,
    lastSeenAt: new Date(now).toISOString()
  };
}
