---
phase: 19-grouped-conversations-reactions
status: approved
---

# Phase 19 UI Specification

## Layout Contract

- A streak spans at most `min(88%, 44rem)` and has a 32px square avatar in a dedicated outer column.
- Other-user streaks use `avatar | content`; own streaks use `content | avatar` and `margin-left: auto`.
- The author line is outside the bubbles and appears once per streak. Other names align left; the current participant's name aligns right.
- Bubbles remain square-edged with one-pixel borders. Adjacent bubbles in a streak use 4px vertical separation.
- Host streaks retain the existing compact badge and receive a modest green border/background distinction; host identity is never conveyed by color alone.
- Per-message metadata is 9–10px, low contrast, and remains visible. Pending copy appears beside the timestamp.
- Reaction controls continue overlapping each individual bubble border.

## Responsive Contract

- At 520px and below, streak width may grow to 96%; avatar stays outside the bubble and never collapses into it.
- Long names and content truncate/wrap without horizontal document overflow.
- The log remains keyboard and screen-reader compatible; each streak is labelled with its author and message count.

## Verification Checkpoints

1. Alternating senders create distinct left/right streaks.
2. Multiple consecutive messages share one author/avatar and retain individual bubbles/timestamps.
3. Host badge and host styling survive grouping.
4. Adaptive timestamp labels and scheduling match D-05.
5. Desktop and compact layouts keep avatars outside bubbles and inside the viewport.

