# Grade 4 live-catalogue and source-gap review

Verified: 2026-07-27

## Executive summary

The exact public Grade 4 Varamu filter returned **55** results on one page: **39 learning kits** and **16 teacher books**. The snapshot is `complete_for_declared_filter` for that exact filter because the URL, every selected filter, result count, sort order, pagination state, all result IDs, verification date, capture method, filter identity, and complete metadata identity are recorded.

The inventory reconciles to **31 canonical student kits**, **3 known captured shared/support kits**, and **21 additional live kits**. The additional set contains 16 teacher-only books and five multi-grade/supplementary kits. There are **0 new exact Grade 4 student-source candidates**.

This is a catalogue-accounting result, not an official-curriculum completeness, content completeness, access-rights, or pedagogical-effectiveness claim.

## Evidence methodology

- Public filter: https://www.opiq.ee/Search/Kits?searchPhrase=&curriculumGroups=*&selectedkittype=*&classcourse=4&subject=&publishinghouse=&package=&language=&sortingorder=LanguageFirst
- Filters: blank search; all curricula/programmes, material types, subjects, publishers, packages and languages; Grade 4; LanguageFirst sort.
- The result list had one observed page and no pagination controls.
- Every result was checked against its public Kit Details page for title, type, subject, grades, languages, publisher, byline, curriculum labels, access/package and counts.
- Repository comparison covered all eleven current Grade 4 routes, the three captured shared/support kits, all ten immutable ZIPs, all manifest routes, and the post-intake Kit Details evidence.
- The dated JSON snapshot is the authoritative evidence input. The generator reads it and writes only this derived report and audit.

## Evidence identities and Grade 4 normalization

The filter identity is `ef472722fe673196b197e27b02df781febf1074cc4fd44666085ea4a49da6c5e`; it covers the filter, displayed count, and ordered kit IDs. The metadata identity is `45dd1857ebcd953a7a38d5634e2f8702f1d25e145021df08c002fd8585c6f4a0`; it covers every normalized metadata field, classification, and normalization decision.

Kit 55 preserves the live observation `[4, 5]` and separately records the human-reviewed routing normalization `[4]`. The historical post-audit evidence and Russian parallel kit 82 both support retaining `grade-4-human-studies-and-society` ownership. The live Grade 5 value is treated as a probable catalogue metadata typo, not erased or represented as if it had never been observed.

The machine report contains `cross_evidence_review` for every kit present in the immutable historical Kit Details evidence. Kit 55 is `resolved_by_human_review`; the other compared records are `consistent`.

## Current canonical coverage

All 31 live canonical kits reconcile with the eleven current Grade 4 route allocations. No canonical route or manifest entry is changed by this review. `eesti keel` and `eesti keel teise keelena` remain separate routes; simplified and mixed-subject roles remain explicit secondary classifications.

## Newly discovered live kits

Nine entries were supplied only as preliminary discovery seeds; the complete filter found twelve additional entries (231, 324, 348, 349, 350, 411, 416, 444, 445, 465, 474, 506). The table below lists all 21 live kits absent from the immutable Grade 4 capture baseline.

