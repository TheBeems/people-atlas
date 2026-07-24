# Architecture

## Design principles

1. **Markdown first** — people and relationships remain inspectable, linkable notes.
2. **Stable identity** — `person_id` is authoritative; file path is a deterministic fallback.
3. **Relationships are entities** — relationship metadata does not belong on a person node.
4. **Wikilinks over names** — display names are never used as authoritative identifiers.
5. **Incremental updates** — a changed note is reparsed individually.
6. **One graph contract** — standalone and Bases views both emit `AtlasSnapshot`.
7. **Renderer isolation** — rendering does not read the vault or parse frontmatter.
8. **No hidden inference** — unresolved or ambiguous data is reported as a diagnostic.

## Layers

```text
Obsidian Vault / Bases
        │
        ▼
frontmatter parser / Bases adapter
        │
        ▼
PersonIndex + relationship records
        │
        ▼
buildAtlasSnapshot()
        │
        ▼
projectGraph()
        │
        ▼
AtlasRenderer
```

## Current limitations of the scaffold

- The layout is deterministic and radial/circular, not yet force-directed.
- Photos are parsed but not yet decoded and painted.
- Relationship editing and note creation are not implemented yet.
- The Bases adapter maps the selected people while explicit relationship notes are supplied by the canonical `PersonIndex` for both views.
- Graph state is not yet persisted per view.

These are intentional boundaries for v0.1. See `ROADMAP.md`.
