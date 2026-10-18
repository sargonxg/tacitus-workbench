# Local manifest import (Linux)

This CLI imports a declared collection of local UTF-8 text/Markdown files. It
produces a content-addressed lexical source index covering every declared source
and separate bounded native capsules containing only explicitly authored proposals.
It does not fetch URLs, run a model, extract facts, infer entities/relations,
read PDF/OCR/archives, create a graph store or run a hosted service.

A document without `authoring` remains source-only, labeled **no semantic
assertions authored**. No annotations or graph relationships are invented to make
it fit a native capsule. An authored document currently requires the existing
single-source profile: two attributed reported statements, unique single-line
exact quotations, one common declared actor/institution/event, and one explicit
`contradicts`, `supersedes` or `depends_on` relation/direction/rationale. Cross-source
relations and combined cross-capsule native queries are unsupported.

## Install and execute

Use the root README's clean-clone Node24 install and pinned Rust1.95.0 core build.
`scripts/build-core.sh /tmp/tacitus-build` now also compiles `batch_author`, a
workbench-owned adapter using the unchanged Capture/fingerprint/pack/inspect
contracts. There are no new package dependencies, native schema or core changes.
Original application rights remain reserved; upstream Apache and source-data
notices remain unchanged. No new rights grant is made.

```sh
export TACITUS_KNOWLEDGE_CAPTURE_BIN=/tmp/tacitus-build/core-build/target/debug/examples/knowledge_capture
export TACITUS_KNOWLEDGE_CAPTURE_SHA256="$(sha256sum "$TACITUS_KNOWLEDGE_CAPTURE_BIN" | cut -d ' ' -f 1)"
export TACITUS_BATCH_AUTHOR_BIN=/tmp/tacitus-build/core-build/target/debug/examples/batch_author
export TACITUS_BATCH_AUTHOR_SHA256="$(sha256sum "$TACITUS_BATCH_AUTHOR_BIN" | cut -d ' ' -f 1)"
python3 tools/local-import/import_collection.py --root /absolute/source-directory \
  --manifest manifest.json --output /absolute/new-collection-directory
```

The source root and output parent must already be real directories. The output
must be new; it is never overwritten. The manifest path is relative to the source
root, as are source paths. File and directory symlinks, traversal, absolute source
paths, FIFO/devices and unsupported extensions refuse. No source filename is used
as a generated output path. Linux `O_NOFOLLOW`, `/proc` and atomic no-replace
`renameat2` are required; this optional CLI does not change the existing UI flow.

## Manifest

```json
{
  "format": "tacitus-local-import/1",
  "collection": "My declared collection",
  "author": "Batch operator",
  "sources": [
    {
      "key": "stable-logical-key",
      "path": "notes/source.md",
      "sha256": "REPLACE_WITH_EXACT_FILE_SHA256",
      "title": "Source title",
      "author": "Declared source author",
      "provenance": "User-declared reference; never fetched",
      "rights": "Your declared rights/redistribution basis",
      "language": "en",
      "confirms_rights": true
    }
  ]
}
```

This example is source-only. Calculate each file's SHA-256 with `sha256sum` after
reviewing its exact bytes. `key` is stable within a named collection; duplicate
keys refuse. The generated source ID hashes collection+key, while an independent
revision hashes exact content SHA-256 and declarations, including explicit
annotations. Relocating an unchanged file under the same key does not change its
identity. Text is read as exact UTF-8 bytes: BOM, CRLF, multibyte characters and
literal markup remain unchanged. Invalid UTF-8, empty/NUL text and unexpected
fields refuse. All manifest and source declarations are untrusted, unreviewed
metadata; the importer does not verify authorship, rights or historical truth.

For an authored source, add this `authoring` object to its entry:

```json
{
  "annotationAuthor": "User declaring these annotations",
  "entityKind": "institution",
  "entityLabel": "Explicit common entity",
  "relation": "depends_on",
  "direction": "a-b",
  "rationale": "Your explicit defensible relation rationale",
  "annotations": [
    {
      "quote": "One exact unique source-line fragment",
      "proposition": "Your explicit unreviewed reported-statement annotation",
      "speaker": "Attributed source speaker",
      "modality": "Declared qualification",
      "conditions": "One condition per line",
      "exceptions": "One exception per line"
    },
    {
      "quote": "Another exact unique source-line fragment",
      "proposition": "Your second explicit reported-statement annotation",
      "speaker": "Attributed source speaker",
      "modality": "Declared qualification",
      "conditions": "",
      "exceptions": ""
    }
  ]
}
```

The batch operator, source author, annotation author and quoted speaker remain
separate. Native manifest limitations retain an explicitly labeled JSON
source-ID@version → unverified annotation-author declaration for each authored
source; native Context exports retain that manifest. Lexical source metadata and
the collection manifest retain `annotation_author` separately as provenance,
without exporting semantic assertions into the lexical index. World validity,
publication and observations remain unknown; actor knowledge is empty. The
checkpoint records declared modern ingestion; a user-supplied checkpoint is
reproducibility metadata, not authenticated historical availability or actor knowledge. `--checkpoint <UTC-seconds>` supports
reproducible inputs; it must not be more than five minutes in the future.

