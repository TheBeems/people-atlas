Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX1 — Direct relationship context actions

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-25-relationship-editor-ui.md`,
`.10x/tickets/2026-07-26-accessible-semantic-renderer.md`,
`.10x/tickets/2026-07-26-mobile-touch-interaction.md`,
`.10x/tickets/2026-07-30-perspective-relationship-foundation.md`

## Scope

Implement `.10x/specs/relationship-context-actions.md` as the first bounded
discoverability repair:

- retain structured `AtlasEdge` identity while rendering incident rows;
- expose row-specific Open/Edit actions only for canonical note-backed
  relationships;
- use one new path-based plugin edit entrypoint that reuses the existing
  `RelationshipModal`;
- wire identical capabilities through standalone and Bases adapters;
- cover semantic details and the existing graph/mobile details sheet;
- handle inferred, parallel and stale rows without guessing.

The user authorized implementation of preflight plus UX1 through UX7 in one
staged program. UX1 was implemented only after UX0 closed.

## Non-goals

- Canvas-edge selection, edge focus, context menus or new touch gestures.
- Inline editing, relationship delete/rename/move or bulk changes.
- Converting a simple linked-person edge into a relationship.
- Relationship-template/form restructuring.
- Contact-moment actions.

## Acceptance criteria

- [x] Relationship descriptions are rendered from structured row models that
      preserve edge ID, file path, counterpart and metadata.
- [x] Canonical non-inferred rows show native
      `Open relationship note` and `Edit relationship` buttons in semantic
      details and the graph details sheet.
- [x] Inferred contact edges are labelled `Linked person` and expose no
      relationship-note action.
- [x] Parallel relationship notes produce separate rows and each action
      targets the exact file represented by its edge.
- [x] A path-based `openEditRelationship(path)`-style entrypoint revalidates
      the canonical relationship/current `TFile`, reads current configured
      values and opens the existing shared modal.
- [x] `Edit current relationship` delegates to the same path-based entrypoint
      after active-note resolution.
- [x] Standalone and Bases adapters use equivalent capability checks and
      never infer identity from a Base/display label.
- [x] Deleted, renamed, stale or non-canonical relationship paths fail with a
      recoverable notice and no write/navigation to the wrong note.
- [x] Row-specific accessible names distinguish parallel rows; keyboard,
      pointer and touch activation preserve logical focus and selection.
- [x] Renderer listeners and any modal-return focus use the owning
      Document/Window and are cleaned on destroy.
- [x] Pure tests cover row modeling, inferred eligibility, parallel edge
      identity and stale capability transitions.
- [x] Browser/integration tests cover list/details-sheet activation,
      standalone/Bases callbacks, active-command delegation and no mutation
      before modal Save.
- [x] Existing relationship-form, renderer, touch and multi-DPR tests remain
      passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/render/atlas-renderer.ts`: structured incident rows/buttons.
- `src/main.ts`: path-based relationship open/edit entrypoint.
- `src/view/people-atlas-view.ts`: canonical capability callbacks.
- `src/bases/people-atlas-bases-view.ts`: canonical capability callbacks.
- `test/relationship-entrypoints.test.ts`: path revalidation/delegation.
- `test/browser/atlas-renderer.browser.test.ts`: row action/focus behavior.

Exact filenames or helper names may follow current repository conventions
without changing the governing contract.

## References

- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- Record-backed: `AtlasEdge.filePath` identifies real relationship notes;
  inferred contact-link edges have no relationship-note mutation target.
- Record-backed: the shared relationship modal and `AtlasMutationService`
  remain the only supported edit/write path.
- User-ratified: actions live on note-backed relationship rows and graph-edge
  selection is deferred.
- Mechanical: opening a relationship uses a normal workspace leaf and does
  not change graph center/layout.

## Blockers

None known. Stop and record a blocker if current renderer structure cannot
retain stable edge/path identity without changing `AtlasSnapshot`, or if Bases
cannot revalidate a relationship against the canonical index.

## Journal

- 2026-07-30: User ratified direct row actions without edge selection.
- 2026-07-30: Governing spec activated and ticket opened for later explicit
  implementation. No product code or tests were changed/run.
- 2026-07-30: Added structured relationship rows and exact Open/Edit
  capabilities to semantic details and the graph/mobile sheet. Standalone and
  Bases delegate through one path-based canonical resolver and the existing
  modal/mutation path.
- 2026-07-30: Fresh adversarial review found and repaired duplicate
  relationship-ID ambiguity, ambiguous-counterpart labeling and dialog focus
  return for both normal and touch/long-press sheet invocation.
- 2026-07-30: Closed after the final source state passed all focused and full
  automated gates.

## Evidence

- `test/relationship-rows.test.ts`,
  `test/relationship-entrypoints.test.ts` and
  `test/relationship-action-adapters.test.ts` cover structured identity,
  parallel/inferred/stale cases, canonical revalidation and adapter parity.
- `test/browser/atlas-renderer.browser.test.ts` covers semantic and sheet
  actions, accessible names, exact invokers, async modal handoff and
  long-press focus behavior.
- Final focused node gate: 3 files, 18 tests passed.
- Final full gate: `npm run test` passed 39 files / 392 tests;
  `npm run build`, `npm run format:check`, `npm run lint` and
  `git diff --check` passed. Git reported only line-ending conversion
  warnings.

## Review

Fresh independent review verdict: no remaining UX1 findings. The review
explicitly rechecked the three repaired findings above and required the final
full gate after the last focus regression.

## Retrospective

Canonical eligibility must be revalidated by both path and unique relationship
ID at action time. Native modal focus restoration also depends on the element
focused before `showModal()`, which can differ from the logical touch invoker;
capturing and temporarily suppressing that exact return target keeps the row
button as the modal handoff focus without global-window assumptions.
