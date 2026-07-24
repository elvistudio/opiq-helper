import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  createPedagogySelectionValidators,
  loadPedagogySelectionRepository,
  normalizePedagogySelectionRequest,
  selectLessonPedagogy,
  serializePedagogyYaml,
  sha256PedagogyValue,
  stablePedagogyJson,
} from './pedagogy-selection.mjs';
import { parseStrictPedagogyYaml } from './pedagogy-knowledge.mjs';
import {
  expandPedagogyActivityTargets,
  pedagogyQueryOrders,
} from './pedagogy-query.mjs';

export const PEDAGOGY_HOMESCHOOL_ENGINE_VERSION = '1.0';
export const PEDAGOGY_HOMESCHOOL_ROOT = 'knowledge/pedagogy/homeschool';
export const PEDAGOGY_HOMESCHOOL_RULES = `${PEDAGOGY_HOMESCHOOL_ROOT}/homeschool-rules.yaml`;
export const PEDAGOGY_HOMESCHOOL_FIXTURES =
  `${PEDAGOGY_HOMESCHOOL_ROOT}/grade-5-homeschool-fixtures.yaml`;
export const PEDAGOGY_HOMESCHOOL_EXAMPLES =
  `${PEDAGOGY_HOMESCHOOL_ROOT}/homeschool-package-examples.yaml`;

const SCHEMA_ROOT = 'knowledge/pedagogy/schemas';
const HOMESCHOOL_SCHEMA_FILES = {
  request: `${SCHEMA_ROOT}/homeschool-adaptation-request.schema.json`,
  decision: `${SCHEMA_ROOT}/homeschool-adaptation-decision.schema.json`,
  package: `${SCHEMA_ROOT}/homeschool-package.schema.json`,
  parentGuidance: `${SCHEMA_ROOT}/parent-guidance.schema.json`,
  weeklyStudyPlan: `${SCHEMA_ROOT}/weekly-study-plan.schema.json`,
  fixtures: `${SCHEMA_ROOT}/homeschool-fixtures.schema.json`,
  examples: `${SCHEMA_ROOT}/homeschool-package-examples.schema.json`,
};

const FAILURE_MESSAGES = {
  adult_effort_exceeds_limit: 'Adult support exceeds the declared homeschool limit.',
  answer_key_binding_missing: 'A retrieval or self-check phase has no answer-key binding.',
  explanation_binding_missing: 'An adapted explanation phase has no relevant explanation binding.',
  invalid_source_lesson_dna: 'The source lesson DNA is invalid.',
  invalid_source_selection_request: 'The source selection request is invalid.',
  language_profile_incompatible: 'The homeschool adaptation would change the language policy.',
  limited_adaptation_not_allowed: 'A requested limited homeschool adaptation is not allowed.',
  missing_home_resource: 'A required home resource is unavailable.',
  no_homeschool_composition: 'No valid homeschool composition can be selected.',
  practical_binding_missing: 'An adapted practical phase has incomplete procedure or safety bindings.',
  safety_requirement_not_preserved: 'Source safety supervision was not preserved in the adapted DNA.',
  safety_supervision_unavailable: 'Required adult safety supervision is unavailable.',
  source_request_digest_mismatch: 'The source request digest does not match the lesson DNA.',
  source_selection_not_reproducible: 'The source selection cannot be reproduced.',
  stale_source_lesson_dna: 'The source lesson DNA is stale for the current pedagogy catalogue.',
  teacher_override_not_preserved: 'An accepted source teacher override was not preserved.',
  timing_unrealistic: 'The adapted plan does not fit the declared sessions.',
  unsupported_homeschool_variant: 'The homeschool variant is unsupported.',
};

const DEMAND_ORDER = pedagogyQueryOrders.demand;
const EFFORT_ORDER = pedagogyQueryOrders.effort;
const VARIANTS = new Set(['independent', 'parent_child', 'remote_peer', 'small_sibling_group']);
const PERSONAL_DATA_KEYS = new Set([
  'account_id',
  'address',
  'birth_date',
  'child_name',
  'completed',
  'completed_at',
  'date_of_birth',
  'email',
  'learner_name',
  'progress_history',
  'school',
  'student_grade',
  'student_name',
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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => (
    `${error.instancePath || '/'} ${error.message}`
    + (error.params?.additionalProperty ? `: ${error.params.additionalProperty}` : '')
  ));
}

function stableClone(value) {
  return JSON.parse(stablePedagogyJson(value));
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await fs.readFile(path.join(rootDir, repositoryPath), 'utf8'));
}

