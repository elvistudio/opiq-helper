import fs from 'node:fs/promises';
import path from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';

import {
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './teacher-work-plan-reusable-artifacts.mjs';
import {
  loadTeacherWorkPlanArtifactReviewRepository,
  REVIEW_REGISTRY_PATH,
  resolveTeacherWorkPlanClassroomTrialLifecycle,
  validateTeacherWorkPlanArtifactReviewRepository,
} from './teacher-work-plan-artifact-reviews.mjs';

export const CLASSROOM_TRIAL_SCHEMA_PATH =
  'schemas/teacher-work-plan-artifact-classroom-trial.schema.json';
export const CLASSROOM_TRIAL_TEMPLATE_PATH =
  'teacher-work-plan-artifacts/grade-6-science/soil-organisms/reviews/classroom-trial-template.yaml';

const PILOT_ROOT = 'teacher-work-plan-artifacts/grade-6-science/soil-organisms';
const ARTIFACT_INDEX_PATH = `${PILOT_ROOT}/artifact-index.yaml`;
const REVIEW_ROOT = `${PILOT_ROOT}/reviews`;
const CLASSROOM_TRIAL_GUIDE_PATH = `${REVIEW_ROOT}/classroom-trial-guide.md`;
const FINGERPRINT = '894cc83f54c158485f6d6ba699d8a1298c3e57056e315281b79d69e84f366613';

const PARTS = Object.freeze([
  Object.freeze({
    part_id: 'part-1',
    source_gap_id: 'grade-6-science-lesson-008',
    title_et: 'Mullaorganismide välivaatlus',
    planned_duration_minutes: 45,
    dimensions: Object.freeze([
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
    ]),
  }),
  Object.freeze({
    part_id: 'part-2',
    source_gap_id: 'grade-6-science-lesson-009',
    title_et: 'Mullaorganismid',
    planned_duration_minutes: 45,
    dimensions: Object.freeze([
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
    ]),
  }),
]);

const GUIDE_HEADINGS = Object.freeze([
  '## 1. Purpose and non-evidence boundary',
  '## 2. Prerequisite teacher and safety reviews',
  '## 3. Exact artifact and fingerprint',
  '## 4. Privacy and aggregate evidence',
  '## 5. Preparing the trial',
  '## 6. Part 1 observation procedure',
  '## 7. Part 2 observation procedure',
  '## 8. Timing and transition evidence',
  '## 9. Safety, stop conditions and incidents',
  '## 10. Findings and required changes',
  '## 11. Trial decisions',
  '## 12. Fingerprint invalidation',
  '## 13. Registration of an analysed record',
  '## 14. Readiness truth table',
  '## 15. Prohibited claims',
]);

const EXACT_IDENTITY = Object.freeze({
  artifact_id: 'grade-6-science-soil-organisms',
  artifact_index_path: ARTIFACT_INDEX_PATH,
  package_id: 'grade-6-science-soil-organisms',
  route: 'grade-6-science',
  grade: 6,
  subject: 'science',
  subject_et: 'loodusõpetus',
  content_fingerprint: FINGERPRINT,
});

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(file, field, reason) {
  return { file, field: field || '/', reason };
}

function schemaReason(error) {
  if (error.keyword === 'additionalProperties') return `unknown field ${error.params.additionalProperty}`;
  if (error.keyword === 'required') return `missing required field ${error.params.missingProperty}`;
  return error.message ?? `failed ${error.keyword}`;
}

function safeRepositoryPath(rootDir, repositoryPath) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
  ) throw new Error(`unsafe repository path: ${repositoryPath}`);
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, repositoryPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`repository path escapes root: ${repositoryPath}`);
  return resolved;
}

function insideReviewRoot(repositoryPath) {
  return typeof repositoryPath === 'string' && repositoryPath.startsWith(`${REVIEW_ROOT}/`);
}

function insidePilotRoot(repositoryPath) {
  return typeof repositoryPath === 'string' && repositoryPath.startsWith(`${PILOT_ROOT}/`);
}

