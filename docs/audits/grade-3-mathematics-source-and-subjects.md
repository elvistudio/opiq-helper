# Grade 3 mathematics original-source and subject audit

## Result

The canonical route now uses the committed original Opiq export `project-files/inputs/final-zips/opiq_3klass_matemaatika_3_klassile_opiq_v2.zip`, not the historical derived compact snapshot. The route contains **619 instructional pages** from **9 book/kit variants**. It remains a source catalogue, not proof of full official curriculum coverage.

Archive identity:

- SHA-256: `44ef9fafb11084288f68cb970f96393fb5e41e46810bbe080ba711377649c486`
- size: 7911532 bytes
- members: 657
- capture: 2026-07-22T19:51:37.588Z
- format: 2.0
- declared source archive name inside export: not present (the committed repository path is authoritative)

## Record accounting

| Category | Count |
| --- | ---: |
| Source rows | 643 |
| Canonical instructional pages | 619 |
| Unique Kit Details excluded | 9 |
| Duplicate Kit Details aliases excluded | 9 |
| Administrative Impressum excluded | 6 |

All 643 rows are accounted for. Canonical URLs are unique. The old and new captures contain the same 619 instructional URL set.

## Book and kit inventory

| Kit | Canonical Book ID | Title | Publisher | Language | Programme | Source rows | Pages |
| ---: | --- | --- | --- | --- | --- | ---: | ---: |
| 54 | `matemaatika_3._klassile__kit54` | Matemaatika 3. klassile | Avita | et | ordinary_curriculum | 143 | 140 |
| 92 | `математика_для_3_класса__kit92` | Математика для 3 класса | Avita | ru | ordinary_curriculum | 138 | 136 |
| 134 | `matemaatika_3._klassile_koolibri__kit134` | MATEMAATIKA 3. klassile | Koolibri | et | ordinary_curriculum | 63 | 61 |
| 308 | `математика_3_класс__kit308` | МАТЕМАТИКА 3 класс | Koolibri | ru | ordinary_curriculum | 63 | 61 |
| 497 | `matemaatika_3._klassile,_i_osa._lihtsustatud_õppekava__kit497` | Matemaatika 3. klassile, I osa. Lihtsustatud õppekava | not captured | et | simplified_curriculum | 27 | 24 |
| 498 | `matemaatika_3._klassile,_ii_osa._lihtsustatud_õppekava__kit498` | Matemaatika 3. klassile, II osa. Lihtsustatud õppekava | not captured | et | simplified_curriculum | 17 | 14 |
| 499 | `matemaatika_3._klassile,_iii_osa._lihtsustatud_õppekava__kit499` | Matemaatika 3. klassile, III osa. Lihtsustatud õppekava | not captured | et | simplified_curriculum | 25 | 22 |
| 500 | `matemaatika_3._klassile,_iv_osa._lihtsustatud_õppekava__kit500` | Matemaatika 3. klassile, IV osa. Lihtsustatud õppekava | not captured | et | simplified_curriculum | 24 | 21 |
| 531 | `matemaatika_3._klassile_2023_õk__kit531` | Matemaatika 3. klassile 2023 ÕK | Avita | et | ordinary_curriculum | 143 | 140 |

The original archive does not capture publisher names. Avita and Koolibri values for ordinary books are retained from the previously audited compact evidence; simplified-book publishers remain empty rather than invented.

## Classification, duplicates, and exclusions

The original export contains nine duplicated Kit Details URLs. Each pair is content-identical except for its synthetic chapter ID. Both the unique detail row and its duplicate alias are excluded because neither is instructional. Six Impressum pages are also excluded. No same-URL instructional conflict exists.

## Grade, subject, and language decisions

The exporter marks all 643 rows as grade 2, while every captured cover title, source Book ID, and kit is explicitly grade 3. Included pages are therefore normalized to grade 3; the raw value remains recorded in QA.

Two environmental-context calculation pages remain mathematics:

- https://www.opiq.ee/kit/531/chapter/29334
- https://www.opiq.ee/kit/54/chapter/2701

Five pages labelled `en` are Estonian according to their book, title, headings, and tasks, and are normalized to `et`:

- https://www.opiq.ee/kit/54/chapter/2659
- https://www.opiq.ee/kit/54/chapter/2674
- https://www.opiq.ee/kit/498/chapter/27314
- https://www.opiq.ee/kit/531/chapter/29291
- https://www.opiq.ee/kit/531/chapter/29307

## Technical extraction repairs

The generator performs only deterministic technical normalization: NFC, whitespace normalization, removal of discretionary soft hyphens and zero-width spacing controls, removal of framed extractor JSON, and removal of embedded MathML/HTML tags while retaining their visible text. It records 100 affected pages and every source/canonical value pair in QA. It does not rewrite educational prose or invent missing fields.

The post-repair quality scan has zero hard errors. It classifies 217 pages without task examples, 133 repeated-title groups on distinct URLs, 5 valid short source sections, and 4 source-typography mixed-script observations. These are retained source features rather than automatic errors; exact URLs and dispositions are in QA.

## Historical compact comparison

The historical compact had 637 rows and 634 URL-deduplicated records, including 15 non-instructional pages. The original capture has 643 rows and produces 619 instructional pages.

- newly captured instructional URLs: 0
- missing instructional URLs: 0
- records with topic/heading/task differences: 348
- richer original field sets: 40
- historical field sets richer: 923
- changed-capture field sets: 62
- unexplained differences: 0

Per-URL field classifications and hashes are stored in the QA snapshot. Richer original task evidence is retained. The old compact ZIP remains committed only as a noncanonical historical comparison artifact and is not used by the manifest route.

## Remaining limitations

- The capture systematically mislabels raw grade as 2; canonical grade 3 is evidence-backed by all nine book/kit identities.
- Raw per-book JSON marks every book `ru`, while the compact index and page text distinguish Estonian and Russian books; the raw anomaly is retained in QA.
- Publisher metadata is absent from the original capture. No publisher is invented.
- Missing task examples are allowed where the source page has no captured task example; no task text is synthesized.
- The catalogue is not a curriculum map and does not establish official programme completeness.

No additional Opiq recapture is required for canonical routing. A future targeted metadata capture could independently reconfirm publishers, but this is not a blocker.
