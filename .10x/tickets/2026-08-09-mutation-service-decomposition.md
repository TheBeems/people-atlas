Status: active
Created: 2026-08-09
Updated: 2026-08-09
Owner: People Atlas architecture-refactor workstream — mutation decomposition

# Mutation-service decomposition with one shared safety boundary

Parent: `.10x/tickets/2026-08-09-architecture-decomposition.md`
Depends-On: None beyond the active mutation, identity, contact-moment,
relationship and person-profile contracts listed below.

## Scope

Refactor `src/mutations/atlas-mutation-service.ts` into domain-specific
coordinators while retaining one stable `AtlasMutationService` façade and one
shared mutation-safety boundary.

The target responsibility seams are:

- **shared `MutationQueue` / transaction guard** — the existing exclusive
  ordering, write-enabled guard, lifecycle-safe serialization and the single
  place through which every mutating operation enters;
- **canonical resolution and identity reservations** — stable person,
  relationship and contact-moment resolution, ambiguity rejection, path/ID
  canonicalization and reservation state shared by all coordinators;
- **`PersonMutationCoordinator`** — person create/edit, source baseline and
  person classification guards, profile/frontmatter updates and photo-asset
  side effects;
- **`RelationshipMutationCoordinator`** — relationship create/edit,
  endpoint/role/identity validation and relationship frontmatter generation;
- **`ContactMomentMutationCoordinator`** — contact-moment create/edit,
  follow-up status, optional monotonic `last_contact` advancement, baselines,
  partial success and stale-safe retry;
- **`RelationshipPresetSyncCoordinator`** — explicit preset-owned property
  synchronization and its already-defined stale/already-current outcomes;
- **pure serializers/validators where justified** — frontmatter generation and
  normalization may move behind small typed helpers, but existing pure modules
  must be reused and not duplicated.

`AtlasMutationService` remains the façade consumed by `main.ts`, editor modals,
views and tests. Its public methods, error/result types and observable write
ordering remain compatible.

The exact module filenames may follow repository naming conventions. The
mandatory boundary is that domain coordinators share the same queue, guard,
canonical resolver and reservation state rather than each implementing a
slightly different safety path.

## Non-goals

- No new mutation behavior, transaction guarantee, rollback claim or storage
  schema.
- No person merge, bulk rewrite, relationship deletion, new migration or
  external synchronization.
- No weakening of validation-before-write, frontmatter preservation,
  duplicate-identity rejection, baseline checks or explicit-save semantics.
- No bypass around `FileManager.processFrontMatter()`, the existing index
  lifecycle or the public mutation façade.
- No generic dependency-injection framework, speculative repository layer or
  abstraction that has only one caller.
- No change to user-facing diagnostics/copy, partner/parent terminology,
  partial-success semantics, retry semantics or preset copy-not-live behavior.

## Acceptance Criteria

- [ ] `AtlasMutationService` retains equivalent public methods and result/error
      contracts for person, relationship, contact-moment, retry and preset-sync
      operations.
- [ ] Every supported write enters one shared queue/transaction guard. No
      coordinator can perform a vault write by bypassing that boundary.
- [ ] Canonical resolution and identity reservations are shared across person,
      relationship and contact-moment paths; duplicate, ambiguous, stale and
      path/ID-collision behavior remains fail-closed.
- [ ] Person, relationship, contact-moment and preset-sync responsibilities are
      independently testable and do not duplicate frontmatter/property rules.
- [ ] Contact-moment partial success remains truthful: the moment write stays
      durable, the optional relationship update remains separately retryable,
      and retry revalidates current baselines before writing.
- [ ] Existing frontmatter generation, configured-property mapping, unrelated
      frontmatter/body preservation and index-refresh behavior remain
      semantically equivalent.
- [ ] Existing validation, mutation-service, contact-moment, preset-sync,
      entrypoint and integration tests remain passing; focused tests cover the
      queue/guard, shared resolution/reservation and coordinator delegation
      seams without weakening safety assertions.
- [ ] At minimum the relevant suites include
      `test/mutation-service.test.ts`, `test/mutation-validation.test.ts`,
      `test/contact-moment-mutation.test.ts`,
      `test/contact-moment-entrypoints.test.ts`,
      `test/relationship-preset-bulk-sync.test.ts`,
      `test/person-source-guard.test.ts` and
      `test/integration/people-atlas-plugin.integration.test.ts`.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass for the final
      child state.

## References

- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/mutations/atlas-mutation-service.ts`
- `src/mutations/validation.ts`
- `src/mutations/contact-moment.ts`
- `src/mutations/person-source-guard.ts`
- `src/index/person-index.ts`
- `src/settings/relationship-preset-sync.ts`
- `test/mutation-service.test.ts`
- `test/contact-moment-mutation.test.ts`
- `test/relationship-preset-bulk-sync.test.ts`

## Assumptions

- User-ratified on 2026-08-09: mutation decomposition is one child of the
  architecture parent and must preserve behavior, public service entrypoints
  and existing tests.
- Record-backed: the active mutation and contact-moment specs require explicit
  writes, validation before writes, unrelated-content preservation, canonical
  identity, partial-success truthfulness and stale-safe retry.
- Record-backed: `AtlasMutationService` is the current single write boundary;
  the refactor must preserve that role even when implementation is delegated.
- Mechanical: exact coordinator filenames and private helper placement may
  follow the smallest safe seam found during source inspection.

## Journal

- 2026-08-09: Source inventory measured `src/mutations/atlas-mutation-service.ts`
  at 81,261 bytes. Its current class combines person, relationship,
  contact-moment, partial-success/retry, canonical resolution, identity
  reservations, baselines, frontmatter generation and preset synchronization.
- 2026-08-09: The shared-queue plus domain-coordinator boundary was recorded as
  the intended internal split. No source or test change was made while opening
  this ticket.
- 2026-08-09: Implemented person, relationship and contact-moment coordinators
  behind the existing `AtlasMutationService` queue/transaction guard. Added a
  coordinator-boundary test without introducing a second queue, reservation or
  transaction safety boundary.

## Blockers

None known for shaping. Stop before implementation if the split would require a
second write queue, duplicated canonical resolver, weaker reservation scope,
changed partial-success/retry behavior or a public façade change.

## Evidence

- Historical source-inventory baseline: `stat` on 2026-08-09 reported
  `src/mutations/atlas-mutation-service.ts` at 81,261 bytes before the
  implementation slice.
- Source declaration inventory identified the public mutation façade and the
  current private clusters for person, relationship, contact-moment, retry,
  canonical resolution, baseline, reservation, frontmatter and preset sync.
- Relevant unit and integration test files exist in the current worktree.
- Historical record-authoring note: no implementation, focused test, build or
  full gate ran while opening this record.
- 2026-08-09 current evidence under Node v24.19.0: mutation coordinator-boundary
  tests, mutation-service tests, contact-moment mutation tests, entrypoint and
  integration tests, full test (56 files/971 tests), production build and
  `git diff --check` pass. The authoritative independent review is **PASS**;
  the shared `runExclusive`/queue path remains the only mutation safety
  boundary. It records only a non-blocking test-coverage observation.

## Review

2026-08-09 authoritative independent read-only implementation review: **PASS**.
The coordinator delegation and shared queue/transaction/reservation boundary
were inspected without a critical or significant finding.

## Retrospective

Pending until execution. Capture whether the shared queue/guard remained
obvious, whether any identity or baseline rule was accidentally duplicated, and
which extracted pure seam should be retained as project knowledge.
