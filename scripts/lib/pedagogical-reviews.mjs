import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  makeDiagnostic,
  parseStrictCurriculumYaml,
  relativeDisplay,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  loadTeacherPackRepository,
  validateTeacherPackRepository,
} from './teacher-packs.mjs';

const completedReviewDecisions = new Set(['approved', 'approved_with_minor_notes']);
const successfulTrialDecisions = new Set(['successful', 'successful_with_notes']);
const openStatuses = new Set(['open', 'planned']);
const mandatoryScopeFlags = [
  'teacher_guide',
  'student_materials',
  'answer_keys',
  'assessment_rubric',
  'homeschool_materials',
  'safety',
  'language_level',
];
const privacyFalseFlags = [
  'contains_student_names',
  'contains_birth_dates',
  'contains_personal_identifiers',
  'contains_addresses',
  'contains_contact_information',
  'contains_parent_contacts',
  'contains_student_photos',
  'contains_special_category_data',
  'contains_identifiable_individual_grades',
  'contains_identifiable_free_text',
];

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function normalize(value) {
  return String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sameSet(left, right) {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function addDuplicates(diagnostics, values, file, field, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    seen.add(value);
  }
}

async function loadYamlArtifact(rootDir, repositoryPath, kind) {
  let file = repositoryPath ?? '<missing>';
  try {
    const resolved = safeRepositoryPath(rootDir, repositoryPath, `${kind} path`);
    file = relativeDisplay(rootDir, resolved);
    return { file, data: parseStrictCurriculumYaml(await fs.readFile(resolved, 'utf8'), file), kind };
  } catch (error) {
    return { file, data: null, kind, loadError: error.message };
  }
}

async function loadRequiredDocument(rootDir, repositoryPath, kind) {
  let file = repositoryPath ?? '<missing>';
  try {
    const resolved = safeRepositoryPath(rootDir, repositoryPath, `${kind} path`);
    file = relativeDisplay(rootDir, resolved);
    await fs.readFile(resolved, 'utf8');
    return { file, kind };
  } catch (error) {
    return { file, kind, loadError: error.message };
  }
}

function resolvePackCommitSha(rootDir, packPath) {
  const excludedIndex = `:(exclude)${packPath}/materials-index.yaml`;
  const value = execFileSync('git', ['rev-list', '-1', 'HEAD', '--', packPath, excludedIndex], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!/^[0-9a-f]{40}$/u.test(value)) throw new Error(`cannot resolve teacher-pack content commit for ${packPath}`);
  return value;
}

export async function loadPedagogicalReviewRepository({
  rootDir = process.cwd(),
  teacherReviewSchemaPath = 'schemas/teacher-review.schema.json',
  classroomTrialSchemaPath = 'schemas/classroom-trial.schema.json',
  currentPackCommitSha = null,
} = {}) {
  const teacherPacks = await loadTeacherPackRepository({ rootDir });
  const absoluteRoot = teacherPacks.rootDir;
  const [reviewSchema, trialSchema] = await Promise.all([
    fs.readFile(safeRepositoryPath(absoluteRoot, teacherReviewSchemaPath, 'teacher-review schema path'), 'utf8').then(JSON.parse),
    fs.readFile(safeRepositoryPath(absoluteRoot, classroomTrialSchemaPath, 'classroom-trial schema path'), 'utf8').then(JSON.parse),
  ]);
  const reviewTemplates = [];
  const trialTemplates = [];
  const reviewRecords = [];
  const trialRecords = [];
  const workflowDocuments = [];
  const packCommitShas = {};
  for (const index of teacherPacks.indexes) {
    const reviewLink = index.data.pedagogical_review ?? {};
    const trialLink = index.data.classroom_trial ?? {};
    const reviewTemplatePath = reviewLink.guide_path
      ? path.posix.join(path.posix.dirname(reviewLink.guide_path), 'teacher-review-template.yaml')
      : null;
    if (reviewTemplatePath) reviewTemplates.push(await loadYamlArtifact(absoluteRoot, reviewTemplatePath, 'teacher-review template'));
    if (trialLink.template_path) trialTemplates.push(await loadYamlArtifact(absoluteRoot, trialLink.template_path, 'classroom-trial template'));
    if (reviewLink.guide_path) {
      const reviewDirectory = path.posix.dirname(reviewLink.guide_path);
      workflowDocuments.push(await loadRequiredDocument(absoluteRoot, reviewLink.guide_path, 'teacher-review guide'));
      workflowDocuments.push(await loadRequiredDocument(absoluteRoot, `${reviewDirectory}/anonymous-observation-form.md`, 'anonymous observation form'));
      workflowDocuments.push(await loadRequiredDocument(absoluteRoot, `${reviewDirectory}/issue-resolution-template.yaml`, 'issue-resolution template'));
    }
    if (reviewLink.review_record_path) reviewRecords.push(await loadYamlArtifact(absoluteRoot, reviewLink.review_record_path, 'teacher-review record'));
    for (const trialPath of trialLink.trial_record_paths ?? []) {
      trialRecords.push(await loadYamlArtifact(absoluteRoot, trialPath, 'classroom-trial record'));
    }
    packCommitShas[index.data.pack_id] = currentPackCommitSha ?? resolvePackCommitSha(absoluteRoot, index.data.pack_path);
  }
  return {
    rootDir: absoluteRoot,
    teacherPacks,
    schemas: { review: reviewSchema, trial: trialSchema },
    reviewTemplates,
    trialTemplates,
    reviewRecords,
    trialRecords,
    workflowDocuments,
    packCommitShas,
  };
}

function compileSchemas(context) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  return {
    review: ajv.compile(context.schemas.review),
    trial: ajv.compile(context.schemas.trial),
  };
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (artifact.loadError) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/', artifact.loadError));
    return false;
  }
  if (validator(artifact.data)) return true;
  for (const error of validator.errors ?? []) {
    diagnostics.push(makeDiagnostic('error', artifact.file, error.instancePath || '/', schemaReason(error)));
  }
  return false;
}

