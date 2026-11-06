import { readFile, mkdir, writeFile, realpath, unlink } from "node:fs/promises";
import { resolve, dirname, join, basename, sep } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  canonicalProviderRow,
  safeAssetPath,
  validateSemanticCatalog,
  validateSemanticGraph,
  validateSemanticManifest,
} from "../src/semanticModel.ts";
import { validateResearchSelection } from "../src/researchSelection.ts";

const args = process.argv.slice(2),
  option = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
const atlasArg = option("--atlas"),
  kitArg = option("--source-kit");
if (!atlasArg || !kitArg)
  throw Error(
    "Usage: node scripts/sync-semantic-catalog.mjs --atlas <generated observations directory> --source-kit <source checkout> [--enable-query-api]",
  );
const atlas = await realpath(resolve(atlasArg)),
  kit = await realpath(resolve(kitArg)),
  output = resolve("public/semantic");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let previousManifest;
try {
  previousManifest = JSON.parse(
    await readFile(join(output, "manifest.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
async function readSource(path) {
  safeAssetPath(path);
  const file = await realpath(join(atlas, path.slice(2)));
  if (!file.startsWith(atlas + sep))
    throw Error("Source asset escapes the Atlas directory.");
  return readFile(file);
}
async function verified(descriptor) {
  const bytes = await readSource(descriptor.path);
  if (bytes.length !== descriptor.bytes || hash(bytes) !== descriptor.sha256)
    throw Error(`Source byte identity mismatch: ${descriptor.path}`);
  return bytes;
}
async function save(path, bytes) {
  safeAssetPath(path);
  const file = join(output, path.slice(2));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
}
const sourceManifestBytes = await readSource("./data/manifest.json"),
  sourceManifest = JSON.parse(sourceManifestBytes);
const catalogBytes = await verified(sourceManifest.semantic_catalog),
  catalog = validateSemanticCatalog(JSON.parse(catalogBytes));
const graphBytes = await verified(catalog.graph_view),
  graph = JSON.parse(graphBytes),
  nodes = graph.nodes.filter((n) => n.kind === "conflict_event");
if (nodes.length < 2000)
  throw Error(
    "Expected at least 2,000 genuine provider records in the source index.",
  );
const revision = execFileSync("git", ["-C", kit, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const working_tree_modified = Boolean(
  execFileSync(
    "git",
    ["-C", kit, "status", "--porcelain", "--untracked-files=normal"],
    { encoding: "utf8" },
  ).trim(),
);
const rawRemote = execFileSync(
  "git",
  ["-C", kit, "remote", "get-url", "origin"],
  { encoding: "utf8" },
).trim();
const remoteMatch =
  /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(
    rawRemote,
  );
if (!remoteMatch) throw Error("Expected a GitHub source repository URL.");
const repository = `https://github.com/${remoteMatch[1]}`;
const datasetKeys = [
    "id",
    "title",
    "version",
    "publisher",
    "url",
    "license",
    "sha256",
  ],
  rowKeys = [
    "id",
    "kind",
    "dataset_id",
    "label",
    "country_code",
    "date_start",
    "date_end",
    "source_locator",
    "attributes",
  ];
const datasets = sourceManifest.datasets.map((d) =>
  Object.fromEntries(datasetKeys.map((k) => [k, d[k]])),
);
const groups = new Map();
for (const node of nodes) {
  if (!groups.has(node.raw_shard)) groups.set(node.raw_shard, []);
  groups.get(node.raw_shard).push(node);
}
const raw_shards = [];
let verifiedRows = 0;
for (const [path, group] of groups) {
  const descriptor = sourceManifest.raw_shards.find((s) => s.path === path);
  if (!descriptor) throw Error(`Missing original partition: ${path}`);
  const encoded = await verified(descriptor),
    decoded = path.endsWith(".gz")
      ? gunzipSync(encoded, { maxOutputLength: 16 * 1024 * 1024 })
      : encoded;
  if (
    descriptor.decoded_bytes &&
    (decoded.length !== descriptor.decoded_bytes ||
      hash(decoded) !== descriptor.decoded_sha256)
  )
    throw Error(`Original expanded-partition identity mismatch: ${path}`);
  const rows = JSON.parse(decoded).records;
  if (rows.length !== descriptor.count)
    throw Error(`Original partition count mismatch: ${path}`);
  const selected = group.map((node) => {
    const row = rows.find((r) => r.id === node.id);
    if (
      !row ||
      hash(Buffer.from(canonicalProviderRow(row.attributes))) !==
        node.raw_record_sha256
    )
      throw Error(`Original provider row mismatch: ${node.id}`);
    verifiedRows++;
    return Object.fromEntries(rowKeys.map((k) => [k, row[k]]));
  });
  const subset = {
    format: "tacitus-semantic-record-subset/1",
    source_path: path,
    source_sha256: descriptor.sha256,
    records: selected,
  };
  const uncompressed = jsonBytes(subset),
    country = path.split("/").at(-2),
    file = basename(path).replace(/\.gz$/, "");
  const asset = await save(
    `./rows/${country}/${file}.bin`,
    gzipSync(uncompressed, { level: 9 }),
  );
  raw_shards.push({
    encoding: "gzip",
    source_path: path,
    source_bytes: encoded.length,
    source_sha256: descriptor.sha256,
    asset,
    count: selected.length,
    uncompressed_bytes: uncompressed.length,
  });
}
// The catalogue's concrete SOSA example is population, not a GED event. Keep the
// 12 supplied annual source rows ending at that example's year; never fill a gap.
const example = catalog.examples.find((e) => e.lens === "sosa-ssn");
if (!example) throw Error("Missing real annual example.");
const indicatorBytes = await verified(example.shard),
  indicatorRows = JSON.parse(indicatorBytes).records;
const requested = indicatorRows.find((r) => r.id === example.id);
if (
  !requested ||
  hash(Buffer.from(canonicalProviderRow(requested.attributes))) !==
    example.attributes_sha256
)
  throw Error("Annual source example digest mismatch.");
const annualRows = indicatorRows
  .filter(
    (r) =>
      r.country_code === example.country_code &&
      r.indicator_code === example.indicator_code &&
      r.year >= example.year - 11 &&
      r.year <= example.year,
  )
  .sort((a, b) => a.year - b.year)
  .map((r) => ({
    id: r.id,
    kind: "country_indicator",
    dataset_id: r.dataset_id,
    label: `${r.indicator_name} · ${r.year}`,
    country_code: r.country_code,
    date_start: `${r.year}-01-01`,
    date_end: `${r.year}-12-31`,
    source_locator: r.source_locator,
    attributes: r.attributes,
  }));
const annualPack = {
  format: "policy-research-selection/1",
  created_at: sourceManifest.built_at,
  question:
    "Which annual population estimates did the provider report for this economy?",
  datasets: datasets.filter((d) => d.id === example.dataset_id),
  filters: {
    country_code: example.country_code,
    indicator_id: example.indicator_code,
    year_from: example.year - 11,
    year_to: example.year,
  },
  counts: {
    matched: annualRows.length,
    exported: annualRows.length,
    truncated: false,
    limit: 200,
  },
  records: annualRows,
  notes: { assessment: "", alternatives: "", gaps: "" },
  limitations: sourceManifest.datasets.find((d) => d.id === example.dataset_id)
    .limitations,
};
validateResearchSelection(annualPack);
const manifest = {
  format: "tacitus-semantic-explorer/1",
  built_at: sourceManifest.built_at,
  source: {
    title: "Middle East source kit · source-derived semantic navigation",
    repository,
    revision,
    working_tree_modified,
  },
  catalog: await save("./catalog.json", catalogBytes),
  graph: await save("./graph.json", graphBytes),
  datasets,
  raw_shards,
  observation_example: await save(
    "./annual-example.json",
    jsonBytes(annualPack),
  ),
  limitations: [
    "A deterministic country/year navigation slice, not a representative sample or the complete source dataset.",
    "The original source partitions were SHA-256 verified at preparation; copied subset partitions contain only indexed rows with all original provider attributes retained.",
    "Historical provider observations are not a live feed. Absence from this index is not evidence of no event.",
    "Vocabulary alignment is an explicit navigation aid; no ontology entailment, equivalence, causal relation or formal standards compliance is asserted.",
  ],
  query_api: {
    enabled: args.includes("--enable-query-api"),
    base_url: "/api/research",
  },
};
validateSemanticGraph(graph, validateSemanticManifest(manifest));
const notice = {
  title: "Source attribution and bounded-subset transformation",
  source_repository: repository,
  source_revision: revision,
  source_working_tree_modified: working_tree_modified,
  source_manifest_sha256: hash(sourceManifestBytes),
  catalog_sha256: hash(catalogBytes),
  graph_sha256: hash(graphBytes),
  source_catalog_selection: graph.selection,
  modification:
    "Only indexed GED records are copied to small gzip subset shards. All retained original provider attributes are unchanged. This is a transformed distribution, not the full source partitions; original partition and per-row hashes remain available.",
  datasets: sourceManifest.datasets.map((d) => ({
    id: d.id,
    title: d.title,
    version: d.version,
    publisher: d.publisher,
    url: d.url,
    license: d.license,
    license_url: d.license_url,
    sha256: d.sha256,
    attribution: d.attribution,
    limitations: d.limitations,
  })),
  annual_example: { ...example, original_shard_sha256: example.shard.sha256 },
  application_rights:
    "Workbench application rights remain reserved; source-data licences do not grant an application licence.",
};
await save("./SOURCE-NOTICE.json", jsonBytes(notice));
await save("./manifest.json", jsonBytes(manifest));
// Remove only generated assets explicitly named by the previous manifest.
const currentPaths = new Set(raw_shards.map((s) => s.asset.path));
for (const prior of previousManifest?.raw_shards || []) {
  if (!currentPaths.has(prior.asset.path)) {
    const stale = safeAssetPath(prior.asset.path);
    if (!stale.startsWith("./rows/"))
      throw Error("Unexpected stale subset path.");
    await unlink(join(output, stale.slice(2)));
  }
}
const total =
  catalogBytes.length +
  graphBytes.length +
  raw_shards.reduce((sum, s) => sum + s.asset.bytes, 0) +
  jsonBytes(annualPack).length +
  jsonBytes(manifest).length +
  jsonBytes(notice).length;
console.log(
  JSON.stringify(
    {
      verified_original_rows: verifiedRows,
      graph_nodes: graph.counts.nodes,
      graph_edges: graph.counts.edges,
      subset_shards: raw_shards.length,
      annual_rows: annualRows.length,
      deliverable_bytes: total,
      expanded_subset_bytes: raw_shards.reduce(
        (sum, s) => sum + s.uncompressed_bytes,
        0,
      ),
      source_revision: revision,
      source_working_tree_modified: working_tree_modified,
      source_manifest_sha256: hash(sourceManifestBytes),
    },
    null,
    2,
  ),
);
