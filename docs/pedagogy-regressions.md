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
non-guarantees, and provenance.

The five case kinds answer different questions:

- `production_classroom` checks actual integrated classroom records;
- `production_homeschool` checks actual adapted packages and their production
  closure;
- `architecture_only` checks a selection request without presenting the result
  as production material;
- `deliberate_failure` proves that an invalid semantic mutation is rejected;
- `stale_evidence` proves that stale versions, identities, fingerprints, or
  evidence cannot support a positive structural/readiness claim.

Architecture-only cases include map/data interpretation, ecosystem
comparison, scaffolded concept work, self-explanation, and a justified teacher
override that preserves its exact slot, target, and rationale. They remain
provisional design evidence and never become generated lessons or readiness
evidence.

## Semantic execution

`scripts/lib/pedagogy-regressions.mjs` loads the existing repositories and
executes local handlers. Production handlers read the committed quality
records. Architecture handlers run the real selection engine. Failure handlers
make bounded in-memory changes to real normalized inputs and require the
existing validator diagnostic. There is no hidden score, random seed, current
time, or network fallback.

A case passes only when all declared invariants pass. Examples include:

- the chosen target has the required capability and delivery context;
- retrieval begins source-closed and retains a later correction/key policy;
- subject and Estonian-language assessment remain separate;
- practical work retains authorization, adult supervision, stop conditions,
  and the resolved home-material contract;
- parent support does not become subject teaching;
- stale identity or evidence blocks the positive claim it would otherwise
  support.

Deterministic output alone is not enough. A meaningful semantic change alters
the report digest, while object-key ordering does not.

## Committed report

`evaluations/pedagogy-regressions/grade-5-regression-report.json` is a
deterministic semantic snapshot governed by
`schemas/pedagogy-regression-report.schema.json`. It records:

- engine and upstream contract versions;
- fixture, activity-catalogue, and quality-catalogue digests;
- current scientific content identities and teacher-pack fingerprint;
- every case, diagnostic, selected target, and invariant result;
- the exact sorted artifact dependency closure;
- explicit false readiness/effectiveness/curriculum-completeness claims;
- stable counts by case kind and invariant status.

The report contains no generation timestamp. A report check regenerates its
normalized bytes and rejects staleness. Review or evidence-only metadata does
not alter the reviewable teacher-pack fingerprint.

## Commands

```sh
npm run test:pedagogy-regressions
npm run check:pedagogy-regressions
npm run generate:pedagogy-regression-report
npm run check:pedagogy-regression-report
```

The check command is read-only. The generate command is the only command that
writes the committed report. CI runs the test, semantic check, and committed
report freshness check after the pedagogy quality checks.

## Adding a case or extending scope

1. Choose an existing validated selection fixture or an actual normalized
   production record.
2. Declare a canonical repository-relative source scope.
3. Reuse an existing handler when it expresses the intended semantics.
4. Add a narrowly named handler only when the case cannot be expressed by an
   existing selection, quality, or policy mutation.
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
