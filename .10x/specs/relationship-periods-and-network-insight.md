Status: active
Created: 2026-10-03
Updated: 2026-10-03

# Explicit relationship periods, contact cadence and network insight

## Authority and data

The user authorized the preceding recommendations. Optional rich relationship
metadata stays on relationship notes. Dates/cadence are explicit input and never
automatically set status, roles, closeness, last_contact or new relationships.

- Add optional mapped relationship end date, default property until; accept a
  valid full calendar date, blank removes it, and when since exists until MUST
  not precede since. Invalid authored values produce diagnostics and no coercion.
- Add optional mapped contact interval in positive whole days, default property
  contact_interval_days. Blank means no desired cadence. Due dates use explicit
  observed contact dates; never invent a last contact for unobserved relationships.
  Ended relationships are not contact-cadence suggestions.
- Parser, snapshot, delta, editor, source guard, mutation validation and settings
  mappings MUST preserve new fields and unrelated data. Old notes stay unchanged.
- Optional read-only date filtering can show which explicitly dated relationships
  existed at a chosen valid date, with inclusive since/until. No dates means unknown
  bounds, not an inferred date. Contacts remain explicit observations.

## Graph insight

- Add pure deterministic shortest-path and mutual-neighbor transformations keyed
  by stable canonical IDs. Exclude ghost/ambiguous people; distinguish note-backed
  relationships and Linked people in results. Use existing edges, never infer new
  relationships. Return meaningful same-person/disconnected/invalid cases.
- Expose an explicit counterpart picker and accessible path/common-contacts result
  in the shared UI for standalone and Bases within the permitted current dataset.
- Offer optional Family layout derived solely from explicit parent/child roles.
  Display direction comes from those roles while the stored graph stays direction-
  free. Siblings/partners do not imply parents. Cycles/conflicting generations and
  unrelated components fall back deterministically without unbounded traversal.
- Keep the existing radial layout as default and persist the explicit layout
  choice per view with old schema-1 states still accepted. No force simulation.
- Bases options MUST use supported native dropdown controls for bounded choices,
  translated user labels and validated numbers. Preserve existing config keys.
  Add usable Base examples for family/work/follow-up using native saved views and
  filters; never reinterpret Bases ordering as canonical identity.

## Validation

Regression tests cover date boundaries/leap dates/reversed periods, invalid cadence,
owned-field source drift/preservation, snapshot/delta equivalence, deterministic
path/parallel-edge/cycle/ambiguity behavior, family-layout bounds, persistence,
translated native options and controlled UI/Bases population fences.

## Exclusions

No name identity, graph-derived relationships, automatic status changes, network
requests, workers, external reminders or live-vault changes.

## References

- .10x/specs/perspective-relationship-foundation.md
- .10x/specs/relationship-edit-source-safety.md
- .10x/specs/projection-modes-layout-state.md
- .10x/specs/safe-mutations-and-versioned-data.md
