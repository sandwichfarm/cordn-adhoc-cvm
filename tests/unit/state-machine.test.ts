import { describe, expect, test, vi } from "vitest";

import { isConfigLocked, transitionCoordinator } from "../../src/coordinator/state-machine";
import { CoordinatorStore, ROOM_RECOVERY_POLICY, type RoomRecoveryRuntime } from "../../src/coordinator/coordinator.svelte";
import type { HostedRoomRecoveryAdapter, HostedRoomRecoveryTarget } from "../../src/coordinator/types";
import {
  createHostedRoomRecoveryProgress,
  type CoordinatorEvent,
  type CoordinatorStatus,
} from "../../src/coordinator/types";

describe("transitionCoordinator", () => {
  test.each([
    ["idle", "start", "starting"],
    ["starting", "started", "running"],
    ["running", "stop", "stopping"],
    ["starting", "stop", "stopping"],
    ["stopping", "stopped", "idle"],
    ["starting", "error", "idle"],
    ["stopping", "error", "idle"],
  ] satisfies Array<[CoordinatorStatus, CoordinatorEvent, CoordinatorStatus]>)(
    "%s + %s -> %s",
    (state, event, expected) => {
      expect(transitionCoordinator(state, event)).toBe(expected);
    },
  );

  test.each([
    ["idle", "stop"],
    ["running", "start"],
    ["stopping", "start"],
  ] satisfies Array<[CoordinatorStatus, CoordinatorEvent]>)(
    "rejects invalid transition %s + %s",
    (state, event) => {
      expect(() => transitionCoordinator(state, event)).toThrow("Invalid coordinator transition");
    },
  );
});

describe("isConfigLocked", () => {
  test.each([
    ["idle", false],
    ["starting", true],
    ["running", true],
    ["stopping", true],
  ] satisfies Array<[CoordinatorStatus, boolean]>)("returns %s for %s", (state, expected) => {
    expect(isConfigLocked(state)).toBe(expected);
  });
});

describe("hosted room recovery progress", () => {
  test("makes a zero-room recovery visibly complete before the coordinator becomes ready", () => {
    expect(createHostedRoomRecoveryProgress({
      state: "complete",
      completed: 0,
      total: 0,
    })).toMatchObject({
      state: "complete",
      completed: 0,
      total: 0,
      roomName: null,
      diagnostic: "No rooms to restore",
    });
  });

  test("retains the exact current room and completed count for a retry", () => {
    expect(createHostedRoomRecoveryProgress({
      state: "retrying",
      completed: 1,
      total: 2,
      roomName: "Project planning",
      attempt: 2,
    })).toMatchObject({
      state: "retrying",
      completed: 1,
      total: 2,
      roomName: "Project planning",
      attempt: 2,
      diagnostic: "Trying again…",
    });
  });
});

describe("coordinator recovery policy", () => {
  const target: HostedRoomRecoveryTarget = {
    coordinatorPubkey: "c".repeat(64),
    roomId: "room-id",
    roomName: "Planning",
    roomIdentityKey: `${"c".repeat(64)}:room-id`,
  };

  function recoveryStore(recover: HostedRoomRecoveryAdapter["recover"]) {
    const wait = vi.fn<(milliseconds: number, signal: AbortSignal) => Promise<void>>(async () => undefined);
    const runAttempt = vi.fn<(operation: (signal: AbortSignal) => Promise<void>, timeout: number, signal: AbortSignal) => Promise<void>>(
      async (operation, _timeout, signal) => operation(signal),
    );
    const runtime: RoomRecoveryRuntime = { wait, runAttempt };
    const store = new CoordinatorStore(runtime);
    store.registerHostedRoomRecovery({ listTargets: () => [target], recover });
    (store as unknown as { startupGeneration: number }).startupGeneration = 1;
    return { store, wait, runAttempt };
  }

  test("uses three injected attempts with 250ms then 750ms backoff and advances once", async () => {
    let attempt = 0;
    const { store, wait, runAttempt } = recoveryStore(async () => {
      attempt += 1;
      if (attempt < 3) throw new Error("transient");
    });

    await expect((store as unknown as { recoverHostedRooms(generation: number, signal: AbortSignal): Promise<boolean> })
      .recoverHostedRooms(1, new AbortController().signal)).resolves.toBe(true);

    expect(runAttempt).toHaveBeenCalledTimes(3);
    expect(runAttempt.mock.calls.map((call) => call[1])).toEqual([
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
    ]);
    expect(wait.mock.calls.map((call) => call[0])).toEqual([250, 750]);
    expect(store.startupProgress.roomRecovery).toMatchObject({ state: "complete", completed: 1, total: 1 });
  });

  test("keeps exhausted recovery in startup state with a safe room diagnostic", async () => {
    const { store, wait, runAttempt } = recoveryStore(async () => { throw new Error("raw relay URL must not render"); });

    await expect((store as unknown as { recoverHostedRooms(generation: number, signal: AbortSignal): Promise<boolean> })
      .recoverHostedRooms(1, new AbortController().signal)).resolves.toBe(false);

    expect(runAttempt).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map((call) => call[0])).toEqual([250, 750]);
    expect(store.startupProgress.roomRecovery).toMatchObject({
      state: "exhausted",
      completed: 0,
      total: 1,
      roomName: "Planning",
      diagnostic: "Check your connection, then retry recovery.",
    });
  });
});
