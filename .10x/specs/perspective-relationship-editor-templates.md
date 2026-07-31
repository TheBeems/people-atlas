Status: active
Created: 2026-07-30
Updated: 2026-07-31

# Perspective-oriented relationship editor and templates

## Purpose

Provide one safe create/edit relationship workflow that starts from My person
when available, remains usable for relationships between any two people, and
explains templates as copied role/type values without exposing direction or
storage-slot jargon.

This specification supersedes:

- `.10x/specs/relationship-editor-ui.md`;
- `.10x/specs/relationship-template-form-experience.md`.

It extends:

- `.10x/specs/perspective-relationship-foundation.md`;
- `.10x/specs/safe-mutations-and-versioned-data.md`.

`.10x/specs/simple-relationship-automation.md` further specializes this
contract for explicit Parent, Child and Sibling choices plus presentation-only
gendered family terms.

## Scope

This specification governs:

- one shared relationship create/edit modal and its entrypoints;
- self-first endpoint prefilling with neutral fallback;
- editable endpoint slots and relationships between two other people;
- dynamic person/role labels without endpoint reordering;
- explicit simple-relationship role-pair automation;
- relationship template terminology, creation, copied-value lifecycle and
  safe bulk update language;
- the People, Relationship, Context and Advanced form hierarchy;
- path proposal, validation, confirmation, cancellation and success behavior;
- stable DOM, focus, disclosure and responsive behavior.

## Normative contract

### Shared form and entrypoints

1. Relationship creation and editing MUST use one shared Obsidian `Modal`
   implementation and one form-state contract.
2. The global `Create relationship` command MUST work without an active People
   Atlas view.
3. A resolved canonical person selected in standalone or Bases MUST expose the
   same `Create relationship` workflow.
4. `Edit current relationship` MUST edit only an active file recognized by the
   canonical index as one relationship note. Direct row edit actions MUST
   reuse the same path-based editor entrypoint when implemented.
5. Ghost, ambiguous and otherwise unresolved nodes MUST NOT become resolved
   endpoints through their display labels.
6. Edge selection, graph context menus and a second mutation path MUST NOT be
   prerequisites for create or edit.

### Self-first endpoint defaults

7. If My person resolves uniquely, global creation MUST prefill it as the
   first endpoint and leave the second endpoint empty.
8. If My person resolves uniquely and a different canonical person starts the
   flow, creation MUST prefill My person first and the selected person second.
9. If the selected person is My person, creation MUST prefill My person first
   and leave the second endpoint empty.
10. If My person is unset, missing or ambiguous, global creation MUST start
    with both endpoints empty; selected-person creation MUST prefill only that
    selected person as the first endpoint.
11. Both endpoint selectors MUST remain editable canonical-person selectors.
    The user MUST be able to replace either prefill and create a relationship
    between two people who are not My person.
12. My person is a default, not a validation requirement. Saving MUST NOT fail
    merely because neither endpoint is My person.
13. Editing MUST preserve the stored first/`from` and second/`to` endpoint
    slots. Opening a relationship, changing My person or centering another
    graph node MUST NOT reorder endpoints or swap their roles.

### Endpoint identity and labels

14. Endpoint selectors MUST store references accepted by the canonical
    mutation contract. Display names MAY label choices and filenames but MUST
    NOT become identity keys.
15. The UI MUST NOT describe endpoint order as direction. It MUST NOT show
    source, target, Incoming, Outgoing or arrow semantics.
16. Once selected, endpoint and role controls MUST use the actual person's
    display label. When an endpoint is the uniquely resolved My person, its
    role label MUST read `My role`; the counterpart role label MUST include
    that person's display name.
17. When neither endpoint is My person, role labels MUST include both selected
    people's display names. Before a person is selected, neutral
    `First person` / `Second person` labels MAY be used.
18. Label changes MUST NOT recreate the form, move focus or alter the selected
    endpoint.
