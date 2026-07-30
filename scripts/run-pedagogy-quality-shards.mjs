#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const SOURCE_FILE = 'scripts/pedagogy-quality.test.mjs';
const EXPECTED_MINIMUM_MUTATIONS = 41;

const definitions = [
  {
    name: 'projection-a',
    exact: [
      'production safety projection remains activity-applicable with active parent role',
      'production projection: real timing YAML mutation blocks timing and structural completeness',
      'production projection: required retrieval plan cannot disappear',
      'production projection: correction phase cannot equal immediate retrieval phase',
      'production projection: missing home correction produces a diagnostic instead of a crash',
      'production projection: backward thematic retrieval link fails',
      'production projection: missing thematic retrieval link fails',
      'production projection: absolute learner date cannot hide in delayed retrieval',
      'production projection: stale taxonomy version fails identity',
      'production projection: stale selection-rules version fails identity',
      'production projection: same-length wrong catalogue digest is not current',
      'production projection: homeschool DNA digest mismatch fails identity',
      'production projection: changing one reviewable byte changes current fingerprint',
      'production projection: registering current human evidence does not change pack fingerprint',
      'production projection: completed review with a same-length wrong hash is stale',
      'production projection: completed review with a stale file count is stale',
    ],
    prefixes: [],
  },
  {
    name: 'projection-b',
    exact: [
      'production projection: ready claim without effective evidence fails',
      'production projection: missing registered artifact file fails resolution',
      'production projection: unknown material ID fails registered closure',
      'production projection: reselected target requires actual explicit contract',
      'production projection: downstream supervision flag cannot disable safety gate',
      'production projection: required prior-knowledge component cannot disappear',
      'production projection: required guided-practice component cannot disappear',
      'production projection: practical material must bind to the practical DNA phase',
      'production projection: formative assessment requires materialized evidence',
      'production projection: source-closed retrieval rejects open source access',
      'production projection: key open before attempt fails retrieval',
      'production projection: unrelated legacy route does not change water report',
      'production projection: orphan active exception invalidates loaded configuration',
      'production projection: unimplemented loaded catalogue gate is rejected',
    ],
    prefixes: [],
  },
  {
    name: 'schema-projection',
    exact: [
      'production schema projection validates all committed machine artifact kinds',
      'production schema projection: unknown lesson-DNA field is dependency-scoped',
      'production schema projection: missing lesson-DNA field is an auditable error',
      'production schema projection: wrong selection-decision enum fails',
      'production schema projection: unknown homeschool-package field fails',
      'production schema projection: missing homeschool-request field fails',
      'production schema projection: unknown integration-index field fails',
      'production schema projection: missing integration-index field fails without TypeError',
      'production schema projection recovers after the current artifact is restored',
      'activity safety resolver uses exact base and execution-profile metadata',
      'activity safety resolver never accepts the misspelled legacy alias',
    ],
    prefixes: [
      'production schema projection: invalid ',
    ],
  },
  {
    name: 'core-and-cli',
    exact: [
      'valid integrated classroom lessons pass every applicable error gate',
      'valid integrated homeschool packages resolve their complete material closure',
      'valid four-lesson water pilot is structurally complete',
      'justified exact-record exception represents a bounded nonstandard lesson',
      'legacy artifacts receive the finite documented migration warning',
      'explicit unrelated path fails instead of producing empty positive claims',
      'production warning vocabulary and count are finite',
      'invalid integrated artifact schema fails',
      'missing explicit learning goals fails pattern structure',
      'missing pattern-required component fails without imposing a universal phase set',
      'missing lesson DNA reference fails identity integrity',
      'unknown catalogue target fails identity integrity',
      'stale taxonomy version fails identity integrity',
      'stale selection rules version fails identity integrity',
      'stale catalogue digest fails identity integrity',
      'canonical lesson DNA identity mismatch fails',
      'timing overflow fails',
      'structural completeness is independent of primitive execution order',
      'exact timing exception remains visible and permits structural completeness',
      'stage partition mismatch fails',
      'double-counted minutes fail',
      'closed-source retrieval requirement rejects open first attempt',
      'retrieval without later correction fails',
      'delayed retrieval cannot point to the current or previous lesson',
      'delayed retrieval rejects unsupported absolute learner date',
      'incompatible Estonian role fails',
      'language demand above hard ceiling fails',
      'combined subject and language assessment fails',
      'classroom-only material in homeschool closure fails',
      'reselected home target without explicit task contract fails',
      'homeschool adaptation cannot make the parent a subject teacher by default',
      'missing adult safety supervision fails',
      'missing teacher authorization fails',
      'safety policy package and render disagreement fails',
      'learner-facing complete answer leak fails',
      'answer key open before first attempt fails alignment',
      'fictitious key for teacher-observation task fails alignment',
      'unresolved material path fails alignment and closure',
      'classroom_ready true without human evidence fails',
      'homeschool_ready true without human evidence fails',
      'stale review or trial evidence fails readiness honesty',
      'effectiveness claim fails readiness honesty',
      'exception for unknown gate fails configuration validation',
      'exception with stale gate version fails configuration validation',
      'active exception cannot target a missing record',
      'active exception cannot target a gate inapplicable to the record kind',
      'retired exception is retained historically but never applied',
      'catalogue gate without any executable evaluator invalidates configuration',
      'gate schema permits independent semantic versions',
      'duplicate exception ID fails configuration validation',
      'conflicting exceptions for one exact target fail',
      'attempt to except a safety gate fails configuration validation',
      'attempt to except readiness honesty fails configuration validation',
      'attempt to except answer leakage fails configuration validation',
      'diagnostics are bytewise sorted deterministically',
      'report is deterministic and schema-valid',
      'report makes structural claims but no approval or effectiveness claim',
      'report readiness reflects actual invalid record state instead of safe defaults',
      'path-scoped output contains only the evaluated record and dependency closure',
      'committed report builder rejects a path-scoped evaluation',
      'canonical path normalizer accepts repository files and directories',
      'CLI path scope accepts exact files/directories and rejects empty or unsafe scopes',
      'evidence fingerprint equality requires algorithm, specification, value and file count',
      'production adapter mutation suite covers at least forty-one real artifact mutations',
      'quality engine implementation contains no water lesson or material IDs',
      'CLI permits documented production warnings by default',
      'CLI strict-warnings mode exits nonzero for the finite production warning set',
      'CLI JSON output is byte-identical across repeated runs',
    ],
    prefixes: [
      'canonical path normalizer rejects ',
    ],
  },
];

