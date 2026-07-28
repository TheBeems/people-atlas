# People Atlas

People Atlas is een opzet voor een moderne Obsidian 1.13+-plugin waarmee personen, relaties en onopgeloste contacten in een vault in kaart worden gebracht.

De basis bevat al een zelfstandige view, een Bases-view, declaratieve instellingen, een incrementele index, stabiele personen-ID's, expliciete relatienotities, wikilink-resolutie, canvasweergave, diagnostiek, `@`-suggesties voor personen en tests.

## Starten

```bash
npm ci
npm run dev
```

Plaats of symlink de map in:

```text
<Vault>/.obsidian/plugins/people-atlas
```

Herlaad Obsidian en schakel **People Atlas** in bij Community plugins.

De voorbeeldnotities staan onder `examples/`.

Nieuwe personen kunnen via de expliciete `@`-optie worden aangemaakt in de ingestelde standaardmap, standaard `People/`. Alleen typen maakt geen note aan.

## Releasegereedheid

`npm run check` voert de offline formatterings-, lint-, type-, test-, productiebuild-, metadata- en bundelgroottecontroles uit. `npm run dependency:audit` is een aparte netwerkcontrole die faalt bij npm-bevindingen met niveau high of critical. `npm run verify:reproducible` bouwt twee schone productiebundels en vereist gelijke SHA-256-digests.

De releasetag moet zonder `v`-prefix exact gelijk zijn aan `manifest.json.version`, bijvoorbeeld `0.1.0`. Na alle geslaagde controles is de tagworkflow ingesteld om uitsluitend `main.js`, `manifest.json` en `styles.css` te attesteren en als releasebestanden toe te voegen.

Dit bewijst alleen lokale en CI-gereedheid. De opdrachten maken of pushen geen tag, publiceren geen GitHub-release, dienen People Atlas niet in bij de Obsidian Community-directory en vormen geen goedkeuring door Obsidian.
