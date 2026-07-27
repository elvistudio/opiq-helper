import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { parseDocument, stringify } from 'yaml';
import {
  buildPedagogyQualityEvaluationResult,
  buildPedagogyQualityReport,
  clonePedagogyQualityRepository,
  evaluatePedagogyQuality,
  normalizePedagogyQualityPath,
  serializePedagogyQualityReport,
  sortPedagogyQualityDiagnostics,
  validatePedagogyQualityConfiguration,
} from './lib/pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
  prepareWaterPilotQualityBaselineContext,
  targetRequiresAdultSupervision,
  WATER_QUALITY_REPORT_ID,
  WATER_QUALITY_REPORT_PATH,
} from './lib/pedagogy-quality-production.mjs';
import {
  pedagogicalEvidenceFingerprintMatches,
} from './lib/pedagogical-reviews.mjs';
import {
  buildPedagogicalEvidenceIdentity,
} from './lib/pedagogical-evidence.mjs';

let production;
let fixtureRoot;
let projectionBaseline;
let productionAdapterMutationCount = 0;

before(async () => {
  projectionBaseline = await prepareWaterPilotQualityBaselineContext();
  production = await loadWaterPilotPedagogyQualityRepository({
    baselineContext: projectionBaseline,
  });
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-quality-'));
  await fs.cp(process.cwd(), fixtureRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(process.cwd(), source);
      return !(
        relative === '.git'
        || relative.startsWith(`.git${path.sep}`)
        || relative === 'node_modules'
        || relative.startsWith(`node_modules${path.sep}`)
      );
    },
  });
});

after(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
});

function clone() {
  return clonePedagogyQualityRepository(production);
}

function integrated(repository, index = 0) {
  return repository.records.filter(
    (record) => record.kind === 'integrated_lesson',
  )[index];
}

function homeschool(repository, index = 0) {
  return repository.records.filter(
    (record) => record.kind === 'homeschool_package',
  )[index];
}

function thematic(repository) {
  return repository.records.find((record) => record.kind === 'thematic_plan');
}

function teacherPack(repository) {
  return repository.records.find((record) => record.kind === 'teacher_pack');
}

function evaluate(repository) {
  return evaluatePedagogyQuality(repository);
}

function gateDiagnostic(evaluation, gateId, code) {
  return evaluation.diagnostics.find((diagnostic) => (
    diagnostic.gate_id === gateId && (!code || diagnostic.code === code)
  ));
}

function schemaDiagnosticsFor(repository, artifactPath) {
  return repository.records.flatMap(
    (record) => record.schema_diagnostics ?? [],
  ).filter((diagnostic) => diagnostic.file === artifactPath);
}

function assertMachineSchemaFailure(repository, artifactPath) {
  const evaluation = evaluate(repository);
  const diagnostics = evaluation.diagnostics.filter((diagnostic) => (
    diagnostic.gate_id === 'schema-valid'
    && diagnostic.code === 'pedagogy_schema_invalid'
    && diagnostic.related_paths?.includes(artifactPath)
  ));
  assert.ok(diagnostics.length > 0, `expected schema failure for ${artifactPath}`);
  assert.equal(evaluation.claims.pedagogy_schema_valid, false);
  assert.equal(evaluation.claims.structurally_complete, false);
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'structural-completeness'
    && result.status === 'error'
  )));
  return {
    evaluation,
    diagnostics,
    schemaDiagnostics: schemaDiagnosticsFor(repository, artifactPath),
  };
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

async function withFixtureFile(repositoryPath, mutate, run) {
  const filePath = path.join(fixtureRoot, repositoryPath);
  const original = await fs.readFile(filePath);
  try {
    const replacement = await mutate(original);
    if (replacement === null) await fs.rm(filePath);
    else await fs.writeFile(filePath, replacement);
    productionAdapterMutationCount += 1;
    return await run();
  } finally {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, original);
  }
}

async function mutateFixtureYaml(repositoryPath, mutate, run) {
  return withFixtureFile(
    repositoryPath,
    (bytes) => {
      const document = parseDocument(bytes.toString('utf8'), {
        strict: true,
        uniqueKeys: true,
        schema: 'core',
      });
      const value = document.toJS({ maxAliasCount: 1000 });
      mutate(value);
      return stringify(value, { lineWidth: 100, sortMapEntries: false });
    },
    run,
  );
}

