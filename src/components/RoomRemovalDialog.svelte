<script lang="ts">
  import { onMount, tick } from "svelte";

  interface Props {
    mode: "delete" | "leave";
    roomTitle: string;
    hostLabel: string;
    coordinatorLabel: string;
    messageCount: number;
    pendingInviteCount?: number;
    joinRequestPending?: boolean;
    onConfirm: () => boolean | Promise<boolean>;
    onClose: () => void;
  }

  let {
    mode,
    roomTitle,
    hostLabel,
    coordinatorLabel,
    messageCount,
    pendingInviteCount = 0,
    joinRequestPending = false,
    onConfirm,
    onClose,
  }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let cancelButton: HTMLButtonElement | undefined = $state();
  let busy = $state(false);
  let error = $state("");

  const isDelete = $derived(mode === "delete");
  const titleId = $derived(`room-${mode}-title`);
  const descriptionId = $derived(`room-${mode}-description`);
  const messageLabel = $derived(`${messageCount} cached ${messageCount === 1 ? "message" : "messages"}`);
  const failureMessage = $derived(`Couldn’t ${mode} # ${roomTitle}. Try again.`);

  onMount(() => {
    dialog?.showModal();
    void tick().then(() => cancelButton?.focus());
  });

  function requestClose(): void {
    if (!busy) dialog?.close("cancel");
  }

  async function confirm(): Promise<void> {
    if (busy) return;
    busy = true;
    error = "";
    try {
      const confirmed = await onConfirm();
      if (confirmed) {
        dialog?.close("confirmed");
        return;
      }
      error = failureMessage;
      busy = false;
    } catch {
      error = failureMessage;
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class:delete={isDelete}
  class="room-removal-dialog"
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  data-testid="room-removal-dialog"
  oncancel={(event) => {
    event.preventDefault();
    requestClose();
  }}
  onclose={onClose}
  onclick={(event) => {
    if (event.target === dialog) requestClose();
  }}
>
  <section class="dialog-card">
    <header>
      <div>
        <p>{isDelete ? "Host control" : "Room membership"}</p>
        <h2 id={titleId}>{isDelete ? "Delete" : "Leave"} #{roomTitle}?</h2>
      </div>
      <button class="icon-close" type="button" aria-label={`Cancel ${mode} room`} disabled={busy} onclick={requestClose}>×</button>
    </header>

    <div class="dialog-body" id={descriptionId} data-testid="room-removal-impact">
      <p class="room-context"><span>Coordinator</span> {coordinatorLabel}<br /><span>Host</span> {hostLabel}</p>
      {#if isDelete}
        <p>This closes the room on your coordinator and permanently removes its invite, host keys, and {messageLabel} from this device.</p>
        <p>Members may retain cached copies, but they will no longer be able to send or sync this room.</p>
        {#if pendingInviteCount > 0}
          <p class="warning">{pendingInviteCount} {pendingInviteCount === 1 ? "person is" : "people are"} waiting to join. Those requests will be discarded.</p>
        {/if}
        <p class="final-warning">This cannot be undone.</p>
      {:else}
        <p>This removes your membership keys and {messageLabel} from this device. You’ll stop receiving messages and need a current invite to rejoin.</p>
        <p>Other members won’t be notified.</p>
        {#if joinRequestPending}
          <p class="warning">Your pending request may remain visible to the host until it expires.</p>
        {/if}
      {/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
    </div>

    <footer>
      <button bind:this={cancelButton} class="cancel" type="button" disabled={busy} onclick={requestClose}>Cancel</button>
      <button
        class="confirm"
        type="button"
        disabled={busy}
        data-testid={isDelete ? "confirm-delete-room" : "confirm-leave-room"}
        onclick={() => void confirm()}
      >{busy ? (isDelete ? "Deleting…" : "Leaving…") : (isDelete ? "Delete room" : "Leave room")}</button>
    </footer>
  </section>
</dialog>

<style>
  .room-removal-dialog { width: min(29rem, calc(100vw - 1rem)); max-width: none; max-height: calc(100dvh - 1rem); margin: auto; border: 1px solid #5d4b42; background: transparent; padding: 0; color: #e8f5eb; box-shadow: 0 28px 90px rgb(0 0 0 / .72); }
  .room-removal-dialog::backdrop { background: rgb(2 7 4 / .68); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); }
  .dialog-card { display: grid; max-height: calc(100dvh - 1rem); grid-template-rows: auto minmax(0, 1fr) auto; background: #09100c; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #3e342f; padding: 1rem; }
  header p { color: #d99583; font-size: .58rem; font-weight: 750; letter-spacing: .16em; text-transform: uppercase; }
  h2 { margin-top: .35rem; color: #fff5f2; font-size: 1.15rem; font-weight: 650; overflow-wrap: anywhere; }
  .icon-close { display: grid; width: 2.75rem; height: 2.75rem; flex: 0 0 auto; place-items: center; border: 0; background: transparent; color: #8e7d76; font-size: 1.25rem; }
  .icon-close:hover, .icon-close:focus-visible { background: #1d1512; color: #fff5f2; outline: none; }
  .dialog-body { min-height: 0; overflow-y: auto; padding: 1rem; color: #adbbb1; font-size: .75rem; line-height: 1.65; }
  .dialog-body p + p { margin-top: .7rem; }
  .room-context { border-left: 2px solid #42624b; background: #0d1711; padding: .6rem .75rem; color: #dfffe7; }
  .room-context span { display: inline-block; min-width: 6.5rem; color: #82958a; font-size: .58rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .warning { border-left: 2px solid #d69c62; background: #1c160e; padding: .65rem .75rem; color: #f1c38e; }
  .final-warning { color: #ffaaa3; font-weight: 650; }
  .error { border: 1px solid #773c3a; background: #24100f; padding: .65rem .75rem; color: #ffaaa3; }
  footer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .5rem; border-top: 1px solid #3e342f; padding: .75rem; }
  footer button { min-height: 2.75rem; padding: .65rem .8rem; font-size: .7rem; font-weight: 650; }
  .cancel { border: 1px solid #405348; color: #b9cbbf; }
  .cancel:hover, .cancel:focus-visible { border-color: #7cf59d; color: #effff2; outline: none; }
  .confirm { border: 1px solid #dc6f66; background: #dc6f66; color: #190907; }
  .confirm:hover, .confirm:focus-visible { border-color: #ffaaa3; background: #ffaaa3; outline: none; }
  button:disabled { cursor: wait; opacity: .5; }

  @media (max-height: 350px) {
    header { padding: .65rem .75rem; }
    h2 { font-size: .95rem; }
    .dialog-body { padding: .65rem .75rem; line-height: 1.5; }
    footer { padding: .5rem; }
  }
</style>
