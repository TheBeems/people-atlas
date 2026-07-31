Status: active
Created: 2026-07-24
Updated: 2026-07-30

# Canonical graph source and relationship projection

## Scope

Unify the domain graph consumed by the standalone and Bases views without implementing relationship editing, person merging, worker layout, or the broader diagnostic panel.

## Normative contract

1. The vault index MUST be the canonical source for all parsed people and rich relationship notes.
2. Standalone and Bases views MUST use the same graph snapshot builder and the same projection contract.
3. A Bases query MUST select the visible person population; it MUST NOT be required to include rich relationship notes for those notes to participate in projection.
4. Bases property mappings MAY override the person fields supplied for selected entries, but MUST NOT create a second relationship store.
5. A rich relationship MUST be keyed by its explicit `relationship_id` when present, otherwise by its normalized note path.
6. Multiple rich relationships between the same people MUST remain separate graph edges.
7. A duplicate `person_id` MUST produce a diagnostic and MUST NOT resolve references by first match.
8. A rich relationship MUST follow the direction-free endpoint and role
   contract in `.10x/specs/perspective-relationship-foundation.md`; stored
   endpoint order MUST NOT change graph adjacency or projection semantics.
9. Relationship endpoints MUST resolve by explicit person ID or resolved file path. Display names and aliases MUST NOT be authoritative identity keys.
10. A relationship whose endpoints resolve but fall outside a Base's selected person population MUST be classified as hidden/filtered projection data, not as an unresolved endpoint.
11. Unresolved wikilinks MUST remain ghost/diagnostic data and MUST NOT be guessed into person nodes.

## Given/When/Then scenarios

### Shared rich relationship source

Given two person notes and one rich relationship note exist in the vault
When the standalone view and a Base containing both people build their graph
Then both snapshots contain the same relationship edge identity, endpoints,
paired roles, types, dates, closeness and status without a direction field.

### Base query excludes relationship notes

Given a Base query returns two person notes but excludes all relationship notes
When the Bases view updates
Then the view still receives rich relationship notes from the canonical index and renders edges whose endpoints are selected.

### Filtered endpoint

Given a relationship resolves to a real person that is not selected by the Base
When the Bases projection is built
Then the edge is excluded from visible edges, and the projection exposes that the endpoint was filtered rather than unresolved.

### Duplicate person identity

Given two person notes declare the same explicit `person_id`
When a relationship references that ID
Then the relationship is not attached to either person arbitrarily and a duplicate-identity diagnostic names both notes.

### Parallel relationships

Given two relationship notes connect the same pair with different relationship IDs
When the graph is built
Then both relationship entities remain separate edges, even when their endpoints and types are otherwise equal.

### Legacy relationship identity

Given a relationship note has no `relationship_id`
When it is parsed
Then its normalized path is used as a fallback identity and the relationship remains supported as legacy data.

## Acceptance criteria

- [ ] A single canonical graph service/source is used by both views.
- [ ] Bases projection combines selected person entries with relationship records from `PersonIndex`.
- [ ] Relationship records include explicit/fallback identity, endpoints,
      paired roles, types, closeness, since, last contact and status without a
      direction field.
- [ ] Duplicate person IDs do not use first-match resolution.
- [ ] Multiple relationship entities between one pair are preserved.
- [ ] Filtered endpoints are distinguishable from unresolved endpoints in the projection contract.
- [ ] Pure graph and identity transformations have focused unit tests.
- [ ] Existing unresolved-link and hop-projection behavior remains covered.

## Exclusions

- Relationship/person creation or editing.
- Person merge workflow.
- Web Worker physics or new layout strategies.
- Full diagnostics navigation UI.
- Mobile gesture expansion.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-foundation.md`
