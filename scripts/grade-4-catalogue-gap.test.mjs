import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildCrossEvidenceReview,
  buildGrade4CatalogueGapArtifacts,
  catalogueFilterIdentity,
  catalogueGapAuditPath,
  catalogueMetadataIdentity,
  catalogueGapReportPath,
  catalogueSnapshotPath,
  loadCatalogueSnapshot,
  validateCatalogueSnapshotSemantics,
} from './lib/grade-4-catalogue-gap.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let artifacts;
let validateSnapshot;
let validateReport;

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

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

test('authoritative snapshot is loaded from disk rather than synthesized in code', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'grade-4-catalogue-snapshot-'));
  try {
    const snapshotDirectory = path.join(temporaryRoot, path.dirname(catalogueSnapshotPath));
    await mkdir(snapshotDirectory, { recursive: true });
    const sentinel = { authoritative_disk_value: 'read-directly' };
    await writeFile(path.join(temporaryRoot, catalogueSnapshotPath), JSON.stringify(sentinel));
    assert.deepEqual(await loadCatalogueSnapshot(temporaryRoot), sentinel);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('generator contains no duplicated liveRows table or material-type teacher set', async () => {
  const source = await readFile(path.join(rootDir, 'scripts/lib/grade-4-catalogue-gap.mjs'), 'utf8');
  assert.doesNotMatch(source, /\bconst liveRows\b/u);
  assert.doesNotMatch(source, /material_type:\s*teacherIds[.]has/u);
  assert.doesNotMatch(source, /Direct public Kit Details fields captured/u);
});

test('snapshot has an explicit complete-for-declared-filter status', () => {
  assert.equal(artifacts.snapshot.completeness_status, 'complete_for_declared_filter');
  assert.deepEqual(validateCatalogueSnapshotSemantics(artifacts.snapshot), []);
});

test('snapshot carries stable filter and complete metadata identities', () => {
  const identities = artifacts.snapshot.catalogue_interface.stable_source_identity;
  assert.equal(identities.filter_identity.value, catalogueFilterIdentity(artifacts.snapshot));
  assert.equal(identities.metadata_identity.value, catalogueMetadataIdentity(artifacts.snapshot));
  assert.equal(identities.filter_identity.identity_input, 'filters_count_ordered_kit_ids');
  assert.equal(identities.metadata_identity.identity_input, 'normalized_complete_record_metadata');
});

test('search discovery alone cannot yield a complete status', () => {
  const mutated = structuredClone(artifacts.snapshot);
  mutated.records[0].evidence_status = 'search_discovery_only';
  mutated.catalogue_interface.stable_source_identity.metadata_identity.value = catalogueMetadataIdentity(mutated);
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

test('derived inventory material type comes from authoritative snapshot records', () => {
  const reportTypes = new Map(
    artifacts.report.live_kit_inventory.map((record) => [record.kit_id, record.material_type]),
  );
  for (const record of artifacts.snapshot.records) {
    assert.equal(reportTypes.get(record.kit_id), record.material_type);
  }
});

test('kit 55 preserves raw Grade 4 and 5 observation and a human-reviewed Grade 4 normalization', () => {
  const record = artifacts.snapshot.records.find((entry) => entry.kit_id === '55');
  assert.deepEqual(record.grade_scope.observed, [4, 5]);
  assert.deepEqual(record.grade_scope.normalized, [4]);
  assert.equal(record.grade_scope.normalization.status, 'human_reviewed');
  assert.equal(record.grade_scope.normalization.decision, 'treat_as_grade_4_only');
  assert.equal(record.grade_scope.normalization.reason_code, 'probable_catalogue_metadata_typo');
  assert.ok(record.grade_scope.normalization.supporting_kit_ids.includes('82'));
  assert.ok(record.grade_scope.normalization.supporting_evidence.includes('parallel_kit_82'));
  assert.ok(record.grade_scope.normalization.supporting_evidence.includes('historical_post_audit_kit_details'));
});

test('kit 55 normalization rationale is mandatory under the reusable schema', () => {
  const mutated = structuredClone(artifacts.snapshot);
  delete mutated.records.find((entry) => entry.kit_id === '55').grade_scope.normalization.rationale;
  assert.equal(validateSnapshot(mutated), false);
  assert.ok(validateSnapshot.errors.some((error) => error.params?.missingProperty === 'rationale'));
});

test('kit 55 retains its canonical Grade 4 route without multi-grade ownership', () => {
  const row = artifacts.report.captured_vs_live.find((entry) => entry.kit_id === '55');
  assert.equal(row.canonical_route_id, 'grade-4-human-studies-and-society');
  assert.equal(row.ownership_decision, 'retain_existing_grade_4_owner');
  assert.equal(row.primary_classification, 'canonical_student_source');
  assert.equal(row.secondary_roles.includes('multi_grade_support'), false);
  assert.equal(row.ownership_decision, artifacts.report.cross_evidence_review.find(
    (entry) => entry.kit_id === '55',
  ).routing_effect);
});

test('changing observed grade scope without updating metadata identity is rejected', () => {
  const mutated = structuredClone(artifacts.snapshot);
  mutated.records.find((entry) => entry.kit_id === '55').grade_scope.observed = [4];
  assert.ok(validateCatalogueSnapshotSemantics(mutated).includes('metadata_identity_mismatch'));
});

test('title, publisher, task-count, and normalization changes each change metadata identity', () => {
  for (const mutate of [
    (snapshot) => { snapshot.records[0].title = `${snapshot.records[0].title} changed`; },
    (snapshot) => { snapshot.records[0].publisher = `${snapshot.records[0].publisher} changed`; },
    (snapshot) => { snapshot.records[0].task_count += 1; },
    (snapshot) => {
      snapshot.records.find((entry) => entry.kit_id === '55').grade_scope.normalization.decision =
        'treat_as_observed_multi_grade';
    },
  ]) {
    const mutated = structuredClone(artifacts.snapshot);
    mutate(mutated);
    assert.notEqual(catalogueMetadataIdentity(mutated), catalogueMetadataIdentity(artifacts.snapshot));
  }
});

test('filter identity remains stable when metadata changes but filter, count, and IDs do not', () => {
  const mutated = structuredClone(artifacts.snapshot);
  mutated.records[0].title = `${mutated.records[0].title} changed`;
  mutated.records[0].publisher = `${mutated.records[0].publisher} changed`;
  mutated.records[0].task_count += 1;
  assert.equal(catalogueFilterIdentity(mutated), catalogueFilterIdentity(artifacts.snapshot));
});

test('cross-evidence discrepancy for kit 55 is visible and resolved by human review', () => {
  const row = artifacts.report.cross_evidence_review.find((entry) => entry.kit_id === '55');
  assert.deepEqual(row.historical_grade_scope, [4]);
  assert.deepEqual(row.live_observed_grade_scope, [4, 5]);
  assert.deepEqual(row.normalized_grade_scope, [4]);
  assert.equal(row.comparison_status, 'resolved_by_human_review');
  assert.equal(row.routing_effect, 'retain_existing_grade_4_owner');
});

test('cross-evidence discrepancy cannot disappear when normalization is removed', async () => {
  const mutated = structuredClone(artifacts.snapshot);
  const record = mutated.records.find((entry) => entry.kit_id === '55');
  delete record.grade_scope.normalized;
  delete record.grade_scope.normalization;
  mutated.catalogue_interface.stable_source_identity.metadata_identity.value = catalogueMetadataIdentity(mutated);
  const historical = JSON.parse(await readFile(
    path.join(rootDir, 'evaluations/grade-4-kit-details-evidence.json'),
    'utf8',
  ));
  const row = buildCrossEvidenceReview(mutated, historical).find((entry) => entry.kit_id === '55');
  assert.equal(row.comparison_status, 'unresolved_discrepancy');
});

test('kit 82 remains Grade 4 and supplies the parallel normalization evidence', () => {
  const kit82 = artifacts.snapshot.records.find((entry) => entry.kit_id === '82');
  const kit55 = artifacts.snapshot.records.find((entry) => entry.kit_id === '55');
  assert.deepEqual(kit82.grade_scope.observed, [4]);
  assert.equal(kit82.grade_scope.normalized, undefined);
  assert.ok(kit55.grade_scope.normalization.supporting_kit_ids.includes('82'));
  assert.equal(
    artifacts.report.cross_evidence_review.find((entry) => entry.kit_id === '82').comparison_status,
    'consistent',
  );
});

test('every kit has exactly one primary classification and one decision of each kind', () => {
  assert.equal(new Set(artifacts.report.live_kit_inventory.map((row) => row.kit_id)).size, 55);
  assert.equal(artifacts.report.ownership_decisions.length, 55);
  assert.equal(artifacts.report.recapture_decisions.length, 55);
  assert.ok(artifacts.report.live_kit_inventory.every((row) => typeof row.primary_classification === 'string'));
});

test('the other 54 kits retain their established classifications and ownership decisions', () => {
  const canonical = new Set([
    '11', '27', '55', '70', '71', '82', '108', '147', '150', '154', '157', '174',
    '206', '228', '243', '282', '287', '293', '295', '304', '318', '328', '332',
    '415', '451', '460', '480', '533', '536', '552', '588',
  ]);
  const teachers = new Set([
    '324', '359', '373', '377', '378', '411', '416', '444', '445', '471', '474',
    '487', '492', '493', '506', '566',
  ]);
  const multiGrade = new Set(['161', '476']);
  const supplementary = new Set(['200', '231', '348', '349', '350', '465']);
  for (const row of artifacts.report.captured_vs_live.filter((entry) => entry.kit_id !== '55')) {
    const expectedPrimary = canonical.has(row.kit_id)
      ? 'canonical_student_source'
      : teachers.has(row.kit_id)
        ? 'teacher_only'
        : multiGrade.has(row.kit_id)
          ? 'multi_grade_support'
          : supplementary.has(row.kit_id)
            ? 'supplementary_shared'
            : null;
    assert.equal(row.primary_classification, expectedPrimary, `classification changed for kit ${row.kit_id}`);
    const expectedOwnership = canonical.has(row.kit_id)
      ? 'retain_existing_grade_4_owner'
      : row.kit_id === '200'
        ? 'retain_existing_non_grade_4_owner'
        : teachers.has(row.kit_id)
          ? 'teacher_support_no_student_owner'
          : 'multi_grade_no_exclusive_owner';
    assert.equal(row.ownership_decision, expectedOwnership, `ownership changed for kit ${row.kit_id}`);
  }
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

test('source manifest and canonical Grade 4 Markdown bytes remain unchanged', async () => {
  const expected = {
    'source-manifest.json': '036e178a800f9462e90abfc6dfea7943b5392a11d896f0ea240d438d9bab3197',
    'project-files/outputs/opiq_4klass_eesti_keel.md': '2ea69cafe1ef13901979847e58fad943d66bbd730415f4966337b4d4605a7b8b',
    'project-files/outputs/opiq_4klass_eesti_keel_teise_keelena.md': '860bf9014f3cfeb328c47a7f84b2ce810c53789fa94d521a79bbecde88b15c2b',
    'project-files/outputs/opiq_4klass_inglise_keel.md': '977f6fae19e9d5bcf9d3a06d125b1705e45c3bd3c787e825d8a4e90ce6e43800',
    'project-files/outputs/opiq_4klass_inimene_ja_uhiskond.md': '1c93b6761a982a6d6927ece2df14d6e2706f3effa3a9ebff53310bfe62880a64',
    'project-files/outputs/opiq_4klass_inimeseopetus_lihtsustatud.md': '7e90aea4f5276d8d2861270156d3abcf7157260be2b9767369edb1e19c9912ae',
    'project-files/outputs/opiq_4klass_loodusopetus.md': '747b7de0e3ccbb0f2ac6585194c5414e5b6c42cd0f647fcf8302f497cd4cb57a',
    'project-files/outputs/opiq_4klass_matemaatika.md': '5813c94ef4b0f708e2c1ce63adc2f62e88ce4a776787e4f0dbb51b7c3f09bdeb',
    'project-files/outputs/opiq_4klass_matemaatika_lihtsustatud.md': '965d5092cf60c11b134029a47f19fd72b5b953c9ccbaa2361f5adb3c13a7a010',
    'project-files/outputs/opiq_4klass_muusika.md': 'fe498882fc220e8e1bc6fc53eb7272133df147596e2e44aea7908b8d1a5afa36',
    'project-files/outputs/opiq_4klass_vene_keel.md': 'dbc3d5b0f33e72ba5aed9e385b58ca08ffec00231fd56e9fb66e76242633336a',
    'project-files/outputs/opiq_4klass_vene_lugemine.md': '4c60b25c62e3a26b2f00968a75eca4f4d6b51c0b0b0554ba5657b23662806cf7',
  };
  for (const [artifactPath, expectedHash] of Object.entries(expected)) {
    assert.equal(hashBytes(await readFile(path.join(rootDir, artifactPath))), expectedHash, artifactPath);
  }
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
  assert.deepEqual(repeated.snapshot, artifacts.snapshot);
  assert.equal(repeated.reportJson, artifacts.reportJson);
  assert.equal(repeated.markdown, artifacts.markdown);
});

test('normal generation validates but never overwrites the authoritative snapshot', async () => {
  const before = await readFile(path.join(rootDir, catalogueSnapshotPath));
  const result = spawnSync(
    process.execPath,
    ['scripts/generate-grade-4-catalogue-gap.mjs'],
    { cwd: rootDir, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readFile(path.join(rootDir, catalogueSnapshotPath)), before);
  assert.match(result.stdout, /Validated authoritative/u);
});

test('stale committed artifacts are rejected', () => {
  assert.throws(
    () => assertCommittedBytes(artifacts.reportJson, `${artifacts.reportJson} `, catalogueGapReportPath),
    /Stale generated artifact/u,
  );
});

test('committed generated artifacts are byte-current', async () => {
  for (const [artifactPath, expected] of [
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
