import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadTeacherPackRepository,
  validateTeacherPackRepository,
} from './lib/teacher-packs.mjs';

let baseline;
const baselinePackId = 'grade-5-science-water-teacher-pack';

before(async () => {
  baseline = await loadTeacherPackRepository();
});

function cloneRepository() {
  return structuredClone(baseline);
}

function lessons(repository) {
  const linkedLessonIds = new Set(indexData(repository).lesson_ids);
  return repository.plans.artifacts
    .filter((artifact) => artifact.data.artifact_type === 'bilingual_lesson' && linkedLessonIds.has(artifact.data.lesson_id))
    .sort((left, right) => left.data.position_in_unit - right.data.position_in_unit);
}

function lesson(repository, position = 1) {
  const found = lessons(repository).find((artifact) => artifact.data.position_in_unit === position);
  assert.ok(found, `missing lesson ${position}`);
  return found.data;
}

function thematic(repository) {
  const expectedUnitId = indexData(repository).unit_ref;
  const found = repository.plans.artifacts.find((artifact) => artifact.data.artifact_type === 'bilingual_thematic_plan' && artifact.data.unit_id === expectedUnitId);
  assert.ok(found, 'missing thematic plan');
  return found.data;
}

function indexData(repository) {
  const found = repository.indexes.find((entry) => entry.data.pack_id === baselinePackId);
  assert.ok(found, `missing teacher pack ${baselinePackId}`);
  return found.data;
}

function lessonMaterial(repository, position, materialId) {
  const found = lesson(repository, position).evidence_linkage.author_materials
    .find((material) => material.material_id === materialId);
  assert.ok(found, `missing lesson material ${materialId}`);
  return found;
}

function indexedMaterial(repository, materialId) {
  const found = indexData(repository).materials
    .find((entry) => entry.material.material_id === materialId)?.material;
  assert.ok(found, `missing indexed material ${materialId}`);
  return found;
}

function mutateMaterialBoth(repository, position, materialId, mutate) {
  mutate(lessonMaterial(repository, position, materialId));
  mutate(indexedMaterial(repository, materialId));
}

function validation(repository) {
  return validateTeacherPackRepository(repository);
}

function diagnostics(repository, severity = 'error') {
  return validation(repository).diagnostics.filter((diagnostic) => diagnostic.severity === severity);
}

function diagnosticText(found) {
  return found.map((diagnostic) => `${diagnostic.file} ${diagnostic.field} ${diagnostic.reason}`).join('\n');
}

function assertFailsWith(repository, pattern) {
  const found = diagnostics(repository);
  assert.ok(found.length > 0, 'expected validation to fail');
  assert.match(diagnosticText(found), pattern);
}

test('production water teacher pack resolves all files with honest readiness warnings', () => {
  const repository = cloneRepository();
  const result = validation(repository);
  const foundErrors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const foundWarnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  assert.deepEqual(foundErrors, [], diagnosticText(foundErrors));
  assert.equal(foundWarnings.length, 4, diagnosticText(foundWarnings));
  assert.match(diagnosticText(foundWarnings), /teacher review .* pending/u);
  assert.match(diagnosticText(foundWarnings), /not been tested in a classroom/u);
  assert.equal(result.summary.packs, 2);
  assert.equal(result.summary.lessons, 10);
  assert.equal(result.summary.materials, 66);
  assert.equal(result.summary.studentDocuments, 30);
  assert.equal(thematic(repository).teacher_pack.classroom_ready, false);
  for (const artifact of lessons(repository)) {
    assert.equal(artifact.data.artifact_readiness.readiness_status, 'teacher_pack_complete_pending_review');
    assert.equal(artifact.data.artifact_readiness.classroom_ready, false);
  }
});

test('water-use-cycle teacher pack resolves six lessons, scored materials, and pending readiness', () => {
  const repository = cloneRepository();
  const index = repository.indexes.find((entry) => entry.data.pack_id === 'grade-5-science-water-use-cycle-teacher-pack')?.data;
  assert.ok(index, 'missing water-use-cycle teacher pack');
  assert.equal(index.lesson_ids.length, 6);
  assert.equal(index.materials.length, 37);
  assert.equal(index.pedagogical_review.status, 'pending');
  assert.equal(index.classroom_trial.status, 'not_tested');
  const studentTasks = index.materials.map((entry) => entry.material)
    .filter((material) => material.audience === 'student' && ['worksheet', 'assessment'].includes(material.material_type));
  assert.ok(studentTasks.length > 0);
  assert.ok(studentTasks.every((material) => material.answer_key_path), 'every scored student task needs an answer key');
  assert.ok(index.materials.some((entry) => entry.material.material_id === 'filter-safety-card'));
  assert.deepEqual(diagnostics(repository), []);
});

