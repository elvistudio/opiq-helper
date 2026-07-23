#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  parseGrade3Jsonl,
  parseGrade3Markdown,
} from './lib/grade-3-mathematics.mjs';
import { containsUnprocessedPayload } from './lib/grade-2-content-quality.mjs';
import {
  assertGeneratedArtifact,
  assertGrade3EstonianCrossRouteOwnership,
  assertGrade3Estonian,
  assertGrade3EstonianArchiveIdentity,
  assertRequiredGrade3EstonianMembers,
  assertSafeMemberName,
  buildGrade3EstonianCatalog,
  buildGrade3EstonianContentQualityAudit,
  countBy,
  grade3EstonianArchives,
  grade3EstonianKit590Archive,
  grade3EstonianLanguageNormalizations,
  grade3EstonianRoutes,
  grade3EstonianSharedArchive,
  grade3EstonianVariants,
  renderGrade3EstonianMarkdown,
  sha256Bytes,
  sourceSubject,
  validateManifestGrade3EstonianRoutes,
} from './lib/grade-3-estonian.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const generatorPath = 'scripts/generate-grade-3-estonian-sources.mjs';
const generatorVersion = '2.0';
const auditPath = 'docs/audits/grade-3-estonian-source-import.md';
const checkOnly = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
assertGrade3Estonian(unknownArguments.length === 0, `Unknown arguments: ${unknownArguments.join(' ')}`);

const absolute = (relativePath) => path.join(repositoryRoot, relativePath);
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function normalizeRepresentationText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function validateIndex(index, rawIndex, sourceRecords, archive, archiveDefinition) {
  assertGrade3Estonian(index?.formatVersion === archiveDefinition.format_version, 'index.json formatVersion is not 2.0.');
  assertGrade3Estonian(index.generatedAt === archiveDefinition.capture_timestamp, 'index.json capture timestamp changed.');
  assertGrade3Estonian(index.source === 'opiq-helper-extension', 'index.json source is not opiq-helper-extension.');
  assertGrade3Estonian(index.recordCount === sourceRecords.length, 'index.json recordCount differs from JSONL.');
  assertGrade3Estonian(JSON.stringify(index.supportedQueryLanguages) === JSON.stringify(['et', 'ru', 'en']), 'index.json query languages changed.');
  assertGrade3Estonian(JSON.stringify(index.compactFiles) === JSON.stringify(['opiq_lookup.md', 'opiq_lookup.jsonl', 'topic_map.json', 'index.json']), 'index.json compactFiles changed.');
  assertGrade3Estonian(index.rawArchiveIncluded === true, 'index.json must declare raw source data.');
  assertGrade3Estonian(rawIndex.generatedAt === index.generatedAt, 'Raw and compact capture timestamps differ.');
  assertGrade3Estonian(JSON.stringify(rawIndex.books) === JSON.stringify(index.books), 'Raw and compact book inventories differ.');
  const expectedBookIds = archiveDefinition === grade3EstonianSharedArchive
    ? Object.keys(grade3EstonianVariants)
    : ['mina_loen_ja_kirjutan_3'];
  assertGrade3Estonian(
    index.books.length === expectedBookIds.length,
    `index.json has ${index.books.length} books; expected ${expectedBookIds.length}.`,
  );

  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  const bookMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/books/'));
  assertGrade3Estonian(
    bookMembers.length === expectedBookIds.length,
    `Archive has ${bookMembers.length} raw book records; expected ${expectedBookIds.length}.`,
  );
  for (const book of index.books) {
    const variant = grade3EstonianVariants[book.id];
    assertGrade3Estonian(variant, `index.json contains unknown book ${book.id}.`);
    assertGrade3Estonian(expectedBookIds.includes(book.id), `${book.id} is outside ${archiveDefinition.archive_id}.`);
    assertGrade3Estonian(book.title.replace(/\s+[–-]\s+Opiq$/u, '') === variant.title, `Captured title differs for ${book.id}.`);
    assertGrade3Estonian(book.grade === variant.source_grade, `${book.id} compact grade differs from audited evidence.`);
    assertGrade3Estonian(book.language === 'et', `${book.id} compact book language must be et.`);
    assertGrade3Estonian(book.publisher === '', `${book.id} unexpectedly contains publisher metadata.`);
    assertGrade3Estonian(book.chapterCount === sourceCounts[book.id], `${book.id} chapterCount differs from JSONL.`);
    const member = `raw/Opiq-DB/books/${book.id}.json`;
    assertGrade3Estonian(archive.entries.has(member), `Original archive is missing ${member}.`);
    const rawBook = parseJson(readZipText(archive, member), member);
    assertGrade3Estonian(rawBook.id === book.id && rawBook.title === book.title, `${member} identity differs from index.json.`);
    assertGrade3Estonian(rawBook.grade === variant.source_grade, `${member} grade differs from compact book metadata.`);
    assertGrade3Estonian(rawBook.language === 'ru', `${member} no longer exposes the audited raw-book language anomaly ru.`);
    assertGrade3Estonian(rawBook.publisher === '', `${member} unexpectedly contains publisher metadata.`);
  }
  assertGrade3Estonian(
    new Set(index.books.map((book) => book.id)).size === expectedBookIds.length
      && expectedBookIds.every((bookId) => index.books.some((book) => book.id === bookId)),
    `${archiveDefinition.archive_id} book inventory is incomplete.`,
  );
}

