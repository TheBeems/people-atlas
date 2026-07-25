Status: active
Created: 2026-07-25
Updated: 2026-07-25

# P4 — Projection modes, contact-health ordering and persisted view state

## Context

People Atlas now has one canonical relationship-aware `AtlasSnapshot`, an
incremental `PersonIndex` and a validated mutation boundary. The current
projection accepts only an optional center, hop count and node limit. The
standalone and Bases adapters keep center state independently, and the
renderer recreates deterministic positions whenever a snapshot changes.

The next useful product step is to make the graph intentionally inspectable:
users must be able to choose what establishes the center, switch between a
focused ego view and the full network, inspect recency without changing
relationship meaning, and return to a view with its previous layout intact.

The contract below is deliberately read-only. It does not infer relationship
status, create follow-up tasks, rewrite notes or introduce a second graph
store.

## Scope

This spec governs:

1. A pure projection service that consumes an `AtlasSnapshot` and returns an
   `AtlasSnapshot` with deterministic node/edge inclusion and hidden-item
   accounting.
2. Four center modes: `configured`, `active-note`, `selected-node` and
   `none`.
3. Three projection modes for this first P4 slice: `ego`, `free-network` and
   `contact-health`.
4. A serializable, per-view-configuration state contract for center history,
   projection settings, camera state and manually adjusted node positions.
5. Standalone and Bases adapters using the same pure projection contract.

Full timeline rendering, organization/community/shortest-path projections,
automatic follow-up inference, force simulation and renderer accessibility
work remain later P4/P5 work. They must not be smuggled into this contract as
implicit behavior.

## Normative contract

### Identity and resolution

- Person centers MUST be resolved by `person_id`/`PersonId` or an explicit
  path-to-record result supplied by the index adapter. Display names MUST NOT
  select a center.
- A ghost node MUST NOT become a center.
- An ambiguous or unresolved requested center MUST produce no guessed center.
  The projection returns the non-centered result and adds a warning
  diagnostic with a stable code and the requested identity where available.
- `active-note` and `selected-node` are inputs to the pure service, not vault
  lookups. The view adapter resolves the active file or selected node before
  invoking the service.

### Center modes

- `configured` uses the configured stable person ID when it resolves uniquely.
- `active-note` uses the supplied active person ID when present and valid.
- `selected-node` uses the supplied selected person ID when present and valid.
- `none` deliberately produces a non-centered projection.
- If `active-note` or `selected-node` has no supplied person ID, the service
  MUST use the non-centered result without creating a diagnostic. This is a
  normal empty UI state.
- If a configured ID is supplied but cannot resolve uniquely, the service MUST
  add the center-resolution warning and use the non-centered result.

### Projection modes

- `free-network` includes every input node and every edge whose endpoints are
  included. It has no center, regardless of center-mode context.
- `ego` includes the resolved center and nodes reachable through undirected
  adjacency up to `hops`. Directional relationship metadata remains unchanged
  in the returned edges; traversal is intentionally about network proximity.
- `contact-health` uses the same node inclusion as `ego` when a valid center is
  available and the same inclusion as `free-network` otherwise. Its edges are
  ordered deterministically by `lastContact`: valid dates oldest first,
  missing dates last, then stable edge ID. Explicit relationship `status` is
  preserved exactly; no status is inferred from date age.
- `hops` MUST be a non-negative integer. The default is `2`.
- `maxNodes` MUST be a positive integer. When the limit removes nodes, edges
  whose endpoints are removed are removed as well and both hidden counts are
  increased.
- Projection MUST preserve all diagnostics from the input snapshot and append
  only diagnostics caused by the projection itself.

### Hidden-item accounting

For a projected result:

- `hiddenNodeCount` MUST equal the input hidden-node count plus the number of
  input nodes omitted by the projection or node limit.
- `hiddenEdgeCount` MUST equal the input hidden-edge count plus the number of
  input edges omitted by the projection or node limit.
- An edge omitted because either endpoint is omitted counts exactly once.
- A projection MUST NOT discard the distinction between filtered, unresolved,
  ambiguous or projection-limited data in the existing diagnostics.

### Determinism

- Equal input snapshots and equal projection options MUST produce structurally
  equal output apart from no generated wall-clock value. The projection MUST
  preserve the input `generatedAt` rather than calling `Date.now()`.
- Node and edge ordering MUST use stable IDs or the explicit contact-health
  date ordering above. Object/map iteration order MUST NOT become a hidden
  semantic input.
- Pure graph code MUST remain independent of the `obsidian` package.

### View state

The persisted state is plugin data, not vault note content:

