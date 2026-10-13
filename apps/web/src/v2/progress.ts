import { parseImportedPgn, type Opening, type Side } from "./catalog";
export type RecordState = {
  attempts: number;
  box: number;
  due: number;
  learned: number;
  last: number;
};
export type Progress = {
  version: 1;
  records: Record<string, RecordState>;
  saved: string[];
  custom: Opening[];
  activity: Record<string, number>;
};
const key = "pcce-opening-studio-v2";
export const emptyProgress = (): Progress => ({
  version: 1,
  records: {},
  saved: [],
  custom: [],
  activity: {},
});
export const recordKey = (opening: Opening, side: Side) =>
  `${side}|${opening.id}`;
export function loadProgress(): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!value || typeof value !== "object") return emptyProgress();
    const p = value as Partial<Progress>;
    if (
      p.version !== 1 ||
      !p.records ||
      typeof p.records !== "object" ||
      Array.isArray(p.records) ||
      !Array.isArray(p.saved) ||
      !Array.isArray(p.custom) ||
      !p.activity ||
      typeof p.activity !== "object"
    )
      return emptyProgress();
    const records: Progress["records"] = {};
    for (const [id, r] of Object.entries(p.records)) {
      if (
        r &&
        [r.attempts, r.box, r.due, r.learned, r.last].every(Number.isFinite) &&
        r.box >= 0 &&
        r.box <= 5
      )
        records[id] = r;
    }
    const custom: Opening[] = [];
    for (const o of p.custom) {
      try {
        if (o && typeof o.name === "string" && typeof o.pgn === "string")
          custom.push(parseImportedPgn(o.pgn, o.name));
      } catch {
        /* Ignore invalid saved custom lines. */
      }
    }
    const activity: Record<string, number> = {};
    for (const [day, n] of Object.entries(p.activity)) {
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        typeof n === "number" &&
        Number.isFinite(n) &&
        n >= 0
      )
        activity[day] = n;
    }
    return {
      version: 1,
      records,
      saved: p.saved.filter((s) => typeof s === "string"),
      custom,
      activity,
    };
  } catch {
    return emptyProgress();
  }
}
export function saveProgress(progress: Progress): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
export function completeLine(
  progress: Progress,
  opening: Opening,
  side: Side,
  clean: boolean,
  review: boolean,
  now = Date.now(),
): Progress {
  const id = recordKey(opening, side);
  const old = progress.records[id];
  const box = review
    ? clean
      ? Math.min((old?.box ?? 0) + 1, 5)
      : 0
    : (old?.box ?? 0);
  const intervals = [0, 1, 3, 7, 14, 30];
  const day = new Date(now).toLocaleDateString("en-CA");
  return {
    ...progress,
    records: {
      ...progress.records,
      [id]: {
        attempts: (old?.attempts ?? 0) + 1,
        box,
        due: now + intervals[box] * 86400000,
        learned: old?.learned || now,
        last: now,
      },
    },
    activity: {
      ...progress.activity,
      [day]: (progress.activity[day] ?? 0) + 1,
    },
  };
}
export function dueLines(
  progress: Progress,
  lines: Opening[],
  side: Side,
  now = Date.now(),
): Opening[] {
  return lines
    .filter((o) => {
      const r = progress.records[recordKey(o, side)];
      return r && r.due <= now;
    })
    .sort(
      (a, b) =>
        progress.records[recordKey(a, side)].due -
        progress.records[recordKey(b, side)].due,
    );
}
export function streak(progress: Progress, now = new Date()): number {
  const day = new Date(now);
  let count = 0;
  if (!progress.activity[day.toLocaleDateString("en-CA")])
    day.setDate(day.getDate() - 1);
  while (progress.activity[day.toLocaleDateString("en-CA")]) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
