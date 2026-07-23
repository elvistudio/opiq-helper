import {
  containsUnprocessedPayload,
  normalizeQualityText,
} from './grade-2-content-quality.mjs';
import {
  assertCompactMarkdownMatches,
  assertGrade3,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  sha256Bytes,
} from './grade-3-mathematics.mjs';

export {
  assertCompactMarkdownMatches,
  assertGrade3,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  sha256Bytes,
};

export const grade3EnglishArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_english_step_by_step_1_opiq_v2.zip',
  sha256: '502bd7a8d03e0af2be85ae80f7da0b9d46a1d63c9d05bf2d772f66fd57d6f57b',
  byte_size: 1_935_103,
  uncompressed_size: 1_898_081,
  member_count: 204,
  source_records: 197,
  canonical_records: 193,
  format_version: '2.0',
  capture_timestamp: '2026-07-23T06:48:16.949Z',
});

export const grade3EnglishSubject = Object.freeze({
  en: 'english',
  et: 'inglise keel',
  ru: 'английский язык',
});

export const grade3EnglishVariants = Object.freeze({
  english_step_by_step_1: Object.freeze({
    source_book_id: 'english_step_by_step_1',
    canonical_book_id: 'english_step_by_step_1__kit452',
    kit_id: '452',
    raw_title: 'English step by step 1 – Opiq',
    canonical_title: 'English step by step 1',
    index_language: 'en',
    raw_book_language: 'ru',
    source_rows: 91,
    instructional_pages: 89,
    programme_type: 'unknown',
  }),
  'inglise_keel_3._klassile': Object.freeze({
    source_book_id: 'inglise_keel_3._klassile',
    canonical_book_id: 'inglise_keel_3._klassile__kit369',
    kit_id: '369',
    raw_title: 'High Five! 3 – Opiq',
    canonical_title: 'High Five! 3',
    index_language: 'et',
    raw_book_language: 'ru',
    source_rows: 106,
    instructional_pages: 104,
    programme_type: 'unknown',
  }),
});

export const requiredGrade3EnglishMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

const rawSubject = 'mathematics / matemaatika / математика';
const directUrl = /^https:\/\/www\.opiq\.ee\/kit\/(?:369|452)\/chapter\/\d+$/u;
const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const invisibleCharacters = /[\u00ad\u200b-\u200d\u2060\ufeff]/u;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

export function sourceIdentity(record) {
  return `${record.book_id}\u0000${record.chapter_id}`;
}

export function kitId(recordOrUrl) {
  const url = typeof recordOrUrl === 'string' ? recordOrUrl : recordOrUrl.url;
  return url.match(/\/kit\/(\d+)/iu)?.[1] ?? url.match(/\/Kit\/Details\/(\d+)/u)?.[1] ?? '';
}

export function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = String(selector(record));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function groupBy(records, selector) {
  const result = new Map();
  for (const record of records) {
    const key = selector(record);
    result.set(key, [...(result.get(key) ?? []), record]);
  }
  return result;
}

export function assertArchiveIdentity(bytes) {
  assertGrade3(
    bytes.length === grade3EnglishArchive.byte_size,
    `Original archive byte size is ${bytes.length}; expected ${grade3EnglishArchive.byte_size}.`,
  );
  const checksum = sha256Bytes(bytes);
  assertGrade3(
    checksum === grade3EnglishArchive.sha256,
    `Original archive checksum is ${checksum}; expected ${grade3EnglishArchive.sha256}.`,
  );
}

export function assertSafeMemberName(name) {
  assertGrade3(typeof name === 'string' && name.length > 0, 'ZIP member name must be non-empty.');
  assertGrade3(!name.startsWith('/') && !/^[A-Za-z]:[\\/]/u.test(name), `ZIP member has an absolute path: ${name}`);
  assertGrade3(!name.includes('\\'), `ZIP member contains a backslash: ${name}`);
  assertGrade3(!name.split('/').includes('..'), `ZIP member traverses outside the archive: ${name}`);
}

export function assertRequiredMembers(memberNames) {
  const names = new Set(memberNames);
  requiredGrade3EnglishMembers.forEach((name) => {
    assertGrade3(names.has(name), `Original archive is missing required member ${name}.`);
  });
}

