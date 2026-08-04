import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

import {
  TEACHER_WORK_PLAN_ARTIFACT_PROFILES,
} from './teacher-work-plan-artifact-profiles.mjs';
import {
  loadTeacherWorkPlanWorkPackages,
  validateTeacherWorkPlanWorkPackages,
} from './teacher-work-plan-work-packages.mjs';

export const TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH =
  'teacher-work-plan-artifacts/artifact-registry.yaml';
export const TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_SCHEMA_PATH =
  'schemas/teacher-work-plan-artifact-registry.schema.json';

const ARTIFACT_ROOT = 'teacher-work-plan-artifacts';
const WORK_PACKAGE_PATH = 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml';
const EXACT_ROUTES = Object.freeze([
  'grade-5-science',
  'grade-6-science',
  'grade-7-geography',
  'grade-7-science',
]);
const NEXT_PACKAGE_ID = 'grade-6-science-photosynthesis';
const NEXT_PACKAGE_ROOT = 'teacher-work-plan-artifacts/grade-6-science/photosynthesis';

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
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`repository path escapes root: ${repositoryPath}`);
  return resolved;
}

function insideArtifactRoot(repositoryPath) {
  return typeof repositoryPath === 'string'
    && repositoryPath.startsWith(`${ARTIFACT_ROOT}/`)
    && !repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment));
}

export function parseTeacherWorkPlanArtifactRegistryYaml(text, file = TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH) {
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

async function walkForIndexes(rootDir, relative = '') {
  const directory = path.join(rootDir, relative);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const results = [];
  for (const entry of entries.sort((a, b) => compareBytewise(a.name, b.name))) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) results.push(...await walkForIndexes(rootDir, next));
    else if (entry.isFile() && entry.name === 'artifact-index.yaml') results.push(`${ARTIFACT_ROOT}/${next}`);
  }
  return results;
}

async function readJson(rootDir, repositoryPath) {
  return JSON.parse(await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8'));
}

export async function loadTeacherWorkPlanArtifactRegistry({
  rootDir = process.cwd(),
  registryText = null,
  indexOverrides = new Map(),
  discoveredIndexPaths = null,
  profiles = TEACHER_WORK_PLAN_ARTIFACT_PROFILES,
  workPackages = null,
  gapReport = null,
} = {}) {
  const root = path.resolve(rootDir);
  const loadDiagnostics = [];
  let registry = null;
  try {
    const text = registryText ?? await fs.readFile(
      safeRepositoryPath(root, TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH),
      'utf8',
    );
    registry = {
      file: TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      text,
      data: parseTeacherWorkPlanArtifactRegistryYaml(text),
    };
  } catch (error) {
    loadDiagnostics.push(diagnostic(TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH, '/', error.message));
  }

  const resolvedIndexPaths = (discoveredIndexPaths ?? await walkForIndexes(
    safeRepositoryPath(root, ARTIFACT_ROOT),
  )).sort(compareBytewise);
  const indexes = [];
  for (const indexPath of resolvedIndexPaths) {
    try {
      const text = indexOverrides.has(indexPath)
        ? indexOverrides.get(indexPath)
        : await fs.readFile(safeRepositoryPath(root, indexPath), 'utf8');
      indexes.push({ file: indexPath, text, data: parseTeacherWorkPlanArtifactRegistryYaml(text, indexPath) });
    } catch (error) {
      loadDiagnostics.push(diagnostic(indexPath, '/', error.message));
    }
  }

  const resolvedGapReport = gapReport ?? await readJson(
    root,
    'evaluations/teacher-work-plans/grades-5-7-gap-report.json',
  );
  const workPackageRepository = workPackages
    ? {
      artifact: workPackages,
      schema: await readJson(root, 'schemas/teacher-work-plan-work-packages.schema.json'),
      gapReport: resolvedGapReport,
    }
    : await loadTeacherWorkPlanWorkPackages({ rootDir: root, gapReport: resolvedGapReport, includeMarkdown: false });
  return {
    rootDir: root,
    registry,
    schema: await readJson(root, TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_SCHEMA_PATH),
    profiles,
    indexes,
    discoveredIndexPaths: resolvedIndexPaths,
    workPackageRepository,
    gapReport: resolvedGapReport,
    loadDiagnostics,
  };
}

function addDuplicateDiagnostics(diagnostics, entries, field, label) {
  const seen = new Set();
  for (const [index, entry] of entries.entries()) {
    const value = entry[field];
    if (seen.has(value)) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      `/artifacts/${index}/${field}`,
      `duplicate ${label} ${value}`,
    ));
    seen.add(value);
  }
}

