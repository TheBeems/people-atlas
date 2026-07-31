Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX7 — Contact history and follow-up surfaces

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-30-contact-moment-notes.md`,
`.10x/tickets/2026-07-26-accessible-semantic-renderer.md`,
`.10x/tickets/2026-07-25-projection-modes-layout-state.md`

## Scope

Implement the projection/renderer/action portion of
`.10x/specs/contact-moments-follow-up.md`:

- carry validated contact-moment summaries through the shared
  standalone/Bases snapshot without renderer vault reads;
- enforce visible-person filtering for multi-person moments in Bases;
- show bounded recent contact history and next follow-up for a selected
  canonical person;
- add a Follow-ups mode and global Open follow-ups entrypoint;
- group open rows into Overdue, Due today and Upcoming by owning-window local
  date;
- add canonical Open/Edit/Mark done/Dismiss actions;
- refresh on index/local-day changes with lifecycle-owned cleanup.

This ticket becomes executable only after UX6 is done and the user explicitly
authorizes implementation.

## Non-goals

- Notifications, background alarms, snooze, recurrence or calendar/tasks.
- Automatic follow-up creation from `last_contact` or cadence.
- Relationship status/type/closeness inference.
- Completed-history management UI beyond retained Markdown notes.
- Contact-moment graph nodes/edges or timeline visualization.

## Acceptance criteria

- [x] Shared snapshot/projection data adds validated `contactMoments` and
      `hiddenContactMomentCount`; render code never reads vault files.
- [x] Contact moments remain supplemental data and do not affect graph node/
      edge inclusion, layout, hidden edge counts or relationship meaning.
- [x] Standalone includes moments for its visible people; Bases includes a
      moment only when every moment person and both endpoints of any linked
      relationship are in the visible Base population.
- [x] Projection-hidden moments increment `hiddenContactMomentCount` exactly
      once and remain distinct from invalid/unresolved diagnostics.
- [x] Filtered moment accounting never exposes a filtered person's label in
      rows, counts or diagnostics messages visible to the Base.
- [x] Selected canonical person details show at most three most-recent valid
      moments and the earliest open follow-up, with View all/Log contact.
- [x] Moment rows show occurred date, present channel/summary and valid
      relationship label plus revalidated Open/Edit actions.
- [x] Renderer adds an explicit Follow-ups mode alongside existing Graph/List
      behavior; Open follow-ups activates standalone in that mode.
- [x] Open follow-ups are grouped/ordered as Overdue oldest first, Due today
      stable ID, Upcoming soonest first using the owning Window's local date.
- [x] Rows show follow-up date, people, occurred date and present context.
- [x] Native Open/Edit/Mark done/Dismiss buttons have row-specific accessible
      names and logical focus behavior at desktop/narrow/mobile widths.
- [x] Done/Dismiss writes only the configured moment status after canonical
      path revalidation; stale/deleted/ambiguous rows make no write.
- [x] Done/dismissed rows disappear from the default due list but their notes
      remain untouched/queryable.
- [x] No action changes relationship status or automatically alters
      `last_contact`.
- [x] Relevant index changes refresh affected history/follow-up rows without
      resetting unrelated graph selection/layout.
- [x] A lifecycle-owned owning-window timer refreshes group boundaries across
      local midnight and is cancelled on mode/view destroy.
- [x] Pure tests cover selected-person filtering, stable ordering, local-date
      categories, Bases all-people visibility and terminal status handling.
- [x] Browser/integration tests cover standalone/Bases mode parity, keyboard/
      pointer/touch actions, stale rows, focus after removal, local-day
      refresh and pop-out owning-window cleanup.
- [x] Existing graph/list/details/touch/high-DPI tests remain passing.
- [x] Automated evidence explicitly excludes live OS notification, Obsidian
      Mobile and physical system-clock proof.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/domain/types.ts`: projected contact-moment summary contract.
- `src/graph/`: pure moment visibility/ordering helpers, without `obsidian`.
- `src/render/atlas-renderer.ts`: selected history and Follow-ups mode.
- `src/main.ts`: Open follow-ups and canonical path actions.
- standalone/Bases view adapters: shared projection/capabilities.
- Node/browser/integration tests for dates, privacy, actions and lifecycle.

The Follow-ups mode SHOULD reuse existing semantic renderer patterns rather
than introduce a second standalone view unless source-backed implementation
evidence proves that impossible. Any change in surface ownership must stop
for a recorded spec update.

## References

- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/tickets/2026-07-30-contact-moment-notes.md`
- `.10x/research/2026-07-25-obsidian-people-needs.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: follow-up is manual and visible as due/overdue work without
  OS reminders.
- Record-backed: standalone and Bases must consume one shared snapshot and
  renderers do not read vault data.
- Technical contract: date grouping uses the owning Window's local calendar
  day and open status only; no timezone/time-of-day semantics are introduced.

## Blockers

None known. Stop and record a blocker if a Bases filter cannot hide all
co-participant labels for a partially visible multi-person moment, or if local
day refresh requires a background service outside view lifecycle.

## Journal

- 2026-07-30: Follow-up view behavior was ratified without notifications or
  relationship-status inference.
- 2026-07-30: Projection/renderer ticket opened behind UX6. No renderer mode,
  timer or vault mutation was implemented in this shaping turn.
- 2026-07-30: Implemented shared contact-moment projection, strict Bases
  all-participant privacy, selected-person history, an owning-window
  Follow-ups mode and explicit stale-safe Open/Edit/Done/Dismiss actions.
- 2026-07-30: Iterative adversarial review found unsafe partial delta
  reconstruction, legacy diagnostic loss, permissive raw-frontmatter
  coercion, callback-time staleness, pending-row/focus defects and duplicate
  row context. Each finding was repaired with a focused regression and
  re-reviewed before closure.

## Evidence

- Pure projection/presentation tests cover selected-person bounds, stable
  local-day grouping, terminal statuses, exact hidden counting and strict
  full-source delta behavior without changing graph topology.
- Controlled integration proves standalone/full-Bases parity, partial-Bases
  co-participant privacy, the global command, status-only accepted writes,
  visible stale no-writes and focus restoration in both editor-close/index
  event orders.
- Controlled Chromium covers native actions, busy/removal focus, stale
  capability refresh, narrow/coarse 44-pixel targets, deterministic accessible
  names and owning-window local-midnight scheduling/cleanup.
- Final gates: `npm run test` passed 63 files / 743 tests; `npm run build`,
  `npm run format:check`, `npm run lint` and `git diff --check` passed.
  `npm run test:browser-matrix` passed 3 files / 6 tests.
- Automated evidence does not certify live Obsidian Desktop/Mobile, Electron
  pop-outs, assistive technology, operating-system notifications or a
  physical system-clock transition.

## Review

Three independent read-only review streams covered graph/projection privacy,
raw mutation and TOCTOU safety, and renderer/lifecycle/view adapters. Findings
were repaired and cross-reviewed until all three boundaries were explicitly
green; no blocker or unresolved contract-level finding remained.

## Retrospective

Treating privacy-filtered contact data as a projection that requires complete
current sources prevented unsafe reconstruction during deltas. Status-only
writes still required strict raw-shape and callback-time revalidation.
Finally, accessible focus identity had to include visible row placement
because one moment may appear in both next-follow-up and history contexts.
