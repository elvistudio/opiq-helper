import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3MusicArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  assertUniqueLogicalMemberNames,
  auditZipMemberNames,
  buildGrade3MusicCatalog,
  compareGrade3MusicEditions,
  compareGrade3MusicLanguageEditions,
  decodeCp437,
  encodeCp437,
  grade3MusicArchive,
  grade3MusicSubject,
  grade3MusicVariants,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  recoverLogicalZipMemberName,
  renderGrade3MusicMarkdown,
  sha256Bytes,
  validateCanonicalGrade3MusicRecord,
  validateManifestGrade3MusicSource,
  validateRawGrade3MusicChapters,
} from './lib/grade-3-music.mjs';

const originalBytes = await readFile(grade3MusicArchive.path);
const originalArchive = await readCompactZip(grade3MusicArchive.path);
const sourceRecords = parseGrade3Jsonl(readZipText(originalArchive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(originalArchive, 'opiq_lookup.md');
const rawValidation = validateRawGrade3MusicChapters(sourceRecords, originalArchive, readZipText);
const catalog = buildGrade3MusicCatalog(sourceRecords, rawValidation.raw_by_identity);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const productionQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_muusika_qa.json', 'utf8'));
const clone = (value) => structuredClone(value);

async function withTemporaryArchive(bytes, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-music-'));
  const file = path.join(directory, 'fixture.zip');
  try {
    await writeFile(file, bytes);
    await callback(file);
  } finally {
    await rm(directory, { recursive: true });
  }
}

function withDuplicateCentralMemberName(bytes) {
  const changed = Buffer.from(bytes);
  let endOffset = changed.length - 22;
  while (endOffset >= 0 && changed.readUInt32LE(endOffset) !== 0x06054b50) endOffset -= 1;
  assert.ok(endOffset >= 0);
  const entryCount = changed.readUInt16LE(endOffset + 10);
  let cursor = changed.readUInt32LE(endOffset + 16);
  const firstNameByLength = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(changed.readUInt32LE(cursor), 0x02014b50);
    const nameLength = changed.readUInt16LE(cursor + 28);
    const extraLength = changed.readUInt16LE(cursor + 30);
    const commentLength = changed.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const first = firstNameByLength.get(nameLength);
    if (first && !changed.subarray(nameStart, nameStart + nameLength).equals(first)) {
      first.copy(changed, nameStart);
      return changed;
    }
    firstNameByLength.set(nameLength, Buffer.from(changed.subarray(nameStart, nameStart + nameLength)));
    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  throw new Error('Fixture archive has no same-length central member names.');
}

test('accepts the immutable original archive identity', () => {
  assert.doesNotThrow(() => assertGrade3MusicArchiveIdentity(originalBytes));
  assert.equal(sha256Bytes(originalBytes), grade3MusicArchive.sha256);
  assert.equal(originalBytes.length, grade3MusicArchive.byte_size);
});

test('rejects changed archive checksum and byte size', () => {
  const changed = Buffer.from(originalBytes);
  changed[100] ^= 1;
  assert.throws(() => assertGrade3MusicArchiveIdentity(changed), /checksum/);
  assert.throws(() => assertGrade3MusicArchiveIdentity(changed.subarray(0, -1)), /byte size/);
});

test('rejects a corrupt ZIP and an invalid CRC through the shared reader', async () => {
  await withTemporaryArchive(originalBytes.subarray(0, 256), async (file) => {
    await assert.rejects(readCompactZip(file), /end-of-central-directory/);
  });
  const changed = Buffer.from(originalBytes);
  const payloadOffset = changed.indexOf(Buffer.from('"formatVersion": "2.0"'));
  assert.ok(payloadOffset > 0);
  changed[payloadOffset + 2] ^= 1;
  await withTemporaryArchive(changed, async (file) => {
    await assert.rejects(readCompactZip(file), /CRC-32/);
  });
});

test('accepts all 324 safe unique stored ZIP members', () => {
  assert.equal(originalArchive.entryCount, 324);
  assert.equal(originalArchive.memberMetadata.size, 324);
  assert.doesNotThrow(() => [...originalArchive.entries.keys()].forEach(assertSafeMemberName));
  assert.doesNotThrow(() => assertRequiredMembers(originalArchive.entries.keys()));
  assert.ok([...originalArchive.memberMetadata.values()].every(
    (entry) => entry.compression_method === 0,
  ));
});

test('rejects a duplicate ZIP central-directory member name', async () => {
  await withTemporaryArchive(withDuplicateCentralMemberName(originalBytes), async (file) => {
    await assert.rejects(readCompactZip(file), /duplicate member name/);
  });
});

test('rejects unsafe paths and missing required representations', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/);
  assert.throws(() => assertRequiredMembers(['index.json']), /missing required member/);
});

