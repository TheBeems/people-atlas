Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX6 — Contact-moment Markdown entity and logging flow

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-30-relationship-context-actions.md`,
`.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`,
`.10x/tickets/2026-07-30-person-profile-schema-editor.md`,
`.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`

## Scope

Implement the storage/index/mutation/form portion of
`.10x/specs/contact-moments-follow-up.md`:

- add versioned contact-moment folder/type/property settings;
- add first-class contact-moment identity, records and diagnostics to the
  canonical index without adding graph nodes/edges;
- create one shared Log/Edit form for canonical people, optional matching
  relationship, occurred date, channel, summary and follow-up values;
- add global, active-person, selected-person and active-moment entrypoints;
- create reviewable collision-safe Markdown notes and preserve their bodies on
  edits;
- implement unchecked, explicit, monotonic `last_contact` advancement;
- make cross-note partial success visible and retryable without duplicate
  moment creation.

Renderer history/follow-up surfaces belong to UX7.

This ticket becomes executable only after its dependencies are done and the
user explicitly authorizes implementation.

## Non-goals

- Follow-up list/history rendering beyond entrypoint capability plumbing.
- OS/mobile notifications, scheduled background jobs or calendar/tasks.
- Contact-moment inference from notes/backlinks/email/meetings.
- Relationship status/type/role/closeness inference.
- Moment delete/rename/move/merge or automatic last-contact rollback.

## Acceptance criteria

- [x] Settings migration adds the configured `contact_moment` type plus
      contact-moment folder, ID, people, relationship, occurred-on, channel,
      summary, follow-up date and follow-up status mappings without rewriting
      vault notes.
- [x] Type values and owned contact-moment property names are validated for
      non-empty/distinct safety and the folder is vault-relative.
- [x] `ContactMomentId`/`ContactMomentRecord` and raw/index-delta contracts
      preserve explicit ID with normalized path fallback for manual legacy
      notes.
- [x] Plugin-created notes always receive a generated explicit moment ID.
- [x] Parser requires at least one unique canonical person and full valid
      `occurred_on`; optional relationship must be canonical/note-backed and
      share at least one moment person.
- [x] Unresolved/ambiguous people, missing relationship, person/relationship
      mismatch, duplicate ID and invalid date/status each produce stable
      source-path diagnostics without guessed resolution.
- [x] Contact moments are indexed/incrementally invalidated but never create
      `AtlasNode` or `AtlasEdge` values.
- [x] The shared create/edit form exposes canonical people, matching optional
      relationship, local-date default, channel, summary, follow-up and
      Advanced path/ID fields with explicit Save/Cancel.
- [x] Global Log contact opens blank unless one active canonical person can be
      safely prefilled; selected-person actions reject ghosts/ambiguity/stale
      paths.
- [x] `Edit current contact moment` and a path-based edit entrypoint load only
      canonical current moment notes and preserve Markdown body/unowned
      frontmatter.
- [x] Create proposes the configured-folder path
      `YYYY-MM-DD - <Primary person> - <short-id>.md`, keeps it reviewable and
      rejects existing destinations without overwrite/implicit suffix.
- [x] Successful creation opens the new note for arbitrary Markdown body
      authoring.
- [x] Follow-up date/status validation implements open/done/dismissed exactly;
      status without a valid date is diagnostic/non-actionable.
- [x] The last-contact checkbox appears only for a valid relationship and is
      unchecked on every open.
- [x] When checked, relationship `last_contact` advances only if occurred-on
      is later; equal/later current values are preserved and explained.
- [x] Last-contact update changes no relationship status/template/roles/types
      or unrelated frontmatter.
- [x] All inputs for both potential notes validate before the first write.
- [x] If the contact moment succeeds and relationship update fails, the form
      enters a non-duplicating partial-success state naming both paths/reason
      and offers an idempotent stale-safe retry of only the relationship.
- [x] Cancel/close is write-free, submission/retry are single-flight and
      later editing/deleting never silently recomputes last contact.
- [x] Pure tests cover settings/schema, parsing/diagnostics, path/ID,
      canonical matching, form mapping, collision, monotonic date logic and
      partial-retry state.
- [x] Integration tests cover lifecycle deltas, body preservation, global/
      active/selected/edit entrypoints and two-file failure ordering.
- [x] Browser tests cover labels/focus, unchecked default, success/partial
      result, retry and cancellation.
- [x] Existing person/relationship/index/mutation regressions remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/settings/`: contact-moment configuration and next migration.
- `src/domain/types.ts`: identity/record/delta/diagnostic extensions.
- `src/index/`: parsing, dependencies and incremental lifecycle.
- `src/mutations/`: contact-moment validation/create/update plus coordinated
  optional relationship advancement.
