# Grade 1 mathematics source and QA audit

## Scope and conclusion

This audit covers only manifest route `grade-1-mathematics`. It does not use grade 2 material and does not assess grade 1 science.

The original export declared by the compact archive, `1klass-matem.zip`, was not found in the repository or the connected project workspace. The committed `project-files/outputs/1klass-matem-compact.zip` is nevertheless sufficient to reproduce and fully verify the canonical record metadata: its compact Markdown matched the pre-audit canonical file byte for byte, and its JSONL contains every canonical field. The route is therefore registered explicitly as `derived_compact_snapshot`, not as an original export.

This evidence does not prove full coverage of the official grade 1 mathematics curriculum or pedagogical readiness.

## Original-archive search

The search was limited to the repository and the connected Opiq Helper project workspace. It checked:

- `1klass-matem.zip`;
- `opiq_1klass_matemaatika.zip`;
- `1klass-matemaatika.zip`;
- `1klass-matem-*.zip`.

No original archive was found. No broad home-directory search was performed, and no local absolute path is stored in repository metadata.

## Derived compact provenance

| Property | Verified value |
| --- | --- |
| Registered archive | `project-files/outputs/1klass-matem-compact.zip` |
| Provenance kind | `derived_compact_snapshot` |
| Declared original | `1klass-matem.zip` (unavailable) |
| Compact generation timestamp | `2026-06-12T14:08:30.811862+00:00` |
| SHA-256 | `e2d23a95adb4721cb81b96d55cdb7051c38526769448890025294a34285741ba` |
| ZIP integrity | All members decompress and pass CRC-32 validation |
| Format version | `2.0` |
| Source records | 339 |
| Canonical records after duplicate resolution | 338 |

The ZIP contains exactly the four members declared by `index.json`:

- `index.json`;
- `opiq_lookup.jsonl`;
- `opiq_lookup.md`;
- `topic_map.json`.

Programmatic checks confirmed that `index.json` has `recordCount: 339`, all listed files exist, `opiq_lookup.jsonl` contains 339 parseable object records with direct Opiq URLs, and `topic_map.json` parses as an object. The compact `opiq_lookup.md` was byte-identical to the 339-record canonical Markdown before this audit. After duplicate resolution, the QA generator removes the later occurrence of each exact URL from the source sequence and verifies all fields of the remaining 338 records against the canonical Markdown.

The compact snapshot has no raw export directory or full page payload. It preserves normalized titles, URLs, book and chapter identifiers, grade, subjects, language, publisher, topics, headings, and selected task examples. That is enough to reproduce and verify the lookup index, but not to reconstruct unavailable raw source payloads.

## Books, kits, and languages

| Book ID | Compact book title | Publisher metadata | Kit | Source records | Canonical records |
| --- | --- | --- | ---: | ---: | ---: |
| `1k_math_avita` | Математика вокруг нас | Avita | 539 | 103 | 103 |
| `1k_math_avita_est` | MATEMAATIKA MEIE ÜMBER | Avita | 112 | 103 | 103 |
| `1k_math_koolibri` | МАТЕМАТИКА 1 класс – Opiq | empty in compact metadata | 266 | 67 | 66 |
| `1k_math_koolibri_est` | KUJUNDID | Koolibri | 158 | 66 | 66 |

The complete computed kit set is 112, 158, 266, and 539; it was not hardcoded from the preliminary observations.

| Language | Source records | Canonical records |
| --- | ---: | ---: |
| `et` | 168 | 168 |
| `ru` | 170 | 169 |
| `en` | 1 | 1 |

The only count reduction is the removed Russian kit 266 detail duplicate.

## Detail and administrative records

The source contains five detail rows but only four unique detail URLs: kits 539, 112, 266, and 158. The repeated kit 266 detail URL accounts for the fifth source row. Four unique detail records remain canonical; no distinct cover/detail URL was excluded.

Two administrative chapters remain canonical because this issue establishes source parity and duplicate handling rather than a new global administrative-page policy:

- source position 19: `Импрессум`, kit 539, chapter 11.4, Russian, no task examples;
- source position 121: `Impressum`, kit 112, chapter 11.4, Estonian, no task examples.

Thus `cover_detail_records_excluded` and `administrative_records_excluded` are both zero. The one exclusion is recorded only as `duplicate_records_excluded` to avoid double-counting.

## Exact URL duplicate

The 339 source and pre-audit canonical records contain one duplicate group:

| Source position | URL | Title | Book ID | Kit | Chapter ID | Language |
| ---: | --- | --- | --- | ---: | --- | --- |
| 219 | https://www.opiq.ee/Kit/Details/266 | МАТЕМАТИКА 1 класс – Opiq | `1k_math_koolibri` | 266 | 104 | ru |
| 220 | https://www.opiq.ee/Kit/Details/266 | МАТЕМАТИКА 1 класс – Opiq | `1k_math_koolibri` | 266 | 170 | ru |