test('recovers Estonian and Russian logical member names reversibly', () => {
  for (const logicalName of [
    'raw/Opiq-DB/books/muusikaõpik_3._klassile.json',
    'raw/Opiq-DB/books/музыка_–_волшебная_страна._3_класс.json',
  ]) {
    const metadata = originalArchive.memberMetadata.get(logicalName);
    const result = recoverLogicalZipMemberName(metadata);
    assert.equal(result.decoded_logical_name, logicalName);
    assert.equal(result.recovery_applied, true);
    assert.equal(result.cp437_round_trip_verified, true);
    assert.equal(result.utf8_round_trip_verified, true);
    assert.deepEqual(
      encodeCp437(decodeCp437(Buffer.from(metadata.stored_name_hex, 'hex'))),
      Buffer.from(metadata.stored_name_hex, 'hex'),
    );
  }
});

test('audits all 195 non-ASCII unflagged member names', () => {
  const audit = auditZipMemberNames(originalArchive.memberMetadata);
  assert.equal(audit.member_count, 324);
  assert.equal(audit.utf8_flag_set, 0);
  assert.equal(audit.non_ascii_recoveries, 195);
  assert.equal(audit.decoded_name_collisions, 0);
});

test('rejects invalid filename bytes and decoded-name collisions', () => {
  assert.throws(
    () => recoverLogicalZipMemberName({
      stored_name_hex: 'ff',
      utf8_filename_flag: false,
    }),
    /not valid UTF-8/,
  );
  assert.throws(
    () => assertUniqueLogicalMemberNames([
      { decoded_logical_name: 'same.json' },
      { decoded_logical_name: 'same.json' },
    ]),
    /collision/,
  );
});

test('compact JSONL and Markdown representations agree', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(
    sourceRecords,
    parseGrade3Markdown(sourceMarkdown),
  ));
});

test('rejects mismatched compact representations', () => {
  const changed = sourceMarkdown.replace('## Muusikamaa – Opiq', '## Changed source title');
  assert.throws(
    () => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(changed)),
    /field title differs/,
  );
});

test('accounts for all 315 source rows exactly once', () => {
  assert.equal(catalog.canonical_records.length, 305);
  assert.equal(catalog.exclusions.cover_details.length, 4);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 4);
  assert.equal(catalog.exclusions.administrative.length, 2);
  assert.equal(305 + 4 + 4 + 2, 315);
});

test('preserves four source-book-plus-kit identities', () => {
  assert.equal(Object.keys(grade3MusicVariants).length, 4);
  assert.deepEqual(
    new Set(catalog.canonical_records.map((record) => record.book_id)),
    new Set(Object.values(grade3MusicVariants).map((variant) => variant.canonical_book_id)),
  );
  assert.deepEqual(
    Object.fromEntries(Object.values(grade3MusicVariants).map((variant) => [
      variant.kit_id,
      catalog.canonical_records.filter((record) => record.kit_id === variant.kit_id).length,
    ])),
    { 163: 31, 195: 121, 239: 122, 592: 31 },
  );
});

test('preserves the 183 Estonian and 122 Russian page partition', () => {
  assert.equal(catalog.canonical_records.filter((record) => record.language === 'et').length, 183);
  assert.equal(catalog.canonical_records.filter((record) => record.language === 'ru').length, 122);
});

test('normalizes the automatic mathematics subject to music', () => {
  assert.ok(sourceRecords.every((record) => record.subject_en === 'mathematics'));
  assert.ok(catalog.canonical_records.every(
    (record) => record.subject_en === grade3MusicSubject.en
      && record.subject_et === grade3MusicSubject.et
      && record.subject_ru === grade3MusicSubject.ru,
  ));
  assert.ok(catalog.canonical_records.every(
    (record) => !record.topics_en.includes('mathematics')
      && !record.topics_et.includes('matemaatika')
      && !record.topics_ru.includes('математика'),
  ));
});

test('recovers only archive-supported task evidence', () => {
  assert.equal(catalog.task_repairs.length, 40);
  assert.deepEqual(
    Object.fromEntries([...new Set(catalog.task_repairs.map((repair) => repair.category))]
      .map((category) => [
        category,
        catalog.task_repairs.filter((repair) => repair.category === category).length,
      ])),
    {
      raw_task_recovered: 5,
      richer_raw_task_evidence: 34,
      truncated_compact_task_recovered: 1,
    },
  );
  const recovered = catalog.canonical_records.find(
    (record) => record.url === 'https://www.opiq.ee/kit/195/chapter/11210',
  );
  assert.match(recovered.task_examples[0], /kõige rohkem meeldis/u);
  assert.doesNotMatch(recovered.task_examples[0], /kõige ro$/u);
});

