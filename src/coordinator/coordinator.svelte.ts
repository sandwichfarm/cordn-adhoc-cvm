import { configStore } from "../config/config.svelte";
import {
  clearPersistedCoordinatorState,
  createBrowserCoordinatorStorage,
} from "../cordn/coordinator/storage/browserSqliteStorage";
import { KeyManager } from "../crypto/key-manager";
import {
  keyStorage,
  WrongPassphraseError,
  type CoordinatorKeyBackup,
} from "../crypto/key-storage";
import { transportFactory, type RunningTransport } from "../lib/transport";
import { resourceMonitor } from "./resource-monitor.svelte";
import { INSTANCE_RUNNING_MESSAGE, SingleInstanceGuard, type InstanceLease } from "./single-instance-guard";
import { isConfigLocked, transitionCoordinator } from "./state-machine";
import type {
  CoordinatorLoadState,
  CoordinatorStartupPhase,
  CoordinatorStartupProgress,
  CoordinatorStatus,
  RelayConnectionStatus,
} from "./types";

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

const STARTUP_TOTAL_STEPS = 5;

const STARTUP_PHASE_COPY: Record<CoordinatorStartupPhase, Omit<CoordinatorStartupProgress, "phase" | "detail"> & { detail: string }> = {
  idle: {
    step: 0,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 0,
    label: "Ready to start",
    detail: "The coordinator is offline.",
  },
  "checking-instance": {
    step: 1,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 20,
    label: "Checking coordinator availability",
    detail: "Confirming this identity is not already active.",
  },
  "opening-storage": {
    step: 2,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 40,
    label: "Opening room storage",
    detail: "Loading the coordinator's room state.",
  },
  "preparing-runtime": {
    step: 3,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 60,
    label: "Preparing MLS services",
    detail: "Registering encrypted room coordination methods.",
  },
  "connecting-relays": {
    step: 4,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 80,
    label: "Connecting relay paths",
    detail: "Subscribing for coordinator requests.",
  },
  online: {
    step: 5,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 100,
    label: "Coordinator online",
    detail: "Encrypted room delivery is ready.",
  },
  failed: {
    step: 0,
    totalSteps: STARTUP_TOTAL_STEPS,
    percent: 0,
    label: "Startup interrupted",
    detail: "The coordinator could not start.",
  },
};

