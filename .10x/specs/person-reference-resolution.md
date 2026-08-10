Status: active
Created: 2026-08-10
Updated: 2026-08-10

> **Narrow supersession — 2026-08-10.** Deze spec supersedeert uitsluitend de
> referentie-resolutieregel in clause 9 en het onderscheid tussen onopgeloste en
> ambigue persoonsreferenties in clause 11 van
> `.10x/specs/canonical-graph-source.md`. De rest van die actieve spec — met name
> de canonieke `PersonIndex`-bron, duplicate-ID-bescherming, rich-relationship-
> metadata, filtered endpoints, ghostgedrag buiten deze collision en de gedeelde
> standalone/Bases-projectie — blijft volledig actief. De contactmoment-spec
> blijft leidend voor opslag, actionable-status, summaries en contextspecifieke
> contactmomentdiagnostiek; deze spec bepaalt alleen de gedeelde
> referentie-resolutiemechaniek.

# Veilige resolutie van persoonreferenties

## Doel en scope

Deze spec legt één identiteitveilige resolutiemechaniek vast voor opgeslagen
`PersonReference`-waarden en de analoge relatieverwijzingen die vanuit de index
worden opgelost. Zij bestuurt:

- het expliciete soort van een referentie;
- het vastleggen van Obsidian's `resolvedPath` tijdens parsing;
- het verzamelen en vergelijken van ID- en padkandidaten;
- graph-resolutie van gewone contacten en rijke relatie-endpoints;
- contactmoment-resolutie en de gelijkheid tussen full-build en delta-build;
- fail-closed diagnostiek bij tegenstrijdige identity-evidence.

Deze spec verandert geen opgeslagen Markdown, schrijft geen migratie en maakt
geen displaynaam, alias of label tot identiteit.

## Normatieve contracten

### Referentietype

1. Het domein MUST een expliciet `ReferenceKind`-type kennen met exact de
   waarden `wikilink`, `path` en `id`.
2. `PersonReference` MUST dit soort bevatten. De analoge
   `RelationshipReference` die een relatie-ID of relatiepad draagt MUST
   dezelfde classificatie gebruiken, zodat de generieke resolver niet opnieuw
   een first-match-regel hoeft te implementeren.
3. De parser MUST een waarde die syntactisch als `[[...]]` is geschreven als
   `wikilink` classificeren. De linktarget vóór `|` is identiteitsevidence; de
   alias na `|` is uitsluitend presentatie.
4. Een niet-gewrapte, niet-lege target met `/` of een case-insensitive `.md`-
   suffix MUST als `path` worden geclassificeerd. Overige niet-gewrapte tekst
   MUST als `id` worden geclassificeerd.
5. Displaynamen, aliases en labels MUST nooit als identiteit worden gebruikt.

### Obsidian-resolutie en opgeslagen pad

6. Voor iedere door `parseAtlasFile` geproduceerde persoons- of
   relatieverwijzing MUST People Atlas Obsidian's
   `metadataCache.getFirstLinkpathDest()` gebruiken wanneer de referentie een
   linktarget kan aanwijzen. Een succesvolle uitkomst MUST als `resolvedPath`
   in de referentie worden bewaard.
7. Dit geldt ook voor gewone `person.contacts`; zij mogen niet langer alleen
   een kale `parsePersonReference()`-uitkomst bewaren.
8. Een resolver MUST een reeds opgeslagen `resolvedPath` als actuele
   link-evidence gebruiken. Een callback naar Obsidian mag alleen als
   gecontroleerde fallback dienen voor legacy/in-memory records zonder
   `resolvedPath`; de kale linktekst mag niet stilzwijgend als ID worden
   gepromoveerd.

### Gedeelde kandidaat-resolver

9. De resolver MUST kandidaten per bron onderscheiden: expliciete ID-kandidaten,
   letterlijke/normaliseerde padkandidaten en het door Obsidian gevonden
   linkpad. Kandidaten MUST op canoniek bestandspad worden samengevoegd voordat
   een resultaat wordt gekozen; een eerste mapmatch is verboden.
10. Een referentie van soort `id` MUST primair uitsluitend tegen het expliciete
    ID-index worden opgelost. Geen match is unresolved; meerdere personen met
    dat ID zijn ambiguous.
11. Een referentie van soort `path` MUST primair tegen het genormaliseerde
    canonieke pad worden opgelost. Een pad dat naar een persoon met een
    niet-unieke `person_id` wijst blijft ambiguous; de resolver mag die persoon
    niet alsnog op basis van het pad accepteren.
