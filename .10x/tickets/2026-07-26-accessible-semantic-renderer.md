Status: done
Created: 2026-07-26
Updated: 2026-07-26

# P5a — Accessible semantic renderer

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-25-projection-modes-layout-state.md`,
`.10x/tickets/2026-07-25-relationship-editor-ui.md`

## Scope

Implement `.10x/specs/accessible-semantic-renderer.md` as the smallest complete
accessible renderer slice:

- replace the focus-revealed label-only fallback with a discoverable
  Graph/List mode and a shared semantic panel;
- implement stable-ID-based roving focus, selection synchronization and focus
  recovery;
- describe every selected node's visible incident relationships without
  inferring metadata;
- expose resolved Open/Center actions and preserve each owning view's guarded
  Create relationship action;
- make renderer lifecycle APIs use the owning window;
- add a real-browser Vitest project backed by Playwright Chromium.

This ticket is executable. Implementation has not started in this shaping
turn.

## Non-goals

- Touch pinch, one-finger pan, long press or gesture arbitration.
- Mobile bottom sheets or the complete P5b mobile workflow.
- Persisting Graph/List mode.
- Adding a dependency lockfile or other P8 release-hardening work.
- Custom context menus, edge selection or relationship-note navigation.
- Screen-reader certification or live Obsidian/mobile integration.
- Workers, image cache, force simulation, clustering or new projections.
- Any new vault write or relationship-status inference.

## Acceptance criteria

- [x] A native, always-visible Graph/List control defaults to Graph per
      renderer instance and switches exactly one active surface without
      changing or persisting selection/layout state.
- [x] List mode renders snapshot-order native node buttons identified by
      stable `NodeId`, with one roving tab stop and the specified
      Arrow/Home/End/Enter/Space/Escape behavior.
- [x] List and canvas share selection; `setGraph()` preserves selection and
      focus by stable ID, clears removed selections and performs the specified
      non-guessing focus recovery.
- [x] Empty graphs and unresolved/non-openable nodes remain selectable and
      understandable without invoking unavailable callbacks.
- [x] Selected details enumerate all incident snapshot edges in order,
      preserve parallel edges and describe relative direction, types, explicit
      status, dates and inferred contact-link provenance.
- [x] Resolved nodes expose native Open note and Use as center actions.
      Standalone and Bases keep their existing canonical eligibility rules for
      the visible Create relationship action.
- [x] No list selection, focus or mode change reads the vault, mutates a note,
      changes the projection center or invokes layout persistence.
- [x] Renderer DOM, style, resize, animation-frame and event APIs use the
      container's owning `Document`/`Window`; teardown leaves no owned
      resources, including in a secondary same-origin window or frame.
- [x] Graph/List controls and actions have visible focus, meet WCAG 2.2
      minimum target sizing/spacing and introduce no motion that bypasses
      `prefers-reduced-motion`.
- [x] Vitest is configured with separate Node and Playwright Chromium browser
      projects. `npm run test:browser` runs the focused browser suite and
      `npm run test` runs both projects.
- [x] Real-browser tests cover mode visibility, all specified keys, selection
      synchronization, action availability, relationship descriptions,
      parallel/inferred edges, empty/removal recovery, reduced motion,
      secondary-window ownership and cleanup.
- [x] Existing graph, index, projection, mutation and view-state regressions
      remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## References

- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/relationship-editor-ui.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-25-projection-modes-layout-state.md`
- `.10x/tickets/2026-07-25-relationship-editor-ui.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/domain/types.ts`
- `src/render/atlas-renderer.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `styles.css`
- `package.json`
- `vitest.config.ts`
- `https://vitest.dev/guide/browser/`
- `https://www.w3.org/WAI/ARIA/apg/patterns/button/`
- `https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/`
- `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`

## Assumptions

- Record-backed: P4 supplies the finalized deterministic `AtlasSnapshot`,
  selection and layout-state contract consumed by P5.
- Record-backed: rendering remains vault-independent and both standalone and
  Bases already use `AtlasRenderer` plus the same open/center/select callback
  boundary.
