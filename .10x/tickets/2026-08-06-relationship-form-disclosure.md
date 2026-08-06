Status: done
Created: 2026-08-06
Updated: 2026-08-06
Parent: none
Depends-On: `.10x/specs/relationship-form-disclosure.md`

# Relatie-formulier: subgroepen en disclosure (Relatie-sectie)

## Scope

Implementeer `.10x/specs/relationship-form-disclosure.md` in één begrensd
ticket: herstructureer uitsluitend de inwendige indeling van de
`Relationship`-sectie in de gedeelde relatie-modal tot drie subgroepen in
deze volgorde:

1. **Shortcut-disclosure** (`<details>`/`<summary>`) — alleen de
   `Simple relationship`-select, standaard ingeklapt;
2. **Template-disclosure** (`<details>`/`<summary>`) — sjabloonselect,
   lege-staat, `Create template`, statusregel en `Apply latest template
   values`, standaard ingeklapt, maar automatisch geopend in bewerkingsmodus
   wanneer een sjabloon aan de notitie is gekoppeld;
3. **Core-subgroep** (altijd zichtbaar) — `Relationship types`, eerste rol,
   tweede rol en de rolpreview.

Gebruik het bestaande native disclosure-patroon van
`.people-atlas-relationship-advanced` (in dezelfde modal al aanwezig) als
template; voeg geen nieuwe widgetbibliotheek toe en hardcode geen thema-
kleuren.

## Niet doen (expliciete begrenzing)

- Geen wijziging aan de secties People, Context of Advanced, noch aan het
  `Advanced`-disclosuregedrag (fout-geassocieerde auto-open, padoverzicht,
  staatbehoud).
- Geen wijziging aan enig template-datamodel, form-state-contract,
  validatieregel, mutatiepad, persisted property, bulk-sync-semantiek,
  dependencies, lockfile, versioning, commit, push, release of vaultwrite.
- Geen tabs, wizards, steppers of validatiepoorten; Snelkoppeling/Sjabloon
  mogen nooit verplicht open zijn vóór Save.
- Geen herschikking van de Core-velden zelf (typen, rol A, rol B, preview).
- Geen nieuw sjabloon automatisch toepassen, geen live template-afhankelijkheid.
- Geen vertaal-/lokalisatiewijziging anders dan de benodigde disclosure-
  summarykoppels; de bestaande keys `simpleRelationship`,
  `relationshipTemplate`, `noTemplate` en `missingTemplate` leveren de
  summary- en toestandsteksten al, dus er is geen tweede vertaalpaar nodig
  tenzij een kortere summaryvariant echt vereist is. Beperk i18n-aanpassingen
  tot `nl.ts`/`en.ts`.

## Verticale TDD-uitvoering

### Slice 1 — Shortcut-disclosure

- Schrijf eerst een browser-/integratieregressie die aantoonbaar rood faalt
  omdat de `Simple relationship`-select momenteel als plat veld in de
  `Relationship`-sectie staat zonder collapsed disclosure.
- Implementeer de minimale native disclosure: verplaats alleen de
  simple-relationship-select in een standaard ingeklapte
  `<details>`/`<summary>` met accessibility-patroon conform Advanced.
- Herhaal groen; assert standaard ingeklapt, summarylabel herkenbaar,
  select bereikbaar na openen, en geen write vóór Save.
- Breid uit: na een shortcut-keuze vullen de Core-rollen/preview in-place en
  mag de disclosure sluiten; de Core-subgroep toont de gevulde rollen.

### Slice 2 — Template-disclosure

- Schrijf eerst een regressie die rood faalt omdat de sjabloonmachinerie
  (select, lege-staat, create, status, apply) als platte velden tussen de
  andere Relatie-velden staat.
- Verplaats de complete sjabloonmachinerie in een standaard ingeklapte native
  disclosure; summary toont sjabloontoestand (geen sjabloon / sjabloonnaam /
  missing-affordance) zonder de helpteksten te dupliceren.
- Bewijs groen dat select/detach/reapply/create en dynamische label-/preview
  updates blijven werken met de disclosure open én dicht, dat de
  open/dichtstaat sjabloon- en label-refreshes overleeft, en dat een
  fout-geassocieerde auto-open alleen het juiste disclosure opent.

### Slice 3 — Edit-modus auto-open en staatoonsistentie