function validateTemplateSemantics(diagnostics, artifact, type) {
  if (!artifact.data) return;
  if (type === 'review') {
    if (artifact.data.review_status !== 'draft' || artifact.data.decision?.status !== 'pending'
      || artifact.data.pack_commit_sha !== null || artifact.data.reviewed_at !== null) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/', 'teacher-review template must remain an uncompleted draft without evidence dates or commit SHA'));
    }
  } else if (artifact.data.trial_status !== 'draft' || artifact.data.decision?.status !== 'pending'
    || artifact.data.pack_commit_sha !== null || artifact.data.conducted_at !== null) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/', 'classroom-trial template must remain an uncompleted draft without evidence dates or commit SHA'));
  }
}

function validateReviewRecord(diagnostics, artifact, pack, currentSha, lessonIds, schemaValid, { requireApproval = false } = {}) {
  const review = artifact.data;
  if (!review || !schemaValid) return { effective: false, stale: false };
  const field = '/';
  if (review.pack_ref !== pack.pack_id) diagnostics.push(makeDiagnostic('error', artifact.file, '/pack_ref', `expected ${pack.pack_id}`));
  const stale = typeof review.pack_commit_sha === 'string' && review.pack_commit_sha !== currentSha;
  if (stale) diagnostics.push(makeDiagnostic('warning', artifact.file, '/pack_commit_sha', 'teacher review is stale for the current teacher-pack commit'));
  const completed = review.review_status === 'completed';
  if (requireApproval && !completed) diagnostics.push(makeDiagnostic('error', artifact.file, '/review_status', 'teacher review evidence must have review_status: completed'));
  if (completed && review.decision?.status === 'pending') diagnostics.push(makeDiagnostic('error', artifact.file, '/decision/status', 'completed teacher review cannot retain a pending decision'));
  if (completed || requireApproval) {
    if (!normalize(review.reviewer?.role)) diagnostics.push(makeDiagnostic('error', artifact.file, '/reviewer/role', 'completed teacher review requires reviewer role'));
    if (!validDate(review.reviewed_at)) diagnostics.push(makeDiagnostic('error', artifact.file, '/reviewed_at', 'completed teacher review requires a valid date'));
    for (const flag of mandatoryScopeFlags) {
      if (review.review_scope?.[flag] !== true) diagnostics.push(makeDiagnostic('error', artifact.file, `/review_scope/${flag}`, `completed teacher review must cover ${flag}`));
    }
    if (!sameSet(review.review_scope?.lesson_guides, lessonIds)) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/review_scope/lesson_guides', 'completed teacher review must cover every linked lesson guide'));
    }
    for (const [rating, value] of Object.entries(review.ratings ?? {})) {
      if (!Number.isInteger(value)) diagnostics.push(makeDiagnostic('error', artifact.file, `/ratings/${rating}`, 'completed teacher review requires every rating'));
    }
  }
  const findings = review.findings ?? [];
  addDuplicates(diagnostics, findings.map((entry) => entry.finding_id), artifact.file, '/findings', 'finding ID');
  const findingIds = new Set(findings.map((entry) => entry.finding_id));
  const expectedBlocking = findings.filter((entry) => entry.severity === 'blocking').map((entry) => entry.finding_id);
  if (!sameSet(review.blocking_findings, expectedBlocking)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/blocking_findings', 'must exactly list findings with severity blocking'));
  }
  addDuplicates(diagnostics, (review.required_changes ?? []).map((entry) => entry.change_id), artifact.file, '/required_changes', 'required change ID');
  for (const [index, change] of (review.required_changes ?? []).entries()) {
    for (const findingId of change.finding_refs ?? []) {
      if (!findingIds.has(findingId)) diagnostics.push(makeDiagnostic('error', artifact.file, `/required_changes/${index}/finding_refs`, `unknown finding ${findingId}`));
    }
  }
  const openBlockingOrMajor = findings.filter((entry) => ['blocking', 'major'].includes(entry.severity) && openStatuses.has(entry.resolution_status));
  const approvedDecision = completedReviewDecisions.has(review.decision?.status);
  if (approvedDecision || requireApproval) {
    for (const finding of openBlockingOrMajor) diagnostics.push(makeDiagnostic('error', artifact.file, '/findings', `open ${finding.severity} finding prevents approval: ${finding.finding_id}`));
  }
  const unresolvedChanges = (review.required_changes ?? []).filter((entry) => openStatuses.has(entry.resolution_status));
  const unacceptableChanges = [];
  if (review.decision?.status === 'approved') unacceptableChanges.push(...unresolvedChanges);
  if (review.decision?.status === 'approved_with_minor_notes') {
    for (const change of unresolvedChanges) {
      const related = (change.finding_refs ?? []).map((id) => findings.find((finding) => finding.finding_id === id)).filter(Boolean);
      const isMinorPlan = related.length > 0
        && related.every((finding) => finding.severity === 'minor')
        && change.resolution_status === 'planned'
        && (change.resolution_refs ?? []).length > 0;
      if (!isMinorPlan) unacceptableChanges.push(change);
    }
  }
  for (const change of unacceptableChanges) diagnostics.push(makeDiagnostic('error', artifact.file, '/required_changes', `approval requires required change ${change.change_id} to be closed or recorded as a minor resolution plan`));
  const unplannedMinorFindings = [];
  if (review.decision?.status === 'approved_with_minor_notes') {
    for (const finding of findings.filter((entry) => entry.severity === 'minor' && openStatuses.has(entry.resolution_status))) {
      const directPlan = finding.resolution_status === 'planned' && (finding.resolution_refs ?? []).length > 0;
      const changePlan = (review.required_changes ?? []).some((change) => (change.finding_refs ?? []).includes(finding.finding_id)
        && ['planned', 'resolved'].includes(change.resolution_status) && (change.resolution_refs ?? []).length > 0);
      if (!directPlan && !changePlan) {
        unplannedMinorFindings.push(finding);
        diagnostics.push(makeDiagnostic('error', artifact.file, '/findings', `minor finding ${finding.finding_id} requires a recorded resolution plan`));
      }
    }
  }
  if (requireApproval && !approvedDecision) diagnostics.push(makeDiagnostic('error', artifact.file, '/decision/status', 'effective teacher review requires approved or approved_with_minor_notes decision'));
  const effective = completed
    && review.pack_ref === pack.pack_id
    && !stale
    && validDate(review.reviewed_at)
    && normalize(review.reviewer?.role)
    && mandatoryScopeFlags.every((flagName) => review.review_scope?.[flagName] === true)
    && sameSet(review.review_scope?.lesson_guides, lessonIds)
    && openBlockingOrMajor.length === 0
    && unacceptableChanges.length === 0
    && unplannedMinorFindings.length === 0
    && approvedDecision;
  if (!effective && completed && approvedDecision && stale && requireApproval) {
    diagnostics.push(makeDiagnostic('error', artifact.file, field, 'stale teacher review cannot prove current readiness'));
  }
  return { effective: Boolean(effective), stale };
}

