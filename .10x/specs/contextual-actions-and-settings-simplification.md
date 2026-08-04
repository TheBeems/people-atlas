Status: done
Created: 2026-08-04
Updated: 2026-08-04

# Contextuele acties en vereenvoudigde settings

## Doel

Maak de twee meest voorkomende vervolgstappen direct bereikbaar en maak de
People Atlas Settings-tab taakgericht in plaats van schema-gericht:

1. een geselecteerde, canonieke persoon kan zijn notitie direct openen vanuit
   het details-sheet;
2. een canonieke persoonsnotitie in leesweergave biedt naast `Edit person` ook
   `Add relationship`;
3. de Settings-tab toont alleen instellingen die een gewone gebruiker zinvol
   beheert.

## Vastgestelde context

De bron bevat al de vereiste veilige graph-sheetactie `Open note`: de renderer
maakt die als native knop, de standalone- en Bases-adapters openen de actuele
`TFile` in een workspace-tab, en de browsertest dekt aanwezigheid en activatie.
De screenshot is daarom geen aanleiding voor een tweede open-route, een
bestandsnaambased shortcut of een OS-folderactie. De uitvoerder moet de bestaande
route behouden, in de actuele build verifiëren en na build/reload visueel
controleren dat de knop in het details-sheet verschijnt.

## Scope

### Details-sheet: notitie openen

1. Een resolved, canonieke persoon MUST als eerste actie `Open note` tonen in
   het graph details-sheet.
2. De actie MUST de bestaande `onOpenNode`-callback behouden. Die opent alleen
   de actuele canonieke `TFile` in een normale Obsidian-workspace-tab.
3. Ghost-, ambiguous-, stale- of fileloze knopen MUST geen `Open note`-actie
   krijgen. Er is geen identificatie via displaynaam of dossiernaam.
4. De actie schrijft geen frontmatter, plugindata of graph/viewstate.

### Leesweergave: relatie toevoegen vanuit een persoon

5. De bestaande automatische People Atlas-actiebalk voor een actuele,
   unieke canonieke **persoonsnotitie** MUST in deze volgorde twee native
   knoppen tonen: `Edit person`, `Add relationship`.
6. `Add relationship` MUST uitsluitend `openCreateRelationship(sourcePath)`
   aanroepen. De bestaande entrypoint revalideert het canonieke persoonspad bij
   activatie, past uitsluitend de bestaande My-person-prefill toe en opent de
   bestaande relatie-modal. Alleen diens expliciete Save mag een write doen.
7. Een canonieke relatienotitie houdt uitsluitend `Edit relationship`; gewone,
   inferred, stale, niet-Markdown en dubbelzinnige bronnen tonen geen actiebalk.
8. Beide knoplisteners blijven aan dezelfde `MarkdownRenderChild` gebonden;
   DOM-elementen komen uit het owner-document van de gerenderde sectie. In een
   pop-out worden de listeners op cleanup verwijderd.

### Settings: klein, taakgericht oppervlak

9. De zichtbare Settings-tab MUST precies deze beheerbare items behouden:
   - `People root folder`;
   - `My person` (de stabiele-ID-dropdown, nooit een vrij tekstveld);
   - `Relationship templates`;
   - `Show labels`.
10. De tab MUST deze schema-/implementatie-instellingen niet meer zichtbaar
    maken: de note-type property en drie typewaarden, fallback-tag, alle
    persoons-, relatie- en contactmoment-property mappings, `Relationship role
    format`, `Default center person ID`, `Enable Bases view` en `Show
    diagnostics`.
11. Dit is alleen een vereenvoudiging van het *zichtbare settings-menu*.
    Bestaande opgeslagen waarden blijven door de huidige loader/validator
    gelezen en toegepast; dit ticket voert geen schemawijziging, defaultwijziging,
    migratie of herinterpretatie van bestaande notities uit.
12. `My person` blijft de gekozen gebruikersgerichte perspectiefinstelling.
    `Default center person ID` blijft voorlopig alleen als niet-zichtbare
    compatibiliteitswaarde bestaan; hij wordt niet vervangen door afleiding uit
    een displaynaam of graphselectie.
