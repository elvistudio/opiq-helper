import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  computeActivityCatalogSelectionDigest,
  createPedagogySelectionValidators,
  loadPedagogySelectionRepository,
  normalizePedagogySelectionRequest,
  selectLessonPedagogy,
  stablePedagogyJson,
  validateEstonianSupportState,
  validateLearnerContextState,
  validateTeacherOverrideSet,
  validatePedagogySelection,
} from './lib/pedagogy-selection.mjs';

const repository = await loadPedagogySelectionRepository();
const validators = createPedagogySelectionValidators(repository);

function fixture(id) {
  return repository.fixtures.data.fixtures.find((item) => item.fixture_id === id);
}

function request(id) {
  return structuredClone(fixture(id).request);
}

function run(id, mutate = () => {}) {
  const selectedRequest = request(id);
  mutate(selectedRequest);
  return selectLessonPedagogy(repository, selectedRequest);
}

function selectedIds(result) {
  return result.decision.slot_decisions.map((slot) => slot.selected_target_id).filter(Boolean);
}

function candidate(result, targetId) {
  const rows = result.decision.slot_decisions
    .flatMap((slot) => slot.considered_candidates)
    .filter((item) => item.target_id === targetId);
  return rows.find((item) => item.score)
    ?? rows.find((item) => item.hard_filter_reasons.some(
      (reason) => reason.includes('no requested group format'),
    ))
    ?? rows[0];
}

function allScoreComponents(result) {
  return result.decision.slot_decisions.flatMap((slot) => (
    slot.considered_candidates.flatMap((item) => (
      item.score ? Object.keys(item.score.components) : []
    ))
  ));
}

test('production selection repository validates', () => {
  const result = validatePedagogySelection(repository);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.deepEqual(result.counts, {
    patterns: 4,
    targets: 35,
    fixtures: 12,
    examples: 4,
    successfulFixtures: 10,
    failureFixtures: 2,
  });
});

for (const schemaName of ['rules', 'request', 'decision', 'lessonDna', 'fixtures', 'examples']) {
  test(`${schemaName} schema compiles in strict Ajv mode`, () => {
    assert.equal(typeof validators[schemaName], 'function');
  });
}

for (const fixtureId of [
  'grade5-concept-introduction',
  'grade5-independent-retrieval',
  'grade5-map-diagram',
  'grade5-oral-answer',
  'grade5-practical-no-supervision',
  'grade5-practical-override-preservable',
  'grade5-retrieval-correction',
  'grade5-retrieval-override-preservable',
  'grade5-russian-only-concept-introduction',
  'grade5-safe-practical',
  'grade5-teacher-override',
  'grade5-unsafe-override',
]) {
  test(`${fixtureId} matches its committed deterministic expectation`, () => {
    const item = fixture(fixtureId);
    const result = selectLessonPedagogy(repository, item.request);
    assert.equal(result.decision.status, item.expected.status);
    assert.equal(result.decision.selected_pattern?.pattern_id ?? null, item.expected.pattern_id);
    assert.equal(result.decision.failure?.code ?? null, item.expected.failure_code);
    for (const targetId of item.expected.include_target_ids) {
      assert.ok(selectedIds(result).includes(targetId), `missing ${targetId}`);
    }
    for (const targetId of item.expected.exclude_target_ids) {
      assert.ok(!selectedIds(result).includes(targetId), `unexpected ${targetId}`);
    }
  });
}

test('all generated lesson DNA examples keep honest readiness states', () => {
  for (const example of repository.examples.data.examples) {
    assert.equal(example.status.structural_state, 'proposed');
    assert.equal(example.status.teacher_review, 'pending');
    assert.equal(example.status.classroom_trial, 'not_started');
    assert.equal(example.status.classroom_ready, false);
    assert.equal(example.status.effectiveness_claimed, false);
  }
});

test('selection results persist all version identities and digests', () => {
  const result = run('grade5-concept-introduction');
  assert.deepEqual(
    {
      taxonomy: result.decision.versions.taxonomy,
      selectionRules: result.decision.versions.selection_rules,
      lessonDna: result.decision.versions.lesson_dna_schema,
      engine: result.decision.versions.engine,
    },
    { taxonomy: '1.0', selectionRules: '1.0', lessonDna: '1.0', engine: '1.1' },
  );
  assert.match(result.decision.versions.activity_catalog_digest, /^[0-9a-f]{64}$/u);
  assert.match(result.decision.request_digest, /^[0-9a-f]{64}$/u);
});

test('the same request produces byte-identical decision and DNA', () => {
  const first = run('grade5-concept-introduction');
  const second = run('grade5-concept-introduction');
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
});

test('request set-array order does not affect result or request digest', () => {
  const original = request('grade5-concept-introduction');
  const reordered = structuredClone(original);
  reordered.lesson_context.content_types.reverse();
  reordered.lesson_context.required_capabilities.reverse();
  reordered.lesson_context.desired_capabilities.reverse();
  reordered.learner_context.supported_group_formats.reverse();
  reordered.resources.available.reverse();
  reordered.preferences.preferred_group_formats.reverse();
  const first = selectLessonPedagogy(repository, original);
  const second = selectLessonPedagogy(repository, reordered);
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
});

test('request normalization sorts set arrays without changing phase semantics', () => {
  const raw = request('grade5-map-diagram');
  raw.resources.available.reverse();
  const normalized = normalizePedagogySelectionRequest(raw);
  assert.deepEqual(normalized.resources.available, [...normalized.resources.available].sort());
  assert.deepEqual(normalized.lesson_context.future_retrieval_windows, []);
});

test('activity record order does not affect the catalog digest or selection', () => {
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.reverse();
  assert.equal(
    computeActivityCatalogSelectionDigest(changed.knowledge.activities.data.activities),
    computeActivityCatalogSelectionDigest(repository.knowledge.activities.data.activities),
  );
  assert.equal(
    stablePedagogyJson(selectLessonPedagogy(changed, request('grade5-map-diagram'))),
    stablePedagogyJson(run('grade5-map-diagram')),
  );
});

test('irrelevant activity prose does not alter operational selection identity', () => {
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities[0].short_description_ru += ' Тестовое уточнение.';
  assert.equal(
    computeActivityCatalogSelectionDigest(changed.knowledge.activities.data.activities),
    computeActivityCatalogSelectionDigest(repository.knowledge.activities.data.activities),
  );
  assert.equal(
    stablePedagogyJson(selectLessonPedagogy(changed, request('grade5-concept-introduction'))),
    stablePedagogyJson(run('grade5-concept-introduction')),
  );
});

