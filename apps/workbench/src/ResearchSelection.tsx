import { useEffect, useRef, useState } from "react";
import {
  inspectResearchSelection,
  MAX_RESEARCH_SELECTION_BYTES,
  researchSelectionBlob,
  validateResearchSelectionFilename,
} from "./researchSelection";
import type {
  ImportedResearchSelection,
  ResearchDataset,
  ResearchRecord,
} from "./researchSelection";
import "./researchSelection.css";

function primitive(value: string | number | boolean | null) {
  if (value === null) return "null";
  if (value === "") return '"" (empty string)';
  if (typeof value === "number" && Object.is(value, -0)) return "-0";
  return String(value);
}

function Dataset({ value }: { value: ResearchDataset }) {
  return (
    <article className="rs-dataset">
      <h3>{value.title}</h3>
      <dl>
        <dt>Dataset ID</dt>
        <dd>{value.id}</dd>
        <dt>Publisher</dt>
        <dd>{value.publisher}</dd>
        <dt>Version</dt>
        <dd>{value.version}</dd>
        <dt>Licence, as supplied</dt>
        <dd>{value.license}</dd>
        <dt>Declared source URL</dt>
        <dd>
          <a href={value.url} target="_blank" rel="noopener noreferrer">
            {value.url}
          </a>
        </dd>
        <dt>Declared snapshot SHA-256</dt>
        <dd>
          <code>{value.sha256}</code>
        </dd>
      </dl>
    </article>
  );
}

