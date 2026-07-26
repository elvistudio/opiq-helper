import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  derivePedagogicalEvidenceLinkState,
  loadPedagogicalReviewRepository,
  summarizePedagogicalEvidenceForPack,
  validatePedagogicalReviewRepository,
  validateStandalonePedagogicalEvidenceRecord,
} from './lib/pedagogical-reviews.mjs';

const packId = 'grade-5-science-water-teacher-pack';
const reviewPath =
  'pedagogical-reviews/grade-5-science/water/records/teacher-review-2026-08-01.yaml';
const classroomPath =
  'pedagogical-reviews/grade-5-science/water/records/classroom-trial-2026-08-01.yaml';
const homePath =
  'pedagogical-reviews/grade-5-science/water/records/home-trial-2026-08-01.yaml';
let baseline;

before(async () => {
  baseline = await loadPedagogicalReviewRepository();
});

function cloneRepository() {
  return {
    ...baseline,
    teacherPacks: structuredClone(baseline.teacherPacks),
    reviewTemplates: structuredClone(baseline.reviewTemplates),
    trialTemplates: structuredClone(baseline.trialTemplates),
    homeTrialTemplates: structuredClone(baseline.homeTrialTemplates),
    reviewRecords: structuredClone(baseline.reviewRecords),
    trialRecords: structuredClone(baseline.trialRecords),
    homeTrialRecords: structuredClone(baseline.homeTrialRecords),
    workflowDocuments: structuredClone(baseline.workflowDocuments),
    currentPackFingerprints: structuredClone(baseline.currentPackFingerprints),
    currentEvidenceIdentities: structuredClone(baseline.currentEvidenceIdentities),
    evidenceReferenceModels: structuredClone(baseline.evidenceReferenceModels),
    packIdentityErrors: { ...baseline.packIdentityErrors },
  };
}

function indexArtifact(repository) {
  const found = repository.teacherPacks.indexes.find(
    (entry) => entry.data.pack_id === packId,
  );
  assert.ok(found);
  return found;
}

function index(repository) {
  return indexArtifact(repository).data;
}

function identity(repository, commitSha = 'a'.repeat(40)) {
  return {
    ...structuredClone(repository.currentEvidenceIdentities[packId]),
    commit_sha: commitSha,
  };
}

function privacy() {
  return {
    contains_student_names: false,
    contains_birth_dates: false,
    contains_personal_identifiers: false,
    contains_addresses: false,
    contains_contact_information: false,
    contains_parent_contacts: false,
    contains_photographs: false,
    contains_recordings: false,
    contains_health_data: false,
    contains_special_category_data: false,
    contains_identifiable_grades: false,
    contains_identifiable_profiles: false,
    contains_identifiable_free_text: false,
    observations_are_aggregated: true,
    identity_storage: 'external',
    free_text_checked_for_identifiers: true,
  };
}

function ratingMap(value = 4) {
  return Object.fromEntries([
    'method_suitability_for_grade',
    'method_suitability_for_subject',
    'lesson_pattern_coherence',
    'timing_realism',
    'transition_setup_cleanup_realism',
    'cognitive_load',
    'total_productive_language_load',
    'russian_primary_explanation_quality',
    'estonian_a1_a2_support_fit',
    'retrieval_quality',
    'spaced_review_usefulness',
    'correction_and_self_explanation',
    'teacher_instruction_clarity',
    'classroom_feasibility',
    'homeschool_clarity',
    'parent_role_realism',
    'differentiation',
    'inclusion_accessibility',
    'assessment_validity',
    'subject_language_assessment_separation',
    'learner_autonomy',
    'motivation_competence_support',
    'safety',
    'material_availability',
    'artificial_repetitive_method_risk',
  ].map((field) => [field, value]));
}