Both source rows are detail pages with empty headings and task examples. Title, URL, book, Book ID, grade, subjects, language, publisher, topics, and empty content fields are identical; only the synthetic `chapter_id` differs.

Decision: `remove_duplicate`. The stable first occurrence (source position 219, chapter ID 104) is retained, and source position 220 is excluded. No metadata was merged. The canonical count changes from 339 to 338, and all canonical URLs are now unique. The manifest's optional `canonical_url_policy.require_unique` rule prevents recurrence without imposing a repository-wide rule on routes covered by other issues.

## Canonical/source comparison

- Before the audit, compact `opiq_lookup.md` and canonical Markdown were byte-identical.
- The compact JSONL and Markdown had 339 records in the same order and no mismatches in title, URL, book, Book ID, chapter ID, grade, subject, language, publisher, topics, headings, or task examples.
- After applying the documented first-occurrence URL deduplication, all 338 expected JSONL records match the canonical Markdown field by field.
- Canonical URLs: 338 records and 338 unique exact URLs.
- Canonical records without headings: 4 (the four retained detail pages).
- Canonical records without URLs: 0.

## Topic audit: `võrra rohkem`

Status remains `ambiguous`.

Searches covered titles, headings, and task examples in both canonical Markdown and compact JSONL. The exact forms `võrra rohkem`, `mitme võrra rohkem`, `на сколько больше`, and `на … больше` did not occur outside automatically generated topics.

Generic comparison material exists, for example:

- kit 112, chapter 1.6, `SUUREM, VÄIKSEM, VÕRDNE`: https://www.opiq.ee/kit/112/chapter/5426 — compare dot and ball counts using a sign;
- kit 539, chapter 1.6, `Больше, меньше, равно`: https://www.opiq.ee/kit/539/chapter/29821 — the Russian counterpart, also sign comparison;
- kit 112, chapter 1.4, `PIKEM, LÜHEM. SUUREM, VÄIKSEM`: https://www.opiq.ee/kit/112/chapter/5424 — qualitative size/length comparison.

There is one explicit difference task in kit 112, chapter 9.6, `Meeter ja sentimeeter (3)`: https://www.opiq.ee/kit/112/chapter/6527. It asks the learner to calculate how many metres deeper the deepest part of a lake is than the shore. The parallel Russian task is kit 539, chapter 9.6: https://www.opiq.ee/kit/539/chapter/29907. This is useful supporting evidence, but a single depth context does not establish the distinct `võrra rohkem` learning objective across the route.

## Topic audit: `võrra vähem`

Status remains `ambiguous`.

The exact forms `võrra vähem`, `mitme võrra vähem`, `на сколько меньше`, and `на … меньше` did not occur in titles, headings, or task examples. Generic material includes:

- kit 158, chapter 2.2, `SUUREM JA VÄIKSEM`: https://www.opiq.ee/kit/158/chapter/8915;
- kit 266, chapter 2.2, `БОЛЬШЕ И МЕНЬШЕ`: https://www.opiq.ee/kit/266/chapter/15145 — select the largest and smallest object;
- the same sign-comparison pages in kits 112 and 539 listed above.

The lake-depth task proves a calculation of one difference, but it does not separately demonstrate a `võrra vähem` task or a systematic less-by objective. Therefore this case is not promoted to `present`.

For both cases, `Topics ET/RU/EN` were searched diagnostically but were not accepted as evidence, and no other grade or external curriculum map was used.

## Reproducible QA

`scripts/generate-grade-1-mathematics-qa.mjs` reads the manifest, validates the compact archive and index, parses all source records, applies first-occurrence exact-URL deduplication, verifies every canonical field, computes counts and topic diagnostics, and writes `project-files/outputs/opiq_1klass_matemaatika_qa.json`.

Run:

```sh
node scripts/generate-grade-1-mathematics-qa.mjs
node scripts/generate-grade-1-mathematics-qa.mjs --check
node scripts/refresh-qa-snapshot-metadata.mjs --check
node scripts/check-source-manifest.mjs
```

The generated timestamp is created once and preserved on ordinary reruns. Checksums and all derived counters change only when their inputs change.

## Known limitations

- The original `1klass-matem.zip` and its raw metadata are unavailable.
- The compact publisher field for `1k_math_koolibri` is empty; the audit does not invent it.
- Compact task examples are selected excerpts, not complete original page payloads.
- Two administrative Impressum pages and four unique detail pages remain in the canonical index; this audit documents them but does not introduce a cross-route exclusion policy.
- Both `võrra` regression cases remain ambiguous for specific evidence reasons.
- Neither the source count nor the topic regression set is a complete curriculum map.
