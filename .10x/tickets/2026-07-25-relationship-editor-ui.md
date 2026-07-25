Status: done
Created: 2026-07-25
Updated: 2026-07-25

# P3b — Relationship editor user interface

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`,
`.10x/tickets/2026-07-25-mutation-identity-serialization.md`

## Scope

Implement `.10x/specs/relationship-editor-ui.md` as the smallest complete
user-facing relationship create/edit workflow:

- one shared Obsidian modal and form-state boundary;
- global create and active-relationship edit commands;
- selected-person create actions in standalone and Bases;
- canonical person selection and configured relationship fields;
- reviewable `People/Relationships/` path proposal;
- explicit save/cancel, safe error handling and specified post-save behavior.

This ticket is executable. Implementation has not started in this shaping turn.

## Non-goals

- Renaming or moving existing relationship notes.
- Creating people from the relationship form.
- Merge, unresolved-link conversion or bulk editing.
- Edge selection, context menus, mobile gestures or P5 renderer redesign.
- Relationship history, automatic status inference or suggestions.

## Acceptance criteria

- [x] One shared Obsidian modal maps create and edit form state to the existing
      `AtlasMutationService`; no second write path is introduced.
- [x] `Create relationship` opens globally with blank endpoints.
- [x] A resolved selected person in standalone and Bases exposes a create
      action that prefills Person A; ghosts and ambiguous nodes are excluded.
- [x] `Edit current relationship` loads the active canonical relationship and
      refuses other active files without writing.
- [x] Canonical person selectors and every existing supported relationship
      field use configured properties and preserve optional/manual semantics.
- [x] Create proposes an editable
      `People/Relationships/<Person A> - <Person B>.md` path using safe
      filename components.
- [x] Existing destinations are never overwritten, auto-renamed or assigned an
      implicit suffix; edit paths are read-only.
- [x] Only explicit `Save` writes. Cancel, Escape and modal close are
      write-free, and pending submission is single-flight.
- [x] Invalid or failed saves retain entered values, keep the modal open,
      surface the reason and cause no partial mutation.
- [x] Successful create opens the new note; successful edit closes on the
      existing relationship note.
- [x] Controls have associated labels, logical focus order and modal-owned
      focus without assuming the global `window`.
- [x] Focused regressions cover path proposal/sanitization, entrypoint state,
      create/edit mapping, cancellation, validation/failure, double submit and
      success behavior.
- [x] Existing mutation, graph, projection and view-state regressions remain
      passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## References

- `.10x/specs/relationship-editor-ui.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-25-mutation-identity-serialization.md`
- `.10x/tickets/2026-07-25-audit-remediation-plan.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/main.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/mutations/validation.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `src/render/atlas-renderer.ts`

## Assumptions

- Record-backed: `AtlasMutationService` is the sole supported relationship
  write boundary and already owns validation, collision rejection,
  preservation of unrelated content and write serialization.
- Record-backed: canonical indexed person paths/IDs identify endpoints;
  display names are presentation only.
- Record-backed: parallel relationship entities are valid, so a path collision
  must be rejected for explicit resolution rather than silently collapsed.
- Record-backed: relationship status is optional and manual; `last_contact`
  never infers status.
- User-ratified: create and edit share one Obsidian form and only explicit
  `Save` writes.
- User-ratified: create is available globally and from a selected person; the
  selected person prefills Person A in standalone and Bases.
- User-ratified: new notes default to
  `People/Relationships/<Person A> - <Person B>.md`.
- User-ratified: edit targets the active relationship note.
- User-ratified: cancellation is write-free, failures retain the form,
  successful create opens the new note and successful edit stays on the
  existing note.
- Mechanical: exact command IDs, component filenames and internal form-state
  representation may follow repository conventions without changing this
  contract.

## Journal

- 2026-07-25: Post-P4 audit confirmed that the mutation service is a safe
  foundation but not a complete relationship workflow.
- 2026-07-25: Source inspection found one global atlas command, node-selection
  callbacks and standalone selection details, but no relationship modal,
  relationship commands or selected-person mutation actions.
- 2026-07-25: The user ratified one shared modal, global and selected-person
  create entrypoints, active-note editing, the
  `People/Relationships/<Person A> - <Person B>.md` storage convention,
  explicit save/cancel behavior and post-save navigation.
