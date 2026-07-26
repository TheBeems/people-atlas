Status: recorded
Created: 2026-07-26
Updated: 2026-07-26

# P6b incremental graph-delta baseline — 2026-07-26

## Observation

The direct graph-delta median is 2080.775 ms
and the aggregate incremental median is 2100.065 ms.
Their ratio is `0.990815` against the ratified `0.80`
trigger. Product-source optimization is therefore
`authorized` under P6b.

The pre-change trigger uses direct graph-delta median divided by aggregate
incremental median: `2080.775 /
2100.065 = 0.990815`.

## Procedure

- Command: `npm run perf:graph-delta -- baseline`.
- Fixture: unchanged deterministic `p6a-ring-lattice-v1`
  ring-lattice cases at 100, 1,000 and 5,000 nodes; sparse uses `2N`
  relationships and stress uses `8N`.
- Sampling: five untimed warm-ups and twenty recorded samples per case.
- Each sample times `applyGraphDelta()`, incremental free-network projection
  and incremental deterministic layout directly, while one outer monotonic
  timer retains aggregate incremental recomputation.
- Before sampling, stable identities and counts are checked and incremental
  output is compared with a complete deterministic rebuild.
- Raw samples and provenance: `.10x/evidence/.storage/2026-07-26-incremental-graph-delta-baseline.json`.


## Source and environment provenance

- Classification: `calibrated-windows`.
- UTC timestamp: `2026-07-26T16:46:25.939Z`.
- Git HEAD: `2fb576c862d75f4de489da1f579427336a5709e8`.
- Worktree dirty: `true`.
- Diff hash: `sha256:d7f4def35f6deff1c58407e337f15d2525e81c11e19af2a76009c57071fd14c8`.
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
| sparse | 100 | graph-delta | 0.262 | 0.396 | 0.501 | 0.971 |
| sparse | 100 | incremental-projection | 0.060 | 0.069 | 0.084 | 0.118 |
| sparse | 100 | incremental-layout | 0.025 | 0.029 | 0.034 | 0.087 |
| sparse | 100 | incremental-recomputation | 0.348 | 0.501 | 0.599 | 1.084 |
| stress | 100 | graph-delta | 0.932 | 0.942 | 1.492 | 1.663 |
| stress | 100 | incremental-projection | 0.158 | 0.166 | 0.260 | 0.429 |
| stress | 100 | incremental-layout | 0.025 | 0.026 | 0.038 | 0.054 |
| stress | 100 | incremental-recomputation | 1.116 | 1.155 | 1.791 | 2.149 |
| sparse | 1000 | graph-delta | 11.452 | 18.753 | 22.258 | 23.894 |
| sparse | 1000 | incremental-projection | 0.558 | 0.625 | 2.595 | 2.930 |
| sparse | 1000 | incremental-layout | 0.214 | 0.230 | 0.625 | 0.656 |
| sparse | 1000 | incremental-recomputation | 12.245 | 20.291 | 23.136 | 24.795 |
| stress | 1000 | graph-delta | 44.674 | 46.385 | 49.182 | 50.440 |
| stress | 1000 | incremental-projection | 1.583 | 1.722 | 3.011 | 3.321 |
| stress | 1000 | incremental-layout | 0.216 | 0.225 | 0.360 | 0.369 |
| stress | 1000 | incremental-recomputation | 46.843 | 48.817 | 51.834 | 52.890 |
| sparse | 5000 | graph-delta | 375.152 | 448.971 | 528.355 | 555.764 |
| sparse | 5000 | incremental-projection | 3.261 | 5.413 | 8.546 | 10.051 |
| sparse | 5000 | incremental-layout | 1.304 | 2.430 | 2.707 | 3.445 |
| sparse | 5000 | incremental-recomputation | 382.919 | 455.295 | 535.897 | 565.835 |
| stress | 5000 | graph-delta | 1875.346 | 2080.775 | 2126.622 | 2129.632 |
| stress | 5000 | incremental-projection | 10.320 | 14.342 | 17.596 | 21.413 |
| stress | 5000 | incremental-layout | 1.418 | 2.115 | 3.651 | 5.296 |
| stress | 5000 | incremental-recomputation | 1889.685 | 2100.065 | 2144.681 | 2145.091 |

## Pre-change implementation trigger

| Graph-delta median | Aggregate median | Ratio | Required | Disposition |
| ---: | ---: | ---: | ---: | --- |
| 2080.775 ms | 2100.065 ms | 0.990815 | 0.80 | per-call maps authorized |

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
