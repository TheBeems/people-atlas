Status: active
Created: 2026-08-02
Updated: 2026-08-04

> **Nauwe supersessie (2026-08-04):**
> `.10x/specs/contextual-actions-and-settings-simplification.md` vervangt
> uitsluitend de oude één-persoonsknopgrens en de uitsluiting van een
> relatieactie vanuit een persoonsnotitie. De nieuwe actie is `Add relationship`
> naast `Edit person`. Alle andere Reading View-, canonicaliteit-, lifecycle- en
> expliciete-Save-grenzen in dit contract blijven gelden.

# Note-contextacties

## Doel

Maak de bestaande People Atlas-editors rechtstreeks bereikbaar vanuit de
bijbehorende canonieke persoons- of relatienotitie, zonder dat de gebruiker
eerst de atlasweergave hoeft te openen of dat de plugin Markdown of
frontmatter wijzigt.

## Scope

Deze specificatie beheerst één automatische actiebalk in **leesweergave**:

- op een canonieke persoonsnotitie: één native `Edit person`-knop;
- op een canonieke relatienotitie: één native `Edit relationship`-knop;
- de knop opent steeds de bestaande gedeelde editor voor exact het
  `sourcePath` van de gerenderde notitie.

De balk is een door de plugin gerenderd leesweergave-element. Hij vereist
geen fenced code block, templatewijziging of handmatige Markdown-marker.

## Normatief contract

1. De plugin MUST `registerMarkdownPostProcessor()` gebruiken; de API is
   publiek beschikbaar sinds Obsidian 0.9.7 en `manifest.minAppVersion` blijft
   `1.13.0`.
2. De postprocessor MUST hoogstens één actiebalk per gerenderd document tonen.
   Hij gebruikt `MarkdownPostProcessorContext.docId` voor de renderidentiteit
   en een `MarkdownRenderChild` via `ctx.addChild()` voor lifecyclebeheer.
3. De postprocessor MUST de actuele `ctx.sourcePath` classificeren tegen de
   canonieke People Atlas-index én het actuele Markdown-`TFile`. Een pad is
   alleen actiegericht wanneer precies één canonieke persoon óf precies één
   canonieke relatienotitie eraan gekoppeld is; identificatie op basis van
   bestandsnaam of displaynaam is verboden.
4. Een canonieke persoonsnotitie MUST precies één native button met zichtbare
   tekst `Edit person` en toegankelijke naam `Edit person` tonen.
5. Een canonieke relatienotitie MUST precies één native button met zichtbare
   tekst `Edit relationship` en toegankelijke naam `Edit relationship` tonen.
6. Niet-People-Atlas-notities, ghost-/inferred-records, dubbelzinnige IDs,
   verouderde indexpaden en niet-Markdownbestanden MUST geen actiebalk tonen.
7. Een persoonsknop MUST uitsluitend de bestaande path-gebaseerde
   `openEditPerson(sourcePath)`-route gebruiken. Een relatieknop MUST
   uitsluitend de bestaande path-gebaseerde `openEditRelationship(sourcePath)`-
   route gebruiken. Beide routes revalideren vlak voor het openen opnieuw;
   de actiebalk mag die validatie niet cachen of vervangen.
8. Het activeren van een knop MUST geen vaultwrite, frontmatterwrite,
   layout-state-write, grafselectie of verandering van het atlasmiddelpunt
   veroorzaken. Alleen een expliciete latere Save in de bestaande editor kan
   een mutatie veroorzaken.
9. Als de noot na renderen verwijderd, hernoemd, dubbelzinnig of niet-canoniek
   wordt, MUST de bestaande path-gebaseerde route zichtbaar falen zonder modal
   voor een verkeerd record en zonder write.
10. DOM-elementen MUST vanuit de document-owner van het door Obsidian geleverde
    sectie-element worden gemaakt. Event-listeners MUST aan de
    `MarkdownRenderChild` toebehoren en bij het verwijderen van die sectie
    worden opgeruimd.
11. De knoppen MUST native `button`-elementen blijven voor touch, keyboard en
    focus. Styling gebruikt uitsluitend bestaande Obsidian-CSS-variabelen en
    mag de actieve notitie-inhoud niet verbergen of herschrijven.

