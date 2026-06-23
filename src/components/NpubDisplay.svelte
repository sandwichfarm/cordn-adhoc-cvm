<script lang="ts">
  import type { CoordinatorIdentity } from "../crypto/key-manager";

  interface Props {
    identity: CoordinatorIdentity;
  }

  let { identity }: Props = $props();
  let copied = $state(false);

  const truncated = $derived(`${identity.npub.slice(0, 16)}…${identity.npub.slice(-10)}`);

  async function copyPubkey(): Promise<void> {
    await navigator.clipboard.writeText(identity.publicKeyHex);
    copied = true;
    window.setTimeout(() => {
      copied = false;
    }, 1200);
  }
</script>

<button
  class="max-w-full border border-[#21482b] bg-[#061108] px-3 py-2 text-left text-sm text-[#87ff9f] transition hover:border-[#87ff9f] focus:outline-none focus:ring-2 focus:ring-[#87ff9f]"
  type="button"
  aria-label="Copy coordinator public key"
  onclick={copyPubkey}
>
  <span class="block text-[10px] uppercase tracking-[0.18em] text-[#617767]">coordinator pubkey</span>
  <span class="block truncate">{truncated}</span>
  {#if copied}
    <span class="block text-xs text-[#f1f58f]">copied hex</span>
  {/if}
</button>
