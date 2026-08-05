#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanArtifactRegistryDiagnostic,
  loadTeacherWorkPlanArtifactRegistry,
  validateTeacherWorkPlanArtifactRegistry,
} from './lib/teacher-work-plan-artifact-registry.mjs';

const repository = await loadTeacherWorkPlanArtifactRegistry({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanArtifactRegistry(repository);

for (const problem of result.diagnostics) {
  process.stderr.write(`${formatTeacherWorkPlanArtifactRegistryDiagnostic(problem)}\n`);
}

if (result.diagnostics.length > 0) process.exitCode = 1;
else {
  process.stdout.write(
    `Validated ${result.summary.artifact_registries} artifact registry, `
    + `${result.summary.registered_artifacts} registered artifact, `
    + `${result.summary.discovered_artifact_indexes} discovered artifact index, `
    + `${result.summary.validation_profiles} validation profile, and `
    + `${result.summary.implemented_internal_drafts} implemented internal draft; `
    + `next authoring package ${result.summary.next_authoring_package} `
    + `(${result.summary.next_package_status}); 0 validation errors.\n`,
  );
}