12. Een referentie van soort `wikilink` MUST de volgende evidence verzamelen:
    - het opgeslagen `resolvedPath`, of het door de Obsidian-adapter gevonden
      pad wanneer het opgeslagen veld ontbreekt;
    - een letterlijke padkandidaat wanneer de target zelf path-syntactisch is;
    - een exacte ID-kandidaat op de target, uitsluitend als aanvullende
      conflict-evidence.
13. Voor een wikilink geldt vervolgens:
    - pad-evidence en ID-evidence die dezelfde unieke canonieke persoon
      aanwijzen vormen één kandidaat en zijn geldig;
    - pad-evidence en ID-evidence die verschillende personen aanwijzen vormen
      `ambiguous`, ook als elk afzonderlijk uniek is;
    - wanneer alleen een ID-kandidaat bestaat en de wikilink geen canoniek pad
      resolveert, blijft de wikilink `unresolved`; een wikilink mag niet door
      ID-first-fallback worden gered;
    - wanneer geen kandidaat bestaat, blijft de bestaande unresolved/ghost-
      semantiek gelden.
14. De resolver MUST een typed resultaat leveren met ten minste de toestanden
    `resolved`, `unresolved` en `ambiguous`, plus de betrokken kandidaatpaden
    voor diagnostiek. Consumenten mogen deze toestanden niet opnieuw afleiden
    uit alleen `reference.target`.
15. Een duplicate-ID-situatie, meerdere canonieke padmatches of een ID-versus-
    padconflict MUST fail-closed worden. Geen enkele consumer mag dan de eerste
    persoon kiezen.

### Graph en contactmomenten

16. `buildAtlasSnapshot` en `applyGraphDelta` MUST dezelfde resolver gebruiken
    voor gewone contactedges en rijke relatie-endpoints. Full-build en
    incremental graph MUST voor dezelfde records dezelfde resolved/unresolved/
    ambiguous-uitkomst produceren.
17. Bij een ambiguous persoonsreferentie in een gewone contactedge MUST geen
    edge, ook geen ghost-edge voor de bekende kandidaten, worden gepubliceerd.
    De graph MUST één `ambiguous-person-reference`-diagnostic met de bron en alle
    relevante kandidaatpaden publiceren. Een generieke unresolved-contact-
    diagnostic mag deze collision niet maskeren.
18. Bij een ambiguous endpoint in een rijke relatie MUST geen relationship-edge
    worden gepubliceerd. De graph MUST `ambiguous-person-reference` publiceren
    voor elk ambigu endpoint en niet doen alsof de fout slechts een unresolved
    endpoint is.
19. Een resolved persoon buiten de zichtbare Base-populatie blijft de bestaande
    `filtered-endpoint`-uitkomst; filtering is geen ambiguity.
20. De contactmoment-index en contactmomentprojectie MUST dezelfde gedeelde
    persoons- en relatie-resolver gebruiken. Een ambiguous persoonreferentie
    maakt het contactmoment niet-actionable en voorkomt projectie; de bestaande
    contextspecifieke `ambiguous-contact-moment-person` of
    `ambiguous-contact-moment-relationship`-diagnostiek mag behouden blijven,
    maar mag niet worden vervangen door first-match of unresolved-gedrag.
21. Contactmomenten die precies één unieke canonieke kandidaat opleveren moeten
    hun bestaande `personIds`, relationship-koppeling, actionable-status,
    follow-up-status en visibilityregels behouden.
22. De resolver en graph/index-code MUST geen nieuwe edge, note, migratie,
    automatische merge of vault-write uitvoeren.

## Given/When/Then-scenario's

### Wikilinktekst botst met een ander person-ID

Given persoon A heeft `person_id: Bob` en staat op `People/A.md`
And persoon B staat op `People/Bob.md` en heeft een andere unieke ID
And een relatie bevat `to: [[Bob]]`
And Obsidian bewaart `resolvedPath: People/Bob.md`
When de gewone graph wordt gebouwd
Then wordt persoon B als padkandidaat en persoon A als ID-kandidaat verzameld
And de referentie is ambiguous
And geen relationship-edge naar A of B wordt gepubliceerd
And `ambiguous-person-reference` noemt de relatiebron en beide persoonsbestanden.

### Een wikilink en ID wijzen naar dezelfde persoon

Given `[[Bob]]` resolveert naar `People/Bob.md`
And de persoon in `People/Bob.md` heeft `person_id: Bob`
When een contactedge of relationship-endpoint wordt opgelost
Then wordt de dubbele evidence als één unieke kandidaat samengevoegd
And de edge blijft geldig.

### Onopgeloste wikilink valt niet terug op ID

Given een wikilinktarget `[[Bob]]` heeft geen canoniek resolved pad
And een andere persoon heeft `person_id: Bob`
When de referentie wordt opgelost
Then blijft zij unresolved/ghost volgens de bestaande context
And de persoon met ID `Bob` wordt niet geselecteerd.

