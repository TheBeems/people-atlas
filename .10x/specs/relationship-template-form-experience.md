Status: superseded
Created: 2026-07-30
Updated: 2026-07-30
Superseded-By: `.10x/specs/perspective-relationship-editor-templates.md`

# UX2 — Relationship templates and form hierarchy

## Purpose

Make relationship templates understandable at the point of use and reduce the
relationship editor's cognitive load without changing the durable
relationship-note contract.

The current label `Relationship preset` and empty option `Not linked` expose
an implementation concept but do not explain where templates are configured
or that their values are copied into the relationship note. The modal also
renders every field in one sequence and rebuilds the form after template
changes, which can move focus unexpectedly.

This specification preserves the existing
`relationship_preset`/role/type/direction data model and safe mutation
behavior. It changes user-facing terminology, empty-state guidance,
information hierarchy and local form updates.

## Scope

This specification governs:

- user-facing `Relationship template` terminology in the relationship form,
  People Atlas settings, template editor, synchronization preview and
  documentation;
- an explanatory empty state and a direct `Create template` route from the
  relationship form;
- exact apply, detach, modified, missing and bulk-update messaging;
- `People`, `Relationship`, `Context` and `Advanced` form sections;
- focus-preserving template updates and validation disclosure;
- responsive, accessible control grouping.

Internal TypeScript names and the configured persisted property default
`relationship_preset` MAY remain named `preset` for compatibility and to
avoid a data migration with no user value.

## Normative contract

### Terminology and compatibility

1. User-facing product copy MUST use `Relationship template`, not
   `Relationship preset`, except when showing the literal stored property
   name for diagnostics or configuration.
2. The default stored property MUST remain `relationship_preset`; existing
   settings, notes, preset IDs and copied metadata MUST remain compatible.
3. Settings MUST label the configured property
   `Relationship template property` and explain that it stores an optional
   template ID. Renaming UI copy MUST NOT rename a user's property.
4. A template remains input convenience, not a live dependency. Applying it
   copies only:
   - relationship types;
   - Person A role;
   - Person B role; and
   - direction.
5. Template apply/reapply MUST preserve endpoints, note path,
   `relationship_id`, closeness, `since`, `last_contact`, status and unrelated
   frontmatter.

### Empty and unlinked states

6. The empty select option MUST read
   `No template — enter values manually`, not `Not linked`.
7. When no templates are configured, the form MUST show:
   - `No relationship templates yet`;
   - a short explanation that manual values can still be entered;
   - a short explanation that templates copy repeatable type/role/direction
     values; and
   - a `Create template` action.
8. `Create template` MUST open the existing validated template-editing flow
   without discarding or closing the relationship form.
9. After successful template creation, the relationship form MUST retain all
   unsaved values and refresh its available-template choices. The new
   template MUST NOT be applied until the user selects it.
10. If plugin settings are read-only because stored data is invalid or from a
    future schema, template creation MUST be disabled with a recoverable
    explanation. Manual relationship entry MUST remain available if vault
    writes themselves are allowed.

### Apply, detach and synchronization language

11. Selecting a template MUST copy its current values into the unsaved form
    and store its stable template ID in form state. No vault note changes
    before `Save`.
12. Selecting `No template — enter values manually` MUST remove only the
    unsaved template ID and retain the copied type/role/direction values.
13. The form MUST report one of four states in user language:
    - no template selected; values are stored directly on the note;
    - copied values match the selected template;
    - copied values differ from the selected template; or
    - the stored template is unavailable; copied values remain editable.
14. When copied values differ, the explicit action MUST read
    `Apply latest template values`. It updates only the unsaved
    template-owned fields. `Save` remains the only vault write.
15. Settings-level bulk updates MUST continue to preview exact affected note
    paths and before/after template-owned values, require explicit
    confirmation, reject stale previews, preserve unrelated frontmatter and
    stop/report partial failure. User-facing copy calls this
    `Update linked relationships from template`.
16. Deleting a template MUST continue to leave copied values in relationship
    notes. Confirmation copy MUST state that the template reference becomes
    unavailable but relationship meaning is not erased.

### Form hierarchy

17. The shared create/edit form MUST present these sections in order:

    1. `People`
       - Person A;
       - Person B.
    2. `Relationship`
       - Relationship template;
       - relationship types;
       - Person A role;
       - Person B role;
       - direction.
    3. `Context`
       - closeness;
       - since;
       - last contact;
       - status.
    4. `Advanced`
       - create/edit note path;
       - relationship ID.

