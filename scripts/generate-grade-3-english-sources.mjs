#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertArchiveIdentity,
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3,
  assertRequiredMembers,
  assertSafeMemberName,
  auditCanonicalContentQuality,
  auditZipMemberNames,
  buildCatalog,
  countBy,
  grade3EnglishArchive,
  grade3EnglishSubject,
  grade3EnglishVariants,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderMarkdown,
  sha256Bytes,
  sourceSubject,
  validateManifestSource,
  validateRawChapters,
} from './lib/grade-3-english.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-english';
const generatorPath = 'scripts/generate-grade-3-english-sources.mjs';
const auditPath = 'docs/audits/grade-3-english-source-import.md';
const checkOnly = process.argv.includes('--check');

function absolute(relativePath) {
  return path.join(repositoryRoot, relativePath);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function validateIndex(index, rawIndex) {
  for (const [label, value] of [['index.json', index], ['raw/Opiq-DB/index.json', rawIndex]]) {
    assertGrade3(value && typeof value === 'object' && !Array.isArray(value), `${label} root must be an object.`);
    assertGrade3(value.generatedAt === grade3EnglishArchive.capture_timestamp, `${label} timestamp differs.`);
    assertGrade3(Array.isArray(value.books) && value.books.length === 2, `${label} must contain two books.`);
  }
  assertGrade3(index.recordCount === 197, 'index.json record count differs.');
  assertGrade3(index.rawArchiveIncluded === true, 'index.json must declare raw archive evidence.');
  assertGrade3(index.formatVersion === '2.0', 'index.json format version differs.');
  assertGrade3(JSON.stringify(index.books) === JSON.stringify(rawIndex.books), 'Compact and raw book indexes differ.');
  for (const variant of Object.values(grade3EnglishVariants)) {
    const book = index.books.find((entry) => entry.id === variant.source_book_id);
    assertGrade3(book, `Index is missing ${variant.source_book_id}.`);
    assertGrade3(
      book.title === variant.raw_title
        && book.publisher === ''
        && book.grade === 3
        && book.language === variant.index_language
        && book.subject === ''
        && book.chapterCount === variant.source_rows,
      `Index metadata differs for ${variant.source_book_id}.`,
    );
  }
}

function validateRawBooks(archive) {
  return Object.values(grade3EnglishVariants).map((variant) => {
    const member = `raw/Opiq-DB/books/${variant.source_book_id}.json`;
    const raw = parseJson(readZipText(archive, member), member);
    assertGrade3(
      raw.id === variant.source_book_id
        && raw.title === variant.raw_title
        && raw.grade === 3
        && raw.language === 'ru'
        && raw.publisher === ''
        && raw.subject === '',
      `${member} metadata differs from captured evidence.`,
    );
    return {
      source_book_id: variant.source_book_id,
      canonical_book_id: variant.canonical_book_id,
      kit_id: variant.kit_id,
      captured_title: variant.raw_title,
      canonical_title: variant.canonical_title,
      index_language: variant.index_language,
      raw_book_language: variant.raw_book_language,
      canonical_page_languages: variant.kit_id === '452'
        ? { en: 79, et: 10 }
        : { en: 43, et: 57, ru: 4 },
      publisher: '',
      programme_type: 'unknown',
      source_rows: variant.source_rows,
      instructional_pages: variant.instructional_pages,
    };
  });
}

function validateTopicMap(topicMap, sourceRecords) {
  assertGrade3(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const text = JSON.stringify(topicMap);
  sourceRecords.forEach((record) => {
    assertGrade3(
      text.includes(record.url) || record.topics_et.every((topic) => text.includes(topic)),
      `topic_map.json cannot be reconciled with ${record.url}.`,
    );
  });
}

async function crossRouteAudit(manifest, canonicalRecords) {
  const canonicalUrls = new Set(canonicalRecords.map((record) => record.url));
  const overlaps = [];
  let checkedRoutes = 0;
  for (const source of manifest.sources) {
    if (source.id === sourceId) continue;
    checkedRoutes += 1;
    const markdown = await readFile(absolute(source.md_path), 'utf8');
    const urls = new Set(
      [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)].map((match) => match[1]),
    );
    const shared = [...canonicalUrls].filter((url) => urls.has(url));
    if (shared.length > 0) overlaps.push({ source_id: source.id, urls: shared });
  }
  assertGrade3(overlaps.length === 0, `English URLs overlap other canonical routes: ${JSON.stringify(overlaps)}.`);
  return { checked_routes: checkedRoutes, overlap_count: 0, overlaps: [] };
}

function renderAudit(qa) {
  const duplicateRows = qa.duplicate_url_audit.map(
    (entry) => `| ${entry.kit_id} | [${entry.url}](${entry.url}) | ${entry.chapter_ids.join(', ')} | Exclude both cover/detail records |`,
  ).join('\n');
  const repeatedRows = qa.repeated_title_groups.entries.map(
    (entry) => `- \`${entry.title}\`: ${entry.urls.map((url) => `[${url}](${url})`).join(', ')}.`,
  ).join('\n');
  return `# Grade 3 English source import audit

## Result

The supplied archive contains **197** source rows for two grade-3 English books. Four repeated Kit Details rows are excluded, leaving **193 unique direct instructional URLs**: 89 pages from kit 452 and 104 pages from kit 369.

This is a complete audit of the supplied capture, not proof of official-curriculum completeness or current live Opiq catalogue completeness.

## Immutable archive

| SHA-256 | Bytes | Uncompressed bytes | ZIP members | Capture |
| --- | ---: | ---: | ---: | --- |
| \`${qa.archive.sha256}\` | ${qa.archive.byte_size} | ${qa.archive.uncompressed_size} | ${qa.archive.member_count} | ${qa.archive.capture_timestamp} |

All members pass central-directory, local/central filename, declared-size, CRC-32, safe-relative-path, unique-name, and stored-compression validation. All 204 stored filenames are ASCII, omit the UTF-8 flag, and require no recovery. The archive is committed byte-for-byte unchanged.

## Source accounting and books

| Kit | Source Book ID | Canonical Book ID | Canonical title | Source rows | Pages |
| ---: | --- | --- | --- | ---: | ---: |
| 452 | \`english_step_by_step_1\` | \`english_step_by_step_1__kit452\` | English step by step 1 | 91 | 89 |
| 369 | \`inglise_keel_3._klassile\` | \`inglise_keel_3._klassile__kit369\` | High Five! 3 | 106 | 104 |
| **Total** |  |  |  | **197** | **193** |

The captured \` – Opiq\` UI suffix is removed only from canonical book titles. Source Book IDs, page titles, visible heading text, URLs, and source order remain unchanged. One zero-width space before \`[t] and [d]\` on [kit 369 chapter 20964](https://www.opiq.ee/kit/369/chapter/20964) is removed as a documented technical control-character repair; the visible educational text is unchanged. Publishers are empty in index, raw-book, and compact records, so none are invented. Programme type cannot be proven from the supplied archive and remains explicitly \`unknown\`.

## Excluded duplicate details

| Kit | URL | Synthetic chapter IDs | Decision |
| ---: | --- | --- | --- |
${duplicateRows}

Both duplicate groups are restricted to Kit Details and differ only in synthetic chapter ID. No instructional page is title-deduplicated.

## Metadata normalization

All 197 compact rows carry the generated subject \`mathematics / matemaatika / математика\`. Source identities, English book titles, kits 369/452, chapter headings, and page contents prove that this is an English capture. The canonical subject is normalized to \`english / inglise keel / английский язык\`; generated mathematics topic aliases are removed.

Both raw book objects say \`ru\`, while index and page-level evidence identify a multilingual English-learning source. The route preserves every page-level language value: **122 en, 67 et, and 4 ru**. It does not guess a single language from the raw book object.

## Raw-evidence audit

All 197 compact rows reconcile with raw chapter title, URL, and headings. Raw evidence contains ${qa.source_representation_audit.compact_vs_raw.raw_chapter_records} chapters, ${qa.source_representation_audit.compact_vs_raw.headings_by_kit['452']} + ${qa.source_representation_audit.compact_vs_raw.headings_by_kit['369']} heading records, and ${qa.source_representation_audit.compact_vs_raw.images_by_kit['452']} + ${qa.source_representation_audit.compact_vs_raw.images_by_kit['369']} image references. All compact and raw structured task arrays are empty.

Empty task arrays are a capture limitation, not proof that the books contain no exercises. A targeted task-body recapture may improve later lesson authoring; a full recapture is not required for canonical routing. The original raw and canonical text is not reconstructed from images or rewritten.

## Repeated titles

Equal titles identify distinct chapters and remain separate:

${repeatedRows}

## Quality and boundaries

There are zero replacement characters, forbidden controls, invisible soft hyphens, unprocessed HTML/JSON payloads, malformed chapter URLs, empty instructional titles, or instructional pages without headings. All 193 URLs are unique and occur in no other manifest route.

The route is separated from grade-3 mathematics, Estonian, Russian, arts-and-crafts, and adjacent grades. It is a source index, not a curriculum map. No ordinary/simplified programme classification, publisher, task text, or curriculum completeness is inferred beyond the capture.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const source = manifest.sources.find((entry) => entry.id === sourceId);
  validateManifestSource(source);

  const archiveBytes = await readFile(absolute(grade3EnglishArchive.path));
  assertArchiveIdentity(archiveBytes);
  const archive = await readCompactZip(absolute(grade3EnglishArchive.path));
  assertGrade3(archive.entryCount === 204, `ZIP member count is ${archive.entryCount}; expected 204.`);
  assertGrade3(
    [...archive.memberMetadata.values()].reduce((total, entry) => total + entry.uncompressed_size, 0) === 1_898_081,
    'ZIP uncompressed size differs.',
  );
  assertGrade3([...archive.memberMetadata.values()].every((entry) => entry.compression_method === 0), 'Every ZIP member must use stored compression.');
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());
  const filenameAudit = auditZipMemberNames(archive.memberMetadata);

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  validateIndex(index, rawIndex);
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md')));
  validateTopicMap(parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'), sourceRecords);
  const rawValidation = validateRawChapters(sourceRecords, archive, readZipText);
  const books = validateRawBooks(archive);
  const catalog = buildCatalog(sourceRecords);
  const zeroWidthHeadingRecords = sourceRecords.filter(
    (record) => record.headings.some((heading) => heading.includes('\u200b')),
  );
  assertGrade3(
    zeroWidthHeadingRecords.length === 1
      && zeroWidthHeadingRecords[0].url === 'https://www.opiq.ee/kit/369/chapter/20964'
      && zeroWidthHeadingRecords[0].headings.includes('\u200b[t] and [d]'),
    'Source zero-width heading anomaly differs from the audited chapter.',
  );
  const quality = auditCanonicalContentQuality(catalog.canonical_records);
  const crossRoute = await crossRouteAudit(manifest, catalog.canonical_records);
  const markdown = renderMarkdown(catalog);

  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3EnglishArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: '1.0',
      note: 'Generated deterministically from the immutable supplied archive; programme type and publisher remain unverified.',
    },
    checksums: {
      source_archive_sha256: grade3EnglishArchive.sha256,
      output_file_sha256: sha256Bytes(Buffer.from(markdown)),
    },
    archive: {
      path: grade3EnglishArchive.path,
      sha256: grade3EnglishArchive.sha256,
      byte_size: grade3EnglishArchive.byte_size,
      uncompressed_size: grade3EnglishArchive.uncompressed_size,
      member_count: archive.entryCount,
      crc_verified_members: archive.entryCount,
      declared_and_actual_sizes_verified: archive.entryCount,
      unique_stored_member_names: archive.entryCount,
      safe_relative_member_names: archive.entryCount,
      local_central_filename_matches: archive.entryCount,
      compression_methods: { stored: archive.entryCount, deflate: 0 },
      capture_timestamp: grade3EnglishArchive.capture_timestamp,
    },
    filename_encoding_audit: filenameAudit,
    source_records: sourceRecords.length,
    page_records_included: catalog.canonical_records.length,
    cover_detail_records_excluded: 4,
    administrative_records_excluded: 0,
    duplicate_records_excluded: 0,
    source_accounting: {
      kit_452_source_rows: 91,
      kit_452_instructional_pages: 89,
      kit_452_details_rows: 2,
      kit_369_source_rows: 106,
      kit_369_instructional_pages: 104,
      kit_369_details_rows: 2,
      total_source_rows: 197,
      total_canonical_pages: 193,
      unexplained_rows: 0,
    },
    source_representation_audit: {
      compact_jsonl_vs_markdown: { compared_records: 197, unexplained_differences: 0 },
      compact_vs_raw: rawValidation.audit,
      index_vs_raw_index: { compared_books: 2, unexplained_differences: 0 },
      topic_map: { validated: true, unexplained_differences: 0 },
    },
    captured_book_inventory: books,
    raw_grade_counts: countBy(sourceRecords, (record) => record.grade),
    raw_subject_counts: countBy(sourceRecords, sourceSubject),
    canonical_subject_counts: { 'english / inglise keel / английский язык': 193 },
    raw_language_counts: countBy(sourceRecords, (record) => record.language),
    canonical_language_counts: countBy(catalog.canonical_records, (record) => record.language),
    subject_normalization_audit: {
      corrected_source_rows: 197,
      canonical_page_records: 193,
      source_subject: 'mathematics / matemaatika / математика',
      canonical_subject: `${grade3EnglishSubject.en} / ${grade3EnglishSubject.et} / ${grade3EnglishSubject.ru}`,
      generated_mathematics_aliases_removed: true,
      source_text_changed: false,
    },
    language_normalization_audit: {
      index_book_languages: { en: 1, et: 1 },
      raw_book_languages: { ru: 2 },
      source_page_languages_including_details: { en: 122, et: 71, ru: 4 },
      canonical_page_languages: { en: 122, et: 67, ru: 4 },
      decision: 'Preserve page-level language values; retain index/raw-book anomalies as provenance.',
    },
    duplicate_url_audit: catalog.duplicate_url_audit,
    repeated_title_groups: {
      groups: catalog.repeated_title_groups.length,
      records: catalog.repeated_title_groups.reduce((total, entry) => total + entry.urls.length, 0),
      entries: catalog.repeated_title_groups,
    },
    content_repair_audit: {
      zero_width_space_removed: 1,
      affected_url: 'https://www.opiq.ee/kit/369/chapter/20964',
      affected_heading_visible_text: '[t] and [d]',
      visible_educational_text_changed: false,
      other_chapter_content_repairs: 0,
    },
    content_quality_audit: quality,
    records_without_task_examples: 193,
    publisher_limitations: {
      publisher_values_present: 0,
      canonical_publishers_invented: 0,
      decision: 'Publisher metadata is absent and remains empty.',
    },
    programme_type_audit: {
      value: 'unknown',
      canonical_records: 193,
      ordinary_curriculum_inferred: false,
      simplified_curriculum_inferred: false,
    },
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: 193,
      cross_route: crossRoute,
      final_owner: sourceId,
    },
    grades: { 3: 193 },
    languages: { en: 122, et: 67, ru: 4 },
    books: {
      english_step_by_step_1__kit452: 89,
      'inglise_keel_3._klassile__kit369': 104,
    },
    kits: { 369: 104, 452: 89 },
    known_limitations: [
      'All 193 instructional pages lack structured task arrays in both compact and raw captures.',
      'Publisher metadata is absent and is not invented.',
      'Programme type is not verifiable from the supplied capture and remains unknown.',
      'Raw book language is ru for both books; canonical records preserve page-level en/et/ru values.',
      'This import does not establish official-curriculum or current live-catalogue completeness.',
    ],
  };
  const qaText = `${JSON.stringify(qa, null, 2)}\n`;
  const auditText = renderAudit(qa);

  if (checkOnly) {
    assertGeneratedArtifact(await readFile(absolute(source.md_path), 'utf8'), markdown, source.md_path);
    assertGeneratedArtifact(await readFile(absolute(source.qa_path), 'utf8'), qaText, source.qa_path);
    assertGeneratedArtifact(await readFile(absolute(auditPath), 'utf8'), auditText, auditPath);
    console.log('Grade 3 English artifacts are current: 197 source rows, 193 canonical pages, 0 cross-route overlaps.');
    return;
  }
  await writeFile(absolute(source.md_path), markdown);
  await writeFile(absolute(source.qa_path), qaText);
  await writeFile(absolute(auditPath), auditText);
  console.log(`Generated ${source.md_path}, ${source.qa_path}, and ${auditPath}.`);
}

await main();
