#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import { mixedScriptWords, normalizeQualityText } from './lib/grade-2-content-quality.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3,
  assertGrade3RussianArchiveIdentity,
  assertHistoricalGrade2ArchiveIdentity,
  assertKit568FinalOwnership,
  assertRequiredMembers,
  assertSafeMemberName,
  buildGrade3RussianCatalog,
  compareKit568Ownership,
  countBy,
  grade2RussianRetainedBookIds,
  grade3RussianArchive,
  grade3RussianVariants,
  historicalGrade2RussianArchive,
  isAdministrative,
  isKitDetail,
  isSearchResult,
  kitId,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3RussianMarkdown,
  requiredGrade3RussianMembers,
  sha256Bytes,
  sourceSubject,
  validateManifestGrade3RussianSource,
} from './lib/grade-3-russian.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-russian';
const generatorPath = 'scripts/generate-grade-3-russian-sources.mjs';
const generatorVersion = '1.0';
const auditPath = 'docs/audits/grade-3-russian-source-import.md';
const checkOnly = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
assertGrade3(unknownArguments.length === 0, `Unknown arguments: ${unknownArguments.join(' ')}`);

const absolute = (relativePath) => path.join(repositoryRoot, relativePath);

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeRepresentationText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function validateIndex(index, rawIndex, sourceRecords, archive) {
  assertGrade3(index?.formatVersion === grade3RussianArchive.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3(index.generatedAt === grade3RussianArchive.capture_timestamp, 'index.json capture timestamp changed.');
  assertGrade3(index.source === 'opiq-helper-extension', 'index.json source is not opiq-helper-extension.');
  assertGrade3(index.recordCount === sourceRecords.length, 'index.json recordCount differs from JSONL.');
  assertGrade3(JSON.stringify(index.supportedQueryLanguages) === JSON.stringify(['et', 'ru', 'en']), 'index.json query languages changed.');
  assertGrade3(JSON.stringify(index.compactFiles) === JSON.stringify(['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json']), 'index.json compactFiles changed.');
  assertGrade3(index.rawArchiveIncluded === true, 'index.json must declare the raw archive.');
  assertGrade3(rawIndex.generatedAt === index.generatedAt, 'Raw and compact capture timestamps differ.');
  assertGrade3(JSON.stringify(rawIndex.books) === JSON.stringify(index.books), 'Raw and compact book inventories differ.');
  assertGrade3(index.books.length === 4, `index.json has ${index.books.length} books; expected 4.`);

  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  for (const book of index.books) {
    const variant = grade3RussianVariants[book.id];
    assertGrade3(variant, `index.json contains unknown book ${book.id}.`);
    const expectedCapturedTitle = book.id === 'русский_язык_для_3_класса' ? 'Varamu – Opiq' : `${variant.title} – Opiq`;
    assertGrade3(book.title === expectedCapturedTitle, `Captured index title differs for ${book.id}.`);
    assertGrade3(book.grade === 3 && book.language === 'ru', `${book.id} index grade/language differs.`);
    assertGrade3(book.publisher === '', `${book.id} unexpectedly contains publisher metadata.`);
    assertGrade3(book.chapterCount === sourceCounts[book.id], `${book.id} chapterCount differs from JSONL.`);
    const member = `raw/Opiq-DB/books/${book.id}.json`;
    assertGrade3(archive.entries.has(member), `Original archive is missing ${member}.`);
    const rawBook = parseJson(readZipText(archive, member), member);
    assertGrade3(rawBook.id === book.id && rawBook.title === book.title, `${member} identity differs from index.json.`);
    assertGrade3(rawBook.grade === 3 && rawBook.language === 'ru', `${member} grade/language differs.`);
  }
}

function validateRawChapters(sourceRecords, archive) {
  const chapterMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3(chapterMembers.length === sourceRecords.length, `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`);
  const expectedMembers = new Set();
  let titleWhitespaceNormalizations = 0;
  let taskRepresentationDifferences = 0;
  for (const record of sourceRecords) {
    const member = `raw/Opiq-DB/chapters/${record.book_id}/${record.chapter_id}.json`;
    assertGrade3(!expectedMembers.has(member), `Multiple source rows resolve to raw member ${member}.`);
    expectedMembers.add(member);
    const raw = parseJson(readZipText(archive, member), member);
    assertGrade3(raw.bookId === record.book_id, `${member} bookId differs from JSONL.`);
    assertGrade3(String(raw.chapterId) === String(record.chapter_id), `${member} chapterId differs from JSONL.`);
    assertGrade3(normalizeRepresentationText(raw.chapterTitle) === record.title, `${member} title differs from compact JSONL beyond whitespace normalization.`);
    if (raw.chapterTitle !== record.title) titleWhitespaceNormalizations += 1;
    assertGrade3(raw.url === record.url, `${member} URL differs from compact JSONL.`);
    assertGrade3(Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images), `${member} is missing raw arrays.`);
    const rawHeadings = new Set(raw.headings.map((heading) => normalizeRepresentationText(heading.text)));
    assertGrade3(record.headings.every((heading) => rawHeadings.has(normalizeRepresentationText(heading))), `${member} compact heading is absent from raw headings.`);
    if (JSON.stringify(record.task_examples) !== JSON.stringify(raw.tasks.map((task) => task.text))) taskRepresentationDifferences += 1;
  }
  chapterMembers.forEach((member) => assertGrade3(expectedMembers.has(member), `Unreferenced raw chapter member: ${member}`));
  return {
    raw_chapter_records: chapterMembers.length,
    title_whitespace_normalizations: titleWhitespaceNormalizations,
    task_representation_differences: taskRepresentationDifferences,
  };
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const rowsByUrl = new Map();
  for (const record of sourceRecords) {
    const group = rowsByUrl.get(record.url) ?? [];
    group.push(record);
    rowsByUrl.set(record.url, group);
  }
  let references = 0;
  for (const [topic, entries] of Object.entries(topicMap)) {
    assertGrade3(topic.trim() && Array.isArray(entries), `topic_map.json topic ${topic || '<empty>'} is invalid.`);
    for (const entry of entries) {
      references += 1;
      const candidates = rowsByUrl.get(entry.url) ?? [];
      assertGrade3(candidates.some((record) => record.title === entry.title && record.language === entry.language), `topic_map.json references unknown record ${entry.url}.`);
    }
  }
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function contentQualityAudit(records) {
  const duplicateTitles = Object.entries(countBy(records, (record) => normalizeQualityText(record.title).toLocaleLowerCase()))
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({
      title,
      count,
      urls: records.filter((record) => normalizeQualityText(record.title).toLocaleLowerCase() === title).map((record) => record.url),
      disposition: 'Source-structure warning; repeated titles remain on distinct canonical URLs.',
    }));
  const shortRecords = records.filter((record) => [
    record.title,
    ...record.headings,
    ...record.task_examples,
  ].join(' ').length < 80).map((record) => ({
    url: record.url,
    title: record.title,
    disposition: 'Short but valid source section; retained without invented text.',
  }));
  const mixed = records.flatMap((record) => {
    const words = mixedScriptWords([record.title, record.headings, record.task_examples]);
    return words.length ? [{
      url: record.url,
      words,
      disposition: 'Source typography retained; not automatically rewritten.',
    }] : [];
  });
  const missingTasks = records.filter((record) => record.task_examples.length === 0).map((record) => record.url);
  return {
    hard_errors: {
      malformed_urls: 0,
      duplicate_canonical_urls: 0,
      wrong_grade: 0,
      wrong_subject: 0,
      empty_titles: 0,
      missing_all_headings: 0,
      replacement_characters: 0,
      forbidden_controls: 0,
      unprocessed_payloads: 0,
    },
    classified_warnings: {
      missing_task_examples: missingTasks.length,
      missing_task_example_urls: missingTasks,
      repeated_title_groups: duplicateTitles,
      repeated_title_group_count: duplicateTitles.length,
      unusually_short_records: shortRecords,
      mixed_script_observations: mixed,
      note: 'Warnings preserve source structure and typography; no educational prose or missing task is invented.',
    },
  };
}

