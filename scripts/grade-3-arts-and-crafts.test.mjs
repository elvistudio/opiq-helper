import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade2ArtsArchiveIdentity,
  assertGrade3ArtsArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  assertUniqueLogicalMemberNames,
  auditCanonicalContentQuality,
  auditGrade3ArtsZipMemberNames,
  buildGrade3ArtsCatalog,
  compareKit200Captures,
  decodeCp437,
  encodeCp437,
  grade2ArtsArchive,
  grade3ArtsArchive,
  grade3ArtsSubject,
  grade3ArtsVariants,
  normalizeSourceBookId,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  recoverLogicalZipMemberName,
  renderGrade3ArtsMarkdown,
  sha256Bytes,
  sourceIdentity,
  validateCanonicalGrade3ArtsRecord,
  validateManifestGrade3ArtsSource,
  validateRawArtsChapters,
} from './lib/grade-3-arts-and-crafts.mjs';

const originalBytes = await readFile(grade3ArtsArchive.path);
const originalArchive = await readCompactZip(grade3ArtsArchive.path);
const sourceRecords = parseGrade3Jsonl(readZipText(originalArchive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(originalArchive, 'opiq_lookup.md');
const rawValidation = validateRawArtsChapters(
  sourceRecords,
  originalArchive,
  readZipText,
);
const catalog = buildGrade3ArtsCatalog(sourceRecords);
const grade2Bytes = await readFile(grade2ArtsArchive.path);
const grade2Archive = await readCompactZip(grade2ArtsArchive.path);
const grade2Records = parseGrade3Jsonl(readZipText(grade2Archive, 'opiq_lookup.jsonl'));
const grade2Canonical = parseGrade3Markdown(
  await readFile('project-files/outputs/opiq_2klass_kunst_ja_tooopetus.md', 'utf8'),
);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const productionQa = JSON.parse(
  await readFile('project-files/outputs/opiq_3klass_kunst_ja_tooopetus_qa.json', 'utf8'),
);
const clone = (value) => structuredClone(value);

function rawKitMap(archive, kit) {
  const result = new Map();
  for (const name of archive.entries.keys()) {
    if (!name.startsWith('raw/Opiq-DB/chapters/')) continue;
    const raw = JSON.parse(readZipText(archive, name));
    if (!raw.url.includes(`/kit/${kit}/`)) continue;
    result.set(`${raw.bookId}\u0000${raw.chapterId}`, { member: name, raw });
  }
  return result;
}

const grade2RawKit200 = rawKitMap(grade2Archive, '200');

async function withTemporaryArchive(bytes, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-arts-'));
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
    firstNameByLength.set(
      nameLength,
      Buffer.from(changed.subarray(nameStart, nameStart + nameLength)),
    );
    cursor = nameStart + nameLength + extraLength + commentLength;
  }
  throw new Error('Fixture archive has no same-length central member names.');
}

test('accepts both immutable source archive identities', () => {
  assert.doesNotThrow(() => assertGrade3ArtsArchiveIdentity(originalBytes));
  assert.doesNotThrow(() => assertGrade2ArtsArchiveIdentity(grade2Bytes));
  assert.equal(sha256Bytes(originalBytes), grade3ArtsArchive.sha256);
  assert.equal(originalBytes.length, grade3ArtsArchive.byte_size);
});

test('rejects changed archive checksum and byte size', () => {
  const changed = Buffer.from(originalBytes);
  changed[100] ^= 1;
  assert.throws(() => assertGrade3ArtsArchiveIdentity(changed), /checksum/u);
  assert.throws(
    () => assertGrade3ArtsArchiveIdentity(changed.subarray(0, -1)),
    /byte size/u,
  );
});

test('rejects a corrupt ZIP and an invalid CRC', async () => {
  await withTemporaryArchive(originalBytes.subarray(0, 256), async (file) => {
    await assert.rejects(readCompactZip(file), /end-of-central-directory/u);
  });
  const changed = Buffer.from(originalBytes);
  const payloadOffset = changed.indexOf(Buffer.from('"formatVersion": "2.0"'));
  assert.ok(payloadOffset > 0);
  changed[payloadOffset + 2] ^= 1;
  await withTemporaryArchive(changed, async (file) => {
    await assert.rejects(readCompactZip(file), /CRC-32/u);
  });
});

test('accepts all 185 safe unique stored members and required representations', () => {
  assert.equal(originalArchive.entryCount, 185);
  assert.equal(originalArchive.memberMetadata.size, 185);
  assert.equal(
    [...originalArchive.memberMetadata.values()]
      .reduce((total, entry) => total + entry.uncompressed_size, 0),
    grade3ArtsArchive.uncompressed_size,
  );
  assert.ok(
    [...originalArchive.memberMetadata.values()]
      .every((entry) => entry.compression_method === 0),
  );
  assert.doesNotThrow(() => [...originalArchive.entries.keys()].forEach(assertSafeMemberName));
  assert.doesNotThrow(() => assertRequiredMembers(originalArchive.entries.keys()));
});

test('rejects a duplicate central-directory member name', async () => {
  await withTemporaryArchive(withDuplicateCentralMemberName(originalBytes), async (file) => {
    await assert.rejects(readCompactZip(file), /duplicate member name/u);
  });
});

test('rejects unsafe paths and missing required members', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/u);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/u);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/u);
  assert.throws(() => assertRequiredMembers(['index.json']), /missing required member/u);
});

