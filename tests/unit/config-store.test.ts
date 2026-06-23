import { beforeEach, describe, expect, test, vi } from "vitest";

import { ConfigStore } from "../../src/config/config.svelte";
import { DEFAULT_MAX_USERS } from "../../src/config/config-validator";
import { DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT } from "../../src/cordn/coordinator/storage/inMemoryStorage";

describe("ConfigStore runtime limits", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("defaults announcement off and exposes coordinator options", () => {
    const store = new ConfigStore();

    expect(store.coordinatorOptions).toEqual({
      announce: false,
      maxUsers: DEFAULT_MAX_USERS,
      storageBackend: "memory",
      messageBufferLimit: DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT,
    });

    store.setAnnouncement(true);

    expect(store.coordinatorOptions.announce).toBe(true);
  });

  test("validates key-package quota without subscription telemetry coupling", () => {
    const store = new ConfigStore();

    expect(store.setMaxUsers(4)).toBe(true);
    expect(store.maxUsers).toBe(4);
    expect(store.limitError).toBeNull();
  });

  test("preserves relay edit behavior with runtime options present", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const store = new ConfigStore();

    expect(store.addRelay("wss://relay.example")).toBe(true);
    expect(store.relays.at(-1)).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      url: "wss://relay.example",
      enabled: true,
    });
  });

  test("persists relay and runtime configuration across store instances", () => {
    const first = new ConfigStore();
    first.removeRelay(first.relays[0].id);
    expect(first.addRelay("wss://relay.example")).toBe(true);
    first.toggleRelay(first.relays[0].id);
    first.setAnnouncement(true);
    expect(first.setMaxUsers(12)).toBe(true);
    expect(first.setStorageBackend("indexeddb")).toBe(true);
    expect(first.setMessageBufferLimit(123)).toBe(true);

    const second = new ConfigStore();

    expect(second.relays).toEqual([
      {
        id: expect.any(String),
        url: "wss://relay.example",
        enabled: false,
      },
    ]);
    expect(second.announce).toBe(true);
    expect(second.maxUsers).toBe(12);
    expect(second.storageBackend).toBe("indexeddb");
    expect(second.messageBufferLimit).toBe(123);
  });

  test("ignores invalid persisted config entries", () => {
    localStorage.setItem(
      "cordn:v1:config",
      JSON.stringify({
        version: 1,
        relays: [
          { url: "javascript:alert(1)", enabled: true },
          { url: "wss://relay.valid.example", enabled: true },
        ],
        announce: true,
        maxUsers: 999,
        storageBackend: "bad",
        messageBufferLimit: 100_000,
      }),
    );

    const store = new ConfigStore();

    expect(store.relays.map((relay) => relay.url)).toEqual(["wss://relay.valid.example"]);
    expect(store.announce).toBe(true);
    expect(store.maxUsers).toBe(DEFAULT_MAX_USERS);
    expect(store.storageBackend).toBe("memory");
    expect(store.messageBufferLimit).toBe(DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT);
  });

  test("reset clears persisted config and restores defaults", () => {
    const store = new ConfigStore();
    store.removeRelay(store.relays[0].id);
    store.addRelay("wss://relay.example");
    store.setAnnouncement(true);

    store.resetToDefaults();
    const reloaded = new ConfigStore();

    expect(reloaded.relays.map((relay) => relay.url)).toEqual(["wss://relay.contextvm.org"]);
    expect(reloaded.announce).toBe(false);
    expect(reloaded.storageBackend).toBe("memory");
    expect(reloaded.messageBufferLimit).toBe(DEFAULT_MEMORY_MESSAGE_BUFFER_LIMIT);
  });
});
