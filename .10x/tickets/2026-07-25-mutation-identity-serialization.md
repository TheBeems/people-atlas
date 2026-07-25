Status: done
Created: 2026-07-25
Updated: 2026-07-25

# Serialize explicit-identity mutations

Parent: `.10x/tickets/2026-07-25-audit-remediation-plan.md`
Depends-On: `.10x/tickets/2026-07-25-incremental-graph-equivalence.md`

## Scope

Prevent overlapping supported person and relationship mutations from passing
the same stale index uniqueness check and introducing a duplicate explicit ID.
Use one small in-process mutation coordination boundary, revalidate inside that
boundary and preserve the existing validation-before-write contract.

## Non-goals

- Cross-device or cross-plugin distributed locking.
- Person merge or duplicate repair.
- New mutation UI.
- Changing generated-ID or path semantics.

## Acceptance Criteria

- [x] A focused concurrent-create regression fails before the repair.
- [x] Two overlapping person creations cannot both commit the same explicit
      `person_id`.
- [x] The equivalent relationship-ID and update paths use the same coordination
      boundary where they can introduce an identity collision.
- [x] Validation still completes before the first vault mutation in each
      coordinated operation.
- [x] A rejected operation leaves unrelated notes and frontmatter unchanged.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/evidence/2026-07-25-audit-regressions.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `src/mutations/atlas-mutation-service.ts`
- `test/mutation-service.test.ts`

## Assumptions

- User-ratified: execute the audit recommendation.
- Record-backed: supported mutations must reject identity collisions before
  writing.
- Mechanical: in-process serialization is sufficient for the plugin-owned
  mutation boundary; live external vault edits remain index diagnostics.

## Journal

- 2026-07-25: Opened after an audit harness allowed two concurrent person
  creations with one generated ID to create two distinct notes.
- 2026-07-25: Execution started after the incremental-equivalence dependency
  closed. The implementation will use one service-wide queue plus short-lived
  path-owned identity reservations so a successful write remains protected
  while the canonical index catches up.
- 2026-07-25: Added concurrent create and update regressions for both identity
  kinds. Baseline `npx vitest run test/mutation-service.test.ts` result: 3
  passed and 2 failed; both failures show two fulfilled person mutations where
  one must be rejected.
- 2026-07-25: Routed all supported person and relationship creates/updates
  through one rejection-safe service queue. Successful writes reserve their
  normalized effective identity until the asynchronous index observes the
  owner, closing the stale-index window without introducing another graph
  store.
- 2026-07-25: Fresh review found that a metadata-cache lag immediately after a
  create could replace its explicit reservation with a path fallback during an
  unrelated update. The update paths now retain the path-owned reservation
  until metadata catches up, and explicit update IDs are normalized before
  collision checks.
- 2026-07-25: Focused verification passed with 6/6 mutation-service tests.
  Full verification passed with 14/14 test files and 51/51 tests, followed by
  a successful production build and `git diff --check`.

## Blockers

None known.

## Evidence

- Before repair: the focused concurrency harness reported 3 passing and 2
  failing tests because both same-ID person operations fulfilled.
- After repair: `npx vitest run test/mutation-service.test.ts` — 1 file and 6
  tests passed.
- Repository gate: `npm run test` — 14 files and 51 tests passed.
- Build gate: `npm run build` — TypeScript no-emit check and production esbuild
  completed successfully.
- Hygiene gate: `git diff --check` passed; only existing Windows line-ending
  conversion warnings were reported.

## Review

Pass. Every supported mutation enters the same queue, and each operation
finishes validation and collision detection before `ensureFolder()`,
`vault.create()` or `processFrontMatter()`. The queue remains usable after a
rejection. Path-owned reservations cover index/cache lag, normalized explicit
IDs cannot bypass collision detection with surrounding whitespace, and
rejected updates leave unrelated frontmatter untouched.

Residual risk is limited to the ticket's explicit non-goal: external
cross-plugin or cross-device edits are not transactionally locked with this
in-process boundary and remain dependent on the normal index diagnostics.

## Retrospective

A single service queue is deliberately broader than per-ID locking, but keeps
the correctness boundary small and auditable for the current low-volume,
user-invoked mutations. The reservation layer is only needed because Obsidian
index/cache observation is asynchronous; an awaitable index acknowledgement
would let a later implementation remove it.
