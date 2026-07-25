Status: done
Created: 2026-07-25
Updated: 2026-07-25

# Coordinate and coalesce view-state writes

Parent: `.10x/tickets/2026-07-25-audit-remediation-plan.md`
Depends-On: `.10x/tickets/2026-07-25-mutation-identity-serialization.md`

## Scope

Make plugin-data persistence for view/layout state ordered and bounded:

- newer view-state changes must not be overwritten by an older async save or
  rollback;
- rapid wheel zoom changes must coalesce instead of saving on every event;
- the latest completed interaction must still be flushed on view close;
- save failures must retain a usable in-memory view and surface the existing
  recoverable notice.

## Non-goals

- Vault-note writes.
- Changing view-state schema or layout-key identity.
- Syncing state across devices or separate vaults.
- P5 gesture or renderer accessibility redesign.

## Acceptance Criteria

- [x] A focused asynchronous harness proves write ordering and failure
      rollback behavior.
- [x] Rapid wheel events do not invoke plugin persistence once per event.
- [x] The last coalesced layout is flushed before view teardown completes.
- [x] Distinct view keys remain isolated and concurrent saves do not discard
      either key.
- [x] Existing schema-v3 migration, view-state and layout tests continue to
      pass.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/evidence/2026-07-25-audit-regressions.md`
- `.10x/specs/projection-modes-layout-state.md`
- `src/main.ts`
- `src/render/atlas-renderer.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`

## Assumptions

- User-ratified: execute the audit recommendation.
- Record-backed: view state is plugin data and must never write Markdown notes.
- Mechanical: a short trailing coalescing window and one serialized save chain
  are reversible implementation choices, not new domain semantics.

## Journal

- 2026-07-25: Opened from source inspection showing fire-and-forget saves and
  one persistence callback per wheel event.
- 2026-07-25: Execution started after the mutation-identity dependency closed.
  The focused harness will first reproduce out-of-order persistence, rollback
  and wheel-event amplification before implementation changes.
- 2026-07-25: Added a plugin-level asynchronous regression harness. Baseline
  `npx vitest run test/view-state-write-coordination.test.ts` failed 2/2:
  rejecting the older of two overlapping saves rolled both view keys back to
  defaults, and three rapid same-key updates invoked `saveData()` three times
  instead of once.
- 2026-07-25: Added a 120 ms trailing coalescer with one rejection-safe write
  chain. Pending state remains available to the owning view, actual
  `saveData()` calls are serialized, and standalone/Bases teardown explicitly
  flushes the latest layout before destroying the renderer.
- 2026-07-25: Fresh review found that ordinary settings persistence could
  still race the new view-state chain and overwrite a newer view-state
  snapshot. `updateSetting()` now shares the same serialized plugin-data
  boundary, with a focused cross-route regression.
- 2026-07-25: Focused verification passed with 5/5 coordination tests. Full
  verification passed with 15/15 test files and 56/56 tests, followed by a
  successful production build and `git diff --check`.

## Blockers

None known.

## Evidence

- Before repair: the focused plugin harness failed 2/2, demonstrating both
  out-of-order rollback and one `saveData()` call per rapid update.
- After repair: `npx vitest run
  test/view-state-write-coordination.test.ts` — 1 file and 5 tests passed,
  covering failure rollback, same-key coalescing, explicit flush, distinct-key
  preservation and ordering with ordinary settings writes.
- Repository gate: `npm run test` — 15 files and 56 tests passed, including the
  existing schema-v3 migration, view-state and layout suites.
- Build gate: `npm run build` — TypeScript no-emit check and production esbuild
  completed successfully.
- Hygiene gate: `git diff --check` passed; only existing Windows line-ending
  conversion warnings were reported.

## Review

Pass. The coalescer snapshots caller-owned state, exposes the latest pending
state without coupling view keys, settles every coalesced caller after the
single resulting write, and keeps its queue usable after a rejection. The
plugin performs rollback only inside that serialized boundary, so neither
later view-state writes nor ordinary settings writes can be undone by an older
completion. Standalone close awaits its flush; the synchronous Bases unload
contract empties the coalescing buffer and starts the ordered write before
renderer teardown.

Residual risk: live Obsidian shutdown timing and real Bases reload behavior
remain outside the Node harness. The Bases lifecycle cannot await asynchronous
disk completion because Obsidian declares `onunload(): void`; the latest write
is initiated before teardown but final disk completion remains platform-owned.

## Retrospective

Coalescing only the renderer callback would have reduced wheel traffic without
fixing stale rollback. Keeping the latest state overlay and the serialized
side-effect boundary together made both ordering and failure behavior
testable. The adversarial pass also showed why every writer to the same plugin
data file must share the queue, even when only one field family triggered the
original bug.
