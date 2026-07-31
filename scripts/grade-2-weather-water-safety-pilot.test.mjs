import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  approvedTaskContracts,
  loadGrade2WeatherWaterSafetyPilot,
  pendingInternalTaskContracts,
  pendingUnintegratedTaskIds,
  pilotPaths,
  validateGrade2WeatherWaterSafetyPilot,
  waterSafetyLanguageContract,
  weatherOutputContract,
  weatherReportLanguageContract,
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
    authoredLessons: 4,
    plannedLessons: 0,
    packMaterials: 39,
    approvedTasks: 2,
    pendingInternalTasks: 4,
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

test('exactly four lessons are internally authored and no slot remains planned', () => {
  const slots = repository.module.lesson_contract.slots;
  assert.equal(repository.lessons.length, 4);
  assert.equal(slots.length, 4);
  assert.deepEqual(slots.map((slot) => slot.status), [
    'authored_internal',
    'authored_internal',
    'authored_internal',
    'authored_internal',
  ]);
  assert.equal(slots[2].lesson_id, 'grade-2-weather-water-safety-03-safe-decisions');
  assert.equal(slots[2].lesson_path, pilotPaths.lesson3);
  assert.equal(slots[2].primary_subject, 'human_studies');
  assert.equal(slots[2].canonical_route_id, 'grade-2-human-studies');
  assert.equal(slots[2].content_complete, true);
  assert.equal(slots[2].release_ready, false);
  assert.equal(slots[3].lesson_id, 'grade-2-weather-water-safety-04-weather-report');
  assert.equal(slots[3].lesson_path, pilotPaths.lesson4);
  assert.equal(slots[3].primary_subject, 'science');
  assert.equal(slots[3].canonical_route_id, 'grade-2-science');
  assert.equal(slots[3].content_complete, true);
  assert.equal(slots[3].release_ready, false);
});

test('lessons 1 through 3 remain byte-stable on the stacked base contract', async () => {
  const expected = new Map([
    [pilotPaths.lesson1, '7b763646147d2a76b0e6770b88008812d15b43d162d4dc16cef23bc5cbf3b879'],
    [pilotPaths.lesson2, '64c74886be109c2dc845b2b90b5163b0632061d97b30a1ed703d1670d450e209'],
    [pilotPaths.lesson3, '2e95c7b6946dbb7f15be0f6d2641b2be90522c3b4f0cee60234e1abb6c4579a4'],
  ]);
  for (const [repositoryPath, fingerprint] of expected) {
    const content = await fs.readFile(repositoryPath);
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'), fingerprint);
  }
});

test('all module and lesson readiness remains internal and non-release-ready', () => {
  assert.equal(repository.module.delivery.visibility, 'internal_only');
  assert.equal(repository.module.delivery.publication_status, 'internal_review');
  assert.equal(repository.module.implementation_status, 'internal_authoring_complete');
  assert.equal(repository.module.readiness.authoring_complete, true);
  assert.equal(repository.module.readiness.module_complete, true);
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
  assert.deepEqual(
    repository.module.task_bank_integration.approved.task_ids,
    approvedTaskContracts.map((contract) => contract.taskId),
  );
  assert.ok(!pending.some((taskId) => (
    repository.module.task_bank_integration.approved.task_ids.includes(taskId)
  )));
});