async function readYaml(rootDir, repositoryPath, { optional = false } = {}) {
  const filePath = path.join(rootDir, repositoryPath);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return {
      file: repositoryPath,
      raw,
      data: parseStrictPedagogyYaml(raw, repositoryPath),
    };
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function loadPedagogyHomeschoolRepository({
  rootDir = process.cwd(),
  examplesOptional = false,
  skipExamples = false,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [selection, rules, fixtures, examples, schemas] = await Promise.all([
    loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
    readYaml(absoluteRoot, PEDAGOGY_HOMESCHOOL_RULES),
    readYaml(absoluteRoot, PEDAGOGY_HOMESCHOOL_FIXTURES),
    skipExamples
      ? Promise.resolve(null)
      : readYaml(absoluteRoot, PEDAGOGY_HOMESCHOOL_EXAMPLES, { optional: examplesOptional }),
    Promise.all(Object.entries(HOMESCHOOL_SCHEMA_FILES).map(async ([name, file]) => [
      name,
      await readJson(absoluteRoot, file),
    ])),
  ]);
  return {
    rootDir: absoluteRoot,
    selection,
    rules,
    fixtures,
    examples,
    schemas: Object.fromEntries(schemas),
  };
}

export function createPedagogyHomeschoolValidators(repository) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(repository.selection.knowledge.schemas.common);
  for (const schema of Object.values(repository.selection.schemas)) ajv.addSchema(schema);
  for (const schema of Object.values(repository.schemas)) ajv.addSchema(schema);
  return Object.fromEntries(
    Object.entries(repository.schemas).map(([name, schema]) => [name, ajv.getSchema(schema.$id)]),
  );
}

function selectionVersions(repository) {
  const rules = repository.selection.rules.data;
  return {
    homeschool_engine_version: PEDAGOGY_HOMESCHOOL_ENGINE_VERSION,
    homeschool_rules_version: repository.rules.data.versions.homeschool_rules_version,
    homeschool_package_schema_version:
      repository.rules.data.versions.homeschool_package_schema_version,
    parent_guidance_schema_version:
      repository.rules.data.versions.parent_guidance_schema_version,
    weekly_study_plan_schema_version:
      repository.rules.data.versions.weekly_study_plan_schema_version,
    selection_engine_version: rules.engine_version,
    selection_rules_version: rules.selection_rules_version,
    lesson_dna_schema_version: rules.lesson_dna_schema_version,
    taxonomy_version: repository.selection.knowledge.taxonomy.data.taxonomy_version,
    activity_catalog_digest:
      repository.selection.fixtures.data.fixtures.length > 0
        ? selectLessonPedagogy(
          repository.selection,
          repository.selection.fixtures.data.fixtures.find(
            (fixture) => fixture.expected.status === 'success',
          ).request,
        ).decision.versions.activity_catalog_digest
        : '0'.repeat(64),
  };
}

function safeSourceIdentity(request) {
  const selectionRequest = request?.source?.selection_request;
  const lessonDna = request?.source?.lesson_dna;
  return {
    source_request_id:
      typeof selectionRequest?.request_id === 'string' ? selectionRequest.request_id : 'unknown-request',
    source_request_digest: null,
    source_lesson_dna_id:
      typeof lessonDna?.lesson_dna_id === 'string' ? lessonDna.lesson_dna_id : 'unknown-dna',
    source_lesson_dna_digest: null,
    source_selection_versions: null,
  };
}

function failureResult(repository, request, code, details, {
  sourceIdentity = safeSourceIdentity(request),
  derivedSelectionRequestDigest = null,
  derivedSelectionDecision = null,
  phaseAdaptations = [],
  answerBindingDecisions = [],
  teacherOverrideAdaptations = [],
  checks = {},
} = {}) {
  const selectedVariant = VARIANTS.has(request?.adaptation_context?.variant)
    ? request.adaptation_context.variant
    : 'independent';
  return {
    decision: {
      schema_version: '1.0',
      artifact_type: 'homeschool_adaptation_decision',
      decision_id: `${request?.request_id ?? 'invalid-homeschool-request'}-decision`,
      request_id: request?.request_id ?? 'invalid-homeschool-request',
      status: 'failure',
      versions: selectionVersions(repository),
      source_identity: sourceIdentity,
      derived_selection_request_digest: derivedSelectionRequestDigest,
      derived_selection_decision: derivedSelectionDecision,
      selected_variant: selectedVariant,
      phase_adaptations: phaseAdaptations,
      teacher_override_adaptations: teacherOverrideAdaptations,
      answer_binding_decisions: answerBindingDecisions,
      adult_role_decisions: [],
      resource_checks: checks.resource ?? [],
      safety_checks: checks.safety ?? [],
      language_checks: checks.language ?? [],
      answer_access_checks: checks.answer ?? [],
      timing_checks: checks.timing ?? [],
      warnings: [],
      determinism: {
        ordering: 'bytewise',
        ai_used: false,
        network_used: false,
        randomness_used: false,
        volatile_timestamp_in_core: false,
      },
      failure: {
        code,
        message: FAILURE_MESSAGES[code],
        details: uniqueSorted(details),
      },
    },
    homeschoolLessonDna: null,
    package: null,
    parentGuidance: null,
    weeklyStudyPlan: null,
  };
}

function compareLessonDna(expected, actual) {
  const normalizedActual = structuredClone(actual);
  normalizedActual.lesson_dna_id = expected.lesson_dna_id;
  return stablePedagogyJson(expected) === stablePedagogyJson(normalizedActual);
}

function sourceIdentity(request, normalizedSourceRequest) {
  return {
    source_request_id: normalizedSourceRequest.request_id,
    source_request_digest: sha256PedagogyValue(normalizedSourceRequest),
    source_lesson_dna_id: request.source.lesson_dna.lesson_dna_id,
    source_lesson_dna_digest: sha256PedagogyValue(request.source.lesson_dna),
    source_selection_versions: stableClone(request.source.lesson_dna.versions),
  };
}

function targetMap(repository) {
  return new Map(
    expandPedagogyActivityTargets(repository.selection.knowledge.activities.data.activities)
      .map((target) => [target.target_id, target]),
  );
}

function variantRule(repository, variant) {
  return repository.rules.data.variants[variant] ?? null;
}

function validateVariant(repository, request) {
  const variant = request.adaptation_context.variant;
  const rule = variantRule(repository, variant);
  if (!rule) return [`unknown variant ${variant}`];
  const count = request.adaptation_context.learner_count;
  const errors = [];
  if (count < rule.learner_count.min || count > rule.learner_count.max) {
    errors.push(
      `${variant} requires learner_count ${rule.learner_count.min}-${rule.learner_count.max}`,
    );
  }
  if (variant === 'parent_child' && !request.adaptation_context.adult_context.available) {
    errors.push('parent_child requires an available adult');
  }
  if (
    variant === 'remote_peer'
    && !request.adaptation_context.resources.internet_available
    && request.adaptation_context.resources.unavailable.includes('internet')
  ) {
    errors.push('remote_peer requires a declared remote connection resource');
  }
  return errors;
}

function bindingMap(request) {
  return new Map(request.content_bindings.map((binding) => [binding.phase_id, binding]));
}

function validateBindings(request) {
  const sourceDna = request.source.lesson_dna;
  const bindings = bindingMap(request);
  const errors = [];
  if (bindings.size !== request.content_bindings.length) {
    errors.push('content binding phase IDs must be unique');
  }
  for (const phase of sourceDna.phases) {
    const binding = bindings.get(phase.phase_id);
    if (!binding) {
      errors.push(`missing content binding for source phase ${phase.phase_id}`);
      continue;
    }
    if (phase.phase === 'explanation' && binding.teacher_explanation_refs.length === 0) {
      errors.push(`explanation phase ${phase.phase_id} has no teacher explanation reference`);
    }
    if (
      ['retrieval', 'formative_assessment'].includes(phase.phase)
      && binding.answer_key_refs.length === 0
    ) {
      errors.push(`answer key is missing for ${phase.phase_id}`);
    }
    if (
      request.source.selection_request.lesson_context.context_flags.practical
      && phase.safety.requires_adult_supervision
      && (binding.procedure_refs.length === 0 || binding.safety_refs.length === 0)
    ) {
      errors.push(`practical phase ${phase.phase_id} needs procedure and safety references`);
    }
  }
  return errors;
}

function stricterDemand(sourceLevel, requestedLevel) {
  if (!requestedLevel) return sourceLevel;
  return DEMAND_ORDER.get(requestedLevel) < DEMAND_ORDER.get(sourceLevel)
    ? requestedLevel
    : sourceLevel;
}

function mappedPhaseNeeds(sourceRequest, repository) {
  const practical = sourceRequest.lesson_context.context_flags.practical;
  const mappings = practical
    ? repository.rules.data.practical_phase_mappings
    : repository.rules.data.phase_mappings;
  return uniqueSorted(
    sourceRequest.lesson_context.phase_needs.map((phase) => mappings[phase] ?? phase),
  );
}

function requiredPattern(sourceRequest, repository) {
  if (sourceRequest.lesson_context.context_flags.practical) {
    return repository.rules.data.pattern_policy.practical;
  }
  return repository.rules.data.pattern_policy.retrieval_purposes[
    sourceRequest.lesson_context.purpose
  ] ?? repository.rules.data.pattern_policy.non_practical_default;
}

export function deriveHomeschoolSelectionRequest(repository, request, sourceOverrides = []) {
  const source = normalizePedagogySelectionRequest(request.source.selection_request);
  const context = request.adaptation_context;
  const variant = variantRule(repository, context.variant);
  const maximumDemand = stricterDemand(
    source.language_profile.maximum_total_productive_language_demand,
    context.maximum_total_productive_language_demand,
  );
  const preferredTargets = uniqueSorted([
    ...source.preferences.preferred_target_ids,
    ...context.homeschool_preferences.preferred_target_ids,
    ...sourceOverrides.map((override) => override.requested_target_id),
  ]);
  const excludedTargets = uniqueSorted([
    ...source.preferences.excluded_target_ids,
    ...context.homeschool_preferences.excluded_target_ids,
  ]);
  const patternId = requiredPattern(source, repository);
  const practical = source.lesson_context.context_flags.practical;
  const mappings = practical
    ? repository.rules.data.practical_phase_mappings
    : repository.rules.data.phase_mappings;
  const mappedTeacherOverrides =
    context.teacher_override_policy === 'require_preservation'
      ? sourceOverrides.map((override) => ({
        override_id: override.override_id,
        slot_id: (
          mappings[
            request.source.lesson_dna.phases.find(
              (phase) => phase.phase_id === override.slot_id,
            )?.phase ?? override.slot_id
          ] ?? override.slot_id
        ).replaceAll('_', '-'),
        requested_target_id: override.requested_target_id,
        rationale_ru: override.teacher_rationale_ru,
        author_role: 'teacher',
      }))
      : [];
  return normalizePedagogySelectionRequest({
    ...source,
    request_id: `${request.request_id}-selection`,
    learner_context: {
      ...source.learner_context,
      delivery_mode: variant.delivery_mode,
      group_size: context.learner_count,
      lesson_duration_minutes: Math.min(
        180,
        context.learner_session_minutes * context.maximum_sessions,
      ),
      supported_group_formats: stableClone(variant.supported_group_formats),
      study_context: variant.study_context,
    },
    lesson_context: {
      ...source.lesson_context,
      phase_needs: mappedPhaseNeeds(source, repository),
      required_pattern_id: patternId,
    },
    language_profile: {
      ...source.language_profile,
      maximum_total_productive_language_demand: maximumDemand,
    },
    resources: stableClone(context.resources),
    constraints: {
      ...source.constraints,
      // The source selector must be able to inspect independently adaptable
      // targets whose catalogue entry documents an optional parent role. The
      // homeschool layer applies the request's actual adult limit after it
      // resolves whether that role is required for the selected variant.
      max_parent_effort: source.constraints.max_parent_effort,
      accessibility_priorities: uniqueSorted([
        ...source.constraints.accessibility_priorities,
        ...context.accessibility_priorities,
      ]),
    },
    preferences: {
      ...source.preferences,
      preferred_pattern_ids: uniqueSorted([
        ...source.preferences.preferred_pattern_ids,
        patternId,
      ]),
      preferred_target_ids: preferredTargets,
      excluded_target_ids: excludedTargets,
      preferred_group_formats: stableClone(variant.preferred_group_formats),
      teacher_overrides: mappedTeacherOverrides,
    },
  });
}

function sourceSafetyRequired(request) {
  return request.source.lesson_dna.phases.some(
    (phase) => phase.safety.requires_adult_supervision,
  );
}

function sourceAcceptedOverrides(sourceSelection, request) {
  const requestedById = new Map(
    request.source.selection_request.preferences.teacher_overrides.map(
      (override) => [override.override_id, override],
    ),
  );
  return sourceSelection.decision.teacher_override_results
    .filter((result) => result.status === 'accepted')
    .map((result) => ({
      ...result,
      teacher_rationale_ru: requestedById.get(result.override_id)?.rationale_ru ?? '',
    }))
    .sort((left, right) => compareBytewise(left.override_id, right.override_id));
}

export function finalSafetyState(request, homeschoolDna, adaptations = []) {
  const sourceControls = uniqueSorted(
    request.source.lesson_dna.phases.flatMap((phase) => phase.safety.controls_ru),
  );
  const adaptedControls = uniqueSorted(
    homeschoolDna.phases.flatMap((phase) => phase.safety.controls_ru),
  );
  const sourceRequired = sourceSafetyRequired(request);
  const adaptedRequired = homeschoolDna.phases.some(
    (phase) => phase.safety.requires_adult_supervision,
  );
  const adaptedById = new Map(
    homeschoolDna.phases.map((phase) => [phase.phase_id, phase]),
  );
  const unpreservedSourcePhaseIds = request.source.lesson_dna.phases
    .filter((phase) => phase.safety.requires_adult_supervision)
    .filter((phase) => {
      if (adaptations.length === 0) return !adaptedRequired;
      const mapped = adaptations.filter(
        (adaptation) => adaptation.source_phase_id === phase.phase_id,
      );
      return mapped.length === 0 || mapped.every(
        (adaptation) => (
          !adaptation.adapted_phase_id
          || !adaptedById.get(adaptation.adapted_phase_id)?.safety.requires_adult_supervision
        ),
      );
    })
    .map((phase) => phase.phase_id)
    .sort(compareBytewise);
  return {
    source_supervision_required: sourceRequired,
    adapted_supervision_required: adaptedRequired,
    effective_supervision_required: sourceRequired || adaptedRequired,
    controls_ru: uniqueSorted([...sourceControls, ...adaptedControls]),
    unpreserved_source_phase_ids: unpreservedSourcePhaseIds,
  };
}

export function validateFinalSafety(request, safetyState) {
  if (
    safetyState.unpreserved_source_phase_ids.length > 0
  ) {
    return {
      code: 'safety_requirement_not_preserved',
      details: safetyState.unpreserved_source_phase_ids.map(
        (phaseId) => `source supervised phase ${phaseId} has no supervised adapted phase`,
      ),
    };
  }
  if (!safetyState.effective_supervision_required) return null;
  const missing = [];
  if (!request.adaptation_context.adult_context.available) {
    missing.push('adult_context.available');
  }
  if (!request.adaptation_context.adult_context.safety_supervision_available) {
    missing.push('adult_context.safety_supervision_available');
  }
  if (!request.adaptation_context.resources.adult_safety_supervision_available) {
    missing.push('resources.adult_safety_supervision_available');
  }
  if (!request.adaptation_context.adult_context.allowed_roles.includes('safety_supervision')) {
    missing.push('adult_context.allowed_roles safety_supervision');
  }
  return missing.length > 0
    ? {
      code: 'safety_supervision_unavailable',
      details: missing.map((item) => `missing ${item}`),
    }
    : null;
}

function successfulSafetyChecks(safetyState) {
  return [
    checks(
      'source_safety_checked',
      `Source supervision requirement evaluated as ${safetyState.source_supervision_required}.`,
    ),
    checks(
      'adapted_safety_checked',
      `Final homeschool DNA supervision requirement evaluated as ${safetyState.adapted_supervision_required}.`,
    ),
    checks(
      'safety_not_relaxed',
      'Any source supervision requirement is present in the final homeschool DNA.',
    ),
    checks(
      'supervision_availability_checked',
      'Adult availability, role, and resource declarations satisfy the effective requirement.',
    ),
  ];
}

function preferenceLimitedErrors(request, targets) {
  if (request.adaptation_context.limited_adaptation_policy !== 'disallow') return [];
  return request.adaptation_context.homeschool_preferences.preferred_target_ids
    .filter((targetId) => targets.get(targetId)?.operational.homeschool_adaptation.status === 'limited')
    .map((targetId) => `preferred target ${targetId} has limited homeschool adaptation`);
}

function targetViolations(request, selectionResult, targets) {
  const context = request.adaptation_context;
  const violations = [];
  for (const phase of selectionResult.lessonDna.phases) {
    const target = targets.get(phase.target.target_id);
    const adaptation = target.operational.homeschool_adaptation;
    const parent = target.operational.effort.homeschool_parent;
    const effectiveRole = effectiveAdultRole(request, target, phase);
    const effectiveEffort = effectiveRole === 'none' ? 'none' : parent.level;
    const reasons = [];
    if (!adaptation.variants.includes(context.variant)) {
      reasons.push(`variant ${context.variant} is not declared`);
    }
    if (adaptation.status === 'not_recommended') reasons.push('adaptation is not recommended');
    if (
      adaptation.status === 'limited'
      && context.limited_adaptation_policy === 'disallow'
    ) {
      reasons.push('limited adaptation is disallowed');
    }
    if (parent.role === 'subject_explanation_required') {
      reasons.push('parent subject explanation is outside the engine boundary');
    } else if (
      effectiveRole !== 'none'
      && !context.adult_context.allowed_roles.includes(effectiveRole)
    ) {
      reasons.push(`adult role ${effectiveRole} is not allowed`);
    }
    if (EFFORT_ORDER.get(effectiveEffort) > EFFORT_ORDER.get(context.adult_context.max_effort)) {
      reasons.push(`parent effort ${effectiveEffort} exceeds ${context.adult_context.max_effort}`);
    }
    if (reasons.length > 0) {
      violations.push({ target_id: target.target_id, reasons: uniqueSorted(reasons) });
    }
  }
  return violations.sort((left, right) => compareBytewise(left.target_id, right.target_id));
}

function mapSelectionFailure(selectionResult) {
  const code = selectionResult.decision.failure?.code;
  if (code === 'safety_supervision_unavailable') return 'safety_supervision_unavailable';
  if (code === 'missing_required_resource') return 'missing_home_resource';
  if (code === 'language_profile_incompatible') return 'language_profile_incompatible';
  if (code === 'duration_overflow') return 'timing_unrealistic';
  return 'no_homeschool_composition';
}

function selectHomeschoolComposition(repository, request, derivedRequest, targets) {
  let candidateRequest = structuredClone(derivedRequest);
  const excludedByAdaptation = new Set(candidateRequest.preferences.excluded_target_ids);
  for (let attempt = 0; attempt <= targets.size; attempt += 1) {
    candidateRequest.preferences.excluded_target_ids = sorted(excludedByAdaptation);
    const result = selectLessonPedagogy(repository.selection, candidateRequest);
    if (!result.lessonDna) {
      return { result, request: candidateRequest, violations: [] };
    }
    const violations = targetViolations(request, result, targets);
    if (violations.length === 0) return { result, request: candidateRequest, violations: [] };
    const newIds = violations.map((item) => item.target_id)
      .filter((targetId) => !excludedByAdaptation.has(targetId));
    if (newIds.length === 0) return { result, request: candidateRequest, violations };
    for (const targetId of newIds) excludedByAdaptation.add(targetId);
  }
  return {
    result: selectLessonPedagogy(repository.selection, candidateRequest),
    request: candidateRequest,
    violations: [{ target_id: 'selection', reasons: ['adaptation exclusion limit reached'] }],
  };
}

function phaseAdaptations(request, homeschoolDna, repository) {
  const sourceDna = request.source.lesson_dna;
  const practical = request.source.selection_request.lesson_context.context_flags.practical;
  const mappings = practical
    ? repository.rules.data.practical_phase_mappings
    : repository.rules.data.phase_mappings;
  const usedAdapted = new Set();
  const rows = sourceDna.phases.map((sourcePhase) => {
    const mappedPhase = mappings[sourcePhase.phase] ?? sourcePhase.phase;
    const candidates = homeschoolDna.phases.filter((phase) => phase.phase === mappedPhase);
    const adapted = candidates.find(
      (phase) => phase.target.target_id === sourcePhase.target.target_id,
    ) ?? candidates[0] ?? null;
    if (adapted) usedAdapted.add(adapted.phase_id);
    let action = 'omitted_with_reason';
    if (adapted?.target.target_id === sourcePhase.target.target_id) {
      action = adapted.phase === sourcePhase.phase ? 'preserved' : 'adapted';
    } else if (adapted) action = 'reselected';
    return {
      source_phase_id: sourcePhase.phase_id,
      source_target_id: sourcePhase.target.target_id,
      adapted_phase_id: adapted?.phase_id ?? null,
      adapted_target_id: adapted?.target.target_id ?? null,
      action,
      rationale_ru: adapted
        ? `Цель этапа ${sourcePhase.phase} сохранена через homeschool phase ${adapted.phase}.`
        : `Отдельный этап ${sourcePhase.phase} не создан; его capability проверяется в общей композиции.`,
    };
  });
  for (const phase of homeschoolDna.phases) {
    if (usedAdapted.has(phase.phase_id)) continue;
    rows.push({
      source_phase_id: null,
      source_target_id: null,
      adapted_phase_id: phase.phase_id,
      adapted_target_id: phase.target.target_id,
      action: 'added_by_homeschool_rules',
      rationale_ru: 'Этап добавлен versioned homeschool pattern для организации самостоятельной работы.',
    });
  }
  return rows.sort((left, right) => compareBytewise(
    `${left.source_phase_id ?? '~'}:${left.adapted_phase_id ?? '~'}`,
    `${right.source_phase_id ?? '~'}:${right.adapted_phase_id ?? '~'}`,
  ));
}

function teacherOverrideAdaptations(sourceOverrides, adaptations, policy) {
  return sourceOverrides.map((override) => {
    const mapped = adaptations.find(
      (adaptation) => adaptation.source_phase_id === override.slot_id,
    ) ?? null;
    let status = 'rejected';
    if (policy !== 'reject_all' && mapped?.adapted_phase_id) {
      status = mapped.adapted_target_id === override.requested_target_id
        ? 'preserved'
        : 'reselected';
    }
    return {
      override_id: override.override_id,
      teacher_rationale_ru: override.teacher_rationale_ru,
      source_slot_id: override.slot_id,
      source_target_id: override.requested_target_id,
      adapted_phase_id: mapped?.adapted_phase_id ?? null,
      adapted_target_id: mapped?.adapted_target_id ?? null,
      status,
      policy,
      rationale_ru: status === 'preserved'
        ? 'Override identity, rationale, mapped phase, and exact target are preserved.'
        : status === 'reselected'
          ? 'Mapped homeschool phase uses a different target after homeschool hard constraints.'
          : 'Override is rejected by policy or has no explicit mapped homeschool phase.',
    };
  }).sort((left, right) => compareBytewise(left.override_id, right.override_id));
}

function preservedTeacherOverridesForDna(overrideAdaptations) {
  return overrideAdaptations
    .filter((adaptation) => adaptation.status === 'preserved')
    .map((adaptation) => ({
      override_id: adaptation.override_id,
      status: 'accepted',
      slot_id: adaptation.adapted_phase_id,
      target_id: adaptation.source_target_id,
      rationale_ru: adaptation.teacher_rationale_ru,
    }))
    .sort((left, right) => compareBytewise(left.override_id, right.override_id));
}

function sourceBindingsForAdaptedPhase(request, adaptations, adaptedPhaseId) {
  const bindings = bindingMap(request);
  const sourceIds = adaptations
    .filter((row) => row.adapted_phase_id === adaptedPhaseId && row.source_phase_id)
    .map((row) => row.source_phase_id)
    .sort(compareBytewise);
  const exact = bindings.get(adaptedPhaseId);
  if (exact) {
    return {
      origin: 'exact_adapted',
      sourcePhaseIds: sourceIds,
      rows: [exact],
    };
  }
  const rows = sourceIds.map((id) => bindings.get(id)).filter(Boolean);
  return {
    origin: rows.length > 0 ? 'mapped_source' : 'none',
    sourcePhaseIds: sourceIds,
    rows,
  };
}

function mergedBindingValues(rows, field) {
  return uniqueSorted(rows.flatMap((row) => row[field]));
}

function phaseHasCapability(phase, capability) {
  return phase.capabilities.primary.includes(capability)
    || phase.capabilities.supporting.includes(capability);
}

export function validateAdaptedBindings(request, adaptations, homeschoolDna) {
  const sourcePhases = new Map(
    request.source.lesson_dna.phases.map((phase) => [phase.phase_id, phase]),
  );
  const decisions = [];
  const failures = [];
  for (const phase of [...homeschoolDna.phases].sort(
    (left, right) => compareBytewise(left.phase_id, right.phase_id),
  )) {
    const resolution = sourceBindingsForAdaptedPhase(
      request,
      adaptations,
      phase.phase_id,
    );
    const mappedFromExplanation = resolution.sourcePhaseIds.some(
      (phaseId) => sourcePhases.get(phaseId)?.phase === 'explanation',
    );
    const answerRequired = [
      'retrieval',
      'formative_assessment',
      'delayed_review',
    ].includes(phase.phase) || (
      phase.phase === 'reflection' && phaseHasCapability(phase, 'error_correction')
    );
    const explanationRequired = phase.phase === 'explanation'
      || (phase.phase === 'independent_practice' && mappedFromExplanation);
    const practicalRequired = phase.safety.requires_adult_supervision
      || ['observation', 'measurement', 'experimentation'].some(
        (capability) => phaseHasCapability(phase, capability),
      );
    const answerKeyRefs = mergedBindingValues(resolution.rows, 'answer_key_refs');
    const teacherExplanationRefs = mergedBindingValues(
      resolution.rows,
      'teacher_explanation_refs',
    );
    const learnerMaterialRefs = mergedBindingValues(
      resolution.rows,
      'learner_material_refs',
    );
    const procedureRefs = mergedBindingValues(resolution.rows, 'procedure_refs');
    const safetyRefs = mergedBindingValues(resolution.rows, 'safety_refs');
    const missing = [];
    if (answerRequired && answerKeyRefs.length === 0) missing.push('answer_key');
    if (
      explanationRequired
      && teacherExplanationRefs.length === 0
      && learnerMaterialRefs.length === 0
    ) {
      missing.push('teacher_explanation_or_source_segment');
    }
    if (practicalRequired && procedureRefs.length === 0) missing.push('procedure');
    if (practicalRequired && safetyRefs.length === 0) missing.push('safety');
    decisions.push({
      adapted_phase_id: phase.phase_id,
      source_phase_ids: resolution.sourcePhaseIds,
      binding_origin: resolution.origin,
      answer_key_refs: answerKeyRefs,
      teacher_explanation_refs: teacherExplanationRefs,
      procedure_refs: procedureRefs,
      safety_refs: safetyRefs,
      release_policy: answerRequired
        ? request.adaptation_context.answer_access_policy.key_release
        : 'not_applicable',
      valid: missing.length === 0,
      rationale_ru: missing.length === 0
        ? 'Привязки проверены только для exact adapted phase или явно сопоставленных source phases.'
        : `Для adapted phase отсутствуют обязательные привязки: ${missing.join(', ')}.`,
    });
    if (missing.includes('answer_key')) {
      failures.push({
        code: 'answer_key_binding_missing',
        detail: `adapted phase ${phase.phase_id} has no relevant answer key`,
      });
    }
    if (missing.includes('teacher_explanation_or_source_segment')) {
      failures.push({
        code: 'explanation_binding_missing',
        detail: `adapted phase ${phase.phase_id} has no explanation or source-segment binding`,
      });
    }
    if (missing.includes('procedure') || missing.includes('safety')) {
      failures.push({
        code: 'practical_binding_missing',
        detail: `adapted phase ${phase.phase_id} has incomplete procedure or safety bindings`,
      });
    }
  }
  return {
    decisions,
    failures: failures.sort(
      (left, right) => compareBytewise(`${left.code}:${left.detail}`, `${right.code}:${right.detail}`),
    ),
  };
}

function instructionForPhase(phase, hasAdult, answerPolicy) {
  if (phase.safety.requires_adult_supervision) {
    return 'Выполни только разрешённое действие вместе со взрослым и запиши наблюдение.';
  }
  if (phase.phase === 'orientation') return 'Подготовь материалы и прочитай видимую цель занятия.';
  if (phase.phase === 'independent_practice') {
    return 'Открой указанный материал и выполни одно задание своими словами.';
  }
  if (phase.phase === 'retrieval') return 'Закрой источник и выполни попытку по памяти.';
  if (['formative_assessment', 'reflection'].includes(phase.phase)) {
    return answerPolicy === 'adult_managed' && hasAdult
      ? 'Попроси взрослого открыть ключ после попытки и исправь ошибку другим цветом.'
      : 'Открой ключ после попытки и исправь ошибку другим цветом.';
  }
  if (phase.phase === 'delayed_review') return 'Вернись к заданию после указанного интервала и ответь без источника.';
  return 'Выполни указанный шаг и сохрани результат для проверки.';
}

function effectiveAdultRole(request, target, phase) {
  if (phase.safety.requires_adult_supervision) return 'safety_supervision';
  if (request.adaptation_context.variant !== 'parent_child') return 'none';
  return target.operational.effort.homeschool_parent.role;
}

function adultRoleDecisions(request, homeschoolDna, targets, repository) {
  const minutesByEffort = repository.rules.data.timing.adult_support_minutes_by_effort;
  return homeschoolDna.phases.map((phase) => {
    const target = targets.get(phase.target.target_id);
    const parent = target.operational.effort.homeschool_parent;
    const role = effectiveAdultRole(request, target, phase);
    const effortLevel = role === 'none' ? 'none' : parent.level;
    const minutes = role === 'safety_supervision'
      ? phase.activity_minutes + phase.setup_minutes + phase.cleanup_minutes
      : minutesByEffort[effortLevel];
    return {
      target_id: target.target_id,
      role,
      effort_level: effortLevel,
      support_minutes: minutes,
      allowed: role === 'none' || request.adaptation_context.adult_context.allowed_roles.includes(role),
      rationale_ru: role === 'none'
        ? 'Этап не требует участия взрослого.'
        : 'Роль взята из validated activity metadata и ограничена homeschool request.',
    };
  }).sort((left, right) => compareBytewise(left.target_id, right.target_id));
}

function buildLearnerSteps(request, homeschoolDna, adaptations, targets) {
  return homeschoolDna.phases.map((phase, index) => {
    const rows = sourceBindingsForAdaptedPhase(
      request,
      adaptations,
      phase.phase_id,
    ).rows;
    const target = targets.get(phase.target.target_id);
    const role = effectiveAdultRole(request, target, phase);
    const sourceAccess = phase.source_access.first_attempt === 'prohibited'
      ? 'closed'
      : phase.source_access.first_attempt === 'not_applicable' ? 'not_applicable' : 'open';
    const estonianRefs = mergedBindingValues(rows, 'estonian_support_refs');
    return {
      step_id: `step-${String(index + 1).padStart(2, '0')}-${phase.phase_id}`,
      phase_id: phase.phase_id,
      instruction_ru: instructionForPhase(
        phase,
        request.adaptation_context.adult_context.available,
        request.adaptation_context.answer_access_policy.key_release,
      ),
      learner_minutes:
        phase.activity_minutes + phase.setup_minutes + phase.cleanup_minutes + phase.transition_minutes,
      source_access: sourceAccess,
      adult_involvement: role,
      material_refs: mergedBindingValues(rows, 'learner_material_refs'),
      task_refs: mergedBindingValues(rows, 'task_refs'),
      completion_evidence_ru: phase.phase === 'retrieval'
        ? 'Самостоятельная попытка и видимое исправление после сверки.'
        : 'Запись, схема, устный ответ или наблюдение, указанное в teacher-provided task.',
      safety_controls_ru: uniqueSorted(phase.safety.controls_ru),
      estonian_roles:
        request.source.selection_request.language_profile.estonian_support.enabled
        && estonianRefs.length > 0
          ? uniqueSorted(phase.language_role.estonian_roles)
          : [],
    };
  });
}

function packSessions(steps, roleByPhase, request, repository) {
  const limit = request.adaptation_context.learner_session_minutes;
  const rules = repository.rules.data.timing;
  const sessions = [];
  const breaks = [];
  let current = null;
  function finish() {
    if (!current) return;
    sessions.push(current);
    current = null;
  }
  for (const step of steps) {
    if (step.learner_minutes > limit) {
      return { error: `step ${step.step_id} needs ${step.learner_minutes} minutes, limit is ${limit}` };
    }
    if (!current) {
      current = {
        session_index: sessions.length + 1,
        purpose: step.phase_id.includes('retrieval')
          ? 'retrieval_and_correction'
          : 'core_learning',
        package_step_ids: [],
        learner_minutes: 0,
        adult_minutes: 0,
        break_minutes: 0,
        source_access_policy: 'not_applicable',
        retrieval_type: 'none',
        answer_access: 'closed',
        relative_window: null,
        review_instruction_ru: null,
      };
    }
    const needsBreak = current.package_step_ids.length > 0
      && current.learner_minutes >= rules.break_after_continuous_minutes;
    const addedBreak = needsBreak ? rules.break_minutes : 0;
    if (current.learner_minutes + addedBreak + step.learner_minutes > limit) {
      finish();
      current = {
        session_index: sessions.length + 1,
        purpose: step.phase_id.includes('retrieval')
          ? 'retrieval_and_correction'
          : 'core_learning',
        package_step_ids: [],
        learner_minutes: 0,
        adult_minutes: 0,
        break_minutes: 0,
        source_access_policy: 'not_applicable',
        retrieval_type: 'none',
        answer_access: 'closed',
        relative_window: null,
        review_instruction_ru: null,
      };
    } else if (needsBreak) {
      const previousStepId = current.package_step_ids.at(-1);
      current.break_minutes += rules.break_minutes;
      current.learner_minutes += rules.break_minutes;
      breaks.push({
        after_step_id: previousStepId,
        minutes: rules.break_minutes,
        instruction_ru: 'Сделай короткий перерыв без экрана и вернись к следующему шагу.',
      });
    }
    current.package_step_ids.push(step.step_id);
    current.learner_minutes += step.learner_minutes;
    current.adult_minutes += roleByPhase.get(step.phase_id)?.support_minutes ?? 0;
    current.source_access_policy = current.source_access_policy === 'not_applicable'
      ? step.source_access
      : current.source_access_policy === step.source_access
        ? step.source_access
        : 'mixed_by_step';
    if (step.phase_id.includes('retrieval')) {
      current.retrieval_type = 'immediate';
      current.answer_access = request.adaptation_context.answer_access_policy.key_release;
    }
  }
  finish();
  return { sessions, breaks, error: null };
}

function retrievalWindowType(window) {
  if ('after_days' in window) return 'delayed_after_days';
  if ('after_lessons' in window) return 'delayed_after_lessons';
  return 'next_unit_review';
}

function buildWeeklyPlan(request, steps, coreSessions, adultTotal, repository) {
  const delayed = [...request.source.lesson_dna.retrieval_plan.delayed].sort(
    (left, right) => compareBytewise(stablePedagogyJson(left), stablePedagogyJson(right)),
  );
  const timingRules = repository.rules.data.timing;
  const reviewStepIds = steps
    .filter((step) => step.source_access === 'closed')
    .map((step) => step.step_id);
  const packageStepIds = reviewStepIds.length > 0
    ? uniqueSorted(reviewStepIds)
    : [steps.at(-1).step_id];
  const reviewSessions = delayed.map((window, index) => {
    const retrievalType = retrievalWindowType(window);
    const weekly = retrievalType === 'next_unit_review';
    const learnerMinutes = weekly
      ? timingRules.weekly_review_minutes
      : timingRules.delayed_retrieval_minutes;
    return {
      session_index: coreSessions.length + index + 1,
      purpose: weekly ? 'weekly_review' : 'delayed_retrieval',
      package_step_ids: packageStepIds,
      learner_minutes: learnerMinutes,
      adult_minutes: 0,
      break_minutes: 0,
      source_access_policy: 'closed',
      retrieval_type: retrievalType,
      answer_access: request.adaptation_context.answer_access_policy.key_release,
      relative_window: stableClone(window),
      review_instruction_ru: weekly
        ? 'В следующем тематическом блоке восстанови главное без источника, затем сверь ответ.'
        : 'В указанное относительное окно сначала ответь без источника, затем открой ключ и исправь ошибку.',
    };
  });
  const sessions = [...coreSessions, ...reviewSessions];
  if (sessions.length > request.adaptation_context.maximum_sessions) {
    return {
      error:
        `${sessions.length} core and review sessions exceed maximum `
        + request.adaptation_context.maximum_sessions,
      plan: null,
    };
  }
  const overLimit = reviewSessions.find(
    (session) => session.learner_minutes > request.adaptation_context.learner_session_minutes,
  );
  if (overLimit) {
    return {
      error:
        `review session ${overLimit.session_index} needs ${overLimit.learner_minutes} minutes, `
        + `limit is ${request.adaptation_context.learner_session_minutes}`,
      plan: null,
    };
  }
  return {
    error: null,
    plan: {
    schema_version: '1.0',
    artifact_type: 'weekly_study_plan',
    plan_id: `${request.request_id}-weekly-plan`,
    week_structure: {
      schedule_type: 'relative',
      maximum_sessions: request.adaptation_context.maximum_sessions,
      learner_session_minutes: request.adaptation_context.learner_session_minutes,
    },
    sessions,
    weekly_review: {
      included: delayed.length > 0,
      relative_windows: stableClone(delayed),
      notes_ru: delayed.length > 0
        ? 'Каждое относительное окно представлено отдельной machine-readable review session; абсолютные даты не создаются.'
        : 'Дополнительное окно не назначено; учитель может добавить его отдельным решением.',
    },
    contingency: {
      minutes: repository.rules.data.timing.contingency_minutes,
      use_ru: 'Используй резерв только для повторного чтения инструкции или записи вопроса учителю.',
    },
    total_learner_minutes:
      sessions.reduce((sum, session) => sum + session.learner_minutes, 0)
      + timingRules.contingency_minutes,
    total_adult_minutes: adultTotal,
    },
  };
}

function adultTiming(request, dna, roleDecisions, repository) {
  const adultNeeded = roleDecisions.some((row) => row.role !== 'none');
  const preparation = adultNeeded || request.adaptation_context.variant === 'parent_child'
    ? repository.rules.data.timing.adult_preparation_minutes_when_needed
    : 0;
  const safety = dna.phases.reduce((sum, phase) => (
    sum + (phase.safety.requires_adult_supervision
      ? phase.activity_minutes + phase.setup_minutes + phase.cleanup_minutes
      : 0)
  ), 0);
  const live = roleDecisions.reduce((sum, row) => (
    sum + (row.role !== 'none' && row.role !== 'safety_supervision' ? row.support_minutes : 0)
  ), 0);
  return {
    adult_preparation_minutes: preparation,
    adult_live_support_minutes: live,
    adult_safety_minutes: safety,
    total_adult_minutes: preparation + live + safety,
  };
}

function buildParentGuidance(
  request,
  roleDecisions,
  timing,
  safetyState,
  repository,
) {
  const roles = uniqueSorted(roleDecisions.map((row) => row.role));
  return {
    schema_version: '1.0',
    artifact_type: 'parent_guidance',
    guidance_id: `${request.request_id}-parent-guidance`,
    status: {
      teacher_review: 'pending',
      home_trial: 'not_started',
      homeschool_ready: false,
    },
    responsibility_boundary: {
      child_responsibility_ru:
        'Ребёнок выполняет попытку, объясняет, сверяет и отмечает нерешённый вопрос.',
      adult_support_ru:
        'Взрослый организует условия и разрешённую поддержку, но не создаёт предметный ответ.',
      adult_safety_supervision_ru:
        'Взрослый выполняет только указанный надзор и не меняет процедуру.',
      subject_teacher_responsibility_ru:
        'Предметный учитель отвечает за научное объяснение, ключ, процедуру и разрешение практической работы.',
    },
    allowed_actions_ru: stableClone(repository.rules.data.parent_guidance.allowed_actions_ru),
    prohibited_actions_ru: stableClone(repository.rules.data.parent_guidance.prohibited_actions_ru),
    escalation_triggers_ru:
      stableClone(repository.rules.data.parent_guidance.escalation_triggers_ru),
    adult_roles: roles.map((role) => ({
      role,
      purpose_ru: role === 'none'
        ? 'Участие взрослого в выполнении не требуется.'
        : 'Поддержать выполнение в пределах указанной операционной роли.',
      bounded_action_ru: role === 'safety_supervision'
        ? 'Контролировать только разрешённые материалы, остановку и уборку.'
        : 'Не давать предметный ответ и не завершать действие вместо ребёнка.',
    })),
    timing,
    answer_access: {
      first_attempt_without_answer:
        request.adaptation_context.answer_access_policy.first_attempt_without_answer,
      key_release: request.adaptation_context.answer_access_policy.key_release,
      correction_method: request.adaptation_context.answer_access_policy.correction_method,
    },
    safety: {
      source_supervision_required: safetyState.source_supervision_required,
      adapted_supervision_required: safetyState.adapted_supervision_required,
      effective_supervision_required: safetyState.effective_supervision_required,
      adult_supervision_required: safetyState.effective_supervision_required,
      teacher_authorization_required:
        request.source.selection_request.lesson_context.context_flags.practical
        || safetyState.effective_supervision_required,
      controls_ru: safetyState.controls_ru,
    },
    known_limits: [
      'Взрослый не считается предметным учителем.',
      'Инструкции и временные оценки требуют teacher review и домашней апробации.',
    ],
  };
}

function checks(code, rationaleRu) {
  return { code, passed: true, rationale_ru: rationaleRu };
}

function warningsForSelection(request, dna, targets, overrideAdaptations) {
  const warnings = [];
  for (const phase of dna.phases) {
    const status = targets.get(phase.target.target_id).operational.homeschool_adaptation.status;
    if (status === 'adaptable') {
      warnings.push({
        code: 'adaptable_homeschool_target',
        rationale_ru: `Target ${phase.target.target_id} требует явно описанной homeschool adaptation.`,
      });
    }
    if (status === 'limited') {
      warnings.push({
        code: 'limited_homeschool_target',
        rationale_ru: `Target ${phase.target.target_id} разрешён только по explicit limited policy.`,
      });
    }
  }
  if (
    overrideAdaptations.some((adaptation) => adaptation.status === 'reselected')
    && request.adaptation_context.teacher_override_policy === 'allow_reselection_with_warning'
  ) {
    warnings.push({
      code: 'teacher_override_reselected',
      rationale_ru: 'Исходный teacher override не переносится как accepted без совпадающего target.',
    });
  }
  return warnings
    .filter((warning, index, rows) => (
      rows.findIndex((candidate) => candidate.code === warning.code) === index
    ))
    .sort((left, right) => compareBytewise(left.code, right.code));
}

function collectMaterialMetadata(dna, targets) {
  const selected = dna.phases.map((phase) => targets.get(phase.target.target_id).operational);
  return {
    reusable: uniqueSorted(selected.flatMap(
      (operational) => operational.resource_requirements.reusable_materials,
    )),
    consumable: uniqueSorted(selected.flatMap(
      (operational) => operational.resource_requirements.consumable_materials,
    )),
  };
}

function buildPackage(
  request,
  sourceIdentityValue,
  dna,
  steps,
  breaks,
  weeklyPlan,
  parentGuidance,
  warnings,
  targets,
  safetyState,
  answerBindingDecisions,
  overrideAdaptations,
  repository,
) {
  const activity = dna.phases.reduce((sum, phase) => sum + phase.activity_minutes, 0);
  const setup = dna.phases.reduce((sum, phase) => sum + phase.setup_minutes, 0);
  const cleanup = dna.phases.reduce((sum, phase) => sum + phase.cleanup_minutes, 0);
  const transition = dna.phases.reduce((sum, phase) => sum + phase.transition_minutes, 0);
  const breakMinutes = breaks.reduce((sum, item) => sum + item.minutes, 0);
  const delayedRetrievalMinutes = weeklyPlan.sessions
    .filter((session) => [
      'delayed_after_days',
      'delayed_after_lessons',
    ].includes(session.retrieval_type))
    .reduce((sum, session) => sum + session.learner_minutes, 0);
  const weeklyReviewMinutes = weeklyPlan.sessions
    .filter((session) => session.retrieval_type === 'next_unit_review')
    .reduce((sum, session) => sum + session.learner_minutes, 0);
  const contingency = repository.rules.data.timing.contingency_minutes;
  const materialMetadata = collectMaterialMetadata(dna, targets);
  const allBindings = request.content_bindings;
  return {
    schema_version: '1.0',
    artifact_type: 'homeschool_package',
    package_id: `${request.request_id}-package`,
    status: {
      structural_state: 'proposed',
      teacher_review: 'pending',
      home_trial: 'not_started',
      homeschool_ready: false,
      effectiveness_claimed: false,
    },
    source_identity: sourceIdentityValue,
    context: {
      grade: dna.context.grade,
      subject: dna.context.subject,
      variant: request.adaptation_context.variant,
      learner_count: request.adaptation_context.learner_count,
      primary_instruction_language: dna.context.language_policy.primary_instruction_language,
      estonian_support: {
        enabled: dna.context.language_policy.estonian_support.enabled,
        learner_level: dna.context.language_policy.estonian_support.learner_level,
        allowed_roles: stableClone(dna.context.language_policy.estonian_support.allowed_roles),
      },
      learner_session_minutes: request.adaptation_context.learner_session_minutes,
      maximum_sessions: request.adaptation_context.maximum_sessions,
      homeschool_lesson_dna_id: dna.lesson_dna_id,
    },
    materials: {
      learner_material_refs: uniqueSorted(
        allBindings.flatMap((binding) => binding.learner_material_refs),
      ),
      answer_key_refs: uniqueSorted(allBindings.flatMap((binding) => binding.answer_key_refs)),
      phase_binding_summary: stableClone(answerBindingDecisions),
      reusable_materials: materialMetadata.reusable,
      consumable_materials: materialMetadata.consumable,
      preparation_steps_ru: [
        'Подготовь только перечисленные материалы и убери отвлекающие предметы.',
      ],
      cleanup_steps_ru: [
        'Собери материалы и оставь нерешённый вопрос для предметного учителя.',
      ],
    },
    learner_plan: {
      visible_goal_ref: `${request.request_id}-visible-goal`,
      success_criteria_refs: [`${request.request_id}-success-criteria`],
      steps,
      breaks,
      contingency_ru: 'Если шаг неясен, не угадывай ответ: запиши вопрос и используй резерв.',
      retrieval_ru: 'Сначала восстанови главное без открытого источника.',
      self_check_ru: 'Открой ключ только после самостоятельной попытки.',
      correction_ru: 'Исправь ошибку другим цветом и сохрани первую попытку видимой.',
      reflection_ru: 'Запиши один нерешённый вопрос для предметного учителя.',
    },
    parent_guidance_ref: parentGuidance.guidance_id,
    weekly_study_plan_ref: weeklyPlan.plan_id,
    teacher_override_adaptations: stableClone(overrideAdaptations),
    assessment: {
      subject_assessment: dna.assessment.subject_assessment.enabled,
      estonian_language_assessment: dna.assessment.estonian_language_assessment.enabled,
      separation_policy: dna.assessment.separation_policy,
    },
    safety: {
      source_supervision_required: safetyState.source_supervision_required,
      adapted_supervision_required: safetyState.adapted_supervision_required,
      effective_supervision_required: safetyState.effective_supervision_required,
      risk_summary_ru: safetyState.effective_supervision_required
        ? 'Есть практический этап с обязательным надзором взрослого.'
        : 'Выбранные этапы не требуют специального надзора безопасности.',
      adult_supervision_required: safetyState.effective_supervision_required,
      controls_ru: safetyState.controls_ru,
      stop_conditions_ru: [
        'Остановись, если инструкция, материал или условие безопасности неясны.',
        'Не продолжай практическое действие без требуемого взрослого.',
      ],
      teacher_authorization_required:
        request.source.selection_request.lesson_context.context_flags.practical
        || safetyState.effective_supervision_required,
    },
    timing: {
      learner_activity_minutes: activity,
      setup_minutes: setup,
      cleanup_minutes: cleanup,
      transition_minutes: transition,
      break_minutes: breakMinutes,
      delayed_retrieval_minutes: delayedRetrievalMinutes,
      weekly_review_minutes: weeklyReviewMinutes,
      contingency_minutes: contingency,
      total_learner_minutes:
        activity
        + setup
        + cleanup
        + transition
        + breakMinutes
        + delayedRetrievalMinutes
        + weeklyReviewMinutes
        + contingency,
      adult_minutes: parentGuidance.timing.total_adult_minutes,
    },
    warnings,
    known_limits: [
      'homeschool_rules_provisional',
      'teacher_review_pending',
      'home_trial_not_started',
      'no_effectiveness_claim',
      'teacher_provided_content_not_rendered',
    ],
  };
}

function personalDataPaths(value, currentPath = '') {
  const paths = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => paths.push(...personalDataPaths(item, `${currentPath}/${index}`)));
    return paths;
  }
  if (!isPlainObject(value)) return paths;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}/${key}`;
    if (PERSONAL_DATA_KEYS.has(key)) paths.push(childPath);
    paths.push(...personalDataPaths(child, childPath));
  }
  return paths;
}

export function adaptLessonForHomeschool(repository, rawRequest) {
  const request = stableClone(rawRequest);
  const selectionValidators = createPedagogySelectionValidators(repository.selection);
  if (!selectionValidators.request(request.source?.selection_request)) {
    return failureResult(
      repository,
      request,
      'invalid_source_selection_request',
      schemaErrors(selectionValidators.request),
    );
  }
  if (!selectionValidators.lessonDna(request.source?.lesson_dna)) {
    return failureResult(
      repository,
      request,
      'invalid_source_lesson_dna',
      schemaErrors(selectionValidators.lessonDna),
    );
  }

  const normalizedSourceRequest =
    normalizePedagogySelectionRequest(request.source.selection_request);
  const sourceIdentityValue = sourceIdentity(request, normalizedSourceRequest);
  if (request.source.lesson_dna.context.request_digest !== sourceIdentityValue.source_request_digest) {
    return failureResult(
      repository,
      request,
      'source_request_digest_mismatch',
      [
        `recorded ${request.source.lesson_dna.context.request_digest}`,
        `current ${sourceIdentityValue.source_request_digest}`,
      ],
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const currentVersions = selectionVersions(repository);
  const sourceDna = request.source.lesson_dna;
  const identityMismatches = [];
  if (sourceDna.context.request_id !== normalizedSourceRequest.request_id) {
    identityMismatches.push('source request ID differs from lesson DNA context');
  }
  if (sourceDna.context.grade !== normalizedSourceRequest.learner_context.grade) {
    identityMismatches.push('source grade differs from lesson DNA');
  }
  if (sourceDna.context.subject !== normalizedSourceRequest.learner_context.subject) {
    identityMismatches.push('source subject differs from lesson DNA');
  }
  if (
    stablePedagogyJson(sourceDna.context.language_policy)
    !== stablePedagogyJson({
      primary_instruction_language:
        normalizedSourceRequest.language_profile.primary_instruction_language,
      maximum_total_productive_language_demand:
        normalizedSourceRequest.language_profile.maximum_total_productive_language_demand,
      estonian_support: {
        enabled: normalizedSourceRequest.language_profile.estonian_support.enabled,
        learner_level: normalizedSourceRequest.language_profile.estonian_support.learner_level,
        allowed_roles: sorted(
          normalizedSourceRequest.language_profile.estonian_support.allowed_roles,
        ),
        subject_explanation_language:
          normalizedSourceRequest.language_profile.estonian_support.subject_explanation_language,
      },
    })
  ) {
    identityMismatches.push('source language policy differs from lesson DNA');
  }
  if (sourceDna.versions.activity_catalog_digest !== currentVersions.activity_catalog_digest) {
    identityMismatches.push('activity catalog digest is stale');
  }
  for (const [sourceField, currentField] of [
    ['engine', 'selection_engine_version'],
    ['selection_rules', 'selection_rules_version'],
    ['lesson_dna_schema', 'lesson_dna_schema_version'],
    ['taxonomy', 'taxonomy_version'],
  ]) {
    if (sourceDna.versions[sourceField] !== currentVersions[currentField]) {
      identityMismatches.push(`${sourceField} is stale`);
    }
  }
  if (identityMismatches.length > 0) {
    return failureResult(
      repository,
      request,
      'stale_source_lesson_dna',
      identityMismatches,
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const reproduced = selectLessonPedagogy(repository.selection, normalizedSourceRequest);
  if (!reproduced.lessonDna) {
    return failureResult(
      repository,
      request,
      'source_selection_not_reproducible',
      [reproduced.decision.failure?.code ?? 'source selection returned no lesson DNA'],
      { sourceIdentity: sourceIdentityValue },
    );
  }
  if (!compareLessonDna(sourceDna, reproduced.lessonDna)) {
    return failureResult(
      repository,
      request,
      'source_selection_not_reproducible',
      ['regenerated lesson DNA differs from the supplied source lesson DNA'],
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const variantErrors = validateVariant(repository, request);
  if (variantErrors.length > 0) {
    return failureResult(
      repository,
      request,
      'unsupported_homeschool_variant',
      variantErrors,
      { sourceIdentity: sourceIdentityValue },
    );
  }
  if (
    request.adaptation_context.variant === 'parent_child'
    && request.adaptation_context.adult_context.max_support_minutes === 0
  ) {
    return failureResult(
      repository,
      request,
      'adult_effort_exceeds_limit',
      ['parent_child requires visible adult preparation or live-support time'],
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const bindingErrors = validateBindings(request);
  if (bindingErrors.some((error) => error.startsWith('answer key'))) {
    return failureResult(
      repository,
      request,
      'answer_key_binding_missing',
      bindingErrors,
      { sourceIdentity: sourceIdentityValue },
    );
  }
  if (bindingErrors.length > 0) {
    return failureResult(
      repository,
      request,
      'missing_home_resource',
      bindingErrors,
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const targets = targetMap(repository);
  const limitedErrors = preferenceLimitedErrors(request, targets);
  if (limitedErrors.length > 0) {
    return failureResult(
      repository,
      request,
      'limited_adaptation_not_allowed',
      limitedErrors,
      { sourceIdentity: sourceIdentityValue },
    );
  }

  const sourceOverrides = sourceAcceptedOverrides(reproduced, request);
  if (
    sourceOverrides.length > 0
    && request.adaptation_context.teacher_override_policy === 'reject_all'
  ) {
    const overrideAdaptations = teacherOverrideAdaptations(
      sourceOverrides,
      [],
      request.adaptation_context.teacher_override_policy,
    );
    return failureResult(
      repository,
      request,
      'teacher_override_not_preserved',
      sourceOverrides.map((override) => `source override ${override.override_id} is rejected by policy`),
      {
        sourceIdentity: sourceIdentityValue,
        teacherOverrideAdaptations: overrideAdaptations,
      },
    );
  }

  const derivedRequest = deriveHomeschoolSelectionRequest(
    repository,
    request,
    sourceOverrides,
  );
  const selected = selectHomeschoolComposition(repository, request, derivedRequest, targets);
  if (!selected.result.lessonDna) {
    const preservationFailed = sourceOverrides.length > 0
      && request.adaptation_context.teacher_override_policy === 'require_preservation';
    const failureCode = preservationFailed
      ? 'teacher_override_not_preserved'
      : mapSelectionFailure(selected.result);
    const overrideAdaptations = preservationFailed
      ? teacherOverrideAdaptations(
        sourceOverrides,
        [],
        request.adaptation_context.teacher_override_policy,
      )
      : [];
    return failureResult(
      repository,
      request,
      failureCode,
      selected.result.decision.failure?.details ?? ['selector returned no homeschool DNA'],
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
        teacherOverrideAdaptations: overrideAdaptations,
      },
    );
  }
  if (selected.violations.length > 0) {
    return failureResult(
      repository,
      request,
      'no_homeschool_composition',
      selected.violations.flatMap(
        (violation) => violation.reasons.map((reason) => `${violation.target_id}: ${reason}`),
      ),
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
      },
    );
  }

  const homeschoolDna = stableClone(selected.result.lessonDna);
  const adaptations = phaseAdaptations(request, homeschoolDna, repository);
  const overrideAdaptations = teacherOverrideAdaptations(
    sourceOverrides,
    adaptations,
    request.adaptation_context.teacher_override_policy,
  );
  homeschoolDna.teacher_overrides = preservedTeacherOverridesForDna(overrideAdaptations);
  const missingOverrides = overrideAdaptations.filter(
    (adaptation) => adaptation.status !== 'preserved',
  );
  if (
    missingOverrides.length > 0
    && request.adaptation_context.teacher_override_policy === 'require_preservation'
  ) {
    return failureResult(
      repository,
      request,
      'teacher_override_not_preserved',
      missingOverrides.map(
        (override) => `source override ${override.override_id} is ${override.status}`,
      ),
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
        phaseAdaptations: adaptations,
        teacherOverrideAdaptations: overrideAdaptations,
      },
    );
  }

  const safetyState = finalSafetyState(request, homeschoolDna, adaptations);
  const safetyFailure = validateFinalSafety(request, safetyState);
  if (safetyFailure) {
    return failureResult(
      repository,
      request,
      safetyFailure.code,
      safetyFailure.details,
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
        phaseAdaptations: adaptations,
        teacherOverrideAdaptations: overrideAdaptations,
        checks: {
          safety: [
            {
              code: 'source_safety_checked',
              passed: true,
              rationale_ru:
                `Source supervision requirement evaluated as `
                + `${safetyState.source_supervision_required}.`,
            },
            {
              code: 'adapted_safety_checked',
              passed: true,
              rationale_ru:
                `Final homeschool DNA supervision requirement evaluated as `
                + `${safetyState.adapted_supervision_required}.`,
            },
            {
              code: safetyFailure.code === 'safety_requirement_not_preserved'
                ? 'safety_not_relaxed'
                : 'supervision_availability_checked',
              passed: false,
              rationale_ru: safetyFailure.details.join('; '),
            },
          ],
        },
      },
    );
  }

  const bindingValidation = validateAdaptedBindings(request, adaptations, homeschoolDna);
  if (bindingValidation.failures.length > 0) {
    const priority = [
      'answer_key_binding_missing',
      'practical_binding_missing',
      'explanation_binding_missing',
    ];
    const failureCode = priority.find((code) => (
      bindingValidation.failures.some((failure) => failure.code === code)
    ));
    return failureResult(
      repository,
      request,
      failureCode,
      bindingValidation.failures
        .filter((failure) => failure.code === failureCode)
        .map((failure) => failure.detail),
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
        phaseAdaptations: adaptations,
        answerBindingDecisions: bindingValidation.decisions,
        teacherOverrideAdaptations: overrideAdaptations,
      },
    );
  }

  const roleDecisions = adultRoleDecisions(request, homeschoolDna, targets, repository);
  const timing = adultTiming(request, homeschoolDna, roleDecisions, repository);
  if (
    timing.total_adult_minutes > request.adaptation_context.adult_context.max_support_minutes
    || (!request.adaptation_context.adult_context.available && timing.total_adult_minutes > 0)
  ) {
    return failureResult(
      repository,
      request,
      'adult_effort_exceeds_limit',
      [
        `adult total ${timing.total_adult_minutes} exceeds `
        + `${request.adaptation_context.adult_context.max_support_minutes}`,
      ],
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
      },
    );
  }

  const steps = buildLearnerSteps(request, homeschoolDna, adaptations, targets);
  const roleByPhase = new Map(homeschoolDna.phases.map((phase) => [
    phase.phase_id,
    roleDecisions.find((row) => row.target_id === phase.target.target_id),
  ]));
  const packed = packSessions(steps, roleByPhase, request, repository);
  if (packed.error) {
    return failureResult(
      repository,
      request,
      'timing_unrealistic',
      [packed.error],
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
      },
    );
  }

  const weekly = buildWeeklyPlan(
    request,
    steps,
    packed.sessions,
    timing.total_adult_minutes,
    repository,
  );
  if (weekly.error) {
    return failureResult(
      repository,
      request,
      'timing_unrealistic',
      [weekly.error],
      {
        sourceIdentity: sourceIdentityValue,
        derivedSelectionRequestDigest: selected.result.decision.request_digest,
        derivedSelectionDecision: selected.result.decision,
        phaseAdaptations: adaptations,
        answerBindingDecisions: bindingValidation.decisions,
        teacherOverrideAdaptations: overrideAdaptations,
      },
    );
  }
  const weeklyPlan = weekly.plan;
  const parentGuidance = buildParentGuidance(
    request,
    roleDecisions,
    timing,
    safetyState,
    repository,
  );
  const warnings = warningsForSelection(
    request,
    homeschoolDna,
    targets,
    overrideAdaptations,
  );
  const packageArtifact = buildPackage(
    request,
    sourceIdentityValue,
    homeschoolDna,
    steps,
    packed.breaks,
    weeklyPlan,
    parentGuidance,
    warnings,
    targets,
    safetyState,
    bindingValidation.decisions,
    overrideAdaptations,
    repository,
  );

  const decision = {
    schema_version: '1.0',
    artifact_type: 'homeschool_adaptation_decision',
    decision_id: `${request.request_id}-decision`,
    request_id: request.request_id,
    status: 'success',
    versions: selectionVersions(repository),
    source_identity: sourceIdentityValue,
    derived_selection_request_digest: selected.result.decision.request_digest,
    derived_selection_decision: selected.result.decision,
    selected_variant: request.adaptation_context.variant,
    phase_adaptations: adaptations,
    teacher_override_adaptations: overrideAdaptations,
    answer_binding_decisions: bindingValidation.decisions,
    adult_role_decisions: roleDecisions,
    resource_checks: [
      checks('home_resources_validated', 'Selected targets use only declared available resources.'),
    ],
    safety_checks: successfulSafetyChecks(safetyState),
    language_checks: [
      checks('language_policy_preserved', 'Russian-primary and Estonian-support policy is unchanged.'),
    ],
    answer_access_checks: [
      checks(
        'adapted_answer_bindings_validated',
        'Every adapted phase has only an exact or mapped source binding with required provenance.',
      ),
      checks(
        'answer_access_after_attempt',
        'Relevant answer keys were validated before after-attempt release was approved.',
      ),
    ],
    timing_checks: [
      checks('learner_time_reconciled', 'Learner time equals visible activity and planning components.'),
      checks('adult_time_reconciled', 'Adult time is computed separately from learner time.'),
      checks('session_limits_respected', 'Every session and the session count fit request limits.'),
      checks(
        'review_sessions_reconciled',
        'Every relative retrieval window is represented by a counted review session.',
      ),
    ],
    warnings,
    determinism: {
      ordering: 'bytewise',
      ai_used: false,
      network_used: false,
      randomness_used: false,
      volatile_timestamp_in_core: false,
    },
    failure: null,
  };
  return {
    decision,
    homeschoolLessonDna: homeschoolDna,
    package: packageArtifact,
    parentGuidance,
    weeklyStudyPlan: weeklyPlan,
  };
}

export function materializeHomeschoolFixture(repository, fixture) {
  const sourceFixture = repository.selection.fixtures.data.fixtures.find(
    (candidate) => candidate.fixture_id === fixture.source_fixture_id,
  );
  if (!sourceFixture) throw new Error(`unknown source selection fixture ${fixture.source_fixture_id}`);
  const sourceResult = selectLessonPedagogy(repository.selection, sourceFixture.request);
  if (!sourceResult.lessonDna) {
    throw new Error(`source fixture ${fixture.source_fixture_id} does not produce lesson DNA`);
  }
  return {
    schema_version: '1.0',
    artifact_type: 'homeschool_adaptation_request',
    request_id: fixture.fixture_id,
    source: {
      selection_request: stableClone(sourceFixture.request),
      lesson_dna: stableClone(sourceResult.lessonDna),
    },
    adaptation_context: stableClone(fixture.adaptation_context),
    content_bindings: stableClone(fixture.content_bindings),
  };
}

function compareExample(expected, actual) {
  return stablePedagogyJson(expected) === stablePedagogyJson(actual);
}

function sortedFixtureIds(fixtures) {
  return fixtures.map((fixture) => fixture.fixture_id).sort(compareBytewise);
}

function rulesErrors(repository) {
  const errors = [];
  const rules = repository.rules.data;
  if (rules.schema_version !== '1.0') errors.push('rules schema_version must be 1.0');
  if (rules.artifact_type !== 'homeschool_adaptation_rules') {
    errors.push('rules artifact_type is invalid');
  }
  if (rules.provenance?.claim_origin !== 'project_authored_design') {
    errors.push('rules provenance must be project_authored_design');
  }
  if (rules.provenance?.confidence?.level !== 'provisional') {
    errors.push('rules confidence must remain provisional');
  }
  for (const variant of VARIANTS) {
    if (!rules.variants?.[variant]) errors.push(`rules missing variant ${variant}`);
  }
  if (rules.variants?.parent_child?.learner_count?.max !== 1) {
    errors.push('parent_child adult must not be counted as a learner');
  }
  for (const variant of ['independent', 'parent_child']) {
    if (rules.variants?.[variant]?.study_context !== 'individual_study') {
      errors.push(`${variant} must use individual_study`);
    }
  }
  for (const variant of ['remote_peer', 'small_sibling_group']) {
    if (rules.variants?.[variant]?.study_context !== 'collaborative_study') {
      errors.push(`${variant} must use collaborative_study`);
    }
  }
  return errors;
}

function semanticResultErrors(request, result) {
  if (result.decision.status !== 'success') return [];
  const errors = [];
  const source = request.source.selection_request;
  const dna = result.homeschoolLessonDna;
  if (dna.context.grade !== source.learner_context.grade) errors.push('grade changed');
  if (dna.context.subject !== source.learner_context.subject) errors.push('subject changed');
  if (
    stablePedagogyJson(dna.context.language_policy)
    !== stablePedagogyJson({
      primary_instruction_language: source.language_profile.primary_instruction_language,
      maximum_total_productive_language_demand:
        stricterDemand(
          source.language_profile.maximum_total_productive_language_demand,
          request.adaptation_context.maximum_total_productive_language_demand,
        ),
      estonian_support: {
        enabled: source.language_profile.estonian_support.enabled,
        learner_level: source.language_profile.estonian_support.learner_level,
        allowed_roles: sorted(source.language_profile.estonian_support.allowed_roles),
        subject_explanation_language:
          source.language_profile.estonian_support.subject_explanation_language,
      },
    })
  ) {
    errors.push('language policy changed outside the permitted stricter ceiling');
  }
  const requiredCapabilities = new Set(source.lesson_context.required_capabilities);
  const covered = new Set(dna.phases.flatMap(
    (phase) => [...phase.capabilities.primary, ...phase.capabilities.supporting],
  ));
  for (const capability of requiredCapabilities) {
    if (!covered.has(capability)) errors.push(`required capability ${capability} disappeared`);
  }
  if (!source.language_profile.estonian_support.enabled) {
    if (result.package.context.estonian_support.allowed_roles.length > 0) {
      errors.push('disabled Estonian support produced package roles');
    }
    if (result.package.assessment.estonian_language_assessment) {
      errors.push('disabled Estonian support produced language assessment');
    }
    if (result.package.learner_plan.steps.some((step) => step.estonian_roles.length > 0)) {
      errors.push('disabled Estonian support produced child-step roles');
    }
  }
  const timing = result.package.timing;
  if (
    timing.total_learner_minutes
    !== timing.learner_activity_minutes
      + timing.setup_minutes
      + timing.cleanup_minutes
      + timing.transition_minutes
      + timing.break_minutes
      + timing.delayed_retrieval_minutes
      + timing.weekly_review_minutes
      + timing.contingency_minutes
  ) {
    errors.push('package learner timing does not reconcile');
  }
  if (timing.total_learner_minutes !== result.weeklyStudyPlan.total_learner_minutes) {
    errors.push('package and weekly-plan learner totals differ');
  }
  if (
    result.weeklyStudyPlan.sessions.length
    > request.adaptation_context.maximum_sessions
  ) {
    errors.push('weekly plan exceeds maximum sessions');
  }
  const adult = result.parentGuidance.timing;
  if (
    adult.total_adult_minutes
    !== adult.adult_preparation_minutes
      + adult.adult_live_support_minutes
      + adult.adult_safety_minutes
  ) {
    errors.push('parent timing does not reconcile');
  }
  if (personalDataPaths(result).length > 0) {
    errors.push(`personal-data fields present: ${personalDataPaths(result).join(', ')}`);
  }
  return errors;
}

export function validatePedagogyHomeschool(repository) {
  const errors = [];
  const warnings = [];
  const validators = createPedagogyHomeschoolValidators(repository);
  const selectionValidators = createPedagogySelectionValidators(repository.selection);
  errors.push(...rulesErrors(repository));
  if (!validators.fixtures(repository.fixtures.data)) {
    errors.push(...schemaErrors(validators.fixtures).map(
      (reason) => `${repository.fixtures.file}: ${reason}`,
    ));
  }
  const fixtures = repository.fixtures.data.fixtures;
  const fixtureIds = fixtures.map((fixture) => fixture.fixture_id);
  if (stablePedagogyJson(fixtureIds) !== stablePedagogyJson(sortedFixtureIds(fixtures))) {
    errors.push(`${repository.fixtures.file}: fixture IDs must be bytewise sorted`);
  }
  if (new Set(fixtureIds).size !== fixtureIds.length) {
    errors.push(`${repository.fixtures.file}: fixture IDs must be unique`);
  }
  const sourceFixtureIds = new Set(
    repository.selection.fixtures.data.fixtures
      .filter((fixture) => fixture.expected.status === 'success')
      .map((fixture) => fixture.fixture_id),
  );
  const targetIds = new Set(targetMap(repository).keys());
  const resourceIds = new Set(
    repository.selection.knowledge.taxonomy.data.resource_vocabulary
      .map((item) => item.resource_id),
  );
  const generatedExamples = new Map();
  for (const fixture of fixtures) {
    if (!sourceFixtureIds.has(fixture.source_fixture_id)) {
      errors.push(`${fixture.fixture_id}: unknown successful source fixture ${fixture.source_fixture_id}`);
      continue;
    }
    for (const targetId of [
      ...fixture.adaptation_context.homeschool_preferences.preferred_target_ids,
      ...fixture.adaptation_context.homeschool_preferences.excluded_target_ids,
      ...fixture.expected.include_target_ids,
      ...fixture.expected.exclude_target_ids,
    ]) {
      if (!targetIds.has(targetId)) errors.push(`${fixture.fixture_id}: unknown target ${targetId}`);
    }
    for (const resourceId of [
      ...fixture.adaptation_context.resources.available,
      ...fixture.adaptation_context.resources.unavailable,
    ]) {
      if (!resourceIds.has(resourceId)) {
        errors.push(`${fixture.fixture_id}: unknown resource ${resourceId}`);
      }
    }
    const request = materializeHomeschoolFixture(repository, fixture);
    if (!validators.request(request)) {
      errors.push(...schemaErrors(validators.request).map(
        (reason) => `${fixture.fixture_id}:request ${reason}`,
      ));
      continue;
    }
    const result = adaptLessonForHomeschool(repository, request);
    if (!validators.decision(result.decision)) {
      errors.push(...schemaErrors(validators.decision).map(
        (reason) => `${fixture.fixture_id}:decision ${reason}`,
      ));
      continue;
    }
    if (result.decision.status !== fixture.expected.status) {
      errors.push(
        `${fixture.fixture_id}: expected ${fixture.expected.status}, got ${result.decision.status}`,
      );
    }
    if ((result.decision.failure?.code ?? null) !== fixture.expected.failure_code) {
      errors.push(`${fixture.fixture_id}: failure code differs from expectation`);
    }
    if (
      (result.decision.derived_selection_decision?.selected_pattern?.pattern_id ?? null)
      !== fixture.expected.pattern_id
    ) {
      errors.push(`${fixture.fixture_id}: selected pattern differs from expectation`);
    }
    if (result.decision.selected_variant !== fixture.expected.variant) {
      errors.push(`${fixture.fixture_id}: selected variant differs from expectation`);
    }
    const selectedIds = result.homeschoolLessonDna?.phases.map(
      (phase) => phase.target.target_id,
    ) ?? [];
    for (const targetId of fixture.expected.include_target_ids) {
      if (!selectedIds.includes(targetId)) {
        errors.push(`${fixture.fixture_id}: expected target ${targetId} was not selected`);
      }
    }
    for (const targetId of fixture.expected.exclude_target_ids) {
      if (selectedIds.includes(targetId)) {
        errors.push(`${fixture.fixture_id}: excluded target ${targetId} was selected`);
      }
    }
    const warningCodes = result.decision.warnings.map((warning) => warning.code);
    if (stablePedagogyJson(warningCodes) !== stablePedagogyJson(fixture.expected.warning_codes)) {
      errors.push(`${fixture.fixture_id}: warning codes differ from expectation`);
    }
    if (result.decision.status === 'success') {
      if (!selectionValidators.lessonDna(result.homeschoolLessonDna)) {
        errors.push(...schemaErrors(selectionValidators.lessonDna).map(
          (reason) => `${fixture.fixture_id}:lessonDna ${reason}`,
        ));
      }
      for (const [name, value] of [
        ['package', result.package],
        ['parentGuidance', result.parentGuidance],
        ['weeklyStudyPlan', result.weeklyStudyPlan],
      ]) {
        if (!validators[name](value)) {
          errors.push(...schemaErrors(validators[name]).map(
            (reason) => `${fixture.fixture_id}:${name} ${reason}`,
          ));
        }
      }
      errors.push(...semanticResultErrors(request, result).map(
        (reason) => `${fixture.fixture_id}: ${reason}`,
      ));
      if (fixture.expected.example_id) {
        generatedExamples.set(fixture.expected.example_id, {
          example_id: fixture.expected.example_id,
          homeschool_lesson_dna: result.homeschoolLessonDna,
          package: result.package,
          parent_guidance: result.parentGuidance,
          weekly_study_plan: result.weeklyStudyPlan,
        });
      }
    }
    const repeated = adaptLessonForHomeschool(repository, request);
    if (stablePedagogyJson(result) !== stablePedagogyJson(repeated)) {
      errors.push(`${fixture.fixture_id}: repeated output is not byte-identical`);
    }
  }
  if (repository.examples) {
    if (!validators.examples(repository.examples.data)) {
      errors.push(...schemaErrors(validators.examples).map(
        (reason) => `${repository.examples.file}: ${reason}`,
      ));
    } else {
      const exampleIds = repository.examples.data.examples.map((example) => example.example_id);
      if (stablePedagogyJson(exampleIds) !== stablePedagogyJson(sorted(exampleIds))) {
        errors.push(`${repository.examples.file}: examples must be bytewise sorted`);
      }
      for (const example of repository.examples.data.examples) {
        const generated = generatedExamples.get(example.example_id);
        if (!generated) errors.push(`${repository.examples.file}: no fixture generates ${example.example_id}`);
        else if (!compareExample(example, generated)) {
          errors.push(`${repository.examples.file}: ${example.example_id} is stale`);
        }
      }
      for (const generatedId of generatedExamples.keys()) {
        if (!exampleIds.includes(generatedId)) {
          errors.push(`${repository.examples.file}: missing generated example ${generatedId}`);
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      fixtures: fixtures.length,
      successfulFixtures: fixtures.filter((fixture) => fixture.expected.status === 'success').length,
      failureFixtures: fixtures.filter((fixture) => fixture.expected.status === 'failure').length,
      examples: repository.examples?.data.examples.length ?? 0,
      schemas: Object.keys(repository.schemas).length,
    },
  };
}

export function serializeHomeschoolYaml(value) {
  return serializePedagogyYaml(stableClone(value));
}

export const pedagogyHomeschoolPaths = {
  rules: PEDAGOGY_HOMESCHOOL_RULES,
  fixtures: PEDAGOGY_HOMESCHOOL_FIXTURES,
  examples: PEDAGOGY_HOMESCHOOL_EXAMPLES,
  schemas: HOMESCHOOL_SCHEMA_FILES,
};
