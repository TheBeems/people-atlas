Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: .10x/tickets/2026-10-03-product-improvements.md
Depends-On: .10x/tickets/2026-10-03-discovery-restoration.md, .10x/tickets/2026-10-03-data-recovery.md, .10x/tickets/2026-10-03-settings-upgrade.md, .10x/tickets/2026-10-03-relationship-periods.md, .10x/tickets/2026-10-03-network-insight.md, .10x/tickets/2026-10-03-follow-up-attention.md

# Independent review and integrated product verification

## Scope

Reconcile independent child reviews, integrate all changes, update README/README.nl/ARCHITECTURE/ROADMAP/CHANGELOG and run full canonical gates on a source freeze. Record exact counts/artifact hashes and limitations.

## Non-goals

No real-vault writes, release, publication, installation, dependency upgrades,
automatic merge or unrelated cleanup. Preserve prior working-tree edits.

## Acceptance criteria

npm run test, npm run build, relevant release/community gates and git diff --check pass without weakened tests. All concrete features have accessible UI and preservation evidence; no native-host outcome is fabricated.

## References

- .10x/specs/atlas-discovery-and-restoration.md
- .10x/specs/reviewable-data-recovery.md
- .10x/specs/relationship-periods-and-network-insight.md
- .10x/specs/follow-up-actions-and-birthdays.md
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
- 2026-10-03: Integration owner reconciled English/Dutch README, architecture,
  roadmap, unreleased changelog and synthetic examples with implemented scopes,
  explicit recovery/backup, period/family/network insight and local attention.
  Native host/release/install boundaries remain stated. Coordinating final
  independent review corrections and admitted-invalid Base diagnostics evidence;
  canonical full test/build and shared source-wide formatting wait for source freeze.
- 2026-10-03: Frozen cross-stream implementation and independent review are
  recorded in `2026-10-03-product-source-review.md` (PASS). Formatted only the 94
  changed/new configured product files; 53 required fixes. Unchanged metadata,
  release scripts and checkout-wide line endings were preserved. Focused final
  format is clean and lint exits 0 with 20 warnings and 1 informational finding.
  Corrected an equivalent family-layout forEach callback body that returned Map.
- 2026-10-03: First canonical `npm run test` stopped in the node stage: 67/69
  files and 1222/1225 tests passed. Community policy rejected the new recovery
  data.json read through the Vault adapter. Two unchanged mocked release tests
  exceeded their existing 5-second limit under full concurrency and produced
  temp-directory EBUSY; no timeout or assertion was changed. The isolated
  release-contract file subsequently passed all 30 cases in the affected
  characterization run; the community failure remained reproducible. Resolve
  the bounded plugin-data read policy and node subprocess contention before
  canonical retry. Initial logs are retained separately.
- 2026-10-03: Root approved a node-project maxWorkers=4 cap based on the
  isolated release success versus full-file contention. All canonical test
  commands, timeouts and assertions remain intact; unchanged release tests pass
  30/30 after the runner change. Root also ratified a single dedicated public
  adapter-read exception for exact original local People Atlas plugin-data text. Recovery
  owns the bounded helper and scanner negative cases; independent network review
  will inspect the exception before the final retry. English/Dutch privacy and
  architecture documents disclose the exact-file-only boundary.
- 2026-10-03: Bounded reader/policy correction passed independent source review
  and focused policy/helper 24, settings host 4 and strict types. Final changed-file
  format/lint cover 98 files, both exit 0 with the same 20 warnings/1 info.
  Canonical retry passed all 70 node files/1246 tests, 16 browser files/203 tests
  and the first 10 integration files/44 tests, then stopped at the unchanged
  people-atlas-plugin lifecycle assertion: the Base omitted a broken relationship's
  diagnostic when its unresolved endpoint already existed as an admitted ghost.
