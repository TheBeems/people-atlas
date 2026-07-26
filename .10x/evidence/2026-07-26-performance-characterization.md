Status: recorded
Created: 2026-07-26
Updated: 2026-07-26

# P6a performance characterization — 2026-07-26

## Observation

The largest calibrated stress case attributes the dominant recorded median to
`incremental-recomputation` in src/graph graph/projection/layout pipeline:
2428.569 ms median and
2564.362 ms p95. This attribution is
limited to the 5,000-node/40,000-edge fixture on this machine.

Before that architecture recommendation, the machine-readable recommendation
records this complete `stress` `incremental-recomputation` scaling
trend: 100 nodes: 1.170 ms median / 1.329 ms p95; 1,000 nodes: 88.692 ms median / 122.816 ms p95; 5,000 nodes: 2428.569 ms median / 2564.362 ms p95. Consecutive growth is 100→1,000: 75.789× median; 1,000→5,000: 27.382× median. At the
largest case, separately measured free-network projection and deterministic
layout medians are
15.070
ms and
2.735
ms, so graph-delta application is the leading hypothesis inside the aggregate
incremental stage; exact substage attribution still requires the proposed
split.

Only after that scaling evidence, the report recommends:
Shape a bounded P6b ticket to split graph-delta, projection and layout timings, then simplify the main-thread graph-delta lookup path if the split confirms it; do not add a Worker before that evidence.
A Worker is not recommended from this aggregate evidence. No image-cache
conclusion is available because the fixtures decode and paint no photos.

## Procedure

- Command: `npm run perf:characterize`.
- Node: five untimed warm-ups and twenty recorded samples per size/profile.
- Chromium: three untimed warm-ups and ten recorded setup/update samples per
  size/profile, plus 30 settled interaction frames.
- Fixtures: deterministic `p6a-ring-lattice-v1` ring lattices
  at 100, 1,000 and 5,000 nodes; sparse uses `2N` relationships and stress
  uses `8N`.
- Incremental scenario: the middle person and its offset-1 relationship are
  changed without changing stable IDs or counts; incremental output is checked
  against a complete rebuild before sampling.
- Timing source: the owning runtime's monotonic `performance.now()`.
- Raw samples and all environment fields: `.10x/evidence/.storage/2026-07-26-performance-characterization.json`.

## Source and environment provenance

- Classification: `calibrated-windows`.
- UTC timestamp: `2026-07-26T15:39:27.812Z`.
- Git HEAD: `3cc7e96a5a90d93f4a075dc6039dd49551bab774`.
- Worktree dirty: `true`.
- Diff hash: `sha256:a0ea6f0aed826fefe4cc83cdf2cd443d7cb302357fd70973b9134b26f89ad554`.
- Diff scope: git diff HEAD plus sorted untracked file paths/content; generated evidence output paths excluded.
- OS: win32 Windows 11 Pro
  (10.0.26200, arm64).
- CPU: Snapdragon(R) X 12-core X1E80100 @ 3.40 GHz; 12
  logical processors.
- System memory: 15980.969 MiB.
- Node/npm: v24.18.0 / 11.16.0.
- Vitest/Playwright: 4.1.10 /
  1.62.0.
- Chromium: HeadlessChrome/151.0.7922.34 revision
  @782af9cb30a53f54487e5d2e44738645a8ec457c; viewport
  414×896, DPR
  1.
- Runner: `p6a-characterization-v1`.

## Node timing summaries

