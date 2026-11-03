import { useId, useMemo, useState } from "react";
import type { NativeContext } from "../graph/evidenceGraph";
import { LAYERS, indexLayers, displayClock } from "./contextLayers.mjs";
import "./context.css";

export default function ContextLayers({ value }: { value: NativeContext }) {
  const [active, setActive] = useState("evidence");
  const uid = useId(),
    context = value.context;
  const indexed = useMemo(() => indexLayers(value), [value]);
  const [claimId, setClaimId] = useState(Object.keys(context.claims)[0] || "");
  const selected = context.claims[claimId];
  const layer = LAYERS.find((row) => row[0] === active)!;
  const claimSelect = (
    <label>
      Inspect an assertion
      <select value={claimId} onChange={(e) => setClaimId(e.target.value)}>
        {indexed.claims.map(([id, row]) => (
          <option key={id} value={id}>
            {row.assertion.proposition}
          </option>
        ))}
      </select>
    </label>
  );
  const pair = (label: string, data: unknown) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {data === null || data === undefined
          ? "Not supplied"
          : typeof data === "string"
            ? data
            : JSON.stringify(data)}
      </dd>
    </div>
  );
  return (
    <section className="context-layers" aria-label="Seven context layers">
      <div className="cl-heading">
        <div>
          <p className="cl-kicker">Context anatomy</p>
          <h2>Inspect what the context contains.</h2>
        </div>
        <p>
          Each layer has a different evidentiary role. Nothing in this inspector
          changes the underlying context or its review state.
        </p>
      </div>
      <div className="cl-layout">
        <nav aria-label="Context layer">
          <div className="cl-layer-list">
            {LAYERS.map(([id, title], i) => (
              <button
                key={id}
                type="button"
                aria-pressed={active === id}
                onClick={() => setActive(id)}
              >
                <span className="cl-number">0{i + 1}</span>
                <span>{title}</span>
                <small>
                  {indexed.counts[id as keyof typeof indexed.counts]}
                </small>
              </button>
            ))}
          </div>
        </nav>
        <div className="cl-inspector" id={uid} aria-live="polite">
          <p className="cl-kicker">{layer[1]}</p>
          <h3>{layer[2]}</h3>
          {active === "purpose" && (
            <dl>
              {pair("Question", context.question)}
              {pair("Status", value.status)}
              {pair("Trust", context.trust)}
              {pair("Ontology identifier", context.ontology)}
              {pair("Archive digest", value.archive_digest)}
              {pair("Manifest", value.manifest.title)}
            </dl>
          )}
          {["evidence", "assertions", "review"].includes(active) && (
            <>
              {indexed.claims.length ? (
                claimSelect
              ) : (
                <p>No assertions were returned. Inspect Omissions.</p>
              )}
              {selected && (
                <>
                  {active === "evidence" && (
                    <>
                      <p className="cl-source-title">
                        {selected.assertion.speaker}
                      </p>
                      <p>{selected.assertion.proposition}</p>
                      {selected.citations.map((cite, i) => (
                        <div className="cl-citation" key={i}>
                          <blockquote dir="auto">{cite.text}</blockquote>
                          <p>{cite.title}</p>
                          <dl>
                            {pair("Source record", cite.span.source)}
                            {pair("Locator", cite.span.locator)}
                            {pair(
                              "UTF-8 byte range",
                              `${cite.span.start}–${cite.span.end}`,
                            )}
                            {pair("Source text hash", cite.span.text_hash)}
                            {pair("Rights", cite.license)}
                          </dl>
                        </div>
                      ))}
                      <p className="cl-note">
                        A returned excerpt does not verify the hash of a
                        complete source file. The local native archive retains
                        that separate integrity boundary.
                      </p>
                    </>
                  )}
                  {active === "assertions" && (
                    <>
                      <p className="cl-proposition">
                        {selected.assertion.proposition}
                      </p>
                      <dl>
                        {pair("Speaker", selected.assertion.speaker)}
                        {pair("Subject", selected.assertion.subject)}
                        {pair("Predicate", selected.assertion.predicate)}
                        {pair("Object", selected.assertion.object)}
                        {pair(
                          "Epistemic type",
                          selected.assertion.epistemic_type,
                        )}
                        {pair("Modality", selected.assertion.modality)}
                        {pair("Knowledge", selected.knowledge)}
                      </dl>
                      <h4>Conditions</h4>
                      <ul>
                        {selected.assertion.conditions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                      <h4>Exceptions</h4>
                      {selected.assertion.exceptions.length ? (
                        <ul>
                          {selected.assertion.exceptions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No exceptions supplied in this record.</p>
                      )}
                    </>
                  )}
                  {active === "review" && (
                    <>
                      <dl>
                        {pair("Trust", context.trust)}
                        {pair("Knowledge state", selected.knowledge)}
                        {pair(
                          "Epistemic type",
                          selected.assertion.epistemic_type,
                        )}
                        {pair("Modality", selected.assertion.modality)}
                      </dl>
                      <ul>
                        {selected.assertion.conditions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
              {active === "review" && (
                <>
                  <h4>Context warnings</h4>
                  {context.warnings.length ? (
                    <ul>
                      {context.warnings.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No context warnings supplied.</p>
                  )}
                  <h4>Manifest limitations</h4>
                  <ul>
                    {value.manifest.limitations.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {active === "ontology" && (
            <>
              <dl>
                {pair("Declared ontology", context.ontology)}
                {pair("Returned context format", context.format)}
              </dl>
              <p>
                The context includes entity types and relationships, not the
                complete ontology schema. Relationships retain their annotated
                rationale; an edge is not evidence of historical causation.
              </p>
              <h4>Entities</h4>
              <ul className="cl-records">
                {Object.values(context.entities).map((entity) => (
                  <li key={entity.id}>
                    <span>{entity.kind}</span>
                    <strong>{entity.label}</strong>
                    <small>{entity.claims.length} linked assertions</small>
                  </li>
                ))}
              </ul>
              <h4>Relationships</h4>
              {context.relationships.map((edge, i) => (
                <article className="cl-edge" key={i}>
                  <strong>{edge.kind.replaceAll("_", " ")}</strong>
                  <p>
                    {edge.from} → {edge.to}
                  </p>
                  <p>{edge.rationale}</p>
                </article>
              ))}
            </>
          )}
          {active === "time" && (
            <>
              <dl>
                {pair("Known as of", displayClock(context.known_as_of))}
                {pair("Valid at", displayClock(context.valid_at))}
              </dl>
              <p>
                These are native query checkpoints. Modern availability does not
                establish what a historical actor knew. Document dates and
                narrated event times may appear in assertion conditions, not the
                publication clock.
              </p>
              {indexed.sources.map(([id, source]) => (
                <details key={id}>
                  <summary>{source.title}</summary>
                  <dl>
                    {pair("Source", id)}
                    {pair(
                      "Publication clock",
                      displayClock(source.published_at),
                    )}
                    {pair("Available from", displayClock(source.available_at))}
                    {pair("Validity start", displayClock(source.valid_from))}
                    {pair("Validity end", displayClock(source.valid_until))}
                  </dl>
                </details>
              ))}
              <h4>Per-assertion temporal status</h4>
              <dl>
                {Object.entries(value.temporal_status).map(([id, status]) =>
                  pair(id, status),
                )}
              </dl>
            </>
          )}
          {active === "omissions" && (
            <>
              <p>
                Omission is not a finding that material is false or irrelevant.
                These are the returned reasons for this request and budget.
              </p>
              {Object.entries(context.omissions).map(([id, reason]) => (
                <article className="cl-edge" key={id}>
                  <strong>{id}</strong>
                  <p>{reason}</p>
                </article>
              ))}
              {!Object.keys(context.omissions).length && (
                <p>No omissions supplied.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
