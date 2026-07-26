import fs from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
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
const NEGATIVE_REVIEW_DECISIONS = new Set(['changes_required', 'rejected']);
const NEGATIVE_TRIAL_DECISIONS = new Set(['changes_required', 'repeat_trial_required']);
const OPEN_STATUSES = new Set(['open', 'planned']);
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
const CLASSROOM_ONLY_RATINGS = new Set(['classroom_feasibility']);
const HOMESCHOOL_ONLY_RATINGS = new Set(['homeschool_clarity', 'parent_role_realism']);
const CLASSROOM_SUCCESS_DIMENSIONS = Object.freeze([
  'instruction_comprehension',
  'recall_and_transfer',
  'participation_and_completion',
  'language_support',
  'material_usability',
  'method_execution_observations',
]);
const HOME_SUCCESS_DIMENSIONS = Object.freeze([
  'instruction_comprehension',
  'adult_role',
  'learner_independence',
  'material_availability',
  'offline_and_printer_assumptions',
  'language_scaffolds',
  'task_completion',
  'recall_and_transfer',
]);
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

async function loadAliasAwareYamlArtifact(rootDir, repositoryPath, kind) {
  let file = repositoryPath ?? '<missing>';
  try {
    const resolved = safeRepositoryPath(rootDir, repositoryPath, `${kind} path`);
    file = relativeDisplay(rootDir, resolved);
    const document = parseDocument(await fs.readFile(resolved, 'utf8'), {
      strict: true,
      uniqueKeys: true,
      schema: 'core',
      customTags: [],
      prettyErrors: true,
    });
    if (document.errors.length > 0) {
      throw new Error(document.errors.map((error) => error.message).join('\n'));
    }
    return {
      file,
      data: document.toJS({ maxAliasCount: 1000 }),
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

function recordId(artifact) {
  return artifact?.data?.review_id ?? artifact?.data?.trial_id ?? null;
}

function recordDecision(artifact) {
  return artifact?.data?.decision?.status ?? 'pending';
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

async function buildEvidenceReferenceModel(rootDir, index, fingerprint) {
  const lessonIds = new Set(index.data.lesson_ids ?? []);
  const lessons = new Map();
  for (const lessonId of lessonIds) {
    lessons.set(lessonId, {
      classroomPhases: new Map(),
      homePhases: new Map(),
      retrievalRequired: false,
      classroomPractical: false,
      homePractical: false,
      homeAdultRoles: new Set(['none', 'logistical_support']),
    });
  }
  const integrationPath = index.data.pedagogical_integration?.integration_index_path;
  if (integrationPath) {
    const integration = await loadAliasAwareYamlArtifact(
      rootDir,
      integrationPath,
      'pedagogy integration index',
    );
    if (!integration.loadError) {
      for (const row of integration.data.lessons ?? []) {
        const lesson = lessons.get(row.lesson_id);
        if (!lesson) continue;
        for (const task of row.task_bindings ?? []) {
          lesson.classroomPhases.set(task.phase_id, task.target_id);
          if (
            task.phase_id.includes('practical')
            || task.target_id?.includes('practical')
            || (task.safety_controls_ru ?? []).length > 0
          ) {
            lesson.classroomPractical = true;
          }
        }
        if (row.lesson_dna_path) {
          const dna = await loadAliasAwareYamlArtifact(
            rootDir,
            row.lesson_dna_path,
            'lesson DNA',
          );
          if (!dna.loadError) {
            lesson.retrievalRequired = dna.data.retrieval_plan !== null
              && dna.data.retrieval_plan !== undefined;
            for (const phase of dna.data.phases ?? []) {
              if (!lesson.classroomPhases.has(phase.phase_id)) {
                lesson.classroomPhases.set(phase.phase_id, phase.target?.target_id ?? null);
              }
            }
          }
        }
        if (row.homeschool_decision_path) {
          const decision = await loadAliasAwareYamlArtifact(
            rootDir,
            row.homeschool_decision_path,
            'homeschool adaptation decision',
          );
          if (!decision.loadError) {
            for (const roleDecision of decision.data.adult_role_decisions ?? []) {
              if (roleDecision.allowed === true && roleDecision.role) {
                lesson.homeAdultRoles.add(roleDecision.role);
              }
            }
            for (const adaptation of decision.data.phase_adaptations ?? []) {
              lesson.homePhases.set(
                adaptation.adapted_phase_id,
                adaptation.adapted_target_id,
              );
              if (
                adaptation.adapted_phase_id?.includes('practical')
                || adaptation.adapted_target_id?.includes('practical')
              ) {
                lesson.homePractical = true;
              }
            }
          }
        }
        if (row.homeschool_package_path) {
          const packageArtifact = await loadAliasAwareYamlArtifact(
            rootDir,
            row.homeschool_package_path,
            'homeschool package',
          );
          if (!packageArtifact.loadError) {
            for (const step of packageArtifact.data.learner_plan?.steps ?? []) {
              if (step.adult_involvement) {
                lesson.homeAdultRoles.add(step.adult_involvement);
              }
              if (!lesson.homePhases.has(step.phase_id)) {
                lesson.homePhases.set(step.phase_id, null);
              }
              if (
                step.phase_id?.includes('practical')
                || (step.safety_controls_ru ?? []).length > 0
              ) {
                lesson.homePractical = true;
              }
            }
          }
        }
      }
    }
  }
  return {
    lessonIds,
    lessons,
    artifactClosure: new Set([
      index.file,
      ...(fingerprint?.files ?? []),
      index.data.pedagogical_review?.guide_path,
      index.data.pedagogical_review?.template_path,
      index.data.classroom_trial?.template_path,
      index.data.home_trial?.template_path,
      integrationPath,
    ].filter(Boolean)),
  };
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
  const evidenceReferenceModels = {};
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
    evidenceReferenceModels[index.data.pack_id] = await buildEvidenceReferenceModel(
      absoluteRoot,
      index,
      currentPackFingerprints[index.data.pack_id],
    );
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
    evidenceReferenceModels,
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
  const referenceModel = context.evidenceReferenceModels?.[pack.pack_id] ?? {
    lessonIds: knownLessons,
    lessons: new Map(),
    artifactClosure: new Set(),
  };
  const linkedEvidencePaths = new Set([
    ...(pack.pedagogical_review?.review_record_paths ?? []),
    ...(pack.classroom_trial?.trial_record_paths ?? []),
    ...(pack.home_trial?.trial_record_paths ?? []),
  ]);
  const phaseTargetValid = (lessonId, phaseId, targetId, deliveryMode) => {
    const lesson = referenceModel.lessons.get(lessonId);
    if (!lesson) return false;
    const phases = deliveryMode === 'homeschool'
      ? lesson.homePhases
      : lesson.classroomPhases;
    if (!phases.has(phaseId)) return false;
    return targetId === null || targetId === undefined || phases.get(phaseId) === targetId;
  };
  const validateLessonPhaseTarget = ({
    lessonId,
    phaseIds = [],
    targetIds = [],
    deliveryMode,
    field,
  }) => {
    if (!knownLessons.has(lessonId)) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        field,
        `unknown linked lesson ${lessonId}`,
      ));
      return;
    }
    for (const phaseId of phaseIds) {
      if (!phaseTargetValid(lessonId, phaseId, null, deliveryMode)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          field,
          `unknown ${deliveryMode} phase ${phaseId} for ${lessonId}`,
        ));
      }
    }
    for (const targetId of targetIds) {
      const matches = phaseIds.length > 0
        ? phaseIds.some((phaseId) => (
          phaseTargetValid(lessonId, phaseId, targetId, deliveryMode)
        ))
        : [...(deliveryMode === 'homeschool'
          ? referenceModel.lessons.get(lessonId)?.homePhases ?? []
          : referenceModel.lessons.get(lessonId)?.classroomPhases ?? []
        )].some(([, value]) => value === targetId);
      if (!matches) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          field,
          `target ${targetId} is not bound to the referenced ${deliveryMode} phase in ${lessonId}`,
        ));
      }
    }
  };
  const findings = artifact.data?.findings ?? [];
  for (const [index, finding] of findings.entries()) {
    const allowedModes = artifact.data?.artifact_type === 'classroom_trial'
      ? new Set(['classroom'])
      : artifact.data?.artifact_type === 'home_trial'
        ? new Set(['homeschool'])
        : new Set(artifact.data?.delivery_scopes ?? []);
    for (const deliveryMode of finding.delivery_modes ?? []) {
      if (!allowedModes.has(deliveryMode)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/findings/${index}/delivery_modes`,
          `${deliveryMode} is outside this evidence record scope`,
        ));
      }
    }
    for (const lessonId of finding.lesson_ids ?? []) {
      if (
        artifact.data?.artifact_type !== 'teacher_review'
        && !(artifact.data?.context?.lesson_ids ?? []).includes(lessonId)
      ) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/findings/${index}/lesson_ids`,
          `finding lesson ${lessonId} is outside the trial context`,
        ));
      }
      const modes = finding.delivery_modes?.length > 0
        ? finding.delivery_modes
        : [...allowedModes];
      for (const deliveryMode of modes) {
        validateLessonPhaseTarget({
          lessonId,
          phaseIds: finding.phase_ids,
          targetIds: finding.target_ids,
          deliveryMode,
          field: `/findings/${index}`,
        });
      }
    }
    if (
      (finding.phase_ids ?? []).length + (finding.target_ids ?? []).length > 0
      && (finding.lesson_ids ?? []).length === 0
    ) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        `/findings/${index}`,
        'phase or target references require an explicit lesson ID',
      ));
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
        if (
          !referenceModel.artifactClosure.has(repositoryPath)
          && !linkedEvidencePaths.has(repositoryPath)
        ) {
          throw new Error('not registered in the pack review/evidence dependency closure');
        }
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
  const validateObservationArray = (items, field, deliveryMode) => {
    const contextLessons = new Set(artifact.data?.context?.lesson_ids ?? []);
    for (const [index, observation] of (items ?? []).entries()) {
      if (!contextLessons.has(observation.lesson_id)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/${field}/${index}/lesson_id`,
          `observation lesson ${observation.lesson_id} is outside the trial context`,
        ));
      }
      validateLessonPhaseTarget({
        lessonId: observation.lesson_id,
        phaseIds: observation.phase_ids ?? (
          observation.phase_id ? [observation.phase_id] : []
        ),
        targetIds: observation.target_ids ?? [],
        deliveryMode,
        field: `/${field}/${index}`,
      });
    }
  };
  if (artifact.data?.artifact_type === 'classroom_trial') {
    validateObservationArray(
      artifact.data.timing_observations,
      'timing_observations',
      'classroom',
    );
    for (const field of [
      ...CLASSROOM_SUCCESS_DIMENSIONS,
      'retrieval_and_correction',
      'differentiation_adjustments',
      'safety_observations',
      'unexpected_support',
    ]) {
      validateObservationArray(artifact.data[field], field, 'classroom');
    }
    for (const [index, observation] of (
      artifact.data.safety_observations ?? []
    ).entries()) {
      if (
        referenceModel.lessons.get(observation.lesson_id)?.classroomPractical
        !== true
      ) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/safety_observations/${index}`,
          `practical safety observation is not applicable to ${observation.lesson_id}`,
        ));
      }
    }
    validateObservationArray(
      artifact.data.lesson_dna_deviations,
      'lesson_dna_deviations',
      'classroom',
    );
  } else if (artifact.data?.artifact_type === 'home_trial') {
    validateObservationArray(
      artifact.data.session_observations,
      'session_observations',
      'homeschool',
    );
    for (const field of [
      ...HOME_SUCCESS_DIMENSIONS,
      'retrieval_and_correction',
      'practical_safety',
    ]) {
      validateObservationArray(artifact.data[field], field, 'homeschool');
    }
    for (const [index, observation] of (
      artifact.data.practical_safety ?? []
    ).entries()) {
      if (referenceModel.lessons.get(observation.lesson_id)?.homePractical !== true) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/practical_safety/${index}`,
          `home practical safety evidence is not applicable to ${observation.lesson_id}`,
        ));
      }
    }
    const declaredRole = artifact.data.context?.adult_role;
    for (const lessonId of artifact.data.context?.lesson_ids ?? []) {
      const allowedRoles = referenceModel.lessons.get(lessonId)?.homeAdultRoles;
      if (allowedRoles && !allowedRoles.has(declaredRole)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/context/adult_role',
          `adult role ${declaredRole} is not allowed by the home adaptation for ${lessonId}`,
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
  const openSafetyBlockers = findings.filter((finding) => (
    finding.category === 'safety'
    && ['blocking', 'major'].includes(finding.severity)
    && OPEN_STATUSES.has(finding.resolution_status)
  ));
  const openSafetyNotes = findings.filter((finding) => (
    finding.category === 'safety'
    && ['minor', 'observation'].includes(finding.severity)
    && OPEN_STATUSES.has(finding.resolution_status)
  ));
  return {
    findings,
    openBlockingOrMajor,
    openSafetyBlockers,
    openSafetyNotes,
  };
}

function validateReviewRecord(
  diagnostics,
  context,
  artifact,
  pack,
  currentIdentity,
  lessonIds,
  schemaValid,
  {
    requireScope = null,
    requireCurrent = false,
    lifecycleSuperseded = false,
  } = {},
) {
  const review = artifact.data;
  const initialErrorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  if (!review || !schemaValid) {
    return {
      artifact,
      recordId: recordId(artifact),
      schema_valid: false,
      complete: false,
      current: false,
      superseded: lifecycleSuperseded || recordSuperseded(artifact),
      registerable: false,
      positive_effective: false,
      negative_effective: false,
      effective: false,
      stale: false,
      deliveryScopes: [],
      openBlockingOrMajor: [],
      openSafetyBlockers: [],
      unresolvedChanges: [],
      decision: recordDecision(artifact),
    };
  }
  validateReferences(diagnostics, context, artifact, pack, lessonIds);
  const complete = review.review_status === 'completed';
  const identity = validateIdentity(
    diagnostics,
    artifact,
    currentIdentity,
    { complete, requireEffective: requireCurrent || requireScope !== null },
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
    const scopes = new Set(review.delivery_scopes ?? []);
    const expectedNotApplicable = new Set([
      ...(!scopes.has('classroom') ? CLASSROOM_ONLY_RATINGS : []),
      ...(!scopes.has('homeschool') ? HOMESCHOOL_ONLY_RATINGS : []),
    ]);
    const applicability = new Map(
      (review.rating_applicability ?? []).map((entry) => [
        entry.dimension,
        entry.rationale,
      ]),
    );
    addDuplicates(
      diagnostics,
      (review.rating_applicability ?? []).map((entry) => entry.dimension),
      artifact.file,
      '/rating_applicability',
      'rating applicability dimension',
    );
    for (const field of RATING_FIELDS) {
      const rating = review.ratings?.[field];
      if (expectedNotApplicable.has(field)) {
        if (rating !== 'not_applicable' || !normalize(applicability.get(field))) {
          diagnostics.push(makeDiagnostic(
            'error',
            artifact.file,
            `/ratings/${field}`,
            'out-of-scope rating must be not_applicable with a bounded rationale',
          ));
        }
      } else if (!Number.isInteger(rating)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/ratings/${field}`,
          'completed teacher review requires every pedagogical rating that is applicable',
        ));
      }
    }
    for (const field of applicability.keys()) {
      if (!expectedNotApplicable.has(field)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/rating_applicability',
          `rating applicability rationale is not allowed for required dimension ${field}`,
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
  const negative = NEGATIVE_REVIEW_DECISIONS.has(review.decision?.status);
  if (complete && !approved && !negative) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/status',
      'completed teacher review requires a positive or negative completed decision',
    ));
  }
  if (
    review.decision?.status === 'changes_required'
    && (
      findingState.findings.length === 0
      || (review.required_changes ?? []).length === 0
    )
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/status',
      'changes_required review requires a finding and a linked required change',
    ));
  }
  if (
    review.decision?.status === 'rejected'
    && findingState.openBlockingOrMajor.length === 0
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/status',
      'rejected review requires an open blocking or major finding',
    ));
  }
  if (approved && findingState.openBlockingOrMajor.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      'approved review cannot retain open blocking or major findings',
    ));
  }
  const openMinor = findingState.findings.filter((finding) => (
    finding.severity === 'minor' && OPEN_STATUSES.has(finding.resolution_status)
  ));
  const minorHasPlan = (finding) => {
    const direct = finding.resolution_status === 'planned'
      && (finding.resolution_refs ?? []).length > 0;
    const linked = (review.required_changes ?? []).some((change) => (
      change.finding_refs.includes(finding.finding_id)
      && ['planned', 'resolved'].includes(change.resolution_status)
      && change.resolution_refs.length > 0
    ));
    return direct || linked;
  };
  let minorPlansValid = true;
  if (review.decision?.status === 'approved') {
    minorPlansValid = unresolvedChanges.length === 0 && openMinor.length === 0;
  } else if (review.decision?.status === 'approved_with_minor_notes') {
    minorPlansValid = openMinor.every(minorHasPlan)
      && unresolvedChanges.every((change) => {
        const related = change.finding_refs
          .map((id) => findingState.findings.find((finding) => finding.finding_id === id))
          .filter(Boolean);
        return ['planned', 'resolved'].includes(change.resolution_status)
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
  const noLocalErrors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length === initialErrorCount;
  const superseded = lifecycleSuperseded || recordSuperseded(artifact);
  const registerable = complete
    && noLocalErrors
    && !superseded
    && identity.current
    && validDate(review.reviewed_at)
    && (review.delivery_scopes ?? []).length > 0
    && REVIEW_SCOPE_FLAGS.every((field) => review.review_scope?.[field] === true)
    && sameSet(review.review_scope?.lesson_guides, lessonIds)
    && (approved || negative);
  const positiveEffective = registerable
    && approved
    && findingState.openBlockingOrMajor.length === 0
    && minorPlansValid;
  const negativeEffective = registerable && negative;
  return {
    artifact,
    recordId: recordId(artifact),
    schema_valid: schemaValid,
    complete,
    current: identity.current,
    superseded,
    registerable,
    positive_effective: positiveEffective,
    negative_effective: negativeEffective,
    effective: positiveEffective,
    stale: identity.stale,
    deliveryScopes: review.delivery_scopes ?? [],
    openBlockingOrMajor: findingState.openBlockingOrMajor,
    openSafetyBlockers: findingState.openSafetyBlockers,
    openSafetyNotes: findingState.openSafetyNotes,
    unresolvedChanges,
    decision: review.decision?.status ?? 'pending',
  };
}

function meaningfulObservation(observation) {
  return observation?.rating !== 'not_observed';
}

function observationsCoverLessons(observations, lessonIds) {
  const covered = new Set(
    (observations ?? []).filter(meaningfulObservation).map((item) => item.lesson_id),
  );
  return lessonIds.every((lessonId) => covered.has(lessonId));
}

function validateTrialSufficiency(
  diagnostics,
  context,
  artifact,
  pack,
  kind,
  successful,
) {
  const trial = artifact.data;
  const contextLessons = trial.context?.lesson_ids ?? [];
  const referenceModel = context.evidenceReferenceModels?.[pack.pack_id];
  const scheduleField = kind === 'classroom-trial'
    ? 'timing_observations'
    : 'session_observations';
  const scheduleLessons = new Set(
    (trial[scheduleField] ?? []).map((item) => item.lesson_id),
  );
  for (const lessonId of contextLessons) {
    if (!scheduleLessons.has(lessonId)) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        `/${scheduleField}`,
        `${kind} must include a ${scheduleField} entry for ${lessonId}`,
      ));
    }
  }
  const dimensions = kind === 'classroom-trial'
    ? [...CLASSROOM_SUCCESS_DIMENSIONS]
    : [...HOME_SUCCESS_DIMENSIONS];
  const retrievalRequired = contextLessons.some(
    (lessonId) => referenceModel?.lessons.get(lessonId)?.retrievalRequired === true,
  );
  const practicalRequired = contextLessons.some((lessonId) => (
    kind === 'classroom-trial'
      ? referenceModel?.lessons.get(lessonId)?.classroomPractical === true
      : referenceModel?.lessons.get(lessonId)?.homePractical === true
  ));
  if (retrievalRequired) dimensions.push('retrieval_and_correction');
  if (practicalRequired) {
    dimensions.push(kind === 'classroom-trial' ? 'safety_observations' : 'practical_safety');
  }
  if (successful) {
    for (const field of dimensions) {
      if (!observationsCoverLessons(trial[field], contextLessons)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          `/${field}`,
          `successful ${kind} requires meaningful ${field} coverage for every context lesson`,
        ));
      }
    }
    if (kind === 'classroom-trial') {
      const status = trial.lesson_dna_deviation_status;
      if (
        !['none_observed', 'observed'].includes(status)
        || (status === 'observed' && (trial.lesson_dna_deviations ?? []).length === 0)
        || (status === 'none_observed' && (trial.lesson_dna_deviations ?? []).length > 0)
      ) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/lesson_dna_deviation_status',
          'successful classroom trial must explicitly record deviations or none_observed',
        ));
      }
    }
  } else {
    const categoricalCount = dimensions.reduce(
      (count, field) => count + (trial[field] ?? []).filter(meaningfulObservation).length,
      0,
    );
    if (categoricalCount === 0 && (trial.findings ?? []).length === 0) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        '/',
        `analysed negative ${kind} requires an aggregate observation or finding`,
      ));
    }
  }
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
  {
    requireSuccess = false,
    requireCurrent = false,
    lifecycleSuperseded = false,
  } = {},
) {
  const trial = artifact.data;
  const initialErrorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  if (!trial || !schemaValid) {
    return {
      artifact,
      recordId: recordId(artifact),
      schema_valid: false,
      complete: false,
      current: false,
      superseded: lifecycleSuperseded || recordSuperseded(artifact),
      registerable: false,
      positive_effective: false,
      negative_effective: false,
      effective: false,
      stale: false,
      openBlockingOrMajor: [],
      openSafetyBlockers: [],
      openSafetyNotes: [],
      parentRoleBounded: kind === 'classroom-trial',
      deliveryScopes: [kind === 'classroom-trial' ? 'classroom' : 'homeschool'],
      decision: recordDecision(artifact),
    };
  }
  validateReferences(diagnostics, context, artifact, pack, lessonIds);
  const analysed = trial.trial_status === 'analysed';
  const identity = validateIdentity(
    diagnostics,
    artifact,
    currentIdentity,
    { complete: analysed, requireEffective: requireCurrent || requireSuccess },
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
  const negative = NEGATIVE_TRIAL_DECISIONS.has(trial.decision?.status);
  if (analysed && !successful && !negative) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/status',
      `analysed ${kind} requires a positive or negative completed decision`,
    ));
  }
  if (analysed) {
    validateTrialSufficiency(
      diagnostics,
      context,
      artifact,
      pack,
      kind,
      successful,
    );
  }
  if (successful && findingState.openBlockingOrMajor.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful ${kind} cannot retain open blocking or major findings`,
    ));
  }
  if (successful && findingState.openSafetyBlockers.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful ${kind} cannot retain open blocking or major safety findings`,
    ));
  }
  const openMinor = findingState.findings.filter(
    (finding) => (
      finding.severity === 'minor'
      && OPEN_STATUSES.has(finding.resolution_status)
    ),
  );
  if (trial.decision?.status === 'successful' && openMinor.length > 0) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful ${kind} must use successful_with_notes for an open minor finding`,
    ));
  }
  if (
    trial.decision?.status === 'successful_with_notes'
    && openMinor.some((finding) => (
      finding.resolution_status !== 'planned'
      || (finding.resolution_refs ?? []).length === 0
    ))
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/findings',
      `successful_with_notes ${kind} requires a referenced plan for each minor finding`,
    ));
  }
  if (successful && trial.decision?.safe_to_repeat !== true) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/safe_to_repeat',
      `successful ${kind} requires safe_to_repeat: true`,
    ));
  }
  if (
    trial.decision?.status === 'repeat_trial_required'
    && trial.decision?.safe_to_repeat !== false
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/safe_to_repeat',
      `repeat_trial_required ${kind} requires safe_to_repeat: false`,
    ));
  }
  if (
    trial.decision?.status === 'changes_required'
    && findingState.openSafetyBlockers.length > 0
    && trial.decision?.safe_to_repeat !== false
  ) {
    diagnostics.push(makeDiagnostic(
      'error',
      artifact.file,
      '/decision/safe_to_repeat',
      `changes_required ${kind} with a safety blocker requires safe_to_repeat: false`,
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
  const noLocalErrors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length === initialErrorCount;
  const superseded = lifecycleSuperseded || recordSuperseded(artifact);
  const registerable = analysed
    && noLocalErrors
    && !superseded
    && identity.current
    && validDate(trial.conducted_at)
    && (trial.context?.lesson_ids ?? []).length > 0
    && (trial.context?.lesson_ids ?? []).every((lessonId) => knownLessons.has(lessonId))
    && (successful || negative);
  const positiveEffective = registerable
    && successful
    && findingState.openBlockingOrMajor.length === 0
    && findingState.openSafetyBlockers.length === 0
    && parentRoleBounded;
  const negativeEffective = registerable && negative;
  return {
    artifact,
    recordId: recordId(artifact),
    schema_valid: schemaValid,
    complete: analysed,
    current: identity.current,
    superseded,
    registerable,
    positive_effective: positiveEffective,
    negative_effective: negativeEffective,
    effective: positiveEffective,
    stale: identity.stale,
    openBlockingOrMajor: findingState.openBlockingOrMajor,
    openSafetyBlockers: findingState.openSafetyBlockers,
    openSafetyNotes: findingState.openSafetyNotes,
    parentRoleBounded,
    deliveryScopes: [kind === 'classroom-trial' ? 'classroom' : 'homeschool'],
    decision: trial.decision?.status ?? 'pending',
  };
}

function validateLifecycleGraph(diagnostics, artifacts, kind) {
  const byId = new Map();
  for (const artifact of artifacts) {
    const id = recordId(artifact);
    if (id) byId.set(id, artifact);
  }
  const supersededBy = new Map();
  const edges = new Map();
  for (const artifact of artifacts) {
    const id = recordId(artifact);
    if (!id) continue;
    const refs = artifact.data?.lifecycle?.supersedes ?? [];
    edges.set(id, refs);
    for (const targetId of refs) {
      if (targetId === id) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/lifecycle/supersedes',
          `${kind} record cannot supersede itself`,
        ));
      } else if (!byId.has(targetId)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/lifecycle/supersedes',
          `unknown linked ${kind} record ${targetId}`,
        ));
      } else if (supersededBy.has(targetId)) {
        diagnostics.push(makeDiagnostic(
          'error',
          artifact.file,
          '/lifecycle/supersedes',
          `${kind} record ${targetId} is superseded by multiple records`,
        ));
      } else {
        if (kind === 'teacher-review') {
          const successorScopes = new Set(artifact.data?.delivery_scopes ?? []);
          const targetScopes = byId.get(targetId)?.data?.delivery_scopes ?? [];
          if (!targetScopes.every((scope) => successorScopes.has(scope))) {
            diagnostics.push(makeDiagnostic(
              'error',
              artifact.file,
              '/lifecycle/supersedes',
              `successor review must cover every delivery scope of ${targetId}`,
            ));
          }
        }
        supersededBy.set(targetId, id);
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      diagnostics.push(makeDiagnostic(
        'error',
        byId.get(id)?.file ?? 'pedagogical-reviews',
        '/lifecycle/supersedes',
        `${kind} supersession graph contains a cycle at ${id}`,
      ));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of edges.get(id) ?? []) {
      if (byId.has(target)) visit(target);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  for (const artifact of artifacts) {
    if (recordSuperseded(artifact) && !supersededBy.has(recordId(artifact))) {
      diagnostics.push(makeDiagnostic(
        'error',
        artifact.file,
        artifact.data?.artifact_type === 'teacher_review'
          ? '/review_status'
          : '/trial_status',
        `superseded ${kind} record requires an explicit successor lifecycle link`,
      ));
    }
  }
  return { supersededBy };
}

function validateLifecycleTerminals(diagnostics, index, states, kind) {
  const byId = new Map(states.map((state) => [state.recordId, state]));
  for (const state of states.filter((item) => item.superseded)) {
    let terminal = state;
    const visited = new Set();
    while (terminal?.supersededBy && !visited.has(terminal.recordId)) {
      visited.add(terminal.recordId);
      terminal = byId.get(terminal.supersededBy);
    }
    if (!terminal?.schema_valid || !terminal.complete || terminal.superseded) {
      diagnostics.push(makeDiagnostic(
        'error',
        index.file,
        `/${kind}`,
        `supersession chain for ${state.recordId} requires a complete terminal record`,
      ));
    }
  }
}

function reviewModeStatus(states, deliveryMode) {
  const activeCurrent = states.filter((state) => (
    !state.superseded
    && state.current
    && state.complete
    && state.deliveryScopes.includes(deliveryMode)
  ));
  if (activeCurrent.some((state) => (
    state.negative_effective && state.decision === 'rejected'
  ))) return 'rejected';
  if (activeCurrent.some((state) => state.negative_effective)) {
    return 'changes_requested';
  }
  if (activeCurrent.some((state) => state.positive_effective)) return 'approved';
  return 'pending';
}

function trialStatus(states, emptyStatus) {
  const activeCurrent = states.filter((state) => (
    !state.superseded && state.current && state.complete
  ));
  if (activeCurrent.some((state) => (
    state.negative_effective && state.decision === 'repeat_trial_required'
  ))) return 'repeat_required';
  if (activeCurrent.some((state) => state.negative_effective)) {
    return 'changes_required';
  }
  if (activeCurrent.some((state) => state.positive_effective)) return 'tested';
  return emptyStatus;
}

function aggregateReviewStatus(classroomStatus, homeschoolStatus) {
  if (
    classroomStatus === 'approved'
    && homeschoolStatus === 'approved'
  ) return 'approved_for_both';
  if (classroomStatus === 'rejected' || homeschoolStatus === 'rejected') return 'rejected';
  if (
    classroomStatus === 'changes_requested'
    || homeschoolStatus === 'changes_requested'
  ) return 'changes_requested';
  if (classroomStatus === 'approved' || homeschoolStatus === 'approved') return 'partial';
  return 'pending';
}

function validateActiveConflicts(diagnostics, index, states, kind) {
  for (const deliveryMode of ['classroom', 'homeschool']) {
    const scoped = states.filter((state) => (
      !state.superseded
      && state.current
      && state.registerable
      && state.deliveryScopes.includes(deliveryMode)
    ));
    if (
      scoped.some((state) => state.positive_effective)
      && scoped.some((state) => state.negative_effective)
    ) {
      diagnostics.push(makeDiagnostic(
        'error',
        index.file,
        `/${kind}`,
        `conflicting current positive and negative ${kind} evidence for ${deliveryMode}`,
      ));
      continue;
    }
    const decisions = uniqueSorted(scoped.map((state) => state.decision));
    if (decisions.length > 1) {
      diagnostics.push(makeDiagnostic(
        'error',
        index.file,
        `/${kind}`,
        `conflicting current ${kind} decisions for ${deliveryMode}: ${
          decisions.join(', ')
        }`,
      ));
    }
  }
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
  const reviewLifecycle = validateLifecycleGraph(
    diagnostics,
    linkedReviews,
    'teacher-review',
  );
  const classroomLifecycle = validateLifecycleGraph(
    diagnostics,
    linkedClassroomTrials,
    'classroom-trial',
  );
  const homeLifecycle = validateLifecycleGraph(
    diagnostics,
    linkedHomeTrials,
    'home-trial',
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
      {
        lifecycleSuperseded: reviewLifecycle.supersededBy.has(recordId(record)),
      },
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
      {
        lifecycleSuperseded: classroomLifecycle.supersededBy.has(recordId(record)),
      },
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
      {
        lifecycleSuperseded: homeLifecycle.supersededBy.has(recordId(record)),
      },
    ));
  }
  for (const [states, lifecycle] of [
    [reviewStates, reviewLifecycle],
    [classroomStates, classroomLifecycle],
    [homeStates, homeLifecycle],
  ]) {
    for (const state of states) {
      state.supersedes = uniqueSorted(
        state.artifact?.data?.lifecycle?.supersedes ?? [],
      );
      state.supersededBy = lifecycle.supersededBy.get(state.recordId) ?? null;
    }
  }
  validateLifecycleTerminals(
    diagnostics,
    index,
    reviewStates,
    'pedagogical_review',
  );
  validateLifecycleTerminals(
    diagnostics,
    index,
    classroomStates,
    'classroom_trial',
  );
  validateLifecycleTerminals(diagnostics, index, homeStates, 'home_trial');
  validateActiveConflicts(
    diagnostics,
    index,
    reviewStates,
    'pedagogical_review',
  );
  validateActiveConflicts(
    diagnostics,
    index,
    classroomStates,
    'classroom_trial',
  );
  validateActiveConflicts(diagnostics, index, homeStates, 'home_trial');
  const classroomReviewStatus = reviewModeStatus(reviewStates, 'classroom');
  const homeschoolReviewStatus = reviewModeStatus(reviewStates, 'homeschool');
  const activeStates = [
    ...reviewStates,
    ...classroomStates,
    ...homeStates,
  ].filter((state) => !state.superseded);
  const historicalStates = [
    ...reviewStates,
    ...classroomStates,
    ...homeStates,
  ].filter((state) => state.superseded);
  return {
    current_fingerprint: currentIdentity?.content_fingerprint
      ?? context.currentPackFingerprints[pack.pack_id],
    current_pedagogical_snapshot: currentIdentity?.pedagogical_snapshot ?? null,
    completed_review_count: linkedReviews.filter(recordStatusComplete).length,
    analysed_trial_count: linkedClassroomTrials.filter(recordStatusComplete).length,
    analysed_home_trial_count: linkedHomeTrials.filter(recordStatusComplete).length,
    effective_teacher_review:
      classroomReviewStatus === 'approved' && homeschoolReviewStatus === 'approved',
    effective_classroom_review: reviewStates.some(
      (state) => state.positive_effective
        && !state.superseded
        && state.deliveryScopes.includes('classroom'),
    ),
    effective_homeschool_review: reviewStates.some(
      (state) => state.positive_effective
        && !state.superseded
        && state.deliveryScopes.includes('homeschool'),
    ),
    effective_classroom_trial: classroomStates.some(
      (state) => state.positive_effective && !state.superseded,
    ),
    effective_home_trial: homeStates.some(
      (state) => state.positive_effective && !state.superseded,
    ),
    effective_teacher_review_count: reviewStates.filter(
      (state) => state.positive_effective && !state.superseded,
    ).length,
    effective_classroom_review_count: reviewStates.filter(
      (state) => state.positive_effective
        && !state.superseded
        && state.deliveryScopes.includes('classroom'),
    ).length,
    effective_homeschool_review_count: reviewStates.filter(
      (state) => state.positive_effective
        && !state.superseded
        && state.deliveryScopes.includes('homeschool'),
    ).length,
    effective_classroom_trial_count: classroomStates.filter(
      (state) => state.positive_effective && !state.superseded,
    ).length,
    effective_home_trial_count: homeStates.filter(
      (state) => state.positive_effective && !state.superseded,
    ).length,
    negative_classroom_review: reviewStates.some(
      (state) => state.negative_effective
        && !state.superseded
        && state.deliveryScopes.includes('classroom'),
    ),
    negative_homeschool_review: reviewStates.some(
      (state) => state.negative_effective
        && !state.superseded
        && state.deliveryScopes.includes('homeschool'),
    ),
    negative_classroom_trial: classroomStates.some(
      (state) => state.negative_effective && !state.superseded,
    ),
    negative_home_trial: homeStates.some(
      (state) => state.negative_effective && !state.superseded,
    ),
    stale_teacher_review: reviewStates.some(
      (state) => state.stale && !state.superseded,
    ),
    stale_classroom_trial: classroomStates.some(
      (state) => state.stale && !state.superseded,
    ),
    stale_home_trial: homeStates.some((state) => state.stale && !state.superseded),
    stale_teacher_review_count: reviewStates.filter((state) => state.stale).length,
    stale_classroom_trial_count: classroomStates.filter((state) => state.stale).length,
    stale_home_trial_count: homeStates.filter((state) => state.stale).length,
    parent_role_bounded: homeStates
      .filter((state) => state.positive_effective && !state.superseded)
      .every((state) => state.parentRoleBounded),
    open_review_findings: reviewStates
      .filter((state) => !state.superseded)
      .flatMap((state) => state.openBlockingOrMajor),
    unresolved_required_changes: reviewStates.flatMap(
      (state) => (state.superseded ? [] : state.unresolvedChanges.map((change) => ({
        ...change,
        record_id: state.recordId,
        evidence_path: state.artifact.file,
        delivery_modes: [...state.deliveryScopes],
      }))),
    ),
    open_classroom_safety_findings: classroomStates.flatMap(
      (state) => (state.superseded ? [] : state.openSafetyBlockers),
    ),
    open_home_safety_findings: homeStates.flatMap(
      (state) => (state.superseded ? [] : state.openSafetyBlockers),
    ),
    review_classroom_status: classroomReviewStatus,
    review_homeschool_status: homeschoolReviewStatus,
    review_aggregate_status: aggregateReviewStatus(
      classroomReviewStatus,
      homeschoolReviewStatus,
    ),
    classroom_trial_status: trialStatus(classroomStates, 'not_tested'),
    home_trial_status: trialStatus(homeStates, 'not_started'),
    evidence_states: [...activeStates, ...historicalStates],
    active_evidence_states: activeStates,
    historical_evidence_states: historicalStates,
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
  { requireEffective = false, requireRegisterable = false } = {},
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
    return {
      diagnostics,
      state: {
        schema_valid: false,
        complete: false,
        current: false,
        superseded: false,
        registerable: false,
        positive_effective: false,
        negative_effective: false,
        effective: false,
        stale: false,
        deliveryScopes: [],
      },
      kind,
    };
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
        requireCurrent: requireEffective || requireRegisterable,
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
      {
        requireSuccess: requireEffective,
        requireCurrent: requireEffective || requireRegisterable,
      },
    );
  }
  return { diagnostics, state, kind };
}

export function derivePedagogicalEvidenceLinkState(context, index) {
  const summary = summarizePack(context, index, []);
  return {
    pedagogical_review: {
      status: summary.review_aggregate_status,
      classroom_status: summary.review_classroom_status,
      homeschool_status: summary.review_homeschool_status,
    },
    classroom_trial: {
      status: summary.classroom_trial_status,
    },
    home_trial: {
      status: summary.home_trial_status,
    },
  };
}

function validateLinkStatus(diagnostics, index, summary) {
  const pack = index.data;
  const expected = {
    '/pedagogical_review/status': summary.review_aggregate_status,
    '/pedagogical_review/classroom_status': summary.review_classroom_status,
    '/pedagogical_review/homeschool_status': summary.review_homeschool_status,
    '/classroom_trial/status': summary.classroom_trial_status,
    '/home_trial/status': summary.home_trial_status,
  };
  const actual = {
    '/pedagogical_review/status': pack.pedagogical_review?.status,
    '/pedagogical_review/classroom_status':
      pack.pedagogical_review?.classroom_status,
    '/pedagogical_review/homeschool_status':
      pack.pedagogical_review?.homeschool_status,
    '/classroom_trial/status': pack.classroom_trial?.status,
    '/home_trial/status': pack.home_trial?.status,
  };
  for (const [field, expectedStatus] of Object.entries(expected)) {
    if (actual[field] !== expectedStatus) {
      diagnostics.push(makeDiagnostic(
        'error',
        index.file,
        field,
        `derived evidence status must be ${expectedStatus}, got ${actual[field] ?? '<missing>'}`,
      ));
    }
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
  const evidencePathOwners = new Map();
  for (const index of context.teacherPacks.indexes) {
    for (const [kind, paths] of [
      ['teacher-review', index.data.pedagogical_review?.review_record_paths ?? []],
      ['classroom-trial', index.data.classroom_trial?.trial_record_paths ?? []],
      ['home-trial', index.data.home_trial?.trial_record_paths ?? []],
    ]) {
      for (const repositoryPath of paths) {
        const owner = evidencePathOwners.get(repositoryPath);
        if (owner && owner.packId !== index.data.pack_id) {
          diagnostics.push(makeDiagnostic(
            'error',
            index.file,
            `/${kind}`,
            `cross-pack evidence path ${repositoryPath} is already linked by ${owner.packId}`,
          ));
        } else if (owner && owner.kind !== kind) {
          diagnostics.push(makeDiagnostic(
            'error',
            index.file,
            `/${kind}`,
            `evidence path ${repositoryPath} is linked as both ${owner.kind} and ${kind}`,
          ));
        } else {
          evidencePathOwners.set(repositoryPath, {
            packId: index.data.pack_id,
            kind,
          });
        }
      }
    }
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
