Status: done
Created: 2026-08-04
Updated: 2026-08-04
Depends-On: `.10x/specs/multilingual-user-interface.md` (active,
user-ratified); `.10x/tickets/2026-08-04-my-person-note-picker.md` (done)

# i18n-fundament en primaire interface (Nederlands/Engels)

## Userratificatie

Op 2026-08-04 vroeg de gebruiker om de vormgegeven meertaligheidsroute als
`$10x`-ticket vast te leggen: volg Obsidian's taal, start met Nederlands en
Engels, houd vaste UI-tekst los van identiteiten en vaultdata, en voeg geen
extra dagelijkse Settings-optie toe.

Het My-person-ticket is met onafhankelijke PASS en actuele volledige Node-24-
gate gesloten. Dit is daarmee de enige dependency-ready wijziging. De expliciete
gebruikersopdracht om de twee open tickets te implementeren autoriseert nu de
lokale uitvoering van dit ticket; commit, push en release blijven apart.

## Scope

Implementeer fase 1 van `.10x/specs/multilingual-user-interface.md`:

1. voeg een kleine, getypeerde interne i18n-laag toe met locale-normalisatie,
   Engels fallback en volledige Nederlandse/Engelse catalogi;
2. bepaal de initiële locale uitsluitend met de publieke Obsidian
   `getLanguage()`-API;
3. vertaal commandpalette-namen, ribbon-tooltip, Settings-labels/-beschrijvingen
   en gedeelde Notices in `src/main.ts` en `src/settings/`;
4. houd de bestaande vier dagelijkse Settings-items en alle huidige
   opslag-/writegrenzen intact;
5. leg de volgende tickets klaar als afzonderlijke scopes voor modals/views/
   toegankelijkheid en daarna diagnostics/locale-formattering.

## Niet doen

- Geen Language-setting, locale-override, hot runtime switch of extra
  persistente setting.
- Geen externe library, netwerkverzoek, telemetry, automatische vertaling of
  gewijzigde `minAppVersion`.
- Geen vertaling/mutatie van IDs, paden, bestandsnamen, frontmatterkeys of
  -waarden, user-authored namen/aliassen, template-namen of vrije
  relationshipwaarden.
- Geen i18n-import in pure `src/graph/`- of parsingcode.
- Geen omzetting van modals, views, Reading View, Bases, uitgebreide diagnostics
  of `Intl`-formatting buiten een gericht vervolg-ticket.
- Geen wijziging aan de nog open My-person-scope, dependencies/lockfile,
  versioning, commit, push, tag, release of live-vaultdata.

## Verticale TDD-uitvoering

### Slice 1 — locale en cataloguscontract

- Schrijf eerst een pure node-test die rood faalt voor `nl`, `en`, een
  hoofdletter-/variantlocale en een onbekende locale. Leg fallback naar Engels,
  keypariteit en messageparametercontracten vast.
- Implementeer de kleinste gebundelde, getypeerde resolver en catalogi zonder
  runtime-I/O of externe dependency.
- Herhaal groen; test dat iedere catalogus exact de Engelse keys en
  functieparameters implementeert.

### Slice 2 — commands, ribbon en Settings

- Schrijf een gerichte publieke Settings-/plugin-test die eerst rood bewijst dat
  `nl` en `en` andere vaste teksten renderen, terwijl command-ID's en de
  vier-item Settings-inventory gelijk blijven.
- Injecteer één translator aan de bestaande plugin-UI-grens en vervang alleen de
  fase-1 vaste UI-teksten. Houd `person_id`, control keys en opgeslagen waarden
  byte-/semantiekgelijk.
- Herhaal groen met een browser-/controlled-hosttest voor de relevante
  declaratieve Settings-tekst en toegankelijke controlnamen waar aanwezig.

### Slice 3 — gedeelde Notices en opslagonafhankelijkheid

- Schrijf een regressie voor één read-only of save-failure Notice die rood faalt
  op de gekozen locale, en een negatieve regressie die bewijst dat localekeuze
  geen `saveData`, indexrebuild, vaultwrite of viewstatewrite activeert.
