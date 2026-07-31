Status: active
Created: 2026-07-25
Updated: 2026-07-30

# P3a — Safe note mutations and versioned plugin data

## Context

People Atlas currently parses Markdown notes and plugin settings but does not
provide user-invoked mutations for person or relationship notes. The existing
index and diagnostics establish stable identities, configured frontmatter
properties and lifecycle refreshes, but a write layer could still corrupt
unrelated frontmatter, create duplicate identities or leave a partially
updated note if validation and mutation are interleaved.

The v2 plan calls for safe mutations and versioned plugin data after P2. This
first bounded slice establishes the write and migration foundation. Person
merging and unresolved-link conversion are excluded until their cross-note
rewrite and recovery semantics are separately ratified.

## Scope

This specification governs:

- explicit creation of person and relationship notes;
- `@`-based person suggestions and explicit person-note creation from the
  editor;
- explicit editing of supported person and relationship properties;
- ending a relationship while retaining its note and history;
- validation before any write;
- preservation of unrelated frontmatter and Markdown body content;
- versioned plugin settings/data loading and migration.

It does not govern person merging, unresolved-link conversion, new graph
projection modes, renderer behavior or relationship-history storage outside
the relationship note itself.

## Draft normative contract

1. A mutation MUST be initiated by an explicit user action. Index refreshes,
   rendering and diagnostics MUST NOT write vault files implicitly.
2. Vault-note mutations MUST use Obsidian's file APIs and
   `FileManager.processFrontMatter()` for frontmatter edits. A mutation MUST
   preserve frontmatter properties it does not own and the complete Markdown
   body.
3. Validation MUST complete before the first mutation in an operation. An
   invalid operation MUST produce a user-visible error and MUST NOT leave a
   partial write.
4. Identity MUST follow the existing contract: an explicit `person_id` or
   `relationship_id` is authoritative; a normalized file-path fallback is
   used only when the explicit ID is absent. Display names and aliases MUST
   NOT be used as identity keys.
5. A mutation that would create or introduce an ambiguous explicit identity
   MUST be rejected and MUST leave all involved notes unchanged.
6. Supported fields MUST use the configured property names from
   `PeopleAtlasSettings`. Unknown properties MUST remain untouched.
7. Relationship `status` MUST remain optional and user-authored. The write
   layer MUST NOT infer or change `status` from `last_contact`. The first P3a
   slice supports changing status through ordinary relationship editing, but
   does not define a dedicated end action or a separate history note.
8. Plugin data MUST be loaded through a version-aware migration path. A
   successful migration MUST yield the current validated settings shape and
   persist only after validation succeeds. Unknown future versions MUST NOT be
   silently downgraded or overwritten.
9. A successful vault mutation MUST become visible through the existing
   metadata/vault lifecycle and `PersonIndex`; the write layer MUST NOT add a
   second graph or relationship store.
10. Mutation failures MUST preserve the original note/data when possible and
    report the source path and failure reason to the user.
11. The editor mention entrypoint MUST use an explicit `@` suggestion action.
    Typing an unknown name alone MUST NOT write a note. Selecting an existing
    person MUST replace the trigger text with a normal Markdown wikilink using
    the form `[[People/Name|@Name]]` (with the resolved target path).
12. When no existing person is selected, the suggestion list MUST offer a
    clearly labelled create action such as `Create person “Name” in People/`.
    Selecting that action MUST create the note through the same validated
    mutation boundary, assign the generated explicit `person_id`, and then
    insert the resulting wikilink.
13. Mention suggestions MUST be disabled in frontmatter, fenced code blocks
    and contexts that are not ordinary Markdown prose. Display names MAY be
    used for search and presentation only; target paths and stable IDs remain
    authoritative.

## Given/When/Then scenarios

### Preserve unrelated note content

Given a person note contains custom frontmatter and a Markdown body
When the user edits a configured People Atlas property
Then only the requested configured property changes and all other frontmatter
and body content remain unchanged.

### Reject invalid mutation before writing

Given a relationship edit contains an invalid date, incomplete endpoint-role
pair, invalid status or identity collision
When the user submits the edit
Then validation reports the error and neither the relationship note nor any
dependent note is changed.

### Create a relationship with explicit identity

Given two resolvable person references and a valid relationship payload
When the user confirms relationship creation
Then one relationship note is created with the configured properties and its
explicit or path-fallback identity is indexed by the existing `PersonIndex`.

### Resolve a known person mention

Given an existing person note and the user types `@` followed by a search term
in ordinary Markdown prose
When the user selects that person from the editor suggestions
Then only the trigger text is replaced with a wikilink of the form
`[[People/Name|@Name]]`, and no note is created.

### Create a person from an unknown mention

Given no existing person matches the typed name
When the user explicitly selects `Create person “Name” in People/`
Then a validated person note is created in the configured default `People/`
folder with a generated explicit `person_id`, and the trigger text is replaced
with its wikilink.

### Keep typing write-free

Given the user types an unknown `@` name but does not select a suggestion
When the editor remains open or the user dismisses the suggestions
Then no vault note is created or modified.

### Explicitly mark a relationship ended

Given an existing relationship note with metadata
When the user explicitly edits its optional status to `ended`
Then the note remains present with its existing identity and metadata, and
`last_contact` does not change the status automatically.

### Migrate plugin data

Given plugin data from a supported older schema version
When the plugin loads
Then migrations run in order, the result is validated against the current
settings contract, and the migrated data is persisted only after successful
validation.

### Protect unknown future plugin data

Given plugin data declares a newer schema version than this plugin supports
When the plugin loads
Then it does not overwrite or silently reinterpret that data and reports a
recoverable compatibility error.

## Acceptance criteria

- [ ] A single mutation boundary exists for supported person and relationship
      note writes.
- [ ] Editor `@` suggestions resolve known people to stable wikilinks and
      expose an explicit, clearly labelled create-person action for unknown
      names.
- [ ] Creation and editing use configured property names and preserve
      unrelated frontmatter and Markdown body content.
- [ ] Invalid values and identity collisions are rejected before mutation,
      with no partial-write path in the supported operation.
- [ ] Ordinary relationship editing supports an optional, manually authored
      status, does not infer status from `last_contact`, and retains unrelated
      relationship metadata.
- [ ] Plugin settings/data have an explicit migration registry and current
      schema validation, including safe handling of unsupported future
      versions.
- [ ] Successful mutations refresh through the existing index lifecycle and
      do not introduce a second source of truth.
- [ ] Mention suggestions are inactive in frontmatter, fenced code and other
      non-prose contexts; typing without selecting a suggestion is write-free.
- [ ] Pure validation/migration transformations and write failure paths have
      focused tests.
- [ ] `npm run test` and `npm run build` pass.

## Exclusions

- Person merge and duplicate-resolution mutations.
- Unresolved-link conversion and rewriting all inbound references.
- Relationship history as a separate versioned store.
- New projections, layouts, renderer interactions or mobile behavior.
- App-specific mention pills or custom editor decorations beyond the normal
  wikilink display.
- Live Obsidian/browser integration coverage beyond the focused seams needed
  for this ticket.

## Ratified decisions

1. **Migration failure behavior.** Keep the original plugin data untouched,
   load safe defaults in memory only, show a recoverable error and block writes
   until the data is repaired or the user explicitly accepts a reset.
