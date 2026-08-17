Status: complete
Created: 2026-08-16
Updated: 2026-08-17
Parent: `.10x/tickets/2026-08-16-people-atlas-kiss-ux.md`
Depends-On: `.10x/tickets/2026-08-16-people-atlas-kiss-ux-phase-1-navigation-search.md`

# Fase 2 — grafiek en relaties

## Scope

Maak de betekenis van graph-relaties beter vindbaar via contextuele
relationship details. Gebruik bestaande `relationship-rows` en
`RelationshipDetailsPanel`; houd de graph zelf rustig. Zorg dat standalone,
renderer en Bases dezelfde rijke relatiebeschrijving, inferred-linktaal,
parallel-edge-identiteit en countscope gebruiken.

## Non-goals

- Geen permanente labels op iedere canvas-edge.
- Geen graph-edge-selection, edge-contextmenu of complexe legenda.
- Geen relatie-inferentie, merge of wijziging van note-backed metadata.
- Geen nieuwe graph-store of force-directed layout.

## Acceptance Criteria

- [x] Selectie van een persoon toont counterpart en beschikbare rol/type in
      het contextuele detailoppervlak.
- [x] Rich relationships behouden status, since en last-contact wanneer die
      aanwezig zijn.
- [x] Inferred links blijven als `Gekoppelde personen` en zijn niet editable.
- [x] Parallelle edges blijven afzonderlijk herkenbaar en action-safe.
- [x] Standalone-details tonen dezelfde relationship groups als shared details.
- [x] Geselecteerde incident edges mogen subtiel worden benadrukt zonder
      nieuwe permanente legenda.
- [x] Graph/list/scope counts zijn identiek wanneer ze worden getoond, of
      worden niet getoond.
- [x] Pure relationship-row- en projectiontests plus browserdetails-tests
      dekken iedere nieuwe branch.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/projection-modes-layout-state.md`
- `src/render/graph-canvas-surface.ts`
- `src/render/relationship-rows.ts`
- `src/render/relationship-details-panel.ts`
- `src/render/person-details-panel.ts`
- `src/view/people-atlas-view.ts`
- `test/relationship-rows.test.ts`
- `test/project-graph.test.ts`
- `test/browser/atlas-renderer.browser.test.ts`

## Assumptions

- User-ratified: relatiebetekenis wordt contextueel ontsloten, niet via
  permanente edge-labels.
- Record-backed: edge-ID/path en inferred-linkcapabilities zijn stabiele
  bestaande contracts.

## Journal

- 2026-08-16: Ticket geopend; bestaande relationship-row-seam gekozen als
  kleinste herbruikbare implementatiegrens.
- 2026-08-17: Broninspectie bevestigde dat de gedeelde renderer en Bases al
  rich relationship rows tonen, maar `PeopleAtlasView` alleen profiel- en
  contactinformatie toonde. De standalone sidebar gebruikt nu dezelfde
  `RelationshipDetailsPanel` en `buildIncidentRelationshipRows`.
- 2026-08-17: Standalone relatie-acties zijn gedelegeerd via één listener met
  owning-documentcontrole; inferred edges krijgen geen acties. Focusherstel
  gebruikt `edge.id` plus relatiepad, zodat parallelle edges afzonderlijk
  blijven.

## Blockers

Geen blockers. De gerichte Fase 2-checks en de volledige repository-gate zijn
groen. De `fake-vitest.mjs`-melding in de aggregate-output is de opzettelijke
negatieve spawn-case van `test/integration-runner.test.ts`.

## Evidence

- `npm run typecheck` — pass.
- `npm run build` — pass.
- `npm run test:browser -- test/browser/atlas-renderer.browser.test.ts` — pass,
  44 tests; bevat standalone relationship-group- en parallel-focusregressie.
- `npx vitest run --project node test/relationship-rows.test.ts` — pass, 9
  tests.
- `npx vitest run --project node test/relationship-action-adapters.test.ts` —
  pass, 3 tests.
- `npm run test:integration` — pass, alle 9 integration files / 39 tests.
- `npm run test:browser-matrix` — pass op Chromium DPR 1, 1.5 en 2.
- `npx biome lint src/view/people-atlas-view.ts
  test/browser/atlas-renderer.browser.test.ts` — pass.
- `git diff --check` — pass.
- `npm run test` — exit 0; node 58 files/1062 tests, browser 12 files/176
  tests, integration 9 files/39 tests and DPR 1/1.5/2 each 2/2 passed.

## Review

Self-review / adversarial review 2026-08-17: pass voor de Fase 2-scope.
De canvas krijgt geen permanente edge-labels, legenda of nieuwe graph-state;
de bestaande rijke row-projection blijft de enige bron voor rol/type/status/
datums. Standalone, renderer en Bases gebruiken dezelfde relationship groups;
inferred rows blijven niet-bewerkbaar en acties dragen edge-id plus pad.
Lifecycle-cleanup verwijdert de sidebar-listener en vernietigt de panel-owned
DOM. De volledige repo-gate is inmiddels groen; de resterende
`fake-vitest.mjs`-regel is alleen verwachte negatieve-case-output.

## Retrospective

De kleinste veilige wijzigingsgrens was het aansluiten van de al bestaande
row/panel-seam op de standalone sidebar. Daardoor was geen wijziging aan
graph-layout, relatie-inferentie of datastructuur nodig. De belangrijkste
les voor Fase 3 was om de actievolgorde en focuscontracts van deze gedeelde
detailsurface te behouden wanneer `Contact vastleggen` prominenter wordt;
Fase 3 en de eindgate zijn inmiddels afgerond.
