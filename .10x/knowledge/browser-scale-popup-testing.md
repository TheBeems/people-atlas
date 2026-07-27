Status: active
Created: 2026-07-27
Updated: 2026-07-27

# Browser scale and popup testing

## Purpose

Preserve the reusable P7c boundaries for testing high-DPI canvas rendering and
top-level browser-window ownership without overstating that evidence as live
Obsidian/Electron integration.

## Device-scale matrix

- Use separate Playwright browser contexts when device-pixel ratio is part of
  the contract. Configure `contextOptions.deviceScaleFactor` per Vitest
  instance and inject the expected factor independently; never accept whatever
  `window.devicePixelRatio` happens to report as its own expected value.
- Keep the matrix narrow and discovery-disjoint. P7c runs one file at DPR `1`,
  `1.5` and `2` instead of multiplying the complete interaction suite.
- Canvas scale proof needs complementary checks:
  - CSS dimensions remain layout-pixel dimensions;
  - backing dimensions equal rounded CSS dimensions times DPR;
  - the far backing pixel is painted, proving full scaled draw coverage;
  - a provider-backed CSS-coordinate click selects the same stable node;
  - a real resize path changes both CSS and backing dimensions.
- Direct invariant assertions are more durable here than screenshot baselines
  and avoid encoding incidental theme pixels.

## Top-level popup boundary

- Open the popup synchronously inside the handler reached by a real user
  activation. Fail closed on `null` or inaccessible same-origin state; never
  fall back to an iframe, detached document or mocked window.
- Positively prove distinct `Window`/`Document`, top-level identity, retained
  opener and expected DPR before mounting the production renderer.
- Instrument only the real popup's lifecycle APIs. Wrapping its existing
  ResizeObserver and animation-frame functions preserves real rendering while
  making ownership, disconnect and cancellation observable.
- Copy already-loaded production styles into a blank same-origin popup rather
  than inventing test-only renderer layout.
- Put popup close in `finally`. Renderer teardown and browsing-context cleanup
  are separate obligations: first prove dialog/observer/frame/DOM/control
  cleanup, then always close the popup even when an assertion fails.

## Actionable failure context

- Failure diagnostics are part of the verification contract. A bounded canvas
  timeout must name DPR, owning boundary, expected CSS dimensions and expected
  backing dimensions.
- Derive expected backing dimensions once and reuse them in both predicate and
  diagnostic so failure text cannot drift from the assertion.
- Every resource-specific popup teardown assertion carries one shared
  `[DPR <factor>] popup teardown` prefix. A broad test name that also mentions
  creation and ownership is not enough to locate a teardown failure.

## Limits

- This evidence covers installed headless Playwright Chromium contexts. It does
  not certify Obsidian Desktop/Electron pop-outs, workspace-leaf integration,
  application CSS injection, operating-system monitor or runtime-DPR
  transitions, Firefox, WebKit, Mobile or assistive technology.
- Those live product boundaries remain separately owned by P7d.
