"""Extract a bounded CC0 endgame puzzle sample; validate/normalize with the JS builder."""
import csv,json,subprocess,argparse,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('--output',type=Path,default=Path('/tmp/pcce-endgame-candidates.json'));a=p.parse_args()
themes={'pawnEndgame':'pawn','rookEndgame':'rook','bishopEndgame':'bishop','knightEndgame':'knight','queenEndgame':'queen'}
proc=subprocess.Popen(['zstd','-dc',str(a.archive)],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
rows=[];counts={};scanned=0
for row in csv.DictReader(proc.stdout):
    scanned+=1
    try:
        rating=int(row['Rating']);tag=next((tag for tag in themes if tag in row['Themes'].split()),None)
        if not tag or int(row['Popularity'])<80 or int(row['NbPlays'])<50 or int(row['RatingDeviation'])>100:continue
        if 'mateIn1' in row['Themes'].split():continue
        difficulty='easy' if rating<1400 else 'medium' if rating<2000 else 'hard'
        key=themes[tag]+':'+difficulty
        if counts.get(key,0)>=35:continue
        if not row['Moves'] or not row['GameUrl']:continue
        rows.append({'id':row['PuzzleId'],'fen':row['FEN'],'moves':row['Moves'].split(),'rating':rating,'type':themes[tag],'difficulty':difficulty,'themes':row['Themes'].split(),'url':row['GameUrl']})
        counts[key]=counts.get(key,0)+1
    except (ValueError,TypeError,KeyError):continue
proc.wait()
a.output.write_text(json.dumps({'metadata':{'source':'https://database.lichess.org/lichess_db_puzzle.csv.zst','license':'CC0-1.0','downloadedBytes':a.archive.stat().st_size,'sha256':hashlib.sha256(a.archive.read_bytes()).hexdigest(),'scannedRows':scanned,'sampling':'Qualified puzzles from the first 32 MiB of the October 5, 2026 export; up to 35 candidates per type/difficulty.'},'positions':rows}))
print('Scanned',scanned,'candidates',len(rows),counts)
