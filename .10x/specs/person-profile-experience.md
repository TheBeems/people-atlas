Status: active
Created: 2026-07-30
Updated: 2026-07-31

# UX3–UX5 — Optional person profiles and complete photo experience

## Purpose

Let users maintain a useful but deliberately small person profile and make the
existing `photo` property visibly valuable. The current person editor exposes
name, aliases, organisations, a manually typed photo reference and simple
person links labelled `Contacts`. It has no birth date, pronouns, gender,
email, phone or job title, and the renderer carries `photoPath` but always
paints initials.

This specification adds optional, user-authored profile data; distinguishes
contact details from simple linked people; and defines photo selection,
preview, selected-person presentation and graph-avatar fallback as one user
contract. Implementation is intentionally split into profile/editor, photo
selection/profile presentation and graph-avatar tickets because they touch
different architecture and risk boundaries.

## Scope

This specification governs:

- configurable person properties for birth date, pronouns, gender, email
  addresses, phone numbers and job title;
- parsing, diagnostics, mutation, settings migration and Bases mappings for
  those fields;
- the exact optional-year `birth_date` encoding;
- person-form grouping and validation;
- `Linked people` and `Contact details` terminology;
- selected-person profile presentation in standalone and Bases surfaces;
- a searchable vault-image picker, preview and missing-image behavior;
- circular graph avatars, initials fallback and a bounded window-owned image
  lifecycle.

## Data contract

### Settings and defaults

1. `PeopleAtlasSettings` MUST add configurable property names with these
   defaults:

   | Setting | Default frontmatter property | Value |
   | --- | --- | --- |
   | `birthDateProperty` | `birth_date` | one optional-year date string |
   | `pronounsProperty` | `pronouns` | optional free text |
   | `genderProperty` | `gender` | optional free text |
   | `emailsProperty` | `emails` | optional list of strings |
   | `phonesProperty` | `phones` | optional list of strings |
   | `jobTitleProperty` | `job_title` | optional free text |

2. The existing defaults remain:
   - `photoProperty: photo`;
   - `contactsProperty: contacts`.
3. Settings UI MUST present `contactsProperty` as
   `Linked people property`. It MUST explain that this is a list of simple
   person-note connections, not email addresses, phone numbers or rich
   relationship notes.
4. Loading older plugin data MUST add the new default mappings through one
   validated schema migration. The migration MUST NOT rewrite vault notes.
5. The configured person properties used by People Atlas MUST be non-empty.
   Identity/type/name properties and all profile properties within a person
   note MUST be distinct so saving one field cannot overwrite another.
6. Standalone index parsing and Bases entry mapping MUST use the configured
   property names. Bases options MUST expose corresponding property selectors
   and both views MUST produce the same extended `AtlasSnapshot` person
   contract.

### Optional field semantics

7. Every new profile field is optional. Missing or cleared fields MUST be
   omitted from People Atlas writes rather than written as empty strings or
   empty arrays.
8. Pronouns and gender are separate, user-authored text values. The plugin
   MUST NOT:
   - infer either value;
   - constrain either to a fixed enum;
   - derive relationship existence, stored roles, types or status from either;
     or
   - change arbitrary/custom relationship presentation from either.

   As the sole bounded exception, explicit gender MAY refine presentation of
   the stored canonical `parent`, `child` and `sibling` roles under
   `.10x/specs/simple-relationship-automation.md`. It MUST NOT mutate the
   relationship note or person profile.
9. Job title is optional user-authored text and remains distinct from the
   existing list of organisations.
10. Email addresses are an ordered list of trimmed strings. The editor MUST
    reject entries that lack a non-whitespace local part, one `@`, and a
    non-whitespace domain, but MUST NOT attempt complete RFC mailbox
    validation. Duplicate entries are compared case-insensitively.
11. Phone numbers are an ordered list of trimmed strings. The editor MUST
    preserve user formatting and international prefixes and MUST NOT infer a
    country, reformat, validate ownership or remove meaningful punctuation.
    Exact trimmed duplicates are rejected.
