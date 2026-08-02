# Requirements: CAHMLS Quality of Life & Polish

**Defined:** 2026-08-02
**Core Value:** A single browser tab acts as a fully functional, self-sovereign Cordn coordinator reachable over Nostr relays — no backend, no account, no installation.

## v1.1 Requirements

### Identity Continuity & Membership Integrity

- [x] **IDEN-01**: An anonymous identity, including its signing key and local profile, survives ordinary page reloads and browser restarts on the same device.
- [x] **IDEN-02**: An anonymous user can deliberately rotate to a fresh identity from the identity menu after a confirmation that explains the room-membership consequences.
- [x] **IDEN-03**: Rotating an anonymous identity retires the old identity's active room credentials locally so the new identity cannot send to rooms it has not joined.
- [x] **IDEN-04**: Reloading or restarting an ephemeral host does not create duplicate coordinator or room entries for participants; stored sessions are keyed and reconciled by stable coordinator and room identities.

### Room Navigation & Unread State

- [ ] **ROOM-01**: A user can hover or keyboard-focus an eligible room in the sidebar, open a three-dot context menu, and leave it without first opening that room.
- [ ] **ROOM-02**: Leaving a room from the sidebar targets that exact room and coordinator and requires a contextual confirmation before local membership state is removed.
- [x] **ROOM-03**: Every room with unread messages shows an accurate unread-count badge that increments for newly received messages and clears when the room is read.

### Coordinator Startup & Recovery

- [ ] **BOOT-01**: Coordinator startup reports room restoration as an explicit progress stage, including the current room and aggregate completion progress.
- [ ] **BOOT-02**: Recoverable room connection timeouts remain in the startup/retry experience instead of surfacing as terminal MCP errors; a persistent failure becomes an actionable error only after recovery is exhausted.
- [ ] **BOOT-03**: A locally hosted room cannot render as a disconnected chat while its coordinator startup and room recovery are still in progress.

### Startup Motion

- [ ] **MOTION-01**: The startup ASCII field covers the full viewport at every supported desktop size without an unfilled side gutter.
- [ ] **MOTION-02**: Startup rings are true masks/reveals of the ASCII field and are animated with GSAP rather than independent static border circles.
- [ ] **MOTION-03**: Startup motion remains smooth, responds to progress state, and honors `prefers-reduced-motion` without hiding status or progress information.

### Presence, Invitations & Shell Controls

- [ ] **PRES-01**: Online, invisible, and offline presence options are selected inside the user/profile dropdown rather than a separate header control.
- [ ] **PRES-02**: The active presence state is represented by a status dot attached to the user/avatar control and is available to keyboard and screen-reader users.
- [ ] **INVITE-01**: Incoming room invitations appear in a discoverable, actionable personal-notification surface instead of an isolated empty room-invites popover.
- [ ] **SHELL-01**: Header controls clearly separate personal/user actions from host/coordinator lifecycle actions and avoid duplicate status or settings controls.

### Notifications

- [ ] **NOTF-01**: The existing notification preference control is labeled `Notification settings` and opens a working settings surface with persisted choices.
- [ ] **NOTF-02**: A separate bell control opens an in-app notification feed with unread state, concise grouped entries, and actions for applicable events such as room invitations.
- [ ] **NOTF-03**: Browser notification permission is requested only from an explicit user action, and enabled desktop notifications are delivered on the configured cadence without duplicate bursts.

### Conversation Presentation & Reactions

- [ ] **REACT-01**: Each message or message group exposes a compact reaction-add affordance that overlaps the bubble border and opens an inline emoji picker.
- [ ] **REACT-02**: Reactions are aggregated by emoji across all participants, show total counts, and let the current participant toggle their own reaction without duplicating counts.
- [ ] **CHAT-01**: Consecutive messages from the same sender are rendered as one sender group with the avatar and display name shown once and individual message bubbles beneath it.
- [ ] **CHAT-02**: Every message keeps its timestamp and relevant metadata visible in a smaller, lower-contrast treatment without repeating sender chrome.

### Delivery Process & Verification

- [ ] **DOC-01**: Root `AGENTS.md` documents the repository's desired GSD-centered SDLC, including requirements, planning, plan checking, execution, verification, gap closure, review, and shipping expectations.
- [ ] **TEST-01**: Unit and Playwright coverage proves identity persistence/rotation, exact room leave targeting, unread badges, startup recovery, notification behavior, shell control placement, grouped messages, and aggregated reactions.

## Future Requirements

### Notification Expansion

- **NOTF-04**: In-app notification history can be synchronized across multiple devices for the same signed-in Nostr identity.

### Conversation Expansion

- **CHAT-03**: Users can configure the time window that determines message-group boundaries.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side identity or notification accounts | The application remains browser-resident and self-sovereign. |
| Email, SMS, or push-service notification backend | This milestone covers local in-app and browser notifications only. |
| Replacing MLS or ContextVM transport protocols | The milestone repairs continuity and presentation around the existing protocol stack. |
| Full mobile-first redesign | Layout must remain coherent, but this milestone targets the current desktop workspace. |
| Historical access after explicit identity rotation | Rotation is a deliberate privacy boundary; old credentials are retired unless the old identity is restored separately. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDEN-01 | Phase 15 | Complete |
| IDEN-02 | Phase 15 | Complete |
| IDEN-03 | Phase 15 | Complete |
| IDEN-04 | Phase 15 | Complete |
| ROOM-01 | Phase 16 | Pending |
| ROOM-02 | Phase 16 | Pending |
| ROOM-03 | Phase 16 | Complete |
| BOOT-01 | Phase 16 | Pending |
| BOOT-02 | Phase 16 | Pending |
| BOOT-03 | Phase 16 | Pending |
| MOTION-01 | Phase 17 | Pending |
| MOTION-02 | Phase 17 | Pending |
| MOTION-03 | Phase 17 | Pending |
| PRES-01 | Phase 18 | Pending |
| PRES-02 | Phase 18 | Pending |
| INVITE-01 | Phase 18 | Pending |
| SHELL-01 | Phase 18 | Pending |
| NOTF-01 | Phase 18 | Pending |
| NOTF-02 | Phase 18 | Pending |
| NOTF-03 | Phase 18 | Pending |
| REACT-01 | Phase 19 | Pending |
| REACT-02 | Phase 19 | Pending |
| CHAT-01 | Phase 19 | Pending |
| CHAT-02 | Phase 19 | Pending |
| DOC-01 | Phase 20 | Pending |
| TEST-01 | Phase 20 | Pending |

**Coverage:**

- v1.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-02*
*Last updated: 2026-08-02 after milestone scope confirmation from the user's annotated screenshots*