### Contactmoment gebruikt dezelfde ambiguity-regel

Given een contactmoment verwijst naar `[[Bob]]` met een resolved pad naar
`People/Bob.md`
And een andere persoon heeft `person_id: Bob`
When `PersonIndex` het contactmoment resolveert
Then blijft het contactmoment geïndexeerd maar niet-actionable
And de contextspecifieke ambiguous-person-diagnostic noemt beide kandidaatpaden
And het contactmoment wordt niet als geldige summary geprojecteerd.

### Padconflict blijft gefilterd, niet unresolved

Given een referentie resolveert uniek naar een canonieke persoon
And die persoon valt buiten de geselecteerde Base
When de graphprojectie wordt gebouwd
Then verschijnt geen zichtbare edge
And de uitkomst blijft `filtered-endpoint`, niet `ambiguous-person-reference` of
`unresolved-relationship-endpoint`.

## Acceptatiecriteria

- [ ] `PersonReference` en de analoge relatieverwijzing dragen een expliciet
      `wikilink`/`path`/`id`-soort met de vastgelegde parserclassificatie.
- [ ] Alle parser-geproduceerde persoonsreferenties, inclusief gewone contacts,
      bewaren Obsidian's `resolvedPath` wanneer dat beschikbaar is.
- [ ] Eén gedeelde typed resolver verzamelt ID- en padkandidaten zonder
      first-match-semantiek.
- [ ] De exacte `person_id: Bob` versus `[[Bob]] -> People/Bob.md`-regressie
      publiceert geen verkeerde gewone contactedge of relationship-edge en
      publiceert `ambiguous-person-reference`.
- [ ] Full graph-build en graph-delta gebruiken dezelfde uitkomst voor gewone
      contacten, rijke relaties, duplicate IDs, unresolved links en
      ID-versus-padconflicten.
- [ ] Contactmoment-indexering en -projectie gebruiken dezelfde persoons- en
      relatie-resolver; ambiguity maakt een moment niet-actionable zonder
      first-match.
- [ ] Unresolved links, filtered endpoints, duplicate IDs en bestaande
      contextspecifieke contactmomentdiagnostiek behouden hun onderscheiden
      betekenis.
- [ ] Gerichte tests bewijzen positieve same-person evidence, het negatieve
      collision-scenario, unresolved-wikilink-zonder-ID-fallback, duplicate ID,
      path/ID-normalisatie, full/delta-pariteit en record-order-onafhankelijkheid.
- [ ] Er is geen vaultmigratie, automatische notitiewijziging of nieuwe
      persistente identiteit.

## Foutgedrag

- `resolved`: één unieke canonieke persoon/relatie; consumeren zoals vandaag.
- `unresolved`: geen canonieke kandidaat; bestaande ghost- of
  contextspecifieke unresolved-diagnostiek blijft gelden.
- `ambiguous`: twee of meer verschillende canonieke kandidaten, duplicate ID of
  niet-unieke canonieke identiteit; geen edge en geen first-match.
- Een ambiguity-diagnostic moet stabiele, gesorteerde bron- en kandidaatpaden
  bevatten zodat full-build en delta-build reproduceerbaar blijven.

## Exclusions

- Geen wijziging aan relatie- of contactmomentfrontmatter, propertynamen,
  opgeslagen IDs of bestaande Markdown-body's.
- Geen merge-, rename-, import- of migratieworkflow voor bestaande personen.
- Geen nieuwe diagnostiekpaneel-UI of herontwerp van picker/listbox-presentatie.
- Geen displaynaam- of aliasresolutie.
- Geen uitbreiding naar externe URLs, attachments of fotoreferenties.
- Geen wijziging aan editorpresentatie of mutation-writebeleid behalve wanneer
  een bestaande graph/index-resolver direct wordt gedeeld; zulke paden vallen
  buiten deze ticketgrens en krijgen geen stille semantiekwijziging.
- Geen commit, push, release, publicatie of live-vaultwrite in deze shaping- of
  implementatieticketfase.

## References

- `.10x/decisions/person-reference-resolution-precedence.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/generated-graph-index-invariants.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `AGENTS.md`
- `src/domain/types.ts`
- `src/domain/wikilink.ts`
- `src/index/frontmatter.ts`
- `src/index/index-state.ts`
- `src/graph/build-snapshot.ts`
- `src/graph/graph-delta.ts`
- `src/graph/graph-source.ts`
- `test/wikilink.test.ts`
- `test/build-snapshot.test.ts`
- `test/index-state.test.ts`
- `test/graph-delta.test.ts`
- `test/generated/snapshot-invariants.generated.test.ts`
- `test/generated/contact-moment-index-invariants.generated.test.ts`