12. Parsed invalid email or birth-date values MUST NOT make the person
    disappear from the index. They produce a source-path diagnostic, remain
    untouched until the user explicitly edits them and are excluded from the
    validated structured value used by the profile display.

### Optional-year birth date

13. `birth_date` is one semantic text property with exactly two accepted
    serialized forms:
    - `YYYY-MM-DD` when the year is known;
    - `--MM-DD` when the year is unknown or intentionally omitted.
14. People Atlas writes the value as a quoted YAML string so both forms retain
    one text type and a full date is not silently coerced into a different
    property type.
15. A full date MUST contain a four-digit year from `0001` through `9999` and
    a valid Gregorian month/day combination, including leap-year validation.
16. A yearless date MUST contain a valid month/day combination.
    `--02-29` is valid because that birthday occurs in leap years.
17. `MM-DD`, `YYYY`, zero dates, synthetic years such as `0000`, locale-
    formatted dates and timestamps are invalid. The plugin MUST NOT guess
    which component is missing.
18. The person form MUST present month and day plus a clearly optional
    four-digit year. Clearing only the year converts a valid full value to
    `--MM-DD`; clearing the complete control removes the property.
19. The profile display MUST distinguish a missing year without inventing
    one. It MUST NOT calculate or display age in this slice.
20. Because optional-year values are stored as text, native Obsidian
    date-property behavior and chronological year sorting are not promised.
    Birthday reminders, upcoming-birthday views and age calculations remain
    separate future behavior.

## Person form experience

21. Create and edit MUST continue to use one plugin-owned person form and the
    existing safe mutation/rename boundary.
22. The form MUST be organized in this order:

    1. `Basic`
       - name;
       - photo;
       - aliases.
    2. `Profile`
       - birth date;
       - pronouns;
       - gender;
       - job title;
       - organisations.
    3. `Contact details`
       - email addresses;
       - phone numbers.
    4. `Linked people`
       - the existing validated canonical-person picker and unresolved-value
         preservation behavior.
    5. `Advanced`
       - destination/current path;
       - person ID and its source.

23. `Advanced` MAY be collapsed by default, but create destination changes and
    rename confirmation MUST remain reviewable before save. Invalid advanced
    fields open the disclosure and expose their errors.
24. `Linked people` help text MUST say:
    - links are stored on the person note as simple connections;
    - new links must resolve to one canonical, non-self person;
    - unresolved existing values are preserved until explicitly removed; and
    - roles, dates, status and other rich metadata require
      `Create relationship`.
25. Email and phone list controls MUST support add/remove without requiring a
    comma-delimited mini-language. Error messages identify the specific
    entry; deleting one entry does not reorder the rest.
26. Invalid raw profile data loaded from an existing note MUST remain visible
    with an inline explanation. An unchanged invalid raw field MUST be omitted
    from the update so unrelated valid changes can still be saved without
    deleting or normalizing it. Changing that field to another invalid value
    MUST block Save until it is corrected or explicitly cleared.
27. Save MUST build changed-field-only updates, validate before the first
    write, preserve unrelated frontmatter/body and keep the existing
    same-folder rename confirmation and partial-failure behavior.
28. Cancel, Escape and close remain write-free; pending submission remains
    single-flight.

## Profile presentation

29. Selecting a canonical person MUST show a compact profile card in the
    semantic details panel and graph details sheet in both standalone and
    Bases.
30. The card shows only present values, in this order:
    - photo/name;
    - pronouns;
    - job title and organisations;
    - birth date;
    - gender;
    - email addresses and phone numbers.
31. Empty labels or placeholder rows MUST NOT create visual noise. The person's
    name remains the heading and stable identity/path are not exposed as
    profile content.
32. Contact details MUST appear only in the selected-person details surfaces.
    They MUST NOT be added to canvas labels, list accessible names, diagnostic
    summaries or relationship descriptions.
33. Email and phone values MAY use explicit `mailto:` and `tel:` anchors.
    Activating one is always a user action; People Atlas performs no message,
    call, sync or external lookup itself.
34. Incident connections MUST be grouped or visibly labelled as:
    - `Relationships` for real note-backed relationship entities; and
    - `Linked people` for inferred simple person-note links.
