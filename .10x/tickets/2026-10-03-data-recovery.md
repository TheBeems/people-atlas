Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md

# Complete diagnostics and reviewed note adoption

## Scope

Implement complete searchable/filterable diagnostics, safe repair entrypoints, reviewed missing/duplicate ID repairs and adoption of eligible existing Markdown person notes at their exact paths. Preserve note bodies, unrelated properties, explicit selection and preview.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Preview/cancel produce zero writes; stale sources/ID collisions fail closed; exact-path success/skips/failures are visible; all diagnostics are reachable and forbidden Base context is never disclosed.

## References

- .10x/specs/reviewable-data-recovery.md
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
- 2026-10-03: Inspected parser, canonical dossier authority, ID reservations and
  the shared mutation queue. Source-backed specification clarification allows
  exact-path adoption of loose Markdown notes: preserve unique authored IDs;
  require UUID-backed generated IDs; never move notes or bypass dossier-only
  photo/rename ownership. Targeted ID repair is independent from normal editor
  preconditions. Preview payloads are bound to private source baselines.
- 2026-10-03: Implementing complete filtered diagnostics, exact source actions,
  explicit per-note previews and sequential repair/adoption through the shared
  mutation queue. Actual source parsing precedes preflight and owned-field plus
  file-stat/identity checks execute in the atomic frontmatter callback.
- 2026-10-03: Completed the new diagnostics/adoption dialogs and commands,
  mutation-service queue/reservation wiring, and a standalone expansion action
  removing the unexpandable twenty-item limit. New dialog events are detached
  on close. Tightened preview payload binding across asynchronous preflight and
  atomic callback; unrelated field/body changes remain preserved. Unrelated
  malformed Markdown blocking ID validation identifies its exact source path.
- 2026-10-03: Recovery source handed off frozen for independent review and
  integrated formatting/gates. Final focused new node suite passed 33 tests;
  final TypeScript check emitted no diagnostics. No underlying host/vault tests
  were broadened beyond the authorized synthetic fixture boundaries.
- 2026-10-03: Independent review found mutable post-write result/reservation and
  asynchronous mapping/preview seams. Approved person data and parsing mappings
  are now detached before queue/await operations; live preview/source/mapping
  checks remain before the atomic write. Structured scan failures wrap adapter
  reads and parsing and retain exact global paths; Base result presentation
  redacts an excluded blocker and receives the permitted context from main.
- 2026-10-03: The actual Base regression exposed admitted missing-ID diagnostics
  being dropped before repair. Discovery corrected diagnostics-only entry
  admission and delta rebuilding without broadening valid graph people. Root
  also requested generic mixed-admission duplicate-person diagnostics. The final
  controlled test proves missing and duplicate repair entrypoints, no hidden
  paths/details, invalid-source refresh/remove/readd and write-free cancellation.
  Recovery production/test source is frozen again for integrated final gates.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- Focused node command: `vitest run --project node test/person-recovery.test.ts
  test/settings-recovery.test.ts test/diagnostic-filter.test.ts
  test/settings-load.test.ts test/settings-tab.test.ts` — 5 files, 133 tests passed
  before the final exact-blocking-source regression was added. Covers missing ID,
  loose-note adoption, authored ID preservation, custom/tag mappings, targeted
  duplicate repair with untouched references, suffixed ownership rejection,
  stale owned fields/mappings/file replacement, read-only state, atomic conflicts,
  stale-index source collisions, preview tampering and idempotent retry.
- Focused Edge browser command: `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge vitest run
  --project browser test/browser/recovery.browser.test.ts --no-file-parallelism`
  — 7 tests passed. Covers >20 complete diagnostics, combined filters, excluded
  Base source/diagnostic suppression, exact-path source/repair callbacks,
  write-free preview/cancel, sequential partial results/idempotent completed
  rows, explicit single duplicate choice, settings confirmation/error and Dutch
  success presentation. Real UI uses synthetic mutation callbacks only.
- Recovery-owned Biome format/lint checks pass for all 15 new modules/test files
  after replacing non-null fixture assertions with runtime-required fixtures;
  no protective assertion was weakened. Shared-file formatting is deferred to
  the integration owner after source freeze.
- Typecheck after recovery changes reports only the attention executor's
  in-progress `ContactMomentMutationOperations` test fixture missing its newly
  added `changeContactMomentFollowUp` member; that stream owns resolution.
  Full test/build gates and independent review are pending integration.
- After that fixture was updated by its owning stream, `tsc --noEmit` emitted no
  diagnostics. Final targeted node command: `vitest run --project node
  test/person-recovery.test.ts test/settings-recovery.test.ts
  test/diagnostic-filter.test.ts` — 3 files, 33 tests passed, including the exact
  unrelated source blocker regression. The full canonical gate stays with the
  integration owner after source freeze.
