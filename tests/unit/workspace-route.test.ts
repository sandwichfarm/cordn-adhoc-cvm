import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  initialWorkspaceIntent,
  isLegacyChatIndexPath,
  withWorkspaceIntent,
  workspaceIntentFromHref,
  WORKSPACE_INTENT_STATE_KEY,
} from "../../src/navigation/workspace-route";

describe("single-shell workspace routing", () => {
  test("captures a direct invite before the browser path is canonicalized", () => {
    const inviteSecret = randomBytes(32).toString("base64url");
    const href = new URL("/chat/room-a", "https://remote.example");
    href.searchParams.set("c", "abc");
    href.searchParams.set("i", inviteSecret);
    href.hash = "member";
    const expected = new URL(`${href.pathname}${href.search}${href.hash}`, "https://local.example");

    expect(initialWorkspaceIntent(href.href, null, "https://local.example")).toBe(expected.href);
  });

  test.each(["/chat", "/chat/", "/chats"])("treats %s as the root room browser", (path) => {
    expect(isLegacyChatIndexPath(path)).toBe(true);
    expect(initialWorkspaceIntent(`https://local.example${path}`, null, "https://local.example")).toBeNull();
  });

  test("restores the selected room from canonical root history state", () => {
    const intent = "https://local.example/chat/remembered?c=abc";
    const state = withWorkspaceIntent({ unrelated: 1 }, intent);

    expect(state).toEqual({ unrelated: 1, [WORKSPACE_INTENT_STATE_KEY]: intent });
    expect(initialWorkspaceIntent("https://local.example/", state, "https://local.example")).toBe(intent);
  });

  test("clears only CAHMLS route intent when returning home", () => {
    expect(withWorkspaceIntent({ unrelated: 1, [WORKSPACE_INTENT_STATE_KEY]: "/chat/old" }, null)).toEqual({
      unrelated: 1,
    });
  });

  test("does not adopt unrelated paths as room intent", () => {
    expect(workspaceIntentFromHref("https://local.example/settings", "https://local.example")).toBeNull();
  });
});
