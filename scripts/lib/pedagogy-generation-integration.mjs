import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  loadPedagogySelectionRepository,
  selectLessonPedagogy,
  serializePedagogyYaml,
  sha256PedagogyValue,
  stablePedagogyJson,
} from './pedagogy-selection.mjs';
import {
  adaptLessonForHomeschool,
  loadPedagogyHomeschoolRepository,
  serializeHomeschoolYaml,
} from './pedagogy-homeschool.mjs';

export const PEDAGOGY_INTEGRATION_VERSION = '1.0';
export const WATER_PILOT_UNIT_ID = 'grade-5-water-four-lesson-plan';
export const WATER_PILOT_PACK = 'teacher-packs/grade-5-science/water';
export const WATER_PILOT_LESSONS = [
  'lesson-plans/grade-5-science/water/lesson-01.yaml',
  'lesson-plans/grade-5-science/water/lesson-02.yaml',
  'lesson-plans/grade-5-science/water/lesson-03.yaml',
  'lesson-plans/grade-5-science/water/lesson-04.yaml',
];
export const WATER_PILOT_THEMATIC =
  'lesson-plans/grade-5-science/water/thematic-plan.yaml';
export const WATER_PILOT_INDEX =
  'teacher-packs/grade-5-science/water/materials-index.yaml';

export const STAGE_COMPATIBILITY_RULES_VERSION = '1.0';

const SEMANTIC_SET_PATHS = new Set([
  'assessment.*.acceptable_variants',
  'content_objectives.*.curriculum_outcome_refs',
  'content_objectives.*.objective_refs',
  'content_objectives.*.official_outcome_refs',
  'language_policy.language_functions',
  'language_policy.languages',
  'language_policy.oral_output_terms_et',
  'practical_science.opiq_source_record_ids',
  'practical_science.provenance_refs',
  'practical_science.safety_requirements',
  'questions.*.acceptable_variants',
  'questions.*.objective_refs',
  'questions.*.provenance_refs',
  'selected_opiq_sources.*.instructional_roles',
  'selected_opiq_sources.*.provenance_refs',
  'source_evidence.*.instructional_roles',
  'source_evidence.*.provenance_refs',
  'subject_success_criteria.*.curriculum_outcome_refs',
  'subject_success_criteria.*.objective_refs',
  'subject_success_criteria.*.official_outcome_refs',
  'unit_content_success_criteria.*.curriculum_outcome_refs',
  'unit_content_success_criteria.*.objective_refs',
  'unit_estonian_language_targets.*.language_functions',
  'unit_learning_outcomes.*.curriculum_outcome_refs',
  'unit_learning_outcomes.*.official_outcome_refs',
]);

const RECORD_SET_PATHS = new Map([
  ['selected_opiq_sources', (row) => `${row.record_id}\u0000${row.canonical_url}`],
  ['source_evidence', (row) => `${row.record_id}\u0000${row.canonical_url}`],
]);

const LANGUAGE_ASSESSMENT_DOMAINS = new Set([
  'estonian_terminology_recognition',
  'supported_estonian_production',
  'independent_estonian_production',
]);

const STANDARD_STAGE_COMPATIBILITY = new Map([
  ['activation', new Set(['activation'])],
  ['orientation', new Set(['activation'])],
  ['explanation', new Set(['russian_concept_explanation', 'estonian_language_bridge'])],
  ['guided_practice', new Set(['guided_practice', 'practical_observation'])],
  ['retrieval', new Set(['independent_output', 'assessment', 'revision'])],
  ['formative_assessment', new Set(['independent_output', 'assessment', 'revision'])],
  ['consolidation', new Set(['revision', 'assessment'])],
  ['reflection', new Set(['assessment', 'independent_output', 'revision'])],
]);

const COMPATIBILITY_EXCEPTIONS = new Map([
  ['embedded_formative_evidence', {
    phases: new Set(['formative_assessment']),
    stageTypes: new Set(['guided_practice', 'practical_observation']),
  }],
  ['language_assessment', {
    phases: new Set(['formative_assessment', 'retrieval']),
    stageTypes: new Set(['estonian_language_bridge']),
  }],
  ['retrieval_activation', {
    phases: new Set(['retrieval']),
    stageTypes: new Set(['activation']),
  }],
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function sorted(values) {
  return [...values].sort(compareBytewise);
}

function uniqueSorted(values) {
  return sorted([...new Set(values)]);
}

function semanticPath(parts) {
  return parts.map((part) => (Number.isInteger(part) ? '*' : part)).join('.');
}

function stableContentValue(value, pathParts = []) {
  if (Array.isArray(value)) {
    const result = value.map((item, index) => stableContentValue(
      item,
      [...pathParts, index],
    ));
    const currentPath = semanticPath(pathParts);
    const recordKey = RECORD_SET_PATHS.get(currentPath);
    if (recordKey) return result.sort((left, right) => compareBytewise(
      recordKey(left),
      recordKey(right),
    ));
    if (SEMANTIC_SET_PATHS.has(currentPath)) {
      return result.sort((left, right) => compareBytewise(
        JSON.stringify(left),
        JSON.stringify(right),
      ));
    }
    return result;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareBytewise)
    .map((childKey) => [
      childKey,
      stableContentValue(value[childKey], [...pathParts, childKey]),
    ]));
}

function contentDigest(value) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableContentValue(value)))
    .digest('hex');
}

export function lessonContentProjection(lesson) {
  return {
    specification_version: '1.0',
    lesson_id: lesson.lesson_id,
    unit_ref: lesson.unit_ref,
    canonical_route: lesson.canonical_route,
    source_evidence: (lesson.evidence_linkage?.opiq_records ?? []).map((record) => ({
      record_id: record.record_id,
      canonical_url: record.canonical_url,
      canonical_source_id: record.canonical_source_id,
      book_id: record.book_id,
      language: record.language,
      programme_type: record.programme_type,
      instructional_roles: record.instructional_roles,
      provenance: record.provenance,
    })),
    content_objectives: lesson.objectives?.content_objectives,
    subject_success_criteria: lesson.objectives?.subject_success_criteria,
    estonian_language_objectives: lesson.objectives?.estonian_language_objectives,
    estonian_success_criteria: lesson.objectives?.estonian_success_criteria,
    anticipated_misconceptions: lesson.objectives?.anticipated_misconceptions,
    questions: (lesson.questions ?? []).map((question) => ({
      question_id: question.question_id,
      question_ru: question.question_ru,
      question_et: question.question_et,
      full_expected_answer_ru: question.full_expected_answer_ru,
      short_oral_answer_et: question.short_oral_answer_et,
      acceptable_variants: question.acceptable_variants,
      misconception_to_watch: question.misconception_to_watch,
      objective_refs: question.objective_refs,
      provenance_refs: question.provenance_refs,
    })),
    language_policy: {
      instruction_language: lesson.instruction_language,
      subject_support_language: lesson.subject_support_language,
      learner_language_level: lesson.learner_language_profile?.learner_language_level,
      assessment_policy: lesson.methodology?.content_language_assessment_policy,
      full_expected_answer_ru: lesson.language_load?.full_expected_answer_ru,
      short_expected_oral_answer_et: lesson.language_load?.short_expected_oral_answer_et,
      oral_output_terms_et: lesson.language_load?.oral_output_terms_et,
    },
    practical_science: lesson.practical_work
      ? {
        work_id: lesson.practical_work.work_id,
        safety_requirements: lesson.practical_work.safety_requirements,
        teacher_controlled_steps: lesson.practical_work.teacher_controlled_steps,
        pupil_steps: lesson.practical_work.pupil_steps,
        materials: lesson.practical_work.materials,
        observation_table: lesson.practical_work.observation_table,
        expected_observation_ru: lesson.practical_work.expected_observation_ru,
        expected_conclusion_ru: lesson.practical_work.expected_conclusion_ru,
        russian_report_target: lesson.practical_work.russian_report_target,
        short_estonian_conclusion: lesson.practical_work.short_estonian_conclusion,
        opiq_source_record_ids: lesson.practical_work.opiq_source_record_ids,
        provenance_refs: lesson.practical_work.provenance_refs,
      }
      : null,
    assessment: lesson.assessment,
  };
}

export function computeLessonContentIdentity(lesson) {
  return {
    specification_version: '1.0',
    algorithm: 'sha256',
    value: contentDigest(lessonContentProjection(lesson)),
  };
}

export function unitContentProjection(thematic, lessonIdentities) {
  return {
    specification_version: '1.0',
    unit_id: thematic.unit_id,
    canonical_route: thematic.canonical_route,
    selected_opiq_sources: (thematic.selected_opiq_sources ?? []).map((source) => ({
      record_id: source.record_id,
      canonical_url: source.canonical_url,
      language: source.language,
      instructional_roles: source.instructional_roles,
      provenance: source.provenance,
    })),
    unit_learning_outcomes: thematic.unit_learning_outcomes,
    unit_content_success_criteria: thematic.unit_content_success_criteria,
    unit_estonian_language_targets: thematic.unit_estonian_language_targets,
    cumulative_glossary: thematic.cumulative_glossary,
    lesson_content_identities: sorted([...lessonIdentities.entries()])
      .map(([lessonId, identity]) => ({
        lesson_id: lessonId,
        content_identity: identity,
      })),
  };
}

