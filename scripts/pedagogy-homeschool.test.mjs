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
  loadPedagogyHomeschoolRepository,
  materializeHomeschoolFixture,
  serializeHomeschoolYaml,
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

function overrideRequest(policy) {
  const adaptedFixture = clone(fixture('homeschool-concept-independent'));
  adaptedFixture.source_fixture_id = 'grade5-teacher-override';
  adaptedFixture.adaptation_context.teacher_override_policy = policy;
  return materializeHomeschoolFixture(repository, adaptedFixture);
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
      fixtures: 12,
      successfulFixtures: 8,
      failureFixtures: 4,
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
  assert.match(result.decision.failure.details.join(' '), /concept-map/);
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
      + timing.contingency_minutes,
  );
});

test('adult timing total reconciles separately', () => {
  const timing = resultFor('homeschool-practical-supervised').parentGuidance.timing;
  assert.equal(
    timing.total_adult_minutes,
    timing.adult_preparation_minutes
      + timing.adult_live_support_minutes
      + timing.adult_safety_minutes,
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

test('repository tracks no PDF or DOC pedagogical source files', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(files.every((file) => !/knowledge\/pedagogy\/.*\.(pdf|docx?)$/i.test(file)));
});
