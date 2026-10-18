# Compare modern retrieval checkpoints

This local feature compares two actual live queries of one imported archive.
The optional recorded walkthrough remains separate and cannot supply these runs.
It does not call a model, change the capsule or decide historical truth.

1. Follow the [live-core setup](../README.md#build-and-run-the-live-core), import
   and inspect a native ZIP, then query the core.
2. Choose **Save current live run as A**. The original Context remains exportable;
   no run B or comparison is shown until another request completes.
3. Change only known-as-of and/or valid-at, then query again for run B. For July,
   change known-as-of from `1792328100` to `1792328101` while keeping valid-at
   `1792328100`. This demonstrates unchanged selected context with unknown world
   applicability, not a change in diplomatic history.
4. Expand a claim to inspect both arms' exact quotes, locators, source versions,
   hashes and UTF-8 spans, attribution, modality, epistemic type, conditions,
   exceptions, knowledge label, temporal disclosure and observed time. Expand a
   selected source for its declared availability/publication/validity and rights.
5. Set known-as-of to `1` and query to see a real refusal. The unavailable arm is
   not treated as zero claims, removed evidence or an answer. Expand the actual
   omission disclosures when both Contexts exist.

The archive ZIP SHA-256, actual request snapshot and configured executable's
pre-invocation SHA-256 bind each receipt. Successful returned Context must echo
its archive digest, question and checkpoints. Question, byte budget, time policy,
revoked-source list and core digest must match before comparison; only the two
checkpoints may differ. Mismatches are explicit and do not modify either export.
The digest check assumes a trusted local executable path that is not replaced
between checking and execution; it is not immutable execution or build-source
attestation. Existing loopback, opt-in, origin and subprocess limits still apply.

Known-as-of bounds modern source availability. Valid-at asks declared world
applicability. Neither reconstructs what an actor knew, received or believed in
1914. These shipped capsules have one ingestion timestamp each, unknown source
validity intervals and unreviewed authored assertions. Their likely outcomes are
unchanged unknown applicability or refusal across an ingestion boundary. If both
clocks change, the UI does not attribute a difference to one clock.

Selected source counts come from returned citations, not every source in the
archive metadata. Comparisons include all returned claims, including retrospective
material hidden by the graph's default perspective filter. A-only/B-only means
selected in that output; it does not mean newly true/false. Budget/closure and
matching omissions can also affect selection. Unchanged selection does not imply
no historical change, semantic completeness, diplomatic usefulness or answer gain.

Two run slots live only in browser memory. Save A explicitly, then perform a
second request. Editing controls clears the current receipt/export; cancellation
and superseded responses cannot replace it. Reset, reimport or mode switching
clears both slots. Clear A removes only that saved slot. **Export saved run A exact
Context JSON** and **Export exact Context JSON** download the original respective
response strings. Comparison parsing never reserializes those strings; malformed
comparison projections leave the original successful Context export available.
Refusals have no Context export. No comparison is persisted or uploaded.

## Verification

The focused model suite covers byte fidelity, mismatched inputs, request snapshots,
refusals versus omission-only success, qualifier changes, citation validation,
prototype-like authored IDs, malformed observed dates, core digest notification
and cancelled/superseded epochs. Full browser acceptance covers actual live
queries, saved/current exact downloads, inquiry qualifications and unknown dates,
refusal, mismatched budgets, desktop/mobile keyboard operation, and late success
and error responses after cancellation/editing. Explicit `TACITUS_ACCEPTANCE=1`
requires live prerequisites instead of silently running only the disabled shell.
Use the [existing acceptance commands](../README.md#acceptance).

The implementation checkpoint passed a clean locked offline npm install from the
existing official-registry cache, typecheck/build, **18/18 default** and **18/18
explicit full-acceptance** tests, with zero failures/skips. The default comparison
browser path checks the disabled shell; the explicit full run exercises native
execution. System Chromium154 was used; the previously blocked matching-browser
download was not retried. The two inherited use-client build warnings remain.
All 49 application inventory entries and onboarding facts verify.

Independent code/security review reproduced and resolved prototype-like claim-ID
lookups, malformed observed-date projection and stale import-error handling, and
independently passed the nine focused tests. Independent skeptical diplomatic
review caught and resolved a lifecycle defect that initially compared one saved
execution with itself as if it were two runs. The final browser test asserts that
saving A presents no B or difference until another query completes.

A separate reviewer ran actual expanded-relief requests at desktop1440px and
mobile390px, varying only known-as-of `1792332960` to `1792332961` with valid-at
fixed. Both selected nine claims; commission scope, personal capacity and
conditional-duration pairs preserved every quote, locator, qualification and
unknown applicability. Saved-A export was byte-exact; keyboard operation had no
page errors or horizontal overflow. This review establishes bounded interface and
data fidelity, not independent historical truth or diplomatic answer quality.
