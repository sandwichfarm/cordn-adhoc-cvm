import { DEFAULT_MAX_USERS, validateMaxUsers, validateRelayUrl } from "./config-validator";

const CONFIG_STORAGE_KEY = "cordn:v1:config";
const CONFIG_STORAGE_VERSION = 1;
const DEFAULT_RELAYS: RelayConfig[] = [
  { id: "default-relay-contextvm", url: "wss://relay.contextvm.org", enabled: true },
];

export interface RelayConfig {
  id: string;
  url: string;
  enabled: boolean;
}

export interface BrowserCoordinatorOptions {
  announce: boolean;
  maxUsers: number;
}

interface PersistedConfig {
  version: typeof CONFIG_STORAGE_VERSION;
  relays: Array<Pick<RelayConfig, "url" | "enabled">>;
  announce: boolean;
  maxUsers: number;
}

export class ConfigStore {
  relays = $state<RelayConfig[]>(cloneDefaultRelays());
  editMode = $state(false);
  relayError = $state<string | null>(null);
  limitError = $state<string | null>(null);
  announce = $state(false);
  maxUsers = $state(DEFAULT_MAX_USERS);

  constructor() {
    this.loadPersistedConfig();
  }

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
    this.persistConfig();
    return true;
  }

  removeRelay(id: string): void {
    this.relays = this.relays.filter((relay) => relay.id !== id);
    this.persistConfig();
  }

  toggleRelay(id: string): void {
    this.relays = this.relays.map((relay) =>
      relay.id === id ? { ...relay, enabled: !relay.enabled } : relay,
    );
    this.persistConfig();
  }

  setAnnouncement(value: boolean): void {
    this.announce = value;
    this.persistConfig();
  }

  setMaxUsers(value: number): boolean {
    const error = validateMaxUsers(value);
    if (error) {
      this.limitError = error;
      return false;
    }

    this.maxUsers = value;
    this.limitError = null;
    this.persistConfig();
    return true;
  }

  resetToDefaults(): void {
    clearPersistedConfig();
    this.relays = cloneDefaultRelays();
    this.editMode = false;
    this.relayError = null;
    this.limitError = null;
    this.announce = false;
    this.maxUsers = DEFAULT_MAX_USERS;
  }

  private persistConfig(): void {
    if (!("localStorage" in globalThis)) {
      return;
    }

    const config: PersistedConfig = {
      version: CONFIG_STORAGE_VERSION,
      relays: this.relays.map((relay) => ({ url: relay.url, enabled: relay.enabled })),
      announce: this.announce,
      maxUsers: this.maxUsers,
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }

  private loadPersistedConfig(): void {
    const persisted = readPersistedConfig();
    if (!persisted) {
      return;
    }

    this.relays = persisted.relays.map((relay) => ({
      id: crypto.randomUUID(),
      url: relay.url,
      enabled: relay.enabled,
    }));
    this.announce = persisted.announce;
    this.maxUsers = persisted.maxUsers;
  }
}

export const configStore = new ConfigStore();

export function clearPersistedConfig(): void {
  if ("localStorage" in globalThis) {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  }
}

function cloneDefaultRelays(): RelayConfig[] {
  return DEFAULT_RELAYS.map((relay) => ({ ...relay }));
}

function readPersistedConfig(): PersistedConfig | null {
  if (!("localStorage" in globalThis)) {
    return null;
  }

  const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
    if (parsed.version !== CONFIG_STORAGE_VERSION || !Array.isArray(parsed.relays)) {
      return null;
    }

    const relays = parsed.relays
      .map((relay) => normalizePersistedRelay(relay))
      .filter((relay): relay is Pick<RelayConfig, "url" | "enabled"> => relay !== null);

    const maxUsers = typeof parsed.maxUsers === "number" ? Math.trunc(parsed.maxUsers) : DEFAULT_MAX_USERS;
    const limitError = validateMaxUsers(maxUsers);

    return {
      version: CONFIG_STORAGE_VERSION,
      relays,
      announce: parsed.announce === true,
      maxUsers: limitError ? DEFAULT_MAX_USERS : maxUsers,
    };
  } catch {
    return null;
  }
}

function normalizePersistedRelay(value: unknown): Pick<RelayConfig, "url" | "enabled"> | null {
  if (typeof value !== "object" || value === null || !("url" in value)) {
    return null;
  }

  const url = typeof value.url === "string" ? value.url.trim() : "";
  if (validateRelayUrl(url)) {
    return null;
  }

  return {
    url,
    enabled: "enabled" in value ? value.enabled === true : true,
  };
}
