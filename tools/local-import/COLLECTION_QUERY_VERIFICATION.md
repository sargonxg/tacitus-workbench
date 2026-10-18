# Collection query cloud verification — 2026-10-18

Public repository `sargonxg/tacitus-workbench`; branch
`feat/collection-native-query-20261018`, based on main
`f1f2c1c6da824eb03d8366fa37a97ca8cac46a5f`. Native core remains pinned to
`6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`. No core schema, native API, graph
store, model/provider, credentials, new dependency or hosted deployment was added.

## Maximum-count and combined-limit importer tests first

Before implementing collection querying, actual maximum 256-document tests ran.
The ordinary 256-authored-source fixture passed: 256 lexical records in 16 shards,
11 native capsules and 512 unreviewed reported statements. A combined fixture
failed atomically during packing; no final output was exposed.

The combined fixture had exactly 8,388,608 source bytes (256 × 32 KiB), a 7,698,670-byte
manifest, two 4,000-byte propositions per source, eight 1,000-byte user condition
lines and five 500-byte exception lines per annotation. Every source retained its
synthetic BOM/CRLF/multilingual quotations. The diagnostic failing input was
1,045,764 bytes, within the 1 MiB capture bound. The native ZIP's serialization
and manifest overhead exceeded its separate 1 MiB archive bound. This was a real
supported-input scaling failure, not a test-only timeout or an invalid source.

The workbench-owned batch helper now signals exactly that resource failure with
exit 75, fixed stderr `batch_archive_limit` and empty stdout. The importer only
bisects that specific condition, in stable source order, and refuses a single
source that still cannot fit. Every other child/validation failure still aborts
rather than masking invalid annotations. Resource refusal must leave no output
archive; unexpected output refuses. No core/source/assertion/graph/archive bound
was increased and nothing is truncated.

Both scaling tests now pass. The combined fixture imports all 256 sources and 512
assertions into 32 native capsules; the largest ZIP is 528,559 bytes. It also runs
a collection query under one 2,097,152-byte global budget: all 32 capsules execute,
64 assertions are retained and 448 are explicitly omitted by native budgets. Its
complete encoded result is 1,797,391 UTF-8 bytes. Large qualifications are retained
whole when selected, rather than trimmed to hide omissions.

## Matched queries and exact byte budgets

| Fixture | Declared / authored / source-only | Native packets | Selected assertions | Complete outer bytes | Global limit |
|---|---:|---:|---:|---:|---:|
| Standard 128 | 128 / 100 / 28 | 4 | 200 | 751,239 | 2,097,152 |
| Standard 256 | 256 / 256 / 0 | 11 | 512 | 1,920,589 | 2,097,152 |
| Combined near-limit 256 | 256 / 256 / 0 | 32 | 64 | 1,797,391 | 2,097,152 |

These are deterministic evidence receipts, not answer-quality or performance
comparisons. Within each query every packet uses the same question, checkpoints
and validity policy; only the recorded deterministic per-capsule byte ceilings
vary. Decoding every standard 128/256 packet yields byte-for-byte equality with a
direct invocation of the same pinned core, ZIP and child query. Repeated complete
outer responses are byte-identical. Source/annotation author, speaker, modality,
conditions, exceptions, exact UTF-8 quotations, unknown temporal state and unknown
knowledge labels survive unchanged.

A 250,000-byte global query over the 128 fixture still executes all 4 capsules,
with explicit native omissions and a complete result within that budget. A
multilingual question exercises actual outer UTF-8 accounting. The exact empty
payload metadata plus base64 minimum boundary passes allocation; one byte less
refuses. A 4,096-byte request refuses before core operations. Count/width reserves,
base64 expansion, complete envelope and final newline all count. Native child
limits remain 2,048–250,000; only the new outer receipt permits up to 2 MiB.
Unused allowance is not redistributed. No cross-capsule merge, global relevance
ranking, contradiction resolution or model answer is produced.

## Actual commands and gates

```sh
TACITUS_BATCH_AUTHOR_BIN=/workspace/tacitus-local-author-build/core-build/target/debug/examples/batch_author \
TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-local-author-build/core-build/target/debug/examples/knowledge_capture \
python3 -m unittest discover -s tools/local-import/tests -v
```

