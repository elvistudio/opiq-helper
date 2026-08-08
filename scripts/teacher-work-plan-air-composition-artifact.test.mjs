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

const ARTIFACT_ID = 'grade-6-science-air-composition';
const ROOT = 'teacher-work-plan-artifacts/grade-6-science/air-composition';
const INDEX_PATH = `${ROOT}/artifact-index.yaml`;
const FINGERPRINT = 'afa6af267f874c14a79d4b89f29e4cc8722f1560a6352f368b0e94016788ffeb';
const MATERIAL_HASHES = {
  'practical-protocol.md': '79a27d13eec6d8003478101a0cf4210e718ce66dd69312f8ff2269a945d46eb3',
  'observation-table.md': '9cbdeb7c3f21166d47d44305b9bbd072b13a08701527ed76e9cc5c9440e66266',
  'student-worksheet.md': '519c9042c651c6e3008f79ea77b2335a447e3dc73e4f66cf9147c29ed461fba8',
  'answer-key.md': '1593c8e8b0c2d317f43291746c13a13c79b2472ebfa629f96e6af699b5f66c0a',
};
const PREVIOUS_FINGERPRINTS = {
  'grade-6-science-soil-organisms': '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613',
  'grade-6-science-photosynthesis': '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45',
  'grade-6-science-garden-field-food-products': '999eb50584622bb35dd017a34d7b83536c4face4ebaccd98d12d7768518280ad',
  'grade-6-science-wood-processing': '59689bce711416a1cab4c8df5c5d75113c8e4a1fdec1d5aafc5ed9ecb8981436',
};
const TERMS = ['õhk', 'lämmastik', 'hapnik', 'süsinikdioksiid', 'gaas', 'osakaal'];
const DIMENSIONS = [
  'timing', 'setup_and_transitions', 'instruction_comprehension',
  'grid_construction_accuracy', 'count_verification', 'percentage_calculation',
  'other_gases_and_co2_distinction', 'model_vs_measurement', 'evidence_vs_inference',
  'russian_explanation', 'estonian_language_support', 'material_usability',
  'accessibility_and_participation', 'immediate_recall_and_transfer', 'method_naturalness',
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
  const artifactContexts = repository.artifactContexts.map((entry) => ({
    ...entry,
    registryEntry: structuredClone(entry.registryEntry),
    profile: profiles[entry.registryEntry.validation_profile_id],
    route: structuredClone(entry.route),
    indexEntry: artifactByFile.get(entry.indexEntry.file),
    dependencies: entry.dependencies && {
      ...entry.dependencies,
      paths: structuredClone(entry.dependencies.paths),
      topicInventory: structuredClone(entry.dependencies.topicInventory),
      bookInventory: structuredClone(entry.dependencies.bookInventory),
      crosswalk: structuredClone(entry.dependencies.crosswalk),
      extraction: structuredClone(entry.dependencies.extraction),
      qa: structuredClone(entry.dependencies.qa),
      rootDirectoryFiles: [...entry.dependencies.rootDirectoryFiles],
      reviewRegistry: cloneEntry(entry.dependencies.reviewRegistry),
    },
  }));
  return {
    ...repository,
    artifacts,
    artifactContexts,
    artifactById: new Map(artifactContexts.map((entry) => [entry.registryEntry.artifact_id, entry])),
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
  const bytes = Buffer.from(transform(materialText(filename, repository)), 'utf8');
  context(repository).indexEntry.materialBytes.set(materialPath, bytes);
  data(repository).materials.find(({ artifact_path }) => artifact_path === materialPath).sha256 = sha256(bytes);
  data(repository).content_fingerprint.value = computeTeacherWorkPlanArtifactFingerprint(data(repository).materials);
}

function reasons(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern = /./u) {
  const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(reasons(result), pattern);
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: process.cwd() });
});

