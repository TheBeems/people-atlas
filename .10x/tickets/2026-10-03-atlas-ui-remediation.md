Status: done
Created: 2026-10-03
Updated: 2026-10-03
Parent: `.10x/tickets/2026-10-03-audit-remediation.md`

# Atlas interface consistency and accessibility

## Scope

Fix duplicate details, pane responsiveness, inactive center copy and filtered
focus; make Contact log immediately reachable and the current-projection search
scope explicit, under the existing KISS/accessibility contracts.

## Non-goals

No new graph store, vault-global search, implicit scope changes, new framework,
storage changes or native app installation.

## Acceptance criteria

- Standalone Persons shows exactly one visible selected-person details surface;
  Network, Follow-ups, Bases and mobile details retain appropriate actions.
- A 450px pane inside a 1200px viewport has accessible non-clipped controls;
  a 390px viewport still reflows. Use actual pane/container width.
- Alles says Hele netwerk; center controls do not misleadingly claim effect.
- Search bo, focus Bob, rename/delete Bob: focus reaches a remaining visible
  result or search input. No empty-list focus loss.
- Contact vastleggen is reachable before long relationship/history lists;
  secondary controls remain available and keyboard-accessible.
- NL/EN search labels explicitly state current-view scope; typing never
  changes center/projection/camera or writes notes.
- Regression tests cover these cases; owning window/lifecycle invariants hold.

## References

- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/mobile-touch-interaction.md`
- `.10x/specs/projection-modes-layout-state.md`

## Assumptions

User-ratified recommendations; this tightens presentation, not search population.

## Journal

- 2026-10-03: Opened from four confirmed Edge synthetic UI regressions.
- 2026-10-03: Implemented one standalone details owner, pane-width container
  layout, inert Whole network center copy, filtered-result focus fallback,
  an early primary contact action and explicit current-view search labels.
  Added browser and controlled-integration regressions; verification pending.
- 2026-10-03: Deferred source-review follow-up, outside this ticket's approved
  fixes: centerSelectedPerson persists selected-node mode/history, while the
  PeopleAtlasView constructor restores centerId but not selectedCenterPath.
  Reopening can therefore lose a chosen ego center. Relevant source:
  src/view/people-atlas-view.ts constructor, renderSnapshot and
  centerSelectedPerson. No-action disposition for this patch, confirmed by the
  orchestrator on 2026-10-03: this possible reopen-center behavior was not part
  of the concrete approved audit, has not been reproduced by closing/reopening
  in a host, and requires a separately scoped restore/center investigation.
  Trigger for later investigation: choose ego scope, center a person, close and
  reopen the view, and inspect the restored projection. No restore semantics
  are changed in this patch.
- 2026-10-03: Added optional PEOPLE_ATLAS_BROWSER_CHANNEL for explicit local
  browser selection, including DPR providers; absent configuration keeps the
  existing managed Chromium default. Initial Windows loader failure was later
  no longer reproducible in a fresh native process. No security policy or
  dependency changes were made for this ticket.
- 2026-10-03: Documented the explicit Edge override and controlled/native
  Obsidian distinction in README.md Development.
- 2026-10-03: Native canonical renderer/component browser suites passed 52/52;
  controlled UI integration passed 5/5 and Node discovery/selection passed 8/8.
  The new primary-action test was then strengthened with actual contact-history
  content and passed its focused rerun. The initial integration fixture used a
  hidden attribute overridden by its CSS; explicit fixture display hiding
  corrected the duplicate locator without changing production assertions.

## Blockers

None for this scope. Independent review and the parent-owned full test/build
gates passed on 2026-10-03. Native Obsidian Computer Use remains unverified.

## Evidence

- Single details owner and retained Bases/Network/Follow-ups actions:
  test/integration/atlas-ui.integration.test.ts, 5/5 passed with
  PEOPLE_ATLAS_BROWSER_CHANNEL=msedge and ordinary native Vitest.
- Pane width and center copy: the same integration suite asserts actual
  450px/1200px and 390px/390px layout, control bounds and 44px mode targets,
  plus NL/EN Whole network copy and preserved center choice after returning.
- Filtered focus and action order: test/browser/atlas-renderer.browser.test.ts
  plus renderer-component-boundaries.browser.test.ts passed 52/52. The focus
  cases cover rename, deletion and empty filtered results. After adding a real
  contact-history fixture, the primary-action case passed 1/1 focused rerun.
- Discovery and unchanged selection behavior: test/integration-runner.test.ts
  plus test/view-selection-center.test.ts passed 8/8. Integration discovery now
  compares the complete filesystem test population rather than a stale count.
- Additional asserted Edge synthetic run:
  .vitest-attachments/ui-remediation-2026-10-03/check.mjs and results.json.
  Results: one details block, preserved diagnostics and sheet actions,
  pane/scroll width 450/450 and 390/390, filtered focus recovery, zero pageerrors.
  Desktop and narrow-pane screenshots were inspected. This is actual source in
  a controlled runtime with fixture theme values, not native Obsidian.
- npm run typecheck, targeted Biome lint/format and git diff --check passed.

## Review

2026-10-03 independent source/assertion review by relationship-safety executor:
**PASS**. Findings by severity: no critical, significant or minor defect found
in the reviewed UI patch. Reviewed renderer/view/details/list changes, named
container rules, NL/EN labels, browser/integration assertions, browser-channel
configuration and README disclosure; inspected the recorded 450px-pane image
and synthetic results without rerunning executor tests.

The standalone view owns its single complete details composition; renderer
inline details remain the default for Bases, and the separately owned sheet
and follow-up composition are retained. Focus recovery queries rendered search
results and falls back to the search input only when filtered results are empty;
existing roving focus and owning-document lifecycle are preserved. Whole-network
copy disables the irrelevant center control without clearing the saved choice.
Primary contact actions retain their capability checks and delegated handlers.

Residual risk: reported browser measurements exercise current source in Edge
and a controlled Obsidian runtime, not native Obsidian/Desktop/Mobile themes or
popout acceptance. The existing owning-window/component tests remain relevant,
but no new native-host claim follows from them. Parent integrated gates remain
required. Concurrent contact-person-picker changes in shared styles/locales are
outside this UI review and have their own child/review boundary.

## Retrospective

The standalone host already owns a complete shared detail composition, so
omitting the renderer's duplicate inline composition was sufficient; Bases
retains the default composition. Focus fallback must operate on rendered search
results rather than raw snapshot order. Named container queries fix split-pane
layout without JavaScript sizing or a new renderer framework.