test('relevant resource metadata changes catalog identity and selection predictably', () => {
  const changed = structuredClone(repository);
  const guided = changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'guided-reading',
  );
  guided.resource_requirements.required.push('internet');
  guided.resource_requirements.required.sort();
  guided.resource_requirements.internet_required = true;
  assert.notEqual(
    computeActivityCatalogSelectionDigest(changed.knowledge.activities.data.activities),
    computeActivityCatalogSelectionDigest(repository.knowledge.activities.data.activities),
  );
  const result = selectLessonPedagogy(changed, request('grade5-concept-introduction'));
  assert.ok(!selectedIds(result).includes('guided-reading'));
});

test('deterministic core contains no volatile timestamp', () => {
  const result = run('grade5-concept-introduction');
  assert.equal(result.decision.determinism.volatile_timestamp_in_core, false);
  assert.ok(!stablePedagogyJson(result).includes('generated_at'));
});

test('zeroed score ties remain deterministic and use bytewise signatures', () => {
  const changed = structuredClone(repository);
  for (const key of Object.keys(changed.rules.data.scoring.weights)) {
    changed.rules.data.scoring.weights[key] = 0;
  }
  for (const key of Object.keys(changed.rules.data.scoring.penalties)) {
    changed.rules.data.scoring.penalties[key] = 0;
  }
  const first = selectLessonPedagogy(changed, request('grade5-map-diagram'));
  const second = selectLessonPedagogy(changed, request('grade5-map-diagram'));
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
});

test('rule weights, penalties, and scoring thresholds are data-versioned rather than hidden', () => {
  assert.equal(repository.rules.data.selection_rules_version, '1.0');
  assert.ok(Object.keys(repository.rules.data.scoring.weights).length >= 18);
  assert.ok(Object.keys(repository.rules.data.scoring.penalties).length >= 4);
  assert.equal(
    repository.rules.data.scoring.parameters.resource_simplicity_required_resource_ceiling,
    5,
  );
});

test('primary required capability scores above supporting', () => {
  const result = run('grade5-retrieval-correction');
  const retrievalSlot = result.decision.slot_decisions.find((slot) => slot.slot_id === 'retrieval');
  const selfTest = retrievalSlot.considered_candidates.find((item) => item.target_id === 'retrieval-self-test');
  const conceptMap = retrievalSlot.considered_candidates.find((item) => item.target_id === 'concept-map');
  assert.ok(selfTest.score.components.required_retrieval > conceptMap.score.components.required_retrieval);
});

test('required capability weight exceeds desired capability weight', () => {
  const weights = repository.rules.data.scoring.weights;
  assert.ok(weights.required_capability_primary > weights.desired_capability_primary);
  assert.ok(weights.required_capability_supporting > weights.desired_capability_supporting);
});

test('versioned delivery scoring orders direct above adaptable above limited', () => {
  const { weights, penalties } = repository.rules.data.scoring;
  assert.ok(weights.direct_delivery_fit > weights.adaptable_delivery_fit);
  assert.ok(weights.adaptable_delivery_fit > penalties.limited_delivery_fit);
  assert.ok(penalties.limited_delivery_fit < 0);
});

test('preferred target contributes an explicit score component', () => {
  const result = run('grade5-concept-introduction');
  const guided = candidate(result, 'guided-reading');
  assert.equal(
    guided.score.components.preferred_target,
    repository.rules.data.scoring.weights.preferred_target,
  );
});

test('recent target receives only the documented repetition penalty', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.avoid_recent_target_ids = ['guided-reading'];
  });
  const guided = candidate(result, 'guided-reading');
  assert.equal(
    guided.score.components.recent_target,
    repository.rules.data.scoring.penalties.recent_target,
  );
});

test('every score trace total equals the visible integer components', () => {
  const result = run('grade5-concept-introduction');
  for (const slot of result.decision.slot_decisions) {
    for (const item of slot.considered_candidates.filter((entry) => entry.score)) {
      assert.equal(
        item.score.total,
        Object.values(item.score.components).reduce((total, value) => total + value, 0),
      );
    }
  }
});

test('direct delivery fit receives only the direct delivery component', () => {
  const row = candidate(run('grade5-concept-introduction'), 'guided-reading');
  assert.equal(row.operational_fit.delivery_fit, 'directly_supported');
  assert.equal(
    row.score.components.direct_delivery_fit,
    repository.rules.data.scoring.weights.direct_delivery_fit,
  );
  assert.equal(row.score.components.adaptable_delivery_fit, undefined);
  assert.equal(row.score.components.limited_delivery_fit, undefined);
});

test('adaptable delivery fit receives the smaller adaptable component', () => {
  const row = candidate(run('grade5-concept-introduction'), 'concept-map');
  assert.equal(row.operational_fit.delivery_fit, 'adaptable');
  assert.equal(
    row.score.components.adaptable_delivery_fit,
    repository.rules.data.scoring.weights.adaptable_delivery_fit,
  );
  assert.equal(row.score.components.direct_delivery_fit, undefined);
});

test('limited delivery fit receives only the documented penalty', () => {
  const row = candidate(run('grade5-concept-introduction'), 'retrieval-self-test');
  assert.equal(row.operational_fit.delivery_fit, 'limited');
  assert.equal(
    row.score.components.limited_delivery_fit,
    repository.rules.data.scoring.penalties.limited_delivery_fit,
  );
  assert.equal(row.score.components.direct_delivery_fit, undefined);
  assert.equal(row.score.components.adaptable_delivery_fit, undefined);
});

test('not-recommended effective delivery fit is a hard rejection', () => {
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'concept-map',
  ).compatibility.large_class = 'not_recommended';
  const result = selectLessonPedagogy(changed, request('grade5-concept-introduction'));
  const row = candidate(result, 'concept-map');
  assert.equal(row.hard_filter_passed, false);
  assert.equal(row.operational_fit.delivery_fit, 'not_recommended');
  assert.ok(row.hard_filter_reasons.includes(
    'effective delivery fit not_recommended is not allowed',
  ));
});

test('direct fit scores above adaptable fit when the same target metadata is otherwise equal', () => {
  const adaptable = candidate(run('grade5-concept-introduction'), 'concept-map');
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'concept-map',
  ).compatibility.large_class = 'directly_supported';
  const direct = candidate(
    selectLessonPedagogy(changed, request('grade5-concept-introduction')),
    'concept-map',
  );
  assert.equal(
    direct.score.total - adaptable.score.total,
    repository.rules.data.scoring.weights.direct_delivery_fit
      - repository.rules.data.scoring.weights.adaptable_delivery_fit,
  );
});

