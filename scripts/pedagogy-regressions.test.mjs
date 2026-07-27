import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildPedagogyRegressionReport,
  checkPedagogyRegressionReport,
  loadCommittedPedagogyRegressionReport,
  loadPedagogyRegressionRepository,
  PEDAGOGY_REGRESSION_REPORT,
  parseStrictPedagogyRegressionYaml,
  regressionSemanticDigest,
  runPedagogyRegressions,
  serializePedagogyRegressionReport,
  validateArchitectureOnlyResult,
  validateCommittedPedagogyRegressionReport,
  validatePedagogyRegressionConfiguration,
  validatePedagogyRegressionReport,
} from './lib/pedagogy-regressions.mjs';

const repository = await loadPedagogyRegressionRepository();
const run = await runPedagogyRegressions(repository);
const report = buildPedagogyRegressionReport(repository, run);
const committedReport = await loadCommittedPedagogyRegressionReport(repository);

const repositoryMutationCases = repository.fixtures.cases.filter(
  (item) => item.handler_id === 'repository-artifact-mutation',
);

function result(regressionId) {
  const found = run.results.find((item) => item.regression_id === regressionId);
  assert.ok(found, `missing regression result ${regressionId}`);
  return found;
}

function assertExpectedDiagnostic(regressionId, code) {
  const item = result(regressionId);
  assert.equal(item.status, 'passed');
  assert.ok(item.diagnostics.some((diagnostic) => diagnostic.code === code));
  assert.ok(item.invariants.every((invariant) => invariant.status === 'passed'));
}

test('production regression configuration and strict schemas validate', () => {
  assert.deepEqual(repository.configurationErrors, []);
  assert.equal(repository.validators.cases(repository.fixtures), true);
  assert.deepEqual(validatePedagogyRegressionReport(repository, report), []);
});

test('catalogue contains six bounded case kinds including evidence readiness', () => {
  assert.deepEqual(report.counts.by_case_kind, {
    architecture_only: 5,
    deliberate_failure: 14,
    evidence_readiness: 35,
    production_classroom: 7,
    production_homeschool: 3,
    stale_evidence: 7,
  });
  assert.equal(report.counts.total, 71);
});

test('all two hundred and forty-six meaningful invariant checks pass', () => {
  assert.deepEqual(report.counts.invariants, {
    total: 246,
    passed: 246,
    failed: 0,
  });
  assert.equal(report.counts.failed, 0);
  assert.equal(report.claims.all_regression_cases_passed, true);
});

test('four-lesson production water pilot remains structurally complete', () => {
  assert.equal(report.claims.production_water_pilot_structurally_complete, true);
  for (const item of run.results.filter(
    (candidate) => candidate.case_kind.startsWith('production_'),
  )) {
    assert.equal(item.actual_claims.pedagogy_schema_valid, true);
    assert.equal(item.actual_claims.structurally_complete, true);
  }
});

test('production report never promotes review, trial, readiness or effectiveness', () => {
  assert.equal(report.claims.teacher_approved, false);
  assert.equal(report.claims.classroom_ready, false);
  assert.equal(report.claims.homeschool_ready, false);
  assert.equal(report.claims.effectiveness_claimed, false);
  assert.equal(report.claims.curriculum_complete, false);
});

test('all thirty-five evidence-readiness regressions reload temporary artifacts', () => {
  const readiness = run.results.filter(
    (item) => item.case_kind === 'evidence_readiness',
  );
  assert.equal(readiness.length, 35);
  assert.ok(readiness.every((item) => item.status === 'passed'));
  assert.ok(readiness.every(
    (item) => item.handler_id === 'evidence-readiness-scenario',
  ));
  assert.ok(readiness.every(
    (item) => item.invariants.some(
      (invariant) => invariant.invariant_id === 'readiness_result_matches',
    ),
  ));
});

for (const [regressionId, targetId] of [
  ['architecture-ecosystem-comparison', 'venn-diagram'],
  ['architecture-justified-nonstandard', 'concept-map'],
  ['architecture-map-data', 'learning-stations::map-data'],
  ['architecture-scaffolded-learner', 'guided-reading'],
  ['architecture-self-explanation', 'self-explanation'],
]) {
  test(`${regressionId} remains architecture-only and deterministic`, () => {
    const item = result(regressionId);
    assert.equal(item.status, 'passed');
    assert.equal(item.source_status, 'architecture_only');
    assert.equal(item.actual_claims.production_ready, false);
    assert.ok(item.selected_target_ids.includes(targetId));
    assert.ok(item.non_guarantees.includes('not_production_material'));
  });
}

