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

export function validateMaxUsers(value: number, activeSubscriptionCount: number): string | null {
  if (!Number.isSafeInteger(value)) {
    return "Maximum users must be a whole number";
  }

  if (value < MIN_MAX_USERS) {
    return `Maximum users must be at least ${MIN_MAX_USERS}`;
  }

  if (value > BROWSER_MAX_USERS_CAP) {
    return `Browser limit is ${BROWSER_MAX_USERS_CAP} users`;
  }

  if (value < activeSubscriptionCount) {
    return `Maximum users cannot be below ${activeSubscriptionCount} active subscriptions`;
  }

  return null;
}
