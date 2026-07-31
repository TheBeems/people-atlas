Status: active
Created: 2026-07-30
Updated: 2026-07-30

# UX6–UX7 — Markdown contact moments and explicit follow-up

## Purpose

Add a small, auditable daily-use workflow around interactions and follow-up
without turning `last_contact` into relationship-state inference.

A contact moment is a first-class Markdown note. It can exist for one or more
people without requiring a rich relationship note, and it can optionally link
to one canonical relationship. Follow-up is explicit metadata on that contact
moment and appears in due/overdue views. No operating-system reminder,
background notification or automatic relationship status is part of the
first slice.

## Scope

This specification governs:

- the contact-moment note schema, identity, folder/path and configured
  property names;
- canonical person and optional relationship references;
- `Log contact` create and active/direct edit entrypoints;
- safe contact-moment mutation and recoverable optional `last_contact`
  advancement;
- index records, diagnostics and incremental invalidation;
- selected-person recent-moment presentation;
- an accessible follow-up list for standalone and Bases;
- explicit Open, Edit, Mark done and Dismiss actions;
- local-calendar due grouping and lifecycle refresh.

## Contact-moment data contract

### Settings and defaults

1. `PeopleAtlasSettings` MUST add:

   | Setting | Default |
   | --- | --- |
   | `contactMomentsFolder` | `People/Contact moments` |
   | `contactMomentTypeValue` | `contact_moment` |
   | `contactMomentIdProperty` | `contact_moment_id` |
   | `contactMomentPeopleProperty` | `people` |
   | `contactMomentRelationshipProperty` | `relationship` |
   | `contactMomentOccurredOnProperty` | `occurred_on` |
   | `contactMomentChannelProperty` | `channel` |
   | `contactMomentSummaryProperty` | `summary` |
   | `contactMomentFollowUpOnProperty` | `follow_up_on` |
   | `contactMomentFollowUpStatusProperty` | `follow_up_status` |

2. Contact moments use the existing configured `typeProperty`. The person,
   relationship and contact-moment type values MUST be distinct.
3. Contact-moment property names MUST be non-empty and distinct within the
   contact-moment schema. The configured folder MUST be a safe vault-relative
   folder.
4. A versioned settings migration MUST add defaults without creating or
   rewriting vault notes.

### Required and optional values

5. A contact-moment record contains:

   ```ts
   interface ContactMomentRecord {
     id: ContactMomentId;
     filePath: string;
     people: PersonReference[];
     relationship?: RelationshipReference;
     occurredOn: string;
     channel?: string;
     summary?: string;
     followUpOn?: string;
     followUpStatus?: "open" | "done" | "dismissed";
   }
   ```

6. `contact_moment_id` is authoritative when present, with normalized note
   path fallback only for manually authored legacy notes. Plugin-created
   moments MUST receive a generated explicit ID.
7. `people` is a required, non-empty, ordered list of unique references to
   canonical indexed people. Display names may label choices but MUST NOT be
   stored or resolved as identity.
8. Existing unresolved or ambiguous person references produce diagnostics
   and the moment remains indexed as invalid/non-actionable. The plugin MUST
   NOT guess or silently drop a reference.
9. `relationship` is optional and references one canonical, note-backed
   relationship. When present, that relationship MUST share at least one
   canonical person with the moment. A mismatch produces a diagnostic and no
   `last_contact` update capability.
10. `occurred_on` is required and uses a valid full `YYYY-MM-DD` local
    calendar date. Contact time/timezone are not stored in this slice.
11. `channel` and `summary` are optional trimmed user-authored text. Channel
    MAY offer suggestions such as call, message, email or meeting, but custom
    text remains valid and no channel is inferred.
12. The Markdown body remains free user content. Structured editing MUST
    preserve it byte-for-byte. Successful creation opens the new moment note
    so the user can add arbitrary Markdown context.

### Follow-up values

13. `follow_up_on` is optional and, when present, uses valid full
    `YYYY-MM-DD`.
14. `follow_up_status` is optional and accepts only `open`, `done` or
    `dismissed`.
