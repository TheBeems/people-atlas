Status: active
Created: 2026-08-08
Updated: 2026-08-08

# Besluit: geen vaste production-bundlelimiet

## Context

De actieve reproduceerbare-releasespecificatie bevatte een vaste limiet van
409.600 bytes. Een eerdere release-actie verhoogde die limiet naar 500.000 bytes
omdat de echte bundle daarbinnen viel. De onafhankelijke review liet zien dat
de limiet vooral een historische, arbitraire gate is: de huidige bundle is
418.885 bytes, de productie-output is minified en sourcemap-vrij, en de
reproduceerbaarheidscontrole blijft afzonderlijk betekenisvol.

De vaste grens voegde geen bewezen product- of operationele bescherming toe,
maar blokkeerde wel releases op basis van een losstaand getal dat niet aan een
Obsidian-runtime-eis of gemeten regressie was gekoppeld.

## Decision-time observation

The `418.885 bytes` value above is the historical as-of observation used when
this decision was made, before the later final-gate artifact rebuild. The
current local candidate observation is `426.082 bytes` and remains
observability only; it does not change this decision.

## Besluit

People Atlas legt geen vaste byte-limiet meer op aan de production `main.js`.

De releasecontracten blijven wél afdwingen:

- production minification;
- geen inline of externe sourcemap in de releasebundle;
- aanwezigheid van de drie vereiste release-assets;
- correcte metadata en exacte versies;
- reproduceerbare dubbele build met gelijke SHA-256-digests;
- dependency-, test-, typecheck-, lint- en community-gates.

Een build mag de bundlegrootte rapporteren voor observability, maar grootte
alleen mag geen release of quality gate laten falen.

Dit besluit supersedeert uitsluitend de vaste bundle-budgetsemantiek uit
eerdere release-records. Historische tickets blijven onveranderd als historie.

## Alternatieven overwogen

### Limiet op 409.600 bytes behouden

Verworpen: de huidige bundle overschrijdt deze grens zonder dat een concrete
runtime- of distributie-eis die grens ondersteunt.

### Limiet op 500.000 bytes behouden

Verworpen: dit is slechts een nieuw arbitrair getal en herhaalt hetzelfde
contractdriftprobleem.

### Alle artifactchecks verwijderen

Verworpen: sourcemap-vrijheid, minification, asset-aanwezigheid en
reproduceerbaarheid blijven concrete releaseveiligheidsrails.

## Consequenties

Positief:

- geen releases blokkeren op een niet-onderbouwde bytegrens;
- minder contractdrift tussen spec, script en releasecopy;
- reproduceerbaarheid en outputkwaliteit blijven controleerbaar.

Negatief/residual risk:

- een onbedoelde bundle-groei faalt niet meer automatisch op bytes;
- toekomstige performance- of distributieproblemen moeten via echte metingen,
  Obsidian-compatibiliteit of distributielimieten worden onderbouwd.

Als later een limiet nodig blijkt, komt die als afzonderlijk user-geratificeerd
besluit terug met een gemeten rationale en negatieve regressietest.

## Referenties

- `.10x/specs/reproducible-obsidian-release.md`
- `.10x/tickets/2026-08-06-release-0.11.0-alpha.md` (historische 500k-beslissing)
- `.10x/tickets/2026-08-08-release-contract-simplification.md`
