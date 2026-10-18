# Offline harness verification — 18 October 2026

Base workbench main: `41f46e96657d925525b336965c0d3dad133b8875`. Implementation
branch: `feat/offline-matched-evaluation-20261018`. The reviewed commit/PR and
external handoff receipt identify the final candidate. This is capability
verification, not a model-answer study or measured answer-quality gain.

Environment was already running in `/workspace`; no environment startup,
deployment, credentials, paid service or security setting changed. Node24/npm11,
Python3.12 and Linux were available; this new CLI needs only Python's standard
library plus the already reviewed native core executable. No dependencies were
added or installed. Existing worktrees/previews were preserved.

Pinned core source: `6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`.
Actual executable from the previous fresh-build proof:
`/workspace/tacitus-release-clean-build/core-build/target/debug/examples/knowledge_capture`.
SHA-256: `902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b`.
The current change does not alter core or its schemas.
July native archive SHA-256:
`c7268bef3b19ff9b93458a64e476dd52df1c76f074e77fe149d2983268a66e5f`.

## Commands and results

From the repository root:

```sh
export TACITUS_KNOWLEDGE_CAPTURE_BIN=/workspace/tacitus-release-clean-build/core-build/target/debug/examples/knowledge_capture
python3 -W error::ResourceWarning -m unittest discover -s tools/offline-eval/tests -v
node apps/workbench/scripts/verify-inventory.mjs
git diff --check
```

**18 tests passed, zero skips** (1.356 s in the retained acceptance run). Native
retrieval and exact-byte comparison use the real pinned executable. Answer and
rating fixtures are explicitly synthetic, fabricated only inside reproducible
tests; they never stand in for actual model output or a completed human study.
All 59 existing application inventory entries still verify. Root/application
rights, Apache/dependency notices and source-data bundles are unchanged.

Coverage includes full-source/annotation availability; deduplicated content-only
lexical ranking; equal complete-prompt/evidence byte ceilings; exact native output;
random assignment/seed privacy; split IDs/normalized texts/paraphrase groups/gold
field rejection; source/citation hashes and UTF-8 adjacent/gapped interval coverage;
wrong prompt/model/tokenizer/origin/answer/rubric identities; duplicated records;
unknown measurements and known token-budget violation; missing/error/refused
retrieval/model runs; rated abstentions, human regressions and disagreement; byte-
bound source closures; nullable source authors; frozen-file tampering/unlisted
paths/symlinks; versioned malformed-ZIP errors; actual SIGTERM staging cleanup;
and a final-child deadline check before publication.

No browser/application code, existing importer/query logic, dependency lock or
pinned Rust source changed. Prior app/core test counts in release reports retain
their original checkpoints; this pass claims the actual new CLI tests above.

## Retained end-to-end CLI acceptance

All four documented subcommands were also run as actual shell commands from the
root checkout. They used the test's explicitly synthetic-origin plan with a single
exposed development question and a separate excluded held-out question marker.
The latter is absent from exported prompts. No answer was invented in this CLI
run: the template kept both answers missing, ratings empty and every paired score
unknown. This is a reproducible harness test, not an external-model experiment.

Local retained directory: `/workspace/tacitus-offline-eval-delivery-20261018`.
Its `experiment/` freezes all 28 July sources and 39 unreviewed assertions. Both
retrieval arms exported ready prompt packets. Exact identities:

- Experiment ID: `0ee53e7c33a0cee09a1d19ca4bf795d66111254572cc576f8775cb92ab62784b`.
- Trusted manifest SHA-256: `266b45b5076c135b6577e6aea068ae1bf72c14966242b8237c037470266caaab`.
- Report: one frozen question, two missing answers, zero answered runs, zero human
  comparisons, null score means. Latency, token counts and costs remain unknown.

`freeze-receipt.json`, `template-receipt.json`, `review-receipt.json` and
`report-receipt.json` record the commands' returned identities/counts. A separate
retained unittest artifact at
`/workspace/tacitus-offline-eval-retained-test-20261018` likewise contains only the
frozen test experiment, missing-answer template, blind review and empty-results
report. No provider was contacted.

## Independent reviews and concrete corrections

An independent research-method reviewer examined source matching, annotation
access, leakage controls, resource matching, blinding, abstention/denominator
handling and final guide/report wording. An independent code/integrity reviewer
examined snapshot identities, safe input/output boundaries, citation mechanics,
measurement provenance, cancellation and failure behavior. Both independently ran
the real-core synthetic suite and checked the empty-results artifact. Their
reviews do not authenticate source truth, actual provider/model identities or
human-rating declarations.

The first draft's tests passed but reviews identified real gaps: metadata-sensitive
ranking and duplicate annotation serialization, overly strict single-span citation
presence, public randomization seed, eligibility differences, ambiguous core exit
classification, insufficient expanded-candidate/traversal bounds, nullable-author
handling, report input-hash rereads and final deadline precision. These were
corrected with dedicated adversarial regressions. Model abstentions now participate
in matched human comparisons while absent/error/retrieval-refused runs remain
explicit. Baseline unselected-candidate counts are clearly separate from native
omitted assertions. A resource warning on an intentional extra-path refusal was
fixed with deterministic iterator closure. A duplicate-ZIP fixture intentionally
emits Python's duplicate-name warning; the malformed archive is refused.

## Remaining blockers for an actual study

An operator must select and freeze real external model/version/tokenizer/settings,
prepare independent questions/paraphrase groups and separate gold/rubrics, declare
prior exposure, obtain actual external answers/measurements, and conduct explicit
human review under reported blinding conditions. Token matching is unverified
without exact external measurements; unknown values are not inferred. Small
ordinal development summaries establish no statistical superiority or source/
domain generalization. Cloud/hosting remains unsupported and PRAXIS/Foundry holds
remain in force. No release tag or deployment is needed for this capability.
