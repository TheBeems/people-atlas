Status: done
Created: 2026-07-27
Updated: 2026-07-31

# P8 — Reproducible release hardening

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-27-high-dpi-popup-browser-matrix.md`

## Scope

Implement `.10x/specs/reproducible-obsidian-release.md` as one bounded P8
outcome:

1. add a committed npm lockfile and declare Node 24;
2. add the exact Windows ARM64-compatible `@biomejs/biome@2.4.15`
   configuration and format/lint scripts;
3. preserve strict TypeScript while making format, lint, type, test, build,
   release-contract and dependency-audit gates independently observable;
4. minify production output, use a separate development sourcemap and enforce
   the 409,600-byte `main.js` budget;
5. implement and test fail-closed metadata, tag, asset and bundle validation;
6. verify two same-input production builds have identical SHA-256 digests;
7. change CI/release installation to `npm ci`, add dependency review and
   harden release ordering/provenance with `actions/attest@v4`;
8. document the local release contract without publishing anything;
9. run the complete executor gates and hand the diff to fresh independent
   review.

## Non-goals

- Creating or pushing a Git tag, configuring a remote, publishing a GitHub
  release or submitting to the Obsidian Community directory.
- Supporting Obsidian before 1.13.
- Live Obsidian, Mobile, Bases, pop-out or assistive-technology validation.
- SBOMs, installers, deployment environments or a general release platform.
- Runtime dependencies, unrelated package upgrades, product features,
  refactors or performance work.
- Raising the accepted bundle budget or suppressing material lint/audit
  findings to make the gate pass.

## Acceptance criteria

- [x] `package-lock.json` is tracked, Node 24 is declared, and CI/release use
      `npm ci` with lockfile-backed setup-node caching where applicable.
- [x] `@biomejs/biome` is exactly `2.4.15`; its config checks maintained
      code/config only and excludes `.10x`, dependencies and generated,
      coverage, browser and release outputs.
- [x] Package scripts expose format-check, lint, typecheck, test, build,
      release-contract, dependency-audit and reproducibility commands.
- [x] The normal `npm run check` composes the offline format/lint/type/test/
      production-build/release-contract/bundle gates.
- [x] TypeScript strictness is not weakened and any baseline formatting is
      behavior-preserving and limited to Biome-owned files.
- [x] Production esbuild output is minified and contains no sourcemap;
      development writes a separate ignored `main.js.map`.
- [x] Release validation fails closed for malformed or mismatched package,
      manifest, versions, minimum-version, required-file, tag, asset and bundle
      inputs, with focused positive and negative automated tests.
- [x] Current Obsidian API `1.13.1`, minimum `1.13.0`, plugin version `0.1.0`
      and `versions.json` mapping remain coherent.
- [x] A production `main.js` at or below 409,600 bytes passes; an oversized
      fixture fails with observed and allowed sizes.
- [x] Dependency review uses the lockfile and fails on high/critical audit
      findings in both CI and release workflows.
- [x] The reproducibility command builds twice from the same installed inputs,
      reports SHA-256 and fails on differing output; the verified second build
      remains the candidate.
- [x] Release automation validates exact unprefixed `x.y.z` tag equality before
      attesting and publishing exactly `main.js`, `manifest.json` and
      `styles.css` with `actions/attest@v4`.
- [x] README/release documentation distinguishes local readiness from an
      actual Obsidian Community submission or GitHub publication.
- [x] No compiled artifact, sourcemap, release staging file, tag, remote or
      external release is added by execution.
- [x] `npm ci`, focused release-contract tests, `npm run test`,
      `npm run build`, `npm run check`, dependency audit, reproducibility
      verification and `git diff --check` pass.
- [x] Fresh independent review records findings, verdict and residual risk;
      closure requires `pass` or explicit acceptance of non-critical risk.

## References

- `.10x/specs/reproducible-obsidian-release.md`
- `.10x/research/2026-07-27-p8-release-hardening-gap-analysis.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `.10x/knowledge/browser-scale-popup-testing.md`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `package.json`
- `tsconfig.json`
- `esbuild.config.mjs`
- `manifest.json`
- `versions.json`
- `.gitignore`
- `README.md`
- `AGENTS.md`
- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://docs.obsidian.md/plugins/guides/load-time
- https://docs.npmjs.com/cli/v11/commands/npm-ci/
- https://biomejs.dev/guides/getting-started/
- https://github.com/actions/attest

## Assumptions

- User-ratified: People Atlas supports only Obsidian 1.13+, with compile-time
  API 1.13.1 and minimum application version 1.13.0.
- User-ratified: Biome is the single lint/format tool.
- User-ratified: the uncompressed production `main.js` limit was originally
  200 KiB (204,800 bytes) and was explicitly amended to 400 KiB
  (409,600 bytes) on 2026-07-31 after the fresh-vault cleanup measurement.
