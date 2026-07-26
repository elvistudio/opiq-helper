import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument, stringify } from 'yaml';
import {
  buildPedagogicalEvidenceIdentity,
  createPedagogicalEvidenceValidators,
  serializeCanonicalEvidenceYaml,
} from './pedagogical-evidence.mjs';
import {
  normalizePedagogicalEvidenceIntake,
  registerPedagogicalEvidence,
} from './pedagogical-evidence-workflow.mjs';
import {
  buildPedagogicalReadinessReport,
} from './pedagogical-readiness.mjs';
import {
  derivePedagogicalEvidenceLinkState,
  loadPedagogicalReviewRepository,
} from './pedagogical-reviews.mjs';
import {
  safeRepositoryPath,
} from './curriculum-maps.mjs';

const PACK_PATH = 'teacher-packs/grade-5-science/water/materials-index.yaml';
const REVIEW_PATH =
  'pedagogical-reviews/grade-5-science/water/records/grade-5-water-regression-review-2026-08-01.yaml';
const SECOND_REVIEW_PATH =
  'pedagogical-reviews/grade-5-science/water/records/grade-5-water-regression-successor-review-2026-08-02.yaml';
const CLASSROOM_PATH =
  'pedagogical-reviews/grade-5-science/water/records/grade-5-water-regression-classroom-trial-2026-08-01.yaml';
const SECOND_CLASSROOM_PATH =
  'pedagogical-reviews/grade-5-science/water/records/grade-5-water-regression-successor-classroom-trial-2026-08-02.yaml';
const HOME_PATH =
  'pedagogical-reviews/grade-5-science/water/records/grade-5-water-regression-home-trial-2026-08-01.yaml';
const NORMALIZED_PATH =
  'pedagogical-reviews/grade-5-science/water/regression-normalized.yaml';
const INTAKE_PATH =
  'pedagogical-reviews/grade-5-science/water/regression-intake.json';
const READINESS_REPORT_PATH =
  'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json';
const MUTABLE_SCENARIO_PATHS = Object.freeze([
  PACK_PATH,
  READINESS_REPORT_PATH,
  REVIEW_PATH,
  SECOND_REVIEW_PATH,
  CLASSROOM_PATH,
  SECOND_CLASSROOM_PATH,
  HOME_PATH,
  NORMALIZED_PATH,
  INTAKE_PATH,
  'teacher-packs/grade-5-science/water/teacher-guide.md',
  'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
  'teacher-packs/grade-5-science/water/homeschool/lesson-01-parent-guidance.md',
]);

