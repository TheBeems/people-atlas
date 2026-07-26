Status: active
Created: 2026-07-27
Updated: 2026-07-27

# Generated invariant testing

## Purpose

Preserve the reusable design boundaries established by P7b for deterministic
generated coverage of canonical graph, incremental graph-delta and pure
index-state behavior.

## Deterministic corpus

- Generated tests use a repository-local seeded generator and fixed seeds.
  They do not use `Math.random()` or wall-clock input.
- Each seed guarantees the hard adversarial topology. Seeds vary identities,
  ordering and selected metadata; required duplicate, unresolved, filtered,
  parallel and lifecycle cases are not left to chance.
- Family, seed and lifecycle operation belong in failure context. Wrap the
  operation boundary itself so setup, transition and pre-assert failures remain
  replayable; context only on a final equality assertion is insufficient.
- The corpus is bounded default-suite contract coverage, not exhaustive
  fuzzing, shrinking or a performance workload.

## Three complementary proofs

1. Canonical snapshot invariants prove referential integrity, path-owned
   identity, fail-closed duplicate/unresolved behavior, rich relationship
   preservation and exact filtered accounting.
2. Graph-delta transitions compare every valid incremental result with a fresh
   canonical rebuild, excluding only `generatedAt` and unspecified collection
   order.
3. `IndexState` sequences compare public state with a test-owned model that
   recomputes indexes from a path-owned file map after every operation.

These proofs are complementary. Full-rebuild equivalence can hide an
insufficient fixture or an entity disappearing behind another invalid state,
so direct assertions remain necessary for exact canonical-path resolution,
forbidden edges, diagnostics and surviving path-owned parallel entities.

## Contract-complete deltas

- Generated deltas must include changed records and every explicitly dependent
  record required by the production `IndexDelta` contract.
- Duplicate relationship-ID appearance/disappearance affects every same-ID
  relationship path because edge IDs remap between explicit and path-derived
  forms.
- Person identity changes require incident relationships and current duplicate
  diagnostics where their resolution or edge identity can change.
- A failing test input caused by an incomplete delta is a generator defect,
  not product evidence. Record and correct the input without deleting the seed
  or weakening the invariant.

## Reference-model boundary

- The index reference model owns a simple path-to-file map and recomputes
  person IDs, relationship IDs, dependencies, assets and adjacency.
- It must not read production-private maps or reproduce their incremental
  update algorithm.
- Keep historical keys during a sequence so removal of stale ID, dependency,
  asset and adjacency entries is positively checked.
- Verify revision increments at every operation and monotonicity after
  `clear()`.

## Limits

- P7b is pure Node evidence. It does not certify the controlled Obsidian
  integration runtime, renderer/browser behavior, live Obsidian Desktop,
  Bases, pop-outs, assistive technology, Mobile or performance thresholds.
- Product defects exposed by a valid generated case require separate repair
  ownership; generated-test work does not implicitly authorize product-source
  changes.
