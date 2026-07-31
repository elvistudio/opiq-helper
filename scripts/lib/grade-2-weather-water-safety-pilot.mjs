import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lesson-plans.mjs';
import {
  computeTaskFingerprint,
  loadTaskBankRepository,
  validateTaskBankRepository,
} from './task-bank.mjs';
import { checkGeneratedLessons } from '../generate-grade-2-weather-water-safety-pilot.mjs';

export const pilotPaths = Object.freeze({
  module: 'grade-programmes/grade-2/pilot-modules/weather-water-safety.yaml',
  moduleSchema: 'schemas/grade-2-weather-water-safety-pilot.schema.json',
  lesson1: 'lesson-plans/grade-2/weather-water-safety/lesson-01-weather-observation.yaml',
  lesson2: 'lesson-plans/grade-2/weather-water-safety/lesson-02-weather-data-time.yaml',
  lesson3: 'lesson-plans/grade-2/weather-water-safety/lesson-03-safe-decisions.yaml',
  lesson4: 'lesson-plans/grade-2/weather-water-safety/lesson-04-weather-report.yaml',
  materialsIndex: 'teacher-packs/grade-2/weather-water-safety/materials-index.yaml',
  roadmap: 'grade-programmes/grade-2/implementation-roadmap.yaml',
  calendar: 'grade-programmes/grade-2/teaching-calendar.yaml',
  packageJson: 'package.json',
  workflow: '.github/workflows/validate-source-manifest.yml',
});

export const weatherOutputContract = Object.freeze({
  frameId: 'weather-description-frame',
  scaffoldId: 'weather-description-sentence-frame',
  frame: 'Täna on ___ ilm.',
  terms: Object.freeze(['ilm', 'vihmane', 'tuuline', 'pilvine', 'päikeseline']),
  choices: Object.freeze(['vihmane', 'tuuline', 'pilvine', 'päikeseline']),
  examples: Object.freeze([
    'Täna on vihmane ilm.',
    'Täna on tuuline ilm.',
    'Täna on pilvine ilm.',
    'Täna on päikeseline ilm.',
  ]),
  rejectedExamples: Object.freeze([
    'Täna on tuul.',
    'Täna on pilv.',
    'Täna on päike.',
    'Täna on vihm.',
  ]),
});

export const approvedTaskContracts = Object.freeze([
  {
    taskId: 'g2-weather-data-comparison-task',
    fingerprint: 'c7b5daf520966d4d3dc04cd41837ff2c765c1f7fb80f657f8f69edc59575d218',
    reviewCommit: 'a450745bbd382c4758d7cbc96f998b27db76288e',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-weather-data-comparison-task.md',
    answerSentinels: [
      '28 − 13 = 15',
      'Больше всего осадков выпало во вторник',
    ],
  },
  {
    taskId: 'g2-time-measurement-problem-task',
    fingerprint: '89f2c46a08367b02aefdde67191a3b3a3ecad93f86c293d887d8a7a42984d0c9',
    reviewCommit: 'a450745bbd382c4758d7cbc96f998b27db76288e',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-time-measurement-problem-task.md',
    answerSentinels: [
      '25 + 35 = 60',
      'Вся работа заняла 60 минут',
    ],
  },
]);

export const pendingInternalTaskContracts = Object.freeze([
  {
    taskId: 'g2-water-edge-safe-decision-task',
    lessonIndex: 2,
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-03-safe-decisions.yaml',
    fingerprint: 'a9fa9e4c5d80cc5de79c886e82e19a79eb2042a679b1a5db96ae0f85ba40cee3',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-water-edge-safe-decision-task.md',
    teacherPath: 'teacher-packs/grade-2/weather-water-safety/answers/lesson-03-answer-guidance.md',
    answerSentinels: [
      'B. Нужно остаться на дорожке и позвать взрослого: так ребёнок не приближается к воде, а взрослый может безопасно решить проблему.',
      'Выбран вариант B с обращением к взрослому.',
      'Ты сохранил(а) безопасную дистанцию и передал(а) решение взрослому.',
    ],
  },
  {
    taskId: 'g2-pe-water-safety-decision-task',
    lessonIndex: 2,
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-03-safe-decisions.yaml',
    fingerprint: '1d81778b9e7767e1b239b65b28e5ead76bb05ee08c4756f03777d13b7695c922',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-pe-water-safety-decision-task.md',
    teacherPath: 'teacher-packs/grade-2/weather-water-safety/answers/lesson-03-answer-guidance.md',
    answerSentinels: [
      'B. Нужно остаться внутри безопасной зоны и сообщить взрослому: ребёнок не приближается к опасности, а решение принимает ответственный взрослый.',
      'Выбран вариант B без входа за границу безопасной зоны.',
      'Безопасность важнее мяча: ты остаёшься в зоне и обращаешься к взрослому.',
    ],
  },
  {
    taskId: 'g2-shared-weather-report-contribution-task',
    lessonIndex: 3,
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-04-weather-report.yaml',
    fingerprint: '303d0dc6c06e02f2aef83c38ed9fb024b1e89e00aa43195451c1645d851b90c0',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-shared-weather-report-contribution-task.md',
    teacherPath: 'teacher-packs/grade-2/weather-water-safety/answers/lesson-04-answer-guidance.md',
    answerSentinels: [
      'Первое предложение точно передаёт одно значение и его точку.',
      'Второе предложение сравнивает минимум два значения без ошибки.',
      'Обе фразы и личный код находятся в отдельной рамке ученика.',
      'Единственного ответа нет.',
    ],
  },
  {
    taskId: 'g2-weather-exit-ticket-task',
    lessonIndex: 3,
    lessonPath: 'lesson-plans/grade-2/weather-water-safety/lesson-04-weather-report.yaml',
    fingerprint: 'b72ab93feeda22c38dce62e6b3c2c74c5500194f32e5ba8c0df2c63cf2ab3bc1',
    learnerPath: 'teacher-packs/grade-2/weather-water-safety/student/g2-weather-exit-ticket-task.md',
    teacherPath: 'teacher-packs/grade-2/weather-water-safety/answers/lesson-04-answer-guidance.md',
    answerSentinels: [
      '1) В 13:00 было теплее на 7 °C. 2) Верно: «В 13:00 было теплее»; я сравнил(а) 14 и 7. 3) Kell 13 on soojem.',
      'Вывод верно сравнивает 14 °C и 7 °C.',
      'Неверная запись исправлена и назван способ проверки.',
      'Отдельная эстонская рамка завершена словом soojem.',
    ],
  },
]);

export const pendingUnintegratedTaskIds = Object.freeze([
  'g2-weather-observation-conclusion-task',
  'g2-weather-table-interpretation-task',
  'g2-weather-message-main-point-task',
  'g2-weather-instruction-sequence-task',
  'g2-estonian-follow-instruction-task',
  'g2-estonian-safety-phrase-task',
]);

export const waterSafetyLanguageContract = Object.freeze({
  sentence: 'Ma kutsun täiskasvanu.',
  receptive: Object.freeze([
    'Jää ohutusse kohta.',
    'Kutsu täiskasvanu.',
    'Ära mine vette.',
  ]),
});

export const weatherReportLanguageContract = Object.freeze({
  frameId: 'weather-exit-warmer-frame',
  frame: 'Kell 13 on ____.',
  sentence: 'Kell 13 on soojem.',
  choices: Object.freeze(['soojem', 'külmem']),
  receptive: Object.freeze(['soojem', 'külmem', 'kell']),
});

const exactRoutes = Object.freeze([
  'grade-2-science',
  'grade-2-mathematics',
  'grade-2-human-studies',
  'grade-2-russian',
  'grade-2-estonian-second-language',
]);

function byteSort(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function sameSet(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function normalize(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase();
}

function diagnostic(diagnostics, code, file, field, reason) {
  diagnostics.push({ severity: 'error', code, file, field, reason });
}

async function readText(rootDir, repositoryPath) {
  return fs.readFile(safeRepositoryPath(rootDir, repositoryPath, repositoryPath), 'utf8');
}

async function readYaml(rootDir, repositoryPath) {
  return parseStrictCurriculumYaml(
    await readText(rootDir, repositoryPath),
    repositoryPath,
  );
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await readText(rootDir, repositoryPath));
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') {
    return `missing required field ${error.params.missingProperty}`;
  }
  return error.message ?? `failed ${error.keyword}`;
}

function addSchemaDiagnostics(diagnostics, validator, data, file, prefix) {
  if (validator(data)) return;
  for (const error of validator.errors ?? []) {
    diagnostic(
      diagnostics,
      `${prefix}_SCHEMA`,
      file,
      error.instancePath || '/',
      schemaReason(error),
    );
  }
}