test('justified nonstandard pattern preserves the accepted override rationale', () => {
  const item = result('architecture-justified-nonstandard');
  const invariant = item.invariants.find(
    (candidate) => candidate.invariant_id === 'teacher_override_rationale_preserved',
  );
  assert.equal(invariant?.status, 'passed');
  assert.equal(item.actual_claims.production_ready, false);
});

test('production classroom cases cover concept, practical, collaboration, retrieval and assessment', () => {
  const ids = run.results.filter(
    (item) => item.case_kind === 'production_classroom',
  ).map((item) => item.regression_id);
  assert.deepEqual(ids, [
    'production-classroom-assessment-separation',
    'production-classroom-collaboration',
    'production-classroom-concept-introduction',
    'production-classroom-delayed-retrieval',
    'production-classroom-quiet-individual',
    'production-classroom-retrieval-correction',
    'production-classroom-safe-practical',
  ]);
});

test('production homeschool cases keep bounded parent roles and practical safety', () => {
  for (const regressionId of [
    'production-homeschool-low-support',
    'production-homeschool-practical-safety',
    'production-homeschool-reselected-contract',
  ]) {
    const item = result(regressionId);
    assert.equal(item.status, 'passed');
    assert.equal(item.actual_claims.production_ready, false);
  }
});

test('open-source retrieval mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-open-source-retrieval', 'retrieval_cycle_invalid');
});

test('immediate retrieval mutation is not accepted as delayed practice', () => {
  assertExpectedDiagnostic('deliberate-immediate-retrieval', 'delayed_retrieval_not_forward');
});

test('timing overflow mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-timing-overflow', 'timing_reconciliation_failed');
});

test('language demand above ceiling mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-language-demand', 'language_role_incompatible');
});

test('classroom-only homeschool mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-classroom-method-home', 'homeschool_material_closure_invalid');
});

test('parent subject-teaching mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-parent-subject-teaching', 'homeschool_material_closure_invalid');
});

test('missing adult supervision mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-missing-supervision', 'safety_contract_invalid');
});

test('missing adapted task contract mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-missing-adapted-contract', 'homeschool_material_closure_invalid');
});

test('learner answer leakage mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-answer-leak', 'learner_answer_leak');
});

test('combined subject and language assessment mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-assessment-combined', 'language_role_incompatible');
});

test('wrong worksheet task and key binding mutation is detected', () => {
  assertExpectedDiagnostic('deliberate-wrong-task-binding', 'cross_artifact_alignment_failed');
});

test('age-inappropriate selection is rejected by the selection engine', () => {
  assertExpectedDiagnostic('deliberate-age-inappropriate', 'no_candidate_for_required_slot');
});

test('operationally incompatible method selection is rejected', () => {
  assertExpectedDiagnostic(
    'deliberate-incompatible-method-selection',
    'invalid_teacher_override',
  );
});

test('architecture-only production-ready claim is rejected', () => {
  assertExpectedDiagnostic(
    'deliberate-architecture-ready-claim',
    'architecture_only_readiness_claim',
  );
});

test('stale catalogue digest is detected', () => {
  assertExpectedDiagnostic('stale-catalogue-digest', 'pedagogy_identity_stale');
});

test('stale taxonomy version is detected', () => {
  assertExpectedDiagnostic('stale-taxonomy-version', 'pedagogy_identity_stale');
});

test('stale selection-rules version is detected', () => {
  assertExpectedDiagnostic('stale-selection-rules', 'pedagogy_identity_stale');
});

test('stale lesson content identity is detected', () => {
  assertExpectedDiagnostic('stale-content-identity', 'pedagogy_identity_stale');
});

test('stale teacher-pack fingerprint is detected', () => {
  assertExpectedDiagnostic(
    'stale-teacher-pack-fingerprint',
    'readiness_claim_not_supported',
  );
});

test('stale teacher review evidence is detected', () => {
  assertExpectedDiagnostic('stale-teacher-review', 'readiness_claim_not_supported');
});

