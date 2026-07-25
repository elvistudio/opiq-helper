import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument, stringify } from 'yaml';
import {
  computeActivityCatalogSelectionDigest,
  loadPedagogySelectionRepository,
  PEDAGOGY_SELECTION_ENGINE_VERSION,
  selectLessonPedagogy,
  sha256PedagogyValue,
} from './pedagogy-selection.mjs';
import {
  expandPedagogyActivityTargets,
  pedagogyQueryOrders,
} from './pedagogy-query.mjs';
import {
  PEDAGOGY_HOMESCHOOL_ENGINE_VERSION,
} from './pedagogy-homeschool.mjs';
import {
  PEDAGOGY_INTEGRATION_VERSION,
} from './pedagogy-generation-integration.mjs';
import {
  evaluatePedagogyQuality,
  PEDAGOGY_QUALITY_ENGINE_VERSION,
} from './pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
  prepareWaterPilotQualityBaselineContext,
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

const CASE_KIND_HANDLER_IDS = {
  architecture_only: new Set(['selection-architecture']),
  deliberate_failure: new Set([
    'architecture-output-policy-mutation',
    'repository-artifact-mutation',
    'selection-request-mutation',
  ]),
  production_classroom: new Set(['production-baseline']),
  production_homeschool: new Set(['production-baseline']),
  stale_evidence: new Set(['repository-artifact-mutation']),
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

const MUTATION_LEVELS_BY_HANDLER = {
  'architecture-output-policy-mutation': 'generated_architecture_output',
  'repository-artifact-mutation': 'repository_artifact',
  'selection-request-mutation': 'selection_request',
};

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
      item.handler_id === 'repository-artifact-mutation'
      && !QUALITY_SCENARIOS.has(item.source_scope.scenario_id)
    ) {
      errors.push(
        `${item.regression_id}: missing repository artifact mutation handler `
        + item.source_scope.scenario_id,
      );
    }
    if (
      item.handler_id === 'production-baseline'
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
    const expectedMutationLevel = MUTATION_LEVELS_BY_HANDLER[item.handler_id];
    if (expectedMutationLevel) {
      if (!item.mutation) {
        errors.push(`${item.regression_id}: ${item.handler_id} requires mutation metadata`);
      } else if (item.mutation.mutation_level !== expectedMutationLevel) {
        errors.push(
          `${item.regression_id}: mutation level ${item.mutation.mutation_level} `
          + `does not match ${item.handler_id}`,
        );
      }
    } else if (item.mutation !== null) {
      errors.push(`${item.regression_id}: non-mutation case must set mutation to null`);
    }
    if (
      item.mutation?.mutation_level === 'repository_artifact'
      && item.mutation.artifact_path !== item.source_scope.artifact_paths[0]
    ) {
      errors.push(`${item.regression_id}: primary mutation path must be the first source artifact`);
    }
    if (item.mutation && !isSorted(item.mutation.expected_changed_fields)) {
      errors.push(`${item.regression_id}: expected_changed_fields must be bytewise sorted`);
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
  const baselineContext = await prepareWaterPilotQualityBaselineContext({
    rootDir: absoluteRoot,
  });
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
    loadWaterPilotPedagogyQualityRepository({
      rootDir: absoluteRoot,
      baselineContext,
    }),
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
    baselineContext,
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

function fact(passed, summary, expected, actual, evidenceRefs) {
  return {
    passed,
    summary,
    expected,
    actual: normalizeStable(actual),
    evidence_refs: uniqueSorted(evidenceRefs),
  };
}

function activityTargets(repository) {
  return expandPedagogyActivityTargets(
    repository.selectionRepository.knowledge.activities.data.activities,
  );
}

function resolvedDnaPhases(repository, lessonDna) {
  const targets = new Map(activityTargets(repository).map(
    (target) => [target.target_id, target],
  ));
  return (lessonDna?.phases ?? []).map((phase) => ({
    phase,
    target: targets.get(phase.target?.target_id) ?? null,
  }));
}

function demandAtMost(actual, ceiling) {
  const order = pedagogyQueryOrders.demand;
  return order.has(actual) && order.has(ceiling)
    && order.get(actual) <= order.get(ceiling);
}

function selectedTargetEvidence(phases) {
  return phases.map(({ phase, target }) => ({
    phase_id: phase.phase_id,
    target_id: phase.target?.target_id ?? null,
    activity_id: target?.activity_id ?? null,
    execution_profile_id: target?.execution_profile_id ?? null,
    group_format: phase.group_format ?? null,
    category: target?.activity?.category ?? null,
    productive_language: target?.operational?.learner_demands?.productive_language ?? null,
  }));
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
  const phases = resolvedDnaPhases(repository, lessonDna);
  const identityChecks = record.identity?.required_checks ?? [];
  const sourceIdentityCurrent = identityChecks.length > 0
    && identityChecks.every((key) => record.identity?.[key] === true);
  const readiness = record.readiness ?? {};
  const productionReady =
    readiness.classroom_ready === true || readiness.homeschool_ready === true;
  const lessonEvidence = record.checked_artifacts ?? [];
  const classroomSafetyApplicable = phases.some(
    ({ phase, target }) => (
      phase.safety?.requires_adult_supervision === true
      || target?.operational?.safety?.requires_adult_supervision === true
    ),
  );
  const classroomSafetyPreserved = classroomSafetyApplicable
    && phases.some(({ phase }) => (
      phase.safety?.requires_adult_supervision === true
      && (phase.safety?.controls_ru ?? []).length > 0
    ));
  const homeSafetyPreserved = record.safety?.applicable === true
    && record.safety.adult_supervision_present === true
    && record.safety.teacher_authorization_present === true;
  const collaborativePhases = phases.filter(({ phase, target }) => {
    const operational = target?.operational;
    const nonIndividual = phase.group_format !== 'individual';
    return nonIndividual && (
      target?.activity?.category === 'collaborative_learning'
      || ['primary', 'supporting'].includes(
        operational?.capabilities?.collaborative_practice,
      )
      || ['primary', 'supporting'].includes(
        operational?.capabilities?.peer_explanation,
      )
    );
  });
  const quietIndividual = phases.length > 0 && phases.every(({ phase, target }) => (
    phase.group_format === 'individual'
    && target !== null
    && target.operational.delivery_constraints?.supported_group_formats?.includes(
      'individual',
    )
    && target.activity.category !== 'collaborative_learning'
    && target.operational.capabilities?.collaborative_practice !== 'primary'
    && target.operational.capabilities?.peer_explanation !== 'primary'
  ));
  return {
    adapted_contract_complete: fact(
      record.home?.adapted_contracts_complete === true,
      'Every reselected homeschool target resolves through an explicit adapted task contract.',
      true,
      record.home?.adapted_contracts_complete ?? null,
      lessonEvidence,
    ),
    adult_supervision_preserved: fact(
      record.kind === 'homeschool_package'
        ? homeSafetyPreserved
        : classroomSafetyPreserved,
      record.kind === 'homeschool_package'
        ? 'Homeschool safety is derived from the resolved package and authorization contract.'
        : 'Classroom safety is derived from the selected classroom activity and lesson DNA controls.',
      {
        applicable: true,
        adult_supervision: true,
        teacher_authorization: record.kind === 'homeschool_package',
      },
      record.kind === 'homeschool_package'
        ? record.safety
        : {
          applicable: classroomSafetyApplicable,
          controls_present: classroomSafetyPreserved,
          phases: selectedTargetEvidence(phases),
        },
      lessonEvidence,
    ),
    answer_key_after_attempt: fact(
      record.retrieval?.key_after_attempt === true,
      'Retrieval answer access is released only after the first attempt.',
      'after_first_attempt',
      record.retrieval?.key_after_attempt ?? null,
      lessonEvidence,
    ),
    answer_leak_absent: fact(
      (record.answer_leaks ?? []).length === 0,
      'Learner-facing closure contains no normalized complete answer.',
      [],
      record.answer_leaks ?? [],
      lessonEvidence,
    ),
    assessment_separated: fact(
      record.language?.assessment_separated === true,
      'Subject and Estonian-language evidence remain separate.',
      true,
      record.language?.assessment_separated ?? null,
      lessonEvidence,
    ),
    collaborative_method_present: fact(
      collaborativePhases.length > 0,
      'Collaboration requires a non-individual format plus collaborative or peer operational semantics.',
      'at least one operationally collaborative non-individual phase',
      selectedTargetEvidence(collaborativePhases),
      lessonEvidence,
    ),
    delayed_retrieval_future: fact(
      record.delayed_retrieval?.applicable === true
        && record.delayed_retrieval.thematic_link_current === true
        && record.delayed_retrieval.absolute_dates_absent === true,
      'Delayed retrieval resolves through a forward thematic-plan link.',
      { applicable: true, thematic_link_current: true, absolute_dates_absent: true },
      record.delayed_retrieval ?? null,
      lessonEvidence,
    ),
    language_demand_within_ceiling: fact(
      record.language?.productive_demand_within_ceiling === true,
      'Selected operational productive-language demand stays within the request ceiling.',
      true,
      record.language?.productive_demand_within_ceiling ?? null,
      lessonEvidence,
    ),
    material_alignment: fact(
      record.kind === 'homeschool_package'
      ? (
        record.home?.material_closure_resolved === true
        && record.home?.delivery_scope_valid === true
      )
      : (
        record.alignment?.task_identity_aligned === true
        && record.alignment?.artifact_paths_resolved === true
        && record.alignment?.machine_rendered_equivalent === true
      ),
      'Task, material, key and rendered closure remain aligned for the delivery context.',
      true,
      record.kind === 'homeschool_package' ? record.home : record.alignment,
      lessonEvidence,
    ),
    no_effectiveness_claim: fact(
      readiness.effectiveness_claimed === false,
      'Structural evidence does not claim pedagogical effectiveness.',
      false,
      readiness.effectiveness_claimed ?? null,
      lessonEvidence,
    ),
    parent_role_bounded: fact(
      record.home?.parent_role_bounded === true,
      'The parent role excludes subject explanation.',
      true,
      record.home?.parent_role_bounded ?? null,
      lessonEvidence,
    ),
    quiet_individual_method_present: fact(
      quietIndividual,
      'Every selected phase is individual and no selected target requires collaborative or peer operation.',
      'all phases individual without primary collaborative or peer capability',
      selectedTargetEvidence(phases),
      lessonEvidence,
    ),
    readiness_evidence_gated: fact(
      productionReady === false && readiness.effectiveness_claimed === false,
      'Readiness and effectiveness remain gated by current human evidence.',
      { production_ready: false, effectiveness_claimed: false },
      { production_ready: productionReady, effectiveness_claimed: readiness.effectiveness_claimed },
      lessonEvidence,
    ),
    retrieval_correction_after_attempt: fact(
      record.retrieval?.later_correction_present === true,
      'A distinct correction/check follows the first retrieval attempt.',
      true,
      record.retrieval?.later_correction_present ?? null,
      lessonEvidence,
    ),
    retrieval_source_closed: fact(
      record.retrieval?.closed_first_attempt === true,
      'The first retrieval attempt is source-closed.',
      true,
      record.retrieval?.closed_first_attempt ?? null,
      lessonEvidence,
    ),
    source_identity_current: fact(
      sourceIdentityCurrent,
      'Every required content, catalogue, rules and digest identity check is current.',
      identityChecks,
      Object.fromEntries(identityChecks.map((key) => [key, record.identity?.[key] ?? null])),
      record.identity?.related_paths ?? lessonEvidence,
    ),
    structurally_complete: fact(
      view.structural?.status === 'passed',
      'All applicable primitive quality gates pass for the production record.',
      'passed',
      view.structural?.status ?? null,
      lessonEvidence,
    ),
    timing_reconciled: fact(
      record.timing?.reconciled === true && record.timing?.lesson_total_exact === true,
      'Component timing and lesson total reconcile without double counting.',
      { reconciled: true, lesson_total_exact: true },
      record.timing ?? null,
      lessonEvidence,
    ),
    comparison_capability_present: fact(
      capabilities.includes('comparison'),
      'Selected lesson DNA contains comparison capability.',
      'comparison',
      capabilities,
      lessonEvidence,
    ),
    map_data_capability_present: fact(
      capabilities.some(
      (capability) => ['data_interpretation', 'diagram_interpretation', 'map_interpretation'].includes(capability),
    ),
      'Selected lesson DNA contains map, diagram or data interpretation capability.',
      ['data_interpretation', 'diagram_interpretation', 'map_interpretation'],
      capabilities,
      lessonEvidence,
    ),
    self_explanation_present: fact(
      targetIds.includes('self-explanation'),
      'The selected target set includes self-explanation.',
      'self-explanation',
      targetIds,
      lessonEvidence,
    ),
  };
}

function factsForSelection(repository, item, request, outcome) {
  const lessonDna = outcome.lessonDna;
  const targetIds = targetsFromDna(lessonDna);
  const capabilities = allCapabilities(lessonDna);
  const status = outcome.decision.status;
  const phases = resolvedDnaPhases(repository, lessonDna);
  const evidence = [
    PEDAGOGY_REGRESSION_FIXTURES,
    repository.selectionRepository.fixtures.file,
    repository.selectionRepository.rules.file,
    'knowledge/pedagogy/activities/activity-catalog.yaml',
  ];
  const architectureActual = {
    request_context: lessonDna?.context ?? null,
    selected_targets: selectedTargetEvidence(phases),
  };
  const allTargetsResolved = phases.length > 0 && phases.every(({ target }) => target);
  const gradeDeliveryCompatible = status === 'success' && allTargetsResolved
    && phases.every(({ target }) => (
      target.activity.suitable_grades.min <= request.learner_context.grade
      && request.learner_context.grade <= target.activity.suitable_grades.max
      && (
        target.activity.subjects.includes(request.learner_context.subject)
        || target.activity.subjects.includes('cross_curricular')
      )
      && target.operational.delivery_constraints.delivery_modes.includes(
        request.learner_context.delivery_mode,
      )
    ));
  const groupCompatible = status === 'success' && allTargetsResolved
    && phases.every(({ phase, target }) => (
      target.operational.delivery_constraints.supported_group_formats.includes(
        phase.group_format,
      )
      && request.learner_context.supported_group_formats.includes(
        phase.group_format,
      )
      && (
        phase.group_format !== 'individual'
        || target.operational.delivery_constraints.group_size.min <= 1
      )
      && (
        phase.group_format !== 'pair'
        || (
          target.operational.delivery_constraints.group_size.min <= 2
          && target.operational.delivery_constraints.group_size.max >= 2
        )
      )
    ));
  const ceiling = request.language_profile.maximum_total_productive_language_demand;
  const demandCompatible = status === 'success' && allTargetsResolved
    && phases.every(({ target }) => demandAtMost(
      target.operational.learner_demands.productive_language,
      ceiling,
    ));
  const scaffoldsPresent = status === 'success' && allTargetsResolved
    && request.language_profile.estonian_support.sentence_frames_required === true
    && request.language_profile.estonian_support.word_bank_required === true
    && phases.every(({ target }) => (
      Array.isArray(target.operational.learner_demands.scaffolds_ru)
      && target.operational.learner_demands.scaffolds_ru.length > 0
      && ['directly_supported', 'supported_with_scaffold'].includes(
        target.operational.learner_demands.estonian_a1_a2_compatibility,
      )
    ));
  return {
    additional_scaffolding_present: fact(
      scaffoldsPresent,
      'Required language scaffolds are present in the resolved operational target contracts.',
      { sentence_frames_required: true, word_bank_required: true },
      architectureActual,
      evidence,
    ),
    architecture_only_not_ready: fact(
      item.status === 'architecture_only',
      'Architecture-only output is explicitly non-production.',
      'architecture_only',
      item.status,
      [PEDAGOGY_REGRESSION_FIXTURES],
    ),
    comparison_capability_present: fact(
      capabilities.includes('comparison'),
      'Resolved target metadata exposes comparison capability.',
      'comparison',
      capabilities,
      evidence,
    ),
    grade_delivery_compatible: fact(
      gradeDeliveryCompatible,
      'Grade, subject and delivery compatibility are derived from each resolved activity/profile contract.',
      {
        grade: request.learner_context.grade,
        subject: request.learner_context.subject,
        delivery_mode: request.learner_context.delivery_mode,
      },
      architectureActual,
      evidence,
    ),
    group_context_compatible: fact(
      groupCompatible,
      'Selected group formats are supported by request and operational group-size contracts.',
      {
        group_size: request.learner_context.group_size,
        supported_group_formats: request.learner_context.supported_group_formats,
      },
      architectureActual,
      evidence,
    ),
    language_demand_within_ceiling: fact(
      demandCompatible,
      'Actual selected operational productive-language demands stay within the total demand ceiling.',
      ceiling,
      selectedTargetEvidence(phases).map((phase) => ({
        target_id: phase.target_id,
        productive_language: phase.productive_language,
      })),
      evidence,
    ),
    map_data_capability_present: fact(
      targetIds.some((targetId) => targetId.includes('map-data'))
      || capabilities.some(
        (capability) => ['data_interpretation', 'diagram_interpretation', 'map_interpretation'].includes(capability),
      ),
      'Resolved target metadata exposes map, diagram or data interpretation.',
      ['data_interpretation', 'diagram_interpretation', 'map_interpretation'],
      { target_ids: targetIds, capabilities },
      evidence,
    ),
    no_production_artifacts_claimed: fact(
      item.status === 'architecture_only',
      'Architecture fixtures do not claim authored lesson, worksheet, answer-key or teacher-pack artifacts.',
      [],
      [],
      [PEDAGOGY_REGRESSION_FIXTURES],
    ),
    selection_failure_detected: fact(
      status === 'failure',
      'The selection engine rejects the incompatible request.',
      'failure',
      status,
      evidence,
    ),
    selection_success: fact(
      status === 'success',
      'The selection engine produces a schema-valid architecture result.',
      'success',
      status,
      evidence,
    ),
    self_explanation_present: fact(
      targetIds.includes('self-explanation'),
      'The resolved architecture selects self-explanation.',
      'self-explanation',
      targetIds,
      evidence,
    ),
    teacher_override_rationale_preserved: fact(
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
      'The accepted teacher override is applied to the matching slot and retains rationale.',
      {
        override_id: 'quiet-individual-concept-map',
        slot_id: 'guided-practice',
        target_id: 'concept-map',
      },
      lessonDna?.teacher_overrides ?? [],
      evidence,
    ),
  };
}

function invariantResults(item, facts) {
  return item.expected_invariants.map((invariantId) => {
    const evidence = facts[invariantId] ?? fact(
      false,
      `Invariant ${invariantId} has no executable evidence projection.`,
      true,
      null,
      [PEDAGOGY_REGRESSION_FIXTURES],
    );
    return {
      invariant_id: invariantId,
      status: evidence.passed ? 'passed' : 'failed',
      summary: evidence.summary,
      expected: normalizeStable(evidence.expected),
      actual: normalizeStable(evidence.actual),
      evidence_refs: uniqueSorted(evidence.evidence_refs),
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
    ephemeral_checked_artifacts: [],
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
    factsForSelection(repository, item, request, outcome),
  );
}

function yamlBytes(bytes, mutate) {
  const document = parseDocument(bytes.toString('utf8'), {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
  });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'));
  }
  const value = document.toJS({ maxAliasCount: 1000 });
  mutate(value);
  return Buffer.from(stringify(value, {
    lineWidth: 100,
    sortMapEntries: false,
  }));
}

async function snapshotFile(rootDir, repositoryPath) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  try {
    return { repositoryPath, absolute, bytes: await fs.readFile(absolute), existed: true };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { repositoryPath, absolute, bytes: null, existed: false };
  }
}

async function writeMutation(rootDir, repositoryPath, mutate) {
  const snapshot = await snapshotFile(rootDir, repositoryPath);
  const replacement = await mutate(snapshot.bytes);
  if (replacement === null) {
    await fs.rm(snapshot.absolute, { force: true });
  } else {
    await fs.mkdir(path.dirname(snapshot.absolute), { recursive: true });
    await fs.writeFile(snapshot.absolute, replacement);
  }
  return snapshot;
}

async function restoreSnapshots(snapshots) {
  for (const snapshot of [...snapshots].reverse()) {
    if (!snapshot.existed) {
      await fs.rm(snapshot.absolute, { force: true });
    } else {
      await fs.mkdir(path.dirname(snapshot.absolute), { recursive: true });
      await fs.writeFile(snapshot.absolute, snapshot.bytes);
    }
  }
}

function staleFingerprint(current) {
  return {
    ...current,
    value: current.value === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64),
  };
}

function completedReview(fingerprint) {
  return {
    schema_version: '1.1',
    artifact_type: 'teacher_review',
    review_id: 'grade-5-water-regression-review-2026-07-25',
    pack_ref: 'grade-5-science-water-teacher-pack',
    reviewed_version: {
      commit_sha: 'a'.repeat(40),
      content_fingerprint: structuredClone(fingerprint),
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
      reviewer_reference: 'regression-fixture-reviewer',
    },
    reviewed_at: '2026-07-25',
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
    },
    ratings: {
      scientific_accuracy: 4,
      age_appropriateness: 4,
      timing_feasibility: 4,
      instruction_clarity: 4,
      student_material_usability: 4,
      assessment_alignment: 4,
      estonian_a1_a2_fit: 4,
      safety_readiness: 4,
      homeschool_usability: 4,
    },
    findings: [],
    blocking_findings: [],
    required_changes: [],
    optional_improvements: [],
    decision: {
      status: 'approved',
      rationale: 'Temporary regression evidence deliberately bound to a stale fingerprint.',
    },
  };
}

