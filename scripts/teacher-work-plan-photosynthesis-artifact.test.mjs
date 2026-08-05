import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  computeTeacherWorkPlanArtifactFingerprint,
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './lib/teacher-work-plan-reusable-artifacts.mjs';
import {
  loadTeacherWorkPlanArtifactReviewRepository,
  validateTeacherWorkPlanArtifactReviewRepository,
} from './lib/teacher-work-plan-artifact-reviews.mjs';
import {
  loadTeacherWorkPlanArtifactClassroomTrialRepository,
  validateTeacherWorkPlanArtifactClassroomTrialRepository,
} from './lib/teacher-work-plan-artifact-classroom-trials.mjs';

const ARTIFACT_ID = 'grade-6-science-photosynthesis';
const PROFILE_ID = 'grade-6-science-photosynthesis-v1';
const ROOT = 'teacher-work-plan-artifacts/grade-6-science/photosynthesis';
const INDEX_PATH = `${ROOT}/artifact-index.yaml`;
const REVIEW_REGISTRY_PATH = `${ROOT}/reviews/review-registry.yaml`;
const TRIAL_TEMPLATE_PATH = `${ROOT}/reviews/classroom-trial-template.yaml`;
const FINGERPRINT = '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45';
const SOIL_FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';
const CAPABILITIES = [
  'practical_protocol',
  'observation_table',
  'student_worksheet',
  'answer_key',
  'assessment_rubric',
];
const MATERIAL_HASHES = {
  'practical-protocol.md': '46cc3a4e994c4aee22f870bcc72d434e595c25af5ab091a507772c11a933005a',
  'observation-table.md': '0b2524c4fbea58e25ec6b7964fd99217826613ad77d20af1b60f84fea8dc3832',
  'student-worksheet.md': '9d0222d98be417ffb9df8ce76e79234f9a240555a78942b62771a98c217da48d',
  'answer-key.md': '240ca98450270780ae8a9853baaa08b7e9dd85733108d81df21e0e49b379e3a9',
  'assessment-rubric.md': '02fe424cbf3be7a1bbcef6c3160b187127977cbe9b98b9cf5dfe684c079e7d5c',
};
const TERMS = ['fotosüntees', 'valgus', 'süsinikdioksiid', 'vesi', 'hapnik', 'gaasimull'];
const TRIAL_DIMENSIONS = [
  'timing', 'setup_and_transitions', 'instruction_comprehension', 'practical_safety',
  'variable_control', 'crossover_execution', 'observation_and_data_recording',
  'calculation_accuracy', 'evidence_vs_interpretation', 'material_usability',
  'accessibility_and_participation', 'cleanup_and_non_release',
  'immediate_recall_and_transfer', 'method_naturalness',
];

let baseline;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function cloneEntry(entry) {
  return entry && { ...entry, data: structuredClone(entry.data) };
}

function cloneRepository(repository = baseline) {
  const artifacts = repository.artifacts.map((entry) => ({
    ...entry,
    data: structuredClone(entry.data),
    materialBytes: new Map([...entry.materialBytes].map(([key, value]) => [key, value && Buffer.from(value)])),
  }));
  const artifactByFile = new Map(artifacts.map((entry) => [entry.file, entry]));
  const profiles = Object.fromEntries(Object.entries(repository.registryRepository.profiles)
    .map(([key, value]) => [key, structuredClone(value)]));
  const artifactContexts = repository.artifactContexts.map((context) => ({
    ...context,
    registryEntry: structuredClone(context.registryEntry),
    profile: profiles[context.registryEntry.validation_profile_id],
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
    registryRepository: {
      ...repository.registryRepository,
      registry: cloneEntry(repository.registryRepository.registry),
      indexes: repository.registryRepository.indexes.map(cloneEntry),
      profiles,
      discoveredIndexPaths: [...repository.registryRepository.discoveredIndexPaths],
      loadDiagnostics: structuredClone(repository.registryRepository.loadDiagnostics),
    },
    schema: structuredClone(repository.schema),
    gapReport: structuredClone(repository.gapReport),
    manifest: structuredClone(repository.manifest),
    languageProfiles: structuredClone(repository.languageProfiles),
    workPackageRepository: {
      ...repository.workPackageRepository,
      artifact: structuredClone(repository.workPackageRepository.artifact),
      schema: structuredClone(repository.workPackageRepository.schema),
    },
    loadDiagnostics: structuredClone(repository.loadDiagnostics),
  };
}

function photoContext(repository = baseline) {
  return repository.artifactById.get(ARTIFACT_ID);
}

function photoData(repository = baseline) {
  return photoContext(repository).indexEntry.data;
}

function materialText(filename, repository = baseline) {
  const bytes = photoContext(repository).indexEntry.materialBytes.get(`${ROOT}/${filename}`);
  return bytes.toString('utf8');
}

function replaceMaterial(repository, filename, transform) {
  const context = photoContext(repository);
  const materialPath = `${ROOT}/${filename}`;
  const bytes = Buffer.from(transform(context.indexEntry.materialBytes.get(materialPath).toString('utf8')), 'utf8');
  context.indexEntry.materialBytes.set(materialPath, bytes);
  const material = context.indexEntry.data.materials.find(({ artifact_path }) => artifact_path === materialPath);
  material.sha256 = sha256(bytes);
  context.indexEntry.data.content_fingerprint.value = computeTeacherWorkPlanArtifactFingerprint(context.indexEntry.data.materials);
}

function diagnosticText(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern = /./u) {
  const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(diagnosticText(result), pattern);
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: process.cwd() });
});

