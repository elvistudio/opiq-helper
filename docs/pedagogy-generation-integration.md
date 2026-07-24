# Pedagogy generation integration

Issue #61 connects the existing lesson-plan, pedagogy-selection, homeschool,
teacher-pack, fingerprint, and readiness systems. It does not create a second
lesson format. The grade-5 science water unit is the only production pilot.

## Authority and pipeline

The lesson YAML remains authoritative for scientific content, canonical Opiq
evidence, objectives, expected answers, safety, language targets, and
assessment criteria. `pedagogical_integration.selection_input` supplies only
explicit delivery constraints that cannot be inferred safely, including the
classroom productive-language ceiling and the complete homeschool variant,
adult-availability boundary, session limits, and key-release mode. The generator
then calls the existing selection engine 1.1 and homeschool engine 1.0:

```text
source-backed lesson YAML
→ selection request
→ decision and lesson DNA
→ stage/phase/material binding
→ classroom rendering
→ strict homeschool adaptation
→ parent guidance and relative weekly plan
→ cross-artifact checks
→ teacher-pack fingerprint
```

No AI, network call, randomness, current timestamp, or free-prose source
inference participates in generation.

## Schema migration

Legacy and integrated versions coexist:

| Artifact | Legacy | Integrated |
|---|---:|---:|
| lesson plan | 1.1 | 1.2 |
| thematic plan | 1.1 | 1.2 |
| teacher-pack index | 1.2 | 1.3 |

An integrated version must contain the integration contract; a legacy version
cannot contain it. Unrelated production units therefore remain valid without a
mass migration.

## Content identity

SHA-256 content identity covers source identity and URLs, content objectives,
subject success criteria, misconceptions, existing questions and expected
answers, practical procedure and safety, assessment, and the Russian-primary /
Estonian-supported language-policy identity. It excludes selected methods,
timing, generated paths, readiness, review/trial status, timestamps, and Git
commit identity. Semantically set-like arrays are sorted bytewise.

Classroom and homeschool artifacts are linked to the same lesson content
identity in `pedagogy/integration-index.yaml`. Changing a scientific answer,
source URL, or safety control changes the identity; changing delivery timing or
readiness does not.

## Stage and timing reconciliation

Every consuming DNA phase binds to one or more existing stage IDs. The bound
stage time must cover the activity minimum. DNA setup, cleanup, transitions,
and reserve remain visible in the DNA total; the full proposal must fit the
unchanged 45-minute lesson. Any unbound lesson stage needs an explicit non-DNA
role and rationale. Duplicate, unknown, or missing stage bindings fail.

The compact practical profile describes one teacher-prepared observation, not
rotating stations. It keeps adult supervision, controlled materials, setup,
cleanup, measurement, observation, and evidence-based conclusion visible while
fitting the existing lesson.

## Generated regions and audience boundaries

The renderer owns only regions enclosed by:

```html
<!-- OPIQ-PEDAGOGY:BEGIN lesson=… audience=… -->
<!-- OPIQ-PEDAGOGY:END lesson=… audience=… -->
```

Manual text outside a region is preserved. Missing, duplicate, nested, or
broken markers fail. Teacher regions show pattern/target metadata and
reconciliation. Student regions show observable actions, source-open/closed
rules, first attempt, and visible correction, without taxonomy IDs, scoring,
or override internals. The integration index and answer-key regions bind each
generated task ID to its lesson, DNA phase, exact target, student artifact,
answer-key artifact, source-access rule, and post-attempt key-release policy.
Answer guidance also keeps expected evidence, misconceptions, and separate
subject/language evaluation visible.

## Language and assessment

Complex concepts, causal reasoning, misconceptions, and full subject answers
remain Russian-primary. Estonian A1–A2 support is bounded to terminology,
labels, familiar instructions, sentence frames, and short oral or written
responses already present in the lesson. Subject and Estonian evidence remain
separate; an Estonian form error does not automatically reduce the science
result.

## Homeschool adaptation

Each homeschool request reproduces the exact classroom request and lesson DNA
before adaptation. Content bindings are phase-specific and refer to existing
learner materials, answer keys, teacher explanations, Estonian support,
procedure, and safety. Keys remain closed for the first attempt, corrections
remain visible, and the parent is never made the subject teacher.

Lesson 3 is `parent_child`, requires teacher authorization and adult safety
supervision, and permits only passive ice melting and cold-surface observation:
no kettle, stove, open flame, or child handling of a hot vessel. Other lessons
use the explicit `independent` variant. Variant selection is read from each
lesson contract; it is never inferred from lesson position or prose.

Delayed retrieval uses only `after_lessons`, `after_days`, or `next_unit`;
absolute learner dates and personal progress storage are prohibited.

## Fingerprint and readiness

The generated `pedagogy/` and `homeschool/` directories are reviewable content,
so generation changes the teacher-pack content fingerprint. The materials
index and review/trial evidence remain excluded under fingerprint specification
1.0. A new fingerprint requires fresh human evidence.

Structural generation does not prove pedagogical effectiveness, independent
review, classroom testing, or home testing. The pilot remains:

- teacher review: pending;
- classroom trial: not tested;
- home trial: not started;
- `classroom_ready: false`;
- `homeschool_ready: false`.

## Commands

```bash
npm run generate:pedagogy-water-pilot -- --write
npm run generate:pedagogy-water-pilot -- --check
npm run generate:pedagogy-water-pilot -- --summary
npm run generate:pedagogy-water-pilot -- --lesson grade-5-water-01-properties --debug
npm run test:pedagogy-integration
npm run check:pedagogy-integration
```

The generator defaults to a read-only summary. `--write` is the only mutation
mode; `--check` compares exact committed bytes.
