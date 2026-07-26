Status: done
Created: 2026-07-26
Updated: 2026-07-27

# P7b — Generated graph and index invariants

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-controlled-obsidian-integration-harness.md`

## Scope

Implement `.10x/specs/generated-graph-index-invariants.md` as the second
bounded P7 child:

1. add one dependency-free deterministic generator/helper under
   `test/generated/`;
2. add generated canonical-snapshot, graph-delta-equivalence and
   index-state-model suites with at least 64 fixed seeds per family;
3. make every failure replayable from its family, seed and operation number;
4. expose a focused `npm run test:generated` command while retaining default
   Node-suite discovery;
5. verify the generated suites, full suite, production build and diff hygiene.

## Non-goals

- Product-source changes or repair of a defect exposed by a generated case.
- New graph, identity, relationship, projection or persistence semantics.
- A new property-testing dependency or nondeterministic fuzzing.
- Renderer/browser/integration/high-DPI/pop-out/live-Obsidian work.
- P6 fixture, benchmark or threshold changes.
- Lockfile, CI dependency provisioning or release-hardening changes.

## Acceptance Criteria

- [x] A pure TypeScript seeded generator under `test/generated/` produces
      bounded deterministic graph and lifecycle cases without `Math.random()`,
      wall-clock input or new dependencies.
- [x] Snapshot invariant tests run at least 64 fixed seeds and prove edge
      referential integrity, unique node/edge IDs, path-owned people,
      fail-closed duplicate/unresolved/display-name behavior, rich and parallel
      relationship preservation, and exact filtered accounting.
- [x] Graph-delta tests run at least 64 fixed seeds across valid person and
      relationship add/update/remove transitions and compare each incremental
      result with a fresh rebuild, excluding only `generatedAt` and
      unspecified collection order.
- [x] Index-state tests run at least 64 fixed seeds across bounded operation
      sequences and compare snapshots, ID indexes, duplicate sets, adjacency,
      diagnostics, dependencies and revisions with a simple test-owned model
      after every operation.
- [x] Generated failure output identifies invariant family, seed and operation
      number or transition so the case is exactly replayable.
- [x] Existing fixed regression tests and P6 deterministic performance
      fixtures remain unchanged and continue to run through their existing
      owners.
- [x] `npm run test:generated` runs only the P7b suites; `npm run test`
      continues to include them without changing browser or integration
      discovery.
- [x] `npm run test:generated`, `npm run test`, `npm run build` and
      `git diff --check` pass.
- [x] The implementation changes no product source, dependency, lockfile,
      performance threshold, persisted schema or release workflow.
- [x] Fresh independent review records findings, verdict and residual risk;
      closure requires `pass` or explicit acceptance of non-critical risk.

## References

- `.10x/specs/generated-graph-index-invariants.md`
- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/domain/types.ts`
- `src/index/index-state.ts`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `src/graph/graph-elements.ts`
- `test/build-snapshot.test.ts`
- `test/graph-delta.test.ts`
- `test/index-state.test.ts`
- `test/performance/fixture.ts`
- `vitest.config.ts`
- `package.json`

## Assumptions

- User-ratified: P7b is the next shaping priority after the committed P7a
  child.
- Record-backed: explicit person IDs and canonical paths are authoritative;
  display names and aliases are not identity keys.
- Record-backed: duplicates and unresolved references remain fail-closed,
  parallel relationship entities remain distinct, and filtered endpoints are
  distinguishable from unresolved endpoints.
- Record-backed: valid incremental graph deltas must remain equivalent to fresh
  canonical rebuilds, and pure index state owns path, ID, dependency, asset and
  adjacency indexes.
- Mechanical: 64 fixed seeds per invariant family and the stated small fixture
  bounds provide broad default-suite coverage without becoming a P6
  performance workload.
- Mechanical: exact helper filenames, PRNG implementation and test grouping
  may be chosen by the executor while the deterministic replay and proof
  boundary remain unchanged.

## Journal

- 2026-07-26: P7a closed with controlled plugin/index/standalone/Bases
  lifecycle evidence and was committed locally as `0047449`.
