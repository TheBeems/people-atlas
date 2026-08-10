Status: active
Created: 2026-08-10
Updated: 2026-08-10

# Voorrang van wikilinkpaden boven toevallige person-ID's

## Context

People Atlas ondersteunt handmatig geschreven en geïmporteerde persoonsnotities.
Daardoor is een door de gebruiker gekozen `person_id` niet noodzakelijk uniek ten
opzichte van een wikilinktekst. De huidige graph-resolver controleert bij een
referentie eerst een exacte ID-match en gebruikt pas daarna het door Obsidian
opgeloste bestandspad. Daardoor kan `[[Bob]]`, dat Obsidian naar
`People/Bob.md` resolveert, ten onrechte een andere persoon met
`person_id: Bob` selecteren.

`PersonIndex`/contactmomentresolutie verzamelt al kandidaten uit meerdere
bronnen en weigert niet-unieke resultaten, maar graphopbouw en contactmomenten
hebben momenteel niet één gedeelde referentiesemantiek.

## Decision

1. Iedere door People Atlas geparste persoon- of relatieverwijzing krijgt een
   expliciet soort: `wikilink`, `path` of `id`.
2. `[[...]]` is altijd `wikilink`. Een niet-gewrapte target met `/` of een
   `.md`-suffix is `path`; overige niet-gewrapte tekst is `id`. Een displaynaam
   of alias is nooit een identiteitssleutel.
3. Een wikilink wordt primair als link naar een bestand behandeld. Het
   `resolvedPath` van Obsidian is de primaire padkandidaat. Een exacte ID-match
   op de linktekst mag uitsluitend als aanvullende kandidaat worden verzameld
   om een conflict te detecteren; hij mag een niet-opgeloste wikilink niet
   zelfstandig redden.
4. Als de pad- en ID-kandidaten naar dezelfde unieke canonieke persoon wijzen,
   is de referentie geldig. Als zij naar verschillende personen wijzen, is de
   referentie ambigu en wordt zij fail-closed afgehandeld. Bij graphprojectie
   wordt dan geen edge gepubliceerd en wordt `ambiguous-person-reference`
   uitgegeven.
5. Eén gedeelde, bron-onafhankelijke resolver bepaalt deze uitkomst voor gewone
   contactedges, rijke relatie-endpoints en contactmomentreferenties. Geen van
   deze consumenten mag first-match-semantiek toevoegen.
6. Er komt geen vaultmigratie, automatische notitiewijziging of ID-hernoeming.
   De classificatie en het opgeslagen `resolvedPath` zijn in-memory parse-data;
   bestaande Markdown-notities blijven ongewijzigd.

## Alternatives Considered

### Huidige ID-first-resolutie

Verworpen. Deze kiest een persoon die niet door de wikilink wordt aangewezen en
kan zonder foutdiagnostiek een verkeerde relatie in de graph zetten.

### Alleen het resolvedPath gebruiken

Niet gekozen. Dit voorkomt de verkeerde ID-voorrang, maar maakt een collision
tussen een linktekst en een ander expliciet ID onzichtbaar. Het product zou dan
stil één interpretatie kiezen terwijl handmatige data tegenstrijdig is.

### Een onopgeloste wikilink terugvallen op een unieke ID

Verworpen. Dit behandelt linktekst als identiteit, terwijl de gebruiker een
bestandreferentie heeft geschreven. Het maakt type-informatie betekenisloos en
kan opnieuw een verkeerde persoon selecteren.

## Consequences

- Handmatig geschreven `[[Bob]]` met `resolvedPath: People/Bob.md` wordt niet
  meer gekoppeld aan een andere persoon met `person_id: Bob`.
- Gelijkwaardige pad- en ID-evidence voor dezelfde persoon blijft geldig.
- Tegenstrijdige evidence maakt graphedges ongeldig en zichtbaar diagnostisch;
  contactmomenten blijven niet-actionable volgens hun bestaande
  contextspecifieke diagnostiek.
- Parser- en testfixtures moeten het nieuwe referentietype expliciet dragen.
- De graph- en indeximplementatie krijgt één resolvergrens, waardoor full-build,
  delta-build en contactmoment-indexering dezelfde uitkomst kunnen bewijzen.

## References

- `.10x/specs/person-reference-resolution.md`
- `.10x/specs/canonical-graph-source.md`
- `.10x/specs/contact-moments-follow-up.md`
- `src/domain/types.ts`
- `src/domain/wikilink.ts`
- `src/graph/build-snapshot.ts`
- `src/index/index-state.ts`
