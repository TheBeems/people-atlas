# People Atlas

People Atlas is an Obsidian 1.13+ plugin scaffold for mapping people, explicit relationships and unresolved contacts in a vault. It is designed as a clean v2 foundation rather than as a backwards-compatible rewrite of an existing plugin.

> [!IMPORTANT]
> **People Atlas 0.1.0 only supports Obsidian 1.13.0 or newer. Obsidian 1.12.x and older are not supported.**
>
> As of 28 July 2026, Obsidian 1.13 is a [Catalyst early-access (beta) release](https://obsidian.md/help/catalyst). Catalyst access and **Receive early access versions** are therefore currently required to use People Atlas.

## Included in this scaffold

- A standalone People Atlas view.
- A custom Obsidian Bases view using the same graph model and renderer.
- Declarative Obsidian 1.13 settings.
- Stable person identities through `person_id`, with a path-based fallback.
- Explicit relationship notes with stable IDs, direction, `from`, `to`, types, closeness, dates and status metadata.
- Wikilink-based contact resolution instead of display-name matching.
- An incremental vault index: changed files are reparsed without rescanning the whole vault.
- `@` person suggestions that insert stable wikilinks and explicitly create new notes in the configured People folder.
- A validated relationship editor available from commands and selected people in both atlas views.
- A deterministic canvas layout, pan, zoom, node dragging and keyboard-accessible node list.
- Diagnostics for duplicate IDs and broken relationship endpoints.
- Unit tests for identity, wikilinks, graph building and graph projection.
- CI and release-ready project structure.

## Requirements

- Obsidian 1.13.0 or newer (currently a Catalyst early-access release).
- Node.js 22 or newer for development.

## Development

```bash
npm ci
npm run dev
```

Copy or symlink this repository into:

```text
<Vault>/.obsidian/plugins/people-atlas
```

Reload Obsidian and enable **People Atlas** under Community plugins.

The default People folder is `People/`. New people created from the editor mention menu receive a generated `person_id`; typing alone never creates a note.

Use **People Atlas: Create relationship** from the Command Palette or select a
person in either atlas and choose **Create relationship**. New relationship
notes default to `People/Relationships/<Person A> - <Person B>.md`; the path is
reviewable and existing notes are never overwritten. Use **People Atlas: Edit
current relationship** while a relationship note is active to edit its
supported metadata.

Before committing:

```bash
npm run check
```

## Release readiness

`npm run check` runs the offline formatting, lint, type, test, production-build,
metadata and bundle-size gates. `npm run dependency:audit` is a separate
network-backed check that fails for high or critical npm audit findings.
`npm run verify:reproducible` creates two clean production bundles and requires
their SHA-256 digests to match.

The release contract requires the unprefixed Git tag to exactly equal
`manifest.json.version` (for example, `0.1.0`, not `v0.1.0`). After every gate
passes, the tag workflow is configured to attest and attach only `main.js`,
`manifest.json` and `styles.css`.

These checks establish local and CI readiness only. They do not create or push
a tag, publish a GitHub release, submit People Atlas to the Obsidian Community
directory or constitute approval by Obsidian.

## Example person

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

## Example relationship

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

See `ARCHITECTURE.md`, `ROADMAP.md` and `AGENTS.md` before making larger changes.
