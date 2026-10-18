# Could a diplomat see escalation coming in July 1914?

A real, reproducible diplomatic evidence example for TACITUS. Start with Gerard's July 27 hope of avoiding general war, compare his July 30 pessimism, then inspect the qualifications and source dates that keep the comparison honest.

## Start here

**Native capsule:** [july-1914.native-v2.zip](july-1914.native-v2.zip) is the actual, ready-to-inspect native-v2 file, not a screenshot or mock response. Load it into a compatible TACITUS native-v2 consumer, or run the CLI below. This directory does not establish that a particular website import flow has been integrated or tested.

**Full collection:** [example-data.zip](example-data.zip) includes all original downloaded source bytes, normalized records, provenance, exact UTF-8 spans, annotations, Rust fingerprint helper, native query fixtures and validation scripts. [DATA_MANIFEST.json](DATA_MANIFEST.json) lists every one of its 209 files with sizes and SHA-256 hashes, plus source URLs and rights. No credentials, user documents, current website HTML, model calls or paid services are needed.

Read [RIGHTS.md](RIGHTS.md) first. FRUS files are declared public domain by their official publisher. The particular Lichnowsky ebook is declared public domain **in the USA**; other jurisdictions and Gutenberg trademark/distribution conditions require care. The [full Gutenberg license](LICENSE-GUTENBERG.txt) is retained. Public access to this repository is not an open-source grant for new eligible original work; the repository rights policy and existing Apache/source exceptions remain distinct.

### 1. Expand and verify offline

Prerequisite: Python 3.11+; standard library only. From the repository root:

```sh
cd examples/july-1914
python3 test_prepare_example.py
python3 prepare_example.py
python3 .data/scripts/verify_corpus.py
python3 .data/scripts/historical_snapshot.py --cutoff 1914-07-27 --basis source-created
python3 .data/scripts/historical_snapshot.py --cutoff 1914-07-30 --basis recipient-received
```

The preparation script creates a new `.data/` directory, checks the pinned archive and every file hash, rejects unsafe paths, symlinks, duplicate entries and oversized contents, and runs no extracted code. It refuses an existing output directory. For another copy, use `--output /existing/parent/new-directory`; it does not overwrite or delete a previous run.

The native ZIP's SHA-256 is `c7268bef3b19ff9b93458a64e476dd52df1c76f074e77fe149d2983268a66e5f`.

### 2. Inspect and query using an existing CLI

Set `BIN` to an absolute path to the supported `knowledge_capture` executable. While still in this directory:

```sh
BIN=/absolute/path/to/knowledge_capture
"$BIN" inspect july-1914.native-v2.zip
"$BIN" reuse july-1914.native-v2.zip < .data/validation/native/mobilization.request.json
"$BIN" reuse july-1914.native-v2.zip < .data/validation/native/mediation.request.json
python3 .data/validation/verify_native.py --binary "$BIN"
```

The validation script checks four deterministic outputs, exact claim/citation bytes, full deterministic repack, and empty-stdout refusals for strict unknown time, pre-ingestion/1914 checkpoints, revoked sources and evidence tampering. It rewrites the local native acceptance receipt with the binary actually tested. The included outputs require the pinned core plus the source-span patch described next; unrelated CLI versions need not reproduce them.

### 3. Build the matching core if needed

Prerequisites: Git, Python 3.11+, and Rust toolchain 1.95.0 already installed. Initial dependency download uses the official crates.io registry; it needs network access but no model account or credentials. This builds four capsule crates, not the full application, and does not require Docker or PDFium.

From this example directory after expansion, run these commands in one POSIX shell:

```sh
EXAMPLE="$(pwd)/.data"
BUILD_ROOT="$(mktemp -d)"
git clone https://github.com/sargonxg/tacitus-political-policy-second-brain.git "$BUILD_ROOT/core"
git -C "$BUILD_ROOT/core" checkout --detach 0d47eafd93f2b4a5e4a926d3c761410b1c319cd6
git -C "$BUILD_ROOT/core" apply --check "$EXAMPLE/integration/source-span-recall.patch"
git -C "$BUILD_ROOT/core" apply "$EXAMPLE/integration/source-span-recall.patch"
python3 "$BUILD_ROOT/core/scripts/prepare-capsule-workspace.py" "$BUILD_ROOT/core-build"
cd "$BUILD_ROOT/core-build"
cargo +1.95.0 test --locked
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture
BIN="$BUILD_ROOT/core-build/target/debug/examples/knowledge_capture"
python3 "$EXAMPLE/validation/verify_native.py" --binary "$BIN"
```

