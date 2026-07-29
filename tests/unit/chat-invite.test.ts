import { describe, expect, test } from "vitest";
import { createInviteUrl, parseInviteUrl } from "../../src/chat/invite";

describe("Feature: self-contained chat invitations", () => {
  test("Scenario: a guest follows a copied link and learns the exact coordinator and relay", () => {
    const url = createInviteUrl("https://adhoc.example/", {
      groupId: "group-α",
      coordinatorPubkey: "a".repeat(64),
      relayUrls: ["wss://one.example", "wss://two.example"],
      title: "Friday plans",
    });

    expect(parseInviteUrl(url)).toEqual({
      groupId: "group-α",
      coordinatorPubkey: "a".repeat(64),
      relayUrls: ["wss://one.example", "wss://two.example"],
      title: "Friday plans",
    });
  });

  test("Scenario: a malformed invite never silently routes a guest to another coordinator", () => {
    expect(parseInviteUrl("https://adhoc.example/chat/group-1?c=not-a-profile")).toBeNull();
  });
});
