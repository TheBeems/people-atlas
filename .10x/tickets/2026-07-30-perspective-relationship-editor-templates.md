Status: done
Created: 2026-07-30
Updated: 2026-07-30

# Perspective-oriented relationship editor and templates

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-30-perspective-relationship-foundation.md`

## Scope

Implement
`.10x/specs/perspective-relationship-editor-templates.md` after the
direction-free foundation closes:

- make the shared global, selected-person and edit modal self-first when My
  person resolves;
- keep both endpoints editable and allow third-party relationships;
- preserve stored endpoint/role order during edit;
- replace Person A/B role jargon with My role or actual-name labels where
  available, with neutral fallback;
- use Relationship template terminology and explain the copy-not-live model;
- make templates own only types and paired endpoint roles;
- add the no-template state and in-form Create template route;
- preserve explicit detach/reapply/bulk-update behavior without hidden role
  swapping;
- organize the modal into People, Relationship, Context and Advanced;
- update affected controls in place so focus, scroll, values, paths and
  disclosure state remain stable;
- retain the existing explicit safe mutation and path-collision behavior.

This ticket is executable once its dependency is done and the user explicitly
authorizes implementation.

## Non-goals

- Reintroducing direction, arrows, source/target or Incoming/Outgoing text.
- Reordering existing endpoints to place My person first.
- Requiring My person in every relationship.
- Renaming stored `from`/`to`, role or template-provenance properties.
- Live/background template dependencies or automatic template application.
- Relationship note rename/move/delete, person merge or unresolved-link
  conversion.
- Relationship row Open/Edit actions, edge selection or new touch gestures.
- Contact moments, follow-up, status inference, profile fields or photos.
- Broad application localization.

## Acceptance criteria

- [x] One shared modal/form-state contract serves global create,
      selected-person create, active-note edit and the existing path-based
      edit seam.
- [x] With a uniquely resolved My person, global create prefills it first and
      selected-other create prefills My person first plus the selected person
      second.
- [x] Selecting My person itself prefills only the first endpoint.
- [x] Without a usable My person, global create is empty and selected-person
      create prefills only that selected person first.
- [x] Both endpoint selectors remain editable; saving a relationship between
      two people who are not My person is valid.
- [x] Edit never swaps endpoints or roles because My person or graph center
      changes.
- [x] Role labels use `My role` plus the counterpart's display name when
      applicable, otherwise actual selected names or neutral first/second
      labels, without making labels authoritative identity.
- [x] Dynamic labels and endpoint changes update in place without rebuilding
      the form or moving focus.
- [x] The form contains no direction control/value and exposes only the
      direction-free relationship fields.
- [x] People, Relationship, Context and Advanced appear in the specified
      order with semantic grouping and a validation-aware native disclosure.
- [x] A complete role/name preview makes the stored endpoint-role pairing
      reviewable before Save.
- [x] Ordinary UI/docs use Relationship template; literal
      `relationship_preset` appears only for configured storage or diagnostics.
- [x] Templates define/copy only types and first/second endpoint roles; apply
      never swaps roles implicitly.
- [x] No-template and zero-template states explain manual entry and
      copy-not-live behavior and expose Create template.
- [x] In-form template creation preserves all unsaved values and never
      auto-selects or applies the new template.
- [x] Apply/reapply changes only unsaved types and paired roles; detach removes
      only provenance and preserves copied values.
- [x] Missing/modified/current states and delete/update confirmations explain
      their exact copied-value consequences.
- [x] Bulk update still previews exact paths and before/after owned values,
      requires confirmation, rejects stale previews, preserves unrelated
      frontmatter, is idempotent and reports partial failure.
- [x] Create proposes an editable sanitized endpoint-name path and never
      overwrites or silently renames an existing note.
- [x] Edit retains its read-only source path; Save alone may write; cancel,
      Escape, close, template selection and preview remain write-free.
- [x] Invalid/failing saves keep complete form state and identify the failure;
      pending saves cannot submit twice.
- [x] Successful create/edit retains the existing open-note behavior.
- [x] Form/template changes preserve focus, scroll, manual path and Advanced
      state and reflow without horizontal scrolling at narrow widths.
- [x] Pure tests cover all prefill permutations, third-party save,
      endpoint-order preservation, labels, template mapping/ownership,
      detach/reapply/sync and form-to-mutation conversion.
- [x] Browser/integration tests cover empty/create template flows, dynamic
      labels, focus, disclosure validation, narrow layout, cancel/failure/
      success and standalone/Bases entrypoint parity.
- [x] Existing relationship mutation, role-pair, identity, template-sync,
      renderer, touch and high-DPI protections remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/main.ts`
