Status: active
Created: 2026-08-09
Updated: 2026-08-09
Owner: People Atlas architecture-refactor workstream — parent coordination

# Architecture decomposition — renderer, mutations and entrypoints

## Record type and intent

This is a parent/meta ticket, not an executable implementation ticket. It
coordinates three bounded, dependency-ready child tickets for a behavior-
preserving internal refactor. It does not authorize source changes, test
changes, dependency changes, commits or pushes.

The user ratified on 2026-08-09:

- use one parent ticket with three child tickets;
- split the renderer, mutation service and main/editor entrypoint clusters as
  separate outcomes;
- preserve product behavior, public entrypoints/API contracts and existing
  test contracts.

The refactor is governed by the existing active product specs. No new product
behavior, storage contract or architecture decision is introduced by this
record.

## Scope

Coordinate the following child tickets:

1. `.10x/tickets/2026-08-09-renderer-decomposition.md`
   decomposes `AtlasRenderer` into independently testable canvas,
   interaction, semantic-list, details and follow-up responsibilities while
   retaining the public renderer façade.
2. `.10x/tickets/2026-08-09-mutation-service-decomposition.md`
   decomposes the mutation service into domain coordinators plus one shared
   mutation queue/transaction guard, canonical resolution and identity
   reservation boundaries while retaining the public service façade.
3. `.10x/tickets/2026-08-09-entrypoint-editor-decomposition.md`
   decomposes `main.ts` and the large person, relationship and contact-moment
   modals into typed entrypoint/form/presentation boundaries without changing
   their public constructors or write safety.

The intended delivery order is:

- renderer and mutation-service children are independently executable and
  should still be implemented one dependency-ready ticket at a time;
- the main/editor child follows the mutation-service child because its
  entrypoints consume the mutation façade;
- final integration verification covers all three child outcomes together.

A child may use equivalent filenames or class names when the existing source
shows a safer seam. Responsibility boundaries, behavior preservation and the
public façade contracts are mandatory; names are mechanical defaults.

## Non-goals

- No new feature such as clustering, import/export, extended timelines,
  force-directed layout, background notifications or external synchronization.
- No change to `AtlasSnapshot`, stable identity, relationship/contact-moment
  storage, settings schema, frontmatter semantics or migration policy.
- No UX redesign, copy change, accessibility-contract relaxation or change to
  partner/parent terminology.
- No new rendering, mutation or modal framework solely to support the split.
- No dependency, lockfile, release, commit, push, tag or external write.
- No weakening, deletion or replacement of existing protective tests merely to
  make extracted modules pass.

## Acceptance Criteria

- [ ] All three child tickets remain linked to this parent and each has a
      bounded Scope, Non-goals, Acceptance Criteria, References, Assumptions,
      Journal, Blockers, Evidence, Review and Retrospective section.
- [ ] The children produce no intentional product-behavior, persisted-data,
      public-entrypoint or public-API change. Any discovered contract drift is
      recorded as a blocker or separately owned ticket.
- [ ] `AtlasRenderer` remains the stable orchestration façade used by the
      standalone and Bases adapters; `AtlasMutationService` remains the stable
      mutation façade used by entrypoints, editors and tests.
- [ ] Each responsibility boundary is independently testable without moving
      vault access into rendering or allowing writes outside the mutation
      boundary.
- [ ] Shared lifecycle, identity, baseline, retry, partial-success, focus,
      owning-window and cleanup invariants remain owned by one explicit seam,
      not duplicated across children.
- [ ] Each child receives an independent read-only review after its final code
      changes, and the parent is not closed from a historical journal claim.
- [ ] After all children are green and reviewed, the complete required local
      verification is rerun and recorded: `npm run test`, `npm run build` and
      `git diff --check`.
- [ ] Every follow-up or residual risk has a durable owner before this parent
      can be marked done.

## References

