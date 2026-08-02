# Grade 6 science teacher work-plan extraction audit

Status: extracted and structurally validated; route mapping is partial and canonical Opiq mapping remains incomplete.

## Scope and source

This audit covers only the supplementary Estonian Grade 6 science (`loodusõpetus`) teacher work-plan example stored at `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf`. The unchanged source is attributed to Vaike Rootsmaa, contains 31 pages, has byte size `493983`, and has SHA-256 `2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762`.

The extraction is bound to the registered `grade-6-science` route context and its exact `md_path`, `project-files/outputs/opiq_6klass_loodusopetus.md`. It does not map records to Opiq URLs and does not change that canonical route.

## Extraction method

Embedded PDF text was parsed with table-aware handling. All 31 rendered pages were reviewed visually to confirm headings, lesson numbers, page evidence, and cells or rows continuing across page boundaries. The recorded method is `embedded_text_plus_visual_page_verification`, with `embedded_text_used: true`, `visual_verification: all_pages_rendered_and_reviewed`, verified pages 1–31, and `ocr_used: false`.

Long descriptive cells were normalized to concise Estonian rather than copied as long quotations. References to Grade 5 topics remain prerequisite context inside this Grade 6 source and are not treated as Grade 5 route content.

## Extracted structure

| Thematic block | Declared hours | Source pages | Visible lesson sequence |
| --- | ---: | ---: | ---: |
| MULD | 12 | 1–5 | 1–12 |
| AED JA PÕLD ELUKESKKONNANA | 15 | 5–9 | 13–27 |
| METS ELUKESKKONNANA | 14 | 9–13 | 28–41 |
| ÕHK | 18–19 | 13–19 | 42–61 |
| LÄÄNEMERI ELUKESKKONNANA | 13–14 | 19–23 | 62–74 |
| ELUKESKKONNAD EESTIS | 8 | 23–25 | 75–82 |
| EESTI LOODUSVARAD | 10 | 25–28 | 83–92 |
| LOODUS- JA KESKKONNAKAITSE EESTIS | 14 | 28–31 | 93–104 |
| **Aggregate allocation** | **104–106** | **1–31** | **1–104 visible** |

The annual allocation is 105 hours and lies inside the exact aggregate range 104–106. The intervals 18–19 and 13–14 are preserved as strict `minimum`, `maximum`, and `source_text` objects; no flexible hour is silently assigned to either block.

The literal numbered table rows cover lessons 1–104. To represent the declared annual sequence 1–105 without inventing a topic or block placement, lesson 105 is an explicit low-confidence `unassigned_annual_slot`. In total, 101 ordered range records cover 1–105 without gaps, overlaps, duplicates, or out-of-range numbers, while retaining the explicit source ranges 3–4, 76–77, 98–99, and 102–103.

## Unresolved source details

Twelve source-level ambiguities or normalization decisions are recorded explicitly. They include the two hour intervals; the unassigned flexible hour and annual lesson 105; differences between declared block hours and visible lesson sequences; prior-test analysis rows located at the starts of new blocks; cross-page table continuations; Grade 5 prerequisite references; two topic continuations; and the mismatch between the visible author and technical PDF metadata.

Rows containing prior test-result analysis remain under the headings where the source table visibly places them. They are not reassigned to a neighbouring block without evidence.

## Boundaries and conclusion

This PDF is a supplementary teacher work plan and a pedagogical example. It is not a canonical Opiq source, a mandatory national sequence, or evidence that the official curriculum is completely covered. Therefore `official_curriculum_complete` and `canonical_opiq_mapping_complete` remain `false`. The separately reviewed production crosswalk classifies all source records and changes mapping status to `partial`; production lessons and teacher-pack content remain outside this extraction artifact.
