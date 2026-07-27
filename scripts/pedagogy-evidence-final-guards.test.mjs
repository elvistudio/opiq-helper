import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { before, test } from 'node:test';
import {
  assertPedagogicalEvidenceFinalGuards,
  writeNormalizedPedagogicalEvidenceFile,
} from './lib/pedagogical-evidence-final-guards.mjs';
import {
  buildPedagogicalEvidenceIdentity,
  createPedagogicalEvidenceValidators,
  serializeCanonicalEvidenceYaml,
} from './lib/pedagogical-evidence.mjs';
import {
  createRegressionClassroomTrial,
  createRegressionHomeTrial,
  createRegressionTeacherReview,
} from './lib/pedagogy-readiness-regressions.mjs';

let built;
let validators;

before(async () => {
  built = await buildPedagogicalEvidenceIdentity({
    commitSha: 'a'.repeat(40),
  });
  ({ validators } = await createPedagogicalEvidenceValidators());
});

function classroomTrial() {
  return createRegressionClassroomTrial(
    built.identity,
    built.index.data.lesson_ids[0],
  );
}

function homeTrial() {
  return createRegressionHomeTrial(
    built.identity,
    built.index.data.lesson_ids[0],
  );
}

function teacherReview() {
  return createRegressionTeacherReview(
    built.identity,
    built.index.data.lesson_ids,
    ['classroom', 'homeschool'],
  );
}

test('terminal classroom evidence rejects zero-minute timing', () => {
  const record = classroomTrial();
  record.timing_observations[0].planned_minutes = 0;
  record.timing_observations[0].actual_minutes = 0;
  assert.equal(validators['classroom-trial'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_timing_invalid',
  );
});

test('terminal home evidence rejects zero-minute sessions', () => {
  const record = homeTrial();
  record.session_observations[0].actual_minutes = 0;
  assert.equal(validators['home-trial'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_timing_invalid',
  );
});

test('superseded review preserves historical evidence completeness', () => {
  const record = teacherReview();
  record.review_status = 'superseded';
  record.evidence_identity = null;
  record.reviewed_at = null;
  record.decision.status = 'pending';
  record.privacy.free_text_checked_for_identifiers = false;
  assert.equal(validators['teacher-review'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_superseded_incomplete',
  );
});

test('superseded trial preserves historical evidence completeness', () => {
  const record = classroomTrial();
  record.trial_status = 'superseded';
  record.evidence_identity = null;
  record.conducted_at = null;
  record.decision.status = 'pending';
  record.privacy.free_text_checked_for_identifiers = false;
  assert.equal(validators['classroom-trial'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_superseded_incomplete',
  );
});

test('approved_with_minor_notes requires an actual bounded minor finding', () => {
  const record = teacherReview();
  record.decision.status = 'approved_with_minor_notes';
  record.findings = [];
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_notes_missing',
  );
});

test('successful_with_notes requires an actual bounded minor finding', () => {
  const record = classroomTrial();
  record.decision.status = 'successful_with_notes';
  record.findings = [];
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_notes_missing',
  );
});

test('aggregate count and denominator must appear together', () => {
  const record = classroomTrial();
  delete record.instruction_comprehension[0].aggregate_denominator;
  assert.equal(validators['classroom-trial'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_aggregate_invalid',
  );
});

test('aggregate count cannot exceed its denominator', () => {
  const record = classroomTrial();
  record.instruction_comprehension[0].aggregate_count = 2;
  record.instruction_comprehension[0].aggregate_denominator = 1;
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_aggregate_invalid',
  );
});

test('terminal evidence rejects the template date placeholder in its ID', () => {
  const record = classroomTrial();
  record.trial_id = 'grade-5-water-classroom-trial-YYYY-MM-DD';
  assert.equal(validators['classroom-trial'](record), false);
  assert.throws(
    () => assertPedagogicalEvidenceFinalGuards(record),
    (error) => error.code === 'pedagogical_evidence_placeholder_id',
  );
});

test('normalization output is create-only and restricted to working paths', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-final-guards-'));
  const record = teacherReview();
  const yaml = serializeCanonicalEvidenceYaml(record);
  const outputPath = '.tmp-pedagogy-evidence-final-guards/record.yaml';
  try {
    await writeNormalizedPedagogicalEvidenceFile({
      rootDir,
      outputPath,
      yaml,
      record,
    });
    assert.equal(
      await fs.readFile(path.join(rootDir, outputPath), 'utf8'),
      yaml,
    );
    await assert.rejects(
      writeNormalizedPedagogicalEvidenceFile({
        rootDir,
        outputPath,
        yaml,
        record,
      }),
      (error) => error.code === 'pedagogical_evidence_output_exists',
    );
    for (const forbiddenPath of [
      'pedagogical-reviews/grade-5-science/water/records/review.yaml',
      'teacher-packs/grade-5-science/water/review.yaml',
      'source-manifest.json',
    ]) {
      await assert.rejects(
        writeNormalizedPedagogicalEvidenceFile({
          rootDir,
          outputPath: forbiddenPath,
          yaml,
          record,
        }),
        (error) => error.code === 'pedagogical_evidence_output_scope_forbidden',
      );
    }
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
});

test('normalization output rejects symlink ancestors', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-final-guards-'));
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-final-guards-out-'));
  const record = teacherReview();
  try {
    await fs.mkdir(path.join(rootDir, 'tmp'), { recursive: true });
    await fs.symlink(external, path.join(rootDir, 'tmp', 'escape'), 'dir');
    await assert.rejects(
      writeNormalizedPedagogicalEvidenceFile({
        rootDir,
        outputPath: 'tmp/escape/record.yaml',
        yaml: serializeCanonicalEvidenceYaml(record),
        record,
      }),
      (error) => error.code === 'pedagogical_evidence_output_symlink',
    );
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
    await fs.rm(external, { recursive: true, force: true });
  }
});
