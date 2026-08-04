#!/usr/bin/env node

import process from 'node:process';

import {
  formatTeacherWorkPlanArtifactClassroomTrialDiagnostic,
  loadTeacherWorkPlanArtifactClassroomTrialRepository,
  validateTeacherWorkPlanArtifactClassroomTrialRepository,
} from './lib/teacher-work-plan-artifact-classroom-trials.mjs';

const repository = await loadTeacherWorkPlanArtifactClassroomTrialRepository({ rootDir: process.cwd() });
const result = validateTeacherWorkPlanArtifactClassroomTrialRepository(repository);

for (const problem of result.diagnostics) {
  process.stderr.write(`${formatTeacherWorkPlanArtifactClassroomTrialDiagnostic(problem)}\n`);
}

if (result.diagnostics.length > 0) process.exitCode = 1;
else {
  process.stdout.write(
    `Validated ${result.summary.trial_templates} trial template; `
    + `${result.summary.registered_analysed_trial_records} registered analysed trial records; `
    + `classroom-trial status ${result.summary.classroom_trial_status}; `
    + `prerequisites satisfied ${result.summary.prerequisites_satisfied}; `
    + `teacher review ${result.summary.teacher_review}; `
    + `local safety review ${result.summary.local_safety_review}; `
    + `fingerprint current ${result.summary.fingerprint_current}; 0 validation errors.\n`,
  );
}
