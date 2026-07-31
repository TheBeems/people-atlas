Status: active
Created: 2026-07-26
Updated: 2026-07-30

# P5a — Accessible semantic renderer

## Purpose

Make every projected People Atlas graph operable and understandable without
requiring pointer interaction with the canvas. The canvas remains the visual
surface, while a shared semantic list exposes the same people, relationships,
selection and actions through native controls.

This is the first bounded P5 slice. It establishes the renderer interaction
and browser-test boundary that later touch/mobile work can extend without
changing graph identity, projection or persisted layout semantics.

## Scope

This specification governs:

- a discoverable Graph/List mode control owned by the shared renderer;
- one semantic people list and selected-person relationship detail surface;
- keyboard navigation, selection synchronization and focus recovery;
- explicit Open note, Use as center and Create relationship actions;
- relationship descriptions derived from the current `AtlasSnapshot`;
- reduced-motion-safe mode changes and owning-window correctness;
- real-browser interaction coverage through Vitest Browser Mode and
  Playwright Chromium.

The contract applies equally to standalone and Bases views. It consumes only
the current `AtlasSnapshot`, renderer callbacks and owning DOM objects; it does
not read vault data, parse frontmatter or write notes.

## Normative contract

### Graph and List modes

1. Every renderer instance MUST expose an always-visible native mode control
   labelled `View` with `Graph` and `List` choices.
2. `Graph` MUST be the default when a renderer instance is constructed.
   Changing the mode MUST remain local to that renderer lifetime and MUST NOT
   be persisted in plugin or vault data.
3. Calling `setGraph()` MUST preserve the current mode. Reconstructing the
   renderer MAY reset it to the `Graph` default.
4. Exactly one content surface MUST be visible and keyboard-reachable at a
   time. In Graph mode the canvas is shown and the semantic panel is hidden
   from layout, focus order and the accessibility tree. In List mode the
   semantic panel is shown and the canvas is hidden from layout, focus order
   and the accessibility tree.
5. Switching modes MUST preserve the current selected stable `NodeId`, camera
   and node positions. It MUST NOT invoke a layout-persistence callback or
   change the projection center.
6. Existing canvas pointer selection, pan, drag, wheel zoom, open and center
   behavior MUST remain available in Graph mode. List mode MUST provide the
   complete non-pointer alternative defined below.

### Semantic people list

7. List mode MUST render the projected nodes as one native list in the order
   supplied by `AtlasSnapshot.nodes`. Display labels MAY be shown, but node
   lookup, selection and actions MUST use stable `NodeId` and MUST NOT identify
   a person by display name.
8. Each node MUST be represented by a native button. Its accessible content
   MUST distinguish a resolved person from an unresolved ghost and MAY include
   the person's organizations as presentation metadata.
9. The people list MUST use one roving tab stop. The selected node is the tab
   stop when it is still present; after selection is explicitly cleared, the
   currently focused node remains the tab stop. If neither exists, the first
   node is the tab stop.
10. With focus in the people list:
    - `ArrowDown` and `ArrowUp` MUST move to the adjacent node when one exists;
      focus MUST NOT wrap at either boundary;
    - `Home` and `End` MUST move to the first and last node;
    - moving focus MUST also select that node through the existing selection
      callback, but MUST NOT center or open it;
    - `Enter` MUST invoke Open note for a resolved person with a file path;
    - native `Space` activation MUST select the focused node;
    - `Escape` MUST clear selection without moving focus out of the list.
11. A ghost or otherwise non-openable node MUST remain selectable. `Enter`
    MUST make no open callback for it, and the semantic surface MUST state that
    no note is available.
12. List keyboard handling MUST NOT introduce unmodified printable-character
    shortcuts.

### Selection and focus lifecycle

13. Canvas and List modes MUST share one selection. Selecting through either
    surface MUST update the other surface and the existing owning-view
    selection UI without changing node identity.
14. `setGraph()` MUST preserve selection and the roving tab stop by stable
    `NodeId` when that node remains present. It MUST NOT steal focus merely
    because graph data changed.
15. If the selected node disappears, selection MUST be cleared through the
    existing callback. If the removed node held DOM focus in List mode, focus
    MUST move to the first remaining node, or to the `List` mode control when
    the new graph is empty.
16. An empty graph MUST show a visible `No people in the current atlas`
    message. The mode control MUST remain operable.

### Relationship descriptions

17. When a node is selected, List mode MUST show a separate native list of
    every incident edge in `AtlasSnapshot.edges`, preserving snapshot order
    and parallel edges as distinct relationship items.
18. Each relationship item MUST resolve its counterpart by endpoint
    `NodeId`. Display labels are presentation only and MUST NOT merge or
    identify endpoints.
