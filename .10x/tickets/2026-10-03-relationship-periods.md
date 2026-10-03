Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md

# Explicit relationship periods and desired contact cadence

## Scope

Add optional mapped until and contact_interval_days through parsing, snapshots/deltas, forms, mutation validation/source guards, settings and presentation. Implement pure period filtering and cadence computations with explicit date semantics.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Valid/invalid/reversed/leap dates, cadence boundaries, owned-field drift, preservation and snapshot/delta equivalence have regression coverage. No inferred status, roles or last contact.

## References

- .10x/specs/relationship-periods-and-network-insight.md
- AGENTS.md
- .10x/tickets/2026-10-03-product-improvements.md

## Assumptions

User-authorized current recommendations and contract refinements. Existing domain,
lifecycle, owning-window, canonical-ID and explicit-write fences are mandatory.

## Side effects and premortem

Only explicit user-confirmed note/plugin-data actions in product code may write.
Opening, rendering, searching, previewing, cancellation and pure computations MUST
write nothing. Exact source/path/identity/mapping drift is the principal loss risk;
preflight plus atomic callback validation prevents stale overwrite. No recipients,
notifications, retention/deletion, money or external service changes exist here.
Executors use synthetic fixtures only and preserve existing user-data boundaries.

## Journal

- 2026-10-03: Opened under the explicit implementation instruction.
- 2026-10-03: Executor read this ticket, the periods/network specification and referenced role, source-safety, projection/state and mutation contracts. Repository-local 10x skill is absent; inspected the installed 10x skill fallback, as confirmed by orchestration. Existing uncommitted changes are retained. Coordinated shared-file ownership with discovery and recovery executors before editing.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- Final focused node command `npx vitest run --project node test/relationship-periods.test.ts test/network-insight.test.ts test/network-view-state.test.ts test/relationship-form.test.ts test/relationship-source-guard.test.ts test/frontmatter-diagnostics.test.ts test/mutation-validation.test.ts test/mutation-service.test.ts test/layout-state.test.ts test/bases-profile-mapping.test.ts test/project-graph.test.ts` passed 11 files / 290 tests on 2026-10-03. This covers actual parsed invalid/reversed periods, no cadence coercion, explicit observations, duplicate relationship identity diagnostics, full/delta field equivalence, source conflict callback guards, custom mappings/unrelated YAML/body preservation, historical ego membership and compatible date/family state and native Bases options. `npx tsc --noEmit` exited 0 with no diagnostics at the source handoff. These checks do not prove real-vault behavior.
- Focused Edge browser command `npx vitest run --project browser test/browser/network-insight.browser.test.ts test/browser/relationship-modal.browser.test.ts --no-file-parallelism` passed 2 files / 34 tests, including native date/interval fields, zero writes for invalid interval and explicit removal/edit payloads. No real Obsidian installation or vault was used.
- Existing protective settings-snapshot regression remains unchanged and passes: editor-open → mutation mapping drift rejects, but once a write is validated its detached settings snapshot stays authoritative inside the host callback. A concurrent settings change cannot redirect the approved until/interval write to another property. New regression extends this behavior to period mappings.
- Independent parent review requested explicit authored `Date`/number inputs. Added two parser regression cases covering since/until/last_contact and contact-moment dates, requiring consistent diagnostics and unchanged authored values. First targeted run exposed a synthetic contact classification typo (`contact-moment` versus configured `contact_moment`); correcting only the fixture made `npx vitest run --project node test/relationship-periods.test.ts` pass 1 file / 29 tests. No production source change was required.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Independent period/cadence review is PASS. See
`2026-10-03-integration-validation.md` for exact evidence and native-host limits.

2026-10-03, root reviewer: PASS for the final period/cadence source and recorded
focused evidence. Reviewed strict authored date/interval parsing, dedicated
invalid-period diagnostic fences, canonical duplicate-relationship exclusion,
calendar arithmetic and observed-contact selection. Fields propagate through
full/delta snapshots, mapped editors, source guards and explicit updates without
changing status or unrelated YAML/body. The approved detached mapping remains
authoritative inside the validated host callback. Inspected tests and executor
outcomes without repeating green checks. Final integrated gates remain pending;
native Obsidian behavior is not claimed.

## Retrospective

- Parsed invalid bounds cannot be treated as unknown bounds in historical/cadence results. A dedicated period diagnostic fences both pure transformations, including after incremental/full snapshot construction. Duplicate relationship IDs require diagnostic source-path fencing because graph edge IDs are disambiguated for rendering. Bases retains admitted-only redacted ambiguity evidence; excluded paths remain private.
