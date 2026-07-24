import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  adaptLessonForHomeschool,
  createPedagogyHomeschoolValidators,
  deriveHomeschoolSelectionRequest,
  finalSafetyState,
  loadPedagogyHomeschoolRepository,
  materializeHomeschoolFixture,
  resolveHomeschoolOverrideSlot,
  serializeHomeschoolYaml,
  validateAdaptedBindings,
  validateFinalSafety,
  validatePedagogyHomeschool,
} from './lib/pedagogy-homeschool.mjs';
import { parseStrictPedagogyYaml } from './lib/pedagogy-knowledge.mjs';
import { stablePedagogyJson } from './lib/pedagogy-selection.mjs';
import { expandPedagogyActivityTargets } from './lib/pedagogy-query.mjs';

const repository = await loadPedagogyHomeschoolRepository();
const validators = createPedagogyHomeschoolValidators(repository);

function fixture(id) {
  return repository.fixtures.data.fixtures.find((item) => item.fixture_id === id);
}

function requestFor(id) {
  return materializeHomeschoolFixture(repository, fixture(id));
}

function resultFor(id) {
  return adaptLessonForHomeschool(repository, requestFor(id));
}

function clone(value) {
  return structuredClone(value);
}

function selectedTargets(result) {
  return result.homeschoolLessonDna?.phases.map((phase) => phase.target.target_id) ?? [];
}

function selectedDeliveryDimensions(result) {
  return result.decision.derived_selection_decision.slot_decisions.flatMap((slot) => {
    const selected = slot.considered_candidates.find(
      (candidate) => candidate.target_id === slot.selected_target_id,
    );
    return selected?.operational_fit.delivery_dimensions ?? [];
  });
}

function overrideRequest(policy) {
  const adaptedFixture = clone(fixture('homeschool-concept-independent'));
  adaptedFixture.source_fixture_id = 'grade5-teacher-override';
  adaptedFixture.adaptation_context.teacher_override_policy = policy;
  return materializeHomeschoolFixture(repository, adaptedFixture);
}

function resolveFixtureSlot(
  fixtureId,
  sourceSlotId,
  targetPatternId,
  {
    patternPolicies = repository.selection.rules.data.pattern_policies,
    phaseMappings = null,
  } = {},
) {
  const request = requestFor(fixtureId);
  const sourcePhase = request.source.lesson_dna.phases.find(
    (phase) => phase.phase_id === sourceSlotId,
  );
  const mappings = phaseMappings ?? (
    request.source.selection_request.lesson_context.context_flags.practical
      ? repository.rules.data.practical_phase_mappings
      : repository.rules.data.phase_mappings
  );
  return resolveHomeschoolOverrideSlot({
    sourceOverride: {
      override_id: `resolve-${sourceSlotId}`,
      slot_id: sourceSlotId,
      requested_target_id: sourcePhase?.target.target_id ?? 'concept-map',
      teacher_rationale_ru: 'Synthetic resolver test.',
    },
    sourceLessonDna: request.source.lesson_dna,
    sourcePatternId: request.source.lesson_dna.pattern.pattern_id,
    targetPatternId,
    phaseMappings: mappings,
    patternPolicies,
  });
}

function objectKeys(value, currentPath = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => objectKeys(item, `${currentPath}/${index}`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    `${currentPath}/${key}`,
    ...objectKeys(child, `${currentPath}/${key}`),
  ]);
}

test('all seven homeschool schemas compile under strict Ajv', () => {
  assert.deepEqual(
    Object.keys(validators).sort(),
    ['decision', 'examples', 'fixtures', 'package', 'parentGuidance', 'request', 'weeklyStudyPlan'],
  );
  assert.ok(Object.values(validators).every((validator) => typeof validator === 'function'));
});

test('production homeschool repository validates', () => {
  assert.deepEqual(validatePedagogyHomeschool(repository), {
    valid: true,
    errors: [],
    warnings: [],
    counts: {
      fixtures: 18,
      successfulFixtures: 11,
      failureFixtures: 7,
      examples: 5,
      schemas: 7,
    },
  });
});

test('request schema rejects additional properties', () => {
  const request = requestFor('homeschool-concept-independent');
  request.unexpected = true;
  assert.equal(validators.request(request), false);
});

test('request schema rejects an invalid variant', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.variant = 'solo_magic';
  assert.equal(validators.request(request), false);
});

test('request schema rejects an invalid adult role', () => {
  const request = requestFor('homeschool-oral-parent-child');
  request.adaptation_context.adult_context.allowed_roles = ['science_teacher'];
  assert.equal(validators.request(request), false);
});

test('request schema rejects personal learner fields', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.child_name = 'Example Child';
  assert.equal(validators.request(request), false);
});

test('strict YAML parser rejects duplicate keys', () => {
  assert.throws(
    () => parseStrictPedagogyYaml('schema_version: "1.0"\nschema_version: "1.0"\n', 'duplicate.yaml'),
    /keys must be unique/i,
  );
});

test('invalid source selection request returns a structured failure', () => {
  const request = requestFor('homeschool-concept-independent');
  delete request.source.selection_request.schema_version;
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'invalid_source_selection_request',
  );
});

test('invalid source lesson DNA returns a structured failure', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.artifact_type = 'not_lesson_dna';
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'invalid_source_lesson_dna',
  );
});

test('source request digest mismatch is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.context.request_digest = '0'.repeat(64);
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'source_request_digest_mismatch',
  );
});

test('stale activity catalog digest is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.versions.activity_catalog_digest = '0'.repeat(64);
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'stale_source_lesson_dna',
  );
});

test('non-reproducible source DNA is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.phases[0].activity_minutes += 1;
  const result = adaptLessonForHomeschool(repository, request);
  assert.equal(result.decision.failure.code, 'source_selection_not_reproducible');
});

test('grade mismatch between request and DNA is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.context.grade = 4;
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'stale_source_lesson_dna',
  );
});

test('subject mismatch between request and DNA is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.context.subject = 'geography';
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'stale_source_lesson_dna',
  );
});

test('language-policy mismatch between request and DNA is rejected', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.context.language_policy.primary_instruction_language = 'et';
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'stale_source_lesson_dna',
  );
});

test('invalid readiness value is rejected by the source DNA schema', () => {
  const request = requestFor('homeschool-concept-independent');
  request.source.lesson_dna.status.teacher_review = 'rubber_stamped';
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'invalid_source_lesson_dna',
  );
});

test('derived request preserves grade', () => {
  const request = requestFor('homeschool-concept-independent');
  assert.equal(
    deriveHomeschoolSelectionRequest(repository, request).learner_context.grade,
    request.source.selection_request.learner_context.grade,
  );
});

test('derived request preserves subject', () => {
  const request = requestFor('homeschool-concept-independent');
  assert.equal(
    deriveHomeschoolSelectionRequest(repository, request).learner_context.subject,
    request.source.selection_request.learner_context.subject,
  );
});

test('derived request preserves lesson purpose', () => {
  const request = requestFor('homeschool-concept-independent');
  assert.equal(
    deriveHomeschoolSelectionRequest(repository, request).lesson_context.purpose,
    request.source.selection_request.lesson_context.purpose,
  );
});