function taskArtifact(repository, taskId) {
  return repository.tasks.find((artifact) => artifact.data.task_id === taskId);
}

function reviewArtifact(repository, taskId) {
  return repository.reviews.find((artifact) => artifact.data.task_id === taskId);
}

function indexEntry(repository, taskId) {
  return repository.index.data.entries.find((entry) => entry.task_id === taskId);
}

function materialById(lesson, materialId) {
  return lesson.evidence_linkage.author_materials.find((entry) => (
    entry.material_id === materialId
  ));
}

function allPackPaths(index) {
  return [...new Set((index.materials ?? []).flatMap((entry) => [
    entry.material?.artifact_path,
    entry.material?.answer_key_path,
  ].filter(Boolean)))];
}

function validateModuleContract(diagnostics, repository) {
  const { module, calendar, lessons } = repository;
  const slots = module.lesson_contract?.slots ?? [];
  const authored = slots.filter((slot) => slot.status === 'authored_internal');
  const planned = slots.filter((slot) => slot.status === 'planned');
  if (module.period_ref !== 'programme-period-1') {
    diagnostic(diagnostics, 'PILOT_PERIOD', pilotPaths.module, '/period_ref', 'expected programme-period-1');
  }
  const period = calendar.periods?.find((entry) => entry.period_id === module.period_ref);
  if (!period?.project_ids?.includes(module.project_ref)) {
    diagnostic(diagnostics, 'PILOT_CALENDAR', pilotPaths.calendar, '/periods', 'pilot project is not scheduled in programme-period-1');
  }
  if (slots.length !== 4
      || authored.length !== 4
      || planned.length !== 0
      || module.lesson_contract.total_slots !== 4
      || module.lesson_contract.authored_lesson_count !== 4
      || module.lesson_contract.planned_lesson_count !== 0
      || module.implementation_status !== 'internal_authoring_complete') {
    diagnostic(diagnostics, 'PILOT_SLOT_COUNT', pilotPaths.module, '/lesson_contract', 'expected exactly four authored and zero planned slots with internal authoring complete');
  }
  if (slots.some((slot, index) => slot.position !== index + 1)) {
    diagnostic(diagnostics, 'PILOT_SLOT_ORDER', pilotPaths.module, '/lesson_contract/slots', 'lesson positions must be 1 through 4');
  }
  const expectedLessonIds = new Set(lessons.map((lesson) => lesson.lesson_id));
  if (!sameSet(authored.map((slot) => slot.lesson_id), expectedLessonIds)) {
    diagnostic(diagnostics, 'PILOT_LESSON_LINKS', pilotPaths.module, '/lesson_contract/slots', 'authored slots must exactly link lesson artifacts 1 through 4');
  }
  const lesson3Slot = slots[2];
  if (lesson3Slot?.lesson_id !== 'grade-2-weather-water-safety-03-safe-decisions'
      || lesson3Slot?.lesson_path !== pilotPaths.lesson3
      || lesson3Slot?.primary_subject !== 'human_studies'
      || lesson3Slot?.canonical_route_id !== 'grade-2-human-studies'
      || lesson3Slot?.release_ready !== false) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_SLOT', pilotPaths.module, '/lesson_contract/slots/2', 'lesson 3 slot must be the authored internal human-studies lesson and remain non-release-ready');
  }
  const lesson4Slot = slots[3];
  if (lesson4Slot?.lesson_id !== 'grade-2-weather-water-safety-04-weather-report'
      || lesson4Slot?.lesson_path !== pilotPaths.lesson4
      || lesson4Slot?.title_ru !== 'Наш отчёт о погоде и итог модуля'
      || lesson4Slot?.title_et !== 'Meie ilmateade ja mooduli kokkuvõte'
      || lesson4Slot?.primary_subject !== 'science'
      || lesson4Slot?.canonical_route_id !== 'grade-2-science'
      || lesson4Slot?.content_complete !== true
      || lesson4Slot?.release_ready !== false) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_SLOT', pilotPaths.module, '/lesson_contract/slots/3', 'lesson 4 slot must be the exact authored internal science lesson and remain non-release-ready');
  }
  if (module.readiness?.authoring_complete !== true
      || module.readiness?.module_complete !== true
      || module.readiness?.release_ready !== false
      || module.readiness?.teacher_approved !== false
      || module.readiness?.classroom_trial !== 'not_tested'
      || module.readiness?.home_trial !== 'not_started'
      || module.readiness?.effectiveness_claimed !== false) {
    diagnostic(diagnostics, 'PILOT_MODULE_READINESS', pilotPaths.module, '/readiness', 'authoring and module content must be complete while every release, review, trial, and effectiveness claim remains blocked');
  }
  if (!sameSet(module.source_routes, exactRoutes)) {
    diagnostic(diagnostics, 'PILOT_ROUTE_SCOPE', pilotPaths.module, '/source_routes', 'module must retain only the five registered Grade 2 routes');
  }
}

