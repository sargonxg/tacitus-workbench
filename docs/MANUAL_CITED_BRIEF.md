# Prepare a cited brief prompt for manual chat use

After a successful live query, use **Prepare cited brief prompt** for the returned
Context. In the local collection explorer the same action uses **this capsule's
selected packet** from a verified saved query. It does not combine capsules, the
622-source lexical index, source-only records, full archived source text or saved
comparison run A. Recorded examples offer no preparation action.

1. Review the current question and evidence, then choose **Prepare cited brief prompt**.
2. Read the preview, selected/omitted counts, clocks, source rights and metadata.
   This is an exported prompt, not an answer or an automatic ChatGPT/Claude connection.
3. Choose **Copy prepared prompt** or **Download prompt text**. Paste it manually
   into an external chat only if you want to share those selected bytes and metadata
   with that service. No provider call, credentials or remote transfer occurs here.
4. Review any later model response yourself. The prompt requests three sections:
   source-supported attributed statements (still unreviewed), explicitly labeled
   hypotheses/inferences, and unknowns/disagreement/insufficiency. It requests exact
   citation records: `source`, `text_hash`, `start`, `end`, `quote`. Offsets are
   half-open UTF-8 bytes in the original source, not character or prompt positions.

The complete selected Context, its capsule manifest and its omission metadata are
included. Graph search/perspective filters do not reduce this export. Omitted
assertion IDs/reasons and manifest inventory metadata can still be sensitive;
review them in the preview before sharing. No other collection's payload or full
source body is added. Source-only exclusions and other capsules are outside a
single-packet brief; this is not a global collection answer.

Speaker, modality, conditions, exceptions, exact citations, original-language and
translation disclosures, temporal status, observed time and omissions remain in
the original Context. Ingestion checkpoints do not establish historical knowledge.
An exact quote proves bytes, not semantic support or truth. Embedded instructions,
role-shaped text, URLs and fake delimiters are designated untrusted data. The
frame marker is deterministic and checked against all embedded strings; this is
not a guarantee against prompt injection or unsafe behavior by an external model.

## Exact exports and verification

The plain `.prompt.txt` file is the exact prepared UTF-8 prompt. The optional
`.prompt.json` package retains the identical prompt, complete citation index,
original Context bytes in base64, Context/prompt SHA-256 and byte counts, question,
request clocks/policy, archive/core identities and policy identity. Saved collection
packets additionally bind manifest, snapshot and saved query receipt SHA-256.

**Verify exported prompt against this Context** checks an exported package against
a deterministic regeneration from the currently eligible selection. Identical
bytes succeed; altered text/metadata, another Context/question/scope, whitespace
changes or a changed policy refuse. This is verification of this local export,
not arbitrary Context import, authentication of a claimed execution, or model
answer reimport. The underlying **Export exact Context JSON** and **Export exact
saved native packet** actions retain their original bytes.

The complete prompt is capped at 1 MiB; its JSON package at 2 MiB; each underlying
native Context at 250,000 bytes. All instructions, index entries, framing, metadata
and evidence count toward these limits. A limit failure refuses without truncating
quotes, qualifications or omissions. Token counts and model context-window
compatibility are not measured; bytes are never labeled as tokens.

A current successful selected Context is required. Refusals, unbound receipts,
omission-only packets, known revoked request entries, withdrawn/restricted or
nonredistributable source flags, mismatched citations and extra unselected source
metadata refuse. There is no external revocation authority or freshness check:
this is a bound snapshot, not current authorization. Do not use a snapshot you
know is revoked. Native execution retains its existing hash-before-call trust
boundary; browser checks do not independently prove source truth or complete files.

Query edits, mode/archive/reset changes, authoring invalidation, replacing or
clearing a collection/receipt, and changing the selected capsule remove the staged
prompt. Saving the current run as comparison A also removes its preparation action.
Cancel/clear prevents pending preparation or clipboard completion from restoring
stale UI state. Clipboard writes occur only on explicit Copy clicks. Clipboard
failure leaves text/package download and selectable preview available. Already
copied or downloaded content cannot be recalled; a clipboard operation already
submitted to the browser may finish after clearing the view.

Keyboard users can prepare with Enter; focus moves to a visible preview heading.
Escape clears the preview and returns focus to Prepare. Mobile and reduced-motion
layouts use the same controls. Nothing is copied automatically on load/preparation.

## Shared offline policy and acceptance

`tools/offline-eval/cited-prompt-policy.json` supplies common evidence/citation
policy fragments for the browser and offline harness. The offline harness keeps
its existing answer-file suffix and **byte-identical original instruction string**;
the manual variant requests the human-readable sections above. The shared policy
file is included in offline implementation hashes. This feature creates no model
answers, evaluation scores, quality gains, new provider integration or legal terms.

With the existing root live/authoring setup and browser collection fixtures:

```sh
cd "$TACITUS_WORKBENCH_ROOT/apps/workbench"
npm run typecheck
npm run build
TACITUS_ACCEPTANCE=1 TACITUS_TEST_COLLECTION=1 TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
cd "$TACITUS_WORKBENCH_ROOT"
python3 -m unittest discover -s tools/offline-eval/tests -v
```

Keep `TACITUS_TEST_IMPORTED_COLLECTIONS`, `TACITUS_TEST_ARCHIVE`, helper/core paths,
hashes and live/authoring opt-ins exported as documented in the root README and
[collection explorer guide](LOCAL_COLLECTION_EXPLORER.md#reproduce-acceptance).
Tests cover deterministic regeneration and re-verification, request/scope/hash
mismatches, source flags, selected-only membership, exact quotes/BOM/multibyte and
instruction-like data, desktop/mobile keyboard focus, copy denial/fallback, no
automatic copy or HTTP calls from the flow, and stale preparation/clipboard state.
Hosted and private website/PRAXIS deployment holds remain unchanged.
