Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: `.10x/tickets/2026-10-03-audit-remediation.md`

# Reuse contact reference indexes

## Scope

Avoid rebuilding the entire person/relationship reference index for every
contact-moment reference within one snapshot. Preserve resolution semantics.

## Non-goals

No worker, alternate graph store, renderer redesign, dependency changes or
long-lived cache without demonstrated need.

## Acceptance criteria

- Reference indexes are shared for a snapshot/resolution pass; hundreds of
  references do not cause hundreds of identical index constructions.
- Duplicate, unresolved, ambiguous, lifecycle invalidation and delta/full
  equivalence remain unchanged and covered by regression tests.
- Performance characterization contains realistic contact-history data.
- Record before/after characterization with the same synthetic workload,
  warmup and repeated samples; do not label Node timing native Obsidian latency.

## References

- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-reference-resolution.md`
- `.10x/specs/performance-characterization.md`
- `.10x/knowledge/generated-invariant-testing.md`

## Assumptions

Record-backed: earlier audit found 1000 constructions for 1000 moments and a
local 1598.4ms median. User-ratified: reuse index before adding complexity.

## Journal

- 2026-10-03: Opened after approved audit.
- 2026-10-03: Read all four governing references. The hot path reconstructs
  person and relationship reference maps inside every reference resolution.
  Plan: lazy indexes shared only within each snapshot/selected-path pass;
  preserve separate fresh contexts before and after mutations.
- 2026-10-03: Added deterministic person-only and linked-history fixtures,
  construction-count/lifecycle regressions, and a standalone esbuild-backed
  characterization command. It uses the existing five warmups/twenty samples,
  validates every snapshot, and records hashes, raw timing and environment.
- 2026-10-03 RED: Independent Node assert/esbuild harness on unchanged source
  failed `36 !== 1` person-index constructions for 12 linked moments (six
  relationship-index constructions). Standard Vitest was initially blocked
  by the machine's native runtime, so no passing test claim was made then.
- 2026-10-03 GREEN: Shared lazy reference indexes only inside snapshot,
  selected-contact and selected-diagnostic passes. Single-moment mutation
  resolution still defaults to its own fresh context before/after writes.
  Independent harness now observes one person and one relationship index per
  API and passes 30 fresh-rebuild lifecycle comparisons.
- 2026-10-03: Native Vitest became usable on a fresh invocation without WASI
  or security changes. Focused command selecting `contact-snapshot-indexing`,
  `contact-history-fixture`, `index-state`, generated contact-moment invariants,
  `graph-delta`, generated graph-delta invariants passed 6 files / 160 tests.
- 2026-10-03: Before/after characterization completed with the same fixture
  hash, five warmups and twenty samples. All four resolved snapshot hashes
  match. 1000-person linked-history median changed 6336.868 to 6.285ms; local
  Node compute only, with shared-machine load and raw variance disclosed.

## Blockers

None for this scope. Independent review and the parent-owned full test/build
gates passed on 2026-10-03. Timing remains local Node characterization.

## Evidence

- Bounded constructions: `test/contact-snapshot-indexing.test.ts` covers one
  person/relationship index in each of the three public pass APIs and lazy
  omission of unused indexes.
- Semantics/lifecycle: focused native Vitest 160/160, including existing
  duplicate/unresolved and generated delta/full invariant coverage; new
  regression covers fresh before/after mutation records, rename, remove,
  duplicate appearance/disappearance and clear.
- Realistic workload and before/after samples:
  `.10x/evidence/2026-10-03-contact-history-characterization.md`, with raw
  linked JSON and exact snapshot hashes.

## Review

2026-10-03 independent review by `ui_code_review`: **PASS**. Reviewed the four
governing references, complete product diff, new construction/lifecycle tests,
fixture/runner and recorded before/after data. Executor tests were not rerun.

- Findings: no critical, significant, minor or nit findings in this change.
  Each public resolution pass owns a new lazy context; shared lookup indexes
  cannot survive the synchronous pass. Person and relationship resolution still
  use the unchanged typed resolver and diagnostics. Contact-free passes do not
  build indexes. Mutation previous/next resolution uses separate default
  contexts on either side of the state change.
- Coverage review: bounded construction assertions cover all three affected
  public APIs; fresh-state comparisons and explicit diagnostic/actionability
  assertions cover duplicate appearance/removal, unresolved references, rename,
  delete, clear and before/after contact mutation. Existing generated invariant
  suites add broader delta/full equivalence evidence.
- Measurement review: independently inspected the two stored JSON files. Their
  fixture hashes, five warmups and twenty recorded samples match; all four
  resolved snapshot hashes match and every case retains twenty samples on each
  side. The runner times only `getSnapshot()` after population and verifies
  counts, diagnostics, actionability and stable output outside the timed region.
  The deterministic linked-history fixture includes two participants, optional
  relationship links, follow-ups and ID/path/wikilink references.
- Residual boundary: the reported timing is local Node computation with shared
  machine variance, not native Obsidian, mobile or complete UI latency. No timing
  budget, persistent cache or worker claim is introduced. Full repository gates
  remain parent-owned; this review does not close the ticket.

## Retrospective

Per-pass reuse is sufficient: the regression came from rebuilding immutable
lookup maps inside every reference lookup, not from a need for a worker or
persistent cache. Laziness avoids new work for contact-free/person-only
passes. Keep measurement outside timing-based CI gates and preserve complete
snapshot equivalence instead of inferring correctness from a speedup.
