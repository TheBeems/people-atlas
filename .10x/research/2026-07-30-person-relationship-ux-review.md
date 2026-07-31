Status: done
Created: 2026-07-30
Updated: 2026-07-30

# Person, relationship editing and preset UX review

## Question

Why can a current People Atlas 0.2.0 user not find relationship editing, why
does the relationship-preset selector show only `Not linked`, where can person
profile data such as a photo, gender and birth date be entered, and which UX
improvements should be prioritized before adding broader product scope?

## Sources and Methods

This was a shaping-only, source-backed combined UX and accessibility review.
No product code, settings, vault notes, tests, builds, previews or external
application state were changed.

Sources inspected on 2026-07-30:

- the user's direct report that relationship editing was not findable, the
  preset selector showed only `Not linked`, and expected profile fields were
  missing;
- current clean `main` at release `0.2.0` (`8d5db6c`), including the feature
  commit `ae53586` (`Add person editor and relationship presets`);
- `manifest.json`, `README.md` and `README.nl.md`;
- `src/main.ts`;
- `src/editor/relationship-modal.ts` and
  `src/editor/relationship-form.ts`;
- `src/settings/relationship-presets.ts`,
  `src/settings/relationship-preset-modal.ts`,
  `src/settings/relationship-preset-sync.ts`,
  `src/settings/relationship-preset-sync-modal.ts`,
  `src/settings/settings-tab.ts`, `src/settings/defaults.ts` and
  `src/settings/types.ts`;
- `src/editor/person-modal.ts` and `src/editor/person-form.ts`;
- `src/domain/types.ts`, `src/index/frontmatter.ts`,
  `src/mutations/validation.ts` and
  `src/mutations/atlas-mutation-service.ts`;
- `src/render/atlas-renderer.ts`,
  `src/view/people-atlas-view.ts`,
  `src/bases/people-atlas-bases-view.ts` and `styles.css`;
- focused form, entrypoint, preset, browser and integration tests;
- the active relationship-editor specification and its terminal ticket, the
  canonical-graph decision, the earlier people-needs research and the P7d
  live-validation research under `.10x/`;
- a read-only Windows app/window inventory and installed Obsidian executable
  metadata;
- current Obsidian Properties help:
  https://obsidian.md/help/properties;
- current Contact Note plugin documentation:
  https://community.obsidian.md/plugins/contact-note;
- current Arcadia Connect plugin documentation:
  https://community.obsidian.md/plugins/arcadia-connect;
- current Obsidian plugin self-critique guidance:
  https://docs.obsidian.md/oo/plugin.

The installed Obsidian executable still reports `1.12.7`, People Atlas 0.2.0
requires `1.13.0`, and Obsidian was not running. Launching or updating it was
outside this read-only review. A valid live flow therefore could not be
captured. The findings below are not a screenshot audit or proof of real
Obsidian Desktop, Mobile, pop-out, theme or assistive-technology behavior.

## Current Workarounds

### Edit an existing relationship

1. Open the Markdown relationship note itself.
2. Open the Command Palette.
3. Run `People Atlas: Edit current relationship`.

This is supported by `src/main.ts`, but no relationship row or graph action
offers the same operation.

### Create and apply a relationship preset

1. Open `Settings -> People Atlas`.
2. Scroll to `Relationship presets`.
3. Choose `Add relationship preset`.
4. Enter a name, generated stable ID, comma-separated relationship types,
   both endpoint roles and a direction, then save.
5. Reopen the create/edit relationship form and select that preset.

The default `relationshipPresets` setting is an empty array. Therefore
`Not linked` is the only possible relationship-form choice until at least one
preset has been created.

A preset is not a live source of relationship meaning. Selecting it copies its
types, direction and endpoint roles into the unsaved form and records the
preset ID as provenance. Later preset changes reach existing linked notes only
after an explicit per-form reapply or reviewed bulk synchronization.

### Edit person profile data

- `Create person`, `Edit current person` and atlas `Edit person` currently
  expose name, read-only path/identity, aliases, organisations, photo and
  linked people.
- `Photo` accepts a manually typed vault path or wikilink.
- Gender, pronouns, birth date, email, phone, job title, address/location,
  website and social profiles have no People Atlas field, parser, domain value
  or mutation support.
