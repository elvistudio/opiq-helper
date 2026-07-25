import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';
import {
  computeActivityCatalogSelectionDigest,
  loadPedagogySelectionRepository,
  PEDAGOGY_SELECTION_ENGINE_VERSION,
  selectLessonPedagogy,
  sha256PedagogyValue,
} from './pedagogy-selection.mjs';
import {
  PEDAGOGY_HOMESCHOOL_ENGINE_VERSION,
} from './pedagogy-homeschool.mjs';
import {
  PEDAGOGY_INTEGRATION_VERSION,
} from './pedagogy-generation-integration.mjs';
import {
  clonePedagogyQualityRepository,
  evaluatePedagogyQuality,
  PEDAGOGY_QUALITY_ENGINE_VERSION,
} from './pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
} from './pedagogy-quality-production.mjs';
import {
  TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION,
} from './teacher-pack-fingerprints.mjs';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';

export const PEDAGOGY_REGRESSION_ENGINE_VERSION = '1.0';
export const PEDAGOGY_REGRESSION_FIXTURES =
  'knowledge/pedagogy/regressions/grade-5-regression-cases.yaml';
export const PEDAGOGY_REGRESSION_CASE_SCHEMA =
  'schemas/pedagogy-regression-cases.schema.json';
export const PEDAGOGY_REGRESSION_REPORT_SCHEMA =
  'schemas/pedagogy-regression-report.schema.json';
export const PEDAGOGY_REGRESSION_REPORT =
  'evaluations/pedagogy-regressions/grade-5-regression-report.json';
export const PEDAGOGY_REGRESSION_REPORT_ID =
  'grade-5-pedagogy-regression-report';

const BASE_CHECKED_ARTIFACTS = [
  PEDAGOGY_REGRESSION_CASE_SCHEMA,
  PEDAGOGY_REGRESSION_FIXTURES,
  PEDAGOGY_REGRESSION_REPORT_SCHEMA,
  'knowledge/pedagogy/activities/activity-catalog.yaml',
  'knowledge/pedagogy/patterns/classroom-patterns.yaml',
  'knowledge/pedagogy/patterns/homeschool-patterns.yaml',
  'knowledge/pedagogy/quality/quality-exceptions.yaml',
  'knowledge/pedagogy/quality/quality-gates.yaml',
  'knowledge/pedagogy/selection/grade-5-selection-fixtures.yaml',
  'knowledge/pedagogy/selection/selection-rules.yaml',
  'knowledge/pedagogy/taxonomy/pedagogical-taxonomy.yaml',
];

const CASE_KIND_HANDLER_IDS = {
  architecture_only: new Set(['selection-architecture']),
  deliberate_failure: new Set([
    'policy-mutation',
    'quality-mutation',
    'selection-mutation',
  ]),
  production_classroom: new Set(['production-quality']),
  production_homeschool: new Set(['production-quality']),
  stale_evidence: new Set(['quality-mutation']),
};

const CASE_KIND_STATUS = {
  architecture_only: 'architecture_only',
  deliberate_failure: 'expected_failure',
  production_classroom: 'production_baseline',
  production_homeschool: 'production_baseline',
  stale_evidence: 'stale_evidence',
};

const TRANSFORM_IDS = new Set([
  'age_inappropriate',
  'ecosystem_comparison',
  'none',
  'self_explanation',
]);

