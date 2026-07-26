Status: done
Created: 2026-07-26
Updated: 2026-07-26

# P5b — Mobile touch interaction

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-accessible-semantic-renderer.md`

## Scope

Implement `.10x/specs/mobile-touch-interaction.md` as the second and final
bounded P5 slice:

- replace the renderer's single-pointer touch path with explicit tap,
  one-finger pan and two-finger pinch/centroid-pan arbitration;
- preserve mouse and pen node drag while preventing touch node drag;
- implement the ratified 500 ms/8 CSS pixel long-press contract;
- add renderer-owned Zoom out, Zoom in, Fit and Details alternatives with
  44-by-44 CSS pixel touch presentation;
- add one owning-document native modal bottom sheet shared by Details and long
  press;
- wire exact current-node Open/Center/Create capabilities from standalone and
  Bases without moving vault/index ownership into the renderer;
- extend the existing Node and Playwright Chromium harness with isolated
  gesture tests and provider-backed real multi-touch coverage.

Implementation and the two runtime error-path repairs are complete within the
ratified automated/source boundary. The user accepted deterministic
controller proof plus later P7/manual Obsidian Mobile validation for the
two-to-one partial-lift transition; final independent review passed against
that amended authority and the ticket is closed.

## Non-goals

- Touch node dragging, lasso/edge selection, inertial pan, double-tap zoom,
  swipe-to-dismiss or haptics.
- Moving projection or center-mode controls into the renderer.
- Persisting Graph/List mode, gesture state or an open sheet.
- New vault writes, automatic actions or inferred relationship status.
- A dependency lockfile or other P8 release-hardening work.
- Full live Obsidian mobile, screen-reader or pop-out certification.
- Worker physics, image cache, clustering or performance thresholds.

## Implementation boundaries

- Gesture state and camera calculations belong in `src/render/` and consume no
  Obsidian API or vault data.
- The shared renderer owns canvas gestures, controls, sheet DOM and lifecycle.
- Standalone and Bases adapters remain authoritative for current stable-node
  capabilities and relationship-modal creation.
- All DOM, timers, observers, animation and pointer ownership comes from the
  renderer container's owning `Document`/`Window`.
- Existing `AtlasSnapshot`, capability guards, selection provenance, view
  state and layout persistence contracts remain authoritative.

## Acceptance criteria

- [x] Touch down defers selection; release within 500 ms and 8 CSS pixels taps
      a stable node or clears on empty canvas without invoking an action.
- [x] One-finger touch pans from any canvas origin and leaves every node
      position unchanged; a completed camera change persists exactly once.
- [x] Two active touches perform bounded distance-ratio zoom and centroid pan,
      handle out-of-order pointer updates, re-baseline after a lift and
      persist at most once when all touches end.
- [x] Every >8-pixel move, second touch, release, cancel, graph replacement,
      mode switch and destroy path cancels a pending long press.
- [x] A stationary 500 ms node hold selects that stable node and opens the
      sheet without firing Open, Center, Create or layout callbacks.
- [x] Mouse/pen node drag, mouse pan/double-click/wheel and P5a keyboard/List
      behavior retain regression coverage and remain unchanged.
- [x] Graph mode exposes native Zoom out, Zoom in, Fit and Details controls;
      Details is disabled without selection and opens the same selected-node
      sheet as long press.
- [x] On narrow/coarse presentation, graph controls and Graph/List buttons
      measure at least 44 by 44 CSS pixels and have clear accessible names and
      visible focus.
- [x] The sheet is an owning-document native modal `<dialog>` with accessible
      naming, initial focus, contained tab order, explicit Close, Escape and
      invoker-aware focus return.
- [x] Sheet data and incident relationships match P5a stable-ID and explicit
      metadata semantics, including parallel and inferred-contact edges.
- [x] Current resolved capabilities alone expose Open/Center/Create; ghost,
      ambiguous, pathless, removed and stale-prior selections expose no
      actionable buttons.
- [x] Sheet actions close first and delegate exactly once. Create continues
      through P3b's explicit Save/Cancel modal; no gesture or sheet lifecycle
      writes to the vault.
- [x] `setGraph()`, Graph/List switching and `destroy()` safely refresh or
      terminate dialog, gesture, timer, listener and pointer-capture state
      without post-destroy callbacks.
- [x] Mobile sheet/action-bar CSS uses Obsidian variables, safe-area insets,
      bounded scrollable height and reduced-motion-safe behavior.
- [x] Isolated tests cover gesture thresholds, transitions, cancellation,
      camera math, scale clamping, partial-lift re-baselining, continuing
      one-finger pan and persistence cardinality.
- [x] Playwright Chromium browser tests use provider-backed protocol-valid
      trusted multi-touch for simultaneous pinch/centroid pan through final
      release and cover tap, node-origin pan, long press, sheet focus/actions,
      target dimensions, mouse/pen regression, cleanup and a secondary owning
      window/frame.
- [x] The provider limitation is stated honestly: trusted integrated
      two-to-one partial lift remains a P7/manual Obsidian Mobile validation
      item and is not claimed by the automated browser suite.
- [x] Existing tests remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## References

- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/tickets/2026-07-26-accessible-semantic-renderer.md`
- `AGENTS.md`
- `src/render/atlas-renderer.ts`
- `src/render/camera.ts`
- `src/domain/node-capabilities.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `vitest.config.ts`
- `styles.css`

## Assumptions

- User-ratified: tap selects, one-finger touch always pans, two fingers
  pinch/centroid-pan and touch never drags nodes.
- User-ratified: long press is 500 ms with an 8 CSS pixel movement boundary,
  opens details only and never auto-executes an action.
- User-ratified: mobile controls provide Zoom out, Zoom in, Fit and Details
  plus 44-pixel Graph/List targets; Details is the simple long-press
  alternative.
- User-ratified: ghost and ambiguous sheets are explanation-only.
- Record-backed: P5a's renderer, browser harness, stable capability guard,
  selection provenance and owning-window cleanup are the starting contract.
- Record-backed: native HTML modal dialog behavior and Playwright Chromium CDP
  are the intended accessibility and real multi-touch test seams.
- User-ratified: deterministic controller coverage is authoritative for
  partial-lift identity/re-baselining/continuation; trusted Chromium proves
  simultaneous pinch through final release; real integrated partial lift is
  deferred explicitly to P7/manual Obsidian Mobile validation.

## Journal

- 2026-07-26: P5a was committed as `53b86694fee6888f3f6463477ba49909a687a5c0`
  after its final pass review and full verification.
- 2026-07-26: Current renderer/source inspection confirmed touch currently
  shares one immediate-selection pointer path with mouse/pen; the canvas
  already scopes `touch-action: none`, camera zoom is bounded, and the
  browser harness already runs Playwright Chromium.
- 2026-07-26: Official WCAG pointer/dragging guidance, Pointer Events, native
  HTML-dialog behavior and Vitest provider-backed CDP support were checked as
  implementation constraints.
- 2026-07-26: The user ratified the touch map, long-press timing/cancellation
  and mobile control/sheet boundary in three explicit checkpoints.
- 2026-07-26: Active spec and executable ticket opened. No product source,
  dependency, test or build change was made during shaping.
- 2026-07-26: User authorized P5b implementation. Execution started after
  reading the complete governing spec, P5a contract and review record,
  renderer-boundary knowledge, parent plan, project instructions, current
  renderer/camera/capability/view sources and existing browser harness. Scope
  remains the executable ticket only; no commit or push is authorized.
- 2026-07-26: Added the Obsidian-free `TouchGestureController` and focused
  Node tests first. The first 4/5 run exposed an incorrect expected camera
  value in the test; the implementation and TypeScript already passed. After
  correcting the baseline-world-coordinate expectation, threshold, tap,
  one-finger pan, fixed-baseline pinch, scale clamping, partial-lift
  re-baselining, long-press consumption and cancellation tests passed.
- 2026-07-26: Integrated touch as a distinct pointer path in the shared
  renderer. Touch defers selection and never enters node-drag mode; mouse and
  pen retain the prior immediate selection/drag/pan path. Gesture completion
  owns one layout callback, while graph replacement, List mode, cancel and
  destruction release capture and timers without persistence callbacks.
- 2026-07-26: Added renderer-owned Zoom out, Zoom in, Fit and Details controls
  plus one owning-document modal dialog. The sheet reuses P5a's incident-edge
  descriptions, closes before delegating Open/Center/Create, refreshes by
  stable `NodeId`, traps Tab at its native buttons and returns focus according
  to the Details/canvas invoker.
- 2026-07-26: Tightened standalone and Bases Create eligibility to the exact
  current canonical `(NodeId, filePath)` pair before either adapter supplies
  the relationship-modal callback. Focused adapter tests deny same-path stale
  IDs, same-ID stale paths, ghosts and ambiguous records in both adapters.
- 2026-07-26: Extended CSS with variable-backed graph controls and modal
  presentation, 44-by-44 narrow/coarse targets, bounded scrolling, safe-area
  insets, visible focus and motion-free dialog/action styling.
- 2026-07-26: Added a Vitest Playwright custom command backed by the active
  Chromium CDP session. Initial browser instrumentation showed that Vitest's
  test iframe is visually scaled: adding raw CSS offsets to Playwright's page
  bounding box could hit the wrong element and falsely appear to pinch. The
  command now maps CSS-local coordinates through the locator's visual/CSS
  scale. A real run records two simultaneous browser pointer IDs, out-of-order
  pair updates, one partial lift, a continuing move from the survivor and one
  final persistence callback.
- 2026-07-26: Browser coverage now also proves node/empty tap, node-origin pan
  without position changes, 500 ms long press without action/layout callback,
  every timer cancellation class, touch-sized controls, dialog focus/Escape/
  action guards, stable sheet refresh/removal, mouse and pen node drag, mouse
  background pan/wheel, destroy cleanup and a modal in a secondary owning
  document. Two consecutive complete Chromium runs passed 14/14 after the CDP
  calibration.
- 2026-07-26: Final verification passed `npm run test` with 20/20 files and
  94/94 tests, `npm run build` with TypeScript no-emit plus production
  esbuild, and `git diff --check`. Generated Vitest screenshots/attachments
  from red harness iterations were removed and no dependency lockfile was
  added.
- 2026-07-26: Review repair began against the three significant findings.
  Focused regressions for unusable pointer coordinates/capture failures and
  native `showModal()` failure first failed 0/2 with the expected uncaught
  `NotFoundError` and `InvalidStateError`.
- 2026-07-26: The renderer now rejects non-finite pointer coordinates, guards
  pointer-capture set/query/release failures by stable pointer ID, and rolls
  back dialog node/invoker/content state when `showModal()` fails. The focused
  error-path regressions then passed 2/2.
- 2026-07-26: The CDP command now rejects non-empty `touchEnd`/`touchCancel`
  payloads and empty `touchStart`/`touchMove` payloads before dispatch. The
  browser pinch regression was reduced to the protocol-valid claim it can
  prove: two distinct trusted pointer IDs, pinch/centroid pan, both final
  lifts and one persistence callback. It no longer claims partial lift or a
  continuing survivor.
- 2026-07-26: Bounded partial-lift investigation confirmed the existing
  Chromium CDP seam cannot release one active touch protocol-validly:
  `touchEnd`/`touchCancel` require zero active points, and omitting one point
  from `touchMove` does not emit that pointer's `pointerup`. Existing
  Playwright 1.62 BiDi-over-CDP was tried without adding dependencies, but
  both `bidi-chromium` and `bidi-chrome` hung before launch resolved, including
  standalone 10-second probes. All exact spawned Node/Chrome processes were
  stopped and the normal provider restored.
- 2026-07-26: Repair verification passed the three focused Chromium checks,
  `npm run test` with 20/20 files and 96/96 tests, `npm run build`, and
  `git diff --check` with only informational Windows LF/CRLF warnings. The
  ticket is blocked only on protocol-valid trusted partial-lift evidence and
  remains subject to independent re-review.
- 2026-07-26: The user ratified a narrower, explicit verification boundary
  after the protocol investigation: partial lift and continuing one-finger
  pan remain required behavior with deterministic controller proof; trusted
  Chromium proves simultaneous pinch/centroid pan through final release; the
  real integrated partial-lift transition is owned by P7/manual Obsidian
  Mobile validation. The spec and acceptance criteria were amended without
  changing product source or weakening the honest browser claim. Status
  returned to `active` for final independent review.
- 2026-07-26: Final independent review found one assertion gap in the
  authoritative partial-lift test: the two survivor moves did not explicitly
  deny intermediate layout persistence. After user-authorized repair, both
  moves assert `persistLayout === false`, the first lift remains false and
  only the final release remains true. Focused 1/1, full 20-file/96-test,
  build and diff gates passed; final independent re-review returned `pass`.
  With every acceptance criterion checked and no blocker remaining, P5b
  closed as `done`.
- 2026-07-26: The user authorized only the final significant assertion repair
  from independent review. The authoritative partial-lift test now asserts
  `persistLayout === false` on both the no-jump survivor move and the
  continuing survivor pan, while retaining false on the first lift and true
  only on the final release. No product behavior, specification authority,
  browser claim or unrelated assertion changed.
- 2026-07-26: The focused partial-lift test passed 1/1, the full
  `npm run test` gate passed 20/20 files and 96/96 tests, `npm run build`
  passed TypeScript no-emit plus production esbuild, and `git diff --check`
  passed with only informational Windows LF/CRLF warnings. Status remains
  `active` for final independent re-review.
- 2026-07-26: Record reconciliation: the preceding executor status captured
  the state before the final independent re-review. The final review below
  returned `pass`; the current ticket status and parent roadmap therefore
  correctly record P5b as `done`.

## Blockers

None. The user-ratified verification boundary assigns trusted simultaneous
pinch/final release to the Chromium suite, deterministic partial-lift
semantics to the isolated controller suite and the real integrated transition
to P7/manual Obsidian Mobile validation.

## Evidence

- `src/render/touch-gesture.ts` implements pure stable-pointer tracking,
  thresholded taps/pans, fixed-baseline distance-ratio pinch math, centroid
  preservation, scale clamping, partial-lift re-baselining, long-press
  consumption and one final persistence decision.
- `src/render/atlas-renderer.ts` branches touch from mouse/pen, owns all
  pointer capture and long-press timers through the container's owning
  `Window`, suppresses touch compatibility double-click actions and cancels
  graph gestures on snapshot/mode/lifecycle replacement.
- The same renderer owns native Zoom out, Zoom in, Fit and Details controls
  and one native `<dialog>`. It refreshes sheet data/capabilities by selected
  stable `NodeId`, uses the existing incident-edge formatter, closes before
  callbacks, contains Tab focus and restores Details/canvas focus.
- `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` supply Create only when the exact
  selected stable ID and path still match a canonical index person. The
  renderer has no index, vault or Obsidian dependency.
- `styles.css` keeps `touch-action: none` on the canvas only, gives narrow or
  coarse Graph/List and graph-action buttons measured 44-pixel targets, and
  uses Obsidian variables, safe-area insets, bounded sheet height/scroll and
  reduced-motion coverage.
- `vitest.config.ts` exposes provider-backed
  `Input.dispatchTouchEvent` through the Playwright Chromium CDP session,
  rejects protocol-invalid active-point cardinalities and correctly
  translates test-frame CSS coordinates into scaled page coordinates.
  `test/browser/browser-commands.d.ts` types that browser seam.
- `test/touch-gesture.test.ts`: 6 isolated tests cover tap time/movement
  boundaries, empty tap, pan, order-independent pinch, min/max clamping,
  partial-lift continuation, persistence cardinality, long press and
  movement/second-touch cancellation. The partial-lift sequence explicitly
  proves no persistence on the first lift or either survivor move and exactly
  one persistence decision on the final lift.
- `test/view-selection-center.test.ts`: 3 adapter tests retain the P5a
  selected-center contract and prove exact current-node Create eligibility in
  both owning views.
- `test/browser/atlas-renderer.browser.test.ts`: 16 Playwright Chromium tests
  retain all P5a behavior; add trusted touch tap/pan/long press and
  protocol-valid simultaneous-pointer pinch coverage; and cover unusable
  coordinates, pointer-capture exceptions, modal-open rollback, controls,
  sheet capability, mouse/pen, cancellation, cleanup and a secondary
  document. Trusted partial lift is not claimed.
- Final assertion-repair `npm run test`: 20 files and 96 tests passed.
- Final `npm run build`: TypeScript no-emit and production esbuild passed.
- Final `git diff --check`: passed; only informational Windows LF/CRLF
  conversion warnings were emitted.

## Review

### Current Findings

- **Significant — the claimed trusted partial-lift acceptance path sends an
  invalid CDP touch sequence and does not prove which pointer survives.**
  `dispatchTouch()` forwards every declared step unchanged
  (`vitest.config.ts:16-44`), while the pinch regression ends one of two active
  touches with `touchEnd` plus a non-empty touch-point array
  (`test/browser/atlas-renderer.browser.test.ts:532-561`). The official Chrome
  DevTools Protocol contract for `Input.dispatchTouchEvent` says that
  `touchEnd` and `touchCancel` must contain no touch points and describes the
  supplied array as the active touch points:
  `https://chromedevtools.github.io/devtools-protocol/tot/Input/`.
  Chromium accepting this out-of-contract payload does not give the event a
  portable partial-lift meaning. The assertions compound the ambiguity: they
  prove two distinct `pointerdown` IDs and merely some `pointermove` after the
  first `pointerup`, but never prove that this move belongs to the actual
  surviving pointer (`test/browser/atlas-renderer.browser.test.ts:565-569`).
  Concrete reproduction: log the full pointer sequence for the existing
  command and compare the declared lifted ID, emitted `pointerup` ID and
  post-lift `pointermove` ID; the current test has no equality assertion that
  can establish that chain. This leaves normative contracts 37-38 and the
  provider-backed partial-lift acceptance criterion unsupported despite the
  journaled green browser run.
