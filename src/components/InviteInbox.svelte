<script lang="ts">
  import { nip19 } from "nostr-tools";
  import { nostrSocialStore } from "../invites/nostr-social.svelte";

  interface Props {
    onNavigate: (href: string) => void;
  }

  let { onNavigate }: Props = $props();
  let open = $state(false);

  function accept(id: string, href: string): void {
    const target = new URL(href, window.location.origin);
    target.searchParams.set("autojoin", "1");
    nostrSocialStore.dismissInvite(id);
    open = false;
    onNavigate(target.href);
  }

  function senderNpub(pubkey: string): string {
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return pubkey;
    }
  }
</script>

<div class="invite-inbox">
  <button class:pending={nostrSocialStore.incomingInvites.length > 0} class="inbox-trigger" type="button" aria-label={`Invites, ${nostrSocialStore.incomingInvites.length} waiting`} aria-haspopup="menu" aria-expanded={open} onclick={() => open = !open}>
    <span aria-hidden="true">✉</span>
    {#if nostrSocialStore.incomingInvites.length > 0}<span class="inbox-count">{nostrSocialStore.incomingInvites.length}</span>{/if}
  </button>
  {#if open}
    <div class="inbox-menu" role="menu" aria-label="Room invites">
      <header><strong>Room invites</strong><span>{nostrSocialStore.incomingInvites.length}</span></header>
      {#if nostrSocialStore.incomingInvites.length === 0}
        <p>No private invites waiting.</p>
      {:else}
        {#each nostrSocialStore.incomingInvites as invite (invite.id)}
          <article>
            <img src={invite.fromAvatar} alt="" />
            <div class="min-w-0">
              <strong>{invite.roomTitle}</strong>
              <span>from {invite.fromName}</span>
              <code title={senderNpub(invite.from)}>{senderNpub(invite.from)}</code>
            </div>
            <div class="invite-actions">
              <button class="accept" type="button" onclick={() => accept(invite.id, invite.inviteUrl)}>Accept</button>
              <button type="button" aria-label={`Dismiss invite to ${invite.roomTitle}`} onclick={() => nostrSocialStore.dismissInvite(invite.id)}>×</button>
            </div>
          </article>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .invite-inbox { position: relative; flex: 0 0 auto; }
  .inbox-trigger { position: relative; display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border: 1px solid #293832; color: #91a59a; }
  .inbox-trigger:hover, .inbox-trigger.pending { border-color: #496451; background: #101713; color: #dfffe7; }
  .inbox-trigger.pending { color: #7cf59d; }
  .inbox-count { position: absolute; top: -.35rem; right: -.35rem; display: grid; min-width: 1.15rem; height: 1.15rem; place-items: center; border-radius: 999px; background: #7cf59d; color: #071009; font-size: .5rem; font-weight: 800; box-shadow: 0 0 0 3px #0a100c; animation: invite-pulse 1.8s ease-in-out infinite; }
  .inbox-menu { position: absolute; z-index: 80; top: calc(100% + .45rem); right: 0; width: min(25rem, calc(100vw - 1rem)); border: 1px solid #496451; background: #090e0b; box-shadow: 0 16px 44px rgb(0 0 0 / .58); }
  .inbox-menu header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #293832; padding: .7rem .8rem; color: #91a59a; font-size: .58rem; letter-spacing: .1em; text-transform: uppercase; }
  .inbox-menu > p { padding: 1rem; color: #718277; font-size: .65rem; }
  article { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr) auto; align-items: center; gap: .65rem; padding: .75rem; }
  article + article { border-top: 1px solid #202d25; }
  article img { width: 2.25rem; height: 2.25rem; border-radius: 50%; object-fit: cover; }
  article strong, article span, article code { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  article strong { color: #e8f5eb; font-size: .68rem; }
  article span { margin-top: .15rem; color: #91a59a; font-size: .58rem; }
  article code { margin-top: .12rem; color: #5f7166; font: inherit; font-size: .5rem; }
  .invite-actions { display: flex; gap: .25rem; }
  .invite-actions button { border: 1px solid #34483a; padding: .35rem .45rem; color: #91a59a; font-size: .55rem; }
  .invite-actions button.accept { border-color: #7cf59d; background: #7cf59d; color: #071009; font-weight: 700; }
  @keyframes invite-pulse { 50% { box-shadow: 0 0 0 3px #0a100c, 0 0 0 7px rgb(124 245 157 / .1); } }
</style>