function validReview(repository, deliveryScopes = ['classroom', 'homeschool']) {
  const ratings = ratingMap();
  const ratingApplicability = [];
  if (!deliveryScopes.includes('classroom')) {
    ratings.classroom_feasibility = 'not_applicable';
    ratingApplicability.push({
      dimension: 'classroom_feasibility',
      rationale: 'Classroom delivery is outside this review scope.',
    });
  }
  if (!deliveryScopes.includes('homeschool')) {
    for (const dimension of ['homeschool_clarity', 'parent_role_realism']) {
      ratings[dimension] = 'not_applicable';
      ratingApplicability.push({
        dimension,
        rationale: 'Homeschool delivery is outside this review scope.',
      });
    }
  }
  return {
    schema_version: '2.0',
    artifact_type: 'teacher_review',
    review_id: 'grade-5-water-review-2026-08-01',
    pack_ref: packId,
    evidence_identity: identity(repository),
    lifecycle: { supersedes: [] },
    review_status: 'completed',
    reviewer: {
      role: 'primary_science_teacher',
      subject_experience_years: 8,
      language_context: {
        instruction_language: 'ru',
        subject_support_language: 'et',
      },
      identity_storage: 'external',
      reviewer_reference: 'external-role-reference',
    },
    reviewed_at: '2026-08-01',
    delivery_scopes: deliveryScopes,
    review_scope: {
      teacher_guide: true,
      lesson_guides: [...index(repository).lesson_ids],
      student_materials: true,
      answer_keys: true,
      assessment_rubric: true,
      homeschool_materials: deliveryScopes.includes('homeschool'),
      safety: true,
      language_level: true,
      lesson_dna: true,
      selection_and_adaptation_artifacts: true,
    },
    ratings,
    rating_applicability: ratingApplicability,
    privacy: privacy(),
    findings: [],
    blocking_findings: [],
    required_changes: [],
    optional_improvements: [],
    decision: {
      status: 'approved',
      rationale: 'Synthetic schema fixture only; no production human evidence.',
    },
  };
}

function categoricalObservation(lessonId, summary = 'Synthetic aggregate observation.') {
  return {
    lesson_id: lessonId,
    phase_ids: [],
    rating: 'met',
    summary,
    aggregate_count: 1,
    aggregate_denominator: 1,
  };
}

function validClassroomTrial(repository) {
  const lessonId = index(repository).lesson_ids[0];
  const observation = () => [categoricalObservation(lessonId)];
  return {
    schema_version: '2.0',
    artifact_type: 'classroom_trial',
    trial_id: 'grade-5-water-classroom-trial-2026-08-01',
    pack_ref: packId,
    evidence_identity: identity(repository),
    lifecycle: { supersedes: [] },
    trial_status: 'analysed',
    context: {
      lesson_ids: [lessonId],
      setting: 'classroom',
      grade: 5,
      approximate_group_size: 24,
      learner_estonian_profile: 'A1-A2',
      instruction_language: 'ru',
      subject_support_language: 'et',
      teacher_role: 'primary_science_teacher',
    },
    privacy: privacy(),
    conducted_at: '2026-08-01',
    timing_observations: [{
      lesson_id: lessonId,
      phase_id: 'activation',
      planned_minutes: 5,
      actual_minutes: 5,
      setup_feasible: true,
      transition_feasible: true,
      summary: 'Synthetic aggregate timing observation.',
    }],
    instruction_comprehension: observation(),
    retrieval_and_correction: observation(),
    recall_and_transfer: observation(),
    participation_and_completion: observation(),
    language_support: observation(),
    differentiation_adjustments: [],
    lesson_dna_deviations: [],
    lesson_dna_deviation_status: 'none_observed',
    material_usability: observation(),
    safety_observations: [],
    method_execution_observations: observation(),
    unexpected_support: [],
    findings: [],
    decision: {
      status: 'successful',
      safe_to_repeat: true,
      rationale: 'Synthetic schema fixture only; no production trial.',
    },
  };
}

