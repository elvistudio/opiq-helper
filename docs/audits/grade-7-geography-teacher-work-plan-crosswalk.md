# Grade 7 geography teacher work-plan crosswalk audit

Status: 35/35 supplementary source records classified; canonical Opiq mapping, programme-type verification, official-curriculum completeness, and default-course selection remain incomplete.

## Scope and source evidence

This audit covers the extraction at `evaluations/teacher-work-plans/grade-7-geography-extraction.json`, derived from the supplementary Estonian PDF `project-files/inputs/originals/teacher-work-plans/Geo-tookava-7-klass-Reet-Tuisk.pdf`. The unchanged source has SHA-256 `d25874fcf0c211d1b1f1e0a22d2beb50cb4046eb05eaec31bfb1068bbbcf82aa`, contains 17 pages, declares one weekly hour and 35 annual hours, and preserves 35 separate records spanning lessons 1–35.

The crosswalk is locked to the exact `grade-7-geography` route and reads only:

- canonical Markdown: `project-files/outputs/opiq_7klass_geograafia.md`;
- source archive: `project-files/inputs/final-zips/opiq_7klass_sissejuhatus_geograafiasse_v2.zip`;
- QA snapshot: `project-files/outputs/opiq_7klass_geograafia_qa.json`;
- 178 canonical Estonian and Russian page records;
- the five-book inventory and 15-group topic registry under `curriculum-maps/grade-7-geography/`.

No Grade 7 science, Grade 6 science, adjacent-grade, other-subject, external-textbook, rejected inventory, invented URL, or live-catalogue evidence is used. The PDF remains `supplementary_teacher_work_plan` and noncanonical.

## Source-record accounting

All 35 extraction objects are classified exactly once and remain single-lesson `lesson_range` mappings. No row is merged or split, lesson 36 is not invented, no unassigned annual slot is created, and every mapping retains a non-null source block:

| Source block | Lessons | Classified records |
| --- | ---: | ---: |
| `kaardiopetus` | 1–11 | 11 |
| `geoloogia` | 12–20 | 9 |
| `pinnamood` | 21–29 | 9 |
| `rahvastik` | 30–35 | 6 |
| **Total** | **1–35** | **35** |

## Mapping results

| Coverage status | Count |
| --- | ---: |
| `matched` | 9 |
| `partial` | 26 |
| `missing` | 0 |
| `ambiguous` | 0 |
| `outside_route` | 0 |
| **Total** | **35** |

All 35 mappings use at least one Russian canonical page, 32 use at least one Estonian canonical page, and 26 require an independently authored practical or assessment artifact or explicit teacher review. These language counts overlap. The mappings contain 79 positive page matches. All 79 retain `programme_type: unknown`, `programme_type_evidence_status: ambiguous`, and `default_course_eligibility: unverified`; the verified ordinary-programme match count is zero.

`matched` means only that committed exact-route titles, headings or tasks cover the complete normalized content and activity scope of one source row. It does not mean that a page is verified for the ordinary programme, may be selected for a default course, is production-ready, or proves official curriculum coverage.

Representative direct exact-route URLs include:

- geographic research methods: `https://www.opiq.ee/kit/543/chapter/30032`;
- scale and distance work: `https://www.opiq.ee/kit/543/chapter/30152`;
- field orientation: `https://www.opiq.ee/kit/301/chapter/16608`;
- geographic coordinates: `https://www.opiq.ee/kit/301/chapter/16609`;
- digital maps and GIS: `https://www.opiq.ee/kit/543/chapter/30188`;
- plate tectonics: `https://www.opiq.ee/kit/301/chapter/16622`;
- earthquakes and tsunami: `https://www.opiq.ee/kit/301/chapter/16623`;
- rock formation: `https://www.opiq.ee/kit/301/chapter/16625`;
- relief profiles: `https://www.opiq.ee/kit/301/chapter/16629`;
- population change and migration: `https://www.opiq.ee/kit/301/chapter/16614`;
- diagram construction: `https://www.opiq.ee/kit/2/chapter/1279`.

## Topic comparison

All 15 stable topic IDs are represented by explicit source mappings in this supplementary sample:

1. `geography-introduction-and-research-methods`;
2. `earth-shape-size-continents-and-oceans`;
3. `map-types-atlases-legends-and-generalization`;
4. `scale-distance-directions-and-orientation`;
5. `geographic-coordinates`;
6. `digital-maps-gis-and-satellite-imagery`;
7. `time-zones-and-date-line`;
8. `earth-interior-and-plate-tectonics`;
9. `earthquakes-volcanoes-and-tsunamis`;
10. `rocks-sediments-and-rock-cycle`;
11. `relief-landforms-and-elevation-mapping`;
12. `mountains-plains-and-ocean-floor-relief`;
13. `landform-change-weathering-erosion-and-human-impact`;
14. `countries-peoples-and-cultural-diversity`;
15. `population-distribution-change-migration-and-urbanization`.

There are zero not-represented groups in this sample. That sample-level representation is not an official exact-grade allocation or annual-sequence claim.

## Practical, map, data and assessment gaps

The route provides strong map, coordinate, scale, plate, relief and population-data evidence, but several teacher-plan products remain partial. Compass and orientation pages do not include a complete outdoor protocol and rubric. Plan construction lacks the full step-pair workflow and group-assessment artifact. Rock explanations do not supply a hands-on specimen observation protocol. Real-time earthquake-map group work is not registered as a complete activity. Several concept maps, contour-map products and self-assessment rubrics require independent authoring.

Section-level revision pages support cartography, geology, relief and population review, but they do not prove the complete teacher control works, external olympiad sets, or annual Grade 7 review described by the plan. `population-diagram-et-practice` is used only for the explicit diagram/data row. Its roles remain exactly `practice_et` and `data_interpretation`; it is not treated as GIS, digital-map, map-skill, or `visual_or_map` evidence.

## Programme and completeness boundaries

All five books remain `programme_type: unknown`, with individually ambiguous committed evidence and `eligible_for_ordinary_course: false`. The crosswalk records content fit only. It does not promote `unknown` to `ordinary`, `ambiguous` to `verified`, or `unverified` to `eligible`.

The extraction now has `route_context.mapping_status: partial` because all 35 source records have been classified, while `canonical_opiq_mapping_complete` remains `false`. Grade 5 and Grade 6 extraction statuses remain `partial`; Grade 7 science remains `deferred`.

This PR creates no official curriculum map, annual architecture, annual sequence, lesson plan, teacher pack, independently authored bridge, or default-course selection. It makes no official-curriculum completeness claim, official exact-grade allocation claim, live-catalogue claim, or ordinary-course eligibility claim.
