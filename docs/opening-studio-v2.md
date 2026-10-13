# Opening Studio at /v2

The original app remains at `/`. The studio is a separate Vite HTML entry,
`apps/web/v2/index.html`, and uses only modules and CSS in `apps/web/src/v2`.
No existing app components, styles, API routes, or storage keys are changed.

## Features

- The complete pinned Lichess CC0 catalog: 3,865 named lines, 150 families,
  and all 500 ECO codes. It is a catalog of opening positions, not an exhaustive
  tree of every possible continuation or a collection of annotated GM courses.
- Browse/search by name, variation, ECO and PGN; first-move and gambit filters.
- Both board orientations, independent White and Black progress/repertoires.
- Guided learning, due-only spaced review, randomized drill, 60-second recall.
- Correct-line checking with legal-move validation, automatic opponent replies,
  hints, move sounds, castling, en passant and selectable promotion.
- Family sessions contain up to ten lines. Learn prefers undiscovered lines,
  so future sessions advance through the whole course. Single-ply positions
  are previewable from both sides but have no Black move to recall.
- PGN main-line import, selected-line PGN export, bookmark courses, and backup
  export/restore. Accounts, payments and cloud sync are not included.
- Versioned local browser storage `pcce-opening-studio-v2`; unrelated V1 storage
  is untouched. Backups merge imported records into existing progress.

Guided completion marks a line learned and immediately due. An unassisted,
error-free recall advances to boxes 1–5 (1, 3, 7, 14, 30 days). Hints or errors
reset review to box 0, due now. Incomplete/skipped/expired lines earn no progress.

## Development and validation

Run `npm run dev --workspace @pcce/web` and open `/v2/`. Run `npm test` and
`npm run build`. The build emits both `dist/index.html` and `dist/v2/index.html`.
Catalog tests validate every recorded SAN move from the standard start.

## AWS routing

Amplify app `d1y75o7adgywvp` in `us-west-2` deploys `aws-production`.
Keep the existing root SPA rewrite; add these two rules **before** it:

```json
[
  { "source": "/v2", "target": "/v2/index.html", "status": "200" },
  { "source": "/v2/", "target": "/v2/index.html", "status": "200" }
]
```

Course navigation uses the URL hash, so direct links and refreshes need only
these two rules. `/v2/index.html` is also a usable direct entry. Assets remain
under `/assets`; the V2 stylesheet is never loaded by the root entry.

Publish through a PR into the protected production branch. Verify the Amplify
job succeeds, `/v2` and `/v2/` return the studio HTML, all referenced assets return
200, and `/` still returns the original app. Root and V2 styles must remain
separate. The existing API requires no changes or extra load for the trainer.
