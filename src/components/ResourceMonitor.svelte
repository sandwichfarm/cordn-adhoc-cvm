<script lang="ts">
  import { resourceMonitor } from "../coordinator/resource-monitor.svelte";

  const memoryDisplay = $derived(
    resourceMonitor.memoryBytes === null
      ? "unavailable"
      : `${(resourceMonitor.memoryBytes / 1_048_576).toFixed(1)} MB (est.)`,
  );
</script>

<section class="mx-auto grid max-w-3xl gap-4 border-b border-[#16331f] pb-8" data-testid="resource-monitor">
  <h2 class="text-sm uppercase tracking-[0.22em] text-[#d1ffd9]">Telemetry</h2>

  <dl class="grid gap-3 text-sm sm:grid-cols-3">
    <div class="border border-[#16331f] bg-[#050805] p-3">
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">subscriptions</dt>
      <dd class="mt-2 text-xl text-[#87ff9f]" data-testid="telemetry-subscriptions">
        {resourceMonitor.subscriptionCount} <span class="text-xs text-[#6d746f]">(est.)</span>
      </dd>
    </div>

    <div class="border border-[#16331f] bg-[#050805] p-3">
      <dt class="text-xs uppercase tracking-[0.16em] text-[#6d746f]">msg rate</dt>
      <dd class="mt-2 text-xl text-[#87ff9f]" data-testid="telemetry-message-rate">
        {resourceMonitor.messageRate} <span class="text-xs text-[#6d746f]">/min (est.)</span>
      </dd>
    </div>

    <div class="border border-[#16331f] bg-[#050805] p-3">
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
