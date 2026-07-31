Status: open
Created: 2026-07-24
Updated: 2026-07-30

# People Atlas v2 implementation plan

## Objective

Evolve the current v0.1 scaffold into a Bases-native, Markdown-first visualization and maintenance layer for people and relationships, while preserving stable identities, explicit relationship entities, shared graph semantics, accessible navigation, mobile operation and incremental processing.

This is a parent plan, not an executable implementation ticket. Each priority below receives one bounded child ticket when its prerequisites and acceptance criteria are concrete.

## Scope

The plan covers the eight implementation priorities agreed with the user:

1. Canonical graph source for standalone and Bases.
2. Incremental index, duplicate resolution and diagnostics.
3. Safe file mutations and versioned plugin data.
4. Center/projection modes, multiple layouts and persisted layout state.
5. Accessible renderer and complete mobile interaction.
6. Web Worker, image cache and performance optimization.
7. Integration, browser, property-based and performance tests.
8. Release hardening and reproducible publication.

## Ordering and dependencies

```text
P1 Canonical graph source
 └─> P2 Incremental index and diagnostics
      └─> P3 Safe mutations and versioned data
           └─> P4 Projection modes, layouts and state
                └─> P5 Accessible/mobile renderer
                     └─> P6 Worker, cache and performance

P1..P6 ──> P7 Expanded test matrix ──> P8 Release hardening
```

Tests and narrow quality checks are required inside every child ticket. P7 expands coverage after the graph, data and renderer contracts have stabilized; it is not a reason to defer testing.

## Child priorities

### P1 — Canonical graph source

Owner: `.10x/tickets/2026-07-24-canonical-graph-source.md`

Unify standalone and Bases around the canonical relationship-aware graph
source. Preserve Base person property mappings while loading rich relationship
records from `PersonIndex`. Retain explicit/fallback relationship identity,
paired endpoint roles, dates, status, duplicate-ID safety, parallel-edge
preservation and filtered-endpoint accounting under the current
direction-free successor contract.

Gate: both views use the same relationship-aware graph contract and pure tests cover the new identity and edge invariants.

### P2 — Incremental index and diagnostics

Add path-, person-ID- and relationship-ID indexes, targeted create/modify/
rename/delete handling, adjacency maintenance and graph deltas. Diagnostics
cover ambiguous identities, duplicate relationships, invalid dates/status or
role pairs, missing endpoints, filtered endpoints and missing assets.
Diagnostics must retain source paths and support navigation where the UI
exposes them.

Depends on: P1 graph and relationship identity contract.

Gate: a single-file change does not require a vault rescan or full graph rebuild, and index consistency is tested across lifecycle events.

### P3 — Safe mutations and versioned plugin data

Implement explicit person and relationship creation/editing, relationship ending without history loss, unresolved-link conversion and merge workflow. Use Obsidian-safe frontmatter/file APIs. Formalize persisted data schemas, migrations, strict validation, bounded values and recovery behavior for invalid data.

Depends on: P1 identity/relationship contract and P2 diagnostics/index ownership.

Gate: every write is reviewable, validates before mutation, preserves unrelated frontmatter and has failure-path tests.

### P4 — Projection modes, layouts and state

Add configured, active-note, selected-node and no-center modes; ego, free-network, organization and timeline/contact-health projections; shortest paths, mutual contacts, communities and isolated-node views where their graph contract is ready. Persist center history and layout snapshots per view configuration.

Depends on: P1 shared graph contract and P2 stable deltas. P3 is required for maintenance-driven state changes but not for read-only projections.

Gate: projections are pure transformations with deterministic output, explicit hidden-node accounting and no view-to-view state coupling.

### P5 — Accessible renderer and mobile interaction

Completed: `.10x/tickets/2026-07-26-accessible-semantic-renderer.md` (P5a)

Completed: `.10x/tickets/2026-07-26-mobile-touch-interaction.md` (P5b)

Split renderer responsibilities where the boundaries are justified. Keep canvas as the visual surface and add a semantic alternative graph/list with keyboard navigation, focus management, relation descriptions, context actions and reduced-motion handling. Add pinch zoom, one-finger pan, long press, touch-sized targets, bottom-sheet controls and pop-out-window correctness.

Depends on: P4 projection/state contract and P2 diagnostics/navigation data.