19. A relationship with complete endpoint roles MUST use the selected
    endpoint's role and the configured role format, substituting the
    counterpart as plain text. Otherwise it MUST use the neutral
    `Connected to <counterpart>` fallback. It MUST NOT expose Incoming,
    Outgoing, source, target or stored endpoint order.
20. A relationship item MUST include, when present, relationship types,
    explicit status, `since` and `last_contact`. Missing optional values MUST
    be omitted rather than replaced with guessed values.
21. Explicit `active`, `dormant` and `ended` status MUST be reported exactly as
    stored. Dates MUST NOT infer or alter relationship status.
22. An inferred contact edge MUST be identified as a contact-link connection;
    it MUST NOT be presented as a rich relationship note. Unresolved
    counterparts MUST be labelled as unresolved.
23. A selected node with no visible incident edges MUST show
    `No visible relationships`.

### Explicit actions

24. The selected-node detail surface MUST expose native `Open note` and
    `Use as center` buttons only for a resolved person with a file path.
    Invoking them MUST delegate to the existing renderer callbacks.
25. Selecting a canonical writable person MUST continue to expose the
    existing native `Create relationship` action in both standalone and Bases.
    The owning view remains responsible for canonical-index eligibility and
    for opening the shared relationship modal; the renderer MUST NOT read the
    index or write the vault.
26. Ghosts and ambiguous records MUST NOT acquire Open, Center or Create
    relationship capabilities through display labels or list position.
    A resolved Base-only node with a stable ID and file path MAY retain Open
    and Center, but MUST NOT acquire Create relationship unless the owning
    view's canonical-index guard accepts it.
27. Action buttons MUST have visible focus indication and meet at least the
    WCAG 2.2 minimum target-size or spacing requirement. Complete touch-sized
    controls remain P5b scope.
28. Opening the relationship modal MUST retain P3b's explicit Save/Cancel
    contract. Selection or focus alone MUST never write a note.

### Dynamic updates, motion and window ownership

29. List mode MUST expose a concise visible graph summary with people and
    relationship counts. Graph-data changes MAY update a polite status region
    but MUST NOT repeatedly announce unchanged content.
30. Mode changes, selection and focus movement MUST NOT depend on animation.
    Any introduced transition MUST honor `prefers-reduced-motion`.
31. DOM creation, computed style, animation frames, resize observation and
    event ownership MUST use the renderer container's owning `Document` and
    `Window`. The renderer MUST NOT fall back to the global `window`; if no
    owning window exists, construction MUST fail before listeners are bound.
32. `destroy()` MUST remove every renderer-owned DOM node, listener, observer
    and pending animation frame from that owning window.

### Browser verification boundary

33. The existing Node-based Vitest suite MUST remain available for pure graph,
    index, mutation and state contracts.
34. Renderer interaction tests MUST run in a real Chromium browser through
    Vitest Browser Mode with the Playwright provider. They MUST use real
    browser focus and input APIs rather than manually dispatching synthetic
    keyboard or pointer events as the primary assertion path.
35. `npm run test` MUST execute both the existing Node project and the new
    browser project. A focused `npm run test:browser` command MUST be
    available for renderer work.
36. Browser coverage MUST include mode visibility, roving focus, every
    specified key, selection synchronization, action availability, empty and
    disappearing-node recovery, relationship text, parallel/inferred edges,
    reduced-motion behavior, cleanup and a renderer mounted in a secondary
    same-origin owning window or frame.

## Given/When/Then scenarios

### Discover and enter List mode

Given a new renderer with a projected graph

When it is constructed

Then Graph mode is selected, the Graph/List control is visible, and activating
List shows the semantic panel without changing selection or layout.

### Navigate without tabbing through every person

Given List mode contains Alice, Bob and Charlie in snapshot order

When focus enters on Alice and the user presses `ArrowDown`, `End`, `Home`

Then focus and selection move to Bob, Charlie and Alice respectively, with one
people-list tab stop and no projection-center change.

### Open only a resolved person

Given one resolved person and one unresolved ghost are selectable

When `Enter` is pressed on each

Then the resolved person's open callback fires exactly once, while the ghost
remains selected, invokes no open callback and is described as having no note.

### Describe explicit and inferred relationships

Given a selected person has a role-labelled relationship, a roleless rich
relationship note, an incomplete-role rich relationship and an inferred
contact link

When List mode renders its relationship details

Then all four edges remain distinct, the complete endpoint role is relative
to the selected person, roleless and incomplete-role relationships use the
neutral Connected fallback, explicit metadata is preserved, and the inferred
edge is labelled as a contact link without an inferred status.

### Keep focus through graph updates

Given Bob is selected and focused in List mode

When a new snapshot still contains Bob

Then Bob remains selected and focused. When a later snapshot removes Bob,
selection clears and focus moves to the first remaining node without using a
display name as fallback.

