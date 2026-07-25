import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import {
  checkGeneratedFiles,
  computeLessonContentIdentity,
  computeUnitContentIdentity,
  findLearnerAnswerLeaks,
  generateWaterPilotArtifacts,
  WATER_PILOT_INDEX,
  WATER_PILOT_LESSONS,
  WATER_PILOT_PACK,
  WATER_PILOT_THEMATIC,
} from './pedagogy-generation-integration.mjs';
import {
  loadPedagogyQualityConfiguration,
} from './pedagogy-quality-gates.mjs';
import {
  createPedagogySelectionValidators,
  computeActivityCatalogSelectionDigest,
  loadPedagogySelectionRepository,
  normalizePedagogySelectionRequest,
  sha256PedagogyValue,
  stablePedagogyJson,
  validatePedagogySelection,
} from './pedagogy-selection.mjs';
import {
  createPedagogyHomeschoolValidators,
  loadPedagogyHomeschoolRepository,
  validatePedagogyHomeschool,
} from './pedagogy-homeschool.mjs';
import {
  createPedagogyGenerationIntegrationValidators,
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lesson-plans.mjs';
import {
  loadTeacherPackRepository,
  validateTeacherPackRepository,
} from './teacher-packs.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './teacher-pack-fingerprints.mjs';
import {
  loadPedagogicalReviewRepository,
  summarizePedagogicalEvidenceForPack,
  validatePedagogicalReviewRepository,
} from './pedagogical-reviews.mjs';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';

export const WATER_QUALITY_REPORT_PATH =
  'evaluations/pedagogy-quality/grade-5-water-quality-report.json';
export const WATER_QUALITY_REPORT_ID = 'grade-5-water-quality-report';
export const WATER_QUALITY_SCOPE_ID = 'grade-5-water-pedagogy-pilot';

const WATER_LEGACY_CONTROL_LESSONS = [
  'lesson-plans/grade-5-science/water-use-cycle/lesson-01.yaml',
  'lesson-plans/grade-5-science/water-use-cycle/lesson-02.yaml',
  'lesson-plans/grade-5-science/water-use-cycle/lesson-03.yaml',
  'lesson-plans/grade-5-science/water-use-cycle/lesson-04.yaml',
  'lesson-plans/grade-5-science/water-use-cycle/lesson-05.yaml',
  'lesson-plans/grade-5-science/water-use-cycle/lesson-06.yaml',
];

const DEMAND_ORDER = new Map([
  ['none', 0],
  ['very_low', 1],
  ['low', 2],
  ['medium', 3],
  ['high', 4],
  ['very_high', 5],
  ['unknown', Number.POSITIVE_INFINITY],
]);

const MACHINE_ARTIFACT_VALIDATOR_KEYS = Object.freeze({
  selectionRequest: 'selectionRequest',
  selectionDecision: 'selectionDecision',
  lessonDna: 'lessonDna',
  homeschoolRequest: 'homeschoolRequest',
  homeschoolDecision: 'homeschoolDecision',
  homeschoolPackage: 'homeschoolPackage',
  parentGuidance: 'parentGuidance',
  weeklyStudyPlan: 'weeklyStudyPlan',
  integrationIndex: 'integrationIndex',
});

const INTEGRATED_MACHINE_ARTIFACT_KINDS = Object.freeze([
  'homeschoolDecision',
  'homeschoolPackage',
  'homeschoolRequest',
  'integrationIndex',
  'lessonDna',
  'parentGuidance',
  'selectionDecision',
  'selectionRequest',
  'weeklyStudyPlan',
]);

const HOMESCHOOL_MACHINE_ARTIFACT_KINDS = Object.freeze([
  'homeschoolDecision',
  'homeschoolPackage',
  'homeschoolRequest',
  'integrationIndex',
  'parentGuidance',
  'weeklyStudyPlan',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function diagnosticsErrors(result) {
  if (Array.isArray(result?.errors)) return result.errors;
  return (result?.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
}

function diagnosticPath(diagnostic) {
  return diagnostic.file ?? diagnostic.artifact_path ?? null;
}

function allTrue(values) {
  return values.every((value) => value === true);
}

async function readYaml(rootDir, repositoryPath) {
  const text = await fs.readFile(
    safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
    'utf8',
  );
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${repositoryPath}: invalid YAML:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  const value = document.toJS({ maxAliasCount: 1000 });
  if (!isObject(value)) throw new Error(`${repositoryPath}: YAML root must be an object`);
  return value;
}

async function readYamlResult(rootDir, repositoryPath) {
  try {
    return { data: await readYaml(rootDir, repositoryPath), error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

function schemaErrorReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') {
    return `missing required field ${error.params.missingProperty}`;
  }
  return error.message ?? `failed ${error.keyword}`;
}

function schemaErrorField(error) {
  const instancePath = error.instancePath || '/';
  if (error.keyword === 'additionalProperties') {
    return `${instancePath === '/' ? '' : instancePath}/${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') {
    return `${instancePath === '/' ? '' : instancePath}/${error.params.missingProperty}`;
  }
  return instancePath;
}

async function loadMachineArtifact(
  rootDir,
  artifactPath,
  artifactKind,
  validator,
) {
  const result = await readYamlResult(rootDir, artifactPath);
  if (result.error) {
    return {
      artifact_path: artifactPath,
      artifact_kind: artifactKind,
      data: null,
      parse_error: result.error,
      schema_valid: false,
      schema_diagnostics: [{
        severity: 'error',
        file: artifactPath,
        field: '/',
        reason: result.error,
      }],
    };
  }
  const schemaValid = validator(result.data);
  return {
    artifact_path: artifactPath,
    artifact_kind: artifactKind,
    data: result.data,
    parse_error: null,
    schema_valid: schemaValid,
    schema_diagnostics: schemaValid ? [] : (validator.errors ?? []).map((error) => ({
      severity: 'error',
      file: artifactPath,
      field: schemaErrorField(error),
      reason: schemaErrorReason(error),
    })),
  };
}

async function regularFileExists(rootDir, repositoryPath) {
  try {
    const filePath = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
    const stat = await fs.lstat(filePath);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function generatedArtifactPaths(lesson) {
  return Object.values(lesson.pedagogical_integration.generated_artifacts)
    .filter((value) => typeof value === 'string');
}

function materialPathMap(materialsIndex) {
  const result = new Map();
  for (const entry of materialsIndex.materials ?? []) {
    const material = entry.material ?? {};
    result.set(material.material_id, material.artifact_path);
    if (material.answer_key_path) {
      result.set(`${material.material_id}::answer-key`, material.answer_key_path);
    }
  }
  return result;
}

function materialRegisteredPaths(materialsIndex) {
  return new Set((materialsIndex.materials ?? []).flatMap((entry) => [
    entry.material?.artifact_path,
    entry.material?.answer_key_path,
  ].filter(Boolean)));
}

function pathsForTaskBindings(taskBindings) {
  return uniqueSorted(taskBindings.flatMap((task) => [
    ...(task.student_artifact_paths ?? []),
    ...(task.teacher_artifact_paths ?? []),
    task.answer_key_artifact_path,
  ]));
}

function lessonDependencyClosure(lesson, baselineRow, materialsIndex) {
  const taskPaths = pathsForTaskBindings(baselineRow.taskBindings);
  const homeMaterialIds = baselineRow.homeschoolRenderResolution.steps.flatMap(
    (step) => step.resolved_tasks.flatMap((task) => task.student_material_ids ?? []),
  );
  const byId = materialPathMap(materialsIndex);
  return uniqueSorted([
    WATER_PILOT_INDEX,
    WATER_PILOT_THEMATIC,
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    ...WATER_PILOT_LESSONS.filter((file) => file.endsWith(
      `/lesson-${String(lesson.position_in_unit).padStart(2, '0')}.yaml`,
    )),
    ...generatedArtifactPaths(lesson),
    ...taskPaths,
    ...homeMaterialIds.map((materialId) => byId.get(materialId)),
    baselineRow.parentRenderedPath,
  ]);
}

function normalizedSchemaDiagnostic(diagnostic) {
  return {
    severity: 'error',
    file: diagnosticPath(diagnostic),
    field: diagnostic.field ?? '/',
    reason:
      diagnostic.reason
      ?? diagnostic.message
      ?? 'artifact failed its repository schema validation',
  };
}

function schemaStateForClosure(
  closure,
  validationResults,
  loadErrors,
  machineArtifactStates,
  requiredMachineKinds,
) {
  const closureSet = new Set(closure);
  const relatedErrors = [
    ...diagnosticsErrors(validationResults.lessons),
    ...diagnosticsErrors(validationResults.teacherPacks),
    ...diagnosticsErrors(validationResults.reviews),
  ].filter((diagnostic) => closureSet.has(diagnosticPath(diagnostic)));
  const machineStates = machineArtifactStates.filter(
    (state) => closureSet.has(state.artifact_path),
  );
  const machinePaths = new Set(machineStates.map((state) => state.artifact_path));
  const rawErrors = loadErrors.filter(
    (entry) => closureSet.has(entry.path) && !machinePaths.has(entry.path),
  );
  const machineDiagnostics = machineStates.flatMap(
    (state) => state.schema_diagnostics,
  );
  const checkedKinds = new Set(machineStates.map((state) => state.artifact_kind));
  const missingKinds = requiredMachineKinds.filter((kind) => !checkedKinds.has(kind));
  const diagnostics = [
    ...relatedErrors.map(normalizedSchemaDiagnostic),
    ...rawErrors.map((entry) => ({
      severity: 'error',
      file: entry.path,
      field: '/',
      reason: entry.reason,
    })),
    ...machineDiagnostics,
    ...missingKinds.map((kind) => ({
      severity: 'error',
      file: closure[0],
      field: '/',
      reason: `required machine artifact kind ${kind} was not schema-checked`,
    })),
  ].sort((left, right) => compareBytewise(
    `${left.file}\u0000${left.field}\u0000${left.reason}`,
    `${right.file}\u0000${right.field}\u0000${right.reason}`,
  ));
  return {
    valid: diagnostics.length === 0,
    related_paths: uniqueSorted(diagnostics.map((diagnostic) => diagnostic.file)),
    diagnostics,
    checked_machine_artifacts: machineStates.map((state) => ({
      artifact_path: state.artifact_path,
      artifact_kind: state.artifact_kind,
      schema_valid: state.schema_valid,
    })).sort((left, right) => compareBytewise(
      `${left.artifact_path}\u0000${left.artifact_kind}`,
      `${right.artifact_path}\u0000${right.artifact_kind}`,
    )),
  };
}

function selectionConfigurationErrors(validationResults) {
  return [
    ...diagnosticsErrors(validationResults.selection),
    ...diagnosticsErrors(validationResults.homeschool),
  ];
}

function targetDemand(selectionRepository, targetId) {
  const [activityId, profileId] = targetId.split('::');
  const activity = selectionRepository.knowledge.activities.data.activities.find(
    (candidate) => candidate.activity_id === activityId,
  );
  const demands = profileId
    ? activity?.execution_profiles?.find((profile) => profile.profile_id === profileId)
      ?.learner_demands
    : activity?.learner_demands;
  return demands?.productive_language ?? 'unknown';
}

function maximumDemandWithinCeiling(selectionRepository, request, lessonDna) {
  const ceiling = request?.language_profile?.maximum_total_productive_language_demand;
  if (!ceiling) return false;
  const ceilingRank = DEMAND_ORDER.get(ceiling) ?? Number.NEGATIVE_INFINITY;
  return (lessonDna?.phases ?? []).every((phase) => (
    (DEMAND_ORDER.get(targetDemand(selectionRepository, phase.target.target_id))
      ?? Number.POSITIVE_INFINITY) <= ceilingRank
  ));
}

function patternPolicy(selectionRepository, patternId) {
  return selectionRepository.rules.data.pattern_policies.find(
    (candidate) => candidate.pattern_id === patternId,
  );
}

function structureState(lesson, actual, selectionRepository) {
  const lessonDna = actual.lessonDna;
  const request = actual.selectionRequest;
  const phaseBindings = lesson.pedagogical_integration.phase_bindings ?? [];
  const phaseIds = new Set(lessonDna?.phases?.flatMap(
    (phase) => [phase.phase_id, phase.phase],
  ) ?? []);
  const policy = patternPolicy(selectionRepository, lessonDna?.pattern?.pattern_id);
  const requiredSlots = (policy?.slots ?? []).filter(
    (slot) => slot.requirement === 'required',
  );
  const requestNeeds = request?.lesson_context?.phase_needs ?? [];
  const requestedRetrieval = request?.lesson_context?.context_flags?.retrieval === true
    || requestNeeds.includes('retrieval')
    || requiredSlots.some((slot) => slot.phase === 'retrieval');
  const requestedAssessment =
    request?.lesson_context?.context_flags?.assessment === true
    || requestNeeds.includes('formative_assessment')
    || requiredSlots.some((slot) => slot.phase === 'formative_assessment');
  const supportEnabled =
    request?.language_profile?.estonian_support?.enabled === true;
  return {
    learning_goals_present:
      (lesson.objectives?.content_objectives ?? []).length > 0
      && (!supportEnabled
        || (lesson.objectives?.estonian_language_objectives ?? []).length > 0),
    phase_goal_alignment: (lessonDna?.phases ?? []).every((phase) => {
      const binding = phaseBindings.find(
        (candidate) => candidate.dna_phase_id === phase.phase_id,
      );
      return Boolean(
        phase.purpose_ru
        && phase.target?.target_id
        && binding?.render_contract?.task_id
        && (binding.render_contract.learner_success_criterion_ru ?? []).length > 0,
      );
    }),
    pattern_required_components:
      Boolean(policy)
      && requiredSlots.every((slot) => phaseIds.has(slot.slot_id) || phaseIds.has(slot.phase))
      && requestNeeds.every((need) => phaseIds.has(need)),
    declared_practice_alignment:
      !lesson.practical_work
      || (lessonDna?.phases ?? []).some((phase) => {
        const binding = phaseBindings.find(
          (candidate) => candidate.dna_phase_id === phase.phase_id,
        );
        return phase.phase === 'guided_practice'
          && (binding?.student_material_ids ?? []).length > 0;
      }),
    formative_assessment_alignment:
      !requestedAssessment
      || phaseBindings.some((binding) => (
        phaseIds.has(binding.dna_phase_id)
        && (binding.assessment_refs ?? []).length > 0
        && (binding.render_contract?.learner_success_criterion_ru ?? []).length > 0
      )),
    retrieval_alignment:
      !requestedRetrieval
      || Boolean(
        lessonDna?.retrieval_plan
        && phaseIds.has(lessonDna.retrieval_plan.immediate_phase_id),
      ),
    retrieval_required: requestedRetrieval,
  };
}

function timingState(lesson, actualIntegrationRow, baselineRow) {
  const reconciliation =
    actualIntegrationRow?.timing_reconciliation ?? baselineRow.reconciliation;
  const phaseMinutes = (reconciliation?.phases ?? [])
    .reduce((sum, phase) => sum + Object.values(phase.component_totals ?? {})
      .reduce((componentSum, value) => componentSum + value, 0), 0);
  const stageAllocated = (reconciliation?.stage_partitions ?? [])
    .reduce((sum, stage) => sum + stage.allocated_minutes, 0);
  const componentTotal = Object.values(reconciliation?.component_totals ?? {})
    .filter((value) => Number.isInteger(value))
    .reduce((sum, value) => sum + value, 0);
  return {
    reconciled: reconciliation?.status === 'reconciled',
    lesson_total_exact:
      reconciliation?.dna_total_planned_minutes + reconciliation?.non_dna_minutes
        === lesson.duration_minutes,
    stage_partition_exact: (reconciliation?.stage_partitions ?? []).every(
      (stage) => stage.duration_minutes === stage.allocated_minutes,
    ) && stageAllocated === lesson.duration_minutes,
    component_total_exact:
      componentTotal + reconciliation?.reserve_minutes
        === reconciliation?.dna_total_planned_minutes
      && phaseMinutes + reconciliation?.reserve_minutes
        === reconciliation?.dna_total_planned_minutes,
    double_count_absent: (reconciliation?.phases ?? []).every((phase) => (
      Object.values(phase.component_totals ?? {})
        .reduce((sum, value) => sum + value, 0)
        === (phase.timing_allocations ?? []).reduce((sum, allocation) => (
          sum
          + allocation.activity_minutes
          + allocation.setup_minutes
          + allocation.cleanup_minutes
          + allocation.transition_minutes
        ), 0)
    )),
  };
}

function resolvedHomeTask(actual, sourcePhaseId) {
  if (!(actual.homeschoolDecision?.phase_adaptations ?? []).some(
    (adaptation) => adaptation.source_phase_id === sourcePhaseId,
  )) {
    return null;
  }
  return actual.baselineRow.homeschoolRenderResolution.steps
    .flatMap((step) => step.resolved_tasks.map((task) => ({ step, task })))
    .find(({ task }) => task.source_phase_id === sourcePhaseId);
}

function retrievalState(lesson, actual, structure) {
  const plan = actual.lessonDna?.retrieval_plan;
  if (!structure.retrieval_required && !plan) return { applicable: false };
  if (!plan) {
    return {
      applicable: true,
      closed_first_attempt: false,
      later_correction_present: false,
      key_after_attempt: false,
      plan_present: false,
    };
  }
  const immediateTask = (lesson.pedagogical_integration.phase_bindings ?? []).find(
    (binding) => binding.dna_phase_id === plan.immediate_phase_id,
  );
  const correctionTask = plan.correction_phase_id
    ? (lesson.pedagogical_integration.phase_bindings ?? []).find(
      (binding) => binding.dna_phase_id === plan.correction_phase_id,
    )
    : null;
  const homeImmediate = resolvedHomeTask(actual, plan.immediate_phase_id);
  const homeCorrection = plan.correction_phase_id
    ? resolvedHomeTask(actual, plan.correction_phase_id)
    : null;
  const inTaskAfterAttempt = Boolean(
    immediateTask?.render_contract?.answer_access_policy === 'after_first_attempt'
    && (immediateTask.answer_key_material_ids ?? []).length > 0
    && immediateTask.render_contract.evaluation_mode === 'answer_key',
  );
  const distinctClassroomCorrection = Boolean(
    correctionTask
    && correctionTask.dna_phase_id !== immediateTask?.dna_phase_id
    && correctionTask.render_contract?.task_id
      !== immediateTask?.render_contract?.task_id,
  );
  const distinctHomeCorrection = !plan.correction_phase_id || Boolean(
    homeCorrection
    && homeImmediate
    && homeCorrection.task.task_id !== homeImmediate.task.task_id
    && homeCorrection.step.phase_id !== homeImmediate.step.phase_id,
  );
  const answerBindings = actual.homeschoolDecision?.answer_binding_decisions ?? [];
  const homeKeyAfterAttempt = !homeImmediate || answerBindings
    .filter((binding) => binding.adapted_phase_id === homeImmediate.step.phase_id)
    .some((binding) => [
      'adult_managed',
      'self_managed_after_attempt',
    ].includes(binding.release_policy));
  return {
    applicable: true,
    plan_present: true,
    closed_first_attempt:
      immediateTask?.source_access_policy === 'closed_first_attempt'
      && (!homeImmediate || homeImmediate.task.source_access_policy === 'closed_first_attempt'),
    later_correction_present:
      (distinctClassroomCorrection && distinctHomeCorrection)
      || (!plan.correction_phase_id && inTaskAfterAttempt),
    key_after_attempt:
      immediateTask?.render_contract?.answer_access_policy === 'after_first_attempt'
      && homeKeyAfterAttempt,
  };
}

function hasAbsoluteLearnerDate(value) {
  if (Array.isArray(value)) return value.some(hasAbsoluteLearnerDate);
  if (!isObject(value)) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
  }
  return Object.entries(value).some(([key, child]) => (
    ['date', 'datetime', 'timestamp'].includes(key) || hasAbsoluteLearnerDate(child)
  ));
}

function windowShapeValid(window) {
  if (!isObject(window)) return false;
  const allowed = new Set(['after_days', 'after_lessons', 'capability', 'next_unit']);
  if (Object.keys(window).some((key) => !allowed.has(key))) return false;
  const relativeKeys = ['after_days', 'after_lessons', 'next_unit'].filter(
    (key) => Object.hasOwn(window, key),
  );
  if (relativeKeys.length !== 1) return false;
  const key = relativeKeys[0];
  if (key === 'next_unit') return window.next_unit === true;
  return Number.isInteger(window[key]) && window[key] > 0;
}

function delayedRetrievalState(lesson, actual, thematic, lessonPositions) {
  const windows = actual.lessonDna?.retrieval_plan?.delayed ?? [];
  const links = thematic.pedagogical_integration?.delayed_retrieval_links ?? [];
  const sourcePosition = lessonPositions.get(lesson.lesson_id);
  const linksValid = windows.every((window) => {
    const relativeWindow = Object.fromEntries(
      Object.entries(window).filter(([key]) => (
        ['after_days', 'after_lessons', 'next_unit'].includes(key)
      )),
    );
    const link = links.find((candidate) => (
      candidate.source_lesson_id === lesson.lesson_id
      && stablePedagogyJson(candidate.relative_window) === stablePedagogyJson(relativeWindow)
      && candidate.capability === window.capability
    ));
    if (!link) return false;
    if (relativeWindow.next_unit === true) return link.target_lesson_id === 'next_unit';
    const targetPosition = lessonPositions.get(link.target_lesson_id);
    if (!Number.isInteger(targetPosition) || targetPosition <= sourcePosition) return false;
    if (relativeWindow.after_lessons) {
      return targetPosition - sourcePosition === relativeWindow.after_lessons;
    }
    return true;
  });
  return {
    applicable: windows.length > 0,
    windows: structuredClone(windows),
    windows_schema_valid: windows.every(windowShapeValid),
    absolute_dates_absent: !hasAbsoluteLearnerDate(windows),
    thematic_link_current: linksValid,
  };
}

function languageState(lesson, actual, selectionRepository) {
  const request = actual.selectionRequest;
  const support = request?.language_profile?.estonian_support;
  const supportEnabled = support?.enabled === true;
  const assessmentEffects = new Set((lesson.assessment ?? []).map(
    (criterion) => criterion.affects,
  ));
  const supportTexts = (lesson.pedagogical_integration.phase_bindings ?? [])
    .flatMap((binding) => binding.render_contract?.learner_language_support_ru ?? []);
  const allowedRoles = new Set([
    'familiar_instruction',
    'labels',
    'sentence_frame',
    'short_oral_response',
    'short_written_response',
    'terminology',
  ]);
  const disabledConfiguration = support?.enabled === false
    && (support.allowed_roles ?? []).length === 0
    && support.sentence_frames_required === false
    && support.word_bank_required === false;
  return {
    primary_language_valid:
      request?.language_profile?.primary_instruction_language
        === lesson.instruction_language,
    support_configuration_valid: supportEnabled || disabledConfiguration,
    estonian_roles_bounded: !supportEnabled || (
      support.language === 'et'
      && typeof support.learner_level === 'string'
      && (support.allowed_roles ?? []).every((role) => allowedRoles.has(role))
    ),
    productive_demand_within_ceiling: maximumDemandWithinCeiling(
      selectionRepository,
      request,
      actual.lessonDna,
    ),
    required_scaffolds_present: !supportEnabled || (
      (!support.sentence_frames_required || supportTexts.some(
        (text) => /^(?:Рамка|Lausemall):/u.test(text) || /_{3,}/u.test(text),
      ))
      && (!support.word_bank_required || supportTexts.some(
        (text) => /^(?:Банк слов|Sõnapank):/u.test(text),
      ))
    ),
    complex_reasoning_primary_language:
      !supportEnabled
      || support.subject_explanation_language === lesson.instruction_language,
    assessment_separated: !supportEnabled || (
      lesson.pedagogical_integration.assessment_integration?.separation_policy
        === 'separate_subject_and_estonian_language_evidence'
      && assessmentEffects.has('subject_assessment')
      && assessmentEffects.has('language_assessment')
    ),
    subject_score_language_neutral: (lesson.assessment ?? [])
      .filter((criterion) => criterion.affects === 'subject_assessment')
      .every((criterion) => criterion.domain !== 'supported_estonian_production'
        && criterion.domain !== 'independent_estonian_production'),
  };
}

function explicitAdaptedContractComplete(contract) {
  return Boolean(
    contract
    && contract.learner_instruction_ru
    && (contract.student_material_ids ?? []).length > 0
    && (contract.learner_success_criterion_ru ?? []).length > 0
    && contract.evaluation_mode
    && contract.source_access_policy
    && contract.answer_access_policy
    && Array.isArray(contract.answer_key_material_ids)
    && Array.isArray(contract.procedure_refs)
    && Array.isArray(contract.safety_refs),
  );
}

function homeState(lesson, actual) {
  const resolution = actual.baselineRow.homeschoolRenderResolution;
  const material = resolution.home_material_validation;
  const adaptations = actual.homeschoolDecision?.phase_adaptations ?? [];
  const changedTargets = adaptations.filter((adaptation) => (
    adaptation.source_target_id
    && adaptation.adapted_target_id
    && adaptation.source_target_id !== adaptation.adapted_target_id
  ));
  const contracts =
    lesson.pedagogical_integration.selection_input?.homeschool?.adapted_task_contracts ?? [];
  return {
    applicable: true,
    material_closure_resolved: allTrue([
      resolution.content_refs_resolved,
      resolution.task_refs_resolved,
      resolution.answer_refs_resolved,
      resolution.procedure_refs_resolved,
      resolution.safety_refs_resolved,
    ]),
    delivery_scope_valid: material.delivery_scope_valid,
    adapted_contracts_complete: changedTargets.every((adaptation) => {
      const contract = contracts.find((candidate) => (
        candidate.source_phase_id === adaptation.source_phase_id
        && candidate.adapted_target_id === adaptation.adapted_target_id
      ));
      return explicitAdaptedContractComplete(contract)
        && resolution.steps.some((step) => step.resolved_tasks.some((task) => (
          task.source_phase_id === contract.source_phase_id
          && task.target_id === contract.adapted_target_id
          && task.task_id === contract.task_id
        )));
    }),
    classroom_materials_absent:
      material.classroom_task_markers_absent
      && material.classroom_instructions_absent,
    parent_role_bounded: !stablePedagogyJson(
      actual.homeschoolDecision?.adult_role_decisions ?? [],
    ).includes('subject_explanation_required'),
  };
}

export function targetRequiresAdultSupervision(selectionRepository, targetId) {
  if (typeof targetId !== 'string' || targetId.length === 0) return false;
  const [activityId, profileId] = targetId.split('::');
  const activity = selectionRepository.knowledge.activities.data.activities.find(
    (candidate) => candidate.activity_id === activityId,
  );
  const contract = profileId
    ? activity?.execution_profiles?.find((profile) => profile.profile_id === profileId)
    : activity;
  return contract?.safety?.requires_adult_supervision === true;
}

function safetyState(lesson, actual, selectionRepository) {
  const packageSafety = actual.homeschoolPackage?.safety ?? {};
  const selectedTargets = actual.lessonDna?.phases?.map(
    (phase) => phase.target?.target_id,
  ) ?? [];
  const selectedSafetyRequirement = selectedTargets.some(
    (targetId) => targetRequiresAdultSupervision(selectionRepository, targetId),
  );
  const applicable = Boolean(
    (
      lesson.practical_work
      && actual.selectionRequest?.lesson_context?.context_flags?.practical === true
    )
    || selectedSafetyRequirement
    || packageSafety.source_supervision_required
    || packageSafety.adapted_supervision_required
    || lesson.pedagogical_integration.selection_input?.homeschool?.practical_policy,
  );
  if (!applicable) return { applicable: false };
  const resolution = actual.baselineRow.homeschoolRenderResolution;
  return {
    applicable: true,
    adult_supervision_present:
      packageSafety.effective_supervision_required === true
      && packageSafety.adult_supervision_required === true,
    teacher_authorization_present:
      packageSafety.effective_supervision_required === true
      && packageSafety.teacher_authorization_required === true,
    procedure_refs_resolved: resolution.procedure_refs_resolved,
    safety_refs_resolved: resolution.safety_refs_resolved,
    stop_conditions_present: (packageSafety.stop_conditions_ru ?? []).length > 0,
    policy_task_package_render_aligned:
      resolution.home_material_validation.policy_semantics_valid
      && resolution.machine_rendered_equivalent,
  };
}

async function alignmentState(rootDir, lesson, actual, materialsIndex) {
  const registered = materialRegisteredPaths(materialsIndex);
  const declaredGenerated = new Set(generatedArtifactPaths(lesson));
  const byId = materialPathMap(materialsIndex);
  const declaredMaterialIds = (lesson.pedagogical_integration.phase_bindings ?? [])
    .flatMap((binding) => [
      ...(binding.student_material_ids ?? []),
      ...(binding.teacher_material_ids ?? []),
      ...(binding.answer_key_material_ids ?? []),
    ]);
  const taskPaths = pathsForTaskBindings(
    lesson.pedagogical_integration.phase_bindings.map((binding) => ({
      student_artifact_paths: (binding.student_material_ids ?? []).map(
        (id) => byId.get(id),
      ).filter(Boolean),
      teacher_artifact_paths: (binding.teacher_material_ids ?? []).map(
        (id) => byId.get(id),
      ).filter(Boolean),
      answer_key_artifact_path: (binding.answer_key_material_ids ?? [])
        .map((id) => byId.get(id))
        .filter(Boolean)[0] ?? null,
    })),
  );
  const pathsResolved = declaredMaterialIds.every((materialId) => byId.has(materialId))
    && (await Promise.all(taskPaths.map(async (artifactPath) => (
      (registered.has(artifactPath) || declaredGenerated.has(artifactPath))
      && await regularFileExists(rootDir, artifactPath)
    )))).every(Boolean);
  const bindings = lesson.pedagogical_integration.phase_bindings ?? [];
  return {
    all_phases_materialized:
      bindings.length === (actual.lessonDna?.phases ?? []).length,
    task_identity_aligned: bindings.every((binding) => (
      actual.lessonDna?.phases?.some((phase) => (
        phase.phase_id === binding.dna_phase_id
        && phase.target.target_id === actual.baselineRow.taskBindings.find(
          (task) => task.phase_id === binding.dna_phase_id,
        )?.target_id
      ))
    )),
    learner_criteria_present: bindings.every(
      (binding) => (
        binding.render_contract?.learner_success_criterion_ru ?? []
      ).length > 0,
    ),
    answer_policy_aligned: bindings.every((binding) => (
      (binding.answer_key_material_ids ?? []).length > 0
        ? binding.render_contract?.answer_access_policy === 'after_first_attempt'
        : binding.render_contract?.answer_access_policy === 'not_applicable'
    )),
    artifact_paths_resolved: pathsResolved,
    machine_rendered_equivalent:
      actual.baselineRow.homeschoolRenderResolution.machine_rendered_equivalent,
  };
}

function evidenceForRecord(evidenceSummary) {
  return {
    effective_teacher_review: evidenceSummary.effective_teacher_review,
    effective_classroom_trial: evidenceSummary.effective_classroom_trial,
    stale_teacher_review: evidenceSummary.stale_teacher_review,
    stale_classroom_trial: evidenceSummary.stale_classroom_trial,
    related_paths: evidenceSummary.evidence_paths,
  };
}

function readinessState({
  lesson = null,
  homeschoolPackage = null,
  thematic = null,
  materialsIndex = null,
  evidenceSummary,
}) {
  const classroomStates = [
    lesson?.artifact_readiness?.teacher_review?.status,
    lesson?.pedagogical_integration?.status?.teacher_review,
    thematic?.teacher_pack?.teacher_review_status,
    thematic?.pedagogical_integration?.status?.teacher_review,
    materialsIndex?.pedagogical_review?.status,
    materialsIndex?.pedagogical_integration?.status?.teacher_review,
  ].filter((value) => value !== undefined);
  const classroomTrials = [
    lesson?.artifact_readiness?.classroom_trial?.status,
    lesson?.pedagogical_integration?.status?.classroom_trial,
    thematic?.teacher_pack?.classroom_trial?.status,
    thematic?.pedagogical_integration?.status?.classroom_trial,
    materialsIndex?.classroom_trial?.status,
    materialsIndex?.pedagogical_integration?.status?.classroom_trial,
  ].filter((value) => value !== undefined);
  const homeTrials = [
    homeschoolPackage?.status?.home_trial,
  ].filter((value) => value !== undefined);
  const classroomReady = [
    lesson?.artifact_readiness?.classroom_ready,
    lesson?.pedagogical_integration?.status?.classroom_ready,
    thematic?.teacher_pack?.classroom_ready,
    thematic?.pedagogical_integration?.status?.classroom_ready,
    materialsIndex?.pedagogical_integration?.status?.classroom_ready,
  ].filter((value) => value !== undefined);
  const homeschoolReady = [
    homeschoolPackage?.status?.homeschool_ready,
    thematic?.pedagogical_integration?.status?.homeschool_ready,
    materialsIndex?.pedagogical_integration?.status?.homeschool_ready,
  ].filter((value) => value !== undefined);
  const effectiveness = [
    lesson?.pedagogical_integration?.status?.effectiveness_claimed,
    homeschoolPackage?.status?.effectiveness_claimed,
    thematic?.pedagogical_integration?.status?.effectiveness_claimed,
    materialsIndex?.pedagogical_integration?.status?.effectiveness_claimed,
  ].filter((value) => value !== undefined);
  const single = (values, fallback) => (
    values.length === 0
      ? fallback
      : new Set(values).size === 1 ? values[0] : 'mixed'
  );
  const state = {
    teacher_review: single(classroomStates, 'unknown'),
    classroom_trial: single(classroomTrials, 'unknown'),
    home_trial: single(homeTrials, 'not_started'),
    classroom_ready: single(classroomReady, false),
    homeschool_ready: single(homeschoolReady, false),
    effectiveness_claimed: single(effectiveness, false),
    evidence: evidenceForRecord(evidenceSummary),
  };
  state.state_consistent = ![
    state.teacher_review,
    state.classroom_trial,
    state.home_trial,
    state.classroom_ready,
    state.homeschool_ready,
    state.effectiveness_claimed,
  ].includes('mixed');
  return state;
}

function provenanceState(lesson, actual) {
  const overrides =
    actual.selectionRequest?.preferences?.teacher_overrides ?? [];
  return {
    source_and_pedagogy_separated:
      (lesson.evidence_linkage?.opiq_records ?? []).length > 0
      && lesson.pedagogical_integration.integration_version === '1.0',
    pedagogy_claim_origin_explicit: overrides.every(
      (override) => (override.rationale_ru ?? '').length > 0,
    )
      && (actual.selectionDecision?.selected_pattern?.selection_origin ?? '').length > 0,
    official_curriculum_claim_absent:
      !stablePedagogyJson(actual.lessonDna).includes(
        '"official_curriculum_authority":true',
      ),
  };
}

function integratedIdentityState(
  lesson,
  actual,
  selectionRepository,
  generatedMismatches,
) {
  const rules = selectionRepository.rules.data;
  const versions = actual.lessonDna?.versions ?? {};
  const currentContentIdentity = computeLessonContentIdentity(lesson);
  const requestDigest = actual.selectionRequest
    ? sha256PedagogyValue(normalizePedagogySelectionRequest(actual.selectionRequest))
    : null;
  const activityDigest = computeActivityCatalogSelectionDigest(
    selectionRepository.knowledge.activities.data.activities,
  );
  const lessonDnaDigest = actual.lessonDna
    ? sha256PedagogyValue(actual.lessonDna)
    : null;
  const relevantGeneratedPaths = new Set(generatedArtifactPaths(lesson));
  return {
    required_checks: [
      'taxonomy_version_current',
      'selection_rules_version_current',
      'engine_version_current',
      'lesson_dna_schema_version_current',
      'catalogue_digest_current',
      'request_digest_current',
      'lesson_dna_digest_chain_current',
      'content_identity_current',
      'generated_artifacts_current',
    ],
    taxonomy_version_current: versions.taxonomy === rules.taxonomy_version,
    selection_rules_version_current:
      versions.selection_rules === rules.selection_rules_version,
    engine_version_current: versions.engine === rules.engine_version,
    lesson_dna_schema_version_current:
      versions.lesson_dna_schema === rules.lesson_dna_schema_version,
    catalogue_digest_current: versions.activity_catalog_digest === activityDigest,
    request_digest_current:
      requestDigest !== null
      && requestDigest === actual.selectionDecision?.request_digest
      && requestDigest === actual.lessonDna?.context?.request_digest,
    lesson_dna_digest_chain_current:
      stablePedagogyJson(actual.lessonDna)
        === stablePedagogyJson(actual.homeschoolRequest?.source?.lesson_dna)
      && actual.homeschoolDecision?.source_identity?.source_lesson_dna_digest
        === lessonDnaDigest
      && actual.homeschoolPackage?.source_identity?.source_lesson_dna_digest
        === lessonDnaDigest
      && actual.integrationRow?.lesson_dna_digest === lessonDnaDigest,
    content_identity_current:
      lesson.pedagogical_integration.content_identity?.value
        === currentContentIdentity.value,
    generated_artifacts_current: !generatedMismatches.some((mismatch) => (
      relevantGeneratedPaths.has(mismatch.split(': ')[0])
    )),
    related_paths: generatedArtifactPaths(lesson),
  };
}

function teacherPackIdentityState(
  thematic,
  materialsIndex,
  lessonIdentities,
  fingerprintState,
  generatedMismatches,
) {
  const unitIdentity = computeUnitContentIdentity(thematic, lessonIdentities);
  return {
    required_checks: [
      'teacher_pack_fingerprint_computed',
      'unit_content_identity_current',
      'integration_index_current',
    ],
    teacher_pack_fingerprint_computed: fingerprintState.computed,
    unit_content_identity_current:
      thematic.pedagogical_integration?.unit_content_identity?.value === unitIdentity.value
      && materialsIndex.pedagogical_integration?.unit_content_identity?.value
        === unitIdentity.value,
    integration_index_current: !generatedMismatches.some((mismatch) => (
      mismatch.startsWith(`${WATER_PILOT_PACK}/pedagogy/integration-index.yaml:`)
    )),
    related_paths: uniqueSorted([
      WATER_PILOT_INDEX,
      WATER_PILOT_THEMATIC,
      `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
      ...(fingerprintState.fingerprint?.files ?? []),
    ]),
  };
}

function thematicDelayedState(thematic, lessons) {
  const positions = new Map(lessons.map(
    (lesson) => [lesson.lesson_id, lesson.position_in_unit],
  ));
  const links = thematic.pedagogical_integration?.delayed_retrieval_links ?? [];
  return {
    applicable: links.length > 0,
    windows: links.map((link) => ({
      ...link.relative_window,
      capability: link.capability,
    })),
    windows_schema_valid: links.every((link) => windowShapeValid({
      ...link.relative_window,
      capability: link.capability,
    })),
    absolute_dates_absent: !hasAbsoluteLearnerDate(links),
    thematic_link_current: links.every((link) => {
      const source = positions.get(link.source_lesson_id);
      if (!Number.isInteger(source)) return false;
      if (link.relative_window?.next_unit === true) {
        return link.target_lesson_id === 'next_unit';
      }
      const target = positions.get(link.target_lesson_id);
      return Number.isInteger(target) && target > source;
    }),
  };
}

async function learnerFiles(rootDir, generated) {
  const paths = uniqueSorted([
    ...generated.materialsIndex.materials
      .map((entry) => entry.material)
      .filter((material) => material.audience === 'student')
      .map((material) => material.artifact_path),
    ...generated.files.keys().filter((repositoryPath) => (
      repositoryPath.startsWith(`${WATER_PILOT_PACK}/homeschool/`)
      && (
        repositoryPath.endsWith('-independent-study.md')
        || repositoryPath.endsWith('-parent-supported.md')
        || repositoryPath.endsWith('passive-observation-sheet.md')
        || repositoryPath.endsWith('home-safety-card.md')
      )
    )),
  ]);
  const files = new Map();
  for (const repositoryPath of paths) {
    try {
      files.set(
        repositoryPath,
        await fs.readFile(
          safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
          'utf8',
        ),
      );
    } catch {
      // Missing files are reported by cross-artifact closure rather than crashing this scan.
    }
  }
  return files;
}

function createMachineArtifactValidators(
  selectionRepository,
  homeschoolRepository,
  lessonRepository,
) {
  const selection = createPedagogySelectionValidators(selectionRepository);
  const homeschool = createPedagogyHomeschoolValidators(homeschoolRepository);
  const integration =
    createPedagogyGenerationIntegrationValidators(lessonRepository);
  return {
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.selectionRequest]: selection.request,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.selectionDecision]: selection.decision,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.lessonDna]: selection.lessonDna,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.homeschoolRequest]: homeschool.request,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.homeschoolDecision]: homeschool.decision,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.homeschoolPackage]: homeschool.package,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.parentGuidance]: homeschool.parentGuidance,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.weeklyStudyPlan]: homeschool.weeklyStudyPlan,
    [MACHINE_ARTIFACT_VALIDATOR_KEYS.integrationIndex]:
      integration.integrationIndex,
  };
}

