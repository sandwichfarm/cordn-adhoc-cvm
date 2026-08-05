# Phase 18: Unified Presence, Notifications & Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 18-unified-presence-notifications-controls
**Areas discussed:** Presence ownership, feed/settings separation, invitation replay privacy, notification defaults, command-bar ownership

---

## Presence ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Personal presence in avatar menu | Move all presence choices and the accessible status dot into the profile control; lifecycle remains separate. | ✓ |
| Keep standalone presence control | Retain the current separate header selector and coordinator side effects. | |
| Put presence in host settings | Treat availability as coordinator configuration. | |

**User's choice:** Auto-selected the recommended personal-presence boundary from explicit PRES-01/PRES-02 and shell-separation requirements.
**Notes:** Presence must not start or stop the coordinator.

---

## Feed and settings separation

| Option | Description | Selected |
|--------|-------------|----------|
| Separate bell feed and labeled settings | Bell owns unread activity; `Notification settings` owns preferences and explicit permission. | ✓ |
| Combined bell/settings panel | Keep activity and configuration in one popover. | |
| Settings only | Omit an in-app activity feed. | |

**User's choice:** Auto-selected the explicitly requested separate feed and settings surfaces.
**Notes:** Opening settings does not trigger browser permission.

---

## Invitation replay privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Persist resolution identifiers only | Suppress handled relay replays without storing invite links or secrets. | ✓ |
| Session-only dismissal | Allow handled invitations to reappear after reload. | |
| Persist full invitation history | Retain invitation URLs and payloads in general notification history. | |

**User's choice:** Auto-selected privacy-minimal durable suppression for trustworthy reload behavior.
**Notes:** Reading the feed and resolving an invitation remain separate actions.

---

## Desktop defaults and cadence

| Option | Description | Selected |
|--------|-------------|----------|
| Online-only default with grouped cadence | In-app feed records relevant activity; desktop online events default on, other desktop categories opt in. | ✓ |
| All desktop categories on | Deliver message, invitation, and online events immediately by default. | |
| Desktop notifications off with no defaults | Require configuring every category before any delivery. | |

**User's choice:** Auto-selected the user’s stated online-only default and concise grouped cadence.
**Notes:** Permission remains an explicit action.

---

## Command-bar ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Personal and host clusters | Visually separate avatar/bell/settings from coordinator settings/lifecycle/manage. | ✓ |
| One undifferentiated row | Keep all controls adjacent with border separators only. | |
| Put everything in profile | Hide coordinator and personal actions inside one menu. | |

**User's choice:** Auto-selected explicit ownership clusters from SHELL-01 and the annotated UI direction.
**Notes:** Host badge identity editing leaves the personal profile menu.

---

## the agent's Discretion

- Exact feed density, local history bound, icon treatment, empty-state language, and minor visual separators.

## Deferred Ideas

- Cross-device notification history (NOTF-04).
- Grouped conversation and reaction presentation (Phase 19).
