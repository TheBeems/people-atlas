Status: done
Created: 2026-08-08
Updated: 2026-08-09
Parent: None
Owner: People Atlas implementation workstream — relationship modal
Depends-On: `.10x/specs/perspective-relationship-editor-templates.md`, `.10x/specs/safe-mutations-and-versioned-data.md`

# Native relationship-person picker: anchored mobile suggestions

## Scope

Replace the relationship modal's native HTML `<datalist>` endpoint picker with
one plugin-owned, accessible suggestion list anchored to the currently active
person input. The picker must behave consistently on narrow/mobile surfaces;
its visible candidate rows contain only the indexed person's display name while
canonical file paths remain the selection values used by the existing form and
mutation boundary.

The first- and second-person endpoint fields use the same picker and remain
editable canonical-person selectors. The existing relationship form/session,
validation, Save-only write boundary, endpoint order and role/template behavior
remain unchanged.

## Non-goals

- No change to relationship persistence, mutation validation, wikilink/path
  serialization, endpoint ordering, role automation or template semantics.
- No change to editor `@` suggestions; the pre-existing staged mention change is
  outside this ticket.
- No native `<datalist>` fallback, platform-specific Android code or new
  dependency/widget library.
- No automatic person creation, duplicate merging or display-name identity.
- No commit, push, tag, release or vault write as part of this ticket.
- No claim of native Android popup geometry from controlled DOM/browser tests;
  live Obsidian Mobile validation remains an explicit evidence boundary.

## Acceptance criteria

- [x] The relationship endpoint controls no longer use `input[list]` or a native
      `<datalist>`; each active endpoint input exposes a plugin-owned listbox in
      the modal's owning document.
- [x] When an endpoint input is focused or queried, its suggestion list is
      rendered directly below that input, within the same field/scroll context,
      and is not viewport-bottom/native-keyboard anchored. Only the active
      endpoint list is open.
- [x] Candidate rows visibly show only the person's display name. Each row
      retains an unambiguous canonical file path/ID in an internal selection
      value; display names never become identity keys.
- [x] Pointer/touch selection and keyboard navigation (ArrowUp/ArrowDown,
      Enter, Escape and Tab-compatible focus behavior) select the canonical
      person, update the existing form values and preserve the current
      no-write-before-Save contract.
- [x] Name/alias filtering remains usable for both endpoint fields; stale,
      missing and non-canonical selections continue to be rejected by the
      existing form/mutation resolver.
- [x] Existing first/second endpoint labels, role/template updates, form DOM,
      scroll state and canonical Save payloads remain unchanged apart from the
      picker presentation.
- [x] Focused browser/integration tests prove list ownership, below-input
      geometry, name-only presentation, canonical selection values, keyboard/
      pointer selection and no mutation before Save at a narrow viewport.
- [x] `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`,
      `npm run build` and `git diff --check` pass for the final ticket worktree.
- [x] Independent read-only review has no critical/significant finding (or a
      durable, explicitly accepted residual risk) before closure.

## References

- `.10x/specs/perspective-relationship-editor-templates.md` — endpoint selector,
  display-label and accessibility contract.
- `.10x/specs/safe-mutations-and-versioned-data.md` — canonical identity and
  Save/write boundary.
- `.10x/research/2026-07-30-person-relationship-ux-review.md` — native
  datalist desktop/mobile risk and validation limits.
- `.10x/tickets/2026-08-08-relationship-modal-contract-hardening.md` — current
  modal lifecycle boundary and owning-document conventions.
- `src/editor/relationship-modal.ts` — plugin-owned relationship picker implementation.
- `src/editor/relationship-form.ts` — canonical endpoint resolution and
  mutation input mapping.
- `styles.css` — current relationship form layout.
- `test/browser/relationship-modal.browser.test.ts` — controlled browser modal
  coverage.
- `test/integration/partner-parent-confirmation.integration.test.ts` —
  controlled relationship entrypoint coverage.
- `.10x/evidence/2026-08-09-native-relationship-person-picker-closure.md` —
  current dirty-candidate gate and review ledger.
- `AGENTS.md`

## Assumptions and provenance

- User-ratified on 2026-08-08 by the request to fix the second-person
  suggestion-list position: the list must appear directly below the active
  input on mobile.
- User-ratified in the preceding presentation request: visible suggestion rows
  show only person names.
- Record-backed: endpoint identity remains the canonical indexed path/ID; the
  active specs prohibit display-name identity.
