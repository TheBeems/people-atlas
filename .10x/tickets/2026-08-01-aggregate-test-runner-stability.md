Status: done
Created: 2026-08-01
Updated: 2026-08-01

# Stabiliseer de aggregate Vitest-runner

## Scope

Onderzoek, reproduceer en herstel uitsluitend de oorzaak waardoor de canonieke
`npm run test`-aggregate-run incidenteel faalt terwijl de betrokken Vitest-
projecten afzonderlijk groen zijn. De oplossing mag alleen test-runner-,
testconfiguratie-, testlifecycle- of testisolationgedrag raken dat direct door
een bewezen oorzaak wordt vereist.

## Non-goals

- Productfunctionaliteit, Obsidian-integratie, person-/relationshipsemantiek
  of P1a/P1b/P1c-gedrag wijzigen.
- Tests overslaan, verwijderen, verzwakken, quarantainen of de browsermatrix
  verkleinen om een valsgroene run te krijgen.
- Timeouts verhogen zonder een bewezen timingoorzaak en een minimale
  reproduceerbare regression boundary.
- Dependencies upgraden, CI-infrastructuur herontwerpen, committen, pushen,
  releasen of publiceren zonder afzonderlijke autorisatie.

## Acceptance criteria

- [x] De exacte aggregatefailure is gereproduceerd, of een herhaalbare
      afwezigheid is eerlijk vastgelegd met een onderbouwde
      resource-/lifecyclevergelijking tussen aggregate en geïsoleerde runs.
      De eerder vastgelegde RED (750 passed, 6 wisselende failures) is bewust
      als evidence behouden; drie groene post-fix runs staan in de evidence.
- [x] De oorzaak is bewezen met een kleinste red-capable loop; hypothesen en
      uitkomsten staan in het journal/evidence. De grens is de oorspronkelijke
      gelijktijdige `vitest run`: RED, ook met alleen
      `--no-file-parallelism`, tegenover exact vier los gestarte projecten:
      groen. Toeschrijving blijft 85% wegens het niet volledig uitsluiten van
      een verborgen gedeelde resource.
- [x] Er bestaat een gerichte regressie- of configuratieproef die vóór de fix
      faalt of de defecte parallelle/lifecycleconditie zichtbaar maakt: de
      vastgelegde oude aggregate en `--no-file-parallelism`-probe waren rood;
      de sequentiële projectprobe was groen.
- [x] De minimale fix behoudt alle bestaande testgevallen, assertions,
      browser-matrixfactoren en productgedrag: één `package.json`-scriptregel
      start de bestaande projecten node → browser → integration →
      browser-matrix; het nodeproject behoudt zijn interne parallelisme.
- [x] `npm run test` slaagt drie opeenvolgende keren in deze Node 24-omgeving.
- [x] `npm run typecheck`, `npm run build` en `git diff --check` slagen.
- [x] Een onafhankelijke reviewer beoordeelt oorzaak, diff, testdekking en
      eventuele resterende omgevingrisico's vóór sluiting.

## References

