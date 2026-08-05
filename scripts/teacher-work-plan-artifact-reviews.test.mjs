import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  loadTeacherWorkPlanArtifactReviewRepository,
  validateTeacherWorkPlanArtifactReviewRepository,
} from './lib/teacher-work-plan-artifact-reviews.mjs';
import { getTeacherWorkPlanArtifactProfile } from './lib/teacher-work-plan-artifact-profiles.mjs';

const PROFILE = getTeacherWorkPlanArtifactProfile('grade-6-science-soil-organisms-v1');
const PILOT_ROOT = PROFILE.rootPath;
const SOIL_ORGANISMS_REVIEW_ROOT = PROFILE.review.rootPath;
const REVIEW_REGISTRY_PATH = PROFILE.review.registryPath;
const INDEX_PATH = `${PILOT_ROOT}/artifact-index.yaml`;
const TEACHER_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/teacher-review-template.yaml`;
const SAFETY_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/local-safety-review-template.yaml`;
const GUIDE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/review-guide.md`;
const TRIAL_GUIDE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/classroom-trial-guide.md`;
const TRIAL_TEMPLATE_PATH = `${SOIL_ORGANISMS_REVIEW_ROOT}/classroom-trial-template.yaml`;
const FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';
const MATERIAL_HASHES = [
  '2a0d26671a051d33cd6b78cdf1eb46eb1a991020c71f05ace7c8610ca32a37a3',
  '42c89a0d91f30e63936d1903065322eeb1616edb40c9234895ca157980970c9b',
  'ed73c07de474825e36048fff87c89037afd0fe76477e1b65ae35477b8c4cacbb',
  '41b2c0809d25fe8b8266c238a8bcef471a704c5bc010748c6680edde81943273',
  '158666725916c2d5be35d201c482ca3f9752a43f7018d8dff6dcf4874abf9a16',
  '7416aba84f4dee39fe08d9dd6c729ae093d514727e0d5e69db7d3b5963350d04',
  '252145bbc1c17e4885782e5070e5227860f44f12a361add9544e54b5c42012f0',
];

let baseline;

function cloneEntry(entry) {
  return entry && { ...entry, data: structuredClone(entry.data) };
}

function cloneReusable(repository) {
  const artifacts = repository.artifacts.map((entry) => ({
    ...entry,
    data: structuredClone(entry.data),
    materialBytes: new Map([...entry.materialBytes].map(([key, value]) => [
      key,
      value === null ? null : Buffer.from(value),
    ])),
  }));
  const artifactByFile = new Map(artifacts.map((entry) => [entry.file, entry]));
  const artifactContexts = repository.artifactContexts.map((context) => ({
    ...context,
    registryEntry: structuredClone(context.registryEntry),
    route: structuredClone(context.route),
    indexEntry: artifactByFile.get(context.indexEntry.file),
    dependencies: context.dependencies && {
      ...context.dependencies,
      paths: structuredClone(context.dependencies.paths),
      topicInventory: structuredClone(context.dependencies.topicInventory),
      bookInventory: structuredClone(context.dependencies.bookInventory),
      crosswalk: structuredClone(context.dependencies.crosswalk),
      extraction: structuredClone(context.dependencies.extraction),
      qa: structuredClone(context.dependencies.qa),
      rootDirectoryFiles: [...context.dependencies.rootDirectoryFiles],
      reviewRegistry: cloneEntry(context.dependencies.reviewRegistry),
    },
  }));
  return {
    ...repository,
    artifacts,
    artifactContexts,
    artifactById: new Map(artifactContexts.map((context) => [context.registryEntry.artifact_id, context])),
    loadDiagnostics: structuredClone(repository.loadDiagnostics),
    schema: structuredClone(repository.schema),
    gapReport: structuredClone(repository.gapReport),
    workPackageRepository: {
      ...repository.workPackageRepository,
      artifact: structuredClone(repository.workPackageRepository.artifact),
      schema: structuredClone(repository.workPackageRepository.schema),
    },
    manifest: structuredClone(repository.manifest),
    languageProfiles: structuredClone(repository.languageProfiles),
  };
}

