Status: active
Created: 2026-07-27
Updated: 2026-07-27

# P7c — High-DPI and popup browser matrix

## Purpose

Add a narrow real-Chromium matrix that proves the existing renderer's canvas
scale behavior and ownership inside a genuine same-origin top-level browser
popup. This contract extends P5's browser evidence without repeating its full
keyboard, pointer, touch or semantic interaction suite.

This is browser evidence only. A Chromium popup MUST NOT be represented as an
Obsidian Desktop/Electron pop-out; that live product boundary remains P7d.

## Governing Contract

### Matrix isolation

1. P7c MUST add a separately named Vitest browser project for matrix tests.
2. The project MUST run one disjoint matrix-test path in Playwright Chromium
   contexts whose configured `deviceScaleFactor` values are exactly `1`,
   `1.5` and `2`.
3. Each instance MUST expose its expected factor to the test through
   typed per-instance provided context. A test MUST compare the real
   `window.devicePixelRatio` with that expected value; it MUST NOT infer the
   expected value from browser defaults or a test name.
4. The existing P5 browser project and P7a integration project MUST NOT
   discover the P7c matrix file. Existing browser, touch and integration tests
   MUST remain unchanged.
5. P7c MUST use the installed Vitest, Playwright and browser APIs. It MUST NOT
   add a dependency, lockfile or custom browser launcher.

### High-DPI canvas proof

6. At every configured factor, the production `AtlasRenderer` MUST mount in a
   real Chromium document with a non-zero, explicitly controlled CSS size.
7. After renderer resize/draw has settled:
   - canvas CSS width and height MUST equal its layout dimensions in CSS
     pixels;
   - canvas backing width and height MUST equal the rounded CSS dimensions
     multiplied by the owning window's device-pixel ratio;
   - the rendered background MUST cover the far backing-store pixel, proving
     that drawing used the full scaled backing store rather than only the CSS
     pixel extent.
8. A real browser click at the CSS center of a one-node graph MUST select that
   node by stable ID at every factor. Device-pixel scaling MUST NOT change
   pointer hit-testing coordinates.
9. When the controlled container size changes and the real resize path
   settles, CSS and backing-store dimensions MUST update to the new size and
   ratio without retaining the old backing dimensions.
10. P7c MUST NOT introduce screenshot baselines or pixel-perfect color/layout
    snapshots. Assertions MUST target scale, coverage and interaction
    invariants only.

### Real browser popup proof

11. The popup case MUST create a same-origin top-level browsing context through
    a user-activated `window.open()` call.
12. The case MUST positively prove that the popup:
    - is a distinct `Window` and `Document` from the opener;
    - is top-level rather than an iframe;
    - retains the opener relationship;
    - exposes the expected matrix device-pixel ratio.
13. If popup creation returns `null`, produces an inaccessible document or is
    blocked, the case MUST fail. It MUST NOT fall back to an iframe, detached
    document or mocked plain object.
14. The production renderer MUST mount directly into the popup document. Its
    root, canvas, semantic controls and native details dialog MUST all belong
    to that popup document.
15. Popup-owned animation-frame and ResizeObserver use MUST be observable.
    The opener's corresponding lifecycle APIs MUST NOT satisfy those
    assertions.
16. Minimal popup interaction MAY exercise Graph/List selection and the native
    details dialog only to prove document, focus and constructor ownership.
    It MUST NOT duplicate the complete P5 interaction matrix.
17. `destroy()` MUST close any open renderer dialog, disconnect the
    popup-owned observer, cancel a pending popup-owned animation frame and
    remove all renderer DOM. Later clicks on captured renderer controls MUST
    not reactivate renderer state.
18. The test MUST close the popup in guaranteed cleanup even when an assertion
    fails, so a failed case cannot leak a browsing context into later tests.

### Execution and failure ownership

19. A focused `npm run test:browser-matrix` command MUST run all three P7c
    scale instances and no P5 browser or P7a integration cases.
20. The unqualified `npm run test` and existing `npm run check` paths MUST
    include P7c. Existing explicit CI Chromium provisioning is sufficient;
    P7c MUST NOT change the CI workflow merely to add its discovered project.
21. Failures MUST identify the owning matrix instance and whether the failed
    boundary is main-document scale, resize, popup creation, popup ownership or
    popup teardown.
22. A valid P7c case that exposes a production defect MUST be recorded as a
    blocker. P7c does not implicitly authorize product-source repair.

## Error Behavior

- A configured device scale that is not reflected by the real browser context
  is a provider/configuration failure and MUST fail explicitly.
- Canvas dimensions are compared after a bounded browser wait for the real
  resize/draw path. A timeout MUST fail with the factor and expected
  dimensions; it MUST NOT be converted into a skip.
- Popup blockers, missing same-origin access and lifecycle ownership mismatches
  MUST fail rather than degrade to the existing iframe proof.
- Test instrumentation MAY replace lifecycle APIs only on the real popup
  window to make ownership observable. It MUST restore or discard them by
  closing that popup during cleanup.

## Scenarios

### Scenario: backing store follows device scale

Given the matrix runs the renderer at DPR 1, 1.5 and 2

When a fixed-size one-node graph is drawn

Then CSS dimensions remain layout-sized, backing dimensions equal rounded CSS
size times DPR, the full backing store is painted and a CSS-center click
selects the same stable node at every factor.

### Scenario: resize remains scale-correct

Given a mounted matrix renderer

When its container changes to a second controlled CSS size

Then the real resize path updates CSS and backing dimensions for the active DPR
without retaining the former backing size.

### Scenario: renderer owns a real browser popup

Given a user gesture opens a same-origin top-level browser popup

When `AtlasRenderer` mounts and opens its native details surface there

Then DOM, canvas ratio, focus, dialog, animation frame and resize observer all
belong to the popup, and destroy plus popup cleanup leaves no renderer-owned
resource.

## Acceptance Criteria

- A disjoint named Chromium browser-matrix project runs DPR `1`, `1.5` and `2`
  with typed expected-factor injection.
- High-DPI assertions prove real context DPR, CSS/backing dimensions, far-pixel
  coverage, CSS-coordinate stable-ID selection and scale-correct resize.
- A user-activated `window.open()` test proves a distinct same-origin top-level
  popup without iframe or detached-document fallback.
- Popup assertions prove production renderer DOM, dialog/focus and lifecycle
  ownership plus complete teardown.
- `npm run test:browser-matrix`, `npm run test`, `npm run build` and
  `git diff --check` pass.
- Existing P5 browser, P7a integration and P7b generated tests remain
  unchanged and continue to pass through their existing owners.
- No dependency, lockfile, CI workflow, product source, persisted schema,
  performance threshold or release change.
- Fresh independent review returns `pass`, or non-critical residual risk is
  explicitly accepted before closure.

## Explicit Exclusions

- Live Obsidian Desktop, Electron, workspace-leaf or operating-system pop-out
  certification.
- Moving an existing window between monitors or runtime DPR changes.
- Firefox, WebKit, mobile WebView or assistive-technology matrices.
- Screenshot baselines, visual-regression infrastructure or pixel-perfect
  theme rendering.
- Reimplementation of P5 keyboard, semantic, mouse, pen, touch, reduced-motion
  or modal-failure cases.
- P6 performance workloads or thresholds.
- Product-source repair without separate authorization.
- P8 dependency-installation, lockfile or release hardening.