export function computeUnitContentIdentity(thematic, lessonIdentities) {
  return {
    specification_version: '1.0',
    algorithm: 'sha256',
    value: contentDigest(unitContentProjection(thematic, lessonIdentities)),
  };
}

export function lessonRequestsEstonianAssessment(lesson) {
  return (lesson.assessment ?? []).some((criterion) => (
    criterion.affects === 'language_assessment'
    || LANGUAGE_ASSESSMENT_DOMAINS.has(criterion.domain)
  ));
}

async function readYaml(rootDir, repositoryPath) {
  const filePath = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  return parseStrictCurriculumYaml(await fs.readFile(filePath, 'utf8'), repositoryPath);
}

function retrievalWindows(selectionInput) {
  return (selectionInput.future_retrieval_windows ?? []).map((entry) => ({
    ...entry.window,
    capability: entry.capability,
  }));
}

export function buildIntegratedSelectionRequest(lesson) {
  const input = lesson.pedagogical_integration.selection_input;
  const supportRoles = [
    'familiar_instruction',
    'labels',
    'sentence_frame',
    'short_oral_response',
    'short_written_response',
    'terminology',
  ];
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogical_selection_request',
    request_id: `${lesson.lesson_id}-classroom-selection`,
    learner_context: {
      grade: lesson.grade,
      subject: lesson.subject,
      delivery_mode: 'classroom',
      group_size: input.delivery.group_size,
      supported_group_formats: input.delivery.supported_group_formats,
      lesson_duration_minutes: lesson.duration_minutes,
      study_context: 'classroom',
    },
    lesson_context: {
      purpose: input.purpose,
      content_types: input.content_types,
      required_capabilities: input.required_capabilities,
      desired_capabilities: input.desired_capabilities,
      phase_needs: input.phase_needs,
      context_flags: input.context_flags,
      previous_target_ids: [],
      future_retrieval_windows: retrievalWindows(input),
      required_pattern_id: input.preferences.required_pattern_id,
    },
    language_profile: {
      primary_instruction_language: lesson.instruction_language,
      maximum_total_productive_language_demand:
        input.maximum_total_productive_language_demand,
      estonian_support: {
        enabled: true,
        language: lesson.subject_support_language,
        learner_level: lesson.learner_language_profile.learner_language_level,
        allowed_roles: supportRoles,
        subject_explanation_language: 'ru',
        sentence_frames_required: true,
        word_bank_required: true,
        assessment_requested: lessonRequestsEstonianAssessment(lesson),
      },
    },
    resources: input.resources,
    constraints: input.constraints,
    preferences: {
      preferred_pattern_ids: [input.preferences.required_pattern_id],
      preferred_target_ids: input.preferences.preferred_target_ids,
      excluded_target_ids: input.preferences.excluded_target_ids,
      avoid_recent_target_ids: [],
      preferred_group_formats: input.preferences.preferred_group_formats,
      teacher_overrides: input.preferences.teacher_overrides.map((override) => ({
        ...override,
        author_role: 'teacher',
      })),
    },
  };
}

function assessmentCriteriaByEffect(lesson, effect) {
  return new Set(
    (lesson.assessment ?? [])
      .filter((criterion) => criterion.affects === effect)
      .map((criterion) => criterion.criterion_id),
  );
}

function normalizeIntegratedAssessment(lesson, lessonDna) {
  const normalized = structuredClone(lessonDna);
  if (!normalized.assessment) return normalized;
  const phaseIds = new Set(normalized.phases.map((phase) => phase.phase_id));
  const bindings = lesson.pedagogical_integration.phase_bindings;
  const languageCriteria = assessmentCriteriaByEffect(lesson, 'language_assessment');
  const subjectCriteria = assessmentCriteriaByEffect(lesson, 'subject_assessment');
  const languageTargets = uniqueSorted(bindings
    .filter((binding) => binding.assessment_refs.some((ref) => languageCriteria.has(ref)))
    .map((binding) => binding.dna_phase_id)
    .filter((phaseId) => phaseIds.has(phaseId)));
  const subjectTargets = uniqueSorted(bindings
    .filter((binding) => binding.assessment_refs.some((ref) => subjectCriteria.has(ref)))
    .map((binding) => binding.dna_phase_id)
    .filter((phaseId) => phaseIds.has(phaseId)));
  const requested = lessonRequestsEstonianAssessment(lesson);
  if (requested && languageTargets.length === 0) {
    throw new Error(`${lesson.lesson_id}: Estonian assessment has no phase binding`);
  }
  normalized.assessment.subject_assessment.enabled = subjectTargets.length > 0;
  normalized.assessment.subject_assessment.target_phase_ids = subjectTargets;
  normalized.assessment.estonian_language_assessment.enabled = requested;
  normalized.assessment.estonian_language_assessment.target_phase_ids =
    requested ? languageTargets : [];
  normalized.assessment.estonian_language_assessment.notes_ru = requested
    ? 'Короткое эстонское evidence A1–A2 фиксируется отдельно от русского предметного доказательства.'
    : 'Эстонское языковое оценивание для этого запроса отключено.';
  return normalized;
}

function selectionResultOrThrow(repository, lesson) {
  const request = buildIntegratedSelectionRequest(lesson);
  const result = selectLessonPedagogy(repository, request);
  if (!result.lessonDna) {
    const details = result.decision.failure?.details?.join('; ') ?? 'unknown failure';
    throw new Error(
      `${lesson.lesson_id} selection failed: ${result.decision.failure?.code}: ${details}`,
    );
  }
  return {
    request,
    decision: result.decision,
    sourceLessonDna: result.lessonDna,
    lessonDna: normalizeIntegratedAssessment(lesson, result.lessonDna),
  };
}

function normalizeHomeschoolAssessment(lesson, result) {
  const normalized = structuredClone(result);
  normalized.homeschoolLessonDna = normalizeIntegratedAssessment(
    lesson,
    normalized.homeschoolLessonDna,
  );
  normalized.package.assessment = {
    subject_assessment:
      normalized.homeschoolLessonDna.assessment.subject_assessment.enabled,
    estonian_language_assessment:
      normalized.homeschoolLessonDna.assessment.estonian_language_assessment.enabled,
    separation_policy:
      normalized.homeschoolLessonDna.assessment.separation_policy,
  };
  return normalized;
}

function bindingByPhase(lesson) {
  return new Map(lesson.pedagogical_integration.phase_bindings
    .map((binding) => [binding.dna_phase_id, binding]));
}

