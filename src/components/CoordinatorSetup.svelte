<script lang="ts">
  import { tick } from "svelte";
  import { userProfileStore } from "../identity/user-profile.svelte";
  import OperatorIdentityChoices from "./OperatorIdentityChoices.svelte";

  interface Props {
    setupState: "checking" | "identity" | "required-name" | "saving";
    onComplete: (name: string) => Promise<void>;
  }

  let { setupState: requestedState, onComplete }: Props = $props();
  let stage = $state<"identity" | "name">("identity");
  let name = $state("My coordinator");
  let nameTouched = $state(false);
  let profileNameMissing = $state(false);
  let profileSuggestionAnnouncement = $state("");
  let nameInvalid = $state(false);
  let saving = $state(false);
  let nameInput = $state<HTMLInputElement>();

  const normalizedName = $derived(name.trim());
  const canSave = $derived(normalizedName.length > 0 && !saving);
  const visibleState = $derived(requestedState === "checking" ? "checking" : saving ? "saving" : stage === "name" ? "required-name" : "identity");

  async function continueAnonymously(): Promise<void> {
    // The durable anonymous signer is initialized once by UserProfileStore. This
    // only selects that existing identity; it never creates coordinator authority.
    userProfileStore.setAnonymous();
    stage = "name";
    await tick();
    nameInput?.focus();
  }

  async function continueWithSigner(): Promise<void> {
    const suggestedName = profileSuggestion();
    profileNameMissing = suggestedName === "My coordinator";
    if (!nameTouched && (name === "My coordinator" || !name.trim())) name = Array.from(suggestedName).slice(0, 48).join("");
    stage = "name";
    await tick();
    nameInput?.focus();
  }

  function profileSuggestion(): string {
    const profile = userProfileStore.profile;
    if (typeof profile?.display_name === "string" && profile.display_name.trim()) return profile.display_name.trim();
    if (typeof profile?.name === "string" && profile.name.trim()) return profile.name.trim();
    return "My coordinator";
  }

  $effect(() => {
    if (stage !== "name" || userProfileStore.method === "anonymous" || nameTouched) return;
    const suggestion = profileSuggestion();
    if (suggestion === "My coordinator" || (name !== "My coordinator" && name.trim())) return;
    name = Array.from(suggestion).slice(0, 48).join("");
    profileNameMissing = false;
    profileSuggestionAnnouncement = "Coordinator name suggestion updated from your Nostr profile.";
  });

  function validateName(): boolean {
    nameInvalid = normalizedName.length === 0;
    return !nameInvalid;
  }

  async function submit(): Promise<void> {
    if (!validateName() || saving) return;
    saving = true;
    try {
      await onComplete(normalizedName);
    } finally {
      saving = false;
    }
  }

  async function recoverAnonymousIdentity(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await userProfileStore.recoverAnonymousIdentity();
    } finally {
      saving = false;
    }
  }
</script>

<section
  class="coordinator-setup"
  data-testid="coordinator-setup"
  data-setup-state={visibleState}
  aria-labelledby="coordinator-setup-heading"
