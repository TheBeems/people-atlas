Status: done
Created: 2026-07-26
Updated: 2026-07-26

# P7a — Controlled Obsidian integration harness

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-incremental-graph-delta-performance.md`

## Scope

Implement `.10x/specs/controlled-obsidian-integration-harness.md` as the first
bounded P7 child:

1. build one reusable controlled Obsidian runtime on the existing test alias;
2. add a named real-Chromium integration project that instantiates the exported
   plugin and opens its registered standalone and Bases view factories;
3. prove layout-ready index startup, targeted Vault/MetadataCache propagation,
   Bases filtering and complete lifecycle cleanup through production classes;
4. expose a focused integration command and include the project in the default
   full suite;
5. make the existing CI job explicitly provision Chromium without adding the
   P8 lockfile or lockfile-backed dependency cache.

## Non-goals

- Live Obsidian Desktop, actual Bases UI, Electron, pop-out, screen-reader or
  Mobile certification.
- Generated/property-based invariants, additional renderer interaction/high-DPI
  cases or performance thresholds.
- A lockfile, deterministic package installation, release workflow or
  publication changes.
- New dependencies, product features, public APIs or persisted-data changes.
- Repairing a product defect found by the harness without separate
  authorization and durable ownership.

## Acceptance Criteria

- [x] The integration project instantiates `PeopleAtlasPlugin` and obtains
      `PeopleAtlasView` and `PeopleAtlasBasesView` through the actual registered
      factories rather than private prototype harnesses.
- [x] The controlled runtime models observable component children, registered
      events, plugin registrations, Vault, MetadataCache, Workspace and minimum
      Bases contracts used by those production paths.
- [x] Plugin load registers its surfaces but performs no vault scan before
      layout ready; layout ready loads the real index and performs exactly one
      initial Markdown inventory scan.
- [x] Controlled Markdown create, metadata change, link resolve, rename and
      delete events update the real index and both open view paths without a
      second full scan.
- [x] Integration assertions preserve explicit stable IDs, canonical paths,
      old-path removal, unresolved/filtered handling and explicit relationship
      metadata without display-name resolution.
- [x] Bases entry changes affect only its visible-person source while explicit
      relationships continue to come from the canonical index.
- [x] Standalone close, Bases unload and plugin/component unload observably
      remove renderer DOM, subscriptions, children and registered listeners;
      later events cause no state or output change.
- [x] `npm run test:integration` runs only the named P7a project, and the
      default `npm run test` includes it.
- [x] CI explicitly provisions Playwright Chromium, runs the full check, uses
      `npm install`, adds no lockfile and does not configure lockfile-backed npm
      caching.
- [x] Focused integration tests, `npm run test`, `npm run build` and
      `git diff --check` pass.
- [x] Fresh independent review records findings, verdict and residual risk;
      closure requires `pass` or explicit acceptance of non-critical risk.

## References

- `.10x/specs/controlled-obsidian-integration-harness.md`
- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/knowledge/performance-characterization-boundaries.md`
- `.10x/tickets/2026-07-26-mobile-touch-interaction.md`
- `.10x/tickets/2026-07-26-incremental-graph-delta-performance.md`
- `ARCHITECTURE.md`
- `src/main.ts`
- `src/index/person-index.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `src/bases/entry-adapter.ts`
- `test/obsidian-stub.ts`
- `test/person-index-lifecycle.test.ts`
- `test/view-selection-center.test.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `vitest.config.ts`
- `.github/workflows/ci.yml`

## Assumptions

- User-ratified: P7a uses a controlled automated integration runtime; live
  Obsidian Desktop/Bases/Mobile evidence is a separate manual P7 child.
- User-ratified: P7a may add explicit Playwright Chromium provisioning to CI.
- User-ratified: lockfile and release hardening remain P8.
- Record-backed: plugin indexing is deferred until layout ready and all
  Obsidian/index/DOM events remain lifecycle-owned.
- Record-backed: standalone and Bases consume the same canonical index
  relationship records while Bases owns its visible-person source.
- Record-backed: stable IDs and canonical paths are authoritative; unresolved
  and duplicate identities stay fail-closed.
- Mechanical: exact harness helper filenames and test-case grouping may be
  chosen by the executor while the named project, focused command and proof
  boundaries remain unchanged.

## Journal