- Record-backed: P3b already guards Create relationship by canonical indexed
  person path and routes writes through the explicit shared modal.
- Record-backed: relationship status is optional and manual; `last_contact`
  is observational and never infers status.
- User-ratified on 2026-07-26: Graph/List is always discoverable, Graph is the
  session-local default and P5a does not persist the mode.
- User-ratified on 2026-07-26: the list uses one keyboard tab stop with
  arrow/Home/End navigation, Enter-open and Escape-clear behavior; Center and
  Create relationship remain explicit native actions rather than a custom
  menu.
- User-ratified on 2026-07-26: relationship details contain counterpart,
  direction, types, explicit status, `since` and `last_contact` when present,
  with no inferred status.
- Source-backed: the current renderer uses a label-only visually hidden list,
  a single canvas key handler and the owning window for animation frames but a
  global `ResizeObserver`; no browser interaction suite currently exists.
- Mechanical: internal file boundaries may be split only where renderer DOM,
  semantic projection and input handling have independently testable
  responsibilities. No speculative general renderer framework is authorized.
- Mechanical: use the Vitest 4 Playwright provider aligned to the existing
  Vitest version and Chromium only for this ticket; cross-browser expansion
  remains P7. The repository's no-lockfile state remains unchanged because
  deterministic dependency locking is explicitly owned by P8.

## Journal

- 2026-07-26: Inspected the active v2 plan, P4/P3b closure records, shared
  renderer, both view adapters, styles and the Node-only Vitest configuration.
  All existing executable child tickets are done; P5 is the next numbered
  roadmap priority.
- 2026-07-26: Current source has a visually hidden `<ul>` containing only node
  labels. It has no Graph/List control, relationship descriptions, roving
  focus, browser interaction suite or multi-window resize ownership.
- 2026-07-26: The user ratified the visible session-local Graph/List model,
  keyboard/action contract and selected-person relationship-detail content.
- 2026-07-26: Activated the focused P5a specification and opened this bounded
  executable ticket. Per 10x separation, implementation is deferred until a
  later explicitly authorized turn.
- 2026-07-26: The user explicitly authorized P5a implementation. Execution
  started after rereading the full ticket, active semantic-renderer spec,
  referenced P4/P3b/canonical-graph records, architecture, renderer, both view
  adapters, styles and test configuration. The reviewed contracts agree:
  stable IDs remain authoritative, the renderer stays vault-independent and
  canonical Create relationship eligibility remains owned by each view.
- 2026-07-26: Added the separate Vitest Node/browser project configuration,
  `test:browser` script and aligned `@vitest/browser-playwright` 4.1.10 plus
  Playwright 1.62.0 dependencies without creating a lockfile. Installed the
  Playwright Chromium 151 runtime successfully.
- 2026-07-26: Added the focused real-Chromium renderer contract first.
  Baseline `npm run test:browser` launched Chromium and collected all six
  tests; all six failed against the old renderer because Graph/List controls,
  semantic panel, roving focus, relationship details and owning-window
  lifecycle surface were absent. The first failure's DOM showed only the
  existing canvas and hidden label-only list, confirming a product-behavior
  gap rather than a browser-harness/setup failure.
- 2026-07-26: Replaced the hidden fallback with one renderer-owned Graph/List
  surface, stable-ID roving list, selected-person relationship details and
  delegated Open/Center actions. DOM creation, resize observation, computed
  style, animation frames and listener teardown now use the owning window.
- 2026-07-26: Kept Create relationship ownership in the view adapters and
  separated semantic-list selection from projection-center selection. The
  renderer reports `canvas`, `list` or `graph-update` selection provenance;
  standalone and Bases update selection/create UI for all sources but only
  canvas selection or the explicit Center action changes selected-node
  projection context.
- 2026-07-26: Focused `npm run test:browser` passed all 6 real-Chromium tests
  after implementation. A first `npm run build` exposed only TypeScript
  ownership-constructor and non-iterable DOM collection typing; narrowing the
  owning window to `Window & typeof globalThis` and using `Array.from` fixed
  the type boundary without weakening runtime checks. The build then passed.