async function withCompletedReviewFixture(fingerprint, run) {
  const indexPath = path.join(
    fixtureRoot,
    'teacher-packs/grade-5-science/water/materials-index.yaml',
  );
  const reviewRepositoryPath =
    'pedagogical-reviews/grade-5-science/water/teacher-review-quality-fixture.yaml';
  const reviewPath = path.join(fixtureRoot, reviewRepositoryPath);
  const originalIndex = await fs.readFile(indexPath);
  const indexDocument = parseDocument(originalIndex.toString('utf8'), {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
  });
  const index = indexDocument.toJS({ maxAliasCount: 1000 });
  index.pedagogical_review.review_record_paths = [reviewRepositoryPath];
  const currentIdentity = (await buildPedagogicalEvidenceIdentity({
    rootDir: fixtureRoot,
    packPath: 'teacher-packs/grade-5-science/water/materials-index.yaml',
    commitSha: 'a'.repeat(40),
  })).identity;
  const review = {
    schema_version: '2.0',
    artifact_type: 'teacher_review',
    review_id: 'grade-5-water-review-2026-07-25',
    pack_ref: 'grade-5-science-water-teacher-pack',
    evidence_identity: {
      ...currentIdentity,
      content_fingerprint: structuredClone(fingerprint),
    },
    lifecycle: {
      supersedes: [],
    },
    review_status: 'completed',
    reviewer: {
      role: 'primary_science_teacher',
      subject_experience_years: 5,
      language_context: {
        instruction_language: 'ru',
        subject_support_language: 'et',
      },
      identity_storage: 'external',
      reviewer_reference: 'quality-fixture-reviewer',
    },
    reviewed_at: '2026-07-25',
    delivery_scopes: ['classroom', 'homeschool'],
    review_scope: {
      teacher_guide: true,
      lesson_guides: [
        'grade-5-water-01-properties',
        'grade-5-water-02-states',
        'grade-5-water-03-melting-condensation',
        'grade-5-water-04-changes-review',
      ],
      student_materials: true,
      answer_keys: true,
      assessment_rubric: true,
      homeschool_materials: true,
      safety: true,
      language_level: true,
      lesson_dna: true,
      selection_and_adaptation_artifacts: true,
    },
    ratings: Object.fromEntries([
      'method_suitability_for_grade',
      'method_suitability_for_subject',
      'lesson_pattern_coherence',
      'timing_realism',
      'transition_setup_cleanup_realism',
      'cognitive_load',
      'total_productive_language_load',
      'russian_primary_explanation_quality',
      'estonian_a1_a2_support_fit',
      'retrieval_quality',
      'spaced_review_usefulness',
      'correction_and_self_explanation',
      'teacher_instruction_clarity',
      'classroom_feasibility',
      'homeschool_clarity',
      'parent_role_realism',
      'differentiation',
      'inclusion_accessibility',
      'assessment_validity',
      'subject_language_assessment_separation',
      'learner_autonomy',
      'motivation_competence_support',
      'safety',
      'material_availability',
      'artificial_repetitive_method_risk',
    ].map((field) => [field, 4])),
    rating_applicability: [],
    privacy: {
      contains_student_names: false,
      contains_birth_dates: false,
      contains_personal_identifiers: false,
      contains_addresses: false,
      contains_contact_information: false,
      contains_parent_contacts: false,
      contains_photographs: false,
      contains_recordings: false,
      contains_health_data: false,
      contains_special_category_data: false,
      contains_identifiable_grades: false,
      contains_identifiable_profiles: false,
      contains_identifiable_free_text: false,
      observations_are_aggregated: true,
      identity_storage: 'external',
      free_text_checked_for_identifiers: true,
    },
    findings: [],
    blocking_findings: [],
    required_changes: [],
    optional_improvements: [],
    decision: {
      status: 'approved',
      rationale: 'Synthetic completed evidence used only by a temporary quality test fixture.',
    },
  };
  try {
    await fs.writeFile(indexPath, stringify(index, {
      lineWidth: 100,
      sortMapEntries: false,
    }));
    await fs.writeFile(reviewPath, stringify(review, {
      lineWidth: 100,
      sortMapEntries: false,
    }));
    productionAdapterMutationCount += 1;
    return await run();
  } finally {
    await fs.writeFile(indexPath, originalIndex);
    await fs.rm(reviewPath, { force: true });
  }
}

async function loadMutatedFixture() {
  return loadWaterPilotPedagogyQualityRepository({
    rootDir: fixtureRoot,
    baselineRootDir: process.cwd(),
    baselineContext: projectionBaseline,
  });
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
  assert.equal(structural.length, 10);
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

test('explicit unrelated path fails instead of producing empty positive claims', () => {
  assert.throws(
    () => evaluatePedagogyQuality(clone(), {
      requestedPath: 'lesson-plans/grade-4-science',
    }),
    (error) => error.code === 'no_quality_records_matched',
  );
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
  const evaluation = evaluate(repository);
  assert.ok(gateDiagnostic(
    evaluation,
    'timing-reconciled',
    'timing_reconciliation_failed',
  ));
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'structural-completeness'
    && result.record_id === integrated(repository).record_id
    && result.status === 'error'
  )));
  assert.equal(evaluation.claims.structurally_complete, false);
});

test('structural completeness is independent of primitive execution order', () => {
  const repository = clone();
  integrated(repository).timing.lesson_total_exact = false;
  const normal = evaluatePedagogyQuality(repository);
  const reversed = evaluatePedagogyQuality(repository, {
    primitiveExecutionOrder: 'reverse',
  });
  assert.deepEqual(reversed.results, normal.results);
  assert.deepEqual(reversed.diagnostics, normal.diagnostics);
  assert.deepEqual(reversed.claims, normal.claims);
});

