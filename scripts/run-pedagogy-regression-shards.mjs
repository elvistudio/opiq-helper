#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { parseDocument } from 'yaml';

const FIXTURE_FILE = 'knowledge/pedagogy/regressions/grade-5-regression-cases.yaml';
const TEST_FILE = 'scripts/pedagogy-regressions.test.mjs';
const WORKER_FILE = 'scripts/run-pedagogy-regression-worker.mjs';

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/run-pedagogy-regression-shards.mjs `
    + '[--workers <count>] [--list]',
  );
}

function positiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(value)) {
    usage(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseArguments(argumentsList) {
  const options = { workers: null, list: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--list') options.list = true;
    else if (argument === '--workers') {
      const value = argumentsList[index + 1];
      if (!value) usage('--workers requires a count');
      options.workers = positiveInteger(value, '--workers');
      index += 1;
    } else usage(`unknown option ${argument}`);
  }
  return options;
}

function compareBytewise(left, right) {
  return Buffer.from(String(left)).compare(Buffer.from(String(right)));
}

async function loadCaseGroups() {
  const text = await fs.readFile(path.join(process.cwd(), FIXTURE_FILE), 'utf8');
  const document = parseDocument(text, {
    strict: true,
    uniqueKeys: true,
    schema: 'core',
    customTags: [],
    prettyErrors: true,
  });
  if (document.errors.length > 0) {
    throw new Error(
      `${FIXTURE_FILE}: invalid YAML:\n`
      + document.errors.map((error) => error.message).join('\n'),
    );
  }
  const fixtures = document.toJS({ maxAliasCount: 0 });
  const groups = [fixtures.cases, fixtures.readiness_evidence_cases];
  if (groups.some((group) => !Array.isArray(group))) {
    throw new Error(`${FIXTURE_FILE}: cases and readiness_evidence_cases must be arrays`);
  }
  const normalized = groups.map((group) => group.map((item) => item?.regression_id));
  if (normalized.flat().some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error(`${FIXTURE_FILE}: every regression case requires regression_id`);
  }
  const allIds = normalized.flat();
  if (new Set(allIds).size !== allIds.length) {
    throw new Error(`${FIXTURE_FILE}: regression_id values must be unique`);
  }
  return normalized;
}

function buildBuckets(groups, workerCount) {
  const buckets = Array.from({ length: workerCount }, () => []);
  for (const group of groups) {
    group.forEach((caseId, index) => {
      buckets[index % workerCount].push(caseId);
    });
  }
  return buckets;
}

function prefixedLines(stream, destination, label) {
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  reader.on('line', (line) => destination.write(`[${label}] ${line}\n`));
}

function runChild(label, argumentsList, env = process.env) {
  const startedAt = Date.now();
  console.log(`[${label}] starting`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, argumentsList, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixedLines(child.stdout, process.stdout, label);
    prefixedLines(child.stderr, process.stderr, label);
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      resolve({ label, durationMs: Date.now() - startedAt, ...result });
    };
    child.once('error', (error) => finish({ code: 1, error }));
    child.once('close', (code, signal) => finish({ code: code ?? 1, signal }));
  });
}

async function readWorkerResult(resultPath, expectedCaseIds) {
  const payload = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  if (!Array.isArray(payload.case_ids) || !payload.run || !Array.isArray(payload.run.results)) {
    throw new Error(`invalid regression worker result: ${resultPath}`);
  }
  if (JSON.stringify(payload.case_ids) !== JSON.stringify(expectedCaseIds)) {
    throw new Error(`regression worker request/result identity mismatch: ${resultPath}`);
  }
  const actualIds = payload.run.results.map((item) => item?.regression_id).sort(compareBytewise);
  const expectedIds = [...expectedCaseIds].sort(compareBytewise);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`regression worker case coverage mismatch: ${resultPath}`);
  }
  if (!Array.isArray(payload.run.errors)) {
    throw new Error(`regression worker errors must be an array: ${resultPath}`);
  }
  return payload.run;
}

function aggregateRuns(runs, expectedCaseIds) {
  const results = runs.flatMap((run) => run.results).sort(
    (left, right) => compareBytewise(left.regression_id, right.regression_id),
  );
  const actualIds = results.map((item) => item.regression_id);
  const expectedIds = [...expectedCaseIds].sort(compareBytewise);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error('aggregated regression result coverage mismatch');
  }
  return {
    results,
    errors: runs.flatMap((run) => run.errors).sort(compareBytewise),
  };
}

const RUN_SENTINEL = 'const run = await runPedagogyRegressions(repository);';
const RUN_REPLACEMENT = [
  'const run = JSON.parse(await fs.readFile(',
  '  process.env.OPIQ_PEDAGOGY_REGRESSION_RUN_PATH,',
  "  'utf8',",
  '));',
].join('\n');

function transformTestSource(source) {
  const first = source.indexOf(RUN_SENTINEL);
  const last = source.lastIndexOf(RUN_SENTINEL);
  if (first < 0 || first !== last) {
    const error = new Error(`run sentinel must occur exactly once in ${TEST_FILE}`);
    error.code = 'pedagogy_regression_shard_transform_invalid';
    throw error;
  }
  return source.replace(RUN_SENTINEL, RUN_REPLACEMENT);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const groups = await loadCaseGroups();
  const allCaseIds = groups.flat();
  if (options.list) {
    process.stdout.write(`${[...allCaseIds].sort(compareBytewise).join('\n')}\n`);
    return;
  }

  const available = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const environmentWorkers = process.env.OPIQ_PEDAGOGY_REGRESSION_WORKERS;
  const workerCount = Math.min(
    allCaseIds.length,
    options.workers
      ?? (environmentWorkers
        ? positiveInteger(environmentWorkers, 'OPIQ_PEDAGOGY_REGRESSION_WORKERS')
        : Math.max(1, Math.min(2, available))),
  );
  const buckets = buildBuckets(groups, workerCount);
  if (buckets.some((bucket) => bucket.length === 0)) {
    throw new Error('every regression worker must receive at least one case');
  }

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-regression-shards-'));
  const testSourcePath = path.join(process.cwd(), TEST_FILE);
  const temporaryTestPath = path.join(
    path.dirname(testSourcePath),
    `.tmp-pedagogy-regressions-shards-${process.pid}.test.mjs`,
  );

  console.log(
    `Pedagogy regression shards: ${workerCount}; assigned cases: ${allCaseIds.length}.`,
  );

  let assertionResult;
  let workerResults = [];
  try {
    const workerProcesses = await Promise.all(buckets.map(async (caseIds, index) => {
      const requestPath = path.join(temporaryDirectory, `worker-${index + 1}-request.json`);
      const resultPath = path.join(temporaryDirectory, `worker-${index + 1}-result.json`);
      await fs.writeFile(requestPath, `${JSON.stringify({ case_ids: caseIds })}\n`);
      const execution = await runChild(`worker-${index + 1}`, [
        path.join(process.cwd(), WORKER_FILE),
        requestPath,
        resultPath,
      ]);
      if (execution.code !== 0) return { execution, run: null, caseIds };
      try {
        return {
          execution,
          run: await readWorkerResult(resultPath, caseIds),
          caseIds,
        };
      } catch (error) {
        return {
          execution: { ...execution, code: 1, error },
          run: null,
          caseIds,
        };
      }
    }));
    workerResults = workerProcesses;

    const failedWorker = workerProcesses.find((item) => item.execution.code !== 0 || !item.run);
    if (failedWorker) {
      throw failedWorker.execution.error
        ?? new Error(`${failedWorker.execution.label} failed`);
    }

    const aggregate = aggregateRuns(
      workerProcesses.map((item) => item.run),
      allCaseIds,
    );
    const aggregatePath = path.join(temporaryDirectory, 'aggregate-run.json');
    await fs.writeFile(aggregatePath, `${JSON.stringify(aggregate)}\n`);

    const source = await fs.readFile(testSourcePath, 'utf8');
    await fs.writeFile(temporaryTestPath, transformTestSource(source));
    assertionResult = await runChild('assertions', [
      '--test',
      '--test-reporter=spec',
      temporaryTestPath,
    ], {
      ...process.env,
      OPIQ_PEDAGOGY_REGRESSION_RUN_PATH: aggregatePath,
    });
  } finally {
    await fs.rm(temporaryTestPath, { force: true });
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }

  for (const item of workerResults) {
    const seconds = (item.execution.durationMs / 1000).toFixed(1);
    console.log(
      `[${item.execution.label}] ${item.execution.code === 0 ? 'passed' : 'failed'} `
      + `in ${seconds}s; cases: ${item.caseIds.length}`
      + (item.execution.signal ? ` (signal ${item.execution.signal})` : ''),
    );
    if (item.execution.error) console.error(item.execution.error);
  }
  if (assertionResult) {
    const seconds = (assertionResult.durationMs / 1000).toFixed(1);
    console.log(
      `[assertions] ${assertionResult.code === 0 ? 'passed' : 'failed'} in ${seconds}s`
      + (assertionResult.signal ? ` (signal ${assertionResult.signal})` : ''),
    );
    if (assertionResult.error) console.error(assertionResult.error);
  }
  if (
    workerResults.some((item) => item.execution.code !== 0 || !item.run)
    || !assertionResult
    || assertionResult.code !== 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `Pedagogy regression shard runner failed${error.code ? ` [${error.code}]` : ''}: `
    + error.message,
  );
  process.exitCode = 1;
});
