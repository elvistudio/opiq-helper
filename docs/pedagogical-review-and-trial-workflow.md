# Pedagogical review, trial, and readiness workflow

This workflow records human evidence about pedagogical design without turning
structural CI into teacher approval. It keeps classroom evidence, homeschool
evidence, and derived readiness separate.

## Evidence architecture

Every completed record binds to one `evidence_identity`:

- the teacher-pack content fingerprint (`algorithm`, specification version,
  value, and file count);
- taxonomy, selection-rule, homeschool-rule, selection-engine, lesson-DNA,
  homeschool-engine, quality-engine, catalogue, integration, unit-content, and
  per-lesson DNA identities;
- semantic digests for taxonomy, selection rules, and homeschool rules, so a
  rule change is detected even if its author forgot to raise the version;
- a Git commit SHA used only as provenance.

The commit SHA may change without making evidence stale. Any mismatch in the
fingerprint or pedagogical snapshot makes completed evidence stale. The
snapshot is built from authoritative machine artifacts; it is not copied from
prose.

Reviewable content includes lesson and thematic YAML, lesson DNA, selection and
adaptation artifacts, guides, learner materials, keys, home materials, safety,
and delivery instructions. Human records, the evidence links in
`materials-index.yaml`, and readiness reports are excluded from the fingerprint.
This prevents the cycle “register evidence → change reviewed fingerprint →
invalidate the evidence”.

## Three independent evidence kinds

`teacher_review` evaluates method choice, lesson-pattern coherence, timing,
language load, retrieval and spacing, correction, assessment, differentiation,
autonomy, motivation, safety, resources, classroom feasibility, homeschool
clarity, parent role, and artificial or repetitive method risk. Its
`delivery_scopes` explicitly names `classroom`, `homeschool`, or both.

`classroom_trial` records aggregate execution evidence: planned versus actual
timing, setup and transitions, instruction comprehension, retrieval and
correction, recall and transfer, participation, language roles,
differentiation, lesson-DNA deviations, material usability, safety, and methods
that felt artificial or ineffective.

`home_trial` is not a classroom-trial alias. It records bounded categorical
observations about instruction comprehension, session duration, unplanned
adult support, learner independence, material availability, offline/printing
assumptions, retrieval and correction, language scaffolds, practical
authorization/supervision, prohibited actions, stop conditions, completion,
recall, and transfer.

Templates and drafts are instruments, not evidence. Superseded records remain
historical and never contribute to readiness.

Every record exposes distinct validation states:

- `schema_valid` means the strict document schema passed;
- `complete` means the human workflow reached a terminal review or analysed
  trial decision;
- `current` means every evidence-identity field matches the authoritative
  current pack state;
- `registerable` means the record is complete, current, privacy-safe,
  reference-valid, and carries a permitted positive or negative decision;
- `positive_effective` means a current approved review or successful trial may
  support readiness for its declared delivery scope;
- `negative_effective` means a current completed negative decision actively
  blocks its declared scope.

These meanings are intentionally separate. A `changes_required`, `rejected`,
or `repeat_trial_required` record is registerable audit evidence, but is never
positive readiness evidence.

## Active, historical, and superseded evidence

Active evidence is determined by explicit immutable lifecycle links, never by
filesystem order or array order. A successor lists exact record IDs in
`lifecycle.supersedes`. The validator rejects unknown records, self-links,
cycles, multiple successors for one record, incompatible delivery scopes, and
incomplete terminal successors. A successor must be current and registerable
when it is registered, but a later content/rule change may honestly make that
active terminal stale and therefore a readiness blocker without corrupting the
historical lifecycle graph.

Superseded records, their findings, required changes, safety notes, and stale
identity remain in report history but do not support or block readiness.
Historical stale evidence by itself cannot support readiness. A current
negative record remains an active blocker until an explicit valid successor
supersedes it; registering an unrelated current positive record does not erase
the negative decision.

## Offline JSON workflow

The teacher does not need to edit YAML.

Prepare an explicit dated bundle:

```sh
npm run prepare:pedagogy-evidence -- \
  --pack teacher-packs/grade-5-science/water/materials-index.yaml \
  --kind teacher-review \
  --id grade-5-science-water-teacher-review-2026-08-01 \
  --date 2026-08-01 \
  --output tmp/water-review
```

Supported kinds are `teacher-review`, `classroom-trial`, and `home-trial`. The
command creates `checklist.md` and strict `intake.json`, including the current
fingerprint, pedagogical snapshot, artifact checklist, lesson/target
references, privacy rules, and non-guarantees. The record ID and date are
always explicit; the tool does not derive an ID or read the current clock.
The output path must be canonical and repository-relative, must not traverse a
symlink, and may not be placed inside reviewable teacher-pack content.

After filling the JSON, normalize it deterministically:

```sh
npm run normalize:pedagogy-evidence -- \
  --input tmp/water-review/intake.json \
  --output pedagogical-reviews/grade-5-science/water/review-normalized.yaml
```

Normalization validates the intake schema, current identity, references, and
privacy declaration, then emits canonical YAML. JSON syntax is strict and
duplicate object keys are rejected before schema validation. Normalization
does not register evidence.

Registration is a separate explicit write:

```sh
npm run register:pedagogy-evidence -- \
  --pack teacher-packs/grade-5-science/water/materials-index.yaml \
  --input pedagogical-reviews/grade-5-science/water/review-normalized.yaml \
  --target pedagogical-reviews/grade-5-science/water/records/grade-5-science-water-teacher-review-2026-08-01.yaml \
  --write
```