- **Significant — unusable coordinates and pointer-capture failures can throw
  or corrupt interaction state instead of degrading safely.**
  `pointerPosition()` performs arithmetic without a finite-coordinate guard
  (`src/render/atlas-renderer.ts:699-702`), and touch down/move/up immediately
  feed its result into node hit-testing and `TouchGestureController`
  (`src/render/atlas-renderer.ts:887-946`). A pointer event whose `clientX` or
  `clientY` is overridden to `NaN` therefore reaches the single-touch camera
  arithmetic; the `<= 8` threshold comparison is false for `NaN`, after which
  a camera coordinate can become `NaN` and be persisted. Independently,
  `setPointerCapture()`, `hasPointerCapture()` and
  `releasePointerCapture()` are unguarded on down, up and lifecycle
  cancellation (`src/render/atlas-renderer.ts:750-754,887-890,940-950`).
  Making `setPointerCapture` or `releasePointerCapture` throw
  `NotFoundError` aborts the handler/cleanup rather than continuing by stable
  pointer ID. The browser regressions replace these methods only with
  successful no-op mocks (`test/browser/atlas-renderer.browser.test.ts:581-583,
  637-639`), so neither failure mode is covered. This directly violates both
  explicit pointer error-behavior clauses in
  `.10x/specs/mobile-touch-interaction.md:278-284`.
