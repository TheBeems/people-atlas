Status: done
Created: 2026-07-31
Updated: 2026-07-31

# Implement explicit simple relationships and derived family terms

## Scope

Implement `.10x/specs/simple-relationship-automation.md` as one bounded
relationship-form and presentation slice:

- add an optional `Simple relationship` control to the existing shared create
  and edit modal;
- map explicit Parent, Child and Sibling choices to the exact reciprocal
  canonical role pairs without changing any other form value;
- derive the selected choice from current manual or template-copied roles;
- derive mother/father, daughter/son and sister/brother only in presentation
  from the role holder's explicit `woman` or `man` gender;
- use the same pure term contract in form preview and incident relationship
  rows for standalone and Bases snapshots;
- preserve custom roles, current template lifecycle, explicit Save and all
  existing mutation safety; and
- document the simple workflow and neutral fallback.

This is one coherent ticket because the control must preview the same terms
that saved relationships show; splitting the reciprocal-role mapper from its
presentation contract would leave an independently unusable intermediate
state.

Creating this ticket does not authorize product implementation. Execution may
start only after the user explicitly authorizes this ticket.

## Non-goals

- Inferring or creating relationships from shared parents, gender, names,
  pronouns, types or graph structure.
- A new relationship or settings property, schema version or migration.
- Automatically changing relationship types or template provenance.
- Built-in templates, automatic template creation or live template behavior.
- Persisting gendered family terms or rewriting existing relationship notes.
- Gender enums, gender aliases beyond `woman` and `man`, person-note edits or
  pronoun-based classification.
- Grandparent, grandchild, aunt, uncle, niece, nephew, cousin, spouse or a
  generalized kinship engine.
- Broad localization, relationship-note rename/move/delete or graph edge
  creation outside the existing explicit mutation path.

## Acceptance criteria

- [x] The visible Relationship section contains one accessible
      `Simple relationship` control with Custom, Parent, Child and Sibling in
      the governing spec's fixed first-person-to-second-person semantics.
- [x] Parent writes only unsaved `parent`/`child`, Child writes only unsaved
      `child`/`parent`, and Sibling writes only unsaved
      `sibling`/`sibling`.
- [x] Selecting a simple relationship does not change people, types, path,
      relationship ID, template ID, closeness, dates, status, scroll, focus or
      Advanced disclosure state, and writes no vault data before Save.
- [x] The selector derives from the exact current role pair after initial
      load, manual role edits, template apply/reapply and simple selection;
      every other pair shows Custom without changing its values.
- [x] The pure term mapper trims and case-folds gender only for exact `woman`
      and `man`, applies the complete role/term table, uses the role holder's
      own gender and returns neutral canonical roles for every other value.
- [x] Form preview and note-backed incident rows in standalone and Bases use
      that same mapper; the configured relationship-role format receives the
      derived term while custom roles remain literal.
- [x] Save persists only the canonical neutral paired roles through the
      existing configured properties. No new frontmatter/settings field,
      schema migration, note migration or automatic bulk update is added.
- [x] Existing canonical-role notes/templates gain derived presentation
      without writes; existing literal, translated and custom roles remain
      byte-semantically unchanged and show as Custom in the selector.
- [x] Changing gender affects later presentation only and never commits a
      relationship or template mutation.
- [x] Shared-parent structures, missing/ambiguous people and inferred linked-
      person edges never synthesize or select a relationship.
- [x] Pure tests cover all three reciprocal pairs, Custom, both recognized
      genders, whitespace/case normalization, unsupported/missing gender,
      each endpoint's sibling term, literal roles and unchanged unrelated form
      values.
- [x] Browser tests cover third-party parent/child creation, inverse ordering,
      sibling presentation, manual override, template interaction, focus/
      state preservation, owning-document semantics and narrow/mobile reflow.
- [x] Relationship-row tests cover both endpoint perspectives, neutral
      fallback, custom roles, ambiguous/ghost behavior and configured role
      formatting.