test('candidate trace exposes every effective delivery dimension', () => {
  const row = candidate(run('grade5-concept-introduction'), 'concept-map');
  assert.deepEqual(row.operational_fit.delivery_dimensions, [
    { dimension: 'declared_delivery_mode', fit: 'directly_supported' },
    { dimension: 'large_class', fit: 'adaptable' },
  ]);
});

test('individual-study delivery fit includes one-learner compatibility', () => {
  const row = candidate(run('grade5-independent-retrieval'), 'retrieval-self-test');
  assert.ok(row.operational_fit.delivery_dimensions.some(
    (item) => item.dimension === 'one_learner' && item.fit === 'directly_supported',
  ));
});

test('selection engine exposes the corrected 1.1 group-compatibility semantics', () => {
  assert.equal(repository.rules.data.engine_version, '1.1');
});

test('individual study semantically rejects a group of two learners', () => {
  const selectedRequest = request('grade5-independent-retrieval');
  selectedRequest.learner_context.group_size = 2;
  assert.deepEqual(validateLearnerContextState(selectedRequest), {
    valid: false,
    diagnostics: ['individual_study requires group_size 1'],
  });
  assert.equal(validators.request(selectedRequest), false);
});

test('collaborative study semantically rejects one learner', () => {
  const selectedRequest = request('grade5-independent-retrieval');
  selectedRequest.learner_context.study_context = 'collaborative_study';
  assert.deepEqual(validateLearnerContextState(selectedRequest), {
    valid: false,
    diagnostics: ['collaborative_study requires group_size at least 2'],
  });
  assert.equal(validators.request(selectedRequest), false);
});

test('collaborative study accepts a real pair', () => {
  const selectedRequest = request('grade5-independent-retrieval');
  selectedRequest.learner_context.study_context = 'collaborative_study';
  selectedRequest.learner_context.delivery_mode = 'remote';
  selectedRequest.learner_context.group_size = 2;
  selectedRequest.learner_context.supported_group_formats = ['pair'];
  assert.deepEqual(validateLearnerContextState(selectedRequest), {
    valid: true,
    diagnostics: [],
  });
  assert.equal(validators.request(selectedRequest), true);
});

test('remote delivery fit uses the remote-delivery compatibility dimension', () => {
  const changed = structuredClone(repository);
  changed.knowledge.patterns.find(
    (artifact) => artifact.data.patterns.some(
      (pattern) => pattern.pattern_id === 'independent-homeschool-study',
    ),
  ).data.patterns.find(
    (pattern) => pattern.pattern_id === 'independent-homeschool-study',
  ).delivery_modes.push('remote');
  const selectedRequest = request('grade5-independent-retrieval');
  selectedRequest.learner_context.delivery_mode = 'remote';
  const row = candidate(
    selectLessonPedagogy(changed, selectedRequest),
    'retrieval-self-test',
  );
  assert.ok(row.operational_fit.delivery_dimensions.some(
    (item) => item.dimension === 'remote_delivery',
  ));
});

test('homeschool delivery fit maps homeschool-adaptation status through versioned rules', () => {
  const selectedRequest = request('grade5-independent-retrieval');
  selectedRequest.learner_context.delivery_mode = 'homeschool';
  const row = candidate(selectLessonPedagogy(repository, selectedRequest), 'retrieval-self-test');
  const activity = repository.knowledge.activities.data.activities.find(
    (item) => item.activity_id === 'retrieval-self-test',
  );
  const expected = repository.rules.data.delivery_fit.homeschool_status_mapping[
    activity.homeschool_adaptation.status
  ];
  assert.ok(row.operational_fit.delivery_dimensions.some(
    (item) => item.dimension === 'homeschool_adaptation' && item.fit === expected,
  ));
});

test('preferred group format receives the versioned preference bonus', () => {
  const row = candidate(run('grade5-concept-introduction'), 'brainstorming');
  assert.deepEqual(row.operational_fit.group_format_selection, {
    selected: 'individual',
    preferred: true,
    fallback_used: false,
  });
  assert.equal(
    row.score.components.preferred_group_format_fit,
    repository.rules.data.scoring.weights.preferred_group_format_fit,
  );
});

test('valid fallback group format receives no preference bonus', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.preferred_group_formats = [];
  });
  const row = candidate(result, 'brainstorming');
  assert.deepEqual(row.operational_fit.group_format_selection, {
    selected: 'individual',
    preferred: false,
    fallback_used: true,
  });
  assert.equal(row.score.components.preferred_group_format_fit, undefined);
});

test('changing the preferred-format set changes the selected format predictably', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.preferred_group_formats = ['pair'];
  });
  const row = candidate(result, 'brainstorming');
  assert.equal(row.operational_fit.group_format_selection.selected, 'pair');
  assert.equal(row.operational_fit.group_format_selection.preferred, true);
});

test('legacy unconditional group-format score is absent from every trace', () => {
  const result = run('grade5-concept-introduction');
  for (const slot of result.decision.slot_decisions) {
    for (const row of slot.considered_candidates.filter((item) => item.score)) {
      assert.equal(row.score.components.group_format_fit, undefined);
    }
  }
});

test('unknown score components fail strict decision validation', () => {
  const decision = structuredClone(run('grade5-concept-introduction').decision);
  const row = decision.slot_decisions[0].considered_candidates.find((item) => item.score);
  row.score.components.hidden_bonus = 99;
  row.score.total += 99;
  assert.equal(validators.decision(decision), false);
});

test('grade mismatch is a hard-filter reason', () => {
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'guided-reading',
  ).suitable_grades.max = 4;
  const result = selectLessonPedagogy(changed, request('grade5-concept-introduction'));
  const row = candidate(result, 'guided-reading');
  assert.equal(row.hard_filter_passed, false);
  assert.ok(row.hard_filter_reasons.some((reason) => reason.includes('grade 5 outside')));
});

test('unsupported subject returns no-pattern structured failure', () => {
  const result = run('grade5-safe-practical', (selectedRequest) => {
    selectedRequest.learner_context.subject = 'music';
  });
  assert.equal(result.decision.status, 'failure');
  assert.equal(result.decision.failure.code, 'no_pattern_match');
});

