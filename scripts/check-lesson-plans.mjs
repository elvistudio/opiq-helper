#!/usr/bin/env node

import {
  formatLessonPlanDiagnostic,
  loadLessonPlanRepository,
  validateLessonPlanRepository,
} from './lib/lesson-plans.mjs';

try {
  const repository = await loadLessonPlanRepository();
  const result = validateLessonPlanRepository(repository);
  for (const diagnostic of result.diagnostics) console.error(formatLessonPlanDiagnostic(diagnostic));
  if (result.summary.errors > 0) {
    console.error(`Teaching-plan check failed: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s).`);
    process.exitCode = 1;
  } else {
    console.log(
      `Teaching-plan check passed: ${result.summary.profiles} profiles, ${result.summary.lessons} lessons, `
      + `${result.summary.units} thematic plan, ${result.summary.annualCourses} annual architecture, `
      + `${result.summary.annualComponents} annual components, ${result.summary.annualUnits} annual units, `
      + `${result.summary.annualSelectedPages} annual selected pages, `
      + `${result.summary.pageReferences} canonical page references; ${result.summary.warnings} warning(s).`,
    );
  }
} catch (error) {
  console.error(`Teaching-plan check failed: ${error.message}`);
  process.exitCode = 1;
}