| Kit | Type | Decision | Recapture |
| --- | --- | --- | --- |
| 231 — Koduõpe | supplementary_shared | multi_grade_no_exclusive_owner | metadata_only |
| 324 — Meie ise. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 348 — Luudusoppus noorõmbalõ kooliiäle (kakkõhelü '-ga) | supplementary_shared | multi_grade_no_exclusive_owner | metadata_only |
| 349 — Luudusoppus noorõmbalõ kooliiäle (kakkõhelü märkmäldä) | supplementary_shared | multi_grade_no_exclusive_owner | metadata_only |
| 350 — Luudusoppus noorõmbalõ kooliiäle (kakkõhelü q-ga) | supplementary_shared | multi_grade_no_exclusive_owner | metadata_only |
| 359 — Meie perekond. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 373 — Meie kodukoht. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 377 — Meie linn ja vald. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 378 — Matemaatika 4. klassile, e-tund | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |
| 411 — Мы сами. Пособие для учителя | teacher_only | teacher_support_no_student_owner | metadata_only |
| 416 — Наша семья. Пособие для учителя | teacher_only | teacher_support_no_student_owner | metadata_only |
| 444 — Наш район. Пособие для учителя | teacher_only | teacher_support_no_student_owner | metadata_only |
| 445 — Meie maakond ja riik. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 465 — Eesti Pärimusmuusika Keskuse õppevideod | supplementary_shared | multi_grade_no_exclusive_owner | metadata_only |
| 471 — Meie mini-minifirma. Õpetaja käsiraamat | teacher_only | teacher_support_no_student_owner | metadata_only |
| 474 — Наша мини-минифирма. Пособие для учителя | teacher_only | teacher_support_no_student_owner | metadata_only |
| 487 — Loodusõpetus 4. klassile, e-tund | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |
| 492 — Loodusõpetus 4. klassile, e-tund (2023) | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |
| 493 — Eesti keel 4. klassile, e-tund | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |
| 506 — Matemaatika 4. klassile, e-tund (2023 ÕK) | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |
| 566 — Eesti keel 4. klassile, e-tund (2026) | teacher_only | teacher_support_no_student_owner | teacher_material_capture_internal_only |

## Teacher-only and support materials

The teacher-only inventory contains 16 kits. Exact Grade 4 e-tund resources remain outside student routes and are eligible only for an authorised internal teacher-material workflow. The grades 1–6 entrepreneurship manuals remain multi-grade teacher support.

The shared/support inventory contains 8 kits. Kits 161 and 476 remain non-exclusive; kit 200 retains `grade-2-arts-and-crafts` ownership. The five newly found shared resources receive metadata-only accounting and no exclusive Grade 4 owner.

## Student-source gaps

No additional exact Grade 4 student-facing kit was found outside the current canonical routes. This does not prove official-curriculum completeness. Curriculum mapping remains separate and depends on issue #37.

## Edition and replacement relationships

Older and newer student and teacher editions are preserved as distinct records. No edition is collapsed or declared obsolete without direct evidence.

## Bounded recapture plan

- Catalogue accounting is complete from metadata; task-body capture is not required for this purpose.
- Exact-grade e-tund content, if needed later, must remain teacher-only and be captured only through an authorised internal workflow.
- Multi-grade teacher manuals and supplementary resources require no full-kit recapture. A selected chapter or task may be captured only for a separately scoped instructional need.
- Existing canonical task-body limitations remain a downstream lesson-authoring concern and do not invalidate catalogue ownership.

## Blockers and next work

- `official_curriculum_completeness_out_of_scope`: Catalogue completeness does not establish official curriculum completeness; that remains dependent on #37.
- `canonical_task_bodies_partially_captured`: Some canonical task bodies remain incomplete for lesson authoring, but no task-body recapture is required for catalogue accounting.

A separate PR is unnecessary for new exact-grade student imports because none were found. Optional future work may evaluate selected supplementary resources or authorised teacher support without changing student ownership.

## Issue #41 closure status

The catalogue-capture portion is ready to close after this PR is reviewed and merged: the declared-filter snapshot is defensibly complete, every discovered kit is classified, student gaps have decisions, teacher/support materials are separated, recapture is bounded, and current ownership remains valid. Issue #41 must not be closed automatically. Official curriculum completeness remains separate under #37.

## Non-guarantees

- No claim of complete official curriculum coverage is made.
- No claim is made about authenticated, unpublished, withdrawn, hidden, or future Opiq catalogue entries.
- No complete chapter prose, task body, answer key, illustration, or interactive content was captured.
- Teacher materials were classified but not approved for student-facing use.
- No pedagogical effectiveness, legal access entitlement, or production readiness is claimed.