- `src/settings/relationship-presets.ts`
- `src/settings/relationship-preset-modal.ts`
- `src/settings/relationship-preset-sync.ts`
- `src/settings/relationship-preset-sync-modal.ts`
- `src/settings/settings-tab.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `styles.css`
- `test/relationship-form.test.ts`
- `test/relationship-presets.test.ts`
- `test/relationship-preset-bulk-sync.test.ts`
- relationship entrypoint, integration and browser modal tests
- `README.md` and `README.nl.md`

Exact helper and CSS class names may follow current repository conventions
without changing the governing contract.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/tickets/2026-07-30-perspective-relationship-foundation.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: the common create workflow starts with My person but never
  requires it.
- User-ratified: stored endpoint order and roles are never changed
  automatically.
- User-ratified: actual names/My role are presentation labels; canonical IDs
  and paths remain identity authority.
- User-ratified: Relationship template is the user term and
  `relationship_preset` remains copied-value provenance rather than a live
  dependency.
- Record-backed: the shared relationship modal, mutation service and
  stale-safe bulk synchronization remain the only supported write paths.
- Record-backed: the foundation ticket removes direction and establishes
  `myPersonId` before this ticket changes editor/template behavior.

## Journal

- 2026-07-30: User ratified self-first/non-self-only defaults, stable endpoint
  roles and neutral fallback.
- 2026-07-30: Replacement editor/template spec activated. The previous
  direction-bearing UX2 ticket was cancelled before implementation.
- 2026-07-30: Ticket opened without semantic blockers and made dependent on
  the direction-free foundation. No product code, test, build or generated
  artifact was changed or run during shaping.
- 2026-07-30: The user authorized the staged preflight and UX1 through UX7
  implementation program. UX2 started only after UX1 closed.
- 2026-07-30: Implemented one self-first shared form, fixed edit ordering,
  actual-person role labels, in-place template states/creation, grouped
  semantic sections and copy-only bulk synchronization.
- 2026-07-30: Fresh adversarial review drove live endpoint revalidation,
  early read-only entrypoints, missing-template resynchronization and a
  serialized live-frontmatter compare/apply boundary.
- 2026-07-30: Follow-up review hardened index-lag idempotency, live note-type
  revalidation and a sentinel-aborted zero-write host boundary before closure.
- 2026-07-30: Closed after the final source state passed the full automated
  gate and the independent reviewer reported no findings.

## Blockers

None beyond the explicit completed-ticket dependency above. After that
dependency closes, this ticket requires implementation authorization.

## Evidence

- `test/relationship-form.test.ts` covers every self-first fallback,
  third-party create, fixed edit ordering, live canonical endpoint checks,
  dynamic labels and changed-field mutation mapping.
- `test/browser/relationship-modal.browser.test.ts` covers the four semantic
  sections, disclosure validation, in-place focus/state preservation,
  missing/create/apply/detach/reapply flows, narrow layout and failure/success.
- `test/relationship-preset-bulk-sync.test.ts` and
  `test/mutation-service.test.ts` cover exact previews, partial failure,
  unrelated-data preservation, live stale rejection, index-lag retries,
  live type changes and sentinel-aborted zero host commits.
- `test/relationship-entrypoints.test.ts` and the controlled integration test
  cover read-only refusal plus identical standalone/Bases self-first prefill.
- Final full gate: `npm run test` passed 41 files / 441 tests.
  `npm run build`, `npm run format:check`, `npm run lint` and
  `git diff --check` passed; Git reported only line-ending conversion
  warnings.

## Review

Fresh independent review verdict: no findings; UX2 is closable. Review
explicitly rechecked all seven initial findings and the later index-lag,
live-note-type and host-level zero-write regressions against transactionally
modeled tests.

## Retrospective

A stale-safe bulk preview needs more than an index comparison: eligibility,
before/after recognition and the actual write must share one serialized live
frontmatter callback. Idempotent retries also require aborting the host write
API, not merely returning from an unchanged callback, because no no-save
guarantee exists at that boundary. Form snapshots are similarly unsuitable
as final endpoint authority; revalidate changed identities immediately before
mutation while allowing untouched historical unresolved values to survive.