- 2026-07-26: The first combined `npm run test` exposed that inline Vitest
  projects do not inherit root `resolve.alias` by default: 5 Node suites could
  not resolve the existing Obsidian stub while 13 Node files/60 tests passed.
  Adding documented `extends: true` to both projects restored the shared alias.
  The rerun passed 18 files and 77 tests, including the Chromium project.
- 2026-07-26: Final verification after the last accessibility assertions:
  `npm run test` passed 18/18 files and 77/77 tests; `npm run build` passed
  TypeScript no-emit and the production bundle; `git diff --check` exited 0
  with only informational Windows LF/CRLF conversion warnings. A direct
  preflight confirmed no `package-lock.json` was created, and the generated
  failure screenshots from the red baseline were removed.
- 2026-07-26: The user explicitly authorized closure repair for exactly the
  three independent-review findings: deny ambiguous-node capabilities while
  retaining valid Base-only Open/Center, preserve restored zero-coordinate
  cameras through List/Graph mode changes, and preserve equivalent selected
  action focus across `setGraph()`. Re-read the findings and inspected the
  renderer, standalone/Bases guards, layout restore and focused browser suite
  before editing; no broader P5a behavior is authorized in this repair.
- 2026-07-26: Added one real-Chromium regression per authorized finding and
  ran only those three with `npm run test:browser -- -t "denies every
  ambiguous|preserves an explicitly restored|preserves equivalent selected
  action"`. All three failed against the reviewed implementation: List Enter
  invoked Open for `ambiguous:*`, List→Graph reset `{x:0,y:0,scale:2}` to
  viewport center/scale 1, and `setGraph()` dropped focus from Open note.
  This reproduced each finding through the browser harness before repair.
- 2026-07-26: Repaired the findings without expanding P5a. Added one shared
  domain capability predicate that rejects `ambiguous:*` while accepting
  stable person nodes with a path even when `personId` is absent; renderer,
  standalone and Bases now use it for Open/Center/Create guards. Replaced the
  zero-coordinate camera sentinel with explicit initialization state. Before
  rebuilding selected details, `setGraph()` now captures a focused
  `open`/`center` action and refocuses the equivalent action only when it
  remains available.
- 2026-07-26: The focused repair rerun passed 3/3 Chromium tests with 6
  existing tests intentionally skipped. The complete `npm run test:browser`
  then passed 9/9, `npm run test` passed 18/18 files and 80/80 tests, and
  `npm run build` passed TypeScript no-emit plus production esbuild. Generated
  screenshots from the deliberate red repair baseline were removed. The
  browser boundary directly proves renderer denial, valid Base-only
  Open/Center, camera preservation and action-focus recovery; standalone/Bases
  Create denial remains source-backed because the harness does not mount
  Obsidian views.
- 2026-07-26: Final repair hygiene passed: `git diff --check` exited 0 with
  only informational Windows LF/CRLF warnings, the separate scan found no
  trailing whitespace in untracked P5a files, and `package-lock.json` remains
  absent. Ticket status stays active and the failed Review is preserved
  unchanged for independent re-review.
- 2026-07-26: The user explicitly authorized final closure repair for only the
  new stale selected-node center finding. Re-read the updated Review and both
  owning adapters. The defect is the conditional canvas assignment:
  non-resolved canvas nodes trigger re-projection but leave the previous
  `selectedCenterPath`; List selection must remain intentionally non-centering.
  The authorized outcome is therefore an adapter-level canvas rule, not a
  renderer, projection or capability-contract change.
- 2026-07-26: Extracted each adapter's existing inline selection callback to a
  private method without changing its condition, then added a focused Node
  seam over those actual methods. Baseline
  `npx vitest run --project node test/view-selection-center.test.ts` failed
  2/2: after Alice became center, both standalone and Bases retained
  `People/Alice.md` when canvas-selected ghost/ambiguous nodes were expected to
  clear it. The standalone harness also invokes its real projection method;
  the Bases harness proves `onDataUpdated()` scheduling and center-path input
  because mounting a full Obsidian Bases controller remains outside scope.