- User-ratified: the declared development, CI and release runtime was raised
  from Node 22 to Node 24 LTS on 2026-07-31. Earlier Node 22 journal entries
  remain historical evidence.
- User-ratified: P8 validates Community-submission readiness only; actual
  publication and submission remain outside P8.
- Record-backed: P7a-P7c automated Node/integration/generated/Chromium coverage
  is closed and live product evidence is a separate, non-CI claim boundary.
- Record-backed: the current production bundle is unminified, CI/release use
  `npm install`, no lockfile exists, version/tag validation is absent and the
  previous provenance action is outdated.
- Platform-observed on 2026-07-28: exact Biome 2.4.15 is the first authorized
  candidate that processes files on Windows ARM64; exact 2.5.5 and 2.5.4
  terminate with `0xC0000005` before doing so.
- Record-backed: this checkout has no configured Git remote or tags; execution
  therefore cannot accidentally constitute a valid external publication path.
- Mechanical: exact helper-script filenames and internal function boundaries
  may be chosen by the executor while the commands, failure behavior and
  acceptance contract remain unchanged.

## Journal

- 2026-07-27: Read-only P8 gap analysis found deterministic-install,
  lint/format, minification, budget, metadata/tag, dependency-review,
  reproducibility and current attestation gaps. Findings are recorded in
  `.10x/research/2026-07-27-p8-release-hardening-gap-analysis.md`.
- 2026-07-27: The user ratified Biome as the one lint/format tool, the original
  200 KiB uncompressed production bundle budget and submission-readiness-only
  scope. On 2026-07-31 the user explicitly raised only that bundle budget to
  400 KiB.
- 2026-07-31: The user explicitly raised the project, CI and release build
  baseline from Node 22 to Node 24 LTS. Active contracts and automation now
  target Node 24; earlier Node 22 observations remain historical.
- 2026-07-27: A read-only npm registry query resolved the exact selected Biome
  version to `2.5.5`.
- 2026-07-27: The active governing specification and this single executable
  P8 ticket were created. Per the shaping/execution boundary, no dependency,
  lockfile, source, script, workflow, generated artifact, test or publication
  implementation occurred in this turn.
- 2026-07-27: Existing uncommitted P7d feasibility/parent-record changes were
  deliberately left untouched and are not absorbed into P8 scope.
- 2026-07-27: The user explicitly authorized P8 implementation. Execution
  began after reading the active release contract, P8 gap analysis, completed
  P7c dependency evidence, relevant testing knowledge, current package/build/
  workflow metadata and project instructions. The pre-existing modified P7d
  parent record and untracked P7d research remain excluded; no commit, push,
  tag, remote configuration, release or Community submission is authorized.
- 2026-07-27: Local execution starts on Node `v24.18.0` and npm `11.16.0`.
  Node 22 remains the declared automation/release runtime; local verification
  can prove repeatability within this installed Node 24 process but cannot
  substitute for the workflow's Node 22 run.
- 2026-07-27: `npm install --save-dev --save-exact
  @biomejs/biome@2.5.5` succeeded outside the sandbox, adding two packages,
  generating `package-lock.json` and auditing 73 packages with zero
  vulnerabilities. npm 11 also emitted an informational `allow-scripts`
  warning for esbuild's install script; this command still completed with exit
  0 and does not itself prove that a later clean `npm ci` can execute the
  esbuild binary.
- 2026-07-27: `npm install --package-lock-only` synchronized the new
  `engines.node = "22.x"` declaration into the lockfile and again reported
  zero vulnerabilities. The expected `EBADENGINE` warning records that this
  workstation is running Node 24 rather than the declared Node 22 release
  runtime; npm also repeated its informational esbuild `allow-scripts`
  warning.
- 2026-07-27: The first `npm run format:check` could not reach source
  diagnostics: the installed official Windows ARM64 Biome 2.5.5 binary exits
  with Windows status `-1073741819` (`0xC0000005`, access violation) for
  `format`, `lint` and `check`, both inside and outside the sandbox. `biome
  rage` itself succeeds and reports Biome 2.5.5, `aarch64`/Windows and a loaded
  configuration. Running against a separate minimal configuration and stdin
  reproduces the same native crash, so this is not a repository formatting or
  lint finding. Execution continues through independent non-Biome gates while
  this exact-tool/platform incompatibility remains a potential closure
  blocker; the pinned dependency is not being substituted or upgraded without
  authorization.
- 2026-07-27: Focused `npm run test:release-contract` passed 1 file and 7
  tests. The pure fixture cases accept coherent `0.1.0`/`1.13.0` metadata and
  exact assets, and reject malformed/mismatched metadata, prefixed tags,
  missing inputs/assets, production sourcemaps and a 204,801-byte bundle with
  observed/allowed sizes. A separate assertion proves differing
  reproducibility digests report both values. This does not execute GitHub
  Actions or a real publication.
