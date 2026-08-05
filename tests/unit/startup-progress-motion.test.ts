import { describe, expect, test } from "vitest";

import { startupProgressTweenDuration } from "../../src/components/startup-progress-motion";

describe("startupProgressTweenDuration", () => {
  test("gives a missed 20-to-80 interval enough time to remain visible", () => {
    expect(startupProgressTweenDuration(20, 80)).toBeGreaterThanOrEqual(3);
  });

  test("paces the final interval more slowly than an equally sized early interval", () => {
    expect(startupProgressTweenDuration(80, 100)).toBeGreaterThan(
      startupProgressTweenDuration(20, 40),
    );
  });

  test("clamps invalid inputs and does not animate a stationary value", () => {
    expect(startupProgressTweenDuration(Number.NaN, Number.NaN)).toBe(0);
    expect(startupProgressTweenDuration(120, 100)).toBe(0);
    expect(startupProgressTweenDuration(-20, 20)).toBeGreaterThan(0);
  });
});
