import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {
  build2026ComplianceDerivedArtifacts,
  COMPLIANCE_PATHS,
  load2026ComplianceRepository,
  TARGET_SCHOOL_YEAR,
  validate2026ComplianceDerivedArtifacts,
  validate2026ComplianceRepository,
} from './lib/2026-27-compliance.mjs';
import {
  loadCurriculumMapRepository,
  parseStrictCurriculumYaml,
  validateCurriculumMapRepository,
} from './lib/curriculum-maps.mjs';

const rootDir = new URL('..', import.meta.url).pathname.replace(/\/$/u, '');
const repository = await load2026ComplianceRepository({ rootDir });

function cloneRepository() {
  return {
    ...repository,
    artifacts: Object.fromEntries(Object.entries(repository.artifacts).map(([key, artifact]) => [
      key,
      { ...artifact, data: structuredClone(artifact.data) },
    ])),
    manifest: structuredClone(repository.manifest),
    schemas: structuredClone(repository.schemas),
  };
}

async function mutationCodes(mutator, options) {
  const copy = cloneRepository();
  mutator(copy);
  const result = await validate2026ComplianceRepository(copy, options);
  return new Set(result.diagnostics.map((diagnostic) => diagnostic.code));
}

function source(sourceId, candidateRepository = repository) {
  return candidateRepository.artifacts.registry.data.sources.find((candidate) => candidate.source_id === sourceId);
}

function outcome(outcomeId, candidateRepository = repository) {
  return candidateRepository.artifacts.framework.data.outcome_sets
    .flatMap((set) => set.outcomes)
    .find((candidate) => candidate.outcome_or_requirement_id === outcomeId);
}

function outcomeSet(setId, candidateRepository = repository) {
  return candidateRepository.artifacts.framework.data.outcome_sets
    .find((candidate) => candidate.outcome_set_id === setId);
}

function requirement(requirementId, candidateRepository = repository) {
  return candidateRepository.artifacts.home.data.requirements
    .find((candidate) => candidate.requirement_id === requirementId);
}

test('official source registry targets the school year beginning 2026-09-01', async () => {
  assert.deepEqual(TARGET_SCHOOL_YEAR, {
    schoolYear: '2026/27',
    startsOn: '2026-09-01',
    endsOn: '2027-08-31',
  });
  const result = await validate2026ComplianceRepository(repository, { registryOnly: true });
  assert.equal(result.summary.errors, 0);
});

test('official source registry selects the PRÕK version effective on the target date', () => {
  const selected = source('ee-prok-2026-09-01');
  assert.equal(selected.consolidated_act_identifier, '123122025007');
  assert.equal(selected.version_effective_from, '2026-09-01');
  assert.equal(selected.target_school_year_applicability.status, 'applicable');
  assert.equal(selected.evidence_status, 'verified');
});

test('official source registry rejects the expiring PRÕK version for a 2026/27 claim', async () => {
  const codes = await mutationCodes((copy) => {
    outcome('ee-prk-2026-stage1-general-learning', copy).source_id = 'ee-prok-2025-12-26';
  });
  assert.ok(codes.has('verified_claim_source_inapplicable'));
});

test('official source registry selects the PLRÕK version effective on the target date', () => {
  const selected = source('ee-plrok-2026-09-01');
  assert.equal(selected.consolidated_act_identifier, '123122025005');
  assert.equal(selected.version_effective_from, '2026-09-01');
  assert.equal(selected.target_school_year_applicability.status, 'applicable');
});

test('official source registry records all PRÕK and PLRÕK appendices against their parents', () => {
  const sources = repository.artifacts.registry.data.sources;
  const prok = sources.filter((candidate) => candidate.parent_source_id === 'ee-prok-2026-09-01');
  const plrok = sources.filter((candidate) => candidate.parent_source_id === 'ee-plrok-2026-09-01');
  assert.equal(prok.length, 14);
  assert.equal(plrok.length, 3);
  for (const appendix of [...prok, ...plrok]) {
    const parent = source(appendix.parent_source_id);
    assert.equal(appendix.consolidated_act_identifier, parent.consolidated_act_identifier);
    assert.equal(appendix.official_url, parent.official_url);
  }
});

test('official source registry rejects an appendix attached to the wrong parent identity', async () => {
  const codes = await mutationCodes((copy) => {
    source('ee-prok-2026-appendix-01', copy).consolidated_act_identifier = '123122025005';
  }, { registryOnly: true });
  assert.ok(codes.has('appendix_parent_identity_mismatch'));
});

