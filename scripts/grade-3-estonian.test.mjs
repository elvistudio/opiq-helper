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
  assertGrade3EstonianCrossRouteOwnership,
  assertGrade3EstonianArchiveIdentity,
  assertRequiredGrade3EstonianMembers,
  assertSafeMemberName,
  buildGrade3EstonianCatalog,
  grade3EstonianKit590Archive,
  grade3EstonianRoutes,
  grade3EstonianSharedArchive,
  renderGrade3EstonianMarkdown,
  sha256Bytes,
  validateGrade3EstonianCanonicalRecord,
  validateManifestGrade3EstonianRoutes,
} from './lib/grade-3-estonian.mjs';

const sharedArchiveBytes = await readFile(grade3EstonianSharedArchive.path);
const sharedArchive = await readCompactZip(grade3EstonianSharedArchive.path);
const sharedRecords = parseGrade3Jsonl(readZipText(sharedArchive, 'opiq_lookup.jsonl'));
const sharedMarkdown = readZipText(sharedArchive, 'opiq_lookup.md');
const kit590ArchiveBytes = await readFile(grade3EstonianKit590Archive.path);
const kit590Archive = await readCompactZip(grade3EstonianKit590Archive.path);
const kit590Records = parseGrade3Jsonl(readZipText(kit590Archive, 'opiq_lookup.jsonl'));
const kit590Markdown = readZipText(kit590Archive, 'opiq_lookup.md');
const catalog = buildGrade3EstonianCatalog(sharedRecords, kit590Records);
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const firstQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_eesti_keel_qa.json', 'utf8'));
const secondQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_eesti_keel_teise_keelena_qa.json', 'utf8'));
const clone = (value) => structuredClone(value);

async function withTemporaryArchive(bytes, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-estonian-'));
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

test('accepts both immutable original archive identities', () => {
  for (const [definition, bytes, archive] of [
    [grade3EstonianSharedArchive, sharedArchiveBytes, sharedArchive],
    [grade3EstonianKit590Archive, kit590ArchiveBytes, kit590Archive],
  ]) {
    assert.doesNotThrow(() => assertGrade3EstonianArchiveIdentity(bytes, definition));
    assert.equal(sha256Bytes(bytes), definition.sha256);
    assert.equal(bytes.length, definition.byte_size);
    assert.equal(archive.entryCount, definition.member_count);
  }
});

test('rejects checksum and byte-size changes in either archive', () => {
  for (const [definition, bytes] of [
    [grade3EstonianSharedArchive, sharedArchiveBytes],
    [grade3EstonianKit590Archive, kit590ArchiveBytes],
  ]) {
    const changed = Buffer.from(bytes);
    changed[100] ^= 1;
    assert.throws(() => assertGrade3EstonianArchiveIdentity(changed, definition), /checksum/);
    assert.throws(() => assertGrade3EstonianArchiveIdentity(changed.subarray(0, -1), definition), /byte size/);
  }
});

test('rejects a corrupt ZIP through the shared safe reader', async () => {
  await withTemporaryArchive(sharedArchiveBytes.subarray(0, 256), async (file) => {
    await assert.rejects(readCompactZip(file), /end-of-central-directory/);
  });
  const changed = Buffer.from(kit590ArchiveBytes);
  const payloadOffset = changed.indexOf(Buffer.from('"formatVersion": "2.0"'));
  assert.ok(payloadOffset > 0);
  changed[payloadOffset + 2] ^= 1;
  await withTemporaryArchive(changed, async (file) => {
    await assert.rejects(readCompactZip(file), /CRC-32/);
  });
});

test('rejects duplicate ZIP member names', async () => {
  await withTemporaryArchive(withDuplicateCentralMemberName(kit590ArchiveBytes), async (file) => {
    await assert.rejects(readCompactZip(file), /duplicate member name/);
  });
});

test('rejects unsafe ZIP member paths', () => {
  assert.throws(() => assertSafeMemberName('/absolute.json'), /absolute/);
  assert.throws(() => assertSafeMemberName('../outside.json'), /traverses/);
  assert.throws(() => assertSafeMemberName('raw\\outside.json'), /backslash/);
});

test('requires every original representation', () => {
  assert.doesNotThrow(() => assertRequiredGrade3EstonianMembers(sharedArchive.entries.keys()));
  assert.doesNotThrow(() => assertRequiredGrade3EstonianMembers(kit590Archive.entries.keys()));
  assert.throws(() => assertRequiredGrade3EstonianMembers(['index.json']), /missing required member/);
});

test('accepts matching compact JSONL and Markdown representations', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(sharedRecords, parseGrade3Markdown(sharedMarkdown)));
  assert.doesNotThrow(() => assertCompactMarkdownMatches(kit590Records, parseGrade3Markdown(kit590Markdown)));
});

test('rejects mismatched compact representations', () => {
  const changed = sharedMarkdown.replace('## ILUS EMAKEEL – Opiq', '## Wrong title');
  assert.throws(() => assertCompactMarkdownMatches(sharedRecords, parseGrade3Markdown(changed)), /field title differs/);
});

