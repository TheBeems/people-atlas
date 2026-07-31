Status: done
Created: 2026-07-26
Updated: 2026-07-31

# P6a — Performance characterization

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-mobile-touch-interaction.md`

## Scope

Implement `.10x/specs/performance-characterization.md` as the evidence-only
first P6 slice:

- add deterministic 100/1,000/5,000-node sparse `2N`-edge and stress
  `8N`-edge fixture generation with exact stable-identity/count validation;
- add the deterministic person-plus-relationship incremental scenario and
  verify its graph result against a full rebuild;
- add a dedicated, cross-platform `npm run perf:characterize` path separate
  from correctness/build gates;
- measure Node index, canonical snapshot, free-network projection,
  deterministic layout and incremental recomputation stages;
- measure headless-Chromium initial Graph/List work, settled interaction
  redraws, incremental replacement, cleanup and retained heap through the
  existing provider/owning-window seams;
- emit date-stamped machine-readable and human-readable evidence with exact
  source/environment provenance;
- prepare one evidence-backed architecture recommendation and candidate
  budgets for a later user checkpoint.

This ticket is executable after explicit implementation authorization. It
contains no product optimization or accepted performance budget.

## Non-goals

- A Worker, force simulation, community detection or background graph
  protocol.
- Render culling, semantic-list bounding, incremental layout changes or other
  production optimization.
- Photo decoding, painting, cache policy or asset lifecycle changes.
- A time/memory threshold in `npm run test`, `npm run check` or required CI.
- Automatic CI benchmark wiring or artifact retention policy.
- Live Obsidian, Bases, pop-out, screen-reader or Mobile certification.
- Broad P7 property-based/integration fixtures or P8 release hardening.
- New runtime or development dependencies.

## Acceptance criteria

- [x] One deterministic fixture generator produces exact people,
      relationship, node and edge counts for both ratified profiles and all
      three sizes.
- [x] Fixture order and values are independent of randomness, wall clock,
      locale and platform.
- [x] One deterministic middle-person plus incident-relationship update keeps
      stable identities/counts and matches a full graph rebuild.
- [x] `npm run perf:characterize` is dedicated, cross-platform and does not run
      as part of `npm run test`, `npm run build` or `npm run check`.
- [x] Node results separately contain the five specified stages, five
      warm-ups, twenty recorded samples and raw plus min/median/p95/max
      summaries for every size/profile.
- [x] Chromium results separately contain synchronous
      `snapshot-and-semantic-dom`, `canvas-first-paint`, List/Graph mode
      transitions, ten recorded setup/update samples, 30 settled interaction
      frame samples, incremental replacement and lifecycle cleanup.
- [x] Node and Chromium results report stage-bounded heap observations,
      garbage-collection availability and explicit missing-data reasons.
- [x] The calibrated Windows result records exact Git/diff, OS, CPU, memory,
      Node/npm/Vitest/Playwright/Chromium, viewport, DPR, fixture and runner
      provenance.
- [x] A run on Node 24/Linux is supported and labels its output
      `informative-ci`; no absolute result is generalized across hardware.
- [x] A date-stamped `.10x/evidence/*.md` record and corresponding
      `.10x/evidence/.storage/*.json` preserve procedure, raw observations,
      summaries, limits and environment.
- [x] The architecture recommendation attributes the dominant cost to an
      owning layer, considers no-change/main-thread simplification before a
      Worker, excludes image caching from current evidence and proposes the
      next bounded ticket.
- [x] Candidate latency/memory budgets are presented for user ratification but
      are not activated, enforced or recorded as an accepted decision.
- [x] Focused fixture, exact-count, determinism, statistics and invalid-result
      tests pass.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.
- [x] Independent review finds no significant measurement-validity,
      provenance or scope-boundary defect.

## References

- `.10x/specs/performance-characterization.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-25-projection-modes-layout-state.md`
- `.10x/tickets/2026-07-26-accessible-semantic-renderer.md`
- `.10x/tickets/2026-07-26-mobile-touch-interaction.md`
- `AGENTS.md`
- `src/index/index-state.ts`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `src/graph/project-graph.ts`
- `src/render/layout.ts`
- `src/render/atlas-renderer.ts`
- `vitest.config.ts`
- `.github/workflows/ci.yml`

## Assumptions

- User-ratified: P6a measures and recommends only; absolute budgets and any
  product optimization require a later checkpoint.
- User-ratified: fixture sizes are 100, 1,000 and 5,000 nodes with separate
  sparse `2N` and stress `8N` relationship workloads.
- User-ratified: the scenario covers full construction, projection, layout,
  Graph/List rendering and one person-plus-relationship delta.
- User-ratified: the current Windows machine/headless Chromium is calibrated;
  Linux CI is informative and live Obsidian remains P7/manual evidence.
- Record-backed: existing runtime and development dependencies already expose
  Node, Vitest Browser Mode, Playwright Chromium and provider-backed CDP.
- Record-backed: the current renderer has no transferable force/community
  computation and does not decode photos.

## Journal

- 2026-07-26: P5b closed and was committed as
  `3cc7e96a5a90d93f4a075dc6039dd49551bab774` after 96 passing tests, a passing
  production build and a final independent pass review.
- 2026-07-26: Read-only P6 inspection found no existing force/community
  workload, photo decoder/cache, benchmark command, fixed performance
  fixtures or ratified budgets. Current graph drawing is linear over visible
  edges/nodes and graph replacement rebuilds the semantic people list.
- 2026-07-26: The existing required CI runs Node 22 on `ubuntu-latest`, while
  the calibrated local environment currently reports Node 24.18.0. Variable
  hosted-runner timing is therefore not an accepted hard gate.
- 2026-07-31: The user raised the project, CI and release baseline to Node 24
  LTS. Future performance output uses a version-neutral `ciRuntimeSupport`
  field and labels Node 24/Linux; prior Node 22 evidence remains historical.
- 2026-07-26: The user ratified a characterization-only P6a, deterministic
  100/1,000/5,000 sparse `2N` and stress `8N` workloads, and the
  Windows/Chromium calibrated versus informative-CI/live-P7 boundary.
- 2026-07-26: The active governing spec and this executable ticket were opened
  during Shaping. No source, test, dependency, package script, workflow,
  benchmark or measurement was implemented or run. Execution awaits explicit
  user authorization.
- 2026-07-26: The user explicitly authorized implementation. Execution began
  after reading the complete ticket, active P6a/P4/P5 specifications,
  renderer-boundary knowledge, P4/P5 closure records, parent plan, project
  instructions, referenced index/graph/layout/renderer sources, Vitest
  configuration and CI workflow. Scope remains characterization only: no
  product optimization, Worker, cache, dependency, CI automation, accepted
  budget, commit or push is authorized.
- 2026-07-26: Added deterministic ring-lattice fixture/statistics boundaries
  and their focused correctness tests first. The initial focused run passed
  four tests and failed the incremental-equivalence test because the synthetic
  delta re-added only the explicitly modified relationship after the changed
  person's other incident edges were invalidated. The fixture now models the
  actual affected-set contract by carrying every incident relationship while
  marking only one relationship as updated. A second mismatch was only object
  property insertion order, so equivalence now uses stable-key structural
  serialization rather than weakening graph equality. The focused rerun
  passed 5/5 in 654 ms.
- 2026-07-26: Added separate, non-default Vitest performance projects,
  provider-backed Chromium heap/version commands, owning-window animation
  frame timing, lifecycle/coalescing checks and the cross-platform
  `perf:characterize` orchestrator. A TypeScript/production build passed before
  the final structural-equality helper adjustment. No browser-provider/spec
  mismatch is known; the full dedicated matrix remains to be run.
- 2026-07-26: The first `npm run perf:characterize` failed before either
  project started because `require.resolve("vitest/vitest.mjs")` is blocked by
  Vitest's package exports. Resolving the exported `vitest/package.json` and
  joining its sibling CLI path repaired the cross-platform local-CLI lookup
  without invoking a package index or adding a dependency.
- 2026-07-26: The complete dedicated rerun passed. The Node project completed
  six cases in 119.29 s with 5 warm-ups and 20 raw samples per stage; the
  Playwright Chromium project completed six cases in 38.21 s with 3 warm-ups,
  10 setup/update samples and 30 settled interaction frames per case. It wrote
  `.10x/evidence/2026-07-26-performance-characterization.md` and
  `.10x/evidence/.storage/2026-07-26-performance-characterization.json`.
  Every case has exact counts, lifecycle cleanup passed, Chromium CDP explicit
  collection was available, Node explicit collection was unavailable in the
  Vitest worker and is therefore labelled retained-heap observation, and no
  required timing/provenance value is missing.
- 2026-07-26: Final verification passed `npm run test` with 21/21 files and
  101/101 tests in 6.64 s, `npm run build` with TypeScript no-emit plus
  production esbuild, and `git diff --check` with exit 0 and only
  informational LF/CRLF warnings. A direct JSON audit confirmed every Node
  stage has 20 raw samples, every browser setup/update stage has 10 and every
  interaction case has 30; no lockfile or trailing whitespace was introduced.
  Ticket status remains `active` for independent review.
- 2026-07-26: The user explicitly authorized one closure-repair round for
  exactly the four independent-review findings: truthful generated Node and
  Chromium GC availability, machine-readable/reproducibly rendered
  100→1,000→5,000 scaling evidence before the recommendation, semantic
  combined-result rejection with focused malformed-result tests, and
  parent-plan authorization/evidence reconciliation. No product optimization,
  Worker, cache, dependency, CI change, accepted threshold, commit, push or
  unrelated repair is authorized. Ticket status remains `active` for a fresh
  independent re-review after repair.
- 2026-07-26: Implemented the authorized repair through one shared
  `scripts/performance-result.mjs` boundary. It semantically validates the
  complete size/profile matrix, exact fixture counts, required stages,
  warm-up/sample cardinalities, raw values, recomputed summaries, interaction
  arithmetic and cleanup before report construction. It also computes the
  ordered stress incremental scaling trend and derives independent Node and
  Chromium explicit-GC statements from raw results. Focused preflight passed
  10/10, including missing/duplicate cases, missing stages, wrong sample
  cardinality, invalid counts, inconsistent summaries, GC prose and scaling
  order/growth.
- 2026-07-26: Regenerated evidence with `npm run perf:characterize`. The
  semantic validator accepted both complete partials; Node passed 1/1 in
  124.21 s and Chromium passed 1/1 in 35.47 s. Raw recommendation data now
  contains 100→1,000→5,000 medians/p95s and growth ratios before the
  architecture recommendation. Generated Markdown says Node explicit GC was
  unavailable and all 24 Chromium heap observations had explicit collection;
  its empty missing-data statement now refers only to required
  timing/provenance values.
- 2026-07-26: Post-regeneration focused tests passed 10/10 in 618 ms and the
  full default suite passed 21/21 files and 106/106 tests in 6.81 s. The first
  repair build then exposed one strict `noUncheckedIndexedAccess` error in the
  malformed-count test setup; assigning through an explicit checked fallback
  repaired only that test fixture. The final focused rerun passed 10/10 in
  641 ms, `npm run test` passed 21/21 files and 106/106 tests in 6.90 s,
  `npm run build` passed TypeScript no-emit plus production esbuild, and
  `git diff --check` exited 0 with informational LF/CRLF warnings only.
- 2026-07-26: Final artifact audit ran the shared semantic validator against
  the persisted combined JSON, confirmed the three-point raw scaling trend,
  found no untracked trailing whitespace or lockfile, and passed a final
  standalone `git diff --check` after record reconciliation. The parent now
  says repair is complete and re-review is pending. P6a remains `active`; the
  executor does not change the historical failed verdict or self-close the
  independent-review criterion.
- 2026-07-26: The user authorized only the final record reconciliation from
  independent re-review. Corrected the owning Evidence prose's stale
  largest-case projection/layout medians from `15.302/2.706 ms` to the
  regenerated raw/Markdown values `15.070/2.735 ms`. No benchmark, code or
  product gate rerun is required for this record-only correction; ticket
  status remains `active` pending targeted reviewer confirmation.
- 2026-07-26: Final targeted independent confirmation found no remaining
  finding: ticket, raw JSON and generated Markdown agree on
  `15.070/2.735 ms`, historical reviews remain intact and no unrelated change
  entered. With every acceptance criterion evidenced and the final verdict
  `pass`, the orchestrator closed P6a as `done`. Candidate budgets and P6b
  architecture work remain unratified follow-up, not part of this closure.

## Blockers

None. Final independent confirmation returned `pass`; no P6a closure gate
remains.

## Evidence

- `test/performance/fixture.ts` generates one stable, zero-padded
  `p6a-ring-lattice-v1` family for every ratified size/profile, validates exact
  unique IDs/paths/endpoints/counts and provides the middle-person plus
  offset-1 relationship update. Its affected set contains every incident
  relationship required by the existing delta contract while exactly one
  relationship is marked updated. Stable structural comparison proves the
  incremental graph equals a full rebuild without relying on object property
  insertion order.
- `test/performance/performance-model.ts` owns the fixed runner/sample
  cardinalities and validates raw samples before reporting minimum, median,
  nearest-rank p95 and maximum. `test/performance-characterization.test.ts`
  covers all six exact-count cases, repeated deterministic values/snapshots,
  incremental identity/equivalence and empty/negative/non-finite result
  rejection.
- `test/performance/node-characterization.perf.ts` measures fresh
  `IndexState` population/raw snapshot, canonical graph, free-network
  projection, deterministic layout and aggregate incremental graph-delta plus
  projection/layout. Every case uses 5 discarded warm-ups and 20 retained raw
  samples, validates counts before accepting results and records seven heap
  boundaries.
- `test/performance/browser-characterization.perf.ts` measures synchronous
  semantic DOM replacement, owning-window canvas callback, List/Graph
  transitions, incremental replacement/canvas work and cleanup for 3 warm-ups
  plus 10 samples. A retained case records 30 settled zoom frames from 60
  triggers, observes 30 requested/executed frames and therefore reports 30
  coalesced triggers. Every destroy path leaves no renderer DOM or pending
  Atlas frame.
- `vitest.performance.config.ts` keeps the measurement files out of default
  test discovery and exposes provider-backed Chromium
  `HeapProfiler.collectGarbage`, `Runtime.getHeapUsage` and
  `Browser.getVersion` commands. `scripts/performance-characterize.mjs`
  launches the Node and browser projects sequentially through the installed
  Vitest CLI, records Git/diff/host/package provenance, labels Windows versus
  Linux CI and writes the combined date-stamped result. `package.json` exposes
  only the dedicated `npm run perf:characterize`; `.github/workflows/ci.yml`
  is unchanged.
- Closure-repair `npm run perf:characterize` passed:
  Node 1/1 in 124.21 s and Chromium 1/1 in 35.47 s. The durable raw result is
  `.10x/evidence/.storage/2026-07-26-performance-characterization.json`; the
  independently readable procedure, summaries, recommendation, candidate
  budgets and limitations are in
  `.10x/evidence/2026-07-26-performance-characterization.md`.
- The calibrated result records HEAD
  `3cc7e96a5a90d93f4a075dc6039dd49551bab774`, dirty state and SHA-256 diff
  provenance; Windows 11 ARM64, Snapdragon X 12-core, 15,980.969 MiB memory;
  Node 24.18.0/npm 11.16.0, Vitest 4.1.10, Playwright 1.62.0 and
  HeadlessChrome 151.0.7922.34; 414×896 viewport at DPR 1; fixture and runner
  versions. Node worker heap is honestly labelled non-GC retained observation;
  Chromium collection was available. The result contains no missing required
  timing or provenance field.
- The regenerated 5,000-node stress dominant is aggregate incremental
  recomputation at 2,428.569 ms median/2,564.362 ms p95. Its raw
  machine-readable median trend scales from 1.170 ms at 100 to 88.692 ms at
  1,000 and 2,428.569 ms at 5,000,
  while separately measured largest-case projection/layout are only
  15.070/2.735 ms. The recommendation therefore keeps a Worker rejected and
  proposes a bounded P6b graph-delta substage split plus main-thread lookup
  simplification if confirmed; image caching remains unsupported because no
  photo is decoded or painted.
- Candidate-only 5,000-node stress ceilings are presented with their explicit
  p95/25%-headroom methodology: 1,250 ms index, 3,225 ms incremental,
  300 ms initial render, 94 ms settled frame and 48 MiB retained-heap
  growth. No decision, test, build, check or CI rule activates them.
- Focused `npx vitest run --project node
  test/performance-characterization.test.ts` passed 10/10. Final
  `npm run test` passed 21/21 files and 106/106 tests in 6.90 s, proving the
  `.perf.ts` measurements are absent from the default suite.
- Final `npm run build` passed TypeScript no-emit and production esbuild.
  Final `git diff --check` exited 0 with only informational Windows LF/CRLF
  conversion warnings.
- `scripts/performance-result.mjs` is used by the orchestrator itself, not
  only by tests. It rejects a well-formed malformed partial before provenance,
  recommendation or evidence output is written. The generated raw
  `recommendation.scalingTrend` owns ordered points and growth ratios, and
  generated Markdown renders that raw trend before the P6b recommendation.
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md` now records implementation
  authorization, durable evidence paths and the active repair/re-review state;
  it no longer says P6a awaits authorization or evidence.

## Review

Executor handoff is ready for independent review. Review should attempt to
falsify fixture topology/counts, incremental equivalence, raw sample
cardinality/statistics, owning-window frame attribution, CDP heap labels,
source/environment provenance, Node 22/Linux compatibility and the
recommendation's scope boundary. Verdict remains pending; no executor review
is substituted for the required independent pass.

### Independent review — 2026-07-26

#### Findings

- **significant — the human-readable memory evidence contradicts the raw
  result and ticket.** The raw JSON records
  `node.runtime.explicitGcAvailable: false`, and all 42 Node heap observations
  are correctly labelled `retained-heap-observation`; the Journal and
  Retrospective say the same. The Markdown `Missing data` section instead says
  “Explicit garbage collection and every required timing/provenance seam were
  available.” This is not a one-off transcription error:
  `evidenceMarkdown()` emits that sentence whenever `missingData` is empty,
  while Node GC unavailability is deliberately not added to `missingData`.
  Therefore every equivalent rerun will regenerate the false claim. The
  stage tables remain correctly labelled and no leak claim is made, but the
  independently readable report is not internally honest enough to satisfy
  the memory/provenance acceptance boundary.
- **significant — the dedicated command cannot reproduce the evidence-backed
  scaling recommendation currently checked into Markdown.** The evidence
  record compares the stress incremental median at 100, 1,000 and 5,000 nodes
  before naming graph-delta as a hypothesis. Neither the raw JSON
  `recommendation` object nor the current `evidenceMarkdown()` template
  contains that scaling trend; a rerun overwrites the record without it.
  The remaining generated prose jumps from the largest-case dominant directly
  to a P6b recommendation. That violates the governing requirement to
  identify the dominant stage **and its scaling trend before recommending a
  change**, and makes the command's human-readable result disagree with the
  current evidence record.
- **minor — semantic partial-result validation is incomplete.** The
  orchestrator parses each partial and validates only runner/fixture version
  equality before reporting. It does not independently reject missing or
  duplicate size/profile cases, missing stages, wrong raw-sample
  cardinalities, invalid fixture counts or inconsistent summaries. The
  current producer loops and raw result are valid, but a well-formed malformed
  partial can pass the command contrary to the specification's malformed-result
  failure rule. The focused “invalid-result” coverage exercises
  `summarizeSamples()` inputs, not the combined result boundary.
- **minor — the parent plan's active-state prose is stale.** Its Blockers
  still say P6a awaits implementation authorization and its Evidence remains
  pending, although this ticket records authorization and completed execution.
  This does not change measurements, but the active record graph is not yet
  coherent for closure.

#### Verified Without Finding

- The generator creates stable zero-padded person/path identities and a
  deterministic undirected ring lattice. Offsets 1–2 yield exactly `2N`
  unique explicit edges/average degree 4; offsets 1–8 yield `8N`/average
  degree 16 at every supported size. No random, wall-clock or display-name
  identity input affects the fixture.
- The middle-person scenario updates exactly one existing offset-1
  relationship while preserving IDs and counts. Its affected set carries all
  incident relationships required by `applyGraphDelta()`, and every dedicated
  Node case checks the incremental snapshot against a normalized full rebuild.
- A read-only audit of the durable JSON found all six Node and six Chromium
  cases, exact `N`/`2N`/`8N` counts, 20 raw samples for each Node stage, 10 for
  each browser setup/update stage and 30 interaction frames per browser case.
  Recomputed min, median, nearest-rank p95 and maximum values, plus
  coalescing arithmetic, agree with the raw summaries and Markdown timing
  tables.
- Stage attribution matches the implementation boundaries: fresh
  `IndexState` population/raw snapshot, canonical graph, free-network
  projection, deterministic layout and aggregate graph-delta/projection/layout
  are timed separately; renderer `setGraph()` synchronous work and the
  owning-window canvas callback are separated. Graph/List transitions do not
  rebuild the graph, and the current same-document Chromium harness intercepts
  the renderer container's actual owning window.
- Browser heap capture uses the provider-backed CDP session and correctly
  labels collected observations; cleanup checks the renderer DOM and pending
  Atlas frame. Raw source/environment provenance includes the required
  calibrated-machine fields and explicitly bounds Linux/live-Obsidian claims.
- The performance projects remain outside default Vitest discovery and are
  reachable only through the dedicated package command. The reviewed diff
  adds no dependency, workflow automation, product optimization, Worker,
  cache or active threshold. The executor's journaled full performance,
  correctness, build and diff-hygiene gates were trusted and not repeated.

#### Verdict

**fail.** The raw timing/count evidence is structurally credible, but two
significant report-integrity defects prevent the independent-review acceptance
criterion from closing. Repair must make generated Markdown agree with raw GC
availability and make the dedicated command itself emit the measured scaling
trend before its recommendation; then a fresh independent review should
re-evaluate closure. Ticket status remains `active`.

#### Residual Risk

- Node heap values remain non-GC retained observations, so the candidate
  memory ceiling is a provisional calibrated proposal rather than a stable
  footprint or leak bound.
- Node 22/Linux executability was source-inspected but not run in this Windows
  evidence pass.
- Headless Chromium does not prove live Obsidian desktop, Bases, pop-out,
  assistive-technology or Mobile performance; those remain P7/manual work.
- Interaction samples isolate the animation-frame callback. Synchronous zoom
  event/layout-persistence argument construction is outside that callback, so
  the candidate frame ceiling must not be read as end-to-end input latency.

### Authorized closure-repair disposition

- **Resolved — generated GC availability is internally truthful.**
  `garbageCollectionStatements()` derives Node and Chromium prose separately
  from raw result fields. The regenerated Markdown states Node explicit GC was
  unavailable in the Vitest worker, labels those rows retained-heap
  observations and separately states that all 24 Chromium heap observations
  had explicit collection. Empty `missingData` now says only that no required
  timing/provenance value is missing; the universal false GC claim is absent.
  Focused coverage supplies false Node/true Chromium inputs and protects both
  statements.
- **Resolved — scaling evidence is reproducible raw data rendered before the
  recommendation.** `buildScalingTrend()` stores ordered 100, 1,000 and 5,000
  stress incremental median/p95 points plus consecutive growth ratios in
  `recommendation.scalingTrend`. `evidenceMarkdown()` consumes that field
  before emitting the P6b recommendation. The regenerated report therefore
  reproduces its evidence basis without a manual Markdown amendment.
- **Resolved — combined partial validation fails malformed results.**
  `validateCombinedPerformanceResults()` runs immediately after parsing and
  before provenance/recommendation/output. Focused invalid-result tests
  demonstrate rejection of a missing case, duplicate case, missing stage,
  wrong raw-sample count, invalid fixture count and a summary inconsistent
  with raw samples. The validator also checks the complete expected matrix,
  exact stage sets, warm-ups, interaction arithmetic and cleanup.
- **Resolved — parent plan state is coherent.** The parent now names P6a as
  the active child, records implementation authorization and durable evidence,
  and states that repair/re-review—not implementation authorization—is the
  remaining P6a gate.

No finding prompted a product source, Worker, cache, dependency, CI,
threshold or architecture-decision change. The historical independent-review
verdict above remains preserved. Ticket status stays `active`; a fresh
independent re-review must decide whether these dispositions close the four
findings.

### Independent re-review — 2026-07-26

#### Findings

- **minor — one regenerated substage value remains stale in the owning
  ticket.** The Evidence section correctly updates the dominant incremental
  result, three-point trend and candidate budgets, but still quotes
  largest-case projection/layout medians of `15.302/2.706 ms` from the first
  run. The regenerated raw JSON and generated Markdown both report
  `15.070/2.735 ms`. This does not change the bottleneck attribution or
  recommendation, but the ticket is not yet numerically coherent with its
  durable evidence.

#### Verified Repairs

- **GC finding resolved.** A direct audit of the persisted raw result found
  `node.runtime.explicitGcAvailable: false`, only
  `retained-heap-observation` Node rows, 24 Chromium heap observations and
  explicit collection available for all 24. The generated Markdown contains
  the two independently derived statements, contains no universal GC claim
  and limits empty `missingData` to timing/provenance values. Calling
  `garbageCollectionStatements()` on the persisted result reproduced the
  Markdown text exactly.
- **Scaling finding resolved.** Raw
  `recommendation.scalingTrend.points` is ordered 100, 1,000, 5,000 and
  contains the regenerated median/p95 values plus consecutive ratios.
  `buildScalingTrend()` reproduced that object exactly. Generated Markdown
  renders those points and ratios before the P6b recommendation; no manual
  evidence amendment is required.
- **Malformed-result finding resolved for every recorded shape.**
  `validateCombinedPerformanceResults()` runs before provenance,
  recommendation and output. Bounded direct mutations of the persisted
  result confirmed rejection of a missing case, duplicate case, missing
  stage, 9-of-10 browser sample set, invalid edge count and p95 inconsistent
  with raw samples. The focused tests cover the same boundaries plus the
  complete accepted matrix.
- **Parent-plan finding resolved.** The parent now names P6a as active,
  records implementation and repair authorization, points to both durable
  evidence files and states that independent re-review—not implementation
  authorization—is the remaining gate.
- The repair diff is confined to the result validator, runner/report
  generation, focused tests and `.10x` evidence/records. No product source,
  dependency, lockfile, CI workflow, Worker, cache, accepted threshold or
  architecture decision entered. The executor's journaled dedicated,
  focused, full-suite, build and diff-hygiene runs were trusted and not
  repeated.

#### Verdict

**concerns.** All four findings from the failed independent review are
resolved, and no significant measurement-validity, provenance or
scope-boundary defect remains. The sole remaining defect is the minor stale
projection/layout pair in this ticket's Evidence section. Keep the ticket
`active`; reconcile those two values with the regenerated raw/Markdown result
before orchestrator closure. No benchmark rerun or implementation change is
needed for that record-only correction.

#### Residual Risk

- Node heap values remain non-GC retained observations, so the candidate
  memory ceiling is a provisional calibrated proposal rather than a stable
  footprint or leak bound.
- Node 22/Linux remains source-inspected rather than executed in this Windows
  evidence pass.
- Headless Chromium still does not prove live Obsidian desktop, Bases,
  pop-out, assistive-technology or Mobile performance.
- Interaction timings still isolate the animation-frame callback rather than
  end-to-end input-handler latency.

### Final targeted confirmation — 2026-07-26

#### Findings

None.

#### Verified

- The owning Evidence prose now reports the regenerated 5,000-node stress
  free-network projection/deterministic-layout medians as
  `15.070/2.735 ms`.
- The persisted raw JSON rounds those medians to `15.070/2.735 ms`, and the
  generated Markdown reports the same values in both its recommendation basis
  and Node timing table.
- The historical independent re-review remains accurate history: it records
  that the ticket still contained `15.302/2.706 ms` when that review ran and
  identifies `15.070/2.735 ms` as the required correction. The later Journal
  entry records the authorized reconciliation without rewriting the historical
  finding or verdict.
- The reviewed change is confined to the owning ticket's record
  reconciliation. No new product, runner, test, evidence, dependency, CI,
  threshold or architecture-decision change entered after re-review. The
  journaled ticket-only diff check was trusted and no benchmark, test or build
  was repeated.

#### Verdict

**pass.** The final minor record mismatch is resolved. Together with the
verified four-finding closure repair, the independent-review criterion now has
no significant measurement-validity, provenance or scope-boundary defect.
Ticket status remains `active` solely for orchestrator closure.

#### Residual Risk

Unchanged from the independent re-review: Node heap is non-GC retained
evidence; Node 22/Linux and live Obsidian environments were not executed; and
interaction-frame timing is not end-to-end input latency.

## Retrospective

Keeping `.perf.ts` files outside ordinary Vitest patterns preserved a fast,
deterministic correctness gate while still reusing the exact production
index/graph/layout/renderer boundaries. The orchestrator needed no shell
composition or platform-specific executable name: spawning the installed
Vitest CLI through `process.execPath` kept the dedicated path portable.

The first focused failure was useful measurement-model evidence. Updating a
person causes existing delta code to remove all of that person's incident
edges, so the synthetic delta must carry the complete incident affected set
even though only one relationship record changed. Modelling that distinction
made the fixture representative of the existing index contract. Stable-key
serialization was also necessary because graph equivalence is about values
and deterministic array order, not JavaScript object property insertion
history.

The only dead end was treating `vitest/vitest.mjs` as an exported package
subpath. Resolving exported package metadata and joining the known sibling CLI
recovered without network access. The measurement itself then showed why P6a
preceded optimization: force/community Worker work and image caching still
have no workload, while the aggregate incremental path scales much more
sharply than separately measured projection and layout. A smaller P6b split
and main-thread lookup investigation is therefore the evidence-backed next
step.

Explicit Node GC did not reach the Vitest worker even though the parent CLI
was launched with `--expose-gc`; the result correctly retains those values as
non-GC heap observations. Chromium CDP collection was available. Neither is a
leak claim, and live Obsidian desktop, Bases, pop-out, assistive-technology and
Mobile performance remain intentionally unverified P7/manual work.

The closure repair exposed a report-as-product boundary: a correct raw file is
not sufficient when generated prose can contradict or omit its evidence.
Moving semantic validation, scaling derivation and GC statements into one
shared module makes malformed partials fail before publication and keeps
machine-readable analysis and human-readable recommendations generated from
the same facts. The initial strict-TypeScript failure in a negative test also
reinforced that malformed fixtures should be mutated explicitly rather than
through unchecked indexed access.
