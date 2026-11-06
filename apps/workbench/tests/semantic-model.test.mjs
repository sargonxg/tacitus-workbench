import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  EMPTY_FILTER,
  MAX_VISIBLE_RECORDS,
  SemanticRecordStore,
  canonicalProviderRow,
  filterSemanticRecords,
  loadAnnualExample,
  loadExploration,
  prepareResearchSelection,
  researchDatabaseStatus,
  safeAssetPath,
  sparseRecords,
  validateSemanticCatalog,
  validateSemanticGraph,
  validateSemanticManifest,
  verifiedAsset,
} from "../src/semanticModel.ts";
const read = async (p) => readFile(`public/semantic/${p.replace(/^\.\//, "")}`);
const originalManifest = JSON.parse(await read("manifest.json")),
  originalGraph = JSON.parse(await read("graph.json")),
  originalCatalog = JSON.parse(await read("catalog.json"));
const manifest = validateSemanticManifest(originalManifest),
  graph = validateSemanticGraph(originalGraph, manifest),
  catalog = validateSemanticCatalog(originalCatalog);
const exploration = {
  manifest,
  graph,
  catalog,
  records: graph.nodes.filter((n) => n.kind === "conflict_event"),
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
function localFetch(t) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {
    value: {
      href: "https://fixture.invalid/",
      origin: "https://fixture.invalid",
    },
    configurable: true,
  });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, "location", prior);
    else delete globalThis.location;
  });
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(String(input), location.href);
    assert.equal(url.origin, location.origin);
    const path = url.pathname.replace(/^\/semantic\//, "");
    return new Response(await read(path));
  });
}