| Profile | Nodes | Stage | Min ms | Median ms | P95 ms | Max ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| sparse | 100 | index-populate-and-snapshot | 1.374 | 1.499 | 1.813 | 3.353 |
| sparse | 100 | canonical-snapshot | 0.199 | 0.221 | 2.129 | 3.055 |
| sparse | 100 | free-network-projection | 0.056 | 0.060 | 0.074 | 0.086 |
| sparse | 100 | deterministic-layout | 0.024 | 0.027 | 0.031 | 0.031 |
| sparse | 100 | incremental-recomputation | 0.353 | 0.430 | 0.623 | 0.658 |
| stress | 100 | index-populate-and-snapshot | 7.053 | 7.888 | 12.090 | 13.243 |
| stress | 100 | canonical-snapshot | 0.447 | 0.520 | 0.775 | 0.827 |
| stress | 100 | free-network-projection | 0.142 | 0.156 | 0.175 | 0.179 |
| stress | 100 | deterministic-layout | 0.026 | 0.031 | 0.045 | 0.064 |
| stress | 100 | incremental-recomputation | 1.115 | 1.170 | 1.329 | 3.135 |
| sparse | 1000 | index-populate-and-snapshot | 14.533 | 16.768 | 18.121 | 19.089 |
| sparse | 1000 | canonical-snapshot | 1.685 | 1.808 | 4.987 | 5.448 |
| sparse | 1000 | free-network-projection | 0.525 | 0.554 | 0.662 | 0.909 |
| sparse | 1000 | deterministic-layout | 0.213 | 0.223 | 0.259 | 1.086 |
| sparse | 1000 | incremental-recomputation | 12.758 | 19.011 | 24.797 | 26.141 |
| stress | 1000 | index-populate-and-snapshot | 82.762 | 133.906 | 196.911 | 207.370 |
| stress | 1000 | canonical-snapshot | 3.827 | 7.534 | 10.952 | 11.323 |
| stress | 1000 | free-network-projection | 1.379 | 2.520 | 4.840 | 6.478 |
| stress | 1000 | deterministic-layout | 0.220 | 0.445 | 0.647 | 2.875 |
| stress | 1000 | incremental-recomputation | 50.185 | 88.692 | 122.816 | 126.640 |
| sparse | 5000 | index-populate-and-snapshot | 149.416 | 173.448 | 201.141 | 213.541 |
| sparse | 5000 | canonical-snapshot | 20.477 | 22.361 | 37.957 | 55.551 |
| sparse | 5000 | free-network-projection | 4.734 | 5.595 | 10.724 | 12.697 |
| sparse | 5000 | deterministic-layout | 2.291 | 2.686 | 3.675 | 4.606 |
| sparse | 5000 | incremental-recomputation | 561.868 | 612.023 | 687.823 | 755.246 |
| stress | 5000 | index-populate-and-snapshot | 879.159 | 933.974 | 989.469 | 1068.962 |
| stress | 5000 | canonical-snapshot | 49.115 | 54.308 | 73.831 | 86.719 |
| stress | 5000 | free-network-projection | 13.037 | 15.070 | 20.937 | 21.517 |
| stress | 5000 | deterministic-layout | 2.210 | 2.735 | 3.744 | 4.287 |
| stress | 5000 | incremental-recomputation | 2239.516 | 2428.569 | 2564.362 | 2680.068 |

## Chromium timing summaries

