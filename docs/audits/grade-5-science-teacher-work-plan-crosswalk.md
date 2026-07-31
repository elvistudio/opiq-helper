# Grade 5 science teacher work-plan crosswalk audit

Status: 67/67 source lesson ranges classified; canonical Opiq mapping remains incomplete.

## Scope and evidence

This audit covers the supplementary extraction at `evaluations/teacher-work-plans/grade-5-science-extraction.json`, derived from `project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-5-klassile.pdf`. The unchanged source PDF has SHA-256 `fd7593800bbc0bada390e98f92f7c45dcf21c0e09a780d407f45fb7e921e9c90`, contains 25 pages, and produced 67 normalized lesson-range records spanning lessons 1–70.

The crosswalk is locked to route `grade-5-science` and only reads:

- canonical Markdown: `project-files/outputs/opiq_5klass_loodusopetus.md`;
- source archive: `project-files/inputs/final-zips/opiq_opiq_loodusopetus_5_klassile_2024_opiq_v2.zip`;
- QA snapshot: `project-files/outputs/opiq_5klass_loodusopetus_qa.json`;
- manifest record count: 316 canonical page records;
- route coverage status: `available_not_curriculum_verified`.

No live Opiq catalogue, adjacent grade, Grade 7 geography route, or other Grade 5 subject was searched. The teacher work plan remains `supplementary_teacher_work_plan` and noncanonical.

## Mapping results

Every extraction range has exactly one entry in `curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml`; source ranges were not split into artificial lessons.

| Coverage status | Count |
| --- | ---: |
| `matched` | 7 |
| `partial` | 57 |
| `missing` | 3 |
| `ambiguous` | 0 |
| `outside_route` | 0 |
| **Total** | **67** |

Thirty mappings have Russian Opiq page evidence, 60 have Estonian Opiq page evidence, and 60 declare a required independently authored bridge, practical, assessment, or teacher review. These language counts overlap when a mapping uses both Russian and Estonian evidence.

Representative verified direct URLs include:

- Russian river explanation: `https://www.opiq.ee/kit/17/chapter/755`;
- Russian river-flow explanation: `https://www.opiq.ee/kit/17/chapter/757`;
- Estonian freshwater-community explanation: `https://www.opiq.ee/kit/525/chapter/29229`;
- Russian aquatic-animal adaptations: `https://www.opiq.ee/kit/17/chapter/762`;
- Russian water-states explanation: `https://www.opiq.ee/kit/17/chapter/748`;
- Russian thermal-expansion evidence: `https://www.opiq.ee/kit/17/chapter/750`;
- Estonian water-treatment practical evidence: `https://www.opiq.ee/kit/122/chapter/6295`;
- Estonian settlement-biota evidence: `https://www.opiq.ee/kit/122/chapter/6304`;
- Estonian relief-formation evidence: `https://www.opiq.ee/kit/122/chapter/6312`;
- Estonian bog-protection evidence: `https://www.opiq.ee/kit/122/chapter/6320`.

## Topic inventory comparison

The existing Grade 5 inventory has ten stable topic groups. Seven are represented in this supplementary teacher-plan sample:

- `rivers-and-lakes`;
- `freshwater-ecosystems`;
- `water-properties-and-states`;
- `water-use-protection-and-cycle`;
- `settlements`;
- `landforms-and-map-reading`;
- `bog-ecosystem`.

Three are not represented in this supplementary teacher-plan sample:

- `air-properties-and-protection`;
- `weather-and-climate`;
- `baltic-sea`.

Their absence from this sample is not evidence that they are missing from the official Grade 5 curriculum.

The topic inventory was minimally extended with 29 verified ordinary-programme alternative records from the same exact `grade-5-science` Markdown route: five river-and-lake pages, six freshwater-ecosystem pages, three water-properties pages, five settlement pages, five landform pages, and five bog pages. These pages were already present in the committed canonical route but absent from the deduplicated inventory. No topic ID, selected record, rejected record, source recommendation, or curated annual order was changed; the alternatives were added only where their headings or tasks provide evidence needed by specific teacher-plan rows.

## Evidence and programme rules

Positive matches use ordinary-programme records by default. Supplementary or teacher-support material cannot replace ordinary core content. Simplified-curriculum records remain explicit rejected evidence and were not silently selected. The cover-only Russian Koolibri book has no canonical page records and cannot supply page-level evidence.

`matched` is reserved for full normalized-topic coverage supported by explicit canonical headings, tasks, or instructional evidence. General keyword overlap is insufficient. Practical work, fieldwork, local context, revision, and assessment gaps remain `partial` or `missing`; this pull request records bridge requirements but creates no bridge content.

The existing known-topic cases were used only as additional routing and presence guards:

- `grade-5-science-living-nature` confirms one Grade 5 route anchor and a Grade 6 absence boundary;
- `grade-6-science-bog-conditions` protects the reverse Grade 6-to-Grade 5 boundary;
- `grade-5-science-curriculum-not-verified` preserves the manifest limitation.

These regressions are not a curriculum map and do not promote any source range to `matched` automatically.

## Completeness and extraction status

The Grade 5 extraction now has `route_context.mapping_status: partial`, while `canonical_opiq_mapping_complete` remains `false`. Grade 6 science, Grade 7 geography, and Grade 7 science extraction artifacts remain byte-identical and keep `mapping_status: deferred`.

The crosswalk is complete only for classification of the 67 extracted lesson ranges. It does not claim that:

- the canonical Opiq mapping is complete;
- the official curriculum is complete;
- the school-stage outcomes establish an official exact Grade 5 allocation;
- the live Opiq catalogue was checked or is complete.
