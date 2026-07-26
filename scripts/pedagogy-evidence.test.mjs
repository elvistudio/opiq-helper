import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseDocument } from 'yaml';
import {
  assertPedagogicalEvidencePrivacy,
  buildPedagogicalEvidenceIdentity,
  findPedagogicalEvidencePrivacyRisks,
  pedagogicalEvidenceIdentityMatches,
  pedagogicalEvidenceIdentityMismatches,
  parseStrictPedagogicalEvidenceJson,
  serializeCanonicalEvidenceYaml,
} from './lib/pedagogical-evidence.mjs';
import {
  normalizePedagogicalEvidenceIntake,
  preparePedagogicalEvidenceBundle,
  registerPedagogicalEvidence,
} from './lib/pedagogical-evidence-workflow.mjs';
import {
  computeTeacherPackFingerprintFromRepository,
} from './lib/teacher-pack-fingerprints.mjs';
import {
  loadPedagogicalReviewRepository,
  validatePedagogicalReviewRepository,
} from './lib/pedagogical-reviews.mjs';
import {
  createRegressionClassroomTrial,
  createRegressionHomeTrial,
  createRegressionTeacherReview,
} from './lib/pedagogy-readiness-regressions.mjs';
import {
  loadTeacherPackRepository,
} from './lib/teacher-packs.mjs';

const packPath = 'teacher-packs/grade-5-science/water/materials-index.yaml';

async function temporaryDirectory(rootDir = process.cwd()) {
  return fs.mkdtemp(path.join(rootDir, '.tmp-pedagogy-evidence-'));
}

async function temporaryRepository() {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'opiq-pedagogy-evidence-test-'),
  );
  await fs.cp(process.cwd(), rootDir, {
    recursive: true,
    filter(source) {
      const relative = path.relative(process.cwd(), source);
      return !(
        relative === '.git'
        || relative.startsWith(`.git${path.sep}`)
        || relative === 'node_modules'
        || relative.startsWith(`node_modules${path.sep}`)
        || relative.startsWith('.tmp-pedagogy-evidence-')
      );
    },
  });
  return rootDir;
}

async function prepare(
  kind = 'teacher-review',
  {
    rootDir = process.cwd(),
    baselineRootDir = rootDir,
    recordId = `grade-5-science-water-${kind}-2026-08-01`,
  } = {},
) {
  const directory = await temporaryDirectory(rootDir);
  await preparePedagogicalEvidenceBundle({
    rootDir,
    baselineRootDir,
    packPath,
    kind,
    recordId,
    date: '2026-08-01',
    outputDirectory: path.relative(rootDir, directory),
  });
  return {
    directory,
    intakePath: path.relative(rootDir, path.join(directory, 'intake.json')),
    checklistPath: path.join(directory, 'checklist.md'),
  };
}

test('prepare requires an explicit evidence record ID', async () => {
  const directory = await temporaryDirectory();
  await assert.rejects(
    preparePedagogicalEvidenceBundle({
      packPath,
      kind: 'teacher-review',
      date: '2026-08-01',
      outputDirectory: path.relative(process.cwd(), directory),
    }),
    /recordId/u,
  );
  await fs.rm(directory, { recursive: true, force: true });
});

for (const outputDirectory of [
  '/absolute/evidence-output',
  '../evidence-output',
  'path\\with\\backslashes',
]) {
  test(`prepare rejects unsafe output path ${outputDirectory}`, async () => {
    await assert.rejects(
      preparePedagogicalEvidenceBundle({
        packPath,
        kind: 'teacher-review',
        recordId: 'unsafe-output-review-2026-08-01',
        date: '2026-08-01',
        outputDirectory,
      }),
      (error) => error.code === 'pedagogical_evidence_path_invalid',
    );
  });
}

test('prepare rejects output inside reviewable teacher-pack content', async () => {
  await assert.rejects(
    preparePedagogicalEvidenceBundle({
      packPath,
      kind: 'teacher-review',
      recordId: 'reviewable-output-review-2026-08-01',
      date: '2026-08-01',
      outputDirectory: 'teacher-packs/grade-5-science/water/evidence-output',
    }),
    (error) => error.code === 'pedagogical_evidence_output_reviewable',
  );
});

test('prepare rejects a symlink parent escape', async () => {
  const parent = await temporaryDirectory();
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-evidence-output-'));
  const link = path.join(parent, 'escape');
  try {
    await fs.symlink(external, link, 'dir');
    await assert.rejects(
      preparePedagogicalEvidenceBundle({
        packPath,
        kind: 'teacher-review',
        recordId: 'symlink-output-review-2026-08-01',
        date: '2026-08-01',
        outputDirectory: path.relative(
          process.cwd(),
          path.join(link, 'bundle'),
        ),
      }),
      (error) => error.code === 'pedagogical_evidence_path_symlink',
    );
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
    await fs.rm(external, { recursive: true, force: true });
  }
});

function completeReviewIntake(intake) {
  const record = intake.record;
  record.review_status = 'completed';
  record.delivery_scopes = ['classroom', 'homeschool'];
  for (const field of Object.keys(record.review_scope)) {
    record.review_scope[field] = field === 'lesson_guides'
      ? record.evidence_identity.pedagogical_snapshot.lesson_dna_digests.map(
        (entry) => entry.lesson_id,
      )
      : true;
  }
  for (const field of Object.keys(record.ratings)) record.ratings[field] = 4;
  record.privacy.free_text_checked_for_identifiers = true;
  record.decision = {
    status: 'approved',
    rationale: 'Synthetic workflow fixture only; no production approval.',
  };
  return intake;
}

