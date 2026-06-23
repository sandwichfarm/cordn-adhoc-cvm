import { configStore } from "../config/config.svelte";
import { clearPersistedCoordinatorState } from "../cordn/coordinator/storage/browserCoordinatorStorage";
import { KeyManager } from "../crypto/key-manager";
import { keyStorage, WrongPassphraseError } from "../crypto/key-storage";
import { transportFactory, type RunningTransport } from "../lib/transport";
import { resourceMonitor } from "./resource-monitor.svelte";
import { INSTANCE_RUNNING_MESSAGE, SingleInstanceGuard, type InstanceLease } from "./single-instance-guard";
import { isConfigLocked, transitionCoordinator } from "./state-machine";
import type { CoordinatorLoadState, CoordinatorStatus, RelayConnectionStatus } from "./types";

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  timeLabel: string;
  level: "info" | "warn" | "error";
  message: string;
  details?: string;
}

const debugTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export class CoordinatorStore {
  keyManager = $state<KeyManager | null>(null);
  loadState = $state<CoordinatorLoadState>("ready");
  status = $state<CoordinatorStatus>("idle");
  error = $state<string | null>(null);
  passphraseError = $state<string | null>(null);
  persistenceError = $state<string | null>(null);
  persistenceEnabled = $state(false);
  relayStatuses = $state<Record<string, RelayConnectionStatus>>({});
  debugLog = $state<DebugLogEntry[]>([]);
  private running: RunningTransport | null = null;
  private instanceLease: InstanceLease | null = null;
  private pagehideRelease: (() => void) | null = null;

  constructor() {
    if (keyStorage.hasPersisted()) {
      this.loadState = "prompting";
      this.persistenceEnabled = true;
      return;
    }

    this.keyManager = KeyManager.generate();
  }

  get identity() {
    return this.requireKeyManager().identity;
  }

  get locked(): boolean {
    return isConfigLocked(this.status);
  }

  async loadFromPassphrase(passphrase: string): Promise<void> {
    this.passphraseError = null;
    this.addDebugLog("info", "unlocking persisted identity");

    try {
      const secretKey = await keyStorage.load(passphrase);
      this.keyManager = KeyManager.fromBytes(secretKey);
      secretKey.fill(0);
      this.persistenceEnabled = true;
      this.loadState = "ready";
      this.addDebugLog("info", "persisted identity unlocked", this.identity.npub);
    } catch (error) {
      this.passphraseError =
        error instanceof WrongPassphraseError ? "Wrong passphrase" : "Could not unlock persisted key";
      this.addDebugLog("warn", "persisted identity unlock failed", this.passphraseError);
    }
  }

  generateFreshKey(): void {
    keyStorage.clear();
    this.keyManager = KeyManager.generate();
    this.persistenceEnabled = false;
    this.passphraseError = null;
    this.loadState = "ready";
    this.addDebugLog("info", "fresh identity generated", this.identity.npub);
  }

  async enablePersistence(passphrase: string, confirmPassphrase: string): Promise<boolean> {
    this.persistenceError = null;

    if (passphrase.length === 0) {
      this.persistenceError = "Passphrase is required";
      return false;
    }

    if (passphrase !== confirmPassphrase) {
      this.persistenceError = "Passphrases do not match";
      return false;
    }

    await keyStorage.save(this.requireKeyManager().getSecretKeyBytes(), passphrase);
    this.persistenceEnabled = true;
    this.addDebugLog("info", "encrypted persistence enabled");
    return true;
  }

  async disablePersistence(): Promise<void> {
    keyStorage.clear();
    await clearPersistedCoordinatorState();
    this.persistenceEnabled = false;
    this.persistenceError = null;
    this.addDebugLog("info", "encrypted persistence disabled");
  }

  async start(): Promise<void> {
    this.status = transitionCoordinator(this.status, "start");
    configStore.lock();
    this.error = null;
    this.setEnabledRelayStatuses("connecting");
    this.addDebugLog("info", "coordinator start requested", `${configStore.enabledRelayUrls.length} enabled relays`);

    try {
      const keyManager = this.requireKeyManager();
      const instanceGuard = new SingleInstanceGuard();
      this.instanceLease = await instanceGuard.acquire({
        publicKeyHex: keyManager.identity.publicKeyHex,
        relayUrls: configStore.enabledRelayUrls,
        getSecretKeyBytes: () => keyManager.getSecretKeyBytes(),
        debug: (level, message, details) => this.addDebugLog(level, message, details),
      });
      this.registerPagehideRelease();

      this.running = await transportFactory.create(
        keyManager.getSecretKeyBytes(),
        configStore.enabledRelayUrls,
        configStore.coordinatorOptions,
        {
          onStarted: ({ publicKeyHex, relayUrls }) => {
            this.addDebugLog(
              "info",
              "nostr transport subscribed",
              `${relayUrls.length} relays for ${abbreviateHex(publicKeyHex)}`,
            );
          },
          onNostrEvent: ({ summary }) => {
            this.addDebugLog("info", "raw nostr event received", summary);
          },
          onInboundMessage: ({ method, clientPubkey, summary }) => {
            this.addDebugLog(
              "info",
              "decoded client request",
              `${method} from ${abbreviateHex(clientPubkey)} ${summary}`,
            );
          },
          onNostrPublish: ({ phase, summary }) => {
            this.addDebugLog("info", phase === "attempt" ? "publishing nostr response event" : "nostr response event accepted", summary);
          },
          onOutboundMessage: ({ type, summary, error }) => {
            this.addDebugLog(
              error ? "warn" : "info",
              "outbound coordinator response",
              error ? `${type}: ${error} ${summary}` : `${type} ${summary}`,
            );
          },
          onOutboundError: (transportError) => {
            this.addDebugLog("error", "nostr transport error", transportError.message);
          },
          onClosed: () => {
            this.addDebugLog("info", "nostr transport closed");
          },
        },
      );
      this.setEnabledRelayStatuses("connected");
      this.status = transitionCoordinator(this.status, "started");
      resourceMonitor.start(this.running);
      this.addDebugLog("info", "coordinator started", keyManager.identity.npub);
    } catch (error) {
      this.running = null;
      this.releaseInstanceLease();
      resourceMonitor.stop();
      this.error = error instanceof Error ? error.message : "Coordinator startup failed";
      if (this.error === INSTANCE_RUNNING_MESSAGE) {
        this.addDebugLog("warn", INSTANCE_RUNNING_MESSAGE);
      } else {
        this.addDebugLog("error", "coordinator startup failed", this.error);
      }
      this.setEnabledRelayStatuses("error");
      this.status = transitionCoordinator(this.status, "error");
    }
  }

  async stop(): Promise<void> {
    this.addDebugLog("info", "coordinator stop requested");
    this.status = transitionCoordinator(this.status, "stop");
    this.stopSync();
    this.relayStatuses = {};
    this.status = transitionCoordinator(this.status, "stopped");
    this.addDebugLog("info", "coordinator stopped");
  }

  stopSync(): void {
    resourceMonitor.stop();
    this.running?.close();
    this.running = null;
    this.releaseInstanceLease();
  }

  dismissError(): void {
    this.error = null;
  }

  async destroy(): Promise<void> {
    if (this.status === "running") {
      await this.stop();
    }

    this.destroyStateSynchronously();
    await clearPersistedCoordinatorState();
    await this.clearBrowserCaches();
  }

  private destroyStateSynchronously(): void {
    resourceMonitor.stop();
    this.releaseInstanceLease();
    this.keyManager?.destroy();
    keyStorage.clear();
    this.keyManager = KeyManager.generate();
    this.persistenceEnabled = false;
    this.persistenceError = null;
    this.passphraseError = null;
    this.relayStatuses = {};
    this.error = null;
    configStore.resetToDefaults();
    this.status = "idle";
    this.loadState = "ready";
    this.debugLog = [];
    this.addDebugLog("info", "coordinator state destroyed", this.identity.npub);
  }

  clearDebugLog(): void {
    this.debugLog = [];
  }

  private setEnabledRelayStatuses(status: RelayConnectionStatus): void {
    this.relayStatuses = Object.fromEntries(
      configStore.enabledRelayUrls.map((url) => [url, status]),
    );
  }

  private requireKeyManager(): KeyManager {
    if (!this.keyManager) {
      throw new Error("Coordinator key is not loaded");
    }

    return this.keyManager;
  }

  private addDebugLog(level: DebugLogEntry["level"], message: string, details?: string): void {
    const timestamp = Date.now();
    const entry: DebugLogEntry = {
      id: crypto.randomUUID(),
      timestamp,
      timeLabel: debugTimeFormatter.format(timestamp),
      level,
      message,
      details,
    };
    this.debugLog = [...this.debugLog, entry].slice(-80);
  }

  private releaseInstanceLease(): void {
    this.pagehideRelease?.();
    this.pagehideRelease = null;
    this.instanceLease?.release();
    this.instanceLease = null;
  }

  private registerPagehideRelease(): void {
    this.pagehideRelease?.();

    const handler = (): void => {
      this.addDebugLog("info", "page unloading; releasing coordinator instance lease");
      this.releaseInstanceLease();
    };

    globalThis.addEventListener("pagehide", handler, { once: true });
    this.pagehideRelease = () => globalThis.removeEventListener("pagehide", handler);
  }

  private async clearBrowserCaches(): Promise<void> {
    if (!("caches" in globalThis)) {
      return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

function abbreviateHex(value: string): string {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

export const coordinatorStore = new CoordinatorStore();