test('classifies 129 remaining pages without structured tasks', () => {
  const missing = catalog.canonical_records.filter((record) => record.task_examples.length === 0);
  assert.equal(missing.length, 129);
  assert.deepEqual(
    Object.fromEntries(['163', '195', '239', '592'].map((kit) => [
      kit,
      missing.filter((record) => record.kit_id === kit).length,
    ])),
    { 163: 9, 195: 52, 239: 59, 592: 9 },
  );
});

test('excludes all Kit Details pairs and both Impressum pages', () => {
  assert.equal(catalog.duplicate_audit.length, 4);
  assert.ok(catalog.duplicate_audit.every(
    (entry) => entry.differing_fields.length === 1
      && entry.differing_fields[0] === 'chapter_id',
  ));
  assert.deepEqual(
    new Set(catalog.exclusions.administrative.map((record) => record.url)),
    new Set([
      'https://www.opiq.ee/kit/163/chapter/19490',
      'https://www.opiq.ee/kit/592/chapter/33434',
    ]),
  );
  assert.ok(catalog.canonical_records.every(
    (record) => !record.url.includes('/Kit/Details/') && record.title !== 'Impressum',
  ));
});

test('keeps kits 163 and 592 as distinct editions', () => {
  const comparison = compareGrade3MusicEditions(catalog.canonical_records);
  assert.equal(comparison.matching_chapter_ids, 31);
  assert.equal(comparison.compact_equivalent_pages, 30);
  assert.equal(comparison.differing_pages[0].chapter_id, '1.15');
  assert.deepEqual(comparison.differing_pages[0].changed_fields, ['headings']);
});

test('keeps kits 195 and 239 as distinct language editions', () => {
  const comparison = compareGrade3MusicLanguageEditions(catalog.canonical_records);
  assert.equal(comparison.shared_title_count, 22);
  assert.equal(comparison.exact_url_overlap, 0);
  assert.equal(comparison.decision, 'retain_as_distinct_language_editions');
});

test('retains repeated titles when direct URLs differ', () => {
  const titleGroups = new Map();
  for (const record of catalog.canonical_records) {
    const key = record.title.toLocaleLowerCase();
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), record]);
  }
  const repeated = [...titleGroups.values()].filter((group) => group.length > 1);
  assert.equal(repeated.length, 52);
  assert.equal(repeated.reduce((total, group) => total + group.length, 0), 108);
  assert.ok(repeated.every((group) => new Set(group.map((record) => record.url)).size === group.length));
});

