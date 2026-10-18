# TACITUS Workbench

A workbench in development for source-backed policy and diplomatic knowledge: inspect documents, review a temporal evidence graph, and reuse qualified context in new prompts.

This repository starts with the reproducible Rust capsule dependency and integration contract. The integrated browser application is not yet released here. The tested core can create, inspect and reuse explicitly annotated capsules locally; literal extraction and lexical retrieval do not provide automatic semantic understanding or generated-answer quality guarantees.

## Run the capsule core

See [the pinned build instructions](docs/CORE_INTEGRATION.md). Use Rust 1.95.0, Python 3.11+ and Git. The core is separately licensed Apache-2.0, with its exact source revision and reviewed patch recorded here. It needs no model account or full EdgeQuake application build.

Future local UI integration uses `TACITUS_KNOWLEDGE_CAPTURE_BIN` as an explicit absolute path to the built `knowledge_capture` executable. This variable alone does not start a server. Imported text is untrusted, review state stays visible, and omission-only outputs are not answers.

## Delivery checklist

- [x] Pin the reviewed native-v2 Rust dependency and source-span retrieval patch
- [x] Preserve Apache-2.0 notices and source-specific rights boundaries
- [ ] Integrate and independently test the new browser upload/graph/query workflow
- [ ] Add the rights-audited July 1914 example and its reproducibility receipts
- [ ] Verify clean install and browser behavior from this repository
- [ ] Implement hosted accounts, access control, paid marketplace flows and model-backed extraction

No hosting, payments, model calls, production authorization or automatic expert review is implied by the local capsule engine.

## Rights

No blanket open-source license is granted for new, eligible original workbench material. Commercial licensing terms are pending; contact the repository owner before commercial use of that material. This does not restrict rights already granted for Apache-2.0 dependencies, CC0 fixtures or public-domain sources. See [RIGHTS.md](RIGHTS.md). This is a boundary notice, not a finalized commercial agreement.
