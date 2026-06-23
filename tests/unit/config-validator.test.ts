import { describe, expect, test } from "vitest";

import { validateRelayUrl } from "../../src/config/config-validator";

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
