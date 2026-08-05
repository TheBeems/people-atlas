Status: active
Created: 2026-08-04
Updated: 2026-08-04

# My person: doorzoekbare notitiekiezer

## Doel

Maak `My person` in de kleine, dagelijkse Settings-tab bruikbaar voor een
persoon die een notitie wil typen, zoeken of selecteren, zonder de stabiele
identiteits- en opslaggrens te verzwakken.

## Nauwe supersessie

Dit contract supersedeert uitsluitend
`.10x/specs/contextual-actions-and-settings-simplification.md`, scopepunt 9,
voor zover dat `My person` als een stabiele-ID-dropdown voorschrijft. De
vervanging is een native, doorzoekbare **notitiekiezer** die uiteindelijk
nog steeds alleen een stabiele `myPersonId` opslaat.

Alle overige grenzen van dat afgeronde contract blijven gelden, in het
bijzonder: precies vier dagelijkse Settings-items, geen zichtbare technische
schema-instellingen, geen migratie, en geen wijziging van
`Default center person ID`-semantiek.

## Contract

1. `My person` MUST een native Obsidian bestandsinvoer met vault-suggesties
   gebruiken. De gebruiker kan daar een notitie typen, zoeken, selecteren of de
   waarde wissen.
2. De suggester MUST alleen actuele, unieke canonieke People Atlas-personen
   toelaten. Een gewone notitie, stale pad, ambigue persoon of dubbele
   `person_id` is nooit een geldige selectie.
3. De gebruikersinvoer is een pad; de persistente waarde blijft uitsluitend
   `PeopleAtlasSettings.myPersonId`. Bij selectie resolveert de UI het actuele
   canonieke record op pad en slaat zij diens stabiele ID op. Er wordt geen
   bestandsnaam of displaynaam als identiteit opgeslagen.
4. Een expliciet leeggemaakte invoer MUST via de normale settings-updategrens
   `myPersonId` wissen, zodat de zichtbare toestand weer `None` is.
5. Een eerder opgeslagen maar niet-resolveerbare ID blijft ongemuteerd en toont
   een duidelijke waarschuwing. De gebruiker kan deze vervangen via een geldige
   selectie of expliciet wissen; renderen zelf schrijft nooit.
6. Als de People Atlas-index publiceert of wijzigt terwijl de Settings-tab open
   is, MUST de picker/status worden ververst. Een lege initiële index mag dus
   niet blijvend alleen `None` tonen nadat er geldige kandidaten beschikbaar
   zijn.
7. Settings openen, typen, zoeken, renderen en index-refreshes MUST geen
   plugin-datawrite, vaultwrite, indexrebuild, vaultscan of viewstatewrite
   veroorzaken. Alleen een expliciete geldige selectie of expliciet wissen mag
   via de bestaande `updateSetting`-grens plugindata opslaan.
8. De beschrijving noemt de actuele keuze menselijk met naam en pad waar die
   veilig resolveert. Bij nul kandidaten legt zij uit dat er nog geen geldige
   persoonsnotities geïndexeerd zijn; zij nodigt niet uit tot handmatige ID-
   invoer.

## Acceptatiecriteria

- [ ] In Obsidian 1.13+ kan de gebruiker vanuit `My person` een canonieke
      persoonsnotitie typen, zoeken en selecteren met de native file-suggester.
- [ ] Een geselecteerd actueel pad wordt exact naar de unieke `person_id`
      vertaald en uitsluitend die ID wordt persistent opgeslagen.
- [ ] Leegmaken wist alleen `myPersonId`; een gewone, stale of ambigue notitie
      wordt zonder write geweigerd.
- [ ] Een unavailable opgeslagen ID blijft zichtbaar als waarschuwing zonder
      automatische correctie of migratie.
- [ ] De open Settings-tab ververst de candidates/status na index-publicatie,
      zonder plugin- of vaultwrite en zonder indexrebuild.
- [ ] De Settings-tab houdt precies People root folder, My person,
      Relationship templates en Show labels als dagelijkse items zichtbaar.
- [ ] Gerichte node-, browser- en gecontroleerde integratietests dekken de
      mapping, negatieve selectie, clear, stale/ambigue waarschuwing en
      index-refresh. De levende Obsidian Desktop/Mobile-hostgrens blijft apart
      gerapporteerd.
- [ ] Na onafhankelijke PASS zijn `npm run test`, `npm run build` en
      `git diff --check` groen onder de gedeclareerde Node-24-runtime.

## Uitgesloten

- Opslag van een bestandspad, displaynaam of alias als `My person`-identiteit.
- Vrije `person_id`-invoer, een willekeurige Markdown-notitie als perspectief-
  anker, of automatische keuze op basis van de actieve notitie/graphnavigatie.
- Een nieuwe settingspagina, wijziging van schema/defaults/loader/validator,
  frontmattermigratie, of aanpassing van `Default center person ID`.
- Een plugin-geïnitieerde vaultscan of indexrebuild bij het openen of gebruiken
  van Settings.

## Referenties

- `AGENTS.md`
- `.10x/specs/contextual-actions-and-settings-simplification.md`
- `src/settings/settings-tab.ts`
- `src/main.ts`
- `src/index/`
- `test/settings-tab.test.ts`
- `test/integration/my-person.integration.test.ts`
- Obsidian 1.13 `SettingFileControl` in `node_modules/obsidian/obsidian.d.ts`

## Besluitgrond

De huidige dropdown voegt `None` toe plus uitsluitend unieke kandidaten uit de
actuele index. Een leeg resultaat verklaart de gemelde `None`-only toestand,
maar een vrij ID-veld zou ontbrekende of ambigue identiteit mogelijk maken.
De publieke Obsidian 1.13 file-control biedt daarentegen een native,
filterbare vault-suggester; een pad-naar-canonieke-ID-adapter behoudt de
bestaande veilige opslagsemantiek.