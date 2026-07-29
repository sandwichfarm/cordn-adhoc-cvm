<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
    compact?: boolean;
  }

  let { coordinator, compact = false }: Props = $props();
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
</script>

{#if compact}
  <section class="flex items-center gap-2" aria-label="Coordinator controls">
    <span class={`border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClass}`} data-testid="status-badge">{coordinator.status}</span>
    <button class="border border-[#87ff9f] px-2.5 py-1 text-xs text-[#87ff9f] enabled:hover:bg-[#87ff9f] enabled:hover:text-black disabled:opacity-40" type="button" disabled={!canStart} onclick={() => void coordinator.start()}>Start</button>
    <button class="border border-[#f1f58f] px-2.5 py-1 text-xs text-[#f1f58f] enabled:hover:bg-[#f1f58f] enabled:hover:text-black disabled:opacity-40" type="button" disabled={!canStop} onclick={() => void coordinator.stop()}>Stop</button>
    <button class="border border-[#7a3939] px-2 py-1 text-xs text-[#ffaaa3] enabled:hover:border-[#ff8f8f] disabled:opacity-40" type="button" disabled={!canDestroy} onclick={openDestroyDialog}>Destroy</button>
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
      onclick={() => void coordinator.start()}
    >
      Start
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

<dialog bind:this={confirmDialog} class="border border-[#ff8f8f] bg-black p-0 text-[#d1ffd9] backdrop:bg-black/80">
  <div class="max-w-md p-5 text-left">
    <h2 class="text-lg uppercase text-[#ff8f8f]">Destroy state</h2>
    <p class="mt-3 text-sm text-[#a7b0aa]">
      This stops the coordinator, clears encrypted storage, zero-fills the in-memory key, and generates a new identity.
    </p>
    <div class="mt-5 flex justify-end gap-3">
      <button class="border border-[#6d746f] px-4 py-2 text-sm uppercase text-[#a7b0aa]" type="button" onclick={() => confirmDialog?.close()}>Cancel</button>
      <button class="border border-[#ff8f8f] px-4 py-2 text-sm uppercase text-[#ff8f8f] hover:bg-[#ff8f8f] hover:text-black" type="button" data-testid="confirm-destroy" onclick={() => void confirmDestroy()}>Confirm destroy</button>
    </div>
  </div>
</dialog>
