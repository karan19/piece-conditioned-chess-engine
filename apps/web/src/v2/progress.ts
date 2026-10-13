import { replayGame, gameResult } from "./fullGame";
import { openings, parseImportedPgn, type Opening, type Side } from "./catalog";
export type RecordState = {
  lastPly: number;
  completed: boolean;
  visits: number;
  last: number;
  continuation: string[];
  result: string | null;
  bookMoves?: string[];
  bookComplete?: boolean;
};
export type Progress = {
  version: 3;
  records: Record<string, RecordState>;
  saved: string[];
  custom: Opening[];
};
const key = "pcce-opening-studio-v2";
export const emptyProgress = (): Progress => ({
  version: 3,
  records: {},
  saved: [],
  custom: [],
});
export const recordKey = (opening: Opening, side: Side) =>
  `${side}|${opening.id}`;
export function decodeProgress(value: unknown): Progress {
  if (!value || typeof value !== "object")
    throw new Error("Choose an Opening Studio backup.");
  const p = value as Record<string, unknown>;
  if (
    ![1, 2, 3].includes(Number(p.version)) ||
    !p.records ||
    typeof p.records !== "object" ||
    Array.isArray(p.records) ||
    !Array.isArray(p.saved) ||
    !Array.isArray(p.custom)
  )
    throw new Error("This backup has an unsupported format.");
  const records: Progress["records"] = {};
  for (const [id, value] of Object.entries(p.records)) {
    const r = value as Record<string, unknown>;
    if (!r || typeof r !== "object") continue;
    if (p.version === 1) {
      if (Number.isFinite(r.last) && Number.isFinite(r.attempts))
        records[id] = {
          lastPly: 0,
          completed: Boolean(r.learned),
          visits: Number(r.attempts),
          last: Number(r.last),
          continuation: [],
          result: null,
        };
    } else if (
      Number.isInteger(r.lastPly) &&
      Number(r.lastPly) >= 0 &&
      Number(r.lastPly) <= 10000 &&
      typeof r.completed === "boolean" &&
      Number.isFinite(r.visits) &&
      Number.isFinite(r.last)
    )
      records[id] = {
        lastPly: Number(r.lastPly),
        completed: r.completed,
        visits: Number(r.visits),
        last: Number(r.last),
        continuation:
          Array.isArray(r.continuation) &&
          r.continuation.length <= 10000 &&
          r.continuation.every((m) => typeof m === "string")
            ? (r.continuation as string[])
            : [],
        result: null,
        ...(Array.isArray(r.bookMoves) && r.bookMoves.length > 0 && r.bookMoves.length <= 1000 && r.bookMoves.every(m => typeof m === "string")
          ? { bookMoves: r.bookMoves as string[], bookComplete: r.bookComplete === true }
          : {}),
      };
  }
  const custom: Opening[] = [];
  for (const value of p.custom) {
    try {
      const o = value as Opening;
      if (typeof o.name === "string" && typeof o.pgn === "string")
        custom.push(parseImportedPgn(o.pgn, o.name));
    } catch {
      /* Ignore damaged imported lines. */
    }
  }
  const known = [...openings, ...custom];
  for (const [id, record] of Object.entries(records)) {
    const opening = known.find((o) => id.slice(2) === o.id);
    if (!opening) continue;
    try {
      if (record.bookMoves) replayGame({ ...opening, moves: record.bookMoves });
    } catch {
      delete record.bookMoves;
      delete record.bookComplete;
      record.continuation = [];
    }
    const effective = savedOpening(opening, record);
    try {
      replayGame(effective, record.continuation);
      record.lastPly = Math.min(
        record.lastPly,
        effective.moves.length + record.continuation.length,
      );
      record.result =
        gameResult(replayGame(effective, record.continuation, record.lastPly))
          ?.title ?? null;
    } catch {
      record.continuation = [];
      record.lastPly = Math.min(record.lastPly, effective.moves.length);
    }
  }
  return {
    version: 3,
    records,
    saved: Array.from(
      new Set([
        ...p.saved.filter((s): s is string => typeof s === "string"),
        ...(p.version === 1
          ? Object.keys(records).flatMap((id) => {
              const side = id.startsWith("b|") ? "b" : "w";
              const opening = [...openings, ...custom].find(
                (o) => recordKey(o, side) === id,
              );
              return opening ? [`${side}:${opening.family}`] : [];
            })
          : []),
      ]),
    ),
    custom,
  };
}
export function loadProgress(): Progress {
  try {
    return decodeProgress(JSON.parse(localStorage.getItem(key) ?? "null"));
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function savedOpening(opening: Opening, record?: RecordState): Opening {
  return record?.bookMoves ? { ...opening, moves: record.bookMoves } : opening;
}
export function rememberStep(
  progress: Progress,
  opening: Opening,
  side: Side,
  ply: number,
  now = Date.now(),
  continuation?: string[],
  learning?: { bookMoves: string[]; bookComplete: boolean },
): Progress {
  const id = recordKey(opening, side),
    old = progress.records[id];
  const savedMoves = continuation ?? old?.continuation ?? [];
  const effective = learning ? { ...opening, moves: learning.bookMoves } : savedOpening(opening, old);
  const game = replayGame(effective, savedMoves, ply);
  return {
    ...progress,
    records: {
      ...progress.records,
      [id]: {
        lastPly: ply,
        completed: Boolean(old?.completed) || ply === effective.moves.length,
        visits: (old?.visits ?? 0) + (ply === effective.moves.length ? 1 : 0),
        last: now,
        continuation: savedMoves,
        result: gameResult(game)?.title ?? null,
        ...(learning ?? (old?.bookMoves ? { bookMoves: old.bookMoves, bookComplete: old.bookComplete } : {})),
      },
    },
  };
}
export function removeFromLearning(
  progress: Progress,
  name: string,
  lines: Opening[],
  side: Side,
  custom = false,
): Progress {
  const keys = new Set(
    lines.flatMap((o) =>
      custom ? [recordKey(o, "w"), recordKey(o, "b")] : [recordKey(o, side)],
    ),
  );
  return {
    ...progress,
    saved: progress.saved.filter(
      (s) => s !== `${side}:${name}` && !(custom && s.endsWith(`:${name}`)),
    ),
    records: Object.fromEntries(
      Object.entries(progress.records).filter(([id]) => !keys.has(id)),
    ),
    custom: custom
      ? progress.custom.filter((o) => !lines.some((l) => l.id === o.id))
      : progress.custom,
  };
}
