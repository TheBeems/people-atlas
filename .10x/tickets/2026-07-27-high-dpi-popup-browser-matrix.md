Status: done
Created: 2026-07-27
Updated: 2026-07-27

# P7c — High-DPI and popup browser matrix

Parent: `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`
Depends-On: `.10x/tickets/2026-07-26-generated-graph-index-invariants.md`

## Scope

Implement `.10x/specs/high-dpi-popup-browser-matrix.md` as the third bounded
P7 child:

1. add a disjoint named Chromium browser-matrix project at DPR `1`, `1.5` and
   `2`, with typed per-instance expected-factor data;
2. add narrow production-renderer tests for high-DPI backing-store scale,
   far-pixel draw coverage, CSS-coordinate selection and resize;
3. add a user-activated same-origin top-level browser popup case that proves
   renderer DOM, scale, dialog/focus and lifecycle ownership plus teardown;
4. expose `npm run test:browser-matrix` and retain default full-suite
   discovery;
5. verify the focused matrix, full suite, production build and diff hygiene.

## Non-goals

- Live Obsidian Desktop/Electron/workspace pop-out certification.
- Runtime monitor/DPR transitions, Firefox, WebKit, Mobile or assistive
  technology.
- Repeating the existing P5 interaction/touch suite or adding screenshots.
- Product-source repair for a defect exposed by the matrix.
- Dependencies, lockfile, CI workflow, performance or release changes.

## Acceptance Criteria

- [x] A separately named matrix project runs one disjoint P7c path in real
      Playwright Chromium contexts configured at DPR `1`, `1.5` and `2`.
- [x] Typed per-instance context supplies the expected factor, and every case
      proves that real `window.devicePixelRatio` equals it.
- [x] Main-document tests prove CSS/backing canvas dimensions, far backing
      pixel coverage, stable-ID selection from a real CSS-center click and
      correct dimensions after a controlled resize at every factor.
- [x] A user gesture creates a distinct same-origin top-level `window.open()`
      popup; null, blocked or inaccessible creation fails without fallback.
- [x] The production renderer mounts in that popup and proves popup-owned DOM,
      canvas scale, native dialog/focus, animation frame and ResizeObserver.
- [x] Popup teardown closes renderer state, disconnects/cancels popup-owned
      lifecycle resources, removes renderer DOM and always closes the popup.
- [x] Existing P5 browser tests remain unchanged and are not rediscovered by
      the matrix project; P7a integration and P7b generated discovery likewise
      remain disjoint.
- [x] `npm run test:browser-matrix` runs all three scale instances and no other
      test owner; default `npm run test` includes it.
- [x] `npm run test:browser-matrix`, `npm run test`, `npm run build` and
      `git diff --check` pass.
- [x] The implementation changes no product source, dependency, lockfile, CI
      workflow, persisted schema, performance threshold or release file.
- [x] Fresh independent review records findings, verdict and residual risk;
      closure requires `pass` or explicit acceptance of non-critical risk.

## References

- `.10x/specs/high-dpi-popup-browser-matrix.md`
- `.10x/research/2026-07-27-p7c-browser-matrix-feasibility.md`
- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/tickets/2026-07-26-accessible-semantic-renderer.md`
- `.10x/tickets/2026-07-26-mobile-touch-interaction.md`
- `AGENTS.md`
- `src/render/atlas-renderer.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `vitest.config.ts`
- `package.json`
- `node_modules/@vitest/browser-playwright/dist/index.d.ts`
- `node_modules/vitest/dist/chunks/reporters.d.DtoKVV2s.d.ts`

## Assumptions

- User-ratified: P7c is the next shaping priority after committing closed P7b.
- Record-backed: renderer DOM, drawing, events, observers and animation frames
  use the container's owning `Document` and `Window`.
- Record-backed: the existing iframe test proves a secondary owning context but
  not a top-level browser popup, and no explicit device-scale matrix exists.
- Record-backed: live Obsidian/Electron pop-out evidence remains P7d and MUST
  NOT be inferred from a Chromium popup.
- Mechanical: DPR `1`, `1.5` and `2` exercise baseline, fractional rounding and
  high-density backing-store behavior without multiplying the complete P5
  suite.
- Mechanical: exact matrix test filenames, provided-context key and bounded
  wait helper may be chosen by the executor while discovery and proof
  boundaries remain unchanged.

## Journal