- No real vault, asset, external network/service, installation or publication
  was accessed. The controlled tests prove their stated source/UI contracts,
  not native Obsidian/mobile acceptance.
- Final independent-review regression command: `vitest run --project node
  test/person-recovery.test.ts test/settings-recovery.test.ts
  test/diagnostic-filter.test.ts` — 3 files / 38 tests passed. Added exact approved
  post-callback ID/path reservations/results and transient mapping collision
  detection; settings race coverage is described in the dependent ticket.
- Final Edge browser recovery dialog run — 1 file / 7 tests passed after scoped
  result presentation changes. Final controlled `recovery-context.integration.test.ts`
  — 1 file / 2 tests passed. Actual Base→diagnostics→main→repair wiring retains
  admitted missing-ID diagnostics across source delta/remove/readd, hides excluded
  adapter failure paths/details, retains exact unrestricted global errors, and
  previews an admitted ambiguous duplicate with no excluded label/path/target or
  writes. The fixture uses production styles and retains browser error checks.
- Final `tsc --noEmit` exited 0 without diagnostics. Owned review-fix Biome checks
  are clean. Native Obsidian/mobile acceptance and canonical full test/build
  remain with the integration owner; no real vault was accessed.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Independent recovery and final Base admission/privacy reviews are PASS.
See `2026-10-03-integration-validation.md` for exact evidence. Native Obsidian
acceptance and real-vault installation remain separate, unclaimed boundaries.

- 2026-10-03, independent relationship/network executor: source and recorded focused evidence reviewed without rerunning green checks. Reviewed exact-path writes, classification/owned-field/live-mapping guards, stale-index uniqueness scanning, source membership/stat checks, no retarget/move/merge behavior, unique authored ID preservation and sequential partial results/idempotent completed rows are present.
- Changes requested before PASS: person recovery reads preview identity/path again after `processFrontMatter` awaits, allowing post-callback preview mutation to change reservations/results despite a safe note write. Use a detached privately bound reviewed payload across the whole transaction. Detach the approved settings mapping used by source parsing/collision scans across awaits; retain the live mapping rejection guards. Add regressions at both async seams.
- Changes requested before PASS: Base diagnostics fences are dropped at the person-repair modal entrypoint. Global uniqueness scan errors can name an excluded malformed/colliding Markdown source and are rendered verbatim by the modal. Pass the permitted source context to recovery result presentation and redact external-source details in that context while retaining exact global diagnostics. Add an excluded-source error browser/wiring regression. Findings sent to recovery executor and parent; final independent recheck remains pending.
- 2026-10-03 re-review: detached approved person payload and mapping snapshots now cover queue/preflight/atomic/post-callback phases while preserving live drift rejection. Reservation/result regressions prove approved ID/path survival; a transient mapping regression catches a stale-index source collision. Typed source errors wrap both adapter reads and parsing; the modal receives a copied permitted context and removes excluded path/error details while global recovery retains exact errors. The added controlled Base wiring regression uncovered a separate scoped-diagnostic admission issue for an admitted person note without an ID; discovery is correcting that seam. Final data-recovery PASS awaits that focused integration result.
- 2026-10-03 final independent re-review: PASS for the data-recovery source contract. Inspected the corrected `diagnosticEntryPaths` admission fence and delta/rebuild preconditions, plus the owner-reported passing controlled Base recovery-context integration (1 test). It proves admitted missing-ID repair reachability, an excluded adapter read failure's path/details absent from the bounded UI, exact global blocker retained, zero host writes, metadata-delta refresh and invalid-row removal/readdition with the valid-person set stable. No further actionable source findings remain. Reviewer inspected the source and focused evidence without repeating green tests; final modal/type and integrated canonical gates remain with their owners.

## Retrospective

- Current parsing authority is vault-wide: safe existing-note adoption changes
  only reviewed fields on exact paths; dossier grammar applies to new creation,
  ownership-dependent renames/photos and repairs that would invalidate a suffix.
- Keep reviewed payloads bound separately from source baselines. Rechecking
  source identity alone does not prevent mutable preview fields drifting while
  asynchronous preflight is running.
- A rare identity repair can afford an actual-source uniqueness scan; every
  scanned file's stat and membership are rechecked at the atomic write seam.
  Fail-closed errors must name the unrelated blocking source, not just the note
  the user selected.
- A Base admits notes with invalid IDs too. Keep diagnostic admission separate
  from valid graph people, and preserve structural ambiguity while removing
  excluded source details. Identity validation remains global and fail-closed;
  the bounded presentation controls which blocker details are shown.
