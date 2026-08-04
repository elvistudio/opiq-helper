import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  CLASSROOM_TRIAL_TEMPLATE_PATH,
  loadTeacherWorkPlanArtifactClassroomTrialRepository,
  validateTeacherWorkPlanArtifactClassroomTrialRepository,
} from './lib/teacher-work-plan-artifact-classroom-trials.mjs';

const PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const REVIEW_ROOT = `${PILOT_ROOT}/reviews`;
const GUIDE_PATH = `${REVIEW_ROOT}/classroom-trial-guide.md`;
const REGISTRY_PATH = `${REVIEW_ROOT}/review-registry.yaml`;
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
const PART1_DIMENSIONS = [
  'timing',
  'setup_and_transitions',
  'instruction_comprehension',
  'practical_safety',
  'equal_area_and_time_adherence',
  'observation_and_data_recording',
  'material_usability',
  'accessibility_and_participation',
  'ethical_return_and_restoration',
  'method_naturalness',
];
const PART2_DIMENSIONS = [
  'timing',
  'setup_and_transitions',
  'instruction_comprehension',
  'group_synthesis',
  'russian_subject_explanation',
  'estonian_language_support',
  'assessment_and_feedback',
  'material_usability',
  'accessibility_and_participation',
  'immediate_recall_and_transfer',
  'method_naturalness',
];

let baseline;

function cloneEntry(entry) {
  return entry && { ...entry, data: structuredClone(entry.data) };
}

