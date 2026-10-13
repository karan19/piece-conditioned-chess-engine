# V2 - Opening Trainer

ChessReps-inspired opening trainer built on top of the existing V1 chess engine.

## Product Goal

Let a user pick a popular opening, then train it line by line. The trainer
plays the opponent automatically from real public-theory move sequences. The
user plays their own side's moves and receives feedback, hints, and spaced
repetition so lines stick over time.

## Core Loop

```text
Choose course
-> Learn a new line (guided, auto-reply)
-> Play each own move correctly
-> Wrong move: hint + "Expected: <SAN>"; line resets on that ply
-> Line complete: moves to the next undiscovered line
-> After 1+ line: Practice mode available
-> Practice: review due lines, no feedback until move commit; streak tracks
-> SRS box rises on correct, resets on incorrect
```

## Data Model

`OpeningCourse` → `OpeningLine[]` → SAN move list + short summary.

Courses supported in V2:

- London System (White)
- Sicilian Defense (Black)
- Italian Game (White)
- French Defense (Black)
- Caro-Kann Defense (Black)

Each course has Essentials and Full Mastery line lists. Full Mastery includes
Essentials plus deeper lines.

## Spaced Repetition

Leitner boxes 1-5. Correct raises the box; incorrect resets to 1. Review
interval:

- Box 1: 1 day
- Box 2: 3 days
- Box 3: 1 week
- Box 4: 2 weeks
- Box 5: 1 month

Progress is stored in `localStorage` under `pcce-trainer-progress`.

## V2 Included

- 5 opening courses with pre-validated SAN lines
- Learn mode with auto-reply, short commentary, and hint on wrong move
- Practice mode with SRS due filter, streak, and box badge
- Per-course discovery count (X/Y)
- Essentials vs Full Mastery line list toggle
- Skip line + Restart line controls
- Castling, en passant, and promotion handled by chess.js
- Progress persisted locally in the browser

## Explicitly Not V2

- No live server for course authoring
- No community course upload
- No LLM commentary
- No cloud sync
- No account system
- No leaderboards
- No analytics
