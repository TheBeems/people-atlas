# People Atlas

[English](README.md)

People Atlas brengt personen, expliciete relaties en onopgeloste persoonslinks uit Markdown-notities in je vault in kaart. De zelfstandige interactieve atlas en de aangepaste Bases-view gebruiken dezelfde geïndexeerde graaf.

> [!IMPORTANT]
> People Atlas vereist Obsidian 1.13.0 of nieuwer. Obsidian 1.12.x en ouder worden niet ondersteund.

## Functies

- Stabiele persoonsidentiteit via een verplichte expliciete `person_id`.
- Afzonderlijke richtingvrije relatienotities met ID, eindpuntrollen, typen, nabijheid, datums en status.
- Resolutie van gekoppelde personen via wikilinks, zonder personen op weergavenaam te vergelijken.
- Een incrementele vaultindex die alleen gewijzigde bestanden opnieuw verwerkt.
- Een zelfstandige graafweergave en aangepaste Bases-view op hetzelfde graafmodel.
- Deterministische layout, pan, zoom, slepen, touchgebaren en een toetsenbordtoegankelijke lijstweergave.
- Gecureerde aanmaak en bewerking van personen, met namen, aliassen, organisaties, foto's, optionele
  profielgegevens en gevalideerde gekoppelde personen.
- Vault-eigen fotoselectie en profielafbeeldingen, plus begrensde graafavatars
  met een deterministische initialenfallback.
- Een duidelijk onderscheid tussen contactgegevens (e-mailadressen en telefoonnummers), eenvoudige
  **Linked people** en relaties als zelfstandige notities, zonder betekenis te raden.
- Expliciete, gevalideerde aanmaak en bewerking van relaties.
- Afzonderlijke contactmomentnotities met één gedeelde Log/Edit-flow,
  optionele follow-upmetadata en expliciete, standaard uitgeschakelde,
  monotone bijwerking van `last_contact`, plus recente momenten per persoon
  en een expliciete Follow-ups-view.
- `@`-suggesties die wikilinks invoegen en alleen na een expliciete keuze een persoonsnotitie aanmaken.
- Diagnostiek voor dubbele ID's, onopgeloste wikilinks en kapotte relatie-eindpunten.

## Compatibiliteit

- Vereist Obsidian 1.13.0 of nieuwer.
- Declareert desktop- en mobiele compatibiliteit met `isDesktopOnly: false`.
- De productiecode gebruikt geen Node.js- of Electron-API's.
- Gebruikt de declaratieve instellingen en aangepaste Bases-API's uit Obsidian 1.13.

Obsidian 1.13 is publiek beschikbaar. People Atlas aanmelden bij Community Plugins blijft een afzonderlijke publicatiestap.

## Installatie

### Community Plugins

Nadat People Atlas is opgenomen:

1. Open **Instellingen → Community plugins**.
2. Kies **Browse** en zoek naar **People Atlas**.
3. Kies **Install** en daarna **Enable**.

### Handmatige installatie