const platformHeadingBoilerplate = new Set([
  'Õpetaja lisatud materjal',
  'Minu lisatud materjal',
  'Seotud sisu',
]);

function filteredRawHeadings(raw) {
  return [...new Set(raw.headings
    .map((heading) => normalizeRepresentationText(heading.text))
    .filter((heading) => heading && !platformHeadingBoilerplate.has(heading)))];
}

function validateRawChapters(sourceRecords, archive, archiveDefinition) {
  const chapterMembers = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3Estonian(chapterMembers.length === sourceRecords.length, `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`);
  const expectedMembers = new Set();
  let titleWhitespaceNormalizations = 0;
  let taskRepresentationDifferences = 0;
  let platformHeadingsFiltered = 0;
  const rawTextValues = [];
  for (const record of sourceRecords) {
    const member = `raw/Opiq-DB/chapters/${record.book_id}/${record.chapter_id}.json`;
    assertGrade3Estonian(!expectedMembers.has(member), `Multiple source rows resolve to ${member}.`);
    expectedMembers.add(member);
    assertGrade3Estonian(archive.entries.has(member), `Original archive is missing ${member}.`);
    const raw = parseJson(readZipText(archive, member), member);
    assertGrade3Estonian(raw.bookId === record.book_id, `${member} bookId differs from JSONL.`);
    assertGrade3Estonian(String(raw.chapterId) === String(record.chapter_id), `${member} chapterId differs from JSONL.`);
    assertGrade3Estonian(normalizeRepresentationText(raw.chapterTitle) === record.title, `${member} title differs beyond audited whitespace normalization.`);
    if (raw.chapterTitle !== record.title) titleWhitespaceNormalizations += 1;
    assertGrade3Estonian(raw.url === record.url, `${member} URL differs from JSONL.`);
    assertGrade3Estonian(Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images), `${member} is missing raw page arrays.`);
    rawTextValues.push(
      raw.chapterTitle,
      ...raw.headings.map((heading) => heading.text),
      ...raw.tasks.map((task) => task.text),
    );
    platformHeadingsFiltered += raw.headings.filter(
      (heading) => platformHeadingBoilerplate.has(normalizeRepresentationText(heading.text)),
    ).length;
    const rawHeadings = filteredRawHeadings(raw);
    assertGrade3Estonian(
      record.headings.every((heading) => rawHeadings.includes(normalizeRepresentationText(heading))),
      `${member} compact headings are not represented after deterministic raw heading filtering.`,
    );
    assertGrade3Estonian(
      record.headings.every((heading) => !platformHeadingBoilerplate.has(normalizeRepresentationText(heading))),
      `${member} compact headings retain platform navigation boilerplate.`,
    );
    if (JSON.stringify(record.task_examples) !== JSON.stringify(raw.tasks.map((task) => task.text))) taskRepresentationDifferences += 1;
    assertGrade3Estonian(typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)), `${member} scrapedAt is invalid.`);
  }
  chapterMembers.forEach((name) => assertGrade3Estonian(expectedMembers.has(name), `Unreferenced raw chapter member: ${name}`));
  const expectedTitleNormalizations = archiveDefinition === grade3EstonianSharedArchive ? 5 : 0;
  assertGrade3Estonian(
    titleWhitespaceNormalizations === expectedTitleNormalizations,
    `Raw/compact title whitespace normalization count is ${titleWhitespaceNormalizations}; expected ${expectedTitleNormalizations}.`,
  );
  assertGrade3Estonian(taskRepresentationDifferences === 0, `Raw/compact task difference count is ${taskRepresentationDifferences}; expected 0.`);
  if (archiveDefinition === grade3EstonianKit590Archive) {
    assertGrade3Estonian(
      platformHeadingsFiltered > 0,
      'The complete kit 590 capture no longer exposes the audited platform heading boilerplate.',
    );
    assertGrade3Estonian(
      sourceRecords.filter((record) => !/\/Kit\/Details\//u.test(record.url))
        .every((record) => record.headings.length > 0 && record.task_examples.length === 0),
      'Kit 590 instructional heading/task structure changed.',
    );
  }
  const rawText = rawTextValues.join('\n');
  const textQuality = {
    unicode_replacement_characters: [...rawText].filter((character) => character === '\ufffd').length,
    zero_width_characters: (rawText.match(/[\u200b-\u200d\u2060\ufeff]/gu) ?? []).length,
    discretionary_soft_hyphens: (rawText.match(/\u00ad/gu) ?? []).length,
    forbidden_control_characters: (rawText.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu) ?? []).length,
    html_mathml_or_json_payloads: containsUnprocessedPayload(rawText) ? 1 : 0,
    nfc_violations: rawTextValues.filter((value) => value.normalize('NFC') !== value).length,
  };
  if (archiveDefinition === grade3EstonianKit590Archive) {
    assertGrade3Estonian(
      Object.values(textQuality).every((count) => count === 0),
      `Kit 590 raw text-quality findings changed: ${JSON.stringify(textQuality)}.`,
    );
  }
  return {
    raw_chapter_members: chapterMembers.length,
    title_whitespace_normalizations: titleWhitespaceNormalizations,
    task_representation_differences: taskRepresentationDifferences,
    platform_heading_occurrences_filtered: platformHeadingsFiltered,
    text_quality: textQuality,
  };
}

