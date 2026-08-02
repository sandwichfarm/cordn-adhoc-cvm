# Roadmap: Cordn Browser

## Overview

Milestone v1.1, **Quality of Life & Polish**, makes a browser-resident Cordn
coordinator feel coherent and trustworthy through daily reloads and active room
use. It starts by preserving anonymous identity and membership integrity, then
makes room recovery and navigation truthful, turns recovery into a clear startup
experience, consolidates personal and host controls, modernizes conversations,
and closes with repeatable delivery guidance and automated proof.

## Phases

- [x] **Phase 15: Identity Continuity & Membership Integrity** - Preserve anonymous identity across reloads and make deliberate rotation a safe privacy boundary. (completed 2026-08-02)
- [x] **Phase 16: Resilient Rooms & Recovery** - Make room navigation, unread state, and coordinator-led room restoration accurate and actionable. (completed 2026-08-02)
- [ ] **Phase 17: Full-Viewport Startup Motion** - Turn truthful room-recovery progress into an accessible GSAP ASCII startup experience.
- [ ] **Phase 18: Unified Presence, Notifications & Controls** - Consolidate personal presence and notifications while separating them from host lifecycle actions.
- [ ] **Phase 19: Grouped Conversations & Reactions** - Make active conversations easier to scan and react to without visual repetition.
- [ ] **Phase 20: Delivery Contract & Regression Proof** - Document the GSD lifecycle and protect the complete v1.1 experience with automated coverage.

## Phase Details

### Phase 15: Identity Continuity & Membership Integrity

**Goal**: Anonymous users retain one durable local identity and only the room authority that belongs to that identity.
**Depends on**: Phase 14
**Requirements**: IDEN-01, IDEN-02, IDEN-03, IDEN-04
**Success Criteria** (what must be TRUE):

  1. After an ordinary page reload or browser restart on the same device, a user returns as the same anonymous identity with its local profile.
  2. Restoring an ephemeral host shows each previously known coordinator and room once, without duplicate participant, coordinator, or room entries.
  3. From the identity menu, a user can choose to rotate identity and must explicitly confirm after seeing that existing room membership will not carry over.
  4. After confirmed rotation, the new identity cannot send with the retired identity's locally stored room credentials until it joins a room itself.

**Plans**: 3/3 plans executed

- [x] 15-01-PLAN.md
- [x] 15-02-PLAN.md
- [x] 15-03-PLAN.md

**UI hint**: yes

### Phase 16: Resilient Rooms & Recovery

**Goal**: Users can navigate and leave the exact room they intend while room restoration presents reliable state instead of misleading failures.
**Depends on**: Phase 15
**Requirements**: ROOM-01, ROOM-02, ROOM-03, BOOT-01, BOOT-02, BOOT-03
**Success Criteria** (what must be TRUE):

  1. A user can hover or keyboard-focus an eligible sidebar room, open its context menu, and confirm leaving that exact room and coordinator without opening the room first.
  2. Each room with new messages displays an accurate unread count, which increments for received messages and clears when that room is read.
  3. While starting a coordinator, the user sees each room being restored and aggregate restoration progress.
  4. A recoverable room timeout remains visible as retry/recovery progress; only an exhausted recovery becomes an actionable failure.
  5. A locally hosted room remains visibly recovering during startup and never appears as a disconnected chat before recovery finishes.

**Plans**: 6/6 plans executed

- [x] 16-01-PLAN.md
- [x] 16-02-PLAN.md
- [x] 16-03-PLAN.md
- [x] 16-04-PLAN.md
- [x] 16-05-PLAN.md
- [x] 16-06-PLAN.md

**UI hint**: yes

### Phase 17: Content-Pane Startup Motion

**Goal**: Coordinator recovery progress is communicated by a smooth, accessible startup motion that completely fills the workspace content pane while retaining the surrounding application shell.
**Depends on**: Phase 16
**Requirements**: MOTION-01, MOTION-02, MOTION-03
**Success Criteria** (what must be TRUE):

  1. At every supported desktop size, the startup ASCII field covers the entire workspace content pane with no uncovered right portion or internal gutter.
  2. Startup rings reveal and mask the ASCII field itself, rather than appearing as independent static border circles, and animate through GSAP.
  3. Startup motion responds to current recovery progress without obscuring status information.
  4. Users with reduced-motion enabled retain readable startup status and progress while nonessential motion is suppressed.

**Plans**: 2/2 plans executed

- [x] 17-01-PLAN.md
- [x] 17-02-PLAN.md

**UI hint**: yes

### Phase 18: Unified Presence, Notifications & Controls

**Goal**: Users can find personal presence, notification, and invitation actions in one coherent surface, distinct from coordinator lifecycle controls.
**Depends on**: Phase 16
**Requirements**: PRES-01, PRES-02, INVITE-01, SHELL-01, NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):

  1. The profile dropdown lets a user select online, invisible, or offline presence, and its active accessible status dot is attached to the user/avatar control.
  2. Header controls plainly separate personal actions from host/coordinator lifecycle actions, with no duplicate status or settings controls.
  3. A clearly labeled `Notification settings` action opens a working settings surface and retains the user's choices.
  4. A separate bell opens a grouped in-app notification feed with unread state and actionable incoming room invitations.
  5. Browser-notification permission is requested only after a user action, and enabled desktop notifications follow the configured cadence without duplicate bursts.

**Plans**: TBD
**UI hint**: yes

### Phase 19: Grouped Conversations & Reactions

**Goal**: Users can scan active conversations quickly and use compact, accurate reactions on message groups.
**Depends on**: Phase 18
**Requirements**: REACT-01, REACT-02, CHAT-01, CHAT-02
**Success Criteria** (what must be TRUE):

  1. Consecutive messages from one sender render as a single group with the sender avatar and name shown once above its individual bubbles.
  2. Every message retains its timestamp and relevant metadata in a smaller, lower-contrast treatment without repeating sender chrome.
  3. Each message or message group offers a compact reaction-add affordance overlapping the bubble border and opens an inline emoji picker.
  4. Reactions aggregate by emoji across participants, show total counts, and let the current participant toggle their own reaction without duplicating the count.

**Plans**: TBD
**UI hint**: yes

### Phase 20: Delivery Contract & Regression Proof

**Goal**: Contributors can follow one documented GSD delivery lifecycle and reliably detect regressions across the completed v1.1 experience.
**Depends on**: Phase 19
**Requirements**: DOC-01, TEST-01
**Success Criteria** (what must be TRUE):

  1. A contributor can read the root `AGENTS.md` and follow the repository's required GSD flow for requirements, planning, plan checks, execution, verification, gap closure, review, and shipping.
  2. Contributors can run unit and Playwright coverage that exercises identity continuity and rotation, exact room leaving, unread state, and startup recovery.
  3. The same automated coverage detects regressions in notifications, consolidated controls, grouped conversations, and aggregated reactions before release.

**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Identity Continuity & Membership Integrity | 3/3 | Complete    | 2026-08-02 |
| 16. Resilient Rooms & Recovery | 3/3 | In Progress|  |
| 17. Full-Viewport Startup Motion | 2/2 | In Progress|  |
| 18. Unified Presence, Notifications & Controls | 0/TBD | Not started | - |
| 19. Grouped Conversations & Reactions | 0/TBD | Not started | - |
| 20. Delivery Contract & Regression Proof | 0/TBD | Not started | - |