19. Valid plugin writes MUST define both endpoint roles or neither. People
    Atlas MUST NOT infer that a relationship or stored role exists from
    gender, pronouns, relationship type, display name, graph position or My
    person identity. The user's explicit Parent, Child or Sibling choice MAY
    fill the exact canonical role pair, and gender MAY refine only its
    presentation, as governed by
    `.10x/specs/simple-relationship-automation.md`.

### Supported fields and hierarchy

20. The shared form MUST expose the direction-free relationship contract:
    optional `relationship_id`, optional `relationship_preset` provenance,
    relationship types, paired endpoint roles, closeness, `since`,
    `last_contact` and user-authored status.
21. The form MUST present these sections in order:

    1. `People`
       - first person;
       - second person.
    2. `Relationship`
       - Simple relationship;
       - Relationship template;
       - relationship types;
       - both dynamically labelled endpoint roles;
       - a natural-language role preview when both roles and people exist.
    3. `Context`
       - closeness;
       - since;
       - last contact;
       - status.
    4. `Advanced`
       - create/edit note path;
       - relationship ID.

22. `People`, `Relationship` and `Context` MUST be visible semantic groups.
    `Advanced` MAY be collapsed by default through a native keyboard-
    accessible disclosure.
23. Status MUST remain optional and user-authored. `last_contact` MUST NOT
    infer or alter status.
24. Editing MUST initialize every supported field from the indexed
    relationship and preserve fields the user does not change.
25. The form MUST NOT create missing endpoint people, merge people, convert
    unresolved links, infer relationship existence from graph/profile data or
    create contact history. Only the explicit simple-relationship choice MAY
    fill the bounded canonical pairs governed by
    `.10x/specs/simple-relationship-automation.md`.

### Relationship templates

26. Ordinary product copy MUST use `Relationship template`. The literal
    persisted property `relationship_preset` MAY appear only where property
    configuration or diagnostics require it.
27. A template is input convenience, not a live dependency. Applying or
    reapplying it copies only:
    - relationship types;
    - the first endpoint's role; and
    - the second endpoint's role.
28. Template storage and matching MUST NOT contain direction.
29. The template editor MUST label its roles as first-person and second-person
    roles and explain that new My-person relationships normally place My
    person first. It MUST NOT claim that every relationship contains the user.
30. Applying a template maps its two roles to the stored endpoint slots
    without hidden role swapping. The relationship form's dynamic labels and
    preview MUST make the resulting person/role pairing reviewable before
    Save.
31. Template apply/reapply MUST preserve endpoints, path, relationship ID,
    closeness, dates, status and unrelated frontmatter.
32. The empty choice MUST read
    `No template — enter values manually`, not `Not linked`.
33. When no templates exist, the form MUST show:
    - `No relationship templates yet`;
    - that manual relationship values remain available;
    - that templates copy repeatable types and both roles; and
    - an explicit `Create template` action.
34. Creating a template from the relationship form MUST retain the complete
    unsaved form and refresh choices after success. It MUST NOT select or
    apply the new template automatically.
35. Selecting a template MUST update only unsaved template-owned values and
    template provenance. No vault write occurs before Save.
36. Selecting `No template — enter values manually` MUST remove only the
    unsaved template ID and preserve copied types and roles.
37. The form MUST distinguish no-template, current, locally modified and
    missing-template states in user language.
38. `Apply latest template values` MUST update only unsaved types and paired
    roles. Save remains the only relationship-note write.
39. Deleting a template MUST leave copied note values intact and explain that
    only template provenance becomes unavailable.
40. Settings-level `Update linked relationships from template` MUST retain
    exact path preview, explicit confirmation, stale-preview rejection,
    unrelated-frontmatter preservation, idempotence and partial-failure
    reporting. Its before/after comparison owns only types and paired roles.

### Relationship note path

41. Once both endpoints are selected, create MUST propose
    `People/Relationships/<First person> - <Second person>.md`.
42. Filename components MAY use sanitized display labels for readability but
    MUST NOT become identity keys.
43. The destination path MUST remain editable and visibly reviewable before
    Save. A collapsed Advanced summary MUST still show it.
