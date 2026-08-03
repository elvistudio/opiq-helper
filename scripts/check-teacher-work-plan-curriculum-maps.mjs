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
    const grade5 = result.summary.per_artifact['grade-5-science'];
    const grade6 = result.summary.per_artifact['grade-6-science'];
    const grade7Geography = result.summary.per_artifact['grade-7-geography'];
    const grade7Science = result.summary.per_artifact['grade-7-science'];
    console.log(
      `Teacher work-plan curriculum map check passed: ${result.summary.artifacts} artifacts; `
      + `Grade 5 classified ${grade5.total_source_lesson_ranges} source ranges; `
      + `Grade 6 classified ${grade6.total_source_lesson_ranges} source ranges; `
      + `Grade 7 geography classified ${grade7Geography.total_source_lesson_ranges} source ranges; `
      + `Grade 7 science classified ${grade7Science.total_source_lesson_ranges} source ranges and `
      + `${grade7Science.unnumbered_source_row_count} unnumbered source row; `
      + `${result.summary.total_source_lesson_ranges} total classified ranges; `
      + `${result.summary.total_source_records} total source records.`,
    );
  }
} catch (error) {
  console.error(`Teacher work-plan curriculum map check failed: ${error.message}`);
  process.exitCode = 1;
}
