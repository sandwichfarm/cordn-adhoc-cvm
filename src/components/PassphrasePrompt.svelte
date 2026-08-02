<script lang="ts">
  import type { CoordinatorStore } from "../coordinator/coordinator.svelte";

  interface Props {
    coordinator: CoordinatorStore;
    embedded?: boolean;
  }

  let { coordinator, embedded = false }: Props = $props();
  let passphrase = $state("");
</script>

<section class:embedded class="operator-field unlock-page" data-testid="coordinator-unlock">
  <div class="unlock-shell">
    {#if !embedded}<header class="unlock-bar"><strong>CAHMLS</strong><span>Cordn Ad-Hoc MLS</span></header>{/if}
    <section class="unlock-stage">
      <div class="unlock-card">
        <p class="unlock-kicker">Coordinator locked</p>
        <h1>Unlock Cordn Ad-Hoc</h1>
        <p class="unlock-copy">Unlock your saved identity only when you want to manage or run this coordinator.</p>
        <form onsubmit={(event) => { event.preventDefault(); void coordinator.loadFromPassphrase(passphrase); }}>
          <label for="coordinator-passphrase">Passphrase</label>
          <input id="coordinator-passphrase" type="password" autocomplete="current-password" placeholder="passphrase" bind:value={passphrase} />
          {#if coordinator.passphraseError}<p class="unlock-error" data-testid="passphrase-error">{coordinator.passphraseError}</p>{/if}
          <button class="unlock-primary" type="submit">Unlock coordinator</button>
        </form>
        <details class="reset-key">
          <summary>Coordinator recovery</summary>
          <p>Create a new coordinator identity only if this key is no longer needed. This cannot be undone.</p>
          <button type="button" onclick={() => coordinator.generateFreshKey()}>Generate a new key instead</button>
        </details>
      </div>
    </section>
  </div>
</section>

<style>
  .unlock-page { width: 100%; height: 100dvh; max-height: 100dvh; overflow: hidden; color: #dfffe7; }
  .unlock-page.embedded { height: 100%; max-height: 100%; background: #101614; }
  .unlock-shell { display: grid; width: min(70rem, 100%); height: 100%; margin-inline: auto; grid-template-rows: auto minmax(0, 1fr); border-inline: 1px solid #21352a; background: rgb(7 12 9 / .82); }
  .embedded .unlock-shell { width: 100%; border: 0; }
  .unlock-bar { display: flex; align-items: baseline; gap: .75rem; border-bottom: 1px solid #21352a; padding: .75rem 1rem; }
  .unlock-bar strong { color: #f0fff3; font-size: 1.05rem; }
  .unlock-bar span { color: #718277; font-size: .58rem; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
  .unlock-stage { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: clamp(.75rem, 4vw, 2rem); }
  .unlock-card { width: min(30rem, 100%); margin: clamp(0rem, 8vh, 5rem) auto 0; border: 1px solid #293832; background: #080d0a; padding: clamp(1rem, 4vw, 1.6rem); }
  .unlock-kicker { color: #7cf59d; font-size: .58rem; font-weight: 750; letter-spacing: .18em; text-transform: uppercase; }
  h1 { margin-top: .55rem; color: #f2fff5; font-size: clamp(1.45rem, 5vw, 2.15rem); font-weight: 650; letter-spacing: -.035em; }
  .unlock-copy { margin-top: .65rem; color: #82958a; font-size: .7rem; line-height: 1.6; }
  form { display: grid; gap: .55rem; margin-top: 1.25rem; }
  label { color: #cfe2d4; font-size: .6rem; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
  input { width: 100%; min-height: 2.85rem; border: 1px solid #34433b; background: #050906; padding: .7rem .8rem; color: #effff2; outline: none; }
  input:focus { border-color: #7cf59d; box-shadow: 0 0 0 2px rgb(124 245 157 / .1); }
  .unlock-error { color: #ffaaa3; font-size: .68rem; }
  .unlock-primary { min-height: 2.85rem; border: 1px solid #7cf59d; background: #7cf59d; color: #08110b; font-size: .72rem; font-weight: 700; }
  .unlock-primary:hover { background: #c5ffcf; }
  .reset-key { margin-top: .8rem; border-top: 1px solid #202d25; padding-top: .7rem; }
  .reset-key summary { cursor: pointer; color: #718277; font-size: .58rem; }
  .reset-key p { margin-top: .65rem; color: #66786d; font-size: .58rem; line-height: 1.55; }
  .reset-key button { width: 100%; margin-top: .55rem; border: 1px solid #613838; padding: .65rem; color: #d88f8a; font-size: .62rem; }
  .reset-key button:hover { border-color: #ffaaa3; color: #ffaaa3; }

  @media (max-height: 620px) {
    .unlock-card { margin-top: 0; }
    .unlock-copy { display: none; }
    form { margin-top: .8rem; }
  }
</style>
