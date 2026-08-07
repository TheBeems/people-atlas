Status: draft
Created: 2026-08-07
Updated: 2026-08-07
Depends-On: `.10x/specs/reproducible-obsidian-release.md` (active)
Governed-By: `.10x/specs/reproducible-obsidian-release.md` § not applicable (UI/UX fix)

# Fix My Person dropdown empty on mobile — align with relationship form behavior

## User authorization

On 2026-08-07 the user reported that "Mijn persoon" dropdown in settings stays empty ("no valid person notes indexed") on mobile, while relationship form person selection works correctly. Investigation revealed inconsistent code: relationship form uses raw snapshot, My Person setting filters out all persons when any duplicate ID exists (even if user has no duplicates). On mobile the initial rebuildAll() runs before vault is ready, leaving snapshot empty. User asked to align My Person with relationship form behavior and add a manual rebuild command.

## Context / problem

Two issues:
1. **Inconsistent filtering**: `getMyPersonCandidates()` filters out ALL persons with duplicate IDs (both entries removed), while `resolveCanonicalPersonByPath` used by relationship form only checks filePath uniqueness. If user has no duplicate IDs, both should show same people — but the filter adds complexity and hides the real issue (empty snapshot on mobile).
2. **Mobile timing**: `PersonIndex.onload()` calls `rebuildAll()` immediately, but on mobile (Obsidian Sync, iOS/Android) the vault may not be mounted yet → `getMarkdownFiles()` returns empty → snapshot stays empty. No manual rebuild command exists.

Relationship form works because it receives `people` directly from snapshot at modal open time (which may have been populated by incremental events after initial empty rebuild).

## Scope

1. **Simplify `getMyPersonCandidates()`** in `src/main.ts`: return all snapshot people directly (consistent with relationship form), remove duplicate-ID filter.
2. **Keep validation at save time**: `getMyPersonWarning()` already validates configured ID exists and is unique — that remains the gate.
3. **Add "Rebuild People Atlas index" command** in `src/main.ts` for manual rebuild on mobile/desktop.
4. **Optional**: defer initial `rebuildAll()` until vault ready (but command makes this less critical).

## Non-goals

- Changing duplicate ID handling in relationship form or index core.
- Adding background/retry logic for initial rebuild.
- Changing any other settings or person selection UIs.
- Any commit, push, tag creation or actual release publication.

## Acceptance criteria

- [x] `getMyPersonCandidates()` returns `snapshot.people` mapped to candidates (no duplicate-ID filter).
- [x] `getMyPersonWarning()` still validates configured ID exists and is unique (unchanged).
- [x] New command "Rebuild People Atlas index" appears in command palette and calls `index.rebuildAll()`.
- [x] Settings "Mijn persoon" dropdown shows same people as relationship form person pickers.
- [x] `npx vitest run --project node test/settings-tab.test.ts` passes.
- [x] `npm run check` green.

## Blockers

None confirmed. Pure UI/logic alignment + one new command.

## Journal

- 2026-08-07: Created after user reported empty My Person dropdown on mobile while relationships work. Root cause: inconsistent filtering + mobile vault timing.
- 2026-08-07 (implementation): Simplified `getMyPersonCandidates()` to return all snapshot people (consistent with relationship form). Added "Rebuild People Atlas index" command with i18n keys. Updated integration tests for new behavior. All gates green: format, lint, typecheck, 1136 tests, build, release-contract, community-check.

- `src/main.ts` — `getMyPersonCandidates()`, `getMyPersonWarning()`, `addCommand()` calls
- `src/editor/relationship-form.ts` — `resolveCanonicalPersonByPath` usage
- `src/index/person-index.ts` — `rebuildAll()` method
- `.10x/specs/multilingual-user-interface.md` — i18n keys for new command