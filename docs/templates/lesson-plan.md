# Bilingual lesson checklist

Use `schemas/lesson-plan.schema.json` as the machine-readable authority. Start from a small, copied-and-renamed valid lesson only after resolving the route in `source-manifest.json`.

## Identity and evidence

- Assign a unique `lesson_id`, grade, subject, bilingual titles, unit reference, position, and duration.
- Copy the exact canonical route from the manifest.
- Link the official curriculum map, outcome IDs, and merged course-map artifact.
- Add only canonical Opiq records already selected in that course map; preserve URL, Book ID, title, language, programme type, roles, and provenance.
- Register every teacher-created explanation, bridge, worksheet, assessment, visual, or practical setup.

## Teaching design

- Use `model: russian_primary_estonian_supported` and all required approaches.
- Write at least one observable Russian content objective and one measurable Estonian objective.
- Record a deliberate language path; do not switch languages without a stated purpose.
- Separate new/recycled terms and new/recycled instruction verbs.
- Give every new term a Russian equivalent, simple Estonian definition, provenance, first-use stage, and later reuse stage.
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

Validate with `npm run test:plans && npm run check:plans`.