Gate: keyboard and semantic alternatives are browser-covered; touch combines
isolated gesture-state proof with protocol-valid trusted Chromium input.
Actual Obsidian Mobile partial lift and pop-out behavior remain explicit
P7/manual validation items.

### P6 — Worker, image cache and performance

Completed children:

- `.10x/tickets/2026-07-26-performance-characterization.md` (P6a)
- `.10x/tickets/2026-07-26-incremental-graph-delta-performance.md` (P6b)

Move expensive physics/community work to a Web Worker when graph size warrants it. Add seeded positions, incremental layout updates, bounded image decoding/cache and frame-coalesced rendering. Establish thresholds for worker activation and memory/latency budgets.

Depends on: P4 layout contract and P5 renderer lifecycle. Do not introduce worker complexity before profiling demonstrates the need.

Gate: fixed datasets meet agreed index, first-render, frame-time and memory budgets without layout jumps on small deltas.

P6a is a characterization-only precursor: it measures deterministic sparse
and stress workloads, records calibrated Windows/Chromium evidence and
proposes budgets plus the smallest next architecture step. It does not
implement a Worker, image cache, optimization or regression threshold. Later
P6 behavior is shaped only after its evidence and candidate budgets are
ratified.

Evidence-backed next shaping candidate: a bounded P6b split of aggregate
incremental recomputation into graph-delta, projection and layout substages,
followed by main-thread lookup simplification if the split confirms it.
Current evidence does not justify a Worker or image cache. Candidate budgets
remain proposals until the user explicitly ratifies them.

### P7 — Expanded test matrix

Completed children:

- `.10x/tickets/2026-07-26-controlled-obsidian-integration-harness.md` (P7a)
- `.10x/tickets/2026-07-26-generated-graph-index-invariants.md` (P7b)
- `.10x/tickets/2026-07-27-high-dpi-popup-browser-matrix.md` (P7c)

Next shaping candidate: P7d live/manual Obsidian Desktop, Bases, pop-out,
assistive-technology and Mobile evidence. It has no active specification or
executable ticket yet.

P7 is split into independently verifiable children:

1. P7a — controlled plugin/index/standalone/Bases integration harness and
   explicit Chromium CI provisioning;
2. P7b — generated graph/index invariants;
3. P7c — missing high-DPI and real-pop-out browser matrix;
4. P7d — separately initiated live/manual Obsidian Desktop, Bases, pop-out,
   assistive-technology and Mobile evidence.

Existing P5 browser cases and P6 deterministic 100/1,000/5,000-node fixtures
are reused. Later P7 shaping must not duplicate them or convert calibrated
performance observations into unratified thresholds.

Depends on: P1–P6 contracts and test seams.

Gate: the automated Node/browser/integration/generated matrix is repeatable in
CI and failures identify the owning layer. Live/manual P7d evidence is explicit
and must not be represented as CI certification.

### P8 — Release hardening

Pin the intended Obsidian API/minimum version, add a lockfile and deterministic install, lint/format checks, strict type/build checks, production minification, bundle-size budget, dependency review, separate debug sourcemaps and release provenance. Keep compiled artifacts out of the source repository and publish only release artifacts.

Depends on: P7 passing test matrix and stable production build.

Gate: CI produces a reproducible, verified release from an exact source revision.

## Parallelization

- P1 is the critical first path.
- P2 can begin design work after P1's domain contract is stable, but its implementation depends on P1.
- P3 and read-only P4 design can proceed in parallel after P1, with integration after P2 where they consume index deltas.
- P5 can be designed while P4 is implemented, but renderer changes must consume the finalized projection contract.
- P7 test harness scaffolding may start during P2–P5; its final acceptance waits for P6.
- P8 remains last because release budgets and provenance depend on the final artifact and test matrix.

## Parent acceptance criteria

- [ ] Each priority has a bounded child ticket with explicit scope, non-goals and acceptance criteria before implementation begins.
- [ ] Child tickets close in dependency order, except for explicitly parallelized design or harness work.
- [ ] Every child ticket records tests, review findings, residual risk and follow-up ownership.
- [ ] The final release gate proves source revision, artifact contents, build provenance and full verification results.

## References

- `AGENTS.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/canonical-graph-source.md`

## Assumptions

