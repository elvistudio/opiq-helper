#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4SourceArtifacts,
  evidenceSchemaPath,
  qaSchemaPath,
} from './lib/grade-4-canonical-sources.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
const check = argumentsList.includes('--check');
const unknown = argumentsList.filter((argument) => argument !== '--check');
if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);

const readJson = async (relativePath) => JSON.parse(
  await readFile(path.join(rootDir, relativePath), 'utf8'),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});
const validateEvidence = ajv.compile(await readJson(evidenceSchemaPath));
const validateQa = ajv.compile(await readJson(qaSchemaPath));

const artifacts = await buildGrade4SourceArtifacts(rootDir);
if (!validateEvidence(artifacts.evidence)) {
  throw new Error(`Grade 4 Kit Details evidence is schema-invalid: ${JSON.stringify(validateEvidence.errors)}`);
}
for (const artifact of artifacts.route_artifacts) {
  if (!validateQa(artifact.qa)) {
    throw new Error(`${artifact.model.definition.id} QA is schema-invalid: ${JSON.stringify(validateQa.errors)}`);
  }
}

if (check) {
  for (const [relativePath, expected] of artifacts.files) {
    assertCommittedBytes(
      expected,
      await readFile(path.join(rootDir, relativePath)),
      relativePath,
    );
  }
  process.stdout.write(
    `Grade 4 canonical sources are current: ${artifacts.route_artifacts.length} routes, ${artifacts.model.canonical_owners.size} records.\n`,
  );
} else {
  for (const [relativePath, bytes] of artifacts.files) {
    await writeFile(path.join(rootDir, relativePath), bytes);
  }
  process.stdout.write(
    `Generated ${artifacts.route_artifacts.length} Grade 4 canonical routes and QA snapshots.\n`,
  );
}
