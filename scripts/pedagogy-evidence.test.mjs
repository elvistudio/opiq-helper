import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
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
  } = {},
) {
  const directory = await temporaryDirectory(rootDir);
  await preparePedagogicalEvidenceBundle({
    rootDir,
    baselineRootDir,
    packPath,
    kind,
    recordId: `grade-5-science-water-${kind}-2026-08-01`,
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

async function fingerprint(rootDir = process.cwd()) {
  const repository = await loadTeacherPackRepository({ rootDir });
  const index = repository.indexes.find((artifact) => artifact.file === packPath);
  return computeTeacherPackFingerprintFromRepository(repository, index);
}

test('authoritative evidence identity contains every staleness dimension', async () => {
  const { identity } = await buildPedagogicalEvidenceIdentity();
  assert.equal(identity.content_fingerprint.value.length, 64);
  assert.equal(identity.content_fingerprint.file_count, 78);
  assert.equal(identity.pedagogical_snapshot.taxonomy_version, '1.0');
  assert.equal(identity.pedagogical_snapshot.selection_engine_version, '1.1');
  assert.equal(identity.pedagogical_snapshot.homeschool_engine_version, '1.0');
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
    'pedagogical-reviews/grade-5-science/water/records/test-review-2026-08-01.yaml';
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
    assert.match(registeredIndex, /test-review-2026-08-01\.yaml/u);
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
    'pedagogical-reviews/grade-5-science/water/records/test-rollback-2026-08-01.yaml';
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
