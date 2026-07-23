# Pedagogical knowledge

This directory stores normalized, machine-validated pedagogical knowledge. It is
independent from Opiq source routing and from production lesson artifacts.

The initial catalog contains:

- two privately supplied Estonian methodological references;
- 15 pedagogical principles;
- 30 classroom and homeschool-adaptable activities;
- four flexible pedagogical patterns;
- taxonomy 1.0 with 33 capabilities, 22 resource values, seven deterministic
  grade-5 filtering fixtures, and 32 query targets.

## Structure

- `references/references.yaml` records source identity, access, copyright
  boundaries, and allowed use.
- `principles/*.yaml` describes reusable principles and distinguishes sourced
  guidance from project interpretation.
- `taxonomy/pedagogical-taxonomy.yaml` defines bounded capabilities, resources,
  demand, effort, group, delivery, and compatibility vocabulary.
- `activities/activity-catalog.yaml` describes capability strength, delivery
  constraints, resources, effort, learner demands, safety, homeschool roles,
  and provenance. It may use strict execution profiles when one method family
  has materially different operational forms.
- `queries/grade-5-query-fixtures.yaml` proves deterministic filtering without
  weighted ranking or lesson composition.
- `selection/selection-rules.yaml` stores visible versioned hard constraints,
  integer scoring, timing, and combination rules.
- `selection/grade-5-selection-fixtures.yaml` contains seven successful and two
  structured-failure requests.
- `selection/lesson-dna-examples.yaml` stores four generated, machine-validated
  proposed DNA examples.
- `patterns/*.yaml` combines principles and activity options into flexible
  recommendations. They become selectable slots but remain flexible rather
  than universal lesson templates.
- `schemas/*.schema.json` contains strict JSON Schemas shared by the validator.

Every source-supported claim names a registered reference. Project-authored
adaptation uses `claim_origin: project_authored_design` and must not be
attributed to a reference. Confidence records express confidence in the stated
provenance and applicability, not a guaranteed learning effect.

## Copyright boundary

The supplied source documents are not committed. Their redistribution rights
have not been verified, so their reference records require:

```yaml
original_file_committed: false
redistribution_status: not_verified
quotation_policy: summaries_only
```

The repository contains original concise summaries, common method names, and
project-authored guidance. It does not reproduce source tables, images,
examples, or long passages.

## Validation

```sh
npm run test:pedagogy
npm run check:pedagogy
npm run query:pedagogy
npm run query:pedagogy -- --fixture homeschool-low-support-retrieval
npm run test:pedagogy-selection
npm run check:pedagogy-selection
npm run select:pedagogy
```

The check validates schemas, strict YAML, IDs, links, taxonomy vocabulary,
capability strength, group logic, effort, resources, learner demands,
homeschool and safety roles, copyright rules, provenance, confidence, query
fixtures, and deterministic ordering. Structural validity does not prove
pedagogical effectiveness; application still requires teacher review.

An unprofiled method is queried by its `activity_id`. A concrete execution
profile uses `activity_id::profile_id`; `::` is reserved and forbidden inside
either component. Profiles inherit family identity, provenance, principles,
phases, grades, and subjects, but own the complete operational metadata block.
They do not rank methods or define lesson DNA.

Selection expands exactly these validated targets, then checks a complete
lesson composition. The result records every hard-filter reason, integer score
component, timing component, accepted or rejected override, and deterministic
digest. Automatically generated DNA remains proposed, unreviewed, untested,
not classroom-ready, and makes no effectiveness claim.

Teacher overrides are conflict-safe: IDs and slot targets are unique, and
`accepted` means that the exact slot/target appears in the selected
composition. Delivery and preferred-group-format components are emitted only
when their documented fit condition is true. Total learner
productive-language demand is constrained separately from Estonian A1–A2
compatibility; the catalog does not yet provide per-language demand ratings.

See [`docs/pedagogical-knowledge-base.md`](../../docs/pedagogical-knowledge-base.md)
for the data model, contribution workflow, homeschool boundaries, and examples.
See [`docs/pedagogical-taxonomy.md`](../../docs/pedagogical-taxonomy.md) for
taxonomy semantics and filtering boundaries.
See [`docs/lesson-pedagogy-engine.md`](../../docs/lesson-pedagogy-engine.md) for
selection requests, versioned rules, lesson DNA, failures, and CLI usage.
