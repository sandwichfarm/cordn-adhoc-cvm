import { describe, expect, test, vi } from "vitest";
import { encode, mlsMessageEncoder, wireformats } from "ts-mls";

import { decodeBase64, encodeBase64 } from "../../src/cordn/server/base64";
import { CoordinatorAdapter, registerCoordinatorMethods } from "../../src/cordn/server/coordinatorMethods";
import { COORDINATOR_METHODS } from "../../src/cordn/contracts";
import { Coordinator } from "../../src/cordn/coordinator";
import { InMemoryCoordinatorStorage } from "../../src/cordn/coordinator/storage/inMemoryStorage";

const encoder = new TextEncoder();

function createExtra(clientPubkey = "client-pubkey") {
  return {
    _meta: { clientPubkey },
  } as never;
}

function createStreamingExtra() {
  return {
    _meta: {
      clientPubkey: "subscriber-pubkey",
      stream: {
        isActive: true,
        start: vi.fn().mockRejectedValue(new Error("stream stopped")),
        write: vi.fn(),
        close: vi.fn(),
        abort: vi.fn(),
      },
    },
  } as never;
}

function createExternallyAbortableStreamingExtra() {
  const stream = {
    isActive: true,
    start: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    close: vi.fn().mockImplementation(() => {
      stream.isActive = false;
      return Promise.resolve();
    }),
    abort: vi.fn().mockImplementation(() => {
      stream.isActive = false;
      return Promise.resolve();
    }),
  };

  return {
    extra: {
      _meta: {
        clientPubkey: "subscriber-pubkey",
        stream,
      },
    } as never,
    stream,
  };
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

  test("round-trips coordinator message state through a persistent snapshot", () => {
    const firstStorage = new InMemoryCoordinatorStorage();
    const firstAdapter = new CoordinatorAdapter(new Coordinator({ storage: firstStorage }));
    const encodedMessage = createPrivateApplicationMessage("group-persisted", 9n);

    firstAdapter.postGroupMessage(
      { msg_64: encodeBase64(encodedMessage) },
      createExtra("sender-pubkey"),
    );

    const secondAdapter = new CoordinatorAdapter(
      new Coordinator({
        storage: new InMemoryCoordinatorStorage(firstStorage.toSnapshot()),
      }),
    );

    expect(secondAdapter.fetchGroupMessages({ gid: "group-persisted" }).structuredContent.messages).toEqual([
      {
        cursor: 1,
        gid: "group-persisted",
        msg_64: encodeBase64(encodedMessage),
        at: expect.any(Number),
      },
    ]);
  });

  test("uses browser base64 APIs without Buffer", () => {
    const encoded = encodeBase64(Uint8Array.from([1, 2, 3, 254]));

    expect(encoded).toBe("AQID/g==");
    expect([...decodeBase64(encoded)]).toEqual([1, 2, 3, 254]);
  });

  test("reports Cordn method activity to browser telemetry", () => {
    const recordOperation = vi.fn();
    const adapter = new CoordinatorAdapter(new Coordinator());
    const encodedMessage = createPrivateApplicationMessage("group-telemetry", 3n);

    adapter.setTelemetrySink({ recordOperation });
    adapter.postGroupMessage(
      { msg_64: encodeBase64(encodedMessage) },
      createExtra("sender-pubkey"),
    );

    expect(recordOperation).toHaveBeenCalledWith("postGroupMessage");
  });

  test("reports active subscription count to browser telemetry", async () => {
    const setActiveSubscriptions = vi.fn();
    const adapter = new CoordinatorAdapter(new Coordinator());

    adapter.setTelemetrySink({ setActiveSubscriptions });

    await expect(
      adapter.subscribeGroupMessages({ gid: "group-telemetry" }, createStreamingExtra()),
    ).rejects.toThrow("stream stopped");

    expect(setActiveSubscriptions).toHaveBeenCalledTimes(3);
    expect(setActiveSubscriptions.mock.calls.map(([count]) => count)).toEqual([0, 1, 0]);
  });

  test("reports active subscription count after external stream cancellation", async () => {
    const setActiveSubscriptions = vi.fn();
    const adapter = new CoordinatorAdapter(new Coordinator());
    const { extra, stream } = createExternallyAbortableStreamingExtra();

    adapter.setTelemetrySink({ setActiveSubscriptions });
    const subscription = adapter.subscribeGroupMessages({ gid: "group-telemetry" }, extra);
    await vi.waitFor(() => {
      expect(setActiveSubscriptions.mock.calls.map(([count]) => count)).toContain(1);
    });

    await stream.abort("client cancelled");
    await subscription;

    expect(setActiveSubscriptions.mock.calls.map(([count]) => count)).toEqual([0, 1, 0]);
  });

  test("enforces injected caller identity before handling methods", () => {
    const adapter = new CoordinatorAdapter(new Coordinator());

    expect(() =>
      adapter.assertWithinRateLimit({ _meta: {} } as never, COORDINATOR_METHODS.postGroupMessage),
    ).toThrow("Missing injected client pubkey");
  });
});
