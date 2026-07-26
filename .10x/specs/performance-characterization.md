Status: active
Created: 2026-07-26
Updated: 2026-07-26

# P6a — Performance characterization and architecture decision input

## Context

P1 through P5 now provide a canonical incremental graph, deterministic
projection/layout state and an accessible mouse, keyboard and touch renderer.
The current implementation has no force simulation or community computation
to move to a Worker. It parses photo paths but does not decode or paint
images. It rebuilds deterministic positions and the full semantic people list
when a graph snapshot changes, then draws every visible node and edge in one
animation frame.

The P6 roadmap forbids speculative Worker complexity and requires profiling
before an optimization is selected. This contract therefore establishes a
repeatable characterization boundary. It produces evidence and a proposed
architecture decision; it does not itself define acceptable product latency,
add a regression threshold or authorize an optimization.

## Scope

This specification governs:

1. deterministic sparse and stress fixture families at 100, 1,000 and 5,000
   nodes;
2. separate Node and headless-Chromium measurement paths for index, graph,
   projection, layout, renderer and interaction stages;
3. one stable person-plus-relationship incremental update at every fixture
   size;
4. timing, memory, environment and source-provenance reporting;
5. durable evidence and a smallest-next-step architecture recommendation;
6. the boundary between the calibrated Windows reference result, informative
   `ubuntu-latest` results and later live Obsidian validation.

## Normative contract

### Characterization, not a performance gate

- P6a MUST report observed values without classifying the plugin as fast,
  slow, passing or failing against an invented threshold.
- P6a MUST NOT add a timing or memory threshold to `npm run test`,
  `npm run build`, `npm run check` or the existing required CI check.
- Measurements MUST run through a dedicated command so ordinary correctness
  tests remain deterministic and fast.
- A measurement failure caused by an invalid fixture, missing required
  runtime seam or malformed result MUST fail the dedicated command.
- Ordinary runtime variance MUST be preserved in the raw samples and summary;
  the runner MUST NOT discard a valid slow sample merely to improve the
  result.
- Absolute budgets and any resulting regression gate require a later
  user-ratified decision after P6a evidence exists.

### Deterministic fixture families

For every `N` in `100`, `1_000` and `5_000`:

- The fixture MUST contain exactly `N` people with unique, stable person IDs
  and paths derived from their zero-padded ordinal. Display labels MUST NOT
  identify records.
- The graph MUST use a deterministic undirected ring-lattice topology.
- The sparse fixture MUST connect each person to offsets `1` and `2`, yielding
  exactly `2N` explicit relationships and average degree `4`.
- The stress fixture MUST connect each person to offsets `1` through `8`,
  yielding exactly `8N` explicit relationships and average degree `16`.
- Every relationship MUST have a unique stable relationship ID and valid
  stable-ID endpoint references. Generated fixtures MUST contain no ambiguous
  identity, unresolved endpoint or random diagnostic noise; P6a isolates
  scale from domain-error semantics.
- Fixture generation MUST use no random source, locale-dependent ordering or
  wall-clock value. Equal size/profile inputs MUST produce structurally equal
  records and `AtlasSnapshot` values on Windows and Linux.
- Exact person, relationship, node and edge counts MUST be asserted before a
  sample is accepted.

The incremental scenario MUST update one middle-ordinal person and one of its
existing relationships without changing either stable identity or total
node/edge count. It MUST use the same deterministic change on every run and
MUST verify that incremental output remains equivalent to a full rebuild
under the existing graph contracts.

### Measured stages

The Node path MUST measure these stages separately:

1. populate a fresh `IndexState` with the fixture records and read its raw
   snapshot;
2. build the canonical `AtlasSnapshot`;
3. project the complete snapshot through `free-network`;
4. create deterministic positions with `createDeterministicLayout()`;
5. apply the person-plus-relationship incremental update, including graph
   delta application and projection/layout recomputation.

The headless-Chromium path MUST measure these stages separately:

