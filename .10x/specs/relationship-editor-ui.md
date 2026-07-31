Status: superseded
Created: 2026-07-25
Updated: 2026-07-30
Superseded-By: `.10x/specs/perspective-relationship-editor-templates.md`

# P3b — Relationship editor user interface

## Purpose

Expose the existing validated relationship mutation boundary through one
explicit, accessible Obsidian form. The form covers the smallest complete
create/edit workflow without moving relationship metadata onto person notes,
guessing unresolved identities, or coupling writes to rendering.

## Scope

This specification governs:

- one shared Obsidian modal for relationship creation and editing;
- a global create command;
- a create action associated with a selected real person in both standalone
  and Bases views;
- an edit command for the active relationship note;
- endpoint selection, path generation, configured relationship fields,
  validation feedback, confirmation, cancellation and post-save behavior.

It extends `.10x/specs/safe-mutations-and-versioned-data.md`; that specification
continues to govern identity, validation-before-write, configured property
names, preservation of unrelated note content, mutation failure safety and
index refresh.

## Normative contract

### Shared form and entrypoints

1. Relationship creation and editing MUST use one shared Obsidian `Modal`
   implementation and one form-state contract.
2. The plugin MUST register a global `Create relationship` command. It MUST
   open the create form without requiring an active People Atlas view.
3. Selecting a resolved person node in either the standalone or Bases atlas
   MUST expose an explicit `Create relationship` action. Invoking it MUST open
   the same create form with that person prefilled as Person A / `from`.
4. Ghost, ambiguous or otherwise unresolved nodes MUST NOT be offered as a
   resolved endpoint and MUST NOT be guessed.
5. The plugin MUST register an `Edit current relationship` command. It MUST
   edit only an active file that the canonical index recognizes as one
   relationship note. When the active file is not such a relationship, the
   command MUST make no write and MUST report that no editable relationship
   is active.
6. Editing MUST NOT require edge selection and MUST NOT introduce renderer
   context menus. Those interactions remain outside this P3b slice.

### Fields and identity

7. Person A / `from` and Person B / `to` MUST be required searchable selectors
   backed by canonical indexed people. Display names MAY label choices, but
   the selected reference MUST be stored using the resolved person note path
   or stable identity accepted by the existing mutation contract.
8. The form MUST expose the configured relationship properties supported by
   `AtlasMutationService`: optional `relationship_id`, preset provenance,
   relationship types, both endpoint roles, direction, closeness, `since`,
   `last_contact` and status.
   - Endpoint roles MUST be supplied as a pair or omitted as a pair.
   - Applying or synchronizing a preset changes only unsaved form values until
     the user explicitly saves.
   - Detaching a preset removes only its ID and preserves copied values.
9. Direction MUST default to `undirected` for a new relationship. Status,
   closeness, dates, types, paired endpoint roles, preset provenance and
   explicit relationship ID MUST remain optional.
   Status MUST remain user-authored and MUST NOT be inferred from
   `last_contact`.
10. Editing MUST initialize every supported field from the active indexed
    relationship and MUST leave fields the user did not change untouched.
11. The form MUST NOT merge people, create missing endpoint people, convert
    unresolved links, infer relationship types or create a separate history
    record.

### Relationship note path

12. After both create endpoints are selected, the form MUST propose:
    `People/Relationships/<Person A> - <Person B>.md`.
13. The two filename components MUST use the selected people’s display labels
    only for the human-readable filename and MUST be sanitized with the
    existing safe note-name rules. Display labels MUST NOT become graph
    identity keys.
14. The proposed create path MUST remain editable before confirmation.
15. If the destination exists, creation MUST fail visibly without overwriting,
    auto-renaming or appending an implicit numeric suffix. This preserves
    explicit review of parallel relationships and lets the user choose a
    distinct path.
16. The source path MUST be visible but read-only while editing. Renaming or
    moving an existing relationship note is not part of this slice.

### Confirmation and feedback

17. The form MUST have explicit `Save` and `Cancel` actions. Only `Save` MAY
    invoke `AtlasMutationService`.
18. Closing the modal, pressing Escape or choosing `Cancel` MUST write
    nothing.