- 2026-07-27: `npm run typecheck` passed `tsc --noEmit` with the existing
  strict compiler settings unchanged. This proves the maintained TypeScript
  and new `.mjs` declaration surfaces typecheck; it does not prove runtime
  behavior or formatting.
- 2026-07-27: `npm run build:production` passed. The resulting ignored
  `main.js` is 116,185 bytes, below the 204,800-byte budget; `main.js.map` is
  absent, `main.js` contains zero `sourceMappingURL` directives and its first
  line is 78,998 characters, consistent with the configured production
  minification. This inspects the local Node 24 output and does not prove the
  Node 22 workflow artifact.
- 2026-07-27: `npm run release:contract` and
  `npm run release:contract -- --tag 0.1.0` passed against the actual
  repository, reporting version `0.1.0`, bundle `116185/204800` bytes and the
  exact candidate set `main.js`, `manifest.json`, `styles.css`. The intentional
  negative command with tag `v0.1.0` exited 1 and reported both strict-syntax
  and manifest-version mismatches before any external step. These local
  commands validate files only; they do not attest or publish them.
- 2026-07-27: `npm run verify:reproducible` removed only ignored `main.js` and
  `main.js.map` between two production builds, then passed with identical
  SHA-256
  `43ae4872f19a1f40d1e3e3eb4f5dbb83aed3820fc1a6bbef8c8fd0aee0b7ee38`.
  The second build remains as the ignored candidate. This proves repeatability
  for the current installed dependency tree and local Node 24 process, not the
  declared Node 22 GitHub runner until CI executes it.
- 2026-07-27: One-shot development characterization with
  `node esbuild.config.mjs development` produced separate ignored files:
  `main.js` 199,108 bytes and `main.js.map` 355,316 bytes. A following
  `npm run build:production` proactively removed the stale map and restored a
  116,185-byte minified `main.js` with no `main.js.map`. The normal `npm run
  dev` path still watches; the one-shot mode exists only to make the same
  development configuration verifiable without leaving a background process.
- 2026-07-27: Network-backed `npm run dependency:audit` passed with zero
  vulnerabilities at the high/critical failure threshold. This is a
  time-varying registry observation on 2026-07-27, not part of offline
  byte-for-byte reproducibility.
- 2026-07-27: Escalated clean `npm ci` succeeded from the generated lockfile,
  adding 72 packages and auditing 73 with zero vulnerabilities. It reported
  the expected local Node 24 versus declared Node 22 `EBADENGINE` warning and
  npm 11's unapproved esbuild postinstall warning. An immediate
  `npm run build:production` nevertheless passed, proving the clean install's
  esbuild binary is executable on this workstation. `npm ci` did not repair or
  rewrite package metadata.
- 2026-07-27: Full `npm run test` after the clean install passed 29/29 files
  and 315/315 tests, including the seven new release/reproducibility contract
  assertions plus the existing Node, Chromium browser, integration, generated
  and DPR/popup owners. This green matrix still carries the existing P7 claim
  limits and does not prove live Obsidian or release-workflow execution.
- 2026-07-27: Required project gate `npm run build` passed its independently
  visible `typecheck` and `build:production` stages after the clean install.
  This preserves the repository's established build entrypoint while the
  composed `check` can name each offline stage separately.
- 2026-07-27: Final `npm run check` correctly composed format, lint, type,
  test, production-build and release-contract stages, but exited 1 at its
  first `format:check` stage because the pinned Windows ARM64 Biome process
  again terminated before emitting file diagnostics. The command did not
  proceed to later stages; those stages are supported only by the separately
  journaled commands. `npm run lint` independently fails at the same native
  process boundary. This is a required acceptance gate, so the ticket cannot
  truthfully close on this workstation without a separately authorized tool
  resolution or independent Node 22/Linux CI evidence.
- 2026-07-27: Post-configuration `biome rage` exits 0 and reports the exact
  2.5.5 package, Windows `aarch64`, a successfully loaded `biome.json`, enabled
  formatter/linter and disabled assist. This narrows the failure to execution
  of Biome's file-processing commands; it does not certify that their
  configured include patterns or repository baseline would pass on Linux.
- 2026-07-27: Final reproducibility rerun after the production stale-map
  cleanup change again passed with identical SHA-256
  `43ae4872f19a1f40d1e3e3eb4f5dbb83aed3820fc1a6bbef8c8fd0aee0b7ee38`
  for both builds, leaving the verified second bundle in place.
- 2026-07-27: Final candidate validation
  `npm run release:contract -- --tag 0.1.0` passed after the reproducibility
  rerun, reporting the retained `main.js` at 116,185/204,800 bytes and only the
  three intended assets.
- 2026-07-27: Final contract-test hardening added explicit malformed-JSON
  cases for each of `package.json`, `manifest.json` and `versions.json`, plus a
  disagreeing current versions mapping. Focused verification then passed 1/1
  file and 10/10 tests; final full verification passed 29/29 files and 318/318
  tests. These replace the earlier 7/315 intermediate totals without changing
  their historical observations.
