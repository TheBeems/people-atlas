Status: complete
Created: 2026-08-16
Updated: 2026-08-17
Parent: `.10x/tickets/2026-08-16-people-atlas-kiss-ux.md`
Depends-On: None

# Fase 1 — navigatie, toolbar en zoeken

## Scope

Vereenvoudig de primaire navigatie en standalone/shared toolbar. Implementeer
de labels `Netwerk`, `Personen`, `Opvolging`, leesbare center/scopecopy,
één-hop `Directe relaties`, `Alles`, één zichtbare fit-control en een native
personenzoekfunctie. Behoud bestaande center-, projection-, camera-,
keyboard-, touch- en mutationgrenzen.

Betrokken seamgebieden zijn `PeopleAtlasView`, `AtlasRenderer`,
`SemanticPeopleList`, i18n en CSS. Bases-configuratie moet semantisch niet
breken; technische Bases-opties hoeven niet volledig te worden hernoemd in
deze child zolang de user-facing rendererlabels correct zijn.

## Non-goals

- Geen inhoudelijke wijziging van relationship rows of person details.
- Geen permanente edge-labels of graph drawingwijziging.
- Geen alias-search of snapshotuitbreiding.
- Geen wijziging van Markdown- of plugin-data-schema.
- Geen verwijdering van keyboard/touchzoom of Details-functionaliteit.

## Acceptance Criteria

- [x] De primaire controls heten overal `Netwerk`, `Personen` en `Opvolging`.
- [x] Centercontext gebruikt `Netwerk rond: <naam>` of een duidelijke
      `Hele netwerk`-variant zonder displaynaam als identity.
- [x] `Directe relaties` projecteert exact één hop en `Alles` free-network.
- [x] Er is maximaal één permanent zichtbare `Passend maken`-actie.
- [x] Zoom, pan, keyboard en touch blijven bereikbaar.
- [x] Personen bevat een native search control met clear/empty/focusgedrag.
- [x] Search filtert de huidige projectie en wijzigt geen center, scope,
      camera, vaultdata of projection mode tijdens typen.
- [x] Searchselectie gebruikt stabiele NodeIds en herstelt focus correct.
- [x] De onverklaarde globale node-/edge-count verdwijnt uit de primaire
      toolbar.
- [x] Pure en browsertests dekken scope mapping, search matching, selectie,
      focus en controlredundantie.
- [x] Geen bestaande accessible-renderer- of view-state-test wordt verzwakt.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/projection-modes-layout-state.md`
- `src/view/people-atlas-view.ts`
- `src/render/atlas-renderer.ts`
- `src/render/semantic-people-list.ts`
- `src/render/graph-canvas-surface.ts`
- `src/i18n/nl.ts`
- `styles.css`
- `test/browser/atlas-renderer.browser.test.ts`
- `test/view-selection-center.test.ts`
- `test/view-state.test.ts`

## Assumptions

- User-ratified: `Directe relaties` betekent één hop.
- Record-backed: center identity blijft stable-ID-gebaseerd.
- Mechanical: bestaande stored two-hop state blijft leesbaar maar wordt niet
  als directe-relatiescopy weergegeven.

## Journal

- 2026-08-16: Ticket geopend na source-backed UX review en ratificatie.
- 2026-08-17: Fase 1 uitgevoerd: primaire labels vereenvoudigd, dubbele
  standalone toolbaracties en globale node-/edge-count verwijderd, center- en
  scopecopy leesbaar gemaakt, directe relaties op één hop begrensd en native
  personenzoeken toegevoegd. Zoekselectie blijft NodeId-gebaseerd; bestaande
  graph-, camera-, keyboard-, touch- en detailsgrenzen zijn behouden.

## Blockers

Geen blockers. De volledige repository-gate is na de UX-fases groen; de
zichtbare `fake-vitest.mjs`-melding is de opzettelijke negatieve spawn-case in
de integration-runner en wordt als geslaagde failure-handling getest.

## Evidence

- `npm run typecheck` — passed.
- `npx vitest run --project node test/semantic-people-list.test.ts
  test/i18n.test.ts test/view-selection-center.test.ts test/view-state.test.ts`
  — 4 files, 9 tests passed.
- `npm run test:browser -- --run test/browser/atlas-renderer.browser.test.ts
  test/browser/renderer-component-boundaries.browser.test.ts` — 2 files, 47
  tests passed.
- `npm run test:browser-matrix` — Chromium DPR 1, 1.5 and 2 all passed.
- `npm run test:integration` — 9 integration files, 39 tests passed.
- `npm run build` — passed.
- `git diff --check` — passed.
- `npm run test` — exit 0; node 58 test files/1062 tests, browser 12/176,
  integration 9 files/39 tests and DPR 1/1.5/2 each 2/2 passed.

## Review

Self-review completed on 2026-08-17. No new regressions were found in the
modified seams; the existing accessible list, selection, layout, touch and
integration coverage remains active. The full gate and targeted lint/build
checks are green.

## Retrospective

De kleinste veilige wijzigingsgrens bleef de bestaande toolbar/list seam:
labels, scopecopy en search zijn aangepast zonder snapshot-, identity- of
vaultschemawijziging. De latere testgate liet zien dat releasefixturetests
newline- en Windows Bash/WSL-onafhankelijk moeten worden uitgelezen; dat is in
Fase 4 als infrastructuurtestreparatie afgehandeld.
