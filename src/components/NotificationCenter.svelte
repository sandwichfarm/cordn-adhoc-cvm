<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { notificationCenter, type NotificationCategory } from "../notifications/notification-center.svelte";
  import { viewportOverlay } from "../lib/viewport-overlay";

  const categoryOptions: Array<{ id: NotificationCategory; title: string; detail: string }> = [
    { id: "user_online", title: "People coming online", detail: "Enabled by default" },
    { id: "new_message", title: "New messages", detail: "Message text stays private" },
    { id: "room_invite", title: "Room invites", detail: "Private invites from your contacts" },
    { id: "join_request", title: "Join requests", detail: "Guests waiting or auto-admitted" },
  ];

  let open = $state(false);
  let requesting = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let dialog: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();

  const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

  function syncPermission(): void {
    notificationCenter.syncPermission();
  }

  onMount(() => {
    document.addEventListener("visibilitychange", syncPermission);
    window.addEventListener("focus", syncPermission);
  });

  onDestroy(() => {
    document.removeEventListener("visibilitychange", syncPermission);
    window.removeEventListener("focus", syncPermission);
  });

  function openSettings(): void {
    notificationCenter.syncPermission();
    open = true;
    void tick().then(() => closeButton?.focus());
  }

  async function enableDesktopNotifications(): Promise<void> {
    requesting = true;
    try {
      await notificationCenter.requestPermission();
    } catch {
      notificationCenter.syncPermission();
    } finally {
      requesting = false;
    }
  }

  function toggleCategory(category: NotificationCategory, event: Event): void {
    notificationCenter.setCategory(category, (event.currentTarget as HTMLInputElement).checked);
  }

  function close(): void {
    open = false;
    void tick().then(() => trigger?.focus());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<div class="notification-center">
  <button
    class:active={notificationCenter.active}
    class="notification-trigger"
    type="button"
    bind:this={trigger}
    aria-label="Notification settings"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={openSettings}
  >
    <span>Notification settings</span>
    {#if notificationCenter.active}<span class="active-pip" aria-label="Notifications enabled"></span>{/if}
  </button>

  {#if open}
    <button class="notification-backdrop" type="button" aria-label="Close notification settings" onclick={close}></button>
    <div bind:this={dialog} use:viewportOverlay={{ anchor: trigger, preferredSide: "above", align: "end", compactSheetBelow: 900 }} class="notification-menu" role="dialog" aria-modal="true" aria-labelledby="notification-title" tabindex="-1" onkeydown={handleKeydown}>
      <header>
        <div>
          <p>Preferences</p>
          <h2 id="notification-title">Notification settings</h2>
        </div>
        <button bind:this={closeButton} type="button" aria-label="Close notification settings" onclick={close}>×</button>
      </header>

      {#if notificationCenter.permission === "unsupported"}
        <div class="permission-note blocked"><strong>Desktop notifications are unavailable</strong><span>This browser does not offer desktop notifications. Your in-app feed remains available.</span></div>
      {:else if notificationCenter.permission === "denied"}
        <div class="permission-note blocked"><strong>Desktop notifications are off</strong><span>Notifications are blocked by your browser. Change the browser setting, then reopen Notification settings.</span></div>
      {:else if notificationCenter.permission === "default"}
        <div class="permission-note"><strong>Desktop notifications are off</strong><span>Enable grouped desktop updates for this device. Your in-app feed stays available either way.</span><button type="button" disabled={requesting} onclick={() => void enableDesktopNotifications()}>{requesting ? "Enabling…" : "Enable desktop notifications"}</button></div>
      {:else}
        <label class="master-option">
          <span><strong>Desktop notifications</strong><small>{notificationCenter.enabled ? "Desktop notifications are enabled" : "Desktop notifications are off"}</small></span>
          <input type="checkbox" checked={notificationCenter.enabled} onchange={(event) => notificationCenter.setEnabled((event.currentTarget as HTMLInputElement).checked)} />
        </label>

      {/if}
      <div class:paused={!notificationCenter.active} class="notification-options">
        {#each categoryOptions as option (option.id)}
          <label>
            <span><strong>{option.title}</strong><small>{option.detail}</small></span>
            <input type="checkbox" checked={notificationCenter.categories[option.id]} disabled={!notificationCenter.active} onchange={(event) => toggleCategory(option.id, event)} />
          </label>
        {/each}
      </div>

      <label class:paused={!notificationCenter.active} class="cadence-option">
        <span><strong>Group updates</strong><small>One concise notification per interval</small></span>
        <select disabled={!notificationCenter.active} value={notificationCenter.cadenceMs} onchange={(event) => notificationCenter.setCadence(Number((event.currentTarget as HTMLSelectElement).value))}>
          <option value={5000}>Every 5 sec</option>
          <option value={15000}>Every 15 sec</option>
          <option value={30000}>Every 30 sec</option>
          <option value={60000}>Every minute</option>
        </select>
      </label>
    </div>
  {/if}
</div>

<style>
  .notification-center { position: relative; flex: 0 0 auto; }
  .notification-trigger { position: relative; display: flex; height: 2.65rem; align-items: center; gap: .45rem; border: 1px solid #293832; padding: 0 .7rem; color: #91a59a; font-size: .58rem; white-space: nowrap; }
  .notification-trigger:hover, .notification-trigger[aria-expanded="true"] { border-color: #496451; background: #101713; color: #dfffe7; }
  .notification-trigger:disabled { cursor: wait; opacity: .65; }
  .notification-trigger.active { color: #c9efd2; }
  .active-pip { width: .38rem; height: .38rem; border-radius: 999px; background: #7cf59d; box-shadow: 0 0 8px rgb(124 245 157 / .45); }
  .notification-backdrop { position: fixed; z-index: 69; inset: 0; cursor: default; }
  .notification-menu { position: absolute; z-index: 70; top: calc(100% + .45rem); right: 0; width: min(24rem, calc(100vw - 1rem)); border: 1px solid #496451; background: #090e0b; box-shadow: 0 18px 48px rgb(0 0 0 / .62); }
  .notification-menu header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #293832; padding: .8rem .9rem; }
  .notification-menu header p { color: #718277; font-size: .5rem; letter-spacing: .16em; text-transform: uppercase; }
  .notification-menu h2 { margin-top: .18rem; color: #effff2; font-size: .85rem; font-weight: 680; }
  .notification-menu header button { display: grid; width: 2.75rem; height: 2.75rem; place-items: center; color: #718277; }
  .notification-menu header button:hover { background: #162019; color: #effff2; }
  .master-option, .notification-options label, .cadence-option { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .78rem .9rem; }
  .master-option { background: #101813; }
  .notification-options { border-block: 1px solid #202d25; }
  .notification-options label + label { border-top: 1px solid #17221b; }
  label strong, label small, .permission-note strong, .permission-note span { display: block; }
  label strong { color: #d9ecde; font-size: .65rem; font-weight: 620; }
  label small { margin-top: .18rem; color: #718277; font-size: .52rem; }
  input[type="checkbox"] { width: 1rem; height: 1rem; flex: 0 0 auto; accent-color: #7cf59d; }
  .paused { opacity: .46; }
  .cadence-option select { border: 1px solid #34483a; background: #0b120d; padding: .38rem .45rem; color: #c9ddd0; font-size: .55rem; outline: none; }
  .cadence-option select:focus { border-color: #7cf59d; }
  .permission-note { padding: 1rem; }
  .permission-note strong { color: #e2f4e7; font-size: .7rem; }
  .permission-note span { margin-top: .35rem; color: #91a59a; font-size: .6rem; line-height: 1.55; }
  .permission-note button { margin-top: .8rem; border: 1px solid #7cf59d; background: #7cf59d; padding: .5rem .65rem; color: #071009; font-size: .58rem; font-weight: 700; }
  .permission-note.blocked strong { color: #ffaaa3; }
  @media (max-width: 700px) {
    .notification-trigger:not(.needs-permission) span:nth-child(2) { display: none; }
    .notification-trigger:not(.needs-permission) { width: 2.65rem; justify-content: center; padding: 0; }
    .active-pip { position: absolute; top: .4rem; right: .4rem; }
  }
</style>
