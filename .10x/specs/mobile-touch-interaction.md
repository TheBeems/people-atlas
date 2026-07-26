Status: active
Created: 2026-07-26
Updated: 2026-07-26

# P5b — Mobile touch interaction

## Purpose

Complete the mobile half of P5 without weakening the accessible semantic
renderer delivered by P5a. Touch users receive predictable map-like canvas
gestures, discoverable native controls and one guarded action sheet; mouse,
pen, keyboard and List mode retain their existing behavior.

The implementation remains renderer-owned and consumes only the current
`AtlasSnapshot`, stable node identity and explicit callbacks. It does not read
vault data, decide canonical write eligibility or write notes.

## Scope

This specification governs:

- touch tap, one-finger pan and two-finger pinch/pan arbitration;
- long press on a graph node;
- renderer-owned Zoom out, Zoom in, Fit and Details controls;
- a native modal bottom sheet shared by Details and long press;
- action capability hand-off from standalone and Bases views;
- touch target sizing, safe-area layout and reduced-motion behavior;
- owning-window lifecycle and real Chromium multi-touch verification.

It extends `.10x/specs/accessible-semantic-renderer.md`. Every P5a identity,
selection, focus, semantic-detail, capability and cleanup rule remains
normative unless this specification explicitly adds touch behavior.

## Normative contract

### Input separation

1. Pointer behavior MUST branch on `pointerType`. `touch` follows this
   specification. `mouse` and `pen` MUST retain P5a canvas selection, node
   drag, pan, double-click, wheel and keyboard behavior.
2. Touch MUST NOT drag or reposition an individual node. A one-finger move
   always pans the camera, including when it starts over a node.
3. `touch-action: none` MUST be scoped to the interactive graph canvas. The
   surrounding Obsidian view, List mode and sheet content MUST retain ordinary
   page scrolling.
4. Pointer tracking, timers, capture and event construction MUST use the
   renderer container's owning `Document` and `Window`; no global `window`
   fallback is allowed.

### Tap and one-finger pan

5. A first touch records its stable pointer ID, start/current canvas
   coordinates, hit-tested stable `NodeId` if any, start time and the current
   camera baseline. Touch down alone MUST NOT select, move a node, open a
   sheet or persist layout.
6. Releasing that touch before 500 ms with total movement no greater than 8
   CSS pixels is a tap. A tap on a node selects it with `canvas` provenance;
   a tap on empty canvas clears selection. It MUST NOT open, center or create.
7. Once total movement exceeds 8 CSS pixels, the interaction becomes a pan
   and the pending tap and long press are cancelled. Camera translation MUST
   follow the touch delta without moving any node.
8. A completed pan MUST request layout persistence exactly once when the last
   active touch ends. A tap, cancelled touch or movement within the threshold
   MUST NOT request layout persistence.

### Two-finger pinch and pan

9. Adding a second active touch cancels pending tap and long press and begins
   a two-pointer gesture. Additional touches MAY be tracked for cleanup but
   MUST NOT change the active pair until one of that pair ends.
10. Pinch scale MUST use the ratio between the active pair's current and prior
    distance, apply the existing camera scale bounds and keep the graph point
    under the pair's centroid stable. Centroid movement in the same update
    MUST pan the camera.
11. Pinch processing MUST be independent of pointer-event delivery order:
    each update uses the latest coordinates for both active pointers and then
    establishes a new baseline.
12. When one pointer of the active pair ends, any remaining touch MUST receive
    a fresh one-finger baseline at its current coordinate. It MAY continue as
    pan, but MUST NOT become a tap or long press and MUST NOT jump the camera.
13. A multi-touch interaction MUST request layout persistence at most once,
    after the final active touch ends, and only when it changed the camera.

### Long press

14. Holding one unmoved touch on a node for 500 ms MUST select that stable node
    with `canvas` provenance and open its action sheet. The gesture MUST NOT
    automatically invoke Open, Center or Create relationship.