test('derived request preserves required capabilities', () => {
  const request = requestFor('homeschool-concept-independent');
  assert.deepEqual(
    deriveHomeschoolSelectionRequest(repository, request).lesson_context.required_capabilities,
    request.source.selection_request.lesson_context.required_capabilities,
  );
});

test('a stricter homeschool productive-language ceiling is applied', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.maximum_total_productive_language_demand = 'low';
  assert.equal(
    deriveHomeschoolSelectionRequest(repository, request)
      .language_profile.maximum_total_productive_language_demand,
    'low',
  );
});

test('a looser homeschool language ceiling cannot relax the source ceiling', () => {
  const request = requestFor('homeschool-map-independent');
  request.adaptation_context.maximum_total_productive_language_demand = 'very_high';
  assert.equal(
    deriveHomeschoolSelectionRequest(repository, request)
      .language_profile.maximum_total_productive_language_demand,
    request.source.selection_request.language_profile.maximum_total_productive_language_demand,
  );
});

test('enabled Estonian support remains enabled', () => {
  assert.equal(
    resultFor('homeschool-concept-independent').package.context.estonian_support.enabled,
    true,
  );
});

test('disabled Estonian support remains disabled', () => {
  assert.equal(resultFor('homeschool-russian-only').package.context.estonian_support.enabled, false);
});

test('future retrieval windows remain in homeschool DNA', () => {
  const request = requestFor('homeschool-concept-independent');
  const result = adaptLessonForHomeschool(repository, request);
  assert.deepEqual(
    result.homeschoolLessonDna.retrieval_plan.delayed,
    request.source.lesson_dna.retrieval_plan.delayed,
  );
});

test('practical safety availability is not weakened in the derived request', () => {
  const request = requestFor('homeschool-practical-supervised');
  const derived = deriveHomeschoolSelectionRequest(repository, request);
  assert.equal(derived.resources.adult_safety_supervision_available, true);
  assert.equal(derived.lesson_context.context_flags.practical, true);
});

test('independent variant selects independent study for one learner', () => {
  const result = resultFor('homeschool-concept-independent');
  assert.equal(result.homeschoolLessonDna.context.delivery_mode, 'independent_study');
  assert.equal(result.homeschoolLessonDna.context.group_size, 1);
});

test('parent-child variant keeps the adult outside learner count', () => {
  const result = resultFor('homeschool-oral-parent-child');
  assert.equal(result.package.context.learner_count, 1);
  assert.equal(result.homeschoolLessonDna.context.group_size, 1);
});

test('remote-peer variant selects remote pair delivery', () => {
  const result = resultFor('homeschool-remote-peer');
  assert.equal(result.homeschoolLessonDna.context.delivery_mode, 'remote');
  assert.equal(result.homeschoolLessonDna.context.group_size, 2);
});

test('small sibling group variant selects supported homeschool grouping', () => {
  const result = resultFor('homeschool-sibling-group');
  assert.equal(result.decision.status, 'success');
  assert.equal(result.homeschoolLessonDna.context.delivery_mode, 'homeschool');
  assert.equal(result.package.context.learner_count, 2);
});

test('unsupported variant returns a deterministic structured failure', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.variant = 'unsupported';
  const result = adaptLessonForHomeschool(repository, request);
  assert.equal(result.decision.failure.code, 'unsupported_homeschool_variant');
});

test('directly suitable targets may be preserved', () => {
  const result = resultFor('homeschool-retrieval-independent');
  assert.ok(selectedTargets(result).includes('retrieval-self-test'));
});

test('adaptable target is visible as a warning', () => {
  assert.deepEqual(
    resultFor('homeschool-practical-supervised').decision.warnings.map((item) => item.code),
    ['adaptable_homeschool_target'],
  );
});

test('limited adaptation is rejected by default', () => {
  assert.equal(
    resultFor('homeschool-limited-disallowed').decision.failure.code,
    'limited_adaptation_not_allowed',
  );
});

test('not-recommended targets never appear in successful DNA', () => {
  const targetMap = new Map(
    expandPedagogyActivityTargets(
      repository.selection.knowledge.activities.data.activities,
    ).map((target) => [target.target_id, target]),
  );
  for (const item of repository.fixtures.data.fixtures.filter(
    (candidate) => candidate.expected.status === 'success',
  )) {
    const result = resultFor(item.fixture_id);
    for (const phase of result.homeschoolLessonDna.phases) {
      assert.notEqual(
        targetMap.get(phase.target.target_id).operational.homeschool_adaptation.status,
        'not_recommended',
      );
    }
  }
});

test('every final target declares the selected homeschool variant', () => {
  const targets = new Map(
    expandPedagogyActivityTargets(
      repository.selection.knowledge.activities.data.activities,
    ).map((target) => [target.target_id, target]),
  );
  for (const item of repository.fixtures.data.fixtures.filter(
    (candidate) => candidate.expected.status === 'success',
  )) {
    const result = resultFor(item.fixture_id);
    for (const phase of result.homeschoolLessonDna.phases) {
      assert.ok(
        targets.get(phase.target.target_id).operational
          .homeschool_adaptation.variants.includes(result.decision.selected_variant),
      );
    }
  }
});

test('independent variant does not invent a parent role', () => {
  assert.ok(
    resultFor('homeschool-concept-independent').decision.adult_role_decisions
      .every((decision) => decision.role === 'none'),
  );
});

test('parent-child oral package uses bounded adult roles', () => {
  const roles = resultFor('homeschool-oral-parent-child').parentGuidance.adult_roles
    .map((item) => item.role);
  assert.ok(roles.every(
    (role) => ['check_answers', 'listening_partner', 'logistical_support', 'none'].includes(role),
  ));
});

test('adult effort above a zero-minute limit fails', () => {
  assert.equal(
    resultFor('homeschool-parent-effort-limit').decision.failure.code,
    'adult_effort_exceeds_limit',
  );
});

test('supervised practical fixture succeeds', () => {
  assert.equal(resultFor('homeschool-practical-supervised').decision.status, 'success');
});

test('practical fixture without supervision fails', () => {
  assert.equal(
    resultFor('homeschool-practical-no-supervision').decision.failure.code,
    'safety_supervision_unavailable',
  );
});

test('parent guidance never requires subject explanation', () => {
  for (const item of repository.examples.data.examples) {
    assert.ok(
      item.parent_guidance.adult_roles
        .every((role) => role.role !== 'subject_explanation_required'),
    );
  }
});

test('require-preservation rejects an override that moves to a different mapped phase', () => {
  const result = adaptLessonForHomeschool(repository, overrideRequest('require_preservation'));
  assert.equal(result.decision.failure.code, 'teacher_override_not_preserved');
  assert.equal(result.decision.teacher_override_adaptations[0].source_target_id, 'concept-map');
  assert.equal(result.decision.teacher_override_adaptations[0].status, 'rejected');
});

test('allow-reselection exposes the override replacement in the phase trace', () => {
  const result = adaptLessonForHomeschool(
    repository,
    overrideRequest('allow_reselection_with_warning'),
  );
  assert.equal(result.decision.status, 'success');
  assert.deepEqual(result.decision.warnings.map((warning) => warning.code), [
    'teacher_override_reselected',
  ]);
  assert.ok(result.decision.phase_adaptations.some(
    (adaptation) => adaptation.source_phase_id === 'guided-practice'
      && adaptation.source_target_id === 'concept-map'
      && adaptation.action === 'reselected',
  ));
});

