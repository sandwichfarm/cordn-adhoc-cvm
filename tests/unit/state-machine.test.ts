import { describe, expect, test, vi } from "vitest";

import { isConfigLocked, transitionCoordinator } from "../../src/coordinator/state-machine";
import { CoordinatorStore, ROOM_RECOVERY_POLICY, type CoordinatorStoreRuntime } from "../../src/coordinator/coordinator.svelte";
import type { RunningTransport } from "../../src/lib/transport";
import type { InstanceLease } from "../../src/coordinator/single-instance-guard";
import type { HostedRoomRecoveryTarget } from "../../src/coordinator/types";
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
  const targetA: HostedRoomRecoveryTarget = {
    coordinatorPubkey: "a".repeat(64),
    roomId: "alpha",
    roomName: "Alpha",
    roomIdentityKey: `${"a".repeat(64)}:alpha`,
  };
  const targetB: HostedRoomRecoveryTarget = {
    coordinatorPubkey: "b".repeat(64),
    roomId: "bravo",
    roomName: "Bravo",
    roomIdentityKey: `${"b".repeat(64)}:bravo`,
  };

  interface Deferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(reason?: unknown): void;
  }

  function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  function lifecycleRuntime() {
    const leases: Array<InstanceLease & { release: ReturnType<typeof vi.fn> }> = [];
    const transports: Array<RunningTransport & { close: ReturnType<typeof vi.fn> }> = [];
    const acquireInstanceLease = vi.fn<CoordinatorStoreRuntime["acquireInstanceLease"]>(async () => {
      const lease = { release: vi.fn(async () => undefined) };
      leases.push(lease);
      return lease;
    });
    const createTransport = vi.fn<CoordinatorStoreRuntime["createTransport"]>(async () => {
      const transport = { close: vi.fn() } as unknown as RunningTransport & { close: ReturnType<typeof vi.fn> };
      transports.push(transport);
      return transport;
    });
    const closeTransport = vi.fn<CoordinatorStoreRuntime["closeTransport"]>((transport) => transport.close());
    const startResourceMonitor = vi.fn<CoordinatorStoreRuntime["startResourceMonitor"]>();
    const stopResourceMonitor = vi.fn<CoordinatorStoreRuntime["stopResourceMonitor"]>();
    const wait = vi.fn<(milliseconds: number, signal: AbortSignal) => Promise<void>>(async () => undefined);
    const runAttempt = vi.fn<(operation: (signal: AbortSignal) => Promise<void>, timeout: number, signal: AbortSignal) => Promise<void>>(
      async (operation, _timeout, signal) => operation(signal),
    );
    const runtime: CoordinatorStoreRuntime = {
      acquireInstanceLease,
      createTransport,
      closeTransport,
      startResourceMonitor,
      stopResourceMonitor,
      wait,
      runAttempt,
    };
    return {
      runtime,
      leases,
      transports,
      acquireInstanceLease,
      createTransport,
      closeTransport,
      startResourceMonitor,
      stopResourceMonitor,
      wait,
      runAttempt,
    };
  }

  test("public start shares one transaction and restores deduplicated rooms in stable order", async () => {
    const harness = lifecycleRuntime();
    const store = new CoordinatorStore(harness.runtime);
    const alpha = deferred<void>();
    const bravo = deferred<void>();
    const order: string[] = [];
    store.registerHostedRoomRecovery({
      listTargets: () => [targetB, targetA, { ...targetB, roomName: "Duplicate Bravo" }],
      recover: async (target) => {
        order.push(target.roomIdentityKey);
        await (target.roomIdentityKey === targetA.roomIdentityKey ? alpha.promise : bravo.promise);
      },
    });

    const firstStart = store.start();
    const sharedStart = store.start();
    await vi.waitFor(() => expect(order).toEqual([targetA.roomIdentityKey]));
    expect(store.status).toBe("starting");
    expect(store.startupProgress.roomRecovery).toMatchObject({ completed: 0, total: 2 });
    alpha.resolve(undefined);
    await vi.waitFor(() => expect(order).toEqual([targetA.roomIdentityKey, targetB.roomIdentityKey]));
    expect(store.startupProgress.roomRecovery).toMatchObject({ completed: 1, total: 2 });
    bravo.resolve(undefined);
    await Promise.all([firstStart, sharedStart]);

    expect(harness.acquireInstanceLease).toHaveBeenCalledOnce();
    expect(harness.createTransport).toHaveBeenCalledOnce();
    expect(harness.runAttempt).toHaveBeenCalledTimes(2);
    expect(harness.startResourceMonitor).toHaveBeenCalledOnce();
    expect(store.startupProgress.roomRecovery).toMatchObject({ state: "complete", completed: 2, total: 2 });
    expect(store.status).toBe("running");
    await store.stop();
  });

  test("restart awaits and discards stale non-abortable recovery before replacement owns resources", async () => {
    const harness = lifecycleRuntime();
    const store = new CoordinatorStore(harness.runtime);
    const staleRecovery = deferred<void>();
    let recoverCalls = 0;
    const discard = vi.fn(async () => undefined);
    store.registerHostedRoomRecovery({
      listTargets: () => [targetA],
      recover: async () => {
        recoverCalls += 1;
        if (recoverCalls === 1) await staleRecovery.promise;
      },
      discard,
    });

    const firstStart = store.start();
    await vi.waitFor(() => expect(recoverCalls).toBe(1));
    const restarting = store.restart();
    await Promise.resolve();
    expect(harness.acquireInstanceLease).toHaveBeenCalledOnce();
    staleRecovery.resolve(undefined);
    await Promise.all([firstStart, restarting]);

    expect(recoverCalls).toBe(2);
    expect(discard).toHaveBeenCalledOnce();
    expect(harness.acquireInstanceLease).toHaveBeenCalledTimes(2);
    expect(harness.createTransport).toHaveBeenCalledTimes(2);
    expect(harness.closeTransport).toHaveBeenCalledTimes(1);
    expect(harness.closeTransport).toHaveBeenCalledWith(harness.transports[0]);
    expect(harness.leases[0]?.release).toHaveBeenCalledOnce();
    expect(harness.leases[1]?.release).not.toHaveBeenCalled();
    expect(harness.startResourceMonitor).toHaveBeenCalledTimes(1);
    expect(harness.startResourceMonitor).toHaveBeenCalledWith(harness.transports[1]);
    expect(store.status).toBe("running");
    expect(store.startupProgress.roomRecovery).toMatchObject({ state: "complete", completed: 1, total: 1 });
    await store.stop();
  });

  test("exhausted public recovery retries once, keeps completed rooms, and preserves policy", async () => {
    const harness = lifecycleRuntime();
    const store = new CoordinatorStore(harness.runtime);
    const calls: string[] = [];
    let bravoAttempts = 0;
    store.registerHostedRoomRecovery({
      listTargets: () => [targetB, targetA],
      recover: async (target) => {
        calls.push(target.roomIdentityKey);
        if (target.roomIdentityKey === targetB.roomIdentityKey) {
          bravoAttempts += 1;
          if (bravoAttempts <= ROOM_RECOVERY_POLICY.maxAttempts) throw new Error("internal relay detail");
        }
      },
    });

    await store.start();

    expect(store.status).toBe("starting");
    expect(store.startupProgress.roomRecovery).toMatchObject({
      state: "exhausted",
      completed: 1,
      total: 2,
      roomName: "Bravo",
      diagnostic: "Check your connection, then retry recovery.",
    });
    expect(harness.runAttempt.mock.calls.map((call) => call[1])).toEqual([
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
      ROOM_RECOVERY_POLICY.attemptTimeoutMs,
    ]);
    expect(harness.wait.mock.calls.map((call) => call[0])).toEqual([250, 750]);

    const firstRetry = store.retryRoomRecovery();
    const duplicateRetry = store.retryRoomRecovery();
    await Promise.all([firstRetry, duplicateRetry]);

    expect(calls).toEqual([
      targetA.roomIdentityKey,
      targetB.roomIdentityKey,
      targetB.roomIdentityKey,
      targetB.roomIdentityKey,
      targetB.roomIdentityKey,
    ]);
    expect(harness.acquireInstanceLease).toHaveBeenCalledOnce();
    expect(harness.createTransport).toHaveBeenCalledOnce();
    expect(harness.startResourceMonitor).toHaveBeenCalledOnce();
    expect(store.status).toBe("running");
    expect(store.startupProgress.roomRecovery).toMatchObject({ state: "complete", completed: 2, total: 2 });
    await store.stop();
  });

  test("zero targets complete publicly as 0 of 0 without exposing retry", async () => {
    const harness = lifecycleRuntime();
    const store = new CoordinatorStore(harness.runtime);
    store.registerHostedRoomRecovery({ listTargets: () => [], recover: vi.fn() });

    await store.start();

    expect(store.status).toBe("running");
    expect(store.startupProgress.roomRecovery).toMatchObject({ state: "complete", completed: 0, total: 0 });
    expect(harness.runAttempt).not.toHaveBeenCalled();
    expect(harness.wait).toHaveBeenCalledWith(500, expect.any(AbortSignal));
    await store.stop();
  });
});
