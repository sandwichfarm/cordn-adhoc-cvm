# Invite Message Actions — Plan

Requirement: CHAT-04

1. Extend the canonical invite metadata/storage projection with an optional normalized coordinator display name and add a helper that accepts only complete invite-message content.
2. Add a canonical current-shell auto-join URL builder and render validated invite messages as an accessible contextual action in `MessageGroup`.
3. Wire both host and guest navigation owners to the action without exposing raw capabilities in rendered attributes.
4. Add unit coverage for metadata round-tripping, strict message recognition, and canonical navigation; add Playwright coverage proving rendered copy, host avatar/name, and join activation.
5. Run lint, type-check, unit, browser, build, interoperability gates where applicable, and diff checks before updating the active PR.

Plan check: PASS — each requested label element has an authoritative invite field or explicit fallback; both render owners share one component; navigation reuses the existing validated same-shell flow; security and compatibility have direct tests.
