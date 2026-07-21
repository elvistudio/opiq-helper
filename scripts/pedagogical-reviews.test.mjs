import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  loadPedagogicalReviewRepository,
  validatePedagogicalReviewRepository,
} from './lib/pedagogical-reviews.mjs';

const currentSha = 'a'.repeat(40);
const staleSha = 'b'.repeat(40);
const reviewPath = 'pedagogical-reviews/grade-5-science/water/records/teacher-review-2026-07-21.yaml';
const trialPath = 'pedagogical-reviews/grade-5-science/water/records/classroom-trial-2026-07-21.yaml';
let baseline;

before(async () => {
  baseline = await loadPedagogicalReviewRepository({ currentPackCommitSha: currentSha });
});

function cloneRepository() {
  return structuredClone(baseline);
}

function packIndex(repository) {
  assert.equal(repository.teacherPacks.indexes.length, 1);
  return repository.teacherPacks.indexes[0].data;
}

function thematic(repository) {
  const artifact = repository.teacherPacks.plans.artifacts.find((entry) => entry.data.artifact_type === 'bilingual_thematic_plan');
  assert.ok(artifact);
  return artifact.data;
}

function lessons(repository) {
  return repository.teacherPacks.plans.artifacts.filter((entry) => entry.data.artifact_type === 'bilingual_lesson');
}

function lessonIds(repository) {
  return packIndex(repository).lesson_ids;
}

function validReview(repository, overrides = {}) {
  return {
    schema_version: '1.0',
    artifact_type: 'teacher_review',
    review_id: 'grade-5-water-review-2026-07-21',
    pack_ref: packIndex(repository).pack_id,
    pack_commit_sha: currentSha,
    review_status: 'completed',
    reviewer: {
      role: 'primary_science_teacher',
      subject_experience_years: 8,
      language_context: { instruction_language: 'ru', subject_support_language: 'et' },
      identity_storage: 'external',
      reviewer_reference: 'external-review-reference',
    },
    reviewed_at: '2026-07-21',
    review_scope: {
      teacher_guide: true,
      lesson_guides: [...lessonIds(repository)],
      student_materials: true,
      answer_keys: true,
      assessment_rubric: true,
      homeschool_materials: true,
      safety: true,
      language_level: true,
    },
    ratings: {
      scientific_accuracy: 4,
      age_appropriateness: 4,
      timing_feasibility: 4,
      instruction_clarity: 4,
      student_material_usability: 4,
      assessment_alignment: 4,
      estonian_a1_a2_fit: 4,
      safety_readiness: 4,
      homeschool_usability: 4,
    },
    findings: [],
    blocking_findings: [],
    required_changes: [],
    optional_improvements: [],
    decision: { status: 'approved', rationale: 'All mandatory pack areas were independently checked.' },
    ...overrides,
  };
}

function validTrial(repository, overrides = {}) {
  return {
    schema_version: '1.0',
    artifact_type: 'classroom_trial',
    trial_id: 'grade-5-water-trial-2026-07-21',
    pack_ref: packIndex(repository).pack_id,
    pack_commit_sha: currentSha,
    trial_status: 'analysed',
    context: {
      lesson_ids: [lessonIds(repository)[0]],
      setting: 'classroom',
      grade: 5,
      approximate_group_size: 12,
      learner_estonian_profile: 'A1-A2',
      instruction_language: 'ru',
      subject_support_language: 'et',
      teacher_role: 'primary_science_teacher',
    },
    privacy: {
      contains_student_names: false,
      contains_birth_dates: false,
      contains_personal_identifiers: false,
      contains_addresses: false,
      contains_contact_information: false,
      contains_parent_contacts: false,
      contains_student_photos: false,
      contains_special_category_data: false,
      contains_identifiable_individual_grades: false,
      contains_identifiable_free_text: false,
      observations_are_aggregated: true,
      free_text_checked_for_identifiers: true,
    },
    conducted_at: '2026-07-21',
    timing_observations: [],
    instruction_observations: [],
    safety_observations: [],
    learning_evidence: [],
    language_evidence: [],
    material_usability: [],
    unexpected_support_needed: [],
    teacher_adjustments: [],
    findings: [],
    decision: { status: 'successful', safe_to_repeat: true, rationale: 'Aggregated evidence supports a safe repeat.' },
    ...overrides,
  };
}

function claimReviewApproved(repository) {
  packIndex(repository).pedagogical_review.status = 'approved';
  thematic(repository).teacher_pack.pedagogical_review.status = 'approved';
  thematic(repository).teacher_pack.teacher_review_status = 'approved';
  for (const lesson of lessons(repository)) {
    lesson.data.artifact_readiness.teacher_review = {
      status: 'approved',
      reviewer_role: 'primary_science_teacher',
      reviewed_at: '2026-07-21',
      notes: 'Independent review evidence is registered outside this synthetic fixture.',
    };
    lesson.data.artifact_readiness.readiness_status = 'teacher_reviewed';
  }
}