19. `Save` MUST validate the complete form before the first vault write and
    MUST prevent repeated submission while its mutation is pending.
20. Validation or mutation failure MUST keep the form open, retain the
    entered values, identify the failure to the user and leave vault notes
    unchanged according to the mutation contract.
21. Successful creation MUST close the form and open the newly created
    relationship note in a normal workspace leaf.
22. Successful editing MUST close the form and leave the existing relationship
    note open.
23. The form MUST use associated labels, native focusable controls, a logical
    tab order and initial focus within the modal. Broader screen-reader,
    touch-gesture and renderer interaction work remains P5 scope.

## Scenarios

### Create from the global command

Given no People Atlas view is active
When the user invokes `Create relationship`
Then the shared form opens with empty endpoint selectors and no vault write
occurs before `Save`.

### Create from a selected person

Given a resolved person is selected in a standalone or Bases atlas
When the user invokes that person’s `Create relationship` action
Then the shared form opens with that person as Person A and Person B remains
for the user to select.

### Propose a reviewable relationship path

Given Alice and Bob are the selected endpoints
When both endpoint selections are complete
Then the create form proposes
`People/Relationships/Alice - Bob.md` and allows the user to edit it.

### Refuse an existing destination

Given the proposed relationship path already exists
When the user selects `Save`
Then the existing note is not overwritten or renamed, the form stays open and
the user is told to choose a distinct path.

### Cancel without writing

Given the user changed fields in the relationship form
When the user cancels, presses Escape or closes the modal
Then no relationship note is created or modified.

### Edit the active relationship

Given the active file is one canonical indexed relationship note
When the user invokes `Edit current relationship`
Then the shared form opens with the current supported fields and a read-only
source path.

### Reject an invalid save

Given the form contains a missing endpoint, invalid date, invalid closeness,
invalid status, unsafe path or identity collision
When the user selects `Save`
Then the form retains its values, displays the failure and no note is changed.

### Complete a successful save

Given a valid create or edit form
When the mutation service completes successfully
Then the modal closes; a created relationship note opens, while an edited
relationship remains open in its existing note.

## Acceptance criteria

- [ ] One modal and form-state contract serve create and edit.
- [ ] The global create command works without an active atlas.
- [ ] Resolved selected people in standalone and Bases expose create actions
      that prefill Person A; unresolved nodes never become guessed endpoints.
- [ ] The active-relationship edit command refuses non-relationship files
      without writing.
- [ ] All existing supported relationship fields round-trip through configured
      property names and optional status remains manual.
- [ ] Create proposes an editable
      `People/Relationships/<Person A> - <Person B>.md` path and never
      overwrites or silently renames an existing note.
- [ ] Edit shows a read-only source path and preserves unrelated frontmatter
      and body content.
- [ ] Save is the only write action; cancel, Escape and close are write-free.
- [ ] Invalid or failed saves keep form state and surface a useful error;
      pending saves cannot be submitted twice.
- [ ] Successful create opens the new note; successful edit keeps the existing
      note open.
- [ ] Focused tests cover path proposal/sanitization, entrypoint prefill,
      form-to-mutation mapping, cancellation, invalid/failing saves,
      duplicate submission and success behavior.
- [ ] `npm run test` and `npm run build` pass.

## Exclusions

- Relationship note rename/move.
- Person creation inside the relationship form.
- Person merge or unresolved-link conversion.
- Edge selection, renderer context menus, long press or mobile gestures.
- Dedicated relationship-end action or relationship-history store.
- Automatic status, follow-up or relationship-type inference.
- Bulk relationship editing.
- P5’s complete accessible/mobile renderer and browser-harness gate.

## Ratified decisions

1. **Shared form and create entrypoints.** The user approved one shared
   Obsidian form reachable through a command and an action on a selected
   person, with writes only after explicit `Save`.
2. **Storage location.** New relationship notes use
   `People/Relationships/<Person A> - <Person B>.md`.
3. **Edit entrypoint.** `Edit current relationship` operates on the active
   relationship note. The selected-person action creates and prefills that
   person, in both standalone and Bases.
4. **Completion behavior.** Invalid saves keep the form open, cancellation
   writes nothing, successful creation opens the new relationship note and
   successful editing closes the form on the existing note.
