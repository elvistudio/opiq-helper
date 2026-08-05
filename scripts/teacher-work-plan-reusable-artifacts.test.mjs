import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

import {
  computeTeacherWorkPlanArtifactFingerprint,
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './lib/teacher-work-plan-reusable-artifacts.mjs';

const PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const INDEX_PATH = `${PILOT_ROOT}/artifact-index.yaml`;
const MATERIAL_PATHS = [
  `${PILOT_ROOT}/teacher-guide.md`,
  `${PILOT_ROOT}/practical-protocol.md`,
  `${PILOT_ROOT}/observation-table.md`,
  `${PILOT_ROOT}/student-worksheet.md`,
  `${PILOT_ROOT}/answer-key.md`,
  `${PILOT_ROOT}/assessment-rubric.md`,
  `${PILOT_ROOT}/oral-support.md`,
];
const CAPABILITIES = [
  'teacher_guide',
  'practical_protocol',
  'observation_table',
  'student_worksheet',
  'answer_key',
  'assessment_rubric',
  'oral_support',
];
const TERMS = ['muld', 'mullaorganism', 'vaatlus', 'elupaik', 'niiskus', 'lagundaja'];

let baseline;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function cloneRepository(repository = baseline) {
  const artifacts = repository.artifacts.map((entry) => ({
    ...entry,
    data: structuredClone(entry.data),
    materialBytes: new Map([...entry.materialBytes].map(([key, value]) => [key, value && Buffer.from(value)])),
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
      reviewRegistry: context.dependencies.reviewRegistry && {
        ...context.dependencies.reviewRegistry,
        data: structuredClone(context.dependencies.reviewRegistry.data),
      },
    },
  }));
  const clone = {
    ...repository,
    registryRepository: {
      ...repository.registryRepository,
      registry: repository.registryRepository.registry && {
        ...repository.registryRepository.registry,
        data: structuredClone(repository.registryRepository.registry.data),
      },
      indexes: repository.registryRepository.indexes.map((entry) => ({
        ...entry,
        data: structuredClone(entry.data),
      })),
      profiles: Object.fromEntries(Object.entries(repository.registryRepository.profiles).map(([key, value]) => [key, structuredClone(value)])),
      discoveredIndexPaths: [...repository.registryRepository.discoveredIndexPaths],
      loadDiagnostics: structuredClone(repository.registryRepository.loadDiagnostics),
    },
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
  const dependency = artifactContexts[0].dependencies;
  clone.topicInventory = dependency.topicInventory;
  clone.bookInventory = dependency.bookInventory;
  clone.crosswalk = dependency.crosswalk;
  clone.extraction = dependency.extraction;
  clone.reviewRegistry = dependency.reviewRegistry;
  clone.pilotDirectoryFiles = dependency.rootDirectoryFiles;
  return clone;
}

function artifact(repository) {
  return repository.artifacts[0].data;
}

function replaceMaterial(repository, materialPath, transform) {
  const entry = repository.artifacts[0];
  const original = entry.materialBytes.get(materialPath);
  entry.materialBytes.set(materialPath, Buffer.from(transform(original.toString('utf8')), 'utf8'));
  const material = entry.data.materials.find(({ artifact_path }) => artifact_path === materialPath);
  material.sha256 = sha256(entry.materialBytes.get(materialPath));
  entry.data.content_fingerprint.value = computeTeacherWorkPlanArtifactFingerprint(entry.data.materials);
}

function reasons(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern) {
  const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(reasons(result), pattern);
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: process.cwd() });
});

