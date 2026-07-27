import fs from 'node:fs/promises';
import path from 'node:path';

const POSITIVE_TRIAL_DECISIONS = new Set(['successful', 'successful_with_notes']);

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertCanonicalPedagogicalEvidencePath(repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.posix.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => segment.length === 0)
    || repositoryPath.split('/').includes('.')
    || repositoryPath.split('/').includes('..')
    || path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    throw makeError(
      'pedagogical_evidence_output_path_invalid',
      `${label} must be a canonical repository-relative POSIX path`,
    );
  }
  return repositoryPath;
}

async function assertNoSymlinkAncestors(rootDir, repositoryPath) {
  let current = path.resolve(rootDir);
  for (const segment of repositoryPath.split('/').slice(0, -1)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        throw makeError(
          'pedagogical_evidence_output_symlink',
          `normalized evidence output traverses symlink directory ${segment}`,
        );
      }
      if (!stat.isDirectory()) {
        throw makeError(
          'pedagogical_evidence_output_path_invalid',
          `normalized evidence output parent is not a directory: ${segment}`,
        );
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function allowedWorkingOutput(repositoryPath) {
  return repositoryPath.startsWith('.tmp-pedagogy-evidence-')
    || repositoryPath.startsWith('tmp/')
    || /^pedagogical-reviews\/.+\/(?:drafts|normalized|work)\//u.test(repositoryPath);
}

export async function assertSafePedagogicalEvidenceNormalizationOutput({
  rootDir = process.cwd(),
  outputPath,
} = {}) {
  assertCanonicalPedagogicalEvidencePath(
    outputPath,
    'normalized evidence output path',
  );
  if (!allowedWorkingOutput(outputPath)) {
    throw makeError(
      'pedagogical_evidence_output_scope_forbidden',
      'normalized evidence output must stay in tmp/, .tmp-pedagogy-evidence-*, '
        + 'or a pedagogical-reviews/**/{drafts,normalized,work}/ directory; '
        + 'authoritative records/** files are created only by registration',
    );
  }
  await assertNoSymlinkAncestors(rootDir, outputPath);
  const absolute = path.resolve(rootDir, outputPath);
  try {
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) {
      throw makeError(
        'pedagogical_evidence_output_symlink',
        `normalized evidence output is a symlink: ${outputPath}`,
      );
    }
    throw makeError(
      'pedagogical_evidence_output_exists',
      `normalized evidence output already exists: ${outputPath}`,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return absolute;
}

function hasBoundedMinorFinding(record) {
  const changes = record.required_changes ?? [];
  return (record.findings ?? []).some((finding) => {
    if (finding.severity !== 'minor') return false;
    const direct = ['planned', 'resolved'].includes(finding.resolution_status)
      && (finding.resolution_refs ?? []).length > 0;
    const linked = changes.some((change) => (
      (change.finding_refs ?? []).includes(finding.finding_id)
      && ['planned', 'resolved'].includes(change.resolution_status)
      && (change.resolution_refs ?? []).length > 0
    ));
    return direct || linked;
  });
}

function visitAggregateCounts(value, pointer = '') {
  const diagnostics = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      diagnostics.push(...visitAggregateCounts(entry, `${pointer}/${index}`));
    });
    return diagnostics;
  }
  if (!value || typeof value !== 'object') return diagnostics;

  const hasCount = Object.hasOwn(value, 'aggregate_count');
  const hasDenominator = Object.hasOwn(value, 'aggregate_denominator');
  if (hasCount !== hasDenominator) {
    diagnostics.push({
      pointer: pointer || '/',
      reason: 'aggregate_count and aggregate_denominator must be provided together',
    });
  } else if (hasCount) {
    if (value.aggregate_count > value.aggregate_denominator) {
      diagnostics.push({
        pointer: pointer || '/',
        reason: 'aggregate_count cannot exceed aggregate_denominator',
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    diagnostics.push(...visitAggregateCounts(child, `${pointer}/${key}`));
  }
  return diagnostics;
}

export function assertPedagogicalEvidenceFinalGuards(record) {
  const artifactType = record?.artifact_type;
  const isReview = artifactType === 'teacher_review';
  const isTrial = ['classroom_trial', 'home_trial'].includes(artifactType);
  if (!isReview && !isTrial) return record;

  const terminal = isReview
    ? ['completed', 'superseded'].includes(record.review_status)
    : ['analysed', 'superseded'].includes(record.trial_status);
  const identifier = record.review_id ?? record.trial_id ?? '';
  if (terminal && identifier.includes('YYYY-MM-DD')) {
    throw makeError(
      'pedagogical_evidence_placeholder_id',
      'terminal pedagogical evidence cannot retain the YYYY-MM-DD template placeholder',
    );
  }

  if (record.review_status === 'superseded' || record.trial_status === 'superseded') {
    const date = isReview ? record.reviewed_at : record.conducted_at;
    if (
      record.evidence_identity === null
      || record.evidence_identity === undefined
      || date === null
      || date === undefined
      || record.decision?.status === 'pending'
      || record.privacy?.free_text_checked_for_identifiers !== true
    ) {
      throw makeError(
        'pedagogical_evidence_superseded_incomplete',
        'superseded evidence must preserve its recorded identity, date, terminal decision, '
          + 'and completed privacy attestation',
      );
    }
  }

  const aggregateDiagnostics = visitAggregateCounts(record);
  if (aggregateDiagnostics.length > 0) {
    const first = aggregateDiagnostics[0];
    throw makeError(
      'pedagogical_evidence_aggregate_invalid',
      `${first.pointer}: ${first.reason}`,
    );
  }

  if (
    isReview
    && record.decision?.status === 'approved_with_minor_notes'
    && !hasBoundedMinorFinding(record)
  ) {
    throw makeError(
      'pedagogical_evidence_notes_missing',
      'approved_with_minor_notes requires at least one bounded minor finding',
    );
  }

  if (isTrial) {
    const decision = record.decision?.status;
    if (decision === 'successful_with_notes' && !hasBoundedMinorFinding(record)) {
      throw makeError(
        'pedagogical_evidence_notes_missing',
        'successful_with_notes requires at least one bounded minor finding',
      );
    }
    if (POSITIVE_TRIAL_DECISIONS.has(decision)) {
      const schedule = artifactType === 'classroom_trial'
        ? record.timing_observations ?? []
        : record.session_observations ?? [];
      for (const [index, observation] of schedule.entries()) {
        if (observation.planned_minutes < 1 || observation.actual_minutes < 1) {
          throw makeError(
            'pedagogical_evidence_timing_invalid',
            `positive ${artifactType} schedule observation ${index} requires `
              + 'planned_minutes and actual_minutes of at least 1',
          );
        }
      }
    }
  }

  return record;
}

export async function writeNormalizedPedagogicalEvidenceFile({
  rootDir = process.cwd(),
  outputPath,
  yaml,
  record,
} = {}) {
  assertPedagogicalEvidenceFinalGuards(record);
  const absolute = await assertSafePedagogicalEvidenceNormalizationOutput({
    rootDir,
    outputPath,
  });
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  try {
    await fs.writeFile(absolute, yaml, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw makeError(
      'pedagogical_evidence_output_exists',
      `normalized evidence output already exists: ${outputPath}`,
    );
  }
  return outputPath;
}
