Status: active
Created: 2026-07-26
Updated: 2026-07-26

# P7b — Generated graph and index invariants

## Purpose

Add broad, deterministic generated coverage around the existing canonical
graph, incremental graph-delta and pure index-state contracts. This contract
tests already-ratified P1/P2 behavior; it does not introduce new graph
semantics or authorize product repairs.

The generated corpus complements the existing fixed regression examples. It
must remain small enough for the default Node suite and must identify an
individual seed and transition when an invariant fails.

## Governing Contract

### Deterministic corpus

1. P7b MUST use a repository-local deterministic seeded generator. It MUST NOT
   call `Math.random()` or depend on wall-clock time for generated inputs.
2. Each invariant family MUST execute at least 64 fixed seeds in the default
   Node test project.
3. A failing case MUST identify its invariant family, seed and, for lifecycle
   sequences, operation number so the exact case can be replayed.
4. Generated fixtures MUST be bounded:
   - graph cases contain 1–24 person records;
   - graph cases contain 0–48 relationship records;
   - each person contains at most 4 contact references;
   - index and delta sequences contain at most 40 operations.
5. Generated inputs MUST include ordinary and adversarial identity shapes:
   unique and duplicate explicit IDs, canonical path references, unresolved
   references, duplicate display labels, parallel relationships, duplicate
   relationship IDs, self-relationships and filtered populations.
6. The generator and assertions MUST use the existing Vitest/TypeScript stack.
   P7b MUST NOT add a property-testing or other dependency.

### Canonical snapshot invariants

7. Every emitted edge MUST reference two emitted node IDs. Node and edge IDs
   MUST be unique within one snapshot.
8. Every visible person path MUST have exactly one person node. Duplicate
   explicit person IDs MUST use distinct path-derived ambiguous node IDs,
   produce a duplicate diagnostic and MUST NOT be resolved by first match.
9. Display names and aliases MUST NOT resolve identity. A same-label generated
   decoy without an explicit ID or resolved path match MUST leave the
   reference unresolved.
10. An unresolved contact from a visible person MUST remain a ghost plus an
    `unresolved-contact` diagnostic. An ambiguous explicit-ID reference MUST
    produce `ambiguous-person-reference` and MUST NOT create a guessed edge.
11. Rich relationship records with resolved, non-self endpoints MUST preserve
    their direction, types, closeness, dates, status and source path.
    Independent parallel records MUST remain independent edges.
12. Duplicate relationship IDs MUST produce
    `duplicate-relationship-id`; their emitted edge IDs MUST remain unique and
    path-stable. Self-relationships and unresolved endpoints MUST remain
    diagnostics rather than visible rich edges.
13. For a generated filtered population, `hiddenNodeCount` MUST equal the
    canonical people omitted from the visible population. Each otherwise
    resolvable contact or relationship crossing that boundary MUST contribute
    to `hiddenEdgeCount` and a `filtered-endpoint` diagnostic, not an
    unresolved diagnostic.

### Incremental graph-delta equivalence

14. Generated before/after transitions MUST cover person and relationship
    add, update and remove operations, including identity changes, duplicate
    appearance/disappearance, endpoint changes, ghost resolution/regression
    and relationship metadata changes.
15. Each generated transition MUST construct a contract-complete `IndexDelta`
    for the changed and explicitly dependent records. The generated delta MUST
    not omit affected records merely to accommodate the implementation.
16. Applying a generated valid delta to the previous snapshot MUST equal a
    fresh `buildAtlasSnapshot()` of the same after-state.
17. Equivalence comparison MUST exclude only `generatedAt` and ordering for
    arrays whose public contract does not specify order. Stable IDs, canonical
    paths, metadata, diagnostics and hidden counts MUST compare exactly.
18. Filtered-population delta cases MUST keep the visible-path selection
    stable across a transition because a Bases selection change deliberately
    takes the full-rebuild path.

### Pure index-state model equivalence

19. Generated `IndexState` sequences MUST apply upserts and removals for
    person, relationship and diagnostic-only files to both `IndexState` and a
    simple test-owned reference model.