test('production Grade 6 soil-organisms reusable artifact is exact and internally reviewable', () => {
  const result = validateTeacherWorkPlanReusableArtifactRepository(baseline);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.summary, {
    artifacts: 2,
    source_gaps_supported: 3,
    materials: 12,
    opiq_context_records: 4,
    fingerprints: {
      'grade-6-science-soil-organisms': '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613',
      'grade-6-science-photosynthesis': '8df9cff3e19c325ba92f931f72c79cf2828a9b03a36fcf80ea19aff430d7db45',
    },
    canonical_gap_statuses_unchanged: true,
    review_registries: 2,
    completed_review_records: 0,
  });

  const data = artifact(baseline);
  assert.equal(data.artifact_id, 'grade-6-science-soil-organisms');
  assert.equal(data.package_id, 'grade-6-science-soil-organisms');
  assert.deepEqual(data.identity, {
    grade: 6,
    subject: 'science',
    subject_et: 'loodusõpetus',
    title_ru: 'Почвенные организмы: наблюдение и объяснение',
    title_et: 'Mullaorganismid: vaatlus ja selgitamine',
    instruction_language: 'ru',
    subject_support_language: 'et',
  });
  assert.deepEqual(data.canonical_route, {
    source_id: 'grade-6-science',
    md_path: 'project-files/outputs/opiq_6klass_loodusopetus.md',
    source_archive: 'project-files/inputs/final-zips/opiq_6klass_elutingimused_soos_v2.zip',
    qa_path: 'project-files/outputs/opiq_6klass_loodusopetus_qa.json',
    record_count: 436,
    coverage_status: 'available_not_curriculum_verified',
  });
  assert.equal(data.teacher_plan_source.source_pdf_path, 'project-files/inputs/originals/teacher-work-plans/Loodusopetuse-tookava-naidis-6-klassile.pdf');
  assert.equal(data.teacher_plan_source.source_sha256, '2b63ada1c2821e63a8aadda0bf93246499c2f8430cd305592a82a709a0160762');
  assert.equal(data.teacher_plan_source.source_page_count, 31);
  assert.deepEqual(data.source_gaps.map(({ gap_id, coverage_status, lesson_span }) => ({ gap_id, coverage_status, lesson_span })), [
    { gap_id: 'grade-6-science-lesson-008', coverage_status: 'missing', lesson_span: { lesson_start: 8, lesson_end: 8 } },
    { gap_id: 'grade-6-science-lesson-009', coverage_status: 'missing', lesson_span: { lesson_start: 9, lesson_end: 9 } },
  ]);
  for (const mappingId of ['lesson-008', 'lesson-009']) {
    const mapping = baseline.artifactContexts[0].dependencies.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === mappingId);
    assert.equal(mapping.coverage_status, 'missing');
    assert.deepEqual(mapping.opiq_matches, []);
  }
  assert.deepEqual(data.materials.map(({ capability }) => capability), CAPABILITIES);
  assert.deepEqual(data.materials.map(({ artifact_path }) => artifact_path), MATERIAL_PATHS);
  assert.equal(data.learner_language_profile.profile_id, 'grade-6-science-a2-default');
  assert.deepEqual(data.language_support.productive_terms.map(({ et }) => et), TERMS);
  assert.deepEqual(data.lesson_sequence.map(({ duration_minutes }) => duration_minutes), [45, 45]);
  assert.deepEqual(data.opiq_context_records.map(({ record_id, inventory_bucket }) => ({ record_id, inventory_bucket })), [
    { record_id: 'soil-ru-core', inventory_bucket: 'selected_records' },
    { record_id: 'soil-et-formation', inventory_bucket: 'selected_records' },
    { record_id: 'soil-et-pit', inventory_bucket: 'selected_records' },
    { record_id: 'soil-ru-pit', inventory_bucket: 'alternative_records' },
  ]);
  for (const context of data.opiq_context_records) {
    assert.equal(context.programme_type, 'unknown');
    assert.equal(context.programme_type_evidence_status, 'ambiguous');
    assert.equal(context.default_course_eligibility, 'unverified');
    assert.equal(context.required_for_learner_completion, false);
    assert.equal(context.instructional_roles.includes('oral_answer_et'), false);
  }
  assert.equal(data.content_boundary.opiq_required, false);
  assert.equal(data.content_boundary.external_sources_used, false);
  assert.equal(data.readiness.teacher_review.status, 'pending');
  assert.equal(data.readiness.local_safety_review.status, 'pending');
  assert.equal(data.readiness.classroom_trial.status, 'not_tested');
  assert.equal(data.readiness.classroom_ready, false);
  assert.equal(data.readiness.publication_ready, false);
  assert.equal(data.source_gap_support.source_gap_resolution_claimed, false);
  assert.equal(data.source_gap_support.canonical_opiq_gap_status_unchanged, true);
  assert.deepEqual(data.human_review, {
    registry_path: `${PILOT_ROOT}/reviews/review-registry.yaml`,
    teacher_review: { status: 'pending', completed_record_path: null },
    local_safety_review: { status: 'pending', completed_record_path: null },
    classroom_trial: {
      workflow_created: true,
      template_path: `${PILOT_ROOT}/reviews/classroom-trial-template.yaml`,
      status: 'not_tested',
      completed_record_path: null,
    },
    reviewed_content_fingerprint: null,
  });
  const reviewRegistry = baseline.artifactContexts[0].dependencies.reviewRegistry.data;
  assert.equal(reviewRegistry.content_fingerprint, data.content_fingerprint.value);
  assert.deepEqual(reviewRegistry.teacher_review.completed_record_paths, []);
  assert.deepEqual(reviewRegistry.local_safety_review.completed_record_paths, []);
});

