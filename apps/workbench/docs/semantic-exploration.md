# Semantic exploration and Context Capsule preparation

The static Context explorer now has three deliberately distinct modes:

| Mode                 | Contract and behavior                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Context       | Existing graph/layer reader for `tacitus-uploaded-knowledge-context/1`; its parser and unchanged export remain intact.                                          |
| Research selection   | Existing local reader for `policy-research-selection/1`, with exact imported-byte export.                                                                       |
| Semantic exploration | Source-derived navigation index, lazy original-field inspection and a new bounded research-selection preparation download. Open directly with `?mode=semantic`. |

The shipped index contains **2,048 real UCDP GED records**, one dataset anchor,
three provider-category anchors and **4,096 declared source/category edges**.
It is a round-robin country/year/provider-ID navigation slice of the source kit's
120,576 retained event records, **not a statistically representative sample**.
Node, record, anchor and edge counts remain separate. No model-generated nodes or
invented political relationships are present.

The directory exposes every matched index entry, 24 per page. At most 72 records
are drawn; the drawing uses a deterministic spread through the filtered index.
Search, provider category, country code, supplied year intervals and `where_prec`
filter the same records in both views. SVG points and directory controls work with
the keyboard. Drawing positions do not measure semantic similarity.

## Five source-qualified lenses

- **PROV-O:** record-to-provider derivation and the exact source/archive/subset
  digests. It does not establish independent corroboration.
- **SKOS:** the provider's violence-type codes and labels. No `skos:exactMatch`,
  inferred hierarchy, allegiance or political identity is created.
- **OWL-Time:** supplied event-date windows and precision. Event dates, document
  publication, ingestion and annual reference labels remain separate clocks.
- **GeoSPARQL:** a provider-coordinate plot, retaining geographic precision and
  original WKT/administrative fields. No border decision, exact impact site,
  current territorial control, geometry engine or topology inference is claimed.
- **SOSA / SSN:** a separate real World Bank population series for Syria,
  2013–2024, including the catalogue's 2024 example of **24,672,760 persons**.
  Original values, raw blank unit and metadata-derived `persons` display unit
  remain distinct. These are provider statistical estimates, not a physical
  sensor feed or an assertion of direct measurement. No missing year is filled.

The source kit's five-lens catalogue supplies standard references, exact field
selectors, mappings and explicit limitations. These are alignment/navigation
aids, not RDF entailment or formal standards-compliance claims.

## Reproduce the standalone assets

Node 24+ and the existing lockfile are sufficient. Generate the source kit's
observations Atlas first, then from `apps/workbench` run:

```sh
node scripts/sync-semantic-catalog.mjs \
  --atlas /absolute/path/to/generated/observations \
  --source-kit /absolute/path/to/source-kit-checkout
npm run typecheck
npm run build:showcase
npm run preview:showcase
```

The sync command never downloads data or modifies the source kit. It verifies the
source catalogue, graph, original gzip/decoded partitions and every indexed
provider-row digest, then copies only the indexed rows into 188 small subset
shards. All 49 retained GED attributes are unchanged. The resulting public assets
are about **2.47 MiB**, rather than a second full Atlas distribution. The 2,048
copied rows expand to about 4.48 MiB. The annual example keeps all 19 original
provider attributes. Source rights, attribution, modification notices, original
partition hashes and source working-tree status are in
`public/semantic/SOURCE-NOTICE.json`; application rights remain reserved.
The optional sync step also uses Git to record the source checkout's base revision
and working-tree status. The committed standalone assets need no source checkout
or Git operation at runtime.

`manifest.json` uses `tacitus-semantic-explorer/1` to pin the original
`policy-semantic-catalog/1` and `policy-semantic-graph/1` bytes. Its subset mapping
distinguishes original partition identity from the small copied subset asset.
Source base revision is qualified by a working-tree-modified flag: the interface
does not present an uncommitted producer change as a committed implementation.

On entering this mode the browser loads only the manifest, catalogue and graph.
It loads an original-row subset when a record is inspected, and the annual
example on entering the observation lens. SHA-256, actual byte counts, expanded
gzip counts and original-provider-row digests are checked. Node/reference/count
validation refuses malformed data; no plausible example replaces a failure.
All record fields are escaped text and never automatic links or instructions.

Gzip payloads use a `.bin` asset extension plus explicit `encoding: "gzip"`
metadata. This keeps servers such as Vite from automatically assigning
`Content-Encoding: gzip` to an already-compressed `.json.gz` file: the browser
must receive the encoded bytes before checking their digest and decompressing.

Bounds include a 3 MiB index, at most 10,000 nodes/20,000 allowed edges, a 512 KiB
manifest, 1 MiB catalogue, 12 MiB per subset/expanded shard and 32 MiB aggregate
expanded subset metadata. The cache retains at most 32 shard promises. No force
simulation, continuous animation or full-corpus DOM rendering runs.

## Preparation and PRAXIS boundary

Add inspected original records to a tray, state a question and write assessment,
alternatives and gaps. The download is a **new** `policy-research-selection/1`
file containing the original selected record values and explicit omissions. Its
manual-selection filters/counts describe those identifiers; they do not imply a
representative corpus sample. The unchanged-file reader can open and re-export
this artifact exactly.

Preparation is limited to 200 records and 1 MiB. An oversized output is refused;
records are never silently removed. These files are **not native capsules**.
Native capture/schema validation, reviewed assertions and a PRAXIS attachment
bridge remain separate implementation/acceptance work. This prototype does not
claim live attachment, provider calls, model answers or answer-quality gains.

## Database and static hosting

The default manifest leaves `query_api.enabled` false: the UI accurately reports
an unconfigured database and uses the verified static snapshot. An operator may
pass `--enable-query-api` only where the same origin really implements
`GET /api/research/status`. A ready indicator requires the explicit manifest
opt-in and a valid read-only `policy-research-db/1`, schema-one, D1 status response;
failures remain unavailable/static. No cross-origin fallback or permissive CORS
is introduced. This pass does not provision or deploy that API.

The existing Node-only static build/preview and Workers Static Assets setup still
apply. Hosting exposes these public source-derived assets, not the local native
server or Rust core. Keep source notices with the build.

## Verification

```sh
node --test tests/semantic-model.test.mjs
npm run build
npm run build:showcase
TACITUS_TEST_BROWSER=/usr/bin/chromium npm test
node scripts/update-inventory.mjs
node scripts/verify-inventory.mjs
```

Unit checks cover all copied row digests, scopes/counts, malformed references and
assets, sparse/filter behavior, annual estimates, preparation limits and database
status refusal. Browser checks exercise real data at 1440/390 pixels, lazy loads,
all five lenses, keyboard directory, source fields, a two-dataset preparation
download, exact-byte re-import, native compatibility and tampered-index refusal.
Native acceptance skips remain separate from the default-suite passes.

The [6 November verification receipt](semantic-verification.md) records the
executed counts, actual source-derived size and desktop/mobile captures.
