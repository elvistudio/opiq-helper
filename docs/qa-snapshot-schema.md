# QA snapshot schema 1.0

QA snapshots record reproducible structural diagnostics for canonical Opiq Markdown indexes. They do not prove curriculum completeness, semantic correctness, or pedagogical readiness.

Every source with a non-null `qa_path` in `source-manifest.json` must use this common core. Additional route-specific diagnostic and normalization fields are allowed and must be preserved.

## Required core

```json
{
  "qa_schema_version": "1.0",
  "source_id": "grade-N-subject",
  "source_archive": "project-files/inputs/final-zips/example.zip",
  "output_file": "project-files/outputs/example.md",
  "format_version": "2.0",
  "generation": {
    "status": "legacy_migrated",
    "generated_at": null,
    "generator": null,
    "generator_version": null,
    "note": "Original generation metadata was not recorded."
  },
  "checksums": {
    "source_archive_sha256": "<64 lowercase hex characters>",
    "output_file_sha256": "<64 lowercase hex characters>"
  },
  "source_records": 0,
  "page_records_included": 0,
  "grades": {},
  "languages": {},
  "books": {}
}
```

The manifest controls `source_id`, `source_archive`, `output_file`, and `format_version`. Both file paths must be repository-relative, must stay inside the repository, and must match the corresponding manifest fields exactly. Checksums are SHA-256 digests of the raw archive and Markdown file bytes.

All numeric counters must be non-negative integers. `page_records_included` must match the manifest `record_count`, and the values in each of `grades`, `languages`, and `books` must sum to `page_records_included`. Language keys must be included in the source's manifest `languages` list.

## Generation metadata

Historical snapshots whose original generator metadata was not recorded must use:

```json
{
  "status": "legacy_migrated",
  "generated_at": null,
  "generator": null,
  "generator_version": null,
  "note": "Original generation metadata was not recorded."
}
```

The migration date must not be presented as the original generation date. Missing historical timestamps, generator names, and generator versions must not be inferred.

Future snapshots must use `status: "generated"`, an ISO 8601 UTC timestamp in `generated_at`, and non-empty `generator` and `generator_version` strings. A generated snapshot may use a string or `null` for `note`.

## Route-specific fields

Additional fields are allowed. Existing diagnostics such as `normalized_subject`, `normalized_grade`, `normalized_language`, `normalized_book_titles`, `normalized_books`, removed-alias counters, excluded-record counters, `records_without_headings`, `missing_urls`, and `duplicate_urls` must be preserved. The common core does not standardize the meaning of these route-specific fields.

## Refresh and validation

Refresh manifest-controlled metadata and checksums deterministically:

```sh
node scripts/refresh-qa-snapshot-metadata.mjs
```

Verify that committed metadata is current without writing files:

```sh
node scripts/refresh-qa-snapshot-metadata.mjs --check
node scripts/check-source-manifest.mjs
```

The refresh script reads the manifest as the source of truth and processes only sources with a non-null `qa_path`. It preserves existing generation metadata and route-specific fields. Re-running it without changing inputs produces no file changes.
