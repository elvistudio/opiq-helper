#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runKnownTopicRegressions } from './lib/known-topic-regressions.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const options = {
  repositoryRoot,
  manifestPath: 'source-manifest.json',
  casesPath: 'evaluations/known-topic-checks.yaml',
  caseId: null,
};

function usage() {
  return 'Usage: node scripts/check-known-topic-regressions.mjs [--case <case-id>] [--cases <repository-relative-yaml-path>] [--manifest <repository-relative-json-path>]';
}

const argumentsList = process.argv.slice(2);
for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  const value = argumentsList[index + 1];
  if (!['--case', '--cases', '--manifest'].includes(argument) || !value || value.startsWith('--')) {
    console.error(usage());
    process.exit(1);
  }
  if (argument === '--case') options.caseId = value;
  if (argument === '--cases') options.casesPath = value;
  if (argument === '--manifest') options.manifestPath = value;
  index += 1;
}

try {
  const result = await runKnownTopicRegressions(options);
  result.lines.forEach((line) => console.log(line));
  result.summary.forEach((line) => console.log(line));
} catch (error) {
  console.error(`Known-topic regression check failed: ${error.message}`);
  process.exitCode = 1;
}
