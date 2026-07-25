import fs from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import path from 'node:path';
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
import {
  computeTeacherPackFingerprintFromRepository,
} from './teacher-pack-fingerprints.mjs';
import {
  assertPedagogicalEvidencePrivacy,
  buildPedagogicalEvidenceIdentity,
  createPedagogicalEvidenceValidators,
  pedagogicalEvidenceIdentityMatches,
  pedagogicalEvidenceIdentityMismatches,
  schemaValidationMessages,
} from './pedagogical-evidence.mjs';

const APPROVED_REVIEW_DECISIONS = new Set(['approved', 'approved_with_minor_notes']);
const SUCCESSFUL_TRIAL_DECISIONS = new Set(['successful', 'successful_with_notes']);
const OPEN_STATUSES = new Set(['open', 'planned']);
const REVIEW_SCOPE_FLAGS = [
  'teacher_guide',
  'student_materials',
  'answer_keys',
  'assessment_rubric',
  'safety',
  'language_level',
  'lesson_dna',
  'selection_and_adaptation_artifacts',
];

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort(compareBytewise);
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
    if (seen.has(value)) {
      diagnostics.push(makeDiagnostic('error', file, field, `duplicate ${label}: ${value}`));
    }
    seen.add(value);
  }
}

async function loadYamlArtifact(rootDir, repositoryPath, kind) {
  let file = repositoryPath ?? '<missing>';
  try {
    const resolved = safeRepositoryPath(rootDir, repositoryPath, `${kind} path`);
    file = relativeDisplay(rootDir, resolved);
    return {
      file,
      data: parseStrictCurriculumYaml(await fs.readFile(resolved, 'utf8'), file),
      kind,
    };
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

function recordKind(artifact) {
  return artifact?.data?.artifact_type === 'teacher_review'
    ? 'teacher-review'
    : artifact?.data?.artifact_type === 'classroom_trial'
      ? 'classroom-trial'
      : artifact?.data?.artifact_type === 'home_trial'
        ? 'home-trial'
        : null;
}

function recordStatusComplete(artifact) {
  if (artifact?.data?.artifact_type === 'teacher_review') {
    return artifact.data.review_status === 'completed';
  }
  return artifact?.data?.trial_status === 'analysed';
}

function recordSuperseded(artifact) {
  return artifact?.data?.review_status === 'superseded'
    || artifact?.data?.trial_status === 'superseded';
}

export async function loadPedagogicalReviewRepository({
  rootDir = process.cwd(),
  identityCommitSha = null,
} = {}) {
  const teacherPacks = await loadTeacherPackRepository({ rootDir });
  const absoluteRoot = teacherPacks.rootDir;
  const schemaBundle = await createPedagogicalEvidenceValidators(absoluteRoot);
  const reviewTemplates = [];
  const trialTemplates = [];
  const homeTrialTemplates = [];
  const reviewRecords = [];
  const trialRecords = [];
  const homeTrialRecords = [];
  const workflowDocuments = [];
  const currentPackFingerprints = {};
  const currentEvidenceIdentities = {};
  const currentEvidenceCheckedArtifacts = {};
  const packIdentityErrors = {};
  for (const index of teacherPacks.indexes) {
    const reviewLink = index.data.pedagogical_review ?? {};
    const trialLink = index.data.classroom_trial ?? {};
    const homeLink = index.data.home_trial ?? {};
    if (reviewLink.template_path) {
      reviewTemplates.push(await loadYamlArtifact(
        absoluteRoot,
        reviewLink.template_path,
        'teacher-review template',
      ));
    }
    if (trialLink.template_path) {
      trialTemplates.push(await loadYamlArtifact(
        absoluteRoot,
        trialLink.template_path,
        'classroom-trial template',
      ));
    }
    if (homeLink.template_path) {
      homeTrialTemplates.push(await loadYamlArtifact(
        absoluteRoot,
        homeLink.template_path,
        'home-trial template',
      ));
    }
    if (reviewLink.guide_path) {
      workflowDocuments.push(await loadRequiredDocument(
        absoluteRoot,
        reviewLink.guide_path,
        'pedagogical review guide',
      ));
    }
    for (const reviewPath of reviewLink.review_record_paths ?? []) {
      reviewRecords.push(await loadYamlArtifact(
        absoluteRoot,
        reviewPath,
        'teacher-review record',
      ));
    }
    for (const trialPath of trialLink.trial_record_paths ?? []) {
      trialRecords.push(await loadYamlArtifact(
        absoluteRoot,
        trialPath,
        'classroom-trial record',
      ));
    }
    for (const trialPath of homeLink.trial_record_paths ?? []) {
      homeTrialRecords.push(await loadYamlArtifact(
        absoluteRoot,
        trialPath,
        'home-trial record',
      ));
    }
    currentPackFingerprints[index.data.pack_id] =
      await computeTeacherPackFingerprintFromRepository(teacherPacks, index);
    try {
      const evidenceIdentity = await buildPedagogicalEvidenceIdentity({
        rootDir: absoluteRoot,
        packPath: index.file,
        commitSha: identityCommitSha,
        teacherPackRepository: teacherPacks,
      });
      currentEvidenceIdentities[index.data.pack_id] = evidenceIdentity.identity;
      currentEvidenceCheckedArtifacts[index.data.pack_id] =
        evidenceIdentity.checked_artifacts;
    } catch (error) {
      packIdentityErrors[index.data.pack_id] = error;
    }
  }
  return {
    rootDir: absoluteRoot,
    teacherPacks,
    schemas: schemaBundle.schemas,
    validators: schemaBundle.validators,
    reviewTemplates,
    trialTemplates,
    homeTrialTemplates,
    reviewRecords,
    trialRecords,
    homeTrialRecords,
    workflowDocuments,
    currentPackFingerprints,
    currentEvidenceIdentities,
    currentEvidenceCheckedArtifacts,
    packIdentityErrors,
    loadedArtifactPaths: uniqueSorted([
      ...(teacherPacks.loadedArtifactPaths ?? []),
      ...Object.values(schemaBundle.schemas).map((schema) => {
        const id = schema.$id.split('/').at(-1);
        return `schemas/${id}`;
      }),
      ...reviewTemplates.map((artifact) => artifact.file),
      ...trialTemplates.map((artifact) => artifact.file),
      ...homeTrialTemplates.map((artifact) => artifact.file),
      ...reviewRecords.map((artifact) => artifact.file),
      ...trialRecords.map((artifact) => artifact.file),
      ...homeTrialRecords.map((artifact) => artifact.file),
      ...workflowDocuments.map((artifact) => artifact.file),
    ]),
  };
}

function addSchemaDiagnostics(diagnostics, artifact, validator) {
  if (artifact.loadError) {
    diagnostics.push(makeDiagnostic('error', artifact.file, '/', artifact.loadError));
    return false;
  }
  if (validator(artifact.data)) return true;
  for (const message of schemaValidationMessages(validator)) {
    const separator = message.indexOf(': ');
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      separator > 0 ? message.slice(0, separator) : '/',
      separator > 0 ? message.slice(separator + 2) : message,
    ));
  }
  return false;
}