- User-ratified: implementation proceeds per priority, not as one unbounded batch.
- User-ratified: the eight-priority order in this plan is the preferred delivery sequence.
- Record-backed: the current repository is a v0.1 scaffold and the canonical graph source is the active first child ticket.

## Journal

- 2026-07-24: User chose staged implementation per priority after first recording the complete order.
- 2026-07-24: P1 remains the only executable child ticket; later child tickets will be opened as their prerequisites become verified.
- 2026-07-24: P1 completed with passing tests/build and no significant review finding; P2 is now the next executable priority.
- 2026-07-24: P2 child ticket was opened, implemented and closed with passing tests/build and no significant review finding; P3 is now the next executable priority.
- 2026-07-25: P3 child ticket was implemented and closed with passing tests/build and no significant review finding; P4 child spec and ticket were opened for projection modes, contact-health ordering and persisted view state.
- 2026-07-25: P4 child ticket was implemented and closed with passing tests/build and no significant review finding; P5 is now the next priority.
- 2026-07-25: The post-P4 audit remediation sequence closed its incremental graph, mutation identity and view-state ordering regressions with focused before/after evidence and 56 passing tests. The separate relationship-mutation UI semantics must be shaped with the user before further implementation; P5 remains the next numbered roadmap priority.
- 2026-07-25: Relationship-editor semantics were ratified and recorded in
  `.10x/specs/relationship-editor-ui.md` (now superseded by
  `.10x/specs/perspective-relationship-editor-templates.md`); the completed
  historical P3b follow-up is
  `.10x/tickets/2026-07-25-relationship-editor-ui.md`. It is the immediate
  implementation candidate before resuming the numbered roadmap at P5.
- 2026-07-25: P3b relationship-editor UI was implemented and closed with one
  shared modal, canonical create/edit entrypoints in standalone and Bases,
  changed-field-only writes, 71 passing tests, a passing production build and
  a pass review. P5 accessible/mobile renderer is again the next numbered
  priority; live modal, Bases and mobile behavior remain part of its/P7's
  integration risk.
- 2026-07-26: The user ratified P5a's visible session-local Graph/List mode,
  roving keyboard/action contract and selected-person relationship
  descriptions. `.10x/specs/accessible-semantic-renderer.md` is active and
  `.10x/tickets/2026-07-26-accessible-semantic-renderer.md` is the next
  executable child. Touch gestures and the complete mobile workflow remain a
  separate P5b shaping step after P5a.
- 2026-07-26: P5a closed after browser-first implementation, two bounded
  independent-review repair passes and a final pass verdict. The shared
  Graph/List renderer, semantic relationship details, stable keyboard/focus
  behavior, owning-window lifecycle and Node/Chromium test split are complete;
  final verification passed 19 files and 82 tests plus production build and
  diff hygiene. P5b touch gestures and complete mobile controls are now the
  next shaping priority.
- 2026-07-26: P5b touch semantics were ratified: tap selects, one-finger
  touch always pans, two fingers pinch/centroid-pan, and touch never drags
  nodes. A 500 ms long press with an 8 CSS pixel movement boundary opens an
  action-only sheet; 44-pixel Zoom out, Zoom in, Fit and Details controls
  provide discoverable alternatives. `.10x/specs/mobile-touch-interaction.md`
  is active and `.10x/tickets/2026-07-26-mobile-touch-interaction.md` is the
  next executable child.
- 2026-07-26: P5b closed after implementation, two independent-review repair
  rounds and a final pass verdict. Touch tap/pan/pinch/long-press, mobile
  controls, guarded native sheet actions, owning-window cleanup and
  protocol-valid trusted Chromium input are complete with 96 passing tests
  and a passing production build. The user ratified layered partial-lift
  evidence: deterministic controller coverage now, with real Obsidian Mobile
  integration retained as P7/manual validation. P6 worker/cache/performance
  shaping is the next numbered roadmap priority.
- 2026-07-26: P6a performance-characterization semantics were ratified:
  measure only before setting budgets; use deterministic 100/1,000/5,000-node
  sparse `2N` and stress `8N` workloads; calibrate on the current
  Windows/headless-Chromium environment; keep Linux CI informative and live
  Obsidian under P7/manual validation. The active contract is
  `.10x/specs/performance-characterization.md`; the next executable child is
  `.10x/tickets/2026-07-26-performance-characterization.md`. No benchmark or
  optimization implementation was authorized during shaping.
