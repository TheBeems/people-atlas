Status: active
Created: 2026-07-26
Updated: 2026-07-26

# P7a — Controlled Obsidian integration harness

## Purpose

Establish the first bounded P7 integration layer: exercise the actual People
Atlas plugin, `PersonIndex`, standalone view and Bases view together in real
Chromium against one controlled Obsidian contract runtime.

This contract closes the gap between isolated unit/browser tests and component
integration without claiming that a fake runtime certifies live Obsidian
Desktop, Bases UI, pop-outs, assistive technology or Mobile.

## Governing Contract

### Harness boundary and fidelity

1. P7a MUST add a separately named Vitest integration project that runs in the
   existing Playwright-backed Chromium provider.
2. Integration tests MUST instantiate the exported `PeopleAtlasPlugin` class
   and obtain standalone and Bases views through the factories registered by
   `onload()`. They MUST NOT use `Object.create()` to call private view methods
   in isolation.
3. One reusable controlled runtime MUST provide the Obsidian API surface
   consumed by this integration path:
   - `Component` child and registered-event ownership;
   - `Plugin` data load/save and view, Bases-view, command, ribbon, settings-tab
     and editor-suggest registration;
   - Vault Markdown inventory, path lookup and create/rename/delete events;
   - MetadataCache file caches, resolved-link lookup, `changed` and `resolve`
     events;
   - Workspace layout-ready, active-file, leaf and active-leaf-change behavior;
   - the minimum ItemView, BasesView, QueryController/config/data and file/value
     contracts needed by the registered production factories.
4. Required runtime operations MUST have observable state and lifecycle
   behavior. A required API MUST NOT be represented by a silent no-op that
   lets an assertion pass without the production path executing.
5. Test data and assertions MUST identify people and relationships by explicit
   stable IDs and canonical paths. Display names MAY be asserted only as
   presentation output and MUST NOT become lookup keys.
6. The harness MUST use existing Vitest, Playwright and browser APIs. It MUST
   NOT add a runtime or development dependency.

### Plugin and index lifecycle

7. Calling `PeopleAtlasPlugin.onload()` MUST register the standalone view and,
   when enabled by loaded settings, the Bases view before indexing starts.
8. Plugin load MUST NOT scan the vault before the workspace layout-ready
   callback runs.
9. Triggering layout ready MUST add/load the real `PersonIndex`, perform one
   initial Markdown inventory scan and publish a canonical snapshot containing
   the seeded people and explicit relationship notes.
10. After the initial scan, controlled Vault and MetadataCache events MUST
    drive targeted updates through the real registered listeners:
    - create a Markdown note;
    - change cached frontmatter;
    - resolve a previously unresolved link target;
    - rename a Markdown note with its old path;
    - delete a note.
11. Those targeted events MUST NOT invoke another complete Markdown inventory
    scan. Their observable snapshot/delta results MUST preserve explicit
    identity, old-path removal, unresolved/ghost handling and relationship
    metadata under the active canonical graph specifications.
12. Non-Markdown Vault events MUST NOT enter the people/relationship index.

### Standalone and Bases integration

13. The harness MUST open the actual registered standalone view and load the
    actual registered Bases view in elements owned by the integration
    document.
14. Both views MUST consume the same canonical `PersonIndex` relationship
    records. The standalone visible source comes from that index; the Bases
    visible people come from its current controlled entries and mapping.
15. With the same two visible people and one explicit relationship, both views
    MUST expose those stable people and that relationship through their
    production renderer/semantic surface.
16. Changing a cached person or relationship and emitting the corresponding
    metadata event MUST update both open views without reconstructing either
    view instance.
17. Changing the Bases entry collection and invoking its production
    `onDataUpdated()` path MUST change only the Bases visible-person filter.
    Canonical explicit relationship records MUST continue to come from
    `PersonIndex`, and filtered endpoint accounting MUST remain fail-closed.
18. A rename or delete MUST leave neither view with a stale actionable old
    path. No display-name fallback or silent duplicate merge is allowed.

### Teardown and event ownership

19. The controlled standalone close/unload lifecycle MUST call the production
    `onClose()` path, run component-owned cleanup, unsubscribe the index,
    destroy its renderer and flush its latest scheduled layout state through
    the existing coordinator.
20. Unloading the Bases view MUST unsubscribe it, destroy its renderer, remove
    its root and start the existing flush path without inventing synchronous
    Obsidian lifecycle semantics.
21. Unloading the plugin/runtime component tree MUST unload `PersonIndex` and
    every event reference registered through lifecycle ownership.
22. After teardown, Vault, MetadataCache, workspace or layout-ready events MUST
    NOT change an index snapshot, render output or persisted view state.
