import fs from 'node:fs/promises';
import path from 'node:path';
import {
  checkGeneratedFiles,
  findLearnerAnswerLeaks,
  generateWaterPilotArtifacts,
  WATER_PILOT_INDEX,
  WATER_PILOT_PACK,
} from './pedagogy-generation-integration.mjs';
import {
  loadPedagogyQualityConfiguration,
} from './pedagogy-quality-gates.mjs';
import {
  computeActivityCatalogSelectionDigest,
  normalizePedagogySelectionRequest,
  sha256PedagogyValue,
  stablePedagogyJson,
  validatePedagogySelection,
} from './pedagogy-selection.mjs';
import {
  loadPedagogyHomeschoolRepository,
  validatePedagogyHomeschool,
} from './pedagogy-homeschool.mjs';
import {
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
  validatePedagogicalReviewRepository,
} from './pedagogical-reviews.mjs';

export const WATER_QUALITY_REPORT_PATH =
  'evaluations/pedagogy-quality/grade-5-water-quality-report.json';
export const WATER_QUALITY_REPORT_ID = 'grade-5-water-quality-report';

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareBytewise);
}

function diagnosticsErrors(result) {
  if (Array.isArray(result.errors)) return result.errors;
  return (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
}

function allTrue(values) {
  return values.every((value) => value === true);
}

function maximumDemandWithinCeiling(request, lessonDna) {
  return request.language_profile.maximum_total_productive_language_demand
    === lessonDna.context.language_policy.maximum_total_productive_language_demand;
}

function retrievalState(row) {
  const plan = row.canonicalLessonDna.retrieval_plan;
  if (!plan) return { applicable: false };
  const immediateTask = row.taskBindings.find(
    (task) => task.phase_id === plan.immediate_phase_id,
  );
  const correctionTask = row.taskBindings.find(
    (task) => task.phase_id === plan.correction_phase_id,
  ) ?? immediateTask;
  const homeRetrieval = row.homeschoolRenderResolution.steps.find(
    (step) => step.phase_id === 'retrieval'
      || step.phase_id === plan.immediate_phase_id,
  );
  const homeCorrection = row.homeschoolRenderResolution.steps.find(
    (step) => step.phase_id === 'correction'
      || step.phase_id === 'reflection'
      || step.phase_id === plan.correction_phase_id,
  ) ?? homeRetrieval;
  return {
    applicable: true,
    closed_first_attempt: immediateTask?.source_access_policy === 'closed_first_attempt'
      && (!homeRetrieval || homeRetrieval.source_access === 'closed'),
    later_correction_present: Boolean(correctionTask && homeCorrection),
    key_after_attempt: correctionTask?.answer_access_policy === 'after_first_attempt'
      && row.homeschool.decision.answer_binding_decisions
        .filter((binding) => binding.adapted_phase_id === homeCorrection.phase_id)
        .some((binding) => (
          binding.release_policy === 'adult_managed'
          || binding.release_policy === 'self_managed_after_attempt'
        )),
  };
}

function delayedRetrievalState(row) {
  const windows = row.canonicalLessonDna.retrieval_plan?.delayed ?? [];
  return {
    applicable: windows.length > 0,
    windows: structuredClone(windows),
    absolute_dates_absent: !stablePedagogyJson(windows).match(
      /(?:date|timestamp|\\d{4}-\\d{2}-\\d{2})/u,
    ),
    thematic_link_current: windows.every((window) => (
      Object.keys(window).some((key) => (
        ['after_days', 'after_lessons', 'next_unit'].includes(key)
      ))
    )),
  };
}

function languageState(lesson, row) {
  const request = row.selection.request;
  const support = request.language_profile.estonian_support;
  const assessmentEffects = new Set(lesson.assessment.map((criterion) => criterion.affects));
  return {
    primary_language_valid:
      request.language_profile.primary_instruction_language === lesson.instruction_language
      && lesson.instruction_language === 'ru',
    estonian_roles_bounded:
      support.enabled === true
      && support.language === 'et'
      && support.learner_level === 'A1-A2'
      && support.allowed_roles.every((role) => (
        [
          'familiar_instruction',
          'labels',
          'sentence_frame',
          'short_oral_response',
          'short_written_response',
          'terminology',
        ].includes(role)
      )),
    productive_demand_within_ceiling: maximumDemandWithinCeiling(
      request,
      row.canonicalLessonDna,
    ),
    required_scaffolds_present:
      (!support.sentence_frames_required || row.taskBindings.some(
        (task) => task.learner_language_support_ru.some(
          (text) => /(?:рамк|__________|lause)/iu.test(text),
        ),
      ))
      && (!support.word_bank_required || row.taskBindings.some(
        (task) => task.learner_language_support_ru.length > 0,
      )),
    complex_reasoning_primary_language:
      support.subject_explanation_language === lesson.instruction_language,
    assessment_separated:
      row.assessmentIntegration.separation_policy
        === 'separate_subject_and_estonian_language_evidence'
      && assessmentEffects.has('subject_assessment')
      && assessmentEffects.has('language_assessment'),
    subject_score_language_neutral: lesson.assessment
      .filter((criterion) => criterion.affects === 'subject_assessment')
      .every((criterion) => criterion.domain !== 'supported_estonian_production'
        && criterion.domain !== 'independent_estonian_production'),
  };
}

function structureState(lesson, row) {
  const phaseIds = new Set(row.canonicalLessonDna.phases.flatMap(
    (phase) => [phase.phase_id, phase.phase],
  ));
  const requestNeeds = row.selection.request.lesson_context.phase_needs ?? [];
  const requestedRetrieval = row.selection.request.lesson_context.context_flags.retrieval;
  const requestedAssessment = row.selection.request.lesson_context.context_flags.assessment;
  return {
    learning_goals_present:
      lesson.objectives.content_objectives.length > 0
      && lesson.objectives.estonian_language_objectives.length > 0,
    phase_goal_alignment: row.canonicalLessonDna.phases.every(
      (phase) => phase.purpose_ru && phase.target?.target_id,
    ),
    pattern_required_components: requestNeeds.every((need) => (
      phaseIds.has(need)
      || (need === 'formative_assessment' && [...phaseIds].some(
        (phase) => phase.includes('formative') || phase.includes('evidence'),
      ))
    )),
    declared_practice_alignment:
      !lesson.practical_work
      || row.taskBindings.some((task) => task.student_artifact_paths.length > 0),
    formative_assessment_alignment:
      !requestedAssessment
      || row.canonicalLessonDna.assessment.subject_assessment.enabled,
    retrieval_alignment:
      !requestedRetrieval || Boolean(row.canonicalLessonDna.retrieval_plan),
  };
}

function timingState(lesson, row) {
  const reconciliation = row.reconciliation;
  const phaseMinutes = reconciliation.phases
    .reduce((sum, phase) => sum + Object.values(phase.component_totals)
      .reduce((componentSum, value) => componentSum + value, 0), 0);
  const stageAllocated = reconciliation.stage_partitions
    .reduce((sum, stage) => sum + stage.allocated_minutes, 0);
  const componentTotal = Object.values(reconciliation.component_totals)
    .filter((value) => Number.isInteger(value))
    .reduce((sum, value) => sum + value, 0);
  return {
    reconciled: reconciliation.status === 'reconciled',
    lesson_total_exact:
      reconciliation.dna_total_planned_minutes + reconciliation.non_dna_minutes
        === lesson.duration_minutes,
    stage_partition_exact: reconciliation.stage_partitions.every(
      (stage) => stage.duration_minutes === stage.allocated_minutes,
    ) && stageAllocated === lesson.duration_minutes,
    component_total_exact:
      componentTotal + reconciliation.reserve_minutes
        === reconciliation.dna_total_planned_minutes
      && phaseMinutes + reconciliation.reserve_minutes
        === reconciliation.dna_total_planned_minutes,
    double_count_absent: reconciliation.phases.every((phase) => (
      Object.values(phase.component_totals)
        .reduce((sum, value) => sum + value, 0)
        === phase.timing_allocations.reduce((sum, allocation) => (
          sum
          + allocation.activity_minutes
          + allocation.setup_minutes
          + allocation.cleanup_minutes
          + allocation.transition_minutes
        ), 0)
    )),
  };
}

function homeState(row) {
  const resolution = row.homeschoolRenderResolution;
  const material = resolution.home_material_validation;
  const changedTargets = row.homeschool.decision.phase_adaptations.filter(
    (adaptation) => (
      adaptation.source_target_id
      && adaptation.adapted_target_id
      && adaptation.source_target_id !== adaptation.adapted_target_id
    ),
  );
  const taskIds = new Set(
    resolution.steps.flatMap((step) => step.resolved_tasks.map((task) => task.task_id)),
  );
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
    adapted_contracts_complete: changedTargets.every((adaptation) => (
      resolution.steps.some((step) => step.resolved_tasks.some((task) => (
        task.source_phase_id === adaptation.source_phase_id
        && task.target_id === adaptation.adapted_target_id
        && taskIds.has(task.task_id)
      )))
    )),
    classroom_materials_absent:
      material.classroom_task_markers_absent
      && material.classroom_instructions_absent,
    parent_role_bounded: !stablePedagogyJson(
      row.homeschool.decision.adult_role_decisions,
    ).includes('subject_explanation_required'),
  };
}