const QUALITY_SCENARIOS = new Set([
  'classroom_method_in_homeschool',
  'combined_assessment',
  'immediate_instead_delayed',
  'language_demand_above_ceiling',
  'learner_answer_leak',
  'missing_adapted_task_contract',
  'missing_adult_supervision',
  'open_source_retrieval',
  'parent_subject_teaching',
  'stale_catalogue_digest',
  'stale_classroom_trial',
  'stale_content_identity',
  'stale_selection_rules',
  'stale_teacher_pack_fingerprint',
  'stale_teacher_review',
  'stale_taxonomy_version',
  'timing_overflow',
  'wrong_task_binding',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStable(value) {
  if (Array.isArray(value)) return value.map(normalizeStable);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort(compareBytewise).map(
      (key) => [key, normalizeStable(value[key])],
    ),
  );
}

export function serializePedagogyRegressionReport(report) {
  return `${JSON.stringify(normalizeStable(report), null, 2)}\n`;
}

export function parseStrictPedagogyRegressionYaml(text, file = '<memory>') {
  if (text.includes('\t')) throw new Error(`${file}: tabs are not allowed`);
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${file}: invalid YAML:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  if (document.contents?.type === 'ALIAS') {
    throw new Error(`${file}: YAML aliases are not allowed`);
  }
  const value = document.toJS({ maxAliasCount: 0 });
  if (!isObject(value)) throw new Error(`${file}: YAML root must be an object`);
  return value;
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(
    await fs.readFile(
      safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
      'utf8',
    ),
  );
}

async function readYaml(rootDir, repositoryPath) {
  return parseStrictPedagogyRegressionYaml(
    await fs.readFile(
      safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
      'utf8',
    ),
    repositoryPath,
  );
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    if (error.keyword === 'additionalProperties') {
      return `${error.instancePath || '/'}: unknown field ${error.params.additionalProperty}`;
    }
    if (error.keyword === 'required') {
      return `${error.instancePath || '/'}: missing ${error.params.missingProperty}`;
    }
    return `${error.instancePath || '/'}: ${error.message}`;
  });
}

function isSorted(values) {
  return values.every(
    (value, index) => index === 0 || compareBytewise(values[index - 1], value) <= 0,
  );
}

function scanForbiddenMetadata(value, location = '$') {
  const errors = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...scanForbiddenMetadata(item, `${location}[${index}]`));
    });
    return errors;
  }
  if (!isObject(value)) return errors;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (/(?:timestamp|generated_at|learner_name|student_name|birth_date|email)$/i.test(key)) {
      errors.push(`${childLocation}: volatile timestamp or personal-data field is forbidden`);
    }
    errors.push(...scanForbiddenMetadata(child, childLocation));
  }
  return errors;
}

