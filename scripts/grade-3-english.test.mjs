import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertArchiveIdentity,
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertRequiredMembers,
  assertSafeMemberName,
  auditCanonicalContentQuality,
  auditZipMemberNames,
  buildCatalog,
  grade3EnglishArchive,
  grade3EnglishVariants,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderMarkdown,
  sha256Bytes,
  validateCanonicalRecord,
  validateManifestSource,
  validateRawChapters,
} from './lib/grade-3-english.mjs';

const archiveBytes = await readFile(grade3EnglishArchive.path);
const archive = await readCompactZip(grade3EnglishArchive.path);
const sourceJsonl = readZipText(archive, 'opiq_lookup.jsonl');
const sourceMarkdown = readZipText(archive, 'opiq_lookup.md');
const sourceRecords = parseGrade3Jsonl(sourceJsonl);
const rawValidation = validateRawChapters(sourceRecords, archive, readZipText);
const catalog = buildCatalog(sourceRecords);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const route = manifest.sources.find((source) => source.id === 'grade-3-english');
const productionQa = JSON.parse(
  await readFile('project-files/outputs/opiq_3klass_inglise_keel_qa.json', 'utf8').catch(() => '{}'),
);
const clone = (value) => structuredClone(value);

async function withTemporaryArchive(bytes, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-english-'));
  const file = path.join(directory, 'fixture.zip');
  try {
    await writeFile(file, bytes);
    await callback(file);
  } finally {
    await rm(directory, { recursive: true });
  }
}

test('accepts the immutable archive checksum and size', () => {
  assert.doesNotThrow(() => assertArchiveIdentity(archiveBytes));
  assert.equal(sha256Bytes(archiveBytes), grade3EnglishArchive.sha256);
  assert.equal(archiveBytes.length, 1_935_103);
});

test('rejects changed archive bytes and size', () => {
  const changed = Buffer.from(archiveBytes);
  changed[100] ^= 1;
  assert.throws(() => assertArchiveIdentity(changed), /checksum/u);
  assert.throws(() => assertArchiveIdentity(changed.subarray(0, -1)), /byte size/u);
});

test('rejects a corrupt ZIP and invalid CRC', async () => {
  await withTemporaryArchive(archiveBytes.subarray(0, 256), async (file) => {
    await assert.rejects(readCompactZip(file), /end-of-central-directory/u);
  });
  const changed = Buffer.from(archiveBytes);
  const offset = changed.indexOf(Buffer.from('"formatVersion": "2.0"'));
  assert.ok(offset > 0);
  changed[offset + 2] ^= 1;
  await withTemporaryArchive(changed, async (file) => {
    await assert.rejects(readCompactZip(file), /CRC-32/u);
  });
});

test('accounts for all stored archive members and representations', () => {
  assert.equal(archive.entryCount, 204);
  assert.equal(
    [...archive.memberMetadata.values()].reduce((total, entry) => total + entry.uncompressed_size, 0),
    1_898_081,
  );
  assert.ok([...archive.memberMetadata.values()].every((entry) => entry.compression_method === 0));
  assert.doesNotThrow(() => [...archive.entries.keys()].forEach(assertSafeMemberName));
  assert.doesNotThrow(() => assertRequiredMembers(archive.entries.keys()));
});

test('rejects unsafe paths and missing members', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/u);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/u);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/u);
  assert.throws(() => assertRequiredMembers(['index.json']), /missing required member/u);
});

test('audits 204 ASCII stored member names with no UTF-8 flags', () => {
  assert.deepEqual(auditZipMemberNames(archive.memberMetadata), {
    member_count: 204,
    ascii_only_names: 204,
    utf8_flag_set: 0,
    utf8_flag_absent: 204,
    stored_name_collisions: 0,
  });
});

test('rejects non-ASCII and duplicate stored member metadata', () => {
  const changed = new Map(archive.memberMetadata);
  const [name, first] = changed.entries().next().value;
  changed.set(name, { ...first, stored_name_hex: 'ff' });
  assert.throws(() => auditZipMemberNames(changed), /not ASCII/u);
  const duplicate = new Map(archive.memberMetadata);
  const entries = [...duplicate.entries()];
  duplicate.set(entries[1][0], { ...entries[1][1], stored_name_hex: entries[0][1].stored_name_hex });
  assert.throws(() => auditZipMemberNames(duplicate), /not unique/u);
});

test('compact JSONL and Markdown agree exactly', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(
    sourceRecords,
    parseGrade3Markdown(sourceMarkdown),
  ));
});

test('rejects malformed compact JSONL and mismatched Markdown', () => {
  assert.throws(() => parseGrade3Jsonl('{bad'), /invalid JSON/u);
  assert.throws(
    () => assertCompactMarkdownMatches(
      sourceRecords,
      parseGrade3Markdown(sourceMarkdown.replace('LESSON ONE', 'Changed lesson')),
    ),
    /field title differs/u,
  );
});