function privacyComplete(privacy) {
  return privacyFalseFlags.every((field) => privacy?.[field] === false)
    && privacy?.observations_are_aggregated === true
    && privacy?.free_text_checked_for_identifiers === true;
}

function validateTrialRecord(diagnostics, artifact, pack, currentSha, lessonIds, schemaValid, { requireSuccess = false } = {}) {
  const trial = artifact.data;
  if (!trial || !schemaValid) return { effective: false, stale: false };
  if (trial.pack_ref !== pack.pack_id) diagnostics.push(makeDiagnostic('error', artifact.file, '/pack_ref', `expected ${pack.pack_id}`));
  const stale = typeof trial.pack_commit_sha === 'string' && trial.pack_commit_sha !== currentSha;
  if (stale) diagnostics.push(makeDiagnostic('warning', artifact.file, '/pack_commit_sha', 'classroom trial is stale for the current teacher-pack commit'));
  const analysed = trial.trial_status === 'analysed';
  if (requireSuccess && !analysed) diagnostics.push(makeDiagnostic('error', artifact.file, '/trial_status', 'classroom trial evidence must have trial_status: analysed'));
  if (analysed && trial.decision?.status === 'pending') diagnostics.push(makeDiagnostic('error', artifact.file, '/decision/status', 'analysed classroom trial cannot retain a pending decision'));
  if ((analysed || requireSuccess) && !validDate(trial.conducted_at)) diagnostics.push(makeDiagnostic('error', artifact.file, '/conducted_at', 'analysed classroom trial requires a valid date'));
  const knownLessons = new Set(lessonIds);
  if ((analysed || requireSuccess) && (trial.context?.lesson_ids ?? []).length === 0) diagnostics.push(makeDiagnostic('error', artifact.file, '/context/lesson_ids', 'analysed classroom trial requires at least one lesson ID'));
  for (const lessonId of trial.context?.lesson_ids ?? []) {
    if (!knownLessons.has(lessonId)) diagnostics.push(makeDiagnostic('error', artifact.file, '/context/lesson_ids', `unknown linked lesson ${lessonId}`));
  }
  if ((analysed || requireSuccess) && !privacyComplete(trial.privacy)) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/privacy', 'analysed classroom trial requires complete no-personal-data declarations and human-checked free text'));
  }
  const findings = trial.findings ?? [];
  addDuplicates(diagnostics, findings.map((entry) => entry.finding_id), artifact.file, '/findings', 'trial finding ID');
  const openSafetyBlockers = findings.filter((entry) => entry.category === 'safety' && entry.severity === 'blocking' && openStatuses.has(entry.resolution_status));
  const successfulDecision = successfulTrialDecisions.has(trial.decision?.status);
  if (successfulDecision || requireSuccess) {
    for (const finding of openSafetyBlockers) diagnostics.push(makeDiagnostic('error', artifact.file, '/findings', `open safety blocker prevents successful trial: ${finding.finding_id}`));
  }
  if (requireSuccess && !successfulDecision) diagnostics.push(makeDiagnostic('error', artifact.file, '/decision/status', 'effective classroom trial requires successful or successful_with_notes decision'));
  const effective = analysed
    && trial.pack_ref === pack.pack_id
    && !stale
    && validDate(trial.conducted_at)
    && (trial.context?.lesson_ids ?? []).length > 0
    && (trial.context?.lesson_ids ?? []).every((id) => knownLessons.has(id))
    && privacyComplete(trial.privacy)
    && openSafetyBlockers.length === 0
    && successfulDecision;
  if (!effective && analysed && successfulDecision && stale && requireSuccess) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/', 'stale classroom trial cannot prove current readiness'));
  }
  return { effective, stale };
}

