# Curriculum maps and bilingual course assembly

## Purpose and scope

The curriculum-map files provide a machine-readable bridge between official Estonian curriculum evidence, registered Opiq sources, and a curated bilingual course for Russian-speaking pupils. They do not replace `source-manifest.json`, the known-topic regression set, or a complete curriculum map.

The first pilot is in `curriculum-maps/grade-5-science/` and reads only the canonical `grade-5-science` route. It contains a source audit, a deduplicated topic inventory, and one complete thematic teaching example. It is not the annual grade-5 course tracked by issue #18.

## Four evidence layers

The model keeps four layers explicit.

1. **Official national curriculum.** `official-curriculum.yaml` records a primary Riigi Teataja document, the original Estonian outcome wording, a Russian translation, its official scope, and verification metadata. Official evidence uses `official_curriculum` provenance and is never inferred from a publisher book.
2. **Official grade or school-stage scope.** An outcome may use `official_exact_grade` only when the official source says so. The grade-5 pilot uses `official_school_stage`: the cited outcomes apply at the end of school stage II (grade 6), not specifically to grade 5.
3. **Publisher and Opiq evidence.** `book-inventory.yaml` records every book in the registered source archive, including language, publisher, programme type, publisher sequence, page availability, likely roles, and limitations. The publisher's grade label is `publisher_sequence`, not an official state allocation.
4. **Curated Opiq Helper course.** `topic-inventory.yaml` groups overlapping pages by topic. `golden-unit.yaml` chooses complementary records, removes redundant assignments, adds the bilingual learning layer, and records author-created bridges and assessments separately from Opiq evidence.

The schemas live in:

- `schemas/curriculum-map.schema.json` for official curriculum evidence;
- `schemas/course-map.schema.json` for book inventories, topic inventories, and thematic units.

Both schemas are strict: unknown fields fail validation.

Each canonical source route has one book inventory and one topic inventory, and may have one or
more thematic units. This grouping lets issues #19 and #20 add their own route-specific artifacts
without changing or combining the grade-5 source set.

## Several books in one coherent course

A course is assembled by instructional role, not by completing one textbook or every textbook. A record can have several roles, including:

- `core_explanation_ru` and `practice_ru` for subject comprehension in Russian;
- `core_source_et`, `terminology_et`, `definition_et`, `practice_et`, and `oral_answer_et` for gradual Estonian support;
- `bilingual_visual`, `experiment`, `fieldwork`, `map_skill`, and `digital_map` for specific modes of learning;
- `revision`, `assessment`, and `optional_extension` for course flow.

When books overlap, the topic inventory must either select one page by role or retain alternatives with clearly different roles. Rejected pages retain their canonical URL and a `rejection_reason`. This prevents a pupil from receiving the same explanation from several publishers merely because all versions are available.

Every selected Opiq record declares its canonical source ID, URL, Book ID, language, programme type, roles, provenance, and selection rationale. Validation resolves the source ID through `source-manifest.json`, reads only its declared Markdown index, and checks that the URL occurs exactly once with the expected grade, subject, title, Book ID, and language.

## Bilingual learning model

Course artifacts require:

```yaml
instruction_language: ru
subject_support_language: et
```

Russian carries the primary subject explanation so that content comprehension is not weakened. Each thematic unit also requires Estonian terminology with simple definitions, example sentences, common school instructions, a short Estonian task, full expected answers in Russian, and short ready oral answers in Estonian.

The progression values are reusable for the planned courses:

- grade 5: terms, instructions, and short sentences (`grade_5_terms_instructions_short_sentences`);
- grade 6: definitions, comparisons, and process descriptions (`grade_6_definitions_comparisons_processes`);
- grade 7: subject explanations, map language, and short reasoning (`grade_7_subject_explanations_map_language_reasoning`).

## Programme type and provenance

Programme type and provenance are separate but cross-checked.

Supported programme types are `ordinary`, `simplified_curriculum`, `supplementary`, `teacher_support`, and `unknown`. Opiq provenance distinguishes ordinary textbooks, supplementary material, teacher support, and simplified-curriculum material. Author-created content is labelled as an explanation, bridge, worksheet, or assessment.

Simplified-curriculum material is never a silent fallback for the ordinary course. The grade-5 source audit identifies kit 275 as simplified curriculum and marks it ineligible for default course selection. The validator rejects it from `selected_records`. Kit 172 is cover-only in the registered archive; it cannot be used as page-level evidence.

