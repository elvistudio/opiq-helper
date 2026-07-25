# Homeschool learning engine

The homeschool learning engine is a deterministic adaptation layer over the
validated pedagogical knowledge base and the lesson-pedagogy selector. It turns
an already selected classroom lesson intent into a proposed home-study
structure. It does not generate scientific content, approve an experiment, or
declare a package ready for use.

The water production pilot passes the exact classroom selection request and
lesson DNA to this engine, then binds every adapted phase to existing
teacher-pack materials and answer keys. Classroom and homeschool delivery share
one scientific content identity. Generated parent guidance never assigns
subject explanation to the parent; the practical lesson retains teacher
authorization and adult safety supervision. See
[pedagogy generation integration](pedagogy-generation-integration.md).

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
final-DNA safety + phase-level binding validation
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

The adapter consumes selection engine `1.1`. `individual_study` is valid only
for one learner, while `remote_peer` and `small_sibling_group` use
`collaborative_study`. Therefore `compatibility.one_learner` is considered
only for a real one-learner request or `independent_study`, never merely
because a home variant exists.

## Variants

| Variant | Delivery | Learners | Adult boundary |
| --- | --- | ---: | --- |
| `independent` | `independent_study` | 1 | No adult execution role except separately required safety supervision. |
| `parent_child` | `parent_supported` | 1 | The adult is not counted as a learner and may use only allowed catalog roles. |
| `remote_peer` | `remote` | 2 | The peer is a learner, not a parent; remote compatibility and resources still apply. |
| `small_sibling_group` | `homeschool` | 2–4 | Pair/triad/small-group metadata is enforced; group status does not bypass safety. |

The two one-learner variants use `individual_study`; the two learner-group
variants use `collaborative_study`. The semantic validator rejects
`individual_study` with a group of two or more and `collaborative_study` with
one learner. Candidate traces for remote peers and sibling groups consequently
contain no `one_learner` compatibility dimension.

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

Bindings are revalidated after the final homeschool DNA has been selected.
Each adapted phase may use only an exact binding for its own phase ID or
bindings from explicitly mapped source phases. There is no global fallback to
unrelated keys. Retrieval, formative self-check, correction reflection, and
delayed review require a relevant answer key; an explanation replacement
requires a teacher explanation or supplied source segment; practical work
requires procedure and safety references. `answer_binding_decisions` records
the phase, mapped source phases, `mapped_source` or `exact_adapted` origin,
refs, release policy, and validation result. The package retains this
phase-level provenance alongside any deduplicated material index.

Source and adapted explanation phases follow the same rule: either a
teacher-provided explanation reference or a bounded learner source segment is
required. The engine does not create an explanation. Missing both produces
`explanation_binding_missing`.

Every delayed or next-unit review session is built only from a valid,
closed-source, review-capable phase binding. Its strict `answer_binding`
contains adapted phase IDs, relevant key references, and exact-or-mapped
origin. The package repeats this provenance in `review_binding_summary`.
There is no fallback to the last learner step or to an unrelated key; a
relative retrieval window without a relevant binding produces
`answer_key_binding_missing`.

## Teacher override adaptation

The internal home selector may use mapped slots, but the public adaptation
trace never loses the source teacher decision. For every accepted source
override it records the override ID, teacher rationale, source slot and target,
adapted phase and target, policy, and one of `preserved`, `reselected`, or
`rejected`.

The adapter resolves each source override against the actual versioned
`pattern_policies.slots` definitions. It maps the source phase, verifies the
real target-pattern phase, and then uses that slot's registered `slot_id`; it
never derives a slot ID by replacing underscores or hyphens. No match or more
than one match produces `teacher_override_slot_unresolvable`.

`require_preservation` succeeds only for the exact target in the unambiguously
resolved target-pattern slot after all home hard constraints pass.
`allow_reselection_with_warning` retains the trace and emits
`teacher_override_reselected`, but does not mark the replacement override
accepted in homeschool DNA. `reject_all` returns a structured failure.

## Parent and teacher responsibility

The model keeps four responsibilities separate:

| Role | Responsibility |
| --- | --- |
| Child | Follow the visible plan, attempt, explain, check, correct, and record an unresolved question. |
| Supporting adult | Prepare conditions, protect answer access, listen, or check only as allowed. |
| Adult safety supervisor | Provide the exact required supervision without changing the procedure. |
| Subject teacher | Own scientific explanation, correct answers, assessment, procedure, authorization, and unresolved subject questions. |

