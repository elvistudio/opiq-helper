import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { stringify } from 'yaml';
import {
  createPedagogySchemaValidators,
  loadPedagogyKnowledge,
  parseStrictPedagogyYaml,
  validatePedagogyKnowledge,
} from './pedagogy-knowledge.mjs';
import {
  expandPedagogyActivityTargets,
  pedagogyQueryOrders,
} from './pedagogy-query.mjs';

export const PEDAGOGY_SELECTION_ENGINE_VERSION = '1.1';
export const PEDAGOGY_SELECTION_ROOT = 'knowledge/pedagogy/selection';
export const PEDAGOGY_SELECTION_RULES = `${PEDAGOGY_SELECTION_ROOT}/selection-rules.yaml`;
export const PEDAGOGY_SELECTION_FIXTURES = `${PEDAGOGY_SELECTION_ROOT}/grade-5-selection-fixtures.yaml`;
export const PEDAGOGY_LESSON_DNA_EXAMPLES = `${PEDAGOGY_SELECTION_ROOT}/lesson-dna-examples.yaml`;

const SCHEMA_ROOT = 'knowledge/pedagogy/schemas';
const SELECTION_SCHEMA_FILES = {
  rules: `${SCHEMA_ROOT}/pedagogical-selection-rules.schema.json`,
  request: `${SCHEMA_ROOT}/pedagogical-selection-request.schema.json`,
  decision: `${SCHEMA_ROOT}/pedagogical-selection-decision.schema.json`,
  lessonDna: `${SCHEMA_ROOT}/lesson-dna.schema.json`,
  fixtures: `${SCHEMA_ROOT}/pedagogical-selection-fixtures.schema.json`,
  examples: `${SCHEMA_ROOT}/lesson-dna-examples.schema.json`,
};

const EFFORT_ORDER = pedagogyQueryOrders.effort;
const DEMAND_ORDER = pedagogyQueryOrders.demand;
const CAPABILITY_ORDER = pedagogyQueryOrders.capability;
const SUPPORTED_CAPABILITY_LEVELS = new Set(['primary', 'supporting']);
const LANGUAGE_HEAVY_LEVELS = new Set(['high', 'very_high']);
const SET_ARRAY_KEYS = new Set([
  'accessibility_priorities',
  'allowed_roles',
  'available',
  'avoid_recent_target_ids',
  'content_types',
  'desired_capabilities',
  'excluded_target_ids',
  'phase_needs',
  'preferred_group_formats',
  'preferred_pattern_ids',
  'preferred_target_ids',
  'previous_target_ids',
  'required_capabilities',
  'supported_group_formats',
  'unavailable',
]);
const REQUIRED_SELECTION_WEIGHT_KEYS = [
  'a1_a2_direct_fit',
  'a1_a2_scaffolded_fit',
  'adaptable_delivery_fit',
  'content_type_match',
  'desired_capability_incidental',
  'desired_capability_primary',
  'desired_capability_supporting',
  'direct_delivery_fit',
  'effort_headroom',
  'execution_profile_specificity',
  'preferred_group_format_fit',
  'pattern_activity_option',
  'pattern_phase_fit',
  'preferred_pattern',
  'preferred_target',
  'required_capability_primary',
  'required_capability_supporting',
  'resource_simplicity',
  'source_access_fit',
];
const REQUIRED_SELECTION_PENALTY_KEYS = [
  'limited_delivery_fit',
  'limited_a1_a2',
  'provisional_taxonomy',
  'recent_target',
  'unknown_taxonomy',
];
const REQUIRED_HARD_CONSTRAINT_KEYS = [
  'adult_role_constraints',
  'duration_and_reserve',
  'execution_profile_required_for_profiled_activity',
  'grade_and_subject',
  'group_and_delivery',
  'language_profile',
  'lesson_phase',
  'prohibited_targets',
  'required_resources',
  'safety_supervision',
  'source_access_policy',
  'teacher_override_cannot_bypass',
];
const REQUIRED_CAPABILITY_SCORE_KEYS = ['incidental', 'none', 'primary', 'supporting', 'unknown'];
const FAILURE_PRIORITY = [
  'invalid_teacher_override',
  'safety_supervision_unavailable',
  'missing_required_resource',
  'language_profile_incompatible',
  'unsatisfied_required_capability',
  'duration_overflow',
  'incompatible_phase_combination',
  'no_candidate_for_required_slot',
];

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

function displayPath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort(compareBytewise).map((key) => [key, stableValue(value[key])]),
  );
}

export function stablePedagogyJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function sha256PedagogyValue(value) {
  return crypto.createHash('sha256').update(stablePedagogyJson(value)).digest('hex');
}

function normalizeRequestValue(value, key = '') {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeRequestValue(item));
    if (key === 'teacher_overrides') {
      return normalized.sort((left, right) => compareBytewise(left.override_id, right.override_id));
    }
    if (key === 'future_retrieval_windows') {
      return normalized.sort((left, right) => compareBytewise(
        stablePedagogyJson(left),
        stablePedagogyJson(right),
      ));
    }
    return SET_ARRAY_KEYS.has(key)
      ? normalized.sort((left, right) => compareBytewise(String(left), String(right)))
      : normalized;
  }
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort(compareBytewise)
      .map((childKey) => [childKey, normalizeRequestValue(value[childKey], childKey)]),
  );
}

export function normalizePedagogySelectionRequest(request) {
  return normalizeRequestValue(structuredClone(request));
}

export function validateEstonianSupportState(request) {
  const support = request.language_profile?.estonian_support;
  const diagnostics = [];
  if (!support || typeof support.enabled !== 'boolean') {
    return {
      valid: false,
      diagnostics: ['estonian_support.enabled must be a boolean'],
    };
  }
  if (support.language !== 'et') {
    diagnostics.push('estonian_support language must be et');
  }
  if (support.subject_explanation_language !== 'ru') {
    diagnostics.push('estonian_support subject_explanation_language must be ru');
  }
  if (support.enabled) {
    if (support.learner_level !== 'A1-A2') {
      diagnostics.push('estonian_support is enabled but learner_level is not A1-A2');
    }
    if (
      request.learner_context?.grade === 5
      && request.learner_context?.subject === 'science'
      && request.language_profile.primary_instruction_language !== 'ru'
    ) {
      diagnostics.push(
        'grade-5 science with enabled Estonian support requires primary_instruction_language ru',
      );
    }
  } else {
    if (support.learner_level !== 'not_applicable') {
      diagnostics.push('estonian_support is disabled but learner_level is not not_applicable');
    }
    if (!Array.isArray(support.allowed_roles) || support.allowed_roles.length > 0) {
      diagnostics.push('estonian_support is disabled but allowed_roles is not empty');
    }
    if (support.sentence_frames_required !== false) {
      diagnostics.push('estonian_support is disabled but sentence_frames_required is true');
    }
    if (support.word_bank_required !== false) {
      diagnostics.push('estonian_support is disabled but word_bank_required is true');
    }
    if (support.assessment_requested !== false) {
      diagnostics.push('estonian_support is disabled but assessment_requested is true');
    }
  }
  return {
    valid: diagnostics.length === 0,
    diagnostics: diagnostics.sort(compareBytewise),
  };
}

export function validateLearnerContextState(request) {
  const learner = request.learner_context;
  const diagnostics = [];
  if (learner?.study_context === 'individual_study' && learner.group_size !== 1) {
    diagnostics.push('individual_study requires group_size 1');
  }
  if (learner?.study_context === 'collaborative_study' && learner.group_size < 2) {
    diagnostics.push('collaborative_study requires group_size at least 2');
  }
  return {
    valid: diagnostics.length === 0,
    diagnostics: diagnostics.sort(compareBytewise),
  };
}

function compareOverrideIdentity(left, right) {
  return compareBytewise(left.override_id, right.override_id)
    || compareBytewise(left.slot_id, right.slot_id)
    || compareBytewise(left.requested_target_id, right.requested_target_id);
}

