/* @vitest-environment node */

import { Client } from "@contextvm/mcp-sdk/client";
import { NostrClientTransport } from "@contextvm/sdk/transport";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { BrowserNostrSigner } from "../../src/crypto/browser-nostr-signer";
import { KeyManager } from "../../src/crypto/key-manager";
import { transportFactory, type RunningTransport } from "../../src/lib/transport";
import { startMockRelay, type MockRelay } from "../e2e/mock-relay";

describe("ContextVM client round trip", () => {
  let relay: MockRelay;
  let running: RunningTransport | null = null;

  beforeEach(async () => {
    relay = await startMockRelay(8766);
  });

  afterEach(async () => {
    running?.close();
    running = null;
    await relay.close();
  });

  test("responds to a client initialize and tools/list request over Nostr", async () => {
    const keyManager = KeyManager.generate();
    const diagnostics: string[] = [];
    running = await transportFactory.create(
      keyManager.getSecretKeyBytes(),
      [relay.url],
      { announce: false, maxUsers: 64 },
      false,
      {
        onNostrEvent: ({ summary }) => diagnostics.push(`raw:${summary}`),
        onInboundMessage: ({ method, summary }) => diagnostics.push(`inbound:${method}:${summary}`),
        onNostrPublish: ({ phase, summary }) => diagnostics.push(`publish:${phase}:${summary}`),
        onOutboundMessage: ({ type, summary }) => diagnostics.push(`outbound:${type}:${summary}`),
      },
    );

    const clientTransport = new NostrClientTransport({
      signer: new BrowserNostrSigner(KeyManager.generate().getSecretKeyBytes()),
      serverPubkey: keyManager.identity.publicKeyHex,
      relayHandler: [relay.url],
      logLevel: "error",
    });
    const client = new Client({ name: "cordn-browser-test", version: "0.1.0" });

    await client.connect(clientTransport, { timeout: 10_000 });
    const tools = await client.listTools(undefined, { timeout: 10_000 });
    const toolsWithProgress = await client.listTools(undefined, {
      timeout: 10_000,
      onprogress: () => undefined,
    });

    expect(tools.tools.map(({ name }) => name)).toContain("kp_publish");
    expect(toolsWithProgress.tools.map(({ name }) => name)).toContain("kp_publish");
    expect(diagnostics.some((entry) => entry.startsWith("raw:kind="))).toBe(true);
    expect(diagnostics.some((entry) => entry.startsWith("inbound:initialize:"))).toBe(true);
    expect(diagnostics.some((entry) => entry.startsWith("inbound:tools/list:"))).toBe(true);
    expect(diagnostics.some((entry) => entry.startsWith("publish:accepted:kind="))).toBe(true);
    expect(diagnostics.some((entry) => entry.includes("disabled_unused_stream="))).toBe(true);
    expect(diagnostics.some((entry) => entry.startsWith("outbound:result response:"))).toBe(true);

    await client.close();
  }, 15_000);
});
