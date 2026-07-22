import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lib/lesson-plans.mjs';

let baseline;

before(async () => {
  baseline = await loadLessonPlanRepository();
});

function cloneRepository() {
  return structuredClone(baseline);
}

function annual(repository) {
  return repository.artifacts.find((artifact) => artifact.data.artifact_type === 'annual_course_plan').data;
}

function unit(repository, unitId) {
  const found = annual(repository).ordered_units.find((entry) => entry.unit_id === unitId);
  assert.ok(found, `missing unit ${unitId}`);
  return found;
}

function sourceContribution(repository, unitId, sourceId) {
  const found = unit(repository, unitId).topic_synthesis.source_contributions
    .find((entry) => entry.source_id === sourceId);
  assert.ok(found, `missing contribution ${sourceId}`);
  return found;
}

function validation(repository) {
  return validateLessonPlanRepository(repository);
}

function errors(repository) {
  return validation(repository).diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

function diagnosticText(diagnostics) {
  return diagnostics.map((diagnostic) => `${diagnostic.file} ${diagnostic.field} ${diagnostic.reason}`).join('\n');
}

function assertValid(repository) {
  const found = errors(repository);
  assert.deepEqual(found, [], diagnosticText(found));
}

function assertFailsWith(repository, pattern) {
  const found = errors(repository);
  assert.ok(found.length > 0, 'expected validation to fail');
  assert.match(diagnosticText(found), pattern);
}

function addExternalSource(repository) {
  const source = {
    source_id: 'synthetic-environment-source',
    title: 'Synthetic environmental source',
    organization: 'Synthetic Public Agency',
    url: 'https://example.org/environment-source',
    source_category: 'official_public_source',
    source_language: 'et',
    verified_on: '2026-01-15',
    instructional_purpose: 'Provide a short verified supplement for a synthetic validation fixture.',
    related_topic_or_unit_ids: ['grade-5-rivers-lakes'],
    official_curriculum_evidence: false,
    notes: 'Synthetic test-only registry entry; it is never written to production data.',
    provenance: {
      source_family: 'external',
      source_type: 'official_public_source',
      source_reference: 'https://example.org/environment-source',
      notes: 'Synthetic test-only provenance for external registry validation.',
    },
  };
  repository.externalArtifacts[0].data.sources.push(source);
  return source;
}

function addExternalContribution(repository) {
  const target = unit(repository, 'grade-5-rivers-lakes').topic_synthesis;
  target.strategies.push('supplemented_by_external_source');
  target.source_contributions.push({
    contribution_id: 'synthetic-external-supplement',
    source_kind: 'external_source',
    source_id: 'synthetic-environment-source',
    source_language: 'et',
    provenance: {
      source_family: 'external',
      source_type: 'official_public_source',
      source_reference: 'synthetic-environment-source',
      notes: 'Synthetic test-only external contribution provenance.',
    },
    selection_rationale: 'Exercise optional external supplementation without changing production sources.',
    transformations: [{
      transformation: 'supplement',
      output_language: 'ru',
      output_layer: 'main_explanation',
      instructional_roles: ['optional_extension'],
      concepts_supported: ['synthetic supplement'],
      notes: 'A short verified supplement is summarized into Russian for this test fixture.',
    }],
  });
}

test('production direct Russian Opiq explanation is valid', () => {
  const repository = cloneRepository();
  assert.ok(unit(repository, 'grade-5-rivers-lakes').topic_synthesis.strategies.includes('direct_opiq_ru'));
  assertValid(repository);
});

test('translation from one selected Estonian Opiq source is valid', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-landforms-map').topic_synthesis;
  synthesis.strategies = ['translated_from_opiq_et'];
  synthesis.source_contributions[0].transformations[0].transformation = 'translation';
  assertValid(repository);
});

test('pedagogical adaptation from Estonian Opiq is valid without direct Russian evidence', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-landforms-map').topic_synthesis;
  assert.deepEqual(synthesis.strategies, ['adapted_from_opiq_et']);
  assert.equal(synthesis.source_contributions[0].source_language, 'et');
  assertValid(repository);
});

test('Russian and Estonian Opiq records can contribute to one synthesis', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-water-use-cycle').topic_synthesis;
  assert.ok(synthesis.source_contributions.some((entry) => entry.source_language === 'ru'));
  assert.ok(synthesis.source_contributions.some((entry) => entry.source_kind === 'opiq_record' && entry.source_language === 'et'));
  assertValid(repository);
});

