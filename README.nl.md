# People Atlas

[English](README.md)

People Atlas brengt personen, expliciete relaties en onopgeloste contacten uit Markdown-notities in je vault in kaart. De zelfstandige interactieve atlas en de aangepaste Bases-view gebruiken dezelfde geïndexeerde graaf.

> [!IMPORTANT]
> People Atlas vereist Obsidian 1.13.0 of nieuwer. Obsidian 1.12.x en ouder worden niet ondersteund.

## Functies

- Stabiele persoonsidentiteit via een expliciete `person_id`, met een genormaliseerd bestandspad als fallback.
- Afzonderlijke relatienotities met ID, richting, typen, nabijheid, datums en status.
- Contactresolutie via wikilinks, zonder personen op weergavenaam te vergelijken.
- Een incrementele vaultindex die alleen gewijzigde bestanden opnieuw verwerkt.
- Een zelfstandige graafweergave en aangepaste Bases-view op hetzelfde graafmodel.
- Deterministische layout, pan, zoom, slepen, touchgebaren en een toetsenbordtoegankelijke lijstweergave.
- Expliciete, gevalideerde aanmaak en bewerking van relaties.
- `@`-suggesties die wikilinks invoegen en alleen na een expliciete keuze een persoonsnotitie aanmaken.
- Diagnostiek voor dubbele ID's, onopgeloste wikilinks en kapotte relatie-eindpunten.

## Compatibiliteit

- Vereist Obsidian 1.13.0 of nieuwer.
- Declareert desktop- en mobiele compatibiliteit met `isDesktopOnly: false`.
- De productiecode gebruikt geen Node.js- of Electron-API's.
- Gebruikt de declaratieve instellingen en aangepaste Bases-API's uit Obsidian 1.13.

De eerste aanmelding bij Community Plugins gebeurt pas nadat Obsidian 1.13 publiek beschikbaar is.

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

1. Controleer onder **Instellingen → People Atlas** de People-map en propertynamen. De standaardmap is `People/`.
2. Voeg `type: person` en een stabiele `person_id` toe aan persoonsnotities, of pas de instellingen aan je bestaande schema aan.
3. Voer **People Atlas: Open atlas** uit via het opdrachtenpalet.
4. Maak een relatie via **People Atlas: Create relationship**, of selecteer een persoon in een atlas en kies **Create relationship**.
5. Gebruik **People Atlas: Edit current relationship** terwijl een relatienotitie actief is om ondersteunde metadata te wijzigen.

Relatienotities komen standaard in `People/Relationships/<Persoon A> - <Persoon B>.md`. Het voorgestelde pad blijft controleerbaar en bestaande notities worden nooit overschreven.

Typen van `@` opent persoonsuggesties. Een bestaande persoon kiezen voegt een stabiele wikilink in. Alleen de expliciete aanmaakoptie maakt een nieuwe persoonsnotitie.

Voorbeelden staan onder [`examples/`](examples/).

## Privacy en gegevenstoegang

- People Atlas gebruikt geen netwerktoegang.
- People Atlas verzamelt geen telemetrie of analytics.
- People Atlas vereist geen account of betaling.
- People Atlas opent geen bestanden buiten je vault.
- De plugin leest Markdown-bestanden en gecachete metadata in de vault om de index op te bouwen.
- Persoons- en relatienotities worden alleen na een expliciete gebruikersactie en validatie aangemaakt of gewijzigd.
- Plugininstellingen en viewstate worden via Obsidian's plugin-data-API opgeslagen.

## Ontwikkeling

Vereisten:

- Node.js 22.
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
