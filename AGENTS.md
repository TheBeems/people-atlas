# Codex instructions for People Atlas

## 10x workflow

The authoritative in-repository 10x skill is
`.agents/skills/10x/SKILL.md`. Read it before any non-trivial shaping or
execution; it governs project memory, specs, tickets, evidence, reviews,
closure and retrospectives for this repository.

## Goal

Build a durable, Bases-native, Markdown-first people and relationship plugin for Obsidian 1.13+.

## Non-negotiable domain rules

- Never identify a person by display name.
- Prefer explicit `person_id`; use a normalized file-path fallback only when needed.
- Store rich relationship metadata on relationship notes, not on person notes.
- Treat unresolved wikilinks as diagnostics or ghost nodes; do not guess.
- Do not silently merge duplicate people.
- Keep all vault writes explicit and reviewable.

## Architecture rules

- Parsing belongs in `src/index/`.
- Pure graph transformations belong in `src/graph/` and must not import `obsidian`.
- Rendering belongs in `src/render/` and must not read vault data.
- Standalone and Bases views must use the same `AtlasSnapshot` contract.
- Register Obsidian events through `registerEvent()` and DOM events through lifecycle-owned cleanup.
- Use the view's owning `Window`; do not assume the global `window` belongs to the view.
- Use Obsidian CSS variables; do not hard-code a theme.
- Keep `onload()` light. Defer indexing until layout is ready.
- Code using these principles: DRY, KISS and YAGNI.

## When principles collide
- DRY versus KISS: KISS sets the ceiling on how hard you push DRY; 
- DRY versus YAGNI: The rule of three says wait for the third occurrence before abstracting;

## Quality gate

Before declaring work complete:

```bash
npm run test
npm run build
```

Add tests for every pure transformation and every repaired regression.