13. Settings openen, zoeken en navigeren MUST geen vaultscan, mutation,
    plugindatawrite, indexrebuild, view-refresh of viewstatewrite veroorzaken.

## Acceptatiecriteria

- [ ] De graph details-sheet heeft voor alleen actiegeschikte personen één
      zichtbare `Open note`-knop, die de bestaande canonieke open-route gebruikt
      en in de actuele build werkt.
- [ ] Een canonieke persoonsnotitie in leesweergave heeft precies `Edit person`
      en `Add relationship`; `Add relationship` prefilleert het exacte
      bronpersoon zonder write vóór Save.
- [ ] Een stale/ambigue/niet-canonieke persoonsactie opent geen modal voor een
      ander record en schrijft niets.
- [ ] Een relatienotitie, gewone notitie en niet-Markdownbron krijgen geen
      onjuiste extra actie.
- [ ] Cleanup en owner-document gedrag blijven gedekt voor de twee
      leesweergaveknoppen.
- [ ] De zichtbare Settings-inventory bevat alleen de drie controls plus de ene
      relationship-template-lijst uit dit contract; ieder uitgesloten key is
      afwezig uit de declaratieve boom.
- [ ] De loader behoudt bestaande opgeslagen schemawaarden zonder write of
      migratie; de wijziging is dus UI-only.
- [ ] Gerichte node-, browser- en gecontroleerde integratietests zijn groen;
      daarna `npm run test`, `npm run build` en `git diff --check` onder Node 24.
- [ ] Een onafhankelijke read-only review geeft PASS vóór sluiting.

## Uitgesloten

- Een tweede of OS-bestandsmanager-openroute, actieve-note afhankelijkheid,
  displaynaam-/mapnaamidentificatie of directe vaultwrite.
- `Add relationship` voor relatienotities, gewone notities, ghosts of inferred
  records; inline relationship editing; graph-edgeinteractie.
- Verwijderen van `PeopleAtlasSettings`-velden, opgeslagen configuratiewaarden,
  validatorregels of custom frontmatter-schemata.
- Nieuwe advanced-settingspagina, verborgen sneltoets, migration of default-
  centersemantiek.
- Commit, push, release, publicatie of live-vaultmutatie.

## Geratificeerde productbeslissingen

1. `Open note` is de compacte primaire actie voor het openen van een huidige
   persoonsnotitie vanuit het graph details-sheet; hij gebruikt de bestaande
   veilige route.
2. De leesweergave gebruikt de actieformulering `Add relationship` naast
   `Edit person`; de graph kan zijn bestaande `Create relationship`-formulering
   behouden.
3. Settings zijn voor dagelijkse persoonlijke configuratie, niet voor een
   intern Markdown-schema. Daarom blijven map, My person, templates en
   labelweergave zichtbaar; alle property-/ID-/type-mappings en technische
   toggles verdwijnen uit het menu zonder hun huidige opgeslagen betekenis te
   wijzigen.

## Nauwe supersessie

Dit contract vervangt alleen de volgende delen van bestaande actieve contracts:

- `.10x/specs/note-context-actions.md`: de eis van precies één
  persoonsknop (`Edit person`) en de uitsluiting van een extra
  relatieactie in een persoonsnotitie. De Reading View-, canonicaliteit-,
  lifecycle- en expliciete-Save-grenzen blijven volledig gelden.
- `.10x/specs/settings-information-architecture.md`: de eis dat iedere
  configureerbare key zichtbaar blijft en de pagina-membershiptabel met schema-
  en view-controls. De declaratieve openbare API, unieke/navigabele structuur,
  I/O-vrije definitiefunctie en behoud van de relationship-template-lijst blijven
  gelden.

## Referenties

- `AGENTS.md`
- `.10x/specs/note-context-actions.md`
- `.10x/specs/settings-information-architecture.md`
- `.10x/specs/perspective-relationship-foundation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `src/main.ts`
- `src/render/atlas-renderer.ts`
- `src/settings/settings-tab.ts`
- `src/view/people-atlas-view.ts`
- `src/bases/people-atlas-bases-view.ts`
- `test/integration/note-context-actions.integration.test.ts`
- `test/browser/atlas-renderer.browser.test.ts`
- `test/settings-tab.test.ts`
