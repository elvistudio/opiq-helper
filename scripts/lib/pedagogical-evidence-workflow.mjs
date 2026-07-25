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
  loadPedagogicalReviewRepository,
  validateStandalonePedagogicalEvidenceRecord,
} from './pedagogical-reviews.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './teacher-pack-fingerprints.mjs';
import {
  writePedagogicalReadinessReport,
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
  const identityCommitSha = await resolveCurrentCommitSha(baselineRootDir);
  const context = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const index = context.teacherPacks.indexes.find((artifact) => artifact.file === packPath);
  if (!index) throw new Error(`teacher pack is not registered: ${packPath}`);
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

function recordLink(index, record) {
  if (record.artifact_type === 'teacher_review') {
    return {
      path: ['pedagogical_review', 'review_record_paths'],
      statusPath: ['pedagogical_review', 'status'],
      status: ['approved', 'approved_with_minor_notes'].includes(record.decision.status)
        ? 'approved'
        : record.decision.status === 'rejected' ? 'rejected' : 'changes_requested',
    };
  }
  if (record.artifact_type === 'classroom_trial') {
    return {
      path: ['classroom_trial', 'trial_record_paths'],
      statusPath: ['classroom_trial', 'status'],
      status: ['successful', 'successful_with_notes'].includes(record.decision.status)
        ? 'tested'
        : record.decision.status === 'repeat_trial_required'
          ? 'repeat_required'
          : 'changes_required',
    };
  }
  return {
    path: ['home_trial', 'trial_record_paths'],
    statusPath: ['home_trial', 'status'],
    status: ['successful', 'successful_with_notes'].includes(record.decision.status)
      ? 'tested'
      : record.decision.status === 'repeat_trial_required'
        ? 'repeat_required'
        : 'changes_required',
  };
}

function updateMaterialsIndexText(text, link, targetPath) {
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
  document.setIn(link.statusPath, link.status);
  return document.toString({ lineWidth: 100 });
}

export async function registerPedagogicalEvidence({
  rootDir = process.cwd(),
  baselineRootDir = rootDir,
  packPath,
  recordPath,
  targetPath,
  write = false,
  afterWrite = null,
} = {}) {
  if (!write) {
    const error = new Error('evidence registration requires explicit --write');
    error.code = 'pedagogical_evidence_write_required';
    throw error;
  }
  if (!targetPath?.startsWith('pedagogical-reviews/')
    || !targetPath.includes('/records/')
    || !/\.ya?ml$/u.test(targetPath)) {
    throw new Error('registered evidence target must be a YAML path under pedagogical-reviews/**/records/');
  }
  const identityCommitSha = await resolveCurrentCommitSha(baselineRootDir);
  const context = await loadPedagogicalReviewRepository({
    rootDir,
    identityCommitSha,
  });
  const index = context.teacherPacks.indexes.find((artifact) => artifact.file === packPath);
  if (!index) throw new Error(`teacher pack is not registered: ${packPath}`);
  const record = parseStrictCurriculumYaml(
    await fs.readFile(
      safeRepositoryPath(rootDir, recordPath, 'normalized evidence record path'),
      'utf8',
    ),
    recordPath,
  );
  const artifact = { file: targetPath, data: record };
  const validation = validateStandalonePedagogicalEvidenceRecord(
    context,
    index,
    artifact,
    { requireEffective: true },
  );
  const errors = validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (!validation.state.effective || errors.length > 0) {
    const error = new Error(
      `only current effective evidence can be registered: ${errors.map((item) => item.reason).join('; ')}`,
    );
    error.code = 'pedagogical_evidence_not_effective';
    throw error;
  }
  assertPedagogicalEvidencePrivacy(record);
  const before = await computeTeacherPackFingerprintFromRepository(
    context.teacherPacks,
    index,
  );
  const indexAbsolute = safeRepositoryPath(rootDir, packPath, 'teacher-pack index path');
  const targetAbsolute = safeRepositoryPath(rootDir, targetPath, 'registered evidence target');
  const readinessReportPath = packPath
    === 'teacher-packs/grade-5-science/water/materials-index.yaml'
    ? 'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json'
    : null;
  const readinessReportAbsolute = readinessReportPath
    ? safeRepositoryPath(rootDir, readinessReportPath, 'readiness report path')
    : null;
  const originalIndex = await fs.readFile(indexAbsolute, 'utf8');
  let originalTarget = null;
  let originalReadinessReport = null;
  try {
    originalTarget = await fs.readFile(targetAbsolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (readinessReportAbsolute) {
    try {
      originalReadinessReport = await fs.readFile(readinessReportAbsolute);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const link = recordLink(index, record);
  try {
    await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });
    await fs.writeFile(targetAbsolute, serializeCanonicalEvidenceYaml(record));
    await fs.writeFile(
      indexAbsolute,
      updateMaterialsIndexText(originalIndex, link, targetPath),
    );
    if (afterWrite) await afterWrite();
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
    if (packPath === 'teacher-packs/grade-5-science/water/materials-index.yaml') {
      await writePedagogicalReadinessReport({
        rootDir,
        baselineRootDir,
      });
    }
    return { before, after, target_path: targetPath };
  } catch (error) {
    await fs.writeFile(indexAbsolute, originalIndex);
    if (originalTarget === null) await fs.rm(targetAbsolute, { force: true });
    else await fs.writeFile(targetAbsolute, originalTarget);
    if (readinessReportAbsolute) {
      if (originalReadinessReport === null) {
        await fs.rm(readinessReportAbsolute, { force: true });
      } else {
        await fs.writeFile(readinessReportAbsolute, originalReadinessReport);
      }
    }
    throw error;
  }
}
