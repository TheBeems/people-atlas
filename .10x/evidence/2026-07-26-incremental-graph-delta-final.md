Status: recorded
Created: 2026-07-26
Updated: 2026-07-26

# P6b incremental graph-delta final — 2026-07-26

## Observation

The final 5,000-node/40,000-edge stress aggregate measures
30.231 ms median and
41.898 ms nearest-rank p95. The ratified
`750/1000 ms` gate is
`passed`.

The pre-change trigger uses direct graph-delta median divided by aggregate
incremental median: `2080.775 /
2100.065 = 0.990815`.

## Procedure

- Command: `npm run perf:graph-delta -- final`.
- Fixture: unchanged deterministic `p6a-ring-lattice-v1`
  ring-lattice cases at 100, 1,000 and 5,000 nodes; sparse uses `2N`
  relationships and stress uses `8N`.
- Sampling: five untimed warm-ups and twenty recorded samples per case.
- Each sample times `applyGraphDelta()`, incremental free-network projection
  and incremental deterministic layout directly, while one outer monotonic
  timer retains aggregate incremental recomputation.
- Before sampling, stable identities and counts are checked and incremental
  output is compared with a complete deterministic rebuild.
- Raw samples and provenance: `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-final.json`.
- Pre-change raw evidence: `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-baseline.json`.

## Source and environment provenance

- Classification: `calibrated-windows`.
- UTC timestamp: `2026-07-26T16:51:30.025Z`.
- Git HEAD: `2fb576c862d75f4de489da1f579427336a5709e8`.
- Worktree dirty: `true`.
- Diff hash: `sha256:c6d4731da930bf52bec876b50dbeaa745145c76841f47bae25f7b34fd37c5709`.
- Diff scope: git diff HEAD plus sorted untracked file paths/content; current generated evidence paths excluded.
- OS: win32 Windows 11 Pro
  (10.0.26200, arm64).
- CPU: Snapdragon(R) X 12-core X1E80100 @ 3.40 GHz; 12
  logical processors.
- System memory: 15980.969 MiB.
- Node/npm/Vitest: v24.18.0 /
  11.16.0 / 4.1.10.
- Runner: `p6b-graph-delta-v1`.

## Timing summaries

| Profile | Nodes | Stage | Min ms | Median ms | P95 ms | Max ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| sparse | 100 | graph-delta | 0.139 | 0.279 | 0.301 | 0.817 |
| sparse | 100 | incremental-projection | 0.068 | 0.075 | 0.095 | 0.124 |
| sparse | 100 | incremental-layout | 0.025 | 0.028 | 0.032 | 0.073 |
| sparse | 100 | incremental-recomputation | 0.234 | 0.383 | 0.488 | 0.925 |
| stress | 100 | graph-delta | 0.287 | 0.296 | 0.379 | 0.776 |
| stress | 100 | incremental-projection | 0.153 | 0.156 | 0.190 | 0.207 |
| stress | 100 | incremental-layout | 0.025 | 0.025 | 0.027 | 0.037 |
| stress | 100 | incremental-recomputation | 0.467 | 0.493 | 0.566 | 0.997 |
| sparse | 1000 | graph-delta | 1.301 | 1.393 | 1.746 | 2.228 |
| sparse | 1000 | incremental-projection | 0.533 | 0.585 | 2.207 | 2.425 |
| sparse | 1000 | incremental-layout | 0.217 | 0.222 | 0.262 | 0.301 |
| sparse | 1000 | incremental-recomputation | 2.054 | 2.311 | 3.837 | 3.973 |
| stress | 1000 | graph-delta | 2.327 | 2.446 | 4.158 | 4.416 |
| stress | 1000 | incremental-projection | 1.390 | 1.416 | 1.703 | 2.050 |
| stress | 1000 | incremental-layout | 0.212 | 0.218 | 0.274 | 0.275 |
| stress | 1000 | incremental-recomputation | 3.947 | 4.386 | 5.770 | 6.027 |
| sparse | 5000 | graph-delta | 8.263 | 9.162 | 12.812 | 15.721 |
| sparse | 5000 | incremental-projection | 2.723 | 2.912 | 3.942 | 4.813 |
| sparse | 5000 | incremental-layout | 1.310 | 1.354 | 1.897 | 1.952 |
| sparse | 5000 | incremental-recomputation | 12.497 | 13.741 | 16.923 | 20.539 |
| stress | 5000 | graph-delta | 17.889 | 20.286 | 29.891 | 76.322 |
| stress | 5000 | incremental-projection | 7.249 | 8.309 | 10.511 | 15.420 |
| stress | 5000 | incremental-layout | 1.351 | 1.439 | 2.402 | 2.584 |
| stress | 5000 | incremental-recomputation | 27.130 | 30.231 | 41.898 | 88.863 |

## Pre-change implementation trigger

| Graph-delta median | Aggregate median | Ratio | Required | Disposition |
| ---: | ---: | ---: | ---: | --- |
| 2080.775 ms | 2100.065 ms | 0.990815 | 0.80 | per-call maps authorized |

## Final calibrated gate

| Metric | Observed | Ceiling | Result |
| --- | ---: | ---: | --- |
| Aggregate median | 30.231 ms | 750 ms | pass |
| Aggregate nearest-rank p95 | 41.898 ms | 1000 ms | pass |

This is a manual ticket-closure gate, not a default-test or CI threshold.

## What this supports

- Direct substage attribution for the unchanged calibrated deterministic
  workload on this machine.
- The conditional P6b lookup-map change only when the persisted baseline ratio
  meets the ratified trigger.
- A final manual closure decision from the raw nearest-rank statistics.

## Limits

- Absolute timings do not generalize beyond this calibrated machine.
- This evidence does not authorize or evaluate a Worker, persistent cache,
  image cache, dependency, public API change or CI threshold.
- It does not prove Linux, live Obsidian desktop, Bases, pop-out or Mobile
  performance.