export function reconcileLessonTiming(lesson, lessonDna) {
  const stages = new Map(lesson.stages.map((stage) => [stage.stage_id, stage]));
  const bindings = bindingByPhase(lesson);
  const stageUsage = new Map(lesson.stages.map((stage) => [stage.stage_id, {
    lesson_stage_id: stage.stage_id,
    stage_type: stage.stage_type,
    duration_minutes: stage.duration_minutes,
    phase_allocations: [],
    reserve_minutes: 0,
    non_dna_minutes: 0,
    allocated_minutes: 0,
  }]));
  const phaseTotals = {
    activity_minutes: 0,
    setup_minutes: 0,
    cleanup_minutes: 0,
    transition_minutes: 0,
  };

  function compatible(phase, stage, basis) {
    if (basis === 'standard') {
      return STANDARD_STAGE_COMPATIBILITY.get(phase.phase)?.has(stage.stage_type) ?? false;
    }
    const exception = COMPATIBILITY_EXCEPTIONS.get(basis);
    return Boolean(
      exception?.phases.has(phase.phase)
      && exception.stageTypes.has(stage.stage_type),
    );
  }

  const phaseRows = lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    if (!binding) throw new Error(`${lesson.lesson_id}: unrendered DNA phase ${phase.phase_id}`);
    const allocationStageIds = uniqueSorted(
      binding.timing_allocations.map((allocation) => allocation.lesson_stage_id),
    );
    if (
      stableIntegrationJson(allocationStageIds)
      !== stableIntegrationJson(uniqueSorted(binding.lesson_stage_ids))
    ) {
      throw new Error(
        `${lesson.lesson_id}: phase ${phase.phase_id} lesson_stage_ids do not match `
        + 'timing allocation stages',
      );
    }
    const sums = {
      activity_minutes: 0,
      setup_minutes: 0,
      cleanup_minutes: 0,
      transition_minutes: 0,
    };
    for (const allocation of binding.timing_allocations) {
      const stage = stages.get(allocation.lesson_stage_id);
      if (!stage) {
        throw new Error(
          `${lesson.lesson_id}: unknown timing stage ${allocation.lesson_stage_id}`,
        );
      }
      const allocated = allocation.activity_minutes
        + allocation.setup_minutes
        + allocation.cleanup_minutes
        + allocation.transition_minutes;
      if (allocated <= 0) {
        throw new Error(
          `${lesson.lesson_id}: empty timing allocation for ${phase.phase_id} `
          + `in ${stage.stage_id}`,
        );
      }
      if (!compatible(phase, stage, allocation.compatibility_basis)) {
        throw new Error(
          `${lesson.lesson_id}: semantic stage mismatch for ${phase.phase_id} `
          + `(${phase.phase}) and ${stage.stage_id} (${stage.stage_type}) `
          + `under ${allocation.compatibility_basis}`,
        );
      }
      for (const component of Object.keys(sums)) {
        sums[component] += allocation[component];
        phaseTotals[component] += allocation[component];
      }
      const usage = stageUsage.get(stage.stage_id);
      usage.phase_allocations.push({
        phase_id: phase.phase_id,
        ...allocation,
        allocated_minutes: allocated,
      });
      usage.allocated_minutes += allocated;
      if (usage.allocated_minutes > stage.duration_minutes) {
        throw new Error(
          `${lesson.lesson_id}: stage ${stage.stage_id} capacity `
          + `${stage.duration_minutes} exceeded by ${usage.allocated_minutes}`,
        );
      }
    }
    for (const component of Object.keys(sums)) {
      if (sums[component] !== phase[component]) {
        throw new Error(
          `${lesson.lesson_id}: phase ${phase.phase_id} ${component} allocation `
          + `${sums[component]} does not equal DNA ${phase[component]}`,
        );
      }
    }
    return {
      phase_id: phase.phase_id,
      phase: phase.phase,
      target_id: phase.target.target_id,
      lesson_stage_ids: binding.lesson_stage_ids,
      timing_allocations: binding.timing_allocations,
      component_totals: sums,
      source_access_policy: binding.source_access_policy,
      binding_rationale_ru: binding.binding_rationale_ru,
      status: 'reconciled',
    };
  });
  const declaredStageTotal = lesson.stages
    .reduce((sum, stage) => sum + stage.duration_minutes, 0);
  if (declaredStageTotal !== lesson.duration_minutes) {
    throw new Error(
      `${lesson.lesson_id}: stage total ${declaredStageTotal} does not equal `
      + `${lesson.duration_minutes}`,
    );
  }

  const timingInput = lesson.pedagogical_integration.timing_reconciliation;
  if (timingInput.compatibility_rules_version !== STAGE_COMPATIBILITY_RULES_VERSION) {
    throw new Error(`${lesson.lesson_id}: unsupported stage compatibility rules`);
  }
  let reserveTotal = 0;
  for (const allocation of timingInput.reserve_allocations) {
    const usage = stageUsage.get(allocation.lesson_stage_id);
    if (!usage) throw new Error(
      `${lesson.lesson_id}: unknown reserve stage ${allocation.lesson_stage_id}`,
    );
    usage.reserve_minutes += allocation.minutes;
    usage.allocated_minutes += allocation.minutes;
    reserveTotal += allocation.minutes;
    if (usage.allocated_minutes > usage.duration_minutes) {
      throw new Error(
        `${lesson.lesson_id}: stage ${usage.lesson_stage_id} capacity `
        + `${usage.duration_minutes} exceeded by reserve allocation`,
      );
    }
  }
  let nonDnaTotal = 0;
  for (const allocation of timingInput.non_dna_allocations) {
    const usage = stageUsage.get(allocation.lesson_stage_id);
    if (!usage) throw new Error(
      `${lesson.lesson_id}: unknown non-DNA stage ${allocation.lesson_stage_id}`,
    );
    usage.non_dna_minutes += allocation.minutes;
    usage.allocated_minutes += allocation.minutes;
    nonDnaTotal += allocation.minutes;
    if (usage.allocated_minutes > usage.duration_minutes) {
      throw new Error(
        `${lesson.lesson_id}: stage ${usage.lesson_stage_id} capacity `
        + `${usage.duration_minutes} exceeded by non-DNA allocation`,
      );
    }
  }
  for (const usage of stageUsage.values()) {
    if (usage.allocated_minutes !== usage.duration_minutes) {
      throw new Error(
        `${lesson.lesson_id}: stage ${usage.lesson_stage_id} partitions `
        + `${usage.allocated_minutes}/${usage.duration_minutes} minutes`,
      );
    }
  }
  for (const component of Object.keys(phaseTotals)) {
    if (phaseTotals[component] !== lessonDna.timing[component]) {
      throw new Error(
        `${lesson.lesson_id}: lesson ${component} allocation `
        + `${phaseTotals[component]} does not equal DNA ${lessonDna.timing[component]}`,
      );
    }
  }
  if (reserveTotal !== lessonDna.timing.reserve_minutes) {
    throw new Error(
      `${lesson.lesson_id}: reserve allocation ${reserveTotal} does not equal `
      + `DNA ${lessonDna.timing.reserve_minutes}`,
    );
  }
  if (nonDnaTotal !== lessonDna.timing.unallocated_minutes) {
    throw new Error(
      `${lesson.lesson_id}: non-DNA allocation ${nonDnaTotal} does not equal `
      + `DNA unallocated ${lessonDna.timing.unallocated_minutes}`,
    );
  }
  const phaseComponentTotal = Object.values(phaseTotals)
    .reduce((sum, minutes) => sum + minutes, 0);
  if (phaseComponentTotal + reserveTotal !== lessonDna.timing.total_planned_minutes) {
    throw new Error(
      `${lesson.lesson_id}: phase components plus reserve do not equal DNA planned total`,
    );
  }
  if (phaseComponentTotal + reserveTotal + nonDnaTotal !== lesson.duration_minutes) {
    throw new Error(`${lesson.lesson_id}: timing allocations do not partition 45 minutes`);
  }
  if (!lessonDna.timing.fits || lessonDna.timing.total_planned_minutes > lesson.duration_minutes) {
    throw new Error(`${lesson.lesson_id}: selected DNA does not fit 45 minutes`);
  }
  return {
    lesson_id: lesson.lesson_id,
    lesson_duration_minutes: lesson.duration_minutes,
    declared_stage_total_minutes: declaredStageTotal,
    dna_total_planned_minutes: lessonDna.timing.total_planned_minutes,
    dna_unallocated_minutes: lessonDna.timing.unallocated_minutes,
    compatibility_rules_version: STAGE_COMPATIBILITY_RULES_VERSION,
    component_totals: phaseTotals,
    reserve_minutes: reserveTotal,
    non_dna_minutes: nonDnaTotal,
    phases: phaseRows,
    reserve_allocations: timingInput.reserve_allocations,
    non_dna_allocations: timingInput.non_dna_allocations,
    stage_partitions: [...stageUsage.values()]
      .map((row) => ({
        ...row,
        phase_allocations: row.phase_allocations.sort((left, right) => compareBytewise(
          `${left.phase_id}:${left.lesson_stage_id}`,
          `${right.phase_id}:${right.lesson_stage_id}`,
        )),
      }))
      .sort((left, right) => compareBytewise(left.lesson_stage_id, right.lesson_stage_id)),
    status: 'reconciled',
  };
}

export function resolveProductionMaterialRef(materialId, materialsIndex) {
  const material = materialsIndex.materials
    .map((entry) => entry.material)
    .find((candidate) => candidate.material_id === materialId);
  if (!material) throw new Error(`unresolved production material ${materialId}`);
  return {
    material_id: material.material_id,
    title: material.title,
    artifact_path: material.artifact_path,
    audience: material.audience,
    material_type: material.material_type,
    answer_key_path: material.answer_key_path ?? null,
  };
}

export function resolveLessonContentRef(lesson, reference) {
  const [kind, id, field] = reference.split(':');
  let record;
  if (kind === 'stage') {
    record = lesson.stages.find((candidate) => candidate.stage_id === id);
  } else if (kind === 'question') {
    record = lesson.questions.find((candidate) => candidate.question_id === id);
  } else if (kind === 'assessment') {
    record = lesson.assessment.find((candidate) => candidate.criterion_id === id);
  } else if (kind === 'practical') {
    record = lesson.practical_work?.work_id === id ? lesson.practical_work : null;
  } else {
    throw new Error(`${lesson.lesson_id}: unknown lesson content ref kind ${kind}`);
  }
  const value = field.split('.').reduce(
    (current, part) => (
      current !== null
      && current !== undefined
      && Object.prototype.hasOwnProperty.call(current, part)
        ? current[part]
        : undefined
    ),
    record,
  );
  if (!record || value === undefined) {
    throw new Error(`${lesson.lesson_id}: unresolved lesson content ref ${reference}`);
  }
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`${lesson.lesson_id}: empty lesson content ref ${reference}`);
  }
  return value;
}

function resolvedText(lesson, references) {
  return references.flatMap((reference) => {
    const value = resolveLessonContentRef(lesson, reference);
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [JSON.stringify(value)];
    return [String(value)];
  });
}

