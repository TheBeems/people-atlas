Status: active
Created: 2026-08-01
Updated: 2026-08-01

# Declaratieve Settings-persistentie en templateverwijdering

## Purpose

Maak twee bestaande People Atlas Settings-handelingen volledig consistent met
de openbare Obsidian 1.13+ Settings- en modal-interfaces, zonder de huidige
validatie, schrijfbescherming of copied-value-semantiek te veranderen.

## Scope

Deze specificatie beheerst uitsluitend:

1. de asynchrone persistentiegrens van declaratieve setting controls; en
2. de expliciete bevestiging vóór verwijdering van een relationship template
   met gekoppelde relationship-notities.

## Settings persistence contract

1. `PeopleAtlasSettingTab.setControlValue(key, value)` MUST de bestaande
   `plugin.updateSetting(key, value)`-operatie afwachten en pas daarna
   resolven als `Promise<void>`.
2. De methode MUST geen tweede save-, index- of view-refreshpad toevoegen.
   `PeopleAtlasPlugin.updateSetting()` blijft de enige eigenaar van validatie,
   serialisatie, `saveData()`, rollback, index rebuild en atlas-view refresh.
3. Als `updateSetting()` een validatie- of persistente-fout afhandelt en
   `false` teruggeeft, MUST `setControlValue()` alsnog rustig resolven nadat
   die bestaande afhandeling is voltooid. Het mag geen exception verzinnen of
   de opgeslagen settings lokaal muteren.
4. Alle bestaande controls, hun keys, placeholders, validatie en read-only
   voorwaarden blijven functioneel identiek.

### Scenario: succesvolle controlwijziging

Given een schrijfbare, geldige People Atlas-instelling
When Obsidian de controlwaarde wijzigt
Then wacht de Settings-tab op de bestaande `updateSetting()`-levenscyclus
And resolveert hij pas nadat die levenscyclus klaar is
And validatie, bewaren, indexverversing en view-refresh blijven uitsluitend
onder eigendom van `updateSetting()`.

### Scenario: afgewezen of mislukte controlwijziging

Given `updateSetting()` de wijziging wegens validatie, schrijfbescherming of
een save-fout afwijst
When de declaratieve control terugschrijft
Then blijft de bestaande Notice/rollback-semantiek gelden
And voert de Settings-tab geen tweede write of refresh uit
And laat hij geen onbehandelde Promise-rejection achter.

## Template deletion confirmation contract

5. De deleteactie voor relationship templates MUST de bestaande
   `canManageRelationshipTemplates()`-schrijfbescherming controleren voordat
   een modal of write wordt geopend.
6. Bij nul gekoppelde relationship-notities MAY de bestaande directe delete
   zonder bevestiging behouden blijven.
7. Bij één of meer gekoppelde relationship-notities MUST People Atlas een
   openbare Obsidian `ConfirmationModal` gebruiken, niet `window.confirm()`.
8. De modal MUST duidelijk tonen:
   - de naam van de template;
   - het aantal gekoppelde relationship-notities; en
   - dat die notities hun gekopieerde types en rollen behouden, terwijl alleen
     hun templateprovenance niet langer naar een bestaande template verwijst.
9. Cancel, Escape, backdrop-dismiss en het sluiten van de modal MUST
   write-free zijn en de templatevolgorde behouden.
10. Alleen de expliciete primaire deleteactie MAY de huidige template op de
    oorspronkelijk gekozen index verwijderen. De mutatie MUST via de bestaande
    `plugin.updateSetting("relationshipPresets", presets)`-grens lopen.
11. Een geslaagde delete MUST de bestaande Settings-tab verversen. Bij een
    afgewezen of mislukte write blijven de lijst en de bestaande foutmelding
    consistent met `updateSetting()`.

### Scenario: gekoppelde template annuleren

Given template `Friend and colleague` is gekoppeld aan twee relationship-notities
When de gebruiker Delete kiest en daarna Cancel, Escape, backdrop-dismiss of
sluiten kiest
Then blijft `relationshipPresets` byte- en volgorde-equivalent
And worden geen relationship-notities, provenance, index of settingsdata
gewijzigd.

### Scenario: gekoppelde template bevestigen

Given template `Friend and colleague` is gekoppeld aan twee relationship-notities
When de gebruiker de primaire deleteactie bevestigt
Then verdwijnt uitsluitend die template uit `relationshipPresets`
And houden beide relationship-notities hun bestaande gekopieerde types en
rollen
And wijzigt People Atlas geen relationship-notitie of andere template.

### Scenario: ongekoppelde template verwijderen

Given een template geen gekoppelde relationship-notities heeft
When de gebruiker Delete kiest
Then mag de bestaande directe deleteflow zonder confirmation-modal doorgaan
And blijft dezelfde gevalideerde settings-writegrens gelden.

## Acceptance criteria

- [ ] `setControlValue()` levert een `Promise<void>` die pas na de bestaande
      `updateSetting()`-operatie resolveert.
- [ ] Elke bestaande control blijft precies één bestaande setting key schrijven
      via dezelfde validatie- en rollbackgrens.
- [ ] Gekoppelde templates krijgen een Obsidian-native
      `ConfirmationModal`; browser-native `confirm()` wordt voor deze actie
      niet meer gebruikt.
- [ ] De confirmatiecopy maakt het behoud van gekopieerde types/rollen en het
      verlies van alleen provenance expliciet.
- [ ] Alle niet-primaire sluitpaden zijn write-free.
- [ ] Ongekoppelde templates houden de directe bestaande flow.
- [ ] Gerichte unit-/browser- of integratietests bewijzen await-volgorde,
      success/cancel/failure en de read-only-grens.
- [ ] `npm run test`, `npm run build` en `git diff --check` slagen in de
      uitvoerende ticketcontext.

## Non-goals

- Nieuwe settingskeys, migraties, standaardwaarden of dataformaten.
- Wijziging van relationship-template copied-value-, bulk-sync- of
  relationship-note-semantiek.
- Een generieke confirmation-framework, custom alertstijl of wijziging van
  andere modals.
- Wijziging van de Settings-informatiearchitectuur; die valt onder
  `.10x/specs/settings-information-architecture.md`.
- Live Obsidian Desktop-, Mobile-, pop-out- of accessibilitycertificering.

## References

- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/settings/settings-tab.ts`
- `src/main.ts`
- `test/settings-tab.test.ts`
- https://docs.obsidian.md/Plugins/User+interface/Settings

## Assumptions

- User-ratified: de drie in de 1.13.4-audit geprioriteerde P1-verbeteringen
  krijgen een spec en tickets; deze specificatie begrenst daarvan de twee
  concrete Settings-/template-uitkomsten.
- Record-backed: `minAppVersion` is 1.13.0; `PluginSettingTab` accepteert
  `void | Promise<void>` en `ConfirmationModal` is openbaar sinds 1.13.0.
- Record-backed: `updateSetting()` is de bestaande enige serialisatie-,
  validatie-, save-, rollback- en refreshgrens.

## Blockers

None. Deze specificatie is een actief contract; uitvoering vereist nog een
expliciete implementatie-autorisatie voor een benoemd ticket.
