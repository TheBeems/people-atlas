Status: active
Created: 2026-07-24
Updated: 2026-07-24

# Canonical graph source for standalone and Bases views

## Context

The standalone view currently builds a graph from `PersonIndex`, while the Bases adapter builds a separate raw snapshot from query entries and drops all explicit relationship notes. That means the two views do not project the same domain graph.

The intended product is Bases-native, but rich relationship notes must remain Markdown-first and must not depend on whether a relationship note happens to be included in a Base query.

## Decision

`PersonIndex` is the canonical vault-backed source for people and relationship records. Both standalone and Bases views use the same graph-building and projection contract.

Bases query results select the visible person population. The Bases adapter may provide the selected people and their configured property mappings, but rich relationship records come from the canonical index. A relationship edge is visible in that Base only when both resolved endpoints belong to the selected person population. Relationships to filtered-out people remain represented as hidden/diagnostic projection data and must not be mistaken for unresolved links.

Relationship records are independent entities. Their identity is an explicit `relationship_id` when present, with the relationship-note path as a fallback for legacy notes. Multiple relationship records between the same pair are preserved as separate edges. Duplicate person IDs are never resolved by first-match semantics: references to an ambiguous ID remain unresolved and produce a diagnostic.

The relationship contract supports:

- `direction`: `undirected` or `source-to-target`; absent values default to `undirected`;
- `types`: one or more relationship types;
- optional `from_role` and `to_role` values that describe each endpoint's
  explicit perspective; valid plugin writes define both or neither;
- optional `relationship_preset` provenance. Presets copy their semantic
  values into the relationship note and never replace it as source of truth;
- `closeness`: optional bounded value;
- `since` and `last_contact`: optional date values;
- `status`: `active`, `dormant`, or `ended`.

## Consequences

- Standalone and Bases views share relationship semantics and rich relationship metadata.
- Base filters do not redefine relationship storage or require relationship notes to be selected explicitly.
- Base-specific property mappings remain useful for the selected person records, while relationship resolution uses stable IDs and canonical file paths.
- Graph projection needs explicit visibility accounting so filtered endpoints are distinguishable from unresolved endpoints.
- Existing notes without `relationship_id` remain supported, but their fallback identity changes if the relationship note is renamed.

## Alternatives considered

- **Build the Bases graph only from `BasesEntry` values.** Rejected because it loses rich relationship notes whenever the Base query excludes them and diverges from standalone behavior.
- **Resolve duplicate person IDs by first match.** Rejected because it silently assigns a human relationship to an arbitrary note and violates the no-implicit-merge rule.
- **Collapse all edges by endpoint pair and type.** Rejected because different relationship entities and directions must remain distinguishable.
- **Resolve roles live from a preset.** Rejected because preset edits or missing
  plugin data must not silently change the meaning of existing Markdown notes.
