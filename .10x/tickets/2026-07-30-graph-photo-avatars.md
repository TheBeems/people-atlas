Status: done
Created: 2026-07-30
Updated: 2026-07-30

# UX5 — Graph photo avatars and bounded image lifecycle

Parent: `.10x/tickets/2026-07-30-person-relationship-ux-plan.md`
Depends-On:
`.10x/tickets/2026-07-30-person-photo-picker-profile.md`,
`.10x/tickets/2026-07-26-performance-characterization.md`,
`.10x/tickets/2026-07-27-high-dpi-popup-browser-matrix.md`

## Scope

Implement the canvas/image-lifecycle portion of
`.10x/specs/person-profile-experience.md`:

- asynchronously decode supported resolved vault photos into bounded
  thumbnails using the renderer's owning Window;
- paint center-cropped circular avatars inside existing person nodes;
- retain selection/center rings, labels, hit targets, layout and initials
  fallback;
- invalidate images on asset modify/rename/delete;
- bound and release ready, pending and failed cache states;
- add photo-populated renderer characterization and lifecycle regressions.

This ticket becomes executable only after UX4 is done and the user explicitly
authorizes implementation.

## Non-goals

- Remote images, SVG, animation guarantees or photo editing.
- Changing graph node radius, hit testing, force/layout or projection.
- A cross-window DOM/image cache.
- Worker migration or broad renderer performance optimization.
- Treating photo presence as identity or relationship metadata.

## Acceptance criteria

- [x] A resolved person's usable photo is clipped inside the current circular
      canvas node; ghost/ambiguous nodes never request photos.
- [x] Initial graph paint never waits for image decoding and uses initials
      until a still-current thumbnail is ready.
- [x] Selection/center strokes, labels, hit targets, keyboard/touch behavior
      and deterministic positions remain unchanged.
- [x] Decode/cache objects are created from the renderer container's owning
      Window and are not shared across pop-outs with different owners.
- [x] Each renderer cache retains at most 64 ready thumbnails and each ready
      thumbnail is at most 256 by 256 decoded pixels.
- [x] Pending and failure states are also bounded; least-recently-used ready
      entries can be evicted without losing initials fallback.
- [x] Full-resolution source images are not persistently retained after
      thumbnail creation.
- [x] Cache key includes normalized path and asset modification state.
- [x] Modify, rename and delete invalidate only affected entries and redraw
      only still-live/still-matching nodes.
- [x] Destroy releases cached resources/listeners and ignores late decode
      completions without an unhandled rejection or detached redraw.
- [x] Missing/corrupt/deleted-during-load/rapidly-replaced photos
      deterministically fall back to initials.
- [x] Animated formats may render one stable thumbnail; continuous animation
      is not required.
- [x] Node/browser tests cover ready/failure/eviction/invalidation/destroy and
      stale async completion.
- [x] High-DPI browser cases verify crop, node rings and labels at supported
      DPR values without pixel-coordinate ownership regressions.
- [x] A deterministic photo-populated fixture records initial paint, settled
      redraw and retained-cache observations; it does not invent a Worker or
      unratified latency threshold.
- [x] Existing no-photo fixtures remain valid and graph/list/touch/pop-out
      regressions remain passing.
- [x] `npm run test`, `npm run build` and `git diff --check` pass.

## Likely implementation boundaries

- a focused window-owned thumbnail loader/cache under `src/render/`;
- `src/render/atlas-renderer.ts` draw/lifecycle integration;
- existing photo asset dependency/index events;
- `test/browser/` cache/high-DPI/pop-out cases;
- a photo-populated deterministic performance fixture/evidence record.

The loader SHOULD expose a small state API to the renderer. It MUST NOT import
vault data into pure graph transformations or let the renderer read Markdown.

## References