test('air-composition pins the exact route, lesson 51 snapshot, page and PDF provenance', () => {
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(baseline).diagnostics, []);
  assert.equal(data().artifact_id, ARTIFACT_ID);
  assert.equal(data().package_id, ARTIFACT_ID);
  assert.equal(data().canonical_route.source_id, 'grade-6-science');
  assert.deepEqual(data().source_gaps, [{
    gap_id: 'grade-6-science-lesson-051', mapping_id: 'lesson-051',
    source_record_kind: 'lesson_range', source_block_id: 'ohk',
    lesson_span: { lesson_start: 51, lesson_end: 51 }, source_pages: [16],
    source_topic_et: 'Õhu koostis: hapnik, süsihappegaas ja lämmastik',
    normalized_mapping_topic_et: 'Õhu koostis: hapnik, süsihappegaas ja lämmastik',
    coverage_status: 'missing', bridge_type: 'independently_authored_practical_required',
    topic_inventory_refs: ['air-properties-and-weather'],
  }]);
  assert.equal(data().teacher_plan_source.source_sha256, '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762');
  assert.deepEqual(data().teacher_plan_source.relevant_source_pages, [16]);
  assert.equal(context().dependencies.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === 'lesson-051').coverage_status, 'missing');
});

test('air-composition has zero context records and zero URLs', () => {
  assert.deepEqual(data().opiq_context_records, []);
  for (const filename of Object.keys(MATERIAL_HASHES)) assert.doesNotMatch(materialText(filename), /https?:\/\//u);
});

test('four exact materials, hashes, fingerprint and answer-key links are current', () => {
  assert.deepEqual(data().materials.map(({ capability }) => capability), ['practical_protocol', 'observation_table', 'student_worksheet', 'answer_key']);
  assert.deepEqual(Object.fromEntries(data().materials.map(({ artifact_path, sha256: hash }) => [artifact_path.split('/').at(-1), hash])), MATERIAL_HASHES);
  assert.equal(data().materials.find(({ capability }) => capability === 'observation_table').answer_key_path, `${ROOT}/answer-key.md`);
  assert.equal(data().materials.find(({ capability }) => capability === 'student_worksheet').answer_key_path, `${ROOT}/answer-key.md`);
  assert.equal(data().content_fingerprint.value, FINGERPRINT);
  assert.equal(computeTeacherWorkPlanArtifactFingerprint(data().materials), FINGERPRINT);
});

test('one 45-minute part, six terms and paper-only applicability are exact', () => {
  assert.deepEqual(data().lesson_sequence.map(({ part_id, source_gap_id, duration_minutes }) => ({ part_id, source_gap_id, duration_minutes })), [
    { part_id: 'part-1', source_gap_id: 'grade-6-science-lesson-051', duration_minutes: 45 },
  ]);
  assert.deepEqual(data().language_support.productive_terms.map(({ et }) => et), TERMS);
  assert.deepEqual({
    fieldwork: data().safety_and_ethics.fieldwork_applicable,
    local: data().safety_and_ethics.local_risk_assessment_applicable,
    protected: data().safety_and_ethics.protected_area_permission_applicable,
    fallback: data().safety_and_ethics.indoor_fallback_applicable,
    required: data().safety_and_ethics.local_teacher_risk_assessment_required,
  }, { fieldwork: false, local: false, protected: false, fallback: false, required: false });
});

test('100-cell model preserves exact counts, sum and X-not-CO2 boundary', () => {
  const all = Object.keys(MATERIAL_HASHES).map((filename) => materialText(filename)).join('\n');
  for (const expected of [
    '78 + 21 + 1 = 100', '78 / 100 × 100 = 78%', '21 / 100 × 100 = 21%',
    '1 / 100 × 100 = 1%', 'X не означает `CO2 = 1%`',
    'точная текущая концентрация', 'Содержание водяного пара меняется',
    'не измеряет качество воздуха или безопасность помещения',
    'Никакой опыт с пламенем, химическими веществами или вдыханием не проводится',
  ]) assert.match(all, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('review and trial workflows remain pending non-evidence templates', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  assert.deepEqual(validateTeacherWorkPlanArtifactReviewRepository(reviews).diagnostics, []);
  assert.equal(reviews.registry.data.content_fingerprint, FINGERPRINT);
  assert.equal(reviews.registry.data.teacher_review.status, 'pending');
  assert.equal(reviews.registry.data.local_safety_review.status, 'pending');
  assert.deepEqual(reviews.registry.data.teacher_review.completed_record_paths, []);
  assert.equal(reviews.teacherTemplate.data.review_identity.reviewer_id, null);
  assert.equal(reviews.safetyTemplate.data.review_identity.reviewer_id, null);
  const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  assert.deepEqual(validateTeacherWorkPlanArtifactClassroomTrialRepository(trials).diagnostics, []);
  assert.equal(trials.trialTemplate.data.lifecycle.status, 'draft');
  assert.equal(trials.trialTemplate.data.decision.status, 'pending');
  assert.deepEqual(trials.trialTemplate.data.part_observations[0].dimensions.map(({ dimension_id }) => dimension_id), DIMENSIONS);
});

test('lesson 51 remains missing and readiness and prior fingerprints remain unchanged', () => {
  assert.equal(data().readiness.classroom_ready, false);
  assert.equal(data().readiness.publication_ready, false);
  assert.equal(data().readiness.effectiveness_claimed, false);
  assert.equal(data().source_gap_support.source_gap_resolution_claimed, false);
  for (const [artifactId, fingerprint] of Object.entries(PREVIOUS_FINGERPRINTS)) {
    assert.equal(baseline.artifactById.get(artifactId).indexEntry.data.content_fingerprint.value, fingerprint);
  }
});

const indexMutations = [
  ['wrong route', (repo) => { data(repo).canonical_route.source_id = 'grade-5-science'; }, /route/u],
  ['wrong gap', (repo) => { data(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-055'; }, /source-gap|source gaps differ/u],
  ['wrong page', (repo) => { data(repo).source_gaps[0].source_pages = [15]; }, /source-gap|source gaps differ/u],
  ['coverage promotion', (repo) => { data(repo).source_gaps[0].coverage_status = 'partial'; }, /source-gap|source gaps differ/u],
  ['context record added', (repo) => { data(repo).opiq_context_records.push({ record_id: 'invented' }); }, /context|schema/u],
  ['wrong capability', (repo) => { data(repo).materials[0].capability = 'author_created_bridge'; }, /capabilit/u],
  ['missing material', (repo) => { data(repo).materials.pop(); }, /material/u],
  ['material outside root', (repo) => { data(repo).materials[0].artifact_path = 'teacher-work-plan-artifacts/grade-5-science/outside.md'; }, /material path|inside|paths differ/u],
  ['stale hash', (repo) => { data(repo).materials[0].sha256 = '0'.repeat(64); }, /hash/u],
  ['stale fingerprint', (repo) => { data(repo).content_fingerprint.value = '0'.repeat(64); }, /fingerprint/u],
  ['review readiness promotion', (repo) => { data(repo).readiness.teacher_review.status = 'approved'; }, /pending|constant/u],
  ['trial promotion', (repo) => { data(repo).readiness.classroom_trial.status = 'successful'; }, /not_tested|constant/u],
  ['classroom readiness promotion', (repo) => { data(repo).readiness.classroom_ready = true; }, /classroom_ready|constant/u],
  ['source gap resolution', (repo) => { data(repo).source_gap_support.source_gap_resolution_claimed = true; }, /resolution|constant/u],
  ['unknown YAML field', (repo) => { data(repo).unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of indexMutations) {
  test(`air-composition rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

const contentMutations = [
  ['URL added', 'student-worksheet.md', (text) => `${text}\nhttps://example.invalid\n`, /URL|url/u],
  ['wrong nitrogen count', 'practical-protocol.md', (text) => text.replace('78 ячеек N, 21 ячейка O и 1 ячейка X', '77 ячеек N, 21 ячейка O и 2 ячейки X'), /protocol is missing/u],
  ['total not 100', 'practical-protocol.md', (text) => text.replace('`78 + 21 + 1 = 100`', '`78 + 21 + 1 = 99`'), /protocol is missing/u],
  ['CO2 equals one percent', 'answer-key.md', (text) => text.replace('`1% other gases` не означает `1% carbon dioxide`', '`1% other gases` означает `1% carbon dioxide`'), /answer key is missing/u],
  ['exact unsupported CO2 concentration', 'answer-key.md', (text) => text.replace('Точная текущая концентрация CO2 здесь не задаётся.', 'Точная текущая концентрация CO2 равна 0,04%.'), /answer key is missing/u],
  ['fixed water vapour', 'student-worksheet.md', (text) => text.replace('Содержание водяного пара меняется.', 'Содержание водяного пара всегда постоянно.'), /worksheet is missing/u],
  ['classroom measurement claim', 'practical-protocol.md', (text) => text.replace('Это упрощённая модель, а не измерение воздуха в кабинете.', 'Это точное измерение воздуха в кабинете.'), /protocol is missing/u],
  ['air-quality claim', 'student-worksheet.md', (text) => text.replace('Работа не измеряет качество воздуха или безопасность помещения.', 'Работа доказывает хорошее качество воздуха и безопасность.'), /worksheet is missing/u],
  ['flame instruction', 'answer-key.md', (text) => text.replace('пламя необходимо для выполнения задания', 'зажгите свечу для выполнения задания'), /answer key is missing/u],
  ['inhalation instruction', 'practical-protocol.md', (text) => text.replace('Никакой опыт с пламенем, химическими веществами или вдыханием не проводится.', 'Соберите и вдохните образец воздуха.'), /protocol is missing/u],
  ['gas collection instruction', 'practical-protocol.md', (text) => text.replace('Запрещены сбор выдыхаемого воздуха, повышение давления и вдыхание любых образцов.', 'Соберите выдыхаемый воздух в герметичный пакет.'), /protocol is missing/u],
  ['chemical reagent', 'student-worksheet.md', (text) => text.replace('Нет свечей, пламени, спичек, газовых баллонов и химических реактивов.', 'Используйте известковую воду и химический реактив.'), /worksheet is missing/u],
  ['missing scientific boundary', 'observation-table.md', (text) => text.replace('X не означает `CO2 = 1%`.', 'X обозначает один газ.'), /observation table is missing/u],
];

for (const [name, filename, transform, pattern] of contentMutations) {
  test(`air-composition rejects ${name}`, () => {
    const repository = cloneRepository();
    replaceMaterial(repository, filename, transform);
    expectInvalid(repository, pattern);
  });
}

test('air-composition review templates reject invented or promoted evidence', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  reviews.teacherTemplate.data.review_identity.reviewer_name = 'Invented Reviewer';
  reviews.registry.data.teacher_review.status = 'approved';
  const result = validateTeacherWorkPlanArtifactReviewRepository(reviews);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(reasons(result), /identity|template|status/u);
});

test('air-composition trial template rejects promoted evidence', async () => {
  const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  trials.trialTemplate.data.lifecycle.status = 'analysed';
  trials.trialTemplate.data.decision.status = 'successful';
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(trials);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(reasons(result), /template|draft|decision/u);
});

for (const [name, text] of [
  ['duplicate key', 'schema_version: "1.0"\nschema_version: "1.0"\n'],
  ['alias', 'schema_version: *missing\n'],
  ['anchor', 'schema_version: &version "1.0"\n'],
  ['tab', 'schema_version:\t"1.0"\n'],
]) {
  test(`air-composition strict YAML rejects ${name}`, async () => {
    const repository = await loadTeacherWorkPlanReusableArtifactRepository({
      rootDir: process.cwd(), artifactOverrides: new Map([[INDEX_PATH, text]]),
    });
    expectInvalid(repository, /YAML|duplicate|alias|anchor|tab|missing/iu);
  });
}

test('air-composition validation is deterministic under reversed registry order', () => {
  const expected = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  const repository = cloneRepository();
  repository.artifactContexts.reverse();
  repository.artifacts.reverse();
  repository.registryRepository.indexes.reverse();
  repository.registryRepository.registry.data.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(repository), expected);
});