function practicalPolicyRefs(policy) {
  if (!policy) return { procedure_refs: [], safety_refs: [] };
  return {
    procedure_refs: [
      `policy:${policy.policy_id}:child_steps_ru`,
      `policy:${policy.policy_id}:adult_steps_ru`,
    ],
    safety_refs: [
      `policy:${policy.policy_id}:safety_controls_ru`,
      `policy:${policy.policy_id}:stop_conditions_ru`,
    ],
  };
}

function contentBindingsForHomeschool(lesson, lessonDna, taskBindings) {
  const bindings = bindingByPhase(lesson);
  const taskByPhase = new Map(taskBindings.map((task) => [task.phase_id, task]));
  const policy = lesson.pedagogical_integration.selection_input.homeschool.practical_policy;
  const policyReferences = practicalPolicyRefs(policy);
  return lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    const task = taskByPhase.get(phase.phase_id);
    const practical = phase.phase_id === 'practical-work'
      || phase.phase_id === 'safety-orientation';
    return {
      phase_id: phase.phase_id,
      learner_material_refs: binding.student_material_ids.length
        ? binding.student_material_ids
        : binding.teacher_material_ids,
      task_refs: [task.task_id],
      answer_key_refs: task.answer_key_artifact_path
        ? binding.answer_key_material_ids
        : [],
      teacher_explanation_refs: binding.teacher_material_ids,
      estonian_support_refs: binding.oral_answer_refs,
      procedure_refs: practical ? policyReferences.procedure_refs : [],
      safety_refs: practical ? policyReferences.safety_refs : [],
    };
  });
}

function adaptationContext(lesson) {
  const input = lesson.pedagogical_integration.selection_input;
  const homeschool = input.homeschool;
  return {
    variant: homeschool.variant,
    learner_count: homeschool.learner_count,
    learner_session_minutes: homeschool.learner_session_minutes,
    maximum_sessions: homeschool.maximum_sessions,
    maximum_total_productive_language_demand:
      homeschool.maximum_total_productive_language_demand,
    resources: structuredClone(homeschool.resources),
    adult_context: structuredClone(homeschool.adult_context),
    accessibility_priorities: input.constraints.accessibility_priorities,
    answer_access_policy: {
      first_attempt_without_answer: true,
      key_release: homeschool.answer_key_release,
      corrections_visible: true,
      correction_method: 'separate_colour',
      unresolved_question_recorded: true,
    },
    teacher_override_policy: homeschool.teacher_override_policy,
    limited_adaptation_policy: 'allow_with_warning',
    homeschool_preferences: {
      preferred_target_ids: [],
      excluded_target_ids: [],
    },
  };
}

function buildHomeschoolRequest(lesson, selectionRequest, lessonDna, taskBindings) {
  return {
    schema_version: '1.0',
    artifact_type: 'homeschool_adaptation_request',
    request_id: `${lesson.lesson_id}-homeschool-adaptation`,
    source: {
      selection_request: selectionRequest,
      lesson_dna: lessonDna,
    },
    adaptation_context: adaptationContext(lesson),
    content_bindings: contentBindingsForHomeschool(lesson, lessonDna, taskBindings),
  };
}

function targetNameRu(selectionRepository, targetId) {
  const [activityId, profileId = null] = targetId.split('::');
  const activity = selectionRepository.knowledge.activities.data.activities
    .find((candidate) => candidate.activity_id === activityId);
  if (!activity) throw new Error(`unknown selected activity ${activityId}`);
  if (!profileId) return activity.names.ru;
  const profile = activity.execution_profiles
    ?.find((candidate) => candidate.profile_id === profileId);
  if (!profile) throw new Error(`unknown selected execution profile ${targetId}`);
  return profile.names.ru;
}

function teacherRegion(
  lesson,
  lessonDna,
  reconciliation,
  selectionRepository,
  generatedTaskBindings,
) {
  const taskByPhase = new Map(generatedTaskBindings.map((task) => [task.phase_id, task]));
  const phaseSections = lessonDna.phases.flatMap((phase) => {
    const timing = reconciliation.phases.find((row) => row.phase_id === phase.phase_id);
    const task = taskByPhase.get(phase.phase_id);
    const timingLines = timing.timing_allocations.map((allocation) => (
      `- \`${allocation.lesson_stage_id}\`: activity ${allocation.activity_minutes}, `
      + `setup ${allocation.setup_minutes}, cleanup ${allocation.cleanup_minutes}, `
      + `transition ${allocation.transition_minutes}; `
      + `compatibility \`${allocation.compatibility_basis}\`.`
    ));
    return [
      `### ${phase.phase_id}: ${targetNameRu(selectionRepository, phase.target.target_id)}`,
      '',
      `- Target: \`${phase.target.target_id}\`.`,
      `- Execution mode: \`${task.execution_mode}\`.`,
      `- Ученическое действие: ${task.learner_instruction_ru}`,
      `- Ожидаемое evidence: ${task.expected_evidence_ru}`,
      `- Действие учителя: ${task.teacher_action_ru}`,
      `- Source access: \`${task.source_access_policy}\`.`,
      `- Evaluation: \`${task.evaluation_mode}\`; answer access: \`${task.answer_access_policy}\`.`,
      `- Assessment refs: ${task.assessment_refs.length ? task.assessment_refs.map((ref) => `\`${ref}\``).join(', ') : 'нет'}.`,
      `- Language support: ${task.language_support_ru.length ? task.language_support_ru.join('; ') : 'не требуется'}.`,
      `- Safety: ${task.safety_controls_ru.length ? task.safety_controls_ru.join('; ') : 'специальные меры не требуются'}.`,
      `- Binding rationale: ${timing.binding_rationale_ru}`,
      '',
      '**Распределение времени:**',
      '',
      ...timingLines,
      '',
      `Selection rationale: ${phase.rationale_ru}`,
      '',
    ];
  });
  return [
    '## Сгенерированная педагогическая структура',
    '',
    `Паттерн: **${lessonDna.pattern.pattern_id}**. Это операционное предложение,`,
    'которое ожидает независимого педагогического ревью и не является заявлением об эффективности.',
    '',
    `Timing compatibility rules: \`${reconciliation.compatibility_rules_version}\`.`,
    'Все activity/setup/cleanup/transition минуты явно распределены по существующим стадиям.',
    '',
    ...phaseSections,
    '',
    'Сложное предметное объяснение остаётся русскоязычным. Эстонский ограничен',
    'терминами, подписями, знакомыми инструкциями, рамками и коротким ответом A1–A2.',
  ].join('\n');
}

function sourceAccessInstruction(policy) {
  if (policy === 'closed_first_attempt') {
    return 'Закрой источник до завершения первой попытки.';
  }
  if (policy === 'teacher_managed') {
    return 'Используй только тот источник или материал, который открыл учитель или взрослый.';
  }
  return 'Источник можно держать открытым в пределах указанного задания.';
}

function answerAccessInstruction(policy) {
  if (policy === 'after_first_attempt') {
    return 'Ключ разрешён после самостоятельной первой попытки.';
  }
  if (policy === 'adult_managed') {
    return 'Ключ выдаёт взрослый только после видимой первой попытки.';
  }
  if (policy === 'self_managed_after_attempt') {
    return 'После видимой первой попытки открой ключ самостоятельно.';
  }
  return 'Ключ для этого действия не используется.';
}

function methodSemanticsSatisfied(targetId, instruction) {
  const rules = [
    [/^brainstorming$/u, /до объяснения|первоначальн/iu],
    [/^guided-reading$/u, /прочитай|открой.*источник|opiq/iu],
    [/^concept-map$/u, /узл|связ/iu],
    [/^one-minute-recall$/u, /закрой.*источник|по памяти/iu],
    [/^retrieval-self-test$/u, /попытк.*(?:свер|пров)|(?:свер|пров).*попытк/iu],
    [/^frayer-model$/u, /определени.*признак.*пример.*непример/iu],
    [/^error-correction$/u, /сохрани.*перв.*попыт|исправ.*объясни/iu],
    [/^venn-diagram$/u, /круг|венн/iu],
    [/^sorting-and-sequencing$/u, /распредели|разлож|последователь/iu],
    [/^visual-representation$/u, /схем|изобраз/iu],
    [/^retrieval-summary$/u, /закрой.*источник|по памяти/iu],
    [/^learning-stations::practical-/u, /разрешенн.*шаг|наблюд.*запи(?:с|ш)/iu],
  ];
  const rule = rules.find(([pattern]) => pattern.test(targetId));
  return rule ? rule[1].test(instruction) : true;
}

