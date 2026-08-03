#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HEAVY_JOB_OUTPUTS = Object.freeze([
  'run_pedagogy_quality',
  'run_pedagogy_regressions',
  'run_pedagogy_evidence',
]);

const CONDITIONAL_JOB_OUTPUTS = Object.freeze([
  ...HEAVY_JOB_OUTPUTS,
  'run_teacher_work_plans',
  'run_teacher_work_plan_maps',
]);

const TEACHER_WORK_PLAN_EXACT = new Set([
  'source-manifest.json',
  'docs/audits/grade-5-science-teacher-work-plan-extraction.md',
  'docs/audits/grade-6-science-teacher-work-plan-extraction.md',
  'docs/audits/grade-7-geography-teacher-work-plan-extraction.md',
  'docs/audits/grade-7-science-teacher-work-plan-extraction.md',
  'docs/migrations/teacher-work-plans-5-7-integration.md',
  'schemas/teacher-work-plan-extraction.schema.json',
  'scripts/classify-source-validation-scope.mjs',
  'scripts/classify-source-validation-scope.test.mjs',
  'scripts/check-teacher-work-plan-extractions.mjs',
  'scripts/lib/teacher-work-plan-extractions.mjs',
  'scripts/teacher-work-plan-extractions.test.mjs',
]);

const TEACHER_WORK_PLAN_PREFIXES = Object.freeze([
  'evaluations/teacher-work-plans/',
  'project-files/inputs/originals/teacher-work-plans/',
]);

const TEACHER_WORK_PLAN_MAP_EXACT = new Set([
  'source-manifest.json',
  'evaluations/teacher-work-plans/grades-5-7-gap-report.json',
  'docs/audits/grades-5-7-teacher-work-plan-gap-report.md',
  'schemas/teacher-work-plan-gap-report.schema.json',
  'scripts/lib/teacher-work-plan-gap-report.mjs',
  'scripts/generate-teacher-work-plan-gap-report.mjs',
  'scripts/teacher-work-plan-gap-report.test.mjs',
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
  'schemas/teacher-work-plan-curriculum-map.schema.json',
  'scripts/lib/teacher-work-plan-curriculum-maps.mjs',
  'scripts/check-teacher-work-plan-curriculum-maps.mjs',
  'scripts/teacher-work-plan-curriculum-maps.test.mjs',
]);

const ALWAYS_FULL_EXACT = new Map([
  ['source-manifest.json', 'source_manifest'],
  ['package.json', 'package_definition'],
  ['package-lock.json', 'package_lock'],
]);

const ALWAYS_FULL_PREFIXES = Object.freeze([
  ['.github/workflows/', 'workflow_definition'],
  ['knowledge/', 'shared_knowledge'],
  ['pedagogical-reviews/', 'pedagogical_review'],
  ['schemas/', 'shared_schema'],
  ['scripts/', 'executable_script'],
]);

const CORE_ONLY_EXACT = new Set([
  'README.md',
]);

const CORE_ONLY_PREFIXES = Object.freeze([
  '.github/ISSUE_TEMPLATE/',
  'docs/',
  'task-bank/',
  'test-fixtures/task-bank/',
]);

const GRADE_SCOPED_CONTENT_ROOTS = new Set([
  'annual-courses',
  'compliance',
  'curriculum-maps',
  'evaluations',
  'external-sources',
  'grade-programmes',
  'lesson-plans',
  'project-files',
  'teacher-packs',
]);

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareBytewise);
}

function validRepositoryPath(repositoryPath) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0) return false;
  if (repositoryPath.includes('\0') || repositoryPath.includes('\\')) return false;
  if (repositoryPath.startsWith('/')) return false;
  const segments = repositoryPath.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function extractGrade(repositoryPath) {
  const match = repositoryPath.match(/(?:^|\/)grade-(\d+)(?=$|[-/])/u);
  return match ? Number.parseInt(match[1], 10) : null;
}

function shouldRunTeacherWorkPlans(paths) {
  return paths.some((repositoryPath) => (
    TEACHER_WORK_PLAN_EXACT.has(repositoryPath)
    || TEACHER_WORK_PLAN_PREFIXES.some((prefix) => repositoryPath.startsWith(prefix))
    || /^scripts\/[^/]*teacher-work-plan[^/]*$/u.test(repositoryPath)
  ));
}

function shouldRunTeacherWorkPlanMaps(paths) {
  return paths.some((repositoryPath) => (
    TEACHER_WORK_PLAN_MAP_EXACT.has(repositoryPath)
    || /^curriculum-maps\/grade-[0-9]+-[a-z0-9-]+\/teacher-work-plan-crosswalk\.ya?ml$/u.test(repositoryPath)
    || /^scripts\/[^/]*teacher-work-plan-curriculum-map[^/]*$/u.test(repositoryPath)
  ));
}

