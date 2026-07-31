Status: active
Created: 2026-07-30
Updated: 2026-07-30

# UX1 — Direct relationship context actions

## Purpose

Make an existing relationship editable where the user can already see it.
The current renderer describes incident relationships as plain text, while
editing requires first opening the relationship note and then invoking
`Edit current relationship`. This contract adds direct, accessible actions to
note-backed relationship rows without introducing graph-edge selection or a
second mutation path.

This specification extends:

- `.10x/specs/perspective-relationship-editor-templates.md`;
- `.10x/specs/accessible-semantic-renderer.md`;
- `.10x/specs/mobile-touch-interaction.md`.

Those specifications continue to govern the shared relationship modal,
canonical identity, safe writes, renderer semantics and touch ownership.

## Scope

This specification governs:

- the representation of each incident edge as a relationship row rather than
  an already-formatted string;
- `Open relationship note` and `Edit relationship` actions for every visible,
  canonical, note-backed relationship;
- the same actions in standalone and Bases list/details surfaces and the
  mobile details sheet;
- canonical revalidation immediately before an open or edit action;
- action labels, focus behavior, stale-state feedback and parallel-edge
  preservation.

## Normative contract

### Row identity and eligibility

1. A relationship row MUST retain the source `AtlasEdge.id`,
   `AtlasEdge.filePath`, counterpart identity and the metadata needed to
   render its description. The renderer MUST NOT reduce the edge to a string
   before actions are attached.
2. A real relationship is actionable only when:
   - `edge.inferred` is `false`;
   - `edge.filePath` is present;
   - the current canonical index contains exactly one relationship record at
     that path; and
   - the path still resolves to a Markdown `TFile` at action time.
3. An inferred contact-link edge MUST remain visible as `Linked person` but
   MUST NOT expose relationship-note `Open` or `Edit` actions. It has no
   relationship note to mutate.
4. Ghost or ambiguous counterpart nodes MAY appear in a real relationship row
   when the canonical edge already records them, but their unresolved state
   MUST remain visible. The action targets the relationship note, never a
   guessed person note.
5. Parallel relationship notes between the same people MUST render as
   separate rows keyed by stable edge identity. Their actions MUST open or
   edit the exact row's relationship note.

### Presentation and actions

6. Each real relationship row MUST show:
   - the existing endpoint-role or neutral Connected description;
   - relationship types when present;
   - explicit status, `since` and `last_contact` when present;
   - `Open relationship note`; and
   - `Edit relationship`.
7. The two actions MUST be native buttons with accessible names that include
   enough row context to distinguish parallel relationships, for example
   `Edit relationship with Alice, colleague`.
8. Standalone and Bases MUST expose the same row contract through their shared
   `AtlasSnapshot` and renderer. Base filtering MUST NOT change which
   relationship note a row action targets.
9. The semantic person-details panel and graph details sheet MUST both expose
   the actions. A canvas edge does not become selectable and no new
   right-click or long-press gesture is introduced.
10. Person-level actions such as `Open note`, `Edit person`,
    `Create relationship` and `Use as center` MUST remain distinct from
    relationship-row actions.

### Open and edit behavior

11. `Open relationship note` MUST revalidate the row's path against the
    canonical index and current vault immediately before navigation. On
    success it opens that exact file in a normal workspace leaf.
12. `Edit relationship` MUST call the existing shared relationship editor
    through a path-based plugin entrypoint. The entrypoint MUST:
    - re-resolve the canonical relationship and current `TFile`;
    - read the current configured frontmatter values;
    - open the existing edit-mode `RelationshipModal`; and
    - rely on `AtlasMutationService` for any later explicit save.
13. The existing `Edit current relationship` command MUST remain available
    and MUST share the same path-based edit entrypoint after it resolves the
    active relationship.
14. Opening or editing a row MUST NOT mutate the relationship, select a graph
    edge, change the current graph center or alter persisted layout state.
15. If the relationship was deleted, renamed, became ambiguous or ceased to
    be canonical after rendering, the action MUST make no write, keep the
    atlas usable and report that the relationship is no longer available.

### Focus, refresh and lifecycle

16. Activating a row action MUST NOT rebuild the person list or move focus
    before the requested note/modal opens.
17. Cancelling or closing the relationship modal MUST return to an unchanged
    atlas state. Where the originating action is still connected, focus
    SHOULD return to it; otherwise focus MUST fall back to the selected
    person's details heading or existing renderer fallback.
18. An index delta that removes or changes the selected relationship MUST
    rerender the row from canonical snapshot data. Detached action listeners
    MUST be lifecycle-owned and cleaned with the renderer.
19. All DOM creation and focus checks MUST use the view container's owning
    `Document` and `Window`.

## Scenarios

### Edit a relationship from a person

Given Alice is selected and a note-backed relationship with Bob is visible
When the user chooses `Edit relationship` on that row
Then the existing relationship modal opens for the exact relationship note
without requiring the note to be active first.

### Open one of two parallel relationships

Given two relationship notes connect Alice and Bob
When the user chooses `Open relationship note` on the second row
Then the second relationship file opens and the first is untouched.

### Keep a linked-person edge honest

Given Bob appears only through Alice's simple `contacts`/`Linked people`
property
When Alice's relationship rows render
Then the row is labelled as a linked-person connection and no relationship
note action is offered.

### Reject stale row state

Given a relationship row was rendered and its note is then deleted
When the user invokes its edit action before the next visual refresh
Then no modal opens, no write occurs and a recoverable unavailable notice is
shown.

### Operate from the mobile details sheet

Given a note-backed relationship appears in the graph details sheet
When the user activates its edit button by touch or keyboard
Then the same path-based modal entrypoint is used and no new edge gesture is
required.

## Acceptance criteria

- [ ] Incident edges remain structured through row rendering and retain their
      stable edge/path identity.
- [ ] Every visible canonical note-backed relationship exposes distinct Open
      and Edit buttons in both semantic details and the graph details sheet.
- [ ] Inferred `Linked people` edges expose neither action and are not
      presented as relationship notes.
- [ ] Parallel relationship rows target their exact notes.
- [ ] Standalone and Bases adapters revalidate the canonical relationship and
      `TFile` immediately before opening or editing.
- [ ] The active-note command and row action share one path-based edit
      entrypoint and the existing relationship modal/mutation service.
- [ ] Stale, deleted, renamed or non-canonical rows fail visibly without
      mutation or renderer corruption.
- [ ] Buttons have row-specific accessible names and preserve logical focus
      in list, details-sheet and pop-out owning-window cases.
- [ ] Focused pure tests cover row construction, inferred versus real edges,
      parallel edges and eligibility.
- [ ] Browser tests cover keyboard/pointer activation, focus behavior,
      standalone/Bases callback parity and stale capability changes.
- [ ] Existing renderer, relationship-form, touch and high-DPI regressions
      remain passing.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Exclusions

- Selecting, dragging, focusing or opening a context menu on canvas edges.
- Creating a relationship note from an inferred link in one click.
- Editing a relationship inline inside the row.
- Relationship merge, delete, rename or bulk edit.
- Changing the relationship-note mutation contract or template semantics.
- Adding contact-moment actions; those belong to
  `.10x/specs/contact-moments-follow-up.md`.

## Ratified decisions

1. Direct actions are added to note-backed relationship rows first.
2. Graph-edge selection is not a prerequisite and remains out of scope.
3. Persisted relationship identity and the existing shared editor remain the
   only edit contract.

## References

- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `src/domain/types.ts`
- `src/main.ts`
- `src/render/atlas-renderer.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
