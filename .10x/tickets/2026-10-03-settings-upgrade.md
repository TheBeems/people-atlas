Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md
Depends-On: .10x/tickets/2026-10-03-data-recovery.md

# Reviewed settings upgrade with retained original backup

## Scope

Implement explicit reviewed settings recovery for the inspected known older schema set, backed up before replacement, preserving supported common values and requiring an explicit root choice where legacy folder semantics are ambiguous. No startup writes or note migrations.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

Known-old/current/future/malformed/cancel/save-error tests pass; original settings backup remains available after later saves; unsupported data stays read-only and byte-preserved.

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
- 2026-10-03: Inspected schema 8 loader and recorded schema 7 pre-dossier folder
  fixtures. Supporting only valid schema 7 common settings, with an explicit
  target-root choice. Startup still rejects old/future/malformed settings and
  writes nothing; recovery is a separate user-reviewed command/settings action.
  Exact original data.json text is retained in a validated local recovery
  envelope, preserved by ordinary settings and view-state saves. No note layout
  migration or external data access is introduced.
- 2026-10-03: Loader notices now point schema-7 users to explicit recovery rather
  than deleting data. Backup/envelope validation was separated from preview
  transformations to keep the loader dependency acyclic. The preview distinguishes
  exactly retained settings from values adjusted by current normalization and
  defaults/unsupported legacy keys. Recovery success explains the existing
  plugin-reload boundary when Bases registration changes.
- 2026-10-03: Independent review exposed coherent preview substitution during
  source read and mutable publication after persistence. A private WeakMap binds
  the original preview; saving detaches approved data before awaits, rejects
  read-time mutation, and returns the exact persisted payload. Main publishes
  that returned payload rather than re-reading the public preview after save.
  Focused race regressions pass; source is frozen for integrated final gates.
- 2026-10-03: Canonical community gate rejected main's direct adapter read. Parent
  approved one explicit exception for original source-text recovery: a dedicated
  `src/settings/plugin-data-source.ts` public-API reader accepts only App and
  reads `${app.vault.configDir}/plugins/people-atlas/data.json`. It takes no caller
  path or plugin ID and performs no adapter write/list/remove operation. Main
  calls that bounded helper; startup and persistence still use loadData/saveData.
  Installed public Obsidian API declares configDir and DataAdapter.read; loadData
  provides parsed data and cannot supply the exact original source formatting.
- 2026-10-03: Community policy now validates that dedicated helper's entire
  anchored module shape unconditionally and grants only that exact own-file
  read an exception to the direct-adapter rule. Independent review caught the
  initial conditional-shape alias/bracket bypass, which is closed by the
  unconditional fence. All other source rules and all other files retain their
  existing bans. Parent records the narrow contract supersession; no general
  adapter permission or caller-controlled read boundary was added.

## Blockers

None for this contract; dependencies must complete before their UI handoffs.

## Evidence

- The shared focused node command recorded in the data-recovery ticket passes
  133 tests. Settings cases cover current defaults, valid known schema 7,
  future/unproven/malformed shapes, explicit valid root choice, normalized-value
  labeling, exact original text, local retained backup after ordinary saves and
  reload, stale/tampered preview rejection and save errors. Existing startup
  rejection/read-only tests remain intact.
- Controlled host command: `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge vitest run
  --project integration test/integration/settings-recovery.integration.test.ts
  --no-file-parallelism` — 3 tests passed. Actual plugin wiring accepts explicit
  reviewed confirmation only, reads the exact local plugin data.json path,
  preserves the original text through updateSetting/saveViewState/reload, and
  produces zero note/frontmatter mutations. Cancellation/save failure leaves
  schema 7 unchanged and recoverable; future/malformed data creates no dialog or
  write. Browser dialog coverage is recorded in the data-recovery ticket.
- Only inspected valid schema 7 common values are supported. Schemas before 7,
  unsupported future data and malformed data remain read-only. Legacy folder
  values are displayed/retained in backup but never determine the chosen root or
  migrate notes. Exact backup text lives under `_peopleAtlasRecovery` in local
  plugin data and survives all ordinary plugin-data write paths.
- Focused lint is clean. Full integrated test/build and independent source
  review remain pending; no user settings file or real vault was accessed.
- Final shared new-node suite passed 33 tests and `tsc --noEmit` emitted no
  diagnostics after the coordinated attention fixture update. Source is frozen
  for independent review and final integrated quality gates.
- After independent-review fixes, final shared node regression suite passed
  3 files / 38 tests. New settings assertions reject coherently replaced roots,
  unregistered copied previews and mutation during an awaited original-text read;
  detached save results stay bound to the approved root/values during persistence.
