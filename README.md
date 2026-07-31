# People Atlas

[Nederlands](README.nl.md)

People Atlas maps people, explicit relationships, and unresolved person links stored as Markdown in your vault. It provides a standalone interactive atlas and a custom Bases view backed by the same indexed graph.

> [!IMPORTANT]
> People Atlas requires Obsidian 1.13.0 or newer. Obsidian 1.12.x and older are not supported.

## Features

- Stable person identities through a required explicit `person_id`.
- Dedicated direction-free relationship notes with stable IDs, endpoint roles, types, closeness, dates, and status metadata.
- Wikilink-based linked-person resolution without matching people by display name.
- An incremental vault index that reparses changed files without rescanning the whole vault.
- A standalone graph view and custom Bases view using the same graph snapshot.
- Deterministic layout, pan, zoom, node dragging, touch gestures, and a keyboard-accessible list view.
- Curated person creation and editing for names, aliases, organisations, photos, optional profile details, and
  validated linked people.
- Vault-only photo selection and profile images, plus bounded graph avatars
  with deterministic initials fallback.
- Separate contact details (email addresses and phone numbers), simple Linked people, and note-backed
  Relationships without inferring meaning between them.
- Explicit relationship creation and editing with validation before any vault write.
- Separate contact-moment Markdown notes with one shared Log/Edit flow,
  optional follow-up metadata, and explicit unchecked monotonic
  `last_contact` advancement, plus selected-person history and an explicit
  Follow-ups view.
- `@` suggestions that insert stable wikilinks and create person notes only after an explicit choice.
- Diagnostics for duplicate IDs, unresolved wikilinks, and broken relationship endpoints.

## Compatibility

- Requires Obsidian 1.13.0 or newer.
- Declares desktop and mobile compatibility with `isDesktopOnly: false`.
- Production code does not depend on Node.js or Electron APIs.
- Uses the declarative settings and custom Bases APIs introduced in Obsidian 1.13.

The initial Community Plugins submission will be made only after Obsidian 1.13 reaches public availability.

## Installation

### Community Plugins

