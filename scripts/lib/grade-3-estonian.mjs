import { createHash } from 'node:crypto';

import {
  containsUnprocessedPayload,
  mixedScriptWords,
  normalizeQualityText,
  sanitizeCapturedTaskExample,
} from './grade-2-content-quality.mjs';

export const grade3EstonianArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_ilus_emakeel_opiq_v2.zip',
  sha256: '76745111aa9ac75736418d6a3cb2958c0541182192522d71100a2140716972c7',
  byte_size: 2_272_881,
  member_count: 435,
  format_version: '2.0',
  capture_timestamp: '2026-07-22T22:19:43.868Z',
  source_records: 426,
  first_language_records: 363,
  second_language_records: 54,
});

export const requiredGrade3EstonianMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

const firstLanguageSubject = Object.freeze({
  en: 'Estonian language',
  et: 'eesti keel',
  ru: 'эстонский язык',
});
const secondLanguageSubject = Object.freeze({
  en: 'Estonian as a second language',
  et: 'eesti keel teise keelena',
  ru: 'эстонский язык как второй',
});

export const grade3EstonianRoutes = Object.freeze({
  'grade-3-estonian': Object.freeze({
    source_id: 'grade-3-estonian',
    subject: firstLanguageSubject,
    title: '3. klass eesti keel',
    query_description: 'grade 3 first-language Estonian',
    expected_records: 363,
    included_source_book_ids: Object.freeze([
      '3._klassi_eesti_keel',
      'eesti_keele_õpik_3._klassile',
    ]),
    forbidden_book_ids: Object.freeze([
      'eesti_keel_teise_keelena_3._klassile__kit140',
      'mina_loen_ja_kirjutan_3__kit590',
    ]),
    paired_source_id: 'grade-3-estonian-second-language',
  }),
  'grade-3-estonian-second-language': Object.freeze({
    source_id: 'grade-3-estonian-second-language',
    subject: secondLanguageSubject,
    title: '3. klass eesti keel teise keelena',
    query_description: 'grade 3 Estonian as a second language',
    expected_records: 54,
    included_source_book_ids: Object.freeze([
      'eesti_keel_teise_keelena_3._klassile',
    ]),
    forbidden_book_ids: Object.freeze([
      '3._klassi_eesti_keel__kit135',
      'eesti_keele_õpik_3._klassile__kit179',
      'mina_loen_ja_kirjutan_3__kit590',
    ]),
    paired_source_id: 'grade-3-estonian',
  }),
});

const variantRows = [
  {
    source_book_id: '3._klassi_eesti_keel',
    kit_id: '135',
    canonical_book_id: '3._klassi_eesti_keel__kit135',
    title: 'ILUS EMAKEEL',
    route_id: 'grade-3-estonian',
    source_records: 187,
    canonical_records: 185,
    source_grade: 2,
    cover_only: false,
  },
  {
    source_book_id: 'eesti_keel_teise_keelena_3._klassile',
    kit_id: '140',
    canonical_book_id: 'eesti_keel_teise_keelena_3._klassile__kit140',
    title: 'KOOS ON VAHVA. Sõprade seiklused',
    route_id: 'grade-3-estonian-second-language',
    source_records: 56,
    canonical_records: 54,
    source_grade: 3,
    cover_only: false,
  },
  {
    source_book_id: 'eesti_keele_õpik_3._klassile',
    kit_id: '179',
    canonical_book_id: 'eesti_keele_õpik_3._klassile__kit179',
    title: 'Eesti keele õpik 3. klassile',
    route_id: 'grade-3-estonian',
    source_records: 181,
    canonical_records: 178,
    source_grade: 2,
    cover_only: false,
  },
  {
    source_book_id: 'mina_loen_ja_kirjutan_3',
    kit_id: '590',
    canonical_book_id: 'mina_loen_ja_kirjutan_3__kit590',
    title: 'Mina loen ja kirjutan 3',
    route_id: null,
    source_records: 2,
    canonical_records: 0,
    source_grade: 3,
    cover_only: true,
  },
];

