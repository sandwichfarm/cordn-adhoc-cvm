import type { RelayHandler } from "@contextvm/sdk/core";
import { ApplesauceRelayPool } from "@contextvm/sdk/relay";

/** A local relay is always part of the browser transport pool. */
export const REQUIRED_LOCAL_RELAY_URL = "ws://localhost:4870";

export function withRequiredLocalRelay(relayUrls: readonly string[]): string[] {
  return [...new Set([...relayUrls, REQUIRED_LOCAL_RELAY_URL])];
}

/**
 * Relay hints embedded in a portable invite must be reachable from a secure
 * third-party web client. In particular, advertising the browser-only local
 * relay makes https://cordn.net attempt an insecure localhost WebSocket and
 * can prevent its coordinator request from being published at all.
 */
export function shareableRelayUrls(relayUrls: readonly string[]): string[] {
  const result = new Set<string>();
  for (const value of relayUrls) {
    const trimmed = value.trim();
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "wss:") continue;
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") continue;
      result.add(trimmed);
    } catch {
      // Invalid relay configuration is handled by the config validator. Keep
      // invite construction defensive because stored rooms may predate it.
    }
  }
  return [...result];
}

/**
 * Keeps the mandatory local relay connected without letting an unavailable
 * local developer relay interrupt a working remote path. Events and
 * subscriptions still fan out to the local pool whenever it is available.
 */
export function createRequiredRelayPool(relayUrls: readonly string[]): RelayHandler {
  const websocketPool = withRequiredLocalRelay(relayUrls);
  const remoteUrls = websocketPool.filter((url) => url !== REQUIRED_LOCAL_RELAY_URL);
  const primaryPool = new ApplesauceRelayPool(remoteUrls.length > 0 ? remoteUrls : [REQUIRED_LOCAL_RELAY_URL]);
  const localPool = remoteUrls.length > 0 ? new ApplesauceRelayPool([REQUIRED_LOCAL_RELAY_URL]) : null;

  return {
    connect: async () => {
      const primary = await Promise.allSettled([primaryPool.connect()]);
      if (localPool) void localPool.connect().catch(() => undefined);
      const failure = primary.find((entry) => entry.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    },
    disconnect: async () => {
      await Promise.allSettled([
        primaryPool.disconnect(),
        ...(localPool ? [localPool.disconnect()] : []),
      ]);
    },
    publish: async (event, options) => {
      if (localPool) void localPool.publish(event, options).catch(() => undefined);
      await primaryPool.publish(event, options);
    },
    subscribe: async (filters, onEvent, onEose) => {
      const unsubscribePrimary = await primaryPool.subscribe(filters, onEvent, onEose);
      let unsubscribeLocal: (() => void) | undefined;
      if (localPool) {
        try {
          unsubscribeLocal = await localPool.subscribe(filters, onEvent, onEose);
        } catch {
          // The primary pool remains usable when the optional local relay is offline.
        }
      }
      return () => {
        unsubscribePrimary();
        unsubscribeLocal?.();
      };
    },
    unsubscribe: () => {
      primaryPool.unsubscribe();
      localPool?.unsubscribe();
    },
    getRelayUrls: () => websocketPool,
  };
}