function validHomeTrial(repository) {
  const lessonId = index(repository).lesson_ids[0];
  const observation = () => [categoricalObservation(lessonId)];
  return {
    schema_version: '1.0',
    artifact_type: 'home_trial',
    trial_id: 'grade-5-water-home-trial-2026-08-01',
    pack_ref: packId,
    evidence_identity: identity(repository),
    lifecycle: { supersedes: [] },
    trial_status: 'analysed',
    context: {
      lesson_ids: [lessonId],
      setting: 'homeschool',
      grade: 5,
      learner_count: 1,
      study_context: 'individual_study',
      delivery_mode: 'parent_supported',
      adult_role: 'logistical_support',
      family_identity_storage: 'external',
    },
    privacy: privacy(),
    conducted_at: '2026-08-01',
    session_observations: [{
      lesson_id: lessonId,
      planned_minutes: 30,
      actual_minutes: 30,
      unplanned_adult_support: 'none',
      parent_role_bounded: true,
      summary: 'Synthetic aggregate session observation.',
    }],
    instruction_comprehension: observation(),
    adult_role: observation(),
    learner_independence: observation(),
    material_availability: observation(),
    offline_and_printer_assumptions: observation(),
    retrieval_and_correction: observation(),
    language_scaffolds: observation(),
    practical_safety: [],
    task_completion: observation(),
    recall_and_transfer: observation(),
    findings: [],
    decision: {
      status: 'successful',
      safe_to_repeat: true,
      parent_role_remained_bounded: true,
      rationale: 'Synthetic schema fixture only; no production home trial.',
    },
  };
}

function addReview(repository, record = validReview(repository)) {
  index(repository).pedagogical_review.review_record_paths = [reviewPath];
  const classroom = record.delivery_scopes.includes('classroom');
  const homeschool = record.delivery_scopes.includes('homeschool');
  index(repository).pedagogical_review.classroom_status =
    classroom ? 'approved' : 'pending';
  index(repository).pedagogical_review.homeschool_status =
    homeschool ? 'approved' : 'pending';
  index(repository).pedagogical_review.status =
    classroom && homeschool ? 'approved_for_both' : 'partial';
  repository.reviewRecords.push({ file: reviewPath, data: record });
}

function addClassroomTrial(repository, record = validClassroomTrial(repository)) {
  index(repository).classroom_trial.trial_record_paths = [classroomPath];
  index(repository).classroom_trial.status = 'tested';
  repository.trialRecords.push({ file: classroomPath, data: record });
}

function addHomeTrial(repository, record = validHomeTrial(repository)) {
  index(repository).home_trial.trial_record_paths = [homePath];
  index(repository).home_trial.status = 'tested';
  repository.homeTrialRecords.push({ file: homePath, data: record });
}

function syncDerivedStatuses(repository) {
  const statuses = derivePedagogicalEvidenceLinkState(
    repository,
    indexArtifact(repository),
  );
  Object.assign(index(repository).pedagogical_review, statuses.pedagogical_review);
  Object.assign(index(repository).classroom_trial, statuses.classroom_trial);
  Object.assign(index(repository).home_trial, statuses.home_trial);
}

function errors(repository) {
  return validatePedagogicalReviewRepository(repository).diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
}

function errorText(repository) {
  return errors(repository).map((diagnostic) => diagnostic.reason).join('\n');
}

function assertError(repository, pattern) {
  const text = errorText(repository);
  assert.match(text, pattern, text);
}

function finding(repository, severity = 'major', category = 'timing') {
  return {
    finding_id: `${severity}-${category}-finding`,
    severity,
    category,
    delivery_modes: ['classroom'],
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-01.md'],
    lesson_ids: [index(repository).lesson_ids[0]],
    phase_ids: [],
    target_ids: [],
    description: 'A concrete synthetic issue was observed.',
    evidence: 'Synthetic fixture evidence only.',
    recommended_action: 'Resolve before production readiness.',
    resolution_status: 'open',
    resolution_refs: [],
  };
}

test('production has valid templates and zero effective human evidence', () => {
  const result = validatePedagogicalReviewRepository(cloneRepository());
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.completedReviews, 0);
  assert.equal(result.summary.analysedTrials, 0);
  assert.equal(result.summary.analysedHomeTrials, 0);
  assert.equal(result.summary.effectiveReviews, 0);
  assert.equal(result.summary.effectiveTrials, 0);
  assert.equal(result.summary.effectiveHomeTrials, 0);
});

test('current classroom and homeschool review scopes are independent', () => {
  const repository = cloneRepository();
  addReview(repository, validReview(repository, ['classroom']));
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_classroom_review, true);
  assert.equal(summary.effective_homeschool_review, false);
  assert.equal(summary.review_aggregate_status, 'partial');
});

