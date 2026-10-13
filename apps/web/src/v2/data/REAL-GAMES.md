# Real-game opening reply sample

`real-games.json` contains anonymous aggregate counts derived from the first
64 MiB (bytes 0–67108863) of the Lichess September 2026 rated standard export:
https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst

Source and redistribution license: **CC0-1.0**, as documented at
https://database.lichess.org/. No player names or game IDs are retained.

The download includes 205,239 complete games; 116,969 passed these filters:
both players rated at least 1000, no BOT title, standard starting position,
completed result, and estimated time control (base + 40 increments) of at least
180 seconds. This covers blitz, rapid and classical, not bullet or correspondence.
The eligible sample is from September 1, 2026. It is contiguous and is **not** a
random sample or the entire month's database; percentages cannot be generalized
to all Lichess players or used as predictions of a particular opponent.

Counts group the exact canonical SAN move sequence, through 20 plies, rather
than merging transpositions. Each node's denominator is the number of sampled
games with a next move at that sequence. Positions need at least 20 such games;
up to six replies with at least three games each are retained. Percentages use
the full node denominator, so visible replies need not add to 100%. Outcome
counts are observed game results, not evaluations of a move's quality.

Rebuild from the checkout (requires Python 3 and the official Zstandard CLI):

```sh
curl -fL --range 0-67108863 'https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst' -o /tmp/pcce-games.pgn.zst
python3 scripts/build-real-game-book.py /tmp/pcce-games.pgn.zst --source 'https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst'
```

The metadata records the source, sample SHA-256, filters, thresholds and dates.
The partial archive's checksum is
`9976827d30c69c67ea3ae411675cc4221d22461277789932c25dcdbb0e563673`.
A partial Zstandard archive ends with a decompression error; only complete PGNs
are counted. The builder rejects games with side variations and nonstandard
starts. Runtime and tests validate the displayed SAN against the actual board.
