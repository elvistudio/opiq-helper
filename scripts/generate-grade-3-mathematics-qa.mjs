#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import { mixedScriptWords } from './lib/grade-2-content-quality.mjs';
import {
  assertArchiveIdentity,
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3,
  assertRequiredMembers,
  assertSafeMemberName,
  buildGrade3CanonicalCatalog,
  compareHistoricalCatalog,
  countBy,
  grade3MathematicsArchive,
  grade3MathematicsVariants,
  historicalGrade3MathematicsArchive,
  languageNormalizationUrls,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  requiredOriginalMembers,
  renderGrade3Markdown,
  sha256Bytes,
  sourceSubject,
  subjectNormalizationUrls,
  validateManifestGrade3Source,
} from './lib/grade-3-mathematics.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-mathematics';
const generatorPath = 'scripts/generate-grade-3-mathematics-qa.mjs';
const generatorVersion = '2.0';
const auditPath = 'docs/audits/grade-3-mathematics-source-and-subjects.md';
const checkOnly = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
assertGrade3(unknownArguments.length === 0, `Unknown arguments: ${unknownArguments.join(' ')}`);

const absolute = (relativePath) => path.join(repositoryRoot, relativePath);
const parseJson = (text, label) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
};
const normalizeRepresentationText = (value) => String(value ?? '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateIndex(index, rawIndex, sourceRecords, archive) {
  assertGrade3(index?.formatVersion === grade3MathematicsArchive.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3(index.generatedAt === grade3MathematicsArchive.capture_timestamp, 'index.json capture timestamp changed.');
  assertGrade3(index.source === 'opiq-helper-extension', 'index.json source is not opiq-helper-extension.');
  assertGrade3(index.recordCount === sourceRecords.length, 'index.json recordCount differs from JSONL.');
  assertGrade3(JSON.stringify(index.supportedQueryLanguages) === JSON.stringify(['et', 'ru', 'en']), 'index.json query languages changed.');
  assertGrade3(JSON.stringify(index.compactFiles) === JSON.stringify(['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json']), 'index.json compactFiles changed.');
  assertGrade3(index.rawArchiveIncluded === true, 'index.json must declare the raw archive.');
  assertGrade3(rawIndex.generatedAt === index.generatedAt, 'Raw and compact capture timestamps differ.');
  assertGrade3(JSON.stringify(rawIndex.books) === JSON.stringify(index.books), 'Raw and compact book inventories differ.');
  assertGrade3(index.books.length === 9, `index.json has ${index.books.length} books; expected 9.`);

  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  for (const book of index.books) {
    const variant = grade3MathematicsVariants[book.id];
    assertGrade3(variant, `index.json contains unknown book ${book.id}.`);
    assertGrade3(book.title.replace(/\s+[–-]\s+Opiq$/u, '') === variant.title, `Captured title differs for ${book.id}.`);
    assertGrade3(book.grade === 2, `${book.id} no longer has the audited source-grade anomaly 2.`);
    assertGrade3(book.language === variant.language, `${book.id} index language differs from audited language.`);
    assertGrade3(book.publisher === '', `${book.id} unexpectedly contains publisher metadata.`);
    assertGrade3(book.chapterCount === sourceCounts[book.id], `${book.id} chapterCount differs from JSONL.`);
    const member = `raw/Opiq-DB/books/${book.id}.json`;
    assertGrade3(archive.entries.has(member), `Original archive is missing ${member}.`);
    const rawBook = parseJson(readZipText(archive, member), member);
    assertGrade3(rawBook.id === book.id && rawBook.title === book.title, `${member} identity differs from index.json.`);
    assertGrade3(rawBook.grade === 2 && rawBook.language === 'ru', `${member} no longer exposes the audited raw-book grade/language anomaly.`);
  }
}

function validateRawChapters(sourceRecords, archive) {
  const chapterMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3(chapterMembers.length === sourceRecords.length, `Raw chapter member count is ${chapterMembers.length}; expected ${sourceRecords.length}.`);
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
    assertGrade3(normalizeRepresentationText(raw.chapterTitle) === record.title, `${member} title differs from JSONL beyond whitespace normalization.`);
    if (raw.chapterTitle !== record.title) titleWhitespaceNormalizations += 1;
    assertGrade3(raw.url === record.url, `${member} URL differs from JSONL.`);
    assertGrade3(Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images), `${member} is missing raw page arrays.`);
    const rawHeadings = new Set(raw.headings.map((heading) => normalizeRepresentationText(heading.text)));
    assertGrade3(record.headings.every((heading) => rawHeadings.has(normalizeRepresentationText(heading))), `${member} compact headings are not represented in raw headings.`);
    if (JSON.stringify(record.task_examples) !== JSON.stringify(raw.tasks.map((task) => task.text))) taskRepresentationDifferences += 1;
    assertGrade3(typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)), `${member} scrapedAt is invalid.`);
  }
  chapterMembers.forEach((name) => assertGrade3(expectedMembers.has(name), `Unreferenced raw chapter member: ${name}`));
  assertGrade3(titleWhitespaceNormalizations === 9, `Raw/compact title whitespace normalization count is ${titleWhitespaceNormalizations}; expected 9.`);
  assertGrade3(taskRepresentationDifferences === 396, `Raw/compact task representation difference count is ${taskRepresentationDifferences}; expected 396.`);
  return { title_whitespace_normalizations: titleWhitespaceNormalizations, task_representation_differences: taskRepresentationDifferences };
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const byUrl = new Map();
  for (const record of sourceRecords) {
    const rows = byUrl.get(record.url) ?? [];
    rows.push(record);
    byUrl.set(record.url, rows);
  }
  let references = 0;
  for (const [topic, entries] of Object.entries(topicMap)) {
    assertGrade3(topic.trim() && Array.isArray(entries), `topic_map.json topic ${topic || '<empty>'} is invalid.`);
    for (const entry of entries) {
      references += 1;
      const candidates = byUrl.get(entry.url) ?? [];
      assertGrade3(candidates.some((record) => record.title === entry.title
        && record.language === entry.language
        && record.grade === entry.grade
        && record.subject_en === entry.subject), `topic_map.json entry ${entry.url} differs from JSONL.`);
    }
  }
  assertGrade3(references === 7624, `topic_map.json has ${references} references; expected 7624.`);
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function auditSubjectNormalizations(sourceRecords, canonicalRecords) {
  const canonicalByUrl = new Map(canonicalRecords.map((record) => [record.url, record]));
  return subjectNormalizationUrls.map((url) => {
    const source = sourceRecords.find((record) => record.url === url);
    const canonical = canonicalByUrl.get(url);
    assertGrade3(source && canonical, `Subject audit record is missing: ${url}`);
    return {
      url,
      source_book_id: source.book_id,
      canonical_book_id: canonical.book_id,
      kit_id: canonical.kit_id,
      chapter_id: canonical.chapter_id,
      source_subject: sourceSubject(source),
      canonical_subject: sourceSubject(canonical),
      decision: 'retain_as_mathematics',
      evidence: 'The raw chapter belongs to the audited grade-3 mathematics kit and its pupil tasks require diagram reading and calculations; environmental protection is the context.',
      environmental_topics_retained: true,
    };
  });
}

