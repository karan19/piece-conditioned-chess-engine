import type { Color } from "chess.js";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type GameSettings = {
  playerColor: Color;
  difficulty: Difficulty;
};

export const difficultyOptions: { id: Difficulty; label: string; description: string }[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Fast, shallow Stockfish play for a forgiving game."
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced timing and skill for casual practice."
  },
  {
    id: "hard",
    label: "Hard",
    description: "More search time and stronger tactical awareness."
  },
  {
    id: "expert",
    label: "Expert",
    description: "Highest play strength in the normal game mode."
  }
];

export const defaultGameSettings: GameSettings = {
  playerColor: "w",
  difficulty: "medium"
};

export function getColorName(color: Color) {
  return color === "w" ? "White" : "Black";
}

export function getOpponentColor(color: Color): Color {
  return color === "w" ? "b" : "w";
}
