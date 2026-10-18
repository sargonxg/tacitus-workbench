# Cloud integration verification — 2026-10-18

Environment startup completed successfully in `/workspace`. Initial working trees were clean. Existing repositories were `sargonxg/tacitus-workbench` (`work`, `feb4b7c6e9532ae1898561100ab3c437cf734a3c`) and `sargonxg/tacitus-political-policy-second-brain` (`work`, `6fc3da15855324186620f0abb44c6c845a87d85f`). Neither existing branch was overwritten. Applicable core AGENTS.md instructions were inspected; the workbench has none. No new agent delegation was used.

`git ls-remote` reconciled main and all three requested PR heads before edits. The integration branch is `integration/reproducible-workbench-20261018`, based on PR3 `5766d1cb3472f85d6ed702728295349e99641520`. Only the example directories were brought from PR1 `dd9dc217f8b839b2b00bf645b62bfb8272ee6146` and PR2 `9ed66eef932fee3b8888fcfed4ed582b0123c133`; `git diff --exit-code <respective-commit> -- <example-directory>` confirms unchanged tracked bytes. Remote refs were checked again and saved in `verification/cloud/remote-refs.txt`. GitHub's public REST PR metadata endpoint returned HTTP 403, so draft/open status is user-provided, not independently confirmed here.

The core was separately cloned to `/workspace/tacitus-core-pinned`, checked out at `0d47eafd93f2b4a5e4a926d3c761410b1c319cd6`, and patched with the repository's existing Apache source-span patch. Patch SHA-256 is `5dbf6a9c000b7a381601063115c9b08d4b509d239b7edd9d2c4b0067f3856611`; resulting `knowledge_capture.rs` SHA-256 is `b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662`. The original user core checkout remains unchanged. No private website source was accessed or copied during integration.

## Tools and actual commands

Node 24.19.0, npm 11.9.0, Git, Python and Chromium were available initially; Rust was absent. Official rustup installed Rust 1.95.0 (`59807616e`) with isolated `RUSTUP_HOME=/workspace/.rustup`, `CARGO_HOME=/workspace/.cargo`, minimal profile and no shell-profile edits. npm used only `https://registry.npmjs.org` with a cache under `/workspace/.npm-cache`. No sandbox approval was requested or denied.

In `apps/workbench`:

```sh
npm install --ignore-scripts --registry=https://registry.npmjs.org --cache=/workspace/.npm-cache
npm ci --ignore-scripts --registry=https://registry.npmjs.org --cache=/workspace/.npm-cache
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
TACITUS_TEST_BROWSER=/usr/bin/chromium TACITUS_TEST_COLLECTION=1 \
TACITUS_LOCAL_INSPECTOR=1 \
TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-core-build/target/debug/examples/knowledge_capture \
TACITUS_KNOWLEDGE_CAPTURE_SHA256=5b1e05276784f8e460054b718535809f3dc2eaa265dc861ddbc954710167e420 \
TACITUS_TEST_ARCHIVE=/workspace/tacitus-workbench/examples/july-1914/july-1914.native-v2.zip npm test
```

The generated lockfile SHA-256 is `a62c2e489f9a86cf900e1ea73b7537f1572a2de54cd46519f3d827142a913da9`. `npm ci` replaced the task-created dependency installation; no private/shared dependency junction or website lockfile was used. Typecheck and production build passed. Build emitted two inherited `use client` directive warnings from the graph/walkthrough components; browser behavior passed.

The core preparation/build commands were:

```sh
python3 /workspace/tacitus-core-pinned/scripts/prepare-capsule-workspace.py /workspace/tacitus-core-build
# In /workspace/tacitus-core-build with the isolated Rust homes:
cargo +1.95.0 test --locked
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture
# From the workbench root, a second fresh build tested the new helper itself:
bash scripts/build-core.sh /workspace/tacitus-reproduction
```

Both core builds passed all **135 tests**. The first binary SHA-256 was `5b1e05276784f8e460054b718535809f3dc2eaa265dc861ddbc954710167e420`; the fresh helper build produced `5a4badccd55503f60134ad44f8827e792aeb647c76c7be649b1b8b76f6454749`. Debug build paths can change executable hashes; both executables reproduced all ten fixture outputs exactly. The server pins the executable hash actually selected.

## Acceptance results

