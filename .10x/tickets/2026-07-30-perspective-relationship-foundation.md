Status: done
Created: 2026-07-30
Updated: 2026-07-30

# Perspective-oriented relationship foundation

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`

## Scope

Implement
`.10x/specs/perspective-relationship-foundation.md` as the smallest complete
foundation for direction-free, perspective-oriented relationships:

- remove direction from current domain, graph, parser, diagnostics, mutation,
  settings, templates, synchronization and basic renderer contracts;
- retain `from`/`to` only as stable endpoint/role slots;
- use complete endpoint roles or neutral Connected descriptions;
- migrate valid settings from v4 to v5, stripping only template direction and
  adding empty `myPersonId`;
- preserve legacy relationship-note direction properties as ignored,
  unowned frontmatter;
- add a canonical unique-person `My person` settings selector and recoverable
  invalid-state behavior;
- use My person only as an otherwise-unconfigured initial center, without
  coupling identity to later navigation;
- update fixtures, generated invariants, documentation and tests to the
  direction-free contract.

This ticket is executable after explicit implementation authorization.

## Non-goals

- Deleting direction frontmatter from vault notes or adding a cleanup command.
- Reordering or rewriting existing relationship endpoints or roles.
- The self-first relationship modal, template empty state or form hierarchy.
- Requiring every relationship to contain My person.
- Reinterpreting `defaultCenterPersonId` as personal identity.
- Relationship row actions, edge selection, contact moments, profile fields,
  photos or follow-up.
- Renaming `from`, `to`, `from_role`, `to_role` or
  `relationship_preset` frontmatter properties.
- Changing relationship identity, path, date, closeness or status semantics.

## Acceptance criteria

- [x] `RelationshipDirection` and every current `direction` member disappear
      from domain records, graph edges, form/mutation values, presets and
      synchronization values.
- [x] `directionProperty` disappears from current settings defaults/types,
      validation, collision checks and settings UI.
- [x] Indexing no longer reads direction or emits
      `invalid-relationship-direction`.
- [x] New and updated relationship mutations never own, write, normalize or
      remove legacy direction frontmatter.
- [x] Full graph builds, incremental deltas and inferred edges use the same
      direction-free edge shape and remain equivalently tested.
- [x] Complete role pairs render endpoint-relative role text; missing or
      incomplete pairs use neutral `Connected to <counterpart>` with no
      Incoming/Outgoing/source/target fallback.
- [x] Settings schema advances exactly once from v4 to v5.
- [x] Valid v4 template settings migrate before v5 validation and preserve
      template identity, name, order, types and paired roles while dropping
      only direction.
- [x] Migration adds empty `myPersonId`, retains all unrelated valid settings
      and persists only after full v5 validation.
- [x] Invalid supported-version and future-version settings retain the
      existing write-disabled, non-overwriting recovery behavior.
- [x] My person settings offer None or uniquely identified canonical people,
      store only explicit `person_id`, and never fall back to display name,
      file path, current selection or center.
- [x] Missing/ambiguous stored My person values remain visible with a warning,
      disable only perspective defaults and do not block unrelated operation.
- [x] Standalone and Bases use My person as initial center only when no
      explicit navigational center/default/history exists; later center
      changes do not mutate My person.
- [x] Existing relationship notes with valid or invalid legacy direction index
      without direction behavior or diagnostic and remain unchanged.
- [x] Editing another field preserves the old direction value, other
      frontmatter and Markdown body.
- [x] README/examples/architecture-facing contracts describe roles and
      neutral connections without current direction instructions.
- [x] Focused tests cover migration success/failure/future versions, template
      preservation, legacy-note preservation, My person resolution/failure,
      initial-center boundaries and full/incremental graph equivalence.
- [x] Existing protective identity, duplicate, unresolved, role-pair,
      mutation-safety, template-sync and renderer assertions remain at least
      as strong after direction-specific cases are replaced.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/constants.ts`