- 2026-07-26: P5a/P5b and measured P6a/P6b are closed. Static P7 gap analysis
  found strong isolated renderer, touch, graph and performance coverage but no
  integrated production plugin/view lifecycle because every automated
  `obsidian` import resolves to the minimal stub.
- 2026-07-26: The user ratified the recommended evidence split: P7a may build a
  controlled integration harness and provision Chromium in CI; live Obsidian
  Desktop/Bases/Mobile remains separately owned manual evidence, and lockfile/
  release hardening remains P8.
- 2026-07-26: The governing P7a specification was activated and this bounded
  executable ticket was opened. Per the shaping/execution boundary, no harness,
  test, CI or production implementation occurs in this ticket-authoring turn.
- 2026-07-26: Execution began after explicit user authorization. Lifecycle
  premortem: the controlled runtime may transition plugin, index and view
  components from unloaded to loaded to unloaded; all listener, child and DOM
  ownership is record-backed and must become observably empty on unload.
  There are no recipients, retries, escalation, retention, billing or
  permission changes. Test-only DOM/state is process-local and discarded by
  Vitest; the executor owns harness cleanup, while live Obsidian operational
  proof remains excluded.
- 2026-07-26: Implemented the first bounded harness pass: the existing
  `test/obsidian-stub.ts` alias now exposes observable Component, Plugin,
  Vault, MetadataCache, Workspace, ItemView and Bases contracts; a named
  Playwright Chromium integration project and focused command drive the
  exported plugin and registered factories; CI retains `npm install`, removes
  lockfile-backed npm caching and explicitly provisions Chromium. The first
  focused run reached the real resolve propagation and failed 0/1 only because
  the new assertion assumed full-build edge order. Existing graph-delta
  authority compares stable edge values after ID ordering, so the assertion
  was narrowed to that established contract rather than changing production
  behavior.
- 2026-07-26: The second focused run again exercised the complete event chain
  through rename, delete and non-Markdown create, then failed 0/1 on the same
  test-only ordering assumption for people after a rename. Stable person IDs,
  canonical renamed paths and all preceding assertions were correct. Membership
  assertions now sort stable IDs consistently with the existing graph-delta
  equivalence boundary; no renderer or graph implementation changed.
- 2026-07-26: Focused `npm run test:integration` then passed its named
  Playwright Chromium project: 1 file and 1 end-to-end production-path test.
  The test instantiates the exported plugin, opens both registered factories,
  proves layout-ready deferral and one scan, exercises create/change/resolve/
  rename/delete plus non-Markdown and Bases-filter transitions, and observes
  renderer, subscription, child, event, registration and post-teardown
  cleanup. This is controlled-runtime evidence only, not live Obsidian proof.
- 2026-07-26: The first default `npm run test` included all three projects
  and reached 109 passing tests, but the pre-existing Node
  `person-index-lifecycle` case failed because its helper constructs an empty
  `TFile` and assigns only `path`/`basename`; the expanded stub constructor had
  overwritten the historical default `extension = "md"` with an empty value.
  Preserving that existing empty-constructor contract repaired only the
  controlled runtime seam; no production behavior or protective assertion was
  changed.
- 2026-07-26: The corrected default `npm run test` passed 22/22 files and
  110/110 tests. The result includes the existing Node suite, the renderer
  Playwright Chromium project and the named P7a integration Chromium project;
  it does not include the separately manual performance projects.
- 2026-07-26: The first `npm run build` reached TypeScript and failed before
  bundling on five test-harness type issues: DOM iterable syntax was not
  enabled by the repository lib set, two inherited lifecycle methods required
  explicit `override`, and the controlled `EditorSuggest<T>` did not consume
  its type parameter. The fixes use `Array.from`, explicit override markers
  and a typed optional context; runtime behavior and production source remain
  unchanged.
- 2026-07-26: The corrected `npm run build` passed TypeScript `--noEmit` and
  the production esbuild bundle. This proves the expanded alias, integration
  test and project configuration typecheck with the existing production
  source; it does not prove a live Obsidian package load.
- 2026-07-26: Standalone `git diff --check` exited 0. Its only output was
  informational Windows LF-to-CRLF conversion warnings for five tracked
  text files; no whitespace error or generated browser artifact was present.
- 2026-07-26: After the final test-only type corrections, the exact final
  `npm run test` source passed again with 22/22 files and 110/110 tests.
  Generated failure screenshots and the single Vitest attachment from the red
  iterations were removed by exact path; repository inspection found no
  screenshot/attachment directory and no `package-lock.json` or
  `npm-shrinkwrap.json`.