function cloneReusable(repository) {
  return {
    ...repository,
    artifacts: repository.artifacts.map((entry) => ({
      ...entry,
      data: structuredClone(entry.data),
      materialBytes: new Map([...entry.materialBytes].map(([key, value]) => [key, value === null ? null : Buffer.from(value)])),
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
    reviewRegistry: cloneEntry(repository.reviewRegistry),
    pilotDirectoryFiles: [...repository.pilotDirectoryFiles],
  };
}

function cloneReview(repository, reusableRepository) {
  return {
    ...repository,
    schema: structuredClone(repository.schema),
    registry: cloneEntry(repository.registry),
    teacherTemplate: cloneEntry(repository.teacherTemplate),
    safetyTemplate: cloneEntry(repository.safetyTemplate),
    completedTeacherReviews: repository.completedTeacherReviews.map(cloneEntry),
    completedSafetyReviews: repository.completedSafetyReviews.map(cloneEntry),
    completedClassroomTrials: repository.completedClassroomTrials.map(cloneEntry),
    reviewDirectoryFiles: [...repository.reviewDirectoryFiles],
    reusableRepository,
    loadDiagnostics: structuredClone(repository.loadDiagnostics),
  };
}

function cloneRepository() {
  const reusableRepository = cloneReusable(baseline.reusableRepository);
  const reviewRepository = cloneReview(baseline.reviewRepository, reusableRepository);
  return {
    ...baseline,
    schema: structuredClone(baseline.schema),
    trialTemplate: cloneEntry(baseline.trialTemplate),
    completedTrials: baseline.completedTrials.map(cloneEntry),
    reusableRepository,
    reviewRepository,
    loadDiagnostics: structuredClone(baseline.loadDiagnostics),
  };
}

function reasons(result) {
  return result.diagnostics.map(({ file, field, reason }) => `${file} ${field} ${reason}`).join('\n');
}

function expectInvalid(repository, pattern, options) {
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(repository, options);
  assert.notEqual(result.diagnostics.length, 0, 'mutation unexpectedly validated');
  assert.match(reasons(result), pattern);
}

function makeCompletedReview(template, { safety = false } = {}) {
  const data = structuredClone(template.data);
  data.template = false;
  data.review_identity = {
    review_id: safety ? 'synthetic-safety-context' : 'synthetic-teacher-review',
    reviewer_id: safety ? 'synthetic-safety-reviewer' : 'synthetic-teacher-reviewer',
    reviewer_name: safety ? 'Synthetic Safety Reviewer' : 'Synthetic Teacher Reviewer',
    reviewer_role: safety ? 'local safety reviewer' : 'science teacher',
    organization: 'Synthetic Test Organization',
    review_date: '2026-08-04',
  };
  for (const item of data.review_scope) {
    item.status = 'acceptable';
    item.notes = 'Synthetic in-memory scope review.';
  }
  if (safety) {
    data.local_context = {
      school_or_organization: 'Synthetic Test Organization',
      site_description: 'Synthetic enclosed teaching site',
      planned_activity_date: '2026-08-10',
      group_size: 12,
      adult_supervision_count: 2,
      delivery_site_category: 'mixed',
      indoor_fallback_permitted: true,
      weather_limitations: 'Use indoor fallback in unsafe conditions',
      accessibility_adjustments: 'Level indoor fallback available',
      permission_requirements: 'Synthetic site confirmation required',
      emergency_contact_process: 'Use the local synthetic test process',
    };
    data.decision = {
      status: 'approved_for_named_context',
      rationale: 'Synthetic in-memory named-context approval.',
      open_blocking_findings: [],
      open_major_findings: [],
      required_changes_complete: true,
      reviewed_fingerprint_matches: true,
      conditions: [],
    };
  } else {
    data.decision = {
      status: 'approved',
      rationale: 'Synthetic in-memory teacher approval.',
      open_blocking_findings: [],
      open_major_findings: [],
      required_changes_complete: true,
      reviewed_fingerprint_matches: true,
    };
  }
  return data;
}

function safetySnapshot(safety) {
  const context = safety.local_context;
  return {
    review_id: safety.review_identity.review_id,
    school_or_organization: context.school_or_organization,
    site_description: context.site_description,
    planned_activity_date: context.planned_activity_date,
    approved_group_size: context.group_size,
    approved_adult_supervision_count: context.adult_supervision_count,
    approved_delivery_site_category: context.delivery_site_category,
    approved_indoor_fallback_permitted: context.indoor_fallback_permitted,
    approved_weather_limitations: context.weather_limitations,
    approved_accessibility_adjustments: context.accessibility_adjustments,
    approved_permission_requirements: context.permission_requirements,
    approved_emergency_contact_process: context.emergency_contact_process,
    approved_conditions: [...safety.decision.conditions],
  };
}

function prepareValidTrial(repository, decisionStatus = 'successful') {
  const teacherPath = `${REVIEW_ROOT}/synthetic-teacher-review.yaml`;
  const safetyPath = `${REVIEW_ROOT}/synthetic-safety-review.yaml`;
  const trialPath = `${REVIEW_ROOT}/synthetic-classroom-trial.yaml`;
  const teacher = { file: teacherPath, text: '', data: makeCompletedReview(repository.reviewRepository.teacherTemplate) };
  const safety = { file: safetyPath, text: '', data: makeCompletedReview(repository.reviewRepository.safetyTemplate, { safety: true }) };
  repository.reviewRepository.completedTeacherReviews = [teacher];
  repository.reviewRepository.completedSafetyReviews = [safety];
  const registry = repository.reviewRepository.registry.data;
  registry.teacher_review.completed_record_paths = [teacherPath];
  registry.teacher_review.status = 'approved';
  registry.local_safety_review.completed_record_paths = [safetyPath];
  registry.local_safety_review.status = 'approved_for_named_context';
  registry.boundaries.review_complete = true;
  registry.boundaries.local_safety_review_complete = true;

  const data = structuredClone(repository.trialTemplate.data);
  data.template = false;
  data.trial_identity = {
    trial_id: 'synthetic-classroom-trial',
    facilitator_reference: 'facilitator-ref-001',
    anonymized_group_reference: 'group-ref-001',
    trial_date: '2026-08-10',
    analysis_date: '2026-08-11',
  };
  data.prerequisites = {
    teacher_review_required: true,
    teacher_review_record_path: teacherPath,
    teacher_review_status: 'approved',
    local_safety_review_required: true,
    local_safety_review_record_path: safetyPath,
    local_safety_review_status: 'approved_for_named_context',
    current_fingerprint_matches: true,
    prerequisites_satisfied: true,
  };
  data.privacy = {
    aggregate_observations_only: true,
    no_learner_names_or_identifiers: true,
    manual_privacy_review_complete: true,
    free_text_privacy_review_complete: true,
    recordings_collected: false,
    identifiable_media_collected: false,
  };
  data.lifecycle.status = 'analysed';
  data.classroom_context = {
    ...data.classroom_context,
    group_size: 12,
    adult_supervision_count: 2,
    delivery_site_category: 'mixed',
    school_or_organization: 'Synthetic Test Organization',
    site_description: 'Synthetic enclosed teaching site',
    named_context_reference: 'synthetic-safety-context',
    accessibility_adjustments: 'Level indoor fallback available',
    weather_or_indoor_fallback_used: false,
    safety_context_snapshot: safetySnapshot(safety.data),
    safety_condition_confirmations: [{
      condition: 'Use indoor fallback in unsafe conditions',
      confirmed: true,
      notes: 'Synthetic aggregate confirmation of the approved weather limitation.',
    }],
  };
  for (const part of data.part_observations) {
    part.actual_duration_minutes = 45;
    for (const dimension of part.dimensions) {
      dimension.status = 'met';
      dimension.notes = 'Aggregate observation met the planned criterion.';
    }
  }
  data.aggregate_observations = {
    learners_started: 12,
    learners_completed: 12,
    safety_incident_count: 0,
    stop_condition_triggered: false,
    indoor_fallback_used: false,
    material_reprint_or_repair_needed: false,
    group_completion_status: 'all_completed',
    general_notes: 'Aggregate classroom observations only.',
  };
  data.decision = {
    status: decisionStatus,
    rationale: decisionStatus === 'repeat_trial_required'
      ? 'A repeat trial is required after revision.'
      : 'Synthetic in-memory analysed trial decision.',
    open_blocking_findings: [],
    open_major_findings: [],
    required_changes_complete: decisionStatus !== 'repeat_trial_required',
    reviewed_fingerprint_matches: true,
    safe_to_repeat: decisionStatus !== 'repeat_trial_required',
  };
  if (decisionStatus === 'successful_with_notes') {
    data.findings = [{
      finding_id: 'minor-timing-adjustment',
      severity: 'minor',
      area: 'timing',
      description: 'Aggregate transition timing needed a small adjustment.',
      required_change: 'Clarify the transition cue.',
      affected_paths: [`${PILOT_ROOT}/teacher-guide.md`],
      status: 'resolved',
      resolution_notes: 'Synthetic in-memory resolution confirmed.',
    }];
    data.part_observations[0].dimensions[0].status = 'partly_met';
    data.part_observations[0].dimensions[0].finding_ids = ['minor-timing-adjustment'];
  }
  if (decisionStatus === 'repeat_trial_required') data.part_observations[0].dimensions[0].status = 'not_met';
  const trial = { file: trialPath, text: '', data };
  repository.completedTrials = [trial];
  repository.reviewRepository.completedClassroomTrials = [trial];
  registry.classroom_trial.completed_record_paths = [trialPath];
  registry.classroom_trial.status = decisionStatus;
  registry.boundaries.classroom_trial_complete = true;
  registry.boundaries.classroom_ready = ['successful', 'successful_with_notes'].includes(decisionStatus);
  repository.reviewRepository.reviewDirectoryFiles.push(teacherPath, safetyPath, trialPath);
  repository.reviewRepository.reviewDirectoryFiles.sort();
  repository.reusableRepository.reviewRegistry.data = structuredClone(registry);
  return trial;
}

function syncRegisteredTrials(repository, entries, expectedStatus) {
  repository.completedTrials = entries;
  repository.reviewRepository.completedClassroomTrials = entries;
  const registry = repository.reviewRepository.registry.data;
  registry.classroom_trial.completed_record_paths = entries.map(({ file }) => file);
  registry.classroom_trial.status = expectedStatus;
  registry.boundaries.classroom_trial_complete = expectedStatus !== 'not_tested';
  registry.boundaries.classroom_ready = ['successful', 'successful_with_notes'].includes(expectedStatus);
  for (const { file } of entries) {
    if (!repository.reviewRepository.reviewDirectoryFiles.includes(file)) repository.reviewRepository.reviewDirectoryFiles.push(file);
  }
  repository.reviewRepository.reviewDirectoryFiles.sort();
  repository.reusableRepository.reviewRegistry.data = structuredClone(registry);
}

function appendSuccessorTrial(repository, predecessor, {
  trialId = 'synthetic-classroom-trial-successor',
  decisionStatus = 'successful',
  supersedes = [predecessor.data.trial_identity.trial_id],
} = {}) {
  const data = structuredClone(predecessor.data);
  data.trial_identity.trial_id = trialId;
  data.trial_identity.analysis_date = '2026-08-12';
  data.lifecycle = { status: 'analysed', supersedes: [...supersedes] };
  data.findings = [];
  for (const part of data.part_observations) {
    for (const dimension of part.dimensions) {
      dimension.status = 'met';
      dimension.finding_ids = [];
    }
  }
  data.decision = {
    status: decisionStatus,
    rationale: decisionStatus === 'repeat_trial_required'
      ? 'Synthetic successor requires another trial.'
      : 'Synthetic successor analysed decision.',
    open_blocking_findings: [],
    open_major_findings: [],
    required_changes_complete: decisionStatus !== 'repeat_trial_required',
    reviewed_fingerprint_matches: true,
    safe_to_repeat: decisionStatus !== 'repeat_trial_required',
  };
  if (decisionStatus === 'repeat_trial_required') data.part_observations[0].dimensions[0].status = 'not_met';
  const entry = { file: `${REVIEW_ROOT}/${trialId}.yaml`, text: '', data };
  const entries = [...repository.completedTrials, entry];
  syncRegisteredTrials(repository, entries, decisionStatus);
  return entry;
}

test.before(async () => {
  baseline = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd() });
});

test('production classroom-trial workflow is exact and contains no trial evidence', () => {
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(baseline);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.summary, {
    trial_templates: 1,
    registered_analysed_trial_records: 0,
    classroom_trial_status: 'not_tested',
    prerequisites_satisfied: false,
    teacher_review: 'pending',
    local_safety_review: 'pending',
    fingerprint_current: true,
    fingerprint: FINGERPRINT,
  });
  assert.equal(baseline.completedTrials.length, 0);
});