export function validateTeacherWorkPlanArtifactRegistry(repository, {
  validateWorkPackages = true,
  enforceProductionQueue = true,
} = {}) {
  const diagnostics = [...(repository.loadDiagnostics ?? [])];
  const registry = repository.registry?.data;
  if (!registry) {
    return {
      diagnostics: diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`)),
      summary: {
        artifact_registries: 0,
        registered_artifacts: 0,
        discovered_artifact_indexes: repository.discoveredIndexPaths?.length ?? 0,
        validation_profiles: Object.keys(repository.profiles ?? {}).length,
        implemented_internal_drafts: 0,
        next_authoring_package: null,
        next_package_status: null,
      },
    };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(repository.schema);
  if (!validate(registry)) {
    for (const error of validate.errors ?? []) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      error.instancePath || '/',
      schemaReason(error),
    ));
  }
  if (!exactJson(registry.scope?.routes, EXACT_ROUTES)) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/scope/routes',
    'registry routes must remain in exact production order',
  ));

  if (validateWorkPackages) {
    const result = validateTeacherWorkPlanWorkPackages(
      repository.workPackageRepository.artifact,
      {
        schema: repository.workPackageRepository.schema,
        gapReport: repository.gapReport,
      },
    );
    for (const problem of result.diagnostics) diagnostics.push(diagnostic(
      problem.file,
      problem.field,
      `work-package dependency: ${problem.reason}`,
    ));
  }

  const entries = registry.artifacts ?? [];
  for (const [field, label] of [
    ['artifact_id', 'artifact ID'],
    ['package_id', 'package ID'],
    ['root_path', 'artifact root'],
    ['index_path', 'artifact index path'],
    ['validation_profile_id', 'validation profile ID'],
  ]) addDuplicateDiagnostics(diagnostics, entries, field, label);

  const registeredPaths = entries.map(({ index_path }) => index_path).sort(compareBytewise);
  if (!exactJson(registeredPaths, [...repository.discoveredIndexPaths].sort(compareBytewise))) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/artifacts',
    'registered artifact indexes must exactly equal discovered artifact-index.yaml files',
  ));
  const indexByPath = new Map(repository.indexes.map((entry) => [entry.file, entry]));
  const packages = repository.workPackageRepository.artifact?.work_packages ?? [];
  const packageById = new Map(packages.map((entry) => [entry.package_id, entry]));
  const referencedProfiles = new Set();
  for (const [index, entry] of entries.entries()) {
    const field = `/artifacts/${index}`;
    for (const [pathField, value] of Object.entries({
      root_path: entry.root_path,
      index_path: entry.index_path,
      review_registry_path: entry.review_registry_path,
      classroom_trial_template_path: entry.classroom_trial_template_path,
    })) {
      if (!insideArtifactRoot(value)) diagnostics.push(diagnostic(
        TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
        `${field}/${pathField}`,
        'artifact paths must remain inside teacher-work-plan-artifacts/',
      ));
    }
    if (entry.index_path !== `${entry.root_path}/artifact-index.yaml`) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      `${field}/index_path`,
      'artifact index must be the artifact-index.yaml directly inside its registered root',
    ));
    const profile = repository.profiles?.[entry.validation_profile_id];
    if (!profile) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      `${field}/validation_profile_id`,
      `unknown validation profile ${entry.validation_profile_id}`,
    ));
    else {
      referencedProfiles.add(entry.validation_profile_id);
      const expected = {
        artifact_id: profile.artifactId,
        package_id: profile.packageId,
        route: profile.route,
        root_path: profile.rootPath,
        index_path: profile.indexPath,
        content_fingerprint: profile.fingerprint,
        review_registry_path: profile.review.registryPath,
        classroom_trial_template_path: profile.review.trialTemplatePath,
      };
      for (const [key, value] of Object.entries(expected)) {
        if (entry[key] !== value) diagnostics.push(diagnostic(
          TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
          `${field}/${key}`,
          `registry ${key} differs from immutable validation profile`,
        ));
      }
    }
    const workPackage = packageById.get(entry.package_id);
    if (!workPackage) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      `${field}/package_id`,
      'registered artifact package is absent from the work-package registry',
    ));
    else {
      if (workPackage.source_id !== entry.route) diagnostics.push(diagnostic(
        TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
        `${field}/route`,
        'artifact route differs from its work package',
      ));
      if (workPackage.planned_root_path !== entry.root_path) diagnostics.push(diagnostic(
        TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
        `${field}/root_path`,
        'artifact root differs from the work-package planned root',
      ));
    }
    const indexEntry = indexByPath.get(entry.index_path);
    if (!indexEntry) diagnostics.push(diagnostic(entry.index_path, '/', 'registered artifact index is missing'));
    else {
      const data = indexEntry.data;
      if (data.artifact_id !== entry.artifact_id) diagnostics.push(diagnostic(entry.index_path, '/artifact_id', 'artifact index ID differs from central registry'));
      if (data.package_id !== entry.package_id) diagnostics.push(diagnostic(entry.index_path, '/package_id', 'artifact index package differs from central registry'));
      if (data.canonical_route?.source_id !== entry.route) diagnostics.push(diagnostic(entry.index_path, '/canonical_route/source_id', 'artifact index route differs from central registry'));
      if (data.source_work_package?.planned_root_path !== entry.root_path) diagnostics.push(diagnostic(entry.index_path, '/source_work_package/planned_root_path', 'artifact index root differs from central registry'));
      if (data.content_fingerprint?.value !== entry.content_fingerprint) diagnostics.push(diagnostic(entry.index_path, '/content_fingerprint/value', 'artifact fingerprint differs from central registry'));
      if (data.human_review?.registry_path !== entry.review_registry_path) diagnostics.push(diagnostic(entry.index_path, '/human_review/registry_path', 'review registry path differs from central registry'));
      if (data.human_review?.classroom_trial?.template_path !== entry.classroom_trial_template_path) diagnostics.push(diagnostic(entry.index_path, '/human_review/classroom_trial/template_path', 'classroom-trial template path differs from central registry'));
    }
  }
  for (const profileId of Object.keys(repository.profiles ?? {}).sort(compareBytewise)) {
    if (!referencedProfiles.has(profileId)) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      '/artifacts',
      `unreferenced production validation profile ${profileId}`,
    ));
  }

  const queue = registry.authoring_queue ?? {};
  const queuePackage = packageById.get(queue.next_package_id);
  if (enforceProductionQueue && queue.next_package_id !== NEXT_PACKAGE_ID) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/authoring_queue/next_package_id',
    `next authoring package must be ${NEXT_PACKAGE_ID}`,
  ));
  if (enforceProductionQueue && queue.planned_root_path !== NEXT_PACKAGE_ROOT) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/authoring_queue/planned_root_path',
    `next authoring root must be ${NEXT_PACKAGE_ROOT}`,
  ));
  if (!queuePackage) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/authoring_queue/next_package_id',
    'queued package is absent from the work-package registry',
  ));
  else {
    if (queuePackage.authoring_status !== 'ready_for_authoring') diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      '/authoring_queue/next_package_id',
      'queued package must be ready_for_authoring',
    ));
    if ((queuePackage.blocking_questions ?? []).length !== 0) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      '/authoring_queue/next_package_id',
      'queued package cannot have blocking questions',
    ));
    if (queuePackage.implementation) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      '/authoring_queue/next_package_id',
      'queued package is already implemented',
    ));
    if (queuePackage.planned_root_path !== queue.planned_root_path) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      '/authoring_queue/planned_root_path',
      'queued root differs from the work-package registry',
    ));
  }
  if (entries.some(({ package_id }) => package_id === queue.next_package_id)) diagnostics.push(diagnostic(
    TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
    '/authoring_queue/next_package_id',
    'implemented artifact cannot also be the next unstarted package',
  ));
  for (const flag of [
    'materials_created',
    'artifact_index_created',
    'human_review_workflow_created',
    'classroom_trial_workflow_created',
    'source_gap_resolution_claimed',
  ]) {
    if (queue[flag] !== false) diagnostics.push(diagnostic(
      TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
      `/authoring_queue/${flag}`,
      `${flag} must remain false for selected_not_started queue state`,
    ));
  }

  diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  return {
    diagnostics,
    summary: {
      artifact_registries: repository.registry ? 1 : 0,
      registered_artifacts: entries.length,
      discovered_artifact_indexes: repository.discoveredIndexPaths.length,
      validation_profiles: Object.keys(repository.profiles ?? {}).length,
      implemented_internal_drafts: entries.filter(({ lifecycle_status }) => lifecycle_status === 'internal_draft').length,
      next_authoring_package: queue.next_package_id ?? null,
      next_package_status: queue.status ?? null,
    },
  };
}

export function formatTeacherWorkPlanArtifactRegistryDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}

export function getRegisteredArtifactEntry(repository, artifactId) {
  return repository.registry?.data?.artifacts?.find(({ artifact_id }) => artifact_id === artifactId) ?? null;
}
