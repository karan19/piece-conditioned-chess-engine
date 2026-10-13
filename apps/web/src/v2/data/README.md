# Opening catalog

All five ECO TSV files from https://github.com/lichess-org/chess-openings,
pinned to revision `a6189a30dc273ccb21fc2536a9a2fefd5592a67a`.

- 3,865 named lines; all 500 ECO codes (A00–E99).
- Names and move sequences are distributed under CC0; see COPYING.txt.
- Families are grouped using the portion of the name before a colon. Some
  systems appear under multiple opening families or move orders.
- These are lines reaching named opening positions, not exhaustive game trees,
  engine recommendations, or annotated proprietary courses.
- Every line is replayed and validated by the catalog test before release.

To update: fetch the five TSV files and COPYING.txt from one pinned upstream
revision, update catalog.ts and the counts in metadata/tests, then run the
catalog tests. Keep the raw data bundled so training requires no third-party
API or network requests after the page assets have loaded.
