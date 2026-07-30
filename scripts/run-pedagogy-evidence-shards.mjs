#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const TEST_FILES = Object.freeze([
  'scripts/pedagogy-evidence.test.mjs',
  'scripts/pedagogy-evidence-final-guards.test.mjs',
]);
const MAIN_TEST_FILE = TEST_FILES[0];

const definitions = [
  // Long-running shards are scheduled first so the default worker queue minimizes wall time.
  {
    name: 'negative-evidence',
    files: [MAIN_TEST_FILE],
    prefixes: ['completed negative evidence registers '],
  },
  {
    name: 'coverage-and-semantics',
    files: [MAIN_TEST_FILE],
    prefixes: [
      'official registration keeps ',
      'real repository artifacts reject ',
    ],
  },
  {
    name: 'registration-concurrency-a',
    files: [MAIN_TEST_FILE],
    prefixes: [
      'concurrent evidence link ',
      'pack-local registration lock ',
    ],
  },
  {
    name: 'registration-concurrency-b',
    files: [MAIN_TEST_FILE],
    prefixes: [
      'atomic no-replace ',
      'rollback never removes ',
      'registration releases its pack lock ',
    ],
  },
  {
    name: 'registration-basics',
    files: [MAIN_TEST_FILE],
    prefixes: [
      'successful evidence registration ',
      'registration rolls back when a reviewable byte ',
      'full repository validation ',
      'registration rejects a target ',
    ],
  },
  {
    name: 'identity-and-preparation',
    files: TEST_FILES,
    prefixes: [
      'prepare ',
      'authoritative evidence identity ',
      'commit SHA ',
      'content fingerprint ',
      'fingerprint freshness ',
      'selection identity ',
      'lesson DNA ',
      'rule digests ',
      'privacy scanner ',
      'privacy attestation ',
      'strict evidence JSON ',
      'normalization ',
      'registration requires explicit write flag',
      'terminal classroom evidence ',
      'terminal home evidence ',
      'superseded review ',
      'superseded trial ',
      'approved_with_minor_notes ',
      'successful_with_notes ',
      'aggregate count ',
      'terminal evidence rejects the template date placeholder',
    ],
  },
];

