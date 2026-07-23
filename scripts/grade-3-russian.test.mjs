import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readCompactZip, readZipText } from './lib/compact-zip.mjs';
import {
  assertCompactMarkdownMatches,
  assertGeneratedArtifact,
  assertGrade3RussianArchiveIdentity,
  assertHistoricalGrade2ArchiveIdentity,
  assertKit568FinalOwnership,
  assertRequiredMembers,
  assertSafeMemberName,
  buildGrade3RussianCatalog,
  compareKit568Ownership,
  grade3RussianArchive,
  grade3RussianVariants,
  historicalGrade2RussianArchive,
  isAdministrative,
  isKitDetail,
  isSearchResult,
  kitId,
  parseGrade3Jsonl,
  parseGrade3Markdown,
  renderGrade3RussianMarkdown,
  sha256Bytes,
  validateCanonicalGrade3RussianRecord,
  validateManifestGrade3RussianSource,
} from './lib/grade-3-russian.mjs';

const originalBytes = await readFile(grade3RussianArchive.path);
const originalArchive = await readCompactZip(grade3RussianArchive.path);
const sourceRecords = parseGrade3Jsonl(readZipText(originalArchive, 'opiq_lookup.jsonl'));
const sourceMarkdown = readZipText(originalArchive, 'opiq_lookup.md');
const catalog = buildGrade3RussianCatalog(sourceRecords);
const historicalBytes = await readFile(historicalGrade2RussianArchive.path);
const historicalArchive = await readCompactZip(historicalGrade2RussianArchive.path);
const historicalRecords = parseGrade3Jsonl(readZipText(historicalArchive, 'opiq_lookup.jsonl'));
const manifest = JSON.parse(await readFile('source-manifest.json', 'utf8'));
const productionQa = JSON.parse(await readFile('project-files/outputs/opiq_3klass_vene_keel_qa.json', 'utf8'));
const clone = (value) => structuredClone(value);

function oldKit568Canonical(records = historicalRecords) {
  return records.filter((record) => record.book_id === 'avita_русский_язык_i_ступень_часть_3_kit568'
    && kitId(record) === '568'
    && !isKitDetail(record)
    && !isAdministrative(record)
    && !isSearchResult(record));
}

function comparison(overrides = {}) {
  return compareKit568Ownership({
    oldSourceRecords: historicalRecords,
    newSourceRecords: sourceRecords,
    oldCanonicalRecords: oldKit568Canonical(),
    newCanonicalRecords: catalog.canonical_records,
    ...overrides,
  });
}

test('accepts the immutable original archive identity', () => {
  assert.doesNotThrow(() => assertGrade3RussianArchiveIdentity(originalBytes));
  assert.equal(sha256Bytes(originalBytes), grade3RussianArchive.sha256);
  assert.equal(originalBytes.length, grade3RussianArchive.byte_size);
});

test('accepts the historical grade-2 archive used only for migration evidence', () => {
  assert.doesNotThrow(() => assertHistoricalGrade2ArchiveIdentity(historicalBytes));
});

test('rejects changed archive bytes and size', () => {
  const changed = Buffer.from(originalBytes);
  changed[100] ^= 1;
  assert.throws(() => assertGrade3RussianArchiveIdentity(changed), /checksum/);
  assert.throws(() => assertGrade3RussianArchiveIdentity(changed.subarray(0, -1)), /byte size/);
});

test('rejects a corrupt ZIP through the shared reader', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'opiq-grade3-russian-'));
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

test('compact JSONL and Markdown representations agree', () => {
  assert.doesNotThrow(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(sourceMarkdown)));
});

test('rejects mismatched compact representations', () => {
  const changed = sourceMarkdown.replace('## Русский язык. 3 класс (2023 г.) – Opiq', '## Wrong title');
  assert.throws(() => assertCompactMarkdownMatches(sourceRecords, parseGrade3Markdown(changed)), /field title differs/);
});

test('accounts for all 488 source rows', () => {
  assert.equal(catalog.canonical_records.length, 478);
  assert.equal(catalog.exclusions.cover_details.length, 4);
  assert.equal(catalog.exclusions.duplicate_aliases.length, 4);
  assert.equal(catalog.exclusions.administrative.length, 1);
  assert.equal(catalog.exclusions.search_results.length, 1);
  assert.equal(478 + 4 + 4 + 1 + 1, 488);
});