export function auditZipMemberNames(memberMetadata) {
  const entries = [...memberMetadata.values()];
  assertGrade3(entries.length === grade3EnglishArchive.member_count, 'ZIP member-name count changed.');
  assertGrade3(entries.every((entry) => entry.utf8_filename_flag === false), 'A ZIP member unexpectedly sets the UTF-8 filename flag.');
  assertGrade3(entries.every((entry) => Buffer.from(entry.stored_name_hex, 'hex').every((byte) => byte < 0x80)), 'A ZIP member name is not ASCII.');
  assertGrade3(new Set(entries.map((entry) => entry.stored_name_hex)).size === entries.length, 'Stored ZIP member names are not unique.');
  return {
    member_count: entries.length,
    ascii_only_names: entries.length,
    utf8_flag_set: 0,
    utf8_flag_absent: entries.length,
    stored_name_collisions: 0,
  };
}

export function isKitDetail(record) {
  return /^https:\/\/www\.opiq\.ee\/Kit\/Details\/(?:369|452)$/u.test(record.url);
}

function normalizeList(values) {
  return values.map(normalizeQualityText).filter(Boolean);
}

function normalizeTopics(values, field) {
  const forbidden = {
    topics_en: 'mathematics',
    topics_et: 'matemaatika',
    topics_ru: 'математика',
  }[field];
  const required = {
    topics_en: grade3EnglishSubject.en,
    topics_et: grade3EnglishSubject.et,
    topics_ru: grade3EnglishSubject.ru,
  }[field];
  const retained = normalizeList(values).filter(
    (value) => value.toLocaleLowerCase() !== forbidden,
  );
  return [
    required,
    ...retained.filter((value) => value.toLocaleLowerCase() !== required.toLocaleLowerCase()),
  ];
}

export function validateRawChapters(sourceRecords, archive, readZipText) {
  const members = [...archive.entries.keys()].filter((name) => name.startsWith('raw/Opiq-DB/chapters/'));
  assertGrade3(members.length === 197, `Raw chapter count is ${members.length}; expected 197.`);
  const rawByIdentity = new Map();
  const headingsByKit = { 369: 0, 452: 0 };
  const imagesByKit = { 369: 0, 452: 0 };
  let taskRows = 0;
  for (const member of members) {
    const raw = JSON.parse(readZipText(archive, member));
    assertGrade3(isPlainObject(raw), `${member} must contain an object.`);
    const identity = `${raw.bookId}\u0000${raw.chapterId}`;
    assertGrade3(!rawByIdentity.has(identity), `Duplicate raw chapter identity ${identity}.`);
    assertGrade3(Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images), `${member} lacks raw arrays.`);
    const kit = kitId(raw.url);
    assertGrade3(Object.hasOwn(headingsByKit, kit), `${member} is outside kits 369/452.`);
    headingsByKit[kit] += raw.headings.length;
    imagesByKit[kit] += raw.images.length;
    if (raw.tasks.length > 0) taskRows += 1;
    rawByIdentity.set(identity, { member, raw });
  }
  for (const record of sourceRecords) {
    const entry = rawByIdentity.get(sourceIdentity(record));
    assertGrade3(entry, `Raw chapter is missing for ${sourceIdentity(record)}.`);
    const { raw, member } = entry;
    assertGrade3(normalizeQualityText(raw.chapterTitle) === record.title, `${member} title differs from compact data.`);
    assertGrade3(raw.url === record.url, `${member} URL differs from compact data.`);
    const headings = new Set(raw.headings.map((entry) => normalizeQualityText(entry.text)));
    assertGrade3(record.headings.every((heading) => headings.has(normalizeQualityText(heading))), `${member} compact heading is missing from raw data.`);
    assertGrade3(record.task_examples.length === 0 && raw.tasks.length === 0, `${member} unexpectedly contains structured tasks.`);
  }
  assertGrade3(headingsByKit[452] === 1780 && headingsByKit[369] === 4066, `Raw heading counts differ: ${JSON.stringify(headingsByKit)}.`);
  assertGrade3(imagesByKit[452] === 289 && imagesByKit[369] === 3731, `Raw image counts differ: ${JSON.stringify(imagesByKit)}.`);
  assertGrade3(taskRows === 0, 'Raw structured task arrays are unexpectedly populated.');
  return {
    raw_by_identity: rawByIdentity,
    audit: {
      raw_chapter_records: members.length,
      headings_by_kit: headingsByKit,
      images_by_kit: imagesByKit,
      raw_task_rows: taskRows,
      compact_headings_missing_from_raw: 0,
      unexplained_differences: 0,
    },
  };
}

