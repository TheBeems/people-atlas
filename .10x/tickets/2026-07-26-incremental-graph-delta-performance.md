Status: done
Created: 2026-07-26
Updated: 2026-07-26

# P6b — Incremental graph-delta performance

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-performance-characterization.md`

## Scope

Implement `.10x/specs/incremental-graph-delta-performance.md` as one bounded
P6b outcome:

1. extend the manual performance harness with direct graph-delta, incremental
   projection and incremental layout timings and persist a P6b-owned
   pre-change baseline;
2. calculate the ratified 5,000-node stress trigger ratio;
3. only when the ratio is at least 80%, replace repeated full-array lookups
   inside `applyGraphDelta()` with per-call maps;
4. prove full-build equivalence and the ratified final `750 ms` median /
   `1,000 ms` p95 aggregate incremental gate.

## Non-goals

- A Worker, persistent cache, image cache or transferable graph representation.
- A new dependency, public graph API or snapshot schema.
- CI automation or a default-test timing threshold.
- Projection, layout, rendering, indexing, mutation or persistence behavior
  changes.
- Linux or live Obsidian performance claims.
- Optimizations outside `applyGraphDelta()` unless fresh evidence returns the
  ticket to shaping first.

## Acceptance Criteria

- [x] P6b-owned raw and Markdown baseline evidence contains direct
      graph-delta, projection, layout and aggregate incremental samples without
      rewriting the closed P6a evidence.
- [x] The recorded pre-change 5,000-node stress ratio is calculated as direct
      graph-delta median divided by aggregate incremental median.
- [x] A ratio below 80% stops all product-source work and returns the ticket to
      shaping; a ratio at or above 80% authorizes only the per-call lookup-map
      optimization in this ticket.
- [x] `applyGraphDelta()` retains its public signature, purity and semantic
      equivalence with full rebuilds.
- [x] Duplicate identities remain ambiguous; inferred contact edge identity,
      relationship metadata, filtered counts, diagnostics and ghost behavior
      remain covered.
- [x] The final calibrated 5,000-node/40,000-edge stress aggregate incremental
      median is at most 750 ms and nearest-rank p95 is at most 1,000 ms.
- [x] The dedicated benchmark remains manual and outside default Vitest
      discovery and CI.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.
- [x] Fresh independent review records findings, verdict and residual risk;
      closure requires `pass` or explicit acceptance of non-critical risk.

## References

- `.10x/specs/incremental-graph-delta-performance.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/performance-characterization.md`
- `.10x/research/2026-07-26-graph-delta-hot-path.md`
- `.10x/knowledge/performance-characterization-boundaries.md`
- `.10x/evidence/2026-07-26-performance-characterization.md`
- `.10x/tickets/2026-07-25-incremental-graph-equivalence.md`
- `.10x/tickets/2026-07-26-performance-characterization.md`
- `src/graph/graph-delta.ts`
- `src/graph/build-snapshot.ts`
- `test/graph-delta.test.ts`
- `test/performance/node-characterization.perf.ts`

## Assumptions

- User-ratified: direct graph-delta must account for at least 80% of the
  pre-change 5,000-node stress aggregate median before product optimization.
- User-ratified: final calibrated aggregate median/p95 gates are
  `750/1,000 ms`.
- User-ratified: no Worker, persistent cache, image cache, dependency, API
  change or CI threshold enters P6b.
- Record-backed: incremental graph results must remain equivalent to a full
  rebuild without guessing duplicate or unresolved identities.
- Record-backed: P6a evidence is closed historical evidence and must not be
  rewritten by P6b.
- Mechanical: exact filenames for P6b baseline/final evidence may be chosen by
  the executor as long as they are distinct, date-stamped and referenced here.

## Journal

- 2026-07-26: P6a closed and was committed locally as `2fb576c`.
- 2026-07-26: Read-only source attribution found two
  `previous.nodes.find()` calls for every retained edge in
  `applyGraphDelta()`, an O(E*N) path for the calibrated stress fixture.
  Secondary repeated people/path/node scans affect only the changed records.
  Investigation recorded in
  `.10x/research/2026-07-26-graph-delta-hot-path.md`.
- 2026-07-26: The user ratified the 80% conditional trigger, final
  `750/1,000 ms` aggregate gates and the exclusion of Workers, caches,
  dependencies, API changes and CI thresholds. The governing spec was
  activated and this executable ticket was opened. Per 10x shaping/execution
  separation, no implementation occurs in the ticket-authoring turn.
- 2026-07-26: The user explicitly authorized implementation. Execution began
  after reading the complete ticket, governing P6b/P6a/canonical graph specs,
  hot-path research, performance-boundary knowledge, P6a evidence and closure
  ticket, incremental-equivalence history, parent plan and referenced
  graph/performance source. The existing uncommitted P6b shaping records are
  preserved. Scope remains the manual substage harness, conditional per-call
  maps inside `applyGraphDelta()`, semantic equivalence and the ratified
  calibrated gates; no commit or push is authorized.
- 2026-07-26: Added a separate `perf:graph-delta` manual path and
  `performance-graph-delta` Vitest project. It reuses the closed P6a
  deterministic fixture but writes only date-stamped P6b baseline/final
  artifacts, records direct graph-delta/projection/layout plus aggregate
  samples and validates the complete matrix, exact counts, sample summaries
  and aggregate/substage timing relationship before publication. The first
  focused validator run exposed and repaired one missing parenthesis in the
  new test fixture; the rerun passed 12/12 in 637 ms. Product source remains
  unchanged pending the persisted baseline trigger.
- 2026-07-26: Pre-change `npm run perf:graph-delta -- baseline` passed its
  complete six-case run in 70.29 s and wrote
  `.10x/evidence/2026-07-26-incremental-graph-delta-baseline.md` plus
  `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-baseline.json`.
  On the 5,000-node/40,000-edge stress case, direct graph-delta measured
  `2,080.775 ms` median, aggregate incremental measured `2,100.065 ms`
  median/`2,144.681 ms` nearest-rank p95, projection/layout medians were
  `14.342/2.115 ms`, and the persisted trigger ratio was
  `0.990814782117406`. Because this is at least `0.80`, the ticket authorizes
  only its bounded per-call lookup-map product change.
- 2026-07-26: Replaced the retained-edge loop's two per-edge
  `previous.nodes.find()` calls and the affected-record people/path/output-node
  scans with maps built locally for one `applyGraphDelta()` call. The exported
  signature and snapshot schema are unchanged; no shared cache, Worker,
  dependency or unrelated optimization entered. Focused delta/result coverage
  passed 16/16 in 625 ms, including full-rebuild equivalence, duplicate-ID
  remapping, inferred contacts, filtered counts, resolved-ghost cleanup and
  rich relationship metadata.
- 2026-07-26: The final evidence run was regenerated after the last test/type
  corrections and passed its complete six-case project in 2.93 s. The
  5,000-node stress result is direct graph-delta `20.286 ms` median /
  `29.891 ms` p95, projection `8.309 ms` median, layout `1.439 ms` median and
  aggregate `30.231 ms` median / `41.898 ms` nearest-rank p95. Both ratified
  `750/1,000 ms` gates pass. The raw final result retains the exact baseline
  trigger ratio `0.990814782117406`.
- 2026-07-26: Final correctness verification passed 21/21 files and 109/109
  tests in 6.72 s. The first production build exposed only two new
  test/harness typing defects: an invalid relationship-direction literal in
  the added regression and the missing declaration for the exported result
  validator. Correcting those bounded fixtures/declarations produced a
  passing `npm run build`; the post-correction full suite remained 109/109.
  Standalone `git diff --check` exited 0 with informational LF/CRLF warnings
  only. Both persisted P6b JSON artifacts passed the shared semantic validator,
  each contains six cases and 20 samples for every required stage, and the
  generated Markdown agrees with their rounded trigger/gate values.
- 2026-07-26: Fresh independent review returned `pass` with no finding. It
  independently recomputed the exact `0.9908147821174058` trigger ratio and
  every raw summary, confirmed the baseline preceded product source changes,
  verified the bounded per-call-map diff and canonical graph semantics, and
  confirmed final aggregate `30.231 ms` median / `41.898 ms` p95 against the
  ratified `750/1,000 ms` gates. The orchestrator therefore closed P6b as
  `done`.

## Blockers

None. Execution, calibrated gates and independent review all passed.

## Evidence

- Baseline raw evidence:
  `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-baseline.json`;
  independently readable baseline:
  `.10x/evidence/2026-07-26-incremental-graph-delta-baseline.md`. The unchanged
  5,000-node stress source measured graph-delta `2,080.775 ms` median versus
  aggregate `2,100.065 ms` median, producing the exact persisted
  `0.990814782117406` trigger ratio and authorizing the bounded change.
- Final raw evidence:
  `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-final.json`;
  independently readable final:
  `.10x/evidence/2026-07-26-incremental-graph-delta-final.md`. It preserves the
  baseline ratio and records aggregate `30.231 ms` median / `41.898 ms` p95,
  passing both calibrated gates by wide margins.
- `test/performance/graph-delta-characterization.perf.ts`,
  `scripts/graph-delta-characterize.mjs`, `vitest.performance.config.ts` and
  `package.json` expose one manual `npm run perf:graph-delta --
  baseline|final` path. It is absent from default `*.test.ts` discovery and no
  CI workflow changed.
- `scripts/performance-result.mjs` validates runner/fixture versions, all six
  exact size/profile cases, four exact stages, five warm-ups, twenty raw
  samples, recomputed summaries and aggregate/substage consistency before
  publication. Focused malformed-result coverage protects missing-stage and
  impossible aggregate evidence.
- `src/graph/graph-delta.ts` owns only per-call ID/path/node maps.
  `test/graph-delta.test.ts` and the unchanged deterministic performance
  equivalence assertion cover canonical graph values, stable identities,
  metadata, diagnostics, filtered counts and ghost cleanup.
- Final `npm run test` passed 21 files/109 tests; final `npm run build` passed
  TypeScript no-emit plus production esbuild; standalone `git diff --check`
  exited 0 with line-ending warnings only.

## Review

Executor handoff is ready for fresh independent review. Review should attempt
to falsify the baseline trigger arithmetic and provenance, the aggregate
timer boundaries and raw sample summaries, lookup-map duplicate/path ordering,
full-build equivalence, manual-only discovery boundary and final calibrated
gate. No executor verdict is substituted for that review.

### Independent review — 2026-07-26

#### Findings

None.

#### Verified Without Finding

- **Baseline ordering and ownership.** The baseline raw provenance is anchored
  to `HEAD` `2fb576c862d75f4de489da1f579427336a5709e8`; its dirty-path inventory
  contains the additive P6b harness/records but not
  `src/graph/graph-delta.ts` or any other product source. Baseline timestamp
  precedes the final timestamp, and baseline/final use distinct P6b JSON and
  Markdown paths. The closed P6a evidence and ticket are unchanged from
  `HEAD`.
- **Trigger arithmetic.** Recomputing the persisted baseline gives
  `2080.774949999999 / 2100.0645000000004 =
  0.9908147821174058`. This is direct `graph-delta` median divided by
  aggregate `incremental-recomputation` median and exceeds the ratified
  `0.80` trigger. Baseline Markdown rounds the same operands/ratio honestly;
  final raw evidence carries the exact baseline ratio and points back to the
  separate baseline artifact.
- **Bounded product change.** The `applyGraphDelta()` export, parameters,
  return contract and pure-call boundary are unchanged. The product diff adds
  only a per-call person-ID map preserving array order, first-person-path and
  first-node-path maps preserving the former `find()` order, plus a per-call
  previous-node-ID map for retained edges. No state survives the call. No
  Worker, cache, dependency, public graph API, snapshot change, CI wiring or
  default timing threshold entered.
- **Semantic preservation.** Duplicate-ID lookup still returns the complete
  ordered match set and fails closed when multiple matches exist. Resolved
  path then raw-path fallback preserve the former precedence and first-match
  behavior. Node lookup remains by person file path over the visible/remapped
  node population, so filtered endpoints stay diagnostic rather than
  unresolved. Inferred contact-edge remapping, rich relationship fields,
  duplicate relationship identity, diagnostics, hidden counts and final
  orphan-ghost cleanup remain on their existing code paths. Differential
  assertions cover duplicate appearance/removal, filtered contacts and
  inferred IDs; the added regression covers resolved-ghost removal and rich
  relationship metadata; every deterministic performance case checks stable
  identities/counts and incremental/full-rebuild equivalence before sampling.
- **Raw evidence and gate.** The shared validator accepts both persisted
  artifacts as complete six-case matrices with exact counts, four exact
  stages, five warm-ups and twenty raw samples per stage. An independent
  recomputation found no min/median/nearest-rank-p95/max mismatch. Every
  aggregate sample is at least its recorded substage sum. The final
  5,000-node stress aggregate is `30.23084999999992 ms` median and
  `41.89780000000019 ms` p95, satisfying `750/1000 ms`; the raw `finalGate`,
  generated Markdown and ticket use the same result. The single larger final
  sample remains preserved as the maximum rather than discarded.
- **Provenance and verification scope.** Both reports identify the calibrated
  Windows ARM64 host, exact `HEAD`, dirty state/diff hash, timestamp, Node,
  npm, Vitest, runner and fixture versions and explicitly reject Linux/live
  Obsidian generalization. The manual project lives only in
  `vitest.performance.config.ts`, its file is named `.perf.ts`, the default
  project/CI workflow is unchanged and `npm run check` contains no performance
  command. Journaled focused/full/build/diff results are stated at the
  boundaries their assertions support and were not rerun for reassurance.
- **Ticket completeness.** Scope, non-goals, ratified assumptions,
  conditional trigger, baseline-before-source journal, final gate, blockers,
  artifact references and retrospective agree. Independent review remains the
  only open checkbox and the ticket correctly remains `active`.

#### Verdict

**pass.** No critical, significant, minor or nit finding remains within the
ratified P6b scope. The persisted pre-change evidence authorizes exactly the
implemented per-call maps, semantic evidence remains equivalent to the full
builder for the covered contracts, and the calibrated final aggregate meets
both manual closure gates. Ticket status remains `active` for orchestrator
closure.

#### Residual Risk

- The timing gate is calibrated to one Windows ARM64 machine and one
  deterministic person-plus-relationship delta; it is not a Linux, live
  Obsidian, Bases, pop-out or Mobile performance claim.
- Differential equivalence remains scenario-based rather than exhaustive
  property-based coverage; broader randomized invariants remain P7 work.
- The manual baseline command can overwrite its date-stamped path if
  deliberately rerun on the same date. The persisted provenance currently
  proves the reviewed baseline was pre-product-change; future reruns must not
  be substituted for it without a new ratified baseline.

## Retrospective

The pre-change decision gate prevented source inspection from becoming
premature optimization: the persisted ratio confirmed that graph-delta owned
more than 99% of the measured aggregate median before any product edit. The
same runner then made the magnitude and attribution of the improvement
auditable without rewriting P6a history.

The smallest mechanism was sufficient. A previous-node ID map removes the
O(E*N) retained-edge path, while per-call person-ID, person-path and output-node
maps remove the secondary affected-record scans. Preserving insertion order
for ID match arrays and first path/node entries retains the old fail-closed
resolution behavior without a persistent cache or general graph-index
abstraction.

One avoidable build round came from treating a domain direction label and an
ES module export as test-runtime concerns. The production typecheck correctly
caught both. Keeping the repair to the test literal and declaration file
preserved the already-measured product implementation, and regenerating final
evidence afterward restored exact source provenance.