- 2026-07-27: Final required `npm run build` passed after the last test edit.
  Final `git diff --check` exited 0 with only informational Windows line-ending
  warnings, and the separate untracked-P8 scan found no trailing whitespace.
  Scope/status inspection still shows the pre-existing modified P7d parent and
  untracked P7d research unchanged; they were not edited or absorbed by P8.
- 2026-07-28: The user explicitly authorized exactly the four-finding closure
  repair proposed after independent review: remote tag existence plus peeled
  commit equality to the original workflow SHA immediately before
  publication; regular-file and embedded/external `sourceMappingURL`
  validation with focused regressions; bounded Biome probes at exact 2.5.4
  then, only after another native crash, exact 2.4.15; and a commit only after
  green independent re-review. Execution resumed as `active`. No remote,
  tag, release, commit or Community submission is authorized in this round.
  The pre-existing P7d parent/research paths remain explicit no-touch paths.
- 2026-07-28: Release-side-effect premortem: the edited workflow may read the
  remote tag and original workflow SHA only after all build, audit,
  validation, reproducibility and attestation gates pass; it creates no state
  before the existing final `gh release create`. A missing, moved, unpeelable
  or different remote tag must exit nonzero. There are no notification,
  retry, retention, billing or new permission semantics in this repair, and
  no workflow is executed locally.
- 2026-07-28: Implemented the two fail-closed release repairs. The workflow
  now uses one remote `git ls-remote` query immediately before publication,
  prefers the annotated-tag `^{}` result, falls back only to the exact
  lightweight-tag ref, and requires the result to equal the original
  `${{ github.sha }}`. The validator now uses `lstat().isFile()` for every
  required input and release candidate and rejects any
  `sourceMappingURL\s*=` occurrence in regular `main.js`, whether inline or
  external. No remote query or workflow was executed.
- 2026-07-28: Focused `npm run test:release-contract` passed 1/1 file and
  16/16 tests after adding directory-path regressions for all three release
  candidates, a non-asset required input, and inline-data plus external
  sourcemap directives. This proves the local validator fixtures, not the
  remote-tag shell step or GitHub Actions runtime.
- 2026-07-28: Authorized first compatibility candidate
  `npm install --save-dev --save-exact @biomejs/biome@2.5.4` succeeded,
  changing only the Biome package/platform binary and lock resolution. npm
  audited 73 packages with zero vulnerabilities and repeated the expected
  local Node 24 engine plus esbuild allow-scripts warnings. Version 2.5.4 is
  only a probe candidate until both minimal-file and repository format/lint
  processing are observed.
- 2026-07-28: Exact Biome 2.5.4 reported its version successfully but both
  `biome format biome-probe.ts` and `biome lint biome-probe.ts` terminated
  with native Windows status `-1073741819` (`0xC0000005`) before diagnostics.
  Because the minimal-file stop condition failed, repository processing was
  not misrepresented or attempted for this version. The authorization now
  permits the final candidate, exact 2.4.15.
- 2026-07-28: Final authorized candidate
  `npm install --save-dev --save-exact @biomejs/biome@2.4.15` succeeded and
  again audited 73 packages with zero vulnerabilities plus the same expected
  local engine/allow-scripts warnings. It remains provisional until the
  minimal and repository probes complete.
- 2026-07-28: After replacing the newer-only `rules.preset` spelling with
  Biome 2.4.15's `rules.recommended`, both minimal commands passed and reported
  one processed file. Repository `npm run format:check` then processed 92
  configured files and reported 62 baseline format differences; repository
  `npm run lint` processed the same 92 files and reported 3 errors, 26
  warnings and 6 infos. This is the first authorized version to process both
  layers, so exact 2.4.15 is now the pinned project tool. The format baseline
  and three blocking lint errors remain within this repair; warnings are not
  being broadened into unrelated product cleanup.
- 2026-07-28: `biome format --write .` applied the first baseline to the 92
  configured maintained files and reported 62 formatted files. The two
  `useIterableCallbackReturn` errors were repaired with explicit block
  callbacks that preserve waiter resolution/rejection, and the
  test-local performance runner constant lost an unused export. After removing
  the temporary probe, `npm run format:check` processed 91 files and exited 0;
  `npm run lint` processed 91 files and exited 0 with zero errors, retaining
  26 warnings and 6 infos as nonblocking observations rather than expanding
  into unrelated product cleanup.
- 2026-07-28: Clean `npm ci` from the exact 2.4.15 lockfile passed with 72
  installed/73 audited packages and zero vulnerabilities, plus the already
  bounded local Node 24 and esbuild allow-scripts warnings. The reinstalled
  executable reported Biome 2.4.15. Focused contract verification passed
  16/16, then composed `npm run check` passed format, lint, strict typecheck,
  29-file/324-test full matrix, production build and the real release
  contract. The final bundle in that run was 116,193/204,800 bytes. Lint still
  reports 26 warnings and 6 infos but zero blocking errors; the command exits
  0 by the pinned tool's defined severity contract.