test('rejects an unknown source book, wrong kit, or missing raw chapter', () => {
  const unknownBook = clone(sourceRecords);
  unknownBook.find((record) => /\/chapter\//u.test(record.url)).book_id = 'unknown';
  assert.throws(
    () => buildGrade3MusicCatalog(unknownBook, rawValidation.raw_by_identity),
    /Unknown grade-3 music Source Book ID/,
  );
  const wrongKit = clone(sourceRecords);
  wrongKit.find((record) => /\/kit\/195\/chapter\//u.test(record.url)).url = 'https://www.opiq.ee/kit/999/chapter/11090';
  assert.throws(
    () => buildGrade3MusicCatalog(wrongKit, rawValidation.raw_by_identity),
    /outside audited kit/,
  );
  const missingRaw = new Map(rawValidation.raw_by_identity);
  const instructional = sourceRecords.find((record) => /\/kit\/195\/chapter\//u.test(record.url));
  missingRaw.delete(`${instructional.book_id}\u0000${instructional.chapter_id}`);
  assert.throws(
    () => buildGrade3MusicCatalog(sourceRecords, missingRaw),
    /Raw task evidence is missing/,
  );
});

test('rejects unaudited source subject, grade, language, or publisher changes', () => {
  const cases = [
    ['subject', (record) => { record.subject_en = 'music'; }, /raw subject differs/],
    ['grade', (record) => { record.grade = 2; }, /raw grade must be 3/],
    ['language', (record) => { record.language = 'ru'; }, /source language differs/],
    ['publisher', (record) => { record.publisher = 'Invented'; }, /publisher metadata/],
  ];
  for (const [, mutate, pattern] of cases) {
    const changed = clone(sourceRecords);
    const record = changed.find((candidate) => /\/kit\/195\/chapter\//u.test(candidate.url));
    mutate(record);
    assert.throws(() => buildGrade3MusicCatalog(changed, rawValidation.raw_by_identity), pattern);
  }
});

test('rejects conflicting or duplicate instructional URLs', () => {
  const conflictingDetail = clone(sourceRecords);
  conflictingDetail.filter((record) => record.url === 'https://www.opiq.ee/Kit/Details/195')[1].title = 'Conflict';
  assert.throws(
    () => buildGrade3MusicCatalog(conflictingDetail, rawValidation.raw_by_identity),
    /duplicate rows conflict/,
  );
  const duplicateInstructional = clone(sourceRecords);
  const instructional = duplicateInstructional.filter((record) => /\/kit\/195\/chapter\//u.test(record.url));
  instructional[1].url = instructional[0].url;
  assert.throws(
    () => buildGrade3MusicCatalog(duplicateInstructional, rawValidation.raw_by_identity),
    /duplicate URL groups|not limited to Kit Details/,
  );
});

test('rejects canonical mathematics, Russian-language, or Estonian-language routing', () => {
  for (const subject of [
    ['mathematics', 'matemaatika', 'математика'],
    ['Russian language', 'vene keel', 'русский язык'],
    ['Estonian language', 'eesti keel', 'эстонский язык'],
  ]) {
    const record = clone(catalog.canonical_records[0]);
    [record.subject_en, record.subject_et, record.subject_ru] = subject;
    assert.throws(
      () => validateCanonicalGrade3MusicRecord(record),
      /canonical subject must be music/,
    );
  }
});

test('rejects invented publisher and unprocessed replacement/control content', () => {
  const publisher = clone(catalog.canonical_records[0]);
  publisher.publisher = 'Invented';
  assert.throws(() => validateCanonicalGrade3MusicRecord(publisher), /not source-supported/);
  const payload = clone(catalog.canonical_records[0]);
  payload.task_examples = ['<math>1</math>'];
  assert.throws(() => validateCanonicalGrade3MusicRecord(payload), /unprocessed JSON\/HTML payload/);
  const replacement = clone(catalog.canonical_records[0]);
  replacement.title += '\ufffd';
  assert.throws(() => validateCanonicalGrade3MusicRecord(replacement), /replacement character/);
  const control = clone(catalog.canonical_records[0]);
  control.title += '\u0000';
  assert.throws(() => validateCanonicalGrade3MusicRecord(control), /control character/);
});

test('renders deterministic canonical Markdown', () => {
  assert.equal(
    renderGrade3MusicMarkdown(catalog),
    renderGrade3MusicMarkdown(buildGrade3MusicCatalog(sourceRecords, rawValidation.raw_by_identity)),
  );
});

test('validates the exact manifest route and reciprocal boundaries', () => {
  const route = manifest.sources.find((source) => source.id === 'grade-3-music');
  assert.doesNotThrow(() => validateManifestGrade3MusicSource(route));
  assert.throws(
    () => validateManifestGrade3MusicSource({ ...route, subject: 'mathematics' }),
    /Manifest subject differs/,
  );
  assert.throws(
    () => validateManifestGrade3MusicSource({
      ...route,
      source_scope: { ...route.source_scope, included_kit_ids: ['195'] },
    }),
    /kits 163, 195, 239, and 592/,
  );
  const musicIds = Object.values(grade3MusicVariants).map((variant) => variant.canonical_book_id);
  for (const routeId of ['grade-2-music', 'grade-3-mathematics', 'grade-3-russian', 'grade-3-russian-reading']) {
    const boundary = manifest.sources.find((source) => source.id === routeId).subject_boundary;
    assert.ok(musicIds.every((bookId) => boundary.forbidden_book_ids.includes(bookId)));
  }
});

test('rejects stale generated Markdown, QA, or audit text', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('canonical URLs are direct, unique, and owned by one route', async () => {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  assert.equal(targetUrls.size, 305);
  assert.ok([...targetUrls].every(
    (url) => /^https:\/\/www\.opiq\.ee\/kit\/(?:163|195|239|592)\/chapter\/\d+$/u.test(url),
  ));
  let owners = 0;
  for (const route of manifest.sources) {
    const markdown = await readFile(route.md_path, 'utf8');
    const routeUrls = new Set(
      [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)]
        .map((match) => match[1]),
    );
    const overlap = [...targetUrls].filter((url) => routeUrls.has(url));
    if (overlap.length > 0) {
      owners += 1;
      assert.equal(route.id, 'grade-3-music');
      assert.equal(overlap.length, 305);
    }
  }
  assert.equal(owners, 1);
});

test('production QA is deterministic and records zero hard errors', async () => {
  const markdown = await readFile('project-files/outputs/opiq_3klass_muusika.md');
  assert.equal(productionQa.generation.generated_at, grade3MusicArchive.capture_timestamp);
  assert.equal(productionQa.checksums.output_file_sha256, sha256Bytes(markdown));
  assert.equal(productionQa.source_records, 315);
  assert.equal(productionQa.page_records_included, 305);
  assert.equal(productionQa.records_without_task_examples, 129);
  assert.equal(productionQa.filename_encoding_audit.non_ascii_recoveries, 195);
  assert.equal(productionQa.canonical_url_audit.final_owner, 'grade-3-music');
  assert.ok(Object.values(productionQa.content_quality_audit.hard_errors).every(
    (count) => count === 0,
  ));
});