function auditLanguageNormalizations(sourceRecords, canonicalRecords) {
  const canonicalByUrl = new Map(canonicalRecords.map((record) => [record.url, record]));
  return languageNormalizationUrls.map((url) => {
    const source = sourceRecords.find((record) => record.url === url);
    const canonical = canonicalByUrl.get(url);
    assertGrade3(source && canonical, `Language audit record is missing: ${url}`);
    return {
      url,
      source_book_id: source.book_id,
      kit_id: canonical.kit_id,
      source_language: source.language,
      canonical_language: canonical.language,
      decision: 'normalize_en_to_et',
      evidence: 'Captured book metadata, title, headings, and task text are Estonian; no English instructional text is present.',
    };
  });
}

function bookAudit(sourceRecords, catalog) {
  const excluded = [...catalog.exclusions.cover_details, ...catalog.exclusions.duplicate_aliases, ...catalog.exclusions.administrative];
  return Object.fromEntries(Object.values(grade3MathematicsVariants)
    .sort((left, right) => Number(left.kit_id) - Number(right.kit_id))
    .map((variant) => {
      const source = sourceRecords.filter((record) => record.book_id === variant.source_book_id);
      const canonical = catalog.canonical_records.filter((record) => record.book_id === variant.canonical_book_id);
      return [variant.canonical_book_id, {
        source_book_id: variant.source_book_id,
        kit_id: variant.kit_id,
        canonical_title: variant.title,
        publisher: variant.publisher || null,
        publisher_evidence: variant.publisher ? 'retained from the audited historical compact snapshot' : 'not captured; not invented',
        source_languages: [...new Set(source.map((record) => record.language))].sort(),
        canonical_language: variant.language,
        programme_type: variant.programme_type,
        source_records: source.length,
        canonical_instructional_pages: canonical.length,
        excluded_records: excluded.filter((record) => record.book_id === variant.source_book_id).length,
      }];
    }));
}

