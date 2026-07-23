const CAPABILITY_ORDER = new Map([
  ['unknown', -1],
  ['none', 0],
  ['incidental', 1],
  ['supporting', 2],
  ['primary', 3],
]);

const DEMAND_ORDER = new Map([
  ['none', 0],
  ['very_low', 1],
  ['low', 2],
  ['medium', 3],
  ['high', 4],
  ['very_high', 5],
  ['unknown', Number.POSITIVE_INFINITY],
]);

const EFFORT_ORDER = new Map([
  ['none', 0],
  ['minimal', 1],
  ['low', 2],
  ['medium', 3],
  ['high', 4],
  ['intensive', 5],
  ['unknown', Number.POSITIVE_INFINITY],
]);

const POSITIVE_COMPATIBILITY = new Set(['directly_supported', 'adaptable']);

export const PEDAGOGY_TARGET_SEPARATOR = '::';

function compareBytewise(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function createTarget(activity, executionProfile = null) {
  const executionProfileId = executionProfile?.profile_id ?? null;
  return {
    target_id: executionProfileId
      ? `${activity.activity_id}${PEDAGOGY_TARGET_SEPARATOR}${executionProfileId}`
      : activity.activity_id,
    activity_id: activity.activity_id,
    execution_profile_id: executionProfileId,
    activity,
    operational: executionProfile ?? activity,
  };
}

export function expandPedagogyActivityTargets(activities) {
  return activities
    .flatMap((activity) => (
      Array.isArray(activity.execution_profiles)
        ? activity.execution_profiles.map((profile) => createTarget(activity, profile))
        : [createTarget(activity)]
    ))
    .sort((left, right) => compareBytewise(left.target_id, right.target_id));
}

function normalizeTarget(candidate) {
  if (candidate?.target_id && candidate?.activity && candidate?.operational) return candidate;
  if (Array.isArray(candidate?.execution_profiles)) {
    throw new Error(
      `profiled activity ${candidate.activity_id} must be queried through a concrete execution profile`,
    );
  }
  return createTarget(candidate);
}

function capabilityMeets(operational, capabilityId, minimum) {
  const level = operational.capabilities?.[capabilityId] ?? 'none';
  return (CAPABILITY_ORDER.get(level) ?? -1) >= (CAPABILITY_ORDER.get(minimum) ?? 2);
}

function addReason(reasons, condition, reason) {
  if (!condition) reasons.push(reason);
}

export function explainPedagogyActivityMatch(candidate, filters = {}) {
  const target = normalizeTarget(candidate);
  const { activity, operational } = target;
  const reasons = [];
  const minimumCapability = filters.minimum_capability_level ?? 'supporting';
  addReason(
    reasons,
    Number.isInteger(filters.grade)
      ? activity.suitable_grades.min <= filters.grade && filters.grade <= activity.suitable_grades.max
      : true,
    `grade ${filters.grade} outside ${activity.suitable_grades.min}-${activity.suitable_grades.max}`,
  );
  addReason(
    reasons,
    filters.subject
      ? activity.subjects.includes(filters.subject) || activity.subjects.includes('cross_curricular')
      : true,
    `subject ${filters.subject} is not supported`,
  );
  addReason(
    reasons,
    filters.lesson_phase ? activity.suitable_lesson_phases.includes(filters.lesson_phase) : true,
    `lesson phase ${filters.lesson_phase} is not supported`,
  );
  addReason(
    reasons,
    filters.delivery_mode
      ? operational.delivery_constraints.delivery_modes.includes(filters.delivery_mode)
      : true,
    `delivery mode ${filters.delivery_mode} is not supported`,
  );
  addReason(
    reasons,
    Number.isInteger(filters.group_size)
      ? operational.delivery_constraints.group_size.min <= filters.group_size
        && filters.group_size <= operational.delivery_constraints.group_size.max
      : true,
    `group size ${filters.group_size} outside ${operational.delivery_constraints.group_size.min}-${operational.delivery_constraints.group_size.max}`,
  );
  addReason(
    reasons,
    filters.group_size_range
      ? operational.delivery_constraints.group_size.min <= filters.group_size_range.min
        && operational.delivery_constraints.group_size.max >= filters.group_size_range.max
      : true,
    filters.group_size_range
      ? `group range ${filters.group_size_range.min}-${filters.group_size_range.max} is not fully supported`
      : 'group range is not supported',
  );
  addReason(
    reasons,
    Array.isArray(filters.group_formats_any) && filters.group_formats_any.length > 0
      ? filters.group_formats_any.some(
        (format) => operational.delivery_constraints.supported_group_formats.includes(format),
      )
      : true,
    'none of the requested group formats are supported',
  );
  addReason(
    reasons,
    Array.isArray(filters.required_capabilities_all)
      ? filters.required_capabilities_all.every(
        (id) => capabilityMeets(operational, id, minimumCapability),
      )
      : true,
    `not all required capabilities meet ${minimumCapability}`,
  );
  addReason(
    reasons,
    Array.isArray(filters.required_capabilities_any) && filters.required_capabilities_any.length > 0
      ? filters.required_capabilities_any.some(
        (id) => capabilityMeets(operational, id, minimumCapability),
      )
      : true,
    `none of the requested capabilities meet ${minimumCapability}`,
  );
  addReason(
    reasons,
    filters.max_parent_effort
      ? EFFORT_ORDER.get(operational.effort.homeschool_parent.level)
        <= EFFORT_ORDER.get(filters.max_parent_effort)
      : true,
    `parent effort ${operational.effort.homeschool_parent.level} exceeds ${filters.max_parent_effort}`,
  );
  addReason(
    reasons,
    filters.max_teacher_preparation
      ? EFFORT_ORDER.get(operational.effort.teacher_preparation.level)
        <= EFFORT_ORDER.get(filters.max_teacher_preparation)
      : true,
    `teacher preparation ${operational.effort.teacher_preparation.level} exceeds ${filters.max_teacher_preparation}`,
  );
  addReason(
    reasons,
    filters.offline === true
      ? !operational.resource_requirements.internet_required
        && POSITIVE_COMPATIBILITY.has(operational.compatibility.offline)
      : true,
    'execution target is not offline-compatible',
  );
  addReason(
    reasons,
    filters.no_printer === true
      ? !operational.resource_requirements.printer_required
        && POSITIVE_COMPATIBILITY.has(operational.compatibility.no_printer)
      : true,
    'execution target is not compatible with a no-printer setting',
  );
  if (typeof filters.adult_safety_supervision_required === 'boolean') {
    const supervisionMatches = operational.safety.requires_adult_supervision
      === filters.adult_safety_supervision_required;
    const parentRoleMatches = !filters.adult_safety_supervision_required
      || operational.effort.homeschool_parent.role === 'safety_supervision';
    addReason(
      reasons,
      supervisionMatches && parentRoleMatches,
      filters.adult_safety_supervision_required
        ? 'adult safety supervision is not required by this execution target'
        : 'execution target requires adult safety supervision',
    );
  }
  addReason(
    reasons,
    filters.max_productive_language
      ? DEMAND_ORDER.get(operational.learner_demands.productive_language)
        <= DEMAND_ORDER.get(filters.max_productive_language)
      : true,
    `productive-language demand ${operational.learner_demands.productive_language} exceeds ${filters.max_productive_language}`,
  );
  addReason(
    reasons,
    Array.isArray(filters.estonian_a1_a2_compatibility)
      ? filters.estonian_a1_a2_compatibility.includes(
        operational.learner_demands.estonian_a1_a2_compatibility,
      )
      : true,
    `Estonian A1-A2 compatibility ${operational.learner_demands.estonian_a1_a2_compatibility} is excluded`,
  );
  addReason(
    reasons,
    Number.isInteger(filters.max_duration_minutes)
      ? operational.duration.max_minutes <= filters.max_duration_minutes
      : true,
    `maximum duration ${operational.duration.max_minutes} exceeds ${filters.max_duration_minutes}`,
  );
  addReason(
    reasons,
    filters.source_access_during_first_attempt
      ? operational.delivery_constraints.source_access_during_first_attempt
        === filters.source_access_during_first_attempt
      : true,
    `first-attempt source access is ${operational.delivery_constraints.source_access_during_first_attempt}`,
  );
  return {
    target_id: target.target_id,
    activity_id: target.activity_id,
    execution_profile_id: target.execution_profile_id,
    matches: reasons.length === 0,
    reasons,
  };
}

export function filterPedagogyActivities(activities, filters = {}, { debug = false } = {}) {
  const inspected = expandPedagogyActivityTargets(activities)
    .map((target) => explainPedagogyActivityMatch(target, filters))
    .sort((left, right) => compareBytewise(left.target_id, right.target_id));
  const matched = inspected.filter((item) => item.matches);
  const result = {
    selection_mode: 'deterministic_filtering_without_ranking',
    targets: matched.map(({ target_id, activity_id, execution_profile_id }) => ({
      target_id,
      activity_id,
      execution_profile_id,
    })),
    activity_ids: [...new Set(matched.map((item) => item.activity_id))].sort(compareBytewise),
  };
  if (debug) {
    result.excluded = inspected
      .filter((item) => !item.matches)
      .map(({ target_id, activity_id, execution_profile_id, reasons }) => ({
        target_id,
        activity_id,
        execution_profile_id,
        reasons,
      }));
  }
  return result;
}

export const pedagogyQueryOrders = {
  capability: CAPABILITY_ORDER,
  demand: DEMAND_ORDER,
  effort: EFFORT_ORDER,
};
