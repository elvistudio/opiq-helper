import { createHash } from 'node:crypto';

import {
  containsUnprocessedPayload,
  normalizeQualityText,
  sanitizeCapturedTaskExample,
} from './grade-2-content-quality.mjs';

export const grade3MathematicsArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_matemaatika_3_klassile_opiq_v2.zip',
  sha256: '44ef9fafb11084288f68cb970f96393fb5e41e46810bbe080ba711377649c486',
  byte_size: 7_911_532,
  member_count: 657,
  format_version: '2.0',
  capture_timestamp: '2026-07-22T19:51:37.588Z',
  source_records: 643,
  canonical_records: 619,
});

export const historicalGrade3MathematicsArchive = Object.freeze({
  path: 'project-files/outputs/3klass-matem-compact.zip',
  sha256: '15d1dea7d6c935df484387aaa38a7b4965ac87f7f1b5356d53542a5019440f11',
  canonical_markdown_sha256: '9271abb60ddecf3d34172c5ca4d1c107ab81a6eb64539cd663d5185d4041a9ab',
  source_records: 637,
  canonical_records: 634,
});

export const requiredOriginalMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

const variants = [
  ['matemaatika_3._klassile', '54', 'matemaatika_3._klassile__kit54', 'Matemaatika 3. klassile', 'Avita', 'et', 'ordinary_curriculum', 140],
  ['matemaatika_3._klassile_2023_õk', '531', 'matemaatika_3._klassile_2023_õk__kit531', 'Matemaatika 3. klassile 2023 ÕK', 'Avita', 'et', 'ordinary_curriculum', 140],
  ['математика_для_3_класса', '92', 'математика_для_3_класса__kit92', 'Математика для 3 класса', 'Avita', 'ru', 'ordinary_curriculum', 136],
  ['matemaatika_3._klassile_koolibri', '134', 'matemaatika_3._klassile_koolibri__kit134', 'MATEMAATIKA 3. klassile', 'Koolibri', 'et', 'ordinary_curriculum', 61],
  ['математика_3_класс', '308', 'математика_3_класс__kit308', 'МАТЕМАТИКА 3 класс', 'Koolibri', 'ru', 'ordinary_curriculum', 61],
  ['matemaatika_3._klassile,_i_osa._lihtsustatud_õppekava', '497', 'matemaatika_3._klassile,_i_osa._lihtsustatud_õppekava__kit497', 'Matemaatika 3. klassile, I osa. Lihtsustatud õppekava', '', 'et', 'simplified_curriculum', 24],
  ['matemaatika_3._klassile,_ii_osa._lihtsustatud_õppekava', '498', 'matemaatika_3._klassile,_ii_osa._lihtsustatud_õppekava__kit498', 'Matemaatika 3. klassile, II osa. Lihtsustatud õppekava', '', 'et', 'simplified_curriculum', 14],
  ['matemaatika_3._klassile,_iii_osa._lihtsustatud_õppekava', '499', 'matemaatika_3._klassile,_iii_osa._lihtsustatud_õppekava__kit499', 'Matemaatika 3. klassile, III osa. Lihtsustatud õppekava', '', 'et', 'simplified_curriculum', 22],
  ['matemaatika_3._klassile,_iv_osa._lihtsustatud_õppekava', '500', 'matemaatika_3._klassile,_iv_osa._lihtsustatud_õppekava__kit500', 'Matemaatika 3. klassile, IV osa. Lihtsustatud õppekava', '', 'et', 'simplified_curriculum', 21],
];

export const grade3MathematicsVariants = Object.freeze(Object.fromEntries(variants.map(([
  sourceBookId,
  kitId,
  canonicalBookId,
  title,
  publisher,
  language,
  programmeType,
  canonicalRecords,
]) => [sourceBookId, Object.freeze({
  source_book_id: sourceBookId,
  kit_id: kitId,
  canonical_book_id: canonicalBookId,
  title,
  publisher,
  language,
  programme_type: programmeType,
  canonical_records: canonicalRecords,
})])));

export const subjectNormalizationUrls = Object.freeze([
  'https://www.opiq.ee/kit/531/chapter/29334',
  'https://www.opiq.ee/kit/54/chapter/2701',
]);

