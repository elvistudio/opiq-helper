import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadCommercialCourseFixtures,
  validateCommercialCourseFixtures,
} from './lib/commercial-course-fixtures.mjs';
import { validateLessonPlanRepository } from './lib/lesson-plans.mjs';

let baseline;

before(async () => {
  baseline = await loadCommercialCourseFixtures();
});

function cloneFixtures() {
  return {
    ...baseline,
    manifest: structuredClone(baseline.manifest),
    lessons: structuredClone(baseline.lessons),
    thematicPlans: structuredClone(baseline.thematicPlans),
    annualCourses: structuredClone(baseline.annualCourses),
  };
}

function lesson(fixtures, index = 0) {
  return fixtures.lessons[index];
}

function customerLesson(fixtures) {
  return fixtures.lessons.find((entry) => entry.opiq_companions[0]?.publication_visibility === 'customer_visible');
}

function familyLesson(fixtures) {
  return fixtures.lessons.find((entry) => entry.family_overlay_hooks.length > 0);
}

function validation(fixtures) {
  return validateCommercialCourseFixtures(fixtures);
}

function errorText(fixtures) {
  return validation(fixtures).diagnostics
    .filter((entry) => entry.severity === 'error')
    .map((entry) => `${entry.file} ${entry.field} ${entry.reason}`)
    .join('\n');
}

function assertFails(fixtures, pattern) {
  const text = errorText(fixtures);
  assert.notEqual(text, '', 'expected commercial validation failure');
  assert.match(text, pattern);
}

test('valid fixture inventory covers four lessons plus thematic and annual aggregates', () => {
  const result = validation(cloneFixtures());
  assert.equal(result.summary.errors, 0, errorText(cloneFixtures()));
  assert.deepEqual(result.summary, {
    lessons: 4,
    thematicPlans: 1,
    annualCourses: 1,
    errors: 0,
  });
});

test('standalone fixture supports zero Opiq evidence and no companions', () => {
  const fixture = baseline.lessons.find((entry) => entry.lesson_id.endsWith('standalone-no-opiq'));
  assert.deepEqual(fixture.evidence_linkage.opiq_records, []);
  assert.deepEqual(fixture.opiq_companions, []);
  assert.equal(fixture.delivery_model.customer_can_complete_without_opiq, true);
});

test('customer-visible companion is optional, checked, licensed, and has an author fallback', () => {
  const companion = customerLesson(baseline).opiq_companions[0];
  assert.equal(companion.access.mode, 'pupil_license');
  assert.equal(companion.publication_visibility, 'customer_visible');
  assert.equal(companion.standalone_fallback.exists, true);
  assert.deepEqual(companion.standalone_fallback.author_material_ids, ['commercial-task-set']);
});

test('unverified companion remains internal-only', () => {
  const fixture = baseline.lessons.find((entry) => entry.opiq_companions[0]?.access.mode === 'unverified');
  assert.equal(fixture.opiq_companions[0].publication_visibility, 'internal_only');
});

test('family fixture exposes Foundation, Grade 2, and Grade 4 hooks without replacing individual evidence', () => {
  const hooks = familyLesson(baseline).family_overlay_hooks;
  assert.deepEqual(
    hooks.flatMap((entry) => entry.supported_lanes).sort(),
    ['foundation', 'grade_2', 'grade_4'],
  );
  assert.ok(hooks.every((entry) => entry.shared_evidence_replaces_individual === false));
});

test('commercial fixture discovery and validation are deterministic', async () => {
  const second = await loadCommercialCourseFixtures();
  assert.deepEqual(
    second.lessons.map((entry) => entry.lesson_id),
    baseline.lessons.map((entry) => entry.lesson_id),
  );
  assert.deepEqual(validation(second), validation(cloneFixtures()));
});

test('legacy production baseline remains byte-compatible in counts and warnings', () => {
  const result = validateLessonPlanRepository(structuredClone(baseline.repository));
  assert.deepEqual(result.summary, {
    profiles: 3,
    lessons: 10,
    units: 2,
    annualCourses: 1,
    annualComponents: 4,
    annualUnits: 10,
    annualSelectedPages: 36,
    externalSources: 0,
    pageReferences: 84,
    errors: 0,
    warnings: 15,
  });
});