export function taskBindings(lesson, lessonDna, materialsIndex) {
  const bindings = bindingByPhase(lesson);
  const taskIds = new Set();
  return lessonDna.phases.map((phase) => {
    const binding = bindings.get(phase.phase_id);
    const contract = binding.render_contract;
    if (taskIds.has(contract.task_id)) {
      throw new Error(`${lesson.lesson_id}: duplicate task ID ${contract.task_id}`);
    }
    taskIds.add(contract.task_id);
    if (!methodSemanticsSatisfied(phase.target.target_id, contract.learner_instruction_ru)) {
      throw new Error(
        `${lesson.lesson_id}: ${phase.phase_id} instruction does not materialize `
        + `${phase.target.target_id}`,
      );
    }
    const studentMaterials = binding.student_material_ids
      .map((materialId) => resolveProductionMaterialRef(materialId, materialsIndex));
    const teacherMaterials = binding.teacher_material_ids
      .map((materialId) => resolveProductionMaterialRef(materialId, materialsIndex));
    const answerMaterials = binding.answer_key_material_ids
      .map((materialId) => resolveProductionMaterialRef(materialId, materialsIndex));
    const answerBearing = ['answer_key', 'evidence_criterion']
      .includes(contract.evaluation_mode);
    if (answerBearing && answerMaterials.length !== 1) {
      throw new Error(
        `${lesson.lesson_id}: ${phase.phase_id} answer-bearing task requires one key`,
      );
    }
    if (!answerBearing && answerMaterials.length !== 0) {
      throw new Error(
        `${lesson.lesson_id}: ${phase.phase_id} no-key evaluation has a fictitious key`,
      );
    }
    if (
      answerBearing
      && !['after_first_attempt', 'adult_managed', 'self_managed_after_attempt']
        .includes(contract.answer_access_policy)
    ) {
      throw new Error(`${lesson.lesson_id}: ${phase.phase_id} key has no release rule`);
    }
    if (!answerBearing && contract.answer_access_policy !== 'not_applicable') {
      throw new Error(`${lesson.lesson_id}: ${phase.phase_id} no-key task has key access`);
    }
    if (studentMaterials.length === 0) {
      throw new Error(`${lesson.lesson_id}: ${phase.phase_id} lacks learner artifact`);
    }
    return {
      task_id: contract.task_id,
      lesson_id: lesson.lesson_id,
      phase_id: phase.phase_id,
      target_id: phase.target.target_id,
      execution_mode: contract.execution_mode,
      learner_instruction_ru: contract.learner_instruction_ru,
      student_artifact_paths: uniqueSorted(
        studentMaterials.map((material) => material.artifact_path),
      ),
      student_materials: studentMaterials,
      teacher_artifact_paths: uniqueSorted(
        teacherMaterials.map((material) => material.artifact_path),
      ),
      answer_key_artifact_path: answerMaterials[0]?.artifact_path ?? null,
      evaluation_mode: contract.evaluation_mode,
      source_access_policy: binding.source_access_policy,
      answer_access_policy: contract.answer_access_policy,
      prompt_source_refs: contract.prompt_source_refs,
      prompt_ru: resolvedText(lesson, contract.prompt_source_refs),
      evidence_source_refs: contract.expected_evidence_source_refs,
      expected_evidence_ru: resolvedText(
        lesson,
        contract.expected_evidence_source_refs,
      ).join(' '),
      teacher_action_source_refs: contract.teacher_action_source_refs,
      teacher_action_ru: resolvedText(
        lesson,
        contract.teacher_action_source_refs,
      ).join(' '),
      language_support_refs: contract.language_support_refs,
      language_support_ru: resolvedText(lesson, contract.language_support_refs),
      assessment_refs: binding.assessment_refs,
      oral_answer_refs: binding.oral_answer_refs,
      safety_controls_ru: uniqueSorted(phase.safety.controls_ru),
    };
  });
}

function studentPhaseRegion(lesson, task, material, selectionRepository) {
  const language = task.language_support_ru.length
    ? task.language_support_ru.join('; ')
    : 'Для этого действия отдельная эстонская продукция не требуется.';
  return [
    `## ${targetNameRu(selectionRepository, task.target_id)}`,
    '',
    `<!-- task_id: ${task.task_id} -->`,
    '',
    `Материал: **${material.title}**`,
    '',
    `Путь: \`${material.artifact_path}\``,
    '',
    `Инструкция: ${task.learner_instruction_ru}`,
    '',
    sourceAccessInstruction(task.source_access_policy),
    '',
    `Что должно остаться после работы: ${task.expected_evidence_ru}`,
    '',
    `Эстонская поддержка: ${language}`,
    '',
    answerAccessInstruction(task.answer_access_policy),
    '',
    task.answer_key_artifact_path
      ? 'После сверки сохрани первую попытку и исправь неточность другим цветом.'
      : 'Учитель или взрослый фиксирует наблюдаемое действие; скрытого ответа здесь нет.',
  ].join('\n');
}

function answerRegion(lesson, generatedTaskBindings) {
  const answerTasks = generatedTaskBindings.filter(
    (binding) => binding.answer_key_artifact_path,
  );
  const taskSections = answerTasks.flatMap((binding) => [
    `### \`${binding.task_id}\``,
    '',
    `- Phase: \`${binding.phase_id}\`.`,
    `- Evaluation: \`${binding.evaluation_mode}\`.`,
    `- Prompt source refs: ${binding.prompt_source_refs.map((ref) => `\`${ref}\``).join(', ')}.`,
    `- Evidence source refs: ${binding.evidence_source_refs.map((ref) => `\`${ref}\``).join(', ')}.`,
    `- Ожидаемое evidence: ${binding.expected_evidence_ru}`,
    `- Допустимая языковая опора: ${binding.language_support_ru.length ? binding.language_support_ru.join('; ') : 'нет'}.`,
    `- Доступ: \`${binding.answer_access_policy}\`; первая попытка сохраняется.`,
    `- Типичная ошибка: ${lesson.questions[0].misconception_to_watch}`,
    '- Частично правильный ответ сохраняет корректную часть evidence, после чего ученик явно исправляет недостающую связь.',
    '- Предметный смысл русского ответа и короткая эстонская продукция фиксируются отдельно.',
    '',
  ]);
  return [
    '## Сгенерированные evidence и ключи по этапам',
    '',
    `Lesson ID: \`${lesson.lesson_id}\`.`,
    '',
    ...taskSections,
    '',
    'Предметное понимание оценивается по научному смыслу русского ответа. Качество',
    'эстонской формы фиксируется отдельно и не снижает предметный результат автоматически.',
  ].join('\n');
}

export function applyGeneratedRegion(source, regionId, body) {
  const begin = `<!-- OPIQ-PEDAGOGY:BEGIN ${regionId} -->`;
  const end = `<!-- OPIQ-PEDAGOGY:END ${regionId} -->`;
  const beginCount = source.split(begin).length - 1;
  const endCount = source.split(end).length - 1;
  if (beginCount > 1 || endCount > 1) throw new Error(`duplicate generated region ${regionId}`);
  if (beginCount !== endCount) throw new Error(`broken generated region ${regionId}`);
  const region = `${begin}\n${body.trim()}\n${end}`;
  if (beginCount === 0) {
    if (/<!-- OPIQ-PEDAGOGY:(?:BEGIN|END)/u.test(source)) {
      const opens = source.match(/<!-- OPIQ-PEDAGOGY:BEGIN/gu)?.length ?? 0;
      const closes = source.match(/<!-- OPIQ-PEDAGOGY:END/gu)?.length ?? 0;
      if (opens !== closes) throw new Error('broken generated region outside requested marker');
    }
    return `${source.trimEnd()}\n\n${region}\n`;
  }
  const start = source.indexOf(begin);
  const finish = source.indexOf(end, start);
  if (finish < start) throw new Error(`nested or reversed generated region ${regionId}`);
  return `${source.slice(0, start)}${region}${source.slice(finish + end.length)}`;
}

export function removeGeneratedRegion(source, regionId) {
  const begin = `<!-- OPIQ-PEDAGOGY:BEGIN ${regionId} -->`;
  const end = `<!-- OPIQ-PEDAGOGY:END ${regionId} -->`;
  const start = source.indexOf(begin);
  if (start < 0) return source;
  const finish = source.indexOf(end, start);
  if (finish < 0) throw new Error(`broken generated region ${regionId}`);
  const before = source.slice(0, start).trimEnd();
  const after = source.slice(finish + end.length).trimStart();
  return `${before}${before && after ? '\n\n' : ''}${after}`.trimEnd() + '\n';
}

function oralStudentMarkdown(lessons) {
  const blocks = lessons.map((lesson) => {
    const question = lesson.questions[0];
    return [
      `## Урок ${lesson.position_in_unit}: ${lesson.title_ru}`,
      '',
      `Вопрос: ${question.question_ru}`,
      '',
      'Моя первая попытка по-русски:',
      '',
      '__________________________________________________________________',
      '',
      `Короткий вопрос по-эстонски: ${question.question_et}`,
      '',
      'Мой короткий ответ:',
      '',
      '__________________________________________________________________',
      '',
      `Слова для подготовки: ${lesson.language_load.oral_output_terms_et.join(', ')}.`,
      '',
      'После первой попытки попроси ключ, сравни смысл и исправь неточность другим цветом.',
    ].join('\n');
  });
  return [
    '# Подготовка устного ответа: блок «Вода»',
    '',
    'Сначала отвечай без ключа. Полное научное объяснение дай по-русски;',
    'по-эстонски требуется только короткий поддержанный ответ A1–A2.',
    '',
    ...blocks,
    '',
    'Provenance: вопросы и языковые цели взяты из четырёх production lesson YAML;',
    'новые научные ответы не создавались.',
    '',
  ].join('\n');
}

