Status: done
Created: 2026-08-03
Updated: 2026-08-03

# Stabiliseer browser-photo-avatarcharacterization zonder timeoutverruiming

Parent: `.10x/tickets/2026-08-03-release-0.8.0-alpha.md`
Depends-On: None

## Scope

Onderzoek en herstel de reproduceerbare browsertimeout van
`test/browser/photo-avatar-characterization.browser.test.ts` die de enige
volledige 0.8.0-releasegate blokkeerde. Vind eerst de werkelijke wacht-/resource-
of lifecycleoorzaak en herstel die minimaal zonder timeout-, retry-, skip- of
assertieverruiming.

## Non-goals

- De globale of lokale testtimeout verhogen, retries toevoegen, de test skippen
  of performance-/cache-/destroyasserties verzwakken.
- Productgedrag wijzigen zonder reproduceerbaar bewijs dat productiecode de
  oorzaak is.
- Releasemetadata, releasenotes, versies, dependencies, lockfile of workflows
  wijzigen.
- Een brede repositorygate uitvoeren vóór onafhankelijke review van de fix.

## Acceptance criteria

- [x] De originele 15s-timeout is met een gerichte, diagnostische tight loop
      reproduceerbaar of als exacte resource-/ordeningafhankelijke conditie
      geïsoleerd; de root cause is met metingen vastgelegd.
- [x] Een assertion-grade regressie of diagnostische seam gaat vóór de fix rood
      op de echte oorzaak en niet alleen op verstreken wandkloktijd.
- [x] De minimale fix behoudt alle characterizationasserties, 15s-testtimeout,
      productiegedrag en de gecontroleerde Chromium-evidencegrens.
- [x] De betrokken browsertest en relevante vergelijkbare renderer-/photo-tests
      zijn herhaald groen zonder retry; formatter, typecheck en diffcheck slagen.
- [x] Een onafhankelijke read-only review geeft PASS; daarna mag de parentrelease
      opnieuw precies één volledige actuele gate uitvoeren.

## References

- `test/browser/photo-avatar-characterization.browser.test.ts`
- `test/performance/photo-avatar-characterization.ts`
- `test/performance/photo-avatar-fixture.ts`
- `src/render/atlas-renderer.ts`
- `vitest.config.ts`
- `test/browser-runner-config.test.ts`
- `.10x/research/2026-08-01-aggregate-vitest-runner-flakiness.md`
- `.10x/tickets/2026-08-01-aggregate-test-runner-stability.md`
- `.10x/tickets/2026-08-03-release-0.8.0-alpha.md`
- `AGENTS.md`, `ARCHITECTURE.md`

## Preconditions observed

- 2026-08-03: de releasegate draaide na schone `npm ci` en groene audit. Node
  was 858/858 groen; browser stopte op 126/127 en 9/10 files doordat uitsluitend
  `photo-avatar-characterization.browser.test.ts` na 15.000 ms time-outte.
- 2026-08-03: de semantisch identieke volledige gate vóór de releaseversiebump
  was 1018/1018 groen. De releasevoorbereiding wijzigt geen product- of testcode.
- 2026-08-03: host had bij eerste diagnose circa 915 MiB beschikbaar geheugen,
  geen swap, 22 GiB vrije schijf en geen achtergebleven Vitest/Chromiumproces.

## Blockers

None.

## Journal

- 2026-08-03: ticket geopend als afzonderlijke blocker; de timeout wordt niet als
  geaccepteerde flake of release-retry behandeld. De parentrelease blijft actief
  en geblokkeerd tot dit ticket onafhankelijk PASS krijgt.
- 2026-08-03 (systematische diagnose): de bestaande runnerresearch, het gesloten
  projectserialisatieticket, de rode releasegate en alle tijdelijke monitor- en
  stressartefacten zijn opnieuw gelezen. Runtime-handshake:
  `/home/nms/.local/node24/bin/node`, Node `v24.18.1`, npm `11.16.0`; hostgrens:
  2 CPU's, circa 3 GiB RAM en geen swap. Sinds de eerdere projectserialisatie is
  de browsersuite gegroeid van 75 naar 127 tests. Een gewone volledige
  browserbaseline was 10/10 files en 127/127 tests groen, maar piekte op 928.308
  KiB runner-tree-RSS met acht processen en slechts 55.672 KiB minimaal
  beschikbaar hostgeheugen. Dat toont lokaal vrijwel geen reserve voor
  gelijktijdige browserfiles.
