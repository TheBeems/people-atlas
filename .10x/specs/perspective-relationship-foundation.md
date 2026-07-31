Status: active
Created: 2026-07-30
Updated: 2026-07-30

# Perspective-oriented relationship foundation

## Purpose

Remove relationship direction as a product and persistence concept, introduce
one explicit `My person` perspective anchor, and migrate plugin settings
without silently rewriting relationship notes.

This specification governs the domain, settings, parser, mutation, graph and
basic renderer foundation. The user-facing create/edit/template workflow is
governed separately by
`.10x/specs/perspective-relationship-editor-templates.md`.

## Scope

This specification governs:

- the direction-free relationship domain and graph contracts;
- the stable meaning of stored `from`/`to` endpoint slots;
- paired endpoint-role validation and neutral roleless descriptions;
- removal of direction parsing, diagnostics, mutation and settings surfaces;
- migration of valid plugin settings from schema v4 to v5;
- non-destructive handling of legacy relationship-note direction properties;
- the `My person` settings value, resolution and failure behavior;
- initial-center fallback without coupling identity to navigation;
- equivalent full-build and incremental graph behavior after field removal.

## Normative contract

### Direction-free relationship data

1. The current TypeScript domain MUST NOT define `RelationshipDirection`.
2. `RelationshipRecord`, `AtlasEdge`, form/mutation inputs, preset values,
   synchronization values and serialized current settings MUST NOT contain a
   `direction` member.
3. Current settings MUST NOT contain or expose `directionProperty`.
4. The index MUST NOT parse a direction property from relationship notes.
   `source-to-target`, `undirected` and any other legacy value MUST have no
   effect on relationship resolution, graph projection or presentation.
5. The diagnostic contract MUST NOT contain or emit
   `invalid-relationship-direction`.
6. New relationship notes and explicit relationship updates MUST NOT write,
   normalize or remove a legacy direction property.
7. Stored `from` and `to` remain required endpoint slots. They MUST associate
   deterministically with `from_role` and `to_role`, but MUST NOT imply an
   arrow, hierarchy, traversal order, ownership or chronology.
8. Full snapshot construction and incremental graph deltas MUST treat a rich
   relationship as incident to both resolved endpoints and MUST remain
   equivalent without synthesizing a replacement direction value.
9. Inferred linked-person edges MUST use the same direction-free edge shape.

### Roles and relationship descriptions

10. Valid plugin writes MUST provide both endpoint roles or neither. Existing
    one-sided role metadata MUST remain diagnosable as
    `incomplete-relationship-roles`; the plugin MUST NOT guess its missing
    partner.
11. When both roles exist, a relationship description MUST select the role
    attached to the currently described endpoint and format it with the
    configured `{role}` / `{person}` format.
12. When both roles do not exist, the relationship description MUST be the
    neutral `Connected to <counterpart>`. It MUST NOT expose Incoming,
    Outgoing, source, target, from or to terminology.
13. Relationship types, closeness, dates and explicit status MAY accompany
    the description but MUST NOT be interpreted as direction.

### Plugin settings migration

14. `PLUGIN_DATA_SCHEMA_VERSION` MUST advance once from the current v4 value
    to v5.
15. The v4-to-v5 migration MUST accept the previously valid v4 settings shape,
    including templates with `direction`, before validating the migrated v5
    shape.
16. The migration MUST:
    - remove `directionProperty` from the current settings result;
    - remove only `direction` from every stored relationship template;
    - preserve template ID, name, order, types, `fromRole` and `toRole`;
    - add `myPersonId` as an empty string when absent;
    - retain all other valid settings, including the navigation-only
      `defaultCenterPersonId` and saved view state.
17. A migrated settings object MUST be persisted only after the complete v5
    result validates successfully.
18. Invalid supported-version data MUST retain the existing safe behavior:
    load safe in-memory defaults, report a recoverable error and disable
    writes rather than overwriting the stored value.
19. A future schema version MUST remain read-only and MUST NOT be downgraded.
20. A migrated template MUST continue to match and synchronize its linked
    relationships using only types and both endpoint roles.

### Legacy relationship-note direction data

21. Existing relationship-note frontmatter named `direction`, or named by the
    former configured direction-property setting, MUST be treated as unowned
    data after migration.
22. Indexing a note containing that property MUST neither emit a direction
    diagnostic nor alter the note.
23. Updating another supported relationship field MUST preserve the legacy
    direction property's value through Obsidian's normal frontmatter
    processing, just like any other unrelated property.
24. Plugin load, settings migration, indexing and rendering MUST NOT perform a
    vault-wide or per-note cleanup write.

### My person identity

25. Current settings MUST contain optional `myPersonId`, stored as an explicit
    `person_id` string or the empty string.
26. `My person` MUST resolve only when the canonical index contains exactly
    one person with that explicit ID. A display name, alias, filename, path,
    selected node, active note or graph center MUST NOT serve as fallback
    identity.
27. The settings surface MUST let the user choose `None` or one canonical
    person with a unique explicit `person_id`. Choices MUST be labelled with
    enough name/path context to distinguish people without making that label
    authoritative.
28. A person without an explicit ID or with a duplicate ID MUST NOT be offered
    as a valid My person choice.
29. If a stored `myPersonId` becomes missing or ambiguous, People Atlas MUST:
    - preserve the stored value until the user changes it;
    - show a recoverable settings warning;
    - disable only My person perspective behavior;
    - use neutral relationship labels/defaults; and
    - continue to avoid guessing or merging people.
30. Clearing My person MUST NOT edit relationship notes, templates, endpoint
    order, roles or saved view state.

### Navigation boundary

