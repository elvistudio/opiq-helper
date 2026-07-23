import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  clonePedagogyKnowledge,
  loadPedagogyKnowledge,
  validatePedagogyKnowledge,
} from './lib/pedagogy-knowledge.mjs';
import {
  explainPedagogyActivityMatch,
  filterPedagogyActivities,
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
    assert.ok(Object.values(candidate.capabilities).includes('primary'), candidate.activity_id);
    assert.ok(candidate.delivery_constraints.group_size, candidate.activity_id);
    assert.ok(candidate.effort.teacher_preparation.rationale_ru, candidate.activity_id);
    assert.ok(candidate.effort.teacher_facilitation.rationale_ru, candidate.activity_id);
    assert.ok(candidate.effort.homeschool_parent.role_description_ru, candidate.activity_id);
    assert.ok(candidate.resource_requirements, candidate.activity_id);
    assert.ok(candidate.learner_demands, candidate.activity_id);
    assert.ok(candidate.taxonomy_assessment.confidence.rationale, candidate.activity_id);
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

test('learning stations expose supervised practical capabilities', () => {
  const candidate = activities.find((item) => item.activity_id === 'learning-stations');
  assert.equal(candidate.capabilities.observation, 'supporting');
  assert.equal(candidate.capabilities.measurement, 'supporting');
  assert.equal(candidate.safety.requires_adult_supervision, true);
  assert.equal(candidate.effort.homeschool_parent.role, 'safety_supervision');
  assert.ok(candidate.resource_requirements.optional.includes('laboratory_materials'));
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
  assert.deepEqual(result.activity_ids, ['visual-representation']);
});

test('taxonomy ratings remain project-authored and provisional', () => {
  for (const candidate of activities) {
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
    activities.filter((candidate) => (
      candidate.effort.homeschool_parent.role === 'subject_explanation_required'
    )).length,
    0,
  );
});

for (const fixture of production.queries.data.fixtures) {
  test(`query fixture ${fixture.query_id} includes and excludes its asserted activities`, () => {
    const result = filterPedagogyActivities(activities, fixture.filters);
    for (const activityId of fixture.expected_include_ids) {
      assert.ok(result.activity_ids.includes(activityId), `${fixture.query_id} missing ${activityId}`);
    }
    for (const activityId of fixture.expected_exclude_ids) {
      assert.ok(!result.activity_ids.includes(activityId), `${fixture.query_id} retained ${activityId}`);
    }
  });
}

test('query results use deterministic bytewise activity ordering', () => {
  const filters = production.queries.data.fixtures[0].filters;
  const result = filterPedagogyActivities(activities, filters);
  const expected = [...result.activity_ids].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  assert.deepEqual(result.activity_ids, expected);
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
  const candidate = activity(repository, 'learning-stations');
  candidate.safety.risk_level = 'none';
  candidate.safety.requires_adult_supervision = false;
  expectInvalid(repository, /laboratory materials require explicit adult safety supervision/u);
});

test('safety-supervised homeschool method with parent role none fails', () => {
  const repository = fresh();
  const candidate = activity(repository, 'learning-stations');
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
  activity(repository, 'learning-stations').resource_requirements.setup_minutes = -1;
  expectInvalid(repository, /setup_minutes|must be >= 0/u);
});

test('negative cleanup time fails', () => {
  const repository = fresh();
  activity(repository, 'learning-stations').resource_requirements.cleanup_minutes = -1;
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
  repository.queries.data.fixtures[0].expected_include_ids = ['missing-method'];
  expectInvalid(repository, /unknown pedagogical activity missing-method/u);
});

test('query fixture cannot include an activity filtered out by its constraints', () => {
  const repository = fresh();
  repository.queries.data.fixtures[0].expected_include_ids.push('jigsaw');
  repository.queries.data.fixtures[0].expected_include_ids.sort();
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
  for (const candidate of activities) {
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
  for (const candidate of activities) {
    assert.ok(!Object.values(candidate.capabilities).includes('unknown'), candidate.activity_id);
    assert.notEqual(candidate.effort.teacher_preparation.level, 'unknown', candidate.activity_id);
    assert.notEqual(candidate.effort.teacher_facilitation.level, 'unknown', candidate.activity_id);
    assert.notEqual(candidate.effort.homeschool_parent.level, 'unknown', candidate.activity_id);
  }
});
