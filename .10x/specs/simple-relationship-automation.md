Status: active
Created: 2026-07-31
Updated: 2026-07-31

# Explicit simple relationships and derived family terms

## Purpose

Make the common parent, child and sibling workflows require one explicit
relationship choice instead of manually creating gender-specific templates or
typing both endpoint roles. Preserve the existing Markdown-first contract by
storing neutral canonical roles and deriving father/mother, son/daughter and
brother/sister only for presentation.

This specification extends:

- `.10x/decisions/perspective-oriented-relationship-model.md`;
- `.10x/specs/perspective-relationship-editor-templates.md`; and
- `.10x/specs/person-profile-experience.md`.

It narrowly replaces those specifications' former blanket prohibition on
gender-influenced relationship presentation. It does not permit People Atlas
to infer that a relationship exists, create a relationship note without Save,
or derive stored roles or relationship types from gender or graph structure.

## Scope

This specification governs:

- one optional simple-relationship choice in the shared relationship form;
- exact reciprocal role pairs for parent, child and sibling;
- round-tripping that choice through the existing `from_role` and `to_role`
  strings without a new persisted field;
- presentation-only family terms derived from an endpoint's explicit gender;
- form preview and incident-relationship-row parity;
- interaction with manual roles and relationship templates; and
- write, accessibility, compatibility and fallback behavior.

## Ubiquitous language

- **Simple relationship**: an explicit form choice that fills one supported
  pair of existing endpoint-role fields. It is not a discovered edge, stored
  relationship kind or template.
- **Canonical simple role**: one exact lower-case stored role: `parent`,
  `child` or `sibling`.
- **Derived family term**: a presentation-only word selected from a canonical
  simple role and the role holder's explicit gender.
- **Neutral fallback**: the canonical simple role itself when gender does not
  select a supported gendered term.
- **Custom relationship**: any other paired-role state, including literal
  gendered roles already present in a note or template.

## Normative contract

### Explicit choice and reciprocal roles

1. The shared relationship form MUST offer one optional
   `Simple relationship` control in the visible `Relationship` section.
2. The control MUST have exactly these semantic choices:

   | Choice | First-person stored role | Second-person stored role |
   | --- | --- | --- |
   | `Custom — use template or roles below` | no automatic change | no automatic change |
   | `Parent of the second person` | `parent` | `child` |
   | `Child of the second person` | `child` | `parent` |
   | `Sibling of the second person` | `sibling` | `sibling` |

3. Choosing Parent, Child or Sibling MUST update both unsaved role fields in
   place. It MUST NOT select, create, detach, reapply or edit a relationship
   template.
4. The choice MUST NOT change relationship types, endpoints, path,
   relationship ID, template provenance, closeness, dates, status or unrelated
   form state.
5. The selected choice MUST be derived from the current trimmed role pair:
   `parent`/`child`, `child`/`parent` or `sibling`/`sibling`. Every other pair,
   including differently cased or translated strings, MUST show Custom.
6. Manual role edits and template application MUST refresh the simple choice
   from the resulting role pair. They MUST NOT be overwritten merely because
   the pair is Custom.
7. The form MUST explain the fixed first-person-to-second-person meaning. With
   both endpoints selected, the existing preview MUST name both people and
   make both resulting terms reviewable before Save.
8. A simple choice MAY be made before both people are selected. Missing or
   unresolved endpoints retain the existing Save validation and MUST NOT be
   guessed from names.

### Storage and compatibility

9. Saving a simple relationship MUST use the existing configured first-role
   and second-role properties. No `simple_relationship`, gendered-role,
   kinship or other new relationship property may be introduced.
10. The stored values written by the three choices MUST be the exact canonical
    lower-case roles in the table above. Derived family terms MUST NOT be
    persisted.
11. This feature MUST NOT require a plugin-settings migration or a vault-note
    migration. Existing relationship and person notes MUST remain untouched
    until their normal explicit editor Save.
12. Existing notes or templates whose paired roles already equal a supported
    canonical pair MUST participate in the selector and derived presentation
    without being rewritten.
