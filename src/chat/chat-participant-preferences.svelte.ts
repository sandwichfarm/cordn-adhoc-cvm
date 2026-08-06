import { roomIdentityKey } from "./room-store";

export const CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY = "cordn:v1:chat-participant-preferences";

interface PersistedParticipantPreferences {
  version: 1;
  ignores: Record<string, true>;
}

interface ParticipantPreferenceState {
  ignores: Record<string, true>;
}

export class ChatParticipantPreferencesStore {
  preferences = $state<ParticipantPreferenceState>(readPreferences());

  isIgnored(coordinatorPubkey: string, roomId: string, participantPubkey: string): boolean {
    const key = ignoreKey(coordinatorPubkey, roomId, participantPubkey);
    return key !== null && this.preferences.ignores[key] === true;
  }

  setIgnored(coordinatorPubkey: string, roomId: string, participantPubkey: string, ignored: boolean): void {
    const key = ignoreKey(coordinatorPubkey, roomId, participantPubkey);
    if (key === null) return;

    const ignores = { ...this.preferences.ignores };
    if (ignored) ignores[key] = true;
    else delete ignores[key];
    this.preferences = { ignores };
    persistPreferences(this.preferences);
  }
}

function ignoreKey(coordinatorPubkey: string, roomId: string, participantPubkey: string): string | null {
  const coordinator = normalizePubkey(coordinatorPubkey);
  const participant = normalizePubkey(participantPubkey);
  if (!coordinator || !participant || !isRoomId(roomId)) return null;
  return `${roomIdentityKey(coordinator, roomId)}\u0000${participant}`;
}

function readPreferences(): ParticipantPreferenceState {
  const raw = getStoredValue();
  if (!raw) return { ignores: {} };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.ignores)) return { ignores: {} };

    const ignores: Record<string, true> = {};
    for (const [key, value] of Object.entries(parsed.ignores)) {
      if (value === true && parseIgnoreKey(key) !== null) ignores[key] = true;
    }
    return { ignores };
  } catch {
    return { ignores: {} };
  }
}

function parseIgnoreKey(value: string): { coordinatorPubkey: string; roomId: string; participantPubkey: string } | null {
  const [coordinatorPubkey, roomId, participantPubkey, extra] = value.split("\u0000");
  if (extra !== undefined || !coordinatorPubkey || !participantPubkey || !isRoomId(roomId)) return null;
  const coordinator = normalizePubkey(coordinatorPubkey);
  const participant = normalizePubkey(participantPubkey);
  if (!coordinator || !participant) return null;
  return { coordinatorPubkey: coordinator, roomId, participantPubkey: participant };
}

function normalizePubkey(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function isRoomId(value: string): boolean {
  return value.trim().length > 0 && !value.includes("\u0000");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function persistPreferences(state: ParticipantPreferenceState): void {
  try {
    if (Object.keys(state.ignores).length === 0) {
      localStorage.removeItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY);
      return;
    }
    const persisted: PersistedParticipantPreferences = { version: 1, ignores: state.ignores };
    localStorage.setItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Preferences still apply for this session when browser storage is unavailable.
  }
}

function getStoredValue(): string | null {
  try {
    return localStorage.getItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const chatParticipantPreferences = new ChatParticipantPreferencesStore();
