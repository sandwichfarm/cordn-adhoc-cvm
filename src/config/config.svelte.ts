import { validateRelayUrl } from "./config-validator";

export interface RelayConfig {
  id: string;
  url: string;
  enabled: boolean;
}

export class ConfigStore {
  relays = $state<RelayConfig[]>([
    { id: crypto.randomUUID(), url: "wss://relay.damus.io", enabled: true },
  ]);
  editMode = $state(false);
  relayError = $state<string | null>(null);

  get enabledRelayUrls(): string[] {
    return this.relays.filter((relay) => relay.enabled).map((relay) => relay.url);
  }

  enterEdit(): void {
    this.editMode = true;
    this.relayError = null;
  }

  exitEdit(): void {
    this.editMode = false;
    this.relayError = null;
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
}

export const configStore = new ConfigStore();
