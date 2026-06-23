<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
  }

  let { coordinator }: Props = $props();

  const statusClass = $derived(
    coordinator.status === "running"
      ? "text-[#87ff9f] border-[#87ff9f]"
      : coordinator.status === "starting" || coordinator.status === "stopping"
        ? "text-[#f1f58f] border-[#f1f58f] animate-pulse"
        : "text-[#6d746f] border-[#29302c]",
  );

  const canStart = $derived(coordinator.status === "idle");
  const canStop = $derived(coordinator.status === "running");
</script>

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