- 2026-08-03 (oorzaak): drie parallelle en drie file-seriële gerichte
  photo-/cacheprobes waren groen; de exacte characterization was ook 5/5 onder
  CPU-starvation en 3/3 onder 256 MiB geheugendruk groen. De volledige
  browserprojectprobe onder dezelfde 256 MiB druk en standaard fileparallelisme
  was daarentegen reproduceerbaar rood: exit 1 na 183,970 s, minimaal 36.012 KiB
  beschikbaar, 9/10 files en 124 tests groen. De characterization zelf was al in
  239 ms geslaagd; een willekeurig laatste bestand kon niet meer starten doordat
  browserverbinding en RPC sloten. Met als enige variabele
  `--no-file-parallelism` was dezelfde probe exit 0: 10/10 files, 127/127 tests,
  16,582 s monitorwandtijd en characterization 218 ms. De best onderbouwde
  lokale root cause is daarom intra-browser Vitest-fileparallelisme dat na de
  suitegroei resource-/schedulingstarvation veroorzaakt op deze 2-CPU/
  circa-3-GiB/no-swap-host. De oorspronkelijke characterization was een
  niet-deterministisch slachtoffer; de gerichte resultaten impliceren geen
  productiecodefout. Deze exacte lokale A/B begrenst de runnerseam, maar is geen
  absolute garantie voor iedere andere host of toekomstige ongerelateerde flake.
- 2026-08-03 (RED): vóór de packagewijziging is uitsluitend
  `test/browser-runner-config.test.ts` toegevoegd en gericht gedraaid met
  `npm exec -- vitest run --project node test/browser-runner-config.test.ts`.
  Dit gaf assertion-grade exit 1: 1/1 test rood; verwacht
  `vitest run --project browser --no-file-parallelism`, ontvangen
  `vitest run --project browser`. De test bereikte de configuratieassertie en
  faalde niet op syntax, import of verstreken wandkloktijd.
- 2026-08-03 (minimale GREEN): alleen de bestaande browserinvocatie in
  `scripts.test` en `scripts["test:browser"]` kreeg exact
  `--no-file-parallelism`. De node-, integration- en browser-matrixinvocaties,
  volgorde node -> browser -> integration -> browser-matrix, interne
  nodeparalleliteit, projectconfiguratie, timeouts, assertions en productcode
  bleven ongewijzigd. De gerichte regressie werd 1/1 groen. Versie `0.8.0`,
  dependencies en alle overige packagevelden bleven behouden; de lockfile is
  niet bijgewerkt.
- 2026-08-03 (causale stress-GREEN): de eerdere seriële 256-MiB-control is na de
  fix bytegelijk als command opnieuw uitgevoerd via de bestaande tijdelijke
  monitor/stressharness. Resultaat: exit 0 in 16,352 s monitorwandtijd, 10/10
  files en 127/127 tests groen; Vitestduur 14,91 s; characterization 206 ms;
  minimaal beschikbaar hostgeheugen 269.824 KiB. Er is geen retry, timeout- of
  assertionwijziging gebruikt.
- 2026-08-03 (drie directe normale runs): `npm run test:browser` is exact drie
  keer direct achter elkaar uitgevoerd in één fail-fast lus die op de eerste
  fout zou stoppen. Run 1: exit 0, 10/10 files, 127/127 tests, 14,51 s,
  characterization 189 ms. Run 2: exit 0, 10/10, 127/127, 14,40 s,
  characterization 196 ms. Run 3: exit 0, 10/10, 127/127, 14,50 s,
  characterization 185 ms. Deze volledige browserruns omvatten de relevante
  avatar-, thumbnailcache-, renderer- en characterizationtests; er is daarom
  geen redundante inhoudelijke rerun toegevoegd.
- 2026-08-03 (gerichte verificatie): de eerste formattercheck vond uitsluitend
  de verwachte Biome-layout in de nieuwe regressietest. Na die semantiekvrije
  correctie was de regressie opnieuw 1/1 groen in 178 ms en controleerde de
  gerichte formatter 2 ondersteunde bestanden zonder fixes. `npm run typecheck`
  was exit 0. `git diff --check` en staged diffcheck waren exit 0. Add-only
  no-indexchecks voor de nieuwe regressietest, dit blockerticket, het bestaande
  releaseparentticket en de bestaande 0.8.0-releasenote gaven elk de verwachte
  diff-exit 1 met 0 outputbytes. Beide tickets hadden 0 verborgen control-/
  formattekens. De status bevatte exact de zeven behouden release-dirty paden
  plus de nieuwe regressietest en 0 staged paden. Dependencies bleven gelijk aan
  HEAD; `package-lock.json` behield SHA-256
  `313fcd37b3e17f17d88c0e987c6f66ccc734eb326d5f1cae27cf179b11c80538` en de
  releasenote behield haar gejournaliseerde hash. Diffs voor lockfile,
  productcode, styles, scripts en workflows waren leeg.
- 2026-08-03 (uitvoeringsgrens): geen volledige `npm run test`, `npm run check`,
  build, reproduceerbaarheidsrun of releasegate; geen dependency-, lockfile-,
  workflow-, productcode-, releasecopy- of parentticketedit; geen clean, revert,
  stage, commit, push, tag, release of andere externe write. De zeven bestaande
  release-dirty paden en versie `0.8.0` zijn behouden; alleen de runnerseamtest is
  als achtste dirty pad toegevoegd en `package.json` kreeg de twee geautoriseerde
  flagtoevoegingen.
