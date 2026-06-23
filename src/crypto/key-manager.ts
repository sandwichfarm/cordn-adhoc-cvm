import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";

export interface CoordinatorIdentity {
  publicKeyHex: string;
  npub: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class KeyManager {
  private secretKey: Uint8Array | null;
  readonly identity: CoordinatorIdentity;

  private constructor(secretKey: Uint8Array) {
    this.secretKey = secretKey;
    const publicKeyHex = getPublicKey(secretKey);
    this.identity = {
      publicKeyHex,
      npub: nip19.npubEncode(publicKeyHex),
    };
  }

  static generate(): KeyManager {
    return new KeyManager(generateSecretKey());
  }

  getSecretKeyHex(): string {
    if (!this.secretKey) {
      throw new Error("Coordinator key has been destroyed");
    }

    return bytesToHex(this.secretKey);
  }

  destroy(): void {
    if (this.secretKey) {
      this.secretKey.fill(0);
      this.secretKey = null;
    }
  }
}
