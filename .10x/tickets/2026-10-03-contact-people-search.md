Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: `.10x/tickets/2026-10-03-audit-remediation.md`

# Searchable contact-moment people selection

## Scope

Add native search to explicit contact-moment multi-person selection. Preserve
the existing form/mutation contract and exact identity for same-name people.

## Non-goals

No inferred participants, storage changes, new person creation, third-party
widget framework or automatic writes while searching/selecting.

## Acceptance criteria

- People can be found by display label or disambiguating path; labels remain
  presentation and selection stores canonical paths/IDs.
- Multiple selections survive filtering, clearing and repeated search.
- Selected people stay inspectable/removable independently of the search.
- Native keyboard-accessible controls, visible labels and NL/EN copy support
  both create/edit, prefill and no-result states.
- Current relationship choices/proposed path refresh on explicit participant
  changes, not just filtering. Cancel/Escape write nothing.
- Browser regressions cover selection persistence and same-name candidates.

## References

- `.10x/specs/contact-moments-follow-up.md` clauses 26-35
- `.10x/specs/accessible-semantic-renderer.md`

## Assumptions

User-ratified: searchable multi-person choice. Existing field/mutation semantics
remain unchanged; a native search plus checkbox list is a mechanical UI choice.

## Journal

- 2026-10-03: Opened after approved audit recommendation.
- 2026-10-03: Read contact-moment form/write contracts and semantic accessibility
  spec. UI executor released locale/CSS ownership. Added focused browser
  regressions for same-name canonical choices, search persistence, selected
  removal, relationship/path refresh, edit prefill and keyboard selection.
- 2026-10-03 RED: Real Vitest Browser/installed Edge run: two new tests failed
  (searchbox absent; checkbox prefill absent), seven existing tests passed.
- 2026-10-03: Replaced native multi-select with labelled search, explicit
  checkboxes and a separate removable selected-person list. Canonical paths
  remain selection values; duplicate names show their note paths. Search
  changes only result visibility and Enter does not submit. Explicit selection
  changes retain existing sorted selection order and dependent refresh rules.
- 2026-10-03: Remove actions recover focus; partial-success locks the new remove
  controls alongside all inputs, preserving the existing retry-only boundary.
- 2026-10-03: Independent reviewer inspected the picker, unchanged form/session
  boundary, locale copy, browser assertions and responsive CSS. Requested the
  narrow/coarse-pointer 44px rule also cover the newly added checkbox labels and
  remove buttons; executor applied this before the source freeze. No other
  concrete in-scope defect was found.
- 2026-10-03 GREEN: Final focused native Vitest run passed 10 browser tests in
  installed Edge and 16 Node tests across form, entrypoint and locale suites.
  Targeted Biome lint passed for all four changed TypeScript files. Product
  sources frozen for the root's integrated gate.
- 2026-10-03: Actual-source synthetic browser capture at 390x844 verified two
  selected people remain visible under an Alice filter, duplicate names show
  paths, new interactive targets measure 44px and no horizontal overflow or
  mutation occurs. Executor visually inspected the Dutch screenshot and sent
  it to the root for a second look.

## Blockers

None for this scope. Locale/CSS ownership was coordinated, independent review
passed, and the parent-owned full test/build gates passed on 2026-10-03. Native
Obsidian testing remains unavailable because Computer Use fails before host
contact.

## Evidence

- Browser regression command (with `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge`):
  `npx --no-install vitest run --project browser --no-file-parallelism test/browser/contact-moment-modal.browser.test.ts`
  — **10/10 passed**, 1 file. Covers path identity, same-name candidates,
  selection persistence, relationship/proposed-path dependencies, required
  selection, native checkbox keyboard input, edit prefill, remove focus,
  search Enter suppression, cancellation and partial-success controls.
- Node regression command:
  `npx --no-install vitest run --project node test/contact-moment-form.test.ts test/contact-moment-entrypoints.test.ts test/i18n.test.ts`
  — **16/16 passed**, 3 files.
- `npx --no-install biome lint src/editor/contact-moment-modal.ts src/i18n/en.ts src/i18n/nl.ts test/browser/contact-moment-modal.browser.test.ts`
  — **PASS**, 4 files; targeted formatting completed.
- Synthetic installed Edge 154.0.4258.48 loaded actual `ContactMomentModal`, the
  controlled Obsidian stub and project CSS with fixture theme variables. The
  capture uses a 390x844 viewport, Dutch locale, two selections and a live
  `Alice` filter. Assertions passed: both candidate labels and both remove
  buttons are 44px high; document/body scroll width equals the 390px viewport;
  mutation call count is zero and no browser errors occurred.
- Local ignored evidence:
  `.vitest-attachments/audit-2026-10-02/contact-picker-screenshot.mjs`,
  `contact-picker-results.json` and `contact-picker-nl-390.png`. Executor
  inspected the screenshot: selected names/removal actions, filter results and
  disambiguating paths are readable with no clipped horizontal content.
- This proves controlled browser behavior only, not native Obsidian theme,
  modal Escape handling or real-vault behavior. No vault was changed. Root's
  full `npm run test` and `npm run build` gate is recorded at the parent.

## Review

- 2026-10-03 — Independent review by `data_review`: **PASS**. No critical,
  significant or minor finding remains in the reviewed delta.
- Selection uses canonical file paths; equal display names are disambiguated
  by path and never become identity. Existing context and submit validation
  retain the canonical ID/path mutation contract. Filtering only rebuilds
  candidate rows; it does not alter selection, refresh dependent values or
  submit the form. The selected list remains independently removable.
- Native labelled checkboxes retain keyboard behavior and checked state;
  removing a focused selection returns focus to another remove action or the
  search input. Create/edit prefill, required-person validity and NL/EN text
  are covered by the reviewed assertions. Partial success disables candidate,
  search and remove controls while retaining the existing retry-only boundary.
- Existing sorting and explicit participant-change refresh behavior remain
  intact. The new controls use the owning document and the current modal
  lifecycle. Narrow/coarse CSS now includes their 44px targets.
- Evidence inspected: source/test diff and executor's reported real Edge
  10/10 browser pass plus focused lint pass. Executor tests were not repeated
  by the reviewer. Root's canonical full gate and executor's final 390px
  computed-layout capture are recorded separately when complete.
- Residual boundary: controlled browser behavior does not establish native
  Obsidian Desktop/Mobile theme, pop-out or host Escape behavior. No real vault
  writes were performed for this review; no native-host completion is claimed.

## Retrospective

The selected list is independent of filtered candidates, so a search cannot
silently discard participants. Native inputs/buttons keep the interaction
small and preserve existing canonical form values. Search validity and the
partial-success lock must include all new controls; the regressions now cover
those boundaries. A computed narrow-viewport capture complemented the browser
behavior suite and caught the need to include new controls in the shared 44px
touch-target rule. Native host validation remains a separate evidence boundary.
