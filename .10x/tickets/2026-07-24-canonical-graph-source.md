Status: done
Created: 2026-07-24
Updated: 2026-07-24

# Canonical graph source for standalone and Bases

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`

## Scope

Implement the active spec at `.10x/specs/canonical-graph-source.md`. Refactor the current separate Bases and standalone data paths into one canonical graph source while preserving Base property mappings for selected people.

## Non-goals

- File mutation and relationship editing.
- Merge-person workflow.
- Worker-based layout or new layout modes.
- Complete diagnostic pane redesign.
- Mobile gesture redesign.

## Acceptance criteria

- [x] Standalone and Bases consume the same canonical relationship-aware graph builder.
- [x] Bases uses its query result to select visible people but receives rich relationship records from `PersonIndex`.
- [x] Relationship identity supports explicit `relationship_id` with normalized path fallback.
- [x] Relationship direction supports `undirected` and `source-to-target`, defaulting absent values to `undirected`.
- [x] Relationship parsing preserves types, closeness, since, last contact and active/dormant/ended status.
- [x] Duplicate person IDs are diagnosed and never resolved by first match.
- [x] Multiple relationship entities between the same endpoints remain distinct edges.
- [x] Filtered relationship endpoints are distinguishable from unresolved endpoints.
- [x] Tests cover the new pure transformations and the repaired duplicate/parallel-edge regressions.

## References

- `.10x/decisions/canonical-graph-source.md`
- `.10x/specs/canonical-graph-source.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/index/person-index.ts`
- `src/bases/entry-adapter.ts`
- `src/bases/people-atlas-bases-view.ts`
- `src/graph/build-snapshot.ts`

## Assumptions

- User-ratified: Bases filters select the visible person population; canonical index supplies rich relationships.
- User-ratified: explicit relationship identity, direction, and parallel relationship entities are required.
- User-ratified: duplicate person IDs remain ambiguous and are never first-match resolved.
- Record-backed: rendering remains shared through `AtlasSnapshot` and pure graph transformations stay outside Obsidian imports.

## Journal

- 2026-07-24: Current source review found that `PersonIndex` indexes rich relationships for standalone, while `adaptBasesEntries()` returns `relationships: []` for Bases.
- 2026-07-24: User confirmed the three semantic recommendations required to make the canonical source executable.
- 2026-07-24: Added `buildGraphSnapshot()` as the shared source composition layer. Standalone uses canonical data directly; Bases combines selected mapped people with canonical `PersonIndex` relationships.
- 2026-07-24: Added explicit/fallback relationship IDs, direction, since, typed status, parse diagnostics, filtered node/edge counts and duplicate-safe edge resolution.
- 2026-07-24: Added regression tests for metadata preservation, parallel relationships, duplicate IDs, filtered relationships and filtered-source contacts.

## Blockers

None known for the scoped implementation. Dependency installation is required before runtime test/build verification.

## Evidence

- `npm install --no-package-lock --ignore-scripts --fetch-timeout=10000 --fetch-retries=0` completed successfully outside the sandbox; no `package-lock.json` was created.
- `npm run test` passed: 4 test files, 14 tests.
- `npm run build` passed: `tsc --noEmit` and the production esbuild completed successfully.
- Relevant implementation: `src/graph/graph-source.ts`, `src/graph/build-snapshot.ts`, `src/index/frontmatter.ts`, `src/bases/people-atlas-bases-view.ts`, `src/view/people-atlas-view.ts`.

These commands prove the current unit assertions and TypeScript/production bundle gate. They do not prove runtime behavior inside a live Obsidian vault or mobile UI behavior.

## Review

Verdict: pass.

Adversarial review checked the canonical-vs-visible source split, duplicate ID resolution, relationship edge identity, filtered endpoints, filtered-source contacts and propagation of hidden counts through `projectGraph()`. No critical or significant finding remains in P1.

Residual risk: relationship parsing is covered by the type/build path but does not yet have a dedicated Obsidian metadata-cache integration fixture. Create-event handling, adjacency deltas and the full diagnostic navigation panel remain owned by P2/P3 and are intentionally not part of this ticket.

## Retrospective

The important boundary was separating canonical relationship data from the Base's visible person projection. A first implementation handled filtered targets but missed contacts originating from filtered source people; the focused regression test exposed and corrected that case. Keeping relationship edges in an array instead of endpoint-keyed storage was necessary to preserve parallel relationship entities.