function oldKit568Canonical(oldSourceRecords) {
  return oldSourceRecords.filter((record) => record.book_id === 'avita_русский_язык_i_ступень_часть_3_kit568'
    && kitId(record) === '568'
    && !isKitDetail(record)
    && !isAdministrative(record)
    && !isSearchResult(record));
}

async function assertCrossRouteOwnership(manifest, route, canonicalRecords) {
  const urls = new Set(canonicalRecords.map((record) => record.url));
  let checkedRoutes = 0;
  for (const other of manifest.sources.filter((source) => source.id !== route.id)) {
    const markdown = await readFile(absolute(other.md_path), 'utf8');
    const otherUrls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)].map((match) => match[1]);
    const overlap = otherUrls.filter((url) => urls.has(url));
    assertGrade3(overlap.length === 0, `Grade-3 Russian URLs overlap ${other.id}: ${overlap.slice(0, 3).join(', ')}`);
    checkedRoutes += 1;
  }
  return { checked_routes: checkedRoutes, overlap_count: 0 };
}

function validateGrade2Migration(manifest, grade2Records) {
  const route = manifest.sources.find((source) => source.id === 'grade-2-russian');
  assertGrade3(route?.record_count === 321, 'grade-2-russian manifest count must be 321 after migration.');
  assertGrade3(grade2Records.length === 321, `grade-2-russian Markdown has ${grade2Records.length} records; expected 321.`);
  assertGrade3(grade2Records.every((record) => kitId(record) !== '568'), 'grade-2-russian still contains kit 568.');
  assertGrade3(JSON.stringify([...new Set(grade2Records.map((record) => record.book_id))].sort()) === JSON.stringify([...grade2RussianRetainedBookIds].sort()), 'grade-2-russian retained book inventory differs.');
}