test('one current review may cover both delivery modes', () => {
  const repository = cloneRepository();
  addReview(repository);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_classroom_review, true);
  assert.equal(summary.effective_homeschool_review, true);
  assert.equal(summary.review_aggregate_status, 'approved_for_both');
});

test('commit SHA changes do not make identical evidence stale', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.evidence_identity.commit_sha = 'b'.repeat(40);
  addReview(repository, review);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_teacher_review, true);
  assert.equal(summary.stale_teacher_review, false);
});

for (const [label, mutate] of [
  ['fingerprint value', (record) => { record.evidence_identity.content_fingerprint.value = '0'.repeat(64); }],
  ['fingerprint file count', (record) => { record.evidence_identity.content_fingerprint.file_count += 1; }],
  ['taxonomy version', (record) => { record.evidence_identity.pedagogical_snapshot.taxonomy_version = '9.9'; }],
  ['taxonomy digest', (record) => { record.evidence_identity.pedagogical_snapshot.taxonomy_digest = '0'.repeat(64); }],
  ['selection rules version', (record) => { record.evidence_identity.pedagogical_snapshot.selection_rules_version = '9.9'; }],
  ['selection rules digest', (record) => { record.evidence_identity.pedagogical_snapshot.selection_rules_digest = '0'.repeat(64); }],
  ['selection engine version', (record) => { record.evidence_identity.pedagogical_snapshot.selection_engine_version = '9.9'; }],
  ['lesson DNA schema version', (record) => { record.evidence_identity.pedagogical_snapshot.lesson_dna_schema_version = '9.9'; }],
  ['activity catalogue digest', (record) => { record.evidence_identity.pedagogical_snapshot.activity_catalog_digest = '0'.repeat(64); }],
  ['homeschool rules version', (record) => { record.evidence_identity.pedagogical_snapshot.homeschool_rules_version = '9.9'; }],
  ['homeschool rules digest', (record) => { record.evidence_identity.pedagogical_snapshot.homeschool_rules_digest = '0'.repeat(64); }],
  ['homeschool engine version', (record) => { record.evidence_identity.pedagogical_snapshot.homeschool_engine_version = '9.9'; }],
  ['quality engine version', (record) => { record.evidence_identity.pedagogical_snapshot.quality_engine_version = '9.9'; }],
  ['quality catalogue version', (record) => { record.evidence_identity.pedagogical_snapshot.quality_catalogue_version = '9.9'; }],
  ['lesson DNA digest', (record) => { record.evidence_identity.pedagogical_snapshot.lesson_dna_digests[0].digest = '0'.repeat(64); }],
  ['quality catalogue digest', (record) => { record.evidence_identity.pedagogical_snapshot.quality_catalogue_digest = '0'.repeat(64); }],
  ['integration version', (record) => { record.evidence_identity.pedagogical_snapshot.integration_version = '9.9'; }],
  ['unit content identity', (record) => { record.evidence_identity.pedagogical_snapshot.unit_content_identity = '0'.repeat(64); }],
]) {
  test(`stale ${label} invalidates completed review`, () => {
    const repository = cloneRepository();
    const review = validReview(repository);
    mutate(review);
    addReview(repository, review);
    const summary = summarizePedagogicalEvidenceForPack(
      repository,
      indexArtifact(repository),
    );
    assert.equal(summary.effective_teacher_review, false);
    assert.equal(summary.stale_teacher_review, true);
  });
}

test('open blocking review finding prevents approval', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.findings = [finding(repository, 'blocking', 'safety')];
  review.blocking_findings = [review.findings[0].finding_id];
  addReview(repository, review);
  assertError(repository, /cannot retain open blocking or major findings/iu);
});

test('open major review finding prevents approval', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.findings = [finding(repository, 'major', 'timing')];
  addReview(repository, review);
  assertError(repository, /cannot retain open blocking or major findings/iu);
});

test('approved review rejects unresolved required change', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  const minor = finding(repository, 'minor', 'timing');
  minor.resolution_status = 'planned';
  minor.resolution_refs = ['issue-63'];
  review.findings = [minor];
  review.required_changes = [{
    change_id: 'timing-change',
    finding_refs: [minor.finding_id],
    description: 'Track a bounded timing correction.',
    resolution_status: 'open',
    resolution_refs: [],
  }];
  addReview(repository, review);
  assertError(repository, /bounded minor plans/iu);
});

