import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

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

export const grade3MusicArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_muusikamaa_opiq_v2.zip',
  sha256: '03968d5ab0b931dafc0431f17fac146eaead6be6de0629f6fe7f163a2f67aa70',
  byte_size: 1_543_267,
  member_count: 324,
  format_version: '2.0',
  capture_timestamp: '2026-07-23T09:30:34.058Z',
  source_records: 315,
  canonical_records: 305,
});

export const requiredGrade3MusicMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

export const grade3MusicSubject = Object.freeze({
  en: 'music',
  et: 'muusika',
  ru: 'музыка',
});

const variantRows = [
  {
    source_book_id: 'muusikamaa',
    kit_id: '195',
    canonical_book_id: 'muusikamaa__kit195',
    raw_title: 'Muusikamaa – Opiq',
    canonical_title: 'Muusikamaa',
    language: 'et',
    source_rows: 123,
    canonical_records: 121,
    details: 2,
    administrative: 0,
  },
  {
    source_book_id: 'muusikaõpik_3._klassile',
    kit_id: '163',
    canonical_book_id: 'muusikaõpik_3._klassile__kit163',
    raw_title: 'Muusikaõpik 3. klassile – Opiq',
    canonical_title: 'Muusikaõpik 3. klassile',
    language: 'et',
    source_rows: 34,
    canonical_records: 31,
    details: 2,
    administrative: 1,
  },
  {
    source_book_id: 'muusikaõpik_3._klassile_2025',
    kit_id: '592',
    canonical_book_id: 'muusikaõpik_3._klassile_2025__kit592',
    raw_title: 'Muusikaõpik 3. klassile 2025 – Opiq',
    canonical_title: 'Muusikaõpik 3. klassile 2025',
    language: 'et',
    source_rows: 34,
    canonical_records: 31,
    details: 2,
    administrative: 1,
  },
  {
    source_book_id: 'музыка_–_волшебная_страна._3_класс',
    kit_id: '239',
    canonical_book_id: 'музыка_–_волшебная_страна._3_класс__kit239',
    raw_title: 'Музыка – волшебная страна. 3 класс – Opiq',
    canonical_title: 'Музыка – волшебная страна. 3 класс',
    language: 'ru',
    source_rows: 124,
    canonical_records: 122,
    details: 2,
    administrative: 0,
  },
].map((variant) => Object.freeze({
  ...variant,
  publisher: '',
  programme_type: 'ordinary_curriculum',
  publisher_provenance: 'Publisher metadata is absent from index.json, the raw book record, and every source row; no publisher is invented.',
}));

export const grade3MusicVariants = Object.freeze(Object.fromEntries(
  variantRows.map((variant) => [variant.source_book_id, variant]),
));

const rawSubject = 'mathematics / matemaatika / математика';
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const invisiblePattern = /[\u00ad\u200b-\u200d\u2060\ufeff]/u;
const cp437HighCharacters = [
  ...'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ',
];
assertGrade3(cp437HighCharacters.length === 128, 'Internal CP437 table must contain 128 high-byte characters.');
const cp437Encode = new Map(cp437HighCharacters.map((character, index) => [character, index + 0x80]));
const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

export function assertGrade3MusicArchiveIdentity(bytes) {
  assertGrade3(
    bytes.length === grade3MusicArchive.byte_size,
    `Original archive byte size is ${bytes.length}; expected ${grade3MusicArchive.byte_size}.`,
  );
  const actual = sha256Bytes(bytes);
  assertGrade3(
    actual === grade3MusicArchive.sha256,
    `Original archive checksum is ${actual}; expected ${grade3MusicArchive.sha256}.`,
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
  requiredGrade3MusicMembers.forEach((name) => {
    assertGrade3(names.has(name), `Original archive is missing required member ${name}.`);
  });
}

export function decodeCp437(bytes) {
  return [...bytes].map((byte) => (
    byte < 0x80 ? String.fromCharCode(byte) : cp437HighCharacters[byte - 0x80]
  )).join('');
}

export function encodeCp437(text) {
  const bytes = [];
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint < 0x80) bytes.push(codePoint);
    else {
      const byte = cp437Encode.get(character);
      assertGrade3(byte !== undefined, `Character ${JSON.stringify(character)} is not representable in CP437.`);
      bytes.push(byte);
    }
  }
  return Buffer.from(bytes);
}

