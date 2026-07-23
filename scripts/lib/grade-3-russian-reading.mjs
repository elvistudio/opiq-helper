import { createHash } from 'node:crypto';

import {
  containsUnprocessedPayload,
  normalizeQualityText,
  sanitizeCapturedTaskExample,
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

export const grade3RussianReadingArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_3_acca_opiq_v2.zip',
  sha256: '3e1fbd8a209ca151111b0754811c293b9f6bbc796965d2db542cbd02fe13dcca',
  byte_size: 369_819,
  member_count: 63,
  format_version: '2.0',
  capture_timestamp: '2026-07-23T06:08:40.176Z',
  source_records: 57,
  canonical_records: 55,
});

export const requiredGrade3RussianReadingMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

export const grade3RussianReadingVariant = Object.freeze({
  source_book_id: 'русское_слово._чтение_для_3_клacca',
  kit_id: '504',
  canonical_book_id: 'русское_слово._чтение_для_3_класса__kit504',
  raw_title: 'РУССКОЕ СЛОВО. Чтение для 3 клacca – Opiq',
  canonical_title: 'РУССКОЕ СЛОВО. Чтение для 3 класса',
  publisher: '',
  language: 'ru',
  programme_type: 'ordinary_curriculum',
  source_rows: 57,
  canonical_records: 55,
  publisher_provenance: 'Publisher is absent from the original archive and is not invented.',
});

export const grade3RussianReadingSubject = Object.freeze({
  en: 'Russian reading',
  et: 'vene keele lugemine',
  ru: 'чтение на русском языке',
});

const rawSubject = 'mathematics / matemaatika / математика';
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const invisiblePattern = /[\u00ad\u200b-\u200d\u2060\ufeff]/u;
const generatedSubjectAliases = Object.freeze({
  topics_et: new Set(['matemaatika']),
  topics_ru: new Set(['математика']),
  topics_en: new Set(['mathematics']),
});
const requiredSubjectAliases = Object.freeze({
  topics_et: grade3RussianReadingSubject.et,
  topics_ru: grade3RussianReadingSubject.ru,
  topics_en: grade3RussianReadingSubject.en,
});

export function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
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

