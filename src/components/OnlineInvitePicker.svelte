<script lang="ts">
  import { nip19 } from "nostr-tools";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";
  import { userProfileStore } from "../identity/user-profile.svelte";

  interface Props {
    inviteUrl: string;
    roomTitle: string;
  }

  let { inviteUrl, roomTitle }: Props = $props();
  let sending = $state("");
  let sent = $state<string[]>([]);
  let error = $state("");

  async function invite(pubkey: string): Promise<void> {
    sending = pubkey;
    error = "";
    try {
      await nostrSocialStore.sendInvite(pubkey, inviteUrl, roomTitle);
      if (!sent.includes(pubkey)) sent = [...sent, pubkey];
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not send invite";
    } finally {
      sending = "";
    }
  }

  function shortNpub(pubkey: string): string {
    try {
      const npub = nip19.npubEncode(pubkey);
      return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
    } catch {
      return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
    }
  }
</script>

<section class="online-picker">
  <header><div><p>Invite online mutuals</p><span>Only people who follow you back appear here.</span></div><strong>{nostrSocialStore.onlineContacts.length}</strong></header>
  {#if userProfileStore.method === "anonymous"}
    <p class="empty">Connect NIP-07 or NIP-46 from your profile to send private Nostr invites.</p>
  {:else if nostrSocialStore.status === "connecting"}
    <p class="empty">Checking mutual follows and private presence…</p>
  {:else if nostrSocialStore.onlineContacts.length === 0}
    <p class="empty">No mutual follows are online right now.</p>
  {:else}
    <div class="online-list">
      {#each nostrSocialStore.onlineContacts as contact (contact.pubkey)}
        <article>
          <span class="online-avatar"><img src={contact.avatar} alt="" /><i aria-hidden="true"></i></span>
          <span class="online-identity"><strong>{contact.name}</strong><code title={contact.pubkey}>{shortNpub(contact.pubkey)}</code></span>
          <button type="button" disabled={sending === contact.pubkey || sent.includes(contact.pubkey)} onclick={() => void invite(contact.pubkey)}>{sent.includes(contact.pubkey) ? "Sent" : sending === contact.pubkey ? "Sending…" : "Invite"}</button>
        </article>
      {/each}
    </div>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}
</section>

<style>
  .online-picker { border-top: 1px solid #293832; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .8rem 1.1rem; }
  header p { color: #dfffe7; font-size: .68rem; font-weight: 650; }
  header span { display: block; margin-top: .2rem; color: #718277; font-size: .55rem; }
  header > strong { display: grid; min-width: 1.4rem; height: 1.4rem; place-items: center; background: #132019; color: #7cf59d; font-size: .58rem; }
  .empty { padding: 0 1.1rem 1rem; color: #718277; font-size: .62rem; line-height: 1.55; }
  .online-list { display: grid; max-height: 13rem; overflow-y: auto; border-top: 1px solid #202d25; }
  article { display: grid; grid-template-columns: 2.1rem minmax(0, 1fr) auto; align-items: center; gap: .65rem; padding: .6rem 1.1rem; }
  article + article { border-top: 1px solid #202d25; }
  .online-avatar { position: relative; }
  .online-avatar img { display: block; width: 2.1rem; height: 2.1rem; border-radius: 50%; object-fit: cover; }
  .online-avatar i { position: absolute; right: -.05rem; bottom: -.05rem; width: .55rem; height: .55rem; border: 2px solid #09100c; border-radius: 50%; background: #7cf59d; }
  .online-identity { min-width: 0; }
  .online-identity strong, .online-identity code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .online-identity strong { color: #dfffe7; font-size: .66rem; }
  .online-identity code { margin-top: .16rem; color: #718277; font: inherit; font-size: .52rem; }
  article button { border: 1px solid #496451; padding: .4rem .55rem; color: #bfeac8; font-size: .56rem; }
  article button:hover:not(:disabled) { border-color: #7cf59d; color: #7cf59d; }
  article button:disabled { opacity: .5; }
  .error { border-top: 1px solid #512f2b; padding: .6rem 1.1rem; color: #ffaaa3; font-size: .58rem; }
</style>
