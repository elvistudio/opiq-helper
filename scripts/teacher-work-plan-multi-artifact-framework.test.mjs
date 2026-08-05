import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';

import {
  TEACHER_WORK_PLAN_ARTIFACT_PROFILES,
} from './lib/teacher-work-plan-artifact-profiles.mjs';
import {
  loadTeacherWorkPlanArtifactRegistry,
  validateTeacherWorkPlanArtifactRegistry,
} from './lib/teacher-work-plan-artifact-registry.mjs';
import {
  computeTeacherWorkPlanArtifactFingerprint,
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './lib/teacher-work-plan-reusable-artifacts.mjs';
import {
  loadTeacherWorkPlanArtifactReviewRepositories,
  loadTeacherWorkPlanArtifactReviewRepository,
  validateTeacherWorkPlanArtifactReviewRepositories,
  validateTeacherWorkPlanArtifactReviewRepository,
} from './lib/teacher-work-plan-artifact-reviews.mjs';
import {
  loadTeacherWorkPlanArtifactClassroomTrialRepositories,
  loadTeacherWorkPlanArtifactClassroomTrialRepository,
  validateTeacherWorkPlanArtifactClassroomTrialRepositories,
  validateTeacherWorkPlanArtifactClassroomTrialRepository,
} from './lib/teacher-work-plan-artifact-classroom-trials.mjs';

const SOURCE_ROOT = process.cwd();
const SOIL_ID = 'grade-6-science-soil-organisms';
const SOIL_PROFILE_ID = `${SOIL_ID}-v1`;
const SYNTHETIC_ID = 'grade-5-science-local-water-events';
const SYNTHETIC_PROFILE_ID = `${SYNTHETIC_ID}-synthetic-v1`;
const SYNTHETIC_ROOT = 'teacher-work-plan-artifacts/grade-5-science/local-water-events';
const SYNTHETIC_INDEX = `${SYNTHETIC_ROOT}/artifact-index.yaml`;
const SYNTHETIC_REVIEW_ROOT = `${SYNTHETIC_ROOT}/reviews`;

let fixtureRoot;
let profiles;
let loaded;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function copyRepositoryFile(relativePath) {
  const destination = path.join(fixtureRoot, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(SOURCE_ROOT, relativePath), destination);
}

async function writeRepositoryFile(relativePath, content) {
  const destination = path.join(fixtureRoot, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

async function readYaml(relativePath) {
  return parse(await fs.readFile(path.join(SOURCE_ROOT, relativePath), 'utf8'));
}

async function writeYaml(relativePath, value) {
  await writeRepositoryFile(relativePath, stringify(value, { lineWidth: 0 }));
}

function exactArtifactIdentity(profile) {
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

function guideText(headings, boundaryStatements) {
  return `${headings.map((heading) => `${heading}\n\nSynthetic workflow guidance.\n`).join('\n')}\n${boundaryStatements.join('\n')}\n`;
}

async function buildFixture() {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-helper-two-artifacts-'));
  const dependencyFiles = [
    'source-manifest.json',
    'lesson-plans/language-profiles.yaml',
    'schemas/teacher-work-plan-artifact-registry.schema.json',
    'schemas/teacher-work-plan-reusable-artifact.schema.json',
    'schemas/teacher-work-plan-artifact-review.schema.json',
    'schemas/teacher-work-plan-artifact-classroom-trial.schema.json',
    'schemas/teacher-work-plan-work-packages.schema.json',
    'evaluations/teacher-work-plans/grades-5-7-gap-report.json',
    'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'curriculum-maps/grade-5-science/topic-inventory.yaml',
    'curriculum-maps/grade-5-science/book-inventory.yaml',
    'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
    'curriculum-maps/grade-6-science/topic-inventory.yaml',
    'curriculum-maps/grade-6-science/book-inventory.yaml',
    'curriculum-maps/grade-6-science/teacher-work-plan-crosswalk.yaml',
    'project-files/outputs/opiq_5klass_loodusopetus.md',
    'project-files/outputs/opiq_5klass_loodusopetus_qa.json',
    'project-files/outputs/opiq_6klass_loodusopetus.md',
    'project-files/outputs/opiq_6klass_loodusopetus_qa.json',
  ];
  await Promise.all(dependencyFiles.map(copyRepositoryFile));
  await fs.mkdir(path.join(fixtureRoot, 'teacher-work-plan-artifacts/grade-6-science'), { recursive: true });
  await fs.cp(
    path.join(SOURCE_ROOT, 'teacher-work-plan-artifacts/grade-6-science/soil-organisms'),
    path.join(fixtureRoot, 'teacher-work-plan-artifacts/grade-6-science/soil-organisms'),
    { recursive: true },
  );

  const [manifest, gapReport, workPackages, grade5Extraction, grade5Topics, grade5Books] = await Promise.all([
    fs.readFile(path.join(SOURCE_ROOT, 'source-manifest.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(SOURCE_ROOT, 'evaluations/teacher-work-plans/grades-5-7-gap-report.json'), 'utf8').then(JSON.parse),
    readYaml('evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml'),
    fs.readFile(path.join(SOURCE_ROOT, 'evaluations/teacher-work-plans/grade-5-science-extraction.json'), 'utf8').then(JSON.parse),
    readYaml('curriculum-maps/grade-5-science/topic-inventory.yaml'),
    readYaml('curriculum-maps/grade-5-science/book-inventory.yaml'),
  ]);
  const grade5Route = manifest.sources.find(({ id }) => id === 'grade-5-science');
  const gap = gapReport.gap_items.find(({ gap_id }) => gap_id === 'grade-5-science-lesson-022');
  const workPackage = workPackages.work_packages.find(({ package_id }) => package_id === SYNTHETIC_ID);
  const topic = grade5Topics.topics.find(({ topic_id }) => topic_id === 'rivers-and-lakes');
  const contextRecord = topic.selected_records.find(({ record_id }) => record_id === 'rivers-ru-avita');
  const contextBook = grade5Books.books.find(({ book_id }) => book_id === contextRecord.book_id);
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

  const materialSpecs = [
    {
      material_id: 'local-water-events-bridge', capability: 'author_created_bridge',
      title: 'Synthetic route-local bridge', filename: 'bridge.md', audience: 'teacher',
      languages: ['ru'], text: `# Synthetic Grade 5 bridge\n\nOptional route-local context: ${contextRecord.canonical_url}\n`,
    },
    {
      material_id: 'local-water-events-worksheet', capability: 'student_worksheet',
      title: 'Synthetic worksheet', filename: 'student-worksheet.md', audience: 'student',
      languages: ['ru', 'et'], text: '# Synthetic Grade 5 worksheet\n\nCollect aggregate local-water event notes.\n',
      answer_key_path: `${SYNTHETIC_ROOT}/answer-key.md`,
    },
    {
      material_id: 'local-water-events-answer-key', capability: 'answer_key',
      title: 'Synthetic answer key', filename: 'answer-key.md', audience: 'teacher',
      languages: ['ru'], text: '# Synthetic Grade 5 answer key\n\nAccept evidence-backed local examples.\n',
    },
    {
      material_id: 'local-water-events-rubric', capability: 'assessment_rubric',
      title: 'Synthetic assessment rubric', filename: 'assessment-rubric.md', audience: 'teacher',
      languages: ['ru'], text: '# Synthetic Grade 5 rubric\n\nAssess source use and explanation separately.\n',
    },
  ];
  const materials = [];
  for (const spec of materialSpecs) {
    const artifactPath = `${SYNTHETIC_ROOT}/${spec.filename}`;
    const bytes = Buffer.from(spec.text, 'utf8');
    await writeRepositoryFile(artifactPath, bytes);
    materials.push({
      material_id: spec.material_id,
      capability: spec.capability,
      title: spec.title,
      artifact_path: artifactPath,
      audience: spec.audience,
      languages: spec.languages,
      printable: true,
      provenance: 'independently_authored',
      ...(spec.answer_key_path ? { answer_key_path: spec.answer_key_path } : {}),
      sha256: sha256(bytes),
    });
  }
  const fingerprint = computeTeacherWorkPlanArtifactFingerprint(materials);
  const syntheticContext = {
    inventory_bucket: 'selected_records',
    topic_inventory_ref: topic.topic_id,
    record_id: contextRecord.record_id,
    canonical_url: contextRecord.canonical_url,
    canonical_source_id: contextRecord.canonical_source_id,
    book_id: contextRecord.book_id,
    title: contextRecord.title,
    language: contextRecord.language,
    programme_type: contextRecord.programme_type,
    programme_type_evidence_status: contextBook.programme_type_evidence.status,
    default_course_eligibility: 'eligible',
    instructional_roles: contextRecord.instructional_roles,
    relationship_to_pilot: 'route_local_context_only_not_local_event_evidence',
    required_for_learner_completion: false,
  };
  const reviewProfile = TEACHER_WORK_PLAN_ARTIFACT_PROFILES[SOIL_PROFILE_ID].review;
  const trialProfile = TEACHER_WORK_PLAN_ARTIFACT_PROFILES[SOIL_PROFILE_ID].classroomTrial;
  const syntheticProfile = {
    profileId: SYNTHETIC_PROFILE_ID,
    artifactId: SYNTHETIC_ID,
    packageId: SYNTHETIC_ID,
    route: 'grade-5-science',
    rootPath: SYNTHETIC_ROOT,
    indexPath: SYNTHETIC_INDEX,
    fingerprint,
    identity: { grade: 5, subject: 'science', subjectEt: 'loodusõpetus' },
    expectedRootEntries: ['answer-key.md', 'artifact-index.yaml', 'assessment-rubric.md', 'bridge.md', 'reviews', 'student-worksheet.md'],
    capabilities: materialSpecs.map(({ capability }) => capability),
    materialPaths: materials.map(({ artifact_path }) => artifact_path),
    answerKeyLinks: { student_worksheet: `${SYNTHETIC_ROOT}/answer-key.md` },
    studentFacingPaths: [`${SYNTHETIC_ROOT}/student-worksheet.md`],
    urlAllowedPaths: [`${SYNTHETIC_ROOT}/bridge.md`],
    internalLeakPatterns: ['gap_id', 'mapping_id', 'programme_type', 'source_gap', 'curriculum-maps/', 'evaluations/', 'project-files/', 'teacher-work-plan-crosswalk'],
    sourceGaps: [sourceGap],
    teacherPlanRelevantPages: [9],
    contextTopicId: topic.topic_id,
    contextRecords: [syntheticContext],
    languageProfile: { profileId: 'grade-5-science-a1-a2-default', grade: 5, subject: 'science', learnerLanguageLevel: 'A1-A2' },
    productiveTerms: [{ et: 'jõgi', ru: 'река' }],
    safetyApplicability: {
      fieldworkApplicable: false,
      protectedAreaPermissionApplicable: false,
      indoorFallbackApplicable: false,
      requiresApplicabilityDeclaration: true,
      expectedRules: {
        local_teacher_risk_assessment_required: false,
        universal_safety_claimed: false,
        protected_area_permission_is_teacher_responsibility: false,
        indoor_fallback_available: false,
      },
    },
    materialContentRules: [],
    review: {
      rootPath: SYNTHETIC_REVIEW_ROOT,
      registryPath: `${SYNTHETIC_REVIEW_ROOT}/review-registry.yaml`,
      guidePath: `${SYNTHETIC_REVIEW_ROOT}/review-guide.md`,
      teacherTemplatePath: `${SYNTHETIC_REVIEW_ROOT}/teacher-review-template.yaml`,
      safetyTemplatePath: `${SYNTHETIC_REVIEW_ROOT}/local-safety-review-template.yaml`,
      trialGuidePath: `${SYNTHETIC_REVIEW_ROOT}/classroom-trial-guide.md`,
      trialTemplatePath: `${SYNTHETIC_REVIEW_ROOT}/classroom-trial-template.yaml`,
      teacherScope: [...reviewProfile.teacherScope],
      safetyScope: [...reviewProfile.safetyScope],
      guideHeadings: [...reviewProfile.guideHeadings],
      guideBoundaryStatements: [...reviewProfile.guideBoundaryStatements],
    },
    classroomTrial: {
      parts: [{
        part_id: 'part-1',
        source_gap_id: sourceGap.gap_id,
        title_et: sourceGap.source_topic_et,
        planned_duration_minutes: 45,
        dimensions: ['timing', 'instruction_comprehension', 'material_usability'],
      }],
      guideHeadings: [...trialProfile.guideHeadings],
      guideBoundaryStatements: [
        'This pull request does not conduct a trial.',
        'The template is a workflow aid, not human evidence',
        'A trial must not begin until',
        'Do not commit learner or facilitator names',
        'does not make the canonical Opiq gap `matched` or `partial`',
        'does not prove comparative effectiveness',
      ],
    },
  };
  profiles = {
    [SOIL_PROFILE_ID]: TEACHER_WORK_PLAN_ARTIFACT_PROFILES[SOIL_PROFILE_ID],
    [SYNTHETIC_PROFILE_ID]: syntheticProfile,
  };

  const syntheticArtifact = {
    schema_version: '1.0',
    artifact_type: 'teacher_work_plan_reusable_artifact',
    artifact_id: SYNTHETIC_ID,
    package_id: SYNTHETIC_ID,
    implementation_status: 'internal_draft_pending_teacher_review',
    identity: {
      grade: 5, subject: 'science', subject_et: 'loodusõpetus',
      title_ru: 'События, связанные с местными водоёмами',
      title_et: 'Kodupiirkonna veekogudega seotud sündmused',
      instruction_language: 'ru', subject_support_language: 'et',
    },
    canonical_route: {
      source_id: grade5Route.id, md_path: grade5Route.md_path,
      source_archive: grade5Route.source_archive, qa_path: grade5Route.qa_path,
      record_count: grade5Route.record_count, coverage_status: grade5Route.coverage_status,
    },
    source_work_package: {
      review_id: workPackages.review_id,
      review_path: 'evaluations/teacher-work-plans/grades-5-7-priority-work-packages.yaml',
      package_id: workPackage.package_id,
      authoring_status: workPackage.authoring_status,
      priority_tier: workPackage.priority_tier,
      selected_as_first_pilot: workPackage.selected_as_first_pilot,
      planned_root_path: workPackage.planned_root_path,
      proposed_deliverables: workPackage.proposed_deliverables,
    },
    source_gaps: [sourceGap],
    teacher_plan_source: {
      extraction_path: 'evaluations/teacher-work-plans/grade-5-science-extraction.json',
      source_pdf_path: grade5Extraction.source.repository_path,
      original_filename: grade5Extraction.source.original_filename,
      source_sha256: grade5Extraction.source.sha256,
      source_page_count: grade5Extraction.source.page_count,
      relevant_source_pages: [9],
      provenance_kind: grade5Extraction.source.provenance_kind,
      canonical: grade5Extraction.source.canonical,
    },
    learner_language_profile: {
      profile_id: 'grade-5-science-a1-a2-default',
      profile_path: 'lesson-plans/language-profiles.yaml',
      learner_language_level: 'A1-A2',
      expected_supported_estonian_output_sentences: { minimum: 1, maximum: 2 },
    },
    content_boundary: {
      opiq_required: false,
      customer_or_learner_can_complete_without_opiq: true,
      external_sources_used: false,
      live_catalogue_checked: false,
      pupil_facing_science_provenance: 'independently_authored',
      teacher_plan_contribution: ['topic_scope', 'source_pages'],
      teacher_plan_does_not_supply: ['local_event_source_set', 'assessment_rubric'],
      direct_opiq_local_water_event_evidence_available: false,
    },
    opiq_context_records: [syntheticContext],
    lesson_sequence: [{
      part_id: 'part-1', source_gap_id: sourceGap.gap_id,
      title_ru: 'События у местных водоёмов', title_et: sourceGap.source_topic_et,
      duration_minutes: 45, primary_outputs: ['source_based_summary'],
    }],
    language_support: {
      provenance: 'independently_authored_language_support',
      represented_as_opiq_oral_evidence: false,
      productive_terms: syntheticProfile.productiveTerms,
      sentence_frames: ['See sündmus toimus ___.'],
      full_russian_model_answer_required: true,
    },
    safety_and_ethics: {
      fieldwork_applicable: false,
      protected_area_permission_applicable: false,
      indoor_fallback_applicable: false,
      local_teacher_risk_assessment_required: false,
      universal_safety_claimed: false,
      protected_area_permission_is_teacher_responsibility: false,
      safeguards: ['classroom_source_review_only'],
      scientific_boundaries: ['local_examples_do_not_establish_route_completeness'],
      indoor_fallback_available: false,
    },
    materials,
    content_fingerprint: { algorithm: 'sha256', value: fingerprint, index_included: false },
    human_review: {
      registry_path: syntheticProfile.review.registryPath,
      teacher_review: { status: 'pending', completed_record_path: null },
      local_safety_review: { status: 'pending', completed_record_path: null },
      classroom_trial: {
        workflow_created: true, template_path: syntheticProfile.review.trialTemplatePath,
        status: 'not_tested', completed_record_path: null,
      },
      reviewed_content_fingerprint: null,
    },
    readiness: {
      schema_complete: true, content_complete_for_internal_review: true,
      materials_resolved: true, print_ready: true,
      teacher_review: { status: 'pending' },
      local_safety_review: { required: true, status: 'pending' },
      classroom_trial: { status: 'not_tested' },
      classroom_ready: false, publication_ready: false, customer_released: false,
      effectiveness_claimed: false,
    },
    source_gap_support: {
      independently_authored_support_created: true,
      supported_gap_ids: [sourceGap.gap_id],
      canonical_opiq_gap_status_unchanged: true,
      source_gap_resolution_claimed: false,
      official_curriculum_complete: false,
      annual_architecture_created: false,
      default_course_selection_complete: false,
      live_catalogue_complete: false,
    },
  };
  await writeYaml(SYNTHETIC_INDEX, syntheticArtifact);

  const registry = await readYaml('teacher-work-plan-artifacts/artifact-registry.yaml');
  registry.artifacts = registry.artifacts.filter(({ artifact_id }) => artifact_id === SOIL_ID);
  registry.artifacts.push({
    artifact_id: SYNTHETIC_ID,
    package_id: SYNTHETIC_ID,
    route: 'grade-5-science',
    root_path: SYNTHETIC_ROOT,
    index_path: SYNTHETIC_INDEX,
    validation_profile_id: SYNTHETIC_PROFILE_ID,
    lifecycle_status: 'internal_draft',
    content_fingerprint: fingerprint,
    review_registry_path: syntheticProfile.review.registryPath,
    classroom_trial_template_path: syntheticProfile.review.trialTemplatePath,
  });
  await writeYaml('teacher-work-plan-artifacts/artifact-registry.yaml', registry);

  const [teacherTemplate, safetyTemplate, trialTemplate, soilReviewRegistry] = await Promise.all([
    readYaml('teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/teacher-review-template.yaml'),
    readYaml('teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/local-safety-review-template.yaml'),
    readYaml('teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/classroom-trial-template.yaml'),
    readYaml('teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/review-registry.yaml'),
  ]);
  const identity = exactArtifactIdentity(syntheticProfile);
  teacherTemplate.artifact_identity = identity;
  safetyTemplate.artifact_identity = identity;
  trialTemplate.artifact_identity = {
    artifact_id: identity.artifact_id,
    artifact_index_path: identity.artifact_index_path,
    package_id: identity.package_id,
    route: identity.route,
    grade: identity.grade,
    subject: identity.subject,
    subject_et: identity.subject_et,
    content_fingerprint: identity.content_fingerprint,
  };
  trialTemplate.classroom_context.lesson_parts = ['part-1'];
  trialTemplate.classroom_context.planned_duration_minutes = { 'part-1': 45 };
  trialTemplate.part_observations = [{
    part_id: 'part-1', source_gap_id: sourceGap.gap_id,
    title_et: sourceGap.source_topic_et, planned_duration_minutes: 45,
    actual_duration_minutes: null,
    dimensions: syntheticProfile.classroomTrial.parts[0].dimensions.map((dimension_id) => ({
      dimension_id, status: 'not_observed', notes: null, finding_ids: [],
    })),
  }];
  const reviewRegistry = structuredClone(soilReviewRegistry);
  reviewRegistry.registry_id = `${SYNTHETIC_ID}-review-registry`;
  reviewRegistry.artifact_id = SYNTHETIC_ID;
  reviewRegistry.artifact_index_path = SYNTHETIC_INDEX;
  reviewRegistry.content_fingerprint = fingerprint;
  reviewRegistry.teacher_review.template_path = syntheticProfile.review.teacherTemplatePath;
  reviewRegistry.local_safety_review.template_path = syntheticProfile.review.safetyTemplatePath;
  reviewRegistry.classroom_trial.template_path = syntheticProfile.review.trialTemplatePath;
  await Promise.all([
    writeYaml(syntheticProfile.review.registryPath, reviewRegistry),
    writeYaml(syntheticProfile.review.teacherTemplatePath, teacherTemplate),
    writeYaml(syntheticProfile.review.safetyTemplatePath, safetyTemplate),
    writeYaml(syntheticProfile.review.trialTemplatePath, trialTemplate),
    writeRepositoryFile(syntheticProfile.review.guidePath, guideText(syntheticProfile.review.guideHeadings, syntheticProfile.review.guideBoundaryStatements)),
    writeRepositoryFile(syntheticProfile.review.trialGuidePath, guideText(syntheticProfile.classroomTrial.guideHeadings, syntheticProfile.classroomTrial.guideBoundaryStatements)),
  ]);

  loaded = await loadAll();
}

async function loadAll({ registryText = null, discoveredIndexPaths = null } = {}) {
  const registry = await loadTeacherWorkPlanArtifactRegistry({
    rootDir: fixtureRoot, profiles, registryText, discoveredIndexPaths,
  });
  const reusable = await loadTeacherWorkPlanReusableArtifactRepository({
    rootDir: fixtureRoot, profiles, registryText, discoveredIndexPaths,
  });
  const reviews = await loadTeacherWorkPlanArtifactReviewRepositories({
    rootDir: fixtureRoot, reusableRepository: reusable,
  });
  const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepositories({
    rootDir: fixtureRoot, reusableRepository: reusable, reviewRepositories: reviews,
  });
  return { registry, reusable, reviews, trials };
}

function validateAll(repository = loaded) {
  return {
    registry: validateTeacherWorkPlanArtifactRegistry(repository.registry),
    reusable: validateTeacherWorkPlanReusableArtifactRepository(repository.reusable),
    reviews: validateTeacherWorkPlanArtifactReviewRepositories(repository.reviews),
    trials: validateTeacherWorkPlanArtifactClassroomTrialRepositories(repository.trials),
  };
}

function diagnosticText(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

async function freshReusable() {
  return loadTeacherWorkPlanReusableArtifactRepository({ rootDir: fixtureRoot, profiles });
}

test.before(buildFixture);
test.after(async () => fs.rm(fixtureRoot, { recursive: true, force: true }));

test('two-artifact repository passes every aggregate loader and validator end to end', () => {
  const results = validateAll();
  assert.deepEqual(results.registry.diagnostics, []);
  assert.deepEqual(results.reusable.diagnostics, []);
  assert.deepEqual(results.reviews.diagnostics, []);
  assert.deepEqual(results.trials.diagnostics, []);
  assert.equal(results.registry.summary.registered_artifacts, 2);
  assert.equal(results.reusable.summary.artifacts, 2);
  assert.equal(results.reviews.summary.review_registries, 2);
  assert.equal(results.trials.summary.trial_templates, 2);
  assert.deepEqual([...loaded.reusable.artifactById.keys()].sort(), [SYNTHETIC_ID, SOIL_ID].sort());
  assert.notEqual(results.reusable.summary.fingerprints[SOIL_ID], results.reusable.summary.fingerprints[SYNTHETIC_ID]);
});

test('artifact-selectable review and trial APIs validate both artifact IDs independently', async () => {
  for (const artifactId of [SOIL_ID, SYNTHETIC_ID]) {
    const reviews = await loadTeacherWorkPlanArtifactReviewRepository({
      rootDir: fixtureRoot, artifactId, reusableRepository: loaded.reusable,
    });
    assert.deepEqual(validateTeacherWorkPlanArtifactReviewRepository(reviews).diagnostics, []);
    const trials = await loadTeacherWorkPlanArtifactClassroomTrialRepository({
      rootDir: fixtureRoot, artifactId, reusableRepository: loaded.reusable, reviewRepository: reviews,
    });
    assert.deepEqual(validateTeacherWorkPlanArtifactClassroomTrialRepository(trials).diagnostics, []);
  }
});

test('ordinary Grade 5 context and explicit non-fieldwork applicability validate from route-local evidence', () => {
  const context = loaded.reusable.artifactById.get(SYNTHETIC_ID);
  assert.deepEqual(context.indexEntry.data.opiq_context_records[0], context.profile.contextRecords[0]);
  assert.equal(context.indexEntry.data.opiq_context_records[0].programme_type, 'ordinary');
  assert.equal(context.indexEntry.data.opiq_context_records[0].programme_type_evidence_status, 'verified');
  assert.equal(context.indexEntry.data.opiq_context_records[0].default_course_eligibility, 'eligible');
  assert.equal(context.indexEntry.data.safety_and_ethics.fieldwork_applicable, false);
  assert.equal(context.indexEntry.data.safety_and_ethics.protected_area_permission_is_teacher_responsibility, false);
  assert.equal(context.indexEntry.data.safety_and_ethics.indoor_fallback_available, false);
});

test('registry and discovery order do not change aggregate summaries or diagnostics', async () => {
  const registry = parse(await fs.readFile(path.join(fixtureRoot, 'teacher-work-plan-artifacts/artifact-registry.yaml'), 'utf8'));
  registry.artifacts.reverse();
  const reversed = await loadAll({
    registryText: stringify(registry, { lineWidth: 0 }),
    discoveredIndexPaths: [SYNTHETIC_INDEX, profiles[SOIL_PROFILE_ID].indexPath],
  });
  assert.deepEqual(validateAll(reversed), validateAll(loaded));
});

const contextMutations = [
  ['programme type differs from inventory', (record) => { record.programme_type = 'supplementary'; }, /metadata differs|context records differ/u],
  ['programme evidence status differs from inventory', (record) => { record.programme_type_evidence_status = 'partial'; }, /programme evidence|context records differ/u],
  ['ordinary eligibility differs from inventory', (record) => { record.default_course_eligibility = 'ineligible'; }, /programme evidence|context records differ/u],
  ['simplified record is promoted to ordinary eligible context', (record) => Object.assign(record, {
    record_id: 'water-solid-liquid-simplified', canonical_url: 'https://www.opiq.ee/kit/275/chapter/15515',
    book_id: '5k_loodusõpetus_harno_est', title: 'Tahked kehad ja vedelikud', language: 'et',
    programme_type: 'ordinary', programme_type_evidence_status: 'verified', default_course_eligibility: 'eligible',
    instructional_roles: ['optional_extension'],
  }), /rejected record|metadata differs|context records differ/u],
  ['rejected inventory record is used as context', (record) => { record.record_id = 'water-solid-liquid-simplified'; }, /rejected record|context records differ/u],
  ['adjacent-route context is used', (record) => Object.assign(record, profiles[SOIL_PROFILE_ID].contextRecords[0]), /unknown route-local|context records differ/u],
  ['context URL differs from inventory', (record) => { record.canonical_url = 'https://www.opiq.ee/kit/17/chapter/1'; }, /metadata differs|canonical Markdown|context records differ/u],
  ['context book differs from inventory', (record) => { record.book_id = '5k_loodusõpetus_harno_est'; }, /metadata differs|programme evidence|context records differ/u],
];

for (const [name, mutate, pattern] of contextMutations) {
  test(`fails closed when ${name}`, async () => {
    const repository = await freshReusable();
    mutate(repository.artifactById.get(SYNTHETIC_ID).indexEntry.data.opiq_context_records[0]);
    const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
    assert.notEqual(result.diagnostics.length, 0);
    assert.match(diagnosticText(result), pattern);
    assert.equal(result.summary.artifacts, 2);
  });
}

const isolationMutations = [
  ['soil material path', (context) => { context.indexEntry.data.materials[0].artifact_path = profiles[SOIL_PROFILE_ID].materialPaths[0]; }, /material path|material paths differ|registered artifact root/u],
  ['soil source gap', (context) => { context.indexEntry.data.source_gaps[0] = structuredClone(profiles[SOIL_PROFILE_ID].sourceGaps[0]); }, /source-gap snapshots|source gaps differ/u],
  ['soil review registry', (context) => { context.registryEntry.review_registry_path = profiles[SOIL_PROFILE_ID].review.registryPath; }, /review_registry_path|review registry/u],
  ['soil trial template', (context) => { context.registryEntry.classroom_trial_template_path = profiles[SOIL_PROFILE_ID].review.trialTemplatePath; }, /classroom_trial_template_path|trial template/u],
  ['soil fingerprint', (context) => { context.indexEntry.data.content_fingerprint.value = profiles[SOIL_PROFILE_ID].fingerprint; }, /fingerprint/u],
];

for (const [name, mutate, pattern] of isolationMutations) {
  test(`fails closed when Grade 5 artifact uses ${name}`, async () => {
    const repository = await freshReusable();
    const context = repository.artifactById.get(SYNTHETIC_ID);
    mutate(context);
    const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
    assert.notEqual(result.diagnostics.length, 0);
    assert.match(diagnosticText(result), pattern);
    assert.equal(repository.artifactById.has(SOIL_ID), true);
    assert.equal(result.summary.artifacts, 2);
    assert.match(diagnosticText(result), /grade-5-science\/local-water-events/u);
  });
}

for (const [name, field] of [
  ['fieldwork risk assessment', 'local_teacher_risk_assessment_required'],
  ['protected-area responsibility', 'protected_area_permission_is_teacher_responsibility'],
  ['indoor fallback', 'indoor_fallback_available'],
]) {
  test(`non-fieldwork applicability rejects contradictory ${name} claim`, async () => {
    const repository = await freshReusable();
    repository.artifactById.get(SYNTHETIC_ID).indexEntry.data.safety_and_ethics[field] = true;
    const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
    assert.notEqual(result.diagnostics.length, 0);
    assert.match(diagnosticText(result), new RegExp(field, 'u'));
  });
}

test('one invalid artifact remains precisely attributable without hiding the valid artifact', async () => {
  const repository = await freshReusable();
  repository.artifactById.get(SYNTHETIC_ID).indexEntry.data.safety_and_ethics.indoor_fallback_available = true;
  const result = validateTeacherWorkPlanReusableArtifactRepository(repository);
  assert.equal(result.summary.artifacts, 2);
  assert.equal(repository.artifactById.get(SOIL_ID).indexEntry.data.artifact_id, SOIL_ID);
  assert.match(diagnosticText(result), new RegExp(`${SYNTHETIC_INDEX}.*indoor_fallback`, 'u'));
  assert.doesNotMatch(diagnosticText(result), /soil-organisms\/artifact-index\.yaml.*indoor_fallback/u);
});

test('generic schemas and validators contain no fixed soil identity, gap, material, or review-root constants', async () => {
  const genericFiles = [
    'schemas/teacher-work-plan-reusable-artifact.schema.json',
    'scripts/lib/teacher-work-plan-reusable-artifacts.mjs',
    'scripts/lib/teacher-work-plan-artifact-reviews.mjs',
    'scripts/lib/teacher-work-plan-artifact-classroom-trials.mjs',
  ];
  const forbidden = [
    'grade-6-science-soil-organisms',
    'grade-6-science-lesson-008',
    'grade-6-science-lesson-009',
    'soil-organisms/teacher-guide.md',
    'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews',
  ];
  for (const file of genericFiles) {
    const text = await fs.readFile(path.join(SOURCE_ROOT, file), 'utf8');
    for (const value of forbidden) assert.equal(text.includes(value), false, `${file} contains ${value}`);
  }
});
