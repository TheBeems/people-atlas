# Community Plugins submission

People Atlas is prepared for Community Plugins review, but the first submission is intentionally held until Obsidian 1.13 is publicly available. `manifest.json.minAppVersion` must remain `1.13.0` because the plugin uses APIs introduced in that version.

## Readiness gate

Run these commands from a clean checkout:

```bash
npm ci
npm run dependency:audit
npm run check
npm run verify:reproducible
```

`npm run community:check` is included in `npm run check`. It validates the public metadata and disclosures, version-specific release notes, mobile-safe source boundaries, and that `main.js` is not tracked by Git.

## Publication hold

Do not submit People Atlas to the Community Plugins directory until the official Obsidian changelog marks a 1.13 release as public rather than Catalyst early access.

This hold applies only to the directory submission. It does not change the technical minimum version and must not be worked around by lowering `minAppVersion`.

## Steps after Obsidian 1.13 becomes public

1. Verify the public 1.13 release in the official Obsidian changelog.
2. Re-run the readiness gate above from a clean checkout.
3. Commit and push the reviewed `0.1.1` candidate to `main`.
4. Confirm that the `main` CI run succeeds.
5. Create and push the exact unprefixed tag `0.1.1`.
6. Confirm that the release workflow succeeds and publishes only `main.js`, `manifest.json`, and `styles.css`.
7. Verify that the remote tag and `main` resolve to the reviewed commit and that the published manifest requires Obsidian 1.13.0.
8. Sign in at [community.obsidian.md](https://community.obsidian.md), link the GitHub account that owns the repository, create a new plugin submission for `https://github.com/TheBeems/people-atlas`, accept the developer policies, and submit.
9. Address any automated review feedback with a new patch version and release; never replace the artifacts of an existing release.

The authenticated account linking, policy acceptance, and final **Submit** action remain manual owner actions.

## Evidence boundary

The automated checks establish source, browser, release, and policy-contract readiness. They do not claim live Android, iOS, assistive-technology, Electron pop-out, or production-directory validation unless those environments are tested separately.
