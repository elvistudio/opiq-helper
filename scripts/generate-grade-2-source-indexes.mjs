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
const generatorVersion = '2.0';
const checkOnly = process.argv.slice(2).includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');

const configurations = [
  {
    sourceId: 'grade-2-estonian',
    expectedSourceRecords: 454,
    expectedCanonicalRecords: 372,
    expectedCoverRecords: 9,
    expectedAdministrativeRecords: 1,
    expectedDuplicateGroups: 4,
    expectedDuplicateRecords: 5,
    expectedExcludedBookRecords: 72,
    expectedCanonicalBooks: 3,
    subject: { en: 'Estonian language', et: 'eesti keel', ru: 'эстонский язык' },
    title: '2. klass eesti keel',
    queryDescription: 'grade 2 first-language Estonian',
    pageLanguageNames: ['Estonian'],
    excludedBookIds: new Map([
      ['koolibri_koos_on_lõ_2_et', 'Koos on lõbus. Janno jutud belongs to Estonian as a second language.'],
    ]),
    bookVariants: new Map([
      ['avita_eesti_keel_2_et::232', { canonicalBookId: 'avita_eesti_keel_2_et', title: 'Eesti keele õpik 2. klassile', expectedCoverTitle: 'Eesti keele õpik 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_ilus_emake_2_et::118', { canonicalBookId: 'koolibri_ilus_emake_2_et', title: 'ILUS EMAKEEL', expectedCoverTitle: 'ILUS EMAKEEL', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_mina_loen__2_et::458', { canonicalBookId: 'koolibri_mina_loen__2_et', title: 'Mina loen ja kirjutan 2', expectedCoverTitle: 'Mina loen ja kirjutan 2', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
    routePartition: {
      pairedSourceId: 'grade-2-estonian-second-language',
      expectedUnionRecords: 444,
    },
  },
  {
    sourceId: 'grade-2-estonian-second-language',
    expectedSourceRecords: 454,
    expectedCanonicalRecords: 72,
    expectedCoverRecords: 9,
    expectedAdministrativeRecords: 1,
    expectedDuplicateGroups: 4,
    expectedDuplicateRecords: 5,
    expectedExcludedBookRecords: 372,
    expectedCanonicalBooks: 1,
    subject: { en: 'Estonian as a second language', et: 'eesti keel teise keelena', ru: 'эстонский как второй язык' },
    title: '2. klass eesti keel teise keelena',
    queryDescription: 'grade 2 Estonian as a second language',
    pageLanguageNames: ['Estonian'],
    excludedBookIds: new Map([
      ['avita_eesti_keel_2_et', 'Eesti keele õpik 2. klassile belongs to first-language Estonian.'],
      ['koolibri_ilus_emake_2_et', 'ILUS EMAKEEL belongs to first-language Estonian.'],
      ['koolibri_mina_loen__2_et', 'Mina loen ja kirjutan 2 belongs to first-language Estonian.'],
    ]),
    forbiddenTopicAliases: {
      et: ['emakeel'],
      ru: ['родной язык'],
      en: ['mother tongue'],
    },
    bookVariants: new Map([
      ['koolibri_koos_on_lõ_2_et::129', { canonicalBookId: 'koolibri_koos_on_lõ_2_et', title: 'Koos on lõbus. Janno jutud', expectedCoverTitle: 'KOOS ON LÕBUS. Janno jutud', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
    routePartition: {
      pairedSourceId: 'grade-2-estonian',
      expectedUnionRecords: 444,
    },
  },
  {
    sourceId: 'grade-2-mathematics',
    expectedSourceRecords: 485,
    expectedCanonicalRecords: 464,
    expectedCoverRecords: 16,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 8,
    expectedDuplicateRecords: 8,
    expectedExcludedBookRecords: 0,
    expectedCanonicalBooks: 8,
    subject: { en: 'mathematics', et: 'matemaatika', ru: 'математика' },
    title: '2. klass matemaatika',
    queryDescription: 'grade 2 mathematics',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['avita_matemaatik_2_et::95', { canonicalBookId: 'avita_matemaatik_2_et__kit95', title: 'Matemaatika 2. klassile', expectedCoverTitle: 'Matemaatika 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_математика_2_et::578', { canonicalBookId: 'avita_математика_2_et__kit578', title: 'Matemaatika 2. klassile', expectedCoverTitle: 'Matemaatika 2. klassile', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; bilingual headings retained' }],
      ['avita_математика_2_ru::165', { canonicalBookId: 'avita_математика_2_ru__kit165', title: 'Математика для 2 класса', expectedCoverTitle: 'Математика для 2 класса', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::272', { canonicalBookId: 'harno_matemaatik_2_et__kit272', title: 'Matemaatika 2. klassile, I osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, I osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::273', { canonicalBookId: 'harno_matemaatik_2_et__kit273', title: 'Matemaatika 2. klassile, II osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, II osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_matemaatik_2_et::274', { canonicalBookId: 'harno_matemaatik_2_et__kit274', title: 'Matemaatika 2. klassile, III osa. Lihtsustatud õppekava', expectedCoverTitle: 'Matemaatika 2. klassile, III osa. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_matemaatik_2_et::107', { canonicalBookId: 'koolibri_matemaatik_2_et__kit107', title: 'MATEMAATIKA 2. klassile', expectedCoverTitle: 'MATEMAATIKA 2. klassile', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_математика_2_et::361', { canonicalBookId: 'koolibri_математика_2_et__kit361', title: 'МАТЕМАТИКА 2 класс', expectedCoverTitle: 'МАТЕМАТИКА 2 класс', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
  },
  {
    sourceId: 'grade-2-science',
    expectedSourceRecords: 428,
    expectedCanonicalRecords: 286,
    expectedCoverRecords: 18,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 9,
    expectedDuplicateRecords: 9,
    expectedExcludedBookRecords: 119,
    expectedCanonicalBooks: 7,
    subject: { en: 'science', et: 'loodusõpetus', ru: 'природоведение' },
    title: '2. klass loodusõpetus',
    queryDescription: 'grade 2 science',
    pageLanguageNames: ['Estonian', 'Russian'],
    excludedBookIds: new Map([
      ['avita_loodus-_ja_2_et', 'Mixed loodus- ja inimeseõpetus book; its Estonian pages are already routed through grade-2-human-studies.'],
      ['avita_природа_и__2_ru', 'Mixed nature-and-human-studies book; excluded to keep the science route subject-pure.'],
    ]),
    bookVariants: new Map([
      ['avita_loodusõpet_2_et::379', { canonicalBookId: 'avita_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile (2022)', expectedCoverTitle: 'Loodusõpetus 2. klassile (2022)', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_природовед_2_ru::570', { canonicalBookId: 'avita_природовед_2_ru', title: 'Природоведение для 2 класса', expectedCoverTitle: 'Loodusõpetus 2. klassile', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'index_json; cover is Estonian' }],
      ['koolibri_loodusõpet_2_et::121', { canonicalBookId: 'koolibri_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile', expectedCoverTitle: 'Loodusõpetus 2. klassile', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_природове_2_ru::132', { canonicalBookId: 'koolibri_природове_2_ru', title: 'Природоведение 2 класс', expectedCoverTitle: 'Природоведение 2 клacc', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'confirmed Cyrillic/Latin typo correction' }],
      ['ministeerium_loodusõpet_2_et::501', { canonicalBookId: 'ministeerium_loodusõpet_2_et', title: 'Loodusõpetus 2. klassile. Lihtsustatud õppekava', expectedCoverTitle: 'Loodusõpetus 2. klassile. Lihtsustatud õppekava', publisher: 'Ministeerium', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail; publisher case normalized from index_json' }],
      ['skriibus_loodusõpet_2_et::387', { canonicalBookId: 'skriibus_loodusõpet_2_et', title: 'Loodusõpetuse tööraamat 2. klassile', expectedCoverTitle: 'Loodusõpetuse tööraamat 2. klassile', publisher: 'Skriibus', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['star cloud_loodusõpet_2_et::384', { canonicalBookId: 'star cloud_loodusõpet_2_et', title: 'Loodusõpetuse õppevideod 1. kooliastmele', expectedCoverTitle: 'Loodusõpetuse õppevideod 1. kooliastmele', publisher: 'Star Cloud', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
    ]),
  },
  {
    sourceId: 'grade-2-human-studies',
    expectedSourceRecords: 262,
    expectedCanonicalRecords: 243,
    expectedCoverRecords: 14,
    expectedAdministrativeRecords: 5,
    expectedDuplicateGroups: 7,
    expectedDuplicateRecords: 7,
    expectedExcludedBookRecords: 0,
    expectedCanonicalBooks: 7,
    subject: { en: 'human studies', et: 'inimeseõpetus', ru: 'человековедение' },
    title: '2. klass inimeseõpetus',
    queryDescription: 'grade 2 human studies',
    pageLanguageNames: ['Estonian', 'Russian'],
    normalizeContentLists: true,
    excludedBookIds: new Map(),
    bookVariants: new Map([
      ['avita_inimeseõpe_2_et::449', { canonicalBookId: 'avita_inimeseõpe_2_et__kit449', title: 'Inimeseõpetus algklassidele, I osa. 2023 ÕK', expectedCoverTitle: 'Inimeseõpetus algklassidele, I osa. 2023 ÕK', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_inimeseõpe_2_et::494', { canonicalBookId: 'avita_inimeseõpe_2_et__kit494', title: 'Inimeseõpetus algklassidele, II osa. 2023 ÕK', expectedCoverTitle: 'Inimeseõpetus algklassidele, II osa. 2023 ÕK', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_inimeseõpe_2_ru::579', { canonicalBookId: 'avita_inimeseõpe_2_ru__kit579', title: 'Inimeseõpetus algklassidele. II osa', expectedCoverTitle: 'Inimeseõpetus algklassidele. II osa', publisher: 'Avita', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['avita_loodus-_ja_2_et::56', { canonicalBookId: 'avita_loodus-_ja_2_et__kit56', title: 'Loodus- ja inimeseõpetus 2. klassile', expectedCoverTitle: 'Loodus- ja inimeseõpetus 2. klassile', publisher: 'Avita', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail' }],
      ['harno_inimeseõpe_2_et::286', { canonicalBookId: 'harno_inimeseõpe_2_et__kit286', title: 'Inimeseõpetus 2. klassile. Lihtsustatud õppekava', expectedCoverTitle: 'Inimeseõpetus 2. klassile. Lihtsustatud õppekava', publisher: 'Harno', language: 'et', programmeType: 'simplified_curriculum', titleEvidence: 'cover_detail' }],
      ['koolibri_in2_2._kla_2_et::142', { canonicalBookId: 'koolibri_in2_2._kla_2_et__kit142', title: 'IN2. 2. klassi inimeseõpetus', expectedCoverTitle: 'IN2', publisher: 'Koolibri', language: 'et', programmeType: 'ordinary_curriculum', titleEvidence: 'index_json and cover_detail' }],
      ['koolibri_мой_мир._ч_2_ru::229', { canonicalBookId: 'koolibri_мой_мир._ч_2_ru__kit229', title: 'Мой мир. Человековедение 2 класс', expectedCoverTitle: 'Мой мир. Человековедение 2 класс', publisher: 'Koolibri', language: 'ru', programmeType: 'ordinary_curriculum', titleEvidence: 'cover_detail; discretionary soft hyphen removed' }],
    ]),
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
    assert(['et', 'ru', 'en'].includes(record.language), `${label} line ${index + 1} has unsupported page language ${record.language}.`);
    for (const field of ['topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']) {
      assert(Array.isArray(record[field]), `${label} line ${index + 1} field ${field} must be an array.`);
    }
    return { ...record, source_position: index + 1 };
  });
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\u00ad', '').normalize('NFC').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function normalizeTextList(values) {
  return [...new Set(values
    .map((value) => normalizeText(value).replace(/[\u200b-\u200d\u2060\ufeff]/gu, '').trim())
    .filter(Boolean))];
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

function bookVariantKey(record) {
  return `${normalizeText(record.book_id)}::${kitId(record.url)}`;
}

function coverTitle(record) {
  return normalizeText(record.title).replace(/\s+[–-]\s+Opiq$/iu, '');
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
  const sourceBookId = normalizeText(record.book_id);
  const variant = configuration.bookVariants.get(bookVariantKey(record));
  assert(variant, `${configuration.sourceId}: no canonical book variant for ${bookVariantKey(record)} (${record.url}).`);
  const normalized = {
    ...record,
    title: normalizeText(record.title),
    url: normalizeText(record.url),
    book: variant.title,
    book_id: variant.canonicalBookId,
    source_book_id: sourceBookId,
    chapter_id: normalizeText(record.chapter_id),
    language: variant.language,
    publisher: variant.publisher,
    programme_type: variant.programmeType,
    headings: configuration.normalizeContentLists
      ? normalizeTextList(record.headings)
      : record.headings.map(normalizeText).filter(Boolean),
    task_examples: configuration.normalizeContentLists
      ? normalizeTextList(record.task_examples)
      : record.task_examples.map(normalizeText).filter(Boolean),
  };
  normalized.subject_en = configuration.subject.en;
  normalized.subject_et = configuration.subject.et;
  normalized.subject_ru = configuration.subject.ru;
  normalized.topics_et = normalizeTopicList(record.topics_et, [
    'matemaatika', 'loodusõpetus', 'inimeseõpetus', 'eesti keel', 'eesti keel teise keelena',
    ...(configuration.forbiddenTopicAliases?.et ?? []),
  ], configuration.subject.et);
  normalized.topics_ru = normalizeTopicList(record.topics_ru, [
    'математика', 'природоведение', 'человековедение', 'эстонский язык', 'эстонский как второй язык',
    ...(configuration.forbiddenTopicAliases?.ru ?? []),
  ], configuration.subject.ru);
  normalized.topics_en = normalizeTopicList(record.topics_en, [
    'mathematics', 'science', 'human studies', 'Estonian language', 'Estonian as a second language',
    ...(configuration.forbiddenTopicAliases?.en ?? []),
  ], configuration.subject.en);
  return normalized;
}

function validateBookVariantEvidence(records, configuration) {
  const coverRecords = records.filter(isCoverDetail);
  for (const [key, variant] of configuration.bookVariants) {
    const matches = coverRecords.filter((record) => bookVariantKey(record) === key);
    assert(matches.length > 0, `${configuration.sourceId}: canonical variant ${key} has no cover/detail evidence.`);
    const foundTitles = [...new Set(matches.map(coverTitle))];
    assert(
      foundTitles.length === 1 && foundTitles[0].toLocaleLowerCase() === variant.expectedCoverTitle.toLocaleLowerCase(),
      `${configuration.sourceId}: cover title for ${key} is ${JSON.stringify(foundTitles)}; expected ${JSON.stringify(variant.expectedCoverTitle)}.`,
    );
    assert(variant.canonicalBookId && variant.title && variant.publisher && variant.language && variant.programmeType,
      `${configuration.sourceId}: canonical variant ${key} is incomplete.`);
  }
}

function auditDuplicateUrls(records, configuration) {
  const duplicateGroups = [...groupBy(records, (record) => record.url).entries()].filter(([, matches]) => matches.length > 1);
  assert(duplicateGroups.length === configuration.expectedDuplicateGroups, `${configuration.sourceId}: duplicate URL group count changed.`);
  const duplicateRecords = duplicateGroups.reduce((total, [, matches]) => total + matches.length - 1, 0);
  assert(duplicateRecords === configuration.expectedDuplicateRecords, `${configuration.sourceId}: duplicate record count changed.`);
  const entries = duplicateGroups.map(([url, matches]) => {
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
  return { duplicateGroups, duplicateRecords, entries };
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
  assert(excludedBookRecords.length === configuration.expectedExcludedBookRecords, `${configuration.sourceId}: subject-boundary exclusion count changed.`);
  assert(new Set(canonicalRecords.map((record) => record.book_id)).size === configuration.expectedCanonicalBooks, `${configuration.sourceId}: canonical book count changed.`);
  assert(canonicalRecords.length + coverRecords.length + administrativeRecords.length + excludedBookRecords.length === records.length,
    `${configuration.sourceId}: source record accounting is incomplete.`);
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
    `- Page languages: ${configuration.pageLanguageNames.join(', ')}`,
    `- Source records: ${index.recordCount}`,
    `- Page records included: ${canonicalRecords.length}`,
    `- Cover/detail records excluded: ${coverRecords.length}`,
    `- Administrative records excluded: ${administrativeRecords.length}`,
    `- Duplicate source URL groups: ${duplicateAudit.duplicateGroups.length}; all were excluded kit-detail records`,
    `- Subject-boundary page records excluded: ${excludedBookRecords.length}`,
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const [bookId, records] of bookGroups) {
    const first = records[0];
    const kits = [...new Set(records.map((record) => kitId(record.url)))].sort().join(', ');
    const programme = first.programme_type === 'simplified_curriculum'
      ? 'simplified curriculum; use only with explicit labelling'
      : 'ordinary curriculum';
    lines.push(`- \`${bookId}\` — ${first.book}; Source Book ID \`${first.source_book_id}\`; ${first.publisher || 'publisher not recorded'}; language ${first.language}; kit ${kits}; ${records.length} pages; ${programme}.`);
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
    lines.push(
      `### ${indexPosition + 1}. ${record.title}`,
      `- URL: ${record.url}`,
      `- Book: ${record.book}`,
      `- Book ID: ${record.book_id}`,
      `- Source Book ID: ${record.source_book_id}`,
      `- Chapter ID: ${record.chapter_id}`,
      '- Class: 2',
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
      source_book_id: matches[0].source_book_id,
      publisher: matches[0].publisher,
      language: matches[0].language,
      kits: [...new Set(matches.map((record) => kitId(record.url)))].sort(),
      page_records: matches.length,
      programme_type: matches[0].programme_type,
      title_evidence: configuration.bookVariants.get(`${matches[0].source_book_id}::${kitId(matches[0].url)}`).titleEvidence,
    }]));
}

async function generateSource(manifest, configuration) {
  const source = manifest.sources.find((entry) => entry.id === configuration.sourceId);
  assert(source, `Manifest source ${configuration.sourceId} was not found.`);
  assert(source.canonical_url_policy?.require_unique === true, `${configuration.sourceId}: unique URL policy is required.`);
  assert(JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(configuration.subject), `${configuration.sourceId}: canonical subject policy differs from generator configuration.`);
  if (configuration.excludedBookIds.size > 0) {
    const manifestBoundary = [...(source.subject_boundary?.forbidden_book_ids ?? [])].sort();
    const expectedBoundary = [...configuration.excludedBookIds.keys()].sort();
    assert(JSON.stringify(manifestBoundary) === JSON.stringify(expectedBoundary), `${configuration.sourceId}: manifest subject boundary differs from generator configuration.`);
  }
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
  validateBookVariantEvidence(records, configuration);
  const duplicateAudit = auditDuplicateUrls(records, configuration);
  const state = canonicalize(records, configuration);
  const markdown = renderMarkdown(configuration, source, index, state, duplicateAudit);
  const canonicalRecords = state.canonicalRecords;
  assert(typeof index.generatedAt === 'string' && index.generatedAt, `${configuration.sourceId}: archive index has no generatedAt value.`);
  const sourceArchiveBytes = await readFile(archivePath);
  const canonicalSourceBookIds = [...new Set(canonicalRecords.map((record) => record.source_book_id))];
  const suffixAnomalies = canonicalSourceBookIds.filter((bookId) => bookId.endsWith('_et')
    && canonicalRecords.some((record) => record.source_book_id === bookId && record.language === 'ru'));
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
      generated_at: index.generatedAt,
      generator: generatorPath,
      generator_version: generatorVersion,
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
    subject_boundary_page_records_excluded: state.excludedBookRecords.length,
    grades: countBy(canonicalRecords, (record) => record.grade),
    languages: countBy(canonicalRecords, (record) => record.language),
    books: countBy(canonicalRecords, (record) => record.book_id),
    source_books: countBy(canonicalRecords, (record) => record.source_book_id),
    kits: countBy(canonicalRecords, (record) => kitId(record.url)),
    programme_types: countBy(canonicalRecords, (record) => record.programme_type),
    source_subject_counts: countBy(records, sourceSubject),
    canonical_subject_counts: countBy(canonicalRecords, sourceSubject),
    subject_normalization_records: state.subjectNormalizationAudit.length,
    subject_normalization_audit: state.subjectNormalizationAudit,
    duplicate_url_audit: {
      source_duplicate_groups: duplicateAudit.duplicateGroups.length,
      source_duplicate_records: duplicateAudit.duplicateRecords,
      canonical_duplicate_groups: 0,
      entries: duplicateAudit.entries,
    },
    excluded_book_audit: excludedBookAudit,
    book_id_language_suffix_anomalies: suffixAnomalies,
    book_metadata_audit: bookMetadataAudit(canonicalRecords, configuration),
    ...(configuration.routePartition ? {
      route_partition: {
        paired_source_id: configuration.routePartition.pairedSourceId,
        expected_union_page_records: configuration.routePartition.expectedUnionRecords,
        canonical_overlap_urls: 0,
      },
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
  return { source, canonicalRecords };
}

if (unknownArguments.length > 0) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  console.error(`Usage: node ${generatorPath} [--check]`);
  process.exit(1);
} else {
  try {
    const manifest = parseJson(await readFile(manifestPath, 'utf8'), 'source-manifest.json');
    const results = [];
    for (const configuration of configurations) results.push(await generateSource(manifest, configuration));
    const firstLanguage = results.find((result) => result.source.id === 'grade-2-estonian');
    const secondLanguage = results.find((result) => result.source.id === 'grade-2-estonian-second-language');
    assert(firstLanguage && secondLanguage, 'Both grade 2 Estonian subject routes are required.');
    const firstUrls = new Set(firstLanguage.canonicalRecords.map((record) => record.url));
    const secondUrls = new Set(secondLanguage.canonicalRecords.map((record) => record.url));
    const overlap = [...firstUrls].filter((url) => secondUrls.has(url));
    assert(overlap.length === 0, `Grade 2 Estonian routes overlap on canonical URL ${overlap[0]}.`);
    assert(firstUrls.size + secondUrls.size === 444, 'Grade 2 Estonian route union must contain 444 instructional pages.');
    console.log('Grade 2 Estonian route partition passed: 372 first-language pages, 72 second-language pages, 0 overlapping URLs.');
  } catch (error) {
    console.error(`Grade 2 source generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
