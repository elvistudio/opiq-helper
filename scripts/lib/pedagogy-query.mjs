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

function compareBytewise(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function capabilityMeets(activity, capabilityId, minimum) {
  const level = activity.capabilities?.[capabilityId] ?? 'none';
  return (CAPABILITY_ORDER.get(level) ?? -1) >= (CAPABILITY_ORDER.get(minimum) ?? 2);
}

function addReason(reasons, condition, reason) {
  if (!condition) reasons.push(reason);
}

export function explainPedagogyActivityMatch(activity, filters = {}) {
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
      ? activity.delivery_constraints.delivery_modes.includes(filters.delivery_mode)
      : true,
    `delivery mode ${filters.delivery_mode} is not supported`,
  );
  addReason(
    reasons,
    Number.isInteger(filters.group_size)
      ? activity.delivery_constraints.group_size.min <= filters.group_size
        && filters.group_size <= activity.delivery_constraints.group_size.max
      : true,
    `group size ${filters.group_size} outside ${activity.delivery_constraints.group_size.min}-${activity.delivery_constraints.group_size.max}`,
  );
  addReason(
    reasons,
    filters.group_size_range
      ? activity.delivery_constraints.group_size.min <= filters.group_size_range.min
        && activity.delivery_constraints.group_size.max >= filters.group_size_range.max
      : true,
    filters.group_size_range
      ? `group range ${filters.group_size_range.min}-${filters.group_size_range.max} is not fully supported`
      : 'group range is not supported',
  );
  addReason(
    reasons,
    Array.isArray(filters.group_formats_any) && filters.group_formats_any.length > 0
      ? filters.group_formats_any.some((format) => activity.delivery_constraints.supported_group_formats.includes(format))
      : true,
    `none of the requested group formats are supported`,
  );
  addReason(
    reasons,
    Array.isArray(filters.required_capabilities_all)
      ? filters.required_capabilities_all.every((id) => capabilityMeets(activity, id, minimumCapability))
      : true,
    `not all required capabilities meet ${minimumCapability}`,
  );
  addReason(
    reasons,
    Array.isArray(filters.required_capabilities_any) && filters.required_capabilities_any.length > 0
      ? filters.required_capabilities_any.some((id) => capabilityMeets(activity, id, minimumCapability))
      : true,
    `none of the requested capabilities meet ${minimumCapability}`,
  );
  addReason(
    reasons,
    filters.max_parent_effort
      ? EFFORT_ORDER.get(activity.effort.homeschool_parent.level)
        <= EFFORT_ORDER.get(filters.max_parent_effort)
      : true,
    `parent effort ${activity.effort.homeschool_parent.level} exceeds ${filters.max_parent_effort}`,
  );
  addReason(
    reasons,
    filters.max_teacher_preparation
      ? EFFORT_ORDER.get(activity.effort.teacher_preparation.level)
        <= EFFORT_ORDER.get(filters.max_teacher_preparation)
      : true,
    `teacher preparation ${activity.effort.teacher_preparation.level} exceeds ${filters.max_teacher_preparation}`,
  );
  addReason(
    reasons,
    filters.offline === true
      ? !activity.resource_requirements.internet_required
        && POSITIVE_COMPATIBILITY.has(activity.compatibility.offline)
      : true,
    'activity is not offline-compatible',
  );
  addReason(
    reasons,
    filters.no_printer === true
      ? !activity.resource_requirements.printer_required
        && POSITIVE_COMPATIBILITY.has(activity.compatibility.no_printer)
      : true,
    'activity is not compatible with a no-printer setting',
  );
  addReason(
    reasons,
    filters.adult_safety_supervision_required === true
      ? activity.safety.requires_adult_supervision
        && activity.effort.homeschool_parent.role === 'safety_supervision'
      : true,
    'activity does not declare adult safety supervision',
  );
  addReason(
    reasons,
    filters.max_productive_language
      ? DEMAND_ORDER.get(activity.learner_demands.productive_language)
        <= DEMAND_ORDER.get(filters.max_productive_language)
      : true,
    `productive-language demand ${activity.learner_demands.productive_language} exceeds ${filters.max_productive_language}`,
  );
  addReason(
    reasons,
    Array.isArray(filters.estonian_a1_a2_compatibility)
      ? filters.estonian_a1_a2_compatibility.includes(
        activity.learner_demands.estonian_a1_a2_compatibility,
      )
      : true,
    `Estonian A1-A2 compatibility ${activity.learner_demands.estonian_a1_a2_compatibility} is excluded`,
  );
  addReason(
    reasons,
    Number.isInteger(filters.max_duration_minutes)
      ? activity.duration.max_minutes <= filters.max_duration_minutes
      : true,
    `maximum duration ${activity.duration.max_minutes} exceeds ${filters.max_duration_minutes}`,
  );
  addReason(
    reasons,
    filters.source_access_during_first_attempt
      ? activity.delivery_constraints.source_access_during_first_attempt
        === filters.source_access_during_first_attempt
      : true,
    `first-attempt source access is ${activity.delivery_constraints.source_access_during_first_attempt}`,
  );
  return {
    activity_id: activity.activity_id,
    matches: reasons.length === 0,
    reasons,
  };
}

export function filterPedagogyActivities(activities, filters = {}, { debug = false } = {}) {
  const inspected = activities
    .map((activity) => explainPedagogyActivityMatch(activity, filters))
    .sort((left, right) => compareBytewise(left.activity_id, right.activity_id));
  const result = {
    selection_mode: 'deterministic_filtering_without_ranking',
    activity_ids: inspected.filter((item) => item.matches).map((item) => item.activity_id),
  };
  if (debug) {
    result.excluded = inspected
      .filter((item) => !item.matches)
      .map(({ activity_id, reasons }) => ({ activity_id, reasons }));
  }
  return result;
}

export const pedagogyQueryOrders = {
  capability: CAPABILITY_ORDER,
  demand: DEMAND_ORDER,
  effort: EFFORT_ORDER,
};