test('explicitly unavailable required resource is a hard constraint', () => {
  const result = run('grade5-map-diagram', (selectedRequest) => {
    selectedRequest.lesson_context.required_capabilities = ['guided_practice'];
    selectedRequest.resources.available =
      selectedRequest.resources.available.filter((resource) => resource !== 'dataset');
    selectedRequest.resources.unavailable.push('dataset');
    selectedRequest.resources.adult_safety_supervision_available = true;
  });
  const mapRows = result.decision.slot_decisions
    .flatMap((slot) => slot.considered_candidates)
    .filter((item) => item.target_id === 'learning-stations::map-data');
  assert.ok(mapRows.some((row) => row.hard_filter_reasons.some(
    (reason) => reason.includes('dataset'),
  )));
});

test('printer requirement is enforced when a target declares it', () => {
  const changed = structuredClone(repository);
  const guided = changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'guided-reading',
  );
  guided.resource_requirements.required.push('printed_worksheet');
  guided.resource_requirements.required.sort();
  guided.resource_requirements.printer_required = true;
  const result = selectLessonPedagogy(changed, request('grade5-concept-introduction'));
  const guidedTrace = candidate(result, 'guided-reading');
  assert.ok(guidedTrace.hard_filter_reasons.includes('printer is required but unavailable'));
});

test('internet requirement is enforced when a target declares it', () => {
  const changed = structuredClone(repository);
  const guided = changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'guided-reading',
  );
  guided.resource_requirements.required.push('internet');
  guided.resource_requirements.required.sort();
  guided.resource_requirements.internet_required = true;
  const result = selectLessonPedagogy(changed, request('grade5-concept-introduction'));
  const guidedTrace = candidate(result, 'guided-reading');
  assert.ok(guidedTrace.hard_filter_reasons.includes('internet is required but unavailable'));
});

test('pair-only target cannot satisfy an individual-only request', () => {
  const result = run('grade5-map-diagram', (selectedRequest) => {
    selectedRequest.learner_context.supported_group_formats = ['individual'];
    selectedRequest.language_profile.maximum_total_productive_language_demand = 'high';
  });
  const row = candidate(result, 'back-to-back-description');
  assert.ok(row.hard_filter_reasons.includes('no requested group format is compatible with the execution range'));
});

test('schema rejects impossible group size', () => {
  const invalid = request('grade5-map-diagram');
  invalid.learner_context.group_size = 0;
  assert.equal(validators.request(invalid), false);
});

test('duration overflow returns a structured failure', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.learner_context.lesson_duration_minutes = 10;
  });
  assert.equal(result.decision.status, 'failure');
  assert.equal(result.decision.failure.code, 'duration_overflow');
});

test('high productive-language target is rejected under the medium total-demand ceiling', () => {
  const result = run('grade5-concept-introduction');
  const row = candidate(result, 'self-explanation');
  assert.ok(row.hard_filter_reasons.some(
    (reason) => reason.includes('total productive-language demand high'),
  ));
});

test('legacy Estonian-nested total-demand field is rejected by the request schema', () => {
  const invalid = request('grade5-concept-introduction');
  delete invalid.language_profile.maximum_total_productive_language_demand;
  invalid.language_profile.estonian_support.maximum_productive_language_demand = 'medium';
  assert.equal(validators.request(invalid), false);
});

test('high total productive-language demand is allowed when the total ceiling is high', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.language_profile.maximum_total_productive_language_demand = 'high';
  });
  const row = candidate(result, 'self-explanation');
  assert.ok(!row.hard_filter_reasons.some(
    (reason) => reason.includes('total productive-language demand'),
  ));
});

test('Estonian A1-A2 compatibility is enforced separately from total demand', () => {
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'self-explanation',
  ).learner_demands.estonian_a1_a2_compatibility = 'not_recommended';
  const selectedRequest = request('grade5-concept-introduction');
  selectedRequest.language_profile.maximum_total_productive_language_demand = 'high';
  const row = candidate(selectLessonPedagogy(changed, selectedRequest), 'self-explanation');
  assert.ok(row.hard_filter_reasons.includes(
    'Estonian A1-A2 compatibility is not_recommended',
  ));
});

test('request digest changes when the total productive-language ceiling changes', () => {
  const medium = run('grade5-concept-introduction');
  const high = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.language_profile.maximum_total_productive_language_demand = 'high';
  });
  assert.notEqual(medium.decision.request_digest, high.decision.request_digest);
});

test('the heavy-share rule uses explicit total-demand semantics', () => {
  assert.equal(
    repository.rules.data.combination_rules
      .maximum_total_language_heavy_phase_share_percent_for_a1_a2_supported_lessons,
    50,
  );
  assert.equal(
    repository.rules.data.combination_rules
      .maximum_language_heavy_phase_share_percent_a1_a2,
    undefined,
  );
});

test('disabled Estonian support rejects A1-A2 learner level', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.learner_level = 'A1-A2';
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is disabled but learner_level is not not_applicable',
  ));
});

test('disabled Estonian support rejects non-empty roles', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.allowed_roles = ['terminology'];
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is disabled but allowed_roles is not empty',
  ));
});

test('disabled Estonian support rejects sentence-frame scaffolding', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.sentence_frames_required = true;
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is disabled but sentence_frames_required is true',
  ));
});

test('disabled Estonian support rejects word-bank scaffolding', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.word_bank_required = true;
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is disabled but word_bank_required is true',
  ));
});

test('disabled Estonian support rejects language assessment', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.assessment_requested = true;
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is disabled but assessment_requested is true',
  ));
});

test('enabled Estonian support rejects not-applicable learner level', () => {
  const invalid = request('grade5-concept-introduction');
  invalid.language_profile.estonian_support.learner_level = 'not_applicable';
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support is enabled but learner_level is not A1-A2',
  ));
});

test('enabled Estonian support requires the Estonian language identity', () => {
  const invalid = request('grade5-concept-introduction');
  invalid.language_profile.estonian_support.language = 'ru';
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support language must be et',
  ));
});

test('grade-5 science enabled support keeps complex instruction Russian-primary', () => {
  const invalid = request('grade5-concept-introduction');
  invalid.language_profile.primary_instruction_language = 'et';
  assert.equal(validators.request(invalid), true);
  const state = validateEstonianSupportState(invalid);
  assert.ok(state.diagnostics.includes(
    'grade-5 science with enabled Estonian support requires primary_instruction_language ru',
  ));
  const result = selectLessonPedagogy(repository, invalid);
  assert.equal(result.decision.status, 'failure');
  assert.equal(result.decision.failure.code, 'language_profile_incompatible');
  assert.equal(validators.decision(result.decision), true);
});

test('valid disabled Estonian support passes schema and semantic validation', () => {
  const valid = request('grade5-russian-only-concept-introduction');
  assert.equal(validators.request(valid), true);
  assert.deepEqual(validateEstonianSupportState(valid), {
    valid: true,
    diagnostics: [],
  });
});

