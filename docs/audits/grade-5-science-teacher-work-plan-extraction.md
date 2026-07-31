# Grade 5 science teacher work-plan extraction audit

Status: extracted and structurally validated; a separate partial canonical Opiq crosswalk now exists.

## Scope and source

This audit covers only the supplementary Estonian Grade 5 science (`loodusõpetus`) teacher work-plan example stored at `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-5-klassile.pdf`. The source is attributed to Vaike Rootsmaa, contains 25 pages and has SHA-256 `fd7593800bbc0bada390e98f92f7c45dcf21c0e09a780d407f45fb7e921e9c90`.

The extraction is bound to the registered `grade-5-science` route context and its exact `md_path`, `project-files/outputs/opiq_5klass_loodusopetus.md`. It does not itself map records to Opiq URLs and does not change that canonical route; the separate mapping artifact is audited in `docs/audits/grade-5-science-teacher-work-plan-crosswalk.md`.

## Extraction method

Embedded PDF text was parsed with table awareness. All 25 rendered pages were then reviewed visually to confirm table continuations, headings, lesson numbers and page evidence. OCR was not used. The normalized artifact preserves source-language topics and page references while shortening long descriptive cells without treating the wording as canonical curriculum text.

## Extracted structure

| Thematic block | Declared hours | Source pages |
| --- | ---: | ---: |
| JÕGI JA JÄRV. VESI KUI ELUKESKKOND | 26 | 1–9 |
| VESI KUI AINE, VEE KASUTAMINE | 14 | 9–16 |
| ASULA ELUKESKKONNANA | 10 | 16–19 |
| PINNAVORMID JA PINNAMOOD | 10 | 19–22 |
| SOO ELUKESKKONNANA | 10 | 22–25 |
| **Total** | **70** | **1–25** |

The main lesson numbering covers 1–70 exactly with no gaps or overlaps. Sixty-seven normalized range records represent both single lessons and explicit multi-lesson ranges.

## Unresolved source details

Six source-level ambiguities are retained instead of silently normalized:

- a parenthetical lesson 6 row overlapping the main numbering;
- an unnumbered seasonal practical activity in the settlement block;
- declared-hour versus unique-numbered-row differences in each of the first three thematic blocks;
- optional lesson 41 weather topics labelled as also suitable for Grade 6.

The adjacent-grade note remains optional source context inside this Grade 5 extraction. It is not routed as Grade 6 content.

## Boundaries and conclusion

This teacher work plan is a pedagogical example and a supplementary planning source. It is not evidence that the official curriculum is completely covered, and it is not a mandatory national sequence. Both `official_curriculum_complete` and `canonical_opiq_mapping_complete` therefore remain `false`. The route-specific crosswalk changes only `mapping_status` from `deferred` to `partial`; Russian adaptation, production lessons and teacher-pack content remain later reviewed phases.