- `src/domain/types.ts`
- `src/index/frontmatter.ts`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `src/mutations/validation.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/migrations.ts`
- `src/settings/validate.ts`
- `src/settings/settings-tab.ts`
- `src/settings/relationship-presets.ts`
- `src/settings/relationship-preset-sync.ts`
- `src/settings/relationship-preset-sync-modal.ts`
- `src/render/atlas-renderer.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- relationship, settings, graph, renderer and generated-invariant tests
- `README.md`, `README.nl.md` and relevant examples

Exact helper names may follow current repository conventions without changing
the governing contract.

## References

- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/generated-graph-index-invariants.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: direction is removed from current People Atlas behavior and
  settings rather than hidden.
- User-ratified: legacy relationship-note direction properties are ignored and
  preserved, not deleted.
- User-ratified: My person is a stable explicit-ID setting, independent of the
  current graph center; missing identity uses neutral fallback without
  guessing.
- User-ratified: relationships remain valid when neither endpoint is My
  person.
- Record-backed: current plugin settings schema is v4 and current stored
  templates require direction plus paired roles.
- Record-backed: current graph traversal/layout does not branch on direction;
  the legacy renderer fallback is its only observed presentation branch.
- Record-backed: explicit IDs, canonical index resolution, both-roles-or-none,
  explicit vault writes and unrelated-frontmatter preservation remain
  non-negotiable.

## Journal

- 2026-07-30: User ratified My person identity, self-first/non-self-only
  relationships and safe option 3A for legacy direction data.
- 2026-07-30: Governing ADR and foundation spec activated. Ticket opened with
  no unresolved semantic blockers. No product code, test, build or generated
  artifact was changed or run during shaping.
- 2026-07-30: User authorized preflight and UX0 through UX7 implementation.
  UX0 removed direction from current domain, parsing, graph, mutation, form,
  settings, preset and renderer contracts; migrated settings v4 to v5; added
  canonical `My person` resolution; and updated documentation and fixtures.
- 2026-07-30: Fresh adversarial review found and drove repairs for deferred
  index startup, explicit-ID/path-fallback collisions, Bases custom-ID
  projection mapping, note renames and same-path replacement safety.
- 2026-07-30: Final verification passed 37 test files and 373 tests plus
  TypeScript/production build, formatter, lint and whitespace checks. The
  independent re-review reported no remaining UX0 findings.

## Blockers

None.

## Evidence

- `src/domain/types.ts`, `src/index/frontmatter.ts`,
  `src/graph/build-snapshot.ts`, `src/graph/graph-delta.ts`,
  `src/mutations/`, `src/editor/` and `src/render/atlas-renderer.ts` implement
  the direction-free relationship contract and neutral/role-relative labels.
- `src/settings/` and `src/constants.ts` implement schema v5, safe v4
  validation/migration, direction-free templates and the `My person` setting.
- `src/main.ts`, `src/view/people-atlas-view.ts` and
  `src/bases/people-atlas-bases-view.ts` enforce unique explicit identity,
  deferred-index initialization, navigation precedence and Bases projection
  mapping without treating display/path data as identity.
- `test/migrations.test.ts`, `test/frontmatter-diagnostics.test.ts`,
  `test/mutation-service.test.ts`, graph/generated tests, renderer browser
  tests and `test/integration/my-person.integration.test.ts` cover migration,
  preservation, direction-free equivalence and identity/navigation failures.
- Final `npm run test`: 37 files, 373 tests passed.
- Final `npm run build`: TypeScript no-emit and production esbuild passed.
- Final `npm run format:check` and `npm run lint`: 107 files passed.
- Final `git diff --check`: passed; only informational LF/CRLF warnings.

## Review

Verdict: pass.

Fresh review inspected direction removal, settings migration, legacy
frontmatter and Markdown preservation, role rendering, canonical uniqueness,
deferred startup, both view precedence contracts, Bases custom-ID mapping,
rename handling and same-path replacement safety. Four consequential
pre-closure findings were repaired with focused regressions. Final review
reported no remaining UX0 findings.

Residual boundary: automated Chromium and controlled-Obsidian coverage do not
claim live Obsidian desktop/mobile, pop-out or assistive-technology proof.

## Retrospective

Deferring canonical identity until the index becomes authoritative requires an
explicit one-shot initialization state; constructor-time lookup alone is not
safe under Obsidian's deferred layout lifecycle. Bases can use the canonical
person note path only as a revalidated join into its visible ID mapping, never
as durable identity. Independent review was especially valuable at those two
cross-layer boundaries.
