import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  clonePedagogyKnowledge,
  createPedagogySchemaValidators,
  loadPedagogyKnowledge,
  validatePedagogyKnowledge,
} from './lib/pedagogy-knowledge.mjs';
import {
  expandPedagogyActivityTargets,
  explainPedagogyActivityMatch,
  filterPedagogyActivities,
  PEDAGOGY_TARGET_SEPARATOR,
} from './lib/pedagogy-query.mjs';

const production = await loadPedagogyKnowledge();
const activities = production.activities.data.activities;

function fresh() {
  return clonePedagogyKnowledge(production);
}

function activity(repository, activityId) {
  return repository.activities.data.activities
    .find((candidate) => candidate.activity_id === activityId);
}

function profile(repository, activityId, profileId) {
  return activity(repository, activityId).execution_profiles
    .find((candidate) => candidate.profile_id === profileId);
}

function operationalRecords(repository = production) {
  return repository.activities.data.activities.flatMap((candidate) => (
    candidate.execution_profiles ?? [candidate]
  ));
}

function messages(result) {
  return result.errors.map((error) => `${error.file} ${error.field} ${error.reason}`).join('\n');
}

function expectInvalid(repository, pattern) {
  const result = validatePedagogyKnowledge(repository);
  assert.equal(result.valid, false);
  assert.match(messages(result), pattern);
}

test('taxonomy 1.0 exposes the required production vocabulary', () => {
  assert.equal(production.taxonomy.data.taxonomy_version, '1.0');
  assert.equal(production.taxonomy.data.capabilities.length, 33);
  assert.equal(production.taxonomy.data.resource_vocabulary.length, 22);
});

test('all 30 production activities have migrated taxonomy metadata', () => {
  assert.equal(activities.length, 30);
  for (const candidate of activities) {
    for (const operational of candidate.execution_profiles ?? [candidate]) {
      const label = candidate.execution_profiles
        ? `${candidate.activity_id}${PEDAGOGY_TARGET_SEPARATOR}${operational.profile_id}`
        : candidate.activity_id;
      assert.ok(Object.values(operational.capabilities).includes('primary'), label);
      assert.ok(operational.delivery_constraints.group_size, label);
      assert.ok(operational.effort.teacher_preparation.rationale_ru, label);
      assert.ok(operational.effort.teacher_facilitation.rationale_ru, label);
      assert.ok(operational.effort.homeschool_parent.role_description_ru, label);
      assert.ok(operational.resource_requirements, label);
      assert.ok(operational.learner_demands, label);
      assert.ok(operational.taxonomy_assessment.confidence.rationale, label);
    }
  }
});

test('individual retrieval activity has direct low-support operation metadata', () => {
  const candidate = activities.find((item) => item.activity_id === 'retrieval-self-test');
  assert.equal(candidate.capabilities.retrieval, 'primary');
  assert.equal(candidate.capabilities.formative_assessment, 'primary');
  assert.equal(candidate.delivery_constraints.group_size.min, 1);
  assert.deepEqual(candidate.delivery_constraints.supported_group_formats, ['individual']);
  assert.equal(candidate.effort.homeschool_parent.role, 'check_answers');
  assert.equal(candidate.delivery_constraints.source_access_during_first_attempt, 'prohibited');
});

test('jigsaw records high interaction and substantial facilitation', () => {
  const candidate = activities.find((item) => item.activity_id === 'jigsaw');
  assert.equal(candidate.capabilities.collaborative_practice, 'primary');
  assert.equal(candidate.capabilities.peer_explanation, 'primary');
  assert.equal(candidate.learner_demands.interaction, 'high');
  assert.equal(candidate.effort.teacher_preparation.level, 'high');
  assert.equal(candidate.effort.teacher_facilitation.level, 'high');
  assert.equal(candidate.compatibility.one_learner, 'not_recommended');
});

test('Frayer model supports concept formation without requiring a printer', () => {
  const candidate = activities.find((item) => item.activity_id === 'frayer-model');
  assert.equal(candidate.capabilities.concept_formation, 'primary');
  assert.equal(candidate.capabilities.classification, 'supporting');
  assert.equal(candidate.capabilities.visual_representation, 'supporting');
  assert.equal(candidate.resource_requirements.printer_required, false);
  assert.equal(candidate.compatibility.no_printer, 'directly_supported');
});

