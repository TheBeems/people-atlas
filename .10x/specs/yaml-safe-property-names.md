Status: active
Created: 2026-08-10
Updated: 2026-08-11

> **Narrow supersession — 2026-08-10.** Clause 3 of
> `.10x/specs/contact-moments-follow-up.md` is superseded only for de lexicale
> grammar van geconfigureerde contactmoment-property-namen. De bestaande
> eis van niet-lege, onderling verschillende property-namen en de veilige
> contactmomentfolder blijven actief. Deze spec voegt dezelfde lexicale
> veiligheidsgrens toe aan de geconfigureerde property-namen van persoons- en
> relatienotities. Alle overige clauses van
> `.10x/specs/contact-moments-follow-up.md`,
> `.10x/specs/person-profile-experience.md` en
> `.10x/specs/safe-mutations-and-versioned-data.md` blijven volledig actief.

# YAML-veilige configureerbare property-namen

## Doel en scope

People Atlas configureert frontmatter-property-namen, maar nieuwe persoons-,
relatie- en contactmomentnotities interpoleren die namen rechtstreeks als
ongequote YAML-keys. Deze spec maakt de instellingstrust-boundary voldoende
conservatief voor die bestaande serialisatie, zonder een nieuwe YAML-writer of
migratie te introduceren.

Deze spec bestuurt:

- de lexicale validatie van iedere configureerbare property-naam die door
  `personFrontmatter`, `relationshipFrontmatter` of
  `contactMomentFrontmatter` als YAML-key kan worden uitgegeven;
- validatie bij zowel opgeslagen-settings-load als interactieve
  settingswijziging;
- foutgedrag vóór iedere vault- of settingswrite;
- roundtripbewijs dat iedere toegestane ingestelde key na YAML-generatie exact
  als dezelfde key wordt geparseerd.

De scope omvat alle volgende settings; de gedeelde `typeProperty` staat in alle
 drie de notities:

| Notitietype | Property-name settings |
| --- | --- |
| Persoon | `typeProperty`, `personIdProperty`, `nameProperty`, `aliasesProperty`, `organisationsProperty`, `photoProperty`, `contactsProperty`, `birthDateProperty`, `pronounsProperty`, `genderProperty`, `emailsProperty`, `phonesProperty`, `jobTitleProperty` |
| Relatie | `typeProperty`, `relationshipIdProperty`, `relationshipFromProperty`, `relationshipToProperty`, `relationshipTypesProperty`, `relationshipPresetProperty`, `relationshipFromRoleProperty`, `relationshipToRoleProperty`, `closenessProperty`, `sinceProperty`, `lastContactProperty`, `statusProperty` |
| Contactmoment | `typeProperty`, `contactMomentIdProperty`, `contactMomentPeopleProperty`, `contactMomentRelationshipProperty`, `contactMomentOccurredOnProperty`, `contactMomentChannelProperty`, `contactMomentSummaryProperty`, `contactMomentFollowUpOnProperty`, `contactMomentFollowUpStatusProperty` |

`photoProperty` blijft onderdeel van de lexicale settings-scope en van bestaande persoons-frontmatter edits. De bestaande create-boundary blijft echter leidend: `createPerson` weigert een niet-lege foto en `personFrontmatter` emitteert daarom bewust geen foto-key bij een nieuwe persoonsnotitie. "Alle optionele persoonsvelden" in de roundtripacceptatie betekent daarmee alle velden die de create-serializer volgens het bestaande contract kan emitten; de foto-create-afwijzing en aparte editgrens blijven expliciet getest.

`personTag`, typewaarden, foldernamen, IDs en
`relationshipRoleFormat` zijn geen YAML-property-name settings in deze spec en
krijgen hierdoor geen nieuwe property-name grammar.

## Normatieve contracten

1. Na de bestaande settings-normalisatie moet iedere property-name setting uit
   de bovenstaande tabel voldoen aan deze grammar:

   ```text
   ^[\p{L}_][\p{L}\p{Nd}_-]*$
   ```

   De reguliere expressie wordt met Unicode-ondersteuning geëvalueerd
   (`u`-semantiek). `\p{L}` betekent een Unicode-letter en `\p{Nd}` een
   Unicode-decimaal cijfer.
