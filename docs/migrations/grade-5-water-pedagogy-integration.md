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
| `grade-5-water-01-properties` | `7fb21388371109e4a08ba5df171d2d8fcdbd05a1460d29c88398950ebd7dbee9` | `concept-introduction-classroom` | `brainstorming`, `visual-representation::paper-diagram`, `venn-diagram`, `concept-map`, `error-correction` |
| `grade-5-water-02-states` | `3708cc17ac3d5b3462060af7fd18a0c0b63d1ff8d918d0f6e72ce7aa218babcc` | `concept-introduction-classroom` | `brainstorming`, `visual-representation::paper-diagram`, `sorting-and-sequencing`, `concept-map`, `retrieval-self-test` |
| `grade-5-water-03-melting-condensation` | `a3ea29314d8e7f620316ea361a024c34f23fafba58eb04f39c49438e1d396dd5` | `safe-practical-investigation` | `brainstorming`, `learning-stations::practical-compact-teacher-prepared-observation`, `retrieval-summary`, `one-minute-recall` |
| `grade-5-water-04-changes-review` | `14285bbe5a1a3cea4112fb96ba40f13de14170e3c3113644cae4638f91cf9da1` | `retrieval-and-consolidation` | `retrieval-self-test`, `error-correction`, `concept-map` |

Unit content identity:
`bb78af3a4db7362cf09857f90f5bff28c0a81349e43f2035489a5931aae372ef`.

Selection request and lesson-DNA digests:

| Lesson | Request digest | Lesson-DNA digest |
|---|---|---|
| 01 | `5826190572f8963e7b113e49c388ab8b50089b697c95684f2a9b95d216320f42` | `d0319377c824a1ce0f6472ab32ef6d7f897d59d27112a88731f29924e5f3aaf8` |
| 02 | `5e1c87d97470ef34da891e229c5a8bf7cb682bedc38b17a9e39bc7e5465b8095` | `bc54438748b4ae47baecaa4155711433316a0af2ffc63a2af4099748076e6211` |
| 03 | `67c762d4b47b12448407371d5bd9eca1f6f784ba5678086def40eb7d02b6eb96` | `558a31becbbe2cc15c40413c177a6aa532fb53d8e8d6ff04bef5bd5ab53bf8ff` |
| 04 | `b90482c7f1be43c390868be0e32cbda07c10926eb3f6fd018de9a07e2a678905` | `631afc4dc55641f78b0a25b7610d810e703360c15830e5bafbce9c08263ab8c3` |

The targets changed because component timing and semantic stage compatibility
are now hard constraints. The paper-diagram profile truthfully fits ordinary
paper resources; Venn/sorting operations match the authored guided-practice
stages; error correction and self-test match real evidence-bearing stages.
Lesson 3 keeps the compact classroom practical but uses separate
retrieval-summary and one-minute-recall tasks rather than mapping a concept map
onto practical observation. No target is retained merely to preserve an older
report.

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

All lesson stages still total exactly 45 minutes. Every stage is partitioned
among phase activity/setup/cleanup/transition components, reserve, and
explicitly non-DNA work. Shared stages have non-overlapping allocations and
every phase/stage pair passes compatibility rules 1.0.

| Lesson | Activity | Setup | Cleanup | Transition | Reserve | DNA planned | Non-DNA | Exact total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | 29 | 12 | 0 | 0 | 3 | 44 | 1 | 45 |
| 02 | 29 | 12 | 0 | 0 | 3 | 44 | 1 | 45 |
| 03 | 19 | 10 | 2 | 1 | 3 | 35 | 10 | 45 |
| 04 | 16 | 10 | 0 | 0 | 3 | 29 | 16 | 45 |

The exact stage partitions are:

- lesson 1: `activate-water 5`, `bridge-properties-et 8`,
  `explain-properties-ru 10`, `homework-launch 3`,
  `independent-summary 7`, `observe-water 12`;
- lesson 2: `activate-properties 5`, `classify-states 12`,
  `explain-three-states-ru 12`, `label-states-et 8`,
  `state-summary 8`;
