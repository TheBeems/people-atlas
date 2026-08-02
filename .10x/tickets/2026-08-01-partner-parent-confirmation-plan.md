Status: done
Created: 2026-08-01
Updated: 2026-08-02

# Partner-ouderbevestiging — implementatieplan

## Objective

Lever één korte, veilige gezinsflow: een expliciete Partner-keuze maakt een
canonieke partnerrelatie herkenbaar; na een nieuwe expliciete ouder-kindrelatie
vraagt People Atlas bij precies één niet-beëindigde partner of die partner ook
ouder van het kind is. De tweede relatie blijft een apart gecontroleerde Save.

Dit is een parent-plan, geen uitvoerbaar implementatieticket.

## Governing records

- `.10x/decisions/partner-parent-confirmation.md`
- `.10x/specs/partner-parent-confirmation.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`

## Child sequence

```text
PPA1 Partner als Simple relationship
  └──> PPA2 Bevestigde partner-oudervraag
```

PPA1 levert de enige canonieke partnersemantiek (`partner`/`partner`) en de
formulierrondtrip. PPA2 mag pas daarop voortbouwen: zonder PPA1 zou een
kandidaatplanner vrije typen, templates of labels moeten interpreteren, wat
het geratificeerde contract expliciet verbiedt.

## Child tickets

| ID | Owner | Status | Depends-On |
| --- | --- | --- | --- |
| PPA1 | `.10x/tickets/2026-08-01-partner-simple-relationship.md` | done | None |
| PPA2 | `.10x/tickets/2026-08-01-confirmed-partner-parent-suggestion.md` | done | PPA1 |

## Parent acceptance criteria

- [x] PPA1 en PPA2 sluiten elk tegen de nieuwe actieve spec, expliciete
      implementatie-autorisatie, relevante tests en een onafhankelijke review.
- [x] Er is geen extra ouderassociatie-veld, -term, -template of impliciete
      tweede relatie; partner/ouder zijn de enige nieuwe zichtbare begrippen.
- [x] Partnerherkenning gebruikt alleen exact `partner`/`partner`, unieke
      canonieke personen en niet-beëindigde note-backed relaties.
- [x] De partner-oudervraag is tijdelijk, verklaarbaar en veroorzaakt nooit
      een write buiten de tweede expliciete Save.
- [x] Ambigue, ghost, stale, bestaande, meerdere of beëindigde kandidaten
      zijn veilig stil; displaynamen en vrije metadata worden nooit als
      fallbackidentiteit gebruikt.
- [x] Standalone/Bases graphcontract, settingsschema, bestaande vaultnotes en
      rendererwaarheid krijgen geen nieuw voorstelrecord of synthetische edge.
- [x] Iedere child onderscheidt gecontroleerde browser/testharnas-evidence van
      eventueel apart live Obsidian Desktop/Mobile-bewijs.

## Non-goals

- Implementatie in deze shaping-sessie.
- Een multi-partnerselectie, algemene familieboom of sibling-inferentie.
- Het interpreteren of herschrijven van bestaande `wife`/`husband`, vrije
  types, templates of relatienotities.
- Settings-, vault- of dataschemamigraties.
- Commit, push, release, publicatie of live-vaultwrites buiten de normale
  expliciete featuretests.

## References

