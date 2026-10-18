# Validation record

Candidate prepared and checked on October 18, 2026. These checks validate provenance, deterministic behavior and bounded source fidelity. They do not authenticate human review of the semantic proposals.

## Source and annotation checks

- `validation/corpus-tests.txt`: 24 passing integrity regressions, including distinct records/hashes, exact UTF-8 block offsets, source inputs, baseline preservation, complete selected chapters, chronology exceptions and composite-packet filtering.
- `validation/extended-tests.txt`: 12 passing regressions, including exact source/capture matches, native size limits, all casebook references, dependency links, exact evidence offsets, qualifier retention, method boundaries and historical comparison filtering.
- Independent assistant review reran both suites, independently traversed the added XML records for substantive block coverage, inspected rights/provenance and performed bounded reading of the 46 added proposals. Two issues found during review were corrected: a mismatched casebook claim ID and a stale baseline-only rights selection paragraph. The regression suite now covers both.
- `validation/cognitive-methods-native.json`: all ten method proposals pass the existing native `CognitiveMethod` validator; an independent rerun reproduced this output byte-for-byte. The methods remain separate from the supported `knowledge_capture` ingestion path.

## Native capsule checks

`validation/expanded-native/acceptance.json` records 12 passing checks against the pinned-source Rust CLI: six exact output reproductions, exact source assertion/quote preservation, output budgets, four empty-stdout refusals (strict unknown interval, pre-ingestion, historical 1914 and revoked source), deterministic full archive repack and evidence-tamper refusal.

An independent assistant reviewer reran this portable verifier and reproduced all 12 checks, including all six exact outputs.

The examples retrieve between four and fourteen linked authored assertions. Their sizes and selected counts are reported per request. These figures are descriptive fixtures, not relevance/accuracy scores. Lexical matches and bounded dependency closure may include material beyond the narrow wording of a question.

The current expanded archive SHA-256 is `7ad38b4d6db8269b1a642d400183230e78bddc0a89e77ca7585e92f23fcf1608`. The tested executable SHA-256 is recorded in the receipt; build paths and platforms can change executable bytes. The existing 135 native-core tests were also rerun successfully in the isolated build used for this candidate.

## Collection and deterministic reconstruction

- `collection-adapter/FILES.json` pins the unchanged 19-file reviewed adapter handoff, including notices and result payloads. Independent review reproduced its 17 tests and the full 622-record run against catalog SHA-256 `75e17341a7c78203ea31526863fdd3ec2b0a2ed272b9c6b9e4f6f900312c993c`.
- `collection-adapter/results/report.json`, SHA-256 `8397e9223688277bafbcb3a0cc550352bed7b45f06ad22380fb6c480eb217545`, records five queries visiting all 32 shards under a shared 32,768-byte budget. An unchanged update reuses 622 index rows. An explicit metadata-only regression changes one row and one shard. The 166-to-622 update reuses four memoir rows; all 162 old FRUS rows correctly change revision because their metadata changed. This is not a speed or semantic-quality gain measurement.
- `validation/collection-adapter-tests.txt` records a further local rerun of all 17 tests. The two README example queries and historical selections are retained in `validation/`.
- `validation/rebuild.json` records an isolated deterministic rebuild from the retained source bytes and explicit authored definitions: the catalog, manifest, 622 normalized texts, casebook, annotation/method definitions, statistics, native fingerprints and native ZIP reproduce exactly.

## Boundaries

All 85 assertions and ten methods remain explicitly assistant-authored unreviewed semantic proposals. Source counts and paragraph counts are not automatically extracted fact counts. The full-corpus path is lexical source selection; the expanded native capsule contains 31 sources and 46 assertions. No model comparison, semantic extraction benchmark, historian-level validation of every document, worldwide rights clearance, production authorization system or UI integration certification is claimed.

Publication of this candidate is a separate step. The published 166-record baseline remains independently accessible at its original pinned commit.