function validatePackWorkflow(diagnostics, context, index, schemaValidity) {
  const pack = index.data;
  const thematicArtifact = context.teacherPacks.plans.artifacts.find((artifact) => artifact.data.unit_id === pack.unit_ref);
  const unitPack = thematicArtifact?.data.teacher_pack ?? {};
  const reviewLink = pack.pedagogical_review ?? {};
  const trialLink = pack.classroom_trial ?? {};
  const lessonIds = pack.lesson_ids ?? [];
  const lessons = context.teacherPacks.plans.artifacts.filter((artifact) => lessonIds.includes(artifact.data.lesson_id));
  const currentSha = context.packCommitShas[pack.pack_id];
  if (JSON.stringify(reviewLink) !== JSON.stringify(unitPack.pedagogical_review ?? {})) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review', 'must exactly match thematic-plan pedagogical_review linkage'));
  if (JSON.stringify(trialLink) !== JSON.stringify(unitPack.classroom_trial ?? {})) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial', 'must exactly match thematic-plan classroom_trial linkage'));
  if (reviewLink.status !== unitPack.teacher_review_status) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/teacher_review_status', 'must match pedagogical_review.status'));

  const expectedReviewTemplate = path.posix.join(path.posix.dirname(reviewLink.guide_path ?? ''), 'teacher-review-template.yaml');
  if (reviewLink.review_record_path === expectedReviewTemplate) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/review_record_path', 'teacher-review template cannot be used as completed evidence'));
  if ((trialLink.trial_record_paths ?? []).includes(trialLink.template_path)) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/trial_record_paths', 'classroom-trial template cannot be used as completed evidence'));

  const reviewClaimedApproved = reviewLink.status === 'approved'
    || unitPack.teacher_review_status === 'approved'
    || lessons.some((lesson) => lesson.data.artifact_readiness?.teacher_review?.status === 'approved');
  const trialClaimedTested = trialLink.status === 'tested'
    || lessons.some((lesson) => lesson.data.artifact_readiness?.classroom_trial?.status === 'tested');
  const classroomReady = unitPack.classroom_ready === true
    || lessons.some((lesson) => lesson.data.artifact_readiness?.classroom_ready === true);
  const linkedReviewRecords = context.reviewRecords.filter((record) => record.file === reviewLink.review_record_path);
  const linkedTrialRecords = context.trialRecords.filter((record) => (trialLink.trial_record_paths ?? []).includes(record.file));
  const reviewStates = linkedReviewRecords.map((record) => validateReviewRecord(
    diagnostics, record, pack, currentSha, lessonIds, schemaValidity.get(record), { requireApproval: reviewClaimedApproved || classroomReady },
  ));
  const trialStates = linkedTrialRecords.map((record) => validateTrialRecord(
    diagnostics, record, pack, currentSha, lessonIds, schemaValidity.get(record), { requireSuccess: trialClaimedTested || classroomReady },
  ));
  const effectiveReview = reviewStates.some((state) => state.effective);
  const effectiveTrial = trialStates.some((state) => state.effective);

  if (reviewClaimedApproved && linkedReviewRecords.length === 0) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/review_record_path', 'teacher_review: approved requires a registered completed review record'));
  if (reviewClaimedApproved && !effectiveReview) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/status', 'approved teacher review has no effective evidence for the current teacher-pack commit'));
  if (['changes_requested', 'rejected'].includes(reviewLink.status) && linkedReviewRecords.length === 0) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/review_record_path', `${reviewLink.status} review status requires a registered review record`));
  if (reviewLink.status === 'changes_requested' && !linkedReviewRecords.some((record) => record.data?.review_status === 'completed' && record.data?.decision?.status === 'changes_required')) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/status', 'changes_requested status requires a completed changes_required review decision'));
  if (reviewLink.status === 'rejected' && !linkedReviewRecords.some((record) => record.data?.review_status === 'completed' && record.data?.decision?.status === 'rejected')) diagnostics.push(makeDiagnostic('error', index.file, '/pedagogical_review/status', 'rejected status requires a completed rejected review decision'));
  if (trialClaimedTested && linkedTrialRecords.length === 0) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/trial_record_paths', 'classroom_trial: tested requires a registered analysed trial record'));
  if (trialClaimedTested && !effectiveTrial) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/status', 'tested classroom trial has no effective evidence for the current teacher-pack commit'));
  if (['changes_required', 'repeat_required'].includes(trialLink.status) && linkedTrialRecords.length === 0) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/trial_record_paths', `${trialLink.status} trial status requires a registered trial record`));
  if (trialLink.status === 'changes_required' && !linkedTrialRecords.some((record) => record.data?.trial_status === 'analysed' && record.data?.decision?.status === 'changes_required')) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/status', 'changes_required status requires an analysed changes_required trial decision'));
  if (trialLink.status === 'repeat_required' && !linkedTrialRecords.some((record) => record.data?.trial_status === 'analysed' && record.data?.decision?.status === 'repeat_trial_required')) diagnostics.push(makeDiagnostic('error', index.file, '/classroom_trial/status', 'repeat_required status requires an analysed repeat_trial_required decision'));

  if (!reviewClaimedApproved && linkedReviewRecords.length === 0) diagnostics.push(makeDiagnostic('warning', index.file, '/pedagogical_review/status', 'independent teacher review is pending; 0 completed review records are registered'));
  if (!trialClaimedTested && linkedTrialRecords.length === 0) diagnostics.push(makeDiagnostic('warning', index.file, '/classroom_trial/status', 'classroom trial is not tested; 0 completed trial records are registered'));

  if (classroomReady) {
    if (!unitPack.materials_resolved || !unitPack.print_ready) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready requires resolved and print-ready materials'));
    if (!effectiveReview) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready requires an effective approved teacher review'));
    if (!effectiveTrial) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready requires an effective analysed classroom trial'));
    const openReviewBlockers = linkedReviewRecords.flatMap((record) => (record.data?.findings ?? []).filter((finding) => finding.severity === 'blocking' && openStatuses.has(finding.resolution_status)));
    const unresolvedChanges = linkedReviewRecords.flatMap((record) => (record.data?.required_changes ?? []).filter((change) => openStatuses.has(change.resolution_status)));
    const openSafety = linkedTrialRecords.flatMap((record) => (record.data?.findings ?? []).filter((finding) => finding.category === 'safety' && openStatuses.has(finding.resolution_status)));
    if (openReviewBlockers.length > 0) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready cannot have open blocking review findings'));
    if (unresolvedChanges.length > 0) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready requires all required changes to be closed'));
    if (openSafety.length > 0) diagnostics.push(makeDiagnostic('error', thematicArtifact?.file ?? index.file, '/teacher_pack/classroom_ready', 'classroom_ready cannot have open safety findings'));
  }
  return { effectiveReview, effectiveTrial };
}

