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
  assertGrade3RussianReadingArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  buildGrade3RussianReadingCatalog,
  countBy,
  grade3RussianReadingArchive,
  grade3RussianReadingSubject,
  grade3RussianReadingVariant,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3RussianReadingMarkdown,
  requiredGrade3RussianReadingMembers,
  sha256Bytes,
  sourceSubject,
  validateManifestGrade3RussianReadingSource,
} from './lib/grade-3-russian-reading.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceId = 'grade-3-russian-reading';
const generatorPath = 'scripts/generate-grade-3-russian-reading-sources.mjs';
const generatorVersion = '1.0';
const auditPath = 'docs/audits/grade-3-russian-reading-source-import.md';
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
  const variant = grade3RussianReadingVariant;
  assertGrade3(index?.formatVersion === grade3RussianReadingArchive.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3(index.generatedAt === grade3RussianReadingArchive.capture_timestamp, 'index.json capture timestamp changed.');
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
  assertGrade3(index.books.length === 1, `index.json has ${index.books.length} books; expected 1.`);

  const [book] = index.books;
  assertGrade3(book.id === variant.source_book_id, 'Captured Source Book ID changed.');
  assertGrade3(book.title === variant.raw_title, 'Captured Kit Details title changed.');
  assertGrade3(book.publisher === '', 'Archive unexpectedly contains publisher metadata.');
  assertGrade3(book.grade === 3 && book.language === 'ru', 'Captured book grade/language differs.');
  assertGrade3(book.subject === '', 'Raw per-book subject is no longer empty.');
  assertGrade3(book.chapterCount === sourceRecords.length, 'Captured chapterCount differs from JSONL.');

  const rawBookMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/'));
  assertGrade3(rawBookMembers.length === 1, `Archive has ${rawBookMembers.length} raw book members; expected 1.`);
  const rawBook = parseJson(readZipText(archive, rawBookMembers[0]), rawBookMembers[0]);
  assertGrade3(rawBook.id === book.id && rawBook.title === book.title, 'Raw book identity differs from index.json.');
  assertGrade3(rawBook.grade === 3 && rawBook.language === 'ru' && rawBook.subject === '', 'Raw book metadata differs.');
  assertGrade3(rawBook.publisher === '', 'Raw book unexpectedly contains publisher metadata.');
  assertGrade3(
    rawBook.createdAt === '2026-07-23T05:58:17.514Z',
    'Raw book creation timestamp changed.',
  );
}

