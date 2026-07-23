#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  containsUnprocessedPayload,
  mixedScriptWords,
  normalizeQualityText,
} from './lib/grade-2-content-quality.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3,
  assertGrade3MusicArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  auditZipMemberNames,
  buildGrade3MusicCatalog,
  compareGrade3MusicEditions,
  compareGrade3MusicLanguageEditions,
  countBy,
  grade3MusicArchive,
  grade3MusicSubject,
  grade3MusicVariants,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3MusicMarkdown,
  requiredGrade3MusicMembers,
  sha256Bytes,
  sourceSubject,
  validateManifestGrade3MusicSource,
  validateRawGrade3MusicChapters,
} from './lib/grade-3-music.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-music';
const generatorPath = 'scripts/generate-grade-3-music-sources.mjs';
const generatorVersion = '1.0';
const auditPath = 'docs/audits/grade-3-music-source-import.md';
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

function validateIndex(index, rawIndex, sourceRecords, archive) {
  assertGrade3(index?.formatVersion === grade3MusicArchive.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3(index.generatedAt === grade3MusicArchive.capture_timestamp, 'index.json capture timestamp changed.');
  assertGrade3(index.source === 'opiq-helper-extension', 'index.json source is not opiq-helper-extension.');
  assertGrade3(index.recordCount === sourceRecords.length, 'index.json recordCount differs from JSONL.');
  assertGrade3(
    JSON.stringify(index.supportedQueryLanguages) === JSON.stringify(['et', 'ru', 'en']),
    'index.json query languages changed.',
  );
  assertGrade3(
    JSON.stringify(index.compactFiles) === JSON.stringify(['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json']),
    'index.json compactFiles changed.',
  );
  assertGrade3(index.rawArchiveIncluded === true, 'index.json must declare the raw archive.');
  assertGrade3(rawIndex.generatedAt === index.generatedAt, 'Raw and compact capture timestamps differ.');
  assertGrade3(JSON.stringify(rawIndex.books) === JSON.stringify(index.books), 'Raw and compact book inventories differ.');
  assertGrade3(index.books.length === 4, `index.json has ${index.books.length} books; expected 4.`);

  const bookMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/'));
  assertGrade3(bookMembers.length === 4, `Archive has ${bookMembers.length} raw book members; expected 4.`);
  const rawBooks = new Map(bookMembers.map((member) => {
    const rawBook = parseJson(readZipText(archive, member), member);
    return [rawBook.id, { member, rawBook }];
  }));
  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  const createdAt = {};
  const rawBookLanguages = {};
  for (const book of index.books) {
    const variant = grade3MusicVariants[book.id];
    assertGrade3(variant, `index.json contains unknown Source Book ID ${book.id}.`);
    assertGrade3(book.title === variant.raw_title, `${book.id} Kit Details title changed.`);
    assertGrade3(book.publisher === '', `${book.id} unexpectedly contains publisher metadata.`);
    assertGrade3(book.grade === 3, `${book.id} captured grade differs.`);
    assertGrade3(book.language === variant.language, `${book.id} captured language differs.`);
    assertGrade3(book.subject === '', `${book.id} raw per-book subject is no longer empty.`);
    assertGrade3(book.chapterCount === variant.source_rows, `${book.id} chapterCount differs.`);
    assertGrade3(sourceCounts[book.id] === variant.source_rows, `${book.id} JSONL row count differs.`);
    const rawEntry = rawBooks.get(book.id);
    assertGrade3(rawEntry, `Raw book record is missing for ${book.id}.`);
    const { rawBook } = rawEntry;
    assertGrade3(
      rawBook.id === book.id
        && rawBook.title === book.title
        && rawBook.grade === book.grade
        && rawBook.language === 'ru'
        && rawBook.subject === ''
        && rawBook.publisher === '',
      `Raw book metadata differs for ${book.id}.`,
    );
    assertGrade3(
      typeof rawBook.createdAt === 'string' && !Number.isNaN(Date.parse(rawBook.createdAt)),
      `${book.id} raw book createdAt is invalid.`,
    );
    createdAt[book.id] = rawBook.createdAt;
    rawBookLanguages[book.id] = rawBook.language;
  }
  assertGrade3(rawBooks.size === 4, 'Raw book records are not fully represented in index.json.');
  return {
    books: index.books,
    raw_book_members: bookMembers.length,
    raw_book_created_at: createdAt,
    raw_book_languages: rawBookLanguages,
  };
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const rowsByUrl = new Map();
  for (const record of sourceRecords) {
    rowsByUrl.set(record.url, [...(rowsByUrl.get(record.url) ?? []), record]);
  }
  let references = 0;
  for (const [topic, entries] of Object.entries(topicMap)) {
    assertGrade3(topic.trim() && Array.isArray(entries), `topic_map.json topic ${topic || '<empty>'} is invalid.`);
    for (const entry of entries) {
      references += 1;
      const candidates = rowsByUrl.get(entry.url) ?? [];
      assertGrade3(
        candidates.some((record) => (
          record.title === entry.title
          && record.language === entry.language
          && record.grade === entry.grade
          && record.subject_en === entry.subject
        )),
        `topic_map.json references an unknown or changed record ${entry.url}.`,
      );
    }
  }
  assertGrade3(Object.keys(topicMap).length === 803, 'topic_map.json topic count changed.');
  assertGrade3(references === 1415, 'topic_map.json reference count changed.');
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function assertTextQuality(sourceRecords, rawByIdentity) {
  const compactText = sourceRecords.flatMap((record) => [
    record.title,
    record.book,
    record.publisher,
    ...record.topics_et,
    ...record.topics_ru,
    ...record.topics_en,
    ...record.headings,
    ...record.task_examples,
  ]).join('\n');
  const rawText = [...rawByIdentity.values()].flatMap(({ raw }) => [
    raw.chapterTitle,
    ...raw.headings.map((heading) => heading.text),
    ...raw.tasks.map((task) => task.text),
  ]).join('\n');
  for (const [label, text] of [['compact source', compactText], ['raw source', rawText]]) {
    assertGrade3(!text.includes('\ufffd'), `${label} contains the Unicode replacement character.`);
    assertGrade3(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text), `${label} contains a forbidden control.`);
    assertGrade3(!/[\u00ad\u200b-\u200d\u2060\ufeff]/u.test(text), `${label} contains an invisible or discretionary control.`);
    assertGrade3(!containsUnprocessedPayload(text), `${label} contains an unprocessed JSON/HTML/MathML payload.`);
  }
  return {
    compact_replacement_characters: 0,
    raw_replacement_characters: 0,
    forbidden_controls: 0,
    invisible_controls: 0,
    html_mathml_or_json_payloads: 0,
  };
}

function contentQualityAudit(records, sourceRecords) {
  const titleGroups = new Map();
  records.forEach((record) => {
    const key = normalizeQualityText(record.title).toLocaleLowerCase();
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), record]);
  });
  const repeatedTitles = [...titleGroups.entries()].filter(([, group]) => group.length > 1)
    .map(([title, group]) => ({
      title,
      count: group.length,
      urls: group.map((record) => record.url),
      kits: [...new Set(group.map((record) => record.kit_id))],
      disposition: 'Retain: URLs differ and kit or chapter context remains distinct; title equality is not page duplication.',
    }));
  const repeatedRecordCount = repeatedTitles.reduce((total, group) => total + group.count, 0);
  assertGrade3(repeatedTitles.length === 52, `Repeated-title group count is ${repeatedTitles.length}; expected 52.`);
  assertGrade3(repeatedRecordCount === 108, `Repeated-title record count is ${repeatedRecordCount}; expected 108.`);

  const missingTasks = records.filter((record) => record.task_examples.length === 0);
  const missingByKit = countBy(missingTasks, (record) => record.kit_id);
  assertGrade3(
    JSON.stringify(missingByKit) === JSON.stringify({ 163: 9, 195: 52, 239: 59, 592: 9 }),
    `Canonical missing-task counts changed: ${JSON.stringify(missingByKit)}`,
  );
  const compactInstructional = sourceRecords.filter(
    (record) => !/\/Kit\/Details\//u.test(record.url)
      && !['https://www.opiq.ee/kit/163/chapter/19490', 'https://www.opiq.ee/kit/592/chapter/33434'].includes(record.url),
  );
  const compactMissingByKit = countBy(
    compactInstructional.filter((record) => record.task_examples.length === 0),
    (record) => record.url.match(/\/kit\/(\d+)/iu)[1],
  );
  assertGrade3(
    JSON.stringify(compactMissingByKit) === JSON.stringify({ 163: 9, 195: 54, 239: 62, 592: 9 }),
    `Compact missing-task counts changed: ${JSON.stringify(compactMissingByKit)}`,
  );

  const shortRecords = records.filter((record) => [
    record.title,
    ...record.headings,
    ...record.task_examples,
  ].join(' ').length < 80).map((record) => ({
    url: record.url,
    title: record.title,
    kit_id: record.kit_id,
    disposition: 'Short but structurally valid music or song entry; no prose is invented.',
  }));
  const mixed = records.flatMap((record) => {
    const words = mixedScriptWords([record.title, record.headings, record.task_examples]);
    return words.length ? [{
      url: record.url,
      title: record.title,
      words,
      disposition: 'Retain source typography: multilingual song names in the Russian music edition are not language-routing errors.',
    }] : [];
  });
  assertGrade3(mixed.length === 3, `Mixed-script observation count is ${mixed.length}; expected 3.`);
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
      invisible_controls: 0,
      unprocessed_payloads: 0,
      broken_markdown_records: 0,
    },
    classified_warnings: {
      compact_missing_task_examples: {
        by_kit: compactMissingByKit,
        actual_total: compactInstructional.filter((record) => record.task_examples.length === 0).length,
        supplied_expected_total: 136,
        arithmetic_note: 'The supplied per-kit values 54 + 9 + 9 + 62 total 134, not 136.',
      },
      canonical_missing_task_examples: {
        by_kit: missingByKit,
        total: missingTasks.length,
        urls: missingTasks.map((record) => record.url),
        disposition: 'Capture limitation; absence of a structured task example is not proof that the page has no activity.',
      },
      repeated_title_groups: repeatedTitles,
      repeated_title_group_count: repeatedTitles.length,
      repeated_title_record_count: repeatedRecordCount,
      unusually_short_records: shortRecords,
      mixed_script_observations: mixed,
    },
  };
}

