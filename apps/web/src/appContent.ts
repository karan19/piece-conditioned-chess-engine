export type HomeAction = {
  id: "start-game" | "previous-games";
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
    id: "previous-games",
    label: "Learning Journal",
    description: "Reopen saved games, replay engine moments, and inspect what you previewed."
  }
];

export const productHighlights = [
  "Piece-conditioned Stockfish analysis",
  "Candidate and reply previews without changing the live game",
  "Local learning journal with exportable analysis snapshots",
  "No account required; saved in this browser"
];