function validateRawChapters(sourceRecords, archive) {
  const chapterMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3(
    chapterMembers.length === sourceRecords.length,
    `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`,
  );
  const rawByIdentity = new Map();
  for (const member of chapterMembers) {
    assertGrade3(!member.includes('\ufffd'), `ZIP member name contains a Unicode replacement character: ${member}`);
    const raw = parseJson(readZipText(archive, member), member);
    const identity = `${raw.bookId}\u0000${raw.chapterId}`;
    assertGrade3(!rawByIdentity.has(identity), `Duplicate raw chapter identity ${identity}.`);
    rawByIdentity.set(identity, { member, raw });
  }

  let titleWhitespaceNormalizations = 0;
  let taskRepresentationDifferences = 0;
  let compactServiceHeadingsExcluded = 0;
  for (const record of sourceRecords) {
    const identity = `${record.book_id}\u0000${record.chapter_id}`;
    const entry = rawByIdentity.get(identity);
    assertGrade3(entry, `Raw chapter is missing for ${identity}.`);
    const { member, raw } = entry;
    assertGrade3(
      normalizeRepresentationText(raw.chapterTitle) === record.title,
      `${member} title differs from compact JSONL beyond whitespace normalization.`,
    );
    if (raw.chapterTitle !== record.title) titleWhitespaceNormalizations += 1;
    assertGrade3(raw.url === record.url, `${member} URL differs from compact JSONL.`);
    assertGrade3(
      Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images),
      `${member} is missing raw page arrays.`,
    );
    const rawHeadings = new Set(raw.headings.map((heading) => normalizeRepresentationText(heading.text)));
    assertGrade3(
      record.headings.every((heading) => rawHeadings.has(normalizeRepresentationText(heading))),
      `${member} compact heading is absent from raw headings.`,
    );
    if (raw.headings.some((heading) => [
      'Õpetaja lisatud materjal',
      'Minu lisatud materjal',
      'Seotud sisu',
    ].includes(normalizeRepresentationText(heading.text)))) {
      compactServiceHeadingsExcluded += 1;
    }
    if (JSON.stringify(record.task_examples) !== JSON.stringify(raw.tasks.map((task) => task.text))) {
      taskRepresentationDifferences += 1;
    }
    assertGrade3(
      typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)),
      `${member} scrapedAt is invalid.`,
    );
  }
  assertGrade3(rawByIdentity.size === sourceRecords.length, 'Raw chapter members are not fully referenced.');
  assertGrade3(titleWhitespaceNormalizations === 11, 'Unexpected raw/compact title normalization count.');
  assertGrade3(taskRepresentationDifferences === 0, 'Unexpected raw/compact task difference.');
  assertGrade3(compactServiceHeadingsExcluded === 55, 'Expected service headings on all 55 instructional pages.');
  return {
    raw_chapter_records: chapterMembers.length,
    title_whitespace_normalizations: titleWhitespaceNormalizations,
    task_representation_differences: taskRepresentationDifferences,
    instructional_pages_with_raw_service_headings_excluded_from_compact: compactServiceHeadingsExcluded,
    member_names_with_replacement_characters: 0,
    note: 'The shared ZIP reader verifies safe, unique UTF-8 member paths and matching local/central names.',
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
      assertGrade3(
        candidates.some((record) => record.title === entry.title
          && record.language === entry.language
          && record.grade === entry.grade
          && record.subject_en === entry.subject),
        `topic_map.json references unknown or changed record ${entry.url}.`,
      );
    }
  }
  assertGrade3(Object.keys(topicMap).length === 279, 'topic_map.json topic count changed.');
  assertGrade3(references === 539, 'topic_map.json reference count changed.');
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function contentQualityAudit(records) {
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
      disposition: 'Distinct literary selections on distinct direct URLs; retain unless full-page evidence proves duplication.',
    }));
  const shortRecords = records.filter((record) => [
    record.title,
    ...record.headings,
    ...record.task_examples,
  ].join(' ').length < 80).map((record) => ({
    url: record.url,
    title: record.title,
    disposition: 'Short but valid compact literary section; no content is invented.',
  }));
  const mixed = records.flatMap((record) => {
    const words = mixedScriptWords([record.title, record.headings, record.task_examples]);
    return words.length ? [{ url: record.url, words, disposition: 'Source typography retained.' }] : [];
  });
  const sourceTokenizerObservations = records.filter(
    (record) => record.topics_ru.includes('рный'),
  ).map((record) => ({
    url: record.url,
    title: record.title,
    source_topic: 'рный',
    disposition: 'Retain the generated source topic; the correct author name remains intact in title and heading.',
  }));
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
      broken_markdown_records: 0,
    },
    classified_warnings: {
      missing_task_examples: records.length,
      missing_task_example_urls: records.map((record) => record.url),
      repeated_title_groups: repeatedTitles,
      repeated_title_group_count: repeatedTitles.length,
      unusually_short_records: shortRecords,
      mixed_script_observations: mixed,
      source_tokenizer_observations: sourceTokenizerObservations,
      note: 'The capture has no structured task examples even though many pages contain a Задания heading. Tasks are not invented; direct pages remain available.',
    },
  };
}

async function assertCrossRouteOwnership(manifest, route, canonicalRecords) {
  const urls = new Set(canonicalRecords.map((record) => record.url));
  let checkedRoutes = 0;
  const overlaps = [];
  for (const other of manifest.sources.filter((source) => source.id !== route.id)) {
    const markdown = await readFile(absolute(other.md_path), 'utf8');
    const otherUrls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)]
      .map((match) => match[1]);
    otherUrls.filter((url) => urls.has(url)).forEach((url) => overlaps.push({ source_id: other.id, url }));
    checkedRoutes += 1;
  }
  assertGrade3(
    overlaps.length === 0,
    `Grade-3 Russian-reading URLs overlap another route: ${overlaps.slice(0, 3).map((entry) => `${entry.source_id} ${entry.url}`).join(', ')}`,
  );
  return { checked_routes: checkedRoutes, overlap_count: 0 };
}