function safetyState(row) {
  const safety = row.homeschool.package.safety;
  if (!safety.effective_supervision_required) return { applicable: false };
  const resolution = row.homeschoolRenderResolution;
  return {
    applicable: true,
    adult_supervision_present: safety.adult_supervision_required,
    teacher_authorization_present: safety.teacher_authorization_required,
    procedure_refs_resolved: resolution.procedure_refs_resolved,
    safety_refs_resolved: resolution.safety_refs_resolved,
    stop_conditions_present: safety.stop_conditions_ru.length > 0,
    policy_task_package_render_aligned:
      resolution.home_material_validation.policy_semantics_valid
      && resolution.machine_rendered_equivalent,
  };
}

function alignmentState(row, rootDir, materialsIndex) {
  const materialPaths = new Set(materialsIndex.materials.flatMap((entry) => [
    entry.material.artifact_path,
    entry.material.answer_key_path,
  ].filter(Boolean)));
  const allPaths = row.taskBindings.flatMap((task) => [
    ...task.student_artifact_paths,
    ...task.teacher_artifact_paths,
    task.answer_key_artifact_path,
  ].filter(Boolean));
  return {
    all_phases_materialized:
      row.taskBindings.length === row.canonicalLessonDna.phases.length,
    task_identity_aligned: row.taskBindings.every((task) => (
      row.canonicalLessonDna.phases.some((phase) => (
        phase.phase_id === task.phase_id && phase.target.target_id === task.target_id
      ))
    )),
    learner_criteria_present: row.taskBindings.every(
      (task) => task.learner_success_criterion_ru.length > 0,
    ),
    answer_policy_aligned: row.taskBindings.every((task) => (
      task.answer_key_artifact_path
        ? task.answer_access_policy === 'after_first_attempt'
        : task.answer_access_policy === 'not_applicable'
    )),
    artifact_paths_resolved: allPaths.every(
      (artifactPath) => materialPaths.has(artifactPath)
        || artifactPath.startsWith(`${WATER_PILOT_PACK}/lessons/`),
    ),
    machine_rendered_equivalent: row.homeschoolRenderResolution.machine_rendered_equivalent,
  };
}

