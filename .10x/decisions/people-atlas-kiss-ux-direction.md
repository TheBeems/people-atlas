Status: active
Created: 2026-08-16
Updated: 2026-08-16

# KISS-UX voor People Atlas

## Context

People Atlas heeft inmiddels een stabiele Markdown-, snapshot-, relatie- en
contactarchitectuur. De huidige UX legt echter te veel technische state bloot:
center mode, projection mode, dubbele graph-controls en meerdere detailpanelen.
De gebruiker wil de drie bestaande informatie-oppervlakken behouden, maar ze
duidelijker richten op vinden, begrijpen en opvolgen.

De actieve architectuur-decompositie noemt UX- en copywijzigingen als
non-goal. Deze beslissing overschrijft uitsluitend die UX-beperking voor dit
afgebakende productwerk; de interne renderer- en mutation-refactor blijven
gedragsbehoudend en worden niet stilzwijgend uitgebreid.

## Decision

1. De drie primaire surfaces behouden hun bestaande technische rol, maar
   krijgen deze gebruikerslabels:

   - `Netwerk` — relaties en netwerk begrijpen;
   - `Personen` — personen vinden en overzien;
   - `Opvolging` — zien waar actie nodig is.

2. De netwerkcontext wordt in gewone taal weergegeven. Bij een actief centrum
   toont de UI `Netwerk rond: <weergavenaam>`. De naam is uitsluitend
   presentatie; center-resolutie blijft gebaseerd op stabiele `person_id` of
   een expliciet padresultaat.

3. De eerste gebruikersscope bestaat uit:

   - `Directe relaties`: ego-projectie met exact één hop;
   - `Alles`: free-network-projectie.

   De bestaande opgeslagen twee-hop-waarde blijft veilig leesbaar, maar de
   vereenvoudigde UI exposeert die technische waarde niet als directe relaties.
   Een eventuele geavanceerde twee-hop-keuze valt buiten deze eerste UX-slice.

4. `Alle personen` wordt geen concurrerende permanente knop. De functionaliteit
   wordt onderdeel van de scopekeuze. Het wijzigen van scope blijft expliciet
   en wijzigt geen vault-notes.

5. Er blijft één zichtbare `Passend maken`-actie over. Zoom, pan, Enter, Escape,
   pointer capture en keyboardfallback blijven behouden. Zoom-controls mogen
   naar een secundaire bediening zolang de interactie bereikbaar blijft voor
   keyboard en touch.

6. De personenzoekfunctie matcht in de eerste versie de zichtbare naam,
   functie/titel en organisaties. De zoekfunctie filtert de huidige
   personenprojectie; typen verandert niet automatisch center, scope of
   graph-camera. Selectie gebruikt uitsluitend stabiele node-ID’s.

7. De grafiek toont standaard geen labels op iedere edge. De betekenis van een
   geselecteerde verbinding wordt contextueel getoond in de bestaande
   relationele detailrows. Inferred links blijven visueel en tekstueel
   onderscheiden van note-backed relaties. Graph-edge-selection wordt niet
   toegevoegd.

8. Eén gedeelde persoonsdetailcompositie wordt leidend voor standalone,
   renderer en Bases. De kernvolgorde is naam, functie/context, organisatie,
   relevante relaties, laatste expliciete contactdatum en opvolging. `Contact
   vastleggen` is de primaire actie; beheeracties blijven beschikbaar als
   secundaire acties.

9. De globale tekst `N personen · M verbindingen` verdwijnt uit de primaire
   toolbar. Dezelfde cijfers mogen later alleen terugkomen in een context waar
   hun scope expliciet en conceptueel nuttig is. Er wordt geen technisch aantal
   getoond dat de gebruiker voor een andere dataset kan aanzien.

10. `Laatste contact` betekent in deze UX-slice de meest recente expliciete
    contactmomentdatum die beschikbaar is binnen de huidige snapshotcontext.
    Het is geen automatische statuswijziging en wordt niet als nieuw
    person-level opslagveld geïntroduceerd.

11. Nieuwe UX gebruikt bestaande Obsidian-controls, CSS-variabelen,
    `AtlasSnapshot`, stable-ID-resolutie, owning `Window`/`Document` en de
    bestaande mutation boundary. Er komt geen nieuw design system, geen
    graph-store en geen verborgen vault-write.

## Alternatives considered

### Alle graph-edges permanent labelen

Dit maakt relatiebetekenis direct zichtbaar, maar veroorzaakt visuele ruis,
overlap en een nieuwe legenda-/label-lifecycle op canvas. Verworpen ten gunste
van contextuele relation rows.

### Eén technische dropdown behouden met betere vertalingen

Dit vermindert codewijzigingen, maar laat center, scope en projection nog steeds
als implementatieconcepten in het primaire pad staan. Verworpen.

### De huidige twee-hop-ego-weergave `Directe relaties` noemen

Dit zou copy wijzigen zonder dat het gedrag klopt. Verworpen; directe relaties
betekenen in deze beslissing exact één hop.

### Zoekresultaten automatisch tot center maken

Dit maakt typen een state-changing actie en kan graph-camera, scope en selectie
onverwacht wijzigen. Verworpen; selectie is expliciet.

### Global counts behouden met hidden-count-details

Dit vraagt extra uitleg en vergroot dashboardgevoel. Verworpen voor de primaire
toolbar; contextuele aantallen kunnen later afzonderlijk worden onderzocht.

## Consequences

- De scope-UI wordt eenvoudiger, maar de bestaande twee-hop-instelling blijft
  een compatibiliteitsdetail dat niet meer als primaire copy kan worden gebruikt.
- Search is aanvankelijk beperkt tot het snapshotaanbod en de drie zichtbare
  persoonsvelden; alias-search vraagt later een expliciete snapshotuitbreiding.
- De standalone-detailweergave moet worden aangepast om niet langer een
  afwijkende relatiepresentatie te onderhouden.
- Tests moeten vooral semantische scope-, count-, selectie- en focuscontracten
  vastleggen; een screenshot alleen is onvoldoende bewijs.
- De bestaande active architecture-refactor blijft geldig voor zijn interne
  seams, maar UX-wijzigingen krijgen een eigen parent en child tickets.

## References

- `.10x/specs/people-atlas-kiss-ux.md`
- `.10x/specs/accessible-semantic-renderer.md`
- `.10x/specs/projection-modes-layout-state.md`
- `.10x/specs/contact-moments-follow-up.md`
- `.10x/specs/person-profile-experience.md`
- `.10x/specs/relationship-context-actions.md`
- `.10x/tickets/2026-08-09-architecture-decomposition.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