## Scenario's

### Persoon direct bewerken

Gegeven dat `People/Alice.md` precies één canonieke persoon met stabiele ID
bevat en in leesweergave wordt gerenderd
Wanneer de gebruiker `Edit person` activeert
Dan opent de bestaande `PersonModal` voor `People/Alice.md` zonder de
atlasweergave eerst te openen en zonder write vóór Save.

### Relatie direct bewerken

Gegeven dat `People/Relationships/Alice-Bob.md` precies één canonieke
relatienotitie bevat en in leesweergave wordt gerenderd
Wanneer de gebruiker `Edit relationship` activeert
Dan opent de bestaande `RelationshipModal` voor dat exacte pad zonder
atlasweergave, grafselectie of write vóór Save.

### Geen actie voor een gewone noot

Gegeven dat een gewone Markdown-notitie in leesweergave wordt gerenderd
Wanneer de postprocessor loopt
Dan verschijnt er geen People Atlas-actiebalk.

### Stale klik blijft veilig

Gegeven dat een actiebalk voor een relatienotitie is gerenderd
En de relatienotitie wordt daarna verwijderd of dubbelzinnig
Wanneer de gebruiker de bestaande knop activeert
Dan opent geen editor voor een ander record, gebeurt geen write en verschijnt
bestaande herstelbare unavailable-feedback.

### Lifecycle in een pop-out

Gegeven dat een canonieke notitie in een pop-outvenster wordt gerenderd
Wanneer de actiebalk wordt vervangen of de sectie wordt verwijderd
Dan worden de listeners opgeruimd en worden nieuwe elementen in het document
van dat venster gemaakt.

## Acceptatiecriteria

- [ ] Eén automatische leesweergave-actiebalk per gerenderd canoniek document;
      geen Markdown-marker of vaultwrite vereist.
- [ ] Canonieke persoons- en relatienotities tonen respectievelijk de juiste
      native editknop; andere of dubbelzinnige notities tonen niets.
- [ ] Knoppen gebruiken uitsluitend de bestaande path-gebaseerde
      editor-entrypoints en revalideren daarom bij activatie.
- [ ] Een stale actie kan geen verkeerde editor of write veroorzaken.
- [ ] Testharnas modelleert postprocessorregistratie, bronpad en
      `MarkdownRenderChild`-lifecycle voldoende om registratie, éénmaligheid,
      DOM/eigen document, actie en cleanup te testen.
- [ ] Gerichte Node-, browser- en integratietests bewijzen de scenario's;
      `npm run test`, `npm run build` en `git diff --check` slagen onder de
      gedeclareerde Node 24-runtime.
- [ ] Een onafhankelijke read-only review geeft een expliciet pass-verdict
      voordat het ticket sluit.

## Uitsluitingen

- Geen CodeMirror-integratie of zichtbare knoppen in Live Preview/brontekst.
- Geen nieuwe editor, modal, mutation-service of relationele datasemantiek.
- Geen relatieoverzicht in een persoonsnotitie, inline-editing, delete/rename,
  bulkbewerkingen of graph-edge-interactie.
- Geen automatische actiebalk voor contactmomenten.
- Geen commit, push, release, publicatie of live-vaultwijziging buiten de
  gecontroleerde testharnaswrites.

## Geratificeerde besluiten

1. De gebruiker koos expliciet voor automatische knoppen uitsluitend in
   leesweergave; Live Preview/brontekst blijft uitgesloten.
2. De minimale complete flow opent direct de bestaande People Atlas-editor;
   het openen of focussen van een aparte atlasweergave is geen voorwaarde.
3. De bestaande canonieke path-validatie en expliciete Save-boundary blijven
   de enige identiteit- en writecontracten.

## Referenties

- `AGENTS.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/specs/controlled-obsidian-integration-harness.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/main.ts`
- `test/obsidian-stub.ts`
- `test/integration/people-atlas-plugin.integration.test.ts`
- Obsidian Plugin API: `registerMarkdownPostProcessor`,
  `MarkdownPostProcessorContext`, `MarkdownRenderChild` (geïnspecteerd
  2026-08-02)