test('official source registry archived excerpt hashes are current', async () => {
  const result = await validate2026ComplianceRepository(repository, { registryOnly: true });
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'archived_source_identity_stale'), false);
  const excerpt = source('ee-home-reg-2025-09-19').archived_excerpt;
  assert.equal((await fs.readFile(`${rootDir}/${excerpt.path}`, 'utf8')).includes('vähemalt üks kord kuus'), true);
});

test('official source registry includes the original amendment clauses effective 2026-09-01', () => {
  const amendment = source('ee-curriculum-amendment-2025-06-25');
  assert.equal(amendment.official_url, 'https://www.riigiteataja.ee/akt/125062025001');
  assert.equal(amendment.target_school_year_applicability.status, 'applicable');
  assert.match(amendment.archived_excerpt.scope_note, /01\.09\.2026/u);
});

test('official source registry detects a stale archived excerpt identity', async () => {
  const codes = await mutationCodes((copy) => {
    source('ee-home-reg-2025-09-19', copy).archived_excerpt.content_identity.value = 'a'.repeat(64);
  }, { registryOnly: true });
  assert.ok(codes.has('archived_source_identity_stale'));
});

test('school-stage and exact-grade scopes remain distinct', () => {
  const stage = outcome('ee-prk-2026-stage2-general-self-correction').scope;
  const exact = outcome('ee-plrk-2026-grade4-mathematics-number-range').scope;
  assert.deepEqual(stage, {
    kind: 'school_stage',
    school_stage: 2,
    terminal_grade: 6,
    exact_grade_claimed: false,
  });
  assert.deepEqual(exact, { kind: 'exact_grade', grade: 4, exact_grade_claimed: true });
});

test('Grade 2 relevance is not represented as a nationally exact Grade 2 outcome', () => {
  const relevant = repository.artifacts.framework.data.outcome_sets
    .filter((set) => set.curriculum === 'ordinary')
    .flatMap((set) => set.outcomes)
    .filter((candidate) => candidate.downstream_relevance.grade_2);
  assert.ok(relevant.length > 0);
  assert.ok(relevant.every((candidate) => candidate.scope.kind === 'school_stage' && candidate.scope.school_stage === 1));
});

test('Grade 4 ordinary relevance is not represented as a nationally exact Grade 4 outcome', () => {
  const relevant = repository.artifacts.framework.data.outcome_sets
    .filter((set) => set.curriculum === 'ordinary')
    .flatMap((set) => set.outcomes)
    .filter((candidate) => candidate.downstream_relevance.grade_4);
  assert.ok(relevant.length > 0);
  assert.ok(relevant.every((candidate) => candidate.scope.kind === 'school_stage' && candidate.scope.school_stage === 2));
});

test('current Grade 4 routes consume school-stage II outcomes without exact-grade claims', () => {
  const indexed = build2026ComplianceDerivedArtifacts(repository).get(COMPLIANCE_PATHS.outcomeIndex);
  assert.match(indexed, /grade-4-mathematics/u);
  assert.match(indexed, /school_stage/u);
  assert.match(indexed, /exact_grade_claimed: false/u);
});

test('formative assessment principles are explicit for both school stages', () => {
  for (const id of [
    'ee-prk-2026-stage1-assessment-formative',
    'ee-prk-2026-stage2-assessment-formative',
  ]) {
    const candidate = outcome(id);
    assert.equal(candidate.requirement_kind, 'assessment_principle');
    assert.equal(candidate.scope.kind, 'school_stage');
  }
});

test('school class allocation remains a local school duty rather than a national exact-grade outcome', () => {
  for (const id of [
    'ee-prk-2026-stage1-school-curriculum-class-allocation',
    'ee-prk-2026-stage2-school-curriculum-class-allocation',
  ]) {
    const candidate = outcome(id);
    assert.equal(candidate.requirement_kind, 'school_curriculum_allocation');
    assert.equal(candidate.scope.kind, 'school_stage');
    assert.equal(candidate.scope.exact_grade_claimed, false);
  }
});

test('Estonian and Estonian as a second language remain separate downstream routes', () => {
  const language = outcomeSet('ee-prk-2026-stage2-language').outcomes;
  const routeIds = new Set(language.flatMap((candidate) => candidate.downstream_relevance.route_ids));
  assert.ok(routeIds.has('grade-4-estonian'));
  assert.ok(routeIds.has('grade-4-estonian-second-language'));
  assert.notEqual('grade-4-estonian', 'grade-4-estonian-second-language');
});