test('back-to-back description remains a pair and oral method', () => {
  const candidate = activities.find((item) => item.activity_id === 'back-to-back-description');
  assert.deepEqual(candidate.delivery_constraints.group_size, { min: 2, max: 2 });
  assert.deepEqual(candidate.delivery_constraints.supported_group_formats, ['pair']);
  assert.equal(candidate.capabilities.oral_production, 'primary');
  assert.equal(candidate.learner_demands.receptive_language, 'medium');
  assert.equal(candidate.compatibility.one_learner, 'adaptable');
});

test('learning stations expose three distinct execution profiles', () => {
  const candidate = activities.find((item) => item.activity_id === 'learning-stations');
  assert.deepEqual(
    candidate.execution_profiles.map((item) => item.profile_id),
    ['map-data', 'paper-classification', 'practical-observation-measurement'],
  );
  const paper = candidate.execution_profiles[1];
  const practical = candidate.execution_profiles[2];
  assert.equal(paper.safety.requires_adult_supervision, false);
  assert.equal(paper.effort.homeschool_parent.role, 'none');
  assert.ok(!paper.resource_requirements.required.includes('laboratory_materials'));
  assert.equal(practical.capabilities.observation, 'primary');
  assert.equal(practical.capabilities.measurement, 'primary');
  assert.equal(practical.safety.requires_adult_supervision, true);
  assert.equal(practical.effort.homeschool_parent.role, 'safety_supervision');
  assert.ok(practical.resource_requirements.required.includes('laboratory_materials'));
});

test('profiled learning-stations catalog passes the strict activity schema', () => {
  const validators = createPedagogySchemaValidators(production.schemas);
  const candidate = activity(production, 'learning-stations');
  assert.equal(validators.activity({
    schema_version: '1.0',
    artifact_type: 'pedagogical_activity_catalog',
    activities: [candidate],
  }), true);
});

test('duplicate execution profile ID fails', () => {
  const repository = fresh();
  const candidate = activity(repository, 'learning-stations');
  candidate.execution_profiles[2].profile_id = candidate.execution_profiles[1].profile_id;
  expectInvalid(repository, /duplicate execution profile ID/u);
});

test('execution profile missing an operational field fails', () => {
  const repository = fresh();
  delete profile(repository, 'learning-stations', 'map-data').learner_demands;
  expectInvalid(repository, /execution_profiles|learner_demands/u);
});

test('activity cannot mix execution profiles with activity-level operational ratings', () => {
  const repository = fresh();
  activity(repository, 'learning-stations').capabilities = { classification: 'primary' };
  expectInvalid(repository, /profiled activity must not also declare activity-level operational fields/u);
});

test('invalid composed query target separator fails', () => {
  const repository = fresh();
  repository.queries.data.fixtures[0].expected_exclude_target_ids[0] = 'jigsaw/pair';
  expectInvalid(repository, /expected_exclude_target_ids|must match pattern/u);
});

test('execution profile with dangling capability fails', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .capabilities.telepathy = 'primary';
  expectInvalid(repository, /unknown pedagogical capability telepathy/u);
});

test('execution profile with dangling resource fails', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'map-data')
    .resource_requirements.optional.push('hologram');
  expectInvalid(repository, /unknown pedagogical resource hologram/u);
});

test('no-risk paper station cannot require adult safety supervision', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .safety.requires_adult_supervision = true;
  expectInvalid(repository, /no-risk execution target cannot require adult safety supervision/u);
});

test('no-risk paper station cannot assign parent safety-supervision role', () => {
  const repository = fresh();
  const parent = profile(repository, 'learning-stations', 'paper-classification')
    .effort.homeschool_parent;
  parent.level = 'medium';
  parent.role = 'safety_supervision';
  expectInvalid(repository, /parent role safety_supervision requires an execution target with a safety need/u);
});