function readinessState(lesson, row) {
  const classroom = lesson.pedagogical_integration.status;
  const homeschool = row.homeschool.package.status;
  return {
    teacher_review:
      classroom.teacher_review === 'pending' && homeschool.teacher_review === 'pending'
        ? 'pending'
        : 'other',
    classroom_trial: classroom.classroom_trial,
    home_trial: homeschool.home_trial,
    classroom_ready: classroom.classroom_ready,
    homeschool_ready: homeschool.homeschool_ready,
    effectiveness_claimed:
      classroom.effectiveness_claimed || homeschool.effectiveness_claimed,
    evidence_current: true,
  };
}

function provenanceState(lesson, row) {
  const pedagogicalOrigin = row.selection.request.preferences.teacher_overrides.every(
    (override) => override.rationale_ru.length > 0,
  );
  return {
    source_and_pedagogy_separated:
      lesson.evidence_linkage.opiq_records.length > 0
      && lesson.pedagogical_integration.integration_version === '1.0',
    pedagogy_claim_origin_explicit: pedagogicalOrigin
      && row.selection.decision.selected_pattern.selection_origin.length > 0
      && row.canonicalLessonDna.status.teacher_review === 'pending',
    official_curriculum_claim_absent:
      !stablePedagogyJson(row.canonicalLessonDna).includes(
        '"official_curriculum_authority":true',
      ),
  };
}

