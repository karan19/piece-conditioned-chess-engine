import type { OpeningCourse } from "./trainerTypes";

const key = "pcce-user-courses";

export function loadUserCourses(): OpeningCourse[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as OpeningCourse[] : [];
  } catch {
    return [];
  }
}

export function saveUserCourses(courses: OpeningCourse[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(courses));
  } catch {
    /* localStorage may be unavailable; courses only live for this session */
  }
}
