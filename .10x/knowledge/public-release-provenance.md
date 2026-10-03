Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Public release records and exact artifact provenance

The active behavioral authority is specs/reproducible-obsidian-release.md.
Publication needs explicit user authorization. A release-preparation ticket owns
its version, channel, exact source SHA, checks, independent review and final
remote artifact observation; a green local build is not a published outcome.

## Public staging

Inspect an explicit staging inventory, rather than adding the entire worktree.
Reviewed source, tests, examples and public-safe durable records can be included.
Actual vault/install history, personal filesystem paths, settings metadata,
credentials, raw runtime logs and installation backups remain local. Synthetic
images must be inspected before treating them as public evidence.

Sanitize a personal path in a public record without changing its observed
technical result. Excluding private evidence does not permit inventing a public
proof; public tickets name their verification limits and reproducible procedure.

## Verification boundary

Git tracks normalized source bytes. A Windows checkout's CRLF format failure is
not automatically a failure of the committed LF tree or the Linux release gate.
Preserve the observed local baseline, inspect the actual difference, and require
the complete existing Linux CI gate on the exact release commit before tagging.
Do not weaken the format gate or broadly rewrite behavior to satisfy a checkout
artifact. During 0.13.0 preparation, Linux CI passed all 235 configured files
without requiring any baseline source correction.

Check newly staged files too: tracked-only git diff --check does not cover
untracked records. A successful zero-output check may produce no Tee-Object log
file. Record the actual exit result in an honest receipt instead of citing a
nonexistent log or repeating the check merely to manufacture one.

## Publication lineage

Recheck new tag absence and remote main against the CI-verified source. Use one
new annotated strict-semver tag on that source; never overwrite an existing tag.
The existing workflow validates, reproduces and attests exactly main.js,
manifest.json and styles.css, and fences the remote peeled tag against its
original workflow SHA immediately before publishing.

After success, inspect the actual public release: non-draft state, intended
channel/title, exact assets, manifest version/minimum, downloaded SHA-256 values
matching the reproducible candidate and valid GitHub attestations. Close the
ticket in a later documentation commit without moving the release tag. A docs
HEAD may be newer than the published source; retain their separate identities.

## Dependency findings

An audit's exit threshold and remaining findings are separate observations.
Preserve moderate counts honestly when the existing high/critical gate passes;
record a future owner instead of silently upgrading or forcing a pinned SDK
downgrade. The observed 0.13.0 advisories and no-action disposition are owned by
tickets/2026-10-03-dev-dependency-advisories.md. This does not establish that every
development or host exposure is safe.

## References

- specs/reproducible-obsidian-release.md
- tickets/2026-10-03-release-0.13.0-alpha.md
- tickets/2026-10-03-integration-validation.md
- tickets/2026-10-03-dev-dependency-advisories.md
