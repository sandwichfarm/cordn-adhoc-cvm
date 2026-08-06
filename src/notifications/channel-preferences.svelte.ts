export type ChannelSoundMode = "global" | "on" | "off";
export type ChannelNotificationMode = "mute" | "follows" | "mutuals" | "all";

export interface ChannelPreferences {
  sound: ChannelSoundMode;
  notifications: ChannelNotificationMode;
}

export const CHANNEL_PREFERENCES_STORAGE_KEY = "cordn:v1:channel-preferences";
export const GLOBAL_SOUND_STORAGE_KEY = "cordn:v1:global-sound";
const DEFAULTS: ChannelPreferences = { sound: "global", notifications: "all" };
const SOUND_MODES = new Set<ChannelSoundMode>(["global", "on", "off"]);
const NOTIFICATION_MODES = new Set<ChannelNotificationMode>(["mute", "follows", "mutuals", "all"]);

interface NotificationRelationships {
  following: readonly string[];
  mutuals: readonly string[];
}

let relationshipProvider = (): NotificationRelationships => ({ following: [], mutuals: [] });

export function registerChannelNotificationRelationships(provider: () => NotificationRelationships): () => void {
  relationshipProvider = provider;
  return () => { relationshipProvider = () => ({ following: [], mutuals: [] }); };
}

export function channelNotificationRelationships(): NotificationRelationships {
  return relationshipProvider();
}

export class ChannelPreferenceStore {
  globalSound = $state(readGlobalSound());
  channels = $state<Record<string, ChannelPreferences>>(readChannels());

  get(key: string): ChannelPreferences { return this.channels[key] ?? DEFAULTS; }
  soundEnabled(key: string): boolean {
    const mode = this.get(key).sound;
    return mode === "global" ? this.globalSound : mode === "on";
  }
  isDefault(key: string): boolean {
    const value = this.get(key);
    return value.sound === "global" && value.notifications === "all";
  }
  setGlobalSound(enabled: boolean): void {
    this.globalSound = enabled;
    localStorage.setItem(GLOBAL_SOUND_STORAGE_KEY, JSON.stringify(enabled));
  }
  setSound(key: string, sound: ChannelSoundMode): void { this.set(key, { ...this.get(key), sound }); }
  setNotifications(key: string, notifications: ChannelNotificationMode): void { this.set(key, { ...this.get(key), notifications }); }
  allows(key: string, actorPubkey: string | undefined, following: readonly string[], mutuals: readonly string[]): boolean {
    const mode = this.get(key).notifications;
    if (mode === "all") return true;
    if (mode === "mute" || !actorPubkey) return false;
    return mode === "follows" ? following.includes(actorPubkey) : mutuals.includes(actorPubkey);
  }
  private set(key: string, value: ChannelPreferences): void {
    const channels = { ...this.channels };
    if (value.sound === "global" && value.notifications === "all") delete channels[key];
    else channels[key] = value;
    this.channels = channels;
    localStorage.setItem(CHANNEL_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 1, channels }));
  }
}

function readGlobalSound(): boolean {
  try { return JSON.parse(localStorage.getItem(GLOBAL_SOUND_STORAGE_KEY) ?? "true") === true; } catch { return true; }
}
function readChannels(): Record<string, ChannelPreferences> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHANNEL_PREFERENCES_STORAGE_KEY) ?? "null") as { version?: number; channels?: Record<string, ChannelPreferences> } | null;
    if (parsed?.version !== 1 || !parsed.channels || typeof parsed.channels !== "object") return {};
    return Object.fromEntries(Object.entries(parsed.channels).filter(([key, value]) => key.length > 0
      && value !== null
      && typeof value === "object"
      && SOUND_MODES.has(value.sound)
      && NOTIFICATION_MODES.has(value.notifications)));
  } catch { return {}; }
}

export const channelPreferences = new ChannelPreferenceStore();
