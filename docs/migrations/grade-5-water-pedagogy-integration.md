# Grade 5 water pedagogy integration migration

This report records the issue #61 production pilot. It is an integration
migration, not a new science unit and not evidence of pedagogical
effectiveness.

## Scope and base

- base commit: `857c3a9156ed8cc2a75f2ace3e89f5782217a6cc`;
- canonical route: `grade-5-science`;
- pilot: the existing four-lesson unit `grade-5-water-four-lesson-plan`;
- lesson duration: four unchanged 45-minute lessons;
- source, scientific explanation, questions, expected answers, safety,
  assessment, and language targets remain authoritative in lesson YAML;
- the water-use-cycle unit is an unchanged control.

No Opiq source, curriculum map, annual-course artifact, completed review, or
trial record is part of the migration.

## Schema migration

Legacy and integrated artifacts intentionally coexist.

| Artifact | Legacy | Integrated |
|---|---:|---:|
| lesson plan | 1.1 | 1.2 |
| thematic plan | 1.1 | 1.2 |
| teacher-pack index | 1.2 | 1.3 |

The four pilot lessons, their thematic plan, and the water materials index use
the integrated versions. Other units can remain on the legacy versions.

## Content identities and selection

Content identities bind source-backed lesson meaning independently of Git
history and selected teaching methods.

| Lesson | Content identity | Pattern | Selected targets |
|---|---|---|---|
| `grade-5-water-01-properties` | `0f2349bf0578585a1d0ed4db3d9fe2953214529ffb779d22d9c52c4c60238442` | `concept-introduction-classroom` | `brainstorming`, `guided-reading`, `concept-map`, `one-minute-recall`, `retrieval-self-test` |
| `grade-5-water-02-states` | `5c8b38d9daccc03a7b22117f6aad9a9418572a6c7edec4552a7a8b1acbecb78d` | `concept-introduction-classroom` | `brainstorming`, `frayer-model`, `concept-map`, `one-minute-recall`, `retrieval-self-test` |
| `grade-5-water-03-melting-condensation` | `32a3430cb83af3d6c64aa8450d868a15de6797f3f94575697ae25199f8934204` | `safe-practical-investigation` | `brainstorming`, `learning-stations::practical-compact-teacher-prepared-observation`, `concept-map`, `retrieval-summary` |
| `grade-5-water-04-changes-review` | `f5a824360088414a60778d5d32b7c9f03f4857744f021b820242a1dcd8be7bc5` | `retrieval-and-consolidation` | `retrieval-self-test`, `error-correction`, `concept-map` |

Unit content identity:
`74bbe42dbe3b6256ad35090b338642abd14c05110ab69d0ea6be0fd4391d6c76`.

Selection request and lesson-DNA digests:

| Lesson | Request digest | Lesson-DNA digest |
|---|---|---|
| 01 | `49f9723c2e5386ce1572a798f78b6b0408436a26136a014ee33ac20b70ad57bc` | `e87dcd1c73d00a0ca566041e939c4e1613520ab4e61b4965bc39556e56a6c822` |
| 02 | `58a86b341a3deaf6a21da9d35b119035038aaa9b54839026fe1aa0051ca49108` | `3889d63ee96d8b27b69ad9025487619be2730191be30da9718b61d08f0255685` |
| 03 | `c340b4d7895265b4841001523e2148c46542b47bfb98f6d1ed229a0b076aa1de` | `3eee4d3fa0d4ff93c9724f103de6a6e1329a161c2fcda78616f66884c69f46d0` |
| 04 | `6a3b25de91d7efa943658eb6541b88825e88f7f39aa79b0a78a34878ebc77ff3` | `45162c36b928493d21a09861e2860032231b97a839023709ae9ee70afb831959` |

Per-lesson rendering and boundary status:

| Lesson | Classroom renderings | Homeschool package | Timing | Safety | Language |
|---|---|---|---|---|---|
| 01 | `lessons/lesson-01.md`, `student/lesson-01-properties-worksheet.md`, `answers/lesson-01-answer-key.md` | `pedagogy/homeschool/lesson-01-package.yaml` | reconciled | ordinary classroom controls | Russian-primary, Estonian A1–A2 |
| 02 | `lessons/lesson-02.md`, `student/lesson-02-states-worksheet.md`, `answers/lesson-02-answer-key.md` | `pedagogy/homeschool/lesson-02-package.yaml` | reconciled | ordinary classroom controls | Russian-primary, Estonian A1–A2 |
| 03 | `lessons/lesson-03.md`, `student/lesson-03-phase-change-diagram.md`, `answers/lesson-03-answer-key.md` | `pedagogy/homeschool/lesson-03-package.yaml` | reconciled | teacher-controlled classroom practical; authorized adult-supervised home observation | Russian-primary, Estonian A1–A2 |
| 04 | `lessons/lesson-04.md`, `student/lesson-04-review-sheet.md`, `answers/lesson-04-answer-key.md` | `pedagogy/homeschool/lesson-04-package.yaml` | reconciled | ordinary classroom controls | Russian-primary, Estonian A1–A2 |

Paths in this table are relative to
`teacher-packs/grade-5-science/water/`.