- `.10x/specs/partner-parent-confirmation.md`
- `.10x/decisions/partner-parent-confirmation.md`
- `.10x/tickets/2026-07-31-simple-relationship-automation.md`
- `.10x/knowledge/renderer-interaction-boundaries.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

## Assumptions

- User-ratified: Partner gebruikt exact `partner`/`partner`; alleen één
  niet-beëindigde partner leidt tot de vraag.
- User-ratified: Review relationship opent de normale vooraf ingevulde editor
  en vereist een afzonderlijke tweede Save.
- Record-backed: bestaande role-pairvalidatie en mutations kunnen die tweede
  Save opnieuw onafhankelijk controleren.

## Blockers

None. PPA1 sloot groen na onafhankelijke review en de gebruiker autoriseerde
op 2026-08-01 de implementatie van beide children. Commit, push en release
blijven buiten die autorisatie.

## Journal

- 2026-08-01: Gebruiker vroeg na een repoanalyse om een 10x-specificatie en
  tickets voor een partner-oudervraag. De gebruiker ratificeerde de canonieke
  Partner-snelkeuze, precies één niet-beëindigde partner en een tweede
  gecontroleerde Save.
- 2026-08-01: Parent-plan, actieve beslissing, actieve specificatie en twee
  begrensde childtickets aangemaakt. De nieuwe actieve beslissing supersedeert
  uitsluitend de eerdere exclusieve Simple relationship-keuzelijst,
  partneruitsluiting en het voorstelverbod binnen deze afgebakende flow.
  Geen productcode, test, build, vaultdata, commit of externe status gewijzigd.
- 2026-08-01 (autorisatie en baseline): de gebruiker autoriseerde de uitvoering
  van PPA1 → PPA2. Onder Node v24.18.1/npm 11.16.0 slaagde de canonieke
  `npm run check` baseline: 47/669 Node, 8/75 browser, 6/14 integration en 3/6
  browser-matrix, gevolgd door production build, release contract en community
  check. De baselineworktree bevatte uitsluitend `.10x/` shaping-records.
- 2026-08-01 (PPA1-closure): PPA1 leverde de canonieke Partner-keuze met
  gerichte RED/GREEN-cycli en groene volledige gates. Een onafhankelijke
  read-only review gaf `passed: true` zonder findings; de added-line-scan vond
  geen secrets of riskante uitvoerpatronen. PPA1 is `done`; PPA2 is nu `active`.
- 2026-08-02 (PPA2-closure): PPA2 voegde alleen een pure lokale planner, een
  tijdelijke confirmation en een reguliere vooraf ingevulde tweede editor toe.
  Een eerste onafhankelijke review vond terecht een whitespace-duplicate-ID
  defect; de minimale getrimde-ID-reparatie en aanvullende negatieve tests zijn
  daarna onafhankelijk opnieuw beoordeeld met `passed: true`. De canonieke
  lokale eindgate `npm run check` slaagde onder Node v24.18.1/npm 11.16.0.
  PPA2 is `done`; commit, push en release blijven buiten autorisatie.

## Evidence

- PPA1: gerichte tests, volledige lokale gates en onafhankelijke read-only
  review `passed: true`; details staan in het PPA1-ticket.
- PPA2: pure planner 20 tests, twee browserbestanden met 5 tests en één
  integratiebestand met 4 tests groen. De finale `npm run check` slaagde met
  node 48 bestanden/695 tests, browser 10/80, integratie 7/18 en
  browser-matrix 3/6; formatter, linter, typecheck, production build,
  release-contract en community readiness waren groen. `git diff --check` en
  no-index whitespacechecks voor untracked PPA2-bestanden waren schoon.
- Beide childtickets onderscheiden lokale geautomatiseerde evidence expliciet
  van niet-uitgevoerd live Obsidian-/vaultbewijs.

## Review

PPA1 en PPA2 zijn elk onafhankelijk read-only beoordeeld. PPA1 passeerde in
één review. PPA2 werd na een terechte eerste reviewbevinding hersteld en de
nieuwe onafhankelijke re-review retourneerde `passed: true`, zonder security
concerns of logic errors.

## Retrospective

De kleine local-first flow bleef binnen twee expliciete gebruikersacties en de
bestaande mutation boundary. De eerste PPA2-review vond een echte
canonicalisatie-inconsistentie vóór closure; een strakke RED-test, minimale
reparatie en onafhankelijke re-review herstelden de fail-closed eigenschap. De
canonieke eindgate vond vervolgens een semantiekvrije importopmaakfout, die
voor closure is gecorrigeerd en volledig hertest. Geen live Obsidian- of
vaultcertificering is geclaimd.
