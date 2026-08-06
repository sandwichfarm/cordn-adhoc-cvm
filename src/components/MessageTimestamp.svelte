<script lang="ts">
  import { onMount } from "svelte";
  import { nextRelativeMessageTimeDelay, relativeMessageTime } from "../chat/message-presentation";

  interface Props {
    createdAt: number;
    pending?: boolean;
  }

  let { createdAt, pending = false }: Props = $props();
  let now = $state(Date.now());
  let timer: ReturnType<typeof setTimeout> | null = null;
  const label = $derived(relativeMessageTime(createdAt, now));

  function schedule(): void {
    if (timer !== null) clearTimeout(timer);
    const delay = nextRelativeMessageTimeDelay(createdAt, Date.now());
    if (delay === null) return;
    timer = setTimeout(() => {
      now = Date.now();
      schedule();
    }, delay);
  }

  onMount(() => {
    now = Date.now();
    schedule();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  });
</script>

<span class="message-timestamp">
  <time datetime={new Date(createdAt).toISOString()} title={new Date(createdAt).toLocaleString()}>{label}</time>
  {#if pending}<span>sending…</span>{/if}
</span>

<style>
  .message-timestamp { display: flex; min-height: .8rem; align-items: center; gap: .35rem; margin-top: .3rem; color: #687a70; font-size: .55rem; line-height: 1.25; }
  time { font-variant-numeric: tabular-nums; }
</style>

