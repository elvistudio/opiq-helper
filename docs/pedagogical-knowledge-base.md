# Pedagogical knowledge base

## Purpose

The pedagogical knowledge base is an independent, reusable catalog of teaching
principles, activities, and flexible patterns. It gives later tooling stable
IDs and explicit applicability metadata instead of relying on unstructured
method names.

The initial production data contains 2 references, 15 principles, 30
activities, 4 patterns, taxonomy 1.0 with 33 capabilities and 22 resource
values, and 6 grade-5 filtering fixtures. The catalog is intentionally not
exhaustive.

It is not:

- an official curriculum source;
- a claim that a method is experimentally effective in every context;
- an automatic method-selection engine;
- a production lesson schema or `lesson_dna`;
- a homeschool package generator;
- a replacement for teacher review or classroom trial.

Issue #59 can use these validated records to implement deterministic,
explainable lesson-method selection and `lesson_dna`. Issue #60 can then use the
same activity and role metadata to build homeschool packages and parent-support
rules. Neither behavior is implemented here.

## Relationship to Opiq evidence

Opiq evidence answers _what source content is available_ in an exact canonical
grade-and-subject route. Pedagogical knowledge describes _possible ways to
organize learning_. These systems remain separate:

| Layer | Establishes | Does not establish |
| --- | --- | --- |
| `source-manifest.json` and Opiq indexes | Route, source identity, canonical page evidence | Pedagogical method quality |
| Curriculum maps | Registered official and publisher evidence with scope | Automatic lesson design |
| `knowledge/pedagogy` | Normalized principles, activities, applicability, and provenance | Curriculum coverage or source-page ownership |
| Future selection engine | A traceable recommendation from validated IDs | Guaranteed learning outcomes |
| Teacher review and trial | Human judgment and contextual evidence | Universal validity |

Adding a pedagogical record must never broaden an Opiq route or turn a
methodological reference into official curriculum evidence.

## Directory model

```text
knowledge/pedagogy/
  README.md
  references/references.yaml
  principles/*.yaml
  activities/activity-catalog.yaml
  taxonomy/pedagogical-taxonomy.yaml
  queries/grade-5-query-fixtures.yaml
  patterns/classroom-patterns.yaml
  patterns/homeschool-patterns.yaml
  schemas/*.schema.json
scripts/
  check-pedagogy-knowledge.mjs
  lib/pedagogy-knowledge.mjs
  lib/pedagogy-query.mjs
  pedagogy-knowledge.test.mjs
  pedagogy-taxonomy.test.mjs
  query-pedagogy-activities.mjs
```

All YAML is parsed in strict mode: duplicate keys, aliases, tabs, unexpected
properties, and unknown enum values are rejected. IDs and catalogs use
deterministic bytewise ordering.

## Claim provenance

Every normalized record distinguishes the origin of a claim:

| `claim_origin` | Meaning |
| --- | --- |
| `source_supported` | A registered source explicitly supports the summarized idea. At least one valid `reference_id` is required. |
| `common_pedagogical_knowledge` | A bounded general statement not attributed to the supplied documents. |
| `project_authored_design` | Opiq Helper created the adaptation, procedure, or boundary. Source references are forbidden to prevent false attribution. |
| `teacher_review_pending` | A proposed interpretation awaits qualified human review. |

Each claim also has a Russian summary and a boundary explaining what it does not
establish. This prevents a source mention, a project inference, and evidence of
effectiveness from collapsing into one vague provenance field.

## Confidence

Allowed levels are `high`, `medium`, `provisional`, and `unknown`. Every
confidence entry requires a rationale.

`high` may mean that a supplied methodology explicitly recommends the
principle. It does **not** mean that Opiq Helper independently replicated an
effectiveness study or that the method guarantees learning. Project-authored
homeschool adaptations and combined patterns are generally `provisional` or
`medium` until reviewed.

## References and copyright

The two starting documents were supplied privately:

- `gag-opiraam-opistrateegiad`;
- `oppeulesanded-method-catalog`.

The original files are not in the repository. Authorship, publication date,
license, publisher, or owner is left `null` unless supported by available
evidence. The GAG guide names Gustav Adolfi Gümnaasium; no owner is invented for
`Õppeülesanded`.

For a source whose redistribution rights are not verified, validation requires:

```yaml
original_file_committed: false
redistribution_status: not_verified
quotation_policy: summaries_only
official_curriculum_authority: false
```

The schema forbids `quotation_policy: unrestricted`. It also rejects an
unverified source if `original_file_committed` is true. If a confirmed license
becomes available, its metadata should be changed in a separate, evidence-backed
PR.

Knowledge records use common method names and original concise paraphrases. Do
not add source PDFs, tables, images, author-specific examples, long excerpts, or
substantial sequences of source wording.

## Adding a reference

1. Choose a stable lowercase hyphenated ID.
2. Record only verified identity, language, access, owner, and date metadata.
3. State the redistribution and quotation policy.
4. Keep `official_curriculum_authority: false` for methodological sources.
5. Explain the source’s limited use in `notes`.
6. Insert the record in bytewise ID order.
7. Run both pedagogy commands.

A source URL or confirmed license may be supported in a later schema revision;
do not encode either in notes as if it were verified structured metadata.

## Adding a principle

Create `principles/<principle-id>.yaml`. The file name and `principle_id` must
match. A principle includes:

- names in English, Estonian, and Russian;
- a concise Russian summary;
- source and project claims with explicit boundaries;
- intended outcomes and grade range;
- project-authored grade-band adaptations;
- delivery modes, misuse risks, and non-equivalents;
- a grade-5 science applicability example;
- confidence and rationale.

Every principle currently requires at least one `source_supported` claim. This
keeps the starting catalog tied to registered evidence while allowing project
adaptations to remain visibly separate.

## Adding an activity

An activity record includes capabilities, phase, grade, content type, subject,
group and delivery constraints, duration, separate preparation/facilitation/
learner/parent effort, learner independence, required and optional resources,
learner demands, accessibility, safety, misuse risks, assessment role,
provenance, and confidence.

Learner demand is multidimensional: receptive and productive language,
interaction, reading, writing, step complexity, movement, sensory demand,
strategy familiarity, teacher modelling, Estonian A1–A2 compatibility, and
scaffolds. It is an operational planning description, not a scientific
cognitive-load score.

A discussion-heavy method cannot claim zero or low interaction demand merely
because it is silent or structured. A short Estonian term or sentence frame
does not make a complex discussion low-language.

Homeschool applicability is not a boolean. It records one of
`directly_suitable`, `adaptable`, `limited`, or `not_recommended`, plus:

- child responsibility;
- adult support;
- adult safety supervision;
- subject-teacher responsibility;
- limitations.

The parent or supporting adult is not assumed to be a science teacher.

The separate [pedagogical taxonomy](pedagogical-taxonomy.md) documents
capability strength, resource vocabulary, effort levels, delivery logic,
project-authored rating provenance, and deterministic filtering. Omitted sparse
capabilities mean `none`; every activity still requires a `primary`
capability. The six query fixtures demonstrate filtering only—there is no
weighted ranking, lesson composition, or effectiveness claim.

## Flexible patterns

Patterns recommend components and alternative activity IDs for a situation.
They require `variation_allowed: true` and may not prescribe one rigid activity
for every component. A pattern still requires an explicit subject, grade range,
role boundaries, provenance, limitations, and confidence.

The starting patterns are:

1. `concept-introduction-classroom`;
2. `safe-practical-investigation`;
3. `retrieval-and-consolidation`;
4. `independent-homeschool-study`.

They are planning advice only. They do not mutate existing lessons and do not
require a teacher to justify every deviation.

## Homeschool foundation

The independent-study pattern combines, as options:

1. a quiet work environment and removal of distractions;
2. a visible goal and short steps;
3. time estimation and planned breaks;
4. study of one bounded source segment;
5. retrieval before opening the answer;
6. self-check and correction in another color;
7. explanation to a supporting adult;
8. delayed retrieval and weekly review.

The responsibility boundary is deliberate:

| Role | Responsibility |
| --- | --- |
| Child | Follow the visible steps, make the first attempt, explain, check, correct, and report unresolved questions. |
| Supporting adult | Prepare time and materials, reduce distractions, listen, protect answer access, and encourage without giving the answer first. |
| Adult safety supervisor | Authorize and supervise only practical work explicitly approved by the subject teacher. |
| Subject teacher | Select accurate content, provide keys, resolve scientific questions, and define safety and assessment. |

No personal progress data is stored by this subsystem.

## Grade-5 science applicability

Every principle and activity explicitly supports this pilot context:

```yaml
grade: 5
subject: science
instruction_language: ru
subject_support_language: et
learner_estonian_level: A1-A2
delivery_modes: [classroom, homeschool]
```

This is applicability metadata, not a production selection. Future #59 logic
can inspect it for examples such as:

| Need | Candidate principles and activities |
| --- | --- |
| Introduce a new science concept | prior-knowledge free-write or prediction → guided reading or visual representation → self-explanation → retrieval summary |
| Conduct a practical investigation | safe-practical pattern, visible criteria, chunked steps, two-column observation, explicit adult safety role |
| Work with a map | visual representation, sorting and sequencing, or supported back-to-back description |
| Compare ecosystems | Venn diagram, concept map, sorting, or Frayer model with a Russian scientific explanation |
| Produce an Estonian A1–A2 oral answer | Russian concept formation followed by a model sentence, peer rehearsal, and one short supported output |
| Study independently at home | independent-homeschool pattern with delayed retrieval, protected answer access, correction, and weekly review |

These are examples of possible fit, not automatic recommendations. Duration,
content, safety, language load, materials, and teacher judgment still govern a
real selection.

## Validation

Run:

```sh
npm run test:pedagogy
npm run check:pedagogy
npm run query:pedagogy -- --fixture concept-introduction-whole-class
```

The validator checks:

- all schemas in strict Ajv mode;
- strict YAML and deterministic file discovery;
- unique and sorted IDs;
- valid references between sources, principles, activities, and patterns;
- grade and duration ranges;
- phase/category, group-size, delivery, and compatibility logic;
- registered capability and resource vocabulary;
- separate preparation, facilitation, learner, and parent effort;
- discussion, reading, writing, interaction, and Estonian A1–A2 demand;
- printer, internet, laboratory, outdoor, setup, and cleanup rules;
- homeschool roles and safety supervision;
- copyright and official-authority boundaries;
- source versus project attribution;
- confidence rationale;
- six deterministic query fixtures without ranking;
- absence of PDFs and symlinks.

Schema validation proves internal consistency only. It cannot establish
effectiveness, learner fit, scientific accuracy of future lesson content, or
classroom readiness. Qualified teacher review remains required before a
selection affects production materials.