async function assertCrossRouteOwnership(manifest, route, canonicalRecords) {
  const urls = new Set(canonicalRecords.map((record) => record.url));
  const overlaps = [];
  let checkedRoutes = 0;
  for (const other of manifest.sources.filter((source) => source.id !== route.id)) {
    const markdown = await readFile(absolute(other.md_path), 'utf8');
    const otherUrls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)]
      .map((match) => match[1]);
    otherUrls.filter((url) => urls.has(url)).forEach((url) => {
      overlaps.push({ source_id: other.id, url });
    });
    checkedRoutes += 1;
  }
  assertGrade3(
    overlaps.length === 0,
    `Grade-3 music URLs overlap another route: ${overlaps.slice(0, 3).map((entry) => `${entry.source_id} ${entry.url}`).join(', ')}`,
  );
  return { checked_routes: checkedRoutes, overlap_count: 0 };
}

function renderAudit(qa) {
  const books = Object.entries(qa.book_metadata_audit);
  const warnings = qa.content_quality_audit.classified_warnings;
  return `# Grade 3 music source import audit

## Result

The original archive is registered as the dedicated canonical \`grade-3-music\` route. It contains **${qa.source_records} source rows** and **${qa.page_records_included} instructional pages** across three Estonian and one Russian ordinary-curriculum book/kit variants.

- archive: \`${qa.source_archive}\`
- SHA-256: \`${qa.checksums.source_archive_sha256}\`
- size: ${qa.archive.byte_size} bytes
- ZIP members: ${qa.archive.member_count}; all use stored compression and pass CRC/size checks
- capture: ${qa.generation.generated_at}
- languages: ${qa.languages.et} Estonian and ${qa.languages.ru} Russian instructional pages
- publisher: absent for all four variants; not invented

This is a source catalogue, not a verified curriculum map and not proof of the complete current live Opiq catalogue.

## Complete source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional chapters | ${qa.page_records_included} |
| Unique Kit Details | ${qa.cover_detail_records_excluded} |
| Duplicate Kit Details aliases | ${qa.duplicate_records_excluded} |
| Impressum | ${qa.administrative_records_excluded} |
| Total | ${qa.source_records} |

All four exact duplicate URL groups are Kit Details pairs. Each pair has identical title, URL, book, Source Book ID, grade, subject, language, headings, and tasks; only its synthetic chapter ID differs. Both the first detail row and its repeated alias are excluded. The two explicit Impressum URLs are also excluded.

## Books and kits

| Kit | Canonical Book ID | Source Book ID | Canonical title | Language | Pages |
| ---: | --- | --- | --- | --- | ---: |
${books.map(([bookId, book]) => `| ${book.kit_id} | \`${bookId}\` | \`${book.source_book_id}\` | ${book.canonical_title} | ${book.canonical_language} | ${book.canonical_instructional_pages} |`).join('\n')}

