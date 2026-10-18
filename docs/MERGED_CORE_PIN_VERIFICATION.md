# Merged core pin verification — 18 October 2026

The current build pins public core commit
`6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95`. Its source-span recall fix is
already upstream, so `scripts/build-core.sh` no longer reads or applies the
historical local patch. The expected `knowledge_capture.rs` SHA-256 remains
`b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662`.
All 45 preexisting Rust source/test/example files in the four capsule crates are
byte-identical to the previously tested patched core. Package-version metadata
now follows the merged core; native format and fixture bytes are unchanged.

The patch file, notices, source bundles, prior verification reports and v0.1.0
are retained unchanged. Earlier reports and executable hashes describe their own
runs. This update does not rebuild those historical receipts in place.

## Fresh run

The documented helper ran against a new output directory with no preexisting
checkout or target artifacts. It cloned the public repository, checked out the
exact merged pin, verified source identity and prepared a new locked isolated
workspace. Rust/Cargo 1.95.0 passed **135 tests**, zero failures/ignored, and built
`knowledge_capture`. The existing official-registry Cargo cache was used offline;
this does not claim an empty dependency cache or new network-download proof.
Four build jobs, debug symbols disabled and incremental compilation disabled
bounded local disk use without disabling assertions or tests.

This run's executable SHA-256 is
`902694c1f5249442f4fe679938a8226becfd4b7490113c8a02c54e55e62b5f5b`.
Executable hashes can vary by build path/platform; the server verifies the digest
of the actual selected binary.

Both sample bundles were prepared using their safe validators: 209 July members
and 713 expanded members. The documented native verifiers reproduced **all ten
complete Context outputs byte-for-byte**, checked exact deterministic repacks and
refused strict-time, historical/pre-ingestion, revoked and tampered cases as
specified by each verifier. An initial expanded-verifier command used the July
filename and failed before running it; the corrected command below passed.

```sh
bash scripts/build-core.sh "$BUILD_ROOT"
python3 examples/july-1914/prepare_example.py
python3 examples/diplomacy-1914-v2/prepare_example.py
python3 examples/july-1914/.data/validation/verify_native.py --binary "$BIN"
python3 examples/diplomacy-1914-v2/.data/scripts/verify_expanded_native.py --binary "$BIN"
python3 examples/diplomacy-1914-v2/.data/collection-adapter/collection.py build \
  examples/diplomacy-1914-v2/.data/corpus-index.json \
  examples/diplomacy-1914-v2/.data/lexical-index
```

`BUILD_ROOT` must be a new absolute directory; `BIN` is its
`core-build/target/debug/examples/knowledge_capture`. These variables name local
outputs, not a deployment or model connection. The expanded index again contains
622 sources and 32 shards with snapshot
`386c72114ee34a9da32eec6a546908f9f3a778b9d2044597e0709dd4ebecdbe8`.

Application typecheck/build pass. Default browser tests and explicit full
acceptance each pass **8/8, zero skips**. Full acceptance uses the freshly built
binary and its verified digest, both native samples, and the prepared lexical
index. It checks actual desktop/mobile import, graph/query behavior, refusal
without recorded fallback, stale Context invalidation and byte-exact native and
lexical downloads. Inventory verification passes for all 45 application entries;
onboarding fixture verification passes. The README inventory hash changes only
because its current-pin provenance paragraph changes.

The browser is installed system Chromium154; the previously blocked matching
Playwright download was not retried. The two inherited use-client build warnings
remain. No full EdgeQuake application, live database, model generation, paid
service, automatic PRAXIS integration, historical-truth or answer-quality
acceptance is claimed. This is capsule-workflow compatibility evidence.

Independent review confirmed the pin, all 45 equal Rust files, the retained source
hash and bounded diff; it found no actionable defect. Browser and fixture results
above were coordinator-run. See the [current core integration](CORE_INTEGRATION.md)
and [operational architecture](OPERATIONAL_ARCHITECTURE.md) for runtime boundaries.