- A user can add arbitrary properties directly to the Markdown note through
  Obsidian. People Atlas preserves unrelated frontmatter, but does not index,
  validate, display or edit those values.

## Findings

### 1. Relationship editing exists but its only entrypoint is outside the
visible relationship context

This is the largest immediate UX failure.

- `Edit current relationship` requires the active file to be a canonical
  relationship note.
- Selected-person atlas actions offer `Edit person` and
  `Create relationship`, but no `Open relationship` or `Edit relationship`.
- Relationship descriptions in the shared renderer are plain list-item text.
  They retain no interactive affordance even when an edge has a real
  relationship-note `filePath`.
- The standalone side panel does not list incident relationship notes at all.

The implementation is technically present, but the user has to know the data
model, find the relationship note, open it, and remember a command name. The
user's statement that relationships cannot be edited is therefore a valid
description of the experienced product, not evidence that the mutation
backend is absent.

Recommendation: make every resolved, note-backed relationship shown for a
selected person an actionable row with at least `Open` and `Edit`. Pass the
edge's stable identity/file path; never identify the relationship only by the
two display names. This is smaller and clearer than introducing graph-edge
selection, which the active P3b specification explicitly excluded.

### 2. The preset empty state and vocabulary conceal the actual model

The current UI exposes a selector before teaching the user how choices reach
it. With no presets, the selector contains only `Not linked`; there is no
inline explanation, empty-state action or route to preset management.

The word `linked` also suggests automatic binding. The real contract is:

1. copy types, direction and both roles into the relationship note;
2. retain a preset ID as provenance;
3. allow local divergence;
4. reapply or bulk-sync only after an explicit action.

`Sync from preset` in the relationship modal and `Sync` in Settings are two
different scopes behind the same verb. The former resets unsaved values in one
form; the latter writes reviewed changes to multiple notes.

Recommendation:

- prefer the user-facing term `Relationship template`;
- label the empty value `No template`;
- add helper copy directly below the selector: `Copies type, direction and
  roles. Future template changes are not applied automatically.`;
- if there are no templates, show `No templates yet` and an explicit route to
  create one instead of a dead-looking selector;
- rename the local action to `Reapply template` and the Settings action to
  `Update linked notes (N)`;
- show a natural-language preview using the selected people's names and roles
  before Save.

The persisted property can remain `relationship_preset`; this recommendation
does not require changing Markdown compatibility merely to improve copy.

### 3. The person editor is a narrow schema editor, not yet a useful profile

The editor's supported fields are exactly those in `PersonFormValues`:
name, identity/path, aliases, organisations, photo and linked people. The
absence of gender and birth date is not a hidden-setting problem; those fields
do not exist in the current People Atlas data contract.

The `Photo` field is especially misleading:

- it is a plain text input with no vault-file picker, thumbnail, invalid-path
  feedback beside the field or remove/replace affordance;
- the index resolves the asset and can report a missing-asset diagnostic;
- `AtlasNode` carries `photoPath`;
- the renderer still paints initials and never decodes or renders the photo.

The user can therefore enter a photo reference but receives almost no visible
payoff from People Atlas.

Recommendation: treat profile display and profile editing as one coherent
slice. The smallest useful first profile expansion is:

- photo picker plus preview and actual profile/atlas rendering;
- optional birth date;
- optional pronouns and gender as separate user-authored values;
- email addresses and phone numbers as lists;
- job title/role alongside organisation.

All are optional. Gender must never be inferred, must not drive relationship
roles, and should not be forced into a binary enum. Before implementation,
ratify whether birth date requires a full ISO date or also permits a
month/day-only birthday. Obsidian natively supports date properties stored as
`YYYY-MM-DD`, but a birthday without a known or desired birth year is a
different semantic value.

Address/location, websites and social profiles are reasonable later custom
fields, but should not delay the smaller profile slice. They also increase the
amount of sensitive personal data, so defaults and display surfaces require an
explicit privacy decision.

### 4. The relationship form presents storage mechanics before the user's task

The single-column form contains endpoints, path, relationship ID, preset,
types, two roles, direction, closeness, two dates and status. Technical path
and ID controls appear before the core relationship meaning, and all fields
have equal visual weight.