- 2026-07-27: Closed P7b was committed locally as `c146dc5`.
- 2026-07-27: Read-only feasibility shaping confirmed that the production
  renderer already reads the owning window's DPR and scales its backing canvas,
  while current browser coverage uses only the default context and a
  same-origin iframe.
- 2026-07-27: Installed Vitest/Playwright types support per-instance provider
  `contextOptions.deviceScaleFactor` and typed project-provided data. This
  permits a narrow three-instance Chromium matrix without rerunning all P5
  cases at each factor.
- 2026-07-27: The active governing specification and this bounded executable
  ticket were created. A real top-level Chromium popup is explicitly separated
  from the still-unverified Obsidian/Electron pop-out boundary.
- 2026-07-27: Per the shaping/execution boundary, no matrix configuration,
  browser test, script or product implementation occurred in this turn.
- 2026-07-27: The user explicitly authorized P7c implementation and a local
  commit after successful closure. Execution began after rereading the active
  contract, feasibility/gap research, renderer-interaction boundaries, P5
  contracts and terminal evidence, current renderer, existing browser suite,
  installed Vitest/Playwright types, configuration and project instructions.
  The authorized executor scope remains test/config/records only; commit,
  independent review and closure remain orchestrator-owned.
- 2026-07-27: Premortem for the popup lifecycle boundary: the renderer creates
  only ephemeral browser DOM, observer and animation-frame state; no vault
  state, recipients, retries, retention, permissions, billing or operational
  service is involved. Record-backed cleanup ownership requires `destroy()` to
  close dialog state, disconnect the popup observer, cancel a popup animation
  frame and remove renderer DOM; test cleanup additionally always closes the
  real popup. A valid matrix case exposing a product defect will block this
  ticket rather than authorize product-source repair.
- 2026-07-27: Added one disjoint `browser-matrix` Vitest project with
  Playwright Chromium instances at DPR `1`, `1.5` and `2`. Each instance
  injects a typed `BrowserMatrixFactor` through Vitest provided context and
  configures the matching provider `deviceScaleFactor`. The Node project now
  explicitly excludes the matrix path; the existing P5 browser, P7a
  integration and P7b generated files were not edited.
- 2026-07-27: Added two narrow production-renderer cases per factor. The
  main-document case proves actual DPR, controlled CSS/backing dimensions,
  opaque far backing pixel, stable-ID selection from a real CSS-center click
  and the ResizeObserver path after a controlled container resize. The popup
  case opens a real same-origin top-level `window.open()` only from a
  user-activated button, fails on null/inaccessible creation, proves distinct
  opener/top-level/document ownership, popup DPR/DOM/canvas/dialog/focus and
  popup-wrapped observer/animation APIs, then destroys renderer state and
  closes the popup in `finally` without any fallback.
- 2026-07-27: First focused `npm run test:browser-matrix` passed: Vitest
  reported 3/3 instance files and 6/6 tests. This proves the configured
  DPR/main/popup assertions in the installed headless Chromium harness; it
  does not prove Obsidian Desktop/Electron pop-out or live monitor changes.
- 2026-07-27: Full `npm run test` passed 28/28 files and 308/308 tests. The
  default run therefore includes all six P7c instance cases together with the
  existing Node, P5 browser and P7a integration owners; this green run does
  not widen any automated result into live Obsidian certification.
- 2026-07-27: The first `npm run build` reached TypeScript and failed only in
  the new matrix harness: four unparameterized `vi.fn()` values did not retain
  callback signatures, and TypeScript treated the popup variable assigned
  inside the activation listener as unreachable after the null guard. No
  production source compiled unsuccessfully and no browser assertion failed.
  The bounded repair parameterizes the existing callback types and stores the
  listener result in an explicitly mutable `{ current: Window | null }`
  holder; product code and test semantics are unchanged.
- 2026-07-27: `npm run build` passed after the test-only typing repair:
  TypeScript no-emit and the production esbuild bundle completed successfully.
  This proves repository type/build compatibility, not live runtime behavior.
- 2026-07-27: Final focused `npm run test:browser-matrix` rerun after the
  typing-only repair passed 3/3 instance files and 6/6 tests.
- 2026-07-27: Final full `npm run test` rerun after the last harness change
  passed 28/28 files and 308/308 tests.