### Preserve canonical create eligibility

Given a canonical person, a ghost and a Base-only non-canonical person

When each is selected from List mode

Then only the canonical person exposes the owning view's Create relationship
action, and merely selecting any item writes nothing.

### Use an owning secondary window

Given the renderer is mounted in a same-origin secondary document

When it resizes, receives focus and is destroyed

Then it uses that document's window APIs, remains interactive and leaves no
renderer-owned listener, observer or animation frame behind.

## Acceptance criteria

- [ ] A visible native Graph/List control switches one renderer between the
      canvas and semantic panel, defaults to Graph per renderer lifetime and
      does not persist or disturb layout/selection.
- [ ] The semantic people list uses stable `NodeId`, snapshot order, native
      buttons and one roving tab stop with the specified key behavior.
- [ ] Canvas and List selection stay synchronized; snapshot updates preserve
      or recover focus by stable identity without stealing focus.
- [ ] Empty, ghost and disappearing-node states remain operable and never
      guess a person or invoke unavailable callbacks.
- [ ] Selected-node details enumerate every incident edge, preserve parallel
      edges and accurately describe endpoint roles or the neutral Connected
      fallback, types, explicit status, dates and inferred contact links.
- [ ] Resolved people expose native Open and Center actions; existing
      canonical Create relationship actions remain reachable in standalone
      and Bases without adding a renderer vault/index dependency.
- [ ] Mode changes and actions use visible focus, minimum target sizing and
      reduced-motion-safe behavior.
- [ ] Renderer DOM and lifecycle APIs use the owning window and clean up
      completely, including in a secondary same-origin window or frame.
- [ ] Vitest has separate Node and Playwright-backed Chromium projects;
      `npm run test:browser` is focused and `npm run test` runs both.
- [ ] Real-browser regressions cover the normative interaction, semantic text,
      focus recovery, action, reduced-motion, secondary-window and cleanup
      scenarios.
- [ ] Existing graph, projection, mutation and view-state tests remain
      passing.
- [ ] `npm run test`, `npm run build` and `git diff --check` pass.

## Error behavior

- If a selected or focused stable node disappears, the renderer clears it and
  follows the focus recovery contract; it MUST NOT search by label.
- If an edge endpoint is absent from the projected nodes, the semantic surface
  MUST omit that inconsistent edge from actionable detail and expose no
  guessed counterpart. Existing graph diagnostics remain authoritative.
- If no owning `Window` exists, renderer construction fails before any
  listener, observer or animation frame is registered.
- Browser-harness setup or browser launch failure is a failed acceptance gate,
  not permission to replace the browser checks with Node DOM simulation.

## Exclusions

- Pinch zoom, one-finger touch pan, long press and gesture arbitration.
- Mobile bottom-sheet controls and the complete mobile viewport workflow.
- Persisting Graph/List mode or adding another plugin-data migration.
- Adding a dependency lockfile or other P8 release-hardening work.
- Custom context menus, ARIA menus, relationship-edge selection or opening
  relationship notes from the graph.
- Screen-reader product certification or live assistive-technology coverage;
  those remain a P7/manual validation gate.
- Force simulation, Web Workers, image decoding/cache, clustering and
  performance thresholds.
- New projection modes, automatic status/follow-up inference or vault writes.

## Ratified and record-backed decisions

1. **Visible alternative.** User-ratified on 2026-07-26: expose a permanent
   native Graph/List control, default to Graph and keep the choice
   session-local in P5a.
2. **Keyboard and actions.** User-ratified on 2026-07-26: use one people-list
   tab stop with arrow/Home/End navigation, `Enter` to open, `Escape` to clear
   selection and explicit native Center/Create relationship actions rather
   than a custom context menu.
3. **Relationship content.** The 2026-07-26 compact selected-person
   relationship list remains, superseded on 2026-07-30 only for its fallback:
   show the explicit endpoint role when complete, otherwise neutral
   `Connected to <counterpart>`, followed by types, explicit status, `since`
   and `last_contact` when present; never infer roles or status.
4. **Identity and storage.** Record-backed: `AtlasSnapshot` stable IDs and
   explicit relationship edges are authoritative; display names are
   presentation only and rich metadata remains on relationship notes.
5. **Verification.** The project already uses Vitest 4. Official Vitest
   Browser Mode guidance observed on 2026-07-25 recommends its Playwright
   provider for real browser input and focus behavior:
   `https://vitest.dev/guide/browser/`.
6. **Native controls.** W3C button and keyboard guidance observed on
   2026-07-25 supports native buttons and conventional focus behavior:
   `https://www.w3.org/WAI/ARIA/apg/patterns/button/` and
   `https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/`.
7. **Target sizing.** WCAG 2.2 minimum target-size guidance observed on
   2026-07-25 is the P5a floor:
   `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum`.
