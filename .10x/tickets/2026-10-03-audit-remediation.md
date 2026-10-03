Status: done
Created: 2026-10-03
Updated: 2026-10-03

# People Atlas audit remediation

## Scope and authorization

The user approved implementation on 2026-10-03 ("Oke, implementeer maar")
after the concrete source, synthetic mutation and browser audit in this chat.
This parent coordinates the approved fixes and usability improvements.
Immediate implementation is explicitly authorized; do not add another approval
checkpoint solely because these execution records are being written now.

## Children and sequence

1. `2026-10-03-relationship-edit-safety.md`: source identity guards and shared
   ambiguity-safe endpoint resolution.
2. `2026-10-03-atlas-ui-remediation.md`: single details surface, container
   layout, accurate scope, filtered focus, primary action and explicit search scope.
3. `2026-10-03-contact-snapshot-performance.md`: reuse reference indexes per
   snapshot and add contact-history workloads.
4. `2026-10-03-contact-people-search.md`: searchable explicit multi-person
   selection preserving the existing contact-moment mutation contract.

Children 1-3 may execute independently. Child 4 follows child 3 for executor
availability; coordinate shared locale/CSS changes with child 2. Independent
review and integrated validation follow all implementations.

## Non-goals

No real-vault writes, migrations, inferred identities/relationships, dependency
upgrades, commits, pushes, installation, release or deployment. Search still
filters the supplied projection; a new vault-global search service was only an
optional later proposal, not required to make the approved scope explicit.

## References

- `.10x/specs/relationship-edit-source-safety.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/performance-characterization.md`
- `.10x/tickets/2026-08-10-person-reference-resolution-safety.md` (done;
  editor/mutation scope was excluded)
- `.10x/tickets/2026-08-16-people-atlas-kiss-ux.md` (prior completed UX work)
- `.vitest-attachments/audit-2026-10-02/results.json` (local synthetic evidence)

## Acceptance criteria

- Every child has source/test evidence and independent review.
- Required `npm run test`, `npm run build`, and `git diff --check` are attempted;
  blocked checks are recorded as blocked, never passed.
- Synthetic browser evidence remains distinguished from native Obsidian.
- No user data or unrelated changes are overwritten.

## Assumptions

User-ratified: the preceding seven findings and three practical improvements.
Record-backed: stable identity, explicit mutation, common snapshot and owning
window rules in AGENTS.md and existing specifications remain mandatory.

## Journal

- 2026-10-03: Initial tracked tree clean. Repository skill pointer is absent;
  available personal 10x skill was read. Existing terminal tickets are history,
  so this work gets bounded follow-up owners.
- 2026-10-03: Prepared the installed Rolldown version's supported WASI backend
  under ignored `.vitest-attachments/audit-tooling/node_modules`. Every package
  was taken from the existing lockfile and SHA-512 verified before extraction;
  no project manifest/lockfile or Windows security policy changed. With
  `NODE_PATH` pointing to that directory and `NAPI_RS_FORCE_WASI=error`, importing
  Rolldown succeeded. UI executor owns an explicit optional Edge test channel;
  default managed Chromium remains the CI configuration.
- 2026-10-03: WASI then failed resolving Windows test imports under both
  supported config loaders; no test pass was claimed. Later, native Biome
  succeeded in a fresh elevated process, and a fresh default Rolldown import
  also succeeded without WASI/NODE_PATH overrides. The earlier native failure
  no longer reproduces; its cause is unknown and no security setting was
  changed. Executors resumed normal Vitest regression runs with the explicit
  installed-Edge channel. Final canonical gate remains pending integration.
- 2026-10-03: Computer Use availability was rechecked after native test tooling
  recovered. The trusted Node kernel exited on import, then its automatic reset
  again reported `windows sandbox failed: helper_unknown_error: setup refresh
  had errors`. This happened before loading the desktop driver or contacting
  Obsidian. No native app interaction or plugin installation occurred.
- 2026-10-03: Independently inspected the corrected 450px-pane screenshot and
  browser observations: no horizontal overflow, one details owner, Whole network
  label and remaining-result focus. These use the actual plugin in the controlled
  host and installed Edge; they are not native Obsidian acceptance.
