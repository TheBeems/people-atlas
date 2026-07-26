Status: open
Created: 2026-07-24
Updated: 2026-07-26

# People Atlas v2 implementation plan

## Objective

Evolve the current v0.1 scaffold into a Bases-native, Markdown-first visualization and maintenance layer for people and relationships, while preserving stable identities, explicit relationship entities, shared graph semantics, accessible navigation, mobile operation and incremental processing.

This is a parent plan, not an executable implementation ticket. Each priority below receives one bounded child ticket when its prerequisites and acceptance criteria are concrete.

## Scope

The plan covers the eight implementation priorities agreed with the user:

1. Canonical graph source for standalone and Bases.
2. Incremental index, duplicate resolution and diagnostics.
3. Safe file mutations and versioned plugin data.
4. Center/projection modes, multiple layouts and persisted layout state.
5. Accessible renderer and complete mobile interaction.
6. Web Worker, image cache and performance optimization.
7. Integration, browser, property-based and performance tests.
8. Release hardening and reproducible publication.

## Ordering and dependencies

```text
P1 Canonical graph source
 └─> P2 Incremental index and diagnostics
      └─> P3 Safe mutations and versioned data
           └─> P4 Projection modes, layouts and state
                └─> P5 Accessible/mobile renderer
                     └─> P6 Worker, cache and performance

P1..P6 ──> P7 Expanded test matrix ──> P8 Release hardening
```

Tests and narrow quality checks are required inside every child ticket. P7 expands coverage after the graph, data and renderer contracts have stabilized; it is not a reason to defer testing.

## Child priorities

### P1 — Canonical graph source

Owner: `.10x/tickets/2026-07-24-canonical-graph-source.md`

Unify standalone and Bases around the canonical relationship-aware graph source. Preserve Base person property mappings while loading rich relationship records from `PersonIndex`. Add explicit/fallback relationship identity, direction, dates, status, duplicate-ID safety, parallel-edge preservation and filtered-endpoint accounting.

Gate: both views use the same relationship-aware graph contract and pure tests cover the new identity and edge invariants.

### P2 — Incremental index and diagnostics

Add path-, person-ID- and relationship-ID indexes, targeted create/modify/rename/delete handling, adjacency maintenance and graph deltas. Expand diagnostics for ambiguous identities, duplicate relationships, invalid dates/status/direction, missing endpoints, filtered endpoints and missing assets. Diagnostics must retain source paths and support navigation where the UI exposes them.

Depends on: P1 graph and relationship identity contract.

Gate: a single-file change does not require a vault rescan or full graph rebuild, and index consistency is tested across lifecycle events.

### P3 — Safe mutations and versioned plugin data

Implement explicit person and relationship creation/editing, relationship ending without history loss, unresolved-link conversion and merge workflow. Use Obsidian-safe frontmatter/file APIs. Formalize persisted data schemas, migrations, strict validation, bounded values and recovery behavior for invalid data.

Depends on: P1 identity/relationship contract and P2 diagnostics/index ownership.

Gate: every write is reviewable, validates before mutation, preserves unrelated frontmatter and has failure-path tests.

### P4 — Projection modes, layouts and state

Add configured, active-note, selected-node and no-center modes; ego, free-network, organization and timeline/contact-health projections; shortest paths, mutual contacts, communities and isolated-node views where their graph contract is ready. Persist center history and layout snapshots per view configuration.

Depends on: P1 shared graph contract and P2 stable deltas. P3 is required for maintenance-driven state changes but not for read-only projections.

Gate: projections are pure transformations with deterministic output, explicit hidden-node accounting and no view-to-view state coupling.

### P5 — Accessible renderer and mobile interaction

Owner: `.10x/tickets/2026-07-26-accessible-semantic-renderer.md` (P5a)

Split renderer responsibilities where the boundaries are justified. Keep canvas as the visual surface and add a semantic alternative graph/list with keyboard navigation, focus management, relation descriptions, context actions and reduced-motion handling. Add pinch zoom, one-finger pan, long press, touch-sized targets, bottom-sheet controls and pop-out-window correctness.

Depends on: P4 projection/state contract and P2 diagnostics/navigation data.

Gate: keyboard, screen-reader-oriented alternative view, touch and pop-out behavior are covered by a browser harness.

### P6 — Worker, image cache and performance

Move expensive physics/community work to a Web Worker when graph size warrants it. Add seeded positions, incremental layout updates, bounded image decoding/cache and frame-coalesced rendering. Establish thresholds for worker activation and memory/latency budgets.

Depends on: P4 layout contract and P5 renderer lifecycle. Do not introduce worker complexity before profiling demonstrates the need.

Gate: fixed datasets meet agreed index, first-render, frame-time and memory budgets without layout jumps on small deltas.

### P7 — Expanded test matrix

