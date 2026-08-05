import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

const ARTIFACT_ID = 'grade-6-science-garden-field-food-products';
const ROOT = 'teacher-work-plan-artifacts/grade-6-science/garden-field-food-products';
const INDEX_PATH = `${ROOT}/artifact-index.yaml`;
const FINGERPRINT = '999eb50584622bb35dd017a34d7b83536c4face4ebaccd98d12d7768518280ad';
const SOIL_FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';
const PHOTOSYNTHESIS_FINGERPRINT = '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45';
const CAPABILITIES = ['practical_protocol', 'observation_table', 'student_worksheet', 'answer_key'];
const MATERIAL_HASHES = {
  'practical-protocol.md': '54677a6768c372c10c06ba7075c0359a1467eb55ee3476973ecfc1d4009d9858',
  'observation-table.md': '13710c58c30eede15f793cd1c0ffc32a34ad84e11fd3f34f1c92556c65ae2606',
  'student-worksheet.md': '200cea52f26628c42b5bdfc81f94a3e234e3df0b9b821ccf71fca18926a0dff3',
  'answer-key.md': 'b41579b0ad50e975c20848d48aab87ac5d9b9d8c41f05d3d7f6bf37889820924',
};
const TERMS = ['aiasaadus', 'põllusaadus', 'toiduaine', 'taimeosa', 'töötlemine', 'koostisosa'];
const TRIAL_DIMENSIONS = [
  'timing', 'setup_and_transitions', 'instruction_comprehension',
  'no_tasting_safety', 'allergy_and_hygiene_controls', 'source_card_use',
  'plant_part_classification', 'transformation_classification',
  'evidence_and_uncertainty_recording', 'count_and_percentage_calculation',
  'conclusion_quality', 'material_usability', 'accessibility_and_participation',
  'cleanup_and_disposal', 'estonian_language_support', 'method_naturalness',
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

function context(repository = baseline) {
  return repository.artifactById.get(ARTIFACT_ID);
}

function data(repository = baseline) {
  return context(repository).indexEntry.data;
}

function materialText(filename, repository = baseline) {
  return context(repository).indexEntry.materialBytes.get(`${ROOT}/${filename}`).toString('utf8');
}

function replaceMaterial(repository, filename, transform) {
  const materialPath = `${ROOT}/${filename}`;
  const bytes = Buffer.from(transform(context(repository).indexEntry.materialBytes.get(materialPath).toString('utf8')), 'utf8');
  context(repository).indexEntry.materialBytes.set(materialPath, bytes);
  const material = data(repository).materials.find(({ artifact_path }) => artifact_path === materialPath);
  material.sha256 = sha256(bytes);
  data(repository).content_fingerprint.value = computeTeacherWorkPlanArtifactFingerprint(data(repository).materials);
}

function diagnostics(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern = /./u) {
  const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(diagnostics(result), pattern);
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: process.cwd() });
});

test('garden-field production artifact validates with exact identity, package, route and lesson-022 snapshot', () => {
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(baseline).diagnostics, []);
  assert.equal(data().artifact_id, ARTIFACT_ID);
  assert.equal(data().package_id, ARTIFACT_ID);
  assert.equal(data().canonical_route.source_id, 'grade-6-science');
  assert.deepEqual(data().source_gaps, [{
    gap_id: 'grade-6-science-lesson-022', mapping_id: 'lesson-022',
    source_record_kind: 'lesson_range', source_block_id: 'aed-ja-pold-elukeskkonnana',
    lesson_span: { lesson_start: 22, lesson_end: 22 }, source_pages: [8],
    source_topic_et: 'Põlluja aiasaadused kui toiduained',
    normalized_mapping_topic_et: 'Põlluja aiasaadused kui toiduained',
    coverage_status: 'missing', bridge_type: 'independently_authored_practical_required',
    topic_inventory_refs: ['garden-and-field-ecosystems'],
  }]);
  const mapping = context().dependencies.crosswalk.lesson_range_mappings
    .find(({ mapping_id }) => mapping_id === 'lesson-022');
  assert.equal(mapping.coverage_status, 'missing');
  assert.deepEqual(mapping.opiq_matches, []);
});

test('teacher-plan provenance preserves page 8, exact PDF and independently authored boundary', () => {
  assert.equal(data().teacher_plan_source.source_pdf_path, 'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf');
  assert.equal(data().teacher_plan_source.original_filename, 'Loodusõpetuse-töökava-näidis-6.-klassile.pdf');
  assert.equal(data().teacher_plan_source.source_sha256, '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762');
  assert.equal(data().teacher_plan_source.source_page_count, 31);
  assert.deepEqual(data().teacher_plan_source.relevant_source_pages, [8]);
  assert.equal(data().content_boundary.pupil_facing_science_provenance, 'independently_authored');
});

