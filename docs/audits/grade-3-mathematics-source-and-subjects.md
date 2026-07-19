# Grade 3 mathematics source and subject audit

## Scope and decision standard

This audit covers the `grade-3-mathematics` route only. The grade 3 science index was read only to check cross-route ownership of two disputed URLs. No grade 2 or grade 4 material was used. The audit establishes source traceability, canonical URL uniqueness, and subject-label consistency; it does not establish complete curriculum coverage or pedagogical readiness.

Classification was based on the committed compact records, their location in each book, direct Opiq URLs, book/kit/chapter metadata, headings, and task examples. A filename or topic keyword alone was not treated as proof.

## Provenance and archive validation

The declared original export `3klass-matem.zip` was not found in the repository or in the connected project workspace under the reasonable names `3klass-matem.zip`, `3klass-matemaatika.zip`, `opiq_3klass_matemaatika.zip`, or `3klass-matem-*.zip`. The registered source is therefore the committed derived snapshot:

- Path: `project-files/outputs/3klass-matem-compact.zip`
- Provenance kind: `derived_compact_snapshot`
- SHA-256: `15d1dea7d6c935df484387aaa38a7b4965ac87f7f1b5356d53542a5019440f11`
- Declared original archive: `3klass-matem.zip` (unavailable)
- Compact generation time: `2026-06-12T14:08:30.147803+00:00`
- Format version: `2.0`
- Supported query languages: `et`, `ru`, `en`
- Source records: 637

The standard-library ZIP reader verified the central directory, safe member paths, unique member names, supported deflate compression, uncompressed sizes, and CRC-32 values. The four members are:

| Member | Uncompressed bytes | CRC-32 |
| --- | ---: | --- |
| `index.json` | 311 | `40d15e76` |
| `opiq_lookup.jsonl` | 718696 | `49265d1e` |
| `opiq_lookup.md` | 641073 | `1cf1fc8b` |
| `topic_map.json` | 1406371 | `d60cc38c` |

All 637 JSONL lines are objects with the required route fields and direct Opiq URLs. `topic_map.json` is valid JSON with an object root. Before canonical corrections, compact `opiq_lookup.md` was byte-for-byte equal to the 637-record canonical Markdown. `index.json` agrees with the archive members, JSONL count, format, timestamp, original filename, and languages.

## Books and kits

Counts were computed from all compact JSONL records and then from the deduplicated, normalized canonical sequence.

| Book ID | Detail title / visible book metadata | Publisher | Kit | Languages (source) | Source | Canonical | Curriculum | Detail / admin in canonical | Metadata notes |
| --- | --- | --- | ---: | --- | ---: | ---: | --- | --- | --- |
| `3k_matem_avita_2023_est` | Matemaatika 3. klassile 2023 ÕK / Arvutamise algus | Avita | 531 | et 140, en 2 | 142 | 142 | standard | 1 / 1 | none found |
| `3k_matem_avita_2_est` | Matemaatika 3. klassile / Arvutamise algus | Avita | 54 | et 140, en 2 | 142 | 142 | standard | 1 / 1 | none found |
| `3k_matem_avita_est` | Математика для 3 класса / Как появился счёт? | Avita | 92 | ru 137 | 137 | 137 | standard | 1 / 0 | none found |
| `3k_matem_koolibri_est` | MATEMAATIKA 3. klassile / KORDAMINE | Koolibri | 134 | et 62 | 62 | 62 | standard | 1 / 0 | none found |
| `3k_matem_koolibri_rus` | МАТЕМАТИКА 3 класс / ПОВТОРЕНИЕ | Koolibri | 308 | ru 62 | 62 | 62 | standard | 1 / 0 | none found |
| `3k_matem_osa1_est` | Matemaatika 3. klassile, I osa. Lihtsustatud õppekava | empty | 497 | et 27 | 27 | 26 | simplified | 1 / 1 | publisher empty; one repeated detail row excluded |
| `3k_matem_osa2_est` | Matemaatika 3. klassile, II osa. Lihtsustatud õppekava | empty | 498 | et 16, en 1 | 17 | 16 | simplified | 1 / 1 | publisher empty; one repeated detail row excluded |
| `3k_matem_osa3_est` | Matemaatika 3. klassile, III osa. Lihtsustatud õppekava / Kordamine | empty | 499 | et 24 | 24 | 24 | simplified | 1 / 1 | publisher empty |
| `3k_matem_osa4_est` | Matemaatika 3. klassile, IV osa. Lihtsustatud õppekava | empty | 500 | et 24 | 24 | 23 | simplified | 1 / 1 | publisher empty; one repeated detail row excluded |

