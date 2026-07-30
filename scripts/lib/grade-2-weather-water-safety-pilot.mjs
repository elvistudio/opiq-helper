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
  moduleSchema: 'schemas/grade-2-project-module-implementation.schema.json',
  lesson1: 'lesson-plans/grade-2/weather-water-safety/lesson-01-weather-observation.yaml',
  lesson2: 'lesson-plans/grade-2/weather-water-safety/lesson-02-weather-data-time.yaml',
  materialsIndex: 'teacher-packs/grade-2/weather-water-safety/materials-index.yaml',
  roadmap: 'grade-programmes/grade-2/implementation-roadmap.yaml',
  calendar: 'grade-programmes/grade-2/teaching-calendar.yaml',
  packageJson: 'package.json',
  workflow: '.github/workflows/validate-source-manifest.yml',
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
      || authored.length !== 2
      || planned.length !== 2
      || module.lesson_contract.total_slots !== 4
      || module.lesson_contract.authored_lesson_count !== 2
      || module.lesson_contract.planned_lesson_count !== 2) {
    diagnostic(diagnostics, 'PILOT_SLOT_COUNT', pilotPaths.module, '/lesson_contract', 'expected exactly two authored and two planned slots');
  }
  if (slots.some((slot, index) => slot.position !== index + 1)) {
    diagnostic(diagnostics, 'PILOT_SLOT_ORDER', pilotPaths.module, '/lesson_contract/slots', 'lesson positions must be 1 through 4');
  }
  const expectedLessonIds = new Set(lessons.map((lesson) => lesson.lesson_id));
  if (!sameSet(authored.map((slot) => slot.lesson_id), expectedLessonIds)) {
    diagnostic(diagnostics, 'PILOT_LESSON_LINKS', pilotPaths.module, '/lesson_contract/slots', 'authored slots must exactly link the two lesson artifacts');
  }
  for (const [index, slot] of planned.entries()) {
    if (slot.lesson_id !== null
        || slot.lesson_path !== null
        || slot.content_complete !== false
        || slot.release_ready !== false) {
      diagnostic(diagnostics, 'PILOT_PLANNED_READY', pilotPaths.module, `/lesson_contract/slots/${index + 2}`, 'planned slots cannot have lesson paths, content completion, or release readiness');
    }
  }
  if (!sameSet(module.source_routes, exactRoutes)) {
    diagnostic(diagnostics, 'PILOT_ROUTE_SCOPE', pilotPaths.module, '/source_routes', 'module must retain only the five registered Grade 2 routes');
  }
}

function validateLessonContracts(diagnostics, repository) {
  const [lesson1, lesson2] = repository.lessons;
  for (const [index, lesson] of repository.lessons.entries()) {
    const file = [pilotPaths.lesson1, pilotPaths.lesson2][index];
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
        || lesson.originality_review?.reviewed_on !== null) {
      diagnostic(diagnostics, 'PILOT_LESSON_ORIGINALITY', file, '/originality_review', 'lesson-level originality review must remain pending without invented identity');
    }
  }
  if (lesson1.learner_language_profile?.learner_language_level !== 'A1'
      || lesson2.learner_language_profile?.learner_language_level !== 'A1-A2') {
    diagnostic(diagnostics, 'PILOT_LANGUAGE_LEVEL', 'lesson-plans/grade-2/weather-water-safety', '/learner_language_profile', 'expected A1 for lesson 1 and A1-A2 for lesson 2');
  }
  const lesson1Terms = lesson1.language_load?.new_terms_et?.map((entry) => entry.term_et);
  if (!sameSet(lesson1Terms, ['ilm', 'vihm', 'tuul', 'pilv', 'päike'])
      || lesson1.language_load?.expected_independent_productive_language_et?.length !== 1) {
    diagnostic(diagnostics, 'PILOT_LANGUAGE_BOUNDS', pilotPaths.lesson1, '/language_load', 'lesson 1 must retain exactly five bounded terms and one short output');
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
  if (!sameSet(
    repository.module.task_bank_integration?.approved_task_ids,
    approvedTaskContracts.map((entry) => entry.taskId),
  ) || repository.module.task_bank_integration?.pending_task_ids_integrated?.length !== 0) {
    diagnostic(diagnostics, 'PILOT_PENDING_TASK', pilotPaths.module, '/task_bank_integration', 'no pending task may be integrated or treated as approved');
  }
  const lesson2 = repository.lessons[1];
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
}

function validateSharedAndPeBoundaries(diagnostics, repository) {
  const shared = repository.module.shared_product ?? {};
  if (!shared.assembled_from_attributable_individual_work
      || !shared.individual_observation_required
      || !shared.individual_calculation_required
      || !shared.individual_oral_output_required
      || shared.shared_evidence_replaces_individual !== false) {
    diagnostic(diagnostics, 'PILOT_SHARED_EVIDENCE', pilotPaths.module, '/shared_product', 'shared product must retain attributable individual observation, calculation, and oral evidence');
  }
  const boundary = repository.module.physical_education_boundary ?? {};
  if (boundary.lesson_slot !== 3
      || boundary.source_status !== 'missing_route'
      || boundary.content_strategy !== 'author_created_required'
      || boundary.lesson_authoring_status !== 'planned'
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
  const studentPaths = packPaths.filter((repositoryPath) => repositoryPath.includes('/student/'));
  for (const repositoryPath of studentPaths) {
    const content = await readText(repository.rootDir, repositoryPath);
    if (/https?:\/\/(?:www\.)?opiq\.ee\//iu.test(content)) {
      diagnostic(diagnostics, 'PILOT_STUDENT_OPIQ_URL', repositoryPath, '/', 'learner material must not require or expose an Opiq URL');
    }
  }
}

function validateRoadmap(diagnostics, repository) {
  const facts = repository.roadmap.implementation_facts ?? {};
  const expected = {
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
  };
  for (const [field, value] of Object.entries(expected)) {
    if (facts[field] !== value) {
      diagnostic(diagnostics, 'PILOT_ROADMAP', pilotPaths.roadmap, `/implementation_facts/${field}`, `expected ${String(value)}`);
    }
  }
  if (repository.roadmap.status !== 'partial_implementation'
      || !repository.roadmap.release_blocker_codes?.includes('ten_task_originality_reviews_pending')
      || repository.roadmap.release_blocker_codes?.includes('clean_room_task_bank_not_implemented')) {
    diagnostic(diagnostics, 'PILOT_ROADMAP_STATUS', pilotPaths.roadmap, '/', 'roadmap must report partial implementation and the current review blocker');
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
    [pilotPaths.lesson1, pilotPaths.lesson2].includes(artifact.file)
  ));
  const lessonByPath = new Map(lessonArtifacts.map((artifact) => [artifact.file, artifact.data]));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(courseSchema);
  ajv.addSchema(commonSchema);
  ajv.addSchema(pedagogySchema);
  return {
    rootDir: absoluteRoot,
    module,
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
  if (repository.lessons.length !== 2) {
    diagnostic(diagnostics, 'PILOT_LESSON_COUNT', 'lesson-plans/grade-2/weather-water-safety', '/', 'expected exactly two authored lesson files');
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
      errors: diagnostics.length,
    },
  };
}

export function formatGrade2WeatherWaterSafetyDiagnostic(entry) {
  return `[${entry.code}] ${entry.file} ${entry.field}: ${entry.reason}`;
}
