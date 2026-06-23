import { configStore } from "../config/config.svelte";
import { KeyManager } from "../crypto/key-manager";
import { transportFactory, type RunningTransport } from "../lib/transport";
import { isConfigLocked, transitionCoordinator } from "./state-machine";
import type { CoordinatorStatus } from "./types";

export class CoordinatorStore {
  readonly keyManager = KeyManager.generate();
  status = $state<CoordinatorStatus>("idle");
  error = $state<string | null>(null);
  private running: RunningTransport | null = null;

  get identity() {
    return this.keyManager.identity;
  }

  get locked(): boolean {
    return isConfigLocked(this.status);
  }

  async start(): Promise<void> {
    this.status = transitionCoordinator(this.status, "start");
    configStore.lock();
    this.error = null;

    try {
      this.running = await transportFactory.create(
        this.keyManager.getSecretKeyHex(),
        configStore.enabledRelayUrls,
      );
      this.status = transitionCoordinator(this.status, "started");
    } catch (error) {
      this.running = null;
      this.error = error instanceof Error ? error.message : "Coordinator startup failed";
      this.status = transitionCoordinator(this.status, "error");
    }
  }

  async stop(): Promise<void> {
    this.status = transitionCoordinator(this.status, "stop");
    this.stopSync();
    this.status = transitionCoordinator(this.status, "stopped");
  }

  stopSync(): void {
    this.running?.close();
    this.running = null;
  }

  dismissError(): void {
    this.error = null;
  }
}

export const coordinatorStore = new CoordinatorStore();
