/** Read-only indexes over the returned native context; never re-ranks or promotes assertions. */
export const LAYERS = [
  ["purpose", "Purpose", "The request, trust boundary and returned status."],
  [
    "evidence",
    "Evidence",
    "Exact returned source excerpts and their locators.",
  ],
  [
    "assertions",
    "Assertions",
    "Attributed propositions, conditions and exceptions.",
  ],
  [
    "ontology",
    "Ontology & graph",
    "Declared types and explicitly annotated relationships.",
  ],
  ["time", "Time", "Availability, validity and source dates remain distinct."],
  [
    "review",
    "Review & limits",
    "Epistemic status and the qualifications supplied with this context.",
  ],
  [
    "omissions",
    "Omissions",
    "Material the native context did not select, with stated reasons.",
  ],
];

/** Validate the additional fields rendered by the layer inspector, before React sees untrusted input. */
export function validateLayerInput(value) {
  const object = (x) =>
    x !== null && typeof x === "object" && !Array.isArray(x);
  const strings = (x) =>
    Array.isArray(x) && x.every((s) => typeof s === "string");
  const clock = (x) => x == null || Number.isSafeInteger(x);
  const ensure = (ok, name) => {
    if (!ok) throw new Error("Invalid context layer field: " + name);
  };
  ensure(
    object(value) && object(value.context) && object(value.manifest),
    "envelope",
  );
  const c = value.context;
  ensure(
    [value.status, value.manifest.title, c.question, c.trust, c.ontology].every(
      (s) => typeof s === "string",
    ),
    "purpose",
  );
  ensure(
    strings(value.manifest.limitations) && strings(c.warnings),
    "limitations",
  );
  ensure(
    Number.isSafeInteger(c.known_as_of) && Number.isSafeInteger(c.valid_at),
    "query clocks",
  );
  ensure(
    object(c.claims) &&
      object(c.omissions) &&
      object(c.entities) &&
      object(value.source_metadata) &&
      object(value.temporal_status),
    "record maps",
  );
  ensure(
    Object.values(c.omissions).every((s) => typeof s === "string") &&
      Object.values(value.temporal_status).every((s) => typeof s === "string"),
    "omissions and temporal status",
  );
  for (const row of Object.values(c.claims)) {
    ensure(object(row) && object(row.assertion), "assertion");
    const a = row.assertion;
    ensure(
      [
        row.knowledge,
        a.proposition,
        a.speaker,
        a.subject,
        a.predicate,
        a.epistemic_type,
        a.modality,
      ].every((s) => typeof s === "string"),
      "assertion text",
    );
    ensure(
      a.object === null || typeof a.object === "string",
      "assertion object",
    );
    ensure(
      strings(a.conditions) && strings(a.exceptions),
      "assertion qualifications",
    );
    ensure(
      Array.isArray(row.citations) &&
        row.citations.every(
          (cite) =>
            object(cite) &&
            [cite.text, cite.title, cite.license].every(
              (s) => typeof s === "string",
            ),
        ),
      "citations",
    );
  }
  for (const source of Object.values(value.source_metadata)) {
    ensure(object(source) && typeof source.title === "string", "source");
    ensure(
      [
        source.published_at,
        source.available_at,
        source.valid_from,
        source.valid_until,
      ].every(clock),
      "source clocks",
    );
  }
  return value;
}

export function indexLayers(value) {
  const c = value.context;
  const claims = Object.entries(c.claims);
  const sources = Object.entries(value.source_metadata);
  const citations = claims.flatMap(([id, row]) =>
    row.citations.map((citation, i) => ({
      id: `${id}:${i}`,
      claim: id,
      ...citation,
    })),
  );
  return {
    claims,
    sources,
    citations,
    counts: {
      purpose: 1,
      evidence: citations.length,
      assertions: claims.length,
      ontology: Object.keys(c.entities).length + c.relationships.length,
      time: sources.length,
      review: claims.length,
      omissions: Object.keys(c.omissions).length,
    },
  };
}

export function displayClock(value) {
  if (value === null || value === undefined) return "Unknown / not supplied";
  if (!Number.isSafeInteger(value)) return String(value);
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime())
    ? `${value} · ${date.toISOString().replace(".000Z", " UTC")}`
    : String(value);
}
