import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  classifyChangedPaths,
  classifyRepositoryPath,
} from './classify-source-validation-scope.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertCoreOnly(paths) {
  const result = classifyChangedPaths(paths);
  assert.equal(result.mode, 'core_only');
  assert.equal(result.run_pedagogy_quality, false);
  assert.equal(result.run_pedagogy_regressions, false);
  assert.equal(result.run_pedagogy_evidence, false);
  return result;
}

function assertFull(paths) {
  const result = classifyChangedPaths(paths);
  assert.equal(result.mode, 'full');
  assert.equal(result.run_pedagogy_quality, true);
  assert.equal(result.run_pedagogy_regressions, true);
  assert.equal(result.run_pedagogy_evidence, true);
  return result;
}

test('documentation-only changes stay in the core job', () => {
  assertCoreOnly(['docs/pedagogy-regressions.md', 'README.md']);
});

test('issue-template changes stay in the core job', () => {
  assertCoreOnly(['.github/ISSUE_TEMPLATE/source-gap.yml']);
});

test('task-bank artifacts and their fixtures stay in the core job', () => {
  assertCoreOnly([
    'task-bank/tasks/grade-2-water.yaml',
    'test-fixtures/task-bank/stale-review.yaml',
  ]);
});

test('grade 1 through 4 content roots stay in the core job', () => {
  const result = assertCoreOnly([
    'curriculum-maps/grade-2-science/coverage-matrix.yaml',
    'grade-programmes/grade-3/programme-architecture.yaml',
    'teacher-packs/grade-4-science/materials-index.yaml',
    'external-sources/opiq/grade-1-mathematics/source.md',
  ]);
  assert.deepEqual(result.reason_codes, [
    'grade_1_content',
    'grade_2_content',
    'grade_3_content',
    'grade_4_content',
  ]);
});

test('mixed bounded core-only changes stay core-only', () => {
  const result = assertCoreOnly([
    'docs/audits/grade-2-content-quality.md',
    'lesson-plans/grade-4-science/weather/lesson-01.yaml',
    'task-bank/task-bank-index.yaml',
  ]);
  assert.equal(result.changed_path_count, 3);
});

test('source manifest changes require the full suite', () => {
  assertFull(['source-manifest.json']);
});

test('script changes require the full suite even when grade-specific', () => {
  assertFull(['scripts/generate-grade-2-source-indexes.mjs']);
});

test('schema changes require the full suite even when grade-specific', () => {
  assertFull(['schemas/grade-2-programme.schema.json']);
});

test('package definition changes require the full suite', () => {
  assertFull(['package.json', 'package-lock.json']);
});

test('workflow changes require the full suite', () => {
  assertFull(['.github/workflows/validate-source-manifest.yml']);
});

test('shared knowledge changes require the full suite', () => {
  assertFull(['knowledge/pedagogy/quality/quality-gates.yaml']);
});

test('pedagogical review changes require the full suite', () => {
  assertFull(['pedagogical-reviews/grade-5-science/water/review.yaml']);
});

test('grade 5 content requires the full suite', () => {
  assertFull(['lesson-plans/grade-5-science/water/lesson-01.yaml']);
});

test('teacher work-plan paths select the focused extraction job', () => {
  for (const repositoryPath of [
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'evaluations/teacher-work-plans/grade-7-geography-extraction.json',
    'evaluations/teacher-work-plans/grade-7-science-extraction.json',
    'project-files/inputs/originals/teacher-work-plans/source.pdf',
    'schemas/teacher-work-plan-extraction.schema.json',
    'scripts/lib/teacher-work-plan-extractions.mjs',
    'scripts/check-teacher-work-plan-contract.mjs',
    'scripts/classify-source-validation-scope.mjs',
    'scripts/classify-source-validation-scope.test.mjs',
    'docs/audits/grade-5-science-teacher-work-plan-extraction.md',
    'docs/audits/grade-6-science-teacher-work-plan-extraction.md',
    'docs/audits/grade-7-geography-teacher-work-plan-extraction.md',
    'docs/audits/grade-7-science-teacher-work-plan-extraction.md',
    'source-manifest.json',
  ]) {
    assert.equal(classifyChangedPaths([repositoryPath]).run_teacher_work_plans, true);
  }
});