function validateLessonContracts(diagnostics, repository) {
  const [lesson1, lesson2, lesson3, lesson4] = repository.lessons;
  for (const [index, lesson] of repository.lessons.entries()) {
    const file = [pilotPaths.lesson1, pilotPaths.lesson2, pilotPaths.lesson3, pilotPaths.lesson4][index];
    if (lesson.grade !== 2 || lesson.unit_ref !== repository.module.module_id) {
      diagnostic(diagnostics, 'PILOT_LESSON_IDENTITY', file, '/', 'lesson must be Grade 2 and link the pilot module');
    }
    if (lesson.delivery_model?.opiq_required !== false
        || lesson.delivery_model?.customer_can_complete_without_opiq !== true
        || lesson.delivery_model?.publication_status !== 'internal_review'
        || (lesson.evidence_linkage?.opiq_records ?? []).length !== 0
        || (lesson.opiq_companions ?? []).length !== 0) {
      diagnostic(diagnostics, 'PILOT_STANDALONE', file, '/delivery_model', 'lesson must remain standalone, internal, and Opiq-free');
    }
    if (lesson.artifact_readiness?.classroom_ready !== false
        || lesson.artifact_readiness?.teacher_review?.status !== 'pending'
        || lesson.artifact_readiness?.classroom_trial?.status !== 'not_tested'
        || lesson.pedagogical_integration?.status?.effectiveness_claimed !== false) {
      diagnostic(diagnostics, 'PILOT_READINESS', file, '/artifact_readiness', 'lesson readiness must remain pending and untested');
    }
    const subjectCriteria = (lesson.assessment ?? []).filter((entry) => entry.affects === 'subject_assessment');
    const languageCriteria = (lesson.assessment ?? []).filter((entry) => entry.affects === 'language_assessment');
    if (subjectCriteria.length === 0 || languageCriteria.length === 0
        || lesson.methodology?.content_language_assessment_policy
          !== 'separate_content_and_estonian_language_evidence') {
      diagnostic(diagnostics, 'PILOT_EVIDENCE_SEPARATION', file, '/assessment', 'subject and Estonian evidence must remain separate');
    }
    if (lesson.originality_review?.status !== 'pending'
        || lesson.originality_review?.reviewer !== null
        || lesson.originality_review?.reviewer_role !== null
        || lesson.originality_review?.reviewed_on !== null
        || lesson.originality_review?.reviewed_version?.commit_sha !== null
        || lesson.originality_review?.reviewed_version?.content_fingerprint?.value !== null) {
      diagnostic(diagnostics, 'PILOT_LESSON_ORIGINALITY', file, '/originality_review', 'lesson-level originality review must remain pending without invented identity');
    }
  }
  if (lesson1.learner_language_profile?.learner_language_level !== 'A1'
      || lesson2.learner_language_profile?.learner_language_level !== 'A1-A2'
      || lesson3.learner_language_profile?.learner_language_level !== 'A1-A2'
      || lesson4.learner_language_profile?.learner_language_level !== 'A1') {
    diagnostic(diagnostics, 'PILOT_LANGUAGE_LEVEL', 'lesson-plans/grade-2/weather-water-safety', '/learner_language_profile', 'expected A1 for lessons 1 and 4 and A1-A2 for lessons 2–3');
  }
  const lesson1Terms = lesson1.language_load?.new_terms_et?.map((entry) => entry.term_et);
  const lesson1Frame = lesson1.language_load?.sentence_frames?.find((entry) => (
    entry.frame_id === weatherOutputContract.frameId
  ));
  const lesson1Model = lesson1.language_load?.model_sentences?.[0];
  const lesson1Serialized = JSON.stringify(lesson1);
  if (JSON.stringify(lesson1Terms) !== JSON.stringify(weatherOutputContract.terms)
      || lesson1Frame?.frame_et !== weatherOutputContract.frame
      || lesson1.language_load?.sentence_frames?.length !== 1
      || lesson1Model?.text_et !== 'Täna on tuuline ilm.'
      || !sameSet(lesson1Model?.terms_et, ['ilm', 'tuuline'])
      || JSON.stringify(lesson1.language_load?.expected_supported_productive_language_et)
        !== JSON.stringify(weatherOutputContract.examples)
      || JSON.stringify(lesson1.language_load?.expected_independent_productive_language_et)
        !== JSON.stringify([weatherOutputContract.frame])
      || lesson1.language_load?.short_expected_oral_answer_et !== weatherOutputContract.frame
      || JSON.stringify(lesson1.language_load?.oral_output_terms_et)
        !== JSON.stringify(weatherOutputContract.terms)
      || lesson1.questions?.[0]?.short_oral_answer_et !== weatherOutputContract.frame
      || lesson1.practical_work?.short_estonian_conclusion !== weatherOutputContract.frame
      || !lesson1.scaffolds?.some((entry) => (
        entry.scaffold_id === weatherOutputContract.scaffoldId
      ))
      || weatherOutputContract.rejectedExamples.some((example) => (
        lesson1Serialized.includes(example)
      ))) {
    diagnostic(
      diagnostics,
      'PILOT_LANGUAGE_BOUNDS',
      pilotPaths.lesson1,
      '/language_load',
      'lesson 1 must retain the exact five-term A1 weather-description contract and one short Täna on ___ ilm. output',
    );
  }
  if (lesson1.practical_work?.opiq_source_record_ids?.length !== 0
      || !normalize(lesson1.practical_work?.safety_requirements).match(/закрытое окно/iu)
      || !normalize(lesson1.practical_work?.safety_requirements).match(/присмотр/iu)) {
    diagnostic(diagnostics, 'PILOT_SAFETY', pilotPaths.lesson1, '/practical_work', 'lesson 1 requires window-first and supervised-outdoor safety with no Opiq source');
  }
  const taskIds = approvedTaskContracts.map((entry) => entry.taskId);
  if (!sameSet(lesson2.commercial_core?.task_material_ids, taskIds)
      || !sameSet(
        lesson2.commercial_core?.task_contracts?.map((entry) => entry.task_material_id),
        taskIds,
      )) {
    diagnostic(diagnostics, 'PILOT_TASK_IDS', pilotPaths.lesson2, '/commercial_core', 'lesson 2 must integrate exactly the two approved task IDs');
  }
  for (const taskId of taskIds) {
    if (!materialById(lesson2, taskId)
        || !lesson2.originality_review?.covered_author_material_ids?.includes(taskId)) {
      diagnostic(diagnostics, 'PILOT_TASK_STABLE_REFS', pilotPaths.lesson2, '/evidence_linkage', `${taskId} is missing from a required stable reference`);
    }
  }
  const lesson3TaskIds = pendingInternalTaskContracts
    .filter((entry) => entry.lessonIndex === 2)
    .map((entry) => entry.taskId);
  const peRole = lesson3.author_created_subject_roles?.[0];
  const lesson3ObjectiveOutcomes = lesson3.objectives?.content_objectives
    ?.flatMap((entry) => entry.curriculum_outcome_refs ?? []);
  if (lesson3.lesson_id !== 'grade-2-weather-water-safety-03-safe-decisions'
      || lesson3.position_in_unit !== 3
      || lesson3.subject !== 'human_studies'
      || lesson3.subject_et !== 'inimeseõpetus'
      || lesson3.canonical_route?.source_id !== 'grade-2-human-studies'
      || lesson3.canonical_route?.md_path !== 'project-files/outputs/opiq_2klass_inimeseopetus.md'
      || lesson3.canonical_route?.qa_path !== 'project-files/outputs/opiq_2klass_inimeseopetus_qa.json'
      || JSON.stringify(lesson3.evidence_linkage?.official_outcome_refs)
        !== JSON.stringify(['ee-prk-2026-stage1-human-studies-rights-duties'])
      || !sameSet(lesson3ObjectiveOutcomes, [
        'ee-prk-2026-stage1-human-studies-rights-duties',
        'ee-prk-2026-stage1-physical-education-water-safety',
      ])) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_IDENTITY', pilotPaths.lesson3, '/', 'lesson 3 must use the Grade 2 human-studies route for only the human-studies outcome and carry the PE outcome separately');
  }
  if (lesson3.author_created_subject_roles?.length !== 1
      || peRole?.subject_id !== 'grade-2-author-created-physical-education'
      || peRole?.subject !== 'physical_education'
      || peRole?.subject_et !== 'kehaline kasvatus'
      || JSON.stringify(peRole?.official_outcome_ids)
        !== JSON.stringify(['ee-prk-2026-stage1-physical-education-water-safety'])
      || peRole?.source_status !== 'missing_route'
      || peRole?.content_strategy !== 'author_created_required'
      || peRole?.source_evidence_claimed !== false
      || peRole?.replacement_by_human_studies_forbidden !== true
      || peRole?.route_ids?.length !== 0
      || peRole?.opiq_record_ids?.length !== 0
      || peRole?.opiq_urls?.length !== 0
      || Object.hasOwn(peRole ?? {}, 'md_path')
      || /https?:\/\//iu.test(JSON.stringify(peRole ?? {}))) {
    diagnostic(diagnostics, 'PILOT_PE_ROLE', pilotPaths.lesson3, '/author_created_subject_roles/0', 'PE outcome requires the exact author-created missing-route role with no human-studies replacement, route, md_path, record, or URL');
  }
  if (!sameSet(lesson3.commercial_core?.task_material_ids, lesson3TaskIds)
      || !sameSet(
        lesson3.commercial_core?.task_contracts?.map((entry) => entry.task_material_id),
        lesson3TaskIds,
      )
      || lesson3TaskIds.some((taskId) => (
        !materialById(lesson3, taskId)
        || !lesson3.originality_review?.covered_author_material_ids?.includes(taskId)
      ))) {
    diagnostic(diagnostics, 'PILOT_PENDING_INTERNAL_TASK_IDS', pilotPaths.lesson3, '/commercial_core', 'lesson 3 must integrate exactly pending tasks 09 and 10 as covered internal materials');
  }
  const phrase = waterSafetyLanguageContract.sentence;
  if (lesson3.language_load?.model_sentences?.length !== 1
      || lesson3.language_load?.model_sentences?.[0]?.text_et !== phrase
      || lesson3.language_load?.sentence_frames?.length !== 1
      || lesson3.language_load?.sentence_frames?.[0]?.frame_et !== phrase
      || JSON.stringify(lesson3.language_load?.expected_receptive_language_et)
        !== JSON.stringify(waterSafetyLanguageContract.receptive)
      || JSON.stringify(lesson3.language_load?.expected_supported_productive_language_et)
        !== JSON.stringify([phrase])
      || JSON.stringify(lesson3.language_load?.expected_independent_productive_language_et)
        !== JSON.stringify([phrase])
      || lesson3.language_load?.short_expected_oral_answer_et !== phrase
      || lesson3.questions?.[0]?.short_oral_answer_et !== phrase
      || lesson3.practical_work?.short_estonian_conclusion !== phrase
      || lesson3.objectives?.estonian_language_objectives?.[0]?.minimum_quantity !== 1
      || lesson3.cognitive_load?.independent_output_sentences !== 1) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_LANGUAGE', pilotPaths.lesson3, '/language_load', 'Ma kutsun täiskasvanu. must remain the only required productive Estonian sentence');
  }
  const stageIds = lesson3.stages?.map((entry) => entry.stage_id) ?? [];
  const humanTaskIndex = stageIds.indexOf('attempt-human-studies-task');
  const peTaskIndex = stageIds.indexOf('attempt-pe-task');
  const discussionIndex = stageIds.indexOf('discuss-after-individual-work');
  if (lesson3.stages?.reduce((sum, entry) => sum + entry.duration_minutes, 0) !== 45
      || lesson3.stages?.length !== 9
      || humanTaskIndex < 0
      || peTaskIndex < 0
      || discussionIndex <= humanTaskIndex
      || discussionIndex <= peTaskIndex) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_SEQUENCE', pilotPaths.lesson3, '/stages', 'lesson 3 must total 45 minutes with both individual task attempts before pair discussion');
  }
  const practicalText = normalize(JSON.stringify(lesson3.practical_work));
  const pupilStepsText = normalize((lesson3.practical_work?.pupil_steps ?? []).join(' '));
  const prohibitedPupilActions = [
    /(?:войти|входить) в воду/iu,
    /(?:плыть|поплыть)/iu,
    /дотянуться до воды/iu,
    /бросить спасательн/iu,
    /(?:вытянуть|перенести) (?:человека|другого ребёнка)/iu,
    /проверить (?:глубину|течение|л[её]д|опору|устойчивость)/iu,
  ];
  if (lesson3.practical_work?.opiq_source_record_ids?.length !== 0
      || !practicalText.includes('только в сухом классе')
      || !practicalText.includes('не подходит к реальной воде')
      || !practicalText.includes('не пересекать линию')
      || !practicalText.includes('не отправлять другого ребёнка')
      || prohibitedPupilActions.some((pattern) => pattern.test(pupilStepsText))
      || lesson3.pedagogical_integration?.selection_input?.resources?.outdoor_access_available !== false) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_DRY_SAFETY', pilotPaths.lesson3, '/practical_work', 'lesson 3 practical work must remain an adult-controlled dry classroom simulation with no real-water exposure');
  }
  const subjectCriteria = lesson3.assessment?.filter((entry) => entry.affects === 'subject_assessment') ?? [];
  const languageCriteria = lesson3.assessment?.filter((entry) => entry.affects === 'language_assessment') ?? [];
  if (!sameSet(subjectCriteria.map((entry) => entry.criterion_id), [
    'water-safety-human-studies',
    'water-safety-pe-dry-decision',
  ])
      || languageCriteria.length !== 3
      || languageCriteria.some((entry) => entry.affects !== 'language_assessment')) {
    diagnostic(diagnostics, 'PILOT_LESSON_3_EVIDENCE', pilotPaths.lesson3, '/assessment', 'human-studies, PE, and Estonian evidence must remain independently scored');
  }

  const scienceOutcome = 'ee-prk-2026-stage1-natural-science-guided-inquiry';
  const lesson4ObjectiveOutcomes = lesson4.objectives?.content_objectives
    ?.flatMap((entry) => entry.curriculum_outcome_refs ?? []) ?? [];
  const lesson4TaskIds = pendingInternalTaskContracts
    .filter((entry) => entry.lessonIndex === 3)
    .map((entry) => entry.taskId);
  if (lesson4.lesson_id !== 'grade-2-weather-water-safety-04-weather-report'
      || lesson4.position_in_unit !== 4
      || lesson4.title_ru !== 'Наш отчёт о погоде и итог модуля'
      || lesson4.title_et !== 'Meie ilmateade ja mooduli kokkuvõte'
      || lesson4.subject !== 'science'
      || lesson4.subject_et !== 'loodusõpetus'
      || lesson4.canonical_route?.source_id !== 'grade-2-science'
      || lesson4.canonical_route?.md_path !== 'project-files/outputs/opiq_2klass_loodusopetus.md'
      || lesson4.canonical_route?.source_archive
        !== 'project-files/inputs/final-zips/opiq_2klass_loodus_ja_inimeseopetus_2_klassile_v2.zip'
      || lesson4.canonical_route?.qa_path !== 'project-files/outputs/opiq_2klass_loodusopetus_qa.json'
      || lesson4.evidence_linkage?.curriculum_map_id !== 'grade-2-science-official-curriculum'
      || JSON.stringify(lesson4.evidence_linkage?.official_outcome_refs)
        !== JSON.stringify([scienceOutcome])
      || lesson4ObjectiveOutcomes.length !== 2
      || lesson4ObjectiveOutcomes.some((outcomeId) => outcomeId !== scienceOutcome)
      || (lesson4.author_created_subject_roles ?? []).length !== 0
      || /cross-curricular|mathematics-real-life|assessment-formative/iu.test(
        JSON.stringify({
          evidence: lesson4.evidence_linkage,
          objectives: lesson4.objectives,
        }),
      )) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_IDENTITY', pilotPaths.lesson4, '/', 'lesson 4 must use only the exact Grade 2 science route and guided-inquiry lesson outcome without promoting task-level metadata');
  }
  if (!sameSet(lesson4.commercial_core?.task_material_ids, lesson4TaskIds)
      || !sameSet(
        lesson4.commercial_core?.task_contracts?.map((entry) => entry.task_material_id),
        lesson4TaskIds,
      )
      || lesson4TaskIds.some((taskId) => (
        !materialById(lesson4, taskId)
        || !lesson4.originality_review?.covered_author_material_ids?.includes(taskId)
      ))) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_TASK_IDS', pilotPaths.lesson4, '/commercial_core', 'lesson 4 must integrate exactly pending tasks 11 and 12 as covered internal materials');
  }
  const openTask = lesson4.commercial_core?.task_contracts?.find((entry) => (
    entry.task_material_id === 'g2-shared-weather-report-contribution-task'
  ));
  const exitTask = lesson4.commercial_core?.task_contracts?.find((entry) => (
    entry.task_material_id === 'g2-weather-exit-ticket-task'
  ));
  if (openTask?.response_mode !== 'open_ended'
      || openTask?.open_ended !== true
      || !normalize(openTask?.open_ended_exemption?.reason)
      || Object.hasOwn(openTask ?? {}, 'expected_answer_material_ids')
      || exitTask?.response_mode !== 'short_answer'
      || exitTask?.open_ended !== false
      || !sameSet(exitTask?.expected_answer_material_ids, ['g2-weather-exit-ticket-expected-answers'])) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_TASK_MODES', pilotPaths.lesson4, '/commercial_core/task_contracts', 'task 11 must remain criteria-based open-ended and task 12 must remain closed with a teacher-only answer');
  }
  const reportLanguage = lesson4.language_load ?? {};
  if (reportLanguage.model_sentences?.length !== 1
      || reportLanguage.model_sentences?.[0]?.text_et !== weatherReportLanguageContract.sentence
      || reportLanguage.sentence_frames?.length !== 1
      || reportLanguage.sentence_frames?.[0]?.frame_id !== weatherReportLanguageContract.frameId
      || reportLanguage.sentence_frames?.[0]?.frame_et !== weatherReportLanguageContract.frame
      || JSON.stringify(reportLanguage.expected_receptive_language_et)
        !== JSON.stringify(weatherReportLanguageContract.receptive)
      || JSON.stringify(reportLanguage.expected_supported_productive_language_et)
        !== JSON.stringify([weatherReportLanguageContract.sentence])
      || JSON.stringify(reportLanguage.expected_independent_productive_language_et)
        !== JSON.stringify([weatherReportLanguageContract.sentence])
      || reportLanguage.short_expected_oral_answer_et !== weatherReportLanguageContract.sentence
      || lesson4.questions?.[0]?.short_oral_answer_et !== weatherReportLanguageContract.sentence
      || lesson4.objectives?.estonian_language_objectives?.[0]?.minimum_quantity !== 1
      || lesson4.cognitive_load?.independent_output_sentences !== 1) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_LANGUAGE', pilotPaths.lesson4, '/language_load', 'Kell 13 on soojem. must remain the only required productive Estonian sentence with the exact blank frame and receptive word set');
  }
  const expectedStageIds = [
    'retrieve-module-evidence',
    'explain-evidence-report-ru',
    'check-four-point-data',
    'draft-individual-contribution',
    'verify-attribution-code',
    'assemble-shared-weather-report',
    'complete-individual-exit-ticket',
    'check-estonian-output-separately',
    'reflect-and-handoff-evidence',
  ];
  const expectedStageMinutes = [5, 6, 5, 8, 3, 6, 6, 3, 3];
  const actualStageIds = lesson4.stages?.map((entry) => entry.stage_id) ?? [];
  const actualStageMinutes = lesson4.stages?.map((entry) => entry.duration_minutes) ?? [];
  if (JSON.stringify(actualStageIds) !== JSON.stringify(expectedStageIds)
      || JSON.stringify(actualStageMinutes) !== JSON.stringify(expectedStageMinutes)
      || actualStageMinutes.reduce((sum, minutes) => sum + minutes, 0) !== 45
      || actualStageIds.indexOf('draft-individual-contribution')
        >= actualStageIds.indexOf('assemble-shared-weather-report')
      || actualStageIds.indexOf('complete-individual-exit-ticket')
        >= actualStageIds.indexOf('check-estonian-output-separately')
      || lesson4.practical_work !== null) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_SEQUENCE', pilotPaths.lesson4, '/stages', 'lesson 4 must retain the exact 45-minute sequence, individual work before group assembly, and first attempt before answer checking');
  }
  const exitBinding = lesson4.pedagogical_integration?.phase_bindings?.find((entry) => (
    entry.dna_phase_id === 'complete-individual-exit-ticket'
  ));
  const contributionBinding = lesson4.pedagogical_integration?.phase_bindings?.find((entry) => (
    entry.dna_phase_id === 'draft-individual-contribution'
  ));
  const oralCheckBinding = lesson4.pedagogical_integration?.phase_bindings?.find((entry) => (
    entry.dna_phase_id === 'check-estonian-output-separately'
  ));
  if (exitBinding?.source_access_policy !== 'closed_first_attempt'
      || exitBinding?.render_contract?.answer_access_policy !== 'after_first_attempt'
      || !sameSet(exitBinding?.answer_key_material_ids, [])
      || contributionBinding?.source_access_policy !== 'closed_first_attempt'
      || contributionBinding?.render_contract?.answer_access_policy !== 'after_first_attempt'
      || !sameSet(contributionBinding?.answer_key_material_ids, ['g2-shared-weather-report-success-guidance'])
      || oralCheckBinding?.render_contract?.answer_access_policy !== 'after_first_attempt'
      || !sameSet(oralCheckBinding?.answer_key_material_ids, ['g2-weather-exit-ticket-expected-answers'])) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_FIRST_ATTEMPT', pilotPaths.lesson4, '/pedagogical_integration/phase_bindings', 'both pending tasks require an individual closed first attempt and task 12 answers may appear only in the later oral check');
  }
  const lesson4SubjectCriteria = lesson4.assessment?.filter((entry) => entry.affects === 'subject_assessment') ?? [];
  const lesson4LanguageCriteria = lesson4.assessment?.filter((entry) => entry.affects === 'language_assessment') ?? [];
  if (!sameSet(lesson4SubjectCriteria.map((entry) => entry.criterion_id), [
    'weather-report-individual-contribution',
    'weather-report-exit-data',
  ])
      || !sameSet(lesson4LanguageCriteria.map((entry) => entry.criterion_id), [
        'weather-report-et-recognition',
        'weather-report-et-supported',
        'weather-report-et-independent',
      ])
      || lesson4.assessment?.some((entry) => entry.affects === 'both')) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_EVIDENCE', pilotPaths.lesson4, '/assessment', 'individual contribution, exit content, and the three language evidence levels must remain independently scored');
  }
  const phaseBindings = lesson4.pedagogical_integration?.phase_bindings ?? [];
  const bindingByStage = new Map(phaseBindings.map((entry) => [entry.dna_phase_id, entry]));
  const expectedAssessmentRefs = new Map(expectedStageIds.map((stageId) => [stageId, []]));
  expectedAssessmentRefs.set('verify-attribution-code', [
    'weather-report-individual-contribution',
  ]);
  expectedAssessmentRefs.set('complete-individual-exit-ticket', [
    'weather-report-exit-data',
    'weather-report-et-recognition',
    'weather-report-et-supported',
  ]);
  expectedAssessmentRefs.set('check-estonian-output-separately', [
    'weather-report-et-independent',
  ]);
  const subjectIntegration = lesson4.pedagogical_integration?.assessment_integration
    ?.subject_assessment;
  const languageIntegration = lesson4.pedagogical_integration?.assessment_integration
    ?.estonian_language_assessment;
  const criterionAffects = new Map((lesson4.assessment ?? []).map((entry) => (
    [entry.criterion_id, entry.affects]
  )));
  const exitAnswerBindings = phaseBindings.filter((entry) => (
    entry.answer_key_material_ids?.includes('g2-weather-exit-ticket-expected-answers')
  ));
  const verifyBinding = bindingByStage.get('verify-attribution-code');
  const reflectionBinding = bindingByStage.get('reflect-and-handoff-evidence');
  const assessmentBindingsExact = phaseBindings.length === expectedStageIds.length
    && expectedStageIds.every((stageId) => (
      JSON.stringify(bindingByStage.get(stageId)?.assessment_refs)
        === JSON.stringify(expectedAssessmentRefs.get(stageId))
    ));
  if (!assessmentBindingsExact
      || verifyBinding?.render_contract?.evaluation_mode !== 'evidence_criterion'
      || verifyBinding?.answer_key_material_ids?.length !== 0
      || exitBinding?.render_contract?.evaluation_mode !== 'evidence_criterion'
      || exitBinding?.source_access_policy !== 'closed_first_attempt'
      || exitBinding?.render_contract?.answer_access_policy !== 'after_first_attempt'
      || oralCheckBinding?.render_contract?.evaluation_mode !== 'evidence_criterion'
      || oralCheckBinding?.render_contract?.answer_access_policy !== 'after_first_attempt'
      || exitAnswerBindings.length !== 1
      || exitAnswerBindings[0]?.dna_phase_id !== 'check-estonian-output-separately'
      || reflectionBinding?.assessment_refs?.length !== 0
      || reflectionBinding?.render_contract?.evaluation_mode !== 'teacher_observation'
      || reflectionBinding?.source_access_policy !== 'open'
      || reflectionBinding?.render_contract?.answer_access_policy !== 'not_applicable'
      || JSON.stringify(subjectIntegration?.target_phase_ids) !== JSON.stringify([
        'verify-attribution-code',
        'complete-individual-exit-ticket',
      ])
      || JSON.stringify(subjectIntegration?.criterion_refs) !== JSON.stringify([
        'weather-report-individual-contribution',
        'weather-report-exit-data',
      ])
      || JSON.stringify(languageIntegration?.target_phase_ids) !== JSON.stringify([
        'complete-individual-exit-ticket',
        'check-estonian-output-separately',
      ])
      || JSON.stringify(languageIntegration?.criterion_refs) !== JSON.stringify([
        'weather-report-et-recognition',
        'weather-report-et-supported',
        'weather-report-et-independent',
      ])
      || subjectIntegration?.criterion_refs?.some((criterionId) => (
        criterionAffects.get(criterionId) !== 'subject_assessment'
      ))
      || languageIntegration?.criterion_refs?.some((criterionId) => (
        criterionAffects.get(criterionId) !== 'language_assessment'
      ))
      || lesson4.pedagogical_integration?.assessment_integration?.separation_policy
        !== 'separate_subject_and_estonian_language_evidence') {
    diagnostic(diagnostics, 'PILOT_LESSON_4_ASSESSMENT_BINDING', pilotPaths.lesson4, '/pedagogical_integration', 'lesson 4 assessment criteria, subject/language targets, first-attempt answer release, and unscored reflection must remain bound to their exact phases');
  }
}

