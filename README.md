# opiq-helper

`opiq-helper` contains a Chrome extension for exporting structured Opiq page data and a collection of canonical Markdown lookup indexes for educational source retrieval.

## Current coverage

The repository currently contains indexes for grades 1 through 7. Grade 4 has eleven subject-bounded canonical routes; the dated [live-catalogue gap review](docs/audits/grade-4-live-catalogue-gap-review.md) records their public-catalogue reconciliation without claiming official-curriculum completeness.

The represented subjects are:

- mathematics;
- science (`loodusõpetus`);
- human studies (`inimeseõpetus`);
- combined nature and human studies (`loodus- ja inimeseõpetus`) when the source itself is not safely divisible;
- Estonian (`eesti keel`);
- Estonian as a second language (`eesti keel teise keelena`);
- Russian language and separately routed Russian reading sources;
- arts and crafts (`kunst ja tööõpetus`);
- music (`muusika`);
- supplementary Kodututred and Noorte Kotkad youth-organisation training;
- geography.

The presence of Opiq pages does not prove complete coverage of the official school curriculum. The repository contains a complete grade-5 science annual architecture, but its official mapping remains partial and only one thematic unit is fully authored.

## Source locations

- [`source-manifest.json`](source-manifest.json) is the canonical routing manifest.
- `project-files/outputs/opiq_*klass_*.md` contains the canonical Markdown lookup indexes.
- `project-files/inputs/final-zips/` contains available source archives.
- `project-files/outputs/*_qa.json` contains available static QA snapshots.
- `evaluations/known-topic-checks.yaml` records machine-checked representative topic and routing regressions; it is not a curriculum map.
- `curriculum-maps/` separates official curriculum evidence, publisher evidence, topic inventory, and curated-course data.
- `lesson-plans/` contains validated bilingual lessons, thematic plans, and reusable language-profile defaults.
- `teacher-packs/` contains resolved teacher guides, printable student materials, answer keys, family support, and machine-checked material indexes.
- `pedagogical-reviews/` contains unfilled review/classroom/home-trial instruments and the privacy-safe offline evidence workflow; the strict record schemas live in `schemas/`, and templates are not completed evidence.
- `knowledge/pedagogy/` contains the independent, source-attributed catalog of pedagogical principles, activities, flexible classroom/homeschool patterns, taxonomy 1.0, the deterministic lesson-pedagogy selector, the structural homeschool adaptation engine, quality gates, and bounded regression pilots; see [`docs/pedagogical-knowledge-base.md`](docs/pedagogical-knowledge-base.md), [`docs/pedagogical-taxonomy.md`](docs/pedagogical-taxonomy.md), [`docs/lesson-pedagogy-engine.md`](docs/lesson-pedagogy-engine.md), [`docs/homeschool-learning-engine.md`](docs/homeschool-learning-engine.md), [`docs/pedagogy-quality-gates.md`](docs/pedagogy-quality-gates.md), [`docs/pedagogy-regressions.md`](docs/pedagogy-regressions.md), and [`docs/pedagogical-review-and-trial-workflow.md`](docs/pedagogical-review-and-trial-workflow.md).
- `annual-courses/` contains annual architectures, auditable source-selection matrices, and implementation roadmaps.
- `external-sources/registry.yaml` is the shared registry for optional verified non-Opiq supplements; it is currently empty.
- `schemas/` contains the strict JSON Schemas for curriculum, course, and teaching-plan artifacts.

The legacy `opiq_compact_all_index.json`, `opiq_lookup_all.*`, `topic_map_all.json`, and `opiq-compact-all*` files form an older, partial aggregate. They are not the canonical repository manifest.

## Routing

Resolve requests and topic synthesis in this order:

1. grade;
2. subject;
3. source-language scope;
4. requested output language;
5. the matching route and `md_path` in `source-manifest.json`;
6. every eligible ordinary book inside that exact route;
7. the strongest non-duplicate pages by instructional role.

Limit the content search to the selected Markdown file or files. Do not silently fall back to an adjacent grade.

Example:

`grade 3 + loodusõpetus` → entry `grade-3-science` in `source-manifest.json` → `project-files/outputs/opiq_3klass_loodusopetus.md`.

Validate routing metadata with:

```sh
node scripts/check-source-manifest.mjs
```

GitHub Actions runs the same structural integrity check automatically for relevant pull requests and pushes to `main`. A successful run reports the number of validated routes and Markdown records. This check validates the manifest and its related files; it does not assess curriculum completeness or the pedagogical quality of the material.

## QA snapshots

