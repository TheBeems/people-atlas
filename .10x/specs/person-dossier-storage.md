Status: active
Created: 2026-08-03
Updated: 2026-08-03
Partially-Superseded-By: `.10x/specs/presentation-first-person-dossier-naming.md` for dossier naming, collision planning, ownership validation and the renewed fresh-vault boundary

# Persoonsdossiers in één Second Brain-vault

## Purpose

Maak People Atlas geschikt voor een overzichtelijke Second Brain-vault waarin
personen meerdere eigen notities en bestanden kunnen hebben, zonder relaties,
contactmomenten of binaire assets over een losse globale structuur te
verspreiden.

## User-ratified constraints

- People Atlas en de Second Brain leven in één vault.
- Een persoon krijgt een eigen dossier onder `People/Profiles/`.
- Relaties blijven centrale zelfstandige notities onder
  `People/Relationships/`.
- Contactmomenten blijven centrale, tijdgeoriënteerde notities onder
  `People/Contact moments/`.
- Profielfoto's en andere persoonsgebonden bestanden mogen in het
  persoonsdossier leven; een globale `Assets/`-map is geen vereiste.
- Backwards compatibility en data- of settingsmigraties zijn niet vereist.
  Deze slice mag een brekende, fresh-vault-opslagarchitectuur invoeren.
- KISS, DRY en expliciete, reviewbare vaultwrites zijn leidend.

## Proposed storage contract

### One root, three entity collections

De plugin heeft precies één instelbare, vault-relatieve `People root folder`
met default `People`. De drie collectiepaden worden uitsluitend afgeleid door
één gedeelde path-helper:

```text
<root>/Profiles
<root>/Relationships
<root>/Contact moments
```

`Profiles`, `Relationships` en `Contact moments` zijn vaste begrippen, geen
apart configureerbare folderkeys. Dat voorkomt drie onafhankelijke paden die
naar elkaar kunnen driften.

### Person dossier

Iedere nieuw gecreëerde canonieke persoon MUST precies één dossier krijgen
onder `<root>/Profiles/<dossier-slug>/`.

Het dossier bevat:

```text
<root>/Profiles/<dossier-slug>/
  <weergavenaam>.md        # de enige canonieke person note
  <optionele lokale foto's en bestanden>
  <optionele vrije ondersteunende Markdown-notities>
```

- Alleen de profielnotitie krijgt de canonieke `person`-classificatie en een
  gegenereerde expliciete `person_id`.
- Ondersteunende bestanden krijgen geen verborgen People Atlas-frontmatter,
  worden niet als personen afgeleid en worden nooit door de plugin
  overschreven.
- Een profielnaamwijziging MAY uitsluitend de profielnotitie hernoemen binnen
  hetzelfde dossier. Zij MUST de dossiermap, `person_id`, foto's en
  ondersteunende bestanden niet automatisch hernoemen of verplaatsen.
- Create, Cancel, Escape, renderen en indexeren MUST geen dossier, foto of
  ondersteunend bestand schrijven. Een dossier ontstaat pas door één
  expliciete geslaagde Save.
- Een bestaande dossier- of profielbestandsbotsing MUST vóór de eerste write
  zichtbaar falen; geen impliciete teller, overschrijving of gedeeltelijk
  dossier is toegestaan.

### Photos and other local files

Een geselecteerde profielfoto MUST een ondersteund vault-relative afbeeldingspad
binnen het eigen persoonsdossier refereren. De plugin MUST de bestaande
veiligheidsgrens behouden:

- geen download, kopie, move, rename, delete, upload of imagebewerking;
- alleen een expliciete Save schrijft de foto-wikilink in de profielnotitie;
- een ontbrekende, stale of niet-lokale selectie schrijft niets en valt in de
  weergave terug op initials.

De detailkeuze voor de eerste foto bij nieuw aanmaken staat onder Blockers.

### Relationships and contact moments

- Een nieuwe relatie MUST in `<root>/Relationships/` ontstaan, één canonieke
  notitie per relatie. Zij staat nooit in het dossier van één endpoint.
- Een nieuw contactmoment MUST in `<root>/Contact moments/` ontstaan en zijn
  bestaande multi-person- en optionele-relatiecontract behouden.
- De opslaglocatie van relaties of contactmomenten verandert nooit
  relatie-identiteit, endpointvalidatie, follow-upsemantiek, `last_contact` of
  de index als tweede store.

### Settings and break boundary

Deze specificatie vervangt voor deze opslagarchitectuur:

1. de beperkte “geen settingwijziging”-scope in
   `.10x/specs/settings-information-architecture.md`; en
2. de verplichte backwards-compatible settingsmigratie voor deze
   fresh-vault-structuur in `.10x/specs/safe-mutations-and-versioned-data.md`.

Een uitvoerder MUST geen vaultnote, asset of bestaande plugindata migreren,
verplaatsen, hernoemen of opschonen. Oude map- en settingwaarden krijgen geen
compatibiliteitspad; de nieuwe structuur geldt voor een verse inrichting.

## Scenarios

### Create a dossier