The parent guidance lists allowed actions, prohibited actions, escalation
triggers, and separate preparation, live-support, safety, and answer-access
minutes. `adult_managed` requires an available adult, an allowed
`check_answers` role, and enough support-minute budget. Each affected core or
review session gets the provisional
`adult_key_release_minutes_per_session` from the versioned rules. The adult
opens only the relevant key after the completed attempt and neither explains
nor corrects the answer for the child. `after_attempt` and
`self_managed_after_attempt` do not add adult time or roles automatically. A
parent is not a science teacher. Even
`subject_explanation_available: true` cannot authorize invention or alteration
of subject content.

Core-session answer access is resolved only from validated phase-level
`answer_binding_decisions` after all session steps have been packed. Retrieval,
formative correction, and reflection with error correction therefore use the
same binding and release contract; a phase or slot ID never grants answer
access. A valid decision must require release, contain a relevant key, and
belong to the current session. Optional keys with `release_policy:
not_applicable` do not create a session binding. Adult-managed release adds the
versioned provisional minute once per affected session, even when that session
contains several answer-bearing phases. This structural validation establishes
key provenance and timing consistency; it does not establish the scientific or
pedagogical quality of the answer key.

## Timing and weekly plan

Timing parameters in `homeschool-rules.yaml` are project-authored,
versioned, and provisional. Learner activity, setup, cleanup, transitions,
breaks, and contingency reconcile separately from adult preparation, live
support, safety, and answer-access time. A session cannot exceed
`learner_session_minutes`, and the plan cannot exceed `maximum_sessions`.
Safety time is never shortened to make the plan fit.

The weekly plan uses relative windows only. Immediate retrieval remains inside
a core session. Every `after_days` and `after_lessons` window creates a real
`delayed_retrieval` session; every `next_unit` window creates a real
`weekly_review` session. Each session has a relative window, closed-source
policy, after-attempt answer release, instruction, and visible learner
minutes. The versioned `delayed_retrieval_minutes` and
`weekly_review_minutes` are included in:

- each session limit;
- the `maximum_sessions` count;
- weekly-plan learner total;
- package learner total;
- deterministic timing checks.

If core plus review sessions exceed the declared count, the engine returns
`timing_unrealistic`; it never drops a review window silently. It does not
invent a calendar date, completion state, progress history, or learner
identity.

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

Safety is evaluated in three explicit states:

```text
source_supervision_required
adapted_supervision_required
effective_supervision_required = source OR adapted
```

The final homeschool DNA is checked phase by phase. Source supervision may not
disappear (`safety_requirement_not_preserved`). Any effective requirement
needs an available adult, the adult and resource supervision flags, and the
allowed `safety_supervision` role. Controls are the deterministic union of
source and adapted controls; adult safety minutes come from the final
supervised phases. Package and parent guidance expose all three states and the
effective adult requirement. Practical work also fails when a required
procedure or safety reference is unavailable. The package still requires
subject-teacher authorization. Structural output is not permission to perform
an activity.

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
must match exactly. The validator checks 18 fixtures (11 success and 7
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

The generic engine does not itself render source-backed lesson content. Issue
#61 supplies the bounded water production integration described below. Broad
quality gates remain deferred to #62; teacher review and home-trial evidence
to #63; and wider representative regression pilots to #64.

## Production material resolution

The issue #61 water pilot adds a strict integration layer above the generic
adapter. Every package material reference resolves through the teacher-pack
index to an audience, type, repository path, and answer key; every task
reference resolves to a concrete phase instruction and expected evidence.
Adapted phases keep an exact or declared mapped source binding. Unresolved
materials, tasks, keys, procedures, or safety references fail generation.
Child output therefore names an exact file and action instead of an opaque
placeholder.

The production adapter does not rewrite the selector-owned source lesson DNA.
Committed classroom DNA, the request copy, and decision/package source digests
must form one exact chain. Production assessment phase bindings are carried as
an integration overlay. A reselected target requires an explicit adapted task
contract; source materials, evidence, key policy, procedure, and safety are not
inherited automatically.

The lesson-3 home observation uses a separate strict policy artifact rather
than a lesson-position heuristic. It records the classroom target, the
resource-compatible home target, actual home resources, passive ice/cold
surface procedure, adult supervision, teacher authorization, prohibited
heating/tasting, and stop conditions. Machine package, child Markdown, and
parent Markdown must express the same safety boundary. This is structural
equivalence only: teacher review remains pending, the home trial is not
started, and `homeschool_ready` remains false.

The lesson-3 home practical has its own passive-observation sheet. It does not
reuse the classroom temperature table or answer key. The adult checks procedure
completion and safety; the scientific conclusion is checked later in a
separate keyed retrieval step after the child's first attempt. Learner
rendering exposes success criteria and sentence frames, while complete answers
and accepted variants stay in teacher-only answer regions.
