Status: done
Created: 2026-07-27
Updated: 2026-07-27

# P7d live/manual validation feasibility

## Question

What is the smallest evidence-honest P7d live/manual validation slice after
P7a-P7c, and which local prerequisites or user decisions block an executable
specification?

## Sources and Methods

Read-only inspection of:

- `.10x/tickets/2026-07-24-people-atlas-v2-plan.md`;
- `.10x/research/2026-07-26-p7-test-matrix-gap-analysis.md`;
- the terminal P7a and P7c tickets and their residual-risk boundaries;
- `.10x/knowledge/browser-scale-popup-testing.md`;
- `package.json`, `manifest.json`, `README.md`, `ROADMAP.md` and relevant
  live/manual references under `.10x/`, `src/` and `test/`;
- Windows file-version metadata for installed Obsidian candidates;
- the repository and generated release-artifact timestamps.

No build, test, GUI, plugin installation, vault inspection, app update or live
Obsidian session was performed.

## Findings

### Authority and proof boundary

- The active parent plan records the user's earlier ratification that live
  Obsidian Desktop, Bases and Mobile remain a separately initiated manual P7
  child. P7d therefore does not need to reopen the manual-versus-real-runtime-
  automation decision.
- P7a already owns controlled plugin/index/standalone/Bases lifecycle
  automation. P7c owns real Chromium DPR and top-level browser-popup evidence.
  P7d should not duplicate either matrix.
- The remaining product boundaries are actual Obsidian Desktop plugin load,
  actual Bases UI, an Electron/workspace pop-out, assistive-technology
  behavior and physical Obsidian Mobile interaction. Each result must name
  its runtime and must not be widened into certification of an untested
  platform.
- `manifest.json` declares `minAppVersion: 1.13.0` and
  `isDesktopOnly: false`; `package.json` develops against Obsidian `1.13.1`.
  A live run below Obsidian 1.13.0 cannot be acceptance evidence.

### Local readiness

- The installed candidate at
  `C:\Program Files\Obsidian\Obsidian.exe` reports product/file version
  `1.12.7`. No separate versioned hot-update package was found in the bounded
  application-directory inspection.
- Obsidian was not running during inspection.
- The repository contains current root and `release/people-atlas/` plugin
  artifacts, but timestamps alone do not prove that they match the current
  source or closed P7c commit.
- The binary-reported Desktop version is therefore a prerequisite blocker:
  live P7d must first update to and positively verify an Obsidian runtime at
  least `1.13.0`. Updating or launching the app is external state and was not
  authorized by this shaping inspection.

### Smallest recommended manual slice

Use a disposable synthetic vault, never a personal vault, and record exact app,
OS, device and assistive-technology versions with each result.

1. On compatible Obsidian Desktop, load the built plugin and exercise one
   bounded standalone/Bases scenario using stable IDs, an explicit
   relationship note, one filtered person and one unresolved endpoint.
2. Open the real Obsidian workspace pop-out and verify renderer ownership,
   focus/dialog behavior, CSS-backed layout and teardown there without
   restating the P7c Chromium DPR matrix.
3. Run one named desktop assistive-technology pass over Graph/List switching,
   list navigation, relationship descriptions, action focus and reduced-motion
   behavior.
4. On each user-ratified physical Mobile platform, verify tap, one-finger pan,
   pinch, two-to-one-finger partial lift, long press, bottom-sheet controls,
   touch-target usability and persistence after the final gesture.
5. Record pass/fail observations and their limits. Any valid live failure
   blocks P7d and requires separately authorized repair; manual evidence never
   silently changes production code or vault data.

## Conclusions

P7d should remain a manual evidence ticket, not a new automation project. The
next executable specification is blocked only by:

1. authorization to update and then verify the local Obsidian Desktop runtime
   at `>=1.13.0`;
2. selection of the named desktop assistive technology;
3. selection of the physical Mobile platform or platforms actually available
   for evidence.

After those values are ratified, one focused P7d specification and one
executable manual-evidence ticket can be opened. Implementation/live execution
must occur in a later turn.

## Limits

- Windows file-version metadata is not a live in-app version observation.
- No user vault, installed plugin directory, Obsidian settings, Bases file,
  screen reader or physical mobile device was inspected.
- The recommended scenarios are candidates until the three blockers above are
  ratified.
- One Mobile platform cannot certify another; any untested platform remains
  explicit residual risk.
