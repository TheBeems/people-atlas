Status: recorded
Created: 2026-07-25
Updated: 2026-07-25

# Audit regressions after P4

## Observation

Three focused audit scenarios fail against the current working tree while the
existing 46-test suite passes:

1. An incremental Bases graph update reports one hidden edge for two filtered
   contacts from the same person note, while a full rebuild reports two.
2. Introducing a duplicate `person_id` remaps existing person-node IDs during
   delta application but leaves an inferred contact-edge ID derived from the
   old node ID; a full rebuild produces a different edge ID.
3. Two concurrent person creations with the same generated explicit ID and
   different note paths both succeed when the index has not observed either
   write yet.

The audit also found that view-state writes are fired on every wheel event and
are not serialized, so completion order and rollback order can diverge from
interaction order. This is source-supported risk rather than a reproduced
failure in the current Node test harness.

## Procedure

- Ran the existing suite: `npm run test` reported 14 files and 46 passing
  tests.
- Ran a temporary differential Vitest file outside the repository against the
  current working tree.
- Compared `applyGraphDelta()` output with `buildAtlasSnapshot()` for the same
  visible and canonical records.
- Invoked two `AtlasMutationService.createPerson()` operations through
  `Promise.all()` using one generated ID and distinct names.
- Inspected `PeopleAtlasPlugin.saveViewState()` and the renderer wheel callback
  for persistence ordering.

## What this supports or challenges

- Challenges the P2 acceptance claim that incremental delta application is
  equivalent to a full rebuild for equivalent lifecycle changes.
- Challenges exact filtered-edge accounting and stable inferred edge identity.
- Challenges the P3 guarantee that a supported mutation cannot introduce an
  ambiguous explicit identity.
- Challenges P4 persistence reliability under rapid or overlapping layout
  interactions.

## Limits

- The differential and concurrency scenarios use focused fakes rather than a
  live Obsidian vault.
- They establish deterministic pure/service failures but do not measure live
  metadata-cache timing or filesystem locking.
- The view-state risk still needs a focused asynchronous persistence harness.