function validateTemplateSemantics(diagnostics, artifact) {
  if (!artifact.data) return;
  const kind = recordKind(artifact);
  const draft = kind === 'teacher-review'
    ? artifact.data.review_status === 'draft'
    : artifact.data.trial_status === 'draft';
  const date = kind === 'teacher-review'
    ? artifact.data.reviewed_at
    : artifact.data.conducted_at;
  if (
    !draft
    || artifact.data.evidence_identity !== null
    || artifact.data.decision?.status !== 'pending'
    || date !== null
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/',
      `${kind} template must remain an uncompleted draft with null evidence identity`,
    ));
  }
}

export function pedagogicalEvidenceFingerprintMatches(recorded, current) {
  return recorded?.algorithm === current?.algorithm
    && recorded?.specification_version === current?.specification_version
    && recorded?.value === current?.value
    && recorded?.file_count === current?.file_count;
}

function validateIdentity(
  diagnostics,
  artifact,
  currentIdentity,
  { complete, requireEffective },
) {
  const recorded = artifact.data?.evidence_identity;
  if (!complete && recorded === null) return { current: false, stale: false };
  if (!recorded) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/evidence_identity',
      'completed human evidence requires the current content and pedagogical identity',
    ));
    return { current: false, stale: complete };
  }
  if (!currentIdentity) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/evidence_identity/pedagogical_snapshot',
      'this teacher pack has no integrated pedagogical snapshot',
    ));
    return { current: false, stale: complete };
  }
  const current = pedagogicalEvidenceIdentityMatches(recorded, currentIdentity);
  const stale = complete && !current;
  if (stale) {
    const mismatches = pedagogicalEvidenceIdentityMismatches(recorded, currentIdentity);
    diagnostics.push(makeDiagnostic(
      requireEffective ? 'error' : 'warning',
      artifact.file,
      '/evidence_identity',
      `human evidence is stale: ${mismatches.map((item) => item.field).join(', ')}`,
    ));
  }
  return { current, stale };
}

