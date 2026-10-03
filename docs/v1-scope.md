# Piece-Conditioned Chess Engine - V1 Scope

## Product Goal

Build a local-first chess learning application where a user can play a normal game against a configurable computer opponent, then deliberately ask for high-quality analysis of one selected piece on their turn.

The central V1 experience is:

```text
User-selected piece
-> up to four ranked candidate moves
-> top opponent replies
-> grounded explanation
-> manually controlled preview
-> back to live game
-> user makes their own move
```

## Locked Product Decisions

### Faithful Explanations

V1 explanations must be grounded in computed evidence. The app should prefer plain, provable statements over rich but speculative chess commentary.

Allowed V1 explanation facts include:

- legal move from the selected piece;
- capture;
- check or checkmate;
- material change;
- newly attacked pieces;
- pieces or squares no longer defended by the moved piece;
- whether the moved piece becomes attacked;
- Stockfish rank among moves by the selected piece;
- Stockfish evaluation from the user's perspective;
- opponent's strongest replies according to Stockfish.

V1 should avoid unsupported claims such as long-term strategic pressure, vague king-safety judgments, pins, skewers, discovered attacks, and mating threats unless explicit deterministic detectors support them.

### Stockfish Integration

V1 answers:

```text
Among legal moves by this selected piece, which are best?
```

It does not answer:

```text
What is the best move on the whole board?
```

Initial implementation should evaluate each legal selected-piece move separately, rank candidates from the user's perspective, then run opponent reply analysis for the top candidates.

### Analysis Quality

Call Engine is quality-first. It may take longer than ordinary gameplay.

Expected V1 timing:

- normal opponent move: quick, based on selected difficulty;
- Call Engine analysis: up to about 30 seconds is acceptable;
- hard timeout: about 45-60 seconds.

The UI should show deliberate progress stages instead of treating analysis as an instant tooltip.

### Preview State

Preview mode is a separate read-only hypothetical state.

The live game state is canonical. Preview mode must never mutate:

- live FEN;
- real move history;
- current turn;
- game result.

Preview mode is entered by selecting candidate and reply buttons from the analysis panel, not by dragging pieces on the board.

### Persistence

V1 is local-first. No accounts, cloud sync, or online multiplayer.

Persist:

- games;
- moves;
- learning events;
- analysis candidates;
- opponent replies;
- preview interactions.

Each successful Call Engine invocation should store a full analysis snapshot so old games remain reviewable even if engine settings change later.

### Language Model Usage

No LLM in V1.

V1 explanations should be generated from:

```text
Stockfish output
+ chess rules engine
+ deterministic evidence analysis
+ explanation templates
```

An LLM may be considered later as a constrained wording layer after the evidence system is reliable.

### Chess Edge Cases

Use a proper chess rules library for legality.

V1 must correctly handle:

- legal moves only;
- user in check;
- checkmate;
- stalemate;
- selected piece with zero legal moves;
- selected piece with fewer than four legal moves;
- castling legality;
- en passant legality;
- promotion selector with queen default;
- engine timeout or failure;
- analysis cancellation;
- user analyzing one piece and moving another;
- preview exit returning to the live game.

Advanced draw UX, tablebases, opening books, and rich tactical motif labeling can come later.

## V1 Included Features

### Start Screen

- Start new game.
- Open previous games.

### New Game

- Choose player color: White or Black.
- Choose opponent difficulty: Easy, Medium, Hard, Expert.

### Game Screen

- Interactive chessboard.
- Legal user moves.
- Computer opponent powered by Stockfish.
- Move history.
- Game status display.
- Local persistence.

### Call Engine

- Unlocks after both sides complete three moves.
- Available only on user's turn.
- Works only on user's pieces.
- One successful Call Engine invocation per user turn.
- Analyzes only legal moves from the selected piece.
- Returns up to four ranked candidates.
- Returns top three opponent replies per candidate.
- Shows engine evaluation from user's perspective.
- Shows deterministic explanation templates.
- Does not commit a move.

### Preview

- Candidate button previews the user's hypothetical move.
- Opponent reply button previews the second ply.
- Board is read-only in preview mode.
- Persistent preview banner:

```text
PREVIEW - NOT PART OF GAME
```

- Back to Game restores the live board.

### Previous Games And Review

- List previous games.
- Show date, color, difficulty, result, move count, and Call Engine use count.
- Reopen a saved game.
- Show basic learning-event timeline.

## Explicitly Not V1

- No LLM explanations.
- No accounts.
- No cloud sync.
- No human-vs-human online play.
- No opening book.
- No endgame tablebases.
- No advanced research dashboard.
- No full multi-ply variation tree UI.
- No exhaustive tactical motif engine.
- No claim that Stockfish analysis is mathematically final.