The portable QA snapshot schema is documented in [`docs/qa-snapshot-schema.md`](docs/qa-snapshot-schema.md). Refresh manifest-controlled metadata and SHA-256 checksums with:

```sh
node scripts/refresh-qa-snapshot-metadata.mjs
```

Verify committed QA metadata and the related manifest structure with:

```sh
node scripts/refresh-qa-snapshot-metadata.mjs --check
node scripts/check-source-manifest.mjs
```

Snapshots marked `legacy_migrated` preserve historical diagnostics, but their original generation timestamp, generator name, and generator version were not recorded and are therefore left `null`. A QA snapshot verifies structural metadata and checksums; it is not evidence of curriculum completeness or pedagogical readiness.

### Derived compact sources

A manifest entry with `source_provenance.kind: derived_compact_snapshot` uses a committed compact ZIP because the original export is unavailable. It must not be described as an original archive. The manifest checker reads these ZIPs with the Node.js standard library, validates their CRCs, required members, `index.json`, JSONL record count, declared original filename, format version, generation timestamp, and supported languages.

Grade 1 mathematics QA is reproducibly generated and checked with:

```sh
node scripts/generate-grade-1-mathematics-qa.mjs
node scripts/generate-grade-1-mathematics-qa.mjs --check
```

Grade 3 mathematics is generated from its committed original export and has its own archive, semantic-comparison, and content-quality checks:

```sh
node scripts/generate-grade-3-mathematics-qa.mjs
node scripts/generate-grade-3-mathematics-qa.mjs --check
```

The grade 3 generator verifies all 657 ZIP members and 643 source rows, excludes non-instructional details and Impressum pages, produces 619 unique instructional records, and compares them with the former compact snapshot. The old compact ZIP is retained only as noncanonical historical comparison evidence. The deterministic QA timestamp comes from the original capture. Run the general refresh and manifest checks afterward.

Grade 3 Russian is likewise generated from its committed original export:

```sh
node scripts/generate-grade-3-russian-sources.mjs
npm run check:grade-3-russian
```

Its audit accounts for 488 source rows and 478 instructional pages across kits 503, 250, 94, and 568. The exporter-wide mathematics label is corrected to the Russian-language subject from book, Kit Details, heading, task, and subject-filter evidence. Kit 568 is owned only by this grade-3 route; its 52 URLs were removed from `grade-2-russian` after a stable old/new archive comparison.

Grade 3 Russian reading is kept in a separate source-specific route:

```sh
node scripts/generate-grade-3-russian-reading-sources.mjs
npm run check:grade-3-russian-reading
```

The Kit 504 archive contains 57 source rows: 55 literary chapters and two repeated Kit Details records. Its automatic mathematics label is replaced with `Russian reading / vene keele lugemine / чтение на русском языке` from the Source Book ID, visible reading title, literary headings, and complete chapter sequence. This separation improves retrieval precision but does not claim an independent official exact-grade subject allocation. Publisher metadata is absent, structured task examples are not reconstructed, and no further capture is required for canonical routing.

Grade 3 music is generated from its committed four-book original export:

```sh
node scripts/generate-grade-3-music-sources.mjs
npm run check:grade-3-music
npm run test:grade-3-music
```

The [grade 3 music audit](docs/audits/grade-3-music-source-import.md) accounts for all 315 source rows, excludes four unique and four duplicate Kit Details rows plus two Impressum pages, and produces 305 direct instructional records: 183 Estonian and 122 Russian. The automatic mathematics label is replaced by music from kit, title, chapter, notation, rhythm, singing, and task evidence. Forty richer task arrays are recovered from the same raw chapter records; 129 pages remain without structured task examples and are classified as a non-blocking capture limitation. The generator also verifies reversible decoding of 195 non-ASCII ZIP member names whose UTF-8 flag is absent, without rewriting the archive. Publisher metadata is absent, grade-2 music is not substituted, and the route is not a curriculum-completeness claim.

Grade 3 Estonian is generated from one shared four-book capture and one dedicated complete kit 590 capture:

```sh
node scripts/generate-grade-3-estonian-sources.mjs
npm run check:grade-3-estonian
npm run test:grade-3-estonian
```

The [grade 3 Estonian import audit](docs/audits/grade-3-estonian-source-import.md) accounts for all 470 source rows and creates a strict 405/54 partition: kits 135, 179, and 590 belong to first-language Estonian, while kit 140 belongs only to Estonian as a second language. The dedicated archive completes kit 590 with 42 unique instructional chapters; its shared-archive cover evidence remains audited but is not duplicated. Grade, automatic mathematics-subject, and isolated language anomalies are normalized only from captured evidence. All 459 pages lack structured task arrays, so no exercises are invented; a targeted task-body capture is optional only if exact image-based exercises are needed. The routes do not claim official curriculum or live Opiq catalogue completeness.