- Record-backed/mechanical: replacing a user-agent-owned `<datalist>` is the
  smallest mechanism that can guarantee plugin-controlled anchoring and
  presentation after the source/probe established that the native list has no
  positionable DOM box.

## Vertical TDD slices

### Slice 1 — plugin-owned anchored list (RED → GREEN)

- RED: extend the relationship browser contract at a narrow viewport to expect
  a plugin-owned listbox below the focused second-person input, no `datalist`,
  and name-only rows; run the exact focused test and record the current native
  implementation failure.
- GREEN: replace the shared native datalist construction with the smallest
  owning-document listbox/anchoring implementation and rerun the focused test.

### Slice 2 — canonical selection and interaction (RED → GREEN)

- RED: add a focused interaction assertion for keyboard and pointer/touch
  selection that expects the row's canonical path to reach the existing form
  state while the suggestion text remains the display name and Save has not
  been called.
- GREEN: wire selection, filtering, focus/close state and keyboard semantics
  without changing the mutation/form resolver.

### Slice 3 — regression parity (RED → GREEN)

- Extend the existing relationship integration assertion from native option
  metadata to the plugin-owned candidate contract, including duplicate display
  names with distinct canonical values where the fixture can prove it without
  making the visible name a hidden identity key.
- Run the focused browser/integration suites and typecheck before review.

## Journal

- 2026-08-08 shaping: screenshot, source inspection and a minimal Chromium probe
  established that the relationship fields use native `<input list>` plus
  `<datalist>`; the datalist is `display:none`, has a `0x0` DOM rectangle and
  cannot be positioned by plugin CSS. Android/WebView therefore owns the
  viewport-bottom popup above the soft keyboard. No product files were changed
  during this diagnosis.
- 2026-08-08 shaping: current worktree already contains four staged files from
  the preceding name-only presentation slice. Those files are not silently
  discarded; the mention portion remains outside this ticket, while the
  relationship picker test/source hunk is the directly coupled acceptance
  surface and must be reconciled before execution.
- 2026-08-08 independent read-only root-cause review: **confirmed** that the
  visible popup is UA/WebView/Android-owned rather than plugin DOM/CSS. The
  exact Android/IME layer remains platform-dependent; this is a live-validation
  limit, not a competing product-code hypothesis. The reviewer made no file,
  staging or external changes.
- 2026-08-09 repair evidence: the stale prefill assertions were corrected only
  at the presentation boundary from canonical paths to `robin.name`/`sam.name`;
  canonical paths and the Save payload remain asserted. The focused browser and
  integration tests then passed under Node v24.18.1.
- 2026-08-09 current Node-24 gate: `npm run test`, `npm run build`,
  `npm run release:contract`, `npm run verify:reproducible`,
  `npm run dependency:audit`, `npm run community:check`,
  `npm run format:check`, `npm run lint`, `npm run typecheck` and
  `git diff --check HEAD` all exited 0. The aggregate test runner reported
  node 53 files/965 tests, browser 10 files/166 tests, integration 9 files/39
  tests and DPR 6/6; the expected negative child-process `MODULE_NOT_FOUND`
  diagnostic was emitted while the parent runner still passed.
- 2026-08-09 independent post-repair review `deleg_b9ae6245`: **PASS** for
  implementation, with no critical/significant product finding. A second
  bounded review `deleg_25ea394d` returned **CONCERNS** at low severity for
  missing real-browser Arrow-key/negative listbox-path coverage and detached
  host/lifecycle probes; it found no runtime defect. Those limits are explicitly
  accepted for this bounded implementation, and the follow-up coverage owner
  is `.10x/tickets/2026-08-09-relationship-picker-browser-coverage.md`.
- 2026-08-09 record provenance: this picker record is a post-parent follow-up,
  not an original child of the already closed remediation parent. Its
  `Parent: None` boundary is intentional; the related coverage ticket is an
  independent open follow-up with the same post-parent boundary.

## Blockers

None confirmed after source/spec/probe inspection. Native Android popup geometry
remains a live-validation limit, not an implementation blocker, because the
replacement removes the user-agent-owned popup from the product path. The
low-severity browser/host coverage limits are explicitly accepted in Review and
owned by `.10x/tickets/2026-08-09-relationship-picker-browser-coverage.md`.

## Evidence

Initial shaping evidence:

- `src/editor/relationship-modal.ts:159-197` creates one native `<datalist>`
  and attaches it to both endpoint inputs.