15. A moment with `follow_up_on` and no stored status is treated as `open` for
    display without writing. A newly created/edited follow-up writes `open`
    explicitly unless the user chooses another state.
16. A status without `follow_up_on`, or an invalid date/status, produces a
    diagnostic and is excluded from actionable due lists. It MUST NOT change
    relationship status.
17. `done` and `dismissed` are manual terminal states for that follow-up only.
    They do not delete the moment or change its relationship/person.

## Index and projection contract

18. `PersonIndex` MUST parse and incrementally maintain contact-moment records
    alongside people and relationships. It remains the canonical vault-backed
    source.
19. Duplicate explicit contact-moment IDs MUST remain ambiguous and produce a
    diagnostic; first-match behavior is forbidden.
20. Create/modify/rename/delete of a contact moment, referenced person,
    referenced relationship or configured property MUST invalidate only the
    affected records and projected summaries where possible.
21. Contact moments MUST NOT create graph nodes or relationship edges.
22. The shared snapshot contract used by standalone and Bases MUST add:

    ```ts
    interface ContactMomentSummary {
      id: ContactMomentId;
      filePath: string;
      personIds: PersonId[];
      relationshipId?: RelationshipId;
      occurredOn: string;
      channel?: string;
      summary?: string;
      followUpOn?: string;
      followUpStatus?: "open" | "done" | "dismissed";
    }

    interface AtlasSnapshot {
      // Existing graph fields remain unchanged.
      contactMoments: ContactMomentSummary[];
      hiddenContactMomentCount: number;
    }
    ```

    Rendering MUST consume these summaries and MUST NOT read the vault.
23. Standalone includes moments whose canonical people are in its visible
    person population. In a Bases view, a moment is visible only when:
    - every resolved person referenced by that moment belongs to the Base's
      visible population; and
    - when a relationship is linked, both canonical relationship endpoints
      belong to that population.

    This prevents a filtered person name from leaking through either the
    moment row or a relationship label/path.
24. `hiddenContactMomentCount` MUST equal the input hidden-moment count plus
    each otherwise-valid input moment omitted by the person/Base projection,
    counted once. Invalid/unresolved moments remain diagnostics and MUST NOT
    be mistaken for projection-hidden or missing notes.
25. Selected-person history includes moments whose `people` list contains the
    selected stable person identity, ordered by newest `occurred_on`, then
    stable moment ID.

## Create and edit workflow

### Entrypoints and form

26. The plugin MUST provide:
    - a global `Log contact` command;
    - a selected canonical person's `Log contact` action in standalone,
      Bases and the mobile details sheet;
    - active-person prefill when the global command is invoked from one
      canonical active person note;
    - `Edit current contact moment`; and
    - path-based edit actions wherever a moment/follow-up row is rendered.
27. Ghost, ambiguous, stale or non-canonical people MUST NOT be prefilled.
28. The shared create/edit form MUST expose:
    - one or more canonical people;
    - optional canonical relationship;
    - occurred-on date, defaulting to the current local date for a new form
      but remaining editable before Save;
    - optional channel and summary;
    - optional follow-up date/status;
    - an explicit unchecked
      `Advance linked relationship's last contact to this date` checkbox when
      a valid relationship is selected; and
    - path and stable ID under `Advanced`.
29. Defaulting the unsaved occurred-on field to today is presentation only;
    no note or relationship changes until explicit Save.
30. Relationship choices MUST be canonical note-backed relationships that
    share at least one selected person. An unavailable historical relationship
    reference remains visible during edit but cannot update `last_contact`
    until repaired.

### Path and identity

31. Create MUST propose a reviewable path:

    `People/Contact moments/YYYY-MM-DD - <Primary person> - <short-id>.md`

    using the configured folder, sanitized display label and a stable suffix
    derived from the generated moment ID. The display label is filename text,
    never identity.
32. The proposed path remains editable under `Advanced`.
33. Existing destinations MUST be rejected without overwrite, implicit numeric
    suffix or hidden rename. Edit path is read-only; moment-note rename/move
    is excluded.

### Safe writes and optional last-contact advancement

