# Semantic explorer verification · 6 November 2026

The static Workbench now includes a separately loaded semantic exploration and
bounded Context Capsule preparation mode. The existing native Context and
unchanged research-selection readers retain their distinct contracts.

## Evidence and size

- 2,048 original GED record nodes, four source/category anchors and 4,096 allowed
  source/category edges. The country/year navigation slice is explicitly not
  statistically representative of the 120,576 retained source records.
- All 2,048 copied records retain 49 original provider attributes. Each original
  partition was byte-verified during sync; copied-subset and per-row digests are
  checked by the reader.
- Twelve separate annual population estimates cover 2013–2024. The last supplied
  value is 24,672,760 persons; all 19 original World Bank attributes, including
  raw blank unit and metadata-derived display unit, remain available.
- The standalone source-derived assets total **2,589,073 bytes**, with 188 small
  gzip subset payloads. The 2,048 provider rows expand to 4,694,672 bytes. This is
  a bounded derived subset, not a second full Atlas copy.
- Source base revision, modified-working-tree flag, exact catalogue/index hashes,
  provider attribution, original partition hashes and data terms are recorded in
  `public/semantic/SOURCE-NOTICE.json` and its manifest. No new application
  licence is granted.

Actual UI captures:

[Desktop](images/semantic-desktop.png) · [Mobile](images/semantic-mobile.png) ·
[Annual observation desktop](images/semantic-observation-desktop.png) ·
[Annual observation mobile](images/semantic-observation-mobile.png)

## Executed checks

```sh
node scripts/sync-semantic-catalog.mjs \
  --atlas /workspace/research/v16-semantic-atlas/observations \
  --source-kit /workspace/projects/syria-political-analysis
npm run typecheck
npm run build
npm run build:showcase
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
```

Both builds and TypeScript checking passed. The complete default suite ran **84
tests: 79 passed, five skipped, zero failures**, retaining the earlier 69 passing
cases and adding ten semantic-model/browser checks. The five explicit native
acceptance skips remain the same; no Rust core/helper acceptance was run or
counted as a pass. Existing `use client` bundler warnings remain non-fatal.

Browser checks use real shipped records at 1440 and 390 pixels. They verify lazy
loading, 72 plotted records versus the complete directory, shared filters,
keyboard selection, all five scoped lenses, the original 49/19 provider fields,
two-dataset preparation, explicit omissions, exact-byte reader re-import/export,
native Context compatibility, no unintended API calls, no horizontal overflow and
tampered-index refusal. Unit checks independently verify every copied row digest,
malformed references/counts/assets, preparation limits and database-status guards.

Browser testing caught automatic HTTP decompression of `.json.gz` assets in
Vite. Copied gzip payloads now use `.bin` plus explicit gzip encoding metadata, so
the encoded bytes are verified before decompression. The complete successful
suite includes that transport correction.

The default database indicator is **unconfigured / static snapshot**. No hosted
database, API, native server, model, live PRAXIS attachment or answer-quality
improvement is certified by these UI tests. The downloadable artifact is
`policy-research-selection/1` preparation, not a native capsule.

No commit, push or deployment was performed in this implementation pass.