- 2026-07-26: Initial independent review returned `concerns` with two
  significant assertion-observability gaps and one minor parent-record drift:
  view unsubscribe and the Bases asynchronous flush were not mutation-
  sensitive; unresolved ghost/diagnostic and display-name denial were not
  positively proved; and the parent still awaited authorization. The user
  explicitly authorized exactly those three repairs. Repair execution began
  without product-source authority; any sharpened-test product defect remains
  a blocker rather than an implicit fix.
- 2026-07-26: The authorized test repair now makes both view unsubscribe calls
  mutation-sensitive: after standalone unload, a relationship create updates
  the still-open Bases snapshot but leaves the closed standalone snapshot
  object unchanged; after Bases unload, a relationship metadata change updates
  the real index but leaves the closed Bases snapshot object unchanged.
  Removing either production unsubscribe would therefore change the asserted
  closed-view snapshot. Bases unload also waits for an observed increase in
  saved plugin data and asserts the `bases:People integration` view-state key,
  proving its existing asynchronous flush without requiring synchronous
  Obsidian lifecycle semantics.
- 2026-07-26: Identity coverage now starts with an unresolved contact ghost
  labelled `Shared person` and an unresolved rich Alice-to-Carol diagnostic.
  A Markdown person decoy with the same display name and a distinct stable ID,
  followed by the real same-label Carol note, leaves the ghost and diagnostic
  unresolved until explicit source-path link mappings are emitted. Resolve
  then removes the ghost and attaches both the inferred contact and rich
  relationship to stable ID `carol`, never the same-label `decoy`. No product
  defect was exposed.
- 2026-07-26: Focused repair verification passed
  `npm run test:integration`: the named Playwright Chromium project ran 1/1
  production-path integration test successfully. The parent roadmap journal
  and Blockers now record implemented P7a, the authorized repair and pending
  re-review instead of awaiting implementation authorization.
- 2026-07-26: Post-repair `npm run test` passed 22/22 files and 110/110 tests
  across the Node, renderer-browser and controlled-integration projects.
- 2026-07-26: Post-repair `npm run build` passed TypeScript `--noEmit` and the
  production esbuild bundle.
- 2026-07-26: Post-repair `git diff --check` exited 0 with only informational
  Windows LF-to-CRLF conversion warnings. The ticket remains `active` and the
  independent-review criterion remains unchecked for fresh re-review.
- 2026-07-26: Fresh independent re-review returned `pass`. It verified both
  unsubscribe paths through post-unload index mutations, the eventual
  Bases-state flush, fail-closed same-label ghost/diagnostic behavior until
  explicit path resolution, the reconciled parent record and the unchanged
  product/dependency/release boundary. Every acceptance criterion now maps to
  journaled evidence and no closure blocker remains. The orchestrator closed
  P7a as `done` and distilled the reusable harness lessons to
  `.10x/knowledge/controlled-obsidian-integration-testing.md`.

## Blockers

None. Implementation, executor verification and fresh independent re-review
passed within the controlled-runtime boundary.

## Evidence

- `test/obsidian-stub.ts` is the single reusable controlled runtime on the
  existing `obsidian` alias. Its observable `Component` lifecycle owns
  children, events and cleanup callbacks; `Plugin` owns registered views,
  Bases views, commands, ribbon, settings and editor suggest; controlled
  Vault, MetadataCache and Workspace sources expose listener and scan counts;
  Bases config, entries and values execute the production adapter contracts.
- `test/integration/people-atlas-plugin.integration.test.ts` imports and
  constructs the exported `PeopleAtlasPlugin`, asserts actual registration
  state before layout readiness, then opens `PeopleAtlasView` and
  `PeopleAtlasBasesView` only through those captured production factories.
- The integration test proves zero pre-layout scans, one initial Markdown
  inventory scan, and no later rescan across relationship create, person
  create, relationship frontmatter change, link resolve, person rename,
  relationship delete and non-Markdown create. Index snapshots and both view
  snapshots preserve stable IDs, explicit relationship metadata, resolved and
  filtered endpoint diagnostics, the renamed canonical path and old-path
  removal.