const shards = Object.freeze(Object.fromEntries(
  definitions.map((definition) => [definition.name, Object.freeze({
    files: Object.freeze([...definition.files]),
    prefixes: Object.freeze([...definition.prefixes]),
  })]),
));
const shardNames = Object.freeze(definitions.map((definition) => definition.name));

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/run-pedagogy-evidence-shards.mjs `
    + '[--shard <name>] [--workers <count>] [--list]',
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
  const options = { shard: null, workers: null, list: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--list') options.list = true;
    else if (argument === '--shard') {
      options.shard = argumentsList[index + 1];
      if (!options.shard) usage('--shard requires a shard name');
      index += 1;
    } else if (argument === '--workers') {
      const value = argumentsList[index + 1];
      if (!value) usage('--workers requires a count');
      options.workers = positiveInteger(value, '--workers');
      index += 1;
    } else usage(`unknown option ${argument}`);
  }
  if (options.shard && !shards[options.shard]) usage(`unknown shard ${options.shard}`);
  return options;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function shardPattern(shardName) {
  const shard = shards[shardName];
  if (!shard) usage(`unknown shard ${shardName}`);
  return `^(?:${shard.prefixes.map(escapeRegExp).join('|')})`;
}

const TOP_LEVEL_TEST_DECLARATION =
  /(?<![\w.])test\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/gu;

function extractTopLevelTestPrefixes(source) {
  const prefixes = [];
  for (const match of source.matchAll(TOP_LEVEL_TEST_DECLARATION)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    const prefix = raw.split('${', 1)[0];
    if (prefix.length > 0) prefixes.push(prefix);
  }
  return prefixes;
}

function matchingShardNames(testPrefix) {
  return definitions.filter((definition) => definition.prefixes.some(
    (prefix) => testPrefix.startsWith(prefix),
  )).map((definition) => definition.name);
}

async function validateShardCoverage() {
  const declarations = [];
  for (const repositoryPath of TEST_FILES) {
    const source = await fs.readFile(path.join(process.cwd(), repositoryPath), 'utf8');
    for (const prefix of extractTopLevelTestPrefixes(source)) {
      declarations.push({ repositoryPath, prefix });
    }
  }

  const errors = [];
  const counts = Object.fromEntries(shardNames.map((name) => [name, 0]));
  for (const declaration of declarations) {
    const matches = matchingShardNames(declaration.prefix);
    if (matches.length !== 1) {
      errors.push(
        `${declaration.repositoryPath}: ${JSON.stringify(declaration.prefix)} `
        + `matches ${matches.length} shards (${matches.join(', ') || 'none'})`,
      );
      continue;
    }
    counts[matches[0]] += 1;
  }
  for (const [name, count] of Object.entries(counts)) {
    if (count === 0) errors.push(`pedagogy evidence shard ${name} has no test declarations`);
  }
  if (errors.length > 0) {
    const error = new Error(`invalid pedagogy evidence shard coverage:\n${errors.join('\n')}`);
    error.code = 'pedagogy_evidence_shard_coverage_invalid';
    throw error;
  }
  return { declarations: declarations.length, counts };
}

function prefixedLines(stream, destination, shardName) {
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  reader.on('line', (line) => destination.write(`[${shardName}] ${line}\n`));
}

function runShard(shardName) {
  const shard = shards[shardName];
  const startedAt = Date.now();
  console.log(`[${shardName}] starting`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      '--test',
      '--test-reporter=spec',
      `--test-name-pattern=${shardPattern(shardName)}`,
      ...shard.files,
    ], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixedLines(child.stdout, process.stdout, shardName);
    prefixedLines(child.stderr, process.stderr, shardName);
    child.once('error', (error) => {
      resolve({ shardName, code: 1, durationMs: Date.now() - startedAt, error });
    });
    child.once('close', (code, signal) => {
      resolve({
        shardName,
        code: code ?? 1,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

async function runQueue(selectedShards, workerCount) {
  const results = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < selectedShards.length) {
      const shardName = selectedShards[nextIndex];
      nextIndex += 1;
      results.push(await runShard(shardName));
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.list) {
    process.stdout.write(`${shardNames.join('\n')}\n`);
    return;
  }

  const coverage = await validateShardCoverage();
  const selectedShards = options.shard ? [options.shard] : [...shardNames];
  const available = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const environmentWorkers = process.env.OPIQ_PEDAGOGY_EVIDENCE_WORKERS;
  const workerCount = Math.min(
    selectedShards.length,
    options.workers
      ?? (environmentWorkers
        ? positiveInteger(environmentWorkers, 'OPIQ_PEDAGOGY_EVIDENCE_WORKERS')
        : Math.max(1, Math.min(4, available))),
  );

  console.log(
    `Pedagogy evidence shards: ${selectedShards.length}; workers: ${workerCount}; `
    + `assigned declarations: ${coverage.declarations}.`,
  );
  const results = await runQueue(selectedShards, workerCount);
  results.sort((left, right) => shardNames.indexOf(left.shardName)
    - shardNames.indexOf(right.shardName));
  for (const result of results) {
    const seconds = (result.durationMs / 1000).toFixed(1);
    console.log(
      `[${result.shardName}] ${result.code === 0 ? 'passed' : 'failed'} in ${seconds}s`
      + (result.signal ? ` (signal ${result.signal})` : ''),
    );
    if (result.error) console.error(result.error);
  }
  if (results.some((result) => result.code !== 0)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `Pedagogy evidence shard runner failed${error.code ? ` [${error.code}]` : ''}: `
    + error.message,
  );
  process.exitCode = 1;
});
