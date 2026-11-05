# Research-selection reader

The static Context explorer has two explicit modes. **Native Context** retains
the existing `tacitus-uploaded-knowledge-context/1` reader, recorded example and
export. **Research selection** reads `policy-research-selection/1` files produced
by the source kit's historical atlas. Switching modes does not convert one format
into the other. The native selection is retained in memory; leaving Research
selection clears that reader's imported file from its component state.

The new reader runs in the browser. It does not upload the file, fetch a dataset,
invoke the local workbench, run a model or create a native capture. Imported
metadata is displayed as supplied, not authenticated as an official source.

## Import contract

Only UTF-8 JSON of at most **1 MiB (1,048,576 actual bytes)** and at most **200
records** is accepted. UTF-8 BOM, CRLF, indentation and trailing whitespace are
accepted. The file must have a simple `.json` filename of at most 128 UTF-16 code
units, beginning with a letter or number; letters, numbers, spaces, dots,
underscores and dashes are allowed. Paths, consecutive dots and control
characters are refused.

The envelope has exactly `format`, `created_at`, `question`, `datasets`, `filters`,
`counts`, `records`, `notes`, and `limitations`.

- One or two datasets have exactly seven keys: `id`, `title`, `version`,
  `publisher`, `url`, `license`, `sha256`. Dataset IDs are unique, nonblank and at
  most 200 characters. Title, version, publisher and licence are nonblank text of
  at most 2,000 characters. HTTPS URLs are at most 4,096 characters, with no
  credentials, whitespace or backslashes. SHA-256 is exactly 64 hexadecimal
  characters and describes the declared archived snapshot, not a per-record proof.
- Each record has exactly `id`, `kind`, `dataset_id`, `label`, `country_code`,
  `date_start`, `date_end`, `source_locator`, and `attributes`. IDs are unique and
  at most 200 characters; every dataset reference resolves within the file. Kind
  is `conflict_event` or `country_indicator`. Labels are nonblank, at most 500
  characters; source locators are nonblank, at most 2,000. Country codes use two
  uppercase letters; this shape check does not independently verify a country
  registry. Dates are real, ordered `YYYY-MM-DD` calendar days.
- Attributes are flat objects of at most 128 fields. Keys are nonblank text of at
  most 120 characters. Values are strings of at most 20,000 characters, booleans,
  null, or finite numbers with absolute value at most `2^53 − 1`.
- Filters are objects bounded to depth five (root depth zero), 500 values, 100
  fields per object and 200 items per array. Keys are nonblank text of at most 120
  characters and strings at most 2,000 characters. Numbers use the same finite,
  safe magnitude bound. `__proto__`, `prototype` and `constructor` keys are
  refused in attributes and filters.
- `created_at` is a real ISO timestamp with `T`, seconds and `Z` or an explicit
  valid timezone offset; optional fractional seconds have one to six digits.
  Question text may be blank and is at most 2,000 characters.
- Counts are nonnegative safe integers, except the boolean `truncated`. Exported
  equals the record count; matched is at least exported; limit is between one and
  200; exported does not exceed limit. Truncated is true exactly when matched is
  greater than exported, including a zero-record prefix.
- Notes have exactly three text fields: `assessment`, `alternatives`, `gaps`.
  Each may be blank and has at most 10,000 characters. There are at most 30
  nonblank limitation statements of at most 4,000 characters each.

Text limits count Unicode characters. Non-finite or unsupported JSON values,
missing fields, extra structural fields, unresolved references and inconsistent
counts are refused. A refused import clears the preceding research selection
and disables its download; no example silently replaces it.

## Interpretation and export

The table and record inspector escape all imported text. Attribute values and
source locators never become automatic links or HTML. Only the explicitly
labelled, validated HTTPS dataset URL is an outbound link. Zero, false, an empty
string and null are displayed distinctly. The inspector's optional JSON view is
a parsed representation, not the original byte stream.

**Export unchanged selection JSON** downloads an owned copy of the exact imported
bytes. It does not serialize the parsed object. The reader does not verify a
declared snapshot hash against a remote archive or certify licence statements.
Supplied historical dates and indicators do not establish current conditions,
causation, a reviewed conclusion or native-capture provenance.

`tests/fixtures/research-selection-contract.json` is the shared cross-language
contract fixture, with synthetic data rather than real provider observations.
Transport tests construct the exact 1 MiB UTF-8 BOM/CRLF boundary in memory rather
than checking megabytes of padding into the repository.

[Executed verification and remaining native boundaries](../../../docs/RESEARCH_SELECTION_VERIFICATION_2026-11-05.md).