- 2026-07-28: Required standalone `npm run build` passed strict typecheck and
  production bundling after the formatter baseline and two lint-error repairs.
  Network-backed `npm run dependency:audit` again found zero vulnerabilities.
  `npm run verify:reproducible` then produced identical SHA-256
  `3d44c03ca168600935322095208d01fd36ea96bf70c871ac909bc1cd772f8bac`
  for both clean builds, leaving the second candidate. Final exact-tag
  validation passed `0.1.0` with `main.js` at 116,193/204,800 bytes and the
  exact three release assets.
- 2026-07-28: Final `git diff --check` exited 0 with only informational
  Windows line-ending warnings; the separate untracked-P8 scan found no
  trailing whitespace, and the temporary Biome probe file is absent. Scope
  inspection confirms the broad 62-file formatter baseline is limited to
  `biome.json`'s maintained source/test/script/root inputs plus the two named
  blocking-lint repairs. `.10x/` was excluded, so the pre-existing P7d
  parent/research paths were not formatted, edited or staged.
- 2026-07-28: A one-point follow-up completed the already-authorized
  fail-closed tag repair by adding `--verify-tag` to the final
  `gh release create`. The immediately preceding remote existence, annotated
  peel and original-SHA equality check remains intact; `--verify-tag` closes
  deletion between that check and GitHub CLI publication. A narrow static
  regression now requires guard-before-publication ordering, the explicit
  remote SHA comparison and the exact `--verify-tag` publication command.
- 2026-07-28: One-point verification passed: focused release-contract testing
  passed 1/1 file and 17/17 tests; format checking covered 91 files; lint
  covered 91 files with zero errors (26 warnings and 6 infos); the required
  `npm run build` passed; and `git diff --check` exited zero with informational
  line-ending warnings. The full suite was not repeated because this follow-up
  changes only the workflow's static CLI guard and its static assertion; the
  prior green composed 29-file/324-test check remains recorded above.
- 2026-07-28: Final one-point independent re-review recorded **Pass**, no
  findings and bounded residual risk. The user then authorized exactly one
  local closure commit, `Harden reproducible Obsidian releases`, containing
  this ticket, the reviewed P8 implementation and formatter baseline, the
  lockfile, spec and gap analysis. `Status: done` and the tracked-lockfile
  criterion are true on successful creation of that atomic commit. The P7d
  parent ticket and live-validation research remain explicitly excluded; no
  push, tag, release, remote configuration or publication is authorized.

## Blockers

None for P8 implementation or local closure. Exact Biome 2.4.15 processes the
minimal and repository file sets on Windows ARM64, all executor gates pass,
and final independent re-review records **Pass** with no findings. The atomic
local closure commit tracks the lockfile and complete reviewed P8 scope.

External publication remains excluded and would require a configured remote
plus separate explicit authorization.

## Evidence

- Lock/runtime: `package.json`, `.nvmrc` and `package-lock.json` declare Node
  22, exact Biome 2.4.15 and the locked dependency tree. Clean `npm ci` passed
  with 72 installed/73 audited packages; the expected local Node 24 engine
  warning is journaled. CI/release both use Node 22, setup-node npm caching and
  `npm ci`.
- Static/build scripts: `package.json` exposes every required independent
  command and composes the offline stages in `check`.
  `tsconfig.json` was not changed; standalone `npm run typecheck` and final
  `npm run build` passed.
- Bundle contract: `esbuild.config.mjs` minifies production, removes a stale
  map and emits an external map only for development. Direct characterization
  observed development `199108`/map `355316` bytes. Final production is
  `116193` bytes with no map or source-map directive.
- Validation: `scripts/release-contract.mjs` reports all collected
  metadata/tag/input/regular-file/asset/map/directive/size failures and never
  writes. `test/release-contract.test.ts` passed 17 focused positive/negative
  cases, including directory paths for every release asset, both inline and
  external `sourceMappingURL` forms, and a static workflow regression requiring
  the final fail-closed tag guard.
  Actual repository validation passed for no tag and exact tag `0.1.0`;
  intentional `v0.1.0` failed with both relevant diagnostics.
- Budget: actual final `main.js` is 116,193 bytes versus the 204,800-byte
  ceiling. The 204,801-byte fixture reports both observed and allowed sizes.
- Audit: final `npm run dependency:audit` passed with zero vulnerabilities on
  2026-07-28. Both workflows run it before later release work.
- Reproducibility: `scripts/verify-reproducible-build.mjs` deletes only the
  two ignored known outputs, builds twice and leaves the second candidate.
  Final SHA-256 was identical:
  `3d44c03ca168600935322095208d01fd36ea96bf70c871ac909bc1cd772f8bac`.
  The pure mismatch assertion reports both differing digests.
