#!/usr/bin/env node

import process from 'node:process';
import {
  collectTeacherWorkPlanChangedPaths,
  formatTeacherWorkPlanDiagnostic,
  loadTeacherWorkPlanExtractionRepository,
  validateTeacherWorkPlanChangedPaths,
  validateTeacherWorkPlanExtractionRepository,
} from './lib/teacher-work-plan-extractions.mjs';

async function main() {
  const repository = await loadTeacherWorkPlanExtractionRepository();
  const validation = validateTeacherWorkPlanExtractionRepository(repository);
  const scopeDiagnostics = validateTeacherWorkPlanChangedPaths(
    collectTeacherWorkPlanChangedPaths({
      baseRef: process.env.TEACHER_WORK_PLAN_BASE_REF ?? 'origin/main',
    }),
  );
  const diagnostics = [...validation.diagnostics, ...scopeDiagnostics];

  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(formatTeacherWorkPlanDiagnostic(diagnostic));
    }
    process.exitCode = 1;
    return;
  }

  const summary = validation.summary;
  console.log(
    'Teacher work-plan extraction valid: '
    + `${summary.thematic_blocks} thematic blocks, `
    + `${summary.lesson_ranges} lesson ranges covering ${summary.lessons_covered} lessons, `
    + `${summary.unresolved_items} unresolved items; `
    + `${summary.source_pages} pages and ${summary.declared_hours} declared hours verified.`,
  );
}

main().catch((error) => {
  console.error(`Teacher work-plan extraction check failed: ${error.message}`);
  process.exitCode = 1;
});
