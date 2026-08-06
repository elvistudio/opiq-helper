import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { stringify } from 'yaml';

import {
  TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH,
  loadTeacherWorkPlanArtifactRegistry,
  parseTeacherWorkPlanArtifactRegistryYaml,
  validateTeacherWorkPlanArtifactRegistry,
} from './lib/teacher-work-plan-artifact-registry.mjs';

const SOIL_ID = 'grade-6-science-soil-organisms';
const SOIL_PROFILE_ID = 'grade-6-science-soil-organisms-v1';
const SOIL_FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';
const PHOTOSYNTHESIS_ID = 'grade-6-science-photosynthesis';
const GARDEN_FIELD_ID = 'grade-6-science-garden-field-food-products';
const WOOD_PROCESSING_ID = 'grade-6-science-wood-processing';
const AIR_COMPOSITION_ID = 'grade-6-science-air-composition';
const NEXT_ID = 'grade-6-science-water-cycle';
const NEXT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/water-cycle';

let baseline;

function cloneRepository(repository = baseline) {
  return {
    ...repository,
    registry: repository.registry && { ...repository.registry, data: structuredClone(repository.registry.data) },
    schema: structuredClone(repository.schema),
    profiles: Object.fromEntries(Object.entries(repository.profiles).map(([key, value]) => [key, structuredClone(value)])),
    indexes: repository.indexes.map((entry) => ({ ...entry, data: structuredClone(entry.data) })),
    discoveredIndexPaths: [...repository.discoveredIndexPaths],
    workPackageRepository: {
      ...repository.workPackageRepository,
      artifact: structuredClone(repository.workPackageRepository.artifact),
      schema: structuredClone(repository.workPackageRepository.schema),
    },
    gapReport: structuredClone(repository.gapReport),
    loadDiagnostics: structuredClone(repository.loadDiagnostics),
  };
}

function reasons(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern, options) {
  const result = validateTeacherWorkPlanArtifactRegistry(repository, options);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(reasons(result), pattern);
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanArtifactRegistry({ rootDir: process.cwd() });
});

test('production central registry is exact and selects the next unstarted package', () => {
  const result = validateTeacherWorkPlanArtifactRegistry(baseline);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.summary, {
    artifact_registries: 1,
    registered_artifacts: 5,
    discovered_artifact_indexes: 5,
    validation_profiles: 5,
    implemented_internal_drafts: 5,
    next_authoring_package: NEXT_ID,
    next_package_status: 'selected_not_started',
  });
  const registry = baseline.registry.data;
  assert.equal(baseline.registry.file, TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH);
  assert.equal(registry.registry_id, 'grades-5-7-teacher-work-plan-reusable-artifacts');
  const soil = registry.artifacts.find(({ artifact_id }) => artifact_id === SOIL_ID);
  assert.equal(soil.validation_profile_id, SOIL_PROFILE_ID);
  assert.equal(soil.content_fingerprint, SOIL_FINGERPRINT);
  assert.equal(registry.artifacts.some(({ artifact_id }) => artifact_id === PHOTOSYNTHESIS_ID), true);
  assert.equal(registry.artifacts.some(({ artifact_id }) => artifact_id === GARDEN_FIELD_ID), true);
  assert.equal(registry.artifacts.some(({ artifact_id }) => artifact_id === WOOD_PROCESSING_ID), true);
  assert.equal(registry.artifacts.some(({ artifact_id }) => artifact_id === AIR_COMPOSITION_ID), true);
  assert.equal(registry.authoring_queue.next_package_id, NEXT_ID);
  assert.equal(registry.authoring_queue.planned_root_path, NEXT_ROOT);
  assert.equal(registry.authoring_queue.selection_order, 6);
  assert.equal(registry.authoring_queue.status, 'selected_not_started');
  assert.equal(registry.authoring_queue.materials_created, false);
  assert.equal(registry.authoring_queue.artifact_index_created, false);
  assert.equal(registry.authoring_queue.human_review_workflow_created, false);
  assert.equal(registry.authoring_queue.classroom_trial_workflow_created, false);
  const nextPackage = baseline.workPackageRepository.artifact.work_packages.find(({ package_id }) => package_id === NEXT_ID);
  assert.equal(nextPackage.authoring_status, 'ready_for_authoring');
  assert.deepEqual(nextPackage.blocking_questions, []);
  assert.equal(nextPackage.implementation, undefined);
});

test('registry validation is independent of artifact array order', () => {
  const first = validateTeacherWorkPlanArtifactRegistry(cloneRepository());
  const reversed = cloneRepository();
  reversed.registry.data.artifacts.reverse();
  reversed.indexes.reverse();
  reversed.discoveredIndexPaths.reverse();
  const second = validateTeacherWorkPlanArtifactRegistry(reversed);
  assert.deepEqual(second, first);
});

