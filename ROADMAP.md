# Roadmap

This file is a product-level summary. Active `.10x` specifications and tickets
are the implementation authority.

## Delivered foundation

- [x] Canonical graph identity, duplicate diagnostics and incremental index/
      graph equivalence.
- [x] Explicit, schema-aware person and relationship mutations through
      `FileManager.processFrontMatter()`, including relationship editing.
- [x] Ego/free-network/contact-health projections with persisted center,
      camera and layout state per view configuration.
- [x] Accessible semantic rendering, reduced-motion behavior, touch
      pinch-to-zoom/long-press interaction, pop-out ownership and multi-DPR
      coverage.
- [x] Controlled Obsidian integration, generated invariants, reproducible
      release checks and 100/1,000/5,000-node performance characterization.
- [x] Main-thread graph-delta lookup optimization. The measured workload does
      not justify a Web Worker, so Worker migration is not an active
      requirement.

## Delivered staged program

The parent plan is
`.10x/tickets/2026-07-30-person-relationship-ux-plan.md`. The recommended
integration order is:

1. [x] [UX0 — Direction-free perspective foundation](.10x/tickets/2026-07-30-perspective-relationship-foundation.md)
2. [x] [UX1 — Direct relationship context actions](.10x/tickets/2026-07-30-relationship-context-actions.md)
3. [x] [UX2 — Perspective relationship editor and templates](.10x/tickets/2026-07-30-perspective-relationship-editor-templates.md)
4. [x] [UX3 — Person profile schema and editor](.10x/tickets/2026-07-30-person-profile-schema-editor.md)
5. [x] [UX4 — Vault photo picker and profile image](.10x/tickets/2026-07-30-person-photo-picker-profile.md)
6. [x] [UX5 — Graph avatars and bounded image lifecycle](.10x/tickets/2026-07-30-graph-photo-avatars.md)
7. [x] [UX6 — Contact-moment Markdown entity and logging](.10x/tickets/2026-07-30-contact-moment-notes.md)
8. [x] [UX7 — Contact history and follow-up surfaces](.10x/tickets/2026-07-30-contact-follow-up-views.md)

Ticket `Depends-On` fields remain authoritative where work can branch or must
wait for an earlier outcome.

## Later candidates requiring shaping

Merge person, zoom-dependent clustering, PNG/SVG export, shortest paths,
mutual contacts, communities/isolated-node analysis and suggestions from
links or meeting notes have no active specification or executable ticket.
They are candidates rather than implementation commitments.

Community Plugins submission and other publication work remain separate from
UX0–UX7 and require their own current evidence and authorization.