Registration accepts current completed `registerable` evidence, including
completed negative decisions. It derives classroom and homeschool review
statuses independently from the entire active evidence set, validates the
whole resulting review repository, builds and schema-validates readiness, and
verifies that fingerprint algorithm, specification version, value, and file
count are unchanged.

The link keeps two authoritative mode-specific statuses. Its optional aggregate
uses only `pending`, `partial`, `approved_for_both`, `changes_requested`, or
`rejected`; it never turns a classroom-only approval into a global approval.

The target is immutable by default. It must be the canonical
pack-specific `records/<record-id>.yaml` path and must not be a symlink. A
different existing file fails with `pedagogical_evidence_target_exists`.
Byte-identical already-linked input is an idempotent retry and does not create a
second link.

The implementation prepares sibling staging files, checks that the materials
index bytes have not changed since they were read, validates the staged
repository state, and renames the files only after the checks pass. A detected
concurrent index change or validation/fingerprint failure rolls back the files
written by this process without discarding a concurrently added evidence link.
This is a bounded best-effort local transaction, not a claim of crash-safe ACID
storage.

Validation commands:

```sh
npm run check:pedagogy-evidence
npm run check:pedagogy-readiness
npm run check:pedagogy-readiness-report
```

## Findings and decisions

Finding severities are `blocking`, `major`, `minor`, and `observation`.
Blocking and major findings must not remain open for an approved review or a
successful trial. `approved_with_minor_notes` permits only bounded minor work
when every open/planned minor finding has a direct referenced plan or a linked
required change with resolution references. Plain `approved` has no open minor
finding. `successful_with_notes` never permits an open blocking or major safety
finding.

Blocking and major safety findings are safety blockers. A minor safety finding
is allowed only with `successful_with_notes` and a documented referenced plan;
an observation is an audit note rather than an automatic blocker. A successful
or successful-with-notes trial requires `safe_to_repeat: true`;
`repeat_trial_required` requires `false`.

Analysed trials require meaningful aggregate evidence rather than empty arrays.
Classroom trials cover every context lesson with timing and categorical
observations, including instruction, retrieval/correction when applicable,
recall/transfer, participation/completion, language support, materials,
method execution, practical safety when applicable, and explicit
observed/no-observed lesson-DNA deviation state. Home trials cover every
context lesson with session observations for instruction, independence,
bounded adult role, materials and offline assumptions, retrieval/correction,
language scaffolds, completion, recall/transfer, and practical safety when
applicable. `not_observed` is explicit missing evidence and cannot silently
satisfy a required dimension of a successful decision.

Teacher-review ratings are delivery-scope aware. A classroom-only review marks
homeschool clarity and parent-role realism `not_applicable` with a rationale; a
homeschool-only review does the same for classroom feasibility. Applicable
dimensions cannot be bypassed with `not_applicable`.

All findings and observations are reference-checked against the actual pack
integration closure: lesson IDs, phase IDs, selected target IDs, artifact
paths, delivery scopes, practical applicability, and bounded home-adult roles
must resolve consistently.

Teacher approval does not complete a trial. A successful trial does not approve
the design. Neither is evidence of comparative pedagogical effectiveness.

## Readiness truth table

| Current evidence | Classroom | Homeschool |
|---|---:|---:|
| Structural quality only | false | false |
| Teacher review only | false | false |
| Trial only | false | false |
| Classroom-scoped review + classroom trial | true | false |
| Homeschool-scoped review + home trial | false | true |
| Stale evidence | false | false |
| Current completed negative review/trial | false for its declared scope | false for its declared scope |
| Superseded historical negative evidence + valid current successor | determined by successor | determined by successor |
| Open blocking/major or safety finding | false | false for the affected mode |

In addition, classroom readiness requires resolved/print-ready materials.
Homeschool readiness requires the resolved home material closure, bounded adult
role, and current home-safety evidence where applicable. Classroom and home
trials never substitute for each other.

The report at
`evaluations/pedagogy-readiness/grade-5-water-readiness-report.json` is derived
state outside the reviewable fingerprint. The current committed pilot has zero
effective reviews or trials and remains not ready in both modes.
Its audit trail separates `active_evidence`, `historical_evidence`,
`superseded_evidence`, `stale_evidence`, `readiness_supporting_evidence`, and
`readiness_blocking_evidence`. Classroom and homeschool review summaries have
separate statuses, counts, and exact evidence paths.

## Privacy

Do not store learner or family names, birth dates, identifiers, addresses,
contacts, recordings, health/diagnostic information, identifiable grades,
identifiable profiles, or identifiable free text. Home evidence about one
learner still uses bounded categorical observations and stores family identity
externally.

`reviewer_reference` is optional and may contain only a bounded opaque external
slug such as `science-reviewer-02`. Names, spaces, email addresses, phone
numbers, and URLs are rejected; the actual reviewer identity stays in an
external system.

The automatic guard conservatively detects common email, phone, identity-code,
postal-address, private-media, and recording references. It cannot prove that
all direct or indirect identifiers are absent. Every completed record therefore
requires manual privacy attestation and free-text review.

## Non-guarantees and boundaries

Readiness is exact-version operational evidence, not an effectiveness score,
official-curriculum completeness claim, or permanent approval. Structural
quality remains independent from human review. Regression fixtures contain
only synthetic temporary evidence and never become production evidence.