export function classifyRepositoryPath(repositoryPath) {
  if (!validRepositoryPath(repositoryPath)) {
    return { scope: 'full', reason: 'invalid_repository_path' };
  }

  const exactReason = ALWAYS_FULL_EXACT.get(repositoryPath);
  if (exactReason) return { scope: 'full', reason: exactReason };

  for (const [prefix, reason] of ALWAYS_FULL_PREFIXES) {
    if (repositoryPath.startsWith(prefix)) return { scope: 'full', reason };
  }

  if (CORE_ONLY_EXACT.has(repositoryPath)) {
    return { scope: 'core_only', reason: 'documentation_only' };
  }
  if (CORE_ONLY_PREFIXES.some((prefix) => repositoryPath.startsWith(prefix))) {
    return { scope: 'core_only', reason: 'bounded_core_only_area' };
  }

  const root = repositoryPath.split('/', 1)[0];
  if (GRADE_SCOPED_CONTENT_ROOTS.has(root)) {
    const grade = extractGrade(repositoryPath);
    if (grade !== null && grade >= 1 && grade <= 4) {
      return { scope: 'core_only', reason: `grade_${grade}_content` };
    }
    if (grade !== null && grade >= 5) {
      return { scope: 'full', reason: 'grade_5_plus_content' };
    }
    return { scope: 'full', reason: 'unbounded_shared_content' };
  }

  return { scope: 'full', reason: 'unknown_path' };
}

function fullResult(paths, reasons, forced = false) {
  return {
    mode: 'full',
    run_pedagogy_quality: true,
    run_pedagogy_regressions: true,
    run_pedagogy_evidence: true,
    run_teacher_work_plans: forced || shouldRunTeacherWorkPlans(paths),
    run_teacher_work_plan_maps: forced || shouldRunTeacherWorkPlanMaps(paths),
    changed_path_count: paths.length,
    reason_codes: uniqueSorted(reasons),
    forced,
  };
}

export function classifyChangedPaths(rawPaths, { forceFullReason = null } = {}) {
  if (!Array.isArray(rawPaths)) throw new TypeError('rawPaths must be an array');
  const paths = uniqueSorted(rawPaths);

  if (forceFullReason !== null) {
    if (typeof forceFullReason !== 'string' || forceFullReason.length === 0) {
      throw new TypeError('forceFullReason must be a non-empty string');
    }
    return fullResult(paths, [`forced:${forceFullReason}`], true);
  }

  if (paths.length === 0) return fullResult([], ['empty_change_set']);

  const classifications = paths.map((repositoryPath) => ({
    repositoryPath,
    ...classifyRepositoryPath(repositoryPath),
  }));
  const full = classifications.filter((item) => item.scope === 'full');
  if (full.length > 0) {
    return fullResult(paths, full.map((item) => item.reason));
  }

  return {
    mode: 'core_only',
    run_pedagogy_quality: false,
    run_pedagogy_regressions: false,
    run_pedagogy_evidence: false,
    run_teacher_work_plans: shouldRunTeacherWorkPlans(paths),
    run_teacher_work_plan_maps: shouldRunTeacherWorkPlanMaps(paths),
    changed_path_count: paths.length,
    reason_codes: uniqueSorted(classifications.map((item) => item.reason)),
    forced: false,
  };
}

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/classify-source-validation-scope.mjs `
    + '[--stdin0 | --stdin | --full] [--reason <code>] '
    + '[--github-output <path>] [--summary <path>]',
  );
}

function parseArguments(argumentsList) {
  const options = {
    inputMode: null,
    reason: null,
    githubOutput: null,
    summary: null,
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (['--stdin0', '--stdin', '--full'].includes(argument)) {
      if (options.inputMode !== null) usage('choose exactly one input mode');
      options.inputMode = argument.slice(2);
    } else if (argument === '--reason') {
      options.reason = argumentsList[index + 1];
      if (!options.reason) usage('--reason requires a value');
      index += 1;
    } else if (argument === '--github-output') {
      options.githubOutput = argumentsList[index + 1];
      if (!options.githubOutput) usage('--github-output requires a path');
      index += 1;
    } else if (argument === '--summary') {
      options.summary = argumentsList[index + 1];
      if (!options.summary) usage('--summary requires a path');
      index += 1;
    } else {
      usage(`unknown option ${argument}`);
    }
  }
  if (options.inputMode === null) usage('an input mode is required');
  if (options.inputMode === 'full' && options.reason === null) {
    options.reason = 'explicit_full_validation';
  }
  if (options.inputMode !== 'full' && options.reason !== null) {
    usage('--reason is valid only with --full');
  }
  return options;
}

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readPaths(inputMode) {
  const input = await readStandardInput();
  const separator = inputMode === 'stdin0' ? '\0' : '\n';
  const values = input.toString('utf8').split(separator);
  if (values.at(-1) === '') values.pop();
  return values;
}

async function appendGitHubOutputs(outputPath, result) {
  const lines = [
    `mode=${result.mode}`,
    ...CONDITIONAL_JOB_OUTPUTS.map((key) => `${key}=${String(result[key])}`),
    `changed_path_count=${result.changed_path_count}`,
    `reason_codes=${result.reason_codes.join(',')}`,
  ];
  await fs.appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

async function appendSummary(summaryPath, result) {
  const heavy = result.mode === 'full' ? 'run' : 'skip';
  const lines = [
    '## Source validation scope',
    '',
    `- Mode: \`${result.mode}\``,
    `- Changed paths: ${result.changed_path_count}`,
    `- Heavy pedagogical jobs: **${heavy}**`,
    `- Reason codes: \`${result.reason_codes.join(', ') || 'none'}\``,
    '',
  ];
  await fs.appendFile(summaryPath, lines.join('\n'), 'utf8');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = options.inputMode === 'full'
    ? classifyChangedPaths([], { forceFullReason: options.reason })
    : classifyChangedPaths(await readPaths(options.inputMode));

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (options.githubOutput) await appendGitHubOutputs(options.githubOutput, result);
  if (options.summary) await appendSummary(options.summary, result);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Source validation scope classification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
