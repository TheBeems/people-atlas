# Permitted populations and reviewed payloads

Status: active
Created: 2026-10-03
Updated: 2026-10-03

## Snapshot boundaries

The permitted full snapshot is the original source population admitted by a
standalone view or Base. Historical relationship filtering happens before graph
projection, so ended/future edges cannot admit people through ego traversal.
Current-view browsing uses that projected graph. Explicit all-permitted browsing
and attention use the original full snapshot; a historical network date must not
erase a currently active cadence suggestion from that inbox. Network comparisons
still explicitly use the chosen relationship date.

Contact moments are observations, not topology. The projection accepts original
permitted relationship evidence to validate a linked moment while still requiring
all participants and relationship endpoints to be visible. It cannot widen Base
admission or introduce an inferred relationship.

Custom Base person IDs may enrich graph endpoint resolution, but cannot replace
canonical contact-moment authority. Keep the canonical observation population
separate from the canonical-plus-mapped graph resolver in delta options. Full and
delta builds must retain the same valid canonical observations and reject a
moment referring only to a custom mapped ID, even after a relationship changes.

## Diagnostic admission

A Base can admit a Markdown row that fails person parsing, such as a missing-ID
note. Keep exact admitted diagnostic-entry paths separate from valid graph-person
paths. Changes, removal or admission changes to invalid rows invalidate adapter
diagnostics even when the valid-person set is unchanged.

Canonical duplicate IDs remain ambiguous even if a Base admits one of their
sources. Preserve generic structural duplicate evidence on admitted exact paths;
discard excluded path, target and message details. A repair modal keeps the same
scope for error presentation, while global uniqueness validation still scans
actual source. A hidden source blocker must fail closed without leaking details.

An omitted relationship edge does not always mean its diagnostic is outside the
Base. Retain a broken relationship's exact source only with a unique admitted
person anchor and endpoint resolution matching actual admitted people or an
already represented stable author-reference ghost. Use current canonical plus
mapped output people for both full and delta resolution. Display labels never
grant admission; a target later resolving to an excluded or ambiguous person
cannot retain admission through a stale ghost.

## Review and persistence

A mutable preview or rendered record is not an immutable approval. Copy rendered
action inputs and privately bind the complete reviewed payload separately from
its source baseline. Detach settings mappings before asynchronous source scans.
Use the approved payload across queue, read, atomic callback and post-save result
publication; continue checking live source/mapping/identity drift before writing.

Settings recovery returns the canonical saved payload for runtime publication.
Reading mutable preview fields again after persistence can make runtime differ
from disk even when the saved write itself was safe. Exact original plugin-data
text remains in its local recovery envelope through subsequent settings/view
state saves; it does not authorize moving or migrating notes.

Exact original text needs a read of the hidden own-plugin data file, not a
serialization of parsed loadData() output. Its dedicated public adapter reader
accepts no path/ID input and reads only configDir/plugins/people-atlas/data.json.
The source policy permits that exact module shape and retains all other adapter
bans; negative fixtures prevent a filename-only exemption or an alias workaround.
Validate the dedicated module shape unconditionally, even when the older literal
adapter-access regex matches nothing.
Startup and settings writes still use loadData()/saveData().

## Evidence and scope

These boundaries were independently reviewed in
`.10x/tickets/2026-10-03-product-source-review.md`, with focused source, browser and
controlled-host regressions in the discovery, recovery, periods and attention
child tickets. Integrated test/build evidence belongs to
`.10x/tickets/2026-10-03-integration-validation.md`. Synthetic host results are not
native Obsidian, mobile or real-vault acceptance.

An inline CSS style string uses the owning browser's CSSOM serialization, which
can round a fractional JavaScript decimal while preserving the measured layout.
Assert expected style text through that native serialization, and independently
retain exact measured CSS geometry, DPR backing dimensions, actual pixel and
selection checks. Do not force integer production geometry or loosen pixel
assertions to satisfy an incidental string-format assumption.

Fractional CSS extents can also round up the canvas backing dimensions. Paint
the background at identity transform across the actual backing width/height,
then restore the DPR transform before camera and graph drawing. Filling only
CSS extents under DPR may leave the last backing row partially transparent.
The fractional DPR matrix retains exact alpha-255 corner checks to catch this.
