Status: done
Created: 2026-08-01
Updated: 2026-08-01

# P1b — Native bevestiging voor templateverwijdering

Parent: `.10x/tickets/2026-08-01-obsidian-1-13-4-settings-p1-plan.md`
Depends-On: `.10x/tickets/2026-08-01-await-declarative-settings-persistence.md`

## Scope

Vervang uitsluitend de browser-native confirmatie voor het verwijderen van een
gekoppelde relationship template door Obsidian `ConfirmationModal`. Behoud
exact de huidige deletegrens, copied-value-copy, directe flow voor ongekoppelde
templates, schrijfbescherming en succesvolle Settings-tab-refresh.

## Non-goals

- Verwijderen, herschrijven of synchroniseren van relationship-notities.
- Wijziging van template-IDs, volgorde, copied types/rollen, provenance- of
  bulk-sync-semantiek.
- Een generiek modalframework of wijziging van bestaande
  `RelationshipPresetModal`/`RelationshipPresetSyncModal`.
- Nieuwe settings, dataformats, view- of navigatiestructuur.
- Commit, push, release of live Obsidian UI-certificering.

## Acceptance criteria

- [x] Bij een schrijfbare template met minstens één gekoppelde relationship-
      notitie opent Delete een openbare Obsidian `ConfirmationModal`, geen
      browser-native `confirm()`.
- [x] De modal identificeert template en koppelaantal en maakt duidelijk dat
      gekopieerde types/rollen behouden blijven terwijl alleen provenance niet
      langer naar een bestaande template verwijst.
- [x] Cancel, Escape, backdrop-dismiss en sluiten zijn write-free; settings,
      templatevolgorde en relationship-notities veranderen niet.
- [x] Alleen de expliciete primaire deleteactie verwijdert de oorspronkelijk
      gekozen template via `updateSetting("relationshipPresets", presets)`.
- [x] Bij nul gekoppelde relationship-notities blijft de directe bestaande
      deleteflow beschikbaar.
- [x] Bij disabled writes blijft de bestaande read-only guard de enige
      toegestane uitkomst; er opent geen mutation-modal.
- [x] Gerichte tests bewijzen gekoppeld bevestigen/annuleren, ongekoppeld
      verwijderen, failed update en write-disabled gedrag.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen.

## References

- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `src/settings/settings-tab.ts`
- `src/main.ts`
- `test/settings-tab.test.ts`
- `AGENTS.md`

## Assumptions

- User-ratified: dit is één van de P1-verbeteringen waarvoor een ticket is
  gevraagd.
- Record-backed: gekoppelde templates behouden gekopieerde types/rollen;
  `ConfirmationModal` is een openbare 1.13.0+-API; `updateSetting()` blijft
  de enige valide persistencegrens.
- Geen onopgeloste semantische aanname.

## Blockers

None. P1a is gesloten en de gebruiker autoriseerde de volledige P1-keten;
deze ticketgrens is uitvoerbaar.

## Journal

- 2026-08-01: Ticket geopend in shaping. Huidige `deletePreset()` gebruikt
  alleen bij `linked > 0` een `window.confirm()` met copied-value-copy; de
  delete zelf loopt al via `updateSetting()`. Geen productcode, test, build,
  settingsdata of externe status gewijzigd.
- 2026-08-01: P1a is gesloten na een onafhankelijke review en stabiele
  aggregate-testgate; P1b is door de expliciete userautorisatie actief gemaakt.
- 2026-08-01 (RED): eerst alleen de P1b-gedragstests en de noodzakelijke
  gecontroleerde Obsidian-`ConfirmationModal`-stub toegevoegd; er was nog geen
  P1b-productcode. Command:
  `export PATH=/home/nms/.local/node24/bin:$PATH && ./node_modules/.bin/vitest run --project node test/settings-tab.test.ts -t 'relationship-template deletion confirmation'`.
  Resultaat: exit 1; 3 failed, 2 passed, 7 skipped. De verwachte eerste fout
  was `expected "open" to be called once, but got 0 times`, omdat
  `deletePreset()` nog `window.confirm()` gebruikte. De aangescherpte
  browsergrens faalde onafhankelijk met exact dezelfde ontbrekende
  `ConfirmationModal.open()`-aanroep (1 failed, 2 skipped, exit 1).
