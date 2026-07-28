Status: done
Created: 2026-07-27
Updated: 2026-07-27

# P8 release-hardening gap analysis

## Question

What is the smallest P8 scope that makes People Atlas reproducibly releasable
without turning a solo Obsidian plugin into an enterprise release system?

## Sources and methods

Read-only inspection of:

- the P8 scope and gate in
  `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`;
- `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore`,
  `manifest.json`, `versions.json`, `README.md`, `LICENSE` and `ROADMAP.md`;
- `.github/workflows/ci.yml` and `.github/workflows/release.yml`;
- the installed direct dependency tree and the current ignored `main.js`;
- current official Obsidian plugin-release, load-time, npm `ci`, Biome and
  GitHub artifact-attestation documentation.

No dependency install, test, build, workflow run, GitHub release or Community
directory submission was performed. The ignored local `main.js` was only read
to estimate the effect of minification.

## Current state

- Obsidian support is already coherently declared as `1.13.0` in
  `manifest.json` and `versions.json`, while the compile-time Obsidian API is
  exactly `1.13.1`. This matches the user's decision to support only Obsidian
  1.13+.
- TypeScript is already strict, and `npm run build` performs `tsc --noEmit`
  before bundling.
- Compiled `main.js`, sourcemaps and `release/` are already ignored.
- CI and release automation use `npm install`; no lockfile exists. The release
  workflow asks setup-node for an npm cache even though there is no lockfile.
- The production esbuild path disables sourcemaps but does not enable
  minification. Development uses an inline sourcemap rather than a separate
  debug `.map` file.
- The ignored local `main.js` is 199,108 bytes. A read-only esbuild transform
  estimated 126,578 bytes after minification, a 36.4% reduction. This is an
  estimate, not a fresh production-build baseline.
- There is no lint/format gate, bundle-size check, dependency audit or automated
  validation that `package.json`, `manifest.json`, `versions.json` and the
  pushed release tag agree.
- The current release workflow triggers on every tag and publishes before
  validating tag/version coherence.
- The current provenance action is `actions/attest-build-provenance@v2`.
  GitHub now directs new implementations to `actions/attest@v4`.
- `README.md`, `LICENSE`, `manifest.json` and `versions.json` are present.
  No Git remote or existing tag is configured in this checkout.

## Official release boundary

- Obsidian requires an `x.y.z` release tag that exactly matches
  `manifest.json.version`; a `v` prefix would not match.
- Obsidian installs `main.js`, `manifest.json` and optional `styles.css` from
  that GitHub release.
- The Community directory reads the committed manifest from the default branch.
  Actual directory submission is a separate user-owned publication action, not
  part of local P8 implementation.
- Obsidian recommends a production build and explicitly suggests minification.
- `npm ci` requires a lockfile, fails when it disagrees with `package.json`,
  removes the existing install and does not rewrite package metadata.

## Recommended bounded P8 contract

One implementation ticket is sufficient:

1. Commit `package-lock.json`, declare Node 22 as the build runtime and use
   `npm ci` in CI/release.
2. Add one pinned Biome development dependency for formatting and linting.
   Keep TypeScript itself as the type-safety authority.
3. Give format/lint/typecheck/test/build/version/bundle checks distinct scripts,
   then compose them into the normal CI gate.
4. Minify only production `main.js`; emit a separate external sourcemap only
   for development and never publish it.
5. Validate exact equality across package version, manifest version, the
   `versions.json` entry and an `x.y.z` release tag. Preserve minimum Obsidian
   `1.13.0`.
6. Enforce a 200 KiB uncompressed `main.js` ceiling. The estimated minified
   artifact is about 124 KiB, leaving about 60% headroom. Changing the ceiling
   later remains an explicit reviewable change.
7. Review the locked dependency tree and fail the gate on high/critical npm
   audit findings.
8. Build once from the tagged revision, stage only the three Obsidian release
   files, attest those exact files with `actions/attest@v4`, and publish only
   those files after all gates pass.
9. Verify reproducibility locally by producing two clean production builds from
   the same locked inputs and comparing their SHA-256 digests.

## Explicit non-goals

- Publishing a real release, pushing a tag or submitting to the Obsidian
  Community directory.
- Supporting Obsidian before 1.13.
- Signing installers, maintaining deployment environments, SBOM infrastructure
  or a general release platform.
- Shipping sourcemaps or committing compiled artifacts.
- Treating automation as proof of live Obsidian Desktop, Mobile or assistive
  technology behavior.

## Ratification needed

- Accept Biome as the single lint/format tool.
- Accept the 200 KiB uncompressed production `main.js` budget.
- Accept Community-directory submission readiness as validation/documentation
  only; actual submission stays outside P8.

## Sources

- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://github.com/obsidianmd/obsidian-releases
- https://docs.obsidian.md/plugins/guides/load-time
- https://docs.npmjs.com/cli/v11/commands/npm-ci/
- https://biomejs.dev/guides/getting-started/
- https://github.com/actions/attest