test('recovers both non-ASCII source-book filenames reversibly', () => {
  for (const logicalName of [
    'raw/Opiq-DB/books/kunsti-_ja_tööõpetus._3._osa.json',
    'raw/Opiq-DB/books/kunsti-_ja_tööõpetus._4._osa._tähtpäeva\u00adkaardid.json',
  ]) {
    const metadata = originalArchive.memberMetadata.get(logicalName);
    const result = recoverLogicalZipMemberName(metadata, [
      'kunsti-_ja_tööõpetus._3._osa',
      'kunsti-_ja_tööõpetus._4._osa._tähtpäeva\u00adkaardid',
    ]);
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

test('audits exactly 180 recovered non-ASCII filenames without collisions', () => {
  const audit = auditGrade3ArtsZipMemberNames(originalArchive.memberMetadata);
  assert.equal(audit.member_count, 185);
  assert.equal(audit.utf8_flag_set, 0);
  assert.equal(audit.ascii_only_names, 5);
  assert.equal(audit.non_ascii_recoveries, 180);
  assert.equal(audit.decoded_name_collisions, 0);
});

test('rejects invalid filename bytes and decoded-name collisions', () => {
  assert.throws(
    () => recoverLogicalZipMemberName({
      stored_name_hex: 'ff',
      utf8_filename_flag: false,
    }),
    /not valid UTF-8/u,
  );
  assert.throws(
    () => assertUniqueLogicalMemberNames([
      { decoded_logical_name: 'same.json' },
      { decoded_logical_name: 'same.json' },
    ]),
    /collision/u,
  );
});

test('compact JSONL and Markdown agree', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(
    sourceRecords,
    parseGrade3Markdown(sourceMarkdown),
  ));
});

test('rejects a missing raw chapter representation', () => {
  const changedEntries = new Map(originalArchive.entries);
  const rawMember = [...changedEntries.keys()].find(
    (name) => name.startsWith('raw/Opiq-DB/chapters/'),
  );
  changedEntries.delete(rawMember);
  assert.throws(
    () => validateRawArtsChapters(
      sourceRecords,
      { ...originalArchive, entries: changedEntries },
      readZipText,
    ),
    /Raw chapter count/u,
  );
});

test('rejects mismatched compact Markdown', () => {
  assert.throws(
    () => assertCompactMarkdownMatches(
      sourceRecords,
      parseGrade3Markdown(sourceMarkdown.replace('Käsitöötuba – Opiq', 'Changed source')),
    ),
    /field title differs/u,
  );
});

test('accounts for all 178 rows without loss or double ownership', () => {
  assert.equal(catalog.canonical_records.length, 89);
  assert.equal(catalog.shared_supplementary_records.length, 85);
  assert.equal(catalog.exclusions.cover_details.length, 2);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 2);
  assert.equal(89 + 85 + 2 + 2, sourceRecords.length);
});

test('preserves exact source-book-plus-kit identities and canonical owners', () => {
  const variants = Object.values(grade3ArtsVariants);
  assert.equal(variants.length, 2);
  assert.deepEqual(
    variants.map((variant) => [
      variant.kit_id,
      variant.source_rows,
      variant.instructional_pages,
      variant.canonical_owner,
    ]),
    [
      ['196', 91, 89, 'grade-3-arts-and-crafts'],
      ['200', 87, 85, 'grade-2-arts-and-crafts'],
    ],
  );
});

test('normalizes only kit 196 into the canonical grade-3 route', () => {
  assert.ok(catalog.canonical_records.every(
    (record) => record.kit_id === '196'
      && record.book_id === 'kunsti-_ja_tööõpetus._3._osa__kit196'
      && record.source_book_id === 'kunsti-_ja_tööõpetus._3._osa'
      && record.grade === 3,
  ));
  assert.ok(
    catalog.shared_supplementary_records.every((record) => record.url.includes('/kit/200/')),
  );
});

