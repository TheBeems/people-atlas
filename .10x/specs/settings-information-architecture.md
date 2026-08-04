Status: active
Created: 2026-08-01
Updated: 2026-08-04

> **Nauwe supersessie (2026-08-04):**
> `.10x/specs/contextual-actions-and-settings-simplification.md` vervangt alleen
> de eerdere eis dat iedere configureerbare key zichtbaar blijft en de
> bijbehorende schema-/view-pagina-membership. De declaratieve API, unieke
> navigatiestructuur, I/O-vrije definitiefunctie en het behoud van de
> relationship-template-lijst blijven gelden.

# Settings-informatiearchitectuur

## Purpose

Maak de lange declaratieve People Atlas Settings-tab sneller scanbaar zonder
settings te verliezen, opslagsemantiek te veranderen of de globale
Settings-zoekindex te verzwakken.

## Scope

Deze specificatie beheerst alleen de zichtbare groepering en navigatie van de
bestaande declaratieve setting definitions in
`PeopleAtlasSettingTab.getSettingDefinitions()`.

Zij voegt geen setting toe, verwijdert geen setting, wijzigt geen key,
standaardwaarde, validatie, read-only-gedrag, opslagformaat of
relationship-template-semantiek.

## Proposed navigation contract

Na ratificatie MUST de root van de People Atlas Settings-tab één `General`
group bevatten en vier unieke navigabele subpagina's. De voorgestelde indeling
is:

| Locatie | Inhoud |
| --- | --- |
| `General` group op de root | People folder, Contact moments folder, Type property, Person/Relationship/Contact moment type value, Fallback person tag |
| `People schema` page | Person ID, naam, aliases, organisations, foto, birth date, pronouns, gender, emails, phones, job title, linked people en My person |
| `Relationships` page | Relationship ID, eerste/tweede persoon, types, template provenance, eerste/tweede rol, role format en de bestaande Relationship templates-lijst |
| `Contact moments` page | ID, people, relationship, occurred on, channel, summary, follow-up on en follow-up status-properties |
| `View & Bases` page | Default center person, Enable Bases view, View labels en Diagnostics |

Deze grens houdt gedeelde note-identificatie op één kleine rootgroep,
verzamelt elk domein op één plaats en laat de langste, zelfstandig beheerbare
secties achter een subpagina. De pagina's hebben unieke siblingnamen.

## Behavioral contract after ratification

1. Elke nu configureerbare gebruikerssetting MUST precies één declaratieve
   definitie houden met dezelfde control key, controltype, placeholder,
   opties, validatie en zichtbaarheid/read-only-voorwaarde, tenzij een ander
   actief contract dat expliciet vervangt.
2. Elke huidige control MUST via dezelfde `getControlValue()` en
   `setControlValue()`-grens blijven lezen en schrijven.
3. De `Relationship templates`-lijst MUST éénmaal onder `Relationships`
   verschijnen en behoudt bestaande add-, edit-, reorder-, delete-,
   empty-state-, read-only- en copied-value-semantiek.
4. De rootgroep en iedere page MUST een beschrijvende, unieke naam hebben.
   De navigatiestructuur mag geen duplicate siblingnamen bevatten.
5. `getSettingDefinitions()` MUST goedkoop blijven: geen vaultscans,
   netwerkaanroepen of andere file-I/O als gevolg van de nieuwe groepering.
6. Alle setting definitions, ook die op pagina's, MUST in dezelfde declaratieve
   array voorkomen zodat Obsidian ze bij tabregistratie kan indexeren voor de
   globale Settings-zoekfunctie.
7. Er mogen geen Settings-data worden gemigreerd en er mag geen vaultnotitie,
   relationship-template of view state worden geschreven enkel doordat de
   Settings-tab wordt geopend, gezocht of genavigeerd.
8. De Settings-tab MUST bruikbaar blijven op smalle viewports: root en
   subpagina's mogen niet horizontaal scrollen en de bestaande mutable lijst
   blijft bedienbaar met touch/keyboard volgens het hostgedrag.

