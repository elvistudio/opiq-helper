# Grade 7 geography teacher work-plan extraction audit

Status: source extraction complete and structurally validated; route mapping is partial, canonical Opiq mapping remains incomplete, and official-curriculum completeness is unverified.

## Scope and source

This audit covers only the supplementary Estonian Grade 7 geography (`geograafia`) teacher work-plan example stored at `project-files/inputs/originals/teacher-work-plans/Geo-tookava-7-klass-Reet-Tuisk.pdf`. The unchanged source is attributed to Reet Tuisk, contains 17 pages, has byte size `366595`, and has SHA-256 `d25874fcf0c211d1b1f1e0a22d2beb50cb4046eb05eaec31bfb1068bbbcf82aa`.

The extraction is bound to the registered `grade-7-geography` route context and exact `md_path`, `project-files/outputs/opiq_7klass_geograafia.md`. It does not use the distinct Grade 7 science source, map records to Opiq URLs, or change either canonical route.

## Extraction method

Embedded PDF text was parsed with table-aware handling. All 17 rendered pages were reviewed visually to confirm headings, numbered rows, page evidence, and cells continuing across page boundaries. The recorded method is `embedded_text_plus_visual_page_verification`, with embedded text used, all pages rendered and reviewed, verified pages 1-17, and OCR not used.

Long cells were normalized to concise Estonian. URI annotations from the PDF were retained as source-captured links; this extraction does not claim that those older external links are currently available or unchanged.

## Extracted structure

The annual total is explicitly declared by the source as 35 hours at one hour per week. The block headings do not state separate hour totals, so block allocations are derived only from the visible numbered spans:

| Thematic block | Visible lesson span | Derived allocation | Source pages |
| --- | ---: | ---: | ---: |
| KAARDIÕPETUS | 1-11 | 11 | 1-5 |
| GEOLOOGIA | 12-20 | 9 | 5-10 |
| PINNAMOOD | 21-29 | 9 | 10-13 |
| RAHVASTIK | 30-35 | 6 | 14-17 |
| **Total** | **1-35** | **35** | **1-17** |

All 35 visible numbers are represented as separate lesson-range records. Coverage is exactly 1-35, with no gaps, overlaps, duplicates, lesson 0, or lesson 36. No approximate weeks were inferred from the weekly allocation.

## Unresolved source details

Seven source ambiguities or normalization decisions are retained explicitly:

- lesson 6 has no visible topic-cell text; its activity is normalized to `Orienteerumine kaardi ja kompassiga` with medium confidence;
- lessons 12, 21, and 30 combine analysis of the preceding test with the first material under a new block heading and remain in the visually shown block;
- the numbering header switches from `Õppetund` to `Õppenädal` in the later tables;
- lesson 35 starts as `Kordamine` on page 16 and continues with `Õppeaasta lõpetamine` on page 17, without creating a lesson 36;
- references to Grades 3, 4, 5, and 6 remain prerequisite context rather than records for another grade or route;
- the visible teacher name Reet Tuisk differs from the technical PDF Author metadata value `Mare`;
- cross-page table continuations were joined to the preceding numbered row and retain both page references.

## Boundaries and conclusion

This PDF is a supplementary teacher work plan and a pedagogical example. It is not a canonical Opiq source, a mandatory national sequence, or evidence of complete official-curriculum coverage. The source extraction is complete for all 35 visible records and route mapping is now `partial`; `official_curriculum_complete` and `canonical_opiq_mapping_complete` remain `false`. Annual-course design, production lessons, teacher packs, Russian translation, and Grade 7 science extraction are outside this extraction artifact.