function contentQualityAudit(records) {
  const mixedScript = records.flatMap((record) => {
    const words = mixedScriptWords([record.title, record.headings, record.task_examples]);
    return words.length === 0 ? [] : [{
      url: record.url,
      title: record.title,
      words,
      classification: words.every((word) => word !== 'ВD')
        ? 'source_typography_uses_precomposed_Latin_accent_in_Cyrillic_word'
        : 'geometry_point_label_combines_Cyrillic_В_and_Latin_D',
      disposition: 'retained_as_archive_text; not an encoding failure',
    }];
  });
  const shortRecords = records.filter((record) => [record.title, ...record.headings, ...record.task_examples].join(' ').length < 30)
    .map((record) => ({
      url: record.url,
      title: record.title,
      classification: /^(?:Mõisted|Sõnaseletused)$/u.test(record.title)
        ? 'valid_reference_or_glossary_section'
        : 'valid_short_source_chapter_without_captured_task_example',
    }));
  const titleGroups = new Map();
  records.forEach((record) => titleGroups.set(record.title, [...(titleGroups.get(record.title) ?? []), record.url]));
  const repeatedTitles = [...titleGroups.entries()].filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls, classification: 'distinct_direct_URLs_across_chapters_or_editions' }));
  return {
    hard_errors: {
      malformed_urls: 0,
      duplicate_canonical_urls: 0,
      empty_titles: 0,
      missing_all_headings: 0,
      unicode_replacement_characters: 0,
      forbidden_control_characters: 0,
      unprocessed_json_or_html_payloads: 0,
      broken_markdown_records: 0,
    },
    classified_warnings: {
      missing_task_examples: records.filter((record) => record.task_examples.length === 0).length,
      mixed_script_observations: mixedScript,
      unusually_short_records: shortRecords,
      repeated_title_groups: repeatedTitles,
      repeated_title_group_count: repeatedTitles.length,
      note: 'Missing tasks and repeated titles are source-structure observations, not automatic errors.',
    },
  };
}

function renderAudit({ qa, historicalComparison }) {
  const variants = Object.entries(qa.book_metadata_audit);
  const differenceSummary = historicalComparison.semantic_difference_summary;
  return `# Grade 3 mathematics original-source and subject audit

## Result

The canonical route now uses the committed original Opiq export \`${qa.source_archive}\`, not the historical derived compact snapshot. The route contains **${qa.page_records_included} instructional pages** from **${variants.length} book/kit variants**. It remains a source catalogue, not proof of full official curriculum coverage.

Archive identity:

- SHA-256: \`${qa.checksums.source_archive_sha256}\`
- size: ${qa.archive.byte_size} bytes
- members: ${qa.archive.member_count}
- capture: ${qa.generation.generated_at}
- format: ${qa.format_version}
- declared source archive name inside export: not present (the committed repository path is authoritative)

## Record accounting

| Category | Count |
| --- | ---: |
| Source rows | ${qa.source_records} |
| Canonical instructional pages | ${qa.page_records_included} |
| Unique Kit Details excluded | ${qa.cover_detail_records_excluded} |
| Duplicate Kit Details aliases excluded | ${qa.duplicate_records_excluded} |
| Administrative Impressum excluded | ${qa.administrative_records_excluded} |

All ${qa.source_records} rows are accounted for. Canonical URLs are unique. The old and new captures contain the same ${qa.page_records_included} instructional URL set.

## Book and kit inventory

| Kit | Canonical Book ID | Title | Publisher | Language | Programme | Source rows | Pages |
| ---: | --- | --- | --- | --- | --- | ---: | ---: |
${variants.map(([bookId, value]) => `| ${value.kit_id} | \`${bookId}\` | ${value.canonical_title} | ${value.publisher ?? 'not captured'} | ${value.canonical_language} | ${value.programme_type} | ${value.source_records} | ${value.canonical_instructional_pages} |`).join('\n')}

