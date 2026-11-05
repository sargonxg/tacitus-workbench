# Research-selection reader verification · 5 November 2026

The static viewer now has explicit Native Context and Research selection modes. The new `policy-research-selection/1` reader is bounded to 200 records and 1 MiB. It does not convert source-kit records into native contexts or run a core, model or remote dataset request.

TypeScript, both application/static builds and the complete default interface suite pass: **74 tests, 69 passed, five explicitly skipped, zero failures**. The skips retain their existing native/prepared-collection requirements; no new Rust acceptance is claimed.

The new checks cover the shared Python/TypeScript contract fixtures, malformed and oversized input, UTF-8 byte boundaries, BOM/CRLF preservation, count and source-reference consistency, dates, finite values, safe text rendering, file resets, exact-byte downloads and preservation of the original native-view state/export.

Five actual source-kit files were additionally imported through the browser at 1440/390 pixels: two committed worked examples, a 200-event atlas export, a precision-filtered 200-event export and a 66-value annual-series export. The actual source rows retained 49 original UCDP fields or qualified annual-value attributes. Downloaded bytes matched the input exactly; dates, units, source metadata and omissions remained supplied data. There were no page errors, API requests or document overflow in those checks.

The existing [readiness receipt](READINESS_2026-11-05.md) records the earlier Node-only preview and native boundaries. This later check covers the separate research reader and the current full interface suite. Native Context, research selections, country-context layers and DIALECTICA formats remain distinct contracts. Supplied metadata and declared hashes are not independently authenticated by the offline reader.
