import { Client } from "@contextvm/mcp-sdk/client";
import { NostrClientTransport } from "@contextvm/sdk/transport";
import type { NostrSigner } from "@contextvm/sdk/core";
import { createRequiredRelayPool, withRequiredLocalRelay } from "../lib/relay-pool";

export interface CoordinatorTarget {
  coordinatorPubkey: string;
  relayUrls: string[];
}

export interface RemoteGroupMessage {
  cursor: number;
  gid: string;
  msg_64: string;
  at: number;
}

export interface RemoteWelcome {
  kp_ref: string;
  welcome_64: string;
  at: number;
  after?: number;
}

export interface RemoteJoinRequest {
  pk: string;
  kp_ref: string;
  at: number;
}

/** Minimal ContextVM client for the public coordinator contract. */
export class ChatCoordinatorClient {
  private readonly client = new Client({ name: "cordn-adhoc-chat", version: "0.1.0" });
  private readonly transport: NostrClientTransport;
  private connected: Promise<void> | null = null;

  constructor(private readonly target: CoordinatorTarget, signer: NostrSigner) {
    const websocketPool = withRequiredLocalRelay(target.relayUrls);
    this.transport = new NostrClientTransport({
      signer,
      serverPubkey: target.coordinatorPubkey,
      relayHandler: createRequiredRelayPool(websocketPool),
      logLevel: "error",
      openStream: { enabled: true },
    });
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.client.close(), this.transport.close()]);
    this.connected = null;
  }

  async publishKeyPackage(reference: string, keyPackageBase64: string): Promise<void> {
    await this.call("kp_publish", { kp_ref: reference, kp_64: keyPackageBase64 });
  }

  async storeJoinRequest(groupId: string, keyPackageReference: string): Promise<void> {
    await this.call("join_request_store", { gid: groupId, kp_ref: keyPackageReference });
  }

  async fetchWelcomes(): Promise<RemoteWelcome[]> {
    return (await this.call<{ welcomes: RemoteWelcome[] }>("welcome_take", {})).welcomes;
  }

  async fetchJoinRequests(groupId: string): Promise<RemoteJoinRequest[]> {
    return (await this.call<{ requests: RemoteJoinRequest[] }>("join_request_take", { gid: groupId })).requests;
  }

  async consumeKeyPackage(reference: string): Promise<{ pk: string; kp_ref: string; event: unknown } | null> {
    return (await this.call<{ keyPackage: { pk: string; kp_ref: string; event: unknown } | null }>("kp_take", { id: reference })).keyPackage;
  }

  async postGroupMessage(messageBase64: string): Promise<{ cursor: number; gid: string; at: number }> {
    return this.call("msg_post", { msg_64: messageBase64 });
  }

  async storeWelcome(targetPubkey: string, keyPackageReference: string, welcomeBase64: string, after: number): Promise<void> {
    await this.call("welcome_store", { target_pk: targetPubkey, kp_ref: keyPackageReference, welcome_64: welcomeBase64, after });
  }

  async fetchMessages(groupId: string, after?: number): Promise<RemoteGroupMessage[]> {
    return (await this.call<{ messages: RemoteGroupMessage[] }>("msg_fetch", {
      gid: groupId,
      ...(after ? { after } : {}),
    })).messages;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) this.connected = this.client.connect(this.transport, { timeout: 12_000 });
    try {
      await this.connected;
    } catch (error) {
      this.connected = null;
      throw error;
    }
  }

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    await this.ensureConnected();
    const response = await this.client.callTool({ name, arguments: args }, undefined, { timeout: 12_000 });
    if (response.isError) {
      const detail = (response.content as Array<{ text?: string }> | undefined)
        ?.map((part) => part.text ?? "")
        .filter(Boolean)
        .join("\n");
      throw new Error(detail || `Coordinator rejected ${name}`);
    }
    return response.structuredContent as T;
  }
}
