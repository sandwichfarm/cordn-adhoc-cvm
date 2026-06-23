import { McpServer } from "@contextvm/mcp-sdk/server/mcp";
import { PrivateKeySigner } from "@contextvm/sdk/signer";
import { NostrServerTransport } from "@contextvm/sdk/transport";
import type { BrowserCoordinatorOptions } from "../config/config.svelte";
import { createCoordinator, type Coordinator } from "../cordn/coordinator";
import { createBrowserCoordinatorStorage } from "../cordn/coordinator/storage/browserSqliteStorage";
import {
  CoordinatorAdapter,
  type AbuseProtectionOptions,
  type ResolveRequestEvent,
  registerCoordinatorMethods,
} from "../cordn/server/coordinatorMethods";

export interface RunningTransport {
  server: McpServer;
  transport: NostrServerTransport;
  coordinator: Coordinator;
  adapter: CoordinatorAdapter;
  close: () => void;
}

function closeIfPresent(value: unknown): void {
  const candidate = value as { close?: () => void } | null;
  if (typeof candidate?.close === "function") {
    candidate.close();
  }
}

function createBrowserAbuseProtection(options: BrowserCoordinatorOptions): AbuseProtectionOptions {
  return {
    rateLimit: {
      enabled: true,
      refillPerMinute: 500,
      burst: 160,
      idleTtlMs: 3_600_000,
    },
    keyPackageQuota: {
      maxPerIdentity: options.maxUsers,
      maxLastResortPerIdentity: 1,
    },
    logRejections: false,
  };
}

export class TransportFactory {
  async create(
    privateKeyHex: string,
    relayUrls: string[],
    options: BrowserCoordinatorOptions,
    persistent: boolean,
  ): Promise<RunningTransport> {
    if (relayUrls.length === 0) {
      throw new Error("At least one enabled relay is required");
    }

    const signer = new PrivateKeySigner(privateKeyHex);
    const server = new McpServer({
      name: "cordn-browser",
      version: "0.1.0",
    });
    const coordinator = createCoordinator({
      storage: await createBrowserCoordinatorStorage(persistent),
    });

    const transport = new NostrServerTransport({
      signer,
      relayHandler: relayUrls,
      serverInfo: {
        name: "cordn-browser",
        about: `Cordn coordinator running in a browser tab; max users ${options.maxUsers}`,
      },
      isAnnouncedServer: options.announce,
      injectClientPubkey: true,
      injectRequestEventId: true,
      oversizedTransfer: { enabled: true },
      openStream: { enabled: true },
    });
    const resolveRequestEvent: ResolveRequestEvent = (requestEventId) =>
      transport.getNostrRequestEvent(requestEventId) ?? null;
    const adapter = new CoordinatorAdapter(
      coordinator,
      resolveRequestEvent,
      createBrowserAbuseProtection(options),
    );

    registerCoordinatorMethods(server, adapter);

    await server.connect(transport);

    return {
      server,
      transport,
      coordinator,
      adapter,
      close: () => {
        adapter.close();
        closeIfPresent(transport);
        closeIfPresent(server);
      },
    };
  }
}

export const transportFactory = new TransportFactory();
