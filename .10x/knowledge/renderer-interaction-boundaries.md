Status: active
Created: 2026-07-26
Updated: 2026-07-26

# Renderer interaction boundaries

Use these boundaries when extending People Atlas renderer, keyboard, touch,
selection, pop-out or view-adapter behavior after P5a.

## Stable identity and capabilities

- Renderer selection is keyed by stable `NodeId`; display labels are
  presentation only.
- A node may be `kind: "person"` and still be ambiguous. IDs in the reserved
  `ambiguous:*` namespace remain visible but MUST NOT acquire Open, Center or
  Create relationship capabilities.
- Use `isResolvedAtlasPersonNode()` for person actions. A stable Base-only
  person with a path may retain Open and Center; Create relationship still
  requires the owning adapter's canonical-index guard.
- Ghost, ambiguous and pathless nodes remain selectable semantic content.
  Denying an action must not hide or merge them.

## Selection provenance

- `canvas`, `list` and `graph-update` selection have different effects and
  must remain explicit.
- Canvas selection owns `selected-node` projection input. Every canvas event
  assigns that input: a resolved path or explicit `undefined`. Skipping an
  invalid new value would leave a stale valid center.
- List selection updates semantic selection and owning-view action surfaces
  but does not recenter or schedule a selected-node projection.
- Graph-update removal clears a vanished selection by stable ID without
  searching for a matching display label.

## Focus and rebuilt DOM

- Rebuilding semantic DOM must preserve focus only when focus was already
  inside the rebuilt renderer subtree.
- Preserve people-list focus by stable `NodeId`.
- Preserve selected action focus by stable action identity such as
  `data-action`, and restore it only when the equivalent action still exists.
- When the focused node disappears, move to the first remaining stable node
  or the List mode control for an empty graph; never guess by label.

## Window and camera lifecycle

- DOM, styles, observers, events and animation frames use the renderer
  container's owning `Document` and `Window`; never fall back to global
  `window`.
- Teardown owns every listener, observer and pending animation frame it
  creates.
- Valid data values are not lifecycle sentinels. Camera coordinates
  `{ x: 0, y: 0 }` are valid persisted state, so initialization uses explicit
  lifecycle state rather than coordinate inspection.
- Graph/List mode changes preserve positions, camera and selection and do not
  emit layout persistence.

## Verification seams

- Real renderer focus, keyboard, owning-window and DOM behavior belongs in the
  Playwright-backed Vitest browser project.
- Owning-view projection side effects need adapter-level coverage because a
  renderer-only browser harness cannot observe private center inputs.
- Match proof to the layer that can produce valid evidence. The pure touch
  controller owns deterministic pointer identity, partial-lift re-baselining,
  no-jump continuation and persistence cardinality. Protocol-valid trusted
  Chromium input owns simultaneous pinch/centroid pan through final release.
  The real two-to-one transition remains an Obsidian Mobile integration check.
- Validate browser-protocol payloads before dispatch. A browser accepting an
  out-of-contract CDP message does not make its gesture semantics portable or
  reviewable.
- Cardinality assertions must cover every intermediate transition. Checking
  only the first lift and final release would not detect accidental
  persistence during survivor moves.
- Treat browser lifecycle APIs as failure boundaries: ignore non-finite
  pointer coordinates, contain pointer-capture exceptions by stable pointer
  ID and roll back all sheet state if native `showModal()` fails.
- Inline Vitest projects require `extends: true` to inherit the repository's
  Obsidian alias.
- Browser, adapter and pure graph tests prove different boundaries; do not
  substitute one for another or claim live Obsidian/mobile/screen-reader
  coverage from them.

## References

- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/tickets/2026-07-26-accessible-semantic-renderer.md`
- `.10x/tickets/2026-07-26-mobile-touch-interaction.md`
- `src/domain/node-capabilities.ts`
- `src/render/atlas-renderer.ts`
- `src/render/touch-gesture.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `test/view-selection-center.test.ts`