test('reconciles all 197 compact and raw chapters', () => {
  assert.equal(rawValidation.raw_by_identity.size, 197);
  assert.deepEqual(rawValidation.audit.headings_by_kit, { 369: 4066, 452: 1780 });
  assert.deepEqual(rawValidation.audit.images_by_kit, { 369: 3731, 452: 289 });
  assert.equal(rawValidation.audit.raw_task_rows, 0);
});

test('rejects a missing raw chapter', () => {
  const entries = new Map(archive.entries);
  entries.delete([...entries.keys()].find((name) => name.startsWith('raw/Opiq-DB/chapters/')));
  assert.throws(
    () => validateRawChapters(sourceRecords, { ...archive, entries }, readZipText),
    /Raw chapter count/u,
  );
});

test('accounts for 197 source rows as 193 pages and four details rows', () => {
  assert.equal(catalog.canonical_records.length, 193);
  assert.equal(catalog.cover_detail_records.length, 4);
  assert.equal(catalog.canonical_records.length + catalog.cover_detail_records.length, 197);
});

test('excludes both duplicate details pairs and no instructional URL', () => {
  assert.deepEqual(
    catalog.duplicate_url_audit.map((entry) => [entry.kit_id, entry.chapter_ids]),
    [['369', ['1', '106']], ['452', ['107', '197']]],
  );
  assert.ok(catalog.cover_detail_records.every((record) => record.url.includes('/Kit/Details/')));
  assert.ok(catalog.canonical_records.every((record) => record.url.includes('/chapter/')));
});

test('rejects an unexplained duplicate instructional URL', () => {
  const changed = clone(sourceRecords);
  const page = changed.find((record) => record.url.includes('/chapter/'));
  changed.push({ ...page, chapter_id: 'duplicate-fixture' });
  assert.throws(() => buildCatalog(changed), /Source row count/u);
});

test('preserves two source-book-plus-kit identities', () => {
  assert.deepEqual(
    Object.values(grade3EnglishVariants).map((variant) => [
      variant.source_book_id,
      variant.kit_id,
      variant.source_rows,
      variant.instructional_pages,
    ]),
    [
      ['english_step_by_step_1', '452', 91, 89],
      ['inglise_keel_3._klassile', '369', 106, 104],
    ],
  );
});

test('normalizes the subject without changing direct source content', () => {
  const source = sourceRecords.find((record) => record.url === 'https://www.opiq.ee/kit/452/chapter/24569');
  const canonical = catalog.canonical_records.find((record) => record.url === source.url);
  assert.equal(canonical.subject_en, 'english');
  assert.equal(canonical.subject_et, 'inglise keel');
  assert.equal(canonical.subject_ru, 'английский язык');
  assert.equal(canonical.title, source.title);
  assert.deepEqual(canonical.headings, source.headings);
  assert.deepEqual(canonical.task_examples, source.task_examples);
  assert.ok(!canonical.topics_en.includes('mathematics'));
});

test('preserves exact page-language partition', () => {
  const counts = Object.groupBy
    ? Object.fromEntries(Object.entries(Object.groupBy(catalog.canonical_records, (record) => record.language)).map(([key, rows]) => [key, rows.length]))
    : catalog.canonical_records.reduce((result, record) => ({ ...result, [record.language]: (result[record.language] ?? 0) + 1 }), {});
  assert.deepEqual(counts, { en: 122, et: 67, ru: 4 });
});

test('keeps raw ru-labelled pages rather than guessing a language', () => {
  const page = catalog.canonical_records.find((record) => record.url === 'https://www.opiq.ee/kit/369/chapter/20209');
  assert.equal(page.language, 'ru');
  assert.equal(page.title, 'Module 1 Review');
});

test('keeps publisher blank and programme type unknown', () => {
  assert.ok(catalog.canonical_records.every(
    (record) => record.publisher === '' && record.programme_type === 'unknown',
  ));
});

test('rejects guessed publishers, programmes, and page languages', () => {
  for (const [field, value, pattern] of [
    ['publisher', 'Invented Publisher', /publisher/u],
    ['programme_type', 'ordinary_curriculum', /programme type/u],
    ['language', 'de', /unsupported page language/u],
  ]) {
    const changed = clone(catalog.canonical_records[0]);
    changed[field] = value;
    assert.throws(() => validateCanonicalRecord(changed), pattern);
  }
});

test('retains repeated titles as distinct URLs', () => {
  assert.deepEqual(
    catalog.repeated_title_groups.map((entry) => [entry.title, entry.urls.length]),
    [['Definitions', 2], ['Let’s Practise!', 16]],
  );
  assert.equal(new Set(catalog.canonical_records.map((record) => record.url)).size, 193);
});

