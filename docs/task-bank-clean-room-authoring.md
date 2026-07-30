# Clean-room task-bank authoring

## Purpose

The task bank separates source analysis from commercial authoring so that an Opiq or publisher task is evidence for neutral design decisions, never a draft to rewrite.

The workflow has three artifact layers:

1. An internal neutral specification describes the skill, cognitive action, difficulty, evidence, broad context opportunities, and strict authoring boundaries.
2. An independently authored task turns that neutral specification into new customer content, answers, feedback, and worked solutions.
3. A separate human originality review evaluates a precise task version and its deterministic customer-content fingerprint.

Opiq is optional throughout. Every authored task must work without Opiq or other external access.

## Stage 1: internal neutral specification

Create a specification under `task-bank/specifications/` using `docs/templates/task-specification.yaml`.

Before searching:

1. Determine grade, subject, preferred page language, instruction language, and learner language level.
2. Select the route from `source-manifest.json`.
3. Search only that route's `md_path`.
4. Check the route QA file and the official outcome index.

The source-analysis fields are internal. Canonical URLs, record references, QA paths, and boundary notes may occur there, but nowhere in customer-visible task content.

A neutral specification may retain:

- the target skill and cognitive operation;
- difficulty and response mode;
- broad task archetype;
- independent value constraints;
- expected learner evidence;
- common misconceptions;
- accessibility and language-support needs;
- broad real-life or project opportunities.

It must exclude:

- source task or answer wording, including close paraphrases;
- source-specific characters and story contexts;
- source numbers, datasets, distractors, and question order;
- source scaffolding and interaction sequences;
- screenshot or illustration reconstruction descriptions;
- source HTML, JSON payloads, and long excerpts.

Where practical, the final author should receive the neutral specification without seeing the original task text. Source analysts should write findings as general capabilities and boundaries, not as customer-ready prose.

## Stage 2: independent commercial authoring

Create the task under `task-bank/tasks/` using `docs/templates/authored-task.yaml`.

The author creates new wording, context, data, sequence, scaffolding, visuals, distractors, answers, explanations, and feedback. Source URLs and analysis notes remain internal and are not passed into `customer_content` or `answer_contract`.

Closed tasks require an answer. Procedural and computational tasks require a step-by-step worked solution. Open-ended tasks require explicit success criteria and an explanation of why more than one response may be correct.

For the default Grade 2 learner profile:

- core explanations and instructions are Russian;
- Estonian as a second language uses A1 core with bounded A1–A2 supported output;
- subject understanding and Estonian output have separate criteria;
- language support must not lower subject difficulty.

## Customer-content projection and fingerprints

`extractCustomerVisibleProjection()` in `scripts/lib/task-bank.mjs` is the stable boundary used for review. Its projection version `1.0` contains:

- task identity and task version;
- grade, subject, language level, outcomes, target, mode, difficulty, and time;
- `customer_content`;
- the complete `answer_contract`, including answers and worked solutions.

It excludes specification links, internal source analysis, authoring provenance, review links, and review notes.

The projection is serialized with recursively byte-sorted object keys and hashed with SHA-256. `computeTaskFingerprint()` returns the shared `contentFingerprint` contract with `file_count: 1`.

Every material change to this projection changes the fingerprint and invalidates a previous review. Updating a task therefore requires updating the review target and index fingerprint; it does not preserve approval automatically.

Automated checks do not prove originality. They enforce boundaries, detect exact exposed source snippets, keep links current, and ensure that declared similarity flags block approval. Human review remains authoritative.

## Stage 3: version-specific human review

Create a review under `task-bank/reviews/` using `docs/templates/task-originality-review.yaml`.

Real tasks start as `pending` with no reviewer identity or approval. A human reviewer evaluates wording, context, data, question order, scaffolding, distractors, visuals, and answer independence for the exact fingerprinted version.

An approved review requires:

- an identified human reviewer and role;
- a review date and exact commit SHA;
- a fingerprint matching the current customer projection;
- every independence dimension resolved as `independent` or `not_applicable`;
- no prohibited source content;
- no unresolved similarity flags.

Multiple distinctive similarities require human investigation. The system deliberately provides no originality percentage and makes no automated plagiarism-detection claim.

## Source and curriculum boundaries

Official outcome evidence is validated against `compliance/estonia/2026-27/outcome-index.yaml`. For the Grade 2 seed bank, the outcomes are school-stage-I evidence with terminal grade 3 and `exact_grade_claimed: false`. They are not exact national Grade 2 allocations.

Manifest relationships are evidence for neutral specification design only. They do not establish commercial authorship or complete curriculum coverage.

The mixed `grade-2-nature-and-human-studies` route is usable only as `mixed_subject_support` with manual topic review. It cannot establish subject-pure science or human-studies coverage.

Simplified-curriculum material is not ordinary default evidence. Supplementary sources are not mastery core. Kit 330 is optional project support only. Youth-training routes are not school-curriculum sources.

When no matching route exists, use:

```yaml
source_status: missing_route
route_ids: []
content_strategy: author_created_required
```

Missing-route content is independently authored. No route or companion may be invented. Physical-education water safety cannot be replaced with human-studies source evidence.

## Task-bank index and publication gate

`task-bank/task-bank-index.yaml` binds one specification, task, and review with grade, subject, outcomes, publication status, artifact paths, fingerprint, and fingerprint state.

Missing, duplicate, cross-linked, unsafe, or stale relationships fail validation.

Seed tasks remain:

```yaml
customer_visibility: internal_only
publication_status: internal_review
```

Publication remains blocked until:

1. the human originality review is approved and current;
2. all similarity flags and independence dimensions are resolved;
3. local validation passes;
4. executable final-head CI becomes available and passes.

## Stable lesson integration contract

The task bank does not duplicate the lesson, thematic-plan, or annual-course schemas. A lesson may integrate an authored task by using the authored `task_id` as its stable author-material identifier:

| Lesson field | Task-bank binding |
| --- | --- |
| `commercial_core.task_material_ids[]` | authored `task_id` |
| `commercial_core.task_contracts[].task_material_id` | same authored `task_id` |
| `evidence_linkage.author_materials[].material_id` | same authored `task_id` |
| `originality_review.covered_author_material_ids[]` | same authored `task_id` |

The lesson author-material entry retains its own artifact path and audience metadata. Lesson task contracts still enforce closed-answer and worked-solution requirements. Task-bank approval does not imply lesson publication readiness, and lesson review does not replace the task's separate originality review.

This ID mapping is the stable integration point for issue #40; this change does not implement a Grade 2 lesson or thematic module.

## Reviewer checklist

- Confirm the reviewed commit and fingerprint match the current task projection.
- Compare wording, context, data, sequence, scaffolding, distractors, visuals, and answers independently.
- Check that no source excerpt, screenshot, illustration, interaction, or answer key entered commercial content.
- Investigate every similarity flag; do not convert flags into a score.
- Confirm the task works without Opiq or external access.
- Confirm closed answers, worked solutions, and open-ended criteria are complete.
- Confirm Estonian output and subject understanding are assessed separately where required.
- Confirm route, subject, grade, programme type, and stage-versus-grade boundaries.
- Keep the review pending or request changes if any dimension is unresolved.

## Validation

Run:

```bash
npm run test:task-bank
npm run check:task-bank
```

The validator is offline, uses strict duplicate-key-rejecting YAML parsing and Ajv 2020 strict mode, and reports stable diagnostic codes.
