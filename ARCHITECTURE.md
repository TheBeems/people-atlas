# Architecture

## Design principles

1. **Markdown first** — people, relationships, and contact moments remain
   inspectable, linkable notes.
2. **Stable identity** — canonical people, relationships, and contact moments require explicit stable IDs.
3. **Relationships are entities** — relationship metadata does not belong on a person node.
4. **Wikilinks over names** — display names are never used as authoritative identifiers.
5. **Incremental updates** — a changed note is reparsed individually.
6. **One graph contract** — standalone and Bases views both emit `AtlasSnapshot`.
7. **Renderer isolation** — rendering does not read the vault or parse frontmatter.
8. **No hidden inference** — unresolved or ambiguous data is reported as a diagnostic.
9. **Equivalent navigation** — the canvas and semantic list share stable-ID
   selection while explicit view actions remain owned by the view adapter.
10. **Direction-free relationships** — `from` and `to` are stable
    serialization/role slots, not graph arrows; paired endpoint roles carry
    optional perspective meaning.
11. **Identity is not navigation** — the optional stable-ID `My person`
    perspective may initialize an otherwise unconfigured view, but it never
    follows or rewrites graph-center state.
12. **Contact history is supplemental** — contact moments are indexed with
    stable identity and diagnostics, but never become graph nodes or edges.
    Optional relationship `last_contact` advancement is explicit, unchecked,
    monotonic and does not infer relationship state.

## Layers

```text
Obsidian Vault / Bases
        │
        ▼
frontmatter parser / Bases adapter
        │
        ▼
PersonIndex + relationship/contact-moment records
        │
        ▼
buildAtlasSnapshot()
        │
        ▼
projectGraph()
        │
        ▼
AtlasRenderer (canvas + semantic list + follow-ups)
```

## Current limitations

- The layout is deterministic and radial/circular, not yet force-directed.
- Vault photos use safe host resource URLs for selected profiles and a
  per-renderer, owning-window thumbnail cache for canvas avatars. The cache
  admits at most 64 stable selected/center-prioritized keys, retains at most
  64 square thumbnails of at most 256 pixels and falls back to initials.
- Full timeline, organization/community and shortest-path projections are not
  implemented yet.
- Contact moments can be logged and edited, including explicit follow-up
  metadata and stale-safe optional `last_contact` advancement. Selected-person
  history and the lifecycle-owned local-day Follow-ups surface are available;
  background reminders, notifications, recurrence and completed-history
  management remain out of scope.
- The Bases adapter maps the selected people while explicit relationship notes are supplied by the canonical `PersonIndex` for both views.
- Graph center, projection and layout state is persisted per view
  configuration. Graph/List/Follow-ups mode is renderer-local and
  intentionally not persisted.
- Owning-window renderer lifecycle and semantic keyboard behavior are covered
  in Chromium; live Obsidian screen-reader, mobile gesture and pop-out
  integration remain future validation/work.

These are intentional current boundaries. See `ROADMAP.md`.
