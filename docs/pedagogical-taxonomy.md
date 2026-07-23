# Pedagogical taxonomy 1.0

## Purpose and boundary

The taxonomy is a shared operational vocabulary for inspecting and filtering
the pedagogical activity catalog. It answers two separate questions:

1. **Capability:** what kind of learning action can the method materially
   support?
2. **Applicability:** under which delivery, group, resource, effort, language,
   safety, and homeschool conditions can it be used?

The taxonomy is stored separately in
`knowledge/pedagogy/taxonomy/pedagogical-taxonomy.yaml`; activity-specific
ratings remain in `activities/activity-catalog.yaml`. Version 1.0 contains 33
capabilities and 22 resource values.

These ratings are operational metadata. They are not an experimental
effect-size estimate, a guarantee of learning, or a substitute for qualified
teacher judgment. The production ratings use
`claim_origin: project_authored_design`, provisional confidence, and an
individual rationale. Teacher review may confirm or revise them later.

## Five distinct dimensions

| Dimension | Question | Example |
| --- | --- | --- |
| Capability | What can the method primarily or secondarily support? | `retrieval: primary` |
| Constraint | Under which group and delivery conditions can it run? | pair, 2 learners, classroom or remote |
| Demand | What does the learner need to receive, produce, coordinate, read, or write? | high interaction, low writing |
| Resource | What must or may be available? | source text required; timer optional |
| Effort | Who must prepare, facilitate, set up, or support? | low preparation, high facilitation |

Capabilities and constraints are deliberately not flattened into one tag list.
For example, `peer_explanation: primary` does not imply that the method works
with one learner, and `one_learner: directly_supported` does not establish any
pedagogical purpose.

## Activity families and execution profiles

Most activities have one unambiguous operational form and keep their
capabilities, constraints, demands, resources, effort, compatibility, safety,
and taxonomy assessment directly on the activity. An activity family may
instead declare `execution_profiles` when those operational facts materially
differ between valid implementations.

The inheritance rule is intentionally strict:

- the activity family owns its stable ID, names, category, principles, phases,
  grade range, content and subject scope, accessibility, general misuse risks,
  provenance, project guidance, assessment roles, and grade-5 examples;
- each profile owns the complete operational block: capabilities, delivery
  constraints, duration, effort, learner independence, homeschool adaptation,
  resources, learner demands, compatibility, safety, and taxonomy assessment;
- a profiled activity may not also declare activity-level operational fields.
  There is therefore no implicit merge and no ambiguous override order.

`profile_id` follows the normal stable-ID syntax and cannot contain `::`.
Filtering addresses a profile as `<activity_id>::<profile_id>`. Unprofiled
activities keep the plain activity ID. The separator is part of specification
1.0 and is rejected anywhere inside either component ID.

The initial profiled family is `learning-stations`:

| Query target | Operational meaning | Safety |
| --- | --- | --- |
| `learning-stations::paper-classification` | handwritten/card classification and short retrieval stations | no adult safety supervision |
| `learning-stations::map-data` | map, diagram, table, and dataset interpretation | no adult safety supervision |
| `learning-stations::practical-observation-measurement` | observation and measurement with laboratory and measuring materials | explicit adult safety supervision |

This keeps safety attached to the actual materials and actions. A generic
method name neither creates nor removes a safety requirement. Add a profile
only when a real operational difference changes filtering; profiles are not
lesson phases, lesson DNA, or minor stylistic variants.

To add a profile:

1. document the operational difference from the family and choose a stable
   profile ID;
2. keep profiles bytewise sorted by ID;
3. provide the full operational block rather than relying on partial fallback;
4. rate capability, demands, resources, effort, compatibility, and safety from
   that concrete execution;
5. retain `project_authored_design`, provisional confidence, and a rationale
   until teacher review supplies stronger evidence;
6. add positive and exclusion fixtures only where the declared filters
   genuinely match.

## Capability levels

Every activity declares a sparse capability map. An omitted capability is
treated as `none` by the filtering helper.

| Level | Use |
| --- | --- |
| `primary` | The activity is directly organized around this capability. |
| `supporting` | The capability is a meaningful secondary function. |
| `incidental` | It may occur, but should not drive selection. |
| `none` | The activity does not provide the capability. |
| `unknown` | The current record cannot support a responsible classification. |

Every production activity has at least one `primary` capability. Do not promote
a capability merely to make a query return more methods.

The capability groups cover learning and knowledge, expression and
representation, learning process, and investigation. Unknown capability IDs
are rejected; additions require a taxonomy versioned data and documentation
change.

## Learner-demand ratings

Demand uses the cautious levels `none`, `very_low`, `low`, `medium`, `high`,
`very_high`, and `unknown`. It separately records:

- receptive and productive language;
- interaction;
- reading and writing;
- step complexity;
- movement and sensory demand;
- strategy familiarity;
- recommended working-memory support and teacher modelling;
- Estonian A1–A2 compatibility.

These fields are practical planning judgments, not a scientific measurement of
intrinsic, extraneous, or germane cognitive load. Avoid false precision: use
`unknown` when the available method description is insufficient.

A method with high productive-language demand cannot claim
`directly_supported` Estonian A1–A2 use. It may be
`supported_with_scaffold`, `limited`, or `not_recommended` depending on the
actual output and supports. Discussion-heavy activities retain their real
interaction demand even when pupils write rather than speak.