test('accounts for all 470 source rows', () => {
  assert.equal(catalog.route_records['grade-3-estonian'].length, 405);
  assert.equal(catalog.route_records['grade-3-estonian-second-language'].length, 54);
  assert.equal(catalog.exclusions.cover_details.length, 4);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 6);
  assert.equal(catalog.exclusions.administrative.length, 1);
  assert.equal(405 + 54 + 4 + 6 + 1, sharedRecords.length + kit590Records.length);
});

test('rejects unexplained source rows and unknown kits', () => {
  const unexplained = clone(sharedRecords);
  unexplained.push(clone(unexplained[0]));
  assert.throws(
    () => buildGrade3EstonianCatalog(unexplained, kit590Records),
    /shared archive has 427 source records/i,
  );
  const wrongKit = clone(kit590Records);
  wrongKit.find((record) => /\/kit\/590\/chapter\//u.test(record.url)).url = 'https://www.opiq.ee/kit/999/chapter/33253';
  assert.throws(
    () => buildGrade3EstonianCatalog(sharedRecords, wrongKit),
    /outside kit 590|wrong kit/i,
  );
});

test('creates a disjoint first-language and second-language partition', () => {
  const first = catalog.route_records['grade-3-estonian'];
  const second = catalog.route_records['grade-3-estonian-second-language'];
  const firstUrls = new Set(first.map((record) => record.url));
  assert.ok(second.every((record) => !firstUrls.has(record.url)));
  assert.deepEqual(new Set(first.map((record) => record.kit_id)), new Set(['135', '179', '590']));
  assert.deepEqual(new Set(second.map((record) => record.kit_id)), new Set(['140']));
});

test('normalizes evidence-backed grade anomalies only', () => {
  const first = catalog.route_records['grade-3-estonian'];
  assert.ok(first.every((record) => record.grade === 3));
  const changed = clone(sharedRecords);
  changed.find((record) => record.url.includes('/kit/135/chapter/')).grade = 3;
  assert.throws(() => buildGrade3EstonianCatalog(changed, kit590Records), /raw grade/);
});

test('normalizes the automatic mathematics subject into separate Estonian subjects', () => {
  const first = catalog.route_records['grade-3-estonian'][0];
  const second = catalog.route_records['grade-3-estonian-second-language'][0];
  assert.equal(first.subject_et, 'eesti keel');
  assert.equal(second.subject_et, 'eesti keel teise keelena');
  assert.ok(!catalog.canonical_records.some((record) => record.subject_en === 'mathematics'));
  const changed = clone(sharedRecords);
  changed.find((record) => /\/chapter\//u.test(record.url)).subject_en = 'science';
  assert.throws(() => buildGrade3EstonianCatalog(changed, kit590Records), /automatic mathematics/);
});

test('normalizes only the two audited page-language anomalies', () => {
  const pages = catalog.canonical_records.filter((record) => [
    'https://www.opiq.ee/kit/135/chapter/7352',
    'https://www.opiq.ee/kit/140/chapter/7788',
  ].includes(record.url));
  assert.equal(pages.length, 2);
  assert.ok(pages.every((record) => record.language === 'et'));
  const changed = clone(sharedRecords);
  changed.find((record) => record.url.includes('/kit/179/chapter/')).language = 'en';
  assert.throws(() => buildGrade3EstonianCatalog(changed, kit590Records), /unaudited source language/);
});

test('rejects mixing kit 140 into first-language Estonian', () => {
  const record = clone(catalog.route_records['grade-3-estonian-second-language'][0]);
  assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'), /canonical subject|belongs to/);
});

test('rejects mixing kits 135, 179, or 590 into second-language Estonian', () => {
  for (const kit of ['135', '179', '590']) {
    const record = clone(catalog.route_records['grade-3-estonian'].find((candidate) => candidate.kit_id === kit));
    assert.throws(() => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian-second-language'), /canonical subject|belongs to/);
  }
});

test('uses the dedicated capture for exactly 42 kit 590 instructional pages', () => {
  const records = catalog.route_records['grade-3-estonian'].filter((record) => record.kit_id === '590');
  assert.equal(records.length, 42);
  assert.equal(new Set(records.map((record) => record.url)).size, 42);
  assert.deepEqual(
    Object.fromEntries(['1', '2', '3', '4', '5'].map((section) => [
      section,
      records.filter((record) => record.chapter_id.startsWith(`${section}.`)).length,
    ])),
    { 1: 2, 2: 12, 3: 12, 4: 15, 5: 1 },
  );
  assert.ok(records.every((record) => record.language === 'et'));
});

test('supplements shared kit 590 cover evidence without duplicating pages', () => {
  assert.equal(sharedRecords.filter((record) => record.book_id === 'mina_loen_ja_kirjutan_3').length, 2);
  assert.equal(kit590Records.filter((record) => /\/Kit\/Details\/590$/u.test(record.url)).length, 2);
  assert.equal(kit590Records.filter((record) => /\/kit\/590\/chapter\//u.test(record.url)).length, 42);
  const detailAudit = catalog.duplicate_audit.find((entry) => entry.kit_id === '590');
  assert.equal(detailAudit.chapter_ids.length, 4);
  assert.equal(new Set(detailAudit.source_archives).size, 2);
});

test('does not accept the raw-book ru anomaly as canonical kit 590 language', () => {
  const record = clone(catalog.route_records['grade-3-estonian'].find((entry) => entry.kit_id === '590'));
  record.language = 'ru';
  assert.throws(
    () => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'),
    /canonical language must be et/,
  );
});

test('retains three distinct KORDAMINE pages instead of collapsing by title', () => {
  const repeated = catalog.canonical_records.filter(
    (record) => record.kit_id === '590' && record.title === 'KORDAMINE',
  );
  assert.equal(repeated.length, 3);
  assert.deepEqual(
    new Set(repeated.map((record) => record.url)),
    new Set([
      'https://www.opiq.ee/kit/590/chapter/33265',
      'https://www.opiq.ee/kit/590/chapter/33277',
      'https://www.opiq.ee/kit/590/chapter/33293',
    ]),
  );
});

test('retains instructional headings and excludes kit 590 platform boilerplate', () => {
  const records = catalog.canonical_records.filter((record) => record.kit_id === '590');
  assert.ok(records.every((record) => record.headings.length > 0));
  assert.ok(records.some((record) => record.headings.includes('1.')));
  assert.ok(records.every((record) => record.headings.every(
    (heading) => !['Õpetaja lisatud materjal', 'Minu lisatud materjal', 'Seotud sisu'].includes(heading),
  )));
  assert.ok(records.every((record) => record.task_examples.length === 0));
});

test('rejects duplicate instructional URLs and conflicting detail aliases', () => {
  const duplicateInstruction = clone(sharedRecords);
  const instructional = duplicateInstruction.filter((record) => /\/chapter\//u.test(record.url));
  instructional[1].url = instructional[0].url;
  assert.throws(() => buildGrade3EstonianCatalog(duplicateInstruction, kit590Records), /duplicate URL groups|Kit Details/);
  const conflictingDetail = clone(sharedRecords);
  const alias = conflictingDetail.filter((record) => record.url === 'https://www.opiq.ee/Kit/Details/135')[1];
  alias.title = 'Conflicting title';
  assert.throws(() => buildGrade3EstonianCatalog(conflictingDetail, kit590Records), /conflict/);
});

test('rejects representing a kit 590 instructional page twice', () => {
  const changed = clone(kit590Records);
  const chapters = changed.filter((record) => /\/kit\/590\/chapter\//u.test(record.url));
  const replacementIndex = changed.findIndex((record) => record.url === chapters.at(-1).url);
  changed[replacementIndex] = clone(chapters[0]);
  assert.throws(
    () => buildGrade3EstonianCatalog(sharedRecords, changed),
    /duplicate URL groups|Kit Details|canonical URLs/i,
  );
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

test('rejects invented task examples', () => {
  const record = clone(catalog.route_records['grade-3-estonian'].find((entry) => entry.kit_id === '590'));
  record.task_examples = ['Invented exercise'];
  assert.throws(
    () => validateGrade3EstonianCanonicalRecord(record, 'grade-3-estonian'),
    /task examples not present/,
  );
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
  const rebuilt = buildGrade3EstonianCatalog(sharedRecords, kit590Records);
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
  const missingArchive = clone(first);
  delete missingArchive.additional_source_archives;
  assert.throws(
    () => validateManifestGrade3EstonianRoutes(missingArchive, second),
    /additional source archive/,
  );
  const leakedArchive = clone(second);
  leakedArchive.additional_source_archives = clone(first.additional_source_archives);
  assert.throws(
    () => validateManifestGrade3EstonianRoutes(first, leakedArchive),
    /must not claim the dedicated kit 590 archive/,
  );
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('production QA is deterministic and records zero hard errors', async () => {
  for (const [qa, outputPath, expected] of [
    [firstQa, 'project-files/outputs/opiq_3klass_eesti_keel.md', 405],
    [secondQa, 'project-files/outputs/opiq_3klass_eesti_keel_teise_keelena.md', 54],
  ]) {
    const output = await readFile(outputPath);
    assert.equal(qa.page_records_included, expected);
    assert.equal(qa.checksums.output_file_sha256, sha256Bytes(output));
    assert.equal(
      qa.generation.generated_at,
      qa.source_id === 'grade-3-estonian'
        ? grade3EstonianKit590Archive.capture_timestamp
        : grade3EstonianSharedArchive.capture_timestamp,
    );
    assert.ok(Object.values(qa.content_quality_audit.hard_errors).every((count) => count === 0));
    assert.ok(Object.values(qa.source_representation_audit).every(
      (audit) => audit.unexplained_differences === 0,
    ));
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

test('rejects a grade-3 Estonian source owned by another route', () => {
  const targetUrls = catalog.canonical_records.map((record) => record.url);
  assert.throws(
    () => assertGrade3EstonianCrossRouteOwnership(targetUrls, [{
      source_id: 'fixture-other-route',
      urls: [targetUrls[0]],
    }]),
    /also belongs to fixture-other-route/,
  );
});