test('worksheet path that does not exist fails', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 3, 'melting-condensation-table', (material) => {
    material.artifact_path = 'teacher-packs/grade-5-science/water/student/missing-table.md';
  });
  assertFailsWith(repository, /material file does not exist: .*missing-table\.md/u);
});

test('assessment without an answer key or open-ended exemption fails', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 4, 'unit-separate-assessment', (material) => {
    delete material.answer_key_path;
  });
  assertFailsWith(repository, /requires an answer key|answer_key_path/u);
});

test('materials_resolved cannot remain true while a material file is missing', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 1, 'water-property-table', (material) => {
    material.artifact_path = 'teacher-packs/grade-5-science/water/student/not-created.md';
  });
  assert.equal(lesson(repository, 1).artifact_readiness.materials_resolved, true);
  assertFailsWith(repository, /materials_resolved cannot be true/u);
});

test('print_ready cannot remain true when a required student material is not printable', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 2, 'state-sort-cards', (material) => {
    material.printable = false;
  });
  assert.equal(lesson(repository, 2).artifact_readiness.print_ready, true);
  assertFailsWith(repository, /print_ready cannot be true/u);
});

test('approved teacher review without a date fails', () => {
  const repository = cloneRepository();
  const readiness = lesson(repository, 1).artifact_readiness;
  readiness.teacher_review.status = 'approved';
  readiness.teacher_review.reviewed_at = null;
  readiness.readiness_status = 'teacher_reviewed';
  assertFailsWith(repository, /approved teacher review requires reviewer role, valid date, and notes/u);
});

test('classroom_ready fails while teacher review is pending', () => {
  const repository = cloneRepository();
  const readiness = lesson(repository, 1).artifact_readiness;
  readiness.classroom_ready = true;
  readiness.readiness_status = 'classroom_ready';
  assertFailsWith(repository, /classroom_ready cannot be true .*teacher review is not approved/u);
});

test('classroom_ready fails without a recorded classroom trial', () => {
  const repository = cloneRepository();
  const readiness = lesson(repository, 1).artifact_readiness;
  readiness.teacher_review.status = 'approved';
  readiness.teacher_review.reviewed_at = '2026-07-21';
  readiness.classroom_ready = true;
  readiness.readiness_status = 'classroom_ready';
  assertFailsWith(repository, /classroom_ready cannot be true .*classroom trial is not recorded/u);
});

test('teacher_reviewed status fails while review remains pending', () => {
  const repository = cloneRepository();
  lesson(repository, 1).artifact_readiness.readiness_status = 'teacher_reviewed';
  assertFailsWith(repository, /teacher_reviewed requires approved teacher review/u);
});

test('classroom_tested status fails without a recorded trial', () => {
  const repository = cloneRepository();
  lesson(repository, 1).artifact_readiness.readiness_status = 'classroom_tested';
  assertFailsWith(repository, /classroom_tested requires a recorded classroom trial/u);
});

test('absolute author-material path fails', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 1, 'water-property-table', (material) => {
    material.artifact_path = '/Users/example/worksheet.md';
  });
  assertFailsWith(repository, /must be a repository-relative path/u);
});

test('author-material path that escapes the repository fails', () => {
  const repository = cloneRepository();
  mutateMaterialBoth(repository, 1, 'water-property-table', (material) => {
    material.artifact_path = '../outside.md';
  });
  assertFailsWith(repository, /must be a repository-relative path|outside the repository/u);
});

test('lesson YAML material missing from materials index fails', () => {
  const repository = cloneRepository();
  lessonMaterial(repository, 1, 'water-property-table').material_id = 'unregistered-table';
  assertFailsWith(repository, /material unregistered-table is not registered in materials-index\.yaml/u);
});

test('student worksheet with a prohibited hidden answer fails', () => {
  const repository = cloneRepository();
  const material = lessonMaterial(repository, 1, 'water-property-table');
  const original = repository.fileContents.get(material.artifact_path);
  repository.fileContents.set(material.artifact_path, `${original}\n<!-- ANSWER: hidden solution -->\n`);
  assertFailsWith(repository, /student material contains a prohibited hidden answer marker/u);
});

test('silent simplified-curriculum source use still fails through shared plan validation', () => {
  const repository = cloneRepository();
  const mergedUnit = repository.plans.curriculum.artifacts
    .find((artifact) => artifact.data.artifact_type === 'thematic_unit').data;
  const simplified = structuredClone(mergedUnit.rejected_duplicate_records
    .find((record) => record.programme_type === 'simplified_curriculum'));
  assert.ok(simplified, 'missing canonical simplified-curriculum fixture');
  simplified.record_id = 'teacher-pack-simplified-fixture';
  lesson(repository, 1).evidence_linkage.opiq_records[0] = simplified;
  assertFailsWith(repository, /cannot silently use simplified or unknown programme material/u);
});