- 2026-07-26: Read-only P7b shaping compared the P7 gap analysis, P1/P2
  contracts, current fixed graph/delta/index tests and existing dependencies.
  Current examples cover important regressions but not broad generated
  sequences or independent index-model equivalence.
- 2026-07-26: The active governing specification and this bounded executable
  ticket were created. P7b reuses the default Node project and existing
  Vitest/TypeScript stack, adds no dependency and explicitly stops for separate
  authorization if a valid seed exposes a product defect.
- 2026-07-26: Per the shaping/execution boundary, no generated helper, test,
  script or product implementation occurred in this ticket-authoring turn.
- 2026-07-26: The user explicitly authorized `Implementeer P7b`. Execution
  added one dependency-free seeded case helper plus separate generated
  snapshot, graph-delta and index-state suites under `test/generated/`.
  `package.json` gained only the focused `test:generated` script.
- 2026-07-26: The first focused run exposed two test-input defects rather than
  product defects. The filtered delta omitted incident relationships and
  duplicate diagnostics from its explicitly dependent records, while the
  index reference assertion treated the public dependent-path set as
  order-sensitive. The test inputs were corrected to be contract-complete and
  order-insensitive; no seed, invariant or product source was changed.
- 2026-07-26: Final executor verification passed all focused, default, build
  and diff-hygiene gates. P7b remains `active` for fresh independent review;
  the executor did not close, commit or push it.
- 2026-07-27: Independent review returned `concerns` with three significant
  proof gaps: missing parallel/duplicate relationship churn in generated
  deltas, snapshot fixtures without direct path/fail-closed assertions, and
  incomplete family/seed/operation context on lifecycle failures. The user
  authorized exactly those three repairs.
- 2026-07-27: The bounded repair added parallel relationship add/update/remove,
  duplicate relationship-ID appearance/disappearance and explicit surviving
  path-owned entity assertions to every delta seed. Contract-complete deltas
  now include same-ID relationship records when duplicate identity changes
  require stable edge-ID remapping.
- 2026-07-27: Snapshot assertions now prove the canonical-path contact reaches
  the exact path-owned node, self and unresolved rich relationship records emit
  no edge, and the visible-to-hidden contact remains filtered without a
  target-specific `unresolved-contact`.
- 2026-07-27: Lifecycle execution is guarded by a shared context wrapper.
  Graph setup, each numbered transition and the filtered transition identify
  family, seed and operation; index case generation and every numbered
  operation do the same, with ordinary upsert/remove revision assertions also
  carrying the exact context.
- 2026-07-27: The first repair-focused run failed only the new survivor
  assertion because the generated sequence invalidated both parallel endpoints
  through a person-ID change before checking survival. The valid fixture order
  was minimized by checking primary removal while the independent parallel
  entity remained resolvable, then performing identity churn. No product
  source, seed or invariant was removed or weakened.
- 2026-07-27: Final repair verification passed focused, default, build and
  diff-hygiene gates. P7b remains `active`, its review criterion remains open
  and fresh independent re-review is the only closure blocker.
- 2026-07-27: Fresh independent repair re-review returned `pass` with no new
  finding. It verified relationship-entity churn and survivor identity,
  direct path/fail-closed snapshot assertions, complete failure context and
  unchanged test-only scope. Every acceptance criterion now maps to executor
  evidence and independent review, so the orchestrator closed P7b as `done`.

## Blockers

None. Implementation, repair verification and fresh independent re-review
passed within the pure-Node generated-invariant boundary.

## Evidence

- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md` identifies broad
  generated graph/index invariant coverage as a material gap after P1–P6.
- `test/build-snapshot.test.ts`, `test/graph-delta.test.ts` and
  `test/index-state.test.ts` provide fixed regression cases but no seeded
  corpus or test-owned state-machine model.
- `package.json` contains no property-testing dependency; the existing
  Vitest/TypeScript Node test path is sufficient for a local deterministic
  generator.

- `npm run test:generated` passed 3 generated files and 192 tests: 64 fixed
  seeds each for snapshot, graph-delta and index-state families.
- `npm run test` passed 25 files and 302 tests, including the existing Node,
  browser and P7a integration owners.
- `npm run build` passed `tsc --noEmit` and the production esbuild step.
- `git diff --check` exited `0`; Git emitted only existing LF-to-CRLF working
  copy warnings for the parent ticket and `package.json`.
- A generated-source scan found no `Math.random`, wall-clock construction or
  runtime `obsidian` import under `test/generated/`.
- `git status --short` showed only the pre-existing P7b shaping records, the
  P7b parent/package updates and the new `test/generated/` implementation.
- Post-repair `npm run test:generated` passed 3 generated files and 192 tests.
- Post-repair `npm run test` passed 25 files and 302 tests.
- Post-repair `npm run build` passed `tsc --noEmit` and production esbuild.
- Post-repair `git diff --check` exited `0`, with only the existing LF-to-CRLF
  working-copy warnings for the parent ticket and `package.json`.
- Post-repair scope inspection still shows no product source, dependency,
  lockfile, browser/integration, performance or release change. A generated
  source scan found no `Math.random`, wall-clock construction or runtime
  `obsidian` import.
- Static context inspection confirms every graph lifecycle setup/transition
  and index case/operation is wrapped with a family, seed and operation label;
  ordinary index revision assertions include that same context directly.
- Fresh independent repair re-review returned `pass` without a new finding and
  accepted the executor gates within their recorded limits.

## Review

### Findings

- **Significant — The graph-delta family does not exercise the specified
  relationship-entity churn.** Each seed drives one relationship path through
  add, metadata/endpoint update and remove, but never constructs parallel
  relationship records or a duplicate relationship ID that appears and later
  disappears. The snapshot family contains those shapes, but the governing
  delta contract and its “relationship churn preserves entities” scenario
  require them in generated before/after transitions. A defect in incremental
  duplicate-edge ID remapping or surviving parallel-edge preservation would
  therefore not be detected by this suite.
- **Significant — Several canonical snapshot requirements are represented in
  fixtures but are not actually proved by assertions.** The generated person
  with a canonical-path contact is never asserted to resolve to that exact
  path-owned node. Self and unresolved rich relationships are checked for
  diagnostics but not checked to be absent from visible rich edges. Likewise,
  filtered counts and diagnostics are asserted, but the visible-to-hidden
  contact is not specifically checked to avoid an additional
  `unresolved-contact` diagnostic. These tests could stay green while violating
  the fail-closed/path-resolution behavior stated in clauses 9, 10, 12 and 13.
- **Significant — Lifecycle failure output does not always include the
  operation number required for replay.** The test names identify family and
  seed, and the final equality assertions add an operation context, but calls
  made before those assertions can throw with only the test title. The
  index-state revision assertions for ordinary upsert/remove operations also
  omit the constructed operation context. Consequently a failing lifecycle
  case is not guaranteed to report family, seed and operation as required by
  clauses 3 and 24.

### Verified Without Finding

- `GENERATED_SEEDS` is `64`, and each of the snapshot, graph-delta and
  index-state files statically registers 64 separate `it(...)` cases, for 192
  distinct family/seed tests rather than 192 assertions hidden in one case.
- The local xorshift generator is deterministic, uses no `Math.random()` or
  wall-clock input and produces seed-specific paths, IDs and metadata. Fixture
  sizes are statically bounded below the 24-person, 48-relationship,
  four-contact and 40-operation ceilings.
- Required adversarial snapshot shapes are deliberately present in every seed
  rather than merely being probabilistically possible: duplicate person IDs,
  duplicate labels/aliases, ambiguous references, duplicate and parallel
  relationship records, self/unresolved relationships and a filtered person
  are hard corpus members.
- Snapshot comparison preserves all node, edge, metadata, diagnostic and count
  fields, excluding `generatedAt` and normalizing only top-level collection
  order plus diagnostic `filePaths` order.
- The index reference model is test-owned and recomputes indexes from its
  path-owned file map rather than reading production maps. Historical-key
  checks cover stale person/relationship IDs, contact and asset dependencies,
  relationship adjacency, stored diagnostics, removal, clear and monotonic
  post-clear revisions.
- Static discovery and scope inspection found only the focused
  `test:generated` script plus new pure-Node files under `test/generated/`.
  Default Node discovery still includes them, browser/integration discovery is
  unchanged, existing regression/performance tests are untouched, and there
  are no product-source, dependency, lockfile, schema, CI or release changes.
- The executor-recorded focused, default, build and diff-hygiene gates are
  accepted within their stated bounds and were not rerun during this review.

### Verdict

`concerns`

The implementation is close, but the three significant proof gaps above mean
the current checked acceptance claims are not yet independently supported and
P7b should not be closed as `done`.

### Residual Risk

Even after the findings are repaired, the 64 seeds deliberately vary identity
tokens, ordering and selected metadata more than topology. This is acceptable
for the bounded P7b contract because the hard adversarial shapes are guaranteed
in every seed, but it is not exhaustive fuzzing or a substitute for P7a/P7d
controlled and live Obsidian evidence.

### Repair Re-review Findings

None. The three authorized repairs close the three significant findings
without introducing a new finding.

### Repair Re-review Verified Without Finding

- Every graph-delta seed now creates independent primary and parallel
  relationship paths, adds a second path with the primary relationship ID,
  removes that duplicate and later removes each surviving relationship.
  Same-ID paths are added to the delta's contract-complete path set, so
  appearance/disappearance remaps both affected entities rather than accepting
  a partial delta.
- Every numbered relationship transition still compares the complete
  incremental snapshot with a fresh rebuild. Direct assertions additionally
  prove two unique path-owned edges during duplicate appearance, restoration
  of the primary ID after duplicate disappearance, preservation of the
  independent parallel entity, and its survival after the primary path is
  removed.
- The canonical-path contact assertion identifies the exact alpha source,
  path-derived target node, source file and inferred edge. Self and unresolved
  rich records are each resolved to their generated fixture path and asserted
  absent from visible edges. The visible-to-hidden contact is checked against
  its exact source and hidden target text to prove it did not also become an
  `unresolved-contact`.
- Graph initial state mutations, initial snapshot/build, every numbered
  transition and the filtered transition execute inside
  `withGeneratedContext`; index case generation and every numbered operation
  do likewise. The wrapper prefixes thrown pre-assert errors, while all
  ordinary upsert/remove revision assertions carry the same
  family/seed/operation context. Graph corpus construction occurs before the
  first state transition, so the family/seed test name remains sufficient
  replay context at that non-operation boundary.
- Existing full-rebuild, snapshot, index-model and stale-cleanup assertions
  remain present; the repairs add assertions and lifecycle shapes rather than
  weakening comparisons, reducing seeds or discarding an invariant.
- Scope remains confined to the P7b records, `package.json` focused script and
  pure tests under `test/generated/`. No product source, dependency, lockfile,
  browser/integration test, performance fixture/threshold, CI or release file
  entered the repair scope.
- The executor's post-repair focused, default, build and diff-hygiene evidence
  is accepted within its recorded bounds and was not rerun in this independent
  re-review.

### Repair Re-review Verdict

`pass`

The three previously significant proof gaps are closed. P7b can proceed to
orchestrator closure within its pure-Node generated-invariant boundary.

### Repair Re-review Residual Risk

The corpus intentionally guarantees the same adversarial lifecycle topology in
every seed while varying identities, order and selected metadata. It is
deterministic contract coverage, not exhaustive fuzzing, and it does not add
live Obsidian, renderer or performance evidence.

## Retrospective

The smallest useful generated corpus is not a collection of random fixtures:
it is three replayable state families whose generated names and metadata vary
while every seed deliberately retains the hard identity, relationship,
filtering and lifecycle shapes. A test-owned recomputing index model provides
stronger stale-entry evidence than duplicating the production index maps.
Contract-complete graph deltas must include incident relationships and current
duplicate diagnostics whenever a changed person path invalidates retained
edges. Live Obsidian, renderer behavior and performance thresholds remain
outside this pure Node proof.

The review repair also established that relationship-ID churn needs two
separate proofs: full-rebuild equivalence catches structural remapping, while
path-owned survivor assertions prove that an independent parallel entity did
not disappear behind an otherwise equal invalid-endpoint state. Lifecycle
context belongs around the operation boundary, not only on the final equality
assertion, so generator/setup failures are replayable too.
