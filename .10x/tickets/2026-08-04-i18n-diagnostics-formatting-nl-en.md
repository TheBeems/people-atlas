Status: blocked
Created: 2026-08-04
Updated: 2026-08-04
Depends-On: `.10x/specs/multilingual-user-interface.md`; `.10x/tickets/2026-08-04-i18n-interaction-accessibility-nl-en.md` must be `done`

# i18n-diagnostics en locale-formattering (Nederlands/Engels)

## Doel

Voer uitsluitend fase 3 van de geratificeerde meertaligheidsspecificatie uit:
stabiele diagnostic-/validation-codes aan de pure grens, locale-presentatie aan
de UI-grens en locale-bewuste datum-, nummer- en pluralisatieformattering.

## Scope

- Definieer stabiele pure codes met getypeerde parameters waar een pure fout aan
  een gebruiker wordt getoond; de UI catalogus kiest de uiteindelijke taal.
- Vervang Engelse gebruikersgerichte diagnostics en validation-presentatie via
  de bestaande catalogusgrens.
- Gebruik uitsluitend ingebouwde `Intl` of getypeerde messagefuncties voor
  locale-afhankelijke formattering/pluralisatie.
- Test per code en formattering Nederlandse/Engelse presentatie, Engelse fallback
  en ongewijzigde pure domeinsemantiek/persistentie.

## Niet doen

- Geen locale-setting, externe dependency, remote service, telemetry of
  automatische vertaling.
- Geen vertaling/mutatie van IDs, paden, frontmatter, templates of
  user-authored gegevens.
- Geen Obsidian- of i18n-import in pure domein-/graph-/parsinglagen.
- Geen commit, push, tag, release of live-vaultmutatie.

## Uitvoering en gate

- Eerst verticale TDD met assertion-grade RED/GREEN voor code→UI-presentatie en
  formattering; contractwijzigingen in pure lagen krijgen aparte regressies.
- Onafhankelijke read-only review vóór één actuele Node-24 full gate:
  `npm run test`, `npm run build`, `git diff --check`.
- Sluit alleen na PASS-review en actuele groene gate.

## Acceptatiecriteria

- [ ] Pure lagen leveren stabiele codes/parameters zonder i18n- of
      Obsidian-import; de UI presenteert deze in Nederlands/Engels met fallback.
- [ ] Diagnostic-, validation-, datum-, nummer- en pluralisatiepresentatie is
      locale-correct zonder opslag- of identiteitseffect.
- [ ] Gerichte node/controlled-browsertests, review en actuele Node-24-gate zijn
      groen; live Desktop/Mobile blijft afzonderlijk gevalideerd.

## Blokkers

- Fase 2 (`2026-08-04-i18n-interaction-accessibility-nl-en`) moet eerst `done`
  zijn.
- Implementatie vereist daarna een verse expliciete gebruikersautorisatie.

## Journal

- 2026-08-04: Als afzonderlijke vervolgscope voorbereid conform fase 1; geen
  productcode, test, build, plugindata, vaultinhoud, staging, commit, push, tag
  of release gewijzigd.
