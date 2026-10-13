import { Chess } from 'chess.js';
import fs from 'node:fs';
const sample=JSON.parse(fs.readFileSync(process.argv[2] ?? '/tmp/pcce-endgame-candidates.json','utf8'));
const positions=[], counts={};
for(const row of sample.positions){
  try{
    const game=new Chess(row.fen);
    const uci=s=>({from:s.slice(0,2),to:s.slice(2,4),promotion:s[4]});
    const setup=game.move(uci(row.moves[0])).san;
    if(game.isGameOver())continue;
    const types=new Set(game.board().flat().filter(p=>p&&p.type!=='p'&&p.type!=='k').map(p=>p.type));
    const actual=types.size===0?'pawn':types.size===1?({r:'rook',b:'bishop',n:'knight',q:'queen'}[[...types][0]]):null;
    if(actual!==row.type)continue;
    if(!row.themes.some(t=>['advantage','crushing','mate'].includes(t)))continue;
    const key=row.type+':'+row.difficulty;
    if((counts[key]??0)>=10)continue;
    const fen=game.fen(),side=game.turn(),solution=[];
    for(const move of row.moves.slice(1))solution.push(game.move(uci(move)).san);
    if(!solution.length)continue;
    positions.push({id:row.id,fen,sourceFen:row.fen,side,type:actual,difficulty:row.difficulty,rating:row.rating,goal:'win',title:row.type[0].toUpperCase()+row.type.slice(1)+' endgame · '+row.id,solution,themes:row.themes,source:'lichess-puzzle',sourceUrl:'https://lichess.org/training/'+row.id,gameUrl:row.url,setup});
    counts[key]=(counts[key]??0)+1;
  }catch{}
}
const draws=JSON.parse(fs.readFileSync(process.argv[3] ?? '/tmp/pcce-verified-draws.json','utf8'));
for(const row of draws){
  if(row.tablebase?.category!=="draw")throw new Error("Draw exercise lacks an actual drawn tablebase result: "+row.id);
  new Chess(row.fen);
  positions.push({id:row.id,fen:row.fen,side:'w',type:row.type,difficulty:row.type==='pawn'||row.type==='knight'?'easy':row.type==='queen'?'hard':'medium',rating:null,goal:'draw',title:row.type==='rook'?'Rook defense: hold the third rank':row.type==='pawn'?'King and pawn: hold the opposition':row.type==='knight'?'Knight defense: simplify safely':row.type==='bishop'?'Opposite-colored bishops: defend the draw':'Queen endgame: avoid losing exchanges',solution:[],themes:['endgame'],source:'tablebase-exercise',sourceUrl:'https://tablebase.lichess.ovh/standard?fen='+encodeURIComponent(row.fen),verified:{category:'draw',date:'2026-10-13'}});
}
fs.writeFileSync('apps/web/src/v2/data/endgames.json',JSON.stringify({metadata:{...sample.metadata,positions:positions.length,winPositions:positions.filter(p=>p.goal==='win').length,drawPositions:draws.length},positions},null,2)+'\n');
console.log({positions:positions.length,counts,draws:draws.length});
