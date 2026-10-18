# Local release checks — 18 October 2026

This bounded pass starts from a genuinely fresh clone of public workbench main
`25d93ecaaf00aea80ccf2acefcf27b5de5b9e2b3` (PR6–11 included). It adds documentation,
prerequisite diagnostics and concrete evidence-view corrections; it adds no service,
model, deployment or legal terms. The existing v0.1.0 tag remains unchanged.

## Beginner journey

Follow the [root README](../README.md) in order: clone/install → recorded demo →
build pinned core → live sample → explicitly author local text. Use the same shell
for exported settings. Stop `npm start` with Ctrl-C before changing modes. The
collection CLI is an optional advanced path, not a browser collection uploader.

Recorded mode loads saved bytes with no native process. Live sample mode calls the
hash-pinned native core; failures remain failures. In the live view, select a claim,
read the exact quoted source and attribution, and inspect conditions, exceptions,
unknown dates and omissions before exporting. Check that the downloaded JSON is the
exact returned response. A graph edge is an authored relation, not proof of causality.

For your own text, use **Create from local text** with the author helper enabled by
the root commands. Declare your rights basis, source and annotation authors, two
unique single-line exact quotes and one explicit relation. Review the generated
unreviewed capsule, then inspect/query/export it. Source bytes remain inside the ZIP;
private temporary permissions do not encrypt them. No automatic extraction or rights
verification occurs. See [authoring limits](LOCAL_TEXT_AUTHORING.md).

## Advanced importer and global query acceptance

After the root core-build commands, from the repository root:

```sh
cd "$TACITUS_WORKBENCH_ROOT"
export TACITUS_BATCH_AUTHOR_BIN=/tmp/tacitus-build/core-build/target/debug/examples/batch_author
export TACITUS_BATCH_AUTHOR_SHA256="$(sha256sum "$TACITUS_BATCH_AUTHOR_BIN" | cut -d ' ' -f 1)"
python3 -m unittest discover -s tools/local-import/tests -v
```

With both helper/core paths present this runs 14 tests with zero skips, including a
fabricated 128-document case: 100 explicitly authored sources, 28 source-only,
16 lexical shards, four native capsules and 200 unreviewed reported statements.
The fixture contains BOM/CRLF, multibyte text and inert markup/URLs; it is synthetic
acceptance data, not historical evidence or an automatic annotation feature. Tests
also cover 256 documents, the combined near-limit case, incremental identities,
byte-exact quotations, unsafe paths, tampering, cancellation and refusal cleanup.

Follow [manifest import](../tools/local-import/README.md) to declare real local files,
then [collection query](../tools/local-import/COLLECTION_QUERY.md) for the exact request
schema and CLI. Record the reviewed manifest SHA and snapshot SHA, use the same core
binary/digest as import, and choose checkpoints covering all capsule ingestion times.
A source-only collection uses its lexical query command and refuses native querying.

The collection result is an outer receipt with separate base64 native packets. Its
global budget includes metadata, base64 and the final newline. Equal ceilings are
not global relevance ranking; unused space is not redistributed. The 128-document
2 MiB test selects all 200 statements; a 250,000-byte test explicitly omits statements.
Full capsule execution does not mean complete evidence selection. Strict unknown-date,
revoked/unknown-reference, early-checkpoint and child-failure cases return no successful
stdout result. Keep exact packets, lineage and omissions together when decoding.

## Full browser acceptance

In the same shell after preparing both examples and the expanded lexical index:

```sh
cd "$TACITUS_WORKBENCH_ROOT/apps/workbench"
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
TACITUS_TEST_BROWSER=/usr/bin/chromium \
TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1 \
TACITUS_TEST_ARCHIVE="$TACITUS_WORKBENCH_ROOT/examples/july-1914/july-1914.native-v2.zip" npm test
node scripts/verify-inventory.mjs
```

The full command requires live and authoring opt-ins plus both executable/digest pairs;
missing configuration fails. `/usr/bin/chromium` is the Linux system-browser path used
here; use a matching Playwright browser on other systems. This is not a cross-platform
or full accessibility certification.

## Actual environment and results

The execution environment was already available at `/workspace`; no environment
startup or cloud deployment was performed. Node 24.19.0, npm 11.9.0, Python 3.12,
Rust 1.95.0 and system Chromium 154 were used. Fresh workbench clone:
`/workspace/tacitus-workbench-release-20261018`; fresh core clone/prepared workspace:
`/workspace/tacitus-release-clean-build/{core,core-build}`. Official npm dependencies
installed with `NPM_CONFIG_CACHE=/workspace/.npm-cache npm ci --ignore-scripts
--registry=https://registry.npmjs.org` (29 packages). The writable cache is an
environment-specific setting, not a requirement on other machines.

