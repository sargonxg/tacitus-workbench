# Product explanation and guided onboarding — 2026-10-18

This bounded change adds a usable start guide to the existing local product. It is based on reviewed PR4 commit d08756d059c4ff8dfcf2efc099cf318f9f14f0c8, on separate branch integration/product-onboarding-20261018 in the isolated /workspace/tacitus-onboarding worktree. PR4, its service, main, PR1–3 and the actor branch were not modified. No merge, push, deployment, new dependency, credential or security-setting change occurred. The owner's deployment-hook answer remains pending; the actor transfer was not retried.

The start guide explains TACITUS as reusable evidence-linked knowledge structures for policy and diplomacy. It distinguishes the 622-record collection (618 FRUS publisher records and four retrospective memoir sections), July capsule (28 sources/39 unreviewed authored assertions), expanded capsule (31/46), and native versus lexical JSON exports. It does not claim reviewed truth, automatic semantic extraction, a model-account connection, synchronization, measured answer improvement or production readiness.

Two primary actions are above the scope cards so desktop/mobile users can start immediately. Start recorded demo invalidates prior work, selects recorded mode and loads the existing exact peace Context. Open live-core controls invalidates the prior export, selects live mode and moves keyboard focus to the execution section. This does not enable the core or run an unavailable operation. The guide provides exact downloadable native samples, their actual questions/checkpoints, clear modern-ingestion versus historical-clock language, a short local model-neutral reuse instruction, and existing source-rights links. The full-source index anchor moves focus to the separate lexical section. Neither raw corpus data nor arbitrary model inputs were added to the explanation.

## Facts and download provenance

scripts/prepare-onboarding.py uses only public files already present in the checkout. It verifies the pinned hashes and all manifest member hashes/types/sizes of the July and expanded source bundles (209 plus 713 files) using their existing reviewed safe validators, then derives the small onboarding-facts.json fixture from the actual corpus/captures. No extracted code is executed. Native public download bytes must also match the native ZIPs already shipped beside the bundles.

The July download SHA-256 is c7268bef3b19ff9b93458a64e476dd52df1c76f074e77fe149d2983268a66e5f. Expanded download SHA-256 is 7ad38b4d6db8269b1a642d400183230e78bddc0a89e77ca7585e92f23fcf1608. The only HTTP adapter change is adding application/zip to static MIME types under its existing bounded static root. Host/origin, opt-in, process, body, output and concurrency controls remain unchanged. Reserved application rights, Apache notices and source distribution terms remain intact.

## Commands and results

A fresh npm ci --offline --ignore-scripts --cache=/workspace/.npm-cache succeeded in the new worktree using cached official-registry packages. No shared node_modules junction or package/lockfile changes were introduced.

From the repository root, python3 scripts/prepare-onboarding.py and python3 scripts/prepare-onboarding.py --check passed. Both existing safe example preparation helpers expanded and verified their bundles; the existing collection adapter built the 622-source, 32-shard index in this isolated worktree. From apps/workbench:

```sh
npm run typecheck
npm run build
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
TACITUS_ACCEPTANCE=1 TACITUS_TEST_BROWSER=/usr/bin/chromium \
TACITUS_TEST_COLLECTION=1 TACITUS_LOCAL_INSPECTOR=1 \
TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-core-build/target/debug/examples/knowledge_capture \
TACITUS_KNOWLEDGE_CAPTURE_SHA256=5b1e05276784f8e460054b718535809f3dc2eaa265dc861ddbc954710167e420 \
TACITUS_TEST_ARCHIVE=/workspace/tacitus-onboarding/examples/july-1914/july-1914.native-v2.zip npm test
```

Final typecheck/build passed. Final default suite passed 8/8; final explicit full acceptance passed 8/8, with zero skips. The final suites reference the rebuilt layout with start actions above the cards. The two inherited build warnings about use-client directives remain; no new build warning was introduced.

New data tests independently read the archived corpus/captures to check counts, run the source fixture verifier, and compare public download bytes/hashes with the original native archives. New browser tests exercise 1440px and 390px widths: displayed counts and scope copy; local rights/download links; existing pinned run-guide URL; source-index anchor focus; actual browser ZIP download; recorded mode/action/focus and exact export; live mode/action and stale-export invalidation; actual downloaded ZIP import/inspection/query and exact live export in full acceptance; reset; no horizontal overflow; no page errors. Existing native/lexical full acceptance and negative boundary tests also pass. The external GitHub run-guide page was not fetched again; its pinned target is the previously published PR4 README and the local source test verifies its installation instructions.

Screenshots under ignored apps/workbench/output/onboarding-*.png show overview and actual recorded/live states at both widths. The evidence archive retains them. Core and source data are unchanged, so their existing 135-test/two-build and ten exact-native-fixture results were not rerun unnecessarily.

## Independent review and limits

The separate reviewer independently passed the source data test and typecheck; confirmed the exact counts and download provenance; inspected the final header/action relocation; and found no concrete defect. An isolated browser on port4330 independently verified keyboard activation/focus, mode switching, source-index/live navigation, byte-exact recorded export and July download, working local links, stale export removal, disabled live import without opt-in, no overflow and no page errors at desktop/mobile sizes. Only that reviewer's own browser/server were closed. See ONBOARDING_REVIEW.md for its scoped findings.

This was focused keyboard/browser accessibility checking, not a screenreader audit. The matching Playwright browser is still unavailable due to the earlier proxy403; system Chromium154.0.8037.57 was used. No new transfer or permission request was made to bypass that restriction. Initial tool startup briefly reported no usable environment before it became available. One final-polish edit invocation used the wrong working-directory prefix and changed no file; the corrected absolute-path edit was followed by final rebuild/default/full gates. No approval denial occurred.

Publication remains pending parent review. The existing release gate is unchanged: owner confirmation of deployment-hook behavior is awaited. No new release blocker was introduced by this onboarding change.
