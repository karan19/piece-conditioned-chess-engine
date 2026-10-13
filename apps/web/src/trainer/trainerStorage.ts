import type { TrainerProgress } from "./trainerTypes";

const storageKey = "pcce-trainer-progress";

export function loadTrainerProgress(): TrainerProgress {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as TrainerProgress;
  } catch {
    return {};
  }
}

export function saveTrainerProgress(progress: TrainerProgress) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // Local storage may be unavailable; trainer still works in-session.
  }
}
