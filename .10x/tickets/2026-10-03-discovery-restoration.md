Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md

# Complete discovery and stable reopening

## Scope

Implement richer person search, explicit current/all-permitted population controls for Persons and Follow-ups, independent renderer browsing snapshots, stable selected-node center restoration and optional remembered renderer/scope state.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Six governing scenarios covered, including 500+ people, shared A/B contact moments, duplicate names, Base exclusions, outside-graph person actions and old state compatibility.

## References

- .10x/specs/atlas-discovery-and-restoration.md
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
- 2026-10-03: Executor read all four referenced behavioral contracts and inspected renderer, standalone, Bases, snapshot/delta and state boundaries. Began additive alias propagation, richer presentation matching and schema-1 optional browsing/center fields. Preserving the prior uncommitted work.
- 2026-10-03: Renderer now receives graph and permitted browsing snapshots separately. Persons/Follow-ups expose independent native current/all controls; outside-graph person details/actions use exact permitted IDs without recentering. Standalone global follow-up intent explicitly selects all; Bases passes only its admitted full snapshot. Optional per-view browse fields and selected center IDs are persisted. Base-facing diagnostics are filtered after full/delta snapshot creation; canonical duplicate IDs remain ambiguous even if only one duplicate is admitted by a Base.
- 2026-10-03: First focused node run: 42/45 passed; the three failures were the intentionally superseded email-search assertion and two prototype harnesses missing the newly used plugin-state boundary. Updated those assertions/stubs while retaining original selection/center protection assertions. Initial typecheck found a new tuple-iteration type error (repaired), plus still-in-progress recovery executor errors; no global success claimed.
- 2026-10-03: Initial discovery implementation handed off renderer/view UI seams to the relationship/network executor; recovery owns only standalone `renderDiagnostics`. Selected-node layout keys now use the stable center ID, including a legacy schema-1 current-path fallback. Attention work proceeds in pure domain/mutation modules until the renderer seam returns.
- 2026-10-03: Cross-stream review separated original all-permitted browsing/attention from historical network filtering. Network comparison input explicitly retains the chosen date. Base diagnostics now track every admitted Markdown entry independently from valid graph people, rebuild on invalid-entry edits/admission changes and retain generic admitted-source structural duplicate-person/relationship evidence without excluded paths/labels/targets.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- Focused node command: `npm exec -- vitest run --project node test/semantic-people-list.test.ts test/view-state.test.ts test/view-selection-center.test.ts test/project-graph.test.ts test/build-snapshot.test.ts test/graph-delta.test.ts test/bases-profile-mapping.test.ts test/discovery-snapshot.test.ts` — 8 files / 50 tests passed. Covers accent/case matching, canonical aliases, email/formatted phone matching, alias delta propagation, 503-person permitted population versus 500-node canvas cap, shared A/B moments, duplicate canonical IDs under Base exclusion, privacy-filtered diagnostics, legacy/optional state validation and exact selection/center fences.
- Focused browser command with the repository-supported `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge`: `npm exec -- vitest run --project browser test/browser/discovery.browser.test.ts --no-file-parallelism` — 3 tests passed. Real browser assertions cover explicitly finding/editing/opening person 502 outside the graph, independent shared follow-up scope, exact stable IDs despite duplicate labels, camera/layout immutability, roving focus after snapshot refresh, 350 px pane containment and safe initial browse-state restoration.
- Controlled integration command with `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge`: `npm exec -- vitest run --project integration test/integration/discovery-restoration.integration.test.ts --no-file-parallelism` — 3 tests passed. Actual standalone/Bases adapters restore selected center Alice after rename, retain renderer/population choices per view, keep missing/duplicate IDs diagnostic, show shared follow-ups outside the ego graph only on explicit widening, hide excluded Base person/moment/diagnostic context, and perform no frontmatter writes on discovery/reopen.
- Typecheck after those passes encountered only the relationships executor's still-in-progress syntax at `test/relationship-periods.test.ts:63,93`; that executor was notified. The full repository quality gate remains with the integration owner after source freeze. No actual Obsidian vault or real member/financial/user data was accessed.
- After the final discovery layout/cleanup adjustment, `npm exec -- tsc --noEmit` passed, and the discovery controlled integration file passed all 3 tests again. This supports the adjusted reopen path and type boundary; independent review and the final complete gate remain pending.
- Final `vitest run --project node test/discovery-snapshot.test.ts`: 6 tests passed, including admitted missing-ID diagnostics without people membership, generic partial-Base duplicate-person/relationship structural evidence and excluded-context suppression. Root inspected the late Base/date boundaries; actual Base diagnostic/repair entrypoint and invalid-row delta/removal host evidence is recorded by the recovery executor.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Final ghost admission and graph-versus-canonical observation follow-up
reviews are PASS. See `2026-10-03-integration-validation.md` and
`2026-10-03-product-source-review.md` for exact evidence and live-host boundaries.