- 2026-07-25: The governing spec was activated and this bounded ticket was
  opened. Per 10x separation, implementation is deferred to a later explicitly
  authorized turn.
- 2026-07-25: The user explicitly authorized implementation. Execution started
  after rereading the governing relationship-editor and safe-mutation specs,
  canonical graph decision and ticket references.
- 2026-07-25: Added the focused form/session regression contract first.
  Baseline `npx vitest run test/relationship-form.test.ts` failed before
  collection because `src/editor/relationship-form.ts` did not exist, proving
  the new form-state and single-flight boundary were absent.
- 2026-07-25: Added a pure relationship form/session boundary for canonical
  endpoint mapping, safe path proposal, create payloads, changed-field-only
  updates, cancellation, retryable failures and single-flight submission.
- 2026-07-25: Added one Obsidian-owned modal with native labelled controls,
  searchable canonical-person datalists, editable create/read-only edit paths,
  explicit Save/Cancel, inline persistent errors and post-create navigation.
  Registered global create and active-relationship edit commands.
- 2026-07-25: Added resolved-person create actions to standalone selection
  details and a Bases selection overlay. Bases checks the canonical index
  before exposing the action, so Base-only/display-name records are not
  guessed into mutation endpoints.
- 2026-07-25: Adversarial review found that submitting an unchanged edit would
  still invoke `processFrontMatter()`. The session now treats an empty update
  diff as a successful no-op, with a regression proving the relationship note
  is not rewritten.
- 2026-07-25: Added entrypoint regressions for blank global create, canonical
  selected-person prefill, stale-path refusal, no-active-relationship refusal
  and explicit-ID edit initialization. Focused verification passed 15/15.
- 2026-07-25: Final repository verification passed: `npm run test` reported
  17 test files and 71 tests, `npm run build` completed TypeScript no-emit and
  production esbuild, and `git diff --check` reported no whitespace errors.
  Existing Windows LF/CRLF conversion warnings remain informational.

## Blockers

None.

## Evidence

- `src/editor/relationship-form.ts` owns the pure form values, canonical
  endpoint conversion, safe path proposal, minimal edit diffs and
  single-flight mutation session.
- `src/editor/relationship-modal.ts` is the single create/edit Obsidian modal;
  it uses the owning document, labelled native controls and the existing
  `AtlasMutationService`.
- `src/main.ts` registers the two commands, validates selected/active canonical
  records and opens the shared modal.
- `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` expose selected-person create actions;
  the Bases action requires canonical index ownership.
- `test/relationship-form.test.ts`: 11 tests cover path sanitization, canonical
  mapping, edit diffs, unresolved input, cancel, create/edit routing, no-op
  edit, retry and duplicate submission.
- `test/relationship-entrypoints.test.ts`: 4 tests cover global, selected and
  active-note entrypoints.
- `npm run test`: 17 files, 71 tests passed.
- `npm run build`: TypeScript no-emit and production esbuild passed.
- `git diff --check`: passed; only existing line-ending conversion warnings.

## Review

Verdict: pass.

The adversarial pass checked every normative scenario against source and test
assertions: one mutation boundary, canonical endpoint paths instead of display
identity, collision delegation to the existing no-overwrite service, explicit
save/cancel behavior, error retention, single-flight submission, configured
field preservation, owning-document DOM use and both view adapters.

One significant pre-closure finding was repaired: unchanged edits originally
would have called the mutation service with an empty update and rewritten
frontmatter. The final implementation skips that write and has a focused
regression. No critical or significant finding remains.

Residual risk: the Node harness does not render a real Obsidian `Modal` or
native `datalist`, and does not exercise actual desktop/mobile focus,
Command Palette registration, Bases selection lifecycle, pop-out windows or
post-create navigation. Those require live Obsidian/browser coverage and
remain owned by the P5/P7 interaction and integration gates.

## Retrospective

Keeping form transformation and submission independent of Obsidian DOM made
the consequential behavior testable without introducing a browser dependency.
The selected-person surface appropriately differs between standalone and Bases
because only the former already had a details sidebar; sharing the modal and
plugin entrypoint preserved DRY without forcing a premature renderer action
abstraction. The review reinforced that changed-field-only mapping is not
enough by itself: the session must also avoid calling the write boundary when
the resulting diff is empty.
