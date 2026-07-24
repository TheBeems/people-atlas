Status: done
Created: 2026-07-24
Updated: 2026-07-24

# Incremental index and diagnostics

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-24-canonical-graph-source.md`

## Scope

Implement the P2 incremental indexing and diagnostics layer on top of the canonical graph source. Maintain path, person-ID and relationship-ID indexes; process targeted vault and metadata lifecycle events; maintain inverse references and adjacency; publish a typed graph delta; and expand source-addressable diagnostics without guessing ambiguous identities.

The initial vault load may build the complete index and graph. After initialization, a single-file change MUST reparse only the affected file and its explicitly dependent records, and consumers MUST apply the resulting delta without a full vault rescan or full graph rebuild.

## Non-goals

- Person or relationship creation, editing or deletion workflows.
- Person merge or duplicate-resolution mutations.
- New projection modes, layouts or persisted view state.
- Web Worker, image decoding/cache or performance-budget work.
- Full mobile gesture redesign.
- Relationship history or versioned plugin data.

## Acceptance Criteria

- [x] The index maintains path-to-record, person-ID-to-paths and relationship-ID-to-paths indexes; duplicate IDs remain represented as ambiguous sets and are never resolved by first match.
- [x] The index handles initial load, create, metadata-changed/modify, rename and delete events through lifecycle-owned Obsidian events.
- [x] Rename, delete and identity changes invalidate only affected dependent contacts, relationships, adjacency entries and asset diagnostics.
- [x] A post-initialization single-file change does not call `vault.getMarkdownFiles()` or perform a full vault rescan.
- [x] Adjacency is maintained with path-safe identity keys and preserves parallel relationship entities.
- [x] The index publishes a revisioned delta containing changed paths, affected person/relationship records, removed paths, affected IDs and diagnostics.
- [x] A pure graph-delta application path produces the same graph result as a full rebuild for equivalent lifecycle changes, while views consume deltas after initial load.
- [x] Diagnostics cover ambiguous identities, duplicate relationship IDs, invalid `YYYY-MM-DD` relationship dates, invalid status/direction, missing or unresolved endpoints, filtered endpoints and missing photo assets.
- [x] Ambiguous identity diagnostics are errors and produce no guessed edge. Missing asset diagnostics are warnings and retain both the source note path and target asset path.
- [x] Every diagnostic retains source paths and the standalone diagnostics UI provides navigation to an available source note; unresolved assets remain diagnostic data and are not fabricated as person nodes.
- [x] Pure index, lifecycle, adjacency, delta, diagnostic and repaired-regression behavior has focused tests; the existing P1 graph and projection tests continue to pass.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-24-canonical-graph-source.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/decisions/canonical-graph-source.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/index/person-index.ts`
- `src/index/frontmatter.ts`
- `src/graph/build-snapshot.ts`
- `src/view/people-atlas-view.ts`

## Assumptions

- User-ratified: P2 should be implemented now using the recommendations from the preceding review.
- User-ratified: relationship dates use strict `YYYY-MM-DD` validation.
- User-ratified: missing assets are warnings containing source and target paths.
- User-ratified: ambiguous identities are errors and never produce a guessed edge.
- Record-backed: P1's canonical graph source and relationship identity contract are complete and are the dependency boundary for this ticket.
- Record-backed: initial indexing may perform a complete vault scan; incremental changes must not.

## Journal

- 2026-07-24: P2 was identified as the next executable priority after P1. Current source has path maps and metadata/delete/rename handling, but no ID indexes, adjacency, graph delta contract, strict date diagnostics, missing-asset diagnostics or diagnostic navigation.
- 2026-07-24: User authorized implementation and accepted the preceding recommendations. Ticket opened as the executable owner before source changes.
- 2026-07-24: Added pure `IndexState` with path, ID, dependency, asset and adjacency indexes; `PersonIndex` now publishes targeted lifecycle deltas and uses Obsidian `resolvedLinks` for path-based dependents.
- 2026-07-24: Added strict relationship-date and missing-asset diagnostics, ambiguous-reference errors, source-note navigation and incremental graph-delta application for standalone and stable Bases selections.
- 2026-07-24: Fresh review found rename deltas initially omitted the old path and corrected it before closure; hidden-edge counts and revisions were also made lifecycle-safe.

## Blockers

None known.

## Evidence

- `npm run test` passed: 8 test files, 21 tests.
- `npm run build` passed: TypeScript no-emit check and production esbuild completed successfully.
- `test/person-index-lifecycle.test.ts` proves create, metadata change, rename and delete without an additional vault scan and verifies the rename delta includes the removed old path.
- `test/index-state.test.ts` covers duplicate ID sets, relationship ID/adjacency maintenance, dependent invalidation and monotonic revisions across rebuilds.
- `test/graph-delta.test.ts` compares a single-file incremental contact update with a full graph rebuild.
- `test/frontmatter-diagnostics.test.ts` covers strict date validation and missing-asset diagnostics.
- `test/build-snapshot.test.ts` preserves P1 coverage for ambiguous IDs, parallel relationships and filtered endpoints.

These checks do not prove behavior inside a live Obsidian mobile/pop-out/browser harness; that remains P7 scope.

## Review

Verdict: pass.

The review checked lifecycle ordering, rename removal/addition, duplicate identity handling, delta edge replacement, filtered-edge accounting and revision stability. No critical or significant finding remains.

Residual risk: the tests use a small Obsidian event stub rather than a live vault/metadata cache, and Bases query refresh behavior is not browser-harness tested. These are intentionally deferred to P7 integration and interaction coverage.

## Retrospective

The most important seam was making the index state pure and path-addressable before wiring Obsidian events. This made duplicate IDs and parallel relationships safe by construction and made lifecycle tests independent from a live vault. The rename review finding showed that a remove-plus-add sequence must be published as one delta; otherwise consumers can retain stale nodes. A second review pass also caught that hidden-edge counts and revision numbers are derived lifecycle state and must be updated explicitly.
