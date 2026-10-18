# Diplomacy under pressure, 1914: expanded evidence collection

Version 2 candidate expands the [published July 1914 example](https://github.com/sargonxg/tacitus-workbench/tree/dd9dc217f8b839b2b00bf645b62bfb8272ee6146/examples/july-1914). Start with **“Could a diplomat see escalation coming in July 1914?”**, then follow how consent, authority, communication delays, neutral rights and humanitarian permissions are qualified as the war develops.

## Open the example

The ready native archive is [expanded-cases.native-v2.zip](expanded-cases.native-v2.zip). [example-data.zip](example-data.zip) contains the full 622-record collection, baseline archive, reviewed collection adapter, authored annotations, exact query fixtures and reproducible source inputs. [DATA_MANIFEST.json](DATA_MANIFEST.json) lists all 713 files with sizes/hashes and source-rights links. The archive is 3,206,084 bytes; verified expanded payload is 21,080,802 bytes.

Read [RIGHTS.md](RIGHTS.md) and the retained [Gutenberg license](LICENSE-GUTENBERG.txt) before redistribution. Public repository access does not grant a new open-source license for eligible original annotations/code; the underlying public-domain and Apache exceptions remain intact.

From the repository root, with Python 3.11+:

```sh
cd examples/diplomacy-1914-v2
python3 test_prepare_example.py
python3 prepare_example.py
cd .data
```

The preparation helper makes a new `.data/` directory only after checking the pinned archive, every path/size/hash, regular-file types and bounded total size. It rejects traversal, symlinks, duplicates, unlisted files and oversized archives, refuses existing output, and executes no extracted code. Use `--output /existing/parent/new-directory` for another copy. The remaining commands below run from the expanded `.data/` directory.

The data ZIP SHA-256 is `a5dd21b2edc4850b0c155c5fb33c803e838c3c47edeae148379af4e227cac0aa`. The outer helper changes only the baseline helper's pinned archive/root and bounded member limit; its 11 regressions include full expansion of the supplied archive.

For a quick source-to-question tour, open [EXPANDED_CASEBOOK.json](EXPANDED_CASEBOOK.json). [cognitive-methods.json](cognitive-methods.json) exposes the ten scoped, separately validated proposals. [STATISTICS.json](STATISTICS.json) and [VALIDATION.md](VALIDATION.md) state measured counts and validation limits. These readable files also appear in the expanded archive.

## What is actually here

- **622 distinct source records**, up from 166: 618 official FRUS document records in 18 complete selected chapters, plus the same four retrospective Lichnowsky memoir sections. The 456 added records are distinct publisher records with distinct normalized text hashes.
- **910,023 normalized UTF-8 source bytes**, 4.33 times the baseline; 4,452 structural blocks and 2,574 paragraphs. Blocks and publisher-marked people are structural data, not automatically extracted facts.
- **85 explicitly assistant-authored, unreviewed assertions** in two separate native capsules: the unchanged baseline 39, and 46 new proposals (37 attributed statements and nine evidence-bound comparisons).
- **10 reusable analytical checklists** represented as native `CognitiveMethod` values, with prerequisites, failure conditions and exact source spans. The existing native validator accepts these values. The current `knowledge_capture` reuse command does not ingest or retrieve them; their separate validation is not an integration claim.
- A collection-wide lexical adapter can search all 622 records through **32 index shards of at most 25 sources**, with one global serialized-output budget. These shards are index partitions, not native semantic capsules. Each authored native capsule still respects the core's 32-source/256-assertion limits.

The baseline's source text bytes, hashes and original capture remain unchanged in `baseline/`. The expanded catalog adds metadata cautions to existing FRUS rows, so those rows have new collection-index revisions even though their source text is unchanged. `STATISTICS.json` contains derived counts.

This collection is broader than July: explicit source dates run from June 15, 1914 to January 5, 1915, and one printed receipt says January 14, 1916. No claim is made that this is an exhaustive diplomatic archive or a historian-validated account of the war.

## Read the evidence

`corpus-index.json` contains exact normalized text, source URLs, rights IDs, historical metadata, and structural block offsets measured in UTF-8 bytes. The corresponding individual files are in `texts/`. `corpus-manifest.json` records chapter membership, transform details and pinned inputs. The original official XML and Gutenberg edition are retained in `upstream/`.

`EXPANDED_CASEBOOK.json` connects ten practical questions to exact authored claim IDs, comparisons and reusable questions. For example:

1. Did acceptance in principle mean a peace treaty had been signed? The selected correspondence distinguishes acceptance, signature steps and a diplomat's forecast.
2. Was an informal peace suggestion an authorized government position? The mediation cases preserve the difference between a reported belief, a conditional private statement and a formal reply.
3. Did an assurance cover all relief? The cases distinguish a request, reported approval, U.S. authorization, the named commission's channel, personal capacity and a delivery-dependent expiry whose date is unknown.
4. Does a zero count show censorship stopped? A bounded report of messages is kept separate from carrier coverage, routes, time windows and requests for specific incidents.
5. Did hospital-supply assent remove all exceptions? The proposals preserve undefined scope, absence of a reply, urgent-necessity and destination conditions, and compensation wording.

These are questions supported by this collection, not universal empirical laws, current legal advice, or verified implementation of diplomatic promises. All statements retain attribution; the existence of a source does not establish the truth of its contents.

## Start without compiling Rust

From the expanded collection directory, with Python 3.11 or newer:

```sh
python3 scripts/verify_corpus.py
python3 scripts/verify_extended.py
python3 scripts/historical_snapshot.py --cutoff 1914-07-30 --basis source-created --annotation-set both > source-created-july30.json
python3 scripts/historical_snapshot.py --cutoff 1914-07-30 --basis recipient-received --annotation-set both > recipient-received-july30.json
python3 collection-adapter/collection.py build corpus-index.json ../diplomacy-index-v2
printf '%s' '{"question":"relief assurance permission","max_bytes":32768}' | python3 collection-adapter/collection.py query ../diplomacy-index-v2
printf '%s' '{"question":"mediation peace","max_bytes":32768,"cutoff":"1914-07-30","date_basis":"recipient-received"}' | python3 collection-adapter/collection.py query ../diplomacy-index-v2
```

Use a new output path for each index build. For an incremental update, append `--previous ../diplomacy-index-v2` when building a new directory from a revised catalog. See `collection-adapter/README.md` for revisions, tombstones, caller-supplied revocations, omission reporting and prototype boundaries. Query output is source context, not a generated answer or a native capsule. The adapter's full-source metadata, exact passages and warnings must stay together.

## Load the existing native contracts

The native archives are `baseline/july-1914.native-v2.zip` and `expanded-cases.native-v2.zip`. A consumer supporting the pinned core's native-v2 uploaded-knowledge profile can inspect/import either separately. No website/UI import integration is asserted by this bundle.

The expanded archive SHA-256 is `7ad38b4d6db8269b1a642d400183230e78bddc0a89e77ca7585e92f23fcf1608`. The catalog SHA-256 is `75e17341a7c78203ea31526863fdd3ec2b0a2ed272b9c6b9e4f6f900312c993c`.

To build the reviewed CLI, use Git, Python 3.11+, Rust 1.95.0 and the locked official crates.io dependencies. The initial fetch needs network access; subsequent builds can add `--offline` when dependencies are cached. No model account, paid inference, PDFium or full EdgeQuake server is required. Run these commands from this collection directory, choosing fresh sibling paths:

```sh
CORPUS="$(pwd)"
git clone https://github.com/sargonxg/tacitus-political-policy-second-brain.git ../diplomacy-core
git -C ../diplomacy-core checkout 0d47eafd93f2b4a5e4a926d3c761410b1c319cd6
git -C ../diplomacy-core apply --check "$CORPUS/integration/source-span-recall.patch"
git -C ../diplomacy-core apply "$CORPUS/integration/source-span-recall.patch"
python3 ../diplomacy-core/scripts/prepare-capsule-workspace.py ../diplomacy-core-build
cp scripts/fingerprint_capture.rs ../diplomacy-core-build/crates/tacitus-analysis/examples/fingerprint_capture_local.rs
cp scripts/validate_cognitive_methods.rs ../diplomacy-core-build/crates/tacitus-analysis/examples/validate_cognitive_methods.rs
(cd ../diplomacy-core-build && cargo +1.95.0 test --locked && cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture --example fingerprint_capture_local --example validate_cognitive_methods)
BIN="$(cd ../diplomacy-core-build && pwd)/target/debug/examples/knowledge_capture"
"$BIN" inspect expanded-cases.native-v2.zip
"$BIN" reuse expanded-cases.native-v2.zip < validation/expanded-native/relief.request.json
python3 scripts/verify_expanded_native.py --binary "$BIN"
../diplomacy-core-build/target/debug/examples/validate_cognitive_methods annotations/expanded/capture.json annotations/expanded/cognitive-methods.json
```

The six frozen example requests and outputs are in `validation/expanded-native/`. The portable verifier checks exact selected assertion and citation bytes, all six complete output bytes, their budgets, deterministic repack, four refusal cases and evidence tampering. Its executable hash may differ across build paths/platforms; matching source pins and outputs matter. `integration/` preserves the Apache patch, license, notices and original baseline integration notes.

## Reproduce transforms and authored proposals

These commands operate on an editable copy of this collection. They use the retained source bytes and explicitly authored annotation definitions; they do not run a semantic extraction model.

```sh
python3 scripts/build_corpus.py
python3 scripts/build_extended_annotations.py
../diplomacy-core-build/target/debug/examples/fingerprint_capture_local < annotations/expanded/capture.unfingerprinted.json > annotations/expanded/capture.json
python3 scripts/build_stats.py
python3 scripts/verify_corpus.py
python3 scripts/verify_extended.py
../diplomacy-core-build/target/debug/examples/knowledge_capture pack annotations/expanded/capture.json ../expanded-rebuilt.native-v2.zip
```

The native fingerprints are computed by the existing Rust types, rather than guessed JSON canonicalization. The `original_hash` in each native `SourceRecord` binds its normalized input text; upstream edition hashes and the transform are separately recorded in the corpus manifest. The old baseline transformation deliberately remains unchanged; its omission of some unwrapped closing-role labels is disclosed. The new records preserve standalone list/table/closer/seal blocks. Editorial notes and page breaks are excluded from the normalized historical text; notes remain separate metadata. Printed brackets are not automatically treated as contemporaneous knowledge.

## Time and knowledge boundaries

- The native checkpoint `1792332960` for the expanded capsule is modern ingestion on October 18, 2026. It is not a historical knowledge timestamp. The baseline keeps its original checkpoint. Native historical/pre-ingestion requests refuse rather than impersonate a 1914 observer.
- Historical calendar selection is a separate, partial reconstruction. A source-created date does not prove delivery or awareness. A recipient-received date applies only to its declared receiving context. Neither becomes a precise UTC instant.
- All four memoir sections were composed retrospectively in 1916 and are excluded from historical selection. Their early-war subject matter cannot move them into a 1914 snapshot.
- Unknown and basis-specific ambiguous dates are withheld. Twelve records include primary components dated later than their outer dateline; whole-record source-created filtering withholds these instead of leaking future enclosures. Some receipt clocks are withheld too. An additional packet has a later component than its outer receipt. The flags, raw datelines and reasons are preserved in the catalog.
- Printed 1916 receipt and conflicting 1913 inferred bounds are retained, not silently repaired. One later editorial correction conflicts with a November source date. These are disclosed cautions, not a complete historical chronology audit.
- A comparison is included in a historical selection only when all its cited source evidence is eligible. The combined display selection is not a merged native capsule and does not authenticate semantic review.

## Rights and validation scope

Read [RIGHTS.md](RIGHTS.md) before distributing this collection. FRUS has the official publisher's public-domain declaration. The exact Gutenberg edition is declared **Public domain in the USA**, with the full retained license and prominent notice; no worldwide clearance is claimed. This collection is unaffiliated with either publisher. Underlying public-domain material retains its rights regardless of any software or annotation licensing.

New eligible original scripts/annotations have no open-source grant and commercial terms remain pending under the workbench policy. The copied fingerprint helper, collection tokenizer reference and core patch retain Apache-2.0 and upstream notices. No exclusive ownership or commercial agreement is created here.

Independent review reproduced 24 corpus integrity tests, 12 expanded annotation/reference tests, native method validation and the collection adapter's 17 regressions and full 622-record run. It independently checked new XML text coverage and performed bounded reading of the 46 proposals. These are provenance, structural preservation and bounded source-review results, not automatic extraction performance, historian-level verification of every record, worldwide rights advice, or production/UI integration certification. Full-corpus search evidence belongs to the lexical adapter; the expanded native capsule contains 31 source records.