1. construct an `AtlasRenderer` and record `setGraph()` synchronous duration
   as `snapshot-and-semantic-dom`, because that call currently rebuilds the
   complete semantic people list;
2. settle the owning-window animation frame requested by `setGraph()` and
   record its canvas callback duration separately as `canvas-first-paint`;
3. activate List mode and then Graph mode on the same renderer, recording each
   synchronous mode transition separately without counting either as a graph
   rebuild;
4. settle a bounded series of 30 pan/zoom redraws and report per-frame
   duration and request coalescing;
5. replace the graph with the deterministic incremental result and settle the
   resulting semantic and canvas work;
6. destroy the renderer and verify that the lifecycle cleanup established by
   P5 remains intact.

The runner MUST report at least median, p95, minimum and maximum elapsed time
for every supported stage/profile/size. Pure Node stages MUST use five
untimed warm-ups followed by twenty recorded samples. Browser setup/update
stages MUST use three untimed warm-ups followed by ten recorded samples; the
30 interaction redraws are the recorded frame sample set for that run.
Timing MUST use the owning runtime's monotonic high-resolution clock.

### Memory evidence

- The Node path MUST record heap usage before fixture creation and after each
  measured stage in a fresh case boundary.
- The Chromium path MUST use the existing provider-backed CDP seam to record
  browser heap usage before renderer construction, after initial render, after
  incremental replacement and after destroy.
- Memory evidence MUST state whether explicit garbage collection was
  available. A value observed without explicit collection MUST be labelled a
  retained-heap observation, not a leak claim.
- Failure to obtain a browser or Node memory sample MUST be explicit in the
  result with the affected stage and reason; timings MUST NOT be presented as
  complete memory evidence when memory data is missing.

### Reference and informative environments

The calibrated reference run is the current Windows development machine with
the repository's headless Playwright Chromium provider.

Every result MUST record:

- exact Git `HEAD`, dirty/clean state and a deterministic hash of any working
  tree diff;
- UTC timestamp;
- operating system name, version and architecture;
- CPU model and logical processor count;
- total system memory;
- Node, npm, Vitest, Playwright and Chromium versions;
- browser viewport and device-pixel ratio;
- fixture contract version and runner version.

The runner MUST remain executable on the repository's Node 22
`ubuntu-latest` CI environment. Any result obtained there is informative only
and MUST be labelled `informative-ci`; P6a does not add automatic CI execution
or a CI pass/fail budget. Live Obsidian desktop, Bases, pop-out and Mobile
WebView performance remain P7/manual evidence and MUST NOT be inferred from
Node or headless Chromium.

### Evidence and recommendation

- The dedicated command MUST produce a machine-readable JSON result
  containing all raw samples, summaries, fixture counts, environment metadata
  and missing-data notices.
- A date-stamped evidence record under `.10x/evidence/` MUST summarize the
  procedure, observations, supported conclusions and limits. Its corresponding
  JSON result belongs under `.10x/evidence/.storage/`.
- The evidence MUST distinguish initial construction, pure computation,
  semantic DOM work, canvas draw work, interaction redraw and retained heap.
- The architecture recommendation MUST identify the dominant measured stage
  and its scaling trend before recommending any change.
- A Worker MAY be recommended only when the evidence attributes material
  main-thread cost to a transferable pure-computation stage. DOM, canvas,
  Obsidian API and owning-window lifecycle work MUST remain on the owning
  thread.
- Main-thread simplification, render culling, semantic-list bounding or no
  optimization MUST remain first-class outcomes when they are the smallest
  response supported by evidence.
- P6a MUST NOT recommend an image cache from these fixtures: no photo is
  decoded or painted. Photo rendering/cache requires a separate behavioral
  specification and measurement workload.
- The recommendation MUST propose candidate latency/memory budgets for user
  ratification, but MUST NOT activate them or create an accepted architecture
  decision without that checkpoint.

## Given/When/Then scenarios