Grade 3 arts and crafts is generated from its committed two-kit capture:

```sh
node scripts/generate-grade-3-arts-and-crafts-sources.mjs
npm run check:grade-3-arts-and-crafts
npm run test:grade-3-arts-and-crafts
```

The [grade 3 arts-and-crafts audit](docs/audits/grade-3-arts-and-crafts-source-import.md) accounts for all 178 source rows. Ordinary kit 196 contributes 89 canonical grade-3 pages. Supplementary kit 200 is captured in both grade exports, but all 85 stable compact/raw records and image references match; it therefore retains one canonical owner in `grade-2-arts-and-crafts` and is excluded from the grade-3 route without URL loss. The automatic mathematics subject and raw-book `ru` language anomalies are corrected only from captured page-level evidence. All 174 instructional rows lack structured task arrays, so no craft steps are invented; a targeted task-body capture is optional and a full recapture is not required for routing.

The grade-3 English route is generated and audited separately:

```bash
node scripts/generate-grade-3-english-sources.mjs
npm run check:grade-3-english
npm run test:grade-3-english
```

The [grade 3 English audit](docs/audits/grade-3-english-source-import.md) accounts for all 197 supplied source rows: four repeated Kit Details records are excluded and 193 unique direct chapter URLs remain. Kits 369 and 452 are normalized from the export’s incorrect mathematics subject to English while page-level `en`, `et`, and `ru` language values are preserved. Publisher and programme type remain unverified rather than inferred. The result indexes the supplied capture; it is not a claim of official-curriculum or current live Opiq catalogue completeness.

Grade 2 Estonian, Estonian as a second language, mathematics, science, human studies, combined nature-and-human-studies, arts-and-crafts, music, and supplementary youth-training indexes are reproducibly generated from committed original export archives:

```sh
npm run generate:grade-2-sources
npm run check:grade-2-sources
```

The generator removes repeated kit-detail covers and administrative pages, requires unique canonical chapter URLs, preserves source-book-plus-kit provenance, and labels simplified, supplementary, mixed-subject, and youth-training records. First-language Estonian and Estonian as a second language are a disjoint 372/72 partition of their shared capture. The Russian combined kit 86 is exposed only through `grade-2-nature-and-human-studies`, not silently assigned to either subject-pure route. Kit 330 is a supplementary grade-2 science capture and no longer appears in grade-1 routes. See the [complete captured grade 2 catalogue](docs/audits/grade-2-complete-captured-catalog.md).

The reproducible [grade 2 content-quality audit](docs/audits/grade-2-content-quality.md) checks all 11 routes, 41 book/kit variants, and 2,483 canonical pages after the kit 568 grade correction. Run `npm run check:grade-2-content-quality` to verify the committed machine-readable report. Classified warnings and targeted recapture recommendations do not establish live Opiq or official-curriculum completeness.

The arts-and-crafts route contains two ordinary Estonian/Russian part-2 books and one supplementary Estonian holiday-card collection. Its source metadata corrections, book identities, duplicate decision, and limitations are recorded in the [grade 2 arts-and-crafts source audit](docs/audits/grade-2-arts-and-crafts-source-audit.md). These routes are searchable source indexes, not verified curriculum maps.

The music route contains four Estonian sources and one Russian source. Its repeated edition titles are retained only when the canonical chapter URLs differ, while the heritage-music video collection is labelled supplementary. See the [grade 2 music source audit](docs/audits/grade-2-music-source-audit.md). These routes are searchable source indexes, not verified curriculum maps.

The mixed Kaitseliit export is split into separate Kodututred and Noorte Kotkad routes. Duplicate aliases are collapsed by canonical URL, while mixed-grade `Koduõpe` and the different `Kodutütarde VI järk` progression remain outside the grade-2 routes. See the [grade 2 youth-training source audit](docs/audits/grade-2-youth-training-source-audit.md). Both routes are explicitly supplementary and are not ordinary school-subject curriculum sources.

Routes may opt into exact canonical URL uniqueness with `canonical_url_policy.require_unique: true`. The policy is intentionally route-specific because other known duplicate routes are handled by their own audits.

A route-specific `canonical_subject_policy` requires every canonical record to use the declared Subject. For grade 3 mathematics, two audited `Kaitseme loodust` source records are normalized from science to mathematics because their learner tasks are computational. Environmental keywords remain valid thematic context; the subject policy checks the Subject field, not topic keywords.