const shardNames = Object.freeze(definitions.map((definition) => definition.name));
const shards = Object.freeze(Object.fromEntries(definitions.map((definition) => [
  definition.name,
  Object.freeze({
    exact: Object.freeze([...definition.exact]),
    prefixes: Object.freeze([...definition.prefixes]),
  }),
])));

function usage(message) {
  throw new Error(
    `${message}\nUsage: node scripts/run-pedagogy-quality-shards.mjs `
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
  const exact = shard.exact.map((name) => `^${escapeRegExp(name)}$`);
  const prefixes = shard.prefixes.map((prefix) => `^${escapeRegExp(prefix)}`);
  return `(?:${[...exact, ...prefixes].join('|')})`;
}

const TOP_LEVEL_TEST_DECLARATION =
  /(?<![\w.])test\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/gu;

function extractTopLevelTestKeys(source) {
  const keys = [];
  for (const match of source.matchAll(TOP_LEVEL_TEST_DECLARATION)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    const key = raw.split('${', 1)[0];
    if (key.length > 0) keys.push(key);
  }
  return keys;
}

function matchingShardNames(testKey) {
  return definitions.filter((definition) => (
    definition.exact.includes(testKey) || definition.prefixes.includes(testKey)
  )).map((definition) => definition.name);
}

function validateShardCoverage(source) {
  const declarations = extractTopLevelTestKeys(source);
  const declarationSet = new Set(declarations);
  const errors = [];
  const counts = Object.fromEntries(shardNames.map((name) => [name, 0]));

  for (const testKey of declarations) {
    const matches = matchingShardNames(testKey);
    if (matches.length !== 1) {
      errors.push(
        `${SOURCE_FILE}: ${JSON.stringify(testKey)} matches ${matches.length} shards `
        + `(${matches.join(', ') || 'none'})`,
      );
      continue;
    }
    counts[matches[0]] += 1;
  }

  for (const definition of definitions) {
    for (const matcher of [...definition.exact, ...definition.prefixes]) {
      if (!declarationSet.has(matcher)) {
        errors.push(`${definition.name}: stale matcher ${JSON.stringify(matcher)}`);
      }
    }
    if (counts[definition.name] === 0) {
      errors.push(`pedagogy quality shard ${definition.name} has no test declarations`);
    }
  }

  if (new Set(declarations).size !== declarations.length) {
    errors.push('pedagogy quality test declarations must have unique literal prefixes');
  }
  if (errors.length > 0) {
    const error = new Error(`invalid pedagogy quality shard coverage:\n${errors.join('\n')}`);
    error.code = 'pedagogy_quality_shard_coverage_invalid';
    throw error;
  }
  return { declarations: declarations.length, counts };
}

const AFTER_SENTINEL = [
  'after(async () => {',
  '  await fs.rm(fixtureRoot, { recursive: true, force: true });',
  '});',
].join('\n');
const AFTER_REPLACEMENT = [
  'after(async () => {',
  '  if (process.env.OPIQ_PEDAGOGY_QUALITY_MUTATION_COUNT_PATH) {',
  '    await fs.writeFile(',
  '      process.env.OPIQ_PEDAGOGY_QUALITY_MUTATION_COUNT_PATH,',
  '      `${productionAdapterMutationCount}\\n`,',
  '    );',
  '  }',
  '  await fs.rm(fixtureRoot, { recursive: true, force: true });',
  '});',
].join('\n');
const COUNTER_SENTINEL = [
  "test('production adapter mutation suite covers at least forty-one real artifact mutations', () => {",
  '  assert.ok(productionAdapterMutationCount >= 41);',
  '});',
].join('\n');
const COUNTER_REPLACEMENT = [
  "test('production adapter mutation suite covers at least forty-one real artifact mutations', () => {",
  '  if (!process.env.OPIQ_PEDAGOGY_QUALITY_MUTATION_COUNT_PATH) {',
  '    assert.ok(productionAdapterMutationCount >= 41);',
  '  }',
  '});',
].join('\n');

function replaceExactlyOnce(source, sentinel, replacement, label) {
  const first = source.indexOf(sentinel);
  const last = source.lastIndexOf(sentinel);
  if (first < 0 || first !== last) {
    const error = new Error(`${label} sentinel must occur exactly once in ${SOURCE_FILE}`);
    error.code = 'pedagogy_quality_shard_transform_invalid';
    throw error;
  }
  return source.replace(sentinel, replacement);
}

function transformSource(source) {
  const withCountOutput = replaceExactlyOnce(
    source,
    AFTER_SENTINEL,
    AFTER_REPLACEMENT,
    'after hook',
  );
  return replaceExactlyOnce(
    withCountOutput,
    COUNTER_SENTINEL,
    COUNTER_REPLACEMENT,
    'mutation counter test',
  );
}

function prefixedLines(stream, destination, shardName) {
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  reader.on('line', (line) => destination.write(`[${shardName}] ${line}\n`));
}

async function readMutationCount(countPath) {
  try {
    const value = (await fs.readFile(countPath, 'utf8')).trim();
    const count = Number.parseInt(value, 10);
    if (!Number.isInteger(count) || count < 0 || String(count) !== value) {
      throw new Error(`invalid mutation count ${JSON.stringify(value)}`);
    }
    return count;
  } catch (error) {
    const wrapped = new Error(`cannot read mutation count ${countPath}: ${error.message}`);
    wrapped.code = 'pedagogy_quality_mutation_count_invalid';
    throw wrapped;
  }
}

function runShard(shardName, testPath, countPath) {
  const startedAt = Date.now();
  console.log(`[${shardName}] starting`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      '--test',
      '--test-reporter=spec',
      `--test-name-pattern=${shardPattern(shardName)}`,
      testPath,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPIQ_PEDAGOGY_QUALITY_MUTATION_COUNT_PATH: countPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    prefixedLines(child.stdout, process.stdout, shardName);
    prefixedLines(child.stderr, process.stderr, shardName);
    let resolved = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };
    child.once('error', (error) => {
      finish({ shardName, code: 1, durationMs: Date.now() - startedAt, error });
    });
    child.once('close', async (code, signal) => {
      let mutationCount = null;
      let countError = null;
      try {
        mutationCount = await readMutationCount(countPath);
      } catch (error) {
        countError = error;
      }
      finish({
        shardName,
        code: code ?? 1,
        signal,
        durationMs: Date.now() - startedAt,
        mutationCount,
        error: countError,
      });
    });
  });
}