35. A simple linked person MUST NOT be presented as if it supported roles,
    status, dates or relationship-note edit actions.

## Photo selection and profile image

36. The photo field MUST provide a searchable plugin-owned picker backed only
    by image files currently present in the vault. Display labels may use file
    names, but the stored target is the resolved vault-relative path.
37. The first supported raster extensions are `.png`, `.jpg`, `.jpeg`,
    `.webp`, `.gif` and `.avif`. SVG and external/network URLs are excluded
    from the picker in this slice.
38. Selecting an asset MUST write a canonical vault wikilink such as
    `[[Attachments/alice.jpg]]`. Existing manually authored vault paths or
    wikilinks remain readable and are preserved byte-for-byte when unchanged.
39. The picker MUST NOT copy, move, rename or delete the asset. It only
    updates the configured photo reference after explicit person-form Save.
40. The form MUST show an immediate preview of the currently resolved image.
    A missing, unsupported or undecodable asset shows a visible fallback and
    explanation; it MUST NOT fetch a remote replacement.
41. Clearing the photo removes only the configured photo property after Save.
42. The selected-person profile card MUST display a resolved photo with a
    center-cropped, non-distorted presentation. Adjacent visible person text
    means the image uses empty alternative text to avoid duplicate screen-
    reader announcements.
43. Before photo data is ready, after failure, or when no photo is set, the
    existing deterministic initials remain the fallback.

## Graph avatar and image lifecycle

44. A resolved person with a usable photo MUST render that photo clipped
    inside the existing circular graph node. Selection/center rings, labels,
    hit targets and node radius MUST remain unchanged.
45. Ghost and ambiguous nodes MUST never load or display person photos.
46. Image loading MUST be asynchronous and MUST NOT block snapshot
    projection, layout, pointer handling or the first graph paint. The graph
    first renders initials and redraws the still-current node when its image
    becomes ready.
47. The decoder/cache MUST use the renderer container's owning `Window`, not a
    global `window`.
48. Each renderer/window-owned cache MUST be bounded to:
    - at most 64 ready thumbnails; and
    - at most 256 by 256 decoded pixels per thumbnail.

    This bounds ready pixel storage to approximately 16 MiB before browser
    overhead. Full-resolution source images MUST NOT remain retained by the
    cache after thumbnail creation.
49. Cache identity MUST include normalized vault path and asset modification
    state. Asset modify, rename and delete events MUST invalidate affected
    entries and request a redraw only when the renderer is still alive.
50. Least-recently-used ready entries MAY be evicted. Pending/error entries
    MUST also be bounded so a broken vault cannot grow memory without limit.
51. Destroying a renderer MUST cancel/ignore late completions, detach
    listeners and release its cached image resources. One pop-out/window MUST
    NOT reuse DOM/image objects owned by another window.
52. Decode failure, deletion during load, rapid photo changes and cache
    eviction MUST all fall back to initials without unhandled rejection or
    renderer failure.
53. Animated formats render a stable decoded thumbnail; continuous animation
    is not required.

## Scenarios

### Save a full birth date

Given month 7, day 30 and year 1990 are entered
When the person is saved
Then the configured property is written as the quoted text
`"1990-07-30"`.

### Save a birthday without a year

Given month 7 and day 30 are entered and year is blank
When the person is saved
Then the same configured property is written as `"--07-30"` and no synthetic
year or age is created.

### Preserve invalid legacy data

Given an existing person note contains `birth_date: July 30`
When the index and person editor load it
Then the person remains available, a diagnostic and inline error identify the
invalid value, and saving an unrelated alias does not erase it.

### Distinguish two meanings of contact

Given Alice has an email address and Bob in the configured `contacts` property
When Alice's profile opens
Then the email appears under `Contact details`, Bob appears under
`Linked people`, and neither is confused with a rich relationship note.

### Select and preview a photo

Given a supported image exists in the vault
When the user selects it in the person editor
Then a preview appears immediately, no asset is moved and only an explicit
Save writes its canonical wikilink.

### Fall back after deletion