test('exact timing exception remains visible and permits structural completeness', () => {
  const repository = clone();
  const record = integrated(repository);
  record.timing.lesson_total_exact = false;
  repository.exceptions.exceptions.push(exceptionFor(record, 'timing-reconciled'));
  const evaluation = evaluate(repository);
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'timing-reconciled'
    && result.record_id === record.record_id
    && result.status === 'excepted'
  )));
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'structural-completeness'
    && result.record_id === record.record_id
    && result.status === 'passed'
  )));
  assert.equal(evaluation.claims.structurally_complete, true);
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
  homeschool(repository).home.classroom_materials_absent = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('reselected home target without explicit task contract fails', () => {
  const repository = clone();
  homeschool(repository).home.adapted_contracts_complete = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('homeschool adaptation cannot make the parent a subject teacher by default', () => {
  const repository = clone();
  homeschool(repository).home.parent_role_bounded = false;
  assertGateFailure(
    repository,
    'material-closure-resolved',
    'homeschool_material_closure_invalid',
  );
});

test('missing adult safety supervision fails', () => {
  const repository = clone();
  const practical = homeschool(repository, 2);
  practical.safety.adult_supervision_present = false;
  assertGateFailure(repository, 'safety-contract-preserved', 'safety_contract_invalid');
});

test('missing teacher authorization fails', () => {
  const repository = clone();
  const practical = homeschool(repository, 2);
  practical.safety.teacher_authorization_present = false;
  assertGateFailure(repository, 'safety-contract-preserved', 'safety_contract_invalid');
});

test('safety policy package and render disagreement fails', () => {
  const repository = clone();
  const practical = homeschool(repository, 2);
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
  integrated(repository).readiness.evidence.stale_teacher_review = true;
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

test('active exception cannot target a missing record', () => {
  const repository = clone();
  const exception = exceptionFor(integrated(repository), 'timing-reconciled');
  exception.record_id = 'missing-quality-record';
  repository.exceptions.exceptions.push(exception);
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /missing artifact\/record target/u,
  );
});

test('active exception cannot target a gate inapplicable to the record kind', () => {
  const repository = clone();
  repository.exceptions.exceptions.push(
    exceptionFor(homeschool(repository), 'timing-reconciled'),
  );
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /does not apply to that record kind/u,
  );
});

test('retired exception is retained historically but never applied', () => {
  const repository = clone();
  const record = integrated(repository);
  record.timing.lesson_total_exact = false;
  const exception = exceptionFor(record, 'timing-reconciled');
  exception.status = 'retired';
  repository.exceptions.exceptions.push(exception);
  const evaluation = evaluate(repository);
  assert.ok(evaluation.results.some((result) => (
    result.gate_id === 'timing-reconciled'
    && result.record_id === record.record_id
    && result.status === 'error'
  )));
});

test('catalogue gate without any executable evaluator invalidates configuration', () => {
  const repository = clone();
  repository.catalogue.gates.push({
    gate_id: 'unimplemented-future-kind-gate',
    gate_version: '1.1',
    title: 'Unimplemented future quality gate',
    description: 'This deliberate test entry has no executable evaluator implementation.',
    applies_to: ['legacy_lesson'],
    severity: 'error',
    guarantee: 'The deliberate configuration mutation must be rejected before evaluation.',
    non_guarantees: ['This test entry does not provide a production guarantee.'],
    exception_policy: 'prohibited',
    claim_origin: 'project_authored_design',
  });
  repository.catalogue.gates.sort((left, right) => Buffer.compare(
    Buffer.from(left.gate_id),
    Buffer.from(right.gate_id),
  ));
  assert.match(
    validatePedagogyQualityConfiguration(repository).join('\n'),
    /exactly one executable primitive or derived evaluator/u,
  );
});

test('gate schema permits independent semantic versions', () => {
  const repository = clone();
  repository.catalogue.gates[0].gate_version = '1.1';
  assert.equal(repository.validators.catalogue(repository.catalogue), true);
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
  homeschool(repository, 2).safety.adult_supervision_present = false;
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
  assert.equal(first.gate_results.length, first.counts.total_results);
  assert.equal(
    first.counts.errors
      + first.counts.warnings
      + first.counts.info
      + first.counts.passed
      + first.counts.excepted
      + first.counts.not_applicable,
    first.gate_results.length,
  );
  assert.ok(first.gate_results.every((result) => (
    result.artifact_path !== WATER_QUALITY_REPORT_PATH
    && result.record_id !== WATER_QUALITY_REPORT_ID
  )));
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
  assert.equal(report.readiness.consistency, 'consistent');
  assert.equal(report.claims.applies_to, 'integrated_production_records');
  assert.equal(report.legacy_scope.integration_quality_status, 'not_evaluated');
  assert.equal(Object.hasOwn(report.scope, 'unrelated_artifacts_changed'), false);
});

test('report readiness reflects actual invalid record state instead of safe defaults', () => {
  const repository = clone();
  integrated(repository).readiness.teacher_review = 'approved_for_both';
  integrated(repository).readiness.state_consistent = true;
  const report = buildPedagogyQualityReport(repository, evaluate(repository), {
    reportId: WATER_QUALITY_REPORT_ID,
    reportPath: WATER_QUALITY_REPORT_PATH,
  });
  assert.equal(report.readiness.teacher_review, 'mixed');
  assert.equal(report.readiness.consistency, 'mixed');
  assert.equal(report.claims.structurally_complete, false);
});

test('path-scoped output contains only the evaluated record and dependency closure', () => {
  const repository = clone();
  const evaluation = evaluatePedagogyQuality(repository, {
    requestedPath: integrated(repository).artifact_path,
  });
  const output = buildPedagogyQualityEvaluationResult(repository, evaluation);
  assert.equal(output.artifact_type, 'pedagogy_quality_evaluation');
  assert.equal(output.scope.record_count, 1);
  assert.deepEqual(output.scope.record_kinds, ['integrated_lesson']);
  assert.ok(output.checked_artifacts.length < production.reportMetadata
    .teacherPackFingerprint.file_count);
  assert.equal(output.claims.applies_to, 'evaluated_records_only');
});

test('committed report builder rejects a path-scoped evaluation', () => {
  const repository = clone();
  const evaluation = evaluatePedagogyQuality(repository, {
    requestedPath: integrated(repository).artifact_path,
  });
  assert.throws(
    () => buildPedagogyQualityReport(repository, evaluation, {
      reportId: WATER_QUALITY_REPORT_ID,
      reportPath: WATER_QUALITY_REPORT_PATH,
    }),
    /complete production scope/u,
  );
});

test('canonical path normalizer accepts repository files and directories', () => {
  assert.equal(
    normalizePedagogyQualityPath('lesson-plans/grade-5-science/water/lesson-01.yaml'),
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
  );
  assert.equal(
    normalizePedagogyQualityPath('lesson-plans/grade-5-science/water'),
    'lesson-plans/grade-5-science/water',
  );
});

for (const invalidPath of [
  '/absolute/path',
  '../traversal',
  'path\\with\\backslashes',
  'path//empty',
  './noncanonical',
]) {
  test(`canonical path normalizer rejects ${invalidPath}`, () => {
    assert.throws(
      () => normalizePedagogyQualityPath(invalidPath),
      (error) => error.code === 'invalid_quality_path',
    );
  });
}

test('CLI path scope accepts exact files/directories and rejects empty or unsafe scopes', () => {
  const run = (repositoryPath) => spawnSync(
    process.execPath,
    [
      'scripts/check-pedagogy-quality.mjs',
      '--json',
      '--path',
      repositoryPath,
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  const file = run('lesson-plans/grade-5-science/water/lesson-01.yaml');
  assert.equal(file.status, 0, file.stderr);
  assert.equal(JSON.parse(file.stdout).scope.record_count, 1);
  const directory = run('lesson-plans/grade-5-science/water');
  assert.equal(directory.status, 0, directory.stderr);
  assert.equal(JSON.parse(directory.stdout).scope.record_count, 5);
  const missing = run('lesson-plans/grade-4-science/missing');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /\[no_quality_records_matched\]/u);
  for (const unsafePath of [
    '/absolute/path',
    '../traversal',
    'path\\with\\backslashes',
  ]) {
    const unsafe = run(unsafePath);
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /\[invalid_quality_path\]/u);
  }
});

test('production schema projection validates all committed machine artifact kinds', () => {
  const states = production.upstream.machineArtifacts;
  assert.equal(states.length, 33);
  assert.deepEqual(
    [...new Set(states.map((state) => state.artifact_kind))].sort(),
    [
      'homeschoolDecision',
      'homeschoolPackage',
      'homeschoolRequest',
      'integrationIndex',
      'lessonDna',
      'parentGuidance',
      'selectionDecision',
      'selectionRequest',
      'weeklyStudyPlan',
    ],
  );
  assert.ok(states.every((state) => (
    state.schema_valid === true
    && state.parse_error === null
    && state.schema_diagnostics.length === 0
  )));
});

test('production schema projection: unknown lesson-DNA field is dependency-scoped', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (lessonDna) => {
      lessonDna.unknown_quality_field = true;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.field === '/unknown_quality_field'
        && diagnostic.reason === 'unknown field unknown_quality_field'
      )));
      assert.ok(failure.diagnostics.every((diagnostic) => (
        repository.records.find((record) => (
          record.record_id === diagnostic.record_id
        ))?.checked_artifacts.includes(artifactPath)
      )));
      assert.equal(failure.evaluation.diagnostics.some((diagnostic) => (
        diagnostic.record_id === 'grade-5-water-02-states'
        && diagnostic.related_paths?.includes(artifactPath)
      )), false);
    },
  );
});

