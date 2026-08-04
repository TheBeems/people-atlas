Status: done
Created: 2026-08-04
Updated: 2026-08-04
Depends-On: `.10x/tickets/2026-08-04-release-0.9.0-alpha-prep.md` (local gate repair; no code or external release dependency)

# Contextuele acties en vereenvoudigde settings

## Scope

Implementeer `.10x/specs/contextual-actions-and-settings-simplification.md` in
één begrensd ticket, nadat de huidige actieve naming-ticket is gesloten en een
verse uitvoeringcontinuatie is geautoriseerd:

1. behoud en verifieer de bestaande canonieke `Open note`-actie in het graph
   details-sheet en zorg dat de actuele build deze levert;
2. voeg alleen op canonieke persoonsnotities in leesweergave `Add relationship`
   toe naast `Edit person`, via de bestaande path-gebaseerde create-entrypoint;
3. beperk de declaratieve Settings-UI tot People root folder, My person,
   Relationship templates en Show labels, zonder opgeslagen schemawaarden of
   laad-/validatiesemantiek te wijzigen.

## Niet doen

- Geen tweede open-route, filemanageractie, pad-/displaynaamgok of write vóór
  een expliciete Save.
- Geen relatieactie voor relatienotities of niet-canonieke notities.
- Geen wijziging aan `PeopleAtlasSettings`, defaults, loader, validator,
  frontmattermodel, migrations of backwards compatibility.
- Geen nieuwe advanced settings, centrumsemantiek, Bases-registratiewijziging,
  dependency, lockfile, versioning, commit, push, release of live-vaultwrite.

## Verticale TDD-uitvoering

### Slice 1 — Leesweergave-relatieactie

- Schrijf eerst een integratieregressie die aantoonbaar rood faalt omdat de
  canonieke persoonsnotitie alleen `Edit person` heeft.
- Implementeer de minimale tweede native knop en lifecycle-owned listener die
  exact `openCreateRelationship(sourcePath)` aanroept.
- Herhaal de selector groen; assert exact bronpad, geen andere editorroute en
  geen plugindatawrite vóór Save.
- Breid met één stale/canonical regressie uit indien de bestaande create-
  entrypoint die nog niet op de publiek aangeroepen route bewijst.

### Slice 2 — Settings-inventory

- Schrijf eerst een node-structuurtest die rood faalt op de huidige 44
  zichtbare controls/schema-pagina's en de gewenste drie controls plus template-
  lijst specificeert.
- Verwijder uitsluitend de niet-zichtbare declaratieve definitions en pas de
  huidige flatteningtest aan; laat settings types, defaults, load en validation
  byte-/semantiekexact intact.
- Bewijs groen dat uitgesloten keys nergens in de geretourneerde boom zitten,
  de template-lijst nog éénmaal bereikbaar is, My person een dropdown blijft en
  `getSettingDefinitions()` geen I/O/mutatie aanroept.

### Slice 3 — Bestaande open-route en actuele build

- Breid alleen waar nodig de browser-/integratieasserties uit voor de
  details-sheet: `Open note` is eerste actie, verschijnt alleen voor een
  resolved canonieke persoon en activeert de bestaande callback zonder write.
- Run gerichte node, browser en integratiefiles; bouw vervolgens de actuele
  bundle en voer een handmatige live Obsidian-reload/smoke alleen uit als de
  lokale hostomgeving beschikbaar is. Rapporteer die live beperking eerlijk.

### Review en gates

- Journaliseer per slice exact RED/GREEN-commando, exits en testcounts.
- Laat vóór de eerste volledige gate een onafhankelijke read-only review de
  scoped diff tegen spec en supersessies falsifiëren.
- Herstel echte reviewfindings uitsluitend met een nieuwe gerichte regressie;
  vraag daarna een verse review.
- Na semantische stabiliteit: één Node-24 `npm run test`, `npm run build` en
  `git diff --check`; houd de full gate actueel na latere code/testwijziging.
- Sluit uitsluitend bij onafhankelijke PASS en actuele groene gate. Commit/push
  blijft expliciet niet geautoriseerd.

## Acceptance criteria

- [x] Alle criteria uit de actieve spec zijn aantoonbaar behaald.
- [x] Iedere wijziging heeft test-first RED→GREEN-evidence.
- [x] De finale effectieve settingsinventory is beperkt tot de geratificeerde
      items; opgeslagen defaults/schemawaarden zijn niet gewijzigd.
- [x] De current graph-sheet open-route en de nieuwe Read View create-route zijn
      canonical-, stale- en write-safe.
- [x] Gerichte suites, finale gates en `git diff --check` zijn groen onder
      `/home/nms/.local/node24`.
- [x] Onafhankelijke review: PASS.

## Blokkers

None. De lokale 0.9.0 release-copydependency is als afzonderlijk, niet-publicerend
ticket gesloten; de gedeelde actuele Node-24-gate en beide onafhankelijke reviews
zijn groen.

## Journal

- 2026-08-04: Shaping na source-, spec- en testonderzoek. De actuele graph
  renderer bevat reeds `Open note` met de bestaande `onOpenNode`-callback; de
  browsertests dekken aanwezigheid en activatie. De screenshot kan daarom een
  oudere/niet-herladen bundle tonen; dat is geen grond voor duplicaatlogica.
- 2026-08-04: De huidige Reading View-postprocessor heeft voor een persoon één
  `Edit person`-knop en routeert al via lifecycle-owned `MarkdownRenderChild`.
  `openCreateRelationship(sourcePath)` bestaat, hercontroleert een canonieke
  persoon en opent de bestaande modal zonder write vóór Save. Het is de minimale
  juiste vervolgroute voor `Add relationship`.