function cloneRepository() {
  const reusableRepository = cloneReusable(baseline.reusableRepository);
  return {
    ...baseline,
    schema: structuredClone(baseline.schema),
    registry: cloneEntry(baseline.registry),
    teacherTemplate: cloneEntry(baseline.teacherTemplate),
    safetyTemplate: cloneEntry(baseline.safetyTemplate),
    completedTeacherReviews: baseline.completedTeacherReviews.map(cloneEntry),
    completedSafetyReviews: baseline.completedSafetyReviews.map(cloneEntry),
    reviewDirectoryFiles: [...baseline.reviewDirectoryFiles],
    reusableRepository,
    artifactContext: reusableRepository.artifactById.get(baseline.artifactId),
    loadDiagnostics: structuredClone(baseline.loadDiagnostics),
  };
}

function reasons(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern, options) {
  const result = validateTeacherWorkPlanArtifactReviewRepository(repository, options);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(reasons(result), pattern);
}

function synchronizeReusableRegistry(repository) {
  repository.artifactContext.dependencies.reviewRegistry.data = structuredClone(repository.registry.data);
}

function completedTeacherReview(repository) {
  const data = structuredClone(repository.teacherTemplate.data);
  data.template = false;
  data.review_identity = {
    review_id: 'synthetic-teacher-review-2026-08-04',
    reviewer_id: 'synthetic-reviewer-001',
    reviewer_name: 'Synthetic Test Reviewer',
    reviewer_role: 'science teacher',
    organization: 'Synthetic Test School',
    review_date: '2026-08-04',
  };
  for (const item of data.review_scope) {
    item.status = 'acceptable';
    item.notes = 'Synthetic in-memory validation fixture.';
  }
  data.decision = {
    status: 'approved',
    rationale: 'Synthetic in-memory positive completed-record validation.',
    open_blocking_findings: [],
    open_major_findings: [],
    required_changes_complete: true,
    reviewed_fingerprint_matches: true,
  };
  const file = `${SOIL_ORGANISMS_REVIEW_ROOT}/synthetic-teacher-review.yaml`;
  repository.completedTeacherReviews = [{ file, text: '', data }];
  repository.registry.data.teacher_review.completed_record_paths = [file];
  repository.registry.data.teacher_review.status = 'approved';
  repository.registry.data.boundaries.review_complete = true;
  repository.reviewDirectoryFiles.push(file);
  repository.reviewDirectoryFiles.sort();
  return repository.completedTeacherReviews[0];
}

function completedSafetyReview(repository) {
  const data = structuredClone(repository.safetyTemplate.data);
  data.template = false;
  data.review_identity = {
    review_id: 'synthetic-safety-review-2026-08-04',
    reviewer_id: 'synthetic-safety-reviewer-001',
    reviewer_name: 'Synthetic Test Safety Reviewer',
    reviewer_role: 'local safety reviewer',
    organization: 'Synthetic Test School',
    review_date: '2026-08-04',
  };
  data.local_context = {
    school_or_organization: 'Synthetic Test School',
    site_description: 'Synthetic enclosed school garden site',
    planned_activity_date: '2026-08-10',
    group_size: 12,
    adult_supervision_count: 2,
    delivery_site_category: 'mixed',
    indoor_fallback_permitted: true,
    weather_limitations: 'No thunder, ice, flooding, or high wind',
    accessibility_adjustments: 'Level indoor fallback is available',
    permission_requirements: 'Synthetic site owner confirmation required',
    emergency_contact_process: 'Use the school synthetic test process',
  };
  for (const item of data.review_scope) {
    item.status = 'acceptable';
    item.notes = 'Synthetic in-memory validation fixture.';
  }
  data.decision = {
    status: 'approved_for_named_context',
    rationale: 'Synthetic in-memory local-context validation.',
    open_blocking_findings: [],
    open_major_findings: [],
    required_changes_complete: true,
    reviewed_fingerprint_matches: true,
    conditions: [],
  };
  const file = `${SOIL_ORGANISMS_REVIEW_ROOT}/synthetic-safety-review.yaml`;
  repository.completedSafetyReviews = [{ file, text: '', data }];
  repository.registry.data.local_safety_review.completed_record_paths = [file];
  repository.registry.data.local_safety_review.status = 'approved_for_named_context';
  repository.registry.data.boundaries.local_safety_review_complete = true;
  repository.reviewDirectoryFiles.push(file);
  repository.reviewDirectoryFiles.sort();
  return repository.completedSafetyReviews[0];
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanArtifactReviewRepository({
    rootDir: process.cwd(),
    artifactId: PROFILE.artifactId,
  });
});

