# Local verification · 12 November 2026

Fresh dependency installation, TypeScript checking and the full configured local suite pass: **113 tests, zero skips**, plus **14 Python importer tests** and the inventory verifier. This uses actual native helpers built from the existing pinned core commit `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`; the pin and artifact formats are unchanged.

The July 1914 example and expanded diplomacy corpus were rebuilt and verified locally. The latter contains 622 records in 32 shards. Authoring, import, collection and browser acceptance run with their real prerequisites, including genuine native example binaries. Recorded model output remains a saved recording; no new provider call was made.

## Reproduce

1. Follow `scripts/build-core.sh <build-directory>` using Rust 1.95.0 for the pinned four-crate native subset. Retain SHA-256 hashes of `knowledge_capture`, `local_author` and `batch_author`.
2. Prepare the July 1914 and diplomacy-1914-v2 examples with their `prepare_example.py` scripts; run the generated native/corpus/extended verifiers and build the lexical collection index. Follow [Core integration](CORE_INTEGRATION.md) and [release readiness](RELEASE_READINESS.md).
3. Prepare importer browser fixtures with `python tools/local-import/tests/prepare_browser_fixtures.py --output <collections-directory>`; run `python -m unittest discover -s tools/local-import/tests -v`.
4. From `apps/workbench`, run `npm ci` and `npm run typecheck`. For the complete suite, set the documented local inspector/authoring opt-ins, each helper path and SHA-256, the imported-collections directory, a working Chromium binary, acceptance/collection test opt-ins and the actual prepared native archive path. Run `npm test`, then `node scripts/verify-inventory.mjs`. The release guides define the exact environment variables.

Default-mode testing still has explicit prerequisite-dependent skips. Do not claim the full configured result merely from a default run. The helper hashes identify a local build; they are not an external release signature. A clean local suite does not prove hosted App isolation, current data, analytical quality, customer value or every inherited native platform feature.

See [formats, source rights, review state and offset conventions](FORMAT_COMPATIBILITY.md) before connecting another producer. No lossy converter or App-specific packet schema is introduced here.
