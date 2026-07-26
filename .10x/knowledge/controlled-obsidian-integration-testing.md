Status: active
Created: 2026-07-26
Updated: 2026-07-26

# Controlled Obsidian integration testing

Use these boundaries when extending People Atlas plugin, index, standalone or
Bases integration coverage after P7a.

## One controlled runtime

- Keep the controlled API surface on the existing `obsidian` test alias.
  Production and tests must share the same `Plugin`, `Component`, `TFile`,
  `ItemView`, `BasesView` and `ListValue` constructors so class identity and
  `instanceof` behavior remain meaningful.
- Required fake operations must expose observable registrations, listeners,
  children, files, caches, scans, saves and DOM. A silent no-op is not evidence
  that a production path executed.
- Preserve small historical stub contracts used by focused unit tests. In
  particular, an empty controlled `TFile` retains the Markdown extension
  default while pathful files derive their real extension.
- Missing required APIs and illegal lifecycle transitions fail loudly. Do not
  grow the runtime for unrelated Obsidian surfaces before a production path
  needs them.

## Match proof to the lifecycle

- Prove layout-ready deferral with zero scans before readiness and exactly one
  initial Markdown inventory scan after the callback loads `PersonIndex`.
- Prove targeted create/change/resolve/rename/delete behavior with stable
  snapshot values and a scan counter; incremental ordering itself is not a
  semantic contract.
- Prove unsubscribe by mutating the real index after one consumer unloads
  while another remains live. A removed renderer alone does not prove its
  subscription is gone, and plugin unload must not mask leaked view listeners.
- Prove asynchronous unload work by waiting within a bounded interval for its
  durable output and checking the owning stable key. Do not make a synchronous
  fake contract merely to simplify an assertion.
- After the complete component tree unloads, emit controlled Vault,
  MetadataCache and Workspace events and require state, saves, scans and DOM to
  remain unchanged.

## Identity and view-source proof

- Use explicit person/relationship IDs and canonical paths as test keys.
  Display labels are presentation assertions only.
- To protect the no-display-name rule, keep an unresolved ghost and diagnostic
  present while real Markdown people share the target label. Only explicit
  source-path resolution may replace the ghost with the intended stable ID.
- Standalone gets its visible people and relationships from the canonical
  index. Bases owns only its visible-person population; explicit relationship
  notes still come from `PersonIndex`.
- When testing Bases filtering, assert both the Bases result and the unchanged
  standalone/canonical sources plus filtered counts/diagnostics.

## Project and CI boundary

- Keep Node, renderer-browser and integration tests in disjoint named Vitest
  projects. The focused integration command selects only the integration
  project; the default test command includes all three.
- CI explicitly provisions the Chromium version required by the installed
  Playwright package before the full check.
- Until P8 adds deterministic dependency installation, retain `npm install`
  without setup-node's lockfile-backed npm cache and do not introduce a
  lockfile through integration work.

## Claim limits

- This runtime proves the production classes against the modeled API contract.
  It does not certify live Obsidian Desktop lifecycle ordering, actual Bases
  UI, Electron pop-outs, assistive technology or Obsidian Mobile.
- Keep those claims with the separately initiated manual P7 evidence child.

## References

- `.10x/specs/controlled-obsidian-integration-harness.md`
- `.10x/tickets/2026-07-26-controlled-obsidian-integration-harness.md`
- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `test/obsidian-stub.ts`
- `test/integration/people-atlas-plugin.integration.test.ts`
- `vitest.config.ts`
- `.github/workflows/ci.yml`