- Workflow ordering: `.github/workflows/release.yml` installs, audits, checks,
  validates the exact tag, builds twice, validates the retained candidate,
  attests exactly the three assets through `actions/attest@v4`, then
  immediately queries the exact remote tag, uses its peeled target for
  annotated tags and requires equality to the original workflow SHA before
  invoking `gh release create --verify-tag` with only those assets. No workflow
  was executed and no external state was changed.
- Documentation: `README.md` and `README.nl.md` document `npm ci`, the offline
  versus network gates, exact unprefixed tag and the distinction between
  readiness and actual GitHub/Obsidian publication.
- Full behavior: final composed `npm run check` passed non-writing format,
  lint with zero errors, strict typecheck, 29/29 files and 324/324 tests,
  production build and release contract after clean install. Required
  standalone `npm run build` also passed typecheck plus production build.
- Hygiene: `git diff --check` exited 0 with only informational Windows line
  ending warnings. A separate scan found no trailing whitespace in untracked
  P8 files. `git ls-files` contains no `main.js`, `main.js.map`, `release/` or
  lockfile; `git check-ignore -v` confirms all three generated-output paths
  are ignored. The absent lockfile result reflects the explicit no-commit
  boundary, not an intended omission.
- Closure: final independent one-point re-review records **Pass** with no
  findings. The single authorized local closure commit tracks
  `package-lock.json` together with the complete reviewed P8 code, config,
  workflows, documentation, formatter baseline, research, specification and
  ticket. The unrelated P7d parent ticket and live-validation research are
  excluded, and no external release state is changed.
- Biome compatibility: exact 2.5.4 reproduced the 2.5.5 native
  `0xC0000005` crash on minimal format and lint probes. Exact 2.4.15 processed
  the minimal file and repository, supplied the behavior-preserving 62-file
  formatter baseline, and finished final format/lint gates with zero errors.
  The 26 warnings and 6 infos remain visible but nonblocking.

## Review

Independent red-team review was performed on 2026-07-27 against
`.10x/specs/reproducible-obsidian-release.md`. The reviewer did not author the
implementation, did not change product/tooling files and did not repeat the
executor's full verification suite. Review used the complete scoped diff,
actual test assertions, static workflow/script inspection and narrow
falsification probes.

### Findings

1. **Significant — publication is not fail-closed on the original tag
   revision.** `.github/workflows/release.yml` validates
   `${{ github.ref_name }}` against the checked-out metadata, but its final
   `gh release create` has neither `--verify-tag` nor a fresh assertion that the
   remote tag still resolves to `${{ github.sha }}`. The installed
   `gh 2.96.0 release create --help` states that, when the named tag is absent,
   the command creates it from the latest default-branch state. A tag deleted
   or moved after checkout could therefore associate the already-built and
   attested files with a recreated or different revision. This contradicts
   governing rules 30, 33 and the exact-source release gate. Repair should
   verify both remote tag existence and its peeled commit immediately before
   publication; `--verify-tag` alone closes deletion but not a moved-tag race.
2. **Significant — release asset and sourcemap validation is incomplete.**
   `scripts/release-contract.mjs` uses `access()` for required paths rather
   than proving each candidate is a regular file, and it rejects only a
   separate `main.js.map`, not an embedded `sourceMappingURL`. A targeted
   temporary fixture with coherent metadata, an inline source-map directive
   in `main.js` and a directory named `styles.css` returned `errors: []`.
   Consequently the local release contract can report success when an exact
   release file is absent and when the candidate contains an embedded
   sourcemap, contrary to the fail-closed asset/bundle and no-sourcemap
   contract. The current real candidate is a regular 116,185-byte `main.js`
   with no map directive, so this finding is about the protective gate and its
   regression coverage, not evidence that today's bundle contains a map.
3. **Significant — the mandatory Biome quality gate remains unexecutable on
   the actual local platform.** The reviewer independently confirmed Node
   `v24.18.0` on Windows ARM64, exact Biome `2.5.5`, successful `--version` and
   `rage` configuration loading, followed by native exit
   `-1073741819` (`0xC0000005`) from both `format package.json` and
   `lint package.json`. This corroborates the executor's blocker and means
   neither the maintained-file include boundary nor the formatting/lint
   baseline has a passing execution result. It does not by itself demonstrate
   an implementation defect in the repository.
4. **Significant — the lockfile acceptance criterion is not yet durable
   repository state.** `package-lock.json`, `.nvmrc`, `biome.json`, both helper
   scripts/declarations and the focused test remain untracked. The package and
   lock content coherently pin Node `22.x`, Biome `2.5.5` and Obsidian `1.13.1`,
   but CI cannot consume this contract unless the intended P8 files are
   included in an authorized commit. This is a closure/state finding, not a
   request for the reviewer to commit.

No additional defect was found in the two-build digest sequence, current
production minification/size, high/critical audit threshold, exact three-path
attestation/publication list, or gate ordering apart from Finding 1. Static
scope inspection found no product-runtime change. The modified P7d parent
record and untracked P7d research remain distinguishable from P8 and were not
absorbed by this review.

