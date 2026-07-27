#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  auditPath,
  buildReportArtifacts,
  reportPath,
} from './lib/grade-4-source-intake.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.slice(2).includes('--check');
const unknown = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);

const artifacts = await buildReportArtifacts(rootDir);
const schema = JSON.parse(await readFile(path.join(rootDir, 'schemas/grade-4-source-intake-report.schema.json'), 'utf8'));
const validate = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(schema);
if (!validate(artifacts.report)) {
  throw new Error(`Generated Grade 4 intake report is schema-invalid: ${JSON.stringify(validate.errors)}`);
}
if (check) {
  assertCommittedBytes(artifacts.json, await readFile(path.join(rootDir, reportPath)), reportPath);
  assertCommittedBytes(artifacts.markdown, await readFile(path.join(rootDir, auditPath)), auditPath);
  process.stdout.write(`Grade 4 source intake audit is current: ${artifacts.report.scope.archive_count} archives, ${artifacts.report.source_accounting_totals.total_source_records} records.\n`);
} else {
  await writeFile(path.join(rootDir, reportPath), artifacts.json);
  await writeFile(path.join(rootDir, auditPath), artifacts.markdown);
  process.stdout.write(`Generated ${reportPath} and ${auditPath}.\n`);
}
