import "./featureNav.css";
import { Breadcrumbs, RouteLink, useRouteLocation } from "./navigation";
import { readGuidedRoute } from "./routes";
export function FeatureNav() {
  const route = readGuidedRoute(useRouteLocation());
  const child = route.screen === "new-game" ? "New Game" : route.screen === "game" ? "Game" : route.screen === "previous-games" ? "Learning Journal" : route.screen === "review-game" ? "Review" : route.screen === "missing" ? "Page not found" : null;
  return <header className="feature-header"><Breadcrumbs items={[{ label: "Chess homepage", href: "/" }, { label: "Guided Play", ...(child ? { href: "/guided-play/" } : {}) }, ...(route.screen === "review-game" ? [{ label: "Learning Journal", href: "/guided-play/journal/" }] : []), ...(child ? [{ label: child }] : [])]} /><nav className="feature-nav" aria-label="Chess features"><RouteLink href="/guided-play/new-game/">New Game</RouteLink><RouteLink href="/guided-play/journal/" aria-current={route.screen === "previous-games" ? "page" : undefined}>Learning Journal</RouteLink><a href="/opening-studio/">Opening Studio</a><a href="/board-recall/">Board Recall</a><a href="/endgame-stories/">Endgame Stories →</a></nav></header>;
}