```ts
interface AtlasViewState {
  schemaVersion: 1;
  centerMode: "configured" | "active-note" | "selected-node" | "none";
  projectionMode: "ego" | "free-network" | "contact-health";
  hops: number;
  maxNodes: number;
  centerHistory: string[];
  layouts: Record<string, {
    positions: Record<string, { x: number; y: number }>;
    camera: { x: number; y: number; scale: number };
  }>;
}
```

- The `string` values in `centerHistory` MUST be stable person IDs, never
  display names. Invalid or duplicate entries are ignored during load.
- Center history is most-recent-first, de-duplicated and capped at 20 IDs.
- A layout key MUST include the owning view-configuration key and the
  projection inputs that affect node inclusion. A layout from one view or
  projection MUST NOT be applied to another.
- Layout positions are keyed by `NodeId`. Unknown saved nodes are ignored;
  nodes without a saved position use the deterministic layout. Saved camera
  values are restored only when finite and within the renderer's scale bounds.
- A view MUST save state after a completed center/projection change and after
  a completed layout interaction. Persistence failures MUST leave the current
  in-memory view usable and surface a recoverable notice; they MUST NOT write
  vault notes.
- Existing schema-v2 plugin data MUST migrate to the new state shape without
  changing existing settings. Malformed state falls back to safe in-memory
  defaults and disables state writes until the existing repair policy is used.

## Given/When/Then scenarios

### Configured ego projection

Given a snapshot with a unique person ID `alice` and connected people within
three hops

When the projection is `ego`, center mode is `configured`, center ID is
`alice`, and `hops` is `2`

Then Alice is the only center, nodes at distance 0–2 are included, farther
nodes are hidden, and relationship direction/status/date metadata is unchanged.

### No-center full network

Given a snapshot containing people, ghosts, edges and existing hidden counts

When the projection is `free-network` with center mode `none`

Then every input node and valid edge is returned, no node is marked as center,
and the existing hidden counts are unchanged.

### Ambiguous center is never guessed

Given two person records share the requested person ID

When the projection requests that ID as its configured center

Then no node is marked as center, no ego traversal occurs, and one projection
center warning is present; neither duplicate record is selected by position or
display name.

### Contact-health ordering

Given relationship edges with valid `lastContact` dates, missing dates and
explicit statuses

When the `contact-health` projection is applied

Then the returned edges are ordered oldest valid date first, missing dates
last, ties by stable edge ID, and every explicit status remains unchanged.

### Projection limits are visible

Given a projection omits three nodes and two edges from an input snapshot

When the result is returned

Then its hidden counts increase by exactly those omitted items and all input
diagnostics remain present.

### Layout isolation

Given two view configuration keys or two projection keys

When one view saves a dragged node position and camera state

Then reopening the same key restores that state, while the other key keeps its
own state or deterministic defaults.

### Safe state migration

Given valid schema-v2 plugin data without view state

When the plugin loads it after the P4 schema migration

Then existing settings remain unchanged, an empty valid state collection is
available in memory, and the migrated data can be saved. Future or malformed
data remains protected by the existing read-only recovery behavior.

## Acceptance criteria

- [ ] A pure projection contract supports all four center modes and the three
      P4 slice projection modes above without importing `obsidian`.
- [ ] Standalone and Bases adapters invoke the same projection service and do
      not maintain separate projection semantics.
- [ ] Center resolution is stable-ID based, ambiguity-safe and diagnostic when
      an explicitly requested configured center is invalid.
- [ ] Ego, free-network and contact-health projections preserve relationship
      metadata and produce deterministic output.
- [ ] Projection and node-limit omissions update `hiddenNodeCount` and
      `hiddenEdgeCount` exactly once per omitted item.
- [ ] Layout snapshots restore valid positions/camera state per view and
      projection key, while missing/invalid entries fall back safely.
- [ ] Center history is persisted per view configuration, bounded to 20 stable
      IDs and never couples one view's state to another.
- [ ] Plugin data migration and validation cover absent, malformed and future
      view-state data without overwriting unsupported data.
- [ ] Focused tests cover pure center/projection/hidden-count/layout-state
      transformations and repaired regressions.
- [ ] `npm run test` and `npm run build` pass.

## Exclusions

- Force-directed simulation, Web Workers, image decoding or cache policy.
- Canvas accessibility, touch gestures, pop-out behavior or broad renderer
  redesign.
- Full timeline visualization, organization/community/shortest-path analysis
  and automatic follow-up or status inference.
- Person merging, relationship-history storage or bulk vault rewrites.

## Ratified and record-backed decisions

- Record-backed: P1–P3 establish `AtlasSnapshot`, stable identity, explicit
  relationship entities, incremental deltas and validated plugin-data
  migration boundaries.
- User-ratified in this shaping turn: the next priority is P4, and the first
  user-facing emphasis is recency/contact-health rather than automatic status
  inference.
- Record-backed: `last_contact` is an observation and MUST NOT silently change
  `active`, `dormant` or `ended` status.