test('stale classroom trial evidence is detected', () => {
  assertExpectedDiagnostic('stale-classroom-trial', 'readiness_claim_not_supported');
});

test('all deliberate and stale cases block structural positive claims', () => {
  for (const item of run.results.filter(
    (candidate) => ['deliberate_failure', 'stale_evidence'].includes(
      candidate.case_kind,
    ) && candidate.handler_id === 'repository-artifact-mutation',
  )) {
    assert.equal(item.actual_claims.structurally_complete, false);
    assert.equal(item.actual_claims.production_ready, false);
  }
});

test('unknown regression case kind fails strict schema', () => {
  const fixtures = structuredClone(repository.fixtures);
  fixtures.cases[0].case_kind = 'unknown_case_kind';
  assert.equal(repository.validators.cases(fixtures), false);
});

test('unexpected regression field fails strict schema', () => {
  const fixtures = structuredClone(repository.fixtures);
  fixtures.cases[0].unexpected_field = true;
  assert.equal(repository.validators.cases(fixtures), false);
});

test('regression YAML rejects duplicate keys', () => {
  assert.throws(
    () => parseStrictPedagogyRegressionYaml('schema_version: "1.0"\nschema_version: "1.0"\n'),
    /Map keys must be unique/,
  );
});

test('regression YAML rejects aliases', () => {
  assert.throws(
    () => parseStrictPedagogyRegressionYaml('source: &source\n  value: 1\ncopy: *source\n'),
    /Alias resolution is disabled/,
  );
});

test('regression YAML rejects tabs', () => {
  assert.throws(
    () => parseStrictPedagogyRegressionYaml('schema_version:\t"1.0"\n'),
    /tabs are not allowed/,
  );
});

test('regression artifact paths reject absolute and traversal forms', () => {
  for (const artifactPath of ['/absolute/path.yaml', '../outside.yaml']) {
    const fixtures = structuredClone(repository.fixtures);
    fixtures.cases[0].source_scope.artifact_paths[0] = artifactPath;
    assert.equal(
      repository.validators.cases(fixtures),
      false,
      `${artifactPath} must fail the strict regression schema`,
    );
  }
});

test('missing executable regression handler fails configuration', () => {
  const fixtures = structuredClone(repository.fixtures);
  fixtures.cases[0].handler_id = 'future-handler-without-implementation';
  const errors = validatePedagogyRegressionConfiguration({
    ...repository,
    fixtures,
  });
  assert.ok(errors.some((error) => error.includes('missing executable handler')));
});

test('nondeterministic fixture ordering fails configuration', () => {
  const fixtures = structuredClone(repository.fixtures);
  fixtures.cases.reverse();
  const errors = validatePedagogyRegressionConfiguration({
    ...repository,
    fixtures,
  });
  assert.ok(errors.includes('regression cases must be bytewise sorted'));
});

test('report counts reconcile with case and invariant arrays', () => {
  assert.equal(report.counts.total, report.cases.length);
  assert.equal(
    report.counts.passed + report.counts.failed,
    report.cases.length,
  );
  assert.equal(
    report.counts.invariants.total,
    report.cases.flatMap((item) => item.invariants).length,
  );
});

test('semantic report serialization is byte-identical across repeated builds', () => {
  const second = buildPedagogyRegressionReport(repository, run);
  assert.equal(
    serializePedagogyRegressionReport(report),
    serializePedagogyRegressionReport(second),
  );
});

test('object key order does not change the normalized semantic snapshot', () => {
  const reordered = Object.fromEntries(Object.entries(report).reverse());
  assert.equal(regressionSemanticDigest(report), regressionSemanticDigest(reordered));
});

test('formatting-only fixture mutation preserves the semantic source digest', async () => {
  const source = await fs.readFile(
    'knowledge/pedagogy/regressions/grade-5-regression-cases.yaml',
    'utf8',
  );
  const formatted = `# formatting-only regression fixture comment\n\n${source}\n`;
  const before = parseStrictPedagogyRegressionYaml(source, 'baseline fixture');
  const after = parseStrictPedagogyRegressionYaml(formatted, 'formatted fixture');
  assert.equal(regressionSemanticDigest(before), regressionSemanticDigest(after));
});

