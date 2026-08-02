import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  DEFAULT_NOTIFICATION_CADENCE_MS,
  NotificationCenterStore,
} from "../../src/notifications/notification-center.svelte";

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
});
