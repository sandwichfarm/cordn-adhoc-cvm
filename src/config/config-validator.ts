import {
  MAX_MEMORY_MESSAGE_BUFFER_LIMIT,
  MIN_MEMORY_MESSAGE_BUFFER_LIMIT,
} from "../cordn/coordinator/storage/inMemoryStorage";
import type { BrowserCoordinatorStorageBackend } from "../cordn/coordinator/storage/browserCoordinatorStorage";

export function validateRelayUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "Relay URL is required";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Relay URL must be a valid ws:// or wss:// URI";
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return "Relay URL must start with ws:// or wss://";
  }

  if (!parsed.hostname) {
    return "Relay URL needs a hostname";
  }

  return null;
}

export const MIN_MAX_USERS = 1;
export const DEFAULT_MAX_USERS = 64;
export const BROWSER_MAX_USERS_CAP = 256;
export const DEFAULT_STORAGE_BACKEND: BrowserCoordinatorStorageBackend = "memory";

export function validateMaxUsers(value: number): string | null {
  if (!Number.isSafeInteger(value)) {
    return "Key-package quota must be a whole number";
  }

  if (value < MIN_MAX_USERS) {
    return `Key-package quota must be at least ${MIN_MAX_USERS}`;
  }

  if (value > BROWSER_MAX_USERS_CAP) {
    return `Browser limit is ${BROWSER_MAX_USERS_CAP} key packages per identity`;
  }

  return null;
}

export function validateStorageBackend(
  value: string,
): value is BrowserCoordinatorStorageBackend {
  return value === "memory" || value === "indexeddb";
}

export function validateMessageBufferLimit(value: number): string | null {
  if (!Number.isSafeInteger(value)) {
    return "Message buffer must be a whole number";
  }

  if (value < MIN_MEMORY_MESSAGE_BUFFER_LIMIT) {
    return `Message buffer must be at least ${MIN_MEMORY_MESSAGE_BUFFER_LIMIT}`;
  }

  if (value > MAX_MEMORY_MESSAGE_BUFFER_LIMIT) {
    return `Browser limit is ${MAX_MEMORY_MESSAGE_BUFFER_LIMIT} buffered messages`;
  }

  return null;
}