- **Significant — native modal-open failure leaves sheet state assigned and
  propagates the exception.** `openSheet()` assigns `sheetNodeId` and
  `sheetInvoker`, renders the sheet, then calls `showModal()` without a
  guarded rollback (`src/render/atlas-renderer.ts:625-633`). If `showModal()`
  throws because the dialog lifecycle changed or the platform rejects modal
  opening, the call escapes with stale sheet state instead of leaving the
  sheet closed and canvas operable. Concrete reproduction: replace the owning
  dialog's `showModal` with a function that throws `InvalidStateError`, select
  a node and activate Details; the activation throws and the assigned sheet
  state is not cleared. Existing tests cover ordinary open/close, graph
  refresh, removal and a secondary document, but not this specified failure
  path. This violates the modal error behavior at
  `.10x/specs/mobile-touch-interaction.md:285-287`.

### Verified Without Finding

- The pure controller keeps a fixed two-pointer baseline, makes final pinch
  results independent of pointer-update order, re-baselines after a partial
  lift and defers its single persistence decision until the final lift.
- Touch remains separate from mouse/pen drag; long-press timers are owned by
  the renderer window and ordinary movement, second-pointer, release, cancel,
  graph, mode and destroy paths cancel or consume them without automatic
  actions.
- The native dialog uses the owning document, explicit Close/Escape handling,
  contained button tab order and invoker-aware focus return. Open, Center and
  Create are revalidated by current stable node, and both adapters grant Create
  only for the exact canonical `(NodeId, filePath)` pair.
