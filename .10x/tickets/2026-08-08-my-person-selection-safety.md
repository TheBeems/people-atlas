Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — identity/settings boundary
Depends-On: `.10x/specs/my-person-note-picker.md`, `.10x/specs/perspective-relationship-foundation.md`

# My Person: relationship-achtige zichtbaarheid met veilige selectie

## User authorization

De gebruiker wil dat My Person dezelfde zichtbare persoonsselectie gebruikt als
bij het aanmaken van relationships, omdat een tweede duplicate-filter valide
indexresultaten kan verbergen. De gebruiker wil tegelijk de duplicate safety
behouden: een ambigue ID mag nooit persistent als `myPersonId` worden gebruikt.
De actieve specs zijn hiervoor in deze shapingfase verduidelijkt.

## Doel

Laat de Settings-picker dezelfde actuele expliciete-ID-personen vindbaar maken
als de relationship-editor, maar voer vóór iedere settings-write een canonieke
path- en ID-uniqueness-check uit.

## Scope

- `getMyPersonCandidates()` projecteert de actuele snapshot-personen met
  dezelfde zichtbaarheid als de relationship-editor;
- de settings-adapter resolveert een gekozen pad opnieuw tegen de actuele
  snapshot;
- alleen precies één canonieke record met unieke expliciete `person_id` mag
  `updateSetting("myPersonId", ...)` bereiken;
- duplicate-ID-records mogen zichtbaar zijn, maar selectie wordt geweigerd met
  een recoverable warning en zonder write;
- ordinary notes en stale paths worden eveneens vóór write geweigerd;
- bestaande stored-missing/stored-ambiguous warning- en clear-semantiek blijft
  behouden;
- open Settings blijft live refreshen na index-publicatie.

## Niet doen

- Geen wijziging aan de index-core of relationship-editorsemantiek;
- geen ID-, path-, frontmatter- of vaultmigratie;
- geen automatische keuze, merge of cleanup;
- geen plugin-geïnitieerde scan/rebuild vanuit Settings;
- geen wijziging aan `Default center person ID`;
- geen commit, push, tag, release of live-vaultwrite.

## Verticale TDD

### Slice 1 — zichtbare candidate parity

- RED: test dat de Settings-kandidaten dezelfde actuele personenprojectie
  bevatten als de relationship-picker, inclusief twee verschillende paths met
  dezelfde `person_id`.
- GREEN: verwijder alleen het afwijkende candidate-filter; behoud naam/path-
  context en live index-refresh.

### Slice 2 — duplicate pre-write safety

- RED: test een echte file-control-selectie van twee verschillende paths met
  dezelfde ID en assert dat `updateSetting()` nul keer wordt aangeroepen.
- GREEN: laat selectie via dezelfde canonieke path-resolver falen vóór de
  settings-write en toon de bestaande ambiguity-warning.
- Voeg positieve tests toe voor één unieke canonical path en voor clear.

### Slice 3 — stale/ordinary negatieve paden

- RED: ordinary note en stale path mogen niet persistent worden.
- GREEN: beide blijven write-free; bestaande stored-invalid waarden blijven
  ongemuteerd en waarschuwen.

### Review en gates

- onafhankelijke review tegen beide actieve identity-specs én de
  relationship-entrypointcode;
- volledige Node-24 gate: `npm run check`, build en `git diff --check`;
- live Desktop/Mobile blijft apart gerapporteerd.

## Acceptatiecriteria

- [x] Settings toont dezelfde actuele expliciete-ID-persoonset als relationship
      creation; duplicate-ID-notities mogen zichtbaar zijn.
- [x] Een unieke canonical path schrijft exact één stabiele `myPersonId`.
- [x] Een duplicate-ID-selectie schrijft niets en toont een herstelbare warning.
- [x] Een ordinary note of stale path schrijft niets.
- [x] Stored missing/ambiguous IDs blijven ongemuteerd totdat de gebruiker een
      geldige keuze maakt of expliciet wist.
- [x] De open Settings-tab ververst kandidaten/status na index-publicatie zonder
      scan, rebuild, vaultwrite of viewstatewrite.
- [x] Tests bewijzen de werkelijke write-boundary, niet alleen kandidaatoutput.
- [x] Onafhankelijke review is PASS of resterend risico is expliciet
      geaccepteerd; Node-24 full gate en `git diff --check` zijn groen.

## Blokkers

None bevestigd. De gewenste zichtbaarheid en write-safety zijn door de gebruiker
geratificeerd en in de actieve specs vastgelegd.

## Journal

- 2026-08-08 RED: `npx vitest run --project integration
  test/integration/my-person.integration.test.ts` → 8/9 groen. Beide
  duplicate-ID-paden veroorzaakten nog een settings-write.
- 2026-08-08 GREEN: de write-boundary gebruikt dezelfde generieke
  `resolveCanonicalPersonByPath`-uniquenessresolver als relationship/person
  forms. Duplicate paden blijven in de ruwe kandidatenlijst zichtbaar, maar
  worden vóór `updateSetting()` geweigerd. Integration-suite → 9/9 groen.
- 2026-08-08: `test/person-form.test.ts` en `test/relationship-form.test.ts`
  samen → 96/96 groen; `npm run typecheck` → exit 0.
- 2026-08-08 repair: De native picker-filter gebruikt opnieuw de zichtbare
  explicit-ID-projectie; twee verschillende Markdownpaden met dezelfde ID
  blijven zichtbaar. De selection-handler resolveert daarna het gekozen pad
  canoniek en toont bij ambiguity de localized recoverable warning zonder
  `updateSetting()`.
- 2026-08-08 verification: `npx vitest run --project node
  test/settings-tab.test.ts` → 22/22 groen; `npx vitest run --project integration
  test/integration/my-person.integration.test.ts` → 9/9 groen; de test dekt
  duplicate zero-write, unieke selectie en expliciet clearen. `npm run typecheck`
  → exit 0.

## Evidence

De controlled integration- en Settings-tests bewijzen zowel afwijzing vóór de
werkelijke settings-write als behoud van geldige unique-ID-persistentie.
Duplicate candidates blijven zichtbaar, de rejected-selection warning is
apart geassert en reeds opgeslagen ambigue IDs blijven niet geldig resolvebaar.
Er is geen migratie uitgevoerd; native Desktop/Mobile-hostgedrag is niet lokaal
bewezen. De Node-24 final gate is exit 0: node 53 bestanden/964 tests,
integration 9 bestanden/38 tests, settings/write-boundary en My Person
integration 9/9 groen, plus build, audit, releasecontract, reproducibility en
diff-check.
## Review

2026-08-08 onafhankelijke actuele identity/readiness-review: **PASS**. De
review bevestigde candidate parity, canonical duplicate/stale/ordinary
write-boundaries en de actuele My Person integration. Residueel: geen native
Desktop/Mobile-hostvalidatie.

## Retrospective

Visibility en persistence zijn bewust gescheiden: de ruwe kandidaatset blijft
ontdekbaar, terwijl de canonical resolver vóór `updateSetting()` uniqueness,
path en actuele snapshot valideert. De readinesstest modelleert de publieke
metadata-resolutiegrens in plaats van een premature write te verwachten.

## Referenties

- `.10x/specs/my-person-note-picker.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/tickets/2026-08-07-my-person-dropdown-mobile-fix.md` (draft/historie;
  duplicate-filterbesluit is superseded)
- `src/main.ts`
- `src/settings/settings-tab.ts`
- `src/editor/relationship-form.ts`
- `test/settings-tab.test.ts`
- `test/integration/my-person.integration.test.ts`
