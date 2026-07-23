import { createHash } from 'node:crypto';

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
import {
  assertUniqueLogicalMemberNames,
  decodeCp437,
  encodeCp437,
  recoverLogicalZipMemberName,
} from './grade-3-music.mjs';

export {
  assertCompactMarkdownMatches,
  assertGrade3,
  assertUniqueLogicalMemberNames,
  decodeCp437,
  encodeCp437,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  recoverLogicalZipMemberName,
  sha256Bytes,
};

export const grade3ArtsArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_3klass_kasitootuba_opiq_v2.zip',
  sha256: '8f4ef248fd74db31d3239b793644c9e2e97404d080d22d8fa75b1e22bd637997',
  byte_size: 592_932,
  uncompressed_size: 552_718,
  member_count: 185,
  source_records: 178,
  canonical_records: 89,
  format_version: '2.0',
  capture_timestamp: '2026-07-23T07:15:58.130Z',
});

export const grade2ArtsArchive = Object.freeze({
  path: 'project-files/inputs/final-zips/opiq_2klass_kasitootuba_opiq_v2.zip',
  sha256: '5de5260ab8b1973a4d5132dd248ec8198cf3062f9084f369442d9cf61ed110eb',
  byte_size: 863_666,
});

export const grade3ArtsSubject = Object.freeze({
  en: 'arts and crafts',
  et: 'kunst ja tööõpetus',
  ru: 'трудовое обучение и искусство',
});

const rawKit200BookId = 'kunsti-_ja_tööõpetus._4._osa._tähtpäeva\u00adkaardid';
const canonicalKit200BookId = 'kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid';

export const grade3ArtsVariants = Object.freeze({
  'kunsti-_ja_tööõpetus._3._osa': Object.freeze({
    source_book_id: 'kunsti-_ja_tööõpetus._3._osa',
    canonical_source_book_id: 'kunsti-_ja_tööõpetus._3._osa',
    canonical_book_id: 'kunsti-_ja_tööõpetus._3._osa__kit196',
    kit_id: '196',
    raw_title: 'Käsitöötuba – Opiq',
    canonical_title: 'Kunsti- ja tööõpetus. 3. osa',
    raw_grade: 3,
    canonical_grade: 3,
    compact_language: 'et',
    raw_book_language: 'ru',
    canonical_language: 'et',
    source_rows: 91,
    instructional_pages: 89,
    unique_details: 1,
    duplicate_details: 1,
    programme_type: 'ordinary_curriculum',
    canonical_owner: 'grade-3-arts-and-crafts',
  }),
  [canonicalKit200BookId]: Object.freeze({
    source_book_id: rawKit200BookId,
    canonical_source_book_id: canonicalKit200BookId,
    canonical_book_id: canonicalKit200BookId,
    kit_id: '200',
    raw_title: 'Käsitöötuba – Opiq',
    canonical_title: 'Kunsti- ja tööõpetus. 4. osa. Tähtpäevakaardid',
    raw_grade: 3,
    canonical_grade: 2,
    compact_language: 'et',
    raw_book_language: 'ru',
    canonical_language: 'et',
    source_rows: 87,
    instructional_pages: 85,
    unique_details: 1,
    duplicate_details: 1,
    programme_type: 'supplementary',
    canonical_owner: 'grade-2-arts-and-crafts',
  }),
});

export const requiredGrade3ArtsMembers = Object.freeze([
  'index.json',
  'opiq_lookup.md',
  'opiq_lookup.jsonl',
  'topic_map.json',
  'raw/Opiq-DB/index.json',
]);