test('artifact material hashes and aggregate fingerprint remain exact production values', () => {
  assert.deepEqual(artifact(baseline).materials.map(({ artifact_path, sha256: fileHash }) => ({ artifact_path, sha256: fileHash })), [
    { artifact_path: MATERIAL_PATHS[0], sha256: '2a0d26671a051d33cd6b78cdf1eb46eb1a991020c71f05ace7c8610ca32a37a3' },
    { artifact_path: MATERIAL_PATHS[1], sha256: '42c89a0d91f30e63936d1903065322eeb1616edb40c9234895ca157980970c9b' },
    { artifact_path: MATERIAL_PATHS[2], sha256: 'ed73c07de474825e36048fff87c89037afd0fe76477e1b65ae35477b8c4cacbb' },
    { artifact_path: MATERIAL_PATHS[3], sha256: '41b2c0809d25fe8b8266c238a8bcef471a704c5bc010748c6680edde81943273' },
    { artifact_path: MATERIAL_PATHS[4], sha256: '158666725916c2d5be35d201c482ca3f9752a43f7018d8dff6dcf4874abf9a16' },
    { artifact_path: MATERIAL_PATHS[5], sha256: '7416aba84f4dee39fe08d9dd6c729ae093d514727e0d5e69db7d3b5963350d04' },
    { artifact_path: MATERIAL_PATHS[6], sha256: '252145bbc1c17e4885782e5070e5227860f44f12a361add9544e54b5c42012f0' },
  ]);
  assert.equal(artifact(baseline).content_fingerprint.value, '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613');
});

test('all seven Markdown files are current UTF-8 printable content with exact hashes', async () => {
  const data = artifact(baseline);
  for (const material of data.materials) {
    const bytes = await fs.readFile(material.artifact_path);
    assert.equal(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), true);
    assert.equal(bytes.toString('utf8').endsWith('\n'), true);
    assert.equal(bytes.toString('utf8').includes('\t'), false);
    assert.equal(sha256(bytes), material.sha256);
    assert.equal(material.printable, true);
  }
  assert.equal(computeTeacherWorkPlanArtifactFingerprint(data.materials), data.content_fingerprint.value);
});

