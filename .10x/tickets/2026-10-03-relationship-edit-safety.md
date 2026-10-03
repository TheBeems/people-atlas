Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: `.10x/tickets/2026-10-03-audit-remediation.md`

# Safe relationship editing

## Scope

Implement `.10x/specs/relationship-edit-source-safety.md`: protect open editors
and atomic writes against source drift and replace ID-first endpoint prefill.

## Non-goals

No unrelated UI redesign, index optimization, real-vault changes or release.

## Acceptance criteria

- All six governing specification scenarios have regression tests.
- Existing callers, mappings, queue and preservation behavior remain supported.
- Current-source ambiguity never silently selects another person.

## References

- `.10x/specs/relationship-edit-source-safety.md`
- `.10x/specs/person-reference-resolution.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`

## Assumptions

User-ratified audit fixes; existing person/contact guards provide conventions.

## Journal

- 2026-10-03: Opened from confirmed synthetic audit regressions.
- 2026-10-03: Executor read the governing source-safety specification and existing
  reference/mutation contracts. Implemented an immutable owned-frontmatter
  baseline captured when the relationship modal is constructed, passed through
  the form/coordinator/queue, and checked against both current metadata and the
  atomic processFrontMatter callback. Direct callers capture an operation
  baseline. Endpoint prefill now delegates to the shared typed resolver and
  leaves unresolved/ambiguous selections empty. No real vault or external writes.
- 2026-10-03 scope clarification from orchestrator: ambiguity requires explicit
  repair; merely unresolved historical references retain their raw text and
  remain eligible for unchanged-endpoint metadata editing. The governing spec
  now distinguishes these cases. The picker shows unresolved raw text without
  treating it as a canonical person, and no raw-text fallback may acquire a
  conflicting canonical path selection.
- 2026-10-03: Added normal Vitest regressions for owned-field source signatures,
  fresh-cache editor drift, live callback drift, custom mappings, unrelated
  frontmatter/body preservation, explicit ID edits, modal-entrypoint baselines,
  shared-reference cases and unresolved picker presentation. Initial native
  tests were blocked by the device runtime; official WASI config loaders loaded
  but failed resolving Windows imports before assertions. A later fresh native
  invocation worked without any product/dependency/security-setting change.
- 2026-10-03: A new entrypoint integration assertion initially hit the legacy
  test fixture's mutation service, constructed before its fake app was attached.
  The test now instantiates the real mutation service with the initialized fake
  app and asserts zero host calls. Product source was not changed to satisfy
  that fixture correction.

## Blockers

None for this scope. Independent review passed and the parent-owned full
`npm run test`, build and package gates passed on 2026-10-03. No native Obsidian
or real-vault write test was performed.

## Evidence

- Node v24.19.0, focused native command:
  `node node_modules/vitest/vitest.mjs run --project node
  test/relationship-source-guard.test.ts test/relationship-form.test.ts
  test/mutation-service.test.ts test/mutation-coordinator-boundaries.test.ts
  test/relationship-entrypoints.test.ts --no-file-parallelism --maxWorkers=1`:
  initial focused set passed 5 files / 197 tests. After adding three real
  entrypoint checks, the other 197 assertions passed while those three exposed
  the test fixture issue above. Final isolated entrypoint rerun passed 19/19;
  all current focused assertions are covered by those runs (200 total).
- Browser command with `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge`, normal Vitest
  browser project, files `relationship-modal.browser.test.ts` and
  `relationship-person-picker.browser.test.ts`, serial execution: **2 files /
  33 tests passed**, exit 0. Includes raw unresolved reference presentation,
  canonical keyboard selection, baseline forwarding and existing modal flows.
- `npm run typecheck`: passed before and after the final fixture-only entrypoint
  correction; the final scoped diff check also passed (line-ending notices only).
- Biome format applied to only the 12 owned source/test files; scoped
  `git diff --check`: exit 0 (line-ending notices only).
- Prior bounded in-memory esbuild/Node assertion harness: 15 synthetic source,
  atomic callback, editor and resolver cases passed. The later normal Vitest
  results are the primary evidence and cover the clarified legacy-reference
  contract.
- Scenario mapping: spec 1/3 -> fresh-cache mutation cases and modal entrypoint
  regressions; spec 2 -> atomic callback cases; spec 4 -> custom-mapped
  preservation regression; spec 5 -> collision/explicit repair form tests;
  spec 6 -> ID/path/same-person and retained-unresolved form tests. The positive
  explicit relationship-ID edit is separately covered in mutation-service tests.

## Review

2026-10-03 independent review by `ui_code_review`: **PASS**. Reviewed the
governing source-safety/reference/mutation contracts, changed source, and
scenario assertions; the executor's tests were not rerun.

- Findings: no critical, significant, minor or nit findings in this change.
  The detached owned-field signature covers classification, identity, mappings
  and edited metadata. Both cached preflight and the atomic callback compare
  it before any assignment; unrelated properties remain outside the signature.
- Adversarial opening-baseline check: `main.ts`'s canonical resolver reparses
  the current metadata cache, and `CanonicalEntryPointResolver.resolveRelationship`
  requires its identity to match the unique indexed record. The modal therefore
  receives current values, followed synchronously by baseline capture. There is
  no asynchronous gap in this supported opening path. The entrypoint regressions
  exercise both newer owned values and changed identity before opening, as well
  as changes after opening. The suspected old-record/new-baseline combination
  is not a reachable supported entrypoint regression.
- Endpoint review: shared resolution retains ambiguity instead of acquiring a
  competing ID/path selection; blank ambiguous endpoints block submission until
  explicit repair. Unchanged unresolved legacy raw values remain visible and
  are excluded from the update payload. Changed endpoints still require a
  canonical person from the fresh person population.
- Evidence review: source-guard property/mapping cases, mutation host-commit
  assertions, custom-field/body preservation, positive explicit ID edits, modal
  baseline forwarding and collision/repair assertions substantiate all six
  acceptance scenarios. Reported 200 focused Node assertions and 33 Edge browser
  tests remain executor evidence, not an independent native Obsidian run.
- Residual boundary: full repository gates remain parent-owned; actual Obsidian
  host callback semantics and real-vault interaction were not exercised. This
  review introduces no product changes and does not close the ticket.

## Retrospective

- Capture the baseline at the form-opening boundary; a write-time cache snapshot
  alone cannot detect an editor acting on a replaced relationship identity.
- Keep ambiguity and unresolved history distinct: the shared resolver owns the
  classification, while unchanged legacy references can be preserved safely.
- Native test-runtime failures were environmental and occurred before assertions;
  record them separately from the fixture failure and current passing results.