- Schrijf eerst een regressie die rood faalt: bij openen in edit-modus met
  `presetId` blijft de Template-disclosure nu dicht.
- Implementeer de minimale auto-open op load wanneer een sjabloon is
  aangekoppeld; bij geen/ontbrekende sjabloon blijft hij dicht.
- Bewijs groen dat de summary de sjabloonnaam/missing-affordance toont, focus
  niet verschuift, geen form rebuild plaatsvindt en geen write vóór Save;
  behoud Advanced-staat, scroll en unsaved values.

### Review en gates

- Journaliseer per slice exact RED/GREEN-commando, exits en testcounts.
- Laat vóór de eerste volledige gate een onafhankelijke read-only review de
  scoped diff tegen spec en de gedeeltelijk-gesupersedeerde parent-spec
  falsifiëren.
- Herstel echte reviewfindings uitsluitend met een nieuwe gerichte regressie;
  vraag daarna een verse review.
- Na semantische stabiliteit: één Node-24 `npm run test`, `npm run build` en
  `git diff --check`; houd de full gate actueel na latere code/testwijziging.

## Acceptance criteria

- [x] De `Relationship`-sectie heeft exact drie subgroepen in de volgorde
      Shortcut-disclosure, Template-disclosure, Core-subgroep.
- [x] Alleen de Core-subgroep is bij openen zichtbaar; beide disclosures zijn
      standaard ingeklapt.
- [x] Template-disclosure auto-opent in edit-modus bij aangekoppelde sjabloon;
      bij geen/ontbrekende sjabloon blijft hij dicht en toont de summary de
      toestand.
- [x] Shortcut-keuze vult Core-rollen/preview in-place zonder de disclosure
      open te houden.
- [x] Sjabloon select/detach/reapply/create en dynamische updates werken met
      disclosure open én dicht; open/dichtstaat overleeft refreshes.
- [x] Fout-geassocieerde auto-open opent enkel het juiste disclosure; andere
      secties en gedrag ongewijzigd.
- [x] Dekt toegankelijkheid (native disclosure, Tab/Enter/Space, beschrijvingen
      via aria-describedby) en narrow/mobile one-column reflow met behoud van
      Save/Cancel.
- [x] Elke niet-gesupersedeerde parent-spec-clausule blijft waar; gerichte
      suites, full gate en `git diff --check` zijn groen onder
      `/home/nms/.local/node24`.
- [x] Onafhankelijke review: PASS.

## Blokkers

None. Inspectie van `src/editor/relationship-modal.ts`,
`src/editor/relationship-form.ts`, `styles.css`, `nl.ts`/`en.ts` en de
actieve/gesupersedeerde specs bevestigt dat het bestaande
Advanced-disclosure-patroon herbruikbaar is en dat de form-state- en
template-contracten ongewijzigd blijven.

## Journal

- 2026-08-06: Shaping — UX-bevindingen uit de relatie-modal-screenshot
  (uitgelezen via OCR; vision-provider was niet ingesteld) en de bron
  (`relationship-modal.ts`, `nl.ts`). De `Relationship`-sectie stapelt zes
  items in één zichtbare rijstroom; de gebruiker koos voor subgroepen met
  Snelkoppeling en Sjabloon ingeklapt, alleen Core zichtbaar. Spec
  `relationship-form-disclosure.md` is geschreven en actief; volgorde
  Shortcut ▶ Template ▶ Core en edit-modus auto-open bij aangekoppelde
  sjabloon zijn geratificeerd door de gebruiker op 2026-08-06. Werkree schoon
  op `main`; geen code, test, build, dependency of vaultwrite gewijzigd.
- 2026-08-06: Onafhankelijke read-only review: **PASS**. De reviewer las beide
  records, de ouder-spec en de bron (`relationship-modal.ts`, `styles.css`,
  `relationship-form.ts`, `nl.ts`/`en.ts`) en wijzigde niets. Gesupersedeerde
  clausules 21/22 correct afgebakend, geen conflict met andere parent-
  clausules, codeonderbouwing reëel, a11y/state-claims geklopt, template-
  summary-data beschikbaar, i18n-keys aanwezig. Geen critical/significant
  findings; 4 minor + 2 nit werden tekstniveau gecorrigeerd: zwevende
  code-fence verwijderd, clausule 2 verhelderd (Core default-zichtbaar met
  auto-open-exceptie), spec-AC voor a11y/reflow toegevoegd (symmetrie met
  ticket-AC, spiegel CSS-gebruik), governing spec in `Depends-On` gezet en
  i18n-wording verfijnd. Residual risk laag en duurzaam geaccepteerd.