23. The integration runtime MUST expose listener/child cleanup observably so
    teardown assertions cannot pass merely because an assertion stopped
    watching the old objects.

### CI execution

24. The default local `npm run test` and `npm run check` paths MUST include the
    named P7a integration project.
25. A focused `npm run test:integration` command MUST run only the P7a project
    and identify failures as integration-layer failures.
26. `.github/workflows/ci.yml` MUST explicitly provision the Chromium binary
    required by the installed Playwright version before `npm run check`.
27. Because P8 owns the lockfile and deterministic dependency installation,
    P7a MUST retain `npm install`, MUST NOT add a lockfile, and MUST remove or
    avoid setup-node npm-cache configuration that requires a dependency lock
    file.
28. CI MUST fail if Chromium provisioning or any Node, browser, integration or
    build gate fails. It MUST NOT skip the integration project based on hosted
    environment detection.

## Error Behavior

- A missing required fake API, invalid registration target or illegal harness
  lifecycle transition MUST throw or fail a focused assertion; it MUST NOT be
  silently ignored. Event emission after teardown remains permitted solely to
  prove that no production listener is still attached.
- Harness failures MUST report the owning layer or event transition closely
  enough to distinguish plugin registration, index lifecycle, standalone,
  Bases and cleanup failures.
- A production-behavior defect exposed during P7a MUST be recorded as a
  blocker or separate repair owner. The harness ticket does not silently gain
  authority for unrelated product behavior changes.
- Live Obsidian unavailability MUST NOT be converted into a passing live
  integration claim; live validation remains a separate P7 child.

## Scenarios

### Scenario: indexing waits for layout readiness

Given a loaded controlled vault with two explicit people and one explicit
relationship, when the plugin is loaded but layout readiness has not fired,
then the views and commands are registered but no Markdown inventory scan has
occurred. When layout readiness fires, the real index loads exactly once and
publishes the seeded canonical records.

### Scenario: targeted lifecycle changes reach both views

Given open standalone and Bases views backed by the loaded index, when
controlled create, changed, resolve, rename and delete events are emitted in
sequence, then both production view paths reflect the applicable stable-ID and
path changes without another full vault scan or a display-name lookup.

### Scenario: Bases filtering remains a view concern

Given a canonical relationship whose endpoints exist in the index, when Bases
entries hide and later restore one endpoint through `onDataUpdated()`, then the
Bases graph changes its visible people and filtered accounting while the
standalone graph and canonical index remain unchanged.

### Scenario: lifecycle teardown is complete

Given loaded views and registered plugin/index listeners, when the standalone
view closes, the Bases view unloads and the plugin component tree unloads,
then their renderer DOM, subscriptions, children and registered events are
gone, pending standalone state is flushed, and later controlled events produce
no observable change.

### Scenario: CI starts from a clean hosted runner

Given the repository has no dependency lockfile or preinstalled project
Chromium guarantee, when the CI job runs, then it installs dependencies without
lockfile-backed caching, explicitly provisions Chromium and runs the complete
Node/browser/integration/build gate.

## Acceptance Criteria

- A separately named real-Chromium integration project drives the actual
  exported plugin and both registered production view factories.
- Layout-ready deferral, one initial scan and targeted create/change/resolve/
  rename/delete behavior are integration-covered without rescans.
- Standalone and Bases surfaces demonstrate shared canonical relationship data
  and Bases-only visible-person filtering using stable identities.
- Close/unload coverage proves lifecycle-owned listener, child, renderer DOM
  and state-flush behavior within the controlled runtime.
- The focused integration command and default full suite pass locally.
- CI explicitly provisions Chromium, runs the integration project, retains
  `npm install` and introduces no lockfile or lockfile-backed npm cache.
- `npm run test`, `npm run build` and `git diff --check` pass.
- Fresh independent review returns `pass`, or non-critical residual risk is
  explicitly accepted before closure.

## Explicit Exclusions

- Live Obsidian Desktop, actual Bases UI, real pop-out, assistive-technology or
  Obsidian Mobile certification.
- Electron automation, device-farm automation or downloading Obsidian in CI.
- Generated/property-based graph invariants; these belong to a later P7 child.
- New high-DPI or real-pop-out renderer cases; these belong to a later P7
  browser-matrix child.
- Performance thresholds or rerunning/replacing P6 calibrated evidence.
- A package lockfile, deterministic installation, release workflow or
  publication hardening; these remain P8.
- New dependencies, product features, public APIs or persisted-data schemas.
- Production changes unrelated to a separately authorized defect discovered by
  the harness.