test('valid enabled Estonian support passes schema and semantic validation', () => {
  const valid = request('grade5-concept-introduction');
  assert.equal(validators.request(valid), true);
  assert.deepEqual(validateEstonianSupportState(valid), {
    valid: true,
    diagnostics: [],
  });
});

test('Estonian-support semantic diagnostics remain bytewise sorted', () => {
  const invalid = request('grade5-russian-only-concept-introduction');
  invalid.language_profile.estonian_support.allowed_roles = ['terminology'];
  invalid.language_profile.estonian_support.assessment_requested = true;
  invalid.language_profile.estonian_support.learner_level = 'A1-A2';
  const diagnostics = validateEstonianSupportState(invalid).diagnostics;
  assert.deepEqual(diagnostics, [...diagnostics].sort(
    (left, right) => Buffer.from(left).compare(Buffer.from(right)),
  ));
});

test('disabled Estonian support emits no A1-A2 fit component', () => {
  const result = run('grade5-russian-only-concept-introduction');
  assert.ok(!allScoreComponents(result).includes('a1_a2_fit'));
});

test('disabled Estonian support emits no limited A1-A2 penalty', () => {
  const result = run('grade5-russian-only-concept-introduction');
  assert.ok(!allScoreComponents(result).includes('limited_a1_a2'));
});

test('A1-A2 compatibility metadata does not affect Russian-only selection', () => {
  const baseline = run('grade5-russian-only-concept-introduction');
  const changed = structuredClone(repository);
  changed.knowledge.activities.data.activities.find(
    (activity) => activity.activity_id === 'guided-reading',
  ).learner_demands.estonian_a1_a2_compatibility = 'not_recommended';
  const result = selectLessonPedagogy(
    changed,
    request('grade5-russian-only-concept-introduction'),
  );
  assert.deepEqual(selectedIds(result), selectedIds(baseline));
  const row = candidate(result, 'guided-reading');
  assert.ok(!row.hard_filter_reasons.some((reason) => reason.includes('A1-A2')));
  assert.equal(row.score.total, candidate(baseline, 'guided-reading').score.total);
});

test('A1-A2 fit scoring remains active when Estonian support is enabled', () => {
  const result = run('grade5-concept-introduction');
  assert.ok(allScoreComponents(result).includes('a1_a2_fit'));
});

test('total productive-language demand remains enforced when Estonian support is disabled', () => {
  const result = run('grade5-russian-only-concept-introduction');
  const row = candidate(result, 'self-explanation');
  assert.ok(row.hard_filter_reasons.some(
    (reason) => reason.includes('total productive-language demand high'),
  ));
});

test('Russian-only DNA phases contain no Estonian roles', () => {
  const dna = run('grade5-russian-only-concept-introduction').lessonDna;
  assert.ok(dna.phases.every((phase) => phase.language_role.estonian_roles.length === 0));
});

test('Russian-only DNA contains no Estonian sentence-frame scaffold', () => {
  const dna = run('grade5-russian-only-concept-introduction').lessonDna;
  assert.ok(!dna.differentiation.scaffolds.some((item) => item.includes('sentence frame')));
});

test('Russian-only DNA contains no Estonian word-bank scaffold', () => {
  const dna = run('grade5-russian-only-concept-introduction').lessonDna;
  assert.ok(!dna.differentiation.scaffolds.some((item) => item.includes('word bank')));
});

test('Russian-only DNA disables Estonian assessment', () => {
  const assessment = run('grade5-russian-only-concept-introduction')
    .lessonDna.assessment.estonian_language_assessment;
  assert.equal(assessment.enabled, false);
});

test('Russian-only DNA has no Estonian assessment target phases', () => {
  const assessment = run('grade5-russian-only-concept-introduction')
    .lessonDna.assessment.estonian_language_assessment;
  assert.deepEqual(assessment.target_phase_ids, []);
});

test('Russian-only DNA persists the disabled language policy', () => {
  const dna = run('grade5-russian-only-concept-introduction').lessonDna;
  assert.deepEqual(dna.context.language_policy, {
    primary_instruction_language: 'ru',
    maximum_total_productive_language_demand: 'medium',
    estonian_support: {
      enabled: false,
      learner_level: 'not_applicable',
      allowed_roles: [],
      subject_explanation_language: 'ru',
    },
  });
  assert.ok(!dna.known_limits.includes('per_language_productive_demand_not_modelled'));
});

test('Russian-only fixture produces byte-identical repeated output', () => {
  const first = run('grade5-russian-only-concept-introduction');
  const second = run('grade5-russian-only-concept-introduction');
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
});

test('Russian-only selection decision passes its strict schema', () => {
  const decision = run('grade5-russian-only-concept-introduction').decision;
  assert.equal(validators.decision(decision), true, JSON.stringify(validators.decision.errors));
});

test('Russian-only lesson DNA passes its strict schema', () => {
  const dna = run('grade5-russian-only-concept-introduction').lessonDna;
  assert.equal(validators.lessonDna(dna), true, JSON.stringify(validators.lessonDna.errors));
});

test('disabled lesson DNA schema rejects an Estonian phase role', () => {
  const dna = structuredClone(run('grade5-russian-only-concept-introduction').lessonDna);
  dna.phases[0].language_role.estonian_roles = ['terminology'];
  assert.equal(validators.lessonDna(dna), false);
});

test('disabled lesson DNA schema rejects enabled Estonian assessment', () => {
  const dna = structuredClone(run('grade5-russian-only-concept-introduction').lessonDna);
  dna.assessment.estonian_language_assessment.enabled = true;
  assert.equal(validators.lessonDna(dna), false);
});

test('disabled lesson DNA schema rejects the per-language demand known limit', () => {
  const dna = structuredClone(run('grade5-russian-only-concept-introduction').lessonDna);
  dna.known_limits.push('per_language_productive_demand_not_modelled');
  dna.known_limits.sort();
  assert.equal(validators.lessonDna(dna), false);
});

