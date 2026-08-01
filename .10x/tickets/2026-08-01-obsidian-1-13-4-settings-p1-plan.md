Status: done
Created: 2026-08-01
Updated: 2026-08-01

# Obsidian 1.13.4 P1 Settings-integratieplan

## Objective

Voer de drie in de 1.13.4-audit benoemde P1-verbeteringen uit als kleine,
verifieerbare Settings-wijzigingen zonder People Atlas-datasemantiek, vaultdata
of bestaande mutation boundaries te veranderen.

Dit is een parent-plan, geen uitvoerbaar implementatieticket.

## Governing specifications

- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/specs/settings-information-architecture.md`

## Child sequence

```text
P1a Await declarative Settings persistence
  └──> P1b Native template-deletion confirmation
         └──> P1c Settings information architecture
```

P1a en P1b zijn inhoudelijk begrensd door een actieve spec. Ze raken beide
dezelfde Settings-tab en worden daarom na elkaar uitgevoerd om onnodige
conflicten in control- en teststructuur te vermijden. P1c verplaatst daarna
de gevalideerde controls naar de geratificeerde navigatiestructuur en blijft
geblokkeerd totdat de user-facing indeling expliciet is bevestigd.

## Child tickets

| ID | Owner | Status | Depends-On |
| --- | --- | --- | --- |
| P1a | `.10x/tickets/2026-08-01-await-declarative-settings-persistence.md` | done | None |
| P1b | `.10x/tickets/2026-08-01-native-template-deletion-confirmation.md` | done | P1a |
| P1c | `.10x/tickets/2026-08-01-settings-information-architecture.md` | done | P1a, P1b |

## Parent acceptance criteria

- [x] P1a, P1b and P1c sluiten elk uitsluitend tegen hun kleinste actieve
      governing spec, expliciete implementatie-autorisatie, passende tests en
      een onafhankelijke review.
- [x] Geen child verandert opgeslagen setting keys/defaults, vaultnotities,
      relationship-template copied-value-semantiek of de bestaande
      `updateSetting()` ownership boundary.
- [x] Elke gemodelleerde testclaim houdt het onderscheid met live Obsidian
      Desktop/Mobile/Electron-bewijs expliciet.
- [x] Elke child documenteert journal, evidence, review en retrospective in
      zijn eigen ticket.

## Non-goals

- Implementatie in deze shaping-sessie.
- Commit, push, release of publicatie.
- Een algemene Settings-herbouw, nieuwe feature of nieuw datamodel.
- Een verhoging van `minAppVersion` boven 1.13.0.

## References

- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/specs/settings-information-architecture.md`
- `AGENTS.md`

## Assumptions

- User-ratified: maak voor alle P1-verbeteringen uit de 1.13.4-audit een spec
  en tickets via de 10x-werkwijze.
- Record-backed: P1a en P1b hebben een actief, concreet contract.
- User-ratified: P1c heeft een bevestigd navigatiecontract in
  `.10x/specs/settings-information-architecture.md`.

## Blockers

None. De gebruiker autoriseerde P1a → P1b → P1c; alle childtickets zijn
gesloten na onafhankelijke pass-reviews.

## Journal

- 2026-08-01: Parent-plan gemaakt in shaping na een read-only audit van de
  officiële Obsidian 1.13.4-documentatie, huidige People Atlas Settings-code,
  tests en actieve `.10x/`-records. Geen productcode, test, build, vaultdata,
  commit of externe status gewijzigd.
- 2026-08-01: De gebruiker bevestigde P1c; de
  Settings-informatiearchitectuurspec werd actief en P1c werd open gemaakt.
- 2026-08-01: P1a gesloten na onafhankelijke pass-review, gerichte
  persistence-evidence en drie groene canonical Node-24-runs uit het aparte
  runner-stability-ticket. P1b is daarmee geactiveerd.
- 2026-08-01: P1b gesloten na twee onafhankelijke pass-reviews, met aparte
  Cancel- en directe modal-close-regressiedekking en volledige groene Node-24
  gates. P1c is daarmee geactiveerd.
- 2026-08-01: P1c gesloten na onafhankelijke pass-review, exacte
  group/page-membership- en metadata-preservatietests en volledige groene
  Node-24 gates. Daarmee is de volledige P1-keten uitgevoerd.
- 2026-08-01: Eindvalidatie na alleen semantiekvrije Biome-formatcorrecties
  groen: formatter, linter, typecheck, alle vier testprojecten,
  productiebuild, releasecontract, community-readiness, reproduceerbaarheid
  en `git diff --check`. Geen commit, push of externe write uitgevoerd.

## Evidence

- Alle drie child records zijn gesloten tegen hun kleinste governing spec,
  gerichte TDD-evidence, volledige Node-24 gates en onafhankelijke pass-review.
- P1a: awaitbare declaratieve persistence met stabiele aggregate-testgate.
- P1b: scoped openbare `ConfirmationModal` voor gekoppelde templates.
- P1c: één `General` group met vier geratificeerde pages, 44 behouden controls
  en één behouden relationship-template-lijst.
- Eindgate: `npm run check` groen met 47/669 node-, 8/75 browser-, 6/14
  integration- en 3/6 browser-matrixresultaten; reproduceerbare `main.js`
  SHA-256 `763148c3959e44d58f6a2b848194c2f89f78a0b1ebd27f698be438f27b3abc8f`.

## Review

Niet gestart; parent-plannen zijn niet uitvoerbaar.

## Retrospective

De sequentiële P1-keten beperkte wijzigingen aan dezelfde Settings-tab,
terwijl aparte runnerstabilisatie en onafhankelijke reviews closure zonder
testzwakte mogelijk maakten. Live Obsidian-hostsmoke blijft bewust afzonderlijk
van dit gemodelleerde/API-bewijs.
