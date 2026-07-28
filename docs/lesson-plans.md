# Bilingual lesson, thematic-plan, and annual-course formats

## Purpose

The teaching-plan formats turn verified curriculum evidence and selected canonical Opiq pages into practical materials for Russian-speaking pupils learning school subjects in Estonia. The production pilot is grade 5 `loodusõpetus`; the schemas and language-profile defaults are reusable for grade 6 `loodusõpetus` and grade 7 `geograafia`.

The documented model is a teaching design, not a claim that a particular technique guarantees learning outcomes.

## Artifacts

| Artifact | Schema | Production example | Purpose |
| --- | --- | --- | --- |
| Single lesson | `schemas/lesson-plan.schema.json` | `lesson-plans/grade-5-science/water/lesson-03.yaml` | Timed teaching, language path, materials, practical work, and separate assessment |
| Thematic plan | `schemas/thematic-plan.schema.json` | `lesson-plans/grade-5-science/water/thematic-plan.yaml` | Four-lesson order, vocabulary recycling, scaffold progression, and unit checks |
| Teacher pack | `schemas/teacher-pack.schema.json` | `teacher-packs/grade-5-science/water/materials-index.yaml` | Real teacher/student/parent files, answer keys, printability, and readiness checks |
| Annual course architecture | `schemas/annual-course.schema.json` | `annual-courses/grade-5-science/annual-architecture.yaml` | Complete unit skeleton, budgets, progression calendars, coverage, and explicit implementation gaps |
| Annual components | `schemas/annual-course-components.schema.json` | `annual-courses/grade-5-science/{source-selection-matrix,language-progression,teaching-calendars,implementation-roadmap}.yaml` | Auditable page choices, language progression, calendars, and phased implementation work |
| Topic synthesis | `schemas/topic-synthesis.schema.json` | `annual-courses/grade-5-science/annual-architecture.yaml` | Source evidence, transformation, Russian output, production readiness, and review status per topic |
| External registry | `schemas/external-source-registry.schema.json` | `external-sources/registry.yaml` | Optional verified non-Opiq supplements shared across courses |
| Language defaults | `schemas/language-profiles.schema.json` | `lesson-plans/language-profiles.yaml` | Reusable grade/subject defaults with justified learner-specific overrides |

All schemas are strict. Unknown fields fail validation. Shared teaching vocabulary lives in `schemas/teaching-plan-common.schema.json`; canonical routes, Opiq records, instructional roles, and provenance reuse the definitions and validation infrastructure introduced by the curriculum-map implementation.

Lesson schema 1.1, thematic schema 1.1, and teacher-pack schema 1.2 remain
valid legacy formats. Integrated lesson/thematic versions 1.2 and teacher-pack
version 1.3 require an explicit
`pedagogical_integration` contract. The lesson remains content authority;
selection input, generated lesson DNA, phase bindings, and content identity
describe delivery without inventing science content. See
[pedagogy generation integration](pedagogy-generation-integration.md).

Lesson and thematic version 1.3 and annual-course version 2.2 add the commercial
delivery contracts described below. They are additive: 1.1/1.2 lessons and
thematic plans and 2.1 annual courses retain their existing rules and still
require their legacy Opiq evidence.

## Standalone commercial delivery and optional Opiq companions

A version 1.3 lesson declares `delivery_model.core_mode:
standalone_commercial_core`, `opiq_required: false`, and
`customer_can_complete_without_opiq: true`. Its typed `commercial_core`
references author-material IDs for an explanation, worked example, task,
answer or bounded open-ended exemption, assessment, measurable learner output,
and success criteria. Procedural and computational tasks additionally reference
a separate worked solution. The validator inspects actual material types and
author-created provenance; a non-empty list alone is not sufficient.

`evidence_linkage.opiq_records` remains internal source-analysis evidence. In
1.3 it may be empty after the standalone core passes. `opiq_companions` is a
different, optional customer-delivery contract. Every companion resolves to the
linked course map and canonical route and records the kit/chapter coordinates,
role, access mode, check date/status, visibility, and an author-created
standalone fallback. Licensed links identify the licence type. Teacher-only,
unverified, unavailable, or teacher-support records remain internal.
Simplified-curriculum companions require an explicit learner-specific opt-in.
Opiq access never fills a missing core explanation, task, answer, or assessment.

The `originality_review` records a human review of wording, context, data,
question sequence, scaffolding, distractors, visuals, and answers. An approved
review is bound to the exact bytes of all covered author material through the
shared content-fingerprint contract. `publication_ready` and
`customer_released` require a current approved review covering every author
material. Internal source-analysis references are forbidden in customer files.
This is an auditable human gate, not automated plagiarism detection or a legal
permission to reproduce source content.