All four raw book records, all 315 compact rows, every raw chapter, and every topic-map reference are accounted for. Book identity is \`Source Book ID + kit\`; editions and language versions are not collapsed.

## Subject, grade, and language

Every source row is automatically labelled \`mathematics / matemaatika / математика\`, while raw book subjects are empty. Source Book IDs, Kit Details titles, grade-3 titles, music chapter sequences, song names, notation, rhythm, melody, singing headings, and pupil music tasks jointly prove the music classification. Canonical pages therefore use \`${grade3MusicSubject.en} / ${grade3MusicSubject.et} / ${grade3MusicSubject.ru}\`, and generated mathematics topic aliases are removed.

All raw records and all four books report grade 3. The three Estonian raw book objects carry an erroneous \`ru\` language value, while \`index.json\` and all 183 page rows for those books consistently report \`et\`. Canonical language therefore follows the compact book inventory and unanimous page-level evidence: Estonian for kits 195, 163, and 592; Russian for kit 239. The raw-book anomaly remains explicit in QA. Multilingual song titles inside a book do not change its page-language route.

## ZIP filename encoding

All ${qa.archive.member_count} members omit the ZIP UTF-8 filename flag. ${qa.filename_encoding_audit.non_ascii_recoveries} non-ASCII paths contain valid UTF-8 bytes that standard CP437 display renders as mojibake. The generator:

1. preserves the exact stored bytes and CP437 display in QA;
2. re-encodes the CP437 display byte-for-byte;
3. decodes those bytes as strict UTF-8;
4. requires exactly one captured Source Book ID match;
5. verifies both round trips and rejects logical-name collisions.

The ZIP is never rewritten or recompressed.

## Raw task recovery and content quality

The raw archive provides richer structured task evidence on **${qa.content_repair_summary.affected_pages} pages**: ${qa.source_representation_audit.raw_chapters.task_relationships.richer_raw_task_evidence} raw supersets, ${qa.source_representation_audit.raw_chapters.task_relationships.raw_task_recovered} compact-missing task arrays, and ${qa.source_representation_audit.raw_chapters.task_relationships.truncated_compact_task_recovered} demonstrably truncated compact task. Every repair is linked to the same raw chapter member and recorded with source/canonical hashes. No task, song title, exercise, translation, or educational prose is invented.

The supplied missing-task expectation contains an arithmetic inconsistency: 54 + 9 + 9 + 62 equals **${warnings.compact_missing_task_examples.actual_total}**, not 136. After the 40 raw-supported repairs, **${warnings.canonical_missing_task_examples.total}** canonical pages remain without structured task examples:

| Kit | Remaining pages without structured task examples |
| ---: | ---: |
${Object.entries(warnings.canonical_missing_task_examples.by_kit).map(([kit, count]) => `| ${kit} | ${count} |`).join('\n')}

That is a capture limitation, not proof that a page has no activity. Post-repair hard errors: **0**. The audit also classifies ${warnings.repeated_title_group_count} repeated-title groups covering ${warnings.repeated_title_record_count} distinct URLs, ${warnings.unusually_short_records.length} short but structurally valid compact records, and ${warnings.mixed_script_observations.length} source-typography observations.

## Edition boundaries

Kits 163 and 592 each contain 31 corresponding chapter IDs. Thirty pages are compact-equivalent; chapter \`1.15\` differs because kit 163 includes the heading \`Muusika piltides\` and kit 592 does not. They remain distinct editions.

Kits 195 and 239 share ${qa.language_edition_comparison.shared_title_count} normalized song titles but have different kits, URLs, book identities, languages, and instructional contexts. They remain distinct language editions. No page is removed by title or content hash; only canonical URL duplication can trigger duplicate review.

## Routing and recapture

No canonical URL overlaps any other manifest route, including grade-2 music, grade-3 mathematics, grade-3 Russian, and grade-3 Russian reading. There is currently no grade-3 Estonian-language route to absorb the three Estonian-language music books; language of a source does not change its subject.

No additional Opiq capture is required for canonical routing. A future **targeted task-body capture** may be useful only for selected pages when exact exercises are required for lesson authoring. The missing structured tasks do not justify a full recapture.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const route = manifest.sources.find((source) => source.id === sourceId);
  validateManifestGrade3MusicSource(route);

  const archiveBytes = await readFile(absolute(route.source_archive));
  assertGrade3MusicArchiveIdentity(archiveBytes);
  assertGrade3((await stat(absolute(route.source_archive))).isFile(), 'Original source archive is not a file.');
  const archive = await readCompactZip(absolute(route.source_archive));
  assertGrade3(
    archive.entryCount === grade3MusicArchive.member_count,
    `Original archive has ${archive.entryCount} members; expected ${grade3MusicArchive.member_count}.`,
  );
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());
  assertGrade3(
    [...archive.memberMetadata.values()].every((entry) => entry.compression_method === 0),
    'Original archive contains a changed compression method.',
  );
  const filenameAudit = auditZipMemberNames(archive.memberMetadata);

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  const compactMarkdown = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
  assertCompactMarkdownMatches(sourceRecords, compactMarkdown);
  const indexAudit = validateIndex(index, rawIndex, sourceRecords, archive);
  const rawAudit = validateRawGrade3MusicChapters(sourceRecords, archive, readZipText);
  const representationQuality = assertTextQuality(sourceRecords, rawAudit.raw_by_identity);
  const topicMapAudit = validateTopicMap(
    parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'),
    sourceRecords,
  );
  const catalog = buildGrade3MusicCatalog(sourceRecords, rawAudit.raw_by_identity);
  const markdown = renderGrade3MusicMarkdown(catalog);
  const crossRouteAudit = await assertCrossRouteOwnership(manifest, route, catalog.canonical_records);
  const quality = contentQualityAudit(catalog.canonical_records, sourceRecords);
  const editionComparison = compareGrade3MusicEditions(catalog.canonical_records);
  const languageEditionComparison = compareGrade3MusicLanguageEditions(catalog.canonical_records);

  const bookMetadataAudit = Object.fromEntries(
    Object.values(grade3MusicVariants).map((variant) => {
      const sourceRows = sourceRecords.filter((record) => record.book_id === variant.source_book_id);
      return [variant.canonical_book_id, {
        source_book_id: variant.source_book_id,
        kit_id: variant.kit_id,
        raw_title: variant.raw_title,
        canonical_title: variant.canonical_title,
        title_normalization: 'Remove only the captured display suffix “ – Opiq”.',
        publisher: null,
        publisher_provenance: variant.publisher_provenance,
        raw_grade: 3,
        canonical_grade: 3,
        raw_language: variant.language,
        canonical_language: variant.language,
        raw_subject: 'mathematics / matemaatika / математика',
        canonical_subject: `${grade3MusicSubject.en} / ${grade3MusicSubject.et} / ${grade3MusicSubject.ru}`,
        programme_type: variant.programme_type,
        source_rows: sourceRows.length,
        canonical_instructional_pages: variant.canonical_records,
        details_excluded: variant.details,
        administrative_records_excluded: variant.administrative,
      }];
    }),
  );

  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: route.source_archive,
    output_file: route.md_path,
    format_version: route.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3MusicArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the committed original Opiq export.',
    },
    checksums: {
      source_archive_sha256: grade3MusicArchive.sha256,
      output_file_sha256: sha256Bytes(Buffer.from(markdown)),
    },
    archive: {
      byte_size: archiveBytes.length,
      member_count: archive.entryCount,
      compression_methods: countBy([...archive.memberMetadata.values()], (entry) => entry.compression_method),
      declared_uncompressed_bytes: [...archive.memberMetadata.values()]
        .reduce((total, entry) => total + entry.uncompressed_size, 0),
      verified_uncompressed_bytes: [...archive.entries.values()]
        .reduce((total, entry) => total + entry.length, 0),
      required_members: [...requiredGrade3MusicMembers],
      unsafe_member_paths: 0,
      duplicate_member_names: 0,
      crc_verified_members: archive.entryCount,
      raw_book_members: indexAudit.raw_book_members,
      raw_chapter_members: rawAudit.audit.raw_chapter_records,
    },
    filename_encoding_audit: filenameAudit,
    source_representation_audit: {
      compact_jsonl_records: sourceRecords.length,
      compact_markdown_records: compactMarkdown.length,
      compact_jsonl_markdown_field_equivalent: true,
      raw_index_matches_compact_index: true,
      raw_chapters: rawAudit.audit,
      topic_map: topicMapAudit,
      text_quality: representationQuality,
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
    search_records_excluded: 0,
    malformed_records_excluded: 0,
    unrelated_records_excluded: 0,
    wrong_grade_records_excluded: 0,
    wrong_subject_records_excluded: 0,
    source_accounting: {
      canonical_instructional_chapters: catalog.canonical_records.length,
      unique_kit_details: catalog.exclusions.cover_details.length,
      duplicate_kit_details_aliases: catalog.exclusions.duplicate_aliases.length,
      impressum: catalog.exclusions.administrative.length,
      total: sourceRecords.length,
      unexplained_rows: 0,
    },
    duplicate_url_audit: {
      source_duplicate_groups: catalog.duplicate_audit.length,
      canonical_duplicate_groups: 0,
      entries: catalog.duplicate_audit,
    },
    exclusion_audit: {
      cover_details: catalog.exclusions.cover_details.map((record) => ({
        url: record.url,
        source_book_id: record.book_id,
        chapter_id: String(record.chapter_id),
      })),
      duplicate_aliases: catalog.exclusions.duplicate_aliases.map((record) => ({
        url: record.url,
        source_book_id: record.book_id,
        chapter_id: String(record.chapter_id),
      })),
      administrative: catalog.exclusions.administrative.map((record) => ({
        url: record.url,
        source_book_id: record.book_id,
        chapter_id: String(record.chapter_id),
        title: record.title,
      })),
    },
    grade_audit: {
      source_grade_counts: countBy(sourceRecords, (record) => record.grade),
      canonical_grade_counts: countBy(catalog.canonical_records, (record) => record.grade),
      normalization_required: false,
      evidence: 'All book titles, Source Book IDs, Kit Details, raw book metadata, and source rows identify grade 3.',
    },
    language_audit: {
      source_language_counts: countBy(sourceRecords, (record) => record.language),
      canonical_language_counts: countBy(catalog.canonical_records, (record) => record.language),
      normalization_required: false,
      mixed_language_page_observations: quality.classified_warnings.mixed_script_observations,
      decision: 'Preserve the audited book language; multilingual song titles do not change route ownership.',
    },
    subject_normalization_audit: {
      source_subject: 'mathematics / matemaatika / математика',
      canonical_subject: `${grade3MusicSubject.en} / ${grade3MusicSubject.et} / ${grade3MusicSubject.ru}`,
      affected_source_rows: sourceRecords.length,
      affected_canonical_pages: catalog.canonical_records.length,
      evidence: 'Four music Source Book IDs, four Kit Details titles, complete chapter sequences, songs, notation, rhythm, melody, singing headings, and pupil music tasks.',
      generated_mathematics_aliases_remaining: 0,
    },
    book_metadata_audit: bookMetadataAudit,
    raw_book_created_at: indexAudit.raw_book_created_at,
    raw_book_language_audit: {
      values: indexAudit.raw_book_languages,
      anomalous_estonian_books_marked_ru: 3,
      canonical_decision: 'Use compact index and unanimous page-level language values; preserve the raw-book anomaly in QA.',
    },
    metadata_normalization_audit: catalog.canonical_records.map((record) => ({
      url: record.url,
      raw: {
        book_id: record.source_book_id,
        grade: 3,
        subject: 'mathematics / matemaatika / математика',
        language: record.language,
        publisher: '',
      },
      canonical: {
        book: record.book,
        book_id: record.book_id,
        source_book_id: record.source_book_id,
        kit_id: record.kit_id,
        grade: record.grade,
        subject: sourceSubject(record),
        language: record.language,
        publisher: record.publisher,
        programme_type: record.programme_type,
      },
      decision_categories: [
        'source_book_plus_kit_identity',
        'kit_details_book_title',
        'automatic_subject_correction',
      ],
    })),
    content_repair_audit: catalog.task_repairs,
    content_repair_summary: {
      affected_pages: catalog.task_repairs.length,
      categories: countBy(catalog.task_repairs, (repair) => repair.category),
      changed_fields: { task_examples: catalog.task_repairs.length },
      invented_tasks: 0,
    },
    content_quality_audit: quality,
    records_without_headings: 0,
    records_without_task_examples: quality.classified_warnings.canonical_missing_task_examples.total,
    edition_comparison: {
      kit_163_vs_kit_592: editionComparison,
    },
    language_edition_comparison: languageEditionComparison,
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: catalog.canonical_records.length,
      cross_route: crossRouteAudit,
      final_owner: sourceId,
    },
    existing_route_comparison: {
      repository_url_matches_before_import: 0,
      migrated_records: 0,
      grade_2_music_reused_as_content: false,
      decision: 'new_dedicated_route',
    },
    known_limitations: [
      'The exporter assigns mathematics to every source row while raw per-book subject values are empty; music classification relies on stable source, kit, title, chapter, notation, rhythm, singing, and task evidence.',
      'Publisher metadata is absent and is not invented.',
      'One hundred twenty-nine canonical pages lack structured task examples after forty raw-supported repairs; exact task bodies are not guessed.',
      'The route is a source catalogue, not an official curriculum map or proof of current live Opiq completeness.',
    ],
    recapture_assessment: {
      required_for_canonical_routing: false,
      full_recapture_justified: false,
      optional_targeted_capture: 'Capture task bodies only for selected pages if exact exercises are later needed for lesson authoring.',
    },
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
    console.log(
      `Grade 3 music source is current: ${catalog.canonical_records.length} pages from ${sourceRecords.length} source rows; ${qa.records_without_task_examples} without structured tasks; zero cross-route overlap.`,
    );
    return;
  }
  for (const [relativePath, contents] of outputs) {
    await writeFile(absolute(relativePath), contents, 'utf8');
  }
  console.log(`Generated ${route.md_path}, ${route.qa_path}, and ${auditPath}.`);
}

await main();
