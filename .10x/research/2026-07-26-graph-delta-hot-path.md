Status: done
Created: 2026-07-26
Updated: 2026-07-26

# Graph-delta hot-path attribution

## Question

Which bounded main-thread operation is the most credible cause of P6a's
5,000-node/40,000-edge stress incremental recomputation result, and what is
the smallest justified P6b optimization boundary?

## Sources and Methods

- Read the calibrated P6a raw and human-readable evidence:
  `.10x/evidence/.storage/2026-07-26-performance-characterization.json` and
  `.10x/evidence/2026-07-26-performance-characterization.md`.
- Traced the measured Node sequence in
  `test/performance/node-characterization.perf.ts`.
- Inspected `src/graph/graph-delta.ts`, `src/graph/build-snapshot.ts`,
  `test/graph-delta.test.ts` and the closed equivalence ticket
  `.10x/tickets/2026-07-25-incremental-graph-equivalence.md`.
- This was a source-complexity inspection only. No benchmark, profiler, test
  or implementation change was run.

## Findings

- P6a measured the 5,000-node/40,000-edge stress aggregate incremental stage
  at `2,428.569 ms` median and `2,564.362 ms` p95. Separately measured
  free-network projection and deterministic layout medians were only
  `15.070 ms` and `2.735 ms`.
- The aggregate timer calls `applyGraphDelta()`, `projectGraph()` and
  `createDeterministicLayout()` in sequence. The separate measurements make
  graph-delta application the dominant remaining hypothesis, but P6a does not
  persist a direct graph-delta-only timing.
- `applyGraphDelta()` loops over every previous edge. For each edge it calls
  `previous.nodes.find()` once for the source and once for the target. With
  `N` nodes and `E` edges this lookup path is O(E*N); the calibrated stress
  fixture exercises roughly 40,000 edges against 5,000 nodes.
- The same function also resolves changed references with repeated
  `people.filter()`/`people.find()` scans and locates output nodes by spreading
  and scanning `nodes.values()`. Those costs scale with the affected records
  rather than every retained edge in the P6a scenario, so they are secondary
  candidates after the per-edge endpoint lookup.
- The existing full-build path already demonstrates the smallest suitable
  mechanism: per-call maps keyed by person ID, file path and output node path.
  No persistent cache, Worker, new dependency or public API is required to
  apply that pattern inside the pure graph transformation.
- Existing authority requires delta output to remain semantically equivalent
  to a full rebuild, including duplicate-person ambiguity, inferred contact
  edge IDs, filtered counts and diagnostics. An optimization cannot weaken
  those differential checks.

## Conclusions

- The smallest justified P6b scope is a main-thread, per-call lookup-index
  optimization inside `applyGraphDelta()`, preceded by direct graph-delta
  substage timing in the dedicated performance harness.
- A Worker remains unjustified: the leading cost is repeated synchronous
  lookup work with no demonstrated transferable compute boundary.
- An image cache remains unrelated because the calibrated workload decodes
  and paints no photos.
- P6b needs a user-ratified performance gate that demonstrates a material
  improvement; P6a's candidate `3,225 ms` incremental ceiling alone cannot do
  so because the unoptimized baseline already passes it.

## Limits

- Complexity attribution is source-backed but has not yet been confirmed by a
  direct graph-delta-only timing or CPU profile.
- Absolute timing evidence remains calibrated to the recorded Windows ARM64
  and headless-Chromium environment.
- Live Obsidian desktop, Bases, pop-out and Mobile performance remain P7/manual
  validation and are not implied by this investigation.
