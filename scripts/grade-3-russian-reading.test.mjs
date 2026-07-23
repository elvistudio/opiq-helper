import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3RussianReadingArchiveIdentity,
  assertRequiredMembers,
  assertSafeMemberName,
  buildGrade3RussianReadingCatalog,
  grade3RussianReadingArchive,
  grade3RussianReadingSubject,
  grade3RussianReadingVariant,
  isKitDetail,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3RussianReadingMarkdown,
  sha256Bytes,
  validateCanonicalGrade3RussianReadingRecord,
  validateManifestGrade3RussianReadingSource,
} from './lib/grade-3-russian-reading.mjs';

const originalBytes = await readFile(grade3RussianReadingArchive.path);
const originalArchive = await readCompactZip(grade3RussianReadingArchive.path);
const sourceRecords = parseGrade3Jsonl(readZipText(originalArchive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(originalArchive, 'opiq_lookup.md');
const catalog = buildGrade3RussianReadingCatalog(sourceRecords);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const productionQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_vene_lugemine_qa.json', 'utf8'));
const clone = (value) => structuredClone(value);

test('accepts the immutable original archive identity', () => {
  assert.doesNotThrow(() => assertGrade3RussianReadingArchiveIdentity(originalBytes));
  assert.equal(sha256Bytes(originalBytes), grade3RussianReadingArchive.sha256);
  assert.equal(originalBytes.length, grade3RussianReadingArchive.byte_size);
});

test('rejects changed archive checksum and byte size', () => {
  const changed = Buffer.from(originalBytes);
  changed[100] ^= 1;
  assert.throws(() => assertGrade3RussianReadingArchiveIdentity(changed), /checksum/);
  assert.throws(() => assertGrade3RussianReadingArchiveIdentity(changed.subarray(0, -1)), /byte size/);
});

test('rejects a corrupt ZIP through the shared reader', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-reading-'));
  const file = path.join(directory, 'broken.zip');
  try {
    await writeFile(file, originalBytes.subarray(0, 256));
    await assert.rejects(readCompactZip(file), /end-of-central-directory/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('accepts safe unique ZIP members and required representations', () => {
  assert.equal(originalArchive.entryCount, 63);
  assert.doesNotThrow(() => [...originalArchive.entries.keys()].forEach(assertSafeMemberName));
  assert.doesNotThrow(() => assertRequiredMembers(originalArchive.entries.keys()));
});

test('rejects unsafe ZIP member paths', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/);
});

test('rejects a missing required archive member', () => {
  assert.throws(() => assertRequiredMembers(['index.json']), /missing required member/);
});

test('compact JSONL and Markdown representations agree', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(
    sourceRecords,
    parseGrade3Markdown(sourceMarkdown),
  ));
});

test('rejects mismatched compact representations', () => {
  const changed = sourceMarkdown.replace(
    '## ИВАН БУНИН. Листопад',
    '## Changed title',
  );
  assert.throws(
    () => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(changed)),
    /field title differs/,
  );
});

test('accounts for every source row exactly once', () => {
  assert.equal(sourceRecords.length, 57);
  assert.equal(catalog.canonical_records.length, 55);
  assert.equal(catalog.exclusions.cover_details.length, 1);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 1);
  assert.equal(catalog.exclusions.administrative.length, 0);
  assert.equal(catalog.exclusions.search_results.length, 0);
  assert.equal(55 + 1 + 1, 57);
});

test('represents one source-book-plus-kit variant', () => {
  assert.equal(grade3RussianReadingVariant.kit_id, '504');
  assert.equal(grade3RussianReadingVariant.canonical_records, 55);
  assert.deepEqual(
    new Set(catalog.canonical_records.map((record) => record.book_id)),
    new Set([grade3RussianReadingVariant.canonical_book_id]),
  );
});

test('normalizes the automatic mathematics subject to Russian reading', () => {
  assert.ok(sourceRecords.every((record) => record.subject_en === 'mathematics'));
  assert.ok(catalog.canonical_records.every(
    (record) => record.subject_en === grade3RussianReadingSubject.en
      && record.subject_et === grade3RussianReadingSubject.et
      && record.subject_ru === grade3RussianReadingSubject.ru,
  ));
  assert.ok(catalog.canonical_records.every(
    (record) => !record.topics_en.includes('mathematics')
      && !record.topics_et.includes('matemaatika')
      && !record.topics_ru.includes('математика'),
  ));
});

test('repairs the mixed-script book title while preserving Source Book ID', () => {
  assert.match(grade3RussianReadingVariant.raw_title, /клacca/u);
  assert.equal(grade3RussianReadingVariant.canonical_title, 'РУССКОЕ СЛОВО. Чтение для 3 класса');
  assert.ok(catalog.canonical_records.every(
    (record) => record.book === grade3RussianReadingVariant.canonical_title
      && record.source_book_id === grade3RussianReadingVariant.source_book_id,
  ));
});

test('removes the audited zero-width heading character', () => {
  const source = sourceRecords.find((record) => record.url.endsWith('/27675'));
  const canonical = catalog.canonical_records.find((record) => record.url === source.url);
  assert.match(source.headings.join('\n'), /\u200b/u);
  assert.doesNotMatch(canonical.headings.join('\n'), /\u200b/u);
});

