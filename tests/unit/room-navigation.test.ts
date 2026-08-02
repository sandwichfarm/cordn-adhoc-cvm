import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrSigner } from "@contextvm/sdk/core";
import { ChatRoomSession, forgetRememberedHostRoom, hostIdentityForRoom, listRooms, loadRememberedHostRoom, loadRoom, reconcileRoomHostIdentity, rememberActiveHostRoom, removeStoredRoom, ROOMS_CHANGED_EVENT, saveRoom, type StoredRoom } from "../../src/chat/room-store";

function storedRoom(input: Partial<StoredRoom> & Pick<StoredRoom, "id" | "title" | "coordinatorPubkey" | "isHost">): StoredRoom {
  return {
    version: 1,
    relayUrls: ["wss://relay.example"],
    coordinatorOrigin: "https://adhoc.example",
    name: input.isHost ? "Host" : "Guest",
    stablePubkey: "1".repeat(64),
    stateBase64: "",
    keyPackage: {
      reference: `${input.id}-key`,
      publicBase64: "",
      privateBase64: "",
    },
    lastCursor: 0,
    messages: [],
    pending: [],
    ...input,
  };
}

function legacyRoomKey(room: Pick<StoredRoom, "id">): string {
  return `cordn-adhoc-chat-room:${room.id}`;
}

function currentRoomKey(room: Pick<StoredRoom, "id" | "coordinatorPubkey">): string {
  return `cordn-adhoc-chat-room:v2:${encodeURIComponent(room.coordinatorPubkey)}:${encodeURIComponent(room.id)}`;
}

