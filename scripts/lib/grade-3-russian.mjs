import { createHash } from 'node:crypto';

import {
  containsUnprocessedPayload,
  normalizeQualityText,
  sanitizeCapturedTaskExample,
} from './grade-2-content-quality.mjs';
import {
  assertGrade3,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  assertCompactMarkdownMatches,
  sha256Bytes,
} from './grade-3-mathematics.mjs';

export {
  assertGrade3,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  assertCompactMarkdownMatches,
  sha256Bytes,
};

export const grade3RussianArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_3_2023_opiq_v2.zip',
  sha256: '5ee00c001d3cd2a39d543896effd0cc5a3bf4ca0f2d68ff2d29df184f2805d2c',
  byte_size: 5_122_183,
  member_count: 497,
  format_version: '2.0',
  capture_timestamp: '2026-07-23T05:57:52.865Z',
  source_records: 488,
  canonical_records: 478,
});

export const historicalGrade2RussianArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_2klass_vene_keel_v2.zip',
  sha256: '13e362d66437025722498e2389fe1fee41f6298133d8022b6ddd51cad055e088',
  source_records: 582,
});

export const requiredGrade3RussianMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

const variantRows = [
  [
    'русский_язык._3_класс_(2023_г.)',
    '503',
    'русский_язык._3_класс_(2023_г.)__kit503',
    'Русский язык. 3 класс (2023 г.)',
    '',
    194,
    191,
    1,
  ],
  [
    'русский_язык_3_класс',
    '250',
    'русский_язык_3_класс__kit250',
    'РУССКИЙ ЯЗЫК 3 класс',
    '',
    64,
    62,
    0,
  ],
  [
    'русский_язык_для_3_класса',
    '94',
    'русский_язык_для_3_класса__kit94',
    'Русский язык для 3 класса',
    '',
    175,
    173,
    0,
  ],
  [
    'русский_язык_для_i_ступени._часть_3',
    '568',
    'русский_язык_для_i_ступени._часть_3__kit568',
    'Русский язык для I ступени. Часть 3',
    'Avita',
    54,
    52,
    0,
  ],
];

export const grade3RussianVariants = Object.freeze(Object.fromEntries(variantRows.map(([
  sourceBookId,
  kitId,
  canonicalBookId,
  title,
  publisher,
  sourceRows,
  canonicalRecords,
  administrativeRecords,
]) => [sourceBookId, Object.freeze({
  source_book_id: sourceBookId,
  kit_id: kitId,
  canonical_book_id: canonicalBookId,
  title,
  publisher,
  language: 'ru',
  programme_type: 'ordinary_curriculum',
  source_rows: sourceRows,
  canonical_records: canonicalRecords,
  administrative_records: administrativeRecords,
  publisher_provenance: publisher
    ? 'Previously audited kit-specific grade-2 route metadata; absent from the new archive.'
    : 'Publisher is absent from the original grade-3 archive and is not invented.',
})])));

export const grade2RussianRetainedBookIds = Object.freeze([
  'avita_русский_язык_2_класс_kit292',
  'koolibri_русский_яз_2_ru',
  'koolibri_светлячок._2_ru',
]);