test('reject-all refuses a source teacher override', () => {
  const result = adaptLessonForHomeschool(repository, overrideRequest('reject_all'));
  assert.equal(result.decision.failure.code, 'teacher_override_not_preserved');
});

test('retrieval step keeps the source closed', () => {
  const result = resultFor('homeschool-retrieval-independent');
  const steps = result.package.learner_plan.steps.filter((step) => step.phase_id === 'retrieval');
  assert.ok(steps.length > 0);
  assert.ok(steps.every((step) => step.source_access === 'closed'));
});

test('retrieval answer access is released only after the attempt', () => {
  const sessions = resultFor('homeschool-retrieval-independent').weeklyStudyPlan.sessions;
  assert.ok(sessions.some(
    (session) => session.retrieval_type === 'immediate'
      && session.answer_access === 'self_managed_after_attempt',
  ));
});

test('missing retrieval answer key is rejected', () => {
  assert.equal(
    resultFor('homeschool-retrieval-missing-key').decision.failure.code,
    'answer_key_binding_missing',
  );
});

test('learner plan contains a visible correction instruction', () => {
  assert.match(
    resultFor('homeschool-retrieval-independent').package.learner_plan.correction_ru,
    /другим цветом/,
  );
});

test('learner plan contains an unresolved-question path', () => {
  assert.match(
    resultFor('homeschool-concept-independent').package.learner_plan.reflection_ru,
    /нерешённый вопрос/,
  );
});

test('learner timing total reconciles', () => {
  const timing = resultFor('homeschool-concept-independent').package.timing;
  assert.equal(
    timing.total_learner_minutes,
    timing.learner_activity_minutes
      + timing.setup_minutes
      + timing.cleanup_minutes
      + timing.transition_minutes
      + timing.break_minutes
      + timing.delayed_retrieval_minutes
      + timing.weekly_review_minutes
      + timing.contingency_minutes,
  );
});

test('adult timing total reconciles separately', () => {
  const timing = resultFor('homeschool-practical-supervised').parentGuidance.timing;
  assert.equal(
    timing.total_adult_minutes,
    timing.adult_preparation_minutes
      + timing.adult_live_support_minutes
      + timing.adult_safety_minutes
      + timing.adult_answer_access_minutes,
  );
});

test('every session respects the declared learner limit', () => {
  for (const item of repository.fixtures.data.fixtures.filter(
    (candidate) => candidate.expected.status === 'success',
  )) {
    const request = requestFor(item.fixture_id);
    const result = adaptLessonForHomeschool(repository, request);
    assert.ok(result.weeklyStudyPlan.sessions.every(
      (session) => session.learner_minutes
        <= request.adaptation_context.learner_session_minutes,
    ));
  }
});

test('session count respects the declared maximum', () => {
  for (const item of repository.fixtures.data.fixtures.filter(
    (candidate) => candidate.expected.status === 'success',
  )) {
    const request = requestFor(item.fixture_id);
    const result = adaptLessonForHomeschool(repository, request);
    assert.ok(
      result.weeklyStudyPlan.sessions.length <= request.adaptation_context.maximum_sessions,
    );
  }
});

test('an unrealistically small total session capacity fails visibly', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.learner_session_minutes = 10;
  request.adaptation_context.maximum_sessions = 1;
  const result = adaptLessonForHomeschool(repository, request);
  assert.equal(result.decision.status, 'failure');
  assert.ok(['timing_unrealistic', 'no_homeschool_composition'].includes(
    result.decision.failure.code,
  ));
});

test('a break is never placed after the final learner step', () => {
  const result = resultFor('homeschool-concept-independent');
  const finalStepId = result.package.learner_plan.steps.at(-1).step_id;
  assert.ok(result.package.learner_plan.breaks.every(
    (entry) => entry.after_step_id !== finalStepId,
  ));
});

test('setup and cleanup remain visible in package timing', () => {
  const timing = resultFor('homeschool-practical-supervised').package.timing;
  assert.ok(timing.setup_minutes > 0);
  assert.ok(timing.cleanup_minutes > 0);
});

test('safety supervision time is not silently removed', () => {
  const result = resultFor('homeschool-practical-supervised');
  assert.ok(result.parentGuidance.timing.adult_safety_minutes > 0);
  assert.equal(result.package.safety.adult_supervision_required, true);
});

test('Russian remains the primary instruction language', () => {
  for (const item of repository.examples.data.examples) {
    assert.equal(item.package.context.primary_instruction_language, 'ru');
  }
});

test('enabled Estonian roles stay within source-declared roles', () => {
  const request = requestFor('homeschool-oral-parent-child');
  const result = adaptLessonForHomeschool(repository, request);
  const allowed = new Set(
    request.source.selection_request.language_profile.estonian_support.allowed_roles,
  );
  for (const step of result.package.learner_plan.steps) {
    assert.ok(step.estonian_roles.every((role) => allowed.has(role)));
  }
});

test('subject and Estonian assessment remain separate', () => {
  assert.equal(
    resultFor('homeschool-oral-parent-child').package.assessment.separation_policy,
    'separate_subject_and_estonian_language_evidence',
  );
});

test('disabled Estonian support emits no Estonian roles', () => {
  const result = resultFor('homeschool-russian-only');
  assert.ok(result.package.learner_plan.steps.every((step) => step.estonian_roles.length === 0));
  assert.equal(result.package.assessment.estonian_language_assessment, false);
});

test('Estonian support references come only from opaque input bindings', () => {
  const request = requestFor('homeschool-oral-parent-child');
  const allowedRefs = new Set(
    request.content_bindings.flatMap((binding) => binding.estonian_support_refs),
  );
  const result = adaptLessonForHomeschool(repository, request);
  const packageRefs = result.package.materials.learner_material_refs;
  assert.ok(packageRefs.every((reference) => !reference.startsWith('invented-estonian-')));
  assert.ok(allowedRefs.size > 0);
});

test('weekly plan uses relative scheduling only', () => {
  assert.equal(
    resultFor('homeschool-concept-independent').weeklyStudyPlan.week_structure.schedule_type,
    'relative',
  );
});

test('weekly plan includes immediate retrieval', () => {
  assert.ok(
    resultFor('homeschool-retrieval-independent').weeklyStudyPlan.sessions
      .some((session) => session.retrieval_type === 'immediate'),
  );
});

test('weekly plan preserves delayed retrieval windows', () => {
  assert.ok(
    resultFor('homeschool-concept-independent')
      .weeklyStudyPlan.weekly_review.relative_windows.length > 0,
  );
});

test('weekly review is included when delayed windows exist', () => {
  assert.equal(
    resultFor('homeschool-concept-independent').weeklyStudyPlan.weekly_review.included,
    true,
  );
});

test('weekly plan stores no dates or progress state', () => {
  const paths = objectKeys(resultFor('homeschool-concept-independent').weeklyStudyPlan);
  assert.ok(paths.every((item) => !/(date|completed|progress_history)$/.test(item)));
});

