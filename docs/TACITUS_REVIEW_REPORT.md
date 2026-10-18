# TACITUS integration: independent review and corrections

Reviewed baseline: `231c2e97e44e3e95c201f5c5ff662db296e20d3a` on `integration/reproducible-workbench-20261018`. A separate reviewer agent (`/root/independent_review`) reviewed that unchanged commit and its recorded evidence, then reviewed the corrective working-tree diff. The reviewer made no file, branch, service or artifact changes. The baseline remains preserved in Git history and in its original Library attachments.

## Findings and disposition

**Confirmed medium defect, corrected:** the application advertised and validated native output budgets of 256–1,048,576 bytes, while the pinned core accepts 2,048–250,000. The reviewer reproduced HTTP 422 failures at both advertised extremes and a successful exact 38,990-byte peace fixture at the default. The UI and HTTP adapter now match the pinned core range. New contract tests exercise both accepted endpoints and rejected out-of-range/fractional values.

**Acceptance configuration gap, addressed:** the previous browser test could pass its recorded section while omitting optional native or collection sections. Explicit `TACITUS_ACCEPTANCE=1` now requires live opt-in, binary, executable digest, native archive, and collection checks. A deliberate missing-configuration invocation failed immediately, as required. Default recorded-only testing remains available and is labeled separately in the evidence.

**Negative test gaps, addressed:** tests now cover hostile Origin for both endpoints, a held native request rejecting a concurrent lexical request before body consumption, lexical query/body bounds when the collection is prepared, executable digest refusal before subprocess launch, subprocess timeout termination, and subprocess output overflow. These add tests around existing controls rather than relax the controls.

No critical/high security defect or additional concrete defect was found. The reviewer independently reran all three new contract tests and confirmed the corrective diff resolves the budget defect.

## Independent baseline checks

The reviewer independently passed TypeScript checking, the 37-file baseline application inventory, and both server-boundary tests. They inspected lockfile v3 and found all 53 dependency entries use official registry URLs with integrity hashes. They reproduced the live native peace response byte-for-byte (38,990 bytes), and a lexical request returning 622 indexed sources, 32 visited shards, and 31,960 serialized bytes. They confirmed the example directories match the supplied PR1 and PR2 commits.

Review covered loopback binding, exact Host/Origin checks, explicit live opt-in, credential-free core child environments, transport/output/deadline bounds, the shared concurrency lock, and the core's ZIP limits (64 files, 2 MiB per entry, 8 MiB total). Recorded mode is explicitly selected; live failures never substitute recorded results. Exports retain raw response text. Rights/notices remain preserved. No private website file was added by this integration.

## Rerun after correction

The coordinator ran:

```sh
cd apps/workbench
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
TACITUS_ACCEPTANCE=1 TACITUS_TEST_BROWSER=/usr/bin/chromium \
TACITUS_TEST_COLLECTION=1 TACITUS_LOCAL_INSPECTOR=1 \
TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-core-build/target/debug/examples/knowledge_capture \
TACITUS_KNOWLEDGE_CAPTURE_SHA256=5b1e05276784f8e460054b718535809f3dc2eaa265dc861ddbc954710167e420 \
TACITUS_TEST_ARCHIVE=/workspace/tacitus-workbench/examples/july-1914/july-1914.native-v2.zip npm test
```

Typecheck and build passed. The default suite passed 6/6; explicit full acceptance passed 6/6 with no skips. Desktop/mobile live native import, graph/query behavior, exact exports for both capsules, 622-source lexical search and exact export, no-match omission output, stale export invalidation, boundary tests and new contract tests all passed. Logs are in `verification/cloud/review-*.log`. Core, source data, dependency manifest/lockfile and legal notices were unchanged by the correction, so their successful baseline checks were not rerun unnecessarily. The refreshed application inventory contains 38 verified deliverables.

## Remaining evidence limits

- Playwright's matching Chromium download returned HTTP 403 in this cloud. Browser acceptance used preinstalled Chromium 154.0.8037.57. Matching-browser acceptance remains unverified here.
- Private-source provenance is inherited from PR3's inventory; neither reviewer nor coordinator accessed the private upstream source or independently proved its historical extraction provenance.
- The separate reviewer inspected clean-install logs and the lockfile, but did not repeat the installation, full browser suite or Rust suites. Those coordinator-run results are reported separately.
- Tests and byte equality establish local runnable behavior and structural fidelity, not production readiness, semantic accuracy or answer-quality gains. Assertions and method proposals remain unreviewed.

The original running loopback service was preserved without interruption or exposure. Its Node backend process was not restarted to load adapter changes; corrected behavior was verified in separate test-server processes. A future local restart loads the corrected backend. Nothing was pushed, merged, published or deployed. Parent review and coordination remain required before any draft PR publication.

## Attachment status

The prepared Library transfer helper failed at tool discovery with a network error before any upload began. The supported host-upload action then saved the five baseline artifacts successfully, without duplication of a prepared upload or any credential handling by task code. Corrected source, Git bundle, report, evidence and checksum attachments are saved separately to preserve the reviewed baseline. No sharing grant or public URL was created.