function renderAudit(qa) {
  const book = qa.book_metadata_audit[grade3RussianReadingVariant.canonical_book_id];
  const warnings = qa.content_quality_audit.classified_warnings;
  return `# Grade 3 Russian-reading source import audit

## Result

The archive contains one grade-3 Russian reading book, not mathematics and not a translation of another subject. The dedicated canonical route \`grade-3-russian-reading\` contains **${qa.page_records_included} instructional pages** from Kit ${book.kit_id}. It remains separate from the grammar-oriented \`grade-3-russian\` route and from mathematics.

- archive: \`${qa.source_archive}\`
- SHA-256: \`${qa.checksums.source_archive_sha256}\`
- size: ${qa.archive.byte_size} bytes
- ZIP members: ${qa.archive.member_count}
- capture: ${qa.generation.generated_at}
- format: ${qa.format_version}
- publisher: not captured; not invented

This source index is not an official curriculum map and is not proof of complete current live Opiq coverage.

## Source accounting

| Category | Count |
| --- | ---: |
| Canonical instructional chapters | ${qa.page_records_included} |
| Unique Kit Details | ${qa.cover_detail_records_excluded} |
| Duplicate Kit Details alias | ${qa.duplicate_records_excluded} |
| Administrative, search, malformed, wrong-grade, or unrelated rows | 0 |
| Total | ${qa.source_records} |

Every source row is classified. The sole duplicate URL is the repeated Kit Details page \`https://www.opiq.ee/Kit/Details/504\`; the two rows differ only by synthetic chapter ID and neither is instructional.

## Book and subject decision

| Kit | Canonical Book ID | Source Book ID | Canonical title | Language | Programme | Pages |
| ---: | --- | --- | --- | --- | --- | ---: |
| ${book.kit_id} | \`${grade3RussianReadingVariant.canonical_book_id}\` | \`${book.source_book_id}\` | ${book.canonical_title} | ${book.canonical_language} | ${book.programme_type} | ${book.canonical_instructional_pages} |

The Source Book ID, Kit Details title, and the complete 55-chapter sequence consist of Russian literary texts, discussion headings, and assignments. That evidence supports the source-specific subject \`${grade3RussianReadingSubject.en} / ${grade3RussianReadingSubject.et} / ${grade3RussianReadingSubject.ru}\`. The automatic \`mathematics / matemaatika / математика\` label is replaced, and generated mathematics topic aliases are removed.

The archive does not expose a reliable Opiq subject-filter label. The separate reading route therefore describes the captured source type; it does not claim that Russian reading is independently allocated as an official exact-grade subject.

## Metadata and technical repairs

- Raw grade 3 and language \`ru\` are retained for all instructional pages.
- The mixed Latin-lookalike spelling \`клacca\` is deterministically repaired to \`класса\` in the canonical book title and Book ID; the raw Source Book ID and raw title remain in QA.
- Publisher stays blank because no archive representation provides one.
- One zero-width character is removed from a decorative heading on [chapter 27675](https://www.opiq.ee/kit/504/chapter/27675).
- Every canonical subject/book/topic transformation is recorded by URL with raw and canonical field hashes.

No educational prose, chapter title, literary heading, translation, task, or explanation is invented.

## Quality and limitations

Post-repair hard errors: **0**.

- All ${qa.records_without_task_examples} compact records lack structured task examples, although many pages expose a \`Задания\` heading. This is a capture limitation, not proof that the pages have no exercises.
- ${warnings.unusually_short_records.length} compact summaries are short but retain a valid title and headings:
${warnings.unusually_short_records.map((entry) => `  - [${entry.title}](${entry.url})`).join('\n')}
- Repeated-title groups: ${warnings.repeated_title_group_count}; mixed-script page-title/heading observations after repair: ${warnings.mixed_script_observations.length}.
- The generated topic token \`рный\` loses the beginning of \`ЧЁРНЫЙ\` on ${warnings.source_tokenizer_observations.length} records; the correct author name remains intact in title and heading, so no topic text is guessed:
${warnings.source_tokenizer_observations.map((entry) => `  - [${entry.title}](${entry.url})`).join('\n')}

No additional Opiq recapture is required for canonical routing. A future targeted capture of task bodies may be useful only when those exact exercises are needed for lesson authoring; a full recapture is not justified.
`;
}

