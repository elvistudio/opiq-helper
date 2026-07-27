import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4CatalogueGapArtifacts,
  catalogueGapAuditPath,
  catalogueGapReportPath,
  catalogueSnapshotPath,
  validateCatalogueSnapshotSemantics,
} from './lib/grade-4-catalogue-gap.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let artifacts;
let validateSnapshot;
let validateReport;

before(async () => {
  artifacts = await buildGrade4CatalogueGapArtifacts(rootDir);
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  validateSnapshot = ajv.compile(JSON.parse(await readFile(
    path.join(rootDir, 'schemas/grade-4-live-catalogue-snapshot.schema.json'),
    'utf8',
  )));
  validateReport = ajv.compile(JSON.parse(await readFile(
    path.join(rootDir, 'schemas/grade-4-source-gap-report.schema.json'),
    'utf8',
  )));
});

test('snapshot and report compile under strict schemas', () => {
  assert.equal(validateSnapshot(artifacts.snapshot), true, JSON.stringify(validateSnapshot.errors));
  assert.equal(validateReport(artifacts.report), true, JSON.stringify(validateReport.errors));
});

test('snapshot has an explicit complete-for-declared-filter status', () => {
  assert.equal(artifacts.snapshot.completeness_status, 'complete_for_declared_filter');
  assert.deepEqual(validateCatalogueSnapshotSemantics(artifacts.snapshot), []);
});

test('search discovery alone cannot yield a complete status', () => {
  const mutated = structuredClone(artifacts.snapshot);
  mutated.records[0].evidence_status = 'search_discovery_only';
  assert.deepEqual(validateCatalogueSnapshotSemantics(mutated), [
    'search_discovery_cannot_prove_completeness',
  ]);
});

test('complete status requires full filter and pagination evidence', () => {
  const mutated = structuredClone(artifacts.snapshot);
  mutated.catalogue_interface.pagination.all_result_pages_captured = false;
  assert.deepEqual(validateCatalogueSnapshotSemantics(mutated), [
    'complete_status_without_required_filter_evidence',
  ]);
});

test('all 55 records have direct Kit Details URLs and provenance', () => {
  assert.equal(artifacts.snapshot.records.length, 55);
  for (const record of artifacts.snapshot.records) {
    assert.equal(record.kit_details_url, `https://www.opiq.ee/Kit/Details/${record.kit_id}`);
    assert.equal(record.verified_on, '2026-07-27');
    assert.equal(record.evidence_status, 'direct_live_evidence');
    assert.ok(record.source_evidence_refs.length >= 2);
  }
});

test('every source evidence reference resolves to a declared evidence source', () => {
  const refs = new Set(artifacts.snapshot.evidence_sources.map((entry) => entry.evidence_ref));
  for (const record of artifacts.snapshot.records) {
    assert.ok(record.source_evidence_refs.every((ref) => refs.has(ref)));
  }
});

test('material-type filters reconcile to 39 learning kits and 16 teacher books', () => {
  assert.deepEqual(artifacts.snapshot.catalogue_interface.material_type_breakdown, {
    learning_kits: 39,
    teacher_books: 16,
  });
  assert.equal(
    artifacts.snapshot.records.filter((record) => record.material_type === 'Õpetajaraamat').length,
    16,
  );
});

test('every kit has exactly one primary classification and one decision of each kind', () => {
  assert.equal(new Set(artifacts.report.live_kit_inventory.map((row) => row.kit_id)).size, 55);
  assert.equal(artifacts.report.ownership_decisions.length, 55);
  assert.equal(artifacts.report.recapture_decisions.length, 55);
  assert.ok(artifacts.report.live_kit_inventory.every((row) => typeof row.primary_classification === 'string'));
});

test('all 31 canonical Grade 4 kits reconcile with current manifest routes', () => {
  const canonical = artifacts.report.captured_vs_live.filter(
    (row) => row.repository_capture_status === 'captured_canonical',
  );
  assert.equal(canonical.length, 31);
  assert.ok(canonical.every((row) => (
    row.canonical_route_id
    && row.manifest_route_ids.includes(row.canonical_route_id)
    && row.ownership_decision === 'retain_existing_grade_4_owner'
  )));
});