test('meaningful source fixture mutation changes report digest and makes snapshot stale', async () => {
  const fixtures = structuredClone(repository.fixtures);
  fixtures.cases[0].title_ru += ' Семантическая мутация.';
  const changedRepository = { ...repository, fixtures };
  const changedReport = buildPedagogyRegressionReport(changedRepository, run);
  assert.notEqual(
    regressionSemanticDigest(report),
    regressionSemanticDigest(changedReport),
  );
  assert.deepEqual(
    await checkPedagogyRegressionReport(changedRepository, changedReport),
    ['stale pedagogical regression report: '
      + 'evaluations/pedagogy-regressions/grade-5-regression-report.json'],
  );
});

test('committed report exactly matches normalized generated bytes', async () => {
  assert.deepEqual(await checkPedagogyRegressionReport(repository, report), []);
  const committed = await fs.readFile(PEDAGOGY_REGRESSION_REPORT, 'utf8');
  assert.equal(committed, serializePedagogyRegressionReport(report));
});

test('committed report freshness validates authoritative versions and identities', async () => {
  assert.deepEqual(
    await validateCommittedPedagogyRegressionReport(
      repository,
      committedReport,
    ),
    [],
  );
});

test('committed report freshness rejects a stale fixture catalogue digest', async () => {
  const stale = structuredClone(committedReport);
  stale.digests.fixture_catalogue = 'a'.repeat(64);
  assert.ok(
    (await validateCommittedPedagogyRegressionReport(repository, stale))
      .includes('stale committed regression source digests'),
  );
});

test('checked artifact closure is canonical, sorted and contains production dependencies', () => {
  assert.deepEqual(
    report.checked_artifacts,
    [...report.checked_artifacts].sort(
      (left, right) => Buffer.from(left).compare(Buffer.from(right)),
    ),
  );
  assert.ok(report.checked_artifacts.includes(
    'teacher-packs/grade-5-science/water/pedagogy/integration-index.yaml',
  ));
  assert.ok(report.checked_artifacts.includes(
    'teacher-packs/grade-5-science/water/answers/lesson-03-answer-key.md',
  ));
});

test('fingerprint and scientific content identities are preserved as inputs', () => {
  assert.deepEqual(report.teacher_pack_fingerprint, {
    algorithm: 'sha256',
    specification_version: '1.0',
    value: '13baf6f243b48f62ada192ce91efbd87f5cb6044aab3eb6bd3404a2b8977b7fd',
    file_count: 78,
  });
  assert.equal(report.content_identities.length, 5);
});

test('production and architecture baselines explicitly declare no mutation', () => {
  for (const item of repository.fixtures.cases.filter(
    (candidate) => [
      'production-baseline',
      'selection-architecture',
    ].includes(candidate.handler_id),
  )) {
    assert.equal(item.mutation, null, item.regression_id);
  }
});

test('selection and architecture-output mutations use their own bounded handlers', () => {
  const selectionCases = repository.fixtures.cases.filter(
    (item) => item.handler_id === 'selection-request-mutation',
  );
  assert.equal(selectionCases.length, 2);
  assert.ok(selectionCases.every(
    (item) => item.mutation.mutation_level === 'selection_request',
  ));
  const policy = repository.fixtures.cases.find(
    (item) => item.handler_id === 'architecture-output-policy-mutation',
  );
  assert.equal(policy.mutation.mutation_level, 'generated_architecture_output');
});

for (const item of repositoryMutationCases) {
  test(`${item.regression_id} declares a real repository-artifact mutation`, () => {
    assert.equal(item.mutation.mutation_level, 'repository_artifact');
    assert.equal(
      item.mutation.artifact_path,
      item.source_scope.artifact_paths[0],
    );
    assert.equal(item.mutation.mutation_id, item.source_scope.scenario_id);
    assert.ok(item.mutation.expected_changed_fields.length > 0);
    assert.equal(item.handler_id, 'repository-artifact-mutation');
  });

  test(`${item.regression_id} is detected after production adapter reload`, () => {
    const actual = result(item.regression_id);
    assert.equal(actual.status, 'passed');
    assert.ok(actual.invariants.some(
      (invariant) => (
        invariant.invariant_id === 'diagnostic_detected'
        && invariant.status === 'passed'
      ),
    ));
    assert.ok(actual.diagnostics.some((diagnostic) => (
      item.expected_diagnostics.some((expected) => (
        expected.code === diagnostic.code
        && expected.gate_id === diagnostic.gate_id
      ))
    )));
  });
}