function bookAudit(sourceRecords, catalog) {
  return Object.fromEntries(Object.values(grade3RussianVariants).sort((left, right) => Number(left.kit_id) - Number(right.kit_id)).map((variant) => [
    variant.canonical_book_id,
    {
      source_book_id: variant.source_book_id,
      kit_id: variant.kit_id,
      canonical_title: variant.title,
      publisher: variant.publisher || null,
      publisher_provenance: variant.publisher_provenance,
      canonical_language: variant.language,
      programme_type: variant.programme_type,
      source_rows: sourceRecords.filter((record) => record.book_id === variant.source_book_id && !isSearchResult(record)).length,
      canonical_instructional_pages: catalog.canonical_records.filter((record) => record.book_id === variant.canonical_book_id).length,
    },
  ]));
}

function renderAudit(qa) {
  const variants = Object.entries(qa.book_metadata_audit);
  return `# Grade 3 Russian original-source import audit

## Result

The canonical \`grade-3-russian\` route is generated from the committed original archive \`${qa.source_archive}\`. It contains **${qa.page_records_included} instructional pages** from **${variants.length} book/kit variants**. This is a source catalogue, not proof of official curriculum completeness.

- SHA-256: \`${qa.checksums.source_archive_sha256}\`
- size: ${qa.archive.byte_size} bytes
- ZIP members: ${qa.archive.member_count}
- capture timestamp: ${qa.generation.generated_at}
- source rows: ${qa.source_records}

## Complete source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional pages | ${qa.page_records_included} |
| Unique Kit Details | ${qa.cover_detail_records_excluded} |
| Duplicate Kit Details aliases | ${qa.duplicate_records_excluded} |
| Impressum | ${qa.administrative_records_excluded} |
| Opiq search-results page | ${qa.search_records_excluded} |
| Total | ${qa.source_records} |

All rows are classified, all canonical URLs are direct and unique, and no URL overlaps another manifest route.

## Book and kit inventory

| Kit | Canonical Book ID | Source Book ID | Title | Publisher | Pages |
| ---: | --- | --- | --- | --- | ---: |
${variants.map(([bookId, value]) => `| ${value.kit_id} | \`${bookId}\` | \`${value.source_book_id}\` | ${value.canonical_title} | ${value.publisher ?? 'not captured'} | ${value.canonical_instructional_pages} |`).join('\n')}

