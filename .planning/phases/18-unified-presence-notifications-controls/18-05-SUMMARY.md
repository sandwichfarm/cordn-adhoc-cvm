---
phase: 18-unified-presence-notifications-controls
plan: 05
status: complete
one_liner: Persistent global and per-channel sound and notification controls with clear non-default channel state.
requirements_completed:
  - NOTF-06
  - SHELL-03
key-files:
  created:
    - src/notifications/channel-preferences.svelte.ts
    - tests/unit/channel-preferences.test.ts
  modified:
    - src/notifications/notification-center.svelte.ts
    - src/chat/room-store.ts
    - src/components/HostWorkspace.svelte
    - src/components/ChatRoute.svelte
    - src/components/RoomActionsMenu.svelte
    - src/components/CoordinatorRoomCard.svelte
    - tests/e2e/workspace-lifecycle.spec.ts
---

# Plan 18-05 Summary

The workspace now owns one persisted speaker control at its top-right edge. Each channel can inherit or override global sound and can admit message notifications from everyone, followed accounts, mutuals, or nobody. Incoming tone playback and notification recording consume the effective channel choice, and non-default channels display an accessible accent indicator.

The local coordinator create action now renders as a larger right-aligned `+`. It retains the `Create group` accessible name, uses a pointer cursor, and reveals a bounded hover/focus treatment with restrained motion.

Regression coverage proves storage validation and persistence, sound precedence, relationship filters, runtime indicators, responsive containment, speaker semantics, and create-action geometry/interaction.
