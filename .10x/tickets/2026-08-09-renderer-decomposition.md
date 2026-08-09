Status: active
Created: 2026-08-09
Updated: 2026-08-09
Owner: People Atlas architecture-refactor workstream — renderer decomposition

# Renderer decomposition without behavioral drift

Parent: `.10x/tickets/2026-08-09-architecture-decomposition.md`
Depends-On: None beyond the active renderer, projection, contact-moment and
performance contracts listed below.

## Scope

Refactor `src/render/atlas-renderer.ts` into independently testable
responsibility boundaries while keeping `AtlasRenderer` as the stable public
orchestration façade.

The proposed seams are:

- **`GraphCanvasSurface`** — canvas ownership, resize/high-DPI sizing, camera
  drawing, visible node/edge painting, draw scheduling and canvas-owned photo
  admission/resource coordination;
- **`GraphInteractionController`** — mouse, pen, pointer capture, wheel,
  keyboard, touch gestures, pan/zoom, node selection, long-press and interaction
  teardown;
- **`SemanticPeopleList`** — Graph/List surface state, snapshot-order people
  buttons, roving focus, keyboard navigation and list selection provenance;
- **`PersonDetailsPanel`** — selected-person profile/actions, selected contact
  history and focus recovery for person-level details;
- **`RelationshipDetailsPanel`** — incident relationship rows, relative-role or
  neutral descriptions, relationship actions and canonical action focus;
- **`FollowUpPanel`** — local-day follow-up grouping, contact-moment actions,
  busy/retry state and follow-up focus recovery;
- **small `AtlasRenderer` façade** — shared snapshot/mode/selection state,
  component composition, callback delegation, layout/photo-cache ownership and
  complete lifecycle coordination.

Existing pure helpers and already-separated resources such as layout, camera,
touch-gesture, relationship-row, contact-moment-presentation, profile and
photo-thumbnail-cache modules should be reused. Do not create a generic
renderer framework or duplicate those contracts merely to reduce line count.

The façade MUST retain the existing constructor/callback boundary and public
methods used by views, Bases adapters, performance characterization and tests,
including graph replacement, follow-up activation, fit/layout snapshot,
photo-cache statistics, focus restoration and `destroy()` behavior.

## Non-goals

- No change to Graph/List/Follow-ups behavior, selection provenance, stable
  `NodeId` identity, projection/layout persistence or relationship semantics.
- No new clustering, import/export, timeline, force simulation, Worker or
  renderer mode.
- No vault reads, frontmatter parsing, mutation calls or canonical-index lookup
  in a renderer component.
- No change to Open/Center/Create relationship or contact/follow-up capability
  ownership in standalone/Bases adapters.
- No replacement of real Chromium browser tests with Node DOM simulation or
  claims about live Obsidian Desktop/Mobile behavior.
- No visual redesign, copy change, dependency or public API break.

## Acceptance Criteria

- [ ] `AtlasRenderer` remains the stable façade for current standalone and Bases
      call sites; its public constructor, callback types and externally used
      methods retain equivalent signatures and semantics.
- [ ] Canvas drawing, sizing, camera/animation-frame scheduling and canvas photo
      admission are isolated from semantic DOM rendering and interaction logic.
- [ ] Pointer, pen, wheel, keyboard, touch, pointer-capture, drag/pan/zoom and
      long-press state have one explicit interaction owner with lifecycle-safe
      teardown and unchanged selection provenance.
- [ ] Semantic people-list rendering and roving-focus behavior have one owner;
      list selection remains stable-ID based and does not recenter the graph.
- [ ] Person details, relationship details and follow-up surfaces have separate
      owners with typed inputs/callbacks; parallel edges, canonical action
      revalidation, contact-moment stale safety and focus recovery remain
      unchanged.
- [ ] The owning `Document`/`Window`, resize observer, animation frames, timers,
      pointer capture, image resources and DOM listeners are released exactly
      once by `destroy()`, including late async photo completion and follow-up
      day refresh callbacks.
