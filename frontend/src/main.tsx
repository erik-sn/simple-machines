// template-managed (bootstrap): do not edit. This is the ONLY file that mounts
// the app; App stays an ordinary component so other repos can import it
// (docs/template.md, "sharing code"). Delete this line to take ownership.
import { setupListeners } from "@reduxjs/toolkit/query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import projectFacts from "../../project.json";
import { App } from "./App";
import { store } from "./store/store";
import "./index.css";

document.title = projectFacts.name;

// Forward the browser's online and visibility events to the store for
// refetchOnReconnect (and refetchOnFocus where a hook enables it).
setupListeners(store.dispatch);

// A deploy replaces the hashed chunks; a tab opened before it fails to import
// a screen it has not loaded yet. Reload once to pick up the new index.html.
// The timestamp stops a loop when the new build fails too; window.location is
// right here because this is a full reload, not navigation.
window.addEventListener("vite:preloadError", (event) => {
  const RELOADED_AT = "vite:preloadError:reloadedAt";
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT)) < 10_000) {
      return;
    }
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // Storage unavailable (private mode): reload without loop protection.
  }
  event.preventDefault();
  window.location.reload();
});

const container = document.getElementById("root");
if (container === null) {
  throw new Error("index.html must provide #root");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