const sourceMathematics = 'mathematics / matemaatika / математика';
const canonicalSubject = Object.freeze({
  en: 'Russian language',
  et: 'vene keel',
  ru: 'русский язык',
});
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const invisiblePattern = /[\u00ad\u200b-\u200d\u2060\ufeff]/u;
const generatedSubjectAliases = Object.freeze({
  topics_et: new Set(['matemaatika']),
  topics_ru: new Set(['математика']),
  topics_en: new Set(['mathematics']),
});
const requiredSubjectAliases = Object.freeze({
  topics_et: 'vene keel',
  topics_ru: 'русский язык',
  topics_en: 'Russian language',
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

export function assertGrade3RussianArchiveIdentity(bytes) {
  assertGrade3(bytes.length === grade3RussianArchive.byte_size, `Original archive byte size is ${bytes.length}; expected ${grade3RussianArchive.byte_size}.`);
  const actual = sha256Bytes(bytes);
  assertGrade3(actual === grade3RussianArchive.sha256, `Original archive checksum is ${actual}; expected ${grade3RussianArchive.sha256}.`);
}

export function assertHistoricalGrade2ArchiveIdentity(bytes) {
  const actual = sha256Bytes(bytes);
  assertGrade3(actual === historicalGrade2RussianArchive.sha256, `Historical grade-2 archive checksum is ${actual}; expected ${historicalGrade2RussianArchive.sha256}.`);
}

export function assertSafeMemberName(name) {
  assertGrade3(typeof name === 'string' && name.length > 0, 'ZIP member name must be non-empty.');
  assertGrade3(!name.startsWith('/') && !/^[A-Za-z]:[\\/]/u.test(name), `ZIP member has an absolute path: ${name}`);
  assertGrade3(!name.includes('\\'), `ZIP member contains a backslash: ${name}`);
  assertGrade3(!name.split('/').includes('..'), `ZIP member traverses outside the archive: ${name}`);
}

export function assertRequiredMembers(memberNames) {
  const names = new Set(memberNames);
  requiredGrade3RussianMembers.forEach((name) => assertGrade3(names.has(name), `Original archive is missing required member ${name}.`));
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
  return fields.filter((field) => records.some((record) => JSON.stringify(record[field]) !== JSON.stringify(records[0][field])));
}

export function isKitDetail(record) {
  return /\/Kit\/Details\/\d+$/u.test(record.url);
}

export function isSearchResult(record) {
  return /\/Search\/Kits(?:\?|$)/u.test(record.url);
}

export function isAdministrative(record) {
  return /^(?:impressum|импрессум)$/iu.test(normalizeQualityText(record.title))
    || record.headings.some((heading) => /^(?:impressum|импрессум)$/iu.test(normalizeQualityText(heading)));
}

function normalizeList(values) {
  return [...new Set(values.map(normalizeQualityText).filter(Boolean))];
}

function normalizeTasks(values) {
  return [...new Set(values.map((value) => {
    const withoutFramedJson = sanitizeCapturedTaskExample(value).text;
    const withoutPlayerControls = withoutFramedJson.replace(/PausEsita%\s*puhverdatud[\s\S]*$/u, '');
    return normalizeQualityText(withoutPlayerControls.replace(/<[^>]+>/gu, ' '));
  }).filter(Boolean))];
}

function normalizeTopics(values, field) {
  const forbidden = generatedSubjectAliases[field];
  const required = requiredSubjectAliases[field];
  const retained = normalizeList(values).filter((value) => !forbidden.has(value.toLocaleLowerCase()));
  return [required, ...retained.filter((value) => value.toLocaleLowerCase() !== required.toLocaleLowerCase())];
}

function repairDetails(source, canonical) {
  const changes = [];
  for (const field of ['title', 'topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
    if (JSON.stringify(source[field]) === JSON.stringify(canonical[field])) continue;
    changes.push({
      field,
      raw_sha256: createHash('sha256').update(JSON.stringify(source[field])).digest('hex'),
      canonical_sha256: createHash('sha256').update(JSON.stringify(canonical[field])).digest('hex'),
    });
  }
  if (changes.length === 0) return null;
  const serialized = JSON.stringify(source);
  const categories = [];
  if (/\{"d|<\/?[A-Za-z][^>]*>/u.test(serialized)) categories.push('extractor_payload_removed');
  if (/PausEsita%\s*puhverdatud/u.test(serialized)) categories.push('media_player_control_text_removed');
  if (/[\u200b-\u200d\u2060\ufeff]/u.test(serialized)) categories.push('invisible_spacing_control_removed');
  if (/\u00ad/u.test(serialized)) categories.push('discretionary_soft_hyphen_removed');
  if (changes.some((change) => change.field.startsWith('topics_'))) categories.push('generated_subject_alias_replaced');
  if (categories.length === 0) categories.push('deterministic_text_normalization');
  return {
    url: canonical.url,
    source_book_id: canonical.source_book_id,
    kit_id: canonical.kit_id,
    categories: [...new Set(categories)],
    changes,
    evidence: 'Canonical values are deterministic transformations of the same committed source record.',
    transformation: 'NFC; remove soft hyphen; replace zero-width spacing controls with spaces; remove framed extractor payloads/HTML tags/media-player controls; collapse whitespace; replace generated mathematics topic aliases with Russian-language aliases.',
  };
}

function normalizeInstructionalRecord(record) {
  const variant = grade3RussianVariants[record.book_id];
  assertGrade3(variant, `Unknown grade-3 Russian Source Book ID: ${record.book_id}`);
  assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside the audited kit for ${record.book_id}.`);
  assertGrade3(record.grade === 3, `${record.url} raw grade must be 3.`);
  assertGrade3(record.language === 'ru', `${record.url} instructional source language must be ru.`);
  assertGrade3(sourceSubject(record) === sourceMathematics, `${record.url} raw subject differs from the audited exporter-wide mathematics error.`);
  const canonical = {
    ...record,
    title: normalizeQualityText(record.title),
    book: variant.title,
    book_id: variant.canonical_book_id,
    source_book_id: record.book_id,
    kit_id: variant.kit_id,
    grade: 3,
    language: 'ru',
    publisher: variant.publisher,
    programme_type: variant.programme_type,
    subject_en: canonicalSubject.en,
    subject_et: canonicalSubject.et,
    subject_ru: canonicalSubject.ru,
    topics_et: normalizeTopics(record.topics_et, 'topics_et'),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru'),
    topics_en: normalizeTopics(record.topics_en, 'topics_en'),
    headings: normalizeList(record.headings),
    task_examples: normalizeTasks(record.task_examples),
  };
  delete canonical.source_sequence;
  const repair = repairDetails(record, canonical);
  validateCanonicalGrade3RussianRecord(canonical);
  return { canonical, repair };
}

export function validateCanonicalGrade3RussianRecord(record) {
  const match = record.url.match(directChapterUrl);
  assertGrade3(match, `${record.url} is not a direct canonical Opiq chapter URL.`);
  assertGrade3(match[1] === record.kit_id, `${record.url} URL kit differs from canonical kit.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3(sourceSubject(record) === `${canonicalSubject.en} / ${canonicalSubject.et} / ${canonicalSubject.ru}`, `${record.url} canonical subject must be Russian language.`);
  assertGrade3(record.language === 'ru', `${record.url} canonical language must be ru.`);
  assertGrade3(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  const variant = grade3RussianVariants[record.source_book_id];
  assertGrade3(variant?.canonical_book_id === record.book_id, `${record.url} has an unknown canonical source-book-plus-kit identity.`);
  assertGrade3(variant.title === record.book, `${record.url} canonical book title differs from Kit Details evidence.`);
  assertGrade3(variant.publisher === record.publisher, `${record.url} publisher is not source-supported.`);
  assertGrade3(record.programme_type === 'ordinary_curriculum', `${record.url} programme type must be ordinary_curriculum.`);
  const text = [
    record.title, record.book, record.book_id, record.source_book_id, record.publisher,
    ...record.topics_et, ...record.topics_ru, ...record.topics_en, ...record.headings,
    ...record.task_examples,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3(!invisiblePattern.test(text), `${record.url} contains an invisible or discretionary control character.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
  assertGrade3(!record.topics_et.includes('matemaatika') && !record.topics_ru.includes('математика') && !record.topics_en.includes('mathematics'), `${record.url} retains a generated mathematics topic alias.`);
}

export function buildGrade3RussianCatalog(sourceRecords) {
  assertGrade3(sourceRecords.length === grade3RussianArchive.source_records, `Original archive has ${sourceRecords.length} source records; expected ${grade3RussianArchive.source_records}.`);
  const urlGroups = groupBy(sourceRecords, (record) => record.url);
  const duplicateGroups = [...urlGroups.entries()].filter(([, records]) => records.length > 1);
  assertGrade3(duplicateGroups.length === 4, `Original archive has ${duplicateGroups.length} duplicate URL groups; expected 4.`);
  const duplicateAudit = duplicateGroups.map(([url, records]) => {
    assertGrade3(records.length === 2, `${url} duplicate group must contain exactly two rows.`);
    assertGrade3(records.every(isKitDetail), `${url} duplicate group is not limited to Kit Details records.`);
    const differing = differingFields(records);
    assertGrade3(JSON.stringify(differing) === JSON.stringify(['chapter_id']), `${url} duplicate rows conflict in fields: ${differing.join(', ') || '<none>'}.`);
    return {
      url,
      kit_id: kitId(url),
      source_book_id: records[0].book_id,
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_duplicate_alias_and_unique_kit_detail',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));

  const seenDetailUrls = new Set();
  const canonicalRecords = [];
  const coverDetails = [];
  const duplicateAliases = [];
  const administrative = [];
  const searchResults = [];
  const contentRepairs = [];
  for (const record of sourceRecords) {
    const variant = grade3RussianVariants[record.book_id];
    assertGrade3(variant, `Unknown grade-3 Russian Source Book ID: ${record.book_id}`);
    if (isSearchResult(record)) {
      assertGrade3(record.book_id === 'русский_язык_для_3_класса' && record.language === 'et' && record.title === 'Varamu – Opiq', 'Unexpected search-results record.');
      searchResults.push(record);
      continue;
    }
    assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside the audited kit for ${record.book_id}.`);
    if (isKitDetail(record)) {
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

  assertGrade3(coverDetails.length === 4, `Unique Kit Details count is ${coverDetails.length}; expected 4.`);
  assertGrade3(duplicateAliases.length === 4, `Duplicate Kit Details count is ${duplicateAliases.length}; expected 4.`);
  assertGrade3(administrative.length === 1, `Administrative count is ${administrative.length}; expected 1.`);
  assertGrade3(searchResults.length === 1, `Search-results count is ${searchResults.length}; expected 1.`);
  assertGrade3(canonicalRecords.length === grade3RussianArchive.canonical_records, `Canonical count is ${canonicalRecords.length}; expected ${grade3RussianArchive.canonical_records}.`);
  assertGrade3(canonicalRecords.length + coverDetails.length + duplicateAliases.length + administrative.length + searchResults.length === sourceRecords.length, 'Not every source row was classified.');
  assertGrade3(new Set(canonicalRecords.map((record) => record.url)).size === canonicalRecords.length, 'Canonical grade-3 Russian URLs are not unique.');

  for (const variant of Object.values(grade3RussianVariants)) {
    const sourceRows = sourceRecords.filter((record) => record.book_id === variant.source_book_id && !isSearchResult(record));
    const records = canonicalRecords.filter((record) => record.book_id === variant.canonical_book_id);
    assertGrade3(sourceRows.length === variant.source_rows, `${variant.source_book_id} has ${sourceRows.length} kit rows; expected ${variant.source_rows}.`);
    assertGrade3(records.length === variant.canonical_records, `${variant.canonical_book_id} has ${records.length} pages; expected ${variant.canonical_records}.`);
  }

  return {
    canonical_records: canonicalRecords,
    exclusions: {
      cover_details: coverDetails,
      duplicate_aliases: duplicateAliases,
      administrative,
      search_results: searchResults,
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

export function renderGrade3RussianMarkdown(catalog) {
  const records = catalog.canonical_records;
  const lines = [
    '# Opiq lookup: grade 3 Russian language',
    '',
    'Use this file only for grade 3 Russian-language subject requests. Search by title, topic, heading, task example, and book.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3RussianArchive.path}\``,
    `- Archive SHA-256: \`${grade3RussianArchive.sha256}\``,
    `- Capture timestamp: ${grade3RussianArchive.capture_timestamp}`,
    `- Format version: ${grade3RussianArchive.format_version}`,
    '- Class: 3',
    '- Subject: Russian language / vene keel / русский язык',
    '- Page language: Russian',
    `- Source records: ${grade3RussianArchive.source_records}`,
    `- Page records included: ${records.length}`,
    '- Unique Kit Details excluded: 4',
    '- Duplicate Kit Details aliases excluded: 4',
    '- Administrative Impressum excluded: 1',
    '- Opiq search-results record excluded: 1',
    '- Subject normalization: exporter-wide mathematics metadata is replaced with Russian-language metadata using book, cover, heading, task, and subject-filter evidence.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const variant of Object.values(grade3RussianVariants).sort((left, right) => Number(left.kit_id) - Number(right.kit_id))) {
    const publisher = variant.publisher || 'publisher not captured';
    lines.push(`- \`${variant.canonical_book_id}\` — ${variant.title}; Source Book ID \`${variant.source_book_id}\`; kit ${variant.kit_id}; ${publisher}; ru; ${variant.canonical_records} pages; ordinary_curriculum.`);
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

function comparableRecord(record) {
  return {
    title: normalizeQualityText(record.title),
    headings: normalizeList(record.headings),
    task_examples: normalizeTasks(record.task_examples),
    chapter_id: String(record.chapter_id),
  };
}

export function compareKit568Ownership({ oldSourceRecords, newSourceRecords, oldCanonicalRecords, newCanonicalRecords }) {
  const oldSource = oldSourceRecords.filter((record) => record.book_id === 'avita_русский_язык_i_ступень_часть_3_kit568'
    && kitId(record) === '568'
    && !isKitDetail(record)
    && !isAdministrative(record)
    && !isSearchResult(record));
  const newSource = newSourceRecords.filter((record) => kitId(record) === '568' && !isKitDetail(record) && !isAdministrative(record) && !isSearchResult(record));
  const oldCanonical = oldCanonicalRecords.filter((record) => kitId(record) === '568');
  const newCanonical = newCanonicalRecords.filter((record) => record.kit_id === '568');
  const byUrl = (records) => new Map(records.map((record) => [record.url, record]));
  const oldSourceByUrl = byUrl(oldSource);
  const newSourceByUrl = byUrl(newSource);
  const oldCanonicalByUrl = byUrl(oldCanonical);
  const newCanonicalByUrl = byUrl(newCanonical);
  const expectedUrls = [...newCanonicalByUrl.keys()].sort();
  assertGrade3(newSourceByUrl.size === 52 && oldSourceByUrl.size === 52 && oldCanonicalByUrl.size === 52 && newCanonicalByUrl.size === 52, 'Kit 568 must have 52 unique instructional URLs in both archives and both canonical views.');
  assertGrade3(
    JSON.stringify(oldSource.map((record) => record.url)) === JSON.stringify(newSource.map((record) => record.url)),
    'Kit 568 chapter ordering differs between the old and dedicated grade-3 captures.',
  );
  for (const map of [oldSourceByUrl, oldCanonicalByUrl, newCanonicalByUrl]) {
    assertGrade3(expectedUrls.every((url) => map.has(url)) && map.size === expectedUrls.length, 'Kit 568 URL sets differ.');
  }
  const differences = [];
  const contentDifferences = [];
  for (const url of expectedUrls) {
    const oldValue = comparableRecord(oldSourceByUrl.get(url));
    const newValue = comparableRecord(newSourceByUrl.get(url));
    const oldCanonicalValue = comparableRecord(oldCanonicalByUrl.get(url));
    const newCanonicalValue = comparableRecord(newCanonicalByUrl.get(url));
    for (const field of ['title', 'headings', 'task_examples', 'chapter_id']) {
      const sourceEqual = JSON.stringify(oldValue[field]) === JSON.stringify(newValue[field]);
      const canonicalEqual = JSON.stringify(oldCanonicalValue[field]) === JSON.stringify(newCanonicalValue[field]);
      if (!sourceEqual || !canonicalEqual) {
        const allowedOptionOrderDifference = url === 'https://www.opiq.ee/kit/568/chapter/31798'
          && field === 'task_examples'
          && oldValue.task_examples.length === newValue.task_examples.length
          && oldValue.task_examples.slice(1).every((value, index) => value === newValue.task_examples[index + 1])
          && [...oldValue.task_examples[0].matchAll(/\p{L}+/gu)].map((match) => match[0]).sort().join('\n')
            === [...newValue.task_examples[0].matchAll(/\p{L}+/gu)].map((match) => match[0]).sort().join('\n');
        assertGrade3(allowedOptionOrderDifference, `Unexplained old/new kit 568 ${field} difference for ${url}.`);
        contentDifferences.push({
          url,
          field,
          classification: 'interactive_option_order_only',
          old_sha256: sha256Bytes(Buffer.from(JSON.stringify(oldValue[field]))),
          new_sha256: sha256Bytes(Buffer.from(JSON.stringify(newValue[field]))),
          disposition: 'Retain the dedicated grade-3 capture order; the same words and task prompt are present and only interactive choice order changed.',
        });
      }
    }
    if (JSON.stringify(oldSourceByUrl.get(url)) !== JSON.stringify(newSourceByUrl.get(url))) {
      differences.push({
        url,
        classification: 'metadata_only',
        old_grade: oldSourceByUrl.get(url).grade,
        new_grade: newSourceByUrl.get(url).grade,
        old_source_book_id: oldSourceByUrl.get(url).book_id,
        new_source_book_id: newSourceByUrl.get(url).book_id,
      });
    }
  }
  return {
    url_count: expectedUrls.length,
    url_sets_equal: true,
    normalized_titles_and_headings_equal: true,
    exact_task_sets_equal: contentDifferences.length === 0,
    audited_content_differences: contentDifferences,
    chapter_ordering_equal: true,
    source_metadata_difference_count: differences.length,
    source_metadata_differences: differences,
    decision: 'move_to_grade_3',
    evidence: 'The dedicated grade-3 archive, Kit Details, Source Book ID, visible title, and all page metadata identify grade 3 while preserving the same 52 instructional URLs and content.',
  };
}

export function assertKit568FinalOwnership(grade2Records, grade3Records) {
  const grade2Kit568 = grade2Records.filter((record) => kitId(record) === '568');
  const grade3Kit568 = grade3Records.filter((record) => (record.kit_id ?? kitId(record)) === '568');
  assertGrade3(grade2Kit568.length === 0, `Kit 568 remains in grade 2 (${grade2Kit568.length} records).`);
  assertGrade3(grade3Kit568.length === 52, `Kit 568 must have 52 canonical grade-3 records, found ${grade3Kit568.length}.`);
  const urls = grade3Kit568.map((record) => record.url);
  assertGrade3(new Set(urls).size === urls.length, 'Kit 568 grade-3 canonical URLs are not unique.');
}

export function validateManifestGrade3RussianSource(source) {
  assertGrade3(source?.id === 'grade-3-russian', 'Manifest grade-3 Russian route is missing.');
  assertGrade3(source.grade === 3 && source.grade_group === '1-4', 'Manifest grade/group differs.');
  assertGrade3(source.subject === 'russian' && source.subject_et === 'vene keel', 'Manifest subject differs.');
  assertGrade3(JSON.stringify(source.languages) === JSON.stringify(['ru']), 'Manifest languages must contain ru only.');
  assertGrade3(source.source_archive === grade3RussianArchive.path, 'Manifest must use the original grade-3 Russian archive.');
  assertGrade3(source.record_count === grade3RussianArchive.canonical_records, `Manifest record_count must be ${grade3RussianArchive.canonical_records}.`);
}

export function assertGeneratedArtifact(current, expected, label) {
  assertGrade3(current === expected, `${label} is stale.`);
}