18. `People`, `Relationship` and `Context` MUST be visible field groups.
    `Advanced` MAY be collapsed by default but MUST use a native, keyboard-
    accessible disclosure.
19. The create destination MUST remain reviewable before save. A collapsed
    `Advanced` summary MUST show the proposed destination path without
    requiring the disclosure to be opened.
20. If validation fails for a field inside `Advanced`, the disclosure MUST
    open and focus or associate the error with the invalid field.
21. Editing keeps the source path read-only. This UX contract does not add
    relationship-note rename or move behavior.
22. Technical help text MUST explain stable ID/path behavior without making
    those fields prerequisites for ordinary template/manual entry.

### Stable form state and accessibility

23. Selecting, detaching, creating or reapplying a template MUST update only
    the affected controls and template status. It MUST NOT replace the whole
    form DOM.
24. Keyboard focus MUST remain on the initiating control after a template
    state update unless a validation error is explicitly focused.
25. Unsaved values, scroll position, endpoint selections, manual path edits
    and the open/closed `Advanced` state MUST survive template choice
    refreshes.
26. Each section MUST use a semantic `fieldset`/`legend` or equivalent native
    grouping, associated labels, descriptions referenced through
    `aria-describedby`, logical source order and the modal's owning
    `Document`.
27. On narrow/mobile surfaces the sections MUST reflow to one column without
    horizontal scrolling. Save/Cancel remain reachable and are not hidden
    inside `Advanced`.

## Scenarios

### Understand an empty installation

Given no relationship templates are configured
When the relationship form opens
Then the user can continue manually, sees what a template copies and can open
`Create template` without losing form state.

### Create but do not silently apply

Given the user has entered endpoints and context values
When they create a template from the form
Then their form is unchanged, the template appears in the selector and no
template-owned value changes until they select it.

### Detach while preserving meaning

Given a relationship uses a template and contains copied roles/types
When the user selects `No template — enter values manually`
Then only the template ID is removed from unsaved state and all copied values
remain.

### Reapply without writing

Given copied values differ from the current template
When the user chooses `Apply latest template values`
Then only unsaved type/role/direction values change and the note remains
untouched until `Save`.

### Preserve focus

Given the template selector has keyboard focus
When the user changes its value
Then dependent controls and status update without moving focus to Person A or
recreating the form.

## Acceptance criteria

- [ ] All ordinary UI and documentation use `Relationship template`; stored
      `relationship_preset` data remains compatible.
- [ ] The no-template option and zero-template empty state explain manual
      entry and copy-not-live behavior.
- [ ] A direct Create template action preserves the relationship form and
      never auto-applies the new template.
- [ ] Apply, detach, modified, missing and bulk-update states preserve the
      existing explicit copy/sync contract.
- [ ] The modal is divided into the four ratified sections with destination
      visibility and validation-aware `Advanced` disclosure.
- [ ] Template state changes update controls in place and preserve focus,
      values, manual paths, scroll and disclosure state.
- [ ] Standalone create, selected-person create and active/direct edit
      entrypoints use the same revised form.
- [ ] Pure tests preserve template-owned field boundaries and existing
      apply/detach/sync safety.
- [ ] Browser tests cover empty state, in-form template creation, keyboard
      focus, disclosure behavior, narrow viewport and save/cancel.
- [ ] Existing relationship note fixtures require no migration and round-trip
      unchanged.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Exclusions

- Renaming the persisted `relationship_preset` property automatically.
- Live template dependencies or background propagation.
- Applying a newly created template without explicit selection.
- Adding relationship types/roles inferred from gender, name, family
  structure or graph position.
- Relationship-note rename/move, bulk edit beyond the existing safe template
  update flow, or edge selection.
- A broad application-wide localization framework.

## Ratified decisions

1. The user-facing term is `Relationship template` while persisted
   compatibility remains `relationship_preset`.
2. Templates continue to copy explicit metadata and never become live
   semantic dependencies.
3. The relationship form is organized into `People`, `Relationship`,
   `Context` and `Advanced`.

## References

- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/specs/relationship-editor-ui.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-25-relationship-editor-ui.md`
- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/settings/relationship-presets.ts`
- `src/settings/relationship-preset-sync.ts`
- `src/settings/settings-tab.ts`