- 2026-10-03: All four child source reviews passed independently. The final
  contact picker was also visually inspected at 390px: two retained selections,
  same-name path disambiguation, 44px candidate/removal targets and zero horizontal
  overflow. Synthetic source/theme capture:
  `.vitest-attachments/audit-2026-10-02/contact-picker-nl-390.png` and
  `contact-picker-results.json`; mutation counter remained zero.
- 2026-10-03: First canonical `npm run test` attempt stopped in Node with
  1,105 passing and two existing release-publish fixture timeouts at 5,000ms;
  subsequent cleanup reported locked temporary directories. `bash` resolves to
  the Windows system launcher. The isolated unchanged release suite passed all
  30 tests in 2.90s; no timeout, assertion or source change was made. A full
  unchanged retry then passed all 1,107 Node and 183 browser tests; remaining
  integration/DPR stages were still running at this entry.
- 2026-10-03: Final source `npm run build` passed (typecheck + production bundle).
  `npm run community:check` passed, inspecting 76 source files.
  `npm run release:contract` passed for 0.12.4, main.js 452,306 bytes and the
  three expected assets. `git diff --check` passed (line-ending notices only).
- 2026-10-03: Canonical full retry completed with exit 0: Node 61 files/1,107
  tests; browser 12 files/183 tests; integration 10 files/44 tests; DPR 1,
  1.5 and 2 each 1 file/2 tests. Total 1,340 test executions. Browser stages
  used the documented installed-Edge override; managed Chromium CI was not
  run here. Full log:
  `.vitest-attachments/audit-remediation-full-test-retry.log`.
  The missing fake-vitest module output is an intentional negative fixture in
  the passing fail-closed integration-runner tests, not an unhandled suite error.
- 2026-10-03: All child acceptance criteria mapped to evidence and independent
  PASS reviews. Closed all four children and this parent. No source changes
  followed the full-gate source freeze. Final bundle SHA-256:
  `58803f37516a40695e7338eda0bf7ae4f4f516606011ba6a5a73eaca2c176f7f`.

## Blockers

None for the approved implementation and automated gates. Native Obsidian
Computer Use remains unavailable because the sandbox helper fails before app
contact. Native Desktop/Mobile, real themes and host behavior remain unverified;
no native acceptance or installation is claimed.

## Evidence

- Relationship source safety and ambiguity handling: child
  `2026-10-03-relationship-edit-safety.md`, pure/form/mutation/entrypoint and
  browser regression evidence; independent PASS.
- UI consistency, pane layout, focus, scope and action order: child
  `2026-10-03-atlas-ui-remediation.md`, controlled integration, renderer tests
  and inspected screenshots; independent PASS.
- Contact snapshot reuse and equivalence: child
  `2026-10-03-contact-snapshot-performance.md`, construction/lifecycle tests and
  `.10x/evidence/2026-10-03-contact-history-characterization.md`; independent PASS.
- Searchable contact selection: child `2026-10-03-contact-people-search.md`,
  create/edit/identity/keyboard/partial-success tests and 390px capture;
  independent PASS.
- Integrated automated gates and exact execution counts: journal above.
- Local source/build only. No real-vault writes, plugin installation, dependency
  upgrades, version changes, commit, push or release were performed.

## Review

**PASS.** Source-safety and performance children were reviewed by the UI executor;
UI and contact-selection children were reviewed by the source-safety executor.
Reviewers did not author those respective changes or repeat executor tests.
The parent reconciled their findings, the source/test/spec contracts and the
cross-cutting final gate. No critical, significant or minor issue remains in
scope. Native-host validation and the explicitly deferred center-restoration
observation retain the dispositions documented in the child tickets.

## Retrospective

- Bounded per-pass reuse resolved the measured index bottleneck without a worker
  or persistent cache; this is distilled into
  `.10x/knowledge/performance-characterization-boundaries.md`.
- Treat native startup errors, temporary process timeouts and actual assertion
  failures separately. Preserve failed evidence; retry with unchanged safeguards
  only after a concrete isolated check. The successful final gate used no
  relaxed assertions, timeout limits or security settings.
- Shared source contracts can support focused UI improvements while keeping
  native-host claims separate. The installed-browser override is documented in
  README, and the new contact picker retains the existing mutation boundary.
