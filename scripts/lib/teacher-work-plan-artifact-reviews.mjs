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

function pathsForProfile(profile) {
  return {
    reviewRoot: profile.review.rootPath,
    registryPath: profile.review.registryPath,
    guidePath: profile.review.guidePath,
    teacherTemplatePath: profile.review.teacherTemplatePath,
    safetyTemplatePath: profile.review.safetyTemplatePath,
    trialGuidePath: profile.review.trialGuidePath,
    trialTemplatePath: profile.review.trialTemplatePath,
    artifactRoot: profile.rootPath,
    indexPath: profile.indexPath,
  };
}

function artifactIdentity(profile) {
  return {
    artifact_id: profile.artifactId,
    artifact_index_path: profile.indexPath,
    content_fingerprint: profile.fingerprint,
    package_id: profile.packageId,
    route: profile.route,
    grade: profile.identity.grade,
    subject: profile.identity.subject,
    subject_et: profile.identity.subjectEt,
  };
}

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

function insideReviewRoot(repositoryPath, reviewRoot) {
  return repositoryPath === reviewRoot || repositoryPath.startsWith(`${reviewRoot}/`);
}

function insideArtifactRoot(repositoryPath, artifactRoot) {
  return repositoryPath.startsWith(`${artifactRoot}/`);
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

async function readCompletedRecords(rootDir, paths, reviewRoot, overrides, loadDiagnostics) {
  const records = [];
  for (const repositoryPath of paths ?? []) {
    if (!insideReviewRoot(repositoryPath, reviewRoot)) {
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
  artifactId = null,
  fileOverrides = new Map(),
  reusableRepository = null,
  reviewDirectoryFiles = null,
} = {}) {
  const root = path.resolve(rootDir);
  const loadDiagnostics = [];
  const resolvedReusableRepository = reusableRepository
    ?? await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: root, artifactOverrides: fileOverrides });
  const availableIds = [...resolvedReusableRepository.artifactById.keys()].sort(compareBytewise);
  const resolvedArtifactId = artifactId ?? (availableIds.length === 1 ? availableIds[0] : null);
  const artifactContext = resolvedArtifactId
    ? resolvedReusableRepository.artifactById.get(resolvedArtifactId)
    : null;
  if (!artifactContext) loadDiagnostics.push(diagnostic(
    ARTIFACT_REVIEW_SCHEMA_PATH,
    '/',
    resolvedArtifactId ? `unknown registered artifact ${resolvedArtifactId}` : 'artifactId is required when multiple reusable artifacts are registered',
  ));
  const profile = artifactContext?.profile;
  const paths = profile ? pathsForProfile(profile) : null;
  const registry = paths
    ? await readYaml(root, paths.registryPath, fileOverrides, loadDiagnostics)
    : null;
  const teacherTemplatePath = registry?.data?.teacher_review?.template_path ?? paths?.teacherTemplatePath;
  const safetyTemplatePath = registry?.data?.local_safety_review?.template_path ?? paths?.safetyTemplatePath;
  const trialTemplatePath = registry?.data?.classroom_trial?.template_path ?? paths?.trialTemplatePath;
  const [schema, teacherTemplate, safetyTemplate, guideText, files] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, ARTIFACT_REVIEW_SCHEMA_PATH), 'utf8').then(JSON.parse),
    teacherTemplatePath ? readYaml(root, teacherTemplatePath, fileOverrides, loadDiagnostics) : Promise.resolve(null),
    safetyTemplatePath ? readYaml(root, safetyTemplatePath, fileOverrides, loadDiagnostics) : Promise.resolve(null),
    paths ? fs.readFile(safeRepositoryPath(root, paths.guidePath), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    }) : Promise.resolve(null),
    reviewDirectoryFiles ?? (paths ? walkFiles(root, paths.reviewRoot) : Promise.resolve([])),
  ]);
  const [completedTeacherReviews, completedSafetyReviews, completedClassroomTrials] = await Promise.all([
    readCompletedRecords(root, registry?.data?.teacher_review?.completed_record_paths, paths?.reviewRoot ?? '', fileOverrides, loadDiagnostics),
    readCompletedRecords(root, registry?.data?.local_safety_review?.completed_record_paths, paths?.reviewRoot ?? '', fileOverrides, loadDiagnostics),
    readCompletedRecords(root, registry?.data?.classroom_trial?.completed_record_paths, paths?.reviewRoot ?? '', fileOverrides, loadDiagnostics),
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
    artifactId: resolvedArtifactId,
    artifactContext,
    profile,
    paths,
    loadDiagnostics,
  };
}