function completedTrial(fingerprint) {
  return {
    schema_version: '1.1',
    artifact_type: 'classroom_trial',
    trial_id: 'grade-5-water-regression-trial-2026-07-25',
    pack_ref: 'grade-5-science-water-teacher-pack',
    reviewed_version: {
      commit_sha: 'a'.repeat(40),
      content_fingerprint: structuredClone(fingerprint),
    },
    trial_status: 'analysed',
    context: {
      lesson_ids: [
        'grade-5-water-01-properties',
        'grade-5-water-02-states',
        'grade-5-water-03-melting-condensation',
        'grade-5-water-04-changes-review',
      ],
      setting: 'classroom',
      grade: 5,
      approximate_group_size: 24,
      learner_estonian_profile: 'A1-A2',
      instruction_language: 'ru',
      subject_support_language: 'et',
      teacher_role: 'primary_science_teacher',
    },
    privacy: {
      contains_student_names: false,
      contains_birth_dates: false,
      contains_personal_identifiers: false,
      contains_addresses: false,
      contains_contact_information: false,
      contains_parent_contacts: false,
      contains_student_photos: false,
      contains_special_category_data: false,
      contains_identifiable_individual_grades: false,
      contains_identifiable_free_text: false,
      observations_are_aggregated: true,
      free_text_checked_for_identifiers: true,
    },
    conducted_at: '2026-07-25',
    timing_observations: [],
    instruction_observations: [],
    safety_observations: [],
    learning_evidence: [],
    language_evidence: [],
    material_usability: [],
    unexpected_support_needed: [],
    teacher_adjustments: [],
    findings: [],
    decision: {
      status: 'successful',
      safe_to_repeat: true,
      rationale: 'Temporary regression evidence deliberately bound to a stale fingerprint.',
    },
  };
}

