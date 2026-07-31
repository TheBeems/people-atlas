Status: active
Created: 2026-07-27
Updated: 2026-07-31

# P8 — Reproducible Obsidian release

## Purpose

Make People Atlas reproducibly buildable and ready for an exact-version
Obsidian GitHub release, using the smallest release system appropriate for one
community plugin.

This contract governs dependency installation, static quality checks,
production bundling, version and artifact validation, dependency review,
reproducibility and release provenance. It does not authorize publishing.

## Governing contract

### Toolchain and dependency installation

1. Node.js major version 24 MUST be the declared and CI/release build runtime.
2. `package-lock.json` MUST be committed and MUST be the dependency-tree
   authority used by automation.
3. CI and release workflows MUST install dependencies with `npm ci`; they MUST
   NOT update the lockfile.
4. Existing direct dependency ranges MAY remain in `package.json`; the
   lockfile MUST resolve their exact transitive tree.
5. The Obsidian compile-time API MUST remain exactly `1.13.1`.
   `manifest.json.minAppVersion` and the current `versions.json` mapping MUST
   remain `1.13.0`.
6. Biome MUST be added as the only lint/format dependency and MUST be pinned
   exactly to `@biomejs/biome@2.4.15`. Versions 2.5.5 and 2.5.4 are rejected
   for this project because their official Windows ARM64 binaries terminate
   before processing a file.
7. P8 MUST NOT add a production runtime dependency.

### Static quality gates

8. Package scripts MUST expose independently runnable format-check, lint,
   typecheck, test, production-build, release-contract and dependency-audit
   gates.
9. The normal repository `check` command MUST compose the offline gates after
   dependencies are installed: format, lint, typecheck/build, tests, metadata
   and bundle budget.
10. Biome MUST check maintained source, tests, scripts and root code/config
    inputs. It MUST exclude `.10x/`, installed dependencies, ignored build
    output, coverage, browser artifacts and release staging.
11. Biome's formatter configuration SHOULD match the established repository
    style to avoid unrelated churn. Import organization or broad automatic
    rewrites MUST NOT be introduced unless needed by the ratified lint/format
    gate.
12. CI MUST run Biome in non-writing mode. Any local baseline formatting MUST
    be behavior-preserving and limited to files governed by the Biome
    configuration.
13. TypeScript strictness in `tsconfig.json` MUST NOT be weakened.
14. Blanket lint suppressions MUST NOT be used to obtain a green gate. A
    narrow rule override or source suppression MUST name the concrete
    incompatibility in the ticket journal.

### Production and development bundles

15. A production build MUST bundle and minify `main.js`, MUST tree-shake, and
    MUST NOT emit or embed a sourcemap.
16. A development watch build MUST emit a separate external `main.js.map`; it
    MUST NOT embed the sourcemap in `main.js`.
17. `main.js`, `main.js.map` and release staging MUST remain ignored and
    untracked.
18. The production `main.js` MUST be at most 409,600 bytes uncompressed.
19. A size failure MUST report the observed byte count and the 409,600-byte
    limit. The budget MUST NOT be silently raised.

### Version and Community-submission readiness

20. The release contract MUST validate that:
    - `package.json.version` equals `manifest.json.version`;
    - the current version is strict `x.y.z` semantic-version syntax;
    - `versions.json` contains that exact version;
    - its value equals `manifest.json.minAppVersion`;
    - the minimum version remains `1.13.0`;
    - required `README.md`, `LICENSE`, `manifest.json` and `versions.json`
      inputs exist as regular files;
    - `main.js`, `manifest.json` and `styles.css` exist as regular files.
21. When a release tag is supplied, it MUST exactly equal the manifest version.
    A `v` prefix or any other tag syntax MUST fail.
22. Validation MUST report every detected contract mismatch and MUST NOT
    modify, infer or automatically bump a version.
23. Production `main.js` MUST NOT contain an inline or external
    `sourceMappingURL` directive in any supported comment form. Validation MUST
    reject the directive even when no separate `.map` path exists.
24. Community-directory readiness means the committed metadata and release
    assets satisfy the locally testable Obsidian contract. It MUST NOT be
    represented as approval by Obsidian or as an actual directory submission.

### Dependency review

25. A separate dependency-review command MUST inspect the committed lockfile
    using npm's audit data and MUST fail on `high` or `critical` findings.
26. CI and the tag release workflow MUST run the dependency-review command.
    Its network-backed, time-varying result MUST remain distinct from offline
    byte-for-byte build reproducibility.
27. A material audit finding MUST block release. P8 does not authorize
    dependency upgrades beyond the bounded lint/format addition without
    recording the finding and receiving repair authorization.

### Reproducibility and publication workflow

28. The release verification path MUST build production `main.js` twice from
    the same source revision, Node major, lockfile-backed install and build
    configuration.
