import { describe, expect, test } from "vitest";

import { isConfigLocked, transitionCoordinator } from "../../src/coordinator/state-machine";
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
    ["starting", "stop"],
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
