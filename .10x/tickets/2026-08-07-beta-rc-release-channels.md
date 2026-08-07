Status: draft
Created: 2026-08-07
Updated: 2026-08-07
Depends-On: `.10x/specs/reproducible-obsidian-release.md` (active)
Governed-By: `.10x/specs/reproducible-obsidian-release.md` § Release channel (opt-in alpha prerelease) — to be extended

# Extend release workflow to beta and release-candidate channels

## User authorization

On 2026-08-07 the user asked to extend the release workflow to beta and release-candidate channels, following the same opt-in marker pattern as alpha.

## Context / problem

Current workflow only supports `Channel: alpha` marker for prerelease. Users want `Channel: beta` and `Channel: rc` (release-candidate) markers with corresponding GitHub prerelease titles:
- Beta → `--prerelease` + title `People Atlas <version> (Beta)`
- RC → `--prerelease` + title `People Atlas <version> (Release Candidate)`

The release tag remains strict `x.y.z` (no SemVer prerelease suffix).

## Scope

1. **Spec amendment** (`.10x/specs/reproducible-obsidian-release.md` clauses 37-38): extend the "Release channel (opt-in alpha prerelease)" section to include beta and RC channels. Rename section to "Release channel (opt-in prerelease channels)".

2. **Workflow update** (`.github/workflows/release.yml` Publish step): read `Channel:` marker, support three values: `alpha`, `beta`, `rc` (case-sensitive exact match). Branch accordingly:
   - `alpha` → `--prerelease` + `People Atlas ${TAG} (Alpha)`
   - `beta` → `--prerelease` + `People Atlas ${TAG} (Beta)`
   - `rc` → `--prerelease` + `People Atlas ${TAG} (Release Candidate)`
   - absent/other → stable, no `--prerelease`, `People Atlas ${TAG}`

3. **Guard test update** (`test/release-contract.test.ts`): extend "declares the alpha channel opt-in and branches on the release-notes marker" test to assert all three prerelease branches and the stable branch.

4. **Verification**: run focused release-contract test and `release:contract` dry check.

## Non-goals

- Making every release a prerelease by default.
- Changing the version/tag to a SemVer prerelease suffix; release contract keeps strict `x.y.z`.
- Rewriting, deleting or force-pushing any existing public tag or release.
- Any commit, push, tag creation or actual release publication.
- Any `README`/`CHANGELOG` wording change.
- Supporting arbitrary channel strings — only `alpha`, `beta`, `rc` are recognized.

## Acceptance criteria

- [x] Spec clauses 37-38 amended to declare three opt-in prerelease channels (alpha, beta, rc) with exact marker lines and corresponding titles.
- [x] `release.yml` reads `Channel:` marker from `.github/release-notes/${TAG}.md` and branches on exact values `alpha`, `beta`, `rc`.
- [x] Each prerelease channel passes `--prerelease` and correct title branding.
- [x] Stable channel (no marker or other value) passes no `--prerelease` and title `People Atlas ${TAG}`.
- [x] Guard test asserts all four branches (alpha, beta, rc, stable) and keeps existing `--verify-tag`, remote-SHA, versioned-notes assertions.
- [x] `npx vitest run --project node test/release-contract.test.ts` is green.
- [x] `npm run release:contract -- --tag 0.12.0` remains green.

## Blockers

None confirmed. Extension follows existing pattern; strict `x.y.z` contract and anti-rewrite remote-tag guard stay intact.

## Journal

- 2026-08-07: Created after user asked to extend release workflow to beta and RC channels. Ratified title branding: `People Atlas <version> (Beta)` and `People Atlas <version> (Release Candidate)`.
- 2026-08-07 (implementation): Amended spec clauses 37-38 to "Release channel (opt-in prerelease channels)" with three channels. Updated `.github/workflows/release.yml` Publish step with case-based marker detection and title branching for alpha/beta/rc. Updated guard test in `test/release-contract.test.ts` to assert all four branches. Verified with Node 24: `vitest run --project node test/release-contract.test.ts` → 20 passed; `npm run check` → full gate green (format, lint, typecheck, 1136 tests, build, release-contract, community-check); `npm run release:contract -- --tag 0.12.0` → green (main.js 418789/500000).

- `.10x/specs/reproducible-obsidian-release.md` (governing spec, clauses 37-38)
- `.github/workflows/release.yml` (tag workflow, Publish step)
- `test/release-contract.test.ts` (describe "release workflow tag guard")
- `.10x/tickets/2026-08-06-alpha-release-channel-workflow.md` (alpha channel implementation)