- Centraliseer uitsluitend die gedeelde Notice-teksten in de catalogus en maak
  de regressies groen.
- Bewijs expliciet dat een Nederlandse en een Engelse testrun dezelfde
  `myPersonId`, settingspayload, frontmatter en user-authored waarden opleveren.

## Review en gates

- Journaliseer iedere assertion-grade RED/GREEN met exact commando, exit en
  testcount. Een ontbrekende import/stub is geen RED-evidence.
- Laat een onafhankelijke read-only review de catalogusdekking, fallback,
  pure-laaggrens en persistence-invarianten falsifiëren vóór de volledige gate.
- Herstel ieder reëel finding alleen met een gerichte regressie en vraag een
  verse review.
- Na semantische stabiliteit: één volledige Node-24 `npm run test`,
  `npm run build` en `git diff --check`.
- Sluit uitsluitend na onafhankelijke PASS en actuele groene gate. Commit,
  push en release zijn aparte gebruikersautorisatie.

## Acceptatiecriteria

- [x] `getLanguage()` bepaalt `nl`/`en`; onbekende of nog niet ondersteunde
      locales vallen altijd deterministisch terug op Engels.
- [x] De TypeScript-catalogi garanderen key- en parameterpariteit zonder een
      externe runtimedependency.
- [x] Commands, ribbon-tooltip, Settings en gedeelde fase-1 Notices zijn in
      Nederlands en Engels vertaald.
- [x] De Settings-inventory blijft precies vier dagelijkse items bevatten en
      localekeuze voegt geen settingsveld of write toe.
- [x] Localekeuze of tekstweergave verandert geen IDs, paden, settingspayloads,
      frontmatter, templates of andere user-authored data.
- [x] Pure graph-/parsingmodules blijven vrij van Obsidian- en i18n-imports.
- [x] Gerichte node- en controlled-browsertests, onafhankelijke review en de
      actuele volledige Node-24-gate zijn groen. Live Desktop/Mobile-taalgedrag
      blijft afzonderlijk en eerlijk gevalideerd.

## Blokkers

None.

## Journal

- 2026-08-04: Shaping op gebruikersverzoek. De bron heeft geen bestaande
  i18n-/translationlaag; vaste Engelstalige UI-teksten zijn bevestigd in
  `src/main.ts` en `src/settings/`. De lokale Obsidian 1.13-types bevestigen
  `getLanguage()` als publieke API sinds 1.8.7; `manifest.json` heeft
  `minAppVersion` 1.13.0.
- 2026-08-04: De gekozen eerste scope is bewust beperkt tot het i18n-fundament,
  commands/ribbon, Settings en gedeelde Notices. Modals, views/accessibility en
  diagnostics krijgen later eigen afhankelijke tickets zodat deze fase
  reviewbaar en TDD-gericht blijft.
- 2026-08-04: Geen productcode, test, build, plugindata, vaultinhoud, staging,
  commit, push, tag of release gewijzigd. Deze ticket en de bijbehorende
  specificatie zijn nieuwe shaping-records naast de reeds bestaande ongetrackte
  My-person-records.
- 2026-08-04: Dependency `2026-08-04-my-person-note-picker` is na onafhankelijke
  PASS en actuele Node-24-gate `done`. Dit ticket is conform de expliciete
  opdracht voor beide open tickets naar `active` gepromoveerd.
- 2026-08-04: Slice 1 assertion-grade RED:
  `npm exec -- vitest run --project node test/i18n.test.ts` faalde met 1/1:
  `resolveLocale("nl")` gaf onjuist `en`. De minimale getypeerde catalogus en
  locale-normalisatie maakten dezelfde test GREEN (1/1), inclusief `NL-be`,
  `en_US`, onbekende Engelse fallback, keypariteit en messageparameters.