- 2026-07-26: The user subsequently authorized P6a implementation. The child
  produced deterministic Node/Chromium characterization and date-stamped raw
  plus human-readable evidence without a Worker, cache, product optimization,
  accepted threshold or CI automation. Its first independent review found
  four bounded report/validation/record defects; the user authorized exactly
  that closure-repair round. The repair regenerated evidence and passed its
  focused/full/build/diff gates; P6a remains `active` pending fresh independent
  re-review.
- 2026-07-26: Fresh independent review verified the four authorized repairs
  and found one minor stale median pair in the owning ticket. After explicit
  user authorization, a record-only reconciliation changed it to the raw and
  generated values `15.070/2.735 ms`; targeted independent confirmation
  returned `pass`. P6a closed as `done`. Its evidence recommends shaping P6b
  around incremental graph-delta substage attribution and main-thread lookup
  simplification before considering a Worker; candidate budgets remain
  unratified.
- 2026-07-26: P6a was committed locally as `2fb576c`. Read-only P6b shaping
  then traced the leading hypothesis to the retained-edge loop in
  `applyGraphDelta()`: each edge performs two linear
  `previous.nodes.find()` endpoint lookups, yielding an O(E*N) path for the
  calibrated 5,000-node/40,000-edge stress case. The durable investigation is
  `.10x/research/2026-07-26-graph-delta-hot-path.md`. The smallest recommended
  scope is direct graph-delta substage timing followed, if confirmed, by
  per-call lookup maps that preserve full-rebuild equivalence. A Worker,
  persistent cache, image cache, dependency and public API change remain out
  of scope. The performance gate and conditional implementation trigger await
  user ratification before a P6b spec or executable ticket is opened.
- 2026-07-26: The user ratified P6b's conditional trigger: direct graph-delta
  must account for at least 80% of the pre-change 5,000-node stress aggregate
  median before optimization. The final calibrated aggregate gates are
  `750 ms` median and `1,000 ms` p95. The benchmark remains manual; Workers,
  persistent caches, image caches, dependencies, public API changes and CI
  thresholds remain excluded. The active governing contract is
  `.10x/specs/incremental-graph-delta-performance.md`; the executable child is
  `.10x/tickets/2026-07-26-incremental-graph-delta-performance.md`.
- 2026-07-26: P6b execution persisted a pre-change graph-delta/aggregate
  median ratio of `0.990815`, authorizing only local lookup maps in
  `applyGraphDelta()`. Final 5,000-node/40,000-edge stress aggregate timing was
  `30.231 ms` median / `41.898 ms` p95 versus the ratified
  `750/1,000 ms` gates. Correctness, build and diff gates passed, and fresh
  independent review returned `pass` with no finding. P6b closed as `done`.
  P6 is complete within the measured scope: current evidence rejects a Worker
  and image cache rather than leaving them as assumed deliverables. New
  workload evidence may shape a later P6 child without weakening this result.
- 2026-07-26: Read-only P7 gap analysis found that P5/P6 already cover the
  renderer, trusted Chromium touch and deterministic performance seams, while
  every automated `obsidian` import still resolves to the minimal test stub.
  The durable findings are
  `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`. The recommended
  first P7 child is a controlled plugin/index/view-adapter integration harness;
  live Obsidian Desktop/Bases/Mobile evidence and CI/browser-provisioning scope
  require user ratification before a P7 spec or executable ticket is opened.
- 2026-07-26: The user ratified controlled automated P7a plus explicit
  Chromium provisioning in CI. Live Obsidian Desktop/Bases/Mobile remains a
  separately initiated manual P7 child; lockfile and release hardening remain
  P8. `.10x/specs/controlled-obsidian-integration-harness.md` is active and
  `.10x/tickets/2026-07-26-controlled-obsidian-integration-harness.md` is the
  next executable child. No implementation occurred in the shaping turn.
- 2026-07-26: The user subsequently authorized P7a implementation. The child
  now contains the controlled plugin/index/standalone/Bases runtime, named
  Playwright Chromium integration project, focused/default test wiring and
  explicit CI Chromium provisioning without a lockfile or npm cache. Its
  executor gates passed; initial independent review returned `concerns` about
  two assertion-observability gaps and this stale parent status. The user
  authorized exactly that bounded repair; its focused/full/build/diff gates
  passed, so P7a is implemented and active pending fresh independent re-review.
