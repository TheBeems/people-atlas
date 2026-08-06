Status: active
Created: 2026-08-06
Updated: 2026-08-06

> **Narrow supersession — 2026-08-06.** Clause 21 (item 2) and clause 22 of
> `.10x/specs/perspective-relationship-editor-templates.md` are superseded only
for the *internal grouping and disclosure* of the `Relationship` section.
All other normative rules of that active spec
> Advanced ordering, template copy-not-live semantics, apply/detach/modified/
> missing states, Save-as-only-write, dynamic labels, preview, focus/disclosure
> stability, responsiveness and accessibility — remain fully active.

# Relationship form: section sub-grouping and disclosure

## Purpose

Reduce the cognitive load of the relationship modal's `Relationship` section
without changing the durable relationship-note contract, the form-state
contract, template semantics, or any validation or mutation behavior. The
section today stacks six items in one always-visible flow — Simple
relationship, the full Relationship template machinery (selector, empty
state, Create-template action, status line, Apply-latest-values action),
relationship types, both endpoint roles and the role preview — which reads
as one dense, indistinguishable list.

This spec reorganizes that one section into three visually separate
sub-groups, of which exactly one — the *core* fields the user is most likely
to edit directly — stays visible; the two *input conveniences* (the simple
shortcut and the template machinery) collapse behind native keyboard-
accessible disclosures.

## Scope

This specification governs:

- the internal structure of the `Relationship` section in the shared
  create/edit modal: one always-visible **Core** sub-group and two
  collapsed-by-default disclosures (**Shortcut** and **Template**);
- the exact field placement across those sub-groups;
- collapse/expand defaults, disclosure affordance and auto-open behavior;
- interaction with existing in-place template and dynamic-label updates;
- accessibility, focus, responsive and state-stability requirements for the
  new disclosures.

It does NOT govern anything outside the `Relationship` section, and it does
not alter any template data model, form-state model, validation rule,
mutation path or persisted property.

## Ubiquitous language

- **Sub-group**: a visually bounded part of the `Relationship` section with
  its own affordance. Exactly one is always visible; the other two are
  disclosures.
- **Core sub-group**: the always-visible part holding relationship types,
  both endpoint roles and the role preview.
- **Shortcut disclosure**: the collapsed native disclosure holding the
  `Simple relationship` selector.
- **Template disclosure**: the collapsed native disclosure holding the
  `Relationship template` selector, empty state, `Create template` action,
  status line and `Apply latest template values` action.
- **Disclosure**: a native `<details>`/`<summary>` element, matching the
  accessibility pattern already used by the `Advanced` section.

## Normative contract

### Sub-group structure and field placement

1. The `Relationship` section MUST be composed of exactly three sub-groups in
   this order:

   1. **Shortcut disclosure** — `Simple relationship` selector only.
   2. **Template disclosure** — `Relationship template` selector, the
      no-templates empty state, `Create template` action, template status
      line and `Apply latest template values` action.
   3. **Core sub-group** — `Relationship types`, first endpoint role, second
      endpoint role and the natural-language role preview.

2. The **Core sub-group** MUST be the only part of the `Relationship` section
   that is visible by default when the modal opens, except that the Template
   disclosure auto-opens per clause 10 when a template is attached in edit
   mode. The Core sub-group is never itself collapsible.

3. The **Shortcut disclosure** and the **Template disclosure** MUST be
   collapsed by default when the modal opens.

4. Each disclosure MUST use a native `<details>`/`<summary>` element that is
   keyboard-accessible and follows the same pattern as the existing
   `Advanced` disclosure (`.people-atlas-relationship-advanced`).

5. Field order *within* the Core sub-group MUST remain:
   `Relationship types`, first endpoint role, second endpoint role, role
   preview — matching the existing supported-field contract.

### Disclosure labels and affordance

6. The Shortcut disclosure summary MUST read `Simple relationship` (or the
   existing localized equivalent), matching the current field label so the
   affordance remains recognizable.

7. The Template disclosure summary MUST read `Relationship template` (or the
   existing localized equivalent), matching the current field label.

8. The collapsed Template disclosure summary MUST reflect the current
   template state so a user with an already-attached template can see it
   without opening the disclosure:
   - no template selected: the summary shows the `No template` affordance;
   - a template is selected: the summary shows the template name (or the
     localized `missing template` affordance when unavailable).

9. The summary text MUST NOT duplicate the full helper paragraphs; the
   descriptive helper text stays inside the disclosure body.

### Auto-open behavior

10. When a template is already attached to the note being edited (edit mode,
    `values.presetId` set), the Template disclosure MUST open on load so the
    user can see and manage the attached template. When no template is
    attached, it MUST stay collapsed.

11. Selecting the `Simple relationship` shortcut MUST fill the core role
    fields in place, as today, and MUST NOT require the disclosure to remain
    open; the resulting roles are visible immediately in the always-visible
    Core sub-group and role preview. The Shortcut disclosure MAY close after
    the choice is made.

12. Auto-opening or closing a disclosure MUST NOT move focus, recreate the
    form, or alter any unsaved value — consistent with clause 51 of the
    parent spec.

### Updates, refresh and state stability

