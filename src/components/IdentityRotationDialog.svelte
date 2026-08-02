<script lang="ts">
  import { onMount, tick } from "svelte";

  interface Props {
    variant: "confirm" | "recovery";
    membershipCount: number;
    onConfirm: () => Promise<void>;
    onClose: () => void;
  }

  let { variant, membershipCount, onConfirm, onClose }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let safeButton: HTMLButtonElement | undefined = $state();
  let busy = $state(false);
  let error = $state("");
  const isRecovery = $derived(variant === "recovery");
  const titleId = $derived(`identity-${variant}-title`);
  const descriptionId = $derived(`identity-${variant}-description`);
  const impact = $derived(membershipCount === 0
    ? "No local room memberships will be removed."
    : `${membershipCount} local room membership${membershipCount === 1 ? " will" : "s will"} be removed.`);

  onMount(() => {
    dialog?.showModal();
    if (!isRecovery) void tick().then(() => safeButton?.focus());
  });

  function requestClose(): void {
    if (!busy && !isRecovery) dialog?.close("cancel");
  }

  async function confirm(): Promise<void> {
    if (busy) return;
    busy = true;
    error = "";
    try {
      await onConfirm();
      dialog?.close("confirmed");
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Unable to create a new local identity. No identity is active. Try again.";
      busy = false;
      if (!isRecovery) void tick().then(() => safeButton?.focus());
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="identity-rotation-dialog"
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  data-testid="identity-rotation-dialog"
  oncancel={(event) => { event.preventDefault(); requestClose(); }}
  onclose={onClose}
  onclick={(event) => { if (event.target === dialog) requestClose(); }}
>
  <section class="dialog-card">
    <header>
      <div>
        {#if !isRecovery}<p>Privacy boundary</p>{/if}
        <h2 id={titleId}>{isRecovery ? "Recover local identity" : "Rotate local identity?"}</h2>
      </div>
    </header>
    <div class="dialog-body" id={descriptionId}>
      {#if isRecovery}
        <p>Saved local identity data on this device could not be verified. Create a new device-local identity to continue. Local room access will be removed, and new invites are required before sending to those rooms again.</p>
      {:else}
        <p class="impact">{impact}</p>
        {#if membershipCount === 0}
          <h3>No local room memberships</h3>
          <p>This identity has no locally stored room access to remove.</p>
        {/if}
        <p>This creates a new device-local identity. Your local room memberships on this device will be removed, and you’ll need a new invite before you can send in those rooms again. This does not delete coordinator-hosted room data for other participants.</p>
      {/if}
      {#if busy}<p class="live" aria-live="polite">{isRecovery ? "Creating…" : "Rotating…"}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>
    <footer>
      {#if !isRecovery}
        <button bind:this={safeButton} class="safe" type="button" disabled={busy} onclick={requestClose}>Keep current identity</button>
      {/if}
      <button class="confirm" type="button" disabled={busy} onclick={() => void confirm()}>{busy ? (isRecovery ? "Creating…" : "Rotating…") : (isRecovery ? "Create new identity" : "Rotate identity")}</button>
    </footer>
  </section>
</dialog>

<style>
  .identity-rotation-dialog { width: min(29rem, calc(100vw - 1rem)); max-width: none; max-height: calc(100dvh - 1rem); margin: auto; border: 1px solid #3e342f; background: transparent; padding: 0; color: #e8f5eb; box-shadow: 0 28px 90px rgb(0 0 0 / .72); }
  .identity-rotation-dialog::backdrop { background: #030303; }
  .dialog-card { display: grid; max-height: calc(100dvh - 1rem); grid-template-rows: auto minmax(0, 1fr) auto; background: #09100c; }
  header { padding: 1rem; border-bottom: 1px solid #3e342f; }
  header p { color: #ffaaa3; font-size: 10px; font-weight: 400; letter-spacing: .16em; text-transform: uppercase; }
  h2 { margin-top: .35rem; color: #fff5f2; font-size: 18px; font-weight: 650; line-height: 1.2; overflow-wrap: anywhere; }
  .dialog-body { min-height: 0; overflow-y: auto; padding: 1rem; color: #c5d3c8; font-size: 12px; font-weight: 400; line-height: 1.5; overflow-wrap: anywhere; }
  .dialog-body p + p, .dialog-body h3 + p { margin-top: 1rem; }
  .impact { color: #effff2; font-size: 14px; font-weight: 650; line-height: 1.4; }
  h3 { margin-top: 1rem; color: #effff2; font-size: 14px; font-weight: 650; line-height: 1.4; }
  .error { margin-top: 1rem; border: 1px solid #773c3a; background: #24100f; padding: .65rem .75rem; color: #ffaaa3; }
  .live { margin-top: 1rem; color: #87ff9f; }
  footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; border-top: 1px solid #3e342f; padding: .75rem; }
  footer:has(.confirm:only-child) { grid-template-columns: minmax(0, 1fr); }
  footer button { min-height: 44px; padding: .65rem .8rem; font-size: 12px; font-weight: 400; }
  .safe { border: 1px solid #405348; color: #b9cbbf; }
  .safe:hover { border-color: #87ff9f; color: #effff2; }
  .confirm { border: 1px solid #dc6f66; background: #dc6f66; color: #190907; }
  .confirm:hover { border-color: #ffaaa3; background: #ffaaa3; }
  button:focus-visible { outline: 2px solid #87ff9f; outline-offset: 2px; }
  button:disabled { cursor: wait; opacity: .5; }
</style>
