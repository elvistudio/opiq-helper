# opiq-helper

`opiq-helper` contains a Chrome extension for exporting structured Opiq page data and a collection of canonical Markdown lookup indexes for educational source retrieval.

## Current coverage

The repository currently contains indexes for grades 1, 2, 3, 5, 6, and 7. Grade 4 is not present.

The represented subjects are:

- mathematics;
- science (`loodusõpetus`);
- human studies (`inimeseõpetus`);
- Estonian (`eesti keel`);
- Estonian as a second language (`eesti keel teise keelena`);
- Russian;
- geography.

The presence of Opiq pages does not prove complete coverage of the official school curriculum. The repository contains a partial grade-5 science curriculum-map pilot, not a complete annual curriculum map.

## Source locations

- [`source-manifest.json`](source-manifest.json) is the canonical routing manifest.
- `project-files/outputs/opiq_*klass_*.md` contains the canonical Markdown lookup indexes.
- `project-files/inputs/final-zips/` contains available source archives.
- `project-files/outputs/*_qa.json` contains available static QA snapshots.
- `evaluations/known-topic-checks.yaml` records machine-checked representative topic and routing regressions; it is not a curriculum map.
- `curriculum-maps/` separates official curriculum evidence, publisher evidence, topic inventory, and curated-course data.
- `lesson-plans/` contains validated bilingual lessons, thematic plans, and reusable language-profile defaults.
- `annual-courses/` contains annual-course plans or explicitly incomplete excerpts.
- `schemas/` contains the strict JSON Schemas for curriculum, course, and teaching-plan artifacts.

The legacy `opiq_compact_all_index.json`, `opiq_lookup_all.*`, `topic_map_all.json`, and `opiq-compact-all*` files form an older, partial aggregate. They are not the canonical repository manifest.

## Routing

Resolve requests in this order:

1. grade;
2. subject;
3. preferred source language;
4. the matching `md_path` in `source-manifest.json`.

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

Grade 3 mathematics uses the same derived-provenance model and has its own audited generator:

```sh
node scripts/generate-grade-3-mathematics-qa.mjs
node scripts/generate-grade-3-mathematics-qa.mjs --check
```

The generator preserves its initial `generated_at` value on ordinary reruns and verifies the canonical Markdown field by field against the compact JSONL. Run the general refresh and manifest checks afterward.

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

Install dependencies and run the schema tests and production validation with:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:curriculum
npm run check:curriculum
```

The pilot validates one golden thematic unit and a deduplicated evidence inventory. It does not claim a complete grade-5 annual course or complete official curriculum coverage.

## Bilingual teaching plans

The lesson, thematic-plan, and annual-course formats are documented in [`docs/lesson-plans.md`](docs/lesson-plans.md). Their methodology model is `russian_primary_estonian_supported`: Russian carries complex subject explanation, while Estonian is introduced systematically through terminology, familiar instructions, visuals, short definitions, sentence frames, and short oral output.

The production pilot contains four linked grade-5 science lessons for the water unit, one thematic plan, and one explicitly incomplete annual-course excerpt. Reusable language-profile defaults also describe the intended progression for later grade-6 science and grade-7 geography work; they are planning defaults, not fixed learner facts.

Run the focused tests and production validation with:

```sh
npm run test:plans
npm run check:plans
```

Validation reuses the curriculum-map route loader and canonical Opiq checks. It verifies cross-file links, timing, source ownership, programme type, provenance, bilingual objectives, vocabulary recycling, scaffold release, separate assessment, and incomplete annual-course declarations. These design controls do not guarantee learning outcomes.
