import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OpeningStudio } from "./OpeningStudio";
import "./studio.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OpeningStudio />
  </StrictMode>,
);