test('teacher work-plan curriculum-map dependencies select the focused map job', () => {
  for (const repositoryPath of [
    'curriculum-maps/grade-5-science/teacher-work-plan-crosswalk.yaml',
    'evaluations/teacher-work-plans/grades-5-7-gap-report.json',
    'docs/audits/grades-5-7-teacher-work-plan-gap-report.md',
    'schemas/teacher-work-plan-gap-report.schema.json',
    'scripts/lib/teacher-work-plan-gap-report.mjs',
    'scripts/generate-teacher-work-plan-gap-report.mjs',
    'scripts/teacher-work-plan-gap-report.test.mjs',
    'schemas/teacher-work-plan-curriculum-map.schema.json',
    'scripts/lib/teacher-work-plan-curriculum-maps.mjs',
    'scripts/check-teacher-work-plan-curriculum-maps.mjs',
    'scripts/teacher-work-plan-curriculum-maps.test.mjs',
    'evaluations/teacher-work-plans/grade-5-science-extraction.json',
    'project-files/outputs/opiq_5klass_loodusopetus.md',
    'project-files/outputs/opiq_5klass_loodusopetus_qa.json',
    'curriculum-maps/grade-5-science/book-inventory.yaml',
    'curriculum-maps/grade-5-science/topic-inventory.yaml',
    'evaluations/teacher-work-plans/grade-6-science-extraction.json',
    'project-files/outputs/opiq_6klass_loodusopetus.md',
    'project-files/outputs/opiq_6klass_loodusopetus_qa.json',
    'curriculum-maps/grade-6-science/book-inventory.yaml',
    'curriculum-maps/grade-6-science/topic-inventory.yaml',
    'source-manifest.json',
  ]) {
    assert.equal(classifyChangedPaths([repositoryPath]).run_teacher_work_plan_maps, true);
  }
});

test('unrelated changes do not select the teacher work-plan job', () => {
  assert.equal(classifyChangedPaths(['docs/lesson-plans.md']).run_teacher_work_plans, false);
  assert.equal(
    classifyChangedPaths(['lesson-plans/grade-5-science/water/lesson-01.yaml'])
      .run_teacher_work_plans,
    false,
  );
  assert.equal(classifyChangedPaths(['docs/lesson-plans.md']).run_teacher_work_plan_maps, false);
});

test('unbounded shared content requires the full suite', () => {
  const result = assertFull(['compliance/estonia/2026-27/outcome-index.yaml']);
  assert.ok(result.reason_codes.includes('unbounded_shared_content'));
});

test('unknown paths fail closed to the full suite', () => {
  const result = assertFull(['new-root/grade-2/file.yaml']);
  assert.ok(result.reason_codes.includes('unknown_path'));
});

test('one full-trigger path upgrades a mixed change set to full', () => {
  assertFull([
    'docs/curriculum-maps.md',
    'curriculum-maps/grade-2-science/coverage-matrix.yaml',
    'scripts/check-source-manifest.mjs',
  ]);
});

test('empty change sets fail closed to the full suite', () => {
  const result = assertFull([]);
  assert.deepEqual(result.reason_codes, ['empty_change_set']);
});

test('unsafe repository path forms fail closed', () => {
  for (const repositoryPath of [
    '/absolute/path.yaml',
    '../traversal.yaml',
    'path\\with\\backslashes.yaml',
    'path//empty.yaml',
    './noncanonical.yaml',
  ]) {
    assert.deepEqual(classifyRepositoryPath(repositoryPath), {
      scope: 'full',
      reason: 'invalid_repository_path',
    });
  }
});

test('classification de-duplicates changed paths deterministically', () => {
  const result = assertCoreOnly([
    'README.md',
    'docs/lesson-plans.md',
    'README.md',
  ]);
  assert.equal(result.changed_path_count, 2);
  assert.deepEqual(result.reason_codes, [
    'bounded_core_only_area',
    'documentation_only',
  ]);
});

test('explicit full mode records a forced reason', () => {
  const result = classifyChangedPaths([], { forceFullReason: 'workflow_dispatch' });
  assert.equal(result.mode, 'full');
  assert.equal(result.forced, true);
  assert.deepEqual(result.reason_codes, ['forced:workflow_dispatch']);
});

test('CLI consumes NUL-delimited paths and writes GitHub outputs', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-scope-test-'));
  try {
    const outputPath = path.join(temporaryDirectory, 'output.txt');
    const summaryPath = path.join(temporaryDirectory, 'summary.md');
    const result = spawnSync(
      process.execPath,
      [
        'scripts/classify-source-validation-scope.mjs',
        '--stdin0',
        '--github-output', outputPath,
        '--summary', summaryPath,
      ],
      {
        cwd: repositoryRoot,
        input: Buffer.from(
          'docs/lesson-plans.md\0grade-programmes/grade-2/programme-architecture.yaml\0',
        ),
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.mode, 'core_only');
    const outputs = await fs.readFile(outputPath, 'utf8');
    assert.match(outputs, /^mode=core_only$/mu);
    assert.match(outputs, /^run_pedagogy_quality=false$/mu);
    assert.match(outputs, /^run_teacher_work_plans=false$/mu);
    assert.match(outputs, /^run_teacher_work_plan_maps=false$/mu);
    const summary = await fs.readFile(summaryPath, 'utf8');
    assert.match(summary, /Heavy pedagogical jobs: \*\*skip\*\*/u);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI newline mode fails closed for an unknown path', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/classify-source-validation-scope.mjs', '--stdin'],
    {
      cwd: repositoryRoot,
      input: 'docs/lesson-plans.md\nunknown-root/file.md\n',
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).mode, 'full');
});

test('CLI full mode does not require standard input', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/classify-source-validation-scope.mjs',
      '--full',
      '--reason', 'push',
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).reason_codes, ['forced:push']);
});
