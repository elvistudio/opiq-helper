# Bilingual thematic-plan checklist

Use `schemas/thematic-plan.schema.json` as the machine-readable authority.

- Assign a unique unit ID, bilingual titles, grade/subject, languages, and canonical route.
- Link the validated curriculum map and merged course map; preserve partial or ambiguous outcome status.
- Link each lesson artifact in exact order. Declared lesson count and duration must match the files.
- State prerequisite support, unit outcomes, content success criteria, and measurable Estonian targets.
- Select only canonical Opiq sources already selected by the linked course map.
- Build a cumulative glossary from every lesson’s `new_terms_et`.
- Make `vocabulary_by_lesson` and instruction-verb progression exactly match the linked lesson data.
- Show sentence-frame, language-function, and scaffold-release progression.
- Schedule practical work, revision, and separate subject/Estonian assessment points.
- Preserve the subject objective in differentiation and forbid silent simplified-curriculum use.
- Record known gaps, optional extensions, provenance, and honest completeness buckets.

A complete teaching sequence may still have incomplete curriculum coverage. Do not set `declared_complete: true` while an official outcome is partial, missing, or ambiguous.

Validate with `npm run test:plans && npm run check:plans`.
