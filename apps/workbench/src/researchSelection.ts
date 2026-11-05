/** A display contract for bounded source-kit selections, separate from native Context. */
export const RESEARCH_SELECTION_FORMAT = "policy-research-selection/1";
export const MAX_RESEARCH_SELECTION_BYTES = 1024 * 1024;
export const MAX_RESEARCH_SELECTION_RECORDS = 200;
export const MAX_RESEARCH_SELECTION_DEPTH = 5;
const MAX_STRING_CHARACTERS = 20_000;

type Primitive = string | number | boolean | null;
export type FilterValue =
  Primitive | FilterValue[] | { [key: string]: FilterValue };

export type ResearchDataset = {
  id: string;
  title: string;
  version: string;
  publisher: string;
  url: string;
  license: string;
  sha256: string;
};

export type ResearchRecord = {
  id: string;
  kind: "conflict_event" | "country_indicator";
  dataset_id: string;
  label: string;
  country_code: string;
  date_start: string;
  date_end: string;
  source_locator: string;
  attributes: Record<string, Primitive>;
};

export type ResearchSelection = {
  format: typeof RESEARCH_SELECTION_FORMAT;
  created_at: string;
  question: string;
  datasets: ResearchDataset[];
  filters: Record<string, FilterValue>;
  counts: {
    matched: number;
    exported: number;
    truncated: boolean;
    limit: number;
  };
  records: ResearchRecord[];
  notes: {
    assessment: string;
    alternatives: string;
    gaps: string;
  };
  limitations: string[];
};

export type ImportedResearchSelection = {
  value: ResearchSelection;
  /** Owned copy of the actual imported bytes, including whitespace/BOM. */
  bytes: ArrayBuffer;
  fileName: string;
};

const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

function fail(message: string): never {
  throw new Error(message);
}