test("real semantic catalogue counts source-derived nodes and scoped edges separately", () => {
  assert.ok(exploration.records.length >= 2000);
  assert.equal(graph.counts.nodes, graph.nodes.length);
  assert.equal(graph.counts.record_nodes, exploration.records.length);
  assert.equal(graph.edges.length, 2 * exploration.records.length);
  assert.deepEqual(
    new Set(catalog.lenses.map((l) => l.id)),
    new Set(["prov-o", "skos", "owl-time", "geosparql", "sosa-ssn"]),
  );
  assert.deepEqual(catalog.lenses.find((l) => l.id === "sosa-ssn").applies_to, [
    "country_indicator",
  ]);
  assert.match(graph.selection.purpose, /not statistically representative/i);
});
test("malformed graph references, counts and inferred relationship types are refused", () => {
  for (const mutate of [
    (g) => {
      g.nodes.push(g.nodes[0]);
    },
    (g) => {
      g.edges[0].target = "missing";
    },
    (g) => {
      g.edges[0].predicate = "causes";
    },
    (g) => {
      g.nodes.find((n) => n.kind === "conflict_event").raw_shard =
        "./missing.json.gz";
    },
    (g) => {
      g.nodes.find((n) => n.kind === "conflict_event").latitude = Infinity;
    },
    (g) => {
      g.counts.record_nodes++;
    },
    (g) => {
      g.edges.pop();
    },
  ]) {
    const bad = structuredClone(originalGraph);
    mutate(bad);
    assert.throws(() => validateSemanticGraph(bad, manifest));
  }
});
test("manifest, vocabulary and asset bounds reject unsafe inputs before requests", () => {
  for (const path of [
    "../secret.json",
    "https://other.invalid/a.json",
    "./data/../a.json",
    "./data/a.json?token=x",
    "./data/%2e%2e/a.json",
  ])
    assert.throws(() => safeAssetPath(path));
  for (const mutate of [
    (m) => {
      m.graph.bytes = 4 * 1024 * 1024;
    },
    (m) => {
      m.graph.sha256 = "bad";
    },
    (m) => {
      m.query_api.base_url = "https://other.invalid/api";
    },
    (m) => {
      m.source.repository = "javascript:alert(1)";
    },
    (m) => {
      m.raw_shards[0].uncompressed_bytes = 30 * 1024 * 1024;
    },
  ]) {
    const bad = structuredClone(originalManifest);
    mutate(bad);
    assert.throws(() => validateSemanticManifest(bad));
  }
  const bad = structuredClone(originalCatalog);
  bad.lenses[0].terms[0].url = "javascript:alert(1)";
  assert.throws(() => validateSemanticCatalog(bad));
});
test("every copied original row retains its independently bound provider attributes", async () => {
  let total = 0;
  const index = new Map(exploration.records.map((n) => [n.id, n]));
  for (const descriptor of manifest.raw_shards) {
    const compressed = await read(descriptor.asset.path);
    assert.equal(compressed.length, descriptor.asset.bytes);
    assert.equal(hash(compressed), descriptor.asset.sha256);
    const bytes = gunzipSync(compressed);
    assert.equal(bytes.length, descriptor.uncompressed_bytes);
    const subset = JSON.parse(bytes);
    assert.equal(subset.source_sha256, descriptor.source_sha256);
    assert.equal(subset.records.length, descriptor.count);
    for (const row of subset.records) {
      const node = index.get(row.id);
      assert.ok(node);
      assert.equal(Object.keys(row.attributes).length, 49);
      assert.equal(
        hash(Buffer.from(canonicalProviderRow(row.attributes))),
        node.raw_record_sha256,
      );
      total++;
    }
  }
  assert.equal(total, exploration.records.length);
});
test("lazy runtime verifies original rows and refuses byte or index mismatches", async (t) => {
  localFetch(t);
  const loaded = await loadExploration();
  assert.equal(loaded.records.length, exploration.records.length);
  const store = new SemanticRecordStore(loaded),
    node = loaded.records[0],
    row = await store.record(node);
  assert.equal(row.id, node.id);
  assert.equal(Object.keys(row.attributes).length, 49);
  await assert.rejects(
    () => store.record({ ...node, raw_record_sha256: "0".repeat(64) }),
    /digest mismatch/,
  );
  await assert.rejects(
    () =>
      store.record({
        ...node,
        precision: { ...node.precision, where_prec: "999" },
      }),
    /precision mismatch/,
  );
  await assert.rejects(
    () =>
      verifiedAsset("./semantic/", {
        ...manifest.graph,
        sha256: "0".repeat(64),
      }),
    /identity mismatch/,
  );
});
test("filters and sparse rendering preserve a complete directory without inventing nodes", () => {
  const country = exploration.records[0].country_code,
    filter = {
      ...EMPTY_FILTER,
      country,
      preciseOnly: true,
      yearFrom: "2011",
      yearTo: "2024",
    },
    result = filterSemanticRecords(exploration.records, filter);
  assert.ok(result.length);
  assert.ok(
    result.every(
      (n) =>
        n.country_code === country &&
        n.precision.where_prec === "1" &&
        n.date_end >= "2011-01-01" &&
        n.date_start <= "2024-12-31",
    ),
  );
  const focus = exploration.records.at(-1).id,
    sparse = sparseRecords(exploration.records, focus);
  assert.equal(sparse.length, MAX_VISIBLE_RECORDS);
  assert.ok(sparse.some((n) => n.id === focus));
  assert.ok(sparse.every((n) => exploration.records.includes(n)));
  assert.equal(new Set(sparse.map((n) => n.id)).size, sparse.length);
  assert.deepEqual(
    filterSemanticRecords(exploration.records, {
      ...EMPTY_FILTER,
      query: "unfindable-test-query",
    }),
    [],
  );
});
test("SOSA example preserves twelve actual annual population estimates and raw unit metadata", async (t) => {
  localFetch(t);
  const annual = await loadAnnualExample(exploration);
  assert.equal(annual.records.length, 12);
  assert.equal(annual.records[0].date_start, "2013-01-01");
  assert.equal(annual.records.at(-1).date_end, "2024-12-31");
  assert.equal(annual.records.at(-1).attributes.value, 24672760);
  assert.ok(
    annual.records.every(
      (r) =>
        r.kind === "country_indicator" &&
        r.attributes.indicator_id === "SP.POP.TOTL",
    ),
  );
  assert.equal(annual.records.at(-1).attributes.unit, "");
  assert.equal(annual.records.at(-1).attributes.display_unit, "persons");
});
test("prepared selection is bounded, source-preserving and explicitly separate from native capsules", async (t) => {
  localFetch(t);
  const row = await new SemanticRecordStore(exploration).record(
      exploration.records[0],
    ),
    annual = await loadAnnualExample(exploration),
    notes = {
      assessment: "My assessment",
      alternatives: "Alternative reading",
      gaps: "Original articles omitted",
    };
  const prepared = prepareResearchSelection(
    exploration,
    [row, annual.records[0]],
    notes,
    "A policy question",
  );
  assert.equal(prepared.value.format, "policy-research-selection/1");
  assert.equal(prepared.value.datasets.length, 2);
  assert.deepEqual(prepared.value.records[0].attributes, row.attributes);
  assert.deepEqual(prepared.value.notes, notes);
  assert.equal(prepared.value.counts.exported, 2);
  assert.match(
    prepared.value.limitations.join(" "),
    /not a native Context, native capsule or live PRAXIS attachment/,
  );
  assert.throws(() => prepareResearchSelection(exploration, [], notes, ""));
  const many = Array.from({ length: 60 }, (_, i) => ({
    ...row,
    id: `synthetic-byte-bound:${i}`,
    attributes: { ...row.attributes, synthetic_padding: "x".repeat(20000) },
  }));
  assert.throws(
    () => prepareResearchSelection(exploration, many, notes, ""),
    /exceeds 1 MiB/,
  );
});
test("database status stays unconfigured unless explicitly enabled and a valid ready response succeeds", async (t) => {
  assert.match(await researchDatabaseStatus(manifest), /unconfigured/);
  const configured = {
    ...manifest,
    query_api: { enabled: true, base_url: "/api/research" },
  };
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          api_version: "policy-research-db/1",
          status: "ready",
          read_only: true,
          backend: "d1",
          schema_version: 1,
          counts: { events: 120576, indicators: 15272 },
        }),
      ),
  );
  assert.match(await researchDatabaseStatus(configured), /120,576 events/);
  globalThis.fetch.mock.mockImplementation(
    async () => new Response(JSON.stringify({ status: "ready" })),
  );
  assert.match(await researchDatabaseStatus(configured), /unavailable/);
});
