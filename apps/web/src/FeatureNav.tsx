import "./featureNav.css";
export function FeatureNav() {
  return <nav className="feature-nav" aria-label="Chess features"><a href="/">Chess homepage</a><span aria-hidden="true">/</span><a href="/guided-play/" aria-current="page">Guided Play</a><a href="/opening-studio/">Opening Studio →</a></nav>;
}
