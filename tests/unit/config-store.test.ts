import { describe, expect, test, vi } from "vitest";

import { ConfigStore } from "../../src/config/config.svelte";
import { DEFAULT_MAX_USERS } from "../../src/config/config-validator";

describe("ConfigStore runtime limits", () => {
  test("defaults announcement off and exposes coordinator options", () => {
    const store = new ConfigStore();

    expect(store.coordinatorOptions).toEqual({
      announce: false,
      maxUsers: DEFAULT_MAX_USERS,
    });

    store.setAnnouncement(true);

    expect(store.coordinatorOptions.announce).toBe(true);
  });

  test("rejects lowering max users below active users", () => {
    const store = new ConfigStore();
    store.setActiveUserCount(5);

    expect(store.setMaxUsers(4)).toBe(false);
    expect(store.limitError).toBe("Maximum users cannot be below 5 active users");
    expect(store.maxUsers).toBe(DEFAULT_MAX_USERS);
  });

  test("raises max users when active count exceeds the previous limit", () => {
    const store = new ConfigStore();

    expect(store.setMaxUsers(2)).toBe(true);
    store.setActiveUserCount(3);

    expect(store.activeUserCount).toBe(3);
    expect(store.maxUsers).toBe(3);
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
});
