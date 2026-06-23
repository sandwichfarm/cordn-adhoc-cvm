import { DEFAULT_MAX_USERS, validateMaxUsers, validateRelayUrl } from "./config-validator";

export interface RelayConfig {
  id: string;
  url: string;
  enabled: boolean;
}

export interface BrowserCoordinatorOptions {
  announce: boolean;
  maxUsers: number;
}

export class ConfigStore {
  relays = $state<RelayConfig[]>([
    { id: crypto.randomUUID(), url: "wss://relay.damus.io", enabled: true },
  ]);
  editMode = $state(false);
  relayError = $state<string | null>(null);
  limitError = $state<string | null>(null);
  announce = $state(false);
  maxUsers = $state(DEFAULT_MAX_USERS);
  activeUserCount = $state(0);

  get enabledRelayUrls(): string[] {
    return this.relays.filter((relay) => relay.enabled).map((relay) => relay.url);
  }

  get coordinatorOptions(): BrowserCoordinatorOptions {
    return {
      announce: this.announce,
      maxUsers: this.maxUsers,
    };
  }

  enterEdit(): void {
    this.editMode = true;
    this.relayError = null;
    this.limitError = null;
  }

  exitEdit(): void {
    this.editMode = false;
    this.relayError = null;
    this.limitError = null;
  }

  lock(): void {
    this.editMode = false;
  }

  addRelay(value: string): boolean {
    const url = value.trim();
    const error = validateRelayUrl(url);
    if (error) {
      this.relayError = error;
      return false;
    }

    if (this.relays.some((relay) => relay.url === url)) {
      this.relayError = "Relay URL is already listed";
      return false;
    }

    this.relays = [...this.relays, { id: crypto.randomUUID(), url, enabled: true }];
    this.relayError = null;
    return true;
  }

  removeRelay(id: string): void {
    this.relays = this.relays.filter((relay) => relay.id !== id);
  }

  toggleRelay(id: string): void {
    this.relays = this.relays.map((relay) =>
      relay.id === id ? { ...relay, enabled: !relay.enabled } : relay,
    );
  }

  setAnnouncement(value: boolean): void {
    this.announce = value;
  }

  setMaxUsers(value: number): boolean {
    const error = validateMaxUsers(value, this.activeUserCount);
    if (error) {
      this.limitError = error;
      return false;
    }

    this.maxUsers = value;
    this.limitError = null;
    return true;
  }

  setActiveUserCount(value: number): void {
    this.activeUserCount = Math.max(0, Math.trunc(value));
    if (this.maxUsers < this.activeUserCount) {
      this.maxUsers = this.activeUserCount;
    }
    this.limitError = null;
  }
}

export const configStore = new ConfigStore();