test('approved_with_minor_notes accepts bounded referenced plan', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  const minor = finding(repository, 'minor', 'timing');
  minor.resolution_status = 'planned';
  minor.resolution_refs = ['issue-63'];
  review.findings = [minor];
  review.required_changes = [{
    change_id: 'timing-change',
    finding_refs: [minor.finding_id],
    description: 'Track a bounded timing correction.',
    resolution_status: 'planned',
    resolution_refs: ['issue-63'],
  }];
  review.decision.status = 'approved_with_minor_notes';
  addReview(repository, review);
  assert.deepEqual(errors(repository), []);
});

test('completed review requires every pedagogical dimension', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.ratings.retrieval_quality = null;
  addReview(repository, review);
  assertError(repository, /requires every pedagogical rating/iu);
});

test('completed homeschool review requires homeschool materials in scope', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.review_scope.homeschool_materials = false;
  addReview(repository, review);
  assertError(repository, /homeschool review scope requires homeschool materials/iu);
  assert.equal(
    summarizePedagogicalEvidenceForPack(
      repository,
      indexArtifact(repository),
    ).effective_homeschool_review,
    false,
  );
});

test('valid current classroom trial is effective only for classroom', () => {
  const repository = cloneRepository();
  addClassroomTrial(repository);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(
    summary.effective_classroom_trial,
    true,
    JSON.stringify(summary.diagnostics),
  );
  assert.equal(summary.effective_home_trial, false);
});

test('valid current home trial is effective only for homeschool', () => {
  const repository = cloneRepository();
  addHomeTrial(repository);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_home_trial, true);
  assert.equal(summary.effective_classroom_trial, false);
});

test('home trial requires bounded parent role', () => {
  const repository = cloneRepository();
  const trial = validHomeTrial(repository);
  trial.decision.parent_role_remained_bounded = false;
  addHomeTrial(repository, trial);
  assertError(repository, /requires a bounded parent/iu);
});

test('successful classroom trial rejects open safety finding', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.findings = [finding(repository, 'blocking', 'safety')];
  addClassroomTrial(repository, trial);
  assertError(repository, /cannot retain open blocking or major findings/iu);
});

test('privacy-invalid analysed record is rejected', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.privacy.contains_student_names = true;
  addClassroomTrial(repository, trial);
  assertError(repository, /must be equal to constant|privacy declaration/iu);
  assert.equal(
    summarizePedagogicalEvidenceForPack(
      repository,
      indexArtifact(repository),
    ).effective_classroom_trial,
    false,
  );
});

test('email address in free text is rejected by conservative privacy guard', () => {
  const repository = cloneRepository();
  const trial = validHomeTrial(repository);
  trial.decision.rationale = 'Contact family@example.com for the private follow-up.';
  addHomeTrial(repository, trial);
  assertError(repository, /privacy-risk text/iu);
});

test('phone number in free text is rejected by conservative privacy guard', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.decision.rationale = 'Call +372 5555 1234 for details.';
  addClassroomTrial(repository, trial);
  assertError(repository, /privacy-risk text/iu);
});

test('private-media URL is rejected by conservative privacy guard', () => {
  const repository = cloneRepository();
  const trial = validHomeTrial(repository);
  trial.decision.rationale = 'Recording: https://drive.google.com/private-media';
  addHomeTrial(repository, trial);
  assertError(repository, /privacy-risk text/iu);
});

test('unknown lesson reference is rejected', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.context.lesson_ids = ['unknown-lesson'];
  addClassroomTrial(repository, trial);
  assertError(repository, /unknown linked lesson/iu);
});

test('unresolved finding artifact path is rejected', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  const issue = finding(repository, 'minor', 'materials');
  issue.resolution_status = 'resolved';
  issue.artifact_paths = ['teacher-packs/grade-5-science/water/missing.md'];
  review.findings = [issue];
  addReview(repository, review);
  assertError(repository, /unresolved finding artifact/iu);
});

