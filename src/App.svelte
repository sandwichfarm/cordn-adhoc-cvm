<script lang="ts">
  import { onMount } from "svelte";
  import PassphrasePrompt from "./components/PassphrasePrompt.svelte";
  import HostWorkspace from "./components/HostWorkspace.svelte";
  import ChatRoute from "./components/ChatRoute.svelte";
  import ChatLobby from "./components/ChatLobby.svelte";
  import { configStore } from "./config/config.svelte";
  import { coordinatorStore } from "./coordinator/coordinator.svelte";

  let currentUrl = $state(window.location.href);
  const currentPath = $derived(new URL(currentUrl).pathname);
  const isChatLobbyRoute = $derived(currentPath === "/chats" || currentPath === "/chat" || currentPath === "/chat/");
  const isChatRoute = $derived(!isChatLobbyRoute && currentPath.startsWith("/chat/"));
  const homeCoordinatorPubkey = $derived(
    coordinatorStore.loadState === "ready" ? coordinatorStore.identity.publicKeyHex : undefined,
  );

  function navigate(href: string) {
    let target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin && target.pathname.startsWith("/chat/")) {
      target = new URL(`${target.pathname}${target.search}${target.hash}`, window.location.origin);
    }
    if (target.origin !== window.location.origin) {
      window.location.assign(target.href);
      return;
    }
    if (target.href === currentUrl) return;
    window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
    currentUrl = target.href;
  }

  onMount(() => {
    const handlePopState = () => currentUrl = window.location.href;
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });
</script>

{#if isChatLobbyRoute}
  <ChatLobby
    coordinatorLocked={coordinatorStore.loadState === "prompting"}
    coordinatorStatus={coordinatorStore.status}
    onNavigate={navigate}
  />
{:else if isChatRoute}
  {#key currentUrl}
    <ChatRoute
      {currentUrl}
      {homeCoordinatorPubkey}
      homeCoordinatorName={configStore.coordinatorName}
      anonymousPubkey={homeCoordinatorPubkey ?? ""}
      anonymousName={configStore.userName}
      onAnonymousNameChange={(name) => configStore.setUserName(name)}
      coordinatorStatus={coordinatorStore.status}
      config={configStore}
      coordinator={coordinatorStore}
      coordinatorPubkey={homeCoordinatorPubkey ?? ""}
      relayUrls={configStore.enabledRelayUrls}
      onNavigate={navigate}
    />
  {/key}
{:else if coordinatorStore.loadState === "prompting"}
  <PassphrasePrompt coordinator={coordinatorStore} onOpenChats={() => navigate("/chats")} />
{:else}
  <HostWorkspace
    coordinator={coordinatorStore}
    config={configStore}
    identity={coordinatorStore.identity}
    coordinatorPubkey={coordinatorStore.identity.publicKeyHex}
    relayUrls={configStore.enabledRelayUrls}
    {currentUrl}
    {homeCoordinatorPubkey}
    onNavigate={navigate}
  />
{/if}
