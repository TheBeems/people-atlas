Status: recorded
Created: 2026-07-30
Updated: 2026-07-30

# UX5 photo-avatar characterization — 2026-07-30

## Procedure

- Production-backed command:
  `npx vitest run --project browser test/browser/photo-avatar-characterization.browser.test.ts`.
- Fixed UX5 workload: the existing deterministic sparse fixture at 100
  people and 200 relationships, with 64 unique supported PNG assets.
- The production `AtlasRenderer` used its owning Chromium `Window.Image`,
  owning `Document` canvases and public bounded-cache observation seam.
- A test-controlled source release separated the first canvas frame from
  settled image decoding. No latency threshold was applied.

The 100-node/64-photo workload and the 64-entry pending/failure limits are UX5
implementation choices. They are not previously ratified product budgets.

## Observations

| Stage | Canvas result | Ready | Pending | Failed | Retained pixels |
| --- | --- | ---: | ---: | ---: | ---: |
| Initial paint | 100 initials, 0 thumbnails | 0 | 64 | 0 | 0 |
| Settled redraw | 36 initials, 64 thumbnails | 64 | 0 | 0 | 3,686,400 |
| After destroy | no retained cache entries | 0 | 0 | 0 | 0 |

- Every settled fixture thumbnail was 240 by 240 pixels after deterministic
  landscape/portrait center-cropping, below the 256-by-256 retained bound.
- The retained observation is 3,686,400 decoded thumbnail pixels, or
  14,745,600 RGBA bytes before browser/object overhead. It is below the
  approximate 16 MiB ready-pixel ceiling.
- A separate 66-photo renderer regression admitted 64 stable keys, started no
  duplicate work across a repeated redraw and promoted one selected overflow
  key by retiring one prior admission.
- The DPR 1, 1.5 and 2 browser matrix passed 6/6. It verified center crop,
  ring-over-avatar paint, centered labels, CSS-coordinate hit testing,
  scaled backing stores and distinct popup-owned Image/thumbnail objects.
- Standalone and custom-mapped Bases integration passed 2/2 for production
  resource resolution and modify/rename/delete cache replacement/fallback.

## Provenance and boundary

- Classification: `controlled-chromium`.
- Git HEAD: `8d5db6c036718c2d2f936453b372f902286ba1c9`.
- Worktree: dirty, containing the authorized staged UX0–UX5 implementation.
- Node/npm/Vitest: v24.18.0 / 11.16.0 / 4.1.10 on Windows ARM64.
- Retained heap provider: unavailable. The observation records cache-owned
  thumbnail pixels only and makes no heap-leak claim.
- Full source images may be transiently decoded by the browser before the
  256-pixel copy. They are dereferenced after settlement, but transient decode
  memory is not represented by the ready-pixel bound.
- This is not a calibrated machine benchmark and activates no latency,
  memory, Worker or CI threshold.
- Headless Chromium and same-origin browser popup evidence do not certify live
  Obsidian Desktop, Electron pop-outs, Mobile WebView or assistive technology.
- The standalone/Bases asset-lifecycle integration uses a static
  `ResizeObserver` test double to isolate index/resource/cache behavior; the
  separate DPR/popup matrix owns real observer, resize and teardown evidence.