test('the ten pre-follow-up fixtures retain their committed selections', () => {
  const originalFixtureIds = [
    'grade5-concept-introduction',
    'grade5-independent-retrieval',
    'grade5-map-diagram',
    'grade5-oral-answer',
    'grade5-practical-no-supervision',
    'grade5-retrieval-correction',
    'grade5-russian-only-concept-introduction',
    'grade5-safe-practical',
    'grade5-teacher-override',
    'grade5-unsafe-override',
  ];
  for (const fixtureId of originalFixtureIds) {
    const item = fixture(fixtureId);
    const result = selectLessonPedagogy(repository, item.request);
    assert.equal(result.decision.selected_pattern?.pattern_id ?? null, item.expected.pattern_id);
    for (const targetId of item.expected.include_target_ids) {
      assert.ok(selectedIds(result).includes(targetId), `${fixtureId} lost ${targetId}`);
    }
    for (const targetId of item.expected.exclude_target_ids) {
      assert.ok(!selectedIds(result).includes(targetId), `${fixtureId} gained ${targetId}`);
    }
  }
});

test('selection CLI handles the Russian-only fixture', () => {
  const child = spawnSync(
    process.execPath,
    [
      'scripts/select-lesson-pedagogy.mjs',
      '--fixture',
      'grade5-russian-only-concept-introduction',
      '--json',
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  const output = JSON.parse(child.stdout);
  assert.equal(output.decision.status, 'success');
  assert.equal(output.lessonDna.context.language_policy.estonian_support.enabled, false);
});

test('supervised practical target is rejected without adult supervision', () => {
  const result = run('grade5-practical-no-supervision');
  assert.equal(result.decision.failure.code, 'safety_supervision_unavailable');
  assert.equal(result.lessonDna, null);
});

test('profiled activity family cannot be substituted for a concrete target ID', () => {
  const changed = structuredClone(repository);
  changed.fixtures.data.fixtures[0].request.preferences.preferred_target_ids = ['learning-stations'];
  const result = validatePedagogySelection(changed);
  assert.ok(result.errors.some((error) => error.includes('unknown target learning-stations')));
});

test('explicit target exclusion prevents selection', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.preferred_target_ids = [];
    selectedRequest.preferences.excluded_target_ids = ['guided-reading'];
  });
  assert.ok(!selectedIds(result).includes('guided-reading'));
  assert.ok(candidate(result, 'guided-reading').hard_filter_reasons.includes('target is explicitly excluded'));
});

test('grade-5 science fixture cannot move complex explanation to Estonian', () => {
  const invalid = request('grade5-concept-introduction');
  invalid.language_profile.estonian_support.subject_explanation_language = 'et';
  assert.equal(validators.request(invalid), false);
  assert.ok(validateEstonianSupportState(invalid).diagnostics.includes(
    'estonian_support subject_explanation_language must be ru',
  ));
});

test('requested phase needs become required slots', () => {
  const result = run('grade5-concept-introduction');
  const phases = new Set(result.lessonDna.phases.map((phase) => phase.phase));
  for (const phase of request('grade5-concept-introduction').lesson_context.phase_needs) {
    assert.ok(phases.has(phase), `missing requested phase ${phase}`);
  }
});

test('timing total reconciles activity, setup, cleanup, transitions, and reserve', () => {
  const timing = run('grade5-safe-practical').lessonDna.timing;
  assert.equal(
    timing.total_planned_minutes,
    timing.activity_minutes
      + timing.setup_minutes
      + timing.cleanup_minutes
      + timing.transition_minutes
      + timing.reserve_minutes,
  );
});

test('timing preserves the versioned reserve', () => {
  const timing = run('grade5-map-diagram').lessonDna.timing;
  assert.equal(timing.reserve_minutes, repository.rules.data.timing.reserve_minutes);
  assert.ok(timing.unallocated_minutes >= 0);
});

test('an unfilled optional slot records an honest reason', () => {
  const result = run('grade5-map-diagram');
  const unfilled = result.decision.slot_decisions.filter((slot) => !slot.selected_target_id);
  assert.ok(unfilled.length > 0);
  assert.ok(unfilled.every((slot) => slot.unfilled_reason));
});

test('one target is never silently repeated across lesson phases', () => {
  const ids = selectedIds(run('grade5-concept-introduction'));
  assert.equal(ids.length, new Set(ids).size);
});

test('composition respects the maximum number of group formats', () => {
  const result = run('grade5-concept-introduction');
  const formats = new Set(result.lessonDna.phases.map((phase) => phase.group_format));
  assert.ok(formats.size <= repository.rules.data.timing.maximum_distinct_group_formats);
});

test('safe practical composition includes observation, measurement, and evidence conclusion', () => {
  const result = run('grade5-safe-practical');
  const capabilities = new Set(result.lessonDna.phases.flatMap(
    (phase) => [...phase.capabilities.primary, ...phase.capabilities.supporting],
  ));
  for (const capability of ['observation', 'measurement', 'evidence_based_conclusion']) {
    assert.ok(capabilities.has(capability));
  }
});

test('safe practical DNA carries concrete adult supervision controls', () => {
  const practical = run('grade5-safe-practical').lessonDna.phases.find(
    (phase) => phase.target.target_id === 'learning-stations::practical-observation-measurement',
  );
  assert.equal(practical.safety.requires_adult_supervision, true);
  assert.ok(practical.safety.controls_ru.length >= 1);
});

test('retrieval first attempt is source-closed when requested', () => {
  const retrieval = run('grade5-retrieval-correction').lessonDna.phases.find(
    (phase) => phase.phase === 'retrieval',
  );
  assert.equal(retrieval.source_access.first_attempt, 'prohibited');
});

test('retrieval lesson has a later correction phase', () => {
  const dna = run('grade5-retrieval-correction').lessonDna;
  const immediateIndex = dna.phases.findIndex((phase) => phase.phase_id === dna.retrieval_plan.immediate_phase_id);
  const correctionIndex = dna.phases.findIndex((phase) => phase.phase_id === dna.retrieval_plan.correction_phase_id);
  assert.ok(immediateIndex >= 0);
  assert.ok(correctionIndex > immediateIndex);
});

test('delayed retrieval remains a relative recommendation', () => {
  const delayed = run('grade5-retrieval-correction').lessonDna.retrieval_plan.delayed;
  assert.deepEqual(delayed, [
    { after_days: 7, capability: 'retrieval' },
    { after_lessons: 1, capability: 'retrieval' },
  ]);
  assert.ok(delayed.every((window) => !Object.hasOwn(window, 'date')));
});

test('different purposes create different flexible pattern structures', () => {
  const concept = run('grade5-concept-introduction').lessonDna;
  const retrieval = run('grade5-retrieval-correction').lessonDna;
  assert.notEqual(concept.pattern.pattern_id, retrieval.pattern.pattern_id);
  assert.notDeepEqual(
    concept.phases.map((phase) => phase.phase),
    retrieval.phases.map((phase) => phase.phase),
  );
});

