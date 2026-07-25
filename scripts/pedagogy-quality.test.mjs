import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test, { before } from 'node:test';
import {
  buildPedagogyQualityReport,
  clonePedagogyQualityRepository,
  evaluatePedagogyQuality,
  serializePedagogyQualityReport,
  sortPedagogyQualityDiagnostics,
  validatePedagogyQualityConfiguration,
} from './lib/pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
  WATER_QUALITY_REPORT_ID,
  WATER_QUALITY_REPORT_PATH,
} from './lib/pedagogy-quality-production.mjs';

let production;

before(async () => {
  production = await loadWaterPilotPedagogyQualityRepository();
});

function clone() {
  return clonePedagogyQualityRepository(production);
}

function integrated(repository, index = 0) {
  return repository.records.filter(
    (record) => record.kind === 'integrated_lesson',
  )[index];
}

function evaluate(repository) {
  return evaluatePedagogyQuality(repository);
}

function gateDiagnostic(evaluation, gateId, code) {
  return evaluation.diagnostics.find((diagnostic) => (
    diagnostic.gate_id === gateId && (!code || diagnostic.code === code)
  ));
}

function assertGateFailure(repository, gateId, code) {
  const evaluation = evaluate(repository);
  const diagnostic = gateDiagnostic(evaluation, gateId, code);
  assert.ok(diagnostic, `expected ${gateId}/${code}`);
  assert.equal(diagnostic.severity, 'error');
  assert.equal(evaluation.structuralStatus, 'failed');
  return diagnostic;
}

function exceptionFor(record, gateId, {
  exceptionId = 'justified-nonstandard-timing',
  gateVersion = '1.0',
} = {}) {
  return {
    exception_id: exceptionId,
    gate_id: gateId,
    artifact_path: record.artifact_path,
    record_id: record.record_id,
    gate_version: gateVersion,
    reason_ru:
      'Нестандартная структура явно ограничена этой записью и требует последующей проверки учителем.',
    lesson_pattern: 'nonstandard-bounded-lesson',
    author_role: 'subject_teacher',
    status: 'active',
  };
}

test('valid integrated classroom lessons pass every applicable error gate', () => {
  const evaluation = evaluate(clone());
  assert.equal(evaluation.counts.errors, 0);
  assert.equal(evaluation.records.filter(
    (record) => record.kind === 'integrated_lesson',
  ).length, 4);
});

test('valid integrated homeschool packages resolve their complete material closure', () => {
  const evaluation = evaluate(clone());
  const homeResults = evaluation.results.filter(
    (result) => result.gate_id === 'material-closure-resolved',
  );
  assert.equal(homeResults.length, 4);
  assert.ok(homeResults.every((result) => result.status === 'passed'));
});

test('valid four-lesson water pilot is structurally complete', () => {
  const evaluation = evaluate(clone());
  const structural = evaluation.results.filter(
    (result) => result.gate_id === 'structural-completeness',
  );
  assert.equal(structural.length, 4);
  assert.ok(structural.every((result) => result.status === 'passed'));
});

test('justified exact-record exception represents a bounded nonstandard lesson', () => {
  const repository = clone();
  const record = integrated(repository);
  record.timing.stage_partition_exact = false;
  repository.exceptions.exceptions.push(exceptionFor(record, 'timing-reconciled'));
  const evaluation = evaluate(repository);
  assert.equal(evaluation.counts.errors, 0);
  assert.equal(gateDiagnostic(
    evaluation,
    'timing-reconciled',
    'gate_exception_applied',
  ).exception_id, 'justified-nonstandard-timing');
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'timing-reconciled' && result.status === 'excepted'
  )));
});

test('legacy artifacts receive the finite documented migration warning', () => {
  const evaluation = evaluate(clone());
  const warnings = evaluation.diagnostics.filter(
    (diagnostic) => diagnostic.code === 'legacy_artifact_not_integrated',
  );
  assert.equal(warnings.length, 6);
  assert.ok(warnings.every((warning) => warning.severity === 'warning'));
});

test('unrelated path is not made erroneous by quality gates', () => {
  const evaluation = evaluatePedagogyQuality(clone(), {
    requestedPath: 'lesson-plans/grade-4-science',
  });
  assert.equal(evaluation.records.length, 0);
  assert.equal(evaluation.counts.errors, 0);
  assert.equal(evaluation.counts.warnings, 0);
});

