# Grade 7 science teacher work-plan crosswalk audit

Status: all extracted source records classified against the exact committed route; canonical completeness, programme eligibility, and official curriculum completeness remain unverified.

## Source and route boundary

This audit maps the supplementary Grade 7 science (`loodusõpetus`) teacher-plan extraction `grade-7-science-teacher-work-plan-extraction` only to manifest route `grade-7-science`. The canonical Markdown is `project-files/outputs/opiq_7klass_loodusopetus.md`, with 314 registered pages in Estonian and Russian. No Grade 7 geography, adjacent-grade, external-textbook, live-catalogue, or teacher-plan external-link evidence is used.

The unchanged source PDF is `project-files/inputs/originals/teacher-work-plans/Opetaja-tookava-Loodusopetus-7-klass.pdf`, SHA-256 `fb883aaf6429af4b543def1eb18deca3909ec541b4eaa5eccc7efb880368f35f`, 17 pages. It remains `supplementary_teacher_work_plan` and noncanonical. The extraction preserves 58 numbered ranges covering lessons 1-70 and one separate unnumbered row, so the crosswalk classifies 59/59 source records without inventing an annual hour.

## Preserved source structure

The four source blocks and numbered spans remain exact:

| Source block | Numbered span | Mapping records |
| --- | ---: | ---: |
| `inimene-uurib-loodust` | 1-19 | 14 |
| `ainete-ja-kehade-mitmekesisus` | 20-34 | 13 |
| `loodusnahtused` | 35-52 | 18 |
| `elusa-ja-eluta-looduse-seosed` | 53-70 | 13 |
| **Total** | **1-70** | **58** |

The medium-confidence normalized block ID `loodusnahtused` is retained. Multi-ranges 4-5, 9-10, 11-12, 16-17, 18-19, 26-27, 31-32, and 65-70 remain unsplit. In particular, 65-70 remains one heterogeneous source row for field trips, quizzes, unfinished work, and reserve time; it is `ambiguous`, requires teacher review, and is not converted into six invented topics.

The page-6 row `inimene-uurib-loodust-wrap-up` remains a separate `unnumbered_source_row` between lessons 19 and 20. It has no `lesson_start` or `lesson_end` and does not count toward the declared 70 hours. Section-level measurement assessment evidence is only supporting: workbook or portfolio submission and teacher-held criteria remain an assessment gap, so the row is `partial` and requires an independently authored assessment.

## Mapping accounting

The computed classification across all 59 records is:

| Status | Count |
| --- | ---: |
| `matched` | 12 |
| `partial` | 44 |
| `missing` | 2 |
| `ambiguous` | 1 |
| `outside_route` | 0 |
| **Total** | **59** |

There are 104 positive page matches. Forty-four mappings have Russian evidence, 49 have Estonian evidence, and 47 require a bridge or teacher review. Language counts overlap. All 19 inventory topics are represented by at least one source mapping; none is classified as not represented in this supplementary sample. Every positive match comes from a selected or alternative inventory record and retains `programme_type: unknown`, ambiguous programme evidence, and unverified default-course eligibility. The ordinary-programme verified match count is zero.

Representative direct exact-route evidence includes:

- scientific method: `https://www.opiq.ee/kit/546/chapter/30109`;
- measurement uncertainty: `https://www.opiq.ee/kit/64/chapter/3060`;
- plan construction: `https://www.opiq.ee/kit/100/chapter/4879`;
- density: `https://www.opiq.ee/kit/336/chapter/18892`;
- mixture separation: `https://www.opiq.ee/kit/546/chapter/30782`;
- speed determination: `https://www.opiq.ee/kit/100/chapter/4892`;
- chemical experiments: `https://www.opiq.ee/kit/100/chapter/4928`;
- carbon cycle: `https://www.opiq.ee/kit/44/chapter/2091`;
- greenhouse model: `https://www.opiq.ee/kit/100/chapter/6931`;
- ecological footprint: `https://www.opiq.ee/kit/336/chapter/18942`.

## Evidence decisions and gaps

Lesson 14 retains the contextual normalization `Ühikute teisendamise kontroll ja kordamine`, page 5, and medium confidence. General measurement evidence does not prove the source control work, so it remains partial with an assessment gap.

Lesson 33 remains one alternative row: `Veepuhastusjaama õppekäik või kromatograafia`. A registered water-purification page supports one branch, but there is no exact field-trip protocol and the inventory explicitly lacks registered chromatography evidence. Grade 6 water evidence is not used. Lesson 34 is therefore missing exact evidence for a chromatography exhibition and review.

Experiments, measurements, learner-created models, graph products, revision, and assessment are not promoted from a broad title alone. Exact conceptual or experiment pages do not automatically prove a complete equipment list, safety protocol, control/repeat design, observation table, learner product, or teacher rubric. Quadrat fieldwork at lesson 54 remains missing; long-term growth, physical greenhouse modeling, specimen work, plan assessment, presentations, control work, and portfolio evaluation remain partial where only supporting content exists.

The committed inventory records explicit oral Estonian support for zero pages. Consequently no match uses `oral_language_support` or `oral_answer_et`; presentation, defence, poster, and group-report requirements remain documented gaps.

## Completeness boundary

The extraction mapping status changes from `deferred` to `partial` because 58/58 numbered ranges and 1/1 unnumbered row are now classified. `canonical_opiq_mapping_complete` and `official_curriculum_complete` remain false. The crosswalk creates no official curriculum map, annual architecture, annual sequence, lesson plan, teacher pack, default-course selection, independently authored practical or assessment artifact, live-catalogue verification, or exact-grade official allocation claim.
