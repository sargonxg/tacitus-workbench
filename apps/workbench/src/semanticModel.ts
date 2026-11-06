import {
  MAX_RESEARCH_SELECTION_BYTES,
  validateResearchSelection,
} from "./researchSelection.ts";
import type {
  ResearchDataset,
  ResearchRecord,
  ResearchSelection,
} from "./researchSelection.ts";

export const LENS_IDS = [
  "prov-o",
  "skos",
  "owl-time",
  "geosparql",
  "sosa-ssn",
] as const;
export type LensId = (typeof LENS_IDS)[number];
export const MAX_GRAPH_BYTES = 3 * 1024 * 1024;
export const MAX_VISIBLE_RECORDS = 72;
export const DIRECTORY_PAGE_SIZE = 24;
const MAX_SUBSET_BYTES = 12 * 1024 * 1024;
type Json = Record<string, unknown>;
export type Asset = { path: string; bytes: number; sha256: string };
export type RawSubset = {
  encoding: "gzip";
  source_path: string;
  source_bytes: number;
  source_sha256: string;
  asset: Asset;
  count: number;
  uncompressed_bytes: number;
};
export type SemanticManifest = {
  format: "tacitus-semantic-explorer/1";
  built_at: string;
  source: {
    title: string;
    repository: string;
    revision: string;
    working_tree_modified: boolean;
  };
  catalog: Asset;
  graph: Asset;
  datasets: ResearchDataset[];
  raw_shards: RawSubset[];
  observation_example: Asset;
  limitations: string[];
  query_api: { enabled: boolean; base_url: "/api/research" };
};
export type RecordNode = {
  id: string;
  kind: "conflict_event";
  dataset_id: string;
  label: string;
  country_code: string;
  date_start: string;
  date_end: string;
  latitude: number;
  longitude: number;
  precision: { where_prec: string; date_prec: string; event_clarity: string };
  concept: {
    id: string;
    label: string;
    source_field: "type_of_violence";
    value: string;
  };
  compact_shard: string;
  raw_shard: string;
  raw_record_sha256: string;
};
export type AnchorNode = {
  id: string;
  kind: "dataset" | "concept";
  label: string;
  [key: string]: unknown;
};
export type SemanticEdge = {
  source: string;
  target: string;
  predicate: "prov:wasDerivedFrom" | "dcterms:subject";
  lens: "prov-o" | "skos";
  source_fields: string[];
};
export type SemanticGraph = {
  format: "policy-semantic-graph/1";
  dataset_ids: string[];
  selection: {
    method: string;
    purpose: string;
    requested_record_nodes: number;
    available_records: number;
  };
  nodes: (RecordNode | AnchorNode)[];
  edges: SemanticEdge[];
  counts: { record_nodes: number; nodes: number; edges: number };
  limitations: string[];
};
export type Lens = {
  id: LensId;
  title: string;
  namespace: string;
  terms: { id: string; url: string; label: string }[];
  record_fields: string[];
  scope: string;
  limitations: string[];
};
export type SemanticCatalog = {
  format: "policy-semantic-catalog/1";
  lenses: Lens[];
  [key: string]: unknown;
};
export type Exploration = {
  manifest: SemanticManifest;
  catalog: SemanticCatalog;
  graph: SemanticGraph;
  records: RecordNode[];
};
export type ExplorerFilter = {
  query: string;
  country: string;
  concept: string;
  yearFrom: string;
  yearTo: string;
  preciseOnly: boolean;
};
export const EMPTY_FILTER: ExplorerFilter = {
  query: "",
  country: "",
  concept: "",
  yearFrom: "",
  yearTo: "",
  preciseOnly: false,
};