export const grade3EstonianVariants = Object.freeze(Object.fromEntries(variantRows.map((row) => [
  row.source_book_id,
  Object.freeze({
    ...row,
    publisher: '',
    language: 'et',
    programme_type: 'ordinary_curriculum',
    title_evidence: 'captured Kit Details title, source Book ID, index inventory, and raw book metadata',
  }),
])));

export const grade3EstonianLanguageNormalizations = Object.freeze({
  'https://www.opiq.ee/kit/135/chapter/7352': Object.freeze({
    source_language: 'en',
    canonical_language: 'et',
    evidence: 'The title and every captured heading are Estonian; no English instructional text is present.',
  }),
  'https://www.opiq.ee/kit/140/chapter/7788': Object.freeze({
    source_language: 'ru',
    canonical_language: 'et',
    evidence: 'The title and instructional headings are Estonian. One bilingual vocabulary gloss (tigu – улитка) is retained and does not make the page Russian-language.',
  }),
});

const grade3EstonianTextCorrections = Object.freeze({
  'https://www.opiq.ee/kit/140/chapter/7822': Object.freeze({
    normalized_heading: 'MUKI AJAB ASJU I I',
    canonical_heading: 'MUKI AJAB ASJU II',
    evidence: 'The same captured record title is “Muki ajab asju II”; the separated Roman numeral is an extractor artifact caused by two zero-width characters.',
  }),
});

const sourceMathematics = 'mathematics / matemaatika / математика';
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const languageNormalizationUrls = new Set(Object.keys(grade3EstonianLanguageNormalizations));

