import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4ContentQualityArtifacts,
  contentQualityAuditPath,
  contentQualityReportPath,
} from './lib/grade-4-canonical-sources.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let artifacts;
let validate;

before(async () => {
  artifacts = await buildGrade4ContentQualityArtifacts(rootDir);
  const schema = JSON.parse(await readFile(
    path.join(rootDir, 'schemas/grade-4-content-quality-report.schema.json'),
    'utf8',
  ));
  validate = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false,
  }).compile(schema);
});

test('content-quality report is strict-schema-valid', () => {
  assert.equal(validate(artifacts.report), true, JSON.stringify(validate.errors));
});

test('canonical import and downstream course-building statuses remain separate', () => {
  assert.equal(artifacts.report.canonical_import_status, 'pass_with_warnings');
  assert.equal(artifacts.report.downstream_course_building_status, 'blocked');
});

test('report covers eleven routes and 2212 canonical records', () => {
  assert.equal(artifacts.report.route_results.length, 11);
  assert.equal(artifacts.report.scope.canonical_record_count, 2212);
  assert.equal(
    artifacts.report.route_results.reduce((sum, entry) => sum + entry.canonical_record_count, 0),
    2212,
  );
});

test('source integrity and route readiness pass', () => {
  const checks = Object.fromEntries(artifacts.report.checks.map((entry) => [entry.check_id, entry]));
  assert.equal(checks.source_integrity.status, 'pass');
  assert.equal(checks.canonical_route_readiness.status, 'pass');
});

test('full prose and live-catalogue completeness remain blocked', () => {
  const checks = Object.fromEntries(artifacts.report.checks.map((entry) => [entry.check_id, entry]));
  assert.equal(checks.complete_page_prose.status, 'blocked');
  assert.equal(checks.live_catalogue_completeness.status, 'blocked');
});

test('task availability is reported without a completeness claim', () => {
  const checks = Object.fromEntries(artifacts.report.checks.map((entry) => [entry.check_id, entry]));
  assert.equal(checks.task_availability.status, 'pass_with_warnings');
  assert.ok(artifacts.report.route_results.every((entry) => (
    ['pass', 'pass_with_warnings'].includes(entry.task_availability)
  )));
});

test('multi-grade support sources retain truthful grade scopes and no exclusive owner', () => {
  assert.deepEqual(
    artifacts.report.multi_grade_shared_sources.map((entry) => ({
      kit: entry.kit_id,
      grades: entry.grade_scope,
      exclusive: entry.exclusive_grade_4_owner,
    })),
    [
      { kit: '161', grades: [4, 5, 6], exclusive: false },
      { kit: '200', grades: [1, 2, 3, 4], exclusive: false },
      { kit: '476', grades: [4, 5, 6, 7, 8, 9], exclusive: false },
    ],
  );
});

test('only kit 200 retains an existing canonical owner', () => {
  const byKit = Object.fromEntries(
    artifacts.report.multi_grade_shared_sources.map((entry) => [entry.kit_id, entry]),
  );
  assert.equal(byKit['200'].canonical_owner, 'grade-2-arts-and-crafts');
  assert.equal(byKit['161'].canonical_owner, null);
  assert.equal(byKit['476'].canonical_owner, null);
});

test('downstream blockers are explicit and bounded', () => {
  assert.deepEqual(artifacts.report.downstream_blockers.map((entry) => entry.code), [
    'complete_page_prose_not_captured',
    'task_body_recapture_required',
    'live_catalogue_completeness_unverified',
  ]);
});

test('report contains explicit curriculum, catalogue, and effectiveness non-guarantees', () => {
  const text = artifacts.report.non_guarantees.join(' ');
  assert.match(text, /catalogue coverage/u);
  assert.match(text, /curriculum coverage/u);
  assert.match(text, /pedagogical effectiveness/u);
});

test('content-quality generation is byte-identical', async () => {
  const repeated = await buildGrade4ContentQualityArtifacts(rootDir);
  assert.equal(repeated.json, artifacts.json);
  assert.equal(repeated.markdown, artifacts.markdown);
});

test('committed content-quality files are current', async () => {
  assertCommittedBytes(
    artifacts.json,
    await readFile(path.join(rootDir, contentQualityReportPath)),
    contentQualityReportPath,
  );
  assertCommittedBytes(
    artifacts.markdown,
    await readFile(path.join(rootDir, contentQualityAuditPath)),
    contentQualityAuditPath,
  );
});