Patch SHA-256: `5dbf6a9c000b7a381601063115c9b08d4b509d239b7edd9d2c4b0067f3856611`. The resulting `edgequake/crates/tacitus-analysis/src/knowledge_capture.rs` must hash to `b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662`. The expanded `integration/` directory preserves the Apache-2.0 license, notices and protocol guidance. The patch adds literal recall from already validated cited source spans; it is not a semantic extraction model.

To regenerate source-normalized files and explicit annotations, then calculate fingerprints with the native Rust types, continue in the same shell:

```sh
python3 "$EXAMPLE/scripts/build_corpus.py"
python3 "$EXAMPLE/scripts/build_annotations.py"
cp "$EXAMPLE/scripts/fingerprint_capture.rs" "$BUILD_ROOT/core-build/crates/tacitus-analysis/examples/fingerprint_capture_local.rs"
cargo +1.95.0 run --locked -q -p tacitus-analysis --example fingerprint_capture_local < "$EXAMPLE/annotations/capture.unfingerprinted.json" > "$BUILD_ROOT/regenerated.capture.json"
cmp "$BUILD_ROOT/regenerated.capture.json" "$EXAMPLE/annotations/capture.json"
"$BIN" pack "$BUILD_ROOT/regenerated.capture.json" "$BUILD_ROOT/regenerated.native-v2.zip"
cmp "$BUILD_ROOT/regenerated.native-v2.zip" "$EXAMPLE/july-1914.native-v2.zip"
python3 "$EXAMPLE/scripts/verify_corpus.py"
```

Never substitute hand-built fingerprint JSON or mark these proposals reviewed. Regeneration is structural extraction plus explicitly authored annotations, not an automatic semantic-quality result.

## What is real, and what is annotated?

- **Two source works, 166 records:** 162 official FRUS documents, d24–d185, and four identified memoir sections. The FRUS selection extends into early September, beyond the July framing question.
- **209,963 normalized text bytes; 1,069 structural blocks:** includes 598 paragraph blocks. Paragraphs, source-marked people and document nodes are structural records, not inferred claims.
- **28 sources, 39 claim proposals:** a bounded native capsule with 21 typed nodes and 12 explicit claim links. Semantic annotations were authored by the assistant and remain unreviewed; source integrity is not historical truth.
- **160 literal phrase occurrences:** exact byte-offset matches, not a learned rhetoric classifier. English historical translations and embedded French preserve linguistic provenance; they do not demonstrate multilingual model performance.

## Follow the evidence

1. Compare [Gerard, July 27](https://history.state.gov/historicaldocuments/frus1914Supp/d27) with [July 30](https://history.state.gov/historicaldocuments/frus1914Supp/d41). His forecast changes; this is a dated comparison, not an automatically declared timeless contradiction.
2. [Mallett's July 13 dispatch](https://history.state.gov/historicaldocuments/frus1914Supp/d28) was received on July 27. A source-created view and a recipient-received view answer different questions.
3. [Mobilization activity versus a published decree](https://history.state.gov/historicaldocuments/frus1914Supp/d30) preserves an important qualification. Wilson here is Charles Stetson Wilson, not President Woodrow Wilson.
4. [Good offices](https://history.state.gov/historicaldocuments/frus1914Supp/d34) can be an inquiry, willingness or an offer; none proves acceptance. The expanded `DEMO_QUERIES.json` supplies eight curated questions and their caveats, not a held-out benchmark.
5. Read [Lichnowsky's retrospective account](https://www.gutenberg.org/ebooks/39457) separately. The edition dates composition to August 1916. It cannot supply evidence of what a diplomat knew in July 1914 just because it narrates 1914 events.

## Time, uncertainty and review boundaries

Historical document creation, recipient receipt, reported event date, edition publication, memoir composition and modern ingestion are separate clocks. Calendar dates are not fabricated midnight-UTC timestamps. Unknown dates remain unknown; time-only receipt entries do not acquire guessed days. Later editorial footnotes are separate from dispatch text, while inline editorial brackets remain printed and must not be assumed known to a 1914 recipient.

Native `known_as_of` concerns the modern graph's availability in 2026. A native request for 1914 correctly refuses; the historical snapshot script instead selects records using explicitly labeled calendar metadata. It excludes all memoir sections from every 1914 view and only admits comparative claims when all their evidence sources are eligible.

Local checks establish bytes, contracts, qualified context and date filtering. They do not establish extraction accuracy, historical completeness, a production authorization system, global copyright clearance, or a completed website integration.