test('the eleven canonical route baseline remains unchanged', () => {
  assert.equal(artifacts.report.canonical_baseline.route_count, 11);
  assert.equal(artifacts.report.canonical_baseline.canonical_instructional_record_count, 2212);
  assert.equal(artifacts.report.canonical_baseline.manifest_coverage_status, 'partial_subject_bounded');
});

test('known shared kits retain non-exclusive decisions', () => {
  const byKit = Object.fromEntries(artifacts.report.captured_vs_live.map((row) => [row.kit_id, row]));
  assert.equal(byKit['161'].ownership_decision, 'multi_grade_no_exclusive_owner');
  assert.equal(byKit['200'].ownership_decision, 'retain_existing_non_grade_4_owner');
  assert.equal(byKit['200'].canonical_owner, 'grade-2-arts-and-crafts');
  assert.equal(byKit['476'].ownership_decision, 'multi_grade_no_exclusive_owner');
});

test('teacher and e-tund kits never enter student canonical routes', () => {
  const teacher = artifacts.report.captured_vs_live.filter((row) => row.primary_classification === 'teacher_only');
  assert.equal(teacher.length, 16);
  assert.ok(teacher.every((row) => (
    row.canonical_route_id === null
    && row.ownership_decision === 'teacher_support_no_student_owner'
  )));
});

test('all required teacher discovery seeds and the newly found kit 506 are present', () => {
  const ids = new Set(artifacts.report.teacher_support_inventory);
  for (const id of ['359', '373', '377', '378', '471', '487', '492', '493', '506', '566']) {
    assert.ok(ids.has(id), `missing teacher kit ${id}`);
  }
});

test('seeded and filter-discovered inventory is explicitly separated', () => {
  assert.equal(artifacts.report.discovery_breakdown.preliminary_seed_kit_ids.length, 9);
  assert.equal(artifacts.report.discovery_breakdown.additional_kit_ids_found_by_complete_filter.length, 12);
  assert.ok(artifacts.report.discovery_breakdown.additional_kit_ids_found_by_complete_filter.includes('506'));
});
test('multi-grade teacher books cannot silently become exact Grade 4 routes', () => {
  const multiTeacher = artifacts.report.captured_vs_live.filter(
    (row) => row.primary_classification === 'teacher_only'
      && row.secondary_roles.includes('multi_grade_support'),
  );
  assert.equal(multiTeacher.length, 10);
  assert.ok(multiTeacher.every((row) => row.canonical_route_id === null));
});

test('Estonian first-language and second-language routes remain separate', () => {
  const byKit = Object.fromEntries(artifacts.report.captured_vs_live.map((row) => [row.kit_id, row]));
  assert.equal(byKit['150'].canonical_route_id, 'grade-4-estonian-second-language');
  assert.equal(byKit['71'].canonical_route_id, 'grade-4-estonian');
  assert.notEqual(byKit['150'].canonical_route_id, byKit['71'].canonical_route_id);
});

test('simplified and mixed-subject roles remain explicit', () => {
  const byKit = Object.fromEntries(artifacts.report.captured_vs_live.map((row) => [row.kit_id, row]));
  for (const id of ['282', '287', '304', '318', '328']) {
    assert.ok(byKit[id].secondary_roles.includes('simplified_curriculum'));
  }
  for (const id of ['55', '82']) assert.ok(byKit[id].secondary_roles.includes('mixed_subject'));
});

test('older and newer editions are preserved separately', () => {
  assert.ok(artifacts.report.edition_relationships.length >= 9);
  assert.ok(artifacts.report.edition_relationships.every(
    (entry) => entry.disposition.startsWith('preserve_separate'),
  ));
});

test('missing captures remain distinct from incomplete captured task bodies', () => {
  const missing = artifacts.report.captured_vs_live.filter((row) => row.repository_capture_status === 'not_captured');
  const partial = artifacts.report.captured_vs_live.filter((row) => row.task_body_completeness === 'partial');
  assert.equal(missing.length, 21);
  assert.equal(partial.length, 31);
  assert.ok(missing.every((row) => row.task_body_completeness === 'not_captured'));
});