test('normalizes the erroneous mathematics subject to arts and crafts', () => {
  assert.ok(sourceRecords.every(
    (record) => record.subject_en === 'mathematics'
      && record.subject_et === 'matemaatika'
      && record.subject_ru === 'математика',
  ));
  assert.ok(catalog.canonical_records.every(
    (record) => record.subject_en === grade3ArtsSubject.en
      && record.subject_et === grade3ArtsSubject.et
      && record.subject_ru === grade3ArtsSubject.ru,
  ));
  assert.ok(catalog.canonical_records.every(
    (record) => !record.topics_et.includes('matemaatika')
      && !record.topics_ru.includes('математика')
      && !record.topics_en.includes('mathematics'),
  ));
});

test('uses page-level Estonian evidence while preserving the raw-book anomaly in QA', () => {
  assert.ok(sourceRecords.every((record) => record.language === 'et'));
  assert.ok(catalog.canonical_records.every((record) => record.language === 'et'));
  assert.deepEqual(productionQa.language_normalization_audit.raw_book_language, { ru: 2 });
  assert.deepEqual(productionQa.language_normalization_audit.canonical_page_language, { et: 89 });
});

test('normalizes the soft hyphen only in the shared source identity', () => {
  const rawId = grade3ArtsVariants['kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid']
    .source_book_id;
  assert.ok(rawId.includes('\u00ad'));
  assert.equal(
    normalizeSourceBookId(rawId),
    'kunsti-_ja_tööõpetus._4._osa._tähtpäevakaardid',
  );
  assert.equal(productionQa.content_repair_audit.chapter_content_repairs, 0);
});