- [ ] No renderer module reads vault data or imports an Obsidian API that was
      not already part of the existing renderer boundary.
- [ ] Existing browser and matrix coverage remains intact and focused tests
      exercise each new seam without weakening assertions. At minimum the
      relevant suites include `test/browser/atlas-renderer.browser.test.ts`,
      `test/browser-matrix/atlas-renderer.browser-matrix.test.ts`,
      `test/relationship-action-adapters.test.ts`,
      `test/contact-moment-presentation.test.ts` and
      `test/person-photo-thumbnail-cache.test.ts`.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass for the final
      child state.

## References

- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/high-dpi-popup-browser-matrix.md`
- `.10x/specs/performance-characterization.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/render/atlas-renderer.ts`
- `src/render/camera.ts`
- `src/render/touch-gesture.ts`
- `src/render/layout-state.ts`
- `src/render/relationship-rows.ts`
- `src/render/contact-moment-presentation.ts`
- `src/render/person-profile.ts`
- `src/render/person-photo-thumbnail-cache.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `test/browser-matrix/atlas-renderer.browser-matrix.test.ts`

## Assumptions

- User-ratified on 2026-08-09: renderer decomposition is one child of the
  architecture parent and must preserve behavior, public renderer entrypoints
  and existing tests.
- Record-backed: stable IDs, selection provenance, focus recovery, owning-window
  cleanup and renderer/vault isolation are active contracts, not refactor
  opportunities.
- Mechanical: the proposed names are defaults; an equivalent seam is valid only
  when it preserves the responsibility matrix and remains independently tested.
- Record-backed: existing `PersonPhotoThumbnailCache`, touch, layout, profile,
  relationship-row and contact-moment-presentation modules already supply pure
  seams that should be reused before new abstractions are added.

## Journal

- 2026-08-09: Source inventory measured `src/render/atlas-renderer.ts` at
  86,492 bytes. Its current class combines canvas draw/resize, pointer and
  touch interaction, keyboard/list handling, person and relationship details,
  contact/follow-up surfaces, image-resource admission and lifecycle cleanup.
- 2026-08-09: The proposed component matrix was recorded as an internal,
  behavior-preserving split. No source or test change was made while opening
  this ticket.
- 2026-08-09: Implemented `GraphCanvasSurface`,
  `GraphInteractionController`, `SemanticPeopleList`,
  `PersonDetailsPanel`, `RelationshipDetailsPanel` and `FollowUpPanel` while
  retaining `AtlasRenderer` as the façade. Added focused component-boundary
  coverage; editor photo-picking remains separate from graph thumbnail/cache
  ownership.

## Blockers

None known for shaping. Stop before implementation if an extraction would
require changing the `AtlasRenderer` public façade, `AtlasSnapshot`, selection
provenance, owning-window contract or any active renderer behavior.

## Evidence

- Historical source-inventory baseline: `stat` on 2026-08-09 reported
  `src/render/atlas-renderer.ts` at 86,492 bytes before the implementation
  slice.
- Source declaration inventory identified the existing public façade and the
  private responsibility clusters that map to the proposed seams.
- Relevant browser, matrix, adapter, contact-presentation and photo-cache test
  files exist in the current worktree.
- Historical record-authoring note: no implementation, focused test, build or
  full gate ran while opening this record.
- 2026-08-09 current evidence under Node v24.19.0: renderer browser tests,
  component-boundary tests, DPR 1/1.5/2 matrix, full test (56 files/971 tests),
  production build and `git diff --check` pass. The authoritative independent
  review is **PASS** with no critical/significant renderer finding; it records
  only a non-blocking nit about `RelationshipDetailsPanelOptions` callback
  typing.

## Review

2026-08-09 authoritative independent read-only implementation review: **PASS**.
The renderer seams, owning-document/lifecycle cleanup, façade behavior and
component tests were inspected without a critical or significant finding.

## Retrospective

Pending until execution. Capture which seam was most difficult, whether focus,
photo and owning-window lifecycle evidence remained local to one owner, and any
new follow-up that should become a separate ticket rather than a renderer
abstraction.