### Verdict

**Fail.** There are no critical findings, but Findings 1 and 2 contradict
explicit fail-closed release requirements, and Findings 3 and 4 independently
prevent the ticket's required acceptance evidence. The ticket must remain
blocked. Closure repair requires separate user authorization; review does not
authorize workflow/script/test changes, a Biome/tool/platform change, a commit
or publication.

### Residual risk and limits

- The review did not execute GitHub Actions, contact a remote, publish a
  release, repeat the full test/build/audit/reproducibility suite or verify
  Biome on Node 22/Linux. Workflow conclusions are static except for the local
  `gh` command semantics quoted above.
- Executor evidence supports the current Node 24/Windows build, audit,
  contract tests and digest. Node 22/Linux behavior and a real attestation
  remain unobserved.
- The current ignored production candidate can change on the next build and is
  not durable evidence until CI builds from the committed source and lockfile.

### Authorized repair handoff

The 2026-07-28 executor repair addresses each historical finding without
claiming to supersede the review verdict:

1. The publication step is now immediately preceded by an exact remote-tag
   lookup, annotated-tag peel preference and equality check against the
   original workflow SHA. Missing, unresolvable and moved tags all exit before
   `gh release create`; the final invocation also uses `--verify-tag` so tag
   deletion between the check and publication fails closed.
2. Every required input and release candidate must now be a regular file.
   `main.js` rejects both inline and external `sourceMappingURL` directives;
   focused fixtures and the workflow guard pass 17/17.
3. Exact Biome 2.5.4 reproduced the native minimal-file crash. Exact 2.4.15 is
   the first authorized candidate to process minimal and repository format/
   lint inputs, is now pinned in package/lock/spec, and passes the final
   composed gate after the behavior-preserving baseline and three blocking
   lint repairs.
4. The intended lockfile and other new P8 files remain untracked only because
   the user ordered re-review before the authorized commit.

Fresh independent re-review is now required. The historical `Fail` remains the
only verdict until that reviewer records a new result; this executor claims
only green repair evidence.

### Independent closure-repair re-review — 2026-07-28

This targeted re-review inspected the post-repair diff and assertions without
repeating the executor's full test/build/audit/reproducibility suite. Narrow
probes covered the repaired release validator and the selected Biome binary,
formatter and linter.

#### Findings

1. **Significant — a tag-deletion race can still fall back to tag creation.**
   The new `git ls-remote` step correctly fails for an absent tag at query
   time, prefers the peeled `^{}` target of an annotated tag, falls back only
   to the exact lightweight-tag ref and compares that commit with the original
   `${{ github.sha }}`. It is also ordered directly before publication.
   However, verification and `gh release create` remain separate operations.
   If the tag is deleted after the query succeeds but before the next command
   creates the release, the current invocation has no `--verify-tag`. As
   recorded by the prior review from installed `gh 2.96.0` help, `gh release
   create` then creates the missing tag from the latest default-branch state.
   Thus the repair closes absent/moved tags at query time but not the named
   no-fallback race, contrary to governing rules 34-35. The newly required
   bounded repair is to add `--verify-tag` to the existing publication
   command; the peeled-SHA query must remain because `--verify-tag` alone
   cannot detect a moved tag.

No finding remains for regular-file or sourcemap validation. A fresh temporary
fixture combining an inline `sourceMappingURL` with a directory named
`styles.css` returned both expected errors. The implementation uses
`lstat().isFile()` for every governed input/asset and the tests cover all three
asset directories, a non-asset input directory, inline data and external map
directives.

No finding remains for Biome compatibility or the formatter baseline.
Package, lockfile, installed wrapper and Windows ARM64 platform package all pin
exact `2.4.15`; no `2.5.4` or `2.5.5` resolution remains. Independent narrow
execution confirmed version reporting plus repository `format` and `lint`
processing: 91 files, no format differences, zero lint errors, 26 warnings and
6 infos. `rules.recommended` is accepted by the pinned configuration, no
blanket suppression was added, and the temporary probe is absent. Diff
inspection found the broad baseline within the configured source/test/script/
root inputs. Its semantic changes are limited to equivalent formatting, two
`forEach` callback blocks that retain waiter resolve/reject behavior, and
removal of an unused export from the test-local graph-delta runner constant;
the constant has no external consumer.

Scope inspection found no new P7d edit or absorption, no configured remote or
tag, no commit and no publication. The ignored `release/people-atlas` staging
files predate P8 (2026-07-24 timestamps) and were not created or updated by
this repair. New P8 files remain intentionally untracked pending a green
review.

#### Verdict