- Narrow/coarse controls meet the 44-pixel presentation rule, sheet styling
  uses Obsidian variables and safe-area bounds, and introduced motion is
  suppressed. Inspection found additive tests and no removed or weakened P5a
  protective assertion.
- The journaled `npm run test` (20 files, 94 tests), `npm run build` and
  `git diff --check` results were accepted as supplied and were not rerun
  during this independent review.

### Verdict

**fail.** The pure interaction model is substantially covered, but the trusted
partial-lift proof is protocol-invalid and three explicit runtime error
requirements are not satisfied. P5b must remain active until the findings are
repaired with focused regressions and independently re-reviewed.

### Residual Risk

This review stays within source inspection and the journaled automated browser
boundary. It does not certify a live Obsidian Mobile WebView, real P3b modal
stacking, assistive technology or a real pop-out window; those remain the
ticket's explicit P7/manual validation boundary.

### Repair Disposition

- **Resolved — finite-coordinate and pointer-capture error behavior.**
  `pointerPosition()` now rejects non-finite event and derived coordinates
  before node, gesture or camera state is touched
  (`src/render/atlas-renderer.ts:702-720`). Pointer capture set, query and
  release are isolated behind exception-safe helpers; a failed query still
  attempts release, while a failed set/release does not interrupt stable-ID
  gesture tracking or lifecycle cleanup
  (`src/render/atlas-renderer.ts:723-744,792-795,927-1007`). The focused
  Chromium regression makes all three capture methods throw, injects a
  `NaN` touch move, proves the camera is unchanged at that boundary, then
  proves a valid continuation/final release leaves finite camera state,
  unchanged node positions and exactly one persistence callback. A subsequent
  cancel also completes without throwing
  (`test/browser/atlas-renderer.browser.test.ts:628-683`).
