# Homeschool learning engine

The homeschool learning engine is a deterministic adaptation layer over the
validated pedagogical knowledge base and the lesson-pedagogy selector. It turns
an already selected classroom lesson intent into a proposed home-study
structure. It does not generate scientific content, approve an experiment, or
declare a package ready for use.

## Input and output contracts

The input is a strict `homeschool_adaptation_request` with:

- the complete source selection request;
- the matching generated lesson DNA;
- one supported home variant;
- learner session and session-count limits;
- available and unavailable resources;
- bounded adult availability, effort, and roles;
- answer-access and teacher-override policies;
- opaque teacher-provided material, task, explanation, key, Estonian-support,
  procedure, and safety references.

The engine returns a schema-valid `homeschool_adaptation_decision`. A success
also returns:

- a newly selected homeschool lesson DNA;
- a child-facing structural `homeschool_package`;
- separate `parent_guidance`;
- a relative `weekly_study_plan`.

A failure returns no package and uses a stable machine-readable code. Both
success and failure outputs are bytewise deterministic.

## Pipeline and source identity

```text
validated source selection request
        ↓
validated source lesson DNA
        ↓
digest, version, identity, and reproducibility checks
        ↓
versioned homeschool rules
        ↓
derived homeschool selection request
        ↓
existing selectLessonPedagogy()
        ↓
homeschool lesson DNA
        ↓
package + parent guidance + weekly plan
```

Both source artifacts are necessary. The request preserves intended grade,
subject, purpose, content types, capabilities, language policy, retrieval
windows, assessment separation, and safety constraints. The lesson DNA proves
the actual selected composition. Before adapting it, the engine:

1. validates both source schemas;
2. normalizes the request and recomputes its SHA-256 digest;
3. checks request ID, grade, subject, and language-policy agreement;
4. checks selector, rules, DNA, taxonomy, and activity-catalog versions;
5. invokes the existing selector again;
6. requires the regenerated DNA to match byte-for-byte, apart from the
   documented example ID accommodation.

Digest mismatch, stale catalog metadata, or non-reproducible DNA stops the
pipeline. A stale classroom selection is never silently converted.

## Reuse of the selector

`scripts/lib/pedagogy-homeschool.mjs` calls `selectLessonPedagogy()` for the
derived request. It does not copy scoring, candidate filtering, group-format
selection, timing composition, safety filtering, or language filtering.

Homeschool rules change only the permitted delivery context: variant, learner
count, supported group formats, home resources, parent limit, required pattern,
mapped phases, and explicit home preferences. A multi-session capacity is
passed to the selector so that the minimum viable composition can be packed
into visible home sessions afterward. The resulting actual minutes, breaks,
and contingency are reported; added time is not hidden.

## Variants

| Variant | Delivery | Learners | Adult boundary |
| --- | --- | ---: | --- |
| `independent` | `independent_study` | 1 | No adult execution role except separately required safety supervision. |
| `parent_child` | `parent_supported` | 1 | The adult is not counted as a learner and may use only allowed catalog roles. |
| `remote_peer` | `remote` | 2 | The peer is a learner, not a parent; remote compatibility and resources still apply. |
| `small_sibling_group` | `homeschool` | 2–4 | Pair/triad/small-group metadata is enforced; group status does not bypass safety. |

An activity must declare the selected variant and satisfy its delivery,
participant, group-format, effort, resource, language, and safety constraints.
The small number of catalog variants added with this subsystem are limited to
activities whose existing group range, group format, and delivery metadata
already support that variant.

`directly_suitable` can be retained. `adaptable` stays visible in warnings.
`limited` is rejected unless the request explicitly permits it, in which case
it remains warned and unreviewed. `not_recommended` never enters final DNA.

## Phase mappings

The versioned rules preserve intent rather than surface classroom form:

- activation becomes orientation or a prior-knowledge step;
- explanation becomes independent practice with a teacher-provided segment;
- guided or collaborative practice becomes scaffolded independent work, a
  bounded listening role, or remote-peer work;
- retrieval remains retrieval with the source closed;
- formative assessment becomes reflection and correction;
- delayed review remains a relative weekly/delayed window.

Practical requests keep the existing `safe-practical-investigation` pattern:
orientation, practical work, evidence check, and conclusion remain present.
Every source phase receives a `preserved`, `adapted`, `reselected`,
`omitted_with_reason`, or `added_by_homeschool_rules` trace entry.

## Child plan and answer access

Child instructions are short Russian A2–B1 structural actions. Each step
states one observable action, time, source state, adult involvement, material
references, completion evidence, and safety controls. The engine does not
write the scientific explanation or answer.