function matchingSourceBookIds(logicalName, sourceBookIds) {
  return sourceBookIds.filter((sourceBookId) => (
    logicalName === `raw/Opiq-DB/books/${sourceBookId}.json`
    || logicalName.startsWith(`raw/Opiq-DB/chapters/${sourceBookId}/`)
  ));
}

export function recoverLogicalZipMemberName(metadata, sourceBookIds = Object.keys(grade3MusicVariants)) {
  assertGrade3(isPlainObject(metadata), 'ZIP member metadata must be an object.');
  assertGrade3(
    typeof metadata.stored_name_hex === 'string'
      && /^(?:[0-9a-f]{2})+$/u.test(metadata.stored_name_hex),
    'ZIP member metadata has an invalid stored_name_hex value.',
  );
  const bytes = Buffer.from(metadata.stored_name_hex, 'hex');
  const storedName = decodeCp437(bytes);
  assertGrade3(
    encodeCp437(storedName).equals(bytes),
    'Stored CP437 member name does not pass the byte-for-byte round trip.',
  );
  let logicalName;
  try {
    logicalName = fatalUtf8Decoder.decode(bytes);
  } catch {
    throw new Error(`ZIP member name bytes are not valid UTF-8: ${metadata.stored_name_hex}`);
  }
  assertGrade3(
    Buffer.from(logicalName, 'utf8').equals(bytes),
    `Decoded ZIP member name does not pass the UTF-8 round trip: ${logicalName}`,
  );
  assertSafeMemberName(logicalName);

  const hasNonAsciiBytes = bytes.some((byte) => byte >= 0x80);
  const utf8Flag = metadata.utf8_filename_flag === true;
  const sourceMatches = matchingSourceBookIds(logicalName, sourceBookIds);
  if (!utf8Flag && hasNonAsciiBytes) {
    assertGrade3(
      sourceMatches.length === 1,
      `Recovered member name must map to exactly one captured Source Book ID: ${logicalName}`,
    );
  }
  return {
    stored_name_cp437: storedName,
    stored_name_hex: metadata.stored_name_hex,
    decoded_logical_name: logicalName,
    utf8_filename_flag: utf8Flag,
    recovery_applied: !utf8Flag && hasNonAsciiBytes,
    source_book_id: sourceMatches[0] ?? null,
    cp437_round_trip_verified: true,
    utf8_round_trip_verified: true,
  };
}

export function assertUniqueLogicalMemberNames(entries) {
  const seen = new Set();
  for (const entry of entries) {
    assertGrade3(
      !seen.has(entry.decoded_logical_name),
      `Decoded ZIP member-name collision: ${entry.decoded_logical_name}`,
    );
    seen.add(entry.decoded_logical_name);
  }
}

export function auditZipMemberNames(memberMetadata) {
  const entries = [...memberMetadata.values()].map((metadata) => recoverLogicalZipMemberName(metadata));
  assertUniqueLogicalMemberNames(entries);
  const recovered = entries.filter((entry) => entry.recovery_applied);
  assertGrade3(recovered.length === 195, `Recovered non-ASCII member count is ${recovered.length}; expected 195.`);
  assertGrade3(
    entries.every((entry) => entry.utf8_filename_flag === false),
    'The original archive unexpectedly sets a UTF-8 filename flag.',
  );
  return {
    specification: 'stored CP437 display -> byte-for-byte CP437 re-encoding -> fatal UTF-8 decoding',
    member_count: entries.length,
    utf8_flag_set: 0,
    utf8_flag_absent: entries.length,
    non_ascii_recoveries: recovered.length,
    round_trip_verified: entries.length,
    decoded_name_collisions: 0,
    entries: recovered,
  };
}

