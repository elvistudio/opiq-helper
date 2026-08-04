#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanReusableArtifactDiagnostic,
  loadTeacherWorkPlanReusableArtifactRepository,
  validateTeacherWorkPlanReusableArtifactRepository,
} from './lib/teacher-work-plan-reusable-artifacts.mjs';

const repository = await loadTeacherWorkPlanReusableArtifactRepository({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanReusableArtifactRepository(repository);

for (const problem of result.diagnostics) {
  process.stderr.write(`${formatTeacherWorkPlanReusableArtifactDiagnostic(problem)}\n`);
}

if (result.diagnostics.length > 0) process.exitCode = 1;
else {
  process.stdout.write(
    `Validated ${result.summary.artifacts} reusable artifact package, `
    + `${result.summary.source_gaps_supported} supported source gaps, `
    + `${result.summary.materials} resolved material files, and `
    + `${result.summary.opiq_context_records} optional Opiq context records; `
    + '0 validation errors; canonical gap statuses unchanged.\n',
  );
}
