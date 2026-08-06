import { beforeEach, describe, expect, test } from "vitest";

import {
  CHANNEL_PREFERENCES_STORAGE_KEY,
  ChannelPreferenceStore,
  GLOBAL_SOUND_STORAGE_KEY,
} from "../../src/notifications/channel-preferences.svelte";

describe("ChannelPreferenceStore", () => {
  beforeEach(() => localStorage.clear());

  test("persists global sound and lets a channel override it", () => {
    const store = new ChannelPreferenceStore();
    const roomKey = "coordinator:room";

    store.setGlobalSound(false);
    expect(store.soundEnabled(roomKey)).toBe(false);

    store.setSound(roomKey, "on");
    expect(store.soundEnabled(roomKey)).toBe(true);
    expect(store.isDefault(roomKey)).toBe(false);

    const reloaded = new ChannelPreferenceStore();
    expect(reloaded.globalSound).toBe(false);
    expect(reloaded.get(roomKey).sound).toBe("on");
    expect(JSON.parse(localStorage.getItem(GLOBAL_SOUND_STORAGE_KEY) ?? "null")).toBe(false);
  });

  test("applies all, follows, mutuals, and mute notification modes", () => {
    const store = new ChannelPreferenceStore();
    const roomKey = "coordinator:room";
    const alice = "alice";

    expect(store.allows(roomKey, undefined, [], [])).toBe(true);
    store.setNotifications(roomKey, "follows");
    expect(store.allows(roomKey, alice, [alice], [])).toBe(true);
    expect(store.allows(roomKey, "stranger", [alice], [])).toBe(false);

    store.setNotifications(roomKey, "mutuals");
    expect(store.allows(roomKey, alice, [alice], [alice])).toBe(true);
    expect(store.allows(roomKey, "follow-only", ["follow-only"], [alice])).toBe(false);

    store.setNotifications(roomKey, "mute");
    expect(store.allows(roomKey, alice, [alice], [alice])).toBe(false);
  });

  test("drops defaults and rejects malformed persisted channel modes", () => {
    const roomKey = "coordinator:room";
    const store = new ChannelPreferenceStore();
    store.setSound(roomKey, "off");
    store.setSound(roomKey, "global");
    expect(store.isDefault(roomKey)).toBe(true);
    expect(JSON.parse(localStorage.getItem(CHANNEL_PREFERENCES_STORAGE_KEY) ?? "null").channels).toEqual({});

    localStorage.setItem(CHANNEL_PREFERENCES_STORAGE_KEY, JSON.stringify({
      version: 1,
      channels: { unsafe: { sound: "loud", notifications: "everyone" } },
    }));
    expect(new ChannelPreferenceStore().get("unsafe")).toEqual({ sound: "global", notifications: "all" });
  });
});
