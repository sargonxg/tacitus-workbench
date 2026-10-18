# Local authoring cloud verification — 2026-10-18

Repository: `sargonxg/tacitus-workbench`; integration branch
`feat/local-text-authoring-20261018`, based on main
`687d9d1d802a1c521862e21f80852ca6211c0691`. Existing main/tag and unrelated
checkouts were preserved during implementation. No private website source was
copied. The local executor's connection was checked with filesystem, git and
process reads after a disconnection callback; those checks succeeded and edits
remained present. No uncertain external write was repeated.

## Actual commands and results

- Fresh isolated `scripts/build-core.sh /workspace/tacitus-local-author-build`,
  Rust 1.95.0, locked dependencies, offline cached crates, four jobs and debug
  symbols/incremental disabled: **135 Rust tests passed**, both examples built.
  The public core commit remains `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`;
  no native schema/core source change or new dependency was needed.
- `NPM_CONFIG_CACHE=/workspace/.npm-cache npm ci --ignore-scripts
  --registry=https://registry.npmjs.org`: **29 packages installed**, lockfile
  unchanged. Node 24.19.0/npm 11.9.0. `npm run typecheck` and `npm run build`
  passed; the two inherited graph `use client` bundler warnings remain.
- `TACITUS_TEST_BROWSER=/usr/bin/chromium npm test`: **26 passed, 1 explicit
  native-helper skip**. Default server authoring is disabled.
- Same command with `TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1`, both live
  core and authoring opt-ins, both verified binary paths/digests and
  `TACITUS_TEST_ARCHIVE` pointing to the July native archive: **27 passed,
  zero failures/skips**. Full setup is documented in the root README and
  `LOCAL_TEXT_AUTHORING.md`; missing required configuration fails.
- Focused `node --test tests/local-author.test.mjs
  tests/local-author-browser.test.mjs` with the same full configuration:
  **9 passed, zero skips**. Independent code/security reviewer separately ran
  the real-helper unit suite: **8 passed, zero skips**, and approved the source,
  transport fix and setup documentation.
- Independent usability/source-integrity review passed on desktop/mobile with a
  different invented 311-byte BOM/CRLF/emoji/literal-markup source. Both native
  ZIPs retained every source byte and explicit annotation/relation/author value;
  manual inspect/query and byte-exact Context export, edit/clear lifecycle,
  multiline refusal and keyboard creation passed. Zero remote requests, page
  errors or overflow. The reviewer stopped their own server and reported no
  product blockers; semantic truth and rights remain unverified declarations.
- `node apps/workbench/scripts/verify-inventory.mjs`: **57 files verified**.
  `git diff --check` passed.

The actual Linux `knowledge_capture` SHA-256 was
`902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b`;
`local_author` SHA-256 was
`2c2beb208f77d860a53a5035d68e9d2e50fa062b331d45600e5364df6e872f04`.
Compiler/platform-dependent executable hashes are checked at runtime; source pins,
locked builds and tests are the reproducibility contract.

## Coverage and actual failures

Desktop 1440px and mobile 390px browser checks create a capsule from the synthetic
BOM/CRLF/multibyte source, require explicit entity/relation/direction and rights,
then inspect/query the real core. Downloaded ZIP bytes match the creation
response and SHA-256; exported Context matches the raw query response exactly.
Two unreviewed reported statements retain one source, qualifications and unknown
world validity. Strict validity, pre-ingestion and revocation refuse. Existing
recorded demo, graph selection/filtering, collection exact export and matched
checkpoint comparisons continue to pass. No browser request leaves loopback.

Malformed/tampered source/span/quote, ambiguous overlapping quotations, unsupported
files, body/source/archive limits, wrong helper identity, private file permissions,
helper failure, deadline, cancellation and repeated submission are exercised.
A producer ignoring abort cannot resurrect a stale capsule or export. Editing and
clear remove current generated artifacts/inspector state; saved downloads persist.

Early browser attempts failed on an unrelated review server occupying port 4343,
then exact labels on select controls. The other reviewer stopped only their owned
server; explicit select labels and startup-message readiness now establish test
server ownership. A subsequent pooled-connection `ECONNRESET` on a rejected POST
was resolved by closing rejected POST connections, preserving error statuses and
all request checks. The successful full run includes that transport fix.

The first clean-install attempt used npm's non-writable default home cache and
failed with ENOENT. The writable workspace cache command above succeeded. No
approval denial, permission escalation, credential use or lockfile change was
needed. Test logs and a synthetic native capsule/inspection/exact Context receipt
are retained in the task's local delivery artifact; no personal source was used.

## Limits

This bounded profile requires one source, two user-authored reported statements
and one defensible declared relation. Multiline quotes, PDF/OCR, remote imports,
automatic extraction and other epistemic types remain unsupported. Structural and
byte fidelity checks do not verify truth, rights or answer quality. No production
readiness, deployment, new legal terms, accounts or payment behavior is claimed.
