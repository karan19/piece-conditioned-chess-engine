import { useState } from 'react';
import { EndgameSession } from '../v2/EndgameSession';
import { replayEndgame, type EndgamePosition } from '../v2/endgames';
import { navigateRoute } from '../navigation';
import { studySide, type Study } from './model';
import '../v2/studio.css';

export default function Practice({ study }: { study: Study }) {
  const side = studySide(study);
  const goal = study.practiceGoal ?? 'win';
  const [error, setError] = useState(false);
  const position: EndgamePosition = { id: `story-${study.video_id}`, title: study.title, fen: study.nodes.find(n => n.id === 'start')!.fen, side, type: study.practiceType ?? 'rook', difficulty: 'hard', rating: null, goal, solution: study.branches.find(b => b.id === (study.practiceBranch ?? (study.video_id === 'KEnJIrhWSDQ' ? 'main_bind' : 'reach_two_threats')))!.san, themes: [], source: 'tablebase-exercise', sourceUrl: `https://lichess.org/analysis/${study.nodes[0].fen.replace(/ /g,'_')}`, verified: {category:goal,date:study.verificationDate ?? '2026-10-17'} };
  const storageKey = `pcce-story-practice-${study.video_id}`;
  const [initial] = useState(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); if (!Array.isArray(value) || value.length > 10000 || value.some(m => typeof m !== 'string')) return []; replayEndgame(position,value); return value as string[]; } catch { return []; }
  });
  return <div className="story-practice">{error && <p role="alert">Your browser couldn’t save this practice game. Export its PGN to keep it.</p>}<EndgameSession position={position} initialMoves={initial} backLabel="Back to the study" plan={study.summary} objectiveText={`Apply the ideas from the study against an automatic opponent. ${goal==='draw'?'The starting position is drawn with best play; try to hold it.':`The starting position is a verified win for ${side==='w'?'White':'Black'}; try to preserve it.`} You can play any legal move and return to the guided variations whenever you want.`} onSave={moves => { try { localStorage.setItem(storageKey,JSON.stringify(moves)); setError(false); } catch { setError(true); } }} onExit={() => navigateRoute(`/endgame-stories/${study.video_id}/`)} /></div>;
}
