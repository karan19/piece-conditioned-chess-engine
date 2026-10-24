import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { catalog, filterStories, outcomeLabel, replayBranch, storyRoute, studies, studySide, validateSource } from './model';
import { annotations } from './annotations';

describe('Endgame Stories teaching and source integrity',()=>{
  it('replays every curated variation to its checked endpoint with one explanation for each step',()=>{
    for(const study of Object.values(studies)) for(const branch of study.branches) {
      const game=replayBranch(study,branch,branch.san.length);
      expect(game.fen(),`${study.title}: ${branch.id}`).toBe(branch.end_fen);
      expect((branch.commentary ?? annotations[branch.id]).length).toBe(branch.san.length+1);
      expect((branch.commentary ?? annotations[branch.id]).every(s=>s.length>15)).toBe(true);
      expect(['win','loss','draw']).toContain(branch.outcome);
    }
  });
  it('preserves the important contrast between keeping and removing the pawn shield',()=>{
    const study=studies.KEnJIrhWSDQ;
    const keep=study.branches.find(b=>b.id==='keep_shield')!;
    const take=study.branches.find(b=>b.id==='remove_shield')!;
    const held=replayBranch(study,keep,1);
    expect(held.get('h2')).toMatchObject({type:'p',color:'b'});
    expect(outcomeLabel(keep.outcome,held.turn())).toBe('White can force a win');
    expect(take.san).toEqual(['Kxh2','Rh8+']);
    expect(replayBranch(study,take,2).isCheck()).toBe(true);
    expect(outcomeLabel(take.outcome,'w')).toBe('Draw with best play');
  });
  it('does not teach that Kc5 itself loses the win',()=>{
    const study=studies.NysivKCHQiY;
    const correction=study.branches.find(b=>b.id==='recover_center')!;
    expect(correction.san).toEqual(['Kc5','Rc2+','Kb6']);
    expect(outcomeLabel(correction.outcome,replayBranch(study,correction,3).turn())).toBe('White can force a win');
    expect(annotations.premature_center[1]).toContain('still wins');
    expect(annotations.premature_center[3]).toContain('actual error');
  });
  it('answers en passant legally and verifies the promotion trap is actual mate',()=>{
    const study=studies.zpX6pvMJhto;
    const ep=study.branches.find(b=>b.id==='en_passant_defense')!;
    const capture=replayBranch(study,ep,4);
    expect(capture.history({verbose:true}).at(-1)?.flags).toContain('e');
    expect(capture.get('c4')).toBeUndefined();
    expect(capture.get('c3')).toMatchObject({type:'p',color:'b'});
    const finish=study.branches.find(b=>b.id==='allow_queen')!;
    const game=replayBranch(study,finish,finish.san.length);
    expect(game.get('a1')).toMatchObject({type:'q',color:'b'});
    expect(game.isCheckmate()).toBe(true);
    expect(outcomeLabel(finish.outcome,game.turn())).toBe('White can force a win');
  });
  it('distinguishes the queen stalemates from the winning underpromotions',()=>{
    const knight=studies.qKgBXwR83Wg;
    const queen=knight.branches.find(b=>b.id==='return_queen_trap')!;
    expect(replayBranch(knight,queen,queen.san.length).isStalemate()).toBe(true);
    const victory=studies['u8a68-7Wtp8'];
    const trap=victory.branches.find(b=>b.id==='victory_stalemate')!;
    expect(replayBranch(victory,trap,trap.san.length).isStalemate()).toBe(true);
    const rook=victory.branches.find(b=>b.id==='victory_rook_reply')!;
    const afterCapture=replayBranch(victory,rook,3);
    expect(afterCapture.isStalemate()).toBe(false);
    expect(afterCapture.moves()).toContain('Ka2');
    expect(replayBranch(victory,rook,4).get('a2')).toMatchObject({type:'k',color:'b'});
    const deal=studies.enr20Gxq8OA;
    const line=deal.branches.find(b=>b.id==='deal_interference')!;
    expect(replayBranch(deal,line,5).get('b8')).toMatchObject({type:'b',color:'w'});
    expect(replayBranch(deal,line,7).get('b8')).toMatchObject({type:'q',color:'w'});
  });
  it('matches every new study step to saved tablebase evidence, including intentionally drawing errors',()=>{
    for(const study of Object.values(studies)) for(const branch of study.branches.filter(b=>b.expectedWhiteOutcomes)) {
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${study.video_id}.evidence.json`,import.meta.url)),'utf8'));
      expect(branch.expectedWhiteOutcomes).toHaveLength(branch.san.length);
      for(let ply=1;ply<=branch.san.length;ply++) {
        const game=replayBranch(study,branch,ply);
        const step=evidence[`step:${branch.id}:${ply}`];
        expect(step.fen).toBe(game.fen());
        const category=step.response?.category ?? step.category_for_side_to_move;
        expect(category).toBeDefined();
        const white=category==='draw'?'draw':category===(game.turn()==='w'?'win':'loss')?'win':'loss';
        expect(white).toBe(branch.expectedWhiteOutcomes![ply-1]);
      }
    }
  });
  it('keeps all candidates accounted for and exposes actionable information gaps separately from pending review',()=>{
    const queue=JSON.parse(readFileSync(fileURLToPath(new URL('./data/review-queue.json',import.meta.url)),'utf8')) as {video_id:string;status:string;information_needed:string[];batch_id:string|null}[];
    const progress=JSON.parse(readFileSync(fileURLToPath(new URL('./data/progress.json',import.meta.url)),'utf8'));
    expect(queue).toHaveLength(catalog.filter(s=>s.endgame).length);
    expect(new Set(queue.map(s=>s.video_id)).size).toBe(queue.length);
    expect(Object.values(progress.counts).reduce((a:number,b)=>a+Number(b),0)).toBe(queue.length);
    for(const row of queue) {
      expect(row.status).toBe(catalog.find(s=>s.id===row.video_id)!.reviewStatus);
      if(row.status==='needs_information') expect(row.information_needed.length).toBeGreaterThan(0);
      if(row.status==='verified_selected_lines') {
        expect(studies[row.video_id]).toBeDefined();
        expect(row.batch_id).toBeTruthy();
      }
    }
    expect(filterStories('pending','all','').every(s=>s.reviewStatus==='awaiting_reconstruction')).toBe(true);
    expect(filterStories('needs-info','all','').every(s=>Array.isArray(s.informationNeeded) && s.informationNeeded.every(x=>typeof x==='string' && x.length>0) && s.informationNeeded.length>0 && !s.verified)).toBe(true);
    expect(filterStories('skipped','all','').map(s=>s.id)).toContain('nocjHIXt8NY');
    expect(filterStories('endgames','all','').map(s=>s.id)).not.toContain('nocjHIXt8NY');
    expect(storyRoute(new URL('https://chess.example/endgame-stories/?scope=needs-info')).scope).toBe('needs-info');
  });
  it('supports Black-to-move studies and checks their promotion and tempo teaching claims',()=>{
    const bishops=studies.TF7EyH_IkKo;
    const chase=studies.CTmcvqKF8DQ;
    expect(studySide(bishops)).toBe('b');
    expect(studySide(chase)).toBe('b');
    expect(studySide(studies.HJaowRJZD6Y)).toBe('w');
    for(const id of ['bishops_queen_stalemate','bishops_rook_stalemate','bishops_take_too_soon']) {
      const branch=bishops.branches.find(b=>b.id===id)!;
      expect(replayBranch(bishops,branch,branch.san.length).isStalemate()).toBe(true);
    }
    const mate=bishops.branches.find(b=>b.id==='bishops_mating_net')!;
    const final=replayBranch(bishops,mate,mate.san.length);
    expect(final.isCheckmate()).toBe(true);
    expect(outcomeLabel(mate.outcome,final.turn())).toBe('Black can force a win');
    const tempo=chase.branches.find(b=>b.id==='chase_keep_tempo')!;
    expect(replayBranch(chase,tempo,3).isCheck()).toBe(false);
    const alternative=chase.branches.find(b=>b.id==='chase_other_winning_move')!;
    expect(outcomeLabel(alternative.outcome,replayBranch(chase,alternative,1).turn())).toBe('Black can force a win');
    const cube=studies.HJaowRJZD6Y;
    const finish=cube.branches.find(b=>b.id==='cube_forcing_finish')!;
    expect(replayBranch(cube,finish,finish.san.length).isCheckmate()).toBe(true);
  });
  it('preserves the drawing objective, opposition timing and staircase mating mechanisms',()=>{
    const draw=studies.nDzMs3B_Nw8;
    expect(draw.practiceGoal).toBe('draw');
    expect(draw.nodes.find(n=>n.id==='start')!.tablebase?.category_for_side_to_move).toBe('draw');
    const retreat=draw.branches.find(b=>b.id==='sublime_king_approach')!;
    const wrong=draw.branches.find(b=>b.id==='sublime_wrong_king_step')!;
    expect(outcomeLabel(retreat.outcome,replayBranch(draw,retreat,3).turn())).toBe('Draw with best play');
    expect(outcomeLabel(wrong.outcome,replayBranch(draw,wrong,2).turn())).toBe('Black can force a win');
    const forbidden=studies.GQVVG6elNP4;
    const mate=forbidden.branches.find(b=>b.id==='forbidden_staircase')!;
    expect(replayBranch(forbidden,mate,mate.san.length).isCheckmate()).toBe(true);
    const barrier=forbidden.branches.find(b=>b.id==='forbidden_premature_barrier')!;
    expect(replayBranch(forbidden,barrier,1).isStalemate()).toBe(true);
    const glory=studies.TwsMYfF9lVE;
    const queen=glory.branches.find(b=>b.id==='glory_queen_trap')!;
    expect(replayBranch(glory,queen,3).isStalemate()).toBe(true);
    const rook=glory.branches.find(b=>b.id==='glory_rook_contrast')!;
    expect(replayBranch(glory,rook,3).moves()).toContain('Ka3');
    const staircase=studies.LkIP90tWgZI;
    const finish=staircase.branches.find(b=>b.id==='esacriats_complete')!;
    const waiting=staircase.branches.find(b=>b.id==='esacriats_stalemate')!;
    expect(replayBranch(staircase,finish,finish.san.length).isCheckmate()).toBe(true);
    expect(replayBranch(staircase,waiting,1).isStalemate()).toBe(true);
  });
  it('checks the promotion cages, underpromotion response and interposing check',()=>{
    const nightmare=studies.Pev0s_MaUVI;
    for(const id of ['nightmare_walk','nightmare_pawn_mate','nightmare_underpromotion']) {
      const branch=nightmare.branches.find(b=>b.id===id)!;
      expect(replayBranch(nightmare,branch,branch.san.length).isCheckmate()).toBe(true);
    }
    const wrong=nightmare.branches.find(b=>b.id==='nightmare_wrong_order')!;
    expect(wrong.expectedWhiteOutcomes).toEqual(['win','loss','loss']);
    expect(replayBranch(nightmare,wrong,3).get('b3')).toMatchObject({type:'n',color:'b'});
    const rook=studies.EJqPm9Za6F0;
    const main=rook.branches.find(b=>b.id==='rook_knight_main')!;
    const pawnCheck=replayBranch(rook,main,1);
    expect(pawnCheck.isCheck()).toBe(true);
    expect(pawnCheck.moves().sort()).toEqual(['Kf6','Kh6','Kxh5'].sort());
    const before=replayBranch(rook,main,8);
    expect(before.isCheck()).toBe(true);
    expect(before.get('f1')).toMatchObject({type:'q',color:'b'});
    const interpose=replayBranch(rook,main,9);
    expect(interpose.get('f3')).toMatchObject({type:'n',color:'w'});
    expect(interpose.isCheck()).toBe(true);
    expect(replayBranch(rook,main,main.san.length).isCheckmate()).toBe(true);
    const misplacement=studies.hgFcWql1ya4;
    for(const id of ['misplace_early_queen','misplace_race']) {
      const branch=misplacement.branches.find(b=>b.id===id)!;
      expect(outcomeLabel(branch.outcome,replayBranch(misplacement,branch,branch.san.length).turn())).toBe('Draw with best play');
    }
  });
  it('checks the king escort, queen stalemate and pawn-ending outcome reversals',()=>{
    const defense=studies.Vm9PJ07HakA;
    expect(studySide(defense)).toBe('b');
    const escort=defense.branches.find(b=>b.id==='defense_king_escort')!;
    const mate=replayBranch(defense,escort,escort.san.length);
    expect(mate.isCheckmate()).toBe(true);
    expect(mate.get('e2')).toMatchObject({type:'p',color:'b'});
    expect(outcomeLabel(escort.outcome,mate.turn())).toBe('Black can force a win');
    const shield=studies.lzsnCbzVHBA;
    const trap=shield.branches.find(b=>b.id==='shield_stalemate_prize')!;
    expect(replayBranch(shield,trap,1).isStalemate()).toBe(true);
    for(const id of ['shield_queen_transfer','shield_other_king']) {
      const branch=shield.branches.find(b=>b.id===id)!;
      expect(replayBranch(shield,branch,branch.san.length).isCheckmate()).toBe(true);
    }
    const woods=studies.ADZ5271s_PY;
    expect(studySide(woods)).toBe('b');
    const retreat=woods.branches.find(b=>b.id==='woods_rook_retreat')!;
    expect(outcomeLabel(retreat.outcome,replayBranch(woods,retreat,2).turn())).toBe('White can force a win');
    const rush=woods.branches.find(b=>b.id==='woods_wrong_promotion')!;
    expect(rush.expectedWhiteOutcomes).toEqual(['win','loss','loss','loss','loss']);
    expect(replayBranch(woods,rush,3).isCheck()).toBe(false);
  });
  it('checks bishop interference, preparation before promotion and the two stylish mates',()=>{
    const glory=studies.LnBiKmJsKDI;
    const prepare=glory.branches.find(b=>b.id==='glory_knight_preparation')!;
    expect(prepare.san.slice(-3)).toEqual(['Nf2','Rg3+','Kh8']);
    expect(replayBranch(glory,prepare,prepare.san.length).isCheck()).toBe(false);
    const trap=glory.branches.find(b=>b.id==='glory_premature_queen')!;
    expect(replayBranch(glory,trap,trap.san.length).isStalemate()).toBe(true);
    const bishop=studies.UnrHt2qs4Us;
    const interference=bishop.branches.find(b=>b.id==='ultimate_rook_interference')!;
    const twoThreats=replayBranch(bishop,interference,3);
    expect(twoThreats.get('d7')).toMatchObject({type:'p',color:'w'});
    expect(twoThreats.get('e7')).toMatchObject({type:'p',color:'w'});
    const style=studies.RGE18Mn9DuY;
    for(const id of ['style_direct_mate','style_allow_queen','style_king_move']) {
      const branch=style.branches.find(b=>b.id===id)!;
      expect(replayBranch(style,branch,branch.san.length).isCheckmate()).toBe(true);
    }
    const rush=style.branches.find(b=>b.id==='style_rush_promotion')!;
    expect(replayBranch(style,rush,1).isCheck()).toBe(true);
    expect(outcomeLabel(rush.outcome,replayBranch(style,rush,3).turn())).toBe('Draw with best play');
    const allow=style.branches.find(b=>b.id==='style_allow_queen')!;
    const cage=replayBranch(style,allow,3);
    expect(cage.moves().filter(move=>move.endsWith('+')).sort()).toEqual(['Qa2+','Qa3+','Qa4+','Qb2+','Qc3+'].sort());
  });
  it('keeps the Great Trap source correction and checks the rook geometries',()=>{
    const trap=studies.VIvQJHquE4U;
    expect(trap.nodes.find(n=>n.id==='source_start')!.tablebase?.category_for_side_to_move).toBe('draw');
    expect(trap.nodes.find(n=>n.id==='start')!.tablebase?.category_for_side_to_move).toBe('win');
    const defense=trap.branches.find(b=>b.id==='trap_black_drawing_defense')!;
    expect(defense.san).toEqual(['Rb8','Ra4']);
    expect(outcomeLabel(defense.outcome,replayBranch(trap,defense,2).turn())).toBe('Draw with best play');
    const mate=trap.branches.find(b=>b.id==='trap_king_retreat')!;
    expect(replayBranch(trap,mate,mate.san.length).isCheckmate()).toBe(true);
    const geometry=studies.RbUXuxisuOY;
    const fork=geometry.branches.find(b=>b.id==='geometry_back_rank')!;
    const rank=replayBranch(geometry,fork,fork.san.length);
    expect(rank.isCheck()).toBe(true);
    expect(rank.get('a8')).toMatchObject({type:'k',color:'b'});
    expect(rank.get('g8')).toMatchObject({type:'b',color:'b'});
    const revolution=studies['8Dw6c0nghMA'];
    const skewer=revolution.branches.find(b=>b.id==='revolution_skewer')!;
    expect(replayBranch(revolution,skewer,3).isCheck()).toBe(true);
    expect(replayBranch(revolution,skewer,5).get('b7')).toMatchObject({type:'r',color:'w'});
    expect(catalog.find(s=>s.id==='B9YOa6v4KF0')?.reviewStatus).toBe('not_applicable');
  });
  it('checks the king shoulder, rook sacrifice blockade and rook underpromotion',()=>{
    const pawns=studies.P51ckne8WhY;
    const error=pawns.branches.find(b=>b.id==='pawns_push_early')!;
    expect(error.expectedWhiteOutcomes).toEqual(['loss','loss','loss','loss']);
    const afterCapture=replayBranch(pawns,error,4);
    expect(afterCapture.get('g8')).toMatchObject({type:'r',color:'b'});
    expect(afterCapture.moves()).not.toContain('Kxg8');
    const precision=studies.Ml6F1l_2AZU;
    const trap=precision.branches.find(b=>b.id==='precision_stalemate')!;
    expect(replayBranch(precision,trap,3).isStalemate()).toBe(true);
    const blockade=precision.branches.find(b=>b.id==='precision_rook_sacrifice')!;
    const held=replayBranch(precision,blockade,blockade.san.length);
    expect(held.get('h1')).toMatchObject({type:'k',color:'w'});
    expect(held.get('h2')).toMatchObject({type:'p',color:'b'});
    const victory=studies['4VHe805f7Bw'];
    const queen=victory.branches.find(b=>b.id==='victory_queen_stalemate')!;
    expect(replayBranch(victory,queen,queen.san.length).isStalemate()).toBe(true);
    const rook=victory.branches.find(b=>b.id==='victory_rook_underpromotion')!;
    expect(replayBranch(victory,rook,11).get('c8')).toMatchObject({type:'r',color:'w'});
    expect(outcomeLabel(rook.outcome,replayBranch(victory,rook,rook.san.length).turn())).toBe('White can force a win');
  });
  it('preserves source outcome reversals and waits for actual rook mate',()=>{
    const pawns=studies['8oJ_ufd_-i8'];
    const timing=pawns.branches.find(b=>b.id==='rook_two_pawns_timing')!;
    const almostMate=replayBranch(pawns,timing,9);
    expect(almostMate.isCheckmate()).toBe(false);
    expect(almostMate.moves()).toEqual(['Qh4']);
    expect(replayBranch(pawns,timing,11).isCheckmate()).toBe(true);
    expect(pawns.branches.find(b=>b.id==='rook_two_pawns_early_king')!.expectedWhiteOutcomes).toEqual(['draw','win','draw','draw']);
    expect(pawns.branches.find(b=>b.id==='rook_two_pawns_drawing_reply')!.expectedWhiteOutcomes).toEqual(['draw','draw']);
    const corner=studies.AOrqnQwOwCc;
    const recovery=corner.branches.find(b=>b.id==='corner_passive_defense')!;
    expect(recovery.expectedWhiteOutcomes).toEqual(['draw','win','win','win','win']);
    expect(replayBranch(corner,recovery,3).isCheck()).toBe(true);
    expect(replayBranch(corner,recovery,5).get('h8')).toMatchObject({type:'q',color:'w'});
    const tricky=studies.sY2HWDyHuX4;
    const sacrifice=tricky.branches.find(b=>b.id==='tricky_waiting_sacrifice')!;
    const zugzwang=replayBranch(tricky,sacrifice,5);
    expect(zugzwang.get('a6')).toMatchObject({type:'k',color:'w'});
    expect(zugzwang.get('c8')).toMatchObject({type:'k',color:'b'});
    expect(zugzwang.turn()).toBe('b');
    expect(zugzwang.board().flat().filter(p=>p?.type==='n')).toHaveLength(0);
  });
  it('checks the king route, bishop arrangement and three knight mating nets',()=>{
    const surgical=studies.A12kZa9XUC0;
    const route=surgical.branches.find(b=>b.id==='surgical_light_squares')!;
    expect(replayBranch(surgical,route,1).get('b3')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(surgical,route,3).get('c2')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(surgical,route,5).get('d1')).toMatchObject({type:'k',color:'w'});
    const wrong=surgical.branches.find(b=>b.id==='surgical_wrong_approach')!;
    expect(replayBranch(surgical,wrong,2).isCheck()).toBe(true);
    expect(wrong.expectedWhiteOutcomes).toEqual(['draw','draw','draw']);
    const bishops=studies['1Zm_QO2Ehso'];
    const fork=bishops.branches.find(b=>b.id==='bishops_rook_fork')!;
    expect(replayBranch(bishops,fork,1).get('e6')).toMatchObject({type:'b',color:'w'});
    const arranged=replayBranch(bishops,fork,3);
    expect(arranged.get('d6')).toMatchObject({type:'b',color:'w'});
    expect(arranged.get('e6')).toMatchObject({type:'b',color:'w'});
    const trap=bishops.branches.find(b=>b.id==='bishops_stalemate_capture')!;
    expect(replayBranch(bishops,trap,3).isStalemate()).toBe(true);
    const doom=studies.IbQUuXJOIqE;
    for(const id of ['doom_second_underpromotion','doom_king_corner','doom_queen_promotion']) {
      const branch=doom.branches.find(b=>b.id===id)!;
      expect(replayBranch(doom,branch,branch.san.length).isCheckmate(),id).toBe(true);
    }
    const main=doom.branches.find(b=>b.id==='doom_second_underpromotion')!;
    const beforeMate=replayBranch(doom,main,8);
    expect(beforeMate.get('a3')).toMatchObject({type:'n',color:'b'});
    expect(beforeMate.get('b1')).toMatchObject({type:'n',color:'b'});
  });
  it('distinguishes rook blocks, three stalemates and bishop-supported queen checks',()=>{
    const double=studies.rLE0oYWeGWY;
    const cRook=double.branches.find(b=>b.id==='double_c_rook')!;
    const checked=replayBranch(double,cRook,7);
    expect(checked.isCheckmate()).toBe(false);
    expect(checked.moves()).toEqual(['Rh2']);
    expect(replayBranch(double,cRook,9).isCheckmate()).toBe(true);
    const dRook=double.branches.find(b=>b.id==='double_d_rook')!;
    expect(replayBranch(double,dRook,dRook.san.length).isCheckmate()).toBe(true);
    const traps=studies.Lf3fQRT0SIc;
    for(const id of ['stalemate_first_queen','stalemate_second_queen','stalemate_final_queen']) {
      const b=traps.branches.find(x=>x.id===id)!;
      expect(replayBranch(traps,b,b.san.length).isStalemate(),id).toBe(true);
    }
    const rook=traps.branches.find(b=>b.id==='stalemate_rook_promotion')!;
    const promoted=replayBranch(traps,rook,rook.san.length);
    expect(promoted.get('c8')).toMatchObject({type:'r',color:'w'});
    expect(promoted.isStalemate()).toBe(false);
    expect(promoted.moves()).toContain('Ka6');
    const air=studies.i5FEn9PMcAg;
    const skewer=air.branches.find(b=>b.id==='air_bishop_geometry')!;
    expect(replayBranch(air,skewer,5).moves()).not.toContain('Kxf3');
    expect(replayBranch(air,skewer,11).get('c1')).toMatchObject({type:'q',color:'w'});
  });
  it('checks the king crossing, Black underpromotion and queen countercheck sacrifice',()=>{
    const destiny=studies.o988a8BFTbM;
    const crossing=destiny.branches.find(b=>b.id==='destiny_king_crossing')!;
    expect(replayBranch(destiny,crossing,0).isCheck()).toBe(true);
    const end=replayBranch(destiny,crossing,crossing.san.length);
    expect(end.get('h8')).toMatchObject({type:'q',color:'w'});
    expect(end.get('h3')).toMatchObject({type:'k',color:'w'});
    expect(end.get('a7')).toMatchObject({type:'r',color:'b'});
    expect(destiny.branches.find(b=>b.id==='destiny_corner_shelter')!.expectedWhiteOutcomes).toEqual(['win','win','draw','draw']);
    const genius=studies['bGQVHlG-kwU'];
    const knight=genius.branches.find(b=>b.id==='genius_knight_c3')!;
    const promoted=replayBranch(genius,knight,1);
    expect(promoted.get('b1')).toMatchObject({type:'n',color:'b'});
    expect(promoted.isCheck()).toBe(true);
    expect(replayBranch(genius,knight,5).get('e4')).toMatchObject({type:'n',color:'b'});
    expect(genius.branches.find(b=>b.id==='genius_queen_skewer')!.expectedWhiteOutcomes).toEqual(['win','win','win','win']);
    const rooks=studies.D2XKSJ6O5fE;
    const sacrifice=rooks.branches.find(b=>b.id==='two_rooks_queen_sacrifice')!;
    expect(sacrifice.san.slice(0,5)).toEqual(['Qc3+','Rdd2','Qc1+','Rd1','Qe3+']);
    expect(replayBranch(rooks,sacrifice,6).isCheck()).toBe(true);
    expect(replayBranch(rooks,sacrifice,7).isCheck()).toBe(true);
    for(const b of rooks.branches) expect(replayBranch(rooks,b,b.san.length).isCheckmate()).toBe(true);
  });
  it('checks bishop deflection, explicit queen blocks and the knight-promotion fork',()=>{
    const bishop=studies.xsGT4DrgbuA;
    const deflection=bishop.branches.find(b=>b.id==='bishop_rook_deflection')!;
    expect(replayBranch(bishop,deflection,9).isCheck()).toBe(true);
    expect(replayBranch(bishop,deflection,11).get('b8')).toMatchObject({type:'q',color:'w'});
    const rooks=studies.cYJCZheo0tI;
    const corner=rooks.branches.find(b=>b.id==='two_rooks_corner')!;
    const beforeBlock=replayBranch(rooks,corner,5);
    expect(beforeBlock.isCheckmate()).toBe(false);
    expect(beforeBlock.moves()).toContain('Qg8');
    for(const id of ['two_rooks_corner','two_rooks_waiting_king']) {
      const b=rooks.branches.find(x=>x.id===id)!;
      expect(replayBranch(rooks,b,b.san.length).isCheckmate()).toBe(true);
    }
    const war=studies.EHhyba_Pt1M;
    const knight=war.branches.find(b=>b.id==='war_knight_promotion')!;
    const promoted=replayBranch(war,knight,7);
    expect(promoted.get('b8')).toMatchObject({type:'n',color:'w'});
    expect(promoted.isCheck()).toBe(true);
    expect(replayBranch(war,knight,9).get('d7')).toMatchObject({type:'n',color:'w'});
    const queen=war.branches.find(b=>b.id==='war_queen_error')!;
    expect(replayBranch(war,queen,4).isCheckmate()).toBe(true);
    for(const id of ['war_king_stalemate','war_queen_stalemate']) {
      const b=war.branches.find(x=>x.id===id)!;
      expect(replayBranch(war,b,1).isStalemate()).toBe(true);
    }
  });
  it('checks the queen cage, post-promotion mating defense and cleared rook corridor',()=>{
    const cage=studies.cT_6TvXP5kY;
    const caged=replayBranch(cage,cage.branches.find(b=>b.id==='zugzwang_queen_cage')!,5);
    const queenMoves=caged.moves({verbose:true}).filter(m=>m.piece==='q');
    expect(queenMoves.length).toBeGreaterThan(0);
    for(const move of queenMoves) {
      const reply=new Chess(caged.fen());
      reply.move(move);
      expect(reply.moves({verbose:true}).some(m=>m.to===move.to&&m.captured==='q')).toBe(true);
    }
    const zigzag=studies['-qJyQM0nQKE'];
    const shelter=zigzag.branches.find(b=>b.id==='zigzag_shelter')!;
    const unguarded=replayBranch(zigzag,shelter,16);
    unguarded.move('Qh1');
    unguarded.move('Rf8#');
    expect(unguarded.isCheckmate()).toBe(true);
    const guarded=replayBranch(zigzag,shelter,17);
    guarded.move('Rf8+');
    expect(guarded.moves()).toContain('Qxf8');
    const rooks=studies['Ye4Nfj-v4T8'];
    const ladder=rooks.branches.find(b=>b.id==='rooks_clear_b_file')!;
    const finish=replayBranch(rooks,ladder,ladder.san.length);
    expect(finish.isCheckmate()).toBe(true);
    expect(finish.get('a1')).toMatchObject({type:'k',color:'w'});
    expect(finish.get('b8')).toMatchObject({type:'r',color:'w'});
    expect(rooks.startContext).toContain('outside the tablebase scope');
  });
  it('checks king interference against stalemate, the two rook forks and mate after enemy promotion',()=>{
    const ladder=studies.Y8IfsumRNz0;
    const walk=ladder.branches.find(b=>b.id==='king_ladder_walk')!;
    const released=replayBranch(ladder,walk,9);
    expect(released.moves({verbose:true}).every(m=>m.piece==='n')).toBe(true);
    expect(released.moves().length).toBeGreaterThan(0);
    const stalemate=ladder.branches.find(b=>b.id==='king_ladder_stalemate')!;
    expect(replayBranch(ladder,stalemate,1).isStalemate()).toBe(true);
    expect(replayBranch(ladder,walk,walk.san.length).isCheckmate()).toBe(true);
    const fork=studies.KI966tikVxk;
    for(const id of ['rook_fork_h_rook','rook_fork_f_rook']) {
      const line=fork.branches.find(b=>b.id===id)!;
      const beforeCapture=replayBranch(fork,line,line.san.length-1);
      const capture=beforeCapture.move(line.san.at(-1)!);
      expect(capture).toMatchObject({piece:'q',captured:'r'});
    }
    const king=studies.O_sMtBAcXIU;
    const race=king.branches.find(b=>b.id==='majestic_king_mating_race')!;
    const promoted=replayBranch(king,race,14);
    expect(promoted.get('h1')).toMatchObject({type:'q',color:'b'});
    expect(promoted.isGameOver()).toBe(false);
    promoted.move('b3#');
    expect(promoted.isCheckmate()).toBe(true);
    expect(king.branches.find(b=>b.id==='majestic_king_wrong_piece')!.expectedWhiteOutcomes).toEqual(['win','win','win','win','draw','draw']);
  });
  it('checks the mating pawn fork, claimable knight repetition and Lucena bridge shelter',()=>{
    const chase=studies.eW42fqN6gxU;
    for(const id of ['pawn_chase_mating_fork','pawn_chase_defend_pawn']) {
      const line=chase.branches.find(b=>b.id===id)!;
      expect(replayBranch(chase,line,line.san.length).isCheckmate()).toBe(true);
    }
    const knight=studies.BtD4AL1cYJ8;
    expect(knight.practiceGoal).toBe('draw');
    const perpetual=knight.branches.find(b=>b.id==='cheeky_knight_perpetual')!;
    const repeated=replayBranch(knight,perpetual,perpetual.san.length);
    expect(repeated.isThreefoldRepetition()).toBe(true);
    expect(repeated.get('d1')).toMatchObject({type:'q',color:'b'});
    const lucena=studies.WDUlvMgXGjA;
    const bridge=lucena.branches.find(b=>b.id==='lucena_build_bridge')!;
    expect(replayBranch(lucena,bridge,bridge.san.length-1).isCheck()).toBe(true);
    const sheltered=replayBranch(lucena,bridge,bridge.san.length);
    expect(sheltered.isCheck()).toBe(false);
    expect(sheltered.get('c4')).toMatchObject({type:'r',color:'w'});
    expect(sheltered.get('c5')).toMatchObject({type:'k',color:'w'});
    const trade=lucena.branches.find(b=>b.id==='lucena_exchange_bridge')!;
    expect(replayBranch(lucena,trade,trade.san.length).get('c8')).toMatchObject({type:'q',color:'w'});
  });
  it('distinguishes the Genie cages and preserves the corrected queen-race draw',()=>{
    const equal=studies.sRbOlJc6Kt0;
    for(const id of ['equal_material_queen_defense','equal_material_bishop_defense','equal_material_accept_bishop']) {
      const line=equal.branches.find(b=>b.id===id)!;
      expect(replayBranch(equal,line,line.san.length).isCheckmate()).toBe(true);
    }
    const genie=studies.LSvxwy9516Y;
    expect(genie.practiceGoal).toBe('draw');
    for(const id of ['genie_first_stalemate','genie_second_stalemate','genie_third_stalemate']) {
      const line=genie.branches.find(b=>b.id===id)!;
      expect(replayBranch(genie,line,line.san.length).isStalemate()).toBe(true);
    }
    const wrong=genie.branches.find(b=>b.id==='genie_wrong_sacrifice')!;
    const escape=replayBranch(genie,wrong,wrong.san.length);
    expect(escape.isStalemate()).toBe(false);
    expect(escape.get('d2')).toMatchObject({type:'k',color:'w'});
    expect(escape.moves()).toContain('Kc1');
    const trick=studies.BBxlctESzH4;
    const rush=trick.branches.find(b=>b.id==='majestic_trick_rush_pawn')!;
    expect(rush.expectedWhiteOutcomes).toEqual(['draw','draw','draw','draw']);
    expect(trick.sourceCorrections?.some(c=>c.correction.includes('Every position'))).toBe(true);
  });
  it('distinguishes the queen fortress, premature promotion loss and rook-underpromotion escape',()=>{
    const god=studies.vBuWjYntuew;
    expect(god.practiceGoal).toBe('draw');
    const cage=god.branches.find(b=>b.id==='god_of_chess_queen_leaves')!;
    expect(replayBranch(god,cage,cage.san.length).isCheckmate()).toBe(true);
    const liquidation=god.branches.find(b=>b.id==='god_of_chess_capture_knight')!;
    expect(liquidation.expectedWhiteOutcomes).toEqual(['draw','draw']);
    const loop=studies.qrn0M_DhT0g;
    const trade=loop.branches.find(b=>b.id==='chess_loop_trade_last_pawn')!;
    expect(trade.expectedWhiteOutcomes).toEqual(['loss','loss','loss']);
    const bridge=loop.branches.find(b=>b.id==='chess_loop_knight_bridge')!;
    const block=replayBranch(loop,bridge,7);
    expect(block.get('f7')).toMatchObject({type:'n',color:'w'});
    expect(block.isCheck()).toBe(false);
    const genius=studies.jMSgNIQvsxY;
    const queen=genius.branches.find(b=>b.id==='geniality_queen_stalemate')!;
    expect(replayBranch(genius,queen,queen.san.length).isStalemate()).toBe(true);
    const rook=genius.branches.find(b=>b.id==='geniality_rook_avoids_stalemate')!;
    const escape=replayBranch(genius,rook,3);
    expect(escape.isStalemate()).toBe(false);
    expect(escape.moves()).toContain('Kb6');
    const mate=genius.branches.find(b=>b.id==='geniality_rook_promotion')!;
    expect(replayBranch(genius,mate,mate.san.length).isCheckmate()).toBe(true);
  });
  it('keeps the forced bishop cage, legal en passant stalemate and promotion deflection distinct',()=>{
    const simple=studies.S9NURjmVyYE;
    const cage=simple.branches.find(b=>b.id==='simply_queen_sacrifice')!;
    expect(replayBranch(simple,cage,7).moves()).toEqual(['Kh8']);
    expect(replayBranch(simple,cage,cage.san.length).isCheckmate()).toBe(true);
    const blunder=studies['4LbF7PdqgMo'];
    const ep=blunder.branches.find(b=>b.id==='blunder_en_passant')!;
    expect(replayBranch(blunder,ep,2).moves()).toContain('cxb6');
    const stalemate=replayBranch(blunder,ep,3);
    expect(stalemate.get('b5')).toBeUndefined();
    expect(stalemate.get('b6')).toMatchObject({type:'p',color:'w'});
    expect(stalemate.isStalemate()).toBe(true);
    const race=blunder.branches.find(b=>b.id==='blunder_correct_king')!;
    expect(replayBranch(blunder,race,race.san.length).isCheckmate()).toBe(true);
    const stop=studies['7WOsgbrR4UA'];
    const wrong=stop.branches.find(b=>b.id==='stop_pawn_rook_first')!;
    expect(replayBranch(stop,wrong,wrong.san.length).isStalemate()).toBe(true);
    for(const id of ['stop_pawn_b7_fork','stop_pawn_a7_fork']) {
      const line=stop.branches.find(b=>b.id===id)!;
      const finish=replayBranch(stop,line,line.san.length);
      expect(finish.get('b3')).toMatchObject({type:'n',color:'w'});
      expect(finish.isGameOver()).toBe(false);
      expect(line.expectedWhiteOutcomes?.every(v=>v==='win')).toBe(true);
    }
  });
  it('preserves the rook pin, checking underpromotion and promotion-tempo outcomes',()=>{
    const rook=studies['1MSXNJuwTYI'];
    const main=rook.branches.find(b=>b.id==='rook_support_pawn')!;
    expect(replayBranch(rook,main,1).moves()).not.toContain('hxg6');
    const mistake=rook.branches.find(b=>b.id==='rook_move_aside')!;
    expect(replayBranch(rook,mistake,3).moves()).toContain('hxg6');
    const capture=rook.branches.find(b=>b.id==='rook_capture_support_pawn')!;
    expect(replayBranch(rook,capture,capture.san.length).isCheckmate()).toBe(true);
    const king=studies.cIJNkLJvhAQ;
    const conversion=king.branches.find(b=>b.id==='king_zugzwang_conversion')!;
    const knightCheck=replayBranch(king,conversion,18);
    expect(knightCheck.get('a1')).toMatchObject({type:'n',color:'b'});
    expect(knightCheck.isCheck()).toBe(true);
    expect(replayBranch(king,conversion,conversion.san.length).isCheckmate()).toBe(true);
    const accept=king.branches.find(b=>b.id==='king_zugzwang_accept_queen')!;
    expect(replayBranch(king,accept,accept.san.length).isCheckmate()).toBe(true);
    const tempo=studies.QeyXfv1Mr_A;
    expect(tempo.startContext).toContain('eight-piece');
    const race=tempo.branches.find(b=>b.id==='need_time_promote')!;
    expect(replayBranch(tempo,race,3).isCheck()).toBe(true);
    const waste=tempo.branches.find(b=>b.id==='need_time_waste_tempo')!;
    expect(waste.expectedWhiteOutcomes).toEqual(['loss']);
  });
  it('compares all promotion types and checks before accepting the final bishop sacrifice',()=>{
    const majestic=studies.EJMYpkrXeEY;
    for(const id of ['majestic_bishop_queen','majestic_bishop_rook']) {
      const line=majestic.branches.find(b=>b.id===id)!;
      expect(replayBranch(majestic,line,line.san.length).isStalemate()).toBe(true);
    }
    const mate=majestic.branches.find(b=>b.id==='majestic_bishop_underpromote')!;
    expect(replayBranch(majestic,mate,mate.san.length).isCheckmate()).toBe(true);
    const doom=studies.aqTRo64n8XY;
    for(const id of ['doom_capture_too_soon','doom_queen_stalemate','doom_rook_stalemate']) {
      const line=doom.branches.find(b=>b.id===id)!;
      expect(replayBranch(doom,line,line.san.length).isStalemate()).toBe(true);
    }
    for(const id of ['doom_bishop_cage','doom_sacrifice_other_retreat']) {
      const line=doom.branches.find(b=>b.id===id)!;
      expect(replayBranch(doom,line,line.san.length).isCheckmate()).toBe(true);
    }
    const delayed=doom.branches.find(b=>b.id==='doom_sacrifice_king_retreat')!;
    const twoBishops=replayBranch(doom,delayed,delayed.san.length);
    expect(twoBishops.isStalemate()).toBe(false);
    expect(twoBishops.isCheck()).toBe(true);
    const skewer=studies.uGuB8QFS2DM;
    const diagonal=skewer.branches.find(b=>b.id==='skewer_party_diagonal')!;
    expect(replayBranch(skewer,diagonal,1).isCheck()).toBe(true);
    const endpoint=replayBranch(skewer,diagonal,diagonal.san.length);
    expect(endpoint.get('g7')).toMatchObject({type:'q',color:'w'});
    expect(endpoint.isGameOver()).toBe(false);
  });
  it('checks the forced black knight cage and distinguishes the last-rank stalemate',()=>{
    const knight=studies['h-5uLMAm6gI'];
    expect(new Chess(knight.nodes.find(n=>n.id==='start')!.fen).turn()).toBe('b');
    const cage=knight.branches.find(b=>b.id==='one_knight_pawn_cage')!;
    expect(replayBranch(knight,cage,3).moves()).toEqual(['a4']);
    expect(replayBranch(knight,cage,5).moves()).toEqual(['a5']);
    const mate=replayBranch(knight,cage,cage.san.length);
    expect(mate.isCheckmate()).toBe(true);
    expect(mate.turn()).toBe('w');
    const dancing=studies['25qmpIWSiS4'];
    const late=dancing.branches.find(b=>b.id==='dancing_late_knight_offer')!;
    expect(late.start).toBe('late_blockade');
    expect(late.classification).toContain('independent');
    expect(replayBranch(dancing,late,late.san.length).get('a8')).toMatchObject({type:'q',color:'w'});
    const rook=studies.Q7NUB2ggRTE;
    const queen=rook.branches.find(b=>b.id==='last_rank_queen_stalemate')!;
    expect(replayBranch(rook,queen,queen.san.length).isStalemate()).toBe(true);
    const capture=rook.branches.find(b=>b.id==='last_rank_rook_capture')!;
    const escape=replayBranch(rook,capture,3);
    expect(escape.isStalemate()).toBe(false);
    expect(escape.moves()).toContain('Ka2');
  });
  it('preserves the corrected opposition retreat and distinguishes bishop forks from pins',()=>{
    const opposition=studies['80mVCDOVvLw'];
    expect(opposition.practiceGoal).toBe('draw');
    const hold=opposition.branches.find(b=>b.id==='opposition_pawn_sacrifice')!;
    expect(hold.san[0]).toBe('Ka2');
    expect(opposition.sourceCorrections?.some(c=>c.correction.includes('Ka2'))).toBe(true);
    const skewer=opposition.branches.find(b=>b.id==='opposition_wrong_retreat')!;
    expect(skewer.expectedWhiteOutcomes?.every(x=>x==='loss')).toBe(true);
    const bishops=studies.cFbQM4lbfDw;
    const fork=bishops.branches.find(b=>b.id==='bishop_rook_fork_net')!;
    expect(replayBranch(bishops,fork,fork.san.length).isCheck()).toBe(true);
    const pin=bishops.branches.find(b=>b.id==='bishop_rook_pin_net')!;
    expect(replayBranch(bishops,pin,9).isCheck()).toBe(false);
    const trap=bishops.branches.find(b=>b.id==='bishop_rook_capture_stalemate')!;
    expect(replayBranch(bishops,trap,trap.san.length).isStalemate()).toBe(true);
    const sacs=studies.CCcJU3wI_uw;
    const corner=sacs.branches.find(b=>b.id==='rook_sacs_bishop_corner')!;
    expect(replayBranch(sacs,corner,corner.san.length).isCheck()).toBe(true);
    expect(replayBranch(sacs,corner,corner.san.length).isCheckmate()).toBe(false);
    const capture=sacs.branches.find(b=>b.id==='rook_sacs_bishop_center')!;
    const won=replayBranch(sacs,capture,capture.san.length);
    expect(won.get('e4')).toMatchObject({type:'r',color:'w'});
    expect(won.isGameOver()).toBe(false);
  });
  it('distinguishes the rook blockade draw from its later loss and the two promotion defenses',()=>{
    const rooks=studies.iDC8o_fKF_A;
    expect(rooks.nodes.find(n=>n.id==='start')?.fen.split(' ')[1]).toBe('b');
    const passive=rooks.branches.find(b=>b.id==='rooks_passive_blockade')!;
    expect(passive.expectedWhiteOutcomes?.slice(0,3)).toEqual(['draw','draw','win']);
    const queen=rooks.branches.find(b=>b.id==='rooks_queen_mate')!;
    expect(replayBranch(rooks,queen,2).isCheckmate()).toBe(true);
    const knight=rooks.branches.find(b=>b.id==='rooks_knight_defense')!;
    expect(replayBranch(rooks,knight,2).isCheckmate()).toBe(false);
    expect(replayBranch(rooks,knight,3).isCheck()).toBe(true);
    const unpin=studies.OEjQaAhytJU;
    const finish=unpin.branches.find(b=>b.id==='unpin_mating_net')!;
    expect(replayBranch(unpin,finish,finish.san.length).isCheckmate()).toBe(true);
    const sacrifice=studies['4d-RDOFwYxE'];
    for(const id of ['pretty_queen_capture','pretty_king_capture']) {
      const b=sacrifice.branches.find(b=>b.id===id)!;
      expect(replayBranch(sacrifice,b,b.san.length).isCheckmate()).toBe(true);
    }
  });
  it('preserves pawn tempi, the promotion-check diagonal and the knight mating cage',()=>{
    const surgery=studies.d1XnlGta7RQ;
    const tempo=surgery.branches.find(b=>b.id==='surgery_single_step')!;
    const kingAhead=replayBranch(surgery,tempo,tempo.san.length);
    expect(kingAhead.get('h5')).toMatchObject({type:'k',color:'b'});
    expect(kingAhead.get('g6')).toMatchObject({type:'p',color:'b'});
    const corner=surgery.branches.find(b=>b.id==='surgery_rook_pawn_draw')!;
    expect(replayBranch(surgery,corner,corner.san.length).isStalemate()).toBe(true);
    const mystery=studies.a1ZO2NxzQC4;
    const check=mystery.branches.find(b=>b.id==='mysterious_checking_promotion')!;
    const blocked=mystery.branches.find(b=>b.id==='mysterious_wrong_king')!;
    expect(replayBranch(mystery,check,11).isCheck()).toBe(true);
    expect(replayBranch(mystery,blocked,11).isCheck()).toBe(false);
    const cage=studies.ORZ3TeYPA0s;
    const mate=cage.branches.find(b=>b.id==='draw_title_board_win')!;
    const forcedPawn=replayBranch(cage,mate,23);
    expect(forcedPawn.moves()).toEqual(['a2']);
    expect(replayBranch(cage,mate,mate.san.length).isCheckmate()).toBe(true);
    const wrong=cage.branches.find(b=>b.id==='draw_title_queen_error')!;
    const interposition=replayBranch(cage,wrong,6);
    expect(interposition.isCheckmate()).toBe(false);
    expect(interposition.moves()).toEqual(['Qh4']);
    expect(replayBranch(cage,wrong,wrong.san.length).isCheckmate()).toBe(true);
    expect(cage.startContext).toContain('clock adjudication');
  });
  it('checks the forced pawn mate, disclosed late fork and c3 diagonal clearance',()=>{
    const pawn=studies.ra1vMgHzI7E;
    const mate=pawn.branches.find(b=>b.id==='majenius_pawn_mate')!;
    expect(replayBranch(pawn,mate,1).moves()).toEqual(['g5']);
    expect(replayBranch(pawn,mate,3).moves()).toEqual(['g4']);
    expect(replayBranch(pawn,mate,mate.san.length).isCheckmate()).toBe(true);
    const fork=studies.SDnEvwUw_2I;
    expect(fork.startContext).toContain('after ...Qxd7');
    for(const b of fork.branches) {
      const end=replayBranch(fork,b,b.san.length);
      expect(end.get('d7')).toMatchObject({type:'n',color:'w'});
      expect(end.isGameOver()).toBe(false);
    }
    const run=studies.UCjPg3M52_c;
    const opening=run.branches.find(b=>b.id==='run_opening_cage')!;
    const initial=replayBranch(run,opening,0);
    expect(initial.get('c3')).toMatchObject({type:'p',color:'w'});
    expect(initial.get('b3')).toBeUndefined();
    const cleared=replayBranch(run,opening,opening.san.length);
    expect(cleared.get('c3')).toMatchObject({type:'k',color:'b'});
    const late=run.branches.find(b=>b.id==='run_queen_deflection')!;
    const promotion=replayBranch(run,late,1);
    expect(promotion.get('h8')).toMatchObject({type:'q',color:'w'});
    expect(promotion.get('c3')).toBeUndefined();
    const early=run.branches.find(b=>b.id==='run_hasty_pawn')!;
    expect(early.expectedWhiteOutcomes?.slice(0,3)).toEqual(['draw','draw','loss']);
  });
  it('checks the drawing king tempi, rook diversion and two Sphinx mating diagonals',()=>{
    const drawing=studies.mfn7tyrzIl0;
    expect(drawing.practiceGoal).toBe('draw');
    const race=drawing.branches.find(b=>b.id==='genius_draw_double_purpose')!;
    expect(replayBranch(drawing,race,race.san.length).isInsufficientMaterial()).toBe(true);
    const early=drawing.branches.find(b=>b.id==='genius_draw_black_capture_error')!;
    expect(early.expectedWhiteOutcomes?.at(-1)).toBe('draw');
    const held=drawing.branches.find(b=>b.id==='genius_draw_push_early')!;
    expect(held.expectedWhiteOutcomes?.at(-1)).toBe('loss');
    const reverse=studies.C4QxiMxyvu4;
    const route=reverse.branches.find(b=>b.id==='reverse_rook_maneuver')!;
    expect(replayBranch(reverse,route,6).get('f4')).toMatchObject({type:'r',color:'b'});
    expect(replayBranch(reverse,route,route.san.length).isCheckmate()).toBe(true);
    const sphinx=studies.Z_gpAfsRlT4;
    expect(sphinx.startContext).toContain('eight-piece');
    for(const b of sphinx.branches) expect(replayBranch(sphinx,b,b.san.length).isCheckmate()).toBe(true);
    const lower=sphinx.branches.find(b=>b.id==='sphinx_lower_mate')!;
    expect(replayBranch(sphinx,lower,6).get('a3')).toMatchObject({type:'k',color:'b'});
  });
  it('preserves the rook recapture, knight file diversion and renewed passed-pawn mates',()=>{
    const walk=studies['0VgsWYIUc14'];
    const line=walk.branches.find(b=>b.id==='fools_rook_file_switch')!;
    expect(replayBranch(walk,line,25).get('f6')).toMatchObject({type:'n',color:'w'});
    expect(replayBranch(walk,line,26).get('f6')).toMatchObject({type:'r',color:'b'});
    expect(replayBranch(walk,line,line.san.length).get('e8')).toMatchObject({type:'q',color:'w'});
    const draw=walk.branches.find(b=>b.id==='fools_wrong_first_king')!;
    const exchange=replayBranch(walk,draw,3);
    expect(exchange.get('h1')).toMatchObject({type:'k',color:'w'});
    expect(exchange.board().flat().filter(p=>p?.type==='r')).toHaveLength(0);
    const trap=studies.I9tZdd_mkOk;
    for(const b of trap.branches) {
      expect(replayBranch(trap,b,3).isCheck()).toBe(true);
      expect(replayBranch(trap,b,b.san.length).board().flat().filter(p=>p?.type==='r')).toHaveLength(0);
    }
    const pawn=studies.pdUB7oIOA3I;
    const stale=pawn.branches.find(b=>b.id==='puzzle_premature_pawn')!;
    expect(replayBranch(pawn,stale,1).isStalemate()).toBe(true);
    for(const id of ['puzzle_capture_conversion','puzzle_king_declines_exchange']) {
      const b=pawn.branches.find(b=>b.id===id)!;
      expect(replayBranch(pawn,b,b.san.length).isCheckmate()).toBe(true);
    }
  });
  it('distinguishes capture-promotion pawns, forced knight mate and rook zugzwang',()=>{
    const deception=studies.xox3omHNHAU;
    const mate=deception.branches.find(b=>b.id==='deception_knight_mate')!;
    expect(replayBranch(deception,mate,3).isCheckmate()).toBe(true);
    const good=deception.branches.find(b=>b.id==='deception_bishop_taken')!;
    expect(replayBranch(deception,good,3).get('d7')).toMatchObject({type:'p',color:'w'});
    expect(good.expectedWhiteOutcomes?.at(-1)).toBe('win');
    const wrong=deception.branches.find(b=>b.id==='deception_wrong_capture')!;
    expect(replayBranch(deception,wrong,3).get('f7')).toMatchObject({type:'p',color:'w'});
    expect(wrong.expectedWhiteOutcomes?.at(-1)).toBe('draw');
    const domain=studies.ZtuflqpLiyE;
    const queen=domain.branches.find(b=>b.id==='domain_queen')!;
    expect(replayBranch(domain,queen,1).isStalemate()).toBe(true);
    const bishop=domain.branches.find(b=>b.id==='domain_bishop')!;
    expect(replayBranch(domain,bishop,bishop.san.length).isCheckmate()).toBe(true);
    const zug=studies.sAGoBjAasgo;
    for(const b of zug.branches) expect(replayBranch(zug,b,b.san.length).isCheckmate()).toBe(true);
    const pawn=zug.branches.find(b=>b.id==='zug_king')!;
    expect(pawn.classification).toContain('independently');
    expect(replayBranch(zug,pawn,7).get('g2')).toMatchObject({type:'r',color:'w'});
    expect(replayBranch(zug,pawn,7).board().flat().filter(p=>p?.type==='p')).toHaveLength(1);
  });
  it('checks physical-board quiet zugzwang, both rook captures and the queen windmill skewer',()=>{
    const zug=studies['8wSn9DPtxdQ'];
    const quiet=zug.branches.find(b=>b.id==='zugzwangs_quiet_king')!;
    expect(replayBranch(zug,quiet,5).get('a4')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(zug,quiet,7).isCheckmate()).toBe(true);
    for(const id of ['zugzwangs_check_too_soon','zugzwangs_knight_check'])
      expect(zug.branches.find(b=>b.id===id)?.expectedWhiteOutcomes?.at(-1)).toBe('draw');
    const offer=studies.Zw_zmN2wr1E;
    expect(offer.nodes.find(n=>n.id==='start')?.fen).toContain('1R3K1k');
    for(const b of offer.branches) expect(replayBranch(offer,b,b.san.length).isCheckmate()).toBe(true);
    const wind=studies.NicicZNLEE4;
    const line=wind.branches.find(b=>b.id==='windmill_skewer')!;
    const before=replayBranch(wind,line,13);
    expect(before.isCheck()).toBe(true);
    expect(before.get('g7')).toMatchObject({type:'q',color:'w'});
    expect(before.get('a1')).toMatchObject({type:'q',color:'b'});
    const after=replayBranch(wind,line,15);
    expect(after.get('a1')).toMatchObject({type:'q',color:'w'});
    expect(after.board().flat().filter(p=>p?.color==='b'&&p.type==='q')).toHaveLength(0);
    expect(line.expectedWhiteOutcomes?.at(-1)).toBe('win');
  });
  it('checks the bishop sacrifice zugzwang, complete blockade and separate rook-sacrifice diagrams',()=>{
    const wait=studies.zEhmif05DMM;
    const line=wait.branches.find(b=>b.id==='wait_pawn_zugzwang')!;
    const zug=replayBranch(wait,line,3);
    expect(zug.turn()).toBe('b');
    expect(zug.get('f4')).toMatchObject({type:'p',color:'w'});
    expect(zug.get('f5')).toMatchObject({type:'p',color:'b'});
    expect(replayBranch(wait,line,5).get('f5')).toMatchObject({type:'k',color:'w'});
    for(const id of ['wait_capture_too_soon','wait_retreat'])
      expect(wait.branches.find(b=>b.id===id)?.expectedWhiteOutcomes?.at(-1)).toBe('draw');
    const block=studies.s7QODDUiDqg;
    const route=block.branches.find(b=>b.id==='blockade_complete_route')!;
    const trapped=replayBranch(block,route,21);
    expect(trapped.get('h3')).toMatchObject({type:'b',color:'w'});
    expect(trapped.get('h4')).toMatchObject({type:'p',color:'b'});
    expect(trapped.moves().every(m=>m.startsWith('K'))).toBe(true);
    expect(replayBranch(block,route,25).get('a8')).toMatchObject({type:'q',color:'w'});
    const seconds=studies.ttlfzj6o0Y4;
    const mate=seconds.branches.find(b=>b.id==='seconds_pawn_taken')!;
    expect(replayBranch(seconds,mate,1).isCheckmate()).toBe(true);
    const promote=seconds.branches.find(b=>b.id==='seconds_rook_taken')!;
    expect(replayBranch(seconds,promote,2).get('h6')).toMatchObject({type:'r',color:'b'});
    expect(replayBranch(seconds,promote,3).get('a8')).toMatchObject({type:'q',color:'w'});
    const defense=seconds.branches.find(b=>b.id==='seconds_rook_defense')!;
    expect(replayBranch(seconds,defense,2).get('b8')).toMatchObject({type:'q',color:'w'});
  });
  it('distinguishes the pawn-race tempo, unique final king escape and changed queen-check defense',()=>{
    const dance=studies.X0dnvckGjnM;
    const race=dance.branches.find(b=>b.id==='dance_pawn_race')!;
    expect(replayBranch(dance,race,14).get('h1')).toMatchObject({type:'q',color:'b'});
    expect(replayBranch(dance,race,15).get('h1')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(dance,race,19).get('c8')).toMatchObject({type:'q',color:'w'});
    const early=dance.branches.find(b=>b.id==='dance_earlier_king')!;
    expect(early.expectedWhiteOutcomes?.at(-1)).toBe('loss');
    const escape=studies['0FooOVegVZY'];
    const route=escape.branches.find(b=>b.id==='majestic_final_escape')!;
    const end=replayBranch(escape,route,3);
    expect(end.get('h6')).toMatchObject({type:'k',color:'w'});
    expect(end.get('a6')).toMatchObject({type:'p',color:'b'});
    for(const id of ['majestic_wrong_file','majestic_wrong_edge'])
      expect(escape.branches.find(b=>b.id===id)?.expectedWhiteOutcomes?.at(-1)).toBe('draw');
    const fest=studies.cLszVcNXxEw;
    const main=fest.branches.find(b=>b.id==='fest_final_offers')!;
    expect(replayBranch(fest,main,5).isCheck()).toBe(true);
    expect(replayBranch(fest,main,7).get('b2')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(fest,main,11).get('b8')).toMatchObject({type:'q',color:'w'});
    const wrong=fest.branches.find(b=>b.id==='fest_king_f4')!;
    expect(wrong.san.at(-1)).toBe('Ke5');
    expect(wrong.expectedWhiteOutcomes).toEqual(['win','win','draw','draw']);
  });
  it('checks the paired pin forks, promotion-skewer alignment and final stalemate contrast',()=>{
    const pin=studies.lk21tbSEDTA;
    for(const [id,square] of [['majestic_pin_d3','d3'],['majestic_pin_e8','e8']]) {
      const branch=pin.branches.find(b=>b.id===id)!;
      expect(replayBranch(pin,branch,3).isCheck()).toBe(true);
      expect(replayBranch(pin,branch,5).get(square as 'd3'|'e8')).toMatchObject({type:'n',color:'w'});
      expect(branch.expectedWhiteOutcomes?.at(-1)).toBe('win');
    }
    const pawn=studies['bP2-AqGa1II'];
    const skewer=pawn.branches.find(b=>b.id==='stop_diagonal_skewer')!;
    expect(replayBranch(pawn,skewer,3).isCheck()).toBe(true);
    expect(replayBranch(pawn,skewer,5).get('h1')).toMatchObject({type:'q',color:'w'});
    const wrong=pawn.branches.find(b=>b.id==='stop_wrong_alignment')!;
    expect(replayBranch(pawn,wrong,3).isCheck()).toBe(false);
    expect(replayBranch(pawn,wrong,4).get('b1')).toMatchObject({type:'q',color:'b'});
    expect(wrong.expectedWhiteOutcomes?.at(-1)).toBe('loss');
    const promotions=studies.Df1mNH3I580;
    const rook=promotions.branches.find(b=>b.id==='thousand_rook_capture')!;
    const queen=promotions.branches.find(b=>b.id==='thousand_queen_stalemate')!;
    const afterRook=replayBranch(promotions,rook,1);
    expect(afterRook.isStalemate()).toBe(false);
    expect(afterRook.moves()).toEqual(expect.arrayContaining(['Ke2','Kf3']));
    expect(replayBranch(promotions,queen,1).isStalemate()).toBe(true);
    expect(queen.expectedWhiteOutcomes).toEqual(['draw']);
  });
  it('checks the promotion cage mates, bishop-capture stalemate contrast and Black pawn-ending objective',()=>{
    const precious=studies.KrMCtbeC9g8;
    for(const id of ['precious_dovetail','precious_queen_block']){
      const branch=precious.branches.find(b=>b.id===id)!;
      expect(replayBranch(precious,branch,branch.san.length).isCheckmate()).toBe(true);
    }
    expect(precious.branches.find(b=>b.id==='precious_wrong_promotion')?.expectedWhiteOutcomes?.at(-1)).toBe('loss');
    const triple=studies['5Vtak-jqzVM'];
    const bishop=triple.branches.find(b=>b.id==='triple_bishop_capture')!;
    const queen=triple.branches.find(b=>b.id==='triple_queen_capture')!;
    expect(replayBranch(triple,bishop,1).moves()).toContain('Kb4');
    expect(replayBranch(triple,bishop,1).isStalemate()).toBe(false);
    expect(replayBranch(triple,queen,1).isStalemate()).toBe(true);
    const ending=studies.JG5qrUG8r0Y;
    expect(ending.practiceGoal).toBe('win');
    expect(ending.nodes.find(n=>n.id==='start')?.fen.split(' ')[1]).toBe('b');
    const conversion=ending.branches.find(b=>b.id==='sacrifices_king_conversion')!;
    expect(replayBranch(ending,conversion,15).get('f1')).toMatchObject({type:'q',color:'b'});
    expect(conversion.expectedWhiteOutcomes?.at(-1)).toBe('loss');
    expect(ending.branches.find(b=>b.id==='sacrifices_pawn_tempo')?.expectedWhiteOutcomes).toEqual(['draw']);
    expect(ending.branches.find(b=>b.id==='sacrifices_check_error')?.expectedWhiteOutcomes).toEqual(['win']);
  });
  it('distinguishes the second pawn sacrifice from automatic exchanges and the final unpinned knight mate',()=>{
    const breakthrough=studies['v-0WoMLKBHw'];
    const main=breakthrough.branches.find(b=>b.id==='breakthrough_second_sacrifice')!;
    expect(replayBranch(breakthrough,main,7).get('a8')).toMatchObject({type:'q',color:'w'});
    expect(breakthrough.branches.find(b=>b.id==='breakthrough_wrong_recaptures')?.expectedWhiteOutcomes).toEqual(['loss']);
    const wall=breakthrough.branches.find(b=>b.id==='breakthrough_drawn_wall')!;
    expect(wall.expectedWhiteOutcomes).toEqual(['loss','draw','draw']);
    const blocked=replayBranch(breakthrough,wall,3);
    expect(blocked.get('b6')).toMatchObject({type:'p',color:'w'});
    expect(blocked.get('b7')).toMatchObject({type:'p',color:'b'});
    const staircase=studies['UvT1rf-4o5Q'];
    const mate=staircase.branches.find(b=>b.id==='staircase_final_mate')!;
    expect(replayBranch(staircase,mate,1).isCheckmate()).toBe(true);
    expect(replayBranch(staircase,mate,1).get('g8')).toMatchObject({type:'n',color:'b'});
    for(const id of ['staircase_wrong_knight','staircase_material_error'])
      expect(staircase.branches.find(b=>b.id===id)?.expectedWhiteOutcomes).toEqual(['loss']);
  });
  it('checks king-capture order, the underpromotion aftermath and the wrong-bishop barrier',()=>{
    const race=studies['8RW-RPF99Dg'];
    const main=race.branches.find(b=>b.id==='draws_king_race')!;
    expect(replayBranch(race,main,3).get('h3')).toMatchObject({type:'k',color:'w'});
    expect(replayBranch(race,main,7).get('g5')).toMatchObject({type:'k',color:'w'});
    expect(race.branches.find(b=>b.id==='draws_wrong_capture_order')?.expectedWhiteOutcomes).toEqual(['win','win','draw']);
    const genie=studies['6wmsqLbzL5Q'];
    expect(genie.branches.find(b=>b.id==='genie_wrong_capture')?.expectedWhiteOutcomes).toEqual(['draw']);
    expect(replayBranch(genie,genie.branches.find(b=>b.id==='genie_queen_stalemate')!,1).isStalemate()).toBe(true);
    const barrier=studies['K99sSZx-92c'];
    expect(barrier.nodes.find(n=>n.id==='start')?.fen.split(' ')[1]).toBe('b');
    const blocked=replayBranch(barrier,barrier.branches.find(b=>b.id==='wrong_bishop_barrier')!,3);
    expect(blocked.get('h2')).toMatchObject({type:'b',color:'b'});
    expect(blocked.get('h3')).toMatchObject({type:'p',color:'b'});
    expect(barrier.branches.find(b=>b.id==='wrong_bishop_early_push')?.expectedWhiteOutcomes).toEqual(['draw','draw','draw','draw']);
    expect(replayBranch(barrier,barrier.branches.find(b=>b.id==='wrong_bishop_take_offer')!,5).get('h1')).toMatchObject({type:'q',color:'b'});
  });
  it('checks the rook-sacrifice king walk, pawn mate and the quiet king en-passant contrast',()=>{
    const walk=studies['P58fTC6d3_M'];
    const main=walk.branches.find(b=>b.id==='geniuses_king_walk')!;
    const mate=replayBranch(walk,main,21);
    expect(mate.isCheckmate()).toBe(true);
    expect(mate.get('g8')).toMatchObject({type:'b',color:'b'});
    expect(main.san[13]).toBe('Rg4+');
    expect(walk.branches.find(b=>b.id==='geniuses_accept_early_rook')?.expectedWhiteOutcomes).toEqual(['win','win','win','win','draw','draw','draw','draw']);
    const pawns=studies['oFOyScHk_Ro'];
    for(const id of ['majestic_pawn_mate','majestic_knight_promotion'])
      expect(replayBranch(pawns,pawns.branches.find(b=>b.id===id)!,3).isCheckmate()).toBe(true);
    const quiet=studies['Rb8rgsHOeZY'];
    expect(replayBranch(quiet,quiet.branches.find(b=>b.id==='majestic_quiet_king')!,9).isCheckmate()).toBe(true);
    const ep=replayBranch(quiet,quiet.branches.find(b=>b.id==='majestic_en_passant')!,7);
    expect(ep.get('c3')).toMatchObject({type:'b',color:'w'});
    expect(ep.get('c4')).toBeUndefined();
    expect(ep.get('d3')).toMatchObject({type:'p',color:'w'});
    expect(quiet.sourceCorrections?.length).toBeGreaterThan(0);
  });
  it('distinguishes h6 from pawn races and checks both sides of the attraction fork',()=>{
    const tricky=studies['dqzv6GtbHPI'];
    const race=tricky.branches.find(b=>b.id==='tricky_two_step_error')!;
    const queens=replayBranch(tricky,race,14);
    expect(queens.get('h1')).toMatchObject({type:'q',color:'b'});
    expect(queens.get('g8')).toMatchObject({type:'q',color:'w'});
    const capture=tricky.branches.find(b=>b.id==='tricky_capture_error')!;
    expect(capture.san[1]).toBe('Kf4');
    expect(capture.expectedWhiteOutcomes).toEqual(['draw','draw','draw','draw']);
    const attraction=studies['cYXGqMq9JSg'];
    const fork=attraction.branches.find(b=>b.id==='attraction_queen_fork')!;
    const won=replayBranch(attraction,fork,11);
    expect(won.get('d6')).toMatchObject({type:'n',color:'b'});
    expect(attraction.branches.find(b=>b.id==='attraction_wrong_discovered_check')?.expectedWhiteOutcomes).toEqual(['loss','loss','win','win']);
    expect(attraction.branches.find(b=>b.id==='attraction_wrong_king_escape')?.expectedWhiteOutcomes).toEqual(['loss','loss','win','loss']);
    const dummies=studies['v_aWkyFdqgw'];
    expect(replayBranch(dummies,dummies.branches.find(b=>b.id==='dummies_final_fork')!,3).get('f4')).toMatchObject({type:'n',color:'w'});
  });
  it('checks the obstructed-king pawn race and the cost of a lost tempo',()=>{
    const unity=studies['6oZpLtZgBCA'];
    const race=unity.branches.find(b=>b.id==='unity_barrier_race')!;
    const promoted=replayBranch(unity,race,7);
    expect(promoted.get('a8')).toMatchObject({type:'q',color:'w'});
    expect(promoted.get('b6')).toMatchObject({type:'k',color:'b'});
    expect(promoted.get('c6')).toMatchObject({type:'p',color:'b'});
    expect(promoted.get('d6')).toMatchObject({type:'p',color:'b'});
    const free=unity.branches.find(b=>b.id==='unity_free_square_tempo')!;
    expect(replayBranch(unity,free,7).get('a8')).toMatchObject({type:'q',color:'w'});
    expect(free.expectedWhiteOutcomes).toEqual(Array(7).fill('win'));
    const delayed=unity.branches.find(b=>b.id==='unity_delayed_race')!;
    const caught=replayBranch(unity,delayed,8);
    expect(caught.get('a7')).toMatchObject({type:'k',color:'b'});
    expect(caught.board().flat().filter(p=>p?.color==='w')).toHaveLength(1);
    expect(delayed.expectedWhiteOutcomes).toEqual(Array(8).fill('loss'));
    expect(unity.startContext).toContain('earlier larger setup');
  });
  it('preserves the knight reserve tempo and the bishop-promotion stalemate contrast',()=>{
    const mistake=studies['bHugS1sPKrk'];
    const reserve=mistake.branches.find(b=>b.id==='mistake_reserve_tempo')!;
    expect(reserve.commentary?.[12]).toMatch(/^g1=N/);
    expect(reserve.commentary?.[13]).toMatch(/^Ke3/);
    const caged=replayBranch(mistake,reserve,13);
    expect(caged.get('e3')).toMatchObject({type:'k',color:'w'});
    expect(caged.get('d3')).toMatchObject({type:'p',color:'w'});
    expect(caged.get('g1')).toMatchObject({type:'n',color:'b'});
    const drawn=mistake.branches.find(b=>b.id==='mistake_direct_blockade')!;
    expect(replayBranch(mistake,drawn,12).isInsufficientMaterial()).toBe(true);
    expect(mistake.branches.find(b=>b.id==='mistake_rush_after_underpromotion')?.expectedWhiteOutcomes).toEqual(['draw']);
    const domain=studies['MkFNzXUsuJk'];
    const direct=domain.branches.find(b=>b.id==='domain_direct_stalemate')!;
    expect(replayBranch(domain,direct,1).isStalemate()).toBe(true);
    const queen=domain.branches.find(b=>b.id==='domain_queen_promotion_trap')!;
    expect(replayBranch(domain,queen,3).isStalemate()).toBe(true);
    const bishop=domain.branches.find(b=>b.id==='domain_no_defense_mate')!;
    expect(replayBranch(domain,bishop,3).isCheckmate()).toBe(true);
    const fork=domain.branches.find(b=>b.id==='domain_bishop_fork')!;
    expect(replayBranch(domain,fork,11).get('d6')).toMatchObject({type:'n',color:'w'});
  });
  it('distinguishes all four promotions in the physical-board stalemate study',()=>{
    const study=studies['WZbRoPi8_A0'];
    const bishop=study.branches.find(b=>b.id==='stalemate_bishop_promotion')!;
    const open=replayBranch(study,bishop,3);
    expect(open.get('a8')).toMatchObject({type:'b',color:'w'});
    expect(open.get('f4')).toMatchObject({type:'b',color:'w'});
    expect(open.get('b8')).toBeUndefined();
    expect(open.moves().sort()).toEqual(['Kf1','Kf2']);
    expect(open.isStalemate()).toBe(false);
    const queen=study.branches.find(b=>b.id==='stalemate_queen_promotion')!;
    expect(replayBranch(study,queen,3).isStalemate()).toBe(true);
    expect(queen.expectedWhiteOutcomes).toEqual(['draw','draw','draw']);
    expect(study.branches.find(b=>b.id==='stalemate_rook_promotion')?.expectedWhiteOutcomes).toEqual(['draw','draw']);
    expect(study.branches.find(b=>b.id==='stalemate_knight_promotion')?.expectedWhiteOutcomes).toEqual(['loss','loss']);
    expect(bishop.commentary?.[3]).toContain('f1 or f2');
  });
  it('completes the final Let it Burn fork before chasing pawns or adding checks',()=>{
    const study=studies.T4behweJkCk;
    const capture=study.branches.find(b=>b.id==='burn_collect_queen')!;
    const won=replayBranch(study,capture,1);
    expect(won.get('f8')).toMatchObject({type:'n',color:'w'});
    expect(won.get('e7')).toMatchObject({type:'p',color:'b'});
    expect(outcomeLabel(capture.outcome,won.turn())).toBe('White can force a win');
    const check=study.branches.find(b=>b.id==='burn_unnecessary_check')!;
    const lost=replayBranch(study,check,2);
    expect(lost.get('f8')).toMatchObject({type:'q',color:'b'});
    expect(outcomeLabel(check.outcome,lost.turn())).toBe('Black can force a win');
    const race=study.branches.find(b=>b.id==='burn_pawn_race')!;
    const restrained=replayBranch(study,race,5);
    expect(restrained.get('f4')).toMatchObject({type:'n',color:'w'});
    expect(restrained.moves()).toContain('e3');
    expect(race.classification).toContain('independent');
    expect(study.startContext).toContain('earlier eleven-piece');
  });
  it('avoids the two-queen stalemate by leaving both checked king flights',()=>{
    const study=studies.kYJfQjr6jQk;
    expect(studySide(study)).toBe('b');
    const trap=study.branches.find(b=>b.id==='mind_source_stalemate')!;
    expect(replayBranch(study,trap,1).isStalemate()).toBe(true);
    const win=study.branches.find(b=>b.id==='mind_leave_flights')!;
    expect(replayBranch(study,win,1).moves().sort()).toEqual(['Kd4','Kd5']);
    expect(replayBranch(study,win,3).isCheckmate()).toBe(true);
    const other=study.branches.find(b=>b.id==='mind_other_flight')!;
    expect(replayBranch(study,other,3).isCheckmate()).toBe(true);
  });
  it('answers the checking bishop interposition before promoting in Best Bishop Ever',()=>{
    const study=studies.VKVv9EymXug;
    const line=study.branches.find(b=>b.id==='best_bishop_release')!;
    const checked=replayBranch(study,line,2);
    expect(checked.isCheck()).toBe(true);
    expect(checked.moves()).not.toContain('f8=Q#');
    expect(checked.moves()).toContain('Bxd4+');
    expect(replayBranch(study,line,5).isCheckmate()).toBe(true);
    const early=study.branches.find(b=>b.id==='best_bishop_early_queen')!;
    expect(early.expectedWhiteOutcomes).toEqual(['loss','loss']);
    expect(replayBranch(study,early,2).get('f8')).toMatchObject({type:'q',color:'b'});
  });
  it('collects the queen after Not a Fool underpromotion instead of losing the knight with check',()=>{
    const study=studies.qWo5Mk9dxVU;
    const good=study.branches.find(b=>b.id==='not_fool_collect')!;
    expect(replayBranch(study,good,1).get('e7')).toMatchObject({type:'n',color:'w'});
    const bad=study.branches.find(b=>b.id==='not_fool_extra_check')!;
    const end=replayBranch(study,bad,2);
    expect(end.get('d6')).toMatchObject({type:'q',color:'b'});
    expect(outcomeLabel(bad.outcome,end.turn())).toBe('Black can force a win');
  });
  it('spends the h-pawn tempo before the wrong-color bishop can attack h7',()=>{
    const study=studies.PD38arQpuvA;
    const race=study.branches.find(b=>b.id==='brave_source_race')!;
    expect(replayBranch(study,race,3).get('h8')).toMatchObject({type:'q',color:'w'});
    const capture=study.branches.find(b=>b.id==='brave_wasted_capture')!;
    expect(capture.expectedWhiteOutcomes).toEqual(['draw','draw','draw','draw']);
    expect(replayBranch(study,capture,4).get('h7')).toMatchObject({type:'b',color:'b'});
    const mate=study.branches.find(b=>b.id==='brave_pawn_mate')!;
    expect(mate.start).toBe('pawn_mate');
    const final=replayBranch(study,mate,1);
    expect(final.isCheckmate()).toBe(true);
    expect(final.get('a8')).toMatchObject({type:'q',color:'b'});
    expect(final.get('a6')).toMatchObject({type:'b',color:'b'});
    expect(study.startContext).toContain('not joined');
  });
  it('uses the c6 knight to cover the empty b8 flight in Majestic King Cage',()=>{
    const study=studies['Bv_-tqFjB5g'];
    const line=study.branches.find(b=>b.id==='king_cage_smother')!;
    const mate=replayBranch(study,line,1);
    expect(mate.isCheckmate()).toBe(true);
    expect(mate.get('b8')).toBeUndefined();
    expect(mate.isAttacked('b8','w')).toBe(true);
    expect(mate.get('a6')).toMatchObject({type:'q',color:'b'});
    const error=study.branches.find(b=>b.id==='king_cage_take_queen')!;
    const lost=replayBranch(study,error,2);
    expect(lost.get('a6')).toMatchObject({type:'k',color:'b'});
    expect(outcomeLabel(error.outcome,lost.turn())).toBe('Black can force a win');
  });
  it('separates Gukesh’s played finish from the illustrative knight sacrifice and the premature pawn push',()=>{
    const study=studies['2IIIWJhQaCs'];
    const main=study.branches.find(b=>b.id==='gukesh_knight_coordination')!;
    expect(replayBranch(study,main,3).isCheck()).toBe(true);
    expect(replayBranch(study,main,5).get('f4')).toMatchObject({type:'k',color:'w'});
    expect(main.commentary![5]).toContain('resigned');
    const defended=replayBranch(study,main,7);
    expect(defended.get('e3')).toMatchObject({type:'n',color:'w'});
    expect(defended.isAttacked('e3','w')).toBe(true);
    expect(replayBranch(study,main,8).get('d1')).toMatchObject({type:'q',color:'b'});
    expect(replayBranch(study,main,9).get('d1')).toMatchObject({type:'n',color:'w'});
    const mistake=study.branches.find(b=>b.id==='gukesh_push_too_soon')!;
    expect(mistake.outcome).toBe('draw');
    expect(replayBranch(study,mistake,2).get('a4')).toMatchObject({type:'n',color:'w'});
    const race=study.branches.find(b=>b.id==='gukesh_finish_race')!;
    expect(replayBranch(study,race,4).get('b3')).toMatchObject({type:'k',color:'b'});
    expect(replayBranch(study,race,5).get('h8')).toMatchObject({type:'q',color:'w'});
  });

  it('keeps the pawn-mate cage intact instead of chasing Black’s promotion',()=>{
    const study=studies.GtrZQxgjtbA;
    const race=study.branches.find(b=>b.id==='majestic_pawn_mate_race')!;
    expect(replayBranch(study,race,1).moves()).toEqual(['b2']);
    const queen=replayBranch(study,race,4);
    expect(queen.get('b1')).toMatchObject({type:'q',color:'b'});
    expect(replayBranch(study,race,5).isCheckmate()).toBe(true);
    const under=study.branches.find(b=>b.id==='majestic_underpromotion_cage')!;
    expect(replayBranch(study,under,5).isCheckmate()).toBe(true);
    const error=study.branches.find(b=>b.id==='majestic_release_cage')!;
    expect(error.expectedWhiteOutcomes).toEqual(['loss','loss']);
    expect(replayBranch(study,error,1).moves()).toContain('Kc8');
  });

  it('chooses the pawn whose defender is obstructed after the interference captures',()=>{
    const study=studies.q_gpX86BWIY;
    const rook=study.branches.find(b=>b.id==='interference_rook_blocks_bishop')!;
    expect(replayBranch(study,rook,1).get('a8')).toMatchObject({type:'q',color:'w'});
    const bishop=study.branches.find(b=>b.id==='interference_bishop_blocks_rook')!;
    expect(replayBranch(study,bishop,1).get('d8')).toMatchObject({type:'q',color:'w'});
    const wrongD=study.branches.find(b=>b.id==='interference_wrong_d_pawn')!;
    const checked=replayBranch(study,wrongD,2);
    expect(checked.isCheck()).toBe(true);
    expect(checked.moves()).not.toContain('a8=Q');
    const wrongA=study.branches.find(b=>b.id==='interference_wrong_a_pawn')!;
    expect(replayBranch(study,wrongA,4).get('d8')).toMatchObject({type:'r',color:'b'});
    expect(wrongA.expectedWhiteOutcomes).toEqual(['loss','loss','loss','loss']);
  });

  it('imports source corrections as visible nonempty explanation records',()=>{
    for(const study of Object.values(studies)) for(const correction of study.sourceCorrections ?? []) {
      expect(typeof correction.correction,study.video_id).toBe('string');
      expect(correction.correction.trim().length,study.video_id).toBeGreaterThan(15);
    }
    expect(studies['2IIIWJhQaCs'].sourceCorrections![0].correction).toContain('not played');
  });

  it('finishes the Mega Fork by checking on the diagonal to the passed pawn',()=>{
    const study=studies.Pfjq0YMm3pM;
    const queen=study.branches.find(b=>b.id==='mega_queen_stops_pawn')!;
    expect(replayBranch(study,queen,3).isCheck()).toBe(true);
    const end=replayBranch(study,queen,5);
    expect(end.get('e2')).toMatchObject({type:'q',color:'w'});
    expect(end.get('f6')).toMatchObject({type:'p',color:'b'});
    const rook=study.branches.find(b=>b.id==='mega_insufficient_underpromotion')!;
    expect(rook.outcome).toBe('draw');
  });

  it('captures without stalemate after the bishop disappears and answers the h-pawn check',()=>{
    const study=studies.fqEUtaihZwc;
    const source=study.branches.find(b=>b.id==='last_title_take_queen')!;
    const root=replayBranch(study,source,0);
    expect(root.isCheck()).toBe(true);
    expect(root.moves()).toEqual(['Rxe4']);
    const capture=replayBranch(study,source,1);
    expect(capture.isStalemate()).toBe(false);
    expect(capture.moves().sort()).toEqual(['Kg1','Kg2','Kh1']);
    const pawn=study.branches.find(b=>b.id==='last_title_pawn_check')!;
    expect(replayBranch(study,pawn,4).isCheck()).toBe(true);
    expect(replayBranch(study,pawn,9).isCheckmate()).toBe(true);
    const king=study.branches.find(b=>b.id==='last_title_king_coordination')!;
    expect(replayBranch(study,king,5).isCheckmate()).toBe(true);
  });

  it('forces the remaining defender onto c8 after either Parallel Universes capture',()=>{
    const study=studies.sBWGEWzYc3A;
    for(const [id,block] of [['parallel_rook_capture_mate','Qc8'],['parallel_queen_capture_mate','Rc8']]) {
      const line=study.branches.find(b=>b.id===id)!;
      expect(replayBranch(study,line,1).moves()).toEqual([block]);
      const mate=replayBranch(study,line,3);
      expect(mate.isCheckmate()).toBe(true);
      expect(mate.get('a7')).toMatchObject({type:'p',color:'b'});
      expect(mate.get('b7')).toMatchObject({type:'p',color:'b'});
    }
    for(const id of ['parallel_rook_capture_retreat','parallel_queen_capture_retreat'])
      expect(study.branches.find(b=>b.id===id)!.expectedWhiteOutcomes).toEqual(['loss','loss']);
  });

  it('keeps legal winning-move proofs distinct from direct tablebase root results',()=>{
    for(const id of ['96UmAkk8h2w','VQVcI84wcH4','bFZUupcjQiU','MNa0sXJ9HWM','ba6UEDfw1i4']) {
      const study=studies[id];
      const node=study.nodes.find(n=>n.id==='start')!;
      expect(node.tablebase).toBeUndefined();
      expect(node.proof?.method).toBe('legal_winning_move');
      const game=new Chess(node.fen);
      if(node.proof?.method!=='legal_winning_move') throw new Error('Expected legal winning-move proof');
      game.move(node.proof.san);
      expect(game.fen()).toBe(node.proof!.successor_fen);
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      expect(evidence['node:start'].response).toBeUndefined();
      expect(evidence[node.proof!.successor_evidence_key].response.category).toBe('loss');
    }
  });

  it('castles through safe king squares even when b1 is attacked',()=>{
    const study=studies['96UmAkk8h2w'];
    const line=study.branches.find(b=>b.id==='knowledge_castle_fork')!;
    const root=replayBranch(study,line,0);
    expect(root.isAttacked('b1','b')).toBe(true);
    expect(root.moves()).toContain('O-O-O+');
    const castled=replayBranch(study,line,1);
    expect(castled.get('c1')).toMatchObject({type:'k',color:'w'});
    expect(castled.get('d1')).toMatchObject({type:'r',color:'w'});
    expect(replayBranch(study,line,3).get('b2')).toMatchObject({type:'k',color:'w'});
    const wrong=study.branches.find(b=>b.id==='knowledge_move_rook_first')!;
    expect(wrong.outcome).toBe('draw');
  });

  it('collects the forked queen and preserves the d-pawn blockade',()=>{
    const study=studies.VQVcI84wcH4;
    const line=study.branches.find(b=>b.id==='titles_restrain_passer')!;
    expect(replayBranch(study,line,1).get('f7')).toMatchObject({type:'n',color:'w'});
    const held=replayBranch(study,line,3);
    expect(held.get('d2')).toMatchObject({type:'p',color:'w'});
    expect(held.get('d3')).toMatchObject({type:'p',color:'b'});
    expect(held.isAttacked('d3','w')).toBe(true);
  });

  it('wins the exposed queen in both royal-pin sources and forks the remaining bishop',()=>{
    for(const id of ['bFZUupcjQiU','MNa0sXJ9HWM']) {
      const study=studies[id];
      const line=study.branches.find(b=>b.id==='royal_collect_bishop')!;
      const queenTaken=replayBranch(study,line,1);
      expect(queenTaken.get('b8')).toMatchObject({type:'q',color:'w'});
      expect(queenTaken.isCheck()).toBe(true);
      const fork=replayBranch(study,line,3);
      expect(fork.isCheck()).toBe(true);
      expect(fork.isAttacked('c5','w')).toBe(true);
      const collected=replayBranch(study,line,5);
      expect(collected.get('c5')).toMatchObject({type:'q',color:'w'});
      for(const sq of ['b4','f7','h7'] as const)
        expect(collected.get(sq)).toMatchObject({type:'p',color:'b'});
      expect(line.classification).toContain('independent');
      expect(study.startContext).toContain('same composition');
    }
  });

  it('uses the first promotion to control a1 and contrasts the losing pawn capture',()=>{
    const study=studies.IqBGvTKaeBs;
    const line=study.branches.find(b=>b.id==='bishop_race_capture_promotion')!;
    const promoted=replayBranch(study,line,3);
    expect(promoted.get('h8')).toMatchObject({type:'q',color:'w'});
    expect(promoted.isAttacked('a1','w')).toBe(true);
    expect(replayBranch(study,line,4).get('a1')).toMatchObject({type:'q',color:'b'});
    expect(replayBranch(study,line,5).get('a1')).toMatchObject({type:'q',color:'w'});
    const evidence=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/curated-studies/IqBGvTKaeBs.evidence.json',import.meta.url)),'utf8'));
    const moves=evidence['node:start'].response.moves;
    expect(moves.filter((m:{category:string})=>m.category==='loss').map((m:{san:string})=>m.san)).toEqual(['h7']);
    expect(study.branches.find(b=>b.id==='bishop_race_lost_tempo')!.expectedWhiteOutcomes).toEqual(['loss','loss']);
  });

  it('answers the rook interposition before claiming Hail the King mate',()=>{
    const study=studies.PoazY5jnN44;
    const line=study.branches.find(b=>b.id==='hail_rook_interposition')!;
    const checked=replayBranch(study,line,1);
    expect(checked.isCheckmate()).toBe(false);
    expect(checked.moves()).toEqual(['Rh7']);
    expect(replayBranch(study,line,3).isCheckmate()).toBe(true);
    expect(study.sourceCorrections?.[0].correction).toContain('Rh7');
  });

  it('keeps Black as the pawn-race learner and collects both queenside passers first',()=>{
    const study=studies.BIoEsDxQ5dQ;
    const line=study.branches.find(b=>b.id==='patience_collect_then_race')!;
    expect(replayBranch(study,line,0).turn()).toBe('b');
    expect(replayBranch(study,line,1).get('b6')).toMatchObject({type:'k',color:'b'});
    expect(replayBranch(study,line,3).get('a7')).toMatchObject({type:'k',color:'b'});
    expect(replayBranch(study,line,7).get('h1')).toMatchObject({type:'q',color:'b'});
    expect(line.expectedWhiteOutcomes).toEqual(Array(7).fill('loss'));
    expect(study.branches.find(b=>b.id==='patience_race_too_early')!.expectedWhiteOutcomes).toEqual(['win']);
  });

  it('leaves the forced pawn captures available and avoids two immediate stalemates',()=>{
    const study=studies.duJZWksbYI0;
    const line=study.branches.find(b=>b.id==='windmill_delayed_capture')!;
    expect(replayBranch(study,line,1).moves()).toEqual(['hxg5']);
    expect(replayBranch(study,line,3).moves()).toEqual(['h4']);
    expect(replayBranch(study,line,9).moves().sort()).toEqual(['h1=Q','h1=R','h1=B','h1=N'].sort());
    expect(replayBranch(study,line,10).isCheck()).toBe(false);
    expect(replayBranch(study,line,11).isCheckmate()).toBe(true);
    for(const id of ['windmill_push_stalemate','windmill_capture_stalemate']) {
      const error=study.branches.find(b=>b.id===id)!;
      expect(replayBranch(study,error,1).isStalemate()).toBe(true);
    }
  });

  it('holds the Legendary Pawn rook sideline as a drawing objective with the rook protected',()=>{
    const study=studies.Lum_UyZzrJE;
    expect(study.practiceGoal).toBe('draw');
    const line=study.branches.find(b=>b.id==='legendary_drawn_simplification')!;
    const ending=replayBranch(study,line,2);
    expect(ending.get('e6')).toMatchObject({type:'k',color:'w'});
    expect(ending.get('h5')).toMatchObject({type:'r',color:'w'});
    expect(ending.isAttacked('h5','w')).toBe(true);
    expect(line.expectedWhiteOutcomes).toEqual(['draw','draw']);
    expect(study.branches.find(b=>b.id==='legendary_expose_pawn')!.expectedWhiteOutcomes).toEqual(['loss','loss']);
  });

  it('finishes the Troitsky skewer with both black e-pawns preserved',()=>{
    const study=studies.ba6UEDfw1i4;
    const line=study.branches.find(b=>b.id==='troitsky_pawn_and_rook')!;
    const queen=replayBranch(study,line,1);
    expect(queen.get('h8')).toMatchObject({type:'q',color:'w'});
    for(const sq of ['e7','e4'] as const)expect(queen.get(sq)).toMatchObject({type:'p',color:'b'});
    const pawn=replayBranch(study,line,5);
    expect(pawn.get('h7')).toMatchObject({type:'p',color:'w'});
    expect(pawn.get('h8')).toMatchObject({type:'q',color:'w'});
    expect(replayBranch(study,line,7).get('h7')).toMatchObject({type:'q',color:'w'});
  });

  it('labels the independently derived queen-capture defense and preserves the second passer',()=>{
    const study=studies['7qZIrRaZClQ'];
    expect(study.startContext).toContain('independently selected legal reply');
    const line=study.branches.find(b=>b.id==='endgame_queen_capture_reply')!;
    expect(line.classification).toContain('independent');
    expect(replayBranch(study,line,1).isCheck()).toBe(true);
    const supported=replayBranch(study,line,5);
    expect(supported.get('c6')).toMatchObject({type:'p',color:'w'});
    expect(supported.isAttacked('c6','w')).toBe(true);
    expect(supported.moves()).not.toContain('Kxc6');
    expect(supported.get('g2')).toMatchObject({type:'p',color:'w'});
    expect(supported.get('g3')).toMatchObject({type:'p',color:'b'});
  });

  it('independently replays every defense in the eight-piece zugzwang certificates',()=>{
    for(const id of ['upofbg74NtQ','jek48Yfug-4','XGrko3A8kjs']) {
      const study=studies[id];
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let tablebaseLeaves=0, mateLeaves=0;
      const check=(value:any)=>{
        const game=new Chess(value.fen);
        const category=value.response?.category ?? value.category_for_side_to_move;
        expect(category).toBe(game.turn()==='w'?'win':'loss');
        if(value.response) {
          expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);
          expect(value.url).toContain('tablebase.lichess.ovh');
          tablebaseLeaves++;
          return;
        }
        expect(value.method).toBe('finite_strategy');
        expect(value.response).toBeUndefined();
        if(value.rule==='checkmate') {
          expect(game.isCheckmate()).toBe(true);
          mateLeaves++;
          return;
        }
        const sans=Object.keys(value.children);
        if(game.turn()==='b') {
          expect(value.rule).toBe('all_legal_defenses');
          expect(sans.sort()).toEqual(game.moves().sort());
        } else {
          expect(value.rule).toBe('winning_choice');
          expect(sans).toHaveLength(1);
        }
        for(const san of sans) {
          const child=new Chess(value.fen);
          expect(child.move(san).san).toBe(san);
          expect(child.fen()).toBe(value.children[san].fen);
          check(value.children[san]);
        }
      };
      const root=evidence['node:start'];
      check(root);
      expect(tablebaseLeaves).toBe(7);
      expect(mateLeaves).toBe(1);
      expect(Object.keys(root.children.h4.children)).toHaveLength(8);
      expect(study.nodes[0].tablebase).toBeUndefined();
      expect(study.nodes[0].proof?.method).toBe('finite_strategy');
      expect(study.startContext).toContain('not distinct endgames');
      const mate=study.branches.find(b=>b.id==='zugzwang_king_mate')!;
      expect(replayBranch(study,mate,3).isCheckmate()).toBe(true);
      expect(replayBranch(study,mate,3).board().flat().filter(Boolean)).toHaveLength(8);
    }
  });

  it('replays complete finite defense trees for the queen offer, pawn pin and rook offer',()=>{
    const expected:{[id:string]:[number,number,number]}={
      'Nv0a2wq-LXI':[4,4,0], 'OrKqcMQyMWE':[6,6,0], 'qFXXw2fk8wo':[3,9,1],
    };
    for(const [id,[defenses,tbExpected,mateExpected]] of Object.entries(expected)) {
      const study=studies[id];
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let tb=0, mate=0;
      const check=(value:any)=>{
        const game=new Chess(value.fen);
        expect(value.response?.category ?? value.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(value.response) {
          expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);
          tb++;
          return;
        }
        expect(value.method).toBe('finite_strategy');
        if(value.rule==='checkmate') {expect(game.isCheckmate()).toBe(true);mate++;return;}
        const sans=Object.keys(value.children);
        if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());
        else expect(sans).toHaveLength(1);
        for(const san of sans) {
          const child=new Chess(value.fen);expect(child.move(san).san).toBe(san);
          expect(child.fen()).toBe(value.children[san].fen);check(value.children[san]);
        }
      };
      const root=evidence['node:start'];check(root);
      expect(tb).toBe(tbExpected);expect(mate).toBe(mateExpected);
      const first=Object.values(root.children)[0] as any;
      expect(Object.keys(first.children)).toHaveLength(defenses);
      expect(study.nodes[0].tablebase).toBeUndefined();
    }
  });

  it('distinguishes the source pawn capture from the independent bishop capture',()=>{
    const study=studies.qFXXw2fk8wo;
    const source=study.branches.find(b=>b.id==='plan_accept_rook')!;
    expect(source.san[1]).toBe('bxc2+');
    const captured=replayBranch(study,source,2);
    expect(captured.isCheck()).toBe(true);
    expect(captured.get('c2')).toMatchObject({type:'p',color:'b'});
    expect(captured.get('b1')).toMatchObject({type:'b',color:'b'});
    expect(replayBranch(study,source,3).moves()).toEqual(['f2']);
    expect(replayBranch(study,source,5).isCheckmate()).toBe(true);
    const independent=study.branches.find(b=>b.id==='plan_bishop_defense')!;
    expect(replayBranch(study,independent,3).moves()).toHaveLength(8);
    expect(replayBranch(study,independent,3).moves()).toContain('Bd3');
    expect(replayBranch(study,independent,5).isCheckmate()).toBe(true);
  });

  it('keeps a bishop move available on h8 and verifies the first-rank stalemate contrast',()=>{
    const study=studies.OrKqcMQyMWE;
    const line=study.branches.find(b=>b.id==='waiting_pin_pawn')!;
    expect(replayBranch(study,line,1).moves()).toEqual(expect.arrayContaining(['Bf2','Ba7']));
    expect(replayBranch(study,line,3).isCheckmate()).toBe(true);
    const wrong=replayBranch(study,line,0);wrong.move('Rb1');
    expect(wrong.isStalemate()).toBe(true);
    expect(wrong.board().flat().filter(Boolean)).toHaveLength(8);
  });

  it('independently proves every larger-board defense in the clearance and final elevator studies',()=>{
    for(const [id,defenses,mates] of [['_EIjsaPilNU',12,29],['gOQ3onEYVIA',5,12],['F1EdxuZdc5U',1,1]] as const) {
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let leaves=0;
      const check=(value:any)=>{
        const game=new Chess(value.fen);
        expect(value.response).toBeUndefined();
        expect(value.method).toBe('finite_strategy');
        expect(game.board().flat().filter(Boolean).length).toBeGreaterThan(7);
        expect(value.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(value.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);leaves++;return;}
        const sans=Object.keys(value.children);
        if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());
        else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(value.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(value.children[san].fen);check(value.children[san]);}
      };
      const root=evidence['node:start'];check(root);expect(leaves).toBe(mates);
      const first=Object.values(root.children)[0] as any;expect(Object.keys(first.children)).toHaveLength(defenses);
    }
  });

  it('handles both bishop blocks and keeps the pawn pinned until the rooks move',()=>{
    const carpet=studies._EIjsaPilNU;
    for(const id of ['carpet_bishop_block','carpet_bishop_escape']) {
      const line=carpet.branches.find(b=>b.id===id)!;
      expect(replayBranch(carpet,line,line.san.length).isCheckmate()).toBe(true);
    }
    const pawn=studies.gOQ3onEYVIA;const line=pawn.branches.find(b=>b.id==='pawn_three_offers')!;
    expect(replayBranch(pawn,line,0).moves().some(m=>m.startsWith('g5'))).toBe(false);
    expect(replayBranch(pawn,line,2).moves().some(m=>m.startsWith('g5'))).toBe(false);
    expect(replayBranch(pawn,line,4).moves()).toContain('g5+');
    expect(replayBranch(pawn,line,7).isCheckmate()).toBe(true);
    const elevator=studies.F1EdxuZdc5U;const last=elevator.branches[0];
    expect(replayBranch(elevator,last,1).moves()).toEqual(['Kxc3']);
    expect(replayBranch(elevator,last,3).isCheckmate()).toBe(true);
  });

  it('checks every finite defense for the pawn cage, queen offer and Black king hunt',()=>{
    for(const [id,winner,defenses,mates] of [['3tIM41m7L2A','w',1,1],['n2Ykf9vVPjk','w',3,3],['E10sM_0BEig','b',1,1]] as const) {
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let leaves=0;
      const check=(value:any)=>{
        const game=new Chess(value.fen);expect(value.response).toBeUndefined();
        expect(value.method).toBe('finite_strategy');
        expect(value.category_for_side_to_move).toBe(game.turn()===winner?'win':'loss');
        if(value.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);expect(game.turn()).not.toBe(winner);leaves++;return;}
        const sans=Object.keys(value.children);
        if(game.turn()!==winner)expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(value.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(value.children[san].fen);check(value.children[san]);}
      };
      const root=evidence['node:start'];check(root);expect(leaves).toBe(mates);
      const first=Object.values(root.children)[0] as any;expect(Object.keys(first.children)).toHaveLength(defenses);
    }
  });

  it('preserves the source king capture and the Black practice objective',()=>{
    const run=studies.n2Ykf9vVPjk;const line=run.branches.find(b=>b.id==='run_king_queen_offer')!;
    expect(line.san).toEqual(['Qf5+','Kxf5','Bh7#']);
    expect(replayBranch(run,line,2).get('f6')).toMatchObject({type:'b',color:'b'});
    for(const b of run.branches)expect(replayBranch(run,b,b.san.length).isCheckmate()).toBe(true);
    const hunt=studies.E10sM_0BEig;expect(studySide(hunt)).toBe('b');expect(hunt.practiceGoal).toBe('win');
    const b=hunt.branches[0];const end=replayBranch(hunt,b,5);expect(end.isCheckmate()).toBe(true);expect(end.turn()).toBe('w');
    expect(outcomeLabel(b.outcome,end.turn())).toBe('Black can force a win');
    expect(end.get('g7')).toBeUndefined();expect(end.isAttacked('g6','b')).toBe(true);expect(end.isAttacked('h6','b')).toBe(true);
    expect(replayBranch(hunt,b,0).get('b8')).toMatchObject({type:'q',color:'w'});
    expect(replayBranch(hunt,b,0).get('d8')).toMatchObject({type:'q',color:'w'});
    const betrayal=studies['3tIM41m7L2A'];const pawn=betrayal.branches.find(b=>b.id==='betrayal_pawn_practice')!;
    expect(pawn.classification).toContain('independent');expect(pawn.start).toBe('pawn_alternative');
    expect(replayBranch(betrayal,pawn,0).board().flat().filter(Boolean)).toHaveLength(7);
  });

  it('replays the complete rook-replacement and returning-knight mating proofs',()=>{
    for(const [id,mates] of [['nJLgF2SQipk',2],['tS_sUqk8dBQ',1]] as const) {
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let leaves=0;
      const check=(value:any)=>{
        const game=new Chess(value.fen);expect(value.response).toBeUndefined();expect(value.method).toBe('finite_strategy');
        expect(value.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(value.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);leaves++;return;}
        const sans=Object.keys(value.children);
        if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(value.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(value.children[san].fen);check(value.children[san]);}
      };check(evidence['node:start']);expect(leaves).toBe(mates);
    }
  });

  it('requires the knight reroute before the queen offer and the return before pawn mate',()=>{
    const swap=studies.nJLgF2SQipk;const source=swap.branches.find(b=>b.id==='swap_rook_defender')!;
    const early=replayBranch(swap,source,2);early.move('Qg8+');expect(early.moves()).toContain('Kxg8');
    expect(replayBranch(swap,source,5).moves().sort()).toEqual(['Kf8','Kh8']);
    for(const b of swap.branches)expect(replayBranch(swap,b,b.san.length).isCheckmate()).toBe(true);
    const collab=studies.tS_sUqk8dBQ;const line=collab.branches[0];
    const rushed=replayBranch(collab,line,6);rushed.move('g4+');expect(rushed.isCheckmate()).toBe(false);expect(rushed.moves()).toContain('Kf4');
    const ready=replayBranch(collab,line,10);expect(ready.get('d5')).toMatchObject({type:'n',color:'w'});
    const mate=replayBranch(collab,line,11);expect(mate.isCheckmate()).toBe(true);expect(mate.get('e6')).toMatchObject({type:'n',color:'b'});expect(mate.get('e5')).toMatchObject({type:'p',color:'b'});expect(mate.get('f7')).toMatchObject({type:'p',color:'b'});
  });

  it('checks every defense in the pawn interception and rook fork certificates',()=>{
    for(const [id,tbExpected,mateExpected] of [['USn1Z8GHBQ8',4,0],['-MD-izjC-Yk',1,1]] as const){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));let tb=0,mates=0;
      const check=(v:any)=>{
        const game=new Chess(v.fen);expect(v.response?.category??v.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(v.response){expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);tb++;return;}
        expect(v.method).toBe('finite_strategy');
        if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);mates++;return;}
        const sans=Object.keys(v.children);if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };check(evidence['node:start']);expect(tb).toBe(tbExpected);expect(mates).toBe(mateExpected);
    }
  });

  it('distinguishes pawn mate from the queen-capture stalemate and preserves all locked pawns',()=>{
    const rook=studies['-MD-izjC-Yk'];const main=rook.branches.find(b=>b.id==='rooks_refuse_queen')!;
    expect(replayBranch(rook,main,1).moves().sort()).toEqual(['Kb8','Qxd7']);expect(replayBranch(rook,main,3).isCheckmate()).toBe(true);
    const wrong=rook.branches.find(b=>b.id==='rooks_stalemate_error')!;const drawn=replayBranch(rook,wrong,1);expect(drawn.isStalemate()).toBe(true);expect(wrong.outcome).toBe('draw');
    const forest=studies.USn1Z8GHBQ8;for(const b of forest.branches.filter(b=>b.start==='start')){
      const game=replayBranch(forest,b,3);expect(game.get('f3')?.type).not.toBe('p');expect(game.get('f2')?.type).not.toBe('p');
      for(const square of ['a4','b3','c5','b4','c6'] as const)expect(game.get(square)?.type).toBe('p');
    }
    const advanced=forest.branches.find(b=>b.id==='forest_catch_advanced_pawn')!;expect(replayBranch(forest,advanced,3).get('f2')).toMatchObject({type:'k',color:'w'});
  });

  it('replays every defense in the castling, dual-pawn and queen-diagonal mate certificates',()=>{
    for(const [id,expectedReplies] of [['eKA-3FsY_cc',1],['M-_O_vRhIuA',20],['kQQHi57wUpk',1]] as const){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      const root=evidence['node:start'];expect(Object.keys(Object.values(root.children)[0] as any).length).toBeGreaterThan(0);
      const first=Object.values(root.children)[0] as any;expect(Object.keys(first.children)).toHaveLength(expectedReplies);
      const check=(v:any)=>{const game=new Chess(v.fen);expect(v.method).toBe('finite_strategy');expect(v.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);return;}
        const sans=Object.keys(v.children);if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };check(root);
    }
  });

  it('preserves the stipulated castle and the two different protected pawn mates',()=>{
    const fwr=studies['eKA-3FsY_cc'];const line=fwr.branches[0];expect(replayBranch(fwr,line,8).moves()).toContain('O-O-O+');
    const blocked=replayBranch(fwr,line,10);expect(blocked.moves()).toContain('Rdxf1#');expect(replayBranch(fwr,line,11).isCheckmate()).toBe(true);
    const rudra=studies['M-_O_vRhIuA'];const alt=rudra.branches.find(b=>b.id==='rudra_queen_changes_pawn')!;
    const choice=replayBranch(rudra,alt,2);const wrong=new Chess(choice.fen());wrong.move('a4+');expect(wrong.moves()).toContain('Qxa4');expect(replayBranch(rudra,alt,3).isCheckmate()).toBe(true);
    const happy=studies.kQQHi57wUpk;const main=happy.branches[0];expect(replayBranch(happy,main,1).moves()).toEqual(['Ka8']);expect(replayBranch(happy,main,3).moves().sort()).toEqual(['Kb8','Rc6']);
  });

  it('replays all White defenses in the promotion-permission and bishop-intermezzo certificates',()=>{
    for(const id of ['DGEGLAql0As','dJdod4yyRss']){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      let mates=0;const check=(v:any)=>{const game=new Chess(v.fen);expect(v.method).toBe('finite_strategy');expect(v.category_for_side_to_move).toBe(game.turn()==='b'?'win':'loss');
        if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);mates++;return;}
        const sans=Object.keys(v.children);if(game.turn()==='w')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };check(evidence['node:start']);expect(mates).toBe(id==='DGEGLAql0As'?12:3);
    }
  });

  it('keeps every seventh-rank pawn and chooses the checking promotion for each king route',()=>{
    const bishop=studies.DGEGLAql0As;const main=bishop.branches[0];const waiting=replayBranch(bishop,main,3);expect(waiting.moves()).toHaveLength(12);
    for(const square of ['b7','d7','f7','h7'] as const)expect(waiting.get(square)).toMatchObject({type:'p',color:'w'});expect(waiting.get('a8')).toMatchObject({type:'b',color:'w'});
    const danya=studies.dJdod4yyRss;const knight=danya.branches.find(b=>b.id==='danya_knight_promotion')!;const queen=danya.branches.find(b=>b.id==='danya_queen_promotion')!;
    expect(replayBranch(danya,knight,7).get('b1')).toMatchObject({type:'n',color:'b'});expect(replayBranch(danya,queen,11).isCheckmate()).toBe(true);
    const alternate=danya.branches.find(b=>b.id==='danya_other_first_reply')!;expect(replayBranch(danya,alternate,3).isCheckmate()).toBe(true);
  });

  it('replays all defenses to the bishop waiting move and the rook-blocking promotion',()=>{
    for(const id of ['u9TqVKo4tgg','7Yu93iFg2iE']){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      const check=(v:any)=>{const game=new Chess(v.fen);expect(v.response?.category??v.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(v.response){expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);return;}
        expect(v.method).toBe('finite_strategy');if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);return;}
        const sans=Object.keys(v.children);if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };check(evidence['node:start']);
      const first=Object.values(evidence['node:start'].children)[0] as any;expect(Object.keys(first.children)).toHaveLength(id==='7Yu93iFg2iE'?22:1);
    }
  });

  it('preserves the bishop obstruction, protected pawn checks and earlier self-cage contrast',()=>{
    const repeated=studies.u9TqVKo4tgg;const root=new Chess(repeated.nodes[0].fen);expect(root.get('c4')).toMatchObject({type:'b',color:'b'});
    expect(replayBranch(repeated,repeated.branches[0],1).moves()).not.toContain('Rxc8');expect(replayBranch(repeated,repeated.branches[0],5).isCheckmate()).toBe(true);
    const waiting=studies['7Yu93iFg2iE'];const main=waiting.branches.find(b=>b.id==='majestic_queen_interference')!;expect(replayBranch(waiting,main,3).moves()).toEqual(['Qxb3+']);expect(replayBranch(waiting,main,5).isCheckmate()).toBe(true);
    const pending=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/story-drafts/WQjmUPG3nk4.reconstruction.json',import.meta.url)),'utf8'));
    expect(studies.WQjmUPG3nk4.nodes[0].fen).toBe(pending.branches[0].steps[0].fen);expect(studies.WQjmUPG3nk4.verification_scope).toContain('Earlier Ne7');expect(new Chess(pending.branches[0].steps.at(-1).fen).isStalemate()).toBe(true);expect(new Chess(pending.branches[1].steps.at(-1).fen).isStalemate()).toBe(false);
  });

  it('checks every defense to the bishop countercheck and both later queen-skewer roots',()=>{
    for(const id of ['y6oEobRp30U','OZjozSzsZqI']){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      const check=(v:any)=>{const game=new Chess(v.fen);expect(v.response?.category??v.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(v.response){expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);return;}
        expect(v.method).toBe('finite_strategy');if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);return;}
        const sans=Object.keys(v.children);if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };for(const [key,v] of Object.entries(evidence))if(key.startsWith('node:'))check(v);
    }
  });

  it('keeps both pawn pairs in the rook trap and accounts for both queen blocks',()=>{
    const trap=studies.y6oEobRp30U;const line=trap.branches.find(b=>b.id==='drawright_rook_sacrifice')!;
    expect(replayBranch(trap,line,1).moves().sort()).toEqual(['Kxb5','Rxb5+']);const waiting=replayBranch(trap,line,3);
    for(const sq of ['a3','g4','a5','g5'] as const)expect(waiting.get(sq)?.type).toBe('p');
    const ending=replayBranch(trap,line,5);expect(ending.get('f5')).toMatchObject({type:'p',color:'w'});expect(ending.get('g5')).toMatchObject({type:'p',color:'b'});
    const fix=studies.OZjozSzsZqI;const queen=fix.branches.find(b=>b.id==='fix_queen_capture_block')!;expect(replayBranch(fix,queen,1).moves().sort()).toEqual(['Qf8','Qg8']);
    const pawnEnding=replayBranch(fix,queen,4);expect(pawnEnding.board().flat().filter(Boolean)).toHaveLength(6);expect(pawnEnding.get('f7')).toMatchObject({type:'p',color:'b'});
  });

  it('replays every defense to the final knight fork and promotion rook fork',()=>{
    for(const id of ['4Iuof5bMC8c','REJyld_NpfY']){
      const evidence=JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../scripts/curated-studies/${id}.evidence.json`,import.meta.url)),'utf8'));
      const check=(v:any)=>{const game=new Chess(v.fen);expect(v.response?.category??v.category_for_side_to_move).toBe(game.turn()==='w'?'win':'loss');
        if(v.response){expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);return;}
        expect(v.method).toBe('finite_strategy');if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);return;}
        const sans=Object.keys(v.children);if(game.turn()==='b')expect(sans.sort()).toEqual(game.moves().sort());else expect(sans).toHaveLength(1);
        for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san]);}
      };check(evidence['node:start']);
    }
  });

  it('uses the native king and promotion-file locations and preserves the fork exchange endings',()=>{
    const fork=studies['4Iuof5bMC8c'];const line=fork.branches.find(b=>b.id==='fools_source_exchange')!;
    const root=replayBranch(fork,line,0);expect(root.get('c2')).toMatchObject({type:'k',color:'w'});expect(root.get('b2')).toBeUndefined();
    const ending=replayBranch(fork,line,4);expect(ending.board().flat().filter(Boolean)).toHaveLength(7);expect(ending.get('d6')).toMatchObject({type:'k',color:'b'});
    const promotion=studies.REJyld_NpfY;const main=promotion.branches[0];const before=replayBranch(promotion,main,0);
    expect(before.get('h2')).toMatchObject({type:'k',color:'w'});expect(before.get('c7')).toMatchObject({type:'p',color:'w'});expect(before.get('d7')).toMatchObject({type:'r',color:'b'});
    expect(replayBranch(promotion,main,1).moves().sort()).toEqual(['Kg7','Rd8']);for(const b of promotion.branches)expect(replayBranch(promotion,b,3).board().flat().filter(Boolean)).toHaveLength(7);
  });

  it('preserves Black’s outside passer after White collects the c6 pawn',()=>{
    const study=studies.OlT6Eg3rIyY;
    const line=study.branches.find(b=>b.id==='bongcloud_outside_passer')!;
    const capture=replayBranch(study,line,4);
    expect(capture.get('c6')).toMatchObject({type:'k',color:'w'});
    expect(capture.get('a6')).toMatchObject({type:'p',color:'b'});
    expect(capture.get('b4')).toMatchObject({type:'p',color:'b'});
    const end=replayBranch(study,line,line.san.length);
    expect(end.get('b2')).toMatchObject({type:'p',color:'b'});
    expect(end.get('c3')).toMatchObject({type:'k',color:'b'});
    expect(outcomeLabel(line.outcome,end.turn())).toBe('Black can force a win');
    expect(study.verification_scope).toContain('preceding nine-piece ending');
  });
  it('distinguishes promotion from the discovered queen check in the blocked pawn ending',()=>{
    const study=studies.cjgp5RYMyfQ;const line=study.branches.find(b=>b.id==='rains_discovered_queen_check')!;
    expect(replayBranch(study,line,1).isCheck()).toBe(false);
    expect(replayBranch(study,line,3).isCheck()).toBe(true);
    expect(replayBranch(study,line,3).moves()).toEqual(['Ka7']);
    const ending=replayBranch(study,line,7);expect(ending.get('c7')).toMatchObject({type:'q',color:'w'});
    for(const sq of ['a6','b7','c6'] as const)expect(ending.get(sq)).toMatchObject({type:'p',color:'w'});
    expect(ending.get('b5')).toMatchObject({type:'p',color:'b'});
  });
  it('checks both recaptures and the corner retreat after the bishop takes the queen',()=>{
    const study=studies.yvhvc0ZCuGw;const source=study.branches.find(b=>b.id==='exclamation_source_bishop_trade')!;
    expect(replayBranch(study,source,1).moves().sort()).toEqual(['Ka8','Kxc6','Kxc8']);
    const alternate=study.branches.find(b=>b.id==='exclamation_king_takes_knight')!;
    expect(replayBranch(study,alternate,2).get('c8')).toMatchObject({type:'b',color:'w'});
    const corner=study.branches.find(b=>b.id==='exclamation_corner_bishop_offer')!;
    expect(replayBranch(study,corner,3).moves()).toEqual(['Kxb7']);
    const end=replayBranch(study,corner,4);expect(end.board().flat().filter(Boolean)).toHaveLength(7);
    expect(end.get('c6')).toMatchObject({type:'n',color:'w'});
    expect(outcomeLabel(corner.outcome,end.turn())).toBe('White can force a win');
  });
  it('requires complete independent non-loss strategies for both sides of the larger draw',()=>{
    const study=studies.sM3iUBx537Y;expect(study.practiceGoal).toBe('draw');
    const evidence=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/curated-studies/sM3iUBx537Y.evidence.json',import.meta.url)),'utf8'));
    const check=(v:any,side:string)=>{const game=new Chess(v.fen);
      if(v.response){expect(game.board().flat().filter(Boolean).length).toBeLessThanOrEqual(7);expect(['draw',game.turn()===side?'win':'loss']).toContain(v.response.category);return;}
      expect(v.method).toBe('non_losing_strategy');expect(v.side).toBe(side==='w'?'white':'black');
      if(v.rule==='stalemate'){expect(game.isStalemate()).toBe(true);return;}
      if(v.rule==='checkmate'){expect(game.isCheckmate()).toBe(true);expect(game.turn()).not.toBe(side);return;}
      const sans=Object.keys(v.children);if(game.turn()===side){expect(v.rule).toBe('safe_choice');expect(sans).toHaveLength(1);}else{expect(v.rule).toBe('all_legal_replies');expect(sans.sort()).toEqual(game.moves().sort());}
      for(const san of sans){const child=new Chess(v.fen);expect(child.move(san).san).toBe(san);expect(child.fen()).toBe(v.children[san].fen);check(v.children[san],side);}
    };
    for(const v of Object.values(evidence) as any[]){expect(v.method).toBe('finite_draw');expect(v.category_for_side_to_move).toBe('draw');for(const [name,side] of [['white','w'],['black','b']]){expect(v.strategies[name].fen).toBe(v.fen);check(v.strategies[name],side);}}
    for(const branch of study.branches)expect(replayBranch(study,branch,2).isStalemate()).toBe(true);
    expect(replayBranch(study,study.branches[0],1).moves().sort()).toEqual(['Kh3','Kxg3']);
  });
  it('keeps all four promotions and both king replies in the final rook defense',()=>{
    const study=studies['9Ji38GBhYc0'];const branch=study.branches.find(b=>b.id==='retreat_queen_promotion')!;
    expect(replayBranch(study,branch,1).moves().sort()).toEqual(['Kb2','Kxa2','h1=B','h1=N','h1=Q','h1=R'].sort());
    const ending=replayBranch(study,branch,3);expect(ending.get('h1')).toMatchObject({type:'r',color:'w'});expect(ending.board().flat().filter(Boolean)).toHaveLength(7);
    const king=study.branches.find(b=>b.id==='retreat_king_approach')!;expect(replayBranch(study,king,3).get('h1')).toMatchObject({type:'r',color:'w'});
    const knight=study.branches.find(b=>b.id==='retreat_knight_promotion')!;expect(replayBranch(study,knight,3).get('h1')).toMatchObject({type:'n',color:'b'});
  });
  it('checks every Black reply to the bishop promotion and preserves both stalemate defenses',()=>{
    const study=studies.WQjmUPG3nk4;expect(study.practiceGoal).toBe('draw');expect(studySide(study)).toBe('b');
    const source=study.branches.find(b=>b.id==='selfcage_pin_bishop')!;const root=replayBranch(study,source,0);
    expect(root.get('f8')).toMatchObject({type:'b',color:'w'});expect(root.moves()).toHaveLength(20);
    const evidence=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/curated-studies/WQjmUPG3nk4.evidence.json',import.meta.url)),'utf8'));
    const proof=evidence['node:start'];expect(proof.method).toBe('finite_draw');expect(proof.category_for_side_to_move).toBe('draw');
    expect(Object.keys(proof.strategies.white.children).sort()).toEqual(root.moves().sort());expect(Object.keys(proof.strategies.black.children)).toEqual(['Be6']);
    const pinned=replayBranch(study,source,1);expect(pinned.isStalemate()).toBe(true);expect(pinned.get('f8')).toMatchObject({type:'b',color:'w'});expect(pinned.board().flat().filter(Boolean)).toHaveLength(10);
    const capture=study.branches.find(b=>b.id==='selfcage_capture_bishop')!;const removed=replayBranch(study,capture,1);expect(removed.isStalemate()).toBe(true);expect(removed.get('f8')).toMatchObject({type:'r',color:'b'});expect(removed.board().flat().filter(Boolean)).toHaveLength(9);
  });
  it('distinguishes the queen blockade from allowing promotion in the rapid pawn ending',()=>{
    const study=studies['3D03PTU_hbE'];expect(studySide(study)).toBe('b');
    const win=study.branches.find(b=>b.id==='crazy_h_pawn_capture')!;
    const root=replayBranch(study,win,0);expect(root.get('f7')).toMatchObject({type:'q',color:'b'});for(const sq of ['f6','g5','h6'] as const)expect(root.get(sq)).toMatchObject({type:'p',color:'w'});
    const capture=replayBranch(study,win,3);expect(capture.get('h7')).toMatchObject({type:'q',color:'b'});expect(outcomeLabel(win.outcome,capture.turn())).toBe('Black can force a win');
    const wrong=study.branches.find(b=>b.id==='crazy_queen_wanders')!;expect(wrong.expectedWhiteOutcomes).toEqual(['loss','loss','draw','draw']);
    const promoted=replayBranch(study,wrong,4);expect(promoted.get('h8')).toMatchObject({type:'q',color:'w'});expect(promoted.get('b1')).toMatchObject({type:'q',color:'b'});expect(outcomeLabel(wrong.outcome,promoted.turn())).toBe('Draw with best play');
  });
  it('checks bishop threats against queen interpositions and queen sacrifices',()=>{
    const study=studies['m3eCJVfF2HY'];const line=study.branches.find(b=>b.id==='chosen_bishop_pawn_release')!;
    const root=replayBranch(study,line,0);expect(root.get('c7')).toMatchObject({type:'b',color:'w'});expect(root.get('f2')).toMatchObject({type:'q',color:'b'});expect(Object.keys(root.board().flat().filter(Boolean))).toHaveLength(8);
    const check=replayBranch(study,line,3);expect(check.isCheck()).toBe(true);expect(check.isCheckmate()).toBe(false);expect(check.moves()).toContain('Qf6');
    expect(replayBranch(study,line,5).isCheckmate()).toBe(true);
    const pin=study.branches.find(b=>b.id==='chosen_bishop_pin_break')!;expect(replayBranch(study,pin,5).isCheckmate()).toBe(true);
    const sacrifice=study.branches.find(b=>b.id==='chosen_bishop_queen_sacrifice')!;const end=replayBranch(study,sacrifice,3);expect(end.get('g1')).toMatchObject({type:'k',color:'w'});expect(end.isCheckmate()).toBe(false);expect(outcomeLabel(sacrifice.outcome,end.turn())).toBe('White can force a win');
  });
  it('checks the stalemate capture and legal repetition history behind the declined rook sacrifice',()=>{
    const study=studies['zO7f4-V0L-w'];expect(studySide(study)).toBe('b');expect(study.practiceGoal).toBe('draw');
    const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.moves().sort()).toEqual(['Bxb7','Ka6']);expect(root.get('g1')).toMatchObject({type:'q',color:'b'});expect(root.board().flat().filter(Boolean)).toHaveLength(12);
    expect(replayBranch(study,branch,1).isStalemate()).toBe(true);
    const evidence=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/curated-studies/zO7f4-V0L-w.evidence.json',import.meta.url)),'utf8'));
    let claims=0;
    const walk=(v:any,side:string)=>{
      const b=new Chess(v.fen);expect(v.side).toBe(side==='w'?'white':'black');
      if(v.rule==='stalemate'){expect(b.isStalemate()).toBe(true);return;}
      if(v.rule==='threefold_claim'||v.rule==='fivefold_repetition'){
        const h=new Chess(v.history_root_fen);for(const uci of v.history_uci)h.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length===5?{promotion:uci[4]}:{})});
        expect(h.fen()).toBe(v.fen);if(v.rule==='threefold_claim')expect(h.turn()).toBe(side);
        if(v.claim_move_uci){const uci=v.claim_move_uci;h.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length===5?{promotion:uci[4]}:{})});}
        expect(h.isThreefoldRepetition()).toBe(true);claims++;return;
      }
      if(b.turn()===side)expect(Object.keys(v.children)).toHaveLength(1);else expect(Object.keys(v.children).sort()).toEqual(b.moves().sort());
      for(const [san,child]of Object.entries(v.children) as [string,any][]){const c=new Chess(v.fen);c.move(san);expect(c.fen()).toBe(child.fen);walk(child,side);}
    };
    for(const v of Object.values(evidence) as any[]){expect(v.method).toBe('finite_draw');for(const[name,side]of [['white','w'],['black','b']])walk(v.strategies[name],side);}
    expect(claims).toBeGreaterThan(0);
  });
  it('retains every pawn in the staircase final fork and counts the actual seven-piece capture correctly',()=>{
    const study=studies['7oPxZuUXBF4'];const branch=study.branches.find(b=>b.id==='staircase_stop_f_pawn')!;
    const before=replayBranch(study,branch,0);expect(before.board().flat().filter(Boolean)).toHaveLength(8);expect(before.get('b6')).toMatchObject({type:'r',color:'b'});
    const captured=replayBranch(study,branch,1);expect(captured.board().flat().filter(Boolean)).toHaveLength(7);expect(captured.isCheck()).toBe(true);expect(captured.moves().sort()).toEqual(['Kf7','Kg7','Kh7']);
    for(const square of ['b5','f3','f4','g4'] as const)expect(captured.get(square)?.type).toBe('p');
    const blocked=replayBranch(study,branch,3);expect(blocked.get('f2')).toMatchObject({type:'q',color:'w'});expect(blocked.get('f3')).toMatchObject({type:'p',color:'b'});expect(outcomeLabel(branch.outcome,blocked.turn())).toBe('White can force a win');
  });
  it('checks both ways of meeting the queen promotion in You Have to Let Go',()=>{
    const study=studies['27w4cdTiZjU'];const source=study.branches.find(b=>b.id==='letgo_accept_queen')!;
    const root=replayBranch(study,source,0);expect(root.board().flat().filter(Boolean)).toHaveLength(12);
    const promoted=replayBranch(study,source,1);expect(promoted.isCheck()).toBe(false);expect(promoted.moves()).toHaveLength(19);expect(promoted.moves()).toEqual(expect.arrayContaining(['Rxd8','Rg5','Rd6+','Rf5+','hxg4']));
    const mate=replayBranch(study,source,3);expect(mate.isCheckmate()).toBe(true);expect(mate.get('g5')).toMatchObject({type:'p',color:'w'});for(const sq of ['a6','b7','c6'] as const)expect(mate.get(sq)?.type).toBe('p');
    const block=study.branches.find(b=>b.id==='letgo_rook_blocks')!;expect(replayBranch(study,block,3).moves()).toEqual(['Rg7']);expect(replayBranch(study,block,5).isCheckmate()).toBe(true);
  });
  it('keeps the two related promotion sources distinct and retains all four defending pawns',()=>{
    for(const [id,bishop,gPawn,branchId]of [['Qk9_7oF8Ywc','b4','g6','beautiful_collect_c_pawn'],['gFSwJNOp158','b6','g5','pawns_king_reply']] as const){
      const study=studies[id];const branch=study.branches.find(b=>b.id===branchId)!;const promoted=replayBranch(study,branch,1);
      expect(promoted.board().flat().filter(Boolean)).toHaveLength(8);expect(promoted.get(bishop)).toMatchObject({type:'b',color:'b'});for(const sq of ['c6','d5',gPawn,'h5'] as const)expect(promoted.get(sq)).toMatchObject({type:'p',color:'b'});
      expect(promoted.moves()).toHaveLength(18);const captured=replayBranch(study,branch,3);expect(captured.board().flat().filter(Boolean)).toHaveLength(7);expect(captured.isCheck()).toBe(true);expect(outcomeLabel(branch.outcome,captured.turn())).toBe('White can force a win');
    }
  });
  it('finishes the stunning sacrifice after the forced checking pawn capture rather than labeling g5 mate',()=>{
    const study=studies['IEUvecO5kNM'];expect(studySide(study)).toBe('b');
    for(const branch of study.branches){
      const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(16);
      const offer=replayBranch(study,branch,1);expect(offer.moves().sort()).toEqual(['Bxe4','Kxe4']);expect(offer.get('e4')).toMatchObject({type:'q',color:'b'});
      const pushIndex=branch.san.findIndex(s=>s==='g5+')+1;const push=replayBranch(study,branch,pushIndex);expect(push.isCheckmate()).toBe(false);expect(push.moves()).toEqual(['hxg5+']);
      const capture=replayBranch(study,branch,pushIndex+1);expect(capture.isCheck()).toBe(true);expect(capture.moves()).toContain('fxg5#');expect(capture.get('g5')).toMatchObject({type:'p',color:'w'});
      const mate=replayBranch(study,branch,branch.san.length);expect(mate.isCheckmate()).toBe(true);expect(mate.get('g5')).toMatchObject({type:'p',color:'b'});expect(outcomeLabel(branch.outcome,mate.turn())).toBe('Black can force a win');
    }
  });
  it('labels the preliminary rook sideline as a draw without certifying the larger e5 plan',()=>{
    const study=studies['gnSJF5Q7jaI'];expect(studySide(study)).toBe('b');expect(study.practiceGoal).toBe('draw');
    const line=study.branches.find(b=>b.id==='genius_draw_pawn_exchange')!;const root=replayBranch(study,line,0);expect(root.board().flat().filter(Boolean)).toHaveLength(7);expect(root.get('f4')).toMatchObject({type:'k',color:'b'});expect(root.get('g4')).toMatchObject({type:'p',color:'b'});
    const exchange=replayBranch(study,line,2);expect(exchange.board().flat().filter(Boolean)).toHaveLength(6);expect(exchange.isCheck()).toBe(true);expect(exchange.get('g3')).toMatchObject({type:'p',color:'w'});expect(exchange.get('f5')).toMatchObject({type:'p',color:'b'});expect(line.outcome).toBe('draw');
    expect(study.startContext).toContain('preliminary drawing sideline');expect(study.startContext).toContain('remain outside');
  });
  it('checks both final knight mates only after the queen has already been accepted',()=>{
    const study=studies['3woRCScilzI'];expect(study.nodes).toHaveLength(2);
    for(const branch of study.branches){const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(14);expect(root.get('e8')).toMatchObject({type:'q',color:'b'});expect(root.get('a7')).toMatchObject({type:'k',color:'w'});expect(branch.san).toHaveLength(1);expect(replayBranch(study,branch,1).isCheckmate()).toBe(true);}
    expect(study.startContext).toContain('Final mating patterns only');expect(study.startContext).toContain('refusals');
  });
  it('retains the defending bishop self-blockade in the final Bishops 1V1 mate',()=>{
    const study=studies['YPr5ArLq_Y0'];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(12);expect(root.get('e5')).toMatchObject({type:'b',color:'b'});expect(root.get('b7')).toMatchObject({type:'p',color:'w'});
    const mate=replayBranch(study,branch,1);expect(mate.isCheckmate()).toBe(true);expect(mate.get('d3')).toMatchObject({type:'b',color:'w'});expect(mate.get('e5')).toMatchObject({type:'b',color:'b'});expect(branch.san).toEqual(['Bd3#']);expect(study.startContext).toContain('does not prove that Be5 was forced');
  });
  it('checks the legal pawn capture through the relative pin and retains the complete rook-versus-pawns ending',()=>{
    const study=studies['0rxEWrigO_k'];const branch=study.branches.find(b=>b.id==='combination_relative_pin')!;const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(9);expect(root.get('b7')).toMatchObject({type:'r',color:'w'});
    expect(replayBranch(study,branch,1).moves()).toEqual(['Kb4']);const fork=replayBranch(study,branch,3);expect(fork.isCheck()).toBe(true);expect(fork.moves()).toContain('dxc6');
    const taken=replayBranch(study,branch,4);expect(taken.get('c6')).toMatchObject({type:'p',color:'b'});expect(taken.get('d7')).toBeUndefined();const ending=replayBranch(study,branch,5);expect(ending.board().flat().filter(Boolean)).toHaveLength(7);for(const sq of ['c6','d6','e6','h7'] as const)expect(ending.get(sq)).toMatchObject({type:'p',color:'b'});expect(outcomeLabel(branch.outcome,ending.turn())).toBe('White can force a win');
  });
  it('checks the two conditional mating patterns without dropping the spare pawns',()=>{
    const bishop=studies['wgwsy8pth3c'];const bline=bishop.branches[0];const before=replayBranch(bishop,bline,0);expect(before.board().flat().filter(Boolean)).toHaveLength(10);expect(before.get('e2')).toMatchObject({type:'q',color:'b'});expect(before.get('a4')).toMatchObject({type:'p',color:'w'});expect(before.get('a5')).toMatchObject({type:'p',color:'b'});expect(replayBranch(bishop,bline,1).isCheckmate()).toBe(true);expect(bishop.startContext).toContain('Final bishop-mate pattern only');
    const rook=studies['4Quo3b0e3sY'];const rline=rook.branches[0];expect(studySide(rook)).toBe('b');const setup=replayBranch(rook,rline,0);expect(setup.board().flat().filter(Boolean)).toHaveLength(14);expect(setup.get('f4')).toMatchObject({type:'p',color:'w'});expect(setup.get('g4')).toMatchObject({type:'p',color:'b'});const mate=replayBranch(rook,rline,1);expect(mate.isCheckmate()).toBe(true);expect(mate.get('h3')).toMatchObject({type:'r',color:'b'});expect(rook.startContext).toContain('Conditional final rook-mate pattern only');
  });
  it('checks the conditional Majestic Queen back-rank mate after the a-pawn accepts the queen',()=>{
    const study=studies['RIVmNObFz7k'];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(15);expect(root.get('b5')).toMatchObject({type:'p',color:'b'});expect(root.get('c1')).toMatchObject({type:'q',color:'b'});expect(root.get('e7')).toMatchObject({type:'p',color:'w'});expect(root.get('f1')).toMatchObject({type:'n',color:'w'});
    const mate=replayBranch(study,branch,1);expect(mate.isCheckmate()).toBe(true);expect(mate.get('e8')).toMatchObject({type:'r',color:'w'});expect(mate.get('c1')).toMatchObject({type:'q',color:'b'});expect(study.startContext).toContain('Conditional final back-rank mate only');expect(study.startContext).toContain('Qxf1+');
  });
  it('verifies the conditional skewer pawn mate with every spare pawn retained',()=>{
    const study=studies['1p51uyWSnY4'];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(12);expect(root.get('g8')).toMatchObject({type:'q',color:'b'});expect(root.get('d7')).toMatchObject({type:'p',color:'b'});expect(branch.san).toEqual(['Bf4+','Kf5','e4#']);
    const checked=replayBranch(study,branch,1);expect(checked.moves()).toEqual(['Kf5']);const mate=replayBranch(study,branch,3);expect(mate.isCheckmate()).toBe(true);expect(mate.get('e4')).toMatchObject({type:'p',color:'w'});expect(mate.get('f3')).toMatchObject({type:'p',color:'w'});expect(study.startContext).toContain('Selected twelve-piece mating variation only');expect(study.startContext).toContain('Qf8');
  });
  it('keeps the earlier zugzwang mate separate from the later a4 board',()=>{
    const study=studies['fEyEo4KRyRU'];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(11);expect(root.get('a5')).toMatchObject({type:'p',color:'b'});expect(root.get('a4')).toBeUndefined();expect(root.get('b7')).toMatchObject({type:'q',color:'b'});expect(replayBranch(study,branch,1).isCheckmate()).toBe(true);expect(study.startContext).toContain('Conditional eleven-piece mate only');
  });
  it('checks the same later stalemate mechanism separately in both underpromotion sources',()=>{
    for(const id of ['JGpoYRNZtb8','Q5D3UZNTWbc']){
      const study=studies[id];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(8);expect(root.turn()).toBe('b');expect(root.get('c2')).toMatchObject({type:'p',color:'b'});expect(study.practiceGoal).toBe('draw');const promoted=replayBranch(study,branch,1);expect(promoted.moves()).toEqual(['Nxc1']);const stale=replayBranch(study,branch,2);expect(stale.isStalemate()).toBe(true);expect(stale.board().flat().filter(Boolean)).toHaveLength(7);expect(stale.get('f5')).toMatchObject({type:'p',color:'w'});expect(study.startContext).toContain('same composition');expect(study.startContext).toContain('does not prove');
    }
  });
  it('verifies both forced defenses in the conditional Kasparov mating net',()=>{
    const study=studies['MUrT0Ke9goQ'];const branch=study.branches[0];const root=replayBranch(study,branch,0);expect(root.board().flat().filter(Boolean)).toHaveLength(14);expect(root.get('d8')).toMatchObject({type:'r',color:'b'});expect(root.get('h8')).toMatchObject({type:'r',color:'b'});expect(root.get('f1')).toMatchObject({type:'q',color:'b'});expect(replayBranch(study,branch,1).moves()).toEqual(['Ke1']);expect(replayBranch(study,branch,3).moves()).toEqual(['Qe2']);expect(replayBranch(study,branch,5).isCheckmate()).toBe(true);expect(study.startContext).toContain('Conditional fourteen-piece mating variation only');expect(study.startContext).toContain('Rd2/Rd7');
  });
  it('checks the a5-bishop pawn diversion without dropping any spare pawn',()=>{
    const study=studies['t-JfznATlDs'];const root=replayBranch(study,study.branches[0],0);expect(root.board().flat().filter(Boolean)).toHaveLength(8);expect(root.get('a5')).toMatchObject({type:'b',color:'b'});expect(root.get('e6')).toMatchObject({type:'p',color:'w'});expect(root.get('g6')).toMatchObject({type:'p',color:'b'});expect(study.branches).toHaveLength(2);
    for(const branch of study.branches){expect(branch.san[0]).toBe('e7');expect(replayBranch(study,branch,3).board().flat().filter(Boolean)).toHaveLength(8);expect(replayBranch(study,branch,5).board().flat().filter(Boolean)).toHaveLength(7);}
    const capture=replayBranch(study,study.branches[0],5);expect(capture.get('e7')).toMatchObject({type:'q',color:'w'});for(const sq of ['c6','d5','g6','h5'] as const)expect(capture.get(sq)).toMatchObject({type:'p',color:'b'});expect(study.startContext).toContain('every Black response');expect(study.startContext).toContain('independent representative analysis');
  });
  it('keeps every channel video discoverable without labeling source commentary as a verified study',()=>{
    expect(catalog).toHaveLength(513);
    expect(new Set(catalog.map(s=>s.id)).size).toBe(513);
    expect(filterStories('all','all','')).toHaveLength(513);
    expect(filterStories('guided','all','').map(s=>s.id).sort()).toEqual(Object.keys(studies).sort());
    expect(filterStories('endgames','all','Pawns Destiny').some(s=>s.id==='NysivKCHQiY')).toBe(true);
    expect(catalog.find(s=>s.id==='Z7SQg2fLB70')?.frames).toBe(0);
  });
  it('ships readable source records and every referenced snapshot, while preserving valid time spans',()=>{
    const publicRoot=fileURLToPath(new URL('../../public',import.meta.url));
    for(const story of catalog) {
      const source=validateSource(JSON.parse(readFileSync(`${publicRoot}/endgame-stories/${story.id}.json`,'utf8')),story.id);
      expect(source.states.length).toBe(story.frames);
      for(const state of source.states) {
        expect(existsSync(publicRoot+state.image),state.image).toBe(true);
        expect(state.end).toBeLessThanOrEqual(story.duration+.001);
      }
    }
  });
  it('rejects source images outside their own video directory',()=>{
    expect(()=>validateSource({id:'sample',states:[{time:0,end:1,image:'/outside.webp',text:''}],captions:[],transcript:''},'sample')).toThrow();
    expect(()=>validateSource({id:'sample',states:[{time:1,end:0,image:'/endgame-stories/sample/a.webp',text:''}],captions:[],transcript:''},'sample')).toThrow();
  });
  it('restores shareable study, source and pagination state from routes',()=>{
    const read=(p:string)=>storyRoute(new URL('https://chess.example/endgame-stories/'+p));
    expect(read('KEnJIrhWSDQ/?line=keep_shield&ply=1')).toMatchObject({valid:true,id:'KEnJIrhWSDQ',line:'keep_shield',ply:1,mode:'study'});
    expect(read('NysivKCHQiY/?mode=source&frame=14')).toMatchObject({mode:'source',frame:14});
    expect(read('?scope=all&q=rook&page=3')).toMatchObject({scope:'all',search:'rook',page:3});
    expect(read('?page=-1&frame=Infinity')).toMatchObject({page:1,frame:0});
    expect(read('a/b/').valid).toBe(false);
  });
  it('rewrites hosted study links without swallowing JSON or board images',()=>{
    const rules=JSON.parse(readFileSync(fileURLToPath(new URL('../../../../scripts/amplify-feature-routes.json',import.meta.url)),'utf8')) as {source:string;target:string}[];
    const matches=(source:string,path:string)=>source.startsWith('</')?new RegExp(source.slice(2,-2)).test(path):source.endsWith('<*>')?path.startsWith(source.slice(0,-3)):source===path;
    const target=(path:string)=>rules.find(r=>matches(r.source,path))?.target;
    expect(target('/endgame-stories/KEnJIrhWSDQ/')).toBe('/endgame-stories/index.html');
    expect(target('/endgame-stories')).toBe('/endgame-stories/index.html');
    expect(target('/endgame-stories/KEnJIrhWSDQ.json')).toBeUndefined();
    expect(target('/endgame-stories/KEnJIrhWSDQ/image_00001.webp')).toBeUndefined();
  });
});
