import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import test from 'node:test';

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
  return {
    ...repository,
    artifacts: repository.artifacts.map((entry) => ({
      ...entry,
      data: structuredClone(entry.data),
      materialBytes: new Map([...entry.materialBytes].map(([key, value]) => [key, value && Buffer.from(value)])),
    })),
    loadDiagnostics: structuredClone(repository.loadDiagnostics),
    schema: structuredClone(repository.schema),
    gapReport: structuredClone(repository.gapReport),
    workPackageRepository: {
      ...repository.workPackageRepository,
      artifact: structuredClone(repository.workPackageRepository.artifact),
      schema: structuredClone(repository.workPackageRepository.schema),
    },
    topicInventory: structuredClone(repository.topicInventory),
    bookInventory: structuredClone(repository.bookInventory),
    crosswalk: structuredClone(repository.crosswalk),
    manifest: structuredClone(repository.manifest),
    extraction: structuredClone(repository.extraction),
    languageProfiles: structuredClone(repository.languageProfiles),
    reviewRegistry: repository.reviewRegistry && {
      ...repository.reviewRegistry,
      data: structuredClone(repository.reviewRegistry.data),
    },
    pilotDirectoryFiles: [...repository.pilotDirectoryFiles],
  };
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
    artifacts: 1,
    source_gaps_supported: 2,
    materials: 7,
    opiq_context_records: 4,
    fingerprint: '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613',
    canonical_gap_statuses_unchanged: true,
    review_registry: 1,
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
    const mapping = baseline.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === mappingId);
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
    classroom_trial: { status: 'not_tested', completed_record_path: null },
    reviewed_content_fingerprint: null,
  });
  assert.equal(baseline.reviewRegistry.data.content_fingerprint, data.content_fingerprint.value);
  assert.deepEqual(baseline.reviewRegistry.data.teacher_review.completed_record_paths, []);
  assert.deepEqual(baseline.reviewRegistry.data.local_safety_review.completed_record_paths, []);
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
  ['missing index', (repo) => { repo.artifacts = []; }, /expected exactly one artifact index/u],
  ['extra artifact index', (repo) => { repo.artifacts.push({ ...repo.artifacts[0], file: `${PILOT_ROOT}/extra/artifact-index.yaml` }); }, /expected exactly one artifact index/u],
  ['missing material', (repo) => { repo.artifacts[0].materialBytes.set(MATERIAL_PATHS[0], null); }, /missing material/u],
  ['extra material', (repo) => { repo.pilotDirectoryFiles.push('extra.md'); repo.pilotDirectoryFiles.sort(); }, /pilot directory must contain exactly/u],
  ['wrong package ID', (repo) => { artifact(repo).package_id = 'grade-6-science-other'; }, /must be equal to constant/u],
  ['wrong route', (repo) => { artifact(repo).canonical_route.source_id = 'grade-7-science'; }, /canonical route|grade-6-science/u],
  ['wrong grade', (repo) => { artifact(repo).identity.grade = 7; }, /must be equal to constant|canonical route/u],
  ['wrong subject', (repo) => { artifact(repo).identity.subject = 'geography'; }, /must be equal to constant/u],
  ['wrong gap ID', (repo) => { artifact(repo).source_gaps[0].gap_id = 'grade-6-science-lesson-010'; }, /source gap snapshots/u],
  ['partial gap substituted', (repo) => { artifact(repo).source_gaps[0].coverage_status = 'partial'; }, /missing|source gap snapshots/u],
  ['wrong source page', (repo) => { artifact(repo).source_gaps[0].source_pages = [4]; }, /source gap snapshots/u],
  ['wrong source topic', (repo) => { artifact(repo).source_gaps[0].source_topic_et = 'Muld'; }, /source gap snapshots/u],
  ['wrong PDF SHA', (repo) => { artifact(repo).teacher_plan_source.source_sha256 = '0'.repeat(64); }, /teacher-plan provenance/u],
  ['wrong Opiq URL', (repo) => { artifact(repo).opiq_context_records[0].canonical_url = 'https://www.opiq.ee/kit/269/chapter/1'; }, /optional context record|canonical Markdown/u],
  ['rejected record', (repo) => { artifact(repo).opiq_context_records[0].record_id = 'soil-et-composition-legacy'; }, /rejected record|optional context record/u],
  ['title drift', (repo) => { artifact(repo).opiq_context_records[0].title = 'Другая страница'; }, /metadata differs|optional context record/u],
  ['book ID drift', (repo) => { artifact(repo).opiq_context_records[0].book_id = 'other-book'; }, /metadata differs|optional context record/u],
  ['role drift', (repo) => { artifact(repo).opiq_context_records[0].instructional_roles = ['practice_ru']; }, /metadata differs|optional context record/u],
  ['oral role fabricated', (repo) => { artifact(repo).opiq_context_records[1].instructional_roles.push('oral_answer_et'); }, /oral_answer_et/u],
  ['programme promoted', (repo) => { artifact(repo).opiq_context_records[0].programme_type = 'ordinary'; }, /unknown|programme evidence/u],
  ['eligibility promoted', (repo) => { artifact(repo).opiq_context_records[0].default_course_eligibility = 'eligible'; }, /unverified|optional context record/u],
  ['Opiq required', (repo) => { artifact(repo).content_boundary.opiq_required = true; }, /must be equal to constant/u],
  ['external URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[0], (text) => `${text}https:\/\/example.com\n`); }, /non-Opiq external URL/u],
  ['extra Opiq context URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[0], (text) => `${text}https:\/\/www.opiq.ee\/kit\/269\/chapter\/1\n`); }, /exactly the four registered/u],
  ['student Opiq URL added', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[2], (text) => `${text}https:\/\/www.opiq.ee\/kit\/269\/chapter\/15287\n`); }, /URLs are allowed only/u],
  ['internal path leaked', (repo) => { replaceMaterial(repo, MATERIAL_PATHS[3], (text) => `${text}project-files\/secret\n`); }, /internal analysis leakage/u],
  ['material outside root', (repo) => { artifact(repo).materials[0].artifact_path = 'docs/teacher-guide.md'; }, /pilot root|exact seven-item order/u],
  ['duplicate capability', (repo) => { artifact(repo).materials[1].capability = 'teacher_guide'; }, /duplicate material capability|exact seven-item order/u],
  ['missing capability', (repo) => { artifact(repo).materials.pop(); }, /must NOT have fewer than 7 items|exact seven-item order/u],
  ['wrong answer-key path', (repo) => { artifact(repo).materials[2].answer_key_path = MATERIAL_PATHS[0]; }, /must point to answer-key/u],
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
  ['crosswalk gap promoted', (repo) => { repo.crosswalk.lesson_range_mappings.find(({ mapping_id }) => mapping_id === 'lesson-008').coverage_status = 'partial'; }, /must remain missing/u],
  ['official completeness promoted', (repo) => { artifact(repo).source_gap_support.official_curriculum_complete = true; }, /must be equal to constant/u],
  ['missing review registry', (repo) => { repo.reviewRegistry = null; }, /review registry is missing/u],
  ['stale review fingerprint', (repo) => { repo.reviewRegistry.data.content_fingerprint = '0'.repeat(64); }, /pin the current material fingerprint/u],
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
  assert.equal(first.summary.fingerprint, computeTeacherWorkPlanArtifactFingerprint(artifact(baseline).materials));
});
