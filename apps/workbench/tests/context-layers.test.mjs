import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  indexLayers,
  displayClock,
  validateLayerInput,
} from "../src/context/contextLayers.mjs";

test("layer index retains citation identities and review qualifications without changing context", async () => {
  const raw = await readFile("public/examples/peace.context.json", "utf8");
  const value = JSON.parse(raw),
    before = JSON.stringify(value),
    result = indexLayers(value);
  assert.equal(validateLayerInput(value), value);
  assert.equal(
    result.counts.assertions,
    Object.keys(value.context.claims).length,
  );
  assert.equal(
    result.counts.omissions,
    Object.keys(value.context.omissions).length,
  );
  assert.equal(
    result.counts.evidence,
    Object.values(value.context.claims).reduce(
      (n, c) => n + c.citations.length,
      0,
    ),
  );
  for (const citation of result.citations) {
    assert.ok(value.source_metadata[citation.span.source]);
    assert.equal(
      citation.text,
      value.context.claims[citation.claim].citations.find(
        (c) =>
          c.span.source === citation.span.source &&
          c.span.start === citation.span.start,
      ).text,
    );
  }
  assert.equal(JSON.stringify(value), before);
  assert.match(value.context.trust, /untrusted/);
});
test("malformed untrusted display fields are refused before rendering", async () => {
  const value = JSON.parse(
    await readFile("public/examples/peace.context.json", "utf8"),
  );
  for (const mutate of [
    (v) => (v.manifest.limitations = [{}]),
    (v) => (v.context.warnings = null),
    (v) => (v.context.known_as_of = "1914"),
    (v) => (Object.values(v.context.claims)[0].assertion.conditions = [{}]),
  ]) {
    const bad = structuredClone(value);
    mutate(bad);
    assert.throws(() => validateLayerInput(bad), /Invalid context layer field/);
  }
});
test("unknown temporal values are never displayed as epoch zero", () => {
  assert.equal(displayClock(null), "Unknown / not supplied");
  assert.equal(displayClock(undefined), "Unknown / not supplied");
  assert.match(displayClock(0), /1970-01-01/);
  assert.match(displayClock(1792328100), /2026-/);
});
