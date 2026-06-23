import { describe, expect, test } from "vitest";

import {
  BROWSER_MAX_USERS_CAP,
  DEFAULT_MAX_USERS,
  validateMaxUsers,
  validateRelayUrl,
} from "../../src/config/config-validator";

describe("validateRelayUrl", () => {
  test.each(["ws://127.0.0.1:8765", "wss://relay.example", "wss://relay.example/path"])(
    "accepts %s",
    (url) => {
      expect(validateRelayUrl(url)).toBeNull();
    },
  );

  test.each(["", "relay.example", "http://relay.example", "https://relay.example"])(
    "rejects %s",
    (url) => {
      expect(validateRelayUrl(url)).toEqual(expect.any(String));
    },
  );
});

describe("validateMaxUsers", () => {
  test("accepts the default browser limit", () => {
    expect(validateMaxUsers(DEFAULT_MAX_USERS, 0)).toBeNull();
  });

  test.each([0, 1.5, Number.NaN, BROWSER_MAX_USERS_CAP + 1])(
    "rejects invalid max users value %s",
    (value) => {
      expect(validateMaxUsers(value, 0)).toEqual(expect.any(String));
    },
  );

  test("rejects reducing below the active subscription count", () => {
    expect(validateMaxUsers(3, 4)).toBe("Maximum users cannot be below 4 active subscriptions");
  });
});
