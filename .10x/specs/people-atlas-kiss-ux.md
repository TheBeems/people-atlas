Status: active
Created: 2026-08-16
Updated: 2026-08-16

# People Atlas KISS UX-contract

## Purpose

Deze spec beschrijft de vereenvoudigde gebruikerslaag bovenop de bestaande
People Atlas-snapshot. De contracten hieronder maken drie taken primair:
personen vinden, relaties begrijpen en opvolging zien.

## Scope

Deze spec bestuurt:

1. de labels en betekenis van de drie primaire surfaces;
2. de leesbare netwerkcontext en scopekeuze;
3. personenzoeken en selectie;
4. contextuele relatie-informatie in de graph/detailflow;
5. de gedeelde persoonsdetailcompositie en actiehiërarchie;
6. de zichtbaarheid en semantiek van aantallen;
7. toegankelijkheid en parity tussen standalone en Bases.

Deze spec bestuurt geen nieuwe Markdown-velden, geen relatie-inferentie, geen
graph-edge-selection, geen force-layout en geen externe reminders.

## Normative contract

### Primary information architecture

- De standalone en gedeelde renderer MUST drie primaire surfaces blijven
  aanbieden.
- De zichtbare labels MUST `Netwerk`, `Personen` en `Opvolging` zijn.
- De onderliggende graph-, list- en follow-upgedragingen mogen intern hun
  bestaande namen behouden zolang de user-facing labels voldoen.
- De drie surfaces MUST dezelfde selectie-identiteit en snapshotsemantiek
  respecteren.

### Network context and scope

- Wanneer een geldig center beschikbaar is, MUST de context `Netwerk rond:
  <weergavenaam>` tonen.
- De getoonde naam MUST nooit worden gebruikt als identity-key.
- `Directe relaties` MUST precies de nodes op afstand nul en één bevatten
  volgens de bestaande undirected adjacencyregels.
- `Alles` MUST de free-network-projectie gebruiken.
- In `Alles` MUST de context niet suggereren dat de graph rond één persoon
  wordt beperkt; de UI toont dan `Hele netwerk` of gelijkwaardige Nederlandse
  copy.
- Center-, projection-, hops- en layout-state MUST stabiel blijven opgeslagen
  volgens de bestaande view-statecontracten.
- Het wissen of wijzigen van scope MUST geen vault-notes schrijven.

### Search

- De Personenweergave MUST een native search control aanbieden met een
  Nederlandstalige accessible name, clear affordance en keyboardbediening.
- De eerste matchvelden zijn de zichtbare persoonlabel, `jobTitle` en
  `organizations`.
- De zoekopdracht MUST de huidige personenprojectie filteren en MUST niet
  automatisch center, scope, camera of projection mode wijzigen.
- Een zoekresultaatselectie MUST een stabiele `NodeId` gebruiken.
- Lege resultaten, wissen en een ontbrekende geselecteerde node MUST veilig en
  begrijpelijk worden behandeld.
- Alias-search is expliciet buiten deze versie totdat aliases in het gedeelde
  snapshotcontract beschikbaar zijn.

### Graph and relationship meaning

- De graph MUST default rustig blijven en mag niet voor iedere edge een
  permanente tekstlabel renderen.
- Na selectie van een persoon MUST relevante incident relationships in het
  detailoppervlak zichtbaar zijn zonder dat de gebruiker een technische
  projectioninstelling hoeft te begrijpen.
- Een note-backed relationship MUST zijn bestaande role/type/status/since/
  last-contactmetadata behouden.
- Een inferred link MUST herkenbaar blijven als `Gekoppelde personen` en mag
  niet als een editable relationship worden gepresenteerd.
- Parallelle relationship edges MUST afzonderlijk herkenbaar blijven.
- Er wordt geen graph-edge-selection, contextmenu of nieuwe complexe legenda
  vereist door deze spec.

### Person details

- Standalone, renderer en Bases MUST een gedeelde kerncompositie gebruiken.
- De kernvolgorde MUST zijn: naam; functie/context; organisatie; relevante
  relaties; laatste expliciete contactdatum; opvolging.
- Alleen aanwezige waarden worden getoond.
- `Contact vastleggen` MUST de primaire persoonactie zijn.
- Edit-, relationship-create-, open-note- en centeracties MUST beschikbaar
  blijven als secundaire acties.