function validateTaskBankIntegration(diagnostics, repository) {
  const approvedIds = repository.taskBank.reviews
    .filter((artifact) => artifact.data.status === 'approved')
    .map((artifact) => artifact.data.task_id);
  const pending = repository.taskBank.reviews.filter((artifact) => artifact.data.status === 'pending');
  if (!sameSet(approvedIds, approvedTaskContracts.map((entry) => entry.taskId))
      || pending.length !== 10) {
    diagnostic(diagnostics, 'PILOT_APPROVAL_SET', 'task-bank/reviews', '/', 'task bank must have exactly two approved and ten pending reviews');
  }
  const integration = repository.module.task_bank_integration ?? {};
  const lesson2 = repository.lessons[1];
  if (!sameSet(
    integration.approved?.task_ids,
    approvedTaskContracts.map((entry) => entry.taskId),
  )
      || integration.approved?.lesson_id !== lesson2.lesson_id
      || integration.approved?.reviewed_commit_sha !== approvedTaskContracts[0].reviewCommit) {
    diagnostic(diagnostics, 'PILOT_APPROVED_TASK_DECLARATION', pilotPaths.module, '/task_bank_integration/approved', 'lesson 2 must retain exactly the two approved task IDs and reviewed commit');
  }
  const pendingGroups = Array.isArray(integration.pending_internal)
    ? integration.pending_internal
    : [];
  if (pendingGroups.length !== 2) {
    diagnostic(diagnostics, 'PILOT_PENDING_INTERNAL_DECLARATION', pilotPaths.module, '/task_bank_integration/pending_internal', 'exactly two lesson-scoped pending internal integration groups are required');
  }
  for (const lessonIndex of [2, 3]) {
    const expectedLesson = repository.lessons[lessonIndex];
    const expectedContracts = pendingInternalTaskContracts.filter((contract) => (
      contract.lessonIndex === lessonIndex
    ));
    const group = pendingGroups.find((entry) => entry.lesson_id === expectedLesson?.lesson_id);
    const pendingFingerprints = group?.task_fingerprints ?? [];
    if (!group
        || group.publication_unlocks !== false
        || group.customer_visibility_unlocks !== false
        || !sameSet(
          pendingFingerprints.map((entry) => entry.task_id),
          expectedContracts.map((entry) => entry.taskId),
        )
        || expectedContracts.some((contract) => (
          pendingFingerprints.find((entry) => entry.task_id === contract.taskId)?.value
            !== contract.fingerprint
        ))) {
      diagnostic(diagnostics, 'PILOT_PENDING_INTERNAL_DECLARATION', pilotPaths.module, '/task_bank_integration/pending_internal', `lesson ${lessonIndex + 1} pending tasks must remain fingerprint-pinned with no publication or visibility unlock`);
    }
  }
  if (!sameSet(
    integration.pending_unintegrated_task_ids,
    pendingUnintegratedTaskIds,
  )) {
    diagnostic(diagnostics, 'PILOT_PENDING_UNINTEGRATED', pilotPaths.module, '/task_bank_integration/pending_unintegrated_task_ids', 'the other six pending tasks must remain explicitly unintegrated');
  }
  const approvedDeclaredIds = integration.approved?.task_ids ?? [];
  const pendingDeclaredIds = pendingGroups.flatMap((group) => (
    group.task_fingerprints?.map((entry) => entry.task_id) ?? []
  ));
  const allDeclaredIds = [
    ...approvedDeclaredIds,
    ...pendingDeclaredIds,
    ...(integration.pending_unintegrated_task_ids ?? []),
  ];
  if (new Set(allDeclaredIds).size !== allDeclaredIds.length
      || !sameSet(allDeclaredIds, repository.taskBank.index.data.entries.map((entry) => entry.task_id))) {
    diagnostic(diagnostics, 'PILOT_TASK_INTEGRATION_PARTITION', pilotPaths.module, '/task_bank_integration', 'approved, pending internal, and pending unintegrated task sets must be disjoint and cover all twelve tasks exactly once');
  }
  for (const contract of approvedTaskContracts) {
    const task = taskArtifact(repository.taskBank, contract.taskId)?.data;
    const review = reviewArtifact(repository.taskBank, contract.taskId)?.data;
    const entry = indexEntry(repository.taskBank, contract.taskId);
    const computed = task ? computeTaskFingerprint(task) : null;
    if (!task || !review || !entry
        || computed.value !== contract.fingerprint
        || review.reviewed_version?.content_fingerprint?.value !== contract.fingerprint
        || entry.current_fingerprint?.value !== contract.fingerprint
        || entry.current_fingerprint_status !== 'current_approved') {
      diagnostic(diagnostics, 'PILOT_TASK_FINGERPRINT', 'task-bank', '/', `${contract.taskId} fingerprint is missing, stale, or unapproved`);
      continue;
    }
    if (review.reviewer !== 'astzhalkouski'
        || review.reviewer_role !== 'Human originality reviewer'
        || review.reviewed_version?.commit_sha !== contract.reviewCommit) {
      diagnostic(diagnostics, 'PILOT_TASK_REVIEW', reviewArtifact(repository.taskBank, contract.taskId).file, '/', `${contract.taskId} review identity or reviewed HEAD changed`);
    }
    const material = materialById(lesson2, contract.taskId);
    if (material?.material_id !== contract.taskId
        || material?.artifact_path !== contract.learnerPath) {
      diagnostic(diagnostics, 'PILOT_TASK_MATERIAL', pilotPaths.lesson2, '/evidence_linkage/author_materials', `${contract.taskId} material reference is unstable`);
    }
  }
  for (const contract of pendingInternalTaskContracts) {
    const task = taskArtifact(repository.taskBank, contract.taskId)?.data;
    const reviewArtifactData = reviewArtifact(repository.taskBank, contract.taskId);
    const review = reviewArtifactData?.data;
    const entry = indexEntry(repository.taskBank, contract.taskId);
    const computed = task ? computeTaskFingerprint(task) : null;
    if (!task || !review || !entry
        || computed.value !== contract.fingerprint
        || review.reviewed_version?.content_fingerprint?.value !== contract.fingerprint
        || entry.current_fingerprint?.value !== contract.fingerprint
        || entry.current_fingerprint_status !== 'current_pending_review') {
      diagnostic(diagnostics, 'PILOT_PENDING_TASK_FINGERPRINT', 'task-bank', '/', `${contract.taskId} fingerprint is missing, stale, or not pending review`);
      continue;
    }
    if (review.status !== 'pending'
        || review.reviewer !== null
        || review.reviewer_role !== null
        || review.reviewed_on !== null
        || review.reviewed_version?.commit_sha !== null) {
      diagnostic(diagnostics, 'PILOT_PENDING_TASK_REVIEW', reviewArtifactData.file, '/', `${contract.taskId} must remain pending with null identity, date, and reviewed commit`);
    }
    if (approvedIds.includes(contract.taskId)
        || integration.approved?.task_ids?.includes(contract.taskId)) {
      diagnostic(diagnostics, 'PILOT_PENDING_TASK_APPROVAL', pilotPaths.module, '/task_bank_integration', `${contract.taskId} cannot be treated as approved`);
    }
    const taskLesson = repository.lessons[contract.lessonIndex];
    const material = materialById(taskLesson, contract.taskId);
    if (material?.material_id !== contract.taskId
        || material?.artifact_path !== contract.learnerPath) {
      diagnostic(diagnostics, 'PILOT_PENDING_TASK_MATERIAL', contract.lessonPath, '/evidence_linkage/author_materials', `${contract.taskId} pending learner material reference is unstable`);
    }
  }
}