const RATING_FIELDS = Object.freeze([
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
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
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

export function createRegressionTeacherReview(
  identity,
  lessonIds,
  scopes = ['classroom', 'homeschool'],
) {
  return {
    schema_version: '2.0',
    artifact_type: 'teacher_review',
    review_id: 'grade-5-water-regression-review-2026-08-01',
    pack_ref: 'grade-5-science-water-teacher-pack',
    evidence_identity: structuredClone(identity),
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
      reviewer_reference: 'temporary-regression-role',
    },
    reviewed_at: '2026-08-01',
    delivery_scopes: [...scopes].sort(compareBytewise),
    review_scope: {
      teacher_guide: true,
      lesson_guides: [...lessonIds],
      student_materials: true,
      answer_keys: true,
      assessment_rubric: true,
      homeschool_materials: scopes.includes('homeschool'),
      safety: true,
      language_level: true,
      lesson_dna: true,
      selection_and_adaptation_artifacts: true,
    },
    ratings: Object.fromEntries(RATING_FIELDS.map((field) => {
      if (!scopes.includes('classroom') && field === 'classroom_feasibility') {
        return [field, 'not_applicable'];
      }
      if (
        !scopes.includes('homeschool')
        && ['homeschool_clarity', 'parent_role_realism'].includes(field)
      ) {
        return [field, 'not_applicable'];
      }
      return [field, 4];
    })),
    rating_applicability: [
      ...(!scopes.includes('classroom') ? [{
        dimension: 'classroom_feasibility',
        rationale: 'Classroom delivery is outside this synthetic review scope.',
      }] : []),
      ...(!scopes.includes('homeschool') ? [
        {
          dimension: 'homeschool_clarity',
          rationale: 'Homeschool delivery is outside this synthetic review scope.',
        },
        {
          dimension: 'parent_role_realism',
          rationale: 'Homeschool delivery is outside this synthetic review scope.',
        },
      ] : []),
    ],
    privacy: privacy(),
    findings: [],
    blocking_findings: [],
    required_changes: [],
    optional_improvements: [],
    decision: {
      status: 'approved',
      rationale: 'Synthetic temporary regression fixture; not production evidence.',
    },
  };
}

const WATER_CLASSROOM_ENTRY_PHASES = Object.freeze({
  'grade-5-water-01-properties': 'activation',
  'grade-5-water-02-states': 'activation',
  'grade-5-water-03-melting-condensation': 'safety-orientation',
  'grade-5-water-04-changes-review': 'retrieval',
});

const WATER_PRACTICAL_LESSON_IDS = Object.freeze([
  'grade-5-water-03-melting-condensation',
]);

function normalizeRegressionLessonIds(lessonIdOrIds) {
  return Array.isArray(lessonIdOrIds) ? [...lessonIdOrIds] : [lessonIdOrIds];
}

function regressionObservations(lessonIds) {
  return lessonIds.map((lessonId) => ({
    lesson_id: lessonId,
    phase_ids: [],
    rating: 'met',
    summary: 'Synthetic aggregate regression observation.',
    aggregate_count: 1,
    aggregate_denominator: 1,
  }));
}

export function createRegressionClassroomTrial(identity, lessonIdOrIds) {
  const lessonIds = normalizeRegressionLessonIds(lessonIdOrIds);
  const observation = (ids = lessonIds) => regressionObservations(ids);
  return {
    schema_version: '2.0',
    artifact_type: 'classroom_trial',
    trial_id: 'grade-5-water-regression-classroom-trial-2026-08-01',
    pack_ref: 'grade-5-science-water-teacher-pack',
    evidence_identity: structuredClone(identity),
    lifecycle: { supersedes: [] },
    trial_status: 'analysed',
    context: {
      lesson_ids: lessonIds,
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
    timing_observations: lessonIds.map((lessonId) => ({
      lesson_id: lessonId,
      phase_id: WATER_CLASSROOM_ENTRY_PHASES[lessonId] ?? 'activation',
      planned_minutes: 5,
      actual_minutes: 5,
      setup_feasible: true,
      transition_feasible: true,
      summary: 'Synthetic aggregate regression timing observation.',
    })),
    instruction_comprehension: observation(),
    retrieval_and_correction: observation(),
    recall_and_transfer: observation(),
    participation_and_completion: observation(),
    language_support: observation(),
    differentiation_adjustments: [],
    lesson_dna_deviations: [],
    lesson_dna_deviation_status: 'none_observed',
    material_usability: observation(),
    safety_observations: observation(
      lessonIds.filter((lessonId) => WATER_PRACTICAL_LESSON_IDS.includes(lessonId)),
    ),
    method_execution_observations: observation(),
    unexpected_support: [],
    findings: [],
    decision: {
      status: 'successful',
      safe_to_repeat: true,
      rationale: 'Synthetic temporary regression fixture; not production evidence.',
    },
  };
}

export function createRegressionHomeTrial(identity, lessonIdOrIds) {
  const lessonIds = normalizeRegressionLessonIds(lessonIdOrIds);
  const observation = (ids = lessonIds) => regressionObservations(ids);
  return {
    schema_version: '1.0',
    artifact_type: 'home_trial',
    trial_id: 'grade-5-water-regression-home-trial-2026-08-01',
    pack_ref: 'grade-5-science-water-teacher-pack',
    evidence_identity: structuredClone(identity),
    lifecycle: { supersedes: [] },
    trial_status: 'analysed',
    context: {
      lesson_ids: lessonIds,
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
    session_observations: lessonIds.map((lessonId) => ({
      lesson_id: lessonId,
      planned_minutes: 30,
      actual_minutes: 30,
      unplanned_adult_support: 'none',
      parent_role_bounded: true,
      summary: 'Synthetic aggregate regression session observation.',
    })),
    instruction_comprehension: observation(),
    adult_role: observation(),
    learner_independence: observation(),
    material_availability: observation(),
    offline_and_printer_assumptions: observation(),
    retrieval_and_correction: observation(),
    language_scaffolds: observation(),
    practical_safety: observation(
      lessonIds.filter((lessonId) => WATER_PRACTICAL_LESSON_IDS.includes(lessonId)),
    ),
    task_completion: observation(),
    recall_and_transfer: observation(),
    findings: [],
    decision: {
      status: 'successful',
      safe_to_repeat: true,
      parent_role_remained_bounded: true,
      rationale: 'Synthetic temporary regression fixture; not production evidence.',
    },
  };
}

function finding(severity, category, deliveryModes) {
  return {
    finding_id: `regression-${severity}-${category}`,
    severity,
    category,
    delivery_modes: [...deliveryModes].sort(compareBytewise),
    artifact_paths: ['teacher-packs/grade-5-science/water/teacher-guide.md'],
    lesson_ids: ['grade-5-water-01-properties'],
    phase_ids: [],
    target_ids: [],
    description: 'Synthetic unresolved regression finding.',
    evidence: 'Temporary categorical fixture evidence.',
    recommended_action: 'Resolve before readiness is granted.',
    resolution_status: 'open',
    resolution_refs: [],
  };
}

async function readYaml(rootDir, repositoryPath) {
  const document = parseDocument(
    await fs.readFile(safeRepositoryPath(rootDir, repositoryPath, repositoryPath), 'utf8'),
    { strict: true, uniqueKeys: true, schema: 'core' },
  );
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'));
  }
  return document.toJS({ maxAliasCount: 1000 });
}

async function writeYaml(rootDir, repositoryPath, value) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, stringify(value, {
    lineWidth: 100,
    sortMapEntries: false,
  }));
}