test('template pins exact identity, route, fingerprint, parts and planned duration', () => {
  const data = baseline.trialTemplate.data;
  assert.equal(baseline.trialTemplate.file, CLASSROOM_TRIAL_TEMPLATE_PATH);
  assert.equal(data.artifact_identity.artifact_id, 'grade-6-science-soil-organisms');
  assert.equal(data.artifact_identity.route, 'grade-6-science');
  assert.equal(data.artifact_identity.content_fingerprint, FINGERPRINT);
  assert.deepEqual(data.part_observations.map(({ part_id, source_gap_id, planned_duration_minutes }) => ({ part_id, source_gap_id, planned_duration_minutes })), [
    { part_id: 'part-1', source_gap_id: 'grade-6-science-lesson-008', planned_duration_minutes: 45 },
    { part_id: 'part-2', source_gap_id: 'grade-6-science-lesson-009', planned_duration_minutes: 45 },
  ]);
  assert.deepEqual(data.classroom_context.planned_duration_minutes, { 'part-1': 45, 'part-2': 45 });
  assert.deepEqual(data.part_observations[0].dimensions.map(({ dimension_id }) => dimension_id), PART1_DIMENSIONS);
  assert.deepEqual(data.part_observations[1].dimensions.map(({ dimension_id }) => dimension_id), PART2_DIMENSIONS);
});

