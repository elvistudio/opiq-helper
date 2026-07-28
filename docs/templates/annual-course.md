# Annual-course plan checklist

Use `schemas/annual-course.schema.json` and `schemas/annual-course-components.schema.json` as the machine-readable authorities. The grade-5 production artifact demonstrates a complete annual architecture with partial thematic implementation; it is not a fully authored annual course.

- Assign a unique course ID, grade/subject, languages, and manifest route.
- Link verified official maps and record exact-grade versus school-stage scope explicitly.
- Explain publisher sequence and curated sequence separately.
- Order every verified topic-inventory ID needed by the architecture and make prerequisites point strictly backward. Link a thematic plan only when that artifact exists.
- Record per-unit lesson allocations and reconcile every budget scenario, reserve, and school-specific capacity.
- Put canonical page choices, role decisions, rejected duplicates, and exclusions in the linked source-selection matrix.
- Give every unit a `topic_synthesis` object using `schemas/topic-synthesis.schema.json`: Russian output, explicit strategies, all selected source contributions, transformations, missing concepts, production readiness, and review status.
- Treat `core_explanation_ru` as the final explanation role. An Estonian source may hold it only through an explicit ET→RU translation or pedagogical adaptation.
- Link the shared external registry even when it is empty; never invent a production entry merely to demonstrate external-source support.
- Plan Estonian vocabulary, instruction-language, sentence, and oral-answer progression by unit separately from the Russian synthesis.
- Give vocabulary a strictly later-unit recycling interval and purpose in `planned_vocabulary_recycling_intervals`; this is separate from same-lesson `reuse_stage_refs` and within-unit `recycled_in_lessons`.
- Keep language progression in its linked component and maintain separate practical, revision, subject-assessment, and language-assessment calendars in the teaching-calendars component.
- Record outcome coverage, teacher-review decisions, known gaps, and provenance.
- Add a linked implementation roadmap with every annual unit exactly once and no placeholder lesson files.
- For architecture-only completion, keep `scope: complete_annual_architecture`, `all_thematic_plans_authored: false`, `all_lessons_authored: false`, `declared_complete: false`, and a real `deferred_to_issue`.

Do not turn school-stage evidence, publisher placement, or topic availability into an unsupported exact-grade or full-course claim.

Validate with `npm run test:synthesis && npm run test:plans && npm run check:plans`.

## Commercial version 2.2

Add `delivery_model`, `commercial_release_policy`,
`opiq_companion_policy`, `family_overlay_policy`, and
`originality_review_policy`. Validate every implemented thematic plan before
claiming that all required lessons work without Opiq. Optional customer
companions require declared access modes and author-created fallbacks;
teacher-only links remain internal and simplified material is opt-in. Require a
current originality gate before publication and preserve individual Grade 2
and Grade 4 evidence. Internal `selected_source_books` stay source-analysis
evidence and are not a customer dependency.