test('teacher-review template cannot be linked as evidence', () => {
  const repository = cloneRepository();
  index(repository).pedagogical_review.review_record_paths = [
    index(repository).pedagogical_review.template_path,
  ];
  assertError(repository, /template cannot be registered/iu);
});

test('classroom-trial template cannot be linked as evidence', () => {
  const repository = cloneRepository();
  index(repository).classroom_trial.trial_record_paths = [
    index(repository).classroom_trial.template_path,
  ];
  assertError(repository, /template cannot be registered/iu);
});

test('home-trial template cannot be linked as evidence', () => {
  const repository = cloneRepository();
  index(repository).home_trial.trial_record_paths = [
    index(repository).home_trial.template_path,
  ];
  assertError(repository, /template cannot be registered/iu);
});

test('superseded evidence is never effective', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.review_status = 'superseded';
  addReview(repository, review);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_teacher_review, false);
});

test('standalone current record validates without registration', () => {
  const repository = cloneRepository();
  const artifact = { file: reviewPath, data: validReview(repository) };
  const result = validateStandalonePedagogicalEvidenceRecord(
    repository,
    indexArtifact(repository),
    artifact,
    { requireEffective: true },
  );
  assert.equal(result.state.effective, true);
  assert.equal(result.diagnostics.filter((item) => item.severity === 'error').length, 0);
});

for (const decision of ['changes_required', 'rejected']) {
  test(`completed ${decision} teacher review is registerable negative evidence`, () => {
    const repository = cloneRepository();
    const review = validReview(repository, ['classroom']);
    const issue = finding(
      repository,
      decision === 'rejected' ? 'blocking' : 'major',
      'timing',
    );
    review.findings = [issue];
    review.blocking_findings = decision === 'rejected' ? [issue.finding_id] : [];
    review.required_changes = decision === 'changes_required' ? [{
      change_id: 'required-timing-change',
      finding_refs: [issue.finding_id],
      description: 'Correct the observed timing problem.',
      resolution_status: 'open',
      resolution_refs: [],
    }] : [];
    review.decision = {
      status: decision,
      rationale: 'Synthetic completed negative review evidence.',
    };
    const validation = validateStandalonePedagogicalEvidenceRecord(
      repository,
      indexArtifact(repository),
      { file: reviewPath, data: review },
      { requireRegisterable: true },
    );
    assert.equal(validation.state.registerable, true, JSON.stringify(validation.diagnostics));
    assert.equal(validation.state.positive_effective, false);
    assert.equal(validation.state.negative_effective, true);
  });
}

for (const [kind, decision, safeToRepeat] of [
  ['classroom', 'changes_required', true],
  ['classroom', 'repeat_trial_required', false],
  ['home', 'changes_required', true],
  ['home', 'repeat_trial_required', false],
]) {
  test(`${kind} ${decision} trial is registerable negative evidence`, () => {
    const repository = cloneRepository();
    const trial = kind === 'classroom'
      ? validClassroomTrial(repository)
      : validHomeTrial(repository);
    trial.decision.status = decision;
    trial.decision.safe_to_repeat = safeToRepeat;
    trial.decision.rationale = 'Synthetic completed negative trial evidence.';
    const validation = validateStandalonePedagogicalEvidenceRecord(
      repository,
      indexArtifact(repository),
      {
        file: kind === 'classroom' ? classroomPath : homePath,
        data: trial,
      },
      { requireRegisterable: true },
    );
    assert.equal(validation.state.registerable, true, JSON.stringify(validation.diagnostics));
    assert.equal(validation.state.positive_effective, false);
    assert.equal(validation.state.negative_effective, true);
  });
}

test('empty analysed classroom trial is not registerable', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  for (const field of [
    'timing_observations',
    'instruction_comprehension',
    'retrieval_and_correction',
    'recall_and_transfer',
    'participation_and_completion',
    'language_support',
    'material_usability',
    'safety_observations',
    'method_execution_observations',
  ]) trial[field] = [];
  const validation = validateStandalonePedagogicalEvidenceRecord(
    repository,
    indexArtifact(repository),
    { file: classroomPath, data: trial },
    { requireRegisterable: true },
  );
  assert.equal(validation.state.registerable, false);
  assert.match(
    validation.diagnostics.map((item) => item.reason).join('\n'),
    /fewer than 1|timing_observations|meaningful/iu,
  );
});

