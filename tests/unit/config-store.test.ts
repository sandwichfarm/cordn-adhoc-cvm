import { beforeEach, describe, expect, test, vi } from "vitest";

import { ConfigStore } from "../../src/config/config.svelte";
import { DEFAULT_MAX_USERS } from "../../src/config/config-validator";

describe("ConfigStore runtime limits", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("defaults announcement off and exposes coordinator options", () => {
    const store = new ConfigStore();

    expect(store.autostart).toBe(false);
    expect(store.coordinatorOptions).toEqual({
      announce: false,
      maxUsers: DEFAULT_MAX_USERS,
    });

    store.setAnnouncement(true);

    expect(store.coordinatorOptions.announce).toBe(true);
  });

  test("persists the autostart preference", () => {
    const store = new ConfigStore();
    store.setAutostart(true);

    expect(new ConfigStore().autostart).toBe(true);
  });

  test("defaults to invisible and persists offline sleep state", () => {
    const store = new ConfigStore();
    expect(store.presenceState).toBe("invisible");

    store.setPresenceState("offline");
    expect(new ConfigStore().presenceState).toBe("offline");

    store.resetToDefaults();
    expect(store.presenceState).toBe("invisible");
  });

  test("persists presence without changing runtime configuration", () => {
    const store = new ConfigStore();
    const initialRuntimeRevision = store.runtimeRevision;
    const initialOptions = store.coordinatorOptions;

    store.setPresenceState("online");

    expect(store.presenceState).toBe("online");
    expect(store.runtimeRevision).toBe(initialRuntimeRevision);
    expect(store.coordinatorOptions).toEqual(initialOptions);
    expect(new ConfigStore().presenceState).toBe("online");
  });

  test("persists coordinator and anonymous user names without requiring a runtime restart", () => {
    const store = new ConfigStore();
    store.setCoordinatorName("Madeira node");
    store.setUserName("River");
    store.setHostBadgeLabel("guide");
    store.setHostBadgeEmoji("🦉");

    expect(store.runtimeRevision).toBe(0);
    const reloaded = new ConfigStore();
    expect(reloaded.coordinatorName).toBe("Madeira node");
    expect(reloaded.userName).toBe("River");
    expect(reloaded.hostBadgeLabel).toBe("guide");
    expect(reloaded.hostBadgeEmoji).toBe("🦉");

    store.setAnnouncement(true);
    expect(store.runtimeRevision).toBe(1);
  });

  test("always includes the local WebSocket relay in the active pool", () => {
    const store = new ConfigStore();
    store.removeRelay(store.relays[0].id);

    expect(store.enabledRelayUrls).toEqual(["ws://localhost:4870"]);

    store.addRelay("wss://relay.example");
    expect(store.enabledRelayUrls).toEqual(["wss://relay.example", "ws://localhost:4870"]);
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
      }),
    );

    const store = new ConfigStore();

    expect(store.relays.map((relay) => relay.url)).toEqual(["wss://relay.valid.example"]);
    expect(store.announce).toBe(true);
    expect(store.maxUsers).toBe(DEFAULT_MAX_USERS);
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
  });
});