function categoricalObservation(lessonId) {
  return {
    lesson_id: lessonId,
    phase_ids: [],
    rating: 'met',
    summary: 'Synthetic aggregate workflow observation.',
    aggregate_count: 1,
    aggregate_denominator: 1,
  };
}

function completeNegativeReviewIntake(intake, decision) {
  completeReviewIntake(intake);
  const record = intake.record;
  const blocking = decision === 'rejected';
  const finding = {
    finding_id: `${decision.replaceAll('_', '-')}-timing-finding`,
    severity: blocking ? 'blocking' : 'major',
    category: 'timing',
    delivery_modes: ['classroom', 'homeschool'],
    artifact_paths: ['teacher-packs/grade-5-science/water/teacher-guide.md'],
    lesson_ids: [],
    phase_ids: [],
    target_ids: [],
    description: 'Synthetic completed negative review finding.',
    evidence: 'Synthetic aggregate evidence only.',
    recommended_action: 'Resolve before a later review can supersede this record.',
    resolution_status: 'open',
    resolution_refs: [],
  };
  record.findings = [finding];
  record.blocking_findings = blocking ? [finding.finding_id] : [];
  record.required_changes = decision === 'changes_required' ? [{
    change_id: 'required-timing-change',
    finding_refs: [finding.finding_id],
    description: 'Correct the synthetic timing finding.',
    resolution_status: 'open',
    resolution_refs: [],
  }] : [];
  record.decision = {
    status: decision,
    rationale: 'Synthetic completed negative workflow evidence.',
  };
  return intake;
}

function completeNegativeTrialIntake(intake, decision) {
  const record = intake.record;
  const lessonId =
    record.evidence_identity.pedagogical_snapshot.lesson_dna_digests[0].lesson_id;
  const observation = categoricalObservation(lessonId);
  record.trial_status = 'analysed';
  record.context.lesson_ids = [lessonId];
  record.privacy.free_text_checked_for_identifiers = true;
  if (record.artifact_type === 'classroom_trial') {
    record.context.approximate_group_size = 24;
    record.timing_observations = [{
      lesson_id: lessonId,
      phase_id: 'activation',
      planned_minutes: 5,
      actual_minutes: 6,
      setup_feasible: true,
      transition_feasible: true,
      summary: 'Synthetic aggregate timing observation.',
    }];
    for (const field of [
      'instruction_comprehension',
      'retrieval_and_correction',
      'recall_and_transfer',
      'participation_and_completion',
      'language_support',
      'material_usability',
      'method_execution_observations',
    ]) record[field] = [structuredClone(observation)];
    record.safety_observations = [];
    record.lesson_dna_deviation_status = 'none_observed';
    record.decision = {
      status: decision,
      safe_to_repeat: decision !== 'repeat_trial_required',
      rationale: 'Synthetic completed negative classroom-trial evidence.',
    };
  } else {
    record.session_observations = [{
      lesson_id: lessonId,
      planned_minutes: 30,
      actual_minutes: 35,
      unplanned_adult_support: 'low',
      parent_role_bounded: true,
      summary: 'Synthetic aggregate home-session observation.',
    }];
    for (const field of [
      'instruction_comprehension',
      'adult_role',
      'learner_independence',
      'material_availability',
      'offline_and_printer_assumptions',
      'retrieval_and_correction',
      'language_scaffolds',
      'task_completion',
      'recall_and_transfer',
    ]) record[field] = [structuredClone(observation)];
    record.decision = {
      status: decision,
      safe_to_repeat: decision !== 'repeat_trial_required',
      parent_role_remained_bounded: true,
      rationale: 'Synthetic completed negative home-trial evidence.',
    };
  }
  return intake;
}

async function fingerprint(rootDir = process.cwd()) {
  const repository = await loadTeacherPackRepository({ rootDir });
  const index = repository.indexes.find((artifact) => artifact.file === packPath);
  return computeTeacherPackFingerprintFromRepository(repository, index);
}

async function updateYamlFile(absolute, mutate) {
  const document = parseDocument(await fs.readFile(absolute, 'utf8'), {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
  });
  assert.deepEqual(document.errors, []);
  mutate(document);
  await fs.writeFile(absolute, document.toString({ lineWidth: 100 }));
}

async function normalizedReviewFixture(rootDir, recordId) {
  const fixture = await prepare('teacher-review', {
    rootDir,
    baselineRootDir: process.cwd(),
    recordId,
  });
  const intakeAbsolute = path.join(fixture.directory, 'intake.json');
  const intake = completeReviewIntake(
    JSON.parse(await fs.readFile(intakeAbsolute, 'utf8')),
  );
  await fs.writeFile(intakeAbsolute, `${JSON.stringify(intake, null, 2)}\n`);
  const normalizedPath = path.relative(
    rootDir,
    path.join(fixture.directory, 'record.yaml'),
  );
  const normalized = await normalizePedagogicalEvidenceIntake({
    rootDir,
    baselineRootDir: process.cwd(),
    intakePath: fixture.intakePath,
    outputPath: normalizedPath,
  });
  return { fixture, normalizedPath, record: normalized.record, yaml: normalized.yaml };
}

