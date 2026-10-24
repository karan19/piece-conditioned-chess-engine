import { Chess } from 'chess.js';
import catalogData from './data/catalog.json';
import studiesData from './data/studies.json';

export type Story = { id: string; title: string; originalTitle: string; endgame: boolean; verified: boolean; themes: string[]; thumbnail: string | null; frames: number; hasNarration: boolean; duration: number; sourceUrl: string; order: number; reviewStatus: 'verified_selected_lines'|'awaiting_reconstruction'|'needs_information'|'not_applicable'|'not_queued'; sourceGaps: string[]; informationNeeded: string[]; reviewBatch: string|null; reviewNotes: string };
export type SourceState = { time: number; end: number; image: string; text: string; overlay: boolean };
export type SourceStory = Story & { transcript: string; captions: {start: number; end: number; text: string}[]; states: SourceState[]; excludedImages: boolean };
export type StudyNode = { id: string; fen: string; question: string; explanation: string; proof?: {method: 'legal_winning_move'; fen: string; san: string; successor_fen: string; successor_evidence_key: string; category_for_side_to_move: 'win'} | {method: 'finite_strategy'; fen: string; winner: 'white'|'black'; category_for_side_to_move: 'win'|'loss'; rule: 'winning_choice'|'all_legal_defenses'|'checkmate'} | {method: 'finite_draw'; fen: string; category_for_side_to_move: 'draw'}; tablebase?: {category_for_side_to_move: string}; evidence: {timestamp_s?: number} };
export type StudyBranch = { id: string; start: string; san: string[]; classification: string; explanation: string; end_fen: string; outcome: string; title?: string; commentary?: string[]; expectedWhiteOutcomes?: string[] };
export type Study = { video_id: string; title: string; summary: string; nodes: StudyNode[]; branches: StudyBranch[]; exercises: {node: string; prompt: string; answer: string}[]; defaultBranch?: string; practiceBranch?: string; practiceGoal?: 'win'|'draw'; practiceType?: 'pawn'|'rook'|'bishop'|'knight'|'queen'; verification_scope?: string; sourceCorrections?: {claim: string; correction: string}[]; verificationDate?: string; startContext?: string };
export const catalog = catalogData as Story[];
export const studies = studiesData as unknown as Record<string, Study>;
export const themes = [...new Set(catalog.flatMap(s => s.themes))].sort();
export function storyRoute(url: URL) {
  const parts = url.pathname.split('/').filter(Boolean);
  const p = url.searchParams;
  return { valid: parts[0] === 'endgame-stories' && parts.length <= 2, id: parts[1] ?? null, mode: p.get('mode') === 'source' ? 'source' : p.get('mode') === 'practice' ? 'practice' : 'study', line: p.get('line'), ply: nonnegative(p.get('ply')), frame: nonnegative(p.get('frame')), search: p.get('q') ?? '', theme: themes.includes(p.get('theme') ?? '') ? p.get('theme')! : 'all', scope: ['guided','all','pending','needs-info','skipped'].includes(p.get('scope') ?? '') ? p.get('scope')! : 'endgames', page: Math.max(1, nonnegative(p.get('page'))) };
}
function nonnegative(value: string | null) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= 100000 ? n : 0; }
export function filterStories(scope: string, theme: string, search: string) {
  const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter(s => (scope === 'all' || (scope === 'guided' ? s.verified : scope === 'pending' ? s.reviewStatus === 'awaiting_reconstruction' : scope === 'needs-info' ? s.reviewStatus === 'needs_information' : scope === 'skipped' ? s.reviewStatus === 'not_applicable' : s.endgame && s.reviewStatus !== 'not_applicable')) && (theme === 'all' || s.themes.includes(theme)) && words.every(w => (s.title + ' ' + s.originalTitle + ' ' + s.themes.join(' ')).toLocaleLowerCase().includes(w))).sort((a,b) => Number(b.verified)-Number(a.verified) || a.order-b.order);
}
export function replayBranch(study: Study, branch: StudyBranch, ply: number) {
  const node = study.nodes.find(n => n.id === branch.start);
  if (!node) throw new Error('Missing study position');
  const game = new Chess(node.fen);
  for (const san of branch.san.slice(0, Math.max(0, Math.min(ply, branch.san.length)))) game.move(san);
  return game;
}
export function outcomeLabel(category: string, turn: 'w'|'b') {
  if (category === 'draw') return 'Draw with best play';
  if (!['win','loss'].includes(category)) return 'Outcome needs further analysis';
  const winner = category === 'win' ? turn : turn === 'w' ? 'b' : 'w';
  return `${winner === 'w' ? 'White' : 'Black'} can force a win`;
}
export function timestamp(seconds: number) { return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }
export function validateSource(value: unknown, id: string): SourceStory {
  const s = value as SourceStory;
  if (!s || s.id !== id || !Array.isArray(s.states) || !Array.isArray(s.captions) || typeof s.transcript !== 'string' || s.states.some(f => !Number.isFinite(f.time) || !Number.isFinite(f.end) || f.time < 0 || f.end <= f.time || typeof f.text !== 'string' || !f.image.startsWith(`/endgame-stories/${id}/`) || f.image.includes('..'))) throw new Error('This source walkthrough could not be read.');
  return s;
}

export function studySide(study: Study): 'w'|'b' {
  const start=study.nodes.find(node=>node.id==='start');
  if(!start) throw new Error('Study has no starting position');
  return new Chess(start.fen).turn();
}
