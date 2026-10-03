Status: open
Created: 2026-10-03
Updated: 2026-10-03

# Review moderate advisories in development dependencies

## Scope

Preserve the actual dependency-audit findings observed while preparing 0.13.0
Alpha. A future authorized dependency review should assess applicable exposure
and supported fixes without weakening the pinned Obsidian API or release gates.
This is a backlog owner, not authorization to change dependencies in this release.

## Non-goals

No automatic npm audit fix, forced SDK downgrade, dependency/lockfile upgrade,
production exploit claim or unrelated security audit in the 0.13.0 publication.

## Acceptance criteria

- Recheck current advisory/version status and the concrete applicable development
  or host exposure before choosing a repair.
- Preserve the exact Obsidian 1.13.1 compile-time API and 1.13.0 host minimum,
  unless a separately authorized contract change establishes their successor.
- Any accepted repair must preserve browser/host tests, reproducibility and the
  existing high/critical dependency-audit gate; record any remaining exposure.

## References

- .10x/specs/reproducible-obsidian-release.md, clauses 25-27
- .10x/tickets/2026-10-03-release-0.13.0-alpha.md
- package.json, package-lock.json and esbuild.config.mjs
- https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- https://github.com/advisories/GHSA-4p3w-j4w9-5jqw

## Assumptions and disposition

Record-backed: the release audit blocks high/critical findings. The observed
command exited 0 with six moderate package findings and no high/critical finding.
They span two advisories, not six independent vulnerabilities. Dependency graph
and versions remain unchanged in 0.13.0. This is a documented non-blocking
residual under the current gate, not a claim that the packages are vulnerability-
free or that development/host exposure has been exhaustively assessed.

## Journal

- 2026-10-03: Release executor ran npm run dependency:audit, using
  npm audit --audit-level=high. Root inspected the retained ignored local report
  release/0.13.0/dependency-audit.log without rerunning the command.
- 2026-10-03: Report identifies the @vitest/mocker redirect-mock path traversal
  advisory through @vitest/browser, @vitest/browser-playwright and vitest; these
  four development packages are reported moderate at the locked 4.1.10 line.
- 2026-10-03: Report identifies the moment locale-name path traversal advisory
  through the pinned obsidian compile-time package; these two packages are
  reported moderate, with moment locked at 2.30.1. The suggested forced repair
  would downgrade obsidian to 0.14.5 and is not an acceptable automatic action.
- 2026-10-03: Root inspected the production bundler's external obsidian boundary
  and found no direct moment/vitest source imports. This establishes the inspected
  packaging boundary only; it does not prove the host's supplied library state or
  every development exposure. Retained as future review rather than expanding
  the explicitly authorized publication into dependency implementation.

## Blockers

No blocker to the current release under its existing severity threshold. Future
repair choices need current verification and an authorized dependency scope.

## Evidence

Inspected executor audit output: exit 0; six moderate package findings across the
two named advisories; zero high/critical findings. Local report remains outside
public staging; the release ticket records the same observation and threshold.
Root version metadata changes preserve the inspected dependency graph.

## Review

Recorded no-action disposition for the current release. Full advisory triage and
dependency repair are future work; no fixed or zero-vulnerability claim is made.

## Retrospective

Separate an audit's exit threshold from its remaining advisory counts. A forced
fix suggestion is untrusted repair advice and can violate the pinned host API;
record the actual dependency chain and evaluate a supported repair separately.