- **Resolved — modal-open rollback.** `openSheet()` now contains
  `showModal()` failure, attempts to close a dialog that became open, clears
  `sheetNodeId`, `sheetInvoker` and rendered sheet content, and returns without
  invoking an action (`src/render/atlas-renderer.ts:625-648`). The focused
  Chromium regression begins from a real stable selection, forces
  `InvalidStateError`, asserts closed/empty/unassigned state and no action
  callbacks, restores the native method, then successfully reopens and closes
  the same dialog (`test/browser/atlas-renderer.browser.test.ts:685-719`).
  Inspection confirms the failure path does not alter canvas listeners,
  gesture state, camera or selection, so the owning canvas remains operable.
- **Resolved — invalid trusted-input claim; acceptance blocker retained.**
  The custom command now rejects empty `touchStart`/`touchMove` and non-empty
  `touchEnd`/`touchCancel` payloads before provider dispatch
  (`vitest.config.ts:16-25`). The trusted regression contains only
  protocol-valid input and now asserts two distinct browser pointer IDs, both
  final lifts, pinch/centroid camera values, unchanged positions and exactly
  one persistence callback
  (`test/browser/atlas-renderer.browser.test.ts:511-570`). It no longer sends
  or asserts a partial lift or survivor move. This is an accurate narrowing,
  not a concealed weakened claim: the combined trusted-continuation acceptance
  checkbox is unchecked, the scope, blocker, evidence and retrospective all
  state that the provider-backed partial-lift path remains unsupported
  (`.10x/tickets/2026-07-26-mobile-touch-interaction.md:28-30,94-98,224-232,
  268-273,395-397`).
