#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanArtifactClassroomTrialDiagnostic,
  loadTeacherWorkPlanArtifactClassroomTrialRepositories,
  validateTeacherWorkPlanArtifactClassroomTrialRepositories,
} from './lib/teacher-work-plan-artifact-classroom-trials.mjs';

const repository = await loadTeacherWorkPlanArtifactClassroomTrialRepositories({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanArtifactClassroomTrialRepositories(repository);

for (const problem of result.diagnostics) {
  process.stderr.write(`${formatTeacherWorkPlanArtifactClassroomTrialDiagnostic(problem)}\n`);
}

if (result.diagnostics.length > 0) process.exitCode = 1;
else {
  process.stdout.write(
    `Validated ${result.summary.trial_templates} trial template; `
    + `${result.summary.registered_analysed_trial_records} registered analysed trial records; `
    + `${Object.entries(result.summary.artifacts).map(([artifactId, state]) => (
      `${artifactId}: status ${state.classroom_trial_status}, prerequisites ${state.prerequisites_satisfied}, `
      + `teacher ${state.teacher_review}, safety ${state.local_safety_review}, fingerprint current ${state.fingerprint_current}`
    )).join('; ')}; 0 validation errors.\n`,
  );
}