test('production schema projection: missing lesson-DNA field is an auditable error', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (lessonDna) => {
      delete lessonDna.lesson_dna_id;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.field === '/lesson_dna_id'
        && diagnostic.reason === 'missing required field lesson_dna_id'
      )));
    },
  );
});

test('production schema projection: wrong selection-decision enum fails', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-selection-decision.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (decision) => {
      decision.status = 'unexpected';
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.field === '/status'
      )));
    },
  );
});

test('production schema projection: unknown homeschool-package field fails', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-package.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (homeschoolPackage) => {
      homeschoolPackage.unknown_quality_field = true;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.reason === 'unknown field unknown_quality_field'
      )));
    },
  );
});

test('production schema projection: missing homeschool-request field fails', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-adaptation-request.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (request) => {
      delete request.request_id;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.reason === 'missing required field request_id'
      )));
    },
  );
});

for (const [label, artifactPath] of [
  [
    'parent guidance',
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-parent-guidance.yaml',
  ],
  [
    'weekly plan',
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-weekly-plan.yaml',
  ],
]) {
  test(`production schema projection: invalid ${label} keeps the exact artifact path`, async () => {
    await mutateFixtureYaml(
      artifactPath,
      (artifact) => {
        artifact.unknown_quality_field = true;
      },
      async () => {
        const repository = await loadMutatedFixture();
        const failure = assertMachineSchemaFailure(repository, artifactPath);
        assert.ok(failure.diagnostics.every((diagnostic) => (
          diagnostic.related_paths.includes(artifactPath)
        )));
        assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
          diagnostic.file === artifactPath
          && diagnostic.reason === 'unknown field unknown_quality_field'
        )));
      },
    );
  });
}