- 2026-07-27: Disjoint discovery audit used `npx vitest list` for
  `browser-matrix`, `browser`, `integration` and the Node project constrained
  to `test/browser-matrix`. The matrix listed exactly two cases under each of
  `chromium-dpr-1`, `chromium-dpr-1.5` and `chromium-dpr-2`; P5 listed only its
  existing 16 `test/browser/atlas-renderer.browser.test.ts` cases; P7a listed
  only its existing integration case; Node listed no P7c case.
- 2026-07-27: Scope audit found only the shaped P7c records, parent record,
  `package.json`, `vitest.config.ts` and new `test/browser-matrix/` path
  changed. No `src/`, existing P5/P7a/P7b test, `.github/`, dependency,
  lockfile, persisted schema, performance, release, screenshot or attachment
  artifact changed. Ticket remains `active` with the review criterion open for
  fresh independent review.
- 2026-07-27: Final `git diff --check` exited 0 with only informational
  Windows LF/CRLF conversion warnings. A separate scan found no trailing
  whitespace in the untracked P7c research/spec/ticket/context/test files.
- 2026-07-27: The user explicitly authorized repair of the single significant
  review finding and no broader scope. `waitForCanvas()` now supplies
  `waitFor()` with factor/boundary plus concrete expected CSS and derived
  backing dimensions. Every popup teardown assertion for the dialog,
  observer, frame precondition/cancellation/pending state, renderer
  DOM/container cleanup, captured-control non-reactivation and final popup
  close now carries an explicit `[DPR <factor>] popup teardown` message. No
  assertion was removed or weakened; product source, config, dependencies,
  lockfile, CI and existing test owners remain unchanged.
- 2026-07-27: Post-repair `npm run test:browser-matrix` passed 3/3 Chromium
  instance files and 6/6 tests. This confirms the diagnostic-only edit leaves
  every DPR/main/popup behavioral assertion green; it does not exercise the
  failure text itself or widen the Chromium evidence boundary.
- 2026-07-27: Post-repair `npm run test` passed 28/28 files and 308/308 tests,
  preserving every existing Node/browser/integration/generated owner together
  with the matrix.
- 2026-07-27: Post-repair `npm run build` passed TypeScript no-emit and the
  production esbuild bundle. This proves static/build compatibility after the
  test-only message changes.
- 2026-07-27: Targeted static diagnostic scan passed. It required
  `waitForCanvas()` to derive both backing dimensions, include concrete
  expected CSS/backing values in `diagnostic` and pass that string to
  `waitFor()`. It counted 11 teardown-block assertions and 11
  `${popupTeardown}` messages, then separately required the final popup-close
  assertion to contain `[DPR ${expectedFactor}] popup teardown`. This proves
  diagnostic source completeness for the reviewed boundaries; the green
  runtime tests do not deliberately force every failure.
- 2026-07-27: Post-repair `git diff --check` exited 0 with only informational
  Windows LF/CRLF conversion warnings. Ticket status remains `active`, the
  historical `concerns` review is preserved and the review acceptance
  criterion remains open for fresh independent re-review.
- 2026-07-27: Fresh independent repair re-review returned `pass` with no new
  finding. It verified concrete factor/boundary/CSS/backing timeout context,
  explicit teardown context on all twelve popup checks, unchanged behavioral
  assertions and unchanged test-only scope. Every acceptance criterion now
  maps to executor evidence and independent review, so the orchestrator closed
  P7c as `done`.

## Blockers

None. The implementation, diagnostic repair, executor gates and fresh
independent re-review passed within the headless-Chromium matrix boundary.

## Evidence

- `.10x/research/2026-07-27-p7c-browser-matrix-feasibility.md` records the
  current source, test and installed-provider seams plus their limits.
- `test/browser-matrix/browser-matrix-context.ts` defines the closed
  `BrowserMatrixFactor` union (`1 | 1.5 | 2`) and augments Vitest's provided
  context with the typed expected factor.
- `vitest.config.ts` defines the inherited `browser-matrix` project, exact
  disjoint include/exclude rules and three per-instance Playwright providers
  whose `contextOptions.deviceScaleFactor` and provided expected value match.
- `test/browser-matrix/atlas-renderer.browser-matrix.test.ts` directly mounts
  the production `AtlasRenderer`. Its main-document case maps DPR to measured
  CSS/backing dimensions, reads the far backing pixel, clicks the one-node
  graph at CSS center by real browser input and observes a controlled resize.
  Its popup case opens from a `userEvent`-activated button, rejects null or
  inaccessible creation, proves distinct same-origin top-level/opener state,
  mounts into the popup document, observes popup-owned RAF/ResizeObserver,
  operates the native dialog/focus path, destroys pending lifecycle state,
  tests captured controls after teardown and closes the popup in `finally`.