Regression topics are promoted to `present` only from explicit headings or tasks that demonstrate the requested learning objective. Automatically generated topic keywords, generic greater/less comparisons, or material from another grade are not sufficient evidence.

## Known-topic regressions

The schema, assertion kinds, route coverage gates, and safe update process are documented in [`docs/known-topic-regressions.md`](docs/known-topic-regressions.md). Install the locked YAML parser and run the unit and repository checks with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:topics
npm run check:topics
```

The regression set checks representative positive evidence and wrong-route boundaries for every manifest source. It remains distinct from a curriculum map and does not prove complete programme coverage.

## Pedagogical knowledge

The pedagogical knowledge base normalizes source provenance, copyright status,
confidence, capabilities, delivery constraints, effort, resources, learner
demands, homeschool roles, misuse risks, and concrete execution profiles. Its
query helper performs filtering without ranking. The separate selection engine
uses versioned project-authored weights to compose an explainable proposed
`lesson_dna`; its score means operational fit, not effectiveness, approval, or
classroom readiness. Teacher overrides are accepted only when applied to the
selected slot, delivery and preferred-group bonuses reflect actual fit, and
total learner productive-language demand is kept distinct from Estonian A1–A2
support. Enabled support applies the bounded A1–A2 layer; disabled support
removes its filtering, scoring, roles, scaffolds, and language assessment
without relaxing the total productive-language limit. Neither tool changes
production artifacts.

Selection engine 1.1 applies single-learner compatibility only to a real solo
learner. Its homeschool layer represents delayed and next-unit retrieval as
counted sessions, revalidates safety and material bindings on the final
adapted DNA, binds each review session to relevant phase-level answer-key
provenance, and carries teacher override ID and rationale through a real
versioned pattern slot. Adult-managed key release requires an available
`check_answers` adult and visible answer-access minutes; explanation binding
may use a bounded teacher-provided source segment. These outputs remain
structural proposals: teacher review and a home trial are still pending.

The grade-5 water pilot demonstrates deterministic production integration of
lesson DNA and homeschool adaptation into an existing teacher pack without
changing the scientific authority of lesson YAML. See
[`docs/pedagogy-generation-integration.md`](docs/pedagogy-generation-integration.md).
It uses one immutable canonical lesson DNA, a separate production assessment
overlay, teacher-only answer evidence, learner answer-leak checks, and explicit
task contracts whenever a home target is reselected. Lesson 3 has a dedicated
passive-observation sheet and no answer key for the practical step.
Validate it with `npm run test:pedagogy-integration`,
`npm run check:pedagogy-integration`, and
`npm run generate:pedagogy-water-pilot -- --check`.

Reusable [pedagogical quality gates](docs/pedagogy-quality-gates.md) validate
the integrated structural contract without granting teacher approval,
effectiveness, testing, or readiness. Primitive checks run before the derived
structural result; the committed report keeps per-record results, actual
readiness/evidence state, exact dependency paths, and the recomputed
teacher-pack fingerprint. The schema gate validates the actual committed
selection, lesson-DNA, homeschool, parent-guidance, weekly-plan, and integration
machine files with their strict schemas, while activity safety uses the exact
`safety.requires_adult_supervision` catalogue metadata. Explicit `--path`
checks are scope-limited and fail when no record matches. Run
`npm run test:pedagogy-quality`,
`npm run check:pedagogy-quality`, and `npm run check:pedagogy-quality-report`.

Deterministic [pedagogical regression pilots](docs/pedagogy-regressions.md)
compose the existing selection, homeschool, integration, quality, fingerprint,
and review-evidence models. The initial grade-5 suite contains production
classroom and homeschool checks, architecture-only applicability examples,
deliberate failures, stale-evidence cases, and 31 temporary-artifact
evidence/readiness scenarios. It records semantic invariants
rather than accepting a generated file merely because its bytes are stable.
Production/stale cases mutate real artifacts in isolated repository copies and
reload the existing adapters; architecture cases resolve actual activity and
execution-profile contracts. The report exposes expected/actual values and
evidence references for every invariant.
Run `npm run test:pedagogy-regressions`,
`npm run check:pedagogy-regressions`, and
`npm run check:pedagogy-regression-report`.

```sh
npm run test:pedagogy
npm run check:pedagogy
npm run query:pedagogy
npm run query:pedagogy -- --fixture map-diagram-low-language
npm run test:pedagogy-selection
npm run check:pedagogy-selection
npm run select:pedagogy
npm run select:pedagogy -- --fixture grade5-concept-introduction --debug
```

## Curriculum maps and bilingual courses

The curriculum-map model is documented in [`docs/curriculum-maps.md`](docs/curriculum-maps.md). The first pilot uses only the registered `grade-5-science` route and keeps four layers separate: official Riigi Teataja evidence, official school-stage scope, publisher/Opiq evidence, and the curated Opiq Helper course.

The course model requires Russian as the primary explanation language and Estonian as the subject-support language. It supports selecting complementary pages from several eligible books, assigning explicit instructional roles, and rejecting duplicate or simplified-curriculum material with a recorded reason.

The project-wide [topic-synthesis policy](docs/topic-synthesis-policy.md) makes source language independent from output language. A strong Estonian Opiq page may be translated or pedagogically adapted into a concise Russian explanation with canonical provenance. `core_explanation_ru` describes the final pupil-facing role, not necessarily the source-page language. Topic synthesis records direct, translated, adapted, multi-Opiq, optional external, and explicitly author-created contributions separately. The shared production external registry is empty; external material is never required merely to make validation pass.

Install dependencies and run the schema tests and production validation with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:curriculum
npm run check:curriculum
npm run test:synthesis
```

