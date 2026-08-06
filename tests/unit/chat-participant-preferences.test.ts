import { beforeEach, describe, expect, test } from "vitest";

import {
  CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY,
  ChatParticipantPreferencesStore,
} from "../../src/chat/chat-participant-preferences.svelte";
import { roomIdentityKey, sameRoomIdentity } from "../../src/chat/room-store";

const coordinatorA = "a".repeat(64);
const coordinatorB = "b".repeat(64);
const participantA = "c".repeat(64);
const participantB = "d".repeat(64);

function store(): ChatParticipantPreferencesStore {
  return new ChatParticipantPreferencesStore();
}

describe("chat participant preferences — ignore", () => {
  beforeEach(() => localStorage.clear());

  test("starts empty and reloads ignores only for the exact coordinator, room, and participant", () => {
    const preferences = store();

    expect(preferences.isIgnored(coordinatorA, "same-room", participantA)).toBe(false);
    preferences.setIgnored(coordinatorA.toUpperCase(), "same-room", participantA.toUpperCase(), true);

    const reloaded = store();
    expect(reloaded.isIgnored(coordinatorA, "same-room", participantA)).toBe(true);
    expect(reloaded.isIgnored(coordinatorB, "same-room", participantA)).toBe(false);
    expect(reloaded.isIgnored(coordinatorA, "other-room", participantA)).toBe(false);
    expect(reloaded.isIgnored(coordinatorA, "same-room", participantB)).toBe(false);
  });

  test("keeps the established composite room identity invariant — no-change", () => {
    const preferences = store();
    const sameIdAtCoordinatorA = { coordinatorPubkey: coordinatorA, id: "same-room" };
    const sameIdAtCoordinatorB = { coordinatorPubkey: coordinatorB, id: "same-room" };

    expect(roomIdentityKey(coordinatorA, "same-room")).not.toBe(roomIdentityKey(coordinatorB, "same-room"));
    expect(sameRoomIdentity(sameIdAtCoordinatorA, sameIdAtCoordinatorB)).toBe(false);

    preferences.setIgnored(coordinatorA, "same-room", participantA, true);
    expect(preferences.isIgnored(sameIdAtCoordinatorA.coordinatorPubkey, sameIdAtCoordinatorA.id, participantA)).toBe(true);
    expect(preferences.isIgnored(sameIdAtCoordinatorB.coordinatorPubkey, sameIdAtCoordinatorB.id, participantA)).toBe(false);
  });

  test("clearing an ignore deletes the sparse entry and eventually the record", () => {
    const preferences = store();
    preferences.setIgnored(coordinatorA, "room", participantA, true);
    preferences.setIgnored(coordinatorA, "room", participantA, false);

    expect(preferences.isIgnored(coordinatorA, "room", participantA)).toBe(false);
    expect(localStorage.getItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  test("repairs malformed, invalid, inherited, and unsafe ignore storage without throwing", () => {
    const invalidRecords = [
      "{",
      JSON.stringify({ version: 2, ignores: {} }),
      JSON.stringify({ version: 1, ignores: [] }),
      JSON.stringify({ version: 1, ignores: { "__proto__": true } }),
      JSON.stringify({ version: 1, ignores: { [`${roomIdentityKey(coordinatorA, "room")}\u0000${participantA}`]: "true" } }),
      JSON.stringify({ version: 1, ignores: { [`${roomIdentityKey("not-a-pubkey", "room")}\u0000${participantA}`]: true } }),
      JSON.stringify({ version: 1, ignores: { [`${roomIdentityKey(coordinatorA, "")}\u0000${participantA}`]: true } }),
    ];

    for (const value of invalidRecords) {
      localStorage.setItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY, value);
      expect(() => store()).not.toThrow();
      expect(store().isIgnored(coordinatorA, "room", participantA)).toBe(false);
    }
  });

  test("serializes only the exact preference identity and never shared-room or sensitive fields", () => {
    const preferences = store();
    preferences.setIgnored(coordinatorA, "room", participantA, true);

    const serialized = localStorage.getItem(CHAT_PARTICIPANT_PREFERENCES_STORAGE_KEY) ?? "";
    expect(serialized).toContain(coordinatorA);
    expect(serialized).toContain(participantA);
    for (const prohibited of ["message", "invite", "capability", "stateBase64", "pending", "keyPackage", "secret", "signer", "decrypted", "content"]) {
      expect(serialized).not.toContain(prohibited);
    }
  });
});