test('authoritative evidence identity contains every staleness dimension', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  assert.equal(identity.content_fingerprint.value.length, 64);
  assert.equal(identity.content_fingerprint.file_count, 78);
  assert.equal(identity.pedagogical_snapshot.taxonomy_version, '1.0');
  assert.equal(identity.pedagogical_snapshot.taxonomy_digest.length, 64);
  assert.equal(identity.pedagogical_snapshot.selection_rules_digest.length, 64);
  assert.equal(identity.pedagogical_snapshot.selection_engine_version, '1.1');
  assert.equal(identity.pedagogical_snapshot.homeschool_engine_version, '1.0');
  assert.equal(identity.pedagogical_snapshot.homeschool_rules_digest.length, 64);
  assert.equal(identity.pedagogical_snapshot.quality_catalogue_digest.length, 64);
  assert.equal(identity.pedagogical_snapshot.lesson_dna_digests.length, 4);
});

test('commit SHA does not participate in staleness equality', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  const other = structuredClone(identity);
  other.commit_sha = 'f'.repeat(40);
  assert.equal(pedagogicalEvidenceIdentityMatches(other, identity), true);
});

test('content fingerprint change is stale', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  const other = structuredClone(identity);
  other.content_fingerprint.value = '0'.repeat(64);
  assert.equal(pedagogicalEvidenceIdentityMatches(other, identity), false);
  assert.deepEqual(
    pedagogicalEvidenceIdentityMismatches(other, identity).map((entry) => entry.field),
    ['content_fingerprint.value'],
  );
});

test('fingerprint freshness compares algorithm, specification, value, and file count', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  for (const mutate of [
    (recorded) => { recorded.content_fingerprint.algorithm = 'sha512'; },
    (recorded) => { recorded.content_fingerprint.specification_version = '9.9'; },
    (recorded) => { recorded.content_fingerprint.value = 'f'.repeat(64); },
    (recorded) => { recorded.content_fingerprint.file_count += 1; },
  ]) {
    const recorded = structuredClone(identity);
    mutate(recorded);
    assert.equal(pedagogicalEvidenceIdentityMatches(recorded, identity), false);
  }
});

test('selection identity change is stale', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  const other = structuredClone(identity);
  other.pedagogical_snapshot.selection_rules_version = '9.9';
  assert.equal(pedagogicalEvidenceIdentityMatches(other, identity), false);
});

test('lesson DNA change is stale', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  const other = structuredClone(identity);
  other.pedagogical_snapshot.lesson_dna_digests[0].digest = '0'.repeat(64);
  assert.equal(pedagogicalEvidenceIdentityMatches(other, identity), false);
});