test('excludes both Kit Details rows', () => {
  assert.ok(catalog.exclusions.cover_details.every(isKitDetail));
  assert.ok(catalog.exclusions.duplicate_aliases.every(isKitDetail));
  assert.ok(catalog.canonical_records.every((record) => !record.url.includes('/Kit/Details/')));
});

test('preserves missing structured task examples without invention', () => {
  assert.ok(sourceRecords.filter((record) => !isKitDetail(record)).every(
    (record) => record.task_examples.length === 0,
  ));
  assert.ok(catalog.canonical_records.every((record) => record.task_examples.length === 0));
});

test('rejects an unknown source book', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).book_id = 'unknown';
  assert.throws(
    () => buildGrade3RussianReadingCatalog(changed),
    /Unknown grade-3 Russian-reading Source Book ID/,
  );
});

test('rejects a wrong kit', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).url = 'https://www.opiq.ee/kit/999/chapter/27658';
  assert.throws(() => buildGrade3RussianReadingCatalog(changed), /outside audited kit 504/);
});

test('rejects a wrong source grade', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).grade = 2;
  assert.throws(() => buildGrade3RussianReadingCatalog(changed), /raw grade must be 3/);
});

test('rejects an unaudited source subject', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).subject_en = 'Russian reading';
  assert.throws(() => buildGrade3RussianReadingCatalog(changed), /raw subject differs/);
});

test('rejects an unjustified language normalization', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).language = 'et';
  assert.throws(() => buildGrade3RussianReadingCatalog(changed), /source language must be ru/);
});

test('rejects an invented publisher', () => {
  const record = clone(catalog.canonical_records[0]);
  record.publisher = 'Invented';
  assert.throws(
    () => validateCanonicalGrade3RussianReadingRecord(record),
    /publisher is not source-supported/,
  );
});

test('rejects a conflicting duplicate instructional URL', () => {
  const changed = clone(sourceRecords);
  const instructional = changed.filter((record) => /\/chapter\//u.test(record.url));
  instructional[1].url = instructional[0].url;
  assert.throws(
    () => buildGrade3RussianReadingCatalog(changed),
    /duplicate URL groups|not limited to Kit Details/,
  );
});

test('rejects an unprocessed payload and replacement/control characters', () => {
  const payload = clone(catalog.canonical_records[0]);
  payload.headings = ['<math>1</math>'];
  assert.throws(
    () => validateCanonicalGrade3RussianReadingRecord(payload),
    /unprocessed JSON\/HTML payload/,
  );
  const replacement = clone(catalog.canonical_records[0]);
  replacement.title += '\ufffd';
  assert.throws(
    () => validateCanonicalGrade3RussianReadingRecord(replacement),
    /replacement character/,
  );
  const control = clone(catalog.canonical_records[0]);
  control.title += '\u0000';
  assert.throws(
    () => validateCanonicalGrade3RussianReadingRecord(control),
    /control character/,
  );
});

test('rejects a canonical mathematics or Russian-language subject', () => {
  for (const subject of [
    ['mathematics', 'matemaatika', 'математика'],
    ['Russian language', 'vene keel', 'русский язык'],
  ]) {
    const record = clone(catalog.canonical_records[0]);
    [record.subject_en, record.subject_et, record.subject_ru] = subject;
    assert.throws(
      () => validateCanonicalGrade3RussianReadingRecord(record),
      /canonical subject must be Russian reading/,
    );
  }
});

test('renders deterministic canonical Markdown', () => {
  assert.equal(
    renderGrade3RussianReadingMarkdown(catalog),
    renderGrade3RussianReadingMarkdown(buildGrade3RussianReadingCatalog(sourceRecords)),
  );
});

test('validates the exact manifest route and kit scope', () => {
  const route = manifest.sources.find((source) => source.id === 'grade-3-russian-reading');
  assert.doesNotThrow(() => validateManifestGrade3RussianReadingSource(route));
  assert.throws(
    () => validateManifestGrade3RussianReadingSource({ ...route, subject: 'russian' }),
    /Manifest subject differs/,
  );
  assert.throws(
    () => validateManifestGrade3RussianReadingSource({
      ...route,
      source_scope: { ...route.source_scope, included_kit_ids: ['503'] },
    }),
    /kit 504 only/,
  );
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('canonical URLs are direct, unique, and owned by exactly one route', async () => {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  assert.equal(targetUrls.size, 55);
  assert.ok([...targetUrls].every(
    (url) => /^https:\/\/www\.opiq\.ee\/kit\/504\/chapter\/\d+$/u.test(url),
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
      assert.equal(route.id, 'grade-3-russian-reading');
      assert.equal(overlap.length, 55);
    }
  }
  assert.equal(owners, 1);
});

test('production QA is deterministic and records zero hard errors', async () => {
  const markdown = await readFile('project-files/outputs/opiq_3klass_vene_lugemine.md');
  assert.equal(productionQa.generation.generated_at, grade3RussianReadingArchive.capture_timestamp);
  assert.equal(productionQa.checksums.output_file_sha256, sha256Bytes(markdown));
  assert.equal(productionQa.source_records, 57);
  assert.equal(productionQa.page_records_included, 55);
  assert.equal(productionQa.canonical_url_audit.final_owner, 'grade-3-russian-reading');
  assert.ok(Object.values(productionQa.content_quality_audit.hard_errors).every(
    (count) => count === 0,
  ));
});
