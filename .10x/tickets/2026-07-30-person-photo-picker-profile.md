Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX4 — Vault photo picker, preview and selected-profile image

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-30-person-profile-schema-editor.md`

## Scope

Implement the DOM/vault-selection portion of the photo contract in
`.10x/specs/person-profile-experience.md`:

- add a searchable picker over supported raster assets in the current vault;
- show a preview for the current/pending photo reference;
- write a canonical vault wikilink only after explicit person-form Save;
- preserve unchanged manually authored vault paths/wikilinks;
- display the resolved image in selected-person profile details in standalone,
  Bases and the graph/mobile details sheet;
- provide visible missing/unsupported/decode fallback without network access.

Graph canvas avatar decoding/cache is excluded for UX5.

This ticket becomes executable only after UX3 is done and the user explicitly
authorizes implementation.

## Non-goals

- Canvas node avatars or an image cache.
- Remote URLs, downloading/copying/moving/renaming/deleting assets.
- Image editing, crop controls, face detection, SVG or video.
- Broad attachment-manager integration.

## Acceptance criteria

- [x] The picker searches only current vault files with `.png`, `.jpg`,
      `.jpeg`, `.webp`, `.gif` or `.avif` extensions.
- [x] Picker identity is the resolved vault-relative path; display filename
      is never used to guess between duplicate basenames.
- [x] Selecting an asset updates unsaved form state to a canonical wikilink
      and shows an immediate center-cropped preview.
- [x] No asset or person note changes before explicit Save.
- [x] Existing raw path/wikilink values remain readable and are preserved
      exactly when the photo is not changed.
- [x] Clearing the field removes only the configured photo property after
      Save.
- [x] Missing, unsupported or undecodable references show a visible
      explanation and initials fallback; no remote fallback/fetch occurs.
- [x] Selected-person profile details display a resolved image in standalone,
      Bases and graph/mobile details using the owning Document/Window.
- [x] Profile images adjacent to the person's visible name use empty alt text
      and do not duplicate the screen-reader name.
- [x] Asset selection and profile rendering do not expose contact details in
      broader accessible labels.
- [x] Vault asset modify/rename/delete refreshes the preview/profile through
      existing lifecycle/index dependencies without leaking listeners.
- [x] Pure tests cover supported-extension filtering, canonical selection,
      unchanged raw references, clear/update mapping and stale selection.
- [x] Browser/integration tests cover keyboard picker use, preview, error
      fallback, save/cancel, standalone/Bases and pop-out owner-document
      behavior.
- [x] A disposable/live Obsidian photo-flow check remains explicitly manual;
      Chromium results are not described as live-vault certification.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- `src/editor/person-modal.ts`: searchable asset picker and preview.
- `src/editor/person-form.ts`: canonical pending photo mapping.
- `src/index/index-state.ts`: existing photo dependency invalidation.
- `src/render/atlas-renderer.ts`: selected profile/details DOM only.
- standalone/Bases integration and browser tests.

Use Obsidian's documented vault/resource APIs. Do not reach into the native
property picker or Settings DOM.

## References

- `.10x/specs/person-profile-experience.md`
- `.10x/tickets/2026-07-30-person-profile-schema-editor.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/high-dpi-popup-browser-matrix.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- Record-backed: person/photo references already parse as vault paths or
  wikilinks and missing assets produce diagnostics.
- User-ratified: photo selection, preview and visible presentation are one
  complete user capability.
- Mechanical: picker writes a canonical wikilink for a newly selected asset
  but never rewrites an unchanged raw reference.

## Blockers

None known. Stop and record a blocker if supported Obsidian APIs cannot obtain
a safe resource URL for an asset in the view's owning window, or if a chosen
format cannot produce deterministic fallback behavior.

## Journal

- 2026-07-30: Photo workflow ratified as picker, preview and visible image
  with fallback.
- 2026-07-30: Ticket split from canvas avatar/cache risk and opened for later
  implementation after UX3.
- 2026-07-30: Added exact-path raster discovery, pending picker state,
  canonical-on-save serialization, unchanged raw-reference preservation and
  stale-selection rejection before any vault mutation.
- 2026-07-30: Added a shared safe resource adapter and owner-document previews
  for the person modal and selected-person profiles. Standalone, Bases and
  graph/mobile details now show center-cropped local photos or explicit
  initials-backed missing, unsupported, unavailable and decode fallbacks.
- 2026-07-30: Asset lifecycle indexing now covers modify/rename/delete,
  Markdown-to-asset transitions and custom Bases photo mappings while
  preserving duplicate-person diagnostics during asset-only deltas.
- 2026-07-30: Adversarial review found and repair verification closed path
  delimiter injection, stale standalone details, custom Bases invalidation,
  raw-input bypass, unsafe/stale modal URLs, Markdown-to-asset stale records
  and duplicate-ID collapse on asset-only deltas.
- 2026-07-30: UX4 closed without commit or publication. Canvas avatar decoding
  and caching remain owned by UX5.

## Evidence

- Pure photo/form/resource/index and graph regressions cover exact supported
  paths, duplicate basenames, canonical mapping, raw preservation,
  clear/update behavior, stale selection, safe URL handling and every asset
  lifecycle transition.
- Browser suites passed 41/41 across the picker/profile and renderer,
  including keyboard use, save/cancel, decode fallback and pop-out
  owner-document behavior.
- Controlled production integration passed 2/2 for standalone and Bases,
  including a custom Bases photo mapping and modify/delete refresh.
- Final `npm run test` passed 49 files / 564 tests; `npm run build`,
  `npm run format:check`, `npm run lint` and `git diff --check` passed.
  `git diff --check` emitted only informational LF-to-CRLF warnings.

## Review

Fresh independent adversarial review approved UX4 with no open code or
automated-evidence findings. The review confirmed production standalone/Bases
integration, Markdown/asset rename truth, duplicate preservation,
delimiter-safe serialization, shared cache-busted URL resolution and
listener/decode/network safety. Controlled Chromium/runtime evidence does not
certify live Obsidian Desktop/Mobile, Electron pop-outs or assistive
technology; the disposable live photo-flow check remains manual.

## Retrospective

Keeping vault identity and resource resolution separate made the save boundary
and renderer privacy boundary testable. Asset-only lifecycle events required
the same duplicate-preserving graph-delta discipline as Markdown changes;
revision-only shortcuts would have silently weakened canonical diagnostics.