test('multiple Estonian Opiq records can contribute to a synthesis', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-water-use-cycle').topic_synthesis;
  const estonianMainContributors = synthesis.source_contributions.filter((entry) => entry.source_language === 'et'
    && entry.transformations.some((transformation) => transformation.output_layer === 'main_explanation'));
  assert.equal(estonianMainContributors.length, 2);
  assertValid(repository);
});

test('optional verified external supplement is valid', () => {
  const repository = cloneRepository();
  addExternalSource(repository);
  addExternalContribution(repository);
  assertValid(repository);
});

test('author-created explanation is valid only for explicitly uncovered concepts', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-settlements').topic_synthesis;
  assert.ok(synthesis.strategies.includes('author_created_explanation'));
  assert.ok(synthesis.source_contributions.find((entry) => entry.source_kind === 'author_created').authoring.uncovered_concepts.length > 0);
  assertValid(repository);
});

test('the shared production external registry may be empty', () => {
  const repository = cloneRepository();
  assert.deepEqual(repository.externalArtifacts[0].data.sources, []);
  assertValid(repository);
});

test('the existing water synthesis is production-ready', () => {
  const repository = cloneRepository();
  const water = unit(repository, 'grade-5-water-four-lesson-plan');
  assert.equal(water.topic_synthesis.readiness, 'ready');
  assert.equal(water.implementation_status, 'validated_production_unit');
  assertValid(repository);
});

test('an architecture-only synthesis may remain planned', () => {
  const repository = cloneRepository();
  assert.equal(unit(repository, 'grade-5-air-properties').topic_synthesis.readiness, 'planned');
  assertValid(repository);
});

test('direct Russian strategy using only Estonian records fails', () => {
  const repository = cloneRepository();
  unit(repository, 'grade-5-landforms-map').topic_synthesis.strategies = ['direct_opiq_ru'];
  assertFailsWith(repository, /direct_opiq_ru requires a selected Russian Opiq record/u);
});

test('translation strategy using only a Russian record fails', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-rivers-lakes').topic_synthesis;
  synthesis.strategies.push('translated_from_opiq_et');
  synthesis.source_contributions[0].transformations[0].transformation = 'translation';
  assertFailsWith(repository, /translation requires different source and output languages|translated_from_opiq_et requires/u);
});

test('adaptation referencing an unknown Opiq record fails', () => {
  const repository = cloneRepository();
  sourceContribution(repository, 'grade-5-landforms-map', 'landforms-map-et-koolibri').source_id = 'unknown-opiq-record';
  assertFailsWith(repository, /unknown selected Opiq record unknown-opiq-record/u);
});

test('adaptation cannot reference another unit source', () => {
  const repository = cloneRepository();
  sourceContribution(repository, 'grade-5-landforms-map', 'landforms-map-et-koolibri').source_id = 'settlements-et-koolibri';
  assertFailsWith(repository, /unknown selected Opiq record settlements-et-koolibri for unit grade-5-landforms-map/u);
});

test('multi-source synthesis with only one Opiq contributor fails', () => {
  const repository = cloneRepository();
  unit(repository, 'grade-5-settlements').topic_synthesis.strategies.push('synthesized_from_multiple_opiq_sources');
  assertFailsWith(repository, /requires at least two distinct Opiq contributors/u);
});

test('external contribution missing from registry fails', () => {
  const repository = cloneRepository();
  addExternalContribution(repository);
  assertFailsWith(repository, /external source synthetic-environment-source is absent from the registry/u);
});

test('external source cannot be represented as Opiq', () => {
  const repository = cloneRepository();
  addExternalSource(repository);
  addExternalContribution(repository);
  const contribution = unit(repository, 'grade-5-rivers-lakes').topic_synthesis.source_contributions.at(-1);
  contribution.source_kind = 'opiq_record';
  contribution.provenance.source_family = 'opiq';
  contribution.provenance.source_type = 'ordinary_textbook';
  assertFailsWith(repository, /external source synthetic-environment-source cannot be represented as an Opiq record/u);
});

