import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';
import {
  parseStrictCurriculumYaml,
  safeRepositoryPath,
} from './curriculum-maps.mjs';
import {
  assertPedagogicalEvidencePrivacy,
  buildPedagogicalEvidenceIdentity,
  createPedagogicalEvidenceValidators,
  pedagogicalEvidenceIdentityMatches,
  parseStrictPedagogicalEvidenceJson,
  resolveCurrentCommitSha,
  schemaValidationMessages,
  serializeCanonicalEvidenceYaml,
} from './pedagogical-evidence.mjs';
import {
  derivePedagogicalEvidenceLinkState,
  loadPedagogicalReviewRepository,
  validatePedagogicalReviewRepository,
  validateStandalonePedagogicalEvidenceRecord,
} from './pedagogical-reviews.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './teacher-pack-fingerprints.mjs';
import {
  buildPedagogicalReadinessReport,
  createPedagogicalReadinessReportValidator,
  serializePedagogicalReadinessReport,
} from './pedagogical-readiness.mjs';

const PRIVACY_NOTICE =
  'Do not enter learner or family names, dates of birth, identifiers, contacts, '
  + 'addresses, recordings, health or diagnostic information, identifiable grades, '
  + 'or identifiable free text. Manual privacy attestation remains required.';
const NON_GUARANTEES = Object.freeze([
  'The intake does not establish pedagogical effectiveness.',
  'The intake is not evidence until completed, normalized, validated, and explicitly registered.',
  'The privacy scanner cannot guarantee detection of every possible identifier.',
  'Teacher review does not substitute for classroom or home trial evidence.',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function assertCanonicalRepositoryPath(repositoryPath, label) {
  if (
    typeof repositoryPath !== 'string'
    || repositoryPath.length === 0
    || path.posix.isAbsolute(repositoryPath)
    || repositoryPath.includes('\\')
    || repositoryPath.split('/').some((segment) => segment.length === 0)
    || repositoryPath.split('/').includes('..')
    || repositoryPath.split('/').includes('.')
    || path.posix.normalize(repositoryPath) !== repositoryPath
  ) {
    const error = new Error(
      `${label} must be a canonical repository-relative POSIX path`,
    );
    error.code = 'pedagogical_evidence_path_invalid';
    throw error;
  }
  return repositoryPath;
}

async function assertNoSymlinkAncestors(rootDir, repositoryPath, label) {
  const segments = repositoryPath.split('/');
  let current = path.resolve(rootDir);
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        const error = new Error(`${label} traverses symlink directory ${segment}`);
        error.code = 'pedagogical_evidence_path_symlink';
        throw error;
      }
      if (!stat.isDirectory()) {
        throw new Error(`${label} parent is not a directory: ${segment}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseStrictAliasAwareYaml(text, file) {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${file}: invalid YAML:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  const value = document.toJS({ maxAliasCount: 1000 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${file}: YAML root must be an object`);
  }
  return value;
}

function kindArtifactType(kind) {
  return {
    'teacher-review': 'teacher_review',
    'classroom-trial': 'classroom_trial',
    'home-trial': 'home_trial',
  }[kind];
}

function templatePathFor(index, kind) {
  return {
    'teacher-review': index.data.pedagogical_review?.template_path,
    'classroom-trial': index.data.classroom_trial?.template_path,
    'home-trial': index.data.home_trial?.template_path,
  }[kind];
}

async function readJson(repositoryPath, rootDir = process.cwd()) {
  return parseStrictPedagogicalEvidenceJson(
    await fs.readFile(
      safeRepositoryPath(rootDir, repositoryPath, 'pedagogical evidence JSON path'),
      'utf8',
    ),
    repositoryPath,
  );
}

async function loadIntakeValidator(rootDir) {
  const { schemas } = await createPedagogicalEvidenceValidators(rootDir);
  const intakeSchemaPath = 'schemas/pedagogical-evidence-intake.schema.json';
  const intake = parseStrictPedagogicalEvidenceJson(
    await fs.readFile(
      safeRepositoryPath(
        rootDir,
        intakeSchemaPath,
        'pedagogical evidence intake schema',
      ),
      'utf8',
    ),
    intakeSchemaPath,
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  ajv.addSchema(schemas.common);
  ajv.addSchema(schemas.teacherReview);
  ajv.addSchema(schemas.classroomTrial);
  ajv.addSchema(schemas.homeTrial);
  return ajv.compile(intake);
}

function setPreparedFields(record, kind, recordId, date, identity) {
  const output = structuredClone(record);
  output.evidence_identity = identity;
  if (kind === 'teacher-review') {
    output.review_id = recordId;
    output.reviewed_at = date;
  } else {
    output.trial_id = recordId;
    output.conducted_at = date;
  }
  return output;
}

function checklistMarkdown({
  intake,
  checkedArtifacts,
  lessons,
}) {
  const identity = intake.record.evidence_identity;
  const lines = [
    `# Pedagogical evidence checklist — ${intake.kind}`,
    '',
    `Pack: \`${intake.pack_path}\``,
    '',
    `Record ID: \`${intake.record.review_id ?? intake.record.trial_id}\``,
    '',
    `Prepared date: \`${intake.prepared_for_date}\``,
    '',
    `Content fingerprint: \`${identity.content_fingerprint.value}\` `
      + `(${identity.content_fingerprint.file_count} files)`,
    '',
    '## Privacy',
    '',
    PRIVACY_NOTICE,
    '',
    'Before normalization set `privacy.free_text_checked_for_identifiers` to `true` '
      + 'only after a manual check.',
    '',
    '## Lesson, phase, and selected-target references',
    '',
    ...lessons.flatMap((lesson) => [
      `- \`${lesson.lesson_id}\``,
      ...lesson.phase_targets.map(
        (binding) => `  - \`${binding.phase_id}\` → \`${binding.target_id}\``,
      ),
    ]),
    '',
    '## Exact artifact checklist',
    '',
    ...checkedArtifacts.map((artifact) => `- [ ] \`${artifact}\``),
    '',
    '## Non-guarantees',
    '',
    ...NON_GUARANTEES.map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

export async function preparePedagogicalEvidenceBundle({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  packPath,
  kind,
  recordId,
  date,
  outputDirectory,
} = {}) {
  if (!packPath || !outputDirectory || !kind || !recordId || !date) {
    throw new Error(
      'prepare requires packPath, kind, recordId, date, and outputDirectory',
    );
  }
  if (!kindArtifactType(kind)) throw new Error(`unsupported evidence kind ${kind}`);
  if (!validDate(date)) throw new Error(`invalid explicit evidence date ${date}`);
  assertCanonicalRepositoryPath(outputDirectory, 'evidence prepare output directory');
  await assertNoSymlinkAncestors(
    rootDir,
    `${outputDirectory}/intake.json`,
    'evidence prepare output directory',
  );
  const identityCommitSha = await resolveCurrentCommitSha(baselineRootDir);
  const context = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const index = context.teacherPacks.indexes.find((artifact) => artifact.file === packPath);
  if (!index) throw new Error(`teacher pack is not registered: ${packPath}`);
  for (const candidate of context.teacherPacks.indexes) {
    if (
      outputDirectory === candidate.data.pack_path
      || outputDirectory.startsWith(`${candidate.data.pack_path}/`)
    ) {
      const error = new Error(
        'evidence prepare output cannot be inside reviewable teacher-pack content',
      );
      error.code = 'pedagogical_evidence_output_reviewable';
      throw error;
    }
  }
  const templatePath = templatePathFor(index, kind);
  if (!templatePath) throw new Error(`teacher pack has no ${kind} template`);
  const template = parseStrictCurriculumYaml(
    await fs.readFile(
      safeRepositoryPath(rootDir, templatePath, `${kind} template path`),
      'utf8',
    ),
    templatePath,
  );
  const built = await buildPedagogicalEvidenceIdentity({
    rootDir,
    packPath,
    commitSha: identityCommitSha,
  });
  const record = setPreparedFields(template, kind, recordId, date, built.identity);
  const intake = {
    schema_version: '1.0',
    artifact_type: 'pedagogical_evidence_intake',
    kind,
    pack_path: packPath,
    prepared_for_date: date,
    privacy_notice: PRIVACY_NOTICE,
    non_guarantees: [...NON_GUARANTEES].sort(compareBytewise),
    record,
  };
  const validator = await loadIntakeValidator(rootDir);
  if (!validator(intake)) {
    throw new Error(`prepared intake is schema-invalid: ${schemaValidationMessages(validator).join('; ')}`);
  }
  const integrationPath = index.data.pedagogical_integration?.integration_index_path;
  const integration = parseStrictAliasAwareYaml(
    await fs.readFile(
      safeRepositoryPath(rootDir, integrationPath, 'integration index path'),
      'utf8',
    ),
    integrationPath,
  );
  const lessons = (integration.lessons ?? []).map((lesson) => ({
    lesson_id: lesson.lesson_id,
    phase_targets: [...new Map((lesson.task_bindings ?? []).map((binding) => [
      `${binding.phase_id}\0${binding.target_id}`,
      {
        phase_id: binding.phase_id,
        target_id: binding.target_id,
      },
    ])).values()].sort((left, right) => (
      compareBytewise(left.phase_id, right.phase_id)
      || compareBytewise(left.target_id, right.target_id)
    )),
  })).sort((left, right) => compareBytewise(left.lesson_id, right.lesson_id));
  const absoluteOutput = path.resolve(rootDir, outputDirectory);
  await fs.mkdir(absoluteOutput, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(absoluteOutput, 'intake.json'),
      `${JSON.stringify(intake, null, 2)}\n`,
    ),
    fs.writeFile(
      path.join(absoluteOutput, 'checklist.md'),
      checklistMarkdown({
        intake,
        checkedArtifacts: built.checked_artifacts,
        lessons,
      }),
    ),
  ]);
  return {
    intake,
    checklist_path: path.join(outputDirectory, 'checklist.md'),
    intake_path: path.join(outputDirectory, 'intake.json'),
  };
}

export async function normalizePedagogicalEvidenceIntake({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  intakePath,
  outputPath = null,
} = {}) {
  const intake = await readJson(intakePath, rootDir);
  const validator = await loadIntakeValidator(rootDir);
  if (!validator(intake)) {
    const error = new Error(
      `pedagogical evidence intake is schema-invalid: ${schemaValidationMessages(validator).join('; ')}`,
    );
    error.code = 'pedagogical_evidence_intake_invalid';
    throw error;
  }
  if (intake.record.artifact_type !== kindArtifactType(intake.kind)) {
    throw new Error(`intake kind ${intake.kind} does not match record artifact type`);
  }
  const identityCommitSha = await resolveCurrentCommitSha(baselineRootDir);
  const current = await buildPedagogicalEvidenceIdentity({
    rootDir,
    packPath: intake.pack_path,
    commitSha: identityCommitSha,
  });
  if (!pedagogicalEvidenceIdentityMatches(
    intake.record.evidence_identity,
    current.identity,
  )) {
    const error = new Error('filled intake is stale for the current pedagogical snapshot');
    error.code = 'pedagogical_evidence_intake_stale';
    throw error;
  }
  const context = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const index = context.teacherPacks.indexes.find(
    (artifact) => artifact.file === intake.pack_path,
  );
  const artifact = { file: intakePath, data: intake.record };
  const validation = validateStandalonePedagogicalEvidenceRecord(
    context,
    index,
    artifact,
  );
  const errors = validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (errors.length > 0) {
    const error = new Error(
      `pedagogical evidence record is invalid: ${errors.map((item) => (
        `${item.field}: ${item.reason}`
      )).join('; ')}`,
    );
    error.code = 'pedagogical_evidence_record_invalid';
    throw error;
  }
  if (
    intake.record.review_status === 'completed'
    || intake.record.trial_status === 'analysed'
  ) {
    assertPedagogicalEvidencePrivacy(intake.record);
  }
  const yaml = serializeCanonicalEvidenceYaml(intake.record);
  if (outputPath) {
    const absolute = safeRepositoryPath(rootDir, outputPath, 'normalized evidence output path');
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, yaml);
  }
  return { record: intake.record, yaml, output_path: outputPath };
}

function recordLink(record) {
  if (record.artifact_type === 'teacher_review') {
    return {
      path: ['pedagogical_review', 'review_record_paths'],
    };
  }
  if (record.artifact_type === 'classroom_trial') {
    return {
      path: ['classroom_trial', 'trial_record_paths'],
    };
  }
  return {
    path: ['home_trial', 'trial_record_paths'],
  };
}

function setDerivedStatuses(document, statuses) {
  document.setIn(
    ['pedagogical_review', 'status'],
    statuses.pedagogical_review.status,
  );
  document.setIn(
    ['pedagogical_review', 'classroom_status'],
    statuses.pedagogical_review.classroom_status,
  );
  document.setIn(
    ['pedagogical_review', 'homeschool_status'],
    statuses.pedagogical_review.homeschool_status,
  );
  document.setIn(['classroom_trial', 'status'], statuses.classroom_trial.status);
  document.setIn(['home_trial', 'status'], statuses.home_trial.status);
}

function updateMaterialsIndexText(text, link, targetPath, statuses) {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'));
  }
  const existingNode = document.getIn(link.path, true);
  const existing = existingNode?.toJSON
    ? existingNode.toJSON()
    : document.getIn(link.path) ?? [];
  document.setIn(
    link.path,
    [...new Set([...existing, targetPath])].sort(compareBytewise),
  );
  setDerivedStatuses(document, statuses);
  return document.toString({ lineWidth: 100 });
}