function parseStrictYaml(text, file) {
  if (text.includes('\t')) throw new Error(`${file}: invalid YAML: tabs are forbidden`);
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`${file}: invalid YAML: ${document.errors.map((error) => error.message).join('; ')}`);
  }
  if (document.anchors?.size > 0 || /(?:^|\s)[&*][A-Za-z0-9_-]+/mu.test(text)) {
    throw new Error(`${file}: YAML aliases and anchors are forbidden`);
  }
  return document.toJS({ maxAliasCount: 0 });
}

async function readYaml(rootDir, repositoryPath, overrides, loadDiagnostics) {
  try {
    if (!insideReviewRoot(repositoryPath)) throw new Error('trial record path must remain inside the exact review root');
    const text = overrides.has(repositoryPath)
      ? overrides.get(repositoryPath)
      : await fs.readFile(safeRepositoryPath(rootDir, repositoryPath), 'utf8');
    return { file: repositoryPath, text, data: parseStrictYaml(text, repositoryPath) };
  } catch (error) {
    loadDiagnostics.push(diagnostic(repositoryPath, '/', error.message));
    return null;
  }
}

export async function loadTeacherWorkPlanArtifactClassroomTrialRepository({
  rootDir = process.cwd(),
  fileOverrides = new Map(),
  reusableRepository = null,
  reviewRepository = null,
} = {}) {
  const root = path.resolve(rootDir);
  const loadDiagnostics = [];
  const resolvedReusableRepository = reusableRepository
    ?? await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: root, artifactOverrides: fileOverrides });
  const resolvedReviewRepository = reviewRepository
    ?? await loadTeacherWorkPlanArtifactReviewRepository({
      rootDir: root,
      fileOverrides,
      reusableRepository: resolvedReusableRepository,
    });
  const trialTemplatePath = resolvedReviewRepository.registry?.data?.classroom_trial?.template_path
    ?? CLASSROOM_TRIAL_TEMPLATE_PATH;
  const [schema, trialTemplate, guideText] = await Promise.all([
    fs.readFile(safeRepositoryPath(root, CLASSROOM_TRIAL_SCHEMA_PATH), 'utf8').then(JSON.parse),
    readYaml(root, trialTemplatePath, fileOverrides, loadDiagnostics),
    fs.readFile(safeRepositoryPath(root, CLASSROOM_TRIAL_GUIDE_PATH), 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    }),
  ]);
  return {
    rootDir: root,
    schema,
    trialTemplate,
    guideText,
    reusableRepository: resolvedReusableRepository,
    reviewRepository: resolvedReviewRepository,
    completedTrials: resolvedReviewRepository.completedClassroomTrials ?? [],
    loadDiagnostics,
  };
}

function validateSchema(diagnostics, validate, entry) {
  if (!entry) return;
  if (!validate(entry.data)) {
    for (const error of validate.errors ?? []) {
      diagnostics.push(diagnostic(entry.file, error.instancePath || '/', schemaReason(error)));
    }
  }
}

function validateExact(diagnostics, file, field, actual, expected, reason) {
  if (!exactJson(actual, expected)) diagnostics.push(diagnostic(file, field, reason));
}

function validateTemplate(diagnostics, entry) {
  if (!entry) return;
  const data = entry.data;
  if (data.template !== true) diagnostics.push(diagnostic(entry.file, '/template', 'classroom-trial template must remain template: true'));
  for (const [field, value] of Object.entries(data.trial_identity ?? {})) {
    if (value !== null) diagnostics.push(diagnostic(entry.file, `/trial_identity/${field}`, 'template cannot invent facilitator, group or trial identity'));
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, EXACT_IDENTITY, 'template must pin the exact pilot identity and current fingerprint');
  if (data.lifecycle?.status !== 'draft' || (data.lifecycle?.supersedes ?? []).length !== 0) diagnostics.push(diagnostic(entry.file, '/lifecycle', 'template lifecycle must remain draft with no supersession links'));
  if (data.decision?.status !== 'pending') diagnostics.push(diagnostic(entry.file, '/decision/status', 'template decision must remain pending'));
  if ((data.findings ?? []).length !== 0) diagnostics.push(diagnostic(entry.file, '/findings', 'template cannot contain findings'));
  for (const [partIndex, part] of (data.part_observations ?? []).entries()) {
    for (const [dimensionIndex, dimension] of (part.dimensions ?? []).entries()) {
      if (dimension.status !== 'not_observed' || dimension.notes !== null || (dimension.finding_ids ?? []).length !== 0) {
        diagnostics.push(diagnostic(entry.file, `/part_observations/${partIndex}/dimensions/${dimensionIndex}`, 'template observations must remain not_observed and empty'));
      }
    }
    if (part.actual_duration_minutes !== null) diagnostics.push(diagnostic(entry.file, `/part_observations/${partIndex}/actual_duration_minutes`, 'template cannot invent actual duration'));
  }
  for (const [field, value] of Object.entries(data.aggregate_observations ?? {})) {
    if (value !== null) diagnostics.push(diagnostic(entry.file, `/aggregate_observations/${field}`, 'template cannot invent aggregate observations'));
  }
}