The export does not preserve a complete programme declaration. Each inventory entry therefore
records the direct registered kit URL and the date on which its programme metadata was checked;
this limitation is explicit rather than inferred from a Book ID substring.

## Coverage and completeness

Mapped evidence uses four statuses:

- `verified`: explicit official and course evidence exists for the declared scope;
- `partial`: only part of the declared outcome or topic is mapped;
- `missing`: required evidence is absent;
- `ambiguous`: available evidence does not support a reliable decision.

Grade allocation is recorded independently as `official_exact_grade`, `official_school_stage`, `publisher_sequence`, or `curated_course_sequence`. A publisher sequence cannot be relabelled as an official exact-grade requirement.

The thematic-unit completeness block partitions every required outcome into verified, partial, missing, or ambiguous IDs. A unit cannot declare itself complete while any required outcome is partial, missing, or ambiguous. The golden unit is pedagogically complete as an example, but its curriculum mapping is explicitly `partial` and `incomplete` because it covers only the water component of broader end-of-stage outcomes.

## Grade-5 source audit

The registered archive contains 322 source records across six books. The canonical Markdown contains 316 page records; six cover/detail records are excluded. Five books have page evidence. The Russian Koolibri book contributes only cover metadata.

The ordinary Avita and Koolibri books provide overlapping material on water, freshwater ecosystems, air, weather, and the Baltic Sea. Koolibri also provides settlement, relief/map, and bog pages, but those themes have no registered Russian page-level counterpart. The HARNO book is explicitly simplified curriculum and is audited without being promoted into the ordinary course.

`topic-inventory.yaml` records ten deduplicated thematic groups. It identifies the strongest available Russian explanation, Estonian terminology or visuals, practice, practical work, and assessment evidence for each group. The inventory is evidence for later assembly, not a final annual order.

## Golden bilingual unit excerpt

The golden pilot is **«Вода как вещество и состояния воды» / “Vesi kui aine ja vee olekud”**. It uses:

- Avita kit 17 for Russian explanations;
- current Avita kit 525 for Estonian terms and short tasks;
- Koolibri kit 122 for experiments, revision, and assessment prompts.

It rejects older duplicate explanations, a section-title-only page, and a simplified-curriculum page. A representative bilingual fragment is:

```yaml
term_et: sulamine
equivalent_ru: плавление
simple_definition_et: Sulamisel muutub tahke aine vedelaks.

prompt_et: "Pane kirja: mis juhtub jääga soojas ruumis ja mis olek tekib?"
full_expected_answer_ru: В тёплом помещении лёд получает тепло, плавится и превращается в жидкую воду.
short_oral_answer_et: Jää sulab ja muutub vedelaks veeks.
```

The official references come from the current consolidated `Põhikooli riiklik õppekava` and its [official appendix 4](https://www.riigiteataja.ee/aktilisa/1250/6202/5011/18m_pohi_lisa4.pdf). They are stored as school-stage outcomes and are not presented as official grade-5 allocation.

## Validation and tests

Install the locked dependencies and run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:curriculum
npm run check:curriculum
```

The validator checks JSON Schema constraints, manifest routing, registered paths, source languages, canonical URLs and metadata, book/programme consistency, provenance, roles, bilingual fields, official evidence, unique IDs, grade-allocation semantics, and completeness rules. Diagnostics include severity, file, field, and reason.

Tests use the production pilot as a valid baseline and mutate in-memory copies. They verify failures for missing bilingual fields, foreign URLs, wrong grade or subject, unknown books, missing provenance or roles, silent simplified-curriculum use, false official allocation, unsupported completeness, duplicate IDs, and cover-only page evidence. Invalid fixtures are not committed as production data.

## Adding a new map

1. Resolve one route in `source-manifest.json`; do not scan or combine adjacent grades.
2. Verify primary official evidence and record whether its scope is an exact grade or a school stage.
3. Audit every book in that route's registered archive, Markdown, and QA snapshot.
4. Assign programme types and provenance before selecting pages.
5. Build a deduplicated topic inventory with direct canonical URLs and explicit roles.
6. Add Russian-primary and Estonian-support teaching fields at the appropriate progression level.
7. Keep unknown or incomplete evidence `partial`, `missing`, or `ambiguous`.
8. Run the curriculum tests, production validator, existing regressions, QA checks, and manifest checker.

Issue #18 will assemble the full grade-5 science course on this schema. Issues #19 and #20 will apply the reusable model to grade-6 science and grade-7 geography. Those follow-ups must perform their own route-specific audits and official-evidence mapping; this pilot does not pre-authorize using their materials.
