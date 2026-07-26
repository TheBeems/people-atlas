Status: active
Created: 2026-07-26
Updated: 2026-07-26

# Performance characterization boundaries

Use these boundaries when extending People Atlas performance measurement or
shaping P6 work after P6a.

## Evidence before architecture

- Keep performance characterization outside ordinary correctness/build gates
  until hardware-calibrated budgets are explicitly ratified.
- A dedicated runner may fail on malformed evidence, but variable elapsed
  time is an observation rather than a pass/fail result.
- Preserve raw samples and derive human-readable prose, scaling trends and
  recommendations from the same validated result object.
- Validate the complete size/profile matrix, fixture counts, required stages,
  warm-up/sample cardinalities, recomputed summaries, interaction arithmetic
  and lifecycle cleanup before publishing evidence.
- Report garbage-collection availability per runtime. A heap observation
  without explicit collection is retained-heap evidence, not a leak claim.

## Deterministic workloads

- P6a uses connected undirected ring lattices at 100, 1,000 and 5,000 people.
  Sparse uses offsets 1–2 (`2N` edges, average degree 4); stress uses offsets
  1–8 (`8N` edges, average degree 16).
- Stable zero-padded person/path/relationship identities make fixtures
  reproducible without display-name identity, randomness, locale or wall
  clock.
- A changed person invalidates every incident edge in the current
  `applyGraphDelta()` path. An incremental-equivalence fixture must therefore
  carry the complete incident affected set even when only one relationship's
  content changed.
- Compare incremental and full graph results by stable values and
  deterministic array order, not JavaScript object property insertion order.

## Current calibrated finding

- On the 2026-07-26 calibrated Windows ARM64/headless-Chromium run, the
  5,000-node/40,000-edge stress aggregate incremental recomputation measured
  2,428.569 ms median and 2,564.362 ms p95.
- Its median trend was 1.170 ms at 100 nodes, 88.692 ms at 1,000 and
  2,428.569 ms at 5,000.
- Separately measured 5,000-node stress free-network projection and
  deterministic layout were only 15.070 ms and 2.735 ms median. The leading
  hypothesis is therefore graph-delta work inside the aggregate stage, not
  projection/layout.
- This evidence supports a bounded P6b substage split and main-thread lookup
  investigation. It does not justify a Worker: no transferable
  force/community workload was measured.
- It also does not justify an image cache because no photo was decoded or
  painted.

## Claim limits

- Candidate ceilings in the P6a evidence are proposals only; no test, build,
  check or CI rule enforces them.
- `ubuntu-latest`/Node 22 compatibility was source-inspected but not executed
  in the calibrated run.
- Headless Chromium does not prove live Obsidian desktop, Bases, pop-out,
  assistive-technology or Mobile performance.
- Interaction samples cover the owning animation-frame callback, not complete
  end-to-end input latency.

## References

- `.10x/specs/performance-characterization.md`
- `.10x/tickets/2026-07-26-performance-characterization.md`
- `.10x/evidence/2026-07-26-performance-characterization.md`
- `.10x/evidence/.storage/2026-07-26-performance-characterization.json`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `scripts/performance-result.mjs`
- `test/performance/fixture.ts`