- [x] Existing relationship mutation, role-pair validation, template sync,
      standalone/Bases parity, person profile, renderer, touch and high-DPI
      protections remain passing.
- [x] `README.md` and `README.nl.md` explain the explicit choice, neutral
      storage, gendered presentation, neutral fallback and no graph inference.
- [x] `npm run test`, `npm run build` and `git diff --check` pass separately.

## Likely implementation boundaries

- one small pure shared role/term helper under the existing domain or
  relationship boundary; it MUST NOT import `obsidian` or read vault data;
- `src/editor/relationship-form.ts`: derive/apply the simple choice and build
  the gender-aware preview without changing mutation values;
- `src/editor/relationship-modal.ts`: add and refresh the native control in
  place while preserving lifecycle-owned state;
- `src/render/relationship-rows.ts`: use the shared presentation-only term for
  the selected endpoint;
- `test/relationship-form.test.ts` and
  `test/browser/relationship-modal.browser.test.ts`;
- `test/relationship-rows.test.ts` plus focused pure helper tests if the helper
  receives its own module;
- `README.md` and `README.nl.md`.

`src/settings/*`, schema constants, frontmatter parsing and mutation APIs are
not expected to change. If implementation proves one of those changes
necessary, stop and return to shaping rather than expanding this ticket.

## References

