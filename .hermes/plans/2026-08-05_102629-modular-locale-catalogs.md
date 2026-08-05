# Modulaire locale-catalogi Implementation Plan

> **For Hermes:** Use verticale TDD, vervolgens een onafhankelijke read-only review, om dit plan taak voor taak uit te voeren.

**Goal:** Verplaats de EN/NL-vertalingen uit het monolithische `src/i18n.ts` naar afzonderlijke locale-modules, zonder wijziging van de publieke i18n-API, hostlocale-route, opgeslagen data of UI-gedrag.

**Architecture:** De Engelse catalogus blijft de compile-time bron van waarheid. `src/i18n/en.ts` exporteert die catalogus en leidt het getypeerde `Translator`-contract ervan af; elke andere locale-module moet dat contract volledig invullen. `src/i18n/index.ts` wordt uitsluitend de compacte publieke facade voor locale-resolutie, de catalogusmap en `createTranslator()`.

**Tech Stack:** TypeScript 5.9, Obsidian publieke `getLanguage()`-route, Vitest, Biome, Node 24.18.1 via `/home/nms/.local/node24/bin`.

---

## Doelarchitectuur

```text
src/
  i18n/
    en.ts       # Engelse broncatalogus + afgeleide Translator-typen
    nl.ts       # Nederlandse catalogus, getypeerd als Translator
    index.ts    # SupportedLocale, messageCatalogs, resolveLocale, createTranslator
```

De bestaande imports blijven exact werken:

```ts
import { createTranslator, type Translator } from "../i18n";
```

Na verwijdering van `src/i18n.ts` resolveert TypeScript/esbuild `../i18n` naar `src/i18n/index.ts`. Daardoor hoeven de bestaande UI-, test- en productcallers niet mechanisch te wijzigen.

## Huidige context en harde grenzen

- De huidige catalogi staan samen in `src/i18n.ts`: `englishCatalog` vanaf regel 36, `dutchCatalog` vanaf regel 263, en de publieke facade vanaf regel 484.
- `src/main.ts:78` blijft de enige hostlocale-constructorroute: `createTranslator(getLanguage())`.
- De geratificeerde spec vereist een **getypeerde, gebundelde interne catalogus**, zonder externe dependency, netwerk, locale-setting of hot switch. Losse TypeScript-modules voldoen daaraan.
- Fase 2 (`.10x/tickets/2026-08-04-i18n-interaction-accessibility-nl-en.md`) is nog actief. Deze refactor mag die ticket niet tussentijds uitbreiden of zijn actuele test-/gate-evidence ongeldig maken.
- Plan daarom een nieuw, klein refactorticket **ná formele fase-2-afsluiting en vóór fase 3**. Dat ticket hangt af van fase 2 en blokkeert fase 3 totdat de catalogusgrens weer groen en reviewed is.
- Geen externe i18n-package, JSON-loader, dynamische import, remote vertaalservice, plugininstelling, vaultwrite, commit, push of release.
- Een refactor zonder productgedragswijziging krijgt geen gefabriceerde RED-test. Leg eerst bestaande publieke contractgedrag vast, migreer minimaal en bewijs daarna onveranderd gedrag met gerichte tests en typecheck.

## Taak 1: Leg het refactorcontract en de afhankelijkheid vast

**Objective:** Maak de uitvoering traceerbaar zonder de nog actieve fase-2-scope te vermengen met infrastructuurwerk.

**Files:**
- Create (bij uitvoering): `.10x/tickets/<datum>-i18n-modular-locale-catalogs.md`
- Read: `.10x/specs/multilingual-user-interface.md`
- Read: `.10x/tickets/2026-08-04-i18n-interaction-accessibility-nl-en.md`
- Read: `.10x/tickets/2026-08-04-i18n-diagnostics-formatting-nl-en.md`

**Step 1: Wacht op de formele fase-2-closure.**

Vereist: fase 2 heeft gerichte tests, onafhankelijke PASS-review en actuele Node-24-gate. Voeg vóór die closure geen catalogus-bestandsrefactor toe.

