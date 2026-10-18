# Bounded local text authoring

The workbench can create a native capsule from one user-supplied UTF-8 `.txt`,
`.md` or `.markdown` file, then use the existing inspect/query/exact-export flow.
This first slice requires two explicitly authored attributed reported statements,
one explicitly declared common actor/institution/event, and one explicit
`contradicts`, `supersedes` or `depends_on` relation with direction and rationale.
The current native graph contract requires a relation. If none is defensible,
stop. This flow does not infer one or extract facts. It introduces no native
schema, core changes, external model, URL fetching or remote upload.

## Setup

Run the repository's locked install and `scripts/build-core.sh` instructions.
That script builds the existing pinned `knowledge_capture` plus workbench-owned
`server/local_author.rs` in the same isolated four-crate workspace. The helper
uses the existing Capture, typed assertion fingerprint, pack and inspect APIs;
Apache core notices remain applicable to core code. New application source
retains the existing reserved-rights boundary.

With the live core environment already exported, also set:

```sh
export TACITUS_CAPTURE_AUTHOR_BIN=/tmp/tacitus-build/core-build/target/debug/examples/local_author
export TACITUS_CAPTURE_AUTHOR_SHA256="$(sha256sum "$TACITUS_CAPTURE_AUTHOR_BIN" | cut -d ' ' -f 1)"
export TACITUS_LOCAL_AUTHORING=1
cd apps/workbench
npm run build
npm start
```

The separate explicit opt-in requires live mode, both executable identities and a
loopback development process. Production/hosted flags disable it. No credentials
are needed. Open **Create from local text**, choose the file and enter the source
author, provenance, your annotation author and rights/redistribution basis.
Select unique single-line quotations from the unchanged source, then enter your
reported-statement annotations, attributed speakers, modality, conditions and
exceptions. Choose the entity and relation explicitly. Confirm rights only if
you can make that declaration. It is not a rights verification or new license.

Choose **Create validated native capsule**, then download the ZIP or **Use this
capsule in inspector**. The latter selects live mode and its modern ingestion
checkpoint; press **Inspect archive**, then **Query core**. Export exact Context
JSON retains the raw successful core response. Failed requests never substitute
a recorded example. One supplied source remains one source, even with two claims.

## Bounds and meaning

Source bytes are capped at 32 KiB, JSON request at 256 KiB and generated ZIP at
1 MiB. The request has a 10-second deadline and shares one outer execution lock
with inspect/collection operations. Helper hash, source SHA-256, exact unique
quote offsets and output archive SHA-256 are checked. Source UTF-8 BOM, CRLF and
multibyte bytes remain unchanged. Multiline quotations, invalid UTF-8, NUL, PDF,
OCR, archives, URL imports and forecast/hypothesis/inference typing are
unsupported. Source names never become server paths; the helper receives fixed
private temporary names and no shell command. URLs and literal markup are
untrusted source text and are never fetched or rendered as HTML.

Both annotations and the relation are user-authored, unreviewed proposals. Rust
validation checks structure and exact evidence binding; it does not establish
truth, attribution accuracy, rights, semantic sufficiency or approval. Publication,
observations and world-validity dates remain unknown. The current checkpoint
records modern source availability, not historical knowledge. Strict declared
validity and pre-ingestion queries refuse rather than fabricate dates.

Draft and source remain in page memory until **Clear authoring draft** or reload.
Creation sends them to the loopback process, whose private temporary source and
ZIP files are removed on normal completion, error or cancellation; a process
crash may leave files in the OS temporary directory. `private` is native metadata,
not encryption. The ZIP includes the entire source and your rights declaration.
Downloads persist wherever saved and cannot be erased by this page. Editing any
authoring field invalidates the generated capsule and clears the current inspector
result. Clear draft also resets the picker and input fields. Cancellation and
repeated submission cannot restore an obsolete download from a late response.

## Acceptance

The full repository acceptance command now requires the authoring variables above
in addition to core, native archive and collection configuration. Default tests
exercise the disabled shell and explicitly skip the native-helper test; full
acceptance requires all native/helper identities and refuses missing setup.
`tests/fixtures/synthetic-local.md` is invented, contains UTF-8 BOM/CRLF/non-ASCII
bytes and an untrusted URL instruction, and makes no historical claim.

Focused command from `apps/workbench` with those variables exported:

```sh
TACITUS_TEST_BROWSER=/usr/bin/chromium TACITUS_ACCEPTANCE=1 \
node --test tests/local-author.test.mjs tests/local-author-browser.test.mjs
```

Checks include real native pack/inspect/query, source-byte identity, exact Context
export, strict/historical/revocation refusal, malformed/tampered input, identity,
permissions, cleanup, cancellation and repeated submission. Browser acceptance
uses desktop and mobile viewports and forbids non-loopback requests. These checks
establish reproducibility and byte fidelity, not production readiness or improved
answer quality.