44. An existing destination MUST fail visibly without overwrite,
    auto-renaming or an implicit numeric suffix.
45. Editing MUST show the source path read-only. Relationship-note rename or
    move is outside this contract.
46. A validation failure inside Advanced MUST open the disclosure and focus or
    associate the corresponding error.

### Confirmation, failure and accessibility

47. Only explicit Save MAY invoke `AtlasMutationService`. Cancel, Escape,
    closing the modal, simple-relationship selection, template selection and
    preview MUST write nothing.
48. Save MUST validate the complete form before its first write and prevent
    duplicate submission while pending.
49. Validation or mutation failure MUST keep the modal open, retain all
    values, identify the failure and preserve vault notes under the mutation
    contract.
50. Successful creation MUST close the modal and open the new relationship
    note in a normal workspace leaf. Successful editing MUST close the modal
    and leave the existing note open.
51. Simple-relationship selection, template selection, detachment, creation,
    reapplication and dynamic label/preview changes MUST update affected
    controls in place. They MUST preserve focus, scroll, endpoint selections,
    manual path edits and Advanced disclosure state.
52. Sections MUST use semantic grouping, associated labels, descriptions
    referenced through `aria-describedby`, logical source order and the
    modal's owning `Document`.
53. At narrow/mobile widths, the form MUST reflow to one column without
    horizontal scrolling. Save and Cancel MUST remain reachable outside
    Advanced.

## Given/When/Then scenarios

### Start a self-first global relationship

Given My person resolves uniquely

When the global Create relationship command opens

Then My person is the first endpoint, the second endpoint is empty and no
vault write has occurred.

### Start from another selected person

Given My person is Mathijs and Alice is a different selected canonical person

When Alice's Create relationship action opens

Then Mathijs is first, Alice is second, both selectors remain editable, and
the role labels read `My role` and `Alice's role`.

### Fall back without guessing My person

Given the configured My person ID is ambiguous

When Alice starts relationship creation

Then Alice alone is prefilled first, the second endpoint is empty, labels are
neutral/name-based and no ambiguous person is chosen.

### Create a third-party relationship

Given My person is configured and the form initially prefills My person and
Alice

When the user changes the endpoints to Alice and Bob

Then the form permits the relationship, labels the roles for Alice and Bob
and does not require My person at Save.

### Preserve existing endpoint order

Given an existing relationship stores Alice first and My person second

When it is opened for editing or My person changes

Then Alice remains first, My person remains second, their stored roles remain
attached to those slots and no note changes before Save.

### Understand an empty template installation

Given no relationship templates exist

When the relationship form opens

Then manual entry remains available, the copy-not-live role/type model is
explained and Create template is reachable without losing form state.

### Apply a template without hidden swapping

Given Alice is first, Bob is second and a template defines first role
`colleague` and second role `manager`

When the user selects the template

Then the unsaved preview pairs Alice with colleague and Bob with manager,
there is no direction value, and the note remains unchanged until Save.

### Detach while preserving meaning

Given a relationship has copied template types and roles

When the user selects No template

Then only unsaved template provenance is removed and copied values remain.

### Preserve focus and unsaved state

Given the template selector has focus and the user has edited the path and
opened Advanced

When a template is selected, created or reapplied

Then affected controls update in place while focus, path, scroll and
disclosure state remain stable.

### Reject an unsafe save

Given the form contains a missing endpoint, incomplete role pair, invalid
date, closeness, status, path or identity collision

When Save is selected

Then the form retains its values, shows the failure and writes nothing.

## Acceptance criteria

- [ ] One modal/form contract serves global create, selected-person create,
      active-note edit and later direct row edit.
- [ ] My person prefills self-first when resolved; unset, missing and
      ambiguous states follow the exact neutral fallback without guessing.
- [ ] Both endpoints remain editable and relationships between two other
      people are valid.
- [ ] Edit never reorders endpoints or roles because of My person or graph
      center.
