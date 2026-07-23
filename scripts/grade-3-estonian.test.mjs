import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  parseGrade3Jsonl,
  parseGrade3Markdown,
} from './lib/grade-3-mathematics.mjs';
import {
  assertGeneratedArtifact,
  assertGrade3EstonianArchiveIdentity,
  assertRequiredGrade3EstonianMembers,
  assertSafeMemberName,
  buildGrade3EstonianCatalog,
  grade3EstonianArchive,
  grade3EstonianRoutes,
  renderGrade3EstonianMarkdown,
  sha256Bytes,
  validateGrade3EstonianCanonicalRecord,
  validateManifestGrade3EstonianRoutes,
} from './lib/grade-3-estonian.mjs';

const archiveBytes = await readFile(grade3EstonianArchive.path);
const archive = await readCompactZip(grade3EstonianArchive.path);
const sourceRecords = parseGrade3Jsonl(readZipText(archive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(archive, 'opiq_lookup.md');
const catalog = buildGrade3EstonianCatalog(sourceRecords);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const firstQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_eesti_keel_qa.json', 'utf8'));
const secondQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_eesti_keel_teise_keelena_qa.json', 'utf8'));
const clone = (value) => structuredClone(value);

test('accepts the immutable original archive identity', () => {
  assert.doesNotThrow(() => assertGrade3EstonianArchiveIdentity(archiveBytes));
  assert.equal(sha256Bytes(archiveBytes), grade3EstonianArchive.sha256);
  assert.equal(archive.entryCount, 435);
});

test('rejects archive checksum and byte-size changes', () => {
  const changed = Buffer.from(archiveBytes);
  changed[100] ^= 1;
  assert.throws(() => assertGrade3EstonianArchiveIdentity(changed), /checksum/);
  assert.throws(() => assertGrade3EstonianArchiveIdentity(changed.subarray(0, -1)), /byte size/);
});

test('rejects a corrupt ZIP through the shared safe reader', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-estonian-'));
  const file = path.join(directory, 'broken.zip');
  try {
    await writeFile(file, archiveBytes.subarray(0, 256));
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
  assert.doesNotThrow(() => assertRequiredGrade3EstonianMembers(archive.entries.keys()));
  assert.throws(() => assertRequiredGrade3EstonianMembers(['index.json']), /missing required member/);
});

test('accepts matching compact JSONL and Markdown representations', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(sourceMarkdown)));
});

test('rejects mismatched compact representations', () => {
  const changed = sourceMarkdown.replace('## ILUS EMAKEEL – Opiq', '## Wrong title');
  assert.throws(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(changed)), /field title differs/);
});

test('accounts for all 426 source rows', () => {
  assert.equal(catalog.route_records['grade-3-estonian'].length, 363);
  assert.equal(catalog.route_records['grade-3-estonian-second-language'].length, 54);
  assert.equal(catalog.exclusions.cover_details.length, 4);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 4);
  assert.equal(catalog.exclusions.administrative.length, 1);
  assert.equal(363 + 54 + 4 + 4 + 1, sourceRecords.length);
});

test('creates a disjoint first-language and second-language partition', () => {
  const first = catalog.route_records['grade-3-estonian'];
  const second = catalog.route_records['grade-3-estonian-second-language'];
  const firstUrls = new Set(first.map((record) => record.url));
  assert.ok(second.every((record) => !firstUrls.has(record.url)));
  assert.deepEqual(new Set(first.map((record) => record.kit_id)), new Set(['135', '179']));
  assert.deepEqual(new Set(second.map((record) => record.kit_id)), new Set(['140']));
});

test('normalizes evidence-backed grade anomalies only', () => {
  const first = catalog.route_records['grade-3-estonian'];
  assert.ok(first.every((record) => record.grade === 3));
  const changed = clone(sourceRecords);
  changed.find((record) => record.url.includes('/kit/135/chapter/')).grade = 3;
  assert.throws(() => buildGrade3EstonianCatalog(changed), /raw grade/);
});

test('normalizes the automatic mathematics subject into separate Estonian subjects', () => {
  const first = catalog.route_records['grade-3-estonian'][0];
  const second = catalog.route_records['grade-3-estonian-second-language'][0];
  assert.equal(first.subject_et, 'eesti keel');
  assert.equal(second.subject_et, 'eesti keel teise keelena');
  assert.ok(!catalog.canonical_records.some((record) => record.subject_en === 'mathematics'));
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).subject_en = 'science';
  assert.throws(() => buildGrade3EstonianCatalog(changed), /automatic mathematics/);
});

test('normalizes only the two audited page-language anomalies', () => {
  const pages = catalog.canonical_records.filter((record) => [
    'https://www.opiq.ee/kit/135/chapter/7352',
    'https://www.opiq.ee/kit/140/chapter/7788',
  ].includes(record.url));
  assert.equal(pages.length, 2);
  assert.ok(pages.every((record) => record.language === 'et'));
  const changed = clone(sourceRecords);
  changed.find((record) => record.url.includes('/kit/179/chapter/')).language = 'en';
  assert.throws(() => buildGrade3EstonianCatalog(changed), /unaudited source language/);
});

test('rejects mixing kit 140 into first-language Estonian', () => {
  const record = clone(catalog.route_records['grade-3-estonian-second-language'][0]);
  assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'), /canonical subject|belongs to/);
});

test('rejects mixing kits 135 or 179 into second-language Estonian', () => {
  for (const kit of ['135', '179']) {
    const record = clone(catalog.route_records['grade-3-estonian'].find((candidate) => candidate.kit_id === kit));
    assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian-second-language'), /canonical subject|belongs to/);
  }
});

