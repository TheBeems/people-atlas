Status: cancelled
Created: 2026-08-06
Updated: 2026-08-08
Superseded-By: `.10x/tickets/2026-08-08-release-channel-runtime-safety.md`
Depends-On: `.10x/specs/reproducible-obsidian-release.md` (active)
Governed-By: `.10x/specs/reproducible-obsidian-release.md` § Release channel (opt-in alpha prerelease)

# Encode the opt-in alpha release channel in the tag workflow

## User authorization

On 2026-08-06 the user asked to extend the release workflow to alpha releases
and to plan it via 10x (spec + issue bundeld) then implement. On ratification
the user chose an **explicit opt-in** channel, not "every release is alpha":
a release is an alpha prerelease only when declared so per version. The chosen
mechanism is a marker rule in the existing per-version release-notes file
(`.github/release-notes/<version>.md`). The change is a source edit to
`.github/workflows/release.yml` and `test/release-contract.test.ts`, plus the
spec amendment. Commit/push/release remain separate user authorization steps.

## Context / problem

Published releases 0.6.0..0.11.0 are `People Atlas X.Y.Z (Alpha)` pre
releases, but `.github/workflows/release.yml` creates every release with
`--title "People Atlas $TAG"` and no `--prerelease`. The `(Alpha)` title and
prerelease state today come from a manual `gh release edit` post-step repeated
in every release ticket (e.g. `2026-08-06-release-0.12.0-alpha.md`). The
workflow source and the actual published channel have drifted, and the manual
step is an error-prone corner the release-workflow guard test does not cover.
`gh release create` cannot carry an interactive alpha signal, and a SemVer
prerelease tag (`0.13.0-alpha`) is rejected by the release contract (tag and
`manifest.json.version` must be strict `x.y.z`). So the channel is declared by
an explicit per-version marker in the release-notes file.

## Scope

1. `.github/workflows/release.yml` (Publish step): read the per-version
   release-notes file, detect the `Channel: alpha` marker, and branch:
   - `alpha` → add `--prerelease` and title `People Atlas $TAG (Alpha)`;
   - otherwise → stable, title `People Atlas $TAG`, no `--prerelease`.
2. `test/release-contract.test.ts` (describe "release workflow tag guard"):
   assert the workflow reads the marker from the notes file and contains both
   channel branches (`--prerelease` + `(Alpha)` alpha, and their absence for
   stable), without weakening the existing `--verify-tag`, remote-SHA,
   versioned-notes-order assertions.
3. Run the focused release-contract test and a `release:contract` dry check to
   prove the change is green.

## Non-goals

- Making every release an alpha prerelease by default.
- Changing the version/tag to a SemVer prerelease suffix; the release contract
  keeps strict `x.y.z`.
- Rewriting, deleting or force-pushing any existing public tag or release, or
  editing historical release-notes files (existing notes have no `Channel:`
  marker and are treated stable if ever re-inspected; none will be republished).
- Any commit, push, tag creation or actual release publication.
- Any `README`/`CHANGELOG` wording change.

## Acceptance criteria

- [ ] `release.yml` reads `.github/release-notes/$TAG.md` and detects an exact
      `Channel: alpha` marker line.
- [ ] With the marker present, the workflow passes `--prerelease` and titles
      the release `People Atlas $TAG (Alpha)`.
- [ ] Without the marker, the workflow passes no `--prerelease` and titles the
      release `People Atlas $TAG`.
- [ ] The release-workflow guard test asserts both branches and keeps the
      existing `--verify-tag`, remote-SHA and versioned-notes assertions.
- [ ] `npx vitest run --project node test/release-contract.test.ts` is green.
- [ ] `npm run release:contract -- --tag 0.12.0` remains green (no unintended
      drift in the contract itself).

## Blockers

None confirmed. Channel is declared per version in the notes file; the strict
`x.y.z` contract and the anti-rewrite remote-tag guard stay intact.

## Journal

- 2026-08-06: Created after the user asked to extend the release workflow to
  alpha releases. Confirmed drift via `git tag` and `gh release list`
  (0.6.0..0.11.0 publish `(Alpha)` pre releases while the workflow omits
  `--prerelease`/`(Alpha)`). First plan assumed every release is alpha; the
  user ratified an **explicit opt-in** channel via a marker rule in the
  per-version release-notes file (`Channel: alpha`). Authored clauses 37-38 of
  `.10x/specs/reproducible-obsidian-release.md` (renamed section to
  "Release channel (opt-in alpha prerelease)").
- 2026-08-06 (implementation): rewrote the Publish step of
  `.github/workflows/release.yml` to read `Channel: alpha` from
  `.github/release-notes/$TAG.md` and branch (alpha → `--prerelease` + title
  `People Atlas $TAG (Alpha)`; otherwise stable). Added the guard test
  "declares the alpha channel opt-in and branches on the release-notes
  marker" to `test/release-contract.test.ts`. Made spec clauses 37-38 match the
  opt-in design (earlier draft said "every release"). Verified with Node 24:
  `vitest run --project node test/release-contract.test.ts` → 20 passed;
  functional mock-`gh` run of the publish block proves the alpha / stable /
  no-notes / `Channel: alpha-extra`-no-trigger / 2nd-line-marker branches;
  `bash -n` on the block is clean; `npm run release:contract -- --tag 0.12.0`
  → green (main.js 418789/500000).

## References

- `.10x/specs/reproducible-obsidian-release.md` (governing spec, clauses 37-38
  and acceptance criteria)
- `.github/workflows/release.yml` (tag workflow, Publish step)
- `test/release-contract.test.ts` (describe "release workflow tag guard")
- `.10x/tickets/2026-08-06-release-0.12.0-alpha.md` (shows the manual
  `gh release edit` post-step this automates)
- `scripts/release-contract.mjs` (strict `x.y.z` tag/version contract)

## Supersession addendum (2026-08-08)

De alpha-implementatie is historische input voor het gecombineerde
release-channel-runtime-safety-ticket. Dat ticket is nu de enige actieve owner
voor alpha/beta/rc/stable, duplicate-marker-fail-closed gedrag en actuele review
evidence. Historische uitvoering en oorspronkelijke claims zijn niet herschreven.