- 2026-07-26: Fresh independent P7a re-review verified both mutation-sensitive
  unsubscribe paths, the observed asynchronous Bases flush, fail-closed
  same-label ghost/diagnostic behavior until explicit path resolution and the
  reconciled parent state. Verdict was `pass`; P7a closed as `done` with
  22 files/110 tests, a passing production build and diff hygiene recorded by
  its executor. Reusable controlled-runtime boundaries are distilled in
  `.10x/knowledge/controlled-obsidian-integration-testing.md`. P7b generated
  graph/index invariant shaping is the next automated roadmap checkpoint.
- 2026-07-26: P7a was committed locally as `0047449`. Read-only P7b shaping
  traced the remaining generated-coverage gap to three pure contracts:
  canonical snapshot invariants, valid graph-delta/full-rebuild equivalence
  and `IndexState` equivalence with a path-owned reference model. The active
  contract is `.10x/specs/generated-graph-index-invariants.md`; the executable
  child is `.10x/tickets/2026-07-26-generated-graph-index-invariants.md`.
  It uses a bounded dependency-free deterministic corpus and stops for separate
  repair authorization if a valid seed exposes a product defect. No P7b
  implementation occurred in this shaping turn.
- 2026-07-26: The user explicitly authorized P7b implementation. The child now
  adds dependency-free deterministic snapshot, graph-delta and index-state
  families with 64 fixed seeds each and replayable family/seed/operation
  context. Executor verification passed 3 generated files/192 focused tests,
  25 files/302 full-suite tests, the production build and diff hygiene without
  product source, dependency, lockfile, browser/integration, performance or
  release changes. P7b remains `active` pending fresh independent review.
- 2026-07-27: Initial independent P7b review found three significant proof
  gaps in relationship-entity churn, direct snapshot assertions and lifecycle
  failure context. The user authorized exactly those repairs. Post-repair
  focused 3-file/192-test and full 25-file/302-test gates, production build and
  diff hygiene passed without product or dependency changes. Fresh independent
  re-review returned `pass`; P7b closed as `done`. Reusable generated-test
  boundaries are distilled in
  `.10x/knowledge/generated-invariant-testing.md`. P7c high-DPI and real-pop-out
  browser-matrix shaping is the next automated roadmap checkpoint.
- 2026-07-27: P7b was committed locally as `c146dc5`. Read-only P7c shaping
  confirmed a dependency-free path through per-instance Playwright Chromium
  contexts at DPR `1`, `1.5` and `2` plus a user-activated same-origin
  top-level browser popup. The durable feasibility record is
  `.10x/research/2026-07-27-p7c-browser-matrix-feasibility.md`; the active
  contract and executable child are
  `.10x/specs/high-dpi-popup-browser-matrix.md` and
  `.10x/tickets/2026-07-27-high-dpi-popup-browser-matrix.md`. A Chromium popup
  is not an Obsidian/Electron pop-out; that live boundary remains P7d. No P7c
  implementation occurred in this shaping turn.
- 2026-07-27: The user explicitly authorized P7c implementation and a local
  commit after successful closure. The child now contains a disjoint typed
  Chromium matrix at DPR `1`, `1.5` and `2`, narrow scale/resize/stable-ID
  assertions and a real user-activated same-origin top-level popup ownership
  and teardown case. Executor gates passed 3 instance files/6 focused tests,
  28 files/308 full-suite tests and the production build without product
  source, dependency, lockfile, CI, existing P5/P7a/P7b test, performance or
  release changes. P7c remains `active` pending fresh independent review.
- 2026-07-27: Initial independent P7c review found one significant
  test-diagnostic gap: canvas timeouts omitted expected dimensions and popup
  teardown assertions did not name their boundary. The user authorized
  exactly that repair. The P7c test now reports factor, boundary and concrete
  expected CSS/backing sizes on every canvas timeout and names every teardown
  assertion explicitly; no behavior assertion or implementation scope was
  weakened. Fresh executor gates and independent re-review remain required.