async function writeRecord(rootDir, repositoryPath, record) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, serializeCanonicalEvidenceYaml(record));
}

async function linkEvidence(rootDir, {
  reviews = [],
  classroomTrials = [],
  homeTrials = [],
  identityCommitSha,
}) {
  const index = await readYaml(rootDir, PACK_PATH);
  index.pedagogical_review.review_record_paths = reviews;
  index.pedagogical_review.status = 'pending';
  index.pedagogical_review.classroom_status = 'pending';
  index.pedagogical_review.homeschool_status = 'pending';
  index.classroom_trial.trial_record_paths = classroomTrials;
  index.classroom_trial.status = 'not_tested';
  index.home_trial.trial_record_paths = homeTrials;
  index.home_trial.status = 'not_started';
  await writeYaml(rootDir, PACK_PATH, index);
  const repository = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const loadedIndex = repository.teacherPacks.indexes.find(
    (artifact) => artifact.file === PACK_PATH,
  );
  const statuses = derivePedagogicalEvidenceLinkState(repository, loadedIndex);
  const finalIndex = await readYaml(rootDir, PACK_PATH);
  finalIndex.pedagogical_review.status = statuses.pedagogical_review.status;
  finalIndex.pedagogical_review.classroom_status =
    statuses.pedagogical_review.classroom_status;
  finalIndex.pedagogical_review.homeschool_status =
    statuses.pedagogical_review.homeschool_status;
  finalIndex.classroom_trial.status = statuses.classroom_trial.status;
  finalIndex.home_trial.status = statuses.home_trial.status;
  await writeYaml(rootDir, PACK_PATH, finalIndex);
}

function staleFingerprint(identity) {
  const copy = structuredClone(identity);
  copy.content_fingerprint.value =
    copy.content_fingerprint.value === 'a'.repeat(64)
      ? 'b'.repeat(64)
      : 'a'.repeat(64);
  return copy;
}

async function currentState(rootDir, baselineCommitSha) {
  const built = await buildPedagogicalEvidenceIdentity({
    rootDir,
    packPath: PACK_PATH,
    commitSha: baselineCommitSha,
  });
  return {
    identity: built.identity,
    fingerprint: built.identity.content_fingerprint,
    lessonIds: built.index.data.lesson_ids,
  };
}

