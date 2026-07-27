import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  archiveExpectations,
  assertCommittedBytes,
  buildGrade4SourceIntakeReport,
  buildReportArtifacts,
  classifyGradeEvidence,
  requiredArchiveMembers,
  sha256,
  stableJson,
} from './lib/grade-4-source-intake.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let report;
let artifacts;
let initialIdentities;

before(async () => {
  initialIdentities = await Promise.all(archiveExpectations.map(async (archive) => {
    const bytes = await readFile(path.join(rootDir, archive.path));
    return { path: archive.path, byte_size: bytes.length, sha256: sha256(bytes) };
  }));
  artifacts = await buildReportArtifacts(rootDir);
  report = artifacts.report;
});

test('all ten expected immutable ZIP paths are in scope', () => {
  assert.equal(archiveExpectations.length, 10);
  assert.deepEqual(report.scope.archive_paths, archiveExpectations.map((archive) => archive.path));
});

test('every archive SHA-256 and byte size matches the immutable expectation', () => {
  assert.deepEqual(
    report.archive_inventory.map(({ path: archivePath, sha256: digest, byte_size: size }) => ({
      path: archivePath,
      sha256: digest,
      byte_size: size,
    })),
    archiveExpectations,
  );
});

test('safe ZIP reader validates every member CRC', () => {
  assert.ok(report.archive_inventory.every((archive) => archive.crc_verification === 'passed'));
});

test('every archive contains the required compact and raw members', () => {
  for (const archive of report.archive_inventory) {
    assert.deepEqual(archive.expected_members_present, requiredArchiveMembers);
    assert.deepEqual(archive.expected_members_absent, []);
  }
});

test('compact index, JSONL, and Markdown record representations agree', () => {
  for (const archive of report.archive_inventory) {
    assert.equal(archive.compact_representations_match, true);
    assert.equal(archive.compact_index_record_count, archive.raw_source_record_count);
    assert.equal(archive.compact_markdown_record_count, archive.raw_source_record_count);
    assert.deepEqual(archive.declared_query_languages, ['en', 'et', 'ru']);
  }
});

test('source accounting balances independently for every archive', () => {
  for (const archive of report.archive_inventory) {
    const accounting = archive.source_accounting;
    assert.equal(accounting.balanced, true);
    assert.equal(accounting.total_source_records, accounting.accounted_source_records);
  }
});

test('global source accounting proves that no record disappears', () => {
  assert.deepEqual(report.source_accounting_totals, {
    total_source_records: 2425,
    instructional_chapter_or_page: 2359,
    kit_or_book_detail: 34,
    administrative_or_imprint: 0,
    duplicate_detail_alias: 32,
    duplicate_instructional_url: 0,
    malformed_or_ambiguous: 0,
    accounted_source_records: 2425,
    balanced: true,
  });
});

test('generic title plus exporter grade is only probable, not verified', () => {
  assert.equal(classifyGradeEvidence({
    coverTitle: 'Generic workshop',
    sourceBookId: 'generic_source',
    rawGrade: 4,
  }), 'probable_grade_4');
});

test('school-stage-II evidence is not normalized to exact Grade 4', () => {
  for (const kitId of ['55', '82', '161']) {
    assert.equal(report.kit_inventory.find((kit) => kit.kit_id === kitId).candidate_grade, 'school_stage_ii_not_exact_grade');
  }
});

test('first-language and second-language Estonian stay in separate routes and URLs', () => {
  const first = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-estonian');
  const second = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-estonian-second-language');
  assert.deepEqual(first.included_kit_ids, ['71', '533']);
  assert.deepEqual(second.included_kit_ids, ['150']);
  const firstUrls = new Set(first.included_kit_ids.flatMap((kitId) => {
    const kit = report.kit_inventory.find((entry) => entry.kit_id === kitId);
    return kit.chapter_ids.map((chapterId) => `https://www.opiq.ee/kit/${kitId}/chapter/${chapterId}`);
  }));
  const secondUrls = second.included_kit_ids.flatMap((kitId) => {
    const kit = report.kit_inventory.find((entry) => entry.kit_id === kitId);
    return kit.chapter_ids.map((chapterId) => `https://www.opiq.ee/kit/${kitId}/chapter/${chapterId}`);
  });
  assert.ok(secondUrls.every((url) => !firstUrls.has(url)));
});

test('mixed human-and-society scope stays separate from subject-pure human studies', () => {
  const mixed = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'school-stage-ii-human-studies-and-society');
  const pure = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-human-studies-simplified');
  assert.equal(mixed.programme_scope, 'mixed_subject');
  assert.deepEqual(mixed.included_kit_ids, ['55', '82']);
  assert.deepEqual(pure.included_kit_ids, ['287']);
});

test('simplified mathematics cannot silently enter the unknown-programme core route', () => {
  const core = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-mathematics');
  const simplified = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-mathematics-simplified');
  assert.equal(core.programme_scope, 'unknown');
  assert.equal(simplified.programme_scope, 'simplified_curriculum');
  assert.ok(simplified.included_kit_ids.every((kitId) => !core.included_kit_ids.includes(kitId)));
});

test('cover/detail rows never become instructional records', () => {
  for (const archive of report.archive_inventory) {
    const kitDetailRows = report.kit_inventory
      .filter((kit) => kit.source_archive_path === archive.path)
      .reduce((sum, kit) => sum + kit.cover_detail_record_count, 0);
    assert.equal(
      archive.source_accounting.kit_or_book_detail + archive.source_accounting.duplicate_detail_alias,
      kitDetailRows,
    );
  }
});