export function validateTeacherOverrideSet(request) {
  const overrides = request.preferences?.teacher_overrides ?? [];
  const idCounts = new Map();
  const slotCounts = new Map();
  for (const override of overrides) {
    idCounts.set(override.override_id, (idCounts.get(override.override_id) ?? 0) + 1);
    slotCounts.set(override.slot_id, (slotCounts.get(override.slot_id) ?? 0) + 1);
  }
  const duplicateIds = sorted(
    [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const duplicateSlots = sorted(
    [...slotCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );
  const missingRationaleIds = sorted(overrides
    .filter((override) => (
      typeof override.rationale_ru !== 'string' || override.rationale_ru.trim().length === 0
    ))
    .map((override) => override.override_id));
  if (
    duplicateIds.length === 0
    && duplicateSlots.length === 0
    && missingRationaleIds.length === 0
  ) {
    return { valid: true, details: [], overrideResults: [] };
  }
  const overrideResults = overrides.map((override) => {
    const reasons = [];
    if (idCounts.get(override.override_id) > 1) reasons.push('Override ID is duplicated.');
    if (slotCounts.get(override.slot_id) > 1) {
      reasons.push('Multiple overrides target the same slot.');
    }
    if (typeof override.rationale_ru !== 'string' || override.rationale_ru.trim().length === 0) {
      reasons.push('Teacher override rationale is required.');
    }
    if (reasons.length === 0) {
      reasons.push('Selection request contains another invalid teacher override.');
    }
    return {
      override_id: override.override_id,
      status: 'rejected',
      slot_id: override.slot_id,
      requested_target_id: override.requested_target_id,
      reason: reasons.sort(compareBytewise).join(' '),
    };
  }).sort(compareOverrideIdentity);
  return {
    valid: false,
    details: [
      ...duplicateIds.map((id) => `duplicate override id ${id}`),
      ...duplicateSlots.map((slotId) => `multiple overrides target slot ${slotId}`),
      ...missingRationaleIds.map((id) => `override ${id} has no rationale`),
    ].sort(compareBytewise),
    overrideResults,
  };
}

function selectionTargetIdentity(target) {
  const { activity, operational } = target;
  return {
    target_id: target.target_id,
    activity_id: target.activity_id,
    execution_profile_id: target.execution_profile_id,
    category: activity.category,
    suitable_lesson_phases: sorted(activity.suitable_lesson_phases),
    suitable_grades: activity.suitable_grades,
    content_types: sorted(activity.content_types),
    subjects: sorted(activity.subjects),
    capabilities: stableValue(operational.capabilities),
    delivery_constraints: stableValue(operational.delivery_constraints),
    duration: stableValue(operational.duration),
    effort: stableValue(operational.effort),
    homeschool_adaptation: stableValue(operational.homeschool_adaptation),
    resource_requirements: stableValue(operational.resource_requirements),
    learner_demands: stableValue(operational.learner_demands),
    compatibility: stableValue(operational.compatibility),
    safety: stableValue(operational.safety),
    taxonomy_assessment: stableValue(operational.taxonomy_assessment),
    assessment_roles: sorted(activity.assessment_roles),
  };
}

export function computeActivityCatalogSelectionDigest(activities) {
  return sha256PedagogyValue(
    expandPedagogyActivityTargets(activities)
      .map(selectionTargetIdentity)
      .sort((left, right) => compareBytewise(left.target_id, right.target_id)),
  );
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

export async function loadPedagogySelectionRepository({
  rootDir = process.cwd(),
  examplesOptional = false,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [knowledge, rules, fixtures, examples, schemaEntries] = await Promise.all([
    loadPedagogyKnowledge({ rootDir: absoluteRoot }),
    readYaml(absoluteRoot, PEDAGOGY_SELECTION_RULES),
    readYaml(absoluteRoot, PEDAGOGY_SELECTION_FIXTURES),
    readYaml(absoluteRoot, PEDAGOGY_LESSON_DNA_EXAMPLES, { optional: examplesOptional }),
    Promise.all(Object.entries(SELECTION_SCHEMA_FILES).map(async ([name, repositoryPath]) => [
      name,
      await readJson(absoluteRoot, repositoryPath),
    ])),
  ]);
  return {
    rootDir: absoluteRoot,
    knowledge,
    rules,
    fixtures,
    examples,
    schemas: Object.fromEntries(schemaEntries),
    loadedArtifactPaths: uniqueSorted([
      ...knowledge.allFiles,
      PEDAGOGY_SELECTION_RULES,
      PEDAGOGY_SELECTION_FIXTURES,
      ...(examples ? [PEDAGOGY_LESSON_DNA_EXAMPLES] : []),
      ...Object.values(SELECTION_SCHEMA_FILES),
    ]),
  };
}

export function createPedagogySelectionValidators(repository) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(repository.knowledge.schemas.common);
  for (const schema of Object.values(repository.schemas)) ajv.addSchema(schema);
  return Object.fromEntries(
    Object.entries(repository.schemas).map(([name, schema]) => [name, ajv.getSchema(schema.$id)]),
  );
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => (
    `${error.instancePath || '/'} ${error.message}`
    + (error.params?.additionalProperty ? `: ${error.params.additionalProperty}` : '')
  ));
}

function groupFormatSize(format, groupSize) {
  if (format === 'individual') return 1;
  if (format === 'pair') return 2;
  if (format === 'triad') return 3;
  if (format === 'small_group' || format === 'rotating_stations') return Math.min(groupSize, 4);
  if (format === 'medium_group') return Math.min(groupSize, 8);
  return groupSize;
}

function selectGroupFormat(target, request, rules) {
  const supported = target.operational.delivery_constraints.supported_group_formats;
  const allowed = request.learner_context.supported_group_formats;
  const candidates = allowed.filter((format) => {
    if (!supported.includes(format)) return false;
    const size = groupFormatSize(format, request.learner_context.group_size);
    const range = target.operational.delivery_constraints.group_size;
    return range.min <= size && size <= range.max;
  });
  const fallbackOrder = rules.group_format_selection.fallback_order;
  const candidateSet = new Set(candidates);
  const preferredSet = new Set(request.preferences.preferred_group_formats);
  const preferred = fallbackOrder.find(
    (format) => candidateSet.has(format) && preferredSet.has(format),
  );
  if (preferred) {
    return {
      selected: preferred,
      preferred: true,
      fallback_used: false,
    };
  }
  const fallback = fallbackOrder.find((format) => candidateSet.has(format)) ?? null;
  return {
    selected: fallback,
    preferred: false,
    fallback_used: fallback !== null,
  };
}

function homeschoolDeliveryFit(status, rules) {
  return rules.delivery_fit.homeschool_status_mapping[status] ?? 'unknown';
}

function mostRestrictiveDeliveryFit(dimensions, rules) {
  const order = rules.delivery_fit.restriction_order_most_to_least;
  return dimensions.reduce((current, item) => (
    order.indexOf(item.fit) < order.indexOf(current) ? item.fit : current
  ), 'directly_supported');
}

function determineDeliveryFit(target, request, rules) {
  const { operational } = target;
  const learner = request.learner_context;
  const dimensions = [{
    dimension: 'declared_delivery_mode',
    fit: operational.delivery_constraints.delivery_modes.includes(learner.delivery_mode)
      ? 'directly_supported'
      : 'not_recommended',
  }];
  if (['homeschool', 'parent_supported'].includes(learner.delivery_mode)) {
    dimensions.push({
      dimension: 'homeschool_adaptation',
      fit: homeschoolDeliveryFit(operational.homeschool_adaptation.status, rules),
    });
  }
  if (learner.delivery_mode === 'remote') {
    dimensions.push({
      dimension: 'remote_delivery',
      fit: operational.compatibility.remote_delivery,
    });
  }
  if (learner.delivery_mode === 'independent_study' || learner.group_size === 1) {
    dimensions.push({
      dimension: 'one_learner',
      fit: operational.compatibility.one_learner,
    });
  }
  if (
    learner.study_context === 'classroom'
    && learner.group_size >= rules.delivery_fit.large_class_group_size_threshold
  ) {
    dimensions.push({
      dimension: 'large_class',
      fit: operational.compatibility.large_class,
    });
  }
  const sortedDimensions = dimensions.sort(
    (left, right) => compareBytewise(left.dimension, right.dimension),
  );
  return {
    delivery_fit: mostRestrictiveDeliveryFit(sortedDimensions, rules),
    delivery_dimensions: sortedDimensions,
  };
}

function effectiveAvailableResources(request) {
  const resources = new Set(request.resources.available);
  const toggles = {
    internet_available: 'internet',
    projector_available: 'projector',
    laboratory_materials_available: 'laboratory_materials',
    measuring_tools_available: 'measuring_tools',
    outdoor_access_available: 'outdoor_access',
  };
  for (const [field, resource] of Object.entries(toggles)) {
    if (request.resources[field]) resources.add(resource);
  }
  return resources;
}

function hardFilterTarget(target, pattern, component, slot, request, rules) {
  const reasons = [];
  const { activity, operational } = target;
  const learner = request.learner_context;
  const resources = effectiveAvailableResources(request);
  const unavailable = new Set(request.resources.unavailable);
  const groupFormatSelection = selectGroupFormat(target, request, rules);
  const delivery = determineDeliveryFit(target, request, rules);
  const operationalFit = {
    ...delivery,
    group_format_selection: groupFormatSelection,
  };

  if (!(activity.suitable_grades.min <= learner.grade && learner.grade <= activity.suitable_grades.max)) {
    reasons.push(`grade ${learner.grade} outside ${activity.suitable_grades.min}-${activity.suitable_grades.max}`);
  }
  if (!activity.subjects.includes(learner.subject) && !activity.subjects.includes('cross_curricular')) {
    reasons.push(`subject ${learner.subject} is not supported`);
  }
  if (!activity.suitable_lesson_phases.includes(slot.phase)) {
    reasons.push(`lesson phase ${slot.phase} is not supported`);
  }
  if (!operational.delivery_constraints.delivery_modes.includes(learner.delivery_mode)) {
    reasons.push(`delivery mode ${learner.delivery_mode} is not supported`);
  }
  if (rules.delivery_fit.hard_reject.includes(delivery.delivery_fit)) {
    reasons.push(`effective delivery fit ${delivery.delivery_fit} is not allowed`);
  }
  if (!groupFormatSelection.selected) {
    reasons.push('no requested group format is compatible with the execution range');
  }
  for (const resourceId of operational.resource_requirements.required) {
    if (!resources.has(resourceId) || unavailable.has(resourceId)) {
      reasons.push(`required resource ${resourceId} is unavailable`);
    }
  }
  if (operational.resource_requirements.printer_required && !request.resources.printer_available) {
    reasons.push('printer is required but unavailable');
  }
  if (operational.resource_requirements.internet_required && !request.resources.internet_available) {
    reasons.push('internet is required but unavailable');
  }
  if (
    operational.safety.requires_adult_supervision
    && !request.resources.adult_safety_supervision_available
  ) {
    reasons.push('adult safety supervision is required but unavailable');
  }
  for (const [field, limit] of [
    ['teacher_preparation', request.constraints.max_teacher_preparation],
    ['teacher_facilitation', request.constraints.max_teacher_facilitation],
    ['learner_setup', request.constraints.max_learner_setup],
  ]) {
    if (EFFORT_ORDER.get(operational.effort[field].level) > EFFORT_ORDER.get(limit)) {
      reasons.push(`${field} effort ${operational.effort[field].level} exceeds ${limit}`);
    }
  }
  if (
    learner.study_context === 'individual_study'
    && EFFORT_ORDER.get(operational.effort.homeschool_parent.level)
      > EFFORT_ORDER.get(request.constraints.max_parent_effort)
  ) {
    reasons.push(
      `parent effort ${operational.effort.homeschool_parent.level} exceeds `
      + request.constraints.max_parent_effort,
    );
  }
  const maximumLanguage = request.language_profile.maximum_total_productive_language_demand;
  if (
    DEMAND_ORDER.get(operational.learner_demands.productive_language)
      > DEMAND_ORDER.get(maximumLanguage)
  ) {
    reasons.push(
      `total productive-language demand ${operational.learner_demands.productive_language} exceeds `
      + maximumLanguage,
    );
  }
  if (
    request.language_profile.estonian_support.enabled
    && ['not_recommended', 'unknown'].includes(
      operational.learner_demands.estonian_a1_a2_compatibility,
    )
  ) {
    reasons.push(
      `Estonian A1-A2 compatibility is `
      + operational.learner_demands.estonian_a1_a2_compatibility,
    );
  }
  if (request.preferences.excluded_target_ids.includes(target.target_id)) {
    reasons.push('target is explicitly excluded');
  }
  if (
    slot.phase === 'retrieval'
    && request.constraints.retrieval_first_attempt_without_source
    && operational.delivery_constraints.source_access_during_first_attempt !== 'prohibited'
  ) {
    reasons.push('retrieval first attempt must prohibit source access');
  }
  if (
    request.lesson_context.context_flags.practical
    && slot.slot_id === 'practical-work'
    && !['observation', 'measurement', 'experimentation'].some(
      (capability) => SUPPORTED_CAPABILITY_LEVELS.has(operational.capabilities[capability]),
    )
  ) {
    reasons.push('practical-work slot requires observation, measurement, or experimentation');
  }
  return {
    passed: reasons.length === 0,
    reasons,
    operationalFit,
    pattern,
    component,
  };
}

function addScore(components, name, value) {
  if (value !== 0) components[name] = (components[name] ?? 0) + value;
}

function capabilityScore(level, required, weights) {
  if (required) {
    if (level === 'primary') return weights.required_capability_primary;
    if (level === 'supporting') return weights.required_capability_supporting;
    return 0;
  }
  if (level === 'primary') return weights.desired_capability_primary;
  if (level === 'supporting') return weights.desired_capability_supporting;
  if (level === 'incidental') return weights.desired_capability_incidental;
  return 0;
}

function scoreTarget(target, pattern, component, slot, request, rules, operationalFit) {
  const { activity, operational } = target;
  const { weights, penalties, parameters } = rules.scoring;
  const components = {};
  for (const capabilityId of request.lesson_context.required_capabilities) {
    addScore(
      components,
      `required_${capabilityId}`,
      capabilityScore(operational.capabilities[capabilityId] ?? 'none', true, weights),
    );
  }
  for (const capabilityId of request.lesson_context.desired_capabilities) {
    addScore(
      components,
      `desired_${capabilityId}`,
      capabilityScore(operational.capabilities[capabilityId] ?? 'none', false, weights),
    );
  }
  const contentMatches = activity.content_types
    .filter((contentType) => request.lesson_context.content_types.includes(contentType)).length;
  addScore(components, 'content_type_match', contentMatches * weights.content_type_match);
  addScore(components, 'pattern_phase_fit', weights.pattern_phase_fit);
  if (component.activity_options.includes(activity.activity_id)) {
    addScore(components, 'pattern_activity_option', weights.pattern_activity_option);
  }
  if (operationalFit.delivery_fit === 'directly_supported') {
    addScore(components, 'direct_delivery_fit', weights.direct_delivery_fit);
  }
  if (operationalFit.delivery_fit === 'adaptable') {
    addScore(components, 'adaptable_delivery_fit', weights.adaptable_delivery_fit);
  }
  if (operationalFit.delivery_fit === 'limited') {
    addScore(components, 'limited_delivery_fit', penalties.limited_delivery_fit);
  }
  if (operationalFit.group_format_selection.preferred) {
    addScore(
      components,
      'preferred_group_format_fit',
      weights.preferred_group_format_fit,
    );
  }
  if (target.execution_profile_id) {
    addScore(components, 'execution_profile_specificity', weights.execution_profile_specificity);
  }
  if (request.language_profile.estonian_support.enabled) {
    const a1a2 = operational.learner_demands.estonian_a1_a2_compatibility;
    if (a1a2 === 'directly_supported') {
      addScore(components, 'a1_a2_fit', weights.a1_a2_direct_fit);
    }
    if (a1a2 === 'supported_with_scaffold') {
      addScore(components, 'a1_a2_fit', weights.a1_a2_scaffolded_fit);
    }
    if (a1a2 === 'limited') {
      addScore(components, 'limited_a1_a2', penalties.limited_a1_a2);
    }
  }
  if (request.preferences.preferred_target_ids.includes(target.target_id)) {
    addScore(components, 'preferred_target', weights.preferred_target);
  }
  if (request.preferences.avoid_recent_target_ids.includes(target.target_id)) {
    addScore(components, 'recent_target', penalties.recent_target);
  }
  if (request.lesson_context.previous_target_ids.includes(target.target_id)) {
    addScore(components, 'previous_target', penalties.recent_target);
  }
  if (operational.taxonomy_assessment.confidence.level === 'provisional') {
    addScore(components, 'provisional_taxonomy', penalties.provisional_taxonomy);
  }
  if (operational.taxonomy_assessment.confidence.level === 'unknown') {
    addScore(components, 'unknown_taxonomy', penalties.unknown_taxonomy);
  }
  const requiredCount = operational.resource_requirements.required.length;
  addScore(
    components,
    'resource_simplicity',
    Math.max(0, parameters.resource_simplicity_required_resource_ceiling - requiredCount)
      * weights.resource_simplicity,
  );
  const preparationHeadroom = EFFORT_ORDER.get(request.constraints.max_teacher_preparation)
    - EFFORT_ORDER.get(operational.effort.teacher_preparation.level);
  if (preparationHeadroom > 0) addScore(components, 'effort_headroom', weights.effort_headroom);
  if (
    slot.phase === 'retrieval'
    && operational.delivery_constraints.source_access_during_first_attempt === 'prohibited'
  ) {
    addScore(components, 'source_access_fit', weights.source_access_fit);
  }
  if (request.preferences.preferred_pattern_ids.includes(pattern.pattern_id)) {
    addScore(components, 'preferred_pattern', weights.preferred_pattern);
  }
  const orderedComponents = Object.fromEntries(
    Object.entries(components).sort(([left], [right]) => compareBytewise(left, right)),
  );
  return {
    total: Object.values(orderedComponents).reduce((total, value) => total + value, 0),
    components: orderedComponents,
    groupFormat: operationalFit.group_format_selection.selected,
    operationalFit,
  };
}

function patternComponent(pattern, phase) {
  return pattern.recommended_components.find((component) => component.phase === phase);
}

function candidateRowsForSlot(targets, pattern, slot, request, rules) {
  const component = patternComponent(pattern, slot.phase);
  return targets.map((target) => {
    const hard = hardFilterTarget(target, pattern, component, slot, request, rules);
    return {
      target,
      hard,
      score: hard.passed
        ? scoreTarget(target, pattern, component, slot, request, rules, hard.operationalFit)
        : null,
    };
  }).sort((left, right) => {
    if (left.hard.passed !== right.hard.passed) return left.hard.passed ? -1 : 1;
    if (left.score?.total !== right.score?.total) return (right.score?.total ?? 0) - (left.score?.total ?? 0);
    return compareBytewise(left.target.target_id, right.target.target_id);
  });
}

function capabilityCovered(choices, capabilityId) {
  return choices.some((choice) => (
    choice
    && SUPPORTED_CAPABILITY_LEVELS.has(
      choice.target.operational.capabilities[capabilityId] ?? 'none',
    )
  ));
}

function combinationTiming(choices, rules) {
  let previousFormat = null;
  let transitionMinutes = 0;
  let activityMinutes = 0;
  let setupMinutes = 0;
  let cleanupMinutes = 0;
  const phases = [];
  for (const choice of choices.filter(Boolean)) {
    const operational = choice.target.operational;
    const transition = previousFormat && previousFormat !== choice.score.groupFormat
      ? rules.timing.transition_minutes_when_group_format_changes
      : 0;
    previousFormat = choice.score.groupFormat;
    transitionMinutes += transition;
    activityMinutes += operational.duration.min_minutes;
    setupMinutes += operational.resource_requirements.setup_minutes;
    cleanupMinutes += operational.resource_requirements.cleanup_minutes;
    phases.push({
      activity_minutes: operational.duration.min_minutes,
      setup_minutes: operational.resource_requirements.setup_minutes,
      cleanup_minutes: operational.resource_requirements.cleanup_minutes,
      transition_minutes: transition,
    });
  }
  const reserveMinutes = rules.timing.reserve_minutes;
  return {
    activity_minutes: activityMinutes,
    setup_minutes: setupMinutes,
    cleanup_minutes: cleanupMinutes,
    transition_minutes: transitionMinutes,
    reserve_minutes: reserveMinutes,
    total_planned_minutes: activityMinutes + setupMinutes + cleanupMinutes + transitionMinutes + reserveMinutes,
    phases,
  };
}

function evaluateCombination(choices, pattern, request, rules) {
  const failures = [];
  const selected = choices.filter(Boolean);
  const targetIds = selected.map((choice) => choice.target.target_id);
  if (new Set(targetIds).size !== targetIds.length) {
    failures.push({ code: 'incompatible_phase_combination', detail: 'one target cannot fill multiple lesson slots' });
  }
  for (const capabilityId of request.lesson_context.required_capabilities) {
    if (!capabilityCovered(selected, capabilityId)) {
      failures.push({
        code: 'unsatisfied_required_capability',
        detail: `required capability ${capabilityId} is not covered at supporting or primary level`,
      });
    }
  }
  const timing = combinationTiming(selected, rules);
  if (timing.total_planned_minutes > request.learner_context.lesson_duration_minutes) {
    failures.push({
      code: 'duration_overflow',
      detail: `planned ${timing.total_planned_minutes} minutes exceeds `
        + `${request.learner_context.lesson_duration_minutes}`,
    });
  }
  const distinctFormats = new Set(selected.map((choice) => choice.score.groupFormat));
  if (distinctFormats.size > rules.timing.maximum_distinct_group_formats) {
    failures.push({
      code: 'incompatible_phase_combination',
      detail: `${distinctFormats.size} group formats exceeds ${rules.timing.maximum_distinct_group_formats}`,
    });
  }
  if (
    request.lesson_context.context_flags.retrieval
    || ['retrieval_and_consolidation', 'revision'].includes(request.lesson_context.purpose)
  ) {
    const retrievalIndex = choices.findIndex((choice) => choice?.slot.phase === 'retrieval');
    const laterCorrection = choices.slice(retrievalIndex + 1).some((choice) => (
      choice
      && SUPPORTED_CAPABILITY_LEVELS.has(
        choice.target.operational.capabilities.error_correction ?? 'none',
      )
    ));
    if (retrievalIndex >= 0 && !laterCorrection) {
      failures.push({
        code: 'incompatible_phase_combination',
        detail: 'retrieval must be followed by a correction or feedback target',
      });
    }
  }
  if (request.lesson_context.context_flags.practical) {
    const practical = selected.some((choice) => (
      ['observation', 'measurement', 'experimentation'].some((capabilityId) => (
        SUPPORTED_CAPABILITY_LEVELS.has(
          choice.target.operational.capabilities[capabilityId] ?? 'none',
        )
      ))
    ));
    const conclusion = selected.some((choice) => (
      SUPPORTED_CAPABILITY_LEVELS.has(
        choice.target.operational.capabilities.evidence_based_conclusion ?? 'none',
      )
    ));
    if (!practical || !conclusion) {
      failures.push({
        code: 'incompatible_phase_combination',
        detail: 'practical composition requires observation or measurement and an evidence-based conclusion',
      });
    }
  }
  if (
    request.language_profile.estonian_support.enabled
    && request.language_profile.estonian_support.learner_level === 'A1-A2'
  ) {
    const totalActivity = selected.reduce(
      (total, choice) => total + choice.target.operational.duration.min_minutes,
      0,
    );
    const heavy = selected.reduce((total, choice) => (
      total + (LANGUAGE_HEAVY_LEVELS.has(choice.target.operational.learner_demands.productive_language)
        ? choice.target.operational.duration.min_minutes
        : 0)
    ), 0);
    if (
      totalActivity > 0
      && (heavy * 100) / totalActivity
        > rules.combination_rules
          .maximum_total_language_heavy_phase_share_percent_for_a1_a2_supported_lessons
    ) {
      failures.push({
        code: 'language_profile_incompatible',
        detail: 'total productive-language-heavy targets occupy too much of an A1-A2 supported lesson',
      });
    }
  }
  const totalScore = selected.reduce((total, choice) => total + choice.score.total, 0);
  const signature = selected.map((choice) => choice.target.target_id).join('|');
  return { valid: failures.length === 0, failures, timing, totalScore, signature };
}

function enumerateCompositions(slotRows, pattern, request, rules) {
  const valid = [];
  const failures = [];
  const invalidEvaluations = [];
  const choices = [];
  function visit(index) {
    if (index === slotRows.length) {
      const evaluation = evaluateCombination(choices, pattern, request, rules);
      if (evaluation.valid) valid.push({ choices: [...choices], ...evaluation });
      else {
        failures.push(...evaluation.failures);
        invalidEvaluations.push(evaluation.failures);
      }
      return;
    }
    const { slot, rows } = slotRows[index];
    if (!slot.consumes_lesson_time) {
      choices.push(null);
      visit(index + 1);
      choices.pop();
      return;
    }
    const eligibleOverride = rows.find((row) => row.overrideEligible);
    const candidates = eligibleOverride
      ? [eligibleOverride]
      : rows.filter((row) => row.hard.passed);
    for (const row of candidates) {
      choices.push({ ...row, slot });
      visit(index + 1);
      choices.pop();
    }
    if (slot.requirement === 'optional' && !eligibleOverride) {
      choices.push(null);
      visit(index + 1);
      choices.pop();
    }
  }
  visit(0);
  valid.sort((left, right) => (
    right.totalScore - left.totalScore || compareBytewise(left.signature, right.signature)
  ));
  return { valid, failures, invalidEvaluations };
}

function createFailureDecision(request, versions, {
  code,
  message,
  details,
  rejectedPatterns = [],
  overrideResults = [],
  targetsConsidered = 0,
}) {
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogical_selection_decision',
    decision_id: `${request.request_id}-decision`,
    request_id: request.request_id,
    status: 'failure',
    versions,
    request_digest: sha256PedagogyValue(request),
    selected_pattern: null,
    candidate_summary: {
      patterns_considered: rejectedPatterns.length,
      targets_considered: targetsConsidered,
      valid_compositions: 0,
    },
    slot_decisions: [],
    rejected_patterns: rejectedPatterns,
    combination_checks: [],
    teacher_override_results: overrideResults,
    warnings: ['Project-authored selection rules remain provisional and require teacher review.'],
    determinism: {
      ordering: 'score_desc_then_target_id_bytewise',
      randomness_used: false,
      network_used: false,
      ai_used: false,
      volatile_timestamp_in_core: false,
    },
    failure: { code, message, details: uniqueSorted(details) },
  };
}

function classifyFailure(failures, invalidEvaluations = []) {
  if (invalidEvaluations.length > 0) {
    for (const code of FAILURE_PRIORITY) {
      if (invalidEvaluations.every((evaluation) => (
        evaluation.some((failure) => failure.code === code)
      ))) return code;
    }
  }
  for (const code of FAILURE_PRIORITY) {
    if (failures.some((failure) => failure.code === code)) return code;
  }
  return 'incompatible_phase_combination';
}

function candidateTrace(row) {
  return {
    target_id: row.target.target_id,
    hard_filter_passed: row.hard.passed,
    hard_filter_reasons: uniqueSorted(row.hard.reasons),
    operational_fit: row.hard.operationalFit,
    score: row.score ? { total: row.score.total, components: row.score.components } : null,
  };
}

function selectionOrigin(pattern, request) {
  if (request.lesson_context.required_pattern_id === pattern.pattern_id) return 'request_required';
  if (request.preferences.preferred_pattern_ids.includes(pattern.pattern_id)) return 'teacher_preferred';
  return 'engine_selected';
}

function buildDecision(request, versions, selectedPattern, allPatternResults, targets) {
  const { pattern, composition, slotRows, overrideResults } = selectedPattern;
  const slotDecisions = slotRows.map(({ slot, rows }, index) => {
    const choice = composition.choices[index];
    return {
      slot_id: slot.slot_id,
      phase: slot.phase,
      required: slot.requirement === 'required',
      selected_target_id: choice?.target.target_id ?? null,
      selected_group_format: choice?.score.groupFormat ?? null,
      score: choice ? { total: choice.score.total, components: choice.score.components } : null,
      considered_candidates: rows.map(candidateTrace),
      tie_break: 'score_desc_then_target_id_bytewise',
      unfilled_reason: choice
        ? null
        : (slot.consumes_lesson_time
          ? 'optional slot omitted because the selected valid composition scored higher or preserved time'
          : 'delayed review is represented in retrieval_plan rather than current lesson timing'),
    };
  });
  const combinationChecks = [
    {
      check_id: 'duration-and-reserve',
      passed: true,
      details: `planned ${composition.timing.total_planned_minutes} of `
        + `${request.learner_context.lesson_duration_minutes} minutes including reserve`,
    },
    {
      check_id: 'required-capability-coverage',
      passed: true,
      details: `covered: ${request.lesson_context.required_capabilities.join(', ')}`,
    },
    {
      check_id: 'resource-and-safety',
      passed: true,
      details: 'all selected targets satisfy declared resource and supervision constraints',
    },
    {
      check_id: 'subject-language-separation',
      passed: true,
      details: request.language_profile.estonian_support.enabled
        ? 'complex subject explanation and Estonian support retain separate roles'
        : 'Russian-primary instruction has no Estonian support roles',
    },
  ];
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogical_selection_decision',
    decision_id: `${request.request_id}-decision`,
    request_id: request.request_id,
    status: 'success',
    versions,
    request_digest: sha256PedagogyValue(request),
    selected_pattern: {
      pattern_id: pattern.pattern_id,
      selection_origin: selectionOrigin(pattern, request),
      score: composition.totalScore,
      rationale_ru: 'Pattern rationale is assigned after deterministic composition selection.',
    },
    candidate_summary: {
      patterns_considered: allPatternResults.length,
      targets_considered: targets.length,
      valid_compositions: allPatternResults.reduce(
        (total, result) => total + result.compositions.valid.length,
        0,
      ),
    },
    slot_decisions: slotDecisions,
    rejected_patterns: allPatternResults
      .filter((result) => result.pattern.pattern_id !== pattern.pattern_id)
      .map((result) => ({
        pattern_id: result.pattern.pattern_id,
        reasons: result.reasons.length > 0
          ? uniqueSorted(result.reasons)
          : ['another valid composition had a higher operational fit score'],
      }))
      .sort((left, right) => compareBytewise(left.pattern_id, right.pattern_id)),
    combination_checks: combinationChecks,
    teacher_override_results: overrideResults,
    warnings: [
      'Capability ratings and selection weights are provisional project-authored metadata.',
      'The proposal requires teacher review and does not claim learning effectiveness.',
    ],
    determinism: {
      ordering: 'score_desc_then_target_id_bytewise',
      randomness_used: false,
      network_used: false,
      ai_used: false,
      volatile_timestamp_in_core: false,
    },
    failure: null,
  };
}

function patternRationale(pattern, request, origin) {
  const originText = origin === 'request_required'
    ? 'Запрос явно зафиксировал этот паттерн.'
    : origin === 'teacher_preferred'
      ? 'Паттерн соответствует цели и заявленному предпочтению учителя.'
      : 'Паттерн соответствует цели, формату, возрасту и допустимым условиям.';
  return `${originText} Выбор является структурным предложением, а не оценкой эффективности.`;
}

function buildLessonDna(request, decision, pattern, composition, slotRows, rules) {
  const estonianSupport = request.language_profile.estonian_support;
  const selectedChoices = composition.choices
    .map((choice, index) => ({ choice, slot: slotRows[index].slot }))
    .filter(({ choice, slot }) => choice && slot.consumes_lesson_time);
  const phases = selectedChoices.map(({ choice, slot }, index) => {
    const operational = choice.target.operational;
    const component = patternComponent(pattern, slot.phase);
    const timing = composition.timing.phases[index];
    return {
      phase_id: slot.slot_id,
      phase: slot.phase,
      purpose_ru: component.purpose_ru,
      required: slot.requirement === 'required',
      target: {
        target_id: choice.target.target_id,
        activity_id: choice.target.activity_id,
        execution_profile_id: choice.target.execution_profile_id,
      },
      activity_minutes: timing.activity_minutes,
      setup_minutes: timing.setup_minutes,
      cleanup_minutes: timing.cleanup_minutes,
      transition_minutes: timing.transition_minutes,
      group_format: choice.score.groupFormat,
      capabilities: {
        primary: sorted(Object.entries(operational.capabilities)
          .filter(([, level]) => level === 'primary').map(([id]) => id)),
        supporting: sorted(Object.entries(operational.capabilities)
          .filter(([, level]) => level === 'supporting').map(([id]) => id)),
      },
      source_access: {
        first_attempt: operational.delivery_constraints.source_access_during_first_attempt,
      },
      language_role: {
        primary_language: request.language_profile.primary_instruction_language,
        estonian_roles: estonianSupport.enabled
          ? sorted(estonianSupport.allowed_roles)
          : [],
      },
      resources: { required: sorted(operational.resource_requirements.required) },
      safety: {
        requires_adult_supervision: operational.safety.requires_adult_supervision,
        controls_ru: [...operational.safety.controls_ru],
      },
      rationale_ru: 'Target rationale is assigned from the deterministic decision trace.',
    };
  });
  for (const phase of phases) {
    phase.rationale_ru = `Target ${phase.target.target_id} прошёл hard constraints и получил `
      + 'наивысший допустимый вклад в согласованную композицию; это не effectiveness ranking.';
  }
  const immediatePhase = phases.find((phase) => phase.phase === 'retrieval')?.phase_id ?? null;
  const immediateIndex = phases.findIndex((phase) => phase.phase_id === immediatePhase);
  const correctionPhase = phases.slice(Math.max(0, immediateIndex + 1)).find((phase) => (
    phase.capabilities.primary.includes('error_correction')
    || phase.capabilities.supporting.includes('error_correction')
  ))?.phase_id ?? null;
  const subjectPhaseIds = phases
    .filter((phase) => phase.phase === 'formative_assessment')
    .map((phase) => phase.phase_id);
  const estonianAssessmentEnabled = (
    estonianSupport.enabled && estonianSupport.assessment_requested
  );
  const languagePhaseIds = estonianAssessmentEnabled
    ? phases.filter((phase) => (
      phase.capabilities.primary.includes('oral_production')
      || phase.capabilities.supporting.includes('oral_production')
      || phase.capabilities.primary.includes('written_production')
      || phase.capabilities.supporting.includes('written_production')
    )).map((phase) => phase.phase_id)
    : [];
  const timing = {
    ...composition.timing,
    unallocated_minutes: request.learner_context.lesson_duration_minutes
      - composition.timing.total_planned_minutes,
    fits: true,
  };
  delete timing.phases;
  const acceptedOverrides = request.preferences.teacher_overrides
    .filter((override) => decision.teacher_override_results.some(
      (result) => result.override_id === override.override_id && result.status === 'accepted',
    ))
    .map((override) => ({
      override_id: override.override_id,
      status: 'accepted',
      slot_id: override.slot_id,
      target_id: override.requested_target_id,
      rationale_ru: override.rationale_ru,
    }));
  const scaffolds = [];
  if (estonianSupport.enabled && estonianSupport.sentence_frames_required) {
    scaffolds.push('Use one short Estonian sentence frame while retaining Russian subject reasoning.');
  }
  if (estonianSupport.enabled && estonianSupport.word_bank_required) {
    scaffolds.push('Provide a bounded Estonian word bank for the selected terminology or labels.');
  }
  return {
    schema_version: '1.0',
    artifact_type: 'lesson_dna',
    lesson_dna_id: `${request.request_id}-dna`,
    status: {
      structural_state: 'proposed',
      teacher_review: 'pending',
      classroom_trial: 'not_started',
      classroom_ready: false,
      effectiveness_claimed: false,
    },
    versions: decision.versions,
    context: {
      request_id: request.request_id,
      request_digest: decision.request_digest,
      grade: request.learner_context.grade,
      subject: request.learner_context.subject,
      duration_minutes: request.learner_context.lesson_duration_minutes,
      delivery_mode: request.learner_context.delivery_mode,
      group_size: request.learner_context.group_size,
      language_policy: {
        primary_instruction_language: request.language_profile.primary_instruction_language,
        maximum_total_productive_language_demand:
          request.language_profile.maximum_total_productive_language_demand,
        estonian_support: {
          enabled: estonianSupport.enabled,
          learner_level: estonianSupport.learner_level,
          allowed_roles: sorted(estonianSupport.allowed_roles),
          subject_explanation_language: estonianSupport.subject_explanation_language,
        },
      },
    },
    pattern: {
      pattern_id: pattern.pattern_id,
      selection_origin: decision.selected_pattern.selection_origin,
      rationale_ru: decision.selected_pattern.rationale_ru,
    },
    phases,
    timing,
    assessment: {
      separation_policy: 'separate_subject_and_estonian_language_evidence',
      subject_assessment: {
        enabled: request.lesson_context.context_flags.assessment || subjectPhaseIds.length > 0,
        target_phase_ids: subjectPhaseIds,
        notes_ru: 'Предметное понимание оценивается на основном языке объяснения; эстонская форма не снижает предметный результат.',
      },
      estonian_language_assessment: {
        enabled: estonianAssessmentEnabled,
        target_phase_ids: languagePhaseIds,
        notes_ru: estonianAssessmentEnabled
          ? 'Проверяются только заявленные короткие эстонские роли; они не заменяют доказательство предметного понимания.'
          : 'Эстонское языковое оценивание для этого запроса отключено.',
      },
    },
    retrieval_plan: {
      immediate_phase_id: immediatePhase,
      correction_phase_id: correctionPhase,
      delayed: request.lesson_context.future_retrieval_windows,
    },
    differentiation: {
      scaffolds,
      extensions: [],
    },
    teacher_overrides: acceptedOverrides,
    warnings: [...decision.warnings],
    known_limits: [
      'classroom_trial_not_started',
      'no_effectiveness_claim',
      ...(estonianSupport.enabled ? ['per_language_productive_demand_not_modelled'] : []),
      'selection_weights_provisional',
      'taxonomy_ratings_provisional',
      'teacher_review_pending',
    ],
  };
}

function requestVersionBlock(knowledge, rules) {
  return {
    taxonomy: rules.taxonomy_version,
    selection_rules: rules.selection_rules_version,
    lesson_dna_schema: rules.lesson_dna_schema_version,
    activity_catalog_digest: computeActivityCatalogSelectionDigest(
      knowledge.activities.data.activities,
    ),
    engine: rules.engine_version,
  };
}

function validateOverrideForPattern(override, patternPolicy, rowsBySlot, targetIds) {
  if (!targetIds.has(override.requested_target_id)) {
    return `unknown target ${override.requested_target_id}`;
  }
  if (!patternPolicy.slots.some((slot) => slot.slot_id === override.slot_id)) {
    return `slot ${override.slot_id} does not exist in the selected pattern`;
  }
  const row = rowsBySlot.get(override.slot_id)
    ?.find((candidate) => candidate.target.target_id === override.requested_target_id);
  if (!row?.hard.passed) {
    return row
      ? `hard constraint rejected target: ${row.hard.reasons.join('; ')}`
      : 'target is not available for this slot';
  }
  return null;
}

function finalizeSelectedOverrideResults(request, selectedPattern) {
  return request.preferences.teacher_overrides.map((override) => {
    const evaluation = selectedPattern.overrideEvaluations.find(
      (item) => item.override.override_id === override.override_id,
    );
    if (evaluation?.reason) {
      return {
        override_id: override.override_id,
        status: 'rejected',
        slot_id: override.slot_id,
        requested_target_id: override.requested_target_id,
        reason: evaluation.reason,
      };
    }
    const selectedChoice = selectedPattern.composition.choices.find(
      (choice) => choice?.slot.slot_id === override.slot_id,
    );
    const applied = selectedChoice?.target.target_id === override.requested_target_id;
    return {
      override_id: override.override_id,
      status: applied ? 'accepted' : 'rejected',
      slot_id: override.slot_id,
      requested_target_id: override.requested_target_id,
      reason: applied
        ? 'Override satisfies every hard constraint and is applied in the selected composition.'
        : 'Override passed hard constraints but was not applied in the selected composition.',
    };
  }).sort(compareOverrideIdentity);
}

function aggregateFailedOverrideResults(request, patternResults) {
  return request.preferences.teacher_overrides.map((override) => {
    const evaluations = patternResults.map((patternResult) => (
      patternResult.overrideEvaluations.find(
        (item) => item.override.override_id === override.override_id,
      )
    )).filter(Boolean);
    const reasons = uniqueSorted(evaluations.map((evaluation) => evaluation.reason).filter(Boolean));
    return {
      override_id: override.override_id,
      status: 'rejected',
      slot_id: override.slot_id,
      requested_target_id: override.requested_target_id,
      reason: reasons.length > 0
        ? reasons.join('; ')
        : 'Override was eligible but no valid composition could apply it.',
    };
  }).sort(compareOverrideIdentity);
}

export function selectLessonPedagogy(selectionRepository, rawRequest) {
  const request = normalizePedagogySelectionRequest(rawRequest);
  const { knowledge } = selectionRepository;
  const rules = selectionRepository.rules.data ?? selectionRepository.rules;
  const activities = knowledge.activities.data.activities;
  const patterns = knowledge.patterns.flatMap((artifact) => artifact.data.patterns);
  const targets = expandPedagogyActivityTargets(activities);
  const targetIds = new Set(targets.map((target) => target.target_id));
  const versions = requestVersionBlock(knowledge, rules);
  const learnerContextState = validateLearnerContextState(request);
  if (!learnerContextState.valid) {
    return {
      decision: createFailureDecision(request, versions, {
        code: 'invalid_learner_context',
        message: 'Learner study context and group size are inconsistent.',
        details: learnerContextState.diagnostics,
        targetsConsidered: targets.length,
      }),
      lessonDna: null,
    };
  }
  const estonianSupportState = validateEstonianSupportState(request);
  if (!estonianSupportState.valid) {
    return {
      decision: createFailureDecision(request, versions, {
        code: 'language_profile_incompatible',
        message: 'Estonian support state is inconsistent.',
        details: estonianSupportState.diagnostics,
        targetsConsidered: targets.length,
      }),
      lessonDna: null,
    };
  }
  const overrideSet = validateTeacherOverrideSet(request);
  if (!overrideSet.valid) {
    return {
      decision: createFailureDecision(request, versions, {
        code: 'invalid_teacher_override',
        message: 'Teacher overrides are ambiguous.',
        details: overrideSet.details,
        overrideResults: overrideSet.overrideResults,
        targetsConsidered: targets.length,
      }),
      lessonDna: null,
    };
  }
  const purposePolicy = rules.purpose_policies.find(
    (policy) => policy.purpose === request.lesson_context.purpose,
  );
  let patternIds = purposePolicy?.pattern_ids ?? [];
  if (request.lesson_context.required_pattern_id) {
    patternIds = [request.lesson_context.required_pattern_id];
  }
  const patternCandidates = patternIds.map(
    (patternId) => patterns.find((pattern) => pattern.pattern_id === patternId),
  ).filter(Boolean).filter((pattern) => (
    pattern.suitable_grades.min <= request.learner_context.grade
    && request.learner_context.grade <= pattern.suitable_grades.max
    && (pattern.subjects.includes(request.learner_context.subject)
      || pattern.subjects.includes('cross_curricular'))
    && pattern.delivery_modes.includes(request.learner_context.delivery_mode)
  ));
  if (patternCandidates.length === 0) {
    const overrideResults = request.preferences.teacher_overrides.map((override) => ({
      override_id: override.override_id,
      status: 'rejected',
      slot_id: override.slot_id,
      requested_target_id: override.requested_target_id,
      reason: 'No eligible pattern was available to apply the override.',
    })).sort(compareOverrideIdentity);
    return {
      decision: createFailureDecision(request, versions, {
        code: 'no_pattern_match',
        message: 'No flexible pattern satisfies the request context.',
        details: patternIds.length > 0 ? patternIds : ['purpose has no registered pattern policy'],
        overrideResults,
        targetsConsidered: targets.length,
      }),
      lessonDna: null,
    };
  }

  const patternResults = [];
  for (const pattern of patternCandidates.sort((left, right) => compareBytewise(left.pattern_id, right.pattern_id))) {
    const patternPolicy = rules.pattern_policies.find(
      (policy) => policy.pattern_id === pattern.pattern_id,
    );
    const effectivePatternPolicy = {
      ...patternPolicy,
      slots: patternPolicy.slots.map((slot) => ({
        ...slot,
        requirement: request.lesson_context.phase_needs.includes(slot.phase)
          ? 'required'
          : slot.requirement,
      })),
    };
    const slotRows = effectivePatternPolicy.slots.map((slot) => ({
      slot,
      rows: slot.consumes_lesson_time
        ? candidateRowsForSlot(targets, pattern, slot, request, rules)
        : [],
    }));
    const rowsBySlot = new Map(slotRows.map(({ slot, rows }) => [slot.slot_id, rows]));
    const overrideEvaluations = [];
    let invalidOverride = false;
    for (const override of request.preferences.teacher_overrides) {
      const reason = validateOverrideForPattern(
        override,
        effectivePatternPolicy,
        rowsBySlot,
        targetIds,
      );
      overrideEvaluations.push({ override, reason });
      if (reason) invalidOverride = true;
      else {
        const row = rowsBySlot.get(override.slot_id)
          .find((candidate) => candidate.target.target_id === override.requested_target_id);
        row.overrideEligible = override.override_id;
      }
    }
    if (invalidOverride) {
      patternResults.push({
        pattern,
        patternPolicy: effectivePatternPolicy,
        slotRows,
        overrideEvaluations,
        compositions: {
          valid: [],
          failures: [{ code: 'invalid_teacher_override', detail: 'teacher override violates a hard constraint' }],
          invalidEvaluations: [[{ code: 'invalid_teacher_override', detail: 'teacher override violates a hard constraint' }]],
        },
        reasons: overrideEvaluations
          .filter((evaluation) => evaluation.reason)
          .map((evaluation) => evaluation.reason),
      });
      continue;
    }
    const requiredEmpty = slotRows.find(({ slot, rows }) => (
      slot.requirement === 'required'
      && slot.consumes_lesson_time
      && !rows.some((row) => row.hard.passed)
    ));
    if (requiredEmpty) {
      const structurallyRelevant = requiredEmpty.rows.filter((row) => (
        !row.hard.reasons.some((reason) => (
          reason.startsWith('grade ')
          || reason.startsWith('subject ')
          || reason.startsWith('lesson phase ')
          || reason.startsWith('delivery mode ')
          || reason.startsWith('no requested group format ')
        ))
      ));
      const hardReasons = structurallyRelevant.flatMap((row) => row.hard.reasons);
      const allExplicitlyExcluded = structurallyRelevant.length > 0
        && structurallyRelevant.every((row) => row.hard.reasons.includes('target is explicitly excluded'));
      const code = allExplicitlyExcluded
        ? 'no_candidate_for_required_slot'
        : hardReasons.some((reason) => reason.includes('safety supervision'))
        ? 'safety_supervision_unavailable'
        : hardReasons.some((reason) => reason.includes('resource') || reason.includes('printer') || reason.includes('internet'))
          ? 'missing_required_resource'
          : hardReasons.some((reason) => reason.includes('language') || reason.includes('A1-A2'))
            ? 'language_profile_incompatible'
            : 'no_candidate_for_required_slot';
      patternResults.push({
        pattern,
        patternPolicy: effectivePatternPolicy,
        slotRows,
        overrideEvaluations,
        compositions: {
          valid: [],
          failures: [{ code, detail: `no target for required slot ${requiredEmpty.slot.slot_id}` }],
          invalidEvaluations: [[{ code, detail: `no target for required slot ${requiredEmpty.slot.slot_id}` }]],
        },
        reasons: [`required slot ${requiredEmpty.slot.slot_id} has no valid target`],
      });
      continue;
    }
    const compositions = enumerateCompositions(slotRows, pattern, request, rules);
    patternResults.push({
      pattern,
      patternPolicy: effectivePatternPolicy,
      slotRows,
      overrideEvaluations,
      compositions,
      reasons: compositions.valid.length > 0
        ? []
        : uniqueSorted(compositions.failures.map((failure) => failure.detail)),
    });
  }
  const validPatterns = patternResults
    .filter((result) => result.compositions.valid.length > 0)
    .map((result) => ({ ...result, composition: result.compositions.valid[0] }))
    .sort((left, right) => (
      right.composition.totalScore - left.composition.totalScore
      || compareBytewise(left.pattern.pattern_id, right.pattern.pattern_id)
      || compareBytewise(left.composition.signature, right.composition.signature)
    ));
  if (validPatterns.length === 0) {
    const failures = patternResults.flatMap((result) => result.compositions.failures);
    const invalidEvaluations = patternResults.flatMap(
      (result) => result.compositions.invalidEvaluations ?? [],
    );
    const code = classifyFailure(failures, invalidEvaluations);
    return {
      decision: createFailureDecision(request, versions, {
        code,
        message: 'No valid lesson composition satisfies every hard and combination constraint.',
        details: failures.map((failure) => failure.detail),
        rejectedPatterns: patternResults.map((result) => ({
          pattern_id: result.pattern.pattern_id,
          reasons: result.reasons.length > 0 ? result.reasons : ['no valid composition'],
        })),
        overrideResults: aggregateFailedOverrideResults(request, patternResults),
        targetsConsidered: targets.length,
      }),
      lessonDna: null,
    };
  }
  const selected = validPatterns[0];
  selected.overrideResults = finalizeSelectedOverrideResults(request, selected);
  const decision = buildDecision(request, versions, selected, patternResults, targets);
  decision.selected_pattern.rationale_ru = patternRationale(
    selected.pattern,
    request,
    decision.selected_pattern.selection_origin,
  );
  const lessonDna = buildLessonDna(
    request,
    decision,
    selected.pattern,
    selected.composition,
    selected.slotRows,
    rules,
  );
  return { decision, lessonDna };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return sorted(duplicates);
}

function addSchemaDiagnostics(errors, validate, file, data) {
  if (!validate(data)) {
    errors.push(...schemaErrors(validate).map((reason) => `${file}: ${reason}`));
    return false;
  }
  return true;
}

function compareExample(expected, actual) {
  return stablePedagogyJson(expected) === stablePedagogyJson(actual);
}

function teacherOverrideInvariantErrors(request, result) {
  const errors = [];
  const results = result.decision.teacher_override_results;
  const ordered = [...results].sort(compareOverrideIdentity);
  if (stablePedagogyJson(results) !== stablePedagogyJson(ordered)) {
    errors.push('teacher override diagnostics must be bytewise sorted');
  }
  const accepted = results.filter((item) => item.status === 'accepted');
  for (const item of accepted) {
    const matchingSlots = result.decision.slot_decisions.filter((slot) => (
      slot.slot_id === item.slot_id && slot.selected_target_id === item.requested_target_id
    ));
    if (matchingSlots.length !== 1) {
      errors.push(`accepted override ${item.override_id} is not applied exactly once`);
    }
  }
  for (const override of request.preferences.teacher_overrides) {
    const matchingSlots = result.decision.slot_decisions.filter((slot) => (
      slot.slot_id === override.slot_id
      && slot.selected_target_id === override.requested_target_id
    ));
    const acceptedResults = accepted.filter((item) => item.override_id === override.override_id);
    if (matchingSlots.length === 1 && acceptedResults.length !== 1) {
      errors.push(`applied override ${override.override_id} is not accepted exactly once`);
    }
  }
  const dnaOverrides = result.lessonDna?.teacher_overrides ?? [];
  if (dnaOverrides.length !== accepted.length) {
    errors.push('lesson DNA accepted overrides differ from the public decision');
  }
  for (const item of dnaOverrides) {
    if (!accepted.some((acceptedItem) => (
      acceptedItem.override_id === item.override_id
      && acceptedItem.slot_id === item.slot_id
      && acceptedItem.requested_target_id === item.target_id
    ))) {
      errors.push(`lesson DNA override ${item.override_id} has no accepted decision result`);
    }
  }
  return errors;
}

function estonianSupportInvariantErrors(request, result) {
  const errors = [];
  const support = request.language_profile.estonian_support;
  const state = validateEstonianSupportState(request);
  errors.push(...state.diagnostics);
  if (result.decision.status !== 'success' || !result.lessonDna) return errors;

  const dna = result.lessonDna;
  const dnaSupport = dna.context.language_policy.estonian_support;
  if (dnaSupport.enabled !== support.enabled) {
    errors.push('lesson DNA Estonian support state differs from the request');
  }
  if (dnaSupport.learner_level !== support.learner_level) {
    errors.push('lesson DNA Estonian learner level differs from the request');
  }
  if (
    stablePedagogyJson(dnaSupport.allowed_roles)
    !== stablePedagogyJson(sorted(support.allowed_roles))
  ) {
    errors.push('lesson DNA Estonian roles differ from the request');
  }
  if (dnaSupport.subject_explanation_language !== support.subject_explanation_language) {
    errors.push('lesson DNA subject explanation language differs from the request');
  }

  const scoreComponents = result.decision.slot_decisions.flatMap((slot) => (
    slot.considered_candidates.flatMap((candidate) => (
      candidate.score ? Object.keys(candidate.score.components) : []
    ))
  ));
  if (!support.enabled) {
    if (scoreComponents.some((component) => ['a1_a2_fit', 'limited_a1_a2'].includes(component))) {
      errors.push('disabled Estonian support must not produce A1-A2 score components');
    }
    if (dna.phases.some((phase) => phase.language_role.estonian_roles.length > 0)) {
      errors.push('disabled Estonian support must leave every phase role list empty');
    }
    if (dna.differentiation.scaffolds.some((item) => (
      item.includes('Estonian sentence frame') || item.includes('Estonian word bank')
    ))) {
      errors.push('disabled Estonian support must not produce Estonian scaffolds');
    }
    if (
      dna.assessment.estonian_language_assessment.enabled
      || dna.assessment.estonian_language_assessment.target_phase_ids.length > 0
    ) {
      errors.push('disabled Estonian support must not produce language assessment');
    }
    if (dna.known_limits.includes('per_language_productive_demand_not_modelled')) {
      errors.push('disabled Estonian support must omit the per-language demand known limit');
    }
  } else if (!dna.known_limits.includes('per_language_productive_demand_not_modelled')) {
    errors.push('enabled Estonian support must retain the per-language demand known limit');
  }
  return errors.sort(compareBytewise);
}

export function validatePedagogySelection(selectionRepository, {
  requireExamples = true,
} = {}) {
  const errors = [];
  const warnings = [];
  const knowledgeResult = validatePedagogyKnowledge(selectionRepository.knowledge);
  if (!knowledgeResult.valid) {
    errors.push(...knowledgeResult.errors.map((item) => `${item.file}: ${item.reason}`));
  }
  let validators;
  try {
    createPedagogySchemaValidators(selectionRepository.knowledge.schemas);
    validators = createPedagogySelectionValidators(selectionRepository);
  } catch (error) {
    return {
      valid: false,
      errors: [`selection schema compilation failed: ${error.message}`],
      warnings,
      counts: {},
    };
  }
  const rulesValid = addSchemaDiagnostics(
    errors,
    validators.rules,
    selectionRepository.rules.file,
    selectionRepository.rules.data,
  );
  const fixturesValid = addSchemaDiagnostics(
    errors,
    validators.fixtures,
    selectionRepository.fixtures.file,
    selectionRepository.fixtures.data,
  );
  const examplesValid = selectionRepository.examples
    ? addSchemaDiagnostics(
      errors,
      validators.examples,
      selectionRepository.examples.file,
      selectionRepository.examples.data,
    )
    : !requireExamples;
  if (!selectionRepository.examples && requireExamples) {
    errors.push(`${PEDAGOGY_LESSON_DNA_EXAMPLES}: required lesson DNA examples are missing`);
  }
  const patterns = selectionRepository.knowledge.patterns.flatMap((artifact) => artifact.data.patterns);
  const patternIds = new Set(patterns.map((pattern) => pattern.pattern_id));
  const targets = expandPedagogyActivityTargets(
    selectionRepository.knowledge.activities.data.activities,
  );
  const targetIds = new Set(targets.map((target) => target.target_id));
  const capabilityIds = new Set(
    selectionRepository.knowledge.taxonomy.data.capabilities.map((item) => item.capability_id),
  );
  const resourceIds = new Set(
    selectionRepository.knowledge.taxonomy.data.resource_vocabulary.map((item) => item.resource_id),
  );
  if (rulesValid) {
    const rules = selectionRepository.rules.data;
    if (rules.taxonomy_version !== selectionRepository.knowledge.taxonomy.data.taxonomy_version) {
      errors.push(`${selectionRepository.rules.file}: taxonomy version mismatch`);
    }
    for (const key of REQUIRED_SELECTION_WEIGHT_KEYS) {
      if (!Object.hasOwn(rules.scoring.weights, key)) errors.push(`${selectionRepository.rules.file}: missing weight ${key}`);
    }
    for (const key of Object.keys(rules.scoring.weights)) {
      if (!REQUIRED_SELECTION_WEIGHT_KEYS.includes(key)) errors.push(`${selectionRepository.rules.file}: unknown weight ${key}`);
      if (rules.scoring.weights[key] < 0) errors.push(`${selectionRepository.rules.file}: scoring weight ${key} must be non-negative`);
    }
    for (const key of REQUIRED_SELECTION_PENALTY_KEYS) {
      if (!Object.hasOwn(rules.scoring.penalties, key)) errors.push(`${selectionRepository.rules.file}: missing penalty ${key}`);
    }
    for (const key of Object.keys(rules.scoring.penalties)) {
      if (!REQUIRED_SELECTION_PENALTY_KEYS.includes(key)) errors.push(`${selectionRepository.rules.file}: unknown penalty ${key}`);
      if (rules.scoring.penalties[key] > 0) errors.push(`${selectionRepository.rules.file}: scoring penalty ${key} must not be positive`);
    }
    const hardKeys = Object.keys(rules.hard_constraints).sort(compareBytewise);
    if (JSON.stringify(hardKeys) !== JSON.stringify(REQUIRED_HARD_CONSTRAINT_KEYS)) {
      errors.push(`${selectionRepository.rules.file}: hard constraint keys must equal the documented version 1.0 vocabulary`);
    }
    const capabilityScoreKeys = Object.keys(rules.scoring.capability_levels).sort(compareBytewise);
    if (JSON.stringify(capabilityScoreKeys) !== JSON.stringify(REQUIRED_CAPABILITY_SCORE_KEYS)) {
      errors.push(`${selectionRepository.rules.file}: capability score keys must equal the taxonomy capability levels`);
    }
    const purposes = rules.purpose_policies.map((policy) => policy.purpose);
    for (const duplicate of duplicateValues(purposes)) errors.push(`${selectionRepository.rules.file}: duplicate purpose ${duplicate}`);
    if (JSON.stringify(purposes) !== JSON.stringify(sorted(purposes))) {
      errors.push(`${selectionRepository.rules.file}: purpose policies must be bytewise sorted`);
    }
    const policyPatternIds = rules.pattern_policies.map((policy) => policy.pattern_id);
    for (const duplicate of duplicateValues(policyPatternIds)) errors.push(`${selectionRepository.rules.file}: duplicate pattern policy ${duplicate}`);
    if (JSON.stringify(policyPatternIds) !== JSON.stringify(sorted(policyPatternIds))) {
      errors.push(`${selectionRepository.rules.file}: pattern policies must be bytewise sorted`);
    }
    for (const policy of rules.purpose_policies) {
      if (JSON.stringify(policy.pattern_ids) !== JSON.stringify(sorted(policy.pattern_ids))) {
        errors.push(`${selectionRepository.rules.file}: patterns for ${policy.purpose} must be bytewise sorted`);
      }
      for (const patternId of policy.pattern_ids) {
        if (!patternIds.has(patternId)) errors.push(`${selectionRepository.rules.file}: unknown pattern ${patternId}`);
      }
    }
    for (const policy of rules.pattern_policies) {
      const pattern = patterns.find((item) => item.pattern_id === policy.pattern_id);
      if (!pattern) {
        errors.push(`${selectionRepository.rules.file}: unknown pattern policy ${policy.pattern_id}`);
        continue;
      }
      const slotIds = policy.slots.map((slot) => slot.slot_id);
      for (const duplicate of duplicateValues(slotIds)) errors.push(`${selectionRepository.rules.file}: duplicate slot ${duplicate}`);
      for (const slot of policy.slots) {
        if (!pattern.recommended_components.some((component) => component.phase === slot.phase)) {
          errors.push(`${selectionRepository.rules.file}: ${policy.pattern_id} has no component phase ${slot.phase}`);
        }
      }
    }
  }
  const fixtureIds = selectionRepository.fixtures.data.fixtures.map((fixture) => fixture.fixture_id);
  if (JSON.stringify(fixtureIds) !== JSON.stringify(sorted(fixtureIds))) {
    errors.push(`${selectionRepository.fixtures.file}: fixtures must be bytewise sorted`);
  }
  for (const duplicate of duplicateValues(fixtureIds)) errors.push(`${selectionRepository.fixtures.file}: duplicate fixture ${duplicate}`);
  const generatedExamples = new Map();
  if (fixturesValid && rulesValid) {
    for (const fixture of selectionRepository.fixtures.data.fixtures) {
      const supportState = validateEstonianSupportState(fixture.request);
      errors.push(...supportState.diagnostics.map(
        (reason) => `${fixture.fixture_id}: ${reason}`,
      ));
      const requestValid = addSchemaDiagnostics(
        errors,
        validators.request,
        `${selectionRepository.fixtures.file}#${fixture.fixture_id}`,
        fixture.request,
      );
      if (!requestValid) continue;
      for (const capabilityId of [
        ...fixture.request.lesson_context.required_capabilities,
        ...fixture.request.lesson_context.desired_capabilities,
      ]) {
        if (!capabilityIds.has(capabilityId)) {
          errors.push(`${fixture.fixture_id}: unknown capability ${capabilityId}`);
        }
      }
      for (const resourceId of [
        ...fixture.request.resources.available,
        ...fixture.request.resources.unavailable,
      ]) {
        if (!resourceIds.has(resourceId)) errors.push(`${fixture.fixture_id}: unknown resource ${resourceId}`);
      }
      const overlap = fixture.request.resources.available
        .filter((resourceId) => fixture.request.resources.unavailable.includes(resourceId));
      if (overlap.length > 0) errors.push(`${fixture.fixture_id}: resource is both available and unavailable: ${overlap.join(', ')}`);
      for (const patternId of [
        ...(fixture.request.preferences.preferred_pattern_ids ?? []),
        ...(fixture.request.lesson_context.required_pattern_id ? [fixture.request.lesson_context.required_pattern_id] : []),
      ]) {
        if (!patternIds.has(patternId)) errors.push(`${fixture.fixture_id}: unknown pattern ${patternId}`);
      }
      for (const targetId of [
        ...fixture.request.preferences.preferred_target_ids,
        ...fixture.request.preferences.excluded_target_ids,
        ...fixture.request.preferences.avoid_recent_target_ids,
        ...fixture.request.preferences.teacher_overrides.map((override) => override.requested_target_id),
      ]) {
        if (!targetIds.has(targetId)) errors.push(`${fixture.fixture_id}: unknown target ${targetId}`);
      }
      if (
        fixture.request.learner_context.grade === 5
        && fixture.request.learner_context.subject === 'science'
        && fixture.request.language_profile.estonian_support.enabled
        && (
          fixture.request.language_profile.primary_instruction_language !== 'ru'
          || fixture.request.language_profile.estonian_support.subject_explanation_language !== 'ru'
        )
      ) {
        errors.push(`${fixture.fixture_id}: grade-5 science pilot requires complex subject explanation in Russian`);
      }
      const result = selectLessonPedagogy(selectionRepository, fixture.request);
      if (!addSchemaDiagnostics(errors, validators.decision, `${fixture.fixture_id}:decision`, result.decision)) continue;
      if (result.lessonDna && !addSchemaDiagnostics(errors, validators.lessonDna, `${fixture.fixture_id}:lesson-dna`, result.lessonDna)) continue;
      errors.push(...teacherOverrideInvariantErrors(fixture.request, result)
        .map((reason) => `${fixture.fixture_id}: ${reason}`));
      errors.push(...estonianSupportInvariantErrors(fixture.request, result)
        .map((reason) => `${fixture.fixture_id}: ${reason}`));
      if (result.decision.status !== fixture.expected.status) {
        errors.push(`${fixture.fixture_id}: expected ${fixture.expected.status}, got ${result.decision.status}`);
      }
      if ((result.decision.selected_pattern?.pattern_id ?? null) !== fixture.expected.pattern_id) {
        errors.push(`${fixture.fixture_id}: selected pattern differs from fixture expectation`);
      }
      const selectedIds = result.decision.slot_decisions
        .map((slot) => slot.selected_target_id).filter(Boolean);
      for (const targetId of fixture.expected.include_target_ids) {
        if (!selectedIds.includes(targetId)) errors.push(`${fixture.fixture_id}: expected target ${targetId} was not selected`);
      }
      for (const targetId of fixture.expected.exclude_target_ids) {
        if (selectedIds.includes(targetId)) errors.push(`${fixture.fixture_id}: excluded target ${targetId} was selected`);
      }
      if ((result.decision.failure?.code ?? null) !== fixture.expected.failure_code) {
        errors.push(`${fixture.fixture_id}: failure code differs from fixture expectation`);
      }
      const accepted = result.decision.teacher_override_results
        .filter((item) => item.status === 'accepted').map((item) => item.override_id);
      const rejected = result.decision.teacher_override_results
        .filter((item) => item.status === 'rejected').map((item) => item.override_id);
      if (JSON.stringify(sorted(accepted)) !== JSON.stringify(sorted(fixture.expected.accepted_override_ids))) {
        errors.push(`${fixture.fixture_id}: accepted overrides differ from expectation`);
      }
      if (JSON.stringify(sorted(rejected)) !== JSON.stringify(sorted(fixture.expected.rejected_override_ids))) {
        errors.push(`${fixture.fixture_id}: rejected overrides differ from expectation`);
      }
      if (fixture.expected.example_id && result.lessonDna) {
        generatedExamples.set(fixture.expected.example_id, {
          ...result.lessonDna,
          lesson_dna_id: fixture.expected.example_id,
        });
      }
      const repeated = selectLessonPedagogy(selectionRepository, fixture.request);
      if (stablePedagogyJson(result) !== stablePedagogyJson(repeated)) {
        errors.push(`${fixture.fixture_id}: repeated selection output is not byte-identical`);
      }
    }
  }
  if (examplesValid && selectionRepository.examples) {
    const exampleIds = selectionRepository.examples.data.examples.map((example) => example.lesson_dna_id);
    if (JSON.stringify(exampleIds) !== JSON.stringify(sorted(exampleIds))) {
      errors.push(`${selectionRepository.examples.file}: examples must be bytewise sorted`);
    }
    for (const duplicate of duplicateValues(exampleIds)) errors.push(`${selectionRepository.examples.file}: duplicate example ${duplicate}`);
    for (const example of selectionRepository.examples.data.examples) {
      const generated = generatedExamples.get(example.lesson_dna_id);
      if (!generated) errors.push(`${selectionRepository.examples.file}: no fixture generates ${example.lesson_dna_id}`);
      else if (!compareExample(example, generated)) {
        errors.push(`${selectionRepository.examples.file}: ${example.lesson_dna_id} is stale; regenerate from fixture`);
      }
    }
    for (const generatedId of generatedExamples.keys()) {
      if (!exampleIds.includes(generatedId)) errors.push(`${selectionRepository.examples.file}: missing generated example ${generatedId}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      patterns: patterns.length,
      targets: targets.length,
      fixtures: fixtureIds.length,
      examples: selectionRepository.examples?.data.examples.length ?? 0,
      successfulFixtures: selectionRepository.fixtures.data.fixtures
        .filter((fixture) => fixture.expected.status === 'success').length,
      failureFixtures: selectionRepository.fixtures.data.fixtures
        .filter((fixture) => fixture.expected.status === 'failure').length,
    },
  };
}

export function serializePedagogyYaml(value) {
  return stringify(value, {
    indent: 2,
    lineWidth: 100,
    sortMapEntries: false,
  });
}

export const pedagogySelectionPaths = {
  rules: PEDAGOGY_SELECTION_RULES,
  fixtures: PEDAGOGY_SELECTION_FIXTURES,
  examples: PEDAGOGY_LESSON_DNA_EXAMPLES,
  schemas: SELECTION_SCHEMA_FILES,
};