- 2026-07-26: Repaired both adapter methods with the same bounded rule:
  canvas selection stores the path only for
  `isResolvedAtlasPersonNode(node)` and otherwise explicitly stores
  `undefined`; List selection still neither changes `selectedCenterPath` nor
  schedules re-projection. The focused rerun passed 2/2. Full
  `npm run test:browser` passed 9/9, preserving ambiguous capability denial;
  `npm run test` passed 19/19 files and 82/82 tests, and `npm run build`
  passed TypeScript no-emit plus production esbuild.
- 2026-07-26: Final closure-repair hygiene passed: `git diff --check` exited 0
  with only informational Windows LF/CRLF warnings; the separate untracked-file
  scan found no trailing whitespace; no Vitest attachments or
  `package-lock.json` remain. Ticket status and Review stay unchanged for final
  independent re-review.
- 2026-07-26: Independent final re-review passed after inspecting the
  stale-center adapter repair and assertions. All acceptance criteria map to
  journaled evidence, Current Findings is empty, no P5a closure blocker
  remains and residual live Obsidian/mobile/screen-reader risks stay owned by
  P5b/P7. The orchestrator closed this ticket and distilled the reusable
  renderer boundaries to
  `.10x/knowledge/renderer-interaction-boundaries.md`.

## Blockers

None. Scope, behavior, constraints and acceptance criteria are concrete enough
for a cold-start executor. Installing the Playwright-backed Vitest provider
and Chromium is an expected implementation prerequisite, not shaping work.

## Evidence

- `src/render/atlas-renderer.ts` owns one session-local Graph/List mode,
  snapshot-order native people list, stable-ID roving focus, empty and
  non-openable states, selected-node actions and ordered incident-edge
  descriptions. It consumes only `AtlasSnapshot`, settings used for canvas
  labels and callbacks; it has no Obsidian, index or vault dependency.
- `src/render/atlas-renderer.ts`,
  `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` distinguish `canvas`, `list` and
  `graph-update` selection. List selection updates the shared selection and
  guarded Create relationship surfaces without invoking Center or changing
  selected-node projection context; explicit Center and existing canvas
  selection retain their prior projection behavior.
- `styles.css` gives the two surfaces deterministic hidden-state layout,
  visible `:focus-visible` outlines, at least 24-by-24-pixel controls and no
  mode/action animation. Its reduced-motion rule now also covers renderer
  instances outside the standalone view wrapper.
- `vitest.config.ts` defines separate inherited `node` and Playwright-backed
  `browser` projects. `package.json` provides `test:browser` and aligned Vitest
  4.1.10/Playwright 1.62.0 dependencies; no lockfile was added.
- `src/domain/node-capabilities.ts` defines the shared resolved-person
  capability rule: a usable person path and non-`ambiguous:*` stable ID.
  Renderer Open/Center, standalone Create and Bases Create all consume this
  same rule; the Bases canonical-index guard remains an additional
  requirement, so stable Base-only nodes retain renderer Open/Center without
  acquiring Create.
- `src/render/atlas-renderer.ts` tracks camera initialization independently
  from valid numeric coordinates and restores equivalent selected action focus
  by `data-action` only when that action is recreated.
- `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` now route renderer selection through
  adapter-owned methods. For `canvas`, each method assigns a resolved path or
  explicitly clears the center path; for `list`, neither method changes the
  center input or schedules selected-node projection.
- `test/view-selection-center.test.ts`: 2 focused adapter tests call the
  actual standalone/Bases selection methods. Standalone invokes its real
  projection path and proves Alice becomes the sole center while subsequent
  ghost and `ambiguous:*` canvas selections produce no centered node. Bases
  proves the same center-input transitions and one `onDataUpdated()` schedule
  per canvas selection. Both prove List preserves Alice's center without
  re-projecting, and both reassert non-resolved capability classification.
