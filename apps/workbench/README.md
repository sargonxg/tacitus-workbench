# Local evidence inspector — unpublished review candidate v2

This independently mounted interface accepts native ZIP capsules, inspects and
queries a separately pinned local core, displays a read-only evidence graph and
exports the exact Context response. It also offers explicitly selected recorded
examples. A failed live request never substitutes a recorded result.

Version 2 corrects four independent-review findings. Query controls freeze during
live execution; later parameter edits invalidate the old Context/export. Reset
clears the native file picker so the same ZIP can be selected again. The HTTP
adapter acquires its outer request lock before reading bodies, and releases it on
every exit. Default `npm test` no longer requires core opt-in: disabled access is
404, whereas enabled hostile-origin access is 403. Regression tests exercise both.
Frozen v1 and its review evidence remain unchanged in their separate directory.

This directory is task-owned and unpublished. The original application source
modules have **reserved rights pending an explicit owner license choice**; no
commercial redistribution license is granted by this review copy. The owner must
explicitly choose the license and approve
the clean inventory before public distribution. Public repository visibility does
not grant a license. `private: true` is intentional.
See `APPLICATION_RIGHTS.md` for the exact boundary.

## Reproducible install

The integration adds a fresh official-registry `package-lock.json`; it carries no
private website lockfile or dependency junction. Node 24 is required.

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm start
```

See the repository README for the tested native-core build and 622-record lexical
collection preparation. Use `TACITUS_TEST_BROWSER=/usr/bin/chromium npm test` for
the cloud's preinstalled browser. Default Playwright browser discovery remains
available on other machines. Current results are in `docs/CLOUD_VERIFICATION.md`;
`VERIFICATION.md` records historical pre-integration evidence only.

Open `http://127.0.0.1:4317`. Without explicit core configuration, live execution
is unavailable; select **Recorded July 1914 example** to load the saved peace
Context. The optional guided walkthrough is fetched separately on demand.

To enable live execution, set these process environment variables before start:

```
TACITUS_LOCAL_INSPECTOR=1
TACITUS_KNOWLEDGE_CAPTURE_BIN=<absolute path to reviewed knowledge_capture executable>
TACITUS_KNOWLEDGE_CAPTURE_SHA256=<verified 64-character lowercase executable digest>
```

No credential is required. The server binds `127.0.0.1` only; `PORT` optionally
selects a port between 1024 and 65535. It checks Host and exact same-origin POSTs,
bounds input/output/time/concurrency, checks the executable digest on each request,
uses fixed temporary archive names and shell-free arguments, and cleans temporary
files. The process adapter excludes inherited credentials from child environments.
The feature remains disabled with `NODE_ENV=production` or a hosted-platform flag.
Do not expose this server publicly.

The original adapter's 8 MiB ZIP / 12 MiB JSON transport / 2 MiB output bounds and
10-second core deadline are retained. The UI requires inspection before querying.
Cancellation and reset invalidate old asynchronous results. Export uses the raw
response string rather than graph reconstruction.

## Provenance and rights

`FILE_INVENTORY.json` records every distributed file, SHA-256 and origin.
Only the original task-authored adapter/client and independent graph components
were extracted from private PR47 commit
`1965d55fd67327d1e4653b01347127cc3b17f18c`. The server, HTML/React entrypoint,
global styling, package manifest and build configuration were independently
written here. No website layout, theme, navigation, route, configuration, assets,
research pages, branding, analytics, package manifest or lockfile was copied.

The graph v2 handoff ZIP has SHA-256
`f8cfa89ae6b584e6f378f7101296279cf595c70927877eb74e716d1919faa3c6`.
The original graph model remains unchanged. `corpusGraph.ts` comes directly from
that independent handoff and supplies the guided module's type dependency.

The recorded peace Context comes from the checksum-verified July bundle
`1f8bec89ec6ea2c46477c0fd1c360b67afe33b6db392b6606c20c68532c36bc6`.
Its native archive SHA-256 is
`c7268bef3b19ff9b93458a64e476dd52df1c76f074e77fe149d2983268a66e5f`.
It was produced by source-span-patched core `0d47eafd93f2b4a5e4a926d3c761410b1c319cd6`,
patch SHA-256 `5dbf6a9c000b7a381601063115c9b08d4b509d239b7edd9d2c4b0067f3856611`.
Current builds pin merged core `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`, which
already contains that source-span fix. The historical patch and receipts remain
for provenance; the build no longer applies a local patch.
The tested Windows executable SHA-256 was
`fa695e57f04d487b4c569363cbf5732106d7051d2bddfb15f84dfee93051996f`.
No executable or full source corpus is bundled here. Public flagship base
`feb4b7c6e9532ae1898561100ab3c437cf734a3c` and example PR1
`dd9dc217f8b839b2b00bf645b62bfb8272ee6146` are separate publication references;
this candidate has not been published into either.

The optional guided module came from Library
`libfile_cc3dbdf6ecc48191833984a72d82bef4` version 0, ZIP SHA-256
`41cc6722d9572606419c636049670f3d5a0206182f3fd6260468c76a49f7844e`.
One type-only adaptation replaces `CorpusIndex & {documents: DetailedSource[]}`
with `Omit<CorpusIndex, 'documents'> & {documents: DetailedSource[]}`. Runtime model
logic and the frozen graph are unchanged. The optional graph-selection callback
is deliberately unconnected and no corresponding UI control is offered.
The walkthrough keeps eight questions, 39 authored claims, 21 typed entities,
12 proposed links, exact spans, separate historical clocks, four recorded runs
and four mixed lexical/native comparisons. Actual output sizes and omission units
differ; these are retrieval observations, not answer-quality gains.

Native checkpoints are modern ingestion times. Only the fixed guided example
implements source-created/recipient-received teaching views; uploaded live graphs
do not infer them. Memoir evidence is retrospective. Quoted Context spans bind to
source references; the live viewer lacks full source bytes and cannot recheck a
complete source-file hash. Assertions remain unreviewed.

Complete source rights and Gutenberg terms are retained under `public/notices/`.
Lichnowsky ebook 39457 declares USA-specific public-domain status; other
jurisdictions remain unverified. Software licensing and source distribution terms
are separate. Recorded outputs contain source quotations and require these notices.

## External core and dependency notices

The core is an external Apache-2.0 project. Its upstream LICENSE/NOTICE and patch
provenance remain separately owned by the core integration worker; this package
does not overwrite `docs/CORE_INTEGRATION.md`, core preparation scripts or patches.
Retain those upstream notices when distributing the core alongside this UI.
Dependency license texts used here are under `notices/dependencies/`; they do not
license this new application source. No application LICENSE has been invented.

## Verification

`npm test` uses existing Playwright and a fresh isolated Chromium process. Set
`TACITUS_TEST_ARCHIVE` plus the live configuration above to include actual-core
inspection/query and live-refusal checks. Test screenshots/logs stay in `output/`.
The private website's full verification result is separate from this candidate.
