# Roadmap

## Milestone 1 — Reliable graph core

- Complete duplicate-identity diagnostics.
- Add schema-aware note creation with `FileManager.processFrontMatter()`.
- Add explicit relationship editing.
- Add merge-person workflow.
- Add saved center and layout state per view.

## Milestone 2 — Production renderer

- Move force simulation to a Web Worker.
- Add image decoding and bounded image cache.
- Add touch pinch-to-zoom and long-press menus.
- Add zoom-dependent labels and clusters.
- Add `prefers-reduced-motion` behavior.
- Add PNG and SVG export.

## Milestone 3 — Relationship intelligence

- Multiple hops and shortest paths.
- Mutual contacts.
- Communities and isolated nodes.
- Last-contact and dormant-relationship views.
- Suggestions from links and meeting notes, always requiring confirmation.

## Milestone 4 — Quality and release

- [x] Controlled Obsidian integration test harness.
- [x] Browser, touch, pop-out ownership, and multi-DPR renderer coverage.
- [x] Performance fixtures for 100, 1,000 and 5,000 nodes.
- [x] Accessibility-focused renderer behavior and reduced-motion support.
- [x] Community Plugins metadata, disclosures, release contract, and automated readiness gate.
- [ ] Submit the first Community Plugins release after Obsidian 1.13 becomes publicly available.
