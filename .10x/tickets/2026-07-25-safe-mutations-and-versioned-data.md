Status: done
Created: 2026-07-25
Updated: 2026-07-25

# P3a — Safe note mutations and versioned plugin data

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`

## Scope

Implement the active contract in
`.10x/specs/safe-mutations-and-versioned-data.md` for the smallest complete
write foundation: validated person/relationship note creation and editing,
`@`-based person linking and explicit person-note creation, optional manual
relationship status editing, and version-aware plugin data loading/migration.

The ticket is now executable. Implementation has not started in this shaping
turn.

## Non-goals

- Person merge or duplicate-resolution mutations.
- Unresolved-link conversion or bulk inbound-reference rewriting.
- A separate relationship-history store.
- New projection modes, layouts, worker work or renderer redesign.
- Full live Obsidian/mobile/browser integration coverage.

## Acceptance Criteria

- [x] A focused mutation service/API owns all supported person and
      relationship note writes.
- [x] An editor suggestion entrypoint resolves known people from `@` to
      `[[People/Name|@Name]]` and offers a clearly labelled create-person
      action for unknown names.
- [x] Creation and editing use the configured property names and preserve
      unrelated frontmatter and Markdown bodies.
- [x] Validation runs before writes and rejects invalid relationship values,
      invalid dates and identity collisions without partial updates.
- [x] Ordinary relationship editing supports optional manual status values,
      never infers status from `last_contact`, and retains unrelated metadata.
- [x] Plugin data loading uses explicit schema migrations and current-shape
      validation; unsupported future versions are not overwritten.
- [x] Successful vault writes are observed through the existing
      `PersonIndex`; no parallel relationship store is introduced.
- [x] Typing or dismissing an unknown `@` name does not write a note; only an
      explicit create selection can create one.
- [x] Focused tests cover pure validation/migration behavior, preservation of
      unrelated content, failure paths and lifecycle refresh after mutation.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `src/main.ts`
- `src/index/person-index.ts`
- `src/index/frontmatter.ts`
- `src/settings/types.ts`
- `src/settings/validate.ts`
- https://docs.obsidian.md/Plugins/Editor/Editor
- https://github.com/reorx/obsidian-people-link

## Assumptions

- Record-backed: P1 and P2 establish stable identity, configured property
  names, diagnostics and lifecycle refreshes.
- Record-backed: the current plugin data schema version is `1`.
- Record-backed: note parsing remains the canonical source after mutation.
- User-ratified: new plugin-created person notes use a configurable default
  `People/` folder and receive an automatically generated explicit
  `person_id`; manually authored legacy notes may continue to use the path
  fallback.
- User-ratified: relationship status is optional and manual; `last_contact`
  never infers or changes status, and no dedicated end action or separate
  history note is part of P3a.
- User-ratified: editor mentions use `@`, known people become
  `[[People/Name|@Name]]`, and unknown names are created only after selecting
  a clearly labelled create action in the default `People/` folder.
- User-ratified: migration failures preserve original plugin data, use safe
  defaults in memory only, show a recoverable error and block writes until
  repair or an explicit reset is accepted.

## Journal

- 2026-07-25: Source review found that note writes are not implemented; the
  only current persistence call is `saveData()` for plugin settings.
- 2026-07-25: Created a draft spec and shaping ticket. The ticket is not yet
  executable because three write semantics can change user-visible behavior
  and recovery guarantees.
- 2026-07-25: User ratified optional, manually authored relationship status;
  removed the dedicated end-action decision from the activation blockers.
- 2026-07-25: User ratified the `@` editor flow, explicit create action,
  default People folder and `[[People/Name|@Name]]` output form.
- 2026-07-25: User ratified the migration failure behavior; promoted the spec
  to `active` and made this ticket executable.
- 2026-07-25: Implemented schema-v2 migration loading, safe settings mode,
  configurable People-folder creation, validated person/relationship mutation
  APIs and the Obsidian `@` editor suggester.
- 2026-07-25: Added focused tests for migration, mention context, validation,
  path safety, note creation, identity-safe rejection and frontmatter
  preservation. Updated README documentation.
- 2026-07-25: Test and build gates passed; adversarial review found no critical
  or significant finding within the scoped contract.

## Blockers

None known for the scoped implementation.

## Evidence

- `src/mutations/atlas-mutation-service.ts` provides the single validated
  mutation boundary and uses `FileManager.processFrontMatter()` for edits.
- `src/settings/migrations.ts` migrates schema v1 to v2, rejects malformed or
  future data, and returns safe defaults with writes disabled on failure.
- `src/editor/mention.ts` and `src/editor/person-mention-suggest.ts` provide
  write-free trigger parsing, known-person linking and explicit create actions.
- `test/migrations.test.ts`, `test/mention.test.ts`,
  `test/mutation-validation.test.ts` and `test/mutation-service.test.ts` cover
  the new pure and mutation seams.
- `npm run test` passed: 12 test files, 33 tests.
- `npm run build` passed: TypeScript no-emit check and production esbuild.
- `git diff --check` passed. No generated build artifacts are tracked.

## Review

Verdict: pass.

Adversarial review checked the single mutation boundary, validation-before-write
ordering, duplicate ID rejection, path traversal rejection, preservation of
unrelated frontmatter, future-schema read-only behavior, write-free mention
typing and non-prose mention suppression.

Residual risk: the tests use focused fakes and pure editor-context helpers;
live Obsidian desktop/mobile editor rendering, suggestion keyboard behavior,
metadata-cache timing and pop-out behavior remain integration-harness work.

## Retrospective

Keeping editor trigger parsing pure made the safety boundary testable without a
live CodeMirror instance. The main implementation seam was to route both
ordinary note edits and `@`-created notes through the same mutation service;
otherwise the fast path would have bypassed validation and migration write
policy. A final review also caught that generated wikilinks needed to omit the
`.md` suffix to match the ratified Markdown contract.
