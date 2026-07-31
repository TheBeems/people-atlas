Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX3 — Person profile schema, editor and linked-people language

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-24-incremental-index-diagnostics.md`,
`.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`,
`.10x/tickets/2026-07-26-accessible-semantic-renderer.md`,
`.10x/tickets/2026-07-30-perspective-relationship-foundation.md`

## Scope

Implement the non-image-lifecycle portion of
`.10x/specs/person-profile-experience.md`:

- add configurable `birth_date`, pronouns, gender, emails, phones and job
  title properties through the next validated settings migration;
- extend person domain/index/graph/Bases contracts with optional profile data;
- validate and serialize the optional-year birth date as quoted
  `YYYY-MM-DD` or `--MM-DD`;
- extend person creation/editing with Basic, Profile, Contact details,
  Linked people and Advanced sections;
- preserve raw invalid legacy values until explicit repair;
- rename user-facing Contacts language to Linked people;
- add compact text/contact profile details while retaining the existing
  photo reference behavior for UX4.

This ticket is executable only after explicit user authorization.
Implementation has not started in this shaping turn.

## Non-goals

- Vault photo picker/preview, profile image or graph avatar.
- Birthday reminders, age calculation or birthday projection.
- External email/phone validation, sync or outbound communication.
- Arbitrary custom profile fields, address/social/employment history.
- Contact moments or follow-up.

## Acceptance criteria

- [x] Settings add default mappings for `birth_date`, `pronouns`, `gender`,
      `emails`, `phones` and `job_title` through one versioned migration that
      does not rewrite vault notes.
- [x] Person property collision validation prevents any configured profile
      field from overwriting type, identity, name or another owned person
      field.
- [x] Standalone parser, `PersonRecord`, graph snapshot/node data and Bases
      entry/options mapping carry the same optional profile values.
- [x] Birth-date parser accepts only calendar-valid quoted `YYYY-MM-DD` and
      `--MM-DD`; full leap years and yearless `--02-29` are covered.
- [x] Invalid birth dates/emails produce source-specific diagnostics without
      removing the person or silently changing raw frontmatter.
- [x] Person mutations write full/yearless birth values as strings, omit
      cleared fields and preserve unrelated frontmatter/body.
- [x] Pronouns, gender and job title remain optional free text and influence
      no relationship role/type/status or presentation behavior.
- [x] Email entries use minimal one-`@` validation and case-insensitive
      duplicate checks; phone values preserve user formatting and reject only
      empty/exact duplicates.
- [x] Person form uses Basic, Profile, Contact details, Linked people and
      Advanced groups with accessible labels/disclosures and logical narrow-
      width ordering.
- [x] A year-optional date control round-trips full/yearless values, converts
      clearing only year to `--MM-DD` and clears the property only after the
      complete control is cleared.
- [x] Invalid raw legacy values remain visible with inline errors and survive
      an unrelated changed-field-only save.
- [x] Existing same-folder rename confirmation, read-only identity,
      unresolved-link preservation and single-flight failure behavior remain.
- [x] Settings/person form/details use Linked people wording and explain the
      difference from Contact details and rich Relationships.
- [x] Selected-person details in standalone, Bases and the graph sheet show
      only present profile fields in the specified order.
- [x] Email/phone values stay out of canvas labels, list accessible names,
      diagnostics summaries and relationship descriptions.
- [x] Pure tests cover migration, collisions, parser diagnostics, date
      calendar edges, form round-trip, email/phone lists and minimal updates.
- [x] Browser/integration tests cover sections, disclosures, invalid raw data,
      list add/remove, profile presentation, Bases mapping and privacy of
      accessible names.
- [x] Existing person rename/contact, graph-delta, projection and renderer
      regressions remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/settings/{types,defaults,validate,migrations,settings-tab}.ts`
- `src/bases/{options,entry-adapter,people-atlas-bases-view}.ts`
- `src/domain/types.ts`
- `src/index/frontmatter.ts` and incremental index/delta dependencies
- `src/graph/{build-snapshot,graph-delta}.ts`
- `src/mutations/{validation,atlas-mutation-service}.ts`
- `src/editor/{person-form,person-modal}.ts`
- `src/render/atlas-renderer.ts`
- focused Node/browser/integration tests