After People Atlas is listed:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for **People Atlas**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the matching [GitHub Release](https://github.com/TheBeems/people-atlas/releases).
2. Create this folder inside your vault:

   ```text
   <Vault>/.obsidian/plugins/people-atlas/
   ```

3. Place the three downloaded files in that folder.
4. Reload Obsidian and enable **People Atlas** under Community plugins.

## Usage

1. Open **Settings → People Atlas** and review the People folder and property names. The default People folder is `People/`. Optionally select **My person** by stable `person_id`; this perspective is independent from the current graph center.
2. Add `type: person` and a stable `person_id` to person notes, or adapt the configured property names to your existing schema.
3. Run **People Atlas: Open atlas** from the Command Palette.
4. Run **People Atlas: Create person**, or use **Edit current person** while a person note is active. A selected resolved person can also be edited from either atlas.
5. Create a relationship through **People Atlas: Create relationship**, or select a person in either atlas and choose **Create relationship**.
6. Run **People Atlas: Edit current relationship** while a relationship note is active to update supported metadata.
7. Run **People Atlas: Log contact** globally or from a selected canonical
   person. Use **Edit current contact moment** while a contact-moment note is
   active.
8. Run **People Atlas: Open follow-ups** to review Overdue, Due today, and
   Upcoming work and explicitly mark a follow-up done or dismissed.

Relationship notes default to `People/Relationships/<First person> - <Second person>.md`. The proposed path is reviewable, and existing notes are never overwritten.

Typing `@` opens person suggestions. Choosing an existing person inserts a stable wikilink. Choosing the explicit create option makes a new person note; typing alone never creates one.

The person editor groups supported fields into **Basic**, **Profile**,
**Contact details**, **Linked people**, and **Advanced**, while preserving
unrelated frontmatter. `birth_date` accepts a full `YYYY-MM-DD` value or
`--MM-DD` when the year is unknown. Invalid manually authored values are
reported as diagnostics and are never coerced. Changing a person's name proposes a filename change in the
current folder and requires a separate confirmation. Obsidian updates links
according to the vault's automatic-link-update setting. Obsidian's native
**Add property** menu remains vault-wide and can still show relationship
properties.

## Data model

Example person:

```yaml
---
type: person
person_id: alice-example
name: Alice Example
aliases:
  - Alice
organisations:
  - Example Foundation
birth_date: "--07-30"
pronouns: she/her
gender: woman
job_title: Engineering lead
emails:
  - alice@example.com
phones:
  - "+31 6 12 34 56 78"
contacts:
  - "[[Bob Example]]"
photo: "[[Attachments/alice.jpg]]"
---
```

`emails` and `phones` are contact details. The configured `contacts` property
stores simple links shown as **Linked people**. Roles, dates, status, and other
rich metadata belong in separate relationship notes.

Example relationship:

```yaml
---
type: relationship
relationship_id: alice-bob-friend
from: "[[Alice Example]]"
to: "[[Bob Example]]"
relationship_preset: friendship
relationship_types:
  - friend
  - colleague
from_role: Friend
to_role: Friend
closeness: 4
since: 2018-03-01
last_contact: 2026-07-18
status: active
---
```

`relationship_preset`, `from_role`, and `to_role` are optional. A relationship
template is input convenience, not a live link: applying one copies its types,
first-person role, and second-person role into the relationship note. Deleting
or changing the template leaves those copied values intact. The explicit
**Update linked relationships from template** action previews exact note paths
before copying updated template values.

When **My person** resolves, a new relationship normally places that person
first, so a template's first-person role normally becomes **My role**. Both
people remain editable, and the same templates work for relationships between
any two other people. Roles stay paired with the first and second person without
hidden swapping. Define both endpoint roles or neither. With complete roles,
the selected endpoint is rendered through the configurable
`{role} of {person}` format; otherwise People Atlas uses the neutral
`Connected to <person>` description. Stored `from` and `to` values keep their
first/second positions; they are not arrows or hierarchy. Unowned frontmatter
is ignored and left untouched. Templates never infer gender, kinship, or roles
from person names or other relationships.

Example contact moment:

```yaml
---
type: contact_moment
contact_moment_id: contact-20260730-alice
people:
  - "[[Alice Example]]"
relationship: "[[Relationships/Alice and Bob]]"
occurred_on: 2026-07-30
channel: call
summary: Discussed the project handover
follow_up_on: 2026-08-03
follow_up_status: open
---
```

Contact moments remain independent notes with a free Markdown body. Linking a
canonical relationship does not change it by itself. The optional
`last_contact` checkbox starts unchecked and only advances an older date; it
never changes relationship status, roles, types, or template metadata.
Selecting a canonical person shows bounded recent history and its next open
follow-up. The Follow-ups view groups open work by local calendar date;
done/dismissed actions update only that moment's configured status property.

Additional examples are available under [`examples/`](examples/).

## Privacy and data access

- People Atlas does not use network access.
- People Atlas does not collect telemetry or analytics.
- People Atlas does not require an account or payment.
- People Atlas does not access files outside your vault.
- It reads Markdown files and cached metadata inside the vault to build its index.
- It creates or updates person, relationship, and contact-moment notes only
  after an explicit user action and validation.
- It stores plugin settings and view state through Obsidian's plugin data API.

## Development

Requirements:

- Node.js 22.
- Obsidian 1.13.0 or newer for integration testing.

Install dependencies and start the development build:

```bash
npm ci
npm run dev
```

Copy or symlink the repository into `<Vault>/.obsidian/plugins/people-atlas`, reload Obsidian, and enable the plugin.

Before committing:

```bash
npm run dependency:audit
npm run check
npm run verify:reproducible
```

`npm run check` covers formatting, lint, types, tests, the production build, release metadata, bundle size, and the Community Plugins readiness contract. `npm run community:check` can run the directory-specific contract separately.

The release tag must exactly match `manifest.json.version` without a `v` prefix. The release workflow verifies the remote tag revision, repeats the build gates, attests the artifacts, and attaches only `main.js`, `manifest.json`, and `styles.css`.

## Support

Report reproducible bugs and feature requests through [GitHub Issues](https://github.com/TheBeems/people-atlas/issues). Include the People Atlas version, Obsidian version, platform, and minimal reproduction steps. Do not include private vault content.

See [`ARCHITECTURE.md`](ARCHITECTURE.md), [`ROADMAP.md`](ROADMAP.md), and [`AGENTS.md`](AGENTS.md) before making larger changes.