| Profile | Nodes | Stage | Min ms | Median ms | P95 ms | Max ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| sparse | 100 | snapshot-and-semantic-dom | 0.800 | 1.450 | 4.700 | 4.700 |
| sparse | 100 | canvas-first-paint | 1.100 | 2.600 | 5.200 | 5.200 |
| sparse | 100 | list-mode-transition | 0.200 | 0.300 | 0.500 | 0.500 |
| sparse | 100 | graph-mode-transition | 0.200 | 0.450 | 0.600 | 0.600 |
| sparse | 100 | incremental-replacement | 0.900 | 1.850 | 4.100 | 4.100 |
| sparse | 100 | incremental-canvas-paint | 0.700 | 1.150 | 4.900 | 4.900 |
| sparse | 100 | lifecycle-cleanup | 0.100 | 0.300 | 0.600 | 0.600 |
| sparse | 100 | interaction-frame | 0.800 | 1.100 | 3.500 | 3.900 |
| stress | 100 | snapshot-and-semantic-dom | 1.600 | 2.950 | 3.500 | 3.500 |
| stress | 100 | canvas-first-paint | 4.500 | 6.000 | 8.500 | 8.500 |
| stress | 100 | list-mode-transition | 0.200 | 0.300 | 3.300 | 3.300 |
| stress | 100 | graph-mode-transition | 0.400 | 0.550 | 1.400 | 1.400 |
| stress | 100 | incremental-replacement | 1.900 | 2.400 | 3.300 | 3.300 |
| stress | 100 | incremental-canvas-paint | 2.200 | 3.550 | 5.100 | 5.100 |
| stress | 100 | lifecycle-cleanup | 0.200 | 0.300 | 0.800 | 0.800 |
| stress | 100 | interaction-frame | 1.600 | 2.100 | 3.800 | 4.100 |
| sparse | 1000 | snapshot-and-semantic-dom | 9.200 | 23.300 | 35.300 | 35.300 |
| sparse | 1000 | canvas-first-paint | 18.700 | 25.850 | 41.700 | 41.700 |
| sparse | 1000 | list-mode-transition | 0.200 | 0.300 | 0.600 | 0.600 |
| sparse | 1000 | graph-mode-transition | 0.300 | 0.400 | 1.100 | 1.100 |
| sparse | 1000 | incremental-replacement | 9.500 | 11.400 | 15.500 | 15.500 |
| sparse | 1000 | incremental-canvas-paint | 9.000 | 11.050 | 16.700 | 16.700 |
| sparse | 1000 | lifecycle-cleanup | 0.500 | 0.600 | 0.900 | 0.900 |
| sparse | 1000 | interaction-frame | 9.200 | 12.050 | 16.200 | 23.200 |
| stress | 1000 | snapshot-and-semantic-dom | 9.000 | 11.150 | 27.900 | 27.900 |
| stress | 1000 | canvas-first-paint | 16.800 | 20.800 | 29.500 | 29.500 |
| stress | 1000 | list-mode-transition | 0.200 | 0.300 | 0.400 | 0.400 |
| stress | 1000 | graph-mode-transition | 0.300 | 0.400 | 0.600 | 0.600 |
| stress | 1000 | incremental-replacement | 9.300 | 10.450 | 11.200 | 11.200 |
| stress | 1000 | incremental-canvas-paint | 11.100 | 12.350 | 13.500 | 13.500 |
| stress | 1000 | lifecycle-cleanup | 0.500 | 0.600 | 0.700 | 0.700 |
| stress | 1000 | interaction-frame | 9.900 | 12.000 | 19.400 | 24.500 |
| sparse | 5000 | snapshot-and-semantic-dom | 39.600 | 63.000 | 86.700 | 86.700 |
| sparse | 5000 | canvas-first-paint | 73.400 | 82.900 | 91.600 | 91.600 |
| sparse | 5000 | list-mode-transition | 0.600 | 0.650 | 9.000 | 9.000 |
| sparse | 5000 | graph-mode-transition | 0.400 | 0.500 | 0.800 | 0.800 |
| sparse | 5000 | incremental-replacement | 44.700 | 48.600 | 77.800 | 77.800 |
| sparse | 5000 | incremental-canvas-paint | 43.500 | 52.350 | 57.700 | 57.700 |
| sparse | 5000 | lifecycle-cleanup | 1.800 | 2.200 | 2.800 | 2.800 |
| sparse | 5000 | interaction-frame | 45.100 | 52.300 | 71.500 | 71.600 |
| stress | 5000 | snapshot-and-semantic-dom | 43.300 | 63.300 | 84.000 | 84.000 |
| stress | 5000 | canvas-first-paint | 77.300 | 94.550 | 118.100 | 118.100 |
| stress | 5000 | list-mode-transition | 0.500 | 0.700 | 0.800 | 0.800 |
| stress | 5000 | graph-mode-transition | 0.400 | 0.600 | 1.600 | 1.600 |
| stress | 5000 | incremental-replacement | 41.900 | 50.550 | 68.100 | 68.100 |
| stress | 5000 | incremental-canvas-paint | 51.600 | 59.000 | 65.600 | 65.600 |
| stress | 5000 | lifecycle-cleanup | 1.700 | 2.100 | 3.500 | 3.500 |
| stress | 5000 | interaction-frame | 55.300 | 62.900 | 74.500 | 93.200 |