function oralTeacherMarkdown(lessons) {
  const blocks = lessons.map((lesson) => {
    const question = lesson.questions[0];
    return [
      `## ${lesson.lesson_id}`,
      '',
      `Вопрос: ${question.question_ru}`,
      '',
      `Полный ожидаемый ответ по-русски: ${question.full_expected_answer_ru}`,
      '',
      `Короткий ответ по-эстонски: ${question.short_oral_answer_et}`,
      '',
      `Допустимые варианты: ${(question.acceptable_variants ?? []).join('; ')}`,
      '',
      `Исправляемое заблуждение: ${question.misconception_to_watch}`,
      '',
      'Предметный и эстонский языковой результат фиксируются отдельно.',
    ].join('\n');
  });
  return [
    '# Ключ и руководство к подготовке устного ответа',
    '',
    ...blocks,
    '',
    'Provenance: ответы воспроизведены из существующих question records lesson YAML.',
    '',
  ].join('\n');
}

function resolvePolicyRef(policyArtifact, reference) {
  const [kind, policyId, field] = reference.split(':');
  if (
    kind !== 'policy'
    || !policyArtifact
    || policyArtifact.policy_id !== policyId
    || !(field in policyArtifact)
  ) {
    throw new Error(`unresolved home practical policy ref ${reference}`);
  }
  return policyArtifact[field];
}

export function buildHomePracticalPolicyArtifact(
  lesson,
  lessonDna,
  homeschoolResult,
) {
  const policy = lesson.pedagogical_integration.selection_input.homeschool.practical_policy;
  if (!policy) return null;
  const source = lessonDna.phases.find(
    (phase) => policy.applies_to_phase_ids.includes(phase.phase_id),
  );
  const adaptation = homeschoolResult.decision.phase_adaptations.find(
    (row) => row.source_phase_id === source?.phase_id,
  );
  if (!source || !adaptation?.adapted_target_id) {
    throw new Error(`${lesson.lesson_id}: home practical target is unresolved`);
  }
  return {
    schema_version: '1.0',
    artifact_type: 'home_practical_policy',
    policy_id: policy.policy_id,
    lesson_id: lesson.lesson_id,
    lesson_content_identity: lesson.pedagogical_integration.content_identity,
    applies_to_phase_ids: policy.applies_to_phase_ids,
    source_classroom_target_id: source.target.target_id,
    adapted_home_target_id: adaptation.adapted_target_id,
    teacher_authorization_required: policy.teacher_authorization_required,
    adult_supervision_required: policy.adult_supervision_required,
    allowed_materials_ru: policy.allowed_materials_ru,
    forbidden_materials_ru: policy.forbidden_materials_ru,
    child_steps_ru: policy.child_steps_ru,
    adult_steps_ru: policy.adult_steps_ru,
    prohibited_actions_ru: policy.prohibited_actions_ru,
    stop_conditions_ru: policy.stop_conditions_ru,
    safety_controls_ru: policy.safety_controls_ru,
    procedure_source_refs: policy.procedure_source_refs,
    safety_source_refs: policy.safety_source_refs,
    home_resources: lesson.pedagogical_integration.selection_input.homeschool.resources,
    homework_relationship: policy.homework_relationship,
    status: policy.status,
  };
}

function applyHomePracticalPolicy(result, policyArtifact) {
  if (!policyArtifact) return result;
  const normalized = structuredClone(result);
  const affected = new Set([
    ...policyArtifact.applies_to_phase_ids,
    'safety-orientation',
  ]);
  for (const phase of normalized.homeschoolLessonDna.phases) {
    if (!affected.has(phase.phase_id)) continue;
    phase.safety.requires_adult_supervision = true;
    phase.safety.controls_ru = [...policyArtifact.safety_controls_ru];
  }
  for (const step of normalized.package.learner_plan.steps) {
    if (!affected.has(step.phase_id)) continue;
    step.safety_controls_ru = [...policyArtifact.safety_controls_ru];
  }
  normalized.package.safety.controls_ru = [...policyArtifact.safety_controls_ru];
  normalized.package.safety.stop_conditions_ru = [...policyArtifact.stop_conditions_ru];
  normalized.parentGuidance.safety.controls_ru = [...policyArtifact.safety_controls_ru];
  return normalized;
}

export function resolveHomeschoolRendering(
  lesson,
  result,
  generatedTaskBindings,
  materialsIndex,
  policyArtifact,
) {
  const taskById = new Map(generatedTaskBindings.map((task) => [task.task_id, task]));
  const adaptationBySourcePhase = new Map(
    result.decision.phase_adaptations
      .filter((adaptation) => adaptation.source_phase_id)
      .map((adaptation) => [adaptation.source_phase_id, adaptation]),
  );

  function adaptedInstruction(task, targetId) {
    if (targetId === task.target_id) return task.learner_instruction_ru;
    if (targetId === 'true-false-anticipation') {
      return `До чтения отметь «верно» или «неверно» для двух первоначальных идей: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'kwl-table') {
      return `Заполни две короткие графы «знаю» и «хочу узнать», используя исходный вопрос: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'venn-diagram') {
      return `Нарисуй два пересекающихся круга Венна и размести в них элементы задания: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'learning-stations::paper-classification') {
      return `Разложи бумажные элементы по категориям, затем проверь спорный пример: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'exit-ticket') {
      return `Выполни короткую выходную карточку без источника, затем проверь evidence: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'error-correction') {
      return `Сохрани первую попытку, исправь одну ошибку другим цветом и объясни исправление: ${task.learner_instruction_ru}`;
    }
    if (targetId === 'learning-stations::practical-home-passive-ice-observation') {
      if (!policyArtifact) {
        throw new Error(`${lesson.lesson_id}: home practical task lacks policy`);
      }
      return policyArtifact.child_steps_ru.join(' ');
    }
    throw new Error(
      `${lesson.lesson_id}: no materialization rule for ${task.target_id} -> ${targetId}`,
    );
  }

  const stepRows = result.package.learner_plan.steps.map((step) => {
    const materials = step.material_refs
      .map((materialId) => resolveProductionMaterialRef(materialId, materialsIndex));
    const tasks = step.task_refs.map((taskId) => {
      const task = taskById.get(taskId);
      if (!task) throw new Error(`${lesson.lesson_id}: unresolved homeschool task ${taskId}`);
      const adaptation = adaptationBySourcePhase.get(task.phase_id);
      const targetId = adaptation?.adapted_target_id ?? task.target_id;
      const instruction = adaptedInstruction(task, targetId);
      if (!methodSemanticsSatisfied(targetId, instruction)) {
        throw new Error(
          `${lesson.lesson_id}: adapted ${step.phase_id} task does not materialize ${targetId}`,
        );
      }
      return {
        ...task,
        task_id: targetId === task.target_id
          ? task.task_id
          : `${task.task_id}--home-${step.phase_id}`,
        source_task_ref: task.task_id,
        source_phase_id: task.phase_id,
        phase_id: step.phase_id,
        target_id: targetId,
        learner_instruction_ru: instruction,
        safety_controls_ru:
          targetId === 'learning-stations::practical-home-passive-ice-observation'
            ? policyArtifact.safety_controls_ru
            : task.safety_controls_ru,
      };
    });
    if (tasks.length === 0) {
      throw new Error(`${lesson.lesson_id}: homeschool step ${step.step_id} has no task`);
    }
    return {
      ...step,
      resolved_materials: materials,
      resolved_tasks: tasks,
    };
  });
  const bindingRows = result.package.materials.phase_binding_summary.map((binding) => {
    const procedures = binding.procedure_refs.map(
      (reference) => resolvePolicyRef(policyArtifact, reference),
    );
    const safety = binding.safety_refs.map(
      (reference) => resolvePolicyRef(policyArtifact, reference),
    );
    for (const answerId of binding.answer_key_refs) {
      resolveProductionMaterialRef(answerId, materialsIndex);
    }
    return {
      adapted_phase_id: binding.adapted_phase_id,
      procedure_refs: binding.procedure_refs,
      safety_refs: binding.safety_refs,
      procedures,
      safety,
    };
  });
  const answerPaths = uniqueSorted(generatedTaskBindings
    .map((task) => task.answer_key_artifact_path)
    .filter(Boolean));
  return {
    content_refs_resolved: true,
    task_refs_resolved: true,
    answer_refs_resolved: true,
    procedure_refs_resolved: true,
    safety_refs_resolved: true,
    steps: stepRows,
    phase_bindings: bindingRows,
    answer_key_paths: answerPaths,
  };
}

function homeschoolLessonMarkdown(lesson, result, resolution, policyArtifact) {
  const packageArtifact = result.package;
  const urls = lesson.evidence_linkage.opiq_records
    .map((record) => `- [${record.title}](${record.canonical_url})`);
  const safety = policyArtifact
    ? [
      '## Безопасность',
      '',
      ...policyArtifact.safety_controls_ru.map((control) => `- ${control}`),
      '',
      '**Разрешённые материалы:**',
      '',
      ...policyArtifact.allowed_materials_ru.map((material) => `- ${material}`),
      '',
      '**Шаги ребёнка:**',
      '',
      ...policyArtifact.child_steps_ru.map((step) => `- ${step}`),
      '',
      '**Запрещено:**',
      '',
      ...policyArtifact.prohibited_actions_ru.map((action) => `- ${action}`),
      '',
      '**Остановись, если:**',
      '',
      ...policyArtifact.stop_conditions_ru.map((condition) => `- ${condition}`),
      '',
      '- Взрослый не объясняет предметный вывод вместо ребёнка.',
      '',
    ]
    : [];
  const stepBlocks = resolution.steps.flatMap((step, index) => {
    const materials = step.resolved_materials.flatMap((material) => [
      `- **${material.title}**`,
      `  \`${material.artifact_path}\``,
    ]);
    const tasks = step.resolved_tasks.flatMap((task) => [
      `#### Действие: ${task.learner_instruction_ru}`,
      '',
      `- Source access: ${sourceAccessInstruction(task.source_access_policy)}`,
      `- Ожидаемое evidence: ${task.expected_evidence_ru}`,
      `- Estonian support: ${task.language_support_ru.length ? task.language_support_ru.join('; ') : 'не требуется'}.`,
      `- Answer access: ${answerAccessInstruction(task.answer_access_policy)}`,
      task.answer_key_artifact_path
        ? `- Ключ: \`${task.answer_key_artifact_path}\`. После сверки исправь ошибку другим цветом.`
        : '- Ключ не используется; действие проверяется по наблюдаемому evidence.',
      '',
    ]);
    return [
      `### Шаг ${index + 1} — около ${step.learner_minutes} минут`,
      '',
      'Открой перечисленные ниже файлы и выполни каждое конкретное действие по порядку.',
      '',
      '**Материалы:**',
      '',
      ...materials,
      '',
      ...tasks,
    ];
  });
  return [
    `# ${lesson.title_ru}: домашний вариант`,
    '',
    `Content identity: \`${lesson.pedagogical_integration.content_identity.value}\``,
    '',
    'Это сгенерированный вариант существующего урока, а не отдельная программа.',
    'Сложное объяснение остаётся по-русски; эстонский ограничен заявленной поддержкой.',
    '',
    '## Порядок работы',
    '',
    ...stepBlocks,
    '',
    ...safety,
    '## Opiq',
    '',
    ...urls,
    '',
    'Статус: teacher review pending; home trial not started; homeschool_ready: false.',
    '',
  ].join('\n');
}

