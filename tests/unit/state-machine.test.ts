import { describe, expect, test } from "vitest";

import { isConfigLocked, transitionCoordinator } from "../../src/coordinator/state-machine";
import type { CoordinatorEvent, CoordinatorStatus } from "../../src/coordinator/types";

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
