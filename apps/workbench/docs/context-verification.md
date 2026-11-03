# Context explorer verification · 3 November 2026

The static explorer is a separate read-only build. The existing local server stays loopback-only; live native query, authoring and collection opt-ins retain their existing boundaries.

- TypeScript checking, the original local build and the new static showcase build passed.
- The interface suite ran **45 tests: 40 passed, five skipped**, with no failures. Skips cover configured native-core/collection acceptance that is not available in this environment. They are not counted as native integration passes.
- The new layer tests preserve citation identities and qualifications, check unknown clocks and reject malformed untrusted display fields before rendering. Desktop/mobile browser checks cover actual source excerpts, all layer views, exact-byte context export, local import, escaped text, refused invalid imports and no API calls from the static viewer.
- Desktop/mobile WCAG A/AA scans of the graph and layer views returned no automated violations after correcting the small layer-number contrast. This does not replace manual accessibility review.
- Cloudflare Wrangler 4.156.0 `deploy --dry-run` accepted the static-asset configuration. No infrastructure was created by this check. The built viewer can be mounted under a relative subpath.

The first displayed graph uses the existing recorded July 1914 native context: eight returned assertions and 31 omissions. Loading it runs no native query. Full source rights, unreviewed annotations, unknown applicability and the distinction between ingestion and historical time remain visible. Inspecting an excerpt does not verify a complete source file hash.

No Rust build or full live acceptance was run for this change: Cargo is absent in the execution environment. No model-answer quality improvement, hosted multiuser service or interoperability with DIALECTICA's distinct capsule formats is claimed. Application rights and source notices remain unchanged.

Reproduce using [the explorer guide](context-explorer.md). Normal browser tests write captures to ignored `output/showcase/`; set `TACITUS_CAPTURE_SCREENSHOTS=1` to refresh documentation screenshots deliberately. The file inventory excludes generated builds, runtime data, logs and its own hash.