Every interaction run generated 60 zoom redraw triggers. The renderer requested
and executed 30 animation frames per case, so 30 triggers were coalesced before
the owning-window callback.

## Heap observations

| Surface | Profile | Nodes | Stage | Heap used MiB | Heap total MiB | GC label |
| --- | --- | ---: | --- | ---: | ---: | --- |
| Node | sparse | 100 | before-fixture | 10.815 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-fixture | 11.066 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-index-populate-and-snapshot | 13.078 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-canonical-snapshot | 13.471 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-free-network-projection | 13.497 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-deterministic-layout | 13.514 | 28.355 | retained-heap-observation |
| Node | sparse | 100 | after-incremental-recomputation | 13.787 | 28.355 | retained-heap-observation |
| Node | stress | 100 | before-fixture | 17.510 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-fixture | 18.670 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-index-populate-and-snapshot | 26.669 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-canonical-snapshot | 27.382 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-free-network-projection | 27.427 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-deterministic-layout | 27.444 | 45.852 | retained-heap-observation |
| Node | stress | 100 | after-incremental-recomputation | 27.985 | 45.852 | retained-heap-observation |
| Node | sparse | 1000 | before-fixture | 46.710 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-fixture | 48.898 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-index-populate-and-snapshot | 37.950 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-canonical-snapshot | 40.522 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-free-network-projection | 40.779 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-deterministic-layout | 40.919 | 82.855 | retained-heap-observation |
| Node | sparse | 1000 | after-incremental-recomputation | 43.256 | 82.855 | retained-heap-observation |
| Node | stress | 1000 | before-fixture | 124.836 | 217.020 | retained-heap-observation |
| Node | stress | 1000 | after-fixture | 132.247 | 217.020 | retained-heap-observation |
| Node | stress | 1000 | after-index-populate-and-snapshot | 106.622 | 226.016 | retained-heap-observation |
| Node | stress | 1000 | after-canonical-snapshot | 112.538 | 226.461 | retained-heap-observation |
| Node | stress | 1000 | after-free-network-projection | 113.037 | 226.461 | retained-heap-observation |
| Node | stress | 1000 | after-deterministic-layout | 113.177 | 226.461 | retained-heap-observation |
| Node | stress | 1000 | after-incremental-recomputation | 117.819 | 226.684 | retained-heap-observation |
| Node | sparse | 5000 | before-fixture | 152.482 | 273.328 | retained-heap-observation |
| Node | sparse | 5000 | after-fixture | 163.527 | 273.461 | retained-heap-observation |
| Node | sparse | 5000 | after-index-populate-and-snapshot | 211.360 | 282.895 | retained-heap-observation |
| Node | sparse | 5000 | after-canonical-snapshot | 170.625 | 291.281 | retained-heap-observation |
| Node | sparse | 5000 | after-free-network-projection | 171.991 | 291.441 | retained-heap-observation |
| Node | sparse | 5000 | after-deterministic-layout | 172.945 | 291.664 | retained-heap-observation |
| Node | sparse | 5000 | after-incremental-recomputation | 185.882 | 293.379 | retained-heap-observation |
| Node | stress | 5000 | before-fixture | 181.147 | 264.059 | retained-heap-observation |
| Node | stress | 5000 | after-fixture | 165.076 | 255.164 | retained-heap-observation |
| Node | stress | 5000 | after-index-populate-and-snapshot | 208.338 | 308.707 | retained-heap-observation |
| Node | stress | 5000 | after-canonical-snapshot | 242.080 | 317.848 | retained-heap-observation |
| Node | stress | 5000 | after-free-network-projection | 244.565 | 319.145 | retained-heap-observation |
| Node | stress | 5000 | after-deterministic-layout | 245.478 | 319.367 | retained-heap-observation |
| Node | stress | 5000 | after-incremental-recomputation | 206.949 | 317.180 | retained-heap-observation |
| Chromium | sparse | 100 | before-renderer | 9.216 | 10.117 | collected-heap |
| Chromium | sparse | 100 | after-initial-render | 9.243 | 10.117 | collected-heap |
| Chromium | sparse | 100 | after-incremental-replacement | 9.270 | 10.117 | collected-heap |
| Chromium | sparse | 100 | after-destroy | 9.270 | 10.117 | collected-heap |
| Chromium | stress | 100 | before-renderer | 9.519 | 10.367 | collected-heap |
| Chromium | stress | 100 | after-initial-render | 9.539 | 10.367 | collected-heap |
| Chromium | stress | 100 | after-incremental-replacement | 9.532 | 10.367 | collected-heap |
| Chromium | stress | 100 | after-destroy | 9.532 | 10.367 | collected-heap |
| Chromium | sparse | 1000 | before-renderer | 10.356 | 11.117 | collected-heap |
| Chromium | sparse | 1000 | after-initial-render | 10.417 | 11.367 | collected-heap |
| Chromium | sparse | 1000 | after-incremental-replacement | 10.434 | 11.367 | collected-heap |
| Chromium | sparse | 1000 | after-destroy | 10.434 | 11.367 | collected-heap |
| Chromium | stress | 1000 | before-renderer | 13.005 | 13.867 | collected-heap |
| Chromium | stress | 1000 | after-initial-render | 13.066 | 13.867 | collected-heap |
| Chromium | stress | 1000 | after-incremental-replacement | 13.100 | 13.867 | collected-heap |
| Chromium | stress | 1000 | after-destroy | 13.100 | 13.867 | collected-heap |
| Chromium | sparse | 5000 | before-renderer | 15.208 | 15.867 | collected-heap |
| Chromium | sparse | 5000 | after-initial-render | 15.533 | 16.367 | collected-heap |
| Chromium | sparse | 5000 | after-incremental-replacement | 15.565 | 16.367 | collected-heap |
| Chromium | sparse | 5000 | after-destroy | 15.565 | 16.367 | collected-heap |
| Chromium | stress | 5000 | before-renderer | 28.349 | 29.078 | collected-heap |
| Chromium | stress | 5000 | after-initial-render | 28.674 | 29.328 | collected-heap |
| Chromium | stress | 5000 | after-incremental-replacement | 28.706 | 29.578 | collected-heap |
| Chromium | stress | 5000 | after-destroy | 28.707 | 29.328 | collected-heap |

