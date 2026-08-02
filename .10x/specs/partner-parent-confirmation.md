Status: active
Created: 2026-08-01
Updated: 2026-08-01

# Expliciete partnerrelatie en bevestigde partner-oudervraag

## Purpose

Maak de gezinsflow eenvoudiger zonder relaties als feit af te leiden. Een
gebruiker kan een expliciete partnerrelatie vastleggen. Wanneer die gebruiker
daarna een nieuwe ouder-kindrelatie opslaat, mag People Atlas bij precies één
unieke, niet-beëindigde partner vragen of die partner ook ouder van het kind
is. De gebruiker beoordeelt en bewaart die tweede relatie altijd afzonderlijk.

De zichtbare taal is **partner** en **ouder**. Er is geen derde
ouderassociatie als productbegrip in UI, settings of opgeslagen data; de
gebruikersdocumentatie beschrijft uitsluitend partner en ouder.

## Precedence and supersession

Deze specificatie wordt beheerst door
`.10x/decisions/partner-parent-confirmation.md`. Zij supersedeert in
`.10x/specs/simple-relationship-automation.md` alleen de drie-keuzelijst en
rolpaaropsomming die Partner uitsluiten, de partneruitsluiting in Exclusions,
en het `propose`-deel van clause 22. De vervanging geldt uitsluitend voor de
expliciete Partner-keuze en de na-create partner-oudervraag hieronder. Alle
andere no-inference-, neutral-storage-, identity- en mutation-invarianten
blijven ongewijzigd actief.

## Scope

Deze specificatie beheerst:

- de aanvullende Simple relationship-keuze Partner;
- de exacte `partner`/`partner`-opslag en -herkenning;
- één pure, kortdurende kandidaatbepaling na een nieuwe parent-child-write;
- een toegankelijke bevestigingsmodal;
- het openen van de bestaande vooraf ingevulde relatie-editor voor de tweede
  relatie; en
- pure, browser- en integratieregressies voor de nieuwe flow.

## Ubiquitous language

- **Canonieke partnerrelatie**: een note-backed relatie tussen twee
  verschillende, uniek opgeloste personen met exact de rollen
  `partner`/`partner` en zonder status `ended`.
- **Nieuwe ouder-kindrelatie**: een succesvol aangemaakte, note-backed relatie
  waarvan de twee rollen exact `parent`/`child` of `child`/`parent` zijn.
- **Ouder**: de endpoint met de canonieke rol `parent` in de nieuwe
  ouder-kindrelatie.
- **Kind**: de endpoint met de canonieke rol `child` in de nieuwe
  ouder-kindrelatie.
- **Partnerkandidaat**: de ene unieke canonieke persoon die via een
  canonieke partnerrelatie aan de ouder is gekoppeld.
- **Voorstel**: een tijdelijke UI-vraag; geen graph-edge, indexrecord,
  diagnostic of opgeslagen relatie.

## Normative contract

### Partner als eenvoudige relatie

1. De gedeelde create- en edit-relatieformulieren MUST een native,
   toetsenbordtoegankelijke Simple relationship-optie `Partner of the second
   person` tonen naast Custom, Parent, Child en Sibling.
2. Kiezen voor Partner MUST alleen de onopgeslagen rollen invullen als exact
   `partner` voor beide endpoints. Het MUST geen type, template-ID, endpoint,
   pad, relationship-ID, closeness, datum, status, disclosure, scrollpositie
   of focus veranderen.
3. De Simple relationship-keuze MUST uit het actuele getrimde rolpaar worden
   afgeleid. Alleen exact `partner`/`partner` toont Partner; elke afwijkende
   spelling, hoofdlettergebruik, vertaling of incompleet paar toont Custom en
   blijft ongewijzigd.
4. Partner heeft geen genderafgeleide presentatie. De bestaande renderer
   gebruikt het letterlijke `partner` als rol, tenzij een gebruiker later een
   expliciet aangepaste rol bewaart.