**Step 2: Maak één dependency-ready refactorticket.**

Leg expliciet vast:
- afhankelijk van fase 2;
- geen uitbreiding van vertaalbereik;
- behoud van `getLanguage()`-, fallback- en publieke importcontracten;
- geen fase-3 diagnostics/`Intl`-werk;
- onafhankelijke review plus actuele volledige Node-24-gate vóór sluiting.

**Step 3: Activeer alleen dit ticket.**

Fase 3 blijft geblokkeerd tot de modulaire-catalogusrefactor klaar is. Hierdoor schrijft fase 3 direct in de definitieve modulaire structuur.

## Taak 2: Leg het bestaande publieke i18n-contract vast

**Objective:** Bewijs vóór de bestandsextractie dat de openbare factory, fallback en parametrische berichten exact gedrag hebben dat behouden moet blijven.

**Files:**
- Modify: `test/i18n.test.ts`
- Read: `src/i18n.ts`

**Step 1: Breid de bestaande karakteriseringstest uit.**

Behoud de bestaande public-importvorm:

```ts
import { createTranslator, messageCatalogs, resolveLocale } from "../src/i18n";
```

Voeg contractasserties toe voor:
- `nl`, `nl-BE`, `en_US`, onbekend en `undefined`;
- `messageCatalogs` met `en` en `nl`;
- minimaal één geneste modalkey, bijvoorbeeld:

```ts
expect(createTranslator("nl").personModal.save).toBe("Opslaan");
expect(createTranslator("en").relationshipModal.titleCreate).toBe("Create relationship");
```

- één parameterbericht waarin de parameter byte-exact terugkomt:

```ts
expect(createTranslator("nl").settingsMyPersonSelectedDescription({
  name: "Alice / Admin",
  filePath: "People/Alice.md",
})).toContain("Alice / Admin — People/Alice.md");
```

**Step 2: Voer de karakteriseringstest uit vóór productie-edit.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
npm exec -- vitest run --project node test/i18n.test.ts
```

Expected: PASS. Dit is bewust een gedragsbaseline, geen kunstmatige RED: de refactor voegt geen nieuwe eindgebruikersfunctionaliteit toe.

## Taak 3: Extraheer de Engelse contractcatalogus

**Objective:** Maak Engels de zelfstandige, getypeerde bron van waarheid zonder runtimegedragsverandering.

**Files:**
- Create: `src/i18n/en.ts`
- Modify/delete later: `src/i18n.ts`

**Step 1: Verplaats uitsluitend de Engelse catalogus en zijn lokale parameter-types.**

Maak `src/i18n/en.ts` met de huidige Engelse messagefuncties en cataloguswaarden. Exporteer de catalogus en leid het structurele contract ervan af:

```ts
export const englishCatalog = {
  // volledige huidige Engelse catalogus, byte-inhoudelijk ongewijzigd
};

type LocalizedCatalogValue<Value> = Value extends (...args: infer Parameters) => string
  ? (...args: Parameters) => string
  : Value extends object
    ? { [Key in keyof Value]: LocalizedCatalogValue<Value[Key]> }
    : string;

export type Translator = LocalizedCatalogValue<typeof englishCatalog>;
```

**Step 2: Houd scope strikt.**

- Verplaats tekst en parameterfuncties ongewijzigd.
- Wijzig geen keys, nesting, interpolatie, spaties, pluralisatie of vertaling.
- Voeg geen derde taal, `Intl`, loader of dependency toe.

## Taak 4: Extraheer de Nederlandse catalogus met compile-time pariteit

**Objective:** Maak Nederlands zelfstandig, terwijl TypeScript ontbrekende keys of foute parametercontracten blijft blokkeren.

**Files:**
- Create: `src/i18n/nl.ts`
- Read: `src/i18n/en.ts`

**Step 1: Schrijf de Nederlandse module met expliciet contract.**

```ts
import type { Translator } from "./en";

