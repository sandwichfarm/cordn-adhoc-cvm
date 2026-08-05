---
phase: 21
slug: first-run-coordinator-identity-profile
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-05
---

# Phase 21 — UI Design Contract

> Visual and interaction contract for deliberate first-run operator identity selection and coordinator profile naming. This phase reuses the CAHMLS cypherpunk shell, `UserProfile` sign-in mechanics, and `CoordinatorSettings`; it never merges the operator and coordinator identities.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — existing manual Svelte component styling with Tailwind v4 base import |
| Preset | not applicable — this is a Svelte 5/Vite project; the React shadcn initialization gate does not apply |
| Component library | existing local Svelte components and native semantic HTML |
| Icon library | none — retain the existing Unicode/operator glyph treatment with explicit accessible names |
| Font | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

Retain flat near-black and deep-green surfaces, square corners, thin muted-green dividers, compact monospace metadata, and sparse bright-green signal. Reuse the content-pane startup composition from `HostWorkspace`, the signer controls and QR treatment from `UserProfile`, and the right-side settings sheet from `CoordinatorSettings`. Do not introduce a settings page, card-grid onboarding, a new icon package, rounded surfaces, gradients, toast notifications, or a second profile/account surface.

| Source | Contract decisions applied |
|--------|----------------------------|
| `21-CONTEXT.md` | Locked order, anonymous support, editable authenticated prefill, persistence/migration, distinct operator/coordinator keys, shareable-relay publication, retry resilience, and evidence requirements. |
| `REQUIREMENTS.md` / `ROADMAP.md` | SETUP-01 through SETUP-04 and PROFILE-01 through PROFILE-02. |
| `HostWorkspace.svelte` | Content-pane startup stage, guided setup shell ownership, small-screen rail behavior, focus styles, and existing start control ownership. |
| `UserProfile.svelte` | Anonymous identity, NIP-07, NIP-46 QR/bunker flows, profile lookup, error surface, and 44px controls. |
| `CoordinatorSettings.svelte` / `config.svelte.ts` | Existing coordinator-name field, 48-character limit, edit-mode gate, settings-sheet layout, persisted config, and inline field-error styling. |
| Approved Phase 15/18 UI specifications | Terminal tokens, native accessible controls, labelled status, privacy-safe copy, and bottom-sheet responsiveness. |

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Status-dot inset, input/helper separation, inline metadata gaps |
| sm | 8px | Trigger/menu offsets, adjacent actions, compact row gaps |
| md | 16px | Setup stage sections, form padding, standard row spacing |
| lg | 24px | Separation between the setup title, choices, and name form |
| xl | 32px | Desktop content-pane and empty-state breathing room |
| 2xl | 48px | Large-screen setup focal-zone breathing room only |
| 3xl | 64px | Preserve only for existing full-shell composition; do not require it in the form |

Exceptions: every pointer-operable identity choice, signer action, name-save action, retry action, settings close action, and modal close action has a minimum 44px block hit area. The 6–8px presence/status geometry is decorative and never the only target. One-pixel rules are visual dividers, not spacing tokens.

---

## Typography

Use only these four sizes and exactly these two weights for new or touched Phase 21 UI. Existing untouched shell microcopy may remain until edited.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Utility label / relay-publication status | 10px | 400 | 1.3 |
| Body / input / button / helper text | 12px | 400 | 1.5 |
| Section emphasis / choice title | 18px | 600 | 1.2 |
| Setup-stage heading | 28px | 600 | 1.2 |

Use uppercase and existing 0.08–0.16em tracking only for kickers, step labels, and publication-state labels. Coordinator names use sentence case and may wrap in the setup title or settings status; they must not be uppercased. Apply tabular numerals only if an attempt count is shown. Do not display full operator or coordinator key material in this flow.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030303` | Workspace ground, surrounding shell, and opaque scrim field |
| Secondary (30%) | `#09100c` | Setup focal panel, profile/signer sub-panels, and coordinator settings sheet |
| Accent (10%) | `#7cf59d` | Selected identity choice, valid name field focus, `Continue anonymously`, `Save and continue`, `Save coordinator name`, retry publication action, and visible keyboard focus |
| Warning | `#e4e78d` | Non-terminal `Publishing profile…` / saved-locally guidance only |
| Destructive | `#ffaaa3` | User-safe validation/error text only; this phase has no destructive confirmation |