- Controlled settings host coverage now passes 4 tests, including actual plugin
  runtime/persisted consistency when its public preview is changed during a pending
  save. No note writes occur. Final integrated typecheck exits 0 without diagnostics
  and owned review-fix Biome checks are clean. Full canonical gates stay with the
  parent integration owner; no live settings data was read or changed.
- Gate follow-up bounded-reader evidence: final `vitest run --project node
  test/community-readiness.test.ts test/plugin-data-source.test.ts` — 2 files /
  24 tests passed. Positive/custom-configDir/failure fixtures preserve exact
  original text and make no mutations. Negative policy fixtures reject other
  filenames/plugins, caller path/ID/extra parameters, readBinary/write/list/remove,
  adapter/vault aliases, bracket access, added helpers/exports/configDir mutation,
  the same reader in another file and unrelated prohibited source operations.
  Original combined helper/community/settings recovery run passed 40 tests;
  final settings controlled host remains 4 passed through the production helper.
  Final integrated TypeScript exited 0 after the discovery owner corrected its
  unrelated required-node fixture, and all four owned follow-up files are
  Biome clean. Independent exception re-review is PASS as recorded below;
  canonical retry remains with its owner. No real settings file or vault was read.

## Review

Final integrated acceptance: PASS on the reviewed source freeze. Complete test
command passed 1515 executions; build, release/community contracts and diff check
passed. Independent settings and exact-reader policy reviews are PASS. See
`2026-10-03-integration-validation.md` for exact evidence. No actual settings file,
note migration or real-vault installation was performed.

- 2026-10-03, independent relationship/network executor: source and recorded focused evidence reviewed without rerunning green checks. Current defaults, schema-7-only opt-in, explicit valid root, unsupported/malformed read-only behavior, no startup/note writes, exact original-text backup and backup retention through ordinary settings/view-state saves and reload are covered.
- Changes requested before PASS: `saveReviewedSettingsRecovery` derives its canonical payload from mutable preview fields after `readOriginalText` awaits. A coherently substituted other-root preview can pass the current whole-value comparison because no private original preview binding exists. Capture and bind the exact reviewed payload before any queue/await; reject coherent replacement and read-await mutation. `recoverReviewedSettings` must publish the canonical saved result rather than reading preview fields again after persistence awaits, with a regression for runtime/persisted consistency during that await. Findings sent to recovery executor and parent; final independent recheck remains pending.
- 2026-10-03 re-review: PASS for the settings recovery source contract. The private WeakMap now binds the original reviewed preview; detached approved data survives queue/read/save awaits and is returned for publication. Coherent substitution, copied previews, mutation during read and persisted/runtime consistency during save have targeted node and controlled-host regressions. The owner reports focused node 38, TypeScript exit 0 and settings host 4 passing; the reviewer inspected their source/evidence rather than repeating green checks. Integrated canonical test/build remains pending the integration owner.
- 2026-10-03 bounded-reader follow-up: PASS. Independently inspected the App-only fixed own-plugin reader, explicit preview/revalidation call sites and unchanged loadData/saveData startup/persistence. The scanner now enforces the exact dedicated module shape unconditionally; neither its filename nor alias/bracket syntax can bypass that shape guard. The 12 original path/method/caller/root negative cases, vault-alias/bracket/extra-export cases and other-file/other-policy fixtures remain intact. Positive reader cases cover host custom configDir, exact Unicode/CRLF text, read failure and zero adapter mutations. Final owner evidence is policy/helper 24 tests, settings controlled host 4, TypeScript exit 0 and owned Biome clean, inspected without duplicate reruns. No residual source findings remain; final canonical gates remain with the integration owner.

## Retrospective

- Keep startup loading separate from user-reviewed recovery. Safe in-memory
  defaults are not authorization to persist or reinterpret an older root.
- Preserve the original data.json text rather than serializing parsed JSON as
  an allegedly exact backup. Persist backup metadata alongside current settings
  on every ordinary settings/view-state save, and validate it on reload.
- Preview normalization as an explicit adjustment. Calling a trimmed or
  normalized setting retained hides a real before/after change from review.
- Bind public previews privately and publish the returned persisted payload.
  Recomputing from mutable fields after an await cannot establish what was
  originally reviewed, and post-save public mutation must not redefine memory.
- A narrowly approved source-policy exception must validate its dedicated module
  even when old syntactic detection no longer matches. A filename exemption or
  alias would hide a broader operation; complete-shape negative tests preserve
  the intended fixed own-plugin recovery boundary.