test('template has no identity, learner data, observations, prerequisites or decision evidence', () => {
  const data = baseline.trialTemplate.data;
  assert.deepEqual(Object.values(data.trial_identity), [null, null, null, null, null]);
  assert.equal(data.lifecycle.status, 'draft');
  assert.equal(data.part_observations.flatMap(({ dimensions }) => dimensions).every(({ status }) => status === 'not_observed'), true);
  assert.equal(data.decision.status, 'pending');
  assert.equal(data.prerequisites.teacher_review_status, 'pending');
  assert.equal(data.prerequisites.local_safety_review_status, 'pending');
  assert.equal(data.prerequisites.prerequisites_satisfied, false);
  assert.deepEqual(data.findings, []);
});

test('registry, readiness and immutable materials remain pending and exact', () => {
  const registry = baseline.reviewRepository.registry.data;
  const artifact = baseline.reusableRepository.artifacts[0].data;
  assert.equal(registry.classroom_trial.template_path, CLASSROOM_TRIAL_TEMPLATE_PATH);
  assert.deepEqual(registry.classroom_trial.completed_record_paths, []);
  assert.equal(registry.classroom_trial.status, 'not_tested');
  assert.equal(registry.boundaries.classroom_trial_complete, false);
  assert.equal(registry.boundaries.classroom_ready, false);
  assert.equal(registry.boundaries.publication_ready, false);
  assert.equal(registry.boundaries.effectiveness_claimed, false);
  assert.deepEqual(artifact.materials.map(({ sha256 }) => sha256), MATERIAL_HASHES);
  assert.equal(artifact.content_fingerprint.value, FINGERPRINT);
});