function validateParts(diagnostics, entry) {
  validateExact(
    diagnostics,
    entry.file,
    '/part_observations',
    (entry.data.part_observations ?? []).map((part) => ({
      part_id: part.part_id,
      source_gap_id: part.source_gap_id,
      title_et: part.title_et,
      planned_duration_minutes: part.planned_duration_minutes,
      dimensions: (part.dimensions ?? []).map(({ dimension_id }) => dimension_id),
    })),
    PARTS,
    'trial must preserve the exact two source gaps, 45-minute parts and ordered dimensions',
  );
}

function collectFreeText(value, pointer = '', output = []) {
  if (typeof value === 'string') output.push({ pointer, text: value });
  else if (Array.isArray(value)) value.forEach((item, index) => collectFreeText(item, `${pointer}/${index}`, output));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) collectFreeText(child, `${pointer}/${key}`, output);
  }
  return output;
}

function validatePrivacyText(diagnostics, entry) {
  const sensitivePatterns = [
    { name: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu },
    { name: 'phone number', pattern: /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){7,}/u },
    { name: 'learner name or identifier', pattern: /\b(?:learner|student|pupil|õpilane)\s*(?:name|nimi|id)?\s*[:=]\s*\p{L}+/iu },
    { name: 'birth date', pattern: /\b(?:birth|date of birth|sünniaeg|sünnikuupäev)\b/iu },
    { name: 'address or contact', pattern: /\b(?:home address|postal address|contact details|kodune aadress|kontaktandmed)\b/iu },
    { name: 'medical or diagnostic information', pattern: /\b(?:medical record|diagnosis|diagnostic profile|terviseandmed|diagnoos)\b/iu },
    { name: 'recording or private media reference', pattern: /\b(?:audio recording|video recording|voice recording|private photo|private video|salvestis)\b/iu },
  ];
  for (const { pointer, text } of collectFreeText({
    classroom_context: entry.data.classroom_context,
    part_observations: entry.data.part_observations,
    aggregate_observations: entry.data.aggregate_observations,
    findings: entry.data.findings,
    decision: entry.data.decision,
  })) {
    for (const { name, pattern } of sensitivePatterns) {
      if (name === 'phone number' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(text)) continue;
      if (pattern.test(text)) diagnostics.push(diagnostic(entry.file, pointer, `learner-identifiable or private data is forbidden: ${name}`));
    }
  }
}