29. It MUST remove only the known ignored `main.js` and `main.js.map` outputs
    between builds, calculate SHA-256 for both `main.js` results and fail if the
    digests differ. The verified final build remains the publication candidate.
30. Reproducibility failure output MUST contain both observed digests.
31. The tag workflow MUST validate the tag and every normal gate before
    creating a GitHub release.
32. The workflow MUST publish exactly `main.js`, `manifest.json` and
    `styles.css` as Obsidian release attachments. It MUST NOT publish source,
    tests, sourcemaps, dependency trees or `.10x` records.
33. The three exact publication candidates MUST be attested with
    `actions/attest@v4` after successful verification and before publication.
34. Immediately before publication, the workflow MUST query the remote tag,
    fail if it no longer exists, peel an annotated tag to its target commit,
    and require that commit to equal the workflow's original GitHub Actions
    commit SHA (`github.sha`). Checking only local checkout state or only
    using `--verify-tag` is insufficient.
35. The release MUST be created from the checked-out tagged source revision
    only. A failing install, audit, quality gate, metadata check, size check,
    reproducibility check or attestation MUST prevent release creation.
36. No workflow, script or documentation change in P8 MAY push a tag, create a
    release, configure a remote or submit to the Obsidian Community directory.

## Error behavior

- Dependency/lockfile disagreement MUST fail at `npm ci`; automation MUST NOT
  repair it with `npm install`.
- Format, lint, type, test and build failures MUST retain their owning command
  and MUST NOT be collapsed into a generic release error.
- Missing or malformed metadata, version disagreement, invalid tag, absent
  or non-regular release files, embedded/external sourcemap directives and
  oversize bundles MUST fail before attestation or publication.
- A high/critical audit result or unavailable required audit step MUST fail the
  relevant CI/release job.
- No failure path may publish a partial release or a sourcemap.

## Scenarios

### Scenario: deterministic dependency installation

Given `package.json` and the committed lockfile agree

When CI installs the project

Then `npm ci` installs the locked dependency tree without rewriting metadata.

### Scenario: release candidate meets the plugin contract

Given package, manifest and versions metadata all identify `0.1.0` with minimum
Obsidian `1.13.0`

When the release contract validates tag `0.1.0` after a production build

Then the tag and metadata pass, `main.js` is minified and no larger than
409,600 bytes, no sourcemap is present, and exactly the three Obsidian assets
are eligible for attestation and publication.

### Scenario: invalid prefixed tag is rejected

Given the manifest version is `0.1.0`

When release validation receives tag `v0.1.0`

Then validation fails before attestation or GitHub release creation and does
not change any version.

### Scenario: production output is reproducible

Given one source revision and one lockfile-backed installation

When the production bundle is generated twice with the same build contract

Then the two `main.js` SHA-256 digests are identical and the second verified
artifact is the only bundle eligible for release.

### Scenario: development debugging remains local

Given the development watch command runs

When esbuild emits debugging information

Then it writes a separate ignored `main.js.map`, while production and release
paths contain no sourcemap.

### Scenario: remote tag moved after checkout

Given the workflow originally checked out tag `0.1.0` at commit `A`

When the remote tag is absent or peels to commit `B` immediately before
publication

Then publication fails even though the earlier local build and attestation
gates passed.

## Acceptance criteria

- A committed lockfile and Node 24 declaration drive `npm ci` in CI/release.
- Exactly pinned Biome 2.4.15 provides non-writing format and lint gates without
  formatting `.10x` or generated/installed/release artifacts.
- Strict typechecking, the full test matrix and production build remain
  separately observable and pass through the composed check.
- Production is minified and sourcemap-free; development uses a separate
  ignored sourcemap.
- Automated tests falsify version/tag/metadata/asset/size validation through
  positive and negative cases, including non-regular release paths and inline
  or external `sourceMappingURL` directives.
- Production `main.js` is no larger than 409,600 bytes.
- Dependency audit blocks high/critical findings in CI/release.
- Two clean production outputs have the same SHA-256 digest.
- The tag workflow validates exact `x.y.z` equality, attests and publishes only
  `main.js`, `manifest.json` and `styles.css`, and cannot publish after a failed
  gate. Immediately before publication it also requires the remote tag to
  exist and peel to the original workflow commit SHA.
- No compiled artifact is tracked and no real external publication occurs.
- Fresh independent review returns `pass`, or non-critical residual risk is
  explicitly accepted before closure.

## Explicit exclusions

- Supporting Obsidian before 1.13.
- Publishing a tag or GitHub release, configuring a Git remote, or submitting
  to the Obsidian Community directory.
- Live Obsidian Desktop, Mobile, Bases, pop-out or assistive-technology proof.
- Installer signing, deployment environments, SBOM infrastructure or a
  general-purpose release platform.
- Shipping sourcemaps, source archives or compiled artifacts in Git.
- Unrelated dependency upgrades, refactors, feature changes or performance
  optimization.