export const dutchCatalog: Translator = {
  // volledige huidige Nederlandse catalogus, byte-inhoudelijk ongewijzigd
};
```

De annotatie is verplicht; zonder die annotatie kan key-/parameterpariteit impliciet verloren gaan.

**Step 2: Bewijs typepariteit.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
npm run typecheck
```

Expected: PASS. Een ontbrekende Nederlandse key, een verkeerd geneste objectvorm of een afwijkende messagefunctie-signature moet TypeScript laten falen.

## Taak 5: Bouw de kleine publieke i18n-facade

**Objective:** Behoud iedere huidige consument en centraliseer alleen selectie/logica in `index.ts`.

**Files:**
- Create: `src/i18n/index.ts`
- Delete: `src/i18n.ts`
- Do not modify unless compiler proves necessary: alle bestaande `src/**`- en `test/**`-imports van `../i18n`/`../../src/i18n`.

**Step 1: Exporteer de bestaande publieke contracten.**

```ts
import { englishCatalog, type Translator } from "./en";
import { dutchCatalog } from "./nl";

export type SupportedLocale = "en" | "nl";
export type { Translator } from "./en";

export const messageCatalogs: Record<SupportedLocale, Translator> = {
  en: englishCatalog,
  nl: dutchCatalog,
};

export function resolveLocale(language: string | undefined): SupportedLocale {
  const languageCode = language?.trim().toLowerCase().split(/[-_]/)[0];
  return languageCode === "nl" ? "nl" : "en";
}

export function createTranslator(language: string | undefined): Translator {
  return messageCatalogs[resolveLocale(language)];
}
```

**Step 2: Verwijder pas daarna `src/i18n.ts`.**

Dit voorkomt dat importresolution tussentijds naar een ontbrekende module wijst. Er mag geen compatibiliteitsre-export in een tweede `src/i18n.ts` blijven bestaan: die zou de modulaire directory maskeren en de structuur dubbelzinnig maken.

**Step 3: Controleer consumer imports statisch.**

Verifieer dat `src/main.ts`, settings, modals en tests nog uitsluitend de bestaande facade importeren. Geen UI-caller mag rechtstreeks `./en` of `./nl` importeren; de actieve translator blijft de UI-afhankelijkheid.

## Taak 6: Verifieer gedrag, bundelbaarheid en formatting

**Objective:** Bewijs dat de structurele refactor exact dezelfde runtimeinterface behoudt.

**Files:**
- Test: `test/i18n.test.ts`
- Test: `test/integration/i18n-primary-ui.integration.test.ts`
- Test: de actuele fase-2-browser/integratietests die `Translator` injecteren
- Read: `package.json`

**Step 1: Run de gerichte Node-tests.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
npm exec -- vitest run --project node test/i18n.test.ts test/settings-tab.test.ts
```

Expected: PASS; inclusief public import, locale-resolutie, fallback, catalogusmap en parameterberichten.

**Step 2: Run de bestaande controlled-host i18n-integratietest.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
npm exec -- vitest run --project integration test/integration/i18n-primary-ui.integration.test.ts
```

Expected: PASS; `getLanguage()` blijft de initial locale kiezen zonder writes.

**Step 3: Run iedere fase-2-test die de translator direct injecteert.**

Ten minste de dan actuele persoon-/relatiemodalbrowsertests, plus andere fase-2-surfaces die vóór dit ticket zijn gesloten. Dit bewijst dat het gedeelde `Translator`-type en de facade niet zijn gebroken.

