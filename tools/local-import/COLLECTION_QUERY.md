# Query an imported native collection

`query_collection.py` queries every native capsule in one imported collection
with the same question, checkpoints and validity policy. It returns a versioned
**collection receipt**, with each exact native Context response stored separately.
It does not create a merged Context, infer cross-capsule links, resolve conflicting
assertions, rank evidence globally or generate an answer. Source-only documents
remain in the lexical index and are explicitly excluded from this native query.

## Run

Use the root clean-clone workflow and the [manifest importer](README.md). No new
package, native schema or core change is needed. The core remains pinned to
`6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`. Querying a compatible existing
importer output needs only Python/Linux and the reviewed `knowledge_capture`
executable; it does not need the batch helper or a provider/model. Existing
PR10-format collections remain readable even if their recorded importer producer
hash differs from the current code. The outer `producer_sha256` identifies that
source collection producer; it is not a signature of the query implementation. Incremental importing still requires a
compatible producer as documented separately.

Set the same verified core path/digest used by the collection, and create a local
request file:

```json
{
  "format": "tacitus-native-collection-query/1",
  "manifest_sha256": "REPLACE_WITH_TRUSTED_EXACT_MANIFEST_FILE_SHA256",
  "snapshot_sha256": "REPLACE_WITH_COLLECTION_SNAPSHOT_SHA256",
  "question": "your question",
  "known_as_of": 1792356639,
  "valid_at": 1792356639,
  "time_mode": "disclose_unknown",
  "max_bytes": 250000,
  "revoked_sources": [],
  "revoked_capsules": []
}
```

Use the actual collection checkpoint(s), not this example value: `known_as_of`
must cover every native capsule's ingestion checkpoint. `valid_at` is a native
world-validity request; these imports leave world validity unknown. Strict
`require_declared_interval` queries refuse rather than fabricate intervals.
Checkpoints are declared modern ingestion/reproducibility metadata, not evidence
of historical availability, receipt or actor knowledge.

Obtain `manifest_sha256` from the trusted saved review record or calculate it
with `sha256sum COLLECTION/manifest.json` while recording the build you reviewed.
`manifest.json` contains `snapshot_sha256`. The full manifest digest binds capsule
membership, file inventory and provenance as well as sources; the snapshot digest
alone does not. These are integrity identities, not signatures or authentication
of an owner. Recomputing an expected hash from an untrusted replacement directory
does not authenticate that replacement.

```sh
python3 tools/local-import/query_collection.py \
  --collection /absolute/imported-collection \
  --request /absolute/query.json > collection-result.json
```

The core path/digest come from `TACITUS_KNOWLEDGE_CAPTURE_BIN` and
`TACITUS_KNOWLEDGE_CAPTURE_SHA256`, or explicit `--core`/`--core-sha256` flags. JSON
cannot select executables or paths. The server's single-source/live UI bounds are
unchanged; this command is an optional local Linux CLI. Both request paths and
collection files refuse symlinks and unsafe paths. No collection code is executed.

A successful result has `format: tacitus-native-collection-context/1` and
`execution_complete: true`. This means **every native capsule ran successfully**,
not that every source/assertion was retained or that evidence is complete. Inspect
coverage, source-only exclusions, each packet's status and native omissions.
An entirely source-only collection refuses with
`source_only_collection_use_lexical_query`; use its existing lexical command.

## One global byte budget

`max_bytes` bounds the complete outer UTF-8 JSON **including its final newline**.
The outer range is 4,096–2,097,152 bytes. The original native child range remains
2,048–250,000 bytes. These are separate bounds; the UI/native core contract is not
widened. A 2 MiB global allowance is useful for the tested 11-capsule collection;
250,000 bytes still executes all four capsules in the tested 128-document case
but explicitly omits many assertions.

The allocator reserves all envelope/lineage metadata, hashes, maximum summary
widths and exact base64 expansion, then assigns equal deterministic native byte
ceilings in stable source-ID order. Any remainder follows that order. No packet
receives its own independent copy of the global budget. Each packet's ceiling is
recorded as `native_max_bytes`, and the final encoded envelope is checked again.
If all native minimums plus the receipt cannot fit, the command refuses before
starting core operations.

Equal ceilings are a resource policy, not relevance ranking or an optimal global
allocation. Unused allowance is not redistributed: an export can be below the
global limit while other packets omit claims. Even an allocated native minimum
may be too small for that capsule's mandatory manifest/omission receipt; a child
budget refusal aborts the entire collection query. There is no automatic retry,
quiet capsule skipping or partial-success fallback.