5. Partner verandert geen relationship types. Types en templateprovenance
   blijven optionele, expliciete metadata volgens hun bestaande contract.

### Pure partner-ouderkandidaat

6. Kandidaatbepaling MUST puur zijn: geen Obsidian-import, vaultread,
   indexwrite, settingswrite, modal of graphmutatie.
7. Een kandidaat MAY uitsluitend worden bepaald na de succesvolle create-flow
   van een nieuwe ouder-kindrelatie. Het opslaan van een edit, indexrefresh,
   render, geselecteerde node, genderwijziging, templateactie of handmatige
   Markdownwijziging MUST geen voorstel openen.
8. De planner MUST uitsluitend werken met canonieke persoonidentiteit en
   note-backed relationship records. Displaynamen mogen alleen worden gebruikt
   om een reeds bepaalde kandidaat te tonen.
9. Een voorstel is alleen toegestaan wanneer alle volgende voorwaarden waar
   zijn:
   - de nieuwe relatie heeft exact één parent- en één child-endpoint;
   - ouder en kind zijn twee verschillende, uniek canonieke personen;
   - de ouder heeft exact één **unieke partnerpersoon** uit alle incident
     canonieke partnerrelaties; meerdere parallelle partnernotities naar
     dezelfde persoon tellen als één persoon;
   - elke betrokken partnerrelatie waarop de kandidaat rust is niet `ended`;
   - de partner is een andere canonieke persoon dan ouder en kind; en
   - er bestaat nog geen expliciete canonieke parent-child-relatie tussen de
     partner en het kind, ongeacht de opgeslagen endpointvolgorde.
10. De planner MUST geen voorstel geven wanneer een endpoint, partner of
    bestaande relatie ambigue, ghost, self, onopgelost, filtered of niet
    note-backed is; wanneer geen of meer dan één partnerpersoon resteert; of
    wanneer de mogelijke tweede ouderrelatie al bestaat.
11. De planner MUST partner niet herkennen via vrije relationship types,
    template-IDs/-namen, `wife`, `husband`, displaynamen, gender, pronouns,
    My person, current center, gedeelde ouders of graph neighborhood.

### Bevestigingsinteractie en writes

12. Na een geldige kandidaat MUST People Atlas één modal openen die de
    partner, ouder en kind met hun displaylabels uitlegt en semantisch vraagt:
    `Is [partner] ook ouder van [kind]?` De modal MUST niet suggereren dat dit
    al een vaststaand feit is.
13. De primaire actie `Review relationship` MUST de bestaande create
    RelationshipModal openen met de kandidaatpartner als eerste endpoint, het
    kind als tweede endpoint en exact de onopgeslagen rollen
    `parent`/`child`. Zij MUST geen note rechtstreeks schrijven.
14. De create-editor blijft volledig bewerkbaar. De gebruiker MAY endpoints,
    rollen, template, types, pad en overige reguliere velden beoordelen of
    wijzigen voordat die tweede relatie via de bestaande expliciete Save wordt
    aangemaakt.
15. `Not now`, Cancel, Escape, backdrop-dismiss en een directe `close()` van
    de bevestigingsmodal MUST geen tweede relatiewrite, indexwrite,
    settingswrite, templatewijziging of graph-edge veroorzaken. De reeds
    succesvol geschreven eerste ouder-kindrelatie blijft intact.
16. Als de tweede create-editor wordt gesloten of haar Save faalt, MUST de
    eerste relatie intact blijven en MUST geen retry, tweede voorstel of
    verborgen compensatiewrite plaatsvinden.
17. Bij de tweede Save MUST de bestaande mutation service opnieuw alle
    endpoint-, identity-, path- en rolvalidatie uitvoeren. Een inmiddels stale
    of ambigue kandidaat mag daardoor niet tot een write leiden.
18. Een voorstel is session-local en éénmalig voor die succesvolle eerste
    create-flow. Het MUST niet worden opgeslagen, opnieuw afgespeeld na reload
    of getoond als permanente suggestielijst.