async function applyRepositoryMutation(rootDir, item, currentFingerprint) {
  const scenario = item.mutation.mutation_id;
  const primaryPath = item.mutation.artifact_path;
  const snapshots = [];
  const changeYaml = async (repositoryPath, mutate) => {
    snapshots.push(await writeMutation(
      rootDir,
      repositoryPath,
      (bytes) => yamlBytes(bytes, mutate),
    ));
  };
  const changeText = async (repositoryPath, mutate) => {
    snapshots.push(await writeMutation(rootDir, repositoryPath, mutate));
  };
  switch (scenario) {
    case 'timing_overflow':
      await changeYaml(primaryPath, (index) => {
        index.lessons[0].timing_reconciliation.stage_partitions[0]
          .allocated_minutes += 1;
      });
      break;
    case 'open_source_retrieval':
      await changeYaml(primaryPath, (lesson) => {
        const binding = lesson.pedagogical_integration.phase_bindings.find(
          (candidate) => candidate.dna_phase_id === 'retrieval',
        );
        binding.source_access_policy = 'open';
      });
      break;
    case 'immediate_instead_delayed':
      await changeYaml(primaryPath, (thematic) => {
        const link = thematic.pedagogical_integration.delayed_retrieval_links[0];
        link.target_lesson_id = link.source_lesson_id;
      });
      break;
    case 'combined_assessment':
      await changeYaml(primaryPath, (lesson) => {
        for (const criterion of lesson.assessment) {
          if (criterion.affects === 'language_assessment') {
            criterion.affects = 'subject_assessment';
          }
        }
      });
      break;
    case 'wrong_task_binding':
      await changeYaml(primaryPath, (index) => {
        index.lessons[0].task_bindings[0].target_id = 'concept-map';
      });
      break;
    case 'classroom_method_in_homeschool':
      await changeYaml(primaryPath, (lesson) => {
        const contract = lesson.pedagogical_integration.selection_input
          .homeschool.adapted_task_contracts.find(
            (candidate) => candidate.source_phase_id === 'practical-work',
          );
        contract.student_material_ids = ['practical-safety-card'];
      });
      break;
    case 'parent_subject_teaching':
      await changeYaml(primaryPath, (decision) => {
        decision.adult_role_decisions[0].role = 'subject_explanation_required';
        decision.adult_role_decisions[0].effort_level = 'high';
      });
      break;
    case 'missing_adapted_task_contract':
      await changeYaml(primaryPath, (lesson) => {
        lesson.pedagogical_integration.selection_input.homeschool
          .adapted_task_contracts = lesson.pedagogical_integration.selection_input
          .homeschool.adapted_task_contracts.filter(
            (contract) => contract.source_phase_id !== 'practical-work',
          );
      });
      break;
    case 'missing_adult_supervision':
      await changeYaml(primaryPath, (homeschoolPackage) => {
        homeschoolPackage.safety.adult_supervision_required = false;
        homeschoolPackage.safety.effective_supervision_required = false;
      });
      break;
    case 'learner_answer_leak': {
      const lesson = await readYaml(rootDir, 'lesson-plans/grade-5-science/water/lesson-01.yaml');
      const answer = lesson.questions[0].full_expected_answer_ru;
      await changeText(primaryPath, (bytes) => Buffer.from(
        `${bytes.toString('utf8')}\n\n${answer}\n`,
      ));
      break;
    }
    case 'language_demand_above_ceiling':
      await changeYaml(primaryPath, (request) => {
        request.language_profile.maximum_total_productive_language_demand = 'very_low';
      });
      break;
    case 'stale_taxonomy_version':
      await changeYaml(primaryPath, (lessonDna) => {
        lessonDna.versions.taxonomy = '0.9';
      });
      break;
    case 'stale_selection_rules':
      await changeYaml(primaryPath, (request) => {
        request.selection_rules_version = '9.9';
      });
      break;
    case 'stale_catalogue_digest':
      await changeYaml(primaryPath, (lessonDna) => {
        lessonDna.versions.activity_catalog_digest = 'a'.repeat(64);
      });
      break;
    case 'stale_content_identity':
      await changeYaml(primaryPath, (lesson) => {
        lesson.objectives.content_objectives[0].text_ru +=
          ' Временная мутация идентичности.';
      });
      break;
    case 'stale_teacher_pack_fingerprint':
      await changeText(primaryPath, (bytes) => Buffer.concat([
        bytes,
        Buffer.from('\n<!-- temporary regression fingerprint mutation -->\n'),
      ]));
      {
        const indexPath = 'teacher-packs/grade-5-science/water/materials-index.yaml';
        const evidencePath =
          'pedagogical-reviews/grade-5-science/water/teacher-review-regression.yaml';
        await changeYaml(indexPath, (index) => {
          index.pedagogical_review.review_record_path = evidencePath;
        });
        await changeText(evidencePath, () => Buffer.from(stringify(
          completedReview(currentFingerprint),
          { lineWidth: 100, sortMapEntries: false },
        )));
      }
      break;
    case 'stale_teacher_review': {
      const evidencePath =
        'pedagogical-reviews/grade-5-science/water/teacher-review-regression.yaml';
      await changeYaml(primaryPath, (index) => {
        index.pedagogical_review.review_record_path = evidencePath;
      });
      await changeText(evidencePath, () => Buffer.from(stringify(
        completedReview(staleFingerprint(currentFingerprint)),
        { lineWidth: 100, sortMapEntries: false },
      )));
      break;
    }
    case 'stale_classroom_trial': {
      const evidencePath =
        'pedagogical-reviews/grade-5-science/water/classroom-trial-regression.yaml';
      await changeYaml(primaryPath, (index) => {
        index.classroom_trial.trial_record_paths = [evidencePath];
      });
      await changeText(evidencePath, () => Buffer.from(stringify(
        completedTrial(staleFingerprint(currentFingerprint)),
        { lineWidth: 100, sortMapEntries: false },
      )));
      break;
    }
    default:
      throw new Error(`missing repository artifact mutation ${scenario}`);
  }
  return snapshots;
}

