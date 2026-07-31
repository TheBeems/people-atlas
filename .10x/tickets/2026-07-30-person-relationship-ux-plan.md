Status: done
Created: 2026-07-30
Updated: 2026-07-30

# People Atlas person and relationship UX expansion plan

## Objective

Turn the seven ratified UX recommendations into a staged, Markdown-first
implementation program that makes existing relationship behavior reachable,
adds useful optional person profiles and introduces explicit contact
moments/follow-up without weakening identity, mutation or inference safety.

This is a parent plan, not an executable implementation ticket. Each child
ticket is independently bounded and still requires explicit implementation
authorization after its dependencies are satisfied.

## Ratified product outcomes

0. Relationships are direction-free and use one optional stable My person
   perspective: new flows are self-first, third-party relationships remain
   valid, roles carry endpoint meaning and legacy direction YAML is ignored
   without automatic deletion.
1. Existing note-backed relationships can be opened and edited where they are
   shown.
2. `Relationship template` replaces confusing preset/link wording in the UI
   while stored `relationship_preset` compatibility and copy-not-live
   semantics remain.
3. Photo becomes an end-to-end workflow: vault selection, preview, selected
   profile image and graph avatar with safe fallback.
4. A person can optionally store `birth_date`, pronouns, gender, email
   addresses, phone numbers and job title.
5. Relationship and person editors use conceptual sections with technical
   fields under `Advanced`.
6. `Contacts` is presented as `Linked people`; email and phone are separate
   `Contact details`, and rich relationship notes remain distinct.
7. Contact moments are separate Markdown notes with explicit optional
   `last_contact` advancement and user-authored due follow-up, without
   notifications or relationship-status inference.

## Governing specifications

- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`

## Recommendation-to-ticket map

| User recommendation | Owning child tickets |
| --- | --- |
| Superseding perspective contract | UX0 |
| 1. Direct relationship editing | UX1 |
| 2. Understandable templates | UX2 |
| 3. Complete photo workflow | UX4, UX5 |
| 4. Optional person profile | UX3 |
| 5. Restructured editors | UX2, UX3 |
| 6. Linked people versus contact details/relationships | UX3 |
| 7. Contact moments and follow-up | UX6, UX7 |

## Child sequence and dependencies

```text
UX0 Direction-free perspective foundation
 ├──> UX1 Direct relationship actions ────────────┐
 ├──> UX2 Perspective editor/templates ───────────┼──> UX6 Contact-moment entity/logging ──> UX7 Follow-up/history
 └──> UX3 Person profile schema/editor ───────────┘
                       └──> UX4 Photo picker/profile ──> UX5 Graph avatars