function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function obj(value: unknown, label: string): Json {
  ensure(
    value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      [Object.prototype, null].includes(Object.getPrototypeOf(value)),
    `${label} must be an object.`,
  );
  return value as Json;
}
function text(value: unknown, label: string, max = 2000): string {
  ensure(
    typeof value === "string" &&
      value.trim() &&
      Array.from(value).length <= max,
    `${label} must be nonblank bounded text.`,
  );
  return value;
}
function integer(
  value: unknown,
  label: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  ensure(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= max,
    `${label} must be a bounded nonnegative integer.`,
  );
  return value;
}
function digest(value: unknown): string {
  const s = text(value, "SHA-256", 64);
  ensure(/^[a-f0-9]{64}$/i.test(s), "Invalid SHA-256.");
  return s;
}
function stringList(value: unknown, label: string, maximum = 30): string[] {
  ensure(
    Array.isArray(value) && value.length <= maximum,
    `${label} must be a bounded text list.`,
  );
  return value.map((v) => text(v, label, 4000));
}
export function safeAssetPath(value: unknown): string {
  const p = text(value, "Asset path", 500);
  ensure(
    /^\.\/[A-Za-z0-9_./-]+$/.test(p) &&
      !p
        .slice(2)
        .split("/")
        .some((s) => !s || s === "." || s === "..") &&
      /\.(json|json\.gz|bin|md|txt)$/.test(p),
    "Unsafe asset path.",
  );
  return p;
}
function asset(value: unknown, max: number): Asset {
  const a = obj(value, "Asset descriptor");
  const bytes = integer(a.bytes, "Asset bytes", max);
  ensure(bytes > 0, "Empty asset descriptor.");
  return { path: safeAssetPath(a.path), bytes, sha256: digest(a.sha256) };
}
function emptyPack(
  datasets: ResearchDataset[],
  created_at = "2026-11-06T00:00:00Z",
): ResearchSelection {
  return {
    format: "policy-research-selection/1",
    created_at,
    question: "",
    datasets,
    filters: {},
    counts: { matched: 0, exported: 0, truncated: false, limit: 200 },
    records: [],
    notes: { assessment: "", alternatives: "", gaps: "" },
    limitations: [],
  };
}
export function validateSemanticManifest(input: unknown): SemanticManifest {
  const v = obj(input, "Semantic manifest");
  ensure(
    v.format === "tacitus-semantic-explorer/1",
    "Unsupported semantic explorer manifest.",
  );
  const source = obj(v.source, "Source");
  text(source.title, "Source title");
  ensure(
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(
      text(source.repository, "Source repository"),
    ),
    "Invalid source repository URL.",
  );
  ensure(
    /^[a-f0-9]{40}$/i.test(text(source.revision, "Source revision", 40)),
    "Invalid source revision.",
  );
  ensure(
    typeof source.working_tree_modified === "boolean",
    "Source working-tree status is required.",
  );
  const datasets = validateResearchSelection(
    emptyPack(
      v.datasets as ResearchDataset[],
      text(v.built_at, "Build date", 64),
    ),
  ).datasets;
  ensure(
    Array.isArray(v.raw_shards) &&
      v.raw_shards.length > 0 &&
      v.raw_shards.length <= 512,
    "Expected 1–512 bounded subset shards.",
  );
  const paths = new Set<string>();
  let total = 0;
  const raw_shards = v.raw_shards.map((item, i) => {
    const s = obj(item, `Subset ${i}`);
    ensure(s.encoding === "gzip", "Expected an explicit gzip subset encoding.");
    const source_path = safeAssetPath(s.source_path);
    ensure(!paths.has(source_path), "Duplicate source partition.");
    paths.add(source_path);
    const uncompressed_bytes = integer(
      s.uncompressed_bytes,
      "Subset expanded bytes",
      MAX_SUBSET_BYTES,
    );
    total += uncompressed_bytes;
    return {
      encoding: "gzip" as const,
      source_path,
      source_bytes: integer(
        s.source_bytes,
        "Source partition bytes",
        64 * 1024 * 1024,
      ),
      source_sha256: digest(s.source_sha256),
      asset: asset(s.asset, MAX_SUBSET_BYTES),
      count: integer(s.count, "Subset row count", 10_000),
      uncompressed_bytes,
    };
  });
  ensure(
    total <= 32 * 1024 * 1024,
    "Subset catalogue exceeds 32 MiB expanded.",
  );
  const query = obj(v.query_api, "Query API");
  ensure(
    typeof query.enabled === "boolean" && query.base_url === "/api/research",
    "Only an explicitly enabled same-origin research API is supported.",
  );
  return {
    format: "tacitus-semantic-explorer/1",
    built_at: v.built_at as string,
    source: source as SemanticManifest["source"],
    catalog: asset(v.catalog, 1024 * 1024),
    graph: asset(v.graph, MAX_GRAPH_BYTES),
    datasets,
    raw_shards,
    observation_example: asset(
      v.observation_example,
      MAX_RESEARCH_SELECTION_BYTES,
    ),
    limitations: stringList(v.limitations, "Manifest limitations"),
    query_api: query as SemanticManifest["query_api"],
  };
}
export function validateSemanticCatalog(input: unknown): SemanticCatalog {
  const v = obj(input, "Semantic catalogue");
  ensure(
    v.format === "policy-semantic-catalog/1" &&
      Array.isArray(v.lenses) &&
      v.lenses.length === 5,
    "Expected the five-lens semantic catalogue.",
  );
  const seen = new Set<string>();
  for (const raw of v.lenses) {
    const lens = obj(raw, "Lens");
    const id = text(lens.id, "Lens ID", 30);
    ensure(
      LENS_IDS.includes(id as LensId) && !seen.has(id),
      "Unknown or duplicate lens.",
    );
    seen.add(id);
    text(lens.title, "Lens title", 200);
    const namespace = text(lens.namespace, "Lens namespace");
    ensure(/^https?:\/\//.test(namespace), "Invalid vocabulary namespace.");
    text(lens.scope, "Lens scope", 8000);
    stringList(lens.record_fields, "Lens field selectors", 100);
    stringList(lens.limitations, "Lens limitations");
    ensure(
      Array.isArray(lens.terms) && lens.terms.length <= 30,
      "Invalid lens terms.",
    );
    for (const rawTerm of lens.terms) {
      const term = obj(rawTerm, "Vocabulary term");
      text(term.id, "Term ID", 200);
      text(term.label, "Term label", 200);
      const url = text(term.url, "Term URL"),
        parsed = new URL(url);
      ensure(
        /^https?:\/\//.test(url) && !parsed.username && !parsed.password,
        "Vocabulary term URL must be an HTTP(S) identifier without credentials.",
      );
    }
  }
  return v as SemanticCatalog;
}
export function validateSemanticGraph(
  input: unknown,
  manifest: SemanticManifest,
): SemanticGraph {
  const g = obj(input, "Semantic graph");
  ensure(g.format === "policy-semantic-graph/1", "Unsupported semantic graph.");
  ensure(
    Array.isArray(g.nodes) &&
      g.nodes.length > 0 &&
      g.nodes.length <= 10_000 &&
      Array.isArray(g.edges) &&
      g.edges.length <= 20_000,
    "Semantic graph exceeds node/edge bounds.",
  );
  const datasets = new Set(manifest.datasets.map((d) => d.id)),
    partitions = new Set(manifest.raw_shards.map((s) => s.source_path)),
    nodes = new Map<string, RecordNode | AnchorNode>();
  const recordNodes: RecordNode[] = [];
  for (const raw of g.nodes) {
    const n = obj(raw, "Graph node");
    const id = text(n.id, "Node ID", 200);
    ensure(!nodes.has(id), "Duplicate graph node ID.");
    text(n.label, "Node label", 500);
    if (n.kind === "conflict_event") {
      const probe = {
        id,
        kind: n.kind,
        dataset_id: n.dataset_id,
        label: n.label,
        country_code: n.country_code,
        date_start: n.date_start,
        date_end: n.date_end,
        source_locator: "Graph index; original source inspected separately",
        attributes: {},
      };
      const p = emptyPack(manifest.datasets);
      p.records = [probe as ResearchRecord];
      p.counts.matched = p.counts.exported = 1;
      validateResearchSelection(p);
      ensure(
        typeof n.latitude === "number" &&
          Number.isFinite(n.latitude) &&
          Math.abs(n.latitude) <= 90 &&
          typeof n.longitude === "number" &&
          Number.isFinite(n.longitude) &&
          Math.abs(n.longitude) <= 180,
        "Invalid provider coordinates.",
      );
      const precision = obj(n.precision, "Precision");
      for (const k of ["where_prec", "date_prec", "event_clarity"])
        text(precision[k], k, 20);
      const concept = obj(n.concept, "Provider concept");
      text(concept.id, "Concept ID", 200);
      text(concept.label, "Concept label", 500);
      text(concept.value, "Concept code", 20);
      ensure(
        concept.source_field === "type_of_violence",
        "Unsupported concept source field.",
      );
      ensure(
        partitions.has(safeAssetPath(n.raw_shard)),
        "Index references an unavailable source subset.",
      );
      safeAssetPath(n.compact_shard);
      digest(n.raw_record_sha256);
      recordNodes.push(n as RecordNode);
    } else if (n.kind === "dataset")
      ensure(
        datasets.has(text(n.dataset_id, "Dataset anchor ID", 200)) &&
          id === n.dataset_id,
        "Unresolved dataset anchor.",
      );
    else {
      ensure(n.kind === "concept", "Unsupported graph node kind.");
      text(n.scheme, "Concept scheme", 200);
      text(n.code, "Concept code", 20);
    }
    nodes.set(id, n as RecordNode | AnchorNode);
  }
  const edgeIds = new Set<string>();
  for (const raw of g.edges) {
    const e = obj(raw, "Graph edge"),
      from = nodes.get(text(e.source, "Edge source", 200)),
      to = nodes.get(text(e.target, "Edge target", 200));
    ensure(from?.kind === "conflict_event" && to, "Unresolved graph edge.");
    const valid =
      (e.predicate === "prov:wasDerivedFrom" &&
        e.lens === "prov-o" &&
        to.kind === "dataset" &&
        from.dataset_id === to.id) ||
      (e.predicate === "dcterms:subject" &&
        e.lens === "skos" &&
        to.kind === "concept" &&
        from.concept.id === to.id);
    ensure(
      valid,
      "Unsupported semantic relationship; no inferred causal edges are accepted.",
    );
    stringList(e.source_fields, "Edge source fields", 5);
    const key = `${e.source}|${e.predicate}|${e.target}`;
    ensure(!edgeIds.has(key), "Duplicate graph edge.");
    edgeIds.add(key);
  }
  for (const n of recordNodes)
    ensure(
      edgeIds.has(`${n.id}|prov:wasDerivedFrom|${n.dataset_id}`) &&
        edgeIds.has(`${n.id}|dcterms:subject|${n.concept.id}`),
      "Record lacks its source or classification edge.",
    );
  const counts = obj(g.counts, "Graph counts");
  ensure(
    counts.record_nodes === recordNodes.length &&
      counts.nodes === nodes.size &&
      counts.edges === g.edges.length,
    "Graph counts disagree with actual nodes/edges.",
  );
  const selection = obj(g.selection, "Graph selection");
  text(selection.method, "Selection method", 500);
  text(selection.purpose, "Selection purpose", 4000);
  ensure(
    integer(selection.available_records, "Available records") >=
      recordNodes.length &&
      integer(
        selection.requested_record_nodes,
        "Requested record nodes",
        10_000,
      ) >= recordNodes.length,
    "Invalid graph selection counts.",
  );
  ensure(
    Array.isArray(g.dataset_ids) &&
      g.dataset_ids.every((id) => typeof id === "string" && datasets.has(id)),
    "Unresolved graph dataset IDs.",
  );
  stringList(g.limitations, "Graph limitations");
  return g as SemanticGraph;
}
export function filterSemanticRecords(
  records: RecordNode[],
  filter: ExplorerFilter,
): RecordNode[] {
  const terms = filter.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return records.filter(
    (n) =>
      (!filter.country || n.country_code === filter.country) &&
      (!filter.concept || n.concept.id === filter.concept) &&
      (!filter.yearFrom || n.date_end.slice(0, 4) >= filter.yearFrom) &&
      (!filter.yearTo || n.date_start.slice(0, 4) <= filter.yearTo) &&
      (!filter.preciseOnly || n.precision.where_prec === "1") &&
      terms.every((t) =>
        [n.id, n.label, n.country_code, n.concept.label, n.dataset_id]
          .join(" ")
          .toLowerCase()
          .includes(t),
      ),
  );
}
/** Deterministic spread through the filtered index, never a representative sample. */
export function sparseRecords(
  records: RecordNode[],
  selected?: string,
  maximum = MAX_VISIBLE_RECORDS,
): RecordNode[] {
  if (records.length <= maximum) return records;
  const result = Array.from(
    { length: maximum },
    (_, i) => records[Math.floor((i * records.length) / maximum)],
  );
  const focus = records.find((n) => n.id === selected);
  if (focus && !result.some((n) => n.id === focus.id))
    result[result.length - 1] = focus;
  return result;
}
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const owned = Uint8Array.from(bytes);
  const result = await crypto.subtle.digest("SHA-256", owned);
  return Array.from(new Uint8Array(result), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function canonicalProviderRow(
  attributes: ResearchRecord["attributes"],
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(attributes).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    ),
  );
}
async function limitedResponse(
  response: Response,
  maximum: number,
): Promise<Uint8Array> {
  ensure(response.ok, `Asset request failed (${response.status}).`);
  const reader = response.body?.getReader();
  ensure(reader, "Asset response has no body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      ensure(length <= maximum, "Asset exceeds its actual-byte bound.");
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return all;
}
export async function verifiedAsset(
  base: string,
  descriptor: Asset,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  safeAssetPath(descriptor.path);
  const url = new URL(descriptor.path, new URL(base, location.href));
  ensure(
    url.origin === location.origin,
    "Only same-origin catalogue assets are accepted.",
  );
  const bytes = await limitedResponse(
    await fetch(url, {
      signal,
      mode: "same-origin",
      credentials: "same-origin",
    }),
    descriptor.bytes,
  );
  ensure(
    bytes.byteLength === descriptor.bytes &&
      (await sha256Bytes(bytes)) === descriptor.sha256.toLowerCase(),
    "Asset SHA-256/byte identity mismatch; no result substituted.",
  );
  return bytes;
}
function parse(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export async function loadExploration(
  base = "./semantic/",
  signal?: AbortSignal,
): Promise<Exploration> {
  const url = new URL("manifest.json", new URL(base, location.href));
  ensure(
    url.origin === location.origin,
    "Only same-origin manifests are accepted.",
  );
  const manifest = validateSemanticManifest(
    parse(
      await limitedResponse(
        await fetch(url, {
          signal,
          mode: "same-origin",
          credentials: "same-origin",
        }),
        512 * 1024,
      ),
    ),
  );
  const [catalogBytes, graphBytes] = await Promise.all([
    verifiedAsset(base, manifest.catalog, signal),
    verifiedAsset(base, manifest.graph, signal),
  ]);
  const catalog = validateSemanticCatalog(parse(catalogBytes)),
    graph = validateSemanticGraph(parse(graphBytes), manifest);
  return {
    manifest,
    catalog,
    graph,
    records: graph.nodes.filter(
      (n): n is RecordNode => n.kind === "conflict_event",
    ),
  };
}
export class SemanticRecordStore {
  private cached = new Map<string, Promise<ResearchRecord[]>>();
  private exploration: Exploration;
  private base: string;
  constructor(exploration: Exploration, base = "./semantic/") {
    this.exploration = exploration;
    this.base = base;
  }
  async record(node: RecordNode): Promise<ResearchRecord> {
    const descriptor = this.exploration.manifest.raw_shards.find(
      (s) => s.source_path === node.raw_shard,
    );
    ensure(descriptor, "Missing source subset descriptor.");
    let pending = this.cached.get(node.raw_shard);
    if (!pending) {
      pending = this.readSubset(descriptor);
      this.cached.set(node.raw_shard, pending);
      if (this.cached.size > 32)
        this.cached.delete(this.cached.keys().next().value!);
      pending.catch(() => this.cached.delete(node.raw_shard));
    }
    const rows = await pending,
      row = rows.find((r) => r.id === node.id);
    ensure(row, "Indexed record missing from the verified subset.");
    ensure(
      row.dataset_id === node.dataset_id &&
        row.label === node.label &&
        row.country_code === node.country_code &&
        row.date_start === node.date_start &&
        row.date_end === node.date_end,
      "Index/original record identity mismatch.",
    );
    ensure(
      (await sha256Bytes(
        new TextEncoder().encode(canonicalProviderRow(row.attributes)),
      )) === node.raw_record_sha256,
      "Original provider row digest mismatch.",
    );
    for (const k of ["where_prec", "date_prec", "event_clarity"] as const)
      ensure(
        String(row.attributes[k]) === node.precision[k],
        "Index/provider precision mismatch.",
      );
    ensure(
      String(row.attributes.type_of_violence) === node.concept.value &&
        row.attributes.latitude !== "" &&
        row.attributes.longitude !== "" &&
        Number(row.attributes.latitude) === node.latitude &&
        Number(row.attributes.longitude) === node.longitude,
      "Index/provider spatial or category mismatch.",
    );
    return row;
  }
  private async readSubset(descriptor: RawSubset): Promise<ResearchRecord[]> {
    let bytes = await verifiedAsset(this.base, descriptor.asset);
    if (descriptor.encoding === "gzip") {
      const stream = new Blob([Uint8Array.from(bytes)])
        .stream()
        .pipeThrough(new DecompressionStream("gzip"));
      bytes = await limitedResponse(
        new Response(stream),
        descriptor.uncompressed_bytes,
      );
    }
    ensure(
      bytes.byteLength === descriptor.uncompressed_bytes,
      "Subset expanded-byte identity mismatch.",
    );
    const value = obj(parse(bytes), "Raw subset");
    ensure(
      value.format === "tacitus-semantic-record-subset/1" &&
        value.source_path === descriptor.source_path &&
        value.source_sha256 === descriptor.source_sha256 &&
        Array.isArray(value.records) &&
        value.records.length === descriptor.count,
      "Raw subset source/count mismatch.",
    );
    const seen = new Set<string>();
    return value.records.map((raw, i) => {
      const r = obj(raw, `Subset record ${i}`),
        fields = [
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
      const row = Object.fromEntries(
        fields.map((k) => [k, r[k]]),
      ) as ResearchRecord;
      const p = emptyPack(this.exploration.manifest.datasets);
      p.records = [row];
      p.counts.matched = p.counts.exported = 1;
      validateResearchSelection(p);
      ensure(!seen.has(row.id), "Duplicate original record ID.");
      seen.add(row.id);
      return row;
    });
  }
}
export async function loadAnnualExample(
  exploration: Exploration,
  base = "./semantic/",
): Promise<ResearchSelection> {
  const value = validateResearchSelection(
    parse(await verifiedAsset(base, exploration.manifest.observation_example)),
  );
  ensure(
    value.records.length > 0 &&
      value.records.every(
        (r) =>
          r.kind === "country_indicator" &&
          exploration.manifest.datasets.some((d) => d.id === r.dataset_id),
      ),
    "Expected original annual indicator examples.",
  );
  return value;
}
export async function researchDatabaseStatus(
  manifest: SemanticManifest,
  signal?: AbortSignal,
): Promise<string> {
  if (!manifest.query_api.enabled)
    return "Database API unconfigured · verified static snapshot";
  try {
    const response = await fetch(`${manifest.query_api.base_url}/status`, {
      signal,
      mode: "same-origin",
      credentials: "same-origin",
    });
    const bytes = await limitedResponse(
        new Response(response.body, { status: 200 }),
        64 * 1024,
      ),
      v = obj(parse(bytes), "Database status");
    ensure(
      v.api_version === "policy-research-db/1" && v.read_only === true,
      "Unsupported database status.",
    );
    if (response.status === 503 && v.status === "unconfigured")
      return "Database API unconfigured · verified static snapshot";
    const counts = obj(v.counts, "Database counts");
    ensure(
      response.ok &&
        v.status === "ready" &&
        v.backend === "d1" &&
        v.schema_version === 1,
      "Database not ready.",
    );
    return `Read-only D1 API ready · ${integer(counts.events, "API events").toLocaleString("en")} events · ${integer(counts.indicators, "API indicators").toLocaleString("en")} indicators`;
  } catch (error) {
    if (signal?.aborted) throw error;
    return "Database status unavailable · using the verified static snapshot";
  }
}
export function prepareResearchSelection(
  exploration: Exploration,
  records: ResearchRecord[],
  notes: ResearchSelection["notes"],
  question: string,
): { value: ResearchSelection; bytes: Uint8Array } {
  ensure(
    records.length > 0 && records.length <= 200,
    "Prepare between 1 and 200 records.",
  );
  const ids = new Set(records.map((r) => r.dataset_id));
  const value = emptyPack(
    exploration.manifest.datasets.filter((d) => ids.has(d.id)),
    new Date().toISOString(),
  );
  value.question = question;
  value.records = records;
  value.notes = notes;
  value.filters = {
    selection_method: "manual identifiers from verified source-derived records",
    selected_ids: records.map((r) => r.id),
  };
  value.counts = {
    matched: records.length,
    exported: records.length,
    truncated: false,
    limit: 200,
  };
  value.limitations = [
    "Context Capsule preparation only: this is a policy-research-selection/1 file, not a native Context, native capsule or live PRAXIS attachment.",
    `Manual selection; ${exploration.records.length} GED records were available in the navigation slice, which is not statistically representative. Unselected records, underlying full documents and corpus context are omitted.`,
    "Provider-coded historical records and annual estimates are not live conditions, causal evidence, sensor measurements or a reviewed model conclusion.",
    "Source bibliographic fields are supplied metadata, not the full cited documents. Snapshot hashes do not certify historical truth.",
    ...exploration.manifest.limitations,
  ].slice(0, 30);
  validateResearchSelection(value);
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
  ensure(
    bytes.byteLength <= MAX_RESEARCH_SELECTION_BYTES,
    "Prepared selection exceeds 1 MiB. Remove records before downloading; nothing was silently truncated.",
  );
  return { value, bytes };
}