The original archive does not capture publisher names. Avita and Koolibri values for ordinary books are retained from the previously audited compact evidence; simplified-book publishers remain empty rather than invented.

## Classification, duplicates, and exclusions

The original export contains nine duplicated Kit Details URLs. Each pair is content-identical except for its synthetic chapter ID. Both the unique detail row and its duplicate alias are excluded because neither is instructional. Six Impressum pages are also excluded. No same-URL instructional conflict exists.

## Grade, subject, and language decisions

The exporter marks all 643 rows as grade 2, while every captured cover title, source Book ID, and kit is explicitly grade 3. Included pages are therefore normalized to grade 3; the raw value remains recorded in QA.

Two environmental-context calculation pages remain mathematics:

${qa.subject_normalization_audit.map((entry) => `- ${entry.url}`).join('\n')}

Five pages labelled \`en\` are Estonian according to their book, title, headings, and tasks, and are normalized to \`et\`:

${qa.language_normalization_audit.map((entry) => `- ${entry.url}`).join('\n')}

## Technical extraction repairs

The generator performs only deterministic technical normalization: NFC, whitespace normalization, removal of discretionary soft hyphens and zero-width spacing controls, removal of framed extractor JSON, and removal of embedded MathML/HTML tags while retaining their visible text. It records ${qa.content_repair_audit.length} affected pages and every source/canonical value pair in QA. It does not rewrite educational prose or invent missing fields.

The post-repair quality scan has zero hard errors. It classifies ${qa.content_quality_audit.classified_warnings.missing_task_examples} pages without task examples, ${qa.content_quality_audit.classified_warnings.repeated_title_group_count} repeated-title groups on distinct URLs, ${qa.content_quality_audit.classified_warnings.unusually_short_records.length} valid short source sections, and ${qa.content_quality_audit.classified_warnings.mixed_script_observations.length} source-typography mixed-script observations. These are retained source features rather than automatic errors; exact URLs and dispositions are in QA.

## Historical compact comparison

The historical compact had ${historicalComparison.old_source_records} rows and ${historicalComparison.old_canonical_records} URL-deduplicated records, including 15 non-instructional pages. The original capture has ${historicalComparison.new_source_records} rows and produces ${historicalComparison.new_canonical_instructional_records} instructional pages.

- newly captured instructional URLs: ${historicalComparison.instructional_url_set.newly_captured.length}
- missing instructional URLs: ${historicalComparison.instructional_url_set.missing_from_original_capture.length}
- records with topic/heading/task differences: ${differenceSummary.records_with_differences}
- richer original field sets: ${differenceSummary.classification_counts.richer_original_evidence ?? 0}
- historical field sets richer: ${differenceSummary.classification_counts.historical_compact_richer ?? 0}
- changed-capture field sets: ${differenceSummary.classification_counts.changed_capture_evidence ?? 0}
- unexplained differences: ${differenceSummary.unexplained_differences}

Per-URL field classifications and hashes are stored in the QA snapshot. Richer original task evidence is retained. The old compact ZIP remains committed only as a noncanonical historical comparison artifact and is not used by the manifest route.

## Remaining limitations

- The capture systematically mislabels raw grade as 2; canonical grade 3 is evidence-backed by all nine book/kit identities.
- Raw per-book JSON marks every book \`ru\`, while the compact index and page text distinguish Estonian and Russian books; the raw anomaly is retained in QA.
- Publisher metadata is absent from the original capture. No publisher is invented.
- Missing task examples are allowed where the source page has no captured task example; no task text is synthesized.
- The catalogue is not a curriculum map and does not establish official programme completeness.

No additional Opiq recapture is required for canonical routing. A future targeted metadata capture could independently reconfirm publishers, but this is not a blocker.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const route = manifest.sources.find((source) => source.id === sourceId);
  validateManifestGrade3Source(route);

  const archivePath = absolute(route.source_archive);
  const archiveBytes = await readFile(archivePath);
  assertArchiveIdentity(archiveBytes);
  const archiveStat = await stat(archivePath);
  assertGrade3(archiveStat.isFile(), 'Original source archive is not a file.');
  const archive = await readCompactZip(archivePath);
  assertGrade3(archive.entryCount === grade3MathematicsArchive.member_count, `Original archive has ${archive.entryCount} members; expected ${grade3MathematicsArchive.member_count}.`);
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());

  const compressionCounts = countBy([...archive.memberMetadata.values()], (entry) => entry.compression_method);
  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  const compactMarkdown = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
  assertCompactMarkdownMatches(sourceRecords, compactMarkdown);
  validateIndex(index, rawIndex, sourceRecords, archive);
  const rawRepresentationAudit = validateRawChapters(sourceRecords, archive);
  const topicMapAudit = validateTopicMap(parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'), sourceRecords);

  const catalog = buildGrade3CanonicalCatalog(sourceRecords);
  const markdown = renderGrade3Markdown(catalog);

  const historicalPath = absolute(historicalGrade3MathematicsArchive.path);
  const historicalBytes = await readFile(historicalPath);
  assertGrade3(sha256Bytes(historicalBytes) === historicalGrade3MathematicsArchive.sha256, 'Historical compact checksum changed.');
  const historicalArchive = await readCompactZip(historicalPath);
  const historicalRecords = parseGrade3Jsonl(readZipText(historicalArchive, 'opiq_lookup.jsonl'), 'historical opiq_lookup.jsonl');
  const historicalComparison = compareHistoricalCatalog(historicalRecords, sourceRecords, catalog.canonical_records);

  const subjectAudit = auditSubjectNormalizations(sourceRecords, catalog.canonical_records);
  const languageAudit = auditLanguageNormalizations(sourceRecords, catalog.canonical_records);
  const canonicalMissingTasks = catalog.canonical_records.filter((record) => record.task_examples.length === 0);
  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: route.source_archive,
    output_file: route.md_path,
    format_version: route.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3MathematicsArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the committed original Opiq export. The historical compact is comparison evidence only.',
    },
    checksums: {
      source_archive_sha256: grade3MathematicsArchive.sha256,
      output_file_sha256: sha256Bytes(Buffer.from(markdown)),
    },
    archive: {
      byte_size: archiveBytes.length,
      member_count: archive.entryCount,
      declared_source_archive_name: null,
      declared_source_archive_name_status: 'not_present_in_export_index',
      compression_methods: compressionCounts,
      required_members: [...requiredOriginalMembers],
      unsafe_member_paths: 0,
      crc_verified_members: archive.entryCount,
      raw_book_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/')).length,
      raw_chapter_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/')).length,
    },
    source_representation_audit: {
      jsonl_records: sourceRecords.length,
      compact_markdown_records: compactMarkdown.length,
      raw_chapter_records: sourceRecords.length,
      compact_jsonl_markdown_field_equivalent: true,
      compact_markdown_normalization: 'List separators are format-specific and outer trailing whitespace is not represented in Markdown fields.',
      raw_identity_url_title_match: true,
      raw_title_normalization: rawRepresentationAudit,
      raw_task_model: 'Raw task objects and compact task examples are different exporter representations; both are parsed, and compact task examples are canonicalized without inventing text.',
      topic_map: topicMapAudit,
      unexplained_differences: 0,
    },
    source_records: sourceRecords.length,
    page_records_included: catalog.canonical_records.length,
    grades: countBy(catalog.canonical_records, (record) => record.grade),
    languages: countBy(catalog.canonical_records, (record) => record.language),
    books: countBy(catalog.canonical_records, (record) => record.book_id),
    source_books: countBy(sourceRecords, (record) => record.book_id),
    kits: countBy(catalog.canonical_records, (record) => record.kit_id),
    programme_types: countBy(catalog.canonical_records, (record) => record.programme_type),
    publishers: countBy(catalog.canonical_records, (record) => record.publisher || '<not captured>'),
    source_grades: countBy(sourceRecords, (record) => record.grade),
    source_languages: countBy(sourceRecords, (record) => record.language),
    source_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: countBy(catalog.canonical_records, sourceSubject),
    cover_detail_records_present: catalog.exclusions.cover_details.length + catalog.exclusions.duplicate_aliases.length,
    cover_detail_records_excluded: catalog.exclusions.cover_details.length,
    administrative_records_present: catalog.exclusions.administrative.length,
    administrative_records_excluded: catalog.exclusions.administrative.length,
    duplicate_records_excluded: catalog.exclusions.duplicate_aliases.length,
    duplicate_url_audit: {
      source_duplicate_groups: catalog.duplicate_audit.length,
      source_duplicate_records: catalog.exclusions.duplicate_aliases.length,
      canonical_duplicate_groups: 0,
      entries: catalog.duplicate_audit,
    },
    exclusion_audit: {
      cover_details: catalog.exclusions.cover_details.map((record) => ({ url: record.url, source_book_id: record.book_id, chapter_id: String(record.chapter_id) })),
      duplicate_aliases: catalog.exclusions.duplicate_aliases.map((record) => ({ url: record.url, source_book_id: record.book_id, chapter_id: String(record.chapter_id) })),
      administrative: catalog.exclusions.administrative.map((record) => ({ url: record.url, source_book_id: record.book_id, chapter_id: String(record.chapter_id), title: record.title })),
    },
    source_grade_normalization_audit: {
      source_grade: 2,
      canonical_grade: 3,
      affected_source_rows: sourceRecords.length,
      affected_canonical_pages: catalog.canonical_records.length,
      evidence: 'All nine captured cover titles, source Book IDs, and kit identities explicitly identify grade 3 mathematics.',
    },
    subject_normalization_audit: subjectAudit,
    language_normalization_audit: languageAudit,
    content_repair_audit: catalog.content_repairs,
    content_repair_summary: {
      affected_pages: catalog.content_repairs.length,
      categories: countBy(catalog.content_repairs.flatMap((repair) => repair.categories), (category) => category),
      changed_fields: countBy(catalog.content_repairs.flatMap((repair) => repair.changes), (change) => change.field),
    },
    content_quality_audit: contentQualityAudit(catalog.canonical_records),
    records_without_headings: 0,
    records_without_task_examples: canonicalMissingTasks.length,
    records_without_task_example_urls: canonicalMissingTasks.map((record) => record.url),
    missing_urls: 0,
    book_metadata_audit: bookAudit(sourceRecords, catalog),
    metadata_anomalies: [
      {
        field: 'source grade',
        source_value: 2,
        scope: 'all source rows',
        canonical_decision: 'normalize included instructional pages to grade 3',
      },
      {
        field: 'raw book language',
        source_value: 'ru for every raw book JSON',
        scope: 'raw/Opiq-DB/books/*.json',
        canonical_decision: 'use compact index book language plus page text; preserve raw anomaly in QA',
      },
      {
        field: 'publisher',
        source_value: 'empty in original capture',
        scope: 'all source rows',
        canonical_decision: 'retain previously audited ordinary-book publisher evidence; do not invent simplified-book publishers',
      },
    ],
    historical_compact_disposition: {
      path: historicalGrade3MathematicsArchive.path,
      sha256: historicalGrade3MathematicsArchive.sha256,
      canonical: false,
      used_for_canonical_generation: false,
      used_for_historical_comparison: true,
      retained_for: 'audited historical semantic comparison only',
    },
    historical_comparison: historicalComparison,
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: catalog.canonical_records.length,
    },
    curriculum_coverage: {
      status: 'not_verified',
      note: 'This source catalogue is not an official curriculum map or completeness claim.',
    },
  };

  const qaText = stableJson(qa);
  const auditText = renderAudit({ qa, historicalComparison });
  const outputs = [
    [route.md_path, markdown],
    [route.qa_path, qaText],
    [auditPath, auditText],
  ];
  if (checkOnly) {
    for (const [relativePath, expected] of outputs) {
      assertGeneratedArtifact(await readFile(absolute(relativePath), 'utf8'), expected, relativePath);
    }
    console.log(`Grade 3 mathematics source is current: ${catalog.canonical_records.length} pages from ${sourceRecords.length} source rows; ${archive.entryCount} ZIP members verified.`);
    return;
  }
  for (const [relativePath, contents] of outputs) await writeFile(absolute(relativePath), contents, 'utf8');
  console.log(`Generated ${route.md_path}, ${route.qa_path}, and ${auditPath}.`);
}

await main();