test('tasks 09 through 12 remain lesson-scoped fingerprint-pinned pending internal integrations', () => {
  const integration = repository.module.task_bank_integration;
  assert.equal(integration.pending_internal.length, 2);
  for (const lessonIndex of [2, 3]) {
    const expectedLesson = lesson(lessonIndex + 1);
    const contracts = pendingInternalTaskContracts.filter((contract) => (
      contract.lessonIndex === lessonIndex
    ));
    const group = integration.pending_internal.find((item) => (
      item.lesson_id === expectedLesson.lesson_id
    ));
    assert.equal(group.publication_unlocks, false);
    assert.equal(group.customer_visibility_unlocks, false);
    assert.deepEqual(
      group.task_fingerprints,
      contracts.map((contract) => ({
        task_id: contract.taskId,
        value: contract.fingerprint,
      })),
    );
  }
  assert.deepEqual(integration.pending_unintegrated_task_ids, pendingUnintegratedTaskIds);
  assert.equal(integration.pending_unintegrated_task_ids.length, 6);
  const pendingIds = integration.pending_internal.flatMap((group) => (
    group.task_fingerprints.map((item) => item.task_id)
  ));
  assert.equal(new Set(pendingIds).size, pendingIds.length);
  assert.ok(pendingIds.every((taskId) => (
    !integration.pending_unintegrated_task_ids.includes(taskId)
    && !integration.approved.task_ids.includes(taskId)
  )));
  for (const contract of pendingInternalTaskContracts) {
    const taskReview = review(contract.taskId);
    assert.equal(computeTaskFingerprint(task(contract.taskId)).value, contract.fingerprint);
    assert.equal(taskReview.status, 'pending');
    assert.equal(taskReview.reviewer, null);
    assert.equal(taskReview.reviewer_role, null);
    assert.equal(taskReview.reviewed_on, null);
    assert.equal(taskReview.reviewed_version.commit_sha, null);
    assert.equal(taskReview.reviewed_version.content_fingerprint.value, contract.fingerprint);
    assert.equal(entry(contract.taskId).current_fingerprint.value, contract.fingerprint);
    assert.equal(entry(contract.taskId).current_fingerprint_status, 'current_pending_review');
  }
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
    assert.equal(lessonData.originality_review.reviewer_role, null);
    assert.equal(lessonData.originality_review.reviewed_on, null);
    assert.equal(lessonData.originality_review.reviewed_version.commit_sha, null);
    assert.equal(
      lessonData.originality_review.reviewed_version.content_fingerprint.value,
      null,
    );
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

test('pending learner renderings preserve projections and exclude answer contracts', async () => {
  const teacherCache = new Map();
  for (const contract of pendingInternalTaskContracts) {
    const teacher = teacherCache.has(contract.teacherPath)
      ? teacherCache.get(contract.teacherPath)
      : await fs.readFile(contract.teacherPath, 'utf8');
    teacherCache.set(contract.teacherPath, teacher);
    const sourceTask = task(contract.taskId);
    const learner = await fs.readFile(contract.learnerPath, 'utf8');
    for (const sourceLine of [
      sourceTask.customer_content.prompt,
      ...sourceTask.customer_content.supplied_materials,
      ...sourceTask.customer_content.supplied_data,
      sourceTask.customer_content.answer_format,
    ]) {
      assert.ok(normalized(learner).includes(normalized(sourceLine)));
    }
    for (const teacherOnly of [
      sourceTask.answer_contract.answer,
      sourceTask.answer_contract.worked_solution,
      ...sourceTask.answer_contract.success_criteria.map((item) => item.description),
      ...sourceTask.answer_contract.acceptable_variants,
      ...sourceTask.answer_contract.common_errors,
      sourceTask.answer_contract.feedback.correct,
      sourceTask.answer_contract.feedback.retry,
    ].filter(Boolean)) {
      assert.ok(!normalized(learner).includes(normalized(teacherOnly)));
    }
    for (const sentinel of contract.answerSentinels) {
      assert.ok(normalized(teacher).includes(normalized(sentinel)));
    }
  }
});

test('all four lessons are customer-complete without Opiq', () => {
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

test('lesson 3 keeps the exact bounded Estonian safety contract', () => {
  const language = lesson(3).language_load;
  assert.deepEqual(language.expected_receptive_language_et, waterSafetyLanguageContract.receptive);
  assert.deepEqual(
    language.expected_supported_productive_language_et,
    [waterSafetyLanguageContract.sentence],
  );
  assert.deepEqual(
    language.expected_independent_productive_language_et,
    [waterSafetyLanguageContract.sentence],
  );
  assert.deepEqual(
    language.model_sentences.map((item) => item.text_et),
    [waterSafetyLanguageContract.sentence],
  );
  assert.deepEqual(
    language.sentence_frames.map((item) => item.frame_et),
    [waterSafetyLanguageContract.sentence],
  );
  assert.equal(language.short_expected_oral_answer_et, waterSafetyLanguageContract.sentence);
  assert.equal(lesson(3).questions[0].short_oral_answer_et, waterSafetyLanguageContract.sentence);
  assert.equal(lesson(3).practical_work.short_estonian_conclusion, waterSafetyLanguageContract.sentence);
  assert.equal(lesson(3).cognitive_load.independent_output_sentences, 1);
});

test('lesson 3 is a 45-minute dry-only sequence with individual work before pairs', () => {
  assert.deepEqual(lesson(3).stages.map((stage) => stage.duration_minutes), [
    4, 8, 5, 6, 6, 6, 4, 4, 2,
  ]);
  const ids = lesson(3).stages.map((stage) => stage.stage_id);
  assert.ok(ids.indexOf('discuss-after-individual-work') > ids.indexOf('attempt-human-studies-task'));
  assert.ok(ids.indexOf('discuss-after-individual-work') > ids.indexOf('attempt-pe-task'));
  assert.equal(
    lesson(3).pedagogical_integration.selection_input.resources.outdoor_access_available,
    false,
  );
  const practical = normalized(JSON.stringify(lesson(3).practical_work));
  assert.match(practical, /только в сухом классе/iu);
  assert.match(practical, /не подходит к реальной воде/iu);
  assert.match(practical, /не отправлять другого ребёнка/iu);
  assert.deepEqual(lesson(3).practical_work.opiq_source_record_ids, []);
});

test('shared product never replaces individual observation, calculation or oral evidence', () => {
  assert.deepEqual(repository.module.shared_product, {
    product: 'weather_board_and_group_report',
    assembled_from_attributable_individual_work: true,
    individual_observation_required: true,
    individual_calculation_required: true,
    individual_oral_output_required: true,
    individual_report_contribution_required: true,
    individual_exit_ticket_required: true,
    report_transfer_requires_personal_code: true,
    shared_evidence_replaces_individual: false,
  });
  assert.match(
    lesson(1).stages.find((stage) => stage.stage_id === 'individual-weather-observation')
      .pupil_action_ru,
    /только затем передаёт/iu,
  );
});

test('authored lesson 3 preserves the physical-education missing-route boundary', () => {
  assert.deepEqual(repository.module.physical_education_boundary, {
    lesson_slot: 3,
    source_status: 'missing_route',
    content_strategy: 'author_created_required',
    lesson_authoring_status: 'authored_internal',
    human_studies_support_bounded: true,
    replacement_by_human_studies_forbidden: true,
  });
  assert.deepEqual(lesson(3).author_created_subject_roles, [{
    subject_id: 'grade-2-author-created-physical-education',
    subject: 'physical_education',
    subject_et: 'kehaline kasvatus',
    official_outcome_ids: ['ee-prk-2026-stage1-physical-education-water-safety'],
    source_status: 'missing_route',
    route_ids: [],
    source_evidence_claimed: false,
    content_strategy: 'author_created_required',
    replacement_by_human_studies_forbidden: true,
    opiq_record_ids: [],
    opiq_urls: [],
  }]);
  assert.equal(lesson(3).canonical_route.source_id, 'grade-2-human-studies');
  assert.deepEqual(
    lesson(3).evidence_linkage.official_outcome_refs,
    ['ee-prk-2026-stage1-human-studies-rights-duties'],
  );
});

test('semantic validation rejects every attempt to turn the PE role into source evidence', async (t) => {
  const role = lesson(3).author_created_subject_roles[0];
  const original = structuredClone(role);
  const mutations = [
    ['human-studies route substitution', (item) => { item.route_ids = ['grade-2-human-studies']; }],
    ['invented source evidence', (item) => { item.source_evidence_claimed = true; }],
    ['removed replacement guard', (item) => { delete item.replacement_by_human_studies_forbidden; }],
    ['invented Opiq URL', (item) => { item.opiq_urls = ['https://www.opiq.ee/Kit/494']; }],
    ['invented md_path', (item) => { item.md_path = 'project-files/outputs/opiq_2klass_inimeseopetus.md'; }],
  ];
  try {
    for (const [name, mutate] of mutations) {
      await t.test(name, async () => {
        Object.keys(role).forEach((key) => delete role[key]);
        Object.assign(role, structuredClone(original));
        mutate(role);
        const result = await validateGrade2WeatherWaterSafetyPilot(repository);
        assert.ok(result.diagnostics.some((item) => (
          item.code === 'PILOT_PE_ROLE'
          || item.code === 'PILOT_PLAN_REPOSITORY'
        )));
      });
    }
  } finally {
    Object.keys(role).forEach((key) => delete role[key]);
    Object.assign(role, original);
  }
});

test('semantic validation rejects removal of the exact lesson 3 PE role', async () => {
  const original = lesson(3).author_created_subject_roles;
  try {
    lesson(3).author_created_subject_roles = [];
    const result = await validateGrade2WeatherWaterSafetyPilot(repository);
    assert.ok(result.diagnostics.some((item) => (
      item.code === 'PILOT_PE_ROLE'
      || item.code === 'PILOT_PLAN_REPOSITORY'
    )));
  } finally {
    lesson(3).author_created_subject_roles = original;
  }
});

test('pending integrations cannot unlock publication or customer visibility', async (t) => {
  const cases = [
    {
      name: 'lesson publication',
      target: lesson(3).delivery_model,
      field: 'publication_status',
      value: 'publication_ready',
    },
    {
      name: 'module publication',
      target: repository.module.delivery,
      field: 'publication_status',
      value: 'publication_ready',
    },
    {
      name: 'module customer visibility',
      target: repository.module.delivery,
      field: 'visibility',
      value: 'customer_visible',
    },
    {
      name: 'lesson 3 pending publication unlock',
      target: repository.module.task_bank_integration.pending_internal[0],
      field: 'publication_unlocks',
      value: true,
    },
    {
      name: 'lesson 4 pending visibility unlock',
      target: repository.module.task_bank_integration.pending_internal[1],
      field: 'customer_visibility_unlocks',
      value: true,
    },
  ];
  for (const mutation of cases) {
    await t.test(mutation.name, async () => {
      const original = mutation.target[mutation.field];
      try {
        mutation.target[mutation.field] = mutation.value;
        const result = await validateGrade2WeatherWaterSafetyPilot(repository);
        assert.ok(result.diagnostics.length > 0);
        assert.ok(result.diagnostics.some((item) => (
          item.code === 'PILOT_STANDALONE'
          || item.code === 'PILOT_MODULE_SCHEMA'
          || item.code === 'PILOT_PENDING_INTERNAL_DECLARATION'
        )));
      } finally {
        mutation.target[mutation.field] = original;
      }
    });
  }
});

test('dry-safety validator rejects an active water or rescue pupil step', async () => {
  const steps = lesson(3).practical_work.pupil_steps;
  steps.push('Войти в воду и поплыть за предметом.');
  try {
    const result = await validateGrade2WeatherWaterSafetyPilot(repository);
    assert.ok(result.diagnostics.some((item) => item.code === 'PILOT_LESSON_3_DRY_SAFETY'));
  } finally {
    steps.pop();
  }
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
  assert.equal(lesson(3).canonical_route.source_id, 'grade-2-human-studies');
  assert.equal(lesson(4).canonical_route.source_id, 'grade-2-science');
  assert.equal(lesson(1).differentiation.simplified_curriculum_opt_in.enabled, false);
  assert.equal(lesson(2).differentiation.simplified_curriculum_opt_in.enabled, false);
  assert.equal(lesson(3).differentiation.simplified_curriculum_opt_in.enabled, false);
  assert.equal(lesson(4).differentiation.simplified_curriculum_opt_in.enabled, false);
});

test('roadmap truthfully records complete internal authoring and blocked validation', () => {
  assert.equal(repository.roadmap.status, 'partial_implementation');
  assert.deepEqual(repository.roadmap.implementation_facts, {
    task_bank_status: 'implemented',
    pilot_authoring_status: 'internal_authoring_complete',
    standalone_commercial_core_status: 'authored_internal',
    authored_lesson_count: 4,
    planned_lesson_count: 0,
    pending_task_internal_integration_count: 4,
    pending_task_unintegrated_count: 6,
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
  assert.ok(repository.roadmap.release_blocker_codes.includes(
    'standalone_commercial_core_internal_authoring_complete_not_release_ready',
  ));
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

test('lesson 4 has the exact science identity without promoted task outcomes', () => {
  const lessonData = lesson(4);
  assert.equal(lessonData.lesson_id, 'grade-2-weather-water-safety-04-weather-report');
  assert.equal(lessonData.position_in_unit, 4);
  assert.equal(lessonData.title_ru, 'Наш отчёт о погоде и итог модуля');
  assert.equal(lessonData.title_et, 'Meie ilmateade ja mooduli kokkuvõte');
  assert.equal(lessonData.subject, 'science');
  assert.equal(lessonData.canonical_route.source_id, 'grade-2-science');
  assert.deepEqual(
    lessonData.evidence_linkage.official_outcome_refs,
    ['ee-prk-2026-stage1-natural-science-guided-inquiry'],
  );
  assert.ok(lessonData.objectives.content_objectives.every((objective) => (
    objective.curriculum_outcome_refs.length === 1
    && objective.curriculum_outcome_refs[0]
      === 'ee-prk-2026-stage1-natural-science-guided-inquiry'
  )));
  assert.doesNotMatch(
    JSON.stringify({
      evidence: lessonData.evidence_linkage,
      objectives: lessonData.objectives,
    }),
    /cross-curricular|mathematics-real-life|assessment-formative/iu,
  );
});

test('lesson 4 keeps the exact 45-minute individual-before-group sequence', () => {
  assert.deepEqual(lesson(4).stages.map((stage) => stage.duration_minutes), [
    5, 6, 5, 8, 3, 6, 6, 3, 3,
  ]);
  assert.deepEqual(lesson(4).stages.map((stage) => stage.stage_id), [
    'retrieve-module-evidence',
    'explain-evidence-report-ru',
    'check-four-point-data',
    'draft-individual-contribution',
    'verify-attribution-code',
    'assemble-shared-weather-report',
    'complete-individual-exit-ticket',
    'check-estonian-output-separately',
    'reflect-and-handoff-evidence',
  ]);
  assert.equal(lesson(4).practical_work, null);
});

test('lesson 4 keeps one exact bounded Estonian output', () => {
  const language = lesson(4).language_load;
  assert.deepEqual(language.expected_receptive_language_et, weatherReportLanguageContract.receptive);
  assert.deepEqual(
    language.expected_supported_productive_language_et,
    [weatherReportLanguageContract.sentence],
  );
  assert.deepEqual(
    language.expected_independent_productive_language_et,
    [weatherReportLanguageContract.sentence],
  );
  assert.deepEqual(
    language.model_sentences.map((item) => item.text_et),
    [weatherReportLanguageContract.sentence],
  );
  assert.deepEqual(
    language.sentence_frames.map((item) => item.frame_et),
    [weatherReportLanguageContract.frame],
  );
  assert.equal(language.short_expected_oral_answer_et, weatherReportLanguageContract.sentence);
  assert.equal(lesson(4).questions[0].short_oral_answer_et, weatherReportLanguageContract.sentence);
  assert.equal(lesson(4).cognitive_load.independent_output_sentences, 1);
});

test('lesson 4 integrates open task 11 and closed task 12 without changing review state', () => {
  const contracts = lesson(4).commercial_core.task_contracts;
  assert.deepEqual(
    contracts.map((item) => item.task_material_id),
    ['g2-shared-weather-report-contribution-task', 'g2-weather-exit-ticket-task'],
  );
  assert.equal(contracts[0].response_mode, 'open_ended');
  assert.equal(contracts[0].open_ended, true);
  assert.ok(contracts[0].open_ended_exemption.reason.length > 10);
  assert.equal(contracts[1].response_mode, 'short_answer');
  assert.equal(contracts[1].open_ended, false);
  assert.deepEqual(
    contracts[1].expected_answer_material_ids,
    ['g2-weather-exit-ticket-expected-answers'],
  );
  for (const taskId of [
    'g2-shared-weather-report-contribution-task',
    'g2-weather-exit-ticket-task',
  ]) {
    assert.equal(review(taskId).status, 'pending');
    assert.equal(review(taskId).reviewer, null);
    assert.equal(review(taskId).reviewer_role, null);
    assert.equal(review(taskId).reviewed_on, null);
    assert.equal(review(taskId).reviewed_version.commit_sha, null);
  }
});

test('lesson 4 learner task projections keep exact data and no teacher answer', async () => {
  const contribution = await fs.readFile(
    'teacher-packs/grade-2/weather-water-safety/student/g2-shared-weather-report-contribution-task.md',
    'utf8',
  );
  for (const value of ['Северная точка — 8 °C.', 'Восточная точка — 12 °C.', 'Южная точка — 15 °C.', 'Западная точка — 10 °C.']) {
    assert.ok(contribution.includes(value));
  }
  assert.match(contribution, /Личный код/iu);
  assert.match(contribution, /Только потом группа переносит идеи/iu);
  const exit = await fs.readFile(
    'teacher-packs/grade-2/weather-water-safety/student/g2-weather-exit-ticket-task.md',
    'utf8',
  );
  assert.match(exit, /09:00 было 7 °C/iu);
  assert.match(exit, /13:00 было 14 °C/iu);
  assert.match(exit, /В 13:00 было холоднее/iu);
  assert.ok(exit.includes(weatherReportLanguageContract.frame));
  assert.match(exit, /soojem \| külmem/u);
  assert.ok(!exit.includes(weatherReportLanguageContract.sentence));
  assert.match(exit, /Три пронумерованных коротких ответа/iu);
  assert.match(exit, /1\. Вывод по данным:/u);
  assert.match(exit, /2\. Исправление и способ проверки:/u);
  assert.match(exit, /3\. `Kell 13 on ____\.`/u);
});

test('lesson 4 answer access follows both individual first attempts', () => {
  const contributionBinding = lesson(4).pedagogical_integration.phase_bindings.find((item) => (
    item.dna_phase_id === 'draft-individual-contribution'
  ));
  const exitBinding = lesson(4).pedagogical_integration.phase_bindings.find((item) => (
    item.dna_phase_id === 'complete-individual-exit-ticket'
  ));
  for (const binding of [contributionBinding, exitBinding]) {
    assert.equal(binding.source_access_policy, 'closed_first_attempt');
    assert.equal(binding.render_contract.answer_access_policy, 'after_first_attempt');
  }
  assert.deepEqual(
    contributionBinding.answer_key_material_ids,
    ['g2-shared-weather-report-success-guidance'],
  );
  assert.deepEqual(
    exitBinding.answer_key_material_ids,
    ['g2-weather-exit-ticket-expected-answers'],
  );
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