export function validatePedagogicalReviewRepository(context) {
  const diagnostics = [];
  const teacherPackResult = validateTeacherPackRepository(context.teacherPacks);
  diagnostics.push(...teacherPackResult.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'));
  const validators = compileSchemas(context);
  const schemaValidity = new Map();
  for (const document of context.workflowDocuments ?? []) {
    if (document.loadError) diagnostics.push(makeDiagnostic('error', document.file, '/', document.loadError));
  }
  for (const artifact of context.reviewTemplates) {
    schemaValidity.set(artifact, addSchemaDiagnostics(diagnostics, artifact, validators.review));
    validateTemplateSemantics(diagnostics, artifact, 'review');
  }
  for (const artifact of context.trialTemplates) {
    schemaValidity.set(artifact, addSchemaDiagnostics(diagnostics, artifact, validators.trial));
    validateTemplateSemantics(diagnostics, artifact, 'trial');
  }
  for (const artifact of context.reviewRecords) schemaValidity.set(artifact, addSchemaDiagnostics(diagnostics, artifact, validators.review));
  for (const artifact of context.trialRecords) schemaValidity.set(artifact, addSchemaDiagnostics(diagnostics, artifact, validators.trial));
  if (context.reviewTemplates.length !== context.teacherPacks.indexes.length) diagnostics.push(makeDiagnostic('error', 'pedagogical-reviews', '/', 'every teacher pack requires one teacher-review template'));
  if (context.trialTemplates.length !== context.teacherPacks.indexes.length) diagnostics.push(makeDiagnostic('error', 'pedagogical-reviews', '/', 'every teacher pack requires one classroom-trial template'));
  let effectiveReviews = 0;
  let effectiveTrials = 0;
  for (const index of context.teacherPacks.indexes) {
    const state = validatePackWorkflow(diagnostics, context, index, schemaValidity);
    if (state.effectiveReview) effectiveReviews += 1;
    if (state.effectiveTrial) effectiveTrials += 1;
  }
  addDuplicates(diagnostics, context.reviewRecords.map((artifact) => artifact.data?.review_id).filter(Boolean), 'pedagogical-reviews', '/review_id', 'review ID');
  addDuplicates(diagnostics, context.trialRecords.map((artifact) => artifact.data?.trial_id).filter(Boolean), 'pedagogical-reviews', '/trial_id', 'trial ID');
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  return {
    diagnostics,
    summary: {
      packs: context.teacherPacks.indexes.length,
      reviewTemplates: context.reviewTemplates.length,
      trialTemplates: context.trialTemplates.length,
      completedReviews: context.reviewRecords.filter((artifact) => artifact.data?.review_status === 'completed').length,
      analysedTrials: context.trialRecords.filter((artifact) => artifact.data?.trial_status === 'analysed').length,
      effectiveReviews,
      effectiveTrials,
      errors,
      warnings,
    },
  };
}

export function formatPedagogicalReviewDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