Accent reserved for: the seven elements explicitly listed above. It is never the default fill for every signer option, static status label, or setting. Use `#718277`/`#82958a` for inactive detail text and `#293832`/`#496451` for quiet borders. Identity type is always named in text; neither color nor the authenticated chip is sufficient by itself.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Save and continue` — enabled only when the normalized coordinator name is non-empty |
| Identity stage heading | `Choose your operator identity` |
| Identity stage body | `Use a Nostr signer or continue with a durable identity stored only in this browser.` |
| Anonymous choice | `Continue anonymously` — `No account required. This browser keeps a durable local identity.` |
| Name stage heading | `Name your coordinator` |
| Name stage body | `This name identifies the coordinator to people using Cordn-compatible clients. It is separate from your operator profile.` |
| Name field label | `Coordinator name` |
| Anonymous name default | `My coordinator` |
| Missing-name validation | `Enter a coordinator name to continue.` |
| Profile lookup status | `Looking up your Nostr profile…` |
| Profile-unavailable helper | `No profile name was found. Choose a coordinator name.` |
| Setup publication status | `Coordinator name saved. Publishing its public profile…` |
| Settings save action | `Save coordinator name` |
| Settings success | `Coordinator name published.` |
| Publication failure | `Couldn’t publish the coordinator profile. The coordinator name is saved locally and the coordinator is still running. Try again.` |
| Retry action | `Retry publishing` |
| Empty state heading | `No Nostr profile name available` |
| Empty state body | `Choose a coordinator name to continue.` |
| Destructive confirmation | None — this phase has no destructive action. |

Use existing labels exactly for supported sign-in methods: `NIP-07 browser signer`, `NIP-46 remote signer`, `Scan with your signer`, `Open signer on this device ↗`, `Use a bunker URI instead`, `Connect`, and `Cancel signer connection`. Do not claim a NIP-07/NIP-46 signer becomes the coordinator key. Never surface relay URLs, bunker URIs, connection secrets, full public keys, event JSON, raw publication failures, stack traces, or `MCP error` text.

---

## Phase 21 Surface and Interaction Contract

### Ownership and first-run sequence

`HostWorkspace` owns a single blocking setup state inside its existing content pane. The normal coordinator start/wake controls are not rendered or focusable while setup is required; navigation branding may remain visible, but the room rail, management toggle, room creation, and coordinator lifecycle controls remain hidden. This is a UI guard paired with the required start-time validation; it is not a new authentication protocol.

The setup state uses the existing centered startup focal column: `width: min(34rem, calc(100% - 32px))`, background `#101614`, a fixed content-pane fill, and an internal vertical scroller only when height is constrained. While setup is required, the absent room rail reserves no grid column: the content pane spans the full available viewport width and the focal card is horizontally centered against that width. It does not cover the viewport or create document scroll. It contains a visually quiet `First run` kicker, the stage heading, one explanatory paragraph, and the current step body.

The sequence is fixed and has no back-skipping around the identity decision:

1. **Identity choice.** Render the existing supported sign-in actions in this order: `NIP-07 browser signer`; `NIP-46 remote signer`; `Use a bunker URI instead`; then the visually distinct, always available `Continue anonymously` action. NIP-46 QR expansion, the explicit `Cancel signer connection` action, errors, and bunker handling reuse `UserProfile` behavior and copy. Signing in advances only after the existing store reaches a usable authenticated identity. Selecting anonymous immediately establishes/reuses the durable local operator identity, then advances to naming.
2. **Coordinator naming.** Authenticated identity opens the name form after profile resolution. Prefill from `display_name`, then `name`; if neither exists, render the documented empty state and prefill `My coordinator`. Anonymous identity prepopulates `My coordinator`. The field stays editable in every case.
3. **Complete setup.** `Save and continue` normalizes with `trim()` and caps at 48 characters. Disable it while the normalized value is empty or the completion write is in flight. On success, persist the normalized name and completion marker, then return to the existing guided start state. It does not start the coordinator automatically.

Do not overwrite a name after the operator has typed into the field. If an asynchronous authenticated profile lookup resolves late, prefill only an untouched empty/default field and announce the changed suggestion through the existing polite status region. The operator’s selected signer remains the human-facing operator identity; the coordinator keeps its generated transport key, and neither choice replaces the other.

### Persistence, migration, and start gate

