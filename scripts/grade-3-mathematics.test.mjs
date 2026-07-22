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
  buildGrade3CanonicalCatalog,
  compareHistoricalCatalog,
  grade3MathematicsArchive,
  historicalGrade3MathematicsArchive,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3Markdown,
  sha256Bytes,
  validateCanonicalRecord,
  validateManifestGrade3Source,
} from './lib/grade-3-mathematics.mjs';

const originalPath = grade3MathematicsArchive.path;
const historicalPath = historicalGrade3MathematicsArchive.path;
const originalBytes = await readFile(originalPath);
const originalArchive = await readCompactZip(originalPath);
const sourceRecords = parseGrade3Jsonl(readZipText(originalArchive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(originalArchive, 'opiq_lookup.md');
const catalog = buildGrade3CanonicalCatalog(sourceRecords);
const historicalArchive = await readCompactZip(historicalPath);
const historicalRecords = parseGrade3Jsonl(readZipText(historicalArchive, 'opiq_lookup.jsonl'));
const clone = (value) => structuredClone(value);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const productionQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_matemaatika_qa.json', 'utf8'));

test('accepts the immutable original archive identity', () => {
  assert.doesNotThrow(() => assertArchiveIdentity(originalBytes));
  assert.equal(sha256Bytes(originalBytes), grade3MathematicsArchive.sha256);
});

test('rejects archive checksum or byte-size changes', () => {
  const changed = Buffer.from(originalBytes);
  changed[100] ^= 1;
  assert.throws(() => assertArchiveIdentity(changed), /checksum/);
  assert.throws(() => assertArchiveIdentity(changed.subarray(0, -1)), /byte size/);
});

test('rejects a corrupt ZIP through the shared safe reader', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-'));
  const file = path.join(directory, 'broken.zip');
  try {
    await writeFile(file, originalBytes.subarray(0, 256));
    await assert.rejects(readCompactZip(file), /end-of-central-directory/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('rejects unsafe ZIP member paths', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/);
});

test('requires every original representation', () => {
  assert.doesNotThrow(() => assertRequiredMembers(originalArchive.entries.keys()));
  assert.throws(() => assertRequiredMembers(['index.json']), /missing required member/);
});

test('accepts matching compact JSONL and Markdown representations', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(sourceMarkdown)));
});

test('rejects mismatched compact representations', () => {
  const markdown = sourceMarkdown.replace('## Matemaatika 3. klassile – Opiq', '## Wrong title');
  assert.throws(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(markdown)), /field title differs/);
});

test('accounts for all source rows and excludes non-instructional records', () => {
  assert.equal(catalog.canonical_records.length, 619);
  assert.equal(catalog.exclusions.cover_details.length, 9);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 9);
  assert.equal(catalog.exclusions.administrative.length, 6);
  assert.equal(619 + 9 + 9 + 6, sourceRecords.length);
});

test('represents all nine ordinary and simplified book-kit variants', () => {
  assert.equal(new Set(catalog.canonical_records.map((record) => record.book_id)).size, 9);
  assert.deepEqual(new Set(catalog.canonical_records.map((record) => record.programme_type)), new Set(['ordinary_curriculum', 'simplified_curriculum']));
});

test('rejects an unknown source book or kit', () => {
  const unknownBook = clone(sourceRecords);
  unknownBook.find((record) => record.url.includes('/chapter/')).book_id = 'unknown-book';
  assert.throws(() => buildGrade3CanonicalCatalog(unknownBook), /Unknown grade-3 mathematics Source Book ID/);
  const wrongKit = clone(sourceRecords);
  wrongKit.find((record) => record.url.includes('/kit/54/chapter/')).url = 'https://www.opiq.ee/kit/999/chapter/2658';
  assert.throws(() => buildGrade3CanonicalCatalog(wrongKit), /outside the audited kit/);
});

test('rejects conflicting same-URL source rows', () => {
  const changed = clone(sourceRecords);
  const duplicate = changed.filter((record) => record.url === 'https://www.opiq.ee/Kit/Details/54')[1];
  duplicate.title = 'Conflicting title';
  assert.throws(() => buildGrade3CanonicalCatalog(changed), /conflict in fields|differ in fields/);
});

test('rejects duplicate instructional canonical URLs', () => {
  const changed = clone(sourceRecords);
  const instructional = changed.filter((record) => /\/chapter\//u.test(record.url));
  instructional[1].url = instructional[0].url;
  assert.throws(() => buildGrade3CanonicalCatalog(changed), /duplicate URL groups|Kit Details/);
});

test('rejects a changed source-grade anomaly', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).grade = 3;
  assert.throws(() => buildGrade3CanonicalCatalog(changed), /raw grade/);
});