The grade-5 work validates one golden thematic unit, a ten-topic evidence inventory, and a complete annual skeleton. It does not claim a fully authored grade-5 course or complete official curriculum coverage.

## Bilingual teaching plans

The lesson, thematic-plan, and annual-course formats are documented in [`docs/lesson-plans.md`](docs/lesson-plans.md). Their methodology model is `russian_primary_estonian_supported`: Russian carries complex subject explanation, while Estonian is introduced systematically through terminology, familiar instructions, visuals, short definitions, sentence frames, and short oral output.

The production set contains ten linked grade-5 science lessons across two water-related thematic plans, two resolved teacher packs, and a ten-unit annual architecture with linked source selection, language progression, teaching calendars, and implementation roadmap. The architecture is complete for planning, while eight thematic plans and their detailed lessons remain unimplemented. See [`docs/grade-5-science-annual-course.md`](docs/grade-5-science-annual-course.md). Reusable language-profile defaults also describe the intended progression for later grade-6 science and grade-7 geography work; they are planning defaults, not fixed learner facts.

The original four-lesson water unit and the new six-lesson groundwater/use/protection/cycle unit both have complete YAML, resolved teacher packs, printable student files, answer keys, rubrics, and family support. For both packs, independent teacher review is still `pending`, classroom trial is `not_tested`, home trial is `not_started`, and readiness remains false.

Readiness is deliberately staged: `schema complete` ≠ `materials resolved` ≠ `teacher reviewed` ≠ `classroom/home tested` ≠ `ready`.

Readiness workflow: prepare an offline JSON bundle → conduct scoped teacher
review → run the separate classroom and/or home trial → normalize JSON to
canonical YAML → explicitly register current evidence → derive readiness
outside the reviewable fingerprint. Evidence binds to both the SHA-256 content
fingerprint and the current versioned pedagogical snapshot; commit SHA remains
provenance only. Classroom and home evidence never substitute for each other,
and approval alone is insufficient. Completed negative evidence is
registerable but blocks only its declared delivery scope; classroom and
homeschool review statuses are derived separately, with `partial` and
`approved_for_both` reserved for the explicit aggregate. Active evidence is
selected through explicit supersession links, while historical records remain
auditable. Successful trials require meaningful aggregate observations and
`safe_to_repeat: true`; an empty analysed trial cannot unlock readiness.
Positive trials cover only their declared lessons, and readiness stays
`partial` until the union of active trial records covers the whole pack.
Registration uses a pack-local lock and immutable no-replace target commit;
linked drafts or unanalysed conducted trials are repository errors. See
[`docs/pedagogical-review-and-trial-workflow.md`](docs/pedagogical-review-and-trial-workflow.md)
and [`docs/teacher-pack-content-fingerprint.md`](docs/teacher-pack-content-fingerprint.md).
Student or family personal data must never be committed.

Run the focused tests and production validation with:

```sh
npm run test:plans
npm run check:plans
npm run test:synthesis
npm run test:teacher-packs
npm run check:teacher-packs
npm run test:reviews
npm run check:reviews
npm run test:pedagogy-evidence
npm run check:pedagogy-evidence
npm run test:pedagogy-readiness
npm run check:pedagogy-readiness
npm run check:pedagogy-readiness-report
npm run test:fingerprints
npm run check:fingerprints
```

Validation reuses the curriculum-map route loader and canonical Opiq checks. It verifies cross-file links, timing, source ownership, programme type, provenance, bilingual objectives, lesson- and unit-scale vocabulary recycling, scaffold release, budget reconciliation, separate assessment, and honest annual implementation declarations. These design controls do not guarantee learning outcomes.