test('not every lesson DNA is forced to contain every pattern component', () => {
  const mapDna = run('grade5-map-diagram').lessonDna;
  assert.ok(mapDna.phases.length < 5);
});

test('short scaffolded Estonian output is represented without changing instruction language', () => {
  const dna = run('grade5-oral-answer').lessonDna;
  assert.equal(dna.context.language_policy.primary_instruction_language, 'ru');
  assert.equal(dna.context.language_policy.estonian_support.learner_level, 'A1-A2');
  assert.equal(dna.context.language_policy.maximum_total_productive_language_demand, 'medium');
  assert.ok(dna.context.language_policy.estonian_support.allowed_roles.includes(
    'short_oral_response',
  ));
  assert.ok(dna.phases.some((phase) => phase.language_role.estonian_roles.includes('short_oral_response')));
  assert.ok(dna.differentiation.scaffolds.some((item) => item.includes('sentence frame')));
  assert.ok(dna.known_limits.includes('per_language_productive_demand_not_modelled'));
});

test('complex subject explanation remains Russian in every grade-5 fixture', () => {
  for (const item of repository.fixtures.data.fixtures) {
    assert.equal(item.request.language_profile.primary_instruction_language, 'ru');
    assert.equal(item.request.language_profile.estonian_support.subject_explanation_language, 'ru');
  }
});

test('subject and Estonian assessment records are structurally separate', () => {
  const assessment = run('grade5-oral-answer').lessonDna.assessment;
  assert.equal(assessment.separation_policy, 'separate_subject_and_estonian_language_evidence');
  assert.notStrictEqual(assessment.subject_assessment, assessment.estonian_language_assessment);
});

test('subject assessment note forbids an Estonian-only penalty', () => {
  const note = run('grade5-oral-answer').lessonDna.assessment.subject_assessment.notes_ru;
  assert.match(note, /эстонская форма не снижает предметный результат/u);
});

test('Estonian assessment is enabled only when explicitly requested', () => {
  assert.equal(run('grade5-oral-answer').lessonDna.assessment.estonian_language_assessment.enabled, true);
  assert.equal(run('grade5-concept-introduction').lessonDna.assessment.estonian_language_assessment.enabled, false);
});

test('valid teacher override is accepted and preserved in DNA', () => {
  const result = run('grade5-teacher-override');
  const override = result.decision.teacher_override_results[0];
  assert.equal(override.status, 'accepted');
  const slot = result.decision.slot_decisions.find(
    (item) => item.slot_id === override.slot_id,
  );
  assert.equal(slot.selected_target_id, override.requested_target_id);
  assert.equal(result.lessonDna.teacher_overrides[0].target_id, 'concept-map');
  assert.match(result.lessonDna.teacher_overrides[0].rationale_ru, /тихая индивидуальная работа/u);
});

test('two different targets for one override slot fail before pattern selection', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.teacher_overrides = [
      {
        override_id: 'collaborative-method',
        slot_id: 'guided-practice',
        requested_target_id: 'gallery-walk',
        rationale_ru: 'Учитель хочет проверить групповую альтернативу.',
        author_role: 'teacher',
      },
      {
        override_id: 'quiet-method',
        slot_id: 'guided-practice',
        requested_target_id: 'concept-map',
        rationale_ru: 'Учитель выбирает тихую письменную работу.',
        author_role: 'teacher',
      },
    ];
  });
  assert.equal(result.decision.failure.code, 'invalid_teacher_override');
  assert.equal(result.decision.failure.message, 'Teacher overrides are ambiguous.');
  assert.deepEqual(
    result.decision.teacher_override_results.map((item) => item.status),
    ['rejected', 'rejected'],
  );
  assert.deepEqual(result.decision.failure.details, [
    'multiple overrides target slot guided-practice',
  ]);
});

test('the same target repeated for one override slot is rejected', () => {
  const selectedRequest = request('grade5-concept-introduction');
  selectedRequest.preferences.teacher_overrides = [
    {
      override_id: 'first',
      slot_id: 'guided-practice',
      requested_target_id: 'concept-map',
      rationale_ru: 'Первый выбор учителя.',
      author_role: 'teacher',
    },
    {
      override_id: 'second',
      slot_id: 'guided-practice',
      requested_target_id: 'concept-map',
      rationale_ru: 'Повторный выбор того же target.',
      author_role: 'teacher',
    },
  ];
  const semantic = validateTeacherOverrideSet(selectedRequest);
  assert.equal(semantic.valid, false);
  assert.deepEqual(semantic.details, ['multiple overrides target slot guided-practice']);
});

test('one override ID used for different slots is rejected', () => {
  const selectedRequest = request('grade5-concept-introduction');
  selectedRequest.preferences.teacher_overrides = [
    {
      override_id: 'same-id',
      slot_id: 'explanation',
      requested_target_id: 'guided-reading',
      rationale_ru: 'Выбор объяснения.',
      author_role: 'teacher',
    },
    {
      override_id: 'same-id',
      slot_id: 'guided-practice',
      requested_target_id: 'concept-map',
      rationale_ru: 'Выбор практики.',
      author_role: 'teacher',
    },
  ];
  const result = selectLessonPedagogy(repository, selectedRequest);
  assert.equal(result.decision.failure.code, 'invalid_teacher_override');
  assert.deepEqual(result.decision.failure.details, ['duplicate override id same-id']);
});

test('different teacher overrides for different slots are both applied', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.teacher_overrides = [
      {
        override_id: 'explanation-choice',
        slot_id: 'explanation',
        requested_target_id: 'guided-reading',
        rationale_ru: 'Учитель выбирает поддержанное чтение для объяснения.',
        author_role: 'teacher',
      },
      {
        override_id: 'practice-choice',
        slot_id: 'guided-practice',
        requested_target_id: 'concept-map',
        rationale_ru: 'Учитель выбирает карту понятий для практики.',
        author_role: 'teacher',
      },
    ];
  });
  assert.equal(result.decision.status, 'success');
  assert.deepEqual(
    result.decision.teacher_override_results.map((item) => [item.override_id, item.status]),
    [['explanation-choice', 'accepted'], ['practice-choice', 'accepted']],
  );
  for (const override of result.decision.teacher_override_results) {
    const matching = result.decision.slot_decisions.filter((slot) => (
      slot.slot_id === override.slot_id
      && slot.selected_target_id === override.requested_target_id
    ));
    assert.equal(matching.length, 1);
  }
});

