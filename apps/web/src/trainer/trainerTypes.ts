export type CourseSide = "w" | "b";

export type OpeningLine = {
  id: string;
  /** Human label, e.g. "Main line Bf4 / Nf6 / e3" */
  name: string;
  /** Moves in SAN, alternating starting from side-to-move. */
  moves: string[];
  /** Short sentence the trainer shows when this line is first discovered. */
  summary: string;
};

export type OpeningCourse = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  author: string;
  side: CourseSide;
  /** Lines shown in the Learn flow before practice unlocks. */
  essentials: OpeningLine[];
  /** Full line list including essentials and extras. */
  full: OpeningLine[];
};

export type TrainerMode = "learn" | "practice";

export type LineProgress = {
  discovered: boolean;
  bestStreak: number;
  box: number;
  lastSeenAt: string | null;
};

export type CourseProgress = Record<string, LineProgress>;

export type TrainerProgress = Record<string, CourseProgress>;