function removeMaterialsIndexLinkText(text, link, targetPath, originalText) {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'));
  }
  const pathsNode = document.getIn(link.path, true);
  const paths = pathsNode?.toJSON
    ? pathsNode.toJSON()
    : document.getIn(link.path) ?? [];
  document.setIn(link.path, paths.filter((entry) => entry !== targetPath));
  const original = parseDocument(originalText, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  for (const statusPath of [
    ['pedagogical_review', 'status'],
    ['pedagogical_review', 'classroom_status'],
    ['pedagogical_review', 'homeschool_status'],
    ['classroom_trial', 'status'],
    ['home_trial', 'status'],
  ]) {
    document.setIn(statusPath, original.getIn(statusPath));
  }
  return document.toString({ lineWidth: 100 });
}

function updateDerivedStatusesText(text, statuses) {
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'));
  }
  setDerivedStatuses(document, statuses);
  return document.toString({ lineWidth: 100 });
}

function candidateContext(context, index, artifact, targetPath) {
  const candidateIndex = {
    ...index,
    data: structuredClone(index.data),
  };
  const link = recordLink(artifact.data);
  const holder = candidateIndex.data[link.path[0]];
  holder[link.path[1]] = [...new Set([
    ...(holder[link.path[1]] ?? []),
    targetPath,
  ])].sort(compareBytewise);
  const candidate = {
    ...context,
    teacherPacks: {
      ...context.teacherPacks,
      indexes: context.teacherPacks.indexes.map(
        (entry) => (entry.file === index.file ? candidateIndex : entry),
      ),
    },
    reviewRecords: artifact.data.artifact_type === 'teacher_review'
      ? [...context.reviewRecords, artifact]
      : context.reviewRecords,
    trialRecords: artifact.data.artifact_type === 'classroom_trial'
      ? [...context.trialRecords, artifact]
      : context.trialRecords,
    homeTrialRecords: artifact.data.artifact_type === 'home_trial'
      ? [...context.homeTrialRecords, artifact]
      : context.homeTrialRecords,
  };
  const statuses = derivePedagogicalEvidenceLinkState(candidate, candidateIndex);
  Object.assign(candidateIndex.data.pedagogical_review, statuses.pedagogical_review);
  Object.assign(candidateIndex.data.classroom_trial, statuses.classroom_trial);
  Object.assign(candidateIndex.data.home_trial, statuses.home_trial);
  return { candidate, candidateIndex, statuses, link };
}

