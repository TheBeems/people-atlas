Status: cancelled
Created: 2026-07-30
Updated: 2026-07-30
Replaced-By: `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`
Superseded-By: `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`

# UX2 — Relationship templates and form hierarchy

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-25-relationship-editor-ui.md`

## Scope

Implement
`.10x/specs/relationship-template-form-experience.md` while preserving the
existing relationship-note and bulk-synchronization contracts:

- change user copy from preset/link language to Relationship template;
- retain configured `relationship_preset` storage and internal compatibility;
- add explanatory no-template state and an in-form Create template route;
- preserve unsaved form state and require explicit template selection;
- reorganize the shared modal into People, Relationship, Context and Advanced;
- update template controls in place so focus/scroll/path state do not reset;
- update settings, confirmations and documentation terminology consistently.

This ticket is executable only after explicit user authorization.
Implementation has not started in this shaping turn.

## Non-goals

- Renaming existing frontmatter properties or stored template IDs.
- Live/background propagation from templates.
- Relationship-row Open/Edit actions.
- New relationship fields, inferred roles/types or a localization framework.
- Relationship note rename/move or broad settings redesign.

## Acceptance criteria

- [ ] Ordinary UI/documentation uses `Relationship template`; literal
      `relationship_preset` appears only where stored property configuration
      or diagnostics require it.
- [ ] Existing settings and relationship notes load without a schema/data
      migration caused solely by terminology.
- [ ] The empty option reads `No template — enter values manually`.
- [ ] Zero-template state explains manual entry and copy-not-live behavior and
      offers an explicit Create template action.
- [ ] Creating a template from the relationship form preserves every unsaved
      field, path edit, scroll and disclosure state; the new template is not
      applied until selected.
- [ ] Read-only/future invalid plugin settings disable template creation with
      an explanation but do not erase manual form values.
- [ ] Apply/reapply changes only unsaved types, paired roles and direction;
      detach removes only the template ID and retains copied values.
- [ ] Modified/missing/current/no-template messages and bulk update/delete
      confirmations state the copied-value consequences accurately.
- [ ] Settings bulk update retains preview/confirm, stale-preview rejection,
      unrelated-frontmatter preservation, idempotence and partial-failure
      reporting.
- [ ] The shared form uses People, Relationship, Context and Advanced groups
      in the specified order.
- [ ] Advanced uses a native disclosure, shows create destination in its
      summary and opens/focuses when one of its fields is invalid.
- [ ] Template state updates do not replace the form DOM or move focus to
      Person A.
- [ ] Modal remains one-column/reflow-safe at narrow widths; Save/Cancel stay
      visible and logical for keyboard/touch use.
- [ ] Pure tests preserve template-owned field boundaries and existing
      apply/detach/bulk synchronization behavior.
- [ ] Browser tests cover empty state, in-form creation return, focus,
      disclosure/validation, narrow viewport and cancellation.
- [ ] README/settings descriptions explain how to create, select, detach,
      reapply and bulk-update templates without implying a live dependency.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/editor/relationship-modal.ts`: grouped stable DOM and template states.
- `src/editor/relationship-form.ts`: unchanged/pure template-owned values.
- `src/settings/settings-tab.ts`: terminology and shared creation entrypoint.
- `src/settings/relationship-preset-modal.ts`: user-facing template copy.
- `src/settings/relationship-preset-sync-modal.ts`: update/confirmation copy.
- `README.md`: user workflow documentation.
- `test/relationship-form.test.ts` and browser modal tests.

Internal module/type names MAY stay `preset` unless a local rename materially
improves clarity without changing persisted compatibility.

## References

- `.10x/specs/relationship-template-form-experience.md`
- `.10x/specs/relationship-editor-ui.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/decisions/canonical-graph-source.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- Record-backed: templates copy types, paired endpoint roles and direction.
- Record-backed: bulk synchronization is explicit, previewed and stale-safe.
- User-ratified: Relationship template is the user term while
  `relationship_preset` remains stored compatibility.
- User-ratified: form sections are People, Relationship, Context and Advanced.
- Mechanical: a plugin-owned template modal can return to an unchanged
  relationship modal without relying on undocumented Obsidian Settings APIs.

## Blockers

None known. Stop and record a blocker if Obsidian modal stacking cannot
preserve the originating form/focus through supported APIs; shape a
plugin-owned non-stacked route rather than reaching into undocumented Settings
DOM.

## Journal

- 2026-07-30: User ratified template terminology, copied values and the four
  form sections.
- 2026-07-30: Governing spec activated and ticket opened for later explicit
  implementation. No product code or tests were changed/run.
- 2026-07-30: Cancelled before implementation because the user superseded the
  direction-bearing relationship contract with a perspective-oriented,
  direction-free model. Replacement execution is owned by
  `.10x/tickets/2026-07-30-perspective-relationship-foundation.md` followed by
  `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`.