async function installEvidence(rootDir, {
  reviewScopes = null,
  classroom = false,
  home = false,
  staleReview = false,
  staleClassroom = false,
  staleHome = false,
  reviewMutate = null,
  classroomMutate = null,
  homeMutate = null,
  extraReview = null,
  extraClassroom = null,
} = {}, state) {
  const reviewPaths = [];
  const classroomPaths = [];
  const homePaths = [];
  if (reviewScopes) {
    const record = createRegressionTeacherReview(
      staleReview ? staleFingerprint(state.identity) : state.identity,
      state.lessonIds,
      reviewScopes,
    );
    reviewMutate?.(record);
    await writeRecord(rootDir, REVIEW_PATH, record);
    reviewPaths.push(REVIEW_PATH);
  }
  if (extraReview) {
    const record = createRegressionTeacherReview(
      state.identity,
      state.lessonIds,
      ['classroom'],
    );
    extraReview(record);
    await writeRecord(rootDir, SECOND_REVIEW_PATH, record);
    reviewPaths.push(SECOND_REVIEW_PATH);
  }
  if (classroom) {
    const record = createRegressionClassroomTrial(
      staleClassroom ? staleFingerprint(state.identity) : state.identity,
      state.lessonIds,
    );
    classroomMutate?.(record);
    await writeRecord(rootDir, CLASSROOM_PATH, record);
    classroomPaths.push(CLASSROOM_PATH);
  }
  if (extraClassroom) {
    const record = createRegressionClassroomTrial(
      state.identity,
      state.lessonIds,
    );
    extraClassroom(record);
    await writeRecord(rootDir, SECOND_CLASSROOM_PATH, record);
    classroomPaths.push(SECOND_CLASSROOM_PATH);
  }
  if (home) {
    const record = createRegressionHomeTrial(
      staleHome ? staleFingerprint(state.identity) : state.identity,
      state.lessonIds,
    );
    homeMutate?.(record);
    await writeRecord(rootDir, HOME_PATH, record);
    homePaths.push(HOME_PATH);
  }
  await linkEvidence(rootDir, {
    reviews: reviewPaths,
    classroomTrials: classroomPaths,
    homeTrials: homePaths,
    identityCommitSha: state.identity.commit_sha,
  });
  return state;
}

async function writeCompletedReviewIntake(rootDir, baselineRootDir, record) {
  const intake = {
    schema_version: '1.0',
    artifact_type: 'pedagogical_evidence_intake',
    kind: 'teacher-review',
    pack_path: PACK_PATH,
    prepared_for_date: '2026-08-01',
    privacy_notice: 'Synthetic regression intake contains no learner identity.',
    non_guarantees: ['Synthetic regression evidence is not production evidence.'],
    record,
  };
  const absolute = safeRepositoryPath(rootDir, INTAKE_PATH, INTAKE_PATH);
  await fs.writeFile(absolute, `${JSON.stringify(intake, null, 2)}\n`);
  return normalizePedagogicalEvidenceIntake({
    rootDir,
    baselineRootDir,
    intakePath: INTAKE_PATH,
    outputPath: NORMALIZED_PATH,
  });
}

async function mutateReviewableText(rootDir, repositoryPath, suffix) {
  const absolute = safeRepositoryPath(rootDir, repositoryPath, repositoryPath);
  const before = await fs.readFile(absolute);
  await fs.writeFile(absolute, Buffer.concat([before, Buffer.from(suffix)]));
  return before;
}

