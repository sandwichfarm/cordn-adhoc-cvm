<script lang="ts">
  import { onMount } from "svelte";
  import HostWorkspace from "./components/HostWorkspace.svelte";
  import { configStore } from "./config/config.svelte";
  import { coordinatorStore } from "./coordinator/coordinator.svelte";
  import { userProfileStore } from "./identity/user-profile.svelte";
  import {
    initialWorkspaceIntent,
    isLegacyChatIndexPath,
    withWorkspaceIntent,
    workspaceIntentFromHref,
  } from "./navigation/workspace-route";

  const shellOrigin = window.location.origin;
  const rootUrl = new URL("/", shellOrigin).href;
  const initialIntent = initialWorkspaceIntent(window.location.href, window.history.state, shellOrigin);
  let currentUrl = $state(initialIntent ?? rootUrl);
  const homeCoordinatorPubkey = $derived(
    coordinatorStore.loadState === "ready" ? coordinatorStore.identity.publicKeyHex : undefined,
  );
  const identityReady = $derived(userProfileStore.initialized);
  const emptyIdentity = { publicKeyHex: "", npub: "" };

  canonicalize(initialIntent);

  $effect(() => {
    void userProfileStore.initialize(configStore.userName);
  });

  function canonicalize(intent: string | null): void {
    window.history.replaceState(
      withWorkspaceIntent(window.history.state, intent),
      "",
      "/",
    );
  }

  function navigate(href: string) {
    const target = new URL(href, shellOrigin);
    const intent = workspaceIntentFromHref(target.href, shellOrigin);
    if (intent) {
      currentUrl = intent;
      canonicalize(intent);
      return;
    }
    if (target.origin !== shellOrigin) {
      window.location.assign(target.href);
      return;
    }
    if (target.pathname === "/" || isLegacyChatIndexPath(target.pathname)) {
      currentUrl = rootUrl;
      canonicalize(null);
      return;
    }
    window.location.assign(target.href);
  }

  onMount(() => {
    const handlePopState = () => {
      const intent = initialWorkspaceIntent(window.location.href, window.history.state, shellOrigin);
      currentUrl = intent ?? rootUrl;
      canonicalize(intent);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });
</script>

{#key coordinatorStore.loadState}
  <HostWorkspace
    coordinator={coordinatorStore}
    config={configStore}
    identity={coordinatorStore.loadState === "ready" ? coordinatorStore.identity : emptyIdentity}
    coordinatorPubkey={homeCoordinatorPubkey ?? ""}
    relayUrls={configStore.enabledRelayUrls}
    {currentUrl}
    {homeCoordinatorPubkey}
    {identityReady}
    locked={coordinatorStore.loadState === "prompting"}
    onNavigate={navigate}
  />
{/key}
