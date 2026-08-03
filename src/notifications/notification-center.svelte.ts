import { SvelteMap } from "svelte/reactivity";

export const NOTIFICATION_STORAGE_KEY = "cordn:v1:notifications";
export const NOTIFICATION_FEED_STORAGE_KEY = "cordn:v1:notification-feed";
export const INVITATION_RESOLUTION_STORAGE_KEY = "cordn:v1:notification-resolutions";
export const DEFAULT_NOTIFICATION_CADENCE_MS = 15_000;
export const INVITATION_RESOLUTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

const MAX_NOTIFICATION_HISTORY = 100;
const MAX_SAFE_LABEL_LENGTH = 160;
const MAX_SAFE_KEY_LENGTH = 256;

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

export interface FeedNotificationEntry {
  id: string;
  category: NotificationCategory;
  key: string;
  actor?: string;
  room?: string;
  action?: "waiting" | "joined";
  createdAt: number;
  occurrences: number;
  read: boolean;
}

export interface InvitationResolution {
  id: string;
  resolvedAt: number;
}

interface PersistedNotificationPreferences {
  version: 1;
  enabled: boolean;
  cadenceMs: number;
  categories: NotificationCategories;
}

interface PersistedNotificationFeed {
  version: 1;
  entries: FeedNotificationEntry[];
}

interface PersistedInvitationResolutions {
  version: 1;
  entries: InvitationResolution[];
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
const NOTIFICATION_CATEGORIES = new Set<NotificationCategory>([
  "user_online",
  "new_message",
  "room_invite",
  "join_request",
]);

/**
 * The in-app feed is the notification source of truth. The browser Notification
 * API is only an optional, grouped projection of these safe event descriptors.
 */
export class NotificationCenterStore {
  permission = $state<NotificationPermission | "unsupported">(readPermission());
  enabled = $state(false);
  cadenceMs = $state(DEFAULT_NOTIFICATION_CADENCE_MS);
  categories = $state<NotificationCategories>({ ...DEFAULT_CATEGORIES });
  feed = $state<FeedNotificationEntry[]>([]);
  private resolutions = $state<InvitationResolution[]>([]);
  private readonly queued = new SvelteMap<string, CordnNotificationEvent>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const persisted = readPreferences();
    if (persisted) {
      this.enabled = persisted.enabled;
      this.cadenceMs = persisted.cadenceMs;
      this.categories = { ...persisted.categories };
    }
    this.feed = readFeed();
    const persistedResolutions = readInvitationResolutions();
    this.resolutions = pruneResolutions(persistedResolutions);
    if (this.resolutions.length !== persistedResolutions.length) this.persistInvitationResolutions();
  }

  get active(): boolean {
    return this.permission === "granted" && this.enabled;
  }

  get unreadCount(): number {
    return this.feed.reduce((count, entry) => count + (entry.read ? 0 : 1), 0);
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
    this.persistPreferences();
    return this.permission;
  }

  setEnabled(value: boolean): void {
    this.enabled = value && this.permission === "granted";
    if (!this.enabled) this.cancelQueued();
    this.persistPreferences();
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
    this.persistPreferences();
  }

  setCadence(value: number): void {
    if (!ALLOWED_CADENCES.has(value)) return;
    this.cadenceMs = value;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush(), this.cadenceMs);
    }
    this.persistPreferences();
  }

  /** Record a safe event for the feed, then optionally offer it to desktop delivery. */
  record(event: CordnNotificationEvent): void {
    const normalized = normalizeEvent(event);
    if (!normalized) return;

    const id = eventId(normalized);
    const previous = this.feed.find((entry) => entry.id === id);
    const entry: FeedNotificationEntry = {
      id,
      ...normalized,
      createdAt: Date.now(),
      occurrences: (previous?.occurrences ?? 0) + 1,
      read: previous?.read ?? false,
    };
    this.feed = this.trimFeed([entry, ...this.feed.filter((candidate) => candidate.id !== id)]);
    this.persistFeed();
    this.offerDesktopDelivery(normalized);
  }

  /** Compatibility for legacy producers. All producers now pass through record(). */
  enqueue(event: CordnNotificationEvent): void {
    this.record(event);
  }

  markVisibleRead(ids: readonly string[]): void {
    const visible = new Set(ids);
    let changed = false;
    this.feed = this.feed.map((entry) => {
      if (!visible.has(entry.id) || entry.read) return entry;
      changed = true;
      return { ...entry, read: true };
    });
    if (changed) this.persistFeed();
  }

  isInvitationResolved(id: string, now = Date.now()): boolean {
    const safeId = normalizeKey(id);
    if (!safeId) return false;
    const cutoff = now - INVITATION_RESOLUTION_RETENTION_MS;
    return this.resolutions.some((entry) => entry.id === safeId && entry.resolvedAt >= cutoff);
  }

  resolveInvitation(id: string, timestamp = Date.now()): void {
    const safeId = normalizeKey(id);
    if (!safeId || !Number.isFinite(timestamp)) return;
    const next = { id: safeId, resolvedAt: Math.floor(timestamp) };
    this.resolutions = pruneResolutions([
      next,
      ...this.resolutions.filter((entry) => entry.id !== safeId),
    ], timestamp);
    this.persistInvitationResolutions();
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

  private offerDesktopDelivery(event: CordnNotificationEvent): void {
    this.syncPermission();
    if (!this.active || !this.categories[event.category]) return;
    this.queued.set(eventId(event), event);
    if (this.timer === null) this.timer = setTimeout(() => this.flush(), this.cadenceMs);
  }

  private trimFeed(entries: FeedNotificationEntry[]): FeedNotificationEntry[] {
    return trimFeedEntries(entries);
  }

  private cancelQueued(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queued.clear();
  }

  private persistPreferences(): void {
    if (!("localStorage" in globalThis)) return;
    const preferences: PersistedNotificationPreferences = {
      version: 1,
      enabled: this.enabled,
      cadenceMs: this.cadenceMs,
      categories: { ...this.categories },
    };
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(preferences));
  }

  private persistFeed(): void {
    if (!("localStorage" in globalThis)) return;
    const feed: PersistedNotificationFeed = { version: 1, entries: this.feed.map(toPersistedFeedEntry) };
    localStorage.setItem(NOTIFICATION_FEED_STORAGE_KEY, JSON.stringify(feed));
  }

  private persistInvitationResolutions(): void {
    if (!("localStorage" in globalThis)) return;
    const resolutions: PersistedInvitationResolutions = { version: 1, entries: this.resolutions };
    localStorage.setItem(INVITATION_RESOLUTION_STORAGE_KEY, JSON.stringify(resolutions));
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

function readFeed(): FeedNotificationEntry[] {
  if (!("localStorage" in globalThis)) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_FEED_STORAGE_KEY) ?? "null") as Partial<PersistedNotificationFeed> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    const entries = parsed.entries.flatMap((entry) => {
      const safe = normalizePersistedFeedEntry(entry);
      return safe ? [safe] : [];
    }).sort((left, right) => right.createdAt - left.createdAt);
    const ids = new Set<string>();
    return trimFeedEntries(entries.filter((entry) => {
      if (ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    }));
  } catch {
    return [];
  }
}