- 2026-08-06: **Execution, verticale TDD.**
  - *Slice 1-2-3 (buildForm herschikking).* De `Relationship`-sectie bouwt nu
    drie subgroepen: een `details.people-atlas-relationship-shortcut` (alleen de
    Simple relationship-select, standaard dicht), een
    `details.people-atlas-relationship-template` (sjabloonselect + lege-staat +
    Create-template + status + apply, standaard dicht, auto-open in edit-modus
    bij `presetId`), en de altijd-zichtbare Core (types + rollen + preview).
    `refreshTemplateSummary()` zet de sjabloonnaam/missing-affordance in de
    summary; `refreshTemplateOptions` roept dit aan. CSS-spiegelt het bestaande
    Advanced-disclosure-patroon (`people-atlas-relationship-shortcut/template`,
    -body), geen hardcoded kleuren.
  - RED→GREEN: drie nieuwe browser-tests faalden eerst (geen shortcuts/template
    disclosures, geen auto-open, geen in-place shortcut-fill bij gesloten
    disclosure) en zijn nu groen. `openTemplateCreator`-focus/scroll/Advanced-
    status-restauratie en alle bestaande template/dynamic/focus-asserties
    blijven geldig; vier bestaande browser-tests zijn aangepast om hun
    disclosure eerst te openen vóór focus op een intern veld (browsers weigeren
    focus op inhoud van een gesloten `<details>` — het bedoelde nieuwe gedrag,
    geen verzwakte assertie).
  - Bewijs: `npm run typecheck` exit 0; browser
    `relationship-modal` 19/19, `partner-parent-relationship-modal` 2/2,
    node `relationship-entrypoints` 16/16 — alle groen. Worktree: enkel de
    twee 10x-records plus de 3 gewijzigde bron/testbestanden; geen commit,
    push, release of vaultwrite.
- 2026-08-06: Onafhankelijke read-only code-review (1e ronde): **concerns**
  (geen clean pass) — structuur, auto-open-semantiek, write-before-Save,
  focus/scroll/state-restauratie, a11y en CSS werden correct bevonden;
  `git diff --check`, `tsc` en de runner waren groen. Eén duidelijke
  spec-deviantie + twee dekkingslacunes hersteld:
  1. [minor] `refreshTemplateSummary` toonde in de no-template-branch alleen
     de basislabel; spec clausule 8 eist ook de no-template-affordance. Nu
     `${relationshipTemplate} — ${noTemplate}` (bestaande key, geen nieuwe).
  2. [nit] missing-template auto-open (presetId gezet, preset afwezig) was
     correct gedrag zonder test; nieuwe browser-regressie toegevoegd die
     `open === true` én de missing-affordance in de summary assert.
  3. [nit] subgroep-volgorde was niet expliciet geassert; de
     default-collapsed-test assert nu via `querySelectorAll`+index dat
     Shortcut ▶ Template ▶ Core en dat de collapsed template-summary de
     no-template-affordance toont.
  Bewijs na herstel: `npm run typecheck` exit 0; browser
  `relationship-modal` **20/20** groen. Verse onafhankelijke review (2e ronde)
  over de herstel-diff is in gang gezet en blijft closureblocker.
- 2026-08-06: Onafhankelijke read-only code-review (2e ronde): **concerns**
  (geen clean pass). Twee van drie ronde-1-findings correct opgelost; de
  no-template-summary-oplossing (`Relationship template — No template — enter
  values manually`) werd beoordeeld als aanvaardbaar KISS en schendt clausule
  9 niet (`noTemplate` is een korte affordance-token, geen helper-paragraaf);
  de missing-template-test oefent de code echt (geen false-positive); geen
  regressie. De enige resterende blocker: de volgorde-assertie in de
  default-collapsed-test gebruikte een dode selector `.people-atlas-field`
  (echte wrapper-klasse is `.people-atlas-form-field`), waardoor alleen
  Shortcut→Template→preview werd bewezen (preview is altijd laatste) en niet
  dat Core-velden na de template staan.
  Herstel: selector gecorrigeerd naar `.people-atlas-form-field`, en een
  expliciete index-assertie op het `types`-veld (via
  `inputForLabel(...).closest(".people-atlas-form-field")`) zodat
  `shortcutIndex < templateIndex < typesIndex < corePreviewIndex` — de kern
  van clausule 1 (Shortcut ▶ Template ▶ Core met Core-velden erna) is nu
  waterdicht geassert. Bewijs: `npm run typecheck` exit 0; browser
  `relationship-modal` **20/20** groen. Ronde-3-versereview is in gang gezet
  en blijft closureblocker.