- lesson 3: `activate-state-model 5`, `bridge-process-terms-et 7`,
  `explain-changes-ru 8`, `homework-launch 3`, `observe-changes 15`,
  `separate-conclusions 7`;
- lesson 4: `add-final-terms-et 7`, `complete-change-model-ru 9`,
  `retrieve-water-unit 6`, `revision-stations 15`,
  `separate-unit-assessment 8`.

Non-DNA time remains named scientific explanation, terminology work, or
homework launch from the unchanged lesson; it is not hidden additional time.

## Generated artifacts

The deterministic generator checks 63 files:

- 12 classroom YAML artifacts: request, decision, and lesson DNA for each
  lesson;
- 21 homeschool YAML artifacts: request, decision, package, parent guidance,
  and relative weekly plan for each lesson, plus the lesson-3 home-practical
  policy;
- one integration index;
- four child-facing homeschool renderings;
- four parent-guidance renderings;
- one oral-preparation sheet and one answer-guidance file;
- phase-specific bounded regions across teacher lesson guides, declared student
  materials, and answer keys.

Machine artifacts live below
`teacher-packs/grade-5-science/water/pedagogy/`. Homeschool renderings live
below `teacher-packs/grade-5-science/water/homeschool/`. Generated regions use
stable markers; manual text outside them remains generator-independent.
The integration index contains 17 task bindings, one per selected DNA phase:
13 are answer/evidence-bearing and four are teacher-observation/no-key phases.
Each binding contains its concrete instruction, selected target, exact
student/teacher/key paths, prompt/evidence/language refs, evaluation mode,
source access, and answer-access policy. Every referenced task and phase region
is present in its learner artifact.

Estonian assessment is enabled in all four lessons because their structured
criteria request language evidence. Target phases are `formative-check`,
`guided-practice`, and `retrieval` (lesson 1); `explanation`,
`formative-check`, `guided-practice`, and `retrieval` (lesson 2);
`conclusion` and `evidence-check` (lesson 3); and `consolidation` and
`retrieval` (lesson 4). Subject evidence remains separately Russian-primary.

## Homeschool and language boundaries

Lessons 1, 2, and 4 use the independent variant. Lesson 3 uses the
parent-child variant with teacher authorization and adult safety supervision.
These variants, adult availability, session limits, total productive-language
ceilings, and answer-key release modes are explicit lesson-contract input; the
generator does not infer them from lesson position.
The classroom lesson-3 target remains
`learning-stations::practical-compact-teacher-prepared-observation`. The home
adapter deterministically selects
`learning-stations::practical-home-passive-ice-observation`, because the declared home
resources do not include laboratory materials or measuring tools. The strict
policy lives at
`pedagogy/homeschool/lesson-03-home-practical-policy.yaml`; it permits passive
ice melting and observation of a safe cold surface only. It forbids a kettle,
stove, open flame, hot water or vessel, chemicals, and tasting. Teacher
authorization and continuous adult safety supervision are mandatory. The
package, child rendering, parent rendering, procedure/safety refs, and policy
are machine-checked as equivalent.

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
`146c8746e692bb9cffc8cb2a12b1a9088ce8718ff453d82fb3418bd75b8c07fd`
over 76 files. This intentional change means any future review or trial must
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
- all registered `test:*` scripts: 1,081 passed, 0 failed;
- aggregate `node --test`: 1,081 passed, 0 failed;
- pedagogy knowledge: 144 passed;
- pedagogy selection: 142 passed;
- pedagogy homeschool: 179 passed;
- pedagogy integration: 102 passed;
- lesson plans: 91 passed;
- teacher packs: 16 passed;
- fingerprints: 41 passed;
- all registered `check:*` commands: passed;
- integration check: four lessons, 34 machine YAML artifacts, 63 checked
  generated/rendered files, and three honest readiness warnings;
- strict parsing: 72 JSON and 94 YAML files;
- strict Ajv: 35 schemas;
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
