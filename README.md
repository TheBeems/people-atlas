# People Atlas

[Nederlands](README.nl.md)

People Atlas maps people, explicit relationships, and unresolved contacts stored as Markdown in your vault. It provides a standalone interactive atlas and a custom Bases view backed by the same indexed graph.

> [!IMPORTANT]
> People Atlas requires Obsidian 1.13.0 or newer. Obsidian 1.12.x and older are not supported.

## Features

- Stable person identities through an explicit `person_id`, with a normalized file-path fallback.
- Dedicated relationship notes with stable IDs, direction, types, closeness, dates, and status metadata.
- Wikilink-based contact resolution without matching people by display name.
- An incremental vault index that reparses changed files without rescanning the whole vault.
- A standalone graph view and custom Bases view using the same graph snapshot.
- Deterministic layout, pan, zoom, node dragging, touch gestures, and a keyboard-accessible list view.
- Explicit relationship creation and editing with validation before any vault write.
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

1. Open **Settings → People Atlas** and review the People folder and property names. The default People folder is `People/`.
2. Add `type: person` and a stable `person_id` to person notes, or adapt the configured property names to your existing schema.
3. Run **People Atlas: Open atlas** from the Command Palette.
4. Create a relationship through **People Atlas: Create relationship**, or select a person in either atlas and choose **Create relationship**.
5. Run **People Atlas: Edit current relationship** while a relationship note is active to update supported metadata.

Relationship notes default to `People/Relationships/<Person A> - <Person B>.md`. The proposed path is reviewable, and existing notes are never overwritten.

Typing `@` opens person suggestions. Choosing an existing person inserts a stable wikilink. Choosing the explicit create option makes a new person note; typing alone never creates one.

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
contacts:
  - "[[Bob Example]]"
photo: "[[Attachments/alice.jpg]]"
---
```

Example relationship:

```yaml
---
type: relationship
relationship_id: alice-bob-friend
from: "[[Alice Example]]"
to: "[[Bob Example]]"
direction: undirected
relationship_types:
  - friend
  - colleague
closeness: 4
since: 2018-03-01
last_contact: 2026-07-18
status: active
---
```

Additional examples are available under [`examples/`](examples/).

## Privacy and data access

- People Atlas does not use network access.
- People Atlas does not collect telemetry or analytics.
- People Atlas does not require an account or payment.
- People Atlas does not access files outside your vault.
- It reads Markdown files and cached metadata inside the vault to build its index.
- It creates or updates person and relationship notes only after an explicit user action and validation.
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
