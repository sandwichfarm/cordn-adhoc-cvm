import { configStore } from "../config/config.svelte";
import { KeyManager } from "../crypto/key-manager";
import { keyStorage, WrongPassphraseError } from "../crypto/key-storage";
import { transportFactory, type RunningTransport } from "../lib/transport";
import { resourceMonitor } from "./resource-monitor.svelte";
import { isConfigLocked, transitionCoordinator } from "./state-machine";
import type { CoordinatorLoadState, CoordinatorStatus, RelayConnectionStatus } from "./types";

export class CoordinatorStore {
  keyManager = $state<KeyManager | null>(null);
  loadState = $state<CoordinatorLoadState>("ready");
  status = $state<CoordinatorStatus>("idle");
  error = $state<string | null>(null);
  passphraseError = $state<string | null>(null);
  persistenceError = $state<string | null>(null);
  persistenceEnabled = $state(false);
  relayStatuses = $state<Record<string, RelayConnectionStatus>>({});
  private running: RunningTransport | null = null;

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

    try {
      const secretKey = await keyStorage.load(passphrase);
      this.keyManager = KeyManager.fromBytes(secretKey);
      secretKey.fill(0);
      this.persistenceEnabled = true;
      this.loadState = "ready";
    } catch (error) {
      this.passphraseError =
        error instanceof WrongPassphraseError ? "Wrong passphrase" : "Could not unlock persisted key";
    }
  }

  generateFreshKey(): void {
    keyStorage.clear();
    this.keyManager = KeyManager.generate();
    this.persistenceEnabled = false;
    this.passphraseError = null;
    this.loadState = "ready";
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
    return true;
  }

  disablePersistence(): void {
    keyStorage.clear();
    this.persistenceEnabled = false;
    this.persistenceError = null;
  }

  async start(): Promise<void> {
    this.status = transitionCoordinator(this.status, "start");
    configStore.lock();
    this.error = null;
    this.setEnabledRelayStatuses("connecting");

    try {
      this.running = await transportFactory.create(
        this.requireKeyManager().getSecretKeyHex(),
        configStore.enabledRelayUrls,
        configStore.coordinatorOptions,
      );
      this.setEnabledRelayStatuses("connected");
      this.status = transitionCoordinator(this.status, "started");
      resourceMonitor.start(this.running);
    } catch (error) {
      this.running = null;
      resourceMonitor.stop();
      this.error = error instanceof Error ? error.message : "Coordinator startup failed";
      this.setEnabledRelayStatuses("error");
      this.status = transitionCoordinator(this.status, "error");
    }
  }

  async stop(): Promise<void> {
    this.status = transitionCoordinator(this.status, "stop");
    this.stopSync();
    this.relayStatuses = {};
    this.status = transitionCoordinator(this.status, "stopped");
  }

  stopSync(): void {
    resourceMonitor.stop();
    this.running?.close();
    this.running = null;
  }

  dismissError(): void {
    this.error = null;
  }

  async destroy(): Promise<void> {
    if (this.status === "running") {
      await this.stop();
    }

    this.destroyStateSynchronously();
    await this.clearBrowserCaches();
  }

  private destroyStateSynchronously(): void {
    resourceMonitor.stop();
    this.keyManager?.destroy();
    keyStorage.clear();
    this.keyManager = KeyManager.generate();
    this.persistenceEnabled = false;
    this.persistenceError = null;
    this.passphraseError = null;
    this.relayStatuses = {};
    this.error = null;
    this.status = "idle";
    this.loadState = "ready";
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

  private async clearBrowserCaches(): Promise<void> {
    if (!("caches" in globalThis)) {
      return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

export const coordinatorStore = new CoordinatorStore();