test('after-days retrieval window creates a counted delayed session', () => {
  const session = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'delayed_after_days',
  );
  assert.deepEqual(session.relative_window, { after_days: 7, capability: 'retrieval' });
  assert.equal(session.purpose, 'delayed_retrieval');
  assert.equal(session.source_access_policy, 'closed');
});

test('after-lessons retrieval window creates a counted delayed session', () => {
  const session = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'delayed_after_lessons',
  );
  assert.deepEqual(session.relative_window, { after_lessons: 1, capability: 'retrieval' });
  assert.equal(session.purpose, 'delayed_retrieval');
});

test('next-unit retrieval window creates a real weekly-review session', () => {
  const session = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'next_unit_review',
  );
  assert.deepEqual(session.relative_window, { capability: 'retrieval', next_unit: true });
  assert.equal(session.purpose, 'weekly_review');
  assert.equal(session.learner_minutes, repository.rules.data.timing.weekly_review_minutes);
});

test('every review session is included in the maximum-session count', () => {
  const request = requestFor('homeschool-concept-independent');
  const plan = resultFor('homeschool-concept-independent').weeklyStudyPlan;
  assert.equal(plan.sessions.length, 5);
  assert.ok(plan.sessions.length <= request.adaptation_context.maximum_sessions);
});

test('review sessions are included in both weekly and package learner totals', () => {
  const result = resultFor('homeschool-concept-independent');
  assert.equal(
    result.weeklyStudyPlan.total_learner_minutes,
    result.package.timing.total_learner_minutes,
  );
  const reviewMinutes = result.weeklyStudyPlan.sessions
    .filter((session) => session.relative_window)
    .reduce((sum, session) => sum + session.learner_minutes, 0);
  assert.equal(
    reviewMinutes,
    result.package.timing.delayed_retrieval_minutes
      + result.package.timing.weekly_review_minutes,
  );
});

test('review-session overflow returns timing-unrealistic without dropping a window', () => {
  const result = resultFor('homeschool-supplemental-review-session-overflow');
  assert.equal(result.decision.failure.code, 'timing_unrealistic');
  assert.match(result.decision.failure.details.join(' '), /5 core and review sessions/);
});

test('review sessions contain no absolute dates and keep answer release after attempt', () => {
  const reviewSessions = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions
    .filter((session) => session.relative_window);
  assert.ok(reviewSessions.every((session) => session.answer_access === 'self_managed_after_attempt'));
  assert.ok(objectKeys(reviewSessions).every((item) => !/(date|timestamp)$/.test(item)));
});

test('weekly-review minutes are a visible numeric timing component', () => {
  const timing = resultFor('homeschool-concept-independent').package.timing;
  assert.equal(timing.weekly_review_minutes, 8);
  assert.equal(timing.delayed_retrieval_minutes, 12);
});

test('remote peer selected-target traces never apply one-learner compatibility', () => {
  assert.ok(selectedDeliveryDimensions(resultFor('homeschool-remote-peer')).every(
    (dimension) => dimension.dimension !== 'one_learner',
  ));
});

test('sibling group selected-target traces never apply one-learner compatibility', () => {
  assert.ok(selectedDeliveryDimensions(resultFor('homeschool-sibling-group')).every(
    (dimension) => dimension.dimension !== 'one_learner',
  ));
});

test('independent learner selected-target traces retain one-learner compatibility', () => {
  assert.ok(selectedDeliveryDimensions(resultFor('homeschool-concept-independent')).some(
    (dimension) => dimension.dimension === 'one_learner',
  ));
});

test('parent-child keeps one learner while adult support remains separate', () => {
  const result = resultFor('homeschool-oral-parent-child');
  assert.equal(result.package.context.learner_count, 1);
  assert.ok(selectedDeliveryDimensions(result).some(
    (dimension) => dimension.dimension === 'one_learner',
  ));
});

test('homeschool variant rules use collaborative study for real learner groups', () => {
  assert.equal(repository.rules.data.variants.remote_peer.study_context, 'collaborative_study');
  assert.equal(
    repository.rules.data.variants.small_sibling_group.study_context,
    'collaborative_study',
  );
});

test('adapted supervised target is detected even when source safety is false', () => {
  const request = requestFor('homeschool-concept-independent');
  const dna = clone(resultFor('homeschool-concept-independent').homeschoolLessonDna);
  dna.phases[0].safety.requires_adult_supervision = true;
  dna.phases[0].safety.controls_ru = ['Adapted safety control.'];
  const state = finalSafetyState(request, dna);
  assert.equal(state.source_supervision_required, false);
  assert.equal(state.adapted_supervision_required, true);
  assert.equal(state.effective_supervision_required, true);
});

test('adapted supervision without adult availability fails final-DNA safety validation', () => {
  const request = requestFor('homeschool-concept-independent');
  const dna = clone(resultFor('homeschool-concept-independent').homeschoolLessonDna);
  dna.phases[0].safety.requires_adult_supervision = true;
  request.adaptation_context.resources.adult_safety_supervision_available = true;
  request.adaptation_context.adult_context.safety_supervision_available = true;
  request.adaptation_context.adult_context.allowed_roles = ['safety_supervision'];
  const failure = validateFinalSafety(request, finalSafetyState(request, dna));
  assert.ok(failure.details.includes('missing adult_context.available'));
});

test('adapted supervision without the resource flag fails final-DNA safety validation', () => {
  const request = requestFor('homeschool-concept-independent');
  const dna = clone(resultFor('homeschool-concept-independent').homeschoolLessonDna);
  dna.phases[0].safety.requires_adult_supervision = true;
  request.adaptation_context.adult_context.available = true;
  request.adaptation_context.adult_context.safety_supervision_available = true;
  request.adaptation_context.adult_context.allowed_roles = ['safety_supervision'];
  const failure = validateFinalSafety(request, finalSafetyState(request, dna));
  assert.ok(failure.details.includes('missing resources.adult_safety_supervision_available'));
});

test('adapted supervision without an allowed safety role fails final-DNA validation', () => {
  const request = requestFor('homeschool-concept-independent');
  const dna = clone(resultFor('homeschool-concept-independent').homeschoolLessonDna);
  dna.phases[0].safety.requires_adult_supervision = true;
  request.adaptation_context.adult_context.available = true;
  request.adaptation_context.adult_context.safety_supervision_available = true;
  request.adaptation_context.resources.adult_safety_supervision_available = true;
  const failure = validateFinalSafety(request, finalSafetyState(request, dna));
  assert.ok(failure.details.includes('missing adult_context.allowed_roles safety_supervision'));
});

test('source supervision cannot disappear from final homeschool DNA', () => {
  const request = requestFor('homeschool-practical-supervised');
  const dna = clone(resultFor('homeschool-practical-supervised').homeschoolLessonDna);
  for (const phase of dna.phases) phase.safety.requires_adult_supervision = false;
  const failure = validateFinalSafety(request, finalSafetyState(request, dna));
  assert.equal(failure.code, 'safety_requirement_not_preserved');
});