- The same test changes the controlled Bases entries from Alice plus Bob to
  Alice only. Its production `onDataUpdated()` result contains only Alice,
  reports two filtered canonical people and one filtered explicit
  relationship, while the standalone output and canonical index retain all
  people and `rel-alice-bob`.
- Standalone unload removes its renderer and registered workspace event and
  flushes plugin view data. Bases unload removes its root, renderer,
  subscription and workspace event while starting the existing asynchronous
  flush. Plugin unload removes its `PersonIndex` child, all index listeners
  and every plugin registration. Later Vault, MetadataCache, active-file and
  layout-ready operations leave scan count, saves, DOM and the empty unloaded
  index unchanged.
- Post-review repair adds positive teardown evidence: an index create after
  standalone unload changes Bases but not standalone; an index metadata change
  after Bases unload changes the index but not Bases. The Bases unload assertion
  waits for a new persisted write and inspects its stable view-state key, so
  removing either unsubscribe or the Bases flush call breaks the focused test.
- Pre-resolve production snapshots contain both an `unresolved-contact` ghost
  labelled `Shared person` and an
  `unresolved-relationship-endpoint` diagnostic. A Markdown `decoy` person and
  the later real `carol` person deliberately share that display name; neither
  resolves the reference. Only explicit link mappings remove the ghost and
  bind both resulting edges to stable ID `carol`.
- `vitest.config.ts` names a separate Playwright-backed Chromium
  `integration` project, excludes it from Node discovery and retains default
  project inclusion. `package.json` exposes only
  `vitest run --project integration` as `test:integration`.
- `.github/workflows/ci.yml` retains `npm install`, runs
  `npx playwright install --with-deps chromium` before the existing full
  `npm run check`, and no longer requests setup-node's lockfile-backed npm
  cache. No dependency, lockfile or release file was added.
- Final focused `npm run test:integration`: 1/1 Chromium integration file and
  test passed.
- Final `npm run test`: 22/22 files and 110/110 tests passed across Node,
  browser and integration projects.
- Final `npm run build`: TypeScript `--noEmit` and production esbuild passed.
- Final `git diff --check`: exited 0 with informational line-ending warnings
  only.

## Review

### Findings

- **significant — view subscription and Bases flush teardown are not
  observable.** `PeopleAtlasView.onClose()` and
  `PeopleAtlasBasesView.onunload()` call their index unsubscribe functions, but
  the controlled `PersonIndex` exposes no subscriber count and the integration
  test emits no index-changing event between each view unload and plugin
  unload. Plugin unload then clears every index listener, so removing either
  view unsubscribe call would leave the test passing. The test asserts a save
  increase only for standalone close; removing the Bases
  `persistLayout(undefined, true)` call would also leave it passing. The final
  layout-ready trigger is likewise observationally inert because readiness
  already fired and the runtime rejects every later trigger before consulting
  callbacks. This does not satisfy the spec's clauses 19, 20, 22 and 23 proof
  boundary that subscriptions, each flush path and post-teardown events be
  observably owned rather than merely followed by stopped assertions.
- **significant — unresolved and no-display-name identity semantics are not
  positively integration-proven.** Before resolve, the integration test checks
  only that `rel-alice-carol` is absent from visible edges; it does not assert
  the required unresolved diagnostic or ghost state. After resolve it asserts
  only that the unresolved diagnostic is absent. All Markdown person names are
  their IDs modulo case (`Alice`/`alice`, `Bob`/`bob`, `Carol`/`carol`), while
  the sole same-display-name decoy is a `.png` rejected before graph identity
  resolution. Consequently a display-name lookup or silent unresolved drop
  could satisfy the integration case. Existing pure graph tests cover ghost
  and duplicate-ID behavior, but they do not close the ticket's explicit
  production-path integration assertion for unresolved handling and identity
  without display-name resolution.
- **minor — the parent roadmap still describes P7a as awaiting
  authorization.** The current diff leaves the parent ticket's journal and
  Blockers text at “Implementation awaits explicit user authorization” even
  though this child records authorization and completed execution. The
  orchestrator should reconcile that status during closure.

### Verified Without Finding

- The integration test imports and constructs the exported
  `PeopleAtlasPlugin`, calls its component load path, and obtains
  `PeopleAtlasView` and `PeopleAtlasBasesView` from the registrations captured
  by `onload()`; there is no `Object.create()` or private-prototype execution
  shortcut.