Initial core preparation cloned/verified the pinned source, then failed because
`cargo` was absent from PATH. Exposing the already installed toolchain with
`PATH=/workspace/.cargo/bin:$PATH CARGO_HOME=/workspace/.cargo
RUSTUP_HOME=/workspace/.rustup` fixed this. The exact locked test/build steps from
`build-core.sh` were resumed in the fresh prepared workspace, with
`CARGO_BUILD_JOBS=4 CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0`. No checks were
removed. The script now checks prerequisites before creating an output directory.
The fresh core pin is `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`.

All 135 Rust tests passed. Helper SHA-256 identities:

| Executable | SHA-256 |
| --- | --- |
| knowledge_capture | `902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b` |
| local_author | `2c2beb208f77d860a53a5035d68e9d2e50fa062b331d45600e5364df6e872f04` |
| batch_author | `3f4331ff86e2d6b282dd2faec3107cf8ee15f4f105d3fdba8fe3679727614a6f` |

Compute your own reviewed executable digests; another compiler environment can produce
different binaries. Do not rewrite an old collection's provenance to fit a new binary.
Fresh bundle preparation, onboarding-byte checks, July native verification and the
expanded corpus suites (24 + 12 tests) passed; the index contains 622 records/32 shards.
Initial default app tests passed 26 with one explicit native-authoring skip. The fresh CLI suite passed all 14 tests with zero skips (72.811 s). Its 128-source 2 MiB query returned 751,239 bytes and all 200 assertions; the combined near-limit query returned 1,797,391 bytes, 64 selected assertions and 448 omissions across 32 capsules. A separately retained 128-document import queried with a 250,000-byte budget returned 191,471 bytes, 24 selected assertions and 176 omissions; all four capsules executed, and 28 source-only records were explicitly excluded.

Build emits two inherited `use client` directive warnings in graph modules. They did
not prevent building or browser acceptance. Historical reports such as
[CLOUD_VERIFICATION](CLOUD_VERIFICATION.md) retain their original tested checkpoints;
they are not current-main test receipts.

## Final candidate review

Typecheck and build passed. Final default tests passed **30 with one explicit native-authoring skip**; full configured browser acceptance passed **31/31 with zero skips**. The first full run failed only because the onboarding regression still expected the obsolete pinned README link. Its exact expected URL was updated to the current guide; all other checks remained, and the full suite passed on rerun. The inventory verifies 59 application deliverables, retaining historical origin hashes and reserved-rights metadata; stale equality flags are corrected without changing those origins.

An independent command reviewer checked the current guides against actual logs, independently summed the 135 Rust tests and hashed the fresh executables, reviewed the UI diff and exact URL assertion, and verified all 17 tracked rights/notice files byte-for-byte against the baseline. An independent skeptical diplomatic walkthrough on 1440- and 390-pixel views checked source links, exact quotes, modality, conditions, exceptions, unknown dates, omissions, refusal and export bytes. The expanded relief query selected nine assertions; its 20,000-byte query selected zero with 46 omissions and now displays explicit insufficient-context guidance. Strict unknown-date requests refused with no export or recorded fallback. Both widths had zero observed page errors or horizontal overflow. These are fixture walkthroughs, not the unseen/model-answer evaluation proposed in the architecture.

Concrete fixes restore safe HTTP(S) original-source links from native metadata, remove an assumed assistant author from generic annotation cautions, show actual selected/omitted counts and make omission-only results explicit. Original native JSON is unchanged. Application and architecture guides now cover local authoring, batch import and the globally bounded collection receipt. Missing build tools are diagnosed before creating a build directory.

## Rights and release decision

Root [RIGHTS](../RIGHTS.md), original [application rights](../apps/workbench/APPLICATION_RIGHTS.md),
Apache core/notices, FRUS source attribution and Gutenberg distribution/trademark
conditions remain in place. Memoir public-domain scope is USA-specific. No new
commercial license, rights verification or model-quality claim is introduced.

| Readiness area | Decision |
| --- | --- |
| Local runnable workbench | Passed the locked install/build, recorded/live browser, explicit authoring and optional CLI gates described above; the reviewed commit/PR identifies the published candidate. |
| Cloud/hosted service | Unsupported by this release. Loopback operation is not hosted authentication, persistence or production operations. |
| PRAXIS / Foundry | Held. No private code copied, deployment run or external bridge certified. Separate owner/deployment review is still required. |
| Model answer evaluation | Unrun. An optional [offline harness](../tools/offline-eval/README.md) provides packet/export/import capability; synthetic tests are not a model study. No provider/model calls, measured answer-quality gains or policy-decision benefit established. |
| Source semantics | Proposals remain unreviewed; structural citations and byte fidelity do not establish historical truth or knowledge dates. |
| Publication identifier | Use the reviewed commit/PR. No new tag or movement of existing tags is needed. |
