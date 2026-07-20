# Bilingual lesson, thematic-plan, and annual-course formats

## Purpose

The teaching-plan formats turn verified curriculum evidence and selected canonical Opiq pages into practical materials for Russian-speaking pupils learning school subjects in Estonia. The production pilot is grade 5 `loodusõpetus`; the schemas and language-profile defaults are reusable for grade 6 `loodusõpetus` and grade 7 `geograafia`.

The documented model is a teaching design, not a claim that a particular technique guarantees learning outcomes.

## Artifacts

| Artifact | Schema | Production example | Purpose |
| --- | --- | --- | --- |
| Single lesson | `schemas/lesson-plan.schema.json` | `lesson-plans/grade-5-science/water/lesson-03.yaml` | Timed teaching, language path, materials, practical work, and separate assessment |
| Thematic plan | `schemas/thematic-plan.schema.json` | `lesson-plans/grade-5-science/water/thematic-plan.yaml` | Four-lesson order, vocabulary recycling, scaffold progression, and unit checks |
| Annual course | `schemas/annual-course.schema.json` | `annual-courses/grade-5-science/excerpt.yaml` | Ordered units, progression calendars, coverage, and explicit gaps |
| Language defaults | `schemas/language-profiles.schema.json` | `lesson-plans/language-profiles.yaml` | Reusable grade/subject defaults with justified learner-specific overrides |

All schemas are strict. Unknown fields fail validation. Shared teaching vocabulary lives in `schemas/teaching-plan-common.schema.json`; canonical routes, Opiq records, instructional roles, and provenance reuse the definitions and validation infrastructure introduced by the curriculum-map implementation.

## Methodology model

Every lesson uses:

```yaml
instruction_language: ru
subject_support_language: et
methodology:
  model: russian_primary_estonian_supported
```

Russian carries complex subject explanation and the full expected subject answer. Estonian is a planned subject-support language, not an uncontrolled switch and not full immersion. Lower Estonian production does not automatically reduce the subject objective.

Every lesson structurally selects all eight project approaches:

1. `content_language_dual_objectives`: separate observable subject and Estonian-language objectives.
2. `planned_translanguaging`: an ordered path from prior knowledge and Russian concept formation to Estonian terms, supported work, a full Russian answer, and short Estonian output.
3. `gradual_scaffolding`: each scaffold links to stages and records where it is reduced.
4. `pluriliteracies`: selected language functions such as naming, classifying, sequencing, explaining, and concluding match the task.
5. `multimodal_support`: objects, diagrams, tables, demonstrations, and measurements anchor meaning.
6. `vocabulary_recycling`: new terms and instruction verbs are distinct from recycled items and have explicit reuse.
7. `cognitive_load_control`: simultaneous novelty is counted and checked against a profile threshold.
8. `separate_content_language_assessment`: subject understanding and Estonian production produce separate evidence.

Vague objectives such as “improve Estonian” are invalid. A language objective declares an output type and minimum quantity—for example, follow two familiar instructions, label three states, or give one short oral answer.

## Planned language path and scaffold release

A typical lesson path is:

1. activate prior knowledge;
2. establish the concept in Russian;
3. attach an Estonian term to a known concept, object, or diagram;
4. model a short Estonian sentence;
5. complete a supported Estonian task;
6. give the full subject answer in Russian;
7. give a short oral answer in Estonian;
8. recycle the same language later.

Another sequence is valid when it is explicitly justified. Each path step references a real lesson stage, and every stage introducing new language must reference at least one scaffold.

The normal release is:

```yaml
scaffold_release:
  introduction: full_support
  guided_practice: partial_support
  final_output: short_independent_output
```

Russian explanation, bilingual glossaries, visuals, modelling, worked examples, sentence frames, word banks, partner rehearsal, model answers, partially completed tables, and reduced-choice tasks are supported. A global, unlinked scaffold list is not valid.

## Vocabulary reuse semantics

Vocabulary planning distinguishes three time scales. In a lesson’s `new_terms_et`, `first_use_stage` records the first introduction and `reuse_stage_refs` records later practice stages in that same lesson. This within-lesson practice is useful, but it is not thematic-plan recycling.

In a thematic plan, `cumulative_glossary[].recycled_in_lessons` may name only linked lessons that occur strictly after `introduced_in_lesson`. Each named lesson must list the term in its own `recycled_terms_et`; another occurrence in `new_terms_et` is a duplicate introduction, not recycling. The field is required, but `recycled_in_lessons: []` is valid when the short unit has no suitable later use. The validator deterministically warns once for every cumulative glossary term with an empty list.

Recycling in a later thematic unit is planned separately through the annual course’s `planned_vocabulary_recycling_intervals`; it does not retroactively satisfy the thematic-plan field.

## Language profiles and cognitive load

`lesson-plans/language-profiles.yaml` contains defaults rather than fixed learner facts:

- grade 5 science, A1–A2: terms, labels, familiar instructions, simple definitions, frames, and one- or two-sentence oral answers;
- grade 6 science, A2: definitions, comparisons, process sequences, cause/result, and supported three-to-five-sentence responses where appropriate;
- grade 7 geography, A2–B1: map terminology, directions, coordinates, scale, landforms, data description, comparisons, and short reasoned answers.

The initial warning thresholds are configurable per profile:

| Profile | New terms | New instruction verbs | New sentence structures | Independent sentences |
| --- | ---: | ---: | ---: | ---: |
| Grade 5 science | 5 | 2 | 2 | 2 |
| Grade 6 science | 6 | 2 | 3 | 3 |
| Grade 7 geography | 7 | 3 | 3 | 4 |