function variantFor(record) {
  return grade3EnglishVariants[record.book_id];
}

function normalizeInstructionalRecord(record) {
  const variant = variantFor(record);
  assertGrade3(variant, `Unknown English Source Book ID ${record.book_id}.`);
  assertGrade3(kitId(record) === variant.kit_id, `${record.url} has the wrong kit identity.`);
  assertGrade3(record.book === variant.raw_title, `${record.url} captured book title differs.`);
  assertGrade3(record.grade === 3, `${record.url} captured grade differs.`);
  assertGrade3(record.publisher === '', `${record.url} unexpectedly has publisher metadata.`);
  assertGrade3(sourceSubject(record) === rawSubject, `${record.url} raw subject anomaly differs.`);
  assertGrade3(record.task_examples.length === 0, `${record.url} unexpectedly has compact tasks.`);
  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: variant.canonical_title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.source_book_id,
    chapter_id: String(record.chapter_id),
    grade: 3,
    subject_en: grade3EnglishSubject.en,
    subject_et: grade3EnglishSubject.et,
    subject_ru: grade3EnglishSubject.ru,
    language: record.language,
    publisher: '',
    programme_type: 'unknown',
    kit_id: variant.kit_id,
    topics_et: normalizeTopics(record.topics_et, 'topics_et'),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru'),
    topics_en: normalizeTopics(record.topics_en, 'topics_en'),
    headings: normalizeList(record.headings),
    task_examples: [],
  };
  validateCanonicalRecord(canonical);
  return canonical;
}

