# Teacher work plans for Grades 5-7: source integration plan

Status: four originals, source extractions, route-specific crosswalks, the generated cross-route gap report and the priority semantic work-package review are complete; reusable teaching artifacts remain pending, Phase 5 is not complete, and official curriculum completeness is not verified.

## Source set

The source set consists of four Estonian-language teacher work-plan PDFs:

1. `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-5-klassile.pdf`
2. `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf`
3. `project-files/inputs/originals/teacher-work-plans/Geo-tookava-7-klass-Reet-Tuisk.pdf`
4. `project-files/inputs/originals/teacher-work-plans/Opetaja-tookava-Loodusopetus-7-klass.pdf`

These files are supplementary curriculum-planning sources. They are not Opiq exports, do not replace canonical Opiq routes, and do not prove full coverage of the official curriculum.

## Current implementation status

- Original PDFs and machine-readable provenance are complete under `project-files/inputs/originals/teacher-work-plans/`.
- Four source-PDF extractions are complete for the preserved source records under `evaluations/teacher-work-plans/`.
- Four route-specific crosswalks are complete for source-record classification under `curriculum-maps/grade-5-science/`, `curriculum-maps/grade-6-science/`, `curriculum-maps/grade-7-geography/` and `curriculum-maps/grade-7-science/`.
- The deterministic cross-route gap index is complete for those registered crosswalks: [machine-readable JSON](../../evaluations/teacher-work-plans/grades-5-7-gap-report.json) and [generated audit](../audits/grades-5-7-teacher-work-plan-gap-report.md).
- Priority semantic review is complete: 17 missing or ambiguous gaps are preserved in 16 work packages, with 13 ready for authoring and 3 blocked by teacher review. See the [hand-reviewed package registry](../../evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml) and [generated priority audit](../audits/grades-5-7-priority-work-packages.md).
- The selected first pilot is `grade-6-science-soil-organisms`; its materials and lightweight reusable-artifact contract belong to a separate follow-up PR.
- Reusable bridge, practical, assessment and oral-support teaching artifacts remain pending; Phase 5 is not complete.
- Official curriculum completeness, exact-grade official allocation, default-course selection and live-catalogue completeness remain unverified.

## Routing boundaries

- Grade 5, subject `science` / `loodusõpetus`.
- Grade 6, subject `science` / `loodusõpetus`.
- Grade 7, subject `geography` / `geograafia`.
- Grade 7, subject `science` / `loodusõpetus`.
- Source language: Estonian.
- Default project answer language may remain Russian; any Russian rendering derived from these PDFs must be labelled as translation or adaptation.
- Do not route Grade 7 geography material into Grade 7 science, or vice versa.

## Intended use

The PDFs can contribute evidence for:

- topic ordering and approximate lesson allocation;
- learning outcomes, key concepts and prerequisite knowledge;
- practical work, fieldwork, experiments and IKT activities;
- assessment moments and revision blocks;
- cross-curricular links and transversal themes;
- teacher resources and equipment lists;
- comparison between the planned curriculum sequence and existing Opiq route coverage.

They must not be used to copy long textbook passages or to present a sample work plan as the only mandatory national sequence.

## Integration phases

### 1. Preserve originals and provenance

Implementation status: complete for all four registered source PDFs.

- Commit the four PDFs unchanged under `project-files/inputs/originals/teacher-work-plans/`.
- Record SHA-256, byte size, page count, displayed title, author when present, grade, subject and source language in a machine-readable provenance file.
- Mark provenance kind as `supplementary_teacher_work_plan`.
- Keep original filenames in metadata even when repository filenames are ASCII-normalized.

### 2. Extract structured planning data

Implementation status: complete for source extraction from all four PDFs; this does not establish route or official-curriculum completeness.

Create one normalized artifact per PDF containing:

- source ID and exact page references;
- thematic blocks and their stated hour counts;
- lesson or week number;
- topic and concepts;
- learning outcomes and content statements;
- teaching methods, practical work and IKT;
- assessment type;
- subject integration and transversal themes;
- equipment and external links;
- extraction confidence and unresolved table cells.

Prefer table-aware extraction and visual verification of every page. Do not rely on OCR when embedded text is available.

### 3. Build route-specific curriculum maps

Implementation status: complete for classifying every registered source record in all four supplementary crosswalks; canonical and official completeness remain false.

Create or extend curriculum maps separately for:

- Grade 5 science;
- Grade 6 science;
- Grade 7 geography;
- Grade 7 science.

For every normalized topic, record:

- teacher-plan source and page;
- matching canonical route ID and `md_path`, when one exists;
- matching Opiq records and direct URLs;
- coverage status: `matched`, `partial`, `missing`, `ambiguous` or `outside_route`;
- whether the item is ordinary material, supplementary material or independently authored bridging content.

A teacher work plan can strengthen curriculum mapping but does not by itself establish completeness.

### 4. Compare with existing project artifacts

Implementation status: complete for the four registered samples through the generated cross-route gap report and semantic priority review. The report indexes gaps and sample-only topic absences, while the review preserves 17 missing or ambiguous gaps in 16 packages without creating teaching artifacts.

For each route:

- check `source-manifest.json` first;
- inspect only that route's canonical Markdown, QA snapshot, regression cases and existing curriculum maps;
- identify duplicate topics and terminology variants;
- flag planned practical activities that have no corresponding project material;
- flag Opiq topics that are not represented in the sample work plan without treating them as errors.

### 5. Produce reusable teaching artifacts

Implementation status: pending. Semantic review has selected `grade-6-science-soil-organisms` as the first bounded pilot and classified 13 packages as ready and 3 as teacher-review blocked, but no reusable artifact has been created and the reusable-artifact backlog remains incomplete.

After mapping is reviewed, derive small, source-attributed artifacts such as:

- thematic-plan YAML;
- practical-work inventory;
- key-term lists in Estonian with Russian explanations;
- oral-answer prompts and short supported Estonian responses;
- teacher questions, model child answers and step-by-step calculation tasks;
- gap tickets for independently authored material.

All adaptations must cite the source PDF and page and be labelled as translation, adaptation or independently authored material.

### 6. QA and regression protection

Implementation status: ongoing; focused crosswalk and generated-report validation is registered in CI.

Add checks that verify:

- all four originals exist and match recorded SHA-256 values;
- every extracted record points to a valid source ID and page;
- grade and subject boundaries are not crossed;
- hour totals and lesson numbers are internally consistent or explicitly flagged;
- curriculum-map entries use registered route IDs and exact `md_path` values;
- no completeness claim is made without a reviewed curriculum map;
- generated artifacts are reproducible from committed originals.

Run focused tests during authoring. Run the full test suite once the complete source set, extraction artifacts and route maps are ready for review.

## Recommended implementation order

1. Commit originals and provenance metadata.
2. Extract Grade 5 science and validate the schema.
3. Extract Grade 6 science using the same schema.
4. Extract Grade 7 geography and Grade 7 science independently.
5. Build four route-specific curriculum maps.
6. Generate the cross-route gap report and complete semantic work-package review.
7. Create the lightweight reusable-artifact contract and bounded Grade 6 soil-organisms pilot in a separate PR.
8. Add focused validation, then run the full repository test suite after Phase 5 is complete.

## Acceptance criteria

- Four unchanged PDF originals are committed.
- Provenance metadata includes hashes and page counts.
- Four subject-grade routes remain strictly separated.
- Every structured statement has a page-level source reference.
- Existing canonical Opiq routes remain the default retrieval source.
- Supplementary status and adaptations are explicit.
- Known gaps and ambiguous mappings are listed honestly.
- No claim of complete official-program coverage is made without separate verification.