function addReview(repository, review = validReview(repository)) {
  packIndex(repository).pedagogical_review.review_record_path = reviewPath;
  thematic(repository).teacher_pack.pedagogical_review.review_record_path = reviewPath;
  repository.reviewRecords.push({ file: reviewPath, kind: 'teacher-review record', data: review });
}

function claimTrialTested(repository) {
  packIndex(repository).classroom_trial.status = 'tested';
  thematic(repository).teacher_pack.classroom_trial.status = 'tested';
  for (const lesson of lessons(repository)) {
    lesson.data.artifact_readiness.classroom_trial = {
      status: 'tested',
      tested_at: '2026-07-21',
      context: 'Synthetic aggregate classroom trial fixture.',
      notes: 'No production trial is represented by this test-only fixture.',
    };
    lesson.data.artifact_readiness.readiness_status = 'classroom_tested';
  }
}

function addTrial(repository, trial = validTrial(repository)) {
  packIndex(repository).classroom_trial.trial_record_paths = [trialPath];
  thematic(repository).teacher_pack.classroom_trial.trial_record_paths = [trialPath];
  repository.trialRecords.push({ file: trialPath, kind: 'classroom-trial record', data: trial });
}

function claimClassroomReady(repository) {
  thematic(repository).teacher_pack.classroom_ready = true;
  for (const lesson of lessons(repository)) {
    lesson.data.artifact_readiness.classroom_ready = true;
    lesson.data.artifact_readiness.readiness_status = 'classroom_ready';
  }
}

function errors(repository) {
  return validatePedagogicalReviewRepository(repository).diagnostics.filter((entry) => entry.severity === 'error');
}

function diagnosticText(repository, severity = 'error') {
  return validatePedagogicalReviewRepository(repository).diagnostics
    .filter((entry) => entry.severity === severity)
    .map((entry) => `${entry.file} ${entry.field} ${entry.reason}`)
    .join('\n');
}

function assertFailsWith(repository, pattern) {
  const text = diagnosticText(repository);
  assert.match(text, pattern, text);
}

test('production templates validate while pending state has zero completed evidence records', () => {
  const result = validatePedagogicalReviewRepository(cloneRepository());
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.completedReviews, 0);
  assert.equal(result.summary.analysedTrials, 0);
  assert.equal(result.summary.warnings, 2);
});

test('synthetic current review and analysed trial can prove classroom readiness', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository);
  claimTrialTested(repository);
  addTrial(repository);
  claimClassroomReady(repository);
  assert.deepEqual(errors(repository), []);
});

test('approved_with_minor_notes accepts a documented minor resolution plan for review status', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  review.decision = { status: 'approved_with_minor_notes', rationale: 'The non-blocking timing note has a tracked plan.' };
  review.findings.push({
    finding_id: 'minor-transition-cue', severity: 'minor', category: 'timing',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-02.md'],
    lesson_ids: [lessonIds(repository)[1]], description: 'A transition cue could be more explicit.',
    evidence: 'The independent dry run needed one clarification.', recommended_action: 'Add the cue in a follow-up change.',
    resolution_status: 'planned', resolution_refs: ['issue-102'],
  });
  addReview(repository, review);
  assert.deepEqual(errors(repository), []);
});

test('completed changes-required review may honestly retain an open major finding', () => {
  const repository = cloneRepository();
  packIndex(repository).pedagogical_review.status = 'changes_requested';
  thematic(repository).teacher_pack.pedagogical_review.status = 'changes_requested';
  thematic(repository).teacher_pack.teacher_review_status = 'changes_requested';
  const review = validReview(repository);
  review.decision = { status: 'changes_required', rationale: 'The timing problem must be corrected before approval.' };
  review.findings.push({
    finding_id: 'major-timing-gap', severity: 'major', category: 'timing',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-03.md'],
    lesson_ids: [lessonIds(repository)[2]], description: 'The dry run exceeded the lesson duration.',
    evidence: 'The independent dry run required additional setup time.', recommended_action: 'Revise and repeat the timing review.',
    resolution_status: 'open', resolution_refs: [],
  });
  addReview(repository, review);
  assert.deepEqual(errors(repository), []);
});

test('approved teacher review without a record fails', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  assertFailsWith(repository, /approved requires a registered completed review record/iu);
});

test('completed review without reviewer role fails', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  delete review.reviewer.role;
  addReview(repository, review);
  assertFailsWith(repository, /missing required field role|requires reviewer role/iu);
});

test('completed review without date fails', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository, validReview(repository, { reviewed_at: null }));
  assertFailsWith(repository, /requires a valid date/iu);
});

test('review for another pack commit is stale', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository, validReview(repository, { pack_commit_sha: staleSha }));
  assert.match(diagnosticText(repository, 'warning'), /teacher review is stale for the current teacher-pack commit/iu);
  assertFailsWith(repository, /stale teacher review cannot prove current readiness/iu);
});

test('completed review must cover safety', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  review.review_scope.safety = false;
  addReview(repository, review);
  assertFailsWith(repository, /must cover safety/iu);
});

