# Bilingual thematic-plan checklist

Use `schemas/thematic-plan.schema.json` as the machine-readable authority.

- Assign a unique unit ID, bilingual titles, grade/subject, languages, and canonical route.
- Link the validated curriculum map and merged course map; preserve partial or ambiguous outcome status.
- Link each lesson artifact in exact order. Declared lesson count and duration must match the files.
- State prerequisite support, unit outcomes, content success criteria, and measurable Estonian targets.
- Select only canonical Opiq sources already selected by the linked course map.
- Build a cumulative glossary from every lesson’s `new_terms_et`. `introduced_in_lesson` is the first introduction; `recycled_in_lessons` may contain only strictly later linked lessons that list the term in `recycled_terms_et`.
- Keep `recycled_in_lessons` present. Use `[]` when the unit has no suitable later use; this is structurally valid and produces one pedagogical warning for that term.
- Make `vocabulary_by_lesson` and instruction-verb progression exactly match the linked lesson data.
- Show sentence-frame, language-function, and scaffold-release progression.
- Schedule practical work, revision, and separate subject/Estonian assessment points.
- Preserve the subject objective in differentiation and forbid silent simplified-curriculum use.
- Record known gaps, optional extensions, provenance, and honest completeness buckets.
- Link the real teacher-pack directory in `teacher_pack`; declare material resolution, print readiness, review status, and classroom readiness independently.

A complete teaching sequence may still have incomplete curriculum coverage. Do not set `declared_complete: true` while an official outcome is partial, missing, or ambiguous.

Within-lesson practice belongs in each lesson’s `reuse_stage_refs`. Recycling in a later thematic unit belongs in the annual course’s `planned_vocabulary_recycling_intervals`; neither should be copied into same-lesson `recycled_in_lessons` entries.

Thematic curriculum `completeness` and teacher-pack readiness answer different questions. A sequence can have partial official coverage while its files are resolved; a print-ready pack can still await independent review and classroom trial.

Validate with `npm run test:plans && npm run check:plans && npm run test:teacher-packs && npm run check:teacher-packs`.

## Commercial version 1.3

Add the aggregate `delivery_model`, `commercial_core_summary`,
`opiq_companion_summary`, `family_overlay_hook_index`, and
`originality_review_summary`. The summaries must equal the linked lesson
contracts, not a manually selected subset. `selected_opiq_sources: []` is valid
only when every linked 1.3 lesson is standalone. Unit publication readiness
requires every linked publication artifact to have a current originality
review. Family project evidence never replaces per-learner evidence.