test('no production E2E case uses a normalized boolean-mutation handler', () => {
  const forbidden = new Set(['quality-mutation', 'production-quality']);
  assert.ok(repository.fixtures.cases.every(
    (item) => !forbidden.has(item.handler_id),
  ));
});

test('every invariant result carries reviewable expected, actual and evidence', () => {
  for (const invariant of report.cases.flatMap((item) => item.invariants)) {
    assert.equal(typeof invariant.summary, 'string');
    assert.ok(invariant.summary.length > 0);
    assert.ok(Object.hasOwn(invariant, 'expected'));
    assert.ok(Object.hasOwn(invariant, 'actual'));
    assert.ok(invariant.evidence_refs.length > 0);
  }
});

test('invariant evidence references are canonical and bytewise sorted', () => {
  for (const invariant of report.cases.flatMap((item) => item.invariants)) {
    assert.deepEqual(
      invariant.evidence_refs,
      [...invariant.evidence_refs].sort(
        (left, right) => Buffer.from(left).compare(Buffer.from(right)),
      ),
    );
    assert.ok(invariant.evidence_refs.every(
      (reference) => !reference.startsWith('/') && !reference.includes('\\'),
    ));
  }
});

test('architecture compatibility evidence resolves activity and profile identities', () => {
  for (const regressionId of [
    'architecture-ecosystem-comparison',
    'architecture-map-data',
    'architecture-scaffolded-learner',
    'architecture-self-explanation',
  ]) {
    const invariant = result(regressionId).invariants.find(
      (candidate) => candidate.invariant_id === 'grade_delivery_compatible',
    );
    assert.equal(invariant.status, 'passed');
    assert.ok(invariant.actual.selected_targets.every(
      (target) => target.activity_id && target.target_id,
    ));
  }
});

test('architecture language demand records actual operational demand values', () => {
  const invariant = result('architecture-map-data').invariants.find(
    (candidate) => candidate.invariant_id === 'language_demand_within_ceiling',
  );
  assert.equal(invariant.expected, 'low');
  assert.ok(invariant.actual.every(
    (target) => typeof target.productive_language === 'string',
  ));
});

test('scaffolded architecture evidence comes from resolved operational targets', () => {
  const invariant = result('architecture-scaffolded-learner').invariants.find(
    (candidate) => candidate.invariant_id === 'additional_scaffolding_present',
  );
  assert.equal(invariant.status, 'passed');
  assert.ok(invariant.actual.selected_targets.length > 0);
});

test('collaboration requires non-individual operational collaborative semantics', () => {
  const invariant = result('production-classroom-collaboration').invariants.find(
    (candidate) => candidate.invariant_id === 'collaborative_method_present',
  );
  assert.equal(invariant.status, 'passed');
  assert.ok(invariant.actual.some(
    (phase) => phase.group_format !== 'individual',
  ));
  assert.ok(invariant.actual.some(
    (phase) => phase.category === 'collaborative_learning'
      || phase.target_id === 'brainstorming',
  ));
});

test('quiet individual case has no required collaborative operation', () => {
  const invariant = result('production-classroom-quiet-individual').invariants.find(
    (candidate) => candidate.invariant_id === 'quiet_individual_method_present',
  );
  assert.equal(invariant.status, 'passed');
  assert.ok(invariant.actual.every(
    (phase) => phase.group_format === 'individual',
  ));
  assert.ok(invariant.actual.every(
    (phase) => phase.category !== 'collaborative_learning',
  ));
});

test('classroom practical safety is derived from classroom DNA rather than home state', () => {
  const invariant = result('production-classroom-safe-practical').invariants.find(
    (candidate) => candidate.invariant_id === 'adult_supervision_preserved',
  );
  assert.equal(invariant.status, 'passed');
  assert.equal(invariant.actual.applicable, true);
  assert.equal(invariant.actual.controls_present, true);
  assert.ok(Array.isArray(invariant.actual.phases));
});

