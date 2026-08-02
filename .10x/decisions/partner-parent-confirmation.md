Status: active
Created: 2026-08-01
Updated: 2026-08-01

# Expliciete partnerrol en bevestigde partner-ouderhulp

## Context

People Atlas heeft neutrale, expliciete `parent`/`child`-rollen, maar kent
nog geen semantisch partnerpad. De actieve
`.10x/specs/simple-relationship-automation.md` verbiedt terecht algemene
graafinferentie: een gedeelde ouder, gender, naam, type, template of
buurtstructuur mag geen relatie creëren, selecteren of voorstellen.

De gebruiker wil echter bij het expliciet opslaan van een ouder-kindrelatie
één concrete vervolgvraag krijgen wanneer die ouder precies één expliciet
vastgelegde partner heeft: of die partner ook als ouder van het kind moet
worden vastgelegd. De gebruiker wil geen extra derde ouderassociatie en
geen automatische tweede relatienotitie.

## Decision

1. People Atlas krijgt één aanvullende **Simple relationship**-keuze
   `Partner of the second person`. Die vult uitsluitend de twee onopgeslagen
   rollen `partner` en `partner` in. Zij verandert geen endpoints, types,
   templateprovenance, pad, ID, status, datums of andere formuliervelden.
2. Het exacte opgeslagen paar `partner`/`partner` is de canonieke,
   expliciete partnersemantiek voor deze slice. De keuze-oorsprong wordt
   niet apart opgeslagen; een bestaand handmatig note-paar met exact deze
   twee neutrale rollen heeft daarom dezelfde expliciete betekenis.
3. Na een **succesvolle nieuwe** canonieke `parent`/`child`-relatiewrite mag
   People Atlas één kortdurende kandidaat bepalen. Een kandidaat bestaat
   alleen als de ouder één unieke canonieke partnerpersoon heeft via een
   note-backed `partner`/`partner`-relatie die niet de status `ended` heeft,
   en die partner nog geen expliciete `parent`/`child`-relatie met hetzelfde
   kind heeft.
4. Als er precies één kandidaat is, toont People Atlas een bevestigingsmodal
   met de termen **partner** en **ouder**, bijvoorbeeld: `Is [partner] ook
   ouder van [kind]?` De UI gebruikt of bewaart geen derde ouderassociatie
   naast de partner- en ouderrelaties.
5. De positieve actie heet `Review relationship` en opent de gewone,
   vooraf ingevulde relatie-editor voor partner → kind met de bestaande
   Parent-keuze/rollen. Alleen een tweede expliciete Save in die editor mag
   de tweede relatienotitie schrijven. `Not now`, Cancel, Escape, backdrop
   en direct sluiten schrijven niets extra's; de reeds opgeslagen eerste
   relatienotitie blijft bestaan.
6. De kandidaat is niet persistent en verschijnt niet als synthetische edge,
   diagnostic of waarheid in de grafiek. Er is geen instelling, nieuw
   frontmatterveld, migratie, bulkpropagatie of achtergrondscan nodig.
7. Herkenning gebruikt uitsluitend canonieke identiteit en de exacte
   rolparen. Displaynamen, gender, pronouns, vrije relationship types,
   templates, My person, graph center, gedeelde ouders en grafbuurt tellen
   niet mee. Bij onopgeloste, ambigue, self-, beëindigde of meerdere
   partnerkandidaten verschijnt geen voorstel.

## Supersession

Deze beslissing supersedeert in
`.10x/specs/simple-relationship-automation.md` uitsluitend de grenzen die de
nieuwe Partner-keuze onmogelijk maken: de exclusieve drie-keuzelijst en
rolpaaropsomming in clauses 2–5 en 10, de partneruitsluiting in de Exclusions,
en het verbod op een **voorstel** in clause 22. De vervanging blijft beperkt tot
de hierboven begrensde Partner-keuze en post-create partner-ouderbevestiging.
De rest van die specificatie blijft actief, in het bijzonder:

- siblingrelaties blijven onafhankelijke expliciete notities;
- alleen expliciete Save schrijft een relatienotitie;
- ouder/child-opslag blijft neutraal `parent`/`child`;
- gender blijft uitsluitend presentatie en nooit bron voor relatiebetekenis.

## Consequences

- De veelvoorkomende gezinsflow kost na de eerste relatie hoogstens één
  concrete vraag en een gecontroleerde tweede Save.
- Een partner is geen automatische ouder; de gebruiker bevestigt altijd de
  afzonderlijke ouder-kindrelatie.
- Samengestelde gezinnen, meerdere partners, historische partners,
  adoptie, voogdij en andere complexe structuren worden niet gegokt.
- Alleen de expliciete `partner`/`partner`-semantiek activeert de hulp. Notes
  met `wife`, `husband`, vrije typen of template-namen zonder dat exacte
  paar worden niet stil geherinterpreteerd.
- De bestaande Markdown-first opslag en mutation boundary blijven de enige
  waarheid en vereisen geen migratie.

## Alternatives considered

- **Partner of spouse automatisch als ouder vastleggen.** Verworpen: de
  relatie is domeininhoudelijk niet altijd waar en zou een verborgen write
  veroorzaken.
- **Een extra ouderassociatie-property of -relatie bewaren.** Verworpen: dat
  introduceert een derde semantiek voor een vraag die met de twee bestaande
  relaties kan worden opgelost.
- **Vrije typen, template-IDs of namen als partner herkennen.** Verworpen:
  ze zijn niet canoniek of kunnen lokaal anders betekenen; dit zou opnieuw
  onverklaarbare inferentie maken.
- **Bij meerdere partners een keuzelijst tonen.** Verworpen voor de eerste
  slice: meerdere opties veranderen een bevestigingshulp in een nieuwe
  selectieworkflow. Geen voorstel is veiliger en eenvoudiger.
- **De tweede relatie direct schrijven na `Ja`.** Verworpen: een tweede
  expliciete Save houdt iedere vaultwrite zichtbaar en herstelbaar.

## References

- `.10x/specs/partner-parent-confirmation.md`
- `.10x/specs/simple-relationship-automation.md`
- `.10x/specs/safe-mutations-and-versioned-data.md`
- `.10x/decisions/perspective-oriented-relationship-model.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
