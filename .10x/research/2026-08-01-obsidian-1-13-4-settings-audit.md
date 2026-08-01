Status: done
Created: 2026-08-01
Updated: 2026-08-01

# Obsidian 1.13.4 Settings-integrationaudit

## Question

Welke Obsidian 1.13.4-wijzigingen zijn voor People Atlas relevant, welke
worden al benut, en welke kleinste compatibiliteits- en UX-verbeteringen
verdienen prioriteit?

## Sources and Methods

Dit was een read-only audit; er is tijdens het onderzoek geen productcode,
pluginmanifest, afhankelijkheid, test, build, vaultinhoud of externe
applicatiestatus gewijzigd.

Bronnen onderzocht op 2026-08-01:

- officiële Obsidian Desktop 1.13.4-release notes:
  https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/;
- officiële Obsidian Mobile 1.13.4-release notes:
  https://obsidian.md/changelog/2026-07-30-mobile-v1.13.4/;
- officiële Settings-documentatie:
  https://docs.obsidian.md/Plugins/User+interface/Settings;
- officiële migratiegids voor declaratieve settings:
  https://docs.obsidian.md/plugins/guides/migrate-declarative-settings;
- de lokaal geïnstalleerde Obsidian-typedeclaraties in
  `node_modules/obsidian/obsidian.d.ts`;
- `manifest.json`, `src/main.ts`, `src/settings/settings-tab.ts`,
  `src/settings/types.ts`, `src/bases/options.ts`,
  `src/bases/people-atlas-bases-view.ts`,
  `src/editor/person-mention-suggest.ts`,
  `src/person-photo-resource.ts` en `styles.css`;
- `test/settings-tab.test.ts`, gerelateerde view-/Bases-tests en de actieve
  `.10x/`-specificaties en testkennis.

De audit verifieerde statisch de bron en de gemodelleerde testomgeving. Zij is
geen bewijs van een live Obsidian Desktop-, Mobile-, Electron-pop-out- of
assistive-technology-run op 1.13.4.

## Findings

### Reeds gebruikte 1.13-interfaces

1. People Atlas vereist `minAppVersion: "1.13.0"` en gebruikt de declaratieve
   `PluginSettingTab`-interface via `getSettingDefinitions()`.
2. People Atlas registreert een custom `BasesView`; host-fixes rond Bases
   lifecycle zijn daardoor indirect relevant, zonder dat een pluginwijziging
   nodig is.
3. People Atlas gebruikt `EditorSuggest`, vault-resources en
   Obsidian-CSS-variabelen; de 1.13.4 hostverbeteringen voor suggesties,
   kleurmodellen en mobiel zijn compatibel met die bestaande grenzen.

### P1a — Promise voor declaratieve settings-persistentie

`PeopleAtlasSettingTab.setControlValue()` roept de async
`PeopleAtlasPlugin.updateSetting()` aan met een weggedrukte Promise. De
publieke API sinds 1.13.0 staat `void | Promise<void>` toe. `updateSetting()`
serializeert, valideert, bewaart, herstelt bij een schrijffout, bouwt de index
opnieuw op en ververst bestaande atlas-views. Het teruggeven/afwachten van die
levenscyclus is de kleinste consistente integratie met de declaratieve
Settings-API.

### P1b — Native bevestiging voor templateverwijdering

Bij het verwijderen van een relationship template met gekoppelde
relationship-notities gebruikt `deletePreset()` een browser-native
`window.confirm()`. `ConfirmationModal` is een openbare Obsidian-API sinds
1.13.0, met cancel- en focussemantiek. De bestaande copied-value-semantiek
moet behouden blijven: gekoppelde notities houden hun types en rollen; alleen
de templateprovenance is daarna niet meer beschikbaar.

### P1c — Informatiearchitectuur voor de Settings-tab

De tab bevat meer dan veertig configureerbare gebruikerswaarden, naast de
interne `schemaVersion` en `viewStates`. Hij levert momenteel één platte
array. De officiële API ondersteunt groepen, mutable lijsten en navigeerbare
subpagina's; de documentatie adviseert subpagina's alleen voor lange of
zelfstandige secties en eist unieke siblingnamen. De huidige relationship-
template-lijst moet haar bestaande reorder-, delete-, read-only- en
copied-value-gedrag houden.

## Conclusions

1. Er is geen compatibiliteitsblokkade en geen reden om `minAppVersion` boven
   1.13.0 te verhogen.
2. P1a en P1b zijn mechanisch en semantisch begrensd door huidige code,
   openbare API's en bestaande templatecontracts. Zij kunnen elk na expliciete
   implementatie-autorisatie via een actief ticket worden uitgevoerd.
3. P1c is waardevol, maar de precieze indeling van root, groepen en pagina's
   is zichtbare productsemantiek. De voorgestelde indeling wordt daarom als
   draft vastgelegd en het bijbehorende ticket blijft geblokkeerd tot de
   gebruiker de navigatie contractueel bevestigt of corrigeert.

## Limits

- De release notes en typedeclaraties bewijzen geen live hostgedrag.
- Een geslaagde gemodelleerde test bewijst geen daadwerkelijke Obsidian
  Settings-zoekindex, Mobile-layout, Bases UI of Electron-pop-outgedrag.
- Deze audit autoriseert geen codewijziging, commit, push, release of
  publicatie.

## References

- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/specs/settings-information-architecture.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/controlled-obsidian-integration-harness.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `AGENTS.md`
