Status: active
Created: 2026-07-26
Updated: 2026-07-26

# Incremental graph-delta performance

## Purpose

Reduce the calibrated large-graph incremental recomputation delay without
changing the canonical graph, its public API or its fail-closed identity and
diagnostic semantics.

## Governing Contract

### Direct attribution before optimization

- The dedicated manual performance harness MUST time `applyGraphDelta()`,
  incremental projection and incremental deterministic layout as separate
  substages while retaining the aggregate incremental-recomputation timing.
- The pre-change 5,000-node/40,000-edge stress baseline MUST be persisted in
  P6b-owned raw and human-readable evidence. Closed P6a evidence MUST NOT be
  overwritten.
- The implementation trigger is:

  `graph-delta median / aggregate incremental median >= 0.80`

  using the pre-change 5,000-node stress samples on the same calibrated
  Windows environment used for P6a.
- If the trigger is not met, product source MUST NOT be optimized under this
  specification. The executor MUST record the result and return the ticket to
  shaping as blocked.

### Bounded optimization

- When the trigger is met, `applyGraphDelta()` MUST replace repeated
  full-array endpoint, person and path scans with per-call lookup maps.
- Lookup state MUST remain local to one pure graph transformation call. It
  MUST NOT introduce persistent caching, cross-call invalidation or mutable
  global state.
- The exported `applyGraphDelta()` signature and the `AtlasSnapshot` contract
  MUST remain unchanged.
- The implementation SHOULD reuse the smallest existing graph helpers that
  prevent semantic drift. It MUST NOT introduce a general graph-index
  abstraction unless more than this one execution path requires it.

### Semantic equivalence

- Incremental output MUST remain equivalent to `buildAtlasSnapshot()` for the
  same lifecycle state after stable comparison of nodes, edges, diagnostics,
  `hiddenNodeCount` and `hiddenEdgeCount`.
- Explicit `person_id` remains authoritative. Duplicate IDs MUST stay
  ambiguous and separate; no first-match resolution or silent merge is
  allowed.
- Inferred contact-edge identities, rich relationship metadata, unresolved
  references, ghost cleanup and filtered-endpoint diagnostics MUST retain
  their current semantics.
- Existing standalone and Bases callers MUST continue to consume the same
  pure delta function without vault access moving into `src/graph/`.

### Performance gate

- On the calibrated P6a Windows machine, the final 5,000-node/40,000-edge
  stress aggregate incremental recomputation MUST meet both:
  - median at or below `750 ms`;
  - nearest-rank p95 at or below `1,000 ms`.
- The final evidence MUST report direct graph-delta, projection, layout and
  aggregate samples and summaries, plus the pre-change trigger ratio.
- The gate is a manual ticket-closure gate. It MUST NOT be added to default
  tests or CI until a later Linux calibration is explicitly ratified.
- Correctness gates remain mandatory even when the timing gate passes.

## Scenarios

### Scenario: the source hypothesis is confirmed

Given the unchanged P6a stress fixture and current graph-delta implementation,
when the pre-change P6b substage characterization runs, then the direct
graph-delta median is at least 80% of the aggregate incremental median and the
executor may apply the bounded lookup-map optimization.

### Scenario: the source hypothesis is falsified

Given the same characterization, when the direct graph-delta median is below
80% of the aggregate median, then no production optimization is made, the
measured result is retained, and P6b returns to shaping.

### Scenario: optimized output remains canonical

Given a person or relationship delta covering existing duplicate-ID,
filtered-contact, inferred-edge and large deterministic relationship
scenarios, when the optimized delta is applied, then its semantic graph equals
a full rebuild and stable unaffected identities remain intact.

### Scenario: timing improves but remains insufficient

Given an optimized implementation that is semantically correct, when either
the 5,000-node stress median exceeds 750 ms or p95 exceeds 1,000 ms, then P6b
does not close and no Worker or persistent cache is inferred as the next fix.

## Acceptance Criteria

- Direct pre-change substage evidence proves or falsifies the 80% trigger.
- If triggered, the implementation uses only per-call lookup maps and
  preserves the current public graph contract.
- Differential correctness coverage passes for every existing repaired
  graph-delta regression and the deterministic performance scenario.
- Final calibrated stress median and p95 meet `750/1,000 ms`.
- `npm run test`, `npm run build` and `git diff --check` pass.
- An independent reviewer returns `pass`, or any residual risk is explicitly
  accepted before closure.

## Explicit Exclusions

- Web Workers or transferable graph protocols.
- Persistent or shared graph caches.
- Image decoding or image caches.
- New runtime dependencies.
- Public API or `AtlasSnapshot` changes.
- Default-suite or CI performance thresholds.
- Linux, live Obsidian desktop, Bases, pop-out or Mobile performance claims.
