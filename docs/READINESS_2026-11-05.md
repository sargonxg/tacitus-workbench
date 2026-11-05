# Workbench readiness · 5 November 2026

This pass checks the engineer-facing quickstart and the two browser interfaces.
It starts from Workbench commit `00598b502471dc54857065e96967a39ff181639e` and adds a
Node-only static preview command plus clearer setup and readiness documentation.
No source rights, native formats, core pin, application behavior or service access
policy changes are included.

Environment: Linux, Node 24.19.0, npm 11.9.0, Python 3.12.14 and system Chromium
154.0.8037.57. Browser previews remained on loopback.

## Runnable surfaces

| Surface | Implemented behavior | Verification in this pass |
| --- | --- | --- |
| Static Context explorer | Loads a labelled recorded example or a local `tacitus-uploaded-knowledge-context/1` JSON file. Inspects evidence/layers and exports the original JSON bytes. | Clean install, typecheck, static build, the documented preview command and desktop/mobile browser tests passed. No API or native process is involved. |
| Recorded local workbench | Loopback Node server, explicit saved examples, graph inspection, sample downloads and local context inspection. | Local build, disabled-server boundary and desktop/mobile recorded interface tests passed. |
| Native query and bounded text authoring | Local adapters, helper source, pinned build script, digest checks and explicit opt-ins exist. | Adapter/contract tests passed using test fixtures. The actual Rust core/helper acceptance did **not** run. Cargo is absent from PATH. |
| Manifest collection and collection queries | Separate Python/native importer, lexical indexes, collection receipts and a browser explorer exist. | Native/prepared-collection acceptance remained skipped. Archive preparation and byte-identity checks passed; this does not certify a new native collection run. |

The static viewer, local workbench, Middle East kit and DIALECTICA use distinct
contracts. No interchange adapter or PRAXIS attachment bridge is verified by
opening one recorded example. The local server supplies no hosted accounts,
shared authorization or multiuser persistence. Static deployment would expose
only the read-only viewer and its bundled public examples.

## Commands executed

From `apps/workbench`, using the committed lockfile:

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm run typecheck
npm run build
npm run build:showcase
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
npm run preview:showcase
```

- Clean install completed with 29 packages. Both builds and TypeScript checking
  passed. The inherited graph modules still emit `use client` bundler warnings;
  the builds complete.
- The documented preview command served `http://127.0.0.1:8767/` with HTTP 200.
  A browser loaded the recorded context, opened the context-layer inspector and
  observed no page errors or horizontal overflow at 1440 pixels. The preview was
  stopped after verification.
- The complete default suite ran **45 tests: 40 passed, five skipped, zero
  failures**. Static-viewer checks exercise desktop/mobile layout, exact-byte
  export, local JSON import, escaped text, invalid-import refusal and absence of
  API calls. Other tests cover recorded onboarding, API boundaries, export
  invalidation and fixture-based adapter behavior.

The first test attempt lacked permission to open loopback sockets in the
execution sandbox and was stopped. The successful run above had local-network
permission. This is an executor requirement, not a dependency of the application.

From the repository root:

```sh
python3 scripts/prepare-onboarding.py --check
python3 -m unittest discover -s examples/july-1914 -p 'test_*.py' -v
python3 -m unittest discover -s examples/diplomacy-1914-v2 -p 'test_*.py' -v
```

Onboarding facts/download hashes matched the shipped source bundles. Both example
preparation suites passed **11 tests each**, covering archive identities,
expansion and refusal of unsafe or changed archives. No network source fetch or
native execution is performed by these checks.

## Acceptance still required

Five default-suite cases were explicitly skipped:

1. Manual cited-brief browser acceptance with live native and saved collection
   packets.
2. Browser exploration of prepared real collection imports and query receipts.
3. Complete importer-output/receipt membership validation.
4. Native-capture identity, citation and receipt tamper validation against prepared
   collections.
5. The configured Rust helper → native ZIP → actual core inspect/query/refusal
   path.

`command -v cargo` found no executable. Running `scripts/build-core.sh` with a
fresh temporary output path returned its expected missing-Cargo error before
creating that directory. No Rust toolchain was installed, no core was built, and
historical Rust receipts were not counted as current passes.

To run full acceptance, follow the [pinned-core setup](../README.md#build-and-run-the-live-core),
prepare both examples and the [browser collection fixtures](LOCAL_COLLECTION_EXPLORER.md#reproduce-acceptance),
then use the root guide’s `TACITUS_ACCEPTANCE=1` command. It deliberately fails
when its required native configuration is missing. The historical
[release audit](RELEASE_READINESS.md) and [core-pin receipt](MERGED_CORE_PIN_VERIFICATION.md)
retain their original verification dates.

Provider calls, model-answer quality evaluation, automatic extraction, hosted
multiuser operation and production PRAXIS integration were not run. No model
quality gain or diplomatic outcome is established by interface tests. PRAXIS is
paused; it remains separate from these local tools.

No remote push, deployment, release tag, Cloudflare resource or domain change was
performed. Application rights and source notices are unchanged.