test('practical profile has coherent safety supervision and parent role', () => {
  const practical = profile(
    production,
    'learning-stations',
    'practical-observation-measurement',
  );
  assert.equal(practical.safety.risk_level, 'low');
  assert.equal(practical.safety.requires_adult_supervision, true);
  assert.equal(practical.effort.homeschool_parent.role, 'safety_supervision');
  assert.ok(practical.homeschool_adaptation.adult_safety_supervision_ru);
});

test('laboratory requirement needs laboratory material in required resources', () => {
  const repository = fresh();
  const practical = profile(
    repository,
    'learning-stations',
    'practical-observation-measurement',
  );
  practical.resource_requirements.required =
    practical.resource_requirements.required.filter((resource) => resource !== 'laboratory_materials');
  expectInvalid(repository, /laboratory_materials_required true requires laboratory_materials/u);
});

test('profile printer requirement needs a printable required resource', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .resource_requirements.printer_required = true;
  expectInvalid(repository, /printer_required true requires printed_worksheet or printable_cards/u);
});

test('profile required and optional resources remain distinct', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .resource_requirements.optional.unshift('paper');
  expectInvalid(repository, /required and optional resources overlap/u);
});

test('profile internet requirement contradicts direct offline compatibility', () => {
  const repository = fresh();
  const mapData = profile(repository, 'learning-stations', 'map-data');
  mapData.resource_requirements.required.unshift('internet');
  mapData.resource_requirements.internet_required = true;
  expectInvalid(repository, /internet-required activity cannot claim positive offline compatibility/u);
});

test('profile positive remote compatibility requires remote delivery mode', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'map-data').compatibility.remote_delivery =
    'adaptable';
  expectInvalid(repository, /positive remote compatibility requires remote delivery mode/u);
});

test('profile-specific delivery restriction is valid when another profile covers family homeschool use', () => {
  const repository = fresh();
  const mapData = profile(repository, 'learning-stations', 'map-data');
  mapData.delivery_constraints.delivery_modes = ['classroom'];
  mapData.homeschool_adaptation.status = 'not_recommended';
  const result = validatePedagogyKnowledge(repository);
  assert.equal(result.valid, true, messages(result));
});

test('execution profile taxonomy assessment remains project-authored and provisional', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'map-data')
    .taxonomy_assessment.confidence.level = 'medium';
  expectInvalid(repository, /execution-profile taxonomy assessment must be project_authored_design with provisional confidence/u);
});

test('unprofiled activity expands to a plain deterministic target', () => {
  const targets = expandPedagogyActivityTargets([
    activity(production, 'one-minute-recall'),
  ]);
  assert.deepEqual(targets.map((target) => ({
    target_id: target.target_id,
    activity_id: target.activity_id,
    execution_profile_id: target.execution_profile_id,
  })), [{
    target_id: 'one-minute-recall',
    activity_id: 'one-minute-recall',
    execution_profile_id: null,
  }]);
});

test('profiled activity expands to composed deterministic targets', () => {
  const targets = expandPedagogyActivityTargets([
    activity(production, 'learning-stations'),
  ]);
  assert.deepEqual(
    targets.map((target) => target.target_id),
    [
      'learning-stations::map-data',
      'learning-stations::paper-classification',
      'learning-stations::practical-observation-measurement',
    ],
  );
});

test('safe practical filtering selects only the practical learning-stations profile', () => {
  const fixture = production.queries.data.fixtures
    .find((candidate) => candidate.query_id === 'safe-practical-observation');
  const result = filterPedagogyActivities(activities, fixture.filters);
  assert.deepEqual(
    result.targets.filter((target) => target.activity_id === 'learning-stations'),
    [{
      target_id: 'learning-stations::practical-observation-measurement',
      activity_id: 'learning-stations',
      execution_profile_id: 'practical-observation-measurement',
    }],
  );
});

test('low-support homeschool filtering selects the paper profile without safety supervision', () => {
  const fixture = production.queries.data.fixtures
    .find((candidate) => candidate.query_id === 'homeschool-paper-stations-low-support');
  const result = filterPedagogyActivities(activities, fixture.filters);
  assert.ok(result.targets.some(
    (target) => target.target_id === 'learning-stations::paper-classification',
  ));
  assert.ok(!result.targets.some(
    (target) => target.target_id === 'learning-stations::practical-observation-measurement',
  ));
});