- Repository inspection found no BiDi/WebDriver implementation, new
  dependency, lockfile, screenshot, attachment or browser-report artifact.
  The P5a mouse, pen, keyboard, List, stable-ID capability and owning-window
  assertions remain present; the repair adds two focused regressions and
  narrows only the claim that the prior invalid CDP sequence could not prove.
  The journaled focused checks, 20-file/96-test run, build and diff check were
  accepted as supplied and were not rerun during this re-review.

### Re-review Current Findings

No new source or regression defect was found in the authorized repair scope.
The previously invalid CDP proof and both runtime error-path findings are
repaired. The already-declared trusted partial-lift acceptance gap remains a
real external harness blocker, not a repaired or passing criterion.

### Current Verdict

**blocked.** The authorized repair round passes independent focused review, but
P5b as a whole cannot pass while normative contracts 37-38 and the trusted
one-finger-continuation acceptance path lack protocol-valid provider-backed
evidence. Status must remain `blocked` until an authorized trusted-input seam
supplies that evidence and receives independent re-review.

### Re-review Residual Risk

The pure controller still provides deterministic partial-lift and
re-baselining evidence, and the provider-backed test proves a real simultaneous
two-pointer pinch through final release. It does not prove the browser
transition from two active touches to one surviving touch. Live Obsidian
Mobile, P3b modal stacking, assistive technology and real pop-out behavior
remain outside this automated repair boundary.