async function readOptionalFile(absolutePath) {
  try {
    return await fs.readFile(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeStagedSibling(absolutePath, bytes) {
  const stagingPath = `${absolutePath}.pedagogy-register.tmp`;
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  try {
    await fs.writeFile(stagingPath, bytes, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const conflict = new Error(
      `evidence registration staging file already exists: ${stagingPath}`,
    );
    conflict.code = 'pedagogical_evidence_concurrent_staging_conflict';
    throw conflict;
  }
  return stagingPath;
}

export function pedagogicalEvidenceRegistrationLockPath(rootDir, packPath) {
  assertCanonicalRepositoryPath(packPath, 'teacher-pack path');
  const lockName = Buffer.from(packPath).toString('base64url');
  return path.join(
    path.resolve(rootDir),
    '.pedagogical-evidence-locks',
    `${lockName}.lock`,
  );
}

async function acquirePedagogicalEvidenceRegistrationLock(rootDir, packPath) {
  const lockPath = pedagogicalEvidenceRegistrationLockPath(rootDir, packPath);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await fs.open(lockPath, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const conflict = new Error(
      `pedagogical evidence registration lock already exists: ${lockPath}`,
    );
    conflict.code = 'pedagogical_evidence_registration_locked';
    throw conflict;
  }
  return {
    lockPath,
    async release() {
      await handle.close();
      await fs.rm(lockPath, { force: true });
      try {
        await fs.rmdir(path.dirname(lockPath));
      } catch (error) {
        if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error;
      }
    },
  };
}

export async function installImmutableEvidenceTarget(stagingPath, targetPath) {
  const stagingStat = await fs.lstat(stagingPath);
  try {
    await fs.link(stagingPath, targetPath);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const conflict = new Error(
      `registered evidence target already exists: ${targetPath}`,
    );
    conflict.code = 'pedagogical_evidence_target_exists';
    throw conflict;
  }
  const targetStat = await fs.lstat(targetPath);
  if (
    targetStat.dev !== stagingStat.dev
    || targetStat.ino !== stagingStat.ino
  ) {
    const conflict = new Error(
      `registered evidence target was replaced during commit: ${targetPath}`,
    );
    conflict.code = 'pedagogical_evidence_target_replaced_during_commit';
    throw conflict;
  }
  await fs.rm(stagingPath);
  return { dev: stagingStat.dev, ino: stagingStat.ino };
}

async function removeOwnedEvidenceTarget(targetPath, ownership) {
  if (!ownership) return;
  try {
    const stat = await fs.lstat(targetPath);
    if (stat.dev === ownership.dev && stat.ino === ownership.ino) {
      await fs.rm(targetPath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function registerPedagogicalEvidenceLocked({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  packPath,
  recordPath,
  targetPath,
  write = false,
  afterWrite = null,
  beforeTargetCommit = null,
  beforeIndexCommit = null,
} = {}) {
  if (!write) {
    const error = new Error('evidence registration requires explicit --write');
    error.code = 'pedagogical_evidence_write_required';
    throw error;
  }
  assertCanonicalRepositoryPath(targetPath, 'registered evidence target');
  if (!targetPath.startsWith('pedagogical-reviews/')
    || !targetPath.includes('/records/')
    || !/\.ya?ml$/u.test(targetPath)) {
    const error = new Error(
      'registered evidence target must be a YAML path under pedagogical-reviews/**/records/',
    );
    error.code = 'pedagogical_evidence_target_invalid';
    throw error;
  }
  await assertNoSymlinkAncestors(
    rootDir,
    targetPath,
    'registered evidence target',
  );
  const identityCommitSha = await resolveCurrentCommitSha(baselineRootDir);
  const context = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const index = context.teacherPacks.indexes.find((artifact) => artifact.file === packPath);
  if (!index) throw new Error(`teacher pack is not registered: ${packPath}`);
  const existingRepositoryValidation = validatePedagogicalReviewRepository(context);
  const existingErrors = existingRepositoryValidation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (existingErrors.length > 0) {
    const error = new Error(
      `existing pedagogical evidence repository is invalid: ${
        existingErrors.map((item) => `${item.file} ${item.field}: ${item.reason}`).join('; ')
      }`,
    );
    error.code = 'pedagogical_evidence_repository_invalid';
    throw error;
  }
  const record = parseStrictCurriculumYaml(
    await fs.readFile(
      safeRepositoryPath(rootDir, recordPath, 'normalized evidence record path'),
      'utf8',
    ),
    recordPath,
  );
  const recordIdentifier = record.review_id ?? record.trial_id;
  const expectedDirectory = `${path.posix.dirname(
    record.artifact_type === 'teacher_review'
      ? index.data.pedagogical_review.template_path
      : record.artifact_type === 'classroom_trial'
        ? index.data.classroom_trial.template_path
        : index.data.home_trial.template_path,
  )}/records`;
  if (
    path.posix.dirname(targetPath) !== expectedDirectory
    || path.posix.basename(targetPath) !== `${recordIdentifier}.yaml`
  ) {
    const error = new Error(
      `registered evidence target must be ${expectedDirectory}/${recordIdentifier}.yaml`,
    );
    error.code = 'pedagogical_evidence_target_pack_mismatch';
    throw error;
  }
  const artifact = { file: targetPath, data: record };
  const validation = validateStandalonePedagogicalEvidenceRecord(
    context,
    index,
    artifact,
    { requireRegisterable: true },
  );
  const errors = validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (!validation.state.registerable || errors.length > 0) {
    const error = new Error(
      `only current completed registerable evidence can be registered: ${
        errors.map((item) => item.reason).join('; ')
      }`,
    );
    error.code = 'pedagogical_evidence_not_registerable';
    throw error;
  }
  assertPedagogicalEvidencePrivacy(record);
  const canonicalRecord = serializeCanonicalEvidenceYaml(record);
  const before = await computeTeacherPackFingerprintFromRepository(
    context.teacherPacks,
    index,
  );
  const indexAbsolute = safeRepositoryPath(rootDir, packPath, 'teacher-pack index path');
  const targetAbsolute = safeRepositoryPath(rootDir, targetPath, 'registered evidence target');
  try {
    const targetStat = await fs.lstat(targetAbsolute);
    if (targetStat.isSymbolicLink()) {
      const error = new Error(`registered evidence target is a symlink: ${targetPath}`);
      error.code = 'pedagogical_evidence_path_symlink';
      throw error;
    }
    if (!targetStat.isFile()) {
      const error = new Error(`registered evidence target is not a file: ${targetPath}`);
      error.code = 'pedagogical_evidence_target_invalid';
      throw error;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const readinessReportPath = index.data.readiness?.report_path ?? null;
  const readinessReportAbsolute = readinessReportPath
    ? safeRepositoryPath(rootDir, readinessReportPath, 'readiness report path')
    : null;
  const originalIndex = await fs.readFile(indexAbsolute, 'utf8');
  const originalTarget = await readOptionalFile(targetAbsolute);
  const originalReadinessReport = readinessReportAbsolute
    ? await readOptionalFile(readinessReportAbsolute)
    : null;
  if (originalTarget !== null) {
    if (Buffer.compare(originalTarget, Buffer.from(canonicalRecord)) !== 0) {
      const error = new Error(`registered evidence target already exists: ${targetPath}`);
      error.code = 'pedagogical_evidence_target_exists';
      throw error;
    }
    const link = recordLink(record);
    const linked = index.data[link.path[0]]?.[link.path[1]]?.includes(targetPath);
    if (!linked) {
      const error = new Error(
        `byte-identical evidence target exists but is not registered: ${targetPath}`,
      );
      error.code = 'pedagogical_evidence_target_exists';
      throw error;
    }
    let readiness = null;
    if (readinessReportAbsolute) {
      readiness = await buildPedagogicalReadinessReport({
        rootDir,
        baselineRootDir,
      });
      const readinessValidator =
        await createPedagogicalReadinessReportValidator(rootDir);
      if (!readinessValidator(readiness)) {
        const error = new Error(
          `registered readiness report is invalid: ${
            JSON.stringify(readinessValidator.errors)
          }`,
        );
        error.code = 'pedagogical_readiness_report_invalid';
        throw error;
      }
      const committedReadiness = await fs.readFile(
        readinessReportAbsolute,
        'utf8',
      );
      if (
        committedReadiness
        !== serializePedagogicalReadinessReport(readiness)
      ) {
        const error = new Error(
          'byte-identical evidence is linked but its readiness report is stale',
        );
        error.code = 'pedagogical_readiness_report_stale';
        throw error;
      }
    }
    return {
      before,
      after: before,
      target_path: targetPath,
      already_registered: true,
      state: validation.state,
      readiness,
    };
  }
  const candidate = candidateContext(context, index, artifact, targetPath);
  const candidateValidation = validatePedagogicalReviewRepository(
    candidate.candidate,
  );
  const candidateErrors = candidateValidation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (candidateErrors.length > 0) {
    const error = new Error(
      `candidate pedagogical evidence repository is invalid: ${
        candidateErrors.map(
          (item) => `${item.file} ${item.field}: ${item.reason}`,
        ).join('; ')
      }`,
    );
    error.code = 'pedagogical_evidence_repository_invalid';
    throw error;
  }
  const candidateIndexText = updateMaterialsIndexText(
    originalIndex,
    candidate.link,
    targetPath,
    candidate.statuses,
  );
  let candidateReadiness = null;
  let candidateReadinessText = null;
  if (readinessReportAbsolute) {
    candidateReadiness = await buildPedagogicalReadinessReport({
      rootDir,
      baselineRootDir,
      reviewContext: candidate.candidate,
    });
    const candidateReadinessValidator =
      await createPedagogicalReadinessReportValidator(rootDir);
    if (!candidateReadinessValidator(candidateReadiness)) {
      const error = new Error(
        `candidate readiness report is invalid: ${
          JSON.stringify(candidateReadinessValidator.errors)
        }`,
      );
      error.code = 'pedagogical_readiness_report_invalid';
      throw error;
    }
    candidateReadinessText =
      serializePedagogicalReadinessReport(candidateReadiness);
  }
  let indexStage = null;
  let targetStage = null;
  let reportStage = null;
  let concurrentIndexBytes = null;
  let concurrentReadinessRebuilt = false;
  let targetInstalledByThisProcess = false;
  let indexInstalledByThisProcess = false;
  let reportInstalledByThisProcess = false;
  let targetOwnership = null;
  try {
    targetStage = await writeStagedSibling(targetAbsolute, canonicalRecord);
    indexStage = await writeStagedSibling(indexAbsolute, candidateIndexText);
    if (readinessReportAbsolute) {
      reportStage = await writeStagedSibling(
        readinessReportAbsolute,
        candidateReadinessText,
      );
    }
    const beforeCommitIndex = await fs.readFile(indexAbsolute, 'utf8');
    if (beforeCommitIndex !== originalIndex) {
      const error = new Error('materials index changed before evidence commit');
      error.code = 'pedagogical_evidence_concurrent_index_change';
      throw error;
    }
    if (readinessReportAbsolute) {
      const beforeCommitReadiness = await readOptionalFile(readinessReportAbsolute);
      if (
        (beforeCommitReadiness === null) !== (originalReadinessReport === null)
        || (
          beforeCommitReadiness !== null
          && Buffer.compare(beforeCommitReadiness, originalReadinessReport) !== 0
        )
      ) {
        const error = new Error('readiness report changed before evidence commit');
        error.code = 'pedagogical_evidence_concurrent_readiness_change';
        throw error;
      }
    }
    if (beforeTargetCommit) await beforeTargetCommit();
    targetOwnership = await installImmutableEvidenceTarget(
      targetStage,
      targetAbsolute,
    );
    targetInstalledByThisProcess = true;
    targetStage = null;
    if (beforeIndexCommit) await beforeIndexCommit();
    const finalPreIndexBytes = await fs.readFile(indexAbsolute, 'utf8');
    if (finalPreIndexBytes !== originalIndex) {
      const error = new Error('materials index changed before index commit');
      error.code = 'pedagogical_evidence_concurrent_index_change';
      throw error;
    }
    await fs.rename(indexStage, indexAbsolute);
    indexInstalledByThisProcess = true;
    indexStage = null;
    if (readinessReportAbsolute) {
      const finalPreReportBytes = await readOptionalFile(readinessReportAbsolute);
      if (
        (finalPreReportBytes === null) !== (originalReadinessReport === null)
        || (
          finalPreReportBytes !== null
          && Buffer.compare(finalPreReportBytes, originalReadinessReport) !== 0
        )
      ) {
        const error = new Error('readiness report changed before report commit');
        error.code = 'pedagogical_evidence_concurrent_readiness_change';
        throw error;
      }
      await fs.rename(reportStage, readinessReportAbsolute);
      reportInstalledByThisProcess = true;
      reportStage = null;
    }
    if (afterWrite) await afterWrite();
    const installedIndex = await fs.readFile(indexAbsolute, 'utf8');
    if (installedIndex !== candidateIndexText) {
      concurrentIndexBytes = installedIndex;
      const error = new Error('materials index changed during evidence registration');
      error.code = 'pedagogical_evidence_concurrent_index_change';
      throw error;
    }
    const reloaded = await loadPedagogicalReviewRepository({
      rootDir,
      identityCommitSha,
    });
    const reloadedIndex = reloaded.teacherPacks.indexes.find(
      (artifactEntry) => artifactEntry.file === packPath,
    );
    const after = await computeTeacherPackFingerprintFromRepository(
      reloaded.teacherPacks,
      reloadedIndex,
    );
    if (
      before.algorithm !== after.algorithm
      || before.specification_version !== after.specification_version
      || before.value !== after.value
      || before.file_count !== after.file_count
    ) {
      const error = new Error('evidence registration changed the reviewable fingerprint');
      error.code = 'pedagogical_evidence_registration_changed_fingerprint';
      throw error;
    }
    const repositoryValidation = validatePedagogicalReviewRepository(reloaded);
    const repositoryErrors = repositoryValidation.diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    if (repositoryErrors.length > 0) {
      const error = new Error(
        `registered repository state is invalid: ${
          repositoryErrors.map(
            (item) => `${item.file} ${item.field}: ${item.reason}`,
          ).join('; ')
        }`,
      );
      error.code = 'pedagogical_evidence_repository_invalid';
      throw error;
    }
    let report = candidateReadiness;
    if (readinessReportAbsolute) {
      report = await buildPedagogicalReadinessReport({
        rootDir,
        baselineRootDir,
      });
      const reportValidator = await createPedagogicalReadinessReportValidator(rootDir);
      if (!reportValidator(report)) {
        const error = new Error(
          `candidate readiness report is invalid: ${JSON.stringify(reportValidator.errors)}`,
        );
        error.code = 'pedagogical_readiness_report_invalid';
        throw error;
      }
      if (
        serializePedagogicalReadinessReport(report)
        !== candidateReadinessText
      ) {
        const error = new Error(
          'committed readiness state differs from the validated candidate state',
        );
        error.code = 'pedagogical_readiness_report_changed_during_registration';
        throw error;
      }
      const finalIndex = await fs.readFile(indexAbsolute, 'utf8');
      if (finalIndex !== candidateIndexText) {
        concurrentIndexBytes = finalIndex;
        const error = new Error('materials index changed before readiness commit');
        error.code = 'pedagogical_evidence_concurrent_index_change';
        throw error;
      }
    }
    return {
      before,
      after,
      target_path: targetPath,
      already_registered: false,
      state: validation.state,
      readiness: report,
    };
  } catch (error) {
    if (indexInstalledByThisProcess) {
      const currentIndexBytes = await fs.readFile(indexAbsolute, 'utf8');
      if (currentIndexBytes === candidateIndexText) {
        await fs.writeFile(indexAbsolute, originalIndex);
      } else {
        concurrentIndexBytes = currentIndexBytes;
        const withoutOwnLink = removeMaterialsIndexLinkText(
          currentIndexBytes,
          candidate.link,
          targetPath,
          originalIndex,
        );
        await fs.writeFile(indexAbsolute, withoutOwnLink);
      }
    }
    if (targetInstalledByThisProcess) {
      await removeOwnedEvidenceTarget(targetAbsolute, targetOwnership);
    }
    if (concurrentIndexBytes !== null) {
      try {
        const concurrentContext = await loadPedagogicalReviewRepository({
          rootDir,
          identityCommitSha,
        });
        const concurrentIndex = concurrentContext.teacherPacks.indexes.find(
          (artifactEntry) => artifactEntry.file === packPath,
        );
        const concurrentStatuses = derivePedagogicalEvidenceLinkState(
          concurrentContext,
          concurrentIndex,
        );
        const currentConcurrentText = await fs.readFile(indexAbsolute, 'utf8');
        await fs.writeFile(
          indexAbsolute,
          updateDerivedStatusesText(currentConcurrentText, concurrentStatuses),
        );
        if (readinessReportAbsolute) {
          const concurrentReport = await buildPedagogicalReadinessReport({
            rootDir,
            baselineRootDir,
          });
          const concurrentReportValidator =
            await createPedagogicalReadinessReportValidator(rootDir);
          if (!concurrentReportValidator(concurrentReport)) {
            throw new Error(
              `concurrent readiness report is invalid: ${
                JSON.stringify(concurrentReportValidator.errors)
              }`,
            );
          }
          await fs.writeFile(
            readinessReportAbsolute,
            serializePedagogicalReadinessReport(concurrentReport),
          );
          concurrentReadinessRebuilt = true;
        }
      } catch {
        // Preserve the concurrently written bytes and links even if their own
        // repository state is not yet complete enough to derive final statuses.
      }
    }
    if (
      readinessReportAbsolute
      && reportInstalledByThisProcess
      && !concurrentReadinessRebuilt
    ) {
      const currentReport = await readOptionalFile(readinessReportAbsolute);
      if (
        currentReport !== null
        && Buffer.compare(
          currentReport,
          Buffer.from(candidateReadinessText),
        ) !== 0
      ) {
        // Preserve a concurrently replaced report that is no longer owned by
        // this registration attempt.
      } else if (originalReadinessReport === null) {
        await fs.rm(readinessReportAbsolute, { force: true });
      } else {
        await fs.writeFile(readinessReportAbsolute, originalReadinessReport);
      }
    }
    await Promise.all(
      [indexStage, targetStage, reportStage]
        .filter(Boolean)
        .map((stagingPath) => fs.rm(stagingPath, { force: true })),
    );
    throw error;
  } finally {
    await Promise.all(
      [indexStage, targetStage, reportStage]
        .filter(Boolean)
        .map((stagingPath) => fs.rm(stagingPath, { force: true })),
    );
  }
}

export async function registerPedagogicalEvidence(options = {}) {
  if (options.write !== true) {
    const error = new Error('evidence registration requires explicit --write');
    error.code = 'pedagogical_evidence_write_required';
    throw error;
  }
  assertCanonicalRepositoryPath(options.packPath, 'teacher-pack path');
  assertCanonicalRepositoryPath(
    options.targetPath,
    'registered evidence target',
  );
  const lock = await acquirePedagogicalEvidenceRegistrationLock(
    options.rootDir ?? process.cwd(),
    options.packPath,
  );
  try {
    return await registerPedagogicalEvidenceLocked(options);
  } finally {
    await lock.release();
  }
}
