# Grade 6 science route evidence inventory audit

## Scope and conclusion

This audit establishes a route-specific evidence registry for Russian-primary, Estonian-supported Grade 6 science (`loodusõpetus`). It does not create a teacher-work-plan crosswalk, an annual sequence, or an official curriculum map.

The exact canonical route is:

- source ID: `grade-6-science`
- canonical Markdown: `project-files/outputs/opiq_6klass_loodusopetus.md`
- source archive: `project-files/inputs/final-zips/opiq_6klass_elutingimused_soos_v2.zip`
- QA snapshot: `project-files/outputs/opiq_6klass_loodusopetus_qa.json`
- manifest status: `available_not_curriculum_verified`
- supported route languages: Estonian and Russian

No Grade 5, Grade 7, other-subject Grade 6, adjacent-grade, or live-catalogue page was used as fallback evidence. The canonical Markdown, QA snapshot, ZIP, and source manifest were read but not modified.

## Source and canonical accounting

All 442 `opiq_lookup.jsonl` records in the committed ZIP were audited. Six records are captured `/Kit/Details/` cover/detail records—one for each kit—and are excluded from the canonical page registry. The remaining 436 records have an exact one-to-one URL match with the 436 canonical Markdown pages.

The checks found:

- 442 source records;
- 436 canonical pages;
- 6 excluded cover/detail records;
- 6 source books, all with canonical page records;
- 283 Estonian pages and 153 Russian pages;
- no duplicate source URL and no duplicate canonical URL;
- no missing or additional canonical URL relative to the non-cover archive records;
- matching Book ID, normalized title, language, and URL between every non-cover archive record and its canonical Markdown record;
- canonical class `6` and canonical subject `science` / `loodusõpetus` for all 436 pages.

The two Russian book summaries in the compact archive index retain legacy grade-5 labels. This is the source limitation already reflected by the manifest note that the archive contains Grade 5 and Grade 6 metadata. The captured kit titles identify Grade 6 books, and the QA-normalized canonical Markdown records are all class 6. The inventory does not rewrite or conceal the archive anomaly.

QA checksum metadata was verified against the files:

- archive SHA-256: `aa028590adc19ae5c1823a4b9bbb5eeaaba092f596a400c646972d99c398ed72`;
- Markdown SHA-256: `14c26e7227079f4d3af38f1b7d01b95fad708821a14c75deeb7d6e3eaf97f0a5`.

## Book inventory

| Book ID | Kit | Publisher | Language | Source | Canonical |
| --- | ---: | --- | --- | ---: | ---: |
| `5k_loodusõpetus_avita_2025_est` | 572 | Avita | ET | 57 | 56 |
| `5k_loodusõpetus_avita_est` | 8 | Avita | ET | 70 | 69 |
| `5k_loodusõpetus_koolibri_2025_est` | 580 | Koolibri | ET | 74 | 73 |
| `5k_loodusõpetus_koolibri_est` | 98 | Koolibri | ET | 86 | 85 |
| `5k_loodusõpetus_avita_rus` | 18 | Avita | RU | 68 | 67 |
| `5k_loodusõpetus_koolibri_rus` | 269 | Koolibri | RU | 87 | 86 |
| **Total** |  |  |  | **442** | **436** |

Each source count includes one captured Kit Details record. Each canonical count excludes that record.

### Programme-type evidence

Programme type is `unknown` for all six books, and each book has its own `ambiguous` evidence statement dated `2026-08-01`. The committed archive records, canonical page records, and captured Kit Details records do not explicitly declare ordinary or simplified curriculum status. The classification is not inferred from Book ID, filename, title, publisher, language, or the Grade 6 label. No live catalogue check was performed.

Consequently, `eligible_for_ordinary_course` is `false` for every book. This is an evidence-registry selection, not authorization for default ordinary-course use. The explicit simplified-material policy remains:

- default course use: forbidden;
- explicit learner-specific opt-in required.

The existence of this policy does not assert that any of the six route books is simplified-curriculum material.

Publisher sequence is recorded separately from official allocation. A publisher's Grade 6 title is not treated as proof that an outcome is officially assigned to exactly Grade 6.

## Topic-group decisions

All 436 canonical pages were reviewed as route evidence. The eight supplementary teacher-plan blocks were used as terminology and coverage controls, not as a required inventory shape. Eleven stable topic groups were retained:

1. `landforms-and-earth-materials`
2. `soil-formation-and-properties`
3. `garden-and-field-ecosystems`
4. `settlement-ecosystem`
5. `forest-ecosystem`
6. `bog-ecosystem`
7. `air-properties-and-weather`
8. `baltic-sea-ecosystem`
9. `estonian-habitats`
10. `estonian-natural-resources`
11. `nature-and-environmental-protection`

