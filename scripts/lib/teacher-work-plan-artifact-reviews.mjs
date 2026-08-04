import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

import {
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './teacher-work-plan-reusable-artifacts.mjs';

export const ARTIFACT_REVIEW_SCHEMA_PATH =
  'schemas/teacher-work-plan-artifact-review.schema.json';
export const SOIL_ORGANISMS_REVIEW_ROOT =
  'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews';
export const REVIEW_REGISTRY_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/review-registry.yaml`;

const PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const ARTIFACT_INDEX_PATH = `${PILOT_ROOT}/artifact-index.yaml`;
const REVIEW_GUIDE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/review-guide.md`;
const TEACHER_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/teacher-review-template.yaml`;
const SAFETY_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/local-safety-review-template.yaml`;
const CLASSROOM_TRIAL_GUIDE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/classroom-trial-guide.md`;
const CLASSROOM_TRIAL_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/classroom-trial-template.yaml`;
const ARTIFACT_ID = 'grade-6-science-soil-organisms';
const FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';

const BASE_REVIEW_FILES = Object.freeze([
  CLASSROOM_TRIAL_GUIDE_PATH,
  CLASSROOM_TRIAL_TEMPLATE_PATH,
  REVIEW_GUIDE_PATH,
  SAFETY_TEMPLATE_PATH,
  REVIEW_REGISTRY_PATH,
  TEACHER_TEMPLATE_PATH,
].sort(compareBytewise));

const TEACHER_SCOPE = Object.freeze([
  'scientific_accuracy',
  'age_appropriateness',
  'instructional_clarity',
  'practical_feasibility',
  'assessment_alignment',
  'russian_explanation_quality',
  'estonian_language_support',
  'accessibility_and_differentiation',
  'source_and_provenance_boundaries',
  'readiness_claims',
]);

const SAFETY_SCOPE = Object.freeze([
  'school_or_site_context',
  'exact_observation_locations',
  'weather_and_terrain',
  'restricted_or_protected_area_permissions',
  'hazardous_objects_and_waste',
  'organisms_and_allergy_risks',
  'tools_and_gloves',
  'hygiene_and_handwashing',
  'accessibility_and_participation',
  'supervision_and_stop_signals',
  'indoor_fallback',
  'emergency_or_incident_procedure',
  'restoration_and_ethical_return',
]);

const GUIDE_HEADINGS = Object.freeze([
  '## 1. Purpose and boundaries',
  '## 2. Exact artifact and fingerprint',
  '## 3. Files under review',
  '## 4. Teacher-review procedure',
  '## 5. Local-safety-review procedure',
  '## 6. Finding severity definitions',
  '## 7. Approval rules',
  '## 8. Fingerprint invalidation',
  '## 9. Required-change workflow',
  '## 10. Classroom-trial boundary',
  '## 11. Prohibited claims',
  '## 12. How to create a completed record',
]);

const ARTIFACT_IDENTITY = Object.freeze({
  artifact_id: ARTIFACT_ID,
  artifact_index_path: ARTIFACT_INDEX_PATH,
  content_fingerprint: FINGERPRINT,
  package_id: ARTIFACT_ID,
  route: 'grade-6-science',
  grade: 6,
  subject: 'science',
  subject_et: 'loodusõpetus',
});

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(file, field, reason) {
  return { file, field: field || '/', reason };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function safeRepositoryPath(rootDir, repositoryPath) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) throw new Error(`unsafe repository path: ${repositoryPath}`);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`repository path escapes root: ${repositoryPath}`);
  }
  return resolved;
}

function insideReviewRoot(repositoryPath) {
  return repositoryPath === SOIL_ORGANISMS_REVIEW_ROOT
    || repositoryPath.startsWith(`${SOIL_ORGANISMS_REVIEW_ROOT}/`);
}

function insidePilotRoot(repositoryPath) {
  return repositoryPath.startsWith(`${PILOT_ROOT}/`);
}

