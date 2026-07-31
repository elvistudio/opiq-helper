import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadCurriculumMapRepository,
  validateCurriculumMapRepository,
} from './lib/curriculum-maps.mjs';

let baseline;

before(async () => {
  baseline = await loadCurriculumMapRepository();
});

function cloneRepository() {
  return structuredClone(baseline);
}

function artifact(repository, type) {
  const found = repository.artifacts.find((candidate) => candidate.data.artifact_type === type);
  assert.ok(found, `missing ${type} fixture`);
  return found.data;
}

function errors(repository) {
  return validateCurriculumMapRepository(repository).diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

function assertFailsWith(repository, pattern) {
  const found = errors(repository);
  assert.ok(found.length > 0, 'expected validation to fail');
  assert.match(found.map((diagnostic) => `${diagnostic.field} ${diagnostic.reason}`).join('\n'), pattern);
}

test('valid golden bilingual unit and production pilot pass', () => {
  assert.deepEqual(errors(cloneRepository()), []);
});

test('teacher work-plan crosswalk is explicitly delegated to its strict validator', () => {
  const repository = cloneRepository();
  const crosswalk = repository.artifacts.find(
    (candidate) => candidate.data.artifact_type === 'teacher_work_plan_curriculum_map',
  );
  assert.ok(crosswalk);
  assert.deepEqual(errors(repository), []);
});

test('multiple eligible books can contribute to one topic and unit', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const books = new Set(unit.selected_records.map((record) => record.book_id));
  const topic = artifact(repository, 'topic_inventory').topics.find((candidate) => candidate.topic_id === 'water-properties-and-states');
  assert.ok(books.size >= 3);
  assert.ok(new Set(topic.selected_records.map((record) => record.book_id)).size >= 3);
  assert.deepEqual(errors(repository), []);
});

test('one route can grow to multiple thematic units without changing the framework', () => {
  const repository = cloneRepository();
  const original = repository.artifacts.find((candidate) => candidate.data.artifact_type === 'thematic_unit');
  const second = structuredClone(original);
  second.file = 'curriculum-maps/grade-5-science/second-unit-fixture.yaml';
  second.data.map_id = 'grade-5-science-second-unit-fixture';
  second.data.unit_id = 'water-properties-and-states-second-fixture';
  repository.artifacts.push(second);
  assert.deepEqual(errors(repository), []);
});

test('Russian-primary and Estonian-support fields are required by the valid pilot', () => {
  const repository = cloneRepository();
  for (const type of ['book_inventory', 'topic_inventory', 'thematic_unit']) {
    const data = artifact(repository, type);
    assert.equal(data.instruction_language, 'ru');
    assert.equal(data.subject_support_language, 'et');
  }
  assert.deepEqual(errors(repository), []);
});

test('missing Estonian terminology fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').bilingual_learning.estonian_terminology = [];
  assertFailsWith(repository, /estonian_terminology/u);
});

test('missing Russian explanation target fails', () => {
  const repository = cloneRepository();
  delete artifact(repository, 'thematic_unit').bilingual_learning.primary_subject_explanation_target_ru;
  assertFailsWith(repository, /primary_subject_explanation_target_ru/u);
});

test('URL outside the canonical route fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].canonical_url = 'https://www.opiq.ee/kit/999/chapter/1';
  assertFailsWith(repository, /URL must occur exactly once/u);
});

test('wrong grade fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').grade = 6;
  assertFailsWith(repository, /expected 5, found 6/u);
});

test('wrong subject fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').subject = 'geography';
  assertFailsWith(repository, /expected science, found geography/u);
});

test('unknown book ID fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].book_id = 'unknown-grade-5-book';
  assertFailsWith(repository, /unknown audited book ID/u);
});

test('missing provenance fails', () => {
  const repository = cloneRepository();
  delete artifact(repository, 'thematic_unit').selected_records[0].provenance;
  assertFailsWith(repository, /missing required field provenance/u);
});

test('missing instructional role fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').selected_records[0].instructional_roles = [];
  assertFailsWith(repository, /instructional_roles/u);
});

test('silent simplified-curriculum selection fails', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const simplified = structuredClone(unit.rejected_duplicate_records.find((record) => record.programme_type === 'simplified_curriculum'));
  simplified.record_id = 'selected-simplified-page';
  delete simplified.rejection_reason;
  unit.selected_records[0] = simplified;
  assertFailsWith(repository, /cannot silently use simplified or unknown programme material/u);
});

test('publisher sequence falsely marked official fails', () => {
  const repository = cloneRepository();
  artifact(repository, 'thematic_unit').grade_allocation.publisher_basis = 'official_exact_grade';
  assertFailsWith(repository, /publisher sequence must remain distinct from official allocation/u);
});

test('verified mapping without course evidence fails', () => {
  const repository = cloneRepository();
  const mapping = artifact(repository, 'thematic_unit').official_curriculum.outcome_mappings[0];
  mapping.coverage_status = 'verified';
  mapping.course_evidence_record_ids = [];
  assertFailsWith(repository, /course_evidence_record_ids/u);
});

test('complete declaration with a missing outcome fails', () => {
  const repository = cloneRepository();
  const unit = artifact(repository, 'thematic_unit');
  const missingId = unit.official_curriculum.outcome_mappings[1].outcome_id;
  unit.official_curriculum.outcome_mappings[1].coverage_status = 'missing';
  unit.coverage_status = 'verified';
  unit.completeness.status = 'complete';
  unit.completeness.declared_complete = true;
  unit.completeness.partial_outcome_ids = [unit.official_curriculum.outcome_mappings[0].outcome_id];
  unit.completeness.missing_outcome_ids = [missingId];
  assertFailsWith(repository, /course cannot be complete while outcomes are partial, missing, or ambiguous/u);
});

test('duplicate topic IDs fail', () => {
  const repository = cloneRepository();
  const topics = artifact(repository, 'topic_inventory').topics;
  topics[1].topic_id = topics[0].topic_id;
  assertFailsWith(repository, /duplicate topic ID/u);
});

test('cover-only book cannot be used as page evidence', () => {
  const repository = cloneRepository();
  const record = artifact(repository, 'thematic_unit').selected_records[0];
  record.record_id = 'cover-only-page';
  record.canonical_url = 'https://www.opiq.ee/Kit/Details/172';
  record.book_id = '5k_loodusõpetus_koolibri_rus';
  record.title = 'Природо­ведение. 5 класс – Opiq';
  record.language = 'ru';
  assertFailsWith(repository, /cover-only book .* cannot be used as page evidence/u);
});