test('production schema projection: unknown integration-index field fails', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/integration-index.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (index) => {
      index.unknown_quality_field = true;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.field === '/unknown_quality_field'
        && diagnostic.reason === 'unknown field unknown_quality_field'
      )));
    },
  );
});

test('production schema projection: missing integration-index field fails without TypeError', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/integration-index.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (index) => {
      delete index.unit_id;
    },
    async () => {
      let repository;
      await assert.doesNotReject(async () => {
        repository = await loadMutatedFixture();
      });
      const failure = assertMachineSchemaFailure(repository, artifactPath);
      assert.ok(failure.schemaDiagnostics.some((diagnostic) => (
        diagnostic.reason === 'missing required field unit_id'
      )));
    },
  );
});

test('production schema projection recovers after the current artifact is restored', async () => {
  const artifactPath =
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml';
  await mutateFixtureYaml(
    artifactPath,
    (lessonDna) => {
      lessonDna.unknown_quality_field = true;
    },
    async () => {
      assertMachineSchemaFailure(await loadMutatedFixture(), artifactPath);
    },
  );
  const restored = await loadMutatedFixture();
  assert.equal(evaluate(restored).claims.pedagogy_schema_valid, true);
  assert.equal(schemaDiagnosticsFor(restored, artifactPath).length, 0);
});

test('activity safety resolver uses exact base and execution-profile metadata', () => {
  const selection = projectionBaseline.selectionRepository;
  assert.equal(
    targetRequiresAdultSupervision(selection, 'gallery-walk'),
    true,
  );
  assert.equal(
    targetRequiresAdultSupervision(
      selection,
      'learning-stations::practical-home-passive-ice-observation',
    ),
    true,
  );
  assert.equal(
    targetRequiresAdultSupervision(selection, 'unknown-quality-target'),
    false,
  );
});

test('activity safety resolver never accepts the misspelled legacy alias', () => {
  const selection = structuredClone(projectionBaseline.selectionRepository);
  const activity = selection.knowledge.activities.data.activities.find(
    (candidate) => candidate.activity_id === 'gallery-walk',
  );
  activity.safety.requires_adult_supervision = false;
  activity.safety.adult_supervision_required = true;
  assert.equal(targetRequiresAdultSupervision(selection, 'gallery-walk'), false);
});

test('production safety projection remains activity-applicable with active parent role', async () => {
  const dnaPath =
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml';
  const packagePath =
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-package.yaml';
  await mutateFixtureYaml(
    dnaPath,
    (lessonDna) => {
      lessonDna.phases[0].target.target_id = 'gallery-walk';
    },
    async () => {
      await mutateFixtureYaml(
        packagePath,
        (homeschoolPackage) => {
          homeschoolPackage.safety.source_supervision_required = false;
          homeschoolPackage.safety.adapted_supervision_required = false;
          homeschoolPackage.safety.effective_supervision_required = false;
          homeschoolPackage.safety.adult_supervision_required = false;
          homeschoolPackage.safety.teacher_authorization_required = false;
        },
        async () => {
          const repository = await loadMutatedFixture();
          const record = homeschool(repository, 0);
          assert.equal(record.safety.applicable, true);
          assert.equal(record.safety.adult_supervision_present, false);
          const evaluation = evaluate(repository);
          assert.ok(gateDiagnostic(
            evaluation,
            'safety-contract-preserved',
            'safety_contract_invalid',
          ));
          assert.ok(evaluation.results.some((result) => (
            result.gate_id === 'structural-completeness'
            && result.record_id === record.record_id
            && result.status === 'error'
          )));
        },
      );
    },
  );
});