function objectAt(value: unknown, field: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail(`${field} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
) {
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(`${field}.${key} is required.`);
  }
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    fail(`${field} contains an unexpected field.`);
  }
}

function stringAt(
  value: unknown,
  field: string,
  maximum = MAX_STRING_CHARACTERS,
  allowBlank = false,
): string {
  if (typeof value !== "string") fail(`${field} must be text.`);
  if (!allowBlank && value.trim().length === 0) {
    fail(`${field} must not be blank.`);
  }
  if (Array.from(value).length > maximum) {
    fail(`${field} exceeds ${maximum} characters.`);
  }
  return value;
}

function integerAt(value: unknown, field: string, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    fail(`${field} must be a nonnegative safe integer up to ${maximum}.`);
  }
  return value;
}

function realDate(value: unknown, field: string): string {
  const text = stringAt(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    fail(`${field} must use YYYY-MM-DD.`);
  }
  const [year, month, day] = text.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    fail(`${field} must be a real calendar date.`);
  }
  return text;
}

function timestamp(value: unknown): string {
  const text = stringAt(value, "selection.created_at", 64);
  const parts =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(
      text,
    );
  if (!parts)
    fail("selection.created_at must be an ISO timestamp with a timezone.");
  realDate(parts[1], "selection.created_at date");
  if (Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59) {
    fail("selection.created_at contains an invalid time.");
  }
  if (parts[5] !== "Z") {
    const [hours, minutes] = parts[5].slice(1).split(":").map(Number);
    if (hours > 23 || minutes > 59) {
      fail("selection.created_at contains an invalid timezone offset.");
    }
  }
  return text;
}

function datasetUrl(value: unknown, field: string): string {
  const text = stringAt(value, field, 4096);
  if (/[\s\\\u0000-\u001f\u007f]/u.test(text)) {
    fail(
      `${field} must be a plain HTTPS URL without whitespace or backslashes.`,
    );
  }
  if (!/^https:\/\/[^/?#]+/i.test(text)) {
    fail(`${field} must include an explicit HTTPS host.`);
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    fail(`${field} must be a valid HTTPS URL.`);
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    fail(`${field} must use HTTPS without embedded credentials.`);
  }
  return text;
}

function primitiveAt(value: unknown, field: string, maximum: number) {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    stringAt(value, field, maximum, true);
    return;
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER
  )
    return;
  fail(
    `${field} must be a primitive JSON value; numbers must be finite and within the safe magnitude limit.`,
  );
}

function safeKey(key: string, field: string) {
  stringAt(key, `${field} key`, 120);
  if (forbiddenKeys.has(key)) fail(`${field} contains an unsafe object key.`);
}

/** Bound filters iteratively so deeply nested input cannot overflow our stack. */
function boundedFilters(root: unknown) {
  objectAt(root, "selection.filters");
  const pending = [{ value: root, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > 500) fail("selection.filters exceeds 500 JSON values.");
    if (depth > MAX_RESEARCH_SELECTION_DEPTH) {
      fail(
        `selection.filters exceeds the maximum nesting depth of ${MAX_RESEARCH_SELECTION_DEPTH}.`,
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 200)
        fail("selection.filters array exceeds 200 items.");
      for (const child of value)
        pending.push({ value: child, depth: depth + 1 });
    } else if (value !== null && typeof value === "object") {
      const record = objectAt(value, "selection.filters value");
      const keys = Object.keys(record);
      if (keys.length > 100)
        fail("selection.filters object exceeds 100 fields.");
      for (const key of keys) {
        safeKey(key, "selection.filters");
        pending.push({ value: record[key], depth: depth + 1 });
      }
    } else primitiveAt(value, "selection.filters value", 2000);
  }
}

export function validateResearchSelection(input: unknown): ResearchSelection {
  const value = objectAt(input, "Selection");
  if (value.format !== RESEARCH_SELECTION_FORMAT) {
    fail(
      `Expected ${RESEARCH_SELECTION_FORMAT}. Native Context exports belong in Native Context mode.`,
    );
  }
  exactKeys(
    value,
    [
      "format",
      "created_at",
      "question",
      "datasets",
      "filters",
      "counts",
      "records",
      "notes",
      "limitations",
    ],
    "selection",
  );
  timestamp(value.created_at);
  stringAt(value.question, "selection.question", 2000, true);
  boundedFilters(value.filters);

  if (
    !Array.isArray(value.datasets) ||
    value.datasets.length < 1 ||
    value.datasets.length > 2
  ) {
    fail(
      "selection.datasets must contain one or two dataset metadata records.",
    );
  }
  const datasetIds = new Set<string>();
  for (const [index, item] of value.datasets.entries()) {
    const field = `selection.datasets[${index}]`;
    const dataset = objectAt(item, field);
    exactKeys(
      dataset,
      ["id", "title", "version", "publisher", "url", "license", "sha256"],
      field,
    );
    const id = stringAt(dataset.id, `${field}.id`, 200);
    if (datasetIds.has(id))
      fail("selection.datasets contains a duplicate dataset id.");
    datasetIds.add(id);
    stringAt(dataset.title, `${field}.title`, 2000);
    stringAt(dataset.version, `${field}.version`, 2000);
    stringAt(dataset.publisher, `${field}.publisher`, 2000);
    stringAt(dataset.license, `${field}.license`, 2000);
    datasetUrl(dataset.url, `${field}.url`);
    if (
      !/^[0-9a-fA-F]{64}$/.test(stringAt(dataset.sha256, `${field}.sha256`, 64))
    ) {
      fail(`${field}.sha256 must contain exactly 64 hexadecimal characters.`);
    }
  }

  if (
    !Array.isArray(value.records) ||
    value.records.length > MAX_RESEARCH_SELECTION_RECORDS
  ) {
    fail(
      `selection.records must be an array of at most ${MAX_RESEARCH_SELECTION_RECORDS} records.`,
    );
  }
  const ids = new Set<string>();
  for (const [index, item] of value.records.entries()) {
    const field = `selection.records[${index}]`;
    const row = objectAt(item, field);
    exactKeys(
      row,
      [
        "id",
        "kind",
        "dataset_id",
        "label",
        "country_code",
        "date_start",
        "date_end",
        "source_locator",
        "attributes",
      ],
      field,
    );
    const id = stringAt(row.id, `${field}.id`, 200);
    if (ids.has(id)) fail("selection.records contains a duplicate record id.");
    ids.add(id);
    if (row.kind !== "conflict_event" && row.kind !== "country_indicator") {
      fail(`${field}.kind must be conflict_event or country_indicator.`);
    }
    const datasetId = stringAt(row.dataset_id, `${field}.dataset_id`, 200);
    if (!datasetIds.has(datasetId))
      fail(`${field}.dataset_id does not resolve to a supplied dataset.`);
    stringAt(row.label, `${field}.label`, 500);
    if (
      !/^[A-Z]{2}$/.test(stringAt(row.country_code, `${field}.country_code`, 2))
    ) {
      fail(`${field}.country_code must use two uppercase ISO2 letters.`);
    }
    const start = realDate(row.date_start, `${field}.date_start`);
    const end = realDate(row.date_end, `${field}.date_end`);
    if (end < start) fail(`${field}.date_end must not precede date_start.`);
    stringAt(row.source_locator, `${field}.source_locator`, 2000);
    const attributes = objectAt(row.attributes, `${field}.attributes`);
    if (Object.keys(attributes).length > 128) {
      fail(`${field}.attributes exceeds 128 fields.`);
    }
    for (const [key, attribute] of Object.entries(attributes)) {
      safeKey(key, `${field}.attributes`);
      primitiveAt(
        attribute,
        `${field}.attributes.${key}`,
        MAX_STRING_CHARACTERS,
      );
    }
  }

  const counts = objectAt(value.counts, "selection.counts");
  exactKeys(
    counts,
    ["matched", "exported", "truncated", "limit"],
    "selection.counts",
  );
  const matched = integerAt(
    counts.matched,
    "selection.counts.matched",
    Number.MAX_SAFE_INTEGER,
  );
  const exported = integerAt(
    counts.exported,
    "selection.counts.exported",
    MAX_RESEARCH_SELECTION_RECORDS,
  );
  const limit = integerAt(
    counts.limit,
    "selection.counts.limit",
    MAX_RESEARCH_SELECTION_RECORDS,
  );
  if (limit < 1) fail("selection.counts.limit must be between 1 and 200.");
  if (exported !== value.records.length)
    fail("selection.counts.exported must equal records.length.");
  if (matched < exported)
    fail("selection.counts.matched must be at least exported.");
  if (exported > limit)
    fail("selection.counts.exported must not exceed limit.");
  if (
    typeof counts.truncated !== "boolean" ||
    counts.truncated !== matched > exported
  ) {
    fail(
      "selection.counts.truncated must be true exactly when matched exceeds exported.",
    );
  }

  const notes = objectAt(value.notes, "selection.notes");
  exactKeys(notes, ["assessment", "alternatives", "gaps"], "selection.notes");
  for (const field of ["assessment", "alternatives", "gaps"]) {
    stringAt(notes[field], `selection.notes.${field}`, 10000, true);
  }
  if (!Array.isArray(value.limitations) || value.limitations.length > 30) {
    fail("selection.limitations must be an array of at most 30 text entries.");
  }
  value.limitations.forEach((item, index) =>
    stringAt(item, `selection.limitations[${index}]`, 4000),
  );
  return value as unknown as ResearchSelection;
}

export function validateResearchSelectionFilename(value: string): string {
  if (
    value.length > 128 ||
    !/^[\p{L}\p{N}][\p{L}\p{N}._ -]*\.json$/iu.test(value) ||
    value.includes("..")
  ) {
    fail(
      "Choose a simple .json filename using letters, numbers, spaces, dots, underscores or dashes; no paths or control characters.",
    );
  }
  return value;
}

export function inspectResearchSelection(
  input: ArrayBuffer | Uint8Array,
  fileName: string,
): ImportedResearchSelection {
  validateResearchSelectionFilename(fileName);
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > MAX_RESEARCH_SELECTION_BYTES) {
    fail("Research selection exceeds the 1 MiB file limit.");
  }
  let raw: string;
  try {
    raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("Research selection must be valid UTF-8 JSON.");
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    fail("Invalid JSON. Choose an exported research-selection .json file.");
  }
  const selection = validateResearchSelection(value);
  const owned = Uint8Array.from(bytes);
  return { value: selection, bytes: owned.buffer, fileName };
}

/** No parse/stringify round trip: the download contains the original file bytes. */
export function researchSelectionBlob(loaded: ImportedResearchSelection): Blob {
  return new Blob([loaded.bytes], { type: "application/json" });
}