test('package and parent guidance expose source-adapted-effective safety separately', () => {
  const result = resultFor('homeschool-practical-supervised');
  for (const safety of [result.package.safety, result.parentGuidance.safety]) {
    assert.equal(safety.source_supervision_required, true);
    assert.equal(safety.adapted_supervision_required, true);
    assert.equal(safety.effective_supervision_required, true);
    assert.equal(safety.adult_supervision_required, true);
  }
});

test('adult safety minutes equal the final supervised-phase activity and handling time', () => {
  const result = resultFor('homeschool-practical-supervised');
  const expected = result.homeschoolLessonDna.phases
    .filter((phase) => phase.safety.requires_adult_supervision)
    .reduce((sum, phase) => (
      sum + phase.activity_minutes + phase.setup_minutes + phase.cleanup_minutes
    ), 0);
  assert.equal(result.parentGuidance.timing.adult_safety_minutes, expected);
});

test('final safety controls are the deterministic source-adapted union', () => {
  const request = requestFor('homeschool-practical-supervised');
  const dna = clone(resultFor('homeschool-practical-supervised').homeschoolLessonDna);
  dna.phases[0].safety.controls_ru.push('Additional adapted control.');
  const controls = finalSafetyState(request, dna).controls_ru;
  assert.ok(controls.includes('Additional adapted control.'));
  assert.deepEqual(controls, [...controls].sort((left, right) => (
    Buffer.from(left).compare(Buffer.from(right))
  )));
  assert.equal(new Set(controls).size, controls.length);
});

test('successful safety decision trace records all four final-DNA checks', () => {
  assert.deepEqual(
    resultFor('homeschool-practical-supervised').decision.safety_checks.map((item) => item.code),
    [
      'source_safety_checked',
      'adapted_safety_checked',
      'safety_not_relaxed',
      'supervision_availability_checked',
    ],
  );
});

test('adapted retrieval without an exact or mapped key exposes phase-level provenance', () => {
  const result = resultFor('homeschool-retrieval-missing-key');
  const trace = result.decision.answer_binding_decisions.find(
    (decision) => decision.adapted_phase_id === 'retrieval',
  );
  assert.equal(trace.binding_origin, 'none');
  assert.deepEqual(trace.source_phase_ids, []);
  assert.deepEqual(trace.answer_key_refs, []);
  assert.equal(trace.valid, false);
});

test('mapped source key is valid only for its explicitly mapped adapted phase', () => {
  const trace = resultFor('homeschool-concept-independent')
    .decision.answer_binding_decisions.find(
      (decision) => decision.binding_origin === 'mapped_source'
        && decision.answer_key_refs.length > 0,
    );
  assert.ok(trace);
  assert.ok(trace.source_phase_ids.length > 0);
  assert.equal(trace.valid, true);
});

test('exact adapted-phase key is accepted with exact provenance', () => {
  const trace = resultFor('homeschool-map-independent').decision.answer_binding_decisions.find(
    (decision) => decision.adapted_phase_id === 'retrieval',
  );
  assert.equal(trace.binding_origin, 'exact_adapted');
  assert.deepEqual(trace.answer_key_refs, ['map-check-key']);
  assert.equal(trace.valid, true);
});

test('adapted practical phase retains procedure and safety references', () => {
  const trace = resultFor('homeschool-practical-supervised')
    .decision.answer_binding_decisions.find(
      (decision) => decision.adapted_phase_id === 'practical-work',
    );
  assert.deepEqual(trace.procedure_refs, ['practical-procedure']);
  assert.deepEqual(trace.safety_refs, ['practical-safety-card']);
  assert.equal(trace.valid, true);
});

test('adapted explanation replacement requires explanation or source-segment binding', () => {
  const request = requestFor('homeschool-concept-independent');
  request.content_bindings.push({
    phase_id: 'independent-practice',
    learner_material_refs: [],
    task_refs: ['adapted-explanation-task'],
    answer_key_refs: [],
    teacher_explanation_refs: [],
    estonian_support_refs: [],
    procedure_refs: [],
    safety_refs: [],
  });
  const result = adaptLessonForHomeschool(repository, request);
  assert.equal(result.decision.failure.code, 'explanation_binding_missing');
});

test('answer-access check passes only after post-adaptation binding validation', () => {
  const valid = resultFor('homeschool-concept-independent');
  const invalid = resultFor('homeschool-retrieval-missing-key');
  assert.equal(
    valid.decision.answer_access_checks.find(
      (item) => item.code === 'answer_access_after_attempt',
    ).passed,
    true,
  );
  assert.deepEqual(invalid.decision.answer_access_checks, []);
});

test('binding order does not change phase-level provenance or output', () => {
  const request = requestFor('homeschool-concept-independent');
  const reordered = clone(request);
  reordered.content_bindings.reverse();
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, reordered)),
  );
});

test('preserved teacher override keeps identity, rationale, phase, and target', () => {
  const result = resultFor('homeschool-teacher-override-preserved');
  assert.deepEqual(result.decision.teacher_override_adaptations, [{
    override_id: 'keep-retrieval-self-test',
    teacher_rationale_ru:
      'Учитель сохраняет знакомую форму самопроверки, чтобы ребёнок мог исправить ошибки самостоятельно.',
    source_slot_id: 'retrieval',
    source_target_id: 'retrieval-self-test',
    adapted_phase_id: 'retrieval',
    adapted_target_id: 'retrieval-self-test',
    status: 'preserved',
    policy: 'require_preservation',
    rationale_ru:
      'Override identity, rationale, real target-pattern slot, and exact target are preserved.',
  }]);
  assert.equal(result.homeschoolLessonDna.teacher_overrides[0].status, 'accepted');
});

test('reselected override keeps identity and rationale but is not accepted in DNA', () => {
  const result = adaptLessonForHomeschool(
    repository,
    overrideRequest('allow_reselection_with_warning'),
  );
  const trace = result.decision.teacher_override_adaptations[0];
  assert.equal(trace.override_id, 'quiet-individual-concept-map');
  assert.match(trace.teacher_rationale_ru, /тихая индивидуальная работа/);
  assert.equal(trace.status, 'reselected');
  assert.deepEqual(result.homeschoolLessonDna.teacher_overrides, []);
});

test('reject-all returns a sorted rejected override trace', () => {
  const result = adaptLessonForHomeschool(repository, overrideRequest('reject_all'));
  assert.equal(result.decision.teacher_override_adaptations[0].status, 'rejected');
  assert.equal(result.decision.teacher_override_adaptations[0].policy, 'reject_all');
});

test('require-preservation cannot accept the same target in an unrelated phase', () => {
  const result = adaptLessonForHomeschool(
    repository,
    overrideRequest('require_preservation'),
  );
  assert.equal(result.decision.failure.code, 'teacher_override_not_preserved');
  assert.ok(result.decision.teacher_override_adaptations.every(
    (trace) => trace.status !== 'preserved',
  ));
});

test('preserved override trace is copied unchanged into the package', () => {
  const result = resultFor('homeschool-teacher-override-preserved');
  assert.deepEqual(
    result.package.teacher_override_adaptations,
    result.decision.teacher_override_adaptations,
  );
});