function validateReferences(
  diagnostics,
  context,
  artifact,
  pack,
  lessonIds,
) {
  const knownLessons = new Set(lessonIds);
  const findings = artifact.data?.findings ?? [];
  for (const [index, finding] of findings.entries()) {
    for (const lessonId of finding.lesson_ids ?? []) {
      if (!knownLessons.has(lessonId)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/findings/${index}/lesson_ids`,
          `unknown lesson ID ${lessonId}`,
        ));
      }
    }
    for (const repositoryPath of finding.artifact_paths ?? []) {
      try {
        const absolute = safeRepositoryPath(
          context.rootDir,
          repositoryPath,
          'evidence finding artifact path',
        );
        const stat = lstatSync(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a regular file');
      } catch (error) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/findings/${index}/artifact_paths`,
          `unresolved finding artifact ${repositoryPath}: ${error.message}`,
        ));
      }
    }
  }
  if (artifact.data?.pack_ref !== pack.pack_id) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/pack_ref',
      `expected ${pack.pack_id}`,
    ));
  }
}

function validateFindingSemantics(diagnostics, artifact) {
  const findings = artifact.data?.findings ?? [];
  addDuplicates(
    diagnostics,
    findings.map((finding) => finding.finding_id),
    artifact.file,
    '/findings',
    'finding ID',
  );
  const openBlockingOrMajor = findings.filter((finding) => (
    ['blocking', 'major'].includes(finding.severity)
    && OPEN_STATUSES.has(finding.resolution_status)
  ));
  const openSafety = findings.filter((finding) => (
    finding.category === 'safety'
    && OPEN_STATUSES.has(finding.resolution_status)
  ));
  return { findings, openBlockingOrMajor, openSafety };
}

