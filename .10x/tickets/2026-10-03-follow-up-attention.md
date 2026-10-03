Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md
Depends-On: .10x/tickets/2026-10-03-discovery-restoration.md, .10x/tickets/2026-10-03-relationship-periods.md

# Follow-up rescheduling, history, reopen and local attention

## Scope

Implement open/completed/dismissed/all follow-up filters, explicit postpone-one-week and reopen actions with existing mutation fences, local birthday attention for 30 days and desired-contact cadence attention.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Calendar rollover/leap/unknown age/ended relationship tests and stale-safe status/date mutation tests pass; controlled UI covers filters/actions/focus/cancel/local-day lifecycle and Base privacy.

## References

- .10x/specs/follow-up-actions-and-birthdays.md
- .10x/specs/atlas-discovery-and-restoration.md
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
- 2026-10-03: Discovery executor completed the dependent permitted-population/restoration slice with focused synthetic evidence; attention execution started after reading its governing contract, the discovery contract and relationship period/cadence contract. Renderer/view UI is temporarily owned by the relationships executor; attention work begins in pure presentation/calendar modules and the existing stale-safe mutation boundary.
- 2026-10-03: Implemented additive guarded postpone/reopen API, explicit status filters, exact reviewed postpone dates, local birthday/cadence panel and standalone/Base callback wiring after the network UI handoff. Pure and synthetic mutation regressions pass (6 files / 101 tests), and TypeScript compilation passes. Recovery source review identified a stale cadence endpoint action; click-time exact endpoint/observed-date revalidation now rejects it and emits only a freshly validated current edge. Browser/integration lifecycle and privacy evidence remains in progress.
- 2026-10-03: Independent review identified mutable rendered contact-summary references; action buttons now copy reviewed fields/personIds, and in-place stale mutations are rejected. Stale cadence actions refresh their current row and pass only exact revalidated endpoints/observed-date context. Historical graph filtering is separated from original all-permitted attention; network comparisons retain the historical date. The comparison panel is hidden in Follow-up mode and narrow action wrapping gives the reviewed postponed date its full width.
- 2026-10-03: Attention implementation/UI source is ready for independent PASS; final focused evidence is green. The Base admitted-invalid diagnostic seam was also corrected for recovery without widening people membership, and its actual host regression is owned by the recovery stream. Shared recovery fixes and the integrated full gate remain pending before overall closure.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- `npm exec -- vitest run --project node test/birthday-attention.test.ts test/contact-moment-mutation.test.ts test/contact-moment-presentation.test.ts test/mutation-coordinator-boundaries.test.ts test/discovery-snapshot.test.ts test/relationship-periods.test.ts`: 6 files / 101 tests passed. Covers calendar/DST/year/leap semantics, known/yearless age, status grouping, single queued write, source/date/status/person/ID/property-mapping drift at preflight and atomic callback, body/unrelated/status/date preservation and save failure.
- `npm exec -- tsc --noEmit`: passed after additive coordinator fixture and UI action typing updates. Canonical full test/build remains owned by integration-validation after source freeze.
- Final narrower node run `vitest run --project node test/contact-moment-mutation.test.ts test/discovery-snapshot.test.ts test/birthday-attention.test.ts`: 3 files / 69 tests passed, including the same-object person-ID mapping drift seam where old/new fields both resolve the same people.
- Installed Edge (`PEOPLE_ATLAS_BROWSER_CHANNEL=msedge`) browser evidence: renderer/lifecycle + initial attention run 2 files / 53 tests passed (48 renderer tests + 5 then-current attention tests). Renderer local-day coverage now also verifies birthday transition from Upcoming to Today and owning-window timer cancellation. Final `attention.browser.test.ts`: 6 tests passed; final `contact-moment-modal.browser.test.ts`: 11 tests passed, including explicitly cancelling a cadence-prefilled contact with relationship advancement unchecked.
- Installed Edge controlled host run `vitest run --project integration test/integration/follow-up-attention.integration.test.ts test/integration/contact-follow-up-views.integration.test.ts test/integration/network-insight.integration.test.ts --no-file-parallelism`: 3 files / 7 tests passed. Verifies production postpone/reopen writes/focus/stale-source rejection, historical network/current-All cadence separation, dated path results, independent Base admission and write-free Log contact prefill.
- Synthetic narrow-pane captures: `.10x/evidence/2026-10-03-attention-narrow.png` and `.10x/evidence/2026-10-03-attention-actions-narrow.png`, generated with production styles plus representative host CSS variables/system font. DOM assertions prove viewport fit/scroll, hidden comparison mode transitions and full-width reviewed-date action. Visually inspected both; this is controlled styled UI evidence, not native Obsidian/mobile acceptance.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Independent attention/rendered-action and historical/current-population
reviews are PASS. See `2026-10-03-integration-validation.md` for exact evidence.
No external reminder, real-vault write or native-host acceptance was performed.

2026-10-03 independent recovery-stream review: **PASS** for the final attention
source contract. Read calendar/birthday/cadence transformations, status grouping,
new mutation/coordinator guards, plugin callbacks and standalone/Bases renderer
wiring against the governing contract. No open actionable source findings remain.
Executor evidence was inspected without duplicate trust test runs.

- Finding A resolved: the original cadence action could emit a stale endpoint
  pair. [AttentionPanel](../../src/render/attention-panel.ts) now copies the
  reviewed edge, matches current ID/path/endpoints/observed/due dates and emits
  only the freshly matched edge. Rejection refreshes the row with focus fallback.
- Finding B resolved: action buttons stored mutable ContactMomentSummary objects.
  [AtlasRenderer](../../src/render/atlas-renderer.ts) now copies the reviewed
  summary and personIds; stale rendered review checks reject in-place context/date
  changes. [Dedicated browser regressions](../../test/browser/attention.browser.test.ts)
  cover both findings, one pending write, failure focus and terminal filtering.
- API source recheck confirms `assertWritable()` already clones settings, so
  mappingKeys compares an approved snapshot with live dependency mappings.
  The added same-object person-ID mapping regression in
  [mutation tests](../../test/contact-moment-mutation.test.ts) proves the fence
  even when both identity fields still resolve the same people. No production
  mapping change was required by this review observation.
- Reviewed executor evidence: initial pure/mutation 101 tests; final narrower
  node 69; dedicated attention browser 6, renderer/lifecycle 48 and contact modal
  11; controlled production attention/follow-up/network 7. The
  [controlled attention tests](../../test/integration/follow-up-attention.integration.test.ts)
  exercise exact date/status-only writes, stale source rejection/focus, permitted
  Base attention and write-free contact prefill/cancel. The owning-window timer
  test covers birthday day transition and mode/destroy cancellation.
- Visually inspected both final styled narrow-pane evidence captures; native
  controls fit, reviewed-date action wraps at full width, and follow-up content
  scrolls. The source retains historical network/current-All attention separation.

Canonical full test/build and actual native Obsidian/mobile acceptance remain
separate final integration boundaries. This review accessed only synthetic fixtures
and repository source/evidence, with no real-vault changes.

## Retrospective

- Immutable rendered review payloads and current source baselines protect different
  seams: both are necessary for stale safe actions across in-place data changes.
- Keep historical network context separate from an explicitly current global inbox.
  Date filtering belongs on network/path transformations, not the original permitted
  full snapshot used by all-person attention.
- Reuse the existing local-day owning-window timer and contact logging flow; pure
  birthdays/cadence and deliberate date/status writes need no task store or reminders.