These are stage-bounded retained-heap observations. Where explicit collection
was available, the table says `collected-heap`; they are not leak claims.

## Garbage-collection availability

- Node explicit GC was unavailable in the Vitest worker; Node heap rows are retained-heap observations, not collected-footprint or leak evidence.
- Chromium explicit GC was available for all 24 heap observations.

## Missing data

- None. No required timing or provenance value is missing.

## Candidate budgets for user ratification

These values are proposals only. They are not accepted budgets and no test,
build, check or CI threshold enforces them. The mechanical proposal uses the
calibrated 5,000-node stress p95 (or retained-heap growth), adds 25% headroom
and rounds upward:

| Candidate | Proposed ceiling |
| --- | ---: |
| Index population plus raw snapshot | 1250 ms |
| Incremental graph/projection/layout recomputation | 3225 ms |
| Initial semantic DOM plus canvas paint | 300 ms |
| Settled interaction frame | 94 ms |
| Retained-heap growth | 48 MiB |

## What this supports or challenges

- Supports attributing the observed dominant cost to the named owning layer on
  this calibrated machine.
- Supports considering no change or a bounded main-thread simplification
  before a Worker.
- Challenges treating P6's Worker or image cache as an already-justified
  implementation step.
- Proposes the next bounded shaping step and candidate budgets; it does not
  ratify either.

## Limits

- Absolute timings and heap values do not generalize across hardware.
- A Linux/Node 22 run is supported and must be labelled
  `informative-ci`; no Linux run was performed by this Windows evidence run.
- Headless Chromium is not live Obsidian, Bases, a pop-out window, assistive
  technology or Obsidian Mobile. Those remain P7/manual evidence.
- The Node incremental stage is aggregate graph-delta, projection and layout
  time; it does not by itself authorize a Worker or identify a transferable
  protocol.
- No photo is decoded or painted, so image-cache behavior is outside this
  evidence.