function normalizeList(values) {
  return values.map(normalizeQualityText).filter(Boolean);
}

function normalizeTasks(values) {
  return values.map((value) => {
    const withoutFramedJson = sanitizeCapturedTaskExample(value).text;
    return normalizeQualityText(withoutFramedJson.replace(/<[^>]+>/gu, ' '));
  }).filter(Boolean);
}

function normalizeTopics(values, field) {
  const forbidden = {
    topics_et: 'matemaatika',
    topics_ru: 'математика',
    topics_en: 'mathematics',
  }[field];
  const required = {
    topics_et: grade3MusicSubject.et,
    topics_ru: grade3MusicSubject.ru,
    topics_en: grade3MusicSubject.en,
  }[field];
  const retained = normalizeList(values).filter(
    (value) => value.toLocaleLowerCase() !== forbidden,
  );
  return [
    required,
    ...retained.filter((value) => value.toLocaleLowerCase() !== required.toLocaleLowerCase()),
  ];
}

function groupBy(records, selector) {
  const groups = new Map();
  for (const record of records) {
    const key = selector(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
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

export function isKitDetail(record) {
  return /^https:\/\/www\.opiq\.ee\/Kit\/Details\/(?:195|163|592|239)$/u.test(record.url);
}

export function isAdministrative(record) {
  return record.url === 'https://www.opiq.ee/kit/163/chapter/19490'
    || record.url === 'https://www.opiq.ee/kit/592/chapter/33434';
}

function sourceIdentity(record) {
  return `${record.book_id}\u0000${record.chapter_id}`;
}

function relationBetweenTasks(compactTasks, rawTasks, url) {
  if (JSON.stringify(compactTasks) === JSON.stringify(rawTasks)) return 'unchanged';
  if (
    compactTasks.every((task) => rawTasks.includes(task))
    && rawTasks.length > compactTasks.length
  ) return compactTasks.length === 0 ? 'raw_task_recovered' : 'richer_raw_task_evidence';
  if (
    url === 'https://www.opiq.ee/kit/195/chapter/11210'
    && compactTasks.length === rawTasks.length
    && compactTasks.every((task, index) => rawTasks[index].startsWith(task))
  ) return 'truncated_compact_task_recovered';
  throw new Error(`Raw and compact task evidence conflict for ${url}.`);
}

export function validateRawGrade3MusicChapters(sourceRecords, archive, readZipText) {
  const chapterMembers = [...archive.entries.keys()].filter(
    (name) => name.startsWith('raw/Opiq-DB/chapters/'),
  );
  assertGrade3(
    chapterMembers.length === sourceRecords.length,
    `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`,
  );
  const rawByIdentity = new Map();
  for (const member of chapterMembers) {
    const raw = JSON.parse(readZipText(archive, member));
    assertGrade3(isPlainObject(raw), `${member} must contain an object.`);
    const identity = `${raw.bookId}\u0000${raw.chapterId}`;
    assertGrade3(!rawByIdentity.has(identity), `Duplicate raw chapter identity ${identity}.`);
    assertGrade3(
      Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images),
      `${member} is missing raw page arrays.`,
    );
    rawByIdentity.set(identity, { member, raw });
  }

  const taskRelationships = [];
  let rawServiceHeadingPages = 0;
  for (const record of sourceRecords) {
    const entry = rawByIdentity.get(sourceIdentity(record));
    assertGrade3(entry, `Raw chapter is missing for ${sourceIdentity(record)}.`);
    const { raw, member } = entry;
    assertGrade3(
      normalizeQualityText(raw.chapterTitle) === record.title,
      `${member} title differs from compact JSONL.`,
    );
    assertGrade3(raw.url === record.url, `${member} URL differs from compact JSONL.`);
    const rawHeadingSet = new Set(raw.headings.map((heading) => normalizeQualityText(heading.text)));
    assertGrade3(
      record.headings.every((heading) => rawHeadingSet.has(normalizeQualityText(heading))),
      `${member} compact heading is absent from raw headings.`,
    );
    const rawTasks = normalizeTasks(raw.tasks.map((task) => task.text));
    const compactTasks = normalizeTasks(record.task_examples);
    const relationship = relationBetweenTasks(compactTasks, rawTasks, record.url);
    taskRelationships.push({ url: record.url, relationship });
    if (raw.headings.some((heading) => [
      'Õpetaja lisatud materjal',
      'Minu lisatud materjal',
      'Seotud sisu',
    ].includes(normalizeQualityText(heading.text)))) rawServiceHeadingPages += 1;
    assertGrade3(
      typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)),
      `${member} scrapedAt is invalid.`,
    );
  }
  assertGrade3(rawByIdentity.size === sourceRecords.length, 'Raw chapter members are not fully referenced.');
  const relationshipCounts = countBy(taskRelationships, (entry) => entry.relationship);
  assertGrade3(
    relationshipCounts.richer_raw_task_evidence === 34
      && relationshipCounts.raw_task_recovered === 5
      && relationshipCounts.truncated_compact_task_recovered === 1
      && relationshipCounts.unchanged === 275
      && Object.keys(relationshipCounts).length === 4,
    `Unexpected raw/compact task relationships: ${JSON.stringify(relationshipCounts)}`,
  );
  return {
    raw_by_identity: rawByIdentity,
    audit: {
      raw_chapter_records: chapterMembers.length,
      compact_headings_missing_from_raw: 0,
      raw_service_heading_pages: rawServiceHeadingPages,
      task_relationships: relationshipCounts,
      raw_task_repairs_available: 40,
      unexplained_task_differences: 0,
    },
  };
}

