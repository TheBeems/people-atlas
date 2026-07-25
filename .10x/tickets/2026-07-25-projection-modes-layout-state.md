Status: done
Created: 2026-07-25
Updated: 2026-07-25

# P4 — Projection modes, contact-health ordering and persisted view state

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`, `.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`

## Scope

Implement the active contract in
`.10x/specs/projection-modes-layout-state.md` as the first bounded P4 slice.

The implementation owns:

- pure center resolution and projection transformations in `src/graph/`;
- deterministic hidden-node/hidden-edge accounting;
- serializable layout snapshot capture/restore for positions and camera;
- versioned per-view state loading, validation and migration;
- wiring both standalone and Bases views to the shared projection contract.

The ticket must leave the existing canonical graph source, incremental index,
mutation boundary and renderer safety lifecycle intact.

## Non-goals

- Full timeline, organization, community or shortest-path projections.
- Automatic relationship-state or follow-up inference from dates.
- Force simulation, Web Workers, photo decoding or image caching.
- Touch gestures, screen-reader renderer redesign, pop-out testing or PNG/SVG
  export.
- Person merging, unresolved-link conversion or bulk note rewrites.

## Acceptance Criteria

- [x] A pure projection module accepts an `AtlasSnapshot` plus stable-ID
      context/options and returns an `AtlasSnapshot` without importing
      `obsidian`.
- [x] `configured`, `active-note`, `selected-node` and `none` center modes are
      represented explicitly; missing transient active/selection context falls
      back to no-center, while an invalid configured center adds a warning and
      never guesses.
- [x] `ego` uses undirected reachability with default `hops = 2`; `free-network`
      includes all input nodes; `contact-health` preserves inclusion semantics
      and orders edges by oldest valid `lastContact`, missing date last, then
      stable edge ID.
- [x] Projection output preserves relationship direction, types, closeness,
      since, last-contact and explicit status values.
- [x] Projection and max-node filtering increment hidden counts exactly once
      for omitted nodes and edges and retain input diagnostics.
- [x] Repeated projection of equal inputs/options is deterministic and does
      not regenerate `generatedAt`.
- [x] A versioned view-state model stores center mode, projection mode, hops,
      max nodes, most-recent-first center history and layout snapshots.
- [x] State load rejects malformed/future state safely, migrates existing
      schema-v2 plugin data, caps history at 20 stable person IDs and does not
      overwrite unsupported data.
- [x] Layout restore applies only finite, in-bounds camera values and known
      node IDs; missing positions use the existing deterministic layout.
- [x] Standalone and Bases views use the same projection transformation. Their
      state keys are isolated, and restoring one view/configuration cannot
      change another view/configuration.
- [x] Center/projection changes and completed layout interactions persist view
      state without writing vault notes; failures leave the current view usable
      and surface a recoverable notice.
- [x] Focused tests cover center ambiguity, all projection modes, date ordering,
      hidden counts, deterministic output, state migration/validation,
      layout fallback and per-view isolation.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/specs/projection-modes-layout-state.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-24-canonical-graph-source.md`
- `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`
- `.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`
- `.10x/research/2026-07-25-obsidian-people-needs.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/domain/types.ts`
- `src/graph/project-graph.ts`
- `src/render/layout.ts`
- `src/render/camera.ts`
- `src/render/atlas-renderer.ts`
- `src/settings/migrations.ts`

## Assumptions

- Record-backed: the canonical graph and index remain the only vault-derived
  source; projection code receives already resolved snapshot data.
- Record-backed: existing relationship status values remain explicit and
  manually authored; `last_contact` is never a status transition trigger.
- User-ratified: this ticket is the next implementation priority after P3 and
  starts with recency/contact-health behavior.
- Mechanical contract choice: state history is capped at 20 distinct stable
  person IDs to prevent unbounded plugin data growth.
- Mechanical contract choice: a view adapter supplies an opaque stable
  `viewConfigurationKey`; the state store does not derive identity from a
  display name. Equal keys restore the same state; different keys are isolated.
- Mechanical contract choice: layout persistence is plugin data, not Markdown
  note content, and uses a versioned state shape separate from relationship
  semantics.

## Journal

- 2026-07-25: Opened after P1, P2 and P3 closed with passing test/build gates.
- 2026-07-25: Scope was intentionally limited to the first read-only P4 slice;
  later intelligence projections and renderer work remain separate.
- 2026-07-25: Implemented pure center/projection transformations, deterministic
  hidden-count accounting, contact-health ordering and layout snapshot restore.
- 2026-07-25: Added schema-v3 view-state migration, bounded center history,
  per-view layout keys and standalone/Bases lifecycle wiring.
- 2026-07-25: Added focused projection, layout-state and migration regressions.
- 2026-07-25: Test and build gates passed; final review found no critical or
  significant finding within the scoped contract.

## Blockers

None known for the scoped design. Implementation must stop and record a blocker
if the Obsidian host cannot provide a stable per-view-configuration key without
using display names or silently sharing state.

## Evidence

- `src/graph/project-graph.ts` provides stable-ID/path center resolution,
  ego/free-network/contact-health projections, deterministic ordering and
  hidden-item accounting without importing `obsidian`.
- `src/render/layout-state.ts` captures and restores known node positions and
  finite in-bounds camera state, with deterministic fallback for missing data.
- `src/settings/view-state.ts`, `src/settings/migrations.ts` and
  `src/main.ts` provide schema-v3 state migration, validation, bounded center
  history and plugin-data persistence without vault note writes.
- `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` use the shared projection service,
  register active-note lifecycle events and persist isolated state keys.
- `test/project-graph.test.ts`, `test/layout-state.test.ts`,
  `test/view-state.test.ts` and `test/migrations.test.ts` cover the pure
  transformations, ambiguity safety, date ordering, hidden counts, layout
  fallback, isolation and migration behavior.
- `npm test` passed: 14 test files, 46 tests.
- `npm run build` passed: TypeScript no-emit check and production esbuild.
- `git diff --check` passed; only expected LF/CRLF normalization warnings were
  reported by Git.

## Review

Verdict: pass.

Adversarial review checked stable-ID-only center selection, ambiguous-center
behavior, preservation of relationship metadata/status, exact hidden counts,
future/malformed state protection, renderer lifecycle cleanup and separate
standalone/Bases state keys.

Residual risk: live Obsidian desktop/mobile rendering, Bases-file persistence
round trips and duplicate unnamed Bases configurations are not covered by the
focused test harness. Bases exposes an explicit `stateKey` option; when it is
empty the configured Bases view name is used as the stable fallback key.

## Retrospective

Keeping projection and layout-state transformations pure made the new behavior
testable without a live Obsidian window. The first test run exposed that legacy
`AtlasNode` fixtures sometimes use `node.id` without `personId`; retaining that
fallback preserved compatibility without weakening the production identity
rules. The renderer now emits state only after completed interactions, which
keeps drag/zoom persistence out of the pointer-move hot path.
