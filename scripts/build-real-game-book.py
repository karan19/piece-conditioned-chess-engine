"""Build anonymous opening reply counts from a bounded CC0 Lichess PGN sample.

Example:
  curl -fL --range 0-67108863 SOURCE -o /tmp/games.pgn.zst
  python3 scripts/build-real-game-book.py /tmp/games.pgn.zst --source SOURCE

Only complete games are used. The archive may be a partial Zstandard download;
its nonzero decompressor exit is expected in that case. At least one complete
eligible game is required. The builder emits no player names or game IDs.
"""
import argparse
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--source', required=True)
parser.add_argument('--output', type=Path, default=Path('apps/web/src/v2/data/real-games.json'))
args = parser.parse_args()
positions = defaultdict(lambda: {'n': 0, 'm': defaultdict(lambda: [0, 0, 0])})
headers, text = {}, []
scanned = accepted = 0
dates = []

def consume():
    global scanned, accepted
    if not text:
        return
    scanned += 1
    if headers.get('Result') not in ['1-0', '1/2-1/2', '0-1']:
        return
    if headers.get('WhiteTitle') == 'BOT' or headers.get('BlackTitle') == 'BOT':
        return
    if 'FEN' in headers or headers.get('Variant', 'Standard') != 'Standard':
        return
    try:
        if min(int(headers['WhiteElo']), int(headers['BlackElo'])) < 1000:
            return
        base, increment = map(int, headers['TimeControl'].split('+'))
        if base + 40 * increment < 180:
            return
    except (KeyError, ValueError):
        return
    raw = re.sub(r'\{[^}]*\}', ' ', ' '.join(text))
    # Lichess rated exports have no side variations. Reject rather than count a
    # side variation if a different export is accidentally supplied.
    if '(' in raw or ')' in raw:
        return
    tokens = re.sub(r'\d+\.(?:\.\.)?', ' ', raw).split()
    if not tokens or tokens[-1] != headers['Result']:
        return
    moves = [re.sub(r'[!?]+$', '', t).replace('0-0', 'O-O') for t in tokens[:-1] if not t.startswith('$')][:20]
    if not moves or any(not re.fullmatch(r'(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?', m) for m in moves):
        return
    accepted += 1
    dates.append(headers.get('UTCDate', headers.get('Date', 'unknown')))
    result = ['1-0', '1/2-1/2', '0-1'].index(headers['Result'])
    for i, san in enumerate(moves):
        node = positions[' '.join(moves[:i])]
        node['n'] += 1
        node['m'][san][result] += 1

proc = subprocess.Popen(['zstd', '-dc', str(args.archive)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
for line in proc.stdout:
    line = line.strip()
    if line.startswith('['):
        if text:
            consume()
            headers, text = {}, []
        match = re.fullmatch(r'\[(\w+) "(.*)"\]', line)
        if match:
            headers[match[1]] = match[2]
    elif line:
        text.append(line)
consume()
proc.wait()
if not accepted:
    raise SystemExit('No complete eligible games found; no dataset written.')
kept = {}
for prefix, node in positions.items():
    if node['n'] < 20:
        continue
    moves = sorted(node['m'].items(), key=lambda m: (-sum(m[1]), m[0]))
    kept[prefix] = {'n': node['n'], 'm': [[san, *counts] for san, counts in moves[:6] if sum(counts) >= 3]}
metadata = {
    'source': args.source,
    'license': 'CC0-1.0',
    'archiveSha256': hashlib.sha256(args.archive.read_bytes()).hexdigest(),
    'sampleBytes': args.archive.stat().st_size,
    'scannedGames': scanned,
    'games': accepted,
    'firstDate': min(dates), 'lastDate': max(dates),
    'filters': 'Rated standard human games; both ratings 1000+; blitz, rapid and classical (estimated duration at least 180 seconds).',
    'sampling': 'Complete eligible games in the first 64 MiB of the monthly archive; a contiguous sample, not the entire month or all Lichess games.',
    'maxPlies': 20, 'minimumGames': 20, 'minimumMoveGames': 3,
    'positions': len(kept),
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps({'metadata': metadata, 'positions': kept}, separators=(',', ':')) + '\n')
print(json.dumps(metadata, indent=2))
print('Dataset bytes:', args.output.stat().st_size)
