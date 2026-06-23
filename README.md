# Cordn Ad-hoc

Web-based MLS coordinator for ad-hoc Cordn groups. The app runs a ContextVM/Nostr
coordinator in a browser tab, publishes its coordinator pubkey, and lets Cordn clients
use that browser tab as the group coordination server.

## What It Does

- Runs the Cordn coordinator protocol from a browser.
- Receives ContextVM MCP requests over Nostr relays.
- Stores MLS key packages, welcomes, join requests, and group messages locally.
- Supports streaming group-message subscriptions.
- Persists relay/runtime configuration in browser storage.
- Optionally encrypts and persists the coordinator identity behind a passphrase.
- Prevents multiple coordinators with the same pubkey from running at once.
- Exposes an operator debug log for raw Nostr events, decoded requests, responses, relay publish state, and instance heartbeats.

## Local Development

Requirements:

- Node.js 22 or newer
- pnpm 10.17.1

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

The app listens on `127.0.0.1`. If Vite reports that the default port is busy, use the alternate URL it prints.

## Operator Flow

1. Open the app.
2. Copy the coordinator pubkey.
3. Configure the relay list that Cordn clients will use.
4. Start the coordinator.
5. Use the coordinator pubkey from a Cordn client.
6. Watch the debug log if the client does not connect or does not mark messages as sent.

The coordinator locks runtime configuration while running. Stop it before changing relays, announcement mode, or user limits.

## Debugging Client Delivery

The debug log is the primary operator surface.

Useful entries:

- `raw nostr event received`: a relay delivered an event to the coordinator.
- `decoded client request`: the event decrypted and decoded as an MCP request.
- `disabled_unused_stream`: a non-streaming request carried a progress token, so the coordinator removed the unused stream guard before responding.
- `outbound coordinator response`: the MCP response body was produced.
- `publishing nostr response event`: the response is being published to relays.
- `nostr response event accepted`: at least one relay accepted the response.

For normal message posts, the decoded request should show `tool=msg_post`, and the response should include `cursor`, `gid`, and `at`.

## Deployment

The deploy workflow publishes the built `dist` output to Nostr and Blossom after CI passes on `main` or `master`.

Configure repository secrets with:

```bash
./scripts/setup-secrets.sh
```

The script requires GitHub CLI authentication and prompts for:

- `NBUNK_SECRET`: the `nbunksec1...` credential from `nsyte ci`
- `NSYTE_RELAYS`: one or more Nostr relay URLs
- `BLOSSOM_SERVER_URLS`: one or more Blossom server URLs
- `NSITE_NAME`: optional named nsite

List-style secret prompts accept comma-separated input. The script stores list secrets as newline-separated values for the deploy action.

## Checks

Run the standard local checks:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Run everything in sequence:

```bash
pnpm ci
```

The build may print upstream Rolldown warnings from dependency pure annotations. Those warnings are currently non-fatal.

## Notes

This is a browser-hosted coordinator. Closing the browser tab stops the coordinator. Enable encrypted persistence if the same coordinator identity should survive reloads.