test('rejects cover-only kit 590 as instructional evidence', () => {
  const record = clone(catalog.route_records['grade-3-estonian'][0]);
  record.url = 'https://www.opiq.ee/kit/590/chapter/99999';
  record.kit_id = '590';
  record.book = 'Mina loen ja kirjutan 3';
  record.book_id = 'mina_loen_ja_kirjutan_3__kit590';
  record.source_book_id = 'mina_loen_ja_kirjutan_3';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'), /Cover-only kit 590/);
  assert.ok(!catalog.canonical_records.some((record) => record.kit_id === '590'));
});

test('rejects duplicate instructional URLs and conflicting detail aliases', () => {
  const duplicateInstruction = clone(sourceRecords);
  const instructional = duplicateInstruction.filter((record) => /\/chapter\//u.test(record.url));
  instructional[1].url = instructional[0].url;
  assert.throws(() => buildGrade3EstonianCatalog(duplicateInstruction), /duplicate URL groups|Kit Details/);
  const conflictingDetail = clone(sourceRecords);
  const alias = conflictingDetail.filter((record) => record.url === 'https://www.opiq.ee/Kit/Details/135')[1];
  alias.title = 'Conflicting title';
  assert.throws(() => buildGrade3EstonianCatalog(conflictingDetail), /conflict/);
});

test('rejects Kit Details and Impressum as canonical records', () => {
  const detail = clone(catalog.route_records['grade-3-estonian'][0]);
  detail.url = 'https://www.opiq.ee/Kit/Details/135';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(detail, 'grade-3-estonian'), /direct chapter URL/);
  const impressum = clone(catalog.route_records['grade-3-estonian'][0]);
  impressum.title = 'Impressum';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(impressum, 'grade-3-estonian'), /administrative Impressum/);
});

test('rejects mathematics left in canonical Subject', () => {
  const record = clone(catalog.route_records['grade-3-estonian'][0]);
  [record.subject_en, record.subject_et, record.subject_ru] = ['mathematics', 'matemaatika', 'математика'];
  assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'), /canonical subject/);
});

test('rejects invented publisher and book-title metadata', () => {
  const publisher = clone(catalog.route_records['grade-3-estonian'][0]);
  publisher.publisher = 'Invented Publisher';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(publisher, 'grade-3-estonian'), /invented publisher/);
  const title = clone(catalog.route_records['grade-3-estonian'][0]);
  title.book = title.title;
  assert.throws(() => validateGrade3EstonianCanonicalRecord(title, 'grade-3-estonian'), /book title differs/);
});

test('rejects unprocessed payload and replacement or control characters', () => {
  const payload = clone(catalog.route_records['grade-3-estonian'][0]);
  payload.headings = ['<div>payload</div>'];
  assert.throws(() => validateGrade3EstonianCanonicalRecord(payload, 'grade-3-estonian'), /unprocessed JSON\/HTML payload/);
  const replacement = clone(catalog.route_records['grade-3-estonian'][0]);
  replacement.title += '\ufffd';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(replacement, 'grade-3-estonian'), /replacement character/);
  const control = clone(catalog.route_records['grade-3-estonian'][0]);
  control.title += '\u0000';
  assert.throws(() => validateGrade3EstonianCanonicalRecord(control, 'grade-3-estonian'), /control character/);
});

test('repairs a zero-width Roman numeral using the same record title', () => {
  const record = catalog.canonical_records.find(
    (candidate) => candidate.url === 'https://www.opiq.ee/kit/140/chapter/7822',
  );
  assert.ok(record.headings.includes('MUKI AJAB ASJU II'));
  assert.ok(!record.headings.includes('MUKI AJAB ASJU I I'));
  const repair = catalog.content_repairs.find((entry) => entry.url === record.url);
  assert.ok(repair.categories.includes('same_record_heading_alignment'));
});

test('renders both canonical routes deterministically', () => {
  const rebuilt = buildGrade3EstonianCatalog(sourceRecords);
  for (const routeId of Object.keys(grade3EstonianRoutes)) {
    assert.equal(renderGrade3EstonianMarkdown(routeId, catalog), renderGrade3EstonianMarkdown(routeId, rebuilt));
  }
});

test('validates reciprocal manifest route policy', () => {
  const first = manifest.sources.find((source) => source.id === 'grade-3-estonian');
  const second = manifest.sources.find((source) => source.id === 'grade-3-estonian-second-language');
  assert.doesNotThrow(() => validateManifestGrade3EstonianRoutes(first, second));
  const changed = clone(first);
  changed.subject_boundary.forbidden_book_ids = [];
  assert.throws(() => validateManifestGrade3EstonianRoutes(changed, second), /forbidden Book IDs/);
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('production QA is deterministic and records zero hard errors', async () => {
  for (const [qa, outputPath, expected] of [
    [firstQa, 'project-files/outputs/opiq_3klass_eesti_keel.md', 363],
    [secondQa, 'project-files/outputs/opiq_3klass_eesti_keel_teise_keelena.md', 54],
  ]) {
    const output = await readFile(outputPath);
    assert.equal(qa.page_records_included, expected);
    assert.equal(qa.checksums.output_file_sha256, sha256Bytes(output));
    assert.equal(qa.generation.generated_at, grade3EstonianArchive.capture_timestamp);
    assert.ok(Object.values(qa.content_quality_audit.hard_errors).every((count) => count === 0));
    assert.equal(qa.source_representation_audit.unexplained_differences, 0);
  }
});

test('canonical grade-3 Estonian URLs do not overlap any other route', async () => {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  for (const route of manifest.sources.filter((source) => !Object.hasOwn(grade3EstonianRoutes, source.id))) {
    const markdown = await readFile(route.md_path, 'utf8');
    const urls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmiu)].map((match) => match[1]);
    assert.ok(urls.every((url) => !targetUrls.has(url)), `canonical URL overlaps route ${route.id}`);
  }
});