test('materials preserve inquiry, safety, language, and answer boundaries', () => {
  const texts = baseline.artifacts[0].materialBytes;
  const protocol = texts.get(`${PILOT_ROOT}/practical-protocol.md`).toString('utf8');
  const answer = texts.get(`${PILOT_ROOT}/answer-key.md`).toString('utf8');
  const rubric = texts.get(`${PILOT_ROOT}/assessment-rubric.md`).toString('utf8');
  const oral = texts.get(`${PILOT_ROOT}/oral-support.md`).toString('utf8');
  assert.match(protocol, /25 × 25/u);
  assert.match(protocol, /одинаковой площади/u);
  assert.match(protocol, /одинаковом времени/u);
  assert.match(protocol, /Определение до вида не требуется/u);
  assert.match(protocol, /локальными классными наблюдениями/u);
  assert.match(protocol, /не устанавливает причину/u);
  assert.match(protocol, /Indoor fallback/u);
  assert.match(protocol, /возвращает организмы/u);
  assert.match(answer, /фиксированных «правильных» полевых чисел нет/u);
  assert.match(answer, /Полный модельный ответ по-русски/u);
  assert.match(rubric, /не вычитается из предметного результата/u);
  assert.match(oral, /3–5/u);
  for (const term of TERMS) assert.match(oral, new RegExp(term, 'u'));
});