34. Save MUST validate all contact-moment and optional relationship-update
    inputs before the first write. Cancel, Escape and close write nothing.
35. Contact-moment notes MUST use Obsidian vault/frontmatter APIs, preserve
    unrelated frontmatter and body content, and serialize through the existing
    mutation coordination boundary or an equivalent single-flight extension
    of it.
36. The last-contact checkbox is always unchecked initially, including when
    a relationship was prefilled. The user must explicitly select it.
37. When selected, `last_contact` MAY advance to `occurred_on`; it MUST NOT
    move backwards. If the current relationship date is equal or later, the
    relationship remains unchanged and the completion message explains why.
38. Advancing `last_contact` MUST NOT alter relationship status, template
    provenance, roles, types or any other property.
39. The operation writes the contact-moment note first, then attempts the
    optional relationship update. Obsidian provides no atomic cross-file
    transaction, so failure after moment creation/edit is a declared partial
    success:
    - the truthful contact moment remains;
    - the form MUST NOT allow a second create that duplicates it;
    - the user sees the created/edited moment path and failed relationship
      path/reason; and
    - a retry action attempts only the pending relationship update after
      revalidation.
40. A retry MUST be idempotent and stale-safe. If either note changed since
    failure, the user must review current values before an overwrite.
41. Editing or deleting a contact moment MUST NOT automatically roll back
    `last_contact`.

## Presentation and follow-up view

### Selected-person details

42. A canonical selected person's details MAY show:
    - the three most recent valid contact moments;
    - the earliest open follow-up for that person; and
    - `View all contact moments` / `Log contact` actions.
43. Each moment row shows occurred date, present channel/summary and an
    optional relationship label. It exposes `Open contact moment` and
    `Edit contact moment` after canonical path revalidation.
44. Invalid moments remain represented by diagnostics rather than being
    silently included as valid history.

### Follow-up mode

45. The shared renderer MUST add an explicit `Follow-ups` mode alongside the
    existing Graph/List surfaces. A global `Open follow-ups` command activates
    the standalone atlas in that mode.
46. Open follow-ups are grouped and ordered against the owning window's local
    calendar date:
    1. `Overdue`: date before today, oldest first;
    2. `Due today`: date equal to today, stable ID order;
    3. `Upcoming`: date after today, soonest first.
47. Rows show follow-up date, people, occurred-on date, channel/summary when
    present and linked relationship when valid.
48. Each actionable row exposes native buttons:
    - `Open contact moment`;
    - `Edit contact moment`;
    - `Mark follow-up done`;
    - `Dismiss follow-up`.
49. Marking done or dismissed explicitly updates only the configured
    follow-up-status property on that moment note through the safe mutation
    boundary. A stale/deleted/non-canonical row makes no write and reports the
    issue.
50. Done and dismissed rows are hidden from the default due list. This first
    slice does not require a completed-history toggle; the Markdown notes
    remain queryable in Obsidian/Bases.
51. Follow-up mode in Bases obeys the visible-person rule in item 23.
52. Due grouping MUST refresh on relevant index changes and when the local day
    changes while the view remains open. Any timer uses the owning `Window`
    and lifecycle cleanup; no background alarm or notification is registered.
53. Follow-up view state is presentation only and MUST NOT write vault notes
    except after one of the explicit row actions.

## Diagnostics

54. The domain diagnostic union MUST add stable codes for at least:
    - duplicate contact-moment ID;
    - unresolved/ambiguous contact-moment person;
    - unresolved contact-moment relationship;
    - relationship/person mismatch;
    - invalid occurred-on date;
    - invalid follow-up date; and
    - invalid follow-up status.
55. Diagnostics include the moment path and referenced path/identity where
    available. They MUST remain navigable through existing diagnostic
    surfaces without exposing filtered person names.

## Scenarios

### Log a person-only contact

Given Alice is a canonical person with no rich relationship note
When the user selects Alice, chooses `Log contact`, reviews today's date and
saves
Then one contact-moment Markdown note is created for Alice and no relationship
note is required or inferred.

### Explicitly advance last contact