async function runRepositoryMutationCase(repository, item, fixtureRoot) {
  const snapshots = await applyRepositoryMutation(
    fixtureRoot,
    item,
    repository.qualityRepository.reportMetadata.teacherPackFingerprint,
  );
  let mutatedRepository;
  try {
    mutatedRepository = await loadWaterPilotPedagogyQualityRepository({
      rootDir: fixtureRoot,
      baselineRootDir: repository.rootDir,
      baselineContext: repository.baselineContext,
    });
  } finally {
    await restoreSnapshots(snapshots);
  }
  const view = qualityRecordEvaluation(
    mutatedRepository,
    item.source_scope.record_id,
  );
  if (!view.record) throw new Error(`${item.regression_id}: mutation record missing`);
  const result = baseResult(item);
  result.actual_claims = actualClaimsFromQuality(view);
  result.diagnostics = view.diagnostics.map(normalizeDiagnostic);
  const ephemeralPaths = new Set(
    snapshots.filter((snapshot) => !snapshot.existed).map(
      (snapshot) => snapshot.repositoryPath,
    ),
  );
  result.ephemeral_checked_artifacts = uniqueSorted([...ephemeralPaths]);
  result.checked_artifacts = uniqueSorted([
    ...result.checked_artifacts,
    ...view.record.checked_artifacts.filter(
      (repositoryPath) => !ephemeralPaths.has(repositoryPath),
    ),
    ...snapshots.filter((snapshot) => snapshot.existed).map(
      (snapshot) => snapshot.repositoryPath,
    ),
  ]);
  const mutationEvidence = uniqueSorted([
    ...result.checked_artifacts,
    ...result.ephemeral_checked_artifacts,
  ]);
  const expectedDetected = item.expected_diagnostics.every(
    (expected) => result.diagnostics.some(
      (actual) => expectedDiagnosticMatches(actual, expected),
    ),
  );
  const facts = {
    diagnostic_detected: fact(
      expectedDetected,
      'Reloading the mutated repository produces the expected semantic diagnostic.',
      item.expected_diagnostics,
      result.diagnostics,
      mutationEvidence,
    ),
    readiness_evidence_gated: fact(
      result.actual_claims.production_ready === false
        && result.actual_claims.effectiveness_claimed === false,
      'The deliberate mutation cannot promote readiness or effectiveness.',
      { production_ready: false, effectiveness_claimed: false },
      result.actual_claims,
      mutationEvidence,
    ),
    structural_claim_blocked: fact(
      result.actual_claims.structurally_complete === false,
      'The semantic defect blocks structural completeness.',
      false,
      result.actual_claims.structurally_complete,
      mutationEvidence,
    ),
  };
  return finalizeCaseResult(item, result, facts);
}

