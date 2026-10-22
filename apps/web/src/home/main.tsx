import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, BookOpen, Compass, Flag, Sparkles, Swords } from "lucide-react";
import "./home.css";

function Homepage() {
  const missing = !["/", "/index.html"].includes(location.pathname);
  if (missing) document.title = "Page not found · Chess Learning Lab";
  return <div className="chess-home">
    <header className="home-header">
      <a className="home-brand" href="/" aria-label="Chess Learning Lab homepage"><span aria-hidden="true">♞</span>Chess Learning Lab</a>
      <nav aria-label="Main navigation"><a href="/guided-play/">Guided Play</a><a href="/opening-studio/">Opening Studio</a></nav>
    </header>
    <main>
      <section className="home-intro">
        <div className="home-kicker"><Sparkles size={14} aria-hidden="true" /> A LITTLE UNDERSTANDING. A BETTER NEXT MOVE.</div>
        {missing ? <><h1>That page isn’t here.</h1><p><a href="/">Return to the homepage</a>, or choose a chess experience below.</p></> : <><h1>Find your way<br />on the board.</h1><p>Play a game with guidance, or take time to understand an opening.<br className="home-desktop-break" /> Two ways to learn. One place to begin.</p></>}
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
      </section>
      <div className="home-note"><BookOpen size={18} aria-hidden="true" /><p>Your pace. Your next move. Both experiences include an optional thinking checklist, with progress saved in this browser.</p></div>
    </main>
    <footer><span>Chess Learning Lab</span><span>No account needed. Keep learning.</span></footer>
  </div>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Homepage /></StrictMode>);