```

UX0 is the required foundation because it changes the current settings and
graph contracts once, without rewriting vault notes. UX1 and UX2 become
independent after UX0 but should be implemented one reviewed ticket at a time.
UX3 follows UX0 so its later profile migration starts from the direction-free
schema. UX4 and UX5 split DOM/vault selection from canvas decoding/cache. UX6
establishes the new note entity and safe writes before UX7 projects it into
renderer views.

## Child tickets

### UX0 — Direction-free perspective foundation

Owner:
`.10x/tickets/2026-07-30-perspective-relationship-foundation.md`

Remove direction across the current settings/domain/index/graph/mutation/
renderer contracts, migrate valid settings v4 to v5, preserve legacy note YAML
as unowned data and add canonical My person identity plus initial-center
fallback.

Gate: migration and legacy-note preservation are safe, full/incremental graphs
remain equivalent, My person never guesses and neutral roleless descriptions
replace Incoming/Outgoing.

### UX1 — Direct relationship context actions

Owner: `.10x/tickets/2026-07-30-relationship-context-actions.md`

Convert incident relationship descriptions into structured rows with direct
Open/Edit actions for canonical note-backed edges in standalone, Bases and
mobile details. Reuse the existing relationship modal and mutation service;
do not add edge selection.

Gate: parallel/inferred/stale relationships behave exactly as specified and
browser coverage proves accessible action/focus parity.

### UX2 — Perspective relationship editor and templates

Owner:
`.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`

Apply self-first but non-self-only endpoint defaults, actual-name/My role
labels, the user-facing template terminology and empty-state/create route,
preserve direction-free copied-value behavior, split the relationship form
into four sections and stop full-form/focus resets.

Gate: endpoint order never changes implicitly, third-party relationships stay
valid, template role mapping is reviewable, actions remain explicit and the
modal is understandable/operable at narrow widths.

### UX3 — Person profile schema, editor and language

Owner: `.10x/tickets/2026-07-30-person-profile-schema-editor.md`

Add configurable profile properties, the optional-year birth-date contract,
person parsing/mutation/Bases mappings, conceptual form sections, compact
profile details and the Linked people/Contact details distinction.

Gate: migrations and configured-property collision checks are safe, invalid
legacy values remain reviewable and no field influences relationship
inference.

### UX4 — Photo picker and selected-profile presentation

Owner: `.10x/tickets/2026-07-30-person-photo-picker-profile.md`

Replace manual-only photo entry with a searchable vault-image picker and
preview, then render resolved photos in selected-person details with visible
missing/unsupported fallback. Keep graph canvas work separate.

Gate: picker/save/clear/raw-preservation and standalone/Bases/pop-out profile
behavior are covered without external asset loading.

### UX5 — Graph avatars and bounded image lifecycle

Owner: `.10x/tickets/2026-07-30-graph-photo-avatars.md`

Decode bounded thumbnails asynchronously in the renderer's owning window,
paint circular avatars without changing graph interaction and invalidate/
release resources across asset/view lifecycle.

Gate: 64-by-256-pixel cache bounds, initials fallback, high-DPI behavior,
late-completion safety and photo-populated characterization are proven.

### UX6 — Contact-moment Markdown entity and logging

Owner: `.10x/tickets/2026-07-30-contact-moment-notes.md`

Add versioned settings, domain/index/diagnostic support, safe creation/editing
and global/selected-person entrypoints for contact-moment notes. Implement the
explicit unchecked, monotonic `last_contact` update with declared partial
success and retry.

Gate: contact moments remain independent Markdown entities, identity and
multi-file failure behavior are deterministic, and no graph/status inference
appears.

### UX7 — Contact history and follow-up surfaces

Owner: `.10x/tickets/2026-07-30-contact-follow-up-views.md`

Project valid moments through the shared standalone/Bases snapshot, add
selected-person history and a Follow-ups mode with Overdue/Today/Upcoming
groups plus explicit Open/Edit/Done/Dismiss actions.

Gate: local-day ordering, Bases privacy filtering, stale-row writes and
owning-window cleanup are browser/integration covered without background
notifications.

## Cross-cutting implementation rules

1. Every child MUST start by rereading its governing spec, dependencies,
   `AGENTS.md` and the current worktree.
2. Implementation authorization for one child does not authorize later
   children, commits, pushes, releases, live vault mutation or publication.
3. Each write stays behind the existing mutation coordinator or a reviewed
   extension with explicit validation and partial-failure semantics.
4. Display names never become person, relationship or contact-moment
   identity.
5. Standalone and Bases consume one shared snapshot contract; renderers never
   read vault files.
6. Unresolved/ambiguous values produce diagnostics and are never guessed.
7. No direction, gender, kinship, relationship type/status, endpoint-role or
   follow-up inference is introduced.
8. UI work uses Obsidian CSS variables and the view's owning Window.
9. Each child adds focused pure/browser/integration regressions appropriate to
   its boundary and finishes with:

   ```text
   npm run test
   npm run build
   git diff --check
   ```

10. Automated browser proof must name its boundary and must not claim live
    Obsidian Desktop, Mobile, Electron pop-out or assistive-technology proof.

## Parent acceptance criteria

- [x] UX0 through UX7 each close only against their active governing spec,
      explicit authorization, focused tests, full test/build gates and a
      recorded review verdict.
- [x] The seven ratified recommendations are covered without a broad CRM,
      external sync, notification or inference expansion.
- [x] Existing relationship/person notes retain unrelated content through
      versioned migrations; directional meaning is intentionally removed while
      legacy direction YAML remains untouched and ignored.
- [x] New Markdown writes are explicit, reviewable, collision-safe and
      preserve unrelated content.
- [x] Standalone and Bases remain semantically aligned.
- [x] Residual live/manual evidence is recorded honestly and assigned to a
      separate validation follow-up rather than represented as automated
      proof.

## Non-goals

- Implementing any child in this shaping turn.
- Automatically renaming existing frontmatter properties.
- External contacts, calendar/task providers, OS notifications or AI-derived
  relationship/contact events.
- Person merge, relationship delete/rename, edge selection or arbitrary
  custom profile fields.
- Commit, push, tag, release or Community Plugins publication.

## References

- `AGENTS.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `.10x/research/2026-07-25-obsidian-people-needs.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/performance-characterization.md`

## Assumptions

None beyond the ratified product outcomes and governing records above.

## Blockers

None at parent-plan level. Each child ticket owns its dependencies, execution
blockers and authorization boundary.

