# Piece-Conditioned Chess Engine - Milestones

Each milestone should end with a working checkpoint that can be manually tested before moving on.

## Milestone 0 - Project Foundation

### Goal

Create the application skeleton and confirm the local development workflow.

### Build

- Set up frontend application.
- Set up local backend if selected.
- Add formatting, linting, and test commands.
- Add basic app shell with navigation placeholders.
- Document how to run the app locally.

### Test Checkpoint

- App starts locally.
- Home screen renders.
- Test command runs.
- Repository structure is understandable.

### Stop And Review

Confirm the stack feels right before implementing chess behavior.

## Milestone 1 - Basic Chess Game

### Goal

Create a playable local chess game without engine opponent yet.

### Build

- Render chessboard.
- Allow legal moves only.
- Show current turn.
- Show move history.
- Detect check, checkmate, and stalemate.
- Support castling, en passant, and promotion.

### Test Checkpoint

- User can play both sides manually.
- Illegal moves are rejected.
- Move history is correct.
- Game status updates correctly.
- Promotion UI works.

### Stop And Review

Confirm the board interaction and chess rules feel solid.

## Milestone 2 - Computer Opponent And Difficulty

### Goal

Let the user play against Stockfish at selectable difficulty levels.

### Build

- New game setup: color and difficulty.
- Stockfish move generation for computer turns.
- Difficulty mapping for Easy, Medium, Hard, Expert.
- Computer move loading state.
- Game result handling after engine moves.

### Test Checkpoint

- User can start as White or Black.
- Computer responds after user moves.
- Difficulty levels change engine behavior.
- Game can reach checkmate/stalemate without breaking.
- Move history includes both sides.

### Stop And Review

Confirm this already works as a normal chess game.

## Milestone 3 - Local Persistence

### Goal

Save and reopen games locally.

### Build

- Local game storage.
- Previous games screen.
- Save moves, FEN, result, difficulty, color, timestamps.
- Reopen active or completed games.

### Test Checkpoint

- Refreshing the app does not lose active game data.
- Previous games list shows saved games.
- Reopened games restore board and move history.
- Completed game appears with result and move count.

### Stop And Review

Confirm storage model before adding learning events.

## Milestone 4 - Call Engine Eligibility And Piece Selection

### Goal

Add the user-facing entry point for piece-conditioned analysis, without deep analysis yet.

### Build

- Track ply count.
- Unlock Call Engine only after both sides complete three moves.
- Allow selecting user's pieces only on user's turn.
- Show selected piece panel.
- Enforce one successful Call Engine call per user turn.
- Handle selected piece with zero legal moves.

### Test Checkpoint

- Call Engine is locked before ply 6.
- Call Engine appears only on user's turn.
- Opponent pieces cannot be analyzed.
- A piece with no legal moves shows a clear message.
- The per-turn call allowance resets after the computer moves.

### Stop And Review

Confirm product rules are understandable before wiring expensive analysis.

## Milestone 5 - Candidate Move Analysis

### Goal

Return up to four ranked moves for the selected piece.

### Build

- Enumerate legal moves from selected square.
- Evaluate each candidate move with strong Stockfish settings.
- Normalize engine scores from user's perspective.
- Rank candidate moves.
- Show analysis progress and timeout/failure states.
- Do not consume Call Engine allowance on failure or cancellation.

### Test Checkpoint

- Selected piece with fewer than four moves returns all legal moves.
- Selected piece with many moves returns top four.
- Rankings are from user's perspective for both White and Black.
- Analysis can be cancelled or retried.
- Live game state is unchanged after analysis.

### Stop And Review

Compare candidate rankings against expected Stockfish behavior in a few known positions.

## Milestone 6 - Opponent Replies

### Goal

For each candidate, show the opponent's strongest replies.

### Build

- Apply candidate move on a cloned board.
- Run opponent MultiPV analysis.
- Return top three replies.
- Store reply evaluations from user's perspective.
- Display replies under each candidate.