test('rejects unjustified subject normalization', () => {
  const changed = clone(sourceRecords);
  const record = changed.find((candidate) => candidate.url === 'https://www.opiq.ee/kit/54/chapter/2658');
  [record.subject_en, record.subject_et, record.subject_ru] = ['science', 'loodusõpetus', 'природоведение'];
  assert.throws(() => buildGrade3CanonicalCatalog(changed), /unaudited non-mathematics/);
});

test('keeps two audited environmental-context pages in mathematics', () => {
  const records = catalog.canonical_records.filter((record) => ['https://www.opiq.ee/kit/531/chapter/29334', 'https://www.opiq.ee/kit/54/chapter/2701'].includes(record.url));
  assert.equal(records.length, 2);
  assert.ok(records.every((record) => record.subject_en === 'mathematics'));
  assert.ok(records.every((record) => record.topics_et.includes('loodust') && record.topics_et.includes('loodushoiu')));
});

test('rejects unjustified language normalization', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => record.url === 'https://www.opiq.ee/kit/54/chapter/2658').language = 'en';
  assert.throws(() => buildGrade3CanonicalCatalog(changed), /source language en conflicts/);
});

test('normalizes only the five audited Estonian pages labelled English', () => {
  const normalized = catalog.canonical_records.filter((record) => ['2659', '2674', '27314', '29291', '29307'].some((chapter) => record.url.endsWith(`/chapter/${chapter}`)));
  assert.equal(normalized.length, 5);
  assert.ok(normalized.every((record) => record.language === 'et'));
});

test('rejects simplified material labelled as ordinary', () => {
  const record = clone(catalog.canonical_records.find((candidate) => candidate.programme_type === 'simplified_curriculum'));
  record.programme_type = 'ordinary_curriculum';
  assert.throws(() => validateCanonicalRecord(record), /programme type differs/);
});

test('rejects unprocessed payload and replacement/control characters', () => {
  const payload = clone(catalog.canonical_records[0]);
  payload.task_examples = ['<math>1</math>'];
  assert.throws(() => validateCanonicalRecord(payload), /unprocessed JSON\/HTML payload/);
  const replacement = clone(catalog.canonical_records[0]);
  replacement.title += '\ufffd';
  assert.throws(() => validateCanonicalRecord(replacement), /replacement character/);
  const control = clone(catalog.canonical_records[0]);
  control.title += '\u0000';
  assert.throws(() => validateCanonicalRecord(control), /control character/);
});

test('renders deterministic canonical Markdown and retains stronger tasks', () => {
  assert.equal(renderGrade3Markdown(catalog), renderGrade3Markdown(buildGrade3CanonicalCatalog(sourceRecords)));
  const comparison = compareHistoricalCatalog(historicalRecords, sourceRecords, catalog.canonical_records);
  assert.ok((comparison.semantic_difference_summary.classification_counts.richer_original_evidence ?? 0) > 0);
  assert.equal(comparison.semantic_difference_summary.unexplained_differences, 0);
});

test('rejects unexplained historical title differences', () => {
  const changed = clone(historicalRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).title = 'Unexplained title';
  assert.throws(() => compareHistoricalCatalog(changed, sourceRecords, catalog.canonical_records), /Unexplained title difference/);
});

test('rejects derived compact manifest provenance', () => {
  const valid = {
    id: 'grade-3-mathematics',
    source_archive: grade3MathematicsArchive.path,
    record_count: 619,
    languages: ['et', 'ru'],
  };
  assert.doesNotThrow(() => validateManifestGrade3Source(valid));
  assert.throws(() => validateManifestGrade3Source({ ...valid, source_provenance: { kind: 'derived_compact_snapshot' } }), /derived compact provenance/);
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('canonical URLs are direct, unique, and exclude detail and Impressum pages', () => {
  const urls = catalog.canonical_records.map((record) => record.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => /^https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+$/u.test(url)));
  assert.ok(urls.every((url) => !url.includes('/Kit/Details/')));
  assert.ok(catalog.canonical_records.every((record) => !/^impressum|импрессум$/iu.test(record.title)));
});

test('production QA is deterministic and reports zero content hard errors', async () => {
  const markdown = await readFile('project-files/outputs/opiq_3klass_matemaatika.md');
  assert.equal(productionQa.generation.generated_at, grade3MathematicsArchive.capture_timestamp);
  assert.equal(productionQa.checksums.output_file_sha256, sha256Bytes(markdown));
  assert.ok(Object.values(productionQa.content_quality_audit.hard_errors).every((count) => count === 0));
  assert.equal(productionQa.historical_comparison.semantic_difference_summary.unexplained_differences, 0);
});

test('grade-3 mathematics canonical URLs do not overlap any other manifest route', async () => {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  for (const route of manifest.sources.filter((source) => source.id !== 'grade-3-mathematics')) {
    const markdown = await readFile(route.md_path, 'utf8');
    const routeUrls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)].map((match) => match[1]);
    assert.ok(routeUrls.every((url) => !targetUrls.has(url)), `canonical URL overlaps route ${route.id}`);
  }
});