Reviewer: recovery/settings executor, independent of discovery implementation.
Verdict: pass for the discovery source and focused assertion contract; final
integrated quality gates and live Obsidian acceptance remain separate.

- Inspected `src/render/semantic-people-list.ts`, renderer population controls,
  `setGraph`, node lookup/details/action seams, `src/settings/view-state.ts`,
  standalone/Bases restoration and `src/graph/{build-snapshot,graph-source,
  project-graph}.ts` against the current discovery contract.
- Name/alias/job/organization/email/phone matches affect presentation only.
  Wider people/follow-up snapshots do not replace canvas contents or recenter on
  list selection. Action callbacks retain exact current canonical IDs/paths.
- Canonical duplicate IDs remain ambiguous under partial Base admission; full
  and incremental Base snapshots suppress excluded diagnostic source/target
  context. Shared moments require all admitted people and relationship endpoints.
  Renderer cleanup removes new population listeners through its owning instance.
- Inspected the recorded 503-person, focus/camera, shared-moment, renamed-center,
  removed/duplicate-center and Base-exclusion assertions in the executor's node,
  browser and controlled-host tests. Did not repeat their runs for confidence.
- Minor documentation finding: the authority paragraph names the KISS spec but
  does not explicitly supersede the renderer mode-lifetime clauses 2–3 of
  `accessible-semantic-renderer.md`. Current discovery required behavior clearly
  governs remembered optional renderer mode; parent was asked to align the narrow
  supersession text. Legacy/no-state defaults remain Graph.
- Resolved the minor record finding: parent added the exact clauses 2–3 narrow
  supersession to `atlas-discovery-and-restoration.md`; reviewer read it and
  confirmed it preserves Graph defaults and write-free restoration. No open
  independent discovery findings remain.
- Final scoped diagnostics re-review: **PASS**. The recovery host test initially
  exposed admitted missing-ID rows being dropped because diagnostic admission
  reused valid graph people. Inspected the corrected `diagnosticEntryPaths` fence,
  admitted-source delta/rebuild guards and mixed-admission generic duplicate-person
  redaction in the Base view/graph-source filter. Valid graph membership and
  canonical ambiguity remain intact. Executed the new controlled
  `test/integration/recovery-context.integration.test.ts` regressions (2 passed):
  missing-ID repair stays reachable across invalid-source delta/remove/readd,
  an admitted ambiguous duplicate opens its exact-path preview, excluded labels,
  paths/targets/error details are absent, cancellation writes nothing, and global
  recovery retains its exact blocker. No residual actionable source finding.

Residual risk: tests use synthetic controlled hosts and Chromium/Edge, not an
actual user vault or native Obsidian/mobile certification. Later network/attention
changes to these shared renderer/view seams need their own review and the final
integrated gate.

## Retrospective

- Separate graph and admitted browsing snapshots at the renderer boundary; a larger people/follow-up list must never redefine canvas contents or weaken Base admission. Details/actions need their own exact-ID lookup when selection legitimately lies outside the canvas.
- Store an explicit nullable selected-center ID independently from list selection. This survives renames, preserves missing/duplicate diagnostics, and distinguishes an intentional empty center from legacy schema-1 history fallback.
- Full builds previously marked a duplicate canonical ID as ordinary when only one duplicate was admitted by a Base, whereas deltas already used global duplicate IDs. Counting unique canonical/output paths consistently closes that guess-prone reopen branch.
- PowerShell inspection without a profile proved reliable after earlier silent shells; focused browser/integration checks used the existing opt-in installed Edge channel, without changing assertions, timeouts or dependencies.