**Fail.** Three historical implementation findings are repaired, but the
remaining significant no-fallback race prevents a green closure verdict and
therefore prevents the authorized commit. The ticket should remain active
until the single `--verify-tag` repair receives authorization, is implemented,
verified and independently re-reviewed. The current `## Blockers` statement
that no implementation blocker remains is consequently stale; this review
does not authorize changing it or repairing the workflow.

#### Residual risk and limits

- GitHub Actions, the remote-tag shell step, attestation and publication were
  not executed. Tag peeling and ordering were reviewed statically; the only
  live `gh` behavior used is the already-recorded installed CLI contract.
- Biome evidence is local Node 24/Windows ARM64 evidence. Node 22/Linux CI and
  a committed lockfile remain unobserved until an authorized commit and CI
  run.
- The reviewer did not repeat the 324-test matrix, build, network audit or
  digest run. Those remain executor evidence with their recorded limits.
- Because the formatter baseline spans 62 files, review combined complete
  scope/diff inspection with targeted semantic checks; it is not a proof of
  every possible runtime behavior beyond the executor's green tests.

### Final tag-race re-review — 2026-07-28

This one-point independent review inspected only the final authorized
tag-deletion-race repair, its focused static assertion and the dated ticket
evidence. No broad gate was repeated.

#### Findings

None. The remote guard remains the step immediately before publication, with
no intervening named step. It queries only the exact remote tag, fails when the
tag is absent or unresolvable, prefers the annotated `^{}` peeled commit,
falls back to the exact lightweight ref and requires equality with the
original `${{ github.sha }}`. The following publication command now uses
`gh release create "$TAG" --verify-tag`, so deletion after the remote query
cannot trigger GitHub CLI's fallback tag creation.

The focused workflow assertion would fail if the named guard vanished or
moved after publication, if the explicit remote SHA comparison disappeared,
or if the exact publication command lost `--verify-tag`. Static inspection
also confirms the guarded block still contains `git ls-remote --exit-code` and
the annotated-tag peel logic. The assertion is intentionally not a shell or
GitHub Actions emulator.

Scope inspection found no new P7d change, commit, remote, tag, publication or
staging mutation. `HEAD` remains
`ef760d03a6c2dae1de72340ca4d59047f7d84a2a`; the pre-existing P7d paths remain
separate from P8.

#### Verdict

**Pass.** The remaining significant finding from the 2026-07-28 closure-repair
review is resolved. No new repair is required. Within the ticket's explicit
local/CI-readiness boundary, independent review no longer blocks the
user-authorized scoped commit; this review does not itself authorize or
perform publication.

#### Residual risk and limits

- The remote query, GitHub Actions job, attestation and release command were
  not executed. Correctness is based on the inspected fail-closed shell
  ordering and focused static regression.
- A remote tag can still change after the SHA query. `--verify-tag` closes
  deletion/fallback creation; the immediately preceding peeled-SHA comparison
  closes moved tags at the last explicit verification point. No client-side
  workflow can make those separate remote operations atomic.
- Node 22/Linux CI and the committed-source build remain future evidence after
  the authorized local commit.

## Retrospective

The release logic itself stayed small: one pure fail-closed validator and one
two-build digest script were enough to make version, asset, size and
reproducibility failures directly observable. Keeping the npm audit separate
from the offline `check` preserved the distinction between reproducible source
verification and time-varying registry state. A one-shot development esbuild
mode also proved external sourcemap behavior without leaving a watcher
process, while production proactively removes stale debug output.

The surprise was platform-specific rather than repository-specific. Registry
installation, version reporting and configuration loading all succeeded, but
the official pinned Windows ARM64 Biome binary access-violated as soon as it
processed any file. Reproducing with a minimal config, stdin and an
outside-sandbox run prevented a false source-formatting diagnosis. The useful
stop rule was the ticket's explicit dependency boundary: continue independent
proof, preserve the requested exact version and block closure instead of
quietly adding a platform workaround or changing tools.

The remaining friction is that a release contract targeting Node 22 is being
executed locally on Node 24. Engine declarations and CI express the intended
runtime, while local evidence is honestly bounded to Node 24. The next repair
should first obtain the missing Biome evidence on the declared Node 22/Linux
path or explicitly ratify a Windows ARM64-compatible resolution; it should not
rework the already-green release validator, build or audit paths.

The closure repair confirmed that the Biome failure was version-specific, not
a permanent Windows ARM64 limitation: 2.5.5 and 2.5.4 crashed before touching a
file, while 2.4.15 processed the same minimal and repository inputs. Testing
the smallest file first avoided paying for a repository run on a broken
candidate. Once a version processed files, treating formatter output as one
explicit baseline and repairing only blocking lint errors kept the scope
mechanical; tests and typechecking then guarded against semantic drift.

Release publication needs two distinct identities: the immutable workflow SHA
used to build and attest, and the mutable remote tag users will install. The
smallest fail-closed bridge is to query the remote tag at the last possible
moment, peel annotated tags, and compare the resulting commit to the original
SHA. Merely validating tag text or requiring tag existence does not establish
that identity.