export const languageNormalizationUrls = Object.freeze([
  'https://www.opiq.ee/kit/54/chapter/2659',
  'https://www.opiq.ee/kit/54/chapter/2674',
  'https://www.opiq.ee/kit/498/chapter/27314',
  'https://www.opiq.ee/kit/531/chapter/29291',
  'https://www.opiq.ee/kit/531/chapter/29307',
]);

const subjectNormalizationSet = new Set(subjectNormalizationUrls);
const languageNormalizationSet = new Set(languageNormalizationUrls);
const canonicalSubject = Object.freeze({
  en: 'mathematics',
  et: 'matemaatika',
  ru: 'математика',
});
const sourceMathematics = 'mathematics / matemaatika / математика';
const sourceScience = 'science / loodusõpetus / природоведение';
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

export function assertGrade3(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertArchiveIdentity(bytes) {
  assertGrade3(bytes.length === grade3MathematicsArchive.byte_size, `Original archive byte size is ${bytes.length}; expected ${grade3MathematicsArchive.byte_size}.`);
  const actual = sha256Bytes(bytes);
  assertGrade3(actual === grade3MathematicsArchive.sha256, `Original archive checksum is ${actual}; expected ${grade3MathematicsArchive.sha256}.`);
}

export function assertSafeMemberName(name) {
  assertGrade3(typeof name === 'string' && name.length > 0, 'ZIP member name must be non-empty.');
  assertGrade3(!name.startsWith('/') && !/^[A-Za-z]:[\\/]/u.test(name), `ZIP member has an absolute path: ${name}`);
  assertGrade3(!name.includes('\\'), `ZIP member contains a backslash: ${name}`);
  assertGrade3(!name.split('/').includes('..'), `ZIP member traverses outside the archive: ${name}`);
}

export function assertRequiredMembers(memberNames) {
  const names = new Set(memberNames);
  requiredOriginalMembers.forEach((name) => assertGrade3(names.has(name), `Original archive is missing required member ${name}.`));
}

export function kitId(recordOrUrl) {
  const url = typeof recordOrUrl === 'string' ? recordOrUrl : recordOrUrl.url;
  return url.match(/\/kit\/(\d+)/iu)?.[1] ?? url.match(/\/Kit\/Details\/(\d+)/u)?.[1] ?? '';
}

export function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

export function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = String(selector(record));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseGrade3Jsonl(text, label = 'opiq_lookup.jsonl') {
  const rows = String(text).split(/\r?\n/u).filter((line) => line.trim());
  return rows.map((line, index) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} line ${index + 1} is invalid JSON: ${error.message}`);
    }
    assertGrade3(isPlainObject(record), `${label} line ${index + 1} must be an object.`);
    for (const field of [
      'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
      'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
      'task_examples',
    ]) assertGrade3(Object.hasOwn(record, field), `${label} line ${index + 1} is missing ${field}.`);
    assertGrade3(/^https:\/\/(?:www\.)?opiq\.ee\//iu.test(record.url), `${label} line ${index + 1} has an invalid Opiq URL.`);
    assertGrade3(Number.isInteger(record.grade), `${label} line ${index + 1} grade must be an integer.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assertGrade3(Array.isArray(record[field]), `${label} line ${index + 1} ${field} must be an array.`);
      assertGrade3(record[field].every((value) => typeof value === 'string'), `${label} line ${index + 1} ${field} must contain strings.`);
    }
    return { ...record, source_sequence: index + 1 };
  });
}

function parseMarkdownFields(block) {
  const fields = new Map();
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:-\s*)?([A-Za-z][A-Za-z ]*):\s*(.*?)\s*$/u);
    if (match) fields.set(match[1].toLowerCase(), match[2]);
  }
  return fields;
}

function splitList(value) {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(text.includes(';') ? /\s*;\s*/u : /\s*,\s*/u).filter(Boolean);
}