export function assertGrade3RussianReadingArchiveIdentity(bytes) {
  assertGrade3(
    bytes.length === grade3RussianReadingArchive.byte_size,
    `Original archive byte size is ${bytes.length}; expected ${grade3RussianReadingArchive.byte_size}.`,
  );
  const actual = sha256Bytes(bytes);
  assertGrade3(
    actual === grade3RussianReadingArchive.sha256,
    `Original archive checksum is ${actual}; expected ${grade3RussianReadingArchive.sha256}.`,
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
  requiredGrade3RussianReadingMembers.forEach((name) => {
    assertGrade3(names.has(name), `Original archive is missing required member ${name}.`);
  });
}

export function isKitDetail(record) {
  return /\/Kit\/Details\/504$/u.test(record.url);
}

function groupBy(records, selector) {
  const result = new Map();
  for (const record of records) {
    const key = selector(record);
    const group = result.get(key) ?? [];
    group.push(record);
    result.set(key, group);
  }
  return result;
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

function normalizeList(values) {
  return [...new Set(values.map(normalizeQualityText).filter(Boolean))];
}

function normalizeTasks(values) {
  return [...new Set(values.map((value) => {
    const withoutFramedJson = sanitizeCapturedTaskExample(value).text;
    return normalizeQualityText(withoutFramedJson.replace(/<[^>]+>/gu, ' '));
  }).filter(Boolean))];
}

function normalizeTopics(values, field) {
  const forbidden = generatedSubjectAliases[field];
  const required = requiredSubjectAliases[field];
  const retained = normalizeList(values).filter(
    (value) => !forbidden.has(value.toLocaleLowerCase()),
  );
  return [
    required,
    ...retained.filter((value) => value.toLocaleLowerCase() !== required.toLocaleLowerCase()),
  ];
}

function repairDetails(source, canonical) {
  const fields = [
    'book', 'book_id', 'subject_en', 'subject_et', 'subject_ru',
    'topics_et', 'topics_ru', 'topics_en', 'title', 'headings', 'task_examples',
  ];
  const changes = fields.flatMap((field) => (
    JSON.stringify(source[field]) === JSON.stringify(canonical[field])
      ? []
      : [{
        field,
        raw_sha256: createHash('sha256').update(JSON.stringify(source[field])).digest('hex'),
        canonical_sha256: createHash('sha256').update(JSON.stringify(canonical[field])).digest('hex'),
      }]
  ));
  if (changes.length === 0) return null;
  const serialized = JSON.stringify(source);
  const categories = [];
  if (/клacca/u.test(source.book)) categories.push('mixed_script_book_title_repaired');
  if (/[\u200b-\u200d\u2060\ufeff]/u.test(serialized)) categories.push('invisible_spacing_control_removed');
  if (/\u00ad/u.test(serialized)) categories.push('discretionary_soft_hyphen_removed');
  if (changes.some((change) => change.field.startsWith('topics_'))) {
    categories.push('generated_subject_alias_replaced');
  }
  if (changes.some((change) => change.field.startsWith('subject_'))) {
    categories.push('canonical_subject_normalized');
  }
  if (changes.some((change) => change.field === 'book_id')) {
    categories.push('source_book_plus_kit_identity_assigned');
  }
  return {
    url: canonical.url,
    source_book_id: canonical.source_book_id,
    kit_id: canonical.kit_id,
    categories: [...new Set(categories)],
    changes,
    evidence: 'The same committed source row, Kit Details title, Source Book ID, grade metadata, and all-literary chapter sequence support the deterministic canonical values.',
    transformation: 'NFC; remove soft hyphens and zero-width spacing controls; collapse whitespace; correct the mixed Latin-lookalike word клacca to класса in the canonical book identity; replace generated mathematics aliases with Russian-reading aliases.',
  };
}

function normalizeInstructionalRecord(record) {
  const variant = grade3RussianReadingVariant;
  assertGrade3(
    record.book_id === variant.source_book_id,
    `Unknown grade-3 Russian-reading Source Book ID: ${record.book_id}`,
  );
  assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside audited kit 504.`);
  assertGrade3(record.book === variant.raw_title, `${record.url} captured book title changed.`);
  assertGrade3(record.grade === 3, `${record.url} raw grade must be 3.`);
  assertGrade3(record.language === 'ru', `${record.url} source language must be ru.`);
  assertGrade3(record.publisher === '', `${record.url} unexpectedly contains publisher metadata.`);
  assertGrade3(
    sourceSubject(record) === rawSubject,
    `${record.url} raw subject differs from the audited exporter mathematics error.`,
  );

  const canonical = {
    ...record,
    title: normalizeQualityText(record.title),
    book: variant.canonical_title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.source_book_id,
    kit_id: variant.kit_id,
    grade: 3,
    language: variant.language,
    publisher: variant.publisher,
    programme_type: variant.programme_type,
    subject_en: grade3RussianReadingSubject.en,
    subject_et: grade3RussianReadingSubject.et,
    subject_ru: grade3RussianReadingSubject.ru,
    topics_et: normalizeTopics(record.topics_et, 'topics_et'),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru'),
    topics_en: normalizeTopics(record.topics_en, 'topics_en'),
    headings: normalizeList(record.headings),
    task_examples: normalizeTasks(record.task_examples),
  };
  delete canonical.source_sequence;
  const repair = repairDetails(record, canonical);
  validateCanonicalGrade3RussianReadingRecord(canonical);
  return { canonical, repair };
}

export function validateCanonicalGrade3RussianReadingRecord(record) {
  const match = record.url.match(directChapterUrl);
  assertGrade3(match, `${record.url} is not a direct canonical Opiq chapter URL.`);
  assertGrade3(match[1] === grade3RussianReadingVariant.kit_id, `${record.url} URL kit differs.`);
  assertGrade3(record.kit_id === grade3RussianReadingVariant.kit_id, `${record.url} canonical kit differs.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3(
    sourceSubject(record) === `${grade3RussianReadingSubject.en} / ${grade3RussianReadingSubject.et} / ${grade3RussianReadingSubject.ru}`,
    `${record.url} canonical subject must be Russian reading.`,
  );
  assertGrade3(record.language === 'ru', `${record.url} canonical language must be ru.`);
  assertGrade3(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  assertGrade3(
    record.book_id === grade3RussianReadingVariant.canonical_book_id,
    `${record.url} canonical Book ID differs.`,
  );
  assertGrade3(
    record.source_book_id === grade3RussianReadingVariant.source_book_id,
    `${record.url} Source Book ID differs.`,
  );
  assertGrade3(
    record.book === grade3RussianReadingVariant.canonical_title,
    `${record.url} canonical book title differs.`,
  );
  assertGrade3(record.publisher === '', `${record.url} publisher is not source-supported.`);
  assertGrade3(
    record.programme_type === grade3RussianReadingVariant.programme_type,
    `${record.url} programme type differs.`,
  );
  const text = [
    record.title, record.book, record.book_id, record.source_book_id, record.publisher,
    ...record.topics_et, ...record.topics_ru, ...record.topics_en, ...record.headings,
    ...record.task_examples,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3(!invisiblePattern.test(text), `${record.url} contains an invisible or discretionary control character.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
  assertGrade3(
    !record.topics_et.includes('matemaatika')
      && !record.topics_ru.includes('математика')
      && !record.topics_en.includes('mathematics'),
    `${record.url} retains a generated mathematics topic alias.`,
  );
}

export function buildGrade3RussianReadingCatalog(sourceRecords) {
  assertGrade3(
    sourceRecords.length === grade3RussianReadingArchive.source_records,
    `Original archive has ${sourceRecords.length} source records; expected ${grade3RussianReadingArchive.source_records}.`,
  );
  const duplicateGroups = [...groupBy(sourceRecords, (record) => record.url).entries()]
    .filter(([, records]) => records.length > 1);
  assertGrade3(
    duplicateGroups.length === 1,
    `Original archive has ${duplicateGroups.length} duplicate URL groups; expected 1.`,
  );
  const duplicateAudit = duplicateGroups.map(([url, records]) => {
    assertGrade3(records.length === 2, `${url} duplicate group must contain two rows.`);
    assertGrade3(records.every(isKitDetail), `${url} duplicate group is not limited to Kit Details.`);
    const differing = differingFields(records);
    assertGrade3(
      JSON.stringify(differing) === JSON.stringify(['chapter_id']),
      `${url} duplicate rows conflict in fields: ${differing.join(', ') || '<none>'}.`,
    );
    return {
      url,
      kit_id: grade3RussianReadingVariant.kit_id,
      source_book_id: grade3RussianReadingVariant.source_book_id,
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_duplicate_alias_and_unique_kit_detail',
    };
  });

  const canonicalRecords = [];
  const coverDetails = [];
  const duplicateAliases = [];
  const contentRepairs = [];
  let detailSeen = false;
  for (const record of sourceRecords) {
    assertGrade3(
      record.book_id === grade3RussianReadingVariant.source_book_id,
      `Unknown grade-3 Russian-reading Source Book ID: ${record.book_id}`,
    );
    if (isKitDetail(record)) {
      if (detailSeen) duplicateAliases.push(record);
      else {
        detailSeen = true;
        coverDetails.push(record);
      }
      continue;
    }
    const { canonical, repair } = normalizeInstructionalRecord(record);
    canonicalRecords.push(canonical);
    if (repair) contentRepairs.push(repair);
  }

  assertGrade3(coverDetails.length === 1, `Unique Kit Details count is ${coverDetails.length}; expected 1.`);
  assertGrade3(duplicateAliases.length === 1, `Duplicate Kit Details count is ${duplicateAliases.length}; expected 1.`);
  assertGrade3(
    canonicalRecords.length === grade3RussianReadingArchive.canonical_records,
    `Canonical count is ${canonicalRecords.length}; expected ${grade3RussianReadingArchive.canonical_records}.`,
  );
  assertGrade3(
    canonicalRecords.length + coverDetails.length + duplicateAliases.length === sourceRecords.length,
    'Not every source row was classified.',
  );
  assertGrade3(
    new Set(canonicalRecords.map((record) => record.url)).size === canonicalRecords.length,
    'Canonical grade-3 Russian-reading URLs are not unique.',
  );

  return {
    canonical_records: canonicalRecords,
    exclusions: {
      cover_details: coverDetails,
      duplicate_aliases: duplicateAliases,
      administrative: [],
      search_results: [],
    },
    duplicate_audit: duplicateAudit,
    content_repairs: contentRepairs,
  };
}

function markdownValue(values) {
  return values.join('; ');
}

function markdownField(label, value) {
  return value ? `- ${label}: ${value}` : `- ${label}:`;
}

export function renderGrade3RussianReadingMarkdown(catalog) {
  const records = catalog.canonical_records;
  const variant = grade3RussianReadingVariant;
  const lines = [
    '# Opiq lookup: grade 3 Russian reading',
    '',
    'Use this file only for grade 3 Russian-reading source requests. Do not mix it with Russian grammar, mathematics, or translated neighbouring subjects.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3RussianReadingArchive.path}\``,
    `- Archive SHA-256: \`${grade3RussianReadingArchive.sha256}\``,
    `- Capture timestamp: ${grade3RussianReadingArchive.capture_timestamp}`,
    `- Format version: ${grade3RussianReadingArchive.format_version}`,
    '- Class: 3',
    `- Subject: ${grade3RussianReadingSubject.en} / ${grade3RussianReadingSubject.et} / ${grade3RussianReadingSubject.ru}`,
    '- Page language: Russian',
    `- Source records: ${grade3RussianReadingArchive.source_records}`,
    `- Page records included: ${records.length}`,
    '- Unique Kit Details excluded: 1',
    '- Duplicate Kit Details alias excluded: 1',
    '- Subject normalization: automatic mathematics metadata is replaced using the Source Book ID, Kit Details title, literary headings, and complete chapter sequence.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
    `- \`${variant.canonical_book_id}\` — ${variant.canonical_title}; Source Book ID \`${variant.source_book_id}\`; kit ${variant.kit_id}; publisher not captured; ru; ${variant.canonical_records} pages; ${variant.programme_type}.`,
    '',
    '## Pages',
    '',
  ];
  records.forEach((record, index) => {
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

export function validateManifestGrade3RussianReadingSource(source) {
  assertGrade3(source?.id === 'grade-3-russian-reading', 'Manifest grade-3 Russian-reading route is missing.');
  assertGrade3(source.grade === 3 && source.grade_group === '1-4', 'Manifest grade/group differs.');
  assertGrade3(
    source.subject === 'russian_reading' && source.subject_et === grade3RussianReadingSubject.et,
    'Manifest subject differs.',
  );
  assertGrade3(JSON.stringify(source.languages) === JSON.stringify(['ru']), 'Manifest languages must contain ru only.');
  assertGrade3(
    source.source_archive === grade3RussianReadingArchive.path,
    'Manifest must use the original grade-3 Russian-reading archive.',
  );
  assertGrade3(
    source.record_count === grade3RussianReadingArchive.canonical_records,
    `Manifest record_count must be ${grade3RussianReadingArchive.canonical_records}.`,
  );
  assertGrade3(
    JSON.stringify(source.source_scope?.included_kit_ids) === JSON.stringify(['504']),
    'Manifest source scope must contain kit 504 only.',
  );
}

export function assertGeneratedArtifact(current, expected, label) {
  assertGrade3(current === expected, `${label} is stale.`);
}
