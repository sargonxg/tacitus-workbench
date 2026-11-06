import { useEffect, useMemo, useRef, useState } from "react";
import type { ResearchRecord, ResearchSelection } from "./researchSelection";
import {
  DIRECTORY_PAGE_SIZE,
  EMPTY_FILTER,
  LENS_IDS,
  MAX_VISIBLE_RECORDS,
  SemanticRecordStore,
  filterSemanticRecords,
  loadAnnualExample,
  loadExploration,
  prepareResearchSelection,
  researchDatabaseStatus,
  sparseRecords,
} from "./semanticModel";
import type { Exploration, LensId, RecordNode } from "./semanticModel";
import "./semanticExplorer.css";

const labels: Record<LensId, { title: string; short: string; prompt: string }> =
  {
    "prov-o": {
      title: "Provenance",
      short: "PROV-O",
      prompt:
        "Which source produced this row, and which transformation made it visible here?",
    },
    skos: {
      title: "Classification",
      short: "SKOS",
      prompt:
        "Which provider category is being compared? A shared code is a grouping, not an equivalence between political actors.",
    },
    "owl-time": {
      title: "Time",
      short: "OWL-Time",
      prompt:
        "Which supplied date interval applies? Historical occurrence, publication and ingestion clocks stay separate.",
    },
    geosparql: {
      title: "Place",
      short: "GeoSPARQL",
      prompt:
        "Where did the provider place the event, and at what precision? Coordinates do not establish exact incident sites or current control.",
    },
    "sosa-ssn": {
      title: "Observation",
      short: "SOSA / SSN",
      prompt:
        "What property was reported, for which economy and annual period, in which units? These are statistical estimates, not a sensor feed.",
    },
  };
const palette = ["#426f64", "#ad6544", "#607d9c"];
const number = (v: unknown) =>
  v === null ? "null" : v === "" ? '"" (empty string)' : String(v);