test('synthetic second route artifact validates without committed teaching content', () => {
  const repository = cloneRepository();
  const packageId = 'grade-5-science-local-water-events';
  const rootPath = 'teacher-work-plan-artifacts/grade-5-science/local-water-events';
  const indexPath = `${rootPath}/artifact-index.yaml`;
  const profileId = `${packageId}-synthetic-v1`;
  const sourceProfile = repository.profiles[SOIL_PROFILE_ID];
  repository.profiles[profileId] = {
    ...structuredClone(sourceProfile),
    profileId,
    artifactId: packageId,
    packageId,
    route: 'grade-5-science',
    rootPath,
    indexPath,
    identity: { grade: 5, subject: 'science', subjectEt: 'loodusõpetus' },
    review: {
      ...structuredClone(sourceProfile.review),
      rootPath: `${rootPath}/reviews`,
      registryPath: `${rootPath}/reviews/review-registry.yaml`,
      guidePath: `${rootPath}/reviews/review-guide.md`,
      teacherTemplatePath: `${rootPath}/reviews/teacher-review-template.yaml`,
      safetyTemplatePath: `${rootPath}/reviews/local-safety-review-template.yaml`,
      trialGuidePath: `${rootPath}/reviews/classroom-trial-guide.md`,
      trialTemplatePath: `${rootPath}/reviews/classroom-trial-template.yaml`,
    },
  };
  const syntheticIndex = structuredClone(repository.indexes.find(({ data }) => data.artifact_id === SOIL_ID));
  syntheticIndex.file = indexPath;
  syntheticIndex.data.artifact_id = packageId;
  syntheticIndex.data.package_id = packageId;
  syntheticIndex.data.canonical_route.source_id = 'grade-5-science';
  syntheticIndex.data.source_work_package.package_id = packageId;
  syntheticIndex.data.source_work_package.planned_root_path = rootPath;
  syntheticIndex.data.human_review.registry_path = `${rootPath}/reviews/review-registry.yaml`;
  syntheticIndex.data.human_review.classroom_trial.template_path = `${rootPath}/reviews/classroom-trial-template.yaml`;
  repository.indexes.push(syntheticIndex);
  repository.discoveredIndexPaths.push(indexPath);
  repository.registry.data.artifacts.push({
    artifact_id: packageId,
    package_id: packageId,
    route: 'grade-5-science',
    root_path: rootPath,
    index_path: indexPath,
    validation_profile_id: profileId,
    lifecycle_status: 'internal_draft',
    content_fingerprint: SOIL_FINGERPRINT,
    review_registry_path: `${rootPath}/reviews/review-registry.yaml`,
    classroom_trial_template_path: `${rootPath}/reviews/classroom-trial-template.yaml`,
  });
  const first = validateTeacherWorkPlanArtifactRegistry(repository);
  assert.deepEqual(first.diagnostics, []);
  repository.registry.data.artifacts.reverse();
  repository.indexes.reverse();
  repository.discoveredIndexPaths.reverse();
  assert.deepEqual(validateTeacherWorkPlanArtifactRegistry(repository), first);
});

