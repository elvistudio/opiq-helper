# Pedagogical regression pilots

Pedagogical regression pilots are deterministic semantic checks over the
existing pedagogy stack. They compose the validated activity catalogue,
selection engine, lesson DNA, homeschool adapter, production integration,
quality gates, teacher-pack fingerprint, and review-evidence model. They do
not create a second selection model and do not call AI or network services.

The initial suite is intentionally bounded to grade-5 science examples and the
four-lesson water production pilot. It demonstrates reusable contracts; it
does not claim representative curriculum coverage, official completeness,
pedagogical effectiveness, teacher approval, trial completion, or readiness.

## Contracts

The strict fixture is
`knowledge/pedagogy/regressions/grade-5-regression-cases.yaml`. Its schema is
`schemas/pedagogy-regression-cases.schema.json`. Each bytewise-sorted case has
a stable ID, one bounded case kind, an explicit source scope, an executable
handler, expected diagnostics or selections, semantic invariants,
non-guarantees, provenance, and an explicit `mutation` contract. Baseline
cases use `mutation: null`. Negative cases distinguish
`repository_artifact`, `selection_request`, and
`generated_architecture_output`; each mutation names its primary path, stable
mutation ID, and expected changed fields.

The six case kinds answer different questions:

- `production_classroom` checks actual integrated classroom records;
- `production_homeschool` checks actual adapted packages and their production
  closure;
- `architecture_only` checks a selection request without presenting the result
  as production material;
- `deliberate_failure` proves that an invalid semantic mutation is rejected;
- `stale_evidence` proves that stale versions, identities, fingerprints, or
  evidence cannot support a positive structural/readiness claim.
- `evidence_readiness` runs 35 temporary-artifact cases for the shared evidence
  identity, classroom/home truth table, privacy, normalization, registration
  rollback, fingerprint boundary, active/superseded history, and
  delivery-scoped negative evidence.

Architecture-only cases include map/data interpretation, ecosystem
comparison, scaffolded concept work, self-explanation, and a justified teacher
override that preserves its exact slot, target, and rationale. They remain
provisional design evidence and never become generated lessons or readiness
evidence.

## Semantic execution

`scripts/lib/pedagogy-regressions.mjs` loads the existing repositories and
executes local handlers. Production handlers read the committed quality
records. Architecture handlers run the real selection engine and resolve each
selected activity or execution profile back to its catalogue contract.
Production and stale failure handlers copy the repository to isolated
temporary roots, mutate real primary YAML/Markdown or temporary evidence
bindings, and reload the existing adapters. Mutating a normalized quality
boolean is not accepted as end-to-end evidence. Selection-request and
architecture-output policy mutations remain separately labelled. There is no
hidden score, random seed, current time, or network fallback.

A case passes only when all declared invariants pass. Examples include:

- the resolved activity/profile supports the requested grade, subject,
  delivery, group format, language ceiling, and required capability;
- retrieval begins source-closed and retains a later correction/key policy;
- subject and Estonian-language assessment remain separate;
- classroom practical safety is derived from classroom lesson DNA and selected
  activity safety, while home safety is derived separately from the resolved
  package, authorization, supervision, and home-material contract;
- collaboration requires non-individual execution plus collaborative/peer
  semantics; a merely non-individual format does not pass by itself;
- quiet individual work requires individual execution without a selected
  target that primarily requires collaboration or peer explanation;
- parent support does not become subject teaching;
- stale identity or evidence blocks the positive claim it would otherwise
  support.
- a current negative classroom decision blocks classroom readiness without
  inventing a homeschool blocker;
- explicitly superseded findings, safety blockers, and stale identity remain
  auditable but do not override a valid current successor;
- stale classroom-only history cannot block current homeschool readiness, and
  stale homeschool-only history cannot block classroom readiness.

Deterministic output alone is not enough. A meaningful semantic change alters
the report digest, while object-key ordering does not.

## Committed report

`evaluations/pedagogy-regressions/grade-5-regression-report.json` is a
deterministic semantic snapshot governed by
`schemas/pedagogy-regression-report.schema.json`. It records:

- engine and upstream contract versions;
- fixture, activity-catalogue, and quality-catalogue digests;
- current scientific content identities and teacher-pack fingerprint;
- every case, diagnostic, selected target, and invariant result; each invariant
  includes a reviewable summary, expected value, actual value, and exact
  evidence paths or stable semantic references;
- the exact bytewise-sorted dependency closure reported by the loaders,
  including schemas, catalogues, source inputs, generated machine artifacts,
  materials, answer keys, and evidence actually read;
- per-case `ephemeral_checked_artifacts` for temporary schema-valid
  review/trial evidence read inside an isolated mutation fixture; these paths
  remain evidence refs but are intentionally excluded from the committed
  regular-file closure after fixture cleanup;
- explicit false readiness/effectiveness/curriculum-completeness claims;
- stable counts by case kind and invariant status.

The report contains no generation timestamp. The full test and explicit
generation command execute every temporary-artifact scenario. The read-only
check commands then validate the committed strict schema, fixture/case
identities, upstream versions and digests, scientific content identities,
current teacher-pack fingerprint, and every path in the declared dependency
closure. This avoids executing the same 35 repository-copy scenarios three
times in one CI job without weakening the E2E test that precedes the checks.
A missing or non-regular dependency, changed fixture/catalogue identity, stale
fingerprint, or stale report contract fails the check. Review or evidence-only
metadata does not alter the reviewable teacher-pack fingerprint.

## Commands

```sh
npm run test:pedagogy-regressions
npm run check:pedagogy-regressions
npm run generate:pedagogy-regression-report
npm run check:pedagogy-regression-report
```

The check commands are read-only. The generate command is the only command
that executes all scenarios and writes the committed report. CI runs the full
E2E test first, followed by the semantic identity/closure check and committed
report freshness check after the pedagogy quality checks.

## Adding a case or extending scope

1. Choose an existing validated selection fixture or an actual normalized
   production record.
2. Declare a canonical repository-relative source scope.
3. Declare `mutation: null` for a baseline, or name the exact mutation level,
   primary artifact, mutation ID, and changed fields for a negative case.
4. Reuse one of the separated production-baseline, selection,
   repository-artifact, or architecture-output-policy handlers. Add a handler
   only when its evidence layer is genuinely different.
5. Declare observable semantic invariants and explicit non-guarantees.
6. Keep the fixture bytewise sorted and update the strict schemas only for a
   genuine contract change.
7. Regenerate the report and run all pedagogy, production, fingerprint, review,
   and repository checks.

A new grade or subject should first have valid source routing and, for
production cases, an integrated artifact closure. Architecture-only cases may
exercise applicability before production material exists, but must remain
clearly labelled and cannot set readiness. Do not substitute adjacent-grade
content or treat a fixture as a curriculum map.

Human teacher review and classroom/home trials remain separate evidence
workflows. The framework can prove that stale or missing evidence is rejected;
it cannot manufacture that evidence or validate pedagogical effectiveness.
Evidence-readiness scenarios use only synthetic records in isolated temporary
repository copies and reload the production review, quality, fingerprint, and
readiness adapters.