- Focused `npm run test:browser-matrix`: 3/3 Chromium instance files and 6/6
  tests passed after the final test-only typing repair.
- Final `npm run test`: 28/28 files and 308/308 tests passed, including the
  default-discovered matrix plus existing Node/browser/integration owners.
- Final `npm run build`: TypeScript no-emit and production esbuild passed.
- Discovery: `npx vitest list --project browser-matrix` listed exactly the two
  new cases at each of the three named factors; separate browser/integration/
  constrained-Node lists showed no cross-owner discovery.
- Scope inspection found no product source, dependency, lockfile, CI,
  existing P5/P7a/P7b test, performance, release, screenshot or attachment
  change.
- Final `git diff --check`: exit 0 with only informational Windows LF/CRLF
  conversion warnings. A separate untracked-file scan found no trailing
  whitespace in any new P7c record or test file.
- Authorized diagnostic repair evidence: focused matrix passed 3/3 instance
  files and 6/6 tests; full suite passed 28/28 files and 308/308 tests; build
  passed TypeScript no-emit and production esbuild.
- The targeted static scan proves `waitForCanvas()` derives and reports
  expected CSS/backing dimensions and that all 11 bounded teardown assertions
  plus final popup closure carry factor-specific `popup teardown` context.
- The repair round changed only the P7c matrix test, owning ticket and parent
  journal. It did not edit product source, configuration, dependencies,
  lockfile, CI or another test owner. Final post-record diff hygiene is
  recorded in the Journal.
- Fresh independent repair re-review returned `pass` without a new finding and
  accepted the executor gates within their recorded limits.

## Review

### Findings

- **Significant — required matrix failure context is incomplete.**
  `waitForCanvas()` receives the expected CSS dimensions and derives the
  expected backing dimensions, but delegates to `waitFor()`, whose timeout
  reports only DPR, boundary name and elapsed time. A failed main-scale,
  resize or popup-scale wait therefore omits the expected dimensions required
  by the specification's Error Behavior. In addition, the popup teardown
  assertions for dialog closure, observer disconnect, frame cancellation, DOM
  removal and non-reactivation have no `popup teardown` assertion message;
  their shared test title names creation, ownership *and* teardown, so it does
  not itself identify which required boundary failed. Repair the test-only
  diagnostics so every canvas timeout includes expected CSS and backing
  dimensions and every teardown assertion identifies `[DPR <factor>] popup
  teardown`. Do not weaken or remove any assertion.

### Verified Without Finding

- `vitest.config.ts` defines one separately named `browser-matrix` project
  whose only include is `test/browser-matrix/**/*.browser-matrix.test.ts`.
  Its three Playwright Chromium instances configure exact
  `contextOptions.deviceScaleFactor` values `1`, `1.5` and `2`; each provides
  the same value through the closed typed `BrowserMatrixFactor` context.
- The test compares each real `window.devicePixelRatio` with the injected
  expected factor. The main-document case controls a non-zero container,
  compares measured CSS dimensions with rounded factor-scaled backing
  dimensions, proves an opaque far backing pixel, performs a provider-backed
  click at the canvas CSS center and observes backing-size changes only after
  a real container resize path.
- Popup creation occurs synchronously inside the handler reached by
  provider-backed `userEvent.click()`. A null result fails. The assertions
  prove a distinct same-origin-accessible `Window` and `Document`, top-level
  identity, retained opener and expected DPR; there is no iframe, detached
  document or mock fallback.
- The production `AtlasRenderer` mounts directly into the popup document.
  Queries and ownership checks cover its root, canvas, semantic controls and
  native dialog; real list/graph/details interaction proves stable-ID
  selection, modal opening and popup-document focus.
- Only the popup window's real `ResizeObserver`, `requestAnimationFrame` and
  `cancelAnimationFrame` are wrapped. Observed targets, requested frames,
  disconnect and cancellation evidence therefore cannot be satisfied by the
  opener's corresponding APIs.
- Normal-path `destroy()` assertions positively cover dialog closure, exactly
  one observer disconnect, cancellation of the captured pending popup frame,
  an empty pending-frame set, detached renderer DOM, an empty container and
  no state/dialog reactivation from captured controls. The popup itself is
  closed in `finally`, including assertion-failure paths.