function validateSharedAndPeBoundaries(diagnostics, repository) {
  const shared = repository.module.shared_product ?? {};
  if (shared.product !== 'weather_board_and_group_report'
      || !shared.assembled_from_attributable_individual_work
      || !shared.individual_observation_required
      || !shared.individual_calculation_required
      || !shared.individual_oral_output_required
      || !shared.individual_report_contribution_required
      || !shared.individual_exit_ticket_required
      || !shared.report_transfer_requires_personal_code
      || shared.shared_evidence_replaces_individual !== false) {
    diagnostic(diagnostics, 'PILOT_SHARED_EVIDENCE', pilotPaths.module, '/shared_product', 'shared report must retain attributable observation, calculation, contribution, exit-ticket, and oral evidence for every learner');
  }
  const boundary = repository.module.physical_education_boundary ?? {};
  if (boundary.lesson_slot !== 3
      || boundary.source_status !== 'missing_route'
      || boundary.content_strategy !== 'author_created_required'
      || boundary.lesson_authoring_status !== 'authored_internal'
      || !boundary.human_studies_support_bounded
      || !boundary.replacement_by_human_studies_forbidden) {
    diagnostic(diagnostics, 'PILOT_PE_BOUNDARY', pilotPaths.module, '/physical_education_boundary', 'lesson 3 must preserve the missing PE route and forbid human-studies replacement');
  }
}