export function validateCanonicalRecord(record) {
  assertGrade3(directUrl.test(record.url), `${record.url} is not a direct canonical English chapter URL.`);
  assertGrade3(record.kit_id === kitId(record), `${record.url} kit field differs.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade differs.`);
  assertGrade3(sourceSubject(record) === 'english / inglise keel / английский язык', `${record.url} canonical subject differs.`);
  const variant = Object.values(grade3EnglishVariants).find((entry) => entry.kit_id === record.kit_id);
  assertGrade3(variant && record.book_id === variant.canonical_book_id, `${record.url} canonical Book ID differs.`);
  assertGrade3(record.source_book_id === variant.source_book_id && record.book === variant.canonical_title, `${record.url} source identity differs.`);
  assertGrade3(['en', 'et', 'ru'].includes(record.language), `${record.url} has unsupported page language ${record.language}.`);
  assertGrade3(record.publisher === '', `${record.url} publisher must remain empty.`);
  assertGrade3(record.programme_type === 'unknown', `${record.url} programme type must remain unknown.`);
  assertGrade3(record.title.length > 0 && record.headings.length > 0, `${record.url} has empty title/headings.`);
  assertGrade3(record.task_examples.length === 0, `${record.url} contains invented tasks.`);
  const text = [
    record.title, record.book, record.book_id, record.source_book_id,
    ...record.topics_et, ...record.topics_ru, ...record.topics_en, ...record.headings,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains Unicode replacement data.`);
  assertGrade3(!forbiddenControls.test(text) && !invisibleCharacters.test(text), `${record.url} contains forbidden controls.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed payload.`);
  assertGrade3(
    !record.topics_en.includes('mathematics')
      && !record.topics_et.includes('matemaatika')
      && !record.topics_ru.includes('математика'),
    `${record.url} retains a generated mathematics alias.`,
  );
}

function differingFields(records) {
  const fields = [
    'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
    'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en',
    'headings', 'task_examples',
  ];
  return fields.filter((field) => records.some(
    (record) => JSON.stringify(record[field]) !== JSON.stringify(records[0][field]),
  ));
}

export function buildCatalog(sourceRecords) {
  assertGrade3(sourceRecords.length === 197, `Source row count is ${sourceRecords.length}; expected 197.`);
  const duplicateGroups = [...groupBy(sourceRecords, (record) => record.url).entries()]
    .filter(([, rows]) => rows.length > 1);
  assertGrade3(duplicateGroups.length === 2, `Duplicate URL group count is ${duplicateGroups.length}; expected 2.`);
  const duplicateAudit = duplicateGroups.map(([url, rows]) => {
    const differences = differingFields(rows);
    assertGrade3(rows.length === 2 && rows.every(isKitDetail), `${url} is not an audited details duplicate.`);
    assertGrade3(JSON.stringify(differences) === JSON.stringify(['chapter_id']), `${url} duplicate rows conflict.`);
    return {
      url,
      kit_id: kitId(url),
      chapter_ids: rows.map((row) => String(row.chapter_id)),
      differing_fields: differences,
      decision: 'exclude_both_cover_detail_records',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));
  const details = sourceRecords.filter(isKitDetail);
  const canonical = sourceRecords.filter((record) => !isKitDetail(record)).map(normalizeInstructionalRecord);
  assertGrade3(details.length === 4 && canonical.length === 193, 'Source accounting differs from 193 pages + 4 details.');
  assertGrade3(new Set(canonical.map((record) => record.url)).size === 193, 'Canonical English URLs are not unique.');
  const repeatedTitleGroups = [...groupBy(canonical, (record) => record.title).entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([title, rows]) => ({
      title,
      urls: rows.map((row) => row.url).sort(),
      decision: 'retain_distinct_canonical_chapters',
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  assertGrade3(
    JSON.stringify(repeatedTitleGroups.map((entry) => entry.title))
      === JSON.stringify(['Definitions', 'Let’s Practise!']),
    `Repeated-title groups differ: ${repeatedTitleGroups.map((entry) => entry.title).join(', ')}`,
  );
  return {
    canonical_records: canonical,
    cover_detail_records: details,
    duplicate_url_audit: duplicateAudit,
    repeated_title_groups: repeatedTitleGroups,
  };
}

function markdownValue(values) {
  return values.join('; ');
}

function markdownField(label, value) {
  return value ? `- ${label}: ${value}` : `- ${label}:`;
}

export function renderMarkdown(catalog) {
  const lines = [
    '# Opiq lookup: grade 3 English',
    '',
    'Use this file only for grade 3 English requests. Do not substitute mathematics, Estonian-language, Russian-language, or adjacent-grade material.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3EnglishArchive.path}\``,
    `- Archive SHA-256: \`${grade3EnglishArchive.sha256}\``,
    `- Capture timestamp: ${grade3EnglishArchive.capture_timestamp}`,
    '- Class: 3',
    '- Subject: english / inglise keel / английский язык',
    '- Languages: en, et, ru (page-level values preserved)',
    '- Canonical pages: 193',
    '- Programme type: unknown (not inferred from the capture)',
    '- Publisher: not captured; no publisher is invented',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
    '- `english_step_by_step_1__kit452` — English step by step 1; Source Book ID `english_step_by_step_1`; kit 452; 89 pages.',
    '- `inglise_keel_3._klassile__kit369` — High Five! 3; Source Book ID `inglise_keel_3._klassile`; kit 369; 104 pages.',
    '',
    '## Pages',
    '',
  ];
  catalog.canonical_records.forEach((record, index) => {
    lines.push(
      `### ${index + 1}. ${record.title}`,
      `- URL: ${record.url}`,
      `- Book: ${record.book}`,
      `- Book ID: ${record.book_id}`,
      `- Source Book ID: ${record.source_book_id}`,
      `- Chapter ID: ${record.chapter_id}`,
      `- Class: ${record.grade}`,
      `- Language: ${record.language}`,
      markdownField('Publisher', record.publisher),
      `- Subject: ${sourceSubject(record)}`,
      `- Programme type: ${record.programme_type}`,
      markdownField('Topics ET', markdownValue(record.topics_et)),
      markdownField('Topics RU', markdownValue(record.topics_ru)),
      markdownField('Topics EN', markdownValue(record.topics_en)),
      markdownField('Headings', markdownValue(record.headings)),
      markdownField('Task examples', markdownValue(record.task_examples)),
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function validateManifestSource(source) {
  assertGrade3(source?.id === 'grade-3-english', 'Manifest grade-3 English route is missing.');
  assertGrade3(source.grade === 3 && source.grade_group === '1-4', 'Manifest grade/group differs.');
  assertGrade3(source.subject === 'english' && source.subject_et === 'inglise keel', 'Manifest subject differs.');
  assertGrade3(JSON.stringify(source.languages) === JSON.stringify(['en', 'et', 'ru']), 'Manifest languages differ.');
  assertGrade3(source.md_path === 'project-files/outputs/opiq_3klass_inglise_keel.md', 'Manifest md_path differs.');
  assertGrade3(source.source_archive === grade3EnglishArchive.path, 'Manifest archive differs.');
  assertGrade3(source.qa_path === 'project-files/outputs/opiq_3klass_inglise_keel_qa.json', 'Manifest qa_path differs.');
  assertGrade3(source.record_count === 193 && source.format_version === '2.0', 'Manifest count/version differs.');
  assertGrade3(JSON.stringify(source.source_scope?.included_kit_ids) === JSON.stringify(['369', '452']), 'Manifest kit scope differs.');
  assertGrade3(source.source_scope?.programme_type === 'unknown', 'Manifest programme type must be unknown.');
  assertGrade3(source.canonical_url_policy?.require_unique === true, 'Manifest URL policy differs.');
  assertGrade3(
    JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(grade3EnglishSubject),
    'Manifest canonical subject policy differs.',
  );
}

export function auditCanonicalContentQuality(records) {
  const hardErrors = {
    replacement_character: 0,
    forbidden_control_character: 0,
    invisible_character: 0,
    html_mathml_or_json_payload: 0,
    malformed_url: 0,
    missing_title: 0,
    missing_headings: 0,
  };
  for (const record of records) {
    const text = [record.title, record.book, ...record.headings, ...record.topics_et, ...record.topics_en].join('\n');
    if (text.includes('\ufffd')) hardErrors.replacement_character += 1;
    if (forbiddenControls.test(text)) hardErrors.forbidden_control_character += 1;
    if (invisibleCharacters.test(text)) hardErrors.invisible_character += 1;
    if (containsUnprocessedPayload(text)) hardErrors.html_mathml_or_json_payload += 1;
    if (!directUrl.test(record.url)) hardErrors.malformed_url += 1;
    if (!record.title.trim()) hardErrors.missing_title += 1;
    if (record.headings.length === 0) hardErrors.missing_headings += 1;
  }
  assertGrade3(Object.values(hardErrors).every((count) => count === 0), 'Canonical English content has hard errors.');
  const languageCounts = countBy(records, (record) => record.language);
  assertGrade3(JSON.stringify(languageCounts) === JSON.stringify({ en: 122, et: 67, ru: 4 }), `Page language counts differ: ${JSON.stringify(languageCounts)}.`);
  return {
    hard_errors: hardErrors,
    classified_warnings: {
      empty_task_examples: {
        records: 193,
        classification: 'capture_limitation_confirmed_in_compact_and_raw_arrays',
      },
      missing_publisher: {
        records: 193,
        classification: 'source_metadata_absent_do_not_invent',
      },
      programme_type_unknown: {
        records: 193,
        classification: 'not_verifiable_from_supplied_capture',
      },
      repeated_titles: {
        records: 18,
        groups: 2,
        classification: 'distinct_direct_urls_retained',
      },
      source_book_language_anomaly: {
        raw_book_objects_ru: 2,
        canonical_page_languages: languageCounts,
        classification: 'page_level_language_is_authoritative_raw_anomaly_preserved',
      },
    },
  };
}

export function assertGeneratedArtifact(current, expected, artifactPath) {
  assertGrade3(current === expected, `${artifactPath} is stale; run the grade-3 English generator.`);
}