`family_overlay_hooks` expose stable stage, material, objective, and assessment
IDs without copying the lesson. Foundation participation is not Grade 2 or
Grade 4 mastery. Grade 2 and Grade 4 lanes require their own individual
evidence; a shared family product may supplement but never replace it. A lesson
with `family_overlay_supported: false` has no hooks.

Thematic 1.3 aggregates the exact unions of linked standalone lessons,
companions, and family hooks, and records whether linked originality reviews are
current. Annual 2.2 declares the accepted companion access modes, mandatory
fallbacks, teacher-only and simplified boundaries, originality gate, and family
individual-evidence policy. Internal annual `selected_source_books` remain
analysis and sequencing evidence, not customer dependencies.

Commercial publication status is deliberately separate from schema validity,
print readiness, teacher review, classroom/home trials, classroom/homeschool
readiness, and pedagogical effectiveness. The fixture set under
`test-fixtures/commercial-course-schema/` demonstrates contracts only; it does
not create Grade 2 or Grade 4 production content.

A minimal authoring relationship looks like this (the referenced materials and
criteria must also exist in the full lesson):

```yaml
delivery_model:
  core_mode: standalone_commercial_core
  opiq_required: false
  opiq_companion_policy: optional
  family_overlay_supported: false
  customer_can_complete_without_opiq: true
  publication_status: internal_review
commercial_core:
  explanation_material_ids: [author-explanation]
  worked_example_material_ids: [author-worked-example]
  task_material_ids: [author-task-set]
  expected_answer_material_ids: [author-expected-answers]
  worked_solution_material_ids: [author-worked-solution]
  assessment_material_ids: [author-assessment]
  assessment_criterion_ids: [criterion-subject]
  learner_output_refs: [question-independent-output]
  success_criteria_refs: [success-subject]
  task_contracts:
    - task_material_id: author-task-set
      response_mode: procedural
      open_ended: false
      expected_answer_material_ids: [author-expected-answers]
      worked_solution_material_ids: [author-worked-solution]
```

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

For annual topic preparation, `core_explanation_ru` describes the final pupil-facing explanation language, not necessarily the source-page language. The [topic-synthesis policy](topic-synthesis-policy.md) records whether a selected page contributes directly, through ET→RU translation or pedagogical adaptation, as one input to a multi-Opiq synthesis, or as an Estonian support layer. Source language, output language, transformation, production readiness, and review status are validated separately. No direct Russian page is required when a valid selected Estonian source supports a declared adaptation.

Supported provenance categories are:

- `official_curriculum`;
- `opiq_textbook`, `opiq_supplementary`, `opiq_teacher_support`, `opiq_simplified_curriculum`;
- `author_created_explanation`, `author_created_bridge`, `author_created_worksheet`, `author_created_assessment`;
- `author_created_worked_example`, `author_created_task_set`,
  `author_created_worked_solution`, `author_created_expected_answers`.

Every stage resolves its material and provenance references. Author-created bridges are explicit and do not pretend to be Opiq text. Production artifacts use summaries, short task descriptions, labels, direct URLs, and source references rather than copying textbook passages.

## Artifact readiness and resolved materials

Lesson schema 1.1 replaces the old binary `artifact_completeness` claim with independent `artifact_readiness` facts:

```yaml
artifact_readiness:
  schema_complete: true
  content_complete: true
  materials_resolved: true
  print_ready: true
  teacher_review:
    status: pending
  classroom_trial:
    status: not_tested
  classroom_ready: false
  readiness_status: teacher_pack_complete_pending_review
```

The meanings are intentionally non-equivalent: `schema complete` ≠ `content complete` ≠ `materials resolved` ≠ `print ready` ≠ `teacher reviewed` ≠ `classroom tested` ≠ `classroom ready`.

Every `author_material` declares a repository-relative `artifact_path`, audience, lower-case language list, printability, provenance, and an `answer_key_path` for worksheets/assessments unless an open creative task has an explicit exemption. Files must exist inside the repository. A student YAML plan or an Opiq URL is not a ready worksheet. Printable materials must be Markdown or HTML.

`materials_resolved: true` is rejected if a declared material or key is absent. `print_ready: true` is rejected if a required student file is not printable. The shared evidence schema plus `teacher-review`, `classroom-trial`, and `home-trial` schemas define three independent evidence records. Approved review requires a registered, completed record with role, date, mandatory scope, closed blocking/major findings, closed required changes, and a content fingerprint matching the current teacher pack. Tested status requires the corresponding registered, analysed classroom or home trial with at least one lesson, complete privacy declarations, a successful decision, no open safety blocker, and the same current content and pedagogical identities.