## Preparation, facilitation, and family effort

Effort levels are `none`, `minimal`, `low`, `medium`, `high`, `intensive`, and
`unknown`. Preparation and live facilitation are rated separately: a
brainstorm can be quick to prepare but still require active facilitation.

The homeschool parent record also names a bounded role:

- `none`;
- `logistical_support`;
- `listening_partner`;
- `check_answers`;
- `active_participant`;
- `safety_supervision`;
- `subject_explanation_required`;
- `unknown`.

`subject_explanation_required` is a limiting condition, not a default. None of
the initial 30 activities requires it. A supporting adult is not silently
treated as the subject teacher; the existing homeschool block continues to
separate child responsibility, adult support, adult safety supervision, and
subject-teacher responsibility.

## Resource vocabulary

Resources are registered once in the taxonomy and referenced by stable IDs.
Each activity distinguishes:

- required and optional resources;
- reusable and consumable materials;
- printer, internet, shared-display, outdoor, and laboratory requirements;
- setup and cleanup minutes.

To add a resource:

1. choose a lowercase underscore ID;
2. add English, Estonian, and Russian names and a category;
3. keep the resource list bytewise sorted;
4. update only activities that genuinely need it;
5. run both pedagogy commands.

Required and optional lists must not overlap. `printer_required: true` requires
a printable resource; internet-required methods cannot claim positive offline
compatibility. Laboratory resources require safety metadata. Outdoor work
requires an explicit delivery limitation and adult safety control.

## Delivery and compatibility

`delivery_constraints` records the valid participant range, group formats,
delivery modes, and whether the source is available during the first attempt.
Semantic checks ensure that individual and pair ranges include 1 and 2
respectively and that a whole-class method is not disguised as a four-person
activity.

The qualitative `compatibility` block records practical cases that are useful
to inspect explicitly: offline, no-printer, one-learner, large-class,
mixed-ability, and remote use. Compatibility remains consistent with delivery
and resource declarations. A pair-only activity can be `adaptable` for one
learner when a remote or adult listening partner is documented, but it cannot
be directly supported as solitary work.

## Provenance and uncertainty

Source provenance still describes the supplied method evidence. Taxonomy
ratings are a separate project-authored assessment:

```yaml
taxonomy_assessment:
  claim_origin: project_authored_design
  reference_ids: []
  confidence:
    level: provisional
    rationale: Operational classification inferred from the normalized method description.
```

This prevents a source-supported method name from being confused with a
source-supported capability rating. A future source-backed classification must
name the evidence explicitly. Structural validation does not prove
effectiveness, age fit, or classroom feasibility.

### Migration status

All 30 activities from the #58 catalog were migrated. Twenty-nine retain one
operational block; `learning-stations` has three execution profiles, producing
32 deterministic query targets. The records do not reuse one mechanical
rating: primary and supporting capabilities, participant
ranges, facilitation effort, parent role, resources, and learner demands were
assessed from each normalized method description and, where present, concrete
execution profile. The production taxonomy has no `unknown` capability,
demand, resource, or effort ratings at this revision, but every activity- or
profile-level `taxonomy_assessment` remains `provisional` because a qualified
teacher has not reviewed the classifications. Existing method-level confidence
continues to express source and procedure confidence separately.

## Deterministic filtering

The helper filters validated execution targets and returns structured
`target_id`, `activity_id`, and nullable `execution_profile_id` values in
bytewise target order. It retains a deduplicated `activity_ids` list for
backward-compatible inspection, but profile identity is never discarded. It
does not calculate a weighted score, rank effectiveness, compose lesson phases,
call a network service, or use AI.

Run all committed fixtures:

```sh
npm run query:pedagogy
```

Run a committed fixture:

```sh
npm run query:pedagogy -- --fixture homeschool-low-support-retrieval
```

Or provide bounded filters:

```sh
npm run query:pedagogy -- \
  --grade 5 \
  --subject science \
  --delivery-mode homeschool \
  --group-size 1 \
  --capability retrieval \
  --max-parent-effort minimal \
  --offline \
  --no-printer
```

Use `--debug` to see deterministic target-specific exclusion reasons. The seven
production fixtures cover concept introduction, low-support homeschool
retrieval, low-support paper stations, safe practical work, map/diagram work,
retrieval with error correction, and large-class collaboration.

## Selection use

The issue #59 engine now uses these validated dimensions only after concrete
target expansion. Hard constraints use delivery, resources, demand, effort,
safety, and execution-profile facts. Visible project-authored integer weights
express operational fit to one request; they do not convert taxonomy ratings
into an effectiveness score. The complete model, trace, and limitations are
documented in [`lesson-pedagogy-engine.md`](lesson-pedagogy-engine.md).

Issue #60 can use parent effort, one-learner compatibility, offline/no-printer
conditions, safety supervision, and delivery limitations to design homeschool
support. It must preserve the parent/subject-teacher boundary.

Teacher review can later change a rating with evidence and updated confidence.
Until then, the taxonomy remains a useful provisional classification. It does
not modify production lessons, annual courses, teacher packs, review evidence,
readiness, or content fingerprints.

Only methods with a demonstrated operational difference are profiled. Profile
ratings and selection weights do not prove effectiveness, teacher validation
is still pending, production lessons are not migrated, and full homeschool
generation remains #60 scope.