async function runQueue(selectedShards, workerCount, testPath, countDirectory) {
  const results = [];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < selectedShards.length) {
      const shardName = selectedShards[nextIndex];
      nextIndex += 1;
      const countPath = path.join(countDirectory, `${shardName}.txt`);
      results.push(await runShard(shardName, testPath, countPath));
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

  const sourcePath = path.join(process.cwd(), SOURCE_FILE);
  const source = await fs.readFile(sourcePath, 'utf8');
  const coverage = validateShardCoverage(source);
  const transformed = transformSource(source);
  const selectedShards = options.shard ? [options.shard] : [...shardNames];
  const available = typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
  const environmentWorkers = process.env.OPIQ_PEDAGOGY_QUALITY_WORKERS;
  const workerCount = Math.min(
    selectedShards.length,
    options.workers
      ?? (environmentWorkers
        ? positiveInteger(environmentWorkers, 'OPIQ_PEDAGOGY_QUALITY_WORKERS')
        : Math.max(1, Math.min(4, available))),
  );

  const countDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'opiq-quality-counts-'));
  const temporaryTestPath = path.join(
    path.dirname(sourcePath),
    `.tmp-pedagogy-quality-shards-${process.pid}.test.mjs`,
  );
  await fs.writeFile(temporaryTestPath, transformed);

  console.log(
    `Pedagogy quality shards: ${selectedShards.length}; workers: ${workerCount}; `
    + `assigned declarations: ${coverage.declarations}.`,
  );

  let results;
  try {
    results = await runQueue(
      selectedShards,
      workerCount,
      temporaryTestPath,
      countDirectory,
    );
  } finally {
    await fs.rm(temporaryTestPath, { force: true });
    await fs.rm(countDirectory, { recursive: true, force: true });
  }

  results.sort((left, right) => shardNames.indexOf(left.shardName)
    - shardNames.indexOf(right.shardName));
  for (const result of results) {
    const seconds = (result.durationMs / 1000).toFixed(1);
    console.log(
      `[${result.shardName}] ${result.code === 0 && !result.error ? 'passed' : 'failed'} `
      + `in ${seconds}s; mutations: ${result.mutationCount ?? 'unknown'}`
      + (result.signal ? ` (signal ${result.signal})` : ''),
    );
    if (result.error) console.error(result.error);
  }

  const failed = results.some((result) => result.code !== 0 || result.error);
  const mutationCount = results.reduce(
    (sum, result) => sum + (result.mutationCount ?? 0),
    0,
  );
  if (!options.shard) {
    console.log(
      `Pedagogy quality mutation coverage: ${mutationCount} runtime mutation(s); `
      + `required minimum: ${EXPECTED_MINIMUM_MUTATIONS}.`,
    );
    if (mutationCount < EXPECTED_MINIMUM_MUTATIONS) process.exitCode = 1;
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `Pedagogy quality shard runner failed${error.code ? ` [${error.code}]` : ''}: `
    + error.message,
  );
  process.exitCode = 1;
});
