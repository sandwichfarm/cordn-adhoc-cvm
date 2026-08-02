import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { coordinatorStore } from "./coordinator/coordinator.svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error("Missing #app mount point");
}

mount(App, { target });

window.addEventListener("beforeunload", (event) => {
  if (coordinatorStore.status !== "running") return;
  // Browsers intentionally provide their own localized copy for this prompt.
  // Do not stop here: a user who cancels the exit must keep hosting.
  event.preventDefault();
  event.returnValue = true;
});

// `pagehide` only fires once the page is actually going away, after any
// beforeunload confirmation has been accepted.
window.addEventListener("pagehide", () => void coordinatorStore.stopSync());
