Status: recorded
Created: 2026-10-03
Updated: 2026-10-03

# Contact-history snapshot characterization

## Observation

`IndexState` rebuilt the complete person reference index for each participant
and relationship endpoint, and the relationship index for each linked moment.
In the 12-moment linked fixture, one snapshot constructed 36 person indexes
and six relationship indexes. Sharing lazy indexes within one resolution pass
reduces this to one of each for snapshot, selected moments and diagnostics.

## Procedure

Run the same command before and after the product-source change:

```text
npm run perf:contact-history -- .10x/evidence/.storage/2026-10-03-contact-history-before.json
npm run perf:contact-history -- .10x/evidence/.storage/2026-10-03-contact-history-after.json
```

The runner bundles the actual `IndexState` and fixture in memory with esbuild.
It measures `getSnapshot()` after fixture population, with five warmups and
twenty recorded samples per case. Every sample checks exact entity counts,
absence of unexpected diagnostics and actionable moments; snapshot hashes
must remain equal across all samples. JSON records retain all samples,
summaries, source/bundle/fixture hashes, Node/OS/CPU details and heap limits.

The person-only fixture contains N people and N moments sharing one canonical
person. Linked-history contains N people, N relationships and N moments with
two participants each; half link a relationship and one third have follow-up.
ID, path and resolved-wikilink references occur deterministically.

## Results

All four before/after snapshot SHA-256 pairs match exactly. The fixture hash,
warmup count and sample count also match.

| People / moments | Profile | Before median / p95 (ms) | After median / p95 (ms) |
| --- | --- | --- | --- |
| 100 / 100 | Person only | 43.927 / 113.263 | 0.163 / 0.463 |
| 100 / 100 | Linked history | 134.752 / 274.358 | 0.646 / 1.288 |
| 1000 / 1000 | Person only | 2058.818 / 3508.668 | 1.594 / 3.489 |
| 1000 / 1000 | Linked history | 6336.868 / 7800.921 | 6.285 / 17.010 |

Native Vitest verification after the change: six test files, 160 tests passed
(`contact-snapshot-indexing`, `contact-history-fixture`, `index-state`,
generated contact-moment invariants, `graph-delta`, generated graph-delta
invariants). The focused construction assertions cover all three pass APIs.
A separate Node assert/esbuild harness first failed on 36 versus one person
index, then passed with one person/one relationship index per API and 30
fresh-rebuild comparisons across lifecycle transitions.

## Supported conclusion and limits

Per-reference reconstruction dominated the observed contact snapshot work.
Per-call reuse removes it without a long-lived cache, changed identity rules,
workers or persistence. Before/after mutation resolutions still create fresh
contexts, and no context is shared across separate public operations.

These are local Node computation observations, not native Obsidian, rendering,
end-to-end input latency or mobile results. Shared-machine load was not held
constant; absolute timing and the apparent speedup are not universal budgets.
Raw variance is preserved, no samples were discarded, and no timing threshold
was added. Population is outside the timed stage. Heap figures are observations
without forced garbage collection and do not establish a leak.

## References

- `.10x/tickets/2026-10-03-contact-snapshot-performance.md`
- `.10x/evidence/.storage/2026-10-03-contact-history-before.json`
- `.10x/evidence/.storage/2026-10-03-contact-history-after.json`
- `scripts/contact-history-characterize.mjs`
- `test/performance/contact-history-fixture.ts`
- `test/contact-snapshot-indexing.test.ts`