- 2026-08-04: Slice 2 assertion-grade controlled-Chromium RED:
  `npm exec -- vitest run --project integration
  test/integration/i18n-primary-ui.integration.test.ts` faalde met 1/1 omdat
  Nederlandse hostlocale nog Engelse commandnamen registreerde. Na één
  construction-time translator uit publieke `getLanguage()` was de test GREEN
  (1/1): command-ID's bleven identiek, ribbon en vier Settings-items kregen
  locale-specifieke vaste tekst, zonder save of scan.
- 2026-08-04: Slice 3 assertion-grade controlled-Chromium RED:
  `npm exec -- vitest run --project integration
  test/integration/i18n-primary-ui.integration.test.ts -t 'localizes the shared
  read-only Settings notice without changing persisted state or indexing'`
  faalde met 1/2 omdat de Nederlandse read-only Notice Engels bleef. Na
  catalogusgestuurde gedeelde Notices was die selectie GREEN (1/2); de volledige
  i18n-integratie is GREEN (2/2) en bewijst gelijke `myPersonId`, settingspayload
  en seeded frontmatter zonder save, rebuild of scan.
- 2026-08-04: Actuele scoped verificatie: node `test/i18n.test.ts` plus
  `test/settings-tab.test.ts` 23/23; controlled Chromium i18n+My-person
  integration 9/9; browser relationship-template-settings 3/3; `npm run
  typecheck`, `npm run format:check` en `git diff --check` groen. De pure
  `src/graph/` en `src/index/` grenzen bevatten geen i18n/getLanguage-import.
- 2026-08-04: De twee afgescheiden, geblokkeerde vervolgscopes zijn voorbereid:
  `2026-08-04-i18n-interaction-accessibility-nl-en` en
  `2026-08-04-i18n-diagnostics-formatting-nl-en`. Zij zijn niet door dit ticket
  voor implementatie geautoriseerd. Onafhankelijke review en de volledige
  Node-24-gate van dit actieve ticket staan nog pending.
- 2026-08-05: Onafhankelijke read-only eindreview `deleg_57f0e113` was FAIL:
  een ontbrekende of ambigue opgeslagen `myPersonId` hield via
  `getMyPersonWarning()` een Engelse dynamische Settings-waarschuwing over.
  Geen securityfinding; de brede gate is daarom niet uitgevoerd.
- 2026-08-05: Remediatie met assertion-grade controlled-Chromium RED:
  `npm exec -- vitest run --project integration
  test/integration/i18n-primary-ui.integration.test.ts -t 'localizes unavailable
  My person Settings text without changing its stored ID or writing'` faalde
  1/3 op exact de Nederlandse, nog Engelse unavailable-waarschuwing. De kleinste
  reparatie voegde getypeerde unavailable/ambiguous My-person-messagecontracten
  toe en laat de bestaande UI-grens ze via de construction-time translator
  presenteren; opgeslagen IDs blijven ongewijzigd.
- 2026-08-05: Dezelfde gerichte regressie is GREEN (1/3). Actuele gerichte
  projecten zijn groen: i18n+My-person controlled Chromium integration 10/10;
  i18n+Settings node 23/23; `npm run typecheck`, `npm run format:check` en
  `git diff --check` groen. Door de semantische remediatie is een verse
  onafhankelijke rereview vereist; de volledige Node-24-gate blijft pending.
- 2026-08-05: Verse onafhankelijke read-only rereview `deleg_dccc1ea5`: PASS,
  zonder security- of logicfindings. De unavailable én ambigue My-person-routes
  zijn via de echte plugin/Settings-grens gefalsifieerd; de reviewer bevestigde
  vertaalde volledige waarschuwingen en nul persistente writes, scans of rebuilds.
- 2026-08-05: Eén actuele volledige Node-24-gate is groen:
  `/home/nms/.local/node24/bin/node` v24.18.1, npm 11.16.0;
  `npm run test` node 51 files/938 tests, browser 10/130, controlled Chromium
  integration 9/32 en browsermatrix 3/6; `npm run build` (typecheck + productie-
  build) en `git diff --check` exit 0. De fase-1-acceptatiecriteria zijn hiermee
  gesloten; live Desktop/Mobile-taalgedrag blijft afzonderlijk niet gevalideerd.