function validateTopicMap(topicMap, sourceRecords, archiveDefinition) {
  assertGrade3Estonian(topicMap && typeof topicMap === 'object' && !Array.isArray(topicMap), 'topic_map.json root must be an object.');
  const byUrl = new Map();
  for (const record of sourceRecords) {
    const group = byUrl.get(record.url) ?? [];
    group.push(record);
    byUrl.set(record.url, group);
  }
  let references = 0;
  for (const [topic, entries] of Object.entries(topicMap)) {
    assertGrade3Estonian(topic.trim() && Array.isArray(entries), `topic_map.json topic ${topic || '<empty>'} is invalid.`);
    for (const entry of entries) {
      references += 1;
      const candidates = byUrl.get(entry.url) ?? [];
      assertGrade3Estonian(candidates.some((record) => record.title === entry.title
        && record.language === entry.language
        && record.grade === entry.grade
        && record.subject_en === entry.subject), `topic_map.json entry ${entry.url} differs from JSONL.`);
    }
  }
  const expected = archiveDefinition === grade3EstonianSharedArchive
    ? { topics: 1751, references: 3161 }
    : { topics: 58, references: 190 };
  assertGrade3Estonian(Object.keys(topicMap).length === expected.topics, `topic_map.json has ${Object.keys(topicMap).length} topics; expected ${expected.topics}.`);
  assertGrade3Estonian(references === expected.references, `topic_map.json has ${references} references; expected ${expected.references}.`);
  return { topic_count: Object.keys(topicMap).length, reference_count: references };
}

function bookMetadataAudit(sourceRecords, catalog, routeId) {
  const route = grade3EstonianRoutes[routeId];
  return Object.fromEntries(route.included_source_book_ids.map((sourceBookId) => {
    const variant = grade3EstonianVariants[sourceBookId];
    const source = sourceRecords.filter((record) => record.book_id === sourceBookId);
    const canonical = catalog.route_records[routeId].filter((record) => record.source_book_id === sourceBookId);
    return [variant.canonical_book_id, {
      source_book_id: sourceBookId,
      kit_id: variant.kit_id,
      canonical_title: variant.title,
      publisher: null,
      publisher_evidence: 'not captured; not invented',
      source_languages: countBy(source, (record) => record.language),
      canonical_language: 'et',
      programme_type: variant.programme_type,
      source_records: source.length,
      canonical_instructional_pages: canonical.length,
      title_evidence: variant.title_evidence,
    }];
  }));
}

function capturedBookInventory(sourceRecords) {
  return Object.fromEntries(Object.values(grade3EstonianVariants).map((variant) => [variant.source_book_id, {
    kit_id: variant.kit_id,
    title: variant.title,
    source_records: sourceRecords.filter((record) => record.book_id === variant.source_book_id).length,
    instructional_pages: variant.canonical_records,
    route_id: variant.route_id,
    cover_only: variant.cover_only,
    publisher: null,
  }]));
}