`evidence_identity.commit_sha` is provenance only.
`evidence_identity.content_fingerprint` is a deterministic SHA-256 over linked
lesson YAML, the thematic plan, machine pedagogy artifacts, indexed materials
and keys, and declared reviewable directories. The adjacent
`pedagogical_snapshot` binds evidence to current catalogue/rule/engine and
lesson-DNA identities. Evidence records, `materials-index.yaml`, and derived
readiness reports are excluded so registration cannot invalidate itself. See
[`teacher-pack-content-fingerprint.md`](teacher-pack-content-fingerprint.md)
and
[`pedagogical-review-and-trial-workflow.md`](pedagogical-review-and-trial-workflow.md).

Templates are schema-valid blank instruments, never completed evidence. Trial records may contain only aggregated observations and must declare the absence of names, birth dates, identifiers, addresses, contacts, photos, medical/diagnostic data, identifiable grades, and identifiable free text. The validator rejects unknown personal-data fields and checks declarations, but cannot guarantee that unrestricted prose contains no indirect identifier; human free-text review remains mandatory.

The offline evidence workflow prepares JSON, conducts scoped review and the
separate classroom/home trial, normalizes to canonical YAML, and explicitly
registers current records. Classroom readiness requires classroom-scoped review
and classroom trial; homeschool readiness requires homeschool-scoped review and
home trial. Blocking, safety, required-change, privacy, or stale-evidence
diagnostics prevent the affected readiness state.

Both water-related teacher packs are physically resolved and print-ready, but
independent review is pending and neither classroom nor home trial is recorded.
Their honest status is `teacher_pack_complete_pending_review`; classroom and
homeschool readiness remain false. The validators report these pending workflow
facts without inventing evidence.

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

## Annual-course architecture

The grade-5 production course now sequences all ten verified topic-inventory groups. It is a complete architecture, not a fully authored year: two water-related thematic plans link ten detailed lessons, while the other eight units remain architecture. Four linked components keep the 36-page source matrix, language progression, teaching calendars, and implementation roadmap reviewable without creating placeholder lessons.

Architecture completeness and implementation completeness are separate:

```yaml
completeness:
  scope: complete_annual_architecture
  architecture_complete: true
  all_units_sequenced: true
  all_sources_selected: true
  all_thematic_plans_authored: false
  all_lessons_authored: false
  implementation_status: architecture_complete_partial_implementation
  declared_complete: false
  deferred_to_issue: 18
```

The annual validator checks topic and outcome links, eligible books, canonical pages, source roles and provenance, every selected page's transformation contribution, synthesis strategy semantics, the shared external registry, contiguous order, prerequisites, lesson-budget arithmetic, Estonian progression, strict later-unit recycling, practical/revision/assessment references, roadmap consistency, school-stage semantics, and honest completeness. Planning gaps are warnings when they are pedagogically actionable rather than structural errors. The architecture is described in `docs/grade-5-science-annual-course.md`.

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
7. Create each author-material file and answer key, register it in the teacher-pack index, and declare honest readiness.
8. Reconcile stage timing and keep content/language assessment separate.

For a thematic plan, link complete lesson artifacts, make the glossary and progression match those lessons exactly, and list only strictly later lessons in `recycled_in_lessons`. Use an explicit empty list when no suitable later lesson exists. For an annual architecture, use verified topic IDs, link only existing thematic plans, select canonical pages through the source matrix, give every selected source a transformation contribution, distinguish publisher and curated sequences, reconcile budget scenarios, and declare implementation and evidence gaps honestly. External sources are optional and must resolve through the shared registry.

Run:

```sh
npm run test:plans
npm run check:plans
npm run test:synthesis
npm run test:teacher-packs
npm run check:teacher-packs
```

The focused test suites mutate the valid production repository to verify route ownership, schema strictness, objectives, language load, timing, cross-file links, programme type, provenance, assessment separation, school-stage scope, completeness, material path safety, answer-key requirements, hidden-answer rejection, readiness gates, and warning thresholds.

## Integrated pedagogy bindings

Integrated lesson schema 1.2 keeps the authored stage plan authoritative and
adds a strict execution envelope. Every selected DNA phase names its real
lesson stages, partitions its activity/setup/cleanup/transition minutes, and
provides a Russian binding rationale. Reserve and explicitly non-DNA work
complete the stage partition; the resulting totals must reconcile exactly to
each stage and to the 45-minute lesson. Versioned compatibility rules reject a
semantically false binding even when its arithmetic fits.

Each learner-facing phase also declares a render contract: execution mode,
concrete instruction, prompt/evidence/language references, evaluation mode,
and answer-access policy. This contract resolves to the declared student
material rather than the first file in a lesson. Answer-bearing tasks require
a real answer/evidence artifact; teacher observation and open work cannot
receive a fictitious after-attempt key.

Structured Estonian assessment criteria propagate separately from subject
assessment through the selection request, DNA, generated tasks, answer
guidance, and homeschool package. The generated structure is reproducible, but
it does not change pending review, untested classroom/home status, or readiness.
See `docs/pedagogy-generation-integration.md`.
