#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanArtifactReviewDiagnostic,
  loadTeacherWorkPlanArtifactReviewRepository,
  validateTeacherWorkPlanArtifactReviewRepository,
} from './lib/teacher-work-plan-artifact-reviews.mjs';

const repository = await loadTeacherWorkPlanArtifactReviewRepository({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanArtifactReviewRepository(repository);

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
    + `teacher status ${result.summary.teacher_status}; `
    + `safety status ${result.summary.safety_status}; `
    + `classroom trial ${result.summary.classroom_trial}; 0 validation errors.\n`,
  );
}