The “simplified” classification is supported by the kit detail title stored in the compact records, including the III-part title even though its ordinary `Book` field is only `Kordamine`. The nine books are the full contents of this snapshot, not a claim that the complete grade 3 curriculum is covered.

Canonical totals after the decisions below are: 634 records; languages `et: 430`, `ru: 199`, `en: 5`; nine unique detail records; six Impressum records. Administrative and unique detail records remain because this issue only resolves proven duplicate and subject errors.

## Exact URL duplicate audit

There are exactly three duplicate groups and three excess source occurrences. In every group the two rows have identical title, URL, book, subject, language, publisher, topics, headings, and task examples. Only the synthetic `chapter_id` differs. Each URL is a kit detail page rather than two distinct chapters, so the stable first occurrence is authoritative.

| URL | Source positions | Book ID | Chapter IDs | Language | Decision | Canonical result |
| --- | --- | --- | --- | --- | --- | --- |
| https://www.opiq.ee/Kit/Details/497 | 561, 562 | `3k_matem_osa1_est` | 265, 291 | et | `remove_duplicate` | retain source position 561 |
| https://www.opiq.ee/Kit/Details/498 | 584, 585 | `3k_matem_osa2_est` | 248, 264 | et | `remove_duplicate` | retain source position 584 |
| https://www.opiq.ee/Kit/Details/500 | 625, 626 | `3k_matem_osa4_est` | 200, 223 | et | `remove_duplicate` | retain source position 625 |

All three detail rows have no headings or task examples. No incompatible metadata was merged. The canonical count changes from 637 to 634, and the 634 canonical URLs are unique.

## Subject-label audit: `Kaitseme loodust`

The compact source contains exactly two records labelled `science / loodusõpetus / природоведение`. No third science-labelled source record exists.

| Source position | URL | Book / kit / chapter | Sequence evidence | Task evidence | Decision |
| ---: | --- | --- | --- | --- | --- |
| 59 | https://www.opiq.ee/kit/531/chapter/29334 | `3k_matem_avita_2023_est`, kit 531, chapter 3.16 | Follows chapters 3.14 and 3.15 and precedes 3.2 within the same mathematics book | Read a response diagram and count respondents; calculate the price of gifts; heading asks how many hours of electricity are saved | `correct_to_mathematics` |
| 201 | https://www.opiq.ee/kit/54/chapter/2701 | `3k_matem_avita_2_est`, kit 54, chapter 3.16 | Follows chapters 3.14 and 3.15 and precedes 3.2 within the older version of the same mathematics book | Read a response diagram and count respondents; calculate the price of gifts; heading asks how many hours of electricity are saved | `correct_to_mathematics` |

The environmental-protection theme is authentic context, but the learner actions are diagram reading and arithmetic. Both records therefore remain in mathematics with canonical Subject `mathematics / matemaatika / математика`. Only the erroneous base aliases `science`, `loodusõpetus`, and `природоведение` were replaced by their mathematics equivalents. Specific context such as `loodus`, `keskkond`, `kaitseme loodust`, `prügi`, `pakendid`, `energia`, `природа`, `окружающая среда`, `nature`, and `environment` was retained where present in the source headings or topics.

## Grade 3 science cross-route check

The two exact URLs do not occur in `project-files/outputs/opiq_3klass_loodusopetus.md`. Searches for the title and the distinctive diagram, gift-cost, waste/packaging, and electricity-saving phrases also found no semantic duplicate there. Canonical ownership remains with mathematics because the source books and learner tasks are mathematical; the grade 3 science index was not changed.

## Reproducibility and limitations

`scripts/generate-grade-3-mathematics-qa.mjs` re-reads the committed compact ZIP, validates all 637 source records and compact metadata, verifies the three exact duplicate decisions, applies only the two exact subject normalizations, and compares the resulting 634 records with the canonical Markdown field by field. The manifest checker independently enforces unique canonical URLs and the exact mathematics Subject for every record in this route.

The unavailable original export prevents verification against pre-compact raw export metadata. Empty publisher values for the simplified books are preserved rather than invented. The audit does not evaluate every exercise pedagogically and does not prove curriculum completeness.