async function validateMaterials(diagnostics, repository) {
  const packPaths = allPackPaths(repository.materialsIndex);
  for (const repositoryPath of packPaths) {
    try {
      await fs.access(safeRepositoryPath(repository.rootDir, repositoryPath, repositoryPath));
    } catch {
      diagnostic(diagnostics, 'PILOT_MATERIAL_MISSING', pilotPaths.materialsIndex, '/materials', `missing material ${repositoryPath}`);
    }
  }
  for (const repositoryPath of [
    repository.materialsIndex.pedagogical_review?.guide_path,
    repository.materialsIndex.pedagogical_review?.template_path,
    repository.materialsIndex.classroom_trial?.template_path,
    repository.materialsIndex.home_trial?.template_path,
  ]) {
    try {
      await fs.access(safeRepositoryPath(repository.rootDir, repositoryPath, repositoryPath));
    } catch {
      diagnostic(diagnostics, 'PILOT_WORKFLOW_PATH_MISSING', pilotPaths.materialsIndex, '/', `missing workflow path ${repositoryPath}`);
    }
  }
  const requiredTypes = ['teacher_guide', 'lesson_guide', 'rubric', 'homeschool_guide', 'answer_key'];
  const materialTypes = repository.materialsIndex.materials?.map((entry) => entry.material?.material_type);
  if (!requiredTypes.every((type) => materialTypes.includes(type))) {
    diagnostic(diagnostics, 'PILOT_PACK_TYPES', pilotPaths.materialsIndex, '/materials', 'teacher pack is missing a required conventional material type');
  }
  const answerKeyEntry = repository.materialsIndex.materials?.find((entry) => (
    entry.material?.material_id === 'g2-weather-water-answer-key'
  ));
  if (!sameSet(
    answerKeyEntry?.lesson_ids,
    ['grade-2-weather-water-safety-02-data-time'],
  )) {
    diagnostic(
      diagnostics,
      'PILOT_ANSWER_KEY_LINK',
      pilotPaths.materialsIndex,
      '/materials/g2-weather-water-answer-key/lesson_ids',
      'lesson 2 answer key must link only grade-2-weather-water-safety-02-data-time',
    );
  }
  const answerGuidance = await readText(
    repository.rootDir,
    'teacher-packs/grade-2/weather-water-safety/answers/lesson-02-answer-guidance.md',
  );
  for (const contract of approvedTaskContracts) {
    const learner = await readText(repository.rootDir, contract.learnerPath);
    const task = taskArtifact(repository.taskBank, contract.taskId)?.data;
    if (!normalize(learner).includes(normalize(task?.customer_content?.prompt))) {
      diagnostic(diagnostics, 'PILOT_TASK_PROJECTION', contract.learnerPath, '/', `${contract.taskId} learner prompt does not preserve the approved projection`);
    }
    for (const item of [
      ...(task?.customer_content?.supplied_materials ?? []),
      ...(task?.customer_content?.supplied_data ?? []),
    ]) {
      if (!normalize(learner).includes(normalize(item))) {
        diagnostic(diagnostics, 'PILOT_TASK_PROJECTION', contract.learnerPath, '/', `${contract.taskId} learner data is incomplete`);
      }
    }
    for (const sentinel of contract.answerSentinels) {
      if (normalize(learner).includes(normalize(sentinel))) {
        diagnostic(diagnostics, 'PILOT_ANSWER_LEAK', contract.learnerPath, '/', `learner file exposes teacher answer: ${sentinel}`);
      }
      if (!normalize(answerGuidance).includes(normalize(sentinel))) {
        diagnostic(diagnostics, 'PILOT_ANSWER_GUIDANCE', 'teacher-packs/grade-2/weather-water-safety/answers/lesson-02-answer-guidance.md', '/', `teacher guidance is missing: ${sentinel}`);
      }
    }
  }
  const pendingAnswerGuidanceCache = new Map();
  for (const contract of pendingInternalTaskContracts) {
    const learner = await readText(repository.rootDir, contract.learnerPath);
    const sourceTask = taskArtifact(repository.taskBank, contract.taskId)?.data;
    const teacher = pendingAnswerGuidanceCache.has(contract.teacherPath)
      ? pendingAnswerGuidanceCache.get(contract.teacherPath)
      : await readText(repository.rootDir, contract.teacherPath);
    pendingAnswerGuidanceCache.set(contract.teacherPath, teacher);
    for (const sourceLine of [
      sourceTask?.customer_content?.prompt,
      ...(sourceTask?.customer_content?.supplied_materials ?? []),
      ...(sourceTask?.customer_content?.supplied_data ?? []),
      sourceTask?.customer_content?.answer_format,
    ].filter(Boolean)) {
      if (!normalize(learner).includes(normalize(sourceLine))) {
        diagnostic(diagnostics, 'PILOT_PENDING_TASK_PROJECTION', contract.learnerPath, '/', `${contract.taskId} learner projection is incomplete`);
      }
    }
    const teacherOnly = [
      sourceTask?.answer_contract?.answer,
      sourceTask?.answer_contract?.worked_solution,
      ...(sourceTask?.answer_contract?.success_criteria ?? []).map((entry) => entry.description),
      ...(sourceTask?.answer_contract?.acceptable_variants ?? []),
      ...(sourceTask?.answer_contract?.common_errors ?? []),
      sourceTask?.answer_contract?.feedback?.correct,
      sourceTask?.answer_contract?.feedback?.retry,
    ].filter(Boolean);
    for (const sentinel of teacherOnly) {
      if (normalize(learner).includes(normalize(sentinel))) {
        diagnostic(diagnostics, 'PILOT_PENDING_ANSWER_LEAK', contract.learnerPath, '/', `${contract.taskId} learner file exposes teacher-only answer material`);
      }
    }
    for (const sentinel of contract.answerSentinels) {
      if (!normalize(teacher).includes(normalize(sentinel))) {
        diagnostic(diagnostics, 'PILOT_PENDING_ANSWER_GUIDANCE', contract.teacherPath, '/', `${contract.taskId} teacher guidance is missing: ${sentinel}`);
      }
    }
  }
  const studentPaths = packPaths.filter((repositoryPath) => repositoryPath.includes('/student/'));
  for (const repositoryPath of studentPaths) {
    const content = await readText(repository.rootDir, repositoryPath);
    if (/https?:\/\/(?:www\.)?opiq\.ee\//iu.test(content)) {
      diagnostic(diagnostics, 'PILOT_STUDENT_OPIQ_URL', repositoryPath, '/', 'learner material must not require or expose an Opiq URL');
    }
  }
  for (const repositoryPath of [
    'teacher-packs/grade-2/weather-water-safety/student/lesson-01-weather-explanation.md',
    'teacher-packs/grade-2/weather-water-safety/student/lesson-01-observation-sheet.md',
    'teacher-packs/grade-2/weather-water-safety/student/lesson-01-exit-card.md',
  ]) {
    const content = await readText(repository.rootDir, repositoryPath);
    if (!content.includes(weatherOutputContract.frame)
        || weatherOutputContract.rejectedExamples.some((example) => content.includes(example))) {
      diagnostic(
        diagnostics,
        'PILOT_LEARNER_WEATHER_OUTPUT',
        repositoryPath,
        '/',
        'lesson 1 learner material must use only the Täna on ___ ilm. productive contract',
      );
    }
  }
  for (const repositoryPath of [
    'teacher-packs/grade-2/weather-water-safety/student/lesson-03-safety-explanation.md',
    'teacher-packs/grade-2/weather-water-safety/student/lesson-03-exit-card.md',
    'teacher-packs/grade-2/weather-water-safety/teacher/lesson-03-guide.md',
    'teacher-packs/grade-2/weather-water-safety/answers/lesson-03-answer-guidance.md',
  ]) {
    const content = await readText(repository.rootDir, repositoryPath);
    if (!content.includes(waterSafetyLanguageContract.sentence)
        || !/сух|dry/iu.test(content)
        || /https?:\/\/(?:www\.)?opiq\.ee\//iu.test(content)) {
      diagnostic(diagnostics, 'PILOT_LESSON_3_MATERIAL_BOUNDARY', repositoryPath, '/', 'lesson 3 materials must retain the exact Estonian phrase, dry-only boundary, and no Opiq URL');
    }
  }
  const lesson4ExitPath = 'teacher-packs/grade-2/weather-water-safety/student/g2-weather-exit-ticket-task.md';
  const lesson4Exit = await readText(repository.rootDir, lesson4ExitPath);
  if (!lesson4Exit.includes(weatherReportLanguageContract.frame)
      || !weatherReportLanguageContract.choices.every((choice) => lesson4Exit.includes(choice))
      || lesson4Exit.includes(weatherReportLanguageContract.sentence)
      || !lesson4Exit.includes('Три пронумерованных коротких ответа.')) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_EXIT_BOUNDARY', lesson4ExitPath, '/', 'learner exit ticket must expose only the blank frame, two-word bank, and three numbered responses before the first attempt');
  }
  const lesson4ContributionPath = 'teacher-packs/grade-2/weather-water-safety/student/g2-shared-weather-report-contribution-task.md';
  const lesson4Contribution = await readText(repository.rootDir, lesson4ContributionPath);
  for (const required of [
    'Северная точка — 8 °C.',
    'Восточная точка — 12 °C.',
    'Южная точка — 15 °C.',
    'Западная точка — 10 °C.',
    'Личный код',
    'Только потом группа переносит идеи',
  ]) {
    if (!lesson4Contribution.includes(required)) {
      diagnostic(diagnostics, 'PILOT_LESSON_4_CONTRIBUTION_BOUNDARY', lesson4ContributionPath, '/', `individual contribution is missing ${required}`);
    }
  }
  const sharedTemplatePath = 'teacher-packs/grade-2/weather-water-safety/student/lesson-04-shared-report-template.md';
  const sharedTemplate = await readText(repository.rootDir, sharedTemplatePath);
  const reflectionPath = 'teacher-packs/grade-2/weather-water-safety/student/lesson-04-module-reflection.md';
  const reflection = await readText(repository.rootDir, reflectionPath);
  if (!/личн(ый|ого) код/iu.test(sharedTemplate)
      || !/не заменяет отдельные рамки/iu.test(sharedTemplate)
      || !/не заменяет индивидуальную рамку/iu.test(reflection)
      || !/три ответа выходной карточки/iu.test(reflection)) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_ATTRIBUTION_BOUNDARY', pilotPaths.materialsIndex, '/materials', 'shared report and reflection must preserve every learner contribution and exit ticket as separate evidence');
  }
  const lesson4GuidePath = 'teacher-packs/grade-2/weather-water-safety/teacher/lesson-04-guide.md';
  const lesson4Guide = await readText(repository.rootDir, lesson4GuidePath);
  const lesson4AnswerPath = 'teacher-packs/grade-2/weather-water-safety/answers/lesson-04-answer-guidance.md';
  const lesson4Answer = await readText(repository.rootDir, lesson4AnswerPath);
  if (!lesson4Guide.includes('grade-2-science')
      || !lesson4Guide.includes('ee-prk-2026-stage1-natural-science-guided-inquiry')
      || !lesson4Guide.includes(weatherReportLanguageContract.sentence)
      || !lesson4Answer.includes(weatherReportLanguageContract.sentence)
      || /https?:\/\/(?:www\.)?opiq\.ee\//iu.test(`${lesson4Guide}\n${lesson4Answer}`)) {
    diagnostic(diagnostics, 'PILOT_LESSON_4_MATERIAL_BOUNDARY', pilotPaths.materialsIndex, '/materials', 'lesson 4 teacher materials must retain the exact science route, one Estonian answer, and no Opiq URL');
  }
}