Each native response keeps its original qualifiers, source quotations, unknown
dates, attribution, relationships, warnings and omission maps. The core may omit
whole linked groups within its assigned limit. The wrapper does not trim or
rewrite native packets. Per-record summaries count selected claims/sources and
native omission entries; the full per-claim omission reasons remain inside the
exact response, with their own summary hash. Coverage distinguishes declared
sources, authored membership, source-only exclusions, executed capsules and
actually selected evidence. Duplicate identities are not independent corroboration;
contradictions can remain unresolved across separate packets.

## Decode exact native packets

`records` follow stable capsule member-source order. Each record contains the
archive SHA-256, canonical capture-input SHA-256, checkpoint, all member source
ID@version/content/revision/annotation-author declarations, native byte ceiling,
actual bytes, SHA-256 and `context_base64`. Members describe the capsule, not the
selected subset. Raw native packets use their existing format; the versioned outer
receipt introduces no core-contract fields.

For a locally saved successful result, this example writes each unchanged native
response into a new directory and verifies its bytes:

```python
import base64, hashlib, json
from pathlib import Path
raw = Path('collection-result.json').read_bytes()
result = json.loads(raw)
assert result['format'] == 'tacitus-native-collection-context/1'
assert result['execution_complete'] is True
assert len(raw) <= result['query']['max_bytes']
out = Path('decoded-native-contexts')
out.mkdir()  # refuse an existing destination
for i, record in enumerate(result['records']):
    packet = base64.b64decode(record['context_base64'], validate=True)
    assert len(packet) == record['native_bytes']
    assert hashlib.sha256(packet).hexdigest() == record['context_sha256']
    (out / f'{i:03}.native-context.json').write_bytes(packet)
```

Keep packets and their outer lineage together. Providing selected decoded packets
to a separate local tool does not establish an answer-quality improvement. This
workbench adds no provider account, model inference or automatic synchronization.

## Refusal and local lifecycle

Before querying, the command verifies the expected full manifest/snapshot,
complete authored/source-only partition, disjoint capsule membership and all
inventoried file hashes/bounds. Each native ZIP is inspected by the current core;
source bytes/versions/hashes/author declarations and exact canonical pre-pack input
are reconstructed and checked. Returned native IDs, citations, metadata,
omission references, temporal state and request identity are validated. Unknown,
missing, duplicated, tampered or mismatched references refuse. Compatible import
producer hashes remain provenance declarations, not authority to execute code.

Revocations are explicit request inputs. `revoked_sources` uses exact native
source ID@version keys from all current manifest sources, including source-only
records. `revoked_capsules` uses declared archive SHA-256 values. Unknown references
refuse; any known revocation refuses the whole collection query. No revoked
capsule is silently removed to produce an apparently complete subset. Local
removal tombstones are not an external revocation service, and no previous export
or downloaded copy can be recalled.

The command uses bounded private copies of validated capsules and the executable,
with an empty child environment, no shell, a 10-second child deadline and 60-second
collection deadline. SIGINT/SIGTERM and ordinary failures clean temporary material.
A crash, SIGKILL or power loss may leave private query material in the OS temporary
directory; those cases and non-Linux behavior remain unverified. Privacy modes do
not encrypt source bytes. Input directories and previous outputs are unchanged.

On any child failure, refusal or cancellation, stdout contains **no successful
result or partial packets**. Stderr receives a versioned error receipt, with a
bounded reason and capsule hash when applicable. Check the exit status. A shell
redirect may leave an empty result file on failure; it is not a collection
receipt. Successful stdout is assembled after all children validate. Writing it
to stdout is not a crash-durable transactional file store.

## Actual tested scope

See [collection-query verification](COLLECTION_QUERY_VERIFICATION.md). Standard
256-document and combined-near-limit importer tests now pass. The combined case
initially exposed ZIP overhead beyond the capture byte count. The batch helper
now signals only that specific archive-size refusal, allowing deterministic
bisection; every other packing failure still aborts. No source is truncated and
all capsule/source/assertion/graph limits remain in force.

Tests match 128/256-document queries to direct native outputs, repeat exact bytes,
check global budgets and minimum boundaries, and exercise strict dates, early
checkpoints, unknown/revoked references, tampering, late-child refusal/timeout and
cancellation. The combined 256-document case also runs a globally bounded query;
large qualifications can produce explicit omissions. Passing synthetic tests is
not a performance, semantic quality, production-readiness or crash-durability
claim. No cloud costs, hosted deployment, new legal terms or private deployment
actions are included.
