# TACITUS Workbench

Local evidence inspector integrating the public standalone interface and two source examples. Import a native ZIP, inspect its evidence graph, query the pinned Rust core, and export its exact Context JSON. Recorded examples are explicitly selected and never replace failed live requests. A separate lexical workflow searches 622 source records; it does not turn the collection into a native capsule or reviewed claims.

Published main includes the reviewed standalone interface from PR3 `5766d1cb3472f85d6ed702728295349e99641520` and example directories from PR1 `dd9dc217f8b839b2b00bf645b62bfb8272ee6146` and PR2 `9ed66eef932fee3b8888fcfed4ed582b0123c133`, integrated through PR4 and PR5. PR6 adds the operational architecture. Current builds pin merged core `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`; historical verification reports describe the checkpoints tested at the time. The existing v0.1.0 tag is unchanged.

See [operational architecture and release readiness](docs/OPERATIONAL_ARCHITECTURE.md) for the implemented flow, independent review responsibilities, release gates and proposed matched evaluation.

## Install and run recorded mode

Prerequisites: Node 24, npm, Python 3.11+ and Git. Tested on Linux with Node 24.19.0/npm 11.9.0. The committed npm lockfile resolves only official registry packages. No credentials or model account are needed.

```sh
cd apps/workbench
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm start
```

Open `http://127.0.0.1:4317`. The start guide explains collection versus capsule scope and offers **Start recorded demo**, exact native sample downloads, live-core controls and local context-reuse steps. You can also select **Recorded July 1914 example** in the execution controls and load its Context. This runs no native core. The optional recorded walkthrough remains a separate teaching example.

## Build and run the live core

Install Rust 1.95.0 through the official rustup distribution if absent. Keep its cargo binary directory on PATH. From the repository root, choose a new absolute output directory:

```sh
bash scripts/build-core.sh /tmp/tacitus-build
python3 examples/july-1914/prepare_example.py
python3 examples/july-1914/.data/validation/verify_native.py --binary /tmp/tacitus-build/core-build/target/debug/examples/knowledge_capture
export TACITUS_KNOWLEDGE_CAPTURE_BIN=/tmp/tacitus-build/core-build/target/debug/examples/knowledge_capture
export TACITUS_KNOWLEDGE_CAPTURE_SHA256="$(sha256sum "$TACITUS_KNOWLEDGE_CAPTURE_BIN" | cut -d ' ' -f 1)"
export TACITUS_LOCAL_INSPECTOR=1
cd apps/workbench
npm start
```

Import `examples/july-1914/july-1914.native-v2.zip` using the native file picker, inspect, then query with the default peace question and modern checkpoint `1792328100`. Build instructions and hashes are in [CORE_INTEGRATION.md](docs/CORE_INTEGRATION.md); the [merged-pin verification](docs/MERGED_CORE_PIN_VERIFICATION.md) records the fresh compatibility run. The core preparation script creates only four capsule crates; full EdgeQuake, Docker, inference and model credentials are not needed. Preparation helpers refuse existing output directories.

## Prepare the separate expanded collection

From the repository root, with the server stopped:

```sh
python3 examples/diplomacy-1914-v2/prepare_example.py
cd examples/diplomacy-1914-v2/.data
python3 scripts/verify_corpus.py
python3 scripts/verify_extended.py
python3 collection-adapter/collection.py build corpus-index.json lexical-index
```

Restart the opted-in server. **622-record lexical collection** calls the bundled Python adapter against its local 32-shard index, with a fixed 32,768-byte global output budget. Every query preserves exact source blocks, metadata, rights, warnings and omission counts, and offers exact JSON export. The browser search uses the complete modern collection without a historical filter; the adapter's CLI supports explicitly labeled calendar filters. Linux `/usr/bin/python3` is required by this local HTTP integration.

The separate `expanded-cases.native-v2.zip` can also be imported into the live native workflow. Use question `relief assurance`, known-as-of and valid-at `1792332960` to reproduce its relief fixture. The native capsule contains 46 unreviewed proposals and stays within native bounds. The baseline has 39 proposals; neither contains all 622 source records. Ten method proposals are separately represented but are not retrieved by the current core.

## Acceptance

```sh
cd apps/workbench
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
# With the live variables exported above and both examples prepared:
TACITUS_TEST_BROWSER=/usr/bin/chromium \
TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1 \
TACITUS_TEST_ARCHIVE="$(git rev-parse --show-toplevel)/examples/july-1914/july-1914.native-v2.zip" npm test
node scripts/verify-inventory.mjs
```

`TACITUS_ACCEPTANCE=1` requires live opt-in, binary/digest, native archive, and collection tests; missing configuration fails instead of silently running a partial suite. Native output budgets match the pinned core range of 2,048 to 250,000 bytes.

If system Chromium is unavailable, `npx playwright install chromium` installs the matching browser; omit `TACITUS_TEST_BROWSER` to use it. That download was blocked by the cloud network policy in this run, so the actual browser acceptance used preinstalled Chromium 154. Browser tests cover desktop/mobile recorded and live import/query, graph selection/filtering, exact native and lexical downloads, refusal without fallback, reset/reimport and stale export invalidation. See [cloud verification](docs/CLOUD_VERIFICATION.md) for actual commands, results and failures. [npm's clean-install contract](https://docs.npmjs.com/cli/v11/commands/npm-ci/) and [Playwright launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-executable-path) describe the dependency and browser setup.

## Rights and limits

[RIGHTS.md](RIGHTS.md) and [application boundaries](apps/workbench/APPLICATION_RIGHTS.md) remain in effect. Original eligible application modules retain reserved rights. Apache core/patch notices and FRUS/Gutenberg source terms are preserved; no new legal terms or application license is introduced. Lichnowsky's public-domain status is USA-specific, with Gutenberg distribution/trademark conditions retained.

The server binds loopback only and live operations require explicit opt-in. Native timestamps describe modern ingestion, not what a diplomat knew in 1914. Assertions, comparisons and metadata cautions remain unreviewed. Byte fidelity, local retrieval and historical filtering tests establish no answer-quality gains or production readiness. This workbench provides no hosting, accounts, payment, deployment or shared authorization service.

The onboarding fact fixture and downloadable ZIP copies are derived from the already shipped, checksum-verified source bundles. Regenerate them with `python3 scripts/prepare-onboarding.py`; use `--check` to verify without writing. Data tests bind displayed counts and download identities to the actual archived corpus/captures. See [onboarding verification](docs/ONBOARDING_VERIFICATION.md) for branch-specific checks.
