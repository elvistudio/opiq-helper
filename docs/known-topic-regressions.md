# Known-topic regression checks

## Purpose

`evaluations/known-topic-checks.yaml` is a machine-checked set of representative topic and routing regressions. It protects known evidence, ambiguous findings, missing manifest coverage, and route boundaries. It is not a curriculum map and does not prove that a route covers an official school programme completely.

The runner reads `source-manifest.json`, resolves only source IDs explicitly named by assertions, parses their canonical Markdown indexes, and evaluates the assertions. A full run also requires every manifest route to have representative positive evidence and a negative routing boundary.

## Commands

Install the locked dependency and run the checks with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:topics
npm run check:topics
```

Run one case while editing it:

```sh
node scripts/check-known-topic-regressions.mjs --case grade-3-science-map
```

`--case` validates the complete YAML schema but executes only the selected case. The output states that the repository-wide positive and negative coverage gates were skipped. Advanced fixture checks may select repository-relative files with `--cases` and `--manifest`; absolute paths and `..` traversal are rejected.

## Top-level schema

Schema version 2.0 has four fields:

- `version`: exactly `"2.0"`;
- `scope`: a non-empty explanation of the regression set;
- `allowed_statuses`: exactly `present`, `ambiguous`, `missing`, and `not_verified`;
- `cases`: a non-empty list of cases.

YAML is parsed by the exactly locked `yaml` package in strict YAML 1.2 core mode. Malformed YAML reports line and column information. Duplicate mapping keys and unresolved custom tags are rejected.

Every case requires `id`, `grade`, `subject`, `topic`, `status`, `evidence`, and `assertions`. IDs are unique lowercase slugs. Unknown case and assertion fields are errors, so spelling mistakes cannot be silently ignored.

A regular route case declares `expected_source_id` and `expected_md_path`. A boundary case may instead declare matching `expected_source_ids` and `expected_md_paths` arrays. Singular and plural forms cannot be mixed. Every source must exist in the manifest, every expected path must exactly match its manifest `md_path`, and paths must stay inside the repository.

## Status semantics

### `present`

Requires at least one successful `record_present` assertion. At least one assertion must find explicit evidence in the record title, headings, or task examples. A class, Book ID, Subject, route match, or generated Topic keyword alone cannot prove `present`.

### `ambiguous`

Requires both:

- `record_present` for the limited or generic evidence that still exists;
- `promotion_guard` over structured titles, headings, and task examples.

If a guarded explicit phrase appears, the runner fails with `ambiguous case may now have explicit positive evidence; review its status`. It never edits the YAML or promotes a case automatically. The two `võrra rohkem` / `võrra vähem` cases deliberately remain ambiguous.

### `missing`

Uses `missing_coverage`. It requires that the grade has no source route and that `manifest.missing_coverage` contains the matching `coverage_status: missing` declaration. It does not infer a missing topic from an incomplete content search.

### `not_verified`

Uses `manifest_equals` to preserve an explicit manifest limitation such as `coverage_status: available_not_curriculum_verified`. Route availability is not treated as proof of curriculum completeness.

## Assertion kinds

### `record_present`

Requires `source_id`, an exact direct Opiq `url`, and an `expected` object. The URL must occur exactly once in the selected canonical route. Supported expectations are:

- exact normalized `class`, `title`, `book_id`, and individual `subject.en`, `subject.et`, `subject.ru` values;
- `headings_any` and `headings_all`;
- `task_examples_any` and `task_examples_all`;
- optional `topics_any` and `topics_all` supplementary checks.

Text is normalized to Unicode NFC, repeated whitespace is collapsed, and `*_any` / `*_all` patterns use case-insensitive substring matching. YAML patterns are plain strings, not regular expressions. URL, Book ID, class, and Subject checks are exact.

Topics-only evidence is rejected for `present`, even when a topic assertion succeeds.

### `url_absent`

Requires `origin_source_id`, a different target `source_id`, and an exact URL. The origin route must contain the URL exactly once and the target route must not contain it. These assertions protect wrong-grade, wrong-subject, and similar-language boundaries.

### `book_id_absent`

Requires `source_id` and `book_id`. It protects a route from a known foreign book, such as the audited kit 537 second-language Book ID in first-language Estonian.

### `promotion_guard`

Allowed only as the required guard for `ambiguous`. It searches the selected structured fields (`title`, `headings`, `task_examples`) for literal `absent_patterns`. It never searches Topics, source summaries, or YAML evidence text.

### `missing_coverage`

Requires a positive integer `grade` and `subjects` equal to `all` or a non-empty subject list. The case status must be `missing`.

### `manifest_equals`

Compares one safe manifest field: `coverage_status`, `quality_status`, `grade`, `subject`, or `md_path`. Arbitrary object-path evaluation is intentionally unsupported.

## Canonical Markdown formats

The parser supports both repository formats and normalizes them to the same record shape.

Normalized format:

```md
### 1. Title
- URL: https://www.opiq.ee/...
- Book ID: example
- Class: 2
- Subject ET: eesti keel
- Subject RU: эстонский язык
- Subject EN: Estonian language
```

Compact format:

```md
## Title
URL: https://www.opiq.ee/...
Book ID: example
Class: 3
Subject: mathematics / matemaatika / математика
```

Fields with and without the `- ` prefix are equivalent. Semicolon-separated headings and task examples are split into arrays; empty fields become empty arrays. Source summaries, Books sections, and other service headings are ignored because they have no record metadata. A record-like block without a direct Opiq URL fails with source ID and record position context.

## Route coverage gates

A full run fails unless each manifest source has:

1. at least one `record_present` assertion;
2. at least one `url_absent` assertion where it is `origin_source_id` and the target is another route.

`missing_coverage` does not count as a source route. Negative boundaries should be meaningful: same subject in another grade, a similar subject in the same grade, or a language/subject distinction.

## Output and failures

Each passing case emits a stable line containing its ID, status, source ID(s), and evidence. The final summary reports total cases, counts by status, manifest routes, positive route coverage, and negative route coverage.

Assertion failures include the case ID and status, evidence, assertion kind, source ID, `md_path`, URL, expected value, and found value. Typical failures include:

- `required URL is absent`;
- `required URL is duplicated in target route`;
- `URL was found in forbidden route`;
- `present status cannot be proved only by Topics`;
- `ambiguous case may now have explicit positive evidence; review its status`;
- `routes without positive coverage` or `routes without negative coverage`.

## Safe update process

1. Confirm grade and subject in `source-manifest.json`.
2. Restrict inspection to that route's `md_path` and any explicitly declared negative target.
3. Select an exact canonical URL and explicit title, heading, or task evidence.
4. Add or update typed assertions without weakening existing boundaries.
5. Keep uncertain evidence `ambiguous` and update its promotion guard.
6. Run the single case, unit tests, and then the complete runner.
7. Do not call the regression set a curriculum map or silently use material from adjacent grades.