- `test/browser/atlas-renderer.browser.test.ts`: 9 Chromium tests use Vitest
  browser locators and provider-backed `userEvent` clicks/keyboard input to
  cover mode visibility/layout isolation, canvas/list synchronization,
  ArrowUp/ArrowDown/Home/End/Enter/native Space/Escape behavior, resolved and
  unavailable actions, ordered rich/parallel/directional/inferred
  relationships, stable focus/removal/empty recovery, minimum target size,
  no-motion styling, detached-document failure, secondary-window ownership
  and complete teardown. Three repair regressions additionally cover
  ambiguous list/canvas denial plus valid Base-only actions, exact
  `{x:0,y:0,scale}` camera round-trip and Open/Center focus preservation.
- Focused repair command: 3 tests passed and 6 existing browser tests were
  intentionally skipped.
- Complete `npm run test:browser`: 1 browser file and 9 tests passed in
  Playwright Chromium.
- Final `npm run test`: 19 files and 82 tests passed. This includes the 2
  focused owning-adapter regressions, all prior Node regressions and the 9
  Chromium renderer regressions.
- Final `npm run build`: TypeScript no-emit and production esbuild passed.
- Final `git diff --check`: passed with exit code 0; reported only
  informational LF/CRLF conversion warnings. A separate trailing-whitespace
  scan passed for the untracked P5a spec, ticket and browser test.

## Review

### Historical Findings

- **Significant — ambiguous people incorrectly acquire Open, Center and Create
  relationship capabilities.** `buildAtlasSnapshot()` deliberately represents
  duplicate-person records as `kind: "person"` nodes whose stable IDs start
  with `ambiguous:` (`src/graph/build-snapshot.ts:132-170`). The new renderer
  capability checks accept every `person` with a `filePath`, so such a node
  receives the semantic Open/Center buttons
  (`src/render/atlas-renderer.ts:406-420`), opens on List `Enter`
  (`src/render/atlas-renderer.ts:534-538`) and opens or centers from the canvas
  (`src/render/atlas-renderer.ts:606-615`). The standalone Create action has
  the same `kind`/path-only guard (`src/view/people-atlas-view.ts:230-235`);
  Bases additionally asks whether the canonical index contains the path, which
  is still true for each duplicate record
  (`src/bases/people-atlas-bases-view.ts:211-227`). Concrete reproduction:
  render a node shaped as
  `{ id: "ambiguous:a", personId: "duplicate", kind: "person",
  filePath: "People/A.md", ... }`, select it in List mode, then observe Open
  note and Use as center and press Enter; the open callback fires. If its path
  is present in the canonical index, the owning Create action is also shown.
  This directly violates normative contract 26 and the canonical eligibility
  acceptance criterion. The browser action test covers only a normal person,
  a ghost and a person without a path
  (`test/browser/atlas-renderer.browser.test.ts:8-53,227-250`), so it cannot
  catch the ambiguous-ID path.
- **Significant — a valid zero-offset camera is changed by a Graph/List
  round-trip.** The P4 layout contract allows finite camera coordinates,
  including `{ x: 0, y: 0 }`. Returning to Graph mode calls `resize()`
  (`src/render/atlas-renderer.ts:227-238`), and `resize()` treats exactly
  `x === 0 && y === 0` as an uninitialized sentinel and calls `camera.reset()`
  (`src/render/atlas-renderer.ts:240-250`). Concrete reproduction: restore a
  valid layout snapshot with camera `x: 0`, `y: 0` and an in-range scale,
  record `getLayoutSnapshot()`, activate List and then Graph, and compare the
  camera; it is reset to the viewport center. This violates normative
  contract 5 and the first acceptance criterion. The browser mode test
  compares only the constructor-default, already-centered camera before
  entering List and never returns to Graph with a zero-offset camera
  (`test/browser/atlas-renderer.browser.test.ts:138-168`).