Exceeding a threshold is a warning, not an automatic error. A lesson after position 1 with no `recycled_terms_et`, a cumulative glossary term with no later-lesson recycling, no independent Estonian output, and no scaffold release are also warnings. Structural contradictions, unknown references, unsafe omissions, and unsupported source claims remain errors.

## Evidence, roles, and provenance

Every production Opiq reference resolves through the artifact’s canonical route and is checked against the registered Markdown, archive, QA snapshot, and book inventory. Validation compares URL, Book ID, title, language, grade, subject, programme type, and source ownership. A lesson source must also be selected in the linked merged curriculum-map unit.

Instructional roles reuse the curriculum model, including `core_explanation_ru`, `core_source_et`, `terminology_et`, `definition_et`, `bilingual_visual`, `experiment`, `revision`, `assessment`, and `oral_answer_et`.

Supported provenance categories are:

- `official_curriculum`;
- `opiq_textbook`, `opiq_supplementary`, `opiq_teacher_support`, `opiq_simplified_curriculum`;
- `author_created_explanation`, `author_created_bridge`, `author_created_worksheet`, `author_created_assessment`.

Every stage resolves its material and provenance references. Author-created bridges are explicit and do not pretend to be Opiq text. Production artifacts use summaries, short task descriptions, labels, direct URLs, and source references rather than copying textbook passages.

Simplified-curriculum material is forbidden as a silent default. The lesson schema supports only an explicit learner-specific opt-in with authorisation and provenance. No production pilot lesson enables that option.

## Golden lesson excerpt

The complete golden lesson is `grade-5-water-03-melting-condensation`. It keeps warm water under teacher control and separates the two outputs:

```yaml
full_expected_answer_ru: >-
  Лёд получает тепло и плавится, переходя из твёрдого состояния в жидкое.
  Водяной пар у холодной поверхности отдаёт тепло и превращается в капли воды.
short_expected_oral_answer_et: Jää sulab; külmal pinnal veeaur veeldub.
```

Its language load introduces four terms (`sulamine`, `veeldumine`, `temperatuur`, `termomeeter`), recycles state vocabulary, reinforces familiar instructions, introduces `mõõda` and `kirjuta`, and ends with at most two short independent Estonian sentences.

The 45-minute stages total exactly 45 minutes. Any non-zero tolerance must be explicit, no larger than five minutes, and include a reason.

## Four-lesson thematic plan

The water thematic plan validates these lesson links:

```yaml
recommended_lesson_sequence:
  - {order: 1, lesson_id: grade-5-water-01-properties, duration_minutes: 45}
  - {order: 2, lesson_id: grade-5-water-02-states, duration_minutes: 45}
  - {order: 3, lesson_id: grade-5-water-03-melting-condensation, duration_minutes: 45}
  - {order: 4, lesson_id: grade-5-water-04-changes-review, duration_minutes: 45}
lesson_count: 4
expected_total_duration_minutes: 180
```

The validator compares order, count, duration, route, outcomes, selected sources, glossary coverage, lesson-by-lesson introduction and recycling, instruction verbs, sentence frames, scaffold release, practical work, revision, and assessment points. Both official outcomes remain `partial`: they are school-stage outcomes, and the water unit covers only part of their scope.

The production plan genuinely recycles `temperatuur` from lesson 3 in lesson 4. It intentionally reports five warnings for terms without a later lesson in this short unit: `lahus`, `termomeeter`, `jäätumine`, `aurustumine`, and `olekumuutus`. Their within-lesson `reuse_stage_refs` remain valid practice; later-unit recycling, where planned, belongs to the annual-course intervals.

## Annual-course excerpt

The annual schema is reusable, but issue #10 intentionally provides only a small excerpt. It places the water unit between the verified topic-inventory groups `rivers-and-lakes` and `water-use-protection-and-cycle`. The latter recycles `aurustumine` and `veeldumine` into the water-cycle context.

The excerpt distinguishes publisher order from the curated order, records audited source books and deduplication decisions, and has separate practical, revision, subject-assessment, and language-assessment calendars. It must remain:

```yaml
completeness:
  scope: small_annual_course_excerpt
  status: incomplete
  declared_complete: false
  deferred_to_issue: 18
```

Topic-inventory-only neighbours are not disguised as completed unit or lesson plans. Issue #18 will author and verify the complete grade-5 course.

## Creating and validating artifacts

Use the human-readable checklists in:

- `docs/templates/lesson-plan.md`;
- `docs/templates/thematic-plan.md`;
- `docs/templates/annual-course.md`.

For a new lesson:

1. Resolve grade, subject, and language through `source-manifest.json`.
2. Link a validated curriculum map and course map.
3. Select only canonical Opiq records already owned by that route.
4. Define separate observable content and language objectives.
5. Plan the language path, stage-linked scaffolds, release, terminology, and recycling.
6. Resolve every stage material and provenance reference.
7. Reconcile stage timing and keep content/language assessment separate.

For a thematic plan, link complete lesson artifacts, make the glossary and progression match those lessons exactly, and list only strictly later lessons in `recycled_in_lessons`. Use an explicit empty list when no suitable later lesson exists. For an annual plan, use verified topic IDs, link only existing thematic plans, distinguish publisher and curated sequences, and declare gaps honestly.

Run:

```sh
npm run test:plans
npm run check:plans
```

The focused test suite mutates the valid production repository to verify route ownership, schema strictness, objectives, language load, timing, cross-file links, programme type, provenance, assessment separation, school-stage scope, completeness, and warning thresholds.
