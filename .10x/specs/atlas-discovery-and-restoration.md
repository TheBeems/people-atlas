Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Complete people discovery and stable view restoration

## Authority and scope

The user requested implementation after the preceding source-grounded analysis.
This contract partially supersedes people-atlas-kiss-ux.md and the matching
decision only for search fields, explicit population selection and remembered
renderer modes. Existing privacy, identity, write and selection fences remain.
It also narrowly supersedes accessible-semantic-renderer.md Graph/List clauses
2-3 concerning renderer-lifetime-only mode and non-persistence. Explicit mode
choices may now be restored per view; Graph remains the default without stored
state and setGraph still preserves the current mode. No note writes follow from
mode restoration.
The explicit current implementation instruction authorizes preparing these
execution records and proceeding without a second confirmation turn.

## Required behavior

- AtlasNode MUST expose aliases from indexed canonical people; name, aliases,
  job title, organizations, email and phone search remain presentation matches,
  never identity resolution. Equivalent phone formatting MAY be normalized for
  search only. Duplicate display names MUST remain independently selectable by ID.
- Persons MUST offer explicit This view / All people choices. Standalone All
  people reads the full canonical snapshot before graph projection or node cap;
  Bases All people means all people admitted by that Base before graph projection.
  No action may reveal excluded Bases people, moments or diagnostics.
- Typing or selecting a search result MUST NOT change graph center, scope, camera
  or vault notes. Details and actions MUST work for permitted results outside the
  graph. Native clear, empty-state, focus and owning-window cleanup remain.
- Follow-ups MUST similarly offer current view / all permitted people, without
  applying graph maxNodes to the latter. Invalid or ambiguous moments stay
  non-actionable. Every referenced person and linked relationship endpoint must
  still be within the permitted standalone/Base population. Existing hidden
  accounting remains truthful. Contacts do not create graph relationships.
- Full and delta Base builds MUST use the same canonical people for contact-
  moment validation. A custom mapped person ID may enrich graph endpoint
  resolution, but MUST NOT make a canonically invalid observation appear during
  a later graph update. Keep graph resolution and observation authority separate.
- All-permitted browsing and attention MUST use the original permitted full
  snapshot, independently of a remembered historical network date. Network/path
  results still respect the chosen date and current-view scope still uses the
  dated projected graph. A historical network must not hide current cadence
  proposals from an explicitly global inbox.
- Defaults remain current-view search and current-view follow-ups until a user
  explicitly chooses a wider population. The global Open follow-ups command MAY
  explicitly open the all-permitted inbox because its user intent is global.
- Renderer selection stays stable-ID based and independent from graph navigation.
  Graph canvas always uses the projected graph, even when another surface browses
  a larger permitted snapshot. Renderer code MUST NOT read the vault.
- Persist the last renderer mode and explicit population choices in per-view
  optional fields with backward-compatible defaults. Existing schema-1 state and
  layouts remain valid. Resolve remembered centers against unique current people
  by stable ID on reopen; renamed paths work, removed/duplicate IDs never guess.

## Scenarios and acceptance

1. Alias/email/phone searches find a canonical person independently of display
   name; accent/case handling and existing search behavior stay supported.
2. A person beyond the ego graph or 500-node cap is found only after explicitly
   widening Persons; select/edit/open actions use that exact ID/path.
3. A shared A/B contact remains available in all-permitted follow-ups even when
   B is outside A's graph. Excluding B from the Base still hides it.
4. Close/reopen an ego view centered on A; restore A by stable ID including after
   a rename. Missing/duplicate A stays diagnostic, never selects another person.
5. Changing mode/population and reopening preserves per-view state; legacy state
   loads with the existing defaults and malformed optional fields fail safely.
6. Browser and controlled integration regressions cover selection, focus, narrow
   panes, shared contacts, 500+ people and Bases privacy boundaries.

## Exclusions

No real-vault writes, release, deployment, new framework, implicit centering,
display-name identity, automatic relationship inference or security changes.

## References

- .10x/specs/people-atlas-kiss-ux.md
- .10x/specs/contact-moments-follow-up.md
- .10x/specs/projection-modes-layout-state.md
- .10x/specs/accessible-semantic-renderer.md