test('represents all four source-book-plus-kit identities', () => {
  assert.equal(Object.keys(grade3RussianVariants).length, 4);
  assert.deepEqual(
    Object.fromEntries(Object.values(grade3RussianVariants).map((variant) => [variant.kit_id, variant.canonical_records])),
    { 94: 173, 250: 62, 503: 191, 568: 52 },
  );
});

test('normalizes exporter mathematics metadata to Russian language', () => {
  assert.ok(sourceRecords.every((record) => record.subject_en === 'mathematics'));
  assert.ok(catalog.canonical_records.every((record) => record.subject_en === 'Russian language'
    && record.subject_et === 'vene keel'
    && record.subject_ru === 'русский язык'));
  assert.ok(catalog.canonical_records.every((record) => !record.topics_en.includes('mathematics')
    && !record.topics_et.includes('matemaatika')
    && !record.topics_ru.includes('математика')));
});

test('excludes the sole Estonian search-results row', () => {
  assert.equal(catalog.exclusions.search_results[0].title, 'Varamu – Opiq');
  assert.equal(catalog.exclusions.search_results[0].language, 'et');
  assert.ok(catalog.canonical_records.every((record) => record.language === 'ru'));
});

test('excludes all Kit Details and Impressum records', () => {
  assert.ok(catalog.canonical_records.every((record) => !record.url.includes('/Kit/Details/')));
  assert.ok(catalog.canonical_records.every((record) => !/импрессум/iu.test(record.title)));
});