Three groups extend beyond the eight plan umbrellas because the route contains substantial, standalone canonical evidence:

- `landforms-and-earth-materials` has paired Russian/Estonian chapters, map work, and revision pages;
- `settlement-ecosystem` has a complete Avita publisher block with maps, urban conditions, organisms, green space, and review;
- `bog-ecosystem` has an independent Avita block in both languages and a current Estonian sequence including restoration and protected areas.

The plan's eight themes were not forced into an exact one-to-one structure. Closely overlapping publisher editions were deduplicated by instructional role instead of creating one topic per page or selecting multiple near-identical core explanations.

The resulting registry contains:

- 57 selected records;
- 11 useful alternative records;
- 11 explicitly rejected duplicate-role records;
- 79 globally unique `record_id` values and 79 globally unique canonical URLs.

All 11 topic groups have at least one direct Russian core-explanation record and at least one Estonian terminology, source, visual, practice, or fieldwork record. There are no Estonian-only topic groups in this registry. This language accounting describes selected evidence only; it is not a completeness claim.

## Deduplication and instructional roles

Selection follows a role split:

1. a direct Russian page supplies the primary explanation when available;
2. a current Estonian page supplies terminology, visuals, maps, or a distinct evidence perspective;
3. practical, fieldwork, data-interpretation, revision, or assessment pages are retained only when they add a separate role;
4. overlapping older-edition pages become alternatives or rejected duplicate-role records.

Publication year alone was not used as a quality ranking. An older page remains selected where it is the only exact-route evidence with a needed role—for example, the Estonian `Elukeskkonnad Eestis` umbrella in kit 98.

## Practical, fieldwork, revision, and assessment gaps

The registry identifies direct evidence for:

- `mullakaeve` and movement of water through soil;
- garden/field community comparison and biological versus chemical control;
- urban green-space observation and settlement map work;
- forest use and protection;
- bog development, restoration, and protected areas;
- air-property experiments, weather observation, humidity, and precipitation measurement;
- Baltic Sea location, living conditions, biota, and protection;
- habitat comparison, food relations, and nature-diary observation;
- natural-resource use, mining impacts, protected areas, pollution, and human-impact cases;
- revision pages in every topic group and assessment-like checks in selected role sets.

Known limitations remain explicit:

- no title-level evidence confirms a separate soil-air experiment;
- no page title confirms construction of a garden or field plan;
- forest observation and Baltic coast fieldwork are only partially evidenced;
- summary/review pages support formative checking but do not by themselves prove a complete formal assessment instrument;
- practical and assessment roles are inventory classifications, not lesson-level mappings.

## Relationship to the supplementary teacher work plan

`evaluations/teacher-work-plans/grade-6-science-extraction.json` remains `mapping_status: deferred`. Its eight blocks, 101 lesson-range records, 1–105 coverage, and unassigned annual slot for lesson 105 were used only to check terminology, possible topic groupings, and future practical/assessment needs.

The teacher plan is supplementary pedagogical evidence. It is not canonical Opiq evidence, cannot create a URL, cannot substitute for a missing canonical page, cannot determine programme type, and cannot prove official-curriculum completeness or exact-grade allocation. No lesson-level crosswalk is created in this PR.

## Route boundaries and regression evidence

The existing `grade-6-science-bog-conditions` known-topic regression is used only as a representative route-boundary check for the bog evidence. It does not prove complete bog coverage, complete topic-inventory coverage, official Grade 6 allocation, or the presence of every practical activity.

The curriculum validator now uses registered course-route contracts. Grade 6 inventory artifacts must remain at their exact repository paths and point to the exact manifest route, Markdown, ZIP, and QA files. Unknown course routes and misplaced artifacts fail closed. Canonical page references must resolve exactly once and match Book ID, title, language, class, and subject. Grade 5 validation remains enabled with its existing artifacts unchanged.

## Claims deliberately not made

This inventory is partial and is only an evidence registry. It makes:

- no official-curriculum completeness claim;
- no live Opiq catalogue completeness claim;
- no official exact-Grade-6 allocation claim;
- no final annual sequence claim;
- no claim that the teacher work plan is canonical;
- no claim that publisher sequence is official allocation.

The next, separate PR may map all 101 teacher-plan extraction records—including the unassigned annual slot for lesson 105—to these stable `topic_id`, `record_id`, and direct Grade 6 canonical URLs.
