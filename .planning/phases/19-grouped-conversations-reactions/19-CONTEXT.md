---
phase: 19-grouped-conversations-reactions
status: active
---

# Phase 19 Context

## Goal

Modernize the encrypted conversation layout without breaking CAHMLS's restrained dark-green, square-edged visual language.

## Decisions

- **D-01:** Consecutive messages with the same sender form one streak. A sender change always starts a new streak.
- **D-02:** The current participant is right-aligned: avatar at the far right, bubbles immediately to its left. Other participants are left-aligned: avatar/name at the far left, bubbles to their right.
- **D-03:** Avatar, display name, and host badge render once per streak, outside all message bubbles. Individual messages retain their own timestamp, pending state, and reactions.
- **D-04:** A host streak retains its host badge and uses a subtly distinct border/background signal. Host styling is textual as well as chromatic.
- **D-05:** Relative timestamps update at adaptive boundaries: every second through 10 seconds, every 5 seconds through 30 seconds, every 10 seconds through one minute, every minute through one hour, every hour through one day, then a locale date-and-time label with no timer.
- **D-06:** Host and invitee chat surfaces use the same renderer and grouping rules. Reactions stay attached to their exact message and self-reactions remain prohibited.

## Non-goals

- No protocol, encryption, persistence, sender-authentication, or message-order changes.
- No rounded social-chat redesign, gradients, icon dependency, or identity-key exposure.