function validateFindings(diagnostics, entry) {
  const data = entry.data;
  const findingIds = (data.findings ?? []).map(({ finding_id }) => finding_id);
  if (new Set(findingIds).size !== findingIds.length) diagnostics.push(diagnostic(entry.file, '/findings', 'finding IDs must be unique'));
  const byId = new Map((data.findings ?? []).map((finding) => [finding.finding_id, finding]));
  for (const [index, finding] of (data.findings ?? []).entries()) {
    for (const affectedPath of finding.affected_paths ?? []) {
      if (!insidePilotRoot(affectedPath)) diagnostics.push(diagnostic(entry.file, `/findings/${index}/affected_paths`, 'affected paths must remain inside the pilot root'));
    }
    if (finding.status === 'resolved' && !finding.resolution_notes) diagnostics.push(diagnostic(entry.file, `/findings/${index}/resolution_notes`, 'resolved finding requires resolution notes'));
  }
  for (const [partIndex, part] of (data.part_observations ?? []).entries()) {
    for (const [dimensionIndex, dimension] of (part.dimensions ?? []).entries()) {
      for (const findingId of dimension.finding_ids ?? []) {
        if (!byId.has(findingId)) diagnostics.push(diagnostic(entry.file, `/part_observations/${partIndex}/dimensions/${dimensionIndex}/finding_ids`, `unknown finding ${findingId}`));
      }
      if (dimension.status === 'partly_met') {
        const linked = (dimension.finding_ids ?? []).map((id) => byId.get(id)).filter(Boolean);
        if (linked.length !== 1 || linked[0].severity !== 'minor' || !linked[0].required_change || !['open', 'resolved'].includes(linked[0].status)) {
          diagnostics.push(diagnostic(entry.file, `/part_observations/${partIndex}/dimensions/${dimensionIndex}`, 'partly_met requires one exact linked minor finding with a concrete open or resolved change plan'));
        }
      }
    }
  }
  const openBlocking = (data.findings ?? []).filter(({ severity, status }) => severity === 'blocking' && status === 'open').map(({ finding_id }) => finding_id);
  const openMajor = (data.findings ?? []).filter(({ severity, status }) => severity === 'major' && status === 'open').map(({ finding_id }) => finding_id);
  validateExact(diagnostics, entry.file, '/decision/open_blocking_findings', data.decision?.open_blocking_findings, openBlocking, 'decision must list every open blocking finding in source order');
  validateExact(diagnostics, entry.file, '/decision/open_major_findings', data.decision?.open_major_findings, openMajor, 'decision must list every open major finding in source order');
  return {
    openBlocking,
    openMajor,
    openRequired: (data.findings ?? []).filter(({ required_change, status }) => required_change && status === 'open'),
  };
}

function expectedSafetyContextSnapshot(safety) {
  if (!safety) return null;
  const context = safety.local_context ?? {};
  return {
    review_id: safety.review_identity?.review_id ?? null,
    school_or_organization: context.school_or_organization ?? null,
    site_description: context.site_description ?? null,
    planned_activity_date: context.planned_activity_date ?? null,
    approved_group_size: context.group_size ?? null,
    approved_adult_supervision_count: context.adult_supervision_count ?? null,
    approved_delivery_site_category: context.delivery_site_category ?? null,
    approved_indoor_fallback_permitted: context.indoor_fallback_permitted ?? null,
    approved_weather_limitations: context.weather_limitations ?? null,
    approved_accessibility_adjustments: context.accessibility_adjustments ?? null,
    approved_permission_requirements: context.permission_requirements ?? null,
    approved_emergency_contact_process: context.emergency_contact_process ?? null,
    approved_conditions: [...(safety.decision?.conditions ?? [])],
  };
}

function validateSafetyContext(diagnostics, entry, safety) {
  const data = entry.data;
  const context = data.classroom_context ?? {};
  if (!safety) return false;
  const approved = safety.local_context ?? {};
  const expectedSnapshot = expectedSafetyContextSnapshot(safety);
  const diagnosticCount = diagnostics.length;

  validateExact(
    diagnostics,
    entry.file,
    '/classroom_context/safety_context_snapshot',
    context.safety_context_snapshot,
    expectedSnapshot,
    'trial must preserve an immutable exact snapshot of the registered local-safety context and conditions',
  );
  if (context.named_context_reference !== safety.review_identity?.review_id) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/named_context_reference', 'named trial context must match the registered local-safety review ID'));
  }
  if (data.trial_identity?.trial_date !== approved.planned_activity_date) {
    diagnostics.push(diagnostic(entry.file, '/trial_identity/trial_date', 'trial date must equal the approved local-safety activity date'));
  }
  if (!Number.isInteger(context.group_size)) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/group_size', 'analysed trial requires an aggregate group size'));
  } else if (context.group_size > approved.group_size) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/group_size', 'trial group size cannot exceed the approved local-safety group size'));
  }
  if (!Number.isInteger(context.adult_supervision_count)) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/adult_supervision_count', 'analysed trial requires an aggregate adult supervision count'));
  } else if (context.adult_supervision_count < approved.adult_supervision_count) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/adult_supervision_count', 'trial adult supervision cannot be lower than the approved local-safety minimum'));
  }
  for (const [field, reason] of [
    ['school_or_organization', 'trial school or organization must equal the approved named safety context'],
    ['site_description', 'trial site must equal the approved named safety site'],
    ['delivery_site_category', 'trial delivery site category must equal the approved safety context'],
    ['accessibility_adjustments', 'trial accessibility adjustments must exactly preserve the approved setup'],
  ]) {
    if (context[field] !== approved[field]) diagnostics.push(diagnostic(entry.file, `/classroom_context/${field}`, reason));
  }
  if (context.weather_or_indoor_fallback_used === true && approved.indoor_fallback_permitted !== true) {
    diagnostics.push(diagnostic(entry.file, '/classroom_context/weather_or_indoor_fallback_used', 'indoor fallback or weather adaptation was not permitted by the local-safety review'));
  }
  if (data.aggregate_observations?.indoor_fallback_used !== context.weather_or_indoor_fallback_used) {
    diagnostics.push(diagnostic(entry.file, '/aggregate_observations/indoor_fallback_used', 'aggregate fallback use must equal the recorded classroom safety context'));
  }
  const conditions = [...new Set([
    approved.weather_limitations,
    ...(safety.decision?.conditions ?? []),
  ].filter(Boolean))];
  const confirmations = context.safety_condition_confirmations ?? [];
  validateExact(
    diagnostics,
    entry.file,
    '/classroom_context/safety_condition_confirmations/condition',
    confirmations.map(({ condition }) => condition),
    conditions,
    'trial must explicitly acknowledge every local-safety approval condition in source order',
  );
  for (const [index, confirmation] of confirmations.entries()) {
    if (confirmation.confirmed !== true) {
      diagnostics.push(diagnostic(entry.file, `/classroom_context/safety_condition_confirmations/${index}/confirmed`, 'every local-safety approval condition must be explicitly confirmed for the trial'));
    }
  }
  return diagnostics.length === diagnosticCount;
}