test('production projection: real timing YAML mutation blocks timing and structural completeness', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/integration-index.yaml',
    (index) => {
      index.lessons[0].timing_reconciliation.stage_partitions[0].allocated_minutes += 1;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const evaluation = evaluate(repository);
      assert.ok(gateDiagnostic(
        evaluation,
        'timing-reconciled',
        'timing_reconciliation_failed',
      ));
      assert.equal(evaluation.claims.structurally_complete, false);
    },
  );
});

test('production projection: required retrieval plan cannot disappear', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      delete lessonDna.retrieval_plan;
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'retrieval-cycle-valid', 'retrieval_cycle_invalid'));
      assert.ok(gateDiagnostic(
        evaluation,
        'pattern-structure-aligned',
        'pattern_structure_incomplete',
      ));
    },
  );
});

test('production projection: correction phase cannot equal immediate retrieval phase', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      lessonDna.retrieval_plan.correction_phase_id =
        lessonDna.retrieval_plan.immediate_phase_id;
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'retrieval-cycle-valid', 'retrieval_cycle_invalid'));
    },
  );
});

test('production projection: missing home correction produces a diagnostic instead of a crash', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-adaptation-decision.yaml',
    (decision) => {
      decision.phase_adaptations = decision.phase_adaptations.filter(
        (adaptation) => adaptation.source_phase_id !== 'formative-check',
      );
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'retrieval-cycle-valid', 'retrieval_cycle_invalid'));
    },
  );
});

test('production projection: backward thematic retrieval link fails', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/thematic-plan.yaml',
    (thematicPlan) => {
      thematicPlan.pedagogical_integration.delayed_retrieval_links[0]
        .target_lesson_id = 'grade-5-water-01-properties';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'delayed-retrieval-forward',
        'delayed_retrieval_not_forward',
      ));
    },
  );
});

test('production projection: missing thematic retrieval link fails', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/thematic-plan.yaml',
    (thematicPlan) => {
      thematicPlan.pedagogical_integration.delayed_retrieval_links.shift();
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'delayed-retrieval-forward',
        'delayed_retrieval_not_forward',
      ));
    },
  );
});

test('production projection: absolute learner date cannot hide in delayed retrieval', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/thematic-plan.yaml',
    (thematicPlan) => {
      thematicPlan.pedagogical_integration.delayed_retrieval_links[0]
        .relative_window.date = '2026-09-01';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'delayed-retrieval-forward',
        'delayed_retrieval_not_forward',
      ));
    },
  );
});

test('production projection: stale taxonomy version fails identity', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      lessonDna.versions.taxonomy = '0.9';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'identity-chain-current', 'pedagogy_identity_stale'));
    },
  );
});

test('production projection: stale selection-rules version fails identity', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-selection-request.yaml',
    (request) => {
      request.selection_rules_version = '9.9';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'identity-chain-current', 'pedagogy_identity_stale'));
    },
  );
});

test('production projection: same-length wrong catalogue digest is not current', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      lessonDna.versions.activity_catalog_digest = 'a'.repeat(64);
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      const diagnostic = gateDiagnostic(
        evaluation,
        'identity-chain-current',
        'pedagogy_identity_stale',
      );
      assert.ok(diagnostic.actual.includes('catalogue_digest_current'));
    },
  );
});

test('production projection: homeschool DNA digest mismatch fails identity', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-01-package.yaml',
    (homeschoolPackage) => {
      homeschoolPackage.source_identity.source_lesson_dna_digest = 'b'.repeat(64);
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'identity-chain-current', 'pedagogy_identity_stale'));
    },
  );
});

test('production projection: changing one reviewable byte changes current fingerprint', async () => {
  const before = production.reportMetadata.teacherPackFingerprint;
  await withFixtureFile(
    'teacher-packs/grade-5-science/water/teacher-guide.md',
    (bytes) => Buffer.concat([bytes, Buffer.from('\n<!-- fingerprint mutation -->\n')]),
    async () => {
      const repository = await loadMutatedFixture();
      assert.notEqual(repository.reportMetadata.teacherPackFingerprint.value, before.value);
      assert.equal(
        repository.reportMetadata.teacherPackFingerprint.file_count,
        before.file_count,
      );
      const mutatedReport = buildPedagogyQualityReport(
        repository,
        evaluate(repository),
        {
          reportId: WATER_QUALITY_REPORT_ID,
          reportPath: WATER_QUALITY_REPORT_PATH,
        },
      );
      const committedReport = await fs.readFile(
        path.join(fixtureRoot, WATER_QUALITY_REPORT_PATH),
        'utf8',
      );
      assert.notEqual(
        serializePedagogyQualityReport(mutatedReport),
        committedReport,
        'committed report check must detect a changed current fingerprint',
      );
    },
  );
});