describe("room navigation persistence", () => {
  beforeEach(() => localStorage.clear());

  it("discovers every locally known room and sorts recent activity first", () => {
    const homeRoom = storedRoom({
      id: "home-one",
      title: "Home one",
      coordinatorPubkey: "a".repeat(64),
      isHost: true,
      updatedAt: 100,
    });
    const remoteRoom = storedRoom({
      id: "remote-one",
      title: "Remote one",
      coordinatorPubkey: "b".repeat(64),
      isHost: false,
      updatedAt: 200,
    });

    localStorage.setItem("unrelated", "{}");
    localStorage.setItem(`cordn-adhoc-chat-room:${homeRoom.id}`, JSON.stringify(homeRoom));
    localStorage.setItem(`cordn-adhoc-chat-room:${remoteRoom.id}`, JSON.stringify(remoteRoom));

    expect(listRooms().map((room) => room.id)).toEqual(["remote-one", "home-one"]);
  });

  it("notifies the shared shell whenever a room is saved", () => {
    const listener = vi.fn();
    window.addEventListener(ROOMS_CHANGED_EVENT, listener);
    const room = storedRoom({
      id: "saved-room",
      title: "Saved room",
      coordinatorPubkey: "a".repeat(64),
      isHost: true,
    });

    saveRoom(room);

    expect(listener).toHaveBeenCalledOnce();
    expect(listRooms()).toHaveLength(1);
    expect(listRooms()[0]).toMatchObject({ id: "saved-room", updatedAt: expect.any(Number) });
    window.removeEventListener(ROOMS_CHANGED_EVENT, listener);
  });

  it("retains explicit host identity in stored rooms", () => {
    const room = storedRoom({
      id: "known-host",
      title: "Known host",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
      host: {
        name: "Ada",
        pubkey: "b".repeat(64),
        avatar: "https://images.example/ada.png",
      },
      joinRequestSent: true,
    });

    saveRoom(room);

    expect(loadRoom(room.id, room.coordinatorPubkey)?.host).toEqual(room.host);
    expect(hostIdentityForRoom(room)).toEqual(room.host);
  });

  it("resolves legacy host identity without confusing it with the current member", () => {
    const hosted = storedRoom({
      id: "legacy-hosted",
      title: "Legacy hosted",
      coordinatorPubkey: "a".repeat(64),
      isHost: true,
      name: "Original host",
      avatar: "https://images.example/host.png",
      stablePubkey: "b".repeat(64),
    });
    const joined = storedRoom({
      id: "legacy-joined",
      title: "Legacy joined",
      coordinatorPubkey: "c".repeat(64),
      isHost: false,
      name: "Current member",
      stablePubkey: "d".repeat(64),
    });

    expect(hostIdentityForRoom(hosted)).toEqual({
      name: "Original host",
      pubkey: "b".repeat(64),
      avatar: "https://images.example/host.png",
    });
    expect(hostIdentityForRoom(joined)).toEqual({
      name: "Unknown host",
      pubkey: "",
    });
  });

  it("keeps hosted room metadata current when the host changes their identity", () => {
    const room = storedRoom({
      id: "host-profile",
      title: "Host profile",
      coordinatorPubkey: "a".repeat(64),
      isHost: true,
      stablePubkey: "b".repeat(64),
    });
    const session = new ChatRoomSession(room, {} as NostrSigner);

    session.setIdentity({
      name: "  Updated host  ",
      avatar: "https://images.example/updated.png",
      badgeLabel: "captain",
    });

    expect(room.host).toEqual({
      name: "Updated host",
      pubkey: "b".repeat(64),
      avatar: "https://images.example/updated.png",
    });
    expect(hostIdentityForRoom(room)).toEqual(room.host);
  });

  it("accepts fresh invite presentation only for an already verified creator key", () => {
    const creatorPubkey = "b".repeat(64);

    expect(reconcileRoomHostIdentity({
      name: "Updated host",
      pubkey: creatorPubkey,
      avatar: "https://images.example/updated.png",
    }, creatorPubkey)).toEqual({
      name: "Updated host",
      pubkey: creatorPubkey,
      avatar: "https://images.example/updated.png",
    });
    expect(reconcileRoomHostIdentity({
      name: "Impostor",
      pubkey: "c".repeat(64),
    }, creatorPubkey)).toEqual({
      name: "Unknown host",
      pubkey: creatorPubkey,
    });
  });

  it("ignores malformed optional host metadata when reading an otherwise valid legacy room", () => {
    const room = storedRoom({
      id: "malformed-host",
      title: "Malformed host",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    localStorage.setItem(currentRoomKey(room), JSON.stringify({
      ...room,
      host: { name: "Fake host", pubkey: "invalid" },
    }));

    const loaded = loadRoom(room.id, room.coordinatorPubkey);
    expect(loaded).toMatchObject({ id: room.id });
    expect(loaded).not.toHaveProperty("host");
  });

  it("keeps identical room ids isolated by coordinator", () => {
    const first = storedRoom({
      id: "shared-group-id",
      title: "First coordinator room",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    const second = storedRoom({
      id: "shared-group-id",
      title: "Second coordinator room",
      coordinatorPubkey: "b".repeat(64),
      isHost: false,
    });

    saveRoom(first);
    saveRoom(second);

    expect(listRooms()).toHaveLength(2);
    expect(loadRoom(first.id, first.coordinatorPubkey)?.title).toBe(first.title);
    expect(loadRoom(second.id, second.coordinatorPubkey)?.title).toBe(second.title);
    expect(loadRoom(first.id)).toBeNull();
  });

  it("removes only the exact coordinator room and emits a removal change", () => {
    const first = storedRoom({
      id: "shared-group-id",
      title: "First coordinator room",
      coordinatorPubkey: "a".repeat(64),
      isHost: true,
    });
    const second = storedRoom({
      id: "shared-group-id",
      title: "Second coordinator room",
      coordinatorPubkey: "b".repeat(64),
      isHost: true,
    });
    const listener = vi.fn();
    saveRoom(first);
    saveRoom(second);
    rememberActiveHostRoom(first);
    rememberActiveHostRoom(second);
    window.addEventListener(ROOMS_CHANGED_EVENT, listener);

    removeStoredRoom(first);

    expect(loadRoom(first.id, first.coordinatorPubkey)).toBeNull();
    expect(loadRoom(second.id, second.coordinatorPubkey)?.title).toBe(second.title);
    expect(loadRememberedHostRoom(first.coordinatorPubkey)).toBeNull();
    expect(loadRememberedHostRoom(second.coordinatorPubkey)?.id).toBe(second.id);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        roomId: first.id,
        coordinatorPubkey: first.coordinatorPubkey,
        action: "removed",
      },
    }));
    window.removeEventListener(ROOMS_CHANGED_EVENT, listener);
  });

  it("removes a matching legacy room without touching another coordinator", () => {
    const target = storedRoom({
      id: "legacy-shared",
      title: "Target",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    const other = storedRoom({
      id: target.id,
      title: "Other coordinator",
      coordinatorPubkey: "b".repeat(64),
      isHost: false,
    });
    localStorage.setItem(legacyRoomKey(target), JSON.stringify(target));
    saveRoom(other);

    removeStoredRoom(target);

    expect(localStorage.getItem(legacyRoomKey(target))).toBeNull();
    expect(loadRoom(other.id, other.coordinatorPubkey)?.title).toBe(other.title);
  });

  it("migrates a matching legacy room without accepting another coordinator", () => {
    const legacy = storedRoom({
      id: "legacy-room",
      title: "Legacy room",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    localStorage.setItem(`cordn-adhoc-chat-room:${legacy.id}`, JSON.stringify(legacy));

    expect(loadRoom(legacy.id, legacy.coordinatorPubkey)).toMatchObject({ title: legacy.title });
    expect(loadRoom(legacy.id, "b".repeat(64))).toBeNull();
    expect(localStorage.getItem(`cordn-adhoc-chat-room:${legacy.id}`)).toBeNull();
    expect(listRooms()).toHaveLength(1);
  });

  it.each([
    ["corrupt", "{not-json"],
    ["foreign", JSON.stringify(storedRoom({
      id: "occupied-destination",
      title: "Foreign room",
      coordinatorPubkey: "b".repeat(64),
      isHost: false,
    }))],
  ])("preserves a valid legacy room when its v2 destination is %s", (_kind, occupiedValue) => {
    const legacy = storedRoom({
      id: "occupied-destination",
      title: "Legacy room",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    localStorage.setItem(currentRoomKey(legacy), occupiedValue);
    localStorage.setItem(legacyRoomKey(legacy), JSON.stringify(legacy));

    expect(loadRoom(legacy.id, legacy.coordinatorPubkey)).toMatchObject({
      id: legacy.id,
      coordinatorPubkey: legacy.coordinatorPubkey,
      title: legacy.title,
    });
    expect(loadRoom(legacy.id, legacy.coordinatorPubkey)).toMatchObject({ title: legacy.title });
    expect(JSON.parse(localStorage.getItem(currentRoomKey(legacy)) ?? "null")).toMatchObject({
      id: legacy.id,
      coordinatorPubkey: legacy.coordinatorPubkey,
      title: legacy.title,
    });
    expect(localStorage.getItem(legacyRoomKey(legacy))).toBeNull();
  });

  it.each(["legacy-first", "v2-first"] as const)("cleans a duplicate legacy key when the %s copy was inserted first", (insertionOrder) => {
    const current = storedRoom({
      id: "duplicate-room",
      title: "Current room",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
      updatedAt: 200,
    });
    const legacy = { ...current, title: "Stale legacy room", updatedAt: 100 };
    const entries = insertionOrder === "legacy-first"
      ? [[legacyRoomKey(legacy), JSON.stringify(legacy)], [currentRoomKey(current), JSON.stringify(current)]]
      : [[currentRoomKey(current), JSON.stringify(current)], [legacyRoomKey(legacy), JSON.stringify(legacy)]];
    for (const [key, value] of entries) localStorage.setItem(key, value);

    expect(listRooms()).toEqual([expect.objectContaining({ title: current.title })]);
    expect(localStorage.getItem(currentRoomKey(current))).toBe(JSON.stringify(current));
    expect(localStorage.getItem(legacyRoomKey(legacy))).toBeNull();
  });

  it("ignores malformed stored rooms without hiding valid rooms", () => {
    const valid = storedRoom({
      id: "valid-room",
      title: "Valid room",
      coordinatorPubkey: "a".repeat(64),
      isHost: false,
    });
    const malformed = {
      version: 1,
      id: "malformed-room",
      coordinatorPubkey: "b".repeat(64),
    };
    localStorage.setItem(currentRoomKey(valid), JSON.stringify(valid));
    localStorage.setItem(currentRoomKey(malformed), JSON.stringify(malformed));

    expect(listRooms()).toEqual([expect.objectContaining({ id: valid.id, title: valid.title })]);
    expect(loadRoom(malformed.id, malformed.coordinatorPubkey)).toBeNull();
  });

  it("remembers the active hosted room for each coordinator", () => {
    const coordinatorPubkey = "a".repeat(64);
    const room = storedRoom({
      id: "remembered-room",
      title: "Remembered room",
      coordinatorPubkey,
      isHost: true,
    });
    saveRoom(room);

    rememberActiveHostRoom(room);

    expect(loadRememberedHostRoom(coordinatorPubkey)).toMatchObject({ id: room.id });
    expect(loadRememberedHostRoom("b".repeat(64))).toBeNull();
    forgetRememberedHostRoom(coordinatorPubkey);
    expect(loadRememberedHostRoom(coordinatorPubkey)).toBeNull();
  });

  it("forgets a remembered room that is missing or belongs to another coordinator", () => {
    const coordinatorPubkey = "a".repeat(64);
    const otherRoom = storedRoom({
      id: "other-room",
      title: "Other room",
      coordinatorPubkey: "b".repeat(64),
      isHost: true,
    });
    saveRoom(otherRoom);
    localStorage.setItem(`cordn-adhoc-active-host-room:${coordinatorPubkey}`, otherRoom.id);

    expect(loadRememberedHostRoom(coordinatorPubkey)).toBeNull();
    expect(localStorage.getItem(`cordn-adhoc-active-host-room:${coordinatorPubkey}`)).toBeNull();
  });
});

describe("offline room safety", () => {
  beforeEach(() => localStorage.clear());

  it("keeps cached room state read-only before a coordinator is connected", async () => {
    const room = storedRoom({
      id: "offline-room",
      title: "Offline room",
      coordinatorPubkey: "c".repeat(64),
      isHost: false,
    });
    const before = JSON.stringify(room);
    const session = new ChatRoomSession(room, {} as NostrSigner);

    await expect(session.send("must not be queued")).rejects.toThrow(/must be connected/i);

    expect(JSON.stringify(room)).toBe(before);
    expect(localStorage.length).toBe(0);
  });
});
