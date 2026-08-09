Status: active
Created: 2026-08-09
Updated: 2026-08-09
Owner: People Atlas architecture-refactor workstream — entrypoint/editor decomposition

# Entrypoint and editor decomposition without write-boundary drift

Parent: `.10x/tickets/2026-08-09-architecture-decomposition.md`
Depends-On: `.10x/tickets/2026-08-09-mutation-service-decomposition.md`

## Scope

Refactor the orchestration concentration in `src/main.ts` and the large
person, relationship and contact-moment editor modals into typed, independently
testable entrypoint/form/presentation seams. Keep the current plugin entrypoint
and modal classes as stable façades for views, commands, context actions and
tests.

The intended `main.ts` seams are:

- canonical person, relationship and contact-moment resolution/revalidation;
- person, relationship and contact-moment entrypoint/action adapters;
- note-context action routing;
- My-person and view-state/settings orchestration;
- user-facing diagnostic/notice dispatch at the existing i18n boundary;
- a small plugin façade that wires these capabilities without owning all
  domain logic in one class.

The intended editor seams are:

- **person editor** — form state/presentation, profile fields, birth-date and
  linked-people controls, photo picker/preview, rename/path flow, validation,
  submit and focus/lifecycle handling;
- **relationship editor** — form state/presentation, canonical person picker,
  simple relationship/template state, advanced-field disclosure, validation,
  submit and focus/lifecycle handling;
- **contact-moment editor** — form state/presentation, canonical people and
  relationship choices, proposed-path handling, validation, submit, declared
  partial-success and retry flow;
- the existing small partner/parent confirmation modal remains a focused modal
  and is not split speculatively.

The child follows the mutation-service child so all entrypoints and editors can
continue to consume the stable `AtlasMutationService` façade. Renderer internals
remain out of scope; renderer action callbacks continue to route through the
existing view/plugin boundaries.

## Non-goals

- No change to public plugin commands, view/Bases callbacks, modal constructors,
  modal modes or current entrypoint method names/signatures.
- No change to Save/Cancel/Escape/close semantics, no-write-before-Save,
  canonical revalidation, stale-row safety, partial-success/retry behavior or
  lifecycle cleanup.
- No new form UX, field, migration, storage property, relationship inference,
  notification, external sync or generic form/modal framework.
- No replacement of the shared mutation service with direct vault writes.
- No change to i18n catalog ownership or user-facing terminology. Existing
  `partner` and `ouder`/parent language remains authoritative; do not introduce
  `co-parent`.
- No speculative split of already-small modules or partner-parent modal merely
  to reduce file count.

## Acceptance Criteria

- [ ] `main.ts` becomes a small typed orchestration façade; person,
      relationship, contact-moment, note-context, My-person and view-state
      responsibilities have explicit owners with no duplicated canonical
      resolution rules.
- [ ] Existing public plugin entrypoints and view/Bases callback behavior remain
      equivalent, including path revalidation immediately before open/edit/
      follow-up actions and the existing write-disabled notices.
- [ ] Person, relationship and contact-moment modal classes retain equivalent
      public constructors/modes and delegate to focused form/presentation or
      action seams without changing visible behavior.
- [ ] Person photo selection/preview/fallback, profile validation, rename/path
      confirmation and focus recovery remain lifecycle-safe and write only via
      explicit Save through the mutation façade.
- [ ] Relationship endpoint identity, duplicate/stale selection rejection,
      simple relationship/template synchronization, advanced-field behavior and
      Save/Cancel semantics remain unchanged.
- [ ] Contact-moment canonical target choices, proposed path, optional
      monotonic `last_contact` advancement, declared partial success and
      stale-safe retry remain unchanged.
- [ ] User-facing diagnostics still cross the existing typed EN/NL catalog
      boundary; no raw new English diagnostic sink is introduced.
- [ ] Existing entrypoint, modal browser, integration, profile, relationship,
      contact-moment and i18n tests remain passing. Focused tests cover each
      extracted seam without replacing real browser interaction with synthetic
      assertions where the active spec requires Chromium.
