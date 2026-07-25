# Pedagogy generation integration

Issue #61 connects the existing lesson-plan, pedagogy-selection, homeschool,
teacher-pack, fingerprint, and readiness systems. It does not create a second
lesson format. The grade-5 science water unit is the only production pilot.

## Authority and pipeline

The lesson YAML remains authoritative for scientific content, canonical Opiq
evidence, objectives, expected answers, safety, language targets, and
assessment criteria. `pedagogical_integration.selection_input` supplies only
explicit delivery constraints that cannot be inferred safely, including the
classroom productive-language ceiling and the complete homeschool variant,
adult-availability boundary, session limits, and key-release mode. The generator
then calls the existing selection engine 1.1 and homeschool engine 1.0:

```text
source-backed lesson YAML
→ selection request
→ decision and lesson DNA
→ immutable canonical lesson DNA + production assessment overlay
→ stage/phase/material binding
→ classroom rendering
→ strict homeschool adaptation
→ parent guidance and relative weekly plan
→ cross-artifact checks
→ teacher-pack fingerprint
```

No AI, network call, randomness, current timestamp, or free-prose source
inference participates in generation.

## Schema migration

Legacy and integrated versions coexist:

| Artifact | Legacy | Integrated |
|---|---:|---:|
| lesson plan | 1.1 | 1.2 |
| thematic plan | 1.1 | 1.2 |
| teacher-pack index | 1.2 | 1.3 |

An integrated version must contain the integration contract; a legacy version
cannot contain it. Unrelated production units therefore remain valid without a
mass migration.

## Content identity

SHA-256 content identity covers source identity and URLs, content objectives,
subject success criteria, misconceptions, existing questions and expected
answers, assessment, and the Russian-primary / Estonian-supported
language-policy identity. For practical work it projects the production
`work_id`, safety requirements, ordered teacher-controlled and pupil steps,
materials, observation table, expected observation and conclusion, Russian
report target, short Estonian conclusion, Opiq record IDs, and provenance
references. It excludes selected methods, timing, generated paths, readiness,
review/trial status, timestamps, and Git commit identity.

Canonicalization is path-aware. Opiq records are set-like by
`record_id + canonical_url`; role, outcome, objective, provenance, language,
acceptable-variant, and safety-reference sets are bytewise sorted. Scientific
procedures, lesson stages, and recommended sequences retain their declared
order. This keeps harmless source-record reordering stable while ensuring that
changing a procedure step, expected observation, conclusion, or safety control
changes the identity.

Classroom and homeschool artifacts are linked to the same lesson content
identity in `pedagogy/integration-index.yaml`. Changing a scientific answer,
source URL, or safety control changes the identity; changing delivery timing or
readiness does not.

## Canonical lesson DNA and assessment overlay

`selectLessonPedagogy()` produces the one canonical lesson DNA for a lesson.
That exact object is committed under `pedagogy/classroom/`, copied without any
field change into the homeschool request, used for timing and task rendering,
and hashed by the integration index, homeschool decision, and homeschool
package. The generator checks the complete digest chain and fails if the
selector-owned object changes after selection.

Production phase bindings for subject and Estonian assessment are more specific
than the generic selector contract. They therefore live in
`pedagogical_integration.assessment_integration` and in the integration index as
`production_assessment_integration`. This overlay records target phases,
criterion references, the separate-evidence policy, provenance, and the source
DNA digest. It never mutates lesson DNA.

## Stage and component timing reconciliation

Every DNA phase binds to explicit, non-overlapping minute allocations inside
one or more existing lesson stages. Each allocation records activity, setup,
cleanup, and transition minutes. Reserve and non-DNA minutes are separately
assigned to a stage. For every stage:

```text
phase activity + setup + cleanup + transition + reserve + non-DNA
= declared stage duration
```

Across the lesson, all stage partitions equal exactly 45 minutes. DNA component
allocations plus reserve equal `lessonDna.timing.total_planned_minutes`;
non-DNA allocations equal `unallocated_minutes`. Stage sharing is allowed only
through explicit allocations, so no minute can be counted twice.

Versioned compatibility rules 1.0 also check meaning, not only arithmetic:
activation binds to activation, explanation to Russian concept explanation or
an Estonian bridge, guided practice to supported/practical/classification
work, retrieval and formative assessment to genuine output, revision, or
assessment evidence, and orientation/reflection to their corresponding stage
types. Narrow compatibility bases such as bounded language assessment or
embedded formative evidence must be stated explicitly with a Russian
rationale. Unknown stages, incompatible bindings, hidden overlap, or stage
minutes without a phase/reserve/non-DNA role fail.

The compact practical profile describes one teacher-prepared observation, not
rotating stations. It keeps adult supervision, controlled materials, setup,
cleanup, measurement, observation, and evidence-based conclusion visible while
fitting the existing lesson.

## Phase-specific generated regions and evaluation

The renderer owns only regions enclosed by:

```html
<!-- OPIQ-PEDAGOGY:BEGIN lesson=… phase=… audience=… -->
<!-- OPIQ-PEDAGOGY:END lesson=… phase=… audience=… -->
```

Manual text outside a region is preserved. Missing, duplicate, nested, or
broken markers fail. A phase render contract states an execution mode,
concrete learner instruction, learner-visible criteria and bounded language
support, teacher-only answer/language/variant/misconception references,
evaluation mode, answer-access policy, and binding rationale. The renderer
materializes the selected method: concept maps require nodes and labelled
links, recall closes the source before retrieval, self-tests preserve
attempt/check/correction, and practical work exposes only approved procedure
and evidence recording.

