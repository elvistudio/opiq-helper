import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  parseStrictPedagogyYaml,
} from './pedagogy-knowledge.mjs';
import {
  sha256PedagogyValue,
  stablePedagogyJson,
} from './pedagogy-selection.mjs';

export const PEDAGOGY_QUALITY_ENGINE_VERSION = '1.1';
export const PEDAGOGY_QUALITY_CATALOGUE_PATH =
  'knowledge/pedagogy/quality/quality-gates.yaml';
export const PEDAGOGY_QUALITY_EXCEPTIONS_PATH =
  'knowledge/pedagogy/quality/quality-exceptions.yaml';

const QUALITY_SCHEMA_PATHS = {
  common: 'knowledge/pedagogy/schemas/pedagogical-common.schema.json',
  teachingCommon: 'schemas/teaching-plan-common.schema.json',
  gates: 'schemas/pedagogy-quality-gates.schema.json',
  exceptions: 'schemas/pedagogy-quality-exception.schema.json',
  report: 'schemas/pedagogy-quality-report.schema.json',
};

const ALLOWED_DELAY_KEYS = new Set(['after_days', 'after_lessons', 'next_unit']);
const NON_GUARANTEES = [
  'Classroom testing has not been performed by this structural validator.',
  'Homeschool testing has not been performed by this structural validator.',
  'Human teacher approval has not been granted by this structural validator.',
  'Official curriculum completeness is not claimed by this structural validator.',
  'Pedagogical effectiveness is not established by structural validation.',
];

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareBytewise);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safePath(rootDir, repositoryPath) {
  return safeRepositoryPath(rootDir, repositoryPath, 'pedagogy quality path');
}

export function normalizePedagogyQualityPath(repositoryPath) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.posix.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.startsWith('./')
    || repositoryPath.endsWith('/')
    || repositoryPath.split('/').some((segment) => segment === '' || segment === '.'
      || segment === '..')
    || path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    const error = new Error(
      `quality path must use canonical repository-relative POSIX form: ${repositoryPath}`,
    );
    error.code = 'invalid_quality_path';
    throw error;
  }
  return repositoryPath;
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await fs.readFile(safePath(rootDir, repositoryPath), 'utf8'));
}

async function readYaml(rootDir, repositoryPath) {
  return parseStrictPedagogyYaml(
    await fs.readFile(safePath(rootDir, repositoryPath), 'utf8'),
    repositoryPath,
  );
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') {
    return `unknown field ${error.params.additionalProperty}`;
  }
  if (error.keyword === 'required') {
    return `missing required field ${error.params.missingProperty}`;
  }
  return error.message ?? `failed ${error.keyword}`;
}

function compileQualitySchemas(schemas) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  ajv.addSchema(schemas.common);
  ajv.addSchema(schemas.teachingCommon);
  return {
    catalogue: ajv.compile(schemas.gates),
    exceptions: ajv.compile(schemas.exceptions),
    report: ajv.compile(schemas.report),
  };
}