export function assertGrade3Estonian(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertGrade3EstonianArchiveIdentity(bytes) {
  assertGrade3Estonian(
    bytes.length === grade3EstonianArchive.byte_size,
    `Original archive byte size is ${bytes.length}; expected ${grade3EstonianArchive.byte_size}.`,
  );
  const actual = sha256Bytes(bytes);
  assertGrade3Estonian(
    actual === grade3EstonianArchive.sha256,
    `Original archive checksum is ${actual}; expected ${grade3EstonianArchive.sha256}.`,
  );
}

export function assertSafeMemberName(name) {
  assertGrade3Estonian(typeof name === 'string' && name.length > 0, 'ZIP member name must be non-empty.');
  assertGrade3Estonian(!name.startsWith('/') && !/^[A-Za-z]:[\\/]/u.test(name), `ZIP member has an absolute path: ${name}`);
  assertGrade3Estonian(!name.includes('\\'), `ZIP member contains a backslash: ${name}`);
  assertGrade3Estonian(!name.split('/').includes('..'), `ZIP member traverses outside the archive: ${name}`);
}

export function assertRequiredGrade3EstonianMembers(memberNames) {
  const names = new Set(memberNames);
  requiredGrade3EstonianMembers.forEach((name) => assertGrade3Estonian(
    names.has(name),
    `Original archive is missing required member ${name}.`,
  ));
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

function groupBy(records, selector) {
  const groups = new Map();
  for (const record of records) {
    const key = selector(record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return groups;
}

function isDetail(record) {
  return /^https:\/\/www\.opiq\.ee\/Kit\/Details\/\d+$/u.test(record.url);
}

function isAdministrative(record) {
  return normalizeQualityText(record.title).toLocaleLowerCase() === 'impressum'
    || record.headings.some((heading) => normalizeQualityText(heading).toLocaleLowerCase() === 'impressum');
}

function differingFields(records) {
  const fields = [
    'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
    'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
    'task_examples',
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
    const sanitized = sanitizeCapturedTaskExample(value).text;
    return normalizeQualityText(sanitized.replace(/<[^>]+>/gu, ' '));
  }).filter(Boolean))];
}

function replaceAutomaticSubjectAlias(values, forbidden, required) {
  const forbiddenKey = normalizeQualityText(forbidden).toLocaleLowerCase();
  const requiredKey = normalizeQualityText(required).toLocaleLowerCase();
  const retained = normalizeList(values).filter(
    (value) => normalizeQualityText(value).toLocaleLowerCase() !== forbiddenKey,
  );
  return [required, ...retained.filter(
    (value) => normalizeQualityText(value).toLocaleLowerCase() !== requiredKey,
  )];
}

function repairDetails(source, canonical) {
  const changes = [];
  for (const field of ['title', 'headings', 'task_examples']) {
    if (JSON.stringify(source[field]) !== JSON.stringify(canonical[field])) {
      changes.push({ field, source_value: source[field], canonical_value: canonical[field] });
    }
  }
  if (changes.length === 0) return null;
  const serialized = JSON.stringify({
    title: source.title,
    headings: source.headings,
    task_examples: source.task_examples,
  });
  const categories = [];
  if (/\u00ad/u.test(serialized)) categories.push('discretionary_soft_hyphen_removed');
  if (/[\u200b-\u200d\u2060\ufeff]/u.test(serialized)) categories.push('invisible_spacing_control_removed');
  if (/\{"d|<\/?[A-Za-z][^>]*>/u.test(serialized)) categories.push('extractor_payload_removed');
  if (grade3EstonianTextCorrections[source.url]) categories.push('same_record_heading_alignment');
  if (categories.length === 0) categories.push('deterministic_text_normalization');
  return {
    url: canonical.url,
    source_book_id: canonical.source_book_id,
    kit_id: canonical.kit_id,
    categories,
    changes,
    evidence: grade3EstonianTextCorrections[source.url]?.evidence
      ?? 'The canonical text is a deterministic normalization of the same captured source record.',
    transformation: 'NFC; remove discretionary soft hyphens; replace zero-width spacing controls with spaces; collapse whitespace; apply an audited same-record heading correction where declared.',
  };
}

function normalizeInstructionalRecord(record) {
  const variant = grade3EstonianVariants[record.book_id];
  assertGrade3Estonian(variant, `Unknown grade-3 Estonian Source Book ID: ${record.book_id}`);
  assertGrade3Estonian(!variant.cover_only, `Cover-only kit ${variant.kit_id} cannot provide instructional evidence.`);
  assertGrade3Estonian(kitId(record) === variant.kit_id, `${record.url} uses the wrong kit for ${record.book_id}.`);
  assertGrade3Estonian(record.grade === variant.source_grade, `${record.url} raw grade is ${record.grade}; expected ${variant.source_grade}.`);
  assertGrade3Estonian(sourceSubject(record) === sourceMathematics, `${record.url} no longer has the audited automatic mathematics source label.`);

  const route = grade3EstonianRoutes[variant.route_id];
  assertGrade3Estonian(route, `${record.url} has no canonical route.`);
  const languageDecision = grade3EstonianLanguageNormalizations[record.url];
  let language = record.language;
  if (languageDecision) {
    assertGrade3Estonian(
      language === languageDecision.source_language,
      `${record.url} no longer has the audited ${languageDecision.source_language} source-language anomaly.`,
    );
    language = languageDecision.canonical_language;
  } else {
    assertGrade3Estonian(language === variant.language, `${record.url} has unaudited source language ${language}.`);
  }

  const textCorrection = grade3EstonianTextCorrections[record.url];
  const headings = normalizeList(record.headings).map((heading) => (
    heading === textCorrection?.normalized_heading ? textCorrection.canonical_heading : heading
  ));
  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: variant.title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.source_book_id,
    chapter_id: String(record.chapter_id),
    grade: 3,
    subject_en: route.subject.en,
    subject_et: route.subject.et,
    subject_ru: route.subject.ru,
    language,
    publisher: variant.publisher,
    programme_type: variant.programme_type,
    kit_id: variant.kit_id,
    topics_et: replaceAutomaticSubjectAlias(record.topics_et, 'matemaatika', route.subject.et),
    topics_ru: replaceAutomaticSubjectAlias(record.topics_ru, 'математика', route.subject.ru),
    topics_en: replaceAutomaticSubjectAlias(record.topics_en, 'mathematics', route.subject.en),
    headings,
    task_examples: normalizeTasks(record.task_examples),
  };
  validateGrade3EstonianCanonicalRecord(canonical, variant.route_id);
  return { canonical, route_id: variant.route_id, repair: repairDetails(record, canonical) };
}

export function validateGrade3EstonianCanonicalRecord(record, routeId) {
  const route = grade3EstonianRoutes[routeId];
  assertGrade3Estonian(route, `Unknown grade-3 Estonian route ${routeId}.`);
  const match = record.url.match(directChapterUrl);
  assertGrade3Estonian(match, `Canonical record is not a direct chapter URL: ${record.url}`);
  assertGrade3Estonian(match[1] === record.kit_id, `${record.url} kit differs from ${record.kit_id}.`);
  assertGrade3Estonian(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3Estonian(sourceSubject(record) === sourceSubject({
    subject_en: route.subject.en,
    subject_et: route.subject.et,
    subject_ru: route.subject.ru,
  }), `${record.url} canonical subject differs from ${routeId}.`);
  assertGrade3Estonian(record.language === 'et', `${record.url} canonical language must be et.`);
  assertGrade3Estonian(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3Estonian(normalizeQualityText(record.title).toLocaleLowerCase() !== 'impressum', `${record.url} administrative Impressum cannot be canonical.`);
  assertGrade3Estonian(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  const variant = grade3EstonianVariants[record.source_book_id];
  assertGrade3Estonian(variant?.canonical_book_id === record.book_id, `${record.url} has an unaudited Book ID.`);
  assertGrade3Estonian(!variant.cover_only, `Cover-only kit ${variant.kit_id} cannot provide instructional evidence.`);
  assertGrade3Estonian(variant.route_id === routeId, `${record.url} belongs to ${variant.route_id}, not ${routeId}.`);
  assertGrade3Estonian(record.book === variant.title, `${record.url} canonical book title differs from captured Kit Details evidence.`);
  assertGrade3Estonian(record.publisher === variant.publisher, `${record.url} contains invented publisher metadata.`);
  assertGrade3Estonian(record.programme_type === 'ordinary_curriculum', `${record.url} programme type must be ordinary_curriculum.`);
  const text = [
    record.title, record.book, record.book_id, record.source_book_id, record.publisher,
    ...record.topics_et, ...record.topics_ru, ...record.topics_en,
    ...record.headings, ...record.task_examples,
  ].join('\n');
  assertGrade3Estonian(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3Estonian(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3Estonian(!/[\u200b-\u200d\u2060\ufeff\u00ad]/u.test(text), `${record.url} contains an invisible or discretionary control character.`);
  assertGrade3Estonian(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
}

export function buildGrade3EstonianCatalog(sourceRecords) {
  assertGrade3Estonian(
    sourceRecords.length === grade3EstonianArchive.source_records,
    `Original archive has ${sourceRecords.length} source records; expected ${grade3EstonianArchive.source_records}.`,
  );
  const sourceCounts = countBy(sourceRecords, (record) => record.book_id);
  for (const variant of Object.values(grade3EstonianVariants)) {
    assertGrade3Estonian(
      sourceCounts[variant.source_book_id] === variant.source_records,
      `${variant.source_book_id} has ${sourceCounts[variant.source_book_id] ?? 0} rows; expected ${variant.source_records}.`,
    );
  }

  const duplicateGroups = [...groupBy(sourceRecords, (record) => record.url).entries()]
    .filter(([, records]) => records.length > 1);
  assertGrade3Estonian(duplicateGroups.length === 4, `Archive has ${duplicateGroups.length} duplicate URL groups; expected 4.`);
  const duplicateAudit = duplicateGroups.map(([url, records]) => {
    assertGrade3Estonian(records.length === 2, `${url} must have exactly two captured aliases.`);
    assertGrade3Estonian(records.every(isDetail), `${url} duplicate group is not a Kit Details page.`);
    const differing = differingFields(records);
    assertGrade3Estonian(JSON.stringify(differing) === JSON.stringify(['chapter_id']), `${url} duplicate records conflict in ${differing.join(', ') || '<none>'}.`);
    return {
      url,
      kit_id: kitId(url),
      source_book_id: records[0].book_id,
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_unique_detail_and_duplicate_alias',
      reason: 'Both records represent the same non-instructional Kit Details page and differ only by synthetic chapter ID.',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));

  const seenDetailUrls = new Set();
  const routeRecords = new Map(Object.keys(grade3EstonianRoutes).map((routeId) => [routeId, []]));
  const coverDetails = [];
  const duplicateAliases = [];
  const administrative = [];
  const contentRepairs = [];
  for (const record of sourceRecords) {
    const variant = grade3EstonianVariants[record.book_id];
    assertGrade3Estonian(variant, `Unknown grade-3 Estonian Source Book ID: ${record.book_id}`);
    assertGrade3Estonian(kitId(record) === variant.kit_id, `${record.url} is outside kit ${variant.kit_id}.`);
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
    const { canonical, route_id: routeId, repair } = normalizeInstructionalRecord(record);
    routeRecords.get(routeId).push(canonical);
    if (repair) contentRepairs.push(repair);
  }

  assertGrade3Estonian(coverDetails.length === 4, `Unique Kit Details count is ${coverDetails.length}; expected 4.`);
  assertGrade3Estonian(duplicateAliases.length === 4, `Duplicate Kit Details alias count is ${duplicateAliases.length}; expected 4.`);
  assertGrade3Estonian(administrative.length === 1, `Administrative count is ${administrative.length}; expected 1.`);
  for (const route of Object.values(grade3EstonianRoutes)) {
    const records = routeRecords.get(route.source_id);
    assertGrade3Estonian(records.length === route.expected_records, `${route.source_id} has ${records.length} pages; expected ${route.expected_records}.`);
    assertGrade3Estonian(new Set(records.map((record) => record.url)).size === records.length, `${route.source_id} has duplicate canonical URLs.`);
  }
  const allCanonical = [...routeRecords.values()].flat();
  assertGrade3Estonian(allCanonical.length === 417, `Canonical union has ${allCanonical.length} pages; expected 417.`);
  assertGrade3Estonian(new Set(allCanonical.map((record) => record.url)).size === allCanonical.length, 'The two grade-3 Estonian routes overlap by URL.');
  assertGrade3Estonian(!allCanonical.some((record) => record.source_book_id === 'mina_loen_ja_kirjutan_3'), 'Cover-only kit 590 entered canonical page evidence.');
  for (const variant of Object.values(grade3EstonianVariants).filter((entry) => !entry.cover_only)) {
    const records = routeRecords.get(variant.route_id).filter((record) => record.book_id === variant.canonical_book_id);
    assertGrade3Estonian(records.length === variant.canonical_records, `${variant.canonical_book_id} has ${records.length} pages; expected ${variant.canonical_records}.`);
  }
  assertGrade3Estonian(languageNormalizationUrls.size === 2, 'Exactly two language normalization decisions are required.');
  for (const url of languageNormalizationUrls) {
    assertGrade3Estonian(allCanonical.some((record) => record.url === url && record.language === 'et'), `Language-normalized page is missing: ${url}`);
  }

  return {
    route_records: Object.fromEntries(routeRecords),
    canonical_records: allCanonical,
    exclusions: { cover_details: coverDetails, duplicate_aliases: duplicateAliases, administrative },
    duplicate_audit: duplicateAudit,
    content_repairs: contentRepairs,
  };
}

function markdownField(label, value) {
  return value ? `- ${label}: ${value}` : `- ${label}:`;
}

export function renderGrade3EstonianMarkdown(routeId, catalog) {
  const route = grade3EstonianRoutes[routeId];
  assertGrade3Estonian(route, `Unknown grade-3 Estonian route ${routeId}.`);
  const records = catalog.route_records[routeId];
  const variants = route.included_source_book_ids.map((bookId) => grade3EstonianVariants[bookId]);
  const lines = [
    `# Opiq lookup: ${route.title}`,
    '',
    `Use this file only for ${route.query_description} requests. Search by title, topic, heading, book, and direct Opiq URL.`,
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3EstonianArchive.path}\``,
    `- Archive SHA-256: \`${grade3EstonianArchive.sha256}\``,
    `- Capture timestamp: ${grade3EstonianArchive.capture_timestamp}`,
    `- Format version: ${grade3EstonianArchive.format_version}`,
    '- Class: 3',
    `- Subject: ${sourceSubject({ subject_en: route.subject.en, subject_et: route.subject.et, subject_ru: route.subject.ru })}`,
    '- Page language: Estonian',
    `- Shared source records: ${grade3EstonianArchive.source_records}`,
    `- Page records included in this route: ${records.length}`,
    '- Unique Kit Details records excluded from the shared archive: 4',
    '- Duplicate Kit Details aliases excluded from the shared archive: 4',
    '- Administrative Impressum records excluded from the shared archive: 1',
    '- Cover-only kit 590 is not available as page-level instructional evidence.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const variant of variants) {
    lines.push(`- \`${variant.canonical_book_id}\` — ${variant.title}; Source Book ID \`${variant.source_book_id}\`; kit ${variant.kit_id}; publisher not captured; et; ${variant.canonical_records} pages; ordinary curriculum.`);
  }
  lines.push('', '## Pages', '');
  records.forEach((record, index) => lines.push(
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
    markdownField('Topics ET', record.topics_et.join('; ')),
    markdownField('Topics RU', record.topics_ru.join('; ')),
    markdownField('Topics EN', record.topics_en.join('; ')),
    markdownField('Headings', record.headings.join('; ')),
    markdownField('Task examples', record.task_examples.join('; ')),
    '',
  ));
  return `${lines.join('\n').trimEnd()}\n`;
}

export function buildGrade3EstonianContentQualityAudit(records) {
  const mixedScript = records.flatMap((record) => {
    const words = mixedScriptWords([record.title, record.headings, record.task_examples]);
    return words.length === 0 ? [] : [{
      url: record.url,
      title: record.title,
      words,
      classification: 'source_typography_or_bilingual_vocabulary',
      disposition: 'retained unless the same archive record proves a technical encoding defect',
    }];
  });
  const shortRecords = records.filter((record) => [record.title, ...record.headings].join(' ').length < 30)
    .map((record) => ({
      url: record.url,
      title: record.title,
      classification: 'valid_short_source_section',
    }));
  const titleGroups = groupBy(records, (record) => record.title);
  const repeatedTitles = [...titleGroups.entries()].filter(([, group]) => group.length > 1)
    .map(([title, group]) => ({
      title,
      urls: group.map((record) => record.url),
      classification: 'distinct_direct_URLs_across_sections_or_books',
    }));
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
      note: 'The capture contains no task examples. Missing tasks, repeated titles, and short section headings are source-structure observations, not automatic errors.',
    },
  };
}

export function validateManifestGrade3EstonianRoutes(first, second) {
  const expectations = [
    [first, grade3EstonianRoutes['grade-3-estonian'], grade3EstonianArchive.first_language_records],
    [second, grade3EstonianRoutes['grade-3-estonian-second-language'], grade3EstonianArchive.second_language_records],
  ];
  for (const [source, route, count] of expectations) {
    assertGrade3Estonian(source?.id === route.source_id, `Manifest route ${route.source_id} is missing.`);
    assertGrade3Estonian(source.source_archive === grade3EstonianArchive.path, `${route.source_id} must use the original shared archive.`);
    assertGrade3Estonian(source.record_count === count, `${route.source_id} record_count must be ${count}.`);
    assertGrade3Estonian(JSON.stringify(source.languages) === JSON.stringify(['et']), `${route.source_id} languages must be ["et"].`);
    assertGrade3Estonian(
      JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(route.subject),
      `${route.source_id} canonical subject policy differs from the audited route.`,
    );
    assertGrade3Estonian(source.canonical_url_policy?.require_unique === true, `${route.source_id} must require unique URLs.`);
    assertGrade3Estonian(
      JSON.stringify([...(source.subject_boundary?.forbidden_book_ids ?? [])].sort())
        === JSON.stringify([...route.forbidden_book_ids].sort()),
      `${route.source_id} reciprocal forbidden Book IDs differ from the audited boundary.`,
    );
  }
}

export function assertGeneratedArtifact(current, expected, label) {
  assertGrade3Estonian(current === expected, `${label} is stale.`);
}