test('production warning vocabulary and count are finite', () => {
  const evaluation = evaluate(clone());
  assert.equal(evaluation.counts.warnings, 6);
  assert.deepEqual(
    [...new Set(evaluation.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'warning')
      .map((diagnostic) => diagnostic.code))],
    ['legacy_artifact_not_integrated'],
  );
});

test('invalid integrated artifact schema fails', () => {
  const repository = clone();
  integrated(repository).schema_valid = false;
  assertGateFailure(repository, 'schema-valid', 'pedagogy_schema_invalid');
});

test('missing explicit learning goals fails pattern structure', () => {
  const repository = clone();
  integrated(repository).structure.learning_goals_present = false;
  assertGateFailure(
    repository,
    'pattern-structure-aligned',
    'learning_goals_missing',
  );
});

test('missing pattern-required component fails without imposing a universal phase set', () => {
  const repository = clone();
  integrated(repository).structure.pattern_required_components = false;
  assertGateFailure(
    repository,
    'pattern-structure-aligned',
    'pattern_structure_incomplete',
  );
});

test('missing lesson DNA reference fails identity integrity', () => {
  const repository = clone();
  integrated(repository).identity.lesson_dna_digest_chain_current = false;
  assertGateFailure(repository, 'identity-chain-current', 'pedagogy_identity_stale');
});

test('unknown catalogue target fails identity integrity', () => {
  const repository = clone();
  integrated(repository).identity.catalogue_digest_current = false;
  const diagnostic = assertGateFailure(
    repository,
    'identity-chain-current',
    'pedagogy_identity_stale',
  );
  assert.ok(diagnostic.actual.includes('catalogue_digest_current'));
});

test('stale taxonomy version fails identity integrity', () => {
  const repository = clone();
  integrated(repository).identity.taxonomy_version_current = false;
  assertGateFailure(repository, 'identity-chain-current', 'pedagogy_identity_stale');
});

test('stale selection rules version fails identity integrity', () => {
  const repository = clone();
  integrated(repository).identity.selection_rules_version_current = false;
  assertGateFailure(repository, 'identity-chain-current', 'pedagogy_identity_stale');
});

test('stale catalogue digest fails identity integrity', () => {
  const repository = clone();
  integrated(repository).identity.catalogue_digest_current = false;
  assertGateFailure(repository, 'identity-chain-current', 'pedagogy_identity_stale');
});

test('canonical lesson DNA identity mismatch fails', () => {
  const repository = clone();
  integrated(repository, 1).identity.lesson_dna_digest_chain_current = false;
  assertGateFailure(repository, 'identity-chain-current', 'pedagogy_identity_stale');
});

test('timing overflow fails', () => {
  const repository = clone();
  integrated(repository).timing.lesson_total_exact = false;
  assertGateFailure(repository, 'timing-reconciled', 'timing_reconciliation_failed');
});

test('stage partition mismatch fails', () => {
  const repository = clone();
  integrated(repository).timing.stage_partition_exact = false;
  assertGateFailure(repository, 'timing-reconciled', 'timing_reconciliation_failed');
});

test('double-counted minutes fail', () => {
  const repository = clone();
  integrated(repository).timing.double_count_absent = false;
  assertGateFailure(repository, 'timing-reconciled', 'timing_reconciliation_failed');
});

test('closed-source retrieval requirement rejects open first attempt', () => {
  const repository = clone();
  integrated(repository).retrieval.closed_first_attempt = false;
  assertGateFailure(repository, 'retrieval-cycle-valid', 'retrieval_cycle_invalid');
});

test('retrieval without later correction fails', () => {
  const repository = clone();
  integrated(repository).retrieval.later_correction_present = false;
  assertGateFailure(repository, 'retrieval-cycle-valid', 'retrieval_cycle_invalid');
});

test('delayed retrieval cannot point to the current or previous lesson', () => {
  const repository = clone();
  integrated(repository).delayed_retrieval.windows = [
    { after_lessons: 0, capability: 'retrieval' },
  ];
  assertGateFailure(
    repository,
    'delayed-retrieval-forward',
    'delayed_retrieval_not_forward',
  );
});

