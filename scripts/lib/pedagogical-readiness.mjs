import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  parseStrictPedagogicalEvidenceJson,
  resolveCurrentCommitSha,
} from './pedagogical-evidence.mjs';
import {
  loadPedagogicalReviewRepository,
  summarizePedagogicalEvidenceForPack,
  validatePedagogicalReviewRepository,
} from './pedagogical-reviews.mjs';
import {
  evaluatePedagogyQuality,
} from './pedagogy-quality-gates.mjs';
import {
  loadWaterPilotPedagogyQualityRepository,
} from './pedagogy-quality-production.mjs';

export const PEDAGOGICAL_READINESS_REPORT_PATH =
  'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json';
export const PEDAGOGICAL_READINESS_REPORT_ID = 'grade-5-water-readiness-report';
export const PEDAGOGICAL_READINESS_SCHEMA_PATH =
  'schemas/pedagogical-readiness-report.schema.json';

const NON_GUARANTEES = Object.freeze([
  'A readiness result is not a comparative pedagogical-effectiveness claim.',
  'Automated privacy guards do not prove that all personal data is absent.',
  'Structural completeness does not substitute for teacher review or a trial.',
  'Classroom evidence does not establish homeschool readiness.',
  'Home evidence does not establish classroom readiness.',
  'Readiness applies only to the exact current content and pedagogical snapshot.',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
}

function activeFinding(finding) {
  return ['open', 'planned'].includes(finding.resolution_status)
    && ['blocking', 'major'].includes(finding.severity);
}

function evidenceFindingSummaries(evidenceSummary) {
  return (evidenceSummary.active_evidence_states ?? []).flatMap((state) => (
    (state.artifact?.data?.findings ?? [])
      .filter(activeFinding)
      .map((finding) => ({
        finding_id: finding.finding_id,
        severity: finding.severity,
        category: finding.category,
        delivery_modes: [...finding.delivery_modes].sort(compareBytewise),
        evidence_path: state.artifact.file,
      }))
  )).sort((left, right) => (
    compareBytewise(left.evidence_path, right.evidence_path)
    || compareBytewise(left.finding_id, right.finding_id)
  ));
}

function evidenceKind(state) {
  return state.artifact?.data?.artifact_type ?? 'unknown';
}

function evidenceAuditEntry(state) {
  return {
    kind: evidenceKind(state),
    record_id: state.recordId,
    decision: state.decision,
    delivery_modes: [...(state.deliveryScopes ?? [])].sort(compareBytewise),
    supersedes: [...(state.supersedes ?? [])].sort(compareBytewise),
    superseded_by: state.supersededBy ?? null,
    evidence_path: state.artifact.file,
  };
}

function evidenceAudit(evidenceSummary) {
  const activeStates = evidenceSummary.active_evidence_states ?? [];
  const historicalStates = evidenceSummary.historical_evidence_states ?? [];
  const sorted = (states) => states.map(evidenceAuditEntry).sort((left, right) => (
    compareBytewise(left.kind, right.kind)
    || compareBytewise(left.evidence_path, right.evidence_path)
  ));
  const staleEvidence = [...activeStates, ...historicalStates]
    .filter((state) => state.stale)
    .map((state) => ({
      ...evidenceAuditEntry(state),
      active: !state.superseded,
    }))
    .sort((left, right) => (
      compareBytewise(left.kind, right.kind)
      || compareBytewise(left.evidence_path, right.evidence_path)
    ));
  return {
    active_evidence: sorted(activeStates),
    historical_evidence: sorted(historicalStates),
    superseded_evidence: sorted(historicalStates),
    stale_evidence: staleEvidence,
    readiness_supporting_evidence: sorted(
      activeStates.filter((state) => state.positive_effective),
    ),
    readiness_blocking_evidence: sorted(
      activeStates.filter(
        (state) => state.negative_effective || state.stale,
      ),
    ),
  };
}

function blocker(code, deliveryMode, message, evidencePaths = []) {
  return {
    code,
    delivery_mode: deliveryMode,
    message,
    evidence_paths: uniqueSorted(evidencePaths),
  };
}

function statusSummary(status, effective, currentCount, staleCount, evidencePaths) {
  return {
    status,
    effective,
    current_count: currentCount,
    stale_count: staleCount,
    evidence_paths: uniqueSorted(evidencePaths),
  };
}

export function evaluatePedagogicalReadiness({
  index,
  evidenceSummary,
  structuralQuality,
  homeschoolClosureResolved,
  openFindings = [],
  staleEvidence = [],
  audit = {
    active_evidence: [],
    historical_evidence: [],
    superseded_evidence: [],
    stale_evidence: [],
    readiness_supporting_evidence: [],
    readiness_blocking_evidence: [],
  },
}) {
  const pack = index.data;
  const blockers = [];
  const structuralPasses = structuralQuality.pedagogy_schema_valid === true
    && structuralQuality.structurally_complete === true
    && structuralQuality.errors === 0;
  if (!structuralPasses) {
    blockers.push(blocker(
      'structural_quality_failed',
      'both',
      'Structural pedagogy quality must pass before either readiness state can be true.',
    ));
  }
  if (pack.pedagogical_integration?.status?.effectiveness_claimed === true) {
    blockers.push(blocker(
      'effectiveness_claim_forbidden',
      'both',
      'Readiness evidence does not establish pedagogical effectiveness.',
    ));
  }
  const materialsResolved = pack.pedagogical_integration !== undefined
    && structuralQuality.materials_resolved !== false;
  const thematicMaterialsResolved = structuralQuality.pack_materials_resolved === true;
  const printReady = structuralQuality.pack_print_ready === true;
  if (!materialsResolved || !thematicMaterialsResolved) {
    blockers.push(blocker(
      'materials_unresolved',
      'both',
      'All required teacher-pack materials must resolve.',
    ));
  }
  if (!printReady) {
    blockers.push(blocker(
      'print_requirements_failed',
      'classroom',
      'Classroom readiness requires the declared print requirements to pass.',
    ));
  }
  if (!homeschoolClosureResolved) {
    blockers.push(blocker(
      'homeschool_material_closure_failed',
      'homeschool',
      'Homeschool readiness requires a resolved home material closure.',
    ));
  }
  if (!evidenceSummary.effective_classroom_review) {
    blockers.push(blocker(
      'current_classroom_review_missing',
      'classroom',
      'A current approved teacher review covering classroom delivery is required.',
      evidenceSummary.teacher_review_paths,
    ));
  }
  if (!evidenceSummary.effective_homeschool_review) {
    blockers.push(blocker(
      'current_homeschool_review_missing',
      'homeschool',
      'A current approved teacher review covering homeschool delivery is required.',
      evidenceSummary.teacher_review_paths,
    ));
  }
  if (!evidenceSummary.effective_classroom_trial) {
    blockers.push(blocker(
      'current_classroom_trial_missing',
      'classroom',
      'A current analysed classroom trial is required.',
      evidenceSummary.classroom_trial_paths,
    ));
  }
  if (!evidenceSummary.effective_home_trial) {
    blockers.push(blocker(
      'current_home_trial_missing',
      'homeschool',
      'A current analysed home trial is required.',
      evidenceSummary.home_trial_paths,
    ));
  }
  const activeStates = evidenceSummary.active_evidence_states ?? [];
  for (const state of activeStates.filter((item) => item.negative_effective)) {
    for (const deliveryMode of state.deliveryScopes ?? []) {
      blockers.push(blocker(
        'current_negative_human_evidence',
        deliveryMode,
        `Current ${state.decision} decision in ${state.recordId} prevents readiness.`,
        [state.artifact.file],
      ));
    }
  }
  if (evidenceSummary.parent_role_bounded !== true) {
    blockers.push(blocker(
      'parent_role_not_bounded',
      'homeschool',
      'Home evidence must confirm that the adult did not become the default subject teacher.',
      evidenceSummary.home_trial_paths,
    ));
  }
  for (const change of evidenceSummary.unresolved_required_changes) {
    for (const deliveryMode of change.delivery_modes ?? ['classroom', 'homeschool']) {
      blockers.push(blocker(
        'required_changes_unresolved',
        deliveryMode,
        `Required change ${change.change_id} in ${
          change.record_id ?? 'teacher review'
        } remains unresolved.`,
        [change.evidence_path].filter(Boolean),
      ));
    }
  }
  for (const finding of openFindings) {
    for (const deliveryMode of finding.delivery_modes) {
      blockers.push(blocker(
        finding.category === 'safety'
          ? 'open_safety_finding'
          : 'open_blocking_or_major_finding',
        deliveryMode,
        `Open ${finding.severity} finding ${finding.finding_id} prevents readiness.`,
        [finding.evidence_path],
      ));
    }
  }
  for (const stale of staleEvidence.filter((entry) => entry.active !== false)) {
    for (const deliveryMode of stale.delivery_modes ?? (
      stale.kind === 'home_trial'
        ? ['homeschool']
        : stale.kind === 'classroom_trial'
          ? ['classroom']
          : ['classroom', 'homeschool']
    )) {
      blockers.push(blocker(
        'stale_human_evidence',
        deliveryMode,
        `Stale ${stale.kind} evidence cannot support current readiness.`,
        [stale.evidence_path],
      ));
    }
  }
  const sortedBlockers = blockers.sort((left, right) => (
    compareBytewise(left.delivery_mode, right.delivery_mode)
    || compareBytewise(left.code, right.code)
    || compareBytewise(left.message, right.message)
  ));
  const classroomReady = sortedBlockers.every(
    (entry) => !['classroom', 'both'].includes(entry.delivery_mode),
  );
  const homeschoolReady = sortedBlockers.every(
    (entry) => !['homeschool', 'both'].includes(entry.delivery_mode),
  );
  const scopedStates = (kind, deliveryMode) => activeStates.filter((state) => (
    state.artifact?.data?.artifact_type === kind
    && state.deliveryScopes.includes(deliveryMode)
  ));
  const allStates = evidenceSummary.evidence_states ?? [];
  const staleFor = (kind, deliveryMode) => allStates.filter((state) => (
    state.artifact?.data?.artifact_type === kind
    && state.deliveryScopes.includes(deliveryMode)
    && state.stale
  )).length;
  const classroomReviews = scopedStates('teacher_review', 'classroom');
  const homeschoolReviews = scopedStates('teacher_review', 'homeschool');
  const activeTeacherReviews = activeStates.filter(
    (state) => state.artifact?.data?.artifact_type === 'teacher_review',
  );
  const activeClassroomTrials = activeStates.filter(
    (state) => state.artifact?.data?.artifact_type === 'classroom_trial',
  );
  const activeHomeTrials = activeStates.filter(
    (state) => state.artifact?.data?.artifact_type === 'home_trial',
  );
  const allClassroomReviews = allStates.filter((state) => (
    state.artifact?.data?.artifact_type === 'teacher_review'
    && state.deliveryScopes.includes('classroom')
  ));
  const allHomeschoolReviews = allStates.filter((state) => (
    state.artifact?.data?.artifact_type === 'teacher_review'
    && state.deliveryScopes.includes('homeschool')
  ));
  return {
    materials: {
      resolved: materialsResolved && thematicMaterialsResolved,
      print_ready: printReady,
      homeschool_closure_resolved: homeschoolClosureResolved,
    },
    teacher_review: statusSummary(
      evidenceSummary.review_aggregate_status
        ?? pack.pedagogical_review.status,
      evidenceSummary.effective_teacher_review,
      activeStates.length > 0
        ? activeTeacherReviews.filter((state) => state.current && state.complete).length
        : evidenceSummary.effective_teacher_review_count,
      evidenceSummary.stale_teacher_review_count,
      evidenceSummary.teacher_review_paths,
    ),
    classroom_review: statusSummary(
      evidenceSummary.review_classroom_status
        ?? pack.pedagogical_review.classroom_status
        ?? 'pending',
      evidenceSummary.effective_classroom_review,
      activeStates.length > 0
        ? classroomReviews.filter((state) => state.current && state.complete).length
        : evidenceSummary.effective_classroom_review_count,
      allStates.length > 0
        ? staleFor('teacher_review', 'classroom')
        : evidenceSummary.stale_teacher_review_count,
      allClassroomReviews.map((state) => state.artifact.file),
    ),
    homeschool_review: statusSummary(
      evidenceSummary.review_homeschool_status
        ?? pack.pedagogical_review.homeschool_status
        ?? 'pending',
      evidenceSummary.effective_homeschool_review,
      activeStates.length > 0
        ? homeschoolReviews.filter((state) => state.current && state.complete).length
        : evidenceSummary.effective_homeschool_review_count,
      allStates.length > 0
        ? staleFor('teacher_review', 'homeschool')
        : evidenceSummary.stale_teacher_review_count,
      allHomeschoolReviews.map((state) => state.artifact.file),
    ),
    classroom_trial: statusSummary(
      evidenceSummary.classroom_trial_status ?? pack.classroom_trial.status,
      evidenceSummary.effective_classroom_trial,
      activeStates.length > 0
        ? activeClassroomTrials.filter((state) => state.current && state.complete).length
        : evidenceSummary.effective_classroom_trial_count,
      evidenceSummary.stale_classroom_trial_count,
      evidenceSummary.classroom_trial_paths,
    ),
    home_trial: statusSummary(
      evidenceSummary.home_trial_status ?? pack.home_trial.status,
      evidenceSummary.effective_home_trial,
      activeStates.length > 0
        ? activeHomeTrials.filter((state) => state.current && state.complete).length
        : evidenceSummary.effective_home_trial_count,
      evidenceSummary.stale_home_trial_count,
      evidenceSummary.home_trial_paths,
    ),
    open_findings: openFindings,
    stale_evidence: staleEvidence,
    classroom_ready: classroomReady,
    homeschool_ready: homeschoolReady,
    effectiveness_claimed: false,
    blockers: sortedBlockers,
    ...audit,
  };
}

export async function buildPedagogicalReadinessReport({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  packPath = 'teacher-packs/grade-5-science/water/materials-index.yaml',
  reportId = PEDAGOGICAL_READINESS_REPORT_ID,
  reviewContext: suppliedReviewContext = null,
  qualityRepository: suppliedQualityRepository = null,
} = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const absoluteBaseline = path.resolve(baselineRootDir);
  const identityCommitSha = await resolveCurrentCommitSha(absoluteBaseline);
  const [reviewContext, qualityRepository] = await Promise.all([
    suppliedReviewContext === null
      ? loadPedagogicalReviewRepository({
        rootDir: absoluteRoot,
        identityCommitSha,
      })
      : Promise.resolve(suppliedReviewContext),
    suppliedQualityRepository === null
      ? loadWaterPilotPedagogyQualityRepository({
        rootDir: absoluteRoot,
        baselineRootDir: absoluteBaseline,
      })
      : Promise.resolve(suppliedQualityRepository),
  ]);
  const index = reviewContext.teacherPacks.indexes.find(
    (artifact) => artifact.file === packPath,
  );
  if (!index) throw new Error(`readiness teacher pack not found: ${packPath}`);
  if (!reviewContext.currentEvidenceIdentities[index.data.pack_id]) {
    throw reviewContext.packIdentityErrors[index.data.pack_id]
      ?? new Error(`no pedagogical identity for ${index.data.pack_id}`);
  }
  const repositoryValidation = validatePedagogicalReviewRepository(reviewContext);
  const repositoryErrors = repositoryValidation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (repositoryErrors.length > 0) {
    const error = new Error(
      `pedagogical review repository is invalid: ${
        repositoryErrors.map(
          (item) => `${item.file} ${item.field}: ${item.reason}`,
        ).join('; ')
      }`,
    );
    error.code = 'pedagogical_review_repository_invalid';
    throw error;
  }
  const evidenceSummary = await summarizePedagogicalEvidenceForPack(
    reviewContext,
    index,
  );
  const quality = evaluatePedagogyQuality(qualityRepository);
  const integratedKinds = new Set([
    'integrated_lesson',
    'homeschool_package',
    'teacher_pack',
    'thematic_plan',
  ]);
  const integratedRecords = quality.records.filter(
    (record) => integratedKinds.has(record.kind),
  );
  const integratedRecordKeys = new Set(integratedRecords.map(
    (record) => `${record.artifact_path}\0${record.record_id}`,
  ));
  const integratedResults = quality.results.filter(
    (result) => integratedRecordKeys.has(
      `${result.artifact_path}\0${result.record_id}`,
    ),
  );
  const integratedDiagnostics = quality.diagnostics.filter(
    (diagnostic) => integratedRecordKeys.has(
      `${diagnostic.artifact_path}\0${diagnostic.record_id}`,
    ),
  );
  const integratedStructural = integratedResults.filter(
    (result) => result.gate_id === 'structural-completeness',
  );
  const integratedSchema = integratedResults.filter(
    (result) => result.gate_id === 'schema-valid',
  );
  const homeClosureResults = integratedResults.filter(
    (result) => result.gate_id === 'material-closure-resolved',
  );
  const thematic = reviewContext.teacherPacks.plans.artifacts.find(
    (artifact) => artifact.data?.unit_id === index.data.unit_ref,
  );
  const structuralQuality = {
    pedagogy_schema_valid: integratedSchema.length > 0
      && integratedSchema.every((result) => (
        result.status === 'passed' || result.status === 'excepted'
      )),
    structurally_complete: integratedStructural.length > 0
      && integratedStructural.every((result) => (
        result.status === 'passed' || result.status === 'excepted'
      )),
    errors: integratedDiagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    ).length,
    warnings: integratedDiagnostics.filter(
      (diagnostic) => diagnostic.severity === 'warning',
    ).length,
    materials_resolved: index.data.pedagogical_integration !== undefined,
    pack_materials_resolved: thematic?.data?.teacher_pack?.materials_resolved === true,
    pack_print_ready: thematic?.data?.teacher_pack?.print_ready === true,
  };
  const currentIdentity = reviewContext.currentEvidenceIdentities[index.data.pack_id];
  const openFindings = evidenceFindingSummaries(evidenceSummary);
  const audit = evidenceAudit(evidenceSummary);
  const staleEvidence = audit.stale_evidence;
  const readiness = evaluatePedagogicalReadiness({
    index,
    evidenceSummary,
    structuralQuality,
    homeschoolClosureResolved: homeClosureResults.length > 0
      && homeClosureResults.every((result) => (
        result.status === 'passed' || result.status === 'excepted'
      )),
    openFindings,
    staleEvidence,
    audit,
  });
  const checkedArtifacts = uniqueSorted([
    qualityRepository.cataloguePath,
    qualityRepository.exceptionsPath,
    ...integratedRecords.flatMap(
      (record) => [record.artifact_path, ...(record.checked_artifacts ?? [])],
    ),
    ...(reviewContext.currentEvidenceCheckedArtifacts[index.data.pack_id] ?? []),
    ...Object.values(reviewContext.schemas).map((schema) => (
      `schemas/${schema.$id.split('/').at(-1)}`
    )),
    index.data.pedagogical_review?.template_path,
    index.data.pedagogical_review?.guide_path,
    index.data.classroom_trial?.template_path,
    index.data.home_trial?.template_path,
    ...evidenceSummary.evidence_paths,
    packPath,
  ]);
  return {
    schema_version: '1.0',
    artifact_type: 'pedagogical_readiness_report',
    report_id: reportId,
    pack_ref: index.data.pack_id,
    current_content_fingerprint: currentIdentity.content_fingerprint,
    current_pedagogical_snapshot: currentIdentity.pedagogical_snapshot,
    structural_quality: {
      pedagogy_schema_valid: structuralQuality.pedagogy_schema_valid,
      structurally_complete: structuralQuality.structurally_complete,
      errors: structuralQuality.errors,
      warnings: structuralQuality.warnings,
    },
    ...readiness,
    evidence_paths: evidenceSummary.evidence_paths,
    checked_artifacts: checkedArtifacts,
    non_guarantees: [...NON_GUARANTEES].sort(compareBytewise),
    determinism: {
      no_ai: true,
      no_network: true,
      no_randomness: true,
      no_current_timestamps: true,
      ordering: 'bytewise',
    },
  };
}

export function serializePedagogicalReadinessReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export async function createPedagogicalReadinessReportValidator(rootDir = process.cwd()) {
  const commonSchemaPath = 'schemas/pedagogical-evidence-common.schema.json';
  const [schemaText, commonText] = await Promise.all([
    fs.readFile(
      safeRepositoryPath(rootDir, PEDAGOGICAL_READINESS_SCHEMA_PATH, 'readiness schema'),
      'utf8',
    ),
    fs.readFile(
      safeRepositoryPath(
        rootDir,
        commonSchemaPath,
        'evidence common schema',
      ),
      'utf8',
    ),
  ]);
  const schema = parseStrictPedagogicalEvidenceJson(
    schemaText,
    PEDAGOGICAL_READINESS_SCHEMA_PATH,
  );
  const common = parseStrictPedagogicalEvidenceJson(
    commonText,
    commonSchemaPath,
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(common);
  return ajv.compile(schema);
}

export async function checkPedagogicalReadinessReport({
  rootDir = process.cwd(),
  reportPath = PEDAGOGICAL_READINESS_REPORT_PATH,
} = {}) {
  const report = await buildPedagogicalReadinessReport({ rootDir });
  const validator = await createPedagogicalReadinessReportValidator(rootDir);
  if (!validator(report)) {
    throw new Error(`readiness report schema invalid: ${JSON.stringify(validator.errors)}`);
  }
  const expected = serializePedagogicalReadinessReport(report);
  const actual = await fs.readFile(
    safeRepositoryPath(rootDir, reportPath, 'readiness report path'),
    'utf8',
  );
  if (actual !== expected) {
    const error = new Error(`pedagogical readiness report is stale: ${reportPath}`);
    error.code = 'pedagogical_readiness_report_stale';
    throw error;
  }
  return report;
}

export async function writePedagogicalReadinessReport({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  reportPath = PEDAGOGICAL_READINESS_REPORT_PATH,
} = {}) {
  const report = await buildPedagogicalReadinessReport({
    rootDir,
    baselineRootDir,
  });
  const validator = await createPedagogicalReadinessReportValidator(rootDir);
  if (!validator(report)) {
    throw new Error(`readiness report schema invalid: ${JSON.stringify(validator.errors)}`);
  }
  const absolute = safeRepositoryPath(rootDir, reportPath, 'readiness report path');
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, serializePedagogicalReadinessReport(report));
  return report;
}
