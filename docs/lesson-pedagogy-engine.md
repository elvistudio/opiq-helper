# Lesson pedagogy selection engine 1.0

## Purpose

The selection engine turns a strict lesson-planning request into two
machine-validatable artifacts:

1. an explainable selection decision;
2. a proposed `lesson_dna`.

It uses only the validated records in `knowledge/pedagogy`, versioned project
rules, and deterministic local code. It does not call a network service or AI,
use randomness, rewrite a lesson, or claim that the selected combination is
the most effective way to teach.

The operational score means **fit to selection rules 1.0**. It is not an
effect size, quality grade, learning guarantee, or teacher approval. Activity
taxonomy ratings and scoring weights remain project-authored and provisional.

## Query filtering versus lesson selection

The existing query helper answers:

> Which concrete targets satisfy these independent constraints?

It expands activity families to concrete query targets, applies hard filters,
and returns bytewise IDs without ranking.

The selection engine answers:

> Which valid combination of concrete targets can fill the relevant slots of
> one flexible pattern within this lesson's combined constraints?

It reuses the query-target identity, activity/execution-profile inheritance,
taxonomy vocabulary, and deterministic ordering. It then adds pattern choice,
visible integer scoring, combination validation, timing, overrides, and lesson
DNA. The query helper remains useful for catalog inspection and is not
duplicated or replaced.

## Versioned artifacts

Selection has independent versions:

| Identity | Current value | Meaning |
| --- | --- | --- |
| `taxonomy_version` | `1.0` | capability, resource, demand, effort, group, and compatibility vocabulary |
| `selection_rules_version` | `1.0` | hard constraints, integer weights, penalties, timing, and composition policies |
| `lesson_dna_schema_version` | `1.0` | structure of a proposed lesson pedagogy composition |
| `engine_version` | `1.0` | deterministic implementation semantics |

Every decision and DNA also stores:

- a SHA-256 digest of the operational activity catalog;
- a SHA-256 digest of the normalized request;
- all four versions.

The catalog digest contains fields that can change selection, but excludes
irrelevant descriptive prose. Activity order and set-like request-array order
do not affect the digest or decision. Content changes that affect
capabilities, constraints, resources, demands, effort, safety, or duration do.
No generated timestamp is part of the deterministic core.

## Selection request

`pedagogical-selection-request.schema.json` separates:

- learner context: grade, subject, delivery, participant count, usable group
  formats, duration, and classroom/individual-study context;
- lesson context: purpose, content types, required and desired capabilities,
  phase needs, recent targets, and later retrieval windows;
- language profile: main explanation language, Estonian support level and
  roles, productive-language ceiling, and required scaffolds;
- resources: exact available/unavailable vocabulary and explicit equipment,
  access, and supervision flags;
- effort limits: preparation, facilitation, learner setup, and parent support;
- preferences and teacher overrides.

Lesson-purpose vocabulary is project-authored operational metadata:

- `concept_introduction`;
- `guided_application`;
- `independent_practice`;
- `collaborative_practice`;
- `practical_investigation`;
- `map_or_data_interpretation`;
- `retrieval_and_consolidation`;
- `formative_assessment`;
- `revision`;
- `oral_answer_preparation`.

It is not an official curriculum taxonomy.

## Hard constraints

Hard constraints determine whether a target is executable. A preference or
teacher override cannot bypass them.

The engine checks:

- grade and subject scope;
- delivery mode and a feasible group format;
- lesson phase;
- required and explicitly unavailable resources;
- printer, internet, equipment, and outdoor availability;
- preparation, facilitation, learner, and parent effort ceilings;
- adult safety supervision;
- productive-language demand and Estonian A1–A2 compatibility;
- source access during a retrieval attempt;
- concrete execution-profile identity;
- explicit target exclusions;
- target and pattern existence.

A whole-class request may still use individual or pair work. The group-size
check therefore evaluates the selected organizational format rather than
pretending that an individual task has 28 simultaneous participants.

## Soft scoring

All integer weights, penalties, and operational scoring thresholds are in
`knowledge/pedagogy/selection/selection-rules.yaml`. The decision trace exposes
every non-zero component and its exact sum.

Scoring considers:

- required and desired capability coverage, with primary stronger than
  supporting;
- content-type and pattern-phase fit;
- whether the target is a pattern's documented activity option;
- group, delivery, language, resource, and effort fit;
- concrete execution-profile specificity;
- explicit preferences;
- recent-method repetition;
- provisional or unknown taxonomy confidence.

Required capability coverage is also a whole-composition hard check. A high
score cannot hide an uncovered required capability. Ties use bytewise target
IDs and composition signatures. The code has no unlisted score component.

## Pattern choice and flexible slots

The four existing patterns remain flexible recommendations:

- `concept-introduction-classroom`;
- `retrieval-and-consolidation`;
- `safe-practical-investigation`;
- `independent-homeschool-study`.

Purpose policies identify eligible patterns. An explicitly required pattern is
checked as a hard request. A preferred pattern gets a visible soft component.

Selection rules classify each pattern component as required or optional for
composition. A request's `phase_needs` promotes the matching slot to required.
Optional slots are filled only when a valid, higher-scoring composition still
fits. An omitted slot records a reason. Delayed-review components are placed in
the relative retrieval plan rather than consuming current lesson minutes.

The engine considers every phase-compatible validated target, while documented
pattern activity options receive a visible bonus. This lets a concrete
`learning-stations::map-data` profile serve map/data work without changing the
underlying flexible pattern or inventing an unregistered method.

