import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  buildPedagogyRegressionReport,
  checkPedagogyRegressionReport,
  loadPedagogyRegressionRepository,
  PEDAGOGY_REGRESSION_REPORT,
  parseStrictPedagogyRegressionYaml,
  regressionSemanticDigest,
  runPedagogyRegressions,
  serializePedagogyRegressionReport,
  validatePedagogyRegressionConfiguration,
  validatePedagogyRegressionReport,
} from './lib/pedagogy-regressions.mjs';

const execFileAsync = promisify(execFile);
const repository = await loadPedagogyRegressionRepository();
const run = runPedagogyRegressions(repository);
const report = buildPedagogyRegressionReport(repository, run);

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

test('catalogue contains all five bounded case kinds', () => {
  assert.deepEqual(report.counts.by_case_kind, {
    architecture_only: 5,
    deliberate_failure: 14,
    production_classroom: 7,
    production_homeschool: 3,
    stale_evidence: 7,
  });
  assert.equal(report.counts.total, 36);
});

test('all one hundred and six meaningful invariant checks pass', () => {
  assert.deepEqual(report.counts.invariants, {
    total: 106,
    passed: 106,
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
  assertExpectedDiagnostic('stale-teacher-pack-fingerprint', 'pedagogy_identity_stale');
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
    ) && candidate.handler_id === 'quality-mutation',
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

test('meaningful semantic mutation changes the snapshot digest', () => {
  const changed = structuredClone(report);
  changed.claims.production_water_pilot_structurally_complete = false;
  assert.notEqual(regressionSemanticDigest(report), regressionSemanticDigest(changed));
});

test('committed report exactly matches normalized generated bytes', async () => {
  assert.deepEqual(await checkPedagogyRegressionReport(repository, report), []);
  const committed = await fs.readFile(PEDAGOGY_REGRESSION_REPORT, 'utf8');
  assert.equal(committed, serializePedagogyRegressionReport(report));
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

test('regression source contains no AI, network, randomness or volatile timestamps', async () => {
  const source = await fs.readFile('scripts/lib/pedagogy-regressions.mjs', 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\bDate\.now\b|\bnew Date\b/);
  assert.doesNotMatch(source, /\bOpenAI\b|\banthropic\b/i);
});

test('regression CLI passes and committed report check is current', async () => {
  const checked = await execFileAsync(
    process.execPath,
    ['scripts/check-pedagogy-regressions.mjs'],
    { cwd: process.cwd() },
  );
  assert.match(checked.stdout, /Pedagogy regressions passed: 36 cases/);
  const reportCheck = await execFileAsync(
    process.execPath,
    ['scripts/generate-pedagogy-regression-report.mjs', '--check'],
    { cwd: process.cwd() },
  );
  assert.match(reportCheck.stdout, /Pedagogy regression report is current/);
});
