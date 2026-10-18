# Cloud batch-import verification — 2026-10-18

Repository `sargonxg/tacitus-workbench`, branch
`feat/local-manifest-import-20261018`, based on merged main
`a58301abf7cbc0899f7eba94d246709cac37a0c4`. Core remains pinned to
`6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`. Original worktrees, running local
servers, v0.1.0 and held private PR branches were preserved. No core/schema/new
package dependency, credentials, provider call, source URL fetch or hosted
deployment was introduced.

## Exact tested collection

The synthetic acceptance creates 128 independently declared UTF-8 Markdown files:

| Result | Actual count |
|---|---:|
| Full-source lexical records | 128 |
| Lexical index shards (at most 25 each) | 16 |
| Explicitly authored sources | 100 |
| Source-only documents | 28 |
| Native capsules | 4 |
| Native sources per capsule | 25 |
| Unreviewed reported statements | 200 |
| Distinct declared annotation authors | 100 |

Every file has BOM/CRLF, non-ASCII Zoë/emoji/CJK, literal markup and an untrusted
URL instruction. No URL is fetched. Each native source's full bytes, SHA-256,
quote byte offsets, source association, explicit annotation-author mapping,
source author and speaker are checked. Source-only records appear in the lexical
manifest/index with no semantic assertions and never enter native capsules.

A separate process importing unchanged declarations with `--previous` reuses all
4 native capsules, 128 source objects and 128 index rows, rebuilding zero rows.
The complete manifests match byte-for-byte. Tests change both authored source
bytes and qualifications, remove a source-only record, add identical content
under a different declared identity/provenance, then re-add the removed identity
at version 2. An additional native-source removal test verifies only explicitly
remaining sources/assertions are exported. Tombstones identify replaced/removed
local revisions; duplicates are flagged without implying corroboration.

## Commands and results

```sh
TACITUS_BATCH_AUTHOR_BIN=/workspace/tacitus-local-author-build/core-build/target/debug/examples/batch_author \
TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-local-author-build/core-build/target/debug/examples/knowledge_capture \
python3 -m unittest discover -s tools/local-import/tests -v
```

**7 tests passed, zero skips**, about 10 seconds. Independent code/security review
also ran this final suite: 7/7, zero skips. It covers the 128-document case,26
near-source-limit documents forcing byte-based native sharding, per-source bad
annotation diagnostics, corrupt previous files, self-consistently rehashed forged
lexical term rows, malformed/duplicate JSON/IDs, unsafe paths and file/directory
symlinks, FIFO, invalid UTF-8, size/rights refusals, existing-output preservation,
no-replace collision, SIGTERM cleanup and absent incomplete final output.

The batch Rust adapter was copied into the existing isolated four-crate workspace
and built with Rust 1.95.0 and `cargo build --locked -p tacitus-analysis --example
batch_author`. The unchanged native workspace's `cargo test --locked` was rerun:
**135 tests passed**. The updated clean build script copies/builds all three
examples; the public pin and original single-source helper remain unchanged.
A second full historical-core clone was not needed for this incremental helper
build. Initial bare `cargo` was not on PATH; using the existing
`/workspace/.cargo/bin`, CARGO_HOME/RUSTUP_HOME and cached official crates worked.

Actual Linux executable SHA-256 identities:

- batch_author: `1de728a9f0757cf2e5b21a94510ff3f4ed05ac1819add77cd3c48dcf09bf6aff`
- knowledge_capture: `902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b`
- unchanged local_author: `2c2beb208f77d860a53a5035d68e9d2e50fa062b331d45600e5364df6e872f04`

Compiler/platform can change executable bytes. Source pins, locked builds and
actual tests are the reproduction contract; the CLI verifies the selected binary
hashes. The existing single-source clean-clone workflow remains usable.

UI gates were rerun after `NPM_CONFIG_CACHE=/workspace/.npm-cache npm ci
--ignore-scripts --registry=https://registry.npmjs.org`:29 locked official packages
installed; typecheck/build passed with two inherited graph `use client` warnings.
Default `TACITUS_TEST_BROWSER=/usr/bin/chromium npm test`: **26 passed, 1 explicit
native-helper skip**. With the documented core/author opt-ins, identities,
prepared collection, July archive and `TACITUS_ACCEPTANCE=1`: **27 passed,zero
skips**. The existing live authoring browser now also imports a 64-character hexadecimal filename and
checks desktop/mobile width; no control/output identity was shortened.

## Independent reviews and fixes

Code/security review independently reproduced an initial cache gap: an old
lexical row with falsified terms and consistently rewritten hashes was accepted.
The importer now reconstructs every reuseeligible row from current exact source
text and the pinned tokenizer before allowing reuse. The original attack now
fails atomically, and a regression test preserves it. Producer identity was also
expanded to bind imported authoring modules and shipped lexical bundle/preparer.
The reviewer approved the final source and setup documentation.

Independent usability/source-integrity review used its own multilingual
source-only CLI fixture, checking exact bytes, duplicated content under distinct
provenance, metadata-only revision, removal, explicit unknown-calendar omission
and process-restart reuse. It also imported an actual 25-source/50-assertion batch
capsule into the running local browser on desktop 1440/mobile 390: native inspect,
keyboard query and exact raw Context export passed; all 50 assertions and 25 source
metadata records matched the ZIP; zero remote requests/errors/overflow.

An early mobile check found an unwrapped 64-character hexadecimal uploaded filename. A filename-only
`overflow-wrap:anywhere` repair preserves the full identity; the same browser
check now passes at 390px. Final attribution review caught loss of per-document
annotation-author names when setting batch operator as capsule author. The native
manifest now retains exact source-ID@version→unverified annotation-author entries,
and lexical metadata retains the separate name. An independent 2-source fixture
with different α/β annotation authors, different source authors, same quoted
speaker and a separate operator verified all associations survive native/lexical
exports. The final 100-author acceptance checks the same association in every
native ZIP. No native schema or invented source-speaker attribution was added.

Both independent reviewers approved the corrected implementation and guide.
Source-language bytes are preserved, but the unchanged tokenizer excludes tokens
of length ≤2 and provides no CJK segmentation. The guide documents this observed
limitation rather than claiming multilingual search quality.

## Limits of this evidence

The supported CLI cap is 256 current sources; actual acceptance tested 128 and a 26
near-source-size-limit case. Maximum-capacity/worst-case combinations, power-loss
or SIGKILL durability and non-Linux execution were not stress-tested. Ordinary
interruption and safe no-replace publication were tested. Native/lexical query
budgets can omit content explicitly; no cross-capsule native query is provided.
The importer verifies structural/byte fidelity and explicit declarations, not
truth, authorship authentication, rights, semantic sufficiency, production
readiness or improved answer quality. Existing hosted deployment holds remain.