## Output and use

`manifest.json` records `complete: true`, every source and semantic status,
source-only IDs, native capsule membership/identities, duplicate-content groups,
revision lineage, local removal/replacement tombstones and hashes of all output
files. “Complete” covers the declared manifest, not every file in the input folder.
A validation or packing failure emits `complete: false` diagnostics and publishes
no final directory. Source and annotation failures include source indices/keys;
no valid subset is silently presented as the whole collection.

Search all sources using the bundled unchanged lexical consumer:

```sh
printf '%s' '{"question":"your terms","max_bytes":32768}' | \
  python3 /absolute/new-collection-directory/query/collection.py query \
  /absolute/new-collection-directory/lexical
```

That output is lexical source JSON, not native Context, reviewed claims or a
model answer. The existing tokenizer ignores tokens of length two or less and
provides no CJK word segmentation. Preserved multilingual bytes do not establish
general multilingual search coverage; an omission-only result is not proof of
absence of evidence. Query budgets are 2,048–250,000 bytes with explicit omissions.

Import an individual ZIP from `native/` through the existing workbench native file
picker, inspect it, use its recorded checkpoint and query/export exact Context.
The capsules are independently bounded snapshots; the UI does not query all
capsules at once. Duplicate content with different logical identities/provenance
is preserved and flagged, not treated as independent corroboration. Source-only
documents appear in lexical search and the manifest, not in native graphs.

## Incremental reuse, persistence and interruption

```sh
python3 tools/local-import/import_collection.py --root /absolute/source-directory \
  --manifest manifest.json --previous /absolute/previous-collection \
  --output /absolute/new-collection
```

Reuse is explicit across separate CLI invocations, including after a process
restart. Versions/lineage belong to that explicit snapshot chain, not a global
registry; a fresh import without `--previous` cannot know older exports. Previous artifact paths must be regular, bounded and hash verified.
Lexical rows eligible for reuse are independently reconstructed from current
exact source text and the pinned tokenizer; internally consistent forged hashes
cannot authorize falsified terms. Reused native ZIPs are inspected by the current
pinned core and compared to freshly reconstructed source bytes, assertions,
graph, observations and manifest. Producer identity binds all importer/authoring
modules and the shipped lexical bundle/preparer; incompatible producers refuse.
These are integrity checks, not signature-based authentication of a prior owner.

Unchanged declarations retain ingestion checkpoints/versions, yielding byte-exact
manifests and capsule reuse. Changes increment source versions and emit replaced
receipts; removals emit removed receipts. Retained lineage prevents a removed
logical identity from silently restarting at version 1 when re-added. At most 1,024
logical identities are retained over a collection's lifetime; reaching that bound
refuses and requires an explicitly separate collection. Tombstones describe local
snapshot differences. They do not revoke old exports, delete previous directories
or erase downloaded copies. Native chunk membership can shift when authored
sources are added/removed, rebuilding affected chunks without semantic inference.

Staging uses private local files and a final atomic no-replace rename. SIGINT,
SIGTERM and ordinary failures clean the stage. SIGKILL, power loss or a process
crash can leave a hidden `.OUTPUT.stage-*` directory; no incomplete final output
is exposed. If killed after the atomic commit, a valid complete output can exist
even if no success receipt was printed; inspect its manifest before retrying. Files/directories remain on disk until you explicitly delete them.
Private mode and `private` metadata do not encrypt the included full source text.
No background database, implicit current-pointer update or remote persistence is
implemented. Do not place output in a directory managed by an untrusted writer.

## Bounds and actual acceptance

The importer accepts at most 256 files, each 32 KiB and 8 MiB source bytes total;
input manifest 8 MiB, output manifest 1 MiB, total output 64 MiB and individual output
files 2 MiB. Native chunks contain at most 25 sources/50 assertions/25 declared
nodes/25 declared links, and 1 MiB serialized capture and ZIP each. The pinned
native contract independently enforces 32 sources/256 assertions, 256 nodes/512
links, 2 MiB graph JSON/entry, 64 ZIP entries and 8 MiB archive limits. Packing refuses
if any bound is exceeded. Splitting is deterministic by stable source ID and
actual capture bytes; no source/annotation is silently truncated. Native and
lexical queries can omit evidence under their explicit output budgets.

```sh
TACITUS_BATCH_AUTHOR_BIN="$TACITUS_BATCH_AUTHOR_BIN" \
TACITUS_KNOWLEDGE_CAPTURE_BIN="$TACITUS_KNOWLEDGE_CAPTURE_BIN" \
python3 -m unittest discover -s tools/local-import/tests -v
```

Real-native tests require both executables; without them the native cases are
explicitly skipped. These tests supplement the unchanged root README's default
and full UI acceptance commands. See `VERIFICATION.md` for the actual 128-document
result and independent reviews. Maximum 256-document capacity, every combined
worst-case byte boundary, storage crash durability and non-Linux behavior have
not been stress-tested. The 128-document fixture and 26 near-source-limit byte
sharding case establish bounded behavior, not universal scale, production
readiness or answer-quality gains.
