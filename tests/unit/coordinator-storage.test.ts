import { describe, expect, test } from "vitest";

import {
  applySnapshotByteLimit,
} from "../../src/cordn/coordinator/storage/browserCoordinatorStorage";
import {
  type CoordinatorStorageSnapshot,
  InMemoryCoordinatorStorage,
} from "../../src/cordn/coordinator/storage/inMemoryStorage";

function appendMessage(
  storage: InMemoryCoordinatorStorage,
  groupId: string,
  createdAt: number,
): void {
  storage.appendGroupMessage({
    groupId,
    latestHandshakeEpoch: 1n,
    epoch: 1n,
    ephemeralSenderPubkey: `sender-${createdAt}`,
    opaqueMessage: Uint8Array.from([createdAt]),
    createdAt,
  });
}

function snapshotWithMessages(messageCount: number): CoordinatorStorageSnapshot {
  return {
    version: 1,
    keyPackages: [],
    welcomes: [
      {
        targetStablePubkey: "reader",
        keyPackageReference: "kp",
        welcome64: "read-welcome",
        createdAt: 1,
        readAt: 2,
      },
    ],
    joinRequests: [],
    groups: [
      {
        groupId: "group",
        nextCursor: messageCount + 1,
        routing: {
          groupId: "group",
          latestHandshakeEpoch: "1",
          lastMessageCursor: messageCount,
        },
        messages: Array.from({ length: messageCount }, (_, index) => ({
          cursor: index + 1,
          groupId: "group",
          epoch: "1",
          ephemeralSenderPubkey: `sender-${index}`,
          opaqueMessage64: "x".repeat(500),
          createdAt: index + 1,
        })),
      },
    ],
  };
}

describe("InMemoryCoordinatorStorage message buffer", () => {
  test("evicts the oldest group messages at the configured total buffer limit", () => {
    const storage = new InMemoryCoordinatorStorage(null, undefined, {
      messageBufferLimit: 2,
    });

    appendMessage(storage, "group-a", 1);
    appendMessage(storage, "group-b", 2);
    appendMessage(storage, "group-a", 3);

    expect(storage.fetchGroupMessages({ groupId: "group-a" }).map((message) => message.createdAt)).toEqual([3]);
    expect(storage.fetchGroupMessages({ groupId: "group-b" }).map((message) => message.createdAt)).toEqual([2]);
    expect(storage.getGroupRouting("group-a")).toMatchObject({
      lastMessageCursor: 2,
    });
  });
});

describe("IndexedDB snapshot eviction", () => {
  test("removes old group messages before storing oversized snapshots", () => {
    const result = applySnapshotByteLimit(snapshotWithMessages(8), 2_000);

    const remainingMessages = result.snapshot.groups.flatMap((group) => group.messages);

    expect(result.evictedMessages).toBeGreaterThan(0);
    expect(remainingMessages.length).toBeLessThan(8);
    expect(remainingMessages[0]?.cursor).toBeGreaterThan(1);
    expect(result.snapshot.welcomes).toHaveLength(1);
  });
});
