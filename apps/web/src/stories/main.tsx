import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, GitBranch, Search, Swords, Video } from 'lucide-react';
import { Board } from '../v2/Board';
import { Breadcrumbs, MissingPage, RouteLink, updateRouteQuery, usePageNavigation, useRouteLocation } from '../navigation';
import { annotations, branchLabels } from './annotations';
import { catalog, filterStories, outcomeLabel, replayBranch, storyRoute, studies, studySide, themes, timestamp, validateSource, type SourceStory, type Story, type Study } from './model';
import './stories.css';
const Practice = lazy(() => import('./Practice'));

function StoriesApp() {
  const url = useRouteLocation();
  const route = storyRoute(url);
  const story = catalog.find(s => s.id === route.id);
  usePageNavigation(`${story?.title ?? 'Endgame Stories'} · Chess Learning Lab`, url.pathname);
  return <div className="stories-app">
    <header className="stories-header"><a className="stories-brand" href="/"><span aria-hidden="true">♞</span>Chess Learning Lab</a><nav aria-label="Chess features"><a href="/guided-play/">Guided Play</a><a href="/opening-studio/">Opening Studio</a><a href="/board-recall/">Board Recall</a><RouteLink href="/endgame-stories/" aria-current="page">Endgame Stories</RouteLink></nav></header>
    <main className="stories-main"><Breadcrumbs items={[{label:'Chess homepage',href:'/'},{label:'Endgame Stories',...(story ? {href:'/endgame-stories/'} : {})},...(story ? [{label:story.title}] : [])]} />
      {!route.valid || (route.id && !story) ? <MissingPage embedded title="This story isn’t here" href="/endgame-stories/" label="Browse endgame stories">Choose a study or source walkthrough from the collection.</MissingPage> : story ? <StoryView key={story.id} story={story} /> : <Library />}
    </main><footer className="stories-footer"><span>Chess Learning Lab · Endgame Stories</span><span>Source videos and commentary: <a href="https://www.youtube.com/@PietroCheckmate" target="_blank" rel="noreferrer">Pietro Checkmate</a></span></footer>
  </div>;
}

function Library() {
  const route = storyRoute(useRouteLocation());
  const filtered = filterStories(route.scope,route.theme,route.search);
  const pages = Math.max(1,Math.ceil(filtered.length/12));
  const page = Math.min(route.page,pages);
  return <>
    <section className="stories-intro"><span className="stories-kicker"><GitBranch size={15} /> A PLAN. A DEFENSE. A BETTER IDEA.</span><h1>There’s a story<br />behind the winning move.</h1><p>Try the obvious idea. Discover the opponent’s resource.<br className="stories-desktop" /> Then work out what needs to change.</p><div className="stories-stats"><span><strong>{catalog.filter(s=>s.verified).length}</strong> verified guided studies</span><span><strong>{catalog.filter(s=>s.reviewStatus==='awaiting_reconstruction').length}</strong> awaiting reconstruction</span><span><strong>{catalog.filter(s=>s.reviewStatus==='needs_information').length}</strong> need more information</span><span><strong>{catalog.filter(s=>s.reviewStatus==='not_applicable').length}</strong> not board studies</span></div></section>
    <section className="stories-how" aria-label="How to study"><div><span>01</span><p><strong>Understand the problem</strong>What stops the natural plan?</p></div><div><span>02</span><p><strong>Think for both sides</strong>Give the defender a strong reply.</p></div><div><span>03</span><p><strong>Find what changes</strong>Compare the idea, then play it out.</p></div></section>
    <div className="stories-section-heading"><div><span className="stories-kicker">THE COLLECTION</span><h2>Choose an idea to explore.</h2></div><p>Guided studies are checked independently.<br />Source walkthroughs follow the original narration.</p></div>
    <div className="stories-filters"><label className="stories-search"><Search size={17} /><span className="stories-sr">Search stories</span><input type="search" placeholder="Search a title or idea…" value={route.search} onChange={e=>updateRouteQuery({q:e.target.value,page:null},true)} /></label><label>Collection<select value={route.scope} onChange={e=>updateRouteQuery({scope:e.target.value,page:null})}><option value="endgames">Endgame-related videos</option><option value="guided">Verified guided studies</option><option value="pending">Awaiting reconstruction</option><option value="needs-info">Needs more information</option><option value="skipped">Not a board study</option><option value="all">All {catalog.length} channel videos</option></select></label><label>Idea<select value={route.theme} onChange={e=>updateRouteQuery({theme:e.target.value,page:null})}><option value="all">All ideas</option>{themes.map(t=><option key={t}>{t}</option>)}</select></label></div>
    <p className="stories-filter-note">{filtered.length} {filtered.length===1?'story':'stories'} · Source videos are grouped by their titles and narration. The full channel is available in “All channel videos.”</p>
    <div className="stories-grid">{filtered.slice((page-1)*12,page*12).map(story=><StoryCard key={story.id} story={story} />)}</div>
    {!filtered.length && <div className="stories-empty"><h2>No stories match yet.</h2><p>Try a different idea or clear your search.</p><button onClick={()=>updateRouteQuery({q:null,theme:null,scope:null,page:null})}>Show the collection</button></div>}
    {pages>1 && <div className="stories-pagination"><button disabled={page===1} onClick={()=>updateRouteQuery({page:page-1})}><ChevronLeft size={16} />Previous</button><span>Page {page} of {pages}</span><button disabled={page===pages} onClick={()=>updateRouteQuery({page:page+1})}>Next<ChevronRight size={16} /></button></div>}
    <details className="stories-about"><summary>About this collection</summary><p>The collection comes from {catalog.length} Pietro Checkmate Shorts. {catalog.filter(s=>s.hasNarration).length} have saved captions. Narrated walkthroughs pair available board images with the source commentary; some clips have narration or an original-video link only. Source captions can contain recognition errors.</p><p>The guided studies reconstruct selected positions and compare legal variations with saved tablebase checks. Their explanations include corrections where a video’s broad claim was not supported. Other videos have not been reconstructed into verified move trees. Images sampled once a second may miss fast moves.</p></details>
  </>;
}