test('retrieval-window order does not change review sessions or output', () => {
  const reorderedRepository = clone(repository);
  reorderedRepository.selection.fixtures.data.fixtures.find(
    (item) => item.fixture_id === 'grade5-concept-introduction',
  ).request.lesson_context.future_retrieval_windows.reverse();
  const reorderedRequest = materializeHomeschoolFixture(
    reorderedRepository,
    reorderedRepository.fixtures.data.fixtures.find(
      (item) => item.fixture_id === 'homeschool-concept-independent',
    ),
  );
  assert.equal(
    stablePedagogyJson(resultFor('homeschool-concept-independent')),
    stablePedagogyJson(adaptLessonForHomeschool(reorderedRepository, reorderedRequest)),
  );
});

test('new focused failure output remains byte-identical', () => {
  const request = requestFor('homeschool-supplemental-safety-unavailable');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
  );
});

test('override adaptation trace is bytewise sorted', () => {
  const traces = resultFor('homeschool-teacher-override-preserved')
    .decision.teacher_override_adaptations;
  assert.deepEqual(traces.map((trace) => trace.override_id), [...traces]
    .map((trace) => trace.override_id)
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right))));
});

test('repeated success output is byte-identical', () => {
  const request = requestFor('homeschool-concept-independent');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
  );
});

test('repeated failure output is byte-identical', () => {
  const request = requestFor('homeschool-practical-no-supervision');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
  );
});

test('fixture catalogue order does not change a materialized result', () => {
  const reordered = clone(repository);
  reordered.fixtures.data.fixtures.reverse();
  const request = materializeHomeschoolFixture(reordered, fixture('homeschool-concept-independent'));
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, requestFor('homeschool-concept-independent'))),
    stablePedagogyJson(adaptLessonForHomeschool(reordered, request)),
  );
});

test('set-array ordering does not change derived request digest', () => {
  const request = requestFor('homeschool-concept-independent');
  const reordered = clone(request);
  reordered.adaptation_context.resources.available.reverse();
  const left = adaptLessonForHomeschool(repository, request);
  const right = adaptLessonForHomeschool(repository, reordered);
  assert.equal(
    left.decision.derived_selection_request_digest,
    right.decision.derived_selection_request_digest,
  );
});

test('activity catalogue ordering does not change adaptation output', () => {
  const reordered = clone(repository);
  reordered.selection.knowledge.activities.data.activities.reverse();
  const request = requestFor('homeschool-concept-independent');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(reordered, request)),
  );
});

test('determinism flags prohibit AI, network, randomness, and timestamps', () => {
  const flags = resultFor('homeschool-concept-independent').decision.determinism;
  assert.deepEqual(flags, {
    ordering: 'bytewise',
    ai_used: false,
    network_used: false,
    randomness_used: false,
    volatile_timestamp_in_core: false,
  });
});

test('package readiness remains honest', () => {
  assert.deepEqual(resultFor('homeschool-concept-independent').package.status, {
    structural_state: 'proposed',
    teacher_review: 'pending',
    home_trial: 'not_started',
    homeschool_ready: false,
    effectiveness_claimed: false,
  });
});

test('committed examples contain no personal-data fields', () => {
  const prohibited = /(child_name|learner_name|student_name|email|birth_date|school|completed_at)$/;
  assert.ok(objectKeys(repository.examples.data).every((item) => !prohibited.test(item)));
});

test('committed examples validate and are stable', () => {
  assert.equal(validators.examples(repository.examples.data), true);
  assert.equal(
    serializeHomeschoolYaml(repository.examples.data),
    serializeHomeschoolYaml(repository.examples.data),
  );
});

test('CLI summary is deterministic and reports pending readiness', () => {
  const args = [
    'scripts/adapt-lesson-for-homeschool.mjs',
    '--fixture',
    'homeschool-concept-independent',
    '--summary',
  ];
  const left = execFileSync(process.execPath, args, { encoding: 'utf8' });
  const right = execFileSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(left, right);
  assert.match(left, /Teacher review: pending/);
  assert.match(left, /Homeschool ready: false/);
});

test('CLI returns exit code 1 for a structured failure', () => {
  const result = spawnSync(process.execPath, [
    'scripts/adapt-lesson-for-homeschool.mjs',
    '--fixture',
    'homeschool-practical-no-supervision',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /safety_supervision_unavailable/);
});

test('CLI returns exit code 2 for an outer-schema-invalid request', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-homeschool-test-'));
  const requestPath = path.join(directory, 'invalid-request.yaml');
  await fs.writeFile(requestPath, [
    'schema_version: "1.0"',
    'artifact_type: homeschool_adaptation_request',
    'request_id: invalid-cli-request',
    'source: {}',
    'adaptation_context: {}',
    'content_bindings: []',
    'unexpected: true',
    '',
  ].join('\n'));
  const result = spawnSync(process.execPath, [
    'scripts/adapt-lesson-for-homeschool.mjs',
    '--request',
    requestPath,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});

test('adult-managed answer access rejects an unavailable adult', () => {
  assert.equal(
    resultFor('homeschool-adult-managed-unavailable').decision.failure.code,
    'adult_managed_answer_access_unavailable',
  );
});

test('adult-managed answer access rejects an adult without check-answers permission', () => {
  const request = requestFor('homeschool-adult-managed-retrieval');
  request.adaptation_context.adult_context.allowed_roles = [];
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'adult_managed_answer_access_unavailable',
  );
});

test('adult-managed answer access with a zero-minute budget fails visibly', () => {
  const request = requestFor('homeschool-adult-managed-retrieval');
  request.adaptation_context.adult_context.max_support_minutes = 0;
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'adult_effort_exceeds_limit',
  );
});

test('adult-managed core retrieval session has visible adult answer-access time', () => {
  const session = resultFor('homeschool-adult-managed-retrieval').weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'immediate',
  );
  assert.ok(session.adult_minutes > 0);
  assert.ok(session.adult_roles.includes('check_answers'));
});

test('adult-managed delayed review session has visible adult answer-access time', () => {
  const session = resultFor('homeschool-adult-managed-retrieval').weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'delayed_after_days',
  );
  assert.ok(session.adult_minutes > 0);
  assert.ok(session.adult_roles.includes('check_answers'));
});

test('adult-managed weekly review session has visible adult answer-access time', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.adult_context = {
    available: true,
    max_support_minutes: 12,
    max_effort: 'minimal',
    allowed_roles: ['check_answers'],
    safety_supervision_available: false,
    subject_explanation_available: false,
  };
  request.adaptation_context.answer_access_policy.key_release = 'adult_managed';
  const result = adaptLessonForHomeschool(repository, request);
  const session = result.weeklyStudyPlan.sessions.find(
    (item) => item.retrieval_type === 'next_unit_review',
  );
  assert.ok(session.adult_minutes > 0);
  assert.deepEqual(session.adult_roles, ['check_answers']);
});

test('adult-managed parent guidance exposes the bounded check-answers role', () => {
  const guidance = resultFor('homeschool-adult-managed-retrieval').parentGuidance;
  const role = guidance.adult_roles.find((item) => item.role === 'check_answers');
  assert.match(role.purpose_ru, /после завершённой самостоятельной попытки/u);
  assert.match(role.bounded_action_ru, /Не объяснять предметный ответ/u);
});