test('ordinary and simplified curricula remain separate', () => {
  for (const set of repository.artifacts.framework.data.outcome_sets) {
    for (const candidate of set.outcomes) {
      for (const routeId of candidate.downstream_relevance.route_ids) {
        assert.equal(routeId.endsWith('-simplified'), set.curriculum === 'simplified');
      }
    }
  }
});

test('Russian language and Russian reading remain separate downstream subjects', () => {
  const routeIds = new Set(repository.artifacts.framework.data.outcome_sets
    .flatMap((set) => set.outcomes)
    .flatMap((candidate) => candidate.downstream_relevance.route_ids));
  assert.ok(routeIds.has('grade-4-russian'));
  assert.ok(routeIds.has('grade-4-russian-reading'));
});

test('mixed human and society route maps explicit official subjects instead of inventing one', () => {
  const matchingSets = repository.artifacts.framework.data.outcome_sets.filter((set) =>
    set.outcomes.some((candidate) =>
      candidate.downstream_relevance.route_ids.includes('grade-4-human-studies-and-society')));
  assert.deepEqual(
    new Set(matchingSets.map((set) => set.official_subject)),
    new Set(['inimeseõpetus', 'ühiskonnaõpetus']),
  );
  assert.equal(matchingSets.some((set) => set.official_subject === 'human_studies_and_society'), false);
});

test('parent-requested home learning requires an individual curriculum', () => {
  const practice = repository.artifacts.home.data.family_evidence_practices
    .find((candidate) => candidate.practice_id === 'individual-curriculum');
  assert.equal(practice.classification, 'nationally_required');
  assert.match(practice.legal_basis, /§§ 5–7/u);
});

test('the applicable home-learning regulation requires school control at least monthly', () => {
  const monthly = requirement('ee-home-reg-2025-monthly-control');
  assert.equal(monthly.source_id, 'ee-home-reg-2025-09-19');
  assert.equal(monthly.obligation_holder, 'school');
  assert.equal(monthly.requirement_level, 'mandatory');
  assert.match(monthly.official_wording_et, /vähemalt üks kord kuus/u);
});

test('parent, school and director obligations are represented separately', () => {
  const holders = new Set(repository.artifacts.home.data.requirements.map((candidate) => candidate.obligation_holder));
  assert.ok(holders.has('parent'));
  assert.ok(holders.has('school'));
  assert.ok(holders.has('director'));
  assert.ok(holders.has('joint'));
});

test('mandatory and school-specific home-learning practices remain separate', () => {
  const practices = new Map(repository.artifacts.home.data.family_evidence_practices
    .map((candidate) => [candidate.practice_id, candidate.classification]));
  assert.equal(practices.get('monthly-school-check'), 'nationally_required');
  assert.equal(practices.get('weekly-report'), 'school_specific');
});

test('portfolio recommendations cannot become nationally required without legal basis', async () => {
  const codes = await mutationCodes((copy) => {
    const practice = copy.artifacts.home.data.family_evidence_practices
      .find((candidate) => candidate.practice_id === 'family-portfolio');
    practice.classification = 'nationally_required';
  });
  assert.ok(codes.has('unsupported_national_family_evidence_claim'));
});

test('all home-learning interruption triggers and return timing are represented', () => {
  const ids = new Set(repository.artifacts.home.data.requirements.map((candidate) => candidate.requirement_id));
  for (const id of [
    'ee-home-reg-2025-interruption-unmet-outcomes',
    'ee-home-reg-2025-interruption-unverifiable',
    'ee-home-reg-2025-interruption-best-interest',
    'ee-home-reg-2025-interruption-other-barrier',
    'ee-home-reg-2025-return-next-school-day',
  ]) assert.ok(ids.has(id));
});

test('every Russian curriculum translation declares provenance', () => {
  const outcomes = repository.artifacts.framework.data.outcome_sets.flatMap((set) => set.outcomes);
  assert.ok(outcomes.every((candidate) => candidate.translation_ru.length > 0));
  assert.ok(outcomes.every((candidate) =>
    ['opiq_helper_translation', 'official_translation'].includes(candidate.translation_provenance.kind)));
  assert.ok(outcomes.every((candidate) => candidate.translation_provenance.source_language === 'et'));
});