function parseStrictYaml(text, file) {
  if (text.includes('\t')) throw new Error(`${file}: invalid YAML: tabs are forbidden`);
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`${file}: invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.anchors?.size > 0 || /(?:^|\s)[&*][A-Za-z0-9_-]+/mu.test(text)) {
    throw new Error(`${file}: YAML aliases and anchors are forbidden`);
  }
  return document.toJS({ maxAliasCount: 0 });
}

async function walkFiles(rootDir, repositoryDirectory) {
  const absolute = safeRepositoryPath(rootDir, repositoryDirectory);
  const files = [];
  async function visit(directory, prefix) {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries.sort((a, b) => compareBytewise(a.name, b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), relative);
      else if (entry.isFile()) files.push(`${repositoryDirectory}/${relative}`);
      else files.push(`${repositoryDirectory}/${relative}`);
    }
  }
  await visit(absolute, '');
  return files.sort(compareBytewise);
}

async function readYaml(rootDir, repositoryPath, overrides, loadDiagnostics) {
  try {
    const text = overrides.has(repositoryPath)
      ? overrides.get(repositoryPath)
      : await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8');
    return { file: repositoryPath, text, data: parseStrictYaml(text, repositoryPath) };
  } catch (error) {
    loadDiagnostics.push(diagnostic(repositoryPath, '/', error.message));
    return null;
  }
}

async function readCompletedRecords(rootDir, paths, overrides, loadDiagnostics) {
  const records = [];
  for (const repositoryPath of paths ?? []) {
    if (!insideReviewRoot(repositoryPath)) {
      loadDiagnostics.push(diagnostic(repositoryPath, '/', 'completed review path must remain inside the review root'));
      continue;
    }
    const loaded = await readYaml(rootDir, repositoryPath, overrides, loadDiagnostics);
    if (loaded) records.push(loaded);
  }
  return records;
}

export async function loadTeacherWorkPlanArtifactReviewRepository({
  rootDir = process.cwd(),
  fileOverrides = new Map(),
  reusableRepository = null,
  reviewDirectoryFiles = null,
} = {}) {
  const root = path.resolve(rootDir);
  const loadDiagnostics = [];
  const registry = await readYaml(root, REVIEW_REGISTRY_PATH, fileOverrides, loadDiagnostics);
  const teacherTemplatePath = registry?.data?.teacher_review?.template_path ?? TEACHER_TEMPLATE_PATH;
  const safetyTemplatePath = registry?.data?.local_safety_review?.template_path ?? SAFETY_TEMPLATE_PATH;
  const trialTemplatePath = registry?.data?.classroom_trial?.template_path ?? CLASSROOM_TRIAL_TEMPLATE_PATH;
  const [schema, teacherTemplate, safetyTemplate, guideText, files, resolvedReusableRepository] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, ARTIFACT_REVIEW_SCHEMA_PATH), 'utf8').then(JSON.parse),
    readYaml(root, teacherTemplatePath, fileOverrides, loadDiagnostics),
    readYaml(root, safetyTemplatePath, fileOverrides, loadDiagnostics),
    fs.readFile(safeRepositoryPath(root, REVIEW_GUIDE_PATH), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    }),
    reviewDirectoryFiles ?? walkFiles(root, SOIL_ORGANISMS_REVIEW_ROOT),
    reusableRepository ?? loadTeacherWorkPlanReusableArtifactRepository({ rootDir: root }),
  ]);
  const [completedTeacherReviews, completedSafetyReviews, completedClassroomTrials] = await Promise.all([
    readCompletedRecords(root, registry?.data?.teacher_review?.completed_record_paths, fileOverrides, loadDiagnostics),
    readCompletedRecords(root, registry?.data?.local_safety_review?.completed_record_paths, fileOverrides, loadDiagnostics),
    readCompletedRecords(root, registry?.data?.classroom_trial?.completed_record_paths, fileOverrides, loadDiagnostics),
  ]);
  return {
    rootDir: root,
    schema,
    registry,
    teacherTemplate,
    safetyTemplate,
    completedTeacherReviews,
    completedSafetyReviews,
    completedClassroomTrials,
    trialTemplatePath,
    guideText,
    reviewDirectoryFiles: [...files].sort(compareBytewise),
    reusableRepository: resolvedReusableRepository,
    loadDiagnostics,
  };
}

function validateSchema(diagnostics, validate, entry) {
  if (!entry) return;
  if (!validate(entry.data)) {
    for (const error of validate.errors ?? []) {
      diagnostics.push(diagnostic(entry.file, error.instancePath || '/', schemaReason(error)));
    }
  }
}

function validateExact(diagnostics, file, field, actual, expected, reason) {
  if (!exactJson(actual, expected)) diagnostics.push(diagnostic(file, field, reason));
}

function validateTemplate(diagnostics, entry, expectedType, expectedScope) {
  if (!entry) return;
  const data = entry.data;
  if (data.artifact_type !== expectedType) {
    diagnostics.push(diagnostic(entry.file, '/artifact_type', `expected ${expectedType}`));
  }
  if (data.template !== true) diagnostics.push(diagnostic(entry.file, '/template', 'review template must remain template: true'));
  for (const [field, value] of Object.entries(data.review_identity ?? {})) {
    if (value !== null) diagnostics.push(diagnostic(entry.file, `/review_identity/${field}`, 'reviewer identity must not be invented in a template'));
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, ARTIFACT_IDENTITY, 'template must pin the exact pilot identity and current fingerprint');
  validateExact(diagnostics, entry.file, '/review_scope/area', (data.review_scope ?? []).map(({ area }) => area), expectedScope, 'review scope must contain the exact required areas in order');
  for (const [index, item] of (data.review_scope ?? []).entries()) {
    if (item.status !== 'not_reviewed' || item.notes !== null || (item.finding_ids ?? []).length !== 0) {
      diagnostics.push(diagnostic(entry.file, `/review_scope/${index}`, 'template scope must remain not_reviewed with no notes or findings'));
    }
  }
  if ((data.findings ?? []).length !== 0) diagnostics.push(diagnostic(entry.file, '/findings', 'template cannot contain findings'));
  if (data.decision?.status !== 'pending') diagnostics.push(diagnostic(entry.file, '/decision/status', 'approval is invalid while template: true'));
  if (data.decision?.rationale !== null
    || data.decision?.required_changes_complete !== false
    || data.decision?.reviewed_fingerprint_matches !== false
    || (data.decision?.open_blocking_findings ?? []).length !== 0
    || (data.decision?.open_major_findings ?? []).length !== 0) {
    diagnostics.push(diagnostic(entry.file, '/decision', 'template decision must remain empty, pending and unmatched to a reviewed fingerprint'));
  }
}

function validateFindingsAndDecision(diagnostics, entry, { safety = false } = {}) {
  const data = entry.data;
  const findingIds = (data.findings ?? []).map(({ finding_id }) => finding_id);
  if (new Set(findingIds).size !== findingIds.length) {
    diagnostics.push(diagnostic(entry.file, '/findings', 'finding IDs must be unique'));
  }
  const findingsById = new Map((data.findings ?? []).map((finding) => [finding.finding_id, finding]));
  for (const [index, scope] of (data.review_scope ?? []).entries()) {
    for (const findingId of scope.finding_ids ?? []) {
      if (!findingsById.has(findingId)) diagnostics.push(diagnostic(entry.file, `/review_scope/${index}/finding_ids`, `unknown finding ${findingId}`));
    }
  }
  for (const [index, finding] of (data.findings ?? []).entries()) {
    for (const affectedPath of finding.affected_paths ?? []) {
      if (!insidePilotRoot(affectedPath)) diagnostics.push(diagnostic(entry.file, `/findings/${index}/affected_paths`, 'affected paths must remain inside the pilot root'));
    }
    if (finding.status === 'resolved' && !finding.resolution_notes) {
      diagnostics.push(diagnostic(entry.file, `/findings/${index}/resolution_notes`, 'resolved finding requires resolution notes'));
    }
  }
  const openBlocking = (data.findings ?? [])
    .filter(({ severity, status }) => severity === 'blocking' && status === 'open')
    .map(({ finding_id }) => finding_id);
  const openMajor = (data.findings ?? [])
    .filter(({ severity, status }) => severity === 'major' && status === 'open')
    .map(({ finding_id }) => finding_id);
  validateExact(diagnostics, entry.file, '/decision/open_blocking_findings', data.decision?.open_blocking_findings, openBlocking, 'decision must list every open blocking finding in source order');
  validateExact(diagnostics, entry.file, '/decision/open_major_findings', data.decision?.open_major_findings, openMajor, 'decision must list every open major finding in source order');
  const approved = safety
    ? ['approved_for_named_context', 'approved_with_conditions'].includes(data.decision?.status)
    : ['approved', 'approved_with_nonblocking_changes'].includes(data.decision?.status);
  if (approved && (openBlocking.length > 0 || openMajor.length > 0)) {
    diagnostics.push(diagnostic(entry.file, '/decision/status', 'approval cannot coexist with an open blocking or major finding'));
  }
  const unresolvedRequired = (data.findings ?? []).filter((finding) => (
    finding.required_change !== null && finding.status === 'open'
  ));
  if (approved && (data.decision?.required_changes_complete !== true || unresolvedRequired.length > 0)) {
    diagnostics.push(diagnostic(entry.file, '/decision/required_changes_complete', 'approval requires all required changes to be complete'));
  }
  if (safety && data.decision?.status === 'approved_with_conditions' && (data.decision.conditions ?? []).length === 0) {
    diagnostics.push(diagnostic(entry.file, '/decision/conditions', 'approved_with_conditions requires explicit conditions'));
  }
}

function validateCompletedRecord(diagnostics, entry, { safety = false } = {}) {
  if (!entry) return;
  const data = entry.data;
  if (data.template !== false) diagnostics.push(diagnostic(entry.file, '/template', 'completed record must set template: false'));
  for (const field of ['review_id', 'reviewer_id', 'reviewer_name', 'reviewer_role', 'review_date']) {
    if (data.review_identity?.[field] === null || data.review_identity?.[field] === undefined) {
      diagnostics.push(diagnostic(entry.file, `/review_identity/${field}`, 'completed record requires actual reviewer identity and date'));
    }
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, ARTIFACT_IDENTITY, 'completed review must match the current pilot fingerprint and identity');
  if (data.decision?.reviewed_fingerprint_matches !== true) diagnostics.push(diagnostic(entry.file, '/decision/reviewed_fingerprint_matches', 'completed review must confirm the current fingerprint'));
  if (data.decision?.status === 'pending') diagnostics.push(diagnostic(entry.file, '/decision/status', 'completed review decision cannot remain pending'));
  for (const [index, scope] of (data.review_scope ?? []).entries()) {
    if (scope.status === 'not_reviewed') diagnostics.push(diagnostic(entry.file, `/review_scope/${index}/status`, 'completed record must review every required scope item'));
  }
  if (safety) {
    for (const [field, value] of Object.entries(data.local_context ?? {})) {
      if (value === null) diagnostics.push(diagnostic(entry.file, `/local_context/${field}`, 'local safety review requires an exact named context'));
    }
    const boundary = data.safety_boundaries ?? {};
    if (boundary.named_context_only !== true
      || boundary.universal_safety_claimed !== false
      || boundary.other_site_legal_permission_claimed !== false
      || boundary.all_weather_approval_claimed !== false
      || boundary.protected_area_permission_claimed !== false
      || boundary.classroom_readiness_claimed !== false) {
      diagnostics.push(diagnostic(entry.file, '/safety_boundaries', 'local safety approval must remain context-specific and cannot imply universal safety, permission or readiness'));
    }
  }
  validateFindingsAndDecision(diagnostics, entry, { safety });
}

function expectedRegistryState(registry, completedTeacherReviews, completedSafetyReviews, completedClassroomTrials) {
  const lastTeacher = completedTeacherReviews.at(-1)?.data;
  const lastSafety = completedSafetyReviews.at(-1)?.data;
  const activeTrial = [...completedClassroomTrials]
    .reverse()
    .find(({ data }) => data.lifecycle?.status === 'analysed')?.data;
  const trialStatus = activeTrial?.decision?.status ?? 'not_tested';
  return {
    teacherStatus: lastTeacher?.decision?.status ?? 'pending',
    safetyStatus: lastSafety?.decision?.status ?? 'pending',
    reviewComplete: completedTeacherReviews.length > 0,
    safetyComplete: completedSafetyReviews.length > 0,
    trialStatus,
    trialComplete: Boolean(activeTrial),
    classroomReady: ['successful', 'successful_with_notes'].includes(trialStatus),
  };
}

export function validateTeacherWorkPlanArtifactReviewRepository(repository, {
  allowCompletedRecords = false,
} = {}) {
  const diagnostics = [...(repository.loadDiagnostics ?? [])];
  const reusableValidation = validateTeacherWorkPlanReusableArtifactRepository(repository.reusableRepository);
  for (const problem of reusableValidation.diagnostics) {
    if (allowCompletedRecords && (
      problem.file === REVIEW_REGISTRY_PATH
      || (problem.file === ARTIFACT_INDEX_PATH && problem.field === '/human_review')
    )) continue;
    diagnostics.push(diagnostic(problem.file, problem.field, `reusable-artifact dependency: ${problem.reason}`));
  }

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    validateFormats: false,
  });
  const validate = ajv.compile(repository.schema);
  for (const entry of [
    repository.registry,
    repository.teacherTemplate,
    repository.safetyTemplate,
    ...repository.completedTeacherReviews,
    ...repository.completedSafetyReviews,
  ]) validateSchema(diagnostics, validate, entry);

  const registry = repository.registry?.data;
  if (!registry) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'exact review registry is missing'));
  else {
    if (!allowCompletedRecords && !exactJson(registry, repository.reusableRepository.reviewRegistry?.data)) {
      diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'review registry differs from the registry validated by the reusable artifact dependency'));
    }
    if (registry.artifact_id !== ARTIFACT_ID) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/artifact_id', 'wrong artifact ID'));
    if (registry.artifact_index_path !== ARTIFACT_INDEX_PATH) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/artifact_index_path', 'wrong artifact index path'));
    if (registry.content_fingerprint !== FINGERPRINT) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/content_fingerprint', 'review registry fingerprint is stale'));
    if (registry.teacher_review?.template_path !== TEACHER_TEMPLATE_PATH) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/teacher_review/template_path', 'wrong teacher-review template path'));
    if (registry.local_safety_review?.template_path !== SAFETY_TEMPLATE_PATH) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/local_safety_review/template_path', 'wrong local-safety-review template path'));
    if (registry.classroom_trial?.template_path !== CLASSROOM_TRIAL_TEMPLATE_PATH) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/classroom_trial/template_path', 'wrong classroom-trial template path'));
    for (const repositoryPath of [
      registry.teacher_review?.template_path,
      registry.local_safety_review?.template_path,
      registry.classroom_trial?.template_path,
      ...(registry.teacher_review?.completed_record_paths ?? []),
      ...(registry.local_safety_review?.completed_record_paths ?? []),
      ...(registry.classroom_trial?.completed_record_paths ?? []),
    ]) {
      if (!insideReviewRoot(repositoryPath)) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'all review paths must remain inside the exact review root'));
    }
  }

  validateTemplate(diagnostics, repository.teacherTemplate, 'teacher_work_plan_artifact_teacher_review', TEACHER_SCOPE);
  validateTemplate(diagnostics, repository.safetyTemplate, 'teacher_work_plan_artifact_local_safety_review', SAFETY_SCOPE);
  if (!repository.teacherTemplate) diagnostics.push(diagnostic(TEACHER_TEMPLATE_PATH, '/', 'teacher-review template is missing'));
  if (!repository.safetyTemplate) diagnostics.push(diagnostic(SAFETY_TEMPLATE_PATH, '/', 'local-safety-review template is missing'));
  if ((repository.safetyTemplate?.data?.decision?.conditions ?? []).length !== 0) diagnostics.push(diagnostic(SAFETY_TEMPLATE_PATH, '/decision/conditions', 'safety template cannot contain approval conditions'));
  for (const entry of repository.completedTeacherReviews) validateCompletedRecord(diagnostics, entry);
  for (const entry of repository.completedSafetyReviews) validateCompletedRecord(diagnostics, entry, { safety: true });

  const registeredTeacherPaths = registry?.teacher_review?.completed_record_paths ?? [];
  const registeredSafetyPaths = registry?.local_safety_review?.completed_record_paths ?? [];
  const registeredTrialPaths = registry?.classroom_trial?.completed_record_paths ?? [];
  validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/teacher_review/completed_record_paths', repository.completedTeacherReviews.map(({ file }) => file), registeredTeacherPaths, 'every completed teacher review must be loaded exactly once');
  validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/local_safety_review/completed_record_paths', repository.completedSafetyReviews.map(({ file }) => file), registeredSafetyPaths, 'every completed safety review must be loaded exactly once');
  validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/classroom_trial/completed_record_paths', repository.completedClassroomTrials.map(({ file }) => file), registeredTrialPaths, 'every completed classroom trial must be loaded exactly once');
  if (!allowCompletedRecords && (registeredTeacherPaths.length > 0 || registeredSafetyPaths.length > 0 || registeredTrialPaths.length > 0)) {
    diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/', 'production review registry must contain no completed review records before real human evidence is supplied'));
  }

  const state = expectedRegistryState(registry, repository.completedTeacherReviews, repository.completedSafetyReviews, repository.completedClassroomTrials);
  if (registry?.teacher_review?.status !== state.teacherStatus) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/teacher_review/status', 'teacher status must be derived from registered human evidence, not PR or merge state'));
  if (registry?.local_safety_review?.status !== state.safetyStatus) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/local_safety_review/status', 'safety status must be derived from registered local evidence'));
  if (registry?.boundaries?.review_complete !== state.reviewComplete) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/review_complete', 'review completion must reflect registered completed teacher records'));
  if (registry?.boundaries?.local_safety_review_complete !== state.safetyComplete) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/local_safety_review_complete', 'local safety completion must reflect registered completed safety records'));
  if (registry?.classroom_trial?.status !== state.trialStatus) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/classroom_trial/status', 'classroom-trial status must be derived from registered analysed evidence, not PR or merge state'));
  if (registry?.boundaries?.classroom_trial_workflow_created !== true) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/classroom_trial_workflow_created', 'classroom-trial workflow must be explicitly registered'));
  if (registry?.boundaries?.classroom_trial_complete !== state.trialComplete) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/classroom_trial_complete', 'classroom-trial completion must reflect a registered analysed record'));
  if (registry?.boundaries?.classroom_ready !== state.classroomReady) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/classroom_ready', 'classroom readiness must follow a positive analysed trial and cannot be inferred from PR state'));
  for (const flag of ['publication_ready', 'customer_released', 'effectiveness_claimed']) {
    if (registry?.boundaries?.[flag] !== false) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, `/boundaries/${flag}`, `${flag} cannot be promoted by review workflow creation`));
  }

  if (repository.guideText === null) diagnostics.push(diagnostic(REVIEW_GUIDE_PATH, '/', 'review guide is missing'));
  else {
    if (!repository.guideText.endsWith('\n')) diagnostics.push(diagnostic(REVIEW_GUIDE_PATH, '/', 'review guide must end with a newline'));
    for (const heading of GUIDE_HEADINGS) {
      if (!repository.guideText.includes(heading)) diagnostics.push(diagnostic(REVIEW_GUIDE_PATH, '/', `review guide is missing ${heading}`));
    }
    for (const statement of [
      'A template is not human evidence.',
      'does not approve the pilot',
      'Any byte change',
      'Local safety approval is limited to the named context.',
      'Classroom trial remains',
      'Never use PR authorship',
    ]) {
      if (!repository.guideText.includes(statement)) diagnostics.push(diagnostic(REVIEW_GUIDE_PATH, '/', `review guide is missing boundary statement: ${statement}`));
    }
  }

  const expectedFiles = [
    ...BASE_REVIEW_FILES,
    ...registeredTeacherPaths,
    ...registeredSafetyPaths,
    ...registeredTrialPaths,
  ].sort(compareBytewise);
  validateExact(diagnostics, SOIL_ORGANISMS_REVIEW_ROOT, '/', repository.reviewDirectoryFiles, expectedFiles, 'review directory contains a missing or extra file');

  const artifact = repository.reusableRepository.artifacts?.[0]?.data;
  if (artifact?.content_fingerprint?.value !== FINGERPRINT) diagnostics.push(diagnostic(ARTIFACT_INDEX_PATH, '/content_fingerprint/value', 'review workflow must pin the unchanged material fingerprint'));
  if (!allowCompletedRecords) {
    validateExact(diagnostics, ARTIFACT_INDEX_PATH, '/human_review', artifact?.human_review, {
      registry_path: REVIEW_REGISTRY_PATH,
      teacher_review: { status: 'pending', completed_record_path: null },
      local_safety_review: { status: 'pending', completed_record_path: null },
      classroom_trial: {
        workflow_created: true,
        template_path: CLASSROOM_TRIAL_TEMPLATE_PATH,
        status: 'not_tested',
        completed_record_path: null,
      },
      reviewed_content_fingerprint: null,
    }, 'artifact index must link the pending review registry without claiming completed evidence');
  }

  diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  return {
    diagnostics,
    summary: {
      review_registries: registry ? 1 : 0,
      teacher_review_templates: repository.teacherTemplate ? 1 : 0,
      local_safety_review_templates: repository.safetyTemplate ? 1 : 0,
      completed_teacher_reviews: repository.completedTeacherReviews.length,
      completed_safety_reviews: repository.completedSafetyReviews.length,
      classroom_trial_templates: registry?.classroom_trial?.template_path ? 1 : 0,
      completed_classroom_trials: repository.completedClassroomTrials.length,
      teacher_status: registry?.teacher_review?.status ?? null,
      safety_status: registry?.local_safety_review?.status ?? null,
      classroom_trial: registry?.classroom_trial?.status ?? null,
      fingerprint: registry?.content_fingerprint ?? null,
    },
  };
}

export function formatTeacherWorkPlanArtifactReviewDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}