2. De eerste code point MUST een Unicode-letter of `_` zijn. Daarna zijn alleen
   Unicode-letters, Unicode-decimale cijfers, `_` en `-` toegestaan. Er is geen
   aanvullende maximumlengte in deze spec.
3. Whitespace, YAML-significante leestekens en indicatoren, control characters,
   een leading cijfer, een leading `-`, en alle andere tekens buiten de grammar
   MUST worden afgewezen. Voorbeelden van af te wijzen keys zijn `bad:key`,
   `name#comment`, `{nested}`, `[list]`, `-name`, `9lives` en `name value`.
4. De validator MUST dezelfde grammar toepassen op:
   - iedere interactieve wijziging vóór `saveData()`;
   - iedere load van opgeslagen pluginsettings vóór `writeEnabled` true wordt;
   - iedere bestaande persoons-, relatie- en contactmoment-distinctnesscheck.

   Een relatie-property-naam mag niet alleen door UI-validatie worden beschermd;
   opgeslagen of programmatisch aangeleverde settings moeten dezelfde
   fail-closed grens passeren.
5. Een ongeldige property-name setting MUST de bestaande veilige
   settingssemantiek behouden: de setting wordt niet persistenteerd, een
   interactieve wijziging geeft geen vault- of settingswrite, en een ongeldige
   opgeslagen settingssnapshot activeert geen writes. Er vindt geen stille
   vervanging, quoting-workaround, property-rename of vaultmigratie plaats.
6. De bestaande distinctnessregels blijven onveranderd: persoons-owned
   properties blijven onderling uniek en contactmoment-owned properties blijven
   onderling uniek. Deze spec introduceert geen nieuwe cross-domain
   collisionsemantiek.
7. Nieuwe-notitiegeneratie MUST voor alle drie de notitietypen dezelfde
   toegestane settings kunnen gebruiken. De serializers mogen de bestaande
   ongequote YAML-keyvorm behouden; de grammar is de noodzakelijke
   inputveiligheidsgrens. Een serializer mag geen onveilige key produceren
   wanneer settings via de ondersteunde load/update-boundary zijn verkregen.
8. Er moet voor persoon, relatie en contactmoment een roundtriptest bestaan die:
   - alle relevante property-name settings op unieke, toegestane Unicode-keys
     instelt (voor persoon betekent relevant: alle keys die de bestaande
     create-serializer kan emitten; `photoProperty` blijft lexical en wordt via
     de bestaande aparte editgrens beschermd);
   - een nieuwe notitie met alle door de create-serializer ondersteunde
     optionele velden ingevuld laat genereren;
   - de volledige gegenereerde frontmatter opnieuw parseert met een
     production-compatible YAML-parser/testharness;
   - controleert dat iedere verwachte ingestelde key exact terugkomt, zonder
     splitsing, nesting, truncatie of key-herinterpretatie;
   - controleert dat de waarde onder iedere key bij het bedoelde veld blijft.
9. De roundtriptests mogen de bestaande waarden-, identity-, body- en
   unrelated-frontmattercontracten niet versoepelen. Ze bewijzen key safety en
   YAML-parseerbaarheid; ze bewijzen niet live Obsidian Desktop/Mobile-hostgedrag.

## Given/When/Then-scenario's

### Unicode-key wordt geaccepteerd

Given een property-name setting `naïve_关系-2`

When de settingsvalidator en settingsloader deze waarde beoordelen

Then wordt de waarde geaccepteerd, blijft zij exact als persisted key behouden
en blijft de plugin write-enabled zolang alle bestaande distinctness- en
settingsregels ook slagen.

### YAML-significante key wordt vóór schrijven geweigerd

Given `relationshipIdProperty` is ingesteld op `relationship:id`

When de gebruiker de instelling opslaat of de plugin deze settings laadt

Then faalt de property-namevalidatie vóór `saveData()` of vaultmutatie, meldt de
plugin welke setting en grammarregel faalt, en wordt geen nieuwe notitie
gegenereerd.

### Leading indicator wordt geweigerd

Given een property-naam begint met `-`, `?`, `:` of een cijfer

When de property-namevalidator draait

Then wordt de waarde afgewezen, ook als de rest van de naam alleen toegestane
letters, cijfers, `_` of `-` bevat.

