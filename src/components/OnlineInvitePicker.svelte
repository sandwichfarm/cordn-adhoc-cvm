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
  <header><div><p>Send in app</p><span>Online mutuals</span></div>{#if nostrSocialStore.onlineContacts.length > 0}<strong>{nostrSocialStore.onlineContacts.length}</strong>{/if}</header>
  {#if userProfileStore.method === "anonymous"}
    <p class="empty">Connect a Nostr identity to invite people here.</p>
  {:else if nostrSocialStore.status === "connecting"}
    <p class="empty">Finding people online…</p>
  {:else if nostrSocialStore.onlineContacts.length === 0}
    <p class="empty">No mutuals online.</p>
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
  .online-picker { border-top: 1px solid rgb(82 112 91 / .35); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .8rem .1rem .55rem; }
  header p { color: #dfffe7; font-size: .68rem; font-weight: 650; }
  header span { display: block; margin-top: .15rem; color: #718277; font-size: .52rem; }
  header > strong { color: #7cf59d; font-size: .58rem; }
  .empty { padding: 0 .1rem .3rem; color: #718277; font-size: .58rem; line-height: 1.5; }
  .online-list { display: grid; max-height: 13rem; overflow-y: auto; }
  article { display: grid; grid-template-columns: 2.1rem minmax(0, 1fr) auto; align-items: center; gap: .65rem; padding: .5rem .1rem; }
  article + article { border-top: 1px solid rgb(82 112 91 / .22); }
  .online-avatar { position: relative; }
  .online-avatar img { display: block; width: 2.1rem; height: 2.1rem; border-radius: 50%; object-fit: cover; }
  .online-avatar i { position: absolute; right: -.05rem; bottom: -.05rem; width: .55rem; height: .55rem; border: 2px solid #09100c; border-radius: 50%; background: #7cf59d; }
  .online-identity { min-width: 0; }
  .online-identity strong, .online-identity code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .online-identity strong { color: #dfffe7; font-size: .66rem; }
  .online-identity code { margin-top: .16rem; color: #718277; font: inherit; font-size: .52rem; }
  article button { border: 0; padding: .4rem .55rem; background: #132019; color: #bfeac8; font-size: .56rem; }
  article button:hover:not(:disabled) { background: #1a2b20; color: #7cf59d; }
  article button:disabled { opacity: .5; }
  .error { padding: .6rem .1rem; color: #ffaaa3; font-size: .58rem; }
</style>