test('production review packet is exact, pending, and contains no completed human evidence', () => {
  const result = validateTeacherWorkPlanArtifactReviewRepository(baseline);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.summary, {
    review_registries: 1,
    teacher_review_templates: 1,
    local_safety_review_templates: 1,
    completed_teacher_reviews: 0,
    completed_safety_reviews: 0,
    classroom_trial_templates: 1,
    completed_classroom_trials: 0,
    teacher_status: 'pending',
    safety_status: 'pending',
    classroom_trial: 'not_tested',
    fingerprint: FINGERPRINT,
  });
  assert.deepEqual(baseline.reviewDirectoryFiles, [
    TRIAL_GUIDE_PATH,
    TRIAL_TEMPLATE_PATH,
    GUIDE_PATH,
    SAFETY_TEMPLATE_PATH,
    REVIEW_REGISTRY_PATH,
    TEACHER_TEMPLATE_PATH,
  ].sort());
});

test('registry and templates pin the exact artifact without inventing reviewer identity', () => {
  assert.equal(baseline.registry.data.artifact_id, 'grade-6-science-soil-organisms');
  assert.equal(baseline.registry.data.artifact_index_path, INDEX_PATH);
  assert.equal(baseline.registry.data.content_fingerprint, FINGERPRINT);
  assert.equal(baseline.teacherTemplate.data.template, true);
  assert.equal(baseline.safetyTemplate.data.template, true);
  for (const template of [baseline.teacherTemplate.data, baseline.safetyTemplate.data]) {
    assert.deepEqual(Object.values(template.review_identity), [null, null, null, null, null, null]);
    assert.equal(template.decision.status, 'pending');
    assert.equal(template.decision.reviewed_fingerprint_matches, false);
    assert.equal(template.review_scope.every(({ status }) => status === 'not_reviewed'), true);
  }
});

test('reusable artifact dependency, hashes, and fingerprint remain exact', () => {
  const artifact = baseline.reusableRepository.artifacts[0].data;
  assert.deepEqual(artifact.materials.map(({ sha256 }) => sha256), MATERIAL_HASHES);
  assert.equal(artifact.content_fingerprint.value, FINGERPRINT);
  assert.deepEqual(artifact.human_review, {
    registry_path: REVIEW_REGISTRY_PATH,
    teacher_review: { status: 'pending', completed_record_path: null },
    local_safety_review: { status: 'pending', completed_record_path: null },
    classroom_trial: {
      workflow_created: true,
      template_path: TRIAL_TEMPLATE_PATH,
      status: 'not_tested',
      completed_record_path: null,
    },
    reviewed_content_fingerprint: null,
  });
  assert.equal(artifact.readiness.classroom_ready, false);
  assert.equal(artifact.readiness.publication_ready, false);
  assert.equal(artifact.readiness.effectiveness_claimed, false);
});

