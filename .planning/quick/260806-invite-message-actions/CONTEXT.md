# Invite Message Actions — Context

## Outcome

Recognize a complete, valid Cordn invite shared as a chat message and replace its raw URL with a contextual join button naming the group, coordinator, and host.

## Decisions

- `parseInviteUrl` remains the validation boundary; malformed, partial, or non-invite content remains plain text.
- New invites carry a display-safe coordinator name in optional metadata. Older invites fall back to a shortened coordinator identity.
- The action rebuilds the URL on the current app origin and adds `autojoin=1`; raw received text never becomes a navigation target or DOM attribute.
- Both host and guest message surfaces use the shared `MessageGroup` implementation.

## Non-goals

- Fetching coordinator profiles while rendering history.
- Recognizing arbitrary prose containing an invite among unrelated text.
- Changing MLS message or admission protocols.
