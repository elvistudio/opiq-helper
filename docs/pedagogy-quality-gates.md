# Pedagogical quality gates

Pedagogical quality gates are deterministic structural checks over already
validated pedagogy, lesson, homeschool, teacher-pack, review, and fingerprint
artifacts. They can establish `pedagogy_schema_valid` and
`structurally_complete`. They do not establish effectiveness, teacher approval,
classroom testing, home testing, readiness, or curriculum completeness.

## Architecture and validator ownership

The quality layer aggregates existing guarantees instead of replacing their
owners:

| Existing validator | Retained authority |
| --- | --- |
| `check-pedagogy-knowledge.mjs` | references, copyright, principles, activities, taxonomy, provenance |
| `check-pedagogy-selection.mjs` | request, hard filters, scoring trace, lesson DNA, versions and digests |
| `check-pedagogy-homeschool.mjs` | adaptation, adult roles, sessions, answer access, final safety |
| `check-lesson-plans.mjs` | lesson/thematic/annual schemas, sources, timing and curriculum links |
| `check-teacher-packs.mjs` | material index, paths, answer keys and reviewable content |
| `check-pedagogical-reviews.mjs` | review/trial evidence, fingerprints and stale-evidence rules |
| `compute-teacher-pack-fingerprint.mjs` | deterministic reviewable-content fingerprint |
| `check-pedagogy-integration.mjs` | production integration plus water-pilot-specific invariants |

The shared engine is
`scripts/lib/pedagogy-quality-gates.mjs`. It consumes normalized records and
does not contain grade-5 water lesson IDs, task IDs, or material IDs.
`scripts/lib/pedagogy-quality-production.mjs` is the explicit pilot adapter: it
loads the existing systems, projects their current guarantees into the shared
contract, and supplies the committed water report. Concrete lesson-3 checks
remain in the production integration validator.

The `schema-valid` projection validates the committed machine files read from
the current checkout, not generated baseline expectations and not YAML
parseability alone. Selection requests, selection decisions, lesson DNA,
homeschool requests, decisions, packages, parent guidance, weekly plans, and
the production integration index run through their existing strict Ajv
schemas. Unknown properties, missing required properties, invalid enums, and
invalid types are retained as artifact-level diagnostics. Each normalized
record receives only diagnostics from its dependency closure; any applicable
machine-schema error makes `pedagogy_schema_valid` and derived structural
completeness false.

Evaluation is deliberately two-stage. Every applicable primitive gate runs
first; only then do derived gates run. `structural-completeness` is derived
from the complete per-record primitive result set, so catalogue order cannot
hide a later timing, identity, safety, or alignment failure. A primitive
`passed` or exact `excepted` result satisfies the aggregate; error results and
missing evaluators do not. Warning-only and informational results remain
visible without becoming hidden blockers. Empty evaluation scope never
produces a positive structural claim.

Human review/trial and derived readiness are implemented by the separate
[evidence workflow](pedagogical-review-and-trial-workflow.md). Quality gates
consume its actual summary but never manufacture approval or trial evidence.
The separate [pedagogical regression framework](pedagogy-regressions.md)
composes these gates with selection and production artifacts. Focused quality
unit mutations prove individual evaluator behavior. End-to-end regression
cases instead mutate primary repository YAML/Markdown or evidence bindings in
isolated copies, reload the production adapter, and then execute these gates.
Selection architecture cases and architecture-output policy cases remain
separate from both. Regression invariant snapshots expose expected values,
actual values, and exact evidence references; loader-reported dependency paths
form their checked closure. Classroom safety and homeschool safety use their
respective delivery contracts, and collaboration is not inferred from a
non-individual format alone. These pilots preserve meaningful cross-engine
invariants without claiming representative curriculum coverage or
effectiveness.

## Versioned catalogue

