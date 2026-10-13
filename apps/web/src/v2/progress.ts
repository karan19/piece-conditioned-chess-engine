import { openings, parseImportedPgn, type Opening, type Side } from "./catalog";
export type RecordState = {
  lastPly: number;
  completed: boolean;
  visits: number;
  last: number;
};
export type Progress = {
  version: 2;
  records: Record<string, RecordState>;
  saved: string[];
  custom: Opening[];
};
const key = "pcce-opening-studio-v2";
export const emptyProgress = (): Progress => ({
  version: 2,
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
    ![1, 2].includes(Number(p.version)) ||
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
        };
    } else if (
      Number.isInteger(r.lastPly) &&
      Number(r.lastPly) >= 0 &&
      Number(r.lastPly) <= 160 &&
      typeof r.completed === "boolean" &&
      Number.isFinite(r.visits) &&
      Number.isFinite(r.last)
    )
      records[id] = {
        lastPly: Number(r.lastPly),
        completed: r.completed,
        visits: Number(r.visits),
        last: Number(r.last),
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
  return {
    version: 2,
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
export function rememberStep(
  progress: Progress,
  opening: Opening,
  side: Side,
  ply: number,
  now = Date.now(),
): Progress {
  const id = recordKey(opening, side),
    old = progress.records[id];
  return {
    ...progress,
    records: {
      ...progress.records,
      [id]: {
        lastPly: ply,
        completed: Boolean(old?.completed) || ply === opening.moves.length,
        visits: (old?.visits ?? 0) + (ply === opening.moves.length ? 1 : 0),
        last: now,
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