- Required production-path fake operations execute with observable maps,
  event sets, scan counts, files/caches, Bases values, DOM and component
  ownership. The remaining silent stub methods belong to unrelated modal,
  settings-control or workspace-reveal paths not used as proof in this ticket.
- The test detects zero pre-layout scans, exactly one initial Markdown
  inventory scan, and no rescan across Markdown relationship/person create,
  relationship metadata change, link resolve, person rename, relationship
  delete and non-Markdown create. It asserts the renamed canonical path, old
  path removal and actionable opening of the renamed path.
- Rich explicit relationship identity, direction, types, closeness, dates and
  status are asserted through the index and both production view snapshots.
  Bases entry changes affect only its visible-person population while the
  standalone view and canonical index retain people and the explicit
  relationship; hidden counts and `filtered-endpoint` remain fail-closed.
- Workspace, Vault and MetadataCache listener cleanup, plugin child cleanup,
  renderer/root DOM removal, plugin registration cleanup and post-plugin
  index/output/save stability are directly observed, subject to the view
  subscription and Bases flush gap above.
- Vitest discovery is disjoint: Node excludes browser and integration globs,
  browser and integration use separate includes, the focused command selects
  only `integration`, and the unqualified default command retains all three
  projects.
- CI retains `npm install`, provisions the locally installed Playwright
  Chromium with `--with-deps`, then runs the full check without an environment
  skip. No npm cache, lockfile, dependency, release workflow, product source
  change or weakened existing test is present in the current diff.
- The executor's journaled focused integration, full-suite, build and
  `git diff --check` results were accepted within their stated controlled
  runtime and local-environment limits and were not rerun by this review.

### Verdict

`concerns`

The implementation appears scoped and the exercised production flow is real,
but two checked acceptance claims are stronger than the assertions that
currently support them. Closure needs focused repair evidence for those
verification gaps or explicit acceptance of the non-critical risk.

### Residual Risk

Even after the findings are repaired, this remains a controlled contract
runtime. It cannot certify live Obsidian Desktop, actual Bases UI, Electron
pop-outs, assistive technology or Mobile behavior; those remain explicitly
owned by the separate manual P7 child. The runtime also models only the API
surface exercised here, so drift from Obsidian's concrete lifecycle ordering
remains possible until that live evidence exists.

### Authorized Repair Disposition

- **Resolved — view unsubscribe observability.** The standalone snapshot is
  captured immediately before production unload. A subsequent controlled
  relationship create updates the still-open Bases snapshot and canonical
  index but leaves the closed standalone snapshot at the exact same object.
  Bases is then captured immediately before its production unload; a later
  relationship metadata change updates canonical status to `ended` but leaves
  the closed Bases snapshot at the same object. Removing either production
  unsubscribe would invoke its still-present index callback and replace the
  asserted snapshot.
- **Resolved — Bases asynchronous flush observability.** The test captures
  the saved-data count before Bases unload, invokes the existing production
  lifecycle, and polls only until a later saved-data observation appears or
  fails after a bounded timeout. The resulting plugin data must contain
  `viewStates["bases:People integration"]`. This proves that unload started and
  completed the existing asynchronous flush without requiring `onunload()` to
  become synchronously awaitable.
- **Resolved — unresolved and no-display-name identity proof.** Before
  resolve, standalone and Bases contain a `Shared person` ghost and unresolved
  diagnostics. A real Markdown `decoy` person with stable ID `decoy` and the
  same display name does not resolve either reference; creating same-label
  Carol also leaves both unresolved. After explicit source-path resolution,
  the ghost disappears, the rich and inferred edges target stable ID `carol`,
  and neither targets `decoy`.
- **Resolved — parent record drift.** The parent journal records P7a
  authorization, implementation, initial review and the authorized repair.
  Its Blockers section no longer awaits implementation authorization and
  correctly leaves only fresh child re-review.
- No product source, dependency, lockfile, release file or existing
  protective assertion changed. Repair verification passed focused 1/1,
  full 22-file/110-test, build and diff gates.

### Repair Verdict

Executor repair is ready for fresh independent re-review. The historical
`concerns` verdict remains authoritative until that re-review; the ticket
therefore stays `active` and its review acceptance criterion stays unchecked.

### Repair Residual Risk

The repaired assertions remain controlled-runtime evidence. They do not alter
or close the existing live Obsidian Desktop, actual Bases UI, pop-out,
assistive-technology or Mobile boundary.