test('open blocking review finding prevents approval', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  review.findings.push({
    finding_id: 'unsafe-vessel', severity: 'blocking', category: 'safety',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-03.md'],
    lesson_ids: [lessonIds(repository)[2]], description: 'The vessel control is unclear.',
    evidence: 'The printed guide permits an unsafe interpretation.', recommended_action: 'Clarify teacher-only control.',
    resolution_status: 'open', resolution_refs: [],
  });
  review.blocking_findings = ['unsafe-vessel'];
  addReview(repository, review);
  assertFailsWith(repository, /open blocking finding prevents approval/iu);
});

test('open major review finding prevents approval', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  review.findings.push({
    finding_id: 'timing-overrun', severity: 'major', category: 'timing',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-03.md'],
    lesson_ids: [lessonIds(repository)[2]], description: 'The practical sequence exceeds 45 minutes.',
    evidence: 'Independent dry run required 58 minutes.', recommended_action: 'Shorten setup and retest timing.',
    resolution_status: 'open', resolution_refs: [],
  });
  addReview(repository, review);
  assertFailsWith(repository, /open major finding prevents approval/iu);
});

test('analysed trial without complete privacy declarations fails', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  const trial = validTrial(repository);
  delete trial.privacy.free_text_checked_for_identifiers;
  addTrial(repository, trial);
  assertFailsWith(repository, /missing required field free_text_checked_for_identifiers|requires complete no-personal-data declarations/iu);
});

test('trial rejects prohibited personal-data fields', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  const trial = validTrial(repository);
  trial.student_names = ['prohibited'];
  addTrial(repository, trial);
  assertFailsWith(repository, /unknown field student_names/iu);
});

test('analysed trial requires at least one lesson ID', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  const trial = validTrial(repository);
  trial.context.lesson_ids = [];
  addTrial(repository, trial);
  assertFailsWith(repository, /requires at least one lesson ID/iu);
});

test('open classroom safety blocker fails', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  const trial = validTrial(repository);
  trial.findings.push({
    finding_id: 'hot-vessel-access', severity: 'blocking', category: 'safety',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-03.md'],
    lesson_ids: [lessonIds(repository)[2]], description: 'Pupils could reach the warm vessel.',
    evidence: 'Aggregated observer note identified access during setup.', recommended_action: 'Move setup behind teacher line.',
    resolution_status: 'open', resolution_refs: [],
  });
  addTrial(repository, trial);
  assertFailsWith(repository, /open safety blocker prevents successful trial/iu);
});

test('classroom ready without review fails', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  addTrial(repository);
  claimClassroomReady(repository);
  assertFailsWith(repository, /classroom_ready requires an effective approved teacher review/iu);
});

test('classroom ready without trial fails', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository);
  claimClassroomReady(repository);
  assertFailsWith(repository, /classroom_ready requires an effective analysed classroom trial/iu);
});

test('classroom ready rejects stale review', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository, validReview(repository, { pack_commit_sha: staleSha }));
  claimTrialTested(repository);
  addTrial(repository);
  claimClassroomReady(repository);
  assertFailsWith(repository, /stale teacher review cannot prove current readiness/iu);
});

test('classroom ready rejects stale trial', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  addReview(repository);
  claimTrialTested(repository);
  addTrial(repository, validTrial(repository, { pack_commit_sha: staleSha }));
  claimClassroomReady(repository);
  assert.match(diagnosticText(repository, 'warning'), /classroom trial is stale for the current teacher-pack commit/iu);
  assertFailsWith(repository, /stale classroom trial cannot prove current readiness/iu);
});

test('teacher-review template cannot be registered as completed evidence', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const templatePath = repository.reviewTemplates[0].file;
  packIndex(repository).pedagogical_review.review_record_path = templatePath;
  thematic(repository).teacher_pack.pedagogical_review.review_record_path = templatePath;
  assertFailsWith(repository, /template cannot be used as completed evidence/iu);
});

test('conducted but not analysed trial cannot prove tested status', () => {
  const repository = cloneRepository();
  claimTrialTested(repository);
  addTrial(repository, validTrial(repository, { trial_status: 'conducted' }));
  assertFailsWith(repository, /must have trial_status: analysed/iu);
});

test('approval fails while required changes remain open', () => {
  const repository = cloneRepository();
  claimReviewApproved(repository);
  const review = validReview(repository);
  review.findings.push({
    finding_id: 'clarify-timing', severity: 'minor', category: 'timing',
    artifact_paths: ['teacher-packs/grade-5-science/water/lessons/lesson-02.md'],
    lesson_ids: [lessonIds(repository)[1]], description: 'Transition timing needs clarification.',
    evidence: 'Dry run showed an ambiguous transition.', recommended_action: 'Add a concrete transition cue.',
    resolution_status: 'planned', resolution_refs: ['issue-101'],
  });
  review.required_changes.push({
    change_id: 'resolve-timing', finding_refs: ['clarify-timing'], description: 'Clarify lesson 2 transition timing.',
    resolution_status: 'open', resolution_refs: [],
  });
  addReview(repository, review);
  assertFailsWith(repository, /approval requires required change resolve-timing to be closed/iu);
});