function validateReviewRecord(
  diagnostics,
  context,
  artifact,
  pack,
  currentIdentity,
  lessonIds,
  schemaValid,
  { requireScope = null } = {},
) {
  const review = artifact.data;
  const initialErrorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  if (!review || !schemaValid) {
    return {
      effective: false,
      stale: false,
      deliveryScopes: [],
      openBlockingOrMajor: [],
      unresolvedChanges: [],
    };
  }
  validateReferences(diagnostics, context, artifact, pack, lessonIds);
  const complete = review.review_status === 'completed';
  const identity = validateIdentity(
    diagnostics,
    artifact,
    currentIdentity,
    { complete, requireEffective: requireScope !== null },
  );
  if (complete && !validDate(review.reviewed_at)) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/reviewed_at',
      'completed teacher review requires a valid explicit date',
    ));
  }
  if (complete && !normalize(review.reviewer?.role)) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/reviewer/role',
      'completed teacher review requires a reviewer role',
    ));
  }
  if (complete && (review.delivery_scopes ?? []).length === 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/delivery_scopes',
      'completed teacher review requires classroom and/or homeschool scope',
    ));
  }
  if (requireScope && !(review.delivery_scopes ?? []).includes(requireScope)) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/delivery_scopes',
      `effective review must cover ${requireScope}`,
    ));
  }
  if (complete) {
    for (const field of REVIEW_SCOPE_FLAGS) {
      if (review.review_scope?.[field] !== true) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/review_scope/${field}`,
          `completed teacher review must cover ${field}`,
        ));
      }
    }
    if ((review.delivery_scopes ?? []).includes('homeschool')
      && review.review_scope?.homeschool_materials !== true) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        '/review_scope/homeschool_materials',
        'homeschool review scope requires homeschool materials',
      ));
    }
    if (!sameSet(review.review_scope?.lesson_guides, lessonIds)) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        '/review_scope/lesson_guides',
        'completed teacher review must cover every linked lesson',
      ));
    }
    for (const [field, rating] of Object.entries(review.ratings ?? {})) {
      if (!Number.isInteger(rating)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/ratings/${field}`,
          'completed teacher review requires every pedagogical rating',
        ));
      }
    }
    try {
      assertPedagogicalEvidencePrivacy(review);
    } catch (error) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/privacy', error.message));
    }
  }
  const findingState = validateFindingSemantics(diagnostics, artifact);
  const expectedBlocking = findingState.findings
    .filter((finding) => finding.severity === 'blocking')
    .map((finding) => finding.finding_id);
  if (!sameSet(review.blocking_findings, expectedBlocking)) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/blocking_findings',
      'must exactly list blocking findings',
    ));
  }
  const findingIds = new Set(findingState.findings.map((finding) => finding.finding_id));
  addDuplicates(
    diagnostics,
    (review.required_changes ?? []).map((change) => change.change_id),
    artifact.file,
    '/required_changes',
    'required change ID',
  );
  for (const [index, change] of (review.required_changes ?? []).entries()) {
    for (const findingId of change.finding_refs ?? []) {
      if (!findingIds.has(findingId)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/required_changes/${index}/finding_refs`,
          `unknown finding ${findingId}`,
        ));
      }
    }
  }
  const unresolvedChanges = (review.required_changes ?? []).filter(
    (change) => OPEN_STATUSES.has(change.resolution_status),
  );
  const approved = APPROVED_REVIEW_DECISIONS.has(review.decision?.status);
  if (approved && findingState.openBlockingOrMajor.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      'approved review cannot retain open blocking or major findings',
    ));
  }
  let minorPlansValid = true;
  if (review.decision?.status === 'approved') {
    minorPlansValid = unresolvedChanges.length === 0;
  } else if (review.decision?.status === 'approved_with_minor_notes') {
    minorPlansValid = unresolvedChanges.every((change) => {
      const related = change.finding_refs
        .map((id) => findingState.findings.find((finding) => finding.finding_id === id))
        .filter(Boolean);
      return change.resolution_status === 'planned'
        && change.resolution_refs.length > 0
        && related.length > 0
        && related.every((finding) => finding.severity === 'minor');
    });
  }
  if (approved && !minorPlansValid) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/required_changes',
      'approval requires closed changes or bounded minor plans with references',
    ));
  }
  const effective = complete
    && diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    ).length === initialErrorCount
    && !recordSuperseded(artifact)
    && identity.current
    && validDate(review.reviewed_at)
    && (review.delivery_scopes ?? []).length > 0
    && REVIEW_SCOPE_FLAGS.every((field) => review.review_scope?.[field] === true)
    && sameSet(review.review_scope?.lesson_guides, lessonIds)
    && findingState.openBlockingOrMajor.length === 0
    && minorPlansValid
    && approved;
  return {
    effective,
    stale: identity.stale,
    deliveryScopes: review.delivery_scopes ?? [],
    openBlockingOrMajor: findingState.openBlockingOrMajor,
    openSafety: findingState.openSafety,
    unresolvedChanges,
  };
}

function validateTrialRecord(
  diagnostics,
  context,
  artifact,
  pack,
  currentIdentity,
  lessonIds,
  schemaValid,
  kind,
  { requireSuccess = false } = {},
) {
  const trial = artifact.data;
  const initialErrorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  if (!trial || !schemaValid) {
    return {
      effective: false,
      stale: false,
      openBlockingOrMajor: [],
      openSafety: [],
      parentRoleBounded: kind === 'classroom-trial',
    };
  }
  validateReferences(diagnostics, context, artifact, pack, lessonIds);
  const analysed = trial.trial_status === 'analysed';
  const identity = validateIdentity(
    diagnostics,
    artifact,
    currentIdentity,
    { complete: analysed, requireEffective: requireSuccess },
  );
  if (analysed && !validDate(trial.conducted_at)) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/conducted_at',
      `analysed ${kind} requires a valid explicit date`,
    ));
  }
  const knownLessons = new Set(lessonIds);
  if (analysed && (trial.context?.lesson_ids ?? []).length === 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/context/lesson_ids',
      `analysed ${kind} requires at least one lesson ID`,
    ));
  }
  for (const lessonId of trial.context?.lesson_ids ?? []) {
    if (!knownLessons.has(lessonId)) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        '/context/lesson_ids',
        `unknown linked lesson ${lessonId}`,
      ));
    }
  }
  if (analysed) {
    try {
      assertPedagogicalEvidencePrivacy(trial);
    } catch (error) {
      diagnostics.push(makeDiagnostic('error', artifact.file, '/privacy', error.message));
    }
  }
  const findingState = validateFindingSemantics(diagnostics, artifact);
  const successful = SUCCESSFUL_TRIAL_DECISIONS.has(trial.decision?.status);
  if (successful && findingState.openBlockingOrMajor.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful ${kind} cannot retain open blocking or major findings`,
    ));
  }
  if (successful && findingState.openSafety.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful ${kind} cannot retain open safety findings`,
    ));
  }
  const parentRoleBounded = kind === 'classroom-trial'
    || trial.decision?.parent_role_remained_bounded === true;
  if (kind === 'home-trial' && successful && !parentRoleBounded) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/parent_role_remained_bounded',
      'successful home trial requires a bounded parent/adult role',
    ));
  }
  const effective = analysed
    && diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    ).length === initialErrorCount
    && !recordSuperseded(artifact)
    && identity.current
    && validDate(trial.conducted_at)
    && (trial.context?.lesson_ids ?? []).length > 0
    && (trial.context?.lesson_ids ?? []).every((lessonId) => knownLessons.has(lessonId))
    && findingState.openBlockingOrMajor.length === 0
    && findingState.openSafety.length === 0
    && parentRoleBounded
    && successful;
  return {
    effective,
    stale: identity.stale,
    openBlockingOrMajor: findingState.openBlockingOrMajor,
    openSafety: findingState.openSafety,
    parentRoleBounded,
  };
}

function summarizePack(context, index, diagnostics = []) {
  const pack = index.data;
  const lessonIds = pack.lesson_ids ?? [];
  const currentIdentity = context.currentEvidenceIdentities[pack.pack_id] ?? null;
  const linkedReviews = context.reviewRecords.filter(
    (record) => (pack.pedagogical_review?.review_record_paths ?? []).includes(record.file),
  );
  const linkedClassroomTrials = context.trialRecords.filter(
    (record) => (pack.classroom_trial?.trial_record_paths ?? []).includes(record.file),
  );
  const linkedHomeTrials = context.homeTrialRecords.filter(
    (record) => (pack.home_trial?.trial_record_paths ?? []).includes(record.file),
  );
  const reviewStates = [];
  for (const record of linkedReviews) {
    const schemaValid = addSchemaDiagnostics(
      diagnostics,
      record,
      context.validators['teacher-review'],
    );
    reviewStates.push(validateReviewRecord(
      diagnostics,
      context,
      record,
      pack,
      currentIdentity,
      lessonIds,
      schemaValid,
    ));
  }
  const classroomStates = [];
  for (const record of linkedClassroomTrials) {
    const schemaValid = addSchemaDiagnostics(
      diagnostics,
      record,
      context.validators['classroom-trial'],
    );
    classroomStates.push(validateTrialRecord(
      diagnostics,
      context,
      record,
      pack,
      currentIdentity,
      lessonIds,
      schemaValid,
      'classroom-trial',
    ));
  }
  const homeStates = [];
  for (const record of linkedHomeTrials) {
    const schemaValid = addSchemaDiagnostics(
      diagnostics,
      record,
      context.validators['home-trial'],
    );
    homeStates.push(validateTrialRecord(
      diagnostics,
      context,
      record,
      pack,
      currentIdentity,
      lessonIds,
      schemaValid,
      'home-trial',
    ));
  }
  return {
    current_fingerprint: currentIdentity?.content_fingerprint
      ?? context.currentPackFingerprints[pack.pack_id],
    current_pedagogical_snapshot: currentIdentity?.pedagogical_snapshot ?? null,
    completed_review_count: linkedReviews.filter(recordStatusComplete).length,
    analysed_trial_count: linkedClassroomTrials.filter(recordStatusComplete).length,
    analysed_home_trial_count: linkedHomeTrials.filter(recordStatusComplete).length,
    effective_teacher_review: reviewStates.some((state) => state.effective),
    effective_classroom_review: reviewStates.some(
      (state) => state.effective && state.deliveryScopes.includes('classroom'),
    ),
    effective_homeschool_review: reviewStates.some(
      (state) => state.effective && state.deliveryScopes.includes('homeschool'),
    ),
    effective_classroom_trial: classroomStates.some((state) => state.effective),
    effective_home_trial: homeStates.some((state) => state.effective),
    effective_teacher_review_count: reviewStates.filter((state) => state.effective).length,
    effective_classroom_review_count: reviewStates.filter(
      (state) => state.effective && state.deliveryScopes.includes('classroom'),
    ).length,
    effective_homeschool_review_count: reviewStates.filter(
      (state) => state.effective && state.deliveryScopes.includes('homeschool'),
    ).length,
    effective_classroom_trial_count: classroomStates.filter(
      (state) => state.effective,
    ).length,
    effective_home_trial_count: homeStates.filter((state) => state.effective).length,
    stale_teacher_review: reviewStates.some((state) => state.stale),
    stale_classroom_trial: classroomStates.some((state) => state.stale),
    stale_home_trial: homeStates.some((state) => state.stale),
    stale_teacher_review_count: reviewStates.filter((state) => state.stale).length,
    stale_classroom_trial_count: classroomStates.filter((state) => state.stale).length,
    stale_home_trial_count: homeStates.filter((state) => state.stale).length,
    parent_role_bounded: homeStates
      .filter((state) => state.effective)
      .every((state) => state.parentRoleBounded),
    open_review_findings: reviewStates.flatMap((state) => state.openBlockingOrMajor),
    unresolved_required_changes: reviewStates.flatMap(
      (state) => state.unresolvedChanges,
    ),
    open_classroom_safety_findings: classroomStates.flatMap(
      (state) => state.openSafety,
    ),
    open_home_safety_findings: homeStates.flatMap((state) => state.openSafety),
    evidence_paths: uniqueSorted([
      ...linkedReviews.map((record) => record.file),
      ...linkedClassroomTrials.map((record) => record.file),
      ...linkedHomeTrials.map((record) => record.file),
    ]),
    teacher_review_paths: uniqueSorted(linkedReviews.map((record) => record.file)),
    classroom_trial_paths: uniqueSorted(
      linkedClassroomTrials.map((record) => record.file),
    ),
    home_trial_paths: uniqueSorted(linkedHomeTrials.map((record) => record.file)),
    diagnostics,
  };
}

export function summarizePedagogicalEvidenceForPack(context, index) {
  return summarizePack(context, index, []);
}

export function validateStandalonePedagogicalEvidenceRecord(
  context,
  index,
  artifact,
  { requireEffective = false } = {},
) {
  const diagnostics = [];
  const kind = recordKind(artifact);
  const validator = context.validators[kind];
  if (!validator) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/artifact_type',
      `unsupported pedagogical evidence artifact type ${artifact.data?.artifact_type ?? '<missing>'}`,
    ));
    return { diagnostics, state: { effective: false, stale: false }, kind };
  }
  const schemaValid = addSchemaDiagnostics(diagnostics, artifact, validator);
  const currentIdentity = context.currentEvidenceIdentities[index.data.pack_id] ?? null;
  const lessonIds = index.data.lesson_ids ?? [];
  let state;
  if (kind === 'teacher-review') {
    state = validateReviewRecord(
      diagnostics,
      context,
      artifact,
      index.data,
      currentIdentity,
      lessonIds,
      schemaValid,
      {
        requireScope: requireEffective
          ? (artifact.data?.delivery_scopes?.[0] ?? 'classroom')
          : null,
      },
    );
  } else {
    state = validateTrialRecord(
      diagnostics,
      context,
      artifact,
      index.data,
      currentIdentity,
      lessonIds,
      schemaValid,
      kind,
      { requireSuccess: requireEffective },
    );
  }
  return { diagnostics, state, kind };
}

function validateLinkStatus(diagnostics, index, summary) {
  const pack = index.data;
  const reviewStatus = pack.pedagogical_review?.status;
  const classroomStatus = pack.classroom_trial?.status;
  const homeStatus = pack.home_trial?.status;
  if (reviewStatus === 'approved' && !summary.effective_teacher_review) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/pedagogical_review/status',
      'approved status requires current effective linked teacher review',
    ));
  }
  if (classroomStatus === 'tested' && !summary.effective_classroom_trial) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/classroom_trial/status',
      'tested status requires current effective linked classroom trial',
    ));
  }
  if (homeStatus === 'tested' && !summary.effective_home_trial) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/home_trial/status',
      'tested status requires current effective linked home trial',
    ));
  }
  if ((pack.pedagogical_review?.review_record_paths ?? []).includes(
    pack.pedagogical_review?.template_path,
  )) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/pedagogical_review/review_record_paths',
      'teacher-review template cannot be registered as evidence',
    ));
  }
  if ((pack.classroom_trial?.trial_record_paths ?? []).includes(
    pack.classroom_trial?.template_path,
  )) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/classroom_trial/trial_record_paths',
      'classroom-trial template cannot be registered as evidence',
    ));
  }
  if ((pack.home_trial?.trial_record_paths ?? []).includes(pack.home_trial?.template_path)) {
    diagnostics.push(makeDiagnostic(
      'error',
      index.file,
      '/home_trial/trial_record_paths',
      'home-trial template cannot be registered as evidence',
    ));
  }
  if (summary.completed_review_count === 0) {
    diagnostics.push(makeDiagnostic(
      'warning',
      index.file,
      '/pedagogical_review/status',
      'independent teacher review is pending; 0 completed records are registered',
    ));
  }
  if (summary.analysed_trial_count === 0) {
    diagnostics.push(makeDiagnostic(
      'warning',
      index.file,
      '/classroom_trial/status',
      'classroom trial is not tested; 0 analysed records are registered',
    ));
  }
  if (summary.analysed_home_trial_count === 0) {
    diagnostics.push(makeDiagnostic(
      'warning',
      index.file,
      '/home_trial/status',
      'home trial is not started; 0 analysed records are registered',
    ));
  }
}

export function validatePedagogicalReviewRepository(context) {
  const diagnostics = [];
  const teacherPackResult = validateTeacherPackRepository(context.teacherPacks);
  diagnostics.push(...teacherPackResult.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ));
  for (const document of context.workflowDocuments) {
    if (document.loadError) {
      diagnostics.push(makeDiagnostic('error', document.file, '/', document.loadError));
    }
  }
  const templateGroups = [
    [context.reviewTemplates, context.validators['teacher-review']],
    [context.trialTemplates, context.validators['classroom-trial']],
    [context.homeTrialTemplates, context.validators['home-trial']],
  ];
  for (const [templates, validator] of templateGroups) {
    for (const artifact of templates) {
      addSchemaDiagnostics(diagnostics, artifact, validator);
      validateTemplateSemantics(diagnostics, artifact);
    }
  }
  for (const [artifacts, validator] of [
    [context.reviewRecords, context.validators['teacher-review']],
    [context.trialRecords, context.validators['classroom-trial']],
    [context.homeTrialRecords, context.validators['home-trial']],
  ]) {
    for (const artifact of artifacts) addSchemaDiagnostics(diagnostics, artifact, validator);
  }
  const packCount = context.teacherPacks.indexes.length;
  if (context.reviewTemplates.length !== packCount) {
    diagnostics.push(makeDiagnostic(
      'error',
      'pedagogical-reviews',
      '/',
      'every teacher pack requires one teacher-review template',
    ));
  }
  if (context.trialTemplates.length !== packCount) {
    diagnostics.push(makeDiagnostic(
      'error',
      'pedagogical-reviews',
      '/',
      'every teacher pack requires one classroom-trial template',
    ));
  }
  if (context.homeTrialTemplates.length !== packCount) {
    diagnostics.push(makeDiagnostic(
      'error',
      'pedagogical-reviews',
      '/',
      'every teacher pack requires one home-trial template',
    ));
  }
  let effectiveReviews = 0;
  let effectiveClassroomTrials = 0;
  let effectiveHomeTrials = 0;
  for (const index of context.teacherPacks.indexes) {
    const summary = summarizePack(context, index, diagnostics);
    validateLinkStatus(diagnostics, index, summary);
    if (summary.effective_teacher_review) effectiveReviews += 1;
    if (summary.effective_classroom_trial) effectiveClassroomTrials += 1;
    if (summary.effective_home_trial) effectiveHomeTrials += 1;
  }
  addDuplicates(
    diagnostics,
    context.reviewRecords.map((artifact) => artifact.data?.review_id).filter(Boolean),
    'pedagogical-reviews',
    '/review_id',
    'review ID',
  );
  addDuplicates(
    diagnostics,
    [...context.trialRecords, ...context.homeTrialRecords]
      .map((artifact) => artifact.data?.trial_id)
      .filter(Boolean),
    'pedagogical-reviews',
    '/trial_id',
    'trial ID',
  );
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning',
  ).length;
  return {
    diagnostics: [...diagnostics].sort((left, right) => compareBytewise(
      `${left.file}\0${left.field}\0${left.reason}`,
      `${right.file}\0${right.field}\0${right.reason}`,
    )),
    summary: {
      packs: packCount,
      reviewTemplates: context.reviewTemplates.length,
      trialTemplates: context.trialTemplates.length,
      homeTrialTemplates: context.homeTrialTemplates.length,
      completedReviews: context.reviewRecords.filter(recordStatusComplete).length,
      analysedTrials: context.trialRecords.filter(recordStatusComplete).length,
      analysedHomeTrials: context.homeTrialRecords.filter(recordStatusComplete).length,
      effectiveReviews,
      effectiveTrials: effectiveClassroomTrials,
      effectiveHomeTrials,
      errors,
      warnings,
    },
  };
}

export function formatPedagogicalReviewDiagnostic(diagnostic) {
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.file} ${diagnostic.field}: ${diagnostic.reason}`;
}
