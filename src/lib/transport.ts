import { McpServer } from "@contextvm/mcp-sdk/server/mcp";
import { PrivateKeySigner } from "@contextvm/sdk/signer";
import { NostrServerTransport } from "@contextvm/sdk/transport";
import type { BrowserCoordinatorOptions } from "../config/config.svelte";

export interface RunningTransport {
  server: McpServer;
  transport: NostrServerTransport;
  close: () => void;
}

function closeIfPresent(value: unknown): void {
  const candidate = value as { close?: () => void } | null;
  if (typeof candidate?.close === "function") {
    candidate.close();
  }
}

export class TransportFactory {
  async create(
    privateKeyHex: string,
    relayUrls: string[],
    options: BrowserCoordinatorOptions,
  ): Promise<RunningTransport> {
    if (relayUrls.length === 0) {
      throw new Error("At least one enabled relay is required");
    }

    const signer = new PrivateKeySigner(privateKeyHex);
    const server = new McpServer({
      name: "cordn-browser",
      version: "0.1.0",
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

    await server.connect(transport);

    return {
      server,
      transport,
      close: () => {
        closeIfPresent(transport);
        closeIfPresent(server);
      },
    };
  }
}

export const transportFactory = new TransportFactory();
