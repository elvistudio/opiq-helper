import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clonePedagogyKnowledge,
  createPedagogySchemaValidators,
  loadPedagogyKnowledge,
  parseStrictPedagogyYaml,
  validatePedagogyKnowledge,
} from './lib/pedagogy-knowledge.mjs';

const production = await loadPedagogyKnowledge();

function fresh() {
  return clonePedagogyKnowledge(production);
}

function validationMessages(result) {
  return result.errors.map((error) => `${error.file} ${error.field} ${error.reason}`).join('\n');
}

function expectInvalid(repository, pattern) {
  const result = validatePedagogyKnowledge(repository);
  assert.equal(result.valid, false);
  assert.match(validationMessages(result), pattern);
  return result;
}

test('production pedagogical knowledge validates', () => {
  const result = validatePedagogyKnowledge(fresh());
  assert.equal(result.valid, true, validationMessages(result));
  assert.deepEqual(result.counts, {
    references: 2,
    principles: 15,
    activities: 30,
    patterns: 4,
  });
});

test('all five JSON schemas compile in strict mode', () => {
  const validators = createPedagogySchemaValidators(production.schemas);
  assert.deepEqual(Object.keys(validators).sort(), ['activity', 'pattern', 'principle', 'reference']);
});

test('private supplied references have conservative copyright metadata', () => {
  const references = production.references.data.references;
  assert.equal(references.length, 2);
  for (const reference of references) {
    assert.equal(reference.access_type, 'user_supplied');
    assert.equal(reference.original_file_committed, false);
    assert.equal(reference.redistribution_status, 'not_verified');
    assert.equal(reference.quotation_policy, 'summaries_only');
    assert.equal(reference.official_curriculum_authority, false);
  }
});

test('missing redistribution status fails', () => {
  const repository = fresh();
  delete repository.references.data.references[0].redistribution_status;
  expectInvalid(repository, /redistribution_status/u);
});

test('unverified reference with original file committed fails', () => {
  const repository = fresh();
  repository.references.data.references[0].original_file_committed = true;
  expectInvalid(repository, /must be equal to constant|unverified redistribution/u);
});

test('unverified reference with unrestricted quotation policy fails', () => {
  const repository = fresh();
  repository.references.data.references[0].quotation_policy = 'unrestricted';
  expectInvalid(repository, /quotation_policy|must be equal to one of the allowed values/u);
});

test('pedagogical reference cannot claim official curriculum authority', () => {
  const repository = fresh();
  repository.references.data.references[0].official_curriculum_authority = true;
  expectInvalid(repository, /official_curriculum_authority/u);
});

test('unknown reference language fails', () => {
  const repository = fresh();
  repository.references.data.references[0].language = 'de';
  expectInvalid(repository, /language/u);
});

test('duplicate reference ID fails', () => {
  const repository = fresh();
  repository.references.data.references[1].reference_id =
    repository.references.data.references[0].reference_id;
  expectInvalid(repository, /duplicate reference ID/u);
});

test('unsorted references fail deterministic ordering', () => {
  const repository = fresh();
  repository.references.data.references.reverse();
  expectInvalid(repository, /references must be sorted bytewise/u);
});

test('unknown schema version fails', () => {
  const repository = fresh();
  repository.references.data.schema_version = '2.0';
  expectInvalid(repository, /schema_version|must be equal to constant/u);
});

test('unexpected reference field fails strict schema', () => {
  const repository = fresh();
  repository.references.data.references[0].license_guess = 'probably-open';
  expectInvalid(repository, /additional properties|license_guess/u);
});

test('a valid production principle passes its schema', () => {
  const validators = createPedagogySchemaValidators(production.schemas);
  assert.equal(validators.principle(production.principles[0].data), true);
});

test('principle missing provenance fails', () => {
  const repository = fresh();
  delete repository.principles[0].data.provenance_claims;
  expectInvalid(repository, /provenance_claims/u);
});

test('principle with reversed grade range fails', () => {
  const repository = fresh();
  repository.principles[0].data.suitable_grades = { min: 8, max: 5 };
  expectInvalid(repository, /grade minimum must not exceed/u);
});