function StoryCard({story}: {story:Story}) {
  const study = studies[story.id];
  return <RouteLink href={`/endgame-stories/${story.id}/`} className={`story-card ${story.verified?'curated':''}`}>
    <div className="story-card-visual">{study ? <Board game={replayBranch(study,study.branches[0],0)} side={studySide(study)} mini /> : story.thumbnail ? <img src={story.thumbnail} alt={`Board shown in ${story.title}`} loading="lazy" width={384} height={384} /> : <div className="story-no-image"><Video size={42} /><span>{story.hasNarration?'Read the source commentary':'Watch the original Short'}</span></div>}<span className="story-duration">{timestamp(story.duration)}</span></div>
    <div className="story-card-body"><span className={`story-badge ${story.verified?'verified':''}`}>{story.verified?<CheckCircle2 size={13} />:<Video size={13} />}{story.verified?'Verified guided study':story.reviewStatus==='needs_information'?'Needs more information':story.reviewStatus==='not_applicable'?'Not a board study':'Source walkthrough'}</span><h3>{story.title}</h3><p>{study?.summary ?? (story.reviewStatus==='not_applicable' ? story.reviewNotes : story.reviewStatus==='needs_information' ? story.sourceGaps.join(' · ') : story.themes.length ? story.themes.slice(0,3).join(' · ') : 'Explore the original video and available commentary.')}</p><span className="story-card-action">{story.verified?'Think through this study':story.frames?'Follow the source walkthrough':story.hasNarration?'Read the commentary':'Open source details'}<ArrowRight size={17}/></span></div>
  </RouteLink>;
}

function StoryView({story}:{story:Story}) {
  const route = storyRoute(useRouteLocation());
  const study = studies[story.id];
  const mode = study ? route.mode : 'source';
  return <>
    <div className="story-title"><div><RouteLink href="/endgame-stories/" className="stories-back"><ArrowLeft size={15}/>Back to stories</RouteLink><span className="stories-kicker">{study?'VERIFIED STUDY · ':'SOURCE WALKTHROUGH · '}PIETRO CHECKMATE</span><h1>{story.title}</h1><p>{study?.summary ?? 'Follow the commentary, examine the board, and consider each side’s ideas.'}</p></div><a href={story.sourceUrl} target="_blank" rel="noreferrer" className="stories-source-link">Original video<ExternalLink size={15}/></a></div>
    {story.reviewStatus==='needs_information' && <div className="story-source-notice" role="note"><div><strong>Needs more information before a guided study can be prepared</strong>{story.reviewNotes && <p>{story.reviewNotes}</p>}<ul>{story.informationNeeded.map(text=><li key={text}>{text}</li>)}</ul><p>The available source material remains below. Missing material is tracked separately from the chess result.</p></div></div>}
    {story.reviewStatus==='not_applicable' && <p className="story-source-notice">{story.reviewNotes}</p>}
    {story.reviewStatus==='awaiting_reconstruction' && story.reviewNotes && <details className="story-evidence"><summary>Why this study is still pending</summary><p>{story.reviewNotes}</p></details>}
    {study?.startContext && <p className="story-source-notice">{study.startContext}</p>}
    {study && <nav className="story-modes" aria-label="Study mode">{[['study','Think through the study'],['source','Source walkthrough'],['practice','Play from the start']].map(([value,label])=><button key={value} aria-current={mode===value?'page':undefined} onClick={()=>updateRouteQuery({mode:value==='study'?null:value})}>{value==='study'?<GitBranch size={16}/>:value==='source'?<Video size={16}/>:<Swords size={16}/>} {label}</button>)}</nav>}
    {mode==='study' && study ? <GuidedStudy study={study}/> : mode==='practice' && study ? <Suspense fallback={<p role="status">Opening the practice board…</p>}><Practice study={study}/></Suspense> : <SourceWalkthrough story={story}/>}
  </>;
}