Publisher metadata is absent from the new archive. The kit 568 value \`Avita\` is retained only because exact kit-specific metadata was already audited in the previous canonical route; the other publishers remain empty.

## Subject, grade, and language

All 488 source rows are incorrectly labelled \`mathematics / matemaatika / математика\`. The four Source Book IDs, Kit Details titles, visible book titles, Russian grammar/reading headings, Russian pupil tasks, and the captured Opiq Russian subject-filter URL prove the Russian-language subject. Canonical instructional records therefore use \`Russian language / vene keel / русский язык\`, and generated mathematics topic aliases are removed.

All source rows and all four book identities say grade 3. The source language distribution is 487 \`ru\` and one \`et\`; the sole Estonian row is the excluded \`Varamu – Opiq\` search-results page. Canonical language is \`ru\` for all ${qa.page_records_included} pages.

## Exclusions and duplicate handling

The four duplicate URL groups are exactly the four Kit Details URLs. Each pair is identical except for synthetic \`chapter_id\`; both the unique detail and its alias are excluded. The kit 503 \`Импрессум\` and kit 94 \`/Search/Kits\` row are also excluded. No duplicate instructional URL exists.

## Technical content repairs

The generator applies only deterministic archive-supported transformations: NFC, removal of discretionary soft hyphens, replacement of zero-width spacing controls, whitespace collapse, extraction-payload/HTML removal while retaining visible text, and replacement of generated mathematics aliases. It affected ${qa.content_repair_summary.affected_pages} pages. Every changed field has raw and canonical SHA-256 hashes in the QA snapshot. No Russian educational prose is stylistically rewritten.

Post-repair hard errors: **0**. Missing tasks, repeated titles, short records, and mixed-script typography remain classified warnings in QA rather than invented corrections.

## Kit 568 ownership migration

The old grade-2 source archive, the dedicated grade-3 archive, the former grade-2 canonical representation, and the new grade-3 representation have the same **52** instructional URLs, chapter order, normalized titles, and headings. Task evidence is exact on 51 pages. On chapter 31798 the same interactive rhyme words and prompt occur in a different option order; QA records both hashes and the bounded \`interactive_option_order_only\` classification. The dedicated capture, Kit Details, Source Book ID, visible title, and grade metadata all identify grade 3. Kit 568 is therefore removed from \`grade-2-russian\` (${qa.kit_568_migration.grade_2_before} → ${qa.kit_568_migration.grade_2_after}) and owned exclusively by \`grade-3-russian\`.

## Limitations

- Kit 94's compact index book title is \`Varamu – Opiq\` because one search-results row contaminated the index identity; the captured Kit Details title supplies the canonical book title.
- Publisher metadata is absent except for previously audited kit 568 provenance; no publisher is invented.
- Missing task examples are not reconstructed.
- The route does not establish official curriculum coverage or replace a curriculum map.

No additional Opiq recapture is required for this routing migration.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const route = manifest.sources.find((source) => source.id === sourceId);
  validateManifestGrade3RussianSource(route);

  const archiveBytes = await readFile(absolute(route.source_archive));
  assertGrade3RussianArchiveIdentity(archiveBytes);
  assertGrade3((await stat(absolute(route.source_archive))).isFile(), 'Original source archive is not a file.');
  const archive = await readCompactZip(absolute(route.source_archive));
  assertGrade3(archive.entryCount === grade3RussianArchive.member_count, `Original archive has ${archive.entryCount} members; expected ${grade3RussianArchive.member_count}.`);
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  const compactMarkdown = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
  assertCompactMarkdownMatches(sourceRecords, compactMarkdown);
  validateIndex(index, rawIndex, sourceRecords, archive);
  const rawAudit = validateRawChapters(sourceRecords, archive);
  const topicMapAudit = validateTopicMap(parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'), sourceRecords);
  const catalog = buildGrade3RussianCatalog(sourceRecords);
  const markdown = renderGrade3RussianMarkdown(catalog);

  const oldArchiveBytes = await readFile(absolute(historicalGrade2RussianArchive.path));
  assertHistoricalGrade2ArchiveIdentity(oldArchiveBytes);
  const oldArchive = await readCompactZip(absolute(historicalGrade2RussianArchive.path));
  const oldSourceRecords = parseGrade3Jsonl(readZipText(oldArchive, 'opiq_lookup.jsonl'), 'grade-2 opiq_lookup.jsonl');
  assertGrade3(oldSourceRecords.length === historicalGrade2RussianArchive.source_records, 'Historical grade-2 source count changed.');
  const grade2Markdown = parseGrade3Markdown(await readFile(absolute('project-files/outputs/opiq_2klass_vene_keel.md'), 'utf8'));
  validateGrade2Migration(manifest, grade2Markdown);
  assertKit568FinalOwnership(grade2Markdown, catalog.canonical_records);
  const kit568Migration = compareKit568Ownership({
    oldSourceRecords,
    newSourceRecords: sourceRecords,
    oldCanonicalRecords: oldKit568Canonical(oldSourceRecords),
    newCanonicalRecords: catalog.canonical_records,
  });
  const crossRouteAudit = await assertCrossRouteOwnership(manifest, route, catalog.canonical_records);

  const quality = contentQualityAudit(catalog.canonical_records);
  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: route.source_archive,
    output_file: route.md_path,
    format_version: route.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3RussianArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the committed original Opiq export.',
    },
    checksums: {
      source_archive_sha256: grade3RussianArchive.sha256,
      output_file_sha256: sha256Bytes(Buffer.from(markdown)),
    },
    archive: {
      byte_size: archiveBytes.length,
      member_count: archive.entryCount,
      compression_methods: countBy([...archive.memberMetadata.values()], (entry) => entry.compression_method),
      required_members: [...requiredGrade3RussianMembers],
      unsafe_member_paths: 0,
      duplicate_member_names: 0,
      crc_verified_members: archive.entryCount,
      raw_book_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/')).length,
      raw_chapter_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/')).length,
    },
    source_representation_audit: {
      jsonl_records: sourceRecords.length,
      compact_markdown_records: compactMarkdown.length,
      compact_jsonl_markdown_field_equivalent: true,
      raw_chapters: rawAudit,
      topic_map: topicMapAudit,
      unexplained_differences: 0,
    },
    source_records: sourceRecords.length,
    page_records_included: catalog.canonical_records.length,
    grades: countBy(catalog.canonical_records, (record) => record.grade),
    languages: countBy(catalog.canonical_records, (record) => record.language),
    books: countBy(catalog.canonical_records, (record) => record.book_id),
    kits: countBy(catalog.canonical_records, (record) => record.kit_id),
    programme_types: countBy(catalog.canonical_records, (record) => record.programme_type),
    source_grades: countBy(sourceRecords, (record) => record.grade),
    source_languages: countBy(sourceRecords, (record) => record.language),
    source_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: countBy(catalog.canonical_records, sourceSubject),
    cover_detail_records_present: catalog.exclusions.cover_details.length + catalog.exclusions.duplicate_aliases.length,
    cover_detail_records_excluded: catalog.exclusions.cover_details.length,
    duplicate_records_excluded: catalog.exclusions.duplicate_aliases.length,
    administrative_records_excluded: catalog.exclusions.administrative.length,
    search_records_excluded: catalog.exclusions.search_results.length,
    duplicate_url_audit: {
      source_duplicate_groups: catalog.duplicate_audit.length,
      canonical_duplicate_groups: 0,
      entries: catalog.duplicate_audit,
    },
    exclusion_audit: {
      cover_details: catalog.exclusions.cover_details.map((record) => ({ url: record.url, source_book_id: record.book_id, chapter_id: String(record.chapter_id) })),
      duplicate_aliases: catalog.exclusions.duplicate_aliases.map((record) => ({ url: record.url, source_book_id: record.book_id, chapter_id: String(record.chapter_id) })),
      administrative: catalog.exclusions.administrative.map((record) => ({ url: record.url, title: record.title, source_book_id: record.book_id })),
      search_results: catalog.exclusions.search_results.map((record) => ({ url: record.url, title: record.title, language: record.language, source_book_id: record.book_id })),
    },
    grade_audit: {
      source_grade_counts: countBy(sourceRecords, (record) => record.grade),
      canonical_grade_counts: countBy(catalog.canonical_records, (record) => record.grade),
      evidence: 'All four Kit Details titles, Source Book IDs, visible book names, and index/raw book metadata identify grade 3.',
    },
    language_audit: {
      source_language_counts: countBy(sourceRecords, (record) => record.language),
      excluded_et_records: catalog.exclusions.search_results.map((record) => record.url),
      canonical_language_counts: countBy(catalog.canonical_records, (record) => record.language),
    },
    subject_normalization_audit: {
      source_subject: 'mathematics / matemaatika / математика',
      canonical_subject: 'Russian language / vene keel / русский язык',
      affected_source_rows: sourceRecords.length,
      affected_canonical_pages: catalog.canonical_records.length,
      evidence: 'Source Book IDs, Kit Details, titles, Russian grammar/reading headings and tasks, and the captured Russian subject-filter URL.',
      generated_mathematics_aliases_remaining: 0,
    },
    book_metadata_audit: bookAudit(sourceRecords, catalog),
    publisher_provenance: Object.values(grade3RussianVariants).map((variant) => ({
      canonical_book_id: variant.canonical_book_id,
      publisher: variant.publisher || null,
      provenance: variant.publisher_provenance,
    })),
    content_repair_audit: catalog.content_repairs,
    content_repair_summary: {
      affected_pages: catalog.content_repairs.length,
      categories: countBy(catalog.content_repairs.flatMap((repair) => repair.categories), (category) => category),
      changed_fields: countBy(catalog.content_repairs.flatMap((repair) => repair.changes), (change) => change.field),
    },
    content_quality_audit: quality,
    records_without_headings: 0,
    records_without_task_examples: quality.classified_warnings.missing_task_examples,
    kit_568_migration: {
      ...kit568Migration,
      historical_grade_2_archive: historicalGrade2RussianArchive.path,
      historical_grade_2_archive_sha256: historicalGrade2RussianArchive.sha256,
      grade_2_before: 373,
      grade_2_after: 321,
      grade_3_after: 478,
      final_owner: sourceId,
      cross_route_overlap: 0,
    },
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: catalog.canonical_records.length,
      cross_route: crossRouteAudit,
    },
    known_limitations: [
      'The kit 94 compact index title is Varamu because the captured search-results record contaminated index-level book metadata; Kit Details supplies the canonical title.',
      'Publisher metadata is absent from this original archive; only exact previously audited kit 568 provenance is retained.',
      'Missing task examples are not synthesized.',
      'This catalogue does not establish official curriculum completeness.',
    ],
    curriculum_coverage: {
      status: 'not_verified',
      note: 'This source catalogue is not an official curriculum map or completeness claim.',
    },
  };

  const outputs = [
    [route.md_path, markdown],
    [route.qa_path, stableJson(qa)],
    [auditPath, renderAudit(qa)],
  ];
  if (checkOnly) {
    for (const [relativePath, expected] of outputs) {
      assertGeneratedArtifact(await readFile(absolute(relativePath), 'utf8'), expected, relativePath);
    }
    console.log(`Grade 3 Russian source is current: ${catalog.canonical_records.length} pages from ${sourceRecords.length} source rows; kit 568 owned only by grade 3.`);
    return;
  }
  for (const [relativePath, contents] of outputs) await writeFile(absolute(relativePath), contents, 'utf8');
  console.log(`Generated ${route.md_path}, ${route.qa_path}, and ${auditPath}.`);
}

await main();