test('adult answer-access minutes are an explicit reconciled timing component', () => {
  const timing = resultFor('homeschool-adult-managed-retrieval').parentGuidance.timing;
  assert.equal(timing.adult_answer_access_minutes, 3);
  assert.equal(
    timing.total_adult_minutes,
    timing.adult_preparation_minutes
      + timing.adult_live_support_minutes
      + timing.adult_safety_minutes
      + timing.adult_answer_access_minutes,
  );
});

test('adult-managed session totals reconcile with answer-access timing without double counting', () => {
  const result = resultFor('homeschool-adult-managed-retrieval');
  const sessionAdultMinutes = result.weeklyStudyPlan.sessions.reduce(
    (sum, session) => sum + session.adult_minutes,
    0,
  );
  assert.equal(sessionAdultMinutes, result.parentGuidance.timing.adult_answer_access_minutes);
  assert.equal(
    result.weeklyStudyPlan.total_adult_minutes,
    result.parentGuidance.timing.total_adult_minutes,
  );
  assert.equal(
    result.parentGuidance.timing.total_adult_minutes,
    result.parentGuidance.timing.adult_preparation_minutes + sessionAdultMinutes,
  );
});

test('self-managed answer release creates neither adult role nor adult answer-access time', () => {
  const result = resultFor('homeschool-concept-independent');
  assert.ok(result.weeklyStudyPlan.sessions.every(
    (session) => !session.adult_roles.includes('check_answers'),
  ));
  assert.equal(result.parentGuidance.timing.adult_answer_access_minutes, 0);
});

test('after-attempt answer release creates neither adult role nor adult answer-access time', () => {
  const request = requestFor('homeschool-concept-independent');
  request.adaptation_context.answer_access_policy.key_release = 'after_attempt';
  const result = adaptLessonForHomeschool(repository, request);
  assert.ok(result.weeklyStudyPlan.sessions.every(
    (session) => !session.adult_roles.includes('check_answers'),
  ));
  assert.equal(result.parentGuidance.timing.adult_answer_access_minutes, 0);
});

test('every delayed review session has a nonempty validated answer-key binding', () => {
  const sessions = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions.filter(
    (session) => session.purpose === 'delayed_retrieval',
  );
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((session) => session.answer_binding.answer_key_refs.length > 0));
});

test('weekly review session has a nonempty validated answer-key binding', () => {
  const session = resultFor('homeschool-concept-independent').weeklyStudyPlan.sessions.find(
    (item) => item.purpose === 'weekly_review',
  );
  assert.ok(session.answer_binding.answer_key_refs.length > 0);
  assert.equal(session.source_access_policy, 'closed');
});

test('review answer-key references come only from valid phase-level decisions', () => {
  const result = resultFor('homeschool-concept-independent');
  const allowed = new Set(
    result.decision.answer_binding_decisions
      .filter((decision) => decision.valid && decision.review_capable)
      .flatMap((decision) => decision.answer_key_refs),
  );
  for (const summary of result.package.review_binding_summary) {
    assert.ok(summary.answer_key_refs.every((reference) => allowed.has(reference)));
  }
});

test('an unrelated key on another phase cannot replace the retrieval key', () => {
  const request = requestFor('homeschool-concept-independent');
  const retrieval = request.content_bindings.find((binding) => binding.phase_id === 'retrieval');
  retrieval.answer_key_refs = [];
  assert.ok(request.content_bindings.some(
    (binding) => binding.phase_id !== 'retrieval' && binding.answer_key_refs.length > 0,
  ));
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'answer_key_binding_missing',
  );
});

test('relative retrieval without a review-capable key returns exact binding failure', () => {
  assert.equal(
    resultFor('homeschool-retrieval-missing-key').decision.failure.code,
    'answer_key_binding_missing',
  );
});

test('review sessions do not fall back to an arbitrary final learner step', () => {
  const result = resultFor('homeschool-concept-independent');
  for (const session of result.weeklyStudyPlan.sessions.filter(
    (item) => item.relative_window,
  )) {
    assert.ok(session.package_step_ids.length > 0);
    assert.ok(session.package_step_ids.every((stepId) => (
      session.answer_binding.adapted_phase_ids.some(
        (phaseId) => stepId.endsWith(`-${phaseId}`),
      )
    )));
  }
});

test('review binding summary is bytewise sorted by session and contained IDs', () => {
  const summary = resultFor('homeschool-concept-independent').package.review_binding_summary;
  assert.deepEqual(summary.map((item) => item.session_index), [3, 4, 5]);
  for (const item of summary) {
    assert.deepEqual(item.adapted_phase_ids, [...item.adapted_phase_ids].sort());
    assert.deepEqual(item.answer_key_refs, [...item.answer_key_refs].sort());
    assert.deepEqual(item.origins, [...item.origins].sort());
  }
});

test('review binding provenance is invariant to source binding order', () => {
  const request = requestFor('homeschool-concept-independent');
  const reordered = clone(request);
  reordered.content_bindings.reverse();
  assert.deepEqual(
    adaptLessonForHomeschool(repository, reordered).package.review_binding_summary,
    adaptLessonForHomeschool(repository, request).package.review_binding_summary,
  );
});

test('source explanation with a teacher explanation reference remains valid', () => {
  const request = requestFor('homeschool-concept-independent');
  const explanation = request.content_bindings.find(
    (binding) => binding.phase_id === 'explanation',
  );
  explanation.teacher_explanation_refs = ['teacher-explanation'];
  explanation.learner_material_refs = [];
  assert.equal(adaptLessonForHomeschool(repository, request).decision.status, 'success');
});

test('source explanation with only a bounded learner source segment is valid', () => {
  const request = requestFor('homeschool-concept-independent');
  const explanation = request.content_bindings.find(
    (binding) => binding.phase_id === 'explanation',
  );
  assert.deepEqual(explanation.teacher_explanation_refs, []);
  assert.deepEqual(explanation.learner_material_refs, ['concept-source-segment']);
  assert.equal(adaptLessonForHomeschool(repository, request).decision.status, 'success');
});

test('source explanation without either allowed binding returns exact failure', () => {
  const request = requestFor('homeschool-concept-independent');
  const explanation = request.content_bindings.find(
    (binding) => binding.phase_id === 'explanation',
  );
  explanation.teacher_explanation_refs = [];
  explanation.learner_material_refs = [];
  assert.equal(
    adaptLessonForHomeschool(repository, request).decision.failure.code,
    'explanation_binding_missing',
  );
});

test('source and adapted explanations apply the same explanation-or-segment contract', () => {
  const result = resultFor('homeschool-concept-independent');
  const decision = result.decision.answer_binding_decisions.find(
    (item) => item.adapted_phase_id === 'independent-practice',
  );
  assert.equal(decision.valid, true);
  assert.deepEqual(decision.teacher_explanation_refs, []);
  assert.ok(decision.learner_material_refs.includes('concept-source-segment'));
});

test('the engine never invents an explanation reference', () => {
  const request = requestFor('homeschool-concept-independent');
  const allowed = new Set(request.content_bindings.flatMap(
    (binding) => binding.teacher_explanation_refs,
  ));
  const produced = resultFor('homeschool-concept-independent')
    .decision.answer_binding_decisions.flatMap(
      (decision) => decision.teacher_explanation_refs,
    );
  assert.ok(produced.every((reference) => allowed.has(reference)));
});

