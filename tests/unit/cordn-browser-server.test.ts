import { describe, expect, test, vi } from "vitest";
import { encode, mlsMessageEncoder, wireformats } from "ts-mls";

import { encodeBase64 } from "../../src/cordn/server/base64";
import { CoordinatorAdapter, registerCoordinatorMethods } from "../../src/cordn/server/coordinatorMethods";
import { COORDINATOR_METHODS } from "../../src/cordn/contracts";
import { Coordinator } from "../../src/cordn/coordinator";

const encoder = new TextEncoder();

function createExtra(clientPubkey = "client-pubkey") {
  return {
    _meta: { clientPubkey },
  } as never;
}

function createPrivateApplicationMessage(groupId: string, epoch: bigint): Uint8Array {
  return encode(mlsMessageEncoder, {
    version: 1,
    wireformat: wireformats.mls_private_message,
    privateMessage: {
      groupId: encoder.encode(groupId),
      epoch,
      contentType: 1,
      authenticatedData: new Uint8Array(),
      encryptedSenderData: new Uint8Array(),
      ciphertext: Uint8Array.from([1, 2, 3]),
    },
  });
}

describe("browser Cordn server adapter", () => {
  test("registers the full Cordn coordinator tool surface", () => {
    const registerTool = vi.fn();
    const server = { registerTool };
    const adapter = new CoordinatorAdapter(new Coordinator());

    registerCoordinatorMethods(server as never, adapter);

    expect(registerTool).toHaveBeenCalledTimes(Object.values(COORDINATOR_METHODS).length);
    expect(registerTool.mock.calls.map(([name]) => name).sort()).toEqual(
      Object.values(COORDINATOR_METHODS).sort(),
    );
  });

  test("posts and fetches MLS group messages through coordinator methods", () => {
    const adapter = new CoordinatorAdapter(new Coordinator());
    const encodedMessage = createPrivateApplicationMessage("group-browser", 7n);

    const posted = adapter.postGroupMessage(
      { msg_64: encodeBase64(encodedMessage) },
      createExtra("sender-pubkey"),
    );
    const fetched = adapter.fetchGroupMessages({ gid: "group-browser" });

    expect(posted.structuredContent).toMatchObject({
      cursor: 1,
      gid: "group-browser",
    });
    expect(fetched.structuredContent.messages).toEqual([
      {
        cursor: 1,
        gid: "group-browser",
        msg_64: encodeBase64(encodedMessage),
        at: posted.structuredContent.at,
      },
    ]);
  });

  test("enforces injected caller identity before handling methods", () => {
    const adapter = new CoordinatorAdapter(new Coordinator());

    expect(() =>
      adapter.assertWithinRateLimit({ _meta: {} } as never, COORDINATOR_METHODS.postGroupMessage),
    ).toThrow("Missing injected client pubkey");
  });
});