function readInvitationResolutions(): InvitationResolution[] {
  if (!("localStorage" in globalThis)) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(INVITATION_RESOLUTION_STORAGE_KEY) ?? "null") as Partial<PersistedInvitationResolutions> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.flatMap((entry) => {
      const id = normalizeKey(entry?.id);
      const resolvedAt = entry?.resolvedAt;
      return id && Number.isFinite(resolvedAt) ? [{ id, resolvedAt: Math.floor(resolvedAt) }] : [];
    });
  } catch {
    return [];
  }
}

function pruneResolutions(entries: InvitationResolution[], now = Date.now()): InvitationResolution[] {
  const cutoff = now - INVITATION_RESOLUTION_RETENTION_MS;
  const ids = new Set<string>();
  return entries.filter((entry) => {
    if (entry.resolvedAt < cutoff || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}

function trimFeedEntries(entries: FeedNotificationEntry[]): FeedNotificationEntry[] {
  const next = [...entries];
  let ordinaryEntries = next.filter((entry) => entry.category !== "room_invite").length;
  for (let index = next.length - 1; index >= 0 && ordinaryEntries > MAX_NOTIFICATION_HISTORY; index -= 1) {
    if (next[index].category === "room_invite") continue;
    next.splice(index, 1);
    ordinaryEntries -= 1;
  }
  return next;
}

function normalizePersistedFeedEntry(value: unknown): FeedNotificationEntry | null {
  if (!isRecord(value)) return null;
  const candidate = value as unknown as Partial<FeedNotificationEntry>;
  const normalized = normalizeEvent({
    category: candidate.category as NotificationCategory,
    key: candidate.key ?? "",
    actor: candidate.actor,
    room: candidate.room,
    action: candidate.action,
  });
  const createdAt = candidate.createdAt;
  const occurrences = candidate.occurrences;
  if (!normalized
    || typeof createdAt !== "number"
    || !Number.isFinite(createdAt)
    || typeof occurrences !== "number"
    || !Number.isInteger(occurrences)
    || occurrences < 1
    || typeof candidate.read !== "boolean") return null;
  return {
    id: eventId(normalized),
    ...normalized,
    createdAt: Math.floor(createdAt),
    occurrences,
    read: candidate.read,
  };
}

function normalizeEvent(value: CordnNotificationEvent): CordnNotificationEvent | null {
  if (!NOTIFICATION_CATEGORIES.has(value.category)) return null;
  const key = normalizeKey(value.key);
  if (!key) return null;
  const actor = normalizeLabel(value.actor);
  const room = normalizeLabel(value.room);
  const action = value.action === "waiting" || value.action === "joined" ? value.action : undefined;
  return { category: value.category, key, ...(actor ? { actor } : {}), ...(room ? { room } : {}), ...(action ? { action } : {}) };
}

function toPersistedFeedEntry(entry: FeedNotificationEntry): FeedNotificationEntry {
  return { ...entry };
}

function eventId(event: CordnNotificationEvent): string {
  return `${event.category}:${event.key}`;
}

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return key.length > 0 && key.length <= MAX_SAFE_KEY_LENGTH ? key : null;
}

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const label = value.trim().slice(0, MAX_SAFE_LABEL_LENGTH);
  return label || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
