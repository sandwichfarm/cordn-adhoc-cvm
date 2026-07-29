<script lang="ts">
  import { generate } from "lean-qr";
  import { toSvgDataURL } from "lean-qr/extras/svg";
  import { createInviteUrl } from "../chat/invite";
  import { createHostedRoom } from "../chat/room-store";

  let { coordinatorPubkey, relayUrls }: { coordinatorPubkey: string; relayUrls: string[] } = $props();

  let title = $state("");
  let inviteUrl = $state("");
  let qrUrl = $state("");
  let error = $state("");
  let busy = $state(false);

  async function createInvite() {
    busy = true;
    error = "";
    try {
      const room = await createHostedRoom({ title, coordinatorPubkey, relayUrls });
      inviteUrl = createInviteUrl(window.location.origin, {
        groupId: room.id,
        coordinatorPubkey,
        relayUrls,
        title: room.title,
      });
      qrUrl = toSvgDataURL(generate(inviteUrl), { on: "#103e32", off: "#f5fbf8", pad: 2, scale: 4 });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not create invite";
    } finally {
      busy = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
  }
</script>

<section class="operator-panel rounded-xl border border-[#21482b] bg-[#06150d]/85 p-5 shadow-[0_0_32px_rgba(55,255,126,0.05)]" data-testid="invite-panel">
  <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-xs uppercase tracking-[0.18em] text-[#6f8c75]">Invite-only chat</p>
      <h2 class="mt-1 text-xl text-[#d1ffd9]">Open a small room</h2>
    </div>
    <span class="text-xs text-[#80af88]">Encrypted MLS • your coordinator • no setup for guests</span>
  </div>
  <div class="mt-4 flex flex-col gap-3 sm:flex-row">
    <label class="flex-1 text-sm text-[#b5d8bb]">
      Room name
      <input bind:value={title} class="mt-1 w-full rounded border border-[#315a3a] bg-[#031009] px-3 py-2 text-[#e5ffea] outline-none focus:border-[#87ff9f]" placeholder="Friday plans" />
    </label>
    <button class="mt-6 rounded border border-[#87ff9f] bg-[#87ff9f] px-4 py-2 text-sm font-medium text-[#071109] hover:bg-[#c3ffce] disabled:opacity-50" onclick={createInvite} disabled={busy || relayUrls.length === 0}>
      {busy ? "Creating…" : "Create invite"}
    </button>
  </div>
  {#if error}<p class="mt-3 text-sm text-[#ff9f9f]">{error}</p>{/if}
  {#if inviteUrl}
    <div class="mt-5 grid gap-4 rounded-lg border border-[#315a3a] bg-[#031009] p-4 sm:grid-cols-[auto_1fr]">
      <a href={inviteUrl} aria-label="Open chat invite" class="w-fit rounded bg-[#f5fbf8] p-2"><img src={qrUrl} alt="QR code for chat invite" class="h-32 w-32" /></a>
      <div class="min-w-0">
        <p class="text-sm text-[#d1ffd9]">Your invite is ready</p>
        <p class="mt-1 text-xs leading-5 text-[#7fa987]">It contains this coordinator’s public key and relay hints. Guests see only the chat.</p>
        <code class="mt-3 block break-all rounded bg-black/30 p-2 text-xs text-[#a6ffb8]">{inviteUrl}</code>
        <div class="mt-3 flex gap-2">
          <button class="rounded border border-[#426c4b] px-3 py-2 text-xs text-[#b9ffca] hover:border-[#87ff9f]" onclick={copy}>Copy link</button>
          <a class="rounded border border-[#426c4b] px-3 py-2 text-xs text-[#b9ffca] hover:border-[#87ff9f]" href={inviteUrl}>Open host chat</a>
        </div>
      </div>
    </div>
  {/if}
</section>