`knowledge/pedagogy/quality/quality-gates.yaml` is catalogue version `1.1`.
Quality engine `1.1` extends the non-exemptible `readiness-honest@1.1` gate
with separate current classroom-review, homeschool-review, classroom-trial,
and home-trial evidence. This is a readiness-proof change, not an
effectiveness claim.
Every gate has a stable ID and version, applicability, severity, guarantee,
explicit non-guarantees, exception policy, and project-authored claim origin.
Changing a gate's meaning requires a gate-version update; changing catalogue
membership or shared policy requires a catalogue-version review.
Gate versions use an independent `major.minor` contract: one gate can advance
without forcing unrelated gates to adopt the same version. Configuration
validation requires exactly one executable primitive evaluator or one
registered derived handler for every catalogue gate, including gates whose
record kind is absent from the current production scope.

The current gates cover:

- schemas, references, versions, digests, lesson-DNA identity and fingerprint;
- goals and pattern-dependent lesson structure;
- component timing and stage reconciliation;
- immediate and delayed retrieval;
- Russian-primary and Estonian A1–A2-supported language roles;
- differentiation and operational accessibility metadata;
- classroom/home delivery, material closure and parent boundaries;
- practical safety;
- lesson-to-task-to-material-to-key alignment and answer leakage;
- source/pedagogy provenance separation;
- readiness honesty.

Applicability is explicit. A non-practical lesson does not fail for lacking a
practical policy, and a pattern is not forced to contain every possible phase.
Lesson duration comes from the lesson artifact; 45 minutes is not a universal
engine constant.

Safety applicability is derived from independent authoritative signals. When a
selected activity or execution profile declares
`safety.requires_adult_supervision`, that exact catalogue field makes the gate
applicable even if a downstream package flag is wrong. It is not inferred from
the spelling of `homeschool_parent.role`: `active_participant` and other
bounded adult roles do not cancel explicit safety metadata.

## Severity and diagnostics

Severity values are:

- `error`: structural validity fails and the command exits non-zero;
- `warning`: a bounded limitation remains visible but default CI can pass;
- `info`: a recorded non-error fact, including an applied valid exception.

Every diagnostic contains the gate ID/version, code, message, exact repository
path, and record ID. Related paths, expected/actual values, and exception ID
are included only when useful. Results and diagnostics use bytewise ordering,
and JSON output has no current timestamp.

Human-readable output and `--json` are built from the same diagnostics:

```bash
npm run test:pedagogy-quality
npm run check:pedagogy-quality
npm run check:pedagogy-quality -- --json
node scripts/check-pedagogy-quality.mjs --path lesson-plans/grade-5-science/water
node scripts/check-pedagogy-quality.mjs --strict-warnings
npm run check:pedagogy-quality-report
```

`--path` accepts only a canonical repository-relative POSIX file or directory
path. Absolute paths, traversal, backslashes, empty path segments, and
noncanonical forms are rejected. An explicit path that matches no quality
record fails with `no_quality_records_matched`; it cannot produce zero-record
positive claims. Path-scoped `--json` is a deterministic evaluation result
limited to the selected records and their actual dependency closure. It is not
the full committed production report, and report generation rejects a scoped
evaluation. Ordinary full-scope checks still leave unrelated routes alone.

`--strict-warnings` is intended for deliberate migration cleanup; production
CI normally permits the finite documented legacy warning set. `--report`
compares the computed report with exact committed bytes and never writes files.

## Exceptions

`knowledge/pedagogy/quality/quality-exceptions.yaml` stores exact-record
exceptions. An active record must name one current gate version, one artifact
path, one record ID, a Russian reason, lesson pattern, author role, and status.
Unknown gates, stale gate versions, duplicate IDs, and multiple exceptions for
the same exact target fail. Active exceptions also fail when the named artifact
or record does not exist, the path and record ID do not identify the same
normalized record, or the gate does not apply to that record kind. Retired
records are historical only and never apply.

Exceptions are not approvals. They may represent a justified nonstandard
pattern only when a gate declares `exact_record_only`. They cannot suppress:

- invalid schema or unknown references;
- version, catalogue, digest, content-identity, or fingerprint freshness;
- source/pedagogical provenance separation;
- learner answer leakage;
- unresolved material closure or cross-artifact alignment;
- safety requirements;
- readiness honesty or false effectiveness claims;
- final structural completeness.

Attempting to exclude one of these gates is itself a configuration error.

## Legacy migration policy

