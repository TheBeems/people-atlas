Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — relationship modal
Depends-On: `.10x/specs/relationship-form-disclosure.md`

# Relationship-modal: contract- en lifecyclehardening

## Doel

Maak de recent verduidelijkte disclosuresemantiek expliciet en sluit de
bestaande async pending-close-race zonder de relationship mutation- of
persistencecontracten te verbreden.

## Geratificeerde contractkeuze

Een niet-lege persisted `presetId` representeert attached provenance, ook als
de actuele preset ontbreekt. In edit mode opent de Template-disclosure daarom
ook bij een missing template; de summary toont de missing-affordance. Alleen een
lege `presetId` blijft gesloten. Dit sluit aan op de huidige code en op de
bedoeling dat stale template-state zichtbaar en herstelbaar blijft.

## Scope

- regression en contracttest voor missing-template auto-open en summary;
- lifecycle guard voor close/unload tijdens een pending submit;
- lifecycle guard voor een pending template-creator-save nadat de parent-modal
  sluit; de onderliggende save-uitkomst blijft geldig, maar parent-refreshes
  worden overgeslagen;
- late success/error-resultaten mogen geen tweede close, late focus, open-file-
  actie of access tot gewiste controls veroorzaken;
- behoud de bestaande Advanced error association;
- maak de disclosure-aware validationregel expliciet: huidige Shortcut- en
  Template-controls hebben geen eigen submitvalidatie; toekomstige validatie
  moet de juiste disclosure openen en het veld associëren.

## Niet doen

- Geen wijziging aan mutation-, save-, template-copy- of persistencesemantiek;
- geen nieuwe validation frameworklaag;
- geen broad i18n-migratie — de bestaande i18n-diagnostics-ticket is eigenaar;
- geen wijziging aan People, Context of graph;
- geen commit, push, tag, release of vaultwrite.

## Verticale TDD

### Slice 1 — missing-template contract

- RED: leg vast dat edit mode met non-empty `presetId` de Template-disclosure
  opent, ook wanneer de preset ontbreekt, en de missing-summary toont.
- GREEN: align code/test alleen indien nodig met de bijgewerkte actieve spec.
- Assert dat empty `presetId` gesloten blijft.

### Slice 2 — pending close

- RED: controlled browser/integration test sluit de modal tijdens een pending
  save en laat daarna zowel late success als late error terugkeren; de test
  moet de huidige late-state-race aantonen.
- GREEN: voeg de kleinste generation/cancellation guard toe zodat late results
  worden genegeerd zodra de modal-sessie is gesloten of vervangen.
- Assert geen exception, dubbele `afterClose`, late focus of late open-file-
  actie; de mutation zelf blijft volgens het bestaande contract lopen.

### Slice 3 — disclosure validation contract

- Voeg een gerichte contractassertie toe dat bestaande Advanced-validatie zijn
  open/focus/aria-association behoudt.
- Leg in test/record vast dat Shortcut en Template momenteel geen eigen
  submit-time validation hebben; toekomstige field-validatie moet de
  disclosure-aware route gebruiken.

### Review en gates

- onafhankelijke read-only review tegen active disclosure-spec en parent spec;
- actuele Node-24 full gate plus browser/integration focus/lifecycletests;
- geen closure als late async-resultaten nog gewiste modal-state aanspreken.

## Acceptatiecriteria

- [x] Non-empty persisted `presetId` opent in edit mode de Template-disclosure,
      inclusief missing-template state; empty state blijft gesloten.
- [x] Missing summary en bestaande template-summary zijn correct en
      toegankelijk.
- [x] Close tijdens pending submit is exception-vrij en late success/error-
      resultaten muteren geen gesloten modal-state.
- [x] Een pending template-creator-save na parent-close veroorzaakt geen late
      parent-refresh, gewiste-controltoegang, Notice of form-resurrectie.
- [x] Er is geen dubbele close/afterClose, late focus of onverwachte open-file-
      actie.
- [x] Advanced error association blijft werken; de huidige afwezigheid van
      Shortcut/Template-submitvalidatie is expliciet getest/documenteerd.
- [x] Mutation-, save-only-write- en template-copy-contracten blijven gelijk.
- [x] Onafhankelijke review en actuele Node-24 full gate zijn groen.

## Blokkers

None bevestigd. De missing-template-keuze is in de actieve spec vastgelegd.

## Journal