- Store an explicit setup-complete marker with the normalized coordinator name. A completed setup always bypasses this surface after an ordinary reload/restart.
- At first load of this version, migrate an existing installation with a meaningful persisted coordinator name: trim the stored value, cap it at 48 characters, preserve it, record completion, and bypass setup. Treat the untouched default `My coordinator`, blank, malformed, or whitespace-only legacy value as not meaningful; require setup instead.
- The UI must evaluate this state before the first lifecycle control renders. During the brief state read, expose `data-setup-state="checking"` and no enabled start/wake button. It must not flash the normal guided start screen.
- `coordinator.start()` must still reject a missing/uncompleted setup independently of the UI. If that guard is reached through another path, retain the setup stage and show the missing-name validation; do not partly start transport or create a replacement identity.

### Coordinator-name publication and settings rename

Keep later renaming in the existing **Coordinator settings → Identity** section; do not put it in `UserProfile`, the presence menu, or a personal profile action. While settings are read-only, show the persisted name as today. In edit mode, replace immediate-on-keystroke publication with a draft field and explicit `Save coordinator name` action.

- The input has `maxlength="48"`, preserves normal typing, and normalizes with `trim()` on save. Empty normalized input shows the documented missing-name validation and performs neither persistence nor publication.
- `Save coordinator name` persists the changed normalized name first, then publishes/republishes a valid kind-0 profile signed by the unchanged coordinator key to configured shareable relays. It is disabled only while saving/publishing or when the draft equals the persisted normalized value.
- During publishing, retain the entered name, preserve every other kind-0 field where available, expose the documented in-flight status in a polite `role="status"` region, and do not block the rest of the running coordinator beyond the name action itself.
- On success, show `Coordinator name published.` inline in the Identity section, not as a toast. On failure, keep the valid local name, leave coordinator lifecycle state unchanged, render the documented error with `role="alert"`, and show `Retry publishing`. Retry republishes the saved name using the same coordinator key and current configured shareable relays; it does not regenerate keys, reopen onboarding, or require the operator to sign in again.
- The settings helper immediately below the field reads: `This public coordinator name is separate from your operator profile.` It must remain present in both published and retry states to prevent identity conflation.

### Validation, feedback, accessibility, and responsive behavior

- The first identity-stage action receives initial focus. After an identity selection, focus the coordinator-name input. After successful setup, focus the existing guided primary `Start coordinator`/`Wake coordinator` action. On settings save/retry completion, retain focus on the action that initiated it.
- Stage controls are real `<button>` and `<input>` elements. The setup container has a named landmark or `role="region"` with `aria-labelledby` pointing to the current heading. Name validation uses `aria-describedby` and `aria-invalid="true"`; the inline error has `role="alert"`. Async profile/publish changes use a visually hidden polite live region, never an alert that interrupts typing.
- Disabled/in-flight signer, save, and retry controls announce their busy labels (`Connecting…`, `Saving…`, or `Publishing…`) and must not accept duplicate activation. `Cancel signer connection` remains operable while NIP-46 waits.
- At desktop widths, retain the centered content-pane focal column. At 900px and below, keep the setup stage full content width, 16px edge clearance, and no sidebar drawer. At 520px and below, use 8px stage edge clearance and stack signer-option secondary text beneath titles; all controls remain at least 44px high. At short viewport heights, only the setup body scrolls; the heading and primary action stay reachable.
- Long profile names/coordinator names wrap in heading/status copy and truncate only in compact one-line shell placements. They never widen the pane or mask the save/retry action. Bunker URIs and raw Nostr errors never appear in status text.
- No new animation is required. Respect `prefers-reduced-motion` by retaining static state changes and never using motion to signal setup completion, profile lookup, or publication result.

### Testable selectors and observable states

Use these stable selectors; text remains the user-facing source of truth.

| Surface / state | Required selector and observable contract |
|-----------------|-------------------------------------------|
| Setup gate | `[data-testid="coordinator-setup"]` with `data-setup-state="checking|identity|required-name|saving|complete|migrated"`; it exists before any enabled lifecycle control when setup is not complete. |
| Identity choice | `[data-testid="setup-identity-stage"]`, `[data-testid="setup-nip07"]`, `[data-testid="setup-nip46"]`, `[data-testid="setup-nip46-qr"]`, `[data-testid="setup-cancel-signer-connection"]` (labelled `Cancel signer connection`), and `[data-testid="setup-anonymous"]`; anonymous remains enabled whether or not a signer extension is present. |
| Auth/profile transition | `[data-testid="setup-profile-loading"]` while resolving; `[data-testid="setup-name-stage"]` when ready; `[data-testid="setup-profile-empty"]` only when no authenticated profile name exists. |
| Name validation | `[data-testid="setup-coordinator-name"]`, `[data-testid="setup-name-error"]`, and `[data-testid="setup-save"]`; the input exposes `aria-invalid="true"` only after invalid submission/blur, and save is disabled for a trimmed-empty value. |
| Migration/restart bypass | `[data-testid="coordinator-setup"]` is absent and `[data-testid="guided-start-state"]` is present after completed setup or meaningful-name migration; `[data-testid="coordinator-start"]` may be enabled only in that state. |
| Settings rename | `[data-testid="coordinator-settings"]`, `[data-testid="coordinator-name-input"]`, `[data-testid="save-coordinator-name"]`, `[data-testid="coordinator-name-status"]`, `[data-testid="coordinator-name-error"]`, and `[data-testid="retry-coordinator-profile"]`. The status includes `data-publication-state="idle|publishing|published|failed"`. |

