# Board Recall

The third feature lives at `/board-recall/`, with individual rounds at `/board-recall/challenge/{position-id}/?level=beginner&seconds=2&side=white&round={round-id}`. It is linked from the homepage, Guided Play, and Opening Studio.

Choose a difficulty (3–6, 7–12, or 13+ pieces), viewing time (2, 5, 10, 20, or 30 seconds), and White or Black perspective. Each round starts behind a curtain. Reveal the board, then rebuild the position using the twelve-piece tray and eraser. Placements are unrestricted; this is reconstruction rather than legal-move play. Arrow keys move focus around the reconstruction board. Undo and clear are available.

A result counts exact piece/color/square matches. The percentage is correct matches divided by the larger of the target piece count and placed piece count, so extra pieces cannot improve the score. Correct, incorrect, and missing squares are marked on the attempt. The original board and a textual difference list appear after submission.

Peeking gives a three-second look and marks the round as assisted. Repeating an already-seen position is also assisted practice. The next-position action avoids the immediately previous position.

Round state and an absolute viewing deadline are saved in sessionStorage. Refreshing never grants a fresh timer. Leaving the tab during the timed look hides the position. Preferences and the last 50 results use `pcce.board-recall.v1` in localStorage. Storage failures leave the round playable and show a notice. No spaced-repetition schedule, account, backend change, or engine request is added.

Positions are deduplicated snapshots from the existing opening catalog and endgame library. Existing source attribution and provenance remain in `apps/web/src/v2/data/`. Core tests verify legal positions and difficulty bands, scoring, settings validation, deadline restoration, assisted state, and local storage behavior.

The classic board CSS is shared with Opening Studio through `apps/web/src/v2/board.css`; Guided Play’s rendering is unchanged. Nested-route hosting rules are recorded in `scripts/amplify-feature-routes.json`.