test('map filtering selects only the map-data learning-stations profile', () => {
  const fixture = production.queries.data.fixtures
    .find((candidate) => candidate.query_id === 'map-diagram-low-language');
  const result = filterPedagogyActivities(activities, fixture.filters);
  assert.deepEqual(
    result.targets
      .filter((target) => target.activity_id === 'learning-stations')
      .map((target) => target.target_id),
    ['learning-stations::map-data'],
  );
});

test('profile debug exclusions name the composed target and profile-specific safety reason', () => {
  const result = filterPedagogyActivities(activities, {
    grade: 5,
    subject: 'science',
    adult_safety_supervision_required: true,
  }, { debug: true });
  const excluded = result.excluded.find(
    (target) => target.target_id === 'learning-stations::paper-classification',
  );
  assert.equal(excluded.execution_profile_id, 'paper-classification');
  assert.ok(excluded.reasons.includes(
    'adult safety supervision is not required by this execution target',
  ));
});

test('query response remains filtering output without ranking fields', () => {
  const result = filterPedagogyActivities(activities, { grade: 5, subject: 'science' });
  assert.equal(result.selection_mode, 'deterministic_filtering_without_ranking');
  assert.ok(!Object.hasOwn(result, 'scores'));
  assert.ok(!Object.hasOwn(result, 'ranking'));
});

test('only learning-stations is profiled and the 29 other activity records retain operational blocks', () => {
  assert.equal(activities.length, 30);
  assert.deepEqual(
    activities.filter((candidate) => candidate.execution_profiles).map((candidate) => candidate.activity_id),
    ['learning-stations'],
  );
  for (const candidate of activities.filter((item) => !item.execution_profiles)) {
    assert.ok(candidate.capabilities, candidate.activity_id);
    assert.ok(candidate.delivery_constraints, candidate.activity_id);
    assert.ok(candidate.resource_requirements, candidate.activity_id);
  }
});

test('all 29 non-profiled activity records preserve the reviewed homeschool semantic digest', () => {
  const records = activities.filter((candidate) => candidate.activity_id !== 'learning-stations');
  const digest = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  assert.equal(digest, '8147588e4de42a0f2db8109523402927dabcfda0be1eba2fc2aa5a9e81dcd16d');
});

test('query target expansion is deterministic across reversed catalog traversal', () => {
  const forward = expandPedagogyActivityTargets(activities).map((target) => target.target_id);
  const reversed = expandPedagogyActivityTargets([...activities].reverse())
    .map((target) => target.target_id);
  assert.deepEqual(reversed, forward);
  assert.equal(forward.length, 32);
});

test('offline no-printer retrieval query returns an individual activity', () => {
  const result = filterPedagogyActivities(activities, {
    grade: 5,
    subject: 'science',
    delivery_mode: 'homeschool',
    group_size: 1,
    group_formats_any: ['individual'],
    required_capabilities_all: ['retrieval'],
    max_parent_effort: 'minimal',
    offline: true,
    no_printer: true,
  });
  assert.ok(result.activity_ids.includes('retrieval-self-test'));
});

test('remote-capable metadata can be filtered without ranking', () => {
  const result = filterPedagogyActivities(activities, {
    grade: 5,
    subject: 'science',
    delivery_mode: 'remote',
    required_capabilities_all: ['retrieval'],
  });
  assert.equal(result.selection_mode, 'deterministic_filtering_without_ranking');
  assert.ok(result.activity_ids.includes('one-minute-recall'));
});

test('map or diagram query finds a low-language visual method', () => {
  const result = filterPedagogyActivities(activities, {
    grade: 5,
    subject: 'science',
    group_size: 1,
    required_capabilities_any: ['map_interpretation', 'diagram_interpretation'],
    max_productive_language: 'low',
  });
  assert.deepEqual(
    result.targets.map((target) => target.target_id),
    ['learning-stations::map-data', 'visual-representation'],
  );
});