13. Every existing in-place template update (select, detach, reapply,
    create-then-select, missing-state) and every dynamic label/preview update
    MUST keep working exactly as governed by the parent spec, whether or not
    the Template disclosure is open.

14. The Template disclosure's open/closed state MUST survive template
    selection, detachment, reapplication, dynamic label changes, and the
    create-template round trip — matching the existing `Advanced`-state
    preservation guarantees.

15. The `Advanced` disclosure, People and Context sections, Save/Cancel and
    all their state guarantees are unaffected by this spec and MUST remain
    exactly as governed by the parent spec.

### Accessibility, focus and responsiveness

16. Each disclosure MUST be a native, keyboard-accessible disclosure with the
    owning modal `Document`, matching the `Advanced` pattern. The summary
    MUST be reachable by Tab and toggleable with Enter/Space.

17. Descriptive helper text inside a disclosure body MUST remain referenced
    through `aria-describedby` exactly as today.

18. A validation failure that belongs to a field inside a collapsed disclosure
    MUST open that disclosure and focus or associate the error with the field
    — mirroring the existing validation-aware `Advanced` behavior. Core
    fields are always visible and need no auto-open.

19. At narrow/mobile widths the sub-groups MUST reflow to one column without
    horizontal scrolling; Save/Cancel remain reachable outside all
    disclosures, as today.

## Given/When/Then scenarios

### Open for a fresh manual relationship

Given the modal opens for a new relationship with no template attached
Then only the Core sub-group (types, both roles, preview) is visible and both
disclosures (Shortcut, Template) are collapsed; Save/Cancel remain visible.

### Use the shortcut without keeping it open

Given the Shortcut disclosure is collapsed
When the user opens it and selects `Parent`
Then the core role fields and role preview update in place showing the parent
pair, and the disclosure may collapse while the Core sub-group shows the
filled roles.

### Edit a note with an attached template

Given the modal opens in edit mode for a relationship whose note has a
template attached
Then the Template disclosure is open and its summary shows the template name;
the core fields show the copied values validly.

### Create a template and keep it collapsed

Given the Template disclosure is open and the user starts `Create template`
When the template editor closes on success
Then the relationship form retains all unsaved values, the refresh keeps the
disclosure's open state, and the new template is not auto-applied.

## Acceptance criteria

- [ ] The `Relationship` section ships exactly three sub-groups in the
      specified order: Shortcut disclosure, Template disclosure, Core
      sub-group.
- [ ] Only the Core sub-group is visible when the modal opens; both
      disclosures are collapsed by default.
- [ ] A newly attached template in edit mode opens the Template disclosure;
      a missing/unattached template keeps it collapsed.
- [ ] Shortcut selection updates core roles/preview in place without leaving
      the disclosure open.
- [ ] Template select/detach/reapply/create and dynamic label/preview updates
      keep working while the disclosure is open or collapsed.
- [ ] Disclosure open/closed state survives template and label refreshes.
- [ ] Validation failure for a field inside a collapsed disclosure opens it
      and associates the error; Core and other-section behavior is unchanged.
- [ ] All `people-atlas-relationship-*` CSS reuses the existing
      `Advanced`-disclosure pattern; no hard-coded theme colors.
- [ ] Each disclosure is a native, keyboard-accessible element (Tab focus,
      Enter/Space toggle) using the owning modal `Document`, with descriptive
      helpers referenced through `aria-describedby`; at narrow/mobile widths
      the sub-groups reflow to one column without horizontal scrolling and
      Save/Cancel remain reachable.
- [ ] Browser/integration tests cover: default-collapsed state, shortcut
      fill, edit-mode auto-open with attached template, state survival, and
      collapsed-disclosure validation association.
- [ ] Every parent-spec clause not superseded here remains true; `npm run
      test`, `npm run build` and `git diff --check` pass.

## Exclusions

- Any change to the People, Context or Advanced sections.
- Any change to `Advanced` behavior, template data model, form-state model,
  validation, mutation path, persisted property or bulk-sync semantics.
- Tabs, wizards, steppers, accordions-as-validation gates, or any requirement
  that a disclosure be open before Save.
- Auto-applying a newly created template, live template dependencies, or
  reordering the Core fields.
- Broad localization, theme changes or new widget libraries.

## Ratified decisions

1. **User-ratified on 2026-08-06**: the two input conveniences — Shortcut
   (Simple relationship) and Template — collapse by default; only the Core
   sub-group (types, both roles, preview) stays visible. (Chosen over
   "Template alone collapsed" and "headers only".)
2. **User-ratified on 2026-08-06**: the sub-groups render in the order
   Shortcut disclosure, Template disclosure, Core sub-group — the convenience
   disclosures sit closest to the People section above and the always-visible
   core reads as the section's heart below them.
3. **User-ratified on 2026-08-06**: in edit mode with an attached template the
   Template disclosure auto-opens on load so the user can see and manage the
   attached template; the summary still reflects the template name.

## References

- `.10x/specs/perspective-relationship-editor-templates.md` (governing parent;
  clauses 21/22 partially superseded here)
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `src/editor/relationship-modal.ts`
- `src/editor/relationship-form.ts`
- `src/i18n/nl.ts`, `src/i18n/en.ts`
- `styles.css` (`people-atlas-relationship-advanced` disclosure pattern)