test('photosynthesis production artifact validates with exact identity, route, package and gap', () => {
  const result = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  assert.deepEqual(result.diagnostics, []);
  const context = photoContext();
  const data = context.indexEntry.data;
  assert.equal(context.profile.profileId, PROFILE_ID);
  assert.equal(data.artifact_id, ARTIFACT_ID);
  assert.equal(data.package_id, ARTIFACT_ID);
  assert.equal(data.canonical_route.source_id, 'grade-6-science');
  assert.equal(data.canonical_route.md_path, 'project-files/outputs/opiq_6klass_loodusopetus.md');
  assert.deepEqual(data.source_gaps, [context.profile.sourceGaps[0]]);
  assert.deepEqual(data.source_gaps[0], {
    gap_id: 'grade-6-science-lesson-016', mapping_id: 'lesson-016',
    source_record_kind: 'lesson_range', source_block_id: 'aed-ja-pold-elukeskkonnana',
    lesson_span: { lesson_start: 16, lesson_end: 16 }, source_pages: [6],
    source_topic_et: 'Fotosüntees', normalized_mapping_topic_et: 'Fotosüntees',
    coverage_status: 'missing', bridge_type: 'independently_authored_practical_required',
    topic_inventory_refs: ['garden-and-field-ecosystems'],
  });
  assert.equal(context.dependencies.crosswalk.lesson_range_mappings
    .find(({ mapping_id }) => mapping_id === 'lesson-016').coverage_status, 'missing');
});

test('teacher-plan and independently authored boundaries are exact', () => {
  const data = photoData();
  assert.equal(data.teacher_plan_source.source_pdf_path, 'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf');
  assert.equal(data.teacher_plan_source.source_sha256, '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762');
  assert.equal(data.teacher_plan_source.source_page_count, 31);
  assert.deepEqual(data.teacher_plan_source.relevant_source_pages, [6]);
  assert.equal(data.teacher_plan_source.provenance_kind, 'supplementary_teacher_work_plan');
  assert.equal(data.teacher_plan_source.canonical, false);
  assert.equal(data.content_boundary.pupil_facing_science_provenance, 'independently_authored');
  assert.equal(data.content_boundary.opiq_required, false);
  assert.equal(data.content_boundary.external_sources_used, false);
});