- 2026-08-01 (GREEN): uitsluitend `deletePreset()` aangepast: gekoppelde
  templates openen nu `ConfirmationModal`; de callback hercontroleert de
  bestaande write-guard, zoekt het oorspronkelijk gekozen template-ID opnieuw
  op en schrijft alleen via `updateSetting("relationshipPresets", presets)`.
  Gerichte Node-test: 5 passed, 7 skipped (exit 0). Gerichte browsertest: 1
  passed, 2 skipped (exit 0). De volledige aangeraakte bestanden passeerden
  daarna: `test/settings-tab.test.ts` 12/12 en
  `test/browser/relationship-template-settings.browser.test.ts` 3/3.
- 2026-08-01 (gates): alle canonieke Node-24-gates groen; zie de volledige
  command-/uitvoer-samenvatting in Evidence. Geen commit, push, release,
  dependency- of externe write uitgevoerd.
- 2026-08-01 (P1b-regressie-follow-up): na de onafhankelijke pass-review eerst
  de gerichte Node-test als baseline uitgevoerd met
  `export PATH=/home/nms/.local/node24/bin:$PATH && ./node_modules/.bin/vitest run --project node test/settings-tab.test.ts -t 'relationship-template deletion confirmation'`:
  exit 0, 5 passed / 7 skipped. Daarna uitsluitend
  `test/settings-tab.test.ts` aangescherpt: Cancel is zelfstandig bewijs en
  een tweede test roept `ConfirmationModal.close()` direct aan, zonder voorafgaande
  Cancel of primaire actie. De gerichte GREEN-run gaf exit 0, 6 passed / 7
  skipped. Heruitvoering van de volledige gates volgt onder deze actieve ticket.
- 2026-08-01 (P1b-regressie-follow-up gates): met Node v24.18.1 en npm
  11.16.0 zijn `npm run test` (47 Node-bestanden/667 tests; 8 browser/75;
  6 integratie/14; 3 browser-matrix/6), `npm run typecheck` en `npm run build`
  alle met exit 0 geslaagd. `git diff --check` gaf exit 0 zonder uitvoer; de
  aanvullende whitespace-check voor dit nog ongetrackte ticket gaf alleen de
  verwachte add-only exitstatus 1 en eveneens geen uitvoer.

## Evidence

1. **Gekoppelde template / native modal — voldaan.**
   `deletePreset()` importeert de openbare Obsidian `ConfirmationModal`; er is
   geen `window.confirm()`-pad meer. De gerichte Node- en browsertests
   bespioneren uitsluitend de Obsidian-modalgrens, bevestigen precies één
   `ConfirmationModal.open()` en bevestigen dat de browserconfirmatie niet is
   aangeroepen.
2. **Exacte copy/provenance-copy — voldaan.** De modal-title noemt
   `Friend and colleague`; de content noemt exact `2 relationship notes`, het
   behoud van `copied types and roles`, en dat provenance niet langer naar een
   bestaand template verwijst. Beide gerichte testlagen verifiëren deze copy.
3. **Cancel en directe sluitgrens zijn write-free — voldaan.** De Node-test
   activeert de gecontroleerde Cancel-knop als zelfstandig bewijs; een tweede,
   zelfstandige test opent een nieuwe modal en roept direct
   `ConfirmationModal.close()` aan, zonder voorafgaande Cancel of primaire
   actie. Beide bewijzen nul `updateSetting`-aanroepen, nul Settings-tab-refreshes
   en ongewijzigde `relationshipPresets`. Escape/backdrop gebruiken in de
   publieke Obsidian-modal dezelfde `close()`-grens; er zijn bewust geen
   niet-bestaande hostevents gesimuleerd. Relationship-notities worden door deze
   flow nergens geschreven.