- **Minor — graph updates can drop focus from selected-node action buttons.**
  `setGraph()` rebuilds the complete selected-details subtree, but its focus
  restoration recognizes only a focused person-list button
  (`src/render/atlas-renderer.ts:135-159,364-421`). If Open note or Use as
  center has focus when an otherwise non-destructive graph update arrives,
  that focused button is removed and no equivalent action is refocused. This
  is an accessibility residual against the no-focus-stealing intent of
  normative contract 14; the browser update test exercises only a focused
  person button (`test/browser/atlas-renderer.browser.test.ts:252-275`).

### Repair Disposition

- **Resolved — ambiguous capabilities.** The shared
  `isResolvedAtlasPersonNode()` predicate rejects the reserved `ambiguous:*`
  stable-ID namespace while continuing to accept a person with a file path and
  no `personId` (`src/domain/node-capabilities.ts:1-14`). Renderer detail
  actions, List Enter, canvas double-click/Enter and both owning-view
  Open/Center/Create boundaries now consume that predicate. Bases still adds
  its canonical-index path guard only for Create, so a valid Base-only node
  retains renderer Open/Center without acquiring Create. The new Chromium
  assertion uses an `isCenter: true` ambiguous node, proves List Enter and
  semantic actions are denied, double-clicks the actual center node with and
  without Shift, and proves a path-backed Base-only node still delegates both
  valid actions
  (`test/browser/atlas-renderer.browser.test.ts:55-72,271-298`).
- **Resolved — zero-offset camera.** Camera initialization is now explicit
  lifecycle state rather than a coordinate sentinel. Constructor resize,
  `fitToContent()` and layout restoration set or consume
  `cameraInitialized` without reinterpreting valid zero coordinates
  (`src/render/atlas-renderer.ts:47-58,170-203,236-262`). The Chromium
  regression restores `{ x: 0, y: 0, scale: 2 }`, round-trips List→Graph and
  compares the complete positions map and camera exactly
  (`test/browser/atlas-renderer.browser.test.ts:300-318`).
- **Resolved — equivalent action focus.** `setGraph()` captures a focused
  renderer-owned `data-action`, rebuilds details, and refocuses only the same
  action if it still exists (`src/render/atlas-renderer.ts:138-166,489-496`).
  The Chromium regression independently checks both Open note and Use as
  center across graph updates
  (`test/browser/atlas-renderer.browser.test.ts:345-362`).
- The three added assertions supplement the original six tests; inspection
  found no weakened or removed assertion and no repair work outside the shared
  capability rule, camera lifecycle state, action-focus restoration and their
  necessary view guards.

### Historical Follow-up Finding

- **Significant — selecting an ambiguous or ghost node on the canvas leaves a
  stale previous `selected-node` projection center.** Both view adapters now
  update `selectedCenterPath` for a canvas event only when selection is empty
  or `isResolvedAtlasPersonNode(node)` is true
  (`src/view/people-atlas-view.ts:122-128`;
  `src/bases/people-atlas-bases-view.ts:52-58`). Therefore, starting with Alice
  as the selected-node center and canvas-selecting an ambiguous person or
  ghost leaves Alice's path intact. The immediate re-projection then supplies
  that stale path as the selected-node center
  (`src/view/people-atlas-view.ts:162`;
  `src/bases/people-atlas-bases-view.ts:114`) instead of supplying no center.
  This contradicts P4's contract that selected-node uses the selected valid
  person and otherwise produces a non-centered result, and it changes the
  pre-repair canvas-selection behavior beyond the authorized ambiguous
  capability denial. Concrete reproduction: select/canvas-center Alice in
  `selected-node` mode, then click an `ambiguous:*` or ghost canvas node; the
  semantic selection changes but Alice remains the projection center. The new
  renderer-only ambiguous test cannot observe either adapter's retained
  `selectedCenterPath`.

### Final Repair Disposition

- **Resolved — stale selected-node center.** Both adapters now route renderer
  selection through their actual `handleNodeSelection()` method. A canvas
  selection always assigns either the resolved person's path or explicit
  `undefined`, so ghost, ambiguous, pathless and cleared selections cannot
  retain a prior center; non-List selection still schedules the existing
  selected-node projection update
  (`src/view/people-atlas-view.ts:149-155`;
  `src/bases/people-atlas-bases-view.ts:80-86`). List selection updates the
  ordinary selected path and action surface but deliberately leaves
  `selectedCenterPath` and projection scheduling untouched.
