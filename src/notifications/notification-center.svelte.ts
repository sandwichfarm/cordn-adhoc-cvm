import { SvelteMap } from "svelte/reactivity";

export const NOTIFICATION_STORAGE_KEY = "cordn:v1:notifications";
export const DEFAULT_NOTIFICATION_CADENCE_MS = 15_000;

export type NotificationCategory = "user_online" | "new_message" | "room_invite" | "join_request";

export interface NotificationCategories {
  user_online: boolean;
  new_message: boolean;
  room_invite: boolean;
  join_request: boolean;
}

export interface CordnNotificationEvent {
  category: NotificationCategory;
  key: string;
  actor?: string;
  room?: string;
  action?: "waiting" | "joined";
}

interface PersistedNotificationPreferences {
  version: 1;
  enabled: boolean;
  cadenceMs: number;
  categories: NotificationCategories;
}

interface NotificationCopy {
  title: string;
  body: string;
}

const DEFAULT_CATEGORIES: NotificationCategories = {
  user_online: true,
  new_message: false,
  room_invite: false,
  join_request: false,
};

const ALLOWED_CADENCES = new Set([5_000, 15_000, 30_000, 60_000]);

export class NotificationCenterStore {
  permission = $state<NotificationPermission | "unsupported">(readPermission());
  enabled = $state(false);
  cadenceMs = $state(DEFAULT_NOTIFICATION_CADENCE_MS);
  categories = $state<NotificationCategories>({ ...DEFAULT_CATEGORIES });
  private readonly queued = new SvelteMap<string, CordnNotificationEvent>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const persisted = readPreferences();
    if (!persisted) return;
    this.enabled = persisted.enabled;
    this.cadenceMs = persisted.cadenceMs;
    this.categories = { ...persisted.categories };
  }

  get active(): boolean {
    return this.permission === "granted" && this.enabled;
  }

  syncPermission(): void {
    this.permission = readPermission();
    if (this.permission !== "granted") this.cancelQueued();
  }

  async requestPermission(): Promise<NotificationPermission | "unsupported"> {
    if (!("Notification" in globalThis)) {
      this.permission = "unsupported";
      return this.permission;
    }
    this.permission = await Notification.requestPermission();
    if (this.permission === "granted") this.enabled = true;
    this.persist();
    return this.permission;
  }

  setEnabled(value: boolean): void {
    this.enabled = value && this.permission === "granted";
    if (!this.enabled) this.cancelQueued();
    this.persist();
  }

  setCategory(category: NotificationCategory, value: boolean): void {
    this.categories = { ...this.categories, [category]: value };
    if (!value) {
      for (const [key, event] of this.queued) {
        if (event.category === category) this.queued.delete(key);
      }
      if (this.queued.size === 0 && this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
    this.persist();
  }

  setCadence(value: number): void {
    if (!ALLOWED_CADENCES.has(value)) return;
    this.cadenceMs = value;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), this.cadenceMs);
    }
    this.persist();
  }

  enqueue(event: CordnNotificationEvent): void {
    this.syncPermission();
    if (!this.active || !this.categories[event.category]) return;
    this.queued.set(`${event.category}:${event.key}`, event);
    if (this.timer === null) this.timer = setTimeout(() => this.flush(), this.cadenceMs);
  }

  flush(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (!this.active || this.queued.size === 0 || !("Notification" in globalThis)) {
      this.queued.clear();
      return;
    }
    const events = [...this.queued.values()];
    this.queued.clear();
    const copy = summarize(events);
    const notification = new Notification(copy.title, {
      body: copy.body,
      tag: "cordn-grouped-updates",
    });
    notification.onclick = () => {
      if ("focus" in globalThis && typeof globalThis.focus === "function") globalThis.focus();
      notification.close();
    };
  }

  destroy(): void {
    this.cancelQueued();
  }

  private cancelQueued(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queued.clear();
  }

  private persist(): void {
    if (!("localStorage" in globalThis)) return;
    const preferences: PersistedNotificationPreferences = {
      version: 1,
      enabled: this.enabled,
      cadenceMs: this.cadenceMs,
      categories: { ...this.categories },
    };
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(preferences));
  }
}

function readPermission(): NotificationPermission | "unsupported" {
  return "Notification" in globalThis ? Notification.permission : "unsupported";
}

function readPreferences(): PersistedNotificationPreferences | null {
  if (!("localStorage" in globalThis)) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? "null") as Partial<PersistedNotificationPreferences> | null;
    if (!parsed || parsed.version !== 1) return null;
    const storedCategories = parsed.categories ?? DEFAULT_CATEGORIES;
    return {
      version: 1,
      enabled: parsed.enabled === true,
      cadenceMs: ALLOWED_CADENCES.has(parsed.cadenceMs ?? 0) ? parsed.cadenceMs! : DEFAULT_NOTIFICATION_CADENCE_MS,
      categories: {
        user_online: storedCategories.user_online !== false,
        new_message: storedCategories.new_message === true,
        room_invite: storedCategories.room_invite === true,
        join_request: storedCategories.join_request === true,
      },
    };
  } catch {
    return null;
  }
}

function summarize(events: CordnNotificationEvent[]): NotificationCopy {
  if (events.length === 1) return summarizeOne(events[0]);
  const counts = new SvelteMap<NotificationCategory, number>();
  for (const event of events) counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
  if (counts.size === 1) {
    const category = events[0].category;
    const count = events.length;
    if (category === "user_online") {
      const names = events.map((event) => event.actor).filter(Boolean).slice(0, 2).join(", ");
      return { title: `${count} people are online`, body: names || "Available on Cordn." };
    }
    if (category === "new_message") {
      const rooms = new Set(events.map((event) => event.room).filter(Boolean));
      return { title: `${count} new messages`, body: rooms.size === 1 ? `In #${[...rooms][0]}.` : `Across ${rooms.size} rooms.` };
    }
    if (category === "room_invite") return { title: `${count} new room invites`, body: "Open Cordn to review them." };
    return { title: `${count} guests need attention`, body: "Open Cordn to review room access." };
  }

  const parts: string[] = [];
  const online = counts.get("user_online") ?? 0;
  const messages = counts.get("new_message") ?? 0;
  const invites = counts.get("room_invite") ?? 0;
  const requests = counts.get("join_request") ?? 0;
  if (online) parts.push(`${online} online`);
  if (messages) parts.push(`${messages} ${messages === 1 ? "message" : "messages"}`);
  if (invites) parts.push(`${invites} ${invites === 1 ? "invite" : "invites"}`);
  if (requests) parts.push(`${requests} ${requests === 1 ? "join request" : "join requests"}`);
  return { title: "Cordn updates", body: parts.join(" · ") };
}

function summarizeOne(event: CordnNotificationEvent): NotificationCopy {
  const actor = event.actor?.trim() || "Someone";
  const room = event.room?.trim();
  if (event.category === "user_online") return { title: `${actor} is online`, body: "Available on Cordn." };
  if (event.category === "new_message") return { title: room ? `New message in #${room}` : "New message", body: `From ${actor}.` };
  if (event.category === "room_invite") return { title: "New room invite", body: room ? `${actor} invited you to ${room}.` : `From ${actor}.` };
  if (event.action === "joined") return { title: room ? `Guest joined #${room}` : "A guest joined", body: "Admitted automatically." };
  return { title: "Guest waiting to join", body: room ? `Review #${room}.` : "Open Cordn to review access." };
}

export const notificationCenter = new NotificationCenterStore();