function buildQa({ routeId, source, catalog, archiveAudits, markdown }) {
  const route = grade3EstonianRoutes[routeId];
  const records = catalog.route_records[routeId];
  const sourceRecords = catalog.source_records;
  const routeSourceRecords = sourceRecords.filter((record) => route.included_source_book_ids.includes(record.book_id));
  const routeRepairs = catalog.content_repairs.filter((repair) => route.included_source_book_ids.includes(repair.source_book_id));
  const languageAudit = Object.entries(grade3EstonianLanguageNormalizations)
    .filter(([url]) => records.some((record) => record.url === url))
    .map(([url, decision]) => {
      const record = sourceRecords.find((candidate) => candidate.url === url);
      return {
        url,
        source_book_id: record.book_id,
        kit_id: record.url.match(/\/kit\/(\d+)/u)?.[1],
        source_language: decision.source_language,
        canonical_language: decision.canonical_language,
        headings: record.headings,
        task_examples: record.task_examples,
        decision: 'normalize_to_et',
        evidence: decision.evidence,
      };
    });
  const excludedOtherSubject = routeId === 'grade-3-estonian' ? 54 : 363;
  const registeredAudits = routeId === 'grade-3-estonian'
    ? archiveAudits
    : archiveAudits.filter((audit) => audit.definition === grade3EstonianSharedArchive);
  const qaSourceRecords = registeredAudits.reduce((total, audit) => total + audit.records.length, 0);
  const primaryAudit = archiveAudits.find((audit) => audit.definition === grade3EstonianSharedArchive);
  const gradeNormalizations = route.included_source_book_ids.map((sourceBookId) => {
    const variant = grade3EstonianVariants[sourceBookId];
    return {
      source_book_id: sourceBookId,
      kit_id: variant.kit_id,
      source_grade: variant.source_grade,
      canonical_grade: 3,
      records: records.filter((record) => record.source_book_id === sourceBookId).length,
      decision: variant.source_grade === 3 ? 'retain_grade_3' : 'normalize_grade_2_to_3',
      evidence: 'Captured Kit Details title, Source Book ID, kit identity, raw book title, and chapter context all identify a grade-3 book.',
    };
  });
  const qa = {
    qa_schema_version: '1.0',
    source_id: source.id,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: routeId === 'grade-3-estonian'
        ? grade3EstonianKit590Archive.capture_timestamp
        : grade3EstonianSharedArchive.capture_timestamp,
      generator: generatorPath,
      generator_version: generatorVersion,
      note: 'Generated deterministically from the registered original captures; routes are split by audited subject, Source Book ID, and kit identity.',
    },
    checksums: {
      source_archive_sha256: sha256Bytes(primaryAudit.bytes),
      output_file_sha256: sha256Bytes(Buffer.from(markdown, 'utf8')),
    },
    archive: {
      byte_size: primaryAudit.bytes.length,
      member_count: primaryAudit.archive.entryCount,
      crc_verified_members: primaryAudit.archive.entryCount,
      unsafe_member_paths: 0,
    },
    source_records: qaSourceRecords,
    page_records_included: records.length,
    cover_detail_records_excluded: catalog.exclusions.cover_details.length,
    duplicate_records_excluded: routeId === 'grade-3-estonian'
      ? catalog.exclusions.duplicate_aliases.length
      : 4,
    administrative_records_excluded: catalog.exclusions.administrative.length,
    subject_boundary_page_records_excluded: excludedOtherSubject,
    source_accounting: {
      shared_archive_rows: 426,
      complete_kit_590_archive_rows: 44,
      combined_source_rows: 470,
      first_language_instructional_pages: 405,
      second_language_instructional_pages: 54,
      unique_kit_details: catalog.exclusions.cover_details.length,
      duplicate_kit_detail_aliases: catalog.exclusions.duplicate_aliases.length,
      administrative_impressum: catalog.exclusions.administrative.length,
      canonical_instructional_pages: 459,
      total: 470,
    },
    grades: countBy(records, (record) => record.grade),
    languages: countBy(records, (record) => record.language),
    books: countBy(records, (record) => record.book_id),
    kits: countBy(records, (record) => record.kit_id),
    programme_types: countBy(records, (record) => record.programme_type),
    raw_grade_counts: countBy(registeredAudits.flatMap((audit) => audit.records), (record) => record.grade),
    route_source_grade_counts: countBy(routeSourceRecords, (record) => record.grade),
    canonical_grade_counts: countBy(records, (record) => record.grade),
    raw_subject_counts: countBy(registeredAudits.flatMap((audit) => audit.records), sourceSubject),
    canonical_subject_counts: countBy(records, sourceSubject),
    raw_language_counts: countBy(registeredAudits.flatMap((audit) => audit.records), (record) => record.language),
    route_source_language_counts: countBy(routeSourceRecords, (record) => record.language),
    canonical_language_counts: countBy(records, (record) => record.language),
    route_partition: {
      paired_source_id: route.paired_source_id,
      expected_union_page_records: 459,
      canonical_overlap_urls: 0,
      included_source_book_ids: route.included_source_book_ids,
      forbidden_book_ids: route.forbidden_book_ids,
    },
    source_representation_audit: Object.fromEntries(registeredAudits.map((audit) => [
      audit.definition.archive_id,
      {
        compact_jsonl_records: audit.records.length,
        compact_markdown_records: audit.markdownRecords.length,
        raw_chapter_records: audit.representationAudit.raw_chapter_members,
        raw_compact_title_whitespace_normalizations: audit.representationAudit.title_whitespace_normalizations,
        raw_compact_task_representation_differences: audit.representationAudit.task_representation_differences,
        platform_heading_occurrences_filtered: audit.representationAudit.platform_heading_occurrences_filtered,
        text_quality: audit.representationAudit.text_quality,
        topic_map: audit.topicAudit,
        unexplained_differences: 0,
      },
    ])),
    duplicate_url_audit: {
      source_duplicate_groups: catalog.duplicate_audit.length,
      source_duplicate_records: routeId === 'grade-3-estonian' ? 6 : 4,
      canonical_duplicate_groups: 0,
      entries: catalog.duplicate_audit,
    },
    grade_normalization_audit: gradeNormalizations,
    subject_normalization_audit: {
      records: records.length,
      source_subject: sourceSubject(sourceRecords[0]),
      canonical_subject: sourceSubject(records[0]),
      decision: 'replace automatic mathematics subject with the audited Estonian subject route',
      evidence: 'Book identities, Kit Details titles, headings, and instructional context consistently identify Estonian-language study rather than mathematics.',
    },
    language_normalization_audit: languageAudit,
    content_repair_audit: {
      changed_records: routeRepairs.length,
      entries: routeRepairs,
      policy: 'Only deterministic technical normalization from the same captured record is allowed; educational prose is not rewritten.',
    },
    content_quality_audit: buildGrade3EstonianContentQualityAudit(records),
    book_metadata_audit: bookMetadataAudit(sourceRecords, catalog, routeId),
    captured_book_inventory: capturedBookInventory(sourceRecords),
    kit_590_completion_audit: {
      source_book_id: 'mina_loen_ja_kirjutan_3',
      canonical_book_id: 'mina_loen_ja_kirjutan_3__kit590',
      kit_id: '590',
      title: 'Mina loen ja kirjutan 3',
      shared_capture: {
        source_records: 2,
        detail_rows: 2,
        canonical_instructional_pages: 0,
        status: 'cover_only_evidence',
      },
      complete_capture: {
        source_records: 44,
        detail_rows: 2,
        canonical_instructional_pages: 42,
        section_distribution: { 1: 2, 2: 12, 3: 12, 4: 15, 5: 1 },
        status: 'canonical_page_level_source',
      },
      detail_url: 'https://www.opiq.ee/Kit/Details/590',
      detail_rows_across_captures: 4,
      detail_aliases_excluded: 3,
      canonical_chapter_urls_unique: 42,
      raw_book_language: 'ru',
      compact_and_page_language: 'et',
      recapture_required: false,
      optional_future_capture: 'A targeted task-body capture is optional only when exact exercises are required; a full kit recapture is not required.',
    },
    kit_590_content_quality_audit: {
      instructional_pages: 42,
      pages_with_headings: catalog.canonical_records.filter(
        (record) => record.kit_id === '590' && record.headings.length > 0,
      ).length,
      pages_without_structured_task_examples: catalog.canonical_records.filter(
        (record) => record.kit_id === '590' && record.task_examples.length === 0,
      ).length,
      raw_pages_with_empty_task_arrays: 42,
      platform_heading_occurrences_filtered: archiveAudits.find(
        (audit) => audit.definition === grade3EstonianKit590Archive,
      ).representationAudit.platform_heading_occurrences_filtered,
      raw_text_quality: archiveAudits.find(
        (audit) => audit.definition === grade3EstonianKit590Archive,
      ).representationAudit.text_quality,
      repeated_title_groups: [{
        title: 'KORDAMINE',
        count: 3,
        urls: catalog.canonical_records.filter(
          (record) => record.kit_id === '590' && record.title === 'KORDAMINE',
        ).map((record) => record.url),
        classification: 'distinct_section_contexts_and_chapter_URLs_retained',
      }],
      task_capture_classification: 'Image-based numbered instructional headings are present; empty task arrays are a capture limitation and no task bodies are invented.',
    },
    publisher_limitations: {
      archive_publishers_present: 0,
      canonical_publishers_invented: 0,
      note: 'Publisher metadata is absent from this archive and is left empty.',
    },
    known_limitations: [
      'The compact exporter labels every source record as mathematics; canonical subjects are evidence-backed by book/kit identity and page content.',
      'The compact index says et for all four books while raw per-book metadata says ru; page-level compact language and instructional text are used for the two audited corrections.',
      'All canonical pages lack structured task examples in the supplied captures; image-based numbered instructional headings are retained and no exercises are invented.',
      'The dedicated kit 590 capture provides all 42 canonical chapters; the shared capture remains cover-only evidence for that book.',
      'The route catalogue does not establish complete official-curriculum coverage.',
      'The supplied captures do not prove completeness of the current live Opiq catalogue.',
    ],
    records_without_headings: records.filter((record) => record.headings.length === 0).length,
    records_without_task_examples: records.filter((record) => record.task_examples.length === 0).length,
    missing_urls: records.filter((record) => !record.url).length,
  };
  if (routeId === 'grade-3-estonian') {
    qa.source_archives = [
      {
        path: grade3EstonianSharedArchive.path,
        role: 'primary',
        source_book_ids: Object.keys(grade3EstonianVariants),
        sha256: grade3EstonianSharedArchive.sha256,
        source_records: 426,
        page_records_included: 363,
      },
      {
        path: grade3EstonianKit590Archive.path,
        role: 'complete_kit_590_capture',
        source_book_ids: ['mina_loen_ja_kirjutan_3'],
        sha256: grade3EstonianKit590Archive.sha256,
        source_records: 44,
        page_records_included: 42,
      },
    ];
  }
  return qa;
}

