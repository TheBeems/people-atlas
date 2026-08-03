Status: active
Created: 2026-08-03
Updated: 2026-08-03

# Persoonsdossiers onder één People-root

## Context

People Atlas wordt gebruikt als onderdeel van één Second Brain-vault. Voor de
meeste personen zijn meerdere notities en lokale bestanden nodig. De bestaande
platte persoonnotities, de centrale relatie-map en losse vaultbrede
fotozoeker maken de fysieke structuur minder overzichtelijk, terwijl een
relatie en een contactmoment niet aan één persoonsdossier toebehoren.

De gebruiker heeft expliciet toegestaan dat deze nieuwe opslagarchitectuur
breekt met eerdere versies en geen data- of settingsmigratie aanbiedt. KISS en
DRY zijn expliciete prioriteiten.

## Decision

1. People Atlas gebruikt één configureerbare vault-relatieve `People root
   folder`, met default `People`.
2. Eén path-module leidt uitsluitend hieruit drie vaste collectiepaden af:

   ```text
   <root>/Profiles
   <root>/Relationships
   <root>/Contact moments
   ```

   Er bestaan geen losse instellingen voor personen-, relatie- of
   contactmomentmappen.
3. Nieuwe personen worden bij één expliciete Save aangemaakt als één dossier:

   ```text
   <root>/Profiles/<naam-slug>--<korte-stabiele-id>/<weergavenaam>.md
   ```

   De `<naam-slug>` is alleen een leesbare initiële directorynaam. De
   collision-safe suffix bestaat uit de eerste acht lower-case hextekens van de
   willekeurige UUID die de nieuwe expliciete `person_id` voedt. De mapnaam
   verandert niet automatisch mee met een latere zichtbare naamswijziging.
4. De profielnotitie blijft de enige door People Atlas aangemaakte canonieke
   persoonsnotitie in het dossier. Gewone dossiernotities en lokale bestanden
   zijn vrije gebruikersinhoud en worden nooit door People Atlas geschreven of
   afgeleid als verborgen records.
5. Relaties en contactmomenten blijven centrale zelfstandige Markdown-notities
   in hun afgeleide collectie. Zij worden niet gedupliceerd of onder een
   willekeurig persoonsdossier genest.
6. Profielfoto's en andere persoonsgebonden bestanden mogen in het eigen
   dossier leven. De gebruiker plaatst een eerste afbeelding zelf nadat het
   dossier is aangemaakt; People Atlas kiest die bij een volgende Edit. De
   plugin kopieert, verplaatst, hernoemt, uploadt of verwijdert nooit binaries.
7. Deze beslissing is fresh-vault-only: er is geen migratie, automatische
   cleanup of compatibiliteit voor eerdere paths of opgeslagen folderkeys.

## Alternatives considered

### Vlakke personnotes en één globale Assets-map

Minder create-logica, maar slecht scanbaar zodra personen meerdere vrije
notities, bronnen en bestanden krijgen. Verworpen omdat het Second
Brain-dossierdoel niet haalt.

### Volledige `person_id` als dossiermap

Eenvoudiger afleiding, maar lang en onleesbaar in de file explorer. Verworpen
omdat een leesbare naam plus korte stabiele suffix dezelfde collisionveiligheid
biedt zonder een tweede identiteitssysteem.

### Relaties of contactmomenten onder elk persoonsdossier

Lokaal ogend, maar een multi-person-entiteit krijgt dan een arbitraire eigenaar
of duplicatie. Verworpen om de canonieke relatie- en contactmomentmodellen
centraal te houden.

### Automatische import of kopie van een eerste foto

Handig bij create, maar voegt binary lifecycle, naamconflicten, rollback en
onduidelijke eigendom toe. Verworpen: de gebruiker voegt de lokale asset zelf
toe en People Atlas behoudt zijn expliciete Markdown-writegrens.

### Meerdere vaults

Verliest native links, backlinks en één Atlas-index. Verworpen voor de
Second Brain; alleen een harde privacy-/syncgrens rechtvaardigt later een
aparte vault.

## Consequences

- Een dossier is bij honderden personen in de file explorer beter scanbaar en
  kan relevante vrije inhoud lokaal bundelen.
- De path- en settingssemantiek verandert bewust brekend. Oude mappingwaarden
  en bestanden worden niet verplaatst of geïnterpreteerd als nieuw-formaat.
- De nieuwe create-flow moet vooraf een stabiele `person_id` plannen zodat
  dossiernaam, collisioncontrole en geschreven frontmatter overeenstemmen.
- Een eerste foto is bewust een tweestapsflow: Save dossier, voeg bestand toe,
  kies het in Edit. Er blijft geen halve binarytransactie of ongewenste kopie
  over.
- Deze beslissing supersedeert uitsluitend de conflicterende storage-/settings-
  en migratieclauses van `.10x/specs/settings-information-architecture.md` en
  `.10x/specs/safe-mutations-and-versioned-data.md`; hun overige veilige
  mutation-, validatie- en settingsprincipes blijven gelden.

## References

- `.10x/specs/person-dossier-storage.md`
- `.10x/research/2026-08-03-person-dossier-storage-discovery.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/settings-information-architecture.md`
