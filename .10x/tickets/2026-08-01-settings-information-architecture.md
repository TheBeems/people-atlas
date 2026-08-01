Status: done
Created: 2026-08-01
Updated: 2026-08-01

# P1c — Settings-informatiearchitectuur

Parent: `.10x/tickets/2026-08-01-obsidian-1-13-4-settings-p1-plan.md`
Depends-On: `.10x/tickets/2026-08-01-await-declarative-settings-persistence.md`, `.10x/tickets/2026-08-01-native-template-deletion-confirmation.md`

## Scope

Herstructureer alleen de bestaande declaratieve People Atlas Settings-definities
naar de door de gebruiker geratificeerde rootgroup en subpagina's. Behoud elke
bestaande setting key, controlmetadata, validatie, opslaggrens,
read-only-conditie en mutable relationship-template-lijst.

## Non-goals

- Nieuwe/verwijderde/hernomde settings, defaults, migrations of opgeslagen
  keys.
- Wijziging van relatie-, persoon-, contact-moment-, Bases- of graphsemantiek.
- Wijziging van `updateSetting()`-, template copied-value- of
  confirmationsemantiek.
- File-I/O, vaultscans, netwerkaanroepen of indexingwerk toevoegen aan
  `getSettingDefinitions()`.
- Een niet-geratificeerde pagina- of groepsindeling implementeren.
- Commit, push, release of live hostcertificering.

## Acceptance criteria

- [x] De geratificeerde `General` rootgroup en unieke subpagina's worden exact
      volgens de actieve informatiearchitectuurspec gerenderd.
- [x] Elke bestaande configureerbare key komt na flattening precies eenmaal
      voor met hetzelfde controltype, dezelfde metadata, validatie en
      read-only/visibility-voorwaarde.
- [x] De relationship-template-lijst staat precies eenmaal onder
      `Relationships` met dezelfde add/edit/reorder/delete/empty/read-only
      semantiek.
- [x] De nieuwe structuur veroorzaakt geen vaultscan, netwerkverzoek, save,
      index rebuild, view-refresh of view-statewrite bij openen, zoeken of
      navigeren.
- [x] Gerichte tests bewijzen de paginahierarchie, alle keys, unieke namen,
      preserved templategedrag en bestaande My person/contact-moment-guards.
- [x] De executor maakt duidelijk onderscheid tussen gemodelleerde
      testdekking en eventueel apart verkregen live Obsidian bewijs.
- [x] `npm run test`, `npm run build` en `git diff --check` slagen.

## References

