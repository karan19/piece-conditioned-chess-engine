# Opening Studio at /v2

The original app remains at `/`. The studio is a separate Vite HTML entry,
`apps/web/v2/index.html`, and uses only modules and CSS in `apps/web/src/v2`.
No existing app components, styles, API routes, or storage keys are changed.

## Features

- The complete pinned Lichess CC0 catalog: 3,865 named lines, 150 families,
  and all 500 ECO codes. It is a catalog of opening positions, not an exhaustive
  tree of every possible continuation or a collection of annotated GM courses.
- Browse/search by name, variation, ECO and PGN; first-move and gambit filters.
- Both board orientations, independent White and Black learning lists.
- Self-paced guided walkthroughs. Your moves and opponent replies are explicit
  steps; the board never advances without a click or your matching legal move.
- Every step describes what to play, why, observable board changes, and the next
  reply. Opening-specific teaching notes cover common families. Other lines use
  position-grounded explanations and general principles, not invented GM notes.
- Move timeline, previous/restart controls, resumable place, and longer matching
  variations to continue from the current position. Castling, en passant and
  selectable promotion remain supported.
- Starting a walkthrough keeps its family in My openings. It stays there after
  completion until manually removed. Catalog courses can be added again after
  removal; removing an imported course also removes its custom line.
- PGN main-line import, line export, and backup export/restore. No quizzes,
  repetition schedules, scores, timers, streaks, or accounts.
- Storage version 2 at `pcce-opening-studio-v2` migrates version 1 bookmarks,
  custom lines and completed records, discarding SRS boxes, due dates and daily
  activity. V1 app storage remains untouched.

Explanations are educational descriptions of the recorded line and verifiable
board effects. They are not engine evaluations or claims that every move is
best. The user chooses when to step forward and when to remove an opening.

## Development and validation

Run `npm run dev --workspace @pcce/web` and open `/v2/`. Run `npm test` and
`npm run build`. The build emits both `dist/index.html` and `dist/v2/index.html`.
Catalog tests validate every recorded SAN move from the standard start.

## AWS routing

Amplify app `d1y75o7adgywvp` in `us-west-2` deploys `aws-production`.
Keep the existing root SPA rewrite; add these rules **before** it:

```json
[
  { "source": "/v2/index.html", "target": "/v2/", "status": "301" },
  { "source": "/v2", "target": "/v2/index.html", "status": "200" },
  { "source": "/v2/", "target": "/v2/index.html", "status": "200" }
]
```

Course navigation uses the URL hash, so direct links and refreshes need only
these rewrites. `/v2/index.html` redirects to the canonical studio entry. Assets remain
under `/assets`; the V2 stylesheet is never loaded by the root entry.

Publish through a PR into the protected production branch. Verify the Amplify
job succeeds, `/v2` and `/v2/` return the studio HTML, all referenced assets return
200, and `/` still returns the original app. Root and V2 styles must remain
separate. The existing API requires no changes or extra load for the trainer.