test('zero-context and zero-URL package is complete without Opiq evidence', () => {
  const data = photoData();
  assert.deepEqual(data.opiq_context_records, []);
  assert.deepEqual(photoContext().profile.contextRecords, []);
  assert.deepEqual(photoContext().profile.urlAllowedPaths, []);
  for (const filename of Object.keys(MATERIAL_HASHES)) assert.doesNotMatch(materialText(filename), /https?:\/\//u);
});

test('five material capabilities, hashes and aggregate fingerprint are exact', () => {
  const data = photoData();
  assert.deepEqual(data.materials.map(({ capability }) => capability), CAPABILITIES);
  assert.deepEqual(Object.fromEntries(data.materials.map(({ artifact_path, sha256: hash }) => [artifact_path.split('/').at(-1), hash])), MATERIAL_HASHES);
  assert.equal(data.content_fingerprint.value, FINGERPRINT);
  assert.equal(computeTeacherWorkPlanArtifactFingerprint(data.materials), FINGERPRINT);
  assert.equal(baseline.artifactById.get('grade-6-science-soil-organisms').indexEntry.data.content_fingerprint.value, SOIL_FINGERPRINT);
});

test('one lesson part, six terms, A2 support and safety applicability are exact', () => {
  const data = photoData();
  assert.deepEqual(data.lesson_sequence.map(({ part_id, source_gap_id, duration_minutes }) => ({ part_id, source_gap_id, duration_minutes })), [
    { part_id: 'part-1', source_gap_id: 'grade-6-science-lesson-016', duration_minutes: 45 },
  ]);
  assert.equal(data.learner_language_profile.profile_id, 'grade-6-science-a2-default');
  assert.equal(data.learner_language_profile.learner_language_level, 'A2');
  assert.deepEqual(data.language_support.productive_terms.map(({ et }) => et), TERMS);
  assert.deepEqual(data.safety_and_ethics, {
    ...data.safety_and_ethics,
    fieldwork_applicable: false,
    local_risk_assessment_applicable: true,
    protected_area_permission_applicable: false,
    indoor_fallback_applicable: false,
    local_teacher_risk_assessment_required: true,
    universal_safety_claimed: false,
    protected_area_permission_is_teacher_responsibility: false,
    indoor_fallback_available: false,
  });
});

test('materials preserve exact method, scientific and language guards', () => {
  const all = Object.keys(MATERIAL_HASHES).map((filename) => materialText(filename)).join('\n');
  for (const expected of [
    '1.0 g/L', '200 мл', '8 ± 1 см', '20 см', '5 минут акклиматизации',
    'три интервала по 1 минуте', 'Поменяйте побеги условиями', 'не более 2 °C',
    'не собраны в природе', 'никогда не выпускают в природные водоёмы',
    'соединения находятся вне поддона', 'косвенный показатель',
    'Полный модельный ответ по-русски',
    'Fotosüntees vajab valgust, vett ja süsinikdioksiidi.',
    'слабый эстонский не уменьшает научный балл',
  ]) assert.match(all, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(materialText('answer-key.md'), /9\.0 bubbles\/min/u);
  assert.match(materialText('answer-key.md'), /2\.5 bubbles\/min/u);
  assert.match(materialText('answer-key.md'), /6\.5 bubbles\/min/u);
});

test('human-review and classroom-trial workflows are exact and still non-evidence', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  assert.deepEqual(validateTeacherWorkPlanArtifactReviewRepository(reviews).diagnostics, []);
  assert.equal(reviews.registry.file, REVIEW_REGISTRY_PATH);
  assert.equal(reviews.registry.data.teacher_review.status, 'pending');
  assert.equal(reviews.registry.data.local_safety_review.status, 'pending');
  assert.deepEqual(reviews.registry.data.teacher_review.completed_record_paths, []);
  assert.deepEqual(reviews.registry.data.local_safety_review.completed_record_paths, []);
  for (const template of [reviews.teacherTemplate, reviews.safetyTemplate]) {
    assert.equal(template.data.template, true);
    assert.equal(template.data.review_identity.reviewer_id, null);
    assert.equal(template.data.decision.status, 'pending');
  }
  const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  assert.deepEqual(validateTeacherWorkPlanArtifactClassroomTrialRepository(trials).diagnostics, []);
  assert.equal(trials.trialTemplate.file, TRIAL_TEMPLATE_PATH);
  assert.equal(trials.trialTemplate.data.lifecycle.status, 'draft');
  assert.equal(trials.trialTemplate.data.decision.status, 'pending');
  assert.deepEqual(trials.trialTemplate.data.part_observations[0].dimensions.map(({ dimension_id }) => dimension_id), TRIAL_DIMENSIONS);
});

test('readiness, publication, effectiveness and source-resolution claims remain false', () => {
  const data = photoData();
  assert.equal(data.readiness.classroom_ready, false);
  assert.equal(data.readiness.publication_ready, false);
  assert.equal(data.readiness.customer_released, false);
  assert.equal(data.readiness.effectiveness_claimed, false);
  assert.equal(data.source_gap_support.canonical_opiq_gap_status_unchanged, true);
  assert.equal(data.source_gap_support.source_gap_resolution_claimed, false);
});

const artifactMutations = [
  ['extra Opiq context record', (repo) => { photoData(repo).opiq_context_records.push(structuredClone(repo.artifactById.get('grade-6-science-soil-organisms').profile.contextRecords[0])); }, /context records differ|zero/u],
  ['wrong route', (repo) => { photoData(repo).canonical_route.source_id = 'grade-5-science'; }, /canonical route|route/u],
  ['wrong gap', (repo) => { photoData(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-008'; }, /source-gap|source gaps differ/u],
  ['partial promotion', (repo) => { photoData(repo).source_gaps[0].coverage_status = 'partial'; }, /source-gap|source gaps differ/u],
  ['wrong source page', (repo) => { photoData(repo).source_gaps[0].source_pages = [7]; }, /source-gap|source gaps differ/u],
  ['wrong PDF SHA', (repo) => { photoData(repo).teacher_plan_source.source_sha256 = '0'.repeat(64); }, /teacher-plan source|extraction/u],
  ['wrong capability', (repo) => { photoData(repo).materials[0].capability = 'teacher_guide'; }, /capabilit/u],
  ['missing material', (repo) => { photoData(repo).materials.pop(); }, /material/u],
  ['extra material', (repo) => { photoData(repo).materials.push({ ...structuredClone(photoData(repo).materials[0]), material_id: 'extra', artifact_path: `${ROOT}/extra.md` }); }, /material/u],
  ['material outside root', (repo) => { photoData(repo).materials[0].artifact_path = 'teacher-work-plan-artifacts/grade-5-science/outside.md'; }, /inside|material path|paths differ/u],
  ['stale material hash', (repo) => { photoData(repo).materials[0].sha256 = '0'.repeat(64); }, /hash/u],
  ['stale fingerprint', (repo) => { photoData(repo).content_fingerprint.value = '0'.repeat(64); }, /fingerprint/u],
  ['wrong answer-key link', (repo) => { photoData(repo).materials[1].answer_key_path = `${ROOT}/other.md`; }, /answer key/u],
  ['local risk assessment disabled', (repo) => { photoData(repo).safety_and_ethics.local_teacher_risk_assessment_required = false; }, /risk-assessment|safety/u],
  ['protected-area applicability promoted', (repo) => { photoData(repo).safety_and_ethics.protected_area_permission_applicable = true; }, /applicability|safety/u],
  ['indoor fallback applicability promoted', (repo) => { photoData(repo).safety_and_ethics.indoor_fallback_applicable = true; }, /applicability|safety/u],
  ['review status promoted', (repo) => { photoData(repo).human_review.teacher_review.status = 'approved'; }, /review|constant/u],
  ['trial status promoted', (repo) => { photoData(repo).human_review.classroom_trial.status = 'successful'; }, /trial|constant/u],
  ['classroom ready promoted', (repo) => { photoData(repo).readiness.classroom_ready = true; }, /classroom_ready|constant/u],
  ['publication promoted', (repo) => { photoData(repo).readiness.publication_ready = true; }, /publication_ready|constant/u],
  ['effectiveness claimed', (repo) => { photoData(repo).readiness.effectiveness_claimed = true; }, /effectiveness|constant/u],
  ['source gap marked resolved', (repo) => { photoData(repo).source_gap_support.source_gap_resolution_claimed = true; }, /resolution|constant/u],
  ['unknown field', (repo) => { photoData(repo).unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of artifactMutations) {
  test(`photosynthesis rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

const materialMutations = [
  ['any URL', 'student-worksheet.md', (text) => `${text}\nhttps://example.invalid\n`, /URL|url/u],
  ['omitted scientific limitation', 'practical-protocol.md', (text) => text.replace('не измеряет объём кислорода напрямую', 'даёт иной показатель'), /protocol is missing/u],
  ['direct oxygen-volume claim', 'practical-protocol.md', (text) => text.replace('не измеряет объём кислорода напрямую', 'точно измеряет объём кислорода'), /protocol is missing/u],
  ['exact photosynthesis-rate claim', 'practical-protocol.md', (text) => text.replaceAll('не является точным измерением скорости фотосинтеза', 'является точным измерением скорости фотосинтеза'), /protocol is missing/u],
  ['wild collection allowed', 'practical-protocol.md', (text) => text.replaceAll('Дикорастущие водные растения не собирают', 'Дикорастущие водные растения можно собирать'), /protocol is missing/u],
  ['plant release allowed', 'practical-protocol.md', (text) => text.replaceAll('никогда не выпускают в природные водоёмы', 'можно выпускать в природные водоёмы'), /protocol is missing/u],
  ['electrical spill guard removed', 'practical-protocol.md', (text) => text.replace('соединения находятся вне поддона', 'соединения размещены рядом'), /protocol is missing/u],
];

for (const [name, filename, transform, pattern] of materialMutations) {
  test(`photosynthesis rejects ${name}`, () => {
    const repository = cloneRepository();
    replaceMaterial(repository, filename, transform);
    expectInvalid(repository, pattern);
  });
}

test('photosynthesis review template rejects invented reviewer identity', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  reviews.teacherTemplate.data.review_identity.reviewer_name = 'Invented Reviewer';
  const result = validateTeacherWorkPlanArtifactReviewRepository(reviews);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(diagnosticText(result), /identity|template/u);
});

test('future named-context safety review accepts indoor_classroom without promoting readiness', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  const data = structuredClone(reviews.safetyTemplate.data);
  data.template = false;
  data.review_identity = {
    review_id: 'synthetic-photosynthesis-safety-001',
    reviewer_id: 'synthetic-safety-reviewer',
    reviewer_name: 'Synthetic Safety Reviewer',
    reviewer_role: 'local safety reviewer',
    organization: 'Synthetic School',
    review_date: '2026-08-05',
  };
  data.local_context = {
    school_or_organization: 'Synthetic School',
    site_description: 'Synthetic science classroom 204',
    planned_activity_date: '2026-08-12',
    group_size: 18,
    adult_supervision_count: 2,
    delivery_site_category: 'indoor_classroom',
    indoor_fallback_permitted: false,
    weather_limitations: 'Indoor activity only; cool LED remains at 20 cm.',
    accessibility_adjustments: 'Stable seated station and clear spill-free route.',
    permission_requirements: 'Named classroom approval only.',
    emergency_contact_process: 'Use the school incident process.',
  };
  for (const item of data.review_scope) {
    item.status = 'acceptable';
    item.notes = 'Synthetic in-memory contract check.';
  }
  data.decision = {
    status: 'approved_for_named_context',
    rationale: 'Synthetic in-memory named-context validation only.',
    open_blocking_findings: [], open_major_findings: [],
    required_changes_complete: true, reviewed_fingerprint_matches: true,
    conditions: ['Keep electrical connections outside the spill tray.'],
  };
  const file = `${ROOT}/reviews/synthetic-safety-review.yaml`;
  reviews.completedSafetyReviews = [{ file, text: '', data }];
  reviews.registry.data.local_safety_review.completed_record_paths = [file];
  reviews.registry.data.local_safety_review.status = 'approved_for_named_context';
  reviews.registry.data.boundaries.local_safety_review_complete = true;
  reviews.reviewDirectoryFiles.push(file);
  reviews.reviewDirectoryFiles.sort();
  reviews.artifactContext.dependencies.reviewRegistry.data = structuredClone(reviews.registry.data);
  const result = validateTeacherWorkPlanArtifactReviewRepository(reviews, { allowCompletedRecords: true });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(reviews.registry.data.boundaries.classroom_ready, false);
});

for (const [name, text] of [
  ['duplicate key', 'schema_version: "1.0"\nschema_version: "1.0"\n'],
  ['alias', 'schema_version: *missing\n'],
  ['anchor', 'schema_version: &version "1.0"\n'],
  ['tab', 'schema_version:\t"1.0"\n'],
]) {
  test(`photosynthesis strict YAML rejects ${name}`, async () => {
    const repository = await loadTeacherWorkPlanReusableArtifactRepository({
      rootDir: process.cwd(),
      artifactOverrides: new Map([[INDEX_PATH, text]]),
    });
    expectInvalid(repository, /YAML|duplicate|alias|anchor|tab|missing/iu);
  });
}

test('photosynthesis validation and production artifact ordering are deterministic', () => {
  const first = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  const repository = cloneRepository();
  repository.artifactContexts.reverse();
  repository.artifacts.reverse();
  repository.registryRepository.indexes.reverse();
  repository.registryRepository.registry.data.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(repository), first);
});
