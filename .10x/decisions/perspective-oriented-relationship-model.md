Status: active
Created: 2026-07-30
Updated: 2026-07-30

# Perspective-oriented canonical relationship model

## Context

People Atlas is primarily used to map a person's social connections from
their own perspective. The implemented relationship contract nevertheless
stores a separate `direction` value in every domain edge, exposes it in the
editor and templates, and falls back to `Incoming` or `Outgoing` text when
endpoint roles are absent.

Source inspection on 2026-07-30 found no direction-dependent graph traversal,
projection, layout or relationship resolution. Direction is transported
through settings, parsing, graph records, mutations, templates and tests, but
its only observed product-semantic branch after graph construction is the
roleless renderer description. Explicit `from_role` and `to_role` metadata
already expresses the useful endpoint-relative meaning.

The user explicitly chose a perspective-oriented experience, approved a
stable `My person` identity, retained relationships between two other people,
removed all direction semantics, and selected a non-destructive treatment of
legacy `direction` frontmatter.

This decision supersedes
`.10x/decisions/canonical-graph-source.md`. It carries forward that record's
canonical source, identity, projection and independent-relationship
decisions, while replacing its directional relationship contract.

## Decision

`PersonIndex` remains the canonical vault-backed source for people and
relationship records. Standalone and Bases views continue to consume the same
graph-building and projection contract. Bases results select the visible
person population; they do not create a second relationship store.

Relationship records remain independent entities. An explicit
`relationship_id` is authoritative, with the normalized relationship-note
path as fallback. Parallel relationship records remain separate. Duplicate
person IDs never resolve by first match, and unresolved links remain
diagnostic or ghost data rather than guessed people.

Relationships have no direction concept:

- `RelationshipDirection`, `direction`, `directionProperty`,
  `source-to-target`, and the invalid-direction diagnostic are not part of the
  current domain, settings, mutation, graph, renderer or template contracts;
- stored `from` and `to` references remain stable endpoint slots for
  serialization, identity resolution and association with `from_role` and
  `to_role`; they do not imply an arrow, ownership, chronology or graph
  traversal direction;
- valid plugin writes provide both endpoint roles or neither;
- complete roles provide endpoint-relative meaning; a roleless relationship
  uses the neutral description `Connected to <counterpart>`;
- relationship types, closeness, dates and status remain explicit metadata
  and do not create implicit direction.

People Atlas gains an optional `My person` setting stored as one explicit
`person_id`. A usable value must resolve to exactly one canonical indexed
person. Display name, note title, path, selected node and current graph center
must never be used to guess this identity.

`My person` is a semantic perspective anchor, not a relationship invariant:

- new relationship flows prefer My person as the first endpoint when it
  resolves uniquely;
- a create action on another selected person prefills My person first and the
  selected person second;
- both endpoints remain editable, so relationships between two other people
  remain supported;
- editing never swaps stored endpoints or roles because My person changes;
- changing or navigating the graph center never changes My person;
- when no explicit navigation center is configured, a uniquely resolved My
  person may initialize the graph center without becoming coupled to later
  center changes.

Relationship templates remain input convenience rather than live
dependencies. Applying a template copies relationship types and the two
endpoint roles into the relationship note and retains
`relationship_preset` as provenance. Template edits affect existing notes
only through the existing explicit reapply or reviewed bulk-update flows.

The plugin settings schema migrates existing valid v4 data to the new
direction-free shape:

- `directionProperty` leaves the current settings contract;
- each stored template loses only its `direction` member;
- template identity, order, types and paired roles are preserved;
- `myPersonId` is added empty and is never inferred from display names,
  current center or the existing navigation-only default-center setting.

Legacy relationship-note `direction` properties are no longer parsed,
validated, rendered or written. They remain untouched as unowned frontmatter
during ordinary explicit relationship edits. No automatic or bulk vault-note
cleanup is part of this decision.

The remaining rich relationship contract is unchanged: one or more optional
types, optional paired roles, optional closeness, optional `since` and
`last_contact`, and optional user-authored `active`, `dormant` or `ended`
status. Preset provenance and rich metadata remain on relationship notes, not
person notes.

## Consequences

- Users no longer have to decide whether a social relationship is directed.
- Endpoint roles and actual person names carry the relationship perspective.
- Graph algorithms have a smaller contract and cannot accidentally attach
  meaning to storage order.
- A relationship that previously relied only on `source-to-target` loses its
  Incoming/Outgoing presentation and becomes neutral until the user adds both
  endpoint roles.
- Existing vault notes are not rewritten merely because the plugin stops
  owning one property. Users may still see old `direction` YAML in Markdown.
- Existing valid template settings require one explicit, tested settings
  migration, but relationship notes require no migration write.
- `My person` improves the common self-centered workflow without forbidding
  family, colleague or other third-party network mapping.
- The existing default-center setting remains navigation state and is not
  silently reinterpreted as personal identity.

## Alternatives considered

- **Keep direction but hide it under Advanced.** Rejected because it preserves
  a second semantic mechanism that the graph does not use and most social
  relationships do not need.
- **Use the current or selected graph center as My person.** Rejected because
  navigation changes frequently and would make labels, defaults and template
  meaning unstable.
- **Require every relationship to include My person.** Rejected because a
  social atlas also needs relationships among family, friends and colleagues.
- **Infer My person from the default center, note title or display name.**
  Rejected because those values are not stable identity authority and may
  point to someone other than the user.
- **Make templates live dependencies.** Rejected because later settings
  changes would silently alter the meaning of independent Markdown notes.
- **Delete legacy direction frontmatter during migration.** Rejected because
  loading plugin settings must not trigger broad vault writes and because
  explicit, reviewable mutations are a project invariant.
- **Collapse parallel edges after direction removal.** Rejected because each
  relationship note remains an independent entity with its own identity and
  metadata.

## References

- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