async function loadActualMachineArtifacts(rootDir, generated, validators) {
  const artifactStates = [];
  const byLesson = new Map();
  for (const lesson of generated.lessons) {
    const paths = lesson.pedagogical_integration.generated_artifacts;
    const entries = await Promise.all([
      ['selectionRequest', paths.selection_request_path],
      ['selectionDecision', paths.selection_decision_path],
      ['lessonDna', paths.lesson_dna_path],
      ['homeschoolRequest', paths.homeschool_request_path],
      ['homeschoolDecision', paths.homeschool_decision_path],
      ['homeschoolPackage', paths.homeschool_package_path],
      ['parentGuidance', paths.parent_guidance_path],
      ['weeklyStudyPlan', paths.weekly_study_plan_path],
    ].map(async ([key, repositoryPath]) => {
      const state = await loadMachineArtifact(
        rootDir,
        repositoryPath,
        key,
        validators[key],
      );
      artifactStates.push(state);
      return [key, state.data];
    }));
    byLesson.set(lesson.lesson_id, Object.fromEntries(entries));
  }
  const integrationPath = `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`;
  const integration = await loadMachineArtifact(
    rootDir,
    integrationPath,
    'integrationIndex',
    validators.integrationIndex,
  );
  artifactStates.push(integration);
  return {
    byLesson,
    integrationIndex: integration.data,
    artifactStates: artifactStates.sort((left, right) => compareBytewise(
      `${left.artifact_path}\u0000${left.artifact_kind}`,
      `${right.artifact_path}\u0000${right.artifact_kind}`,
    )),
    loadErrors: artifactStates.filter((state) => state.parse_error).map((state) => ({
      path: state.artifact_path,
      reason: state.parse_error,
    })),
  };
}