async function setupScenario(
  rootDir,
  baselineRootDir,
  scenarioId,
  baselineState,
) {
  let registrationRejected = false;
  let normalizedDeterministic = true;
  let fingerprintStableOverride = null;
  const base = structuredClone(baselineState);
  const classReview = { reviewScopes: ['classroom'] };
  const homeReview = { reviewScopes: ['homeschool'] };
  switch (scenarioId) {
    case 'no_evidence':
    case 'committed_production_pending':
      break;
    case 'classroom_review_only':
      await installEvidence(rootDir, classReview, base);
      break;
    case 'classroom_trial_only':
      await installEvidence(rootDir, { classroom: true }, base);
      break;
    case 'classroom_review_and_trial':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
      }, base);
      break;
    case 'home_review_only':
      await installEvidence(rootDir, homeReview, base);
      break;
    case 'home_trial_only':
      await installEvidence(rootDir, { home: true }, base);
      break;
    case 'home_review_and_trial':
      await installEvidence(rootDir, { ...homeReview, home: true }, base);
      break;
    case 'classroom_trial_cannot_home':
      await installEvidence(rootDir, { ...homeReview, classroom: true }, base);
      break;
    case 'home_trial_cannot_classroom':
      await installEvidence(rootDir, { ...classReview, home: true }, base);
      break;
    case 'stale_content_fingerprint_review':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
        staleReview: true,
      }, base);
      break;
    case 'stale_classroom_trial_fingerprint':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
        staleClassroom: true,
      }, base);
      break;
    case 'stale_home_trial_fingerprint':
      await installEvidence(rootDir, {
        ...homeReview,
        home: true,
        staleHome: true,
      }, base);
      break;
    case 'stale_catalogue_identity':
      await installEvidence(rootDir, {
        reviewScopes: ['classroom', 'homeschool'],
        reviewMutate(record) {
          record.evidence_identity.pedagogical_snapshot.taxonomy_version = '9.9';
          record.evidence_identity.pedagogical_snapshot.activity_catalog_digest =
            'a'.repeat(64);
        },
      }, base);
      break;
    case 'stale_rules_identity':
      await installEvidence(rootDir, {
        reviewScopes: ['classroom', 'homeschool'],
        reviewMutate(record) {
          record.evidence_identity.pedagogical_snapshot.selection_rules_version = '9.9';
        },
      }, base);
      break;
    case 'lesson_dna_change_stales':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
      }, base);
      await mutateReviewableText(
        rootDir,
        'teacher-packs/grade-5-science/water/pedagogy/classroom/lesson-01-lesson-dna.yaml',
        '\n# temporary identity mutation\n',
      );
      await linkEvidence(rootDir, {
        reviews: [REVIEW_PATH],
        classroomTrials: [CLASSROOM_PATH],
        homeTrials: [],
        identityCommitSha: base.identity.commit_sha,
      });
      break;
    case 'delivery_change_stales':
      await installEvidence(rootDir, {
        ...homeReview,
        home: true,
      }, base);
      await mutateReviewableText(
        rootDir,
        'teacher-packs/grade-5-science/water/homeschool/lesson-01-parent-guidance.md',
        '\n<!-- temporary delivery mutation -->\n',
      );
      await linkEvidence(rootDir, {
        reviews: [REVIEW_PATH],
        classroomTrials: [],
        homeTrials: [HOME_PATH],
        identityCommitSha: base.identity.commit_sha,
      });
      break;
    case 'superseded_ignored':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
        reviewMutate(record) {
          record.evidence_identity = staleFingerprint(record.evidence_identity);
          const item = finding('major', 'timing', ['classroom']);
          record.findings = [item];
          record.required_changes = [{
            change_id: 'historical-required-change',
            finding_refs: [item.finding_id],
            description: 'Historical required change superseded by a later review.',
            resolution_status: 'open',
            resolution_refs: [],
          }];
          record.decision = {
            status: 'changes_required',
            rationale: 'Synthetic historical finding superseded by a current review.',
          };
        },
        extraReview(record) {
          record.review_id = 'grade-5-water-regression-successor-review-2026-08-02';
          record.reviewed_at = '2026-08-02';
          record.lifecycle.supersedes = [
            'grade-5-water-regression-review-2026-08-01',
          ];
        },
      }, base);
      break;
    case 'superseded_classroom_safety_ignored':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
        classroomMutate(record) {
          record.findings = [finding('blocking', 'safety', ['classroom'])];
          record.decision = {
            status: 'changes_required',
            safe_to_repeat: false,
            rationale: 'Historical classroom safety blocker.',
          };
        },
        extraClassroom(record) {
          record.trial_id =
            'grade-5-water-regression-successor-classroom-trial-2026-08-02';
          record.conducted_at = '2026-08-02';
          record.lifecycle.supersedes = [
            'grade-5-water-regression-classroom-trial-2026-08-01',
          ];
        },
      }, base);
      break;
    case 'stale_classroom_history_does_not_block_home':
      await installEvidence(rootDir, {
        reviewScopes: ['classroom'],
        home: true,
        staleReview: true,
        extraReview(record) {
          const successor = createRegressionTeacherReview(
            base.identity,
            base.lessonIds,
            ['classroom', 'homeschool'],
          );
          Object.assign(record, successor);
          record.review_id =
            'grade-5-water-regression-successor-review-2026-08-02';
          record.reviewed_at = '2026-08-02';
          record.lifecycle.supersedes = [
            'grade-5-water-regression-review-2026-08-01',
          ];
        },
      }, base);
      break;
    case 'stale_home_history_does_not_block_classroom':
      await installEvidence(rootDir, {
        reviewScopes: ['homeschool'],
        classroom: true,
        staleReview: true,
        extraReview(record) {
          const successor = createRegressionTeacherReview(
            base.identity,
            base.lessonIds,
            ['classroom', 'homeschool'],
          );
          Object.assign(record, successor);
          record.review_id =
            'grade-5-water-regression-successor-review-2026-08-02';
          record.reviewed_at = '2026-08-02';
          record.lifecycle.supersedes = [
            'grade-5-water-regression-review-2026-08-01',
          ];
        },
      }, base);
      break;
    case 'current_negative_classroom_does_not_block_home':
      await installEvidence(rootDir, {
        reviewScopes: ['classroom'],
        home: true,
        reviewMutate(record) {
          const item = finding('major', 'timing', ['classroom']);
          record.findings = [item];
          record.required_changes = [{
            change_id: 'regression-classroom-change',
            finding_refs: [item.finding_id],
            description: 'Synthetic classroom-only required change.',
            resolution_status: 'open',
            resolution_refs: [],
          }];
          record.decision = {
            status: 'changes_required',
            rationale: 'Synthetic classroom-only negative evidence.',
          };
        },
        extraReview(record) {
          const homeRecord = createRegressionTeacherReview(
            base.identity,
            base.lessonIds,
            ['homeschool'],
          );
          Object.assign(record, homeRecord);
          record.review_id =
            'grade-5-water-regression-successor-review-2026-08-02';
          record.reviewed_at = '2026-08-02';
        },
      }, base);
      break;
    case 'review_scope_missing_classroom':
      await installEvidence(rootDir, { ...homeReview, classroom: true }, base);
      break;
    case 'review_scope_missing_homeschool':
      await installEvidence(rootDir, { ...classReview, home: true }, base);
      break;
    case 'open_blocking_finding':
    case 'open_major_finding':
    case 'unresolved_required_change': {
      const severity = scenarioId === 'open_blocking_finding' ? 'blocking' : 'major';
      await installEvidence(rootDir, {
        reviewScopes: ['classroom', 'homeschool'],
        reviewMutate(record) {
          const item = finding(severity, 'timing', ['classroom', 'homeschool']);
          record.findings = [item];
          record.blocking_findings = severity === 'blocking' ? [item.finding_id] : [];
          record.required_changes = [{
            change_id:
              `regression-${scenarioId.replaceAll('_', '-')}-required-change`,
            finding_refs: [item.finding_id],
            description: 'Synthetic unresolved required change.',
            resolution_status: 'open',
            resolution_refs: [],
          }];
          record.decision = {
            status: 'changes_required',
            rationale: 'Synthetic unresolved regression finding.',
          };
        },
      }, base);
      break;
    }
    case 'classroom_safety_blocker':
      await installEvidence(rootDir, {
        ...classReview,
        classroom: true,
        classroomMutate(record) {
          record.findings = [finding('blocking', 'safety', ['classroom'])];
          record.decision = {
            status: 'changes_required',
            safe_to_repeat: false,
            rationale: 'Synthetic classroom safety blocker.',
          };
        },
      }, base);
      break;
    case 'home_safety_blocker':
      await installEvidence(rootDir, {
        ...homeReview,
        home: true,
        homeMutate(record) {
          record.findings = [finding('blocking', 'safety', ['homeschool'])];
          record.decision = {
            status: 'changes_required',
            safe_to_repeat: false,
            parent_role_remained_bounded: true,
            rationale: 'Synthetic home safety blocker.',
          };
        },
      }, base);
      break;
    case 'draft_not_effective': {
      const draft = createRegressionTeacherReview(
        base.identity,
        base.lessonIds,
        ['classroom'],
      );
      draft.review_status = 'draft';
      draft.evidence_identity = null;
      draft.reviewed_at = null;
      draft.ratings = Object.fromEntries(RATING_FIELDS.map((field) => [field, null]));
      draft.decision = { status: 'pending', rationale: 'Uncompleted regression draft.' };
      await writeRecord(rootDir, REVIEW_PATH, draft);
      break;
    }
    case 'json_intake_normalizes':
    case 'deterministic_normalization': {
      const record = createRegressionTeacherReview(
        base.identity,
        base.lessonIds,
        ['classroom'],
      );
      const first = await writeCompletedReviewIntake(
        rootDir,
        baselineRootDir,
        record,
      );
      const second = await normalizePedagogicalEvidenceIntake({
        rootDir,
        baselineRootDir,
        intakePath: INTAKE_PATH,
      });
      normalizedDeterministic = first.yaml === second.yaml;
      const validators = await createPedagogicalEvidenceValidators(rootDir);
      normalizedDeterministic = normalizedDeterministic
        && validators.validators['teacher-review'](second.record);
      break;
    }
    case 'privacy_invalid_rejected':
    case 'registration_fingerprint_stable':
    case 'registration_refuses_fingerprint_change': {
      const record = createRegressionTeacherReview(
        base.identity,
        base.lessonIds,
        ['classroom'],
      );
      if (scenarioId === 'privacy_invalid_rejected') {
        record.decision.rationale =
          'Synthetic invalid contact: learner@example.com must be rejected.';
      }
      await writeRecord(rootDir, NORMALIZED_PATH, record);
      let changedBytes = null;
      try {
        await registerPedagogicalEvidence({
          rootDir,
          baselineRootDir,
          packPath: PACK_PATH,
          recordPath: NORMALIZED_PATH,
          targetPath: REVIEW_PATH,
          write: true,
          afterWrite: scenarioId === 'registration_refuses_fingerprint_change'
            ? async () => {
              changedBytes = await mutateReviewableText(
                rootDir,
                'teacher-packs/grade-5-science/water/teacher-guide.md',
                '\n<!-- temporary registration mutation -->\n',
              );
            }
            : null,
        });
      } catch (error) {
        registrationRejected = true;
      } finally {
        if (changedBytes) {
          await fs.writeFile(
            safeRepositoryPath(
              rootDir,
              'teacher-packs/grade-5-science/water/teacher-guide.md',
              'teacher guide',
            ),
            changedBytes,
          );
        }
      }
      break;
    }
    default:
      throw new Error(`missing readiness evidence scenario ${scenarioId}`);
  }
  const after = await currentState(rootDir, base.identity.commit_sha);
  const fingerprintStable = fingerprintStableOverride ?? (
    base.fingerprint.algorithm === after.fingerprint.algorithm
    && base.fingerprint.specification_version === after.fingerprint.specification_version
    && base.fingerprint.value === after.fingerprint.value
    && base.fingerprint.file_count === after.fingerprint.file_count
  );
  return { registrationRejected, normalizedDeterministic, fingerprintStable };
}

