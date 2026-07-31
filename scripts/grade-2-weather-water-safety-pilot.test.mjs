import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  approvedTaskContracts,
  loadGrade2WeatherWaterSafetyPilot,
  pilotPaths,
  validateGrade2WeatherWaterSafetyPilot,
  weatherOutputContract,
} from './lib/grade-2-weather-water-safety-pilot.mjs';
import { checkGeneratedLessons } from './generate-grade-2-weather-water-safety-pilot.mjs';
import { computeTaskFingerprint } from './lib/task-bank.mjs';

let repository;
let validation;

function lesson(position) {
  return repository.lessons[position - 1];
}

function task(taskId) {
  return repository.taskBank.tasks.find((artifact) => artifact.data.task_id === taskId).data;
}

function review(taskId) {
  return repository.taskBank.reviews.find((artifact) => artifact.data.task_id === taskId).data;
}

function entry(taskId) {
  return repository.taskBank.index.data.entries.find((item) => item.task_id === taskId);
}

function material(lessonData, materialId) {
  return lessonData.evidence_linkage.author_materials.find((item) => (
    item.material_id === materialId
  ));
}

function normalized(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

test.before(async () => {
  repository = await loadGrade2WeatherWaterSafetyPilot();
  validation = await validateGrade2WeatherWaterSafetyPilot(repository);
});

test('focused repository contract passes without errors', () => {
  assert.deepEqual(validation.diagnostics, []);
  assert.deepEqual(validation.summary, {
    modules: 1,
    authoredLessons: 2,
    plannedLessons: 2,
    packMaterials: 22,
    approvedTasks: 2,
    errors: 0,
  });
});

test('module identity and programme period remain exact', () => {
  assert.equal(repository.module.project_ref, 'grade-2-project-weather-water-safety');
  assert.equal(repository.module.period_ref, 'programme-period-1');
  assert.equal(repository.module.title_ru, 'Погода, вода и безопасность');
  assert.equal(repository.module.title_et, 'Ilm, vesi ja ohutus');
  const period = repository.calendar.periods.find((item) => item.period_id === 'programme-period-1');
  assert.ok(period.project_ids.includes(repository.module.project_ref));
  assert.equal(
    pilotPaths.moduleSchema,
    'schemas/grade-2-weather-water-safety-pilot.schema.json',
  );
  assert.equal(
    repository.moduleSchema.$id,
    'https://elvistudio.github.io/opiq-helper/schemas/grade-2-weather-water-safety-pilot.schema.json',
  );
  assert.equal(
    repository.moduleSchema.title,
    'Grade 2 weather, water and safety pilot snapshot',
  );
});

test('exactly two lessons are authored and slots 3–4 remain planned', () => {
  const slots = repository.module.lesson_contract.slots;
  assert.equal(repository.lessons.length, 2);
  assert.equal(slots.length, 4);
  assert.deepEqual(slots.map((slot) => slot.status), [
    'authored_internal',
    'authored_internal',
    'planned',
    'planned',
  ]);
  for (const slot of slots.slice(2)) {
    assert.equal(slot.lesson_id, null);
    assert.equal(slot.lesson_path, null);
    assert.equal(slot.content_complete, false);
    assert.equal(slot.release_ready, false);
  }
});

test('all module and lesson readiness remains internal and non-release-ready', () => {
  assert.equal(repository.module.delivery.visibility, 'internal_only');
  assert.equal(repository.module.delivery.publication_status, 'internal_review');
  assert.equal(repository.module.readiness.module_complete, false);
  assert.equal(repository.module.readiness.release_ready, false);
  assert.equal(repository.module.readiness.teacher_approved, false);
  assert.equal(repository.module.readiness.effectiveness_claimed, false);
  for (const lessonData of repository.lessons) {
    assert.equal(lessonData.delivery_model.publication_status, 'internal_review');
    assert.equal(lessonData.artifact_readiness.print_ready, false);
    assert.equal(lessonData.artifact_readiness.classroom_ready, false);
    assert.equal(lessonData.artifact_readiness.teacher_review.status, 'pending');
    assert.equal(lessonData.artifact_readiness.classroom_trial.status, 'not_tested');
  }
});

test('lesson 2 integrates exactly the two approved stable task IDs', () => {
  const ids = approvedTaskContracts.map((contract) => contract.taskId);
  assert.deepEqual(lesson(2).commercial_core.task_material_ids, ids);
  assert.deepEqual(
    lesson(2).commercial_core.task_contracts.map((contract) => contract.task_material_id),
    ids,
  );
  for (const taskId of ids) {
    assert.equal(material(lesson(2), taskId).material_id, taskId);
    assert.ok(lesson(2).originality_review.covered_author_material_ids.includes(taskId));
  }
});

test('task-bank approval set is exactly two approved and ten pending', () => {
  const approved = repository.taskBank.reviews
    .filter((artifact) => artifact.data.status === 'approved')
    .map((artifact) => artifact.data.task_id);
  const pending = repository.taskBank.reviews
    .filter((artifact) => artifact.data.status === 'pending')
    .map((artifact) => artifact.data.task_id);
  assert.deepEqual(approved, approvedTaskContracts.map((contract) => contract.taskId));
  assert.equal(pending.length, 10);
  assert.deepEqual(repository.module.task_bank_integration.pending_task_ids_integrated, []);
  assert.ok(!pending.some((taskId) => lesson(2).commercial_core.task_material_ids.includes(taskId)));
});

test('approved task fingerprints and reviewed task-bearing HEAD are exact', () => {
  for (const contract of approvedTaskContracts) {
    assert.equal(computeTaskFingerprint(task(contract.taskId)).value, contract.fingerprint);
    assert.equal(review(contract.taskId).reviewed_version.content_fingerprint.value, contract.fingerprint);
    assert.equal(entry(contract.taskId).current_fingerprint.value, contract.fingerprint);
    assert.equal(entry(contract.taskId).current_fingerprint_status, 'current_approved');
    assert.equal(review(contract.taskId).reviewed_version.commit_sha, contract.reviewCommit);
  }
});

test('approved reviews preserve real reviewer identity and role', () => {
  for (const contract of approvedTaskContracts) {
    const taskReview = review(contract.taskId);
    assert.equal(taskReview.reviewer, 'astzhalkouski');
    assert.equal(taskReview.reviewer_role, 'Human originality reviewer');
    assert.equal(taskReview.status, 'approved');
  }
  for (const lessonData of repository.lessons) {
    assert.equal(lessonData.originality_review.status, 'pending');
    assert.equal(lessonData.originality_review.reviewer, null);
    assert.equal(lessonData.originality_review.reviewed_on, null);
  }
});

test('learner task renderings preserve the approved customer projections', async () => {
  for (const contract of approvedTaskContracts) {
    const sourceTask = task(contract.taskId);
    const learner = await fs.readFile(contract.learnerPath, 'utf8');
    assert.ok(normalized(learner).includes(normalized(sourceTask.customer_content.prompt)));
    for (const sourceLine of [
      ...sourceTask.customer_content.supplied_materials,
      ...sourceTask.customer_content.supplied_data,
    ]) {
      assert.ok(normalized(learner).includes(normalized(sourceLine)));
    }
  }
});

test('teacher answers do not leak into learner task files', async () => {
  const teacher = await fs.readFile(
    'teacher-packs/grade-2/weather-water-safety/answers/lesson-02-answer-guidance.md',
    'utf8',
  );
  for (const contract of approvedTaskContracts) {
    const learner = await fs.readFile(contract.learnerPath, 'utf8');
    for (const sentinel of contract.answerSentinels) {
      assert.doesNotMatch(normalized(learner), new RegExp(
        normalized(sentinel).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
        'u',
      ));
      assert.ok(normalized(teacher).includes(normalized(sentinel)));
    }
  }
});

test('both lessons are customer-complete without Opiq', () => {
  for (const lessonData of repository.lessons) {
    assert.equal(lessonData.delivery_model.opiq_required, false);
    assert.equal(lessonData.delivery_model.customer_can_complete_without_opiq, true);
    assert.deepEqual(lessonData.evidence_linkage.opiq_records, []);
    assert.deepEqual(lessonData.opiq_companions, []);
  }
});

test('subject and Estonian-language evidence remain separate', () => {
  for (const lessonData of repository.lessons) {
    assert.equal(
      lessonData.methodology.content_language_assessment_policy,
      'separate_content_and_estonian_language_evidence',
    );
    assert.ok(lessonData.assessment.some((criterion) => criterion.affects === 'subject_assessment'));
    assert.ok(lessonData.assessment.some((criterion) => criterion.affects === 'language_assessment'));
    assert.ok(!lessonData.assessment.some((criterion) => criterion.affects === 'both'));
  }
});

test('lesson 1 keeps bounded A1 weather vocabulary and one oral output', () => {
  assert.equal(lesson(1).learner_language_profile.learner_language_level, 'A1');
  assert.deepEqual(
    lesson(1).language_load.new_terms_et.map((term) => term.term_et),
    weatherOutputContract.terms,
  );
  assert.deepEqual(
    lesson(1).language_load.expected_supported_productive_language_et,
    weatherOutputContract.examples,
  );
  assert.deepEqual(
    lesson(1).language_load.expected_independent_productive_language_et,
    [weatherOutputContract.frame],
  );
  assert.equal(
    lesson(1).language_load.sentence_frames[0].frame_id,
    weatherOutputContract.frameId,
  );
  assert.equal(
    lesson(1).language_load.sentence_frames[0].frame_et,
    weatherOutputContract.frame,
  );
  assert.equal(
    lesson(1).language_load.short_expected_oral_answer_et,
    weatherOutputContract.frame,
  );
  assert.equal(lesson(1).questions[0].short_oral_answer_et, weatherOutputContract.frame);
  assert.equal(lesson(1).practical_work.short_estonian_conclusion, weatherOutputContract.frame);
  assert.ok(lesson(1).scaffolds.some((entry) => (
    entry.scaffold_id === weatherOutputContract.scaffoldId
  )));
  assert.equal(lesson(1).objectives.estonian_language_objectives[0].minimum_quantity, 1);
});

test('lesson 1 semantic validator rejects noun substitutions in the productive frame', async (t) => {
  const model = lesson(1).language_load.model_sentences[0];
  const original = model.text_et;
  try {
    for (const rejected of weatherOutputContract.rejectedExamples) {
      await t.test(rejected, async () => {
        model.text_et = rejected;
        const result = await validateGrade2WeatherWaterSafetyPilot(repository);
        assert.ok(result.diagnostics.some((entry) => (
          entry.code === 'PILOT_LANGUAGE_BOUNDS'
        )));
      });
    }
  } finally {
    model.text_et = original;
  }
});

test('lesson 1 preserves window-first supervised observation safety', async () => {
  const safety = normalized(lesson(1).practical_work.safety_requirements);
  assert.match(safety, /закрытое окно/iu);
  assert.match(safety, /непосредственным присмотром/iu);
  assert.match(safety, /дороге, воде/iu);
  const sheet = await fs.readFile(
    'teacher-packs/grade-2/weather-water-safety/student/lesson-01-observation-sheet.md',
    'utf8',
  );
  assert.match(sheet, /через закрытое окно/iu);
  assert.match(sheet, /Сначала заполни свой лист/iu);
});

test('lesson 2 evidence covers precipitation difference and add-then-convert time', async () => {
  const learnerWeather = await fs.readFile(approvedTaskContracts[0].learnerPath, 'utf8');
  const learnerTime = await fs.readFile(approvedTaskContracts[1].learnerPath, 'utf8');
  assert.match(learnerWeather, /самое большое показание/iu);
  assert.match(learnerWeather, /самое маленькое показание/iu);
  assert.match(learnerWeather, /Вычисление разности/iu);
  assert.match(learnerTime, /25 минут/iu);
  assert.match(learnerTime, /35 минут/iu);
  assert.match(learnerTime, /60 минут — 1 час/iu);
});

test('shared product never replaces individual observation, calculation or oral evidence', () => {
  assert.deepEqual(repository.module.shared_product, {
    product: 'weather_board_and_planned_report',
    assembled_from_attributable_individual_work: true,
    individual_observation_required: true,
    individual_calculation_required: true,
    individual_oral_output_required: true,
    shared_evidence_replaces_individual: false,
  });
  assert.match(
    lesson(1).stages.find((stage) => stage.stage_id === 'individual-weather-observation')
      .pupil_action_ru,
    /только затем передаёт/iu,
  );
});

test('planned lesson 3 preserves the physical-education missing-route boundary', () => {
  assert.deepEqual(repository.module.physical_education_boundary, {
    lesson_slot: 3,
    source_status: 'missing_route',
    content_strategy: 'author_created_required',
    lesson_authoring_status: 'planned',
    human_studies_support_bounded: true,
    replacement_by_human_studies_forbidden: true,
  });
  const slot = repository.module.lesson_contract.slots[2];
  assert.ok(slot.planned_focus.some((item) => item.includes('без замены')));
});

test('no supplementary, mixed or simplified route is promoted into the pilot core', () => {
  assert.deepEqual(repository.module.source_routes, [
    'grade-2-science',
    'grade-2-mathematics',
    'grade-2-human-studies',
    'grade-2-russian',
    'grade-2-estonian-second-language',
  ]);
  assert.equal(lesson(1).canonical_route.source_id, 'grade-2-science');
  assert.equal(lesson(2).canonical_route.source_id, 'grade-2-mathematics');
  assert.equal(lesson(1).differentiation.simplified_curriculum_opt_in.enabled, false);
  assert.equal(lesson(2).differentiation.simplified_curriculum_opt_in.enabled, false);
});

test('roadmap truthfully records partial authoring and blocked validation', () => {
  assert.equal(repository.roadmap.status, 'partial_implementation');
  assert.deepEqual(repository.roadmap.implementation_facts, {
    task_bank_status: 'implemented',
    pilot_authoring_status: 'in_progress',
    standalone_commercial_core_status: 'partial',
    authored_lesson_count: 2,
    planned_lesson_count: 2,
    pending_task_originality_review_count: 10,
    companion_access_status: 'unverified_internal_only',
    final_riigi_teataja_refresh_status: 'pending_under_issue_37',
    production_validation_status: 'blocked',
    teacher_review_status: 'pending',
    classroom_trial_status: 'not_tested',
    home_trial_status: 'not_started',
    effectiveness_established: false,
  });
  assert.ok(repository.roadmap.release_blocker_codes.includes('ten_task_originality_reviews_pending'));
  assert.ok(!repository.roadmap.release_blocker_codes.includes('clean_room_task_bank_not_implemented'));
});

test('materials index resolves conventional pack roles with teacher-only answers', () => {
  const indexed = repository.materialsIndex.materials.map((item) => item.material);
  for (const required of [
    'teacher_guide',
    'lesson_guide',
    'rubric',
    'homeschool_guide',
    'answer_key',
  ]) {
    assert.ok(indexed.some((item) => item.material_type === required));
  }
  assert.ok(indexed
    .filter((item) => ['answer_key', 'expected_answers', 'worked_solution'].includes(item.material_type))
    .every((item) => item.audience === 'teacher'));
  const lesson2AnswerKey = repository.materialsIndex.materials.find((entry) => (
    entry.material.material_id === 'g2-weather-water-answer-key'
  ));
  assert.deepEqual(
    lesson2AnswerKey.lesson_ids,
    ['grade-2-weather-water-safety-02-data-time'],
  );
  assert.ok(!lesson2AnswerKey.lesson_ids.includes(
    'grade-2-weather-water-safety-01-observation',
  ));
  assert.deepEqual(repository.materialsIndex.opiq_sources, []);
});

test('focused commands and CI path filters cover the new production slice', () => {
  assert.equal(
    repository.packageJson.scripts['test:grade-2-weather-water-safety-pilot'],
    'node --test scripts/grade-2-weather-water-safety-pilot.test.mjs',
  );
  assert.equal(
    repository.packageJson.scripts['check:grade-2-weather-water-safety-pilot'],
    'node scripts/check-grade-2-weather-water-safety-pilot.mjs',
  );
  for (const required of [
    'lesson-plans/**',
    'teacher-packs/**',
    'grade-programmes/**',
    'schemas/**',
    'npm run test:grade-2-weather-water-safety-pilot',
    'npm run check:grade-2-weather-water-safety-pilot',
  ]) {
    assert.ok(repository.workflowText.includes(required));
  }
});

test('generated lesson and materials-index artifacts are byte-current', async () => {
  assert.deepEqual(await checkGeneratedLessons(), []);
  assert.equal(pilotPaths.module.endsWith('weather-water-safety.yaml'), true);
});
