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
permitted full snapshot (Bases admission + safe diagnostic context)
        │                         │
        ▼                         ▼
filterRelationshipsAtDate()      all-permitted people / follow-ups / attention
        │
        ▼
projectGraph() (canvas and current-view population)
        │
        ▼
AtlasRenderer (canvas + semantic list + follow-ups + local attention)
```

View adapters pass both the projected graph and the original permitted full
`AtlasSnapshot`. Renderer population choices cannot widen Base admission. Name,
alias, work, email and phone matching is presentation only; identity and actions
use stable IDs and exact source paths. Selecting outside the canvas does not
recenter it. Optional schema-1 state fields remember modes, independent people/
follow-up scopes, family layout/date and selected center identity; old state uses
existing defaults. Network comparisons explicitly retain the chosen date while
all-permitted attention uses the current local calendar.

Birthday and relationship-cadence calculations are pure graph transformations.
The owning-window local-day timer refreshes the visible attention surface and
is cancelled on mode exit/destruction. Status filters preserve terminal history;
reviewed postponement writes only due date and reopening writes only status.
Rendered action inputs are copied, then canonical source/path/identity/mappings
are revalidated before and inside the shared mutation queue's frontmatter write.

Recovery is explicitly previewed. Per-note adoption/ID repair binds a privately
reviewed payload and owned source baseline, scans current source identity for
uniqueness, and preserves paths, bodies and unrelated fields. Batch application
reports per-note outcomes. Complete diagnostics filter source context before
Base-facing presentation; duplicate-ID structural ambiguity survives
as generic admitted-source evidence. Settings schema 7 recovery keeps the exact
original local plugin-data backup; unsupported/future data remains read-only.
Broken relationship diagnostics require admitted known endpoints or an exact
unresolved authored ghost already present, with a known admitted person as anchor.
Full/delta graph resolution combines canonical and mapped Base people, while
contact observations keep their canonical person authority in both paths.
Normal settings loading/saving uses Plugin.loadData/saveData. An explicit
settings-recovery preview may read the exact original text of local
configDir/plugins/people-atlas/data.json through the dedicated public DataAdapter reader; it accepts no path or
plugin ID and has no adapter write capability. Community checks enforce this
single-file read exception and retain adapter bans elsewhere.

## Current limitations

- Layout is deterministic radial/circular or explicit-role family layout,
  with stable fallback for cycles/conflicts; force-directed layout is not provided.
- Vault photos use safe host resource URLs for selected profiles and a
  per-renderer, owning-window thumbnail cache for canvas avatars. The cache
  admits at most 64 stable selected/center-prioritized keys, retains at most
  64 square thumbnails of at most 256 pixels and falls back to initials.
- Full timeline and organization/community projections are not
  implemented yet.
- Contact moments can be logged and edited, including explicit follow-up
  metadata and stale-safe optional `last_contact` advancement. Selected-person
  history and the lifecycle-owned local-day Follow-ups surface are available;
  completed/dismissed history, reopening, postponement and local birthday/cadence
  attention are available. Background reminders, notifications and recurrence
  remain out of scope.
- The Bases adapter maps the selected people while explicit relationship notes are supplied by the canonical `PersonIndex` for both views.
- Graph center, projection, layout, renderer mode and population state are
  persisted per view configuration with backward-compatible optional fields.
- Owning-window renderer lifecycle and semantic keyboard behavior are covered
  in Chromium; live Obsidian screen-reader, mobile gesture and pop-out
  integration remain future validation/work.

These are intentional current boundaries. See `ROADMAP.md`.
