import type { NostrSigner } from "@contextvm/sdk/core";
import { nip44, type EventTemplate, type NostrEvent } from "nostr-tools";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

export class BrowserNostrSigner implements NostrSigner {
  private readonly privateKey: Uint8Array;
  private readonly publicKey: string;

  constructor(privateKey: Uint8Array) {
    this.privateKey = new Uint8Array(privateKey);
    this.publicKey = getPublicKey(this.privateKey);
  }

  async getPublicKey(): Promise<string> {
    return this.publicKey;
  }

  async signEvent(event: EventTemplate): Promise<NostrEvent> {
    return finalizeEvent(event, this.privateKey);
  }

  nip44 = {
    encrypt: async (pubkey: string, plaintext: string): Promise<string> => {
      const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, pubkey);
      return nip44.v2.encrypt(plaintext, conversationKey);
    },
    decrypt: async (pubkey: string, ciphertext: string): Promise<string> => {
      const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, pubkey);
      return nip44.v2.decrypt(ciphertext, conversationKey);
    },
  };
}
