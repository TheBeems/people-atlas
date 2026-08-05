Status: done
Created: 2026-08-04
Updated: 2026-08-04
Depends-On: `.10x/specs/my-person-note-picker.md` (active, user-ratified); all
previous contextual-actions/settings and release tickets are done

# My person: doorzoekbare notitiekiezer

## Userratificatie

Op 2026-08-04 bevestigde de gebruiker expliciet de aanbevolen route: een
native, doorzoekbare notitiekiezer voor `My person`, met opslag van de stabiele
persoon-ID in plaats van een pad of vrij ingevoerde ID.

Deze status `active` staat voor de geautoriseerde lokale uitvoering.
Commit, push en release blijven afzonderlijke gebruikersautorisatie vereisen.

## Scope

Implementeer `.10x/specs/my-person-note-picker.md` als één begrensd,
dependency-klaar ticket:

1. vervang uitsluitend de zichtbare `My person`-dropdown door een native
   Obsidian file-control met vault-suggesties;
2. map de gekozen actuele canonieke persoonsnotitie veilig naar de bestaande
   `myPersonId`-opslagwaarde; behoud loader, validator, defaults en het gehele
   persistent contract;
3. filter/weiger gewone, stale en ambigue notities, ondersteun expliciet wissen
   naar `None`, en behoud een niet-mutatieve unavailable-waarschuwing;
4. vernieuw de geopende Settings-tab wanneer de People Atlas-index publiceert,
   zonder indexrebuild of write;
5. behoud exact de vier dagelijkse Settings-items en alle bestaande
   read-only-/writegrenzen.

## Niet doen

- Geen handmatig tekstveld voor `person_id`, pad- of displaynaamopslag, of
  automatische selectie uit de actieve notitie, graphnavigatie of een suggestie.
- Geen vaultscan, migratie, nieuwe settingspagina, aangepaste
  `Default center person ID`-semantiek, gewijzigde schema-instellingen of
  frontmatterwrite.
- Geen custom zoekmodal zolang de publieke native file-control de benodigde
  invoer, zoek- en selectieflow levert.
- Geen dependency-, lockfile-, versie-, commit-, push-, tag-, release- of
  live-vaultwijziging binnen dit ticket.

## Verticale TDD-uitvoering

### Slice 1 — ID-/padgrens

- Schrijf eerst een assertion-grade node-regressie voor de gewenste
  file-controlwaarde en een nieuwe selectie die `People/Alice.md` naar alleen
  `alice-id` vertaalt; de huidige dropdownimplementatie moet daarop rood falen.
- Implementeer de kleinste adapter aan de huidige Settings-get/set-grens. Houd
  de on-disk setting `myPersonId`; introduceer geen tweede persistente sleutel.
- Herhaal de selector groen. Voeg afzonderlijke negatieve regressies toe voor
  stale pad, niet-persoonsnotitie en dubbele ID; ieder geval mag nul writes
  opleveren.

### Slice 2 — native picker en lege/onbeschikbare toestand

- Leg met een browser-/hostcontroltest vast dat `My person` een native `file`
  control met filterbare vault-suggesties is, en dat leegmaken alleen
  `myPersonId` wist.
- Bewijs een naam/padbeschrijving voor een resolved keuze en een warning plus
  heldere lege-status voor unavailable/lege index, zonder automatische write.
- Houd testfixtures canoniek en gebruik echte indexcandidates; test geen private
  callbacks als vervanging voor de publieke settingscontrol.

### Slice 3 — index-publicatie tijdens geopende Settings

- Schrijf eerst een gecontroleerde integratie- of lifecycle-regressie die een
  geopende tab met lege initiële candidates ververst na een index-publicatie.
- Implementeer lifecycle-owned indexsubscription/cleanup via de bestaande
  Obsidian-registratiegrens. De refresh mag geen indexrebuild, vaultscan,
  plugindatawrite of viewstatewrite uitvoeren.
- Verifieer groen dat de nieuwe kandidaat kiest en de bestaande vier-item
  inventory ongewijzigd blijft.

## Review en gates

- Journaliseer per slice het exacte RED/GREEN-commando, exit en testcount in
  dit ticket; een bootstrap-/importfout geldt niet als RED-evidence.
- Laat na semantische stabiliteit een onafhankelijke read-only review de
  uiteindelijke source-, test- en recorddiff tegen de spec falsifiëren.
- Herstel ieder reëel reviewfinding met een gerichte regressie en vraag daarna
  een verse review.
- Voer pas na een onafhankelijke PASS één actuele volledige Node-24-gate uit:
  `npm run test`, `npm run build` en `git diff --check`.
- Sluit alleen na PASS-review en groene actuele gate. Commit/push/release blijft
  expliciete gebruikersautorisatie vereisen.

## Acceptatiecriteria

- [x] De gebruiker kan bij `My person` een canonieke persoonsnotitie typen,
      zoeken, selecteren en expliciet wissen met Obsidian's native file-picker.
- [x] Alleen een unieke actuele canonieke kandidaat kan naar de bestaande
      `myPersonId` worden opgeslagen; de keuze slaat geen pad of displaynaam op.
