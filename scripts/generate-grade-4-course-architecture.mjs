#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  buildGrade4CourseArchitectureArtifacts,
  checkGrade4CourseArchitectureFiles,
  validateGrade4CourseArchitecture,
  validateGrade4CourseArchitectureSchemas,
  writeGrade4CourseArchitectureFiles,
} from './lib/grade-4-course-architecture.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const unknown = args.filter((argument) => argument !== '--check');

try {
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  const artifacts = await buildGrade4CourseArchitectureArtifacts(rootDir);
  const schemaFailures = await validateGrade4CourseArchitectureSchemas(rootDir, artifacts);
  const semanticDiagnostics = validateGrade4CourseArchitecture(artifacts);
  if (schemaFailures.length > 0 || semanticDiagnostics.length > 0) {
    const messages = [
      ...schemaFailures.map((failure) => `schema_invalid: ${failure}`),
      ...semanticDiagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.artifact_path}#${diagnostic.record_id}: ${diagnostic.message}`),
    ];
    throw new Error(messages.join('\n'));
  }
  if (check) {
    const fileDiagnostics = await checkGrade4CourseArchitectureFiles(rootDir, artifacts);
    if (fileDiagnostics.length > 0) throw new Error(fileDiagnostics.map((entry) => `${entry.code}: ${entry.artifact_path}`).join('\n'));
    process.stdout.write(
      `Grade 4 course architecture is current: ${artifacts.routes.length} routes, `
      + `${artifacts.inputs.model.canonical_owners.size} canonical records, ${artifacts.files.size} generated files.\n`,
    );
  } else {
    await writeGrade4CourseArchitectureFiles(rootDir, artifacts);
    process.stdout.write(
      `Generated Grade 4 course architecture: ${artifacts.routes.length} routes, `
      + `${artifacts.inputs.model.canonical_owners.size} canonical records, ${artifacts.files.size} files.\n`,
    );
  }
} catch (error) {
  console.error(`Grade 4 course architecture failed: ${error.message}`);
  process.exitCode = 1;
}