### Repeatable sparse fixture

Given the sparse fixture contract and `N = 1_000`

When the generator runs twice on the same or another supported platform

Then both results contain the same 1,000 stable people and 2,000 stable
relationships in deterministic order and produce structurally equal canonical
snapshots.

### Bounded stress fixture

Given the stress fixture contract and `N = 5_000`

When the fixture is validated before measurement

Then it contains exactly 5,000 people and 40,000 relationships, remains free
of guessed identities and supplies one explicit bounded stress workload.

### Equivalent incremental update

Given a measured fixture and its deterministic middle-person relationship
change

When the incremental path and a fresh full rebuild are compared

Then both graph results are equivalent under the existing stable identity,
parallel-edge, diagnostic and deterministic-order contracts.

### Honest reference report

Given a Windows/Chromium run with timing and memory samples

When the evidence record is written

Then it identifies the exact source/environment, preserves raw variance,
labels missing or non-GC memory data and makes no live Obsidian or universal
hardware claim.

### Evidence selects the next step

Given completed characterization results

When an architecture recommendation is prepared

Then it attributes cost to a measured layer, considers no-change and
main-thread simplification before a Worker, excludes image caching from this
evidence and presents candidate budgets for explicit user ratification.

## Acceptance criteria

- [ ] Deterministic sparse and stress fixtures produce exact `N`, `2N` and
      `8N` counts at all three ratified sizes.
- [ ] The person-plus-relationship incremental result is equivalent to a full
      rebuild without changing stable identities or total graph counts.
- [ ] Node measurements separately report index, snapshot, projection, layout
      and incremental stages with the required warm-ups and samples.
- [ ] Chromium measurements separately report initial render, Graph/List
      surfaces, 30 interaction redraws, incremental replacement and destroy.
- [ ] Timing summaries include raw samples, median, p95, minimum and maximum.
- [ ] Node and Chromium memory observations include collection availability,
      stage boundaries and explicit missing-data notices.
- [ ] The calibrated Windows result contains complete source and environment
      provenance; any Linux CI result is labelled informative.
- [ ] The dedicated runner is separate from required correctness/build gates
      and introduces no timing threshold.
- [ ] Date-stamped Markdown and JSON evidence make supported conclusions and
      limitations independently auditable.
- [ ] The recommendation identifies the measured bottleneck, applies the
      smallest-mechanism rule and presents—but does not activate—candidate
      budgets and the next bounded ticket.
- [ ] Existing tests and production build remain passing.

## Exclusions

- Implementing a Web Worker, force simulation, community detection, render
  virtualization/culling or another optimization.
- Decoding, painting or caching photos.
- Activating latency, frame-time or memory regression thresholds.
- Adding automatic benchmark execution to required CI checks.
- Changing graph, projection, stable identity, mutation or view-state
  semantics.
- Live Obsidian desktop, Bases, pop-out, assistive-technology or Mobile
  performance certification.
- P7's broad property-based, integration and cross-environment matrix.

## Ratified and record-backed decisions

- User-ratified on 2026-07-26: P6a characterizes and recommends only; budgets
  are ratified after evidence, and P6a implements no Worker, cache or product
  optimization.
- User-ratified on 2026-07-26: measure deterministic 100/1,000/5,000-node
  sparse `2N`-edge and stress `8N`-edge workloads, including full construction,
  projection, layout, Graph/List rendering and one person-plus-relationship
  delta.
- User-ratified on 2026-07-26: the current Windows machine plus headless
  Chromium is the calibrated reference; `ubuntu-latest` is informative only,
  and live Obsidian remains P7/manual evidence.
- Record-backed: the P4 layout contract is deterministic and per-view, and P5
  owns renderer lifecycle, owning-window animation frames and semantic/canvas
  equivalence.
- Record-backed: the current implementation contains no force/community
  workload and no photo decoding/painting, so neither a Worker nor image cache
  has evidence-backed P6a work to perform.
