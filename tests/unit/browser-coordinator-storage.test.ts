import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@sqlite.org/sqlite-wasm", () => ({
  default: vi.fn().mockRejectedValue(new Error("sqlite unavailable in unit tests")),
}));

import {
  clearPersistedCoordinatorState,
  createBrowserCoordinatorStorage,
} from "../../src/cordn/coordinator/storage/browserSqliteStorage";
import { CoordinatorStore } from "../../src/coordinator/coordinator.svelte";

describe("browser coordinator deleted-room persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("keeps tombstones across nonpersistent restarts and scopes them by coordinator", async () => {
    const firstStorage = await createBrowserCoordinatorStorage(false, "coordinator-a");
    firstStorage.deleteGroup("deleted-room");
    firstStorage.close();

    const restartedStorage = await createBrowserCoordinatorStorage(false, "coordinator-a");
    const otherCoordinatorStorage = await createBrowserCoordinatorStorage(
      false,
      "coordinator-b",
    );

    expect(restartedStorage.isGroupDeleted("deleted-room")).toBe(true);
    expect(otherCoordinatorStorage.isGroupDeleted("deleted-room")).toBe(false);

    restartedStorage.close();
    otherCoordinatorStorage.close();
  });

  test("merges tombstones into persistent snapshots", async () => {
    const firstStorage = await createBrowserCoordinatorStorage(true, "coordinator-a");
    firstStorage.deleteGroup("deleted-room");
    firstStorage.close();

    const restartedStorage = await createBrowserCoordinatorStorage(true, "coordinator-a");
    const otherCoordinatorStorage = await createBrowserCoordinatorStorage(
      true,
      "coordinator-b",
    );

    expect(restartedStorage.toSnapshot().deletedGroups).toEqual(["deleted-room"]);
    expect(otherCoordinatorStorage.isGroupDeleted("deleted-room")).toBe(false);
    expect(() => restartedStorage.fetchGroupMessages({ groupId: "deleted-room" })).toThrow(
      "Room deleted by host",
    );

    restartedStorage.close();
    otherCoordinatorStorage.close();
  });

  test("clears coordinator-scoped tombstone registries with persisted state", async () => {
    const storage = await createBrowserCoordinatorStorage(false, "coordinator-a");
    storage.deleteGroup("deleted-room");
    storage.close();

    await clearPersistedCoordinatorState();

    const restartedStorage = await createBrowserCoordinatorStorage(false, "coordinator-a");
    expect(restartedStorage.isGroupDeleted("deleted-room")).toBe(false);
    restartedStorage.close();
  });

  test("deletes through the stopped local coordinator store and records a debug entry", async () => {
    const coordinator = new CoordinatorStore();
    const coordinatorPubkey = coordinator.identity.publicKeyHex;

    await coordinator.deleteHostedRoom("hosted-room");

    expect(coordinator.debugLog.at(-1)).toMatchObject({
      level: "info",
      message: "hosted room deleted",
      details: "hosted-room",
    });
    const storage = await createBrowserCoordinatorStorage(false, coordinatorPubkey);
    expect(storage.isGroupDeleted("hosted-room")).toBe(true);
    storage.close();
  });
});