export function validateArchitectureOnlyResult(result) {
  const diagnostics = [];
  if (result.actual_claims?.production_ready === true) {
    diagnostics.push({
      severity: 'error',
      code: 'architecture_only_readiness_claim',
      gate_id: null,
      artifact_path: PEDAGOGY_REGRESSION_FIXTURES,
      record_id: result.regression_id,
    });
  }
  if ((result.authored_artifact_paths ?? []).length > 0) {
    diagnostics.push({
      severity: 'error',
      code: 'architecture_only_artifact_claim',
      gate_id: null,
      artifact_path: PEDAGOGY_REGRESSION_FIXTURES,
      record_id: result.regression_id,
    });
  }
  return diagnostics.sort((left, right) => compareBytewise(
    `${left.code}\u0000${left.artifact_path}`,
    `${right.code}\u0000${right.artifact_path}`,
  ));
}

function runPolicyMutationCase(repository, item) {
  const fixture = selectionFixture(
    repository,
    item.source_scope.selection_fixture_id,
  );
  const outcome = selectLessonPedagogy(
    repository.selectionRepository,
    transformSelectionRequest(fixture.request, item.source_scope.transform_id),
  );
  const result = baseResult(item);
  if (outcome.decision.status !== 'success') {
    throw new Error(`${item.regression_id}: architecture baseline selection failed`);
  }
  result.actual_claims.production_ready = true;
  result.authored_artifact_paths = [];
  result.diagnostics = validateArchitectureOnlyResult(result);
  result.actual_claims.production_ready = false;
  delete result.authored_artifact_paths;
  return finalizeCaseResult(item, result, {
    diagnostic_detected: fact(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'architecture_only_readiness_claim',
      ),
      'The architecture-only result policy rejects a mutated production-ready claim.',
      'architecture_only_readiness_claim',
      result.diagnostics,
      [PEDAGOGY_REGRESSION_FIXTURES],
    ),
  });
}

