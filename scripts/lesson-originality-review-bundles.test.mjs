import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import YAML from 'yaml';
import { computeCommercialOriginalityFingerprint } from './lib/commercial-course-schema.mjs';
import {
  buildLessonOriginalityReviewArtifacts,
  lessonOriginalityProjection,
  LESSON_ORIGINALITY_REVIEW_SCHEMA_PATH,
  validateLessonOriginalityReviewArtifacts,
} from './lib/lesson-originality-review-bundles.mjs';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function schemaValidator() {
  const schema = JSON.parse(await fs.readFile(path.join(rootDir, LESSON_ORIGINALITY_REVIEW_SCHEMA_PATH), 'utf8'));
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

function byLesson(artifacts, lessonId) {
  return artifacts.built.find((entry) => entry.bundle.lesson_id === lessonId)?.bundle;
}

test('builds exactly four deterministic pending lesson review bundles', async () => {
  const first = await buildLessonOriginalityReviewArtifacts(rootDir);
  const second = await buildLessonOriginalityReviewArtifacts(rootDir);
  assert.equal(first.built.length, 4);
  assert.equal(first.index.bundles.length, 4);
  assert.equal(first.index.approved_count, 0);
  assert.equal(first.index.pending_count, 4);
  assert.equal(first.index.review_completion_status, 'pending_human_review');
  assert.deepEqual(
    first.built.map((entry) => entry.bundle.content_fingerprint),
    second.built.map((entry) => entry.bundle.content_fingerprint),
  );
  assert.deepEqual(
    first.built.map((entry) => entry.bundle.bundle_fingerprint),
    second.built.map((entry) => entry.bundle.bundle_fingerprint),
  );
  for (const { bundle, lesson } of first.built) {
    assert.equal(bundle.review_status, 'pending');
    assert.equal(bundle.reviewer, null);
    assert.equal(bundle.reviewer_role, null);
    assert.equal(bundle.reviewed_on, null);
    assert.equal(bundle.reviewed_version.commit_sha, null);
    assert.equal(bundle.human_review_required, true);
    assert.equal(bundle.publication_unlocks, false);
    assert.equal(bundle.customer_visibility_unlocks, false);
    assert.match(bundle.content_fingerprint.value, /^[0-9a-f]{64}$/u);
    assert.match(bundle.commercial_gate_fingerprint.value, /^[0-9a-f]{64}$/u);
    assert.deepEqual(
      bundle.commercial_gate_fingerprint,
      computeCommercialOriginalityFingerprint(rootDir, lesson, bundle.covered_material_ids),
    );
    assert.match(bundle.bundle_fingerprint.value, /^[0-9a-f]{64}$/u);
    assert.ok(bundle.content_fingerprint.file_count > 0);
  }
});

test('task dependencies fail closed for lessons 3 and 4 while lesson 2 retains approved task reviews', async () => {
  const artifacts = await buildLessonOriginalityReviewArtifacts(rootDir);
  const lesson1 = byLesson(artifacts, 'grade-2-weather-water-safety-01-observation');
  const lesson2 = byLesson(artifacts, 'grade-2-weather-water-safety-02-data-time');
  const lesson3 = byLesson(artifacts, 'grade-2-weather-water-safety-03-safe-decisions');
  const lesson4 = byLesson(artifacts, 'grade-2-weather-water-safety-04-weather-report');
  assert.equal(lesson1.task_dependencies.length, 0);
  assert.equal(lesson1.approval_eligible, true);
  assert.deepEqual(lesson2.task_dependencies.map((entry) => entry.status), ['approved', 'approved']);
  assert.equal(lesson2.approval_eligible, true);
  assert.deepEqual(lesson3.task_dependencies.map((entry) => entry.status), ['pending', 'pending']);
  assert.equal(lesson3.approval_eligible, false);
  assert.equal(lesson3.blocking_review_ids.length, 2);
  assert.deepEqual(lesson4.task_dependencies.map((entry) => entry.status), ['pending', 'pending']);
  assert.equal(lesson4.approval_eligible, false);
  assert.equal(lesson4.blocking_review_ids.length, 2);
});

test('uses Estonian second-language route and preserves the lesson 3 PE missing-route boundary', async () => {
  const artifacts = await buildLessonOriginalityReviewArtifacts(rootDir);
  for (const { bundle } of artifacts.built) {
    assert.ok(bundle.source_context.route_ids.includes('grade-2-estonian-second-language'));
    assert.ok(!bundle.source_context.route_ids.includes('grade-2-estonian'));
    assert.ok(bundle.source_context.route_md_paths.includes('project-files/outputs/opiq_2klass_eesti_keel_teise_keelena.md'));
  }
  const lesson3Entry = artifacts.built.find((entry) => entry.bundle.lesson_id === 'grade-2-weather-water-safety-03-safe-decisions');
  const peRole = lesson3Entry.lesson.author_created_subject_roles.find((entry) => entry.subject === 'physical_education');
  assert.equal(peRole.source_status, 'missing_route');
  assert.deepEqual(peRole.route_ids, []);
  assert.equal(peRole.source_evidence_claimed, false);
  assert.equal(peRole.content_strategy, 'author_created_required');
  assert.equal(peRole.replacement_by_human_studies_forbidden, true);
  assert.match(lesson3Entry.bundle.source_context.source_limitations.join('\n'), /Physical education has no exact Grade 2 source route/u);
});

test('lesson projection excludes mutable review, source and readiness metadata but changes with instructional content', async () => {
  const lessonPath = path.join(rootDir, 'lesson-plans/grade-2/weather-water-safety/lesson-01-weather-observation.yaml');
  const lesson = YAML.parse(await fs.readFile(lessonPath, 'utf8'));
  const base = lessonOriginalityProjection(lesson);
  const reviewMutation = structuredClone(lesson);
  reviewMutation.originality_review.reviewer = 'should-not-affect-projection';
  reviewMutation.delivery_model.publication_status = 'customer_released';
  reviewMutation.opiq_companions[0].access.last_checked_on = '2099-01-01';
  assert.deepEqual(lessonOriginalityProjection(reviewMutation), base);
  const instructionalMutation = structuredClone(lesson);
  instructionalMutation.stages[0].teacher_action_ru += ' MUTATION';
  assert.notDeepEqual(lessonOriginalityProjection(instructionalMutation), base);
});

test('strict schema rejects fabricated human decisions, release unlocks, unsafe paths and a fifth index bundle', async () => {
  const validate = await schemaValidator();
  const artifacts = await buildLessonOriginalityReviewArtifacts(rootDir);
  const validBundle = structuredClone(artifacts.built[0].bundle);
  assert.equal(validate(validBundle), true, JSON.stringify(validate.errors));

  const fabricatedReviewer = structuredClone(validBundle);
  fabricatedReviewer.reviewer = 'not-allowed-in-prepared-bundle';
  assert.equal(validate(fabricatedReviewer), false);

  const releaseUnlock = structuredClone(validBundle);
  releaseUnlock.publication_unlocks = true;
  assert.equal(validate(releaseUnlock), false);

  const unsafePath = structuredClone(validBundle);
  unsafePath.covered_files[0].path = '../escape.md';
  assert.equal(validate(unsafePath), false);

  const indexWithFifth = structuredClone(artifacts.index);
  indexWithFifth.bundles.push(structuredClone(indexWithFifth.bundles[0]));
  assert.equal(validate(indexWithFifth), false);
});

test('repository-level bundle diagnostics are empty for the current prepared state', async () => {
  assert.deepEqual(await validateLessonOriginalityReviewArtifacts(rootDir), []);
});