function validatePrerequisites(diagnostics, entry, reviewRepository) {
  const data = entry.data;
  const teacher = reviewRepository.completedTeacherReviews.find(({ file }) => file === data.prerequisites?.teacher_review_record_path)?.data;
  const safety = reviewRepository.completedSafetyReviews.find(({ file }) => file === data.prerequisites?.local_safety_review_record_path)?.data;
  const teacherApproved = ['approved', 'approved_with_nonblocking_changes'].includes(teacher?.decision?.status);
  const safetyApproved = ['approved_for_named_context', 'approved_with_conditions'].includes(safety?.decision?.status);
  const teacherCurrent = teacher?.artifact_identity?.content_fingerprint === FINGERPRINT && teacher?.decision?.reviewed_fingerprint_matches === true;
  const safetyCurrent = safety?.artifact_identity?.content_fingerprint === FINGERPRINT && safety?.decision?.reviewed_fingerprint_matches === true;
  const currentFingerprintMatches = teacherCurrent && safetyCurrent && data.artifact_identity?.content_fingerprint === FINGERPRINT;
  const safetyContextMatches = validateSafetyContext(diagnostics, entry, safety);
  if (!teacher) diagnostics.push(diagnostic(entry.file, '/prerequisites/teacher_review_record_path', 'trial requires a registered completed teacher-review record'));
  if (!teacherApproved) diagnostics.push(diagnostic(entry.file, '/prerequisites/teacher_review_status', 'teacher review must be approved or approved_with_nonblocking_changes'));
  if (!safety) diagnostics.push(diagnostic(entry.file, '/prerequisites/local_safety_review_record_path', 'trial requires a registered completed local-safety-review record'));
  if (!safetyApproved) diagnostics.push(diagnostic(entry.file, '/prerequisites/local_safety_review_status', 'local safety review must be approved for the named context or approved with conditions'));
  if (!currentFingerprintMatches) diagnostics.push(diagnostic(entry.file, '/prerequisites/current_fingerprint_matches', 'teacher, safety and trial evidence must match the current material fingerprint'));
  const satisfied = teacherApproved && safetyApproved && currentFingerprintMatches && safetyContextMatches;
  if (data.prerequisites?.teacher_review_status !== teacher?.decision?.status) diagnostics.push(diagnostic(entry.file, '/prerequisites/teacher_review_status', 'teacher-review status must match the registered prerequisite record'));
  if (data.prerequisites?.local_safety_review_status !== safety?.decision?.status) diagnostics.push(diagnostic(entry.file, '/prerequisites/local_safety_review_status', 'safety-review status must match the registered prerequisite record'));
  if (data.prerequisites?.current_fingerprint_matches !== currentFingerprintMatches) diagnostics.push(diagnostic(entry.file, '/prerequisites/current_fingerprint_matches', 'fingerprint match must be derived independently from the current teacher, safety and trial evidence'));
  if (data.prerequisites?.prerequisites_satisfied !== satisfied) diagnostics.push(diagnostic(entry.file, '/prerequisites/prerequisites_satisfied', 'prerequisite satisfaction must be derived from approved reviews, current fingerprints and exact safety-context comparison'));
  return satisfied;
}