function GuidedStudy({study}:{study:Study}) {
  const route=storyRoute(useRouteLocation());
  const defaultLine=study.defaultBranch ?? (study.video_id==='KEnJIrhWSDQ'?'main_bind':'reach_two_threats');
  const branch=study.branches.find(b=>b.id===route.line) ?? study.branches.find(b=>b.id===defaultLine)!;
  const ply=Math.min(route.ply,branch.san.length);
  const game=replayBranch(study,branch,ply);
  const node=study.nodes.find(n=>n.id===branch.start)!;
  const last=game.history({verbose:true}).at(-1);
  const finished=ply===branch.san.length;
  const result=game.isStalemate()?'Stalemate. Draw.':game.isCheckmate()?`Checkmate. ${game.turn()==='b'?'White':'Black'} wins.`:outcomeLabel(branch.outcome,game.turn());
  return <>
    <div className="story-study-layout"><section className="story-board-column" aria-label="Study board"><div className="story-board-label"><span>{game.isGameOver()?'GAME OVER':`${game.turn()==='w'?'WHITE':'BLACK'} TO MOVE`}</span><span>{ply} / {branch.san.length} moves revealed</span></div><Board game={game} side={studySide(study)} last={last}/><div className="story-controls"><button aria-label="Previous move" disabled={!ply} onClick={()=>updateRouteQuery({ply:ply-1})}><ChevronLeft size={18}/>Previous</button><button disabled={finished} onClick={()=>updateRouteQuery({ply:ply+1})}>{ply?'Show next move':'Reveal first move'}<ChevronRight size={18}/></button></div><div className="story-moves" aria-label="Moves in this variation"><button aria-current={!ply?'step':undefined} onClick={()=>updateRouteQuery({ply:0})}>Start</button>{branch.san.map((san,i)=><button key={i} aria-label={`Go to move ${i+1}: ${san}`} aria-current={ply===i+1?'step':undefined} className={i>=ply?'unseen':''} onClick={()=>updateRouteQuery({ply:i+1})}>{san}</button>)}</div><p className="story-board-footnote">Step through either side’s moves at your pace. The practice board lets you try your own.</p></section>
    <aside className="story-thinking"><span className="stories-kicker">{finished?'WHAT THIS LINE SHOWS':'THINK IT THROUGH'}</span><h2>{!ply?node.question:finished?result:`${last?.color==='w'?'White':'Black'} plays ${last?.san}`}</h2><p className="story-explanation" aria-live="polite">{branch.commentary?.[ply] ?? annotations[branch.id]?.[ply] ?? (finished?branch.explanation:node.explanation)}</p>{finished && <div className={`story-outcome ${branch.outcome==='draw'?'draw':''}`}><CheckCircle2 size={18}/><div><strong>{result}</strong><p>Checked against the saved verification evidence for this position.</p></div></div>}
    <div className="story-branch-list"><h3>Compare another idea</h3>{study.branches.map(b=><button key={b.id} aria-pressed={branch.id===b.id} onClick={()=>updateRouteQuery({line:b.id,ply:0})}><GitBranch size={15}/><span>{b.title ?? branchLabels[b.id] ?? b.id}</span><ChevronRight size={15}/></button>)}</div>
    <details className="story-evidence"><summary>Where this explanation comes from</summary><p>Selected positions read from the source images; variations checked for legal moves and tablebase outcomes. {branch.classification.includes('alternative')?'This alternative is independent analysis rather than a move sequence claimed to appear in the video.':'The line follows an illustrated idea from the source.'}</p>{study.verification_scope && <p>{study.verification_scope}</p>}{study.sourceCorrections?.map((correction,i)=><p key={i}><strong>Source correction:</strong> {correction.correction}</p>)}<a href={`https://www.youtube.com/watch?v=${study.video_id}&t=${Math.floor(node.evidence.timestamp_s ?? 0)}s`} target="_blank" rel="noreferrer">Watch the source context<ExternalLink size={13}/></a><a href={`https://lichess.org/analysis/${game.fen().replace(/ /g,'_')}`} target="_blank" rel="noreferrer">Analyze this position<ExternalLink size={13}/></a></details></aside></div>
    <section className="story-reflection"><span className="stories-kicker">TAKE THE IDEA WITH YOU</span><h2>Pause, then explain it yourself.</h2><div>{study.exercises.map((e,i)=><details key={i}><summary>{e.prompt}</summary><p>{e.answer}</p></details>)}</div></section>
  </>;
}

