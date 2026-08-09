Status: done
Created: 2026-08-01
Updated: 2026-08-09

# Aggregate Vitest-runnerflakiness

## Question

Waarom faalt de canonieke `npm run test`-run in People Atlas incidenteel met
wisselende node-, browser- en browser-matrix-failures, terwijl de betrokken
testprojecten afzonderlijk groen zijn, en welke minimale runner- of
lifecyclewijziging maakt de aggregate-run betrouwbaar zonder testdekking te
verminderen?

## Sources and Methods

Bekende observaties op 2026-08-01:

- `npm run test` voert `vitest run` uit en activeert in `vitest.config.ts` de
  projecten `node`, `browser`, `integration` en `browser-matrix` in één
  aggregate-run.
- Tijdens de P1a-gate faalde één aggregate-run met 750 passed en 6 failed:
  drie DPR browser-matrix popup-lifecyclegevallen, één deterministische
  node-performancekarakterisering en twee browser-rendererprofiel/
  surfacegevallen.
- De gerichte vervolgcommands waren afzonderlijk groen:
  `npm run test:browser` (75 tests), `npm run test:browser-matrix` (6 tests)
  en `vitest run --project node test/performance-characterization.test.ts`
  (12 tests).
- `vitest.config.ts` start meerdere Playwright/Chromium-projecten in dezelfde
  aggregateconfiguratie, inclusief drie DPR-contexten naast browser- en
  integrationprojecten.
- Een eerdere read-only audit observeerde eveneens wisselende browsertimeouts
  in gecombineerde runs terwijl afzonderlijke suites groen waren.

De lopende read-only diagnose moet de exacte foutuitvoer, reproduceerbaarheid,
Vitest-versie/configuratie, processen/resourcecontouren, recente wijzigingen
en kleinste bewezen oorzaak vastleggen. Geen hypothese is al als oorzaak
bewezen.

## Findings

Een onafhankelijke read-only diagnose doorliep de foutuitvoer, configuratie,
relevante testlifecycle en runnerprobes op de lokale host (de read-only
onderzoekagent draaide daarbij onbedoeld Node 22.23.1):

- De host heeft 2 logische CPU's, circa 2,9 GiB RAM en geen swap. De
  aggregateconfiguratie laat node-workers, een browserproject, een
  integratiebrowserproject en drie DPR-Chromium-contexten tegelijk concurreren;
  popupgevallen openen daarbovenop eigen browsing contexts.
- Een diagnose met alleen Vitest-bestandsparallelisme uitgeschakeld bleef
  niet-groen. Het probleem is dus breder dan parallelle bestanden binnen één
  project.
- De equivalente vier projecten, volledig sequentieel uitgevoerd, waren lokaal
  groen (exit 0; circa 77,2 s), terwijl de betrokken projecten ook individueel
  groen waren.
- De wisselende foutlocaties passen bij event-loop/Chromium-scheduling starvation
  onder hostresourcecontention, niet bij één renderer- of
  performanceberekeningsdefect.

**Best onderbouwde oorzaak (85% zekerheid):** ongecontroleerde parallelle
projectorchestratie in de aggregate `vitest run` op een host met beperkte CPU/
geheugenruimte. Een verborgen gedeelde testresource is niet volledig
uitgesloten, maar de probe met `--no-file-parallelism` en de sequentiële
projectrun maken die verklaring minder waarschijnlijk.

## Recommended minimal repair

Behoud alle projecten, tests, assertions, matrixfactoren en het parallelisme
*binnen* het nodeproject, maar laat het canonieke `npm run test` de vier
bestaande projecten achtereenvolgens starten: `node`, `browser`, `integration`
en `browser-matrix`. Dit verwijdert uitsluitend de bewezen onstabiele overlap
van node-CPUwerk met vijf Chromium-contexten. De executor moet eerst de huidige
aggregatefailure als RED-evidence bewaren, daarna de minimale script/config-
wijziging doen en drie volledige groene canonical runs vastleggen.

## Limits

- De diagnose gebruikte onbedoeld Node 22.23.1, terwijl `.nvmrc` en CI Node 24
  eisen. De oorzaakshypothese is daarom alleen een lokale resourceverklaring;
  de executor moet de fix en alle drie canonical runs expliciet onder Node 24
  bevestigen.
- Een enkele groene of rode aggregate-run bewijst op zichzelf geen oorzaak.
- De diagnose mag geen test uitschakelen, assertion verzwakken, matrixfactor
  reduceren, timeout blind verhogen of productcode wijzigen om de suite groen
  te maken.
- Deze research is geen live Obsidian Desktop/Mobile-evidence.

## Resolution — 2026-08-09

De diagnose is afgerond door de bounded executor in
`.10x/tickets/2026-08-01-aggregate-test-runner-stability.md`. De canonieke
runner voert de bestaande node-, browser-, integration- en DPR-projecten
sequentieel uit en verwijdert geen tests, assertions of matrixfactoren.

Onder Node `v24.18.1`/npm `11.16.0` zijn drie opeenvolgende exacte
`npm run test`-runs exit 0 uitgevoerd. Elke run rapporteerde node 53
bestanden/965 tests, browser 10 bestanden/166 tests, integration 9
bestanden/39 tests en DPR 1/1.5/2 groen. De verwachte
`MODULE_NOT_FOUND`-stderr uit de negatieve child-process-test blijft
diagnostische output; de parent-runner slaagt.

Daarmee is de oorspronkelijke resource-/orchestratiehypothese onder de
gedeclareerde Node-24-runtime praktisch bevestigd voor de lokale runner. De
historische Node-22-limiet, beperkte-hostcontext en het ontbreken van live
Obsidian Desktop/Mobile-evidence blijven behouden; deze research claimt geen
native-host- of remote-CI-validatie.

## References

- `.10x/tickets/2026-08-01-aggregate-test-runner-stability.md`
- `.10x/tickets/2026-08-01-await-declarative-settings-persistence.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `package.json`
- `vitest.config.ts`
- `vitest.performance.config.ts`
- `AGENTS.md`