- `.10x/research/2026-08-01-aggregate-vitest-runner-flakiness.md`
- `.10x/tickets/2026-08-01-await-declarative-settings-persistence.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `package.json`
- `vitest.config.ts`
- `vitest.performance.config.ts`
- `AGENTS.md`

## Assumptions

- User-ratified: de P1-keten pauzeert; er moet een apart ticket worden
  aangemaakt en uitgevoerd om de aggregate-testflakiness te herstellen.
- Record-backed: de betrokken afzonderlijke browser-, browser-matrix- en
  node-performance-runs waren groen; de aggregate-run faalde met wisselende
  tests.
- Begrensd restrisico: de diagnose werd onder Node 22.23.1 uitgevoerd en
  sluit een verborgen gedeelde resource niet volledig uit; de minimale
  mitigatie is vervolgens drie keer onder Node 24 gevalideerd.

## Blockers

None. De gebruiker autoriseerde diagnose en implementatie binnen deze strikte
ticketgrens. Indien na drie onderscheiden hypothesen geen oorzaak is bewezen,
stoppen en escaleren naar shaping in plaats van een vierde gokfix te proberen.

## Journal

- 2026-08-01: Ticket geopend na P1a. De P1a-implementatie en onafhankelijke
  review zijn inhoudelijk groen, maar de formele `npm run test`-gate faalde met
  zes niet-gerelateerde aggregate-projectgevallen. De gebruiker koos bewust
  voor herstel boven residuele-risicoacceptatie.
- 2026-08-01: Read-only onderzoekagent gestart; geen runner-, test-,
  productcode- of dependencywijziging uitgevoerd door de orchestrator.
- 2026-08-01 (diagnose): de agent vond 2 logische CPU's, circa 2,9 GiB RAM en
  geen swap. `vitest run` overlapte node-, browser-, integration- en drie
  DPR-browser-matrixprojecten. Alleen `--no-file-parallelism` bleef niet-groen;
  een functioneel equivalente sequentiële projectrun was groen (exit 0; circa
  77,2 s). Best onderbouwde oorzaak: projectbrede resourcecontention/
  Chromium-scheduling starvation (85% zekerheid), niet een productregressie.
  Geen bestanden gewijzigd tijdens onderzoek.
- 2026-08-01 (uitvoeringspreflight, vóór fix): bestaande RED-evidence bewust
  behouden in plaats van de onstabiele parallelle aggregate opnieuw te starten:
  `vitest run` faalde met 750 passed en 6 wisselende failures; de
  `--no-file-parallelism`-probe bleef eveneens niet-groen. De bewezen
  controlediagnose was exact de vier bestaande projecten in de volgorde node,
  browser, integration, browser-matrix, sequentieel groen (exit 0; circa
  77,2 s). Daarom is uitsluitend deze projectgrens-orchestratie geautoriseerd;
  geen test-, configuratie- of productfix wordt gegokt.
- 2026-08-01 (implementatie): alleen `package.json` gewijzigd: de canonieke
  `test`-scriptregel start nu de vier bestaande Vitest-projecten als aparte
  processen met `&&` in deze volgorde: node, browser, integration,
  browser-matrix. Geen test-, product-, dependency-, browserconfig-, timeout-,
  matrix-, CI- of lockfilewijziging gedaan; intern nodeparallelisme bleef
  ongemoeid.
- 2026-08-01 (verificatie, Node v24.18.1 / npm 11.16.0): drie direct
  opeenvolgende `npm run test`-runs waren groen. Daarna waren `npm run
  typecheck`, `npm run build` en `git diff --check` groen. De scriptinvariant
  is expliciet gecontroleerd: exacte verplichte volgorde aanwezig en geen
  `--no-file-parallelism` of `passWithNoTests`.

## Evidence

### RED en diagnose vóór de fix

- Bestaande aggregate RED: de oorspronkelijke `vitest run` faalde eerder met
  750 passed en zes wisselende failures. De probe met alleen
  `--no-file-parallelism` bleef niet-groen.
- Kleinst onderscheidend experiment: exact de vier bestaande projecten als
  aparte processen in de volgorde node → browser → integration →
  browser-matrix was groen (exit 0; circa 77,2 s); afzonderlijke browser-,
  browser-matrix- en node-performance-runs waren eveneens groen.
- Hostdiagnose: 2 logische CPU's, circa 2,9 GiB RAM en geen swap; één gewone
  aggregate liet node, browser, integration en drie DPR-Chromium-contexten
  gelijktijdig concurreren. Best onderbouwde oorzaak blijft daardoor
  projectorchestratie/resourcecontention (85%), niet een productregressie.

### Minimale reparatie

- `package.json` verandert uitsluitend `scripts.test` van `vitest run` naar
  `vitest run --project node && vitest run --project browser && vitest run
  --project integration && vitest run --project browser-matrix`.
- De bestaande vier projectnamen, inclusions/exclusions, assertions,
  browsermatrixfactoren (DPR 1, 1.5, 2), timeouts en productcode bleven
  ongewijzigd. `&&` beëindigt de keten bij een projectfailure; er is geen
  skip/quarantaine, `--passWithNoTests`, timeoutverhoging of
  `--no-file-parallelism` toegevoegd.

### Canonieke post-fix-runs (volledig sequentieel)

- Run 1: exit 0, 66,639 s — node: 47 bestanden / 661 tests; browser: 8 / 75;
  integration: 6 / 14; browser-matrix: 3 / 6.
- Run 2: exit 0, 66,413 s — node: 47 bestanden / 661 tests; browser: 8 / 75;
  integration: 6 / 14; browser-matrix: 3 / 6.
- Run 3: exit 0, 65,482 s — node: 47 bestanden / 661 tests; browser: 8 / 75;
  integration: 6 / 14; browser-matrix: 3 / 6.

### Overige gates

- `npm run typecheck`: exit 0, 5,387 s.
- `npm run build`: exit 0, 5,585 s (inclusief zijn eigen `typecheck`).
- `git diff --check`: exit 0, 0,019 s.

### Limiet

- De drie groene runs bevestigen de lokale Node 24-mitigatie, niet dat op elke
  CI-host nooit een ongerelateerde fout kan optreden. De eerdere RED is
  daarom eerlijk behouden als pre-fix-evidence; een verborgen gedeelde
  testresource is met 85% causaliteitszekerheid niet volledig uitgesloten.

## Review

- 2026-08-01: Onafhankelijke red-teamreview — **pass**. Geen security- of
  logische bevindingen. De reviewer bevestigde de volledige volgorde node →
  browser → integration → browser-matrix, behoud van intern nodeparallelisme
  en afwezigheid van skips, matrixreductie, timeoutwijzigingen,
  `--passWithNoTests` en `--no-file-parallelism`.
- Niet-blokkerend restrisico: `&&` rapporteert alleen de eerste projectfailure
  per run. Maak uitsluitend bij behoefte aan volledige failure-inventaris een
  apart diagnostisch CI-ticket; dit wijzigt de fail-closed quality gate niet.
- De reviewer accepteerde de 85%-oorzaakclaim en Node-22-diagnoselimiet als
  expliciet begrensd, omdat drie volledige Node-24-runs groen zijn.

## Retrospective

De juiste reparatie serializeert alleen de resourcezware projectgrens. Dit
behoudt testdekking en interne nodeparalleliteit en maakt de canonieke gate
betrouwbaar op de onderzochte beperkte host zonder een inhoudelijke test te
verzwakken.
