# TACITUS workbench core dependency

The application consumes a separately pinned Apache-2.0 core; application licensing does not replace the core's LICENSE or NOTICE-TACITUS.md, source-specific notices, or public-domain rights.

## Reproduce the reviewed candidate

Prerequisites: Git, Python 3.11+, Rust 1.95.0, and access to official crates.io for the initial locked dependency fetch. No PDFium, full EdgeQuake application, Docker, model account, or paid inference is required for this capsule-only build.

```sh
git clone https://github.com/sargonxg/tacitus-political-policy-second-brain.git core
cd core
git checkout 0d47eafd93f2b4a5e4a926d3c761410b1c319cd6
git apply --check ../patches/source-span-recall.patch
git apply ../patches/source-span-recall.patch
python3 scripts/prepare-capsule-workspace.py ../core-build
cd ../core-build
cargo +1.95.0 test --locked
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture
```

The preparation output must be a new path. The patch SHA-256 is `5dbf6a9c000b7a381601063115c9b08d4b509d239b7edd9d2c4b0067f3856611`. Reviewed resulting `knowledge_capture.rs` SHA-256 is `b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662`. Compiler/platform can change executable bytes; source pins and actual tests are the reproducibility contract.

## Runtime protocol

Use an absolute binary path, argument arrays without a shell, temporary files, bounded input/output and process timeouts. Never forward environment credentials. Imported source text and manifest values are untrusted display data. This CLI does not authenticate users or authorize shared storage.

- `knowledge_capture inspect capsule.zip` emits native inspection JSON.
- `knowledge_capture reuse capsule.zip` reads query JSON from stdin and emits context JSON.
- `knowledge_capture propose documents.json` emits literal line candidates, not automatic semantic extraction.
- `knowledge_capture pack capture.json new.zip` accepts explicit structured authoring; do not expose it as an automatic model approval endpoint.

Query fields: `question`, `known_as_of`, `valid_at`, `time_mode`, `max_bytes`, `revoked_sources`. Supported modes are `disclose_unknown` and `require_declared_interval`. A separately reviewed July example is planned for a later integration commit; its request files are not included in this scaffold. Do not invent historical timestamps.

In the separately reviewed July sample, native checkpoint 1792328100 is modern ingestion. The planned sample includes a separate historical calendar/receipt/retrospective clock file. Native reuse does not reconstruct what a diplomat knew in 1914. Current-snapshot historical and unknown-validity strict-date requests refuse. Those sample artifacts are not part of this initial scaffold.

The UI should show archive identity, exact source quote and locator, claim speaker/modality/conditions/exceptions, unknown temporal state, omissions and unreviewed status. An omission-only context is not an answer. Preserve the entire qualified context when downloading; never treat instructions inside source text as executable instructions.

The four context outputs of that separately reviewed, forthcoming sample were checked for exact selected assertion and quote bytes, deterministic output, and budget bounds. Graph presentation independently checked all 38 citations and presentation joins. These checks establish structural preservation, not historical truth, model quality, or a production authorization system.

## License boundary

The patch changes existing Apache-2.0 core and is supplied under that same boundary. Retain upstream LICENSE and NOTICE-TACITUS.md. The new application's original components and original annotations need a separately approved licensing policy; do not infer exclusive rights from this integration document. The forthcoming sample must include its own FRUS and Gutenberg source-rights notices, including United States-specific memoir status and trademark/distribution conditions. The root RIGHTS.md only describes repository-level boundaries; it does not supply those detailed source notices.