Given Alice's graph avatar has loaded
When the photo asset is deleted
Then the affected cache entry is invalidated, Alice falls back to initials and
the missing-asset diagnostic remains navigable without breaking the graph.

## Acceptance criteria

- [x] Settings migration adds six configurable profile property mappings
      without rewriting person notes.
- [x] Parser, domain, index, graph projection and Bases mapping carry optional
      profile values through one shared snapshot contract.
- [x] `birth_date` accepts and writes only quoted `YYYY-MM-DD` or `--MM-DD`
      with calendar-valid month/day semantics.
- [x] Pronouns, gender and job title remain optional free text and influence
      no relationship existence or stored-role inference. The only
      presentation exception is governed by
      `.10x/specs/simple-relationship-automation.md`.
- [x] Email/phone lists have the specified minimal validation, duplicate and
      formatting behavior.
- [x] The person form uses the five sections, preserves existing identity/
      rename safety and shows invalid raw values without silent cleanup.
- [x] UI and settings distinguish `Contact details`, `Linked people` and
      note-backed `Relationships`.
- [x] Selected-person details show only present profile values and keep
      contact details out of graph labels and broad accessible names.
- [x] The vault-image picker, preview, clearing and unchanged-raw-reference
      behavior are explicit and write only on Save.
- [x] Profile and graph photo failures always use initials fallback and never
      fetch external URLs.
- [x] Graph images use a window-owned asynchronous cache bounded to 64
      thumbnails at 256 by 256 pixels, with lifecycle invalidation/cleanup.
- [x] Pure tests cover settings migration, property collisions, date
      round-trip/calendar edges, email/phone values, changed-field updates and
      parser diagnostics.
- [x] Browser tests cover form grouping, list controls, photo picker/preview,
      profile disclosure, privacy of accessible names and missing-image
      fallback.
- [x] Renderer/browser tests cover initial paint, loaded avatar, high-DPI
      crop/rings, failure, asset invalidation, eviction, late completion and
      pop-out owning-window isolation.
- [x] A photo-populated performance fixture records first-paint, settled
      redraw and retained-cache observations without claiming live Obsidian
      Mobile proof.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Exclusions

- Inferring gender, pronouns, relationship existence, stored relationship
  roles or kinship edges. The bounded presentation-only family terms for
  explicit canonical roles are governed by
  `.10x/specs/simple-relationship-automation.md`.
- Fixed gender/pronoun taxonomies.
- Age calculation, birthday notifications or upcoming-birthday projections.
- Postal address, social media, employer history, biography, custom arbitrary
  profile-field builders or external contact synchronization.
- Contact-detail discovery, validation through network services or sending
  email/SMS/calls.
- Remote image URLs, downloading/copying assets, photo editing/cropping,
  face detection or SVG rendering.
- Adding contact moments/follow-ups; they have their own specification.
- Claiming Chromium automation proves Obsidian Desktop/Mobile, assistive
  technology or real-vault asset behavior.

## Ratified decisions

1. The initial optional profile contains photo, `birth_date`, pronouns,
   gender, email addresses, phone numbers and job title.
2. `birth_date` is one property whose year is optional. The unambiguous stored
   forms are `YYYY-MM-DD` and `--MM-DD`.
3. `Contacts` is presented as `Linked people`; email and phone are separate
   contact details.
4. Photo selection, preview, selected-person presentation and graph avatar
   belong to one user contract with explicit fallback/loading/mobile
   behavior, but implementation may be split by architecture boundary.
5. User-ratified on 2026-07-31: gender remains optional free text but may
   refine only the displayed term for explicit canonical Parent, Child and
   Sibling roles, with neutral fallback and no relationship-note write.

## References

- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/performance-characterization.md`
- `.10x/specs/simple-relationship-automation.md`
- `src/settings/types.ts`
- `src/settings/defaults.ts`
- `src/settings/validate.ts`
- `src/domain/types.ts`
- `src/index/frontmatter.ts`
- `src/editor/person-form.ts`
- `src/editor/person-modal.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/bases/entry-adapter.ts`
- `src/render/atlas-renderer.ts`