test('zero context records and zero URLs remain valid and complete', () => {
  assert.deepEqual(data().opiq_context_records, []);
  assert.deepEqual(context().profile.contextRecords, []);
  assert.deepEqual(context().profile.urlAllowedPaths, []);
  for (const filename of Object.keys(MATERIAL_HASHES)) assert.doesNotMatch(materialText(filename), /https?:\/\//u);
});

test('four capabilities, exact hashes, fingerprint and answer-key links are current', () => {
  assert.deepEqual(data().materials.map(({ capability }) => capability), CAPABILITIES);
  assert.deepEqual(Object.fromEntries(data().materials.map(({ artifact_path, sha256: hash }) => [artifact_path.split('/').at(-1), hash])), MATERIAL_HASHES);
  assert.equal(data().content_fingerprint.value, FINGERPRINT);
  assert.equal(computeTeacherWorkPlanArtifactFingerprint(data().materials), FINGERPRINT);
  assert.equal(data().materials.find(({ capability }) => capability === 'observation_table').answer_key_path, `${ROOT}/answer-key.md`);
  assert.equal(data().materials.find(({ capability }) => capability === 'student_worksheet').answer_key_path, `${ROOT}/answer-key.md`);
});

test('one 45-minute part, exact six terms and indoor-classroom local-risk applicability are exact', () => {
  assert.deepEqual(data().lesson_sequence.map(({ part_id, source_gap_id, duration_minutes }) => ({ part_id, source_gap_id, duration_minutes })), [
    { part_id: 'part-1', source_gap_id: 'grade-6-science-lesson-022', duration_minutes: 45 },
  ]);
  assert.deepEqual(data().language_support.productive_terms.map(({ et }) => et), TERMS);
  assert.equal(data().learner_language_profile.profile_id, 'grade-6-science-a2-default');
  assert.equal(data().safety_and_ethics.fieldwork_applicable, false);
  assert.equal(data().safety_and_ethics.local_risk_assessment_applicable, true);
  assert.equal(data().safety_and_ethics.local_teacher_risk_assessment_required, true);
  assert.equal(data().safety_and_ethics.protected_area_permission_applicable, false);
  assert.equal(data().safety_and_ethics.indoor_fallback_applicable, false);
});

test('materials preserve investigation, safety, evidence, calculation and language boundaries', () => {
  const all = Object.keys(MATERIAL_HASHES).map((filename) => materialText(filename)).join('\n');
  for (const expected of [
    'структурированное сравнение, а не причинный эксперимент',
    'Никакой дегустации или употребления', 'ученики не работают с лезвиями',
    'аллергии и риск перекрёстного контакта', 'карточку источника учителя',
    'percentage = count / total × 100', '3 / 8 × 100 = 37.5%',
    'Честные ответы `unknown` и `uncertain` допустимы',
    'не определяют полезность, качество, безопасность',
    'Полный модельный ответ по-русски', 'See toiduaine on valmistatud taimest.',
  ]) assert.match(all, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('review and trial packets are exact pending non-evidence workflows', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  assert.deepEqual(validateTeacherWorkPlanArtifactReviewRepository(reviews).diagnostics, []);
  assert.equal(reviews.registry.data.content_fingerprint, FINGERPRINT);
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
  assert.equal(trials.trialTemplate.data.lifecycle.status, 'draft');
  assert.equal(trials.trialTemplate.data.decision.status, 'pending');
  assert.deepEqual(trials.trialTemplate.data.part_observations[0].dimensions.map(({ dimension_id }) => dimension_id), TRIAL_DIMENSIONS);
});

test('readiness and resolution remain false while previous fingerprints remain unchanged', () => {
  assert.equal(data().readiness.classroom_ready, false);
  assert.equal(data().readiness.publication_ready, false);
  assert.equal(data().readiness.customer_released, false);
  assert.equal(data().readiness.effectiveness_claimed, false);
  assert.equal(data().source_gap_support.source_gap_resolution_claimed, false);
  assert.equal(baseline.artifactById.get('grade-6-science-soil-organisms').indexEntry.data.content_fingerprint.value, SOIL_FINGERPRINT);
  assert.equal(baseline.artifactById.get('grade-6-science-photosynthesis').indexEntry.data.content_fingerprint.value, PHOTOSYNTHESIS_FINGERPRINT);
});

const indexMutations = [
  ['extra context record', (repo) => { data(repo).opiq_context_records.push(structuredClone(repo.artifactById.get('grade-6-science-soil-organisms').profile.contextRecords[0])); }, /context records differ|zero/u],
  ['wrong route', (repo) => { data(repo).canonical_route.source_id = 'grade-5-science'; }, /route/u],
  ['wrong gap', (repo) => { data(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-016'; }, /source-gap|source gaps differ/u],
  ['coverage promotion', (repo) => { data(repo).source_gaps[0].coverage_status = 'partial'; }, /source-gap|source gaps differ/u],
  ['wrong page', (repo) => { data(repo).source_gaps[0].source_pages = [9]; }, /source-gap|source gaps differ/u],
  ['wrong PDF SHA', (repo) => { data(repo).teacher_plan_source.source_sha256 = '0'.repeat(64); }, /teacher-plan source|extraction/u],
  ['wrong capability', (repo) => { data(repo).materials[0].capability = 'assessment_rubric'; }, /capabilit/u],
  ['missing material', (repo) => { data(repo).materials.pop(); }, /material/u],
  ['extra material', (repo) => { data(repo).materials.push({ ...structuredClone(data(repo).materials[0]), material_id: 'extra', artifact_path: `${ROOT}/extra.md` }); }, /material/u],
  ['material outside root', (repo) => { data(repo).materials[0].artifact_path = 'teacher-work-plan-artifacts/grade-5-science/outside.md'; }, /inside|material path|paths differ/u],
  ['stale hash', (repo) => { data(repo).materials[0].sha256 = '0'.repeat(64); }, /hash/u],
  ['stale fingerprint', (repo) => { data(repo).content_fingerprint.value = '0'.repeat(64); }, /fingerprint/u],
  ['wrong answer-key path', (repo) => { data(repo).materials[1].answer_key_path = `${ROOT}/other.md`; }, /answer key/u],
  ['local risk assessment disabled', (repo) => { data(repo).safety_and_ethics.local_teacher_risk_assessment_required = false; }, /risk-assessment|safety/u],
  ['classroom ready promoted', (repo) => { data(repo).readiness.classroom_ready = true; }, /classroom_ready|constant/u],
  ['publication promoted', (repo) => { data(repo).readiness.publication_ready = true; }, /publication_ready|constant/u],
  ['effectiveness claimed', (repo) => { data(repo).readiness.effectiveness_claimed = true; }, /effectiveness|constant/u],
  ['source gap resolved', (repo) => { data(repo).source_gap_support.source_gap_resolution_claimed = true; }, /resolution|constant/u],
  ['unknown field', (repo) => { data(repo).unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of indexMutations) {
  test(`garden-field rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

const materialMutations = [
  ['any URL', 'student-worksheet.md', (text) => `${text}\nhttps://example.invalid\n`, /URL|url/u],
  ['tasting permitted', 'practical-protocol.md', (text) => text.replace('Никакой дегустации или употребления', 'Дегустация разрешена'), /protocol is missing/u],
  ['student knife use permitted', 'practical-protocol.md', (text) => text.replace('ученики не работают с лезвиями', 'ученики используют ножи'), /protocol is missing/u],
  ['allergy check removed', 'practical-protocol.md', (text) => text.replace('проверяет заявленные аллергии и риск перекрёстного контакта', 'проверяет набор'), /protocol is missing/u],
  ['universal garden-field classification', 'student-worksheet.md', (text) => text.replace('Используйте только карточку источника учителя', 'Определяйте происхождение по виду'), /worksheet is missing/u],
  ['healthiness inferred', 'answer-key.md', (text) => text.replace('не доказывают полезность, качество, безопасность или устойчивость', 'доказывают полезность'), /answer key is missing/u],
  ['sustainability inferred from packaging', 'answer-key.md', (text) => text.replace('Упаковка доказывает устойчивость или экологичность', 'Упаковка подтверждает устойчивость'), /answer key is missing/u],
  ['uncertainty removed', 'practical-protocol.md', (text) => text.replace('Честные ответы `unknown` и `uncertain` допустимы', 'Неопределённость запрещена'), /protocol is missing/u],
];

for (const [name, filename, transform, pattern] of materialMutations) {
  test(`garden-field rejects ${name}`, () => {
    const repository = cloneRepository();
    replaceMaterial(repository, filename, transform);
    expectInvalid(repository, pattern);
  });
}

test('garden-field review and safety templates reject invented or promoted evidence', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  reviews.teacherTemplate.data.review_identity.reviewer_name = 'Invented Reviewer';
  reviews.teacherTemplate.data.decision.status = 'approved';
  reviews.registry.data.local_safety_review.status = 'approved_for_named_context';
  const result = validateTeacherWorkPlanArtifactReviewRepository(reviews);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(diagnostics(result), /identity|template|status|safety/u);
});

test('garden-field classroom trial template rejects promoted status', async () => {
  const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  trials.trialTemplate.data.lifecycle.status = 'analysed';
  trials.trialTemplate.data.decision.status = 'successful';
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(trials);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(diagnostics(result), /template|pending|draft|decision/u);
});

for (const [name, text] of [
  ['duplicate key', 'schema_version: "1.0"\nschema_version: "1.0"\n'],
  ['alias', 'schema_version: *missing\n'],
  ['anchor', 'schema_version: &version "1.0"\n'],
  ['tab', 'schema_version:\t"1.0"\n'],
]) {
  test(`garden-field strict YAML rejects ${name}`, async () => {
    const repository = await loadTeacherWorkPlanReusableArtifactRepository({
      rootDir: process.cwd(), artifactOverrides: new Map([[INDEX_PATH, text]]),
    });
    expectInvalid(repository, /YAML|duplicate|alias|anchor|tab|missing/iu);
  });
}

test('garden-field validation is deterministic under reversed production order', () => {
  const first = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  const repository = cloneRepository();
  repository.artifactContexts.reverse();
  repository.artifacts.reverse();
  repository.registryRepository.indexes.reverse();
  repository.registryRepository.registry.data.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(repository), first);
});