test('homeschool practical safety is derived from package authorization', () => {
  const invariant = result('production-homeschool-practical-safety').invariants.find(
    (candidate) => candidate.invariant_id === 'adult_supervision_preserved',
  );
  assert.equal(invariant.status, 'passed');
  assert.equal(invariant.actual.adult_supervision_present, true);
  assert.equal(invariant.actual.teacher_authorization_present, true);
});

test('valid architecture-only output produces no policy diagnostic', () => {
  assert.deepEqual(validateArchitectureOnlyResult({
    regression_id: 'valid-architecture-output',
    actual_claims: { production_ready: false },
    authored_artifact_paths: [],
  }), []);
});

test('architecture-only authored artifact claim is rejected independently', () => {
  const diagnostics = validateArchitectureOnlyResult({
    regression_id: 'invalid-architecture-artifact-output',
    actual_claims: { production_ready: false },
    authored_artifact_paths: ['teacher-packs/generated.md'],
  });
  assert.equal(diagnostics[0].code, 'architecture_only_artifact_claim');
});

test('checked artifact closure contains every loader-reported dependency', () => {
  for (const repositoryPath of repository.selectionRepository.loadedArtifactPaths) {
    assert.ok(report.checked_artifacts.includes(repositoryPath), repositoryPath);
  }
  for (const repositoryPath of repository.qualityRepository.loadedArtifactPaths) {
    assert.ok(report.checked_artifacts.includes(repositoryPath), repositoryPath);
  }
});

test('temporary stale-evidence records remain auditable without becoming committed dependencies', () => {
  const expected = new Map([
    ['stale-teacher-pack-fingerprint',
      'pedagogical-reviews/grade-5-science/water/teacher-review-regression.yaml'],
    ['stale-teacher-review',
      'pedagogical-reviews/grade-5-science/water/teacher-review-regression.yaml'],
    ['stale-classroom-trial',
      'pedagogical-reviews/grade-5-science/water/classroom-trial-regression.yaml'],
  ]);
  for (const [regressionId, repositoryPath] of expected) {
    const item = result(regressionId);
    assert.deepEqual(item.ephemeral_checked_artifacts, [repositoryPath]);
    for (const repositoryPath of item.ephemeral_checked_artifacts) {
      assert.ok(item.invariants.every(
        (invariant) => invariant.evidence_refs.includes(repositoryPath),
      ));
      assert.ok(!report.checked_artifacts.includes(repositoryPath));
    }
  }
});

test('non-evidence cases declare an empty ephemeral dependency closure', () => {
  const ephemeralCases = new Set([
    'stale-teacher-review',
    'stale-classroom-trial',
    'stale-teacher-pack-fingerprint',
  ]);
  for (const item of report.cases.filter(
    (candidate) => (
      candidate.case_kind !== 'evidence_readiness'
      && !ephemeralCases.has(candidate.regression_id)
    ),
  )) {
    assert.deepEqual(item.ephemeral_checked_artifacts, [], item.regression_id);
  }
});

test('every committed checked dependency resolves to a regular non-symlink file', async () => {
  for (const repositoryPath of report.checked_artifacts) {
    const stat = await fs.lstat(repositoryPath);
    assert.equal(stat.isFile(), true, repositoryPath);
    assert.equal(stat.isSymbolicLink(), false, repositoryPath);
  }
});

test('missing checked dependency makes committed report check fail', async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-regression-closure-'));
  try {
    const errors = await checkPedagogyRegressionReport(
      { rootDir: temporaryRoot },
      { checked_artifacts: ['missing-dependency.yaml'] },
      { reportPath: 'report.json' },
    );
    assert.deepEqual(errors, [
      'checked regression dependency is missing or not a regular file: missing-dependency.yaml',
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('regression source contains no AI, network, randomness or volatile timestamps', async () => {
  const source = await fs.readFile('scripts/lib/pedagogy-regressions.mjs', 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\bDate\.now\b|\bnew Date\b/);
  assert.doesNotMatch(source, /\bOpenAI\b|\banthropic\b/i);
});

test('regression check and report commands are registered', async () => {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
  assert.equal(
    packageJson.scripts['check:pedagogy-regressions'],
    'node scripts/check-pedagogy-regressions.mjs',
  );
  assert.equal(
    packageJson.scripts['check:pedagogy-regression-report'],
    'node scripts/generate-pedagogy-regression-report.mjs --check',
  );
});
