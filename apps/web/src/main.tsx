import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FeatureNav } from "./FeatureNav";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <FeatureNav />
    <App />
  </StrictMode>
);