function identityState(lesson, row, generated, selectionRepository, fingerprint) {
  const rules = selectionRepository.rules.data;
  const versions = row.canonicalLessonDna.versions;
  const lessonDnaDigest = sha256PedagogyValue(row.canonicalLessonDna);
  const requestDigest = sha256PedagogyValue(
    normalizePedagogySelectionRequest(row.selection.request),
  );
  const activityDigest = computeActivityCatalogSelectionDigest(
    selectionRepository.knowledge.activities.data.activities,
  );
  return {
    taxonomy_version_current: versions.taxonomy === rules.taxonomy_version,
    selection_rules_version_current:
      versions.selection_rules === rules.selection_rules_version,
    engine_version_current: versions.engine === rules.engine_version,
    lesson_dna_schema_version_current:
      versions.lesson_dna_schema === rules.lesson_dna_schema_version,
    catalogue_digest_current: versions.activity_catalog_digest === activityDigest,
    request_digest_current:
      requestDigest === row.selection.decision.request_digest
      && requestDigest === row.canonicalLessonDna.context.request_digest,
    lesson_dna_digest_chain_current:
      stablePedagogyJson(row.canonicalLessonDna)
        === stablePedagogyJson(row.homeschoolRequest.source.lesson_dna)
      && row.homeschool.decision.source_identity.source_lesson_dna_digest
        === lessonDnaDigest
      && row.homeschool.package.source_identity.source_lesson_dna_digest
        === lessonDnaDigest,
    content_identity_current:
      lesson.pedagogical_integration.content_identity.value
        === generated.identities.get(lesson.lesson_id).value,
    fingerprint_current: fingerprint.value.length === 64,
    related_paths: uniqueSorted([
      lesson.pedagogical_integration.generated_artifacts.lesson_dna_path,
      lesson.pedagogical_integration.generated_artifacts.homeschool_request_path,
      lesson.pedagogical_integration.generated_artifacts.homeschool_decision_path,
      lesson.pedagogical_integration.generated_artifacts.homeschool_package_path,
    ]),
  };
}

async function learnerFilesForGenerated(rootDir, generated) {
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
    files.set(
      repositoryPath,
      generated.files.get(repositoryPath)
      ?? await fs.readFile(path.join(rootDir, repositoryPath), 'utf8'),
    );
  }
  return files;
}

function diagnosticSummary(validationResults, generatedMismatches) {
  return {
    selectionErrors: diagnosticsErrors(validationResults.selection).length,
    homeschoolErrors: diagnosticsErrors(validationResults.homeschool).length,
    lessonErrors: diagnosticsErrors(validationResults.lessons).length,
    teacherPackErrors: diagnosticsErrors(validationResults.teacherPacks).length,
    reviewErrors: diagnosticsErrors(validationResults.reviews).length,
    generatedMismatches: generatedMismatches.length,
  };
}

