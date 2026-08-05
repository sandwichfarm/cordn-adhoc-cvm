import { describe, expect, test } from "vitest";
import { groupMessageStreaks, nextRelativeMessageTimeDelay, relativeMessageTime } from "../../src/chat/message-presentation";
import type { StoredMessage } from "../../src/chat/room-store";

function message(id: string, sender: string, createdAt = 0): StoredMessage {
  return { type: "message", id, sender, name: sender, content: id, createdAt };
}

describe("message presentation", () => {
  test("groups only consecutive messages from the same sender", () => {
    const groups = groupMessageStreaks([
      message("a1", "alice"), message("a2", "alice"), message("b1", "bob"), message("a3", "alice"),
    ]);
    expect(groups.map((group) => [group.sender, group.messages.map(({ id }) => id)])).toEqual([
      ["alice", ["a1", "a2"]], ["bob", ["b1"]], ["alice", ["a3"]],
    ]);
  });

  test.each([
    [0, "now", 1_000],
    [9_000, "9s ago", 1_000],
    [10_000, "10s ago", 5_000],
    [29_000, "29s ago", 1_000],
    [30_000, "30s ago", 10_000],
    [59_000, "59s ago", 1_000],
    [60_000, "1m ago", 60_000],
    [3_600_000, "1h ago", 3_600_000],
  ])("formats and schedules age %i", (age, label, delay) => {
    const now = Date.UTC(2026, 7, 5, 12);
    expect(relativeMessageTime(now - age, now)).toBe(label);
    expect(nextRelativeMessageTimeDelay(now - age, now)).toBe(delay);
  });

  test("switches to a static locale date and time after one day", () => {
    const now = Date.UTC(2026, 7, 5, 12);
    const createdAt = now - 86_400_000;
    expect(relativeMessageTime(createdAt, now)).toBe(new Date(createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
    expect(nextRelativeMessageTimeDelay(createdAt, now)).toBeNull();
  });
});