test('classroom-trial guide is exact and final-newline Markdown', async () => {
  const bytes = await fs.readFile(GUIDE_PATH);
  assert.equal(bytes.toString('utf8').endsWith('\n'), true);
  assert.equal(bytes.toString('utf8').includes('This pull request does not conduct a trial.'), true);
});

for (const decisionStatus of ['successful', 'successful_with_notes', 'repeat_trial_required']) {
  test(`future synthetic in-memory analysed ${decisionStatus} record satisfies the contract`, () => {
    const repository = cloneRepository();
    prepareValidTrial(repository, decisionStatus);
    const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(repository, { allowCompletedRecords: true });
    assert.deepEqual(result.diagnostics, [], reasons(result));
  });
}

test('registry path order does not change the active trial or readiness result', () => {
  const forward = cloneRepository();
  const first = prepareValidTrial(forward);
  const second = appendSuccessorTrial(forward, first);
  const forwardResult = validateTeacherWorkPlanArtifactClassroomTrialRepository(forward, { allowCompletedRecords: true });
  assert.deepEqual(forwardResult.diagnostics, [], reasons(forwardResult));

  const reversed = cloneRepository();
  const reversedFirst = prepareValidTrial(reversed);
  const reversedSecond = appendSuccessorTrial(reversed, reversedFirst);
  syncRegisteredTrials(reversed, [reversedSecond, reversedFirst], 'successful');
  const reversedResult = validateTeacherWorkPlanArtifactClassroomTrialRepository(reversed, { allowCompletedRecords: true });
  assert.deepEqual(reversedResult.diagnostics, [], reasons(reversedResult));
  assert.deepEqual(reversedResult.summary, forwardResult.summary);
  assert.equal(second.data.lifecycle.supersedes[0], first.data.trial_identity.trial_id);
});

test('valid A <- B supersession selects B regardless of registry order', () => {
  const repository = cloneRepository();
  const historical = prepareValidTrial(repository);
  const active = appendSuccessorTrial(repository, historical, { decisionStatus: 'repeat_trial_required' });
  syncRegisteredTrials(repository, [active, historical], 'repeat_trial_required');
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(repository, { allowCompletedRecords: true });
  assert.deepEqual(result.diagnostics, [], reasons(result));
  assert.equal(result.summary.classroom_trial_status, 'repeat_trial_required');
  assert.equal(repository.reviewRepository.registry.data.boundaries.classroom_ready, false);
  assert.equal(historical.data.lifecycle.status, 'analysed');
});

test('rejects two unrelated active analysed trials and keeps readiness false', () => {
  const repository = cloneRepository();
  const first = prepareValidTrial(repository);
  const second = appendSuccessorTrial(repository, first, { supersedes: [] });
  syncRegisteredTrials(repository, [first, second], 'not_tested');
  expectInvalid(repository, /multiple unrelated active analysed terminals/u, { allowCompletedRecords: true });
  assert.equal(repository.reviewRepository.registry.data.boundaries.classroom_ready, false);
});

test('rejects a classroom-trial supersession cycle', () => {
  const repository = cloneRepository();
  const first = prepareValidTrial(repository);
  const second = appendSuccessorTrial(repository, first);
  first.data.lifecycle.supersedes = [second.data.trial_identity.trial_id];
  syncRegisteredTrials(repository, [first, second], 'not_tested');
  expectInvalid(repository, /supersession graph contains a cycle/u, { allowCompletedRecords: true });
});

test('rejects multiple successors for one historical record', () => {
  const repository = cloneRepository();
  const historical = prepareValidTrial(repository);
  const second = appendSuccessorTrial(repository, historical, { trialId: 'synthetic-successor-b' });
  const third = structuredClone(second);
  third.file = `${REVIEW_ROOT}/synthetic-successor-c.yaml`;
  third.data.trial_identity.trial_id = 'synthetic-successor-c';
  syncRegisteredTrials(repository, [historical, second, third], 'not_tested');
  expectInvalid(repository, /multiple successors/u, { allowCompletedRecords: true });
});

test('rejects duplicate classroom-trial IDs', () => {
  const repository = cloneRepository();
  const first = prepareValidTrial(repository);
  const second = appendSuccessorTrial(repository, first);
  second.data.trial_identity.trial_id = first.data.trial_identity.trial_id;
  syncRegisteredTrials(repository, [first, second], 'not_tested');
  expectInvalid(repository, /duplicate classroom-trial ID/u, { allowCompletedRecords: true });
});

