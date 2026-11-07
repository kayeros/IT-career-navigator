import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applySavedTheme } from "./hooks/useTheme";
import "./styles/global.css";

// Тему ставим до первой отрисовки, чтобы не мигало
applySavedTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