- [ ] UI labels use My role and actual counterpart names when possible,
      otherwise actual names or neutral first/second labels; no direction
      terminology appears.
- [ ] All direction-free supported fields round-trip through configured
      property names, with paired-role and manual-status validation intact.
- [ ] Explicit Parent, Child and Sibling choices fill only their canonical
      paired roles, while gender-aware terms remain presentation-only under
      `.10x/specs/simple-relationship-automation.md`.
- [ ] The form uses People, Relationship, Context and Advanced sections with
      a reviewable destination and validation-aware disclosure.
- [ ] Templates contain and copy only types and paired endpoint roles; the
      fixed slot mapping is visible in labels/preview and never silently
      swapped.
- [ ] Empty, create, apply, detach, modified, missing, delete and bulk-update
      template states explain the copy-not-live model accurately.
- [ ] Template bulk updates retain preview/confirm, stale rejection,
      unrelated-frontmatter preservation, idempotence and partial-failure
      reporting.
- [ ] Template/dynamic-label changes preserve form DOM, focus, values, scroll,
      manual path and disclosure state.
- [ ] Create paths remain editable and collision-safe; editing keeps a
      read-only source path.
- [ ] Save is the only write action; invalid/failing saves retain form state,
      cancellation is write-free and pending submissions cannot duplicate.
- [ ] Successful create/edit behavior matches the existing explicit mutation
      contract.
- [ ] Pure tests cover prefill permutations, third-party relationships,
      endpoint-order preservation, template-owned fields and mapping,
      detach/reapply/sync and form-to-mutation conversion.
- [ ] Browser/integration tests cover empty template state, in-form template
      creation, dynamic labels, keyboard focus, Advanced validation, narrow
      viewport, cancel/failure/success and standalone/Bases entrypoint parity.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Error behavior

- A selected or configured person that cannot be revalidated canonically is
  not submitted as an endpoint.
- A stale My person setting falls back to neutral creation and reports its
  settings warning; it does not block unrelated relationship entry.
- An unavailable stored template leaves copied values editable and never
  attempts live resolution as relationship meaning.
- Read-only/future-invalid plugin settings disable template creation and
  settings writes with an explanation; manual relationship entry remains
  available only when the vault mutation boundary itself is writable.
- Failed template bulk synchronization keeps its existing partial-failure and
  stale-preview guarantees.

## Exclusions

- Relationship direction, arrows or source/target presentation.
- Reordering existing endpoints to place My person first.
- Requiring My person in every relationship.
- Inferring relationship existence, stored roles or types from gender,
  pronouns, family structure, names, graph position or relationship type. The
  explicit bounded role-pair choice and presentation-only family terms are
  governed by `.10x/specs/simple-relationship-automation.md`.
- Live template dependencies or background propagation.
- Automatic application of a newly created template.
- Relationship-note rename/move, delete, merge or unresolved-link conversion.
- Edge selection, graph context menus or new touch gestures.
- Contact moments, follow-up, status inference or broad localization.

## Ratified and record-backed decisions

1. User-ratified on 2026-07-30: My person is prefilled first for the common
   self-centered workflow, but both endpoints remain editable and
   third-party relationships remain supported.
2. User-ratified on 2026-07-30: stored endpoints never reorder automatically;
   actual endpoint roles carry the relationship meaning.
3. User-ratified on 2026-07-30: missing My person falls back to neutral
   person/name labels and never guesses.
4. User-ratified earlier on 2026-07-30: use Relationship template terminology,
   retain `relationship_preset` provenance, copy rather than live-link values,
   and organize the form into People, Relationship, Context and Advanced.
5. Record-backed: the existing mutation service, relationship editor,
   template management and stale-safe bulk synchronization are the supported
   implementation boundaries.
6. User-ratified on 2026-07-31: an explicit Parent, Child or Sibling choice
   may fill neutral reciprocal roles; gender may refine only their displayed
   family terms, with neutral fallback and no family-graph inference.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/tickets/2026-07-25-relationship-editor-ui.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