test('rule digests ignore formatting but detect semantic change without a version bump', async () => {
  const rootDir = await temporaryRepository();
  const rulesPath =
    'knowledge/pedagogy/selection/selection-rules.yaml';
  const rulesAbsolute = path.join(rootDir, rulesPath);
  try {
    const initial = await buildPedagogicalEvidenceIdentity({
      rootDir,
      packPath,
      commitSha: 'a'.repeat(40),
    });
    await fs.appendFile(rulesAbsolute, '\n# formatting-only regression comment\n');
    const formatted = await buildPedagogicalEvidenceIdentity({
      rootDir,
      packPath,
      commitSha: 'a'.repeat(40),
    });
    assert.equal(
      formatted.identity.pedagogical_snapshot.selection_rules_digest,
      initial.identity.pedagogical_snapshot.selection_rules_digest,
    );
    await updateYamlFile(rulesAbsolute, (document) => {
      const current = document.getIn(
        ['delivery_fit', 'large_class_group_size_threshold'],
      );
      document.setIn(
        ['delivery_fit', 'large_class_group_size_threshold'],
        current + 1,
      );
    });
    const changed = await buildPedagogicalEvidenceIdentity({
      rootDir,
      packPath,
      commitSha: 'a'.repeat(40),
    });
    assert.notEqual(
      changed.identity.pedagogical_snapshot.selection_rules_digest,
      initial.identity.pedagogical_snapshot.selection_rules_digest,
    );
    assert.equal(
      changed.identity.pedagogical_snapshot.selection_rules_version,
      initial.identity.pedagogical_snapshot.selection_rules_version,
    );
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

for (const [label, text, expected] of [
  ['email', 'learner@example.com', 'email_address'],
  ['phone', '+372 5555 1234', 'phone_number'],
  ['personal code', '50101010007', 'personal_identification_code'],
  ['address', 'Tartu tee 12', 'postal_address'],
  ['private media', 'https://drive.google.com/private', 'private_media_url'],
]) {
  test(`privacy scanner detects ${label}`, () => {
    const risks = findPedagogicalEvidencePrivacyRisks({
      privacy: { free_text_checked_for_identifiers: true },
      note: text,
    });
    assert.ok(risks.some((risk) => risk.code === expected), JSON.stringify(risks));
  });
}

test('privacy attestation remains mandatory even when automatic scan is clean', () => {
  assert.throws(
    () => assertPedagogicalEvidencePrivacy({
      privacy: {
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
        free_text_checked_for_identifiers: false,
      },
    }),
    /privacy declaration is incomplete/u,
  );
});

test('strict evidence JSON rejects duplicate object keys', () => {
  assert.throws(
    () => parseStrictPedagogicalEvidenceJson(
      '{\"kind\":\"teacher-review\",\"kind\":\"home-trial\"}',
      'duplicate-intake.json',
    ),
    /Map keys must be unique|duplicate/iu,
  );
});

for (const kind of ['teacher-review', 'classroom-trial', 'home-trial']) {
  test(`prepare creates deterministic ${kind} JSON and checklist`, async () => {
    const fixture = await prepare(kind);
    try {
      const intake = JSON.parse(await fs.readFile(
        path.join(fixture.directory, 'intake.json'),
        'utf8',
      ));
      const checklist = await fs.readFile(fixture.checklistPath, 'utf8');
      assert.equal(intake.kind, kind);
      assert.equal(intake.prepared_for_date, '2026-08-01');
      assert.equal(intake.record.evidence_identity.content_fingerprint.file_count, 78);
      assert.match(checklist, /Exact artifact checklist/u);
      assert.match(checklist, /lesson DNA|selected-target/iu);
      assert.match(checklist, /`activation` → `brainstorming`/u);
      assert.match(
        checklist,
        new RegExp(`Record ID: .grade-5-science-water-${kind}-2026-08-01.`),
      );
      assert.doesNotMatch(checklist, /current timestamp/iu);
    } finally {
      await fs.rm(fixture.directory, { recursive: true, force: true });
    }
  });
}

test('normalization is byte-deterministic', async () => {
  const fixture = await prepare();
  try {
    const first = await normalizePedagogicalEvidenceIntake({
      intakePath: fixture.intakePath,
    });
    const second = await normalizePedagogicalEvidenceIntake({
      intakePath: fixture.intakePath,
    });
    assert.equal(first.yaml, second.yaml);
    assert.equal(first.yaml, serializeCanonicalEvidenceYaml(first.record));
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

test('normalization rejects stale intake snapshot', async () => {
  const fixture = await prepare();
  try {
    const absolute = path.join(fixture.directory, 'intake.json');
    const intake = JSON.parse(await fs.readFile(absolute, 'utf8'));
    intake.record.evidence_identity.pedagogical_snapshot.taxonomy_version = '9.9';
    await fs.writeFile(absolute, `${JSON.stringify(intake, null, 2)}\n`);
    await assert.rejects(
      normalizePedagogicalEvidenceIntake({ intakePath: fixture.intakePath }),
      /stale/u,
    );
  } finally {
    await fs.rm(fixture.directory, { recursive: true, force: true });
  }
});

test('registration requires explicit write flag', async () => {
  await assert.rejects(
    registerPedagogicalEvidence({
      packPath,
      recordPath: 'missing.yaml',
      targetPath: 'pedagogical-reviews/x/records/x.yaml',
    }),
    /explicit --write/u,
  );
});

test('successful evidence registration leaves fingerprint and file count unchanged', async () => {
  const rootDir = await temporaryRepository();
  const fixture = await prepare('teacher-review', {
    rootDir,
    baselineRootDir: process.cwd(),
  });
  const indexAbsolute = path.join(rootDir, packPath);
  const reportAbsolute = path.join(
    rootDir,
    'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json',
  );
  const targetPath =
    'pedagogical-reviews/grade-5-science/water/records/grade-5-science-water-teacher-review-2026-08-01.yaml';
  const targetAbsolute = path.join(rootDir, targetPath);
  const originalIndex = await fs.readFile(indexAbsolute);
  const originalReport = await fs.readFile(reportAbsolute);
  try {
    const intakeAbsolute = path.join(fixture.directory, 'intake.json');
    const intake = completeReviewIntake(
      JSON.parse(await fs.readFile(intakeAbsolute, 'utf8')),
    );
    await fs.writeFile(intakeAbsolute, `${JSON.stringify(intake, null, 2)}\n`);
    const normalizedPath = path.relative(
      rootDir,
      path.join(fixture.directory, 'record.yaml'),
    );
    await normalizePedagogicalEvidenceIntake({
      rootDir,
      baselineRootDir: process.cwd(),
      intakePath: fixture.intakePath,
      outputPath: normalizedPath,
    });
    const before = await fingerprint(rootDir);
    const result = await registerPedagogicalEvidence({
      rootDir,
      baselineRootDir: process.cwd(),
      packPath,
      recordPath: normalizedPath,
      targetPath,
      write: true,
    });
    assert.deepEqual(result.before, result.after);
    assert.equal(result.after.value, before.value);
    assert.equal(result.after.file_count, before.file_count);
    const registeredIndex = await fs.readFile(indexAbsolute, 'utf8');
    assert.match(
      registeredIndex,
      /grade-5-science-water-teacher-review-2026-08-01\.yaml/u,
    );
    const retry = await registerPedagogicalEvidence({
      rootDir,
      baselineRootDir: process.cwd(),
      packPath,
      recordPath: normalizedPath,
      targetPath,
      write: true,
    });
    assert.equal(retry.already_registered, true);
    const normalizedAbsolute = path.join(rootDir, normalizedPath);
    const originalNormalized = await fs.readFile(normalizedAbsolute, 'utf8');
    const changed = originalNormalized.replace(
      'Synthetic workflow fixture only; no production approval.',
      'Different immutable evidence bytes.',
    );
    assert.notEqual(changed, originalNormalized);
    await fs.writeFile(normalizedAbsolute, changed);
    await assert.rejects(
      registerPedagogicalEvidence({
        rootDir,
        baselineRootDir: process.cwd(),
        packPath,
        recordPath: normalizedPath,
        targetPath,
        write: true,
      }),
      (error) => error.code === 'pedagogical_evidence_target_exists',
    );
  } finally {
    await fs.writeFile(indexAbsolute, originalIndex);
    await fs.writeFile(reportAbsolute, originalReport);
    await fs.rm(targetAbsolute, { force: true });
    await fs.rmdir(path.dirname(targetAbsolute)).catch(() => {});
    await fs.rm(fixture.directory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('registration rolls back when a reviewable byte changes during transaction', async () => {
  const rootDir = await temporaryRepository();
  const fixture = await prepare('teacher-review', {
    rootDir,
    baselineRootDir: process.cwd(),
  });
  const indexAbsolute = path.join(rootDir, packPath);
  const reviewable =
    'teacher-packs/grade-5-science/water/lessons/lesson-01.md';
  const reviewableAbsolute = path.join(rootDir, reviewable);
  const targetPath =
    'pedagogical-reviews/grade-5-science/water/records/grade-5-science-water-teacher-review-2026-08-01.yaml';
  const targetAbsolute = path.join(rootDir, targetPath);
  const originalIndex = await fs.readFile(indexAbsolute);
  const originalReviewable = await fs.readFile(reviewableAbsolute);
  try {
    const intakeAbsolute = path.join(fixture.directory, 'intake.json');
    const intake = completeReviewIntake(
      JSON.parse(await fs.readFile(intakeAbsolute, 'utf8')),
    );
    await fs.writeFile(intakeAbsolute, `${JSON.stringify(intake, null, 2)}\n`);
    const normalizedPath = path.relative(
      rootDir,
      path.join(fixture.directory, 'record.yaml'),
    );
    await normalizePedagogicalEvidenceIntake({
      rootDir,
      baselineRootDir: process.cwd(),
      intakePath: fixture.intakePath,
      outputPath: normalizedPath,
    });
    await assert.rejects(
      registerPedagogicalEvidence({
        rootDir,
        baselineRootDir: process.cwd(),
        packPath,
        recordPath: normalizedPath,
        targetPath,
        write: true,
        afterWrite: async () => {
          await fs.appendFile(reviewableAbsolute, '\ntransaction mutation\n');
        },
      }),
      /changed the reviewable fingerprint/u,
    );
    assert.equal(await fs.readFile(indexAbsolute, 'utf8'), originalIndex.toString());
    await assert.rejects(fs.stat(targetAbsolute), { code: 'ENOENT' });
  } finally {
    await fs.writeFile(indexAbsolute, originalIndex);
    await fs.writeFile(reviewableAbsolute, originalReviewable);
    await fs.rm(targetAbsolute, { force: true });
    await fs.rmdir(path.dirname(targetAbsolute)).catch(() => {});
    await fs.rm(fixture.directory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('completed negative evidence registers with scoped negative status and stable fingerprint', async () => {
  const rootDir = await temporaryRepository();
  const indexAbsolute = path.join(rootDir, packPath);
  const reportAbsolute = path.join(
    rootDir,
    'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json',
  );
  const originalIndex = await fs.readFile(indexAbsolute);
  const originalReport = await fs.readFile(reportAbsolute);
  const cases = [
    ['teacher-review', 'changes_required', 'changes_requested'],
    ['teacher-review', 'rejected', 'rejected'],
    ['classroom-trial', 'changes_required', 'changes_required'],
    ['classroom-trial', 'repeat_trial_required', 'repeat_required'],
    ['home-trial', 'changes_required', 'changes_required'],
    ['home-trial', 'repeat_trial_required', 'repeat_required'],
  ];
  try {
    const expectedFingerprint = await fingerprint(rootDir);
    for (const [kind, decision, expectedStatus] of cases) {
      const recordId =
        `grade-5-science-water-${kind}-${decision.replaceAll('_', '-')}-2026-08-01`;
      const fixture = await prepare(kind, {
        rootDir,
        baselineRootDir: process.cwd(),
        recordId,
      });
      const targetPath =
        `pedagogical-reviews/grade-5-science/water/records/${recordId}.yaml`;
      const targetAbsolute = path.join(rootDir, targetPath);
      try {
        const intakeAbsolute = path.join(fixture.directory, 'intake.json');
        const intake = JSON.parse(await fs.readFile(intakeAbsolute, 'utf8'));
        if (kind === 'teacher-review') {
          completeNegativeReviewIntake(intake, decision);
        } else {
          completeNegativeTrialIntake(intake, decision);
        }
        await fs.writeFile(intakeAbsolute, `${JSON.stringify(intake, null, 2)}\n`);
        const normalizedPath = path.relative(
          rootDir,
          path.join(fixture.directory, 'record.yaml'),
        );
        await normalizePedagogicalEvidenceIntake({
          rootDir,
          baselineRootDir: process.cwd(),
          intakePath: fixture.intakePath,
          outputPath: normalizedPath,
        });
        const result = await registerPedagogicalEvidence({
          rootDir,
          baselineRootDir: process.cwd(),
          packPath,
          recordPath: normalizedPath,
          targetPath,
          write: true,
        });
        assert.equal(result.state.registerable, true);
        assert.equal(result.state.positive_effective, false);
        assert.equal(result.state.negative_effective, true);
        assert.deepEqual(result.before, expectedFingerprint);
        assert.deepEqual(result.after, expectedFingerprint);
        assert.equal(result.readiness.classroom_ready, false);
        assert.equal(result.readiness.homeschool_ready, false);
        const status = kind === 'teacher-review'
          ? result.readiness.teacher_review.status
          : kind === 'classroom-trial'
            ? result.readiness.classroom_trial.status
            : result.readiness.home_trial.status;
        assert.equal(status, expectedStatus);
      } finally {
        await fs.writeFile(indexAbsolute, originalIndex);
        await fs.writeFile(reportAbsolute, originalReport);
        await fs.rm(targetAbsolute, { force: true });
        await fs.rm(fixture.directory, { recursive: true, force: true });
      }
    }
  } finally {
    await fs.writeFile(indexAbsolute, originalIndex);
    await fs.writeFile(reportAbsolute, originalReport);
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('full repository validation rejects a duplicate evidence ID and rolls back', async () => {
  const rootDir = await temporaryRepository();
  const recordId = 'duplicate-review-2026-08-01';
  const prepared = await normalizedReviewFixture(rootDir, recordId);
  const indexAbsolute = path.join(rootDir, packPath);
  const reportAbsolute = path.join(
    rootDir,
    'evaluations/pedagogy-readiness/grade-5-water-readiness-report.json',
  );
  const legacyPath =
    'pedagogical-reviews/grade-5-science/water/records/legacy-duplicate-record.yaml';
  const legacyAbsolute = path.join(rootDir, legacyPath);
  const targetPath =
    `pedagogical-reviews/grade-5-science/water/records/${recordId}.yaml`;
  const targetAbsolute = path.join(rootDir, targetPath);
  try {
    await fs.mkdir(path.dirname(legacyAbsolute), { recursive: true });
    await fs.writeFile(legacyAbsolute, prepared.yaml);
    await updateYamlFile(indexAbsolute, (document) => {
      document.setIn(
        ['pedagogical_review', 'review_record_paths'],
        [legacyPath],
      );
      document.setIn(['pedagogical_review', 'status'], 'approved_for_both');
      document.setIn(['pedagogical_review', 'classroom_status'], 'approved');
      document.setIn(['pedagogical_review', 'homeschool_status'], 'approved');
    });
    const beforeIndex = await fs.readFile(indexAbsolute);
    const beforeReport = await fs.readFile(reportAbsolute);
    await assert.rejects(
      registerPedagogicalEvidence({
        rootDir,
        baselineRootDir: process.cwd(),
        packPath,
        recordPath: prepared.normalizedPath,
        targetPath,
        write: true,
      }),
      (error) => (
        error.code === 'pedagogical_evidence_repository_invalid'
        && /duplicate review ID/u.test(error.message)
      ),
    );
    assert.deepEqual(await fs.readFile(indexAbsolute), beforeIndex);
    assert.deepEqual(await fs.readFile(reportAbsolute), beforeReport);
    await assert.rejects(fs.lstat(targetAbsolute), { code: 'ENOENT' });
  } finally {
    await fs.rm(prepared.fixture.directory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('registration rejects a target in another teacher-pack evidence directory', async () => {
  const rootDir = await temporaryRepository();
  const recordId = 'wrong-pack-review-2026-08-01';
  const prepared = await normalizedReviewFixture(rootDir, recordId);
  const targetPath =
    `pedagogical-reviews/grade-5-science/water-use-cycle/records/${recordId}.yaml`;
  try {
    await assert.rejects(
      registerPedagogicalEvidence({
        rootDir,
        baselineRootDir: process.cwd(),
        packPath,
        recordPath: prepared.normalizedPath,
        targetPath,
        write: true,
      }),
      (error) => error.code === 'pedagogical_evidence_target_pack_mismatch',
    );
    await assert.rejects(
      fs.lstat(path.join(rootDir, targetPath)),
      { code: 'ENOENT' },
    );
  } finally {
    await fs.rm(prepared.fixture.directory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('concurrent evidence link is preserved and re-derived during rollback', async () => {
  const rootDir = await temporaryRepository();
  const primaryId = 'primary-concurrent-review-2026-08-01';
  const concurrentId = 'parallel-concurrent-review-2026-08-02';
  const prepared = await normalizedReviewFixture(rootDir, primaryId);
  const primaryPath =
    `pedagogical-reviews/grade-5-science/water/records/${primaryId}.yaml`;
  const parallelPath =
    `pedagogical-reviews/grade-5-science/water/records/${concurrentId}.yaml`;
  const primaryAbsolute = path.join(rootDir, primaryPath);
  const parallelAbsolute = path.join(rootDir, parallelPath);
  const indexAbsolute = path.join(rootDir, packPath);
  const parallel = structuredClone(prepared.record);
  parallel.review_id = concurrentId;
  parallel.reviewed_at = '2026-08-02';
  try {
    await fs.mkdir(path.dirname(parallelAbsolute), { recursive: true });
    await fs.writeFile(parallelAbsolute, serializeCanonicalEvidenceYaml(parallel));
    await assert.rejects(
      registerPedagogicalEvidence({
        rootDir,
        baselineRootDir: process.cwd(),
        packPath,
        recordPath: prepared.normalizedPath,
        targetPath: primaryPath,
        write: true,
        afterWrite: async () => {
          await updateYamlFile(indexAbsolute, (document) => {
            const current = document.getIn(
              ['pedagogical_review', 'review_record_paths'],
            )?.toJSON?.() ?? [];
            document.setIn(
              ['pedagogical_review', 'review_record_paths'],
              [...new Set([...current, parallelPath])].sort(),
            );
          });
        },
      }),
      (error) => error.code === 'pedagogical_evidence_concurrent_index_change',
    );
    const indexText = await fs.readFile(indexAbsolute, 'utf8');
    assert.match(indexText, new RegExp(concurrentId));
    assert.doesNotMatch(indexText, new RegExp(primaryId));
    await assert.rejects(fs.lstat(primaryAbsolute), { code: 'ENOENT' });
    assert.equal((await fs.lstat(parallelAbsolute)).isFile(), true);
    const repository = await loadPedagogicalReviewRepository({
      rootDir,
      identityCommitSha: 'a'.repeat(40),
    });
    assert.equal(
      validatePedagogicalReviewRepository(repository).summary.errors,
      0,
    );
  } finally {
    await fs.rm(prepared.fixture.directory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('real repository artifacts reject twenty-one semantic evidence mutations', async (t) => {
  const rootDir = await temporaryRepository();
  const indexAbsolute = path.join(rootDir, packPath);
  const originalIndex = await fs.readFile(indexAbsolute);
  const built = await buildPedagogicalEvidenceIdentity({
    rootDir,
    packPath,
    commitSha: 'a'.repeat(40),
  });
  const lessonIds = built.index.data.lesson_ids;
  const firstLesson = lessonIds[0];
  const secondLesson = lessonIds[1];
  const evidenceDirectory = path.join(
    rootDir,
    'pedagogical-reviews/grade-5-science/water/records',
  );
  const finding = ({
    severity = 'major',
    category = 'timing',
    deliveryModes = ['classroom'],
    artifactPaths = ['teacher-packs/grade-5-science/water/teacher-guide.md'],
  } = {}) => ({
    finding_id: `matrix-${severity}-${category}`,
    severity,
    category,
    delivery_modes: deliveryModes,
    artifact_paths: artifactPaths,
    lesson_ids: [firstLesson],
    phase_ids: [],
    target_ids: [],
    description: 'Synthetic semantic mutation finding.',
    evidence: 'Synthetic aggregate evidence.',
    recommended_action: 'Correct the mutation.',
    resolution_status: 'open',
    resolution_refs: [],
  });
  const cases = [
    {
      name: 'empty successful classroom trial',
      kind: 'classroom',
      mutate(record) {
        for (const field of [
          'timing_observations',
          'instruction_comprehension',
          'retrieval_and_correction',
          'recall_and_transfer',
          'participation_and_completion',
          'language_support',
          'material_usability',
          'safety_observations',
          'method_execution_observations',
        ]) record[field] = [];
      },
      expected: /fewer than 1|meaningful/iu,
    },
    {
      name: 'empty successful home trial',
      kind: 'home',
      mutate(record) {
        for (const field of [
          'session_observations',
          'instruction_comprehension',
          'adult_role',
          'learner_independence',
          'material_availability',
          'offline_and_printer_assumptions',
          'retrieval_and_correction',
          'language_scaffolds',
          'task_completion',
          'recall_and_transfer',
        ]) record[field] = [];
      },
      expected: /fewer than 1|meaningful/iu,
    },
    {
      name: 'successful trial unsafe to repeat',
      kind: 'classroom',
      mutate(record) { record.decision.safe_to_repeat = false; },
      expected: /safe_to_repeat: true/u,
    },
    {
      name: 'unknown classroom lesson reference',
      kind: 'classroom',
      mutate(record) {
        record.context.lesson_ids = ['unknown-water-lesson'];
        record.timing_observations[0].lesson_id = 'unknown-water-lesson';
      },
      expected: /unknown linked lesson/iu,
    },
    {
      name: 'unknown classroom phase reference',
      kind: 'classroom',
      mutate(record) { record.timing_observations[0].phase_id = 'unknown-phase'; },
      expected: /unknown classroom phase/iu,
    },
    {
      name: 'wrong deviation target reference',
      kind: 'classroom',
      mutate(record) {
        record.lesson_dna_deviation_status = 'observed';
        record.lesson_dna_deviations = [{
          lesson_id: firstLesson,
          phase_ids: ['activation'],
          target_ids: ['unbound-target'],
          description: 'Synthetic wrong target.',
          reason: 'Reference integrity mutation.',
        }];
      },
      expected: /not bound to the referenced classroom phase/iu,
    },
    {
      name: 'minor review note without plan',
      kind: 'review',
      mutate(record) {
        record.findings = [finding({ severity: 'minor' })];
        record.decision.status = 'approved_with_minor_notes';
      },
      expected: /bounded minor plans/iu,
    },
    {
      name: 'reviewer email reference',
      kind: 'review',
      mutate(record) { record.reviewer.reviewer_reference = 'reviewer@example.com'; },
      expected: /must match pattern|privacy-risk/iu,
    },
    {
      name: 'reviewer full-name reference',
      kind: 'review',
      mutate(record) { record.reviewer.reviewer_reference = 'Ada Lovelace'; },
      expected: /must match pattern/iu,
    },
    {
      name: 'reviewer private URL reference',
      kind: 'review',
      mutate(record) {
        record.reviewer.reviewer_reference = 'https://example.com/private';
      },
      expected: /must match pattern/iu,
    },
    {
      name: 'classroom review rates out-of-scope homeschool dimension',
      kind: 'review-classroom',
      mutate(record) {
        record.ratings.homeschool_clarity = 4;
        record.rating_applicability = record.rating_applicability.filter(
          (entry) => entry.dimension !== 'homeschool_clarity',
        );
      },
      expected: /out-of-scope rating/iu,
    },
    {
      name: 'home review rates out-of-scope classroom dimension',
      kind: 'review-home',
      mutate(record) {
        record.ratings.classroom_feasibility = 4;
        record.rating_applicability = [];
      },
      expected: /out-of-scope rating/iu,
    },
    {
      name: 'classroom finding claims homeschool delivery',
      kind: 'classroom',
      mutate(record) {
        record.findings = [finding({ deliveryModes: ['homeschool'] })];
        record.decision.status = 'changes_required';
      },
      expected: /outside this evidence record scope/iu,
    },
    {
      name: 'finding references missing artifact',
      kind: 'review',
      mutate(record) {
        const item = finding({
          severity: 'minor',
          artifactPaths: ['teacher-packs/grade-5-science/water/missing.md'],
        });
        item.resolution_status = 'resolved';
        record.findings = [item];
      },
      expected: /unresolved finding artifact/iu,
    },
    {
      name: 'successful trial retains major safety finding',
      kind: 'classroom',
      mutate(record) {
        record.findings = [finding({ severity: 'major', category: 'safety' })];
      },
      expected: /cannot retain open blocking or major/iu,
    },
    {
      name: 'repeat-required trial marked safe',
      kind: 'classroom',
      mutate(record) {
        record.decision.status = 'repeat_trial_required';
        record.decision.safe_to_repeat = true;
      },
      expected: /repeat_trial_required.*safe_to_repeat: false/iu,
    },
    {
      name: 'changes-required safety trial marked safe',
      kind: 'classroom',
      mutate(record) {
        record.findings = [finding({ severity: 'major', category: 'safety' })];
        record.decision.status = 'changes_required';
        record.decision.safe_to_repeat = true;
      },
      expected: /safety blocker requires safe_to_repeat: false/iu,
    },
    {
      name: 'observed deviation has no deviation record',
      kind: 'classroom',
      mutate(record) {
        record.lesson_dna_deviation_status = 'observed';
        record.lesson_dna_deviations = [];
      },
      expected: /fewer than 1|explicitly record deviations/iu,
    },
    {
      name: 'classroom observations do not cover every context lesson',
      kind: 'classroom',
      mutate(record) { record.context.lesson_ids = [firstLesson, secondLesson]; },
      expected: /entry for .*water-02|coverage for every context lesson/iu,
    },
    {
      name: 'home observations do not cover every context lesson',
      kind: 'home',
      mutate(record) { record.context.lesson_ids = [firstLesson, secondLesson]; },
      expected: /entry for .*water-02|coverage for every context lesson/iu,
    },
    {
      name: 'home trial adult role contradicts adaptation contract',
      kind: 'home',
      mutate(record) { record.context.adult_role = 'active_participant'; },
      expected: /not allowed by the home adaptation/iu,
    },
  ];
  try {
    for (const [caseIndex, item] of cases.entries()) {
      await t.test(item.name, async () => {
        await fs.writeFile(indexAbsolute, originalIndex);
        await fs.rm(evidenceDirectory, { recursive: true, force: true });
        let record;
        if (item.kind === 'classroom') {
          record = createRegressionClassroomTrial(built.identity, firstLesson);
        } else if (item.kind === 'home') {
          record = createRegressionHomeTrial(built.identity, firstLesson);
        } else {
          const scopes = item.kind === 'review-classroom'
            ? ['classroom']
            : item.kind === 'review-home'
              ? ['homeschool']
              : ['classroom', 'homeschool'];
          record = createRegressionTeacherReview(
            built.identity,
            lessonIds,
            scopes,
          );
        }
        const id = `matrix-evidence-${String(caseIndex + 1).padStart(2, '0')}`;
        if (record.artifact_type === 'teacher_review') record.review_id = id;
        else record.trial_id = id;
        item.mutate(record);
        const repositoryPath =
          `pedagogical-reviews/grade-5-science/water/records/${id}.yaml`;
        await fs.mkdir(evidenceDirectory, { recursive: true });
        await fs.writeFile(
          path.join(rootDir, repositoryPath),
          serializeCanonicalEvidenceYaml(record),
        );
        await updateYamlFile(indexAbsolute, (document) => {
          document.setIn(['pedagogical_review', 'review_record_paths'], []);
          document.setIn(['pedagogical_review', 'status'], 'pending');
          document.setIn(['pedagogical_review', 'classroom_status'], 'pending');
          document.setIn(['pedagogical_review', 'homeschool_status'], 'pending');
          document.setIn(['classroom_trial', 'trial_record_paths'], []);
          document.setIn(['classroom_trial', 'status'], 'not_tested');
          document.setIn(['home_trial', 'trial_record_paths'], []);
          document.setIn(['home_trial', 'status'], 'not_started');
          if (record.artifact_type === 'teacher_review') {
            document.setIn(
              ['pedagogical_review', 'review_record_paths'],
              [repositoryPath],
            );
          } else if (record.artifact_type === 'classroom_trial') {
            document.setIn(
              ['classroom_trial', 'trial_record_paths'],
              [repositoryPath],
            );
          } else {
            document.setIn(
              ['home_trial', 'trial_record_paths'],
              [repositoryPath],
            );
          }
        });
        const repository = await loadPedagogicalReviewRepository({
          rootDir,
          identityCommitSha: 'a'.repeat(40),
        });
        const diagnostics = validatePedagogicalReviewRepository(repository)
          .diagnostics.filter((entry) => entry.severity === 'error');
        assert.match(
          diagnostics.map((entry) => entry.reason).join('\n'),
          item.expected,
        );
      });
    }
  } finally {
    await fs.writeFile(indexAbsolute, originalIndex);
    await fs.rm(evidenceDirectory, { recursive: true, force: true });
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});