test('evidence fingerprint equality requires algorithm, specification, value and file count', () => {
  const current = production.reportMetadata.teacherPackFingerprint;
  assert.equal(pedagogicalEvidenceFingerprintMatches(current, current), true);
  assert.equal(pedagogicalEvidenceFingerprintMatches({
    ...current,
    value: current.value === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64),
  }, current), false);
  assert.equal(pedagogicalEvidenceFingerprintMatches({
    ...current,
    file_count: current.file_count + 1,
  }, current), false);
  assert.equal(pedagogicalEvidenceFingerprintMatches({
    ...current,
    specification_version: '9.9',
  }, current), false);
  assert.equal(pedagogicalEvidenceFingerprintMatches({
    ...current,
    algorithm: 'sha512',
  }, current), false);
});

test('production projection: registering current human evidence does not change pack fingerprint', async () => {
  const current = production.reportMetadata.teacherPackFingerprint;
  await withCompletedReviewFixture(current, async () => {
    const repository = await loadMutatedFixture();
    const pack = teacherPack(repository);
    assert.deepEqual(repository.reportMetadata.teacherPackFingerprint, current);
    assert.equal(pack.readiness.evidence.effective_teacher_review, true);
    assert.equal(pack.readiness.evidence.stale_teacher_review, false);
    assert.ok(pack.readiness.evidence.related_paths.includes(
      'pedagogical-reviews/grade-5-science/water/teacher-review-quality-fixture.yaml',
    ));
  });
});

test('production projection: completed review with a same-length wrong hash is stale', async () => {
  const current = production.reportMetadata.teacherPackFingerprint;
  const stale = {
    ...current,
    value: current.value === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64),
  };
  await withCompletedReviewFixture(stale, async () => {
    const repository = await loadMutatedFixture();
    const pack = teacherPack(repository);
    assert.equal(pack.readiness.evidence.effective_teacher_review, false);
    assert.equal(pack.readiness.evidence.stale_teacher_review, true);
    const evaluation = evaluate(repository);
    assert.ok(gateDiagnostic(
      evaluation,
      'readiness-honest',
      'readiness_claim_not_supported',
    ));
    const report = buildPedagogyQualityReport(repository, evaluation, {
      reportId: WATER_QUALITY_REPORT_ID,
      reportPath: WATER_QUALITY_REPORT_PATH,
    });
    assert.equal(report.readiness.evidence.stale_teacher_review, true);
  });
});

test('production projection: completed review with a stale file count is stale', async () => {
  const current = production.reportMetadata.teacherPackFingerprint;
  await withCompletedReviewFixture({
    ...current,
    file_count: current.file_count + 1,
  }, async () => {
    const repository = await loadMutatedFixture();
    const pack = teacherPack(repository);
    assert.equal(pack.readiness.evidence.effective_teacher_review, false);
    assert.equal(pack.readiness.evidence.stale_teacher_review, true);
  });
});

test('production projection: ready claim without effective evidence fails', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    (lesson) => {
      lesson.artifact_readiness.classroom_ready = true;
      lesson.pedagogical_integration.status.classroom_ready = true;
    },
    async () => {
      const repository = await loadMutatedFixture();
      const evaluation = evaluate(repository);
      assert.ok(gateDiagnostic(
        evaluation,
        'readiness-honest',
        'readiness_claim_not_supported',
      ));
      const report = buildPedagogyQualityReport(repository, evaluation, {
        reportId: WATER_QUALITY_REPORT_ID,
        reportPath: WATER_QUALITY_REPORT_PATH,
      });
      assert.equal(report.readiness.classroom_ready, 'mixed');
    },
  );
});

test('production projection: missing registered artifact file fails resolution', async () => {
  await withFixtureFile(
    'teacher-packs/grade-5-science/water/lessons/lesson-01.md',
    () => null,
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(
        gateDiagnostic(evaluation, 'cross-artifact-alignment')
        || gateDiagnostic(evaluation, 'schema-valid'),
      );
    },
  );
});

test('production projection: unknown material ID fails registered closure', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    (lesson) => {
      lesson.pedagogical_integration.phase_bindings[0]
        .teacher_material_ids = ['unregistered-lesson-guide'];
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'cross-artifact-alignment',
        'cross_artifact_alignment_failed',
      ));
    },
  );
});

test('production projection: reselected target requires actual explicit contract', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-03.yaml',
    (lesson) => {
      lesson.pedagogical_integration.selection_input.homeschool
        .adapted_task_contracts = lesson.pedagogical_integration.selection_input
        .homeschool.adapted_task_contracts.filter(
          (contract) => contract.source_phase_id !== 'practical-work',
        );
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'material-closure-resolved',
        'homeschool_material_closure_invalid',
      ));
    },
  );
});

test('production projection: downstream supervision flag cannot disable safety gate', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/homeschool/lesson-03-package.yaml',
    (homeschoolPackage) => {
      homeschoolPackage.safety.effective_supervision_required = false;
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'safety-contract-preserved',
        'safety_contract_invalid',
      ));
    },
  );
});

test('production projection: required prior-knowledge component cannot disappear', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      lessonDna.phases = lessonDna.phases.filter(
        (phase) => phase.phase_id !== 'activation',
      );
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'pattern-structure-aligned',
        'pattern_structure_incomplete',
      ));
    },
  );
});