function renderAudit(firstQa, secondQa) {
  const allRepairs = [...firstQa.content_repair_audit.entries, ...secondQa.content_repair_audit.entries];
  const repairCategories = countBy(allRepairs.flatMap((entry) => entry.categories.map((category) => ({ category }))), (entry) => entry.category);
  return `# Grade 3 Estonian source import audit

## Result

Two original Opiq captures produce two strictly separated canonical subjects: **405** first-language Estonian pages and **54** Estonian-as-a-second-language pages. Their **459** direct chapter URLs are disjoint. This is a source-catalogue boundary, not proof of official curriculum completeness or of the complete current live Opiq catalogue.

## Immutable archive identities

| Role | Archive | SHA-256 | Bytes | Members | Uncompressed bytes | Capture |
| --- | --- | --- | ---: | ---: | ---: | --- |
| shared four-book capture | \`${grade3EstonianSharedArchive.path}\` | \`${grade3EstonianSharedArchive.sha256}\` | ${grade3EstonianSharedArchive.byte_size} | ${grade3EstonianSharedArchive.member_count} | ${grade3EstonianSharedArchive.uncompressed_byte_size} | ${grade3EstonianSharedArchive.capture_timestamp} |
| complete kit 590 capture | \`${grade3EstonianKit590Archive.path}\` | \`${grade3EstonianKit590Archive.sha256}\` | ${grade3EstonianKit590Archive.byte_size} | ${grade3EstonianKit590Archive.member_count} | ${grade3EstonianKit590Archive.uncompressed_byte_size} | ${grade3EstonianKit590Archive.capture_timestamp} |

Both archives pass central-directory, safe-path, unique-member, compression-method, stored/uncompressed-size, CRC-32, JSON/JSONL, compact/raw, and topic-map validation. Neither archive is rewritten or recompressed.

## Source accounting

| Category | Count |
| --- | ---: |
| Shared archive rows | 426 |
| Complete kit 590 archive rows | 44 |
| **Combined source rows** | **470** |
| First-language instructional pages | 405 |
| Second-language instructional pages | 54 |
| Unique Kit Details excluded | 4 |
| Duplicate/alias Kit Details rows excluded | 6 |
| Administrative Impressum excluded | 1 |
| **Canonical instructional pages** | **459** |

Every source row is classified. The four detail URLs belong to kits 135, 140, 179, and 590. Kit 590 has four detail rows across the two captures: one unique non-instructional URL and three content-equivalent aliases. No conflicting instructional duplicate exists, and no Kit Details or Impressum URL is canonical.

## Canonical route and book inventory

| Kit | Source Book ID | Canonical Book ID | Title | Canonical route | Combined rows | Pages |
| ---: | --- | --- | --- | --- | ---: | ---: | --- |
${Object.values(grade3EstonianVariants).map((variant) => `| ${variant.kit_id} | \`${variant.source_book_id}\` | \`${variant.canonical_book_id}\` | ${variant.title} | \`${variant.route_id}\` | ${variant.source_records} | ${variant.canonical_records} |`).join('\n')}