export async function loadTeacherWorkPlanArtifactReviewRepositories({
  rootDir = process.cwd(),
  fileOverrides = new Map(),
  reusableRepository = null,
  artifactIds = null,
} = {}) {
  const resolvedReusableRepository = reusableRepository
    ?? await loadTeacherWorkPlanReusableArtifactRepository({ rootDir, artifactOverrides: fileOverrides });
  const registeredIds = artifactIds ?? [...resolvedReusableRepository.artifactById.keys()];
  const repositories = [];
  for (const artifactId of [...registeredIds].sort(compareBytewise)) {
    const context = resolvedReusableRepository.artifactById.get(artifactId);
    if (!context?.registryEntry?.review_registry_path) continue;
    repositories.push(await loadTeacherWorkPlanArtifactReviewRepository({
      rootDir,
      artifactId,
      fileOverrides,
      reusableRepository: resolvedReusableRepository,
    }));
  }
  return { rootDir: path.resolve(rootDir), reusableRepository: resolvedReusableRepository, repositories };
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

function validateTemplate(diagnostics, entry, expectedType, expectedScope, expectedIdentity) {
  if (!entry) return;
  const data = entry.data;
  if (data.artifact_type !== expectedType) {
    diagnostics.push(diagnostic(entry.file, '/artifact_type', `expected ${expectedType}`));
  }
  if (data.template !== true) diagnostics.push(diagnostic(entry.file, '/template', 'review template must remain template: true'));
  for (const [field, value] of Object.entries(data.review_identity ?? {})) {
    if (value !== null) diagnostics.push(diagnostic(entry.file, `/review_identity/${field}`, 'reviewer identity must not be invented in a template'));
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, expectedIdentity, 'template must pin the registered artifact identity and current fingerprint');
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

function validateFindingsAndDecision(diagnostics, entry, { safety = false, artifactRoot } = {}) {
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
      if (!insideArtifactRoot(affectedPath, artifactRoot)) diagnostics.push(diagnostic(entry.file, `/findings/${index}/affected_paths`, 'affected paths must remain inside the registered artifact root'));
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

function validateCompletedRecord(diagnostics, entry, { safety = false, expectedIdentity, artifactRoot } = {}) {
  if (!entry) return;
  const data = entry.data;
  if (data.template !== false) diagnostics.push(diagnostic(entry.file, '/template', 'completed record must set template: false'));
  for (const field of ['review_id', 'reviewer_id', 'reviewer_name', 'reviewer_role', 'review_date']) {
    if (data.review_identity?.[field] === null || data.review_identity?.[field] === undefined) {
      diagnostics.push(diagnostic(entry.file, `/review_identity/${field}`, 'completed record requires actual reviewer identity and date'));
    }
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, expectedIdentity, 'completed review must match the registered artifact fingerprint and identity');
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
  validateFindingsAndDecision(diagnostics, entry, { safety, artifactRoot });
}

export function resolveTeacherWorkPlanClassroomTrialLifecycle(completedClassroomTrials = [], {
  registryPath = 'teacher-work-plan-artifacts/artifact-registry.yaml',
} = {}) {
  const diagnostics = [];
  const orderedEntries = [...completedClassroomTrials].sort((left, right) => compareBytewise(
    `${left.data?.trial_identity?.trial_id ?? ''}\0${left.file}`,
    `${right.data?.trial_identity?.trial_id ?? ''}\0${right.file}`,
  ));
  const byId = new Map();
  for (const entry of orderedEntries) {
    const id = entry.data?.trial_identity?.trial_id;
    if (!id) continue;
    if (byId.has(id)) {
      diagnostics.push(diagnostic(entry.file, '/trial_identity/trial_id', `duplicate classroom-trial ID ${id}`));
      continue;
    }
    byId.set(id, entry);
  }

  const successors = new Map([...byId.keys()].map((id) => [id, []]));
  for (const [id, entry] of byId) {
    for (const target of entry.data?.lifecycle?.supersedes ?? []) {
      if (target === id) {
        diagnostics.push(diagnostic(entry.file, '/lifecycle/supersedes', 'trial cannot supersede itself'));
      } else if (!byId.has(target)) {
        diagnostics.push(diagnostic(entry.file, '/lifecycle/supersedes', `unknown superseded trial ${target}`));
      } else {
        successors.get(target).push(id);
      }
    }
  }
  for (const [target, successorIds] of successors) {
    successorIds.sort(compareBytewise);
    if (successorIds.length > 1) {
      diagnostics.push(diagnostic(
        registryPath,
        '/classroom_trial/completed_record_paths',
        `trial ${target} has multiple successors: ${successorIds.join(', ')}`,
      ));
    }
  }

  const visiting = new Set();
  const visited = new Set();
  let cycleFound = false;
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id) || !byId.has(id)) return false;
    visiting.add(id);
    const targets = [...(byId.get(id).data?.lifecycle?.supersedes ?? [])].sort(compareBytewise);
    const cycle = targets.some(visit);
    visiting.delete(id);
    visited.add(id);
    return cycle;
  }
  for (const id of [...byId.keys()].sort(compareBytewise)) {
    if (visit(id)) cycleFound = true;
  }
  if (cycleFound) {
    diagnostics.push(diagnostic(
      registryPath,
      '/classroom_trial/completed_record_paths',
      'trial supersession graph contains a cycle',
    ));
  }

  const structuralFailure = diagnostics.length > 0;
  const activeEntries = structuralFailure
    ? []
    : [...byId.entries()]
      .filter(([id, entry]) => entry.data?.lifecycle?.status === 'analysed' && successors.get(id).length === 0)
      .map(([, entry]) => entry)
      .sort((left, right) => compareBytewise(left.data.trial_identity.trial_id, right.data.trial_identity.trial_id));
  if (!structuralFailure && byId.size > 0 && activeEntries.length === 0) {
    diagnostics.push(diagnostic(
      registryPath,
      '/classroom_trial/completed_record_paths',
      'registered classroom-trial graph has no active analysed terminal',
    ));
  }
  if (!structuralFailure && activeEntries.length > 1) {
    diagnostics.push(diagnostic(
      registryPath,
      '/classroom_trial/completed_record_paths',
      `registered classroom-trial graph has multiple unrelated active analysed terminals: ${activeEntries.map(({ data }) => data.trial_identity.trial_id).join(', ')}`,
    ));
  }

  return {
    diagnostics,
    activeEntry: diagnostics.length === 0 && activeEntries.length === 1 ? activeEntries[0] : null,
    activeEntries,
  };
}

