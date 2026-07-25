# Pedagogical review, trial, and readiness workflow

This workflow records human evidence about pedagogical design without turning
structural CI into teacher approval. It keeps classroom evidence, homeschool
evidence, and derived readiness separate.

## Evidence architecture

Every completed record binds to one `evidence_identity`:

- the teacher-pack content fingerprint (`algorithm`, specification version,
  value, and file count);
- taxonomy, selection-rule, selection-engine, lesson-DNA, homeschool-engine,
  quality-engine, catalogue, integration, unit-content, and per-lesson DNA
  identities;
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
  --target pedagogical-reviews/grade-5-science/water/records/teacher-review-2026-08-01.yaml \
  --write
```

Registration accepts only current, completed, effective evidence. It writes the
record, updates the explicit link, refreshes the readiness report, and verifies
that fingerprint algorithm, specification version, value, and file count are
unchanged. Any fingerprint change aborts and rolls back the evidence, link, and
derived readiness-report write.

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
with a recorded plan and resolution references. `successful_with_notes` never
permits an open safety blocker.

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
| Open blocking/major or safety finding | false | false for the affected mode |

In addition, classroom readiness requires resolved/print-ready materials.
Homeschool readiness requires the resolved home material closure, bounded adult
role, and current home-safety evidence where applicable. Classroom and home
trials never substitute for each other.

The report at
`evaluations/pedagogy-readiness/grade-5-water-readiness-report.json` is derived
state outside the reviewable fingerprint. The current committed pilot has zero
effective reviews or trials and remains not ready in both modes.

## Privacy

Do not store learner or family names, birth dates, identifiers, addresses,
contacts, recordings, health/diagnostic information, identifiable grades,
identifiable profiles, or identifiable free text. Home evidence about one
learner still uses bounded categorical observations and stores family identity
externally.

The automatic guard conservatively detects common email, phone, identity-code,
postal-address, private-media, and recording references. It cannot prove that
all direct or indirect identifiers are absent. Every completed record therefore
requires manual privacy attestation and free-text review.

## Non-guarantees and boundaries

Readiness is exact-version operational evidence, not an effectiveness score,
official-curriculum completeness claim, or permanent approval. Structural
quality remains independent from human review. Regression fixtures contain
only synthetic temporary evidence and never become production evidence.