function selectCanonicalTasks(record, rawEntry) {
  assertGrade3(rawEntry, `Raw task evidence is missing for ${sourceIdentity(record)}.`);
  const compactTasks = normalizeTasks(record.task_examples);
  const rawTasks = normalizeTasks(rawEntry.raw.tasks.map((task) => task.text));
  const relationship = relationBetweenTasks(compactTasks, rawTasks, record.url);
  if (relationship === 'unchanged') return { tasks: compactTasks, repair: null };
  return {
    tasks: rawTasks,
    repair: {
      url: record.url,
      source_book_id: record.book_id,
      kit_id: kitId(record),
      field: 'task_examples',
      category: relationship,
      raw_compact_sha256: createHash('sha256').update(JSON.stringify(record.task_examples)).digest('hex'),
      raw_archive_sha256: createHash('sha256').update(JSON.stringify(rawEntry.raw.tasks.map((task) => task.text))).digest('hex'),
      canonical_sha256: createHash('sha256').update(JSON.stringify(rawTasks)).digest('hex'),
      transformation: relationship === 'truncated_compact_task_recovered'
        ? 'Replace the one demonstrably truncated compact task with the complete task text from the same raw chapter record.'
        : 'Use the richer structured task array from the same raw chapter record.',
      evidence: rawEntry.member,
    },
  };
}