13. Existing literal roles such as `mother`, `father`, translated words or
    arbitrary custom text MUST remain literal custom roles. People Atlas MUST
    NOT normalize or replace them automatically.
14. Template copy, modified-state, reapply, detach and bulk synchronization
    semantics remain unchanged. A template MAY contain canonical simple roles,
    but no built-in template or preset-provenance record is created by this
    feature.

### Gender-aware presentation

15. Gender remains optional user-authored free text. This feature MUST NOT
    infer it, constrain the person form to an enum, or rewrite it.
16. For derived family terms only, People Atlas MUST trim gender and compare
    it case-insensitively with the exact values `woman` and `man`. No other
    aliases or vocabulary are recognized in this slice.
17. A supported canonical role MUST produce the following presentation term
    for its role holder:

   | Stored role | `woman` | `man` | Missing or every other value |
   | --- | --- | --- | --- |
   | `parent` | `mother` | `father` | `parent` |
   | `child` | `daughter` | `son` | `child` |
   | `sibling` | `sister` | `brother` | `sibling` |

18. The role holder's own gender MUST select the term. The counterpart's
    gender, pronouns, name, relationship types and graph position MUST NOT
    influence it.
19. Derived terms MUST be used consistently in the relationship-form preview
    and in note-backed incident relationship descriptions in standalone and
    Bases views. The existing configurable `{role}` / `{person}` relationship
    format MUST receive the derived term as `{role}`.
20. Changing a person's gender MAY change subsequent presentation after the
    canonical snapshot updates, but MUST NOT write or mutate any relationship
    note, template or role.
21. A missing, ghost or ambiguous person, an unsupported gender value or a
    non-canonical role MUST fall back without diagnostics: canonical roles use
    their neutral term; custom roles remain literal.

### No relationship inference

22. People Atlas MUST NOT create, propose, persist or silently select a
    relationship because two people share a parent, child, gender, name,
    relationship type or graph neighborhood.
23. A sibling relationship MUST be an independent explicit relationship note;
    it is not implied by two parent-child notes.
24. Only explicit Save may write a relationship note. Choosing a simple
    relationship, deriving a term, changing endpoints or previewing results
    MUST remain write-free.

### Accessibility and stable interaction

25. The control MUST use a native keyboard-accessible select or an equally
    semantic native control with an associated label and description.
26. Changing the simple choice, endpoints, roles, template or gender-backed
    preview MUST update affected controls in place without rebuilding the
    form, moving focus, changing scroll, or altering Advanced disclosure and
    manual path state.
27. The control and preview MUST use the modal's owning `Document`, fit the
    existing logical source order and reflow without horizontal scrolling at
    narrow/mobile widths.

## Given/When/Then scenarios

### Create a third-party parent-child relationship

Given Alice is the first person with gender `woman` and Bob is the second
person with gender `man`

When the user explicitly chooses Parent of the second person

Then the unsaved roles become `parent` and `child`, the preview presents Alice
as mother and Bob as son, no relationship type or template value changes and
no note is written before Save.

### Express the inverse ordering

Given Bob is first and Alice is second

When the user explicitly chooses Child of the second person

Then the unsaved roles become `child` and `parent`, Bob is presented as son
and Alice as mother, without swapping the selected people.

### Present both sibling perspectives

Given Alice has gender `woman` and Bob has gender `man`

When the stored roles are `sibling` and `sibling`

Then Alice's incident row uses sister, Bob's incident row uses brother and the
relationship note continues to store `sibling` twice.

### Use a neutral fallback

Given Sam's stored role is `parent` and Sam's gender is missing, `non-binary`
or any value other than `woman` or `man`

When Sam's relationship description is presented

Then the term is parent and no warning, gender rewrite or relationship write
occurs.

### Preserve a custom relationship

Given a template copies `mentor` and `mentee`, or a note stores literal roles
`mother` and `daughter`

When the form or relationship rows present it

Then the simple selector shows Custom, the literal roles are preserved and no
family-term transformation occurs.

### Do not infer siblings

Given Alice and Bob each have an explicit parent-child relationship with Carol