test('taxonomy ratings remain project-authored and provisional', () => {
  for (const candidate of operationalRecords()) {
    assert.equal(candidate.taxonomy_assessment.claim_origin, 'project_authored_design');
    assert.deepEqual(candidate.taxonomy_assessment.reference_ids, []);
    assert.equal(candidate.taxonomy_assessment.confidence.level, 'provisional');
  }
});

test('preparation and facilitation effort remain distinct dimensions', () => {
  const candidate = activities.find((item) => item.activity_id === 'brainstorming');
  assert.equal(candidate.effort.teacher_preparation.level, 'low');
  assert.equal(candidate.effort.teacher_facilitation.level, 'medium');
});

test('parents are not classified as subject teachers in production metadata', () => {
  assert.equal(
    operationalRecords().filter((candidate) => (
      candidate.effort.homeschool_parent.role === 'subject_explanation_required'
    )).length,
    0,
  );
});

for (const fixture of production.queries.data.fixtures) {
  test(`query fixture ${fixture.query_id} includes and excludes its asserted targets`, () => {
    const result = filterPedagogyActivities(activities, fixture.filters);
    const targetIds = result.targets.map((target) => target.target_id);
    for (const targetId of fixture.expected_include_target_ids) {
      assert.ok(targetIds.includes(targetId), `${fixture.query_id} missing ${targetId}`);
    }
    for (const targetId of fixture.expected_exclude_target_ids) {
      assert.ok(!targetIds.includes(targetId), `${fixture.query_id} retained ${targetId}`);
    }
  });
}

test('query results use deterministic bytewise target ordering', () => {
  const filters = production.queries.data.fixtures[0].filters;
  const result = filterPedagogyActivities(activities, filters);
  const targetIds = result.targets.map((target) => target.target_id);
  const expected = [...targetIds].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  assert.deepEqual(targetIds, expected);
});

test('query results do not depend on catalog traversal order', () => {
  const filters = production.queries.data.fixtures[1].filters;
  assert.deepEqual(
    filterPedagogyActivities([...activities].reverse(), filters),
    filterPedagogyActivities(activities, filters),
  );
});

test('debug filtering reports deterministic exclusion reasons', () => {
  const filters = {
    grade: 5,
    subject: 'science',
    group_size: 1,
    required_capabilities_all: ['retrieval'],
  };
  const result = filterPedagogyActivities(activities, filters, { debug: true });
  const jigsaw = result.excluded.find((item) => item.activity_id === 'jigsaw');
  assert.ok(jigsaw.reasons.some((reason) => reason.includes('group size')));
  assert.ok(jigsaw.reasons.some((reason) => reason.includes('required capabilities')));
});

test('query CLI output is deterministic across repeated runs', () => {
  const args = ['scripts/query-pedagogy-activities.mjs', '--fixture', 'retrieval-with-error-correction'];
  const first = execFileSync(process.execPath, args, { encoding: 'utf8' });
  const second = execFileSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(second, first);
});

test('one-learner filtering rejects pair-only activity', () => {
  const candidate = activities.find((item) => item.activity_id === 'back-to-back-description');
  const result = explainPedagogyActivityMatch(candidate, { group_size: 1 });
  assert.equal(result.matches, false);
  assert.match(result.reasons.join('\n'), /group size 1 outside 2-2/u);
});

test('unknown capability fails', () => {
  const repository = fresh();
  activity(repository, 'retrieval-self-test').capabilities.telepathy = 'primary';
  expectInvalid(repository, /unknown pedagogical capability telepathy/u);
});

test('unknown capability level fails', () => {
  const repository = fresh();
  activity(repository, 'retrieval-self-test').capabilities.retrieval = 'essential';
  expectInvalid(repository, /capabilities|allowed values/u);
});

test('group-size minimum greater than maximum fails', () => {
  const repository = fresh();
  activity(repository, 'retrieval-self-test').delivery_constraints.group_size = { min: 5, max: 1 };
  expectInvalid(repository, /group-size minimum must not exceed/u);
});

test('pair method range excluding two fails', () => {
  const repository = fresh();
  activity(repository, 'back-to-back-description').delivery_constraints.group_size = { min: 3, max: 3 };
  expectInvalid(repository, /pair group format requires a range containing 2/u);
});