test('targeted and full recapture remain distinct and full recapture is not recommended', () => {
  const decisions = new Set(artifacts.report.recapture_decisions.map((entry) => entry.decision));
  assert.ok(decisions.has('metadata_only'));
  assert.ok(decisions.has('teacher_material_capture_internal_only'));
  assert.equal(decisions.has('full_instructional_capture'), false);
});

test('task-body recapture is not required for catalogue accounting', () => {
  assert.equal(
    artifacts.report.recapture_decisions.some((entry) => entry.decision === 'selected_task_body_capture'),
    false,
  );
  assert.match(artifacts.markdown, /task-body capture is not required for this purpose/u);
});

test('no new exact Grade 4 student source candidate is invented', () => {
  assert.deepEqual(artifacts.report.student_source_gaps, []);
  assert.equal(artifacts.report.summary.new_exact_grade_4_student_candidates, 0);
});

test('the five newly found non-teacher kits remain supplementary and non-exclusive', () => {
  const byKit = Object.fromEntries(artifacts.report.captured_vs_live.map((row) => [row.kit_id, row]));
  for (const id of ['231', '348', '349', '350', '465']) {
    assert.equal(byKit[id].primary_classification, 'supplementary_shared');
    assert.equal(byKit[id].ownership_decision, 'multi_grade_no_exclusive_owner');
    assert.equal(byKit[id].recapture_decision, 'metadata_only');
  }
});

test('snapshot contains metadata only and no long source payloads', () => {
  const longest = Math.max(...artifacts.snapshot.records.flatMap((record) => [
    record.title.length,
    ...record.authors.map((author) => author.length),
    ...record.evidence_limitations.map((note) => note.length),
  ]));
  assert.ok(longest < 350);
  assert.equal(JSON.stringify(artifacts.snapshot).includes('task_body_text'), false);
  assert.equal(JSON.stringify(artifacts.snapshot).includes('chapter_text'), false);
});

test('historical artifacts and all ten immutable ZIPs remain verified', () => {
  assert.equal(artifacts.report.historical_artifact_hashes.length, 5);
  assert.ok(artifacts.report.historical_artifact_hashes.every((entry) => entry.unchanged));
  assert.deepEqual(artifacts.report.immutable_archive_verification, {
    archive_count: 10,
    all_hashes_and_sizes_current: true,
  });
});

test('shared QA freshness checker preserves Grade 4 artifact_type metadata', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/refresh-qa-snapshot-metadata.mjs', '--check'],
    { cwd: rootDir, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /39 snapshot\(s\) are current/u);
});

test('generation is deterministic', async () => {
  const repeated = await buildGrade4CatalogueGapArtifacts(rootDir);
  assert.equal(repeated.snapshotJson, artifacts.snapshotJson);
  assert.equal(repeated.reportJson, artifacts.reportJson);
  assert.equal(repeated.markdown, artifacts.markdown);
});

test('stale committed artifacts are rejected', () => {
  assert.throws(
    () => assertCommittedBytes(artifacts.reportJson, `${artifacts.reportJson} `, catalogueGapReportPath),
    /Stale generated artifact/u,
  );
});

test('committed generated artifacts are byte-current', async () => {
  for (const [artifactPath, expected] of [
    [catalogueSnapshotPath, artifacts.snapshotJson],
    [catalogueGapReportPath, artifacts.reportJson],
    [catalogueGapAuditPath, artifacts.markdown],
  ]) {
    assertCommittedBytes(expected, await readFile(path.join(rootDir, artifactPath)), artifactPath);
  }
});

test('catalogue-capture issue closure is recommended only after review and merge', () => {
  assert.equal(
    artifacts.report.issue_41_closure_recommendation,
    'ready_after_review_and_merge_for_catalogue_capture_scope',
  );
  assert.match(artifacts.markdown, /must not be closed automatically/u);
});

test('non-guarantees cover curriculum, access, content, and effectiveness', () => {
  const text = artifacts.report.non_guarantees.join(' ');
  assert.match(text, /curriculum coverage/u);
  assert.match(text, /authenticated/u);
  assert.match(text, /task body/u);
  assert.match(text, /effectiveness/u);
});
