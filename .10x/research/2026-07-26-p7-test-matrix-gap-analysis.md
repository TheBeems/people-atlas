Status: done
Created: 2026-07-26
Updated: 2026-07-26

# P7 test-matrix gap analysis

## Question

Which verified gaps remain after P1-P6, and what is the smallest sensible first
P7 slice without duplicating existing renderer, graph or performance coverage?

## Sources and Methods

Read-only inspection of:

- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`;
- the P5a, P5b, P6a and P6b terminal tickets and their residual-risk notes;
- `.10x/knowledge/renderer-interaction-boundaries.md`;
- `.10x/knowledge/performance-characterization-boundaries.md`;
- `package.json`, `vitest.config.ts`, `test/obsidian-stub.ts`;
- `.github/workflows/ci.yml` and `.github/workflows/release.yml`;
- all test filenames and declared `describe`/`it` cases under `test/`;
- `ROADMAP.md`, `ARCHITECTURE.md` and `manifest.json`.

No tests, builds, live Obsidian sessions or GitHub Actions runs were executed.

## Findings

### Existing automated coverage

- The default Vitest configuration separates Node tests from a real headless
  Chromium project.
- The renderer browser suite already covers Graph/List switching, keyboard
  navigation, relationship descriptions, stable-ID focus recovery, capability
  denial, mouse and pen behavior, reduced motion, touch controls, trusted CDP
  tap/pan/pinch/long-press input, cancellation, pointer-capture failures,
  modal failure containment and owning-secondary-window lifecycle resources.
- Pure Node tests cover canonical graph construction, incremental graph-delta
  equivalence, index lifecycle, projection, layout/view state, mutations,
  migrations, relationship forms and adapter selection/centering behavior.
- P6 provides deterministic 100/1,000/5,000-node sparse and stress fixtures,
  separate characterization commands, validated result schemas and durable
  calibrated evidence. The performance suites are `.perf.ts` workloads and are
  intentionally not default regression-threshold tests.

### Material gaps

- `vitest.config.ts` aliases every `obsidian` import to
  `test/obsidian-stub.ts`. The stub exposes only a small type/behavior surface.
  No automated test loads the plugin in a real Obsidian runtime.
- `person-index-lifecycle.test.ts`, relationship entrypoint tests and
  view-adapter tests use controlled fakes. They prove the exercised contracts,
  not actual Vault, MetadataCache, Workspace, Bases or plugin load/unload
  integration.
- The browser suite exercises an owning secondary `Document`/`Window`
  boundary, but not an actual Obsidian pop-out window.
- No explicit device-scale/high-DPI matrix exists.
- Trusted Chromium touch input proves browser protocol behavior, but not an
  Obsidian Mobile WebView or the recorded two-touch-to-one-touch partial-lift
  transition on a real device.
- No broad generated/property-based invariant suite exists. Current graph-delta
  equivalence cases and deterministic performance fixtures are valuable fixed
  examples, not randomized or generated invariant coverage.
- `.github/workflows/ci.yml` runs `npm install` and `npm run check`, but does
  not explicitly provision a Playwright browser. The repository currently has
  no lockfile. This inspection does not prove whether the current hosted run
  passes; it only identifies that browser provisioning and deterministic
  dependency installation are not encoded in the workflow.
- `manifest.json` declares `isDesktopOnly: false`, so the unverified Mobile
  boundary is a product claim boundary rather than optional desktop-only work.

## Conclusions

1. P7 should not begin by recreating P5 renderer cases or P6 characterization
   fixtures.
2. The highest-value first child is an integration-boundary slice covering
   plugin/index/view-adapter lifecycle against a substantially realistic
   Vault/MetadataCache/Workspace/Bases harness, with explicit CI execution.
3. Such a controlled harness still cannot certify live Obsidian Desktop,
   actual Bases UI, pop-out integration, assistive technology or Mobile.
   Those claims need a separately owned live/manual validation slice unless the
   user explicitly chooses a supported real-runtime automation strategy.
4. Later independent P7 children should own:
   generated graph/index invariants; missing high-DPI and real-pop-out browser
   cases; and live Obsidian Desktop/Bases/Mobile validation. Fixed performance
   fixtures should be reused, not regenerated, and thresholds should not be
   invented from P6 characterization evidence.
5. A P7 parent plan plus bounded children is more coherent than one executable
   omnibus ticket because the CI harness, generated invariants, browser matrix
   and live/manual evidence have different tools, failure modes and proof
   limits.

## Open Decisions

- Whether P7's live Obsidian Desktop/Bases/Mobile boundary is manual evidence
  or must use real-runtime automation.
- Whether P7a may update CI/browser provisioning now, while deterministic
  dependency installation and release hardening remain P8.
- The exact minimum plugin/index/view-adapter scenarios required for the first
  controlled integration harness.

## Limits

- Static inspection does not establish the current GitHub Actions result.
- A realistic fake can expose adapter contract regressions but cannot substitute
  for a live Obsidian runtime.
- Actual desktop, mobile, assistive-technology and pop-out feasibility was not
  tested in this investigation.
