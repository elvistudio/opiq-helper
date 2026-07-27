#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import {
  assertCommittedBytes,
  buildGrade4CatalogueGapArtifacts,
  catalogueGapAuditPath,
  catalogueGapReportPath,
  catalogueGapSchemaPath,
  catalogueSnapshotPath,
  catalogueSnapshotSchemaPath,
  validateCatalogueSnapshotSemantics,
} from './lib/grade-4-catalogue-gap.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const unknown = args.filter((argument) => argument !== '--check');
if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);

const artifacts = await buildGrade4CatalogueGapArtifacts(rootDir);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});
const snapshotSchema = JSON.parse(await readFile(path.join(rootDir, catalogueSnapshotSchemaPath), 'utf8'));
const reportSchema = JSON.parse(await readFile(path.join(rootDir, catalogueGapSchemaPath), 'utf8'));
const validateSnapshot = ajv.compile(snapshotSchema);
const validateReport = ajv.compile(reportSchema);

if (!validateSnapshot(artifacts.snapshot)) {
  throw new Error(`Grade 4 live-catalogue snapshot is schema-invalid: ${JSON.stringify(validateSnapshot.errors)}`);
}
if (!validateReport(artifacts.report)) {
  throw new Error(`Grade 4 source-gap report is schema-invalid: ${JSON.stringify(validateReport.errors)}`);
}
const semanticDiagnostics = validateCatalogueSnapshotSemantics(artifacts.snapshot);
if (semanticDiagnostics.length > 0) {
  throw new Error(`Grade 4 live-catalogue snapshot is semantically invalid: ${semanticDiagnostics.join(', ')}`);
}

if (check) {
  for (const [artifactPath, expected] of [
    [catalogueSnapshotPath, artifacts.snapshotJson],
    [catalogueGapReportPath, artifacts.reportJson],
    [catalogueGapAuditPath, artifacts.markdown],
  ]) {
    assertCommittedBytes(expected, await readFile(path.join(rootDir, artifactPath)), artifactPath);
  }
  process.stdout.write(
    `Grade 4 catalogue-gap artifacts are current: ${artifacts.report.summary.total_live_kits} live kits; ${artifacts.report.completeness_status}.\n`,
  );
} else {
  for (const artifactPath of [catalogueSnapshotPath, catalogueGapReportPath, catalogueGapAuditPath]) {
    await mkdir(path.dirname(path.join(rootDir, artifactPath)), { recursive: true });
  }
  await writeFile(path.join(rootDir, catalogueSnapshotPath), artifacts.snapshotJson);
  await writeFile(path.join(rootDir, catalogueGapReportPath), artifacts.reportJson);
  await writeFile(path.join(rootDir, catalogueGapAuditPath), artifacts.markdown);
  process.stdout.write(
    `Generated ${catalogueSnapshotPath}, ${catalogueGapReportPath}, and ${catalogueGapAuditPath}.\n`,
  );
}