function startupProgress(
  phase: CoordinatorStartupPhase,
  detail = STARTUP_PHASE_COPY[phase].detail,
): CoordinatorStartupProgress {
  return { phase, ...STARTUP_PHASE_COPY[phase], detail };
}

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
  startupProgress = $state<CoordinatorStartupProgress>(startupProgress("idle"));
  appliedConfigRevision = $state<number | null>(null);
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

  get restartRequired(): boolean {
    return this.status === "running"
      && this.appliedConfigRevision !== null
      && this.appliedConfigRevision !== configStore.runtimeRevision;
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

  async exportCoordinatorKeyBackup(passphrase: string): Promise<CoordinatorKeyBackup | null> {
    this.persistenceError = null;

    if (!this.persistenceEnabled || !keyStorage.hasPersisted()) {
      this.persistenceError = "Enable persistence before exporting this coordinator";
      return null;
    }

    if (passphrase.length === 0) {
      this.persistenceError = "Passphrase is required";
      return null;
    }

    try {
      const backup = await keyStorage.exportBackup(passphrase);
      if (!this.persistenceEnabled || !keyStorage.hasPersisted()) {
        this.persistenceError = "Persistence changed before the export completed";
        this.addDebugLog("warn", "encrypted coordinator export cancelled", this.persistenceError);
        return null;
      }

      if (backup.identity.publicKeyHex !== this.identity.publicKeyHex) {
        this.persistenceError = "Saved key does not match this coordinator";
        this.addDebugLog("warn", "encrypted coordinator export rejected", this.persistenceError);
        return null;
      }

      this.addDebugLog("info", "encrypted coordinator backup exported");
      return backup;
    } catch (error) {
      this.persistenceError =
        error instanceof WrongPassphraseError ? "Wrong passphrase" : "Could not export persisted key";
      this.addDebugLog("warn", "encrypted coordinator export failed", this.persistenceError);
      return null;
    }
  }

  clearPersistenceError(): void {
    this.persistenceError = null;
  }

  async start(): Promise<void> {
    this.status = transitionCoordinator(this.status, "start");
    this.setStartupProgress("checking-instance");
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
        this.persistenceEnabled,
        {
          onStartupPhase: ({ phase }) => {
            const detail = phase === "opening-storage"
              ? this.persistenceEnabled
                ? "Loading encrypted room state from this device."
                : "Preparing temporary room state for this session."
              : phase === "connecting-relays"
                ? `Opening ${configStore.enabledRelayUrls.length} configured relay ${configStore.enabledRelayUrls.length === 1 ? "path" : "paths"}.`
                : undefined;
            this.setStartupProgress(phase, detail);
          },
          onStarted: ({ publicKeyHex, relayUrls }) => {
            this.setStartupProgress(
              "online",
              `Listening across ${relayUrls.length} relay ${relayUrls.length === 1 ? "path" : "paths"}.`,
            );
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
      this.appliedConfigRevision = configStore.runtimeRevision;
      resourceMonitor.start(this.running);
      this.addDebugLog("info", "coordinator started", keyManager.identity.npub);
    } catch (error) {
      this.running = null;
      await this.releaseInstanceLease();
      resourceMonitor.stop();
      this.error = error instanceof Error ? error.message : "Coordinator startup failed";
      this.setStartupProgress("failed", this.error);
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
    await this.stopSync();
    this.relayStatuses = {};
    this.status = transitionCoordinator(this.status, "stopped");
    this.setStartupProgress("idle");
    this.addDebugLog("info", "coordinator stopped");
  }

  async restart(): Promise<void> {
    if (this.status !== "running") return;
    this.addDebugLog("info", "coordinator restart requested", "applying updated settings");
    await this.stop();
    await this.start();
  }

  /**
   * Delete a room through the local host control plane. This is deliberately
   * not registered as a coordinator RPC method.
   */
  async deleteHostedRoom(groupId: string): Promise<void> {
    const normalizedGroupId = groupId.trim();
    if (normalizedGroupId.length === 0) {
      throw new Error("Room id is required");
    }

    try {
      if (this.running) {
        this.running.coordinator.deleteGroup(normalizedGroupId);
      } else {
        const storage = await createBrowserCoordinatorStorage(
          this.persistenceEnabled,
          this.identity.publicKeyHex,
        );
        try {
          storage.deleteGroup(normalizedGroupId);
        } finally {
          storage.close();
        }
      }
      this.addDebugLog("info", "hosted room deleted", normalizedGroupId);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.addDebugLog("warn", "hosted room deletion failed", details);
      throw error;
    }
  }

  async stopSync(): Promise<void> {
    resourceMonitor.stop();
    this.running?.close();
    this.running = null;
    await this.releaseInstanceLease();
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
    void this.releaseInstanceLease();
    this.keyManager?.destroy();
    keyStorage.clear();
    this.keyManager = KeyManager.generate();
    this.persistenceEnabled = false;
    this.persistenceError = null;
    this.passphraseError = null;
    this.relayStatuses = {};
    this.appliedConfigRevision = null;
    this.error = null;
    this.setStartupProgress("idle");
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

  private setStartupProgress(phase: CoordinatorStartupPhase, detail?: string): void {
    this.startupProgress = startupProgress(phase, detail);
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

  private async releaseInstanceLease(): Promise<void> {
    this.pagehideRelease?.();
    this.pagehideRelease = null;
    const lease = this.instanceLease;
    this.instanceLease = null;
    await lease?.release();
  }

  private registerPagehideRelease(): void {
    this.pagehideRelease?.();

    const handler = (): void => {
      this.addDebugLog("info", "page unloading; releasing coordinator instance lease");
      void this.releaseInstanceLease();
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