- `AGENTS.md`
- `ARCHITECTURE.md`
- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
- `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/performance-characterization.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `src/render/atlas-renderer.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/main.ts`
- `src/editor/person-modal.ts`
- `src/editor/relationship-modal.ts`
- `src/editor/contact-moment-modal.ts`

## Assumptions

- User-ratified: this is one parent ticket with three separate child outcomes.
- User-ratified: behavior, public entrypoints/API contracts and existing test
  contracts remain unchanged.
- Record-backed: the active renderer, mutation, contact-moment, projection,
  identity, editor and performance specs already define the behavior that the
  refactor must preserve.
- Mechanical: internal module names may follow the proposed names or an
  equivalent repository-consistent naming scheme; the responsibility matrix
  and stable façade contracts are the acceptance boundary.

## Journal

- 2026-08-09: Source inventory confirmed the concentration in the current
  worktree: `src/render/atlas-renderer.ts` is 86,492 bytes,
  `src/mutations/atlas-mutation-service.ts` is 81,261 bytes,
  `src/main.ts` is 34,734 bytes, `src/editor/person-modal.ts` is 41,788
  bytes, `src/editor/relationship-modal.ts` is 39,578 bytes and
  `src/editor/contact-moment-modal.ts` is 22,312 bytes.
- 2026-08-09: Source inspection confirmed that the renderer currently combines
  canvas drawing, pointer/touch/keyboard interaction, semantic people and
  relationship surfaces, contact/follow-up surfaces, photo admission and
  lifecycle cleanup; the mutation service combines person, relationship,
  contact-moment, retry, canonical-resolution, baseline, reservation,
  frontmatter and preset-sync responsibilities.
- 2026-08-09: The user ratified the parent-plus-three-child scope with strict
  behavior and public-contract preservation. Four open records were created;
  no implementation was started or authorized in this record-authoring turn.
- 2026-08-09 addendum: The user subsequently authorized implementation in the
  active workstream. That authorization supersedes the planning-only sentence
  above for this worktree; it does not change the recorded product scope.
- 2026-08-09: Renderer and mutation seams were implemented with focused
  boundary tests. The editor slice added canonical resolution,
  `RelationshipPersonPicker` and `PersonPhotoPicker`; full `main.ts` and
  contact-moment-modal decomposition remain a bounded follow-up.

## Blockers

None known at parent planning level. Implementation authorization is separate
from opening these records. A child must stop and record a blocker if the
current source or active spec makes behavior/API preservation impossible
without a separately ratified contract change.

## Evidence

- Historical source-inventory baseline: the source sizes recorded in the Journal
  were measured with `stat` on 2026-08-09 before the implementation slice.
- Historical pre-record baseline: the worktree was `main...origin/main` with no
  staged, unstaged or untracked changes before these four record files were
  created.
- Existing relevant browser, mutation, entrypoint, integration and modal test
  boundaries include `test/browser/atlas-renderer.browser.test.ts`,
  `test/browser-matrix/atlas-renderer.browser-matrix.test.ts`,
  `test/mutation-service.test.ts`, `test/contact-moment-mutation.test.ts`,
  `test/person-entrypoints.test.ts`, `test/relationship-entrypoints.test.ts`,
  `test/contact-moment-entrypoints.test.ts`,
  `test/browser/person-modal.browser.test.ts`,
  `test/browser/relationship-modal.browser.test.ts` and
  `test/browser/contact-moment-modal.browser.test.ts`.
- Historical record-authoring note: product tests and build were intentionally not
  run while creating only the four 10x records; this is not current gate evidence.
- 2026-08-09 current implementation evidence under Node v24.19.0: `npm run test`
  passed (56 Node files/971 tests, 12 browser files/171 tests, integration and
  DPR 1/1.5/2 matrix); `npm run build`, `npm run typecheck`,
  `npm run format:check`, release contract, community check, dependency audit
  (0 vulnerabilities), reproducibility check and `git diff --check` also passed.
  The current reproducible `main.js` digest was identical on both builds:
  `6f117f9df5b9014cb384fdc4f3eb281f699e6f1d4a3f2923fd8da645dcf4c678`.

## Review

2026-08-09 authoritative independent read-only implementation review: **PASS**.
No critical or significant implementation finding remained after the photo
fallback repair. The review confirmed PersonPhotoPicker ownership, the typed
PersonForm validation port, renderer lifecycle ownership, the shared mutation
safety boundary and canonical/relationship-picker wiring. The broader
`main.ts`/`contact-moment-modal` decomposition remains active follow-up scope;
it is not claimed closed by this parent.

## Retrospective

Pending until the three child tickets execute. The parent retrospective must
capture whether the responsibility seams reduced coupling without introducing
new abstractions, duplicated lifecycle/identity guards or review friction.