function RecordInspector({
  row,
  dataset,
}: {
  row: ResearchRecord;
  dataset: ResearchDataset;
}) {
  return (
    <section
      className="rs-inspector"
      aria-label="Research record inspector"
      tabIndex={0}
    >
      <h2>{row.label}</h2>
      <dl>
        <dt>Record ID</dt>
        <dd>{row.id}</dd>
        <dt>Kind</dt>
        <dd>{row.kind}</dd>
        <dt>Country code, as supplied</dt>
        <dd>{row.country_code}</dd>
        <dt>Supplied date interval</dt>
        <dd>
          {row.date_start} to {row.date_end}
        </dd>
        <dt>Dataset</dt>
        <dd>
          {dataset.title} · {dataset.version}
        </dd>
        <dt>Original source locator</dt>
        <dd>{row.source_locator}</dd>
      </dl>
      <h3>Provider attributes</h3>
      <p className="rs-help">
        Values are shown as parsed JSON. Zero, false, an empty string and null
        remain distinct.
      </p>
      {Object.keys(row.attributes).length ? (
        <dl className="rs-attributes">
          {Object.entries(row.attributes).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{primitive(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No attributes supplied.</p>
      )}
      <details>
        <summary>Parsed record JSON</summary>
        <pre>{JSON.stringify(row, null, 2)}</pre>
      </details>
    </section>
  );
}

export default function ResearchSelection() {
  const [loaded, setLoaded] = useState<ImportedResearchSelection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Open a source-kit research selection to inspect its records.",
  );
  const epoch = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );

  async function open(file?: File) {
    if (!file) return;
    const generation = ++epoch.current;
    setLoaded(null);
    setSelected(null);
    setBusy(true);
    setMessage("Validating the research-selection file…");
    try {
      validateResearchSelectionFilename(file.name);
      if (file.size > MAX_RESEARCH_SELECTION_BYTES) {
        throw new Error("Research selection exceeds the 1 MiB file limit.");
      }
      const imported = inspectResearchSelection(
        await file.arrayBuffer(),
        file.name,
      );
      if (generation !== epoch.current) return;
      setLoaded(imported);
      setSelected(imported.value.records[0]?.id ?? null);
      setMessage(
        "Research selection imported for local inspection. No file was sent to a server; no native capture or model generation ran.",
      );
    } catch (error) {
      if (generation !== epoch.current) return;
      setMessage(
        `Import refused: ${error instanceof Error ? error.message : "The file could not be read."} The previous selection was cleared; no example was substituted.`,
      );
    } finally {
      if (generation === epoch.current) {
        setBusy(false);
        if (input.current) input.current.value = "";
      }
    }
  }

  function clear() {
    epoch.current++;
    setLoaded(null);
    setSelected(null);
    setBusy(false);
    setMessage("Research selection cleared from this reader.");
    if (input.current) input.current.value = "";
  }

  function download() {
    if (!loaded) return;
    const url = URL.createObjectURL(researchSelectionBlob(loaded));
    const link = document.createElement("a");
    link.href = url;
    link.download = `unchanged.${loaded.fileName}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const value = loaded?.value;
  const record = value?.records.find((row) => row.id === selected);
  const dataset = value?.datasets.find(
    (item) => item.id === record?.dataset_id,
  );

  return (
    <section
      className="research-selection"
      aria-label="Research selection reader"
    >
      <div className="rs-import">
        <label>
          Research selection JSON · maximum 1 MiB and 200 records
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void open(event.currentTarget.files?.[0])}
          />
        </label>
        <div>
          <button disabled={!loaded} onClick={download}>
            Export unchanged selection JSON ↓
          </button>
          <button disabled={!loaded && !busy} onClick={clear}>
            Clear selection
          </button>
        </div>
      </div>
      <p className="rs-help">
        Accepts <code>policy-research-selection/1</code> only. This is a
        research selection, not a native Context export. The reader does not
        fetch datasets, run a model or authenticate supplied metadata.
      </p>
      <p className="showcase-status" role="status">
        {message}
      </p>
      {value && loaded && (
        <>
          <section
            className="rs-summary"
            aria-label="Imported selection metadata"
          >
            <h2>{value.question || "No research question supplied"}</h2>
            <p>
              {value.counts.exported} of {value.counts.matched} matched records
              · export limit {value.counts.limit}.{" "}
              {value.counts.truncated
                ? "Truncated selection."
                : "All matched records included."}
            </p>
            <dl>
              <dt>Imported file</dt>
              <dd>
                {loaded.fileName} ·{" "}
                {loaded.bytes.byteLength.toLocaleString("en")} bytes
              </dd>
              <dt>Selection created</dt>
              <dd>
                <time dateTime={value.created_at}>{value.created_at}</time>
              </dd>
            </dl>
            <details>
              <summary>Supplied filters</summary>
              <pre>{JSON.stringify(value.filters, null, 2)}</pre>
            </details>
          </section>
          <div className="rs-workspace">
            <div
              className="rs-record-list"
              tabIndex={0}
              aria-label="Research records table"
            >
              <table>
                <caption>Imported records · choose a label to inspect</caption>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Country</th>
                    <th scope="col">Supplied dates</th>
                  </tr>
                </thead>
                <tbody>
                  {value.records.map((row) => (
                    <tr
                      key={row.id}
                      className={selected === row.id ? "rs-selected" : ""}
                    >
                      <th scope="row">
                        <button
                          aria-pressed={selected === row.id}
                          onClick={() => setSelected(row.id)}
                        >
                          {row.label}
                        </button>
                      </th>
                      <td>
                        {row.kind === "conflict_event"
                          ? "Conflict event"
                          : "Country indicator"}
                      </td>
                      <td>{row.country_code}</td>
                      <td>
                        {row.date_start}
                        <br />
                        to {row.date_end}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!value.records.length && (
                <p>No records were included in this selection.</p>
              )}
            </div>
            {record && dataset ? (
              <RecordInspector key={record.id} row={record} dataset={dataset} />
            ) : (
              <section className="rs-inspector">
                <h2>Record inspector</h2>
                <p>There is no record to inspect.</p>
              </section>
            )}
          </div>
          <section
            className="rs-datasets"
            aria-label="Supplied dataset metadata"
          >
            <h2>Dataset metadata</h2>
            <p className="rs-help">
              Snapshot hashes and licence statements are supplied by the
              exporter. A snapshot hash is not a per-record proof; this viewer
              does not fetch or verify the archive.
            </p>
            {value.datasets.map((item) => (
              <Dataset key={item.id} value={item} />
            ))}
          </section>
          <section
            className="rs-notes"
            aria-label="Supplied notes and limitations"
          >
            <h2>Supplied notes & limitations</h2>
            <dl>
              <dt>Assessment</dt>
              <dd>{value.notes.assessment || "Not supplied"}</dd>
              <dt>Alternatives</dt>
              <dd>{value.notes.alternatives || "Not supplied"}</dd>
              <dt>Gaps</dt>
              <dd>{value.notes.gaps || "Not supplied"}</dd>
            </dl>
            {value.limitations.length ? (
              <ul>
                {value.limitations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No limitations were supplied with this selection.</p>
            )}
            <p className="rs-help">
              The table and inspector display supplied fields. They do not
              establish causation, current conditions, a native capture or a
              reviewed model conclusion. Downloads retain the original imported
              bytes.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