The complete importer/query/scaling suite passed **14 tests, zero skips**.
A separate final scaling run with the added combined-limit query passed 2/2;
query-only acceptance passed 5/5, including direct native byte comparisons.
Tests include changed/removed/re-added/duplicate/multilingual import inputs,
verified cached rows/ZIPs, unsafe paths, interruption/no-replace publication,
expected full-manifest/snapshot mismatches, incomplete/duplicated/unknown capsule
membership, revoked or unknown source/capsule references, tampered last ZIP,
unknown citations/omission references and changed temporal values. Strict unknown
validity and pre-ingestion queries refuse. Late-child failure/timeout and actual
SIGTERM after observed staging creation clean private material and produce no
successful partial result. Output is emitted only after all child results validate.

Legacy PR10's retained 128-source collection was also queried successfully without
rebuilding its native ZIPs or requiring the old batch helper. All 200 statements
were retained under 2 MiB in 751,239 bytes. The consumer verifies the selected
compatible profile, full expected manifest and core identity; recorded importer
producer hashes remain provenance metadata rather than code-execution authority.

The batch helper was rebuilt in the existing isolated pinned workspace with
Rust 1.95.0 and locked official dependencies. Its actual Linux SHA-256 is
`3f4331ff86e2d6b282dd2faec3107cf8ee15f4f105d3fdba8fe3679727614a6f`.
The native core remains
`902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b`;
the single-source helper remains
`2c2beb208f77d860a53a5035d68e9d2e50fa062b331d45600e5364df6e872f04`.
Source pins, locked builds and actual tests are the reproduction contract;
compiler/platform can change executable bytes. The unchanged core workspace's
135 Rust tests passed again.

`NPM_CONFIG_CACHE=/workspace/.npm-cache npm ci --ignore-scripts
--registry=https://registry.npmjs.org` installed 29 locked packages. UI typecheck
and build passed with the two inherited graph `use client` warnings. Default
browser/unit acceptance passed 26 with one explicit native-helper skip; full
configured acceptance passed 27 with zero skips. Query work changes no browser
route, native UI cap or provider connection. The current clean-clone flow remains
usable; no second historical-core clone or private source copy was needed.

## Independent review

The independent code/security reviewer ran the actual matched query suite 5/5
with zero skips and approved complete membership/input-digest checks, FD-relative
safe reads, immutable private core/capsule copies, bounded empty-environment
subprocesses, deadline/cancellation, global accounting, resource-only splitting
and absence of partial-success output. Defensive omission-reference/temporal-value
checks additionally bind returned IDs/state to the inspected original snapshot.

The independent usefulness/source-integrity reviewer built its own 28-source
fixture (26 authored, 2 source-only). Two packets retained all 52 assertions under
2 MiB in 203,663 bytes. With a 100,000-byte global budget, both capsules executed
with 33,423-byte native ceilings, selecting 8 assertions and disclosing 44 omission
entries; actual outer size was 60,156 bytes. Every decoded packet matched direct
core output exactly, repeated outer bytes were stable, and strict/early/budget/
wrong-manifest refusals had empty stdout. The review approved separate qualified
receipts, not a semantic answer, relevance optimizer or quality claim.

## Remaining evidence limits

Maximum256 count and this specific combined near-limit case are now tested.
Every possible worst-case character/metadata combination and performance at all
resource boundaries are not established. Excessive mandatory native metadata can
still cause an explicit all-or-nothing budget refusal. There is no combined graph
closure or conflict resolution across capsules. Source-only records require the
separate lexical workflow, whose short-token/CJK limitations remain unchanged.

Power-loss/SIGKILL cleanup, crash-durable stdout storage and non-Linux execution
remain unverified. Ordinary failure and SIGTERM cleanup are tested. Privacy modes
are not encryption; exported copies cannot be recalled. No production-readiness,
authenticated authorship/rights/truth, answer-quality gain, paid service or hosted
deployment is claimed. v0.1.0, original local servers and private deployment holds
remain preserved.