15. Movement greater than 8 CSS pixels, a second pointer, pointer release,
    `pointercancel`, renderer destruction or replacement of the target node
    before 500 ms MUST cancel the pending long press.
16. Long press on empty canvas MUST do nothing beyond the ordinary eventual
    tap/clear behavior. After a long press opens the sheet, movement and
    release from that same touch MUST NOT pan, tap again or invoke layout
    persistence.
17. Long-press timers MUST be lifecycle-owned and cleared on every terminal or
    replacement path. At most one action sheet may be open per renderer.

### Mobile graph controls

18. In Graph mode the shared renderer MUST expose native `Zoom out`,
    `Zoom in`, `Fit` and `Details` buttons in a discoverable graph action bar.
    These controls provide simple single-pointer alternatives to pinch and
    multi-step canvas interaction.
19. `Zoom out` and `Zoom in` MUST use the existing bounded camera zoom
    semantics around the visible canvas center. `Fit` MUST invoke the existing
    `fitToContent()` behavior. Each completed button action that changes the
    camera MUST request layout persistence exactly once.
20. `Details` MUST be disabled when no node is selected. Activating it MUST
    open the same action sheet as long press for the current stable selected
    node.
21. On a narrow or coarse-pointer presentation, the four graph-action
    controls and the Graph/List mode buttons MUST each have a measured target
    box of at least 44 by 44 CSS pixels. Labels or unambiguous accessible names
    MUST be present; color or icon shape alone is insufficient.
22. The graph action bar MUST not duplicate projection or center-mode
    configuration. Standalone keeps those controls in its existing toolbar;
    Bases keeps configuration in its owning surface.

### Action sheet

23. The action sheet MUST use the owning document's native modal `<dialog>`
    element, visually presented as a bottom sheet on narrow/coarse layouts.
    It MUST have an accessible name, an explicit `Close` button, native
    `Escape` dismissal and a focusable element that receives initial focus.
24. While open, focus MUST remain within the modal dialog. Closing without an
    action MUST return focus to the `Details` button when that button opened
    it, or to the graph canvas when long press opened it and the canvas still
    exists. No swipe-to-dismiss gesture is introduced.
25. The sheet MUST render the selected node's stable-ID-backed display data
    and the same incident relationship descriptions as P5a List details.
    Parallel edges remain distinct; missing metadata is omitted; status is
    never inferred.
26. A resolved actionable person MAY expose native `Open note` and
    `Use as center` buttons. `Create relationship` MUST appear only when the
    owning view explicitly grants that capability for the exact selected
    stable node and supplies the callback.
27. Ghost, ambiguous, pathless or otherwise non-actionable records MUST show
    an explanation and `Close` only. They MUST NOT acquire Open, Center or
    Create capability from label, list position or a stale prior selection.
28. Before invoking an action callback, the sheet MUST close and release its
    modal/focus lifecycle. Actions then delegate to the owning callback
    exactly once.
29. Create relationship continues to open P3b's explicit Save/Cancel modal.
    Opening or closing the sheet, selection, zoom, pan and long press MUST
    never write a vault file.
30. The sheet MUST respect Obsidian CSS variables, viewport/safe-area insets,
    available height and ordinary content scrolling. Any introduced
    transition MUST be absent or honor `prefers-reduced-motion`.

### Dynamic state and cleanup

31. `setGraph()` MUST preserve an open sheet only when its selected stable
    `NodeId` still exists. It MUST refresh that node's data, relationships and
    explicit capabilities without stealing focus from the current equivalent
    sheet control.
32. If the sheet's selected node disappears or becomes non-selected,
    `setGraph()` MUST close the sheet, cancel active gestures and follow the
    P5a stable-ID focus recovery contract. It MUST NOT search by display name.
33. Switching to List mode MUST cancel active graph gestures and close the
    graph action sheet. Switching back MUST not restore a cancelled gesture or
    reopen the sheet.
34. `destroy()` MUST close/remove the dialog, cancel every timer and active
    gesture, release owned pointer capture where possible and remove every
    newly owned listener. No callback may fire after destruction.

### Verification boundary