test('rejects malformed URLs, grades, subjects, and identities', () => {
  for (const mutate of [
    (record) => { record.url = 'https://example.com/page'; },
    (record) => { record.grade = 2; },
    (record) => { record.subject_en = 'mathematics'; },
    (record) => { record.book_id = 'wrong'; },
    (record) => { record.source_book_id = 'wrong'; },
  ]) {
    const changed = clone(catalog.canonical_records[0]);
    mutate(changed);
    assert.throws(() => validateCanonicalRecord(changed));
  }
});

test('rejects empty title/headings and invented tasks', () => {
  for (const [field, value] of [
    ['title', ''],
    ['headings', []],
    ['task_examples', ['invented']],
  ]) {
    const changed = clone(catalog.canonical_records[0]);
    changed[field] = value;
    assert.throws(() => validateCanonicalRecord(changed));
  }
});

test('rejects replacement, control, invisible, and payload corruption', () => {
  for (const value of ['bad\ufffd', 'bad\u0000', 'bad\u00ad', '<div>bad</div>']) {
    const changed = clone(catalog.canonical_records[0]);
    changed.title = value;
    assert.throws(() => validateCanonicalRecord(changed));
  }
});

test('canonical content quality has zero hard errors and classified limitations', () => {
  const audit = auditCanonicalContentQuality(catalog.canonical_records);
  assert.ok(Object.values(audit.hard_errors).every((count) => count === 0));
  assert.equal(audit.classified_warnings.empty_task_examples.records, 193);
  assert.equal(audit.classified_warnings.missing_publisher.records, 193);
  assert.equal(audit.classified_warnings.programme_type_unknown.records, 193);
});

test('renders deterministic Markdown with 193 parseable records', () => {
  const first = renderMarkdown(catalog);
  const second = renderMarkdown(buildCatalog(parseGrade3Jsonl(sourceJsonl)));
  assert.equal(first, second);
  assert.equal(parseGrade3Markdown(first).length, 193);
  assert.match(first, /Programme type: unknown/u);
});

test('manifest route encodes exact source scope and boundaries', () => {
  assert.doesNotThrow(() => validateManifestSource(route));
  assert.deepEqual(route.languages, ['en', 'et', 'ru']);
  assert.deepEqual(route.source_scope.included_kit_ids, ['369', '452']);
  assert.equal(route.source_scope.programme_type, 'unknown');
  assert.ok(route.subject_boundary.forbidden_book_ids.includes('matemaatika_3._klassile__kit54'));
});

test('rejects a manifest route with wrong path, count, kit, or programme', () => {
  for (const mutate of [
    (source) => { source.md_path = 'wrong.md'; },
    (source) => { source.record_count = 192; },
    (source) => { source.source_scope.included_kit_ids = ['452']; },
    (source) => { source.source_scope.programme_type = 'ordinary_curriculum'; },
  ]) {
    const changed = clone(route);
    mutate(changed);
    assert.throws(() => validateManifestSource(changed));
  }
});

test('production QA records the exact archive and page counts', { skip: Object.keys(productionQa).length === 0 }, () => {
  assert.equal(productionQa.checksums.source_archive_sha256, grade3EnglishArchive.sha256);
  assert.equal(productionQa.source_records, 197);
  assert.equal(productionQa.page_records_included, 193);
  assert.deepEqual(productionQa.languages, { en: 122, et: 67, ru: 4 });
});

test('generated Markdown and QA are current', { skip: Object.keys(productionQa).length === 0 }, async () => {
  const markdown = await readFile(route.md_path, 'utf8');
  assert.equal(sha256Bytes(Buffer.from(markdown)), productionQa.checksums.output_file_sha256);
  assert.doesNotThrow(() => assertGeneratedArtifact(markdown, renderMarkdown(catalog), route.md_path));
  assert.throws(() => assertGeneratedArtifact(`${markdown}\n`, renderMarkdown(catalog), route.md_path), /stale/u);
});

test('canonical URLs are absent from every other manifest route', async () => {
  const urls = new Set(catalog.canonical_records.map((record) => record.url));
  let overlaps = 0;
  for (const source of manifest.sources) {
    if (source.id === 'grade-3-english') continue;
    const markdown = await readFile(source.md_path, 'utf8');
    for (const match of markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)) {
      if (urls.has(match[1])) overlaps += 1;
    }
  }
  assert.equal(overlaps, 0);
});

test('English URLs are absent from grade-3 mathematics and adjacent-grade routes', async () => {
  for (const routeId of ['grade-3-mathematics', 'grade-3-estonian', 'grade-3-russian', 'grade-2-mathematics']) {
    const other = manifest.sources.find((source) => source.id === routeId);
    const markdown = await readFile(other.md_path, 'utf8');
    assert.doesNotMatch(markdown, /https:\/\/www\.opiq\.ee\/kit\/(?:369|452)\/chapter\//u);
  }
});

test('source ZIP remains byte-for-byte identical during generation checks', async () => {
  const after = await readFile(grade3EnglishArchive.path);
  assert.deepEqual(after, archiveBytes);
  assert.equal(sha256Bytes(after), grade3EnglishArchive.sha256);
});