### Scenario: bestaande instelling vinden en opslaan

Given een gebruiker zoekt naar `Contact moment summary property`
When Obsidian de People Atlas Settings-resultaten indexeert en opent
Then blijft de bestaande definitie met dezelfde key en validatie vindbaar
And blijft een geldige wijziging via de bestaande updategrens persistent
And worden geen andere settings of vaultnotities gewijzigd.

### Scenario: templatebeheer op een subpagina

Given plugin-data writes zijn ingeschakeld
When de gebruiker `Relationships` opent
Then kan hij dezelfde template-lijst beheren als vóór de herindeling
And behouden Add, Edit, Reorder en Delete hun bestaande voorwaarden.

### Scenario: settings is read-only

Given plugin-data writes zijn uitgeschakeld
When de gebruiker `Relationships` opent
Then toont de template-lijst dezelfde read-only state
And zijn mutation affordances niet beschikbaar
And creëert navigatie geen write of Notice buiten de bestaande grenzen.

## Acceptance criteria

- [ ] De door de gebruiker geratificeerde root-/pagina-indeling wordt exact
      weergegeven met unieke paginanamen.
- [ ] Een geflatte testoverzicht toont iedere bestaande configureerbare key
      precies eenmaal, met ongewijzigde controlmetadata en validatie.
- [ ] De template-lijst staat precies eenmaal onder `Relationships` en behoudt
      zijn huidige gedrag in schrijfbare en read-only mode.
- [ ] De definitiefunctie voegt geen I/O of bestandsscan toe.
- [ ] Zoeken/openen/navigeren wijzigt geen plugin-data, vaultnotities of
      viewstate.
- [ ] Gerichte tests bewijzen structuur, alle keys, template-lijstgedrag en
      de bestaande My person-/contact-moment-guardrails.
- [ ] De uitvoerder legt een handmatige Obsidian 1.13.4 desktop/mobile
      smoke-test vast als afzonderlijk begrensd bewijs, of noteert eerlijk
      waarom die omgeving niet beschikbaar was.
- [ ] `npm run test`, `npm run build` en `git diff --check` slagen in de
      uitvoerende ticketcontext.

## Non-goals

- Nieuwe settings, defaults, migraties of hernoemde opgeslagen keys.
- Een herontwerp van relationship templates, templateconfirmation of
  persistence; die vallen onder
  `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`.
- Nieuwe Bases-, graph-, person-, relationship- of contact-momentfunctionaliteit.
- Een claim dat de gemodelleerde testomgeving live Obsidian Desktop, Mobile,
  pop-outs of toegankelijkheid certificeert.

## References

- `.10x/research/2026-08-01-obsidian-1-13-4-settings-audit.md`
- `.10x/specs/declarative-settings-persistence-and-template-confirmation.md`
- `.10x/specs/perspective-relationship-editor-templates.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/knowledge/controlled-obsidian-integration-testing.md`
- `src/settings/settings-tab.ts`
- `test/settings-tab.test.ts`
- https://docs.obsidian.md/Plugins/User+interface/Settings

## Assumptions

- User-ratified: de 1.13.4-audit markeerde de Settings-herindeling als P1,
  de gebruiker vroeg om hiervoor een spec en tickets, en bevestigde op
  2026-08-01 de voorgestelde navigatie-indeling.
- Record-backed: de huidige Settings-tab bevat een platte declaratieve array;
  de openbare 1.13-API ondersteunt groups, lists en pages.
- User-ratified: de exacte root-/subpagina-indeling in de tabel boven.

## Blockers

None. De navigatie-indeling is op 2026-08-01 door de gebruiker bevestigd; de
gebruiker autoriseerde daarna de volledige P1-keten en P1a/P1b zijn gesloten.
P1c is uitvoerbaar binnen de begrensde scope van dit actieve contract.