test('empty analysed home trial is not registerable', () => {
  const repository = cloneRepository();
  const trial = validHomeTrial(repository);
  for (const field of [
    'session_observations',
    'instruction_comprehension',
    'adult_role',
    'learner_independence',
    'material_availability',
    'offline_and_printer_assumptions',
    'retrieval_and_correction',
    'language_scaffolds',
    'task_completion',
    'recall_and_transfer',
  ]) trial[field] = [];
  const validation = validateStandalonePedagogicalEvidenceRecord(
    repository,
    indexArtifact(repository),
    { file: homePath, data: trial },
    { requireRegisterable: true },
  );
  assert.equal(validation.state.registerable, false);
  assert.match(
    validation.diagnostics.map((item) => item.reason).join('\n'),
    /fewer than 1|session_observations|meaningful/iu,
  );
});

test('successful trial with safe_to_repeat false is not registerable', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.decision.safe_to_repeat = false;
  const validation = validateStandalonePedagogicalEvidenceRecord(
    repository,
    indexArtifact(repository),
    { file: classroomPath, data: trial },
    { requireRegisterable: true },
  );
  assert.equal(validation.state.registerable, false);
  assert.match(
    validation.diagnostics.map((item) => item.reason).join('\n'),
    /safe_to_repeat: true/u,
  );
});

test('planned minor safety note supports successful_with_notes', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  const note = finding(repository, 'minor', 'safety');
  note.resolution_status = 'planned';
  note.resolution_refs = ['safety-plan'];
  trial.findings = [note];
  trial.decision.status = 'successful_with_notes';
  addClassroomTrial(repository, trial);
  assert.deepEqual(errors(repository), []);
});

test('open minor review finding without plan rejects approved_with_minor_notes', () => {
  const repository = cloneRepository();
  const review = validReview(repository);
  review.findings = [finding(repository, 'minor', 'timing')];
  review.decision.status = 'approved_with_minor_notes';
  addReview(repository, review);
  assertError(repository, /bounded minor plans/iu);
});

test('classroom-only review uses explicit homeschool not_applicable ratings', () => {
  const repository = cloneRepository();
  addReview(repository, validReview(repository, ['classroom']));
  assert.deepEqual(errors(repository), []);
  assert.equal(index(repository).pedagogical_review.classroom_status, 'approved');
  assert.equal(index(repository).pedagogical_review.homeschool_status, 'pending');
});

test('homeschool-only review uses explicit classroom not_applicable rating', () => {
  const repository = cloneRepository();
  addReview(repository, validReview(repository, ['homeschool']));
  assert.deepEqual(errors(repository), []);
  assert.equal(index(repository).pedagogical_review.classroom_status, 'pending');
  assert.equal(index(repository).pedagogical_review.homeschool_status, 'approved');
});

test('unknown observation phase is rejected', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.timing_observations[0].phase_id = 'unknown-phase';
  addClassroomTrial(repository, trial);
  assertError(repository, /unknown classroom phase/iu);
});

test('deviation target must match its classroom phase', () => {
  const repository = cloneRepository();
  const trial = validClassroomTrial(repository);
  trial.lesson_dna_deviation_status = 'observed';
  trial.lesson_dna_deviations = [{
    lesson_id: trial.context.lesson_ids[0],
    phase_ids: ['activation'],
    target_ids: ['not-the-selected-target'],
    description: 'Synthetic deviation reference.',
    reason: 'Exercise reference integrity.',
  }];
  addClassroomTrial(repository, trial);
  assertError(repository, /not bound to the referenced classroom phase/iu);
});