### Final Amendment Disposition

- The amended authority is internally coherent and does not change required
  product behavior. Normative contract 37 assigns simultaneous trusted
  pinch/centroid pan through final release to provider-backed Chromium;
  contract 38 assigns stable-ID partial lift, re-baselining, no-jump,
  one-finger continuation and one final persistence notification to
  deterministic isolated coverage; contract 39 retains the complete remaining
  browser matrix. The real integrated partial-lift transition remains
  explicitly assigned to P7/manual Obsidian Mobile validation
  (`.10x/specs/mobile-touch-interaction.md:167-191,349-354`).
- The protocol-valid Chromium test satisfies its amended authority: it rejects
  the former invalid end payload, records two distinct trusted pointer IDs,
  observes both final lifts, proves bounded pinch plus centroid camera change,
  leaves node positions unchanged and receives exactly one layout callback
  (`test/browser/atlas-renderer.browser.test.ts:511-570`). Neither that test nor
  the current ticket claims trusted integrated partial lift.
- The non-finite-coordinate, pointer-capture and modal-open findings remain
  repaired with the source guards and focused assertions recorded in the
  preceding Repair Disposition. Inspection found no regression to the P5a
  mouse, pen, keyboard, List, stable capability or owning-window boundaries,
  and no abandoned BiDi code, dependency, lockfile or browser artifact.
- All current ticket criteria outside the isolated partial-lift persistence
  assertion identified below map to current source, actual assertions or the
  accepted journaled 20-file/96-test, build and diff evidence. Executor gates
  were not rerun during this final independent review.

### Final Findings

- **Significant — the authoritative isolated partial-lift test does not prove
  one final persistence notification across survivor moves.** The amended
  contract explicitly makes deterministic controller coverage authoritative
  for partial-lift persistence cardinality
  (`.10x/specs/mobile-touch-interaction.md:179-185`; ticket criterion
  `.10x/tickets/2026-07-26-mobile-touch-interaction.md:94-96`). The focused
  test asserts `persistLayout === false` on the first lift and `true` on the
  final lift, but its no-jump and continuing one-finger moves inspect only the
  returned camera (`test/touch-gesture.test.ts:64-73`). Concrete mutation:
  return `persistLayout: true` from either post-lift `move()` result; every
  current assertion in that test still passes even though the renderer would
  invoke an extra layout callback through `applyTouchUpdate()`. The current
  source correctly returns false for moves, but the ratified verification
  boundary requires the isolated test itself to protect that behavior. Assert
  false on both the no-jump and continued-move updates, or count all truthy
  persistence decisions across the complete sequence and require exactly one.

### Final Verdict

**fail.** The user-ratified layered verification boundary is valid, the trusted
Chromium claim is now honest and the prior runtime findings remain repaired.
However, one behavior placed expressly under authoritative isolated coverage
is not protected by the actual assertions, so every checked ticket acceptance
criterion is not yet supported. Keep status `active`; after the focused
persistence-cardinality assertion is added and passes, this ticket needs final
independent re-review before orchestrator closure.

