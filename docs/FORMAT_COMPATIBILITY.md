# Evidence formats and verified reader boundaries

Reviewed 12 November 2026. Choose the producer and reader by its explicit format/version, not by the word “capsule”. Rights, exact source editions, omissions, attribution and review state must survive any future conversion. This table does not introduce an App adapter.

| Artifact | Producer / supported reader | Offset and byte boundary | Conversion status |
| --- | --- | --- | --- |
| `tacitus-reference-context/1`, reference graph/receipt | Public Python reference pipeline. Its own validators bind source editions, exact quotations, declared qualifications and UTF-8 budget. | Quote positions are Unicode code points; serialized budget is UTF-8 bytes. | A reference context is not a native ZIP or private App packet. |
| `tacitus-policy-workflow/1` | Reference pipeline generation/agent output; Workbench's Policy Workflow reader inspects the retained capsule, graph, cited draft and run receipt. | Producer quote units remain code points; reader checks exact retained records/context hash. | The reader supports the declared wrapper, not arbitrary standalone JSON. Draft status and lack of automatic entailment verification remain visible. |
| `policy-research-selection/1` | Historical source-kit selection; Workbench Research Selection reader. | Dataset versions/hashes, original record fields and locators; this is not a quotation-offset conversion. | Exact original selection bytes can be exported. No native claim graph or current situation assessment is inferred. |
| Native-v2 ZIP and its native Context/query JSON | Pinned Rust knowledge-capture core; separately opted-in local inspector/authoring workflow. | Native source spans use half-open UTF-8 byte offsets. Bounded archive/member rules and exact source identities apply. | Read with the matching core/helper hashes. Source-only material and unreviewed assertions retain their states. |
| `tacitus-native-collection-context/1` | Local manifest importer/query and Workbench collection reader. | Outer budget includes metadata/base64/lineage; native children retain their own UTF-8 spans and budgets. | An outer receipt contains distinct child packets; it does not merge them into one native Context or evidence graph. |
| DIALECTICA spec-3.0 `.capsule` | DIALECTICA v3 CLI/compiler and its own schema/review/projection gates. | Follow that version's source-span and bundle/projection contracts; do not reinterpret by file extension. | No automatic import into this Workbench's native-v2 path or the private App is claimed. |
| Private App evidence/graph/export contracts | Owned and versioned by the separate App workflow. | Caller authorization, source versions, rights, review and offset conventions remain consumer-owned. | No public cross-application converter is installed here. A scoped exact-version handoff and acceptance are required. |
| `tacitus-teaching-brief/1` | Original House of Evidence lesson and its refusal/export checks. | Exact spans in original fictional teaching sources. | A teaching export is a separate lesson format, not a native or App capsule import. |

## Reproduce the useful paths

- Public source-to-context: follow the [reference pipeline](https://github.com/sargonxg/TACITUS-Knowledge-Pipeline-open/tree/main/reference-pipeline) build and 42 credential-free tests. The organization starter deliberately retains its reviewed submodule pin.
- Inspect actual policy-workflow recordings through the [policy workflow reader](../apps/workbench/docs/policy-workflow.md). A saved recording is not a new model call or independently judged answer.
- Build the exact native core/helpers with `scripts/build-core.sh`, then follow [Core integration](CORE_INTEGRATION.md), [local authoring](LOCAL_TEXT_AUTHORING.md) and [release checks](RELEASE_READINESS.md). Native, authoring and collection opt-ins are distinct.
- Run `npm ci`, `npm run typecheck` and the configured test commands from `apps/workbench`. Default-mode skips remain explicit; full native acceptance requires all its real prerequisites and may not be replaced by recorded output.

## Acceptance before any new adapter

Use an explicitly agreed producer/consumer version. Bind the original source version/hash and exact text first. Convert offset units only against that unchanged text, preserving non-BMP characters, combining marks, BOM/CRLF and repeated-quote identity. Never normalize wording to make a quotation match.

Require round-trip/refusal cases for changed quotes/hashes/versions, missing conditions, unknown/revoked sources, rights restrictions, unsupported formats, invalid lengths, ambiguous identities, omissions and unearned review promotion. Unknown validity stays unknown. Identity/hash consistency is distinct from source authenticity, semantic support and authorization.

The current App team owns new project-scoped contracts and migration decisions. A public reference reader cannot grant tenant access or promote a proposed relationship. No deployment, provider, billing or stored-user-data change is part of this compatibility documentation.