const rawSubject = 'mathematics / matemaatika / математика';
const directChapterUrl = /^https:\/\/www\.opiq\.ee\/kit\/(\d+)\/chapter\/(\d+)$/u;
const forbiddenControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const invisiblePattern = /[\u00ad\u200b-\u200d\u2060\ufeff]/u;
const serviceHeadings = new Set([
  'Õpetaja lisatud materjal',
  'Minu lisatud materjal',
  'Seotud sisu',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSourceBookId(value) {
  return String(value ?? '').replaceAll('\u00ad', '').normalize('NFC');
}

export function sourceSubject(record) {
  return `${record.subject_en} / ${record.subject_et} / ${record.subject_ru}`;
}

export function kitId(recordOrUrl) {
  const url = typeof recordOrUrl === 'string' ? recordOrUrl : recordOrUrl.url;
  return url.match(/\/kit\/(\d+)/iu)?.[1] ?? url.match(/\/Kit\/Details\/(\d+)/u)?.[1] ?? '';
}

export function sourceIdentity(record) {
  return `${record.book_id}\u0000${record.chapter_id}`;
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
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return groups;
}

export function assertGrade3ArtsArchiveIdentity(bytes) {
  assertGrade3(
    bytes.length === grade3ArtsArchive.byte_size,
    `Original archive byte size is ${bytes.length}; expected ${grade3ArtsArchive.byte_size}.`,
  );
  const actual = sha256Bytes(bytes);
  assertGrade3(
    actual === grade3ArtsArchive.sha256,
    `Original archive checksum is ${actual}; expected ${grade3ArtsArchive.sha256}.`,
  );
}

export function assertGrade2ArtsArchiveIdentity(bytes) {
  assertGrade3(
    bytes.length === grade2ArtsArchive.byte_size,
    `Grade-2 comparison archive byte size is ${bytes.length}; expected ${grade2ArtsArchive.byte_size}.`,
  );
  const actual = sha256Bytes(bytes);
  assertGrade3(
    actual === grade2ArtsArchive.sha256,
    `Grade-2 comparison archive checksum is ${actual}; expected ${grade2ArtsArchive.sha256}.`,
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
  requiredGrade3ArtsMembers.forEach((name) => {
    assertGrade3(names.has(name), `Original archive is missing required member ${name}.`);
  });
}

export function auditGrade3ArtsZipMemberNames(memberMetadata) {
  const sourceBookIds = [
    grade3ArtsVariants['kunsti-_ja_tööõpetus._3._osa'].source_book_id,
    grade3ArtsVariants[canonicalKit200BookId].source_book_id,
  ];
  const entries = [...memberMetadata.values()].map(
    (metadata) => recoverLogicalZipMemberName(metadata, sourceBookIds),
  );
  assertUniqueLogicalMemberNames(entries);
  const recovered = entries.filter((entry) => entry.recovery_applied);
  assertGrade3(entries.length === grade3ArtsArchive.member_count, 'ZIP member-name audit count changed.');
  assertGrade3(recovered.length === 180, `Recovered non-ASCII member count is ${recovered.length}; expected 180.`);
  assertGrade3(
    entries.every((entry) => entry.utf8_filename_flag === false),
    'The original archive unexpectedly sets a UTF-8 filename flag.',
  );
  return {
    specification: 'stored CP437 display -> byte-for-byte CP437 re-encoding -> fatal UTF-8 decoding',
    member_count: entries.length,
    utf8_flag_set: 0,
    utf8_flag_absent: entries.length,
    ascii_only_names: entries.length - recovered.length,
    non_ascii_recoveries: recovered.length,
    round_trip_verified: entries.length,
    decoded_name_collisions: 0,
    entries: recovered,
  };
}

export function isKitDetail(record) {
  return /^https:\/\/www\.opiq\.ee\/Kit\/Details\/(?:196|200)$/u.test(record.url);
}

function normalizeList(values) {
  return values.map(normalizeQualityText).filter(Boolean);
}

function normalizeTopics(values, field) {
  const forbidden = {
    topics_et: 'matemaatika',
    topics_ru: 'математика',
    topics_en: 'mathematics',
  }[field];
  const required = {
    topics_et: grade3ArtsSubject.et,
    topics_ru: grade3ArtsSubject.ru,
    topics_en: grade3ArtsSubject.en,
  }[field];
  const retained = normalizeList(values).filter(
    (value) => value.toLocaleLowerCase() !== forbidden,
  );
  return [
    required,
    ...retained.filter((value) => value.toLocaleLowerCase() !== required.toLocaleLowerCase()),
  ];
}

export function validateRawArtsChapters(sourceRecords, archive, readZipText) {
  const chapterMembers = [...archive.entries.keys()].filter(
    (name) => name.startsWith('raw/Opiq-DB/chapters/'),
  );
  assertGrade3(
    chapterMembers.length === sourceRecords.length,
    `Raw chapter count is ${chapterMembers.length}; expected ${sourceRecords.length}.`,
  );
  const rawByIdentity = new Map();
  const imagesByKit = { 196: 0, 200: 0 };
  let emptyTaskArrays = 0;
  let serviceHeadingOccurrences = 0;
  for (const member of chapterMembers) {
    const raw = JSON.parse(readZipText(archive, member));
    assertGrade3(isPlainObject(raw), `${member} must contain an object.`);
    const identity = `${raw.bookId}\u0000${raw.chapterId}`;
    assertGrade3(!rawByIdentity.has(identity), `Duplicate raw chapter identity ${identity}.`);
    assertGrade3(
      Array.isArray(raw.headings) && Array.isArray(raw.tasks) && Array.isArray(raw.images),
      `${member} is missing raw page arrays.`,
    );
    const rawKit = kitId(raw.url);
    assertGrade3(Object.hasOwn(imagesByKit, rawKit), `${member} has an unknown kit.`);
    imagesByKit[rawKit] += raw.images.length;
    if (raw.tasks.length === 0) emptyTaskArrays += 1;
    serviceHeadingOccurrences += raw.headings.filter(
      (heading) => serviceHeadings.has(normalizeQualityText(heading.text)),
    ).length;
    rawByIdentity.set(identity, { member, raw });
  }

  for (const record of sourceRecords) {
    const entry = rawByIdentity.get(sourceIdentity(record));
    assertGrade3(entry, `Raw chapter is missing for ${sourceIdentity(record)}.`);
    const { raw, member } = entry;
    assertGrade3(normalizeQualityText(raw.chapterTitle) === record.title, `${member} title differs from compact JSONL.`);
    assertGrade3(raw.url === record.url, `${member} URL differs from compact JSONL.`);
    const rawHeadingSet = new Set(raw.headings.map((heading) => normalizeQualityText(heading.text)));
    assertGrade3(
      record.headings.every((heading) => rawHeadingSet.has(normalizeQualityText(heading))),
      `${member} compact heading is absent from raw headings.`,
    );
    assertGrade3(record.task_examples.length === 0 && raw.tasks.length === 0, `${member} unexpectedly contains structured tasks.`);
    assertGrade3(
      typeof raw.scrapedAt === 'string' && !Number.isNaN(Date.parse(raw.scrapedAt)),
      `${member} scrapedAt is invalid.`,
    );
  }
  assertGrade3(rawByIdentity.size === sourceRecords.length, 'Raw chapter members are not fully referenced.');
  assertGrade3(imagesByKit[196] === 364, `Kit 196 image count is ${imagesByKit[196]}; expected 364.`);
  assertGrade3(imagesByKit[200] === 127, `Kit 200 image count is ${imagesByKit[200]}; expected 127.`);
  return {
    raw_by_identity: rawByIdentity,
    audit: {
      raw_chapter_records: chapterMembers.length,
      compact_headings_missing_from_raw: 0,
      raw_empty_task_arrays: emptyTaskArrays,
      raw_image_references: imagesByKit[196] + imagesByKit[200],
      images_by_kit: imagesByKit,
      service_heading_occurrences: serviceHeadingOccurrences,
      unexplained_differences: 0,
    },
  };
}

function variantForRecord(record) {
  return grade3ArtsVariants[normalizeSourceBookId(record.book_id)];
}

function normalizeInstructionalRecord(record) {
  const variant = variantForRecord(record);
  assertGrade3(variant, `Unknown grade-3 arts Source Book ID: ${record.book_id}`);
  assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside audited kit ${variant.kit_id}.`);
  assertGrade3(record.book === variant.raw_title, `${record.url} captured book title changed.`);
  assertGrade3(record.grade === variant.raw_grade, `${record.url} raw grade changed.`);
  assertGrade3(record.language === variant.compact_language, `${record.url} compact language differs.`);
  assertGrade3(record.publisher === '', `${record.url} unexpectedly contains publisher metadata.`);
  assertGrade3(sourceSubject(record) === rawSubject, `${record.url} raw subject differs from the audited mathematics error.`);
  assertGrade3(record.task_examples.length === 0, `${record.url} compact task array unexpectedly contains data.`);

  const canonical = {
    title: normalizeQualityText(record.title),
    url: record.url,
    book: variant.canonical_title,
    book_id: variant.canonical_book_id,
    source_book_id: variant.canonical_source_book_id,
    chapter_id: String(record.chapter_id),
    grade: 3,
    subject_en: grade3ArtsSubject.en,
    subject_et: grade3ArtsSubject.et,
    subject_ru: grade3ArtsSubject.ru,
    language: variant.canonical_language,
    publisher: '',
    programme_type: variant.programme_type,
    kit_id: variant.kit_id,
    topics_et: normalizeTopics(record.topics_et, 'topics_et'),
    topics_ru: normalizeTopics(record.topics_ru, 'topics_ru'),
    topics_en: normalizeTopics(record.topics_en, 'topics_en'),
    headings: normalizeList(record.headings),
    task_examples: [],
  };
  validateCanonicalGrade3ArtsRecord(canonical);
  return canonical;
}

export function validateCanonicalGrade3ArtsRecord(record) {
  const match = record.url.match(directChapterUrl);
  assertGrade3(match, `${record.url} is not a direct canonical Opiq chapter URL.`);
  assertGrade3(match[1] === '196' && record.kit_id === '196', `${record.url} is outside canonical kit 196.`);
  assertGrade3(record.grade === 3, `${record.url} canonical grade must be 3.`);
  assertGrade3(
    sourceSubject(record) === `${grade3ArtsSubject.en} / ${grade3ArtsSubject.et} / ${grade3ArtsSubject.ru}`,
    `${record.url} canonical subject must be arts and crafts.`,
  );
  const variant = grade3ArtsVariants['kunsti-_ja_tööõpetus._3._osa'];
  assertGrade3(record.book_id === variant.canonical_book_id, `${record.url} canonical Book ID differs.`);
  assertGrade3(record.source_book_id === variant.canonical_source_book_id, `${record.url} Source Book ID differs.`);
  assertGrade3(record.book === variant.canonical_title, `${record.url} canonical book title differs.`);
  assertGrade3(record.language === 'et', `${record.url} canonical language must be et.`);
  assertGrade3(record.publisher === '', `${record.url} publisher is not source-supported.`);
  assertGrade3(record.programme_type === 'ordinary_curriculum', `${record.url} programme type differs.`);
  assertGrade3(record.title.length > 0, `${record.url} canonical title is empty.`);
  assertGrade3(record.headings.length > 0, `${record.url} canonical headings are empty.`);
  assertGrade3(record.task_examples.length === 0, `${record.url} contains invented structured task text.`);
  const text = [
    record.title,
    record.book,
    record.book_id,
    record.source_book_id,
    ...record.topics_et,
    ...record.topics_ru,
    ...record.topics_en,
    ...record.headings,
  ].join('\n');
  assertGrade3(!text.includes('\ufffd'), `${record.url} contains the Unicode replacement character.`);
  assertGrade3(!forbiddenControlPattern.test(text), `${record.url} contains a forbidden control character.`);
  assertGrade3(!invisiblePattern.test(text), `${record.url} contains an invisible control character.`);
  assertGrade3(!containsUnprocessedPayload(text), `${record.url} contains an unprocessed JSON/HTML payload.`);
  assertGrade3(
    !record.topics_et.some((value) => value.toLocaleLowerCase() === 'matemaatika')
      && !record.topics_ru.some((value) => value.toLocaleLowerCase() === 'математика')
      && !record.topics_en.some((value) => value.toLocaleLowerCase() === 'mathematics'),
    `${record.url} retains a generated mathematics topic alias.`,
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

export function buildGrade3ArtsCatalog(sourceRecords) {
  assertGrade3(
    sourceRecords.length === grade3ArtsArchive.source_records,
    `Original archive has ${sourceRecords.length} source records; expected ${grade3ArtsArchive.source_records}.`,
  );
  const duplicateGroups = [...groupBy(sourceRecords, (record) => record.url).entries()]
    .filter(([, records]) => records.length > 1);
  assertGrade3(duplicateGroups.length === 2, `Duplicate URL group count is ${duplicateGroups.length}; expected 2.`);
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
      source_book_id_raw: records[0].book_id,
      source_book_id_canonical: normalizeSourceBookId(records[0].book_id),
      chapter_ids: records.map((record) => String(record.chapter_id)),
      differing_fields: differing,
      decision: 'exclude_unique_kit_detail_and_duplicate_alias',
    };
  }).sort((left, right) => Number(left.kit_id) - Number(right.kit_id));

  const canonicalRecords = [];
  const sharedSupplementary = [];
  const coverDetails = [];
  const duplicateAliases = [];
  const seenDetailUrls = new Set();
  for (const record of sourceRecords) {
    const variant = variantForRecord(record);
    assertGrade3(variant, `Unknown grade-3 arts Source Book ID: ${record.book_id}`);
    assertGrade3(kitId(record) === variant.kit_id, `${record.url} is outside audited kit ${variant.kit_id}.`);
    if (isKitDetail(record)) {
      if (seenDetailUrls.has(record.url)) duplicateAliases.push(record);
      else {
        seenDetailUrls.add(record.url);
        coverDetails.push(record);
      }
      continue;
    }
    if (variant.kit_id === '200') {
      sharedSupplementary.push(record);
      continue;
    }
    canonicalRecords.push(normalizeInstructionalRecord(record));
  }

  assertGrade3(coverDetails.length === 2, `Unique Kit Details count is ${coverDetails.length}; expected 2.`);
  assertGrade3(duplicateAliases.length === 2, `Duplicate Kit Details count is ${duplicateAliases.length}; expected 2.`);
  assertGrade3(sharedSupplementary.length === 85, `Shared supplementary count is ${sharedSupplementary.length}; expected 85.`);
  assertGrade3(canonicalRecords.length === 89, `Canonical count is ${canonicalRecords.length}; expected 89.`);
  assertGrade3(
    canonicalRecords.length + sharedSupplementary.length + coverDetails.length + duplicateAliases.length
      === sourceRecords.length,
    'Not every grade-3 arts source row was classified.',
  );
  assertGrade3(
    new Set(canonicalRecords.map((record) => record.url)).size === canonicalRecords.length,
    'Canonical grade-3 arts URLs are not unique.',
  );
  const repeatedTitleGroups = [...groupBy(
    sourceRecords.filter((record) => !isKitDetail(record)),
    (record) => record.title,
  ).entries()].filter(([, records]) => records.length > 1)
    .map(([title, records]) => ({
      title,
      kit_ids: [...new Set(records.map(kitId))].sort(),
      urls: records.map((record) => record.url).sort(),
      decision: 'retain_distinct_canonical_chapters',
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  assertGrade3(
    JSON.stringify(repeatedTitleGroups.map((entry) => entry.title))
      === JSON.stringify(['Liblikas', 'Pop-up-tehnikas kaart', 'Volditud lill']),
    `Unexpected repeated-title groups: ${repeatedTitleGroups.map((entry) => entry.title).join(', ')}`,
  );
  return {
    canonical_records: canonicalRecords,
    shared_supplementary_records: sharedSupplementary,
    exclusions: { cover_details: coverDetails, duplicate_aliases: duplicateAliases },
    duplicate_audit: duplicateAudit,
    repeated_title_groups: repeatedTitleGroups,
  };
}

function comparableCompactRecord(record) {
  return {
    title: record.title,
    url: record.url,
    book: record.book,
    book_id: normalizeSourceBookId(record.book_id),
    chapter_id: String(record.chapter_id),
    subject_et: record.subject_et,
    subject_ru: record.subject_ru,
    subject_en: record.subject_en,
    language: record.language,
    publisher: record.publisher,
    topics_et: record.topics_et,
    topics_ru: record.topics_ru,
    topics_en: record.topics_en,
    headings: record.headings,
    task_examples: record.task_examples,
    source_sequence: record.source_sequence,
  };
}

function comparableRawRecord(raw) {
  return {
    bookId: normalizeSourceBookId(raw.bookId),
    chapterId: String(raw.chapterId),
    chapterTitle: raw.chapterTitle,
    headings: raw.headings,
    images: raw.images,
    keywords: raw.keywords,
    tasks: raw.tasks,
    url: raw.url,
  };
}

function imageHash(raw) {
  return createHash('sha256').update(JSON.stringify(raw.images)).digest('hex');
}

export function compareKit200Captures(
  grade3Records,
  grade2Records,
  grade3RawByIdentity,
  grade2RawByIdentity,
  grade2CanonicalRecords,
) {
  const grade3Pages = grade3Records.filter(
    (record) => kitId(record) === '200' && !isKitDetail(record),
  );
  const grade2Pages = grade2Records.filter(
    (record) => kitId(record) === '200' && !isKitDetail(record),
  );
  assertGrade3(grade3Pages.length === 85 && grade2Pages.length === 85, 'Kit 200 comparison requires 85 pages per capture.');
  const grade2ByUrl = new Map(grade2Pages.map((record) => [record.url, record]));
  assertGrade3(grade2ByUrl.size === 85, 'Grade-2 kit 200 URL set is not unique.');
  let stableCompactMatches = 0;
  let gradeOnlyDifferences = 0;
  let stableRawMatches = 0;
  let captureTimestampDifferences = 0;
  let imageHashMatches = 0;
  for (const grade3Record of grade3Pages) {
    const grade2Record = grade2ByUrl.get(grade3Record.url);
    assertGrade3(grade2Record, `Grade-2 capture lacks kit 200 URL ${grade3Record.url}.`);
    assertGrade3(
      JSON.stringify(comparableCompactRecord(grade3Record))
        === JSON.stringify(comparableCompactRecord(grade2Record)),
      `Kit 200 compact content differs for ${grade3Record.url}.`,
    );
    stableCompactMatches += 1;
    assertGrade3(grade3Record.grade === 3 && grade2Record.grade === 2, `${grade3Record.url} grade context changed unexpectedly.`);
    gradeOnlyDifferences += 1;

    const grade3Raw = grade3RawByIdentity.get(sourceIdentity(grade3Record))?.raw;
    const grade2Identity = `${grade2Record.book_id}\u0000${grade2Record.chapter_id}`;
    const grade2Raw = grade2RawByIdentity.get(grade2Identity)?.raw;
    assertGrade3(grade3Raw && grade2Raw, `Raw kit 200 evidence is missing for ${grade3Record.url}.`);
    assertGrade3(
      JSON.stringify(comparableRawRecord(grade3Raw)) === JSON.stringify(comparableRawRecord(grade2Raw)),
      `Kit 200 raw content differs for ${grade3Record.url}.`,
    );
    stableRawMatches += 1;
    assertGrade3(grade3Raw.scrapedAt !== grade2Raw.scrapedAt, `${grade3Record.url} capture timestamps unexpectedly match.`);
    captureTimestampDifferences += 1;
    assertGrade3(imageHash(grade3Raw) === imageHash(grade2Raw), `${grade3Record.url} raw image references differ.`);
    imageHashMatches += 1;
  }
  assertGrade3(
    grade3Pages.map((record) => record.url).join('\n')
      === grade2Pages.map((record) => record.url).join('\n'),
    'Kit 200 chapter ordering differs between grade captures.',
  );
  const grade2CanonicalKit200 = grade2CanonicalRecords.filter(
    (record) => record.url.includes('/kit/200/chapter/'),
  );
  assertGrade3(grade2CanonicalKit200.length === 85, 'Grade-2 canonical route does not own all 85 kit 200 pages.');
  assertGrade3(
    grade2CanonicalKit200.every(
      (record) => record.book_id === canonicalKit200BookId
        && record.programme_type === 'supplementary'
        && record.grade === 2,
    ),
    'Grade-2 canonical kit 200 ownership metadata differs.',
  );
  assertGrade3(
    grade2CanonicalKit200.map((record) => record.url).join('\n')
      === grade3Pages.map((record) => record.url).join('\n'),
    'Grade-2 canonical kit 200 URL set differs from the new capture.',
  );
  return {
    kit_id: '200',
    instructional_pages_per_capture: 85,
    url_set_matches: 85,
    chapter_order_matches: 85,
    compact_stable_field_matches: stableCompactMatches,
    compact_grade_context_differences: gradeOnlyDifferences,
    raw_stable_field_matches: stableRawMatches,
    raw_capture_timestamp_differences: captureTimestampDifferences,
    raw_image_reference_hash_matches: imageHashMatches,
    source_book_id_matches_after_soft_hyphen_normalization: 85,
    grade2_canonical_page_matches: 85,
    canonical_owner: 'grade-2-arts-and-crafts',
    grade3_classification: 'already_owned_shared_supplementary',
    cross_route_overlap_after_import: 0,
    lost_urls: 0,
    decision: 'retain_existing_grade_2_supplementary_owner',
    reason: 'All stable instructional fields and image references match. Only automatic grade context and capture timestamps differ, which is not intrinsic grade-specific evidence.',
  };
}

function markdownValue(values) {
  return values.join('; ');
}

function markdownField(label, value) {
  return value ? `- ${label}: ${value}` : `- ${label}:`;
}

export function renderGrade3ArtsMarkdown(catalog) {
  const records = catalog.canonical_records;
  const variant = grade3ArtsVariants['kunsti-_ja_tööõpetus._3._osa'];
  const lines = [
    '# Opiq lookup: grade 3 arts and crafts',
    '',
    'Use this file only for grade 3 arts-and-crafts requests. Do not substitute grade-2 kit 200, mathematics, Estonian-language, or adjacent-grade material.',
    '',
    '## Source Summary',
    `- Original source archive: \`${grade3ArtsArchive.path}\``,
    `- Archive SHA-256: \`${grade3ArtsArchive.sha256}\``,
    `- Capture timestamp: ${grade3ArtsArchive.capture_timestamp}`,
    `- Format version: ${grade3ArtsArchive.format_version}`,
    '- Class: 3',
    `- Subject: ${grade3ArtsSubject.en} / ${grade3ArtsSubject.et} / ${grade3ArtsSubject.ru}`,
    '- Page language: Estonian',
    `- Source records: ${grade3ArtsArchive.source_records}`,
    `- Page records included: ${records.length}`,
    '- Unique Kit Details excluded: 2',
    '- Duplicate Kit Details aliases excluded: 2',
    '- Shared supplementary pages excluded: 85 (kit 200 remains owned by grade-2-arts-and-crafts)',
    '- Subject normalization: the automatic mathematics label is replaced using Source Book IDs, kit identity, chapter sequences, craft headings, and captured image evidence.',
    '- Task evidence: all 89 pages lack structured task arrays; no practical instruction is reconstructed from image filenames.',
    '- Curriculum coverage: not verified',
    '',
    '## Books',
    `- \`${variant.canonical_book_id}\` — ${variant.canonical_title}; Source Book ID \`${variant.canonical_source_book_id}\`; kit ${variant.kit_id}; publisher not captured; et; 89 pages; ordinary curriculum.`,
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

export function validateManifestGrade3ArtsSource(source) {
  assertGrade3(source?.id === 'grade-3-arts-and-crafts', 'Manifest grade-3 arts route is missing.');
  assertGrade3(source.grade === 3 && source.grade_group === '1-4', 'Manifest grade/group differs.');
  assertGrade3(
    source.subject === 'arts_and_crafts' && source.subject_et === grade3ArtsSubject.et,
    'Manifest subject differs.',
  );
  assertGrade3(JSON.stringify(source.languages) === JSON.stringify(['et']), 'Manifest language differs.');
  assertGrade3(source.md_path === 'project-files/outputs/opiq_3klass_kunst_ja_tooopetus.md', 'Manifest md_path differs.');
  assertGrade3(source.source_archive === grade3ArtsArchive.path, 'Manifest source_archive differs.');
  assertGrade3(source.qa_path === 'project-files/outputs/opiq_3klass_kunst_ja_tooopetus_qa.json', 'Manifest qa_path differs.');
  assertGrade3(source.record_count === 89 && source.format_version === '2.0', 'Manifest record count/version differs.');
  assertGrade3(
    JSON.stringify(source.source_scope?.included_kit_ids) === JSON.stringify(['196']),
    'Manifest source scope must include only kit 196.',
  );
  assertGrade3(source.source_scope?.programme_type === 'ordinary_curriculum', 'Manifest programme type differs.');
  const excluded = source.source_scope?.excluded_existing_owner_kits;
  assertGrade3(Array.isArray(excluded) && excluded.length === 1, 'Manifest must declare one existing-owner exclusion.');
  assertGrade3(
    excluded[0]?.kit_id === '200'
      && excluded[0]?.owner_source_id === 'grade-2-arts-and-crafts'
      && excluded[0]?.role === 'shared_supplementary',
    'Manifest kit 200 owner declaration differs.',
  );
  const forbidden = new Set(source.subject_boundary?.forbidden_book_ids ?? []);
  for (const bookId of [
    'kunsti-_ja_tööõpetus._2._osa',
    canonicalKit200BookId,
    'трудовое_обучение_и_искусство._2_часть',
  ]) {
    assertGrade3(forbidden.has(bookId), `Manifest boundary is missing ${bookId}.`);
  }
  assertGrade3(source.canonical_url_policy?.require_unique === true, 'Manifest canonical URL policy differs.');
  assertGrade3(
    JSON.stringify(source.canonical_subject_policy?.required_subject) === JSON.stringify(grade3ArtsSubject),
    'Manifest canonical subject policy differs.',
  );
}

export function auditCanonicalContentQuality(records) {
  const hardErrors = {
    replacement_character: 0,
    forbidden_control_character: 0,
    invisible_character: 0,
    malformed_unicode: 0,
    non_nfc_text: 0,
    html_mathml_or_json_payload: 0,
    malformed_url: 0,
    missing_title: 0,
    missing_headings: 0,
  };
  const hasUnpairedSurrogate = (text) => {
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) return true;
    }
    return false;
  };
  for (const record of records) {
    const text = [
      record.title,
      record.book,
      ...record.headings,
      ...record.task_examples,
      ...record.topics_et,
      ...record.topics_ru,
      ...record.topics_en,
    ].join('\n');
    if (text.includes('\ufffd')) hardErrors.replacement_character += 1;
    if (forbiddenControlPattern.test(text)) hardErrors.forbidden_control_character += 1;
    if (invisiblePattern.test(text)) hardErrors.invisible_character += 1;
    if (hasUnpairedSurrogate(text)) hardErrors.malformed_unicode += 1;
    if (text.normalize('NFC') !== text) hardErrors.non_nfc_text += 1;
    if (containsUnprocessedPayload(text)) hardErrors.html_mathml_or_json_payload += 1;
    if (!directChapterUrl.test(record.url)) hardErrors.malformed_url += 1;
    if (!record.title) hardErrors.missing_title += 1;
    if (record.headings.length === 0) hardErrors.missing_headings += 1;
  }
  assertGrade3(Object.values(hardErrors).every((count) => count === 0), 'Canonical content-quality audit contains hard errors.');
  return {
    hard_errors: hardErrors,
    classified_warnings: {
      missing_structured_task_examples: {
        total: records.filter((record) => record.task_examples.length === 0).length,
        classification: 'capture_limitation_for_image_heavy_craft_pages',
      },
      missing_publishers: {
        total: records.filter((record) => !record.publisher).length,
        classification: 'source_metadata_absent_do_not_invent',
      },
      repeated_titles: {
        total: 2,
        groups: 1,
        classification: 'distinct_urls_and_chapter_contexts_retained',
      },
    },
  };
}

export function assertGeneratedArtifact(current, expected, path) {
  assertGrade3(current === expected, `${path} is stale.`);
}