35. Gesture arbitration and camera math MUST have deterministic pure or
    isolated unit tests for thresholds, state transitions, cancellation,
    re-baselining, clamping and single persistence notification.
36. Renderer integration MUST continue to run in Vitest Browser Mode with the
    Playwright Chromium provider.
37. Pinch acceptance MUST use provider-backed real browser touch input through
    a Playwright Chromium CDP session or an equivalent trusted multi-touch
    path for simultaneous two-contact pinch, centroid pan and final release.
    Manually constructing `PointerEvent` objects MUST NOT be the sole proof of
    pinch behavior.
38. The two-to-one partial-lift transition and continuing one-finger pan MUST
    have deterministic isolated controller coverage for stable pointer
    identity, re-baselining, no camera jump and one final persistence
    notification. The current Playwright Chromium provider is not required to
    prove that transition because its protocol-valid CDP input cannot release
    one active contact while another remains. The same transition MUST remain
    an explicit P7/manual Obsidian Mobile validation item.
39. Browser coverage MUST include trusted touch tap, node-origin pan,
    simultaneous two-contact pinch plus centroid pan through final release,
    long-press timing and every cancellation path, sheet
    focus/dismissal/action guards, 44-pixel targets, mouse/pen regression,
    reduced motion, cleanup and a secondary same-origin owning window or
    frame.

## Given/When/Then scenarios

### Pan from a node without dragging it

Given one touch starts over a positioned person node

When it moves more than 8 CSS pixels and releases

Then the camera pans, the node position is unchanged, no tap or long press
fires, and layout persistence is requested once.

### Pinch and continue with one finger

Given two touches are active on the graph

When their distance and centroid change, one lifts, and the remaining touch
continues moving

Then bounded zoom and centroid pan are applied without a camera jump, the
remaining touch continues as pan, and persistence is requested once after the
last touch ends.

### Open details without an accidental action

Given a resolved person is beneath one stationary touch

When the touch remains within 8 CSS pixels for 500 ms

Then that stable node is selected and its modal sheet opens with focus inside,
but Open, Center and Create callbacks remain untouched.

### Cancel long press

Given a long press is pending on a node

When the user moves beyond 8 CSS pixels, adds a second touch, releases,
cancels, switches mode or the node disappears

Then the timer is cleared and the sheet does not open later.

### Use a discoverable alternative

Given a selected person in Graph mode on a narrow viewport

When the user activates Details instead of long pressing

Then the identical selected-node sheet opens, and closing it returns focus to
Details.

### Deny ambiguous actions

Given a prior canonical person had Create capability and an ambiguous node is
now selected

When its sheet opens

Then the ambiguous record is explained, only Close is available and no stale
Open, Center or Create capability survives.

## Acceptance criteria

- [ ] Touch tap selects or clears only on release within the ratified
      500 ms/8 CSS pixel bounds.
- [ ] One-finger touch always pans the camera, including from a node, and
      never moves node positions.
- [ ] Two-finger pinch applies bounded zoom and centroid pan, re-baselines
      safely after a lift and persists once after the complete gesture.
- [ ] Long press opens the selected node's sheet only after 500 ms and every
      specified movement, pointer, lifecycle and graph-update path cancels it.
- [ ] Mouse, pen, keyboard and P5a List behavior remain unchanged.
- [ ] Renderer-owned Zoom out, Zoom in, Fit and Details controls are
      discoverable; touch presentation gives them and Graph/List at least
      44-by-44 CSS pixel targets.
- [ ] Details and long press open one native modal sheet with accessible
      naming, focus containment, Escape/Close dismissal and correct
      focus return.
- [ ] Sheet details preserve stable IDs, explicit relationship semantics and
      parallel edges without inferred metadata.
- [ ] Open/Center/Create buttons are present only for explicit current
      capabilities; ghosts, ambiguous and stale selections are information
      only.
- [ ] The action sheet delegates actions exactly once and introduces no vault
      write or implicit relationship mutation.