- [ ] At minimum the relevant suites include `test/person-entrypoints.test.ts`,
      `test/relationship-entrypoints.test.ts`,
      `test/contact-moment-entrypoints.test.ts`,
      `test/browser/person-modal.browser.test.ts`,
      `test/browser/relationship-modal.browser.test.ts`,
      `test/browser/contact-moment-modal.browser.test.ts`,
      `test/integration/note-context-actions.integration.test.ts`,
      `test/integration/contact-moment-entrypoints.integration.test.ts`,
      `test/integration/person-profile.integration.test.ts` and
      `test/i18n.test.ts`.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass for the final
      child state.

## References

- `.10x/tickets/2026-08-09-architecture-decomposition.md`
- `.10x/tickets/2026-08-09-mutation-service-decomposition.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/multilingual-user-interface.md`
- `.10x/specs/partner-parent-confirmation.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/main.ts`
- `src/editor/person-modal.ts`
- `src/editor/relationship-modal.ts`
- `src/editor/contact-moment-modal.ts`
- `src/editor/partner-parent-confirmation-modal.ts`
- `src/editor/person-form.ts`
- `src/editor/relationship-form.ts`
- `src/editor/contact-moment-form.ts`
- `src/i18n/en.ts`
- `src/i18n/nl.ts`

## Assumptions

- User-ratified on 2026-08-09: main/editor decomposition is the third child of
  the architecture parent and must preserve behavior, public entrypoints and
  existing tests.
- Record-backed: the active mutation, relationship-editor, person-profile,
  contact-moment, context-action and multilingual specs define the behavior to
  preserve.
- Record-backed: the mutation-service façade remains the only supported write
  route; this child depends on its decomposition only for internal delegation,
  not for a public API change.
- Mechanical: exact adapter/form/presentation filenames may follow the smallest
  safe repository-consistent seam.

## Journal

- 2026-08-09: Source inventory measured `src/main.ts` at 34,734 bytes,
  `src/editor/person-modal.ts` at 41,788 bytes,
  `src/editor/relationship-modal.ts` at 39,578 bytes and
  `src/editor/contact-moment-modal.ts` at 22,312 bytes.
- 2026-08-09: Source declaration inventory confirmed that `main.ts` combines
  settings/view-state, My-person, canonical resolution, note-context actions,
  person/relationship/contact entrypoints and notices; the large modals combine
  form construction, presentation refresh, validation, submit and lifecycle
  handling.
- 2026-08-09: The entrypoint/editor boundary was recorded as a separate child
  after the mutation service, with the small partner-parent modal explicitly
  excluded from speculative splitting. No source or test change was made while
  opening this ticket.
- 2026-08-09: Implemented canonical entrypoint resolution,
  `RelationshipPersonPicker` and `PersonPhotoPicker`; `PersonModal` now
  delegates photo selection, resolution, preview, fallback, listeners,
  cleanup and save-time validation to the picker. The broader `main.ts` and
  contact-moment-modal decomposition remains incomplete and is not claimed as
  closed here.

## Blockers

None known for shaping. Stop before implementation if preserving public
entrypoints, explicit Save semantics, canonical revalidation, i18n boundaries or
modal lifecycle behavior requires a product-contract change.

## Evidence

- Historical source-inventory baseline: `stat` on 2026-08-09 reported the
  file sizes recorded in the Journal before the implementation slice.
- Source declaration inventory identified the current main/modal responsibility
  clusters and the existing form modules available for reuse.
- Relevant unit, browser, integration and i18n test files exist in the current
  worktree.
- Historical record-authoring note: no implementation, focused test, build or
  full gate ran while opening this record.
- 2026-08-09 current evidence under Node v24.19.0: canonical-resolution,
  relationship-picker, person-form (63 tests), person-modal browser (66 tests),
  relationship-modal, contact-moment, integration, full test (56 files/971
  tests) and production build pass. The authoritative independent review is
  **PASS** for the implemented photo-focused slice; it confirms typed photo
  validation, canonical dossier safety, root-drift fallback preservation and
  no duplicate photo owner. The broader `main.ts` and `contact-moment-modal`
  decomposition remains active follow-up scope and is not claimed closed.

## Review

2026-08-09 authoritative independent read-only implementation review: **PASS**
for the implemented photo-focused slice. No critical or significant
implementation finding remains. The broader entrypoint/editor acceptance scope
is intentionally still active and requires a later bounded follow-up.

## Retrospective

Pending until execution. Capture whether typed ports reduced coupling without
creating a framework, whether modal focus/async cleanup stayed local, and any
remaining concentration that deserves a separate bounded ticket.