test('keeps all 174 instructional task arrays empty without invention', () => {
  assert.equal(rawValidation.audit.raw_empty_task_arrays, 178);
  assert.ok(sourceRecords.filter((record) => !/\/Kit\/Details\//u.test(record.url))
    .every((record) => record.task_examples.length === 0));
  assert.ok(catalog.canonical_records.every((record) => record.task_examples.length === 0));
  assert.equal(productionQa.source_instructional_records_without_tasks, 174);
});

test('accounts for all 491 raw image references', () => {
  assert.deepEqual(rawValidation.audit.images_by_kit, { 196: 364, 200: 127 });
  assert.equal(rawValidation.audit.raw_image_references, 491);
});

test('excludes only the two unique and two duplicate Kit Details records', () => {
  assert.deepEqual(
    catalog.duplicate_audit.map((entry) => [entry.kit_id, entry.chapter_ids]),
    [
      ['196', ['88', '178']],
      ['200', ['1', '87']],
    ],
  );
  assert.ok(catalog.exclusions.cover_details.every(
    (record) => record.url.startsWith('https://www.opiq.ee/Kit/Details/'),
  ));
});

test('retains equal titles at distinct chapter URLs', () => {
  assert.deepEqual(
    catalog.repeated_title_groups.map((entry) => entry.title),
    ['Liblikas', 'Pop-up-tehnikas kaart', 'Volditud lill'],
  );
  const butterflies = catalog.repeated_title_groups.find((entry) => entry.title === 'Liblikas');
  assert.deepEqual(butterflies.urls, [
    'https://www.opiq.ee/kit/196/chapter/11215',
    'https://www.opiq.ee/kit/196/chapter/11244',
  ]);
});

test('proves all stable kit 200 content is identical and grade 2 remains owner', () => {
  const comparison = compareKit200Captures(
    sourceRecords,
    grade2Records,
    rawValidation.raw_by_identity,
    grade2RawKit200,
    grade2Canonical,
  );
  assert.equal(comparison.compact_stable_field_matches, 85);
  assert.equal(comparison.raw_stable_field_matches, 85);
  assert.equal(comparison.raw_image_reference_hash_matches, 85);
  assert.equal(comparison.grade2_canonical_page_matches, 85);
  assert.equal(comparison.canonical_owner, 'grade-2-arts-and-crafts');
  assert.equal(comparison.cross_route_overlap_after_import, 0);
  assert.equal(comparison.lost_urls, 0);
});

test('rejects a changed compact field in the shared kit 200 capture', () => {
  const changed = clone(grade2Records);
  changed.find((record) => record.url === 'https://www.opiq.ee/kit/200/chapter/11374')
    .title = 'Changed';
  assert.throws(
    () => compareKit200Captures(
      sourceRecords,
      changed,
      rawValidation.raw_by_identity,
      grade2RawKit200,
      grade2Canonical,
    ),
    /compact content differs/u,
  );
});

test('rejects missing grade-2 ownership of the shared kit', () => {
  assert.throws(
    () => compareKit200Captures(
      sourceRecords,
      grade2Records,
      rawValidation.raw_by_identity,
      grade2RawKit200,
      grade2Canonical.filter((record) => !record.url.includes('/kit/200/')),
    ),
    /does not own all 85/u,
  );
});

test('renders 89 direct canonical URLs and Source Book IDs deterministically', () => {
  const rendered = renderGrade3ArtsMarkdown(catalog);
  assert.equal(
    [...rendered.matchAll(/^- URL: https:\/\/www\.opiq\.ee\/kit\/196\/chapter\/\d+$/gmu)].length,
    89,
  );
  assert.equal(
    [...rendered.matchAll(/^- Source Book ID: kunsti-_ja_tööõpetus\._3\._osa$/gmu)].length,
    89,
  );
  assert.equal(rendered, renderGrade3ArtsMarkdown(catalog));
});

test('rejects unknown kit, wrong subject, language, publisher, and invented task data', () => {
  const base = clone(catalog.canonical_records[0]);
  for (const [field, value, pattern] of [
    ['url', 'https://www.opiq.ee/kit/200/chapter/11212', /outside canonical kit 196/u],
    ['subject_en', 'mathematics', /canonical subject/u],
    ['language', 'ru', /canonical language/u],
    ['publisher', 'Invented Publisher', /not source-supported/u],
  ]) {
    const changed = clone(base);
    changed[field] = value;
    assert.throws(() => validateCanonicalGrade3ArtsRecord(changed), pattern);
  }
  const taskChanged = clone(base);
  taskChanged.task_examples = ['Invented step'];
  assert.throws(() => validateCanonicalGrade3ArtsRecord(taskChanged), /invented structured task/u);
});

test('rejects replacement, control, invisible, and unprocessed payload text', () => {
  for (const [value, pattern] of [
    ['bad\ufffd', /replacement/u],
    ['bad\u0001', /control/u],
    ['bad\u200b', /invisible/u],
    ['<div>raw payload</div>', /unprocessed/u],
  ]) {
    const changed = clone(catalog.canonical_records[0]);
    changed.title = value;
    assert.throws(() => validateCanonicalGrade3ArtsRecord(changed), pattern);
  }
});

test('content-quality audit classifies limitations without hard errors', () => {
  const quality = auditCanonicalContentQuality(catalog.canonical_records);
  assert.ok(Object.values(quality.hard_errors).every((count) => count === 0));
  assert.equal(quality.classified_warnings.missing_structured_task_examples.total, 89);
  assert.equal(quality.classified_warnings.missing_publishers.total, 89);
  assert.equal(quality.classified_warnings.repeated_titles.groups, 1);
});

test('rejects a duplicate canonical URL and an unknown source identity', () => {
  const duplicate = clone(sourceRecords);
  const firstInstructional = duplicate.find((record) => !/\/Kit\/Details\//u.test(record.url));
  const secondInstructional = duplicate.find(
    (record) => !/\/Kit\/Details\//u.test(record.url) && record.url !== firstInstructional.url,
  );
  secondInstructional.url = firstInstructional.url;
  assert.throws(() => buildGrade3ArtsCatalog(duplicate), /Duplicate URL group count/u);

  const unknown = clone(sourceRecords);
  unknown.find((record) => !/\/Kit\/Details\//u.test(record.url)).book_id = 'invented_source';
  assert.throws(() => buildGrade3ArtsCatalog(unknown), /Unknown grade-3 arts Source Book ID/u);
});

test('rejects an unexplained source row and a known book on an unknown kit', () => {
  const unexplained = clone(sourceRecords);
  unexplained.push(clone(
    sourceRecords.find((record) => !/\/Kit\/Details\//u.test(record.url)),
  ));
  assert.throws(() => buildGrade3ArtsCatalog(unexplained), /expected 178/u);

  const wrongKit = clone(sourceRecords);
  wrongKit.find((record) => !/\/Kit\/Details\//u.test(record.url))
    .url = 'https://www.opiq.ee/kit/999/chapter/11212';
  assert.throws(() => buildGrade3ArtsCatalog(wrongKit), /outside audited kit/u);
});

test('rejects title-based deduplication and Kit Details as canonical instruction', () => {
  const oneButterflyRemoved = sourceRecords.filter(
    (record) => record.url !== 'https://www.opiq.ee/kit/196/chapter/11244',
  );
  assert.throws(() => buildGrade3ArtsCatalog(oneButterflyRemoved), /expected 178/u);

  const detail = clone(catalog.canonical_records[0]);
  detail.url = 'https://www.opiq.ee/Kit/Details/196';
  assert.throws(() => validateCanonicalGrade3ArtsRecord(detail), /direct canonical/u);
});

test('validates the exact manifest route and rejects a broadened kit scope', () => {
  const source = manifest.sources.find((entry) => entry.id === 'grade-3-arts-and-crafts');
  assert.doesNotThrow(() => validateManifestGrade3ArtsSource(source));
  const broadened = clone(source);
  broadened.source_scope.included_kit_ids.push('200');
  assert.throws(
    () => validateManifestGrade3ArtsSource(broadened),
    /include only kit 196/u,
  );
});

test('rejects missing existing-owner declaration and subject boundary', () => {
  const source = manifest.sources.find((entry) => entry.id === 'grade-3-arts-and-crafts');
  const noOwner = clone(source);
  noOwner.source_scope.excluded_existing_owner_kits = [];
  assert.throws(() => validateManifestGrade3ArtsSource(noOwner), /existing-owner exclusion/u);

  const noBoundary = clone(source);
  noBoundary.subject_boundary.forbidden_book_ids = [];
  assert.throws(() => validateManifestGrade3ArtsSource(noBoundary), /boundary is missing/u);
});

test('rejects kit 200 ownership by both grades or by neither grade', () => {
  const source = manifest.sources.find((entry) => entry.id === 'grade-3-arts-and-crafts');
  const bothOwners = clone(source);
  bothOwners.source_scope.included_kit_ids = ['196', '200'];
  bothOwners.source_scope.excluded_existing_owner_kits = [];
  assert.throws(
    () => validateManifestGrade3ArtsSource(bothOwners),
    /include only kit 196/u,
  );

  assert.throws(
    () => compareKit200Captures(
      sourceRecords,
      grade2Records,
      rawValidation.raw_by_identity,
      grade2RawKit200,
      grade2Canonical.filter((record) => !record.url.includes('/kit/200/')),
    ),
    /does not own all 85/u,
  );
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same\n', 'same\n', 'fixture'));
  assert.throws(
    () => assertGeneratedArtifact('old\n', 'new\n', 'fixture'),
    /stale/u,
  );
});

test('production QA records the immutable archive, route accounting, and ownership', () => {
  assert.equal(productionQa.source_id, 'grade-3-arts-and-crafts');
  assert.equal(productionQa.source_records, 178);
  assert.equal(productionQa.page_records_included, 89);
  assert.equal(productionQa.archive.sha256, grade3ArtsArchive.sha256);
  assert.equal(productionQa.filename_encoding_audit.non_ascii_recoveries, 180);
  assert.equal(productionQa.canonical_ownership.kit_196, 'grade-3-arts-and-crafts');
  assert.equal(productionQa.canonical_ownership.kit_200, 'grade-2-arts-and-crafts');
  assert.equal(productionQa.canonical_url_audit.duplicate_count, 0);
  assert.equal(productionQa.content_repair_audit.chapter_content_repairs, 0);
});

test('production metadata, Markdown hash, and audit timestamp are deterministic', async () => {
  const markdown = renderGrade3ArtsMarkdown(catalog);
  assert.equal(productionQa.generation.generated_at, grade3ArtsArchive.capture_timestamp);
  assert.equal(
    productionQa.checksums.output_file_sha256,
    sha256Bytes(Buffer.from(markdown)),
  );
  assert.equal(
    JSON.stringify(productionQa),
    JSON.stringify(JSON.parse(JSON.stringify(productionQa))),
  );
  const audit = await readFile(
    'docs/audits/grade-3-arts-and-crafts-source-import.md',
    'utf8',
  );
  assert.match(audit, new RegExp(grade3ArtsArchive.capture_timestamp.replaceAll('.', '\\.'), 'u'));
  assert.match(audit, /89.*ordinary-curriculum pages/u);
});

test('every canonical record has a matching raw record and direct URL', () => {
  for (const record of catalog.canonical_records) {
    assert.ok(/^https:\/\/www\.opiq\.ee\/kit\/196\/chapter\/\d+$/u.test(record.url));
    const source = sourceRecords.find((entry) => (
      entry.url === record.url
      && normalizeSourceBookId(entry.book_id) === record.source_book_id
    ));
    assert.ok(source);
    assert.ok(rawValidation.raw_by_identity.has(sourceIdentity(source)));
  }
});