Recommendation: group the form into:

1. `People` — actual person names, not only `Person A` and `Person B`;
2. `Relationship` — template/type and a natural-language role preview;
3. `Context` — closeness, since, last contact and status;
4. collapsed `Advanced` — path, stable ID, raw direction and role overrides.

Keep the reviewable path and stable identity contract, but do not make ordinary
users interpret them before defining the relationship. Keep Save/Cancel
visible while scrolling on narrow/mobile layouts.

### 5. `Contacts` means two incompatible things in this product context

In the person editor, `Contacts` is a list of other person notes that produces
lightweight inferred graph edges. In ordinary contact-management language,
users expect contact details such as email and phone. The product also has
rich, explicit relationship notes, so users must additionally guess whether
to add someone under `Contacts` or create a relationship.

Recommendation: rename this person field to `Linked people` or
`Simple connections` and explain:

`Use this for an untyped connection. Create a relationship when you need
type, roles, dates, closeness or status.`

Email and phone belong in a separate `Contact details` group. Do not silently
upgrade existing lightweight links into rich relationship notes.

### 6. The forms have good safety primitives but avoidable accessibility risks

Confirmed source-level strengths:

- native inputs, selects and buttons;
- associated visible labels;
- explicit Save and Cancel;
- alert/live regions for failures;
- initial modal focus;
- write-free cancellation and single-flight submission;
- owning-document rather than global-window DOM creation.

Source-level risks:

- helper descriptions are visually adjacent but not connected with
  `aria-describedby`;
- selecting or reapplying a preset rebuilds the entire form and returns focus
  to `Person A`, which is likely disorienting for keyboard and assistive-
  technology users;
- native `datalist` controls expose file paths as values and have
  environment-dependent desktop/mobile behavior;
- the long relationship form has no sections or persistent action area;
- the preset-management modal has labels but little instruction about comma
  separation, role perspective, copied values or synchronization;
- there is browser coverage for part of the person modal, but no equivalent
  rendered browser coverage for the relationship or preset modals.

These are risks, not live WCAG failures. Real Obsidian Desktop, Mobile, themes,
zoom and assistive technology remain untested.

### 7. Documentation and language are inconsistent at exactly the confusing
point

The English README explains that a preset copies values and is not a live
source of truth. The Dutch README omits the relationship data-model and preset
explanation. UI labels and commands are English even when the user follows the
Dutch README.

Recommendation: add the same concise mental model and setup route to the Dutch
README, then either keep the whole product explicitly English or introduce
proper localized UI strings. A documentation fix helps, but does not replace
the missing inline empty-state guidance.

### 8. Recency is stored but not operationalized

People Atlas can store `last_contact`, but it has no quick `Log contact`
action, interaction history, next-follow-up value or due view. The earlier
project research identified recency and follow-up as recurring user needs.
Current Contact Note and Arcadia Connect documentation also foregrounds
profile cards/contact details and last-interaction/follow-up workflows.

Recommendation: keep this behind the editability, preset and profile work.
After those foundations are usable, shape one small interaction/follow-up
slice instead of expanding immediately into a general CRM or automated status
inference. `last_contact` remains an observation and must not silently change
relationship status.

## Priority Order

### P0 — Make existing capabilities understandable and reachable

1. Add `Open` and `Edit` actions to each real relationship shown for a person.
2. Replace the preset dead end with explanatory empty state, creation route
   and copy-not-live terminology.
3. Clarify the distinction between linked people and rich relationships.

### P1 — Make the person profile deliver visible value

4. Implement photo selection, preview and rendering as one complete slice.
5. Shape and add the smallest optional profile set: birth date,
   pronouns/gender, email/phone and job title.
6. Reorganize both editors around user concepts, with technical fields under
   Advanced and no full-form focus-reset on preset changes.

### P2 — Round out daily use and evidence

7. Shape a bounded contact-moment/follow-up workflow without status inference.
8. Bring Dutch documentation/UI terminology to parity.
9. Run live Obsidian Desktop/Mobile, zoom/theme and assistive-technology
   validation on a compatible disposable vault.

## Conclusions

The user is not overlooking a hidden workflow. Three different product gaps
are being experienced:

- relationship editing is implemented but not exposed where relationships are
  seen;
- presets require prior Settings configuration and use a copy/sync model that
  `Not linked` does not explain;
- the person editor supports a deliberately small schema, and even its photo
  field is not rendered by the atlas.

The smallest high-impact response is not a broad CRM expansion. First make
existing relationships directly editable, make the preset/template model
self-explanatory, and make photos visible. Then ratify a focused optional
profile schema and restructure the long forms.

No spec or ticket was opened during the initial research pass because the
recommended behavior, field semantics and terminology were not yet
user-ratified. The later shaping checkpoint and ratification below supersede
that initial open-decision state.

## Requested Shaping Expansion

The user subsequently asked to work out all seven recommendations so that they
can be implemented later. The smallest coherent decomposition is four product
contracts rather than seven isolated features:

1. **Relationship context actions** covers recommendation 1: each note-backed
   relationship shown for a person gets direct `Open` and `Edit` actions.
2. **Relationship template and form experience** covers recommendations 2 and
   5: understandable template terminology and empty states, preservation of
   the copy-not-live contract, and a form organized around user concepts with
   technical fields under `Advanced`.
3. **Person profile experience** covers recommendations 3, 4 and 6: a complete
   photo workflow, deliberately optional profile/contact fields, and an
   explicit distinction between `Linked people` and rich relationship notes.
4. **Contact moments and follow-up** covers recommendation 7: explicit
   Markdown-first interaction history and due follow-up without relationship
   status inference.

After ratification, each net-new behavior needs a focused active spec. A
separate non-executable parent plan should map the seven recommendations to
bounded child tickets; photo asset handling/rendering and profile
schema/editor work should remain separate implementation tickets even if one
person-profile spec owns their shared user contract. Contact moments/follow-up
must not be hidden inside the existing relationship editor ticket because it
introduces a new entity and lifecycle.

Three bundled semantic choices were presented for ratification:

1. Present `Relationship template` to users while retaining
   `relationship_preset` in stored data; add direct row `Open`/`Edit`, defer
   graph-edge selection, retain copied values until an explicit reapply/sync,
   and organize the editor as `People`, `Relationship`, `Context` and
   `Advanced`.
2. Keep all new profile fields optional and configurable; use separate
   user-authored pronouns and gender, list-valued email and phone, and a text
   job title. Start with a full ISO birth date unless a yearless birthday is a
   real need, in which case use a distinct property. Treat photo as one
   end-to-end slice with a vault picker, preview, visible profile image and
   initials fallback; graph-avatar rendering needs its own bounded behavior
   and implementation ticket.
3. Make a contact moment a separate Markdown note linked to one or more people
   and optionally to a relationship. A `Log contact` confirmation may
   explicitly update that relationship's `last_contact`; follow-up remains
   user-authored and appears in due/overdue views. Defer operating-system
   reminders and never infer relationship status.

## Ratified Decisions

On 2026-07-30 the user ratified:

1. The complete recommended relationship-UX bundle: user-facing
   `Relationship template` terminology with persisted
   `relationship_preset` compatibility, direct actions on note-backed
   relationship rows, no graph-edge-selection prerequisite, explicit
   copy/reapply behavior and the proposed form sections.
2. One configurable `birth_date` property in which the year is optional.
   The technical encoding is a quoted text value: `YYYY-MM-DD` when the year
   is known and `--MM-DD` when it is not. Both forms represent one semantic
   field; no synthetic year or automatic age is introduced.
3. The complete recommended contact-moment/follow-up bundle: separate
   Markdown notes, explicit optional `last_contact` updates, user-authored
   due/overdue follow-up, no operating-system reminders in the first slice
   and no relationship-status inference.

The remaining profile recommendations are included in the ratified bundle:
photo, pronouns, gender, email addresses, phone numbers and job title are
optional; photo selection, preview, profile presentation and graph-avatar
fallback form one user contract but may be split into bounded implementation
tickets. `Contacts` is presented as `Linked people`, while email and phone
appear under `Contact details`.

## Shaping Records Opened

Active specifications:

- `.10x/specs/relationship-context-actions.md`;
- `.10x/specs/relationship-template-form-experience.md`;
- `.10x/specs/person-profile-experience.md`;
- `.10x/specs/contact-moments-follow-up.md`.