- The focused script owns only the matrix project, while the default run
  discovers it. Include/exclude rules keep P5 browser, P7a integration and
  P7b generated owners disjoint. The full diff changes no existing P5/P7a/P7b
  test, product source, dependency, lockfile, CI workflow, performance
  threshold or release file and adds no screenshot baseline.
- The records consistently bound this to real Chromium popup evidence and
  explicitly leave Obsidian Desktop/Electron pop-out, monitor transition,
  Mobile and assistive-technology proof to P7d.
- Executor-journaled focused, full-suite, build, discovery and diff-hygiene
  gates were inspected and trusted without rerunning them.

### Verdict

`concerns`

The behavioral matrix and ownership/teardown assertions are substantively
present, but the explicit failure-diagnostics contract is not yet satisfied.
The review acceptance criterion must remain open.

### Residual Risk

After the diagnostic repair, automated evidence will still be limited to the
installed headless Playwright Chromium contexts. It cannot certify live
Obsidian Desktop/Electron pop-outs, workspace-leaf integration, app CSS
injection, operating-system monitor/DPR transitions, Mobile or assistive
technology; those remain P7d.

### Repair Re-review Findings

None.

### Repair Re-review Verified

- `waitForCanvas()` now derives concrete expected backing width and height
  from the expected CSS width, CSS height and injected factor. Its diagnostic
  includes those four concrete dimensions, while `waitFor()` prefixes the
  owning DPR. The three callers retain distinct `main-document scale`,
  `main-document resize` and `popup ownership scale` boundary names.
- Every popup teardown assertion now carries explicit
  `[DPR <factor>] popup teardown` context: the pending-frame precondition,
  dialog closure, observer disconnect, captured-frame cancellation, empty
  pending-frame set, detached root, empty container, captured List and Details
  non-reactivation, Open and Center callback silence, and final popup closure
  in `finally`.
- Comparison with the original reviewed assertions found no removal or
  weakening. The repair only factors the existing backing calculations into
  named expected values and adds assertion diagnostics; all predicates,
  expected values, lifecycle operations and guaranteed popup cleanup remain.
- Repair journal and scope inspection show only the P7c matrix test and P7c
  records changed in this repair round. There is no repair-round expansion
  into configuration, product source, dependencies, lockfile, CI or another
  test owner.
- Post-repair executor gates and the targeted static diagnostic scan are
  journaled in this ticket and were trusted without rerunning them.

### Repair Re-review Verdict

`pass`

The authorized diagnostic repair closes the earlier significant finding
without weakening behavioral evidence or expanding implementation scope.

### Repair Re-review Residual Risk

The repaired messages are statically verified but the green runtime suite does
not deliberately force every diagnostic failure path. The evidence boundary
otherwise remains unchanged: headless Playwright Chromium does not certify
live Obsidian Desktop/Electron pop-outs, workspace-leaf integration, app CSS
injection, operating-system monitor/DPR transitions, Mobile or assistive
technology; those remain P7d.

## Retrospective

The installed per-instance provider seam was sufficient: one narrow test file
became three independently named real Chromium contexts without multiplying
the established P5 interaction suite. Supplying the expected factor through a
closed typed union prevented a test from merely restating whatever DPR the
browser happened to expose.

The strongest popup seam was native and small: a real `window.open()` inside
the synchronous handler reached through `userEvent`, immediate fail-closed
same-origin access, and `finally` cleanup. Wrapping only the popup's real
ResizeObserver and animation-frame functions preserved actual rendering while
making ownership and teardown observable. Copying the already imported
production stylesheet into the blank same-origin popup avoided inventing a
test-only renderer layout.

The only failed gate was static typing in new test helpers, not behavior.
Vitest spies needed their actual callback signatures, and a popup result
assigned inside an activation callback needed an explicitly mutable holder
for TypeScript control flow. Keeping that repair test-only preserved the green
browser assertions and the product-source stop boundary. The automated result
still proves Chromium contexts only; live Obsidian/Electron pop-out, workspace
leaves, app CSS injection, monitor transitions, Mobile and assistive
technology remain P7d evidence.

The independent review also showed that failure diagnostics are part of the
verification contract, not incidental test prose. Deriving expected backing
dimensions once and reusing them for both the predicate and timeout message
keeps failure output aligned with the assertion. A single factor-scoped
`popupTeardown` prefix makes every resource-specific teardown failure
actionable without weakening the underlying behavioral checks.