### Re-review Findings

None.

### Re-review Verified Without Finding

- **Standalone and Bases unsubscribe mutation sensitivity:** each production
  view's exact `fullSnapshot` object is captured immediately before unload.
  The next controlled index event demonstrably changes the canonical index and
  the still-open consumer, while the closed view retains the captured object.
  Removing standalone unsubscribe would replace its snapshot after the
  relationship create; removing Bases unsubscribe would replace its snapshot
  after the relationship metadata change. Plugin unload no longer masks
  either proof because both assertions occur first.
- **Bases asynchronous flush:** the test records the save count immediately
  before Bases unload, waits with a bounded poll for a strictly later save and
  requires that saved payload to contain
  `viewStates["bases:People integration"]`. No earlier step creates that Bases
  view-state entry. Removing the production unload flush therefore leaves
  neither the required new observation nor its stable owning key.
- **Unresolved and display-name denial:** the initial production snapshots
  positively contain the `Shared person` ghost and `unresolved-contact`; the
  later rich relationship positively adds
  `unresolved-relationship-endpoint`. Creating a real Markdown `decoy` person
  with the same display label does not remove the ghost or attach the rich
  relationship, and creating same-label stable ID `carol` still leaves the
  reference unresolved. Only explicit mappings for the person and
  relationship source paths remove the ghost. The rich edge then explicitly
  targets `carol`, not `decoy`, and the inferred contact also explicitly
  targets `carol`.
- **Parent record reconciliation:** the roadmap now records user
  authorization, implementation, initial review, authorized repair and
  passing repair gates. Its Blockers section says P7a is implemented and
  awaits fresh re-review rather than implementation authorization.
- **Scope and regression boundary:** the repair changes only the P7a
  integration assertions and project records. Current repository state adds
  no product-source, dependency, lockfile or release-workflow change beyond
  the already reviewed P7a harness/configuration scope. Existing test files
  remain untouched. Expanded fixture counts and `arrayContaining` checks are
  paired with exact index membership, exact ghost counts/diagnostics and later
  exact stable-node membership, so they do not weaken the prior identity,
  path, filtering or teardown assertions.
- The journaled post-repair focused integration, full-suite, build and
  `git diff --check` evidence was accepted within its stated limits and was
  not rerun by this re-review.

### Re-review Verdict

`pass`

The authorized repair closes both significant assertion-observability findings
and the minor parent-record drift without expanding implementation scope.

### Re-review Residual Risk

P7a remains a controlled-contract integration test. It does not certify live
Obsidian Desktop lifecycle ordering, actual Bases UI, Electron pop-outs,
assistive technology or Mobile behavior. Those limits are unchanged and remain
owned by the separate manual P7 child.

## Retrospective

Keeping the controlled API surface on the existing alias made class identity
the decisive integration seam: production imports and test helpers share the
same `Plugin`, `Component`, `TFile`, `ItemView`, `BasesView` and `ListValue`
constructors, so the exported plugin and registered factories can run without
a parallel prototype harness. Observable registration maps, listener counts,
scan counts and component ownership prevented missing behavior from becoming
silent no-ops.

The two red focused iterations were both assertion-order assumptions, not
product failures. Incremental graph updates deliberately retain unaffected
records before rebuilding affected ones, while established equivalence
coverage compares stable values by ID. Sorting membership assertions kept P7a
aligned with that authority and still protected identity, metadata, path and
filter semantics.

The only default-suite regression came from changing the empty `TFile`
constructor contract used by an older Node helper. Preserving the historical
`extension = "md"` default while deriving extension for pathful controlled
files let one alias serve both existing unit tests and the richer runtime.
The initial build then caught DOM-iterability and override details that the
browser runner cannot enforce, confirming why the separate build gate remains
necessary.

This harness materially narrows integration risk but remains a controlled
contract runtime. It does not certify live Obsidian Desktop, actual Bases UI,
pop-outs, assistive technology or Mobile, and it intentionally leaves those
claims with the separate manual P7 child.

The review repair reinforced a narrower test-design lesson: teardown cleanup
is proven by a mutation that would still reach a leaked subscriber, not by
observing that a renderer was removed before the shared owner itself unloads.
Likewise, asynchronous lifecycle work is proven by its eventual durable output
under a bounded wait, not by imposing a synchronous fake contract.
