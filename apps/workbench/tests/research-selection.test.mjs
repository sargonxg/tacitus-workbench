import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  inspectResearchSelection,
  MAX_RESEARCH_SELECTION_BYTES,
  researchSelectionBlob,
  validateResearchSelection,
  validateResearchSelectionFilename,
} from "../src/researchSelection.ts";
import { validateLayerInput } from "../src/context/contextLayers.mjs";
import { wholeContextBlob } from "../src/local-inspector-client.mjs";
import {
  byteFixture,
  contractCases,
  researchFixture,
} from "./research-selection-fixture.mjs";

for (const item of contractCases) {
  test(`shared policy-research-selection contract: ${item.name}`, () => {
    if (item.valid)
      assert.equal(validateResearchSelection(item.pack), item.pack);
    else assert.throws(() => validateResearchSelection(item.pack));
  });
}

test("both record kinds and unknown dataset identifiers remain supplied data", () => {
  const value = researchFixture();
  assert.equal(validateResearchSelection(value), value);
  assert.deepEqual(
    value.records.map((row) => row.kind),
    ["conflict_event", "country_indicator"],
  );
  assert.equal(value.records[0].attributes.value, 0);
  assert.equal(value.records[0].attributes.verified, false);
  assert.equal(value.records[0].attributes.missing, null);
  assert.equal(value.records[0].attributes.empty, "");
  value.question = "";
  value.notes = { assessment: "", alternatives: "", gaps: "" };
  assert.doesNotThrow(() => validateResearchSelection(value));
});

test("identity, reference, date and exact-envelope errors refuse the selection", () => {
  const refusals = [
    (v) => {
      v.records[0].kind = "native_capture";
    },
    (v) => {
      v.records[1].id = v.records[0].id;
    },
    (v) => {
      v.datasets[1].id = v.datasets[0].id;
    },
    (v) => {
      v.records[0].dataset_id = "missing";
    },
    (v) => {
      v.records[0].country_code = "sy";
    },
    (v) => {
      v.records[0].country_code = "SYR";
    },
    (v) => {
      v.records[0].date_start = "2020-02-30";
    },
    (v) => {
      v.records[0].date_start = "0000-01-01";
    },
    (v) => {
      v.records[0].date_end = "2019-01-01";
    },
    (v) => {
      v.datasets[0].kind = "conflict_event";
    },
    (v) => {
      delete v.records[0].source_locator;
    },
    (v) => {
      v.datasets[0].url = "javascript:alert(1)";
    },
    (v) => {
      v.datasets[0].url = "https:example.org";
    },
    (v) => {
      v.datasets[0].url = "https:/example.org";
    },
    (v) => {
      v.datasets[0].url = "https:///example.org";
    },
    (v) => {
      v.datasets[0].url = "https://example.org:bad";
    },
    (v) => {
      v.datasets[0].url = "https://user:password@example.org/data";
    },
    (v) => {
      v.datasets[0].sha256 = "not-a-digest";
    },
    (v) => {
      v.records[0].attributes.nested = {};
    },
    (v) => {
      v.records[0].attributes.values = [];
    },
    (v) => {
      v.records[0].attributes.value = Infinity;
    },
    (v) => {
      v.records[0].attributes.value = NaN;
    },
    (v) => {
      v.records[0].attributes = JSON.parse('{"__proto__":"unsafe"}');
    },
  ];
  for (const mutate of refusals) {
    const value = researchFixture();
    mutate(value);
    assert.throws(
      () => validateResearchSelection(value),
      undefined,
      String(mutate),
    );
  }
});