- 2026-08-06: Onafhankelijke read-only code-review (3e/finale ronde): **PASS**.
  De ronde-2-blocker (dode selector + preview-proxy) is correct opgelost: de
  default-collapsed-test gebruikt `.people-atlas-form-field`, vergelijkt op
  objectidentiteit via `findIndex(child => child === typesField)` en bewijst
  feitelijk `shortcutIndex < templateIndex < typesIndex < corePreviewIndex`
  (in code strikt genoteerd als `>`-reeks: `corePreviewIndex > typesIndex >
  templateIndex > shortcutIndex`) — een concreet Core-veld (types) ná de
  template én vóór de preview. Geen dode selectors, geen regressie; no-template
  en missing-template items opnieuw bevestigd; ticketjournal klopt met de code.
  Verdict: **PASS** — residual risk laag. Geen harde vereisten meer; twee puur
  optionele cosmetische/defensieve suggesties (duidelijker leesbare
  ongelijkheidsnotatie, defensiever typesIndex-anker) zijn niet vereist en
  buiten scope.
- 2026-08-06: **Closure (DoD).** Volledige Node-24 gate groen na Biome-format
  van 2 bestanden: `npm run check` (format, lint, typecheck, node 50/50
  934/934 · browser 10/10 130/130 · integration 8/8 · browser-matrix 3/3,
  build:production, release:contract 0.11.0 main.js 418789/500000 bytes,
  community:check 62 sources), `npm run verify:reproducible` (beide builds
  SHA-256 `bea37a54…2cca`) en `git diff --check` OK. Worktree bevat uitsluitend
  de 3 bron/testwijzigingen + 2 10x-records; er is nog geen commit/push.
  Ticket gesloten: alle AC's `[x]`, review PASS (ronde 3).

## Retrospective

De herschikking van de `Relationship`-sectie tot drie subgroepen (Shortcut/
Template-disclosure + always-visible Core) viel samen met de bestaande
`Advanced`-disclosure-opzet, waardoor `<details>`-hergebruik en de CSS het
triviaal hielden (KISS). Wat opviel: het verplaatsen van bestaande
form-besturing naar een standaard gesloten `details` draait vier bestaande
browser-tests op focus — browsers in de vitest-browser-proxy weigeren focus op
inhoud van een gesloten `<details>`, wat de testaanpassing (`disclosure.open =
true` vóór `.focus()`) legitiem en de assertie onaangetast maakte. Eén review-
niet in ronde 1: een collapsed `summary` die alleen de sectielabel toont is
een erkende affordance maar miste de vereiste no-template-status; de
no-template-branch gebruikt nu de bestaande `noTemplate`-key als suffix
(zonder nieuwe vertaalkoppel). Ronde 2 ving een dode test-selector
(`.people-atlas-field` vs. `-form-field`) én een assertie die via de
role-preview (altijd laatste) een "Core-na-template"-claim bewees zonder een
concreet Core-veld te meten; de gecorrigeerde assertie verankert nu op het
`types`-veld. Les: bij het schrijven van volgorde-asserties op een sectie,
baseer een bewijs op een element dat door de werkelijke wrapper-klasse wordt
aangewezen en geen proxy die per definitie onderaan staat; en bij het
klaarzetten van regression-tests, de echte klasse (lees de bron,
`addInput`-wrapper `.people-atlas-form-field`) gebruiken i.p.v. een
gefantaseerde suffix.

## References

- `.10x/specs/relationship-form-disclosure.md` (governing spec)
- `.10x/specs/perspective-relationship-editor-templates.md` (parent;
  clausules 21/22 gedeeltelijk gesupersedeerd)
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/research/2026-07-30-person-relationship-ux-review.md`
- `src/editor/relationship-modal.ts`, `src/editor/relationship-form.ts`
- `src/i18n/nl.ts`, `src/i18n/en.ts`, `styles.css`
