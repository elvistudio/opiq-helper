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

const ARTIFACT_ID = 'grade-6-science-wood-processing';
const ROOT = 'teacher-work-plan-artifacts/grade-6-science/wood-processing';
const INDEX_PATH = `${ROOT}/artifact-index.yaml`;
const FINGERPRINT = '59689bce711416a1cab4c8df5c5d75113c8e4a1fdec1d5aafc5ed9ecb8981436';
const MATERIAL_HASHES = {
  'author-created-bridge.md': '0f029c8dbe141c835a1384662f2e81c80ae8367c0743136778b84ca8ad3e9574',
  'student-worksheet.md': '2bf809738b5f2eeddf20569b715bd87d783ca4d94ebcbb2e5aa8e38b39a2402f',
  'answer-key.md': 'bf873d06ad36d032f28f3b4267abd13683c9ba8fd3fd7351e78071fde309cbaa',
};
const PREVIOUS_FINGERPRINTS = {
  'grade-6-science-soil-organisms': '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613',
  'grade-6-science-photosynthesis': '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45',
  'grade-6-science-garden-field-food-products': '999eb50584622bb35dd017a34d7b83536c4face4ebaccd98d12d7768518280ad',
};
const TERMS = ['puit', 'tüvi', 'palk', 'saagimine', 'kuivatamine', 'puidutoode'];
const DIMENSIONS = [
  'timing', 'setup_and_transitions', 'instruction_comprehension',
  'raw_intermediate_product_classification', 'process_chain_sequencing',
  'pathway_comparison', 'evidence_vs_inference', 'unsupported_claim_rejection',
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

test('wood-processing artifact pins the exact route, source gap, page and PDF provenance', () => {
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(baseline).diagnostics, []);
  assert.equal(data().artifact_id, ARTIFACT_ID);
  assert.equal(data().package_id, ARTIFACT_ID);
  assert.equal(data().canonical_route.source_id, 'grade-6-science');
  assert.deepEqual(data().source_gaps, [{
    gap_id: 'grade-6-science-lesson-038', mapping_id: 'lesson-038',
    source_record_kind: 'lesson_range', source_block_id: 'mets-elukeskkonnana',
    lesson_span: { lesson_start: 38, lesson_end: 38 }, source_pages: [13],
    source_topic_et: 'Puidu töötlemine', normalized_mapping_topic_et: 'Puidu töötlemine',
    coverage_status: 'missing', bridge_type: 'independently_authored_bridge_required',
    topic_inventory_refs: ['forest-ecosystem', 'estonian-natural-resources'],
  }]);
  assert.equal(data().teacher_plan_source.source_sha256, '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762');
  assert.deepEqual(data().teacher_plan_source.relevant_source_pages, [13]);
  assert.equal(context().dependencies.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === 'lesson-038').coverage_status, 'missing');
});