test('delayed retrieval rejects unsupported absolute learner date', () => {
  const repository = clone();
  integrated(repository).delayed_retrieval.absolute_dates_absent = false;
  assertGateFailure(
    repository,
    'delayed-retrieval-forward',
    'delayed_retrieval_not_forward',
  );
});

test('incompatible Estonian role fails', () => {
  const repository = clone();
  integrated(repository).language.estonian_roles_bounded = false;
  assertGateFailure(repository, 'language-role-compatible', 'language_role_incompatible');
});

test('language demand above hard ceiling fails', () => {
  const repository = clone();
  integrated(repository).language.productive_demand_within_ceiling = false;
  assertGateFailure(repository, 'language-role-compatible', 'language_role_incompatible');
});

test('combined subject and language assessment fails', () => {
  const repository = clone();
  integrated(repository).language.assessment_separated = false;
  assertGateFailure(repository, 'language-role-compatible', 'language_role_incompatible');
});

test('classroom-only material in homeschool closure fails', () => {
  const repository = clone();
  integrated(repository).home.classroom_materials_absent = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('reselected home target without explicit task contract fails', () => {
  const repository = clone();
  integrated(repository).home.adapted_contracts_complete = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('homeschool adaptation cannot make the parent a subject teacher by default', () => {
  const repository = clone();
  integrated(repository).home.parent_role_bounded = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('missing adult safety supervision fails', () => {
  const repository = clone();
  const practical = integrated(repository, 2);
  practical.safety.adult_supervision_present = false;
  assertGateFailure(repository, 'safety-contract-preserved', 'safety_contract_invalid');
});

test('missing teacher authorization fails', () => {
  const repository = clone();
  const practical = integrated(repository, 2);
  practical.safety.teacher_authorization_present = false;
  assertGateFailure(repository, 'safety-contract-preserved', 'safety_contract_invalid');
});

test('safety policy package and render disagreement fails', () => {
  const repository = clone();
  const practical = integrated(repository, 2);
  practical.safety.policy_task_package_render_aligned = false;
  assertGateFailure(repository, 'safety-contract-preserved', 'safety_contract_invalid');
});

test('learner-facing complete answer leak fails', () => {
  const repository = clone();
  integrated(repository).answer_leaks.push({
    path: 'teacher-packs/example/student/task.md',
    normalized_answer: 'complete expected answer',
  });
  assertGateFailure(repository, 'answer-leakage-absent', 'learner_answer_leak');
});

test('answer key open before first attempt fails alignment', () => {
  const repository = clone();
  integrated(repository).alignment.answer_policy_aligned = false;
  assertGateFailure(repository, 'cross-artifact-alignment', 'cross_artifact_alignment_failed');
});

test('fictitious key for teacher-observation task fails alignment', () => {
  const repository = clone();
  integrated(repository, 2).alignment.answer_policy_aligned = false;
  assertGateFailure(repository, 'cross-artifact-alignment', 'cross_artifact_alignment_failed');
});

test('unresolved material path fails alignment and closure', () => {
  const repository = clone();
  integrated(repository).alignment.artifact_paths_resolved = false;
  assertGateFailure(repository, 'cross-artifact-alignment', 'cross_artifact_alignment_failed');
});

test('classroom_ready true without human evidence fails', () => {
  const repository = clone();
  integrated(repository).readiness.classroom_ready = true;
  assertGateFailure(repository, 'readiness-honest', 'readiness_claim_not_supported');
});

test('homeschool_ready true without human evidence fails', () => {
  const repository = clone();
  integrated(repository).readiness.homeschool_ready = true;
  assertGateFailure(repository, 'readiness-honest', 'readiness_claim_not_supported');
});

test('stale review or trial evidence fails readiness honesty', () => {
  const repository = clone();
  integrated(repository).readiness.evidence_current = false;
  assertGateFailure(repository, 'readiness-honest', 'readiness_claim_not_supported');
});

test('effectiveness claim fails readiness honesty', () => {
  const repository = clone();
  integrated(repository).readiness.effectiveness_claimed = true;
  assertGateFailure(repository, 'readiness-honest', 'readiness_claim_not_supported');
});

test('exception for unknown gate fails configuration validation', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(integrated(repository), 'unknown-gate'),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /unknown gate/u,
  );
});

test('exception with stale gate version fails configuration validation', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(integrated(repository), 'timing-reconciled', {
      gateVersion: '0.9',
    }),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /stale gate version/u,
  );
});

test('duplicate exception ID fails configuration validation', () => {
  const repository = clone();
  const record = integrated(repository);
  const exception = exceptionFor(record, 'timing-reconciled');
  repository.exceptions.exceptions.push(exception, structuredClone(exception));
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /duplicate quality exception ID/u,
  );
});

test('conflicting exceptions for one exact target fail', () => {
  const repository = clone();
  const record = integrated(repository);
  repository.exceptions.exceptions.push(
    exceptionFor(record, 'timing-reconciled'),
    exceptionFor(record, 'timing-reconciled', {
      exceptionId: 'second-exact-timing-exception',
    }),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /duplicate or conflicting quality exception target/u,
  );
});

test('attempt to except a safety gate fails configuration validation', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(integrated(repository, 2), 'safety-contract-preserved'),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /cannot suppress non-exemptible gate safety-contract-preserved/u,
  );
});

