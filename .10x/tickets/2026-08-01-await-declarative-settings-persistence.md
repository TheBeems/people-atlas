Status: done
Created: 2026-08-01
Updated: 2026-08-01

# P1a — Await declaratieve Settings-persistentie

Parent: `.10x/tickets/2026-08-01-obsidian-1-13-4-settings-p1-plan.md`
Depends-On: None

## Scope

Maak `PeopleAtlasSettingTab.setControlValue()` een async
`Promise<void>`-grens die de bestaande `PeopleAtlasPlugin.updateSetting()`-
operatie afwacht. Voeg gerichte regressietests toe voor de await-volgorde en
behoud de bestaande validatie-, rollback-, schrijfbeschermings-, index- en
view-refreshgrens.

## Non-goals

- Nieuwe settingskeys, defaults, migraties of opgeslagen formats.
- Verandering van de inhoud, groepering of volgorde van setting definitions.
- Nieuwe save- of refreshlogica buiten `updateSetting()`.
- Templatebeheer, confirmation UI, Bases, graph-, vault- of domainwijzigingen.
- Live Obsidian Desktop/Mobile-certificering, commit, push of release.

## Acceptance criteria

- [x] `setControlValue()` heeft een async `Promise<void>`-contract en wacht op
      `updateSetting()` voordat hij resolveert.
- [x] Er is geen tweede `saveData()`, index rebuild of view-refreshpad.
- [x] Een succesvolle update behoudt huidige control- en pluginsemantiek.
- [x] Een afgewezen of mislukte update behoudt de bestaande Notice/rollback en
      veroorzaakt geen onbehandelde rejection.
- [x] Gerichte tests bewijzen resolve-volgorde, succesvolle en afgewezen
      updatepaden.
- [x] Bestaande Settings-, view-, mutation- en integrationtests blijven groen.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen.

## References

- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/settings/settings-tab.ts`
- `src/main.ts`
- `test/settings-tab.test.ts`
- `AGENTS.md`

## Assumptions

- User-ratified: dit is één van de P1-verbeteringen waarvoor een ticket is
  gevraagd.
- Record-backed: `setControlValue()` mag `Promise<void>` teruggeven;
  `updateSetting()` is de enige bestaande persistence-/refreshgrens.
- Geen onopgeloste semantische aanname.

## Blockers

None. De runnerflakiness is hersteld in
`.10x/tickets/2026-08-01-aggregate-test-runner-stability.md`; dat ticket heeft
een onafhankelijke pass-review en drie volledige groene Node-24 aggregate-runs.

## Journal

- 2026-08-01: Ticket geopend in shaping. Huidige codeinspectie vond een
  `void`-return met een weggedrukte `updateSetting()`-Promise. Geen
  productcode, test, build, settingsdata of externe status gewijzigd.
- 2026-08-01 (RED): eerst uitsluitend de parametrische regressietest voor de
  `true` (succes) en `false` (door `updateSetting()` afgehandelde afwijzing)
  uitkomst toegevoegd. Command:
  `export PATH=/home/nms/.local/node24/bin:$PATH && ./node_modules/.bin/vitest run test/settings-tab.test.ts -t 'returns a promise that waits for a handled update result'`.
  Verwachte RED: beide gevallen faalden met
  `expected undefined to be an instance of Promise` (exit 1), omdat
  `setControlValue()` nog `void` terugstuurde.
- 2026-08-01 (GREEN): alleen `setControlValue()` gewijzigd naar
  `async ...: Promise<void>` met één `await this.plugin.updateSetting(...)`.
  Hetzelfde gerichte command slaagde daarna: 1 testbestand, 2 tests passed,
  5 skipped (exit 0).
- 2026-08-01 (gates): `npm run typecheck` en `npm run build` slaagden met
  Node v24.18.1. `npm run test` faalde alleen onder de gelijktijdige
  project-run (zie Evidence); de betrokken browser-, browser-matrix- en
  performance-tests slagen elk afzonderlijk.
- 2026-08-01 (review): onafhankelijke red-teamreview rapporteerde pass zonder
  security- of logische bevindingen. Ticket is geblokkeerd op de expliciete
  aggregate-testgate; de reviewer maakt die bekende runnerflakiness niet stil
  tot P1a-succes.
- 2026-08-01 (closure): het runner-stability-ticket is done na een onafhankelijke
  pass-review en drie volledige groene Node v24.18.1 `npm run test`-runs.
  Daarmee voldoet P1a ook aan zijn volledige aggregate-gate en sluit dit ticket.

## Evidence

1. **Async Promise-grens / resolve-volgorde — voldaan.**
   `src/settings/settings-tab.ts` laat `setControlValue()` één bestaande
   `updateSetting()`-Promise afwachten en heeft het expliciete
   `Promise<void>`-contract. De gerichte test houdt die Promise pending en
   bewijst dat de tab niet settle’t vóór `completeUpdate()`.
2. **Geen tweede persistency-, index- of refreshpad — voldaan.**
   De productwijziging bestaat uitsluitend uit één `await` op de bestaande
   `plugin.updateSetting(...)`-aanroep; er zijn geen nieuwe `saveData()`,
   `rebuildAll()` of view-refreshaanroepen in de tab toegevoegd.
3. **Succespad — voldaan.** De `true`-variant van de gerichte test bewijst dat
   de control-Promise pas na een succesvolle bestaande plugin-update resolveert.
4. **Afwijzing/fout die de plugin zelf afhandelt — voldaan.** De `false`-variant
   van dezelfde test bewijst dat de tab-Promise rustig met `undefined`
   resolveert nadat de bestaande plugin-grens een afgehandelde afwijzing
   teruggeeft; de tab voegt geen rejection toe.
5. **Gerichte regressiedekking — voldaan.** De gerichte Vitest-run hierboven
   heeft beide parametrische gevallen groen uitgevoerd met alleen de onvermijdbare
   `PeopleAtlasPlugin`-grensmock.
6. **Bestaande settings-, view-, mutation- en integrationdekking — voldaan
   buiten de aggregate-flake.** `test/settings-tab.test.ts` passeerde in de
   aggregate-run; alle getoonde integrationtests, mutationtests en overige
   bestaande node-tests passeerden. Afzonderlijke browser- en DPR-matrix-runs
   passeerden volledig (zie hieronder).
7. **Kwaliteitsgates — gedeeltelijk.**
   - `npm run typecheck`: passed (exit 0).
   - `npm run build`: passed (exit 0; bevat opnieuw `typecheck`).
   - `npm run test`: exit 1 door bekende parallelle resource-/browserflakiness,
     niet door P1a: 750 passed, 6 failed. Exacte falende gevallen waren de drie
     DPR-gevallen `proves popup creation, ownership and teardown` in
     `test/browser-matrix/atlas-renderer.browser-matrix.test.ts`, de node-test
     `generates exact deterministic sparse and stress counts at every ratified
     size` in `test/performance-characterization.test.ts`, en twee browsertests
     in `test/browser/atlas-renderer.browser.test.ts` (`switches one surface
     without layout persistence and synchronizes canvas/list selection` en
     `resolves graph and selected-profile photo surfaces while keeping profile
     images decorative`).
   - Afzonderlijke vervolgcommands na die aggregate-fout waren groen:
     `npm run test:browser` (8 bestanden, 75 tests),
     `npm run test:browser-matrix` (3 bestanden, 6 tests), en
     `./node_modules/.bin/vitest run --project node test/performance-characterization.test.ts`
     (1 bestand, 12 tests). Allemaal uitgevoerd met
     `PATH=/home/nms/.local/node24/bin:$PATH`.
   - `git diff --check`: passed (exit 0) op de tracked diff.
8. **Closure-gate — voldaan.** Het onafhankelijke
   runner-stability-ticket documenteert drie volledige groene canonical
   Node v24.18.1-runs (node 661, browser 75, integration 14,
   browser-matrix 6) plus groene build en diffcheck. Hiermee is de eerdere
   pre-fix aggregate-flake opgelost zonder P1a-productcode te wijzigen.

## Review

- 2026-08-01: Onafhankelijke red-teamreview verdict: **pass**. Geen security-
  of logische bevindingen. Beoordeeld: contractnaleving, async/Promise-
  semantiek, afgehandelde `false`-uitkomst, regressietestkwaliteit, scope en
  security. Niet-blokkerende suggestie: voeg later een exacte
  `updateSetting`-call-countassertie toe; de minimale productdiff bewijst al
  dat geen tweede writepad is toegevoegd.
- De eerdere aggregate-flake is niet als restrisico geaccepteerd maar in het
  afzonderlijke runner-stability-ticket hersteld en onafhankelijk beoordeeld.

## Retrospective

De kleinste correcte integratie is een `await` op de al bestaande
plugin-owned updategrens; duplicatie van save-, index- of refreshlogica was
niet nodig. De suiteflakiness is infrastructuur-/runnerwerk en mag niet stil
als P1a-productgedrag worden behandeld.