test('whole-class method with maximum four fails', () => {
  const repository = fresh();
  activity(repository, 'brainstorming').delivery_constraints.group_size.max = 4;
  expectInvalid(repository, /whole_class requires a maximum group size/u);
});

test('direct individual compatibility without range containing one fails', () => {
  const repository = fresh();
  activity(repository, 'concept-map').delivery_constraints.group_size = { min: 2, max: 6 };
  expectInvalid(repository, /individual group format requires a range containing 1|direct one-learner/u);
});

test('classroom-only group method cannot claim direct homeschool suitability', () => {
  const repository = fresh();
  const candidate = activity(repository, 'jigsaw');
  candidate.delivery_constraints.delivery_modes = ['classroom'];
  candidate.homeschool_adaptation.status = 'directly_suitable';
  expectInvalid(repository, /group-based activity cannot be directly suitable|requires a compatible delivery mode/u);
});

test('printer requirement without printable resource fails', () => {
  const repository = fresh();
  activity(repository, 'exit-ticket').resource_requirements.printer_required = true;
  expectInvalid(repository, /printer_required true requires printed_worksheet or printable_cards/u);
});

test('required and optional resource duplication fails', () => {
  const repository = fresh();
  const candidate = activity(repository, 'brainstorming');
  candidate.resource_requirements.optional.unshift('paper');
  expectInvalid(repository, /required and optional resources overlap/u);
});

test('internet-required activity cannot claim offline compatibility', () => {
  const repository = fresh();
  const candidate = activity(repository, 'guided-reading');
  candidate.resource_requirements.required.unshift('internet');
  candidate.resource_requirements.internet_required = true;
  expectInvalid(repository, /internet-required activity cannot claim positive offline compatibility/u);
});

test('laboratory material without safety supervision fails', () => {
  const repository = fresh();
  const candidate = profile(
    repository,
    'learning-stations',
    'practical-observation-measurement',
  );
  candidate.safety.risk_level = 'none';
  candidate.safety.requires_adult_supervision = false;
  expectInvalid(repository, /laboratory materials require explicit adult safety supervision/u);
});

test('safety-supervised homeschool method with parent role none fails', () => {
  const repository = fresh();
  const candidate = profile(
    repository,
    'learning-stations',
    'practical-observation-measurement',
  );
  candidate.effort.homeschool_parent.level = 'none';
  candidate.effort.homeschool_parent.role = 'none';
  expectInvalid(repository, /safety-supervised homeschool activity cannot declare parent role none/u);
});

test('active parent participation without role description fails', () => {
  const repository = fresh();
  activity(repository, 'question-circle').effort.homeschool_parent.role_description_ru = '';
  expectInvalid(repository, /role_description_ru|must NOT have fewer than 1 characters/u);
});

test('high productive-language demand cannot be direct Estonian A1-A2', () => {
  const repository = fresh();
  activity(repository, 'self-explanation').learner_demands.estonian_a1_a2_compatibility =
    'directly_supported';
  expectInvalid(repository, /high productive-language demand cannot be directly supported/u);
});

test('missing taxonomy confidence fails', () => {
  const repository = fresh();
  delete activity(repository, 'concept-map').taxonomy_assessment.confidence;
  expectInvalid(repository, /taxonomy_assessment|confidence/u);
});

test('source-supported taxonomy rating without explicit evidence fails', () => {
  const repository = fresh();
  const assessment = activity(repository, 'concept-map').taxonomy_assessment;
  assessment.claim_origin = 'source_supported';
  assessment.reference_ids = ['oppeulesanded-method-catalog'];
  expectInvalid(repository, /requires an explicit taxonomy-assessment provenance claim/u);
});

test('unknown effort enum fails', () => {
  const repository = fresh();
  activity(repository, 'brainstorming').effort.teacher_facilitation.level = 'moderate';
  expectInvalid(repository, /teacher_facilitation|allowed values/u);
});

test('negative setup time fails', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .resource_requirements.setup_minutes = -1;
  expectInvalid(repository, /setup_minutes|must be >= 0/u);
});

test('negative cleanup time fails', () => {
  const repository = fresh();
  profile(repository, 'learning-stations', 'paper-classification')
    .resource_requirements.cleanup_minutes = -1;
  expectInvalid(repository, /cleanup_minutes|must be >= 0/u);
});