- 2026-08-03 (onafhankelijke closure-review): PASS zonder bevindingen; criteria
  1–5 zijn onafhankelijk als PASS beoordeeld. De review bevestigde dat uitsluitend
  de twee browserflagtoevoegingen in `package.json` en de add-only regressie dit
  runnerherstel vormen, met behoud van projectmatrix, assertions, timeouts,
  dependencies, lockfile, workflows en productcode. De causaliteitsgrens blijft
  lokaal: file-scheduling is aangetoond, niet een specifieke OOM of universele
  hostgarantie; er was geen brede suite, build, releasegate of live
  Obsidian-validatie in de review. De parentrelease is hiermee geautoriseerd voor
  precies één semantisch actuele volledige Node-24-releasegate.

## Evidence

### Pre-fix releasefailure en baseline

- Releasegate: browser 9/10 files en 126/127 tests; uitsluitend de
  characterization time-outte na de ongewijzigde 15.000 ms. De exact geïsoleerde
  parentrerun was 1/1 groen in 205 ms.
- Gewone volledige browserbaseline: exit 0, 10/10 files, 127/127 tests;
  Vitestduur 16,51 s en monitorwandtijd 17,328 s. Piek runner-tree-RSS 928.308
  KiB, acht processen en minimaal 55.672 KiB beschikbaar hostgeheugen.

### Stress-A/B aan de runnergrens

- A, 256 MiB druk met standaard fileparallelisme: exit 1, 183,970 s; 9/10 files,
  124 tests groen; minimaal 36.012 KiB beschikbaar. Characterization was al
  groen in 239 ms; het uiteindelijke slachtoffer was
  `relationship-template-settings.browser.test.ts`, dat niet kon starten na een
  gesloten browserverbinding/RPC.
- B, dezelfde 256 MiB druk met exact `--no-file-parallelism`: exit 0, 16,582 s;
  10/10 files en 127/127 tests; characterization 218 ms. De post-fix identieke B
  bevestigde exit 0 in 16,352 s monitorwandtijd, 127/127 tests en
  characterization 206 ms.
- Bronartefacten: `/tmp/pa-full-mem256.*`, `/tmp/pa-serial-pressure.*` en
  `/tmp/pa-serial-pressure-postfix.*`; aanvullende negatieve producthypothese-
  probes: `/tmp/pa-target-parallel-*`, `/tmp/pa-target-serial-*`,
  `/tmp/pa-cpu2-exact-*` en `/tmp/pa-mem256-exact-*`.

### RED, minimale GREEN en normale stabiliteit

- RED: gerichte nodeconfiguratietest exit 1, 1/1 assertion rood op de ontbrekende
  browserflag.
- GREEN: dezelfde test 1/1 groen na uitsluitend twee
  `--no-file-parallelism`-toevoegingen in `package.json`; na formattercorrectie
  opnieuw 1/1 groen.
- Normale browserrun 1: exit 0, 10/10 files, 127/127 tests, 14,51 s.
- Normale browserrun 2: exit 0, 10/10 files, 127/127 tests, 14,40 s.
- Normale browserrun 3: exit 0, 10/10 files, 127/127 tests, 14,50 s.
- Tijdelijke directe-runlogs: `/tmp/pa-browser-postfix-run1.log`,
  `/tmp/pa-browser-postfix-run2.log`, `/tmp/pa-browser-postfix-run3.log`.

### Verificatiegrens

- Gerichte formatter na semantiekvrije correctie: exit 0, 2 ondersteunde
  bestanden gecontroleerd, geen fixes.
- `npm run typecheck`: exit 0.
- `git diff --check`: exit 0; alle vier relevante add-only no-indexchecks:
  verwachte exit 1 met 0 outputbytes; verborgen Unicode-controls in beide
  tickets: 0.
- Scope: exact 8 dirty paden, waarvan 7 behouden releasepaden plus de nieuwe
  regressietest; staged paden 0. Lockfile-, dependency-, product-, style-,
  script-, workflow- en releasecopygrenzen zijn behouden.
- Volledige repository- en releasegate bewust niet uitgevoerd vóór review.

## Review

PASS — independent read-only review; no findings.

## Retrospective

De oorspronkelijke timeout was een niet-deterministisch slachtoffer van
intra-browser Vitest-fileparallelisme op de begrensde 2-CPU/circa-3-GiB/no-swap-
host, niet van bewezen productgedrag. De minimale fix serialiseert uitsluitend
browserfiles met `--no-file-parallelism` op de canonieke en directe
browserinvocatie; alle andere projecten, assertions, timeouts en productcode
blijven ongewijzigd. De add-only packagecontractregressie bewaakt deze grens.