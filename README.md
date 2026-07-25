# People Atlas

People Atlas is an Obsidian 1.13+ plugin scaffold for mapping people, explicit relationships and unresolved contacts in a vault. It is designed as a clean v2 foundation rather than as a backwards-compatible rewrite of an existing plugin.

## Included in this scaffold

- A standalone People Atlas view.
- A custom Obsidian Bases view using the same graph model and renderer.
- Declarative Obsidian 1.13 settings.
- Stable person identities through `person_id`, with a path-based fallback.
- Explicit relationship notes with stable IDs, direction, `from`, `to`, types, closeness, dates and status metadata.
- Wikilink-based contact resolution instead of display-name matching.
- An incremental vault index: changed files are reparsed without rescanning the whole vault.
- `@` person suggestions that insert stable wikilinks and explicitly create new notes in the configured People folder.
- A deterministic canvas layout, pan, zoom, node dragging and keyboard-accessible node list.
- Diagnostics for duplicate IDs and broken relationship endpoints.
- Unit tests for identity, wikilinks, graph building and graph projection.
- CI and release-ready project structure.

## Requirements

- Obsidian 1.13.0 or newer.
- Node.js 22 or newer for development.

## Development

```bash
npm install
npm run dev
```

Copy or symlink this repository into:

```text
<Vault>/.obsidian/plugins/people-atlas
```

Reload Obsidian and enable **People Atlas** under Community plugins.

The default People folder is `People/`. New people created from the editor mention menu receive a generated `person_id`; typing alone never creates a note.

A ready-to-copy plugin folder is also generated at `release/people-atlas/`.

Before committing:

```bash
npm run check
```

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
