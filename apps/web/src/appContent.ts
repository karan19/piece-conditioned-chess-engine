export type HomeAction = {
  id: "start-game" | "previous-games" | "opening-trainer";
  label: string;
  description: string;
};

export const homeActions: HomeAction[] = [
  {
    id: "start-game",
    label: "Start Game",
    description: "Play against Stockfish and ask for piece-specific guidance during critical turns."
  },
  {
    id: "opening-trainer",
    label: "Opening Trainer",
    description: "Learn openings step by step with spaced repetition, hint-driven commentary, and local progress."
  },
  {
    id: "previous-games",
    label: "Learning Journal",
    description: "Reopen saved games, replay engine moments, and inspect what you previewed."
  }
];

export const productHighlights = [
  "Piece-conditioned Stockfish analysis",
  "Opening trainer with spaced repetition and hint system",
  "Candidate and reply previews without changing the live game",
  "Local learning journal with exportable analysis snapshots",
  "No account required; saved in this browser"
];