test('repairs technical controls and extractor payloads deterministically', () => {
  const text = renderGrade3RussianMarkdown(catalog);
  assert.doesNotMatch(text, /[\u00ad\u200b-\u200d\u2060\ufeff]/u);
  assert.doesNotMatch(text, /\{"d|PausEsita%|<\/?[A-Za-z][^>]*>/u);
  assert.ok(catalog.content_repairs.length > 0);
  assert.ok(catalog.content_repairs.every((repair) => repair.changes.every((change) => /^[0-9a-f]{64}$/u.test(change.raw_sha256)
    && /^[0-9a-f]{64}$/u.test(change.canonical_sha256))));
});

test('rejects an unknown source book or wrong kit', () => {
  const unknown = clone(sourceRecords);
  unknown.find((record) => /\/chapter\//u.test(record.url)).book_id = 'unknown';
  assert.throws(() => buildGrade3RussianCatalog(unknown), /Unknown grade-3 Russian Source Book ID/);
  const wrongKit = clone(sourceRecords);
  wrongKit.find((record) => record.url.includes('/kit/503/chapter/')).url = 'https://www.opiq.ee/kit/999/chapter/27466';
  assert.throws(() => buildGrade3RussianCatalog(wrongKit), /outside the audited kit/);
});

test('rejects unexplained source-row loss', () => {
  assert.throws(() => buildGrade3RussianCatalog(sourceRecords.slice(1)), /source records/);
});

test('rejects mathematics left as the canonical subject', () => {
  const record = clone(catalog.canonical_records[0]);
  record.subject_en = 'mathematics';
  assert.throws(() => validateCanonicalGrade3RussianRecord(record), /canonical subject/);
});

test('rejects a non-Russian instructional language', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => /\/chapter\//u.test(record.url) && !/импрессум/iu.test(record.title)).language = 'et';
  assert.throws(() => buildGrade3RussianCatalog(changed), /instructional source language/);
});

test('rejects Kit Details, search pages, and Impressum as canonical records', () => {
  for (const record of [
    catalog.exclusions.cover_details[0],
    catalog.exclusions.search_results[0],
    catalog.exclusions.administrative[0],
  ]) {
    assert.throws(() => validateCanonicalGrade3RussianRecord({
      ...record,
      kit_id: kitId(record),
      source_book_id: record.book_id,
      programme_type: 'ordinary_curriculum',
    }), /direct canonical|canonical subject|canonical language/);
  }
});

test('rejects a conflicting duplicate instructional URL', () => {
  const changed = clone(sourceRecords);
  const instructional = changed.filter((record) => /\/chapter\//u.test(record.url) && !/импрессум/iu.test(record.title));
  instructional[1].url = instructional[0].url;
  assert.throws(() => buildGrade3RussianCatalog(changed), /duplicate URL groups|Kit Details/);
});

test('kit 568 URL sets and educational content support grade-3 ownership', () => {
  const result = comparison();
  assert.equal(result.url_count, 52);
  assert.equal(result.url_sets_equal, true);
  assert.equal(result.decision, 'move_to_grade_3');
  assert.equal(result.audited_content_differences.length, 1);
  assert.equal(result.audited_content_differences[0].classification, 'interactive_option_order_only');
});

test('rejects kit 568 in both canonical grades', () => {
  assert.throws(() => assertKit568FinalOwnership(oldKit568Canonical(), catalog.canonical_records), /remains in grade 2/);
});

test('rejects kit 568 in neither canonical grade', () => {
  assert.throws(() => assertKit568FinalOwnership([], catalog.canonical_records.filter((record) => record.kit_id !== '568')), /must have 52 canonical grade-3 records/);
});

test('rejects an unexplained kit 568 title, heading, or task difference', () => {
  const changed = clone(sourceRecords);
  changed.find((record) => record.url === 'https://www.opiq.ee/kit/568/chapter/31758').title = 'Changed';
  assert.throws(() => comparison({ newSourceRecords: changed }), /Unexplained old\/new kit 568 title difference/);
});

test('does not invent publishers absent from the archive', () => {
  const ordinaryWithoutPublisher = catalog.canonical_records.find((record) => record.kit_id === '503');
  assert.equal(ordinaryWithoutPublisher.publisher, '');
  const changed = clone(ordinaryWithoutPublisher);
  changed.publisher = 'Invented';
  assert.throws(() => validateCanonicalGrade3RussianRecord(changed), /publisher is not source-supported/);
});

test('renders deterministic canonical Markdown', () => {
  assert.equal(renderGrade3RussianMarkdown(catalog), renderGrade3RussianMarkdown(buildGrade3RussianCatalog(sourceRecords)));
});

test('validates the canonical manifest route', () => {
  const route = manifest.sources.find((source) => source.id === 'grade-3-russian');
  assert.doesNotThrow(() => validateManifestGrade3RussianSource(route));
  assert.throws(() => validateManifestGrade3RussianSource({ ...route, record_count: 477 }), /record_count/);
});

test('rejects stale generated artifacts', () => {
  assert.doesNotThrow(() => assertGeneratedArtifact('same', 'same', 'fixture'));
  assert.throws(() => assertGeneratedArtifact('old', 'new', 'fixture'), /stale/);
});

test('canonical URLs are direct and unique', () => {
  const urls = catalog.canonical_records.map((record) => record.url);
  assert.equal(new Set(urls).size, 478);
  assert.ok(urls.every((url) => /^https:\/\/www\.opiq\.ee\/kit\/\d+\/chapter\/\d+$/u.test(url)));
});

test('grade-3 Russian URLs do not overlap any other manifest route', async () => {
  const targetUrls = new Set(catalog.canonical_records.map((record) => record.url));
  for (const route of manifest.sources.filter((source) => source.id !== 'grade-3-russian')) {
    const markdown = await readFile(route.md_path, 'utf8');
    const urls = [...markdown.matchAll(/^(?:-\s+)?URL:\s+(https?:\/\/\S+)\s*$/gmi)].map((match) => match[1]);
    assert.ok(urls.every((url) => !targetUrls.has(url)), `canonical URL overlaps ${route.id}`);
  }
});

test('grade-2 Russian no longer owns kit 568', async () => {
  const records = parseGrade3Markdown(await readFile('project-files/outputs/opiq_2klass_vene_keel.md', 'utf8'));
  assert.equal(records.length, 321);
  assert.ok(records.every((record) => kitId(record) !== '568'));
});

test('production QA is deterministic and records zero hard errors', async () => {
  const markdown = await readFile('project-files/outputs/opiq_3klass_vene_keel.md');
  assert.equal(productionQa.generation.generated_at, grade3RussianArchive.capture_timestamp);
  assert.equal(productionQa.checksums.output_file_sha256, sha256Bytes(markdown));
  assert.equal(productionQa.source_records, 488);
  assert.equal(productionQa.page_records_included, 478);
  assert.ok(Object.values(productionQa.content_quality_audit.hard_errors).every((count) => count === 0));
  assert.equal(productionQa.kit_568_migration.final_owner, 'grade-3-russian');
});
