# Endgame Practice starter library

`endgames.json` includes 150 Lichess puzzles (ten for each of five material
categories and three difficulty bands) and five authored technical draw exercises.

## Puzzle source

- Source: https://database.lichess.org/lichess_db_puzzle.csv.zst
- Export last updated: October 5, 2026; downloaded October 13, 2026.
- License: CC0-1.0, documented at https://database.lichess.org/#puzzles.
- Sampling: eligible puzzles in the first 32 MiB of the compressed export.
- Quality filters: popularity at least 80, at least 50 plays, rating deviation
  at most 100; excludes mate-in-one and keeps advantage/crushing/mate themes.
- Categories: only pawns plus kings, or one other piece type (rook, bishop,
  knight, queen). The actual board is checked after applying the setup move.
- Difficulty: easy below 1400; medium 1400–1999; hard 2000+. These are puzzle
  ratings, not ratings of the difficulty of converting the entire endgame.

Lichess's FEN is **before** the opponent's setup move. The first UCI move is
applied once during normalization. `fen` is the playable position after that
move, `side` is the solver's side, and `solution` is the remaining canonical
SAN line. `sourceFen` and `setup` allow testing this transformation. A puzzle
solution indicates a tactical opportunity; it does not promise forced checkmate
or a tablebase win for every position. Players can choose any legal move and
continue beyond the short puzzle solution.

No player names are retained. Each puzzle keeps its public puzzle/game source
links. The source hash and bytes read are in the dataset's metadata.

## Technical draws

The five custom FEN exercises were probed against
https://tablebase.lichess.ovh/standard on October 13, 2026. Every starting result
was `draw`. These positions are not assigned a Lichess rating; their UI
difficulty is editorial. The source URL in each record reproduces the probe.

For a reproducible rebuild, download the puzzle sample, run
`scripts/build-endgame-sample.py`, and normalize with
`scripts/normalize-endgames.mjs`. The normalizer takes optional candidate and
draw-verification JSON paths. The draw verification input contains one row per
exercise: `{id, fen, type, tablebase: <actual probe response>}`; only rows with
an actual `draw` result should be included. The existing checked-in exercises
can be independently verified through their source URLs.

```sh
curl -fL --range 0-33554431 'https://database.lichess.org/lichess_db_puzzle.csv.zst' -o /tmp/pcce-endgame-puzzles.csv.zst
python3 scripts/build-endgame-sample.py /tmp/pcce-endgame-puzzles.csv.zst
node scripts/normalize-endgames.mjs /tmp/pcce-endgame-candidates.json /tmp/pcce-verified-draws.json
```

The archive is intentionally partial. Its decompressor may report an incomplete
frame. Only complete CSV records with all required fields are used. Runtime
loads no source archive and reads only this small starter library.