test('principle with unknown confidence fails', () => {
  const repository = fresh();
  repository.principles[0].data.confidence.level = 'certain';
  expectInvalid(repository, /confidence|must be equal to one of the allowed values/u);
});

test('source-supported principle claim without reference fails', () => {
  const repository = fresh();
  const claim = repository.principles[0].data.provenance_claims
    .find((candidate) => candidate.claim_origin === 'source_supported');
  claim.reference_ids = [];
  expectInvalid(repository, /reference_ids|source_supported claim/u);
});

test('project-authored principle claim attributed to source fails', () => {
  const repository = fresh();
  const claim = repository.principles[0].data.provenance_claims
    .find((candidate) => candidate.claim_origin === 'project_authored_design');
  claim.reference_ids = ['gag-opiraam-opistrateegiad'];
  expectInvalid(repository, /project_authored_design|must NOT have more than 0 items/u);
});

test('dangling principle provenance reference fails', () => {
  const repository = fresh();
  repository.principles[0].data.provenance_claims[0].reference_ids = ['missing-reference'];
  expectInvalid(repository, /unknown pedagogical reference missing-reference/u);
});

test('principle filename must match stable ID', () => {
  const repository = fresh();
  repository.principles[0].file = 'knowledge/pedagogy/principles/wrong-name.yaml';
  expectInvalid(repository, /principle file must be named/u);
});

test('duplicate principle ID fails', () => {
  const repository = fresh();
  repository.principles[1].data.principle_id = repository.principles[0].data.principle_id;
  expectInvalid(repository, /duplicate principle ID/u);
});

test('unsorted principle discovery fails', () => {
  const repository = fresh();
  [repository.principles[0], repository.principles[1]] =
    [repository.principles[1], repository.principles[0]];
  expectInvalid(repository, /principle files must be sorted bytewise/u);
});

test('grade 5 principle applicability requires classroom and homeschool', () => {
  const repository = fresh();
  repository.principles[0].data.grade5_science_applicability.delivery_modes =
    ['classroom', 'remote'];
  expectInvalid(repository, /must include homeschool/u);
});

test('a valid classroom and homeschool activity passes its schema', () => {
  const validators = createPedagogySchemaValidators(production.schemas);
  const activity = production.activities.data.activities
    .find((candidate) => candidate.activity_id === 'retrieval-self-test');
  assert.equal(validators.activity({
    schema_version: '1.0',
    artifact_type: 'pedagogical_activity_catalog',
    activities: [activity],
  }), true);
});

test('activity with dangling principle reference fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].linked_principle_ids = ['unknown-principle'];
  expectInvalid(repository, /unknown pedagogical principle unknown-principle/u);
});

test('activity with impossible duration fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].duration = { min_minutes: 30, max_minutes: 5 };
  expectInvalid(repository, /duration minimum must not exceed/u);
});

test('discussion-heavy activity cannot claim zero interaction demand', () => {
  const repository = fresh();
  const activity = repository.activities.data.activities
    .find((candidate) => candidate.activity_id === 'silent-discussion');
  activity.language_demand.interaction = 'none';
  expectInvalid(repository, /interaction-heavy and cannot have none/u);
});

test('homeschool activity missing adult role fails', () => {
  const repository = fresh();
  delete repository.activities.data.activities[0].homeschool_adaptation.adult_role_ru;
  expectInvalid(repository, /adult_role_ru/u);
});

test('activity with safety risk but no supervision fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].safety.risk_level = 'moderate';
  repository.activities.data.activities[0].safety.requires_adult_supervision = false;
  expectInvalid(repository, /safety risk must require adult supervision/u);
});

test('supervised activity needs explicit homeschool safety role', () => {
  const repository = fresh();
  repository.activities.data.activities[0].safety.risk_level = 'low';
  repository.activities.data.activities[0].safety.requires_adult_supervision = true;
  repository.activities.data.activities[0].homeschool_adaptation.adult_safety_supervision_ru = null;
  expectInvalid(repository, /requires explicit homeschool adult safety metadata/u);
});