function validateRoadmap(diagnostics, repository) {
  const facts = repository.roadmap.implementation_facts ?? {};
  const expected = {
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
  };
  for (const [field, value] of Object.entries(expected)) {
    if (facts[field] !== value) {
      diagnostic(diagnostics, 'PILOT_ROADMAP', pilotPaths.roadmap, `/implementation_facts/${field}`, `expected ${String(value)}`);
    }
  }
  if (repository.roadmap.status !== 'partial_implementation'
      || !repository.roadmap.release_blocker_codes?.includes('ten_task_originality_reviews_pending')
      || !repository.roadmap.release_blocker_codes?.includes('standalone_commercial_core_internal_authoring_complete_not_release_ready')
      || repository.roadmap.release_blocker_codes?.includes('clean_room_task_bank_not_implemented')) {
    diagnostic(diagnostics, 'PILOT_ROADMAP_STATUS', pilotPaths.roadmap, '/', 'roadmap must report complete internal authoring while release remains blocked by reviews and trials');
  }
}

function validateWorkflow(diagnostics, repository) {
  const scripts = repository.packageJson.scripts ?? {};
  if (scripts['test:grade-2-weather-water-safety-pilot']
        !== 'node --test scripts/grade-2-weather-water-safety-pilot.test.mjs'
      || scripts['check:grade-2-weather-water-safety-pilot']
        !== 'node scripts/check-grade-2-weather-water-safety-pilot.mjs') {
    diagnostic(diagnostics, 'PILOT_PACKAGE_COMMANDS', pilotPaths.packageJson, '/scripts', 'focused test and check commands must remain executable');
  }
  const workflow = repository.workflowText;
  for (const required of [
    'lesson-plans/**',
    'teacher-packs/**',
    'grade-programmes/**',
    'schemas/**',
    'npm run test:grade-2-weather-water-safety-pilot',
    'npm run check:grade-2-weather-water-safety-pilot',
  ]) {
    if (!workflow.includes(required)) {
      diagnostic(diagnostics, 'PILOT_WORKFLOW', pilotPaths.workflow, '/', `workflow is missing ${required}`);
    }
  }
  if (pilotPaths.moduleSchema !== 'schemas/grade-2-weather-water-safety-pilot.schema.json'
      || repository.moduleSchema?.$id
        !== 'https://elvistudio.github.io/opiq-helper/schemas/grade-2-weather-water-safety-pilot.schema.json'
      || repository.moduleSchema?.title
        !== 'Grade 2 weather, water and safety pilot snapshot') {
    diagnostic(
      diagnostics,
      'PILOT_SCHEMA_IDENTITY',
      pilotPaths.moduleSchema,
      '/',
      'module schema path, $id, and title must identify this exact pilot snapshot',
    );
  }
}

