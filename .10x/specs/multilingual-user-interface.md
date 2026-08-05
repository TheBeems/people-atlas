Status: active
Created: 2026-08-04
Updated: 2026-08-04

# Meertalige gebruikersinterface

## Doel

Maak People Atlas meertalig zonder identiteiten, vaultinhoud, frontmatter of
domeinsemantiek te lokaliseren. De plugin volgt standaard de ingestelde
Obsidian-taal en levert eerst Nederlands en Engels.

## Vastgestelde context

De huidige bron heeft geen i18n-/translationlaag. Vaste Engelstalige UI-teksten
staan onder meer in `src/main.ts`, `src/settings/`, modals, views en renderers.
De publieke Obsidian-API biedt `getLanguage(): string` sinds 1.8.7; de huidige
`minAppVersion` is 1.13.0, dus deze hostroute is beschikbaar zonder een
compatibiliteitsverhoging.

## Contract

1. De initiële interface-locale MUST uit Obsidian's publieke `getLanguage()`
   komen. Ondersteun minimaal `nl` en `en`; onbekende, ontbrekende of nog niet
   vertaalde locales vallen deterministisch terug op `en`.
2. De dagelijkse Settings-tab blijft exact vier items tonen. Er komt in deze
   fase geen zichtbare Language-setting, geen tweede settingsopslag en geen
   handmatige locale-override.
3. Vertalingen MUST in een getypeerde, gebundelde interne catalogus staan. De
   Engelse catalogus definieert de complete message-/parametercontracten; iedere
   andere catalogus moet elke key en parameterafspraak compilerbaar invullen.
4. Vertaalbare UI omvat commands, ribbon tooltips, Settings-labels en
   descriptions, buttons, modaltitels, lege staten, Notices, toegankelijke
   labels/instructies en gebruikersgerichte diagnostics.
5. `person_id`, relationship-ID's, frontmatterkeys/-waarden, bestandsnamen,
   paden, user-authored namen/aliassen, template-namen en vrije relationship-
   waarden MUST onveranderd blijven. Alleen vaste presentatie-labels kunnen
   worden vertaald; zij gebruiken dezelfde persistente machinewaarde.
6. Pure domein-/graphcode MUST geen Obsidian- of i18n-import krijgen. Als een
   domeinprobleem aan de gebruiker wordt getoond, levert de pure laag een
   stabiele code met parameters; de UI-grens bepaalt de locale en eindtekst.
7. Gebruik voor pluralisatie, datum- en nummerpresentatie locale-bewuste
   ingebouwde `Intl`-primitieven of getypeerde messagefuncties. Vermijd
   stringconcatenatie voor telbare of geïnterpoleerde teksten.
8. Locale-resolutie, catalogusimport en renderen mogen geen vaultscan,
   indexrebuild, plugindatawrite, vaultwrite of viewstatewrite veroorzaken.

## Gefaseerde oplevering

1. **Fundament en primaire UI:** locale-resolver, getypeerde `en`/`nl`
   catalogi, commandpalette/ribbon, Settings en gedeelde Notices.
2. **Interactie en toegankelijkheid:** person/relationship/contactmoment-modals,
   graph-, Bases- en Reading View-actions, lege toestanden, ARIA-labels en
   keyboard-instructies.
3. **Diagnostics en formattering:** gestandaardiseerde diagnostic-/validation-
   codes aan de pure grens, vertaalde foutpresentatie en locale-bewuste
   pluralisatie/datum-/nummerweergave.

Elke fase is een afzonderlijk dependency-ticket. Fase 1 levert een bruikbare
architectuur en Nederlands/Engels zichtbaar op; zij claimt niet dat alle
historische UI-teksten dan al vertaald zijn.

## Acceptatiecriteria

- [ ] Obsidian `nl` en `en` kiezen deterministisch de juiste catalogus; een
      onbekende locale valt terug op Engels.
- [ ] Typecheck bewaakt key- en parameterpariteit van alle catalogi.
- [ ] De fase-1 UI toont vertaalde commands, ribbon-tooltip, Settings en
      gedeelde Notices, terwijl de vier-item Settings-inventory intact blijft.
- [ ] Een localewissel verandert geen pluginsettings, IDs, paden, frontmatter,
      templates of andere user-authored vaultdata.
- [ ] Pure graph-/domeinmodules blijven vrij van Obsidian- en i18n-imports.
- [ ] Elke vervolgfase draagt de bereikbare UI-teksten, accessibility en
      diagnostic-codes gericht over met regressietests.
- [ ] Na de relevante ticketreview zijn de actuele Node-24-gate en build groen;
      live Desktop/Mobile-taalgedrag blijft eerlijk apart gevalideerd.

## Uitgesloten

- Automatische vertaling of mutatie van vaultnotities, bestandsnamen,
  frontmatterwaarden, template-namen of door gebruikers gekozen relatie-types.
- Een externe i18n-dependency, remote vertaaldienst, telemetry of taalmodel.
- Een Language-setting, hot locale switching tijdens dezelfde pluginlifecycle,
  of lokalisatie van plugin-store/community-metadata in deze fase.
- Wijziging van identiteit, parser, graphcontract, opslagformaat of
  `minAppVersion`.

## Referenties

- `AGENTS.md`
- `manifest.json`
- `src/main.ts`
- `src/settings/settings-tab.ts`
- `src/editor/`
- `src/view/`
- `src/render/`
- `node_modules/obsidian/obsidian.d.ts` (`getLanguage`)
- `.10x/specs/my-person-note-picker.md`

## Besluitgrond

Hostlocale via de publieke API voorkomt een extra dagelijkse instelling.
Getypeerde lokale catalogi zonder dependency houden de eerste twee talen klein,
compileerbaar en offline. Een strikte scheiding tussen vaste UI-tekst en
persistente/user-authored data voorkomt dat vertaling identiteit of vaultdata
verandert.