test('duplicate activity ID fails', () => {
  const repository = fresh();
  repository.activities.data.activities[1].activity_id =
    repository.activities.data.activities[0].activity_id;
  expectInvalid(repository, /duplicate activity ID/u);
});

test('duplicate localized activity name fails', () => {
  const repository = fresh();
  repository.activities.data.activities[1].names.ru =
    repository.activities.data.activities[0].names.ru;
  expectInvalid(repository, /duplicate ru activity name/u);
});

test('activity with incompatible phase and category fails', () => {
  const repository = fresh();
  const activity = repository.activities.data.activities
    .find((candidate) => candidate.activity_id === 'brainstorming');
  activity.suitable_lesson_phases = ['homework'];
  expectInvalid(repository, /has no compatible lesson phase/u);
});

test('activity with unknown phase fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].suitable_lesson_phases = ['warm_up'];
  expectInvalid(repository, /suitable_lesson_phases|allowed values/u);
});

test('activity source claim with dangling reference fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].source_provenance[0].reference_ids =
    ['missing-reference'];
  expectInvalid(repository, /unknown pedagogical reference missing-reference/u);
});

test('activity catalog requires a source-supported claim', () => {
  const repository = fresh();
  const activity = repository.activities.data.activities[0];
  activity.source_provenance[0].claim_origin = 'common_pedagogical_knowledge';
  activity.source_provenance[0].reference_ids = [];
  expectInvalid(repository, /at least one source_supported claim is required/u);
});

test('activity project-authored guidance cannot be reattributed', () => {
  const repository = fresh();
  repository.activities.data.activities[0].project_authored_guidance.claim_origin =
    'source_supported';
  expectInvalid(repository, /project_authored_guidance|must be equal to constant/u);
});

test('activity grade 5 applicability requires homeschool', () => {
  const repository = fresh();
  repository.activities.data.activities[0].grade5_science_applicability.delivery_modes =
    ['classroom', 'remote'];
  expectInvalid(repository, /must include homeschool/u);
});

test('activity with incompatible homeschool declaration fails', () => {
  const repository = fresh();
  repository.activities.data.activities[0].delivery_modes = ['classroom', 'remote'];
  expectInvalid(repository, /requires a compatible delivery mode/u);
});

test('assessment role none cannot be combined with formative', () => {
  const repository = fresh();
  repository.activities.data.activities[0].assessment_roles = ['none', 'formative'];
  expectInvalid(repository, /none cannot be combined/u);
});

test('unsorted activity catalog fails deterministic ordering', () => {
  const repository = fresh();
  [repository.activities.data.activities[0], repository.activities.data.activities[1]] =
    [repository.activities.data.activities[1], repository.activities.data.activities[0]];
  expectInvalid(repository, /activities must be sorted bytewise/u);
});

test('unexpected activity field fails strict schema', () => {
  const repository = fresh();
  repository.activities.data.activities[0].effectiveness = 'guaranteed';
  expectInvalid(repository, /additional properties|effectiveness/u);
});

test('a valid flexible pattern passes its schema', () => {
  const validators = createPedagogySchemaValidators(production.schemas);
  assert.equal(validators.pattern(production.patterns[0].data), true);
});

test('pattern with unknown activity reference fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].recommended_components[0]
    .activity_options = ['unknown-activity'];
  expectInvalid(repository, /unknown pedagogical activity unknown-activity/u);
});

test('pattern with unknown principle reference fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].recommended_components[0]
    .linked_principle_ids = ['unknown-principle'];
  expectInvalid(repository, /unknown pedagogical principle unknown-principle/u);
});

test('rigid pattern variation policy fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].variation_policy.variation_allowed = false;
  expectInvalid(repository, /variation_allowed|must be equal to constant/u);
});

test('pattern missing variation policy fails', () => {
  const repository = fresh();
  delete repository.patterns[0].data.patterns[0].variation_policy;
  expectInvalid(repository, /variation_policy/u);
});

test('pattern with non-contiguous sequence fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].recommended_components[1].sequence = 7;
  expectInvalid(repository, /component sequence must be contiguous/u);
});

