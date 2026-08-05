export const WORKSPACE_INTENT_STATE_KEY = "cahmlsWorkspaceIntent";

export interface WorkspaceHistoryState extends Record<string, unknown> {
  [WORKSPACE_INTENT_STATE_KEY]?: string;
}

/**
 * Convert legacy chat routes into state consumed by the single workspace shell.
 * The returned URL always uses the active shell origin so a remote invite cannot
 * navigate the browser away from CAHMLS.
 */
export function workspaceIntentFromHref(href: string, shellOrigin: string): string | null {
  const target = new URL(href, shellOrigin);
  if (!isChatRoomPath(target.pathname)) return null;
  return new URL(`${target.pathname}${target.search}${target.hash}`, shellOrigin).href;
}

export function initialWorkspaceIntent(
  locationHref: string,
  historyState: unknown,
  shellOrigin: string,
): string | null {
  const directIntent = workspaceIntentFromHref(locationHref, shellOrigin);
  if (directIntent) return directIntent;

  const location = new URL(locationHref, shellOrigin);
  if (isLegacyChatIndexPath(location.pathname)) return null;
  if (location.pathname !== "/") return null;

  const stored = readWorkspaceIntent(historyState);
  return stored ? workspaceIntentFromHref(stored, shellOrigin) : null;
}

export function withWorkspaceIntent(historyState: unknown, intent: string | null): WorkspaceHistoryState {
  const next = isRecord(historyState) ? { ...historyState } : {};
  if (intent) next[WORKSPACE_INTENT_STATE_KEY] = intent;
  else delete next[WORKSPACE_INTENT_STATE_KEY];
  return next;
}

export function isLegacyChatIndexPath(pathname: string): boolean {
  return pathname === "/chat" || pathname === "/chat/" || pathname === "/chats";
}

export function isChatRoomPath(pathname: string): boolean {
  return pathname.startsWith("/chat/") && pathname.length > "/chat/".length;
}

function readWorkspaceIntent(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const intent = value[WORKSPACE_INTENT_STATE_KEY];
  return typeof intent === "string" && intent.length > 0 ? intent : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