test('eligible but unapplied override is never reported as accepted', () => {
  const result = run('grade5-teacher-override', (selectedRequest) => {
    selectedRequest.learner_context.lesson_duration_minutes = 10;
  });
  assert.equal(result.decision.status, 'failure');
  assert.equal(result.decision.teacher_override_results[0].status, 'rejected');
  assert.match(
    result.decision.teacher_override_results[0].reason,
    /no valid composition could apply/u,
  );
});

test('conflicting override diagnostics are bytewise deterministic', () => {
  const selectedRequest = request('grade5-concept-introduction');
  selectedRequest.preferences.teacher_overrides = [
    {
      override_id: 'z-choice',
      slot_id: 'guided-practice',
      requested_target_id: 'concept-map',
      rationale_ru: 'Поздний по ID вариант.',
      author_role: 'teacher',
    },
    {
      override_id: 'a-choice',
      slot_id: 'guided-practice',
      requested_target_id: 'gallery-walk',
      rationale_ru: 'Ранний по ID вариант.',
      author_role: 'teacher',
    },
  ];
  const first = selectLessonPedagogy(repository, selectedRequest);
  selectedRequest.preferences.teacher_overrides.reverse();
  const second = selectLessonPedagogy(repository, selectedRequest);
  assert.equal(stablePedagogyJson(first), stablePedagogyJson(second));
  assert.deepEqual(
    first.decision.teacher_override_results.map((item) => item.override_id),
    ['a-choice', 'z-choice'],
  );
});

test('conflicting override failure remains schema-valid', () => {
  const selectedRequest = request('grade5-concept-introduction');
  selectedRequest.preferences.teacher_overrides = [
    {
      override_id: 'first',
      slot_id: 'guided-practice',
      requested_target_id: 'concept-map',
      rationale_ru: 'Первый вариант.',
      author_role: 'teacher',
    },
    {
      override_id: 'second',
      slot_id: 'guided-practice',
      requested_target_id: 'gallery-walk',
      rationale_ru: 'Второй вариант.',
      author_role: 'teacher',
    },
  ];
  const result = selectLessonPedagogy(repository, selectedRequest);
  assert.equal(validators.decision(result.decision), true);
  assert.equal(result.lessonDna, null);
});

test('teacher override without rationale fails request schema', () => {
  const invalid = request('grade5-teacher-override');
  invalid.preferences.teacher_overrides[0].rationale_ru = '';
  assert.equal(validators.request(invalid), false);
});

test('teacher override for nonexistent target returns structured failure', () => {
  const result = run('grade5-teacher-override', (selectedRequest) => {
    selectedRequest.preferences.teacher_overrides[0].requested_target_id = 'missing-target';
  });
  assert.equal(result.decision.failure.code, 'invalid_teacher_override');
  assert.match(result.decision.teacher_override_results[0].reason, /unknown target/u);
});

test('teacher override with phase mismatch is rejected', () => {
  const result = run('grade5-teacher-override', (selectedRequest) => {
    selectedRequest.preferences.teacher_overrides[0].slot_id = 'explanation';
    selectedRequest.preferences.teacher_overrides[0].requested_target_id = 'concept-map';
  });
  assert.equal(result.decision.failure.code, 'invalid_teacher_override');
  assert.match(result.decision.teacher_override_results[0].reason, /lesson phase explanation/u);
});

test('hard safety constraint cannot be overridden', () => {
  const result = run('grade5-unsafe-override');
  assert.equal(result.decision.failure.code, 'invalid_teacher_override');
  assert.equal(result.decision.teacher_override_results[0].status, 'rejected');
  assert.match(result.decision.teacher_override_results[0].reason, /safety supervision/u);
});

test('unknown required pattern returns no-pattern failure', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.lesson_context.required_pattern_id = 'unknown-pattern';
  });
  assert.equal(result.decision.failure.code, 'no_pattern_match');
});

test('excluding every explanation target yields no-candidate failure', () => {
  const explanationTargets = repository.knowledge.activities.data.activities
    .filter((activity) => activity.suitable_lesson_phases.includes('explanation'))
    .flatMap((activity) => (
      activity.execution_profiles
        ? activity.execution_profiles.map((profile) => `${activity.activity_id}::${profile.profile_id}`)
        : [activity.activity_id]
    ));
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.preferences.excluded_target_ids = explanationTargets;
  });
  assert.equal(result.decision.failure.code, 'no_candidate_for_required_slot');
});

test('uncovered required capability returns structured capability failure', () => {
  const result = run('grade5-concept-introduction', (selectedRequest) => {
    selectedRequest.lesson_context.required_capabilities.push('experimentation');
  });
  assert.equal(result.decision.failure.code, 'unsatisfied_required_capability');
});

test('failure result itself is schema-valid', () => {
  const result = run('grade5-practical-no-supervision');
  assert.equal(validators.decision(result.decision), true, JSON.stringify(validators.decision.errors));
  assert.equal(result.lessonDna, null);
});

test('engine explicitly records that it used no AI, network, or randomness', () => {
  const determinism = run('grade5-concept-introduction').decision.determinism;
  assert.deepEqual(
    { ai: determinism.ai_used, network: determinism.network_used, random: determinism.randomness_used },
    { ai: false, network: false, random: false },
  );
});

test('committed examples exactly equal fixture-generated DNA', () => {
  for (const item of repository.fixtures.data.fixtures.filter((entry) => entry.expected.example_id)) {
    const generated = selectLessonPedagogy(repository, item.request).lessonDna;
    generated.lesson_dna_id = item.expected.example_id;
    const committed = repository.examples.data.examples.find(
      (example) => example.lesson_dna_id === item.expected.example_id,
    );
    assert.equal(stablePedagogyJson(generated), stablePedagogyJson(committed));
  }
});

test('CLI summary output is deterministic', () => {
  const args = ['scripts/select-lesson-pedagogy.mjs', '--fixture', 'grade5-concept-introduction', '--summary'];
  const first = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const second = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
});

test('CLI debug mode exposes hard-filter exclusions', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/select-lesson-pedagogy.mjs', '--fixture', 'grade5-map-diagram', '--debug'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /back-to-back-description/u);
  assert.match(result.stdout, /no requested group format/u);
});

test('CLI returns nonzero for an impossible required plan', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/select-lesson-pedagogy.mjs', '--fixture', 'grade5-practical-no-supervision'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /safety_supervision_unavailable/u);
});

test('selection rule provenance remains project-authored and provisional', () => {
  assert.equal(repository.rules.data.claim_origin, 'project_authored_design');
  assert.equal(repository.rules.data.confidence.level, 'provisional');
  assert.match(repository.rules.data.confidence.rationale, /не подтверждены независимым учителем/u);
});