async function loadEvidenceState(rootDir, waterPack, fingerprintState) {
  try {
    const repository = await loadPedagogicalReviewRepository({ rootDir });
    const index = repository.teacherPacks.indexes.find(
      (artifact) => artifact.data.pack_id === waterPack.data.pack_id,
    );
    if (!index) throw new Error(`missing review workflow for ${waterPack.data.pack_id}`);
    const summary = summarizePedagogicalEvidenceForPack(repository, index);
    return {
      repository,
      validation: validatePedagogicalReviewRepository(repository),
      summary,
    };
  } catch (error) {
    return {
      repository: null,
      validation: {
        diagnostics: [{
          severity: 'error',
          file: WATER_PILOT_INDEX,
          field: '/pedagogical_review',
          reason: error.message,
        }],
      },
      summary: {
        current_fingerprint: fingerprintState.fingerprint ?? null,
        completed_review_count: 0,
        analysed_trial_count: 0,
        effective_teacher_review: false,
        effective_classroom_trial: false,
        stale_teacher_review: false,
        stale_classroom_trial: false,
        evidence_paths: [],
        diagnostics: [],
      },
    };
  }
}

async function computeFingerprintState(teacherPackRepository, waterPack) {
  try {
    return {
      computed: true,
      fingerprint: await computeTeacherPackFingerprintFromRepository(
        teacherPackRepository,
        waterPack,
      ),
      error: null,
    };
  } catch (error) {
    return { computed: false, fingerprint: null, error: error.message };
  }
}