Integrated schema-1.2 pilot lessons receive the full contract. Schema-1.1
lessons remain under their existing validators and receive only the fixed
`legacy_artifact_not_integrated` warning. They are not required to invent
lesson DNA or homeschool packages, and unrelated grades or routes are not
made erroneous.

The committed water report currently has six such warnings for the six
water-use-cycle lessons. The warning means “not yet integrated”, not
“pedagogically defective”. Mass migration is outside this issue.

## Production report

`evaluations/pedagogy-quality/grade-5-water-quality-report.json` records:

- report schema `1.1`, quality engine `1.1`, and catalogue `1.1`;
- gate catalogue version and digest;
- current unit and lesson content identities;
- the recomputed pack-wide teacher-pack fingerprint, including algorithm,
  specification version, digest value, and file count;
- every artifact actually read in the declared dependency closure, including
  lessons, DNA, task/material/key/rendered files, thematic and integration
  indexes, practical policy, and linked evidence records;
- deterministic per-record gate results with exact artifact path and record ID;
- a separate aggregate gate summary that does not replace the audit trail;
- severity counts and structural status;
- the only permitted positive claims;
- explicit non-guarantees and readiness read from production artifacts.

The report has an explicit stable water-pilot scope: four integrated classroom
lessons, four homeschool packages, one thematic plan, one teacher-pack record,
and six intentional water-use-cycle legacy controls. A future unrelated lesson
does not change this report. Positive claims explicitly apply only to
integrated production records; legacy controls have
`integration_quality_status: not_evaluated`.

Readiness is not replaced with expected safe defaults. The report stores the
actual per-record values and a consistency-aware aggregate where differing
values become `mixed`. Evidence state comes from the existing review
repository. A current evidence fingerprint must exactly equal the recomputed
fingerprint in all four fields; a same-length but different hash or file count
is stale. Registering review metadata alone does not alter reviewable content.
Pending review with no completed evidence and readiness false is valid.
Approved, tested, or ready claims require current effective evidence.
Classroom and home trials remain distinct. Static generation readiness inside
reviewable artifacts stays a non-authoritative pending projection; mutable
evidence and derived readiness stay outside the fingerprint.

The report makes no claim about Git changes outside its evaluated scope.
Intentionally unchanged files belong in PR diff evidence, not in the
deterministic quality artifact.

`pass_with_warnings`, `pedagogy_schema_valid: true`, and
`structurally_complete: true` mean that applicable machine contracts reconcile.
They do not mean teacher-approved, pedagogically effective, classroom-tested,
home-tested, classroom-ready, homeschool-ready, or complete curriculum.

The production adapter projects real contracts rather than accepting prepared
booleans as evidence. Retrieval applicability is derived from pattern/request
intent; correction must occur after the first attempt; delayed retrieval is
resolved through the thematic plan and lesson order. Pattern requirements come
from versioned selection rules. Language support may be enabled or coherently
disabled. Safety applicability comes from source, selected activity, resources,
and adaptation decisions rather than one downstream flag. Reselected home
targets require the actual explicit adapted-task contract. Artifact paths must
be canonical, registered, regular files in the applicable closure.

## CI behavior

After knowledge, selection, homeschool, production-integration, and generated
pilot checks, CI runs:

```bash
npm run test:pedagogy-quality
npm run check:pedagogy-quality
npm run check:pedagogy-quality-report
```

An error fails the job. Warnings are printed but do not fail by default; info
never fails. The production warning vocabulary and exact count are regression
tested.

## Adding or changing a gate

1. Confirm the invariant is not already owned completely by an existing
   validator.
2. Add a bounded catalogue record in bytewise ID order.
3. Define applicability and non-guarantees before implementing the evaluator.
4. Reuse an existing schema or normalized adapter field instead of parsing a
   second artifact model.
5. Add valid and deliberate invalid mutation tests.
6. Decide whether the gate is non-exemptible; safety, leakage, provenance,
   identity, closure, readiness, and schema gates must remain so.
7. Update the gate version when semantics change.
8. Update the committed report and documentation.
9. Run the complete repository validation suite.

Structural validation remains a prerequisite for human review, not a
substitute for teacher judgement, classroom/home trial evidence, or readiness.