### Accessibility and lifecycle

19. De bevestigingsmodal MUST controls met toegankelijke namen hebben, de
    owning Document/Window gebruiken en een logische focusvolgorde houden.
20. De modal MUST na de eerste create-flow openen zonder een eerdere modal te
    hergebruiken of dubbele handlers te lekken. Haar eigen afsluitpaden mogen
    de bestaande succes- of close-callbacks niet nogmaals uitvoeren.
21. Narrow/mobile browserdekking MUST aantonen dat tekst, primaire actie en
    `Not now` zonder horizontale scroll en via toetsenbord bereikbaar zijn.

### Storage and compatibility

22. Deze slice gebruikt alleen bestaande relationship endpoint- en
    `from_role`/`to_role`-properties. Er komt geen extra
    ouderassociatie-property, `partner_of`, suggestie-ID, settings-key,
    migratie, vaultbulkupdate of herschrijving van bestaande notes.
23. Bestaande notes met exact `partner`/`partner` kunnen deelnemen omdat de
    opslag geen selectorprovenance kent. Alle andere bestaande custom/literal
    rolparen blijven Custom en worden niet aangepast of geïnterpreteerd.
24. `parent`/`child` blijft neutrale opslag. De bestaande optionele
    genderafgeleide father/mother/son/daughter-presentatie blijft uitsluitend
    presentatie en levert nooit een kandidaat of write op.

## Given/When/Then scenarios

### Voeg een tweede ouder gecontroleerd toe

Given Alex heeft één actieve canonieke `partner`/`partner`-relatie met Robin

When Alex een nieuwe `parent`/`child`-relatie met Sam opslaat

Then People Atlas vraagt of Robin ook ouder van Sam is, en `Review
relationship` opent een nieuwe editor met Robin als parent en Sam als child;
alleen een tweede Save maakt de Robin-Sam-notitie.

### Niet nu is write-free

Given een geldige partner-oudervraag na de Alex-Sam-save

When de gebruiker `Not now`, Cancel, Escape, backdrop of direct sluiten kiest

Then alleen de al opgeslagen Alex-Sam-relatie bestaat; er is geen Robin-Sam
notitie, settingswrite, synthetische edge of later automatisch voorstel.

### Een historische partner telt niet

Given Alex heeft een `partner`/`partner`-relatie met Robin met status `ended`

When Alex een nieuwe parent-child-relatie opslaat

Then er verschijnt geen partner-oudervraag.

### Meerdere partners worden niet geselecteerd

Given Alex heeft canonieke partnerrelaties met Robin en Casey

When Alex een nieuwe parent-child-relatie opslaat

Then People Atlas kiest geen partner, toont geen keuzelijst en schrijft niets
extra's.

### Vrije partnertekst telt niet

Given Alex heeft een relatie met de rollen `wife`/`husband` of een vrije type
`partner`, maar geen exact `partner`/`partner`-rolpaar

When Alex een nieuwe parent-child-relatie opslaat

Then er verschijnt geen voorstel en de bestaande relatie blijft byte-semantisch
ongewijzigd.

### Bestaande tweede ouderrelatie voorkomt duplicatie

Given Robin heeft al een expliciete parent-child-relatie met Sam

When Alex een nieuwe parent-child-relatie met Sam opslaat en Robin Alex' enige
canonieke partner is

Then People Atlas toont geen voorstel voor Robin en Sam.

## Acceptance criteria

- [ ] Partner is een toegankelijke Simple relationship-keuze en round-tript
      uitsluitend via exact `partner`/`partner`.
- [ ] Partner wijzigt geen relatieveld buiten de twee onopgeslagen rollen en
      veroorzaakt voor Save geen write.
- [ ] Een pure planner vindt uitsluitend de geratificeerde unieke,
      niet-beëindigde, canonieke partnerkandidaat.