- 2026-08-04: Settingsaudit: de huidige declaratieve boom exposeert 44 controls
  plus de relationship-template-lijst. Alleen People root folder, My person en
  Show labels leveren dagelijkse waarde; templates blijven een zelfstandig
  beheeroppervlak. Property/ID/type mappings, raw Default center ID,
  Enable Bases, Show diagnostics en role format zijn schema-/technische keuzes
  zonder passend dagelijks settingsnut en worden uitsluitend uit de UI verwijderd.
- 2026-08-04: Geen productcode, test, build, dependency, plugindata,
  vaultcontent, staging, commit, push of release gewijzigd. De worktree was
  schoon op `main...origin/main`; Node 24.18.1 en npm 11.16.0 zijn eerder in
  deze shaping-run waargenomen.
- 2026-08-04: De workflowdependency is opgelost doordat
  `2026-08-03-presentation-first-dossier-naming` record-only naar `done` is
  gesynchroniseerd. De gebruiker autoriseerde een verse execution continuation;
  dit ticket is naar `active` gepromoveerd. De bestaande dirty 10x-records
  blijven baseline en worden niet opgeschoond, gestaged of gerevert.
- 2026-08-04: **Reading View, strict TDD.** Vóór productiecode faalde
  `npm exec -- vitest run --project integration
  test/integration/note-context-actions.integration.test.ts -t "routes Add
  relationship from a person Reading View action"` onder Node `v24.18.1` met
  exit 1: **1 failed / 8 skipped**; de werkelijke actiebalk bevatte alleen
  `Edit person`. De minimale GREEN voegt voor uitsluitend een canonieke
  persoonsbron een tweede owner-document-native knop toe en routeert die alleen
  naar `openCreateRelationship(context.sourcePath)`. Dezelfde selector is groen
  met **1 passed / 8 skipped**; de volledige integrationfile is daarna groen met
  **9/9** en bewijst geen plugindatawrite bij activatie.
- 2026-08-04: **Settingsoppervlak, strict TDD.** De nieuwe dagelijkse-inventory
  test was RED tegen de oude vier pagina's, met exit 1 en één falende test. De
  minimale declaratieve wijziging houdt exact `People root folder`, `My person`,
  `Relationship templates` en `Show labels` in één General-groep zichtbaar;
  technische keys blijven buiten de boom. De settings-testfile is groen met
  **19/19**. Types/defaults/loaders/validators zijn niet gewijzigd; bestaande
  opgeslagen schemawaarden blijven dus ongewijzigd leesbaar zonder UI-write.
- 2026-08-04: Na Biome-format (4 scopebestanden, 2 layoutfixes) zijn de
  volledige settingsfile (**19/19**), note-context integration (**9/9**) en
  `npm run typecheck` opnieuw groen. Een added-line statische scan over de vier
  source/testpaden vond geen secrets, shell/eval, SQL/deserialisatie of
  debug-output. De onafhankelijke read-only review en de actuele volledige
  Node-24 `check`/build/repro-gate lopen nog en blijven closureblockers.
- 2026-08-04: De ene actuele volledige Node-24-gate is fail-fast gestart met
  `npm run check && npm run build && npm run verify:reproducible && git diff
  --check`. `check` faalde exit 1, ondanks **49/50 testfiles en 933/934 tests**:
  uitsluitend `test/community-readiness.test.ts` meldt de ontbrekende
  `.github/release-notes/0.9.0.md`. Inspectie van ongewijzigd `HEAD` bevestigt
  manifest/package `0.9.0`, geen 0.9.0-release-note en alleen notities tot
  0.8.0; dit is dus geen door deze ticketdiff veroorzaakte regressie. Build,
  reproduceerbaarheid en de gate-eigen whitespacecheck zijn conform fail-fast
  niet bereikt; geen retry of releasecopywijziging is uitgevoerd.
- 2026-08-04: Onafhankelijke read-only code-review: **PASS**. De reviewer
  beoordeelde alleen de vier code/testpaden vanaf `main`-basis
  `6df234c4aea6ab8192f9bd5fa73c2b1f25d69f03` (scoped-diff SHA-256
  `3067ba30ffbc23e4e81c368321730ff2efb0190346bb500b165d9e91cce801ab`),
  vond geen blocker en bevestigde de twee persoonsacties, canonical/stale-safe
  create-route, lifecycle, platte vier-item Settings-inventory en behoud van
  loader/validator/defaults. De reviewer wijzigde niets.
- 2026-08-04: De ontbrekende 0.9.0-releasecopy is uitsluitend via het aparte,
  niet-publicerende lokale ticket hersteld en onafhankelijk PASS-gereviewd.
  Daarna is één actuele gedeelde Node-24-gate volledig groen: `npm run check`
  passeerde 50/50 nodefiles (934/934), 10/10 browserfiles (130/130), 8/8
  integrationfiles (28/28) en 3/3 browser-matrixfiles (6/6), gevolgd door
  groene production/community/release-contractchecks. `npm run build` en
  `npm run verify:reproducible` slaagden; beide builds hadden SHA-256
  `a952761b1fb96d2180ca9c8173dc08c27db87ab1ba1f8b031a87202f21bd3c29`.
  De tag-validatie voor `0.9.0` bevestigde `main.js` 363400/409600 bytes en
  exact drie assets; `git diff --check` was groen. Geen staging, commit, push,
  tag, GitHub-write, publicatie of vaultwrite; de gegenereerde `main.js` blijft
  ignored en `main.js.map` is afwezig. Ticket closed.