When the graph is indexed or either person's details are opened

Then no Alice-Bob sibling relationship appears unless an independent explicit
relationship note exists.

### React to a gender edit without touching relationships

Given Alex has a stored canonical `child` role and a relationship note that is
otherwise unchanged

When Alex's explicit gender changes from an unsupported value to `man`

Then later presentation changes from child to son and the relationship note,
its timestamps and its frontmatter remain untouched.

## Acceptance criteria

- [ ] Parent, Child and Sibling choices map to the exact reciprocal canonical
      pairs and Custom leaves current values alone.
- [ ] The choice is derived from current roles and stays coherent after manual
      edits, template apply/reapply and endpoint changes without hidden swaps.
- [ ] Simple choices change only unsaved paired roles and no other form value.
- [ ] Save persists only neutral canonical roles through the existing
      configured properties; no schema, settings or vault migration exists.
- [ ] `woman` and `man` yield the exact gendered terms, case-insensitively;
      every other gender uses the neutral canonical term.
- [ ] Form previews and standalone/Bases incident rows use the same pure
      derived-term contract and each endpoint's own gender.
- [ ] Custom/literal roles, templates and existing notes remain compatible and
      are never normalized or rewritten.
- [ ] No graph, shared-parent, name, type, pronoun or gender inference creates
      or selects a relationship.
- [ ] Only explicit Save writes; selection, preview and gender changes are
      write-free and preserve form focus/state.
- [ ] Pure tests cover every role pair, both recognized gender values,
      casing/whitespace, neutral fallbacks, custom roles and endpoint-specific
      sibling terms.
- [ ] Browser tests cover third-party selection, inverse ordering, template
      interaction, manual override, focus stability, owning-document behavior
      and narrow/mobile layout.
- [ ] Existing relationship mutation, role-pair, template-sync, renderer,
      standalone/Bases parity and person-profile protections remain passing.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass separately.

## Error behavior

- Unsupported or malformed gender text produces a neutral term, not a failed
  relationship form or diagnostic.
- Incomplete manual role pairs retain the existing validation and zero-write
  failure behavior.
- Stale or unavailable template provenance retains the existing missing-
  template behavior; the simple selector derives only from current roles.
- Missing or ambiguous endpoints never acquire gender or identity through a
  display label and remain subject to the canonical endpoint validation.

## Exclusions

- Inferring or auto-creating relationship notes, including sibling edges from
  shared parents.
- Automatically changing relationship types or template provenance.
- Persisting `mother`, `father`, `daughter`, `son`, `sister` or `brother` for
  canonical simple relationships.
- Grandparent, grandchild, aunt, uncle, niece, nephew, cousin, spouse or other
  kinship catalogs.
- Gender aliases beyond case-insensitive `woman` and `man`, pronoun-based
  classification, configurable term dictionaries or broad localization.
- A fixed gender enum, gender migration or edits to person notes.
- Background propagation, relationship-note bulk rewrites or implicit Save.

## Ratified and record-backed decisions

1. User-ratified on 2026-07-31: the first slice contains only Parent, Child
   and Sibling; it fills reciprocal neutral roles and avoids gender-specific
   preset combinations.
2. User-ratified on 2026-07-31: gender may refine only presentation of those
   canonical roles into father/mother, son/daughter and brother/sister, with a
   neutral fallback; stored roles remain neutral.
3. User-ratified on 2026-07-31: the user explicitly chooses the relationship;
   People Atlas does not derive or create relationships from the family graph.
4. Record-backed: `PersonRecord` and `AtlasNode` already carry optional gender,
   and relationship notes already persist paired role strings.
5. Record-backed: the shared relationship form, explicit Save mutation path,
   shared `AtlasSnapshot` and renderer isolation remain the supported
   boundaries.
6. KISS/YAGNI: the simple selector owns only roles. Relationship types,
   template provenance, broader kinship and localization remain separate
   behavior until explicitly required.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/domain/types.ts`
- `src/graph/build-snapshot.ts`
- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/render/relationship-rows.ts`
