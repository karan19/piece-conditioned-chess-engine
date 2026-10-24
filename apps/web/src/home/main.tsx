import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, BookOpen, Compass, Flag, Brain, Sparkles, Swords, GitBranch } from "lucide-react";
import "./home.css";

function Homepage() {
  const missing = !["/", "/index.html"].includes(location.pathname);
  if (missing) document.title = "Page not found · Chess Learning Lab";
  return <div className="chess-home">
    <header className="home-header">
      <a className="home-brand" href="/" aria-label="Chess Learning Lab homepage"><span aria-hidden="true">♞</span>Chess Learning Lab</a>
      <nav aria-label="Main navigation"><a href="/guided-play/">Guided Play</a><a href="/opening-studio/">Opening Studio</a><a href="/board-recall/">Board Recall</a><a href="/endgame-stories/">Endgame Stories</a></nav>
    </header>
    <main>
      <section className="home-intro">
        <div className="home-kicker"><Sparkles size={14} aria-hidden="true" /> A LITTLE UNDERSTANDING. A BETTER NEXT MOVE.</div>
        {missing ? <><h1>That page isn’t here.</h1><p><a href="/">Return to the homepage</a>, or choose a chess experience below.</p></> : <><h1>Find your way<br />on the board.</h1><p>Play with guidance, study an opening, train your memory, or explore an endgame.<br className="home-desktop-break" /> Four ways to learn. One place to begin.</p></>}
      </section>
      <section className="home-features" aria-label="Choose your chess experience">
        <a className="home-feature home-play" href="/guided-play/">
          <div className="home-feature-top"><Swords size={24} aria-hidden="true" /><h2>Guided Play</h2><ArrowRight size={20} aria-hidden="true" /></div>
          <div className="home-board-art" aria-hidden="true">{Array.from({length: 32}, (_, i) => <span className={(Math.floor(i / 8) + i % 8) % 2 ? 'dark' : 'light'} key={i}>{({ 3: '♚', 11: '♟', 20: '♞', 28: '♔' } as Record<number,string>)[i] ?? ''}</span>)}</div>
          <div className="home-feature-body"><p>Play against Stockfish, choose a piece to explore, and understand the moves that change your game.</p><ul><li>2D and 3D boards</li><li>Piece-specific engine guidance</li><li>Saved games and learning journal</li></ul><span className="home-action">Start playing <ArrowRight size={20} aria-hidden="true" /></span></div>
        </a>
        <a className="home-feature home-study" href="/opening-studio/">
          <div className="home-feature-top"><BookOpen size={24} aria-hidden="true" /><h2>Opening Studio</h2><ArrowRight size={20} aria-hidden="true" /></div>
          <div className="home-study-art" aria-hidden="true"><div><Compass size={24} /><span>Understand the opening</span></div><span className="home-moves">1. d4 <i>Nf6</i> 2. Nf3 <i>g6</i></span><div><Flag size={24} /><span>Make the last moves count</span></div></div>
          <div className="home-feature-body"><p>Learn what to play, why it works, and what your opponent wants. Then put your understanding into practice.</p><ul><li>Openings for White and Black</li><li>Guided lessons and common replies</li><li>Endgame positions to play out</li></ul><span className="home-action">Explore and learn <ArrowRight size={20} aria-hidden="true" /></span></div>
        </a>
        <a className="home-feature home-memory" href="/board-recall/">
          <div className="home-feature-top"><Brain size={24} aria-hidden="true" /><h2>Board Recall</h2><ArrowRight size={20} aria-hidden="true" /></div>
          <div className="home-memory-art" aria-hidden="true"><Brain size={44} /><span>See it. Hide it. Rebuild it.</span><small>2s · 5s · 10s · your pace</small></div>
          <div className="home-feature-body"><p>Take a brief look at a position, then rebuild it from memory. Learn to notice piece groups and pawn patterns.</p><ul><li>Timed position-memory challenges</li><li>Small boards to full positions</li><li>Piece-by-piece result comparison</li></ul><span className="home-action">Train your memory <ArrowRight size={20} aria-hidden="true" /></span></div>
        </a>
        <a className="home-feature home-stories" href="/endgame-stories/">
          <div className="home-feature-top"><GitBranch size={24} aria-hidden="true" /><h2>Endgame Stories</h2><ArrowRight size={20} aria-hidden="true" /></div>
          <div className="home-stories-art" aria-hidden="true"><GitBranch size={38}/><span>A plan. A defense. A better idea.</span><small>Think through both sides.</small></div>
          <div className="home-feature-body"><p>Discover why the natural move fails, how the opponent defends, and what makes the winning idea work.</p><ul><li>Verified studies with alternative plans</li><li>Narrated endgames from Pietro Checkmate</li><li>Step through, compare, then play</li></ul><span className="home-action">Follow the thinking <ArrowRight size={20} aria-hidden="true" /></span></div>
        </a>
      </section>
      <div className="home-note"><BookOpen size={18} aria-hidden="true" /><p>Your pace. Your next move. Choose a guided game, study a position, or train your recall. Progress stays in this browser.</p></div>
    </main>
    <footer><span>Chess Learning Lab</span><span>No account needed. Keep learning.</span></footer>
  </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Homepage /></StrictMode>);