test('missing task arrays are reported and not synthesized', () => {
  const kit = report.kit_inventory.find((entry) => entry.kit_id === '415');
  assert.equal(kit.task_array_nonempty_record_count, 0);
  assert.ok(kit.source_limitations.some((limitation) => limitation.includes('no captured task example')));
});

test('cross-archive duplicate-URL analysis is explicit even when count is zero', () => {
  assert.equal(report.url_ownership_and_overlaps.cross_archive_overlap_count, 0);
  assert.deepEqual(report.url_ownership_and_overlaps.cross_archive_overlaps, []);
});

test('overlap checks cover current manifest owners and Grade 3/5 specifically', () => {
  assert.equal(report.url_ownership_and_overlaps.existing_manifest_overlap_count, 85);
  assert.equal(report.url_ownership_and_overlaps.grade_3_overlap_count, 0);
  assert.equal(report.url_ownership_and_overlaps.grade_5_overlap_count, 0);
});

test('all Käsitöötuba overlap URLs retain the existing Grade 2 owner', () => {
  assert.deepEqual(report.url_ownership_and_overlaps.existing_manifest_overlap_counts_by_owner, [
    { value: 'grade-2-arts-and-crafts', count: 85 },
  ]);
  assert.ok(report.url_ownership_and_overlaps.existing_manifest_overlaps.every((overlap) => (
    overlap.outcome === 'retain_existing_canonical_owner'
    && overlap.existing_owners.some((owner) => owner.source_id === 'grade-2-arts-and-crafts')
  )));
});

test('unknown publisher and programme metadata remain unknown', () => {
  const kit = report.kit_inventory.find((entry) => entry.kit_id === '451');
  assert.equal(kit.publisher, null);
  assert.equal(kit.programme_type, 'unknown');
});

test('systematically wrong exporter subject labels remain visible beside normalization', () => {
  const kit = report.kit_inventory.find((entry) => entry.kit_id === '243');
  assert.equal(kit.candidate_subject, 'russian');
  assert.ok(kit.raw_subject_labels.some(({ value }) => value.includes('mathematics')));
  assert.ok(kit.metadata_contradictions.some((entry) => entry.includes('Exporter subject labels conflict')));
});

test('Russian language and Russian reading remain separate candidate owners', () => {
  const language = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-russian');
  const reading = report.candidate_route_matrix.find((route) => route.proposed_source_id === 'grade-4-russian-reading');
  assert.deepEqual(language.included_kit_ids, ['243', '295']);
  assert.deepEqual(reading.included_kit_ids, ['415']);
});

test('raw capture limitation honestly reports absent complete page prose', () => {
  assert.ok(report.kit_inventory.every((kit) => kit.page_text_available === false));
  assert.ok(report.kit_inventory.every((kit) => kit.page_text_record_count === 0));
  assert.ok(report.kit_inventory.every((kit) => kit.automatic_topic_translation_is_language_evidence === false));
  assert.ok(report.kit_inventory.every((kit) => kit.isolated_vocabulary_gloss_record_count === null));
});

test('edition-level equivalents remain distinct without URL overlap evidence', () => {
  assert.deepEqual(
    report.url_ownership_and_overlaps.edition_equivalence_assessments.map((entry) => entry.kit_ids),
    [['11', '480'], ['27', '536'], ['174', '552']],
  );
  assert.ok(report.url_ownership_and_overlaps.edition_equivalence_assessments.every((entry) => entry.outcome === 'retain_separate_editions'));
});

test('all 34 kit variants receive an evidence decision', () => {
  assert.equal(report.kit_inventory.length, 34);
  assert.ok(report.kit_inventory.every((kit) => kit.grade_evidence.length > 0 && kit.subject_evidence.length > 0));
});

test('report generation is byte-identical across repeated runs', async () => {
  const repeated = await buildReportArtifacts(rootDir);
  assert.equal(repeated.json, artifacts.json);
  assert.equal(repeated.markdown, artifacts.markdown);
  assert.equal(stableJson(await buildGrade4SourceIntakeReport(rootDir)), artifacts.json);
});

test('stale committed report bytes are rejected', () => {
  assert.throws(
    () => assertCommittedBytes(Buffer.from('expected'), Buffer.from('stale'), 'fixture'),
    /fixture is stale/u,
  );
});

test('strict report schema validates production report and rejects unknown fields', async () => {
  const schema = JSON.parse(await readFile(path.join(rootDir, 'schemas/grade-4-source-intake-report.schema.json'), 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(schema);
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(report);
  invalid.unexpected = true;
  assert.equal(validate(invalid), false);
  assert.ok(validate.errors.some((error) => error.keyword === 'additionalProperties'));
});

test('archive filename encoding anomalies are retained instead of normalized', () => {
  assert.ok(report.archive_inventory.some((archive) => archive.encoding_anomalies.length > 0));
  assert.ok(report.archive_inventory.every((archive) => (
    archive.encoding_anomalies.every((anomaly) => anomaly.code === 'utf8_name_bytes_without_utf8_flag')
  )));
});

test('report explicitly preserves the no-route and no-manifest-change boundary', () => {
  assert.equal(report.scope.canonical_routes_created, false);
  assert.equal(report.scope.source_manifest_modified, false);
  assert.ok(report.non_guarantees.some((claim) => claim.includes('does not create or modify canonical Grade 4 routes')));
});

test('original ZIP bytes remain unchanged after repeated auditing', async () => {
  const finalIdentities = await Promise.all(archiveExpectations.map(async (archive) => {
    const bytes = await readFile(path.join(rootDir, archive.path));
    return { path: archive.path, byte_size: bytes.length, sha256: sha256(bytes) };
  }));
  assert.deepEqual(finalIdentities, initialIdentities);
});