- `test/view-selection-center.test.ts:95-117` invokes the real standalone
  adapter method and its real `renderSnapshot()` projection path: a valid
  canvas Alice becomes the sole center, subsequent ghost and ambiguous canvas
  selections clear the center and produce an all-non-centered snapshot, while
  List selection preserves Alice's center without calling `setGraph()`.
- `test/view-selection-center.test.ts:119-139` invokes the real Bases adapter
  method: a valid canvas person stores its path, ghost and ambiguous canvas
  selections clear it, and every canvas transition schedules exactly one
  `onDataUpdated()` call; List selection preserves the prior path and
  schedules no update.
- The repair extracts only the existing two adapter callbacks into focused
  methods and changes the canvas assignment from conditional retention to an
  explicit resolved-path-or-undefined rule. It does not change the renderer,
  shared capability predicate, camera lifecycle, action-focus behavior,
  projection service or browser assertions. The journaled 9/9 Chromium rerun
  additionally confirms ambiguous denial, valid Base-only Open/Center,
  zero-offset camera preservation and action-focus restoration remain green.

### Current Findings

None.

### Verdict

**pass.** All historical findings and the stale-center follow-up are repaired
with focused regression coverage. No closure blocker remains within P5a's
automated and source-inspection boundary.

### Residual Risk

The focused Node seam invokes the actual standalone/Bases selection methods
and standalone projection logic, but it does not mount a complete Obsidian
Bases controller or live view. Canonical Create eligibility and the complete
Bases update/render round trip therefore remain partly source-backed.
The reduced-motion assertion verifies that the newly styled mode control has
no base transition/animation; it does not emulate
`prefers-reduced-motion: reduce`. Live Obsidian screen-reader behavior, actual
pop-out integration and mobile interaction remain intentionally excluded and
unverified.

## Retrospective

The browser-first red baseline was valuable because it proved the new harness
could launch and collect before any renderer implementation existed. The main
interaction surprise was that rebuilding native buttons correctly updates
their semantic state but also removes the focused DOM node; preserving the
stable `NodeId` and explicitly refocusing only when the list already held focus
made dynamic updates both deterministic and non-stealing.

The existing P4 `selected-node` projection exposed a second boundary that a
renderer-only implementation could have hidden: semantic list selection must
update the owning view's selection/Create UI without implicitly recentering the
projection. Carrying a small selection-provenance value through the existing
callback kept that rule explicit and avoided a second selection store.

Two setup failures were mechanical rather than behavioral. Inline Vitest
projects require `extends: true` to inherit the root Obsidian alias, and
TypeScript needs the owning window narrowed to `Window & typeof globalThis`
before window-specific constructors type-check. Both are now encoded directly
in configuration/source, so later P5b/P7 browser work can reuse the harness
without rediscovering them.

Live Obsidian screen-reader behavior, mobile gestures and full pop-out
integration remain intentionally unclaimed; the parent plan already owns them
as later P5b/P7 work.

The closure repair added three concrete lessons. Capability must be derived
from the stable identity namespace, not merely `kind` plus path: ambiguous
records deliberately look person-like so they can remain visible without
becoming actionable. Valid data values must never double as lifecycle
sentinels; explicit camera initialization preserves the full finite coordinate
domain promised by P4. Finally, focus recovery applies to semantic equivalents
beyond list items: when a subtree is rebuilt, stable action identity is enough
to restore focus narrowly without stealing it from unrelated controls.

The final adapter repair exposed why a guard cannot simply skip invalid state:
when input is authoritative, rejecting a new value must also invalidate the
old derived value. Canvas selection owns selected-node center input, so every
canvas event assigns it—resolved path or explicit absence—while List remains a
separate non-centering interaction. Testing the adapter method itself caught
this transition without introducing an Obsidian UI harness.