test('production projection: required guided-practice component cannot disappear', async () => {
  await mutateFixtureYaml(
    'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
    (lessonDna) => {
      lessonDna.phases = lessonDna.phases.filter(
        (phase) => phase.phase_id !== 'guided-practice',
      );
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'pattern-structure-aligned',
        'pattern_structure_incomplete',
      ));
    },
  );
});

test('production projection: practical material must bind to the practical DNA phase', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-03.yaml',
    (lesson) => {
      lesson.pedagogical_integration.phase_bindings.find(
        (binding) => binding.dna_phase_id === 'practical-work',
      ).dna_phase_id = 'evidence-check';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'pattern-structure-aligned',
        'pattern_structure_incomplete',
      ));
    },
  );
});

test('production projection: formative assessment requires materialized evidence', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    (lesson) => {
      for (const binding of lesson.pedagogical_integration.phase_bindings) {
        binding.assessment_refs = [];
      }
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(
        evaluation,
        'pattern-structure-aligned',
        'pattern_structure_incomplete',
      ));
    },
  );
});

test('production projection: source-closed retrieval rejects open source access', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    (lesson) => {
      lesson.pedagogical_integration.phase_bindings.find(
        (binding) => binding.dna_phase_id === 'retrieval',
      ).source_access_policy = 'open';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'retrieval-cycle-valid', 'retrieval_cycle_invalid'));
    },
  );
});

test('production projection: key open before attempt fails retrieval', async () => {
  await mutateFixtureYaml(
    'lesson-plans/grade-5-science/water/lesson-01.yaml',
    (lesson) => {
      lesson.pedagogical_integration.phase_bindings.find(
        (binding) => binding.dna_phase_id === 'retrieval',
      ).render_contract.answer_access_policy = 'not_applicable';
    },
    async () => {
      const evaluation = evaluate(await loadMutatedFixture());
      assert.ok(gateDiagnostic(evaluation, 'retrieval-cycle-valid', 'retrieval_cycle_invalid'));
    },
  );
});

test('production projection: unrelated legacy route does not change water report', async () => {
  const unrelatedDirectory = path.join(
    fixtureRoot,
    'lesson-plans/grade-4-science/unrelated',
  );
  const unrelatedPath = path.join(unrelatedDirectory, 'lesson.yaml');
  await fs.mkdir(unrelatedDirectory, { recursive: true });
  await fs.copyFile(
    path.join(
      fixtureRoot,
      'lesson-plans/grade-5-science/water-use-cycle/lesson-01.yaml',
    ),
    unrelatedPath,
  );
  productionAdapterMutationCount += 1;
  try {
    const repository = await loadMutatedFixture();
    const report = buildPedagogyQualityReport(repository, evaluate(repository), {
      reportId: WATER_QUALITY_REPORT_ID,
      reportPath: WATER_QUALITY_REPORT_PATH,
    });
    assert.equal(report.scope.legacy_lesson_count, 6);
    assert.equal(report.counts.warnings, 6);
    assert.equal(report.checked_artifacts.some(
      (artifact) => artifact.includes('grade-4-science/unrelated'),
    ), false);
  } finally {
    await fs.rm(unrelatedDirectory, { recursive: true, force: true });
  }
});

test('production projection: orphan active exception invalidates loaded configuration', async () => {
  await mutateFixtureYaml(
    'knowledge/pedagogy/quality/quality-exceptions.yaml',
    (exceptions) => {
      exceptions.exceptions.push({
        exception_id: 'orphan-production-fixture',
        gate_id: 'timing-reconciled',
        artifact_path: 'lesson-plans/grade-5-science/water/missing.yaml',
        record_id: 'missing-water-lesson',
        gate_version: '1.0',
        reason_ru: 'Synthetic orphan used only by a temporary quality test fixture.',
        lesson_pattern: 'nonstandard-bounded-lesson',
        author_role: 'subject_teacher',
        status: 'active',
      });
    },
    async () => {
      const repository = await loadMutatedFixture();
      assert.throws(
        () => evaluate(repository),
        /references a missing artifact\/record target/u,
      );
    },
  );
});

test('production projection: unimplemented loaded catalogue gate is rejected', async () => {
  await mutateFixtureYaml(
    'knowledge/pedagogy/quality/quality-gates.yaml',
    (catalogue) => {
      catalogue.gates.push({
        gate_id: 'unused-production-fixture-gate',
        gate_version: '1.0',
        title: 'Synthetic unimplemented production fixture gate',
        description: 'Exists only in a temporary repository fixture.',
        applies_to: ['legacy_lesson'],
        severity: 'warning',
        guarantee: 'No guarantee because an implementation is intentionally absent.',
        non_guarantees: ['This fixture is not production policy.'],
        exception_policy: 'exact_record_only',
        claim_origin: 'project_authored_design',
      });
    },
    async () => {
      const repository = await loadMutatedFixture();
      assert.throws(
        () => evaluate(repository),
        /exactly one executable primitive or derived evaluator/u,
      );
    },
  );
});

test('production adapter mutation suite covers at least forty-one real artifact mutations', () => {
  assert.ok(productionAdapterMutationCount >= 41);
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