export async function loadPedagogyQualityConfiguration({
  rootDir = process.cwd(),
  cataloguePath = PEDAGOGY_QUALITY_CATALOGUE_PATH,
  exceptionsPath = PEDAGOGY_QUALITY_EXCEPTIONS_PATH,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [catalogue, exceptions, common, teachingCommon, gates, exceptionSchema, report] =
    await Promise.all([
      readYaml(absoluteRoot, cataloguePath),
      readYaml(absoluteRoot, exceptionsPath),
      readJson(absoluteRoot, QUALITY_SCHEMA_PATHS.common),
      readJson(absoluteRoot, QUALITY_SCHEMA_PATHS.teachingCommon),
      readJson(absoluteRoot, QUALITY_SCHEMA_PATHS.gates),
      readJson(absoluteRoot, QUALITY_SCHEMA_PATHS.exceptions),
      readJson(absoluteRoot, QUALITY_SCHEMA_PATHS.report),
    ]);
  const schemas = {
    common,
    teachingCommon,
    gates,
    exceptions: exceptionSchema,
    report,
  };
  return {
    rootDir: absoluteRoot,
    cataloguePath,
    exceptionsPath,
    catalogue,
    exceptions,
    schemas,
    validators: compileQualitySchemas(schemas),
  };
}

function diagnosticSortKey(item) {
  return [
    item.gate_id,
    item.artifact_path,
    item.record_id,
    item.code,
    item.exception_id ?? '',
    item.message,
  ].join('\u0000');
}

export function sortPedagogyQualityDiagnostics(diagnostics) {
  return [...diagnostics].sort((left, right) => (
    compareBytewise(diagnosticSortKey(left), diagnosticSortKey(right))
  ));
}

function resultSortKey(item) {
  return [
    item.gate_id,
    item.artifact_path,
    item.record_id,
    item.status,
  ].join('\u0000');
}

function sortResults(results) {
  return [...results].sort((left, right) => (
    compareBytewise(resultSortKey(left), resultSortKey(right))
  ));
}

function createDiagnostic(gate, {
  severity = gate.severity,
  code,
  message,
  artifactPath,
  recordId,
  relatedPaths,
  expected,
  actual,
  exceptionId,
}) {
  return {
    gate_id: gate.gate_id,
    gate_version: gate.gate_version,
    severity,
    code,
    message,
    artifact_path: artifactPath,
    record_id: recordId,
    ...(relatedPaths?.length ? { related_paths: uniqueSorted(relatedPaths) } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {}),
    ...(exceptionId ? { exception_id: exceptionId } : {}),
  };
}

function gateResult(gate, record, status) {
  return {
    gate_id: gate.gate_id,
    gate_version: gate.gate_version,
    artifact_path: record.artifact_path,
    record_id: record.record_id,
    status,
  };
}

function schemaDiagnostics(validator, data, label) {
  if (validator(data)) return [];
  return (validator.errors ?? []).map(
    (error) => `${label}${error.instancePath || '/'}: ${schemaReason(error)}`,
  );
}

function validateSortedUnique(values, label, selector = (value) => value) {
  const selected = values.map(selector);
  const expected = [...selected].sort(compareBytewise);
  if (new Set(selected).size !== selected.length) return `${label} contains duplicates`;
  if (stablePedagogyJson(selected) !== stablePedagogyJson(expected)) {
    return `${label} must be bytewise sorted`;
  }
  return null;
}

export function validatePedagogyQualityConfiguration(configuration) {
  const errors = [
    ...schemaDiagnostics(
      configuration.validators.catalogue,
      configuration.catalogue,
      configuration.cataloguePath,
    ),
    ...schemaDiagnostics(
      configuration.validators.exceptions,
      configuration.exceptions,
      configuration.exceptionsPath,
    ),
  ];
  const gateOrderError = validateSortedUnique(
    configuration.catalogue.gates ?? [],
    'quality gate IDs',
    (gate) => gate.gate_id,
  );
  if (gateOrderError) errors.push(gateOrderError);
  for (const gate of configuration.catalogue.gates ?? []) {
    const applicabilityError = validateSortedUnique(
      gate.applies_to ?? [],
      `${gate.gate_id} applies_to`,
    );
    if (applicabilityError) errors.push(applicabilityError);
  }
  const gateById = new Map(
    (configuration.catalogue.gates ?? []).map((gate) => [gate.gate_id, gate]),
  );
  for (const gate of configuration.catalogue.gates ?? []) {
    const primitiveCount = Object.hasOwn(EVALUATORS, gate.gate_id) ? 1 : 0;
    const derivedCount = Object.hasOwn(DERIVED_EVALUATORS, gate.gate_id) ? 1 : 0;
    if (primitiveCount + derivedCount !== 1) {
      errors.push(
        `quality gate ${gate.gate_id} must have exactly one executable primitive `
        + 'or derived evaluator',
      );
    }
  }
  const records = configuration.records ?? [];
  const recordsByPathAndId = new Map(records.map((record) => [
    `${record.artifact_path}\u0000${record.record_id}`,
    record,
  ]));
  const seenExceptionIds = new Set();
  const seenTargets = new Set();
  for (const exception of configuration.exceptions.exceptions ?? []) {
    if (seenExceptionIds.has(exception.exception_id)) {
      errors.push(`duplicate quality exception ID: ${exception.exception_id}`);
    }
    seenExceptionIds.add(exception.exception_id);
    const targetKey = [
      exception.gate_id,
      exception.artifact_path,
      exception.record_id,
    ].join('\u0000');
    if (seenTargets.has(targetKey)) {
      errors.push(
        `duplicate or conflicting quality exception target: ${exception.gate_id} `
        + `${exception.artifact_path} ${exception.record_id}`,
      );
    }
    seenTargets.add(targetKey);
    const gate = gateById.get(exception.gate_id);
    if (!gate) {
      errors.push(`quality exception ${exception.exception_id} references unknown gate`);
      continue;
    }
    if (exception.gate_version !== gate.gate_version) {
      errors.push(
        `quality exception ${exception.exception_id} uses stale gate version `
        + `${exception.gate_version}; expected ${gate.gate_version}`,
      );
    }
    if (exception.status === 'active' && gate.exception_policy === 'prohibited') {
      errors.push(
        `quality exception ${exception.exception_id} cannot suppress `
        + `non-exemptible gate ${gate.gate_id}`,
      );
    }
    if (exception.status === 'active') {
      const record = recordsByPathAndId.get(
        `${exception.artifact_path}\u0000${exception.record_id}`,
      );
      if (!record) {
        errors.push(
          `active quality exception ${exception.exception_id} references a missing `
          + 'artifact/record target',
        );
      } else if (!gate.applies_to.includes(record.kind)) {
        errors.push(
          `active quality exception ${exception.exception_id} targets ${record.kind}, `
          + `but gate ${gate.gate_id} does not apply to that record kind`,
        );
      }
    }
  }
  return errors.sort(compareBytewise);
}

function findException(repository, gate, record) {
  return repository.exceptions.exceptions.find((exception) => (
    exception.status === 'active'
    && exception.gate_id === gate.gate_id
    && exception.gate_version === gate.gate_version
    && exception.artifact_path === record.artifact_path
    && exception.record_id === record.record_id
  ));
}

function checkedBoolean(value) {
  return value === true;
}

function evaluateSchema(record) {
  return record.schema_valid === true
    ? null
    : {
      code: 'pedagogy_schema_invalid',
      message: 'The integrated artifact or one of its declared dependencies is not schema-valid.',
      expected: { schema_valid: true },
      actual: {
        schema_valid: record.schema_valid,
        diagnostics: record.schema_diagnostics ?? [],
      },
      relatedPaths: record.schema_related_paths,
    };
}

function evaluateIdentity(record) {
  const identity = record.identity;
  const requiredChecks = identity?.required_checks ?? [];
  if (requiredChecks.length === 0) {
    return {
      code: 'pedagogy_identity_checks_missing',
      message: 'No explicit identity checks were projected for this record.',
    };
  }
  const failed = requiredChecks.filter((key) => !checkedBoolean(identity?.[key]));
  return failed.length === 0
    ? null
    : {
      code: 'pedagogy_identity_stale',
      message: `Current pedagogical identity checks failed: ${failed.join(', ')}.`,
      expected: requiredChecks,
      actual: failed,
      relatedPaths: identity?.related_paths,
    };
}

function evaluatePattern(record) {
  const structure = record.structure;
  if (!structure?.learning_goals_present) {
    return {
      code: 'learning_goals_missing',
      message: 'The integrated lesson does not expose explicit learning goals.',
    };
  }
  const failed = [
    ['phase_goal_alignment', structure.phase_goal_alignment],
    ['pattern_required_components', structure.pattern_required_components],
    ['declared_practice_alignment', structure.declared_practice_alignment],
    ['formative_assessment_alignment', structure.formative_assessment_alignment],
    ['retrieval_alignment', structure.retrieval_alignment],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'pattern_structure_incomplete',
      message: `Pattern-dependent pedagogical structure is incomplete: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateTiming(record) {
  const timing = record.timing;
  const failed = [
    ['reconciled', timing?.reconciled],
    ['lesson_total_exact', timing?.lesson_total_exact],
    ['stage_partition_exact', timing?.stage_partition_exact],
    ['component_total_exact', timing?.component_total_exact],
    ['double_count_absent', timing?.double_count_absent],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'timing_reconciliation_failed',
      message: `Component timing does not reconcile: ${failed.join(', ')}.`,
      expected: record.duration_minutes,
      actual: timing,
    };
}

function evaluateRetrieval(record) {
  if (!record.retrieval?.applicable) return { notApplicable: true };
  const failed = [
    ['closed_first_attempt', record.retrieval.closed_first_attempt],
    ['later_correction_present', record.retrieval.later_correction_present],
    ['key_after_attempt', record.retrieval.key_after_attempt],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'retrieval_cycle_invalid',
      message: `Retrieval first-attempt and correction contract failed: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateDelayed(record) {
  if (!record.delayed_retrieval?.applicable) return { notApplicable: true };
  const windows = record.delayed_retrieval.windows ?? [];
  const invalid = windows.filter((window) => {
    if (!isObject(window)) return true;
    const relativeKeys = Object.keys(window).filter((key) => ALLOWED_DELAY_KEYS.has(key));
    if (relativeKeys.length !== 1) return true;
    const key = relativeKeys[0];
    if (key === 'next_unit') return window[key] !== true;
    return !Number.isInteger(window[key]) || window[key] < 1;
  });
  const failed = invalid.length > 0
    || record.delayed_retrieval.windows_schema_valid !== true
    || record.delayed_retrieval.absolute_dates_absent !== true
    || record.delayed_retrieval.thematic_link_current !== true;
  return failed
    ? {
      code: 'delayed_retrieval_not_forward',
      message: 'Delayed retrieval must use a supported positive relative window linked to the thematic plan.',
      actual: record.delayed_retrieval,
    }
    : null;
}

function evaluateLanguage(record) {
  const failed = [
    ['primary_language_valid', record.language?.primary_language_valid],
    ['support_configuration_valid', record.language?.support_configuration_valid],
    ['estonian_roles_bounded', record.language?.estonian_roles_bounded],
    ['productive_demand_within_ceiling', record.language?.productive_demand_within_ceiling],
    ['required_scaffolds_present', record.language?.required_scaffolds_present],
    ['complex_reasoning_primary_language', record.language?.complex_reasoning_primary_language],
    ['assessment_separated', record.language?.assessment_separated],
    ['subject_score_language_neutral', record.language?.subject_score_language_neutral],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'language_role_incompatible',
      message: `Language-role contract failed: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateDifferentiation(record) {
  const failed = [
    ['metadata_present', record.differentiation?.metadata_present],
    ['hard_constraints_respected', record.differentiation?.hard_constraints_respected],
    ['uncertainty_explicit', record.differentiation?.uncertainty_explicit],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'differentiation_accessibility_incomplete',
      message: `Differentiation or accessibility metadata needs review: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateMaterialClosure(record) {
  if (!record.home?.applicable) return { notApplicable: true };
  const failed = [
    ['material_closure_resolved', record.home.material_closure_resolved],
    ['delivery_scope_valid', record.home.delivery_scope_valid],
    ['adapted_contracts_complete', record.home.adapted_contracts_complete],
    ['classroom_materials_absent', record.home.classroom_materials_absent],
    ['parent_role_bounded', record.home.parent_role_bounded],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'homeschool_material_closure_invalid',
      message: `Resolved homeschool material closure failed: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateSafety(record) {
  if (!record.safety?.applicable) return { notApplicable: true };
  const failed = [
    ['adult_supervision_present', record.safety.adult_supervision_present],
    ['teacher_authorization_present', record.safety.teacher_authorization_present],
    ['procedure_refs_resolved', record.safety.procedure_refs_resolved],
    ['safety_refs_resolved', record.safety.safety_refs_resolved],
    ['stop_conditions_present', record.safety.stop_conditions_present],
    ['policy_task_package_render_aligned', record.safety.policy_task_package_render_aligned],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'safety_contract_invalid',
      message: `Practical safety contract failed: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateAlignment(record) {
  const failed = [
    ['all_phases_materialized', record.alignment?.all_phases_materialized],
    ['task_identity_aligned', record.alignment?.task_identity_aligned],
    ['learner_criteria_present', record.alignment?.learner_criteria_present],
    ['answer_policy_aligned', record.alignment?.answer_policy_aligned],
    ['artifact_paths_resolved', record.alignment?.artifact_paths_resolved],
    ['machine_rendered_equivalent', record.alignment?.machine_rendered_equivalent],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'cross_artifact_alignment_failed',
      message: `Lesson-to-rendered-artifact chain failed: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateAnswerLeak(record) {
  const leaks = record.answer_leaks ?? [];
  return leaks.length === 0
    ? null
    : {
      code: 'learner_answer_leak',
      message: 'A complete teacher-only answer appears in learner-facing material.',
      relatedPaths: leaks.map((leak) => leak.path),
      actual: leaks,
    };
}

function evaluateReadiness(record) {
  const status = record.readiness;
  const failed = [];
  const evidence = status?.evidence ?? {};
  if (status?.state_consistent !== true) failed.push('state_consistent');
  if (evidence.stale_teacher_review === true) failed.push('stale_teacher_review');
  if (evidence.stale_classroom_trial === true) failed.push('stale_classroom_trial');
  if (evidence.stale_home_trial === true) failed.push('stale_home_trial');
  if (
    status?.teacher_review === 'approved_for_both'
    && evidence.effective_teacher_review !== true
  ) {
    failed.push('teacher_review_evidence');
  }
  if (
    status?.classroom_review === 'approved'
    && evidence.effective_classroom_review !== true
  ) {
    failed.push('classroom_review_evidence');
  }
  if (
    status?.homeschool_review === 'approved'
    && evidence.effective_homeschool_review !== true
  ) {
    failed.push('homeschool_review_evidence');
  }
  if (
    status?.classroom_trial === 'tested'
    && evidence.effective_classroom_trial !== true
  ) {
    failed.push('classroom_trial_evidence');
  }
  if (
    status?.classroom_ready === true
    && (
      evidence.effective_classroom_review !== true
      || evidence.effective_classroom_trial !== true
      || evidence.negative_classroom_review === true
      || evidence.negative_classroom_trial === true
    )
  ) {
    failed.push('classroom_ready_evidence');
  }
  if (
    status?.home_trial === 'tested'
    && evidence.effective_home_trial !== true
  ) {
    failed.push('home_trial_evidence');
  }
  if (
    status?.homeschool_ready === true
    && (
      evidence.effective_homeschool_review !== true
      || evidence.effective_home_trial !== true
      || evidence.negative_homeschool_review === true
      || evidence.negative_home_trial === true
    )
  ) {
    failed.push('homeschool_ready_evidence');
  }
  if (status?.effectiveness_claimed === true) failed.push('effectiveness_evidence');
  return failed.length === 0
    ? null
    : {
      code: 'readiness_claim_not_supported',
      message: `Readiness or effectiveness state lacks current human evidence: ${failed.join(', ')}.`,
      actual: status,
      relatedPaths: evidence.related_paths,
    };
}

function evaluateProvenance(record) {
  const failed = [
    ['source_and_pedagogy_separated', record.provenance?.source_and_pedagogy_separated],
    ['pedagogy_claim_origin_explicit', record.provenance?.pedagogy_claim_origin_explicit],
    ['official_curriculum_claim_absent', record.provenance?.official_curriculum_claim_absent],
  ].filter(([, value]) => value !== true).map(([key]) => key);
  return failed.length === 0
    ? null
    : {
      code: 'pedagogical_provenance_invalid',
      message: `Source and pedagogical provenance are not safely separated: ${failed.join(', ')}.`,
      actual: failed,
    };
}

function evaluateLegacy() {
  return {
    code: 'legacy_artifact_not_integrated',
    message: 'Legacy lesson remains valid but is outside the full pedagogical integration contract.',
    severity: 'warning',
  };
}

const EVALUATORS = {
  'answer-leakage-absent': evaluateAnswerLeak,
  'cross-artifact-alignment': evaluateAlignment,
  'delayed-retrieval-forward': evaluateDelayed,
  'differentiation-accessibility': evaluateDifferentiation,
  'identity-chain-current': evaluateIdentity,
  'language-role-compatible': evaluateLanguage,
  'legacy-migration-status': evaluateLegacy,
  'material-closure-resolved': evaluateMaterialClosure,
  'pattern-structure-aligned': evaluatePattern,
  'provenance-separated': evaluateProvenance,
  'readiness-honest': evaluateReadiness,
  'retrieval-cycle-valid': evaluateRetrieval,
  'safety-contract-preserved': evaluateSafety,
  'schema-valid': evaluateSchema,
  'timing-reconciled': evaluateTiming,
};

function appliesTo(gate, record) {
  return gate.applies_to.includes(record.kind);
}

function aggregateStatus(results, diagnostics) {
  const errors = results.filter((item) => item.status === 'error').length;
  const warnings = results.filter((item) => item.status === 'warning').length;
  return {
    errors,
    warnings,
    info: results.filter((item) => item.status === 'info').length,
    passed: results.filter((item) => item.status === 'passed').length,
    excepted: results.filter((item) => item.status === 'excepted').length,
    not_applicable: results.filter((item) => item.status === 'not_applicable').length,
    total_results: results.length,
    diagnostic_errors: diagnostics.filter((item) => item.severity === 'error').length,
    diagnostic_warnings: diagnostics.filter((item) => item.severity === 'warning').length,
    diagnostic_info: diagnostics.filter((item) => item.severity === 'info').length,
    structural_status: errors > 0
      ? 'failed'
      : warnings > 0
        ? 'pass_with_warnings'
        : 'passed',
  };
}

function evaluateStructuralGate(repository, gate, record, primitiveResults) {
  const applicablePrimitiveGates = repository.catalogue.gates.filter((candidate) => (
    candidate.gate_id !== gate.gate_id
    && Object.hasOwn(EVALUATORS, candidate.gate_id)
    && appliesTo(candidate, record)
  ));
  const recordResults = primitiveResults.filter((result) => (
    result.artifact_path === record.artifact_path
    && result.record_id === record.record_id
  ));
  const evaluatedGateIds = new Set(recordResults.map((result) => result.gate_id));
  const missing = applicablePrimitiveGates
    .map((candidate) => candidate.gate_id)
    .filter((gateId) => !evaluatedGateIds.has(gateId));
  if (applicablePrimitiveGates.length === 0 || missing.length > 0) {
    return {
      issue: {
        code: 'structural_evaluation_incomplete',
        message: 'Structural completeness requires every applicable primitive gate to execute.',
        actual: missing.length > 0 ? missing.sort(compareBytewise) : ['empty_primitive_scope'],
      },
      status: 'error',
    };
  }
  const blockers = recordResults.filter((result) => result.status === 'error');
  return blockers.length
    ? {
      issue: {
        code: 'structural_completeness_blocked',
        message: 'Structural completeness is blocked by one or more failed quality gates.',
        actual: blockers.map((result) => result.gate_id).sort(compareBytewise),
      },
      status: 'error',
    }
    : { issue: null, status: 'passed' };
}

const DERIVED_EVALUATORS = {
  'structural-completeness': evaluateStructuralGate,
};

function evaluatePrimitiveRecordGate(repository, gate, record) {
  const evaluator = EVALUATORS[gate.gate_id];
  const issue = evaluator(record);
  if (issue?.notApplicable) return { issue: null, status: 'not_applicable' };
  if (!issue) return { issue: null, status: 'passed' };
  const exception = findException(repository, gate, record);
  if (exception && gate.exception_policy === 'exact_record_only') {
    return {
      issue: {
        code: 'gate_exception_applied',
        message: `Active exact-record exception ${exception.exception_id} was applied.`,
        severity: 'info',
        exceptionId: exception.exception_id,
      },
      status: 'excepted',
    };
  }
  return { issue, status: issue.severity ?? gate.severity };
}

function recordMatchesRequestedPath(record, requestedPath) {
  return (record.checked_artifacts ?? []).some(
    (repositoryPath) => (
      repositoryPath === requestedPath
      || repositoryPath.startsWith(`${requestedPath}/`)
    ),
  );
}

export function evaluatePedagogyQuality(repository, {
  requestedPath = null,
  primitiveExecutionOrder = 'catalogue',
} = {}) {
  const configurationErrors = validatePedagogyQualityConfiguration(repository);
  if (configurationErrors.length > 0) {
    const error = new Error(
      `invalid pedagogical quality configuration:\n${configurationErrors.join('\n')}`,
    );
    error.code = 'invalid_quality_configuration';
    error.details = configurationErrors;
    throw error;
  }
  const normalizedRequestedPath = requestedPath === null
    ? null
    : normalizePedagogyQualityPath(requestedPath);
  const directRecords = normalizedRequestedPath
    ? repository.records.filter((record) => (
      record.artifact_path === normalizedRequestedPath
      || record.artifact_path.startsWith(`${normalizedRequestedPath}/`)
    ))
    : repository.records;
  const selectedRecords = normalizedRequestedPath && directRecords.length === 0
    ? repository.records.filter(
      (record) => recordMatchesRequestedPath(record, normalizedRequestedPath),
    )
    : directRecords;
  const records = [...selectedRecords]
    .sort((left, right) => (
      compareBytewise(left.artifact_path, right.artifact_path)
      || compareBytewise(left.record_id, right.record_id)
    ));
  if (records.length === 0) {
    const error = new Error(
      normalizedRequestedPath
        ? `no pedagogical quality records matched ${normalizedRequestedPath}`
        : 'the pedagogical quality evaluation scope is empty',
    );
    error.code = normalizedRequestedPath
      ? 'no_quality_records_matched'
      : 'empty_quality_scope';
    error.requested_path = normalizedRequestedPath;
    throw error;
  }
  const diagnostics = [];
  const results = [];
  const primitiveGates = repository.catalogue.gates.filter(
    (gate) => Object.hasOwn(EVALUATORS, gate.gate_id),
  );
  if (primitiveExecutionOrder === 'reverse') primitiveGates.reverse();
  else if (primitiveExecutionOrder !== 'catalogue') {
    throw new Error(`unknown primitive execution order ${primitiveExecutionOrder}`);
  }
  for (const gate of primitiveGates) {
    for (const record of records) {
      if (!appliesTo(gate, record)) continue;
      const outcome = evaluatePrimitiveRecordGate(repository, gate, record);
      results.push(gateResult(gate, record, outcome.status));
      if (outcome.issue) {
        diagnostics.push(createDiagnostic(gate, {
          severity: outcome.issue.severity ?? outcome.status,
          code: outcome.issue.code,
          message: outcome.issue.message,
          artifactPath: record.artifact_path,
          recordId: record.record_id,
          relatedPaths: outcome.issue.relatedPaths,
          expected: outcome.issue.expected,
          actual: outcome.issue.actual,
          exceptionId: outcome.issue.exceptionId,
        }));
      }
    }
  }
  for (const gate of repository.catalogue.gates.filter(
    (candidate) => Object.hasOwn(DERIVED_EVALUATORS, candidate.gate_id),
  )) {
    for (const record of records) {
      if (!appliesTo(gate, record)) continue;
      const outcome = DERIVED_EVALUATORS[gate.gate_id](
        repository,
        gate,
        record,
        results,
      );
      results.push(gateResult(gate, record, outcome.status));
      if (outcome.issue) {
        diagnostics.push(createDiagnostic(gate, {
          severity: outcome.issue.severity ?? outcome.status,
          code: outcome.issue.code,
          message: outcome.issue.message,
          artifactPath: record.artifact_path,
          recordId: record.record_id,
          relatedPaths: outcome.issue.relatedPaths,
          expected: outcome.issue.expected,
          actual: outcome.issue.actual,
          exceptionId: outcome.issue.exceptionId,
        }));
      }
    }
  }
  const sortedResults = sortResults(results);
  const sortedDiagnostics = sortPedagogyQualityDiagnostics(diagnostics);
  const aggregate = aggregateStatus(sortedResults, sortedDiagnostics);
  const structuralResults = sortedResults.filter(
    (result) => result.gate_id === 'structural-completeness',
  );
  const schemaResults = sortedResults.filter((result) => result.gate_id === 'schema-valid');
  const checkedArtifacts = uniqueSorted([
    repository.cataloguePath,
    repository.exceptionsPath,
    ...records.flatMap(
      (record) => [record.artifact_path, ...(record.checked_artifacts ?? [])],
    ),
  ]);
  return {
    records,
    requestedPath: normalizedRequestedPath,
    checkedArtifacts,
    results: sortedResults,
    diagnostics: sortedDiagnostics,
    counts: {
      errors: aggregate.errors,
      warnings: aggregate.warnings,
      info: aggregate.info,
      passed: aggregate.passed,
      excepted: aggregate.excepted,
      not_applicable: aggregate.not_applicable,
      total_results: aggregate.total_results,
    },
    diagnosticCounts: {
      errors: aggregate.diagnostic_errors,
      warnings: aggregate.diagnostic_warnings,
      info: aggregate.diagnostic_info,
    },
    structuralStatus: aggregate.structural_status,
    claims: {
      pedagogy_schema_valid:
        schemaResults.length > 0
        && schemaResults.every((result) => result.status === 'passed'),
      structurally_complete:
        structuralResults.length > 0
        && structuralResults.every((result) => (
          result.status === 'passed' || result.status === 'excepted'
        )),
    },
  };
}

function aggregateGateResults(catalogue, evaluation) {
  return catalogue.gates.map((gate) => {
    const matching = evaluation.results.filter((result) => result.gate_id === gate.gate_id);
    let status = 'not_applicable';
    if (matching.some((result) => result.status === 'error')) status = 'error';
    else if (matching.some((result) => result.status === 'warning')) status = 'warning';
    else if (matching.some((result) => result.status === 'excepted')) status = 'excepted';
    else if (matching.some((result) => result.status === 'passed')) status = 'passed';
    else if (matching.some((result) => result.status === 'info')) status = 'info';
    return {
      gate_id: gate.gate_id,
      gate_version: gate.gate_version,
      status,
      result_count: matching.length,
    };
  });
}

function mixedOrSingle(values) {
  const unique = [...new Set(values)];
  if (unique.length === 0) return 'unknown';
  return unique.length === 1 ? unique[0] : 'mixed';
}

function aggregateReadiness(records) {
  const sources = records
    .filter((record) => record.readiness)
    .map((record) => ({
      artifact_path: record.artifact_path,
      record_id: record.record_id,
      teacher_review: record.readiness.teacher_review,
      classroom_review: record.readiness.classroom_review,
      homeschool_review: record.readiness.homeschool_review,
      classroom_trial: record.readiness.classroom_trial,
      home_trial: record.readiness.home_trial,
      classroom_ready: record.readiness.classroom_ready,
      homeschool_ready: record.readiness.homeschool_ready,
      effectiveness_claimed: record.readiness.effectiveness_claimed,
    }))
    .sort((left, right) => (
      compareBytewise(left.artifact_path, right.artifact_path)
      || compareBytewise(left.record_id, right.record_id)
    ));
  if (sources.length === 0) {
    throw new Error('quality report readiness snapshot has no production sources');
  }
  const field = (name) => mixedOrSingle(sources.map((source) => source[name]));
  const evidence = records
    .map((record) => record.readiness?.evidence)
    .filter(Boolean);
  return {
    consistency: sources.every((source) => (
      source.teacher_review === sources[0].teacher_review
      && source.classroom_review === sources[0].classroom_review
      && source.homeschool_review === sources[0].homeschool_review
      && source.classroom_trial === sources[0].classroom_trial
      && source.home_trial === sources[0].home_trial
      && source.classroom_ready === sources[0].classroom_ready
      && source.homeschool_ready === sources[0].homeschool_ready
      && source.effectiveness_claimed === sources[0].effectiveness_claimed
    )) ? 'consistent' : 'mixed',
    teacher_review: field('teacher_review'),
    classroom_review: field('classroom_review'),
    homeschool_review: field('homeschool_review'),
    classroom_trial: field('classroom_trial'),
    home_trial: field('home_trial'),
    classroom_ready: field('classroom_ready'),
    homeschool_ready: field('homeschool_ready'),
    effectiveness_claimed: field('effectiveness_claimed'),
    evidence: {
      effective_teacher_review: evidence.some(
        (state) => state.effective_teacher_review === true,
      ),
      effective_classroom_review: evidence.some(
        (state) => state.effective_classroom_review === true,
      ),
      effective_homeschool_review: evidence.some(
        (state) => state.effective_homeschool_review === true,
      ),
      effective_classroom_trial: evidence.some(
        (state) => state.effective_classroom_trial === true,
      ),
      effective_home_trial: evidence.some(
        (state) => state.effective_home_trial === true,
      ),
      negative_classroom_review: evidence.some(
        (state) => state.negative_classroom_review === true,
      ),
      negative_homeschool_review: evidence.some(
        (state) => state.negative_homeschool_review === true,
      ),
      negative_classroom_trial: evidence.some(
        (state) => state.negative_classroom_trial === true,
      ),
      negative_home_trial: evidence.some(
        (state) => state.negative_home_trial === true,
      ),
      stale_teacher_review: evidence.some(
        (state) => state.stale_teacher_review === true,
      ),
      stale_classroom_trial: evidence.some(
        (state) => state.stale_classroom_trial === true,
      ),
      stale_home_trial: evidence.some(
        (state) => state.stale_home_trial === true,
      ),
    },
    source_records: sources,
  };
}

export function buildPedagogyQualityReport(repository, evaluation, {
  reportId,
  reportPath,
  requestedPath = null,
} = {}) {
  if (requestedPath !== null || evaluation.requestedPath !== null) {
    throw new Error(
      'committed production reports require the complete production scope; '
      + 'use the scoped evaluation result for --path',
    );
  }
  const integrated = evaluation.records.filter((record) => record.kind === 'integrated_lesson');
  const homeschool = evaluation.records.filter(
    (record) => record.kind === 'homeschool_package',
  );
  const teacherPacks = evaluation.records.filter(
    (record) => record.kind === 'teacher_pack',
  );
  const thematicPlans = evaluation.records.filter(
    (record) => record.kind === 'thematic_plan',
  );
  const legacy = evaluation.records.filter((record) => record.kind === 'legacy_lesson');
  const report = {
    schema_version: '1.1',
    artifact_type: 'pedagogy_quality_report',
    report_id: reportId,
    quality_engine_version: PEDAGOGY_QUALITY_ENGINE_VERSION,
    gate_catalogue: {
      path: repository.cataloguePath,
      version: repository.catalogue.catalogue_version,
      digest: sha256PedagogyValue(repository.catalogue),
    },
    scope: {
      scope_id: repository.reportMetadata.scopeId,
      requested_path: null,
      integrated_lesson_count: integrated.length,
      homeschool_package_count: homeschool.length,
      legacy_lesson_count: legacy.length,
      teacher_pack_count: teacherPacks.length,
      thematic_plan_count: thematicPlans.length,
    },
    content_identities: repository.reportMetadata.contentIdentities
      .map((identity) => structuredClone(identity))
      .sort((left, right) => compareBytewise(left.record_id, right.record_id)),
    teacher_pack_fingerprint: {
      scope: 'pack_wide_reviewable_content',
      ...structuredClone(repository.reportMetadata.teacherPackFingerprint),
    },
    checked_artifacts: evaluation.checkedArtifacts,
    gate_results: evaluation.results,
    gate_summary: aggregateGateResults(repository.catalogue, evaluation),
    diagnostics: evaluation.diagnostics,
    counts: evaluation.counts,
    diagnostic_counts: evaluation.diagnosticCounts,
    structural_status: evaluation.structuralStatus,
    claims: {
      applies_to: 'integrated_production_records',
      pedagogy_schema_valid: evaluation.claims.pedagogy_schema_valid,
      structurally_complete: evaluation.claims.structurally_complete,
    },
    legacy_scope: {
      integration_quality_status: 'not_evaluated',
      record_count: legacy.length,
    },
    non_guarantees: NON_GUARANTEES,
    readiness: aggregateReadiness(evaluation.records),
    determinism: {
      no_ai: true,
      no_network: true,
      no_randomness: true,
      no_current_timestamps: true,
      ordering: 'bytewise',
    },
  };
  const resultCount = report.counts.errors
    + report.counts.warnings
    + report.counts.info
    + report.counts.passed
    + report.counts.excepted
    + report.counts.not_applicable;
  if (
    resultCount !== report.gate_results.length
    || resultCount !== report.counts.total_results
  ) {
    throw new Error(
      'quality report result counts do not reconcile with per-record gate results',
    );
  }
  const diagnosticCount = report.diagnostic_counts.errors
    + report.diagnostic_counts.warnings
    + report.diagnostic_counts.info;
  if (diagnosticCount !== report.diagnostics.length) {
    throw new Error(
      'quality report diagnostic counts do not reconcile with diagnostics',
    );
  }
  if (
    report.gate_summary.reduce((sum, item) => sum + item.result_count, 0)
      !== report.gate_results.length
  ) {
    throw new Error(
      'quality report gate summary does not reconcile with per-record results',
    );
  }
  if (!repository.validators.report(report)) {
    throw new Error(
      `quality report schema invalid:\n${schemaDiagnostics(
        repository.validators.report,
        report,
        reportPath,
      ).join('\n')}`,
    );
  }
  return report;
}

export function buildPedagogyQualityEvaluationResult(repository, evaluation) {
  if (!evaluation.requestedPath) {
    throw new Error('scoped quality evaluation output requires an explicit path');
  }
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogy_quality_evaluation',
    quality_engine_version: PEDAGOGY_QUALITY_ENGINE_VERSION,
    gate_catalogue: {
      path: repository.cataloguePath,
      version: repository.catalogue.catalogue_version,
      digest: sha256PedagogyValue(repository.catalogue),
    },
    scope: {
      requested_path: evaluation.requestedPath,
      record_count: evaluation.records.length,
      record_kinds: uniqueSorted(evaluation.records.map((record) => record.kind)),
    },
    records: evaluation.records.map((record) => ({
      artifact_path: record.artifact_path,
      record_id: record.record_id,
      kind: record.kind,
    })),
    checked_artifacts: evaluation.checkedArtifacts,
    gate_results: evaluation.results,
    diagnostics: evaluation.diagnostics,
    counts: evaluation.counts,
    diagnostic_counts: evaluation.diagnosticCounts,
    structural_status: evaluation.structuralStatus,
    claims: {
      applies_to: 'evaluated_records_only',
      ...evaluation.claims,
    },
    determinism: {
      no_ai: true,
      no_network: true,
      no_randomness: true,
      no_current_timestamps: true,
      ordering: 'bytewise',
    },
  };
}

export function serializePedagogyQualityReport(report) {
  return `${stablePedagogyJson(report).trimEnd()}\n`;
}

export function clonePedagogyQualityRepository(repository) {
  return {
    ...repository,
    catalogue: structuredClone(repository.catalogue),
    exceptions: structuredClone(repository.exceptions),
    records: structuredClone(repository.records),
    reportMetadata: structuredClone(repository.reportMetadata),
  };
}