export async function loadGrade2WeatherWaterSafetyPilot({
  rootDir = process.cwd(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    module,
    moduleSchema,
    materialsIndex,
    teacherPackSchema,
    commonSchema,
    courseSchema,
    pedagogySchema,
    roadmap,
    calendar,
    packageJson,
    workflowText,
    plans,
    taskBank,
  ] = await Promise.all([
    readYaml(absoluteRoot, pilotPaths.module),
    readJson(absoluteRoot, pilotPaths.moduleSchema),
    readYaml(absoluteRoot, pilotPaths.materialsIndex),
    readJson(absoluteRoot, 'schemas/teacher-pack.schema.json'),
    readJson(absoluteRoot, 'schemas/teaching-plan-common.schema.json'),
    readJson(absoluteRoot, 'schemas/course-map.schema.json'),
    readJson(absoluteRoot, 'schemas/pedagogy-generation-integration.schema.json'),
    readYaml(absoluteRoot, pilotPaths.roadmap),
    readYaml(absoluteRoot, pilotPaths.calendar),
    readJson(absoluteRoot, pilotPaths.packageJson),
    readText(absoluteRoot, pilotPaths.workflow),
    loadLessonPlanRepository({ rootDir: absoluteRoot }),
    loadTaskBankRepository({ rootDir: absoluteRoot }),
  ]);
  const lessonArtifacts = plans.artifacts.filter((artifact) => (
    [pilotPaths.lesson1, pilotPaths.lesson2, pilotPaths.lesson3, pilotPaths.lesson4].includes(artifact.file)
  ));
  const lessonByPath = new Map(lessonArtifacts.map((artifact) => [artifact.file, artifact.data]));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(courseSchema);
  ajv.addSchema(commonSchema);
  ajv.addSchema(pedagogySchema);
  return {
    rootDir: absoluteRoot,
    module,
    moduleSchema,
    materialsIndex,
    roadmap,
    calendar,
    packageJson,
    workflowText,
    plans,
    taskBank,
    lessons: [
      lessonByPath.get(pilotPaths.lesson1),
      lessonByPath.get(pilotPaths.lesson2),
      lessonByPath.get(pilotPaths.lesson3),
      lessonByPath.get(pilotPaths.lesson4),
    ].filter(Boolean),
    validators: {
      module: ajv.compile(moduleSchema),
      teacherPack: ajv.compile(teacherPackSchema),
    },
  };
}

export async function validateGrade2WeatherWaterSafetyPilot(repository) {
  const diagnostics = [];
  addSchemaDiagnostics(
    diagnostics,
    repository.validators.module,
    repository.module,
    pilotPaths.module,
    'PILOT_MODULE',
  );
  addSchemaDiagnostics(
    diagnostics,
    repository.validators.teacherPack,
    repository.materialsIndex,
    pilotPaths.materialsIndex,
    'PILOT_PACK',
  );
  const planResult = validateLessonPlanRepository(repository.plans);
  for (const entry of planResult.diagnostics.filter((item) => item.severity === 'error')) {
    diagnostic(diagnostics, 'PILOT_PLAN_REPOSITORY', entry.file, entry.field, entry.reason);
  }
  const taskResult = validateTaskBankRepository(repository.taskBank);
  for (const entry of taskResult.diagnostics) {
    diagnostic(diagnostics, 'PILOT_TASK_BANK', entry.file, entry.field, entry.reason);
  }
  if (repository.lessons.length !== 4) {
    diagnostic(diagnostics, 'PILOT_LESSON_COUNT', 'lesson-plans/grade-2/weather-water-safety', '/', 'expected exactly four authored lesson files');
  } else {
    validateModuleContract(diagnostics, repository);
    validateLessonContracts(diagnostics, repository);
    validateTaskBankIntegration(diagnostics, repository);
    validateSharedAndPeBoundaries(diagnostics, repository);
  }
  await validateMaterials(diagnostics, repository);
  validateRoadmap(diagnostics, repository);
  validateWorkflow(diagnostics, repository);
  const stale = await checkGeneratedLessons(repository.rootDir);
  for (const repositoryPath of stale) {
    diagnostic(diagnostics, 'PILOT_GENERATED_STALE', repositoryPath, '/', 'generated pilot artifact is stale');
  }
  diagnostics.sort((left, right) => (
    byteSort(left.file, right.file)
    || byteSort(left.field, right.field)
    || byteSort(left.code, right.code)
  ));
  return {
    diagnostics,
    summary: {
      modules: 1,
      authoredLessons: repository.lessons.length,
      plannedLessons: repository.module.lesson_contract?.planned_lesson_count ?? 0,
      packMaterials: repository.materialsIndex.materials?.length ?? 0,
      approvedTasks: approvedTaskContracts.length,
      pendingInternalTasks: pendingInternalTaskContracts.length,
      errors: diagnostics.length,
    },
  };
}

export function formatGrade2WeatherWaterSafetyDiagnostic(entry) {
  return `[${entry.code}] ${entry.file} ${entry.field}: ${entry.reason}`;
}