test('attempt to except readiness honesty fails configuration validation', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(integrated(repository), 'readiness-honest'),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /cannot suppress non-exemptible gate readiness-honest/u,
  );
});

test('attempt to except answer leakage fails configuration validation', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(integrated(repository), 'answer-leakage-absent'),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /cannot suppress non-exemptible gate answer-leakage-absent/u,
  );
});

test('diagnostics are bytewise sorted deterministically', () => {
  const repository = clone();
  integrated(repository).readiness.classroom_ready = true;
  integrated(repository, 2).safety.adult_supervision_present = false;
  repository.records.reverse();
  const first = evaluate(repository).diagnostics;
  const second = sortPedagogyQualityDiagnostics([...first].reverse());
  assert.deepEqual(second, first);
});

test('report is deterministic and schema-valid', () => {
  const repository = clone();
  const evaluation = evaluate(repository);
  const first = buildPedagogyQualityReport(repository, evaluation, {
    reportId: WATER_QUALITY_REPORT_ID,
    reportPath: WATER_QUALITY_REPORT_PATH,
  });
  const second = buildPedagogyQualityReport(repository, evaluate(repository), {
    reportId: WATER_QUALITY_REPORT_ID,
    reportPath: WATER_QUALITY_REPORT_PATH,
  });
  assert.equal(
    serializePedagogyQualityReport(first),
    serializePedagogyQualityReport(second),
  );
  assert.equal(repository.validators.report(first), true);
});

test('report makes structural claims but no approval or effectiveness claim', () => {
  const repository = clone();
  const report = buildPedagogyQualityReport(repository, evaluate(repository), {
    reportId: WATER_QUALITY_REPORT_ID,
    reportPath: WATER_QUALITY_REPORT_PATH,
  });
  assert.equal(report.claims.pedagogy_schema_valid, true);
  assert.equal(report.claims.structurally_complete, true);
  assert.equal(report.readiness.teacher_review, 'pending');
  assert.equal(report.readiness.classroom_ready, false);
  assert.equal(report.readiness.homeschool_ready, false);
  assert.equal(report.readiness.effectiveness_claimed, false);
});

test('quality engine implementation contains no water lesson or material IDs', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => (
    readFile('scripts/lib/pedagogy-quality-gates.mjs', 'utf8')
  ));
  assert.doesNotMatch(source, /grade-5-water-0[1-4]/u);
  assert.doesNotMatch(source, /lesson-03-home-safety-card/u);
  assert.doesNotMatch(source, /practical-safety-card/u);
});

test('CLI permits documented production warnings by default', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-pedagogy-quality.mjs'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 error\(s\), 6 warning\(s\)/u);
});

test('CLI strict-warnings mode exits nonzero for the finite production warning set', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-pedagogy-quality.mjs', '--strict-warnings'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /pass_with_warnings/u);
});

test('CLI JSON output is byte-identical across repeated runs', () => {
  const run = () => spawnSync(
    process.execPath,
    ['scripts/check-pedagogy-quality.mjs', '--json'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const first = run();
  const second = run();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
});