const mutations = [
  ['missing index', (repo) => { repo.artifactContexts[0].indexEntry = null; }, /registered artifact index is missing/u],
  ['extra artifact index', (repo) => { repo.registryRepository.discoveredIndexPaths.push(`${PILOT_ROOT}/extra/artifact-index.yaml`); }, /registered artifact indexes must exactly equal discovered/u],
  ['missing material', (repo) => { repo.artifacts[0].materialBytes.set(MATERIAL_PATHS[0], null); }, /missing material/u],
  ['extra material', (repo) => { repo.pilotDirectoryFiles.push('extra.md'); repo.pilotDirectoryFiles.sort(); }, /artifact root contents differ/u],
  ['wrong package ID', (repo) => { artifact(repo).package_id = 'grade-6-science-other'; }, /package ID differs/u],
  ['wrong route', (repo) => { artifact(repo).canonical_route.source_id = 'grade-7-science'; }, /canonical route|grade-6-science/u],
  ['wrong grade', (repo) => { artifact(repo).identity.grade = 7; }, /artifact identity differs/u],
  ['wrong subject', (repo) => { artifact(repo).identity.subject = 'geography'; }, /artifact identity differs/u],
  ['wrong gap ID', (repo) => { artifact(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-010'; }, /source-gap snapshots/u],
  ['partial gap substituted', (repo) => { artifact(repo).source_gaps[0].coverage_status = 'partial'; }, /allowed values|source-gap snapshots/u],
  ['wrong source page', (repo) => { artifact(repo).source_gaps[0].source_pages = [4]; }, /source-gap snapshots/u],
  ['wrong source topic', (repo) => { artifact(repo).source_gaps[0].source_topic_et = 'Muld'; }, /source-gap snapshots/u],
  ['wrong PDF SHA', (repo) => { artifact(repo).teacher_plan_source.source_sha256 = '0'.repeat(64); }, /teacher-plan provenance/u],
  ['wrong Opiq URL', (repo) => { artifact(repo).opiq_context_records[0].canonical_url = 'https://www.opiq.ee/kit/269/chapter/1'; }, /optional context record|canonical Markdown/u],
  ['rejected record', (repo) => { artifact(repo).opiq_context_records[0].record_id = 'soil-et-composition-legacy'; }, /rejected record|optional context record/u],
  ['title drift', (repo) => { artifact(repo).opiq_context_records[0].title = 'Другая страница'; }, /metadata differs|optional context record/u],
  ['book ID drift', (repo) => { artifact(repo).opiq_context_records[0].book_id = 'other-book'; }, /metadata differs|optional context record/u],
  ['role drift', (repo) => { artifact(repo).opiq_context_records[0].instructional_roles = ['practice_ru']; }, /metadata differs|optional context record/u],
  ['oral role fabricated', (repo) => { artifact(repo).opiq_context_records[1].instructional_roles.push('oral_answer_et'); }, /context records differ|metadata differs/u],
  ['programme promoted', (repo) => { artifact(repo).opiq_context_records[0].programme_type = 'ordinary'; }, /unknown|programme evidence/u],
  ['eligibility promoted', (repo) => { artifact(repo).opiq_context_records[0].default_course_eligibility = 'eligible'; }, /constant|context records differ/u],
  ['Opiq required', (repo) => { artifact(repo).content_boundary.opiq_required = true; }, /must be equal to constant/u],
  ['external URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[0], (text) => `${text}https:\/\/example.com\n`); }, /non-Opiq external URL/u],
  ['extra Opiq context URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[0], (text) => `${text}https:\/\/www.opiq.ee\/kit\/269\/chapter\/1\n`); }, /exactly the registered context URLs/u],
  ['student Opiq URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[2], (text) => `${text}https:\/\/www.opiq.ee\/kit\/269\/chapter\/15287\n`); }, /URLs are forbidden by the selected artifact profile/u],
  ['internal path leaked', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[3], (text) => `${text}project-files\/secret\n`); }, /internal analysis leakage/u],
  ['material outside root', (repo) => { artifact(repo).materials[0].artifact_path = 'docs/teacher-guide.md'; }, /registered artifact root|material paths differ/u],
  ['duplicate capability', (repo) => { artifact(repo).materials[1].capability = 'teacher_guide'; }, /duplicate material capability|exact seven-item order/u],
  ['missing capability', (repo) => { artifact(repo).materials.pop(); }, /material capabilities differ|material paths differ/u],
  ['wrong answer-key path', (repo) => { artifact(repo).materials[2].answer_key_path = MATERIAL_PATHS[0]; }, /profile-declared answer key/u],
  ['stale file hash', (repo) => { artifact(repo).materials[0].sha256 = '0'.repeat(64); }, /stale hash/u],
  ['stale aggregate fingerprint', (repo) => { artifact(repo).content_fingerprint.value = '0'.repeat(64); }, /aggregate content fingerprint is stale/u],
  ['missing final newline', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[1], (text) => text.replace(/\n$/u, '')); }, /end with a newline/u],
  ['tab in material', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[1], (text) => `${text}\tunsafe\n`); }, /tabs are forbidden/u],
  ['safety review completed', (repo) => { artifact(repo).readiness.local_safety_review.status = 'complete'; }, /must remain pending|must be equal to constant/u],
  ['classroom ready promoted', (repo) => { artifact(repo).readiness.classroom_ready = true; }, /cannot be promoted|must be equal to constant/u],
  ['publication ready promoted', (repo) => { artifact(repo).readiness.publication_ready = true; }, /cannot be promoted|must be equal to constant/u],
  ['effectiveness claimed', (repo) => { artifact(repo).readiness.effectiveness_claimed = true; }, /cannot be promoted|must be equal to constant/u],
  ['source gap marked resolved', (repo) => { artifact(repo).source_gap_support.source_gap_resolution_claimed = true; }, /cannot change or resolve|must be equal to constant/u],
  ['canonical gap marked changed', (repo) => { artifact(repo).source_gap_support.canonical_opiq_gap_status_unchanged = false; }, /cannot change or resolve|must be equal to constant/u],
  ['crosswalk gap promoted', (repo) => { repo.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === 'lesson-008').coverage_status = 'partial'; }, /retain its registered status/u],
  ['official completeness promoted', (repo) => { artifact(repo).source_gap_support.official_curriculum_complete = true; }, /must be equal to constant/u],
  ['missing review registry', (repo) => { repo.artifactContexts[0].dependencies.reviewRegistry = null; }, /review registry is missing/u],
  ['stale review fingerprint', (repo) => { repo.reviewRegistry.data.content_fingerprint = '0'.repeat(64); }, /review registry fingerprint is stale/u],
  ['teacher review promoted without evidence', (repo) => { repo.reviewRegistry.data.teacher_review.status = 'approved'; }, /remain pending/u],
  ['artifact human review promoted', (repo) => { artifact(repo).human_review.teacher_review.status = 'approved'; }, /must be equal to constant|exact pending registry/u],
  ['unknown field', (repo) => { artifact(repo).unexpected = true; }, /unknown field unexpected/u],
];

