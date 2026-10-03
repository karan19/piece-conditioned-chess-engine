export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type DifficultyConfig = {
  label: string;
  skillLevel: number;
  moveTimeMs: number;
};

export const difficultyConfigs: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    skillLevel: 2,
    moveTimeMs: 200
  },
  medium: {
    label: "Medium",
    skillLevel: 8,
    moveTimeMs: 600
  },
  hard: {
    label: "Hard",
    skillLevel: 14,
    moveTimeMs: 1200
  },
  expert: {
    label: "Expert",
    skillLevel: 20,
    moveTimeMs: 2500
  }
};

export function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(difficultyConfigs, value)
  );
}