- [ ] Geen type, template, naam, gender, pronouns, grafpositie, gedeelde
      ouder, ambiguous/ghost endpoint of meervoudige partner leidt tot een
      voorstel.
- [ ] Een bestaand parent-child-paar voor partner en kind voorkomt duplicatie
      ongeacht endpointvolgorde.
- [ ] De bevestigingsmodal gebruikt alleen partner/ouder-taal, verklaart de
      aanleiding en heeft Review relationship/Not now plus veilige
      closepaden.
- [ ] Review relationship opent de gewone, vooraf ingevulde tweede
      relatie-editor; alleen diens expliciete Save schrijft een tweede note.
- [ ] Dismiss-, close- en failed-second-savepaden zijn write-free behalve de
      reeds voltooide eerste relatiewrite.
- [ ] Geen settings-, frontmatter- of vaultmigratie; geen persistent voorstel
      en geen synthetische graph-edge.
- [ ] Pure, formulier-, browser- en plugin/integratietests bewijzen de
      kandidaatvoorwaarden, writegrenzen, stale hervalidatie, focus/lifecycle
      en mobile reflow.
- [ ] `npm run test`, `npm run build` en `git diff --check` slagen.

## Error behavior

- Een niet-opgeloste, ambigue, verdwenen of inmiddels niet-canonieke kandidaat
  produceert geen voorstel of een normale bestaande Save-fout; nooit een
  fallback op een displaynaam.
- Faalt de eerste relatie-save, dan bestaat er geen voorstel.
- Faalt of sluit de tweede editor, dan blijft de eerste relatie bestaan zonder
  verborgen retry of rollback.
- Ontbreekt de public host-modalgrens in het gecontroleerde testharnas, dan
  wordt alleen de minimale publieke grens toegevoegd en worden Cancel en
  directe close afzonderlijk gemodelleerd.

## Exclusions

- Automatisch aanmaken, wijzigen, verwijderen, synchroniseren of bulk
  propageren van relatie-notities.
- Een extra ouderassociatie-begrip, -property, -template of zichtbare
  UI-string.
- Partnerdetectie via vrije types, templateprovenance, labels, namen, gender
  of grafiekstructuur.
- Een selector voor meerdere partners, sibling- of andere kinship-inferentie,
  stamboomcatalogus, kansscore of LLM.
- Een permanente suggestie-inbox, notificaties, telemetry of netwerktoegang.
- Commit, push, release of live Obsidian Desktop/Mobile-certificering.

## Ratified and record-backed decisions

1. User-ratified on 2026-08-01: de zichtbare termen zijn partner en ouder;
   een derde ouderassociatie wordt niet gebruikt.
2. User-ratified on 2026-08-01: alleen de expliciete canonical
   Partner-snelkeuze met `partner`/`partner` telt als partnersemantiek.
3. User-ratified on 2026-08-01: alleen één niet-beëindigde partner geeft een
   voorstel; bij meerdere partners wordt niets geselecteerd of getoond.
4. User-ratified on 2026-08-01: de positieve actie opent de gewone vooraf
   ingevulde relatie-editor; de tweede note vereist een eigen Save.
5. Record-backed: `RelationshipRecord` heeft bestaande endpointrollen en
   optionele status; de safe mutation service valideert de tweede write
   zelfstandig.
6. Record-backed: renderer en graph bouwen uitsluitend uit de canonieke
   snapshot; een voorstel moet daarom buiten die graphwaarheid blijven.
7. KISS/YAGNI: één exact rollenpaar en één modal zijn voldoende; er is geen
   nieuw relatieveld, instellingenmodel of algemene kinship-engine nodig.

## References

- `.10x/decisions/partner-parent-confirmation.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `.10x/tickets/2026-07-31-simple-relationship-automation.md`
- `src/domain/simple-relationships.ts`
- `src/editor/relationship-form.ts`
- `src/editor/relationship-modal.ts`
- `src/main.ts`
- `src/mutations/atlas-mutation-service.ts`
- `AGENTS.md`
- `ARCHITECTURE.md`