function SourceWalkthrough({story}:{story:Story}) {
  const route=storyRoute(useRouteLocation());
  const [source,setSource]=useState<SourceStory|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setError('');setSource(null);fetch(`/endgame-stories/${story.id}.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('The source walkthrough could not load.');return r.json();}).then(v=>{if(!controller.signal.aborted)setSource(validateSource(v,story.id));}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'The source walkthrough could not load.');});return()=>controller.abort();},[story.id,retry]);
  if(error)return <div className="stories-empty" role="alert"><h2>We couldn’t open this walkthrough.</h2><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Try again</button><a href={story.sourceUrl} target="_blank" rel="noreferrer">Watch the original video</a></div>;
  if(!source)return <p className="stories-loading" role="status">Opening the source walkthrough…</p>;
  const frame=Math.min(route.frame,Math.max(0,source.states.length-1));
  const state=source.states[frame];
  return <>
    <p className="story-source-notice"><Video size={16}/><span>Original commentary with sampled board images. These are source explanations, not independently verified move sequences.</span></p>
    <div className="story-study-layout"><section className="story-board-column" aria-label="Source board images">{state?<><div className="story-board-label"><span>SOURCE BOARD · {timestamp(state.time)}</span><span>{frame+1} / {source.states.length}</span></div><img className="story-source-board" src={state.image} alt={`Board shown at ${timestamp(state.time)} in ${story.title}`} width={384} height={384}/><div className="story-controls"><button disabled={!frame} onClick={()=>updateRouteQuery({frame:frame-1},true)}><ChevronLeft size={18}/>Previous image</button><button disabled={frame===source.states.length-1} onClick={()=>updateRouteQuery({frame:frame+1},true)}>Next image<ChevronRight size={18}/></button></div><label className="story-scrubber">Move through the source<input aria-label="Source board image" type="range" min={0} max={source.states.length-1} value={frame} onChange={e=>updateRouteQuery({frame:Number(e.target.value)},true)}/></label><p className="story-board-footnote">Images preserve the video’s arrows and highlights. Fast moves between samples may be absent.</p></>:<div className="story-no-board"><Video size={48}/><h2>Follow the original video.</h2><p>{source.excludedImages?'The saved board crop for this video was excluded after review.':'A reliable board sequence isn’t available for this clip.'} {source.transcript?'The available commentary is included alongside.':''}</p><a className="stories-primary" href={story.sourceUrl} target="_blank" rel="noreferrer">Watch on YouTube<ExternalLink size={16}/></a></div>}</section>
    <aside className="story-thinking"><span className="stories-kicker">PIETRO’S COMMENTARY{state?` · ${timestamp(state.time)}–${timestamp(state.end)}`:''}</span><h2>What’s happening here?</h2><p className="story-explanation">{state?.text || (!state?source.transcript:'No caption overlaps this sampled interval. Use the full commentary below or watch this moment in the source video.') || 'No captions were available for this clip. The original video is the source for its explanation.'}</p><a className="stories-source-link" href={`${story.sourceUrl}&t=${Math.floor(state?.time ?? 0)}s`} target="_blank" rel="noreferrer">Watch this moment<ExternalLink size={15}/></a><div className="story-reading-prompts"><h3>As you follow along</h3><ol><li>What is each side trying to achieve?</li><li>Which reply stops the natural plan?</li><li>What changes before the successful idea works?</li></ol><p>These are questions to guide your reading, rather than claims about the position.</p></div>{source.transcript&&<details className="story-transcript"><summary>Read the full source commentary</summary><p>{source.transcript}</p></details>}</aside></div>
  </>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><StoriesApp/></StrictMode>);