test('pattern that prescribes one rigid activity everywhere fails', () => {
  const repository = fresh();
  for (const component of repository.patterns[0].data.patterns[0].recommended_components) {
    component.activity_options = [component.activity_options[0]];
  }
  expectInvalid(repository, /flexible pattern must offer more than one activity/u);
});

test('pattern provenance with dangling reference fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].source_provenance[0].reference_ids =
    ['unknown-reference'];
  expectInvalid(repository, /unknown pedagogical reference unknown-reference/u);
});

test('pattern with reversed grade range fails', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns[0].suitable_grades = { min: 9, max: 2 };
  expectInvalid(repository, /grade minimum must not exceed/u);
});

test('unsorted patterns fail deterministic ordering', () => {
  const repository = fresh();
  repository.patterns[0].data.patterns.reverse();
  expectInvalid(repository, /patterns must be sorted bytewise/u);
});

test('duplicate pattern ID fails across catalogs', () => {
  const repository = fresh();
  repository.patterns[1].data.patterns[0].pattern_id =
    repository.patterns[0].data.patterns[0].pattern_id;
  expectInvalid(repository, /duplicate pattern ID/u);
});

test('strict YAML rejects duplicate keys', () => {
  assert.throws(
    () => parseStrictPedagogyYaml('schema_version: "1.0"\nschema_version: "1.0"\n', 'duplicate.yaml'),
    /invalid YAML|Map keys must be unique/u,
  );
});

test('strict YAML rejects tabs', () => {
  assert.throws(
    () => parseStrictPedagogyYaml('schema_version:\t"1.0"\n', 'tabs.yaml'),
    /tabs are not allowed/u,
  );
});

test('strict YAML rejects aliases', () => {
  assert.throws(
    () => parseStrictPedagogyYaml(
      'schema_version: &version "1.0"\nartifact_type: *version\n',
      'alias.yaml',
    ),
    /Excessive alias count|[Aa]lias/u,
  );
});

test('PDF in pedagogical knowledge is rejected', () => {
  const repository = fresh();
  repository.allFiles.push('knowledge/pedagogy/references/original.pdf');
  expectInvalid(repository, /original PDF documents must not be committed/u);
});

test('symlink in pedagogical knowledge is rejected', () => {
  const repository = fresh();
  repository.symlinks.push('knowledge/pedagogy/references/latest.yaml');
  expectInvalid(repository, /symlinks are not allowed/u);
});

test('file discovery is deterministic', async () => {
  const second = await loadPedagogyKnowledge();
  assert.deepEqual(second.allFiles, production.allFiles);
  assert.deepEqual(
    second.principles.map((artifact) => artifact.file),
    production.principles.map((artifact) => artifact.file),
  );
});

test('validation output is deterministic', () => {
  const first = validatePedagogyKnowledge(fresh());
  const second = validatePedagogyKnowledge(fresh());
  assert.deepEqual(second, first);
});

test('production patterns remain recommendations rather than lesson DNA', () => {
  for (const artifact of production.patterns) {
    for (const pattern of artifact.data.patterns) {
      assert.equal(pattern.variation_policy.variation_allowed, true);
      assert.equal(pattern.variation_policy.required_exception_rationale, false);
      assert.ok(pattern.recommended_components.some((component) => component.activity_options.length > 1));
    }
  }
});

test('production homeschool records separate child, adult, safety, and teacher roles', () => {
  for (const activity of production.activities.data.activities) {
    assert.ok(activity.homeschool_adaptation.child_responsibility_ru);
    assert.ok(activity.homeschool_adaptation.adult_role_ru);
    assert.ok(Object.hasOwn(activity.homeschool_adaptation, 'adult_safety_supervision_ru'));
    assert.ok(activity.homeschool_adaptation.subject_teacher_responsibility_ru);
  }
  for (const artifact of production.patterns) {
    for (const pattern of artifact.data.patterns) {
      assert.deepEqual(
        Object.keys(pattern.role_boundaries).sort(),
        [
          'adult_safety_supervision_ru',
          'adult_support_ru',
          'child_responsibility_ru',
          'subject_teacher_responsibility_ru',
        ],
      );
    }
  }
});