The first-language route allows only kits 135, 179, and 590 and forbids kit 140. The second-language route allows only kit 140 and forbids kits 135, 179, and 590. All four books use Estonian page text, so subject routing follows Source Book ID, kit identity, Kit Details title, complete book identity, chapter context, and captured source-filter evidence rather than language alone.

Publisher metadata is absent and is not invented.

## Kit 590 completion

The shared capture supplies two cover/detail rows and no kit 590 chapters. The dedicated capture supplies two more detail rows and **42 unique instructional chapters**, distributed by section as **2 / 12 / 12 / 15 / 1**. The dedicated capture is the sole canonical page-level source; shared cover evidence remains in QA without duplicating the detail URL.

Kit 590 is no longer cover-only. A full recapture is not required. A future task-body-only capture is optional if exact image-based exercises are needed.

## Grade and subject normalization

Kits 135 and 179 are exported as grade 2. Their Kit Details titles, Source Book IDs, kit identities, visible book titles, and chapter context identify grade 3, so their **363** instructional pages are normalized to grade 3. Kits 140 and 590 already report grade 3. Raw and canonical distributions and every decision remain in QA.

All **470** source rows carry the automatic subject \`mathematics / matemaatika / математика\`. First-language pages are normalized to \`Estonian language / eesti keel / эстонский язык\`; kit 140 is normalized to \`Estonian as a second language / eesti keel teise keelena / эстонский язык как второй\`. Generated mathematics aliases are removed from topic arrays while genuine instructional terms are retained.

## Language decisions

The shared compact distribution is et 424, en 1, ru 1; all 44 dedicated kit 590 compact rows are et. The two isolated shared anomalies are normalized from page evidence:

- https://www.opiq.ee/kit/135/chapter/7352 — raw \`en\`; title and every captured heading are Estonian, with no English instructional text.
- https://www.opiq.ee/kit/140/chapter/7788 — raw \`ru\`; the page is Estonian-language instruction with one retained Russian vocabulary gloss, \`tigu – улитка\`.

Raw per-book JSON says \`ru\` for all books, including kit 590, while both compact indexes and all 42 kit 590 instructional rows say \`et\`. The conflict is retained as a source anomaly; canonical page language follows the compact and page-level Estonian evidence.

## Technical content repairs

${allRepairs.length} pages receive deterministic text-only normalization supported by the same archive record. Repair categories: ${Object.entries(repairCategories).map(([key, count]) => `${key}=${count}`).join(', ') || 'none'}. The generator removes discretionary soft hyphens, replaces zero-width spacing controls with spaces, applies NFC, and collapses whitespace. It does not rewrite educational prose or invent headings or tasks. Exact URLs, fields, source values, and canonical values are stored in the QA snapshots.

Every canonical page has a title and at least one heading. **${firstQa.kit_590_content_quality_audit.platform_heading_occurrences_filtered}** raw kit 590 platform-boilerplate occurrences (\`Õpetaja lisatud materjal\`, \`Minu lisatud materjal\`, \`Seotud sisu\`) are filtered deterministically; numbered instructional headings are retained even when short.

All **459** pages lack structured task examples in the supplied compact and raw representations. Kit 590 is image-heavy and preserves numbered instructional headings; empty task arrays are therefore a capture limitation, not proof that no exercises exist. No task body is invented.

The title \`KORDAMINE\` occurs on three distinct kit 590 URLs and is retained because chapter IDs and section contexts differ:

- https://www.opiq.ee/kit/590/chapter/33265
- https://www.opiq.ee/kit/590/chapter/33277
- https://www.opiq.ee/kit/590/chapter/33293

## Limitations

- The captures prove the supplied book/page inventory, not live Opiq catalogue completeness.
- They do not establish official curriculum completeness or teaching readiness.
- Publisher metadata is absent.
- Structured task examples are absent; a targeted capture is optional only when exact task bodies are required.
`;
}