function validateCompletedTrial(diagnostics, entry, reviewRepository) {
  const data = entry.data;
  if (data.template !== false) diagnostics.push(diagnostic(entry.file, '/template', 'registered classroom-trial record must set template: false'));
  for (const field of ['trial_id', 'facilitator_reference', 'anonymized_group_reference', 'trial_date', 'analysis_date']) {
    if (!data.trial_identity?.[field]) diagnostics.push(diagnostic(entry.file, `/trial_identity/${field}`, 'analysed record requires opaque identity references and dates'));
  }
  validateExact(diagnostics, entry.file, '/artifact_identity', data.artifact_identity, EXACT_IDENTITY, 'trial must match the exact pilot identity and current fingerprint');
  validateParts(diagnostics, entry);
  validatePrivacyText(diagnostics, entry);
  if (data.lifecycle?.status !== 'analysed') diagnostics.push(diagnostic(entry.file, '/lifecycle/status', 'registered completed records must remain immutable analysed records; historical state is derived from inbound supersession links'));
  if (data.decision?.status === 'pending') diagnostics.push(diagnostic(entry.file, '/decision/status', 'registered completed trial decision cannot remain pending'));
  const prerequisiteSatisfied = validatePrerequisites(diagnostics, entry, reviewRepository);
  const privacyComplete = data.privacy?.aggregate_observations_only === true
    && data.privacy?.no_learner_names_or_identifiers === true
    && data.privacy?.manual_privacy_review_complete === true
    && data.privacy?.free_text_privacy_review_complete === true
    && data.privacy?.recordings_collected === false
    && data.privacy?.identifiable_media_collected === false;
  if (!privacyComplete) diagnostics.push(diagnostic(entry.file, '/privacy', 'analysed trial requires complete aggregate-only privacy attestations and no recordings or identifiable media'));
  for (const [index, part] of (data.part_observations ?? []).entries()) {
    if (part.actual_duration_minutes === null) diagnostics.push(diagnostic(entry.file, `/part_observations/${index}/actual_duration_minutes`, 'analysed trial requires actual duration for both parts'));
  }
  for (const [field, value] of Object.entries(data.aggregate_observations ?? {})) {
    if (field !== 'general_notes' && value === null) diagnostics.push(diagnostic(entry.file, `/aggregate_observations/${field}`, 'analysed trial requires complete aggregate observations'));
  }
  const findingState = validateFindings(diagnostics, entry);
  const statuses = (data.part_observations ?? []).flatMap((part) => (part.dimensions ?? []).map(({ status }) => status));
  const positive = ['successful', 'successful_with_notes'].includes(data.decision?.status);
  if (positive) {
    if (data.lifecycle?.status !== 'analysed') diagnostics.push(diagnostic(entry.file, '/lifecycle/status', 'only an active analysed record can support a positive decision'));
    if (!prerequisiteSatisfied || !privacyComplete) diagnostics.push(diagnostic(entry.file, '/decision/status', 'positive decision requires current prerequisites and complete privacy review'));
    if (statuses.includes('not_observed') || statuses.includes('not_met')) diagnostics.push(diagnostic(entry.file, '/decision/status', 'positive decision cannot hide not_observed or not_met dimensions'));
    if (data.decision.status === 'successful' && statuses.some((status) => status !== 'met')) diagnostics.push(diagnostic(entry.file, '/decision/status', 'successful requires every required dimension to be met'));
    if (findingState.openBlocking.length > 0 || findingState.openMajor.length > 0) diagnostics.push(diagnostic(entry.file, '/decision/status', 'positive decision cannot coexist with open major or blocking findings'));
    if (findingState.openRequired.length > 0 || data.decision.required_changes_complete !== true) diagnostics.push(diagnostic(entry.file, '/decision/required_changes_complete', 'positive decision requires all required changes to be complete'));
    if (data.decision.reviewed_fingerprint_matches !== true) diagnostics.push(diagnostic(entry.file, '/decision/reviewed_fingerprint_matches', 'positive decision must confirm the current fingerprint'));
    if (data.decision.safe_to_repeat !== true) diagnostics.push(diagnostic(entry.file, '/decision/safe_to_repeat', 'positive decision requires safe_to_repeat: true'));
  }
  if (data.decision?.status === 'repeat_trial_required') {
    if (data.lifecycle?.status !== 'analysed' || !data.decision.rationale) diagnostics.push(diagnostic(entry.file, '/decision', 'repeat_trial_required requires an analysed record and rationale'));
    if (data.decision.safe_to_repeat !== false) diagnostics.push(diagnostic(entry.file, '/decision/safe_to_repeat', 'repeat_trial_required requires safe_to_repeat: false'));
  }
  if (data.decision?.status === 'unsuccessful' && (data.lifecycle?.status !== 'analysed' || !data.decision.rationale)) diagnostics.push(diagnostic(entry.file, '/decision', 'unsuccessful requires an analysed record and rationale'));
  if (data.boundaries?.effectiveness_claimed !== false || data.boundaries?.publication_ready !== false || data.boundaries?.source_gap_resolution_claimed !== false || data.boundaries?.canonical_opiq_gap_status_unchanged !== true) diagnostics.push(diagnostic(entry.file, '/boundaries', 'trial cannot promote effectiveness, publication, gap resolution or canonical Opiq coverage'));
}

