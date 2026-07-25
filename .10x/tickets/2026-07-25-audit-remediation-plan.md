Status: done
Created: 2026-07-25
Updated: 2026-07-25

# Post-P4 audit remediation plan

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`

## Scope

Repair the three source-confirmed correctness risks found after P4 before
advancing the renderer roadmap:

1. incremental graph output must remain equivalent to a full rebuild;
2. concurrent supported mutations must not introduce duplicate explicit IDs;
3. layout/view-state persistence must preserve interaction order without a
   save on every wheel event.

After these repairs, shape the user-facing relationship mutation entrypoints
separately. The existing mutation service is a foundation, not yet a complete
user workflow.

This is a parent plan and is not executable.

## Non-goals

- Changing person or relationship identity semantics.
- Inferring relationship status from `last_contact`.
- Replacing incremental updates with full vault or graph rebuilds.
- Implementing P5 accessibility/mobile work, P6 performance work or P8 release
  hardening inside a regression repair.
- Inventing relationship-editor UX before its interaction and confirmation
  semantics are ratified.

## Child sequence

1. `.10x/tickets/2026-07-25-incremental-graph-equivalence.md`
2. `.10x/tickets/2026-07-25-mutation-identity-serialization.md`
3. `.10x/tickets/2026-07-25-view-state-write-coordination.md`
4. `.10x/tickets/2026-07-25-relationship-editor-ui.md`

The first three repairs are semantically independent but will be executed
sequentially to keep review and evidence attributable to one ticket at a time.

## Acceptance Criteria

- [x] Each confirmed regression has one bounded child owner and a failing
      regression test before its repair.
- [x] Every child preserves the active P1-P4 contracts and passes its focused
      review before the next child starts.
- [x] Relationship-mutation UI work begins only after its user-visible
      interaction, confirmation and placement semantics are ratified.
- [x] The parent People Atlas plan is updated only when all remediation
      children are closed or explicitly deferred.

## References

- `.10x/evidence/2026-07-25-audit-regressions.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/tickets/2026-07-24-incremental-index-diagnostics.md`
- `.10x/tickets/2026-07-25-safe-mutations-and-versioned-data.md`
- `.10x/tickets/2026-07-25-projection-modes-layout-state.md`

## Assumptions

- User-ratified: execute the evidence-backed remediation advice from the
  repository audit.
- Record-backed: stable identity, exact hidden counts, validation-before-write
  and per-view persistence semantics remain unchanged.
- Blocked for the later UI leg: relationship editor surface, confirmation flow
  and create/edit entrypoints are not yet ratified.

## Journal

- 2026-07-25: Created from the post-P4 repository audit after the user
  authorized executing its recommendations.
- 2026-07-25: Incremental graph equivalence child closed with focused
  before/after regressions, 48 passing tests, a passing production build and a
  pass review. Mutation identity serialization is the next child.
- 2026-07-25: Mutation identity serialization child closed with one
  service-wide coordination boundary, path-owned stale-index reservations,
  normalized collision checks, 51 passing tests, a passing production build
  and a pass review. View-state write coordination is the next child.
- 2026-07-25: View-state write coordination child closed with coalesced
  same-key state, one serialized plugin-data chain, explicit teardown flushes,
  56 passing tests, a passing production build and a pass review. All three
  correctness regressions are repaired; the next leg is the separate
  relationship-mutation UI shaping checkpoint.
- 2026-07-25: The user ratified the relationship-editor surface, entrypoints,
  storage path, confirmation and completion behavior. The active governing
  spec is `.10x/specs/relationship-editor-ui.md`; implementation is owned by
  the executable open ticket
  `.10x/tickets/2026-07-25-relationship-editor-ui.md`. This parent shaping and
  remediation plan is complete.

## Blockers

None. Relationship-editor implementation is separately owned by
`.10x/tickets/2026-07-25-relationship-editor-ui.md`.

## Evidence

See `.10x/evidence/2026-07-25-audit-regressions.md` for the three repaired
regressions and `.10x/specs/relationship-editor-ui.md` for the ratified
follow-up contract.

## Review

The three regression children passed their focused reviews and repository
quality gates. Relationship-editor shaping is complete and contains no
unresolved execution semantics. Its implementation remains intentionally
unstarted pending separate authorization.

## Retrospective

Separating the relationship UI from the mutation foundation prevented safe
write APIs from being mistaken for a complete user workflow. The decisive
shaping gap was the storage path: once that and the entrypoint/completion
semantics were explicit, one bounded executable ticket could own the UI
without expanding into P5 renderer interaction work.
