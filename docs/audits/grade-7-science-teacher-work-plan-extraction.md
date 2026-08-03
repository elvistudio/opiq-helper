# Grade 7 science teacher work-plan extraction audit

Status: source extraction complete and structurally validated; route mapping is partial, while canonical Opiq mapping remains incomplete.

## Scope and source

This audit covers only the supplementary Estonian Grade 7 science (`loodusõpetus`) teacher work-plan example stored at `project-files/inputs/originals/teacher-work-plans/Opetaja-tookava-Loodusopetus-7-klass.pdf`. The unchanged source contains 17 pages, has byte size `325726`, and has SHA-256 `fb883aaf6429af4b543def1eb18deca3909ec541b4eaa5eccc7efb880368f35f`.

The visible title page and provenance identify the teacher as Riina Murulaid. The technical PDF `Author` metadata contains Riina Leet; this mismatch is documented without replacing the visible source author. The extraction is bound to route `grade-7-science` and exact `md_path` `project-files/outputs/opiq_7klass_loodusopetus.md`. It does not use the separate Grade 7 geography work plan or modify either canonical route.

## Extraction method

Embedded PDF text was parsed with table-aware handling. All 17 rendered pages were reviewed visually to confirm headings, numbered ranges, the unnumbered row, page continuations, and source-page evidence. Page 17 is blank except for its page number; it remains in extracted and visually verified coverage but creates no instructional record. OCR was not used.

The recorded method is `embedded_text_plus_visual_page_verification`, with embedded text used, all pages rendered and reviewed, and verified pages 1-17. Long cells were normalized to concise Estonian. Printed and annotated URLs were retained as source-captured links without claiming that they are currently available or unchanged.

## Extracted structure

The source explicitly declares 70 annual hours at two hours per week. It does not print separate block-hour totals, so each block allocation is derived only from its visible numbered lesson span:

| Thematic block | Visible lesson span | Derived allocation | Source pages |
| --- | ---: | ---: | ---: |
| INIMENE UURIB LOODUST | 1-19 | 19 | 2-6 |
| AINETE JA KEHADE MITMEKESISUS | 20-34 | 15 | 6-10 |
| LOODUSNÄHTUSED | 35-52 | 18 | 10-13 |
| ELUSA JA ELUTA LOODUSE SEOSED | 53-70 | 18 | 13-16 |
| **Total** | **1-70** | **70** | **2-16** |

The numbered table covers lessons 1-70 exactly in 58 source-table records. Explicit source ranges 4-5, 9-10, 11-12, 16-17, 18-19, 26-27, 31-32, and 65-70 remain unsplit. In particular, 65-70 is one row for field trips, quizzes, and reserve time for completing work; it is not represented as six invented topics.

One additional row on page 6 has no number. It remains a separate `unnumbered_rows` record between lessons 19 and 20 for revision, consolidation, assessment, and submission of the workbook or work folder. It contributes neither a lesson number nor derived hours.

## Unresolved source details

Ten ambiguities or normalization decisions are retained explicitly. They cover the unnumbered wrap-up row; missing topic cells for lessons 14 and 33; lesson 33 continuing from page 9 to 10; the inferred, medium-confidence third-block title; the approximate ten-reserve-hour note versus visible range 65-70; cross-page continuations for ranges 18-19 and 26-27 and lessons 33 and 59; previous-grade prerequisite references; blank page 17; the visible-author versus technical-metadata mismatch; and the fact that 65-70 is not six distinct topics.

Lesson 51 remains a long-running experiment. Lessons 62 and 63 remain two separate numbered rows even though the source permits project-based delivery. Five holiday breaks and the absence of trimester or quarter scheduling are preserved as planning limitations, not curriculum-completeness evidence. Rows labelled `VAHEAEG` are not lessons.

## Boundaries and conclusion

This PDF is a supplementary, non-canonical teacher work-plan example. The source extraction is complete for 58 numbered ranges and one unnumbered row, while route mapping is only partial. It is not a mandatory national sequence and does not establish complete official-curriculum coverage. Therefore `official_curriculum_complete` and `canonical_opiq_mapping_complete` remain `false`, while mapping status is `partial`. Annual-course design, production lessons, teacher packs, translation, and Grade 7 geography changes remain outside this extraction.