test('Opiq record cannot be represented as external', () => {
  const repository = cloneRepository();
  const contribution = sourceContribution(repository, 'grade-5-rivers-lakes', 'rivers-ru-avita');
  contribution.source_kind = 'external_source';
  contribution.provenance.source_family = 'external';
  contribution.provenance.source_type = 'official_public_source';
  assertFailsWith(repository, /Opiq record rivers-ru-avita cannot be represented as external/u);
});

test('external registry entry requires an organization', () => {
  const repository = cloneRepository();
  const source = addExternalSource(repository);
  delete source.organization;
  assertFailsWith(repository, /missing required field organization/u);
});

test('external registry entry requires an instructional purpose', () => {
  const repository = cloneRepository();
  const source = addExternalSource(repository);
  delete source.instructional_purpose;
  assertFailsWith(repository, /missing required field instructional_purpose/u);
});

test('external registry entry requires a valid calendar verification date', () => {
  const repository = cloneRepository();
  const source = addExternalSource(repository);
  source.verified_on = '2026-02-30';
  assertFailsWith(repository, /verification date is not a valid calendar date/u);
});

test('external source cannot be treated as official curriculum evidence', () => {
  const repository = cloneRepository();
  const source = addExternalSource(repository);
  source.official_curriculum_evidence = true;
  assertFailsWith(repository, /must be equal to constant/u);
});

test('mandatory topic without a synthesis strategy fails', () => {
  const repository = cloneRepository();
  unit(repository, 'grade-5-rivers-lakes').topic_synthesis.strategies = [];
  assertFailsWith(repository, /must NOT have fewer than 1 items/u);
});

test('ready synthesis with pending review fails', () => {
  const repository = cloneRepository();
  unit(repository, 'grade-5-landforms-map').topic_synthesis.readiness = 'ready';
  assertFailsWith(repository, /ready synthesis cannot have mandatory review pending/u);
});

test('author-created explanation without a reason fails', () => {
  const repository = cloneRepository();
  const author = unit(repository, 'grade-5-settlements').topic_synthesis.source_contributions
    .find((entry) => entry.source_kind === 'author_created');
  delete author.authoring.reason;
  assertFailsWith(repository, /missing required field reason/u);
});

test('translated material requires source and output languages', () => {
  const repository = cloneRepository();
  const contribution = sourceContribution(repository, 'grade-5-landforms-map', 'landforms-map-et-koolibri');
  unit(repository, 'grade-5-landforms-map').topic_synthesis.strategies = ['translated_from_opiq_et'];
  contribution.transformations[0].transformation = 'translation';
  delete contribution.source_language;
  delete contribution.transformations[0].output_language;
  assertFailsWith(repository, /missing required field source_language|missing required field output_language/u);
});

test('selected Opiq source without a transformation contribution fails', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-rivers-lakes').topic_synthesis;
  synthesis.source_contributions = synthesis.source_contributions.filter((entry) => entry.source_id !== 'lakes-et-koolibri');
  assertFailsWith(repository, /selected source lakes-et-koolibri has no declared transformation contribution/u);
});

test('one selected source cannot be duplicated across contribution entries', () => {
  const repository = cloneRepository();
  const synthesis = unit(repository, 'grade-5-rivers-lakes').topic_synthesis;
  const duplicate = structuredClone(synthesis.source_contributions[0]);
  duplicate.contribution_id = 'duplicate-rivers-contribution';
  synthesis.source_contributions.push(duplicate);
  assertFailsWith(repository, /duplicate source contribution: opiq_record\|rivers-ru-avita/u);
});

test('main explanation output must match the course output language', () => {
  const repository = cloneRepository();
  sourceContribution(repository, 'grade-5-rivers-lakes', 'rivers-ru-avita').transformations[0].output_language = 'et';
  assertFailsWith(repository, /main explanation must use synthesis output language ru/u);
});

test('unknown synthesis strategy fails schema validation', () => {
  const repository = cloneRepository();
  unit(repository, 'grade-5-rivers-lakes').topic_synthesis.strategies[0] = 'guess_from_context';
  assertFailsWith(repository, /must be equal to one of the allowed values/u);
});

test('full annual completion remains forbidden while implementation is partial', () => {
  const repository = cloneRepository();
  const completeness = annual(repository).completeness;
  completeness.declared_complete = true;
  assertFailsWith(repository, /annual course cannot declare fully authored completion|complete architecture is not the same/u);
});
