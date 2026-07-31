#!/usr/bin/env node

import process from 'node:process';
import {
  collectTeacherWorkPlanChangedPaths,
  formatTeacherWorkPlanDiagnostic,
  loadTeacherWorkPlanExtractionRepositories,
  validateTeacherWorkPlanChangedPaths,
  validateTeacherWorkPlanExtractionRepositories,
} from './lib/teacher-work-plan-extractions.mjs';

async function main() {
  const collection = await loadTeacherWorkPlanExtractionRepositories();
  const validation = validateTeacherWorkPlanExtractionRepositories(collection);
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

  for (const summary of validation.summaries) {
    const hours = typeof summary.declared_hours === 'number'
      ? String(summary.declared_hours)
      : `${summary.declared_hours.minimum}-${summary.declared_hours.maximum}`;
    console.log(
      `${summary.extraction_id}: `
      + `${summary.thematic_blocks} thematic blocks, `
      + `${summary.lesson_ranges} lesson ranges covering ${summary.lessons_covered} lessons, `
      + `${summary.unresolved_items} unresolved items; `
      + `${summary.source_pages} pages and ${hours} declared block hours verified.`,
    );
  }
  console.log(`Teacher work-plan extraction collection valid: ${validation.summaries.length} artifacts.`);
}

main().catch((error) => {
  console.error(`Teacher work-plan extraction check failed: ${error.message}`);
  process.exitCode = 1;
});