const mutations = [
  ['duplicate artifact ID', (repo) => { repo.registry.data.artifacts.push(structuredClone(repo.registry.data.artifacts[0])); }, /duplicate artifact ID/u],
  ['duplicate package ID', (repo) => { repo.registry.data.artifacts.push({ ...structuredClone(repo.registry.data.artifacts[0]), artifact_id: 'synthetic-artifact' }); }, /duplicate package ID/u],
  ['duplicate root', (repo) => { repo.registry.data.artifacts.push({ ...structuredClone(repo.registry.data.artifacts[0]), artifact_id: 'synthetic-artifact', package_id: 'synthetic-package' }); }, /duplicate artifact root/u],
  ['duplicate index path', (repo) => { repo.registry.data.artifacts.push({ ...structuredClone(repo.registry.data.artifacts[0]), artifact_id: 'synthetic-artifact', package_id: 'synthetic-package', root_path: 'teacher-work-plan-artifacts/synthetic/root' }); }, /duplicate artifact index path/u],
  ['missing profile', (repo) => { repo.registry.data.artifacts[0].validation_profile_id = 'missing-profile'; }, /unknown validation profile/u],
  ['unreferenced profile', (repo) => { repo.profiles.synthetic = structuredClone(repo.profiles[SOIL_PROFILE_ID]); }, /unreferenced production validation profile/u],
  ['wrong route', (repo) => { repo.registry.data.artifacts[0].route = 'grade-7-science'; }, /route differs/u],
  ['wrong package', (repo) => { repo.registry.data.artifacts[0].package_id = 'grade-6-science-photosynthesis'; }, /package_id differs|already implemented/u],
  ['wrong planned root', (repo) => { repo.registry.data.artifacts[0].root_path = 'teacher-work-plan-artifacts/grade-6-science/other'; }, /root_path differs|artifact root differs/u],
  ['wrong fingerprint', (repo) => { repo.registry.data.artifacts[0].content_fingerprint = '0'.repeat(64); }, /fingerprint differs/u],
  ['missing index', (repo) => { repo.indexes = []; }, /registered artifact index is missing/u],
  ['unregistered discovered index', (repo) => { repo.discoveredIndexPaths.push('teacher-work-plan-artifacts/synthetic/artifact-index.yaml'); }, /exactly equal discovered/u],
  ['index outside artifact root', (repo) => { repo.registry.data.artifacts[0].index_path = 'teacher-work-plan-artifacts/elsewhere/artifact-index.yaml'; }, /directly inside its registered root/u],
  ['review registry mismatch', (repo) => { repo.registry.data.artifacts[0].review_registry_path = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/other.yaml'; }, /review_registry_path differs/u],
  ['trial template mismatch', (repo) => { repo.registry.data.artifacts[0].classroom_trial_template_path = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/other.yaml'; }, /classroom_trial_template_path differs/u],
  ['queue package missing', (repo) => { repo.registry.data.authoring_queue.next_package_id = 'missing-package'; }, /absent from the work-package registry/u],
  ['queue package blocked', (repo) => { repo.workPackageRepository.artifact.work_packages.find(({ package_id }) => package_id === NEXT_ID).authoring_status = 'blocked_teacher_review'; }, /ready_for_authoring/u],
  ['queue package already implemented', (repo) => { repo.workPackageRepository.artifact.work_packages.find(({ package_id }) => package_id === NEXT_ID).implementation = structuredClone(repo.workPackageRepository.artifact.work_packages.find(({ implementation }) => implementation).implementation); }, /implemented package must link|already implemented/u],
  ['queue root mismatch', (repo) => { repo.registry.data.authoring_queue.planned_root_path = 'teacher-work-plan-artifacts/grade-6-science/other'; }, /next authoring root|queued root differs/u],
  ['queue materials marked created', (repo) => { repo.registry.data.authoring_queue.materials_created = true; }, /materials_created must remain false/u],
  ['queue review workflow marked created', (repo) => { repo.registry.data.authoring_queue.human_review_workflow_created = true; }, /human_review_workflow_created must remain false/u],
  ['queue trial workflow marked created', (repo) => { repo.registry.data.authoring_queue.classroom_trial_workflow_created = true; }, /classroom_trial_workflow_created must remain false/u],
  ['source gap resolution claimed', (repo) => { repo.registry.data.authoring_queue.source_gap_resolution_claimed = true; }, /source_gap_resolution_claimed must remain false/u],
  ['unknown field', (repo) => { repo.registry.data.unexpected = true; }, /unknown field unexpected/u],
];

for (const [name, mutate, pattern] of mutations) {
  test(`rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

for (const [name, transform, pattern] of [
  ['duplicate YAML key', (text) => text.replace('registry_id:', 'registry_id: duplicate\nregistry_id:'), /duplicate|Map keys/u],
  ['YAML alias', (text) => `${text}\ncopy: *missing\n`, /alias|anchor/u],
  ['YAML anchor', (text) => text.replace('registry_id:', 'registry_id: &id'), /anchor/u],
  ['YAML tab', (text) => `${text}\t`, /tabs/u],
]) {
  test(`strict registry parser rejects ${name}`, async () => {
    const text = await fs.readFile(TEACHER_WORK_PLAN_ARTIFACT_REGISTRY_PATH, 'utf8');
    assert.throws(() => parseTeacherWorkPlanArtifactRegistryYaml(transform(text)), pattern);
  });
}

test('registry diagnostics are deterministic', () => {
  const first = cloneRepository();
  first.registry.data.authoring_queue.materials_created = true;
  const second = cloneRepository();
  second.registry.data.authoring_queue.materials_created = true;
  assert.deepEqual(validateTeacherWorkPlanArtifactRegistry(first), validateTeacherWorkPlanArtifactRegistry(second));
  assert.equal(stringify(first.registry.data).includes('grade-6-science-photosynthesis'), true);
});

test('generic validators contain no soil package identity, gaps, or fixed material paths', async () => {
  const [artifactValidator, reviewValidator, trialValidator, profileModule] = await Promise.all([
    fs.readFile('scripts/lib/teacher-work-plan-reusable-artifacts.mjs', 'utf8'),
    fs.readFile('scripts/lib/teacher-work-plan-artifact-reviews.mjs', 'utf8'),
    fs.readFile('scripts/lib/teacher-work-plan-artifact-classroom-trials.mjs', 'utf8'),
    fs.readFile('scripts/lib/teacher-work-plan-artifact-profiles.mjs', 'utf8'),
  ]);
  for (const text of [artifactValidator, reviewValidator, trialValidator]) {
    assert.equal(text.includes('grade-6-science-soil-organisms'), false);
    assert.equal(text.includes('grade-6-science-lesson-008'), false);
    assert.equal(text.includes('soil-organisms/teacher-guide.md'), false);
  }
  assert.equal(profileModule.includes('grade-6-science-soil-organisms'), true);
  assert.equal(profileModule.includes('grade-6-science-lesson-008'), true);
  assert.equal(profileModule.includes('${rootPath}/teacher-guide.md'), true);
});
