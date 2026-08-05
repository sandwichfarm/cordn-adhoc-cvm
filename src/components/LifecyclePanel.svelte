<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
    compact?: boolean;
    minimal?: boolean;
    onStart?: () => void | Promise<void>;
    startLabel?: string;
  }

  let { coordinator, compact = false, minimal = false, onStart, startLabel = "Start" }: Props = $props();
  let confirmDialog: HTMLDialogElement | undefined = $state();

  const statusClass = $derived(
    coordinator.status === "running"
      ? "text-[#87ff9f] border-[#87ff9f]"
      : coordinator.status === "starting" || coordinator.status === "stopping"
        ? "text-[#f1f58f] border-[#f1f58f] animate-pulse"
        : "text-[#6d746f] border-[#29302c]",
  );

  const canStart = $derived(coordinator.status === "idle");
  const canStop = $derived(coordinator.status === "running");
  const canDestroy = $derived(coordinator.status === "idle" || coordinator.status === "running");

  function openDestroyDialog(): void {
    confirmDialog?.showModal();
  }

  async function confirmDestroy(): Promise<void> {
    confirmDialog?.close();
    await coordinator.destroy();
  }

  function start(): void {
    void (onStart ? onStart() : coordinator.start());
  }
</script>

{#if compact}
  <section class:minimal class="compact-controls" aria-label="Coordinator controls">
    <span
      class:running={coordinator.status === "running"}
      class:busy={coordinator.status === "starting" || coordinator.status === "stopping"}
      class="lifecycle-status"
      aria-live="polite"
      data-testid="coordinator-runtime-status"
    >
      <span>Coordinator</span><span data-testid="status-badge">{coordinator.status}</span>
    </span>
    {#if canStart}
      <button class="lifecycle-action start" type="button" aria-label={startLabel} title={startLabel} onclick={start}>
        <span aria-hidden="true">▶</span><span class="lifecycle-label">{startLabel}</span>
      </button>
    {:else if canStop}
      <button class="lifecycle-action stop" type="button" aria-label="Stop" title="Stop coordinator" onclick={() => void coordinator.stop()}>
        {#if minimal}<span aria-hidden="true">■</span>{:else}<span class="running-dot" aria-hidden="true"></span>{/if}<span class="lifecycle-label">Stop</span>
      </button>
    {:else}
      <button
        class="lifecycle-action transitioning"
        type="button"
        aria-label={coordinator.status === "starting" ? "Coordinator is starting" : "Coordinator is stopping"}
        title={coordinator.status === "starting" ? "Coordinator is starting" : "Coordinator is stopping"}
        disabled
      >
        <span class="working-mark" aria-hidden="true"></span>
      </button>
    {/if}
    {#if canDestroy}
      <button class="destroy-action" type="button" aria-label="Destroy" title="Destroy coordinator state" onclick={openDestroyDialog}>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2ZM5 6.5v5M8 6.5v5M11 6.5v5M4.25 4.5l.5 9h6.5l.5-9" />
        </svg>
      </button>
    {/if}
  </section>
{:else}
<section class="border-y border-[#16331f] py-10 text-center">
  <div
    class={`mx-auto mb-6 inline-flex min-w-64 items-center justify-center border px-8 py-5 text-4xl uppercase ${statusClass}`}
    data-testid="status-badge"
  >
    {coordinator.status}
  </div>

  <div class="flex flex-wrap justify-center gap-3">
    <button
      class="border border-[#87ff9f] px-7 py-3 uppercase text-[#87ff9f] transition enabled:hover:bg-[#87ff9f] enabled:hover:text-black disabled:cursor-not-allowed disabled:border-[#26302a] disabled:text-[#4b554e]"
      type="button"
      disabled={!canStart}
      onclick={start}
    >
      {startLabel}
    </button>
    <button
      class="border border-[#f1f58f] px-7 py-3 uppercase text-[#f1f58f] transition enabled:hover:bg-[#f1f58f] enabled:hover:text-black disabled:cursor-not-allowed disabled:border-[#302f1c] disabled:text-[#5b5934]"
      type="button"
      disabled={!canStop}
      onclick={() => void coordinator.stop()}
    >
      Stop
    </button>
    <button
      class="border border-[#ff8f8f] px-7 py-3 uppercase text-[#ff8f8f] transition enabled:hover:bg-[#ff8f8f] enabled:hover:text-black disabled:cursor-not-allowed disabled:border-[#3a1d1d] disabled:text-[#553838]"
      type="button"
      disabled={!canDestroy}
      onclick={openDestroyDialog}
    >
      Destroy
    </button>
  </div>

  {#if coordinator.error}
    <div
      class="mx-auto mt-6 flex max-w-2xl items-start justify-between gap-4 border border-[#9e3636] bg-[#190707] p-4 text-left text-[#ff8f8f]"
      data-testid="error-banner"
    >
      <p>{coordinator.error}</p>
      <button
        class="border border-[#9e3636] px-2 text-xs uppercase"
        type="button"
        onclick={() => coordinator.dismissError()}
      >
        dismiss
      </button>
    </div>
  {/if}

</section>
{/if}

{#if coordinator.error && compact}
  <p class="absolute right-4 top-16 z-20 max-w-sm border border-[#9e3636] bg-[#190707] p-3 text-xs text-[#ff9f9f]" data-testid="error-banner">{coordinator.error}</p>
{/if}

<dialog
  bind:this={confirmDialog}
  class="destroy-dialog"
  aria-labelledby="destroy-dialog-title"
  aria-describedby="destroy-dialog-description"
>
  <div class="destroy-dialog-surface">
    <header>
      <h2 id="destroy-dialog-title">Destroy state</h2>
    </header>
    <div class="destroy-dialog-content">
      <p id="destroy-dialog-description">
        This stops the coordinator, clears encrypted storage, zero-fills the in-memory key, and generates a new identity.
      </p>
    </div>
    <footer>
      <button class="border border-[#6d746f] px-4 py-2 text-sm uppercase text-[#a7b0aa]" type="button" onclick={() => confirmDialog?.close()}>Cancel</button>
      <button class="border border-[#ff8f8f] px-4 py-2 text-sm uppercase text-[#ff8f8f] hover:bg-[#ff8f8f] hover:text-black" type="button" data-testid="confirm-destroy" onclick={() => void confirmDestroy()}>Confirm destroy</button>
    </footer>
  </div>
</dialog>

<style>
  .compact-controls { display: flex; align-items: center; gap: .12rem; }
  .compact-controls.minimal { gap: 0; }
  .compact-controls.minimal .lifecycle-status { position: absolute; width: 1px; height: 1px; overflow: hidden; margin: -1px; padding: 0; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  .compact-controls.minimal .lifecycle-action { width: 2.65rem; justify-content: center; padding: 0; }
  .compact-controls.minimal .lifecycle-action > span:first-child { font-size: .62rem; }
  .compact-controls.minimal .lifecycle-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
  .lifecycle-status { display: flex; height: 2.65rem; align-items: center; gap: .35rem; padding: 0 .65rem; color: #91a59a; font-size: .56rem; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
  .lifecycle-status > span:last-child { color: #718277; }
  .lifecycle-status.running > span:last-child { color: #7cf59d; }
  .lifecycle-status.busy > span:last-child { color: #e4e78d; }
  .lifecycle-action { display: flex; height: 2.65rem; align-items: center; gap: .45rem; border: 0; background: transparent; padding: 0 .8rem; color: #bfd2c4; font-size: .65rem; font-weight: 650; }
  .lifecycle-action:hover:not(:disabled) { background: #17241b; color: #effff2; }
  .lifecycle-action.start { color: #9bf6b3; }
  .lifecycle-action.stop { color: #e3e69a; }
  .lifecycle-action > span:first-child { font-size: .48rem; }
  .lifecycle-action.transitioning { color: #e4e78d; }
  .lifecycle-action.transitioning { width: 2.65rem; justify-content: center; padding: 0; }
  .lifecycle-action:disabled { cursor: wait; opacity: .8; }
  .running-dot { width: .45rem; height: .45rem; border-radius: 999px; background: #7cf59d; box-shadow: 0 0 0 3px rgb(124 245 157 / .1), 0 0 10px rgb(124 245 157 / .28); }
  .working-mark { width: .45rem; height: .45rem; border: 1px solid currentColor; border-top-color: transparent; border-radius: 999px; animation: spin .7s linear infinite; }
  .destroy-action { display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border: 0; background: transparent; color: #7e6868; }
  .destroy-action svg { width: .85rem; height: .85rem; fill: none; stroke: currentColor; stroke-linecap: square; stroke-linejoin: miter; stroke-width: 1.2; }
  .destroy-action:hover { background: #1b0e0e; color: #ffaaa3; }

  .destroy-dialog { position: fixed; inset: 0; width: min(28rem, calc(100% - 1rem)); max-width: none; max-height: calc(100dvh - 1rem); margin: auto; overflow: hidden; border: 1px solid #ff8f8f; background: #000; padding: 0; color: #d1ffd9; }
  .destroy-dialog::backdrop { background: rgb(0 0 0 / .8); }
  .destroy-dialog-surface { display: flex; max-height: calc(100dvh - 1rem - 2px); flex-direction: column; overflow: hidden; text-align: left; }
  .destroy-dialog header { flex: 0 0 auto; border-bottom: 1px solid #3a1d1d; padding: 1rem 1.25rem; }
  .destroy-dialog h2 { color: #ff8f8f; font-size: 1.125rem; text-transform: uppercase; }
  .destroy-dialog-content { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1rem 1.25rem; }
  .destroy-dialog-content p { color: #a7b0aa; font-size: .875rem; line-height: 1.5; }
  .destroy-dialog footer { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; gap: .75rem; border-top: 1px solid #3a1d1d; padding: .85rem 1.25rem; }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-height: 420px) {
    .destroy-dialog header { padding-block: .7rem; }
    .destroy-dialog-content { padding-block: .7rem; }
    .destroy-dialog footer { padding-block: .65rem; }
  }
</style>
