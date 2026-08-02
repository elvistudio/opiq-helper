# Grade 6 science teacher work-plan crosswalk audit

Status: 101/101 source records classified; canonical Opiq mapping, programme-type verification, and default-course selection remain incomplete.

## Scope and evidence

This audit covers the supplementary extraction at `evaluations/teacher-work-plans/grade-6-science-extraction.json`, derived from `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf`. The unchanged Estonian source PDF has SHA-256 `2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762`, contains 31 pages, and produced 101 ordered source records spanning lessons 1–105.

The crosswalk is locked to the exact `grade-6-science` route and reads only:

- canonical Markdown: `project-files/outputs/opiq_6klass_loodusopetus.md`;
- source archive: `project-files/inputs/final-zips/opiq_6klass_elutingimused_soos_v2.zip`;
- QA snapshot: `project-files/outputs/opiq_6klass_loodusopetus_qa.json`;
- 436 canonical page records in Estonian and Russian;
- the 11 stable groups and 80 registered records: 57 selected, 12 alternative, and 11 rejected records in `curriculum-maps/grade-6-science/topic-inventory.yaml`.

No Grade 5, Grade 7, other-subject Grade 6, adjacent-grade, external, or live-catalogue page was used. The teacher plan remains `supplementary_teacher_work_plan` and noncanonical.

## Source-record accounting

The 101 mappings preserve every extraction object as one unit: 100 ordinary `lesson_range` records and one `unassigned_annual_slot`. Ranges `3–4`, `76–77`, `98–99`, and `102–103` remain unsplit. The eight source blocks are:

1. `muld`;
2. `aed-ja-pold-elukeskkonnana`;
3. `mets-elukeskkonnana`;
4. `ohk`;
5. `laanemeri-elukeskkonnana`;
6. `elukeskkonnad-eestis`;
7. `eesti-loodusvarad`;
8. `loodus-ja-keskkonnakaitse-eestis`.

Lesson 105 is retained exactly as the source's unassigned annual slot. It has a null block, no invented normalized teaching topic, no topic-inventory reference, and no Opiq URL. It is classified `ambiguous`, low-confidence, pending teacher review, and is not assigned to either ÕHK or LÄÄNEMERI.

## Mapping results

| Coverage status | Count |
| --- | ---: |
| `matched` | 41 |
| `partial` | 49 |
| `missing` | 10 |
| `ambiguous` | 1 |
| `outside_route` | 0 |
| **Total** | **101** |

Fifty mappings use at least one Russian canonical page, 59 use at least one Estonian canonical page, and 60 require an independently authored bridge, practical or assessment resource, or teacher review. These language counts overlap. The mappings contain 116 positive page matches; all 116 retain `programme_type: unknown`, `programme_type_evidence_status: ambiguous`, and `default_course_eligibility: unverified`. The verified ordinary-programme match count is zero.

`matched` means only that committed canonical titles, headings, or tasks cover the normalized content scope of a source row. It does not mean that the book is eligible for an ordinary programme, that the page may be selected for a default course, or that a production lesson is ready. Practical work, fieldwork, measurement, assessment, and local-case rows remain `partial` or `missing` whenever the registered page evidence does not cover the complete requested activity.

The annual-review row `lesson-104` is not fully covered by a section-level `Kokkuvõte`. Page `https://www.opiq.ee/kit/98/chapter/4803` is retained only as supporting revision and assessment evidence for the nature-and-environmental-protection sequence; an independently authored annual-review assessment is still required. This narrower classification does not change programme-type ambiguity or default-course eligibility.

Representative direct exact-route URLs include:

- soil pit and field evidence: `https://www.opiq.ee/kit/580/chapter/32155`;
- direct Russian soil-composition evidence: `https://www.opiq.ee/kit/269/chapter/15287`;
- forest-community evidence: `https://www.opiq.ee/kit/580/chapter/32171`;
- air-properties experiment evidence: `https://www.opiq.ee/kit/580/chapter/32184`;
- precipitation measurement evidence: `https://www.opiq.ee/kit/580/chapter/32190`;
- Baltic Sea map evidence: `https://www.opiq.ee/kit/580/chapter/33052`;
- Russian Baltic Sea conditions evidence: `https://www.opiq.ee/kit/269/chapter/15339`;
- Estonian natural-resources map evidence: `https://www.opiq.ee/kit/580/chapter/33064`;
- protected-areas evidence: `https://www.opiq.ee/kit/580/chapter/33072`.

## Topic inventory comparison

Nine of the 11 inventory groups are represented by explicit source rows:

- `landforms-and-earth-materials`;
- `soil-formation-and-properties`;
- `garden-and-field-ecosystems`;
- `forest-ecosystem`;
- `air-properties-and-weather`;
- `baltic-sea-ecosystem`;
- `estonian-habitats`;
- `estonian-natural-resources`;
- `nature-and-environmental-protection`.

Two groups are not represented in this supplementary teacher-plan sample:

- `settlement-ecosystem`;
- `bog-ecosystem`.

That sample-level absence is not a statement that either topic is missing from the Grade 6 curriculum. Lesson 105 does not represent any topic group. The Grade 6 topic inventory was minimally extended with the single alternative record `protection-et-review-legacy` for section-level revision evidence. No topic ID was added, and the selected, rejected, and recommendation sets remain unchanged.

## Programme evidence and limitations

All six route books still have `programme_type: unknown`, individually `ambiguous` programme-type evidence, and `eligible_for_ordinary_course: false`. The crosswalk validates each match against both inventories and deliberately separates content fit from course eligibility. It makes no ordinary-programme or default-course claim, and a future promotion to `ordinary`, `verified`, or `eligible` requires new committed evidence and review.

The most important remaining evidence gaps concern soil organisms, photosynthesis, wood processing, air composition, the water cycle, water-versus-air habitat comparison, Baltic fish and coastal-bird identification, local fieldwork protocols, learner research workflows, and some formal assessment activities. This PR records bridge requirements but creates no independently authored bridges.

## Status boundaries

The Grade 6 extraction now has `route_context.mapping_status: partial`, while `canonical_opiq_mapping_complete` remains `false`. The Grade 5 extraction remains `partial`; Grade 7 geography and Grade 7 science remain `deferred`.

The crosswalk is complete only for classifying all 101 records from this source extraction. It creates no official curriculum map, annual architecture, annual sequence, lesson plan, teacher pack, or official exact-grade allocation. It does not claim official-curriculum completeness, default-course eligibility, production readiness, or live Opiq catalogue completeness.