for (const [name, mutate, pattern] of mutations) {
  test(`rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

for (const [name, transform] of [
  ['YAML alias', (text) => text.replace('title_et: "Mullaorganismid: vaatlus ja selgitamine"', 'title_et: *missing')],
  ['YAML anchor', (text) => text.replace('title_et: "Mullaorganismid: vaatlus ja selgitamine"', 'title_et: &title "Mullaorganismid: vaatlus ja selgitamine"')],
  ['YAML duplicate key', (text) => text.replace('package_id: grade-6-science-soil-organisms', 'package_id: grade-6-science-soil-organisms\npackage_id: grade-6-science-soil-organisms')],
]) {
  test(`strict loader rejects ${name}`, async () => {
    const original = await fs.readFile(INDEX_PATH, 'utf8');
    const repository = await loadTeacherWorkPlanReusableArtifactRepository({
      rootDir: process.cwd(),
      artifactOverrides: new Map([[INDEX_PATH, transform(original)]]),
    });
    expectInvalid(repository, /YAML|alias|anchor|duplicate|expected exactly one artifact index/iu);
  });
}

test('validation diagnostics and fingerprint are deterministic', () => {
  const first = validateTeacherWorkPlanReusableArtifactRepository(cloneRepository());
  const second = validateTeacherWorkPlanReusableArtifactRepository(cloneRepository());
  assert.deepEqual(first, second);
  assert.equal(first.summary.fingerprints['grade-6-science-soil-organisms'], computeTeacherWorkPlanArtifactFingerprint(artifact(baseline).materials));
});

test('generic validator accepts two registered artifacts with separate route-local dependencies independent of order', async () => {
  const repository = cloneRepository();
  const sourceContext = repository.artifactContexts[0];
  const packageId = 'grade-5-science-local-water-events';
  const profileId = `${packageId}-synthetic-v1`;
  const rootPath = 'teacher-work-plan-artifacts/grade-5-science/local-water-events';
  const indexPath = `${rootPath}/artifact-index.yaml`;
  const reviewRoot = `${rootPath}/reviews`;
  const grade5Route = repository.manifest.sources.find(({ id }) => id === 'grade-5-science');
  const gap = repository.gapReport.gap_items.find(({ gap_id }) => gap_id === 'grade-5-science-lesson-022');
  const workPackage = repository.workPackageRepository.artifact.work_packages.find(({ package_id }) => package_id === packageId);
  const [topicInventory, bookInventory, crosswalk, extraction, canonicalMarkdown, qa] = await Promise.all([
    fs.readFile('curriculum-maps/grade-5-science/topic-inventory.yaml', 'utf8').then(parse),
    fs.readFile('curriculum-maps/grade-5-science/book-inventory.yaml', 'utf8').then(parse),
    fs.readFile('curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml', 'utf8').then(parse),
    fs.readFile('evaluations/teacher-work-plans/grade-5-science-extraction.json', 'utf8').then(JSON.parse),
    fs.readFile(grade5Route.md_path, 'utf8'),
    fs.readFile(grade5Route.qa_path, 'utf8').then(JSON.parse),
  ]);
  const sourceArtifact = sourceContext.indexEntry.data;
  const materialSpecs = [
    ['author_created_bridge', 'bridge.md', 1, null],
    ['student_worksheet', 'student-worksheet.md', 3, `${rootPath}/answer-key.md`],
    ['answer_key', 'answer-key.md', 4, null],
    ['assessment_rubric', 'assessment-rubric.md', 5, null],
  ];
  const materialBytes = new Map();
  const materials = materialSpecs.map(([capability, filename, sourceIndex, answerKeyPath]) => {
    const bytes = Buffer.from(sourceContext.indexEntry.materialBytes.get(sourceArtifact.materials[sourceIndex].artifact_path));
    const artifactPath = `${rootPath}/${filename}`;
    materialBytes.set(artifactPath, bytes);
    return {
      ...structuredClone(sourceArtifact.materials[sourceIndex]),
      material_id: `synthetic-${capability.replaceAll('_', '-')}`,
      capability,
      artifact_path: artifactPath,
      ...(answerKeyPath ? { answer_key_path: answerKeyPath } : {}),
      sha256: sha256(bytes),
    };
  });
  delete materials[0].answer_key_path;
  delete materials[2].answer_key_path;
  delete materials[3].answer_key_path;
  const fingerprint = computeTeacherWorkPlanArtifactFingerprint(materials);
  const sourceGap = {
    gap_id: gap.gap_id,
    mapping_id: gap.mapping_id,
    source_record_kind: gap.source_record_kind,
    source_block_id: gap.source_block_id,
    lesson_span: gap.lesson_span,
    source_pages: gap.source_pages,
    source_topic_et: gap.source_topic_et,
    normalized_mapping_topic_et: gap.normalized_mapping_topic_et,
    coverage_status: gap.coverage_status,
    bridge_type: gap.bridge_type,
    topic_inventory_refs: gap.topic_inventory_refs,
  };
  const syntheticArtifact = structuredClone(sourceArtifact);
  syntheticArtifact.artifact_id = packageId;
  syntheticArtifact.package_id = packageId;
  syntheticArtifact.identity.grade = 5;
  syntheticArtifact.canonical_route = {
    source_id: grade5Route.id,
    md_path: grade5Route.md_path,
    source_archive: grade5Route.source_archive,
    qa_path: grade5Route.qa_path,
    record_count: grade5Route.record_count,
    coverage_status: grade5Route.coverage_status,
  };
  syntheticArtifact.source_work_package = {
    review_id: repository.workPackageRepository.artifact.review_id,
    review_path: 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
    package_id: packageId,
    authoring_status: workPackage.authoring_status,
    priority_tier: workPackage.priority_tier,
    selected_as_first_pilot: false,
    planned_root_path: rootPath,
    proposed_deliverables: workPackage.proposed_deliverables,
  };
  syntheticArtifact.source_gaps = [sourceGap];
  syntheticArtifact.teacher_plan_source = {
    extraction_path: 'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    source_pdf_path: extraction.source.repository_path,
    original_filename: extraction.source.original_filename,
    source_sha256: extraction.source.sha256,
    source_page_count: extraction.source.page_count,
    relevant_source_pages: [9],
    provenance_kind: extraction.source.provenance_kind,
    canonical: extraction.source.canonical,
  };
  syntheticArtifact.learner_language_profile.profile_id = 'grade-5-science-a1-a2-default';
  syntheticArtifact.learner_language_profile.learner_language_level = 'A1-A2';
  syntheticArtifact.opiq_context_records = [];
  syntheticArtifact.lesson_sequence = [{
    part_id: 'part-1',
    source_gap_id: gap.gap_id,
    title_ru: 'Synthetic route-local bridge',
    title_et: gap.source_topic_et,
    duration_minutes: 45,
    primary_outputs: ['Synthetic in-memory output'],
  }];
  syntheticArtifact.materials = materials;
  syntheticArtifact.content_fingerprint.value = fingerprint;
  syntheticArtifact.human_review.registry_path = `${reviewRoot}/review-registry.yaml`;
  syntheticArtifact.human_review.classroom_trial.template_path = `${reviewRoot}/classroom-trial-template.yaml`;
  syntheticArtifact.source_gap_support.supported_gap_ids = [gap.gap_id];
  const profile = {
    ...structuredClone(sourceContext.profile),
    profileId,
    artifactId: packageId,
    packageId,
    route: 'grade-5-science',
    rootPath,
    indexPath,
    fingerprint,
    identity: { grade: 5, subject: 'science', subjectEt: 'loodusõpetus' },
    expectedRootEntries: ['answer-key.md', 'artifact-index.yaml', 'assessment-rubric.md', 'bridge.md', 'reviews', 'student-worksheet.md'],
    capabilities: materialSpecs.map(([capability]) => capability),
    materialPaths: materials.map(({ artifact_path }) => artifact_path),
    answerKeyLinks: { student_worksheet: `${rootPath}/answer-key.md` },
    studentFacingPaths: [`${rootPath}/student-worksheet.md`],
    urlAllowedPaths: [],
    sourceGaps: [sourceGap],
    teacherPlanRelevantPages: [9],
    contextRecords: [],
    languageProfile: { profileId: 'grade-5-science-a1-a2-default', grade: 5, subject: 'science', learnerLanguageLevel: 'A1-A2' },
    productiveTerms: structuredClone(syntheticArtifact.language_support.productive_terms),
    materialContentRules: [],
    review: {
      ...structuredClone(sourceContext.profile.review),
      rootPath: reviewRoot,
      registryPath: `${reviewRoot}/review-registry.yaml`,
      guidePath: `${reviewRoot}/review-guide.md`,
      teacherTemplatePath: `${reviewRoot}/teacher-review-template.yaml`,
      safetyTemplatePath: `${reviewRoot}/local-safety-review-template.yaml`,
      trialGuidePath: `${reviewRoot}/classroom-trial-guide.md`,
      trialTemplatePath: `${reviewRoot}/classroom-trial-template.yaml`,
    },
  };
  const reviewRegistry = structuredClone(sourceContext.dependencies.reviewRegistry);
  reviewRegistry.file = profile.review.registryPath;
  reviewRegistry.data.artifact_id = packageId;
  reviewRegistry.data.artifact_index_path = indexPath;
  reviewRegistry.data.content_fingerprint = fingerprint;
  reviewRegistry.data.teacher_review.template_path = profile.review.teacherTemplatePath;
  reviewRegistry.data.local_safety_review.template_path = profile.review.safetyTemplatePath;
  reviewRegistry.data.classroom_trial.template_path = profile.review.trialTemplatePath;
  const indexEntry = { file: indexPath, text: '', data: syntheticArtifact, materialBytes };
  const registryEntry = {
    artifact_id: packageId,
    package_id: packageId,
    route: 'grade-5-science',
    root_path: rootPath,
    index_path: indexPath,
    validation_profile_id: profileId,
    lifecycle_status: 'internal_draft',
    content_fingerprint: fingerprint,
    review_registry_path: profile.review.registryPath,
    classroom_trial_template_path: profile.review.trialTemplatePath,
  };
  const context = {
    registryEntry,
    profile,
    indexEntry,
    route: grade5Route,
    dependencies: {
      paths: {
        topicInventory: 'curriculum-maps/grade-5-science/topic-inventory.yaml',
        bookInventory: 'curriculum-maps/grade-5-science/book-inventory.yaml',
        crosswalk: 'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
        extraction: 'evaluations/teacher-work-plans/grade-5-science-extraction.json',
        canonicalMarkdown: grade5Route.md_path,
        qa: grade5Route.qa_path,
        reviewRegistry: profile.review.registryPath,
      },
      topicInventory,
      bookInventory,
      crosswalk,
      extraction,
      canonicalMarkdown,
      qa,
      rootDirectoryFiles: [...profile.expectedRootEntries],
      reviewRegistry,
    },
  };
  repository.registryRepository.registry.data.artifacts.push(registryEntry);
  repository.registryRepository.profiles[profileId] = profile;
  repository.registryRepository.indexes.push(indexEntry);
  repository.registryRepository.discoveredIndexPaths.push(indexPath);
  repository.artifactContexts.push(context);
  repository.artifacts.push(indexEntry);
  repository.artifactById.set(packageId, context);
  const first = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.deepEqual(first.diagnostics, []);
  repository.registryRepository.registry.data.artifacts.reverse();
  repository.registryRepository.indexes.reverse();
  repository.registryRepository.discoveredIndexPaths.reverse();
  repository.artifactContexts.reverse();
  repository.artifacts.reverse();
  assert.deepEqual(validateTeacherWorkPlanReusableArtifactRepository(repository), first);
});