export async function prepareWaterPilotQualityBaselineContext({
  rootDir = process.cwd(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    generated,
    selectionRepository,
    homeschoolRepository,
  ] = await Promise.all([
    generateWaterPilotArtifacts({ rootDir: absoluteRoot }),
    loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
    loadPedagogyHomeschoolRepository({ rootDir: absoluteRoot }),
  ]);
  const selectionValidation = validatePedagogySelection(selectionRepository);
  const homeschoolValidation = validatePedagogyHomeschool(homeschoolRepository);
  const configurationErrors = selectionConfigurationErrors({
    selection: selectionValidation,
    homeschool: homeschoolValidation,
  });
  if (configurationErrors.length > 0) {
    const error = new Error(
      `baseline pedagogy configuration is invalid:\n${configurationErrors.map(
        (diagnostic) => diagnostic.message ?? diagnostic.reason ?? String(diagnostic),
      ).join('\n')}`,
    );
    error.code = 'invalid_upstream_pedagogy_configuration';
    throw error;
  }
  return {
    rootDir: absoluteRoot,
    generated,
    selectionRepository,
    homeschoolRepository,
    selectionValidation,
    homeschoolValidation,
  };
}

export async function loadWaterPilotPedagogyQualityRepository({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  baselineContext = null,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const absoluteBaseline = path.resolve(baselineRootDir);
  if (baselineContext && baselineContext.rootDir !== absoluteBaseline) {
    throw new Error(
      `water quality baseline context root ${baselineContext.rootDir} `
      + `does not match ${absoluteBaseline}`,
    );
  }
  const [
    configuration,
    preparedBaseline,
    lessonRepository,
    teacherPackRepository,
    currentHomeschoolRepository,
  ] = await Promise.all([
    loadPedagogyQualityConfiguration({ rootDir: absoluteRoot }),
    baselineContext ?? prepareWaterPilotQualityBaselineContext({
      rootDir: absoluteBaseline,
    }),
    loadLessonPlanRepository({ rootDir: absoluteRoot }),
    loadTeacherPackRepository({ rootDir: absoluteRoot }),
    loadPedagogyHomeschoolRepository({
      rootDir: absoluteRoot,
      examplesOptional: true,
      skipExamples: true,
    }),
  ]);
  const {
    generated: baselineGenerated,
  } = preparedBaseline;
  const selectionRepository = currentHomeschoolRepository.selection;
  const generated = {
    ...baselineGenerated,
    rootDir: absoluteRoot,
  };
  const waterPack = teacherPackRepository.indexes.find(
    (artifact) => artifact.file === WATER_PILOT_INDEX,
  );
  if (!waterPack) throw new Error(`missing production teacher pack ${WATER_PILOT_INDEX}`);
  const fingerprintState = await computeFingerprintState(
    teacherPackRepository,
    waterPack,
  );
  const evidenceState = await loadEvidenceState(
    absoluteRoot,
    waterPack,
    fingerprintState,
  );
  const validationResults = {
    selection: validatePedagogySelection(selectionRepository),
    homeschool: validatePedagogyHomeschool(currentHomeschoolRepository),
    lessons: validateLessonPlanRepository(lessonRepository),
    teacherPacks: validateTeacherPackRepository(teacherPackRepository),
    reviews: evidenceState.validation,
  };
  const configurationErrors = selectionConfigurationErrors(validationResults);
  if (configurationErrors.length > 0) {
    const error = new Error(
      `upstream pedagogy configuration is invalid:\n${configurationErrors.map(
        (diagnostic) => diagnostic.message ?? diagnostic.reason ?? String(diagnostic),
      ).join('\n')}`,
    );
    error.code = 'invalid_upstream_pedagogy_configuration';
    throw error;
  }
  const generatedMismatches = await checkGeneratedFiles(generated);
  const machineValidators = createMachineArtifactValidators(
    selectionRepository,
    currentHomeschoolRepository,
    lessonRepository,
  );
  const actualMachine = await loadActualMachineArtifacts(
    absoluteRoot,
    generated,
    machineValidators,
  );
  const actualLessons = WATER_PILOT_LESSONS.map((repositoryPath) => (
    lessonRepository.artifacts.find((artifact) => artifact.file === repositoryPath)
  )).filter(Boolean).map((artifact) => artifact.data);
  const thematicArtifact = lessonRepository.artifacts.find(
    (artifact) => artifact.file === WATER_PILOT_THEMATIC,
  );
  if (!thematicArtifact) throw new Error(`missing water thematic plan ${WATER_PILOT_THEMATIC}`);
  const thematic = thematicArtifact.data;
  const materialsIndex = waterPack.data;
  const integrationRows = new Map(
    (actualMachine.integrationIndex?.lessons ?? []).map(
      (row) => [row.lesson_id, row],
    ),
  );
  const lessonPositions = new Map(actualLessons.map(
    (lesson) => [lesson.lesson_id, lesson.position_in_unit],
  ));
  const answerLeaks = findLearnerAnswerLeaks(
    actualLessons,
    await learnerFiles(absoluteRoot, generated),
  );
  const loadErrors = [...actualMachine.loadErrors];
  if (!fingerprintState.computed) {
    loadErrors.push({
      path: WATER_PILOT_INDEX,
      reason: fingerprintState.error,
    });
  }
  const records = [];
  const lessonIdentities = new Map(actualLessons.map((lesson) => [
    lesson.lesson_id,
    computeLessonContentIdentity(lesson),
  ]));
  for (const lesson of actualLessons) {
    const baselineRow = generated.rows.get(lesson.lesson_id);
    const machine = actualMachine.byLesson.get(lesson.lesson_id);
    const actual = {
      ...machine,
      integrationRow: integrationRows.get(lesson.lesson_id),
      baselineRow,
    };
    const closure = lessonDependencyClosure(lesson, baselineRow, materialsIndex);
    const schema = schemaStateForClosure(
      closure,
      validationResults,
      loadErrors,
      actualMachine.artifactStates,
      INTEGRATED_MACHINE_ARTIFACT_KINDS,
    );
    const structure = structureState(lesson, actual, selectionRepository);
    const readiness = readinessState({
      lesson,
      homeschoolPackage: actual.homeschoolPackage,
      evidenceSummary: evidenceState.summary,
    });
    const integratedRecord = {
      kind: 'integrated_lesson',
      artifact_path: WATER_PILOT_LESSONS.find((file) => file.endsWith(
        `/lesson-${String(lesson.position_in_unit).padStart(2, '0')}.yaml`,
      )),
      record_id: lesson.lesson_id,
      checked_artifacts: closure,
      duration_minutes: lesson.duration_minutes,
      schema_valid: schema.valid,
      schema_related_paths: schema.related_paths,
      schema_diagnostics: schema.diagnostics,
      schema_checked_machine_artifacts: schema.checked_machine_artifacts,
      identity: integratedIdentityState(
        lesson,
        actual,
        selectionRepository,
        generatedMismatches,
      ),
      structure,
      timing: timingState(
        lesson,
        actual.integrationRow,
        baselineRow,
      ),
      retrieval: retrievalState(lesson, actual, structure),
      delayed_retrieval: delayedRetrievalState(
        lesson,
        actual,
        thematic,
        lessonPositions,
      ),
      language: languageState(lesson, actual, selectionRepository),
      differentiation: {
        metadata_present:
          Array.isArray(lesson.differentiation?.supports)
          && lesson.differentiation.supports.length > 0,
        hard_constraints_respected:
          actual.selectionDecision?.status === 'success'
          && actual.homeschoolDecision?.status === 'success',
        uncertainty_explicit: (actual.lessonDna?.known_limits ?? []).length > 0,
      },
      alignment: await alignmentState(
        absoluteRoot,
        lesson,
        actual,
        materialsIndex,
      ),
      answer_leaks: answerLeaks.filter((leak) => (
        closure.includes(leak.path)
      )),
      readiness,
      provenance: provenanceState(lesson, actual),
    };
    records.push(integratedRecord);
    const packagePath =
      lesson.pedagogical_integration.generated_artifacts.homeschool_package_path;
    const homeClosure = uniqueSorted([
      `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
      packagePath,
      lesson.pedagogical_integration.generated_artifacts.homeschool_request_path,
      lesson.pedagogical_integration.generated_artifacts.homeschool_decision_path,
      lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
      lesson.pedagogical_integration.generated_artifacts.parent_guidance_path,
      lesson.pedagogical_integration.generated_artifacts.weekly_study_plan_path,
      lesson.pedagogical_integration.generated_artifacts.home_practical_policy_path,
      ...closure.filter((repositoryPath) => repositoryPath.includes('/homeschool/')),
    ]);
    const homeSchema = schemaStateForClosure(
      homeClosure,
      validationResults,
      loadErrors,
      actualMachine.artifactStates,
      HOMESCHOOL_MACHINE_ARTIFACT_KINDS,
    );
    records.push({
      kind: 'homeschool_package',
      artifact_path: packagePath,
      record_id: `${lesson.lesson_id}-homeschool`,
      checked_artifacts: homeClosure,
      schema_valid: homeSchema.valid,
      schema_related_paths: homeSchema.related_paths,
      schema_diagnostics: homeSchema.diagnostics,
      schema_checked_machine_artifacts: homeSchema.checked_machine_artifacts,
      home: homeState(lesson, actual),
      safety: safetyState(lesson, actual, selectionRepository),
      readiness,
    });
  }
  const thematicClosure = uniqueSorted([
    WATER_PILOT_THEMATIC,
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    ...WATER_PILOT_LESSONS,
    ...actualLessons.flatMap(generatedArtifactPaths),
  ]);
  const thematicSchema = schemaStateForClosure(
    thematicClosure,
    validationResults,
    loadErrors,
    actualMachine.artifactStates,
    ['integrationIndex'],
  );
  records.push({
    kind: 'thematic_plan',
    artifact_path: WATER_PILOT_THEMATIC,
    record_id: thematic.unit_id,
    checked_artifacts: thematicClosure,
    schema_valid: thematicSchema.valid,
    schema_related_paths: thematicSchema.related_paths,
    schema_diagnostics: thematicSchema.diagnostics,
    schema_checked_machine_artifacts: thematicSchema.checked_machine_artifacts,
    delayed_retrieval: thematicDelayedState(thematic, actualLessons),
    readiness: readinessState({
      thematic,
      evidenceSummary: evidenceState.summary,
    }),
  });
  const packClosure = uniqueSorted([
    WATER_PILOT_INDEX,
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    ...(fingerprintState.fingerprint?.files ?? []),
    ...evidenceState.summary.evidence_paths,
  ]);
  const packSchema = schemaStateForClosure(
    packClosure,
    validationResults,
    loadErrors,
    actualMachine.artifactStates,
    ['integrationIndex'],
  );
  records.push({
    kind: 'teacher_pack',
    artifact_path: WATER_PILOT_INDEX,
    record_id: materialsIndex.pack_id,
    checked_artifacts: packClosure,
    schema_valid: packSchema.valid,
    schema_related_paths: packSchema.related_paths,
    schema_diagnostics: packSchema.diagnostics,
    schema_checked_machine_artifacts: packSchema.checked_machine_artifacts,
    identity: teacherPackIdentityState(
      thematic,
      materialsIndex,
      lessonIdentities,
      fingerprintState,
      generatedMismatches,
    ),
    readiness: readinessState({
      thematic,
      materialsIndex,
      evidenceSummary: evidenceState.summary,
    }),
    provenance: {
      source_and_pedagogy_separated:
        materialsIndex.canonical_route?.source_id === 'grade-5-science'
        && materialsIndex.pedagogical_integration?.integration_version === '1.0',
      pedagogy_claim_origin_explicit: true,
      official_curriculum_claim_absent: true,
    },
  });
  for (const repositoryPath of WATER_LEGACY_CONTROL_LESSONS) {
    const artifact = lessonRepository.artifacts.find(
      (candidate) => candidate.file === repositoryPath,
    );
    if (!artifact) continue;
    records.push({
      kind: 'legacy_lesson',
      artifact_path: repositoryPath,
      record_id: artifact.data.lesson_id,
      checked_artifacts: [repositoryPath],
      schema_valid: true,
    });
  }
  const currentFingerprint = fingerprintState.fingerprint ?? {
    algorithm: 'sha256',
    specification_version: '1.0',
    value: '0'.repeat(64),
    file_count: 0,
  };
  return {
    ...configuration,
    records,
    upstream: {
      generatedMismatches,
      validationResults,
      fingerprintComputed: fingerprintState.computed,
      machineArtifacts: actualMachine.artifactStates,
    },
    reportMetadata: {
      scopeId: WATER_QUALITY_SCOPE_ID,
      contentIdentities: [
        {
          record_id: thematic.unit_id,
          algorithm: 'sha256',
          value: computeUnitContentIdentity(thematic, lessonIdentities).value,
        },
        ...actualLessons.map((lesson) => ({
          record_id: lesson.lesson_id,
          algorithm: 'sha256',
          value: lessonIdentities.get(lesson.lesson_id).value,
        })),
      ],
      teacherPackFingerprint: {
        algorithm: currentFingerprint.algorithm,
        specification_version: currentFingerprint.specification_version,
        value: currentFingerprint.value,
        file_count: currentFingerprint.file_count,
      },
    },
  };
}