The implementation SHOULD factor pure profile/date/list transformations away
from Obsidian DOM and vault APIs without introducing a generic form framework.

## References

- `.10x/specs/person-profile-experience.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: every new profile field is optional.
- User-ratified: `birth_date` is one property with optional year.
- Technical contract: the two unambiguous text forms are `YYYY-MM-DD` and
  `--MM-DD`; no native date-property/age behavior is promised.
- User-ratified: gender and pronouns are separate user-authored values and
  Contacts becomes Linked people.
- Record-backed: person IDs/path fallback and the current safe rename/contact
  behavior remain authoritative.

## Blockers

None. Bases carries the profile values through the shared snapshot contract,
and People Atlas preserves the two accepted birth-date forms as explicit
strings.

## Journal

- 2026-07-30: User selected one `birth_date` property with optional year and
  approved the recommended optional profile set.
- 2026-07-30: Governing spec activated and ticket opened for later explicit
  implementation. Photo asset/rendering work remains UX4/UX5.
- 2026-07-30: The user authorized the staged preflight and UX1 through UX7
  implementation program. UX3 started only after UX2 closed.
- 2026-07-30: Implemented settings schema v6, collision validation, shared
  standalone/Bases profile parsing, graph propagation, changed-only
  mutations, the five-section person form and selected-person presentation.
- 2026-07-30: Iterative adversarial review hardened exact birth-date and
  list-value typing, custom Bases delta mappings, per-entry legacy-value
  preservation, duplicate removal, live identity/type checks and profile
  privacy.
- 2026-07-30: Final review added fail-closed source/stat proof for tag-only
  person edits. Stale cache, removed tags and exact-source drift now abort
  before a host commit; frontmatter tags are rechecked in the serialized
  `processFrontMatter` callback.
- 2026-07-30: Closed after the final source state passed the full automated
  gate and the independent reviewer reported no blocking findings.

## Evidence

- Settings, migration, parser, graph, Bases, form, mutation, entrypoint,
  renderer and integration regressions cover every acceptance criterion,
  including invalid typed Bases values and custom mapping preservation.
- `test/person-source-guard.test.ts`, `test/mutation-service.test.ts` and
  `test/person-entrypoints.test.ts` prove current source/stat baselines,
  conservative Markdown tag recognition and zero host commits for stale
  body/frontmatter tag-only edits.
- `test/browser/person-modal.browser.test.ts` covers all five sections,
  accessible legacy errors, ordered list editing, birth-date clearing,
  stale links, cancel/failure, narrow layout and owning-document behavior.
- Final full gate: `npm run test` passed 46 files / 532 tests.
  `npm run build`, `npm run format:check`, `npm run lint` and
  `git diff --check` passed; Git reported only line-ending conversion
  warnings.

## Review

Fresh independent review verdict: no blocking findings; UX3 is closable.
Independent selections passed 470 Node tests, 9 integration tests and 33
browser tests plus typecheck and all hygiene gates. The reviewer explicitly
rechecked raw legacy preservation, Bases parity, accessible privacy and
zero-write stale tag-only behavior.

The supported host API leaves one narrow residual race for a tag that exists
only in the Markdown body between the last exact source/stat check and
Obsidian's internal `processFrontMatter` read. The boundary is documented in
code and is not safely removable without replacing the supported mutation
path. Automated Chromium evidence is not live Obsidian Desktop, Mobile,
Electron pop-out or assistive-technology certification.

## Retrospective

Raw legacy preservation is an entry-level provenance problem rather than only
a field-level one: repairing or deleting one list item must not normalize an
untouched sibling. Bases parity also requires checking value discriminators,
not only their string rendering. Finally, metadata-cache eligibility is not a
write-time authority for tag-only notes; an exact live-source baseline plus
the serialized frontmatter recheck is required to keep stale writes
fail-closed.