Add Obsidian integration tests for vault and metadata lifecycle, Bases data updates, renderer interaction tests for pan/zoom/pinch/drag/keyboard/reduced-motion/pop-out/high-DPI, property-based graph invariants and fixed performance fixtures for 100/1,000/5,000 nodes.

Depends on: P1–P6 contracts and test seams.

Gate: the full test matrix is repeatable in CI and failures identify the owning layer.

### P8 — Release hardening

Pin the intended Obsidian API/minimum version, add a lockfile and deterministic install, lint/format checks, strict type/build checks, production minification, bundle-size budget, dependency review, separate debug sourcemaps and release provenance. Keep compiled artifacts out of the source repository and publish only release artifacts.

Depends on: P7 passing test matrix and stable production build.

Gate: CI produces a reproducible, verified release from an exact source revision.

## Parallelization

- P1 is the critical first path.
- P2 can begin design work after P1's domain contract is stable, but its implementation depends on P1.
- P3 and read-only P4 design can proceed in parallel after P1, with integration after P2 where they consume index deltas.
- P5 can be designed while P4 is implemented, but renderer changes must consume the finalized projection contract.
- P7 test harness scaffolding may start during P2–P5; its final acceptance waits for P6.
- P8 remains last because release budgets and provenance depend on the final artifact and test matrix.

## Parent acceptance criteria

- [ ] Each priority has a bounded child ticket with explicit scope, non-goals and acceptance criteria before implementation begins.
- [ ] Child tickets close in dependency order, except for explicitly parallelized design or harness work.
- [ ] Every child ticket records tests, review findings, residual risk and follow-up ownership.
- [ ] The final release gate proves source revision, artifact contents, build provenance and full verification results.

## References

- `AGENTS.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/specs/canonical-graph-source.md`

## Assumptions

- User-ratified: implementation proceeds per priority, not as one unbounded batch.
- User-ratified: the eight-priority order in this plan is the preferred delivery sequence.
- Record-backed: the current repository is a v0.1 scaffold and the canonical graph source is the active first child ticket.

## Journal

- 2026-07-24: User chose staged implementation per priority after first recording the complete order.
- 2026-07-24: P1 remains the only executable child ticket; later child tickets will be opened as their prerequisites become verified.
- 2026-07-24: P1 completed with passing tests/build and no significant review finding; P2 is now the next executable priority.
- 2026-07-24: P2 child ticket was opened, implemented and closed with passing tests/build and no significant review finding; P3 is now the next executable priority.
- 2026-07-25: P3 child ticket was implemented and closed with passing tests/build and no significant review finding; P4 child spec and ticket were opened for projection modes, contact-health ordering and persisted view state.
- 2026-07-25: P4 child ticket was implemented and closed with passing tests/build and no significant review finding; P5 is now the next priority.
- 2026-07-25: The post-P4 audit remediation sequence closed its incremental graph, mutation identity and view-state ordering regressions with focused before/after evidence and 56 passing tests. The separate relationship-mutation UI semantics must be shaped with the user before further implementation; P5 remains the next numbered roadmap priority.
- 2026-07-25: Relationship-editor semantics were ratified and recorded in
  `.10x/specs/relationship-editor-ui.md`; the executable P3b follow-up is
  `.10x/tickets/2026-07-25-relationship-editor-ui.md`. It is the immediate
  implementation candidate before resuming the numbered roadmap at P5.
- 2026-07-25: P3b relationship-editor UI was implemented and closed with one
  shared modal, canonical create/edit entrypoints in standalone and Bases,
  changed-field-only writes, 71 passing tests, a passing production build and
  a pass review. P5 accessible/mobile renderer is again the next numbered
  priority; live modal, Bases and mobile behavior remain part of its/P7's
  integration risk.
- 2026-07-26: The user ratified P5a's visible session-local Graph/List mode,
  roving keyboard/action contract and selected-person relationship
  descriptions. `.10x/specs/accessible-semantic-renderer.md` is active and
  `.10x/tickets/2026-07-26-accessible-semantic-renderer.md` is the next
  executable child. Touch gestures and the complete mobile workflow remain a
  separate P5b shaping step after P5a.
- 2026-07-26: P5a closed after browser-first implementation, two bounded
  independent-review repair passes and a final pass verdict. The shared
  Graph/List renderer, semantic relationship details, stable keyboard/focus
  behavior, owning-window lifecycle and Node/Chromium test split are complete;
  final verification passed 19 files and 82 tests plus production build and
  diff hygiene. P5b touch gestures and complete mobile controls are now the
  next shaping priority.

## Blockers

None for planning. P5a has an executable child ticket; its Playwright provider
and Chromium setup are expected implementation prerequisites, not parent-plan
blockers.

## Evidence

Pending child-ticket execution.

## Review

Pending review at parent-plan closure.

## Retrospective

Pending delivery.
