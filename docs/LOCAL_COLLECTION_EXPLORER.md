# Explore a local importer collection

The browser previously opened one native ZIP and searched the separately configured
622-source example. It could not open an output directory from the batch importer.
The new **Local imported collection explorer** opens that existing importer format
and an optional existing global query receipt. It adds no backend format or model.

## Open and inspect

1. Prepare a complete directory using the [local importer](../tools/local-import/README.md).
   Retain its manifest SHA-256 through a trusted channel. A hash supplied alongside
   malicious files establishes no independent authenticity.
2. Start the local workbench, enter that expected SHA-256, then select the importer
   output directory. The browser must have access to the files on its own device.
   A path in a cloud terminal does not automatically become a browser-local file.
3. Compare raw source, authored source, source-only, assertion and native capsule
   totals. Use literal case-insensitive search, membership/scope filters and the
   24-source paginated list. Enter opens source detail and focuses its heading;
   Escape returns focus to the source button. Read full source bytes, exact quote
   spans, source and annotation authors, declared rights, qualifications and dates.
4. Select one bounded native capsule to inspect its existing evidence graph.
   Membership lines mean containment only. No relation across capsules is inferred.
5. Optionally choose a saved output from the [collection query command](../tools/local-import/COLLECTION_QUERY.md).
   The saved question, clocks, byte ceilings, selected assertions and omissions
   remain visible. A source can have both selected and omitted assertions.

Without a matching saved receipt, query selection is **unknown**. Source-only
records have no authored native assertions and were excluded from native querying;
this is distinct from omitted assertions. A successful receipt declares execution,
not complete selection, review approval or historical truth. Browser checks do not
rerun Rust or reproduce lexical candidate ranking. An omission-only packet has no
selected evidence. Existing error receipts lack collection/question binding and
are shown as **unbound external failures**, never inferred collection refusals.

World validity, observed time and actor knowledge remain unknown in the current
importer profile. The ingestion checkpoint is a local declaration, not proof of
what anyone knew in 1914. Source authors, annotation authors and batch operators
remain distinct. Conditions, exceptions and original-language quotations are
preserved; no conflict resolution or automatic annotation is performed.

Exact exports include the checked manifest, source UTF-8, original native ZIP,
saved global query and its original native packet. UTF-8 BOM, CRLF and multibyte
quotes are preserved. Graph projections do not alter these export bytes.

## Untrusted files and limits

Files remain in browser memory. Imported Python files are checked as inert bytes
and never executed. The explorer does not resolve filesystem paths, fetch source
URLs, send source files to the local server or transfer data to a remote service.
Provenance URLs and markup are text; the collection graph strips clickable URLs.
Clear, cancel, hash changes and new directory selections terminate the worker and
invalidate previous selection/exports. Validation has a 45-second deadline.

This deliberately narrow browser profile accepts complete current importer output,
with exactly the manifest inventory and no extra files such as `.DS_Store`:

| Bound | Enforced limit |
| --- | --- |
| Selected files / total bytes | 2,049 / 64 MiB |
| Manifest / other individual selected file | 1 MiB / 2 MiB |
| Sources / individual source / source total | 256 / 32 KiB / 8 MiB |
| Native capsule | 25 sources / 50 explicit assertions / 1 MiB ZIP |
| ZIP structure | Stored entries only; at most 64; no compression, links, extras, comments, descriptors or traversal |
| Decoded native material | 64 MiB aggregate |
| JSON | 2 MiB, depth 32, 200,000 parsed values; unique decoded keys, valid Unicode, exact safe integers only |
| Saved query | 2 MiB; success only for `disclose_unknown`, no revocations in this importer profile |

Schema, file hashes, content addresses, versions, source coverage, exact quotation
bytes, Rust assertion fingerprints, pre-pack capture identity, graph membership and
query summaries are checked. Central/local ZIP headers, sizes and CRCs must agree.
These checks establish structural consistency with the trusted manifest. They do
not authenticate a claimed Rust execution, verify declared rights or prove source
truth. Decimal/exponent numeric tokens and integers outside JavaScript's exact safe
range refuse, even if another tool could parse them. Lexical objects/shards are
validated for identity and coverage; browser literal filtering does not claim
Python tokenizer equivalence.

The membership canvas draws actual filtered sources and actual capsule groups.
The accessible list provides the same source selection without the canvas. Only
one capsule graph is rendered at a time: at most 100 actual projected nodes for a
full 25-source capsule with structural line nodes hidden, or 150 for its saved
selected graph including passages. The existing graph controls remain available.
Reduced motion is respected; no force simulation or synthetic padding is added.
The 256-source ceiling is not a claim about rendering thousands of graph nodes.

## Reproduce acceptance

Use the root README to install, build the pinned core and prepare both examples.
Keep all live/authoring binary paths and hashes exported. From the repository root,
choose a fresh absolute fixture directory (the helper refuses existing output):

```sh
export TACITUS_BATCH_AUTHOR_BIN=/tmp/tacitus-build/core-build/target/debug/examples/batch_author
export TACITUS_BATCH_AUTHOR_SHA256="$(sha256sum "$TACITUS_BATCH_AUTHOR_BIN" | cut -d ' ' -f 1)"
export TACITUS_TEST_IMPORTED_COLLECTIONS=/tmp/tacitus-browser-collection-fixtures
python3 tools/local-import/tests/prepare_browser_fixtures.py --output "$TACITUS_TEST_IMPORTED_COLLECTIONS"
cd apps/workbench
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1 \
TACITUS_TEST_ARCHIVE="$TACITUS_WORKBENCH_ROOT/examples/july-1914/july-1914.native-v2.zip" npm test
node scripts/verify-inventory.mjs
```

Fixtures use the unchanged importer and actual pinned native query command:
128 fabricated sources contain 100 authored + 28 source-only, four capsules and
200 assertions; 256 fabricated sources contain 256 authored, eleven capsules and
512 assertions. Their saved receipts exercise partial and complete selections.
The real rights-safe example uses exact public-domain FRUS d24/d25 source bytes,
with two source-only records and no invented annotations or graph edges.

Tests open all three fixtures at desktop 1440px and mobile 390px, with reduced
motion. They check actual counts/pagination, quotations and inert markup, keyboard
focus, graph scope, omission/error states, exact exports, stale worker isolation,
no page overflow/errors and no external or non-GET requests. JSON/ZIP/schema and
self-rehashed tampering regressions run separately. Browser durations printed by
the tests include directory verification and manifest export, not an isolated
renderer benchmark. Full acceptance requires these fixture files; a default test
run without them explicitly skips the corresponding integration cases.

Original application reserved rights, Apache core notices and source-data terms
remain unchanged. The separate 622-source lexical index, bounded native capsules
and unreviewed proposals retain their distinct meanings. Hosted deployment and
private website/PRAXIS holds remain outside this local feature.
