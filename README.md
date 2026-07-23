# opiq-helper

`opiq-helper` contains a Chrome extension for exporting structured Opiq page data and a collection of canonical Markdown lookup indexes for educational source retrieval.

## Current coverage

The repository currently contains indexes for grades 1, 2, 3, 5, 6, and 7. Grade 4 is not present.

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
- `pedagogical-reviews/` contains unfilled review/trial instruments and the privacy-safe evidence workflow; the strict record schemas live in `schemas/`, and templates are not completed evidence.
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

The original four-lesson water unit and the new six-lesson groundwater/use/protection/cycle unit both have complete YAML, resolved teacher packs, printable student files, answer keys, rubrics, and family support. For both packs, independent teacher review is still `pending`, classroom trial is `not_tested`, and `classroom_ready` is therefore `false`.

Readiness is deliberately staged: `schema complete` ≠ `materials resolved` ≠ `print ready` ≠ `teacher reviewed` ≠ `classroom tested` ≠ `classroom ready`.

Readiness workflow: merge the authored pack → compute its deterministic content fingerprint → conduct independent review → record and resolve findings → conduct a limited trial → analyse anonymised aggregate observations → register evidence → update readiness in a separate PR. The commit SHA remains provenance only; the SHA-256 fingerprint is the readiness gate. Rebase, squash, or unrelated commits do not invalidate unchanged content, while a change to any reviewable file makes evidence stale. The scope and framing are documented in [`docs/teacher-pack-content-fingerprint.md`](docs/teacher-pack-content-fingerprint.md). An approved review alone does not establish classroom readiness. Student personal data must never be committed.

Run the focused tests and production validation with:

```sh
npm run test:plans
npm run check:plans
npm run test:synthesis
npm run test:teacher-packs
npm run check:teacher-packs
npm run test:reviews
npm run check:reviews
npm run test:fingerprints
npm run check:fingerprints
```

Validation reuses the curriculum-map route loader and canonical Opiq checks. It verifies cross-file links, timing, source ownership, programme type, provenance, bilingual objectives, lesson- and unit-scale vocabulary recycling, scaffold release, budget reconciliation, separate assessment, and honest annual implementation declarations. These design controls do not guarantee learning outcomes.