test('superseded stale review and its open finding remain historical only', () => {
  const repository = cloneRepository();
  const oldReview = validReview(repository, ['classroom']);
  oldReview.review_id = 'historical-classroom-review';
  oldReview.evidence_identity.content_fingerprint.value = '0'.repeat(64);
  const issue = finding(repository, 'major', 'timing');
  oldReview.findings = [issue];
  oldReview.required_changes = [{
    change_id: 'historical-timing-change',
    finding_refs: [issue.finding_id],
    description: 'Historical required change.',
    resolution_status: 'open',
    resolution_refs: [],
  }];
  oldReview.decision = {
    status: 'changes_required',
    rationale: 'Historical negative review.',
  };
  const successor = validReview(repository, ['classroom']);
  successor.review_id = 'current-classroom-review';
  successor.lifecycle.supersedes = [oldReview.review_id];
  const oldPath =
    'pedagogical-reviews/grade-5-science/water/records/historical-classroom-review.yaml';
  const successorPath =
    'pedagogical-reviews/grade-5-science/water/records/current-classroom-review.yaml';
  repository.reviewRecords.push(
    { file: oldPath, data: oldReview },
    { file: successorPath, data: successor },
  );
  index(repository).pedagogical_review.review_record_paths = [
    oldPath,
    successorPath,
  ];
  syncDerivedStatuses(repository);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_classroom_review, true);
  assert.equal(summary.negative_classroom_review, false);
  assert.equal(summary.open_review_findings.length, 0);
  assert.equal(summary.historical_evidence_states.length, 1);
  assert.equal(summary.historical_evidence_states[0].recordId, oldReview.review_id);
  assert.deepEqual(errors(repository), []);
});

test('a later content change may stale the active supersession terminal', () => {
  const repository = cloneRepository();
  const historical = validReview(repository, ['classroom']);
  historical.review_id = 'historical-classroom-review';
  const successor = validReview(repository, ['classroom']);
  successor.review_id = 'stale-successor-classroom-review';
  successor.lifecycle.supersedes = [historical.review_id];
  successor.evidence_identity.content_fingerprint.value = '0'.repeat(64);
  const historicalPath =
    'pedagogical-reviews/grade-5-science/water/records/historical-classroom-review.yaml';
  const successorPath =
    'pedagogical-reviews/grade-5-science/water/records/stale-successor-classroom-review.yaml';
  repository.reviewRecords.push(
    { file: historicalPath, data: historical },
    { file: successorPath, data: successor },
  );
  index(repository).pedagogical_review.review_record_paths = [
    historicalPath,
    successorPath,
  ];
  syncDerivedStatuses(repository);
  const summary = summarizePedagogicalEvidenceForPack(
    repository,
    indexArtifact(repository),
  );
  assert.equal(summary.effective_classroom_review, false);
  assert.equal(summary.stale_teacher_review, true);
  assert.equal(summary.historical_evidence_states.length, 1);
  assert.equal(summary.active_evidence_states[0].recordId, successor.review_id);
  assert.deepEqual(errors(repository), []);
});

test('current positive and negative review require explicit supersession', () => {
  const repository = cloneRepository();
  const positive = validReview(repository, ['classroom']);
  positive.review_id = 'positive-classroom-review';
  const negative = validReview(repository, ['classroom']);
  negative.review_id = 'negative-classroom-review';
  const issue = finding(repository, 'major', 'timing');
  negative.findings = [issue];
  negative.required_changes = [{
    change_id: 'negative-timing-change',
    finding_refs: [issue.finding_id],
    description: 'Current negative required change.',
    resolution_status: 'open',
    resolution_refs: [],
  }];
  negative.decision = {
    status: 'changes_required',
    rationale: 'Current negative review.',
  };
  const positivePath =
    'pedagogical-reviews/grade-5-science/water/records/positive-classroom-review.yaml';
  const negativePath =
    'pedagogical-reviews/grade-5-science/water/records/negative-classroom-review.yaml';
  repository.reviewRecords.push(
    { file: positivePath, data: positive },
    { file: negativePath, data: negative },
  );
  index(repository).pedagogical_review.review_record_paths = [
    negativePath,
    positivePath,
  ];
  syncDerivedStatuses(repository);
  assertError(repository, /conflicting current positive and negative/iu);
});

for (const reviewerReference of [
  'reviewer@example.com',
  'Ada Lovelace',
  'https://example.com/private-reviewer',
]) {
  test(`privacy-unsafe reviewer reference is rejected: ${reviewerReference}`, () => {
    const repository = cloneRepository();
    const review = validReview(repository);
    review.reviewer.reviewer_reference = reviewerReference;
    addReview(repository, review);
    assert.ok(errors(repository).length > 0);
  });
}