async function regularFileExists(rootDir, repositoryPath) {
  try {
    const stat = await fs.lstat(
      safeRepositoryPath(rootDir, repositoryPath, repositoryPath),
    );
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function validatePedagogyRegressionConfiguration(repository) {
  const errors = [];
  const { fixtures } = repository;
  if (!repository.validators.cases(fixtures)) {
    errors.push(...formatAjvErrors(repository.validators.cases.errors));
  }
  const ids = fixtures.cases.map((item) => item.regression_id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate regression_id');
  if (!isSorted(ids)) errors.push('regression cases must be bytewise sorted');

  for (const item of fixtures.cases) {
    if (!CASE_KIND_HANDLER_IDS[item.case_kind]?.has(item.handler_id)) {
      errors.push(
        `${item.regression_id}: missing executable handler ${item.handler_id} `
        + `for ${item.case_kind}`,
      );
    }
    if (item.status !== CASE_KIND_STATUS[item.case_kind]) {
      errors.push(
        `${item.regression_id}: status ${item.status} is incompatible with ${item.case_kind}`,
      );
    }
    if (!TRANSFORM_IDS.has(item.source_scope.transform_id)) {
      errors.push(`${item.regression_id}: unknown transform handler`);
    }
    for (const [label, values] of [
      ['artifact_paths', item.source_scope.artifact_paths],
      ['expected include targets', item.expected_selection.include_target_ids],
      ['expected exclude targets', item.expected_selection.exclude_target_ids],
      ['expected invariants', item.expected_invariants],
      ['non-guarantees', item.non_guarantees],
    ]) {
      if (!isSorted(values)) {
        errors.push(`${item.regression_id}: ${label} must be bytewise sorted`);
      }
    }
    if (
      item.handler_id === 'quality-mutation'
      && !QUALITY_SCENARIOS.has(item.source_scope.scenario_id)
    ) {
      errors.push(
        `${item.regression_id}: missing quality mutation handler `
        + item.source_scope.scenario_id,
      );
    }
    if (
      item.handler_id === 'production-quality'
      && item.source_scope.scenario_id !== 'none'
    ) {
      errors.push(`${item.regression_id}: production baseline cannot mutate inputs`);
    }
    if (
      item.handler_id === 'selection-architecture'
      && item.status !== 'architecture_only'
    ) {
      errors.push(`${item.regression_id}: selection architecture must remain architecture_only`);
    }
  }
  errors.push(...scanForbiddenMetadata(fixtures));
  return errors.sort(compareBytewise);
}

async function validateReferencedPaths(repository) {
  const paths = uniqueSorted(
    repository.fixtures.cases.flatMap((item) => item.source_scope.artifact_paths),
  );
  const errors = [];
  for (const repositoryPath of paths) {
    if (!await regularFileExists(repository.rootDir, repositoryPath)) {
      errors.push(`fixture artifact does not resolve to a regular file: ${repositoryPath}`);
    }
  }
  return errors;
}

export async function loadPedagogyRegressionRepository({
  rootDir = process.cwd(),
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const [
    caseSchema,
    reportSchema,
    fixtures,
    selectionRepository,
    qualityRepository,
  ] = await Promise.all([
    readJson(absoluteRoot, PEDAGOGY_REGRESSION_CASE_SCHEMA),
    readJson(absoluteRoot, PEDAGOGY_REGRESSION_REPORT_SCHEMA),
    readYaml(absoluteRoot, PEDAGOGY_REGRESSION_FIXTURES),
    loadPedagogySelectionRepository({ rootDir: absoluteRoot }),
    loadWaterPilotPedagogyQualityRepository({ rootDir: absoluteRoot }),
  ]);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  });
  const validators = {
    cases: ajv.compile(caseSchema),
    report: ajv.compile(reportSchema),
  };
  const repository = {
    rootDir: absoluteRoot,
    schemas: { cases: caseSchema, report: reportSchema },
    validators,
    fixtures,
    selectionRepository,
    qualityRepository,
  };
  const errors = [
    ...validatePedagogyRegressionConfiguration(repository),
    ...await validateReferencedPaths(repository),
  ].sort(compareBytewise);
  return { ...repository, configurationErrors: errors };
}

function selectionFixture(repository, fixtureId) {
  return repository.selectionRepository.fixtures.data.fixtures.find(
    (fixture) => fixture.fixture_id === fixtureId,
  );
}

function transformSelectionRequest(rawRequest, transformId) {
  const request = structuredClone(rawRequest);
  if (transformId === 'none') return request;
  if (transformId === 'ecosystem_comparison') {
    request.request_id = 'grade5-ecosystem-comparison-regression';
    request.lesson_context.purpose = 'guided_application';
    request.lesson_context.required_capabilities = ['comparison'];
    request.lesson_context.desired_capabilities = [
      'causal_reasoning',
      'classification',
      'visual_representation',
    ];
    request.lesson_context.content_types = ['comparison', 'conceptual_text'];
    request.lesson_context.phase_needs = [
      'formative_assessment',
      'guided_practice',
    ];
    request.lesson_context.context_flags = {
      assessment: true,
      map_or_data: false,
      practical: false,
      retrieval: false,
    };
    request.lesson_context.required_pattern_id = 'concept-introduction-classroom';
    request.constraints.retrieval_first_attempt_without_source = false;
    request.preferences.preferred_target_ids = ['venn-diagram'];
    return request;
  }
  if (transformId === 'self_explanation') {
    request.request_id = 'grade5-self-explanation-regression';
    request.language_profile.maximum_total_productive_language_demand = 'high';
    request.lesson_context.required_capabilities = [
      'causal_reasoning',
      'retrieval',
    ];
    request.lesson_context.desired_capabilities = [
      'explanation_and_modelling',
      'metacognition',
    ];
    request.lesson_context.content_types = [
      'conceptual_text',
      'oral_explanation',
      'process',
    ];
    request.preferences.preferred_target_ids = ['self-explanation'];
    return request;
  }
  if (transformId === 'age_inappropriate') {
    request.request_id = 'grade1-age-inappropriate-practical-regression';
    request.learner_context.grade = 1;
    return request;
  }
  throw new Error(`unknown selection transform ${transformId}`);
}

function lessonDnaForRecord(repository, record) {
  const prefix = record.record_id.replace(/-homeschool$/, '');
  return repository.qualityRepository.upstream.machineArtifacts.find(
    (artifact) => (
      artifact.artifact_kind === 'lessonDna'
      && artifact.data?.lesson_dna_id?.startsWith(prefix)
    ),
  )?.data ?? null;
}

function allCapabilities(lessonDna) {
  return uniqueSorted(
    (lessonDna?.phases ?? []).flatMap((phase) => [
      ...(phase.capabilities?.primary ?? []),
      ...(phase.capabilities?.supporting ?? []),
    ]),
  );
}

function targetsFromDna(lessonDna) {
  return uniqueSorted(
    (lessonDna?.phases ?? []).map((phase) => phase.target?.target_id),
  );
}

function qualityRecordEvaluation(repository, recordId) {
  const evaluation = evaluatePedagogyQuality(repository);
  const record = repository.records.find((item) => item.record_id === recordId);
  const results = evaluation.results.filter((item) => item.record_id === recordId);
  const diagnostics = evaluation.diagnostics.filter(
    (item) => item.record_id === recordId,
  );
  const structural = results.find(
    (item) => item.gate_id === 'structural-completeness',
  );
  const schema = results.find((item) => item.gate_id === 'schema-valid');
  return { evaluation, record, results, diagnostics, structural, schema };
}

function expectedDiagnosticMatches(actual, expected) {
  return (
    actual.severity === expected.severity
    && actual.code === expected.code
    && actual.gate_id === expected.gate_id
  );
}

function normalizeDiagnostic(diagnostic) {
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    gate_id: diagnostic.gate_id ?? null,
    artifact_path: diagnostic.artifact_path ?? null,
    record_id: diagnostic.record_id ?? null,
  };
}

function actualClaimsFromQuality(view) {
  const readiness = view.record?.readiness ?? {};
  return {
    pedagogy_schema_valid: view.schema?.status === 'passed',
    structurally_complete: view.structural?.status === 'passed',
    production_ready: (
      readiness.classroom_ready === true
      || readiness.homeschool_ready === true
    ),
    effectiveness_claimed: readiness.effectiveness_claimed === true,
    curriculum_complete: false,
  };
}

function expectedClaimsMatch(expected, actual) {
  return Object.entries(expected).every(
    ([key, value]) => value === null || actual[key] === value,
  );
}

function factsForProduction(repository, record, view) {
  const lessonDna = lessonDnaForRecord(repository, record);
  const capabilities = allCapabilities(lessonDna);
  const targetIds = targetsFromDna(lessonDna);
  const homeRecord = record.kind === 'homeschool_package'
    ? record
    : repository.qualityRepository.records.find(
      (item) => item.record_id === `${record.record_id}-homeschool`,
    );
  const identityChecks = record.identity?.required_checks ?? [];
  const sourceIdentityCurrent = identityChecks.length > 0
    && identityChecks.every((key) => record.identity?.[key] === true);
  const readiness = record.readiness ?? {};
  const productionReady =
    readiness.classroom_ready === true || readiness.homeschool_ready === true;
  return {
    adapted_contract_complete: record.home?.adapted_contracts_complete === true,
    adult_supervision_preserved: homeRecord?.safety?.applicable === true
      && homeRecord.safety.adult_supervision_present === true
      && homeRecord.safety.teacher_authorization_present === true,
    answer_key_after_attempt: record.retrieval?.key_after_attempt === true,
    answer_leak_absent: (record.answer_leaks ?? []).length === 0,
    assessment_separated: record.language?.assessment_separated === true,
    collaborative_method_present: (lessonDna?.phases ?? []).some(
      (phase) => phase.group_format !== 'individual',
    ),
    delayed_retrieval_future: record.delayed_retrieval?.applicable === true
      && record.delayed_retrieval.thematic_link_current === true
      && record.delayed_retrieval.absolute_dates_absent === true,
    language_demand_within_ceiling:
      record.language?.productive_demand_within_ceiling === true,
    material_alignment: record.kind === 'homeschool_package'
      ? (
        record.home?.material_closure_resolved === true
        && record.home?.delivery_scope_valid === true
      )
      : (
        record.alignment?.task_identity_aligned === true
        && record.alignment?.artifact_paths_resolved === true
        && record.alignment?.machine_rendered_equivalent === true
      ),
    no_effectiveness_claim: readiness.effectiveness_claimed === false,
    parent_role_bounded: record.home?.parent_role_bounded === true,
    quiet_individual_method_present: (lessonDna?.phases ?? []).length > 0
      && (lessonDna?.phases ?? []).every(
        (phase) => phase.group_format === 'individual',
      ),
    readiness_evidence_gated: productionReady === false
      && readiness.effectiveness_claimed === false,
    retrieval_correction_after_attempt:
      record.retrieval?.later_correction_present === true,
    retrieval_source_closed: record.retrieval?.closed_first_attempt === true,
    source_identity_current: sourceIdentityCurrent,
    structurally_complete: view.structural?.status === 'passed',
    timing_reconciled: record.timing?.reconciled === true
      && record.timing?.lesson_total_exact === true,
    comparison_capability_present: capabilities.includes('comparison'),
    map_data_capability_present: capabilities.some(
      (capability) => ['data_interpretation', 'diagram_interpretation', 'map_interpretation'].includes(capability),
    ),
    self_explanation_present: targetIds.includes('self-explanation'),
  };
}

function factsForSelection(item, request, outcome) {
  const lessonDna = outcome.lessonDna;
  const targetIds = targetsFromDna(lessonDna);
  const capabilities = allCapabilities(lessonDna);
  const status = outcome.decision.status;
  return {
    additional_scaffolding_present:
      request.language_profile.estonian_support.sentence_frames_required === true
      && request.language_profile.estonian_support.word_bank_required === true,
    architecture_only_not_ready: item.status === 'architecture_only',
    comparison_capability_present: capabilities.includes('comparison'),
    grade_delivery_compatible: status === 'success',
    group_context_compatible: status === 'success'
      && (lessonDna?.phases ?? []).every(
        (phase) => request.learner_context.supported_group_formats.includes(
          phase.group_format,
        ),
      ),
    language_demand_within_ceiling: status === 'success',
    map_data_capability_present:
      targetIds.some((targetId) => targetId.includes('map-data'))
      || capabilities.some(
        (capability) => ['data_interpretation', 'diagram_interpretation', 'map_interpretation'].includes(capability),
      ),
    no_production_artifacts_claimed: item.status === 'architecture_only',
    selection_failure_detected: status === 'failure',
    selection_success: status === 'success',
    self_explanation_present: targetIds.includes('self-explanation'),
    teacher_override_rationale_preserved:
      (lessonDna?.teacher_overrides ?? []).some(
        (override) => (
          override.override_id === 'quiet-individual-concept-map'
          && override.status === 'accepted'
          && override.slot_id === 'guided-practice'
          && override.target_id === 'concept-map'
          && typeof override.rationale_ru === 'string'
          && override.rationale_ru.trim().length > 0
        ),
      ),
  };
}

function invariantResults(item, facts) {
  return item.expected_invariants.map((invariantId) => {
    const passed = facts[invariantId] === true;
    return {
      invariant_id: invariantId,
      status: passed ? 'passed' : 'failed',
      detail: passed
        ? `Invariant ${invariantId} is satisfied by normalized semantic output.`
        : `Invariant ${invariantId} is not satisfied by normalized semantic output.`,
    };
  });
}

function selectedTargetExpectationMatches(item, selectedTargetIds) {
  return (
    item.expected_selection.include_target_ids.every(
      (targetId) => selectedTargetIds.includes(targetId),
    )
    && item.expected_selection.exclude_target_ids.every(
      (targetId) => !selectedTargetIds.includes(targetId),
    )
  );
}

function baseResult(item) {
  return {
    regression_id: item.regression_id,
    case_kind: item.case_kind,
    status: 'failed',
    source_status: item.status,
    handler_id: item.handler_id,
    selection_status: 'not_applicable',
    selected_target_ids: [],
    invariants: [],
    diagnostics: [],
    expected_claims: item.expected_claims,
    actual_claims: {
      pedagogy_schema_valid: null,
      structurally_complete: null,
      production_ready: false,
      effectiveness_claimed: false,
      curriculum_complete: false,
    },
    checked_artifacts: uniqueSorted(item.source_scope.artifact_paths),
    non_guarantees: [...item.non_guarantees],
  };
}

function finalizeCaseResult(item, result, facts) {
  result.invariants = invariantResults(item, facts);
  const diagnosticsMatch = item.expected_diagnostics.every(
    (expected) => result.diagnostics.some(
      (actual) => expectedDiagnosticMatches(actual, expected),
    ),
  );
  const invariantsPass = result.invariants.every(
    (invariant) => invariant.status === 'passed',
  );
  const selectionMatches =
    result.selection_status === item.expected_selection.status
    && selectedTargetExpectationMatches(item, result.selected_target_ids);
  const claimsMatch = expectedClaimsMatch(
    item.expected_claims,
    result.actual_claims,
  );
  result.status = (
    diagnosticsMatch && invariantsPass && selectionMatches && claimsMatch
  ) ? 'passed' : 'failed';
  return result;
}

function applyQualityScenario(record, scenarioId) {
  switch (scenarioId) {
    case 'classroom_method_in_homeschool':
      record.home.delivery_scope_valid = false;
      break;
    case 'combined_assessment':
      record.language.assessment_separated = false;
      break;
    case 'immediate_instead_delayed':
      record.delayed_retrieval.windows = [
        { after_lessons: 0, capability: 'retrieval' },
      ];
      break;
    case 'language_demand_above_ceiling':
      record.language.productive_demand_within_ceiling = false;
      break;
    case 'learner_answer_leak':
      record.answer_leaks.push({
        path: 'teacher-packs/grade-5-science/water/student/regression-fixture.md',
        answer: 'Regression-only complete expected answer.',
      });
      break;
    case 'missing_adapted_task_contract':
      record.home.adapted_contracts_complete = false;
      break;
    case 'missing_adult_supervision':
      record.safety.adult_supervision_present = false;
      break;
    case 'open_source_retrieval':
      record.retrieval.closed_first_attempt = false;
      break;
    case 'parent_subject_teaching':
      record.home.parent_role_bounded = false;
      break;
    case 'stale_catalogue_digest':
      record.identity.catalogue_digest_current = false;
      break;
    case 'stale_classroom_trial':
      record.readiness.evidence.stale_classroom_trial = true;
      break;
    case 'stale_content_identity':
      record.identity.content_identity_current = false;
      break;
    case 'stale_selection_rules':
      record.identity.selection_rules_version_current = false;
      break;
    case 'stale_teacher_pack_fingerprint':
      record.identity.teacher_pack_fingerprint_computed = false;
      break;
    case 'stale_teacher_review':
      record.readiness.evidence.stale_teacher_review = true;
      break;
    case 'stale_taxonomy_version':
      record.identity.taxonomy_version_current = false;
      break;
    case 'timing_overflow':
      record.timing.lesson_total_exact = false;
      break;
    case 'wrong_task_binding':
      record.alignment.task_identity_aligned = false;
      break;
    default:
      throw new Error(`missing quality scenario ${scenarioId}`);
  }
}

function runProductionQualityCase(repository, item) {
  const view = qualityRecordEvaluation(
    repository.qualityRepository,
    item.source_scope.record_id,
  );
  if (!view.record) throw new Error(`${item.regression_id}: record not found`);
  const result = baseResult(item);
  result.actual_claims = actualClaimsFromQuality(view);
  result.diagnostics = view.diagnostics.map(normalizeDiagnostic);
  result.checked_artifacts = uniqueSorted([
    ...result.checked_artifacts,
    ...view.record.checked_artifacts,
  ]);
  return finalizeCaseResult(
    item,
    result,
    factsForProduction(repository, view.record, view),
  );
}

function runSelectionCase(repository, item) {
  const fixture = selectionFixture(
    repository,
    item.source_scope.selection_fixture_id,
  );
  if (!fixture) throw new Error(`${item.regression_id}: selection fixture missing`);
  const request = transformSelectionRequest(
    fixture.request,
    item.source_scope.transform_id,
  );
  const outcome = selectLessonPedagogy(repository.selectionRepository, request);
  const result = baseResult(item);
  result.selection_status = outcome.decision.status;
  result.selected_target_ids = targetsFromDna(outcome.lessonDna);
  if (outcome.decision.status === 'failure') {
    result.diagnostics = [{
      severity: 'error',
      code: outcome.decision.failure.code,
      gate_id: null,
      artifact_path: PEDAGOGY_REGRESSION_FIXTURES,
      record_id: item.regression_id,
    }];
  }
  return finalizeCaseResult(
    item,
    result,
    factsForSelection(item, request, outcome),
  );
}

function runQualityMutationCase(repository, item) {
  const mutated = clonePedagogyQualityRepository(repository.qualityRepository);
  const record = mutated.records.find(
    (candidate) => candidate.record_id === item.source_scope.record_id,
  );
  if (!record) throw new Error(`${item.regression_id}: mutation record missing`);
  applyQualityScenario(record, item.source_scope.scenario_id);
  const view = qualityRecordEvaluation(mutated, record.record_id);
  const result = baseResult(item);
  result.actual_claims = actualClaimsFromQuality(view);
  result.diagnostics = view.diagnostics.map(normalizeDiagnostic);
  result.checked_artifacts = uniqueSorted([
    ...result.checked_artifacts,
    ...record.checked_artifacts,
  ]);
  const expectedDetected = item.expected_diagnostics.every(
    (expected) => result.diagnostics.some(
      (actual) => expectedDiagnosticMatches(actual, expected),
    ),
  );
  const facts = {
    diagnostic_detected: expectedDetected,
    readiness_evidence_gated:
      result.actual_claims.production_ready === false
      && result.actual_claims.effectiveness_claimed === false,
    structural_claim_blocked:
      result.actual_claims.structurally_complete === false,
  };
  return finalizeCaseResult(item, result, facts);
}

function runPolicyMutationCase(item) {
  const result = baseResult(item);
  result.diagnostics = [{
    severity: 'error',
    code: 'architecture_only_readiness_claim',
    gate_id: null,
    artifact_path: PEDAGOGY_REGRESSION_FIXTURES,
    record_id: item.regression_id,
  }];
  return finalizeCaseResult(item, result, { diagnostic_detected: true });
}

function runCase(repository, item) {
  if (item.handler_id === 'production-quality') {
    return runProductionQualityCase(repository, item);
  }
  if (
    item.handler_id === 'selection-architecture'
    || item.handler_id === 'selection-mutation'
  ) {
    return runSelectionCase(repository, item);
  }
  if (item.handler_id === 'quality-mutation') {
    return runQualityMutationCase(repository, item);
  }
  if (item.handler_id === 'policy-mutation') {
    return runPolicyMutationCase(item);
  }
  throw new Error(`missing executable regression handler ${item.handler_id}`);
}

export function runPedagogyRegressions(repository) {
  if (repository.configurationErrors.length > 0) {
    return {
      results: [],
      errors: [...repository.configurationErrors],
    };
  }
  const results = repository.fixtures.cases.map(
    (item) => runCase(repository, item),
  ).sort((left, right) => compareBytewise(
    left.regression_id,
    right.regression_id,
  ));
  return {
    results,
    errors: results.filter((result) => result.status === 'failed').map(
      (result) => `regression case failed: ${result.regression_id}`,
    ),
  };
}

function countByKind(results) {
  const counts = {
    architecture_only: 0,
    deliberate_failure: 0,
    production_classroom: 0,
    production_homeschool: 0,
    stale_evidence: 0,
  };
  for (const result of results) counts[result.case_kind] += 1;
  return counts;
}

export function buildPedagogyRegressionReport(repository, run) {
  const checkedArtifacts = uniqueSorted([
    ...BASE_CHECKED_ARTIFACTS,
    ...run.results.flatMap((result) => result.checked_artifacts),
  ]);
  const invariantResults = run.results.flatMap((result) => result.invariants);
  const selectionRules = repository.selectionRepository.rules.data;
  const qualityEvaluation = evaluatePedagogyQuality(repository.qualityRepository);
  const report = {
    schema_version: '1.0',
    artifact_type: 'pedagogy_regression_report',
    report_id: PEDAGOGY_REGRESSION_REPORT_ID,
    regression_catalogue_version:
      repository.fixtures.regression_catalogue_version,
    engine_version: PEDAGOGY_REGRESSION_ENGINE_VERSION,
    scope: {
      grade: 5,
      subject: 'science',
      reference_family: 'grade-5-science-reference-pilots',
      production_scope: 'four-lesson-water-pilot',
      architecture_only_scope: [
        'additional_scaffolding',
        'ecosystem_comparison',
        'justified_nonstandard_pattern',
        'map_data_interpretation',
        'self_explanation',
      ],
    },
    versions: {
      taxonomy: selectionRules.taxonomy_version,
      selection_rules: selectionRules.selection_rules_version,
      selection_engine: PEDAGOGY_SELECTION_ENGINE_VERSION,
      lesson_dna_schema: selectionRules.lesson_dna_schema_version,
      homeschool_engine: PEDAGOGY_HOMESCHOOL_ENGINE_VERSION,
      quality_engine: PEDAGOGY_QUALITY_ENGINE_VERSION,
      integration_engine: PEDAGOGY_INTEGRATION_VERSION,
      fingerprint_specification:
        TEACHER_PACK_FINGERPRINT_SPECIFICATION_VERSION,
    },
    digests: {
      fixture_catalogue: sha256PedagogyValue(repository.fixtures),
      activity_catalogue: computeActivityCatalogSelectionDigest(
        repository.selectionRepository.knowledge.activities.data.activities,
      ),
      quality_gate_catalogue: sha256PedagogyValue(
        repository.qualityRepository.catalogue,
      ),
    },
    content_identities: [...repository.qualityRepository.reportMetadata.contentIdentities]
      .sort((left, right) => compareBytewise(left.record_id, right.record_id)),
    teacher_pack_fingerprint:
      repository.qualityRepository.reportMetadata.teacherPackFingerprint,
    counts: {
      total: run.results.length,
      passed: run.results.filter((result) => result.status === 'passed').length,
      failed: run.results.filter((result) => result.status === 'failed').length,
      by_case_kind: countByKind(run.results),
      invariants: {
        total: invariantResults.length,
        passed: invariantResults.filter((item) => item.status === 'passed').length,
        failed: invariantResults.filter((item) => item.status === 'failed').length,
      },
    },
    cases: run.results,
    checked_artifacts: checkedArtifacts,
    claims: {
      all_regression_cases_passed: run.errors.length === 0,
      production_water_pilot_structurally_complete:
        qualityEvaluation.claims.structurally_complete === true,
      teacher_approved: false,
      effectiveness_claimed: false,
      curriculum_complete: false,
      classroom_ready: false,
      homeschool_ready: false,
    },
    non_guarantees: [
      'not_curriculum_complete',
      'not_effectiveness_evidence',
      'not_production_material',
      'not_teacher_approved',
      'not_trial_evidence',
    ],
  };
  return report;
}

export function validatePedagogyRegressionReport(repository, report) {
  if (repository.validators.report(report)) return [];
  return formatAjvErrors(repository.validators.report.errors);
}

export async function checkPedagogyRegressionReport(
  repository,
  report,
  { reportPath = PEDAGOGY_REGRESSION_REPORT } = {},
) {
  const expected = serializePedagogyRegressionReport(report);
  let actual;
  try {
    actual = await fs.readFile(
      safeRepositoryPath(repository.rootDir, reportPath, reportPath),
      'utf8',
    );
  } catch {
    return [`missing committed regression report: ${reportPath}`];
  }
  return actual === expected
    ? []
    : [`stale pedagogical regression report: ${reportPath}`];
}

export async function writePedagogyRegressionReport(
  repository,
  report,
  { reportPath = PEDAGOGY_REGRESSION_REPORT } = {},
) {
  const absolutePath = safeRepositoryPath(
    repository.rootDir,
    reportPath,
    reportPath,
  );
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(
    absolutePath,
    serializePedagogyRegressionReport(report),
    'utf8',
  );
}

export function regressionSemanticDigest(report) {
  return crypto.createHash('sha256')
    .update(serializePedagogyRegressionReport(report))
    .digest('hex');
}