Teacher regions show the target, minute allocation, learner and teacher
actions, evidence, evaluation, language role, assessment references, safety,
differentiation, and rationale. Student regions show observable actions,
exact source/material access, first attempt, required evidence, key-release,
and visible correction without taxonomy IDs, scoring, override internals, or
the correct answer before the first attempt.
`teacher_observation` phases have no fictitious key;
`answer_key`/`evidence_criterion` phases resolve to a real key. The integration
index binds each task to the exact student and teacher paths, prompt/evidence
sources, evaluation mode, and access policy. Validation proves that no selected
phase exists only as metadata.

The answer-leak guard collects full Russian answers, complete short Estonian
answers, acceptable variants, and practical conclusions from lesson YAML. It
normalizes whitespace and Markdown before rejecting their appearance in
student or child-facing homeschool files. Sentence frames with a blank and
individual terms in a bounded word bank remain allowed. Full answers,
acceptable variants, misconceptions, and correction guidance remain available
in `answers/`, teacher lesson guides, and machine artifacts.

## Language and assessment

Complex concepts, causal reasoning, misconceptions, and full subject answers
remain Russian-primary. Estonian A1–A2 support is bounded to terminology,
labels, familiar instructions, sentence frames, and short oral or written
responses already present in the lesson. Subject and Estonian evidence remain
separate; an Estonian form error does not automatically reduce the science
result.

The shared `lessonRequestsEstonianAssessment()` rule follows structured
criteria: `affects: language_assessment` or a recognized Estonian recognition,
supported-production, or independent-production domain. This flag propagates
through the selection request, generic lesson DNA, and the separate production
assessment overlay. Target phase IDs must contain actual
language evidence; Russian scientific reasoning and A1–A2 Estonian output
remain separately evaluated.

## Homeschool adaptation

Each homeschool request reproduces the exact classroom request and lesson DNA
before adaptation. A deterministic resolver expands every material ID to its
title, repository path, audience, type, and answer key, and every task
reference to a real task binding with a concrete instruction and expected
evidence. Missing material, task, key, procedure, or safety references are
integration errors. Child Markdown therefore names exact files and actions;
opaque instructions such as “open the indicated material” are rejected. Keys
remain closed for the first attempt, corrections remain visible, and the
parent is never made the subject teacher.

The resolver looks for an explicit `adapted_task_contract` before deciding
whether a preserved target can inherit its source contract. This permits a
home-specific task to keep the selected method while replacing classroom-only
materials or operational instructions. If there is no explicit contract, a
preserved target may inherit only after every material is declared compatible
with homeschool delivery. A reselected target always requires an explicit
contract; absence produces `adapted_task_contract_missing`.

Every explicit contract restates learner instruction, materials and criteria,
evaluation mode, source and answer access, key bindings, procedure refs, and
safety refs. Integration-level delivery scopes distinguish `classroom`,
`homeschool`, and explicitly shared materials. A classroom-only material in a
resolved home task produces `home_material_delivery_scope_mismatch`; path
location alone is never treated as proof of compatibility.

Lesson 3 is `parent_child`, requires teacher authorization and adult safety
supervision, and permits only passive ice melting and cold-surface observation:
no kettle, stove, open flame, or child handling of a hot vessel. Other lessons
use the explicit `independent` variant. Variant selection is read from each
lesson contract; it is never inferred from lesson position or prose.

The lesson-3 boundary is also a strict machine-readable home-practical policy.
It declares the source classroom target, safely adapted home target, allowed
and forbidden materials, child and adult steps, prohibited actions, stop
conditions, actual home resources, procedure/safety references, and the
rationale relating the generated lesson to the simpler production homework.
The final DNA, package, child Markdown, and parent Markdown must be equivalent
to this policy. A resource-heavy classroom target is reselected rather than
being falsely preserved when the home resource contract cannot support it.
The preserved safety-orientation target has an explicit home task that uses
`homeschool/lesson-03-home-safety-card.md`; it does not inherit the classroom
card. The reselected practical uses that same home safety card together with
`homeschool/lesson-03-passive-observation-sheet.md`, never the classroom
temperature table or classroom safety card. Both files are generated from the
strict home policy and describe passive initial/later and cold-surface
observation without a thermometer, warm water, or heating. Safety-orientation
and practical work use `teacher_observation`, answer access
`not_applicable`, and no key. Separate evidence-check and conclusion steps
retain their keys after a visible first attempt.

Validation follows the complete resolved-home closure from package steps
through task contracts, material IDs, index entries, artifact paths, and file
contents. It checks declared delivery scope, absence of classroom task markers
and positive classroom-only instructions, absence of practical key-release
text, and agreement with the practical policy. The original homeschool request
still carries the immutable classroom DNA and its source material bindings as
provenance; those source bindings are not the resolved home-material closure.

Delayed retrieval uses only `after_lessons`, `after_days`, or `next_unit`;
absolute learner dates and personal progress storage are prohibited.

## Fingerprint and readiness

The generated `pedagogy/` and `homeschool/` directories are reviewable content,
so generation changes the teacher-pack content fingerprint. The materials
index and review/trial evidence remain excluded under fingerprint specification
1.0. A new fingerprint requires fresh human evidence.

Structural generation does not prove pedagogical effectiveness, independent
review, classroom testing, or home testing. The pilot remains:

- teacher review: pending;
- classroom trial: not tested;
- home trial: not started;
- `classroom_ready: false`;
- `homeschool_ready: false`.

## Commands

```bash
npm run generate:pedagogy-water-pilot -- --write
npm run generate:pedagogy-water-pilot -- --check
npm run generate:pedagogy-water-pilot -- --summary
npm run generate:pedagogy-water-pilot -- --lesson grade-5-water-01-properties --debug
npm run test:pedagogy-integration
npm run check:pedagogy-integration
```

The generator defaults to a read-only summary. `--write` is the only mutation
mode; `--check` compares exact committed bytes.