function expectedRegistryState(registry, completedTeacherReviews, completedSafetyReviews, lifecycle) {
  const lastTeacher = completedTeacherReviews.at(-1)?.data;
  const lastSafety = completedSafetyReviews.at(-1)?.data;
  const activeTrial = lifecycle.activeEntry?.data;
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
  const { profile, paths, artifactContext } = repository;
  if (!profile || !paths || !artifactContext) {
    diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
    return {
      diagnostics,
      summary: {
        review_registries: 0,
        teacher_review_templates: 0,
        local_safety_review_templates: 0,
        completed_teacher_reviews: 0,
        completed_safety_reviews: 0,
        classroom_trial_templates: 0,
        completed_classroom_trials: 0,
        teacher_status: null,
        safety_status: null,
        classroom_trial: null,
        fingerprint: null,
      },
    };
  }
  const expectedIdentity = artifactIdentity(profile);
  const reusableValidation = validateTeacherWorkPlanReusableArtifactRepository(repository.reusableRepository);
  for (const problem of reusableValidation.diagnostics) {
    if (allowCompletedRecords && (
      problem.file === paths.registryPath
      || (problem.file === paths.indexPath && problem.field === '/human_review')
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
  if (!registry) diagnostics.push(diagnostic(paths.registryPath, '/', 'registered review registry is missing'));
  else {
    if (!allowCompletedRecords && !exactJson(registry, artifactContext.dependencies?.reviewRegistry?.data)) {
      diagnostics.push(diagnostic(paths.registryPath, '/', 'review registry differs from the registry validated by the reusable artifact dependency'));
    }
    if (registry.artifact_id !== profile.artifactId) diagnostics.push(diagnostic(paths.registryPath, '/artifact_id', 'wrong artifact ID'));
    if (registry.artifact_index_path !== paths.indexPath) diagnostics.push(diagnostic(paths.registryPath, '/artifact_index_path', 'wrong artifact index path'));
    if (registry.content_fingerprint !== profile.fingerprint) diagnostics.push(diagnostic(paths.registryPath, '/content_fingerprint', 'review registry fingerprint is stale'));
    if (registry.teacher_review?.template_path !== paths.teacherTemplatePath) diagnostics.push(diagnostic(paths.registryPath, '/teacher_review/template_path', 'wrong teacher-review template path'));
    if (registry.local_safety_review?.template_path !== paths.safetyTemplatePath) diagnostics.push(diagnostic(paths.registryPath, '/local_safety_review/template_path', 'wrong local-safety-review template path'));
    if (registry.classroom_trial?.template_path !== paths.trialTemplatePath) diagnostics.push(diagnostic(paths.registryPath, '/classroom_trial/template_path', 'wrong classroom-trial template path'));
    for (const repositoryPath of [
      registry.teacher_review?.template_path,
      registry.local_safety_review?.template_path,
      registry.classroom_trial?.template_path,
      ...(registry.teacher_review?.completed_record_paths ?? []),
      ...(registry.local_safety_review?.completed_record_paths ?? []),
      ...(registry.classroom_trial?.completed_record_paths ?? []),
    ]) {
      if (!insideReviewRoot(repositoryPath, paths.reviewRoot)) diagnostics.push(diagnostic(paths.registryPath, '/', 'all review paths must remain inside the registered review root'));
    }
  }

  validateTemplate(diagnostics, repository.teacherTemplate, 'teacher_work_plan_artifact_teacher_review', profile.review.teacherScope, expectedIdentity);
  validateTemplate(diagnostics, repository.safetyTemplate, 'teacher_work_plan_artifact_local_safety_review', profile.review.safetyScope, expectedIdentity);
  if (!repository.teacherTemplate) diagnostics.push(diagnostic(paths.teacherTemplatePath, '/', 'teacher-review template is missing'));
  if (!repository.safetyTemplate) diagnostics.push(diagnostic(paths.safetyTemplatePath, '/', 'local-safety-review template is missing'));
  if ((repository.safetyTemplate?.data?.decision?.conditions ?? []).length !== 0) diagnostics.push(diagnostic(paths.safetyTemplatePath, '/decision/conditions', 'safety template cannot contain approval conditions'));
  for (const entry of repository.completedTeacherReviews) validateCompletedRecord(diagnostics, entry, { expectedIdentity, artifactRoot: paths.artifactRoot });
  for (const entry of repository.completedSafetyReviews) validateCompletedRecord(diagnostics, entry, { safety: true, expectedIdentity, artifactRoot: paths.artifactRoot });

  const registeredTeacherPaths = registry?.teacher_review?.completed_record_paths ?? [];
  const registeredSafetyPaths = registry?.local_safety_review?.completed_record_paths ?? [];
  const registeredTrialPaths = registry?.classroom_trial?.completed_record_paths ?? [];
  validateExact(diagnostics, paths.registryPath, '/teacher_review/completed_record_paths', repository.completedTeacherReviews.map(({ file }) => file), registeredTeacherPaths, 'every completed teacher review must be loaded exactly once');
  validateExact(diagnostics, paths.registryPath, '/local_safety_review/completed_record_paths', repository.completedSafetyReviews.map(({ file }) => file), registeredSafetyPaths, 'every completed safety review must be loaded exactly once');
  validateExact(diagnostics, paths.registryPath, '/classroom_trial/completed_record_paths', repository.completedClassroomTrials.map(({ file }) => file), registeredTrialPaths, 'every completed classroom trial must be loaded exactly once');
  if (!allowCompletedRecords && (registeredTeacherPaths.length > 0 || registeredSafetyPaths.length > 0 || registeredTrialPaths.length > 0)) {
    diagnostics.push(diagnostic(paths.registryPath, '/', 'production review registry must contain no completed review records before real human evidence is supplied'));
  }

  const lifecycle = resolveTeacherWorkPlanClassroomTrialLifecycle(repository.completedClassroomTrials, { registryPath: paths.registryPath });
  diagnostics.push(...lifecycle.diagnostics);
  const state = expectedRegistryState(registry, repository.completedTeacherReviews, repository.completedSafetyReviews, lifecycle);
  if (registry?.teacher_review?.status !== state.teacherStatus) diagnostics.push(diagnostic(paths.registryPath, '/teacher_review/status', 'teacher status must be derived from registered human evidence, not PR or merge state'));
  if (registry?.local_safety_review?.status !== state.safetyStatus) diagnostics.push(diagnostic(paths.registryPath, '/local_safety_review/status', 'safety status must be derived from registered local evidence'));
  if (registry?.boundaries?.review_complete !== state.reviewComplete) diagnostics.push(diagnostic(paths.registryPath, '/boundaries/review_complete', 'review completion must reflect registered completed teacher records'));
  if (registry?.boundaries?.local_safety_review_complete !== state.safetyComplete) diagnostics.push(diagnostic(paths.registryPath, '/boundaries/local_safety_review_complete', 'local safety completion must reflect registered completed safety records'));
  if (registry?.classroom_trial?.status !== state.trialStatus) diagnostics.push(diagnostic(paths.registryPath, '/classroom_trial/status', 'classroom-trial status must be derived from registered analysed evidence, not PR or merge state'));
  if (registry?.boundaries?.classroom_trial_workflow_created !== true) diagnostics.push(diagnostic(paths.registryPath, '/boundaries/classroom_trial_workflow_created', 'classroom-trial workflow must be explicitly registered'));
  if (registry?.boundaries?.classroom_trial_complete !== state.trialComplete) diagnostics.push(diagnostic(paths.registryPath, '/boundaries/classroom_trial_complete', 'classroom-trial completion must reflect a registered analysed record'));
  if (registry?.boundaries?.classroom_ready !== state.classroomReady) diagnostics.push(diagnostic(paths.registryPath, '/boundaries/classroom_ready', 'classroom readiness must follow a positive analysed trial and cannot be inferred from PR state'));
  for (const flag of ['publication_ready', 'customer_released', 'effectiveness_claimed']) {
    if (registry?.boundaries?.[flag] !== false) diagnostics.push(diagnostic(paths.registryPath, `/boundaries/${flag}`, `${flag} cannot be promoted by review workflow creation`));
  }

  if (repository.guideText === null) diagnostics.push(diagnostic(paths.guidePath, '/', 'review guide is missing'));
  else {
    if (!repository.guideText.endsWith('\n')) diagnostics.push(diagnostic(paths.guidePath, '/', 'review guide must end with a newline'));
    for (const heading of profile.review.guideHeadings) {
      if (!repository.guideText.includes(heading)) diagnostics.push(diagnostic(paths.guidePath, '/', `review guide is missing ${heading}`));
    }
    for (const statement of [
      'A template is not human evidence.',
      'does not approve the pilot',
      'Any byte change',
      'Local safety approval is limited to the named context.',
      'Classroom trial remains',
      'Never use PR authorship',
    ]) {
      if (!repository.guideText.includes(statement)) diagnostics.push(diagnostic(paths.guidePath, '/', `review guide is missing boundary statement: ${statement}`));
    }
  }

  const baseReviewFiles = [
    paths.trialGuidePath,
    paths.trialTemplatePath,
    paths.guidePath,
    paths.safetyTemplatePath,
    paths.registryPath,
    paths.teacherTemplatePath,
  ];
  const expectedFiles = [
    ...baseReviewFiles,
    ...registeredTeacherPaths,
    ...registeredSafetyPaths,
    ...registeredTrialPaths,
  ].sort(compareBytewise);
  validateExact(diagnostics, paths.reviewRoot, '/', repository.reviewDirectoryFiles, expectedFiles, 'review directory contains a missing or extra file');

  const artifact = artifactContext.indexEntry?.data;
  if (artifact?.content_fingerprint?.value !== profile.fingerprint) diagnostics.push(diagnostic(paths.indexPath, '/content_fingerprint/value', 'review workflow must pin the registered material fingerprint'));
  if (!allowCompletedRecords) {
    validateExact(diagnostics, paths.indexPath, '/human_review', artifact?.human_review, {
      registry_path: paths.registryPath,
      teacher_review: { status: 'pending', completed_record_path: null },
      local_safety_review: { status: 'pending', completed_record_path: null },
      classroom_trial: {
        workflow_created: true,
        template_path: paths.trialTemplatePath,
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

export function validateTeacherWorkPlanArtifactReviewRepositories(repository, options = {}) {
  const results = repository.repositories.map((entry) => (
    validateTeacherWorkPlanArtifactReviewRepository(entry, options)
  ));
  const diagnostics = results.flatMap(({ diagnostics }) => diagnostics)
    .sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  return {
    diagnostics,
    summary: {
      review_registries: results.reduce((sum, result) => sum + result.summary.review_registries, 0),
      teacher_review_templates: results.reduce((sum, result) => sum + result.summary.teacher_review_templates, 0),
      local_safety_review_templates: results.reduce((sum, result) => sum + result.summary.local_safety_review_templates, 0),
      completed_teacher_reviews: results.reduce((sum, result) => sum + result.summary.completed_teacher_reviews, 0),
      completed_safety_reviews: results.reduce((sum, result) => sum + result.summary.completed_safety_reviews, 0),
      classroom_trial_templates: results.reduce((sum, result) => sum + result.summary.classroom_trial_templates, 0),
      completed_classroom_trials: results.reduce((sum, result) => sum + result.summary.completed_classroom_trials, 0),
      artifacts: Object.fromEntries(repository.repositories.map((entry, index) => [
        entry.artifactId,
        {
          teacher_status: results[index].summary.teacher_status,
          safety_status: results[index].summary.safety_status,
          classroom_trial: results[index].summary.classroom_trial,
          fingerprint: results[index].summary.fingerprint,
        },
      ])),
    },
  };
}

export function formatTeacherWorkPlanArtifactReviewDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}