test('rejects a classroom trial that supersedes itself', () => {
  const repository = cloneRepository();
  const trial = prepareValidTrial(repository);
  trial.data.lifecycle.supersedes = [trial.data.trial_identity.trial_id];
  syncRegisteredTrials(repository, [trial], 'not_tested');
  expectInvalid(repository, /cannot supersede itself/u, { allowCompletedRecords: true });
});

test('rejects an unknown classroom-trial supersession target', () => {
  const repository = cloneRepository();
  const trial = prepareValidTrial(repository);
  trial.data.lifecycle.supersedes = ['unknown-trial'];
  syncRegisteredTrials(repository, [trial], 'not_tested');
  expectInvalid(repository, /unknown superseded trial/u, { allowCompletedRecords: true });
});

test('historical positive trial cannot support readiness after an active negative successor', () => {
  const repository = cloneRepository();
  const historicalPositive = prepareValidTrial(repository);
  const activeNegative = appendSuccessorTrial(repository, historicalPositive, { decisionStatus: 'repeat_trial_required' });
  const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(repository, { allowCompletedRecords: true });
  assert.deepEqual(result.diagnostics, [], reasons(result));
  assert.equal(historicalPositive.data.decision.status, 'successful');
  assert.equal(activeNegative.data.decision.status, 'repeat_trial_required');
  assert.equal(result.summary.classroom_trial_status, 'repeat_trial_required');
  assert.equal(repository.reviewRepository.registry.data.boundaries.classroom_ready, false);
});

const templateMutations = [
  ['wrong artifact ID', (repo) => { repo.trialTemplate.data.artifact_identity.artifact_id = 'wrong-artifact'; }, /artifact_id|identity|constant/u],
  ['wrong route', (repo) => { repo.trialTemplate.data.artifact_identity.route = 'grade-7-science'; }, /route|identity|constant/u],
  ['wrong fingerprint', (repo) => { repo.trialTemplate.data.artifact_identity.content_fingerprint = '0'.repeat(64); }, /fingerprint|identity|constant/u],
  ['wrong source gap', (repo) => { repo.trialTemplate.data.part_observations[0].source_gap_id = 'grade-6-science-lesson-009'; }, /source gap|part_observations|constant/u],
  ['wrong part duration', (repo) => { repo.trialTemplate.data.part_observations[0].planned_duration_minutes = 40; }, /45-minute|constant/u],
  ['missing dimension', (repo) => { repo.trialTemplate.data.part_observations[0].dimensions.pop(); }, /ordered dimensions|items/u],
  ['reordered dimension', (repo) => { repo.trialTemplate.data.part_observations[0].dimensions.reverse(); }, /ordered dimensions|constant/u],
  ['invented facilitator in template', (repo) => { repo.trialTemplate.data.trial_identity.facilitator_reference = 'invented-facilitator'; }, /invent|must be null/u],
  ['observation filled in template', (repo) => { repo.trialTemplate.data.part_observations[0].dimensions[0].status = 'met'; }, /template observations|not_observed/u],
  ['template approved', (repo) => { repo.trialTemplate.data.decision.status = 'successful'; }, /template decision|pending/u],
  ['unknown field', (repo) => { repo.trialTemplate.data.unexpected = true; }, /unknown field/u],
];

for (const [name, mutate, pattern] of templateMutations) {
  test(`rejects ${name}`, () => {
    const repository = cloneRepository();
    mutate(repository);
    expectInvalid(repository, pattern);
  });
}

test('rejects missing template', () => {
  const repository = cloneRepository();
  repository.trialTemplate = null;
  expectInvalid(repository, /template is missing/u);
});

test('rejects missing guide', () => {
  const repository = cloneRepository();
  repository.guideText = null;
  expectInvalid(repository, /guide is missing/u);
});

test('rejects extra trial packet file', () => {
  const repository = cloneRepository();
  repository.reviewRepository.reviewDirectoryFiles.push(`${REVIEW_ROOT}/extra-trial.yaml`);
  expectInvalid(repository, /missing or extra file/u);
});