- `src/editor/relationship-modal.ts:773-799` creates ordinary inputs with only
  a `list` attribute and no plugin-owned suggestion renderer.
- `styles.css:465-477,683-707` contains form layout only and no datalist popup
  positioning rules.
- Minimal Chromium probe: the datalist computed to `display: none`, a `0x0`
  bounding rectangle, zero client rects, and retained option value/label data.
- Screenshot evidence: the Android list is system/WebView-styled, full-width
  above the soft keyboard and therefore not a modal DOM dropdown.

### Current closure evidence — 2026-08-09

- Runtime: Node `v24.18.1`; npm `11.16.0`.
- Focused commands under Node v24.18.1 all exited 0:
  `npx vitest run --project browser test/browser/relationship-modal.browser.test.ts
  --no-file-parallelism --maxWorkers=1`,
  `npx vitest run --project browser --no-file-parallelism
  test/browser/partner-parent-relationship-modal.browser.test.ts`, and
  `npx vitest run --project integration
  test/integration/partner-parent-confirmation.integration.test.ts
  --no-file-parallelism --maxWorkers=1`. Together the focused relationship
  checks covered 33 browser tests and 5 integration tests; the repaired
  prefill assertions show names while retaining canonical paths in the Save
  boundary.
- Full gate: exact `npm run test` ran three times sequentially under Node 24;
  each run was exit 0 with node 53 files/965 tests, browser 10 files/166 tests,
  integration 9 files/39 tests, DPR matrix 6/6; format checked 172 files;
  lint/typecheck/build/release-contract/reproducibility/community-check and
  dependency audit all passed, with audit result `0 vulnerabilities`.
- `npm run release:contract` observed package version `0.12.2`, exact release
  assets `main.js`, `manifest.json` and `styles.css`, and local `main.js`
  size 429105 bytes. This is the dirty local candidate, not the existing tag.
- Reproducibility: both builds produced SHA-256
  `ba1f0b9c159be985042c930fd71a41a1fb659a7e64d07d9701179d31c52f3858`.
- The current local `main.js` observation was 429105 bytes with that digest.
  This is a dirty local candidate, not evidence that the existing `0.12.2`
  tag or a remote release contains these changes. No commit, push, tag,
  GitHub Actions run, attestation, Community Plugins publication or native
  Obsidian Desktop/Mobile validation was performed.
- `npm run lint` exited 0 with existing informational warnings, including the
  non-functional `useIndexOf` warning in the relationship browser test. The
  integration runner's expected negative-child diagnostic is not a product
  failure because the parent command exited 0.

## Review

2026-08-09 authoritative independent post-repair read-only review
`deleg_b9ae6245`: **PASS**. Canonical identity/write safety, name-only
presentation, plugin-owned listbox semantics, owning-document anchoring,
overflow, active-picker coordination, pointer/touch/keyboard/lifecycle cleanup
and no-write-before-Save behavior were all reviewed against the active specs.
No critical or significant product finding remains.

2026-08-09 second bounded independent review `deleg_25ea394d`: **CONCERNS** at
low severity for coverage/host boundaries only: real-browser ArrowUp/ArrowDown/
Enter/Escape coverage is incomplete, the duplicate-explicit-ID negative path
is covered at the form/write boundary rather than through the listbox UI, and
detached owner-document/real Obsidian-host probes are absent. The reviewer
found no runtime defect and confirmed the selectors and exercised branches are
not dead or straw assertions. These are explicitly accepted residual risks for
this bounded ticket; the follow-up owner is
`.10x/tickets/2026-08-09-relationship-picker-browser-coverage.md`.

Native Obsidian Mobile/WebView/IME geometry, assistive-technology output,
remote CI and release publication remain outside local evidence. The existing
controlled Chromium evidence must not be read as proof of those host surfaces.

## Retrospective

The final full-suite failure was contract drift in an existing prefill
assertion: the active picker contract intentionally exposes display names in
the input while canonical paths remain internal. Updating only that stale
presentation expectation restored the suite without weakening the identity or
Save-boundary assertions. The durable lesson is to audit visible value,
selection value and mutation payload separately. The picker replacement also
confirmed that a native `datalist` has no plugin-positionable DOM box; a
plugin-owned owning-document listbox is the smallest mechanism that satisfies
anchoring, while native-host behavior must remain an explicit evidence limit.
The remaining browser/host coverage gaps are owned by a separate open ticket,
not silently folded into this implementation closure.