- `src/editor/`: pure contact form/session and Obsidian modal.
- `src/main.ts`: commands/path-based entrypoints.
- standalone/Bases selected-person capability callbacks.
- focused Node, integration and browser tests.

The contact-moment parser and pure form/session logic MUST remain outside
renderer/Obsidian DOM concerns. Any multi-file coordinator must expose its
declared partial state rather than pretending Obsidian writes are atomic.

## References

- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/tickets/2026-07-30-person-profile-schema-editor.md`
- `.10x/research/2026-07-25-obsidian-people-needs.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: contact moments are separate Markdown notes and may link one
  optional relationship.
- User-ratified: last-contact update is explicit and status is never inferred.
- Technical contract: occurred/follow-up dates are full `YYYY-MM-DD`, and the
  unchecked advancement is monotonic.
- Record-backed: `FileManager.processFrontMatter()` plus serialized mutation
  coordination remains the supported write boundary.

## Blockers

None known. Stop and record a blocker if the index cannot distinguish a new
contact-moment type without broad full-vault rescans, or if partial-success
retry cannot revalidate both notes without risking duplicate creation or stale
overwrite.

## Journal

- 2026-07-30: User ratified separate Markdown contact moments, explicit
  last-contact updates and follow-up without status inference.
- 2026-07-30: Storage/mutation ticket split from UX7 rendering and opened for
  later implementation. No schema or vault file was changed.
- 2026-07-30: Implemented settings schema v7, canonical contact-moment
  parsing/indexing, one shared create/edit form, all requested entrypoints and
  explicit monotonic relationship `last_contact` advancement. Two-file
  partial success is visible and retries only the relationship against exact
  current note state.
- 2026-07-30: Adversarial review found conflicting ID/path references,
  extensionless dependency invalidation, stale edit snapshots and owned
  fields, retry navigation, and stable-ID relationship labels. Each finding
  was repaired with a regression before closure.

## Evidence

- Settings/parser/index/domain/mutation/form tests cover schema migration,
  diagnostics, dependency invalidation, canonical matching, collision
  rejection, body preservation, monotonic dates and partial retry.
- Entrypoint/integration coverage proves global blank, active-person,
  standalone-selected, Bases-selected and active-moment edit routes use the
  shared form with current canonical records.
- Controlled Chromium covers explicit labels/focus, unchecked advancement,
  successful create/open, visible partial state, retry-only completion,
  stable-ID relationship labels and cancellation.
- Final gates: `npm run test` passed 60 files / 694 tests; `npm run build`,
  `npm run format:check`, `npm run lint` and `git diff --check` passed after
  scoped formatting.
- Automated evidence does not certify live Obsidian Desktop/Mobile,
  Electron pop-outs, assistive technology or a production vault.

## Review

Three independent read-only reviews covered domain/index/delta, safe
mutation/form behavior and modal/entrypoint/render adapters. All significant
findings were repaired and re-reviewed; no blocker or unresolved
contract-level finding remained.

## Retrospective

Keeping contact moments out of graph adjacency made the new entity additive.
The riskiest boundaries were not the form fields but cross-identity
resolution, dependency-key normalization and exact-stale edit/retry
semantics. Those contracts now have focused regressions. History and
follow-up presentation remain explicitly owned by UX7.
