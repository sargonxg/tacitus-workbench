# Integrated release-candidate audit — 18 October 2026

Audited public main through PR15 at
`75afd56307b4ddabca3dbc4e78dde61c97a2071e`. The audit correction changes browser-test
server ownership checks and documentation only; application, core, helper, data,
rights and dependency lockfile bytes remain unchanged. This is a tested candidate,
not a new release tag. Existing `v0.1.0` remains at
`774cf88e10418b712f421aff8e84389248f572e2`.

## Execution and results

Tests ran in the existing **Linux cloud executor**, using headless Chromium and
local-only loopback services. Public hosted deployment, authenticated multiuser
operation, persistent shared storage and production operations remain unsupported.
This does not mean ordinary cloud execution is impossible: this audit itself ran
there. No new machine, deployment, provider connection or model study was started.

A fresh workbench clone at `/workspace/tacitus-workbench-rc-clean-20261018` used
Node 24.19.0, npm 11.9.0, Python 3.12, Rust 1.95.0 and system Chromium 154. Locked npm
installation used only the official registry. The existing prepared pinned core
workspace at `/workspace/tacitus-release-clean-build/core-build` was reused for
compilation artifacts; this audit did not create a second full core clone. All 71
source receipt hashes and both workbench helper sources match the reviewed pin
`6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95` and current application helpers.

| Gate | Actual result |
| --- | --- |
| Locked npm install, typecheck, build | Passed; existing nonfatal Vite `use client` warnings retained |
| Full Rust workspace | 135 passed, no failures |
| Full configured application suite | 41 passed, no failures or skips on the final isolated run |
| Local importer/query/scaling CLI | 14 passed, no failures or skips |
| Offline evaluation harness | 18 passed, no failures or skips; no external answers generated |
| Expanded source corpus | 24 + 12 passed; 622-source lexical index regenerated |
| Application deliverable inventory | 74 files verified |
| Integrated own-text journey | Passed at 1440px desktop and 390px mobile with reduced motion |
| Independent source/security review | 23 focused tests passed; combined interactions and 16 rights/license/notice files plus `sourceNotices.ts` checked |

The first full application attempt had 40 passes and one failure caused by an
independent review preview occupying test port 4340. It was a coordination collision;
no product request was refused incorrectly. Five older browser fixtures could
mistake another server's successful status response for their own startup. They
now require their spawned process's listening message, a live child and the exact
status origin, matching the two already protected fixtures. A deliberate occupied-port
probe now fails promptly with `EADDRINUSE` and makes **zero requests** to the other
preview. Final browser acceptance runs without concurrent previews on test ports
4318, 4324, 4337 and 4340–4343. Test servers are stopped after their runs.

## Continuous own-text journey

The retained journey starts with original synthetic UTF-8 text containing BOM,
CRLF, multibyte quotations and an instruction-shaped unquoted sentinel. At each
viewport it performs keyboard form entry → explicit two-annotation authoring →
validated native ZIP → native inspection/query → cited prompt. It then explicitly
declares the **same source and annotations** in the existing CLI collection manifest,
adds one source-only fixture and imports/queries that collection. This is a manual
manifest step, not automatic conversion of an existing single-source capsule.

The browser opens that actual importer directory and saved query, checks two raw
sources / one authored / one source-only / two assertions, prepares this capsule's
selected prompt, downloads and re-verifies the package. It preserves exact native
bytes, source hashes, quote spans, qualifications and unknown clocks. The unquoted
full-source sentinel and source-only private-data sentinel do not occur in the
prompt. These are fabricated isolation fixtures, not actual private information.
Query edits clear stale results; an early-checkpoint request refuses without export
or recorded fallback. Clearing collection data removes its prompt. Both viewports
had visible keyboard focus, no horizontal overflow, no page errors and no external
requests. The resulting collection prompts contain 11,796–11,797 UTF-8 bytes;
viewport runs have different declared collection names/checkpoints, so their hashes
are expected to differ. Deterministic re-verification applies to each fixed input.

Existing full acceptance separately exercises cancellation/late callbacks in
native queries, authoring, collection workers and prompt preparation/clipboard;
wrong digest/Origin, concurrent requests, source/path/hash tampering, refusal,
omission-only, unbound receipts, revoked entries and stale-package rejection.
Graph projections and source-only lexical data never substitute for a selected
native packet. Copied/downloaded bytes cannot be recalled; no current external
revocation authority or prompt-injection immunity is claimed.

## Reproduce

Follow the [root README](../README.md) for a fresh clone, pinned core build, both
examples and the separate expanded lexical index. Export the live/authoring core
and helper paths, reviewed SHA-256 values and opt-ins. Prepare a fresh browser
fixture directory using [the explorer guide](LOCAL_COLLECTION_EXPLORER.md#reproduce-acceptance).
Then run, without other previews on the test ports:

```sh
# In the prepared four-crate core workspace created by scripts/build-core.sh:
cargo +1.95.0 test --workspace --locked
# In the fresh workbench clone:
cd "$TACITUS_WORKBENCH_ROOT/apps/workbench"
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1 \
TACITUS_TEST_ARCHIVE="$TACITUS_WORKBENCH_ROOT/examples/july-1914/july-1914.native-v2.zip" npm test
node scripts/verify-inventory.mjs
cd "$TACITUS_WORKBENCH_ROOT"
python3 -m unittest discover -s tools/local-import/tests -v
python3 -m unittest discover -s tools/offline-eval/tests -v
```

The retained run receipt binds exact commits, tree identity, commands, binaries,
fixture hashes, all test logs and the executable journey script/output. This audit
is not an external model-answer study, cross-platform/accessibility certification,
source-truth approval or production-readiness claim. The offline study remains
unrun; frozen questions/versions, blind human ratings and complete costs remain
necessary before any answer-quality comparison.

## Holds and next decisions

All original reserved application rights, Apache core notices, FRUS source terms
and Gutenberg conditions remain intact. No new legal terms are introduced. Private
website PR47 and PRAXIS PR36 remain held; no private code, credentials, security
settings, public invoker permissions, traffic allocation or deployments changed.

The next decisions are whether to run a local pilot on an explicitly reviewed real
source/annotation subset, whether to authorize a separately frozen external model
study with blind raters and cost records, and whether to start a distinct hosted
service/deployment review. None is required to run this local workbench. No tag
creation or movement is needed for those decisions.
