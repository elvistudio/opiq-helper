#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readCompactZip, readZipText, requireZipMember } from './lib/compact-zip.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(repositoryRoot, 'source-manifest.json');
const generatorPath = 'scripts/generate-grade-2-source-indexes.mjs';
const defaultGeneratorVersion = '1.0';
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');

const configurations = [
  {
    sourceId: 'grade-2-mathematics',
    expectedSourceRecords: 485,
    expectedCanonicalRecords: 464,
    expectedCoverRecords: 16,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 8,
    subject: { en: 'mathematics', et: 'matemaatika', ru: 'математика' },
    title: '2. klass matemaatika',
    queryDescription: 'grade 2 mathematics',
    simplifiedBookIds: new Set(['harno_matemaatik_2_et']),
    supplementaryBookIds: new Set(),
    canonicalBookTitles: new Map(),
    excludedBookIds: new Map(),
  },
  {
    sourceId: 'grade-2-science',
    expectedSourceRecords: 428,
    expectedCanonicalRecords: 286,
    expectedCoverRecords: 18,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 9,
    subject: { en: 'science', et: 'loodusõpetus', ru: 'природоведение' },
    title: '2. klass loodusõpetus',
    queryDescription: 'grade 2 science',
    simplifiedBookIds: new Set(['ministeerium_loodusõpet_2_et']),
    supplementaryBookIds: new Set(),
    canonicalBookTitles: new Map(),
    excludedBookIds: new Map([
      ['avita_loodus-_ja_2_et', 'Mixed loodus- ja inimeseõpetus book; its Estonian pages are already routed through grade-2-human-studies.'],
      ['avita_природа_и__2_ru', 'Mixed nature-and-human-studies book; excluded to keep the science route subject-pure.'],
    ]),
  },
  {
    sourceId: 'grade-2-arts-and-crafts',
    generatorVersion: '1.1',
    expectedSourceRecords: 269,
    expectedCanonicalRecords: 263,
    expectedCoverRecords: 6,
    expectedAdministrativeRecords: 0,
    expectedDuplicateGroups: 3,
    subject: { en: 'arts and crafts', et: 'kunst ja tööõpetus', ru: 'трудовое обучение и искусство' },
    title: '2. klass kunst ja tööõpetus',
    queryDescription: 'grade 2 arts-and-crafts',
    simplifiedBookIds: new Set(),
    supplementaryBookIds: new Set(['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid']),
    canonicalBookTitles: new Map([
      ['kunsti-_ja_tööõpetus._2._osa', 'Kunsti- ja tööõpetus. 2. osa'],
      ['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid', 'Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid'],
      ['трудовое_обучение_и_искусство._2_часть', 'Трудовое обучение и искусство. 2 часть'],
    ]),
    expectedBooks: new Map([
      ['kunsti-_ja_tööõpetus._2._osa', { kit: '192', language: 'et', pages: 89 }],
      ['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid', { kit: '200', language: 'et', pages: 85 }],
      ['трудовое_обучение_и_искусство._2_часть', { kit: '371', language: 'ru', pages: 89 }],
    ]),
    metadataLimitations: [
      'The export does not record publisher names.',
      'The compact index and page records are authoritative for language; raw per-book files incorrectly label the two Estonian books as Russian.',
      'Repeated page titles are retained because their canonical chapter URLs and instructional contexts are distinct.',
    ],
    excludedBookIds: new Map(),
  },
  {
    sourceId: 'grade-2-music',
    generatorVersion: '1.2',
    expectedSourceRecords: 329,
    expectedCanonicalRecords: 317,
    expectedCoverRecords: 10,
    expectedAdministrativeRecords: 2,
    expectedDuplicateGroups: 5,
    expectedDuplicateTitleGroups: 31,
    expectedDuplicateTitleRecords: 65,
    subject: { en: 'music', et: 'muusika', ru: 'музыка' },
    title: '2. klass muusika',
    queryDescription: 'grade 2 music',
    simplifiedBookIds: new Set(),
    supplementaryBookIds: new Set(['eesti_pärimusmuusika_keskuse_õppevideod']),
    canonicalBookTitles: new Map([
      ['2._klassi_muusikaõpetus', 'Muusikamaa'],
      ['eesti_pärimusmuusika_keskuse_õppevideod', 'Eesti Pärimusmuusika Keskuse õppevideod'],
      ['muusikaõpik_2._klassile', 'Muusikaõpik 2. klassile'],
      ['muusikaõpik_2._klassile_2024', 'Muusikaõpik 2. klassile 2024'],
      ['музыка_–_волшебная_страна._2_класс', 'Музыка – волшебная страна. 2 класс'],
    ]),
    expectedBooks: new Map([
      ['2._klassi_muusikaõpetus', { kit: '188', language: 'et', pages: 116 }],
      ['eesti_pärimusmuusika_keskuse_õppevideod', { kit: '465', language: 'et', pages: 33 }],
      ['muusikaõpik_2._klassile', { kit: '193', language: 'et', pages: 29 }],
      ['muusikaõpik_2._klassile_2024', { kit: '556', language: 'et', pages: 28 }],
      ['музыка_–_волшебная_страна._2_класс', { kit: '238', language: 'ru', pages: 111 }],
    ]),
    metadataLimitations: [
      'The export does not record publisher names.',
      'Thirty-one canonical title groups repeat across distinct chapter URLs; they are retained as separate edition, language, or instructional contexts.',
      'Two Book IDs contain discretionary soft hyphens; the canonical IDs remove only those invisible formatting characters.',
      'The heritage-music video collection is supplementary material and is not treated as the ordinary core.',
    ],
    excludedBookIds: new Map(),
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function repositoryPath(relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.trim(), `${label} must be a non-empty path.`);
  assert(!path.isAbsolute(relativePath), `${label} must be repository-relative.`);
  assert(!relativePath.includes('\\') && !relativePath.split('/').includes('..'), `${label} must be a safe POSIX path.`);
  const absolute = path.resolve(repositoryRoot, relativePath);
  assert(absolute !== repositoryRoot && absolute.startsWith(`${repositoryRoot}${path.sep}`), `${label} points outside the repository.`);
  return absolute;
}

async function requireFile(relativePath, label) {
  const absolute = repositoryPath(relativePath, label);
  const fileStat = await stat(absolute).catch(() => null);
  assert(fileStat?.isFile(), `${label} is missing: ${relativePath}`);
  return absolute;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function parseJsonl(text, label) {
  return text.split(/\r?\n/u).filter((line) => line.trim()).map((line, index) => {
    const record = parseJson(line, `${label} line ${index + 1}`);
    assert(isPlainObject(record), `${label} line ${index + 1} must be an object.`);
    for (const field of [
      'title', 'url', 'book', 'book_id', 'chapter_id', 'grade', 'subject_et', 'subject_ru',
      'subject_en', 'language', 'publisher', 'topics_et', 'topics_ru', 'topics_en', 'headings',
      'task_examples',
    ]) assert(Object.hasOwn(record, field), `${label} line ${index + 1} is missing ${field}.`);
    assert(/^https:\/\/(?:www\.)?opiq\.ee\//iu.test(record.url), `${label} line ${index + 1} has an invalid Opiq URL.`);
    assert(record.grade === 2, `${label} line ${index + 1} has grade ${record.grade}; expected 2.`);
    assert(['et', 'ru'].includes(record.language), `${label} line ${index + 1} has unsupported page language ${record.language}.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assert(Array.isArray(record[field]), `${label} line ${index + 1} field ${field} must be an array.`);
    }
    return { ...record, source_position: index + 1 };
  });
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\u00ad', '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

function canonicalSubject(subject) {
  return `${subject.en} / ${subject.et} / ${subject.ru}`;
}

function markdownField(label, value) {
  const text = String(value ?? '');
  return `- ${label}:${text ? ` ${text}` : ''}`;
}

function kitId(url) {
  return url.match(/\/kit\/(\d+)/iu)?.[1] ?? url.match(/\/Kit\/Details\/(\d+)/u)?.[1] ?? '';
}

function isCoverDetail(record) {
  return /\/Kit\/Details\//iu.test(record.url);
}

function isAdministrative(record) {
  return /impressum|импрессум/iu.test([record.title, ...record.headings].join(' '));
}

function countBy(records, selector) {
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
    const values = groups.get(key) ?? [];
    values.push(record);
    groups.set(key, values);
  }
  return groups;
}

function normalizeTopicList(values, forbiddenAliases, requiredAlias) {
  const forbidden = new Set(forbiddenAliases.map((value) => value.toLocaleLowerCase()));
  const retained = values.map(normalizeText).filter(Boolean).filter((value) => !forbidden.has(value.toLocaleLowerCase()));
  return [requiredAlias, ...retained.filter((value) => value.toLocaleLowerCase() !== requiredAlias.toLocaleLowerCase())];
}

function normalizeRecord(record, configuration) {
  const canonicalBookId = normalizeText(record.book_id);
  const normalized = {
    ...record,
    title: normalizeText(record.title),
    url: normalizeText(record.url),
    book: configuration.canonicalBookTitles.get(canonicalBookId)
      ?? normalizeText(record.book).replace(/\s+2\s+klass$/iu, ''),
    book_id: canonicalBookId,
    chapter_id: normalizeText(record.chapter_id),
    language: normalizeText(record.language).toLowerCase(),
    publisher: normalizeText(record.publisher),
    headings: record.headings.map(normalizeText).filter(Boolean),
    task_examples: record.task_examples.map(normalizeText).filter(Boolean),
  };
  const publisherNames = new Map([['avita', 'Avita'], ['harno', 'Harno']]);
  normalized.publisher = publisherNames.get(normalized.publisher.toLocaleLowerCase()) ?? normalized.publisher;
  normalized.subject_en = configuration.subject.en;
  normalized.subject_et = configuration.subject.et;
  normalized.subject_ru = configuration.subject.ru;
  normalized.topics_et = normalizeTopicList(record.topics_et, ['matemaatika', 'loodusõpetus'], configuration.subject.et);
  normalized.topics_ru = normalizeTopicList(record.topics_ru, ['математика', 'природоведение'], configuration.subject.ru);
  normalized.topics_en = normalizeTopicList(record.topics_en, ['mathematics', 'science'], configuration.subject.en);
  return normalized;
}

function programmeType(bookId, configuration) {
  if (configuration.simplifiedBookIds.has(bookId)) return 'simplified_curriculum';
  if (configuration.supplementaryBookIds.has(bookId)) return 'supplementary';
  return 'ordinary_curriculum';
}

function programmeDescription(bookId, configuration) {
  const programme = programmeType(bookId, configuration);
  if (programme === 'simplified_curriculum') return 'simplified curriculum; use only with explicit labelling';
  if (programme === 'supplementary') return 'supplementary material; do not treat as the ordinary core without explicit labelling';
  return 'ordinary curriculum';
}

function auditDuplicateUrls(records, configuration) {
  const duplicateGroups = [...groupBy(records, (record) => record.url).entries()].filter(([, matches]) => matches.length > 1);
  assert(duplicateGroups.length === configuration.expectedDuplicateGroups, `${configuration.sourceId}: duplicate URL group count changed.`);
  const entries = duplicateGroups.map(([url, matches]) => {
    assert(matches.length === 2, `${configuration.sourceId}: duplicate ${url} must contain exactly two records.`);
    assert(matches.every(isCoverDetail), `${configuration.sourceId}: non-cover duplicate requires manual review: ${url}`);
    return {
      url,
      source_positions: matches.map((record) => record.source_position),
      book_ids: [...new Set(matches.map((record) => normalizeText(record.book_id)))],
      chapter_ids: matches.map((record) => normalizeText(record.chapter_id)),
      decision: 'exclude_all_cover_detail_records',
      reason: 'The repeated URL is a kit detail page, not a chapter-level instructional page.',
    };
  });
  return { duplicateGroups, entries };
}

function auditDuplicateTitles(records, configuration) {
  if (configuration.expectedDuplicateTitleGroups === undefined) return null;
  const groups = [...groupBy(records, (record) => record.title).entries()]
    .filter(([, matches]) => matches.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
  const recordCount = groups.reduce((total, [, matches]) => total + matches.length, 0);
  assert(groups.length === configuration.expectedDuplicateTitleGroups, `${configuration.sourceId}: repeated canonical title group count changed.`);
  assert(recordCount === configuration.expectedDuplicateTitleRecords, `${configuration.sourceId}: repeated canonical title record count changed.`);
  return {
    groups: groups.length,
    records: recordCount,
    entries: groups.map(([title, matches]) => ({
      title,
      urls: matches.map((record) => record.url),
      book_ids: [...new Set(matches.map((record) => record.book_id))],
      languages: [...new Set(matches.map((record) => record.language))].sort(),
      decision: 'retain_distinct_canonical_chapters',
      reason: 'Equal titles do not prove duplicate instructional content; canonical URLs and chapter contexts differ.',
    })),
  };
}

function canonicalize(records, configuration) {
  const coverRecords = records.filter(isCoverDetail);
  const administrativeRecords = records.filter((record) => !isCoverDetail(record) && isAdministrative(record));
  const excludedBookRecords = records.filter((record) => !isCoverDetail(record)
    && !isAdministrative(record) && configuration.excludedBookIds.has(normalizeText(record.book_id)));
  const candidates = records.filter((record) => !isCoverDetail(record)
    && !isAdministrative(record) && !configuration.excludedBookIds.has(normalizeText(record.book_id)));
  const subjectNormalizationAudit = [];
  const canonicalRecords = candidates.map((record) => {
    const normalized = normalizeRecord(record, configuration);
    if (sourceSubject(record) !== canonicalSubject(configuration.subject)) {
      subjectNormalizationAudit.push({
        source_position: record.source_position,
        url: record.url,
        book_id: normalizeText(record.book_id),
        source_subject: sourceSubject(record),
        canonical_subject: canonicalSubject(configuration.subject),
        decision: 'correct_automatic_subject_label',
      });
    }
    return normalized;
  });
  const urls = canonicalRecords.map((record) => record.url);
  assert(new Set(urls).size === urls.length, `${configuration.sourceId}: canonical records contain duplicate URLs.`);
  assert(canonicalRecords.length === configuration.expectedCanonicalRecords, `${configuration.sourceId}: canonical count is ${canonicalRecords.length}; expected ${configuration.expectedCanonicalRecords}.`);
  assert(coverRecords.length === configuration.expectedCoverRecords, `${configuration.sourceId}: cover count changed.`);
  assert(administrativeRecords.length === configuration.expectedAdministrativeRecords, `${configuration.sourceId}: administrative count changed.`);
  assert(canonicalRecords.every((record) => sourceSubject(record) === canonicalSubject(configuration.subject)), `${configuration.sourceId}: canonical subject normalization failed.`);
  return { canonicalRecords, coverRecords, administrativeRecords, excludedBookRecords, subjectNormalizationAudit };
}

function renderMarkdown(configuration, source, index, state, duplicateAudit) {
  const { canonicalRecords, coverRecords, administrativeRecords, excludedBookRecords } = state;
  const bookGroups = [...groupBy(canonicalRecords, (record) => record.book_id).entries()]
    .sort(([left], [right]) => left.localeCompare(right));
  const lines = [
    `# Opiq lookup: ${configuration.title}`,
    '',
    `Use this file to answer ${configuration.queryDescription} requests only. Match queries against titles, topics, headings, task examples, books, and subject fields. Return direct Opiq page links.`,
    '',
    '## Source Summary',
    `- Source archive: \`${source.source_archive}\``,
    `- Format version: ${source.format_version}`,
    '- Class: 2',
    `- Subject ET: ${configuration.subject.et}`,
    `- Subject RU: ${configuration.subject.ru}`,
    `- Subject EN: ${configuration.subject.en}`,
    '- Page languages: Estonian, Russian',
    `- Source records: ${index.recordCount}`,
    `- Page records included: ${canonicalRecords.length}`,
    `- Cover/detail records excluded: ${coverRecords.length}`,
    `- Administrative records excluded: ${administrativeRecords.length}`,
    `- Duplicate source URL groups: ${duplicateAudit.duplicateGroups.length}; all were excluded kit-detail records`,
    `- Mixed-subject page records excluded: ${excludedBookRecords.length}`,
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const [bookId, records] of bookGroups) {
    const first = records[0];
    const kits = [...new Set(records.map((record) => kitId(record.url)))].sort().join(', ');
    const programme = programmeDescription(bookId, configuration);
    lines.push(`- \`${bookId}\` — ${first.book}; ${first.publisher || 'publisher not recorded'}; language ${first.language}; kit ${kits}; ${records.length} pages; ${programme}.`);
  }
  if (configuration.excludedBookIds.size > 0) {
    lines.push('', '## Subject-boundary exclusions');
    for (const [bookId, reason] of configuration.excludedBookIds) {
      const count = excludedBookRecords.filter((record) => normalizeText(record.book_id) === bookId).length;
      lines.push(`- \`${bookId}\`: ${count} instructional pages excluded. ${reason}`);
    }
  }
  lines.push('', '## Pages', '');
  canonicalRecords.forEach((record, indexPosition) => {
    const programme = programmeType(record.book_id, configuration);
    lines.push(
      `### ${indexPosition + 1}. ${record.title}`,
      `- URL: ${record.url}`,
      `- Book: ${record.book}`,
      `- Book ID: ${record.book_id}`,
      `- Chapter ID: ${record.chapter_id}`,
      '- Class: 2',
      `- Language: ${record.language}`,
      markdownField('Publisher', record.publisher),
      `- Subject: ${sourceSubject(record)}`,
      `- Programme type: ${programme}`,
      markdownField('Topics ET', record.topics_et.join('; ')),
      markdownField('Topics RU', record.topics_ru.join('; ')),
      markdownField('Topics EN', record.topics_en.join('; ')),
      markdownField('Headings', record.headings.join('; ')),
      markdownField('Task examples', record.task_examples.join('; ')),
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function bookMetadataAudit(records, configuration) {
  return Object.fromEntries([...groupBy(records, (record) => record.book_id).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bookId, matches]) => [bookId, {
      title: matches[0].book,
      publisher: matches[0].publisher,
      language: matches[0].language,
      kits: [...new Set(matches.map((record) => kitId(record.url)))].sort(),
      page_records: matches.length,
      programme_type: programmeType(bookId, configuration),
    }]));
}

function bookMetadataNormalizationAudit(records, canonicalRecords, configuration) {
  if (configuration.canonicalBookTitles.size === 0) return [];
  return [...groupBy(records, (record) => record.book_id).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sourceBookId, matches]) => {
      const canonicalBookId = normalizeText(sourceBookId);
      const canonicalMatches = canonicalRecords.filter((record) => record.book_id === canonicalBookId);
      return {
        source_book_id: sourceBookId,
        canonical_book_id: canonicalBookId,
        source_titles: [...new Set(matches.map((record) => normalizeText(record.book)))],
        canonical_title: configuration.canonicalBookTitles.get(canonicalBookId),
        source_records: matches.length,
        canonical_pages: canonicalMatches.length,
        languages: [...new Set(canonicalMatches.map((record) => record.language))].sort(),
        kits: [...new Set(matches.map((record) => kitId(record.url)))].filter(Boolean).sort(),
        decision: 'derive_specific_title_from_explicit_source_book_id_and_kit',
      };
    });
}

async function generateSource(manifest, configuration) {
  const source = manifest.sources.find((entry) => entry.id === configuration.sourceId);
  assert(source, `Manifest source ${configuration.sourceId} was not found.`);
  assert(source.canonical_url_policy?.require_unique === true, `${configuration.sourceId}: unique URL policy is required.`);
  assert(JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(configuration.subject), `${configuration.sourceId}: canonical subject policy differs from generator configuration.`);
  const archivePath = await requireFile(source.source_archive, `${configuration.sourceId} source archive`);
  const markdownPath = repositoryPath(source.md_path, `${configuration.sourceId} Markdown path`);
  const qaPath = repositoryPath(source.qa_path, `${configuration.sourceId} QA path`);
  const archive = await readCompactZip(archivePath);
  for (const member of ['index.json', 'opiq_lookup.jsonl', 'opiq_lookup.md', 'topic_map.json']) requireZipMember(archive, member);
  const index = parseJson(readZipText(archive, 'index.json'), `${configuration.sourceId} index.json`);
  const records = parseJsonl(readZipText(archive, 'opiq_lookup.jsonl'), `${configuration.sourceId} opiq_lookup.jsonl`);
  assert(index.formatVersion === source.format_version, `${configuration.sourceId}: archive format version differs from manifest.`);
  assert(index.recordCount === records.length, `${configuration.sourceId}: archive index count differs from JSONL.`);
  assert(index.recordCount === configuration.expectedSourceRecords, `${configuration.sourceId}: source record count changed.`);
  assert(index.rawArchiveIncluded === true, `${configuration.sourceId}: expected an archive with raw source data.`);
  assert(isPlainObject(parseJson(readZipText(archive, 'topic_map.json'), `${configuration.sourceId} topic_map.json`)), `${configuration.sourceId}: topic map root must be an object.`);
  assert(readZipText(archive, 'opiq_lookup.md').trim(), `${configuration.sourceId}: bundled compact Markdown is empty.`);
  const indexedBookIds = new Set((index.books ?? []).map((book) => normalizeText(book.id)));
  for (const bookId of new Set(records.map((record) => normalizeText(record.book_id)))) {
    assert(indexedBookIds.has(bookId), `${configuration.sourceId}: record Book ID ${bookId} is absent from index.json.`);
  }
  const duplicateAudit = auditDuplicateUrls(records, configuration);
  const state = canonicalize(records, configuration);
  const markdown = renderMarkdown(configuration, source, index, state, duplicateAudit);
  const canonicalRecords = state.canonicalRecords;
  const duplicateTitleAudit = auditDuplicateTitles(canonicalRecords, configuration);
  if (configuration.expectedBooks) {
    assert(configuration.expectedBooks.size === new Set(canonicalRecords.map((record) => record.book_id)).size, `${configuration.sourceId}: canonical book count changed.`);
    for (const [bookId, expected] of configuration.expectedBooks) {
      const matches = canonicalRecords.filter((record) => record.book_id === bookId);
      assert(matches.length === expected.pages, `${configuration.sourceId}: ${bookId} has ${matches.length} pages; expected ${expected.pages}.`);
      assert(matches.every((record) => record.language === expected.language), `${configuration.sourceId}: ${bookId} language differs from ${expected.language}.`);
      assert(JSON.stringify([...new Set(matches.map((record) => kitId(record.url)))]) === JSON.stringify([expected.kit]), `${configuration.sourceId}: ${bookId} kit differs from ${expected.kit}.`);
      assert(matches.every((record) => record.book === configuration.canonicalBookTitles.get(bookId)), `${configuration.sourceId}: ${bookId} canonical title normalization failed.`);
    }
  }
  const existingQa = await readFile(qaPath, 'utf8').then((contents) => parseJson(contents, source.qa_path), () => null);
  const generatedAt = existingQa?.generation?.status === 'generated'
    ? existingQa.generation.generated_at
    : new Date().toISOString();
  const sourceArchiveBytes = await readFile(archivePath);
  const canonicalBookIds = [...new Set(canonicalRecords.map((record) => record.book_id))];
  const suffixAnomalies = canonicalBookIds.filter((bookId) => bookId.endsWith('_et')
    && canonicalRecords.some((record) => record.book_id === bookId && record.language === 'ru'));
  const excludedBookAudit = [...configuration.excludedBookIds].map(([bookId, reason]) => ({
    book_id: bookId,
    source_records: records.filter((record) => normalizeText(record.book_id) === bookId).length,
    page_records_excluded: state.excludedBookRecords.filter((record) => normalizeText(record.book_id) === bookId).length,
    reason,
  }));
  const qa = {
    qa_schema_version: '1.0',
    source_id: source.id,
    source_archive: source.source_archive,
    output_file: source.md_path,
    format_version: source.format_version,
    generation: {
      status: 'generated',
      generated_at: generatedAt,
      generator: generatorPath,
      generator_version: configuration.generatorVersion ?? defaultGeneratorVersion,
      note: 'Generated deterministically from the committed original export; cover/detail and administrative records are excluded from the canonical Markdown.',
    },
    checksums: {
      source_archive_sha256: sha256(sourceArchiveBytes),
      output_file_sha256: sha256(Buffer.from(markdown, 'utf8')),
    },
    source_records: records.length,
    page_records_included: canonicalRecords.length,
    cover_detail_records_excluded: state.coverRecords.length,
    administrative_records_excluded: state.administrativeRecords.length,
    mixed_subject_page_records_excluded: state.excludedBookRecords.length,
    grades: countBy(canonicalRecords, (record) => record.grade),
    languages: countBy(canonicalRecords, (record) => record.language),
    books: countBy(canonicalRecords, (record) => record.book_id),
    kits: countBy(canonicalRecords, (record) => kitId(record.url)),
    programme_types: countBy(canonicalRecords, (record) => programmeType(record.book_id, configuration)),
    source_subject_counts: countBy(records, sourceSubject),
    canonical_subject_counts: countBy(canonicalRecords, sourceSubject),
    subject_normalization_records: state.subjectNormalizationAudit.length,
    subject_normalization_audit: state.subjectNormalizationAudit,
    duplicate_url_audit: {
      source_duplicate_groups: duplicateAudit.duplicateGroups.length,
      source_duplicate_records: records.length - new Set(records.map((record) => record.url)).size,
      canonical_duplicate_groups: 0,
      entries: duplicateAudit.entries,
    },
    ...(duplicateTitleAudit ? { duplicate_title_audit: duplicateTitleAudit } : {}),
    excluded_book_audit: excludedBookAudit,
    book_id_language_suffix_anomalies: suffixAnomalies,
    book_metadata_audit: bookMetadataAudit(canonicalRecords, configuration),
    ...(configuration.canonicalBookTitles.size > 0 ? {
      book_metadata_normalization_audit: bookMetadataNormalizationAudit(records, canonicalRecords, configuration),
      metadata_limitations: configuration.metadataLimitations,
    } : {}),
    records_without_headings: canonicalRecords.filter((record) => record.headings.length === 0).length,
    missing_urls: canonicalRecords.filter((record) => !record.url).length,
    archive_index: {
      generated_at: index.generatedAt,
      raw_archive_included: index.rawArchiveIncluded,
      declared_books: (index.books ?? []).length,
    },
  };
  const qaContents = `${JSON.stringify(qa, null, 2)}\n`;
  const currentMarkdown = await readFile(markdownPath, 'utf8').catch(() => null);
  const currentQa = await readFile(qaPath, 'utf8').catch(() => null);
  if (checkOnly) {
    assert(currentMarkdown === markdown, `${source.md_path} is stale; run ${generatorPath} without --check.`);
    assert(currentQa === qaContents, `${source.qa_path} is stale; run ${generatorPath} without --check.`);
    console.log(`${configuration.sourceId} check passed: ${records.length} source records, ${canonicalRecords.length} canonical pages.`);
  } else {
    if (currentMarkdown !== markdown) await writeFile(markdownPath, markdown, 'utf8');
    if (currentQa !== qaContents) await writeFile(qaPath, qaContents, 'utf8');
    console.log(`${configuration.sourceId} generation complete: ${records.length} source records, ${canonicalRecords.length} canonical pages.`);
  }
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  console.error(`Usage: node ${generatorPath} [--check]`);
  process.exit(1);
} else {
  try {
    const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
    for (const configuration of configurations) await generateSource(manifest, configuration);
  } catch (error) {
    console.error(`Grade 2 source generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