test('all verified official claims resolve to applicable primary sources', async () => {
  const result = await validate2026ComplianceRepository(repository);
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'verified_claim_source_inapplicable'), false);
});

test('authored home requirements must preserve wording found in the archived official source', async () => {
  const codes = await mutationCodes((copy) => {
    requirement('ee-home-reg-2025-monthly-control', copy).official_wording_et =
      'Kool kontrollib tulemusi mõnikord.';
  });
  assert.ok(codes.has('official_wording_not_in_archived_source'));
});

test('future sources cannot support a claim before their effective date', async () => {
  const codes = await mutationCodes((copy) => {
    source('ee-prok-2026-appendix-01', copy).version_effective_from = '2026-10-01';
  });
  assert.ok(codes.has('source_not_effective_for_target_year'));
});

test('effective dates are present for every outcome and requirement', () => {
  const outcomes = repository.artifacts.framework.data.outcome_sets.flatMap((set) => set.outcomes);
  assert.ok(outcomes.every((candidate) => /^\d{4}-\d{2}-\d{2}$/u.test(candidate.effective_from)));
  assert.ok(repository.artifacts.home.data.requirements
    .every((candidate) => /^\d{4}-\d{2}-\d{2}$/u.test(candidate.effective_from)));
});

test('declared completeness fails while known gaps remain', async () => {
  const codes = await mutationCodes((copy) => {
    copy.artifacts.framework.data.completeness.declared_complete = true;
    copy.artifacts.framework.data.completeness.status = 'verified';
  });
  assert.ok(codes.has('false_completeness_claim'));
});

test('official source identities and derived artifacts are deterministic', () => {
  const first = build2026ComplianceDerivedArtifacts(repository);
  const second = build2026ComplianceDerivedArtifacts(repository);
  assert.deepEqual([...first], [...second]);
  assert.ok(repository.artifacts.registry.data.sources
    .every((candidate) => /^[a-f0-9]{64}$/u.test(candidate.content_identity.value)));
});

test('stale generated compliance artifacts fail freshness checking', async () => {
  const artifacts = build2026ComplianceDerivedArtifacts(repository);
  artifacts.set(COMPLIANCE_PATHS.familyBrief, `${artifacts.get(COMPLIANCE_PATHS.familyBrief)}stale\n`);
  const diagnostics = await validate2026ComplianceDerivedArtifacts(repository, artifacts);
  assert.ok(diagnostics.some((diagnostic) =>
    diagnostic.file === COMPLIANCE_PATHS.familyBrief
    && diagnostic.code === 'generated_compliance_artifact_stale'));
});

test('existing route-linked curriculum validation remains green', async () => {
  const curriculumRepository = await loadCurriculumMapRepository({ rootDir });
  const result = validateCurriculumMapRepository(curriculumRepository);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.artifacts, 5);
});

test('existing official curriculum maps still reject a missing manifest route', async () => {
  const curriculumRepository = await loadCurriculumMapRepository({ rootDir });
  const copy = {
    ...curriculumRepository,
    manifest: structuredClone(curriculumRepository.manifest),
  };
  const official = copy.artifacts.find((artifact) => artifact.data.artifact_type === 'official_curriculum_map');
  copy.manifest.sources = copy.manifest.sources.filter(
    (candidate) => !(candidate.grade === official.data.grade && candidate.subject === official.data.subject),
  );
  const result = validateCurriculumMapRepository(copy);
  assert.ok(result.diagnostics.some((diagnostic) =>
    diagnostic.reason.includes('expected exactly one manifest route')));
});

test('the release checklist cannot be ready while blocking checks remain', async () => {
  const codes = await mutationCodes((copy) => {
    copy.artifacts.checklist.data.release_status = 'ready';
  });
  assert.ok(codes.has('release_status_false_positive'));
});

test('family brief labels recommendations and legal non-guarantees', () => {
  const brief = build2026ComplianceDerivedArtifacts(repository).get(COMPLIANCE_PATHS.familyBrief);
  assert.match(brief, /не индивидуальная юридическая консультация/u);
  assert.match(brief, /recommended_good_practice/u);
  assert.match(brief, /не реже одного раза в месяц/u);
});

test('strict YAML parsing rejects duplicate keys in compliance artifacts', () => {
  assert.throws(
    () => parseStrictCurriculumYaml('schema_version: "1.0"\nschema_version: "1.0"\n', '<duplicate>'),
    /Map keys must be unique/u,
  );
});