test("counts describe precisely the exported prefix, including zero and truncation", () => {
  const value = researchFixture();
  value.records = [];
  value.counts = { matched: 0, exported: 0, truncated: false, limit: 200 };
  assert.doesNotThrow(() => validateResearchSelection(value));
  value.counts.matched = 8;
  value.counts.truncated = true;
  assert.doesNotThrow(() => validateResearchSelection(value));
  for (const mutate of [
    (v) => {
      v.counts.exported = 1;
    },
    (v) => {
      v.counts.matched = 1;
    },
    (v) => {
      v.counts.truncated = true;
    },
    (v) => {
      v.counts.limit = 1;
    },
    (v) => {
      v.counts.limit = 0;
    },
    (v) => {
      v.counts.limit = 201;
    },
    (v) => {
      v.counts.matched = 2.5;
    },
  ]) {
    const bad = researchFixture();
    mutate(bad);
    assert.throws(() => validateResearchSelection(bad));
  }
});

test("the record cap permits exactly 200 records and rejects 201", () => {
  const value = researchFixture();
  value.records = Array.from({ length: 200 }, (_, i) => ({
    ...value.records[0],
    id: `fixture:${i}`,
  }));
  value.counts = { matched: 200, exported: 200, truncated: false, limit: 200 };
  assert.doesNotThrow(() => validateResearchSelection(value));
  value.records.push({ ...value.records[0], id: "fixture:extra" });
  assert.throws(() => validateResearchSelection(value), /at most 200 records/);
});

test("filter depth and nodes are bounded without recursive traversal", () => {
  const value = researchFixture();
  let nested = {};
  value.filters = nested;
  for (let i = 0; i < 20_000; i++) nested = nested.child = {};
  assert.throws(() => validateResearchSelection(value), /nesting depth/);
  value.filters = {
    a: Array(200).fill(0),
    b: Array(200).fill(0),
    c: Array(100).fill(0),
  };
  assert.throws(() => validateResearchSelection(value), /500 JSON values/);
});

test("the actual imported UTF-8 bytes survive export, including BOM, CRLF and multibyte text", async () => {
  const value = researchFixture();
  value.question = "界🌍".repeat(1000);
  const raw = byteFixture(value);
  const exactLimit = Buffer.concat([
    raw,
    Buffer.alloc(MAX_RESEARCH_SELECTION_BYTES - raw.byteLength, 0x20),
  ]);
  const imported = inspectResearchSelection(exactLimit, "selection.json");
  assert.equal(imported.bytes.byteLength, MAX_RESEARCH_SELECTION_BYTES);
  assert.equal(imported.value.question, value.question);
  assert.deepEqual(
    Buffer.from(await researchSelectionBlob(imported).arrayBuffer()),
    exactLimit,
  );
  exactLimit[0] = 0;
  assert.equal(
    new Uint8Array(imported.bytes)[0],
    0xef,
    "the reader owns its copy",
  );
  assert.throws(
    () =>
      inspectResearchSelection(
        Buffer.alloc(MAX_RESEARCH_SELECTION_BYTES + 1),
        "large.json",
      ),
    /1 MiB/,
  );
  assert.throws(
    () =>
      inspectResearchSelection(Uint8Array.from([0xc3, 0x28]), "invalid.json"),
    /UTF-8/,
  );
  assert.throws(
    () => inspectResearchSelection(Buffer.from("{incomplete"), "invalid.json"),
    /Invalid JSON/,
  );
});

test("unsafe filenames are refused before download names can be constructed", () => {
  for (const name of [
    "../selection.json",
    "a/b.json",
    "a\\b.json",
    "a..json",
    "hidden\n.json",
    "selection.html",
    ".selection.json",
  ]) {
    assert.throws(
      () => validateResearchSelectionFilename(name),
      /simple .json filename/,
    );
  }
  assert.equal(
    validateResearchSelectionFilename("Sélection 2026-11-05.json"),
    "Sélection 2026-11-05.json",
  );
});

test("native Context remains a separate working format with its existing export", async () => {
  const raw = await readFile("public/examples/peace.context.json", "utf8");
  const value = JSON.parse(raw);
  assert.equal(validateLayerInput(value), value);
  assert.equal(await wholeContextBlob(raw).text(), raw);
  assert.throws(
    () => inspectResearchSelection(Buffer.from(raw), "native.context.json"),
    /Native Context mode/,
  );
  assert.throws(() => validateLayerInput(researchFixture()));
});