- 2026-10-03: Repaired the diagnostic source boundary with optional canonical
  resolution context. Known endpoints must uniquely resolve to actual valid
  admitted snapshot people; an unresolved endpoint must match an actual ghost's
  stable authored-reference ID, with at least one admitted known person. Canonical
  plus mapped Base people is the same resolution population for full builds,
  delta builds and this diagnostic filter. Resolved excluded, ambiguous,
  unrepresented and unanchored endpoints remain hidden. Focused 4 node files/33
  tests, 4 actual host files/11 tests and TypeScript pass. The original lifecycle
  assertion is preserved. Review's additional stale-ghost regression passes in
  discovery-snapshot (8 tests): a current link resolving to an excluded person
  blocks diagnostic admission even while the old ghost remains in the snapshot.
  Await final independent re-review then canonical retry; no timeout/assertion
  was weakened.
- 2026-10-03: Independent re-review found the Base graph-person union must not
  also become contact-moment authority in a delta. Added a graph-only resolution
  population option; canonical people remain authoritative for observation
  projection, diagnostics and counters, matching full builds. The mapped-ID pure
  case proves a canonical observation remains visible while a mapped-only invalid
  observation stays absent after a graph delta. Corrected an initial new fixture
  expectation: invalid observations are omitted, not counted as valid hidden
  observations. Strong contact-array parity assertions remain. Final focused
  evidence passes: 4 node files/33 tests, 5 actual host files/13 tests and strict
  TypeScript. All product source/tests refrozen for final independent PASS/gate3.
- 2026-10-03: Gate3 passed 70 node files/1248 tests, 16 browser files/203
  tests and all 15 integration files/58 tests. DPR1 stopped at an existing raw
  inline-style string assumption: layout height 183.671875px is natively
  serialized as 183.672px. Root approved exact owning-Document CSSOM normalization
  for expected style strings and deliberate fractional fixture sizes; measured
  geometry/backing equality, far-pixel alpha, selection, resize, popup ownership
  and timeouts remain intact. No production dimensions were snapped.
- 2026-10-03: The deliberate fractional fixture then exposed a real last-pixel
  background coverage regression: painting CSS extents under DPR can leave a
  partially painted rounded-up backing pixel. Background painting now uses the
  identity transform across actual backing width/height, then the unchanged DPR
  transform for graph/camera geometry. Final focused DPR1 passes both tests,
  including exact alpha255 at the farthest pixel and popup lifecycle. Source is
  frozen for independent diff review before canonical attempt4; earlier failed
  canonical and characterization logs remain preserved.
- 2026-10-03: Root independently reviewed the exact CSSOM/fractional fixture
  and backing-pixel paint diffs: PASS. Unreleased changelog includes the real
  canvas correction. Final source/tests/docs frozen; changed/new product inventory
  contains 100 files with clean format and lint exit 0 (20 warnings/1 info).
  Canonical attempt4 passed the complete command with 1515 test executions:
  node 1248, browser 203, integration 58 and DPR1/1.5/2 each 2. Production build,
  release contract, community contract and tracked diff whitespace check all
  exit 0. Fresh artifact hashes were retained; no source edits followed the
  green freeze. Implementation/gate evidence is ready for parent closure.
- 2026-10-03: Root independently inspected the terminal owner record, complete
  attempt4 summaries, production build/release/community logs and fresh artifact
  metadata. All required local gates and source reviews are PASS with no remaining
  actionable findings. Closed this integration ticket and six feature children;
  the pre-existing blocked native installation ticket and prior work remain intact.

## Blockers

None. Independent reviews, final required gates and parent record closure are
complete. Native Obsidian installation/acceptance remains outside this ticket.

## Evidence

Full format preflight checked 233 configured files and reported 128 errors,
including untouched checkout CRLF versus configured LF in manifest, versions
and release scripts. This is a recorded full-repository formatting baseline,
not a reason to normalize unrelated files. Final changed-file checks cover
100 files, with no format differences, no lint errors, 20 warnings (mostly test
non-null selectors) and 1 informational style finding. Protective assertions
were retained. Logs/path inventory are in `.10x/evidence/.storage/`:

- `2026-10-03-product-format-paths.json`
- `2026-10-03-product-format.log`
- `2026-10-03-product-lint.log`
- `2026-10-03-product-test.log` (first canonical attempt, node failed)
- `2026-10-03-gate-failure-characterization.log`
- `2026-10-03-node-runner-characterization.log`
- `2026-10-03-product-format-final.log`
- `2026-10-03-product-lint-final.log`
- `2026-10-03-product-test-final.log` (second canonical attempt, lifecycle regression)
- `2026-10-03-ghost-diagnostic-node-final.log`
- `2026-10-03-ghost-diagnostic-host.log`
- `2026-10-03-ghost-diagnostic-typecheck.log`
- `2026-10-03-stale-ghost-diagnostic-node.log`
- `2026-10-03-ghost-diagnostic-observation-node-final.log`
- `2026-10-03-ghost-diagnostic-observation-host.log`
- `2026-10-03-ghost-diagnostic-observation-typecheck.log`
- `2026-10-03-product-test-attempt3.log` (third canonical attempt, CSSOM string regression)
- `2026-10-03-fractional-cssom-dpr1.log` (deliberate fractional fixture reveals coverage failure)
- `2026-10-03-fractional-cssom-dpr1-final.log`
- `2026-10-03-product-test-attempt4.log` (final complete canonical PASS)
- `2026-10-03-product-build.log`
- `2026-10-03-product-release-contract.log`
- `2026-10-03-product-community.log`
- `2026-10-03-product-diff-check.log`
- `2026-10-03-product-artifacts.json`

Final commands and observed results:

| Gate | Result |
| --- | --- |
| `PEOPLE_ATLAS_BROWSER_CHANNEL=msedge npm run test` | Exit 0: node 70 files/1248 tests, browser 16 files/203 tests, all 15 integration files/58 tests, DPR1/1.5/2 each 1 file/2 tests; total 1515 test executions |
| `npm run build` | Exit 0: strict TypeScript plus minified production build |
| `npm run release:contract` | Exit 0: version 0.12.4, main.js 532317 bytes, exact three release assets |
| `npm run community:check` | Exit 0: 93 source files inspected, metadata/privacy/mobile-safe source policy passes |
| `git diff --check` | Exit 0: no whitespace errors; local LF/CRLF checkout warnings retained |
| Focused Biome format/lint | 100 changed/new configured product files; format clean, lint exit 0 with 20 warnings and 1 info |

Fresh production artifacts observed at 2026-10-03T08:00:07.0315495Z:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 532317 | `5a3fcf912fdd5c2b57c3e1443a3cec4a2f1250cae20a51e6f15055c6cb80be68` |
| manifest.json | 249 | `3ac1a22eeaefc5172517c9c2f8f7a8e06f086562afc86fcb6df5c7aad2baeaad` |
| styles.css | 28875 | `a76dd1f5cf9f65bde34c53ffe05b13554e71d9b7a5dea8e39291d1034921a3bc` |

Version remains 0.12.4 and minimum Obsidian 1.13.0; improvements are Unreleased.
The node runner's expected fake-child missing-module stderr proves its fail-closed
spawn-error case and is not a final test failure. No assertions/timeouts were
weakened: CSSOM style expectation is natively canonicalized while exact measured
geometry/backing, far-pixel alpha, selection, resize and popup checks remain.
No dependency installation/audit, commit, release/publication, real-vault action,
native Obsidian acceptance or mobile certification was performed. Existing
baseline work and the separate blocked native installation record remain intact.

## Review

PASS. See `.10x/tickets/2026-10-03-product-source-review.md` for independent
cross-stream source review, actual rendered-action fixes, permitted Base diagnostics,
canonical observation authority, bounded plugin-data read policy and final canvas
diffs. Root also independently inspected documents and the styled synthetic
narrow-pane captures. The final integrated gate observations above are executor
evidence on the independently reviewed freeze, without duplicate trust reruns.

## Retrospective

The complete gate exposed issues missed by isolated feature runs: a blanket
adapter rule needed a strictly exact single-file text-reader exception, unrestricted
node parallelism contended with shell fixtures, Base diagnostic admission needed
to include legitimate unresolved relationships and invalid admitted rows, and
fractional CSS layout exposed both a serialization assumption and incomplete
backing-pixel paint. Preserve canonical observation authority separately from
mapped graph resolution. Strengthening fractional fixtures kept exact geometry
and pixel checks useful; widening tolerances or timeouts would have hidden the
actual paint regression. Every failed observation remains recorded alongside
its focused correction and final full PASS.