- 2026-08-08 RED: de nieuwe late-success browserregressie faalde vóór de
  lifecycle guard omdat een resultaat na sluiten nog modal-effecten kon
  uitvoeren.
- 2026-08-08 GREEN: `relationship-modal.ts` gebruikt een generation-token dat
  vóór elke awaited submit wordt vastgelegd en na close/onOpen ongeldig wordt;
  late success/error stopt vóór close, focus, open-file of gewiste controls.
- 2026-08-08 verification: `npx vitest run --project browser
  test/browser/relationship-modal.browser.test.ts` → 22/22 groen; de node-
  gerichte relationship/person-formtests → 96/96 groen; `npm run typecheck`
  → exit 0. Missing-template en Shortcut/Template-disclosurecontracten blijven
  expliciet in de bestaande browsertests; er is geen mutation- of
  persistencecontract gewijzigd.
- 2026-08-08 independent read-only review: controlled Node 22.23.1/browser- en
  integrationchecks reproduceerden geen mobile-, My Person- of
  relationship-modal-reparatiefout, maar het verdict bleef `concerns` omdat de
  review vóór de laatste follow-upwijzigingen geen actuele Node-24/full-gate- of
  native Desktop/Mobile-evidence had. De reviewer signaleerde specifiek nog
  ontbrekende assertions voor persisted missing-template Save/no-write en een
  late-error Notice-sink; dit is geen productcontractwijziging.
- 2026-08-08 follow-up verification: de persisted missing-template-editcase
  verifieert nu Save zonder mutation (`updateRelationship` blijft ongebruikt),
  en de late-errorcase verifieert dat na close geen nieuwe Obsidian Notice wordt
  toegevoegd. De browser-suite blijft 22/22 groen en `npm run typecheck` exit 0.
  Deze follow-up maakt de eerdere review niet tot een actuele PASS; een nieuwe
  read-only review na deze wijzigingen blijft vereist.
- 2026-08-08 Node-24 focused verification: `node --version` → v24.18.1;
  `npx vitest run --project browser
  test/browser/relationship-modal.browser.test.ts` → 22/22 groen;
  `npm run typecheck` → exit 0; `git diff --check` → exit 0. Dit ondersteunt de
  relationship-modal acceptance in de controlled Chromium-runtime, maar is
  geen native Obsidian Desktop/Mobile-evidence en geen full-gatebewijs.
- 2026-08-08 RED→GREEN follow-up: een deferred template-creator-save werd na
  parent-close gesettled; RED was 22/23 doordat de callback alsnog
  `refreshTemplateOptions()` uitvoerde. `RelationshipModal` legt nu bij openen
  een lifecycle-generation vast, weigert callbacks die al na close starten en
  geeft voor een reeds gestarte save de uitkomst terug zonder parent-refresh.
  GREEN: `npx vitest run --project browser
  test/browser/relationship-modal.browser.test.ts` → 23/23 onder Node
  v24.18.1; `npm run typecheck` → exit 0; `git diff --check` → exit 0.
  Fresh onafhankelijke closure-review en actuele full gate blijven vereist.

## Evidence

De browser-suite bewijst de missing-template disclosure, empty-preset gesloten
state, pending relationship- en template-creator-close, late success/error en
behoud van Advanced error association. De suite draait in de controlled
browser-runtime: relationship-modal **23/23**, template-settings **9/9** en
partner/parent **2/2**. De Node-24 final gate is exit 0; node 53/964,
browser 10/158, integration 9/38 en DPR 6/6 zijn groen. Een echte Obsidian-
host is niet lokaal gevalideerd.

## Review

2026-08-08 actuele onafhankelijke repair-review: **PASS** voor modal-
disclosure, pending-close, template-save-generation en late-result guards.
Residueel: controlled Chromium/runtime, geen native Obsidian-hostvalidatie.

## Retrospective

Een generation-token is hier de kleinste veilige grens: de mutation mag
settelen, maar een gesloten modal-sessie mag geen UI-, Notice-, focus-,
open-file- of parent-refresheffect meer uitvoeren.

## Referenties

- `.10x/specs/relationship-form-disclosure.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/tickets/2026-08-06-relationship-form-disclosure.md` (historische
  missing-template-tekst, narrow superseded)
- `src/editor/relationship-modal.ts`
- `src/editor/relationship-form.ts`
- `test/browser/relationship-modal.browser.test.ts`