## Timing and whole-composition checks

Timing is explicit:

```text
activity minimum
+ setup
+ cleanup
+ group-format transitions
+ reserve
```

Version 1.0 keeps a three-minute reserve and charges a transition minute when
the organizational format changes. It never truncates a target silently. The
DNA reports component totals, planned total, and remaining unallocated time.

The composition validator also rejects:

- repeated use of one target in several slots;
- too many organizational formats;
- uncovered required capabilities;
- retrieval without later correction when the request is retrieval-focused;
- practical work without observation/measurement and an evidence-based
  conclusion;
- excessive high productive-language time under A1–A2 support;
- reflection-only evidence represented as full subject assessment.

If no valid composition fits, the engine returns a schema-valid failure rather
than a partial lesson.

## Execution profiles

The selector always expands activity families before evaluation. An
unprofiled activity uses its `activity_id`; a profiled family requires
`activity_id::profile_id`.

For example, the map/data and practical observation forms of learning stations
are separate executable targets. Only the practical target brings its
laboratory resources, setup/cleanup, measurement capability, high
facilitation, and adult safety requirement. A family ID cannot stand in for a
missing concrete profile.

## Language model

The grade-5 science fixtures preserve:

```yaml
primary_instruction_language: ru
estonian_support:
  learner_level: A1-A2
  subject_explanation_language: ru
```

Russian carries complex concept formation, causal reasoning, misconception
correction, and complete subject answers. Estonian roles are bounded to
terminology, labels, familiar instructions, sentence frames, and short oral or
written output as explicitly requested.

The productive-language ceiling hard-filters unsuitable targets. A
scaffold-compatible short output may be selected; a discussion-heavy method
does not become low-demand because the support language is Estonian.

## Separate assessment

Lesson DNA always contains two independent records:

- `subject_assessment`;
- `estonian_language_assessment`.

The subject record states that weak Estonian form alone must not lower evidence
of scientific understanding established in Russian. The language record checks
only the requested short Estonian role. Repeating a term does not become proof
of the complete subject model, and a long A1–A2 explanation is not required.

## Retrieval and later review

When requested, the first retrieval attempt must use a target whose source
access is `prohibited`. A retrieval-focused composition must place correction
or feedback later in the lesson. Relative future windows use only:

- `after_lessons`;
- `after_days`;
- `next_unit`.

The engine records these recommendations but does not edit an annual course,
calendar, thematic plan, or production lesson.

## Teacher overrides

An override identifies a slot and concrete target and requires a Russian
rationale plus `author_role: teacher`.

A valid override substitutes the target and remains visible in both decision
trace and DNA. It does not set `teacher_review: approved`.

The engine rejects an override that uses:

- an unknown target or slot;
- an incompatible phase;
- unavailable resources;
- an invalid grade, subject, group, or delivery mode;
- excessive hard language demand;
- missing safety supervision.

Rejected overrides produce `invalid_teacher_override` with the concrete hard
reason.

## Failure model

Possible structured codes are:

- `no_pattern_match`;
- `no_candidate_for_required_slot`;
- `duration_overflow`;
- `missing_required_resource`;
- `safety_supervision_unavailable`;
- `language_profile_incompatible`;
- `invalid_teacher_override`;
- `unsatisfied_required_capability`;
- `incompatible_phase_combination`.

An invalid request or impossible single-request CLI execution exits non-zero.
The no-argument CLI audits all committed fixtures, including expected failure
fixtures, and exits successfully.

## CLI

Inspect all committed fixtures:

```sh
npm run select:pedagogy
```

Inspect one fixture:

```sh
npm run select:pedagogy -- \
  --fixture grade5-concept-introduction \
  --summary
```

Use `--debug` for target-specific hard-filter reasons and scores, or `--trace`
for the complete decision and DNA. A strict request file can replace the
fixture:

```sh
npm run select:pedagogy -- \
  --request path/to/request.yaml \
  --json
```

The command is read-only unless `--output` is explicit. Maintainers can
regenerate the committed example snapshots explicitly with
`--write-examples`; `check:pedagogy-selection` then proves that the examples
exactly match their fixtures.

Validate:

```sh
npm run test:pedagogy
npm run check:pedagogy
npm run query:pedagogy
npm run test:pedagogy-selection
npm run check:pedagogy-selection
```

## Adding or changing a rule

1. Explain the operational need.
2. Change the versioned YAML, not a hidden constant.
3. Preserve `claim_origin: project_authored_design`.
4. Add or revise a fixture that demonstrates the rule.
5. Regenerate examples only when the intended DNA changes.
6. Update the version when compatibility semantics change.
7. Run both knowledge and selection checks.
8. Request qualified teacher review before production integration.

Avoid false precision. Use the smallest integer distinction needed for stable
behavior. A score change must not be described as new evidence of
effectiveness.

## Readiness and future work

Automatically generated DNA is always:

```yaml
structural_state: proposed
teacher_review: pending
classroom_trial: not_started
classroom_ready: false
effectiveness_claimed: false
```

Issue #60 can consume individual-study, parent-effort, offline, no-printer, and
safety metadata to build homeschool packages. It must not turn the selector
into a subject teacher or relax supervision. A later production-integration
issue can map DNA into real lesson artifacts only with explicit migration and
review.

This implementation does not modify production lessons, annual courses,
curriculum maps, teacher packs, review/trial evidence, readiness, or content
fingerprints.