test('unknown registered resource fails', () => {
  const repository = fresh();
  activity(repository, 'brainstorming').resource_requirements.optional.push('hologram');
  expectInvalid(repository, /unknown pedagogical resource hologram/u);
});

test('unknown taxonomy version fails', () => {
  const repository = fresh();
  repository.taxonomy.data.taxonomy_version = '2.0';
  expectInvalid(repository, /taxonomy_version|must be equal to constant/u);
});

test('controlled vocabulary drift fails', () => {
  const repository = fresh();
  repository.taxonomy.data.controlled_vocabulary.effort_levels.pop();
  expectInvalid(repository, /effort_levels must equal the documented sorted vocabulary/u);
});

test('query fixture with dangling capability fails', () => {
  const repository = fresh();
  repository.queries.data.fixtures[0].filters.required_capabilities_all = ['telepathy'];
  expectInvalid(repository, /unknown pedagogical capability telepathy/u);
});

test('query fixture with unknown activity fails', () => {
  const repository = fresh();
  repository.queries.data.fixtures[0].expected_include_target_ids = ['missing-method'];
  expectInvalid(repository, /unknown pedagogical query target missing-method/u);
});

test('query fixture cannot include an activity filtered out by its constraints', () => {
  const repository = fresh();
  repository.queries.data.fixtures[0].expected_include_target_ids.push('jigsaw');
  repository.queries.data.fixtures[0].expected_include_target_ids.sort();
  expectInvalid(repository, /must include jigsaw/u);
});

test('query fixture order must remain deterministic', () => {
  const repository = fresh();
  repository.queries.data.fixtures.reverse();
  expectInvalid(repository, /query fixtures must be sorted bytewise/u);
});

test('capability maps must remain bytewise sorted', () => {
  const repository = fresh();
  const candidate = activity(repository, 'retrieval-self-test');
  candidate.capabilities = {
    retrieval: candidate.capabilities.retrieval,
    error_correction: candidate.capabilities.error_correction,
    error_detection: candidate.capabilities.error_detection,
    formative_assessment: candidate.capabilities.formative_assessment,
    independent_practice: candidate.capabilities.independent_practice,
    self_assessment: candidate.capabilities.self_assessment,
  };
  expectInvalid(repository, /capabilities must be sorted bytewise/u);
});

test('remote compatibility without remote delivery mode fails', () => {
  const repository = fresh();
  const candidate = activity(repository, 'one-minute-recall');
  candidate.delivery_constraints.delivery_modes =
    candidate.delivery_constraints.delivery_modes.filter((mode) => mode !== 'remote');
  expectInvalid(repository, /positive remote compatibility requires remote delivery mode/u);
});

test('all production resource lists are registered and disjoint', () => {
  const resourceIds = new Set(production.taxonomy.data.resource_vocabulary.map((item) => item.resource_id));
  for (const candidate of operationalRecords()) {
    const required = new Set(candidate.resource_requirements.required);
    for (const resourceId of [
      ...candidate.resource_requirements.required,
      ...candidate.resource_requirements.optional,
      ...candidate.resource_requirements.reusable_materials,
      ...candidate.resource_requirements.consumable_materials,
    ]) {
      assert.ok(resourceIds.has(resourceId), `${candidate.activity_id}: ${resourceId}`);
    }
    for (const resourceId of candidate.resource_requirements.optional) {
      assert.ok(!required.has(resourceId), `${candidate.activity_id}: duplicate ${resourceId}`);
    }
  }
});

test('no production activity uses unknown capability or effort ratings', () => {
  for (const candidate of operationalRecords()) {
    assert.ok(!Object.values(candidate.capabilities).includes('unknown'), candidate.activity_id);
    assert.notEqual(candidate.effort.teacher_preparation.level, 'unknown', candidate.activity_id);
    assert.notEqual(candidate.effort.teacher_facilitation.level, 'unknown', candidate.activity_id);
    assert.notEqual(candidate.effort.homeschool_parent.level, 'unknown', candidate.activity_id);
  }
});