For retrieval:

- the first attempt is made without the answer;
- the source is closed where the selected activity requires it;
- the key is released only after the attempt;
- the first attempt stays visible;
- correction uses a separate colour;
- an unresolved question is recorded for the subject teacher.

Opaque key references never become first-attempt learner materials. An absent
key for retrieval or self-check is a structured failure.

## Parent and teacher responsibility

The model keeps four responsibilities separate:

| Role | Responsibility |
| --- | --- |
| Child | Follow the visible plan, attempt, explain, check, correct, and record an unresolved question. |
| Supporting adult | Prepare conditions, protect answer access, listen, or check only as allowed. |
| Adult safety supervisor | Provide the exact required supervision without changing the procedure. |
| Subject teacher | Own scientific explanation, correct answers, assessment, procedure, authorization, and unresolved subject questions. |

The parent guidance lists allowed actions, prohibited actions, escalation
triggers, and separate preparation, live-support, and safety minutes. A parent
is not a science teacher. Even
`subject_explanation_available: true` cannot authorize invention or alteration
of subject content.

## Timing and weekly plan

Timing parameters in `homeschool-rules.yaml` are project-authored,
versioned, and provisional. Learner activity, setup, cleanup, transitions,
breaks, and contingency reconcile separately from adult preparation, live
support, and safety time. A session cannot exceed
`learner_session_minutes`, and the plan cannot exceed `maximum_sessions`.
Safety time is never shortened to make the plan fit.

The weekly plan uses relative windows only. It can express immediate retrieval
inside a core session and preserve source-DNA windows such as `after_days`,
`after_lessons`, or `next_unit`. It does not invent a calendar date, completion
state, progress history, or learner identity.

## Language and assessment

Russian remains the primary language for complex subject explanation. The
maximum total productive-language ceiling cannot be relaxed. Estonian support
is separately bounded by the source request:

- when enabled, only declared A1–A2 roles and supplied support references may
  appear;
- when disabled, no Estonian role, scaffold, or assessment target is emitted;
- subject and Estonian-language assessment remain separate.

The engine does not invent Estonian scientific terms.

## Safety

Source safety constraints and selected-target safety constraints are
preserved. Practical work fails when the required adult role, resource flag,
procedure reference, safety reference, or support time is unavailable. The
package still requires subject-teacher authorization. Structural output is not
permission to perform an activity.

## Provenance, readiness, and privacy

Rules 1.0 use `claim_origin: project_authored_design` and provisional
confidence. They are operational design, not evidence of comparative
effectiveness. Every package remains:

```yaml
structural_state: proposed
teacher_review: pending
home_trial: not_started
homeschool_ready: false
effectiveness_claimed: false
```

The schemas contain no child name, email, birth date, school, address, account
ID, stored completion state, personal grade, or progress history. Fixtures use
synthetic artifact references only.

## Determinism

Core output has bytewise ordering, no timestamps, no randomness, no AI, and no
network access. Committed examples are regenerated from committed fixtures and
must match exactly. The validator checks 12 fixtures (8 success and 4
structured failure) and five generated examples.

## CLI

```sh
npm run adapt:homeschool
npm run adapt:homeschool -- --fixture homeschool-concept-independent --summary
npm run adapt:homeschool -- --fixture homeschool-practical-supervised --debug
npm run adapt:homeschool -- --fixture homeschool-retrieval-independent --trace
npm run adapt:homeschool -- --request path/to/request.yaml
npm run adapt:homeschool -- --request path/to/request.yaml --output path/to/output.yaml
node scripts/adapt-lesson-for-homeschool.mjs --write-examples
```

Exit code `0` means success, `1` means a structured adaptation failure, and `2`
means an invalid outer request or CLI use. The CLI is read-only unless
`--output` or `--write-examples` is explicit.

Validate with:

```sh
npm run test:pedagogy-homeschool
npm run check:pedagogy-homeschool
```

## Guarantees and non-guarantees

The engine guarantees structural validation, source/DNA identity checks,
selector reuse, deterministic output, bounded adult roles, protected answer
access, visible timing, preserved language policy, and no safety weakening.

It does not guarantee learning effectiveness, scientific adequacy of supplied
content, age fit for an individual child, realistic timing in a real home,
homeschool readiness, or teacher approval. It does not render Opiq content or
create answers.

Real lesson/content integration is deferred to issue #61. Broad quality gates
are deferred to #62; teacher review and home-trial evidence to #63; and wider
representative regression pilots to #64.