- `.10x/specs/simple-relationship-automation.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified on 2026-07-31: the supported first slice is exactly Parent,
  Child and Sibling with reciprocal neutral roles.
- User-ratified on 2026-07-31: `woman` and `man` may refine only the displayed
  canonical family term; missing/custom gender uses the neutral role and
  stored relationship roles remain neutral.
- User-ratified on 2026-07-31: relationship selection remains explicit; no
  family-graph inference or automatic relationship-note creation is allowed.
- Record-backed: current person records and snapshot nodes already carry
  optional gender, so presentation needs no person-profile schema change.
- Record-backed: current relationship writes already support optional paired
  role strings through one explicit Save path, and current form/template state
  can detect local role changes.
- Record-backed: rendering consumes `AtlasSnapshot` and does not read the
  vault, so derived terms must remain a pure presentation transformation.
- KISS/YAGNI: the simple control changes only paired roles. Types, templates,
  broader kinship and localization remain outside this slice.

## Journal

- 2026-07-31: User identified gender-specific preset explosion as unnecessary
  input friction and requested the simplest automatic alternative.
- 2026-07-31: User ratified explicit Parent/Child/Sibling selection, reciprocal
  neutral storage, presentation-only gendered terms with neutral fallback and
  no family-graph inference.
- 2026-07-31: Source inspection found gender already present on `PersonRecord`
  and `AtlasNode`, paired role strings already persisted by the safe mutation
  path, and one existing form/row presentation seam. No schema or migration is
  required by the shaped contract.
- 2026-07-31: Focused spec activated and the two broader active specs were
  reconciled to its narrow exception. This shaping turn changed only `.10x/`
  records; no product source, test, build or generated artifact was changed or
  run.
- 2026-07-31: User explicitly authorized this ticket. Execution started after
  reading the ticket, focused specification, all directly referenced governing
  records, `AGENTS.md` and `ARCHITECTURE.md`; the pre-existing `manifest.json`
  modification was identified as user-owned and remains outside this ticket.
- 2026-07-31: Added one pure `simple-relationships` domain helper for the
  exact reciprocal pairs and role-holder-gender term table. It imports no
  Obsidian API, reads no vault state and preserves non-canonical roles
  literally.
- 2026-07-31: Added the native `Simple relationship` select before the
  template control. Selection changes only the two in-memory role fields;
  manual roles and template apply/reapply derive the select in place, while
  focus, scroll, manual path and Advanced state remain owned by the existing
  form DOM.
- 2026-07-31: Reused the pure term mapper in the form preview and incident
  relationship rows. Each surface supplies the selected role holder's own
  optional gender; inferred linked-person rows remain on their existing
  separate path and no relationship inference or write path was added.
- 2026-07-31: Added focused helper, form, row and browser regressions plus the
  explicit workflow/fallback documentation in `README.md` and
  `README.nl.md`. Focused node tests passed 3 files / 60 tests and the focused
  browser modal suite passed 1 file / 14 tests.
- 2026-07-31: Final executor gate passed separately: `npm run test` passed 64
  files / 754 tests; `npm run build` passed TypeScript typecheck and the
  production esbuild; `git diff --check` exited 0 with only Git's existing
  LF-to-CRLF conversion warnings.
- 2026-07-31: Fresh independent review reported one significant finding:
  duplicate-ID ambiguous role holders retained snapshot gender and could
  therefore receive a gendered family term instead of the required neutral
  fallback. The review verdict and finding remain recorded below.
- 2026-07-31: After explicit user authorization for that review-scoped repair,
  incident-row presentation now supplies gender only for a resolved canonical
  person node through `isResolvedAtlasPersonNode`. Ambiguous and ghost role
  holders therefore use neutral canonical terms without changing graph
  construction, custom roles or any write path.
- 2026-07-31: The focused row suite passed 1 file / 7 tests after adding
  ambiguous `woman` and `man` fixtures that prove neutral parent, child and
  sibling terms while retaining ghost and literal-custom coverage.
- 2026-07-31: Post-repair gates passed separately: `npm run test` passed 64
  files / 754 tests; `npm run build` passed TypeScript typecheck and production
  esbuild; `git diff --check` exited 0 with only the existing LF-to-CRLF
  conversion warnings.
- 2026-07-31: A fresh independent re-review reported no findings and a `pass`
  verdict. Final orchestration audit confirmed every acceptance criterion is
  checked, the authorized repair is evidenced and no required work remains.

## Blockers

None. Implementation, the authorized review repair, post-repair gates and a
fresh independent re-review are complete.

## Evidence

- `src/domain/simple-relationships.ts` and
  `test/simple-relationships.test.ts` cover all reciprocal pairs, exact
  Custom detection, `woman`/`man` normalization, the complete term table,
  unsupported/missing gender and literal-role preservation.
- `test/relationship-form.test.ts` proves only the paired roles change,
  unrelated form values and canonical Save inputs stay unchanged, and preview
  uses each endpoint's own gender.
- `test/browser/relationship-modal.browser.test.ts` proves exact accessible
  choices, third-party Parent/Child/Sibling and inverse presentation, initial/
  manual/template/reapply derivation, neutral Save payloads, zero writes before
  Save, focus/scroll/path/disclosure preservation, owning-document controls
  and narrow-width reflow.
- `test/relationship-rows.test.ts` proves both endpoint perspectives,
  configured role formatting, woman/man terms, missing-gender neutral terms,
  literal custom roles and ghost/ambiguous behavior. Existing inferred-link
  coverage proves those rows remain separate and synthesize no relationship.
- `README.md` and `README.nl.md` document explicit selection, neutral role
  storage, presentation-only gender terms, neutral/custom fallback and the
  absence of shared-parent or graph inference.
- Repository inspection and final status show no settings, schema, parser,
  graph-construction or mutation-API file changed. The pre-existing user-owned
  `manifest.json` diff and the shaping-record diffs remain outside executor
  product scope.
- Full automated evidence: `npm run test` 64 files / 754 tests;
  `npm run build` typecheck plus production bundle; `git diff --check` exit 0.
  Browser automation supports the form contract but is not proof of live
  Obsidian Mobile, Electron pop-outs or assistive technology.
- Repair evidence after the preserved `concerns` review: the renderer now
  gates gendered terms on `isResolvedAtlasPersonNode(selected)` rather than
  raw snapshot gender. `test/relationship-rows.test.ts` assigns `woman` and
  `man` to ambiguous role holders and asserts neutral parent, child and sibling
  output; its existing ghost/custom assertions remain passing. Focused result:
  1 file / 7 tests. Post-repair full result: 64 files / 754 tests, build passed,
  and `git diff --check` exited 0.

## Review

### Findings

- **Significant — an ambiguous role holder can receive a gendered family term
  instead of the required neutral fallback.** Duplicate-ID people are emitted
  as `ambiguous:*` nodes while retaining each source person's `gender`
  (`src/graph/build-snapshot.ts:177-179`,
  `src/graph/build-snapshot.ts:477-488`). Incident-row presentation then passes
  `selected.gender` to the family-term mapper without excluding an ambiguous
  selected node (`src/render/relationship-rows.ts:45-46`). A path-resolved
  relationship incident to an ambiguous person whose note says `woman` or
  `man` can therefore render mother/father, daughter/son or sister/brother,
  contrary to focused-spec clause 21's mandatory neutral fallback for an
  ambiguous person. The new ambiguous-row assertion does not catch this
  because its fixture has no gender (`test/relationship-rows.test.ts:53-63`,
  `test/relationship-rows.test.ts:202-213`). This is presentation-only and
  causes no write, but it leaves an explicit acceptance criterion unmet.

### Verdict

`concerns`

The selector, reciprocal role mapping, canonical Save payload, template/manual
refresh, endpoint-own gender mapping for canonical people, literal-role
preservation, in-place modal behavior, documentation and no-inference scope
were otherwise supported by the inspected source and assertions. The ticket is
not closable until the ambiguous-role-holder fallback and its regression proof
are repaired or the user explicitly accepts that contract deviation.

### Residual Risk

The executor's journaled focused/full tests, build and `git diff --check` were
accepted and not repeated. Browser automation still does not prove live
Obsidian Mobile, Electron pop-outs or assistive technology; standalone/Bases
term parity is structurally shared through `AtlasSnapshot` and the common
renderer rather than newly live-tested in both Obsidian surfaces. The
pre-existing user-owned `manifest.json` author-name change remains unrelated
to this ticket and was not reviewed as implementation scope.

### Fresh re-review — 2026-07-31

#### Findings

None.

#### Verdict

`pass`

The authorized repair resolves the preserved significant finding.
`isResolvedAtlasPersonNode()` admits only a `kind: "person"` node with a
usable file path outside the reserved `ambiguous:*` namespace. Duplicate-ID
output nodes therefore cannot contribute their retained gender, and ghosts
also supply no gender. The shared term mapper consequently returns neutral
`parent`, `child` and `sibling` for those role holders, while uniquely
resolved canonical people retain their own-gender terms and non-canonical
roles remain literal.

The inspected assertions are behavioral rather than presence-only: an
ambiguous `woman` is asserted neutral for parent and child, an ambiguous
`man` is asserted neutral for sibling, and the ghost and literal-custom cases
remain explicit. Canonical source and target perspectives assert their own
gender through configured `{role}` / `{person}` formats. The source/target
branch selects only the endpoint role; the same selected-node resolution gate
then applies symmetrically. Inferred linked-person rows still return before
role presentation, and the repair changes no form, selector, graph-building,
settings or mutation path.

#### Residual Risk

The repair-specific ambiguous fixtures select the ambiguous node as the first
endpoint; target-side behavior is supported by the branch-independent
selected-node predicate and existing two-perspective canonical assertions,
not a second duplicate fixture. The predicate also relies on the project's
existing reserved `ambiguous:*` node-ID namespace. The journaled focused and
full gates (64 files / 754 tests), build and `git diff --check` were accepted
without rerunning the full gates. Live Obsidian Mobile, Electron pop-outs and
assistive technology remain outside this automated evidence boundary.

## Retrospective

The KISS boundary held because the selector is a projection of the two role
strings rather than new persisted state, and one pure mapper serves both
preview surfaces. Keeping role-pair automation separate from gendered
presentation also made the no-write guarantee observable: the UI changes
neutral in-memory roles, while the renderer only consumes snapshot gender.
The deliberate limitation is that Custom is derived from any non-canonical
pair; it is not another form state that can drift from the role inputs.
The review repair reinforced that presentation capability must follow resolved
canonical identity, not merely fields carried on a snapshot node: ambiguous
nodes may retain source metadata for diagnostics but cannot safely use it to
refine relationship meaning.