**Step 4: Run structurele controles.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
npm run typecheck
npm run format:check
npm run build
git diff --check
```

Expected: alle commando's exitcode 0. `npm run build` bewijst bovendien dat esbuild de directory-facade correct resolveert.

## Taak 7: Onafhankelijke review en één late volledige gate

**Objective:** Sluit het refactorticket alleen op actuele, onafhankelijke evidence.

**Files:**
- Read-only review van: `src/i18n/en.ts`, `src/i18n/nl.ts`, `src/i18n/index.ts`, verwijderde `src/i18n.ts`, relevante tests en het refactorticket.
- Modify na PASS: alleen het refactorticket voor evidence/status.

**Step 1: Vraag een onafhankelijke, strikt read-only review.**

Laat de reviewer ten minste falsifiëren:
- publieke import `src/i18n` is behouden;
- `getLanguage()` blijft uitsluitend in de pluginconstructie;
- fallback voor onbekende locale blijft Engels;
- EN/NL-pariteit is compiler-afdwingbaar, niet alleen een runtime key-vergelijking;
- er is geen externe dependency, dynamic import, netwerkactie of write-side-effect;
- alle gewone UI-consumenten blijven via `Translator`/`createTranslator` werken;
- user-authored en persistente waarden zijn niet gewijzigd.

**Step 2: Herstel uitsluitend concrete reviewfindings met gerichte regressie.**

Elke daadwerkelijke finding krijgt eerst een zo klein mogelijke test die het defect toont. Daarna pas minimale reparatie en herhaling van de getroffen gerichte suites. Een semantische reparatie vereist een nieuwe onafhankelijke rereview.

**Step 3: Draai één actuele brede Node-24-gate na PASS-review.**

```bash
export PATH=/home/nms/.local/node24/bin:$PATH
node --version
npm --version
npm run test
npm run build
git diff --check
```

Expected: Node uit `/home/nms/.local/node24/bin`, versie 24.x, en alle checks groen.

**Step 4: Werk alleen daarna ticket-evidence/status bij.**

Vermeld de concrete commands, exits, testprojecten, reviewverdict en expliciet dat er geen live Desktop/Mobile-hot-switch is getest. Markeer fase 3 pas dependency-ready wanneer het refactorticket formeel `done` is.

## Risico's en afwegingen

- **`src/i18n.ts` versus `src/i18n/index.ts` resolution:** behoud niet beide. De oude file kan directory-resolution maskeren; verwijder hem in dezelfde coherente patch als de nieuwe facade.
- **Typepariteit:** alleen `Object.keys(messageCatalogs.en)` vergelijken is onvoldoende voor geneste keys en parameterfuncties. `dutchCatalog: Translator` is de harde compilerbarrière.
- **Overmodularisering:** start met precies EN, NL en één facade. Voeg geen namespace-per-feature, JSON-schema, generated keys, dynamic imports of locale registry toe voordat er een derde taal daadwerkelijk is geautoriseerd.
- **Ongeldige fase-2-evidence:** voer de refactor pas uit nadat fase 2 formeel klaar is; anders moeten alle huidige fase-2-gerichte resultaten opnieuw als tussentijds worden beschouwd.
- **Toevoegen van een taal later:** creëer één nieuw `src/i18n/<locale>.ts` met `: Translator`, voeg de locale expliciet toe aan `SupportedLocale` en `messageCatalogs`, en breid `resolveLocale()` plus locale-tests uit. Dit blijft statisch, offline en compilerbaar.
- **Hot switching blijft uitgesloten:** de facade verandert niets aan de bestaande construction-time localekeuze. Een runtime language switch is een afzonderlijke productbeslissing.

## Acceptatiechecklist

- [ ] Elke huidige consument kan onveranderd uit `src/i18n` importeren.
- [ ] `getLanguage()` blijft de enige bron voor de initiële pluginlocale.
- [ ] Engels definieert het gehele `Translator`-contract.
- [ ] Nederlands voldoet compilerbaar aan dat contract.
- [ ] Fallback `nl-*` → `nl`, onbekend → `en` blijft exact gelijk.
- [ ] Geen user-authored waarde, ID, pad, frontmatter, settingspayload of writegedrag verandert.
- [ ] Gerichte tests, typecheck, formattering en build zijn groen.
- [ ] Onafhankelijke review is PASS.
- [ ] Exact één actuele volledige Node-24-gate is groen vóór sluiting.