- `.10x/specs/person-profile-experience.md`
- `.10x/specs/performance-characterization.md`
- `.10x/specs/high-dpi-popup-browser-matrix.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/tickets/2026-07-30-person-photo-picker-profile.md`
- `.10x/research/2026-07-26-graph-delta-hot-path.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: graph avatars complete the photo user contract but require
  explicit fallback/loading/mobile behavior.
- Record-backed: existing P6 fixtures did not decode photos and therefore do
  not justify extrapolating an image budget.
- Technical contract: 64 thumbnails at 256 by 256 pixels bounds ready pixel
  storage near 16 MiB before browser overhead.

## Blockers

None known. Stop and record a blocker if supported Obsidian/Electron browser
APIs cannot create bounded thumbnails without retaining full source decodes,
or if the fixed cache bounds cannot be enforced per owning window.

## Journal

- 2026-07-30: Photo avatar behavior and fallback were shaped separately from
  DOM picker/profile work.
- 2026-07-30: Ticket opened for later implementation after UX4; no image
  decoder/cache or performance claim was added in this shaping turn.
- 2026-07-30: Execution preflight confirmed UX4, performance
  characterization and high-DPI popup dependencies are closed. The governing
  photo clauses 44–53, renderer lifecycle knowledge, architecture boundary
  and current mixed worktree were reread before edits.
- 2026-07-30: Work was split into non-overlapping cache, deterministic
  characterization and root renderer-integration streams with an independent
  read-only adversarial review. Existing UX0–UX4 changes remain in place and
  no commit or publication is authorized.
- 2026-07-30: Added one cache per renderer using its owning `Window.Image` and
  owning `Document` canvas. Ready, pending and failure states are each capped
  at 64, thumbnails at 256 square pixels, and exact opaque identity combines
  normalized path with `mtime:size`.
- 2026-07-30: Defined the previously unspecified working-set rule as a stable
  maximum of 64 distinct keys per graph state, prioritized by selected person,
  center and snapshot order. A 66-photo regression proves repeated redraws do
  not retry churn and selecting an overflow node replaces one admission.
- 2026-07-30: Canvas integration keeps the existing radius, layout, hit
  testing, rings, labels and first-paint initials. Only resolved canonical
  person nodes resolve resources; ready thumbnails are center-cropped below
  the unchanged ring and stale/error states remain initials.
- 2026-07-30: Exact-key reconciliation preserves shared and unrelated
  thumbnails while modify/rename/delete, rapid replacement, resolver failure,
  decode failure and destroy retire only no-longer-current work.
- 2026-07-30: The fixed UX5 characterization choice is 100 sparse nodes,
  200 relationships and 64 photos. It records behavior and retained thumbnail
  pixels but activates no latency, heap, Worker or CI threshold.
- 2026-07-30: UX5 closed after full verification and fresh independent
  approval. No commit or publication was performed.

## Evidence

- Cache-focused Node tests passed 6/6 and Chromium ownership/decode tests
  passed 2/2. Renderer/avatar Chromium tests passed 4/4, including resolved-
  only eligibility, exact/shared invalidation, 66-key admission, corrupt
  decode, stale completion and destroy.
- Production-backed characterization passed 1/1: initial paint retained
  64 pending/0 ready while rendering 100 initials; settled redraw retained
  64 ready/0 pending, rendered 64 thumbnails plus 36 initials and observed
  3,686,400 retained thumbnail pixels; destroy retained zero.
- The DPR 1, 1.5 and 2 popup matrix passed 6/6 with center crop,
  ring-over-avatar paint, centered labels, CSS hit testing, scaled backing
  stores and popup-owned Image/thumbnail objects.
- Controlled production integration passed 2/2. Standalone covered
  modify/rename/delete; custom-mapped Bases covered modify/delete through the
  shared asset-only index and renderer refresh route.
- Durable characterization boundary and observations:
  `.10x/evidence/2026-07-30-photo-avatar-characterization.md`.
- Final `npm run test` passed 54 files / 581 tests. `npm run build`,
  `npm run format:check`, `npm run lint` and `git diff --check` passed;
  diff-check output contained only informational LF-to-CRLF warnings.

## Review

Fresh independent direct review approved UX5 with no blocking or
non-blocking technical findings. It separately verified stable overflow
admission, resolved-only loading, exact/shared invalidation, bounded cleanup,
popup ownership, DPR paint/interaction invariants, production view lifecycle
and the retained-versus-transient memory wording. Controlled Chromium does
not certify live Obsidian Desktop/Mobile, Electron pop-outs or assistive
technology.

## Retrospective

The 64-entry retained bound required an explicit admission policy because a
naive all-node LRU traversal would continuously evict and reload graphs with
more than 64 photographed people. Stable selected/center-first admission
keeps behavior bounded without adding view culling or changing layout. The
ready-pixel observation is intentionally narrower than transient browser
decode memory; source Images are released, but no total-heap claim is made.
