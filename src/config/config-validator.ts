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
