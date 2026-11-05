import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const contractCases = JSON.parse(
  readFileSync(
    new URL("./fixtures/research-selection-contract.json", import.meta.url),
    "utf8",
  ),
).cases;

/** Synthetic transport fixtures, never an assertion about a provider's real data. */
export function researchFixture() {
  const value = structuredClone(contractCases[0].pack);
  value.question = "What can this bounded synthetic selection show?";
  value.datasets[0].sha256 = createHash("sha256")
    .update("synthetic event fixture source\n")
    .digest("hex");
  value.datasets.push({
    ...value.datasets[0],
    id: "fixture-indicator",
    title: "Synthetic indicator fixture",
    sha256: createHash("sha256")
      .update("synthetic indicator fixture source\n")
      .digest("hex"),
  });
  value.records[0].label = "Synthetic <script>untrusted</script> event";
  value.records[0].source_locator = "javascript:alert('source text only')";
  value.records[0].attributes = {
    value: 0,
    verified: false,
    missing: null,
    empty: "",
    markup: '<img src="https://untrusted.invalid/image" onerror="alert(1)">',
    link: "https://untrusted.invalid/attribute",
  };
  value.records.push({
    ...value.records[0],
    id: "test:2",
    kind: "country_indicator",
    dataset_id: "fixture-indicator",
    label: "Synthetic country indicator",
    date_start: "2020-01-01",
    date_end: "2020-12-31",
    source_locator:
      "Synthetic indicator row 2; not a real provider observation",
  });
  value.counts.matched = value.counts.exported = 2;
  value.limitations = [
    "Synthetic QA fixture; these records are not historical evidence.",
  ];
  return value;
}

export function byteFixture(value = researchFixture()) {
  return Buffer.from(
    `\uFEFF${JSON.stringify(value, null, 2).replaceAll("\n", "\r\n")}\r\n \t`,
  );
}
