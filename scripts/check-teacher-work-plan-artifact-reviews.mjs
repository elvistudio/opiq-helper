#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanArtifactReviewDiagnostic,
  loadTeacherWorkPlanArtifactReviewRepositories,
  validateTeacherWorkPlanArtifactReviewRepositories,
} from './lib/teacher-work-plan-artifact-reviews.mjs';

const repository = await loadTeacherWorkPlanArtifactReviewRepositories({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanArtifactReviewRepositories(repository);

for (const problem of result.diagnostics) {
  process.stderr.write(`${formatTeacherWorkPlanArtifactReviewDiagnostic(problem)}\n`);
}

if (result.diagnostics.length > 0) process.exitCode = 1;
else {
  process.stdout.write(
    `Validated ${result.summary.review_registries} review registry, `
    + `${result.summary.teacher_review_templates} teacher-review template, `
    + `${result.summary.local_safety_review_templates} local-safety-review template, `
    + `${result.summary.completed_teacher_reviews} completed teacher reviews, and `
    + `${result.summary.completed_safety_reviews} completed safety reviews; `
    + `${result.summary.classroom_trial_templates} classroom-trial template; `
    + `${result.summary.completed_classroom_trials} completed classroom trials; `
    + `${Object.entries(result.summary.artifacts).map(([artifactId, state]) => (
      `${artifactId}: teacher ${state.teacher_status}, safety ${state.safety_status}, trial ${state.classroom_trial}`
    )).join('; ')}; 0 validation errors.\n`,
  );
}
