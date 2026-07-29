import "./app.css";
import { mount } from "svelte";

const target = document.getElementById("app");

if (!target) {
  throw new Error("Missing #app mount point");
}

if (window.location.pathname.startsWith("/chat/")) {
  const { default: ChatRoute } = await import("./components/ChatRoute.svelte");
  mount(ChatRoute, { target });
} else {
  const [{ default: App }, { coordinatorStore }] = await Promise.all([
    import("./App.svelte"),
    import("./coordinator/coordinator.svelte"),
  ]);
  mount(App, { target });
  window.addEventListener("beforeunload", () => coordinatorStore.stopSync());
}