- [ ] Narrow/coarse layout uses Obsidian variables, safe-area-aware sizing,
      scrollable content and reduced-motion-safe behavior.
- [ ] Gestures, dialog, timers, listeners and pointer capture belong to the
      owning window and clean up across mode changes, graph replacement,
      secondary windows and destruction.
- [ ] Pure/isolated gesture tests cover the complete gesture state machine,
      including partial-lift continuation; Playwright Chromium browser tests
      cover trusted simultaneous multi-touch pinch/centroid pan through final
      release rather than synthetic pointer events alone.
- [ ] Real Obsidian Mobile partial-lift/one-finger continuation remains an
      explicit P7/manual validation item and is not claimed by automation.
- [ ] Existing Node and browser regressions remain passing.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Error behavior

- If a pointer event lacks usable finite coordinates, ignore that update and
  terminate safely on its eventual release/cancel; never corrupt camera or
  node state.
- If pointer capture fails or is already lost, continue from the tracked
  stable pointer ID and clean up without throwing.
- If native modal opening fails because the dialog is detached or another
  lifecycle transition won, leave the sheet closed, clear its state and keep
  the canvas operable.
- If a selected node or capability changes while the sheet is open, refresh
  by stable ID and remove invalid actions immediately; stale callbacks MUST
  NOT remain invokable.
- A browser-provider or Chromium CDP failure is a failed acceptance gate, not
  permission to claim pinch coverage from hand-dispatched events.

## Exclusions

- Touch node dragging, lasso selection, edge selection or relationship-note
  navigation.
- Swipe-to-dismiss, momentum/inertial pan, double-tap zoom or haptic feedback.
- Persisting Graph/List mode or an open sheet.
- Moving projection/center configuration into the renderer.
- Automatic relationship creation, automatic action execution or status
  inference.
- A new dependency lockfile or other P8 release-hardening work.
- Full live Obsidian mobile-device, screen-reader or pop-out certification;
  those remain P7/manual validation gates.
- Worker physics, image cache, clustering and performance thresholds.

## Ratified and record-backed decisions

1. **Touch mapping.** User-ratified on 2026-07-26: tap selects; one-finger
   drag always pans even from a node; two fingers pinch-zoom and centroid-pan;
   touch never drags nodes while mouse and pen keep existing node drag.
2. **Long press.** User-ratified on 2026-07-26: 500 ms on a node opens an
   action sheet only; movement greater than 8 CSS pixels, a second pointer or
   release/cancel aborts; no action auto-executes; ghost and ambiguous records
   remain explanation-only.
3. **Mobile controls.** User-ratified on 2026-07-26: provide 44-pixel Zoom
   out, Zoom in, Fit and Details targets plus enlarged Graph/List targets;
   Details opens the same sheet as long press; projection and center controls
   remain in their existing owning surfaces.
4. **Accessibility alternative.** WCAG 2.2 guidance observed on 2026-07-26
   requires a simple single-pointer alternative for multipoint/path gestures
   and dragging:
   `https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures` and
   `https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html`.
5. **Dialog behavior.** W3C HTML-dialog guidance observed on 2026-07-26
   records modal focus containment, Escape dismissal and focus return to the
   invoker:
   `https://www.w3.org/WAI/WCAG22/Techniques/html/H102`.
6. **Pointer mechanics.** Pointer Events guidance observed on 2026-07-26
   defines declarative `touch-action`, multi-pointer tracking and pointer
   capture:
   `https://www.w3.org/TR/pointerevents/`.
7. **Browser proof.** Vitest Browser Mode custom-command guidance observed on
   2026-07-26 exposes Chromium CDP sessions through its Playwright provider:
   `https://vitest.dev/guide/browser/commands`.
8. **Partial-lift verification boundary.** User-ratified on 2026-07-26 after
   bounded protocol investigation: preserve partial lift and one-finger
   continuation as required product behavior, prove their state-machine
   semantics in deterministic isolated tests, prove simultaneous pinch through
   final release with trusted Chromium input, and defer the real integrated
   partial-lift transition to P7/manual Obsidian Mobile validation.
