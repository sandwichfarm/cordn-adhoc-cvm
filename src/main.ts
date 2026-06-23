import "./app.css";
import App from "./App.svelte";
import { coordinatorStore } from "./coordinator/coordinator.svelte";
import { mount } from "svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error("Missing #app mount point");
}

mount(App, { target });

window.addEventListener("beforeunload", () => {
  coordinatorStore.stopSync();
});