>
  {#if requestedState === "checking"}
    <div class="setup-copy">
      <p class="setup-kicker">First run</p>
      {#if userProfileStore.recoveryRequired}
        <h1 id="coordinator-setup-heading">Recover local identity</h1>
        <p>Your local operator identity needs recovery before coordinator setup can continue.</p>
        <button class="setup-save" type="button" disabled={saving} onclick={() => void recoverAnonymousIdentity()}>{saving ? "Creating identity…" : "Create new identity"}</button>
        {#if userProfileStore.error}<p role="alert">Unable to create a new identity. Try again.</p>{/if}
      {:else}
        <h1 id="coordinator-setup-heading">Preparing your coordinator</h1>
        <p role="status">Checking local coordinator setup…</p>
      {/if}
    </div>
  {:else if stage === "identity"}
    <div class="setup-copy" data-testid="setup-identity-stage">
      <p class="setup-kicker">First run</p>
      <h1 id="coordinator-setup-heading">Choose your operator identity</h1>
      <p>Use a Nostr signer or continue with a durable identity stored only in this browser.</p>
    </div>
    <div class="setup-actions">
      <OperatorIdentityChoices testIdPrefix="setup" autoFocus onIdentityReady={continueWithSigner} />
      <button
        class="setup-anonymous"
        data-testid="setup-anonymous"
        type="button"
        disabled={!userProfileStore.initialized || userProfileStore.recoveryRequired}
        onclick={() => void continueAnonymously()}
      >
        <strong>Continue anonymously</strong>
        <small>No account required. This browser keeps a durable local identity.</small>
      </button>
    </div>
  {:else}
    <form class="setup-form" data-testid="setup-name-stage" onsubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div class="setup-copy">
        <p class="setup-kicker">First run · 2 of 2</p>
        <h1 id="coordinator-setup-heading">Name your coordinator</h1>
        <p>This name identifies the coordinator to people using Cordn-compatible clients. It is separate from your operator profile.</p>
      </div>
      <label for="setup-coordinator-name">Coordinator name</label>
      {#if profileNameMissing}
        <div data-testid="setup-profile-empty" class="profile-empty">
          <strong>No Nostr profile name available</strong>
          <p>Choose a coordinator name to continue.</p>
        </div>
      {/if}
      <input
        bind:this={nameInput}
        id="setup-coordinator-name"
        data-testid="setup-coordinator-name"
        value={name}
        maxlength="48"
        aria-invalid={nameInvalid ? "true" : undefined}
        aria-describedby={nameInvalid ? "setup-name-error" : undefined}
        oninput={(event) => { name = event.currentTarget.value; nameTouched = true; if (nameInvalid) validateName(); }}
        onblur={validateName}
      />
      {#if nameInvalid}<p id="setup-name-error" data-testid="setup-name-error" role="alert">Enter a coordinator name to continue.</p>{/if}
      <button class="setup-save" data-testid="setup-save" type="submit" disabled={!canSave}>
        {saving ? "Saving…" : "Save and continue"}
      </button>
      <p class="setup-note" aria-live="polite">{nameTouched ? "You can change this name later in coordinator settings." : ""}</p>
      <p class="sr-only" aria-live="polite">{profileSuggestionAnnouncement}</p>
    </form>
  {/if}
</section>

<style>
  .coordinator-setup { width: min(34rem, calc(100% - 32px)); max-height: 100%; overflow-y: auto; border: 1px solid #496451; background: #101614; padding: clamp(1.5rem, 5vh, 3rem); color: #dfffe7; }
  .setup-copy, .setup-form, .setup-actions { display: grid; gap: 1rem; }
  .setup-copy { margin-bottom: 1.5rem; }
  .setup-kicker { margin: 0; color: #7cf59d; font-size: 10px; font-weight: 400; letter-spacing: .14em; line-height: 1.3; text-transform: uppercase; }
  h1 { margin: 0; color: #effff2; font-size: 28px; font-weight: 600; line-height: 1.2; }
  p { margin: 0; color: #82958a; font-size: 12px; line-height: 1.5; }
  label { color: #cfe2d4; font-size: 12px; line-height: 1.5; }
  input { min-height: 44px; border: 1px solid #34483a; background: #030303; padding: .65rem .75rem; color: #effff2; font: inherit; }
  input:focus-visible, button:focus-visible { outline: 2px solid #7cf59d; outline-offset: 2px; }
  input[aria-invalid="true"] { border-color: #ffaaa3; }
  [role="alert"] { color: #ffaaa3; }
  .setup-anonymous, .setup-save { min-height: 44px; border: 1px solid #7cf59d; background: #0d1711; padding: .75rem; color: #dfffe7; text-align: left; }
  .setup-anonymous strong { display: block; font-size: 18px; font-weight: 600; line-height: 1.2; }
  .setup-anonymous small { display: block; margin-top: .25rem; color: #82958a; font-size: 12px; line-height: 1.5; }
  .setup-save { color: #7cf59d; text-align: center; font-size: 12px; }
  button:disabled { cursor: not-allowed; opacity: .45; }
  .setup-note { min-height: 1.25rem; }
  .profile-empty { display: grid; gap: 4px; border-left: 2px solid #496451; padding-left: 8px; }
  .profile-empty strong { color: #dfffe7; font-size: 12px; font-weight: 600; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (max-width: 520px) { .coordinator-setup { width: min(100% - 16px, 34rem); padding: 1.5rem 1rem; } }
</style>