31. My person is semantic identity; graph center is navigation state. Selecting
    or centering another node MUST NOT change `myPersonId`.
32. An explicit view/Bases center, saved center history or explicit
    navigation-only default center MUST retain its existing precedence.
33. When no explicit navigational center is available, a uniquely resolved My
    person MUST initialize the view's configured center.
34. Setting or changing My person MUST NOT forcibly recenter an already open
    view or overwrite its persisted center history.
35. Standalone and Bases views MUST follow the same identity-versus-navigation
    boundary, while retaining their existing view-specific persistence
    contracts.

## Given/When/Then scenarios

### Parse a legacy directional note

Given a relationship note contains `direction: source-to-target`

When the v5 plugin indexes and projects it

Then the relationship resolves without a direction field or direction
diagnostic, the note is not modified, and a roleless description is
`Connected to <counterpart>`.

### Preserve legacy YAML during an explicit edit

Given a legacy relationship note contains a direction property and unrelated
custom frontmatter

When the user explicitly changes only its status

Then status changes through the mutation boundary while direction, custom
frontmatter and Markdown body remain untouched.

### Migrate valid v4 templates

Given valid v4 settings contain ordered templates with types, paired roles and
direction

When settings migrate to v5

Then every template retains its identity, name, order, types and roles,
direction disappears from the validated result, `myPersonId` is empty, and
the result persists only after validation.

### Reject an unsafe migration

Given supported-version stored settings cannot produce a valid v5 shape

When the plugin loads

Then stored data remains untouched, writes are disabled and a recoverable
error is reported.

### Resolve My person by stable identity

Given exactly one indexed person has `person_id: me-123` and settings store
`myPersonId: me-123`

When perspective behavior is requested

Then that canonical person is My person regardless of display name, selected
node or current graph center.

### Refuse an ambiguous My person

Given two person notes contain the stored My person ID

When People Atlas loads

Then neither person is selected as My person, settings show a warning and
ordinary direction-free relationship behavior remains available.

### Initialize but do not couple the center

Given My person resolves and a new view has no explicit or saved navigation
center

When the view initializes and the user later centers Alice

Then the view initially centers My person, later centers Alice, and My person
identity remains unchanged.

### Keep full and incremental graphs equivalent

Given a direction-free rich relationship is added, edited and removed

When each state is produced once by full snapshot construction and once by
incremental deltas

Then the snapshots preserve the same edge identity, endpoints, roles and rich
metadata without a direction placeholder.

## Acceptance criteria

- [ ] No current domain, graph, parser, mutation, form, settings, template or
      synchronization type requires a direction value.
- [ ] Direction settings/UI and invalid-direction diagnostics are absent.
- [ ] Graph construction and deltas preserve endpoint/role semantics and
      equality without synthesizing direction.
- [ ] Complete roles render endpoint-relative text; roleless/incomplete
      relationships use only the neutral Connected fallback.
- [ ] Valid v4 settings migrate once to v5, preserving every template field
      except direction and adding empty `myPersonId`.
- [ ] Invalid or future settings retain existing safe read-only failure
      behavior.
- [ ] Legacy relationship direction frontmatter is ignored and preserved,
      with no load-time, migration-time or edit-time cleanup.
- [ ] My person selection uses one unique explicit `person_id`; missing,
      ambiguous and cleared states never guess.
- [ ] Explicit center configuration/history remains navigation authority; My
      person initializes only an otherwise unconfigured view and never follows
      later center changes.
- [ ] Focused tests cover v4-to-v5 migration, failed/future migration,
      template preservation, legacy-note parsing/update preservation, My
      person resolution failures, center fallback and graph equivalence.
- [ ] Direction-specific fixtures and assertions are replaced with
      direction-free assertions without weakening identity, role, migration,
      preservation or graph-equivalence protections.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Error behavior

- A missing or ambiguous My person disables only perspective defaults and
  reports a recoverable warning; it does not make a display label authoritative.
- A malformed supported-version settings object remains write-disabled under
  the existing migration safety contract.
- An incomplete role pair remains diagnostic and neutral; its missing value is
  never inferred from type, gender, person identity or former direction.
- A legacy direction value, including an invalid value, is ignored rather
  than reinterpreted or normalized.

## Exclusions

- Deleting legacy direction frontmatter from vault notes.
- A bulk cleanup command for legacy properties.
- Reordering or rewriting existing relationship endpoints or roles.
- Reinterpreting `defaultCenterPersonId` as personal identity.
- Requiring every relationship to contain My person.
- Changing relationship-note identity, paths, status/date semantics or
  canonical standalone/Bases ownership.
- The relationship modal hierarchy, template empty state and self-first
  create experience, which belong to the editor/template specification.
- Contact moments, follow-up, profile fields, photo rendering or graph-edge
  selection.

## Ratified and record-backed decisions

1. User-ratified on 2026-07-30: remove direction completely from People Atlas
   behavior and current stored plugin settings.
2. User-ratified on 2026-07-30: preserve legacy direction frontmatter as
   ignored, unowned YAML rather than deleting it automatically.
3. User-ratified on 2026-07-30: My person is one stable explicit person ID,
   independent of current graph center; missing identity falls back to neutral
   behavior without guessing.
4. User-ratified on 2026-07-30: relationships are self-first but not self-only.
5. Record-backed: current settings schema is v4 and current templates contain
   ID, name, types, direction, `fromRole` and `toRole`.
6. Record-backed: direction does not control graph traversal or layout; the
   renderer's legacy roleless description is its only observed downstream
   behavioral branch.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/generated-graph-index-invariants.md`
- `.10x/specs/projection-modes-layout-state.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