test('in-memory completed teacher and named-context safety records satisfy future rules', () => {
  const teacherRepository = cloneRepository();
  completedTeacherReview(teacherRepository);
  assert.deepEqual(
    validateTeacherWorkPlanArtifactReviewRepository(teacherRepository, { allowCompletedRecords: true }).diagnostics,
    [],
  );
  const safetyRepository = cloneRepository();
  completedSafetyReview(safetyRepository);
  assert.deepEqual(
    validateTeacherWorkPlanArtifactReviewRepository(safetyRepository, { allowCompletedRecords: true }).diagnostics,
    [],
  );
});

const productionMutations = [
  ['wrong fingerprint', (repo) => { repo.registry.data.content_fingerprint = '0'.repeat(64); }, /fingerprint/u],
  ['wrong artifact ID', (repo) => { repo.registry.data.artifact_id = 'other-artifact'; }, /artifact ID|constant/u],
  ['wrong route', (repo) => { repo.teacherTemplate.data.artifact_identity.route = 'grade-7-science'; }, /registered artifact identity/u],
  ['missing guide', (repo) => { repo.guideText = null; }, /guide is missing/u],
  ['extra file', (repo) => { repo.reviewDirectoryFiles.push(`${SOIL_ORGANISMS_REVIEW_ROOT}/extra.yaml`); }, /missing or extra file/u],
  ['missing teacher template', (repo) => { repo.teacherTemplate = null; }, /teacher-review template|missing or extra/u],
  ['template outside root', (repo) => { repo.registry.data.teacher_review.template_path = 'docs/template.yaml'; }, /review root|template path|constant/u],
  ['reviewer identity added to template', (repo) => { repo.teacherTemplate.data.review_identity.reviewer_name = 'Invented Reviewer'; }, /invented|must be null/u],
  ['teacher template approved', (repo) => { repo.teacherTemplate.data.decision.status = 'approved'; }, /template|pending/u],
  ['teacher status promoted', (repo) => { repo.registry.data.teacher_review.status = 'approved'; }, /derived|review completion/u],
  ['safety status promoted', (repo) => { repo.registry.data.local_safety_review.status = 'approved_for_named_context'; }, /derived|safety completion/u],
  ['classroom trial promoted', (repo) => { repo.registry.data.classroom_trial.status = 'tested'; }, /not_tested|constant/u],
  ['classroom readiness promoted', (repo) => { repo.registry.data.boundaries.classroom_ready = true; }, /positive analysed trial|cannot be inferred/u],
  ['publication promoted', (repo) => { repo.registry.data.boundaries.publication_ready = true; }, /cannot be promoted|constant/u],
  ['effectiveness promoted', (repo) => { repo.registry.data.boundaries.effectiveness_claimed = true; }, /cannot be promoted|constant/u],
  ['unknown field', (repo) => { repo.teacherTemplate.data.unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of productionMutations) {
  test(`rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

const completedTeacherMutations = [
  ['completed record without reviewer', (entry) => { entry.data.review_identity.reviewer_id = null; }, /reviewer identity/u],
  ['completed record without date', (entry) => { entry.data.review_identity.review_date = null; }, /identity and date/u],
  ['completed record with stale fingerprint', (entry) => { entry.data.artifact_identity.content_fingerprint = '0'.repeat(64); }, /registered artifact fingerprint/u],
  ['incomplete scope', (entry) => { entry.data.review_scope[0].status = 'not_reviewed'; }, /review every required scope/u],
  ['open blocking finding with approval', (entry) => {
    entry.data.findings.push({
      finding_id: 'synthetic-blocker', severity: 'blocking', area: 'scientific_accuracy',
      description: 'Synthetic blocking test finding.', required_change: 'Fix synthetic blocker.',
      affected_paths: [`${PILOT_ROOT}/teacher-guide.md`], status: 'open', resolution_notes: null,
    });
    entry.data.review_scope[0].finding_ids = ['synthetic-blocker'];
    entry.data.decision.open_blocking_findings = ['synthetic-blocker'];
  }, /approval cannot coexist/u],
  ['open major finding with approval', (entry) => {
    entry.data.findings.push({
      finding_id: 'synthetic-major', severity: 'major', area: 'instructional_clarity',
      description: 'Synthetic major test finding.', required_change: 'Fix synthetic major finding.',
      affected_paths: [`${PILOT_ROOT}/student-worksheet.md`], status: 'open', resolution_notes: null,
    });
    entry.data.review_scope[2].finding_ids = ['synthetic-major'];
    entry.data.decision.open_major_findings = ['synthetic-major'];
  }, /approval cannot coexist/u],
  ['unresolved required change with approval', (entry) => {
    entry.data.findings.push({
      finding_id: 'synthetic-minor', severity: 'minor', area: 'assessment_alignment',
      description: 'Synthetic minor test finding.', required_change: 'Apply synthetic change.',
      affected_paths: [`${PILOT_ROOT}/assessment-rubric.md`], status: 'open', resolution_notes: null,
    });
    entry.data.review_scope[4].finding_ids = ['synthetic-minor'];
  }, /required changes/u],
  ['invalid affected path', (entry) => {
    entry.data.findings.push({
      finding_id: 'synthetic-path', severity: 'note', area: 'readiness_claims',
      description: 'Synthetic invalid path finding.', required_change: null,
      affected_paths: ['docs/outside.md'], status: 'accepted_risk', resolution_notes: null,
    });
    entry.data.review_scope[9].finding_ids = ['synthetic-path'];
  }, /registered artifact root/u],
];

for (const [name, mutate, pattern] of completedTeacherMutations) {
  test(`future completed teacher record rejects ${name}`, () => {
    const repository = cloneRepository();
    const entry = completedTeacherReview(repository);
    mutate(entry);
    expectInvalid(repository, pattern, { allowCompletedRecords: true });
  });
}

test('future safety approval rejects missing named context', () => {
  const repository = cloneRepository();
  const entry = completedSafetyReview(repository);
  entry.data.local_context.site_description = null;
  expectInvalid(repository, /named context/u, { allowCompletedRecords: true });
});

test('future safety approval rejects a universal safety claim', () => {
  const repository = cloneRepository();
  const entry = completedSafetyReview(repository);
  entry.data.safety_boundaries.universal_safety_claimed = true;
  expectInvalid(repository, /context-specific|equal to constant/u, { allowCompletedRecords: true });
});

for (const [name, pathName, transform] of [
  ['YAML duplicate key', REVIEW_REGISTRY_PATH, (text) => text.replace('artifact_id: grade-6-science-soil-organisms', 'artifact_id: grade-6-science-soil-organisms\nartifact_id: duplicate')],
  ['YAML alias', TEACHER_TEMPLATE_PATH, (text) => text.replace('reviewer_name: null', 'reviewer_name: *missing')],
  ['YAML anchor', SAFETY_TEMPLATE_PATH, (text) => text.replace('reviewer_name: null', 'reviewer_name: &name null')],
  ['YAML tab', TEACHER_TEMPLATE_PATH, (text) => `${text}\t`],
]) {
  test(`strict loader rejects ${name}`, async () => {
    const original = await fs.readFile(pathName, 'utf8');
    const repository = await loadTeacherWorkPlanArtifactReviewRepository({
      rootDir: process.cwd(),
      artifactId: PROFILE.artifactId,
      fileOverrides: new Map([[pathName, transform(original)]]),
    });
    expectInvalid(repository, /YAML|duplicate|alias|anchor|tab|missing/iu);
  });
}

test('review validation is deterministic', () => {
  const first = validateTeacherWorkPlanArtifactReviewRepository(cloneRepository());
  const second = validateTeacherWorkPlanArtifactReviewRepository(cloneRepository());
  assert.deepEqual(first, second);
});
