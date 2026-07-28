# Bilingual lesson checklist

Use `schemas/lesson-plan.schema.json` as the machine-readable authority. Start from a small, copied-and-renamed valid lesson only after resolving the route in `source-manifest.json`.

## Identity and evidence

- Assign a unique `lesson_id`, grade, subject, bilingual titles, unit reference, position, and duration.
- Copy the exact canonical route from the manifest.
- Link the official curriculum map, outcome IDs, and merged course-map artifact.
- Add only canonical Opiq records already selected in that course map; preserve URL, Book ID, title, language, programme type, roles, and provenance.
- Register every teacher-created explanation, bridge, worksheet, assessment, visual, or practical setup with `artifact_path`, audience, lower-case languages, printability, provenance, and an answer key where required.
- Keep every path repository-relative and inside the teacher pack. A YAML plan or Opiq link does not replace a separate worksheet.

## Teaching design

- Use `model: russian_primary_estonian_supported` and all required approaches.
- Write at least one observable Russian content objective and one measurable Estonian objective.
- Record a deliberate language path; do not switch languages without a stated purpose.
- Separate new/recycled terms and new/recycled instruction verbs.
- Give every new term a Russian equivalent, simple Estonian definition, provenance, first-use stage, and later reuse stage. `reuse_stage_refs` means later practice within this lesson; it does not count as thematic recycling.
- Keep a full expected answer in Russian and a short expected oral answer in Estonian.
- Count simultaneous novelty in `cognitive_load`.

## Stages and support

- Give every stage duration, content purpose, language purpose, teacher/pupil action, expected languages, material references, provenance references, scaffold references, formative check, evidence, and transition.
- Link every scaffold to its actual stages and state where support is reduced.
- Link every multimodal support to a known material and stage.
- Make the stage total equal the declared duration. Use a documented tolerance only when genuinely necessary.
- For practical work, specify safety, teacher-controlled and pupil steps, materials, data collection, observations, conclusions, and source provenance.

## Assessment and homework

- Assess subject understanding separately from terminology recognition and Estonian production.
- Add practical-skill criteria when practical work is present.
- Language support may reduce Estonian output, but must preserve the subject objective.
- A simplified-curriculum opt-in requires explicit learner-specific authorisation and provenance.
- Homework needs a content task, Estonian component, time estimate, source, Opiq URL when used, adult-support expectation, guidance, and provenance.

## Readiness

- Use `artifact_readiness`, not the removed binary `artifact_completeness` block.
- Set schema, content, material resolution, and print readiness independently.
- `approved` teacher review requires reviewer role, date, and notes.
- Do not set `classroom_ready: true` until review is approved, a classroom trial is recorded, and readiness warnings are resolved.
- A teacher pack can honestly be `teacher_pack_complete_pending_review` while `classroom_ready` remains false.

Validate with `npm run test:plans && npm run check:plans && npm run test:teacher-packs && npm run check:teacher-packs`.

## Commercial version 1.3

Use 1.3 only when the lesson is genuinely complete without Opiq.

- Add `delivery_model`, `commercial_core`, `opiq_companions`,
  `originality_review`, and `family_overlay_hooks`.
- Keep `evidence_linkage.opiq_records` as internal evidence; it may be `[]` in
  1.3 only after the typed standalone core passes.
- Reference separate author-created explanation, worked-example, task,
  expected-answer, worked-solution (for procedural/computational tasks), and
  assessment materials.
- Record optional companions separately with route/course-map identity, access,
  visibility, check date/status, and a real author-created fallback. Copy the
  complete authoritative course-map `selected_records` entry into
  `source_record`; local relabelling of programme, provenance, title, language,
  Book ID, roles, or record ID is invalid.
- Keep teacher-only, unverified, unavailable, and teacher-support records
  internal; require learner-specific opt-in for simplified material. Derive
  these safeguards from the authoritative course-map record.
- Bind publication status to a current human originality fingerprint. Do not
  treat that review as automated proof of originality.
- Family hooks reference stable core IDs. Grade 2 and Grade 4 hooks require
  individual evidence, and shared evidence never replaces it. Match each hook
  role to its lane; Foundation participation supports only Foundation.

Run `npm run test:commercial-course-schema && npm run check:commercial-course-schema`.
