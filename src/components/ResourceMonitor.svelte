<script lang="ts">
  import { resourceMonitor } from "../coordinator/resource-monitor.svelte";

  let { compact = false }: { compact?: boolean } = $props();

  const memoryDisplay = $derived(
    resourceMonitor.memoryBytes === null
      ? "unavailable"
      : `${(resourceMonitor.memoryBytes / 1_048_576).toFixed(1)} MB (est.)`,
  );
</script>

<section class={compact ? "grid gap-2" : "mx-auto grid max-w-3xl gap-4 border-b border-[#16331f] pb-8"} data-testid="resource-monitor">
  {#if !compact}<h2 class="text-sm uppercase tracking-[0.22em] text-[#d1ffd9]">Telemetry</h2>{/if}

  <dl class={compact ? "grid grid-cols-2 gap-px overflow-hidden border border-[#21482b] bg-[#21482b] text-sm" : "grid gap-3 text-sm sm:grid-cols-4"}>
    <div class={compact ? "bg-[#071109] p-2" : "border border-[#16331f] bg-[#050805] p-3"}>
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">client streams</dt>
      <dd class="mt-2 text-xl text-[#87ff9f]" data-testid="telemetry-client-streams">
        {resourceMonitor.subscriptionCount} <span class="text-xs text-[#6d746f]">(est.)</span>
      </dd>
    </div>

    <div class={compact ? "bg-[#071109] p-2" : "border border-[#16331f] bg-[#050805] p-3"}>
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">fan-out legs</dt>
      <dd class="mt-2 text-xl text-[#87ff9f]" data-testid="telemetry-fanout-legs">
        {resourceMonitor.groupSubscriptionLegCount} <span class="text-xs text-[#6d746f]">(debug)</span>
      </dd>
    </div>

    <div class={compact ? "bg-[#071109] p-2" : "border border-[#16331f] bg-[#050805] p-3"}>
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">msg rate</dt>
      <dd class="mt-2 text-xl text-[#87ff9f]" data-testid="telemetry-message-rate">
        {resourceMonitor.messageRate} <span class="text-xs text-[#6d746f]">/min (est.)</span>
      </dd>
    </div>

    <div class={compact ? "bg-[#071109] p-2" : "border border-[#16331f] bg-[#050805] p-3"}>
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">memory</dt>
      <dd
        class={`mt-2 text-xl ${resourceMonitor.memoryBytes === null ? "text-[#6d746f]" : "text-[#87ff9f]"}`}
        data-testid="telemetry-memory"
      >
        {memoryDisplay}
      </dd>
    </div>
  </dl>
</section>