---

## UI Considerations

Applicable state considerations resolved: 7 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | Setup gate and authenticated profile lookup | ✅ covered | Before completion state is known, setup blocks lifecycle activation; authenticated lookup renders the documented status while preserving the selected identity and no start controls. |
| empty | Authenticated coordinator-name prefill | ✅ covered | A missing kind-0 name renders the documented empty heading/body and the editable `My coordinator` value rather than blocking anonymous or authenticated setup. |
| error | Name save, signer action, and profile publication | ✅ covered | Invalid names stay in place with inline validation; signer failures retain their existing actionable component error; publication failure keeps the local name and exposes retry without stopping the coordinator. |
| partial | Existing kind-0 metadata on rename | ✅ covered | Only the coordinator name changes; available non-name profile fields are preserved and a failed publish never replaces local coordinator/runtime state. |
| long-text | Coordinator name, authenticated profile name, settings helper/status | ✅ covered | Form inputs cap at 48 characters, shell placements ellipsize, and focal-panel/settings prose wraps without horizontal overflow. |
| overflow | Setup focal column and settings Identity section | 🧪 backstop | At supported narrow and short viewports, only the named stage/settings body scrolls; primary/save/retry controls remain reachable and no document overflow occurs. |
| loading | Publication retry | 🧪 backstop | Playwright holds publish/retry in flight and proves a single disabled initiating action, the saved name remains visible, and coordinator lifecycle state is unchanged. |
| zero-one-many | Relay publication feedback | ✅ covered | The UI names the operation generically as public-profile publication; it does not enumerate relay URLs, vary private error detail, or expose a relay list in the setup flow. |
| populated | Identity choice / settings profile state | ✅ covered | Each valid operator identity renders exactly one selected method summary, while settings always shows the coordinator-name draft, its distinctness helper, and current publication state. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable — Svelte/Vite project with no `components.json`, no shadcn use, and no third-party registry declared; checked 2026-08-05 |

---

## Verification Contract

- Unit tests prove normalized-name validation, explicit completion persistence, default/blank versus meaningful-name migration, anonymous continuation, and first-run start rejection before setup completion.
- Unit tests prove authenticated prefill priority (`display_name`, then `name`), that late profile completion cannot overwrite edited text, 48-character normalization, and that no operator signer becomes the coordinator transport identity.
- Unit tests prove kind-0 merge/preservation, coordinator-key signing, configured shareable-relay targeting, retry semantics, and publication failure leaves the saved coordinator name/runtime intact.
- Playwright proves every identity choice is reachable, anonymous continuation works without a signer, NIP-07/NIP-46 setup advances only after identity readiness, and an authenticated profile name prefills but stays editable.
- Playwright proves blank/whitespace name blocks `Save and continue` and all coordinator start/wake controls; successful setup then exposes the existing guided start action and ordinary reload bypasses setup without a flash.
- Playwright proves a meaningful legacy configured name migrates/bypasses setup, while untouched default/blank legacy data requires it.
- Playwright edits the settings name, observes `publishing` then `published`, and verifies the coordinator remains running with unchanged operator/coordinator identity. A forced publication failure verifies the exact error, saved local name, reachable retry action, and no coordinator stop.
- Interoperability evidence verifies the emitted kind-0 event contains the selected coordinator name, has the coordinator pubkey and valid coordinator-key signature, and follows the configured shareable relay path; canonical cordn.net must resolve the name instead of an `npub` fallback.
- At 1280×720, 900×700, 520×760, and a short-height viewport, browser tests verify no document overflow, keyboard-visible focus, 44px interactive targets, internal containment, and reduced-motion static behavior.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