test('two exact optional context records remain contextual and occur only in the bridge', () => {
  assert.deepEqual(data().opiq_context_records.map(({ record_id }) => record_id), ['forest-et-use', 'resources-ru-core']);
  assert.deepEqual(data().opiq_context_records.map(({ canonical_url }) => canonical_url), [
    'https://www.opiq.ee/kit/580/chapter/32178',
    'https://www.opiq.ee/kit/269/chapter/15355',
  ]);
  const bridge = materialText('author-created-bridge.md');
  assert.equal((bridge.match(/https:\/\//gu) ?? []).length, 2);
  assert.doesNotMatch(materialText('student-worksheet.md'), /https?:\/\//u);
  assert.doesNotMatch(materialText('answer-key.md'), /https?:\/\//u);
});

test('three exact materials, hashes, fingerprint and answer-key link are current', () => {
  assert.deepEqual(data().materials.map(({ capability }) => capability), ['author_created_bridge', 'student_worksheet', 'answer_key']);
  assert.deepEqual(Object.fromEntries(data().materials.map(({ artifact_path, sha256: hash }) => [artifact_path.split('/').at(-1), hash])), MATERIAL_HASHES);
  assert.equal(data().materials.find(({ capability }) => capability === 'student_worksheet').answer_key_path, `${ROOT}/answer-key.md`);
  assert.equal(data().content_fingerprint.value, FINGERPRINT);
  assert.equal(computeTeacherWorkPlanArtifactFingerprint(data().materials), FINGERPRINT);
});

test('lesson, terms and non-fieldwork applicability are exact', () => {
  assert.deepEqual(data().lesson_sequence.map(({ part_id, source_gap_id, duration_minutes }) => ({ part_id, source_gap_id, duration_minutes })), [
    { part_id: 'part-1', source_gap_id: 'grade-6-science-lesson-038', duration_minutes: 45 },
  ]);
  assert.deepEqual(data().language_support.productive_terms.map(({ et }) => et), TERMS);
  assert.equal(data().safety_and_ethics.fieldwork_applicable, false);
  assert.equal(data().safety_and_ethics.local_risk_assessment_applicable, false);
  assert.equal(data().safety_and_ethics.local_teacher_risk_assessment_required, false);
  assert.equal(data().safety_and_ethics.protected_area_permission_applicable, false);
  assert.equal(data().safety_and_ethics.indoor_fallback_applicable, false);
});

test('materials preserve process, paper-only, inference and unsupported-claim boundaries', () => {
  const all = Object.keys(MATERIAL_HASHES).map((filename) => materialText(filename)).join('\n');
  for (const expected of [
    'Ствол дерева → бревно → распиливание → сушка',
    'тонкие листы шпона', 'восстановленное волокно',
    'не используются пилы, ножи, наждачная бумага, сверление, станки',
    'Свидетельство и предположение', 'Фанера не содержит клея',
    'углеродно-нейтральный', 'Внешний вид изделия не доказывает',
    'Полный модельный ответ по-русски', 'Puit saadakse puust.',
  ]) assert.match(all.toLocaleLowerCase('ru'), new RegExp(expected.toLocaleLowerCase('ru').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('review and trial workflows remain exact pending non-evidence templates', async () => {
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

test('readiness and resolution stay false and previous fingerprints remain unchanged', () => {
  assert.equal(data().readiness.classroom_ready, false);
  assert.equal(data().readiness.publication_ready, false);
  assert.equal(data().readiness.effectiveness_claimed, false);
  assert.equal(data().source_gap_support.source_gap_resolution_claimed, false);
  for (const [artifactId, fingerprint] of Object.entries(PREVIOUS_FINGERPRINTS)) {
    assert.equal(baseline.artifactById.get(artifactId).indexEntry.data.content_fingerprint.value, fingerprint);
  }
});

const indexMutations = [
  ['adjacent route', (repo) => { data(repo).canonical_route.source_id = 'grade-5-science'; }, /route/u],
  ['wrong gap', (repo) => { data(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-022'; }, /source-gap|source gaps differ/u],
  ['coverage promotion', (repo) => { data(repo).source_gaps[0].coverage_status = 'partial'; }, /source-gap|source gaps differ/u],
  ['wrong source page', (repo) => { data(repo).source_gaps[0].source_pages = [12]; }, /source-gap|source gaps differ/u],
  ['missing context', (repo) => { data(repo).opiq_context_records.pop(); }, /context records differ/u],
  ['extra context', (repo) => { data(repo).opiq_context_records.push(structuredClone(data(repo).opiq_context_records[0])); }, /context records differ|duplicate/u],
  ['wrong capability', (repo) => { data(repo).materials[0].capability = 'practical_protocol'; }, /capabilit/u],
  ['missing material', (repo) => { data(repo).materials.pop(); }, /material/u],
  ['material outside root', (repo) => { data(repo).materials[0].artifact_path = 'teacher-work-plan-artifacts/grade-5-science/outside.md'; }, /material path|inside|paths differ/u],
  ['stale hash', (repo) => { data(repo).materials[0].sha256 = '0'.repeat(64); }, /hash/u],
  ['stale fingerprint', (repo) => { data(repo).content_fingerprint.value = '0'.repeat(64); }, /fingerprint/u],
  ['promoted classroom readiness', (repo) => { data(repo).readiness.classroom_ready = true; }, /classroom_ready|constant/u],
  ['promoted publication', (repo) => { data(repo).readiness.publication_ready = true; }, /publication_ready|constant/u],
  ['effectiveness claim', (repo) => { data(repo).readiness.effectiveness_claimed = true; }, /effectiveness|constant/u],
  ['source resolution', (repo) => { data(repo).source_gap_support.source_gap_resolution_claimed = true; }, /resolution|constant/u],
  ['unknown YAML field', (repo) => { data(repo).unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of indexMutations) {
  test(`wood-processing rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

const contentMutations = [
  ['URL in student file', 'student-worksheet.md', (text) => `${text}\nhttps://www.opiq.ee/kit/580/chapter/32178\n`, /URL|url/u],
  ['non-Opiq URL', 'author-created-bridge.md', (text) => `${text}\nhttps://example.invalid\n`, /URL|url/u],
  ['unsafe tool instructions', 'student-worksheet.md', (text) => text.replace('Не используются пилы, ножи, наждачная бумага, сверление, станки', 'Используйте пилу и станок'), /worksheet is missing/u],
  ['false pure-wood boundary', 'answer-key.md', (text) => text.replace('Фанера не содержит клея', 'Фанера состоит только из чистой древесины'), /answer key is missing/u],
  ['false sustainability claim', 'answer-key.md', (text) => text.replace('Древесный материал автоматически устойчив или углеродно-нейтрален', 'Древесный материал всегда устойчив и углеродно-нейтрален'), /answer key is missing/u],
  ['origin inferred by appearance', 'answer-key.md', (text) => text.replace('Внешний вид доказывает породу дерева или страну происхождения', 'Внешний вид надёжно доказывает происхождение'), /answer key is missing/u],
  ['context represented as processing evidence', 'author-created-bridge.md', (text) => text.replace('Они не являются прямым свидетельством цепочек обработки древесины', 'Они прямо доказывают цепочки обработки древесины'), /bridge is missing/u],
];

for (const [name, filename, transform, pattern] of contentMutations) {
  test(`wood-processing rejects ${name}`, () => {
    const repository = cloneRepository();
    replaceMaterial(repository, filename, transform);
    expectInvalid(repository, pattern);
  });
}

test('wood-processing review templates reject invented or promoted evidence', async () => {
  const reviews = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd(), artifactId: ARTIFACT_ID });
  reviews.teacherTemplate.data.review_identity.reviewer_name = 'Invented Reviewer';
  reviews.registry.data.teacher_review.status = 'approved';
  const result = validateTeacherWorkPlanArtifactReviewRepository(reviews);
  assert.notEqual(result.diagnostics.length, 0);
  assert.match(reasons(result), /identity|template|status/u);
});

test('wood-processing trial template rejects promoted evidence', async () => {
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
  test(`wood-processing strict YAML rejects ${name}`, async () => {
    const repository = await loadTeacherWorkPlanReusableArtifactRepository({
      rootDir: process.cwd(), artifactOverrides: new Map([[INDEX_PATH, text]]),
    });
    expectInvalid(repository, /YAML|duplicate|alias|anchor|tab|missing/iu);
  });
}

test('wood-processing validation is deterministic under reversed registry order', () => {
  const expected = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  const repository = cloneRepository();
  repository.artifactContexts.reverse();
  repository.artifacts.reverse();
  repository.registryRepository.indexes.reverse();
  repository.registryRepository.registry.data.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(repository), expected);
});
