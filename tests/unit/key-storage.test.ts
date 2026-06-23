import { beforeEach, describe, expect, test } from "vitest";

import { KeyManager } from "../../src/crypto/key-manager";
import { KeyStorage, PBKDF2_ITERATIONS, STORAGE_KEY, WrongPassphraseError } from "../../src/crypto/key-storage";

describe("KeyStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("encrypts and decrypts key material with PBKDF2 and AES-GCM", async () => {
    const storage = new KeyStorage();
    const key = KeyManager.generate().getSecretKeyBytes();

    await storage.save(key, "correct horse battery staple");

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toEqual(expect.any(String));
    expect(raw).not.toContain(KeyManager.fromBytes(key).getSecretKeyHex());
    expect(JSON.parse(raw ?? "{}")).toMatchObject({
      version: 1,
      pbkdf2Iterations: PBKDF2_ITERATIONS,
    });

    await expect(storage.load("correct horse battery staple")).resolves.toEqual(key);
  });

  test("throws a named error for wrong passphrases", async () => {
    const storage = new KeyStorage();

    await storage.save(KeyManager.generate().getSecretKeyBytes(), "right-passphrase");

    await expect(storage.load("wrong-passphrase")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  test("clears the single persisted storage entry synchronously", async () => {
    const storage = new KeyStorage();

    await storage.save(KeyManager.generate().getSecretKeyBytes(), "passphrase");
    expect(storage.hasPersisted()).toBe(true);

    storage.clear();

    expect(storage.hasPersisted()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
