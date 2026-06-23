import { describe, expect, test } from "vitest";

import {
  BROWSER_MAX_USERS_CAP,
  DEFAULT_MAX_USERS,
  validateMessageBufferLimit,
  validateMaxUsers,
  validateRelayUrl,
  validateStorageBackend,
} from "../../src/config/config-validator";
import {
  MAX_MEMORY_MESSAGE_BUFFER_LIMIT,
} from "../../src/cordn/coordinator/storage/inMemoryStorage";

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
    expect(validateMaxUsers(DEFAULT_MAX_USERS)).toBeNull();
  });

  test.each([0, 1.5, Number.NaN, BROWSER_MAX_USERS_CAP + 1])(
    "rejects invalid key-package quota value %s",
    (value) => {
      expect(validateMaxUsers(value)).toEqual(expect.any(String));
    },
  );
});

describe("validateStorageBackend", () => {
  test.each(["memory", "indexeddb"])("accepts %s", (backend) => {
    expect(validateStorageBackend(backend)).toBe(true);
  });

  test("rejects unknown storage backends", () => {
    expect(validateStorageBackend("sqlite")).toBe(false);
  });
});

describe("validateMessageBufferLimit", () => {
  test("accepts a bounded whole-number buffer", () => {
    expect(validateMessageBufferLimit(1_000)).toBeNull();
  });

  test.each([0, 1.5, Number.NaN, MAX_MEMORY_MESSAGE_BUFFER_LIMIT + 1])(
    "rejects invalid message buffer value %s",
    (value) => {
      expect(validateMessageBufferLimit(value)).toEqual(expect.any(String));
    },
  );
});