### Persoonsnotitie roundtript

Given alle persoons-property settings hebben unieke toegestane Unicode-keys en
alle optionele persoonsvelden zijn gevuld

When People Atlas een nieuwe persoonsnotitie genereert en de frontmatter opnieuw
parseert

Then komen alle ingestelde persoonskeys exact één keer terug met hun bedoelde
waarden.

### Relatie- en contactmomentnotities roundtrippen

Given alle relatie- en contactmoment-property settings hebben unieke toegestane
Unicode-keys en alle optionele velden zijn gevuld

When People Atlas beide nieuwe notities genereert en de frontmatter opnieuw
parseert

Then komen alle ingestelde keys exact terug als platte YAML-properties en blijven
waarden aan hun oorspronkelijke settings gekoppeld.

## Foutgedrag en grenzen

- Een foutmelding mag de bestaande taal-/domeinpresentatie gebruiken, maar moet
  de betrokken setting en de property-namebeperking voldoende benoemen voor
  herstel.
- Deze spec schrijft bestaande opgeslagen vaultnotes niet om en valideert of
  normaliseert geen door de gebruiker beheerde willekeurige frontmatterkeys die
  niet via People Atlas-settings worden beheerd.
- Een YAML-parser die alleen ASCII-keys in een teststub ondersteunt is geen
  voldoende roundtripbewijs voor de user-ratified Unicode-grammar; de stub moet
  worden uitgebreid of de test moet een bestaande production-compatible parser
  gebruiken.

## Acceptatiecriteria

- [x] Alle configureerbare YAML-property-name settings uit de scope gebruiken
      één gedeelde Unicode grammar met letter/underscore als eerste teken.
- [x] De grammar wordt fail-closed toegepast bij settings-load én interactieve
      settingswijziging; ook relatie-property settings kunnen niet buiten de
      grens vallen.
- [x] Lege, whitespace-bevattende, leading-indicator-, YAML-significante en
      overige niet-grammaticale keys worden vóór een write geweigerd.
- [x] Toegestane Unicode-letters, Unicode-decimale cijfers, `_` en `-` worden
      zonder onbedoelde ASCII-beperking geaccepteerd.
- [x] Bestaande distinctness-, settings-write-, vault-write- en
      fresh-vault/no-migratiesemantiek blijft behouden.
- [x] Persoons-, relatie- en contactmomentfrontmatter heeft een
      assertion-grade YAML-roundtriptest met exacte key- en waardebehoud.
- [x] De tests behouden expliciete grenzen rond testparser-, live Obsidian
      Desktop/Mobile- en bestaande-vaultvalidatie.

## Ratified decisions

1. **User-ratified 2026-08-10:** de scope omvat alle configureerbare
   YAML-property-namen voor persoons-, relatie- en contactmomentnotities, niet
   alleen contactmomenten.
2. **User-ratified 2026-08-10:** property-namen gebruiken Unicode-letters,
   Unicode-decimale cijfers, underscores en koppeltekens; de eerste positie is
   een Unicode-letter of underscore; er is geen maximumlengte.
3. **Record-backed:** bestaande non-empty/distinct-, settings-loader-,
   no-write-before-validation- en fresh-vaultregels blijven leidend buiten de
   expliciete lexical-hardening hierboven.

## Current implementation boundary — 2026-08-11

De source-backed observaties in de aannames hierboven beschrijven de pre-
implementatiestatus van 2026-08-10 en zijn niet langer actuele bronclaims. De
huidige implementatie gebruikt één gedeelde Unicode-validator bij stored load,
interactieve update en mutation write boundaries. De mutation boundary retourneert
bovendien een immutable settings-snapshot; native Obsidian Desktop/Mobile,
live-parsergedrag en bestaande-vaultvalidatie blijven buiten deze spec bewezen
limieten.

## References

- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `src/settings/validate.ts`
- `src/settings/load.ts`
- `src/settings/settings-tab.ts`
- `src/mutations/validation.ts`
- `src/mutations/atlas-mutation-service.ts`
- `test/settings-load.test.ts`
- `test/settings-tab.test.ts`
- `test/contact-moment-mutation.test.ts`
- `test/mutation-service.test.ts`
- `test/obsidian-stub.ts`