async function validateCrossRouteOwnership(manifest, catalog) {
  const targetUrls = catalog.canonical_records.map((record) => record.url);
  const otherRoutes = [];
  for (const source of manifest.sources.filter((entry) => !Object.hasOwn(grade3EstonianRoutes, entry.id))) {
    const markdown = await readFile(absolute(source.md_path), 'utf8');
    const urls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmiu)].map((match) => match[1]);
    otherRoutes.push({ source_id: source.id, urls });
  }
  assertGrade3EstonianCrossRouteOwnership(targetUrls, otherRoutes);
}

async function generate() {
  const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
  const firstSource = manifest.sources.find((source) => source.id === 'grade-3-estonian');
  const secondSource = manifest.sources.find((source) => source.id === 'grade-3-estonian-second-language');
  validateManifestGrade3EstonianRoutes(firstSource, secondSource);

  const archiveAudits = [];
  for (const definition of grade3EstonianArchives) {
    const archivePath = absolute(definition.path);
    const archiveStat = await stat(archivePath);
    assertGrade3Estonian(archiveStat.isFile(), `${definition.archive_id} is not a file.`);
    const bytes = await readFile(archivePath);
    assertGrade3EstonianArchiveIdentity(bytes, definition);
    const archive = await readCompactZip(archivePath);
    assertGrade3Estonian(
      archive.entryCount === definition.member_count,
      `${definition.archive_id} has ${archive.entryCount} members; expected ${definition.member_count}.`,
    );
    assertGrade3Estonian(
      archive.memberMetadata.size === archive.entryCount,
      `${definition.archive_id} member metadata is incomplete.`,
    );
    [...archive.entries.keys()].forEach(assertSafeMemberName);
    assertRequiredGrade3EstonianMembers(archive.entries.keys());
    assertGrade3Estonian(
      [...archive.memberMetadata.values()].every((member) => [0, 8].includes(member.compression_method)),
      `${definition.archive_id} uses an unsupported compression method.`,
    );
    const uncompressedByteSize = [...archive.memberMetadata.values()]
      .reduce((total, member) => total + member.uncompressed_size, 0);
    assertGrade3Estonian(
      uncompressedByteSize === definition.uncompressed_byte_size,
      `${definition.archive_id} uncompressed byte size is ${uncompressedByteSize}; expected ${definition.uncompressed_byte_size}.`,
    );

    const index = parseJson(readZipText(archive, 'index.json'), `${definition.archive_id}/index.json`);
    const rawIndex = parseJson(
      readZipText(archive, 'raw/Opiq-DB/index.json'),
      `${definition.archive_id}/raw/Opiq-DB/index.json`,
    );
    const records = parseGrade3Jsonl(
      readZipText(archive, 'opiq_lookup.jsonl'),
      `${definition.archive_id}/opiq_lookup.jsonl`,
    );
    const markdownRecords = parseGrade3Markdown(readZipText(archive, 'opiq_lookup.md'));
    assertCompactMarkdownMatches(records, markdownRecords);
    validateIndex(index, rawIndex, records, archive, definition);
    const representationAudit = validateRawChapters(records, archive, definition);
    const topicAudit = validateTopicMap(
      parseJson(readZipText(archive, 'topic_map.json'), `${definition.archive_id}/topic_map.json`),
      records,
      definition,
    );
    archiveAudits.push({
      definition,
      bytes,
      archive,
      records,
      markdownRecords,
      representationAudit,
      topicAudit,
    });
  }

  const sharedAudit = archiveAudits.find((audit) => audit.definition === grade3EstonianSharedArchive);
  const kit590Audit = archiveAudits.find((audit) => audit.definition === grade3EstonianKit590Archive);
  const catalog = buildGrade3EstonianCatalog(sharedAudit.records, kit590Audit.records);

  const outputs = [];
  for (const source of [firstSource, secondSource]) {
    const markdown = renderGrade3EstonianMarkdown(source.id, catalog);
    const qa = buildQa({
      routeId: source.id,
      source,
      catalog,
      archiveAudits,
      markdown,
    });
    outputs.push({
      source,
      markdown,
      qa,
      markdownPath: absolute(source.md_path),
      qaPath: absolute(source.qa_path),
    });
  }

  const audit = renderAudit(outputs[0].qa, outputs[1].qa);
  for (const output of outputs) {
    const qaText = stableJson(output.qa);
    const currentMarkdown = await readFile(output.markdownPath, 'utf8').catch(() => null);
    const currentQa = await readFile(output.qaPath, 'utf8').catch(() => null);
    if (checkOnly) {
      assertGeneratedArtifact(currentMarkdown, output.markdown, sourceLabel(output.source, 'Markdown'));
      assertGeneratedArtifact(currentQa, qaText, sourceLabel(output.source, 'QA snapshot'));
    } else {
      if (currentMarkdown !== output.markdown) await writeFile(output.markdownPath, output.markdown, 'utf8');
      if (currentQa !== qaText) await writeFile(output.qaPath, qaText, 'utf8');
    }
  }
  const currentAudit = await readFile(absolute(auditPath), 'utf8').catch(() => null);
  if (checkOnly) assertGeneratedArtifact(currentAudit, audit, 'grade-3 Estonian audit');
  else if (currentAudit !== audit) await writeFile(absolute(auditPath), audit, 'utf8');

  await validateCrossRouteOwnership(manifest, catalog);
  const firstUrls = new Set(catalog.route_records['grade-3-estonian'].map((record) => record.url));
  assertGrade3Estonian(
    catalog.route_records['grade-3-estonian-second-language'].every((record) => !firstUrls.has(record.url)),
    'The grade-3 Estonian routes overlap by URL.',
  );
  const verb = checkOnly ? 'check passed' : 'generation complete';
  console.log(`Grade 3 Estonian ${verb}: 470 source rows, 405 first-language pages, 54 second-language pages, 0 route overlaps.`);
}

function sourceLabel(source, suffix) {
  return `${source.id} ${suffix}`;
}

try {
  await generate();
} catch (error) {
  console.error(`Grade 3 Estonian generation failed: ${error.message}`);
  process.exitCode = 1;
}