### Test Checkpoint

- Each candidate shows up to three legal opponent replies.
- Replies are legal in the candidate position.
- Strongest reply ordering makes sense.
- Candidate and reply evaluations use consistent sign conventions.

### Stop And Review

Confirm the app now answers the core engine question.

## Milestone 7 - Evidence And Template Explanations

### Goal

Explain candidate moves using deterministic evidence.

### Build

- Board diff engine for original-to-candidate.
- Board diff engine for candidate-to-reply.
- Detect basic evidence:
  - captures;
  - checks;
  - material change;
  - newly attacked pieces;
  - lost defended pieces;
  - moved piece attacked/protected status;
  - engine rank and evaluation.
- Generate explanation sections from templates.

### Test Checkpoint

- Explanations contain only facts present in evidence.
- Captures, checks, and material changes are described correctly.
- Lost defenses and new attacks are plausible in test positions.
- No speculative strategic language appears.

### Stop And Review

Read explanations like a chess learner and decide whether the plainness is acceptable.

## Milestone 8 - Preview Mode

### Goal

Let the user manually visualize candidate and reply lines without changing the real game.

### Build

- Separate live board state from preview board state.
- Candidate click enters preview user move state.
- Reply click enters preview opponent reply state.
- Board is read-only in preview.
- Persistent preview banner.
- Back to Game restores live board.
- Explanation panel stays synchronized with preview state.

### Test Checkpoint

- Previewing a move never changes real move history.
- Back to Game restores the exact live position.
- User cannot drag pieces in preview mode.
- Candidate and reply explanations match the board shown.
- User can still make any legal move after returning to game.

### Stop And Review

This is the core learning interaction. Test it slowly and deliberately.

## Milestone 9 - Learning Event Persistence

### Goal

Store every successful Call Engine invocation as a reviewable learning event.

### Build

- Persist base FEN, selected piece, candidates, replies, evaluations, evidence, explanations, engine settings, timestamp.
- Track which candidates and replies the user previewed.
- Save the actual move eventually played by the user.
- Add learning event count to previous games.

### Test Checkpoint

- Successful analysis creates a learning event.
- Cancelled or failed analysis does not create one.
- Preview interactions are tracked.
- Actual played move is linked to the event even if it is a different piece.
- Previous games show Call Engine use count.

### Stop And Review

Confirm stored data is sufficient for later research and richer review.

## Milestone 10 - Basic Post-Game Review

### Goal

Let users revisit their learning moments after a game.

### Build

- Game review screen.
- Move timeline.
- Learning event markers.
- Learning event details view.
- Show engine's piece-conditioned recommendation versus actual move played.

### Test Checkpoint

- Completed games open in review mode.
- Learning events appear at the correct move.
- Event details match what was shown during the game.
- Divergence from recommendation is not framed as automatically wrong.

### Stop And Review

Confirm V1 has a full loop: play, analyze, preview, decide, review.

## Milestone 11 - V1 Hardening

### Goal

Polish reliability, error handling, and test coverage for a usable V1.

### Build

- Add focused automated tests for chess state, analysis state, preview state, and persistence.
- Improve engine crash and timeout recovery.
- Add stale-analysis detection.
- Clean up UI loading states.
- Audit explanation templates for unsupported claims.
- Add export/debug view for learning-event data if useful.

### Test Checkpoint

- Fresh install works.
- Existing saved games survive app restart.
- Engine failures do not corrupt games.
- Preview cannot mutate live game.
- V1 scope checklist passes.

### Stop And Review

Decide whether to ship V1, add polish, or begin V2 planning.

## Suggested V2 Candidates

- LLM wording layer constrained by evidence.
- More tactical motif detectors.
- Richer post-game review.
- Research dashboard.
- Deeper visible variation previews.
- Cloud sync or accounts.
- Opening book and tablebases.
- More nuanced Stockfish difficulty personalities.
