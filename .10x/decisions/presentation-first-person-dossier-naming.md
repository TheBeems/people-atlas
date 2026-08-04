Status: active
Created: 2026-08-03
Updated: 2026-08-03
Supersedes: `.10x/decisions/person-dossier-storage-layout.md`

# Presentation-first persoonsdossiers onder één People-root

## Context

People Atlas 0.8.0 introduceerde dossiermappen als
`<naam-slug>--<acht-hextekens>`. De stabiele volledige `person_id` staat echter
al in het canonieke profiel-frontmatter en is de gezaghebbende identiteit. Een
zichtbare technische suffix op ieder dossier maakt de gewone file-explorer-UX
onnodig druk.

De gebruiker ratificeerde op 2026-08-03 een vervangend fresh-vault-contract:
nieuwe dossiers tonen standaard uitsluitend een veilige weergavenaam; alleen
een echte naam-/namespacecollision krijgt een korte, UUID-afgeleide Crockford
Base32-suffix. Die suffix begint bij twee tekens en groeit uitsluitend voor de
nieuwe kandidaat wanneer dat nodig is. Bestaande 0.8-dossiers worden niet
ondersteund of gemigreerd.

## Decision

1. People Atlas behoudt één configureerbare vault-relatieve `People root
   folder`, standaard `People`, en leidt daar uitsluitend deze collecties uit af:

   ```text
   <root>/Profiles
   <root>/Relationships
   <root>/Contact moments
   ```

2. Een nieuwe persoon reserveert vóór enige write één volledige UUID-backed
   `person_id`. Die volledige waarde in het canonieke profiel-frontmatter blijft
   de enige persoonsidentiteit; displaynaam, profielpad en dossiernaam zijn
   presentatie en navigatie.

3. De eerste vrije dossierbestemming gebruikt een met de bestaande
   note-naamgrens gesanitiseerde weergavenaam zonder zichtbare ID:

   ```text
   <root>/Profiles/Jan Jansen/Jan Jansen.md
   ```

   Voor collisiondetectie gebruikt People Atlas daarnaast een canonieke
   naam-/padkey die Unicode-, diakritische-, whitespace-, separator- en
   hoofdlettervarianten fail-closed als dezelfde namespace behandelt.

4. Alleen wanneer de gewone naam aantoonbaar door één andere canonieke persoon
   wordt bezet, gebruikt de nieuwe kandidaat:

   ```text
   <root>/Profiles/Jan Jansen · 7K/Jan Jansen.md
   ```

   `7K` is de eerste twee tekens van één canonieke Crockford-alphabet
   Base32-byte-streamcodering van de 16 UUID-bytes, zonder padding. De alphabet
   is `0123456789ABCDEFGHJKMNPQRSTVWXYZ`; UUID-tekst en streepjes worden niet
   gecodeerd. Als de kandidaat bezet is, groeit alleen de nieuwe suffix met één
   volgend Base32-teken totdat een vrije bestemming bestaat.

5. Een gewone bestemming die door vrije gebruikersinhoud, ontbrekende of
   ambigue ownershipmetadata, meerdere canonieke profielen of een onveilige
   pathrepresentatie wordt bezet, wordt nooit geadopteerd of stil omzeild. De
   create faalt vóór de eerste write met een zichtbare fout. Een create-time
   race faalt eveneens; de mutation boundary herberekent de actuele bestemming
   en accepteert geen van de review afwijkend pad.

6. Een eenmaal aangemaakt dossierpad blijft stabiel. Een profielrename hernoemt
   na de bestaande bevestiging uitsluitend de canonieke profielnotitie binnen
   hetzelfde dossier. Verwijderen maakt geen ander dossier suffixloos; bestaande
   suffixen worden nooit ingekort of uitgebreid vanwege latere personen.

7. Dossier- en fotownership worden gevalideerd via het unieke canonieke
   profielpad plus de volledige `person_id`, niet via displaynaam, basename of de
   korte suffix alleen. Voor een suffixed dossier moet de suffix bovendien een
   canonieke prefix van de verwachte Base32-ID zijn. Ontbrekende, ambigue,
   legacy-, handmatig verplaatste of geïnjecteerde ownership valt gesloten.

8. De profielnotitie blijft het enige door People Atlas gemaakte canonieke
   persoonsrecord in het dossier. Vrije lokale notities/assets blijven
   gebruikersinhoud. Relaties en contactmomenten blijven centrale zelfstandige
   notities; People Atlas beheert geen binary lifecycle.

9. Dit contract is opnieuw fresh-vault-only. People Atlas migreert, hernoemt,
   interpreteert of ondersteunt bestaande 0.8-dossiers met
   `<naam-slug>--<acht-hextekens>` niet. Er komt geen dual parser of verborgen
   compatibiliteitsindex.

## Alternatives considered

### Altijd een korte Base32-suffix

Eenvoudig en uniform, maar toont nog steeds technische identiteit bij iedere
persoon terwijl de UUID al in frontmatter staat. Verworpen voor de gewone
file-explorer-UX.

### Naam plus oplopende teller

`Jan Jansen (2)` is leesbaar, maar de teller is volgordeafhankelijk en niet uit
de stabiele identiteit herstelbaar. Imports en samengevoegde vaults hebben dan
een allocator of mapping nodig. Verworpen.

### Naam-only met een centrale UUID-padindex

Maakt alle mappen schoon, maar introduceert een tweede mutable datastore en
indexdrift na handmatige vaultbewerkingen. Verworpen ten gunste van
frontmatter-identiteit en collision-only suffixen.

### Twee Base32-tekens als harde vaste lengte

Zeer kort, maar een echte prefixcollision zou blokkeren ondanks beschikbare
UUID-informatie. Verworpen; adaptieve uitbreiding behoudt dezelfde UX zonder
stil collisionrisico.

### Bestaande 0.8-dossiers blijven herkennen of migreren

Minder brekend, maar vereist duale path-/ownershipgrammatica of een expliciete
vaultmigratie. De gebruiker koos expliciet fresh-vault-only. Verworpen.

## Consequences

- De doorsnee file explorer toont uitsluitend persoonsnamen; technische suffixen
  verschijnen alleen bij aantoonbare collisions.
- Padplanning wordt contextafhankelijk: dezelfde pure candidategenerator moet in
  preview en mutation boundary worden gebruikt met een actuele ownership- en
  occupancybron.
- De bestaande suffix-gebaseerde fotoauthority moet verschuiven naar volledige
  canonieke profielidentiteit, terwijl pathlocaliteit en TOCTOU-fail-closed
  gedrag behouden blijven.
- Case-, Unicode-, prefix- en create-races worden contracttests in plaats van
  impliciete filesystemaannames.
- De bestaande transaction-owned dossiercleanup blijft vereist; vrije of extern
  ontstane inhoud wordt nooit verwijderd.
- 0.8-vaults krijgen bewust geen migratie- of compatibiliteitspad.

## References

- `.10x/specs/presentation-first-person-dossier-naming.md`
- `.10x/specs/person-dossier-storage.md`
- `.10x/tickets/2026-08-03-presentation-first-dossier-naming.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