Non-executable parent plan:

- `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`.

Bounded future implementation tickets:

- `.10x/tickets/2026-07-30-relationship-context-actions.md`;
- `.10x/tickets/2026-07-30-relationship-template-form-experience.md`;
- `.10x/tickets/2026-07-30-person-profile-schema-editor.md`;
- `.10x/tickets/2026-07-30-person-photo-picker-profile.md`;
- `.10x/tickets/2026-07-30-graph-photo-avatars.md`;
- `.10x/tickets/2026-07-30-contact-moment-notes.md`;
- `.10x/tickets/2026-07-30-contact-follow-up-views.md`.

All tickets remain unimplemented and require later explicit authorization.

## Limits

- No valid screenshot or live Obsidian flow was captured.
- Source inspection shows discoverability and semantic mismatches, but cannot
  measure task time, visual density, theme contrast, zoom/reflow, mobile
  ergonomics, screen-reader output or actual `datalist` behavior.
- Comparative plugin documentation identifies common patterns, not a mandate
  to copy another product or evidence of People Atlas user demand at scale.
- The field recommendations intentionally omit automatic inference, contact
  syncing, reminders, AI and broad CRM scope until the existing core flow is
  usable and separately shaped.

## Perspective-oriented relationship supersession checkpoint

On 2026-07-30 the user explicitly chose a perspective-oriented relationship
experience and stated that backward compatibility is not required. The user
approved removing `direction` entirely rather than hiding it as an advanced
field.

This ratification conflicts with active records that still make direction
normative:

- `.10x/decisions/canonical-graph-source.md`;
- `.10x/specs/canonical-graph-source.md`;
- `.10x/specs/relationship-editor-ui.md`;
- `.10x/specs/accessible-semantic-renderer.md`;
- `.10x/specs/relationship-template-form-experience.md`;
- `.10x/specs/relationship-context-actions.md`;
- `.10x/tickets/2026-07-30-relationship-template-form-experience.md`.

Those records must be superseded or narrowed before their affected tickets
can execute. Accepted decisions are not edited in place.

Current source inspection shows that `direction` is carried through settings,
parsing, domain records, graph snapshots, mutations, forms, templates,
synchronization, documentation and tests. Its only observed product-semantic
branch after graph construction is the roleless renderer fallback
`Connected` versus `Incoming`/`Outgoing`; graph resolution and traversal use
the two endpoints as adjacency and do not branch on direction. This supports
removing direction while retaining `from` and `to` as stable endpoint slots
for paired `from_role` and `to_role` metadata.

Three product choices remain open before a replacement contract can become
executable:

1. how the plugin identifies the user's own canonical person and behaves when
   that identity is unset or unresolved;
2. how endpoint slots, labels and templates behave for self relationships and
   relationships between two other people;
3. whether removing compatibility means ignoring legacy `direction`
   frontmatter safely, explicitly deleting it from vault notes, or refusing
   legacy notes.

No product code, tests, governing spec, accepted decision or executable ticket
was changed in this checkpoint.

## Perspective checkpoint resolution

The user answered all three blockers on 2026-07-30:

1. approved one stable explicit-ID `My person` setting, separate from current
   graph-center navigation, with neutral no-guess fallback;
2. approved self-first but non-self-only creation, editable endpoint slots,
   no automatic endpoint/role reordering and neutral roleless descriptions;
3. selected option 3A: remove direction from current People Atlas behavior and
   settings while preserving legacy relationship-note direction properties as
   ignored, unowned YAML.

The superseding active authority is now:

- `.10x/decisions/perspective-oriented-relationship-model.md`;
- `.10x/specs/perspective-relationship-foundation.md`;
- `.10x/specs/perspective-relationship-editor-templates.md`.

The former canonical directional decision and the former relationship
editor/template specifications are superseded. The unimplemented
direction-bearing UX2 ticket is cancelled.

Replacement execution owners:

1. `.10x/tickets/2026-07-30-perspective-relationship-foundation.md`;
2. `.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md`,
   dependent on the foundation.

No product code, test, build, generated artifact, vault note or external state
was changed while recording this resolution.