4. **Primaire delete / oorspronkelijk ID — voldaan.** De Node-test herordent
   de settings-lijst na het openen van de modal en vóór de primaire actie. Hij
   bewijst exact één `updateSetting("relationshipPresets", [family])`-aanroep:
   alleen het oorspronkelijke `friend-colleague`-ID verdwijnt. Een succesvolle
   write ververst de bestaande Settings-tab precies eenmaal.
5. **Ongekoppelde directe flow — voldaan.** De Node-test met `linked: 0`
   bewijst geen modal en exact één directe bestaande settings-write plus refresh.
6. **Read-only grens — voldaan.** De lijst exposeert geen `onDelete`; een
   directe test van de bestaande guard opent geen modal, schrijft niets en laat
   de templatevolgorde onveranderd.
7. **Afgehandelde mislukte write — voldaan.** Bij `updateSetting() => false`
   bewijst de Node-test één primaire write, nul Settings-tab-refreshes en geen
   lokale template-mutatie of vervolgwrites.
8. **Gerichte TDD-bewijzen — voldaan.**
   - RED Node: command in Journal, exit 1, 3 failed / 2 passed / 7 skipped;
     primaire fout: ontbrekende `ConfirmationModal.open()`.
   - RED browser: `./node_modules/.bin/vitest run --project browser
     test/browser/relationship-template-settings.browser.test.ts -t 'uses a native confirmation modal'`,
     exit 1, 1 failed / 2 skipped; dezelfde verwachte ontbrekende open-aanroep.
   - GREEN Node: hetzelfde Node-command, exit 0, 5 passed / 7 skipped;
     daarna het volledige testbestand 12/12 groen.
   - GREEN browser: hetzelfde browsercommand, exit 0, 1 passed / 2 skipped;
     daarna het volledige browserbestand 3/3 groen.
   - P1b-regressie-follow-up: vóór de testwijziging gaf de gerichte Node-run
     exit 0, 5 passed / 7 skipped. Na het afsplitsen van Cancel en de directe
     `ConfirmationModal.close()`-test gaf hetzelfde command exit 0, 6 passed /
     7 skipped.
9. **Volledige P1b-regressie-follow-up gates (Node v24.18.1, npm 11.16.0) —
   voldaan.**
   ```text
   $ npm run test                                   # exit 0
   node:             47 test files passed, 667 tests passed
   browser:           8 test files passed, 75 tests passed
   integration:       6 test files passed, 14 tests passed
   browser-matrix:    3 test files passed, 6 tests passed

   $ npm run typecheck                              # exit 0
   > tsc --noEmit

   $ npm run build                                  # exit 0
   > npm run typecheck && npm run build:production
   > tsc --noEmit
   > node esbuild.config.mjs production

   $ git diff --check                               # exit 0, geen uitvoer
   ```

## Review

- 2026-08-01: Eerste onafhankelijke red-teamreview — **pass**. Geen security-
  of logische bevindingen; de reviewer vroeg alleen om gescheiden Cancel- en
  directe-close-testdekking.
- 2026-08-01: Test-only follow-up maakte die twee paden zelfstandig en draaide
  de volledige Node-24 gate opnieuw groen.
- 2026-08-01: Tweede onafhankelijke red-teamreview — **pass**. Geen security-
  of logische bevindingen. De reviewer bevestigde dat de publieke
  Escape/backdrop-claim eerlijk als dezelfde `close()`-grens is begrensd, niet
  als gesimuleerd hostevent. Niet-blokkerende suggestie: maak optionele
  testknoppen op termijn expliciet aanwezig vóór aanroepen.

## Retrospective

Een scoped hostmodal kan veilig worden ingevoerd door de writeboundary volledig
in de expliciete primaire callback te houden. Test cancel en directe modal-close
apart; hostevents zelf horen bij live hostbewijs en mogen niet door onrealistische
stub-events worden gesimuleerd.
