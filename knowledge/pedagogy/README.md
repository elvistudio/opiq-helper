# Pedagogical knowledge

This directory stores normalized, machine-validated pedagogical knowledge. It is
independent from Opiq source routing and from production lesson artifacts.

The production integration layer consumes this validated catalogue through the
existing selection and homeschool engines; it does not alter source-supported
descriptions or claim effectiveness. The water pilot adds one provisional
compact teacher-prepared observation execution profile so an existing
45-minute supervised investigation can be represented without pretending that
it is a multi-station lesson. See
[`docs/pedagogy-generation-integration.md`](../../docs/pedagogy-generation-integration.md).
The pilot commits one immutable selector-owned lesson DNA per lesson.
Production assessment bindings remain a separate overlay, and every reselected
home target requires an explicit adapted task contract. Learner-visible
criteria are separated from teacher-only answer evidence and checked by a
normalized answer-leak guard.

The initial catalog contains:

- two privately supplied Estonian methodological references;
- 15 pedagogical principles;
- 30 classroom and homeschool-adaptable activities;
- four flexible pedagogical patterns;
- taxonomy 1.0 with 33 capabilities, 22 resource values, seven deterministic
  grade-5 filtering fixtures, and 33 query targets.

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
- `selection/grade-5-selection-fixtures.yaml` contains ten successful and two
  structured-failure requests.
- `selection/lesson-dna-examples.yaml` stores four generated, machine-validated
  proposed DNA examples.
- `homeschool/homeschool-rules.yaml` defines versioned phase, timing,
  answer-access, adult-role, and package rules.
- `homeschool/grade-5-homeschool-fixtures.yaml` contains 18 adaptation
  scenarios: 11 success cases and seven structured failures.
- `homeschool/homeschool-package-examples.yaml` stores five deterministic
  proposed packages with parent guidance and relative weekly plans.
- `quality/quality-gates.yaml` defines reusable structural guarantees,
  applicability, severity, independent gate versions, non-guarantees, and
  exception policy. Primitive gates are evaluated before derived structural
  completeness, independently of catalogue order.
- `quality/quality-exceptions.yaml` stores only exact-record, version-bound
  exceptions; safety, leakage, identity, closure, provenance, and readiness
  gates cannot be suppressed. Active targets must resolve to an applicable
  normalized record; retired entries remain historical and never apply.
- `regressions/grade-5-regression-cases.yaml` defines bounded production,
  architecture-only, deliberate-failure, and stale-evidence cases. Every case
  declares semantic invariants, an executable local handler, and either a
  strict mutation contract or explicit `mutation: null`. Production/stale
  mutations operate on primary repository artifacts in isolated copies and
  reload the existing adapters; normalized quality booleans are not accepted
  as end-to-end evidence.
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
npm run test:pedagogy-homeschool
npm run check:pedagogy-homeschool
npm run adapt:homeschool
npm run test:pedagogy-quality
npm run check:pedagogy-quality
npm run check:pedagogy-quality-report
npm run test:pedagogy-regressions
npm run check:pedagogy-regressions
npm run check:pedagogy-regression-report
```

The check validates schemas, strict YAML, IDs, links, taxonomy vocabulary,
capability strength, group logic, effort, resources, learner demands,
homeschool and safety roles, copyright rules, provenance, confidence, query
fixtures, and deterministic ordering. Structural validity does not prove
pedagogical effectiveness; application still requires teacher review.
Pedagogical quality reports preserve per-record gate results and actual
readiness/evidence state. Fingerprint currency requires equality of algorithm,
specification, value, and file count. A scoped `--path` check covers only the
matched records and their dependency closure, and an empty explicit scope is
an error rather than a positive result.
The quality adapter also validates the committed selection, lesson-DNA,
homeschool, parent-guidance, weekly-plan, and production-integration YAML with
their existing strict Ajv schemas. Schema diagnostics stay attached to the
exact artifact and only flow into records whose dependency closure contains
it. Safety applicability reads the exact activity/profile field
`safety.requires_adult_supervision`; it does not depend on the name chosen for
the bounded parent role.

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
compatibility. Enabled support applies bounded A1–A2 filtering, scoring, roles,
scaffolds, and optional assessment. Disabled support requires
`not_applicable` and removes that layer entirely while retaining the total
productive-language constraint. The catalog does not yet provide per-language
demand ratings.

Selection engine 1.1 also distinguishes real one-learner study from
collaborative remote/sibling study. The homeschool adapter turns relative
retrieval windows into counted sessions, validates source/adapted/effective
safety on the final DNA, resolves answer and procedure bindings per adapted
phase, and preserves teacher override identity through actual versioned
pattern slots. Review sessions retain relevant closed-source key provenance.
`adult_managed` answer access requires an available `check_answers` adult and
visible provisional answer-access time. Core sessions derive that access only
from validated answer-binding decisions after session packing, so retrieval,
correction, and self-check phases share one contract without phase-ID
heuristics. Optional keys do not trigger release, and one affected session gets
one provisional release minute even when it contains multiple bound phases. A
source explanation may instead use a bounded teacher-provided source segment.
These checks establish structural consistency only; all packages remain
proposed, pending teacher review and home trial.

See [`docs/pedagogical-knowledge-base.md`](../../docs/pedagogical-knowledge-base.md)
for the data model, contribution workflow, homeschool boundaries, and examples.
See [`docs/pedagogical-taxonomy.md`](../../docs/pedagogical-taxonomy.md) for
taxonomy semantics and filtering boundaries.
See [`docs/lesson-pedagogy-engine.md`](../../docs/lesson-pedagogy-engine.md) for
selection requests, versioned rules, lesson DNA, failures, and CLI usage.
See [`docs/homeschool-learning-engine.md`](../../docs/homeschool-learning-engine.md)
for source/DNA validation, home variants, parent boundaries, answer access,
weekly plans, and readiness limits.
See [`docs/pedagogy-quality-gates.md`](../../docs/pedagogy-quality-gates.md)
for reusable structural gates, exact exceptions, diagnostics, production
reporting, CI, and the boundary between machine validation and human approval.
See [`docs/pedagogy-regressions.md`](../../docs/pedagogy-regressions.md) for
case kinds, semantic snapshots, contribution rules, and the distinction
between regression evidence and human review or curriculum coverage.

The water production pilot also uses two bounded execution profiles:
`visual-representation::paper-diagram` for a truthful paper-only diagram task
and `learning-stations::practical-home-passive-ice-observation` for the authorized
adult-supervised home observation. Profiles express operational resources and
safety; their classification remains project-authored and provisional. They do
not prove effectiveness or readiness. Integration validates component timing,
semantic stage fit, phase-specific rendering, assessment propagation, and
machine/Markdown safety equivalence without changing the general selection or
homeschool engine versions.