- July preparation: 11 regressions, all passed; all 209 archived files verified. July corpus: 13 tests passed.
- Initial default UI: 3/3 passed using system Chromium after fixing browser discovery. The baseline live suite passed **before PR2 was integrated**.
- Final default UI: 3/3 passed, with live opt-in absent. Recorded mode and both API disabled refusals are checked.
- Final integrated UI: 3/3 passed. One test exercises 1440px desktop and 390px mobile flows, including native file import, inspection, graph selection/filtering, exact July Context download, failed historical query with no fallback/export, frozen controls, reset/reimport, and invalidation after edits. It then searches all 622 sources, verifies 32 shards and the global byte cap, compares the complete lexical response with actual adapter CLI output, checks exact downloaded lexical bytes, verifies omission-only/no-match status and stale export invalidation, and imports/queries the expanded native archive with exact relief Context download. No page errors or horizontal overflow were observed. Screenshots remain under ignored `apps/workbench/output/` and in the separate evidence archive.
- July native verifier: four exact Context outputs (33,364 / 23,998 / 38,990 / 48,385 bytes), deterministic repack and strict-time/pre-ingestion/historical/revocation/tamper refusals passed.
- PR2 preparation: 11 regressions, all passed; all 713 archived files verified. Expanded corpus: 24 tests passed. Extended integrity: 12 passed.
- Collection adapter: 17 regressions passed using its documented original 166-record fixture. Built expanded index contains 622 sources / 32 shards / snapshot `386c72114ee34a9da32eec6a546908f9f3a778b9d2044597e0709dd4ebecdbe8`.
- Expanded native verifier: six exact Context outputs, deterministic repack and all refusal/tamper cases passed. Native typed validation accepted all ten method proposals; these remain unreviewed and are not ingested by core reuse.

Example commands run after each verified expansion included `python3 .data/scripts/verify_corpus.py`, `python3 .data/scripts/verify_extended.py` (expanded example), the native verifier scripts with `--binary`, and `python3 collection-adapter/collection.py build corpus-index.json lexical-index`. Adapter regressions used `TACITUS_CORPUS_INDEX=/workspace/tacitus-workbench/examples/july-1914/.data/corpus-index.json python3 -m unittest discover -s collection-adapter -p 'test_*.py' -v` from the expanded `.data` directory. Logs and exact native receipts are retained in `verification/cloud/`.

## Failures and corrections

The initial browser run failed because Playwright's bundled Chromium was absent. `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright npx playwright install chromium` received HTTP 403 `Domain forbidden`; the test now accepts the explicit `TACITUS_TEST_BROWSER` path. Actual acceptance used system Chromium 154.0.8037.57, not Playwright's matching bundled revision. This is a known portability limit; the matching-browser run remains unverified in this cloud.

The first collection regression invocation used the expanded fixture and failed two hard-coded 166-source count assertions. Rerunning against the documented baseline fixture passed all 17; corpus and browser checks independently establish the expanded 622-source count. The first integrated browser extension failed because an omission-only text locator matched both a paragraph and raw JSON; narrowing to the status paragraph corrected the harness. An npm test invocation from repository root failed because there is no root package.json; the corrected application-directory invocation passed. Early attempts to inspect the pinned script in the preexisting shallow core clone could not resolve that commit; the separate public clone resolved it and contained the documented script.

## Scope and remaining work

All work is local. No push, PR, merge, deployment, paid service, credential access, persistent grant, security-setting change or legal-term change occurred. Original application reserved rights, Apache notices and source-data terms are retained. Publication awaits parent coordination and review of the concrete branch/artifact, including inherited application provenance and reserved-rights boundaries. No new application license is needed to preserve the current boundary. The inventory verifier passed for 37 application deliverables. A plain diff whitespace check flagged inherited CRLF line endings on added lines; `git -c core.whitespace=cr-at-eol diff --check` passed while preserving the original files’ line endings.

The lexical HTTP integration currently requires Linux `/usr/bin/python3` and a prepared local index at the documented fixed path. The browser lexical workflow intentionally exposes full-modern-collection search only; historical filters remain available through the audited CLI. No shared authorization, hosted access, automatic expert review, semantic extraction or model answer generation was added. Unreviewed annotations and source-specific jurisdiction/distribution cautions remain visible. These checks establish local runnable behavior and byte fidelity, not production readiness or answer-quality gains.