const completedMutations = [
  ['registered draft record', (repo, trial) => { trial.data.lifecycle.status = 'draft'; trial.data.decision.status = 'pending'; }, /draft or conducted|status/u],
  ['registered conducted record', (repo, trial) => { trial.data.lifecycle.status = 'conducted'; trial.data.decision.status = 'pending'; }, /draft or conducted|status/u],
  ['trial without teacher approval', (repo, trial) => { trial.data.prerequisites.teacher_review_status = 'pending'; }, /teacher review|prerequisite/u],
  ['trial without safety approval', (repo, trial) => { trial.data.prerequisites.local_safety_review_status = 'pending'; }, /local safety|safety-review|prerequisite/u],
  ['stale prerequisite fingerprint', (repo) => { repo.reviewRepository.completedTeacherReviews[0].data.artifact_identity.content_fingerprint = '0'.repeat(64); }, /fingerprint/u],
  ['local safety context mismatch', (repo, trial) => { trial.data.classroom_context.named_context_reference = 'different-context'; }, /named trial context/u],
  ['trial date differs from safety approval', (repo, trial) => { trial.data.trial_identity.trial_date = '2026-08-11'; }, /trial date.*approved local-safety activity date/u],
  ['trial group is larger than safety approval', (repo, trial) => { trial.data.classroom_context.group_size = 13; }, /group size cannot exceed/u],
  ['trial has fewer adults than safety approval', (repo, trial) => { trial.data.classroom_context.adult_supervision_count = 1; }, /adult supervision cannot be lower/u],
  ['trial uses a different site', (repo, trial) => { trial.data.classroom_context.site_description = 'Different synthetic site'; }, /trial site must equal/u],
  ['trial accessibility setup is weaker or incompatible', (repo, trial) => { trial.data.classroom_context.accessibility_adjustments = 'No level fallback available'; }, /accessibility adjustments must exactly preserve/u],
  ['trial uses indoor fallback when safety did not permit it', (repo, trial) => {
    const safety = repo.reviewRepository.completedSafetyReviews[0].data;
    safety.local_context.indoor_fallback_permitted = false;
    trial.data.classroom_context.safety_context_snapshot = safetySnapshot(safety);
    trial.data.classroom_context.weather_or_indoor_fallback_used = true;
    trial.data.aggregate_observations.indoor_fallback_used = true;
  }, /fallback.*not permitted/u],
  ['approved weather limitation is not explicitly confirmed', (repo, trial) => {
    trial.data.classroom_context.safety_condition_confirmations[0].confirmed = false;
  }, /condition must be explicitly confirmed/u],
  ['conditional safety approval condition is not confirmed', (repo, trial) => {
    const safety = repo.reviewRepository.completedSafetyReviews[0].data;
    safety.decision.status = 'approved_with_conditions';
    safety.decision.conditions = ['Keep the named access gate closed.'];
    repo.reviewRepository.registry.data.local_safety_review.status = 'approved_with_conditions';
    trial.data.prerequisites.local_safety_review_status = 'approved_with_conditions';
    trial.data.classroom_context.safety_context_snapshot = safetySnapshot(safety);
    trial.data.classroom_context.safety_condition_confirmations = [
      {
        condition: 'Use indoor fallback in unsafe conditions',
        confirmed: true,
        notes: 'Synthetic aggregate confirmation of the approved weather limitation.',
      },
      {
        condition: 'Keep the named access gate closed.',
        confirmed: false,
        notes: null,
      },
    ];
  }, /condition must be explicitly confirmed/u],
  ['local-safety snapshot drift', (repo, trial) => { trial.data.classroom_context.safety_context_snapshot.approved_group_size = 30; }, /immutable exact snapshot/u],
  ['incomplete privacy attestation', (repo, trial) => { trial.data.privacy.manual_privacy_review_complete = false; }, /privacy/u],
  ['learner email in text', (repo, trial) => { trial.data.aggregate_observations.general_notes = 'Learner email: pupil@example.test'; }, /learner-identifiable|email/u],
  ['recording reference', (repo, trial) => { trial.data.aggregate_observations.general_notes = 'A video recording was retained.'; }, /private data|recording/u],
  ['missing actual duration', (repo, trial) => { trial.data.part_observations[0].actual_duration_minutes = null; }, /actual duration/u],
  ['not_observed in analysed positive record', (repo, trial) => { trial.data.part_observations[0].dimensions[0].status = 'not_observed'; }, /not_observed/u],
  ['not_met in successful record', (repo, trial) => { trial.data.part_observations[0].dimensions[0].status = 'not_met'; }, /not_met/u],
  ['partly_met without minor plan', (repo, trial) => { trial.data.decision.status = 'successful_with_notes'; trial.data.part_observations[0].dimensions[0].status = 'partly_met'; }, /partly_met/u],
  ['open major finding with success', (repo, trial) => {
    trial.data.findings = [{ finding_id: 'major-problem', severity: 'major', area: 'timing', description: 'Major aggregate issue.', required_change: null, affected_paths: [`${PILOT_ROOT}/teacher-guide.md`], status: 'open', resolution_notes: null }];
    trial.data.decision.open_major_findings = ['major-problem'];
  }, /open major/u],
  ['open blocking safety finding with success', (repo, trial) => {
    trial.data.findings = [{ finding_id: 'blocking-safety', severity: 'blocking', area: 'practical_safety', description: 'Blocking aggregate safety issue.', required_change: null, affected_paths: [`${PILOT_ROOT}/practical-protocol.md`], status: 'open', resolution_notes: null }];
    trial.data.decision.open_blocking_findings = ['blocking-safety'];
  }, /blocking/u],
  ['unresolved required change', (repo, trial) => {
    trial.data.findings = [{ finding_id: 'open-change', severity: 'minor', area: 'timing', description: 'Minor aggregate issue.', required_change: 'Clarify timing.', affected_paths: [`${PILOT_ROOT}/teacher-guide.md`], status: 'open', resolution_notes: null }];
  }, /required changes/u],
  ['safe_to_repeat false with success', (repo, trial) => { trial.data.decision.safe_to_repeat = false; }, /safe_to_repeat/u],
  ['invalid affected path', (repo, trial) => {
    trial.data.findings = [{ finding_id: 'outside-change', severity: 'minor', area: 'timing', description: 'Minor aggregate issue.', required_change: null, affected_paths: ['lesson-plans/outside.md'], status: 'resolved', resolution_notes: 'Synthetic resolution.' }];
  }, /pilot root/u],
  ['effectiveness claimed', (repo, trial) => { trial.data.boundaries.effectiveness_claimed = true; }, /effectiveness|constant/u],
  ['source gap marked resolved', (repo, trial) => { trial.data.boundaries.source_gap_resolution_claimed = true; }, /gap resolution|constant/u],
];

