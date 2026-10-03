Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md
Depends-On: .10x/tickets/2026-10-03-relationship-periods.md, .10x/tickets/2026-10-03-discovery-restoration.md

# Network paths, common contacts, family layout and native Bases

## Scope

Implement deterministic pure shortest paths and mutual contacts, explicit shared UI access, optional role-derived family layout, native translated bounded Bases controls and example Base files.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Pure edge/cycle/ambiguity/parallel/disconnected cases and stable layout bounds covered; UI uses only permitted populations and explicit selection; existing config/state keys stay compatible.

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
- 2026-10-03: Pure shortest paths/common contacts and explicit-role family layout implemented after relationship fields. Discovery handed off shared renderer/view/Bases UI; accessible counterpart/results, optional as-of controls and persisted family/radial choice integrated, then shared renderer returned for attention integration. Old radial schema-1 state/layout keys remain compatible. Native Bases dropdown API verified from installed Obsidian 1.13.1 types and official Bases syntax/views documentation.
- 2026-10-03: Network source handed off after final focused node/state/native-option gate and typecheck. Added the recovery executor's requested Base diagnostics control using unprojected admitted diagnostics and permitted exact sources; the integration regression checks redacted ambiguity and excluded-source privacy.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- Final focused node command `npx vitest run --project node test/relationship-periods.test.ts test/network-insight.test.ts test/network-view-state.test.ts test/relationship-form.test.ts test/relationship-source-guard.test.ts test/frontmatter-diagnostics.test.ts test/mutation-validation.test.ts test/mutation-service.test.ts test/layout-state.test.ts test/bases-profile-mapping.test.ts test/project-graph.test.ts` passed 11 files / 290 tests, including old schema-1/layout key compatibility and translated native dropdown controls. `npx tsc --noEmit` exited 0 with no diagnostics before the additional Base diagnostics control.
- Edge browser run for `test/browser/network-insight.browser.test.ts` and the relationship editor passed 34 tests: explicit ID counterpart choices, parallel source distinctions, accessible live results, unavailable counterpart removal and no write callbacks.
- `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge npx vitest run --project integration test/integration/network-insight.integration.test.ts --no-file-parallelism --maxWorkers=1` passed 1 file / 3 controlled-host tests. This proves explicit family/date persistence, historical date filtering before standalone/Bases ego membership, original contact observations retained for visible free-network participants, hidden moments when participants leave the ego set, and all-in-Base population/canonical-ambiguity privacy fences. The host is synthetic; no real-vault writes or real Obsidian installation occurred.
- Date filtering precedes projection. `projectGraph` accepts optional contact relationship evidence, defaulting to snapshot edges; both dated views supply only their unfiltered permitted edges, so ended historical topology cannot influence traversal while explicit observations retain source validation.
- Official primary references inspected: https://obsidian.md/help/bases/syntax and https://obsidian.md/help/bases/views. Added Family/Work/Follow-up Base examples using native global/view filters and saved atlas/table views. Formula evaluation in real Obsidian remains a live-host validation boundary.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Independent network and final shared snapshot reviews are PASS. See
`2026-10-03-integration-validation.md` for exact evidence. Example formula
evaluation in actual Obsidian remains an explicit native-host boundary.

2026-10-03, root reviewer: PASS for pure network transformations and final
network UI/view source. Reviewed canonical-person filtering, deterministic BFS
and common-neighbor results, parallel note-backed/inferred edge distinctions,
explicit-role family generation constraints and finite conflict/cycle fallback.
Counterpart/result DOM stays accessible and read-only with lifecycle cleanup.
Native translated Bases options retain keys and validate numeric inputs. Both
view pipelines filter historical topology before ego traversal and separately
retain original permitted contact evidence; wider browsing uses original full
admission and network comparison explicitly uses the dated graph. Inspected
executor regressions without rerunning them for trust. Final historical/global
attention regression and canonical integrated gates remain pending. Base example
formula evaluation has not been verified in real Obsidian.

## Retrospective

- Topology and observation evidence must remain separate when viewing historical relationships. Filtering only after ego traversal makes ended links determine hidden-person membership; filtering before traversal without observation evidence erases still-visible contact history. The optional evidence input preserves both contracts without adding relationships or writes.