### Final Residual Risk

Even after the isolated assertion is repaired, automation will intentionally
not prove a real browser two-to-one transition. That remains a visible
P7/manual Obsidian Mobile item under the amended authority. Live P3b modal
stacking, assistive technology and real pop-out behavior likewise remain
outside P5b's automated certification boundary.

### Final Assertion Repair Disposition

- **Resolved — isolated partial-lift persistence cardinality.** The
  authoritative sequence still lifts pointer 2 while pointer 1 survives and
  asserts no persistence on that first lift. It now captures both subsequent
  pointer-1 updates and explicitly asserts `persistLayout === false` for the
  stationary no-jump update and the continuing one-finger pan; the final
  pointer-1 release remains the sole `persistLayout === true` result
  (`test/touch-gesture.test.ts:58-76`).
- The repair preserves the behavior assertions that give those flags meaning:
  the first survivor update's camera still equals the pre-lift camera exactly,
  and the next update still proves the expected `+20`/`+15` continuation from
  that re-baseline. Ending pointer 2 followed by both moves and final release
  through pointer 1 continues to prove stable surviving-pointer identity; no
  camera, no-jump, re-baselining, continuation or final-tap assertion was
  removed or weakened.
- Comparison with the preceding independent review found no product source,
  specification, browser test or earlier Review-boundary change. Only the two
  missing `persistLayout === false` assertions and their journal/evidence
  record were added. The journaled focused 1/1 result, 20-file/96-test full
  run, build and diff check were accepted as supplied; no executor gate was
  rerun during this final re-review.

### Final Current Findings

None. The last significant assertion gap is repaired, all historical runtime
and trusted-input findings remain resolved under the user-ratified verification
boundary, and every current ticket acceptance criterion has supporting source,
actual assertions, journaled gate evidence or an explicit P7/manual owner.

### Final Current Verdict

**pass.** The partial-lift isolated test now protects stable pointer identity,
re-baselining, no camera jump, continuing one-finger pan and exactly one final
persistence decision. The protocol-valid Chromium suite retains its distinct
trusted simultaneous-pinch/final-release authority, and no P5b automated or
source-inspection closure blocker remains. Keep status `active` for the
orchestrator's closure step.

### Final Current Residual Risk

Automation intentionally does not claim a real integrated two-to-one touch
transition. P7/manual Obsidian Mobile validation must still exercise partial
lift and survivor continuation in the actual WebView. Live P3b modal stacking,
assistive technology and real pop-out behavior remain outside P5b's automated
certification boundary.

## Retrospective

Keeping camera arithmetic and arbitration in a pure controller made the
ratified 500 ms/8 pixel rules reviewable without depending on browser timing.
The renderer integration then became a narrow translation layer: pointer
events update controller state, camera snapshots are applied, and stable IDs
are resolved only at the moment an effect is allowed.

The most important harness lesson was that trusted input coordinates cross two
coordinate spaces in Vitest Browser Mode. Playwright returns a page-relative
visual box for the scaled test iframe, while the test supplies canvas-local
CSS pixels. Explicitly measuring both sizes prevented a convincing false
positive in which touches landed on unrelated controls. A second lesson is
that Chromium accepting an out-of-contract CDP payload is not evidence of
portable gesture semantics: the harness now rejects that payload and limits
its trusted claim to the protocol-valid pinch path it can actually observe.

Native dialog behavior removed custom modality complexity, but touch release
defaults still required cancelling the touch pointer event so initial sheet
focus remained on Close. Programmatic mode-switch coverage is intentional:
while a modal is open outside controls are inert to users, yet renderer
lifecycle changes must still terminate the sheet safely.

The protocol investigation exposed a verification-layer mismatch rather than
a product-state ambiguity: CDP can prove simultaneous trusted pinch through
final release, while the pure controller can deterministically prove
partial-lift pointer identity, re-baselining and continuation. The user
ratified that layered evidence boundary and kept the real integrated
transition as explicit P7/manual Obsidian Mobile validation instead of adding
another driver or preserving an invalid protocol claim. These tests still do
not certify an actual Obsidian Mobile WebView, live P3b modal stacking, a real
pop-out window or assistive technology.
