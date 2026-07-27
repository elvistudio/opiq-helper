#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4ContentQualityArtifacts,
  contentQualityAuditPath,
  contentQualityReportPath,
  contentQualitySchemaPath,
} from './lib/grade-4-canonical-sources.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
const write = argumentsList.includes('--write');
const check = argumentsList.includes('--check') || !write;
const unknown = argumentsList.filter((argument) => !['--check', '--write'].includes(argument));
if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);

const artifacts = await buildGrade4ContentQualityArtifacts(rootDir);
const schema = JSON.parse(await readFile(path.join(rootDir, contentQualitySchemaPath), 'utf8'));
const validate = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
}).compile(schema);
if (!validate(artifacts.report)) {
  throw new Error(`Grade 4 content-quality report is schema-invalid: ${JSON.stringify(validate.errors)}`);
}

if (check) {
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
  process.stdout.write(
    `Grade 4 content-quality report is current: ${artifacts.report.canonical_import_status}; downstream ${artifacts.report.downstream_course_building_status}.\n`,
  );
} else {
  await writeFile(path.join(rootDir, contentQualityReportPath), artifacts.json);
  await writeFile(path.join(rootDir, contentQualityAuditPath), artifacts.markdown);
  process.stdout.write(`Generated ${contentQualityReportPath} and ${contentQualityAuditPath}.\n`);
}
