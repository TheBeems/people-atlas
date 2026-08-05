Status: done
Created: 2026-08-04
Updated: 2026-08-05
Depends-On: `.10x/specs/multilingual-user-interface.md`; `.10x/tickets/2026-08-04-i18n-foundation-nl-en.md` must be `done`

# i18n-interactie en toegankelijkheid (Nederlands/Engels)

## Doel

Voer uitsluitend fase 2 van de geratificeerde meertaligheidsspecificatie uit:
vertaal de bereikbare interactie- en toegankelijkheidsteksten in
person/relationship/contactmoment-modals, graph-, Bases- en Reading
View-actions, lege staten, ARIA-labels en keyboard-instructies.

## Scope

- Gebruik uitsluitend de getypeerde locale/catalogusgrens uit fase 1.
- Voeg catalogusberichten toe met compileerbare key- en parameterpariteit voor
  Nederlands en Engels.
- Maak per UI-surface een publieke/controlled-browser-regressie voor locale,
  accessible name en onveranderde persistente/user-authored gegevens.
- Houd command-ID's, IDs, paden, frontmatter, templates en opslaggrenzen
  onveranderd.

## Niet doen

- Geen locale-setting, override, runtime-switch, externe dependency, netwerk,
  telemetry of automatische vertaling.
- Geen vertaling van user-authored/in-vault waarden of vaste machinewaarden.
- Geen pure graph-/parser-import van i18n of Obsidian.
- Geen diagnostics- of `Intl`-formattering; dat is het volgende dependency-ticket.
- Geen commit, push, tag, release of live-vaultmutatie.

## Uitvoering en gate

- Eerst verticale TDD per bereikbare surface; een ontbrekende stub/import is
  geen assertion-grade RED.
- Onafhankelijke read-only review vóór één actuele Node-24 full gate:
  `npm run test`, `npm run build`, `git diff --check`.
- Sluit alleen na PASS-review en actuele groene gate.

## Acceptatiecriteria

- [x] De fase-2 modal-, view- en Reading/Bases-acties tonen Nederlandse en
      Engelse vaste UI-/accessibilitytekst via de bestaande catalogusgrens.
- [x] Localeweergave verandert geen IDs, paden, frontmatter, templates,
      user-authored tekst, settingspayload of writes.
- [x] Pure graph-/parserlagen blijven i18n- en Obsidian-vrij.
- [x] Gerichte node/controlled-browsertests, review en actuele Node-24-gate zijn
      groen; live Desktop/Mobile blijft afzonderlijk gevalideerd.

## Blokkers

None.

## Journal

- 2026-08-04: Als afzonderlijke vervolgscope voorbereid conform fase 1; geen
  productcode, test, build, plugindata, vaultinhoud, staging, commit, push, tag
  of release gewijzigd.
- 2026-08-05: Dependency fase 1 is met onafhankelijke PASS en actuele volledige
  Node-24-gate `done`. De gebruikersvraag om de vervolgscopes nu te implementeren
  autoriseert de lokale uitvoering van deze dependency-ready fase. Commit, push,
  tag, release en live-vaultmutaties blijven uitgesloten.
- 2026-08-05: Fase 2 gesloten na verticale assertion-grade TDD-regressies voor
  alle bereikbare modal-, renderer-, view-, Bases- en Reading View-oppervlakken,
  inclusief follow-up-, foto- en semantische-lijststatussen. De finale,
  onafhankelijke strikt read-only review (`deleg_0b87fdab`) rapporteerde PASS
  zonder findings. Actuele Node 24.18.1-gate: `npm run test` groen (940 node,
  147 browser, 34 integratie, 6 browser-matrix); `npm run build` groen;
  `npm run lint` exit 0 met één bestaande, niet-gewijzigde waarschuwing in
  `test/obsidian-stub.ts:207`; `npm run format:check` en `git diff --check`
  groen. Live Desktop/Mobile-validatie blijft afzonderlijk en is niet geclaimd.
