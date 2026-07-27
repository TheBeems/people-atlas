Status: done
Created: 2026-07-27
Updated: 2026-07-27

# P7c browser scale and popup feasibility

## Question

What is the smallest automated P7c slice that proves high-DPI canvas behavior
and a real top-level browser popup without claiming live Obsidian/Electron
pop-out coverage or duplicating P5 interaction tests?

## Sources and Methods

Read-only inspection of:

- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`;
- `.10x/knowledge/renderer-interaction-boundaries.md`;
- the P5a/P5b specifications and terminal tickets;
- `src/render/atlas-renderer.ts`;
- `test/browser/atlas-renderer.browser.test.ts`;
- `vitest.config.ts` and `package.json`;
- installed local type declarations and README for Vitest `4.1.10`,
  `@vitest/browser-playwright` `4.1.10` and Playwright `1.62.0`.

No tests, browser sessions, popup probes, builds or external searches were run.

## Findings

### Existing implementation and proof

- `AtlasRenderer.resize()` reads `devicePixelRatio` from the container's owning
  window, sizes the backing canvas to rounded CSS dimensions times that ratio,
  keeps CSS dimensions in layout pixels and draws with that ratio as the
  context transform.
- Pointer hit-testing uses client/CSS coordinates relative to the canvas
  bounding rectangle. Existing Chromium tests prove center selection at the
  default scale but do not execute an explicit device-scale matrix.
- Existing secondary-window coverage mounts in a same-origin iframe, replaces
  that frame's animation-frame and ResizeObserver APIs observably, verifies
  owning-document dialog/focus behavior and teardown, and rejects a detached
  document. It does not open a top-level browser window.

### Supported local configuration seam

- The installed Playwright Vitest provider exposes
  `PlaywrightProviderOptions.contextOptions`, which accepts Playwright
  `BrowserContextOptions`, including numeric `deviceScaleFactor`.
- Vitest browser instances may override their provider and project
  configuration. Per-instance `provide` data can expose the expected factor to
  the browser test without inferring it from a name.
- A separate browser project can therefore run one narrow matrix file in
  Chromium contexts at factors `1`, `1.5` and `2` without repeating the full
  P5 browser suite at every factor.

### Evidence boundary

- A same-origin top-level window created by user-activated `window.open()` is a
  stronger browser ownership boundary than the current iframe. It can prove
  that renderer DOM, canvas scale, focus, dialog and lifecycle resources come
  from that actual popup browsing context.
- Such a popup is still not an Obsidian Desktop/Electron pop-out. It does not
  exercise Obsidian workspace leaves, Electron window creation, app CSS
  injection, plugin unload ordering or operating-system monitor transitions.
- Direct backing-store and pixel-coverage assertions are more stable for this
  contract than screenshot baselines. A CSS-coordinate center interaction can
  additionally prove that device pixels do not leak into hit-testing.

## Conclusions

1. P7c should add one disjoint `browser-matrix` Vitest project with Chromium
   instances at DPR `1`, `1.5` and `2`.
2. The high-DPI case should prove actual context scale, CSS/backing-store
   dimensions, full backing-store draw coverage, CSS-coordinate hit-testing
   and resize behavior.
3. The popup case should open a real same-origin top-level browser window,
   mount the production renderer there, prove popup-owned scale/lifecycle/
   dialog/focus behavior and tear it down without iframe fallback.
4. Existing P5 interaction, touch and iframe cases should remain unchanged.
5. Live Obsidian/Electron pop-out and monitor-transition validation remains a
   P7d manual/live boundary.

## Limits

- Static source/type inspection establishes an available configuration seam,
  not that popup creation or all three contexts currently pass.
- Only the locally installed versions were inspected; later provider upgrades
  must be rechecked before changing the matrix configuration.
- Chromium coverage does not establish Firefox, WebKit, Electron or live
  Obsidian behavior.