test('standalone lesson rejects opiq_required true', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).delivery_model.opiq_required = true;
  assertFails(fixtures, /opiq_required|must be completable without Opiq/u);
});

test('standalone lesson rejects a missing explanation', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).commercial_core.explanation_material_ids = [];
  assertFails(fixtures, /explanation_material_ids|must NOT have fewer than 1 items/u);
});

test('standalone lesson rejects missing tasks', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).commercial_core.task_material_ids = [];
  assertFails(fixtures, /task_material_ids|must NOT have fewer than 1 items/u);
});

test('standalone lesson rejects tasks without answers or exemption', () => {
  const fixtures = cloneFixtures();
  const core = lesson(fixtures).commercial_core;
  core.expected_answer_material_ids = [];
  core.task_contracts[0].expected_answer_material_ids = [];
  assertFails(fixtures, /expected_answer_material_ids|requires expected answers/u);
});

test('procedural task requires a worked solution', () => {
  const fixtures = cloneFixtures();
  const core = lesson(fixtures).commercial_core;
  core.worked_solution_material_ids = [];
  core.task_contracts[0].worked_solution_material_ids = [];
  assertFails(fixtures, /worked_solution_material_ids|requires a worked solution/u);
});

test('companion outside the canonical route fails', () => {
  const fixtures = cloneFixtures();
  customerLesson(fixtures).opiq_companions[0].source_record.canonical_source_id = 'grade-4-science';
  assertFails(fixtures, /canonical route/u);
});

test('companion URL absent from the linked course map fails', () => {
  const fixtures = cloneFixtures();
  const companion = customerLesson(fixtures).opiq_companions[0];
  companion.source_record.canonical_url = 'https://www.opiq.ee/kit/999/chapter/999';
  companion.kit_id = 999;
  companion.chapter_id = 999;
  assertFails(fixtures, /not selected in the linked course map/u);
});

test('customer-visible companion requires access mode', () => {
  const fixtures = cloneFixtures();
  delete customerLesson(fixtures).opiq_companions[0].access.mode;
  assertFails(fixtures, /missing required field mode/u);
});

test('customer-visible companion requires check date', () => {
  const fixtures = cloneFixtures();
  customerLesson(fixtures).opiq_companions[0].access.last_checked_on = null;
  assertFails(fixtures, /requires a valid access-check date/u);
});

test('customer-visible companion requires fallback reference', () => {
  const fixtures = cloneFixtures();
  const fallback = customerLesson(fixtures).opiq_companions[0].standalone_fallback;
  fallback.author_material_ids = [];
  fallback.lesson_stage_refs = [];
  assertFails(fixtures, /requires a standalone fallback reference/u);
});

test('teacher-only companion cannot be customer-visible', () => {
  const fixtures = cloneFixtures();
  customerLesson(fixtures).opiq_companions[0].access.mode = 'teacher_only';
  delete customerLesson(fixtures).opiq_companions[0].access.license_type;
  assertFails(fixtures, /teacher-only companion must remain internal|verified pupil access mode/u);
});

test('unverified companion cannot be customer-visible', () => {
  const fixtures = cloneFixtures();
  const companion = customerLesson(fixtures).opiq_companions[0];
  companion.access.mode = 'unverified';
  delete companion.access.license_type;
  assertFails(fixtures, /unverified companion must remain internal|verified pupil access mode/u);
});

test('unavailable companion cannot be customer-visible', () => {
  const fixtures = cloneFixtures();
  customerLesson(fixtures).opiq_companions[0].access.check_status = 'unavailable';
  assertFails(fixtures, /unavailable or unchecked companion cannot be customer-visible/u);
});

test('licence-required companion requires licence metadata', () => {
  const fixtures = cloneFixtures();
  delete customerLesson(fixtures).opiq_companions[0].access.license_type;
  assertFails(fixtures, /license_type|licence metadata/u);
});

test('simplified companion requires explicit learner-specific opt-in', () => {
  const fixtures = cloneFixtures();
  customerLesson(fixtures).opiq_companions[0].source_record.programme_type = 'simplified_curriculum';
  assertFails(fixtures, /simplified-curriculum companion requires explicit learner-specific opt-in/u);
});