1. Download `main.js`, `manifest.json` en `styles.css` uit de bijbehorende [GitHub Release](https://github.com/TheBeems/people-atlas/releases).
2. Maak deze map in je vault:

   ```text
   <Vault>/.obsidian/plugins/people-atlas/
   ```

3. Plaats de drie bestanden in die map.
4. Herlaad Obsidian en schakel **People Atlas** in bij Community plugins.

## Gebruik

1. Controleer onder **Instellingen → People Atlas** de People-map en propertynamen. De standaardmap is `People/`. Selecteer eventueel **My person** via een stabiele `person_id`; dit perspectief staat los van het huidige middelpunt van de graaf.
2. Voeg `type: person` en een stabiele `person_id` toe aan persoonsnotities, of pas de instellingen aan je bestaande schema aan.
3. Voer **People Atlas: Open atlas** uit via het opdrachtenpalet.
4. Gebruik **People Atlas: Create person**, of voer **Edit current person** uit terwijl een persoonsnotitie actief is. Een geselecteerde, opgeloste persoon kan ook vanuit beide atlasviews worden bewerkt.
5. Maak een relatie via **People Atlas: Create relationship**, of selecteer een persoon in een atlas en kies **Create relationship**.
6. Gebruik **People Atlas: Edit current relationship** terwijl een relatienotitie actief is om ondersteunde metadata te wijzigen.
7. Gebruik **People Atlas: Log contact** globaal of vanuit een geselecteerde
   canonieke persoon. Gebruik **Edit current contact moment** terwijl een
   contactmomentnotitie actief is.
8. Gebruik **People Atlas: Open follow-ups** om Overdue, Due today en Upcoming
   werk te bekijken en een follow-up expliciet als done of dismissed te
   markeren.

Relatienotities komen standaard in `People/Relationships/<Eerste persoon> - <Tweede persoon>.md`. Het voorgestelde pad blijft controleerbaar en bestaande notities worden nooit overschreven.

Typen van `@` opent persoonsuggesties. Een bestaande persoon kiezen voegt een stabiele wikilink in. Alleen de expliciete aanmaakoptie maakt een nieuwe persoonsnotitie.

De person-editor groepeert ondersteunde velden onder **Basic**, **Profile**,
**Contact details**, **Linked people** en **Advanced**, en bewaart overige
frontmatter. `birth_date` accepteert een volledige waarde `YYYY-MM-DD` of
`--MM-DD` wanneer het jaar onbekend is. Ongeldige bestaande geboortedatums en
e-maillijsten blijven zichtbaar voor expliciet herstel en worden niet stil
herschreven wanneer een ander veld wordt opgeslagen. Een gewijzigde naam stelt
in dezelfde map een nieuwe bestandsnaam voor en vereist een afzonderlijke
bevestiging. Obsidian werkt links bij volgens de vaultinstelling voor
automatische linkupdates. Obsidians eigen menu **Eigenschap toevoegen** blijft
vaultbreed en kan daarom nog relatieproperties tonen.

## Gegevensmodel

Voorbeeldpersoon:

```yaml
---
type: person
person_id: alice-example
name: Alice Example
aliases:
  - Alice
organisations:
  - Example Foundation
birth_date: "--07-30"
pronouns: zij/haar
gender: woman
job_title: Engineering lead
emails:
  - alice@example.com
phones:
  - "+31 6 12 34 56 78"
contacts:
  - "[[Bob Example]]"
photo: "[[Attachments/alice.jpg]]"
---
```

`emails` en `phones` zijn contactgegevens. De ingestelde property `contacts`
bevat eenvoudige koppelingen die als **Linked people** worden getoond. Rollen,
datums, status en andere rijke metadata horen in afzonderlijke
relatienotities.

Relaties zijn zelfstandige Markdown-notities. `from` en `to` zijn stabiele
posities voor respectievelijk de eerste en tweede persoon en hun bijbehorende
`from_role` en `to_role`; ze stellen geen pijl, hiërarchie of looprichting
voor. Definieer beide rollen of geen van beide. Met twee rollen gebruikt People
Atlas de configureerbare rolzin; zonder compleet rollenpaar toont de plugin
neutraal `Connected to <persoon>`.

Een relationship template is invoergemak, geen live koppeling. Toepassen
kopieert typen, de rol van de eerste persoon en de rol van de tweede persoon
naar de relatienotitie. De gekopieerde waarden blijven intact als de template
later wordt gewijzigd of verwijderd. De expliciete actie **Update linked
relationships from template** toont eerst de exacte notitiepaden voordat
bijgewerkte templatewaarden worden gekopieerd.

In de sectie Relationship staat ook de optionele snelkeuze
**Simple relationship**. **Parent**, **Child** en **Sibling** vullen uitsluitend
de twee nog niet opgeslagen rollen als `parent`/`child`, `child`/`parent` of
`sibling`/`sibling`. **Custom** laat templates en handmatige roltekst ongemoeid.
Alleen **Save** schrijft deze neutrale rollen naar de relatienotitie.

Bij precies deze canonieke rollen mag de weergave het eigen vrijetekstveld
`gender` van de rolhouder gebruiken. `woman` toont mother, daughter of sister;
`man` toont father, son of brother. Hoofdletters en omliggende spaties tellen
niet mee. Bij een ontbrekende of andere waarde blijft de term neutraal:
parent, child of sibling. Letterlijke en aangepaste rollen veranderen niet.
People Atlas leidt nooit een relatie af uit gender, namen, gedeelde ouders of
de graaf. Ook siblings vereisen dus een eigen, expliciete relatienotitie.

Als **My person** eenduidig beschikbaar is, staat die persoon bij een nieuwe
relatie normaal als eerste, waardoor de eerste-persoonsrol van een template
doorgaans **My role** wordt. Beide personen blijven bewerkbaar en dezelfde
templates werken ook voor relaties tussen twee andere personen. Rollen blijven
zonder verborgen wissel aan de eerste en tweede persoon gekoppeld. De plugin
bewaart `relationship_preset` alleen als herkomst. Frontmatter die niet van
People Atlas is, wordt genegeerd en niet automatisch verwijderd.

Voorbeeldcontactmoment:

```yaml
---
type: contact_moment
contact_moment_id: contact-20260730-alice
people:
  - "[[Alice Example]]"
relationship: "[[Relationships/Alice and Bob]]"
occurred_on: 2026-07-30
channel: call
summary: Projectoverdracht besproken
follow_up_on: 2026-08-03
follow_up_status: open
---
```

Contactmomenten blijven zelfstandige notities met een vrije Markdown-body.
Een canonieke relatie koppelen wijzigt die relatie niet vanzelf. De optionele
`last_contact`-checkbox begint uitgeschakeld en verhoogt alleen een oudere
datum; relatiestatus, rollen, typen en templatemetadata blijven ongemoeid.
Een geselecteerde canonieke persoon toont begrensde recente historie en de
eerstvolgende open follow-up. De Follow-ups-view groepeert open werk op lokale
kalenderdatum; done/dismissed-acties wijzigen alleen de ingestelde
statusproperty van dat contactmoment.

Voorbeelden staan onder [`examples/`](examples/).

## Privacy en gegevenstoegang

- People Atlas gebruikt geen netwerktoegang.
- People Atlas verzamelt geen telemetrie of analytics.
- People Atlas vereist geen account of betaling.
- People Atlas opent geen bestanden buiten je vault.
- De plugin leest Markdown-bestanden en gecachete metadata in de vault om de index op te bouwen.
- Persoons-, relatie- en contactmomentnotities worden alleen na een expliciete
  gebruikersactie en validatie aangemaakt of gewijzigd.
- Plugininstellingen en viewstate worden via Obsidian's plugin-data-API opgeslagen.

## Ontwikkeling

Vereisten:

- Node.js 24.
- Obsidian 1.13.0 of nieuwer voor integratietests.

```bash
npm ci
npm run dev
```

Plaats of symlink de repository naar `<Vault>/.obsidian/plugins/people-atlas`, herlaad Obsidian en schakel de plugin in.

Voor een commit:

```bash
npm run dependency:audit
npm run check
npm run verify:reproducible
```

`npm run check` omvat formattering, lint, typen, tests, productiebuild, releasemetadata, bundelgrootte en het Community Plugins-contract. Met `npm run community:check` kan alleen dat laatste contract worden uitgevoerd.

De releasetag moet zonder `v`-prefix exact overeenkomen met `manifest.json.version`. De workflow controleert de remote tag-SHA, herhaalt de buildgates, attesteert de artifacts en publiceert uitsluitend `main.js`, `manifest.json` en `styles.css`.

## Ondersteuning

Meld reproduceerbare bugs en feature requests via [GitHub Issues](https://github.com/TheBeems/people-atlas/issues). Vermeld de People Atlas-versie, Obsidian-versie, het platform en minimale reproductiestappen. Voeg geen privé-inhoud uit je vault toe.