- `.10x/specs/settings-information-architecture.md`
- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/settings/settings-tab.ts`
- `test/settings-tab.test.ts`
- `AGENTS.md`

## Assumptions

- User-ratified: de 1.13.4-auditprioriteit vraagt om een Settings-
  informatiearchitectuurverbetering.
- Record-backed: groups, mutable lists en pages zijn openbare declaratieve
  Obsidian 1.13-interfaces; de huidige tab is een platte definitielijst.
- User-ratified: de exacte root-/subpagina-indeling en settingmembership in
  `.10x/specs/settings-information-architecture.md`.

## Blockers

None. P1a en P1b zijn gesloten met onafhankelijke pass-reviews; de gebruiker
autoriseerde de volledige P1-keten en deze spec bevat de geratificeerde
navigatie-indeling.

## Journal

- 2026-08-01: Ticket in shaping aangemaakt en bewust geblokkeerd. De
  P1-aanbeveling ratificeert de behoefte aan herstructurering, maar niet de
  zichtbare navigatieleden en -volgorde. Geen productcode, test, build,
  settingsdata of externe status gewijzigd.
- 2026-08-01: De gebruiker bevestigde de voorgestelde `General` rootgroup en
  de pagina's `People schema`, `Relationships`, `Contact moments` en `View &
  Bases` met de gespecificeerde settingmembership. Ticket is nu open, maar
  blijft afhankelijk van P1a/P1b en afzonderlijke implementatie-autorisatie.
- 2026-08-01: P1a en P1b gesloten na onafhankelijke pass-reviews; de eerdere
  volgorde- en autorisatieblokkers zijn opgelost. P1c is actief gemaakt binnen
  de al door de gebruiker geautoriseerde P1-keten.
- 2026-08-01 (RED): vóór P1c-productcode zijn alleen gerichte
  structuur-/metadata-tests toegevoegd. Command:
  `export PATH=/home/nms/.local/node24/bin:$PATH && ./node_modules/.bin/vitest run --project node test/settings-tab.test.ts -t 'stratifies|keeps every configured'`.
  Resultaat: exit 1, 2 failed en 13 skipped. De verwachte structuurfout was
  `expected [ …(45) ] to have a length of 1 but got 45`; de metadata-test
  toonde bovendien de oude platte volgorde van `typeProperty`, My person en
  Relationship role format.
- 2026-08-01 (GREEN): uitsluitend de bestaande declaratieve definitie-objecten
  onder één openbare `group` met openbare `page`-items gerangschikt; geen
  control-, template-, opslag- of view-code gewijzigd. Hetzelfde gerichte
  command slaagde: exit 0, 2 passed en 13 skipped. Daarna waren de volledig
  aangeraakte bestanden groen: Node `test/settings-tab.test.ts` 15/15 en
  browser `test/browser/relationship-template-settings.browser.test.ts` 3/3.
- 2026-08-01 (gates): alle voorgeschreven Node-24-gates zijn groen met
  Node v24.18.1 en npm 11.16.0; details staan in Evidence. Geen commit, push,
  release, dependency-/lockfilewijziging, vaultwrite of externe write gedaan.
- 2026-08-01 (final validation): de eerste volledige `npm run check` stopte
  alleen bij Biome-formattering van de P1c/P1b-aangeraakte TypeScriptfiles;
  vóór typecheck of tests was geen andere gate gestart. Alleen de gemelde
  whitespace/line-wraps zijn daarna gecorrigeerd. De volledige heruitvoering
  van `npm run check`, `npm run verify:reproducible` en `git diff --check`
  slaagde onder Node v24.18.1.

## Evidence

1. **Rootgroep en unieke pagina's — voldaan.** De nieuwe gerichte test
   `stratifies one General root group into the ratified pages without losing
   declarative controls` bewijst precies één root `group` met heading
   `General`, en precies de unieke siblings `People schema`, `Relationships`,
   `Contact moments` en `View & Bases`. Zij legt ook de exacte membership en
   volgorde van de General-controls en elke pagina vast.
2. **Alle controlmetadata en keys — voldaan.** De test
   `keeps every configured control unique with its existing declarative
   metadata after flattening` vergelijkt de geflatte 44 controls met key,
   controltype, placeholder, aanwezigheid van validatie en dropdown-options,
   en bewijst daarna key-uniqueness. Bestaande contact-moment-tests bewaren de
   concrete mapping-/type-validatiegevallen; bestaande My-person-tests bewijzen
   canonical candidates, unavailable value en warning.
3. **Relationship templates en bestaande guards — voldaan.** De
   structuurtest vindt precies één `Relationship templates`-`list` direct op
   `Relationships`. Alle 15 Node-settings-tests blijven groen, waaronder de
   bestaande P1b-tests voor gekoppelde/ongekoppelde delete, Cancel, directe
   close, failed write en read-only. De bestaande template-test bewaart de
   add-label, empty-state en copied-value-copy; P1c hergebruikt datzelfde
   lijstobject ongewijzigd, zodat de bestaande edit-/reorder-/add-callbacks
   niet zijn vervangen. De browsertest daalt alleen voor de nieuwe declaratieve
   group/page-structuur af en bewijst de native confirmation- en
   copied-value-semantiek opnieuw (3/3).
4. **Geen nieuwe mutatie of I/O — voldaan via gerichte broninspectie.** P1c
   maakt uitsluitend een lokale array van de reeds bestaande definitie-objecten
   en retourneert die als publieke declaratieve `group`/`page`-boom. Er is geen
   nieuwe vault-/netwerktoegang, `updateSetting`, `saveData`, indexrebuild,
   refresh of view-statewrite toegevoegd aan `getSettingDefinitions()`.
5. **Zoekindexcontract — gemodelleerd voldaan.** Alle leaves blijven bereikbaar
   via de ene teruggegeven declaratieve array en de officiële `items`-velden;
   er is geen imperatieve `page`-factory. Dit is statisch/type- en
   gecontroleerd-testbewijs, geen live hostclaim.
6. **TDD-bewijs — voldaan.** RED en GREEN staan exact in Journal. De RED-fout
   betrof de afwezige rootstructuur, niet een test- of typefout. GREEN draaide
   dezelfde gerichte selectie zonder productcode buiten P1c.
7. **Volledige Node-24-gates — voldaan.**
   ```text
   npm run test       exit 0
     node:             47 test files, 669 tests passed
     browser:           8 test files, 75 tests passed
     integration:       6 test files, 14 tests passed
     browser-matrix:    3 test files, 6 tests passed
   npm run typecheck  exit 0
   npm run build      exit 0 (inclusief typecheck en production build)
   git diff --check   exit 0, geen uitvoer
   ```
8. **Live-hostlimiet.** Geen handmatige Obsidian Desktop- of Mobile-1.13.4
   omgeving was in deze uitvoering beschikbaar. De gecontroleerde API-stub en
   Chromium-tests certificeren daarom niet de live globale Settings-zoekindex,
   mobiele lay-out/touchbediening, Electron-pop-outs of toegankelijkheid.
9. **Volledige eindvalidatie (Node v24.18.1, npm 11.16.0) — voldaan.** Na de
   semantiekvrije Biome-formatcorrectie slaagde `npm run check`: 149 files
   formatter/linter schoon, typecheck groen, node 47/669, browser 8/75,
   integration 6/14 en browser-matrix 3/6 groen, gevolgd door productiebuild,
   releasecontract (`main.js` 345073/409600 bytes) en community-readiness (55
   source files). `npm run verify:reproducible` gaf tweemaal dezelfde
   SHA-256: `763148c3959e44d58f6a2b848194c2f89f78a0b1ebd27f698be438f27b3abc8f`.
   `git diff --check` gaf exit 0 zonder uitvoer.

## Review

- 2026-08-01: Onafhankelijke read-only red-teamreview — **pass**. Geen
  security- of logische bevindingen. De reviewer bevestigde de publieke
  Obsidian group/page-vorm, exacte geratificeerde membership, hergebruik van
  dezelfde control/list-objecten en het ontbreken van nieuwe I/O of mutaties.
- Niet-blokkerende follow-ups: houd de expliciete live-hostlimiet aan, overweeg
  later een separate no-side-effects-spytest en een key-gebaseerde constructie
  wanneer de definitielijst in de toekomst wezenlijk groeit. De huidige
  exacte page-membershiptests vangen een herschikking van de positionele slots
  al af.

## Retrospective

Een declaratieve Settings-herindeling blijft veilig wanneer bestaande
definition-objecten éénmaal worden aangemaakt, niet worden gekopieerd of
vertaald, en structurele flatteningtests iedere key, metadata en lijstpositie
vastleggen. Gemodelleerd/API-bewijs blijft expliciet onderscheiden van een
latere live Obsidian Desktop/Mobile-smoketest.