async function runCase(repository, item, fixtureRoot) {
  if (item.handler_id === 'production-baseline') {
    return runProductionQualityCase(repository, item);
  }
  if (
    item.handler_id === 'selection-architecture'
    || item.handler_id === 'selection-request-mutation'
  ) {
    return runSelectionCase(repository, item);
  }
  if (item.handler_id === 'repository-artifact-mutation') {
    return runRepositoryMutationCase(repository, item, fixtureRoot);
  }
  if (item.handler_id === 'architecture-output-policy-mutation') {
    return runPolicyMutationCase(repository, item);
  }
  throw new Error(`missing executable regression handler ${item.handler_id}`);
}

async function createMutationFixture(rootDir) {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-regression-'));
  await fs.cp(rootDir, fixtureRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(rootDir, source);
      return !(
        relative === '.git'
        || relative.startsWith(`.git${path.sep}`)
        || relative === 'node_modules'
        || relative.startsWith(`node_modules${path.sep}`)
      );
    },
  });
  return fixtureRoot;
}

export async function runPedagogyRegressions(repository, { caseIds = null } = {}) {
  if (repository.configurationErrors.length > 0) {
    return {
      results: [],
      errors: [...repository.configurationErrors],
    };
  }
  const cases = caseIds
    ? repository.fixtures.cases.filter((item) => caseIds.includes(item.regression_id))
    : repository.fixtures.cases;
  const mutationCases = cases.filter(
    (item) => item.handler_id === 'repository-artifact-mutation',
  );
  const directCases = cases.filter(
    (item) => item.handler_id !== 'repository-artifact-mutation',
  );
  const workerCount = Math.min(3, mutationCases.length);
  const fixtureRoots = await Promise.all(
    Array.from({ length: workerCount }, () => createMutationFixture(repository.rootDir)),
  );
  let results = [];
  try {
    results.push(...await Promise.all(
      directCases.map((item) => runCase(repository, item, null)),
    ));
    const buckets = Array.from({ length: workerCount }, () => []);
    mutationCases.forEach((item, index) => {
      buckets[index % workerCount].push(item);
    });
    const workerResults = await Promise.all(buckets.map(
      async (bucket, index) => {
        const items = [];
        for (const item of bucket) {
          items.push(await runCase(repository, item, fixtureRoots[index]));
        }
        return items;
      },
    ));
    results.push(...workerResults.flat());
    results.sort((left, right) => compareBytewise(
      left.regression_id,
      right.regression_id,
    ));
  } finally {
    await Promise.all(fixtureRoots.map(
      (fixtureRoot) => fs.rm(fixtureRoot, { recursive: true, force: true }),
    ));
  }
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
    PEDAGOGY_REGRESSION_CASE_SCHEMA,
    PEDAGOGY_REGRESSION_FIXTURES,
    PEDAGOGY_REGRESSION_REPORT_SCHEMA,
    ...(repository.selectionRepository.loadedArtifactPaths ?? []),
    ...(repository.qualityRepository.loadedArtifactPaths ?? []),
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
  const missingDependencies = [];
  for (const repositoryPath of report.checked_artifacts) {
    if (!await regularFileExists(repository.rootDir, repositoryPath)) {
      missingDependencies.push(
        `checked regression dependency is missing or not a regular file: ${repositoryPath}`,
      );
    }
  }
  if (missingDependencies.length > 0) return missingDependencies;
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