## Journal

- 2026-07-30: Source-backed UX review identified seven recommendations and
  recorded current workarounds, gaps and priority.
- 2026-07-30: The user ratified direct relationship-row actions, template
  terminology/copy semantics/form hierarchy, one optional-year `birth_date`
  property and the separate Markdown contact-moment/follow-up model.
- 2026-07-30: Four governing specs and seven bounded future child tickets were
  opened. No product implementation, test/build execution or publication was
  authorized by this shaping work.
- 2026-07-30: The user superseded relationship direction with a stable My
  person perspective, self-first/non-self-only creation and safe preservation
  of ignored legacy direction YAML. UX0 and a replacement UX2 were opened;
  the direction-bearing UX2 ticket was cancelled before implementation.
- 2026-07-30: Record-only implementation preflight reconciled the older P4
  projection wording with the active direction-free contract, completed the
  standard audit sections on every open UX ticket and refreshed `ROADMAP.md`.
  No product code was changed by this preflight.
- 2026-07-30: UX0 closed after full automated verification and fresh
  adversarial review. Direction is absent from current contracts, settings
  migrate safely to v5, legacy note data remains unowned/preserved and
  canonical My person initialization now handles deferred startup and Bases
  projection mappings without guessing.
- 2026-07-30: UX1 closed after 39 files / 392 tests, build and hygiene gates
  passed plus fresh adversarial review. Exact note-backed relationship rows
  now expose canonical Open/Edit actions across standalone, Bases and mobile
  details without making inferred or ambiguous targets actionable.
- 2026-07-30: UX2 closed after 41 files / 441 tests, build and hygiene gates
  passed plus iterative fresh adversarial review. The shared relationship
  editor is self-first without reordering edits; template sync now compares
  and applies against live frontmatter, rejects changed note types and aborts
  already-current host writes during index lag.
- 2026-07-30: UX3 closed after 46 files / 532 tests, build and hygiene gates
  passed plus iterative fresh adversarial review. Optional profile data now
  remains equivalent across standalone/Bases, raw invalid values survive
  unrelated edits and tag-only person writes require current source/stat
  proof before the serialized frontmatter mutation.
- 2026-07-30: UX4 closed after 49 files / 564 tests, build and hygiene gates
  passed plus iterative fresh adversarial review. Exact vault-photo selection,
  safe owner-document presentation and asset lifecycle refresh now work in
  standalone, Bases and graph/mobile details without external loading;
  canvas avatars remain isolated to UX5.
- 2026-07-30: UX5 closed after 54 files / 581 tests, build and hygiene gates
  passed plus fresh independent approval. Canvas avatars now use an
  owning-window, exact-revision cache with a stable selected/center-first
  64-key working set, deterministic initials fallback, targeted lifecycle
  invalidation and controlled Chromium/DPR characterization.
- 2026-07-30: UX6 closed after 60 files / 694 tests, build and hygiene gates
  passed plus three independent reviews. Contact moments are now separate
  indexed Markdown entities with one shared Log/Edit flow, explicit unchecked
  monotonic `last_contact` advancement and visible stale-safe partial retry;
  they do not create graph nodes or infer relationship state.
- 2026-07-30: UX7 closed after 63 files / 743 tests, build, browser-matrix and
  hygiene gates passed plus three independent review streams. Shared
  standalone/Bases history and Follow-ups surfaces now preserve Bases privacy,
  use owning-window local-day lifecycle and expose only explicit stale-safe
  actions.

## Evidence

- UX0 through UX7 are done and each child ticket records its governing
  contract, focused regressions, full gates, review findings and repair
  verdict.
- The final integrated state passed 63 test files / 743 tests,
  `npm run build`, the 3-file / 6-test browser matrix, formatting, lint and
  `git diff --check`.
- Automated Chromium and controlled Obsidian-stub evidence remains distinct
  from live Obsidian Desktop/Mobile, Electron pop-out, assistive-technology,
  physical-clock and production-vault validation.

## Review

Parent closure reconciled every child status and governing-spec acceptance
set after UX7's graph/privacy, mutation/TOCTOU and renderer/adapter reviews
were all explicitly green. No active or completed child retains an open
acceptance criterion or unresolved blocker; the superseded direction-bearing
ticket remains explicitly cancelled.

## Retrospective

The dependency chain kept foundational identity/direction changes ahead of
entrypoints, profile/photo work and contact workflows. Splitting contact
storage/mutation from projection/presentation made the final privacy and
staleness review tractable. The delivered scope stays Markdown-first and
explicit without expanding into synchronization, notifications, inference or
publication.
