Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Explicit follow-up rescheduling, history and birthday attention

## Authority

User-authorized recommendations: postpone one week, view completed follow-ups,
reopen one, and use already stored birthdays/desired contact intervals. These
additions do not authorize external reminders or automatically created notes.

## Behavior

- Follow-ups offers explicit Open / Completed / Dismissed / All filtering over
  the chosen permitted population. Current default is Open. Status remains the
  existing open/done/dismissed note field, not a new task store.
- Postpone one week uses the local calendar day when overdue, otherwise the
  existing due day, adds seven calendar days and explicitly saves only the due
  date after stale-source revalidation. It does not change occurred_on or status.
  Editing the date manually remains available. Label the resulting reviewed date.
- Completed/dismissed follow-ups have an explicit Reopen action that writes only
  open after current source/date/status validation. Concurrent changes fail closed.
- All mutation actions retain lifecycle-owned pending state, error notices and
  focus recovery; cancelled/opened/rendered views do not write.
- Add a local birthday attention surface for today and the next 30 calendar days,
  computed solely from validated birth_date values including unknown-year dates.
  Show age only with a known year and never infer it. Include February 29 only in
  years where that date exists; disclose no substituted February 28/March 1 date.
- Contact-cadence attention derives from the optional explicit relationship
  interval and valid observed dates; it is a read-only suggestion with an explicit
  Log contact action. No automatic person/relationship status or follow-up note.
- Calendar displays refresh under the owning Window at local-day transitions,
  are deterministic with injected today in pure tests, and respect Bases scope.

## Acceptance

Pure tests cover statuses, date rollover/DST-safe day arithmetic, birthdays across
year boundaries and leap years, unknown age and cadence absence/ended relations.
Mutation tests cover stale source/identity/date/status, preservation, single writes
and save errors. Browser/integration tests cover filters, actions, cancellation,
focus, local-day lifecycle and Base visibility.

## Exclusions

No recurrence, background/OS notifications, calendar sync, new database, automatic
notes, external communication or real-vault writes.