The compact practical profile is a provisional project-authored operational
profile for one teacher-prepared observation. It preserves adult supervision,
controlled materials, setup, cleanup, observation, measurement, and an
evidence-based conclusion without falsely describing the lesson as rotating
stations.

## Timing reconciliation

All lesson stages still total 45 minutes. Phase bindings reference existing
stage IDs, expose setup and cleanup, and meet each selected activity's minimum.

| Lesson | Activity | Setup | Cleanup | Transition | Reserve | DNA planned | Unallocated |
|---|---:|---:|---:|---:|---:|---:|---:|
| 01 | 26 | 14 | 0 | 0 | 3 | 43 | 2 |
| 02 | 28 | 14 | 0 | 0 | 3 | 45 | 0 |
| 03 | 25 | 10 | 2 | 1 | 3 | 41 | 4 |
| 04 | 16 | 10 | 0 | 0 | 3 | 29 | 16 |

Unallocated DNA time is not hidden additional teaching time. It is time in
the unchanged lesson stages not consumed by the selected activity minimum,
setup, cleanup, transition, or reserve.

## Generated artifacts

The deterministic generator checks 55 files:

- 12 classroom YAML artifacts: request, decision, and lesson DNA for each
  lesson;
- 20 homeschool YAML artifacts: request, decision, package, parent guidance,
  and relative weekly plan for each lesson;
- one integration index;
- four child-facing homeschool renderings;
- four parent-guidance renderings;
- one oral-preparation sheet and one answer-guidance file;
- bounded generated regions in four teacher lesson guides, four student
  materials, and four answer keys.

Machine artifacts live below
`teacher-packs/grade-5-science/water/pedagogy/`. Homeschool renderings live
below `teacher-packs/grade-5-science/water/homeschool/`. Generated regions use
stable markers; manual text outside them remains generator-independent.
The integration index contains one task binding for every selected DNA phase:
task, lesson, phase, target, student path, answer-key path, source-access
policy, and post-attempt answer-access policy.

## Homeschool and language boundaries

Lessons 1, 2, and 4 use the independent variant. Lesson 3 uses the
parent-child variant with teacher authorization and adult safety supervision.
These variants, adult availability, session limits, total productive-language
ceilings, and answer-key release modes are explicit lesson-contract input; the
generator does not infer them from lesson position.
The home practical permits passive ice melting and observation of a cold
surface only. It forbids a kettle, stove, open flame, and child handling of a
hot vessel.

Russian remains the language of scientific explanation, causal reasoning,
misconception correction, and full subject answers. Estonian remains bounded
to A1–A2 terminology, labels, familiar instructions, sentence frames, and
short oral or written output. Subject and language evidence stay separate.

Relative retrieval is machine-readable through `after_lessons` and
`next_unit`. No learner names, absolute study dates, or personal progress
records are stored.

## Fingerprint and evidence boundary

Before migration, the water teacher-pack fingerprint was
`130807477db124b3bc4de413e1c921cfcc57284872d0f16bfd2cbff8ac2198ba`
over 32 files.

After migration, it is
`ea1fa532caf106222b3b77989755202fb8f5be21f83ba7b93cae07acd5887357`
over 75 files. This intentional change means any future review or trial must
reference the migrated reviewable content.

The water-use-cycle control fingerprint remains
`9db2c9e754ec57cc65b9892ee6230b700188e3be77ea2b328757873787d36a98`
over 44 files.

No completed review or analysed trial evidence was created. The pilot remains:

- teacher review: pending;
- classroom trial: not tested;
- home trial: not started;
- classroom ready: false;
- homeschool ready: false;
- effectiveness claim: false.

## Validation results

- clean dependency install: passed;
- all registered `test:*` scripts: 1,003 passed, 0 failed;
- aggregate `node --test`: 1,003 passed, 0 failed;
- pedagogy knowledge: 144 passed;
- pedagogy selection: 142 passed;
- pedagogy homeschool: 179 passed;
- pedagogy integration: 24 passed;
- lesson plans: 91 passed;
- teacher packs: 16 passed;
- fingerprints: 41 passed;
- all registered `check:*` commands: passed;
- integration check: four lessons, 33 machine YAML artifacts, 55 checked
  generated/rendered files, and three honest readiness warnings;
- strict parsing: 71 JSON and 97 YAML files;
- strict Ajv: 34 schemas;
- source manifest: 29 routes and 7,828 Markdown records;
- QA metadata: 28 current snapshots;
- two consecutive generation writes: byte-identical;
- source, curriculum, annual-course, evidence, control-pack, PDF/DOC, symlink,
  and personal-data scope guards: passed.

## Known limitations and deferred work

- Method selection and homeschool adaptation are deterministic operational
  proposals, not proof that the method is effective for a particular class.
- The compact practical profile and all generated pedagogy require human
  teacher review.
- Relative `next_unit` retrieval is intentionally unresolved until a later
  unit supplies a concrete lesson binding.
- The pilot does not migrate other units or generate a complete homeschool
  course.
- Readiness updates, real pedagogical review, classroom trials, and home trials
  remain separate evidence-bearing work.