function parentLessonMarkdown(lesson, result, resolution, policyArtifact) {
  const preparation = uniqueSorted(resolution.steps.flatMap(
    (step) => step.resolved_materials.map(
      (material) => `${material.title} — ${material.artifact_path}`,
    ),
  ));
  const safety = policyArtifact
    ? [
      '',
      '## Надзор и остановка',
      '',
      ...policyArtifact.adult_steps_ru.map((step) => `- ${step}`),
      ...policyArtifact.stop_conditions_ru.map((condition) => `- Стоп: ${condition}`),
      '',
      `Teacher authorization required: ${policyArtifact.teacher_authorization_required}.`,
      `Adult supervision required: ${policyArtifact.adult_supervision_required}.`,
    ]
    : [];
  return [
    `# Роль взрослого: ${lesson.title_ru}`,
    '',
    `Вариант: \`${result.package.context.variant}\`.`,
    '',
    `- Ответственность ребёнка: ${result.parentGuidance.responsibility_boundary.child_responsibility_ru}`,
    `- Поддержка взрослого: ${result.parentGuidance.responsibility_boundary.adult_support_ru}`,
    `- Надзор безопасности: ${result.parentGuidance.responsibility_boundary.adult_safety_supervision_ru}`,
    `- Ответственность учителя: ${result.parentGuidance.responsibility_boundary.subject_teacher_responsibility_ru}`,
    `- Общее время взрослого: ${result.parentGuidance.timing.total_adult_minutes} минут.`,
    '',
    '## Что подготовить',
    '',
    ...preparation.map((item) => `- ${item}`),
    '',
    '## Доступ к ответам',
    '',
    `- ${answerAccessInstruction(
      lesson.pedagogical_integration.selection_input.homeschool.answer_key_release,
    )}`,
    ...resolution.answer_key_paths.map((answerPath) => `- Ключ: \`${answerPath}\`.`),
    '',
    'Взрослый не является автоматически предметным учителем и не формулирует',
    'научный ответ вместо ребёнка. Нерешённый предметный вопрос передаётся учителю.',
    ...safety,
    '',
    'Статус: педагогическое ревью ожидается; домашняя апробация не начата.',
    '',
  ].join('\n');
}

function integrationIndex(lessons, unitIdentity, rows) {
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogy_generation_integration_index',
    integration_version: PEDAGOGY_INTEGRATION_VERSION,
    unit_id: WATER_PILOT_UNIT_ID,
    unit_content_identity: unitIdentity,
    lessons: lessons.map((lesson) => {
      const row = rows.get(lesson.lesson_id);
      return {
        lesson_id: lesson.lesson_id,
        content_identity: lesson.pedagogical_integration.content_identity,
        selection_request_path:
          lesson.pedagogical_integration.generated_artifacts.selection_request_path,
        selection_request_digest: row.selection.decision.request_digest,
        selection_decision_path:
          lesson.pedagogical_integration.generated_artifacts.selection_decision_path,
        lesson_dna_path: lesson.pedagogical_integration.generated_artifacts.lesson_dna_path,
        lesson_dna_digest: sha256PedagogyValue(row.lessonDna),
        selected_pattern_id: row.lessonDna.pattern.pattern_id,
        selected_target_ids: row.lessonDna.phases.map((phase) => phase.target.target_id),
        task_bindings: row.taskBindings,
        timing_reconciliation: row.reconciliation,
        classroom_rendered_paths: row.classroomRenderedPaths,
        estonian_assessment: row.lessonDna.assessment.estonian_language_assessment,
        homeschool_request_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_request_path,
        homeschool_decision_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_decision_path,
        homeschool_package_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_package_path,
        parent_guidance_path:
          lesson.pedagogical_integration.generated_artifacts.parent_guidance_path,
        weekly_study_plan_path:
          lesson.pedagogical_integration.generated_artifacts.weekly_study_plan_path,
        homeschool_rendered_path:
          lesson.pedagogical_integration.generated_artifacts.homeschool_rendered_path,
        home_practical_policy_path:
          lesson.pedagogical_integration.generated_artifacts.home_practical_policy_path,
        homeschool_render_resolution: {
          content_refs_resolved: row.homeschoolRenderResolution.content_refs_resolved,
          task_refs_resolved: row.homeschoolRenderResolution.task_refs_resolved,
          answer_refs_resolved: row.homeschoolRenderResolution.answer_refs_resolved,
          procedure_refs_resolved: row.homeschoolRenderResolution.procedure_refs_resolved,
          safety_refs_resolved: row.homeschoolRenderResolution.safety_refs_resolved,
        },
        readiness: {
          structural_state: 'generated',
          teacher_review: 'pending',
          classroom_trial: 'not_tested',
          classroom_ready: false,
          homeschool_ready: false,
          effectiveness_claimed: false,
        },
      };
    }),
    determinism: {
      ordering: 'bytewise',
      ai_used: false,
      network_used: false,
      randomness_used: false,
      volatile_timestamps: false,
    },
  };
}

function yaml(value) {
  return stringify(value, { lineWidth: 100, sortMapEntries: false });
}

async function currentMarkdown(rootDir, repositoryPath) {
  return fs.readFile(safeRepositoryPath(rootDir, repositoryPath, repositoryPath), 'utf8');
}

async function currentOrGeneratedMarkdown(files, rootDir, repositoryPath) {
  if (files.has(repositoryPath)) return files.get(repositoryPath);
  return currentMarkdown(rootDir, repositoryPath);
}