- [x] Een gewone, stale of ambigue notitie schrijft niets; een unavailable
      bestaande ID blijft een zichtbare waarschuwing zonder automatische mutatie.
- [x] Een tab die opent vóór de index klaar is, ververst veilig na publicatie en
      biedt dan de actuele kandidaten.
- [x] Settings openen, zoeken en index-refreshes veroorzaken geen vaultscan,
      indexrebuild, plugindatawrite, vaultwrite of viewstatewrite.
- [x] De dagelijkse Settings-inventory blijft exact vier items bevatten.
- [x] Gerichte node-, browser- en gecontroleerde integratietests zijn groen;
      daarna zijn de volledige Node-24-gate en `git diff --check` groen.
- [x] Onafhankelijke read-only review: PASS.

## Blokkers

None.

## Journal

- 2026-08-04: Shaping op verzoek van de gebruiker. Brononderzoek bevestigt dat
  `src/settings/settings-tab.ts` de huidige `My person`-dropdown opbouwt met
  `None` plus `plugin.getMyPersonCandidates()`. Die methode leest de indexsnapshot
  en sluit dubbele IDs uit; alleen `None` betekent dus een lege geldige
  kandidaatset op dat render-moment, niet dat een willekeurige notitie veilig
  als perspectiefanker kan worden opgeslagen.
- 2026-08-04: De lokale Obsidian 1.13-types bevestigen een publieke `file`
  settingscontrol met vault-file-suggester en filter. Het ticket gebruikt die
  hostroute, maar behoudt de bestaande stabiele-ID-persistentie via een
  pad-naar-canonieke-ID-adapter.
- 2026-08-04: Geen productcode, test, build, plugindata, vaultinhoud, staging,
  commit, push, tag of release gewijzigd. Alleen dit ticket en zijn nieuwe,
  expliciet geratificeerde specificatie zijn aangemaakt.
- 2026-08-04: Uitvoering gestart. Slice 1 assertion-grade RED:
  `npm exec -- vitest run --project node test/settings-tab.test.ts -t 'adapts a
  selected canonical person note path to the stable My person ID'` faalde met
  1/20 omdat de verwachte native `file` control nog `dropdown` was. Na de
  minimale pad-naar-unieke-ID adapter was dezelfde selectie GREEN (1/20).
  Een tweede RED voor de ambigue padfilter faalde met 1/21 (`true` in plaats van
  `false`); na fail-closed paduniekheid was die selectie GREEN (1/21).
- 2026-08-04: Slice 3 assertion-grade controlled-Chromium RED:
  `npm exec -- vitest run --project integration
  test/integration/my-person.integration.test.ts -t 'refreshes an open My
  person picker after index publication'` faalde met 1/7 omdat een index-
  publicatie geen tab-update veroorzaakte. Na lifecycle-owned display/hide
  subscription en cleanup was dezelfde selectie GREEN (1/7), zonder
  plugin-datawrite of extra indexscan.
- 2026-08-04: Eerste onafhankelijke read-only review: FAIL. De reviewer vond
  terecht dat `setControlValue` de file-invoer trimde, waardoor omgeven
  witruimte een niet-exact pad kon autoriseren en alleen witruimte impliciet
  kon wissen. Remediation kreeg een assertion-grade RED via
  `npm exec -- vitest run --project node test/settings-tab.test.ts -t
  'requires byte-exact picker paths and treats whitespace-only input as invalid
  rather than clear'` (1/22 failed, drie ongewenste writes). De adapter accepteert
  nu uitsluitend `value === ''` als clear en vergelijkt alle andere waarden
  byte-exact; dezelfde selectie is GREEN (1/22). De controlled lifecycletest
  bewijst bovendien dat herhaald `display()` geen dubbele subscription maakt.
- 2026-08-04: Actuele scoped verificatie na remediation: node
  `test/settings-tab.test.ts` 22/22; controlled Chromium integration
  `test/integration/my-person.integration.test.ts` 7/7; `npm run typecheck`,
  `npm run format:check` en `git diff --check` groen. Een verse onafhankelijke
  review is verplicht en staat nog pending; de volledige Node-24-gate is nog
  niet uitgevoerd.
- 2026-08-04: Verse onafhankelijke read-only eindreview: PASS, zonder security-
  of logic-findings. Zij bevestigt de native file-control, byte-exacte
  padresolutie, stabiele-ID-opslag, write-free ongeldige invoer, unavailable
  warning, vier Settings-items en lifecycle-cleanup zonder dubbele subscription.
- 2026-08-04: Actuele volledige Node-24-gate: PASS met `npm run test`,
  `npm run build` en `git diff --check`. Testprojecten: node 50 bestanden / 937
  tests; controlled Chromium browser 10 / 130; integration 8 / 29;
  browser-matrix 3 / 6. Build omvat opnieuw typecheck plus productie-esbuild.
  De ticketstatus is daarna `done`; er is geen commit, push, tag, release of
  live Desktop/Mobile-validatie uitgevoerd.