export function validateTeacherWorkPlanArtifactClassroomTrialRepository(repository, {
  allowCompletedRecords = false,
} = {}) {
  const diagnostics = [...(repository.loadDiagnostics ?? [])];
  const reusableValidation = validateTeacherWorkPlanReusableArtifactRepository(repository.reusableRepository);
  for (const problem of reusableValidation.diagnostics) {
    if (allowCompletedRecords && (problem.file === REVIEW_REGISTRY_PATH || (problem.file === ARTIFACT_INDEX_PATH && problem.field === '/human_review'))) continue;
    diagnostics.push(diagnostic(problem.file, problem.field, `reusable-artifact dependency: ${problem.reason}`));
  }
  const reviewValidation = validateTeacherWorkPlanArtifactReviewRepository(repository.reviewRepository, { allowCompletedRecords });
  for (const problem of reviewValidation.diagnostics) diagnostics.push(diagnostic(problem.file, problem.field, `artifact-review dependency: ${problem.reason}`));

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, validateFormats: false });
  const validate = ajv.compile(repository.schema);
  validateSchema(diagnostics, validate, repository.trialTemplate);
  for (const entry of repository.completedTrials) validateSchema(diagnostics, validate, entry);

  if (!repository.trialTemplate) diagnostics.push(diagnostic(CLASSROOM_TRIAL_TEMPLATE_PATH, '/', 'exact classroom-trial template is missing'));
  else {
    validateTemplate(diagnostics, repository.trialTemplate);
    validateParts(diagnostics, repository.trialTemplate);
  }
  const registry = repository.reviewRepository.registry?.data;
  if (registry?.classroom_trial?.template_path !== CLASSROOM_TRIAL_TEMPLATE_PATH) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/classroom_trial/template_path', 'registry must link the exact classroom-trial template'));
  const registeredPaths = registry?.classroom_trial?.completed_record_paths ?? [];
  validateExact(diagnostics, REVIEW_REGISTRY_PATH, '/classroom_trial/completed_record_paths', repository.completedTrials.map(({ file }) => file), registeredPaths, 'every registered classroom-trial record must load exactly once');
  if (!allowCompletedRecords && registeredPaths.length !== 0) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/classroom_trial/completed_record_paths', 'production registry must contain no completed classroom-trial record without actual evidence'));
  for (const entry of repository.completedTrials) validateCompletedTrial(diagnostics, entry, repository.reviewRepository);
  const lifecycle = resolveTeacherWorkPlanClassroomTrialLifecycle(repository.completedTrials);
  const active = lifecycle.activeEntry?.data;
  const expectedStatus = active?.decision?.status ?? 'not_tested';
  if (registry?.classroom_trial?.status !== expectedStatus) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/classroom_trial/status', 'classroom-trial status must be derived from the active analysed record'));
  if (registry?.boundaries?.classroom_trial_complete !== Boolean(active)) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/classroom_trial_complete', 'classroom-trial completion must reflect a registered analysed record'));
  const expectedReady = ['successful', 'successful_with_notes'].includes(expectedStatus);
  if (registry?.boundaries?.classroom_ready !== expectedReady) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries/classroom_ready', 'classroom readiness cannot be promoted without valid positive analysed evidence'));
  if (registry?.boundaries?.effectiveness_claimed !== false || registry?.boundaries?.publication_ready !== false) diagnostics.push(diagnostic(REVIEW_REGISTRY_PATH, '/boundaries', 'classroom-trial workflow cannot claim effectiveness or publication readiness'));

  if (repository.guideText === null) diagnostics.push(diagnostic(CLASSROOM_TRIAL_GUIDE_PATH, '/', 'classroom-trial guide is missing'));
  else {
    if (!repository.guideText.endsWith('\n')) diagnostics.push(diagnostic(CLASSROOM_TRIAL_GUIDE_PATH, '/', 'classroom-trial guide must end with a newline'));
    for (const heading of GUIDE_HEADINGS) if (!repository.guideText.includes(heading)) diagnostics.push(diagnostic(CLASSROOM_TRIAL_GUIDE_PATH, '/', `classroom-trial guide is missing ${heading}`));
    for (const statement of [
      'This pull request does not conduct a trial.',
      'The template is a workflow aid, not human evidence',
      'A trial must not begin until',
      'Do not commit learner or facilitator names',
      'does not make either canonical Opiq gap `matched` or `partial`',
      'does not prove comparative effectiveness',
    ]) if (!repository.guideText.includes(statement)) diagnostics.push(diagnostic(CLASSROOM_TRIAL_GUIDE_PATH, '/', `classroom-trial guide is missing boundary statement: ${statement}`));
  }

  const artifact = repository.reusableRepository.artifacts?.[0]?.data;
  if (artifact?.content_fingerprint?.value !== FINGERPRINT) diagnostics.push(diagnostic(ARTIFACT_INDEX_PATH, '/content_fingerprint/value', 'classroom-trial workflow must pin the unchanged material fingerprint'));
  if (!allowCompletedRecords) {
    validateExact(diagnostics, ARTIFACT_INDEX_PATH, '/human_review/classroom_trial', artifact?.human_review?.classroom_trial, {
      workflow_created: true,
      template_path: CLASSROOM_TRIAL_TEMPLATE_PATH,
      status: 'not_tested',
      completed_record_path: null,
    }, 'artifact index must link the untested trial workflow without claiming completed evidence');
    if (artifact?.readiness?.classroom_trial?.status !== 'not_tested' || artifact?.readiness?.classroom_ready !== false || artifact?.readiness?.publication_ready !== false || artifact?.readiness?.effectiveness_claimed !== false) diagnostics.push(diagnostic(ARTIFACT_INDEX_PATH, '/readiness', 'workflow creation cannot promote classroom, publication or effectiveness readiness'));
  }

  diagnostics.sort((a, b) => compareBytewise(`${a.file}\0${a.field}\0${a.reason}`, `${b.file}\0${b.field}\0${b.reason}`));
  return {
    diagnostics,
    summary: {
      trial_templates: repository.trialTemplate ? 1 : 0,
      registered_analysed_trial_records: repository.completedTrials.filter(({ data }) => data.lifecycle?.status === 'analysed').length,
      classroom_trial_status: registry?.classroom_trial?.status ?? null,
      prerequisites_satisfied: active?.prerequisites?.prerequisites_satisfied ?? false,
      teacher_review: registry?.teacher_review?.status ?? null,
      local_safety_review: registry?.local_safety_review?.status ?? null,
      fingerprint_current: artifact?.content_fingerprint?.value === FINGERPRINT,
      fingerprint: artifact?.content_fingerprint?.value ?? null,
    },
  };
}

export function formatTeacherWorkPlanArtifactClassroomTrialDiagnostic(problem) {
  return `${problem.file}: ${problem.field}: ${problem.reason}`;
}