test('teacher-support source cannot become pupil-facing core or companion material', () => {
  const fixtures = cloneFixtures();
  const record = customerLesson(fixtures).opiq_companions[0].source_record;
  record.programme_type = 'teacher_support';
  record.provenance.category = 'opiq_teacher_support';
  assertFails(fixtures, /teacher-support source cannot be customer-visible/u);
});

test('copied or extracted source content cannot be marked author-created', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).originality_review.prohibited_source_content.copied_text = true;
  assertFails(fixtures, /copied_text|must be equal to constant/u);
});

test('publication-ready lesson requires an approved originality review', () => {
  const fixtures = cloneFixtures();
  const fixture = lesson(fixtures);
  fixture.delivery_model.publication_status = 'publication_ready';
  fixture.originality_review.status = 'pending';
  assertFails(fixtures, /publication requires a current approved originality review/u);
});

test('approved originality review requires a content fingerprint', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).originality_review.reviewed_version.content_fingerprint.value = null;
  assertFails(fixtures, /fingerprint is stale/u);
});

test('changed material fingerprint invalidates approved originality review', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).originality_review.reviewed_version.content_fingerprint.value = '0'.repeat(64);
  assertFails(fixtures, /fingerprint is stale/u);
});

test('internal source-analysis references cannot appear in customer materials', () => {
  const fixtures = cloneFixtures();
  lesson(fixtures).originality_review.internal_source_analysis_refs = ['Самостоятельные задания'];
  assertFails(fixtures, /internal source-analysis reference is exposed/u);
});

test('family shared product cannot replace individual evidence', () => {
  const fixtures = cloneFixtures();
  familyLesson(fixtures).family_overlay_hooks[1].shared_evidence_replaces_individual = true;
  assertFails(fixtures, /shared_evidence_replaces_individual|shared family evidence cannot replace/u);
});

test('Grade 2 family lane requires individual evidence', () => {
  const fixtures = cloneFixtures();
  const hook = familyLesson(fixtures).family_overlay_hooks.find((entry) => entry.supported_lanes.includes('grade_2'));
  hook.individual_evidence_required = false;
  assertFails(fixtures, /Grade 2 and Grade 4 family lanes require individual evidence/u);
});

test('Grade 4 family lane requires individual evidence', () => {
  const fixtures = cloneFixtures();
  const hook = familyLesson(fixtures).family_overlay_hooks.find((entry) => entry.supported_lanes.includes('grade_4'));
  hook.individual_evidence_required = false;
  assertFails(fixtures, /Grade 2 and Grade 4 family lanes require individual evidence/u);
});

test('family hook rejects unknown stage or material reference', () => {
  const fixtures = cloneFixtures();
  familyLesson(fixtures).family_overlay_hooks[0].core_refs.stage_ids = ['unknown-stage'];
  assertFails(fixtures, /unknown core reference unknown-stage/u);
});

test('thematic standalone claim fails when one linked lesson is Opiq-dependent', () => {
  const fixtures = cloneFixtures();
  fixtures.lessons[0].delivery_model.opiq_required = true;
  assertFails(fixtures, /thematic standalone summary must equal linked lesson delivery contracts/u);
});

test('annual standalone claim fails when one implemented thematic unit is dependent', () => {
  const fixtures = cloneFixtures();
  fixtures.thematicPlans[0].commercial_core_summary.all_lessons_standalone = false;
  assertFails(fixtures, /annual standalone claim must match every implemented thematic unit/u);
});

test('legacy lesson versions still require at least one Opiq evidence record', () => {
  const repository = structuredClone(baseline.repository);
  const legacy = repository.artifacts.find((entry) => entry.data.artifact_type === 'bilingual_lesson');
  legacy.data.evidence_linkage.opiq_records = [];
  const result = validateLessonPlanRepository(repository);
  const text = result.diagnostics.map((entry) => `${entry.field} ${entry.reason}`).join('\n');
  assert.match(text, /opiq_records.*must NOT have fewer than 1 items/u);
});