async function main() {
  const manifest = parseJson(await readFile(absolute('source-manifest.json'), 'utf8'), 'source-manifest.json');
  const route = manifest.sources.find((source) => source.id === sourceId);
  validateManifestGrade3RussianReadingSource(route);

  const archiveBytes = await readFile(absolute(route.source_archive));
  assertGrade3RussianReadingArchiveIdentity(archiveBytes);
  assertGrade3((await stat(absolute(route.source_archive))).isFile(), 'Original source archive is not a file.');
  const archive = await readCompactZip(absolute(route.source_archive));
  assertGrade3(
    archive.entryCount === grade3RussianReadingArchive.member_count,
    `Original archive has ${archive.entryCount} members; expected ${grade3RussianReadingArchive.member_count}.`,
  );
  [...archive.entries.keys()].forEach(assertSafeMemberName);
  assertRequiredMembers(archive.entries.keys());
  assertGrade3(
    [...archive.memberMetadata.values()].every((entry) => entry.compression_method === 0),
    'Original archive contains an unsupported or changed compression method.',
  );

  const index = parseJson(readZipText(archive, 'index.json'), 'index.json');
  const rawIndex = parseJson(readZipText(archive, 'raw/Opiq-DB/index.json'), 'raw/Opiq-DB/index.json');
  const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
  const compactMarkdown = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
  assertCompactMarkdownMatches(sourceRecords, compactMarkdown);
  validateIndex(index, rawIndex, sourceRecords, archive);
  const rawAudit = validateRawChapters(sourceRecords, archive);
  const topicMapAudit = validateTopicMap(
    parseJson(readZipText(archive, 'topic_map.json'), 'topic_map.json'),
    sourceRecords,
  );
  const catalog = buildGrade3RussianReadingCatalog(sourceRecords);
  const markdown = renderGrade3RussianReadingMarkdown(catalog);
  const crossRouteAudit = await assertCrossRouteOwnership(manifest, route, catalog.canonical_records);
  const quality = contentQualityAudit(catalog.canonical_records);
  const invisibleSpacingPages = catalog.content_repairs.filter(
    (repair) => repair.categories.includes('invisible_spacing_control_removed'),
  ).length;

  const qa = {
    qa_schema_version: '1.0',
    source_id: sourceId,
    source_archive: route.source_archive,
    output_file: route.md_path,
    format_version: route.format_version,
    generation: {
      status: 'generated',
      generated_at: grade3RussianReadingArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the committed original Opiq export.',
    },
    checksums: {
      source_archive_sha256: grade3RussianReadingArchive.sha256,
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
      required_members: [...requiredGrade3RussianReadingMembers],
      unsafe_member_paths: 0,
      duplicate_member_names: 0,
      crc_verified_members: archive.entryCount,
      raw_book_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/')).length,
      raw_chapter_members: [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/')).length,
    },
    source_representation_audit: {
      compact_jsonl_records: sourceRecords.length,
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
    administrative_records_excluded: 0,
    search_records_excluded: 0,
    malformed_records_excluded: 0,
    unrelated_records_excluded: 0,
    wrong_grade_records_excluded: 0,
    wrong_subject_records_excluded: 0,
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
      administrative: [],
      search_results: [],
    },
    grade_audit: {
      source_grade_counts: countBy(sourceRecords, (record) => record.grade),
      canonical_grade_counts: countBy(catalog.canonical_records, (record) => record.grade),
      normalization_required: false,
      evidence: 'Index, raw book metadata, Kit Details title, Source Book ID, and all page records identify grade 3.',
    },
    language_audit: {
      source_language_counts: countBy(sourceRecords, (record) => record.language),
      canonical_language_counts: countBy(catalog.canonical_records, (record) => record.language),
      normalization_required: false,
    },
    subject_normalization_audit: {
      source_subject: 'mathematics / matemaatika / математика',
      canonical_subject: `${grade3RussianReadingSubject.en} / ${grade3RussianReadingSubject.et} / ${grade3RussianReadingSubject.ru}`,
      affected_source_rows: sourceRecords.length,
      affected_canonical_pages: catalog.canonical_records.length,
      evidence: 'Source Book ID, Kit Details title, visible literary headings, discussion/assignment headings, and the complete chapter sequence.',
      generated_mathematics_aliases_remaining: 0,
      official_subject_allocation_claimed: false,
    },
    book_metadata_audit: {
      [grade3RussianReadingVariant.canonical_book_id]: {
        source_book_id: grade3RussianReadingVariant.source_book_id,
        kit_id: grade3RussianReadingVariant.kit_id,
        raw_title: grade3RussianReadingVariant.raw_title,
        canonical_title: grade3RussianReadingVariant.canonical_title,
        title_normalization: 'Replace Latin-lookalike acca in the Russian word клacca with Cyrillic асса.',
        publisher: null,
        publisher_provenance: grade3RussianReadingVariant.publisher_provenance,
        raw_language: grade3RussianReadingVariant.language,
        canonical_language: grade3RussianReadingVariant.language,
        raw_grade: 3,
        canonical_grade: 3,
        raw_subject: 'mathematics / matemaatika / математика',
        canonical_subject: `${grade3RussianReadingSubject.en} / ${grade3RussianReadingSubject.et} / ${grade3RussianReadingSubject.ru}`,
        programme_type: grade3RussianReadingVariant.programme_type,
        source_rows: sourceRecords.length,
        canonical_instructional_pages: catalog.canonical_records.length,
        details_excluded: 1,
        duplicate_detail_aliases_excluded: 1,
        administrative_records_excluded: 0,
        duplicate_instructional_records_excluded: 0,
      },
    },
    metadata_normalization_audit: catalog.canonical_records.map((record, index) => {
      const source = sourceRecords.filter((candidate) => !/\/Kit\/Details\//u.test(candidate.url))[index];
      return {
        url: record.url,
        raw: {
          book: source.book,
          book_id: source.book_id,
          grade: source.grade,
          subject: sourceSubject(source),
          language: source.language,
          publisher: source.publisher,
        },
        canonical: {
          book: record.book,
          book_id: record.book_id,
          source_book_id: record.source_book_id,
          grade: record.grade,
          subject: sourceSubject(record),
          language: record.language,
          publisher: record.publisher,
          programme_type: record.programme_type,
        },
        decision_categories: [
          'source_book_plus_kit_identity',
          'mixed_script_book_title_repair',
          'automatic_subject_correction',
        ],
        evidence: 'Same archived record, Kit 504 identity, reading title, literary headings, and grade-3 sequence.',
      };
    }),
    content_repair_audit: catalog.content_repairs,
    content_repair_summary: {
      affected_pages: catalog.content_repairs.length,
      invisible_spacing_pages: invisibleSpacingPages,
      categories: countBy(
        catalog.content_repairs.flatMap((repair) => repair.categories),
        (category) => category,
      ),
      changed_fields: countBy(
        catalog.content_repairs.flatMap((repair) => repair.changes),
        (change) => change.field,
      ),
    },
    content_quality_audit: quality,
    records_without_headings: 0,
    records_without_task_examples: quality.classified_warnings.missing_task_examples,
    canonical_url_audit: {
      unique: true,
      duplicate_count: 0,
      direct_chapter_urls: catalog.canonical_records.length,
      cross_route: crossRouteAudit,
      final_owner: sourceId,
    },
    existing_route_comparison: {
      repository_matches_by_kit_source_book_url_or_title_before_import: 0,
      migrated_records: 0,
      decision: 'new_dedicated_route',
      note: 'No kit 504 URL, Source Book ID, or title was previously canonical in the repository.',
    },
    known_limitations: [
      'The exporter assigns mathematics to all source rows while raw per-book subject is empty; reading classification comes from stable source identity and the complete literary sequence.',
      'Publisher metadata is absent and is not invented.',
      'All 55 compact records lack structured task examples even though many contain a Задания heading; task bodies are not reconstructed.',
      'The route is a source catalogue, not an official curriculum map or proof of current live Opiq completeness.',
    ],
    recapture_assessment: {
      required_for_canonical_routing: false,
      full_recapture_justified: false,
      optional_targeted_capture: 'Capture selected task bodies only if exact exercises are later required for lesson authoring.',
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
      `Grade 3 Russian-reading source is current: ${catalog.canonical_records.length} pages from ${sourceRecords.length} source rows; zero cross-route overlap.`,
    );
    return;
  }
  for (const [relativePath, contents] of outputs) {
    await writeFile(absolute(relativePath), contents, 'utf8');
  }
  console.log(`Generated ${route.md_path}, ${route.qa_path}, and ${auditPath}.`);
}

await main();
