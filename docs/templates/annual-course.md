# Annual-course plan checklist

Use `schemas/annual-course.schema.json` as the machine-readable authority. Issue #10’s production file is an excerpt; issue #18 will build the complete grade-5 course.

- Assign a unique course ID, grade/subject, languages, and manifest route.
- Link verified official maps and record exact-grade versus school-stage scope explicitly.
- Explain publisher sequence and curated sequence separately.
- Order only verified topic-inventory IDs. Link a thematic plan only when that artifact exists.
- Record lesson estimates, audited books, and deduplication decisions.
- Plan Russian explanation coverage and Estonian vocabulary, instruction-language, sentence, and oral-answer progression by unit.
- Give vocabulary a later recycling interval and purpose.
- Maintain separate practical, revision, subject-assessment, and language-assessment calendars.
- Record outcome coverage, known gaps, and provenance.
- For an excerpt, keep `scope: small_annual_course_excerpt`, `status: incomplete`, `declared_complete: false`, and a real `deferred_to_issue`.

Do not turn school-stage evidence, publisher placement, or topic availability into an unsupported exact-grade or full-course claim.

Validate with `npm run test:plans && npm run check:plans`.