export function parseGrade3Markdown(markdown) {
  const numbered = [...String(markdown).matchAll(/^###\s+(\d+)\.\s+(.+)$/gmu)];
  const plain = [...String(markdown).matchAll(/^##\s+(.+)$/gmu)];
  const starts = numbered.length > 0 ? numbered : plain;
  const numberedFormat = numbered.length > 0;
  return starts.map((match, index) => {
    if (numberedFormat) assertGrade3(Number(match[1]) === index + 1, `Markdown record ${index + 1} has non-contiguous numbering.`);
    const blockEnd = index + 1 < starts.length ? starts[index + 1].index : markdown.length;
    const block = markdown.slice(match.index, blockEnd);
    const fields = parseMarkdownFields(block);
    const rawLists = Object.fromEntries([
      ['topics_et', 'topics et'],
      ['topics_ru', 'topics ru'],
      ['topics_en', 'topics en'],
      ['headings', 'headings'],
      ['task_examples', 'task examples'],
    ].map(([key, label]) => [key, fields.get(label) ?? '']));
    return {
      title: numberedFormat ? match[2] : match[1],
      url: fields.get('url') ?? '',
      book: fields.get('book') ?? '',
      book_id: fields.get('book id') ?? '',
      source_book_id: fields.get('source book id') ?? fields.get('book id') ?? '',
      chapter_id: fields.get('chapter id') ?? '',
      grade: Number(fields.get('class')),
      subject: fields.get('subject') ?? '',
      language: fields.get('language') ?? '',
      publisher: fields.get('publisher') ?? '',
      programme_type: fields.get('programme type') ?? '',
      topics_et: splitList(fields.get('topics et')),
      topics_ru: splitList(fields.get('topics ru')),
      topics_en: splitList(fields.get('topics en')),
      headings: splitList(fields.get('headings')),
      task_examples: splitList(fields.get('task examples')),
      raw_lists: rawLists,
    };
  });
}

export function assertCompactMarkdownMatches(records, markdownRecords) {
  assertGrade3(records.length === markdownRecords.length, `Compact Markdown has ${markdownRecords.length} records; expected ${records.length}.`);
  const scalarFields = ['title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'language', 'publisher'];
  const listFields = ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples'];
  records.forEach((record, index) => {
    const markdown = markdownRecords[index];
    scalarFields.forEach((field) => assertGrade3(
      JSON.stringify(markdown[field]) === JSON.stringify(record[field]),
      `Compact Markdown record ${index + 1} field ${field} differs from JSONL.`,
    ));
    listFields.forEach((field) => assertGrade3(
      markdown.raw_lists[field] === record[field].join(field.startsWith('topics_') ? ', ' : '; ').trim(),
      `Compact Markdown record ${index + 1} field ${field} differs from JSONL.`,
    ));
    assertGrade3(markdown.subject === sourceSubject(record), `Compact Markdown record ${index + 1} Subject differs from JSONL.`);
  });
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
  const fields = ['title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru', 'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples'];
  return fields.filter((field) => records.some((record) => JSON.stringify(record[field]) !== JSON.stringify(records[0][field])));
}

function isDetail(record) {
  return /\/Kit\/Details\/\d+$/u.test(record.url);
}

function isAdministrative(record) {
  return /^(?:impressum|импрессум)$/iu.test(normalizeQualityText(record.title))
    || record.headings.some((heading) => /^(?:impressum|импрессум)$/iu.test(normalizeQualityText(heading)));
}

function replaceSubjectAlias(values, forbidden, required) {
  const forbiddenLower = forbidden.toLocaleLowerCase();
  const requiredLower = required.toLocaleLowerCase();
  const retained = values.filter((value) => normalizeQualityText(value).toLocaleLowerCase() !== forbiddenLower);
  return [required, ...retained.filter((value) => normalizeQualityText(value).toLocaleLowerCase() !== requiredLower)];
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

function repairDetails(source, canonical) {
  const changes = [];
  for (const field of ['title', 'topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
    if (JSON.stringify(source[field]) !== JSON.stringify(canonical[field])) {
      changes.push({ field, source_value: source[field], canonical_value: canonical[field] });
    }
  }
  if (changes.length === 0) return null;
  const serialized = JSON.stringify(source);
  const categories = [];
  if (/\{"d|<\/?[A-Za-z][^>]*>/u.test(serialized)) categories.push('extractor_payload_removed');
  if (/[\u200b-\u200d\u2060\ufeff]/u.test(serialized)) categories.push('invisible_spacing_control_removed');
  if (/\u00ad/u.test(serialized)) categories.push('discretionary_soft_hyphen_removed');
  if (categories.length === 0) categories.push('deterministic_text_normalization');
  return {
    url: canonical.url,
    source_book_id: canonical.source_book_id,
    kit_id: canonical.kit_id,
    categories,
    changes,
    evidence: 'The canonical value is a deterministic normalization of text in the same original archive record.',
    transformation: 'NFC; remove discretionary soft hyphen; replace zero-width spacing controls with a space; remove framed extractor payloads; collapse whitespace.',
  };
}

function normalizeInstructionalRecord(record) {
  const variant = grade3MathematicsVariants[record.book_id];
  assertGrade3(variant, `Unknown grade-3 mathematics Source Book ID: ${record.book_id}`);
  const actualKit = kitId(record);
  assertGrade3(actualKit === variant.kit_id, `${record.url} uses kit ${actualKit}; expected ${variant.kit_id} for ${record.book_id}.`);
  assertGrade3(record.grade === 2, `${record.url} raw grade is ${record.grade}; expected the audited systematic export value 2.`);

  const rawSubject = sourceSubject(record);
  if (subjectNormalizationSet.has(record.url)) {
    assertGrade3(rawSubject === sourceScience, `${record.url} no longer has the audited science source label.`);
  } else {
    assertGrade3(rawSubject === sourceMathematics, `${record.url} has an unaudited non-mathematics source label: ${rawSubject}.`);
  }

  let language = record.language;
  if (languageNormalizationSet.has(record.url)) {
    assertGrade3(language === 'en' && variant.language === 'et', `${record.url} no longer has the audited en-to-et language anomaly.`);
    language = 'et';
  } else {
    assertGrade3(language === variant.language, `${record.url} source language ${language} conflicts with audited book language ${variant.language}.`);
  }

  let topicsEt = normalizeList(record.topics_et);
  let topicsRu = normalizeList(record.topics_ru);
  let topicsEn = normalizeList(record.topics_en);
  if (subjectNormalizationSet.has(record.url)) {
    topicsEt = replaceSubjectAlias(topicsEt, 'loodusõpetus', 'matemaatika');
    topicsRu = replaceSubjectAlias(topicsRu, 'природоведение', 'математика');
    topicsEn = replaceSubjectAlias(topicsEn, 'science', 'mathematics');
  }

  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: variant.title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.source_book_id,
    chapter_id: String(record.chapter_id),
    grade: 3,
    subject_en: canonicalSubject.en,
    subject_et: canonicalSubject.et,
    subject_ru: canonicalSubject.ru,
    language,
    publisher: variant.publisher,
    programme_type: variant.programme_type,
    kit_id: variant.kit_id,
    topics_et: topicsEt,
    topics_ru: topicsRu,
    topics_en: topicsEn,
    headings: normalizeList(record.headings),
    task_examples: normalizeTasks(record.task_examples),
  };
  validateCanonicalRecord(canonical);
  return { canonical, repair: repairDetails(record, canonical) };
}

export function validateCanonicalRecord(record) {
  const match = record.url.match(directChapterUrl);
  assertGrade3(match, `Canonical record is not a direct chapter URL: ${record.url}`);
  assertGrade3(match[1] === record.kit_id, `${record.url} kit differs from canonical kit ${record.kit_id}.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3(sourceSubject(record) === sourceMathematics, `${record.url} canonical subject must be mathematics.`);
  assertGrade3(['et', 'ru'].includes(record.language), `${record.url} canonical language must be et or ru.`);
  assertGrade3(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  const text = [
    record.title, record.book, record.book_id, record.source_book_id, record.publisher,
    ...record.topics_et, ...record.topics_ru, ...record.topics_en,
    ...record.headings, ...record.task_examples,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3(!/[\u200b-\u200d\u2060\ufeff\u00ad]/u.test(text), `${record.url} contains an invisible or discretionary control character.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
  const variant = grade3MathematicsVariants[record.source_book_id];
  assertGrade3(variant?.canonical_book_id === record.book_id, `${record.url} canonical Book ID is not the audited source-book-plus-kit identity.`);
  assertGrade3(variant.programme_type === record.programme_type, `${record.url} programme type differs from its audited book variant.`);
}

export function buildGrade3CanonicalCatalog(sourceRecords) {
  assertGrade3(sourceRecords.length === grade3MathematicsArchive.source_records, `Original archive has ${sourceRecords.length} source records; expected ${grade3MathematicsArchive.source_records}.`);
  const urlGroups = groupBy(sourceRecords, (record) => record.url);
  const duplicateGroups = [...urlGroups.entries()].filter(([, records]) => records.length > 1);
  assertGrade3(duplicateGroups.length === 9, `Original archive has ${duplicateGroups.length} duplicate URL groups; expected 9.`);
  const duplicateAudit = duplicateGroups.map(([url, records]) => {
    assertGrade3(records.length === 2, `${url} duplicate group must contain exactly two rows.`);
    assertGrade3(records.every(isDetail), `${url} duplicate group is not limited to Kit Details records.`);
    const differing = differingFields(records);
    assertGrade3(JSON.stringify(differing) === JSON.stringify(['chapter_id']), `${url} duplicate rows conflict in fields: ${differing.join(', ') || '<none>'}.`);
    return {
      url,
      kit_id: kitId(url),
      source_book_id: records[0].book_id,
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_duplicate_alias_and_unique_kit_detail',
      reason: 'Both rows are non-instructional Kit Details aliases; their content is identical and only the synthetic chapter ID differs.',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));

  const seenDetailUrls = new Set();
  const canonicalRecords = [];
  const coverDetails = [];
  const duplicateAliases = [];
  const administrative = [];
  const contentRepairs = [];
  for (const record of sourceRecords) {
    const variant = grade3MathematicsVariants[record.book_id];
    assertGrade3(variant, `Unknown grade-3 mathematics Source Book ID: ${record.book_id}`);
    assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside the audited kit for ${record.book_id}.`);
    if (isDetail(record)) {
      if (seenDetailUrls.has(record.url)) duplicateAliases.push(record);
      else {
        seenDetailUrls.add(record.url);
        coverDetails.push(record);
      }
      continue;
    }
    if (isAdministrative(record)) {
      administrative.push(record);
      continue;
    }
    const { canonical, repair } = normalizeInstructionalRecord(record);
    canonicalRecords.push(canonical);
    if (repair) contentRepairs.push(repair);
  }

  assertGrade3(coverDetails.length === 9, `Excluded unique Kit Details count is ${coverDetails.length}; expected 9.`);
  assertGrade3(duplicateAliases.length === 9, `Excluded duplicate Kit Details alias count is ${duplicateAliases.length}; expected 9.`);
  assertGrade3(administrative.length === 6, `Excluded administrative count is ${administrative.length}; expected 6.`);
  assertGrade3(canonicalRecords.length === grade3MathematicsArchive.canonical_records, `Canonical record count is ${canonicalRecords.length}; expected ${grade3MathematicsArchive.canonical_records}.`);
  const canonicalUrls = new Set(canonicalRecords.map((record) => record.url));
  assertGrade3(canonicalUrls.size === canonicalRecords.length, 'Canonical grade-3 mathematics URLs are not unique.');

  for (const variant of Object.values(grade3MathematicsVariants)) {
    const records = canonicalRecords.filter((record) => record.book_id === variant.canonical_book_id);
    assertGrade3(records.length === variant.canonical_records, `${variant.canonical_book_id} has ${records.length} records; expected ${variant.canonical_records}.`);
  }
  assertGrade3(subjectNormalizationUrls.every((url) => canonicalUrls.has(url)), 'An audited environmental-context mathematics URL is missing.');
  assertGrade3(languageNormalizationUrls.every((url) => canonicalUrls.has(url)), 'An audited language-normalization URL is missing.');

  return {
    canonical_records: canonicalRecords,
    exclusions: {
      cover_details: coverDetails,
      duplicate_aliases: duplicateAliases,
      administrative,
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

export function renderGrade3Markdown(catalog) {
  const records = catalog.canonical_records;
  const lines = [
    '# Opiq lookup: grade 3 mathematics',
    '',
    'Use this file only for grade 3 mathematics requests. Search by title, topic, heading, task example, book, and language. Simplified-curriculum sources require explicit labelling.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3MathematicsArchive.path}\``,
    `- Archive SHA-256: \`${grade3MathematicsArchive.sha256}\``,
    `- Capture timestamp: ${grade3MathematicsArchive.capture_timestamp}`,
    `- Format version: ${grade3MathematicsArchive.format_version}`,
    '- Class: 3',
    '- Subject: mathematics / matemaatika / математика',
    '- Page languages: Estonian, Russian',
    `- Source records: ${grade3MathematicsArchive.source_records}`,
    `- Page records included: ${records.length}`,
    '- Unique cover/detail records excluded: 9',
    '- Duplicate cover/detail aliases excluded: 9',
    '- Administrative Impressum records excluded: 6',
    '- Source grade normalization: 643 source rows marked grade 2 are normalized to grade 3 from the captured grade-3 book/kit evidence.',
    '- Source language normalization: 5 Estonian instructional pages marked en are normalized to et.',
    '- Subject normalization: 2 environmental-context calculation pages are retained as mathematics.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const variant of Object.values(grade3MathematicsVariants).sort((left, right) => Number(left.kit_id) - Number(right.kit_id))) {
    const publisher = variant.publisher || 'publisher not captured';
    const simplified = variant.programme_type === 'simplified_curriculum' ? '; use only with explicit simplified-curriculum labelling' : '';
    lines.push(`- \`${variant.canonical_book_id}\` — ${variant.title}; Source Book ID \`${variant.source_book_id}\`; kit ${variant.kit_id}; ${publisher}; ${variant.language}; ${variant.canonical_records} pages; ${variant.programme_type}${simplified}.`);
  }
  lines.push('', '## Pages', '');
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

function relationship(oldValues, newValues) {
  if (JSON.stringify(oldValues) === JSON.stringify(newValues)) return 'unchanged';
  const oldSet = new Set(oldValues);
  const newSet = new Set(newValues);
  const oldInNew = [...oldSet].every((value) => newSet.has(value));
  const newInOld = [...newSet].every((value) => oldSet.has(value));
  if (oldInNew && newSet.size > oldSet.size) return 'richer_original_evidence';
  if (newInOld && oldSet.size > newSet.size) return 'historical_compact_richer';
  return 'changed_capture_evidence';
}

export function compareHistoricalCatalog(historicalRecords, originalSourceRecords, canonicalRecords) {
  assertGrade3(historicalRecords.length === historicalGrade3MathematicsArchive.source_records, `Historical compact has ${historicalRecords.length} records; expected ${historicalGrade3MathematicsArchive.source_records}.`);
  const firstHistoricalByUrl = new Map();
  historicalRecords.forEach((record) => {
    if (!firstHistoricalByUrl.has(record.url)) firstHistoricalByUrl.set(record.url, record);
  });
  const historicalCanonical = [...firstHistoricalByUrl.values()];
  assertGrade3(historicalCanonical.length === historicalGrade3MathematicsArchive.canonical_records, `Historical canonical count is ${historicalCanonical.length}; expected ${historicalGrade3MathematicsArchive.canonical_records}.`);
  const historicalInstructional = historicalCanonical.filter((record) => !isDetail(record) && !isAdministrative(record));
  const originalInstructionalByUrl = new Map(originalSourceRecords.filter((record) => !isDetail(record) && !isAdministrative(record)).map((record) => [record.url, record]));
  const canonicalByUrl = new Map(canonicalRecords.map((record) => [record.url, record]));
  const historicalUrls = new Set(historicalInstructional.map((record) => record.url));
  const canonicalUrls = new Set(canonicalRecords.map((record) => record.url));
  const newUrls = [...canonicalUrls].filter((url) => !historicalUrls.has(url)).sort();
  const missingUrls = [...historicalUrls].filter((url) => !canonicalUrls.has(url)).sort();
  assertGrade3(newUrls.length === 0 && missingUrls.length === 0, `Historical/original instructional URL sets differ: ${newUrls.length} new, ${missingUrls.length} missing.`);

  const differences = [];
  const fieldCounts = {};
  const relationshipCounts = {};
  for (const historical of historicalInstructional) {
    const original = originalInstructionalByUrl.get(historical.url);
    const canonical = canonicalByUrl.get(historical.url);
    assertGrade3(original && canonical, `Comparison record is missing for ${historical.url}.`);
    assertGrade3(historical.title === original.title, `Unexplained title difference for ${historical.url}.`);
    assertGrade3(String(historical.chapter_id) === String(original.chapter_id), `Unexplained chapter ID difference for ${historical.url}.`);
    const changedFields = [];
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      const relation = relationship(historical[field], original[field]);
      if (relation === 'unchanged') continue;
      fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
      relationshipCounts[relation] = (relationshipCounts[relation] ?? 0) + 1;
      changedFields.push({
        field,
        classification: relation,
        historical_count: historical[field].length,
        original_capture_count: original[field].length,
        historical_sha256: sha256Bytes(Buffer.from(JSON.stringify(historical[field]))),
        original_capture_sha256: sha256Bytes(Buffer.from(JSON.stringify(original[field]))),
        canonical_sha256: sha256Bytes(Buffer.from(JSON.stringify(canonical[field]))),
      });
    }
    if (changedFields.length > 0) differences.push({ url: historical.url, changed_fields: changedFields });
  }

  const removedNonInstructional = historicalCanonical.filter((record) => isDetail(record) || isAdministrative(record));
  assertGrade3(removedNonInstructional.length === 15, `Historical non-instructional canonical count is ${removedNonInstructional.length}; expected 15.`);
  return {
    historical_archive: historicalGrade3MathematicsArchive,
    old_source_records: historicalRecords.length,
    new_source_records: originalSourceRecords.length,
    old_canonical_records: historicalCanonical.length,
    old_canonical_markdown: {
      sha256: historicalGrade3MathematicsArchive.canonical_markdown_sha256,
      record_count: historicalCanonical.length,
      basis: 'Previously committed canonical Markdown generated from the historical compact snapshot.',
    },
    new_canonical_instructional_records: canonicalRecords.length,
    instructional_url_set: {
      unchanged: canonicalRecords.length,
      newly_captured: newUrls,
      missing_from_original_capture: missingUrls,
    },
    removed_non_instructional: removedNonInstructional.map((record) => ({
      url: record.url,
      title: record.title,
      category: isDetail(record) ? 'cover_or_kit_details' : 'administrative',
    })),
    metadata_changes: {
      source_grade_2_to_canonical_grade_3: canonicalRecords.length,
      source_book_ids_mapped_to_canonical_book_plus_kit_ids: canonicalRecords.length,
      source_cover_titles_used_as_canonical_book_titles: canonicalRecords.length,
      historical_publishers_retained_for_audited_ordinary_books: canonicalRecords.filter((record) => record.publisher).length,
    },
    semantic_difference_summary: {
      records_with_differences: differences.length,
      field_counts: Object.fromEntries(Object.entries(fieldCounts).sort()),
      classification_counts: Object.fromEntries(Object.entries(relationshipCounts).sort()),
      unexplained_differences: 0,
    },
    semantic_differences: differences,
  };
}

export function validateManifestGrade3Source(source) {
  assertGrade3(source?.id === 'grade-3-mathematics', 'Manifest grade-3 mathematics route is missing.');
  assertGrade3(source.source_archive === grade3MathematicsArchive.path, 'Manifest must use the original grade-3 mathematics archive.');
  assertGrade3(!source.source_provenance || source.source_provenance.kind !== 'derived_compact_snapshot', 'Manifest still declares derived compact provenance.');
  assertGrade3(source.record_count === grade3MathematicsArchive.canonical_records, `Manifest record_count must be ${grade3MathematicsArchive.canonical_records}.`);
  assertGrade3(JSON.stringify(source.languages) === JSON.stringify(['et', 'ru']), 'Manifest languages must contain the canonical et and ru languages only.');
}

export function assertGeneratedArtifact(current, expected, label) {
  assertGrade3(current === expected, `${label} is stale.`);
}