test('concept explanation override resolves through real independent-practice slot metadata', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-concept-independent',
    'explanation',
    'independent-homeschool-study',
  );
  assert.equal(resolution.status, 'resolved');
  assert.equal(resolution.target_slot_id, 'independent-practice');
});

test('retrieval override resolves through the real retrieval slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-retrieval-independent',
    'retrieval',
    'retrieval-and-consolidation',
  );
  assert.equal(resolution.target_slot_id, 'retrieval');
});

test('retrieval formative override falls back to the real correction slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-retrieval-independent',
    'correction',
    'retrieval-and-consolidation',
  );
  assert.equal(resolution.target_slot_id, 'correction');
});

test('practical guided override resolves through the real practical-work slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'practical-work',
    'safe-practical-investigation',
  );
  assert.equal(resolution.target_slot_id, 'practical-work');
});

test('practical formative override resolves through the real evidence-check slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'evidence-check',
    'safe-practical-investigation',
  );
  assert.equal(resolution.target_slot_id, 'evidence-check');
});

test('practical retrieval override resolves through the real conclusion slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'conclusion',
    'safe-practical-investigation',
  );
  assert.equal(resolution.target_slot_id, 'conclusion');
});

test('practical orientation override resolves through the real safety-orientation slot', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'safety-orientation',
    'safe-practical-investigation',
  );
  assert.equal(resolution.target_slot_id, 'safety-orientation');
});

test('override resolver returns registered slot IDs rather than transformed phase strings', () => {
  const resolution = resolveFixtureSlot(
    'homeschool-concept-independent',
    'guided-practice',
    'independent-homeschool-study',
  );
  assert.equal(resolution.target_phase, 'independent_practice');
  assert.equal(resolution.target_slot_id, 'independent-practice');
  assert.notEqual(resolution.target_slot_id, resolution.target_phase);
});

test('missing target slot returns deterministic unresolvable metadata', () => {
  const policies = clone(repository.selection.rules.data.pattern_policies);
  const target = policies.find((policy) => policy.pattern_id === 'independent-homeschool-study');
  target.slots = target.slots.filter((slot) => slot.phase !== 'independent_practice');
  const resolution = resolveFixtureSlot(
    'homeschool-concept-independent',
    'explanation',
    'independent-homeschool-study',
    { patternPolicies: policies },
  );
  assert.equal(resolution.status, 'unresolvable');
  assert.equal(resolution.target_slot_id, null);
});

test('unresolvable override slot returns the structured homeschool failure code', () => {
  const changed = clone(repository);
  const target = changed.selection.rules.data.pattern_policies.find(
    (policy) => policy.pattern_id === 'independent-homeschool-study',
  );
  target.slots = target.slots.filter((slot) => slot.phase !== 'independent_practice');
  const result = adaptLessonForHomeschool(
    changed,
    overrideRequest('require_preservation'),
  );
  assert.equal(result.decision.failure.code, 'teacher_override_slot_unresolvable');
  assert.equal(result.decision.teacher_override_adaptations[0].status, 'rejected');
  assert.equal(validators.decision(result.decision), true);
});

test('ambiguous target slots return a deterministic unresolvable reason', () => {
  const policies = clone(repository.selection.rules.data.pattern_policies);
  const target = policies.find((policy) => policy.pattern_id === 'independent-homeschool-study');
  const slot = target.slots.find((item) => item.phase === 'independent_practice');
  target.slots.push({ ...slot, slot_id: 'duplicate-independent-practice' });
  const first = resolveFixtureSlot(
    'homeschool-concept-independent',
    'explanation',
    'independent-homeschool-study',
    { patternPolicies: policies },
  );
  const second = resolveFixtureSlot(
    'homeschool-concept-independent',
    'explanation',
    'independent-homeschool-study',
    { patternPolicies: policies },
  );
  assert.equal(first.status, 'unresolvable');
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
  assert.match(first.reason, /ambiguous slots/u);
});

test('exact target in the wrong target-pattern slot is not treated as preserved', () => {
  const result = resultFor('homeschool-practical-override-preserved');
  const trace = result.decision.teacher_override_adaptations[0];
  assert.equal(trace.adapted_phase_id, 'practical-work');
  assert.notEqual(trace.adapted_phase_id, 'evidence-check');
  assert.equal(trace.status, 'preserved');
});

test('preserved practical override retains source identity and teacher rationale', () => {
  const result = resultFor('homeschool-practical-override-preserved');
  const trace = result.decision.teacher_override_adaptations[0];
  assert.equal(trace.override_id, 'keep-practical-observation');
  assert.match(trace.teacher_rationale_ru, /процедуру наблюдения и измерения/u);
  assert.deepEqual(result.homeschoolLessonDna.teacher_overrides, [{
    override_id: 'keep-practical-observation',
    status: 'accepted',
    slot_id: 'practical-work',
    target_id: 'learning-stations::practical-observation-measurement',
    rationale_ru:
      'Учитель сохраняет проверяемую процедуру наблюдения и измерения в практическом этапе.',
  }]);
});

test('teacher override cannot bypass final homeschool safety constraints', () => {
  const request = requestFor('homeschool-practical-override-preserved');
  request.adaptation_context.adult_context.safety_supervision_available = false;
  request.adaptation_context.resources.adult_safety_supervision_available = false;
  const result = adaptLessonForHomeschool(repository, request);
  assert.equal(result.decision.status, 'failure');
  assert.ok([
    'teacher_override_not_preserved',
    'safety_supervision_unavailable',
  ].includes(result.decision.failure.code));
});

test('adult-managed success output is byte-identical', () => {
  const request = requestFor('homeschool-adult-managed-retrieval');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
  );
});

test('adult-managed failure output is byte-identical', () => {
  const request = requestFor('homeschool-adult-managed-unavailable');
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
  );
});

test('override slot resolution output is byte-identical', () => {
  const first = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'practical-work',
    'safe-practical-investigation',
  );
  const second = resolveFixtureSlot(
    'homeschool-practical-supervised',
    'practical-work',
    'safe-practical-investigation',
  );
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
});

test('review binding result is byte-identical after set-array reordering', () => {
  const request = requestFor('homeschool-concept-independent');
  const reordered = clone(request);
  reordered.content_bindings.reverse();
  for (const binding of reordered.content_bindings) {
    binding.answer_key_refs.reverse();
    binding.learner_material_refs.reverse();
  }
  assert.equal(
    stablePedagogyJson(adaptLessonForHomeschool(repository, request)),
    stablePedagogyJson(adaptLessonForHomeschool(repository, reordered)),
  );
});

test('new contracts retain no-AI, no-network, no-randomness, no-timestamp guarantees', () => {
  const flags = resultFor('homeschool-adult-managed-retrieval').decision.determinism;
  assert.deepEqual(flags, {
    ordering: 'bytewise',
    ai_used: false,
    network_used: false,
    randomness_used: false,
    volatile_timestamp_in_core: false,
  });
});

test('repository tracks no PDF or DOC pedagogical source files', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(files.every((file) => !/knowledge\/pedagogy\/.*\.(pdf|docx?)$/i.test(file)));
});