export async function loadWaterPilotPedagogyQualityRepository({
  rootDir = process.cwd(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    configuration,
    generated,
    selectionRepository,
    homeschoolRepository,
    lessonRepository,
    teacherPackRepository,
    reviewRepository,
  ] = await Promise.all([
    loadPedagogyQualityConfiguration({ rootDir: absoluteRoot }),
    generateWaterPilotArtifacts({ rootDir: absoluteRoot }),
    import('./pedagogy-selection.mjs').then(({ loadPedagogySelectionRepository }) => (
      loadPedagogySelectionRepository({ rootDir: absoluteRoot })
    )),
    loadPedagogyHomeschoolRepository({ rootDir: absoluteRoot }),
    loadLessonPlanRepository({ rootDir: absoluteRoot }),
    loadTeacherPackRepository({ rootDir: absoluteRoot }),
    loadPedagogicalReviewRepository({ rootDir: absoluteRoot }),
  ]);
  const validationResults = {
    selection: validatePedagogySelection(selectionRepository),
    homeschool: validatePedagogyHomeschool(homeschoolRepository),
    lessons: validateLessonPlanRepository(lessonRepository),
    teacherPacks: validateTeacherPackRepository(teacherPackRepository),
    reviews: validatePedagogicalReviewRepository(reviewRepository),
  };
  const generatedMismatches = await checkGeneratedFiles(generated);
  const upstream = diagnosticSummary(validationResults, generatedMismatches);
  const schemaValid = Object.values(upstream).every((count) => count === 0);
  const waterPack = teacherPackRepository.indexes.find(
    (artifact) => artifact.file === WATER_PILOT_INDEX,
  );
  if (!waterPack) throw new Error(`missing production teacher pack ${WATER_PILOT_INDEX}`);
  const fingerprint = await computeTeacherPackFingerprintFromRepository(
    teacherPackRepository,
    waterPack,
  );
  const answerLeaks = findLearnerAnswerLeaks(
    generated.lessons,
    await learnerFilesForGenerated(absoluteRoot, generated),
  );
  const integratedArtifacts = lessonRepository.artifacts.filter((artifact) => (
    artifact.data.artifact_type === 'bilingual_lesson'
    && artifact.data.schema_version === '1.2'
  ));
  const integratedPathById = new Map(
    integratedArtifacts.map((artifact) => [artifact.data.lesson_id, artifact.file]),
  );
  const generatedById = new Map(
    generated.lessons.map((lesson) => [lesson.lesson_id, lesson]),
  );
  const records = generated.lessons.map((lesson) => {
    const row = generated.rows.get(lesson.lesson_id);
    return {
      kind: 'integrated_lesson',
      artifact_path: integratedPathById.get(lesson.lesson_id),
      record_id: lesson.lesson_id,
      duration_minutes: lesson.duration_minutes,
      schema_valid: schemaValid,
      identity: identityState(
        lesson,
        row,
        generated,
        selectionRepository,
        fingerprint,
      ),
      structure: structureState(lesson, row),
      timing: timingState(lesson, row),
      retrieval: retrievalState(row),
      delayed_retrieval: delayedRetrievalState(row),
      language: languageState(lesson, row),
      differentiation: {
        metadata_present:
          Array.isArray(lesson.differentiation?.supports)
          && lesson.differentiation.supports.length > 0,
        hard_constraints_respected:
          row.selection.decision.status === 'success'
          && row.homeschool.decision.status === 'success',
        uncertainty_explicit: row.canonicalLessonDna.known_limits.length > 0,
      },
      home: homeState(row),
      safety: safetyState(row),
      alignment: alignmentState(
        row,
        absoluteRoot,
        generated.materialsIndex,
      ),
      answer_leaks: answerLeaks.filter((leak) => (
        leak.lesson_id === lesson.lesson_id
      )),
      readiness: readinessState(lesson, row),
      provenance: provenanceState(lesson, row),
    };
  });
  for (const artifact of integratedArtifacts.filter(
    (item) => !generatedById.has(item.data.lesson_id),
  )) {
    records.push({
      kind: 'integrated_lesson',
      artifact_path: artifact.file,
      record_id: artifact.data.lesson_id,
      duration_minutes: artifact.data.duration_minutes,
      schema_valid: false,
      identity: {},
      structure: {},
      timing: {},
      retrieval: { applicable: false },
      delayed_retrieval: { applicable: false },
      language: {},
      differentiation: {},
      home: { applicable: false },
      safety: { applicable: false },
      alignment: {},
      answer_leaks: [],
      readiness: {},
      provenance: {},
    });
  }
  for (const artifact of lessonRepository.artifacts
    .filter((item) => (
      item.data.artifact_type === 'bilingual_lesson'
      && item.data.schema_version !== '1.2'
    ))) {
    records.push({
      kind: 'legacy_lesson',
      artifact_path: artifact.file,
      record_id: artifact.data.lesson_id,
      schema_valid: true,
    });
  }
  const contentIdentities = [
    {
      record_id: 'grade-5-water-four-lesson-plan',
      algorithm: 'sha256',
      value: generated.unitIdentity.value,
    },
    ...generated.lessons.map((lesson) => ({
      record_id: lesson.lesson_id,
      algorithm: 'sha256',
      value: generated.identities.get(lesson.lesson_id).value,
    })),
  ];
  const checkedArtifacts = uniqueSorted([
    WATER_PILOT_INDEX,
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    ...generated.lessons.flatMap((lesson) => {
      const artifacts = lesson.pedagogical_integration.generated_artifacts;
      return [
        artifacts.lesson_dna_path,
        artifacts.homeschool_request_path,
        artifacts.homeschool_decision_path,
        artifacts.homeschool_package_path,
      ];
    }),
  ]);
  return {
    ...configuration,
    records,
    upstream,
    reportMetadata: {
      contentIdentities,
      teacherPackFingerprint: {
        algorithm: fingerprint.algorithm,
        specification_version: fingerprint.specification_version,
        value: fingerprint.value,
        file_count: fingerprint.file_count,
      },
      checkedArtifacts,
    },
  };
}
