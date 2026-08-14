import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) throw new Error("Application root element is missing.");

createRoot(root).render(
  <StrictMode>
    <main>Web scaffold ready</main>
  </StrictMode>,
);
