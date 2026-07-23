# Grade 3 Russian original-source import audit

## Result

The canonical `grade-3-russian` route is generated from the committed original archive `project-files/inputs/final-zips/opiq_3klass_3_2023_opiq_v2.zip`. It contains **478 instructional pages** from **4 book/kit variants**. This is a source catalogue, not proof of official curriculum completeness.

- SHA-256: `5ee00c001d3cd2a39d543896effd0cc5a3bf4ca0f2d68ff2d29df184f2805d2c`
- size: 5122183 bytes
- ZIP members: 497
- capture timestamp: 2026-07-23T05:57:52.865Z
- source rows: 488

## Complete source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional pages | 478 |
| Unique Kit Details | 4 |
| Duplicate Kit Details aliases | 4 |
| Impressum | 1 |
| Opiq search-results page | 1 |
| Total | 488 |

All rows are classified, all canonical URLs are direct and unique, and no URL overlaps another manifest route.

## Book and kit inventory

| Kit | Canonical Book ID | Source Book ID | Title | Publisher | Pages |
| ---: | --- | --- | --- | --- | ---: |
| 94 | `русский_язык_для_3_класса__kit94` | `русский_язык_для_3_класса` | Русский язык для 3 класса | not captured | 173 |
| 250 | `русский_язык_3_класс__kit250` | `русский_язык_3_класс` | РУССКИЙ ЯЗЫК 3 класс | not captured | 62 |
| 503 | `русский_язык._3_класс_(2023_г.)__kit503` | `русский_язык._3_класс_(2023_г.)` | Русский язык. 3 класс (2023 г.) | not captured | 191 |
| 568 | `русский_язык_для_i_ступени._часть_3__kit568` | `русский_язык_для_i_ступени._часть_3` | Русский язык для I ступени. Часть 3 | Avita | 52 |

Publisher metadata is absent from the new archive. The kit 568 value `Avita` is retained only because exact kit-specific metadata was already audited in the previous canonical route; the other publishers remain empty.

## Subject, grade, and language

All 488 source rows are incorrectly labelled `mathematics / matemaatika / математика`. The four Source Book IDs, Kit Details titles, visible book titles, Russian grammar/reading headings, Russian pupil tasks, and the captured Opiq Russian subject-filter URL prove the Russian-language subject. Canonical instructional records therefore use `Russian language / vene keel / русский язык`, and generated mathematics topic aliases are removed.

All source rows and all four book identities say grade 3. The source language distribution is 487 `ru` and one `et`; the sole Estonian row is the excluded `Varamu – Opiq` search-results page. Canonical language is `ru` for all 478 pages.

## Exclusions and duplicate handling

The four duplicate URL groups are exactly the four Kit Details URLs. Each pair is identical except for synthetic `chapter_id`; both the unique detail and its alias are excluded. The kit 503 `Импрессум` and kit 94 `/Search/Kits` row are also excluded. No duplicate instructional URL exists.

## Technical content repairs

The generator applies only deterministic archive-supported transformations: NFC, removal of discretionary soft hyphens, replacement of zero-width spacing controls, whitespace collapse, extraction-payload/HTML removal while retaining visible text, and replacement of generated mathematics aliases. It affected 478 pages. Every changed field has raw and canonical SHA-256 hashes in the QA snapshot. No Russian educational prose is stylistically rewritten.

Post-repair hard errors: **0**. Missing tasks, repeated titles, short records, and mixed-script typography remain classified warnings in QA rather than invented corrections.

## Kit 568 ownership migration

The old grade-2 source archive, the dedicated grade-3 archive, the former grade-2 canonical representation, and the new grade-3 representation have the same **52** instructional URLs, chapter order, normalized titles, and headings. Task evidence is exact on 51 pages. On chapter 31798 the same interactive rhyme words and prompt occur in a different option order; QA records both hashes and the bounded `interactive_option_order_only` classification. The dedicated capture, Kit Details, Source Book ID, visible title, and grade metadata all identify grade 3. Kit 568 is therefore removed from `grade-2-russian` (373 → 321) and owned exclusively by `grade-3-russian`.

## Limitations

- Kit 94's compact index book title is `Varamu – Opiq` because one search-results row contaminated the index identity; the captured Kit Details title supplies the canonical book title.
- Publisher metadata is absent except for previously audited kit 568 provenance; no publisher is invented.
- Missing task examples are not reconstructed.
- The route does not establish official curriculum coverage or replace a curriculum map.

No additional Opiq recapture is required for this routing migration.
