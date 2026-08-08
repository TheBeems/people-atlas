Status: done
Created: 2026-08-08
Updated: 2026-08-08
Parent: `.10x/tickets/2026-08-08-final-review-remediation.md`
Owner: People Atlas implementation workstream — release contract
Depends-On: `.10x/decisions/release-bundle-limit-removal.md`, `.10x/specs/reproducible-obsidian-release.md`

# Releasecontract: verwijder arbitraire bundlelimiet

## Doel

Breng scripts, tests en package-gates in lijn met het geratificeerde besluit dat
production-bundlegrootte observeerbaar maar niet gate-bepalend is.

## Scope

- verwijder `BUNDLE_LIMIT_BYTES` en de vaste size-failure uit
  `scripts/release-contract.mjs`;
- verwijder uitsluitend de size-specifieke CLI/testverwachtingen;
- behoud validatie van regular files, metadata, exacte versies, sourcemaps,
  production/release-assets en reproduceerbaarheid;
- werk package-scripts, testnamen en documentreferenties bij waar zij nog een
  bundle budget claimen;
- laat de releasecontractoutput artifactgrootte desgewenst rapporteren zonder
  die als pass/fail-criterium te gebruiken.

## Niet doen

- Geen nieuwe size-limiet invoeren;
- geen minification-, sourcemap-, asset- of reproducibility-check verwijderen;
- geen version bump, tag, push, GitHub-release of community submission;
- geen dependency-upgrade buiten bestaand lockfilewerk;
- geen wijziging aan runtime-pluginfunctionaliteit.

## Verticale TDD

### Slice 1 — contractsemantiek

- RED: voeg een regression aan die de huidige vaste size-gate als ongewenste
  contractsemantiek blootlegt, zonder de productiecode te verzwakken.
- GREEN: verwijder de vaste budget-API en bewijs dat een grote maar geldige
  productionbundle niet op bytes faalt.
- Behoud negatieve tests voor ontbrekende assets, metadata, sourcemaps en
  ongeldige tags.

### Slice 2 — gate-integratie

- RED: zoek en faal op stale test-, script- of documentclaims van een vaste
  bundlelimiet.
- GREEN: `npm run check`, releasecontract en reproducibility blijven
  afzonderlijk observeerbaar en size-onafhankelijk.

### Review en gates

- onafhankelijke read-only review tegen de decision en actieve release-spec;
- daarna één actuele Node-24 full gate: `npm run check`,
  `npm run verify:reproducible` en `git diff --check`;
- geen closure bij stale limietclaims of ontbrekende negatieve artifacttests.

## Acceptatiecriteria

- [x] Geen vaste byte-limiet of `BUNDLE_LIMIT_BYTES` bepaalt nog een quality- of
      releasepass/fail.
- [x] De actieve release-spec, `scripts/release-contract.mjs`, tests en
      package-gates gebruiken dezelfde size-onafhankelijke semantiek.
- [x] Minification, sourcemap-vrijheid, asset-aanwezigheid, metadata, audit en
      reproduceerbare SHA-256-output blijven beschermd.
- [x] Een gecontroleerde bundle boven de historische 409.600- en 500.000-byte
      waarden kan alleen slagen wanneer alle overige contracten geldig zijn;
      de test gebruikt geen echte publicatie.
- [x] De onafhankelijke review is `pass` of resterend risico is expliciet
      geaccepteerd in dit ticket.
- [x] Node-24 `npm run check`, reproducibility en `git diff --check` zijn groen.

## Blokkers

None bevestigd. De contractwijziging is door de gebruiker geratificeerd in deze
werkstroom; implementatie blijft een afzonderlijke uitvoeringsfase.

## Journal

- 2026-08-08: De gebruiker ratificeerde het verwijderen van de vaste
  bundlelimiet; de actieve release-spec en decision record zijn daarop
  aangepast. Geen publicatie- of remoteactie.
- 2026-08-08 RED: `npm run test:release-contract` → 19/20 groen, 1 failure.
  De nieuwe test met een bundle van 500.001 bytes faalde op de bestaande
  `main.js is ... allowed limit`-error. Dit bewees dat de oude size-gate nog
  actief was.
- 2026-08-08 historical GREEN before the final artifact rebuild: `npm run
  release:contract -- --tag 0.12.1` → exit 0; observability reported the then-
  current `main.js 418885 bytes` and the three assets. The final-gate artifact
  observation is recorded below as `426082 bytes`.

## Evidence

De slice ondersteunt dat de vaste size-gate is verwijderd terwijl de overige
releasecontractchecks blijven werken. De test bewijst niet dat een echte
GitHub-publicatie plaatsvindt; remote publicatie blijft buiten scope. De actuele
Node-24 final gate is exit 0; releasecontract `--tag 0.12.1` rapporteerde
`main.js 426082 bytes` en exact de drie assets, dependency-audit rapporteerde
0 vulnerabilities en reproducibility gaf twee gelijke SHA-256-digests.

## Review

2026-08-08 onafhankelijke actuele release-review: **PASS** voor de
size-onafhankelijke contractsemantiek en behouden artifact-/metadata-/tag- en
reproducibilityrails. Residueel: geen echte remote publicatie of attestation.

## Retrospective

Het verwijderen van een arbitraire bytegate is veilig wanneer de echte
artifact-, metadata-, audit- en reproducibilityrails afzonderlijk blijven
faleren bij ongeldige output. Observability van de bundlegrootte blijft nuttig,
maar is geen releasebeleid.

## Referenties

- `.10x/decisions/release-bundle-limit-removal.md`
- `.10x/specs/reproducible-obsidian-release.md`
- `scripts/release-contract.mjs`
- `test/release-contract.test.ts`
- `package.json`