function invariant(invariantId, passed, summary, expected, actual, evidenceRefs) {
  return {
    invariant_id: invariantId,
    status: passed ? 'passed' : 'failed',
    summary,
    expected,
    actual,
    evidence_refs: uniqueSorted(evidenceRefs),
  };
}

export async function runReadinessEvidenceRegressionCase({
  item,
  fixtureRoot,
  baselineRootDir,
  baselineState,
  qualityRepository,
}) {
  const snapshots = await Promise.all(MUTABLE_SCENARIO_PATHS.map(
    async (repositoryPath) => {
      const absolute = safeRepositoryPath(fixtureRoot, repositoryPath, repositoryPath);
      try {
        return { repositoryPath, absolute, bytes: await fs.readFile(absolute) };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return { repositoryPath, absolute, bytes: null };
      }
    },
  ));
  try {
    const setup = await setupScenario(
      fixtureRoot,
      baselineRootDir,
      item.scenario_id,
      baselineState,
    );
    const report = await buildPedagogicalReadinessReport({
      rootDir: fixtureRoot,
      baselineRootDir,
      qualityRepository,
    });
    const readinessMatches =
      report.classroom_ready === item.expected_classroom_ready
      && report.homeschool_ready === item.expected_homeschool_ready;
    const fingerprintMatches =
      setup.fingerprintStable === item.expected_fingerprint_stable;
    const registrationMatches =
      setup.registrationRejected === item.expected_registration_rejected;
    const ephemeralCandidates = [
      REVIEW_PATH,
      SECOND_REVIEW_PATH,
      CLASSROOM_PATH,
      SECOND_CLASSROOM_PATH,
      HOME_PATH,
      NORMALIZED_PATH,
      INTAKE_PATH,
    ];
    const ephemeral = uniqueSorted((await Promise.all(
      ephemeralCandidates.map(async (repositoryPath) => {
        try {
          const stat = await fs.lstat(
            safeRepositoryPath(fixtureRoot, repositoryPath, repositoryPath),
          );
          return stat.isFile() && !stat.isSymbolicLink() ? repositoryPath : null;
        } catch {
          return null;
        }
      }),
    )).filter(Boolean));
    const evidenceRefs = uniqueSorted([
      PACK_PATH,
      ...ephemeral,
    ]);
    return {
    regression_id: item.regression_id,
    case_kind: 'evidence_readiness',
    status: readinessMatches
      && fingerprintMatches
      && registrationMatches
      && setup.normalizedDeterministic
      ? 'passed'
      : 'failed',
    source_status: 'evidence_scenario',
    handler_id: 'evidence-readiness-scenario',
    selection_status: 'not_applicable',
    selected_target_ids: [],
    invariants: [
      invariant(
        'evidence_normalization_deterministic',
        setup.normalizedDeterministic,
        'Evidence normalization remains deterministic and schema-valid.',
        true,
        setup.normalizedDeterministic,
        evidenceRefs,
      ),
      invariant(
        'fingerprint_registration_boundary',
        fingerprintMatches,
        'The reviewable fingerprint changes only when the scenario changes reviewable content.',
        item.expected_fingerprint_stable,
        setup.fingerprintStable,
        evidenceRefs,
      ),
      invariant(
        'readiness_result_matches',
        readinessMatches,
        'Classroom and homeschool readiness match the evidence-gated truth table.',
        {
          classroom_ready: item.expected_classroom_ready,
          homeschool_ready: item.expected_homeschool_ready,
        },
        {
          classroom_ready: report.classroom_ready,
          homeschool_ready: report.homeschool_ready,
        },
        evidenceRefs,
      ),
      invariant(
        'registration_outcome_matches',
        registrationMatches,
        'Explicit registration accepts or rejects the scenario as declared.',
        item.expected_registration_rejected,
        setup.registrationRejected,
        evidenceRefs,
      ),
    ],
    diagnostics: [],
    expected_claims: {
      pedagogy_schema_valid: true,
      structurally_complete: null,
      production_ready: item.delivery_mode === 'classroom'
        ? item.expected_classroom_ready
        : item.delivery_mode === 'homeschool'
          ? item.expected_homeschool_ready
          : item.expected_classroom_ready && item.expected_homeschool_ready,
      effectiveness_claimed: false,
      curriculum_complete: false,
    },
    actual_claims: {
      pedagogy_schema_valid: report.structural_quality.pedagogy_schema_valid,
      structurally_complete: report.structural_quality.structurally_complete,
      production_ready: item.delivery_mode === 'classroom'
        ? report.classroom_ready
        : item.delivery_mode === 'homeschool'
          ? report.homeschool_ready
          : report.classroom_ready && report.homeschool_ready,
      effectiveness_claimed: report.effectiveness_claimed,
      curriculum_complete: false,
    },
    checked_artifacts: uniqueSorted(
      report.checked_artifacts.filter((repositoryPath) => !ephemeral.includes(repositoryPath)),
    ),
    ephemeral_checked_artifacts: ephemeral,
      non_guarantees: [
        'not_curriculum_complete',
        'not_effectiveness_evidence',
        'not_teacher_approved',
        'not_trial_evidence',
      ],
    };
  } finally {
    for (const snapshot of snapshots) {
      if (snapshot.bytes === null) {
        await fs.rm(snapshot.absolute, { force: true });
      } else {
        await fs.mkdir(path.dirname(snapshot.absolute), { recursive: true });
        await fs.writeFile(snapshot.absolute, snapshot.bytes);
      }
    }
  }
}
