#!/usr/bin/env node

import {
  formatTeacherWorkPlanCurriculumMapDiagnostic,
  loadTeacherWorkPlanCurriculumMapRepository,
  validateTeacherWorkPlanCurriculumMapRepository,
} from './lib/teacher-work-plan-curriculum-maps.mjs';

try {
  const repository = await loadTeacherWorkPlanCurriculumMapRepository();
  const result = validateTeacherWorkPlanCurriculumMapRepository(repository);
  for (const diagnostic of result.diagnostics) {
    console.error(formatTeacherWorkPlanCurriculumMapDiagnostic(diagnostic));
  }
  if (result.summary.errors > 0) {
    console.error(`Teacher work-plan curriculum map check failed: ${result.summary.errors} error(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Teacher work-plan curriculum map check passed: ${result.summary.artifacts} artifact, `
      + `${result.summary.total_source_lesson_ranges} source ranges classified `
      + `(${result.summary.matched_count} matched, ${result.summary.partial_count} partial, `
      + `${result.summary.missing_count} missing, ${result.summary.ambiguous_count} ambiguous, `
      + `${result.summary.outside_route_count} outside route).`,
    );
  }
} catch (error) {
  console.error(`Teacher work-plan curriculum map check failed: ${error.message}`);
  process.exitCode = 1;
}