Given a valid relationship has `last_contact: 2026-07-01`
When a 2026-07-30 contact moment is saved with the unchecked-by-default
advance option explicitly selected
Then the moment is created and that relationship alone advances to
`2026-07-30`; its status and other metadata remain unchanged.

### Never move last contact backwards

Given a relationship already has `last_contact: 2026-08-01`
When a 2026-07-30 moment is logged with advancement selected
Then the moment is saved, `last_contact` remains `2026-08-01` and the user is
told that no backward update was applied.

### Recover partial success

Given moment creation succeeds but relationship update fails
When Save completes
Then the created moment is retained, no duplicate resubmit is possible and
the user can retry only the stale-safe relationship update.

### Show due work without changing relationship state

Given an open follow-up date is yesterday and the linked relationship status
is active
When Follow-ups mode opens
Then the row appears under Overdue and the relationship status remains active.

### Respect a Bases filter

Given a moment references Alice and Bob but a Base includes only Alice
When Follow-ups mode renders inside that Base
Then the moment is projection-hidden and Bob's name is not revealed.

## Acceptance criteria

- [x] Settings migration adds the contact-moment folder/type/property
      mappings without creating or rewriting notes.
- [x] Parser/index/domain support first-class contact moments with explicit
      identity, canonical people, optional matching relationship, dates,
      summary/channel and follow-up status.
- [x] Contact moments never become graph nodes/edges or inferred
      relationships.
- [x] Incremental lifecycle and duplicate/unresolved/date/status diagnostics
      are deterministic and source-path specific.
- [x] Global, active-person, selected-person and active/direct edit
      entrypoints use one shared form and one safe mutation contract.
- [x] Create path/ID behavior is reviewable, collision-safe and independent of
      display-name identity.
- [x] Last-contact advancement is unchecked by default, explicit, monotonic,
      limited to one canonical relationship and never changes status.
- [x] Declared two-file partial success cannot create a duplicate moment and
      offers an idempotent stale-safe relationship retry.
- [x] Selected-person details show bounded recent moments and the next open
      follow-up without reading vault files in the renderer.
- [x] Follow-ups mode groups Overdue/Today/Upcoming by owning-window local
      date and obeys Bases visible-person filtering.
- [x] Open/Edit/Done/Dismiss actions revalidate current canonical files and
      mutate only after explicit activation.
- [x] No operating-system notification, background reminder or automatic
      relationship status is introduced.
- [x] Pure tests cover schema validation, path proposal, identity collisions,
      multi-person matching, date ordering, projection filtering, monotonic
      last-contact updates and partial retry state.
- [x] Browser/integration tests cover form entrypoints, focus, selected-person
      history, follow-up groups/actions, stale rows, local-day refresh,
      standalone/Bases parity and owning-window cleanup.
- [x] Existing person, relationship, projection, renderer and mutation
      regressions remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Exclusions

- Operating-system, Obsidian or mobile push notifications.
- Background reminder jobs while the view/plugin is closed.
- Recurring follow-ups, cadence rules, snooze, calendar/task integration or
  outbound email/message actions.
- Inferring relationship status, type, closeness or endpoint roles from
  recency.
- Inferring a contact moment from daily notes, backlinks, calls, email,
  meeting notes or AI extraction.
- Automatic rollback/recomputation of `last_contact` when a moment changes.
- Contact-moment delete/restore, merge, external synchronization or broad CRM
  pipelines.
- Claiming automated Chromium proof covers live Obsidian Desktop/Mobile or
  system date-change behavior.

## Ratified decisions

1. A contact moment is a separate Markdown note linked to one or more people
   and optionally one canonical relationship.
2. Updating `last_contact` is explicit and never drives relationship status.
3. Follow-up is user-authored and appears in due/overdue views.
4. Operating-system reminders are deferred from the first implementation
   slice.

## References

- `.10x/research/2026-07-25-obsidian-people-needs.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `src/domain/types.ts`
- `src/index/frontmatter.ts`
- `src/index/index-state.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/main.ts`
- `src/render/atlas-renderer.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