for (const [name, mutate, pattern] of completedMutations) {
  test(`rejects ${name}`, () => {
    const repository = cloneRepository();
    const trial = prepareValidTrial(repository);
    mutate(repository, trial);
    expectInvalid(repository, pattern, { allowCompletedRecords: true });
  });
}

test('rejects safe_to_repeat true with repeat_trial_required', () => {
  const repository = cloneRepository();
  const trial = prepareValidTrial(repository, 'repeat_trial_required');
  trial.data.decision.safe_to_repeat = true;
  expectInvalid(repository, /safe_to_repeat/u, { allowCompletedRecords: true });
});

test('rejects classroom readiness promoted without valid evidence', () => {
  const repository = cloneRepository();
  repository.reviewRepository.registry.data.boundaries.classroom_ready = true;
  repository.reusableRepository.reviewRegistry.data.boundaries.classroom_ready = true;
  expectInvalid(repository, /classroom readiness/u);
});

for (const [name, text, pattern] of [
  ['YAML duplicate key', 'schema_version: "1.0"\nschema_version: "1.0"\n', /duplicate|Map keys/u],
  ['YAML alias', 'base: &base { value: 1 }\ncopy: *base\n', /aliases|anchors/u],
  ['YAML anchor', 'base: &base { value: 1 }\n', /anchors/u],
  ['YAML tab', 'schema_version:\t"1.0"\n', /tabs/u],
]) {
  test(`strict parser rejects ${name}`, async () => {
    const repository = await loadTeacherWorkPlanArtifactClassroomTrialRepository({
      rootDir: process.cwd(),
      fileOverrides: new Map([[CLASSROOM_TRIAL_TEMPLATE_PATH, text]]),
    });
    expectInvalid(repository, pattern);
  });
}

test('validation diagnostics are deterministic', () => {
  const first = validateTeacherWorkPlanArtifactClassroomTrialRepository(baseline);
  const second = validateTeacherWorkPlanArtifactClassroomTrialRepository(baseline);
  assert.deepEqual(second, first);
});