export async function generateWaterPilotArtifacts({ rootDir = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [lessons, thematic, materialsIndex, selectionRepository, homeschoolRepository] =
    await Promise.all([
      Promise.all(WATER_PILOT_LESSONS.map((file) => readYaml(absoluteRoot, file))),
      readYaml(absoluteRoot, WATER_PILOT_THEMATIC),
      readYaml(absoluteRoot, WATER_PILOT_INDEX),
      loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
      loadPedagogyHomeschoolRepository({ rootDir: absoluteRoot }),
    ]);
  const identities = new Map(lessons.map((lesson) => [
    lesson.lesson_id,
    computeLessonContentIdentity(lesson),
  ]));
  for (const lesson of lessons) {
    const recorded = lesson.pedagogical_integration?.content_identity;
    const current = identities.get(lesson.lesson_id);
    if (!recorded || recorded.value !== current.value) {
      throw new Error(
        `${lesson.lesson_id}: recorded content identity ${recorded?.value ?? '<missing>'} `
        + `does not match ${current.value}`,
      );
    }
  }
  const unitIdentity = computeUnitContentIdentity(thematic, identities);
  if (thematic.pedagogical_integration?.unit_content_identity?.value !== unitIdentity.value) {
    throw new Error(
      `unit content identity does not match current content: ${unitIdentity.value}`,
    );
  }
  if (materialsIndex.pedagogical_integration?.unit_content_identity?.value !== unitIdentity.value) {
    throw new Error('materials index unit content identity is stale');
  }
  const files = new Map();
  const rows = new Map();
  for (const lesson of lessons) {
    const selection = selectionResultOrThrow(selectionRepository, lesson);
    const reconciliation = reconcileLessonTiming(lesson, selection.lessonDna);
    const generatedTaskBindings = taskBindings(lesson, selection.lessonDna, materialsIndex);
    const homeschoolRequest = buildHomeschoolRequest(
      lesson,
      selection.request,
      selection.sourceLessonDna,
      generatedTaskBindings,
    );
    let homeschool = adaptLessonForHomeschool(homeschoolRepository, homeschoolRequest);
    if (!homeschool.package) {
      throw new Error(
        `${lesson.lesson_id} homeschool adaptation failed: `
        + `${homeschool.decision.failure?.code}: `
        + `${homeschool.decision.failure?.details?.join('; ')}`,
      );
    }
    homeschool = normalizeHomeschoolAssessment(lesson, homeschool);
    const homePracticalPolicy = buildHomePracticalPolicyArtifact(
      lesson,
      selection.lessonDna,
      homeschool,
    );
    homeschool = applyHomePracticalPolicy(homeschool, homePracticalPolicy);
    const homeschoolRenderResolution = resolveHomeschoolRendering(
      lesson,
      homeschool,
      generatedTaskBindings,
      materialsIndex,
      homePracticalPolicy,
    );
    const generated = lesson.pedagogical_integration.generated_artifacts;
    files.set(generated.selection_request_path, serializePedagogyYaml(selection.request));
    files.set(generated.selection_decision_path, serializePedagogyYaml(selection.decision));
    files.set(generated.lesson_dna_path, serializePedagogyYaml(selection.lessonDna));
    files.set(generated.homeschool_request_path, serializeHomeschoolYaml(homeschoolRequest));
    files.set(generated.homeschool_decision_path, serializeHomeschoolYaml(homeschool.decision));
    files.set(generated.homeschool_package_path, serializeHomeschoolYaml(homeschool.package));
    files.set(generated.parent_guidance_path, serializeHomeschoolYaml(homeschool.parentGuidance));
    files.set(generated.weekly_study_plan_path, serializeHomeschoolYaml(homeschool.weeklyStudyPlan));
    files.set(
      generated.homeschool_rendered_path,
      homeschoolLessonMarkdown(
        lesson,
        homeschool,
        homeschoolRenderResolution,
        homePracticalPolicy,
      ),
    );
    if (homePracticalPolicy) {
      if (generated.home_practical_policy_path
        !== lesson.pedagogical_integration.selection_input.homeschool
          .practical_policy.artifact_path) {
        throw new Error(`${lesson.lesson_id}: home practical policy paths disagree`);
      }
      files.set(generated.home_practical_policy_path, yaml(homePracticalPolicy));
    } else if (generated.home_practical_policy_path !== null) {
      throw new Error(`${lesson.lesson_id}: unexpected home practical policy path`);
    }
    const number = String(lesson.position_in_unit).padStart(2, '0');
    const parentRenderedPath =
      `${WATER_PILOT_PACK}/homeschool/lesson-${number}-parent-guidance.md`;
    files.set(
      parentRenderedPath,
      parentLessonMarkdown(
        lesson,
        homeschool,
        homeschoolRenderResolution,
        homePracticalPolicy,
      ),
    );
    const teacherPath = `${WATER_PILOT_PACK}/lessons/lesson-${number}.md`;
    const answerPath = `${WATER_PILOT_PACK}/answers/lesson-${number}-answer-key.md`;
    files.set(teacherPath, applyGeneratedRegion(
      await currentMarkdown(absoluteRoot, teacherPath),
      `lesson=${lesson.lesson_id} audience=teacher`,
      teacherRegion(
        lesson,
        selection.lessonDna,
        reconciliation,
        selectionRepository,
        generatedTaskBindings,
      ),
    ));
    const oldStudentRegion = `lesson=${lesson.lesson_id} audience=student`;
    const studentPaths = uniqueSorted(generatedTaskBindings.flatMap(
      (task) => task.student_artifact_paths,
    ));
    for (const studentPath of studentPaths) {
      let content = await currentOrGeneratedMarkdown(
        files,
        absoluteRoot,
        studentPath,
      );
      content = removeGeneratedRegion(content, oldStudentRegion);
      for (const task of generatedTaskBindings.filter(
        (candidate) => candidate.student_artifact_paths.includes(studentPath),
      )) {
        const material = task.student_materials.find(
          (candidate) => candidate.artifact_path === studentPath,
        );
        content = applyGeneratedRegion(
          content,
          `lesson=${lesson.lesson_id} phase=${task.phase_id} audience=student`,
          studentPhaseRegion(lesson, task, material, selectionRepository),
        );
      }
      files.set(studentPath, content);
    }
    files.set(answerPath, applyGeneratedRegion(
      await currentMarkdown(absoluteRoot, answerPath),
      `lesson=${lesson.lesson_id} audience=answer-key`,
      answerRegion(lesson, generatedTaskBindings),
    ));
    rows.set(lesson.lesson_id, {
      selection,
      lessonDna: selection.lessonDna,
      reconciliation,
      taskBindings: generatedTaskBindings,
      homeschoolRequest,
      homeschool,
      homeschoolRenderResolution,
      homePracticalPolicy,
      classroomRenderedPaths: uniqueSorted([teacherPath, ...studentPaths, answerPath]),
      parentRenderedPath,
    });
  }
  files.set(
    `${WATER_PILOT_PACK}/student/water-oral-answer-preparation.md`,
    oralStudentMarkdown(lessons),
  );
  files.set(
    `${WATER_PILOT_PACK}/answers/water-oral-answer-guidance.md`,
    oralTeacherMarkdown(lessons),
  );
  files.set(
    `${WATER_PILOT_PACK}/pedagogy/integration-index.yaml`,
    yaml(integrationIndex(lessons, unitIdentity, rows)),
  );
  return {
    rootDir: absoluteRoot,
    lessons,
    thematic,
    materialsIndex,
    identities,
    unitIdentity,
    rows,
    files: new Map([...files.entries()].sort(([left], [right]) => compareBytewise(left, right))),
  };
}

export async function writeGeneratedFiles(generated) {
  for (const [repositoryPath, content] of generated.files) {
    const filePath = safeRepositoryPath(generated.rootDir, repositoryPath, repositoryPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }
}

export async function checkGeneratedFiles(generated) {
  const mismatches = [];
  for (const [repositoryPath, expected] of generated.files) {
    const filePath = safeRepositoryPath(generated.rootDir, repositoryPath, repositoryPath);
    let actual;
    try {
      actual = await fs.readFile(filePath, 'utf8');
    } catch {
      mismatches.push(`${repositoryPath}: missing`);
      continue;
    }
    if (actual !== expected) mismatches.push(`${repositoryPath}: stale`);
  }
  return mismatches;
}

export function generationSummary(generated) {
  return {
    integration_version: PEDAGOGY_INTEGRATION_VERSION,
    unit_id: WATER_PILOT_UNIT_ID,
    unit_content_identity: generated.unitIdentity.value,
    lesson_count: generated.lessons.length,
    generated_file_count: generated.files.size,
    lessons: generated.lessons.map((lesson) => {
      const row = generated.rows.get(lesson.lesson_id);
      return {
        lesson_id: lesson.lesson_id,
        content_identity: generated.identities.get(lesson.lesson_id).value,
        pattern_id: row.lessonDna.pattern.pattern_id,
        target_ids: row.lessonDna.phases.map((phase) => phase.target.target_id),
        selection_request_digest: row.selection.decision.request_digest,
        lesson_dna_digest: sha256PedagogyValue(row.lessonDna),
        timing_status: row.reconciliation.status,
        homeschool_variant: row.homeschool.package.context.variant,
        homeschool_ready: false,
      };
    }),
    guarantees: {
      ai_used: false,
      network_used: false,
      randomness_used: false,
      volatile_timestamps: false,
    },
  };
}

export function stableIntegrationJson(value) {
  return stablePedagogyJson(value);
}