const ordered = (values: string[]) => [...new Set(values)].sort();
function activate(event: React.KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function RecordPlot({
  records,
  selected,
  lens,
  pick,
  classify,
}: {
  records: RecordNode[];
  selected: string;
  lens: LensId;
  pick: (id: string) => void;
  classify: (id: string) => void;
}) {
  const nodes = sparseRecords(records, selected),
    concepts = [
      ...new Map(records.map((n) => [n.concept.id, n.concept])).values(),
    ],
    countries = ordered(records.map((n) => n.country_code));
  const years = records.flatMap((n) => [
      Number(n.date_start.slice(0, 4)),
      Number(n.date_end.slice(0, 4)),
    ]),
    from = Math.min(...years, 2011),
    to = Math.max(...years, 2025);
  const positions = nodes.map((n, i) => {
    if (lens === "geosparql")
      return {
        n,
        x: 65 + ((n.longitude - 20) / 50) * 760,
        y: 360 - ((n.latitude - 8) / 38) * 300,
      };
    if (lens === "owl-time")
      return {
        n,
        x:
          65 +
          ((Date.parse(n.date_start) - Date.UTC(from, 0, 1)) /
            (Date.UTC(to + 1, 0, 1) - Date.UTC(from, 0, 1))) *
            760,
        y:
          65 +
          (countries.indexOf(n.country_code) /
            Math.max(1, countries.length - 1)) *
            290,
      };
    const group =
      lens === "skos" ? concepts.findIndex((c) => c.id === n.concept.id) : 0;
    return {
      n,
      x: 65 + (i % 6) * 69,
      y:
        45 +
        (Math.floor(i / 6) / Math.max(1, Math.ceil(nodes.length / 6) - 1)) *
          310 +
        (group % 2) * 3,
    };
  });
  return (
    <div className="se-plot-wrap">
      <svg
        className="se-plot"
        viewBox="0 0 900 420"
        role="group"
        aria-label={`${labels[lens].title} record plot; the directory provides the complete keyboard alternative`}
      >
        <title>
          {labels[lens].title}: {nodes.length} of {records.length} matched
          records drawn
        </title>
        {lens === "geosparql" ? (
          <>
            {[20, 30, 40, 50, 60, 70].map((lon) => (
              <g key={lon}>
                <path
                  d={`M${65 + ((lon - 20) / 50) * 760},50V365`}
                  className="se-gridline"
                />
                <text x={65 + ((lon - 20) / 50) * 760} y={390}>
                  {lon}°E
                </text>
              </g>
            ))}
            {[10, 20, 30, 40].map((lat) => (
              <g key={lat}>
                <path
                  d={`M65,${360 - ((lat - 8) / 38) * 300}H825`}
                  className="se-gridline"
                />
                <text x={13} y={365 - ((lat - 8) / 38) * 300}>
                  {lat}°N
                </text>
              </g>
            ))}
            <text x="65" y="24">
              Provider-coordinate plot · no borders, centroids or spatial
              inference
            </text>
          </>
        ) : lens === "owl-time" ? (
          <>
            {countries.map((c, i) => (
              <g key={c}>
                <path
                  className="se-gridline"
                  d={`M65,${65 + (i / Math.max(1, countries.length - 1)) * 290}H825`}
                />
                <text
                  x="14"
                  y={70 + (i / Math.max(1, countries.length - 1)) * 290}
                >
                  {c}
                </text>
              </g>
            ))}
            {[from, Math.round((from + to) / 2), to].map((y, i) => (
              <text key={i} x={65 + i * 380} y="393">
                {y}
              </text>
            ))}
            <text x="65" y="24">
              Supplied event starts by country · intervals remain in the
              inspector
            </text>
          </>
        ) : (
          <>
            {positions.map(({ n, x, y }) => {
              const group =
                  lens === "skos"
                    ? concepts.findIndex((c) => c.id === n.concept.id)
                    : 0,
                targetY = lens === "skos" ? 85 + group * 105 : 205;
              return (
                <path
                  key={`e:${n.id}`}
                  d={`M${x},${y}C530,${y} 530,${targetY} 650,${targetY}`}
                  className="se-source-edge"
                />
              );
            })}
            {lens === "skos" ? (
              concepts.map((c, i) => (
                <g
                  className="se-node se-anchor"
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Filter category ${c.label}`}
                  onClick={() => classify(c.id)}
                  onKeyDown={(e) => activate(e, () => classify(c.id))}
                >
                  <circle
                    cx="650"
                    cy={85 + i * 105}
                    r="12"
                    fill={palette[i % 3]}
                  />
                  <text x="675" y={90 + i * 105}>
                    {c.label}
                  </text>
                </g>
              ))
            ) : (
              <g>
                <rect x="640" y="185" width="20" height="40" fill="#426f64" />
                <text x="680" y="205">
                  {records[0]?.dataset_id || "No records"}
                </text>
                <text x="680" y="226">
                  prov:wasDerivedFrom
                </text>
              </g>
            )}
            <text x="65" y="395">
              Links show source membership or provider categories; distance has
              no semantic meaning.
            </text>
          </>
        )}
        {positions.map(({ n, x, y }) => (
          <g
            key={n.id}
            className={`se-node ${n.id === selected ? "se-node-selected" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`Plot record ${n.label}; ${n.id}`}
            onClick={() => pick(n.id)}
            onKeyDown={(e) => activate(e, () => pick(n.id))}
          >
            <title>
              {n.label} · {n.id} · where_prec {n.precision.where_prec}
            </title>
            <circle
              cx={x}
              cy={y}
              r={n.id === selected ? 7 : 4}
              fill={
                palette[concepts.findIndex((c) => c.id === n.concept.id) % 3]
              }
            />
          </g>
        ))}
      </svg>
      <p className="se-caption">
        {nodes.length} plotted / {records.length.toLocaleString("en")} matched.
        A deterministic spread through the index, not a representative sample.
        Every point opens its original row.
      </p>
    </div>
  );
}

function AnnualPlot({
  records,
  pick,
}: {
  records: ResearchRecord[];
  pick: (r: ResearchRecord) => void;
}) {
  const first = records[0],
    same = records.filter(
      (r) =>
        r.country_code === first?.country_code &&
        r.attributes.indicator_id === first?.attributes.indicator_id,
    ),
    points = same
      .filter(
        (r) =>
          typeof r.attributes.value === "number" &&
          Number.isFinite(r.attributes.value),
      )
      .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const values = points.map((r) => Number(r.attributes.value)),
    years = points.map((r) => Number(r.date_start.slice(0, 4))),
    low = Math.min(...values),
    high = Math.max(...values),
    minYear = Math.min(...years),
    maxYear = Math.max(...years);
  const xy = (r: ResearchRecord) => [
    65 +
      ((Number(r.date_start.slice(0, 4)) - minYear) /
        Math.max(1, maxYear - minYear)) *
        750,
    330 - ((Number(r.attributes.value) - low) / Math.max(1, high - low)) * 250,
  ];
  return (
    <section
      className="se-annual"
      aria-label="Original annual observation example"
    >
      <h3>
        {String(first?.attributes.indicator_name)} · {first?.country_code}
      </h3>
      <p>
        {String(
          first?.attributes.display_unit ||
            first?.attributes.unit ||
            "Unit not supplied",
        )}{" "}
        · {minYear}–{maxYear}. {same.length - points.length} null/non-numeric
        cells excluded; no missing years filled.
      </p>
      <svg
        className="se-plot"
        viewBox="0 0 900 410"
        role="group"
        aria-label="Annual estimates; each point opens the original value"
      >
        <path d="M65,45V345H830" className="se-gridline" />
        <text x="65" y="25">
          {high.toExponential(2)}
        </text>
        <text x="65" y="370">
          {minYear}
        </text>
        <text x="795" y="370">
          {maxYear}
        </text>
        {points.map((r, i) => {
          const [x, y] = xy(r),
            previous = points[i - 1],
            a = previous && xy(previous);
          return (
            <g key={r.id}>
              {a &&
                Number(r.date_start.slice(0, 4)) -
                  Number(previous.date_start.slice(0, 4)) ===
                  1 && (
                  <path
                    d={`M${a[0]},${a[1]}L${x},${y}`}
                    className="se-annual-line"
                  />
                )}
              <g
                className="se-node"
                role="button"
                tabIndex={0}
                aria-label={`Annual observation ${r.label}; ${r.id}`}
                onClick={() => pick(r)}
                onKeyDown={(e) => activate(e, () => pick(r))}
              >
                <title>
                  {r.label} · {String(r.attributes.value)}
                </title>
                <circle cx={x} cy={y} r="6" fill="#426f64" />
              </g>
            </g>
          );
        })}
      </svg>
      <p className="se-caption">
        A separate World Bank annual example, outside the GED navigation index.
        Point positions display the supplied value; they establish no
        relationship with violence records.
      </p>
      <details>
        <summary>Annual values & keyboard directory</summary>
        <div className="se-annual-table">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Original value</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {same.map((r) => (
                <tr key={r.id}>
                  <td>{r.date_start.slice(0, 4)}</td>
                  <td>{number(r.attributes.value)}</td>
                  <td>
                    <button onClick={() => pick(r)}>
                      Inspect {r.date_start.slice(0, 4)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default function SemanticExplorer() {
  const [exploration, setExploration] = useState<Exploration | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(
      "Loading and verifying the semantic catalogue…",
    ),
    [database, setDatabase] = useState("Database API unconfigured");
  const [lens, setLens] = useState<LensId>("geosparql"),
    [filter, setFilter] = useState(EMPTY_FILTER),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(""),
    [row, setRow] = useState<ResearchRecord | null>(null),
    [rowStatus, setRowStatus] = useState("");
  const [annual, setAnnual] = useState<ResearchSelection | null>(null),
    [tray, setTray] = useState<ResearchRecord[]>([]),
    [question, setQuestion] = useState(""),
    [notes, setNotes] = useState({
      assessment: "",
      alternatives: "",
      gaps: "",
    });
  const store = useRef<SemanticRecordStore | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadExploration("./semantic/", controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setExploration(value);
        store.current = new SemanticRecordStore(value);
        setSelected(value.records[0]?.id || "");
        setStatus(
          `Verified catalogue: ${value.records.length.toLocaleString("en")} GED navigation records. Original provider rows load only when inspected.`,
        );
        void researchDatabaseStatus(value.manifest, controller.signal)
          .then(setDatabase)
          .catch(() => {});
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            `Catalogue refused: ${e instanceof Error ? e.message : String(e)}`,
          );
          setStatus("No example or generated graph was substituted.");
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!exploration || !selected) return;
    const node = exploration.records.find((n) => n.id === selected);
    if (!node) return;
    let cancelled = false;
    setRow(null);
    setRowStatus(
      "Verifying source-subset bytes and original provider-row digest…",
    );
    void store
      .current!.record(node)
      .then((value) => {
        if (!cancelled) {
          setRow(value);
          setRowStatus(
            "Original provider row verified · all retained fields below.",
          );
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRow(null);
          setRowStatus(
            `Original record refused: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [exploration, selected]);
  useEffect(() => {
    if (!exploration || lens !== "sosa-ssn" || annual) return;
    let cancelled = false;
    void loadAnnualExample(exploration)
      .then((value) => {
        if (!cancelled) setAnnual(value);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            `Annual example refused: ${e instanceof Error ? e.message : String(e)}`,
          );
      });
    return () => {
      cancelled = true;
    };
  }, [exploration, lens, annual]);
  const filtered = useMemo(
    () => filterSemanticRecords(exploration?.records || [], filter),
    [exploration, filter],
  );
  const currentLens = exploration?.catalog.lenses.find((l) => l.id === lens),
    currentNode = exploration?.records.find((n) => n.id === row?.id),
    dataset = exploration?.manifest.datasets.find(
      (d) => d.id === row?.dataset_id,
    ),
    rawSource = exploration?.manifest.raw_shards.find(
      (s) => s.source_path === currentNode?.raw_shard,
    );
  function update(key: keyof typeof filter, value: string | boolean) {
    setFilter((f) => ({ ...f, [key]: value }));
    setPage(0);
  }
  function add() {
    if (!row || tray.some((r) => r.id === row.id)) return;
    if (tray.length >= 200) {
      setStatus(
        "Preparation is limited to 200 records. Remove a record before adding another.",
      );
      return;
    }
    setTray([...tray, row]);
    setStatus(`Added original record ${row.id} to preparation.`);
  }
  function download() {
    if (!exploration) return;
    try {
      const prepared = prepareResearchSelection(
        exploration,
        tray,
        notes,
        question,
      );
      const url = URL.createObjectURL(
          new Blob([Uint8Array.from(prepared.bytes)], {
            type: "application/json",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "prepared-research-selection.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(
        `Prepared ${tray.length} records; ${prepared.bytes.byteLength.toLocaleString("en")} bytes. This is not a native capsule or live PRAXIS attachment.`,
      );
    } catch (e) {
      setStatus(
        `Preparation refused: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (!exploration)
    return (
      <section className="semantic-explorer" aria-label="Semantic exploration">
        <p role="status">{status}</p>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="semantic-explorer" aria-label="Semantic exploration">
      <div className="se-stats">
        <p>
          <strong>{exploration.records.length.toLocaleString("en")}</strong>{" "}
          real GED record nodes{" "}
          <span>
            + {exploration.graph.nodes.length - exploration.records.length}{" "}
            source/category anchors
          </span>
        </p>
        <p>
          <strong>{exploration.graph.edges.length.toLocaleString("en")}</strong>{" "}
          declared source/category links{" "}
          <span>No causal, identity or spatial relations inferred</span>
        </p>
        <p className="se-database">
          {database}
          <span>Catalogue built {exploration.manifest.built_at}</span>
        </p>
      </div>
      <p className="se-scope">
        Navigation slice of{" "}
        {exploration.graph.selection.available_records.toLocaleString("en")}{" "}
        retained provider records. {exploration.graph.selection.purpose}.
        Method: <code>{exploration.graph.selection.method}</code>.
      </p>
      <nav className="se-lenses" aria-label="Semantic lens">
        {LENS_IDS.map((id) => (
          <button
            key={id}
            aria-pressed={lens === id}
            onClick={() => {
              setLens(id);
              if (
                id !== "sosa-ssn" &&
                !exploration.records.some((n) => n.id === selected)
              )
                setSelected(filtered[0]?.id || exploration.records[0].id);
            }}
          >
            {labels[id].title}
            <small>{labels[id].short}</small>
          </button>
        ))}
      </nav>
      <div className="se-lens-note">
        <h2>
          {labels[lens].title} · {labels[lens].short}
        </h2>
        <p>{labels[lens].prompt}</p>
        <details>
          <summary>Vocabulary, exact fields & boundaries</summary>
          <p>{currentLens?.scope}</p>
          <p>Field selectors: {currentLens?.record_fields.join(" · ")}</p>
          <ul>
            {currentLens?.terms.map((t) => (
              <li key={t.id}>
                <a href={t.url} target="_blank" rel="noopener noreferrer">
                  {t.id}: {t.label}
                </a>
              </li>
            ))}
          </ul>
          <ul>
            {currentLens?.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p>
            These are vocabulary-informed exploration lenses, not a formal RDF
            reasoner, automatic equivalence mapping or a claim of ontology
            compliance.
          </p>
        </details>
      </div>
      {lens !== "sosa-ssn" && (
        <form className="se-filters" onSubmit={(e) => e.preventDefault()}>
          <label>
            Search index
            <input
              value={filter.query}
              maxLength={200}
              placeholder="Place, source ID or provider category"
              onChange={(e) => update("query", e.target.value)}
            />
          </label>
          <label>
            Country code
            <select
              value={filter.country}
              onChange={(e) => update("country", e.target.value)}
            >
              <option value="">All indexed countries</option>
              {ordered(exploration.records.map((n) => n.country_code)).map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Provider category
            <select
              value={filter.concept}
              onChange={(e) => update("concept", e.target.value)}
            >
              <option value="">All provider categories</option>
              {[
                ...new Map(
                  exploration.records.map((n) => [n.concept.id, n.concept]),
                ).values(),
              ].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.value} · {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            From year
            <input
              type="number"
              min="1"
              max="9999"
              value={filter.yearFrom}
              onChange={(e) => update("yearFrom", e.target.value)}
            />
          </label>
          <label>
            Through year
            <input
              type="number"
              min="1"
              max="9999"
              value={filter.yearTo}
              onChange={(e) => update("yearTo", e.target.value)}
            />
          </label>
          <label className="se-checkbox">
            <input
              type="checkbox"
              checked={filter.preciseOnly}
              onChange={(e) => update("preciseOnly", e.target.checked)}
            />
            where_prec = 1 only
          </label>
          <button
            type="button"
            onClick={() => {
              setFilter(EMPTY_FILTER);
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </form>
      )}
      <p className="se-status" role="status">
        {status}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="se-workspace">
        <div className="se-navigation">
          {lens === "sosa-ssn" ? (
            annual ? (
              <AnnualPlot
                records={annual.records}
                pick={(value) => {
                  setRow(value);
                  setSelected(value.id);
                  setRowStatus(
                    "Original annual example bytes verified; supplied fields retained.",
                  );
                }}
              />
            ) : (
              <p>Verifying the separate annual example…</p>
            )
          ) : (
            <>
              <RecordPlot
                records={filtered}
                selected={selected}
                lens={lens}
                pick={setSelected}
                classify={(value) => update("concept", value)}
              />
              <section
                className="se-directory"
                aria-label="Complete record directory"
              >
                <div className="se-directory-heading">
                  <h3>
                    Record directory · {filtered.length.toLocaleString("en")}{" "}
                    matches
                  </h3>
                  <p>
                    All matched index entries are available here;{" "}
                    {DIRECTORY_PAGE_SIZE} per page.
                  </p>
                </div>
                <div className="se-record-list">
                  {filtered
                    .slice(
                      page * DIRECTORY_PAGE_SIZE,
                      (page + 1) * DIRECTORY_PAGE_SIZE,
                    )
                    .map((n) => (
                      <button
                        key={n.id}
                        aria-pressed={selected === n.id}
                        onClick={() => setSelected(n.id)}
                      >
                        <strong>{n.label}</strong>
                        <span>
                          {n.country_code} · {n.concept.label} · where_prec{" "}
                          {n.precision.where_prec}
                        </span>
                        <code>{n.id}</code>
                      </button>
                    ))}
                </div>
                {!filtered.length && (
                  <p>
                    No indexed records match these filters. This does not
                    establish an absence of events.
                  </p>
                )}
                <div className="se-pagination">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous records
                  </button>
                  <span>
                    Page {page + 1} /{" "}
                    {Math.max(
                      1,
                      Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE),
                    )}
                  </span>
                  <button
                    disabled={
                      (page + 1) * DIRECTORY_PAGE_SIZE >= filtered.length
                    }
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next records
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
        <section
          className="se-inspector"
          aria-label="Semantic original record inspector"
          tabIndex={0}
          key={row?.id || selected}
        >
          <p className="se-caption">{rowStatus}</p>
          {row ? (
            <>
              <h2>{row.label}</h2>
              <code>{row.id}</code>
              {currentNode && !filtered.some((n) => n.id === row.id) && (
                <p className="se-caption">
                  This inspected record is outside the current filters.
                </p>
              )}
              <dl>
                <dt>Source dataset / version</dt>
                <dd>
                  {dataset?.title} · {dataset?.version}
                </dd>
                <dt>Original locator</dt>
                <dd>{row.source_locator}</dd>
                <dt>Supplied historical interval</dt>
                <dd>
                  {row.date_start} to {row.date_end}
                </dd>
                <dt>Kind / country code</dt>
                <dd>
                  {row.kind} · {row.country_code}
                </dd>
              </dl>
              {currentNode && (
                <details>
                  <summary>Empirical trace & integrity</summary>
                  <dl>
                    <dt>Archive snapshot SHA-256</dt>
                    <dd>
                      <code>{dataset?.sha256}</code>
                    </dd>
                    <dt>Original partition</dt>
                    <dd>{rawSource?.source_path}</dd>
                    <dt>Original partition SHA-256</dt>
                    <dd>
                      <code>{rawSource?.source_sha256}</code>
                    </dd>
                    <dt>Copied subset SHA-256</dt>
                    <dd>
                      <code>{rawSource?.asset.sha256}</code>
                    </dd>
                    <dt>Canonical original provider row SHA-256</dt>
                    <dd>
                      <code>{currentNode.raw_record_sha256}</code>
                    </dd>
                  </dl>
                  <p>
                    The build verified the original partition, then copied only
                    indexed rows. This reader verifies the copied subset bytes
                    and original-row digest. A digest binds bytes, not
                    historical truth.
                  </p>
                </details>
              )}
              {row.kind === "country_indicator" && (
                <p className="se-caption">
                  SOSA alignment: economy feature (<code>country_id</code>),
                  property (<code>indicator_id</code>), period (
                  <code>date</code>), supplied result (<code>value</code>) and
                  original unit metadata. No sensor or direct-measurement claim.
                </p>
              )}
              <button
                className="se-add"
                disabled={
                  tray.some((r) => r.id === row.id) || tray.length >= 200
                }
                onClick={add}
              >
                {tray.some((r) => r.id === row.id)
                  ? "In preparation"
                  : "Add verified record to preparation"}
              </button>
              <h3>
                Original provider fields · {Object.keys(row.attributes).length}
              </h3>
              <dl className="se-attributes">
                {Object.entries(row.attributes).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{number(v)}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p>
              Select an indexed record to inspect the original source fields.
            </p>
          )}
        </section>
      </div>
      <section
        className="se-preparation"
        aria-label="Context Capsule preparation"
      >
        <div>
          <p className="kicker">Preparation / architecture prototype</p>
          <h2>Prepare a bounded research context</h2>
          <p>
            Collect inspected records, state the policy question and record
            alternatives or gaps. The download is a{" "}
            <code>policy-research-selection/1</code> file: open it in Research
            selection mode to inspect its exact bytes. Native capsule creation
            and attachment to PRAXIS require a separate, unverified bridge.
          </p>
          <p>
            <strong>{tray.length} / 200</strong> records selected. No automatic
            assessment, model answer or quality score.
          </p>
          <details>
            <summary>Selected records & omissions</summary>
            {tray.length ? (
              <ul>
                {tray.map((r) => (
                  <li key={r.id}>
                    {r.label}{" "}
                    <button
                      onClick={() =>
                        setTray((rows) => rows.filter((v) => v.id !== r.id))
                      }
                    >
                      Remove {r.id}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No records selected.</p>
            )}
            <p>
              The download explicitly records omitted corpus context and
              original documents. Manual selection can introduce selection bias.
            </p>
          </details>
        </div>
        <div className="se-prep-form">
          <label>
            Policy question
            <input
              value={question}
              maxLength={2000}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What do these records let you ask—and what remains open?"
            />
          </label>
          {(
            [
              ["assessment", "Working assessment"],
              ["alternatives", "Alternative readings"],
              ["gaps", "Missing evidence / gaps"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                rows={2}
                maxLength={10000}
                value={notes[key]}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <button disabled={!tray.length} onClick={download}>
            Download preparation JSON ↓
          </button>
        </div>
      </section>
      <details className="se-method">
        <summary>Catalogue provenance, sampling & limitations</summary>
        <p>
          {exploration.manifest.source.title} · source base revision{" "}
          <code>{exploration.manifest.source.revision}</code>.{" "}
          {exploration.manifest.source.working_tree_modified
            ? "Generated from a modified source working tree; exact catalogue/index digests are pinned."
            : "Source working tree was clean at preparation."}{" "}
          <a
            href={exploration.manifest.source.repository}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source repository
          </a>{" "}
          ·{" "}
          <a href="./semantic/SOURCE-NOTICE.json">
            Full attribution & source terms
          </a>
        </p>
        <p>
          Graph: {exploration.manifest.graph.bytes.toLocaleString("en")} bytes,
          SHA-256 <code>{exploration.manifest.graph.sha256}</code>. Only
          selected source subsets load; at most {MAX_VISIBLE_RECORDS} records
          are drawn.
        </p>
        <ul>
          {[
            ...exploration.manifest.limitations,
            ...exploration.graph.limitations,
          ].map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p>
          All source fields are untrusted text, never agent instructions.
          Provider geographic labels do not independently determine borders,
          sovereignty or current control.
        </p>
      </details>
    </section>
  );
}