Given de People root is `People` en er is geen botsing
When de gebruiker expliciet een persoon opslaat
Then bestaat precies één dossier met precies één canonieke profielnotitie op
de geratificeerde dossierbestemming
And opent de plugin die profielnotitie
And zijn er geen andere vaultwrites.

### Rename a profile

Given Alice's profielnotitie en foto staan in één bestaand dossier
When de gebruiker haar weergavenaam wijzigt en de bestandsrename bevestigt
Then verandert alleen de profielbestandsnaam binnen hetzelfde dossier
And blijven dossierpad, `person_id`, fotoverwijzing en ondersteunende bestanden
ongewijzigd.

### Store a local photo

Given een ondersteunde afbeelding bestaat in Alice's dossier
When de gebruiker haar in de person form kiest en expliciet opslaat
Then schrijft People Atlas één canonical vault wikilink naar die afbeelding
And verplaatst, dupliceert of wijzigt het de afbeelding niet.

### Keep shared facts central

Given Alice en Bob een relatie hebben en een contactmoment met beide personen
When de gebruiker die entiteiten creëert
Then staan de notities centraal in `Relationships` respectievelijk
`Contact moments`
And geen dossier bevat een duplicaat of arbitraire eigenaar van die entiteit.

## Acceptance criteria for the future executable ticket

- [ ] Eén gedeelde pure path-module leidt alle drie collectiepaths en de
      persoonsdossierbestemming af; create-form, mutationservice en UI
      dupliceren geen pathregels.
- [ ] De settings hebben exact één veilige People-root-instelling; losse
      person- en contactmoment-folderinstellingen bestaan niet meer.
- [ ] Nieuwe personen krijgen na één expliciete Save precies één dossier plus
      één canonieke profielnotitie; Cancel/fout/botsing laat geen map of note
      achter.
- [ ] Profielrename blijft in het bestaande dossier; `person_id` blijft
      onveranderd.
- [ ] Nieuwe relaties en contactmomenten gebruiken uitsluitend de afgeleide
      centrale folderpaden.
- [ ] De photo picker en submitvalidatie accepteren voor de nieuwe architectuur
      alleen ondersteunde assets binnen het dossier, met bestaande stale-,
      missing- en explicit-Save-veiligheid.
- [ ] Vrije dossiernotities worden niet als People Atlas-personen behandeld en
      worden niet door pluginmutaties gewijzigd.
- [ ] Gerichte pure, mutation-, browser- en gecontroleerde integratietests
      bewijzen happy paths, path/ID-botsingen, cancel/failure, rename,
      path-localiteit, stale fotoselectie en centrale multi-person-entiteiten.
- [ ] `npm run check`, `npm run build`, `npm run verify:reproducible` en
      `git diff --check` slagen onder Node 24.

## Non-goals

- Meerdere vaults of cross-vault links.
- Migratie, automatische verhuizing, hernoeming of opschoning van bestaande
  notes, folders, assets, links of pluginsettings.
- Een asset manager, upload, download, kopie, move, crop, face detection of
  automatische fotozoeker.
- Dossierpermissies, delen, encryptie, sync, CRM-automatisering of nieuwe
  contactmoment-/relatiesemantiek.
- Dossiermappen voor relaties of contactmomenten, dupliceren van een relatie
  bij beide personen, of een nieuwe relationele datastore.
- Live Obsidian Desktop/Mobile-certificering zonder een afzonderlijke
  handmatige validatieslice.

## Ratified storage decisions

- User-ratified 2026-08-03: de dossiermap is leesbaar, stabiel en
  collision-safe: `<naam-slug>--<korte-stabiele-id>`, bijvoorbeeld
  `alice-jansen--a1b2c3d4`. De korte suffix is exact de eerste acht
  lower-case hextekens van de willekeurige UUID die de nieuwe expliciete
  `person_id` voedt. De map verandert nooit automatisch mee met de
  profielnaam.
- User-ratified 2026-08-03: een eerste foto is een bewuste tweede stap. Eerst
  creëert de gebruiker het dossier en de profielnotitie; daarna plaatst hij
  zelf een afbeelding in dat dossier en kiest hij die via Edit. People Atlas
  kopieert of verplaatst nooit een asset.
- User-ratified 2026-08-03: deze keuzes supersederen voor deze brekende
  fresh-vault-architectuur de eerdere settings- en migratiebeperkingen die in
  deze spec onder `Settings and break boundary` zijn genoemd.

## Delivery plan

1. `.10x/tickets/2026-08-03-person-dossier-layout.md` levert de centrale
   path- en dossierinvariant.
2. `.10x/tickets/2026-08-03-dossier-local-photo-picker.md` volgt daarna en
   beperkt de fotokiezer tot het bestaande dossier.

## References

- `.10x/research/2026-08-03-person-dossier-storage-discovery.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/specs/settings-information-architecture.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/index/person-index.ts`
- `src/editor/{person-form,person-modal,relationship-form}.ts`
- `src/mutations/atlas-mutation-service.ts`
- `src/domain/person-photo.ts`
