<script lang="ts">
  import { resourceMonitor } from "../coordinator/resource-monitor.svelte";

  let { compact = false }: { compact?: boolean } = $props();

  const memoryDisplay = $derived(
    resourceMonitor.memoryBytes === null
      ? "unavailable"
      : `${(resourceMonitor.memoryBytes / 1_048_576).toFixed(1)} MB (est.)`,
  );
</script>

<section class:compact class="resource-monitor" data-testid="resource-monitor">
  {#if !compact}<h2 class="text-sm uppercase tracking-[0.22em] text-[#d1ffd9]">Telemetry</h2>{/if}

  <dl>
    <div>
      <dt>streams</dt>
      <dd data-testid="telemetry-client-streams">
        {resourceMonitor.subscriptionCount} <span class="text-xs text-[#6d746f]">(est.)</span>
      </dd>
    </div>

    <div>
      <dt>fan-out</dt>
      <dd data-testid="telemetry-fanout-legs">
        {resourceMonitor.groupSubscriptionLegCount}
      </dd>
    </div>

    <div>
      <dt>rate</dt>
      <dd data-testid="telemetry-message-rate">
        {resourceMonitor.messageRate} <span class="text-xs text-[#6d746f]">/min (est.)</span>
      </dd>
    </div>

    <div>
      <dt>memory</dt>
      <dd
        class:unavailable={resourceMonitor.memoryBytes === null}
        data-testid="telemetry-memory"
      >
        {memoryDisplay}
      </dd>
    </div>
  </dl>
</section>

<style>
  .resource-monitor { display: grid; gap: .5rem; }
  .resource-monitor:not(.compact) { max-width: 48rem; margin-inline: auto; border-bottom: 1px solid #16331f; padding-bottom: 2rem; }
  dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; background: rgb(42 69 51 / .28); }
  dl > div { min-width: 0; background: #09100c; padding: .55rem .6rem; opacity: .28; transition: opacity .16s ease, background .16s ease; }
  dl > div:hover, dl > div:focus-within { background: #0d1710; opacity: .95; }
  dt { overflow: hidden; color: #77837b; font-size: .52rem; letter-spacing: .12em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  dd { overflow: hidden; margin-top: .35rem; color: #7cf59d; font-size: .78rem; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
  dd span { color: #667169; font-size: .5rem; }
  dd.unavailable { color: #6d746f; }
  .resource-monitor:not(.compact) dl > div { padding: .8rem; opacity: .5; }
  .resource-monitor:not(.compact) dd { font-size: 1rem; }

  @media (prefers-reduced-motion: reduce) {
    dl > div { transition: none; }
  }
</style>