20. After every operation, the generated test MUST compare:
    - the complete raw snapshot by canonical file path;
    - person-ID and relationship-ID path sets;
    - duplicate person and relationship ID sets;
    - relationship adjacency by referenced target;
    - stored diagnostics by source path;
    - explicitly dependent paths reported by the operation.
21. Updating IDs, contacts, assets or relationship endpoints MUST remove stale
    index entries before adding their replacements. Removing a file MUST leave
    no ID, dependency, asset or adjacency entry owned only by that file.
22. Every upsert and remove call MUST increment the revision exactly once.
    `clear()` MUST clear indexed content without making subsequent revisions
    non-monotonic.

### Test ownership and execution

23. Generated helpers and suites MUST live under `test/generated/` and remain
    pure Node tests. They MUST NOT import `obsidian`.
24. `npm run test:generated` MUST run only the generated invariant suites and
    identify P7b failures as generated graph/index failures.
25. The unqualified `npm run test` and existing `npm run check` paths MUST
    continue to include the generated suites without changing P7a browser or
    integration discovery.
26. Existing fixed regression tests and P6 performance fixtures MUST remain
    intact. Generated fixtures MUST NOT create performance thresholds or
    replace calibrated P6 evidence.

## Error Behavior

- A generated invariant failure MUST fail the focused and default suite with
  the family, seed and operation context needed to reproduce it.
- The executor MUST NOT weaken the generator, discard a valid failing seed or
  exclude an invariant to make the suite pass.
- If a valid generated case exposes a product defect, P7b MUST record the seed,
  minimized fixture boundary and failed invariant, mark the ticket blocked and
  request separate repair authorization. Product-source changes are not
  implicit P7b scope.
- If the generator itself violates the input contract, the executor MAY repair
  only the test generator and MUST journal why the input was invalid.

## Scenarios

### Scenario: duplicate labels never become identity

Given generated people with equal display labels but distinct explicit IDs and
paths, when another generated record references the label without an explicit
ID or resolved path mapping, then the graph keeps the reference unresolved and
does not attach it to either same-label person.

### Scenario: duplicate identity appears and disappears

Given a generated snapshot with a unique person ID, when a second path with the
same explicit ID is added and later removed, then incremental snapshots match
fresh rebuilds at both transitions, the ambiguous diagnostic appears and
disappears, and no first-match edge is created.

### Scenario: relationship churn preserves entities

Given generated parallel and duplicate-ID relationship records, when endpoints
or metadata change and one record is removed, then graph-delta output matches a
fresh rebuild while surviving records retain independent, stable identities
and metadata.

### Scenario: index state matches a reference model

Given a deterministic sequence of generated person, relationship and
diagnostic-only file operations, when each operation is applied, then every
public index lookup and affected-path result agrees with the test-owned model,
stale entries are absent and revisions remain monotonic.

## Acceptance Criteria

- At least 64 fixed seeds per snapshot, graph-delta and index-state family run
  deterministically in the default Node project.
- Failures report enough seed/operation context for exact replay.
- Generated snapshot tests enforce stable identity, fail-closed unresolved and
  duplicate handling, edge referential integrity, parallel relationship
  preservation and filtered accounting.
- Generated delta tests compare valid incremental transitions with full
  rebuilds while excluding only timestamp and unspecified collection order.
- Generated index-state tests compare every operation with an independent
  path-owned reference model and prove stale-index cleanup plus monotonic
  revisions.
- `npm run test:generated`, `npm run test`, `npm run build` and
  `git diff --check` pass.
- No dependency, product source, browser/integration behavior, performance
  threshold, persisted schema or release workflow changes.
- Fresh independent review returns `pass`, or non-critical residual risk is
  explicitly accepted before closure.

## Explicit Exclusions

- Product-source repair for any defect exposed by a generated case.
- A third-party property-testing or shrinking library.
- Fuzzing with nondeterministic or time-derived seeds.
- Renderer, browser, P7a controlled-runtime, high-DPI, real-pop-out or live
  Obsidian validation.
- P6 performance characterization, workload changes or regression thresholds.
- P8 lockfile, dependency-installation or release hardening.
- New graph, identity, relationship, projection or persistence semantics.