- Identiteitspaden, raw IDs en technische diagnostics horen niet in de
  primaire profielkaart.
- Een contactmomentdatum mag niet automatisch relationship-status of follow-up
  afleiden.

### Counts

- De primaire toolbar MUST geen onverklaarde globale node-/edge-count tonen.
- Als een count later wordt getoond, MUST de tekst expliciet dezelfde
  zichtbare projectie bedoelen als de onderliggende surface.
- Hidden node/edge counts mogen niet worden gebruikt om een volledige
  vaultweergave te suggereren.

### Accessibility and lifecycle

- Native controls, focus management, roving list focus, Enter, Escape,
  arrow/Home/End en owning-window lifecycle MUST behouden blijven.
- De vereenvoudiging mag pointer-, touch- en keyboardzoom niet verwijderen.
- Nieuwe DOM listeners MUST lifecycle-owned zijn.
- Renderercomponenten MUST geen vault data lezen.
- De bestaande Obsidian CSS-variabelen en reduced-motionregels blijven de
  visuele basis.

## Given/When/Then scenarios

### Primary labels

Given de gedeelde renderer wordt geopend

When de primaire navigatie zichtbaar is

Then ziet de gebruiker `Netwerk`, `Personen` en `Opvolging` in die volgorde.

### Directe relaties

Given een uniek geselecteerd persoon met directe en indirecte buren

When de gebruiker `Directe relaties` kiest

Then toont de graph het center en uitsluitend nodes op maximaal één hop.

### All network

Given een configured center en een volledig snapshot

When de gebruiker `Alles` kiest

Then worden alle beschikbare nodes en geldige edges geprojecteerd en wordt
geen center-beperking gesuggereerd.

### Search does not mutate projection

Given een Personenweergave met een actieve netwerkprojectie

When de gebruiker een zoekterm typt en een resultaat selecteert

Then verandert alleen de zichtbare personenlijst/selectie; center, scope,
camera en vaultdata blijven ongewijzigd.

### Relationship disclosure

Given een geselecteerde persoon met een partner-, kind- of collega-relatie

When het persoonsdetail zichtbaar is

Then ziet de gebruiker counterpart en beschikbare relatierol/type zonder een
technische graph-legenda te hoeven openen.

### Primary contact action

Given een persoon zonder open beheeractie

When het detailpaneel zichtbaar is

Then is `Contact vastleggen` de primaire actie en zijn beheeracties secundair
maar bereikbaar.

### Count safety

Given een projectie met verborgen nodes of edges

When de primaire toolbar wordt getoond

Then wordt geen count getoond die zonder scopecontext als volledige atlas kan
worden geïnterpreteerd.

## Acceptance criteria

- [ ] De drie surfaces hebben de vastgelegde labels en behouden hun bestaande
      informatiearchitectuur.
- [ ] De context- en scopecopy representeert center en één-hop/free-network
      semantiek correct.
- [ ] Personen zoeken gebruikt native controls, stabiele NodeIds en wijzigt
      geen projection state tijdens het typen.
- [ ] Geselecteerde relaties zijn betekenisvol zichtbaar zonder permanente
      edge-labels of complexe legenda.
- [ ] Standalone, renderer en Bases delen de kern van het persoonsdetail en
      maken `Contact vastleggen` primair.
- [ ] De primaire toolbar toont geen conceptueel onduidelijke globale counts.
- [ ] Bestaande keyboard-, touch-, focus-, lifecycle-, ghost-, ambiguous- en
      stale-actioncontracten blijven intact.
- [ ] Pure, browser- en integratietests dekken iedere nieuwe semantische
      branch en gerepareerde regressie.
- [ ] `npm run test`, `npm run build` en `git diff --check` slagen.

## Exclusions

- Geen alias-search in deze versie.
- Geen relationship inference, person merge of display-name identity.
- Geen nieuw design system, graph store of algemene UI-frameworklaag.
- Geen permanente labels op alle edges.
- Geen OS-reminders, recurrence, background notification of externe sync.
- Geen wijziging van Markdown-opslagsemantiek buiten bestaande expliciete
  contactmoment- en follow-upcontracten.

## References

- `.10x/decisions/people-atlas-kiss-ux-direction.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/relationship-context-actions.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
