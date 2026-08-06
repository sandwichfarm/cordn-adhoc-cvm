import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_NOTIFICATION_CADENCE_MS,
  NOTIFICATION_FEED_STORAGE_KEY,
  NotificationCenterStore,
} from "../../src/notifications/notification-center.svelte";
import { channelPreferences, registerChannelNotificationRelationships } from "../../src/notifications/channel-preferences.svelte";

interface CapturedNotification {
  title: string;
  options?: NotificationOptions;
}

const originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
let captured: CapturedNotification[];
let permissionRequests: number;

class MockNotification {
  static permission: NotificationPermission = "default";
  static async requestPermission(): Promise<NotificationPermission> {
    permissionRequests += 1;
    MockNotification.permission = "granted";
    return "granted";
  }

  onclick: ((event: Event) => void) | null = null;

  constructor(title: string, options?: NotificationOptions) {
    captured.push({ title, options });
  }

  close(): void {}
}

describe("NotificationCenterStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    captured = [];
    permissionRequests = 0;
    MockNotification.permission = "default";
    Object.defineProperty(globalThis, "Notification", { configurable: true, value: MockNotification });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalNotification) Object.defineProperty(globalThis, "Notification", originalNotification);
    else Reflect.deleteProperty(globalThis, "Notification");
  });

  test("defaults to online notifications only and waits for an explicit permission request", async () => {
    const store = new NotificationCenterStore();

    expect(store.enabled).toBe(false);
    expect(store.categories).toEqual({
      user_online: true,
      new_message: false,
      room_invite: false,
      join_request: false,
    });
    expect(permissionRequests).toBe(0);

    await store.requestPermission();

    expect(permissionRequests).toBe(1);
    expect(store.active).toBe(true);
    store.destroy();
  });

  test("groups multiple online transitions into one concise notification", async () => {
    const store = new NotificationCenterStore();
    await store.requestPermission();

    store.enqueue({ category: "user_online", key: "alice", actor: "Alice" });
    store.enqueue({ category: "user_online", key: "bob", actor: "Bob" });
    await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFICATION_CADENCE_MS);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      title: "2 people are online",
      options: expect.objectContaining({ body: "Alice, Bob", tag: "cordn-grouped-updates" }),
    });
    store.destroy();
  });

  test("keeps messages off until enabled and persists delivery preferences", async () => {
    const store = new NotificationCenterStore();
    await store.requestPermission();

    store.enqueue({ category: "new_message", key: "first", actor: "Alice", room: "lobby" });
    await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFICATION_CADENCE_MS);
    expect(captured).toHaveLength(0);

    store.setCategory("new_message", true);
    store.setCadence(30_000);
    const reloaded = new NotificationCenterStore();

    expect(reloaded.enabled).toBe(true);
    expect(reloaded.categories.new_message).toBe(true);
    expect(reloaded.cadenceMs).toBe(30_000);
    store.destroy();
    reloaded.destroy();
  });

  test("filters channel message notifications by mute and relationship preferences", () => {
    const store = new NotificationCenterStore();
    const roomKey = "coordinator\0filtered-room";
    const unregisterRelationships = registerChannelNotificationRelationships(() => ({ following: ["alice"], mutuals: [] }));

    channelPreferences.setNotifications(roomKey, "mute");
    store.record({ category: "new_message", key: "muted", roomKey, actorPubkey: "alice" });
    expect(store.feed).toHaveLength(0);

    channelPreferences.setNotifications(roomKey, "follows");
    store.record({ category: "new_message", key: "followed", roomKey, actorPubkey: "alice" });
    store.record({ category: "new_message", key: "stranger", roomKey, actorPubkey: "bob" });
    expect(store.feed.map((entry) => entry.key)).toEqual(["followed"]);

    channelPreferences.setNotifications(roomKey, "all");
    unregisterRelationships();
    store.destroy();
  });

  test("deduplicates repeated events during a cadence window", async () => {
    const store = new NotificationCenterStore();
    await store.requestPermission();

    store.enqueue({ category: "user_online", key: "alice", actor: "Alice" });
    store.enqueue({ category: "user_online", key: "alice", actor: "Alice" });
    await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFICATION_CADENCE_MS);

    expect(captured).toHaveLength(1);
    expect(captured[0].title).toBe("Alice is online");
    store.destroy();
  });

  test("records safe feed activity even when desktop delivery is unavailable", () => {
    const store = new NotificationCenterStore();

    store.record({ category: "user_online", key: "alice", actor: "Alice" });

    expect(captured).toHaveLength(0);
    expect(store.unreadCount).toBe(1);
    expect(store.feed).toEqual([
      expect.objectContaining({
        id: "user_online:alice",
        category: "user_online",
        key: "alice",
        actor: "Alice",
        occurrences: 1,
        read: false,
      }),
    ]);
    expect(JSON.stringify(localStorage)).not.toContain("inviteUrl");
    store.destroy();
  });

  test("upserts feed rows independently from desktop queue deduplication", async () => {
    const store = new NotificationCenterStore();
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"));
    store.record({ category: "user_online", key: "alice", actor: "Alice" });
    vi.setSystemTime(new Date("2026-08-03T12:01:00Z"));
    store.record({ category: "user_online", key: "alice", actor: "Alice" });

    expect(store.feed).toHaveLength(1);
    expect(store.feed[0]).toEqual(expect.objectContaining({ occurrences: 2, createdAt: Date.parse("2026-08-03T12:01:00Z") }));

    await store.requestPermission();
    store.record({ category: "user_online", key: "alice", actor: "Alice" });
    store.record({ category: "user_online", key: "alice", actor: "Alice" });
    await vi.advanceTimersByTimeAsync(DEFAULT_NOTIFICATION_CADENCE_MS);

    expect(captured).toHaveLength(1);
    expect(captured[0].title).toBe("Alice is online");
    store.destroy();
  });

  test("marks feed entries read without resolving invitation records", () => {
    const store = new NotificationCenterStore();
    store.record({ category: "room_invite", key: "invite-1", actor: "Alice", room: "lobby" });

    store.markVisibleRead(["room_invite:invite-1"]);

    expect(store.feed[0]).toEqual(expect.objectContaining({ read: true }));
    expect(store.unreadCount).toBe(0);
    expect(store.isInvitationResolved("invite-1")).toBe(false);
    store.destroy();
  });

  test("clears persisted feed history without resolving live invitations", () => {
    const store = new NotificationCenterStore();
    store.record({ category: "room_invite", key: "invite-1", actor: "Alice", room: "lobby" });
    store.record({ category: "new_message", key: "message-1", actor: "Bob", room: "lobby" });

    store.clearAll();

    expect(store.feed).toEqual([]);
    expect(store.unreadCount).toBe(0);
    expect(store.isInvitationResolved("invite-1")).toBe(false);
    expect(JSON.parse(localStorage.getItem(NOTIFICATION_FEED_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      entries: [],
    });
    expect(new NotificationCenterStore().feed).toEqual([]);
    store.destroy();
  });

  test("persists only bounded, safe feed metadata without evicting pending invitations", () => {
    const store = new NotificationCenterStore();
    store.record({ category: "room_invite", key: "keep", actor: "Alice", room: "private room" });
    for (let index = 0; index < 101; index += 1) {
      store.record({ category: "new_message", key: `message-${index}`, actor: "Bob", room: "lobby" });
    }

    expect(store.feed).toHaveLength(101);
    expect(store.feed.some((entry) => entry.id === "room_invite:keep")).toBe(true);
    expect(store.feed.some((entry) => entry.id === "new_message:message-0")).toBe(false);

    const persisted = localStorage.getItem(NOTIFICATION_FEED_STORAGE_KEY) ?? "";
    expect(persisted).toContain("room_invite:keep");
    expect(persisted).not.toContain("inviteUrl");
    expect(persisted).not.toContain("message body");

    const reloaded = new NotificationCenterStore();
    expect(reloaded.feed.some((entry) => entry.id === "room_invite:keep")).toBe(true);
    store.destroy();
    reloaded.destroy();
  });

  test("prunes resolved invitation IDs after the fixed replay window", () => {
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"));
    const store = new NotificationCenterStore();
    store.resolveInvitation("handled-invite");
    expect(store.isInvitationResolved("handled-invite")).toBe(true);

    vi.setSystemTime(new Date("2026-08-10T12:00:01Z"));
    const reloaded = new NotificationCenterStore();
    expect(reloaded.isInvitationResolved("handled-invite")).toBe(false);
    expect(localStorage.getItem("cordn:v1:notification-resolutions")).not.toContain("handled-invite");
    store.destroy();
    reloaded.destroy();
  });

  test("silently rejects malformed and duplicate persisted feed records", () => {
    localStorage.setItem(NOTIFICATION_FEED_STORAGE_KEY, JSON.stringify({
      version: 1,
      entries: [
        { category: "new_message", key: "message", actor: "Alice", createdAt: 2, occurrences: 1, read: false },
        { category: "new_message", key: "message", actor: "Alice", createdAt: 1, occurrences: 1, read: false },
        { category: "room_invite", key: "", createdAt: 3, occurrences: 1, read: false },
      ],
    }));

    const store = new NotificationCenterStore();

    expect(store.feed).toEqual([
      expect.objectContaining({ id: "new_message:message", createdAt: 2 }),
    ]);
    store.destroy();
  });
});