function normalizeInstructionalRecord(record, rawEntry) {
  const variant = grade3MusicVariants[record.book_id];
  assertGrade3(variant, `Unknown grade-3 music Source Book ID: ${record.book_id}`);
  assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside audited kit ${variant.kit_id}.`);
  assertGrade3(record.book === variant.raw_title, `${record.url} captured book title changed.`);
  assertGrade3(record.grade === 3, `${record.url} raw grade must be 3.`);
  assertGrade3(record.language === variant.language, `${record.url} source language differs from its audited book.`);
  assertGrade3(record.publisher === '', `${record.url} unexpectedly contains publisher metadata.`);
  assertGrade3(
    sourceSubject(record) === rawSubject,
    `${record.url} raw subject differs from the audited exporter mathematics error.`,
  );

  const { tasks, repair } = selectCanonicalTasks(record, rawEntry);
  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: variant.canonical_title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.source_book_id,
    chapter_id: String(record.chapter_id),
    grade: 3,
    subject_en: grade3MusicSubject.en,
    subject_et: grade3MusicSubject.et,
    subject_ru: grade3MusicSubject.ru,
    language: variant.language,
    publisher: variant.publisher,
    programme_type: variant.programme_type,
    kit_id: variant.kit_id,
    topics_et: normalizeTopics(record.topics_et, 'topics_et'),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru'),
    topics_en: normalizeTopics(record.topics_en, 'topics_en'),
    headings: normalizeList(record.headings),
    task_examples: tasks,
  };
  validateCanonicalGrade3MusicRecord(canonical);
  return { canonical, repair };
}

export function validateCanonicalGrade3MusicRecord(record) {
  const match = record.url.match(directChapterUrl);
  assertGrade3(match, `${record.url} is not a direct canonical Opiq chapter URL.`);
  assertGrade3(match[1] === record.kit_id, `${record.url} URL kit differs from canonical kit.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3(
    sourceSubject(record) === `${grade3MusicSubject.en} / ${grade3MusicSubject.et} / ${grade3MusicSubject.ru}`,
    `${record.url} canonical subject must be music.`,
  );
  const variant = grade3MusicVariants[record.source_book_id];
  assertGrade3(variant, `${record.url} has an unknown Source Book ID.`);
  assertGrade3(record.book_id === variant.canonical_book_id, `${record.url} canonical Book ID differs.`);
  assertGrade3(record.book === variant.canonical_title, `${record.url} canonical book title differs.`);
  assertGrade3(record.kit_id === variant.kit_id, `${record.url} canonical kit differs.`);
  assertGrade3(record.language === variant.language, `${record.url} canonical language differs.`);
  assertGrade3(record.publisher === '', `${record.url} publisher is not source-supported.`);
  assertGrade3(record.programme_type === 'ordinary_curriculum', `${record.url} programme type differs.`);
  assertGrade3(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  const text = [
    record.title,
    record.book,
    record.book_id,
    record.source_book_id,
    record.publisher,
    ...record.topics_et,
    ...record.topics_ru,
    ...record.topics_en,
    ...record.headings,
    ...record.task_examples,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3(!invisiblePattern.test(text), `${record.url} contains an invisible or discretionary control character.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
  assertGrade3(
    !record.topics_et.some((value) => value.toLocaleLowerCase() === 'matemaatika')
      && !record.topics_ru.some((value) => value.toLocaleLowerCase() === 'математика')
      && !record.topics_en.some((value) => value.toLocaleLowerCase() === 'mathematics'),
    `${record.url} retains a generated mathematics topic alias.`,
  );
}

export function buildGrade3MusicCatalog(sourceRecords, rawByIdentity) {
  assertGrade3(
    sourceRecords.length === grade3MusicArchive.source_records,
    `Original archive has ${sourceRecords.length} source records; expected ${grade3MusicArchive.source_records}.`,
  );
  const duplicateGroups = [...groupBy(sourceRecords, (record) => record.url).entries()]
    .filter(([, records]) => records.length > 1);
  assertGrade3(
    duplicateGroups.length === 4,
    `Original archive has ${duplicateGroups.length} duplicate URL groups; expected 4.`,
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
      kit_id: kitId(url),
      source_book_id: records[0].book_id,
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_unique_kit_detail_and_duplicate_alias',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));

  const canonicalRecords = [];
  const coverDetails = [];
  const duplicateAliases = [];
  const administrative = [];
  const taskRepairs = [];
  const seenDetailUrls = new Set();
  for (const record of sourceRecords) {
    const variant = grade3MusicVariants[record.book_id];
    assertGrade3(variant, `Unknown grade-3 music Source Book ID: ${record.book_id}`);
    assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside audited kit ${variant.kit_id}.`);
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
    const normalized = normalizeInstructionalRecord(record, rawByIdentity.get(sourceIdentity(record)));
    canonicalRecords.push(normalized.canonical);
    if (normalized.repair) taskRepairs.push(normalized.repair);
  }

  assertGrade3(coverDetails.length === 4, `Unique Kit Details count is ${coverDetails.length}; expected 4.`);
  assertGrade3(duplicateAliases.length === 4, `Duplicate Kit Details count is ${duplicateAliases.length}; expected 4.`);
  assertGrade3(administrative.length === 2, `Administrative count is ${administrative.length}; expected 2.`);
  assertGrade3(
    canonicalRecords.length === grade3MusicArchive.canonical_records,
    `Canonical count is ${canonicalRecords.length}; expected ${grade3MusicArchive.canonical_records}.`,
  );
  assertGrade3(
    canonicalRecords.length + coverDetails.length + duplicateAliases.length + administrative.length
      === sourceRecords.length,
    'Not every grade-3 music source row was classified.',
  );
  assertGrade3(
    new Set(canonicalRecords.map((record) => record.url)).size === canonicalRecords.length,
    'Canonical grade-3 music URLs are not unique.',
  );
  for (const variant of Object.values(grade3MusicVariants)) {
    const count = canonicalRecords.filter((record) => record.book_id === variant.canonical_book_id).length;
    assertGrade3(
      count === variant.canonical_records,
      `${variant.canonical_book_id} has ${count} pages; expected ${variant.canonical_records}.`,
    );
  }
  assertGrade3(taskRepairs.length === 40, `Raw task repair count is ${taskRepairs.length}; expected 40.`);
  return {
    canonical_records: canonicalRecords,
    exclusions: {
      cover_details: coverDetails,
      duplicate_aliases: duplicateAliases,
      administrative,
    },
    duplicate_audit: duplicateAudit,
    task_repairs: taskRepairs,
  };
}

function markdownValue(values) {
  return values.join('; ');
}

function markdownField(label, value) {
  return value ? `- ${label}: ${value}` : `- ${label}:`;
}

export function renderGrade3MusicMarkdown(catalog) {
  const records = catalog.canonical_records;
  const lines = [
    '# Opiq lookup: grade 3 music',
    '',
    'Use this file only for grade 3 music requests. Do not substitute grade-2 music, mathematics, Russian-language, or Estonian-language subject sources.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3MusicArchive.path}\``,
    `- Archive SHA-256: \`${grade3MusicArchive.sha256}\``,
    `- Capture timestamp: ${grade3MusicArchive.capture_timestamp}`,
    `- Format version: ${grade3MusicArchive.format_version}`,
    '- Class: 3',
    `- Subject: ${grade3MusicSubject.en} / ${grade3MusicSubject.et} / ${grade3MusicSubject.ru}`,
    '- Page languages: Estonian, Russian',
    `- Source records: ${grade3MusicArchive.source_records}`,
    `- Page records included: ${records.length}`,
    '- Unique Kit Details excluded: 4',
    '- Duplicate Kit Details aliases excluded: 4',
    '- Administrative Impressum records excluded: 2',
    '- Subject normalization: the automatic mathematics label is replaced using all four Source Book IDs, Kit Details titles, chapter sequences, music headings, notation, singing, rhythm, and pupil task evidence.',
    '- Task evidence: richer raw chapter task arrays are used on 40 pages; no task is reconstructed or invented.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
  ];
  for (const variant of Object.values(grade3MusicVariants).sort(
    (left, right) => Number(left.kit_id) - Number(right.kit_id),
  )) {
    lines.push(
      `- \`${variant.canonical_book_id}\` — ${variant.canonical_title}; Source Book ID \`${variant.source_book_id}\`; kit ${variant.kit_id}; publisher not captured; ${variant.language}; ${variant.canonical_records} pages; ${variant.programme_type}.`,
    );
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

export function compareGrade3MusicEditions(canonicalRecords) {
  const byKit = (kit) => canonicalRecords.filter((record) => record.kit_id === kit);
  const oldByChapter = new Map(byKit('163').map((record) => [record.chapter_id, record]));
  const newByChapter = new Map(byKit('592').map((record) => [record.chapter_id, record]));
  assertGrade3(oldByChapter.size === 31 && newByChapter.size === 31, 'Edition comparison requires 31 pages per kit.');
  const differences = [];
  for (const [chapterId, oldRecord] of oldByChapter) {
    const newRecord = newByChapter.get(chapterId);
    assertGrade3(newRecord, `Kit 592 lacks matching chapter ID ${chapterId}.`);
    const changedFields = ['title', 'topics_et', 'topics_ru', 'topics_en', 'headings', 'task_examples']
      .filter((field) => JSON.stringify(oldRecord[field]) !== JSON.stringify(newRecord[field]));
    if (changedFields.length > 0) {
      differences.push({
        chapter_id: chapterId,
        kit_163_url: oldRecord.url,
        kit_592_url: newRecord.url,
        changed_fields: changedFields,
      });
    }
  }
  assertGrade3(
    differences.length === 1
      && differences[0].chapter_id === '1.15'
      && JSON.stringify(differences[0].changed_fields) === JSON.stringify(['headings']),
    `Unexpected edition differences: ${JSON.stringify(differences)}`,
  );
  return {
    matching_chapter_ids: 31,
    compact_equivalent_pages: 30,
    differing_pages: differences,
    decision: 'retain_as_distinct_editions',
  };
}

export function compareGrade3MusicLanguageEditions(canonicalRecords) {
  const normalizeTitle = (value) => normalizeQualityText(value).toLocaleLowerCase();
  const estonian = groupBy(
    canonicalRecords.filter((record) => record.kit_id === '195'),
    (record) => normalizeTitle(record.title),
  );
  const russian = groupBy(
    canonicalRecords.filter((record) => record.kit_id === '239'),
    (record) => normalizeTitle(record.title),
  );
  const sharedTitles = [...estonian.keys()].filter((title) => russian.has(title)).sort();
  assertGrade3(sharedTitles.length === 22, `Shared kit 195/239 title count is ${sharedTitles.length}; expected 22.`);
  return {
    shared_title_count: sharedTitles.length,
    shared_titles: sharedTitles,
    exact_url_overlap: 0,
    decision: 'retain_as_distinct_language_editions',
    reason: 'Repeated song titles do not override distinct kit, URL, book, language, and instructional context.',
  };
}

export function validateManifestGrade3MusicSource(source) {
  assertGrade3(source?.id === 'grade-3-music', 'Manifest grade-3 music route is missing.');
  assertGrade3(source.grade === 3 && source.grade_group === '1-4', 'Manifest grade/group differs.');
  assertGrade3(
    source.subject === 'music' && source.subject_et === grade3MusicSubject.et,
    'Manifest subject differs.',
  );
  assertGrade3(
    JSON.stringify(source.languages) === JSON.stringify(['et', 'ru']),
    'Manifest languages must contain et and ru.',
  );
  assertGrade3(source.source_archive === grade3MusicArchive.path, 'Manifest source archive differs.');
  assertGrade3(
    source.record_count === grade3MusicArchive.canonical_records,
    `Manifest record_count must be ${grade3MusicArchive.canonical_records}.`,
  );
  assertGrade3(
    JSON.stringify(source.source_scope?.included_kit_ids) === JSON.stringify(['163', '195', '239', '592']),
    'Manifest source scope must contain kits 163, 195, 239, and 592.',
  );
  assertGrade3(source.canonical_url_policy?.require_unique === true, 'Manifest must require unique URLs.');
  assertGrade3(
    JSON.stringify(source.canonical_subject_policy?.required_subject)
      === JSON.stringify(grade3MusicSubject),
    'Manifest canonical subject policy differs.',
  );
}

export function assertGeneratedArtifact(current, expected, label) {
  assertGrade3(current === expected, `${label} is stale.`);
}
