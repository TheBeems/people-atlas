Status: done
Created: 2026-07-25
Updated: 2026-07-25

# Repair incremental graph equivalence

Parent: `.10x/tickets/2026-07-25-audit-remediation-plan.md`
Depends-On: `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`

## Scope

Make `applyGraphDelta()` produce the same semantic graph as a full
`buildAtlasSnapshot()` for:

- multiple filtered contacts originating from one person note;
- transitions into and out of duplicate `person_id` state that remap node IDs;
- stable inferred contact-edge identity after node-ID remapping.

Keep delta application incremental and reuse the smallest justified shared
helpers where that prevents builder/delta semantic drift.

## Non-goals

- Full vault or graph rebuilds after every change.
- Projection, layout, mutation or persistence behavior changes.
- Broad graph refactoring without a regression-driven boundary.
- Property-based or performance-test expansion beyond the focused differential
  scenarios.

## Acceptance Criteria

- [x] A failing differential regression proves each current mismatch before
      the implementation is changed.
- [x] Each filtered contact increments `hiddenEdgeCount` exactly once even
      when multiple contacts share one source note and diagnostic category.
- [x] Inferred contact-edge IDs are recomputed consistently whenever endpoint
      node IDs are remapped by duplicate-identity transitions.
- [x] Incremental and full-build nodes, edges, diagnostics and hidden counts
      match for the repaired scenarios after stable ordering.
- [x] Duplicate identities remain ambiguous and no first-match resolution is
      introduced.
- [x] Existing graph, index, P4 projection and layout-state tests continue to
      pass.
- [x] `npm run test` and `npm run build` pass.

## References

- `.10x/evidence/2026-07-25-audit-regressions.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `test/graph-delta.test.ts`

## Assumptions

- User-ratified: execute the audit recommendation.
- Record-backed: a delta must be semantically equivalent to a full rebuild for
  the same lifecycle state.
- Record-backed: duplicate person IDs remain separate ambiguous nodes and must
  not be guessed or merged.
- Mechanical: stable ordering in tests is comparison-only and does not impose
  a new renderer ordering contract.

## Journal

- 2026-07-25: Opened from reproduced audit failures: hidden-edge count was
  `1` versus rebuild `2`, and inferred edge IDs differed after duplicate-ID
  node remapping.
- 2026-07-25: Execution started after the shaping checkpoint. Scope remains
  limited to differential regressions and the smallest shared graph helpers
  needed to keep builder and delta identity/count semantics aligned.
- 2026-07-25: Added two focused differential tests and ran
  `npx vitest run test/graph-delta.test.ts`. Baseline result: 1 passed and 2
  failed. The failures reproduce hidden-edge count `1` versus `2`, a collapsed
  filtered-contact diagnostic, duplicate diagnostic ID drift and inferred edge
  ID `edge:zhgpjs` versus rebuild `edge:136jjgz`.
- 2026-07-25: Added shared pure helpers for inferred contact-edge identity and
  filtered-endpoint diagnostics. Full builds now use the same duplicate
  diagnostic IDs as lifecycle deltas, filtered contacts receive per-reference
  diagnostic identities, and retained inferred edges recompute their IDs after
  endpoint remapping. The focused suite now passes: 3 tests.
- 2026-07-25: Full verification passed with 14 test files and 48 tests,
  TypeScript no-emit checking and the production esbuild. `git diff --check`
  reported no whitespace errors, only the repository's existing LF/CRLF
  normalization warnings.

## Blockers

None known.

## Evidence

Baseline evidence is recorded in
`.10x/evidence/2026-07-25-audit-regressions.md`.

- `npx vitest run test/graph-delta.test.ts` after the repair: 1 file and 3
  tests passed.
- `npm run test`: 14 test files and 48 tests passed.
- `npm run build`: `tsc --noEmit` and production esbuild passed.
- `git diff --check`: passed with line-ending normalization warnings only.

## Review

Verdict: pass.

Fresh review checked that both graph paths use the same inferred contact-edge
identity, duplicate diagnostic IDs agree with `PersonIndex`, rich relationship
edge IDs remain untouched, filtered contacts are independently countable and
the delta path still performs no vault scan or full graph rebuild. No critical,
significant or minor finding remains within the ticket scope.

Residual risk: differential coverage is still scenario-based rather than
property-based, and live Bases refresh behavior remains outside the Node
harness. The parent P7 test-matrix scope already owns broader graph invariant
and integration coverage.

## Retrospective

The regressions came from duplicating derived identity and diagnostic
construction across the full and incremental graph paths. A broad graph
abstraction was unnecessary: sharing the two drift-prone primitives repaired
the observed failures while keeping both algorithms easy to follow. The
duplicate-ID transition test was especially valuable because comparing only
edge endpoints would have missed stale edge identity.