- 2026-07-27: The authorized P7c diagnostic repair passed its focused
  3-file/6-test matrix, full 28-file/308-test suite, production build and
  targeted static context scan. The repair touched only the P7c test and
  owning records; P7c remains `active` pending fresh independent re-review.
- 2026-07-27: Fresh independent P7c repair re-review returned `pass`. It
  verified concrete DPR/boundary/CSS/backing timeout messages and explicit
  teardown context on all twelve popup cleanup checks without assertion
  weakening or scope expansion. P7c closed as `done` with 3 matrix instance
  files/6 focused tests, 28 files/308 full-suite tests, a passing production
  build and diff hygiene. Reusable scale/popup boundaries are distilled in
  `.10x/knowledge/browser-scale-popup-testing.md`. P7d live/manual evidence
  shaping is the next P7 checkpoint.
- 2026-07-27: Read-only P7d feasibility shaping confirmed that the prior P7a
  ratification already selects a separately initiated manual live-evidence
  child rather than new real-runtime automation. The durable findings are
  `.10x/research/2026-07-27-p7d-live-validation-feasibility.md`. The locally
  installed Obsidian binary reports `1.12.7`, below the manifest's required
  `1.13.0`; no app update, GUI, plugin installation or vault access occurred.
  A P7d spec and executable ticket remain blocked on authorization to update
  and verify compatible Desktop Obsidian, the named assistive technology and
  the available physical Mobile platform(s).
- 2026-07-30: The canonical relationship contract was superseded by
  `.10x/decisions/perspective-oriented-relationship-model.md`. Current work
  removes direction and adds My person through the separate UX0/UX2 tickets;
  earlier P1/P2/P3/P5 journal entries remain historical implementation
  evidence.

## Blockers

P5, measured P6 and P7a-P7c are closed within their explicit evidence
boundaries. P7d shaping awaits the three ratifications recorded in
`.10x/research/2026-07-27-p7d-live-validation-feasibility.md`: compatible
Desktop update authorization, named assistive technology and available
physical Mobile platform(s).

## Evidence

- P6a execution and repair evidence are owned by
  `.10x/tickets/2026-07-26-performance-characterization.md`.
- Durable calibrated outputs are
  `.10x/evidence/2026-07-26-performance-characterization.md` and
  `.10x/evidence/.storage/2026-07-26-performance-characterization.json`.
- P6a's final targeted independent confirmation returned `pass`; the child is
  closed as `done`.
- P6b hot-path source attribution is recorded in
  `.10x/research/2026-07-26-graph-delta-hot-path.md`; it does not yet constitute
  direct substage timing or implementation authorization.
- P6b's active contract and executable ticket are
  `.10x/specs/incremental-graph-delta-performance.md` and
  `.10x/tickets/2026-07-26-incremental-graph-delta-performance.md`.
- P6b baseline/final raw and Markdown evidence are the four
  `.10x/evidence/2026-07-26-incremental-graph-delta-*` artifacts. Independent
  review returned `pass`; the child is closed as `done`.
- P7a controlled-runtime implementation, executor gates, initial findings,
  authorized repairs and final `pass` re-review are owned by
  `.10x/tickets/2026-07-26-controlled-obsidian-integration-harness.md`.
- P7b's active generated-invariant contract and executable ticket are
  `.10x/specs/generated-graph-index-invariants.md` and
  `.10x/tickets/2026-07-26-generated-graph-index-invariants.md`.
- P7b executor evidence is owned by its child ticket: 3 generated files/192
  focused tests, 25 files/302 full-suite tests, production build and diff
  hygiene passed without product-source or dependency changes.
- P7b's authorized repair and fresh independent `pass` re-review are recorded
  in its child ticket; reusable lessons are in
  `.10x/knowledge/generated-invariant-testing.md`.
- P7c feasibility, active contract and executable ticket are
  `.10x/research/2026-07-27-p7c-browser-matrix-feasibility.md`,
  `.10x/specs/high-dpi-popup-browser-matrix.md` and
  `.10x/tickets/2026-07-27-high-dpi-popup-browser-matrix.md`.
- P7c's fresh independent repair re-review returned `pass`; reusable lessons
  are recorded in `.10x/knowledge/browser-scale-popup-testing.md`.

## Review

Pending review at parent-plan closure.

## Retrospective

Pending delivery.
